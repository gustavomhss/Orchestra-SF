import { Router, Route, useBeforeLeave, useLocation, useNavigate } from "@solidjs/router"
import { createEffect, createMemo, createUniqueId, For, Match, onCleanup, onMount, Show, Switch, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "../context/language"
import { usePlatform } from "../context/platform"
import { readCurrentTeamInstallation, teamWebLoginUrl } from "../context/team-profile-web"
import { createTeamWebRuntime, type TeamWebRuntime } from "../context/team-profile-runtime"
import { acquireTeamWindowIdentity, type TeamWindowIdentity } from "../utils/team-profile-storage"
import { SfContextBoundary } from "../orchestra/chapters/sucafina/context"
import { SfTeamLabelProvider } from "../orchestra/chapters/sucafina/shared/team-label"
import { SfTeamProfilesAdministration } from "../orchestra/chapters/sucafina/local-administration/team-profiles"
import { SfExtendedPages } from "../orchestra/chapters/sucafina/host/extended-routes"
import { SfTodayView } from "../orchestra/chapters/sucafina/home"
import { SfCasesView } from "../orchestra/chapters/sucafina/decisions/cases"
import { SfIntentView } from "../orchestra/chapters/sucafina/decisions/intent"
import type { SfSurfaceProps } from "../orchestra/chapters/sucafina/context/contracts"
import { sfNativeOwnerChapterRequest } from "../orchestra/chapters/sucafina/host/native-chapter-entry"
import { resolveSfTeamNativeRoute, sfTeamAdministrationHref } from "../orchestra/chapters/sucafina/host/team-route"
import { navigation as chapterNavigation } from "../orchestra/navigation"
import type { SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfTransportFetch } from "@orchestra/client/sucafina/transport"
import "./team-profile.css"

type CopyKey = Parameters<ReturnType<typeof useLanguage>["t"]>[0]
const browserStorage = {
  getItem: (key: string) => window.sessionStorage.getItem(key),
  setItem: (key: string, value: string) => window.sessionStorage.setItem(key, value),
  removeItem: (key: string) => window.sessionStorage.removeItem(key),
}
/** Explicit SF Web entry. No generic Global/SDK/Location/provider mounts before this gate. */
export function SfTeamWebApp(props: Readonly<{ origin: string }>): JSX.Element {
  const language = useLanguage(), platform = usePlatform()
  const [ui, setUi] = createStore<{ status: "loading" | "ready" | "unavailable" }>({ status: "loading" })
  const origin = props.origin, abort = new AbortController()
  let disposed = false, attempt = 0, identity: TeamWindowIdentity | undefined, installed: SfTeamInstallationDescriptor | undefined
  const fetcher: SfTransportFetch = (url, init) => platform.fetch ? platform.fetch(url, init) : globalThis.fetch(url, init)
  const start = async () => {
    const epoch = ++attempt
    installed = undefined
    setUi("status", "loading")
    const binding = await readCurrentTeamInstallation({ origin, browserOrigin: window.location.origin,
      fetch: fetcher, signal: abort.signal })
    if (disposed || abort.signal.aborted || epoch !== attempt) return
    if (!binding) { setUi("status", "unavailable"); return }
    identity?.dispose()
    identity = await acquireTeamWindowIdentity({ storage: browserStorage, signal: abort.signal,
      locks: typeof navigator.locks === "object" ? navigator.locks : undefined })
    if (disposed || abort.signal.aborted || epoch !== attempt || !identity) { identity?.dispose(); return }
    installed = binding
    setUi("status", "ready")
  }
  onMount(() => { void start() })
  createEffect(() => { if (props.origin !== origin) { abort.abort(); identity?.dispose(); setUi("status", "unavailable") } })
  onCleanup(() => { disposed = true; attempt++; abort.abort(); identity?.dispose() })
  return <Show when={ui.status === "ready" && installed && identity} fallback={
    <main class="sf-team-entry" data-sf-teams-bootstrap={ui.status}>
      <img src="/brand/sucafina/mark-primary.svg" alt="Sucafina" width="56" height="56" />
      <h1>{language.t("sf.teams.title")}</h1>
      <p role={ui.status === "loading" ? "status" : "alert"}>
        {language.t(ui.status === "loading" ? "sf.teams.loading" : "sf.teams.installationUnavailable")}
      </p>
      <Show when={ui.status === "unavailable"}>
        <button type="button" class="mx-btn" onClick={() => { void start() }}>{language.t("sf.ui67.retry")}</button>
      </Show>
    </main>
  }>
    <Router><Route path="*path" component={() => <SfTeamWebShell binding={installed!} window={identity!} fetch={fetcher} />} /></Router>
  </Show>
}

function SfTeamPicker(props: Readonly<{ runtime: TeamWebRuntime; choose(profile: TeamProfile.Ref): void; busy: () => boolean }>) {
  const language = useLanguage(), id = createUniqueId()
  const state = () => props.runtime.current()?.context.profile.teams
  const choices = () => { const value = state(); return value?.status === "ready" || value?.status === "selection-required" ? value.choices : [] }
  const selected = () => { const value = state(); return value?.status === "ready" ? value.selected.teamObjectId : "" }
  return <div class="sf-team-picker">
    <label for={id}>{language.t("sf.teams.team")}</label>
    <select id={id} data-sf-team-picker value={selected()} disabled={props.busy() || !choices().length}
      onChange={(event) => {
        const target = choices().find((choice) => choice.profile.teamObjectId === event.currentTarget.value)
        if (target) props.choose(target.profile)
        event.currentTarget.value = selected()
      }}>
      <Show when={!selected()}><option value="" disabled>{language.t("sf.teams.select")}</option></Show>
      <For each={choices()}>{(choice) => <option value={choice.profile.teamObjectId}>
        {choices().filter((item) => item.displayName === choice.displayName).length > 1
          ? choice.displayName + " · " + choice.profile.teamObjectId : choice.displayName}
      </option>}</For>
    </select>
  </div>
}

function SfTeamWebShell(props: Readonly<{ binding: SfTeamInstallationDescriptor; window: TeamWindowIdentity; fetch: SfTransportFetch }>) {
  const language = useLanguage(), location = useLocation(), routerNavigate = useNavigate()
  const [ui, setUi] = createStore<{ busy: boolean; consent: boolean; notice?: CopyKey; narrowOpen: boolean }>({
    busy: false, consent: false, narrowOpen: false,
  })
  let disposed = false, committing = false, consent: ((yes: boolean) => void) | undefined
  let runtime: TeamWebRuntime
  const confirm = () => {
    consent?.(false)
    setUi("consent", true)
    return new Promise<boolean>((resolve) => { consent = resolve })
  }
  const closeConsent = (yes = false) => {
    const done = consent; consent = undefined; setUi("consent", false); done?.(yes)
  }
  const currentHref = () => location.pathname + location.search + location.hash
  const commitHref = (href: string, replace: boolean) => {
    if (disposed) return
    committing = true
    try { if (currentHref() !== href) routerNavigate(href, { replace }) }
    finally { committing = false }
  }
  const channelName = "orchestra.teams.invalidate.v1:" + encodeURIComponent(props.binding.installationId) + ":" + props.binding.tenantId
  const channel = typeof BroadcastChannel === "function" ? new BroadcastChannel(channelName) : undefined
  const broadcast = (reason: "logout" | "revoked" | "principal-change") =>
    channel?.postMessage({ version: 1, type: "invalidate", reason })
  runtime = createTeamWebRuntime({
    binding: props.binding, window: props.window, storage: browserStorage, fetch: props.fetch, currentHref, commitHref,
    confirmDiscard: confirm, closeConsent, notice: (key) => setUi("notice", key), broadcast,
  })
  if (channel) channel.onmessage = (event) => {
    if (!disposed && event.data && typeof event.data === "object" && event.data.version === 1 &&
        event.data.type === "invalidate" && Object.keys(event.data).length === 3 &&
        ["logout", "revoked", "principal-change"].includes(event.data.reason)) {
      runtime.invalidate(event.data.reason)
      // A logout request can still be in flight. Never resurrect its cookie
      // with an automatic read in another window while that outcome is unknown.
      if (event.data.reason !== "logout") void runtime.refresh()
    }
  }
  const context = () => runtime.current()?.context
  const profile = () => context()?.profile
  const teamLabel = () => {
    const teams = profile()?.teams
    return teams?.status === "ready" ? teams.choices.find((choice) => choice.profile.teamObjectId === teams.selected.teamObjectId)?.displayName ?? "" : ""
  }
  const act = async (action: () => Promise<unknown>) => {
    if (ui.busy || disposed) return
    setUi({ busy: true, notice: undefined })
    try { await action() }
    catch (error) {
      if (!disposed) { setUi("notice", "sf.teams.actionFailed"); console.error("Teams Web action failed", error instanceof Error ? error.name : "unknown") }
    } finally { if (!disposed) setUi("busy", false) }
  }
  const choose = (selected: TeamProfile.Ref) => { void act(async () => {
    const result = await runtime.choose(selected)
    if (result !== "selected" && result !== "aborted" && result !== "kept-editing")
      setUi("notice", "sf.teams.switchFailed")
  }) }
  const go = (href: string) => { setUi("narrowOpen", false); void act(() => runtime.navigate(href, "sidebar")) }
  const links = createMemo(() => {
    const ready = runtime.owner.state()
    if (ready.status !== "ready" || !runtime.owner.ready()) return []
    const context = ready.context
    if (context.contractRevision !== "sf-team-profile/1") return []
    return chapterNavigation.flatMap((chapter) => {
      const href = sfNativeOwnerChapterRequest(chapter.id, ready.selection)
      return href && resolveSfTeamNativeRoute(href, props.binding, ready.selection, context) ? [{ chapter, href }] : []
    })
  })
  const loginUrl = () => teamWebLoginUrl(props.binding, window.location.origin)
  useBeforeLeave((event) => {
    if (committing || event.defaultPrevented || disposed) return
    event.preventDefault()
    const target = typeof event.to === "string" ? event.to : window.location.pathname + window.location.search + window.location.hash
    // Native history has already changed the browser URL when this guard runs.
    // The original Solid route remains mounted until this revalidation commits.
    if (typeof event.to === "number" && target === currentHref()) { setUi("notice", "sf.teams.invalidLink"); return }
    void act(() => runtime.navigate(target, typeof event.to === "number" ? "history" : "link", () => event.retry(true)))
  })
  const unload = (event: BeforeUnloadEvent) => { if (runtime.owner.hasDirtyDrafts()) { event.preventDefault(); event.returnValue = "" } }
  const focus = () => { if (!disposed && !ui.busy && !ui.consent) void act(() => runtime.refresh()) }
  const keyboard = (event: KeyboardEvent) => {
    if (!(event.ctrlKey || event.metaKey) || !event.shiftKey || event.key.toLowerCase() !== "p") return
    event.preventDefault()
    const picker = [...document.querySelectorAll<HTMLSelectElement>("[data-sf-team-picker]:not(:disabled)")]
      .find((element) => element.getClientRects().length > 0)
    if (picker) picker.focus()
    else {
      setUi("narrowOpen", true)
      queueMicrotask(() => { if (!disposed) document.querySelector<HTMLSelectElement>(".sf-team-mobile [data-sf-team-picker]:not(:disabled)")?.focus() })
    }
  }
  onMount(() => {
    void act(() => runtime.start())
    window.addEventListener("beforeunload", unload)
    window.addEventListener("focus", focus)
    window.addEventListener("keydown", keyboard)
  })
  onCleanup(() => {
    disposed = true; closeConsent(); channel?.close(); runtime.dispose()
    window.removeEventListener("beforeunload", unload); window.removeEventListener("focus", focus); window.removeEventListener("keydown", keyboard)
  })
  const statusKey = (): CopyKey => {
    const state = runtime.state()
    if (state.status === "resolving") return "sf.teams.loading"
    if (state.status === "unauthenticated") return "sf.ui67.unauthenticated"
    if (state.status === "denied") return "sf.ui67.denied"
    if (state.status === "unavailable") return "sf.ui67.unavailable"
    const teams = state.context.profile.teams
    if (teams.status === "no-teams") return "sf.teams.noTeams"
    if (teams.status === "selection-required") return "sf.teams.choose"
    if (teams.status === "denied") return "sf.teams.teamDenied"
    if (teams.status === "revoked") return "sf.teams.teamRevoked"
    if (teams.status === "unavailable") return teams.reason === "consent-required" ? "sf.teams.consentRequired" :
      teams.reason === "capability-disabled" ? "sf.teams.notConfigured" :
      teams.reason === "forbidden" ? "sf.teams.forbidden" :
      teams.reason === "rate-limited" ? "sf.teams.rateLimited" :
      teams.reason === "incomplete" ? "sf.teams.incomplete" : "sf.teams.teamUnavailable"
    return state.context.stamp.team ? "sf.teams.signedIn" : "sf.teams.noRights"
  }
  const menu = () => <>
    <button type="button" class="sf-team-nav-item" onClick={() => { setUi("narrowOpen", false); void act(() => runtime.resetSelection()) }}>
      {language.t("sf.teams.context")}</button>
    <Show when={profile()?.administration.status !== "denied" && profile()}>
      <button type="button" class="sf-team-nav-item" disabled={ui.busy}
        onClick={() => go(sfTeamAdministrationHref(props.binding))}>{language.t("sf.teams.administration")}</button>
    </Show>
    <Show when={links().length}>
      <h2>{language.t("sf.teams.sections")}</h2>
      <For each={links()}>{(item) => <button type="button" class="sf-team-nav-item" disabled={ui.busy}
        aria-current={runtime.view.route?.pathname.startsWith(item.href.split("?")[0]!) ? "page" : undefined}
        onClick={() => go(item.href)}>{language.t(item.chapter.label)}</button>}</For>
    </Show>
    <button type="button" class="sf-team-nav-item" disabled
      title={language.t("sf.teams.chatUnavailable")}>{language.t("sf.teams.newChat")}</button>
  </>
  const businessRoute = () => runtime.view.kind === "business" && runtime.owner.ready() ? runtime.view.route : undefined
  return <div class="sf-team-shell" data-sf-teams-shell data-sf-teams-state={runtime.state().status}
    data-sf-team-selected={profile()?.teams.status === "ready" ? (profile()!.teams as Extract<TeamProfile.TeamState, { status: "ready" }>).selected.teamObjectId : undefined}>
    <header class="sf-team-topbar">
      <a href="/" class="sf-team-brand" onClick={(event) => { event.preventDefault(); void act(() => runtime.resetSelection()) }}>
        <img src="/brand/sucafina/mark-primary.svg" alt="Sucafina" width="36" height="36" /><span>Sucafina</span>
      </a>
      <div class="sf-team-picker-wide"><SfTeamPicker runtime={runtime} choose={choose} busy={() => ui.busy} /></div>
      <button class="mx-btn sf-team-menu-toggle" type="button" aria-expanded={ui.narrowOpen}
        onClick={() => setUi("narrowOpen", (value) => !value)}>{language.t("sf.teams.menu")}</button>
      <Show when={runtime.state().status !== "unauthenticated" && runtime.state().status !== "resolving"}>
        <button class="mx-btn" type="button" data-sf-sign-out disabled={ui.busy}
          onClick={() => { void act(() => runtime.logout()) }}>{language.t("sf.ui67.signOut")}</button>
      </Show>
    </header>
    <div class="sf-team-mobile" hidden={!ui.narrowOpen}>
      <SfTeamPicker runtime={runtime} choose={choose} busy={() => ui.busy} /><nav aria-label={language.t("sf.teams.menu")}>{menu()}</nav>
    </div>
    <aside class="sf-team-sidebar"><nav aria-label={language.t("sf.teams.menu")}>{menu()}</nav></aside>
    <main class="sf-team-main" id="sf-team-content">
      <Show when={ui.notice}><p class="sf-team-notice" role="alert">{language.t(ui.notice!)}</p></Show>
      <Show when={!props.window.persistent}><p class="sf-team-notice" role="status">{language.t("sf.teams.windowEphemeral")}</p></Show>
      <Show when={runtime.view.kind === "invalid"}><p role="alert">{language.t("sf.teams.invalidLink")}</p></Show>
      <Show when={runtime.view.kind === "denied"}><p role="alert">{language.t("sf.teams.teamDenied")}</p></Show>
      <Show when={runtime.view.kind === "unavailable"}><p role="alert">{language.t("sf.ui67.unavailable")}</p></Show>
      <Show when={runtime.view.kind === "context" || runtime.state().status !== "authenticated" || runtime.view.kind === "resolving"}>
        <section class="sf-team-context mx-card" data-sf-team-context>
          <h1>{language.t("sf.teams.title")}</h1><p>{language.t("sf.teams.subtitle")}</p>
          <p role="status" data-sf-team-status>{language.t(statusKey())}</p>
          <Show when={loginUrl() && (runtime.state().status === "unauthenticated" ||
            profile()?.teams.status === "unavailable" && (profile()!.teams as Extract<TeamProfile.TeamState, { status: "unavailable" }>).reason === "consent-required")}>
            <a class="mx-btn" data-sf-microsoft-login href={loginUrl()!}>{language.t("sf.teams.signIn")}</a>
          </Show>
          <button type="button" class="mx-btn" data-sf-refresh-access disabled={ui.busy}
            onClick={() => { void act(() => runtime.refresh()) }}>{language.t("sf.ui67.refreshAccess")}</button>
          <Show when={context()}>{(current) => <details>
            <summary>{language.t("sf.teams.details")}</summary>
            <dl><dt>{language.t("sf.teams.tenant")}</dt><dd><bdi>{current().profile.principal.tenantId}</bdi></dd>
              <dt>{language.t("sf.teams.account")}</dt><dd><bdi>{current().profile.principal.principalObjectId}</bdi></dd>
              <Show when={current().profile.teams.status === "ready"}>
                <dt>{language.t("sf.teams.team")}</dt><dd><bdi>{teamLabel()}</bdi></dd>
                <dt>{language.t("sf.teams.teamId")}</dt><dd><bdi>{(current().profile.teams as Extract<TeamProfile.TeamState, { status: "ready" }>).selected.teamObjectId}</bdi></dd>
              </Show>
            </dl>
          </details>}</Show>
        </section>
      </Show>
      <Show when={runtime.view.kind === "administration" && context()}>
        <SfTeamProfilesAdministration binding={props.binding} context={context} generation={runtime.generation}
          fetch={runtime.fetch} refresh={runtime.refresh} />
      </Show>
      <Show when={businessRoute()} keyed>{(route) =>
        <SfContextBoundary value={runtime.owner}><SfTeamLabelProvider label={teamLabel}>
          <Switch>
            <Match when={route.surfaceId === "UI29"}><SfTodayView surfaceId="UI29" route={route as SfSurfaceProps<"UI29">["route"]} /></Match>
            <Match when={route.surfaceId === "UI33"}><SfCasesView surfaceId="UI33" route={route as SfSurfaceProps<"UI33">["route"]} /></Match>
            <Match when={route.surfaceId === "UI34"}><SfIntentView surfaceId="UI34" route={route as SfSurfaceProps<"UI34">["route"]} /></Match>
            <Match when={!["UI29", "UI33", "UI34"].includes(route.surfaceId)}><SfExtendedPages route={route} /></Match>
          </Switch>
        </SfTeamLabelProvider></SfContextBoundary>
      }</Show>
    </main>
    <Show when={ui.consent}><SfTeamDiscardDialog close={closeConsent} /></Show>
  </div>
}

function SfTeamDiscardDialog(props: Readonly<{ close(yes?: boolean): void }>) {
  const language = useLanguage(), id = createUniqueId()
  let dialog!: HTMLDialogElement
  onMount(() => dialog.showModal())
  onCleanup(() => { if (dialog.open) dialog.close() })
  return <dialog ref={dialog} class="sf-team-dialog" aria-labelledby={id}
    onCancel={(event) => { event.preventDefault(); props.close(false) }}>
    <h2 id={id}>{language.t("sf.teams.discard")}</h2>
    <button class="mx-btn" type="button" autofocus onClick={() => props.close(false)}>{language.t("common.cancel")}</button>
    <button class="mx-btn" type="button" data-sf-confirm-discard onClick={() => props.close(true)}>{language.t("sf.ui67.discardNavigate")}</button>
  </dialog>
}
