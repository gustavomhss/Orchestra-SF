import { createStore } from "solid-js/store"
import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { SfTeamContextResult, type SfResolvedRoute, type SfTeamContext,
  type SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { createSfTeamAuthActions, type SfTransportFetch } from "@orchestra/client/sucafina/transport"
import { createTeamProfileSelection, type TeamProfileSelection } from "./team-profile-selection"
import { teamWebContextReader } from "./team-profile-web"
import { createTeamSessionsWorkspace, type TeamChatNotice } from "./team-sessions"
import { clearTeamSelection, readTeamSelection, writeTeamSelection, type TeamWindowIdentity } from "../utils/team-profile-storage"
import { createTeamNativeOwner } from "../orchestra/chapters/sucafina/context/team-owner"
import { createSfNavigationState, type SfNativeTransitionCause } from "../orchestra/chapters/sucafina/navigation-state"
import { sfSameOwnerSelection, sfSameContextStamp, sfSameTeamRef } from "../orchestra/chapters/sucafina/navigation-state/owner"
import { readSfTeamWebRoute, resolveSfTeamNativeRoute, sfTeamContextHref, sfTeamSessionHref } from "../orchestra/chapters/sucafina/host/team-route"

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem">
type View = "context" | "administration" | "business" | "session" | "resolving" | "denied" | "invalid" | "unavailable"
type Result = "committed" | "aborted" | "denied" | "invalid-link" | "unavailable" | "kept-editing"
export function createTeamWebRuntime(input: Readonly<{
  binding: SfTeamInstallationDescriptor; window: TeamWindowIdentity; storage: Storage; fetch: SfTransportFetch
  currentHref(): string
  commitHref(href: string, replace: boolean): void
  confirmDiscard(): Promise<boolean>
  closeConsent(): void
  notice(key: TeamChatNotice | "sf.teams.invalidLink" | "sf.teams.revokedDrafts"): void
  broadcast(reason: "logout" | "revoked" | "principal-change"): void
}>) {
  const [view, setView] = createStore<{ kind: View; route?: SfResolvedRoute; epoch: number }>({
    kind: "resolving", epoch: 0,
  })
  let controller: TeamProfileSelection, disposed = false, signedOut = false, attempt = 0
  let routeAbort: AbortController | undefined
  let commitOverride: ((href: string) => void) | undefined
  const owner = createTeamNativeOwner({
    binding: input.binding, windowId: input.window.id,
    reload: () => refresh(),
    invalidate: (reason) => { if (!signedOut) { controller.suspend(reason); setView({ kind: "denied", route: undefined }) } },
    onDraftAccessRevoked: () => input.notice("sf.teams.revokedDrafts"),
  })
  const sessions = createTeamSessionsWorkspace({
    binding: input.binding, window: input.window, storage: input.storage, fetch: input.fetch,
    current: (context, generation) => !disposed && controller.current()?.context === context &&
      controller.generation() === generation,
    unauthenticated: () => { controller.suspend("revoked"); setView({ kind: "denied", route: undefined }) },
    notice: input.notice,
    opened: (id) => {
      const current = controller.current()
      if (!current?.context.stamp.team || disposed || view.kind !== "session") return
      input.commitHref(sfTeamSessionHref(input.binding, current.context.stamp.team.owner.profile, id), true)
    },
  })
  const hasDirtyDrafts = () => owner.handle.hasDirtyDrafts() || sessions.hasDirtyDrafts()
  const discardDrafts = () => {
    if (sessions.state.pending.length) { input.notice("sf.teams.pending"); return false }
    if (owner.handle.hasDirtyDrafts() && !owner.handle.discardDrafts()) return false
    return sessions.discardDrafts()
  }
  const rawFetch: SfTransportFetch = async (url, init) => {
    const dispatched = controller.current(), headers = new Headers(init?.headers)
    const response = await input.fetch(url, init)
    // A failure observed on a Team-bound resource immediately scrubs the UI.
    // F02/admin reads carry no business header and retain their own typed outcome.
    if (!disposed && dispatched && controller.current() === dispatched && headers.has("x-sf-team-profile")) {
      const current = dispatched
      const revision = response.headers.get("x-sf-access-revision")
      if (current && (response.status === 401 || response.status === 403 ||
          revision !== null && revision !== current.context.stamp.accessRevision)) {
        controller.suspend("revoked")
        setView({ kind: "denied", route: undefined })
      }
    }
    return response
  }
  const read = teamWebContextReader(input.binding, rawFetch)
  const principalScope = (principal: TeamProfile.Principal) => ({
    installationId: input.binding.installationId, principal, windowId: input.window.id,
  })
  controller = createTeamProfileSelection({
    binding: input.binding, read,
    hasDirtyDrafts,
    confirmDiscard: input.confirmDiscard,
    discardDrafts,
    retire: (reason) => {
      routeAbort?.abort(); routeAbort = undefined
      input.closeConsent()
      owner.retire(reason)
      sessions.retire(reason)
      setView({ kind: "resolving", route: undefined })
    },
    accept: async (context, transport, generation, signal) => {
      const accepted = await owner.accept(context, transport, generation, signal)
      if (accepted && !signal.aborted) sessions.activate(context, generation, signal)
      return accepted
    },
    broadcast: input.broadcast,
    restore: (principal) => input.window.persistent ? readTeamSelection(input.storage, principalScope(principal)) : undefined,
    remember: (principal, selected) => !input.window.persistent || writeTeamSelection(input.storage, principalScope(principal), selected),
  })
  const unsubscribe = controller.subscribe(() => setView("epoch", (value) => value + 1))
  const state = () => { void view.epoch; return controller.state() }
  const current = () => { void view.epoch; return controller.current() }
  const queryFor = (context: SfTeamContext): TeamProfile.Selector => context.profile.teams.status === "ready"
    ? { contractRevision: "sf-team-profile/1", kind: "team", profile: context.profile.teams.selected }
    : { contractRevision: "sf-team-profile/1", kind: "selection", installationId: input.binding.installationId, tenantId: input.binding.tenantId }
  const proof = async (selector: TeamProfile.Selector, signal: AbortSignal, generation: number) => {
    const response = await read(selector, signal, generation, controller.generation)
    if (signal.aborted || controller.generation() !== generation || disposed) return
    const decoded = Schema.decodeUnknownOption(SfTeamContextResult, { onExcessProperty: "error" })(response.result)
    return Option.isSome(decoded) ? decoded.value : undefined
  }
  const changed = () => {
    controller.suspend("revoked")
    setView({ kind: "denied", route: undefined })
  }
  const navigation = createSfNavigationState({
    selected: () => {
      const s = owner.handle.state()
      if (s.status !== "ready") throw new Error("TEAM_NATIVE_OWNER_UNAVAILABLE")
      return s.selection
    },
    currentHref: input.currentHref,
    currentOwnerKey: () => owner.current()?.key,
    hasDirtyDrafts,
    confirmDiscard: input.confirmDiscard,
    discardDrafts,
    invalidateOwner: () => changed(),
    validateRetained: (route, value) => route.surfaceId === "UI29" && Number.isSafeInteger(value.scrollY) &&
      (value.scrollY ?? -1) >= 0 ? { scrollY: value.scrollY } : undefined,
    resolveAuthorizedRoute: async (href, selected, signal) => {
      const original = owner.current(), s = owner.handle.state()
      if (!original || s.status !== "ready" || !sfSameOwnerSelection(s.selection, selected)) return { status: "denied" }
      const intent = readSfTeamWebRoute(href, input.binding)
      if (intent.kind !== "business" || !sfSameTeamRef(intent.profile, selected.team)) return { status: "invalid-link" }
      const fresh = await proof({ contractRevision: "sf-team-profile/1", kind: "team", profile: intent.profile }, signal, original.generation)
      if (signal.aborted || disposed || owner.current() !== original) return { status: "unavailable" }
      if (!fresh || fresh.status !== "ok") {
        if (fresh?.status === "denied" || fresh?.status === "unauthenticated") changed()
        return { status: fresh?.status === "unavailable" || !fresh ? "unavailable" : "denied" }
      }
      if (!sfSameContextStamp(fresh.value.stamp, original.context.stamp)) { changed(); return { status: "denied" } }
      const route = resolveSfTeamNativeRoute(href, input.binding, selected, fresh.value)
      return route ? { status: "authorized", route, ownerKey: original.key } : { status: "denied" }
    },
    revalidateAfterConsent: async (_route, key, signal) => {
      const original = owner.current()
      if (!original || original.key !== key) return false
      const fresh = await proof(queryFor(original.context), signal, original.generation)
      if (signal.aborted || owner.current() !== original) return false
      if (!fresh || fresh.status !== "ok" || !sfSameContextStamp(fresh.value.stamp, original.context.stamp)) {
        changed(); return false
      }
      return true
    },
    commit: ({ route, cause }) => {
      if (!owner.current() || disposed) return
      setView({ kind: "business", route })
      const commit = commitOverride
      commitOverride = undefined
      if (commit) commit(String(route.href))
      else input.commitHref(String(route.href), cause === "deep-link" || cause === "history" || cause === "reload")
    },
  })
  owner.installNavigation(navigation)

  const landing = async (kind: "context" | "administration", signal: AbortSignal, generation: number): Promise<boolean> => {
    const original = controller.current()
    if (!original) return false
    const selector: TeamProfile.Selector = { contractRevision: "sf-team-profile/1", kind: kind === "administration" ? "administration" : "selection",
      installationId: input.binding.installationId, tenantId: input.binding.tenantId }
    const first = await proof(selector, signal, generation)
    const samePrincipal = (context: SfTeamContext) => context.profile.principal.tenantId === original.context.profile.principal.tenantId &&
      context.profile.principal.principalObjectId === original.context.profile.principal.principalObjectId
    if (!first || first.status !== "ok" || !samePrincipal(first.value) ||
        kind === "administration" && first.value.profile.administration.status !== "available") return false
    const hasDrafts = hasDirtyDrafts()
    if (hasDrafts && !await input.confirmDiscard()) return false
    if (signal.aborted || controller.current() !== original) return false
    // Landing pages are independently admitted, and observing changed source
    // authority also retires any private native lifetime that was left open.
    const source = await proof(queryFor(original.context), signal, generation)
    if (!source || source.status !== "ok" || !sfSameContextStamp(source.value.stamp, original.context.stamp)) { changed(); return false }
    if (hasDrafts) {
      const target = await proof(selector, signal, generation)
      if (!target || target.status !== "ok" || !sfSameContextStamp(first.value.stamp, target.value.stamp)) return false
      if (signal.aborted || controller.current() !== original) return false
      if (!discardDrafts()) { input.notice("sf.teams.pending"); return false }
    }
    return !signal.aborted && controller.current() === original && controller.generation() === generation
  }
  const navigate = async (href: string, cause: SfNativeTransitionCause = "link", commit?: (href: string) => void): Promise<Result> => {
    if (disposed) return "aborted"
    const intent = readSfTeamWebRoute(href, input.binding)
    if (intent.kind === "invalid") { input.notice("sf.teams.invalidLink"); return "invalid-link" }
    const requested = "profile" in intent ? intent.profile : undefined
    const prior = controller.current()
    if (requested && (!prior || prior.context.profile.teams.status !== "ready" ||
        !sfSameTeamRef(prior.context.profile.teams.selected, requested))) {
      const selected = await controller.select(requested)
      if (selected !== "selected") return selected
    }
    if (disposed) return "aborted"
    const epoch = ++attempt
    routeAbort?.abort()
    const abort = new AbortController(); routeAbort = abort
    const generation = controller.generation()
    try {
      if (intent.kind === "context" || intent.kind === "administration") {
        if (!await landing(intent.kind, abort.signal, generation)) {
          if (!abort.signal.aborted) input.notice(hasDirtyDrafts() ? "sf.teams.pending" : "sf.teams.actionFailed")
          // A revocation deliberately cancels I/O; report its observed denial,
          // while a superseded navigation or logout remains an aborted action.
          return view.kind === "denied" ? "denied" : abort.signal.aborted ? "aborted" : "denied"
        }
        if (epoch !== attempt || abort.signal.aborted) return "aborted"
        setView({ kind: intent.kind, route: undefined })
        if (commit) commit(href)
        else input.commitHref(href, cause === "deep-link" || cause === "history" || cause === "reload")
        return "committed"
      }
      const s = owner.handle.state()
      if (s.status !== "ready" || !sfSameTeamRef(s.selection.team, intent.profile)) return "denied"
      if (intent.kind === "session") {
        const original = controller.current()
        if (!original) return "denied"
        const fresh = await proof(queryFor(original.context), abort.signal, generation)
        if (abort.signal.aborted || epoch !== attempt || controller.current() !== original) return "aborted"
        if (!fresh || fresh.status !== "ok") {
          if (fresh?.status === "denied" || fresh?.status === "unauthenticated") changed()
          return fresh?.status === "unavailable" || !fresh ? "unavailable" : "denied"
        }
        if (!sfSameContextStamp(fresh.value.stamp, original.context.stamp)) { changed(); return "denied" }
        // Session tabs preserve their in-memory drafts. A business editor still
        // uses its original consent and a fresh source proof before being left.
        if (owner.handle.hasDirtyDrafts()) {
          if (!await input.confirmDiscard()) return "kept-editing"
          if (abort.signal.aborted || epoch !== attempt || controller.current() !== original) return "aborted"
          const after = await proof(queryFor(original.context), abort.signal, generation)
          if (!after || after.status !== "ok" || !sfSameContextStamp(after.value.stamp, original.context.stamp)) {
            changed(); return "denied"
          }
          if (abort.signal.aborted || controller.current() !== original) return "aborted"
          if (!owner.handle.discardDrafts()) { input.notice("sf.teams.pending"); return "kept-editing" }
        }
        setView({ kind: "session", route: undefined })
        if (commit) commit(intent.href)
        else input.commitHref(intent.href, cause === "deep-link" || cause === "history" || cause === "reload")
        // A syntactically valid URL opens a draft/read only. Creation requires
        // the later, explicit prompt submission and its own backend admission.
        const opened = await sessions.open(intent.sessionID)
        if (abort.signal.aborted || epoch !== attempt || controller.current() !== original) return "aborted"
        return opened ? "committed" : "unavailable"
      }
      commitOverride = commit
      const answer = await navigation.requestNativeTransition(href, cause, { signal: abort.signal })
      if (answer.status !== "committed" && answer.status !== "aborted" && answer.status !== "kept-editing")
        input.notice(answer.status === "invalid-link" ? "sf.teams.invalidLink" : "sf.teams.actionFailed")
      return answer.status
    } finally {
      if (epoch === attempt) commitOverride = undefined
      if (routeAbort === abort) routeAbort = undefined
    }
  }
  const admitCurrent = async () => {
    const href = input.currentHref(), intent = readSfTeamWebRoute(href, input.binding)
    if (intent.kind === "invalid") { setView({ kind: "invalid", route: undefined }); return }
    const c = controller.current()
    if (!c) { setView({ kind: "context", route: undefined }); return }
    if (intent.kind === "context") { setView({ kind: "context", route: undefined }); return }
    if (intent.kind === "administration") {
      setView({ kind: "administration", route: undefined }); return
    }
    if (!owner.current() || !sfSameTeamRef(c.context.stamp.team?.owner.profile, intent.profile)) {
      setView({ kind: "denied", route: undefined }); return
    }
    const answer = await navigate(href, "deep-link")
    if (answer !== "committed" && answer !== "aborted" && view.kind !== "session") setView({ kind: answer === "unavailable" ? "unavailable" : "denied", route: undefined })
  }
  const refresh = async () => {
    if (disposed || signedOut) return
    await controller.refresh()
    if (!disposed) await admitCurrent()
  }
  return Object.freeze({
    binding: controller.binding, window: input.window, view, state, current,
    owner: owner.handle, sessions, hasDirtyDrafts, navigation, generation: controller.generation, fetch: rawFetch,
    async start() {
      if (disposed || signedOut) return
      const intent = readSfTeamWebRoute(input.currentHref(), input.binding)
      if (intent.kind === "invalid") { setView({ kind: "invalid", route: undefined }); return }
      await controller.start("profile" in intent ? intent.profile : undefined)
      if (!disposed) await admitCurrent()
    },
    refresh, navigate,
    async closeSession(id: string) {
      const original = controller.current()
      if (!original?.context.stamp.team || disposed) return false
      if (sessions.state.pending.some((item) => item.sessionID === id)) { input.notice("sf.teams.pending"); return false }
      const abort = new AbortController(), generation = controller.generation()
      const dirty = sessions.dirty(id)
      if (dirty && !await input.confirmDiscard()) return false
      if (disposed || controller.current() !== original) return false
      const fresh = await proof(queryFor(original.context), abort.signal, generation)
      if (!fresh || fresh.status !== "ok" || !sfSameContextStamp(fresh.value.stamp, original.context.stamp)) {
        changed(); return false
      }
      if (disposed || controller.current() !== original) return false
      const wasActive = sessions.state.active === id
      const closed = await sessions.closeTab(id, dirty)
      if (closed && wasActive && view.kind === "session")
        input.commitHref(sfTeamSessionHref(input.binding, original.context.stamp.team.owner.profile), true)
      return closed
    },
    async choose(profile: TeamProfile.Ref) {
      const answer = await controller.select(profile)
      if (answer === "selected" && !disposed) {
        setView({ kind: "context", route: undefined })
        const href = sfTeamContextHref(input.binding) + "&teamObjectId=" + encodeURIComponent(profile.teamObjectId)
        input.commitHref(href, false)
      }
      return answer
    },
    async resetSelection() {
      if (disposed || signedOut) return false
      const abort = new AbortController(), generation = controller.generation()
      const original = controller.current()
      if (original && !await landing("context", abort.signal, generation)) return false
      if (disposed || original && controller.current() !== original) return false
      await controller.start()
      if (disposed) return false
      setView({ kind: "context", route: undefined }); input.commitHref(sfTeamContextHref(input.binding), false)
      return true
    },
    async logout() {
      signedOut = true
      const c = controller.current()
      const pending = createSfTeamAuthActions({ binding: input.binding, fetch: input.fetch,
        navigate: () => undefined }).logout()
      if (c && input.window.persistent) clearTeamSelection(input.storage, principalScope(c.context.profile.principal))
      controller.suspend("logout")
      setView({ kind: "context", route: undefined })
      input.commitHref(sfTeamContextHref(input.binding), true)
      try { await pending }
      catch (error) {
        input.notice("sf.teams.actionFailed")
        console.error("Microsoft sign-out was not confirmed", error instanceof Error ? error.name : "unknown")
      }
    },
    invalidate(reason: "logout" | "revoked" | "principal-change" = "revoked") {
      if (signedOut && reason !== "logout") return
      if (reason === "logout") signedOut = true
      const c = controller.current()
      if (reason === "logout" && c && input.window.persistent)
        clearTeamSelection(input.storage, principalScope(c.context.profile.principal))
      controller.suspend(reason, false)
      setView({ kind: reason === "logout" ? "context" : "denied", route: undefined })
    },
    dispose() {
      if (disposed) return
      disposed = true; attempt++; routeAbort?.abort()
      unsubscribe(); controller.dispose(); navigation.dispose(); input.closeConsent()
    },
  })
}
export type TeamWebRuntime = ReturnType<typeof createTeamWebRuntime>
