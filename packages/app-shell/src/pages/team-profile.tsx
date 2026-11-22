import { createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import type { SfTeamContext, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import { readCurrentTeamInstallation, readTeamWebContext } from "../context/team-profile-web"
import { useLanguage } from "../context/language"

type TeamWebState =
  | { status: "loading" | "unavailable" }
  | { status: "unauthenticated" | "denied"; binding: SfTeamInstallationDescriptor }
  | { status: "authenticated"; binding: SfTeamInstallationDescriptor; context: SfTeamContext }

export function SfTeamWebApp() {
  const language = useLanguage()
  const [state, setState] = createSignal<TeamWebState>({ status: "loading" })
  const [logoutFailed, setLogoutFailed] = createSignal(false)
  const [signingOut, setSigningOut] = createSignal(false)
  let pending: AbortController | undefined
  let pendingTeamObjectId: string | undefined
  const binding = () => {
    const current = state()
    return "binding" in current ? current.binding : undefined
  }
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
    pending?.abort()
    pending = new AbortController()
    setState({ status: "loading" })
    return pending.signal
  }
  const load = async (teamObjectId?: string) => {
    if (signingOut()) return
    pendingTeamObjectId = teamObjectId
    const signal = begin()
    const current = await readCurrentTeamInstallation(signal)
    const result = current && await readTeamWebContext(current, signal, teamObjectId)
    if (signal.aborted) return
    pendingTeamObjectId = undefined
    if (!current || !result) return setState({ status: "unavailable" })
    if (result.status === "ok") return setState({ status: "authenticated", binding: current, context: result.value })
    setState({ status: result.status, binding: current })
  }
  const refresh = () => { void load(selected()?.profile.teamObjectId ?? pendingTeamObjectId) }
  const logout = async () => {
    const current = binding()
    if (!current || signingOut()) return
    setLogoutFailed(false)
    setSigningOut(true)
    pendingTeamObjectId = undefined
    const signal = begin()
    const response = await fetch(current.mount + "/auth/logout", {
      method: "POST",
      credentials: "same-origin",
      redirect: "error",
      signal: AbortSignal.any([signal, AbortSignal.timeout(15_000)]),
    }).catch(() => undefined)
    if (signal.aborted) return
    setSigningOut(false)
    if (response?.status === 204) return setState({ status: "unauthenticated", binding: current })
    setLogoutFailed(true)
    setState({ status: "unavailable" })
  }
  const statusCopy = () => {
    const status = state().status
    if (status === "loading") return "sf.ui67.loading"
    if (status === "unauthenticated") return "sf.ui67.unauthenticated"
    if (status === "denied") return "sf.teams.noTeams"
    if (status === "authenticated" && teams()?.status === "selection-required") return "sf.teams.select"
    return "sf.ui67.unavailable"
  }
  const restore = (event: PageTransitionEvent) => { if (event.persisted) refresh() }
  onMount(() => {
    refresh()
    window.addEventListener("focus", refresh)
    window.addEventListener("pageshow", restore)
  })
  onCleanup(() => {
    pending?.abort()
    window.removeEventListener("focus", refresh)
    window.removeEventListener("pageshow", restore)
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
          <p role="status">{language.t(statusCopy())}</p>
        </Show>
        <Show when={logoutFailed()}><p role="alert">{language.t("sf.ui67.signOutFailed")}</p></Show>
        <Show when={state().status === "unauthenticated" && binding()} keyed>{(current) =>
          <a class="mx-btn" href={current.mount + "/auth/login?returnTo=%2F"}>{language.t("sf.teams.signIn")}</a>
        }</Show>
        <Show when={choices().length}>
          <label class="flex flex-col gap-1">
            {language.t("sf.teams.team")}
            <select class="mx-btn" value={selected()?.profile.teamObjectId ?? ""} onChange={(event) => {
              const choice = choices().find((item) => item.profile.teamObjectId === event.currentTarget.value)
              if (choice) void load(choice.profile.teamObjectId)
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
        <Show when={state().status !== "loading" && state().status !== "unauthenticated"}>
          <button type="button" class="mx-btn" onClick={refresh}>{language.t("sf.ui67.refreshAccess")}</button>
        </Show>
      </main>
    </div>
  )
}
