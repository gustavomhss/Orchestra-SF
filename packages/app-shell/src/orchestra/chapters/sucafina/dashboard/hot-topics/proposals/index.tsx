import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import type { JSX } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../../context/contracts"
import { useSfContext } from "../../../context"
import { encodeSfRouteRef } from "../../../navigation-state"
import { SfPageFrame } from "../../../shared/frame"
import { SfStatePanel } from "../../../shared/states"
import { SfChangeReview } from "../../../shared/change-review"
import { SF_STATE_FALLBACK_KEY, sfCommonKey, useSfPresentation } from "../../../shared/frame/presentation"
import type { SfCopyKey, SfUiState } from "../../../shared/frame/types"
import { SF_U38_COPY } from "@/i18n/orchestra-chapters/sf-u38"
import { SfHotTopicPrivateDraft } from "./draft"
import "../u38.css"

type Key = keyof typeof SF_U38_COPY
const key = (text: Key): SfCopyKey => text as SfCopyKey
type CaseRef = Readonly<{ id: string; incarnation: string; version: number }>
type CandidateDraft = Readonly<{
  id: string; draftRef: string; incarnation: string; version: number; label: string
  caseRef: CaseRef; fields: Readonly<{ action: string; owner: string; due: string; priority: string; notes: string }>
}>
type Prepared = Readonly<{ caseRef: CaseRef; choiceId: string; changeId: string; label: string; state: string }>
type Preparation = Readonly<{ caseRef: CaseRef; choiceId: string; draftRef: string; label: string; reason: string }>
type Workbench = Readonly<{
  drafts: readonly CandidateDraft[]
  preparations: readonly Preparation[]
  changes: readonly Prepared[]
  permissions: Readonly<{ draft: boolean; prepare: boolean; apply: boolean }>
}>
type Receipt = Readonly<{
  id: string; version: number; at: string
  result: Readonly<{ ok: true }> | Readonly<{ ok: false; status: number; errors: readonly string[] }>
}>
type Review = Readonly<{
  reviewDigest: string; changeId: string; choiceId: string; state: string
  expectedVersion: number; target: Readonly<{ type: string; id: string; label?: string }>
  fields: readonly Readonly<{ field: string; before: string | number | boolean | null; after: string | number | boolean | null }>[]
  receipt?: Readonly<{ id: string; status?: string }>
}>

function obj(value: unknown): Record<string, unknown> | undefined {
  return !!value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}
function string(value: unknown): value is string { return typeof value === "string" && value.length > 0 }
function integer(value: unknown): value is number { return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 }
function caseRef(value: unknown): CaseRef | undefined {
  const ref = obj(value)
  return ref && string(ref.id) && string(ref.incarnation) && integer(ref.version)
    ? { id: ref.id, incarnation: ref.incarnation, version: ref.version } : undefined
}

/** Runtime narrowing of the *producer's* bounded C12 discovery, not a new API DTO. */
function decodeWorkbench(value: unknown): Workbench | undefined {
  const root = obj(value), discovered = obj(root?.decisions)
  if (!discovered || !Array.isArray(discovered.drafts) ||
    !Array.isArray(discovered.preparations) || !Array.isArray(discovered.changes)) return
  const permissions = obj(discovered.permissions)
  if (typeof permissions?.draft !== "boolean" ||
    typeof permissions.prepare !== "boolean" || typeof permissions.apply !== "boolean") return
  const drafts: CandidateDraft[] = []
  for (const raw of discovered.drafts) {
    const item = obj(raw), reference = caseRef(item?.caseRef), fields = obj(item?.fields)
    if (!item || !reference || !fields || !string(item.id) || !string(item.draftRef) ||
      !string(item.incarnation) || !integer(item.version) || !string(item.label) ||
      !string(fields.action) || typeof fields.owner !== "string" || typeof fields.due !== "string" ||
      !string(fields.priority) || typeof fields.notes !== "string") return
    drafts.push({ id: item.id, draftRef: item.draftRef, incarnation: item.incarnation,
      version: item.version, caseRef: reference, label: item.label,
      fields: { action: fields.action, owner: fields.owner, due: fields.due,
        priority: fields.priority, notes: fields.notes } })
  }
  const preparations: Preparation[] = []
  for (const raw of discovered.preparations) {
    const item = obj(raw), reference = caseRef(item?.caseRef)
    if (!item || !reference || !string(item.choiceId) || !string(item.draftRef) ||
      !string(item.label) || typeof item.reason !== "string") return
    preparations.push({ caseRef: reference, choiceId: item.choiceId, draftRef: item.draftRef,
      label: item.label, reason: item.reason })
  }
  const changes: Prepared[] = []
  for (const raw of discovered.changes) {
    const item = obj(raw), reference = caseRef(item?.caseRef)
    if (!item || !reference || !string(item.choiceId) || !string(item.changeId) ||
      !string(item.label) || !string(item.state)) return
    changes.push({ caseRef: reference, choiceId: item.choiceId,
      changeId: item.changeId, label: item.label, state: item.state })
  }
  return { drafts, preparations, changes,
    permissions: { draft: permissions.draft, prepare: permissions.prepare, apply: permissions.apply } }
}
function scalar(value: unknown): value is string | number | boolean | null {
  return value === null || typeof value === "string" || typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
}
function decodeReview(value: unknown, expected: Prepared): Review | undefined {
  const v = obj(value), target = obj(v?.target)
  if (!v || !target || v.changeId !== expected.changeId || v.choiceId !== expected.choiceId ||
    typeof v.reviewDigest !== "string" || !/^[a-f0-9]{64}$/.test(v.reviewDigest) ||
    !string(target.id) || !string(target.type) || !integer(v.expectedVersion) ||
    !string(v.state) || !Array.isArray(v.fields)) return
  const fields: Review["fields"][number][] = []
  for (const raw of v.fields) {
    const f = obj(raw)
    if (!f || !string(f.field) || !scalar(f.before) || !scalar(f.after)) return
    fields.push({ field: f.field, before: f.before, after: f.after })
  }
  const receipt = obj(v.receipt)
  return { reviewDigest: v.reviewDigest, changeId: v.changeId, choiceId: v.choiceId,
    state: v.state, expectedVersion: v.expectedVersion, target: {
      id: target.id, type: target.type, ...(string(target.label) ? { label: target.label } : {}) },
    fields, ...(receipt && string(receipt.id)
      ? { receipt: { id: receipt.id, ...(string(receipt.status) ? { status: receipt.status } : {}) } } : {}) }
}

/** Display fields from the original CommandReceipt; its source identity is checked before retaining them. */
function decodeReceipt(value: unknown, principalRef: string): Receipt | undefined {
  const receipt = obj(value), result = obj(receipt?.result)
  if (!receipt || !result || !string(receipt.id) || !string(receipt.idempotencyKey) ||
    !string(receipt.targetIncarnation) || receipt.principalRef !== principalRef || receipt.surface !== "dashboard" ||
    !string(receipt.commandDigest) || !/^[a-f0-9]{64}$/.test(receipt.commandDigest) ||
    !integer(receipt.version) || !string(receipt.at)) return
  if (result.ok === true) return { id: receipt.id, version: receipt.version, at: receipt.at, result: { ok: true } }
  const status = result.status, errors = result.errors
  if (result.ok !== false || status !== 400 && status !== 403 && status !== 404 && status !== 409 && status !== 422 && status !== 503 ||
    errors !== undefined && (!Array.isArray(errors) || !errors.every((error): error is string => typeof error === "string"))) return
  return { id: receipt.id, version: receipt.version, at: receipt.at, result: { ok: false, status, errors: errors ?? [] } }
}

function proposalRoute(props: SfSurfaceProps<"UI54">, changeId: string): string {
  const query = new URLSearchParams({
    server: props.route.ownerSelection.serverKey,
    project: props.route.ownerSelection.projectId,
  })
  if (props.route.ownerSelection.installationId) query.set("installation", props.route.ownerSelection.installationId)
  return "/orchestra/sf-dashboard/hot-topics/proposals/" + encodeSfRouteRef(changeId) + "?" + query.toString()
}

/**
 * UI54 — C12 workbench → first-party preparation → current producer review →
 * explicit apply → original receipt. Never writes a CAP02 record directly.
 */
export function SfHotTopicProposalView(props: SfSurfaceProps<"UI54">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const shownDate = (value: string) => {
    const iso = value.slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return value
    const date = new Date(iso + "T00:00:00Z")
    if (!Number.isFinite(date.getTime())) return value
    return new Intl.DateTimeFormat(locale(), { dateStyle: "medium", timeZone: "UTC" }).format(date)
  }
  const context = useSfContext()
  const navigate = useNavigate()
  const previewIntent = crypto.randomUUID() as SfIntentRef
  const [revision, bump] = createSignal(0)
  const [applicationResult, setApplicationResult] = createSignal<{
    key: string; generation: number; transport: SfTransport; changeId: string; receipt: Receipt
  }>()
  const [store, setStore] = createStore<{
    state: SfUiState; workbench: Workbench | null; review: Review | null; discovery: unknown
    reason: string | null; preparationBusy: boolean; applyBusy: boolean
    outcome: "none" | "unknown" | "applied" | "rejected"
  }>({ state: "loading", workbench: null, review: null, discovery: null, reason: null,
    preparationBusy: false, applyBusy: false, outcome: "none" })
  const reference = () => props.route.params.proposalRef
  const current = () => context.state().status === "ready" ? context.ready() : undefined
  const receiptHere = () => {
    const saved = applicationResult(), owner = context.state()
    return saved && owner.status === "ready" && owner.ownerKey === saved.key && reference() === saved.changeId &&
      context.generation() === saved.generation && current()?.transport === saved.transport ? saved.receipt : undefined
  }
  const receiptFailure = () => {
    const result = receiptHere()?.result
    return result?.ok === false ? result : undefined
  }
  const isAdmitted = (operationId: string) => {
    const ready = current()
    return !!ready?.context.availability.some((resource) =>
      resource.family === "domain-read" && resource.resource === "hot-topic-proposal" &&
      resource.operations.some((op) => op.operationId === operationId &&
        op.state === "ready" && op.operational))
  }
  const chosenDraft = createMemo(() => store.workbench?.drafts.find((item) =>
    item.id === reference() || item.draftRef === reference()))
  const chosenChange = createMemo(() => store.workbench?.changes.find((item) =>
    item.changeId === reference()))
  const suggestedPreparation = createMemo(() =>
    store.workbench?.preparations.find((item) => item.draftRef === chosenDraft()?.draftRef))
  const readState = () => store.state === "ready" && reference() !== "new" && !chosenChange() && !chosenDraft()
    ? "not-found" as const : store.state

  createEffect(() => {
    const generation = context.generation()
    const state = context.state()
    const ready = current()
    const refresh = revision()
    void refresh
    if (!ready || state.status !== "ready") {
      setStore({ state: state.status === "unauthenticated" ? "session-expired" :
        state.status === "denied" || state.status === "context-mismatch" ? "denied" :
        state.status === "unavailable" ? "unavailable" : "loading",
        workbench: null, review: null, discovery: null, reason: null });return
    }
    if (!isAdmitted("dashboard.dashboard-workbench")) {
      setStore({ state: "unavailable", workbench: null, review: null, reason: "contract-unavailable" });return
    }
    const abort = new AbortController()
    let completed = false
    setStore({ state: "loading", workbench: null, review: null, discovery: null, reason: null })
    void createSfDomainClient(ready.transport)["dashboard.dashboard-workbench"](
      { page: "Hot Topics & Actions" }, { signal: abort.signal })
      .then((response) => {
        completed = true
        if (abort.signal.aborted || context.generation() !== generation ||
          context.ready()?.transport !== ready.transport) return
        if (response.kind !== "response") {
          setStore({ state: "unavailable", workbench: null, reason: response.reason });return
        }
        if (response.body.status !== "ok") {
          setStore({ state: response.body.status === "denied" ? "denied" :
            response.body.status === "stale" ? "stale" :
            response.body.status === "needs-input" || response.body.status === "invalid" ? "invalid" :
            response.body.status === "conflict" ? "conflict" : "unavailable",
            workbench: null, reason: "reason" in response.body ? response.body.reason ?? null : null });return
        }
        const verified = decodeWorkbench(response.body.value)
        setStore({ state: verified ? "ready" : "unavailable", workbench: verified ?? null, discovery: verified ? response.body.value : null,
          reason: verified ? null : "discovery-contract-mismatch" })
      }).catch((error: unknown) => {
        completed = true
        if (!abort.signal.aborted) setStore({ state: "unavailable", workbench: null,
          reason: error instanceof Error ? error.message : "workbench-read-failed" })
      })
    onCleanup(() => { if (!completed) abort.abort() })
  })

  createEffect(() => {
    const currentChange = chosenChange()
    const ready = current()
    const generation = context.generation()
    if (!currentChange || !ready || !isAdmitted("dashboard.dashboard-hot-topic-review")) {
      setStore("review", null);return
    }
    const abort = new AbortController()
    let completed = false
    setStore("review", null)
    void createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-review"]({
      caseRef: structuredClone(unwrap(currentChange.caseRef)), choiceId: currentChange.choiceId, changeId: currentChange.changeId,
    }, { signal: abort.signal }).then((response) => {
      completed = true
      if (abort.signal.aborted || context.generation() !== generation ||
        context.ready()?.transport !== ready.transport) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        setStore("review", null);setStore("reason",
          response.kind !== "response" ? response.reason : "reason" in response.body ? response.body.reason ?? "review-not-current" : "review-not-current")
        return
      }
      const review = decodeReview(response.body.value, currentChange)
      setStore("review", review ?? null)
      if (!review) setStore("reason", "review-contract-mismatch")
    }).catch(() => {
      completed = true
      if (!abort.signal.aborted) setStore("reason", "review-read-failed")
    })
    onCleanup(() => { if (!completed) abort.abort() })
  })

  async function prepare() {
    const pending = suggestedPreparation(), ready = current()
    if (!pending || !ready || !store.workbench?.permissions.prepare ||
      !isAdmitted("dashboard.dashboard-hot-topic-prepare") || store.preparationBusy) return
    const generation = context.generation()
    setStore("preparationBusy", true)
    try {
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-prepare"]({
        caseRef: structuredClone(unwrap(pending.caseRef)), choiceId: pending.choiceId, draftRef: pending.draftRef,
      }, { signal: new AbortController().signal, idempotencyKey: crypto.randomUUID() })
      if (context.generation() !== generation || current()?.transport !== ready.transport) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        setStore("outcome", response.kind !== "response" ? "unknown" : "rejected")
        return
      }
      const result = obj(response.body.value)
      if (!result || !string(result.changeId) || !caseRef(result.caseRef) ||
        result.choiceId !== pending.choiceId) {setStore("outcome", "unknown");return}
      navigate(proposalRoute(props, result.changeId))
      bump((count) => count + 1)
    } catch {setStore("outcome", "unknown")}
    finally {setStore("preparationBusy", false)}
  }
  async function apply() {
    const change = chosenChange(), currentReview = store.review, ready = current(), owner = context.state()
    if (!change || !currentReview || !ready || owner.status !== "ready" || store.applyBusy ||
      store.outcome === "unknown" || !!receiptHere() || !store.workbench?.permissions.apply ||
      !isAdmitted("dashboard.dashboard-hot-topic-apply") ||
      currentReview.state !== "planned" || change.state !== "planned") return
    const generation = context.generation()
    setStore("applyBusy", true)
    try {
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-apply"]({
        caseRef: structuredClone(unwrap(change.caseRef)), choiceId: change.choiceId, changeId: change.changeId,
        reviewDigest: currentReview.reviewDigest,
      }, { signal: new AbortController().signal, idempotencyKey: crypto.randomUUID() })
      if (context.generation() !== generation || current()?.transport !== ready.transport) return
      if (response.kind !== "response") {setStore("outcome", "unknown");return}
      if (response.body.status !== "ok") {setStore("outcome", "rejected");return}
      const now = context.state()
      if (now.status !== "ready" || now.ownerKey !== owner.ownerKey) return
      const receipt = decodeReceipt(response.body.value, ready.context.stamp.principalRef)
      if (!receipt) {setStore("outcome", "unknown");return}
      setApplicationResult({ key: owner.ownerKey, generation, transport: ready.transport, changeId: change.changeId, receipt })
      setStore({ review: null, outcome: receipt.result.ok ? "applied" : "rejected" })
    } catch {setStore("outcome", "unknown")}
    finally {setStore("applyBusy", false)}
  }

  const displayValue = (value: string | number | boolean | null) => value === null
    ? { kind: "missing" as const, reason: { key: key("sf.u38.unknown") } }
    : { kind: "text" as const, text: { kind: "data" as const, text: String(value) } }
  const before = () => store.review?.fields.map((item) => ({
    path: item.field, label: { key: key(
      (["action", "owner", "due", "priority", "notes"].includes(item.field)
        ? "sf.u38." + item.field : "sf.u38.source") as Key) },
    value: displayValue(item.before),
  })) ?? []
  const after = () => store.review?.fields.map((item) => ({
    path: item.field, label: { key: key(
      (["action", "owner", "due", "priority", "notes"].includes(item.field)
        ? "sf.u38." + item.field : "sf.u38.source") as Key) },
    value: displayValue(item.after),
  })) ?? []

  return <SfPageFrame titleKey={key("sf.ui54.title")} context={[]} tabs={[]} activeTab={null} secondaryActions={[]}
      density="comfortable" layout="reading" onLayoutMode={() => {}}>
    <div class="sf-u38-page" data-sf-surface="UI54">
      <Show when={!chosenChange()}>
        <SfHotTopicPrivateDraft discovery={store.discovery} reference={reference()} denied={store.state === "denied" || store.state === "session-expired"}
          onSaved={(ref) => { navigate(proposalRoute(props, ref)); bump((count) => count + 1) }}
          onDenied={() => setStore({ state: "denied", workbench: null, review: null, discovery: null, reason: null })} />
      </Show>
      <SfStatePanel state={readState()} messageKey={sfCommonKey(SF_STATE_FALLBACK_KEY[readState()])}
        onRetryRead={() => bump((count) => count + 1)}>
        <section class="sf-u38-section">
          <h2>{t(key("sf.u38.proposal"))}</h2>
          <dl class="sf-u38-meta">
            <div><dt>{t(key("sf.u38.proposalReference"))}</dt><dd><bdi>{reference()}</bdi></dd></div>
            <Show when={chosenDraft()}>
              {(draft) => <>
                <div><dt>{t(key("sf.u38.action"))}</dt><dd>{draft().fields.action}</dd></div>
                <div><dt>{t(key("sf.u38.proposalAssignee"))}</dt><dd>{draft().fields.owner || t(key("sf.u38.unknown"))}</dd></div>
                <div><dt>{t(key("sf.u38.due"))}</dt><dd>{draft().fields.due ? <time dateTime={draft().fields.due}>{shownDate(draft().fields.due)}</time> : t(key("sf.u38.unknown"))}</dd></div>
                <div><dt>{t(key("sf.u38.priority"))}</dt><dd>{draft().fields.priority}</dd></div>
                <div><dt>{t(key("sf.u38.notes"))}</dt><dd class="sf-u38-long">{draft().fields.notes}</dd></div>
                <div><dt>{t(key("sf.u38.proposalIdentity"))}</dt><dd><bdi>{draft().caseRef.id}</bdi></dd></div>
              </>}
            </Show>
            <Show when={chosenChange()}>
              {(change) => <>
                <div><dt>{t(key("sf.u38.proposalChange"))}</dt><dd><bdi>{change().changeId}</bdi></dd></div>
                <div><dt>{t(key("sf.u38.proposalIdentity"))}</dt><dd><bdi>{change().caseRef.id}</bdi></dd></div>
                <div><dt>{t(key("sf.u38.proposalChoice"))}</dt><dd><bdi>{change().choiceId}</bdi></dd></div>
                <Show when={!receiptHere()}><div><dt>{t(key("sf.u38.status"))}</dt><dd>{change().state}</dd></div></Show>
              </>}
            </Show>
          </dl>
          <Show when={suggestedPreparation()}>
            {(choice) => <div class="sf-u38-actions">
              <p>{choice().reason}</p>
              <button type="button" class="mx-btn" disabled={!store.workbench?.permissions.prepare ||
                !isAdmitted("dashboard.dashboard-hot-topic-prepare") || store.preparationBusy || store.outcome === "unknown"}
                onClick={() => {void prepare()}}>{t(key("sf.u38.proposalReview"))}</button>
            </div>}
          </Show>
        </section>
        <section class="sf-u38-section">
          <h2>{t(key("sf.u38.proposalSource"))}</h2>
          <p>{t(key("sf.u38.source"))}</p>
          <Show when={store.review?.target}>
            {(target) => <dl class="sf-u38-meta">
              <div><dt>{t(key("sf.u38.confirmSelected"))}</dt>
                <dd><bdi>{target().label ?? target().id}</bdi></dd></div>
              <div><dt>{t(key("sf.u38.version"))}</dt><dd>{store.review?.expectedVersion}</dd></div>
            </dl>}
          </Show>
        </section>
        <Show when={!receiptHere()}><section class="sf-u38-section" aria-label={t(key("sf.u38.proposalReview"))}>
          <h2>{t(key("sf.u38.proposalReview"))}</h2>
          <Show when={chosenChange() && store.review && store.review.state === "planned" &&
            store.workbench?.permissions.apply && isAdmitted("dashboard.dashboard-hot-topic-apply")}
            fallback={<p role="status">{t(key("sf.u38.proposalNeedsReview"))}</p>}>
            <SfChangeReview
              operation={{ ref: ("proposal:" + chosenChange()!.changeId) as SfOperationRef,
                label: { key: key("sf.ui54.primary") },
                scope: { kind: "data", text: chosenChange()!.changeId } }}
              base={{ kind: "persisted", ref: store.review!.target.id as SfRef,
                version: store.review!.expectedVersion, fields: before() }}
              current={{ kind: "persisted", ref: store.review!.target.id as SfRef,
                version: store.review!.expectedVersion, fields: before() }}
              proposed={{ kind: "draft", intentRef: previewIntent,
                sourceRef: store.review!.target.id as SfRef,
                sourceVersion: store.review!.expectedVersion, fields: after() }}
              effects={[]}
              coverage={{ state: "complete", summary: { key: key("sf.u38.proposalSource") },
                reasons: [], knownCount: store.review!.fields.length, expectedCount: store.review!.fields.length }}
              blockingReasons={[]}
              confirmation={{ kind: "admitted", labelKey: key("sf.u38.proposalApply"),
                purpose: "apply", binding: { kind: "producer-review",
                  operationId: "dashboard.dashboard-hot-topic-apply",
                  reviewRef: chosenChange()!.changeId as SfRef,
                  reviewDigest: store.review!.reviewDigest,
                  baseVersion: store.review!.expectedVersion } }}
              state={store.applyBusy ? "loading" : store.outcome === "unknown" ? "outcome-unknown" : "ready"} onConfirm={() => {void apply()}}
              onRevise={() => { if (!store.applyBusy) bump((count) => count + 1) }}
              onCancel={() => { if (!store.applyBusy) bump((count) => count + 1) }} />
          </Show>
        </section>
        <section class="sf-u38-section">
          <h2>{t(key("sf.u38.proposalReceipt"))}</h2>
          <Show when={store.review?.receipt}
            fallback={<p role="status">{t(key("sf.u38.proposalNeedsReview"))}</p>}>
            {(receipt) => <dl class="sf-u38-meta">
              <div><dt>{t(key("sf.u38.proposalReceipt"))}</dt><dd><bdi>{receipt().id}</bdi></dd></div>
              <Show when={receipt().status}><div><dt>{t(key("sf.u38.status"))}</dt>
                <dd>{receipt().status}</dd></div></Show>
            </dl>}
          </Show>
        </section></Show>
        <Show when={!receiptHere() && (store.outcome === "unknown" || store.outcome === "rejected")}><p role="alert" data-proposal-outcome={store.outcome}>
          {t(key(store.outcome === "unknown" ? "sf.u38.savePending" : "sf.u38.applyError"))}
        </p></Show>
        <Show when={store.reason}><p role="status">{t(key("sf.u38.sourceUnknown"))}</p></Show>
      </SfStatePanel>
      <Show when={receiptHere()}>{(receipt) => <section class="sf-u38-section" data-sf-proposal-receipt
          data-receipt-id={receipt().id} aria-label={t(key("sf.u38.proposalReceipt"))}>
        <h2>{t(key("sf.u38.proposalReceipt"))}</h2>
        <dl class="sf-u38-meta">
          <div><dt>{t(key("sf.u38.proposalReceipt"))}</dt><dd><bdi>{receipt().id}</bdi></dd></div>
          <div><dt>{t(key("sf.u38.version"))}</dt><dd data-sf-receipt-version>{receipt().version}</dd></div>
          <div><dt>{t(key("sf.u38.proposalReceiptAt"))}</dt><dd><time dateTime={receipt().at}>{receipt().at}</time></dd></div>
        </dl>
        <p role="alert" data-proposal-outcome={receipt().result.ok ? "applied" : "rejected"}>
          {t(key(receipt().result.ok ? "sf.u38.proposalApplied" : "sf.u38.proposalNotApplied"))}
        </p>
        <Show when={receiptFailure()}>{(result) =>
          <p>{t(key("sf.u38.status"))}: {result().status} · {result().errors.join(" · ")}</p>
        }</Show>
        <button type="button" class="mx-btn" onClick={() => { setApplicationResult(undefined); bump((count) => count + 1) }}>
          {t(key("sf.u38.refresh"))}
        </button>
      </section>}</Show>
    </div>
  </SfPageFrame>
}
