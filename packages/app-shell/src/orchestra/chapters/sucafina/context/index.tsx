import { batch, createContext, createEffect, onCleanup, untrack, useContext, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { createStore, reconcile } from "solid-js/store"
import { SfPageFrame } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { createSfOwnerDrafts } from "./drafts"
import { createSfTodayResumePort, type SfCurrentResumeOwner } from "../navigation-state/resume"
import { sfExecutiveLinkAllowed, sfExecutiveLinkMatches, sfExecutiveLinkRequest, sfExecutiveRevalidateRef } from "../cross-links"
import type {
  SfContext, SfContextHandle, SfContextProviderProps, SfContextState,
  SfOwnerIdentity, SfSurfaceProps,
} from "./contracts"
import type { SfInstallationDescriptor, SfOwnerKey, SfOwnerSelection } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"

const Context = createContext<SfContextHandle>()
type Active = Readonly<{
  context: SfContext
  transport: SfTransport
  drafts: ReturnType<typeof createSfOwnerDrafts>
}>

/**
 * This provider must be mounted within the selected Server SDK/Models owner,
 * and outside ChapterBoundary so chapter transitions cannot discard edits.
 */
export function SfContextProvider(props: SfContextProviderProps): JSX.Element {
  const [store, setStore] = createStore<{
    state: SfContextState
    generation: number
    active: Active | undefined
  }>({
    state: { status: "resolving", selection: props.selection() },
    generation: 0,
    active: undefined,
  })
  let inFlight: AbortController | undefined
  let current: Active | undefined
  let currentOwner: SfOwnerIdentity | undefined
  let ownerKey: SfOwnerKey | undefined
  let epoch = 0
  let disposed = false
  const sameSelection = (a: SfOwnerSelection, b: SfOwnerSelection) =>
    a.serverKey === b.serverKey && a.projectId === b.projectId && a.installationId === b.installationId

  const fence = (selection: SfOwnerSelection) => {
    inFlight?.abort()
    // A reload or owner transition cancels pending F01 route admission.
    props.dependencies.navigation?.invalidate()
    inFlight = new AbortController()
    batch(() => {
      setStore("generation", (value) => value + 1)
      setStore("active", undefined)
      // replace, do not merge: stale ready/private keys must not survive a revocation.
      setStore("state", reconcile({ status: "resolving", selection } satisfies SfContextState))
    })
    return { abort: inFlight, generation: store.generation }
  }
  const publish = (generation: number, next: SfContextState, active?: Active) => {
    if (disposed || generation !== store.generation || inFlight?.signal.aborted) return
    batch(() => {
      setStore("active", active)
      setStore("state", reconcile(next)) // union variant replacement removes old private fields
    })
  }
  const fail = (generation: number, selection: SfOwnerSelection, reason: "network" | "installation-unavailable") =>
    publish(generation, { status: "unavailable", selection, reason })
  const notifyDraftRevoked = () => {
    try { props.dependencies.onDraftAccessRevoked?.() }
    catch (error) { console.error("Sucafina draft access notice failed", error instanceof Error ? error.name : "unknown") }
  }

  const load = async (selection: SfOwnerSelection) => {
    const prior = store.state
    const { abort, generation } = fence(selection)
    const changingSelection = !sameSelection(prior.selection, selection)
    if (changingSelection) {
      props.dependencies.navigation?.clearResumeFocus()
      current?.drafts.revoke("owner-changed")
      current = undefined
      currentOwner = undefined
      ownerKey = undefined
      epoch += 1
    }
    publish(generation, { status: "resolving", selection })
    try {
      const discovery = await props.dependencies.listInstallations(selection, abort.signal)
      if (disposed || abort.signal.aborted || generation !== store.generation) return
      const choices = discovery.installations.filter((item) =>
        item.projectId === selection.projectId &&
        (!selection.installationId || item.installationId === selection.installationId) &&
        item.contractRevision === "sf-native-ui/1",
      )
      if (!choices.length) {
        if (discoveryDenied(discovery) || (!changingSelection && prior.status === "denied")) {
          const lostDrafts = current?.drafts.dirty() === true
          current?.drafts.revoke("access-revoked")
          current = undefined
          publish(generation, { status: "denied", selection })
          if (lostDrafts) notifyDraftRevoked()
          return
        }
        current?.drafts.revoke("owner-changed")
        current = undefined
        fail(generation, selection, "installation-unavailable")
        return
      }
      if (choices.length > 1) {
        current?.drafts.revoke("owner-changed")
        current = undefined
        publish(generation, { status: "choose-installation", selection, installations: choices })
        return
      }
      const binding: SfInstallationDescriptor = choices[0]!
      if (!binding.hostId || !binding.publicOrigin || !binding.mount || !binding.installationId ||
          binding.projectId !== selection.projectId ||
          (selection.installationId && binding.installationId !== selection.installationId)) {
        current?.drafts.revoke("authority-changed")
        current = undefined
        publish(generation, { status: "context-mismatch", selection })
        return
      }
      const result = await props.dependencies.loadContext(binding, abort.signal)
      if (disposed || abort.signal.aborted || generation !== store.generation) return
      if (result.status === "unauthenticated") {
        current?.drafts.quarantine()
        publish(generation, { status: "unauthenticated", selection, binding })
        return
      }
      if (result.status === "denied") {
        const lostDrafts = current?.drafts.dirty() === true
        current?.drafts.revoke("access-revoked")
        current = undefined
        publish(generation, { status: "denied", selection })
        if (lostDrafts) notifyDraftRevoked()
        return
      }
      if (result.status === "unavailable") {
        current?.drafts.quarantine()
        publish(generation, { status: "unavailable", selection, reason: result.reason })
        return
      }
      const fresh = result.value
      if (fresh.contractRevision !== "sf-native-ui/1" ||
          fresh.stamp.projectId !== binding.projectId ||
          fresh.stamp.installationId !== binding.installationId ||
          fresh.stamp.hostId !== binding.hostId ||
          !fresh.stamp.principalRef || !fresh.stamp.policyVersion || !fresh.stamp.accessRevision) {
        current?.drafts.revoke("authority-changed")
        current = undefined
        publish(generation, { status: "context-mismatch", selection })
        return
      }
      const transportIdentity = props.dependencies.resolveTransportIdentity(selection)
      if (!transportIdentity) {
        current?.drafts.revoke("authority-changed")
        current = undefined
        publish(generation, { status: "unavailable", selection, reason: "connection-unapproved" })
        return
      }
      const identity = {
        serverKey: selection.serverKey,
        transportIdentity,
        publicOrigin: binding.publicOrigin,
        projectId: fresh.stamp.projectId,
        installationId: fresh.stamp.installationId,
        principalRef: fresh.stamp.principalRef,
        authEpoch: epoch,
      } satisfies SfOwnerIdentity
      const sameIdentity = currentOwner !== undefined && current?.drafts.sameAuthority(currentOwner, identity)
      if (!sameIdentity || current?.context.stamp.hostId !== fresh.stamp.hostId) {
        current?.drafts.revoke("authority-changed")
        current = undefined
        epoch += 1
      }
      if (current?.drafts.state() === "revoked") {
        current = undefined
        currentOwner = undefined
        ownerKey = undefined
        epoch += 1
      }
      const renewedIdentity = { ...identity, authEpoch: epoch }
      const renewedKey = JSON.stringify([
        renewedIdentity.serverKey, renewedIdentity.transportIdentity, renewedIdentity.publicOrigin,
        renewedIdentity.projectId, renewedIdentity.installationId,
        renewedIdentity.principalRef, renewedIdentity.authEpoch,
      ]) as SfOwnerKey
      const changedAccess = current !== undefined &&
        (current.context.stamp.accessRevision !== fresh.stamp.accessRevision ||
         current.context.stamp.policyVersion !== fresh.stamp.policyVersion)
      const requiresRevalidation = current !== undefined && (current.drafts.state() === "quarantined" || changedAccess)
      if (changedAccess) current?.drafts.quarantine()
      // Every load fences the previous generation, even for an unchanged owner.
      // Use the transport authenticated by this load's original ctx.context read.
      const transport = props.dependencies.createTransport(binding, generation)
      if (requiresRevalidation && current) {
        epoch += 1
        const transferredIdentity = { ...renewedIdentity, authEpoch: epoch }
        const transferredKey = JSON.stringify([
          transferredIdentity.serverKey, transferredIdentity.transportIdentity, transferredIdentity.publicOrigin,
          transferredIdentity.projectId, transferredIdentity.installationId,
          transferredIdentity.principalRef, transferredIdentity.authEpoch,
        ]) as SfOwnerKey
        const restored = await current.drafts.revalidate(
          { key: transferredKey, identity: transferredIdentity }, fresh, transport, abort.signal,
        )
        if (disposed || abort.signal.aborted || generation !== store.generation) return
        if (!restored && current.drafts.state() !== "revoked") {
          publish(generation, { status: "unavailable", selection, reason: "host-unavailable" })
          return
        }
        const revoked = !restored && (current.drafts.revocationReason() === "access-revoked" ||
          current.drafts.revocationReason() === "authority-changed")
        const drafts = restored ? current.drafts : createSfOwnerDrafts(props.dependencies, { key: transferredKey, identity: transferredIdentity })
        current = { context: fresh, transport, drafts }
        currentOwner = transferredIdentity
        ownerKey = transferredKey
        publish(generation, { status: "ready", selection, owner: transferredIdentity, ownerKey: transferredKey, binding, context: fresh }, current)
        if (revoked) notifyDraftRevoked()
        return
      }
      const drafts = current?.drafts ?? createSfOwnerDrafts(props.dependencies, { key: renewedKey, identity: renewedIdentity })
      current = { context: fresh, transport, drafts }
      currentOwner = renewedIdentity
      ownerKey = renewedKey
      publish(generation, { status: "ready", selection, owner: renewedIdentity, ownerKey: renewedKey, binding, context: fresh }, current)
    } catch (error) {
      if (abort.signal.aborted || disposed || generation !== store.generation) return
      if (discoveryDenied(error) || (!changingSelection && prior.status === "denied")) {
        const lostDrafts = current?.drafts.dirty() === true
        current?.drafts.revoke("access-revoked")
        current = undefined
        publish(generation, { status: "denied", selection })
        if (lostDrafts) notifyDraftRevoked()
        return
      }
      console.error("Sucafina context read failed", error instanceof Error ? error.name : "unknown")
      current?.drafts.quarantine()
      fail(generation, selection, "network")
    }
  }
  const invalidate: SfContextHandle["invalidate"] = (reason) => {
    const selection = props.selection()
    fence(selection)
    props.dependencies.navigation?.clearResumeFocus()
    if (reason === "session-expired") {
      current?.drafts.quarantine()
      epoch += 1
      publish(store.generation, { status: "unavailable", selection, reason: "connection-auth-unavailable" })
      return
    }
    const lostDrafts = reason === "revoked" && current?.drafts.dirty() === true
    current?.drafts.revoke(reason === "logout" ? "logout" : reason === "revoked" ? "access-revoked" : "owner-changed")
    current = undefined
    currentOwner = undefined
    ownerKey = undefined
    epoch += 1
    publish(store.generation, { status: reason === "revoked" ? "denied" : "resolving", selection })
    if (lostDrafts) notifyDraftRevoked()
  }
  const currentResumeOwner = (): SfCurrentResumeOwner | undefined => {
    const state = store.state
    const active = store.active
    if (disposed || state.status !== "ready" || !active ||
        active.drafts.state() !== "active") return undefined
    return {
      ownerKey: state.ownerKey,
      generation: store.generation,
      selection: state.selection,
      stamp: active.context.stamp,
      transport: active.transport,
      caseReadReady: active.context.availability.some((resource) =>
        resource.operations.some((operation) =>
          operation.operationId === "projection.case" &&
          operation.state === "ready" && operation.operational)),
    }
  }
  const navigation = props.dependencies.navigation
  const resumePort = navigation ? createSfTodayResumePort(navigation, currentResumeOwner) : undefined
  const followExecutiveLink: NonNullable<SfContextHandle["followExecutiveLink"]> = async (from, target) => {
    const state = store.state
    const active = store.active
    const generation = store.generation
    if (!navigation || state.status !== "ready" || !active ||
        active.drafts.state() !== "active") return "denied"
    const originalOwnerKey = state.ownerKey
    const originalAccessRevision = state.context.stamp.accessRevision
    const originalPolicyVersion = state.context.stamp.policyVersion
    const destination = sfExecutiveLinkRequest(from, target)
    if (!destination) return "invalid-link"
    const selection = from.ownerSelection
    const stillSource = () => {
      const latest = store.state
      return !disposed && store.generation === generation && latest.status === "ready" &&
        latest.ownerKey === originalOwnerKey && store.active === active &&
        latest.context.stamp.accessRevision === originalAccessRevision &&
        latest.context.stamp.policyVersion === originalPolicyVersion &&
        latest.selection.serverKey === selection.serverKey &&
        latest.selection.projectId === selection.projectId &&
        latest.selection.installationId === selection.installationId &&
        latest.context.stamp.projectId === selection.projectId &&
        latest.context.stamp.installationId === selection.installationId &&
        active.drafts.state() === "active"
    }
    if (!stillSource() || !sfExecutiveLinkAllowed(active.context, target)) return "denied"
    const result = await navigation.requestNativeTransition(destination, "link", {
      expectedOwnerKey: originalOwnerKey,
      admit: (resolved) => stillSource() &&
        resolved.ownerSelection.serverKey === selection.serverKey &&
        resolved.ownerSelection.projectId === selection.projectId &&
        resolved.ownerSelection.installationId === selection.installationId &&
        sfExecutiveLinkMatches(resolved, target) &&
        sfExecutiveLinkAllowed(active.context, target),
      preCommit: async (_resolved, signal) => stillSource() && !signal.aborted &&
        await sfExecutiveRevalidateRef(active.transport, from, target, signal) &&
        stillSource() && sfExecutiveLinkAllowed(active.context, target),
    })
    return result.status
  };
  const handle: SfContextHandle = {
    state: () => store.state,
    generation: () => store.generation,
    hasDirtyDrafts: () => current?.drafts.dirty() === true,
    discardDrafts: () => (store.state.status === "ready" || current?.drafts.state() === "quarantined") &&
      current?.drafts.discardAll() === true,
    ready: () => {
      if (store.state.status !== "ready" || !store.active || !current) return undefined
      // The transport is an opaque instance registered in a private WeakMap.
      // Preserve its identity instead of returning a Solid store proxy.
      return { context: store.active.context, transport: current.transport, drafts: current.drafts.registry }
    },
    reload: () => load(props.selection()),
    invalidate,
    ...(navigation ? { followExecutiveLink } : {}),
    ...(resumePort ? {
      resumeCase: resumePort.resumeCase,
      claimResumeFocus: (input: Parameters<NonNullable<SfContextHandle["claimResumeFocus"]>>[0]) => {
        const owner = currentResumeOwner()
        if (!owner || !owner.caseReadReady ||
            owner.ownerKey !== input.ownerKey ||
            owner.stamp.accessRevision !== input.accessRevision ||
            input.returnRoute.surfaceId !== "UI29" ||
            input.returnRoute.kind !== "entry" ||
            input.returnRoute.pathname !== "/orchestra/sf-home" ||
            input.returnRoute.ownerSelection.serverKey !== owner.selection.serverKey ||
            input.returnRoute.ownerSelection.projectId !== owner.selection.projectId ||
            input.returnRoute.ownerSelection.installationId !== owner.selection.installationId)
          return false
        return navigation!.claimResumeFocus({
          ownerKey: owner.ownerKey,
          accessRevision: owner.stamp.accessRevision,
          caseRef: input.caseRef,
          sourceVersion: input.sourceVersion,
          returnHref: input.returnRoute.href,
        })
      },
    } : {}),
  }
  createEffect(() => {
    const selection = props.selection()
    // The owner selection alone triggers loading. The synchronous part of load()
    // reads state and generation; tracking either here would launch competing
    // reloads after each fence, revoking or resurrecting an unrelated owner.
    untrack(() => { void load(selection) })
  })
  onCleanup(() => {
    disposed = true
    inFlight?.abort()
    navigation?.invalidate()
    navigation?.clearResumeFocus()
    current?.drafts.revoke("owner-changed")
    current = undefined
  })
  return <Context.Provider value={handle}>{props.children}</Context.Provider>
}

function discoveryDenied(value: unknown): boolean {
  if (!value || typeof value !== "object") return false
  const detail = value as { status?: unknown; httpStatus?: unknown; reason?: unknown }
  return detail.status === "denied" || detail.status === "unauthenticated"
    || detail.httpStatus === 401 || detail.httpStatus === 403
    || detail.reason === "denied" || detail.reason === "unauthenticated"
}

export function useSfContext(): SfContextHandle {
  const value = useContext(Context)
  if (!value) throw new Error("SfContextProvider is required")
  return value
}

/** Context leaf: never renders a private projection outside the ready owner. */
export function SfContextPage(_props: SfSurfaceProps<"UI67">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const key = (value: string) => value as Parameters<typeof SfStatePanel>[0]["messageKey"]
  const ready = () => {
    const state = owner.state()
    return state.status === "ready" && owner.ready() ? state : undefined
  }
  const state = () => {
    switch (owner.state().status) {
      case "ready": return "ready" as const
      case "resolving": return "loading" as const
      case "denied": return "denied" as const
      case "unauthenticated": return "session-expired" as const
      case "context-mismatch": return "invalid" as const
      default: return "unavailable" as const
    }
  }
  const message = () => {
    switch (owner.state().status) {
      case "ready": return "sf.ui67.title"
      case "resolving": return "sf.ui67.loading"
      case "denied": return "sf.ui67.denied"
      case "unauthenticated": return "sf.ui67.unauthenticated"
      case "context-mismatch": return "sf.ui67.mismatch"
      case "choose-installation": return "sf.ui67.select"
      default: return "sf.ui67.unavailable"
    }
  }
  return (
    <SfPageFrame
      titleKey={key("sf.ui67.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[]}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
    >
      <SfStatePanel
        state={state()}
        messageKey={key(message())}
        onRetryRead={() => { void owner.reload() }}
      >
        {ready() && (
          <dl data-sf-context="authorized" aria-live="polite">
            <dt data-sf-copy="sf.ui67.server">{language.t("sf.ui67.server")}</dt><dd>{ready()!.owner.serverKey}</dd>
            <dt data-sf-copy="sf.ui67.project">{language.t("sf.ui67.project")}</dt><dd>{ready()!.binding.projectId}</dd>
            <dt data-sf-copy="sf.ui67.installation">{language.t("sf.ui67.installation")}</dt><dd>{ready()!.binding.installationId}</dd>
            <dt data-sf-copy="sf.ui67.identity">{language.t("sf.ui67.identity")}</dt><dd>{ready()!.context.stamp.principalRef}</dd>
          </dl>
        )}
      </SfStatePanel>
    </SfPageFrame>
  )
}
