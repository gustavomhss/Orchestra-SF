import { createEffect, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import type { SfContextHandle } from "../../context/contracts"
import { sfFailureUiState, sfOperationReady, type SfCaseRecord } from "../cases/model"

type ThreadEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.thread-read"]["output"]>
type Thread = Extract<ThreadEnvelope, { status: "ok" }>["value"]
type AnswerEnvelope = Schema.Schema.Type<(typeof SfCollaboration.operations)["collaboration.answer-prepare-message"]["output"]>
type Preparation = Extract<AnswerEnvelope, { status: "ok" }>["value"]
type Phase = "loading" | "ready" | "writing" | "replied" | "preparing" |
  "prepared" | "confirming" | "confirmed" | "linking" | "linked" |
  "unavailable" | "failed" | "unknown"
type ReplyReceipt = { id: string; incarnation: string; version: number; key: string }
type ConfirmationReceipt = { ref: string; version: number; key: string }

/**
 * UI37 recipient-owned answer composition:
 * actual thread reply -> producer's message observation -> confirmation -> case link.
 * Each mutation is separate, explicit, CAS-bound and never blindly retried.
 */
export function SfQuestionHumanEditor(props: {
  owner: SfContextHandle
  question: SfCaseRecord["questions"][number]
  record: SfCaseRecord
  onRecorded: () => void
}) {
  const [ui, setUi] = createStore<{
    thread?: Thread; storageVersion?: number
    body: string; phase: Phase; error: string; reply?: ReplyReceipt
    prepared?: Preparation; confirmationVersion?: number
    confirmed?: ConfirmationReceipt; caseReceipt?: { version: number; key: string }
  }>({ body: "", phase: "loading", error: "" })
  let operation: AbortController | undefined
  onCleanup(() => operation?.abort())
  const recipient = () => {
    const ready = props.owner.ready(), thread = ui.thread
    return !!ready && !!thread && thread.id === props.question.id &&
      thread.kind === "clarification" && thread.state === "open" &&
      thread.recipientRef === ready.context.stamp.principalRef &&
      props.question.state === "open" && !props.question.answerRef
  }
  const authorized = (operationId: string) => {
    const ready = props.owner.ready()
    return !!ready && sfOperationReady(ready.context, operationId)
  }
  createEffect(() => {
    const ready = props.owner.ready(), generation = props.owner.generation()
    const questionId = props.question.id
    operation?.abort()
    setUi({ thread: undefined, storageVersion: undefined, body: "",
      prepared: undefined, reply: undefined, confirmed: undefined,
      confirmationVersion: undefined, caseReceipt: undefined, phase: "loading", error: "" })
    if (!ready || !questionId || !authorized("collaboration.thread-read") ||
      !authorized("collaboration.storage-version") || props.question.answerRef) {
      setUi("phase", "unavailable")
      return
    }
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    const client = createSfCollaborationClient(ready.transport)
    void (async () => {
      const thread = await client["collaboration.thread-read"]({ id: questionId }, { signal: abort.signal })
      if (abort.signal.aborted || generation !== props.owner.generation() || props.question.id !== questionId) return
      if (thread.kind !== "response" || thread.body.status !== "ok") {
        setUi({ phase: "unavailable", error: "A pergunta não está disponível à conta autenticada." })
        return
      }
      const entry = thread.body.value
      if (entry.id !== questionId || entry.recipientRef !== ready.context.stamp.principalRef ||
        entry.kind !== "clarification" || entry.state !== "open") {
        setUi({ phase: "unavailable", error: "A autoria exige a conta destinatária e uma pergunta aberta." })
        return
      }
      const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setUi({ phase: "unavailable", error: "Versão CAS de colaboração indisponível." })
        return
      }
      setUi({ thread: entry, storageVersion: version.body.value, phase: "ready", error: "" })
    })().catch((error: unknown) => {
      if (abort.signal.aborted) return
      console.error("Sucafina recipient answer read failed", error)
      setUi({ phase: "unavailable", error: "Leitura da pergunta indisponível." })
    })
  })
  const author = async () => {
    const ready = props.owner.ready(), thread = ui.thread, storageVersion = ui.storageVersion
    if (!ready || !thread || storageVersion === undefined || !recipient() || !ui.body.trim() ||
      ui.phase !== "ready" || !authorized("collaboration.thread-reply") || !!operation) return
    const generation = props.owner.generation()
    const abort = new AbortController()
    operation = abort
    const key = crypto.randomUUID()
    const body = ui.body.trim()
    setUi({ phase: "writing", error: "" })
    try {
      const result = await createSfCollaborationClient(ready.transport)["collaboration.thread-reply"]({
        id: thread.id, body,
        mutation: { expectedStorageVersion: storageVersion, idempotencyKey: key },
      }, { signal: abort.signal, idempotencyKey: key })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (result.kind === "transport-error" || result.kind === "response" && result.status >= 500) {
        setUi({ phase: "unknown", error: `Resposta pode ter sido gravada. Não repetir; chave ${key}.` })
      } else if (result.body.status !== "ok") {
        setUi({ phase: "failed", error: `Produtor rejeitou: ${sfFailureUiState(result.body.status, result.status)}.` })
      } else {
        const current = result.body.value
        const receipt = "mutationReceipt" in current ? current.mutationReceipt : undefined
        if (current.id !== thread.id || !receipt || receipt.action !== "reply" ||
          receipt.threadId !== thread.id || receipt.idempotencyKey !== key ||
          receipt.sourceIncarnation !== thread.sourceIncarnation ||
          receipt.principalRef !== ready.context.stamp.principalRef ||
          !current.messages.some((message) => message.id === receipt.reply.id &&
            message.incarnation === receipt.reply.incarnation && message.version === receipt.reply.version &&
            message.body === body && message.authorRef === ready.context.stamp.principalRef)) {
          setUi({ phase: "unknown", error: `Não há recibo de resposta verificável; não repetir. Chave ${key}.` })
          return
        }
        setUi({ phase: "replied", reply: {
          id: receipt.reply.id, incarnation: receipt.reply.incarnation,
          version: receipt.reply.version, key,
        }, error: "" })
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina human answer write outcome uncertain", error)
        setUi({ phase: "unknown", error: `Resultado incerto; não repetir. Chave ${key}.` })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const prepare = async () => {
    const ready = props.owner.ready(), reply = ui.reply
    if (!ready || !reply || ui.phase !== "replied" || !!operation ||
      !recipient() || !authorized("collaboration.answer-prepare-message") ||
      !authorized("collaboration.storage-version")) return
    const generation = props.owner.generation()
    const abort = new AbortController()
    operation = abort
    setUi({ phase: "preparing", error: "" })
    try {
      const client = createSfCollaborationClient(ready.transport)
      const response = await client["collaboration.answer-prepare-message"]({
        questionId: props.question.id, messageId: reply.id,
        incarnation: reply.incarnation, version: reply.version,
      }, { signal: abort.signal })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        setUi({ phase: "failed", error: "Não foi possível preparar uma observação verificável da mensagem." })
        return
      }
      if (response.body.value.authorRef !== ready.context.stamp.principalRef ||
        response.body.value.answer !== ui.body.trim()) {
        setUi({ phase: "unknown", error: "Mensagem observada não corresponde à resposta do destinatário." })
        return
      }
      const version = await client["collaboration.storage-version"]({ namespace: "threads" }, { signal: abort.signal })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setUi({ phase: "failed", error: "Versão CAS indisponível para confirmar resposta." })
        return
      }
      setUi({ phase: "prepared", prepared: response.body.value, confirmationVersion: version.body.value })
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina human answer preparation unavailable", error)
        setUi({ phase: "failed", error: "Observação da resposta indisponível." })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const confirm = async () => {
    const ready = props.owner.ready(), prepared = ui.prepared, version = ui.confirmationVersion
    if (!ready || !prepared || version === undefined || ui.phase !== "prepared" ||
      !recipient() || !authorized("collaboration.answer-confirm") || !!operation) return
    const generation = props.owner.generation()
    const key = crypto.randomUUID()
    const abort = new AbortController()
    operation = abort
    setUi({ phase: "confirming", error: "" })
    try {
      const result = await createSfCollaborationClient(ready.transport)["collaboration.answer-confirm"]({
        questionId: props.question.id, answerRef: prepared.answerRef,
        mutation: {
          expectedStorageVersion: version, idempotencyKey: key,
          observationRef: prepared.observationRef,
          observedSourceVersion: prepared.observedSourceVersion,
          expectedScopeFingerprint: prepared.expectedScopeFingerprint,
        },
      }, { signal: abort.signal, idempotencyKey: key })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (result.kind === "transport-error" || result.kind === "response" && result.status >= 500) {
        setUi({ phase: "unknown", error: `Confirmação incerta. Não repetir; correlação ${key}.` })
      } else if (result.body.status !== "ok") {
        setUi({ phase: "failed", error: `Confirmação negada: ${sfFailureUiState(result.body.status, result.status)}.` })
      } else if (result.body.value.answerRef !== prepared.answerRef) {
        setUi({ phase: "unknown", error: `Recibo incompatível. Correlação ${key}.` })
      } else {
        setUi({ phase: "confirmed", confirmed: {
          ref: result.body.value.answerRef,
          version: result.body.value.observedVersion, key,
        } })
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina human answer confirmation outcome uncertain", error)
        setUi({ phase: "unknown", error: `Confirmação incerta. Não repetir; correlação ${key}.` })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const link = async () => {
    const ready = props.owner.ready(), answer = ui.confirmed
    if (!ready || !answer || ui.phase !== "confirmed" || !!operation ||
      !recipient() || !authorized("decisions.decision-answer-question")) return
    const generation = props.owner.generation()
    const caseRef = { id: props.record.id, incarnation: props.record.incarnation, version: props.record.version }
    const questionId = props.question.id
    const key = crypto.randomUUID()
    const abort = new AbortController()
    operation = abort
    setUi({ phase: "linking", error: "" })
    try {
      const result = await createSfDecisionsClient(ready.transport)["decisions.decision-answer-question"]({
        caseRef, questionId, answerRef: answer.ref,
      }, { signal: abort.signal, idempotencyKey: key })
      if (abort.signal.aborted || generation !== props.owner.generation()) return
      if (result.kind === "transport-error" || result.kind === "response" && result.status >= 500) {
        setUi({ phase: "unknown", error: `Vínculo ao caso incerto. Não repetir; correlação ${key}.` })
      } else if (result.body.status !== "ok") {
        setUi({ phase: "failed", error: `Vínculo não confirmado: ${sfFailureUiState(result.body.status, result.status)}. O recibo de confirmação foi preservado.` })
      } else if (result.body.value.caseRef.id !== caseRef.id ||
        result.body.value.caseRef.incarnation !== caseRef.incarnation ||
        result.body.value.caseRef.version !== caseRef.version + 1) {
        setUi({ phase: "unknown", error: `Recibo do caso divergente; correlação ${key}.` })
      } else {
        setUi({ phase: "linked", caseReceipt: { version: result.body.value.caseRef.version, key }, error: "" })
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina human answer link outcome uncertain", error)
        setUi({ phase: "unknown", error: `Vínculo incerto. Não repetir; correlação ${key}.` })
      }
    } finally {
      if (operation === abort) operation = undefined
    }
  }
  const busy = () => ui.phase === "writing" || ui.phase === "preparing" ||
    ui.phase === "confirming" || ui.phase === "linking"
  return (
    <section class="sf-n24-review" aria-label="Nova resposta humana do destinatário com CAS">
      <h3>Responder como destinatário autorizado</h3>
      <Show when={recipient()} fallback={
        <p role="status">Somente o destinatário autenticado da pergunta aberta pode criar uma resposta nova. Nenhum grant é presumido.</p>
      }>
        <Show when={ui.phase === "ready"}>
          <label class="sf-n24-field"><span>Resposta humana (não é um answerRef externo)</span>
            <textarea rows={5} value={ui.body} disabled={busy()}
              onInput={(event) => setUi("body", event.currentTarget.value)} />
          </label>
          <p>Thread: <bdi>{ui.thread?.id}</bdi> · threads CAS: {ui.storageVersion}</p>
          <button type="button" class="mx-btn primary" disabled={!ui.body.trim() || !authorized("collaboration.thread-reply")}
            onClick={() => void author()}>Gravar resposta com CAS</button>
        </Show>
        <Show when={ui.reply}>
          {(reply) => <div role="status" class="sf-n24-review">
            <p>Mensagem do destinatário: <bdi>{reply().id}</bdi> · v{reply().version} · recibo <bdi>{reply().key}</bdi></p>
          </div>}
        </Show>
        <Show when={ui.phase === "replied"}>
          <button type="button" class="mx-btn primary" disabled={!authorized("collaboration.answer-prepare-message")}
            onClick={() => void prepare()}>Preparar observação da nova resposta</button>
        </Show>
        <Show when={ui.phase === "prepared" && ui.prepared}>
          {(prepared) => <div class="sf-n24-review">
            <h4>Revisar confirmação (recibo da fonte)</h4>
            <p><bdi>{prepared().answer}</bdi> · <bdi>{prepared().authorRef}</bdi></p>
            <p>Observação: <bdi>{prepared().observationRef}</bdi> · v{prepared().observedSourceVersion}</p>
            <button type="button" class="mx-btn primary"
              onClick={() => void confirm()}>Confirmar resposta humana com CAS</button>
          </div>}
        </Show>
        <Show when={ui.confirmed}>
          {(confirmed) => <div class="sf-n24-review" role="status">
            <p>Resposta confirmada: <bdi>{confirmed().ref}</bdi> · v{confirmed().version} · recibo <bdi>{confirmed().key}</bdi></p>
          </div>}
        </Show>
        <Show when={ui.phase === "confirmed"}>
          <button type="button" class="mx-btn primary" disabled={!authorized("decisions.decision-answer-question")}
            onClick={() => void link()}>Vincular resposta confirmada ao caso com CAS</button>
        </Show>
        <Show when={ui.caseReceipt && ui.phase === "linked"}>
          {(receipt) => <div class="sf-n24-review" role="status">
            <p>Questão respondida no caso v{receipt().version} · tentativa <bdi>{receipt().key}</bdi></p>
            <button type="button" class="mx-btn" onClick={props.onRecorded}>Releitura autorizada do caso</button>
          </div>}
        </Show>
      </Show>
      <Show when={busy()}><p role="status">Confirmando operação com o produtor…</p></Show>
      <Show when={ui.error}><p role="alert">{ui.error}</p></Show>
    </section>
  )
}
