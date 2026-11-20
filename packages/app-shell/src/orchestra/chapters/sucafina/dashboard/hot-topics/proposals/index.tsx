import { SfPrivateHotTopicEditor } from "./private-draft"
import { Show, createEffect, createMemo, createSignal, onCleanup } from "solid-js"
import { clearSfDashboardRecovery, openSfDashboardRecovery, SF_DASHBOARD_RECOVERY_LIFETIME_MS } from "./recovery-intents"
import type { SfDashboardRecoveryIntent, SfDashboardRecoveryStore } from "./recovery-intents"
import { decodeSfDashboardApplicationOutcome } from "./application-outcome"
import type { SfDashboardApplicationOutcome } from "./application-outcome"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import { useNavigate } from "@solidjs/router"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfSurfaceProps } from "../../../context/contracts"
import { useSfContext } from "../../../context"
import { sfHotTopicProposalRoute } from "./proposal-route"
import { SfPageFrame } from "../../../shared/frame"
import { SfStatePanel } from "../../../shared/states"
import { SfChangeReview } from "../../../shared/change-review"
import { SF_STATE_FALLBACK_KEY, sfCommonKey, useSfPresentation } from "../../../shared/frame/presentation"
import type { SfCopyKey, SfUiState } from "../../../shared/frame/types"
import { SF_U38_COPY } from "@/i18n/orchestra-chapters/sf-u38"
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
  cases: readonly CaseRef[]
  drafts: readonly CandidateDraft[]
  preparations: readonly Preparation[]
  changes: readonly Prepared[]
  permissions: Readonly<{ draft: boolean; prepare: boolean; apply: boolean }>
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
  if (!discovered || !Array.isArray(discovered.cases) || !Array.isArray(discovered.drafts) ||
    !Array.isArray(discovered.preparations) || !Array.isArray(discovered.changes)) return
  const permissions = obj(discovered.permissions)
  if (typeof permissions?.draft !== "boolean" ||
    typeof permissions.prepare !== "boolean" || typeof permissions.apply !== "boolean") return
  const cases: CaseRef[] = []
  for (const raw of discovered.cases) {
    const reference = caseRef(obj(raw)?.caseRef)
    if (!reference) return
    cases.push(reference)
  }
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
  return { cases, drafts, preparations, changes,
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


/**
 * UI54 — C12 workbench → first-party preparation → current producer review →
 * explicit apply → original receipt. Never writes a CAP02 record directly.
 */
function SfHotTopicPreparationView(props: SfSurfaceProps<"UI54">): JSX.Element {
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
  const [store, setStore] = createStore<{
    state: SfUiState; workbench: Workbench | null; review: Review | null
    reason: string | null; preparationBusy: boolean; applyBusy: boolean
    outcome: "none" | "unknown" | "applied" | "rejected"
    correlation: "loading" | "ready" | "unavailable"; pending: SfDashboardRecoveryIntent | null
    expired: boolean; receipt: SfDashboardApplicationOutcome | null; recovered: boolean
  }>({ state: "loading", workbench: null, review: null, reason: null,
    preparationBusy: false, applyBusy: false, outcome: "none", correlation: "loading", pending: null,
    expired: false, receipt: null, recovered: false })
  let recoveryStore: SfDashboardRecoveryStore | undefined
  let writeAbort: AbortController | undefined
  const unresolved = (intent: SfDashboardRecoveryIntent, pending: boolean) => intent.kind === "apply" && current()?.drafts.markUnresolved({
    surfaceId: "UI54", identity: { kind: "new", newIntentRef: intent.key as SfIntentRef },
    editScopeKey: "UI54:application" as SfEditScopeKey,
  }, pending)
  const purge = () => {
    writeAbort?.abort()
    clearSfDashboardRecovery(context); recoveryStore = undefined
    setStore({ state: "denied", workbench: null, review: null, pending: null, receipt: null,
      outcome: "none", reason: null, correlation: "unavailable", applyBusy: false })
    context.invalidate("revoked")
  }
  const reference = () => props.route.params.proposalRef
  const current = () => context.state().status === "ready" ? context.ready() : undefined
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
  const pendingApplication = () => store.pending?.kind === "apply" && store.pending.changeId === reference() ? store.pending : undefined
  const readState = () => store.state === "ready" && !chosenChange() && !chosenDraft() && !pendingApplication()
    ? "not-found" as const : store.state
  const canRecover = () => {
    const pending = pendingApplication()
    return !!pending && store.correlation === "ready" && !!recoveryStore?.current() && !store.expired &&
      Date.now() < pending.expiresAt && !store.applyBusy && store.state === "ready" && !!store.workbench?.permissions.apply &&
      store.workbench.cases.some((ref) => ref.id === pending.caseRef.id && ref.incarnation === pending.caseRef.incarnation &&
        ref.version >= pending.caseRef.version) && isAdmitted("dashboard.dashboard-hot-topic-recover")
  }
  createEffect(() => {
    const ready = current(), generation = context.generation()
    if (!ready) {
      recoveryStore = undefined; writeAbort?.abort()
      setStore({ correlation: "loading", pending: null, receipt: null, expired: false })
      return
    }
    let active = true
    setStore("correlation", "loading")
    void openSfDashboardRecovery(context).then((storage) => {
      if (!active || context.generation() !== generation || current()?.transport !== ready.transport) return
      recoveryStore = storage
      const slot = storage?.read()
      if (!slot || slot.state === "unavailable") { setStore({ correlation: "unavailable", outcome: "unknown" }); return }
      if (slot.state === "empty") { setStore({ correlation: "ready", pending: null, expired: false }); return }
      unresolved(slot.intent, true)
      setStore({ correlation: "ready", pending: slot.intent, expired: slot.expired, outcome: "unknown", review: null })
    }).catch(() => { if (active) setStore({ correlation: "unavailable", outcome: "unknown" }) })
    onCleanup(() => { active = false; writeAbort?.abort() })
  })

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
        workbench: null, review: null, reason: null });return
    }
    if (!isAdmitted("dashboard.dashboard-workbench")) {
      setStore({ state: "unavailable", workbench: null, review: null, reason: "contract-unavailable" });return
    }
    const abort = new AbortController()
    setStore({ state: "loading", workbench: null, review: null, reason: null })
    void createSfDomainClient(ready.transport)["dashboard.dashboard-workbench"](
      { page: "Hot Topics & Actions" }, { signal: abort.signal })
      .then((response) => {
        if (abort.signal.aborted || context.generation() !== generation ||
          context.ready()?.transport !== ready.transport) return
        if (response.kind !== "response") {
          setStore({ state: "unavailable", workbench: null, reason: response.reason });return
        }
        if (response.status === 403 || response.body.status === "denied") { purge(); return }
        if (response.body.status !== "ok") {
          setStore({ state: response.body.status === "denied" ? "denied" :
            response.body.status === "stale" ? "stale" :
            response.body.status === "needs-input" || response.body.status === "invalid" ? "invalid" :
            response.body.status === "conflict" ? "conflict" : "unavailable",
            workbench: null, reason: "reason" in response.body ? response.body.reason ?? null : null });return
        }
        const verified = decodeWorkbench(response.body.value)
        setStore({ state: verified ? "ready" : "unavailable", workbench: verified ?? null,
          reason: verified ? null : "discovery-contract-mismatch" })
      }).catch((error: unknown) => {
        if (!abort.signal.aborted) setStore({ state: "unavailable", workbench: null,
          reason: error instanceof Error ? error.message : "workbench-read-failed" })
      })
    onCleanup(() => abort.abort())
  })

  createEffect(() => {
    const currentChange = chosenChange()
    const ready = current()
    const generation = context.generation()
    if (!currentChange || !ready || store.correlation !== "ready" || store.pending || !isAdmitted("dashboard.dashboard-hot-topic-review")) {
      setStore("review", null);return
    }
    const abort = new AbortController()
    setStore("review", null)
    void createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-review"]({
      caseRef: currentChange.caseRef, choiceId: currentChange.choiceId, changeId: currentChange.changeId,
    }, { signal: abort.signal }).then((response) => {
      if (abort.signal.aborted || context.generation() !== generation ||
        context.ready()?.transport !== ready.transport) return
      if (response.kind === "response" && (response.status === 403 || response.body.status === "denied")) { purge(); return }
      if (response.kind !== "response" || response.body.status !== "ok") {
        setStore("review", null);setStore("reason",
          response.kind !== "response" ? response.reason : "reason" in response.body ? response.body.reason ?? "review-not-current" : "review-not-current")
        return
      }
      const review = decodeReview(response.body.value, currentChange)
      setStore("review", review ?? null)
      if (!review) setStore("reason", "review-contract-mismatch")
    }).catch(() => {
      if (!abort.signal.aborted) setStore("reason", "review-read-failed")
    })
    onCleanup(() => abort.abort())
  })

  async function prepare() {
    const pending = suggestedPreparation(), ready = current()
    if (!pending || !ready || !store.workbench?.permissions.prepare ||
      !isAdmitted("dashboard.dashboard-hot-topic-prepare") || store.preparationBusy || store.pending || store.correlation !== "ready") return
    const generation = context.generation(), abort = new AbortController()
    writeAbort?.abort(); writeAbort = abort
    setStore("preparationBusy", true)
    try {
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-prepare"]({
        caseRef: pending.caseRef, choiceId: pending.choiceId, draftRef: pending.draftRef,
      }, { signal: abort.signal, idempotencyKey: crypto.randomUUID() })
      if (abort.signal.aborted || context.generation() !== generation || current()?.transport !== ready.transport) return
      if (response.kind === "response" && (response.status === 403 || response.body.status === "denied")) { purge(); return }
      if (response.kind !== "response" || response.body.status !== "ok") {
        setStore("outcome", response.kind !== "response" ? "unknown" : "rejected")
        return
      }
      const result = obj(response.body.value)
      if (!result || !string(result.changeId) || !caseRef(result.caseRef) ||
        result.choiceId !== pending.choiceId) {setStore("outcome", "unknown");return}
      navigate(sfHotTopicProposalRoute(props, result.changeId))
    } catch { if (!abort.signal.aborted) setStore("outcome", "unknown") }
    finally { if (!abort.signal.aborted) setStore("preparationBusy", false) }
  }
  const acceptReceipt = (value: unknown, intent: SfDashboardRecoveryIntent, recovered: boolean) => {
    const ready = current()
    const receipt = ready && decodeSfDashboardApplicationOutcome(value, ready.context.stamp.principalRef)
    if (!receipt || !recoveryStore?.clear(intent.key)) return false
    unresolved(intent, false)
    setStore({ pending: null, expired: false, receipt, recovered,
      outcome: receipt.status === "applied" ? "applied" : "rejected", review: null })
    bump((count) => count + 1)
    return true
  }
  async function apply() {
    const change = chosenChange(), currentReview = store.review, ready = current()
    if (!change || !currentReview || !ready || store.applyBusy || store.pending || store.correlation !== "ready" ||
      !recoveryStore?.current() || store.outcome === "unknown" || !store.workbench?.permissions.apply ||
      !isAdmitted("dashboard.dashboard-hot-topic-apply") ||
      currentReview.state !== "planned" || change.state !== "planned") return
    const reviewDigest = currentReview.reviewDigest
    const caseRef = { id: change.caseRef.id, incarnation: change.caseRef.incarnation, version: change.caseRef.version }
    const intent: SfDashboardRecoveryIntent = { kind: "apply", key: crypto.randomUUID(), caseRef,
      choiceId: change.choiceId, changeId: change.changeId, expiresAt: Date.now() + SF_DASHBOARD_RECOVERY_LIFETIME_MS }
    if (!recoveryStore.write(intent)) { setStore({ correlation: "unavailable", outcome: "unknown" }); return }
    const generation = context.generation(), abort = new AbortController()
    writeAbort?.abort(); writeAbort = abort
    unresolved(intent, true)
    setStore({ applyBusy: true, pending: intent, expired: false, outcome: "unknown", recovered: false })
    try {
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-apply"]({
        caseRef, choiceId: change.choiceId, changeId: change.changeId, reviewDigest,
      }, { signal: abort.signal, idempotencyKey: intent.key })
      if (abort.signal.aborted || context.generation() !== generation || current()?.transport !== ready.transport) return
      if (response.kind === "response" && (response.status === 403 || response.body.status === "denied")) { purge(); return }
      if (response.kind === "response" && response.body.status === "ok" && acceptReceipt(response.body.value, intent, false)) return
      setStore("outcome", "unknown")
    } catch { if (!abort.signal.aborted) setStore("outcome", "unknown") }
    finally { if (!abort.signal.aborted && context.generation() === generation) setStore("applyBusy", false) }
  }
  async function recover() {
    const ready = current(), intent = pendingApplication()
    if (!ready || !intent || !canRecover()) return
    const generation = context.generation(), abort = new AbortController()
    writeAbort?.abort(); writeAbort = abort
    setStore("applyBusy", true)
    try {
      const response = await createSfDomainClient(ready.transport)["dashboard.dashboard-hot-topic-recover"]({
        purpose: "recover", caseRef: { id: intent.caseRef.id, incarnation: intent.caseRef.incarnation, version: intent.caseRef.version },
        choiceId: intent.choiceId, changeId: intent.changeId,
      }, { signal: abort.signal, idempotencyKey: intent.key })
      if (abort.signal.aborted || context.generation() !== generation || current()?.transport !== ready.transport) return
      if (response.kind === "response" && (response.status === 403 || response.body.status === "denied")) { purge(); return }
      if (response.kind === "response" && response.body.status === "ok" && acceptReceipt(response.body.value, intent, true)) return
      setStore("outcome", "unknown")
    } catch { if (!abort.signal.aborted) setStore("outcome", "unknown") }
    finally { if (!abort.signal.aborted && context.generation() === generation) setStore("applyBusy", false) }
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
                <div><dt>{t(key("sf.u38.status"))}</dt><dd>{change().state}</dd></div>
              </>}
            </Show>
          </dl>
          <Show when={suggestedPreparation()}>
            {(choice) => <div class="sf-u38-actions">
              <p>{choice().reason}</p>
              <button type="button" class="mx-btn" disabled={!store.workbench?.permissions.prepare ||
                !isAdmitted("dashboard.dashboard-hot-topic-prepare") || store.preparationBusy || store.outcome === "unknown" || store.correlation !== "ready" || !!store.pending}
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
        <section class="sf-u38-section" aria-label={t(key("sf.u38.proposalReview"))}>
          <h2>{t(key("sf.u38.proposalReview"))}</h2>
          <Show when={chosenChange() && store.review && store.review.state === "planned" &&
            store.workbench?.permissions.apply && isAdmitted("dashboard.dashboard-hot-topic-apply") &&
            store.correlation === "ready" && !store.pending && store.outcome !== "unknown"}
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
              state="ready" onConfirm={() => {void apply()}}
              onRevise={() => bump((count) => count + 1)}
              onCancel={() => bump((count) => count + 1)} />
          </Show>
        </section>
        <section class="sf-u38-section">
          <h2>{t(key("sf.u38.proposalReceipt"))}</h2>
          <Show when={store.receipt ?? store.review?.receipt}
            fallback={<p role="status">{t(key("sf.u38.proposalNeedsReview"))}</p>}>
            {(receipt) => <dl class="sf-u38-meta">
              <div><dt>{t(key("sf.u38.proposalReceipt"))}</dt><dd><bdi>{receipt().id}</bdi></dd></div>
              <Show when={receipt().status}><div><dt>{t(key("sf.u38.status"))}</dt>
                <dd>{receipt().status}</dd></div></Show>
            </dl>}
          </Show>
        </section>
        <Show when={store.pending || store.correlation === "unavailable"}>
          <section class="sf-u38-section" aria-label={t(key("sf.u38.applicationRecovery"))}>
            <p role="status">{t(key(store.correlation === "unavailable" ? "sf.u38.recoveryUnavailable" :
              store.expired ? "sf.u38.recoveryExpired" : "sf.u38.applicationPending"))}</p>
            <button type="button" class="mx-btn" disabled={!canRecover()} onClick={() => { void recover() }}>
              {t(key("sf.u38.applicationRecover"))}
            </button>
            <button type="button" class="mx-btn" disabled>{t(key("sf.u38.proposalApply"))}</button>
          </section>
        </Show>
        <Show when={store.recovered}><p role="status">{t(key("sf.u38.applicationRecovered"))}</p></Show>
        <Show when={store.outcome !== "none"}><p role="alert" data-proposal-outcome={store.outcome}>
          {t(key(store.outcome === "applied" ? "sf.u38.savedRefetch" :
            store.outcome === "unknown" ? "sf.u38.savePending" : "sf.u38.applyError"))}
        </p></Show>
        <Show when={store.reason}><p role="status">{t(key("sf.u38.sourceUnknown"))}</p></Show>
      </SfStatePanel>
    </div>
  </SfPageFrame>
}

/** The original UI54 ref codec carries this local creation entry without private fields in the URL. */
export function SfHotTopicProposalView(props: SfSurfaceProps<"UI54">): JSX.Element {
  return <Show when={props.route.params.proposalRef === "new"} fallback={<SfHotTopicPreparationView {...props} />}>
    <SfPrivateHotTopicEditor {...props} />
  </Show>
}
