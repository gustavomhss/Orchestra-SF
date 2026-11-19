import { createEffect, createMemo, onCleanup, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfContextHandle } from "../../context/contracts"
import { sfFailureUiState, sfOperationReady, type SfCaseRecord } from "../cases/model"

type ChoiceInput = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-choose"]["input"]>
type Phase = "editing" | "reviewing" | "writing" | "committed" | "unknown" | "failed"

/** UI35 eligibility is verified, not self-attested. Persisting the actual choice is a separate human act. */
export function SfEligibilityRegistration(props: {
  record: SfCaseRecord
  owner: SfContextHandle
  selection: readonly string[]
  sameBasis: boolean
  onReload: () => void
}) {
  const language = useLanguage()
  const [ui, setUi] = createStore<{
    reason: string; phase: Phase; error: string; request?: ChoiceInput
    receipt?: { version: number; resultRef?: string; key: string }
  }>({ reason: "", phase: "editing", error: "" })
  let pending: AbortController | undefined
  onCleanup(() => pending?.abort())
  createEffect(() => {
    props.owner.generation()
    props.record.id
    props.record.incarnation
    pending?.abort()
    setUi({ reason: "", phase: "editing", error: "", request: undefined, receipt: undefined })
  })
  const baseline = createMemo(() => props.record.alternatives.find((item) => item.id === props.selection[0]))
  const candidate = createMemo(() => props.record.alternatives.find((item) => item.id === props.selection[1]))
  const eligible = () => {
    const first = baseline(), second = candidate()
    if (!props.sameBasis || !first || !second || first.id === second.id ||
      !props.record.criteria.length || first.result.id === second.result.id) return false
    return [first, second].every((item) => item.result.comparisonStatus === "complete" &&
      item.result.costCoverage.coverageState === "complete" &&
      item.result.unresolvedConditions.length === 0 && item.result.restrictions.length === 0 &&
      item.result.sourceRefs.length > 0)
  }
  const canWrite = () => {
    const ready = props.owner.ready()
    return !!ready && sfOperationReady(ready.context, "decisions.decision-choose")
  }
  const review = () => {
    const first = baseline(), second = candidate()
    if (!eligible() || !first || !second || !canWrite() || !ui.reason.trim()) {
      setUi({ phase: "failed", error: "Compare dois cenários completos na mesma base, informe a justificativa e confirme a autoridade." })
      return
    }
    setUi({ phase: "reviewing", error: "", request: {
      caseRef: { id: props.record.id, incarnation: props.record.incarnation, version: props.record.version },
      alternativeId: second.id, alternativeVersion: second.version,
      comparison: { scenarioRefs: [first.result.id, second.result.id], criteria: props.record.criteria.map((item) => item.id) },
      criteria: props.record.criteria.map((item) => item.id), reason: ui.reason.trim(),
    } })
  }
  const commit = async () => {
    const request = ui.request, ready = props.owner.ready()
    if (!request || !ready || ui.phase !== "reviewing" || !!pending ||
      !eligible() || !canWrite() ||
      request.caseRef.version !== props.record.version ||
      request.alternativeId !== candidate()?.id || request.alternativeVersion !== candidate()?.version ||
      request.comparison.scenarioRefs[0] !== baseline()?.result.id ||
      request.comparison.scenarioRefs[1] !== candidate()?.result.id) {
      setUi({ phase: "failed", request: undefined, error: "Seleção ou versão mudou; releia as alternativas." })
      return
    }
    const generation = props.owner.generation()
    const controller = new AbortController()
    const key = crypto.randomUUID()
    pending = controller
    setUi({ phase: "writing", error: "" })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-choose"](
        request, { signal: controller.signal, idempotencyKey: key },
      )
      if (controller.signal.aborted || generation !== props.owner.generation()) return
      if (result.kind === "response" && (result.status === 401 || result.status === 403 || result.body.status === "unauthenticated" || result.body.status === "denied")) {
        setUi({ phase: "failed", request: undefined, error: language.t(result.status === 401 ? "sf.common.loginAgain" : "sf.common.noAccess") })
      } else if (result.kind === "transport-error" || result.kind === "response" && result.status >= 500) {
        setUi({ phase: "unknown", error: `Resultado incerto. Não reenviar; correlação ${key}.` })
      } else if (result.kind !== "response") {
        setUi({ phase: "unknown", error: `Resultado incerto. Não reenviar; correlação ${key}.` })
      } else if (result.status !== 200 || result.body.status !== "ok") {
        setUi({ phase: "failed", request: undefined, error: `Registro não confirmado: ${sfFailureUiState(result.body.status, result.status)}.` })
      } else if (result.body.value.caseRef.id !== request.caseRef.id ||
        result.body.value.caseRef.incarnation !== request.caseRef.incarnation ||
        result.body.value.caseRef.version !== request.caseRef.version + 1) {
        setUi({ phase: "unknown", error: `Recibo divergente; inspecionar case. Correlação ${key}.` })
      } else {
        setUi({ phase: "committed", request: undefined, receipt: {
          version: result.body.value.caseRef.version, resultRef: result.body.value.resultRef, key,
        } })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Sucafina eligible decision outcome uncertain", error)
        setUi({ phase: "unknown", error: `Resultado incerto. Não reenviar; correlação ${key}.` })
      }
    } finally {
      if (pending === controller) pending = undefined
    }
  }
  return (
    <section class="mx-card sf-n24-section" aria-label="Elegibilidade de alternativas e decisão">
      <h2>Elegibilidade da comparação</h2>
      <Show when={baseline() && candidate()} fallback={<p>Selecione duas alternativas e compare para avaliar elegibilidade.</p>}>
        <p>Base: <bdi>{baseline()?.title}</bdi> → opção: <bdi>{candidate()?.title}</bdi></p>
        <p role="status">{eligible() ? "Elegível para submeter a escolha ao produtor." :
          "Não elegível: exige resultados e cobertura completos, fontes e base comparável, sem restrições."}</p>
        <p>A elegibilidade calculada na tela não é uma gravação. A confirmação registra uma escolha humana real, com CAS e recibo do caso.</p>
        <label class="sf-n24-field"><span>Justificativa para registrar a escolha</span>
          <textarea rows={3} value={ui.reason} disabled={ui.phase === "writing" || ui.phase === "unknown" || ui.phase === "committed"}
            onInput={(event) => setUi({ reason: event.currentTarget.value, phase: "editing", request: undefined, error: "" })} />
        </label>
        <Show when={ui.phase === "reviewing" && ui.request}>
          {(request) => <div class="sf-n24-review">
            <h3>Revisar decisão (impacta o caso)</h3>
            <p>caseRef <bdi>{request().caseRef.id}</bdi> · <bdi>{request().caseRef.incarnation}</bdi> · v{request().caseRef.version}</p>
            <p>alternativeId <bdi>{request().alternativeId}</bdi> · v{request().alternativeVersion}</p>
            <p>criteria <bdi>{request().criteria.join(", ")}</bdi></p>
            <p>comparison.criteria <bdi>{request().comparison.criteria.join(", ")}</bdi></p>
            <p>scenarioRefs <bdi>{request().comparison.scenarioRefs.join(" / ")}</bdi></p>
            <p>reason <bdi>{request().reason}</bdi></p>
          </div>}
        </Show>
        <Show when={ui.phase === "committed" ? ui.receipt : undefined}>
          {(receipt) => <div role="status" class="sf-n24-review">
            <p>Escolha confirmada pelo produtor: case v{receipt().version} · correlação <bdi>{receipt().key}</bdi></p>
            <Show when={receipt().resultRef}><p>Resultado: <bdi>{receipt().resultRef}</bdi></p></Show>
            <button type="button" class="mx-btn" onClick={() => {
              props.onReload()
              setUi({ phase: "editing", request: undefined, receipt: undefined, reason: "", error: "" })
            }}>Releitura autorizada</button>
          </div>}
        </Show>
        <Show when={ui.error}><p role="alert">{ui.error}</p></Show>
        <button type="button" class="mx-btn primary"
          disabled={!eligible() || !canWrite() || ui.phase === "writing" || ui.phase === "unknown" || ui.phase === "committed"}
          onClick={() => ui.phase === "reviewing" ? void commit() : review()}>
          {ui.phase === "reviewing" ? "Confirmar escolha com CAS" : "Revisar elegibilidade e escolha"}
        </button>
      </Show>
    </section>
  )
}
