import { createEffect, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { createSfRoutinesClient } from "@orchestra/client/sucafina/routines"
import { createSfAnalysesClient } from "@orchestra/client/sucafina/analyses"
import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import { SfRoutineResult, SfRoutines } from "@orchestra/schema/sucafina/routines"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { SfPageFrame } from "../../shared/frame"
import { SfRunState, SfStatePanel, type SfRunPhase } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import {
  n29ContextState, n29Key, n29Permitted, n29ResponseState,
  n29SameAuthority, n29StateKey, useN29Copy,
} from "../catalog/ui"
import "./runs.css"

type Routine = (typeof SfRoutineResult)["Type"]
type Projection = Extract<(typeof SfRoutines.operations["projection.routine"]["output"])["Type"], { status: "ok" }>
type Proof = NonNullable<Projection["proof"]>
type Cases = Extract<(typeof SfAnalyses.operations["intelligence.analysis.choices"]["output"])["Type"], { status: "ok" }>["value"]["cases"]
type View = {
  state: SfUiState
  result: Routine | null
  proof: Proof | null
  caseChoices: Cases
  caseIndex: number | null
  caseState: SfUiState
  mode: "projection" | "original"
}
const initial = (): View => ({
  state: "loading", result: null, proof: null, caseChoices: [], caseIndex: null, caseState: "loading", mode: "projection",
})

/** UI65 — source-backed admission plus independently revalidated native C08
 * execution and output. Unverified execution never masquerades as completion.
 * No cancellation is invented: the installed native routine port has no
 * authorized cancel command, unlike the independent analysis producer.
 */
export function SfRoutineRunView(props: SfSurfaceProps<"UI65">): JSX.Element {
  const owner = useSfContext()
  const { t } = useN29Copy()
  const [view, setView] = createStore<View>(initial())
  const runRef = () => props.route.kind === "entry" ? props.route.params.runRef : null
  const caseChoice = () => view.caseIndex === null ? null : view.caseChoices[view.caseIndex]
  const permitted = (id: "projection.routine" | "routines.read-run") => {
    const active = owner.ready()
    if (!active) return false
    return n29Permitted(active.context, "routine-runs", id)
  }
  const canFallback = () => {
    const active = owner.ready()
    return !!active && n29Permitted(active.context, "routine-runs", "routines.read-run")
      && n29Permitted(active.context, "analysis", "intelligence.analysis.choices")
  }

  createEffect(() => {
    const generation = owner.generation()
    const active = owner.ready()
    const reference = runRef()
    const contextualCase = props.route.query.case
    if (!active) {
      setView(reconcile({ ...initial(), state: n29ContextState(owner.state().status) }))
      return
    }
    if (!reference) {
      setView(reconcile({ ...initial(), state: "empty" }))
      return
    }
    const abort = new AbortController()
    const stamp = active.context.stamp
    onCleanup(() => abort.abort())
    setView(reconcile({ ...initial(), state: permitted("projection.routine") ? "loading" : "unavailable" }))
    const routines = createSfRoutinesClient(active.transport)
    if (permitted("projection.routine")) {
      void routines["projection.routine"]({ runRef: reference }, { signal: abort.signal }).then((response) => {
        if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
        const state = n29ResponseState(response)
        if (response.kind !== "response" || response.body.status !== "ok") {
          setView("state", state)
          if (state === "denied" || state === "session-expired") setView({ result: null, proof: null })
          return
        }
        const run = response.body.value
        if (run.runRef !== reference || run.principalRef !== stamp.principalRef || run.projectId !== stamp.projectId) {
          setView(reconcile({ ...initial(), state: "stale" }))
          return
        }
        const proof = response.body.proof ?? null
        if (proof?.execution && proof.execution.runRef !== reference ||
          proof?.output && (proof.verifier !== "verified" || proof.output.runRef !== reference ||
            proof.output.resultRef !== run.resultRef || proof.output.outputDigest !== proof.execution?.outputDigest)) {
          setView(reconcile({ ...initial(), state: "stale" }))
          return
        }
        setView({ result: run, proof, state: "ready" })
        setView("mode", "projection")
      }).catch((error: unknown) => {
        if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
        console.error("N29 UI65: routine projection failed", error instanceof Error ? error.name : "unknown")
        setView("state", "unavailable")
      })
    }
    if (!canFallback()) {
      setView("caseState", "unavailable")
      return
    }
    void createSfAnalysesClient(active.transport)["intelligence.analysis.choices"]({}, { signal: abort.signal }).then((response) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        setView("caseState", n29ResponseState(response))
        return
      }
      const choices = response.body.value.cases
      const selected = contextualCase ? choices.findIndex((choice) => choice.caseRef.id === contextualCase) : -1
      setView("caseChoices", choices)
      setView("caseIndex", selected >= 0 ? selected : null)
      setView("caseState", choices.length ? "ready" : "empty")
    }).catch((error: unknown) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI65: authorized case choices failed", error instanceof Error ? error.name : "unknown")
      setView("caseState", "unavailable")
    })
  })

  const readOriginal = async () => {
    const active = owner.ready()
    const reference = runRef()
    const selected = caseChoice()
    if (!active || !reference || !selected || !permitted("routines.read-run")) return
    const generation = owner.generation()
    const stamp = active.context.stamp
    const abort = new AbortController()
    setView({ state: "loading", proof: null })
    try {
      const fresh = await createSfAnalysesClient(active.transport)["intelligence.analysis.choices"]({}, { signal: abort.signal })
      if (!n29SameAuthority(owner, generation, stamp)) return
      if (fresh.kind !== "response" || fresh.body.status !== "ok" ||
        !fresh.body.value.cases.some((choice) =>
          choice.caseRef.id === selected.caseRef.id
          && choice.caseRef.incarnation === selected.caseRef.incarnation
          && choice.caseRef.version === selected.caseRef.version)) {
        setView("state", "stale")
        setView("result", null)
        return
      }
      const response = await createSfRoutinesClient(active.transport)["routines.read-run"]({
        caseRef: selected.caseRef, input: { runRef: reference },
      }, { signal: abort.signal })
      if (!n29SameAuthority(owner, generation, stamp) || !caseChoice()
        || caseChoice()!.caseRef.id !== selected.caseRef.id
        || caseChoice()!.caseRef.incarnation !== selected.caseRef.incarnation
        || caseChoice()!.caseRef.version !== selected.caseRef.version) return
      const state = n29ResponseState(response)
      if (response.kind !== "response" || response.body.status !== "ok") {
        setView("result", null)
        setView("state", state)
        return
      }
      const run = response.body.value
      if (run.runRef !== reference || run.principalRef !== stamp.principalRef || run.projectId !== stamp.projectId) {
        setView("result", null)
        setView("state", "stale")
        return
      }
      setView({ result: run, state: "ready", mode: "original", proof: null })
    } catch (error) {
      if (!n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI65: original run read failed", error instanceof Error ? error.name : "unknown")
      setView("state", "unavailable")
    }
  }
  const runTask = () => {
    const result = view.result
    if (!result) return undefined
    return {
      kind: "routine" as const,
      recipeRef: result.documentId as SfRef, // the original producer's documentId
      title: { kind: "data" as const, text: result.documentId },
      recipeVersion: result.publishedVersion,
    }
  }
  const identity = () => {
    const result = view.result
    const task = runTask()
    if (!result || !task || !result.runRef || result.admission !== "admitted") return null
    return { kind: "run" as const, runRef: result.runRef as SfRef, task, inputVersion: result.admissionVersion }
  }
  const nativeRunPhase = (): SfRunPhase => {
    if (view.mode !== "projection" || !view.proof?.execution) return "ready"
    const { state } = view.proof.execution
    if (state === "completed") return view.proof.verifier === "verified" ? "complete" : "unavailable"
    if (state === "cancelled") return "cancelled"
    if (state === "failed") return "failed"
    if (state === "preparing") return "running"
    return "queued"
  }

  return (
    <SfPageFrame titleKey={n29Key("sf.ui65.title")} context={[]} tabs={[]} activeTab={null}
      density="comfortable" layout="reading" onLayoutMode={() => undefined}
      secondaryActions={[{
        id: "refresh", labelKey: n29Key("sf.u27.refresh"), tone: "secondary",
        disabled: !owner.ready(), busy: view.state === "loading",
        onInvoke: () => { void owner.reload() },
      }]}
    >
      <section class="sf-n29-run" data-sf-surface={props.surfaceId} data-state={view.state}>
        <Show when={!runRef()}><p>{t("sf.u27.noRun")}</p></Show>
        <Show when={canFallback() && runRef()}>
          <div class="mx-card">
            <label class="sf-n29-field">
              <span>{t("sf.u27.chooseCase")}</span>
              <select value={view.caseIndex === null ? "" : String(view.caseIndex)}
                onChange={(event) => setView("caseIndex",
                  event.currentTarget.value === "" ? null : Number(event.currentTarget.value))}>
                <option value="">{t("sf.u27.chooseCase")}</option>
                <For each={view.caseChoices}>
                  {(choice, index) => <option value={index()}>
                    {choice.label} ({choice.caseRef.version})
                  </option>}
                </For>
              </select>
            </label>
            <button type="button" class="mx-btn" disabled={!caseChoice() || view.state === "loading"}
              onClick={() => { void readOriginal() }}>{t("sf.u27.refresh")}</button>
          </div>
        </Show>
        <SfStatePanel state={view.state} messageKey={n29StateKey(view.state)}
          onRetryRead={() => { void owner.reload() }}>
          <Show when={view.result}>
            {(source) => (
              <div class="sf-n29-run-sections">
                <section class="mx-card" aria-label={t("sf.u27.recipe")}>
                  <h2>{t("sf.u27.recipe")}</h2>
                  <p><bdi>{source().documentId}</bdi></p>
                  <p>{t("sf.u27.version")}: <bdi>{source().publishedVersion}</bdi></p>
                </section>
                <section class="mx-card" aria-label={t("sf.u27.status")}>
                  <h2>{t("sf.u27.status")}</h2>
                  <Show when={identity()} fallback={
                    <SfRunState identity={{ kind: "unadmitted", task: runTask() }}
                      state={source().admission === "admitted" ? "ready" : "needs-input"}
                      actions={[]} onOpen={() => undefined} />
                  }>
                    {(run) => <SfRunState identity={run()} state={nativeRunPhase()}
                      actions={[]} onOpen={() => undefined} />}
                  </Show>
                  <p>{t("sf.u27.admission")}: <bdi>{source().admission}</bdi></p>
                  <p>{t("sf.u27.correlation")}: <bdi>{source().correlationId}</bdi></p>
                  <Show when={source().runRef}>
                    <p>{t("sf.u27.runRef")}: <bdi>{source().runRef}</bdi></p>
                  </Show>
                  <Show when={view.proof?.verifier !== "verified"}>
                    <p>{t("sf.u27.runningUnverified")}</p>
                  </Show>
                </section>
                <section class="mx-card" aria-label={t("sf.u27.execution")} data-sf-native-execution data-verifier={view.proof?.verifier ?? "unavailable"}>
                  <h2>{t("sf.u27.execution")}</h2>
                  <Show when={view.mode === "projection" && view.proof}
                    fallback={<p>{t("sf.u27.nativeProofUnavailable")}</p>}>
                    {(proof) => <>
                      <p><strong>{t("sf.u27.verifier")}:</strong> <bdi>{proof().verifier}</bdi></p>
                      <Show when={proof().execution} fallback={<p>{t("sf.u27.nativeProofUnavailable")}</p>}>
                        {(receipt) => <>
                          <p><strong>{t("sf.u27.phase")}:</strong> <bdi>{receipt().state}</bdi></p>
                          <p><strong>{t("sf.u27.revision")}:</strong> <bdi>{receipt().revision}</bdi></p>
                        </>}
                      </Show>
                      <Show when={proof().reason}><p role="status"><bdi>{proof().reason}</bdi></p></Show>
                      <Show when={proof().verifier === "verified" && proof().output}>
                        {(output) => <>
                          <p><strong>{t("sf.u27.outputDigest")}:</strong> <code><bdi>{output().outputDigest}</bdi></code></p>
                          <p><strong>{t("sf.u27.resultRef")}:</strong> <bdi>{output().resultRef}</bdi></p>
                          <p><strong>{t("sf.u27.output")}:</strong></p>
                          <pre class="sf-n29-run-output">{JSON.stringify(output().content, null, 2)}</pre>
                        </>}
                      </Show>
                    </>}
                  </Show>
                  <p>{t("sf.u27.cancelUnavailable")}</p>
                </section>
                <section class="mx-card" aria-label={t("sf.u27.pending")}>
                  <h2>{t("sf.u27.pending")}</h2>
                  <Show when={source().pending.length} fallback={<p>{t("sf.common.empty")}</p>}>
                    <ul><For each={source().pending}>{(item) => <li><bdi>{item}</bdi></li>}</For></ul>
                  </Show>
                </section>
                <section class="mx-card" aria-label={t("sf.u27.resultRef")}>
                  <h2>{t("sf.u27.resultRef")}</h2>
                  <p><bdi>{source().resultRef ?? t("sf.u27.noResult")}</bdi></p>
                  <Show when={view.proof?.verifier !== "verified"}>
                    <p>{t("sf.u27.runningUnverified")}</p>
                  </Show>
                </section>
                <section class="mx-card" aria-label={t("sf.u27.evidence")}>
                  <h2>{t("sf.u27.evidence")}</h2>
                  <ul>
                    <For each={source().sourceRefs}>
                      {(reference) => (
                        <li><bdi>{reference.surface}</bdi> · <bdi>{reference.type}</bdi> · <bdi>{reference.id}</bdi> · {reference.version}</li>
                      )}
                    </For>
                  </ul>
                </section>
              </div>
            )}
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
