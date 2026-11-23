import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { createSfRoutinesClient } from "@orchestra/client/sucafina/routines"
import { SfRoutines, SfScheduleDetail } from "@orchestra/schema/sucafina/routines"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import {
  n29ContextState, n29Key, n29Permitted, n29ResponseState,
  n29SameAuthority, n29StateKey, useN29Copy,
} from "../catalog/ui"
import { StatusText } from "../../reviews/labels"
import "./schedules.css"
import "../../reviews/workflows.css"

type ListBody = (typeof SfRoutines.operations["schedules.list"]["output"])["Type"]
type Schedule = Extract<ListBody, { status: "ok" }>["value"][number]
type Detail = (typeof SfScheduleDetail)["Type"]
type Change = { conditionRef: string; recipeRef: string; recurrence: string; timezone: string }
type Phase = "clean" | "dirty" | "reviewing" | "submitting" | "outcome-unknown" | "conflict"
type View = {
  state: SfUiState
  schedules: readonly Schedule[]
  selected: string | null
  detail: Detail | null
  detailState: SfUiState
  run: { runRef: string; admission: string; resultRef: string | undefined; pending: readonly string[] } | null
  runState: SfUiState
  runRef: string
  filter: string
  change: Change
  phase: Phase
  mode: "inspect" | "create" | "update" | "pause"
  refresh: number
  lastRef: string | null
}
const blank = (): Change => ({ conditionRef: "", recipeRef: "", recurrence: "", timezone: "" })
const initial = (kind: SfSurfaceProps<"UI66">["route"]["kind"]): View => ({
  state: "loading", schedules: [], selected: null, detail: null,
  detailState: "unavailable", run: null, runState: "empty", runRef: "",
  filter: "", change: blank(), phase: "clean",
  mode: kind === "new" ? "create" : "inspect", refresh: 0, lastRef: null,
})

/**
 * UI66: direct original BusinessPorts.schedules operations. This UI never uses
 * Core Schedule, device tasks or a synthetic detail reader. List contains only
 * scheduleRef/version/state. UPDATE is impossible without an authorized and
 * current scheduleDetails.read value matching the list version and owner.
 */
export function SfSchedulesView(props: SfSurfaceProps<"UI66">): JSX.Element {
  const owner = useSfContext()
  const { t } = useN29Copy()
  const [view, setView] = createStore<View>(initial(props.route.kind))
  let pending: AbortController | undefined
  onCleanup(() => pending?.abort())

  const permitted = (id: "schedules.list" | "schedules.read" | "schedules.create" | "schedules.update" | "schedules.pause" | "schedules.read-run") => {
    const active = owner.ready()
    return !!active && n29Permitted(active.context, "schedules", id)
  }
  const selected = createMemo(() => view.schedules.find((row) => row.scheduleRef === view.selected))
  const visible = createMemo(() => view.schedules.filter((row) =>
    row.scheduleRef.toLocaleLowerCase().includes(view.filter.trim().toLocaleLowerCase())
      || row.state.toLocaleLowerCase().includes(view.filter.trim().toLocaleLowerCase())))
  const state = (): SfUiState => view.state === "ready" && !visible().length && view.filter.trim()
    ? "filtered-empty" : view.state
  const liveDetail = () => {
    const detail = view.detail
    const row = selected()
    return detail && row && detail.scheduleRef === row.scheduleRef && detail.version === row.version
      && view.detailState === "ready" ? detail : null
  }
  const busy = () => view.phase === "submitting"
  const canChange = () => !!owner.ready() && !busy() && view.phase !== "outcome-unknown" && view.phase !== "conflict"
  const reviewValid = () => {
    if (view.mode === "create") return !!view.change.conditionRef.trim() &&
      !!view.change.recipeRef.trim() && !!view.change.recurrence.trim() &&
      !!view.change.timezone.trim() && permitted("schedules.create")
    if (view.mode === "pause") return !!selected() && permitted("schedules.pause")
    if (view.mode === "update") return !!liveDetail() && permitted("schedules.update")
      && !!view.change.recurrence.trim() && !!view.change.timezone.trim()
    return false
  }

  // A current list is an authorized summary, not the editor's source of truth.
  // Rereads cancel on context generation changes and cannot publish late data.
  createEffect(() => {
    const generation = owner.generation()
    const active = owner.ready()
    const refresh = view.refresh
    const routeKind = props.route.kind
    const requested = routeKind === "entry" ? props.route.params.scheduleRef : null
    if (!active) {
      pending?.abort()
      setView(reconcile({ ...initial(routeKind), state: n29ContextState(owner.state().status), refresh }))
      return
    }
    const availability = active.context.availability.find((entry) => entry.family === "intelligence" && entry.resource === "schedules")
    if (!permitted("schedules.list")) {
      pending?.abort()
      setView(reconcile({ ...initial(routeKind), state: availability?.state === "denied" ? "denied" : "unavailable", refresh }))
      return
    }
    const abort = new AbortController()
    const stamp = active.context.stamp
    setView("state", "loading")
    setView("detail", null)
    setView("detailState", "unavailable")
    onCleanup(() => abort.abort())
    const client = createSfRoutinesClient(active.transport)
    void client["schedules.list"]({}, { signal: abort.signal }).then(async (response) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      const resultState = n29ResponseState(response)
      if (response.kind !== "response" || response.body.status !== "ok") {
        if (resultState === "denied" || resultState === "session-expired")
          setView(reconcile({ ...initial(routeKind), state: resultState, refresh }))
        else setView("state", resultState)
        if (resultState === "unavailable") console.error("N29 UI66: authorized schedule list unavailable")
        return
      }
      const schedules = response.body.value
      const selectedRef = requested ?? view.selected
      const row = schedules.find((item) => item.scheduleRef === selectedRef)
      setView("schedules", schedules)
      setView("selected", row?.scheduleRef ?? null)
      setView("state", schedules.length ? "ready" : "empty")
      if (!row || !permitted("schedules.read")) {
        setView("detail", null)
        setView("detailState", row ? "unavailable" : "empty")
        return
      }
      const read = await client["schedules.read"]({ scheduleRef: row.scheduleRef }, { signal: abort.signal })
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      const detailState = n29ResponseState(read)
      if (read.kind !== "response" || read.body.status !== "ok") {
        setView("detail", null)
        setView("detailState", detailState)
        if (detailState === "denied") setView(reconcile({ ...initial(routeKind), state: "denied", refresh }))
        return
      }
      const detail = read.body.value
      if (detail.scheduleRef !== row.scheduleRef || detail.version !== row.version) {
        setView("detail", null)
        setView("detailState", "stale")
        if (view.phase === "reviewing") setView("phase", "conflict")
        return
      }
      setView("detail", detail)
      setView("detailState", "ready")
      if (view.phase === "clean" && view.mode === "update")
        setView("change", { conditionRef: detail.conditionRef, recipeRef: detail.recipeRef,
          recurrence: detail.recurrence, timezone: detail.timezone })
      if (view.phase === "reviewing" && (view.mode === "update" || view.mode === "pause"))
        setView("phase", "conflict") // current revalidation invalidates a prior presentation-only review
    }).catch((error: unknown) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI66: schedule list/read failed", error instanceof Error ? error.name : "unknown")
      setView("state", "unavailable")
    })
  })

  const choose = (scheduleRef: string) => {
    if (busy() || view.phase === "outcome-unknown") return
    setView("selected", scheduleRef)
    setView("detail", null)
    setView("detailState", "unavailable")
    setView("change", blank())
    setView("mode", "inspect")
    setView("phase", "clean")
    // Selection remains local until I00 provides the exact F01 route builder.
    // No URL concatenation of the opaque ref is permitted in a leaf.
    setView("refresh", (value) => value + 1)
  }
  const begin = (mode: View["mode"]) => {
    if (busy() || view.phase === "outcome-unknown" || view.phase === "conflict") return
    if (mode === "update" && !liveDetail()) return
    if (mode === "pause" && !selected()) return
    if (mode === "create") setView("change", blank())
    if (mode === "update" && liveDetail()) {
      const detail = liveDetail()!
      setView("change", { conditionRef: detail.conditionRef, recipeRef: detail.recipeRef,
        recurrence: detail.recurrence, timezone: detail.timezone })
    }
    setView("phase", "clean")
    setView("mode", mode)
  }
  const edit = (key: keyof Change, value: string) => {
    if (!canChange()) return
    setView("change", key, value)
    setView("phase", "dirty")
  }
  const review = () => {
    if (!reviewValid() || !canChange()) return
    setView("phase", "reviewing")
  }
  const revise = () => {
    if (view.phase !== "reviewing") return
    setView("phase", "dirty")
  }
  const command = async () => {
    if (view.phase !== "reviewing" || !reviewValid() || !canChange()) return
    const active = owner.ready()
    if (!active) return
    const generation = owner.generation()
    const stamp = active.context.stamp
    const selectedRow = selected()
    const detail = liveDetail()
    // Guard against a list-only edit and against a detail/summary version race.
    if (view.mode === "update" && (!selectedRow || !detail || selectedRow.version !== detail.version)) return
    if (view.mode === "pause" && !selectedRow) return
    const request = { ...view.change }
    const mode = view.mode
    const abort = new AbortController()
    pending?.abort()
    pending = abort
    setView("phase", "submitting")
    const client = createSfRoutinesClient(active.transport)
    const options = { signal: abort.signal, idempotencyKey: crypto.randomUUID() }
    try {
      const result = mode === "create"
        ? await client["schedules.create"](request, options)
        : mode === "update" && detail
          ? await client["schedules.update"]({
            scheduleRef: detail.scheduleRef, expectedVersion: detail.version,
            recurrence: request.recurrence, timezone: request.timezone,
          }, options)
          : mode === "pause" && selectedRow
            ? await client["schedules.pause"]({
              scheduleRef: selectedRow.scheduleRef, expectedVersion: selectedRow.version,
            }, options) : null
      if (!result || abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      const state = n29ResponseState(result)
      if (result.kind === "transport-error" && result.reason === "outcome-unknown") {
        setView("phase", "outcome-unknown")
        setView("state", "outcome-unknown")
        return
      }
      if (result.kind !== "response" || result.body.status !== "ok") {
        if (state === "denied" || state === "session-expired") {
          setView(reconcile({ ...initial(props.route.kind), state }))
          return
        }
        setView("phase", state === "stale" || state === "conflict" ? "conflict" : "dirty")
        setView("state", state)
        console.error("N29 UI66: producer rejected schedule command", state)
        return
      }
      // The response confirms the command, not a current editable snapshot.
      setView("lastRef", result.body.value.scheduleRef)
      setView("selected", result.body.value.scheduleRef)
      setView("phase", "clean")
      setView("mode", "inspect")
      setView("detail", null)
      setView("detailState", "unavailable")
      setView("refresh", (value) => value + 1)
    } catch (error) {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI66: command response failed", error instanceof Error ? error.name : "unknown")
      setView("phase", "outcome-unknown")
      setView("state", "outcome-unknown")
    } finally {
      if (pending === abort) pending = undefined
    }
  }

  const readOccurrence = async () => {
    const active = owner.ready()
    const runRef = view.runRef.trim()
    if (!active || !runRef || !permitted("schedules.read-run")) return
    const generation = owner.generation()
    const stamp = active.context.stamp
    const abort = new AbortController()
    setView("run", null)
    setView("runState", "loading")
    try {
      const result = await createSfRoutinesClient(active.transport)["schedules.read-run"]({ runRef }, { signal: abort.signal })
      if (!n29SameAuthority(owner, generation, stamp) || view.runRef.trim() !== runRef) return
      const state = n29ResponseState(result)
      if (result.kind !== "response" || result.body.status !== "ok") {
        setView("runState", state)
        if (state === "unavailable") console.error("N29 UI66: authorized occurrence unavailable")
        return
      }
      const observed = result.body.value
      if (observed.runRef !== runRef || observed.principalRef !== stamp.principalRef || observed.projectId !== stamp.projectId) {
        setView("run", null)
        setView("runState", "stale")
        return
      }
      setView("run", { runRef, admission: observed.admission, resultRef: observed.resultRef, pending: observed.pending })
      setView("runState", "ready")
    } catch (error) {
      if (!n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI66: occurrence read failed", error instanceof Error ? error.name : "unknown")
      setView("runState", "unavailable")
    }
  }

  return (
    <SfPageFrame titleKey={n29Key("sf.ui66.title")} context={[]} tabs={[]} activeTab={null}
      density="comfortable" layout="work" onLayoutMode={() => undefined}
      primaryAction={permitted("schedules.create") ? {
        id: "new", labelKey: n29Key("sf.u34.new"), tone: "primary", disabled: busy() || view.phase === "outcome-unknown",
        busy: false, onInvoke: () => begin("create"),
      } : undefined}
      secondaryActions={[{
        id: "refresh", labelKey: n29Key("sf.u34.refresh"), tone: "secondary", disabled: busy(),
        busy: view.state === "loading", onInvoke: () => { setView("refresh", (value) => value + 1) },
      }]}
    >
      <section data-sf-wave="polish" class="sf-n29-schedules sf-workflow" data-sf-surface={props.surfaceId} data-state={state()} data-phase={view.phase}>
        <Show when={view.phase === "outcome-unknown"}>
          <p class="mx-error" role="alert">{t("sf.u34.unknown")}</p>
          <button type="button" class="mx-btn" onClick={() => {
            setView("phase", "conflict")
            setView("refresh", (value) => value + 1)
          }}>{t("sf.u34.refresh")}</button>
        </Show>
        <div class="sf-n29-schedule-layout">
          <div class="sf-n29-schedule-list">
            <h2>{t("sf.u34.list")}</h2>
            <Show when={view.state === "ready" || view.state === "empty"}>
              <label class="sf-n29-field">
                <span>{t("sf.u34.filter")}</span>
                <input type="search" value={view.filter} onInput={(event) => setView("filter", event.currentTarget.value)} />
              </label>
            </Show>
            <SfStatePanel state={state()} messageKey={n29StateKey(state())}
              onRetryRead={() => setView("refresh", (value) => value + 1)}>
              <Show when={state() === "ready"}>
                <div class="sf-n29-schedule-items">
                  <For each={visible()}>
                    {(row) => (
                      <article class="mx-card">
                        <h3><bdi>{row.scheduleRef}</bdi></h3>
                        <p>{t("sf.u34.state")}: <StatusText value={row.state} /></p>
                        <p>{t("sf.u34.version")}: {row.version}</p>
                        <button type="button" class="mx-btn" aria-pressed={view.selected === row.scheduleRef}
                          onClick={() => choose(row.scheduleRef)}>{t("sf.ui66.primary")}</button>
                        <Show when={permitted("schedules.pause") && row.state !== "paused"}>
                          <button type="button" class="mx-btn" onClick={() => {
                            choose(row.scheduleRef)
                            setView("mode", "pause")
                          }}>{t("sf.u34.pauseReview")}</button>
                        </Show>
                      </article>
                    )}
                  </For>
                </div>
              </Show>
            </SfStatePanel>
          </div>

          <div class="sf-n29-schedule-detail sf-section">
            <Show when={view.mode === "create" || view.mode === "update"}>
              <section class="mx-card" aria-label={t(view.mode === "create" ? "sf.u34.create" : "sf.u34.edit")}>
                <h2>{t(view.mode === "create" ? "sf.u34.create" : "sf.u34.edit")}</h2>
                <Show when={view.mode === "update" && !liveDetail()}>
                  <p role="status">{t("sf.u34.noDetail")}</p>
                </Show>
                <Show when={view.phase === "reviewing"} fallback={
                  <div class="sf-n29-fields sf-fields">
                    <For each={[
                      ["conditionRef", "sf.u34.condition"],
                      ["recipeRef", "sf.u34.recipe"],
                      ["recurrence", "sf.u34.recurrence"],
                      ["timezone", "sf.u34.timezone"],
                    ] as const}>
                      {([field, label]) => (
                        <label class="sf-n29-field">
                          <span>{t(label)}</span>
                          <input type="text" required value={view.change[field]}
                            readOnly={view.mode === "update" && (field === "conditionRef" || field === "recipeRef")}
                            disabled={busy() || view.phase === "outcome-unknown" || view.phase === "conflict"}
                            onInput={(event) => edit(field, event.currentTarget.value)} />
                        </label>
                      )}
                    </For>
                    <p>{t("sf.u34.inputRequired")}</p>
                    <button type="button" class="mx-btn primary" disabled={!reviewValid() || !canChange()} onClick={review}>
                      {t("sf.u34.submitReview")}
                    </button>
                  </div>
                }>
                  <div class="sf-n29-review sf-section" role="group" aria-label={t("sf.u34.submitReview")}>
                    <p>{t("sf.u34.reviewWarning")}</p>
                    <Show when={view.mode === "create"}>
                      <dl>
                        <For each={[
                          ["conditionRef", "sf.u34.condition"], ["recipeRef", "sf.u34.recipe"],
                          ["recurrence", "sf.u34.recurrence"], ["timezone", "sf.u34.timezone"],
                        ] as const}>
                          {([field, label]) => <div><dt>{t(label)}</dt><dd><bdi>{view.change[field]}</bdi></dd></div>}
                        </For>
                      </dl>
                    </Show>
                    <Show when={view.mode === "update" ? liveDetail() : undefined}>
                      {(detail) => <dl>
                        <div><dt>{t("sf.u34.version")}</dt><dd>{detail().version}</dd></div>
                        <div><dt>{t("sf.u34.details")}</dt><dd><bdi>{detail().scheduleRef}</bdi></dd></div>
                        <div><dt>{t("sf.u34.recurrence")}</dt><dd><bdi>{view.change.recurrence}</bdi></dd></div>
                        <div><dt>{t("sf.u34.timezone")}</dt><dd><bdi>{view.change.timezone}</bdi></dd></div>
                      </dl>}
                    </Show>
                    <button type="button" class="mx-btn primary" disabled={!reviewValid() || busy()}
                      onClick={() => { void command() }}>{t("sf.u34.confirm")}</button>
                    <button type="button" class="mx-btn" onClick={revise}>{t("sf.u34.cancelReview")}</button>
                  </div>
                </Show>
              </section>
            </Show>

            <Show when={view.mode === "pause" && selected()}>
              <section class="mx-card" aria-label={t("sf.u34.pauseReview")}>
                <h2>{t("sf.u34.pauseReview")}</h2>
                <p>{t("sf.u34.version")}: {selected()?.version}</p>
                <p><bdi>{selected()?.scheduleRef}</bdi></p>
                <Show when={view.phase !== "reviewing"} fallback={
                  <button type="button" class="mx-btn" onClick={() => { void command() }}
                    disabled={busy() || !reviewValid()}>{t("sf.u34.pause")}</button>
                }>
                  <button type="button" class="mx-btn" onClick={review}
                    disabled={!reviewValid() || !canChange()}>{t("sf.u34.submitReview")}</button>
                </Show>
              </section>
            </Show>

            <Show when={view.mode === "inspect"}>
              <section class="mx-card">
                <h2>{t("sf.u34.details")}</h2>
                <Show when={selected()} fallback={<SfStatePanel state="empty" messageKey={n29Key("sf.u34.noSchedule")} />}>
                  {(row) => (
                    <>
                      <p>{t("sf.u34.version")}: {row().version}</p>
                      <p>{t("sf.u34.state")}: <StatusText value={row().state} /></p>
                      <Show when={liveDetail()} fallback={
                        <p role="status">{t("sf.u34.noDetail")}</p>
                      }>
                        {(detail) => (
                          <dl class="sf-n29-read-values">
                            <div><dt>{t("sf.u34.recipe")}</dt><dd><bdi>{detail().recipeRef}</bdi></dd></div>
                            <div><dt>{t("sf.u34.condition")}</dt><dd><bdi>{detail().conditionRef}</bdi></dd></div>
                            <div><dt>{t("sf.u34.timezone")}</dt><dd><bdi>{detail().timezone}</bdi></dd></div>
                            <div><dt>{t("sf.u34.recurrence")}</dt><dd><bdi>{detail().recurrence}</bdi></dd></div>
                          </dl>
                        )}
                      </Show>
                      <button type="button" class="mx-btn" disabled={!liveDetail() || !permitted("schedules.update")}
                        onClick={() => begin("update")}>{t("sf.u34.edit")}</button>
                      <button type="button" class="mx-btn" disabled={!permitted("schedules.pause") || row().state === "paused"}
                        onClick={() => begin("pause")}>{t("sf.u34.pauseReview")}</button>
                    </>
                  )}
                </Show>
              </section>
            </Show>

            <section class="mx-card sf-n29-occurrences">
              <h2>{t("sf.u34.occurrences")}</h2>
              <label class="sf-n29-field"><span>{t("sf.u34.runRef")}</span>
                <input type="text" value={view.runRef} disabled={!permitted("schedules.read-run")}
                  onInput={(event) => setView("runRef", event.currentTarget.value)} />
              </label>
              <button type="button" class="mx-btn" disabled={!view.runRef.trim() || !permitted("schedules.read-run")}
                onClick={() => { void readOccurrence() }}>{t("sf.u34.readRun")}</button>
              <Show when={view.runState === "ready" && view.run}>
                <dl>
                  <div><dt>{t("sf.u34.runRef")}</dt><dd><bdi>{view.run?.runRef}</bdi></dd></div>
                  <div><dt>{t("sf.u34.state")}</dt><dd><StatusText value={view.run?.admission ?? ""} /></dd></div>
                  <div><dt>{t("sf.u34.result")}</dt><dd><bdi>{view.run?.resultRef ?? t("sf.u27.noResult")}</bdi></dd></div>
                </dl>
                <ul><For each={view.run?.pending ?? []}>{(reason) => <li><StatusText value={reason} /></li>}</For></ul>
              </Show>
              <Show when={view.runState !== "ready" && view.runState !== "empty"}>
                <SfStatePanel state={view.runState} messageKey={n29StateKey(view.runState)} />
              </Show>
            </section>
          </div>
        </div>
      </section>
    </SfPageFrame>
  )
}
