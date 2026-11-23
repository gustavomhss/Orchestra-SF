import { createEffect, createMemo, createSignal, createUniqueId, For, Match, onCleanup, onMount, on, Show, Switch, type JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { DataProvider } from "@orchestra/session-ui/context"
import { Message } from "@orchestra/session-ui/message-part"
import { PromptInputV2 } from "@orchestra/session-ui/v2/prompt-input"
import { createPromptInputV2Controller } from "@orchestra/session-ui/v2/prompt-input/interaction"
import type { Transcript } from "@orchestra/session-ui/transcript-model"
import { useLanguage } from "../context/language"
import type { TeamSessionRuntime } from "../context/team-session-runtime"
import { teamTranscriptRows, teamTranscriptSession, type TeamTranscriptRow } from "../context/team-session-transcript"
import { teamSessionNavigationURL } from "../context/team-profile-navigation"
import "./team-session.css"

type CopyKey = Parameters<ReturnType<typeof useLanguage>["t"]>[0]
type Props = Readonly<{
  runtime: TeamSessionRuntime
  busy: boolean
  act(action: () => Promise<unknown>): Promise<void>
  go(href: string): void
  notice(key: CopyKey): void
}>

/** Uses the native transcript and prompt controls with the installed Teams
 * facade. It mounts no generic SDK, Location, filesystem or provider registry. */
export function SfTeamSessionWorkspace(props: Props): JSX.Element {
  const language = useLanguage(), workspace = props.runtime.sessions
  const state = workspace.state
  const [ui, setUi] = createStore({ query: "" })
  const [compact, setCompact] = createSignal(false)
  const [historyExpanded, setHistoryExpanded] = createSignal(false)
  const historyId = createUniqueId()
  onMount(() => {
    const query = window.matchMedia("(max-width: 980px)")
    const update = () => setCompact(query.matches)
    update()
    query.addEventListener("change", update)
    onCleanup(() => query.removeEventListener("change", update))
  })
  const [rows, setRows] = createStore<{ items: TeamTranscriptRow[] }>({ items: [] })
  const active = () => state.active ? state.threads[state.active] : undefined
  const profile = () => props.runtime.current()?.context.stamp.team?.owner.profile
  const href = (id?: string) => {
    const current = profile()
    return current ? teamSessionNavigationURL(props.runtime.binding, current, id)?.href : undefined
  }
  const open = (id?: string) => { const target = href(id); if (target) props.go(target) }
  const unavailable = () => props.notice("sf.teams.chatActionUnavailable")
  let controller: ReturnType<typeof createPromptInputV2Controller>
  controller = createPromptInputV2Controller({
    store: workspace.prompt,
    identity: () => JSON.stringify([state.generation, state.active]),
    commands: () => [], context: () => [], searchContextFiles: () => [],
    view: {
      placeholder: () => language.t("prompt.placeholder.simple"),
      add: { onAttach: unavailable },
      shell: { onOpen: () => { unavailable(); controller.closeShell() }, onClose: () => {} },
      onPaste: (event) => {
        if (Array.from(event.clipboardData?.items ?? []).some((item) => item.kind === "file")) {
          event.preventDefault(); unavailable()
        }
      },
      onDrop: (event) => { event.preventDefault(); unavailable() },
      submit: {
        stopping: () => !!active()?.running && !workspace.prompt[0].prompt.some((part) => "content" in part && !!part.content.trim()),
        working: () => active()?.running ?? false,
        onSubmit: () => { void props.act(() => workspace.submit()) },
        onStop: () => { void props.act(() => workspace.stop()) },
      },
    },
  })
  createEffect(() => {
    const thread = active()
    setRows("items", reconcile(thread?.status === "ready" ? teamTranscriptRows(thread.info, thread.messages) : [], { key: "id" }))
  })
  const data = createMemo(() => {
    const thread = active(), messages: Transcript.Message[] = [], parts: Record<string, Transcript.Part[]> = {}
    for (const row of rows.items) if (row.kind === "message") { messages.push(row.info); parts[row.id] = row.parts }
    return {
      session: thread ? [teamTranscriptSession(thread.info)] : [],
      session_status: thread ? { [thread.info.id]: thread.running ? { type: "busy" as const } : { type: "idle" as const } } : {},
      message: thread ? { [thread.info.id]: messages } : {}, part: parts,
    }
  })
  let scroll: HTMLDivElement | undefined, scrollOwner = state.active
  createEffect(on(() => JSON.stringify([state.generation, state.active]), () => {
    const id = state.active, generation = state.generation
    scrollOwner = id
    queueMicrotask(() => {
      if (scroll && generation === state.generation && id === state.active) scroll.scrollTop = active()?.scrollTop ?? 0
    })
  }))
  onCleanup(() => { if (scroll) workspace.scroll(scrollOwner, scroll.scrollTop) })
  const rowTitle = (type: Extract<TeamTranscriptRow, { kind: "notice" }>["type"]): CopyKey => {
    switch (type) {
      case "system": return "sf.teams.chatSystem"
      case "agent-switched": return "sf.teams.chatAgentChanged"
      case "model-switched": return "sf.teams.chatModelChanged"
      case "compaction": return "sf.teams.chatCompacted"
      case "shell": return "sf.teams.chatShell"
    }
  }
  const title = () => active()?.info.title || language.t("sf.teams.newChat")
  const composeDisabled = () => props.busy || state.busy || !!state.pending.length || !!active() && active()?.status !== "ready"
  return <section class="sf-team-session" data-sf-session-workspace data-sf-session-state={state.status} data-sf-session-stream={state.stream}>
    <Switch>
      <Match when={state.status === "idle" || state.status === "loading"}>
        <p role="status">{language.t("session.messages.loading")}</p>
      </Match>
      <Match when={state.status === "unavailable"}>
        <div class="sf-team-session-error" role="alert">
          <p>{language.t(state.reason === "stream" ? "sf.teams.chatUpdatesStopped" : "sf.teams.chatUnavailable")}</p>
          <button type="button" class="mx-btn" disabled={props.busy}
            onClick={() => { void props.act(() => props.runtime.refresh()) }}>{language.t("sf.ui67.retry")}</button>
        </div>
      </Match>
      <Match when={state.status === "ready"}>
        <aside class="sf-team-session-list" aria-label={language.t("sf.teams.chatRecent")}>
          <Show when={compact()}>
            <button type="button" class="mx-btn sf-team-session-history-toggle" data-sf-history-toggle
              aria-expanded={historyExpanded()} aria-controls={historyId}
              onClick={() => setHistoryExpanded((open) => !open)}>
              <span>{language.t("sf.teams.chatRecent")}</span>
              <svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" aria-hidden="true">
                <path d="m4 6 4 4 4-4" />
              </svg>
            </button>
          </Show>
          <div id={historyId} class="sf-team-session-history" data-sf-history-panel hidden={compact() && !historyExpanded()}>
          <button type="button" class="mx-btn" disabled={props.busy || state.busy} data-sf-new-chat onClick={() => open()}>
            {language.t("sf.teams.newChat")}
          </button>
          <form onSubmit={(event) => { event.preventDefault(); void props.act(() => workspace.search(ui.query)) }}>
            <label for="sf-chat-search">{language.t("sf.teams.chatSearch")}</label>
            <div class="sf-team-session-search">
              <input id="sf-chat-search" value={ui.query} maxLength={256}
                onInput={(event) => setUi("query", event.currentTarget.value)} />
              <button type="submit" class="mx-btn" disabled={props.busy}>{language.t("common.search.placeholder")}</button>
            </div>
          </form>
          <Show when={!compact()}><h2>{language.t("sf.teams.chatRecent")}</h2></Show>
          <Show when={state.recent.length} fallback={<p>{language.t("sf.teams.chatEmpty")}</p>}>
            <ul><For each={state.recent}>{(info) => <li>
              <button type="button" class="sf-team-session-item" disabled={props.busy || state.busy}
                aria-current={state.active === info.id ? "page" : undefined} data-sf-session-id={info.id}
                onClick={() => open(info.id)}>{info.title || language.t("sf.teams.newChat")}</button>
            </li>}</For></ul>
          </Show>
          <Show when={state.cursor}><button type="button" class="mx-btn" disabled={props.busy}
            onClick={() => { void props.act(() => workspace.search(state.search, true)) }}>{language.t("sf.teams.more")}</button></Show>
          <Show when={state.closed.length}>
            <h2>{language.t("home.recentlyClosed")}</h2>
            <ul><For each={state.closed}>{(id, index) => <li>
              <button type="button" class="sf-team-session-item" disabled={props.busy || state.busy}
                data-sf-session-reopen={id} onClick={() => open(id)}>{language.t("sf.teams.chatClosed", { number: String(index() + 1) })}</button>
            </li>}</For></ul>
          </Show>
          <Show when={!state.persistent}><p role="status">{language.t("sf.teams.windowEphemeral")}</p></Show>
          </div>
        </aside>
        <div class="sf-team-session-main">
          <nav class="sf-team-session-tabs" aria-label={language.t("sf.teams.chatOpen")}>
            <button type="button" aria-current={!state.active ? "page" : undefined} disabled={props.busy || state.busy}
              onClick={() => open()}>{language.t("sf.teams.newChat")}</button>
            <For each={state.tabs}>{(info) => <div class="sf-team-session-tab" data-active={state.active === info.id || undefined}>
              <button type="button" disabled={props.busy || state.busy} aria-current={state.active === info.id ? "page" : undefined}
                onClick={() => open(info.id)}>{info.title || language.t("sf.teams.newChat")}</button>
              <button type="button" disabled={props.busy || state.busy} aria-label={language.t("command.tab.close")}
                onClick={() => { void props.act(() => props.runtime.closeSession(info.id)) }}>×</button>
            </div>}</For>
          </nav>
          <header class="sf-team-session-heading"><h1>{title()}</h1></header>
          <Show when={state.pending.length}>
            <div role="alert" class="sf-team-session-pending">
              <p>{language.t("sf.teams.pending")}</p>
              <For each={state.pending}>{(operation) => <button type="button" class="mx-btn" disabled={props.busy || state.busy}
                onClick={() => { void props.act(() => workspace.confirmPending(operation)) }}>
                {language.t("sf.teams.chatCheckRequest")} <small>{operation.sessionID}</small>
              </button>}</For>
            </div>
          </Show>
          <div ref={scroll} class="sf-team-session-transcript" data-sf-session-transcript
            onScroll={(event) => workspace.scroll(scrollOwner, event.currentTarget.scrollTop)}>
            <Show when={active()} fallback={<p class="sf-team-session-empty">{language.t("sf.teams.chatStart")}</p>}>
              {(thread) => <Switch>
                <Match when={thread().status === "loading"}><p role="status">{language.t("session.messages.loading")}</p></Match>
                <Match when={thread().status === "unavailable"}>
                  <div role="alert"><p>{language.t("sf.teams.chatUnavailable")}</p>
                    <button type="button" class="mx-btn" disabled={props.busy}
                      onClick={() => { void props.act(() => workspace.open(thread().info.id)) }}>{language.t("sf.ui67.retry")}</button>
                  </div>
                </Match>
                <Match when={thread().status === "ready"}>
                  <DataProvider data={data()} directory={thread().info.location.directory} sessionID={thread().info.id}
                    onNavigateToSession={open} onSessionHref={(id) => href(id) ?? ""}>
                    <Show when={thread().cursor}><button type="button" class="mx-btn" disabled={props.busy}
                      onClick={() => { void props.act(() => workspace.older()) }}>{language.t("session.messages.loadEarlier")}</button></Show>
                    <For each={rows.items}>{(row) => <Show when={row.kind === "message" ? row : undefined} fallback={
                      <Show when={row.kind === "notice" ? row : undefined}>{(notice) => <details class="sf-team-session-note">
                        <summary>{language.t(rowTitle(notice().type))}</summary><pre>{notice().text}</pre>
                      </details>}</Show>
                    }>{(message) => <div data-sf-message-id={message().id}>
                      <Message message={message().info} parts={message().parts} showReasoningSummaries useV2Actions />
                      <Show when={message().attachments.length}>
                        <p role="status">{language.t("sf.teams.chatAttachmentsUnavailable")}</p>
                        <ul><For each={message().attachments}>{(name) => <li>{name}</li>}</For></ul>
                      </Show>
                    </div>}</Show>}</For>
                    <For each={thread().queue}>{(item) => <div class="sf-team-session-queued" data-sf-prompt-admitted={item.id}>
                      <p role="status">{language.t("sf.teams.chatSubmitted")}</p><p>{item.text}</p>
                    </div>}</For>
                  </DataProvider>
                </Match>
              </Switch>}
            </Show>
          </div>
          <fieldset class="sf-team-session-compose" disabled={composeDisabled()}>
            <PromptInputV2 controller={controller} disabled={composeDisabled()} />
          </fieldset>
        </div>
      </Match>
    </Switch>
  </section>
}
