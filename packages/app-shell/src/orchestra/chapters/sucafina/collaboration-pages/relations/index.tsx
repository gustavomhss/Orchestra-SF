import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from "solid-js"
import { Schema } from "effect"
import { useLanguage } from "@/context/language"
import { SF_U44_COPY } from "@/i18n/orchestra-chapters/sf-u44"
import { createSfCollaborationClient } from "@orchestra/client/sucafina/collaboration"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { SfCollaboration, SfRelationPair } from "@orchestra/schema/sucafina/collaboration"
import type { SfRef, SfVersion } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfRelations, type SfRelationTarget, type SfRelation } from "../../collaboration"
import { operationGranted } from "../../collaboration/grant"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel, type SfUiState } from "../../shared/states"
import "./relations.css"
import "../../reviews/workflows.css"

type Relation = Extract<typeof SfCollaboration.operations["collaboration.relation-read"]["output"]["Type"], { status: "ok" }>["value"]["relations"][number]
type Pair = typeof SfRelationPair.Type
type Snapshot = Readonly<{
  transport: SfTransport; generation: number; ownerKey: string; accessRevision: string;
  installationId: string; projectId: string;
}>
function sameEvidence(left: readonly { refId: string }[], right: readonly { refId: string }[]) {
  return left.length === right.length && left.every((item, index) => item.refId === right[index]?.refId)
}
function stateOf(value: { kind: string; status?: number; reason?: string; body?: unknown }): SfUiState {
  if (value.kind === "transport-error") return value.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable"
  if (value.status === 401) return "session-expired"
  if (value.status === 403) return "denied"
  const status = (value.body as { status?: string } | undefined)?.status
  if (status === "conflict") return "conflict"
  if (status === "invalid" || status === "needs-input") return "invalid"
  if (status === "denied") return "denied"
  if (status === "stale") return "stale"
  return "unavailable"
}
export function SfRelationsView(props: SfSurfaceProps<"UI51">) {
  const owner = useSfContext()
  const language = useLanguage()
  type Key = Parameters<typeof SfPageFrame>[0]["titleKey"]
  const key = (s: keyof typeof SF_U44_COPY | "sf.common.unavailable" | "sf.common.loading" |
    "sf.common.empty" | "sf.common.noAccess" | "sf.common.loginAgain" | "sf.common.invalidLink" |
    "sf.common.conflict" | "sf.common.operationUnknown" | "sf.common.partial"): Key => s as Key
  const t = (s: keyof typeof SF_U44_COPY) => language.t(s as Parameters<typeof language.t>[0])
  const [source, setSource] = createSignal("")
  const [relations, setRelations] = createSignal<readonly Relation[]>([])
  const [storageVersion, setStorageVersion] = createSignal<number>()
  const [state, setState] = createSignal<SfUiState>("ready")
  const [query, setQuery] = createSignal("")
  const [target, setTarget] = createSignal("")
  const [kind, setKind] = createSignal("")
  const [evidenceText, setEvidenceText] = createSignal("")
  const [preparedPair, setPreparedPair] = createSignal<Pair>()
  const [removeDraft, setRemoveDraft] = createSignal<{ id: string; version: SfVersion }>()
  const [pending, setPending] = createSignal<{ key: string; operation: "create" | "remove" }>()
  const [busy, setBusy] = createSignal(false)
  const [error, setError] = createSignal<keyof typeof SF_U44_COPY>()
  let readAbort: AbortController | undefined
  let writeAbort: AbortController | undefined
  const snapshot = (): Snapshot | undefined => {
    const state = owner.state(), ready = owner.ready()
    return state.status === "ready" && ready ? {
      transport: ready.transport, generation: owner.generation(), ownerKey: state.ownerKey,
      accessRevision: state.context.stamp.accessRevision,
      installationId: state.binding.installationId, projectId: state.binding.projectId,
    } : undefined
  }
  const granted = (operationId: string) => operationGranted(owner.ready()?.context, operationId)
  const principal = () => {
    const state = owner.state()
    return state.status === "ready" ? state.context.stamp.principalRef : ""
  }
  const current = (s: Snapshot, signal: AbortSignal) => {
    const now = snapshot()
    return !signal.aborted && !!now && s.transport === now.transport &&
      s.ownerKey === now.ownerKey && s.accessRevision === now.accessRevision && s.generation === now.generation
  }
  const routeSource = () => props.route.kind === "case-alias" ? String(props.route.params.caseRef) :
    props.route.query.source ? String(props.route.query.source) : ""
  createEffect(on(() => {
    const state = owner.state()
    return state.status === "ready" ? state.ownerKey + "|" + state.context.stamp.accessRevision + "|" + owner.generation()
      : state.status + "|" + owner.generation()
  }, () => {
    readAbort?.abort(); writeAbort?.abort()
    setRelations([]); setStorageVersion(undefined); setState("ready")
    setSource(routeSource()); setQuery(""); setTarget(""); setKind("")
    setEvidenceText(""); setPreparedPair(undefined); setRemoveDraft(undefined)
    setPending(undefined); setBusy(false); setError(undefined)
  }))
  onCleanup(() => { readAbort?.abort(); writeAbort?.abort() })
  const read = async (selected = source()) => {
    const s = snapshot()
    if (!s || !selected.trim()) { setState("invalid"); return }
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setState("loading"); setRelations([]); setStorageVersion(undefined)
    setSource(selected)
    try {
      const client = createSfCollaborationClient(s.transport)
      const result = await client["collaboration.relation-read"]({ recordRefs: [selected] }, { signal: abort.signal })
      if (!current(s, abort.signal) || source() !== selected) return
      if (result.kind !== "response" || result.body.status !== "ok") {
        setState(stateOf(result)); return
      }
      const version = await client["collaboration.storage-version"]({ namespace: "relations" }, { signal: abort.signal })
      if (!current(s, abort.signal) || source() !== selected) return
      setRelations(result.body.value.relations)
      if (version.kind === "response" && version.body.status === "ok") {
        setStorageVersion(version.body.value)
        setState(result.body.value.relations.length ? "ready" : "empty")
      } else setState("partial")
    } catch { if (current(s, abort.signal)) setState("unavailable") }
  }
  const readReference = async (relationRef: string) => {
    const s = snapshot()
    if (!s || !relationRef.trim()) { setState("invalid"); return }
    readAbort?.abort()
    const abort = new AbortController()
    readAbort = abort
    setState("loading"); setRelations([]); setStorageVersion(undefined)
    try {
      const client = createSfCollaborationClient(s.transport)
      const result = await client["collaboration.relation-read"]({ relationRef }, { signal: abort.signal })
      if (!current(s, abort.signal) || props.route.kind !== "entry" || props.route.params.relationRef !== relationRef) return
      if (result.kind !== "response" || result.body.status !== "ok") { setState(stateOf(result)); return }
      const rows = result.body.value.relations
      if (rows.length !== 1 || rows[0]?.id !== relationRef) { setState("unavailable"); return }
      const version = await client["collaboration.storage-version"]({ namespace: "relations" }, { signal: abort.signal })
      if (!current(s, abort.signal) || props.route.kind !== "entry" || props.route.params.relationRef !== relationRef) return
      setSource(rows[0]!.fromRef); setRelations(rows)
      if (version.kind === "response" && version.body.status === "ok") { setStorageVersion(version.body.value); setState("ready") }
      else setState("partial")
    } catch { if (current(s, abort.signal)) setState("unavailable") }
  }
  createEffect(on(() => {
    const state = owner.state()
    return state.status === "ready" && props.route.kind === "entry"
      ? `${state.ownerKey}|${owner.generation()}|${props.route.params.relationRef}` : ""
  }, (ready) => {
    if (ready && props.route.kind === "entry") void readReference(props.route.params.relationRef)
  }))
  // Query and case-alias routes keep their original record-reference read.
  createEffect(on(routeSource, (ref) => { if (ref && snapshot() && source() === ref) void read(ref) }, { defer: true }))
  const visibleRelations = createMemo<readonly SfRelation[]>(() => relations()
    .filter((record) => record.fromRef === source())
    .map((record) => ({
      ref: record.id as SfRef, sourceRef: record.fromRef as SfRef,
      targetRef: record.toRef as SfRef, kind: record.kind,
      sourceLabel: { kind: "data", text: record.fromRef },
      targetLabel: { kind: "data", text: record.toRef },
      version: (storageVersion() ?? 0) as SfVersion,
      canRemove: granted("collaboration.relation-remove") && storageVersion() !== undefined && !pending(),
    })))
  const candidates = createMemo<readonly SfRelationTarget[]>(() => {
    const seen = new Map<string, { id: string; kinds: Set<string> }>()
    for (const relation of relations()) {
      if (relation.fromRef !== source()) continue
      const found = seen.get(relation.toRef) ?? { id: relation.toRef, kinds: new Set<string>() }
      found.kinds.add(relation.kind)
      seen.set(relation.toRef, found)
    }
    const q = query().trim().toLocaleLowerCase()
    return Array.from(seen.values()).filter((candidate) => candidate.id.toLocaleLowerCase().includes(q))
      .map((candidate) => ({
        ref: candidate.id as SfRef, kind: "record",
        label: { kind: "data", text: candidate.id },
        // These are displayed source kinds, not an implicit permission catalog.
        allowedRelationKinds: [...candidate.kinds].map((name) => ({ id: name, label: { key: "sf.u44.observedKind" as SfRelationTarget["allowedRelationKinds"][number]["label"]["key"], params: { kind: name } } })),
      }))
  })
  const reviewPair = (pair: Pair) => {
    if (!source() || pair.fromRef !== source() || pair.fromRef === pair.toRef || !pair.evidenceRefs.length) {
      setError("sf.u44.evidenceMismatch"); return
    }
    const s = snapshot()
    if (!s || pair.evidenceRefs.some((e) => e.installationId !== s.installationId || e.projectId !== s.projectId) ||
        !pair.evidenceRefs.some((e) => e.refId === pair.fromRef) ||
        !pair.evidenceRefs.some((e) => e.refId === pair.toRef)) {
      setError("sf.u44.evidenceMismatch"); return
    }
    setPreparedPair(pair)
    setError(undefined)
  }
  const prepareManual = () => {
    try {
      const parsed: unknown = JSON.parse(evidenceText())
      const decoded = Schema.decodeUnknownSync(SfRelationPair)({
        fromRef: source().trim(), toRef: target().trim(), kind: kind().trim(), evidenceRefs: parsed,
      })
      reviewPair(decoded)
    } catch { setError("sf.u44.evidenceMismatch"); setPreparedPair(undefined) }
  }
  const prepareKnown = (request: { sourceRef: SfRef; targetRef: SfRef; kind: string }) => {
    if (!granted("collaboration.relation-create")) return
    const found = relations().find((item) =>
      item.fromRef === request.sourceRef && item.toRef === request.targetRef && item.kind === request.kind)
    if (!found || !found.evidenceRefs.length) { setError("sf.u44.evidenceMismatch"); return }
    reviewPair({ fromRef: found.fromRef, toRef: found.toRef, kind: found.kind, evidenceRefs: found.evidenceRefs })
  }
  const submitCreate = async () => {
    const s = snapshot(), pair = preparedPair(), version = storageVersion()
    if (!s || !pair || version === undefined || pending() || !granted("collaboration.relation-create")) return
    if (source() !== pair.fromRef) { setPreparedPair(undefined); setState("stale"); return }
    const idempotencyKey = crypto.randomUUID()
    const abort = new AbortController()
    writeAbort = abort
    setPending({ key: idempotencyKey, operation: "create" })
    setBusy(true)
    const result = await createSfCollaborationClient(s.transport)["collaboration.relation-create"]({
      operation: "create", pair, mutation: { expectedStorageVersion: version, idempotencyKey },
    }, { signal: abort.signal, idempotencyKey }).catch(() => undefined)
    if (!current(s, abort.signal)) return
    setBusy(false)
    if (!result) { setState("outcome-unknown"); return }
    if (result.kind === "response" && result.body.status === "ok") {
      const value = result.body.value
      if (!value.id.trim() || !value.confirmedAt.trim() || value.confirmedBy !== principal() ||
          value.fromRef !== pair.fromRef || value.toRef !== pair.toRef || value.kind !== pair.kind ||
          !sameEvidence(value.evidenceRefs, pair.evidenceRefs)) {
        setState("outcome-unknown"); return
      }
      setPending(undefined); setPreparedPair(undefined); setEvidenceText("")
      await read(pair.fromRef); return
    }
    const next = stateOf(result)
    setState(next)
    if (next !== "outcome-unknown") setPending(undefined)
  }
  const confirmRemove = async () => {
    const s = snapshot(), removal = removeDraft(), version = storageVersion()
    if (!s || !removal || version === undefined || pending() || !granted("collaboration.relation-remove") || removal.version !== version) {
      setState("conflict"); return
    }
    const found = relations().find((r) => r.id === removal.id && r.fromRef === source())
    if (!found) { setState("conflict"); return }
    const abort = new AbortController()
    writeAbort = abort
    const idempotencyKey = crypto.randomUUID()
    setPending({ key: idempotencyKey, operation: "remove" }); setBusy(true)
    const result = await createSfCollaborationClient(s.transport)["collaboration.relation-remove"]({
      operation: "remove", id: found.id,
      pair: { fromRef: found.fromRef, toRef: found.toRef, kind: found.kind, evidenceRefs: found.evidenceRefs },
      mutation: { expectedStorageVersion: version, idempotencyKey },
    }, { signal: abort.signal, idempotencyKey }).catch(() => undefined)
    if (!current(s, abort.signal)) return
    setBusy(false)
    if (!result) { setState("outcome-unknown"); return }
    if (result.kind === "response" && result.body.status === "ok") {
      const value = result.body.value
      if (!value.id.trim() || value.id !== found.id || value.fromRef !== found.fromRef ||
          value.toRef !== found.toRef || value.kind !== found.kind ||
          !sameEvidence(value.evidenceRefs, found.evidenceRefs)) {
        setState("outcome-unknown"); return
      }
      setPending(undefined); setRemoveDraft(undefined)
      await read(source()); return
    }
    const next = stateOf(result)
    setState(next)
    if (next !== "outcome-unknown") setPending(undefined)
  }
  const effectiveState = (): SfUiState => {
    const base = owner.state().status
    return base === "ready" ? state() : base === "denied" ? "denied" :
      base === "unauthenticated" ? "session-expired" : base === "resolving" ? "loading" : "unavailable"
  }
  const stateKey = (value: SfUiState): Key => key(value === "loading" ? "sf.common.loading" :
    value === "denied" ? "sf.common.noAccess" : value === "session-expired" ? "sf.common.loginAgain" :
    value === "empty" ? "sf.common.empty" : value === "invalid" ? "sf.common.invalidLink" :
    value === "conflict" ? "sf.common.conflict" : value === "outcome-unknown" ? "sf.common.operationUnknown" :
    value === "partial" ? "sf.common.partial" : "sf.common.unavailable")
  return (
    <SfPageFrame
      titleKey={key("sf.ui51.title")} subtitleKey={key("sf.u44.relationsSubtitle")}
      context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => undefined}
    >
      <div data-sf-wave="polish" class="sf-u44-relations sf-workflow" data-sf-surface="UI51">
        <Show when={owner.state().status === "ready"}>
          <form class="sf-u44-relation-source sf-form" onSubmit={(event) => { event.preventDefault(); void read(source()) }}>
            <label>{t("sf.u44.sourceRef")}
              <input data-sf-relations-source required value={source()} onInput={(event) => {
                setSource(event.currentTarget.value); setPreparedPair(undefined)
                setRelations([]); setStorageVersion(undefined); setState("ready")
              }} />
            </label>
            <button type="submit" class="mx-btn" disabled={busy()}>{t("sf.u44.loadRelations")}</button>
          </form>
          <Show when={(props.route.kind === "entry") ? props.route.params.relationRef : undefined}>
            {(relationRef) => <p class="sf-u44-ref">{t("sf.u44.relationRoute")}: <code>{String(relationRef())}</code></p>}
          </Show>
        </Show>
        <SfStatePanel state={effectiveState()} messageKey={stateKey(effectiveState())}
          onRetryRead={() => { if (props.route.kind === "entry") void readReference(props.route.params.relationRef); else void read(source()) }}>
          <Show when={source()}>
            <SfRelations
              sourceRef={source() as SfRef}
              relations={visibleRelations()}
              candidates={candidates()}
              state={effectiveState()}
              canWrite={granted("collaboration.relation-create")}
              onSearchTargets={setQuery}
              onCreate={(request) => { if (granted("collaboration.relation-create")) prepareKnown(request) }}
              onRemove={(request) => { if (granted("collaboration.relation-remove") && !pending()) setRemoveDraft({ id: request.relationRef, version: request.expectedVersion }) }}
              onOpen={(ref) => void read(ref)}
            />
            <Show when={relations().some((r) => r.toRef === source() && r.fromRef !== source())}>
              <section aria-label={t("sf.u44.inbound")}>
                <h3>{t("sf.u44.inbound")}</h3>
                <ul><For each={relations().filter((r) => r.toRef === source() && r.fromRef !== source())}>
                  {(record) => <li><code>{record.fromRef}</code> · {language.t("sf.u44.observedKind", { kind: record.kind })}</li>}
                </For></ul>
              </section>
            </Show>
          </Show>
        </SfStatePanel>
        <Show when={owner.state().status === "ready" && !!source() && storageVersion() !== undefined && !pending() && granted("collaboration.relation-create")}>
          <form class="sf-u44-relation-create sf-form" onSubmit={(event) => { event.preventDefault(); prepareManual() }}>
            <h3>{t("sf.u44.createExplicit")}</h3>
            <p>{t("sf.u44.evidenceHelp")}</p>
            <label>{t("sf.u44.targetRef")}
              <input data-sf-relations-target required value={target()} onInput={(event) => { setTarget(event.currentTarget.value); setPreparedPair(undefined) }} />
            </label>
            <label>{t("sf.u44.kind")}
              <input data-sf-relations-kind required value={kind()} onInput={(event) => { setKind(event.currentTarget.value); setPreparedPair(undefined) }} />
            </label>
            <label>{t("sf.u44.evidence")}
              <textarea data-sf-relations-evidence rows={5} required value={evidenceText()}
                onInput={(event) => { setEvidenceText(event.currentTarget.value); setPreparedPair(undefined) }} />
            </label>
            <button class="mx-btn" type="submit" disabled={busy()}>{t("sf.u44.reviewLink")}</button>
          </form>
        </Show>
        <Show when={error()}>{(message) => <p role="alert">{t(message())}</p>}</Show>
        <Show when={preparedPair()}>
          {(pair) => <section class="sf-u44-review" data-sf-relation-review>
            <h3>{t("sf.u44.reviewLink")}</h3>
            <dl><div><dt>{t("sf.u44.sourceRef")}</dt><dd>{pair().fromRef}</dd></div>
              <div><dt>{t("sf.u44.targetRef")}</dt><dd>{pair().toRef}</dd></div>
              <div><dt>{t("sf.u44.kind")}</dt><dd>{language.t("sf.u44.observedKind", { kind: pair().kind })}</dd></div>
              <div><dt>{t("sf.u44.postedEvidence")}</dt><dd><ul>{pair().evidenceRefs.map((item) => <li><code>{item.refId}</code></li>)}</ul></dd></div></dl>
            <button class="mx-btn primary" data-sf-relations-confirm type="button" disabled={busy() || !!pending() || !granted("collaboration.relation-create")}
              onClick={() => void submitCreate()}>{t("sf.u44.confirmLink")}</button>
            <button class="mx-btn" type="button" onClick={() => setPreparedPair(undefined)}>{t("sf.u44.keepEditing")}</button>
          </section>}
        </Show>
        <Show when={removeDraft()}>
          {(value) => <section class="sf-u44-review" data-sf-relation-remove-review>
            <h3>{t("sf.u44.reviewRemove")}</h3><p><code>{value().id}</code></p>
            <Show when={relations().find((item) => item.id === value().id && item.fromRef === source())}>
              {(record) => <div><p>{t("sf.u44.postedEvidence")}</p><ul>{record().evidenceRefs.map((item) => <li><code>{item.refId}</code></li>)}</ul></div>}
            </Show>
            <button class="mx-btn" type="button" onClick={() => setRemoveDraft(undefined)}>{t("sf.u44.keepEditing")}</button>
            <button class="mx-btn danger" type="button" disabled={busy() || !granted("collaboration.relation-remove")} onClick={() => void confirmRemove()}>{t("sf.u44.confirmRemove")}</button>
          </section>}
        </Show>
        <Show when={pending()}>{(value) => <p role="status">{t("sf.u44.pendingIdentity")}: <code>{value().key}</code></p>}</Show>
      </div>
    </SfPageFrame>
  )
}
