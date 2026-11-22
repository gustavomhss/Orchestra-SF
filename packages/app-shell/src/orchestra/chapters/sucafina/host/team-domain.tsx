import { createMemoryHistory, MemoryRouter, Route } from "@solidjs/router"
import { createEffect, createMemo, For, onCleanup, Show, untrack, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { Schema } from "effect"
import { createSfTeamDomainTransport } from "@orchestra/client/sucafina/team-domain"
import type { SfTransport, SfTransportFetch } from "@orchestra/client/sucafina/transport"
import {
  SfTeamContext, SfTeamInstallationDescriptor,
  type SfContextStamp, type SfOwnerKey,
} from "@orchestra/schema/sucafina/context"
import { useLanguage } from "@/context/language"
import { SfContextHandleProvider } from "../context"
import type { SfContextHandle, SfContextState, SfDraftDependencies, SfOwnerIdentity } from "../context/contracts"
import { createSfOwnerDrafts } from "../context/drafts"
import { createSfDraft } from "../shared/draft"
import { SfVendorContractsPage } from "../procurement/contracts"
import { SfDashboardOpexView } from "../dashboard/opex"
import { SfDashboardCapexView } from "../dashboard/capex"
import { revalidateVendorContractDraft } from "./draft-revalidation-vendor"
import { revalidateBudgetDraft } from "./draft-revalidation-budget"
import {
  normalizeSfTeamDomainNavigation, readSfTeamDomainIntent, resolveSfTeamDomainRoute,
  sfTeamDomainCurrent, sfTeamDomainHref, sfTeamDomainSelection,
  type SfTeamDomainCapability, type SfTeamDomainRoute,
} from "./team-domain-route"

/** The caller supplies the actual discovery/F02 observation and its lifetime. */
export type SfTeamDomainSession = Readonly<{
  binding: SfTeamInstallationDescriptor
  context: SfTeamContext
  generation: number
  signal: AbortSignal
}>
type Retirement = Parameters<SfContextHandle["invalidate"]>[0]
type Drafts = ReturnType<typeof createSfOwnerDrafts<SfTeamContext>>
type Ready = NonNullable<ReturnType<SfContextHandle["ready"]>>

function sameStamp(left: SfContextStamp, right: SfContextStamp): boolean {
  const a = left.team, b = right.team
  return !!a && !!b && left.installationId === right.installationId && left.projectId === right.projectId &&
    left.hostId === right.hostId && left.principalRef === right.principalRef &&
    left.policyVersion === right.policyVersion && left.accessRevision === right.accessRevision &&
    a.owner.profile.installationId === b.owner.profile.installationId &&
    a.owner.profile.tenantId === b.owner.profile.tenantId &&
    a.owner.profile.teamObjectId === b.owner.profile.teamObjectId &&
    a.owner.principal.tenantId === b.owner.principal.tenantId &&
    a.owner.principal.principalObjectId === b.owner.principal.principalObjectId &&
    a.revisions.configRevision === b.revisions.configRevision && a.revisions.accessRevision === b.revisions.accessRevision
}

function validSession(value: SfTeamDomainSession): boolean {
  return !value.signal.aborted && Number.isSafeInteger(value.generation) && value.generation >= 0 &&
    Schema.is(SfTeamInstallationDescriptor)(value.binding) && Schema.is(SfTeamContext)(value.context) &&
    sfTeamDomainCurrent(value.binding, value.context)
}

function identityFor(current: SfTeamDomainSession, authEpoch: number): SfOwnerIdentity {
  const { binding, context } = current
  const owner = context.stamp.team!.owner
  return Object.freeze({
    serverKey: binding.publicOrigin, publicOrigin: binding.publicOrigin, projectId: binding.projectId,
    installationId: binding.installationId, principalRef: context.stamp.principalRef, authEpoch,
    // Stable authority identity includes the full Team owner, not a revision or a display name.
    transportIdentity: JSON.stringify([binding.publicOrigin, binding.mount, binding.hostId, binding.projectId,
      owner.profile.installationId, owner.profile.tenantId, owner.profile.teamObjectId,
      owner.principal.tenantId, owner.principal.principalObjectId]),
  })
}

/**
 * One original draft registry outside keyed leaf/render boundaries. No context
 * conversion, persisted drafts, automatic mutation replay or fabricated read.
 */
export function createSfTeamDomainOwner(options: Readonly<{
  initial: SfTeamDomainSession
  current: () => SfTeamDomainSession | undefined
  fetch: SfTransportFetch
  reload: () => Promise<void>
  onAccessRevoked?: () => void
}>) {
  const [store, setStore] = createStore<{ state: SfContextState; generation: number }>({
    state: { status: "resolving", selection: sfTeamDomainSelection(options.initial.binding) }, generation: 0,
  })
  let disposed = false
  let authority: SfTeamDomainSession | undefined
  let pending: AbortController | undefined
  let removeParentAbort: (() => void) | undefined
  let drafts: Drafts | undefined
  let access: Ready | undefined
  let admitted: SfTeamDomainSession | undefined
  const parentCurrent = (input: SfTeamDomainSession) => {
    const current = options.current()
    return !!current && !input.signal.aborted && current.signal === input.signal &&
      current.generation === input.generation && current.context === input.context &&
      current.binding === input.binding && validSession(current)
  }
  const live = (input: SfTeamDomainSession, epoch: number) => !disposed && store.generation === epoch &&
    authority === input && !pending?.signal.aborted && parentCurrent(input)
  const stop = () => {
    removeParentAbort?.()
    removeParentAbort = undefined
    pending?.abort()
    pending = undefined
    authority = undefined
    admitted = undefined
    access = undefined
    setStore("generation", (value) => value + 1)
  }
  const suspend = () => {
    if (disposed || !authority && store.state.status === "resolving") return
    drafts?.quarantine()
    stop()
    setStore("state", { status: "resolving", selection: store.state.selection })
  }
  const retire = (reason: Retirement) => {
    if (disposed) return
    if (reason === "session-expired") drafts?.quarantine()
    else {
      const dirty = drafts?.dirty() === true
      drafts?.revoke(reason === "logout" ? "logout" : reason === "revoked" ? "access-revoked" : "owner-changed")
      drafts = undefined
      if (reason === "revoked" && dirty) options.onAccessRevoked?.()
    }
    stop()
    setStore("state", { status: reason === "revoked" ? "denied" : "resolving", selection: store.state.selection })
  }
  const dependencies: SfDraftDependencies<SfTeamContext> = {
    createDraft: createSfDraft,
    async revalidateDraft(input, fresh, transport, signal) {
      const incoming = authority, epoch = store.generation
      if (!incoming || !live(incoming, epoch) || !sameStamp(incoming.context.stamp, fresh.stamp))
        return { status: "unavailable" }
      const proof = await (input.surfaceId === "CAP14"
        ? revalidateVendorContractDraft(input, fresh, transport, signal)
        : revalidateBudgetDraft(input, fresh, transport, signal))
      if (signal.aborted || !live(incoming, epoch)) return { status: "unavailable" }
      if (proof.status === "authorized" && !sameStamp(proof.stamp, fresh.stamp))
        return { status: "authority-changed" }
      return proof
    },
  }
  const activate = async (input: SfTeamDomainSession): Promise<void> => {
    if (disposed || authority === input && access || admitted && admitted.context === input.context &&
        admitted.generation === input.generation && admitted.signal === input.signal && parentCurrent(admitted)) return
    drafts?.quarantine()
    stop()
    const selection = sfTeamDomainSelection(input.binding)
    setStore("state", { status: "resolving", selection })
    if (!validSession(input) || !parentCurrent(input)) {
      drafts?.revoke("authority-changed")
      drafts = undefined
      setStore("state", { status: "context-mismatch", selection })
      return
    }
    authority = input
    const epoch = store.generation
    const controller = new AbortController()
    pending = controller
    const abort = () => { if (authority === input) suspend() }
    input.signal.addEventListener("abort", abort, { once: true })
    removeParentAbort = () => input.signal.removeEventListener("abort", abort)
    const identity = identityFor(input, epoch)
    const key = JSON.stringify([identity.transportIdentity, epoch]) as SfOwnerKey
    const incoming = { key, identity }
    const source = createSfTeamDomainTransport({
      binding: input.binding, context: () => live(input, epoch) ? input.context : undefined,
      generation: epoch, currentGeneration: () => store.generation, fetch: options.fetch,
    })
    if (drafts && !drafts.sameAuthority(drafts.owner().identity, identity)) {
      drafts.revoke("owner-changed")
      drafts = undefined
    }
    const retained = drafts
    const uncertain = retained?.hasUnresolvedOperations() === true
    const transport: SfTransport = Object.freeze({
      execute(operation, input, call) {
        // A retained submitted intent is not re-admitted by refresh or a new idempotency key.
        if (uncertain && operation.operationId.startsWith("domain.command."))
          return Promise.resolve({ kind: "transport-error", reason: "outcome-unknown" })
        return source.execute(operation, input, call)
      },
    })
    if (retained && retained.state() !== "revoked") {
      const revalidated = await retained.revalidate(incoming, input.context, transport, controller.signal)
      if (!live(input, epoch)) return
      if (!revalidated) {
        const denied = retained.state() === "revoked"
        if (denied) {
          drafts = undefined
          options.onAccessRevoked?.()
        }
        setStore("state", denied ? { status: "denied", selection } : { status: "unavailable", selection, reason: "network" })
        return
      }
    } else drafts = createSfOwnerDrafts(dependencies, incoming)
    if (!live(input, epoch) || !drafts) return
    admitted = input
    access = Object.freeze({ context: input.context, transport, drafts: drafts.registry })
    setStore("state", { status: "ready", selection, ownerKey: key, owner: identity,
      binding: input.binding, context: input.context })
  }
  const handle: SfContextHandle = Object.freeze({
    state: () => store.state, generation: () => store.generation,
    ready: () => store.state.status === "ready" && admitted && live(admitted, store.generation) ? access : undefined,
    hasDirtyDrafts: () => drafts?.dirty() === true,
    discardDrafts: () => drafts?.discardAll() === true,
    reload: options.reload, invalidate: retire,
  })
  const dispose = () => {
    if (disposed) return
    retire("owner-changed")
    disposed = true
  }
  return Object.freeze({ handle, activate, suspend, retire, dispose })
}

export type SfTeamDomainLifecycle = Readonly<{
  hasDirtyDrafts: () => boolean
  leave: () => Promise<boolean>
  retire: (reason: Retirement) => void
}>
export type SfTeamDomainHostProps = Readonly<{
  current: () => SfTeamDomainSession | undefined
  href: () => string
  fetch: SfTransportFetch
  reload: () => Promise<void>
  navigate: (href: string, replace?: boolean) => Promise<boolean>
  confirmDiscard: () => Promise<boolean>
  onLifecycle: (lifecycle: SfTeamDomainLifecycle | undefined) => void
}>
const titles = { CAP14: "sf.cap14.title", CAP04: "sf.cap04.title", CAP05: "sf.cap05.title" } as const
const capabilities: readonly SfTeamDomainCapability[] = ["CAP14", "CAP04", "CAP05"]

/** Keep mounted across loading/focus/expiry; the shell retires it explicitly on logout or owner loss. */
export function SfTeamDomainHost(props: SfTeamDomainHostProps): JSX.Element {
  const language = useLanguage()
  const [view, setView] = createStore({ initialized: false, notice: false })
  // The owner and its transport stay outside a Solid store proxy.
  let owner: ReturnType<typeof createSfTeamDomainOwner> | undefined
  let leaving: Promise<boolean> | undefined
  const fail = (error?: unknown) => {
    console.error("Team domain navigation or draft retention failed", error ?? "Current admission unavailable")
    setView("notice", true)
  }
  const leave = (): Promise<boolean> => {
    if (leaving) return leaving
    if (!owner?.handle.hasDirtyDrafts()) return Promise.resolve(true)
    const captured = owner, epoch = captured.handle.generation()
    leaving = (async () => {
      if (!await props.confirmDiscard()) return false
      if (owner !== captured || captured.handle.generation() !== epoch) return false
      if (captured.handle.discardDrafts()) return true
      fail()
      return false
    })().catch((error: unknown) => { fail(error); return false }).finally(() => { leaving = undefined })
    return leaving
  }
  const lifecycle: SfTeamDomainLifecycle = Object.freeze({
    hasDirtyDrafts: () => owner?.handle.hasDirtyDrafts() === true,
    leave,
    retire: (reason) => owner?.retire(reason),
  })
  props.onLifecycle(lifecycle)
  createEffect(() => {
    const current = props.current()
    untrack(() => {
      if (!current) { owner?.suspend(); return }
      if (!owner) {
        owner = createSfTeamDomainOwner({ initial: current, current: props.current, fetch: props.fetch,
          reload: props.reload, onAccessRevoked: () => setView("notice", true) })
        setView("initialized", true)
      }
      void owner.activate(current).catch((error: unknown) => { owner?.retire("revoked"); fail(error) })
    })
  })
  const ready = createMemo(() => {
    // Track initialization, then use the original owner object, never its proxy.
    if (!view.initialized || !owner) return
    const access = owner.handle.ready(), current = props.current(), epoch = owner.handle.generation()
    if (!access || !current || access.context !== current.context || !validSession(current)) return
    const href = props.href()
    let url: URL
    try { url = new URL(href, current.binding.publicOrigin) } catch { return }
    const intent = readSfTeamDomainIntent(url, current.binding)
    return { owner, current, epoch, href, route: resolveSfTeamDomainRoute(url, current.binding, current.context), domainPath: !!intent }
  })
  const navigate = async (capture: NonNullable<ReturnType<typeof ready>>, href: string, replace?: boolean) => {
    if (ready() !== capture || !capture.owner.handle.ready()) return
    const target = normalizeSfTeamDomainNavigation(href, capture.current.binding, capture.current.context)
    if (!target) { fail(); return }
    if (!await leave() || ready() !== capture || capture.owner.handle.generation() !== capture.epoch) return
    setView("notice", false)
    try { if (!await props.navigate(target, replace)) fail() } catch (error) { fail(error) }
  }
  onCleanup(() => {
    props.onLifecycle(undefined)
    owner?.dispose()
    owner = undefined
  })
  return <section data-sf-team-domain-host>
    <Show when={view.notice}><p role="alert">{language.t("sf.teams.actionFailed")}</p></Show>
    <Show when={ready()} keyed>{(capture) => <>
      <nav data-sf-team-domain-navigation>
        <For each={capabilities}>{(capabilityId) => <Show when={sfTeamDomainHref(capture.current.binding, capture.current.context, capabilityId)}>
          {(href) => <a data-sf-capability-id={capabilityId} href={href()} onClick={(event) => {
            if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return
            event.preventDefault()
            void navigate(capture, href())
          }}>{language.t(titles[capabilityId])}</a>}
        </Show>}</For>
      </nav>
      <Show when={capture.route} fallback={capture.domainPath ? <p role="alert">{language.t("sf.ui67.denied")}</p> : undefined} keyed>
        {(route) => <SfTeamDomainPage route={route} handle={capture.owner.handle} current={capture.current}
          navigate={(href, replace) => navigate(capture, href, replace)} />}
      </Show>
    </>}</Show>
  </section>
}

function SfTeamDomainPage(props: Readonly<{
  route: SfTeamDomainRoute
  handle: SfContextHandle
  current: SfTeamDomainSession
  navigate: (href: string, replace?: boolean) => Promise<void>
}>): JSX.Element {
  const history = createMemoryHistory()
  history.set({ value: props.route.href, replace: true, scroll: false })
  const routed = { ...history, set: (change: Parameters<typeof history.set>[0]) => { void props.navigate(change.value, change.replace) },
    go: (_delta: number) => { void props.handle.reload() } }
  const click: JSX.EventHandlerUnion<HTMLDivElement, MouseEvent> = (event) => {
    if (event.defaultPrevented || !(event.target instanceof Element)) return
    const anchor = event.target.closest<HTMLAnchorElement>("a[href]")
    if (!anchor || !event.currentTarget.contains(anchor)) return
    const target = normalizeSfTeamDomainNavigation(anchor.getAttribute("href")!, props.current.binding, props.current.context)
    // Unsupported family links do not fall through to a legacy profile.
    event.preventDefault()
    void props.navigate(target ?? anchor.getAttribute("href")!)
  }
  return <MemoryRouter history={routed} explicitLinks root={() => <SfContextHandleProvider value={props.handle}>
    <div data-sf-team-domain-page={props.route.surfaceId} onClick={click}>
      {props.route.surfaceId === "CAP14" ? <SfVendorContractsPage surfaceId="CAP14" route={props.route} /> :
        props.route.surfaceId === "CAP04" ? <SfDashboardOpexView surfaceId="CAP04" route={props.route} /> :
          <SfDashboardCapexView surfaceId="CAP05" route={props.route} />}
    </div>
  </SfContextHandleProvider>}><Route path="/*path" component={() => null} /></MemoryRouter>
}
