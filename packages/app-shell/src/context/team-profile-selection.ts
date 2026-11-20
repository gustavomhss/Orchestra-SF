import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContext, SfTeamContextResult, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { sfSameContextStamp, sfSameTeamRef } from "../orchestra/chapters/sucafina/navigation-state/owner"

export type TeamProfileSelectionState =
  | Readonly<{ status: "resolving" }>
  | Readonly<{ status: "unauthenticated" | "denied" }>
  | Readonly<{ status: "unavailable"; reason: string }>
  | Readonly<{ status: "authenticated"; context: SfTeamContext }>
export type TeamProfileRetirement = "refresh" | "profile-change" | "logout" | "revoked" | "principal-change" | "dispose"
export type TeamProfileSelectionDependencies = Readonly<{
  binding: SfTeamInstallationDescriptor
  read(selector: TeamProfile.Selector, signal: AbortSignal, generation: number,
    currentGeneration: () => number): Promise<Readonly<{ result: unknown; transport: SfTransport }>>
  hasDirtyDrafts(): boolean
  confirmDiscard(): Promise<boolean>
  discardDrafts(): boolean
  retire(reason: TeamProfileRetirement): void
  /** Called only with a newly verified context and the transport that actually read it. */
  accept(context: SfTeamContext, transport: SfTransport, generation: number, signal: AbortSignal): Promise<boolean>
  broadcast?(): void
  restore?(principal: TeamProfile.Principal): TeamProfile.Ref | undefined
  remember?(principal: TeamProfile.Principal, selected: TeamProfile.Ref): boolean
}>
const freeze = <Value>(value: Value): Value => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) freeze(child)
    Object.freeze(value)
  }
  return value
}
const samePrincipal = (left: TeamProfile.Principal, right: TeamProfile.Principal) =>
  left.tenantId === right.tenantId && left.principalObjectId === right.principalObjectId

/**
 * A single window owns its selection. It never takes a directory, Project ID,
 * caller principal, grant or access revision as input. Browser state is intent;
 * every active transport follows the original server context read.
 */
export function createTeamProfileSelection(deps: TeamProfileSelectionDependencies) {
  const binding = freeze(Schema.decodeUnknownSync(SfTeamInstallationDescriptor, { onExcessProperty: "error" })(structuredClone(deps.binding)))
  let state: TeamProfileSelectionState = { status: "resolving" }
  let generation = 0, attempt = 0, disposed = false
  let inFlight: AbortController | undefined, staging: AbortController | undefined
  let current: Readonly<{ context: SfTeamContext; transport: SfTransport; generation: number }> | undefined
  let intent: TeamProfile.Selector = { contractRevision: "sf-team-profile/1", kind: "selection",
    installationId: binding.installationId, tenantId: binding.tenantId }
  const listeners = new Set<(value: TeamProfileSelectionState) => void>()
  const publish = (next: TeamProfileSelectionState) => { state = next; listeners.forEach((listener) => listener(next)) }
  const validProfile = (profile: TeamProfile.Ref) => Schema.is(TeamProfile.Ref)(profile) &&
    profile.installationId === binding.installationId && profile.tenantId === binding.tenantId
  const teamIntent = (profile: TeamProfile.Ref): TeamProfile.Selector => ({
    contractRevision: "sf-team-profile/1", kind: "team", profile: structuredClone(profile),
  })
  const selectionIntent = (): TeamProfile.Selector => ({ contractRevision: "sf-team-profile/1", kind: "selection",
    installationId: binding.installationId, tenantId: binding.tenantId })
  const decoded = (result: unknown): SfTeamContextResult | undefined => {
    const value = Schema.decodeUnknownOption(SfTeamContextResult, { onExcessProperty: "error" })(structuredClone(result))
    if (Option.isNone(value)) return
    const answer = value.value
    if (answer.status !== "ok") return answer
    const context = answer.value
    if (context.stamp.installationId !== binding.installationId || context.stamp.projectId !== binding.projectId ||
        context.stamp.hostId !== binding.hostId || context.profile.principal.tenantId !== binding.tenantId) return
    return freeze(answer)
  }
  const matchesIntent = (context: SfTeamContext, requested: TeamProfile.Selector) => requested.kind !== "team" ||
    context.profile.teams.status !== "ready" || sfSameTeamRef(context.profile.teams.selected, requested.profile)
  const fence = (reason: TeamProfileRetirement) => {
    attempt++
    staging?.abort(); staging = undefined
    generation++
    inFlight?.abort(); inFlight = undefined
    current = undefined
    deps.retire(reason)
    publish({ status: "resolving" })
  }
  const read = async (requested: TeamProfile.Selector, signal: AbortSignal, readGeneration: number,
    isCurrent: () => number) => {
    try {
      const answer = await deps.read(requested, signal, readGeneration, isCurrent)
      if (signal.aborted || disposed || isCurrent() !== readGeneration) return
      const result = decoded(answer.result)
      if (!result || result.status === "ok" && !matchesIntent(result.value, requested))
        return { result: { status: "unavailable", reason: "contract-mismatch" } as const, transport: answer.transport }
      return { result, transport: answer.transport }
    } catch (error) {
      if (!signal.aborted && !disposed) console.error("Teams context read failed", error instanceof Error ? error.name : "unknown")
      return undefined
    }
  }
  const load = async (requested: TeamProfile.Selector, reason: TeamProfileRetirement, allowRestore: boolean) => {
    if (disposed) return
    const prior = current?.context
    fence(reason)
    intent = requested
    const epoch = generation, abort = new AbortController()
    inFlight = abort
    const answer = await read(requested, abort.signal, epoch, () => generation)
    if (disposed || abort.signal.aborted || epoch !== generation) return
    if (!answer) { publish({ status: "unavailable", reason: "host-unavailable" }); return }
    const result = answer.result
    if (result.status !== "ok") {
      if (result.status === "unauthenticated" || result.status === "denied") {
        deps.retire("revoked")
        if (prior) deps.broadcast?.()
      }
      publish(result.status === "unavailable" ? { status: "unavailable", reason: result.reason } : { status: result.status })
      return
    }
    const context = result.value
    if (prior && !samePrincipal(prior.profile.principal, context.profile.principal)) {
      deps.retire("principal-change")
      deps.broadcast?.()
      // The new account never inherits the previous account's explicit Team.
      if (requested.kind !== "selection") { await load(selectionIntent(), "principal-change", false); return }
    }
    if (requested.kind === "selection" && context.profile.teams.status === "ready") {
      // A discovery-only transport cannot dispatch business calls. Open a
      // second real context read with the server-selected, complete Team ref.
      await load(teamIntent(context.profile.teams.selected), "profile-change", false)
      return
    }
    if (allowRestore && requested.kind === "selection" && context.profile.teams.status === "selection-required") {
      const hint = deps.restore?.(context.profile.principal)
      if (hint && validProfile(hint) && context.profile.teams.choices.some((choice) => sfSameTeamRef(choice.profile, hint))) {
        await load(teamIntent(hint), "profile-change", false)
        return
      }
    }
    if (prior?.stamp.team && (context.profile.teams.status === "revoked" || context.profile.teams.status === "denied")) {
      deps.retire("revoked")
      deps.broadcast?.()
    }
    let accepted = false
    try { accepted = await deps.accept(context, answer.transport, epoch, abort.signal) }
    catch (error) {
      if (!abort.signal.aborted && !disposed)
        console.error("Teams context activation failed", error instanceof Error ? error.name : "unknown")
    }
    if (disposed || abort.signal.aborted || epoch !== generation) return
    if (!accepted) { publish({ status: "unavailable", reason: "host-unavailable" }); return }
    current = Object.freeze({ context, transport: answer.transport, generation: epoch })
    if (context.profile.teams.status === "ready") {
      // Initial selection auto-selection is a server decision, never choices[0].
      intent = teamIntent(context.profile.teams.selected)
      if (deps.remember && !deps.remember(context.profile.principal, context.profile.teams.selected))
        console.error("Teams selection could not be stored for this window")
    }
    publish({ status: "authenticated", context })
  }
  const select = async (profile: TeamProfile.Ref): Promise<"selected" | "kept-editing" | "denied" | "aborted" | "unavailable"> => {
    if (disposed || !validProfile(profile) || !current || state.status !== "authenticated") return "denied"
    const source = current, originalGeneration = generation
    const teams = source.context.profile.teams
    if (teams.status !== "ready" && teams.status !== "selection-required" ||
        !teams.choices.some((choice) => sfSameTeamRef(choice.profile, profile))) return "denied"
    if (teams.status === "ready" && sfSameTeamRef(teams.selected, profile)) return "selected"
    const stage = ++attempt
    staging?.abort()
    const abort = new AbortController()
    staging = abort
    const stillSource = () => !disposed && !abort.signal.aborted && stage === attempt &&
      generation === originalGeneration && current === source
    const target = teamIntent(profile)
    try {
      const preflight = await read(target, abort.signal, stage, () => stillSource() ? attempt : -1)
      if (!stillSource()) return "aborted"
      if (!preflight || preflight.result.status !== "ok") return "unavailable"
      const targetContext = preflight.result.value
      if (!samePrincipal(source.context.profile.principal, targetContext.profile.principal)) {
        await load(selectionIntent(), "principal-change", false); deps.broadcast?.(); return "denied"
      }
      if (targetContext.profile.teams.status !== "ready" || !sfSameTeamRef(targetContext.profile.teams.selected, profile)) return "denied"
      if (deps.hasDirtyDrafts() && !await deps.confirmDiscard()) return stillSource() ? "kept-editing" : "aborted"
      if (!stillSource()) return "aborted"
      // Recheck the original source and target after the asynchronous consent.
      const sourceProof = await read(intent, abort.signal, stage, () => stillSource() ? attempt : -1)
      if (!stillSource()) return "aborted"
      if (!sourceProof || sourceProof.result.status !== "ok" ||
          !sfSameContextStamp(sourceProof.result.value.stamp, source.context.stamp)) {
        await load(intent, "revoked", false); deps.broadcast?.(); return "denied"
      }
      const targetProof = await read(target, abort.signal, stage, () => stillSource() ? attempt : -1)
      if (!stillSource()) return "aborted"
      if (!targetProof || targetProof.result.status !== "ok" ||
          !sfSameContextStamp(targetProof.result.value.stamp, targetContext.stamp)) return "denied"
      if (deps.hasDirtyDrafts() && !deps.discardDrafts()) return "kept-editing"
      await load(target, "profile-change", false)
      return state.status === "authenticated" && state.context.profile.teams.status === "ready" &&
        sfSameTeamRef(state.context.profile.teams.selected, profile) ? "selected" : "unavailable"
    } finally { if (staging === abort) staging = undefined; abort.abort() }
  }
  return Object.freeze({
    binding,
    state: () => state,
    generation: () => generation,
    current: () => current,
    subscribe(listener: (value: TeamProfileSelectionState) => void) {
      listeners.add(listener); listener(state); return () => { listeners.delete(listener) }
    },
    start(profile?: TeamProfile.Ref) {
      return !profile || validProfile(profile) ? load(profile ? teamIntent(profile) : selectionIntent(), "refresh", !profile) :
        Promise.resolve().then(() => { fence("revoked"); publish({ status: "unavailable", reason: "contract-mismatch" }) })
    },
    refresh: () => load(intent, "refresh", false),
    select,
    suspend(reason: "logout" | "revoked" | "principal-change", broadcast = true) {
      fence(reason)
      intent = selectionIntent()
      if (reason === "logout") publish({ status: "unauthenticated" })
      if (broadcast) deps.broadcast?.()
    },
    resume: () => load(selectionIntent(), "refresh", false),
    dispose() { if (disposed) return; disposed = true; fence("dispose"); listeners.clear() },
  })
}
export type TeamProfileSelection = ReturnType<typeof createTeamProfileSelection>
