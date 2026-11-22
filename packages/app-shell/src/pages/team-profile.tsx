import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { readCurrentTeamInstallation, readTeamWebContext } from "../context/team-profile-web"
import { readTeamNavigationIntent, teamNavigationReturnTo, teamNavigationURL } from "../context/team-profile-navigation"
import { useLanguage } from "../context/language"
import { TeamProfileAdministration, type TeamAdministrationNotice } from "../components/team-profile-administration"

type TeamWebState =
  | { status: "loading" | "unavailable" | "invalid" }
  | { status: "unauthenticated" | "denied"; binding: SfTeamInstallationDescriptor }
  | { status: "authenticated"; binding: SfTeamInstallationDescriptor; context: SfTeamContext }

export function SfTeamWebApp() {
  const language = useLanguage()
  const [state, setState] = createSignal<TeamWebState>({ status: "loading" })
  const [logoutFailed, setLogoutFailed] = createSignal(false)
  const [signingOut, setSigningOut] = createSignal(false)
  const [administration, setAdministration] = createStore<{
    openFor?: string; notice?: { scope: string; key: TeamAdministrationNotice }
  }>({})
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
  const begin = () => {
    generation++
    pending?.abort()
    pending = new AbortController()
    setState({ status: "loading" })
    return pending.signal
  }
  const writeNavigation = (url: URL, push = false) => {
    if (window.location.href === url.href) return true
    try {
      window.history[push ? "pushState" : "replaceState"](null, "", url.href)
      return true
    } catch (error) {
      console.error("Could not update the Team navigation URL", error)
      return false
    }
  }
  const load = async (teamObjectId?: string, push = false) => {
    if (signingOut()) return
    const href = window.location.href
    pendingNavigation = { href, teamObjectId, push }
    const signal = begin()
    const current = await readCurrentTeamInstallation(signal)
    if (signal.aborted) return
    if (window.location.href !== href) { void load(); return }
    if (!current) {
      pendingNavigation = undefined
      return setState({ status: "unavailable" })
    }
    const intent = readTeamNavigationIntent(new URL(href), current)
    if (!intent) {
      pendingNavigation = undefined
      return setState({ status: "invalid" })
    }
    const result = await readTeamWebContext(current, signal,
      teamObjectId ?? (intent.kind === "team" ? intent.profile.teamObjectId : undefined))
    if (signal.aborted) return
    if (window.location.href !== href) { void load(); return }
    pendingNavigation = undefined
    if (!result) return setState({ status: "unavailable" })
    if (result.status === "ok") {
      const teams = result.value.profile.teams
      if (teams.status === "ready") {
        const url = teamNavigationURL(new URL(href), current, teams.selected)
        if (!url || !writeNavigation(url, push)) return setState({ status: "unavailable" })
      }
      return setState({ status: "authenticated", binding: current, context: result.value })
    }
    setState({ status: result.status, binding: current })
  }
  const refresh = () => {
    // A pending click belongs only to its original history entry. A final failure never persists it.
    const intent = pendingNavigation?.href === window.location.href ? pendingNavigation : undefined
    void load(intent?.teamObjectId, intent?.push)
  }
  const navigation = () => { void load() }
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
    const signal = begin()
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
      const url = new URL(window.location.href)
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
    refresh()
    window.addEventListener("focus", refresh)
    window.addEventListener("pageshow", restore)
    window.addEventListener("popstate", navigation)
    window.addEventListener("hashchange", navigation)
  })
  onCleanup(() => {
    generation++
    pending?.abort()
    window.removeEventListener("focus", refresh)
    window.removeEventListener("pageshow", restore)
    window.removeEventListener("popstate", navigation)
    window.removeEventListener("hashchange", navigation)
  })

  return (
    <div class="mx-auto flex h-full w-full max-w-3xl flex-col gap-8 overflow-y-auto p-6"
      data-sf-teams-shell data-sf-teams-state={state().status}
      data-sf-team-selected={selected()?.profile.teamObjectId}>
      <header class="flex items-center justify-between gap-4">
        <img src="/brand/sucafina/lockup-primary.svg" alt="Sucafina" width="145" />
        <Show when={state().status === "authenticated" || state().status === "denied"}>
          <button type="button" class="mx-btn" onClick={() => void logout()}>{language.t("sf.ui67.signOut")}</button>
        </Show>
      </header>
      <main class="mx-card flex flex-col items-start gap-4">
        <h1 class="text-xl font-semibold">{language.t("sf.teams.title")}</h1>
        <Show when={!selected()}>
          <p role={state().status === "invalid" ? "alert" : "status"}>{language.t(statusCopy())}</p>
        </Show>
        <Show when={logoutFailed()}><p role="alert">{language.t("sf.ui67.signOutFailed")}</p></Show>
        <Show when={state().status === "invalid" || state().status === "denied" ||
          teams()?.status === "revoked" || teams()?.status === "denied"}>
          <a class="mx-btn" href="/">{language.t("sf.teams.select")}</a>
        </Show>
        <Show when={state().status === "unauthenticated" && signInHref()} keyed>{(href) =>
          <a class="mx-btn" href={href}>{language.t("sf.teams.signIn")}</a>
        }</Show>
        <Show when={choices().length}>
          <label class="flex flex-col gap-1">
            {language.t("sf.teams.team")}
            <select class="mx-btn" data-sf-team-picker value={selected()?.profile.teamObjectId ?? ""} onChange={(event) => {
              const choice = choices().find((item) => item.profile.teamObjectId === event.currentTarget.value)
              if (choice) void load(choice.profile.teamObjectId, true)
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
          <a class="mx-btn" href={path + "/dashboard"}>{language.t("sf.teams.dashboard")}</a>
        }</Show>
        <Show when={authenticated()} keyed>{(current) => {
          const scope = administrationScope(current)
          const notice = () => administration.notice?.scope === scope ? administration.notice.key : undefined
          const notify = (key?: TeamAdministrationNotice) => {
            if (key) setAdministration("notice", { scope, key })
            else if (administration.notice?.scope === scope) setAdministration("notice", undefined)
          }
          return <>
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
          </>
        }}</Show>
        <Show when={state().status !== "loading" && state().status !== "unauthenticated"}>
          <button type="button" class="mx-btn" onClick={refresh}>{language.t("sf.ui67.refreshAccess")}</button>
        </Show>
      </main>
    </div>
  )
}
