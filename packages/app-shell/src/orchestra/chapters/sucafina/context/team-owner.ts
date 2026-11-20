import { createStore, reconcile } from "solid-js/store"
import { batch } from "solid-js"
import type { SfTeamContext, SfTeamInstallationDescriptor, SfOwnerKey, SfOwnerSelection, SfServerKey, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { TeamProfileRetirement } from "../../../../context/team-profile-selection"
import { createTeamPrivateLifetime, teamPrivateKey } from "../../../../utils/team-profile-storage"
import { createSfDraft } from "../shared/draft"
import { createSfOwnerDrafts } from "./drafts"
import type { SfContextHandle, SfContextState, SfOwnerIdentity } from "./contracts"
import { revalidateSfNativeDraft } from "../host/draft-revalidation"
import type { SfNativeNavigationState } from "../navigation-state"
import { createSfTodayResumePort, type SfCurrentResumeOwner } from "../navigation-state/resume"
import { sfSameOwnerSelection, sfSameTeamRef, sfSameContextStamp, sfOwnerMatchesContext } from "../navigation-state/owner"
import { sfExecutiveLinkRequest, sfExecutiveLinkAllowed, sfExecutiveLinkMatches, sfExecutiveRevalidateRef } from "../cross-links"

type Active = Readonly<{
  context: SfTeamContext; transport: SfTransport; drafts: ReturnType<typeof createSfOwnerDrafts>
  identity: SfOwnerIdentity; key: SfOwnerKey; generation: number
  lifetime: ReturnType<typeof createTeamPrivateLifetime>
}>
/** A native view lifetime built only after the real Teams context reader succeeds. */
export function createTeamNativeOwner(input: Readonly<{
  binding: SfTeamInstallationDescriptor; windowId: string
  reload(): Promise<void>
  invalidate(reason: "logout" | "revoked" | "principal-change"): void
  onDraftAccessRevoked(): void
}>) {
  const selection = (context?: SfTeamContext): SfOwnerSelection => ({
    serverKey: input.binding.publicOrigin as SfServerKey, projectId: input.binding.projectId as SfRef,
    installationId: input.binding.installationId as SfRef,
    ...(context?.stamp.team ? { team: context.stamp.team.owner.profile } : {}),
  })
  const [view, setView] = createStore<{ state: SfContextState; generation: number }>({
    state: { status: "resolving", selection: selection() }, generation: 0,
  })
  let active: Active | undefined, retained: Active | undefined
  let readyValue: ReturnType<SfContextHandle["ready"]>
  let serial = 0, navigation: SfNativeNavigationState | undefined
  const publish = (state: SfContextState, generation = view.generation) =>
    batch(() => { setView("generation", generation); setView("state", reconcile(state)) })
  const notice = () => {
    try { input.onDraftAccessRevoked() }
    catch (error) { console.error("Teams draft revocation notice failed", error instanceof Error ? error.name : "unknown") }
  }
  const retire = (reason: TeamProfileRetirement) => {
    serial++
    navigation?.invalidate()
    navigation?.clearResumeFocus()
    const previous = active ?? retained
    active = undefined; readyValue = undefined
    previous?.lifetime.revoke()
    if (reason === "refresh") {
      previous?.drafts.quarantine()
      retained = previous
    } else {
      const dirty = previous?.drafts.dirty() === true
      previous?.drafts.revoke(reason === "logout" ? "logout" :
        reason === "revoked" ? "access-revoked" : "owner-changed")
      retained = undefined
      if (dirty && reason === "revoked") notice()
    }
    publish({ status: "resolving", selection: selection() }, view.generation + 1)
  }
  const accept = async (context: SfTeamContext, transport: SfTransport, generation: number, signal: AbortSignal) => {
    const currentSerial = serial
    if (signal.aborted) return false
    const bound = context.stamp.team
    if (!bound) {
      // A complete projection that removes business rights revokes retained edits.
      // A provider outage keeps them quarantined for an explicit fresh revalidation.
      if (retained && context.profile.teams.status !== "unavailable") {
        const dirty = retained.drafts.dirty()
        retained.drafts.revoke("access-revoked"); retained = undefined
        if (dirty) notice()
      }
      // Authentication and supreme administration do not manufacture business access.
      publish(context.profile.teams.status === "denied" || context.profile.teams.status === "revoked"
        ? { status: "denied", selection: selection() }
        : { status: "unavailable", selection: selection(), reason: "host-unavailable" }, generation)
      return true
    }
    const identity: SfOwnerIdentity = Object.freeze({
      serverKey: input.binding.publicOrigin, transportIdentity: input.binding.publicOrigin + input.binding.mount,
      publicOrigin: input.binding.publicOrigin, projectId: context.stamp.projectId,
      installationId: context.stamp.installationId, principalRef: context.stamp.principalRef,
      team: bound.owner, authEpoch: generation,
    })
    // This is a UI discriminator only. The backend never accepts it as authority.
    const key = JSON.stringify([teamPrivateKey(bound.owner, "native-owner", input.windowId),
      context.stamp.hostId, context.stamp.policyVersion, context.stamp.accessRevision, generation]) as SfOwnerKey
    const previous = retained
    let drafts = previous?.drafts
    if (drafts && (!drafts.sameAuthority(previous.identity, identity) ||
        previous.context.stamp.hostId !== context.stamp.hostId)) {
      drafts.revoke("authority-changed"); drafts = undefined; retained = undefined
    }
    if (drafts?.state() === "quarantined") {
      const restored = await drafts.revalidate({ key, identity }, context, transport, signal)
      if (signal.aborted || serial !== currentSerial) return false
      if (!restored && drafts.state() !== "revoked") return false
      if (!restored) { drafts = undefined; notice() }
    }
    if (!drafts || drafts.state() === "revoked")
      drafts = createSfOwnerDrafts({ createDraft: createSfDraft, revalidateDraft: revalidateSfNativeDraft }, { key, identity })
    if (signal.aborted || serial !== currentSerial) return false
    const lifetime = createTeamPrivateLifetime(bound.owner, input.windowId)
    active = Object.freeze({ context, transport, drafts, identity, key, generation, lifetime })
    retained = active
    readyValue = Object.freeze({ context, transport, drafts: drafts.registry })
    publish({ status: "ready", selection: selection(context), owner: identity, ownerKey: key,
      binding: input.binding, context }, generation)
    return true
  }
  const currentResumeOwner = (): SfCurrentResumeOwner | undefined => {
    const state = view.state, value = active
    if (state.status !== "ready" || !value || value.drafts.state() !== "active") return
    return { ownerKey: value.key, generation: value.generation, selection: state.selection,
      stamp: value.context.stamp, transport: value.transport,
      caseReadReady: value.context.availability.some((resource) => resource.operations.some((operation) =>
        operation.operationId === "projection.case" && operation.state === "ready" && operation.operational)) }
  }
  let resume: ReturnType<typeof createSfTodayResumePort> | undefined
  const handle: SfContextHandle = Object.freeze({
    state: () => view.state,
    generation: () => view.generation,
    hasDirtyDrafts: () => (active ?? retained)?.drafts.dirty() === true,
    discardDrafts: () => (active ?? retained)?.drafts.discardAll() === true,
    ready: () => { const state = view.state; return state.status === "ready" && active?.lifetime.current() ? readyValue : undefined },
    reload: () => input.reload(),
    invalidate: (reason) => input.invalidate(reason === "logout" ? "logout" : "revoked"),
    followExecutiveLink: async (from, target) => {
      const value = active, state = view.state, nav = navigation
      if (!value || state.status !== "ready" || !nav) return "denied"
      const destination = sfExecutiveLinkRequest(from, target)
      if (!destination) return "invalid-link"
      const stillSource = () => active === value && value.lifetime.current() && view.state.status === "ready" &&
        value.drafts.state() === "active" && sfSameOwnerSelection(view.state.selection, from.ownerSelection) &&
        sfOwnerMatchesContext(value.context, from.ownerSelection)
      if (!stillSource() || !sfExecutiveLinkAllowed(value.context, target)) return "denied"
      const answer = await nav.requestNativeTransition(destination, "link", {
        expectedOwnerKey: value.key,
        admit: (route) => stillSource() && sfSameOwnerSelection(route.ownerSelection, state.selection) &&
          sfExecutiveLinkMatches(route, target) && sfExecutiveLinkAllowed(value.context, target),
        preCommit: async (_route, signal) => stillSource() && !signal.aborted &&
          await sfExecutiveRevalidateRef(value.transport, from, target, signal) && stillSource(),
      })
      return answer.status
    },
    resumeCase: (request, signal) => resume ? resume.resumeCase(request, signal) : Promise.resolve({ status: "denied" }),
    claimResumeFocus: (request) => {
      const owner = currentResumeOwner()
      if (!owner || !owner.caseReadReady || !navigation || owner.ownerKey !== request.ownerKey ||
          owner.stamp.accessRevision !== request.accessRevision || request.returnRoute.surfaceId !== "UI29" ||
          request.returnRoute.kind !== "entry" || request.returnRoute.pathname !== "/orchestra/sf-home" ||
          !sfSameOwnerSelection(request.returnRoute.ownerSelection, owner.selection)) return false
      return navigation.claimResumeFocus({ ownerKey: owner.ownerKey, accessRevision: owner.stamp.accessRevision,
        caseRef: request.caseRef, sourceVersion: request.sourceVersion, returnHref: request.returnRoute.href })
    },
  })
  return Object.freeze({
    handle, accept, retire,
    installNavigation(value: SfNativeNavigationState) {
      if (navigation) throw new Error("TEAM_NATIVE_NAVIGATION_ALREADY_BOUND")
      navigation = value
      resume = createSfTodayResumePort(value, currentResumeOwner)
    },
    current: () => active,
    sameContext: (context: SfTeamContext) => !!active && sfSameContextStamp(active.context.stamp, context.stamp) &&
      sfSameTeamRef(active.context.stamp.team?.owner.profile, context.stamp.team?.owner.profile),
  })
}
