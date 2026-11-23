import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { createSfRoutinesClient } from "@orchestra/client/sucafina/routines"
import { createSfAnalysesClient } from "@orchestra/client/sucafina/analyses"
import { SfRoutines, SfRoutineResult } from "@orchestra/schema/sucafina/routines"
import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import {
  n29ContextState, n29Key, n29Permitted, n29ResponseState, n29SameAuthority,
  n29StateKey, useN29Copy,
} from "./ui"
import { StatusText } from "../../reviews/labels"
import "./catalog.css"
import "../../reviews/workflows.css"

type ChoicesBody = (typeof SfAnalyses.operations["intelligence.analysis.choices"]["output"])["Type"]
type CaseChoice = Extract<ChoicesBody, { status: "ok" }>["value"]["cases"][number]
type CatalogBody = (typeof SfRoutines.operations["routines.catalog"]["output"])["Type"]
type Recipe = Extract<CatalogBody, { status: "ok" }>["value"][number]
type Routine = (typeof SfRoutineResult)["Type"]
type PrepareInput = (typeof SfRoutines.operations["routines.prepare-admission"]["input"])["Type"]["input"]
type Phase = "clean" | "reviewing" | "submitting" | "outcome-unknown" | "conflict"
type View = {
  choices: readonly CaseChoice[]
  casesState: SfUiState
  caseIndex: number | null
  purpose: string
  recipes: readonly Recipe[]
  recipesState: SfUiState
  recipeIndex: number | null
  inputRefs: string
  parameters: string
  preparation: Routine | null
  admissionState: SfUiState
  phase: Phase
  requestError: string | null
}
const clean = (): View => ({
  choices: [], casesState: "loading", caseIndex: null, purpose: "",
  recipes: [], recipesState: "empty", recipeIndex: null, inputRefs: "", parameters: "{}",
  preparation: null, admissionState: "empty", phase: "clean", requestError: null,
})

// A typed JSON parameter map is an ORIGINAL BusinessPorts field. This local
// parser never widens the outer operation body. The source schema and original
// plan input digest remain the final authority for each inner JSON value.
function parseParameters(raw: string): PrepareInput["parameters"] | null {
  try {
    const decoded: unknown = JSON.parse(raw)
    if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) return null
    if (Object.keys(decoded).some((key) => key === "__proto__" || key === "prototype" || key === "constructor")) return null
    return decoded as PrepareInput["parameters"]
  } catch {
    return null
  }
}

function sameCase(a: CaseChoice["caseRef"], b: CaseChoice["caseRef"]) {
  return a.id === b.id && a.incarnation === b.incarnation && a.version === b.version
}

/** UI64 — original case/recipe/admission, never a synthetic Task or caseRef. */
export function SfRoutineCatalogView(props: SfSurfaceProps<"UI64">): JSX.Element {
  const owner = useSfContext()
  const { t } = useN29Copy()
  const [view, setView] = createStore<View>(clean())
  let pending: AbortController | undefined
  onCleanup(() => pending?.abort())

  const permitted = (id: "routines.catalog" | "routines.prepare-admission" | "routines.read-admission" | "routines.run") =>
    !!owner.ready() && n29Permitted(owner.ready()!.context, "routine-admission", id)
  const caseChoicesPermitted = () =>
    !!owner.ready() && n29Permitted(owner.ready()!.context, "analysis", "intelligence.analysis.choices")
  const caseChoice = createMemo(() => view.caseIndex === null ? undefined : view.choices[view.caseIndex])
  const recipe = createMemo(() => view.recipeIndex === null ? undefined : view.recipes[view.recipeIndex])
  const parsedParams = createMemo(() => parseParameters(view.parameters))
  const refs = createMemo(() => view.inputRefs.split(/\r?\n/).map((ref) => ref.trim()).filter(Boolean))
  const busy = () => view.phase === "submitting"
  const canPrepare = () => view.phase !== "outcome-unknown" && view.phase !== "conflict" && !busy()
    && !!caseChoice() && !!recipe() && !!parsedParams() && permitted("routines.prepare-admission")
  const admitted = () => view.preparation?.admission === "admitted"
    && !!view.preparation.admissionRef && Number.isInteger(view.preparation.admissionVersion)
  const currentCase = () => caseChoice()?.caseRef

  // Case authority is supplied by A15's current authorized case choices, not
  // by an arbitrary route ref or a user-entered case identity/version.
  createEffect(() => {
    const generation = owner.generation()
    const current = owner.ready()
    const contextualRef = props.route.query.case
    if (!current) {
      pending?.abort()
      setView(reconcile({ ...clean(), casesState: n29ContextState(owner.state().status) }))
      return
    }
    if (!caseChoicesPermitted()) {
      pending?.abort()
      const availability = current.context.availability.find((entry) =>
        entry.family === "intelligence" && entry.resource === "analysis")
      setView(reconcile({ ...clean(), casesState: availability?.state === "denied" ? "denied" : "unavailable" }))
      return
    }
    const abort = new AbortController()
    const stamp = current.context.stamp
    setView(reconcile({ ...clean(), casesState: "loading" }))
    onCleanup(() => abort.abort())
    void createSfAnalysesClient(current.transport)["intelligence.analysis.choices"]({}, { signal: abort.signal }).then((result) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      const next = n29ResponseState(result)
      if (result.kind !== "response" || result.body.status !== "ok") {
        setView(reconcile({ ...clean(), casesState: next }))
        if (next === "unavailable") console.error("N29 UI64: no authorized case choices")
        return
      }
      const choices = result.body.value.cases
      const index = contextualRef ? choices.findIndex((choice) => choice.caseRef.id === contextualRef) : -1
      setView("choices", choices)
      setView("caseIndex", index >= 0 ? index : null)
      setView("casesState", choices.length ? "ready" : "empty")
    }).catch((error: unknown) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI64: case choices read failed", error instanceof Error ? error.name : "unknown")
      setView(reconcile({ ...clean(), casesState: "unavailable" }))
    })
  })

  const chooseCase = (index: number | null) => {
    if (busy() || view.phase === "outcome-unknown") return
    setView("caseIndex", index)
    setView("recipes", [])
    setView("recipesState", "empty")
    setView("recipeIndex", null)
    setView("preparation", null)
    setView("admissionState", "empty")
    setView("phase", "clean")
    setView("requestError", null)
  }
  const chooseRecipe = (index: number | null) => {
    if (busy() || view.phase === "outcome-unknown") return
    setView("recipeIndex", index)
    setView("preparation", null)
    setView("admissionState", "empty")
    setView("phase", "clean")
  }
  const catalog = async () => {
    const current = owner.ready()
    const selected = currentCase()
    const purpose = view.purpose.trim()
    if (!current || !selected || !purpose || !permitted("routines.catalog")
      || busy() || view.phase === "outcome-unknown") return
    const abort = new AbortController()
    const generation = owner.generation()
    const stamp = current.context.stamp
    setView("recipesState", "loading")
    setView("recipes", [])
    setView("recipeIndex", null)
    try {
      const result = await createSfRoutinesClient(current.transport)["routines.catalog"]({
        caseRef: selected, input: { purpose },
      }, { signal: abort.signal })
      if (!n29SameAuthority(owner, generation, stamp) || !currentCase()
        || !sameCase(selected, currentCase()!) || view.purpose.trim() !== purpose) return
      const next = n29ResponseState(result)
      if (result.kind !== "response" || result.body.status !== "ok") {
        setView("recipesState", next)
        if (next === "denied" || next === "session-expired") setView(reconcile({ ...clean(), casesState: next }))
        return
      }
      setView("recipes", result.body.value)
      setView("recipesState", result.body.value.length ? "ready" : "empty")
      const route = props.route
      if (route.kind === "recipe") {
        const selectedRecipe = result.body.value.findIndex((item) => item.documentId === route.params.recipeRef)
        if (selectedRecipe >= 0) setView("recipeIndex", selectedRecipe)
      }
    } catch (error) {
      if (!n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI64: routine catalog failed", error instanceof Error ? error.name : "unknown")
      setView("recipesState", "unavailable")
    }
  }
  // A current choice reread must still include the exact case incarnation/version.
  const revalidateCase = async (current: NonNullable<ReturnType<typeof owner.ready>>,
    selected: CaseChoice["caseRef"], signal: AbortSignal) => {
    if (!caseChoicesPermitted()) return false
    const result = await createSfAnalysesClient(current.transport)["intelligence.analysis.choices"]({}, { signal })
    return result.kind === "response" && result.body.status === "ok"
      && result.body.value.cases.some((choice) => sameCase(choice.caseRef, selected))
  }
  const prepare = async () => {
    if (view.phase !== "reviewing" || !canPrepare()) return
    const current = owner.ready()
    const selected = currentCase()
    const selectedRecipe = recipe()
    const parameters = parsedParams()
    if (!current || !selected || !selectedRecipe || !parameters) return
    const generation = owner.generation()
    const stamp = current.context.stamp
    const abort = new AbortController()
    pending?.abort()
    pending = abort
    setView("phase", "submitting")
    try {
      if (!await revalidateCase(current, selected, abort.signal) || !n29SameAuthority(owner, generation, stamp)) {
        setView("phase", "conflict")
        return
      }
      const result = await createSfRoutinesClient(current.transport)["routines.prepare-admission"]({
        caseRef: selected,
        input: {
          publishedRecipeRef: selectedRecipe.documentId, // original publication documentId, no fabricated composite ref
          planRevisionId: selectedRecipe.planRevisionId,
          writeScope: [...selectedRecipe.writeScope],
          inputRefs: refs(),
          parameters,
        },
      }, { signal: abort.signal, idempotencyKey: crypto.randomUUID() })
      if (!n29SameAuthority(owner, generation, stamp) || abort.signal.aborted) return
      const next = n29ResponseState(result)
      if (result.kind === "transport-error" && result.reason === "outcome-unknown") {
        setView("phase", "outcome-unknown")
        setView("admissionState", "outcome-unknown")
        return
      }
      if (result.kind !== "response" || result.body.status !== "ok") {
        if (next === "denied" || next === "session-expired") {
          setView(reconcile({ ...clean(), casesState: next }))
          return
        }
        setView("phase", next === "stale" || next === "conflict" ? "conflict" : "clean")
        setView("admissionState", next)
        setView("requestError", result.kind === "response" && "reason" in result.body ? String(result.body.reason) : null)
        console.error("N29 UI64: original admission rejected", next)
        return
      }
      const admission = result.body.value
      setView("preparation", admission)
      setView("admissionState", admission.admission === "admitted" ? "ready" : "partial")
      setView("phase", "clean")
    } catch (error) {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI64: admission response failed", error instanceof Error ? error.name : "unknown")
      setView("phase", "outcome-unknown")
      setView("admissionState", "outcome-unknown")
    } finally {
      if (pending === abort) pending = undefined
    }
  }
  const readAdmission = async () => {
    const current = owner.ready()
    const selected = currentCase()
    const ref = view.preparation?.admissionRef ?? (props.route.kind === "admission" ? props.route.params.admissionRef : null)
    if (!current || !selected || !ref || !permitted("routines.read-admission")) return
    const generation = owner.generation()
    const stamp = current.context.stamp
    const abort = new AbortController()
    setView("admissionState", "loading")
    try {
      if (!await revalidateCase(current, selected, abort.signal) || !n29SameAuthority(owner, generation, stamp)) {
        setView("admissionState", "stale")
        return
      }
      const result = await createSfRoutinesClient(current.transport)["routines.read-admission"]({
        caseRef: selected, input: { admissionRef: ref },
      }, { signal: abort.signal })
      if (!n29SameAuthority(owner, generation, stamp) || !currentCase()
        || !sameCase(selected, currentCase()!) || currentAdmissionRef() !== ref) return
      const next = n29ResponseState(result)
      if (result.kind !== "response" || result.body.status !== "ok") {
        setView("admissionState", next)
        if (next === "denied" || next === "session-expired")
          setView(reconcile({ ...clean(), casesState: next }))
        return
      }
      if (result.body.value.admissionRef !== ref) {
        setView("admissionState", "stale")
        return
      }
      setView("preparation", result.body.value)
      setView("admissionState", result.body.value.admission === "admitted" ? "ready" : "partial")
      if (view.phase === "outcome-unknown") setView("phase", "conflict")
    } catch (error) {
      if (!n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI64: admission reread failed", error instanceof Error ? error.name : "unknown")
      setView("admissionState", "unavailable")
    }
  }
  const run = async () => {
    const current = owner.ready()
    const selected = currentCase()
    const admission = view.preparation
    if (!current || !selected || !admission || admission.admission !== "admitted"
      || !admission.admissionRef || !permitted("routines.run") || !permitted("routines.read-admission")
      || busy() || view.phase === "outcome-unknown" || view.phase === "conflict") return
    const generation = owner.generation()
    const stamp = current.context.stamp
    const abort = new AbortController()
    pending?.abort()
    pending = abort
    setView("phase", "submitting")
    try {
      if (!await revalidateCase(current, selected, abort.signal) || !n29SameAuthority(owner, generation, stamp)) {
        setView("phase", "conflict")
        return
      }
      const client = createSfRoutinesClient(current.transport)
      const read = await client["routines.read-admission"]({
        caseRef: selected, input: { admissionRef: admission.admissionRef },
      }, { signal: abort.signal })
      if (!n29SameAuthority(owner, generation, stamp)) return
      if (read.kind !== "response" || read.body.status !== "ok" ||
        read.body.value.admission !== "admitted" ||
        read.body.value.admissionRef !== admission.admissionRef ||
        read.body.value.admissionVersion !== admission.admissionVersion) {
        setView("phase", "conflict")
        setView("admissionState", "stale")
        return
      }
      const result = await client["routines.run"]({
        caseRef: selected,
        input: { admissionRef: admission.admissionRef, expectedAdmissionVersion: admission.admissionVersion, caseRef: selected },
      }, { signal: abort.signal, idempotencyKey: crypto.randomUUID() })
      if (!n29SameAuthority(owner, generation, stamp) || abort.signal.aborted) return
      const next = n29ResponseState(result)
      if (result.kind === "transport-error" && result.reason === "outcome-unknown") {
        setView("phase", "outcome-unknown")
        setView("admissionState", "outcome-unknown")
        return
      }
      if (result.kind !== "response" || result.body.status !== "ok") {
        setView("phase", next === "stale" || next === "conflict" ? "conflict" : "clean")
        setView("admissionState", next)
        if (next === "denied" || next === "session-expired")
          setView(reconcile({ ...clean(), casesState: next }))
        return
      }
      // A runRef is proof of a submitted native run, not progress/completion.
      setView("preparation", result.body.value)
      setView("admissionState", "ready")
      setView("phase", "clean")
    } catch (error) {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI64: run response failed", error instanceof Error ? error.name : "unknown")
      setView("phase", "outcome-unknown")
      setView("admissionState", "outcome-unknown")
    } finally {
      if (pending === abort) pending = undefined
    }
  }

  const choose = () => {
    if (!canPrepare()) return
    setView("phase", "reviewing")
  }
  const state = (): SfUiState => view.casesState
  const currentAdmissionRef = () => view.preparation?.admissionRef ??
    (props.route.kind === "admission" ? props.route.params.admissionRef : null)

  return (
    <SfPageFrame titleKey={n29Key("sf.ui64.title")} context={[]} tabs={[]} activeTab={null}
      density="comfortable" layout="work" onLayoutMode={() => undefined}
      primaryAction={{
        id: "prepare", labelKey: n29Key("sf.ui64.primary"), tone: "primary",
        disabled: !canPrepare() || view.phase !== "clean",
        busy: busy(), onInvoke: choose,
      }}
      secondaryActions={[{
        id: "refresh", labelKey: n29Key("sf.u27.recheck"), tone: "secondary", disabled: busy(),
        busy: view.casesState === "loading", onInvoke: () => { void owner.reload() },
      }]}
    >
      <section data-sf-wave="polish" class="sf-n29-routines sf-workflow" data-sf-surface={props.surfaceId} data-state={state()} data-phase={view.phase}>
        <Show when={view.phase === "outcome-unknown"}>
          <p role="alert" class="mx-error">{t("sf.u27.unknown")}</p>
        </Show>
        <SfStatePanel state={state()} messageKey={n29StateKey(state())}
          onRetryRead={() => { void owner.reload() }}>
          <div class="sf-n29-catalog-sections">
            <section class="mx-card" aria-label={t("sf.u27.case")}>
              <h2>{t("sf.u27.case")}</h2>
              <label class="sf-n29-field">
                <span>{t("sf.u27.chooseCase")}</span>
                <select value={view.caseIndex === null ? "" : String(view.caseIndex)}
                  disabled={busy() || view.phase === "outcome-unknown"}
                  onChange={(event) => chooseCase(event.currentTarget.value === "" ? null : Number(event.currentTarget.value))}>
                  <option value="">{t("sf.u27.chooseCase")}</option>
                  <For each={view.choices}>
                    {(option, index) => <option value={index()}>
                      {option.label} ({option.caseRef.version})
                    </option>}
                  </For>
                </select>
              </label>
              <Show when={!caseChoice()}>
                <p role="status">{t("sf.u27.noCase")}</p>
              </Show>
            </section>
            <section class="mx-card" aria-label={t("sf.u27.purpose")}>
              <h2>{t("sf.u27.purpose")}</h2>
              <label class="sf-n29-field">
                <span>{t("sf.u27.purpose")}</span>
                <input type="text" value={view.purpose} disabled={!caseChoice() || busy() || view.phase === "outcome-unknown"}
                  onInput={(event) => {
                    setView("purpose", event.currentTarget.value)
                    setView("recipes", [])
                    setView("recipeIndex", null)
                    setView("recipesState", "empty")
                  }} />
              </label>
              <button type="button" class="mx-btn" disabled={!caseChoice() || !view.purpose.trim() || !permitted("routines.catalog")
                || busy() || view.phase === "outcome-unknown"}
                onClick={() => { void catalog() }}>{t("sf.u27.loadRecipes")}</button>
            </section>
            <section class="mx-card" aria-label={t("sf.u27.recipe")}>
              <h2>{t("sf.u27.recipe")}</h2>
              <Show when={view.recipesState === "ready"} fallback={
                <SfStatePanel
                  state={view.recipesState}
                  messageKey={view.recipesState === "empty" ? n29Key("sf.u27.noRecipes") : n29StateKey(view.recipesState)}
                />
              }>
                <label class="sf-n29-field">
                  <span>{t("sf.u27.selectRecipe")}</span>
                  <select value={view.recipeIndex === null ? "" : String(view.recipeIndex)}
                    disabled={busy() || view.phase === "outcome-unknown"}
                    onChange={(event) => chooseRecipe(event.currentTarget.value === "" ? null : Number(event.currentTarget.value))}>
                    <option value="">{t("sf.u27.selectRecipe")}</option>
                    <For each={view.recipes}>
                      {(item, index) => <option value={index()}>{item.title} ({item.publishedVersion})</option>}
                    </For>
                  </select>
                </label>
                <Show when={recipe()}>
                  {(item) => <>
                    <p>{t("sf.u27.version")}: <bdi>{item().publishedVersion}</bdi></p>
                    <p>{t("sf.u27.scope")}: <bdi>{item().writeScope.join(", ")}</bdi></p>
                  </>}
                </Show>
              </Show>
            </section>
            <section class="mx-card" aria-label={t("sf.u27.inputs")}>
              <h2>{t("sf.u27.inputs")}</h2>
              <label class="sf-n29-field">
                <span>{t("sf.u27.inputs")}</span>
                <textarea rows={3} value={view.inputRefs} disabled={!recipe() || busy() || view.phase === "outcome-unknown"}
                  onInput={(event) => setView("inputRefs", event.currentTarget.value)} />
              </label>
              <label class="sf-n29-field">
                <span>{t("sf.u27.parameters")}</span>
                <textarea rows={4} value={view.parameters} aria-invalid={parsedParams() === null}
                  disabled={!recipe() || busy() || view.phase === "outcome-unknown"}
                  onInput={(event) => setView("parameters", event.currentTarget.value)} />
              </label>
            </section>
            <section class="mx-card" aria-label={t("sf.u27.readiness")}>
              <h2>{t("sf.u27.readiness")}</h2>
              <p>{t("sf.u27.reviewSummary")}</p>
              <Show when={view.requestError}><p role="status">{t(n29StateKey(view.admissionState))}</p></Show>
              <Show when={view.phase === "reviewing"}>
                <div class="sf-n29-review sf-section" role="group" aria-label={t("sf.u27.review")}>
                  <h3>{t("sf.u27.review")}</h3>
                  <p>{t("sf.u27.case")}: <bdi>{currentCase()?.id}</bdi></p>
                  <p>{t("sf.u27.recipe")}: <bdi>{recipe()?.documentId}</bdi></p>
                  <p>{t("sf.u27.version")}: <bdi>{recipe()?.publishedVersion}</bdi></p>
                  <p>{t("sf.u27.scope")}: <bdi>{recipe()?.writeScope.join(", ")}</bdi></p>
                  <p>{t("sf.u27.inputs")}: <bdi>{refs().join(", ")}</bdi></p>
                  <p>{t("sf.u44.incarnation")}: <bdi>{currentCase()?.incarnation}</bdi></p>
                  <p>{t("sf.u32.sourceVersion")}: <bdi>{recipe()?.planRevisionId}</bdi></p>
                  <p>{t("sf.u27.parameters")}: <bdi>{view.parameters}</bdi></p>
                  <button type="button" class="mx-btn primary" disabled={!canPrepare()}
                    onClick={() => { void prepare() }}>{t("sf.u27.prepare")}</button>
                  <button type="button" class="mx-btn" onClick={() => setView("phase", "clean")}>
                    {t("sf.common.back")}</button>
                </div>
              </Show>
              <Show when={currentAdmissionRef()}>
                <div class="sf-n29-result sf-section">
                  <p>{t("sf.u27.admission")}: <bdi>{currentAdmissionRef()}</bdi></p>
                  <button type="button" class="mx-btn" disabled={!currentCase() || !permitted("routines.read-admission")}
                    onClick={() => { void readAdmission() }}>{t("sf.u27.refresh")}</button>
                </div>
              </Show>
              <Show when={view.preparation}>
                {(result) => (
                  <dl class="sf-n29-facts">
                    <div><dt>{t("sf.u27.status")}</dt><dd><StatusText value={result().admission} /></dd></div>
                    <div><dt>{t("sf.u27.correlation")}</dt><dd><bdi>{result().correlationId}</bdi></dd></div>
                    <div><dt>{t("sf.u27.admissionVersion")}</dt><dd>{result().admissionVersion}</dd></div>
                    <div><dt>{t("sf.u27.runRef")}</dt><dd><bdi>{result().runRef ?? t("sf.u27.runningUnverified")}</bdi></dd></div>
                    <div><dt>{t("sf.u27.resultRef")}</dt><dd><bdi>{result().resultRef ?? t("sf.u27.noResult")}</bdi></dd></div>
                  </dl>
                )}
              </Show>
              <Show when={view.preparation && view.preparation.pending.length}>
                <div role="status"><h3>{t("sf.u27.pending")}</h3>
                  <ul><For each={view.preparation?.pending ?? []}>{(item) => <li><StatusText value={item} /></li>}</For></ul>
                </div>
              </Show>
              <Show when={view.admissionState === "partial"}>
                <p role="status">{t("sf.u27.needsInput")}</p>
              </Show>
              <Show when={admitted() && !view.preparation?.runRef}>
                <button type="button" class="mx-btn primary" disabled={!permitted("routines.run")
                  || !permitted("routines.read-admission") || busy() || view.phase === "outcome-unknown"}
                  onClick={() => { void run() }}>{t("sf.u27.run")}</button>
              </Show>
              <Show when={view.preparation?.runRef}>
                <p role="status">{t("sf.u27.runningUnverified")}</p>
              </Show>
              <p>{t("sf.u27.cancelUnavailable")}</p>
            </section>
          </div>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
