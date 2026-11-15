import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfWorkClient } from "@orchestra/client/sucafina/work"
import { SfProjectionHome } from "@orchestra/schema/sucafina/work"
import type { Schema } from "effect"
import type { SfSurfaceProps } from "../context/contracts"
import { useSfContext } from "../context"
import { SfPageFrame, type SfCopyKey, type SfUiState } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { useSfPresentation } from "../shared/frame/presentation"

type Home = Extract<Schema.Schema.Type<typeof SfProjectionHome.Output>, { status: "ok" }>["value"]
type State = Readonly<{ status: SfUiState; data: Home | null }>
const key = (value: string) => value as SfCopyKey

/**
 * UI29 reads the installed home projection. Its availability flags are NOT
 * actual work items, meeting records, or material-change events. Never turn
 * them into successful work, completed routines, or synthetic meetings.
 */
export function SfTodayView(_props: SfSurfaceProps<"UI29">): JSX.Element {
  const owner = useSfContext()
  const { t } = useSfPresentation()
  const [screen, setScreen] = createStore<State>({ status: "loading", data: null })
  const statusFromContext = (): SfUiState => {
    const status = owner.state().status
    if (status === "resolving") return "loading"
    if (status === "unauthenticated") return "session-expired"
    if (status === "denied") return "denied"
    if (status === "context-mismatch") return "invalid"
    return "unavailable"
  }
  const load = (signal: AbortSignal, generation: number): void => {
    const ready = owner.ready()
    if (!ready) return
    const operation = ready.context.availability
      .find((entry) => entry.family === "domain-read" && entry.resource === "home")
      ?.operations.find((entry) => entry.operationId === "projection.home")
    if (!operation || operation.state !== "ready" || !operation.operational) {
      setScreen({ status: operation?.state === "denied" ? "denied" : "unavailable", data: null })
      return
    }
    setScreen({ status: "loading", data: null })
    void createSfWorkClient(ready.transport)["projection.home"]({}, { signal }).then((result) => {
      if (signal.aborted || generation !== owner.generation()) return
      if (result.kind !== "response") {
        if (result.reason !== "aborted") console.error("SF Today projection read failed", result.reason)
        setScreen({ status: "unavailable", data: null })
        return
      }
      if (result.body.status === "ok") {
        setScreen({ status: "ready", data: result.body.value })
        return
      }
      const status: SfUiState =
        result.body.status === "denied" ? "denied"
        : result.body.status === "stale" ? "stale"
        : result.body.status === "conflict" ? "conflict"
        : result.body.status === "invalid" || result.body.status === "needs-input" ? "invalid"
        : "unavailable"
      if (status === "unavailable") console.error("SF Today source unavailable")
      setScreen({ status, data: null })
    }).catch((error: unknown) => {
      if (signal.aborted || generation !== owner.generation()) return
      console.error("SF Today projection read failed", error instanceof Error ? error.name : "unknown")
      setScreen({ status: "unavailable", data: null })
    })
  }
  createEffect(() => {
    const state = owner.state()
    const generation = owner.generation()
    if (state.status !== "ready" || !owner.ready()) {
      setScreen({ status: statusFromContext(), data: null })
      return
    }
    const request = new AbortController()
    load(request.signal, generation)
    onCleanup(() => request.abort())
  })
  const refresh = () => { void owner.reload() }
  const data = () => screen.status === "ready" ? screen.data : null
  const caseState = (): SfUiState =>
    data()?.cases.status !== "ok" ? "unavailable"
    : data()!.cases.status === "ok" && data()!.cases.items.length ? "ready" : "empty"
  const routineState = (): SfUiState =>
    data()?.routines.status !== "ok" ? "unavailable"
    : data()!.routines.status === "ok" && data()!.routines.items.length ? "ready" : "empty"

  return (
    <SfPageFrame
      titleKey={key("sf.ui29.title")}
      subtitleKey={key("sf.ui29.subtitle")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[]}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
    >
      <SfStatePanel
        state={screen.status}
        messageKey={key(screen.status === "ready" ? "sf.ui29.title" : screen.status === "denied" ? "sf.common.noAccess" : screen.status === "session-expired" ? "sf.common.loginAgain" : screen.status === "loading" ? "sf.common.loading" : "sf.common.unavailable")}
        onRetryRead={refresh}
      >
        <div class="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-2" data-sf-home="authorized">
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-attention">
            <h2 id="sf-u01-attention">{t(key("sf.ui29.attention"))}</h2>
            <SfStatePanel
              state={data()?.workProducer === "available" ? "partial" : "unavailable"}
              messageKey={key(data()?.workProducer === "available" ? "sf.ui29.workSourceReady" : "sf.ui29.workUnavailable")}
            >
              <p>{t(key("sf.ui29.workRequiresSelection"))}</p>
            </SfStatePanel>
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-resume">
            <h2 id="sf-u01-resume">{t(key("sf.ui29.resume"))}</h2>
            <h3>{t(key("sf.ui29.cases"))}</h3>
            <SfStatePanel
              state={caseState()}
              messageKey={key(data()?.cases.status === "ok" && !data()!.cases.items.length ? "sf.common.empty" : "sf.ui29.casesUnavailable")}
              onRetryRead={refresh}
            >
              <Show when={data()?.cases.status === "ok" && data()!.cases.items.length > 0}>
                <ul class="list-disc ps-5">
                  <For each={data()?.cases.status === "ok" ? data()!.cases.items : []}>
                    {(item) => (
                      <li>
                        <strong><bdi>{item.title}</bdi></strong>
                        <span class="block text-sm">{t(key("sf.ui29.caseVersion"), { version: item.version })}</span>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </SfStatePanel>
            <h3>{t(key("sf.ui29.routines"))}</h3>
            <SfStatePanel
              state={routineState()}
              messageKey={key(data()?.routines.status === "ok" && !data()!.routines.items.length ? "sf.common.empty" : "sf.ui29.routinesUnavailable")}
              onRetryRead={refresh}
            >
              <Show when={data()?.routines.status === "ok" && data()!.routines.items.length > 0}>
                <ul class="list-disc ps-5">
                  <For each={data()?.routines.status === "ok" ? data()!.routines.items : []}>
                    {(item) => (
                      <li>
                        <span>{t(key("sf.ui29.admission"))}: </span>
                        <bdi>{item.admission}</bdi>
                        <Show when={item.runRef}><span class="block"><bdi>{item.runRef}</bdi></span></Show>
                      </li>
                    )}
                  </For>
                </ul>
              </Show>
            </SfStatePanel>
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-meetings">
            <h2 id="sf-u01-meetings">{t(key("sf.ui29.meetings"))}</h2>
            <SfStatePanel state="unavailable" messageKey={key("sf.ui29.meetingsNotProjected")} />
          </section>
          <section class="mx-card min-w-0" aria-labelledby="sf-u01-changes">
            <h2 id="sf-u01-changes">{t(key("sf.ui29.materialChanges"))}</h2>
            <SfStatePanel state="unavailable" messageKey={key("sf.ui29.changesNotProjected")} />
          </section>
        </div>
      </SfStatePanel>
    </SfPageFrame>
  )
}
