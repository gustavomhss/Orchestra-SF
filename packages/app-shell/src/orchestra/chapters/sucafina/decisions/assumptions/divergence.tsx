import { createEffect, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import type { SfContextHandle } from "../../context/contracts"
import { sfFailureUiState, sfOperationReady, type SfCaseRecord } from "../cases/model"

type Phase = "editing" | "reviewing" | "sending" | "committed" | "failed" | "unknown"
type Source = SfCaseRecord["sourceRefs"][number]

/**
 * UI36 divergence is an authored, source-bound clarification in the existing
 * collaboration producer, NOT a made-up case event or an unverified "confirmed"
 * assumption. Only the producer can admit the source and the threads CAS.
 */
export function SfAssumptionDivergence(props: {
  owner: SfContextHandle
  record: SfCaseRecord
}) {
  const language = useLanguage()
  const [ui, setUi] = createStore<{
    sourceId: string; text: string; phase: Phase; error: string
    receipt?: { threadId: string; sourceId: string; correlation: string; messageId: string }
  }>({ sourceId: "", text: "", phase: "editing", error: "" })
  let controller: AbortController | undefined
  onCleanup(() => controller?.abort())
  createEffect(() => {
    props.owner.generation()
    props.record.id
    props.record.incarnation
    controller?.abort()
    setUi({ sourceId: "", text: "", phase: "editing", error: "", receipt: undefined })
  })
  const eligible = () => props.record.sourceRefs.filter((source) =>
    source.kind === "record" && source.target.version > 0 &&
    source.target.incarnation.length > 0,
  )
  const selected = (): Source | undefined => eligible().find((source) => source.refId === ui.sourceId)
  const writable = () => {
    const ready = props.owner.ready()
    return !!ready && sfOperationReady(ready.context, "collaboration.thread-create") &&
      sfOperationReady(ready.context, "collaboration.storage-version") &&
      ui.phase !== "sending" && ui.phase !== "unknown" && ui.phase !== "committed"
  }
  const review = () => {
    if (!writable() || !selected() || !ui.text.trim()) {
      setUi({ phase: "failed", error: "Uma fonte versionada e a descrição da divergência são obrigatórias." })
      return
    }
    setUi({ phase: "reviewing", error: "" })
  }
  const commit = async () => {
    const source = selected()
    const ready = props.owner.ready()
    if (!source || source.kind !== "record" || !ready || ui.phase !== "reviewing" ||
      !writable() || !!controller || !ui.text.trim()) return
    const generation = props.owner.generation()
    const basis = { id: props.record.id, incarnation: props.record.incarnation, version: props.record.version }
    const text = ui.text.trim()
    const abort = new AbortController()
    controller = abort
    setUi({ phase: "sending", error: "" })
    const key = crypto.randomUUID()
    try {
      const client = createSfCollaborationClient(ready.transport)
      const version = await client["collaboration.storage-version"](
        { namespace: "threads" }, { signal: abort.signal },
      )
      if (abort.signal.aborted || props.owner.generation() !== generation) return
      if (version.kind !== "response" || version.body.status !== "ok") {
        setUi({ phase: "failed", error: "Não foi possível ler a versão CAS do produtor." })
        return
      }
      if (props.record.id !== basis.id || props.record.incarnation !== basis.incarnation ||
        props.record.version !== basis.version || selected()?.refId !== source.refId) {
        setUi({ phase: "failed", error: "Caso/fonte mudou durante a revisão. Recarregue." })
        return
      }
      const result = await client["collaboration.thread-create"]({
        draft: {
          kind: "clarification",
          sourceRef: source.refId,
          sourceIncarnation: source.target.incarnation,
          observedVersion: source.target.version,
          period: source.target.period ?? props.record.horizon,
          evidenceRefs: [source],
          body: text,
        },
        mutation: { expectedStorageVersion: version.body.value, idempotencyKey: key },
      }, { signal: abort.signal, idempotencyKey: key })
      if (abort.signal.aborted || props.owner.generation() !== generation) return
      if (result.kind === "response" && (result.status === 401 || result.status === 403 || result.body.status === "denied")) {
        setUi({ phase: "failed", error: language.t(result.status === 401 ? "sf.common.loginAgain" : "sf.common.noAccess") })
      } else if (result.kind === "transport-error" || result.kind === "response" && result.status >= 500) {
        setUi({ phase: "unknown", error: `Resultado desconhecido; não repetir a mutation. Correlação: ${key}.` })
      } else if (result.kind !== "response") {
        setUi({ phase: "unknown", error: `Resultado desconhecido; não repetir a mutation. Correlação: ${key}.` })
      } else if (result.status !== 200 || result.body.status !== "ok") {
        setUi({ phase: "failed", error: `Produtor não confirmou: ${sfFailureUiState(result.body.status, result.status)}.` })
      } else {
        const thread = result.body.value
        const message = thread.messages[0]
        if (!thread.id || thread.sourceRef !== source.refId ||
          thread.sourceIncarnation !== source.target.incarnation ||
          thread.observedVersion !== source.target.version ||
          message?.body !== text) {
          setUi({ phase: "unknown", error: `Resposta não prova a escrita. Verifique thread; correlação: ${key}.` })
          return
        }
        setUi({ phase: "committed", text: "", receipt: {
          threadId: thread.id, messageId: message.id, sourceId: source.refId, correlation: key,
        } })
      }
    } catch (error) {
      if (!abort.signal.aborted) {
        console.error("Sucafina divergence write outcome uncertain", error)
        setUi({ phase: "unknown", error: `Falha ambígua; não repetir a mutation. Correlação: ${key}.` })
      }
    } finally {
      if (controller === abort) controller = undefined
    }
  }
  return (
    <section class="mx-card sf-n24-section" aria-label="Registrar divergência com CAS e proveniência">
      <h2>Registrar divergência factual / dúvida sobre premissa</h2>
      <p>Uma divergência é registrada como clarificação vinculada à evidência versionada.
        Não altera premissas do caso sem revisão do produtor.</p>
      <Show when={eligible().length} fallback={
        <p role="status">Nenhuma fonte de registro com versão autorizada disponível; autoria bloqueada.</p>
      }>
        <label class="sf-n24-field">
          <span>Fonte factual (sourceRef)</span>
          <select value={ui.sourceId}
            disabled={!writable()}
            onChange={(event) => setUi({ sourceId: event.currentTarget.value, phase: "editing", error: "" })}>
            <option value="">Selecionar fonte do caso…</option>
            <For each={eligible()}>{(source) =>
              <option value={source.refId}>{source.refId} · {source.kind === "record" ? source.target.version : ""}</option>}
            </For>
          </select>
        </label>
        <label class="sf-n24-field">
          <span>Premissa contestada / divergência observada</span>
          <textarea rows={4} value={ui.text} disabled={!writable()} onInput={(event) =>
            setUi({ text: event.currentTarget.value, phase: "editing", error: "" })} />
        </label>
        <Show when={ui.phase === "reviewing" && selected()}>
          {(source) => {
            const chosen = source()
            const record = chosen.kind === "record" ? chosen.target : undefined
            return <div class="sf-n24-review">
            <h3>Confirmar clarificação (threads CAS)</h3>
            <p>kind clarification · case v{props.record.version}</p>
            <p>sourceRef <bdi>{chosen.refId}</bdi></p>
            <p>sourceIncarnation <bdi>{record?.incarnation ?? ""}</bdi></p>
            <p>observedVersion {record?.version ?? ""}</p>
            <p>period {record?.period?.start ?? props.record.horizon.start} – {record?.period?.end ?? props.record.horizon.end}</p>
            <p>evidenceRefs <bdi>{source().refId}</bdi> · <bdi>{source().evidenceLevel}</bdi></p>
            <p>body <bdi>{ui.text.trim()}</bdi></p>
          </div> }}
        </Show>
        <Show when={ui.phase === "committed" ? ui.receipt : undefined}>
          {(receipt) => <div class="sf-n24-review" role="status">
            <p>Clarificação persistida: thread <bdi>{receipt().threadId}</bdi></p>
            <p>Mensagem <bdi>{receipt().messageId}</bdi> · source <bdi>{receipt().sourceId}</bdi> · tentativa <bdi>{receipt().correlation}</bdi></p>
          </div>}
        </Show>
        <Show when={ui.error}><p role="alert">{ui.error}</p></Show>
        <button type="button" class="mx-btn primary"
          disabled={!writable() || !selected()}
          onClick={() => ui.phase === "reviewing" ? void commit() : review()}>
          {ui.phase === "reviewing" ? "Confirmar divergência" : "Revisar divergência"}
        </button>
      </Show>
    </section>
  )
}
