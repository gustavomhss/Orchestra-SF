import { createEffect, createMemo, createSignal, on, onCleanup, Show, type JSX } from "solid-js"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { useSfContext } from "../../context"
import { sfOperationReady, type SfCaseRecord } from "../cases/model"

type Owner = ReturnType<typeof useSfContext>
type Operations = typeof SfDecisions.operations
type ChoiceInput = Operations["decisions.decision-choose"]["input"]["Type"]
type Comparison = Extract<Operations["decisions.decision-compare"]["output"]["Type"], { status: "ok" }>["value"]
type Pair = readonly [SfCaseRecord["alternatives"][number], SfCaseRecord["alternatives"][number]]

// A lost response or cancelled in-flight request must not turn a remount into a retry.
const unresolvedWrites = new WeakMap<Owner, Set<string>>()

export function SfRecordChoice(props: {
  owner: Owner
  caseSelector: string
  record: SfCaseRecord
  pair: Pair | undefined
  comparison: { state: string; value?: Comparison } | undefined
}): JSX.Element {
  const [reason, setReason] = createSignal("")
  const [reviewed, setReviewed] = createSignal<{ target: NonNullable<ReturnType<typeof target>>; request: ChoiceInput }>()
  const [phase, setPhase] = createSignal<"editing" | "writing" | "confirmed" | "unknown" | "failed">("editing")
  const [message, setMessage] = createSignal("")
  let pending: AbortController | undefined
  const target = createMemo(() => {
    const active = props.owner.ready()
    const generation = props.owner.generation()
    const record = props.record
    const pair = props.pair
    const run = props.comparison
    const value = run?.state === "ready" ? run.value : undefined
    if (!active || props.owner.state().status !== "ready" || !sfOperationReady(active.context, "decisions.decision-choose") || !pair || !value || record.choices.length ||
      props.caseSelector !== `case:${encodeURIComponent(record.id)}:${encodeURIComponent(record.incarnation)}` ||
      (value.comparison.comparisonStatus !== "complete" && value.comparison.comparisonStatus !== "conditioned") ||
      value.request.scenarioRefs.length !== 2 || value.request.scenarioRefs[0] === value.request.scenarioRefs[1] ||
      value.request.scenarioRefs[0] !== value.comparison.baselineResultRef || value.request.scenarioRefs[1] !== value.comparison.alternativeResultRef ||
      !record.criteria.length || value.request.criteria.length !== record.criteria.length ||
      value.request.criteria.some((id, index) => id !== record.criteria[index]?.id) ||
      value.comparison.criterionResults.length !== value.request.criteria.length ||
      value.request.criteria.some((id) => value.comparison.criterionResults.filter((item) => item.criterionId === id &&
        (item.state !== "unknown" || item.reason === "criterion-metric-conditioned")).length !== 1)) return
    const stamp = active.context.stamp
    const lockKey = JSON.stringify([stamp.installationId, stamp.projectId, stamp.hostId, stamp.principalRef, props.caseSelector, record.version])
    return { active, generation, record, pair, run, value, lockKey }
  })
  const locked = () => {
    const current = target()
    return !!current && unresolvedWrites.get(props.owner)?.has(current.lockKey) === true
  }
  createEffect(on(target, () => {
    pending?.abort()
    pending = undefined
    setReviewed(undefined)
    setReason("")
    setMessage("")
    setPhase("editing")
  }))
  onCleanup(() => pending?.abort())

  const review = () => {
    const current = target()
    if (!current || locked() || !reason().trim()) return
    setReviewed({ target: current, request: {
      caseRef: { id: current.record.id, incarnation: current.record.incarnation, version: current.record.version },
      alternativeId: current.pair[1].id, alternativeVersion: current.pair[1].version,
      comparison: structuredClone(current.value.request), criteria: [...current.value.request.criteria], reason: reason().trim(),
    } })
  }
  const commit = async () => {
    const current = target()
    const choice = reviewed()
    if (!current || !choice || choice.target !== current || locked() || pending || phase() !== "editing") return
    const locks = unresolvedWrites.get(props.owner) ?? new Set<string>()
    locks.add(current.lockKey)
    unresolvedWrites.set(props.owner, locks)
    const abort = new AbortController()
    pending = abort
    const key = crypto.randomUUID()
    setPhase("writing")
    const result = await createSfDecisionsClient(current.active.transport)["decisions.decision-choose"](
      choice.request, { signal: abort.signal, idempotencyKey: key },
    ).catch(() => undefined)
    if (abort.signal.aborted || target() !== current) return
    pending = undefined
    if (result?.kind === "response" && result.status === 200 && result.body.status === "ok" &&
      result.body.value.caseRef.id === choice.request.caseRef.id &&
      result.body.value.caseRef.incarnation === choice.request.caseRef.incarnation &&
      result.body.value.caseRef.version === choice.request.caseRef.version + 1) {
      setPhase("confirmed")
      setMessage(`Escolha ${current.value.comparison.comparisonStatus} registrada no caso v${result.body.value.caseRef.version}. Não é promoção nem aprovação financeira.`)
      return
    }
    if (result?.kind === "response" && (result.status === 400 || result.status === 409) &&
      (result.body.status === "invalid" || result.body.status === "needs-input" || result.body.status === "conflict" || result.body.status === "stale")) {
      locks.delete(current.lockKey)
      setReviewed(undefined)
      setPhase("failed")
      setMessage("Escolha não registrada. Releia o caso e compare novamente.")
      return
    }
    setPhase("unknown")
    setMessage(`Resultado incerto. Não reenviar; releia o caso. Correlação ${key}.`)
  }
  const disabled = () => phase() === "writing" || phase() === "unknown" || phase() === "confirmed" || locked()
  return <section class="mx-card sf-n24-section" aria-label="Elegibilidade de alternativas e decisão">
    <h2>Registrar escolha humana</h2>
    <p>O registro da escolha não promove nem aprova alterações financeiras. Condições e custos pendentes permanecem.</p>
    <label class="sf-n24-field"><span>Justificativa para registrar a escolha</span>
      <textarea rows={3} value={reason()} disabled={disabled()} onInput={(event) => {
        setReason(event.currentTarget.value)
        setReviewed(undefined)
        setPhase("editing")
        setMessage("")
      }} />
    </label>
    <Show when={reviewed() && reviewed()?.target === target() ? reviewed() : undefined}>
      {(choice) => <div class="sf-n24-review">
        <h3>Revisar decisão (impacta o caso)</h3>
        <p>caseRef <bdi>{choice().request.caseRef.id}</bdi> · <bdi>{choice().request.caseRef.incarnation}</bdi> · v{choice().request.caseRef.version}</p>
        <p>baselineId <bdi>{choice().target.pair[0].id}</bdi> · v{choice().target.pair[0].version}</p>
        <p>alternativeId <bdi>{choice().request.alternativeId}</bdi> · v{choice().request.alternativeVersion}</p>
        <p>criteria <bdi>{choice().request.criteria.join(", ")}</bdi></p>
        <p>comparison.criteria <bdi>{choice().request.comparison.criteria.join(", ")}</bdi></p>
        <p>scenarioRefs <bdi>{choice().request.comparison.scenarioRefs.join(" / ")}</bdi></p>
        <p>comparison status <bdi>{choice().target.value.comparison.comparisonStatus}</bdi></p>
        <p>reason <bdi>{choice().request.reason}</bdi></p>
      </div>}
    </Show>
    <Show when={message()}><p role={phase() === "confirmed" ? "status" : "alert"}>{message()}</p></Show>
    <Show when={locked() && phase() === "editing"}><p role="alert">Resultado incerto. Não reenviar; releia o caso.</p></Show>
    <button type="button" class="mx-btn primary" disabled={!target() || disabled() || !reason().trim()}
      onClick={() => reviewed() ? void commit() : review()}>
      {reviewed() ? "Confirmar escolha com CAS" : "Revisar elegibilidade e escolha"}
    </button>
  </section>
}
