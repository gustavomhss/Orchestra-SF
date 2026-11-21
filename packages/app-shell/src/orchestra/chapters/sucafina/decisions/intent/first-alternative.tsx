import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { useLanguage } from "@/context/language"
import type { SfContextHandle } from "../../context/contracts"
import { sfOperationReady, type SfCaseRecord } from "../cases/model"

type Operations = typeof SfDecisions.operations
type Coverage = Operations["decisions.decision-coverage"]["input"]["Type"]
type Promotion = Operations["decisions.decision-promote"]["input"]["Type"]
type CaseRef = Coverage["caseRef"]
type Selected = NonNullable<Extract<Operations["decisions.controls.read"]["output"]["Type"], { status: "ok" }>["value"]["selected"]>
type Forecast = NonNullable<Selected["forecast"]>
type ProcurementSource = NonNullable<Selected["procurementEvidence"]>["sources"][number]
type ScenarioOperation = Promotion["scenario"]["operations"][number]
type CoverageReceipt = { coverageRef: string; version: number }
type Review = { kind: "coverage"; input: Coverage } | { kind: "promotion"; input: Promotion;
  source: Coverage["source"]; basis: Coverage["basis"]; coverage: CoverageReceipt;
  previous: readonly { id: string; version: number }[] }

const copy = {
  heading: ["Create first alternative", "Criar primeira alternativa"],
  secondHeading: ["Create second alternative", "Criar segunda alternativa"],
  source: ["Attached Planner source", "Fonte do Planner anexada"],
  select: ["Choose an attached source", "Selecione uma fonte anexada"],
  inspect: ["Inspect attached forecast", "Inspecionar forecast anexado"],
  forecast: ["Inspected forecast", "Forecast inspecionado"],
  title: ["Alternative title", "Título da alternativa"],
  inventory: ["Use renewal or transition cost inventory", "Usar inventário de custos de renovação ou transição"],
  pending: ["Reason for pending cost review", "Motivo da revisão pendente de custos"],
  reviewCoverage: ["Review pending coverage", "Revisar cobertura pendente"],
  saveCoverage: ["Confirm pending coverage", "Confirmar cobertura pendente"],
  reviewPromotion: ["Review first alternative", "Revisar primeira alternativa"],
  savePromotion: ["Confirm first alternative", "Confirmar primeira alternativa"],
  reviewSecond: ["Review second alternative", "Revisar segunda alternativa"],
  saveSecond: ["Confirm second alternative", "Confirmar segunda alternativa"],
  procurementHeading: ["Create Procurement proposal", "Criar proposta de Compras"],
  procurementSource: ["Procurement request", "Requisição de Compras"],
  procurementAmount: ["Proposed estimated amount", "Valor estimado proposto"],
  reviewProcurement: ["Review Procurement proposal", "Revisar proposta de Compras"],
  confirmProcurement: ["Confirm Procurement proposal", "Confirmar proposta de Compras"],
  procurementPending: ["This is a scenario proposal. External costs remain pending; the requisition and its approval do not change.", "Esta é uma proposta de cenário. Os custos externos continuam pendentes; a requisição e sua aprovação não mudam."],
  noChange: ["This uses the inspected forecast without scenario changes. It does not change the plan or approve spending.", "Usa o forecast inspecionado sem alterar o cenário. Não altera o plano nem aprova gastos."],
  unavailable: ["The current forecast or coverage could not be verified. Reload the authorized case.", "Não foi possível verificar o forecast ou a cobertura. Recarregue o caso autorizado."],
  unknown: ["Save outcome unknown. Check the authorized case without resending the write.", "Resultado da gravação desconhecido. Consulte o caso autorizado sem reenviar a gravação."],
  notVerified: ["The save could not be verified. No write was resent.", "Não foi possível verificar a gravação. Nenhuma gravação foi reenviada."],
  recover: ["Check saved outcome", "Consultar resultado da gravação"],
  recovered: ["Alternative save verified", "Gravação da alternativa verificada"],
  openRecovered: ["Reload recovered case", "Recarregar caso recuperado"],
  rejected: ["The producer rejected the request. Reload the authorized case.", "O produtor rejeitou a solicitação. Recarregue o caso autorizado."],
  cancel: ["Back to editing", "Voltar à edição"],
  saved: ["Pending coverage saved", "Cobertura pendente gravada"],
} as const

const unresolvedProposals = new WeakMap<SfContextHandle, Set<string>>()

export function SfInitialAlternativeEditor(props: {
  owner: SfContextHandle; record: SfCaseRecord; caseSelector: string; onSaved: () => void; onLocked: (locked: boolean) => void
  procurement?: boolean
}) {
  const language = useLanguage()
  const t = (key: keyof typeof copy) => copy[key][language.locale().startsWith("pt") ? 1 : 0]
  const [selected, setSelected] = createSignal("")
  const [inspected, setInspected] = createSignal<{ forecast: Forecast; basis: Coverage["basis"]; requests: readonly ProcurementSource[] }>()
  const [requestRef, setRequestRef] = createSignal("")
  const [amount, setAmount] = createSignal("")
  const [coverage, setCoverage] = createSignal<CoverageReceipt>()
  const [inventory, setInventory] = createSignal(false)
  const [reason, setReason] = createSignal("")
  const [title, setTitle] = createSignal("")
  const [review, setReview] = createSignal<Review>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<"unavailable" | "rejected" | "unknown">()
  const [notVerified, setNotVerified] = createSignal(false)
  const [recovered, setRecovered] = createSignal<{ caseRef: CaseRef; resultRef: string }>()
  const second = () => props.record.alternatives.length === 1
  const heading = () => t(props.procurement ? "procurementHeading" : second() ? "secondHeading" : "heading")
  const promotionLabel = () => t(props.procurement ? "reviewProcurement" : second() ? "reviewSecond" : "reviewPromotion")
  const caseRef = () => ({ id: props.record.id, incarnation: props.record.incarnation, version: props.record.version })
  const sameCase = (ref: Coverage["caseRef"]) => ref.id === props.record.id &&
    ref.incarnation === props.record.incarnation && ref.version === props.record.version
  const attached = () => props.record.sourceRefs.filter((ref): ref is Coverage["source"] =>
    ref.kind === "record" && ref.target.surface === "planner" && ref.target.recordType === "planner-version" &&
    (props.procurement ? props.record.alternatives.some((alternative) => alternative.scenario.baseRef === ref.refId &&
      !alternative.scenario.operations.length && !alternative.scenario.assumptions.length) :
      !props.record.alternatives.some((alternative) => alternative.scenario.baseRef === ref.refId)))
  const ready = () => {
    const owner = props.owner.ready()
    return owner && sfOperationReady(owner.context, "decisions.controls.read") &&
      sfOperationReady(owner.context, "decisions.decision-promote") &&
      (props.procurement || sfOperationReady(owner.context, "decisions.decision-coverage")) ? owner : undefined
  }
  const proposalKey = () => {
    const stamp = props.owner.ready()?.context.stamp
    if (props.procurement && stamp) return JSON.stringify([stamp.installationId, stamp.projectId, stamp.hostId, stamp.principalRef, props.caseSelector, props.record.version])
  }
  const proposalLocked = () => {
    const key = proposalKey()
    return !!key && unresolvedProposals.get(props.owner)?.has(key) === true
  }
  const editable = () => !!ready() && !busy() && !review() && !error() && !recovered() && !proposalLocked()
  const clearInspection = () => {
    setInspected(undefined); setCoverage(undefined); setInventory(false); setReason(""); setRequestRef(""); setAmount("")
  }
  const proposedOperation = (): ScenarioOperation | undefined => {
    const requests = inspected()?.requests.filter(({ source }) => source.refDigest === requestRef())
    const value = Number(amount())
    if (requests?.length !== 1 || !amount().trim() || !Number.isFinite(value) || value < 0) return
    return { kind: "replace", targetRef: requests[0]!.source.refId, amount: value,
      currency: props.record.currency, period: { start: props.record.horizon.start, end: props.record.horizon.end } }
  }
  let pending: AbortController | undefined
  createEffect(() => {
    props.caseSelector; props.owner.generation(); caseRef()
    onCleanup(() => pending?.abort())
    clearInspection(); setSelected(""); setTitle(""); setReview(undefined); setError(undefined); setBusy(false)
    setNotVerified(false); setRecovered(undefined)
  })
  createEffect(() => props.onLocked(busy() || error() === "unknown" || !!recovered()))
  onCleanup(() => props.onLocked(false))
  const perform = async (work: (signal: AbortSignal, current: () => boolean) => Promise<unknown>, mode: "inspect" | "write" | "recovery" = "inspect") => {
    const generation = props.owner.generation(), selector = props.caseSelector, ref = caseRef()
    const abort = new AbortController()
    pending = abort
    const current = () => !abort.signal.aborted && props.owner.generation() === generation &&
      props.caseSelector === selector && sameCase(ref) && !!ready()
    setBusy(true)
    try { await work(abort.signal, current) }
    catch {
      if (current()) {
        if (mode === "recovery") setNotVerified(true)
        else setError(mode === "write" ? "unknown" : "unavailable")
      }
    }
    finally { if (pending === abort) { pending = undefined; if (current()) setBusy(false) } }
  }
  const inspect = () => {
    const owner = ready(), matches = attached().filter((ref) => ref.refDigest === selected())
    if (!owner || !editable() || coverage() || matches.length !== 1) return
    const source = matches[0]!
    clearInspection()
    void perform(async (signal, current) => {
      const selection = await readAttached(owner, props.caseSelector, source, signal)
      if (!current()) return
      if (!selection || !sameCase(selection.caseRef) || selection.forecast.projection.context.currency !== props.record.currency ||
        selection.forecast.projection.context.period.start !== props.record.horizon.start ||
        selection.forecast.projection.context.period.end !== props.record.horizon.end)
        return setError("unavailable")
      const forecast = selection.forecast
      const baselines = props.record.alternatives.filter((alternative) => alternative.scenario.baseRef === source.refId &&
        !alternative.scenario.operations.length && !alternative.scenario.assumptions.length)
      const baseline = props.procurement ? (baselines.length === 1 ? baselines[0] : undefined) : props.record.alternatives[0]
      const matching = baseline ? selection.decision.costCoverageBases.filter((basis) =>
        basis.id === baseline.result.costCoverage.basisId && basis.version === baseline.result.costCoverage.basisVersion) : []
      const basis = baseline ? (matching.length === 1 ? matching[0] : undefined) : selection.initialCoverageBasis ?? forecast.coverage?.basis
      if (!basis || basis.decisionType !== "renewal-transition-v1" || !basis.sourceRefs.length ||
        basis.sourceRefs.some((ref) => !selection.decision.sourceRefs.some((attachment) => attachment.refDigest === ref.refDigest)) ||
        (!baseline && (basis.sourceRefs.length !== 1 || basis.sourceRefs[0]?.refDigest !== source.refDigest))) return setError("unavailable")
      const requests = props.procurement ? attachedProcurement(selection, owner, props.record) : []
      if (props.procurement && (!baseline || !requests.length || !selection.actions.includes("decisions.promote-alternative"))) return setError("unavailable")
      if (forecast.expectedVersion === 0) {
        if (props.procurement) return setError("unavailable")
        setInspected({ forecast, basis, requests })
        return
      }
      const registered = pendingCoverage(forecast, basis)
      if (!registered) return setError("unavailable")
      setInspected({ forecast, basis, requests })
      setCoverage(registered)
    })
  }
  const reviewCoverage = () => {
    const loaded = inspected(), note = reason().trim()
    if (!editable() || !loaded || coverage() || !inventory() || !note || loaded.forecast.expectedVersion !== 0) return
    setReview({ kind: "coverage", input: { caseRef: caseRef(), source: loaded.forecast.source, basis: loaded.basis,
      entries: [...loaded.basis.categoryIds, ...loaded.basis.additionalCategoryIds].map((categoryId) => ({ categoryId, status: "pending", reason: note })),
      expectedVersion: loaded.forecast.expectedVersion } })
  }
  const reviewPromotion = () => {
    const loaded = inspected(), approved = coverage(), name = title().trim()
    const operation = props.procurement ? proposedOperation() : undefined
    if (!editable() || !loaded || !approved || !name || props.procurement && !operation || props.record.alternatives.some((alternative) => alternative.title === name)) return
    setReview({ kind: "promotion", source: loaded.forecast.source, basis: loaded.basis, coverage: approved,
      previous: props.record.alternatives.map(({ id, version }) => ({ id, version })),
      input: { caseRef: caseRef(), title: name, coverageRef: approved.coverageRef,
      scenario: { baseRef: loaded.forecast.source.refId, operations: operation ? [operation] : [], assumptions: [] } } })
  }
  const confirm = () => {
    const owner = ready(), proposed = review()
    if (!owner || !proposed || !sameCase(proposed.input.caseRef) || busy() || error() || recovered() || proposalLocked()) return
    const key = proposalKey()
    const locks = unresolvedProposals.get(props.owner) ?? new Set<string>()
    if (key) { locks.add(key); unresolvedProposals.set(props.owner, locks) }
    void perform(async (signal, current) => {
      const api = createSfDecisionsClient(owner.transport), options = { signal, idempotencyKey: crypto.randomUUID() }
      if (proposed.kind === "coverage") {
        const result = await api["decisions.decision-coverage"](proposed.input, options)
        if (!current()) return
        if (result.kind !== "response" || result.status >= 500 || (result.body.status !== "ok" && result.body.reason === "decision-authority-changed")) return setError("unknown")
        if (result.status !== 200 || result.body.status !== "ok") return setError("rejected")
        if (result.body.value.version !== proposed.input.expectedVersion + 1 || !result.body.value.coverageRef.startsWith("baseline-coverage:"))
          return setError("unknown")
        setCoverage(result.body.value)
        setReview(undefined)
        return
      }
      const result = await api["decisions.decision-promote"](proposed.input, options)
      if (!current()) return
      if (result.kind !== "response" || result.status >= 500 || (result.body.status !== "ok" && result.body.reason === "decision-authority-changed")) return setError("unknown")
      if (result.status !== 200 || result.body.status !== "ok") {
        if (key && result.status !== 400 && result.status !== 409) return setError("unknown")
        if (key) locks.delete(key)
        return setError("rejected")
      }
      const receipt = result.body.value, before = proposed.input.caseRef
      if (receipt.caseRef.id !== before.id || receipt.caseRef.incarnation !== before.incarnation ||
        receipt.caseRef.version !== before.version + 1 || !receipt.resultRef?.startsWith("decision-result:")) return setError("unknown")
      props.onSaved()
    }, "write")
  }

  const reconcile = () => {
    const owner = ready(), proposed = review()
    if (!owner || !proposed || !sameCase(proposed.input.caseRef) || error() !== "unknown" || busy() || recovered()) return
    setNotVerified(false)
    void perform(async (signal, current) => {
      const observed = await readAttached(owner, props.caseSelector, proposed.kind === "coverage" ? proposed.input.source : proposed.source, signal)
      if (!current()) return
      if (!observed) return setNotVerified(true)
      const registered = pendingCoverage(observed.forecast, proposed.kind === "coverage" ? proposed.input.basis : proposed.basis)
      if (proposed.kind === "coverage") {
        const entries = observed.forecast.coverage?.assessment.entries
        if (!sameCase(observed.caseRef) || registered?.version !== proposed.input.expectedVersion + 1 || !entries ||
          entries.length !== proposed.input.entries.length || !proposed.input.entries.every((expected) =>
            expected.status === "pending" && entries.some((entry) => entry.categoryId === expected.categoryId &&
              entry.status === "pending" && entry.reason === expected.reason))) return setNotVerified(true)
        setCoverage(registered)
        setReview(undefined)
        setError(undefined)
        return
      }
      const before = proposed.input.caseRef, expectedCase = { ...before, version: before.version + 1 }
      const alternatives = observed.decision.alternatives
      if (!sameRef(observed.caseRef, expectedCase) || observed.decision.state !== "comparing" ||
        registered?.coverageRef !== proposed.coverage.coverageRef || registered?.version !== proposed.coverage.version ||
        alternatives.length !== proposed.previous.length + 1 || !proposed.previous.every((prior) =>
          alternatives.some((alternative) => alternative.id === prior.id && alternative.version === prior.version))) return setNotVerified(true)
      const matches = alternatives.filter((alternative) => !proposed.previous.some((prior) => prior.id === alternative.id) &&
        alternative.version === 1 && alternative.title === proposed.input.title &&
        alternative.scenario.baseRef === proposed.source.refId && !alternative.scenario.assumptions.length &&
        alternative.scenario.operations.length === proposed.input.scenario.operations.length &&
        alternative.scenario.operations.every((operation, index) => sameOperation(operation, proposed.input.scenario.operations[index]!)) &&
        alternative.result.costCoverage.alternativeId === alternative.id && alternative.result.costCoverage.alternativeVersion === 1 &&
        alternative.result.costCoverage.basisId === proposed.basis.id && alternative.result.costCoverage.basisVersion === proposed.basis.version &&
        alternative.result.sourceRefs.some((source) => source.refDigest === proposed.source.refDigest) &&
        (!props.procurement || alternative.result.total === null && alternative.result.comparisonStatus === "conditioned" &&
          alternative.result.unresolvedConditions.some((condition) => condition.endsWith(":procurement-replacement-cost-unresolved")) &&
          proposed.input.scenario.operations.every((operation) => alternative.result.sourceRefs.some((source) => source.refId === operation.targetRef))))
      // Controls only exposes a result after matching the current alternative's scenario and result digests.
      const results = observed.scenarios.filter((scenario) => scenario.alternativeId === matches[0]?.id &&
        scenario.caseRef && sameRef(scenario.caseRef, expectedCase) && scenario.ref.startsWith("decision-result:"))
      if (matches.length !== 1 || results.length !== 1) return setNotVerified(true)
      setRecovered({ caseRef: observed.caseRef, resultRef: results[0]!.ref })
      setError(undefined)
    }, "recovery")
  }

  return <Show when={attached().length > 0}>
    <Show when={ready()} fallback={<p role="status">{t("unavailable")}</p>}>
    <section class="mx-card sf-n24-section" aria-label={heading()}>
      <h2>{heading()}</h2>
      <p>{t(props.procurement ? "procurementPending" : "noChange")}</p>
      <div class="sf-n24-form-grid">
        <label class="sf-n24-field">{t("source")}
          <select value={selected()} disabled={!editable() || !!coverage()} onChange={(event) => {
            setSelected(event.currentTarget.value); clearInspection()
          }}>
            <option value="">{t("select")}</option>
            <For each={attached()}>{(source) => <option value={source.refDigest}>{source.target.recordId} · v{source.target.version}</option>}</For>
          </select>
        </label>
        <button class="mx-btn" type="button" disabled={!editable() || !selected() || !!coverage()} onClick={inspect}>{t("inspect")}</button>
      </div>
      <Show when={inspected()}>{(loaded) => <>
        <section class="sf-n24-review" aria-label={t("forecast")}>
          <p><bdi>{loaded().forecast.source.refId}</bdi> · {props.record.currency} · {props.record.horizon.start} – {props.record.horizon.end}</p>
          <ul class="sf-n24-list"><For each={loaded().forecast.projection.components}>{(component) =>
            <li>{component.amount ?? "—"} {component.currency} · {component.period.start} – {component.period.end}</li>}
          </For></ul>
        </section>
        <Show when={coverage()} fallback={<>
          <label><input type="checkbox" checked={inventory()} disabled={!editable()} onChange={(event) => setInventory(event.currentTarget.checked)} /> {t("inventory")}</label>
          <label class="sf-n24-field">{t("pending")}
            <textarea maxLength={2000} value={reason()} disabled={!editable()} onInput={(event) => setReason(event.currentTarget.value)} />
          </label>
          <button class="mx-btn primary" type="button" disabled={!editable() || !inventory() || !reason().trim()} onClick={reviewCoverage}>{t("reviewCoverage")}</button>
        </>}>{(ref) => <>
          <p role="status">{t("saved")}: <bdi>{ref().coverageRef}</bdi> · v{ref().version}</p>
          <Show when={props.procurement}>
            <label class="sf-n24-field"><span>{t("procurementSource")}</span>
              <select value={requestRef()} disabled={!editable()} onChange={(event) => { setRequestRef(event.currentTarget.value); setAmount("") }}>
                <option value="">{t("select")}</option>
                <For each={loaded().requests}>{(entry) => <option value={entry.source.refDigest}>{entry.label}</option>}</For>
              </select>
            </label>
            <label class="sf-n24-field"><span>{t("procurementAmount")}</span>
              <input type="number" min="0" step="any" value={amount()} disabled={!editable() || !requestRef()}
                onInput={(event) => setAmount(event.currentTarget.value)} />
            </label>
          </Show>
          <label class="sf-n24-field">{t("title")}
            <input maxLength={500} value={title()} disabled={!editable()} onInput={(event) => setTitle(event.currentTarget.value)} />
          </label>
          <button class="mx-btn primary" type="button" disabled={!editable() || !title().trim() || props.procurement && !proposedOperation() || props.record.alternatives.some((item) => item.title === title().trim())} onClick={reviewPromotion}>{promotionLabel()}</button>
        </>}</Show>
      </>}</Show>
      <Show when={review() && !recovered() ? review() : undefined}>{(draft) => <div class="sf-n24-review" role="group" aria-label={draft().kind === "coverage" ? t("reviewCoverage") : promotionLabel()}>
        <p><bdi>{draft().input.caseRef.id}</bdi> · <bdi>{draft().input.caseRef.incarnation}</bdi> · v{draft().input.caseRef.version}</p>
        {(() => {
          const item = draft()
          return item.kind === "coverage" ? <>
            <p><bdi>{item.input.source.refId}</bdi> · <bdi>{item.input.source.refDigest}</bdi></p>
            <p><bdi>{item.input.basis.decisionType}</bdi> · <bdi>{item.input.basis.id}</bdi> · v{item.input.basis.version}</p>
            <p>CAS: {item.input.expectedVersion}</p>
            <ul class="sf-n24-list"><For each={item.input.entries}>{(entry) =>
              <li><bdi>{entry.categoryId}</bdi> · {entry.status} · {entry.status === "pending" ? entry.reason : ""}</li>}
            </For></ul>
          </> : <>
            <p><bdi>{item.input.title}</bdi> · <bdi>{item.input.scenario.baseRef}</bdi> · <bdi>{item.source.refDigest}</bdi></p>
            <p><bdi>{item.input.coverageRef}</bdi> · v{item.coverage.version}</p>
            <For each={item.input.scenario.operations}>{(operation) =>
              <p><bdi>{operation.targetRef}</bdi> · {operation.amount} {operation.currency} · {operation.period?.start} – {operation.period?.end}</p>}
            </For>
          </>
        })()}
        <div class="sf-n24-actions">
          <button class="mx-btn primary" type="button" onClick={confirm} disabled={busy() || !!error() || proposalLocked()}>{t(draft().kind === "coverage" ? "saveCoverage" : props.procurement ? "confirmProcurement" : second() ? "saveSecond" : "savePromotion")}</button>
          <button class="mx-btn" type="button" disabled={busy() || !!error()} onClick={() => setReview(undefined)}>{t("cancel")}</button>
        </div>
      </div>}</Show>
      <Show when={error() || (proposalLocked() && !busy() && !recovered() ? "unknown" as const : undefined)}>{(failure) => <p role="alert">{t(failure())}</p>}</Show>
      <Show when={error() === "unknown"}>
        <button class="mx-btn" type="button" disabled={busy()} onClick={reconcile}>{t("recover")}</button>
        <Show when={notVerified()}><p role="status">{t("notVerified")}</p></Show>
      </Show>
      <Show when={recovered()}>{(receipt) => <>
        <p role="status">{t("recovered")}: v{receipt().caseRef.version} · <bdi>{receipt().resultRef}</bdi></p>
        <button class="mx-btn" type="button" disabled={busy()} onClick={props.onSaved}>{t("openRecovered")}</button>
      </>}</Show>
    </section>
    </Show>
  </Show>
}

function sameRef(left: CaseRef, right: CaseRef) {
  return left.id === right.id && left.incarnation === right.incarnation && left.version === right.version
}

async function readAttached(owner: NonNullable<ReturnType<SfContextHandle["ready"]>>, selector: string, source: Coverage["source"], signal: AbortSignal) {
  const result = await createSfDecisionsClient(owner.transport)["decisions.controls.read"]({
    case: selector, source: source.refDigest, procurement: "attached",
  }, { signal })
  if (result.kind !== "response" || result.status !== 200 || result.body.status !== "ok") return
  const selected = result.body.value.selected, stamp = owner.context.stamp
  const forecast = selected?.forecast, context = forecast?.projection.context
  if (!selected || selected.ref !== selector || !sameRef(selected.caseRef, selected.decision) || !forecast ||
    forecast.source.refDigest !== source.refDigest || forecast.source.refId !== source.refId ||
    selected.decision.sourceRefs.filter((ref) => ref.refDigest === source.refDigest).length !== 1 ||
    !context || result.body.value.accessRevision !== stamp.accessRevision || context.installationId !== stamp.installationId ||
    context.projectId !== stamp.projectId || context.principalRef !== stamp.principalRef || context.policyVersion !== stamp.policyVersion ||
    context.accessRevision !== stamp.accessRevision || context.surface !== "planner") return
  return { ...selected, forecast, actions: result.body.value.actions }
}

function attachedProcurement(selection: Selected, owner: NonNullable<ReturnType<SfContextHandle["ready"]>>, record: SfCaseRecord) {
  const stamp = owner.context.stamp
  return (selection.procurementEvidence?.sources ?? []).filter(({ source, projection }, _, all) => {
    const { target } = source, context = projection.context
    return target.surface === "procurement" && target.recordType === "procurement-request" && target.fields.includes("originalAmount") &&
      source.evidenceLevel === "observed" && source.installationId === stamp.installationId && source.projectId === stamp.projectId &&
      Number.isSafeInteger(target.version) && target.version > 0 && source.refId === `sf-procurement:${encodeURIComponent(target.incarnation)}:${target.version}` &&
      target.period?.start === record.horizon.start && target.period.end === record.horizon.end &&
      projection.version === target.version && context.surface === "procurement" && context.currency === record.currency &&
      context.installationId === stamp.installationId && context.projectId === stamp.projectId && context.principalRef === stamp.principalRef &&
      context.policyVersion === stamp.policyVersion && context.accessRevision === stamp.accessRevision &&
      context.period.start === record.horizon.start && context.period.end === record.horizon.end &&
      [record.sourceRefs, selection.decision.sourceRefs].every((refs) => refs.filter((ref) => ref.kind === "record" &&
        ref.refDigest === source.refDigest && ref.refId === source.refId && ref.target.recordId === target.recordId).length === 1) &&
      all.filter((entry) => entry.source.refDigest === source.refDigest || entry.source.target.recordId === target.recordId).length === 1
  })
}

function sameOperation(left: ScenarioOperation, right: ScenarioOperation) {
  return left.kind === right.kind && left.targetRef === right.targetRef && left.replacementRef === right.replacementRef &&
    left.amount === right.amount && left.currency === right.currency && left.period?.start === right.period?.start && left.period?.end === right.period?.end
}

function pendingCoverage(forecast: Forecast, basis: Coverage["basis"]): CoverageReceipt | undefined {
  const version = forecast.expectedVersion, registered = forecast.coverage, classification = forecast.classification
  if (!version || !classification || classification.version !== version || classification.source.refDigest !== forecast.source.refDigest ||
    !registered || !registered.coverageRef.startsWith("baseline-coverage:") || registered.basis.id !== basis.id ||
    registered.basis.version !== basis.version || registered.assessment.basisId !== basis.id ||
    registered.assessment.basisVersion !== basis.version || registered.assessment.alternativeVersion !== version ||
    registered.assessment.coverageState !== "pending" || registered.assessment.entries.some((entry) => entry.status !== "pending")) return
  return { coverageRef: registered.coverageRef, version }
}
