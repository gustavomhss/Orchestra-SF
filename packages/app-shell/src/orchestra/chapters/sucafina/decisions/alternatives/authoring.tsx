import { For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import type { SfContextHandle } from "../../context/contracts"
import { sfFailureUiState, sfOperationReady, type SfCaseRecord } from "../cases/model"

type Alternative = SfCaseRecord["alternatives"][number]
type PromoteInput = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-promote"]["input"]>
type OperationKind = "include" | "exclude" | "defer" | "replace"
type AssumptionState = "confirmed" | "estimated" | "hypothetical" | "absent"
type OperationEditor = {
  kind: OperationKind; targetRef: string; replacementRef: string; amount: string
  currency: string; start: string; end: string
}
type AssumptionEditor = {
  id: string; value: string; valueKind: "text" | "number" | "boolean" | "null"
  state: AssumptionState; sourceIds: string[]
}
type Phase = "editing" | "reviewing" | "saving" | "committed" | "unknown" | "failed"
type Receipt = { caseVersion: number; resultRef?: string; correlation: string }

const blankOperation = (): OperationEditor => ({
  kind: "include", targetRef: "", replacementRef: "", amount: "", currency: "", start: "", end: "",
})
const blankAssumption = (): AssumptionEditor => ({
  id: "", value: "", valueKind: "text", state: "hypothetical", sourceIds: [],
})
const editorOperation = (value: Alternative["scenario"]["operations"][number]): OperationEditor => ({
  kind: value.kind, targetRef: value.targetRef, replacementRef: value.replacementRef ?? "",
  amount: value.amount === undefined ? "" : String(value.amount), currency: value.currency ?? "",
  start: value.period?.start ?? "", end: value.period?.end ?? "",
})
const editorAssumption = (value: Alternative["scenario"]["assumptions"][number]): AssumptionEditor => ({
  id: value.id, value: value.value === null ? "" : String(value.value),
  valueKind: value.value === null ? "null" : typeof value.value === "number" ? "number"
    : typeof value.value === "boolean" ? "boolean" : "text",
  state: value.state, sourceIds: value.evidenceRefs.map((source) => source.refId),
})
const coverageReference = (record: SfCaseRecord, alternative: Alternative) =>
  `case-coverage:${encodeURIComponent(record.id)}:${encodeURIComponent(record.incarnation)}:${encodeURIComponent(alternative.id)}:${alternative.version}`

/**
 * UI35 / UI36: human CAS authoring on the admitted Decision producer. A new A/B/C
 * starts from an actual authorized alternative's coverage, never a made-up basis.
 * Edits preserve the original alternative identity/version. If there is no
 * reference coverage, this control fails closed rather than claiming a save.
 */
export function SfAlternativeAuthoring(props: {
  owner: SfContextHandle
  record: SfCaseRecord
  onReload: () => void
  assumptionsOnly?: boolean
}) {
  const [form, setForm] = createStore<{
    mode: "new" | "edit"; selectedId: string; slot: "A" | "B" | "C"
    title: string; baseRef: string; operations: OperationEditor[]; assumptions: AssumptionEditor[]
    phase: Phase; error: string; prepared?: PromoteInput; receipt?: Receipt
  }>({
    mode: props.assumptionsOnly ? "edit" : "new", selectedId: "", slot: "A",
    title: "", baseRef: "", operations: [], assumptions: [],
    phase: "editing", error: "",
  })
  let pending: AbortController | undefined
  onCleanup(() => pending?.abort())
  const available = () => props.record.alternatives
  const selected = () => available().find((item) => item.id === form.selectedId)
  const canWrite = () => {
    const ready = props.owner.ready()
    return !!ready && sfOperationReady(ready.context, "decisions.decision-promote") &&
      form.phase !== "saving" && form.phase !== "unknown" && form.phase !== "committed"
  }
  const select = (id: string) => {
    const alternative = available().find((item) => item.id === id)
    setForm({
      selectedId: alternative?.id ?? "", title: alternative?.title ?? "",
      baseRef: alternative?.scenario.baseRef ?? "",
      operations: alternative?.scenario.operations.map(editorOperation) ?? [],
      assumptions: alternative?.scenario.assumptions.map(editorAssumption) ?? [],
      prepared: undefined, receipt: undefined, phase: "editing", error: "",
    })
  }
  const edit = () => setForm({ phase: "editing", prepared: undefined, error: "" })
  const review = () => {
    const anchor = selected()
    if (!canWrite() || !anchor || props.record.version < 1) {
      setForm("error", "É necessário selecionar uma alternativa fonte autorizada.")
      return
    }
    if (!form.title.trim() || !form.baseRef.trim() || !form.operations.every((op) =>
      !!op.targetRef.trim() && (!op.amount.trim() || Number.isFinite(Number(op.amount))) &&
      (!op.currency || /^[A-Z]{3}$/.test(op.currency)) &&
      ((op.start === "" && op.end === "") ||
        (/^\d{4}-\d{2}-\d{2}$/.test(op.start) && /^\d{4}-\d{2}-\d{2}$/.test(op.end))))) {
      setForm("error", "Título, origem e operações precisam ser válidos.")
      return
    }
    const references = props.record.sourceRefs
    const ids = new Set<string>()
    const assumptions = []
    for (const assumption of form.assumptions) {
      const value = assumption.valueKind === "null" ? null :
        assumption.valueKind === "number" ? Number(assumption.value) :
        assumption.valueKind === "boolean" ? assumption.value === "true" : assumption.value
      if (!assumption.id.trim() || ids.has(assumption.id) ||
        assumption.valueKind === "number" && (!assumption.value.trim() || typeof value !== "number" || !Number.isFinite(value)) ||
        assumption.sourceIds.length === 0 ||
        assumption.sourceIds.some((id) => references.filter((ref) => ref.refId === id).length !== 1)) {
        setForm("error", "Premissas exigem ID único, valor válido e fontes do caso atual.")
        return
      }
      ids.add(assumption.id)
      assumptions.push({
        id: assumption.id.trim(), value,
        state: assumption.state,
        evidenceRefs: references.filter((ref) => assumption.sourceIds.includes(ref.refId)),
      })
    }
    const operations = form.operations.map((op) => ({
      kind: op.kind, targetRef: op.targetRef.trim(),
      ...(op.replacementRef.trim() ? { replacementRef: op.replacementRef.trim() } : {}),
      ...(op.amount.trim() ? { amount: Number(op.amount) } : {}),
      ...(op.currency.trim() ? { currency: op.currency.trim() } : {}),
      ...(op.start && op.end ? { period: { start: op.start, end: op.end } } : {}),
    }))
    const request: PromoteInput = {
      caseRef: { id: props.record.id, incarnation: props.record.incarnation, version: props.record.version },
      title: form.mode === "new" ? `${form.slot} · ${form.title.trim()}` : form.title.trim(),
      coverageRef: coverageReference(props.record, anchor),
      scenario: { baseRef: form.baseRef.trim(), operations, assumptions },
      ...(form.mode === "edit" ? { alternativeRef: { id: anchor.id, version: anchor.version } } : {}),
    }
    setForm({ prepared: request, error: "", phase: "reviewing" })
  }
  const commit = async () => {
    const request = form.prepared, ready = props.owner.ready()
    if (!request || !ready || form.phase !== "reviewing" || !!pending || !canWrite()) return
    const source = selected()
    if (request.caseRef.id !== props.record.id ||
      request.caseRef.incarnation !== props.record.incarnation ||
      request.caseRef.version !== props.record.version ||
      !source || coverageReference(props.record, source) !== request.coverageRef) {
      setForm({ error: "A versão ou a fonte mudou. Releia o caso.", phase: "failed", prepared: undefined })
      return
    }
    const generation = props.owner.generation()
    const controller = new AbortController()
    pending = controller
    const correlation = crypto.randomUUID()
    setForm({ phase: "saving", error: "" })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-promote"](
        request, { signal: controller.signal, idempotencyKey: correlation },
      )
      if (controller.signal.aborted || props.owner.generation() !== generation) return
      if (result.kind === "transport-error" || result.kind === "response" && result.status >= 500) {
        setForm({ phase: "unknown", error: `Resultado desconhecido; não reenviar. Correlação: ${correlation}` })
      } else if (result.body.status !== "ok") {
        const state = sfFailureUiState(result.body.status, result.status)
        setForm({ phase: "failed", error: `Produtor rejeitou: ${state} (${result.body.status}).`, prepared: undefined })
      } else if (result.body.value.caseRef.id !== request.caseRef.id ||
        result.body.value.caseRef.incarnation !== request.caseRef.incarnation ||
        result.body.value.caseRef.version !== request.caseRef.version + 1 ||
        !result.body.value.resultRef) {
        setForm({ phase: "unknown", error: `Recibo inesperado; verificar projeção. Correlação: ${correlation}` })
      } else {
        setForm({ phase: "committed", prepared: undefined, receipt: {
          caseVersion: result.body.value.caseRef.version,
          resultRef: result.body.value.resultRef, correlation,
        } })
      }
    } catch (error) {
      if (!controller.signal.aborted) {
        console.error("Sucafina alternative authoring outcome unknown", error)
        setForm({ phase: "unknown", error: `Resultado desconhecido; não reenviar. Correlação: ${correlation}` })
      }
    } finally {
      if (pending === controller) pending = undefined
    }
  }

  return (
    <section class="mx-card sf-n24-section" aria-label={props.assumptionsOnly ? "Revisão de premissas com CAS" : "Autoria A/B/C com CAS"}>
      <h2>{props.assumptionsOnly ? "Editar premissas de cenário" : "Criar ou editar alternativas A/B/C"}</h2>
      <p>Fonte autorizada · caso <bdi>{props.record.id}</bdi> · versão {props.record.version}.
        O produtor verifica CAS, fontes e cobertura antes de persistir.</p>
      <Show when={available().length} fallback={<p role="status">Sem alternativa com cobertura verificável para ancorar a escrita; não há gravação disponível.</p>}>
        <div class="sf-n24-form-grid">
          <Show when={!props.assumptionsOnly}>
            <label class="sf-n24-field"><span>Ação</span>
              <select value={form.mode} disabled={!canWrite()} onChange={(event) => {
                const mode = event.currentTarget.value === "edit" ? "edit" : "new"
                setForm("mode", mode); select("")
              }}>
                <option value="new">Nova A/B/C a partir da fonte</option>
                <option value="edit">Atualizar alternativa existente</option>
              </select>
            </label>
            <Show when={form.mode === "new"}>
              <label class="sf-n24-field"><span>Identificador visual</span>
                <select value={form.slot} disabled={!canWrite()} onChange={(event) => {
                  const value = event.currentTarget.value
                  if (value === "A" || value === "B" || value === "C") setForm("slot", value)
                }}>
                  <option>A</option><option>B</option><option>C</option>
                </select>
              </label>
            </Show>
          </Show>
          <label class="sf-n24-field"><span>{form.mode === "new" ? "Alternativa fonte + cobertura" : "Alternativa a editar"}</span>
            <select value={form.selectedId} disabled={!canWrite()} onChange={(event) => select(event.currentTarget.value)}>
              <option value="">Selecionar…</option>
              <For each={available()}>{(item) => <option value={item.id}>{item.title} · v{item.version}</option>}</For>
            </select>
          </label>
          <Show when={selected()}>
            <label class="sf-n24-field sf-n24-span"><span>Título</span>
              <input value={form.title} disabled={!canWrite() || !!props.assumptionsOnly}
                onInput={(event) => { setForm("title", event.currentTarget.value); edit() }} />
            </label>
            <Show when={!props.assumptionsOnly}>
              <label class="sf-n24-field sf-n24-span"><span>Base de cenário (ref do produtor)</span>
                <input value={form.baseRef} disabled={!canWrite()} onInput={(event) => { setForm("baseRef", event.currentTarget.value); edit() }} />
              </label>
              <h3 class="sf-n24-span">Operações do cenário</h3>
              <For each={form.operations}>{(op, index) =>
                <div class="sf-n24-review sf-n24-span">
                  <div class="sf-n24-form-grid">
                    <label class="sf-n24-field"><span>Operação</span>
                      <select value={op.kind} disabled={!canWrite()} onChange={(event) => {
                        const value = event.currentTarget.value
                        if (value === "include" || value === "exclude" || value === "defer" || value === "replace")
                          setForm("operations", index(), "kind", value)
                        edit()
                      }}>
                        <option value="include">Incluir</option><option value="exclude">Excluir</option>
                        <option value="defer">Adiar</option><option value="replace">Substituir</option>
                      </select>
                    </label>
                    <label class="sf-n24-field"><span>Target ref</span><input value={op.targetRef} disabled={!canWrite()}
                      onInput={(event) => { setForm("operations", index(), "targetRef", event.currentTarget.value); edit() }} /></label>
                    <label class="sf-n24-field"><span>Replacement ref (opcional)</span><input value={op.replacementRef} disabled={!canWrite()}
                      onInput={(event) => { setForm("operations", index(), "replacementRef", event.currentTarget.value); edit() }} /></label>
                    <label class="sf-n24-field"><span>Valor (opcional)</span><input type="number" value={op.amount} disabled={!canWrite()}
                      onInput={(event) => { setForm("operations", index(), "amount", event.currentTarget.value); edit() }} /></label>
                    <label class="sf-n24-field"><span>Moeda (opcional)</span><input value={op.currency} disabled={!canWrite()}
                      onInput={(event) => { setForm("operations", index(), "currency", event.currentTarget.value.toUpperCase()); edit() }} /></label>
                    <label class="sf-n24-field"><span>De</span><input type="date" value={op.start} disabled={!canWrite()}
                      onInput={(event) => { setForm("operations", index(), "start", event.currentTarget.value); edit() }} /></label>
                    <label class="sf-n24-field"><span>Até</span><input type="date" value={op.end} disabled={!canWrite()}
                      onInput={(event) => { setForm("operations", index(), "end", event.currentTarget.value); edit() }} /></label>
                  </div>
                  <button type="button" class="mx-btn" disabled={!canWrite()}
                    onClick={() => { setForm("operations", (current) => current.filter((_, n) => n !== index())); edit() }}>Remover operação</button>
                </div>
              }</For>
              <button type="button" class="mx-btn" disabled={!canWrite()}
                onClick={() => { setForm("operations", (items) => [...items, blankOperation()]); edit() }}>Adicionar operação</button>
            </Show>
            <h3 class="sf-n24-span">Premissas com evidência vinculada</h3>
            <For each={form.assumptions}>{(assumption, index) =>
              <div class="sf-n24-review sf-n24-span">
                <div class="sf-n24-form-grid">
                  <label class="sf-n24-field"><span>ID</span><input value={assumption.id} disabled={!canWrite()}
                    onInput={(event) => { setForm("assumptions", index(), "id", event.currentTarget.value); edit() }} /></label>
                  <label class="sf-n24-field"><span>Tipo</span><select value={assumption.valueKind} disabled={!canWrite()}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      if (value === "text" || value === "number" || value === "boolean" || value === "null")
                        setForm("assumptions", index(), "valueKind", value)
                      edit()
                    }}>
                      <option value="text">Texto</option><option value="number">Número</option>
                      <option value="boolean">Booleano</option><option value="null">Ausente</option>
                    </select></label>
                  <Show when={assumption.valueKind !== "null"}>
                    <label class="sf-n24-field"><span>Valor</span>
                      <Show when={assumption.valueKind === "boolean"} fallback={
                        <input value={assumption.value} disabled={!canWrite()} type={assumption.valueKind === "number" ? "number" : "text"}
                          onInput={(event) => { setForm("assumptions", index(), "value", event.currentTarget.value); edit() }} />
                      }>
                        <select value={assumption.value} disabled={!canWrite()}
                          onChange={(event) => { setForm("assumptions", index(), "value", event.currentTarget.value); edit() }}>
                          <option value="true">Verdadeiro</option><option value="false">Falso</option>
                        </select>
                      </Show>
                    </label>
                  </Show>
                  <label class="sf-n24-field"><span>Estado</span><select value={assumption.state} disabled={!canWrite()}
                    onChange={(event) => {
                      const value = event.currentTarget.value
                      if (value === "confirmed" || value === "estimated" || value === "hypothetical" || value === "absent")
                        setForm("assumptions", index(), "state", value)
                      edit()
                    }}>
                      <option value="confirmed">Confirmada</option><option value="estimated">Estimada</option>
                      <option value="hypothetical">Hipótese</option><option value="absent">Ausente</option>
                    </select></label>
                  <label class="sf-n24-field sf-n24-span"><span>Source refs autorizadas (múltiplas)</span>
                    <select multiple size={Math.min(6, Math.max(2, props.record.sourceRefs.length))}
                      disabled={!canWrite()} value={assumption.sourceIds}
                      onChange={(event) => {
                        setForm("assumptions", index(), "sourceIds",
                          Array.from(event.currentTarget.selectedOptions, (option) => option.value))
                        edit()
                      }}>
                      <For each={props.record.sourceRefs}>{(source) =>
                        <option value={source.refId}>{source.refId} · {source.evidenceLevel}</option>}
                      </For>
                    </select>
                  </label>
                </div>
                <button class="mx-btn" type="button" disabled={!canWrite()}
                  onClick={() => { setForm("assumptions", (items) => items.filter((_, n) => n !== index())); edit() }}>Remover premissa</button>
              </div>
            }</For>
            <button type="button" class="mx-btn" disabled={!canWrite()}
              onClick={() => { setForm("assumptions", (items) => [...items, blankAssumption()]); edit() }}>Adicionar premissa</button>
          </Show>
        </div>
        <Show when={form.phase === "reviewing" && form.prepared}>
          {(request) => <div class="sf-n24-review" role="group" aria-label="Revisão da escrita com CAS">
            <h3>Confirmar escrita governada</h3>
            <p>Case version: {request().caseRef.version} · fonte: <bdi>{request().coverageRef}</bdi></p>
            <p><bdi>{request().title}</bdi> · {request().scenario.operations.length} operações · {request().scenario.assumptions.length} premissas</p>
            <ul class="sf-n24-list"><For each={request().scenario.assumptions.flatMap((item) => item.evidenceRefs)}>
              {(source) => <li><bdi>{source.refId}</bdi></li>}
            </For></ul>
          </div>}
        </Show>
        <Show when={form.phase === "committed" && form.receipt}>
          {(receipt) => <div class="sf-n24-review" role="status">
            <strong>Produtor confirmou a gravação.</strong>
            <p>Case v{receipt().caseVersion} · resultado <bdi>{receipt().resultRef}</bdi> · tentativa <bdi>{receipt().correlation}</bdi>.</p>
            <button type="button" class="mx-btn" onClick={props.onReload}>Releitura autorizada</button>
          </div>}
        </Show>
        <Show when={form.error}><p role="alert">{form.error}</p></Show>
        
        <div class="sf-n24-actions">
          <button type="button" class="mx-btn primary"
            disabled={!canWrite() || !selected()}
            onClick={() => form.phase === "reviewing" ? void commit() : review()}>
            {form.phase === "reviewing" ? "Confirmar (CAS)" : "Revisar alteração"}
          </button>
          <Show when={form.phase === "reviewing"}>
            <button type="button" class="mx-btn" onClick={edit}>Voltar à edição</button>
          </Show>
        </div>
      </Show>
    </section>
  )
}
