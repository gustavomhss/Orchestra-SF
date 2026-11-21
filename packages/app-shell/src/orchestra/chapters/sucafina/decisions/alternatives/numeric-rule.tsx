import { createEffect, createMemo, createSignal, createUniqueId, For, on, onCleanup, Show, type JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { useSfContext } from "../../context"
import { sfFailureUiState, sfOperationReady, type SfCaseRecord } from "../cases/model"

const readOperation = "decisions.controls.read"
const saveOperation = "decisions.decision-criteria"
type Operations = typeof SfDecisions.operations
type Controls = Extract<Operations[typeof readOperation]["output"]["Type"], { status: "ok" }>["value"]
type Evidence = NonNullable<Controls["selected"]>["evidence"][number]
type RuleInput = Operations[typeof saveOperation]["input"]["Type"]
type RuleReceipt = Extract<Operations[typeof saveOperation]["output"]["Type"], { status: "ok" }>["value"]
type Owner = ReturnType<typeof useSfContext>
type FieldStatus = "unavailable" | "stale" | "denied" | "session-expired"

export type SfNumericRuleProps = {
  owner: Owner
  caseSelector: string
  record: SfCaseRecord
  pair: readonly [SfCaseRecord["alternatives"][number], SfCaseRecord["alternatives"][number]]
  onSaved: () => void
}

// Keep only a no-replay lock across view remounts and owner refreshes, never the draft or receipt.
const unresolvedWrites = new WeakMap<Owner, Set<string>>()

/** UI35 registration only. No comparison, criterion evaluation or approval is performed here. */
export function SfNumericRule(props: SfNumericRuleProps): JSX.Element {
  const { t } = useLanguage()
  const titleId = createUniqueId()
  const hintId = createUniqueId()
  const [criterionId, setCriterionId] = createSignal("")
  const [operator, setOperator] = createSignal<RuleInput["operator"] | "">("")
  const [limit, setLimit] = createSignal("")
  const [digests, setDigests] = createSignal<string[]>([])
  const scope = createMemo(() => {
    const owner = props.owner
    const active = owner.ready()
    const generation = owner.generation()
    const selector = props.caseSelector
    const record = props.record
    const pair = props.pair
    if (!active || !sfOperationReady(active.context, readOperation) || !sfOperationReady(active.context, saveOperation) ||
      selector !== `case:${encodeURIComponent(record.id)}:${encodeURIComponent(record.incarnation)}` ||
      !Number.isSafeInteger(record.version) || record.version < 1 || !record.criteria.length || !numericPair(record, pair)) return
    const caseRef = { id: record.id, incarnation: record.incarnation, version: record.version }
    const stamp = active.context.stamp
    const lockKey = JSON.stringify([stamp.installationId, stamp.projectId, stamp.hostId, stamp.principalRef, selector])
    return { owner, active, generation, selector, record, pair, caseRef, lockKey }
  })
  const target = createMemo(() => {
    const current = scope()
    const id = criterionId()
    if (current && id && current.record.criteria.filter((item) => item.id === id).length === 1) return { ...current, id }
  })
  type Target = NonNullable<ReturnType<typeof target>>
  type Basis = { expectedRuleVersion: number; evidence: readonly Evidence[] }
  type Run = { target: Target; state: "loading" | "saving" | FieldStatus } |
    { target: Target; state: "ready"; basis: Basis } | { target: Target; state: "saved"; receipt: RuleReceipt }
  const [run, setRun] = createSignal<Run>()
  const currentRun = () => {
    const value = run()
    return value?.target === target() ? value : undefined
  }
  const uncertain = () => {
    // Track completion even while the shared case lock is held.
    if (currentRun()?.state === "saving") return false
    const current = scope()
    return !!current && unresolvedWrites.get(current.owner)?.has(current.lockKey) === true
  }
  let request: AbortController | undefined
  createEffect(on(scope, () => setCriterionId("")))
  createEffect(on(target, () => {
    request?.abort()
    setRun(undefined)
    setOperator("")
    setLimit("")
    setDigests([])
  }))
  onCleanup(() => request?.abort())

  const load = async () => {
    const current = target()
    if (!current || uncertain() || currentRun()?.state === "loading" || currentRun()?.state === "saving") return
    request?.abort()
    const abort = new AbortController()
    request = abort
    setRun({ target: current, state: "loading" })
    setOperator("")
    setLimit("")
    setDigests([])
    const result = await createSfDecisionsClient(current.active.transport)[readOperation]({ case: current.selector },
      { signal: abort.signal }).catch(() => undefined)
    if (abort.signal.aborted || target() !== current) return
    if (!result || result.kind !== "response") return setRun({ target: current, state: "unavailable" })
    if (result.body.status !== "ok") {
      const failure = sfFailureUiState(result.body.status, result.status)
      return setRun({ target: current, state: failure === "denied" || failure === "session-expired" ? failure :
        failure === "stale" || failure === "conflict" ? "stale" : "unavailable" })
    }
    const projection = result.body.value
    const selected = projection.selected
    const stamp = current.active.context.stamp
    if (result.status !== 200 || projection.accessRevision !== stamp.accessRevision || !selected ||
      selected.ref !== current.selector || !sameCaseRef(current.caseRef, selected.caseRef) ||
      !sameCaseRef(current.caseRef, selected.decision) || current.record.currency !== selected.decision.currency ||
      !samePeriod(current.record.horizon, selected.decision.horizon)) {
      return setRun({ target: current, state: "stale" })
    }
    if (!projection.actions.includes("decisions.criteria")) return setRun({ target: current, state: "denied" })
    const rules = selected.rules.filter((item) => item.id === current.id)
    const expectedRuleVersion = rules.length === 1 ? rules[0]?.expectedVersion : undefined
    const criterion = current.record.criteria.find((item) => item.id === current.id)
    const criteria = selected.decision.criteria.filter((item) => item.id === current.id)
    const pair = current.pair
    const controlledAlternatives = pair.map((alternative) => selected.decision.alternatives.filter((candidate) => candidate.id === alternative.id))
    if (controlledAlternatives.some((matches, index) => matches.length !== 1 || !matches[0] || !sameAlternative(matches[0], pair[index]!)) ||
      !criterion || criteria.length !== 1 || criteria[0]?.description !== criterion.description ||
      criteria[0]?.required !== criterion.required || expectedRuleVersion === undefined ||
      !Number.isSafeInteger(expectedRuleVersion) || expectedRuleVersion < 0 || expectedRuleVersion >= Number.MAX_SAFE_INTEGER) {
      return setRun({ target: current, state: "unavailable" })
    }
    const scenarios = pair.map((alternative) => selected.scenarios.filter((scenario) => scenario.alternativeId === alternative.id))
    if (scenarios.some((matches) => matches.length !== 1 || !matches[0]?.ref.startsWith("decision-result:")) ||
      scenarios[0]?.[0]?.ref === scenarios[1]?.[0]?.ref || pair[0].result.id === pair[1].result.id) {
      return setRun({ target: current, state: "stale" })
    }
    const matches = pair.map((alternative) => selected.evidence.filter((entry) => {
      const ref = entry.evidence
      return ref.installationId === stamp.installationId && ref.projectId === stamp.projectId &&
        ref.target.surface === "planner" && ref.target.recordType === "planner-version" &&
        ref.target.period && ref.target.period.start <= current.record.horizon.start && ref.target.period.end >= current.record.horizon.end &&
        selected.evidence.filter((item) => item.evidence.refDigest === ref.refDigest).length === 1 &&
        alternative.result.sourceRefs.some((source) => source.kind === "record" && samePlannerEvidence(source, ref))
    }))
    if (matches.some((entries) => entries.length === 0)) return setRun({ target: current, state: "unavailable" })
    const procurementEvidence = selected.evidence.filter((entry) => {
      const ref = entry.evidence
      return ref.kind === "record" && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" &&
        selected.evidence.filter((candidate) => sameEvidence(candidate.evidence, ref)).length === 1 &&
        current.record.sourceRefs.filter((attached) => sameEvidence(attached, ref)).length === 1 &&
        selected.decision.sourceRefs.filter((attached) => sameEvidence(attached, ref)).length === 1 &&
        pair.some((alternative) => alternative.result.sourceRefs.some((source) => sameEvidence(source, ref)))
    })
    const evidence = selected.evidence.filter((entry) => matches.some((entries) => entries.includes(entry)) ||
      procurementEvidence.includes(entry))
    setRun({ target: current, state: "ready", basis: { evidence, expectedRuleVersion } })
  }

  const basis = () => {
    const value = currentRun()
    return value?.state === "ready" ? value.basis : undefined
  }
  const input = createMemo((): RuleInput | undefined => {
    const current = target()
    const loaded = basis()
    const condition = operator()
    const value = Number(limit())
    const selected = digests()
    const evidence = loaded?.evidence.filter((item) => selected.includes(item.evidence.refDigest))
    if (!current || !loaded || !condition || !limit().trim() || !Number.isFinite(value) ||
      !evidence?.length || evidence.length !== selected.length || uncertain()) return
    return {
      caseRef: current.caseRef, criterionId: current.id, metricRef: "planner:known-subtotal-difference", operator: condition,
      value, unit: current.record.currency, period: { start: current.record.horizon.start, end: current.record.horizon.end },
      evidenceRefs: evidence.map((item) => item.evidence), expectedRuleVersion: loaded.expectedRuleVersion,
    }
  })
  const save = async () => {
    const current = target()
    const payload = input()
    if (!current || !payload || unresolvedWrites.get(current.owner)?.has(current.lockKey)) return
    const idempotencyKey = crypto.randomUUID()
    const abort = new AbortController()
    request = abort
    const locks = unresolvedWrites.get(current.owner) ?? new Set<string>()
    locks.add(current.lockKey)
    unresolvedWrites.set(current.owner, locks)
    setRun({ target: current, state: "saving" })
    const result = await createSfDecisionsClient(current.active.transport)[saveOperation](payload, { signal: abort.signal,
      idempotencyKey }).catch(() => undefined)
    if (abort.signal.aborted || target() !== current) return
    if (result?.kind === "response" && result.status === 200 && result.body.status === "ok" &&
      /^criterion-rule:[a-f0-9]{64}$/.test(result.body.value.ruleRef) && result.body.value.version === payload.expectedRuleVersion + 1) {
      locks.delete(current.lockKey)
      setRun({ target: current, state: "saved", receipt: result.body.value })
      props.onSaved()
      return
    }
    if (result?.kind === "response" && result.body.status !== "ok") {
      const status = result.body.status
      const invalid = result.status === 400 && (status === "invalid" || status === "needs-input")
      const stale = result.status === 409 && (status === "stale" || status === "conflict")
      if (invalid || stale) {
        locks.delete(current.lockKey)
        return setRun({ target: current, state: stale ? "stale" : "unavailable" })
      }
    }
    // Unavailable/denied can be returned after the producer commits, so neither is a safe retry signal.
    setRun(undefined)
  }

  const status = () => currentRun()?.state
  const busy = () => status() === "loading" || status() === "saving"
  const saved = () => {
    const value = currentRun()
    return value?.state === "saved" ? value.receipt : undefined
  }
  return (
    <div class="mx-card sf-n24-section" role="group" aria-labelledby={titleId} aria-describedby={hintId}>
      <h2 id={titleId}>{t("sf.ui35.numeric.title")}</h2>
      <p id={hintId}>{t("sf.ui35.numeric.hint")}</p>
      <form onSubmit={(event) => { event.preventDefault(); void save() }}>
        <div class="sf-n24-form-grid">
          <label class="sf-n24-field">
            <span>{t("sf.ui35.numeric.criterion")}</span>
            <select value={criterionId()} disabled={!scope() || busy() || uncertain()}
              onChange={(event) => setCriterionId(event.currentTarget.value)}>
              <option value="">{t("sf.ui35.numeric.chooseCriterion")}</option>
              <For each={scope()?.record.criteria}>{(criterion) => <option value={criterion.id}>{criterion.description}</option>}</For>
            </select>
          </label>
          <div class="sf-n24-actions">
            <button type="button" class="mx-btn" disabled={!target() || busy() || uncertain()}
              onClick={() => void load()}>{t("sf.ui35.numeric.load")}</button>
          </div>
          <label class="sf-n24-field sf-n24-span">
            <span>{t("sf.ui35.numeric.evidence")}</span>
            <select multiple size={4} disabled={!basis()} onChange={(event) =>
              setDigests(Array.from(event.currentTarget.selectedOptions, (option) => option.value))}>
              <For each={basis()?.evidence}>{(entry) => <option value={entry.evidence.refDigest}
                selected={digests().includes(entry.evidence.refDigest)}>{entry.label}</option>}</For>
            </select>
          </label>
          <label class="sf-n24-field">
            <span>{t("sf.ui35.numeric.condition")}</span>
            <select value={operator()} disabled={!basis()} onChange={(event) => {
              const value = event.currentTarget.value
              setOperator(value === "lte" || value === "gte" || value === "eq" ? value : "")
            }}>
              <option value="">{t("sf.ui35.numeric.chooseCondition")}</option>
              <option value="lte">{t("sf.ui35.numeric.lte")}</option>
              <option value="gte">{t("sf.ui35.numeric.gte")}</option>
              <option value="eq">{t("sf.ui35.numeric.eq")}</option>
            </select>
          </label>
          <label class="sf-n24-field">
            <span>{t("sf.ui35.numeric.limit", { unit: scope()?.record.currency ?? props.record.currency })}</span>
            <input type="number" step="any" value={limit()} disabled={!basis()}
              onInput={(event) => setLimit(event.currentTarget.value)} />
          </label>
        </div>
        <Show when={basis()}>{(value) => <p>{t("sf.ui35.numeric.revision", { version: value().expectedRuleVersion })}</p>}</Show>
        <button type="submit" class="mx-btn" disabled={!input()}>{t("sf.ui35.numeric.save")}</button>
      </form>
      <Show when={!scope()}><p role="status" class="sf-n24-status">{t("sf.ui35.numeric.unavailable")}</p></Show>
      <Show when={busy()}><p role="status" class="sf-n24-status">{t(status() === "loading" ? "sf.ui35.numeric.loading" : "sf.ui35.numeric.saving")}</p></Show>
      <Show when={status() === "stale" || status() === "unavailable" || status() === "denied" || status() === "session-expired"}>
        <p role="alert" class="sf-n24-status">{t(status() === "stale" ? "sf.ui35.numeric.stale" :
          status() === "denied" ? "sf.common.noAccess" : status() === "session-expired" ? "sf.common.loginAgain" : "sf.ui35.numeric.unavailable")}</p>
      </Show>
      <Show when={uncertain()}><p role="alert" class="sf-n24-status">{t("sf.ui35.numeric.unknown")}</p></Show>
      <Show when={saved()}>{(receipt) => <p role="status" class="sf-n24-status">{t("sf.ui35.numeric.saved", { version: receipt().version })}</p>}</Show>
    </div>
  )
}

function sameCaseRef(a: RuleInput["caseRef"], b: RuleInput["caseRef"]) {
  return a.id === b.id && a.incarnation === b.incarnation && a.version === b.version
}

function samePeriod(a: RuleInput["period"], b: RuleInput["period"]) {
  return a.start === b.start && a.end === b.end
}

function numericPair(record: SfCaseRecord, pair: SfNumericRuleProps["pair"]) {
  if (pair[0].id === pair[1].id || pair[0].result.id === pair[1].result.id) return
  const current = pair.map((alternative) => record.alternatives.filter((candidate) => candidate.id === alternative.id))
  if (current.some((matches, index) => matches.length !== 1 || !matches[0] || !sameAlternative(matches[0], pair[index]!))) return
  if (pair.some(({ result }) => result.currency !== record.currency || !samePeriod(result.horizon, record.horizon) ||
    (result.comparisonStatus !== "conditioned" && result.comparisonStatus !== "complete") || !Number.isFinite(result.knownSubtotal))) return
  return pair
}

function sameAlternative(a: SfCaseRecord["alternatives"][number], b: SfCaseRecord["alternatives"][number]) {
  return a.id === b.id && a.version === b.version && JSON.stringify(a.result) === JSON.stringify(b.result)
}

function sameEvidence(a: Evidence["evidence"], b: Evidence["evidence"]) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function samePlannerEvidence(a: Evidence["evidence"], b: Evidence["evidence"]) {
  return a.refDigest === b.refDigest && a.refId === b.refId && a.evidenceLevel === b.evidenceLevel &&
    a.installationId === b.installationId && a.projectId === b.projectId && a.target.surface === b.target.surface &&
    a.target.recordType === b.target.recordType && a.target.recordId === b.target.recordId &&
    a.target.incarnation === b.target.incarnation && a.target.version === b.target.version &&
    a.target.projectionDigest === b.target.projectionDigest && a.target.fields.length === b.target.fields.length &&
    a.target.fields.every((field, i) => field === b.target.fields[i]) &&
    !!a.target.period && !!b.target.period && samePeriod(a.target.period, b.target.period)
}
