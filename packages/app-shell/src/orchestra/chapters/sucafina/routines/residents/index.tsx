import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { createSfAnalysesClient } from "@orchestra/client/sucafina/analyses"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfAnalyses, SfResidentCatalog } from "@orchestra/schema/sucafina/analyses"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import type { SfUiState } from "../../shared/frame"
import { n29ContextState, n29Key, n29Permitted, n29ResponseState, n29SameAuthority, n29StateKey, useN29Copy } from "../catalog/ui"
import { operationGranted, StatusText, WhenText } from "../../reviews/labels"
import "./residents.css"

type Profile = (typeof SfResidentCatalog)["Type"]["profiles"][number]
type Cases = Extract<(typeof SfAnalyses.operations["intelligence.analysis.choices"]["output"])["Type"], { status: "ok" }>["value"]["cases"]
type Case = Cases[number]
type Run = Extract<(typeof SfAnalyses.operations["intelligence.analysis.read"]["output"])["Type"], { status: "ok" }>["value"]
type Output = Extract<(typeof SfAnalyses.operations["intelligence.analysis.output"]["output"])["Type"], { status: "ok" }>["value"]
type CaseProjection = Extract<(typeof SfDecisions.operations["projection.case"]["output"])["Type"], { status: "ok" }>["value"]["projection"]
type HumanChoice = CaseProjection["case"]["choices"][number]
type LedgerEvent = CaseProjection["case"]["ledger"][number]
const sameCaseHistory = (left: Case["caseRef"], right: Case["caseRef"]) =>
  left.id === right.id && left.incarnation === right.incarnation &&
  left.version > 0 && left.version <= right.version
const caseKey = (item: Case["caseRef"]) => JSON.stringify([item.id, item.incarnation, item.version])
const caseRouteRef = (item: Case["caseRef"]) => `case:${encodeURIComponent(item.id)}:${encodeURIComponent(item.incarnation)}`

type View = {
  state: SfUiState
  profiles: readonly Profile[]
  search: string
  selected: string | null
  reason: string | null
  cases: Cases
  caseKey: string
  caseState: SfUiState
  run: Run | null
  runState: SfUiState
  output: Output | null
  outputState: SfUiState
  choice: HumanChoice | null
  ledger: readonly LedgerEvent[]
  choiceState: SfUiState
}
const empty = (): View => ({
  state: "loading", profiles: [], search: "", selected: null, reason: null,
  cases: [], caseKey: "", caseState: "loading",
  run: null, runState: "empty", output: null, outputState: "empty",
  choice: null, ledger: [], choiceState: "empty",
})

/** UI70 — installation is inventory, not execution proof. A separate
 * original producer read supplies attributed native analysis runs, an
 * independent verified contribution and a current human decision projection.
 * No cross-run or decision causality is invented from matching timestamps.
 */
export function SfResidentsView(props: SfSurfaceProps<"UI70">): JSX.Element {
  const owner = useSfContext()
  const { t } = useN29Copy()
  const [view, setView] = createStore<View>(empty())

  createEffect(() => {
    const generation = owner.generation()
    const current = owner.ready()
    if (!current) {
      setView(reconcile({ ...empty(), state: n29ContextState(owner.state().status) }))
      return
    }
    const availability = current.context.availability.find((entry) =>
      entry.family === "intelligence" && entry.resource === "residents")
    if (!n29Permitted(current.context, "residents", "projection.residents")) {
      setView(reconcile({ ...empty(), state: availability?.state === "denied" ? "denied" : "unavailable" }))
      return
    }
    const abort = new AbortController()
    const stamp = current.context.stamp
    setView(reconcile({ ...empty(), state: "loading" }))
    onCleanup(() => abort.abort())
    void createSfAnalysesClient(current.transport)["projection.residents"]({}, { signal: abort.signal }).then((response) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      const next = n29ResponseState(response)
      if (response.kind !== "response" || response.body.status !== "ok") {
        setView(reconcile({ ...empty(), state: next }))
        if (next === "unavailable") console.error("N29 UI70: authorized resident read unavailable")
        return
      }
      const returned = response.body.context
      if (returned.hostId !== stamp.hostId || returned.projectId !== stamp.projectId
        || returned.installationId !== stamp.installationId || returned.principalRef !== stamp.principalRef
        || returned.policyVersion !== stamp.policyVersion || returned.accessRevision !== stamp.accessRevision) {
        setView(reconcile({ ...empty(), state: "stale" }))
        return
      }
      const profiles = response.body.value.profiles
      setView("profiles", profiles)
      setView("state", profiles.length ? "ready" : "empty")
      setView("reason", null)
    }).catch((error: unknown) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI70: resident projection request failed", error instanceof Error ? error.name : "unknown")
      setView(reconcile({ ...empty(), state: "unavailable" }))
    })
  })

  // A resident does not own a universal "latest" run. User chooses the
  // currently authorized decision case before listing case-scoped executions.
  createEffect(() => {
    const generation = owner.generation()
    const current = owner.ready()
    if (!current || !n29Permitted(current.context, "analysis", "intelligence.analysis.choices")) {
      setView({ cases: [], caseKey: "", caseState: current ? "unavailable" : n29ContextState(owner.state().status) })
      return
    }
    const abort = new AbortController()
    const stamp = current.context.stamp
    setView({ cases: [], caseKey: "", caseState: "loading" })
    onCleanup(() => abort.abort())
    void createSfAnalysesClient(current.transport)["intelligence.analysis.choices"]({}, { signal: abort.signal }).then((result) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        setView({ cases: [], caseKey: "", caseState: n29ResponseState(result) })
        return
      }
      const cases = result.body.value.cases
      setView({ cases, caseKey: "", caseState: cases.length ? "ready" : "empty" })
    }).catch((error: unknown) => {
      if (abort.signal.aborted || !n29SameAuthority(owner, generation, stamp)) return
      console.error("N29 UI70: authorized case discovery failed", error instanceof Error ? error.name : "unknown")
      setView({ cases: [], caseKey: "", caseState: "unavailable" })
    })
  })

  const selectedCase = () => view.cases.find((item) => caseKey(item.caseRef) === view.caseKey)
  const selectedProfile = () => view.profiles.find((item) => item.id === view.selected)

  createEffect(() => {
    const generation = owner.generation()
    const current = owner.ready()
    const profile = selectedProfile()
    const chosen = selectedCase()
    if (!current || !profile || !chosen) {
      setView({ run: null, runState: "empty", output: null, outputState: "empty",
        choice: null, ledger: [], choiceState: "empty" })
      return
    }
    const abort = new AbortController()
    const stamp = current.context.stamp
    const originalCase = chosen.caseRef
    const selectedKey = caseKey(originalCase)
    const valid = () => !abort.signal.aborted && n29SameAuthority(owner, generation, stamp) &&
      view.selected === profile.id && view.caseKey === selectedKey
    onCleanup(() => abort.abort())
    const decisionGranted = operationGranted(current.context, "projection.case")
    setView({ run: null, runState: "loading", output: null, outputState: "empty",
      choice: null, ledger: [], choiceState: decisionGranted ? "loading" : "unavailable" })

    const readRun = async () => {
      if (!n29Permitted(current.context, "analysis", "intelligence.analysis.list") ||
          !n29Permitted(current.context, "analysis", "intelligence.analysis.read")) {
        if (valid()) setView("runState", "unavailable")
        return
      }
      const client = createSfAnalysesClient(current.transport)
      const history = await client["intelligence.analysis.list"]({ caseRef: originalCase }, { signal: abort.signal })
      if (!valid()) return
      if (history.kind !== "response" || history.body.status !== "ok") {
        setView("runState", n29ResponseState(history))
        return
      }
      // Run attribution must be an exact producer-owned profile/version/case
      // tuple; arbitrary runRef prefixes and resident IDs prove nothing.
      const matching = history.body.value.filter((run) =>
        run.profileId === profile.id && run.profileVersion === profile.version &&
        !!run.caseRef && sameCaseHistory(run.caseRef, originalCase) &&
        !!run.updatedAt && Number.isFinite(Date.parse(run.updatedAt)))
        .sort((a, b) => Date.parse(b.updatedAt ?? "") - Date.parse(a.updatedAt ?? ""))
      if (!matching.length) { setView("runState", "empty"); return }
      // If two runs have identical recorded timestamps there is no proven
      // latest run. The UI must ask for fresh evidence, not pick an arbitrary ID.
      if (matching.length > 1 && matching[0]?.updatedAt === matching[1]?.updatedAt) {
        setView("runState", "stale")
        return
      }
      const selectedRun = matching[0]
      if (!selectedRun) { setView("runState", "empty"); return }
      const response = await client["intelligence.analysis.read"]({ runRef: selectedRun.runRef }, { signal: abort.signal })
      if (!valid()) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        setView("runState", n29ResponseState(response))
        return
      }
      const run = response.body.value
      if (run.runRef !== selectedRun.runRef || run.version !== selectedRun.version ||
          run.profileId !== profile.id || run.profileVersion !== profile.version ||
          !run.caseRef || !selectedRun.caseRef ||
          !sameCaseHistory(run.caseRef, originalCase) ||
          run.caseRef.version !== selectedRun.caseRef.version) {
        setView("runState", "stale")
        return
      }
      setView({ run, runState: "ready" })
      if (run.state !== "ready" || !run.outputRef) {
        setView("outputState", run.state === "ready" ? "unavailable" : "empty")
        return
      }
      if (!n29Permitted(current.context, "analysis", "intelligence.analysis.output")) {
        setView("outputState", "unavailable")
        return
      }
      setView("outputState", "loading")
      const output = await client["intelligence.analysis.output"]({ runRef: run.runRef }, { signal: abort.signal })
      if (!valid()) return
      if (output.kind !== "response" || output.body.status !== "ok") {
        setView("outputState", n29ResponseState(output))
        return
      }
      if (output.body.value.outputRef !== run.outputRef) {
        setView("outputState", "stale")
        return
      }
      setView({ output: output.body.value, outputState: "ready" })
    }
    const readDecision = async () => {
      if (!decisionGranted) return
      const response = await createSfDecisionsClient(current.transport)["projection.case"](
        { caseRef: caseRouteRef(originalCase) }, { signal: abort.signal })
      if (!valid()) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        setView("choiceState", n29ResponseState(response))
        return
      }
      const returned = response.body.context
      const projected = response.body.value.projection.case
      if (returned.hostId !== stamp.hostId || returned.installationId !== stamp.installationId ||
          returned.projectId !== stamp.projectId || returned.principalRef !== stamp.principalRef ||
          returned.policyVersion !== stamp.policyVersion || returned.accessRevision !== stamp.accessRevision ||
          projected.id !== originalCase.id || projected.incarnation !== originalCase.incarnation ||
          projected.version !== originalCase.version) {
        setView("choiceState", "stale")
        return
      }
      const choices = [...projected.choices].filter((choice) => Number.isFinite(Date.parse(choice.at)))
        .sort((a, b) => Date.parse(b.at) - Date.parse(a.at))
      setView({ choice: choices[0] ?? null, ledger: projected.ledger,
        choiceState: choices.length ? "ready" : projected.choices.length ? "unavailable" : "empty" })
    }
    void readRun().catch((error: unknown) => {
      if (!valid()) return
      console.error("N29 UI70: native analysis read failed", error instanceof Error ? error.name : "unknown")
      setView({ run: null, output: null, runState: "unavailable", outputState: "unavailable" })
    })
    void readDecision().catch((error: unknown) => {
      if (!valid()) return
      console.error("N29 UI70: decision comparison read failed", error instanceof Error ? error.name : "unknown")
      setView({ choice: null, ledger: [], choiceState: "unavailable" })
    })
  })

  const visible = createMemo(() => {
    const query = view.search.trim().toLocaleLowerCase()
    if (!query) return view.profiles
    return view.profiles.filter((profile) =>
      [profile.id, profile.mission, profile.version,
        ...profile.skills.flatMap((skill) => [skill.id, skill.version, ...skill.allowedOperations])].some((item) =>
        item.toLocaleLowerCase().includes(query)))
  })
  const pageState = (): SfUiState => view.state === "ready" && !visible().length
    ? "filtered-empty" : view.state
  const selected = createMemo(() => selectedProfile())
  const linkedDecision = createMemo(() => view.run && view.choice ? view.ledger.find((entry) =>
    entry.kind === "choice-recorded" && entry.analysisRunId === view.run?.runRef &&
    entry.at === view.choice?.at && entry.principalRef === view.choice?.principalRef) : undefined)
  const installedCount = () => view.profiles.reduce((count, profile) => count + profile.skills.length, 0)
  const currentStamp = () => owner.ready()?.context.stamp

  return (
    <SfPageFrame
      titleKey={n29Key("sf.ui70.title")}
      context={[]}
      tabs={[]}
      activeTab={null}
      secondaryActions={[{
        id: "refresh", labelKey: n29Key("sf.u35.refresh"), tone: "secondary",
        disabled: owner.state().status !== "ready", busy: view.state === "loading",
        onInvoke: () => { void owner.reload() },
      }]}
      density="comfortable"
      layout="reading"
      onLayoutMode={() => undefined}
    >
      <section class="sf-n29-residents" data-sf-surface={props.surfaceId} data-state={pageState()}>
        <Show when={view.state === "ready" || view.state === "empty"}>
          <div class="sf-n29-summary" aria-label={t("sf.u35.coverage")}>
            <p><strong>{t("sf.u35.profiles")}:</strong> {t("sf.u35.count", { count: view.profiles.length })}</p>
            <p><strong>{t("sf.u35.skills")}:</strong> {t("sf.u35.count", { count: installedCount() })}</p>
            <p><strong>{t("sf.u35.packs")}:</strong> {t("sf.u35.noPackProof")}</p>
            <p><strong>{t("sf.u35.execution")}:</strong> {t("sf.u35.caseScopedProof")}</p>
          </div>
          <label class="sf-n29-field">
            <span>{t("sf.u35.filter")}</span>
            <input type="search" value={view.search}
              onInput={(event) => setView("search", event.currentTarget.value)} />
          </label>
          <label class="sf-n29-field">
            <span>{t("sf.u35.selectCase")}</span>
            <select value={view.caseKey} disabled={view.caseState !== "ready"}
              onChange={(event) => setView("caseKey", event.currentTarget.value)}>
              <option value="">{t("sf.u35.selectCase")}</option>
              <For each={view.cases}>
                {(item) => <option value={caseKey(item.caseRef)}>{item.label} ({item.caseRef.version})</option>}
              </For>
            </select>
            <Show when={view.caseState !== "ready"}>
              <small role="status">{t(n29StateKey(view.caseState))}</small>
            </Show>
          </label>
        </Show>
        <SfStatePanel state={pageState()} messageKey={n29StateKey(pageState())}
          onRetryRead={() => { void owner.reload() }}>
          <Show when={pageState() === "ready"}>
            <div class="sf-n29-resident-layout">
              <div class="sf-n29-resident-list" aria-label={t("sf.u35.profiles")}>
                <For each={visible()}>
                  {(profile) => (
                    <article class="mx-card">
                      <h2><bdi>{profile.id}</bdi></h2>
                      <p><bdi>{profile.mission}</bdi></p>
                      <p>{t("sf.u35.version")}: <bdi>{profile.version}</bdi></p>
                      <button type="button" class="mx-btn"
                        aria-pressed={view.selected === profile.id}
                        onClick={() => setView("selected", view.selected === profile.id ? null : profile.id)}>
                        {t("sf.u35.details")}
                      </button>
                    </article>
                  )}
                </For>
              </div>
              <Show when={selected()}>
                {(profile) => (
                  <article class="mx-card sf-n29-resident-detail">
                    <h2>{t("sf.u35.profile")}: <bdi>{profile().id}</bdi></h2>
                    <section aria-label={t("sf.u35.contribution")} data-sf-contribution-proof data-state={view.outputState}>
                      <h3>{t("sf.u35.contribution")}</h3>
                      <Show when={selectedCase()} fallback={<p>{t("sf.u35.selectCaseFirst")}</p>}>
                        <Show when={view.outputState === "ready" && view.output}
                          fallback={<SfStatePanel state={view.outputState} messageKey={n29Key("sf.u35.contributionNotVerified")} />}>
                          {(proof) => <>
                            <p><strong>{t("sf.u35.verified")}:</strong> {t("sf.u35.producerVerified")}</p>
                            <p><strong>{t("sf.u35.outputRef")}:</strong> <bdi>{proof().outputRef}</bdi></p>
                            <details>
                              <summary>{t("sf.u35.openContribution")}</summary>
                              <pre class="sf-n29-contribution-output">{proof().html}</pre>
                            </details>
                          </>}
                        </Show>
                      </Show>
                    </section>
                    <section aria-label={t("sf.u35.coverage")}>
                      <h3>{t("sf.u35.coverage")}</h3>
                      <p>{t("sf.u35.skills")}: {t("sf.u35.count", { count: profile().skills.length })}</p>
                      <div class="sf-n29-skill-list">
                        <For each={profile().skills}>
                          {(skill) => (
                            <div class="sf-n29-skill" data-sf-skill={skill.id}>
                              <h4>{t("sf.u35.skill")}: <bdi>{skill.id}</bdi></h4>
                              <p>{t("sf.u35.version")}: <bdi>{skill.version}</bdi></p>
                              <details>
                                <summary>{t("sf.u35.allowed")}</summary>
                                <ul><For each={skill.allowedOperations}>
                                  {(operation) => <li><code><bdi>{operation}</bdi></code></li>}
                                </For></ul>
                              </details>
                              <details>
                                <summary>{t("sf.u35.schema")}</summary>
                                <ul><For each={skill.outputSchemaRefs}>
                                  {(schema) => <li><code><bdi>{schema}</bdi></code></li>}
                                </For></ul>
                              </details>
                              <p><strong>{t("sf.u35.status")}:</strong> {t("sf.u35.notLoaded")}</p>
                            </div>
                          )}
                        </For>
                      </div>
                    </section>
                    <section aria-label={t("sf.u35.source")}>
                      <h3>{t("sf.u35.source")}</h3>
                      <p>{t("sf.u35.installation")}: <bdi>{currentStamp()?.installationId}</bdi></p>
                      <p>{t("sf.u35.current")}</p>
                    </section>
                    <section aria-label={t("sf.u35.execution")} data-sf-resident-run data-state={view.runState}>
                      <h3>{t("sf.u35.latestRun")}</h3>
                      <Show when={view.runState === "ready" && view.run}
                        fallback={<SfStatePanel state={view.runState} messageKey={n29Key("sf.u35.noRunForProfile")} />}>
                        {(run) => <>
                          <dl>
                            <dt>{t("sf.u35.runRef")}</dt><dd><bdi>{run().runRef}</bdi></dd>
                            <dt>{t("sf.u35.skill")}</dt><dd><bdi>{run().skillId}</bdi></dd>
                            <dt>{t("sf.u35.status")}</dt><dd><StatusText value={run().state} /></dd>
                            <dt>{t("sf.u35.version")}</dt><dd>{run().version}</dd>
                            <dt>{t("sf.u35.observedAt")}</dt><dd><WhenText iso={run().updatedAt} /></dd>
                          </dl>
                        </>}
                      </Show>
                    </section>
                    <section aria-label={t("sf.u35.humanDecision")} data-sf-human-decision data-state={view.choiceState}>
                      <h3>{t("sf.u35.humanDecision")}</h3>
                      <Show when={view.choiceState === "ready" && view.choice}
                        fallback={<SfStatePanel state={view.choiceState} messageKey={n29Key("sf.u35.noHumanChoice")} />}>
                        {(choice) => <>
                          <p><strong>{t("sf.u35.choiceRef")}:</strong> <bdi>{choice().id}</bdi></p>
                          <p><strong>{t("sf.u35.alternative")}:</strong> <bdi>{choice().alternativeId}</bdi></p>
                          <p><strong>{t("sf.u35.decisionBy")}:</strong> <bdi>{choice().principalRef}</bdi></p>
                          <p><strong>{t("sf.u35.observedAt")}:</strong> <WhenText iso={choice().at} /></p>
                          <p><strong>{t("sf.u35.rationale")}:</strong> <bdi>{choice().reason}</bdi></p>
                        </>}
                      </Show>
                      <Show when={view.run && view.choice}>
                        <p role="status">{linkedDecision() ? t("sf.u35.linkedInLedger") : t("sf.u35.noCausalLink")}</p>
                      </Show>
                      <p>{t("sf.u35.comparisonCaveat")}</p>
                    </section>
                  </article>
                )}
              </Show>
            </div>
          </Show>
        </SfStatePanel>
      </section>
    </SfPageFrame>
  )
}
