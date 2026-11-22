import { createMemo, createSignal, createUniqueId, For, lazy, onCleanup, onMount, Show, Suspense } from "solid-js"
import { createStore } from "solid-js/store"
import { syncThemeBackground } from "@orchestra/ui/theme/context"
import "../orchestra/chapters/kit.css"
import "./team-profile.css"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { readCurrentTeamInstallation, readTeamWebContext } from "../context/team-profile-web"
import { readTeamNavigationIntent, readTeamSessionNavigation, teamNavigationReturnTo, teamNavigationURL,
  teamSessionNavigationURL } from "../context/team-profile-navigation"
import { createTeamSessionRuntime, type TeamSessionCurrent, type TeamSessionRuntime } from "../context/team-session-runtime"
import type { TeamSessionRetirement } from "../context/team-session-lifetime"
import { acquireTeamWindowIdentity, type TeamHintStorage, type TeamWindowIdentity } from "../utils/team-profile-storage"
import { useLanguage } from "../context/language"
import { TeamProfileAdministration, type TeamAdministrationNotice } from "../components/team-profile-administration"
import { SfTeamDomainHost, type SfTeamDomainLifecycle, type SfTeamDomainSession } from "../orchestra/chapters/sucafina/host/team-domain"
import { readSfTeamDomainIntent, resolveSfTeamDomainRoute } from "../orchestra/chapters/sucafina/host/team-domain-route"

const selectionHref = () => "/"
const SfTeamSessionWorkspace = lazy(() => import("./team-session").then((module) => ({ default: module.SfTeamSessionWorkspace })))
type TeamCopyKey = Parameters<ReturnType<typeof useLanguage>["t"]>[0]

type TeamWebState =
  | { status: "loading" | "unavailable" | "invalid" }
  | { status: "unauthenticated" | "denied"; binding: SfTeamInstallationDescriptor }
  | { status: "authenticated"; binding: SfTeamInstallationDescriptor; context: SfTeamContext }

export function SfTeamWebApp() {
  const language = useLanguage()
  onMount(() => {
    const elements = [document.documentElement, document.body]
    const previous = elements.map((element) => element.hasAttribute("data-new-layout"))
    elements.forEach((element) => element.toggleAttribute("data-new-layout", true))
    syncThemeBackground()
    onCleanup(() => {
      elements.forEach((element, index) => element.toggleAttribute("data-new-layout", previous[index]))
      syncThemeBackground()
    })
  })
  const [state, setState] = createSignal<TeamWebState>({ status: "loading" })
  const [logoutFailed, setLogoutFailed] = createSignal(false)
  const [signingOut, setSigningOut] = createSignal(false)
  const [domainHref, setDomainHref] = createSignal(window.location.href)
  const [administration, setAdministration] = createStore<{
    openFor?: string; notice?: { scope: string; key: TeamAdministrationNotice }
  }>({})
  const [chat, setChat] = createStore<{ ready: boolean; busy: boolean; consent: boolean; notice?: TeamCopyKey }>({
    ready: false, busy: false, consent: false,
  })
  const lifetime = new AbortController()
  const storage: TeamHintStorage = {
    getItem: (key) => window.sessionStorage.getItem(key),
    setItem: (key, value) => window.sessionStorage.setItem(key, value),
    removeItem: (key) => window.sessionStorage.removeItem(key),
    key: (index) => window.sessionStorage.key(index),
    get length() { return window.sessionStorage.length },
  }
  let runtime: TeamSessionRuntime | undefined
  let domain: SfTeamDomainLifecycle | undefined
  let identity: TeamWindowIdentity | undefined
  let acquiringIdentity: Promise<TeamWindowIdentity | undefined> | undefined
  let confirmedHref: string | undefined
  let previousPrincipal: string | undefined
  let consent: ((discard: boolean) => void) | undefined
  const closeConsent = (discard = false) => {
    const answer = consent
    consent = undefined
    setChat("consent", false)
    answer?.(discard)
  }
  const confirmDiscard = () => {
    closeConsent()
    setChat("consent", true)
    return new Promise<boolean>((resolve) => { consent = resolve })
  }
  let generation = 0
  let pending: AbortController | undefined
  let pendingNavigation: { href: string; teamObjectId?: string; push: boolean } | undefined
  const binding = () => {
    const current = state()
    return "binding" in current ? current.binding : undefined
  }
  const authenticated = () => {
    const current = state()
    return current.status === "authenticated" ? current : undefined
  }
  const currentSession = (): TeamSessionCurrent | undefined => {
    const current = authenticated()
    if (current && pending && !pending.signal.aborted)
      return { context: current.context, generation, signal: pending.signal }
  }
  const currentDomain = (): SfTeamDomainSession | undefined => {
    const current = authenticated()
    if (current && current.context.profile.teams.status === "ready" && pending && !pending.signal.aborted)
      return { binding: current.binding, context: current.context, generation, signal: pending.signal }
  }
  const domainRoute = () => {
    const current = binding()
    return current && readSfTeamDomainIntent(new URL(domainHref()), current)
  }
  const sessionRoute = () => {
    const current = authenticated()
    return current && readTeamSessionNavigation(new URL(window.location.href), current.binding)
  }
  const chatRuntime = () => chat.ready && sessionRoute() ? runtime : undefined
  const administrationScope = (current: Extract<TeamWebState, { status: "authenticated" }>) =>
    JSON.stringify([current.binding, current.context.profile.principal])
  const teams = () => {
    const current = state()
    return current.status === "authenticated" ? current.context.profile.teams : undefined
  }
  const selected = createMemo(() => {
    const choices = teams()
    if (choices?.status === "ready")
      return choices.choices.find((choice) => choice.profile.teamObjectId === choices.selected.teamObjectId)
  })
  const choices = () => {
    const value = teams()
    return value?.status === "ready" || value?.status === "selection-required" ? value.choices : []
  }
  const groupPath = () => {
    const active = selected()
    const current = binding()
    if (active && current) return `${current.mount}/teams/${active.profile.teamObjectId}`
  }
  const begin = (reason: TeamSessionRetirement = "refresh") => {
    closeConsent()
    runtime?.sessions.retire(reason)
    if (reason === "logout") domain?.retire("logout")
    else if (reason === "revoked") domain?.retire("revoked")
    else if (reason === "profile-change" || reason === "principal-change" || reason === "dispose")
      domain?.retire("owner-changed")
    setChat({ ready: false, busy: false, ...(reason !== "refresh" ? { notice: undefined } : {}) })
    generation++
    pending?.abort()
    pending = new AbortController()
    setState({ status: "loading" })
    return pending.signal
  }
  const writeNavigation = (url: URL, push = false) => {
    if (window.location.href === url.href) { setDomainHref(url.href); return true }
    try {
      window.history[push ? "pushState" : "replaceState"](null, "", url.href)
      setDomainHref(url.href)
      return true
    } catch (error) {
      console.error("Could not update the Team navigation URL", error)
      return false
    }
  }
  const load = async (teamObjectId?: string, push = false, reason: TeamSessionRetirement = "refresh"): Promise<void> => {
    if (signingOut()) return
    const href = window.location.href
    setDomainHref(href)
    pendingNavigation = { href, teamObjectId, push }
    const signal = begin(reason)
    const epoch = generation
    const current = await readCurrentTeamInstallation(signal)
    if (signal.aborted) return
    if (window.location.href !== href) { void load(); return }
    if (!current) {
      pendingNavigation = undefined
      setState({ status: "unavailable" }); return
    }
    const intent = readTeamNavigationIntent(new URL(href), current)
    if (!intent) {
      pendingNavigation = undefined
      setState({ status: "invalid" }); return
    }
    const result = await readTeamWebContext(current, signal,
      teamObjectId ?? (intent.kind === "team" ? intent.profile.teamObjectId : undefined))
    if (signal.aborted) return
    if (window.location.href !== href) { void load(); return }
    pendingNavigation = undefined
    if (!result) { setState({ status: "unavailable" }); return }
    if (result.status === "ok") {
      const teams = result.value.profile.teams
      if (teams.status === "ready") {
        const source = new URL(href)
        // A Team picker change starts that Team's new chat; a Session ID never crosses owners.
        if (teamObjectId && readTeamSessionNavigation(source, current)) source.pathname = "/orchestra/sf-sessions/new"
        const url = teamNavigationURL(source, current, teams.selected)
        if (!url || !writeNavigation(url, push)) { setState({ status: "unavailable" }); return }
      }
      const principal = JSON.stringify([current, result.value.profile.principal])
      if (previousPrincipal && previousPrincipal !== principal) {
        runtime?.sessions.retire("principal-change")
        domain?.retire("owner-changed")
        setChat("notice", undefined)
      }
      previousPrincipal = principal
      confirmedHref = window.location.href
      setState({ status: "authenticated", binding: current, context: result.value })
      if (teams.status !== "ready") {
        if (teams.status !== "unavailable") {
          runtime?.sessions.retire("revoked")
          domain?.retire("revoked")
        }
        return
      }
      const route = readTeamSessionNavigation(new URL(confirmedHref), current)
      if (route) await activateSession(current, result.value, route.sessionID, signal, epoch)
      return
    }
    runtime?.sessions.retire("revoked")
    domain?.retire(result.status === "unauthenticated" ? "session-expired" : "revoked")
    setChat("notice", undefined)
    setState({ status: result.status, binding: current })
  }
  const refresh = () => {
    // A pending click belongs only to its original history entry. A final failure never persists it.
    const intent = pendingNavigation?.href === window.location.href ? pendingNavigation : undefined
    return load(intent?.teamObjectId, intent?.push)
  }
  const notify = (key: TeamCopyKey) => setChat("notice", key)
  const commitSession = (id?: string, push = false) => {
    const current = authenticated(), profile = current?.context.stamp.team?.owner.profile
    if (!current || !profile) return false
    const url = teamSessionNavigationURL(current.binding, profile, id)
    if (!url || !writeNavigation(url, push)) return false
    confirmedHref = url.href
    return true
  }
  const activateSession = async (current: SfTeamInstallationDescriptor, context: SfTeamContext,
    sessionID: string | undefined, signal: AbortSignal, epoch: number): Promise<void> => {
    try {
      acquiringIdentity ??= acquireTeamWindowIdentity({ storage,
        locks: typeof navigator === "object" ? navigator.locks : undefined, signal: lifetime.signal })
      identity ??= await acquiringIdentity
      if (!identity || signal.aborted || epoch !== generation || authenticated()?.context !== context) return
      if (runtime && JSON.stringify(runtime.binding) !== JSON.stringify(current)) {
        runtime.sessions.retire("revoked")
        runtime = undefined
      }
      runtime ??= createTeamSessionRuntime({
        binding: current, window: identity, storage, fetch: (url, init) => fetch(url, init),
        current: currentSession, href: () => window.location.href, confirmedHref: () => confirmedHref,
        refresh: async () => { await refresh() }, confirmDiscard, notice: notify,
        unauthenticated: () => {
          closeConsent()
          domain?.retire("session-expired")
          generation++
          pending?.abort()
          setChat({ ready: false, busy: false, notice: undefined })
          setAdministration("openFor", undefined)
          setState({ status: "unauthenticated", binding: current })
        },
        opened: (id) => {
          if (commitSession(id)) return
          runtime?.sessions.retire("revoked")
          setState({ status: "unavailable" })
        },
      })
      runtime.sessions.activate(context, epoch, signal)
      setChat("ready", true)
      await runtime.sessions.open(sessionID)
    } catch (error) {
      if (signal.aborted || epoch !== generation) return
      console.error("Could not activate the Teams chat", error instanceof Error ? error.name : "unknown")
      runtime?.sessions.retire("revoked")
      setChat({ ready: false, notice: "sf.teams.chatUnavailable" })
      setState({ status: "unavailable" })
    }
  }
  const act = async (action: () => Promise<unknown>) => {
    if (chat.busy) return
    const epoch = generation, current = runtime
    setChat("busy", true)
    try { await action() }
    catch (error) {
      if (epoch !== generation || current !== runtime) return
      console.error("Teams chat action failed", error instanceof Error ? error.name : "unknown")
      notify("sf.teams.actionFailed")
    } finally { if (epoch === generation && current === runtime) setChat("busy", false) }
  }
  const leaveWorkspaces = async (leaveChat = true): Promise<boolean> => {
    const source = state(), epoch = generation, href = window.location.href
    const unchanged = () => state() === source && generation === epoch && window.location.href === href
    if (leaveChat && runtime && !await runtime.leave()) return false
    if (!unchanged() || domain && !await domain.leave()) return false
    return unchanged()
  }
  const goDomain = async (href: string, replace = false, signal?: AbortSignal): Promise<boolean> => {
    if (signal?.aborted) return false
    const current = authenticated(), profile = current?.context.stamp.team?.owner.profile
    if (!current || !profile) return false
    const url = new URL(href, current.binding.publicOrigin)
    const target = readSfTeamDomainIntent(url, current.binding)
    if (!target || target.selector.profile.teamObjectId !== profile.teamObjectId ||
        !resolveSfTeamDomainRoute(url, current.binding, current.context) || !await leaveWorkspaces()) return false
    if (signal?.aborted || !writeNavigation(url, !replace)) return false
    await load()
    const fresh = authenticated()
    return window.location.href === url.href && !!fresh &&
      !!resolveSfTeamDomainRoute(url, fresh.binding, fresh.context)
  }
  const goSession = async (href: string) => {
    const current = authenticated(), profile = current?.context.stamp.team?.owner.profile
    if (!current || !profile) return
    const target = readTeamSessionNavigation(new URL(href, current.binding.publicOrigin), current.binding)
    if (!target || target.profile.teamObjectId !== profile.teamObjectId) return
    if (!await leaveWorkspaces(false)) return
    if (runtime && chat.ready) {
      const epoch = generation
      if (await runtime.sessions.open(target.sessionID) && epoch === generation && !commitSession(target.sessionID, true)) {
        runtime.sessions.retire("revoked")
        setState({ status: "unavailable" })
      }
      return
    }
    const url = teamSessionNavigationURL(current.binding, profile, target.sessionID)
    if (url && writeNavigation(url, true)) await load()
  }
  const selectTeam = async (teamObjectId: string) => {
    if (!await leaveWorkspaces()) return
    await load(teamObjectId, true, "profile-change")
  }
  const navigation = () => {
    const current = authenticated(), href = window.location.href, previous = confirmedHref
    // Hide a private leaf as soon as history changes, before any discard dialog
    // or fresh admission. Its registry stays mounted and can restore on cancel.
    setDomainHref(href)
    const target = current && readTeamSessionNavigation(new URL(href), current.binding)
    const sameTeam = target && target.profile.teamObjectId === current?.context.stamp.team?.owner.profile.teamObjectId
    const chatDirty = runtime?.sessions.hasDirtyDrafts() === true && !sameTeam
    const domainDirty = domain?.hasDirtyDrafts() === true && href !== previous
    if (!chatDirty && !domainDirty) { void load(); return }
    void leaveWorkspaces(!sameTeam).then((discarded) => {
      if (window.location.href !== href) return
      if (discarded) { void load(undefined, false, "profile-change"); return }
      if (previous && writeNavigation(new URL(previous))) void load()
    })
  }
  const leavePage = (event: MouseEvent) => {
    if (!runtime?.sessions.hasDirtyDrafts() && !domain?.hasDirtyDrafts()) return
    const anchor = event.currentTarget
    if (!(anchor instanceof HTMLAnchorElement)) return
    event.preventDefault()
    const href = anchor.href
    void leaveWorkspaces().then((discarded) => { if (discarded) window.location.assign(href) })
  }
  const beforeUnload = (event: BeforeUnloadEvent) => {
    if (!runtime?.sessions.hasDirtyDrafts() && !domain?.hasDirtyDrafts()) return
    event.preventDefault()
    event.returnValue = ""
  }
  const signInHref = () => {
    const current = binding()
    const returnTo = current && teamNavigationReturnTo(new URL(window.location.href), current)
    return current && returnTo ? current.mount + "/auth/login?" + new URLSearchParams({ returnTo }) : undefined
  }
  const logout = async () => {
    const current = binding()
    if (!current || signingOut()) return
    setLogoutFailed(false)
    setSigningOut(true)
    setAdministration("openFor", undefined)
    pendingNavigation = undefined
    const signal = begin("logout")
    const response = await fetch(current.mount + "/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    }).catch(() => undefined)
    if (signal.aborted) return
    setSigningOut(false)
    if (response?.status === 204) {
      setAdministration("notice", undefined)
      previousPrincipal = undefined
      confirmedHref = undefined
      const url = new URL(window.location.href)
      if (url.pathname.startsWith("/orchestra/sf-sessions/") || readSfTeamDomainIntent(url, current))
        url.pathname = selectionHref()
      url.search = ""
      url.hash = ""
      if (writeNavigation(url)) return setState({ status: "unauthenticated", binding: current })
    }
    setLogoutFailed(true)
    setState({ status: "unavailable" })
  }
  const statusCopy = () => {
    const status = state().status
    if (status === "loading") return "sf.ui67.loading"
    if (status === "invalid") return "sf.common.invalidLink"
    if (status === "unauthenticated") return "sf.ui67.unauthenticated"
    if (status === "denied") return "sf.teams.noTeams"
    if (status === "authenticated") {
      const value = teams()
      if (value?.status === "selection-required") return "sf.teams.select"
      if (value?.status === "no-teams") return "sf.teams.noTeams"
      if (value?.status === "revoked") return "sf.teams.teamRevoked"
      if (value?.status === "denied") return "sf.teams.teamDenied"
    }
    return "sf.ui67.unavailable"
  }
  const restore = (event: PageTransitionEvent) => { if (event.persisted) refresh() }
  onMount(() => {
    void refresh()
    window.addEventListener("beforeunload", beforeUnload)
    window.addEventListener("focus", refresh)
    window.addEventListener("pageshow", restore)
    window.addEventListener("popstate", navigation)
    window.addEventListener("hashchange", navigation)
  })
  onCleanup(() => {
    closeConsent()
    runtime?.sessions.retire("dispose")
    domain?.retire("owner-changed")
    lifetime.abort()
    identity?.dispose()
    generation++
    pending?.abort()
    window.removeEventListener("beforeunload", beforeUnload)
    window.removeEventListener("focus", refresh)
    window.removeEventListener("pageshow", restore)
    window.removeEventListener("popstate", navigation)
    window.removeEventListener("hashchange", navigation)
  })

  return (
    <div class="sf-team-shell" data-sf-team-layout={sessionRoute() ? "chat" : domainRoute() ? "domain" : "access"}
      data-sf-teams-shell data-sf-teams-state={state().status}
      data-sf-team-selected={selected()?.profile.teamObjectId}>
      <header class="sf-team-brand">
        <img src="/brand/sucafina/lockup-primary.svg" alt="Sucafina" width="145" />
        <div class="sf-team-brand-actions">
          <Show when={state().status !== "loading" && state().status !== "unauthenticated"}>
            <button type="button" class="mx-btn" onClick={refresh}>{language.t("sf.ui67.refreshAccess")}</button>
          </Show>
          <Show when={state().status === "authenticated" || state().status === "denied"}>
            <button type="button" class="mx-btn" onClick={() => void logout()}>{language.t("sf.ui67.signOut")}</button>
          </Show>
        </div>
      </header>
      <main class="sf-team-surface" classList={{ "sf-team-main-chat": !!sessionRoute() }}>
        <header class="sf-team-heading">
          <div class="mx-eyebrow">{language.t("sf.teams.title")}</div>
          <h1>{selected()?.displayName || language.t("sf.teams.select")}</h1>
        </header>
        <Show when={!selected()}>
          <p role={state().status === "invalid" ? "alert" : "status"}>{language.t(statusCopy())}</p>
        </Show>
        <Show when={logoutFailed()}><p role="alert">{language.t("sf.ui67.signOutFailed")}</p></Show>
        <Show when={state().status === "invalid" || state().status === "denied" ||
          teams()?.status === "revoked" || teams()?.status === "denied"}>
          <a class="mx-btn" href={selectionHref()}>{language.t("sf.teams.select")}</a>
        </Show>
        <Show when={state().status === "unauthenticated" && signInHref()} keyed>{(href) =>
          <a class="mx-btn primary" href={href}>{language.t("sf.teams.signIn")}</a>
        }</Show>
        <div class="sf-team-toolbar">
        <Show when={choices().length}>
          <label class="sf-team-picker">
            {language.t("sf.teams.team")}
            <select class="sf-team-input" data-sf-team-picker value={selected()?.profile.teamObjectId ?? ""} onChange={(event) => {
              const choice = choices().find((item) => item.profile.teamObjectId === event.currentTarget.value)
              event.currentTarget.value = selected()?.profile.teamObjectId ?? ""
              if (choice) void selectTeam(choice.profile.teamObjectId)
            }}>
              <Show when={!selected()}><option value="" disabled selected>{language.t("sf.teams.select")}</option></Show>
              <For each={choices()}>{(choice) =>
                <option value={choice.profile.teamObjectId} selected={selected()?.profile.teamObjectId === choice.profile.teamObjectId}>
                  {choices().filter((item) => item.displayName === choice.displayName).length > 1
                    ? choice.displayName + " · " + choice.profile.teamObjectId : choice.displayName}
                </option>
              }</For>
            </select>
          </label>
        </Show>
        <Show when={groupPath()} keyed>{(path) =>
          <a class="mx-btn primary" href={path + "/dashboard"} onClick={leavePage}>{language.t("sf.teams.dashboard")}</a>
        }</Show>
        <Show when={selected() && !sessionRoute()}>
          <div><button type="button" class="mx-btn" data-sf-new-chat onClick={() => {
            const current = authenticated(), profile = current?.context.stamp.team?.owner.profile
            const url = current && profile && teamSessionNavigationURL(current.binding, profile)
            if (url) void goSession(url.href)
          }}>{language.t("sf.teams.newChat")}</button></div>
        </Show>
        </div>
        <Show when={authenticated()} keyed>{(current) => {
          const scope = administrationScope(current)
          const notice = () => administration.notice?.scope === scope ? administration.notice.key : undefined
          const notify = (key?: TeamAdministrationNotice) => {
            if (key) setAdministration("notice", { scope, key })
            else if (administration.notice?.scope === scope) setAdministration("notice", undefined)
          }
          return <div class="sf-team-administration-wrap">
            <Show when={notice()} keyed>{(key) =>
              <p data-sf-admin-notice role={key === "sf.teams.adminSaved" ? "status" : "alert"}>{language.t(key)}</p>
            }</Show>
            <Show when={current.context.profile.administration.status === "available"}>
              <button type="button" class="mx-btn" data-sf-admin-toggle
                aria-expanded={administration.openFor === scope}
                onClick={() => setAdministration("openFor", administration.openFor === scope ? undefined : scope)}>
                {language.t("sf.teams.administration")}</button>
              <Show when={administration.openFor === scope}>
                <TeamProfileAdministration binding={current.binding} context={current.context} generation={generation}
                  currentGeneration={() => generation} currentContext={() => authenticated()?.context}
                  refresh={refresh} notice={notice()} notify={notify} />
              </Show>
            </Show>
          </div>
        }}</Show>
        <Show when={chat.notice} keyed>{(key) => <p class="sf-team-notice" data-sf-chat-notice role="alert">{language.t(key)}</p>}</Show>
        <Show when={chat.consent}><SfTeamDiscardDialog close={closeConsent} /></Show>
        <Show when={chatRuntime()} keyed>{(value) =>
          <Suspense fallback={<p role="status">{language.t("sf.ui67.loading")}</p>}>
            <SfTeamSessionWorkspace runtime={value} busy={chat.busy || chat.consent} act={act}
              go={(href) => { void act(() => goSession(href)) }} notice={notify} />
          </Suspense>
        }</Show>
        <SfTeamDomainHost current={currentDomain} href={domainHref}
          fetch={(input, init) => fetch(input, init)} reload={refresh}
          navigate={goDomain} confirmDiscard={confirmDiscard}
          onLifecycle={(value) => { domain = value }} />
      </main>
    </div>
  )
}

function SfTeamDiscardDialog(props: Readonly<{ close(yes?: boolean): void }>) {
  const language = useLanguage(), id = createUniqueId()
  let dialog!: HTMLDialogElement
  onMount(() => dialog.showModal())
  onCleanup(() => { if (dialog.open) dialog.close() })
  return <dialog ref={dialog} class="mx-dialog sf-team-dialog" data-sf-draft-guard aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); props.close(false) }}>
    <header class="mx-dialog-head"><h2 id={id}>{language.t("sf.teams.discard")}</h2></header>
    <footer class="mx-dialog-foot">
      <button class="mx-btn" type="button" data-sf-keep-editing autofocus onClick={() => props.close(false)}>{language.t("common.cancel")}</button>
      <button class="mx-btn danger" type="button" data-sf-confirm-discard onClick={() => props.close(true)}>{language.t("sf.teams.discardConfirm")}</button>
    </footer>
  </dialog>
}
