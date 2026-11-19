import { For, Show, createEffect, createSignal, onCleanup } from "solid-js"
import type { Schema } from "effect"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { createSfReviewsClient } from "@orchestra/client/sucafina/reviews"
import { SfDashboardDashboardHistory } from "@orchestra/schema/sucafina/reviews"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../context"

type History = Extract<Schema.Schema.Type<typeof SfDashboardDashboardHistory.output>, { status: "ok" }>["value"]
const object = (value: unknown): Record<string, unknown> | undefined =>
  value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
const rows = (value: unknown): readonly unknown[] => Array.isArray(value) ? value : []

/** An original individual capture in C08 preferences, distinct from a preserved agenda. */
export function SfHotTopicCapture(props: { topicId: string; version?: number; year?: number }) {
  const context = useSfContext(), language = useLanguage()
  const t = (key: string) => language.t(key as Parameters<typeof language.t>[0])
  const current = () => context.state().status === "ready" ? context.ready() : undefined
  const admitted = (operationId: string) => current()?.context.availability.some((resource) =>
    (operationId === "dashboard.dashboard-workbench" ? resource.family === "domain-read" && resource.resource === "CAP02"
      : resource.family === "reviews" && resource.resource === "agenda") &&
    resource.operations.some((operation) => operation.operationId === operationId && operation.state === "ready" && operation.operational)) === true
  const [source, setSource] = createSignal<{ sourceRef: string; label: string }>()
  const [options, setOptions] = createSignal<{ ref: string; label: string }[]>([])
  const [selected, setSelected] = createSignal("")
  const [history, setHistory] = createSignal<History>()
  const [canCapture, setCanCapture] = createSignal(false)
  const [busy, setBusy] = createSignal(false)
  const [uncertain, setUncertain] = createSignal(false)
  const [message, setMessage] = createSignal("")
  let controller: AbortController | undefined, sequence = 0, owner: string | undefined
  const clear = () => {
    setSource(undefined); setOptions([]); setSelected(""); setHistory(undefined); setCanCapture(false)
  }
  const revoke = () => { clear(); setUncertain(false); setMessage("sf.u38.captureDenied") }
  function begin() {
    const ready = current()
    if (!ready) return
    controller?.abort()
    const active = new AbortController(), ticket = ++sequence, generation = context.generation()
    controller = active; setBusy(true)
    return { ready, active, ticket, live: () => !active.signal.aborted && sequence === ticket &&
      context.generation() === generation && current()?.transport === ready.transport }
  }
  function finish(call: NonNullable<ReturnType<typeof begin>>) {
    if (controller === call.active) controller = undefined
    if (sequence === call.ticket) setBusy(false)
  }
  async function discover() {
    if (!admitted("dashboard.dashboard-workbench")) return
    const call = begin()
    if (!call) return
    setCanCapture(false); setHistory(undefined)
    try {
      const year = props.year
      const result = await createSfDomainClient(call.ready.transport)["dashboard.dashboard-workbench"]({
        page: "Hot Topics & Actions",
        ...(year === undefined ? {} : { period: { start: String(year) + "-01-01", end: String(year) + "-12-31" } }),
      }, { signal: call.active.signal })
      if (!call.live()) return
      if (result.kind === "response" && result.body.status === "denied") { revoke(); return }
      if (result.kind !== "response" || result.body.status !== "ok") { setMessage("sf.u38.captureUnavailable"); return }
      const value = object(result.body.value)
      const matches = rows(value?.records).flatMap((entry) => {
        const row = object(entry), target = object(object(row?.draft)?.target)
        return typeof row?.sourceRef === "string" && typeof row.label === "string" && target?.surface === "dashboard" &&
          target.type === "hotTopics" && target.id === props.topicId ? [{ sourceRef: row.sourceRef, label: row.label }] : []
      })
      setSource(matches.length === 1 ? matches[0] : undefined)
      const available = rows(value?.history).flatMap((entry) => {
        const row = object(entry)
        return row?.kind === "capture" && typeof row.ref === "string" && typeof row.label === "string"
          ? [{ ref: row.ref, label: row.label }] : []
      })
      setOptions(available)
      setCanCapture(matches.length === 1 && object(value?.permissions)?.capture === true)
      setMessage(matches.length === 1 ? "" : "sf.u38.captureUnavailable")
    } catch { if (call.live()) setMessage("sf.u38.captureUnavailable") }
    finally { finish(call) }
  }
  async function open(reference = selected()) {
    if (!reference || busy() || !admitted("dashboard.dashboard-history")) return
    const call = begin()
    if (!call) return
    setHistory(undefined)
    try {
      const result = await createSfReviewsClient(call.ready.transport)["dashboard.dashboard-history"](
        { id: reference }, { signal: call.active.signal })
      if (!call.live()) return
      if (result.kind === "response" && result.body.status === "denied") { revoke(); return }
      if (result.kind !== "response" || result.body.status !== "ok") { setMessage("sf.u38.captureUnavailable"); return }
      const value = result.body.value
      const sources = value.projection.context.sourceRefs, original = sources[0]
      if (value.captureId !== reference || sources.length !== 1 || !original || original.surface !== "dashboard" ||
        original.type !== "hotTopics" || original.id !== props.topicId) {
        setMessage("sf.u38.captureUnavailable"); return
      }
      setHistory(value); setSelected(reference); setMessage("")
    } catch { if (call.live()) setMessage("sf.u38.captureUnavailable") }
    finally { finish(call) }
  }
  async function capture() {
    const selectedSource = source()
    if (!selectedSource || busy() || uncertain() || !canCapture() || !admitted("dashboard.dashboard-capture")) return
    const call = begin()
    if (!call) return
    let saved: string | undefined
    try {
      const result = await createSfReviewsClient(call.ready.transport)["dashboard.dashboard-capture"](
        { sourceRef: selectedSource.sourceRef }, { signal: call.active.signal, idempotencyKey: crypto.randomUUID() })
      if (!call.live()) return
      if (result.kind !== "response") { setUncertain(true); return }
      if (result.body.status === "denied") { setCanCapture(false); setMessage("sf.u38.captureWriteDenied"); return }
      if (result.body.status !== "ok") { setCanCapture(false); setMessage("sf.u38.captureUnavailable"); return }
      saved = result.body.value.captureId
      setSelected(saved)
    } catch { if (call.live()) setUncertain(true) }
    finally { finish(call) }
    if (saved && call.live()) { await discover(); await open(saved) }
  }
  createEffect(() => {
    const ready = current(), status = context.state().status
    const generation = context.generation(), id = props.topicId, version = props.version, year = props.year
    void generation; void id; void version; void year
    if (!ready) {
      controller?.abort(); sequence++; clear(); setBusy(false)
      if (status === "denied" || status === "unauthenticated" || status === "context-mismatch") revoke()
      return
    }
    const stamp = ready.context.stamp
    const identity = JSON.stringify([stamp.installationId, stamp.hostId, stamp.projectId, stamp.principalRef])
    if (owner !== identity) { clear(); setUncertain(false); owner = identity }
    if (!ready.context.destinations.some((destination) => destination.capabilityId === "CAP02" && destination.canRead)) { revoke(); return }
    void discover()
  })
  onCleanup(() => { controller?.abort(); sequence++; clear() })
  return <section class="sf-u38-section" data-sf-record-capture aria-label={t("sf.u38.captureTitle")}>
    <h3>{t("sf.u38.captureTitle")}</h3>
    <Show when={source()}>{(record) => <p>{record().label}</p>}</Show>
    <div class="sf-u38-actions">
      <button type="button" class="mx-btn" disabled={busy() || uncertain() || !canCapture() || !admitted("dashboard.dashboard-capture")}
        onClick={() => { void capture() }}>{t("sf.u38.captureRecord")}</button>
      <button type="button" class="mx-btn" disabled={busy() || !admitted("dashboard.dashboard-workbench")}
        onClick={() => { void discover() }}>{t("sf.u38.captureRefresh")}</button>
    </div>
    <label>{t("sf.u38.captureSelect")}<select aria-label={t("sf.u38.captureSelect")} value={selected()} disabled={busy()}
      onChange={(event) => { setSelected(event.currentTarget.value); setHistory(undefined) }}>
      <option value="">{t("sf.u38.captureSelect")}</option>
      <For each={options()}>{(option) => <option value={option.ref}>{option.label}</option>}</For>
    </select></label>
    <button type="button" class="mx-btn" disabled={busy() || !selected() || !admitted("dashboard.dashboard-history")}
      onClick={() => { void open() }}>{t("sf.u38.captureOpen")}</button>
    <Show when={history()}>{(capture) => <section data-sf-capture-history>
      <h4>{t("sf.u38.captureHistorical")}</h4>
      <dl><dt>{t("sf.u38.captureReference")}</dt><dd>{capture().captureId}</dd>
        <dt>{t("sf.u38.captureAt")}</dt><dd><time dateTime={capture().capturedAt}>{capture().capturedAt}</time></dd>
        <dt>{t("sf.u38.captureBy")}</dt><dd>{capture().capturedBy}</dd></dl>
      <For each={capture().projection.context.sourceRefs}>{(ref) => <p>
        {t("sf.u25.sourceRef")}: {ref.surface} · {ref.type} · {ref.id} · {t("sf.u25.sourceVersion")} {ref.version} · {t("sf.u25.incarnation")} {ref.incarnation}
      </p>}</For>
      <table aria-label={t("sf.u38.captureHistorical")}><thead><tr>
        <th>{t("sf.u25.field")}</th><th>{t("sf.u25.value")}</th><th>{t("sf.u25.period")}</th><th>{t("sf.u25.evidence")}</th>
      </tr></thead><tbody><For each={capture().projection.values}>{(value) => <tr>
        <td>{value.id}</td><td>{((value.value === null ? t("sf.u25.unavailableValue") : String(value.value)) + " " + (value.currency ?? value.unit ?? "")).trim()}</td>
        <td>{value.period.start} – {value.period.end}</td><td>{t("sf.u25.evidence." + value.evidenceState)}</td>
      </tr>}</For></tbody></table>
    </section>}</Show>
    <Show when={uncertain()}><p role="alert">{t("sf.u38.captureUnknown")}</p></Show>
    <Show when={message()}><p role="status">{t(message())}</p></Show>
  </section>
}
