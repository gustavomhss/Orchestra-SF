/**
 * N19 / U08 — Native Headcount. All rates, payroll/costs, roster decisions,
 * permissions, revisions and monthly values originate in the existing planner.
 * No arithmetic on salaries, no copied HR store, no optimistic roster sync.
 */
import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import type { SfOperationRef, SfRef, SfEditScopeKey, SfIntentRef } from "@orchestra/schema/sucafina/context"
import { useLanguage } from "@/context/language"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState, SfMessage } from "../../shared/frame"
import type { SfReviewField } from "../../shared/change-review"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview } from "../../shared/change-review"
import type { SfPublicDraftController, SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import "./headcount.css"

type ReadResult = Schema.Schema.Type<(typeof SfPlanner)["operations"]["domain.page.CAP20"]["output"]>
type Page = Extract<ReadResult, { status: "ok" }>["value"]
type Position = Page["data"]["positions"][number]
type Rate = NonNullable<Page["data"]["rates"]>[number]
type PositionForm = Readonly<{
  name: string; type: string; location: string; include: boolean; fte: string;
  start: string; end: string; domain: string; rateId: string; rateOverride: string;
}>
type RateForm = Readonly<{ name: string; locs: string; cur: string; annual: string }>
type Review =
  | Readonly<{ kind: "position-save" | "position-delete"; id: string; version: number; operationRef: SfOperationRef }>
  | Readonly<{ kind: "rate-save" | "rate-delete"; id: string; version: number; operationRef: SfOperationRef }>
  | Readonly<{ kind: "increase" | "mapping" | "sync"; version: number; operationRef: SfOperationRef }>
type FormKind = "position" | "rate" | "increase" | "mapping" | null
const key = (s: string) => s as SfCopyKey
const msg = (s: string): SfMessage => ({ key: key(s) })
const display = (text: string) => ({ kind: "text" as const, text: { kind: "data" as const, text } })
const toPositionForm = (position: Position): PositionForm => ({
  name: position.name, type: position.type ?? "", location: position.location ?? "",
  include: position.include ?? false, fte: position.fte === undefined ? "" : String(position.fte),
  start: position.start === undefined ? "" : String(position.start),
  end: position.end === undefined ? "" : String(position.end),
  domain: position.domain ?? "", rateId: position.rateId ?? "",
  rateOverride: position.rateOverride === undefined || position.rateOverride === null
    ? "" : String(position.rateOverride),
})
const toRateForm = (rate: Rate): RateForm => ({
  name: rate.name, locs: typeof rate.locs === "string" ? rate.locs : Array.isArray(rate.locs) ? rate.locs.join(", ") : "",
  cur: rate.cur, annual: rate.annual === null ? "" : String(rate.annual),
})
const money = (value: number | null | undefined, currency: string | null | undefined, locale: string, missingCurrency: string) => {
  if (value === null || value === undefined) return null
  const code = currency?.trim() ?? ""
  if (!code) return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value) + " · " + missingCurrency
  const iso = /^[A-Za-z]{3}$/.test(code) ? code.toUpperCase() : ""
  if (!iso) return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value) + " " + code
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: iso, maximumFractionDigits: 2 }).format(value)
  } catch {
    return new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(value) + " " + code
  }
}
const soleRateCurrency = (rates: ReadonlyArray<{ cur: string }> | undefined) => {
  if (!rates || rates.length === 0) return null
  const codes = rates.map((rate) => rate.cur.trim())
  if (codes.some((code) => !code) || new Set(codes).size !== 1) return null
  return codes[0]
}
const numerically = (v: string) => v.trim() && Number.isFinite(Number(v)) ? Number(v) : undefined

export function SfPlannerHeadcountView(props: SfSurfaceProps<"CAP20">): JSX.Element {
  const language = useLanguage()
  const t = (s: string, params?: Record<string, string | number>) =>
    language.t(s as Parameters<typeof language.t>[0], params)
  const missingCurrency = () => t("sf.u02.noCurrency")
  const hrTotalLabel = (rates: ReadonlyArray<{ cur: string }> | undefined) => {
    const code = soleRateCurrency(rates)?.trim() ?? ""
    const iso = /^[A-Za-z]{3}$/.test(code) ? code.toUpperCase() : ""
    if (iso === "USD") return t("sf.u08.total")
    if (iso) return t("sf.u08.moneyInCurrency", { currency: iso })
    return t("sf.u08.moneyUnscoped")
  }
  const owner = useSfContext()
  const [state, setState] = createStore({
    phase: "loading" as SfUiState,
    page: null as Page | null,
    busy: false,
    error: "" as string,
    refresh: 0,
    recordId: "" as string,
    formKind: null as FormKind,
    rateForm: null as RateForm | null,
    increaseForm: null as Readonly<{ inc: string; incMonth: string }> | null,
    mappingForm: null as Readonly<{ leader: string; domain: string }> | null,
    review: null as Review | null,
    uncertainty: false,
    pageYear: undefined as number | undefined,
    pageVersion: undefined as string | undefined,
  })
  // Real drafts live above the chapter boundary in F01 and are keyed by owner/year/version/ref.
  const drafts = new Map<string, SfPublicDraftController<PositionForm>>()
  let lastIdentity = ""
  const resultState = () => {
    const s = owner.state().status
    return s === "denied" ? "denied" as const : s === "unauthenticated" ? "session-expired" as const
      : s === "context-mismatch" ? "invalid" as const : s === "resolving" ? "loading" as const
      : s === "ready" ? state.phase : "unavailable" as const
  }
  const destination = () => owner.ready()?.context.destinations.find((item) =>
    item.capabilityId === "CAP20" && item.surface === "planner" && item.page === "Headcount")
  const allowed = (action: "save" | "delete" | "sync" | "import-workbook") =>
    !!state.page && !!destination()?.canRead &&
    destination()!.allowedActionIds.includes(action) &&
    state.page.allowedActionIds.includes(action) &&
    !state.busy && !state.uncertainty
  const currentVersion = () => state.page?.data.selectedVersion?.id ?? ""
  const cas = (name: string) => state.page?.versions[name]?.version
  const pos = () => state.page?.data.positions.find((p) =>
    p.id === (state.recordId || (props.route.kind === "position" || props.route.kind === "position-edit" ? props.route.params.positionRef : "")))
  const rate = () => state.page?.data.rates?.find((r) => r.id === state.recordId)
  const currentYear = () => state.page?.selection.year ?? props.route.query.year
  const currentForm = () => pos() ? positionDraft(pos()!)?.snapshot() : undefined
  const activePosition = () => { const snapshot = currentForm(); return snapshot?.availability === "active" ? snapshot : undefined }

  const positionDraft = (p: Position): SfPublicDraftController<PositionForm> | undefined => {
    const ready = owner.ready()
    const year = currentYear()
    if (!ready || !state.page || !currentVersion() || year === undefined) return undefined
    const lookup = JSON.stringify([year, currentVersion(), p.id])
    const existing = drafts.get(lookup)
    if (existing) return existing
    const original = toPositionForm(p)
    const handle = ready.drafts.acquire<PositionForm>({
      surfaceId: "CAP20", identity: { kind: "record", recordRef: p.id as SfRef },
      editScopeKey: JSON.stringify([year, currentVersion(), "positions"]) as SfEditScopeKey,
      baseVersion: p.revision, base: original, value: original,
      revalidation: {
        operationId: "domain.page.CAP20",
        input: { year, version: currentVersion() },
        fieldPaths: ["positions"],
        actionIds: ["save"],
      },
    })
    drafts.set(lookup, handle)
    return handle
  }

  const reload = () => setState("refresh", (n) => n + 1)
  createEffect(() => {
    const generation = owner.generation()
    const ready = owner.ready()
    const year = props.route.query.year
    const version = state.pageVersion || props.route.query.version
    const identity = ready ? JSON.stringify([generation,ready.context.stamp,props.route.href]) : ""
    if (identity !== lastIdentity) {
      lastIdentity = identity
      drafts.clear()
      setState({ pageVersion: props.route.query.version, recordId: "", formKind: null, review: null, uncertainty: false })
    }
    state.refresh
    if (!ready || !destination()?.canRead) {
      drafts.clear()
      setState({ page: null, review: null, recordId: "", formKind: null, phase: resultState(), uncertainty: false })
      return
    }
    const abort = new AbortController()
    onCleanup(() => abort.abort())
    setState({ page: null, phase: "loading", error: "", pageYear: year, pageVersion: version })
    const run = async () => {
      try {
        const reply = await createSfPlannerClient(ready.transport)["domain.page.CAP20"](
          { ...(year === undefined ? {} : { year }), ...(version ? { version } : {}) },
          { signal: abort.signal },
        )
        if (abort.signal.aborted || owner.generation() !== generation) return
        if (reply.kind === "transport-error") {
          setState("phase", "unavailable")
          return
        }
        if (reply.status === 401) { setState({ page: null, phase: "session-expired" }); return }
        if (reply.status === 403) { setState({ page: null, phase: "denied" }); return }
        if (reply.body.status !== "ok") {
          const s = reply.body.status
          setState({ page: null, phase: s === "unauthenticated" ? "session-expired" : s === "needs-input" ? "invalid" : s, error: "reason" in reply.body ? reply.body.reason : "" })
          return
        }
        if (reply.body.context.principalRef !== ready.context.stamp.principalRef ||
            reply.body.context.accessRevision !== ready.context.stamp.accessRevision ||
            reply.body.context.installationId !== ready.context.stamp.installationId) {
          setState({ page: null, phase: "stale" })
          return
        }
        const next = reply.body.value
        // Dirty F01 drafts receive a new candidate base; never overwrite typed text.
        for (const row of next.data.positions) {
          const handle = drafts.get(JSON.stringify([next.selection.year, next.data.selectedVersion?.id ?? "", row.id]))
          handle?.receiveRemote({ baseVersion: row.revision, value: toPositionForm(row) })
        }
        const requested = "positionRef" in props.route.params ? props.route.params.positionRef : undefined
        const absent = requested && !next.data.positions.some(row => row.id === requested)
        setState({ page: next, phase: absent ? "not-found" :
          next.data.positions.length ? "ready" : "empty", error: "" })
      } catch (error) {
        if (!abort.signal.aborted) {
          console.error("N19 Headcount read failed", error instanceof Error ? error.name : "unknown")
          setState({ page: null, phase: "unavailable" })
        }
      }
    }
    void run()
  })
  createEffect(() => {
    if (owner.state().status !== "ready") {
      drafts.clear()
      setState({ page: null, rateForm: null, increaseForm: null, mappingForm: null, review: null, formKind: null, recordId: "" })
    }
  })

  const selectPosition = (p: Position) => {
    setState({ recordId: p.id, formKind: "position", review: null })
    positionDraft(p)
  }
  const selectRate = (r: Rate) => setState({ recordId: r.id, rateForm: toRateForm(r), formKind: "rate", review: null })
  const openIncrease = () => {
    const value = state.page?.data.increase
    if (!value) return
    setState({ formKind: "increase", increaseForm: { inc: String(value.inc), incMonth: String(value.incMonth) }, review: null })
  }
  const openMapping = (leader: string) => {
    const domain = state.page?.data.leaderDomains?.[leader]
    if (domain === undefined) return
    setState({ formKind: "mapping", mappingForm: { leader, domain }, review: null })
  }
  const openReview = (kind: Review["kind"], id: string, version: number | undefined) => {
    if (version === undefined || !Number.isSafeInteger(version) || version < 0 || state.busy) return
    const action = kind.endsWith("delete") ? "delete" : kind === "sync" ? "sync" : "save"
    if (!allowed(action)) return
    if (kind === "position-save") {
      const snapshot = pos() && positionDraft(pos()!)?.snapshot()
      if (!snapshot || snapshot.availability !== "active" || snapshot.conflict ||
          snapshot.pendingOperation || snapshot.baseVersion !== version) {
        setState({ phase: "conflict", error: t("sf.common.conflict") })
        return
      }
    }
    const review = { kind, version, operationRef: crypto.randomUUID() as SfOperationRef,
      ...(kind === "position-save" || kind === "position-delete" || kind === "rate-save" || kind === "rate-delete" ? { id } : {}),
    } as Review
    setState("review", review)
    if (kind === "position-save") positionDraft(pos()!)?.setPhase("reviewing")
  }
  const fields = (values: object): SfReviewField[] =>
    Object.entries(values).map(([path, value]) => ({
      path, label: msg("sf.u08." + (path === "locs" ? "locations" : path === "cur" ? "currency" : path)),
      value: display(String(value)),
    }))
  const baseFields = createMemo<SfReviewField[]>(() => {
    const review = state.review
    if (!review) return []
    if (review.kind.startsWith("position") && pos()) return fields(toPositionForm(pos()!) as unknown as Record<string, string | boolean | number>)
    if (review.kind.startsWith("rate") && rate()) return fields(toRateForm(rate()!) as unknown as Record<string, string | boolean | number>)
    if (review.kind === "increase" && state.page?.data.increase)
      return fields({ inc: state.page.data.increase.inc, incMonth: state.page.data.increase.incMonth })
    if (review.kind === "mapping" && state.mappingForm) return fields({ leader: state.mappingForm.leader, domain: state.page?.data.leaderDomains?.[state.mappingForm.leader] ?? "" })
    return []
  })
  const proposedFields = createMemo<SfReviewField[]>(() => {
    const r = state.review
    if (!r) return []
    if (r.kind === "position-save") {
      const draft = currentForm()
      return draft?.availability === "active" ? fields(draft.value as unknown as Record<string, string | boolean | number>) : []
    }
    if (r.kind === "rate-save" && state.rateForm) return fields(state.rateForm)
    if (r.kind === "increase" && state.increaseForm) return fields(state.increaseForm)
    if (r.kind === "mapping" && state.mappingForm) return fields(state.mappingForm)
    return baseFields()
  })
  const reviewPurpose = () => state.review?.kind.endsWith("delete") ? "delete" as const
    : state.review?.kind === "sync" ? "sync" as const : "save" as const
  const operationId = () => {
    const kind = state.review?.kind
    return kind === "sync" ? "domain.command.CAP20.sync" as const
      : kind === "position-delete" || kind === "rate-delete" ? "domain.command.CAP20.delete" as const
      : "domain.command.CAP20.save" as const
  }

  const submit = async () => {
    const review = state.review
    const ready = owner.ready()
    const versionId = currentVersion()
    if (!review || !ready || !versionId || state.busy || state.uncertainty) return
    const action = review.kind.endsWith("delete") ? "delete" : review.kind === "sync" ? "sync" : "save"
    if (!allowed(action)) return
    const idempotencyKey = crypto.randomUUID()
    const ctrl = new AbortController()
    setState({ busy: true, error: "", review: null })
    const client = createSfPlannerClient(ready.transport)
    const base = { page: "Headcount" as const, version: review.version, confirmed: true as const }
    let response: Awaited<ReturnType<typeof client["domain.command.CAP20.save"]>> | undefined
    try {
      if (review.kind === "position-save") {
        const p = pos()
        const snapshot = p && positionDraft(p)?.snapshot()
        if (!p || !snapshot || snapshot.availability !== "active") return
        const next = snapshot.value
        const fte = numerically(next.fte), start = numerically(next.start), end = numerically(next.end)
        const rateOverride = next.rateOverride.trim() === "" ? null : numerically(next.rateOverride)
        if (fte === undefined || start === undefined || end === undefined || rateOverride === undefined && next.rateOverride.trim() !== "") {
          setState({ error: t("sf.common.fieldErrorSummary"), phase: "invalid" })
          return
        }
        response = await client["domain.command.CAP20.save"]({
          ...base, action: "save", id: p.id,
          values: {
            versionId, collection: "positions", name: next.name, type: next.type, location: next.location,
            include: next.include, fte, start, end, domain: next.domain, rateId: next.rateId,
            ...(p.rateOverride !== undefined ? { rateOverride } : {}),
          },
        }, { signal: ctrl.signal, idempotencyKey })
      } else if (review.kind === "position-delete") {
        response = await client["domain.command.CAP20.delete"]({
          ...base, action: "delete", id: review.id,
          values: { versionId, collection: "positions" },
        }, { signal: ctrl.signal, idempotencyKey })
      } else if (review.kind === "rate-save") {
        const form = state.rateForm
        const annual = form ? numerically(form.annual) : undefined
        if (!form || annual === undefined) { setState("error", t("sf.common.fieldErrorSummary")); return }
        response = await client["domain.command.CAP20.save"]({
          ...base, action: "save", id: review.id,
          values: { versionId, collection: "rates", name: form.name, locs: form.locs, cur: form.cur, annual },
        }, { signal: ctrl.signal, idempotencyKey })
      } else if (review.kind === "rate-delete") {
        response = await client["domain.command.CAP20.delete"]({
          ...base, action: "delete", id: review.id, values: { versionId, collection: "rates" },
        }, { signal: ctrl.signal, idempotencyKey })
      } else if (review.kind === "increase") {
        const form = state.increaseForm
        const inc = form ? numerically(form.inc) : undefined
        const incMonth = form ? numerically(form.incMonth) : undefined
        if (inc === undefined || incMonth === undefined || !Number.isInteger(incMonth) || incMonth < 1 || incMonth > 12) {
          setState("error", t("sf.common.fieldErrorSummary")); return
        }
        response = await client["domain.command.CAP20.save"]({
          ...base, action: "save", values: { versionId, collection: "increase", inc, incMonth: incMonth as 1 },
        }, { signal: ctrl.signal, idempotencyKey })
      } else if (review.kind === "mapping") {
        const form = state.mappingForm
        if (!form) return
        response = await client["domain.command.CAP20.save"]({
          ...base, action: "save", values: {
            versionId, collection: "leaderDomains", leader: form.leader, domain: form.domain,
          },
        }, { signal: ctrl.signal, idempotencyKey })
      } else {
        response = await client["domain.command.CAP20.sync"]({
          ...base, action: "sync", values: { versionId, collection: "positions" },
        }, { signal: ctrl.signal, idempotencyKey })
      }
      if (response.kind === "transport-error") {
        setState({ uncertainty: response.reason !== "contract-unavailable", phase: response.reason === "contract-unavailable" ? "unavailable" : "outcome-unknown", error: t("sf.u08.outcomeUnknown") })
        return
      }
      if (!(response.status >= 200 && response.status < 300 && response.body.ok === true)) {
        setState({ phase: response.status === 409 ? "conflict" : response.status === 403 ? "denied" : "invalid",
          error: "errors" in response.body ? (response.body.errors ?? []).join("; ") || t("sf.common.failed") : t("sf.common.failed") })
        return
      }
      // Acknowledgement is not a current projection. Read the producer again.
      if (review.kind === "position-save") {
        const source = state.page?.data.positions.find((p) => p.id === review.id)
        if (source) positionDraft(source)?.discard()
      }
      setState({ formKind: null, recordId: "", rateForm: null, error: t("sf.u08.saved"), phase: "loading" })
      reload()
    } catch (error) {
      console.error("N19 Headcount command error", error instanceof Error ? error.name : "unknown")
      // A command that may have reached the producer is never replayed.
      setState({ uncertainty: true, phase: "outcome-unknown", error: t("sf.u08.outcomeUnknown") })
    } finally {
      setState("busy", false)
    }
  }

  const readOnly = () => !allowed("save")
  const context = () => [
    { id: "year", label: msg("sf.u08.year"), value: { kind: "data" as const, text: String(currentYear() ?? "") } },
    { id: "version", label: msg("sf.u08.version"), value: { kind: "data" as const, text: state.page?.data.selectedVersion?.name ?? "" } },
  ]
  const reviewFields = () => baseFields()
  // The canonical CAP20 page does not supply a roster impact preview. S03 must
  // block confirmation rather than fabricate a diff or apply blind HR sync.
  const canReview = () => !!state.review && state.review.kind !== "sync" &&
    !state.busy && !state.uncertainty && state.review.version >= 0
  const currentReview = () => state.review
  return (
    <SfPageFrame
      titleKey={key("sf.cap20.title")}
      context={context()}
      tabs={[]} activeTab={null}
      primaryAction={undefined}
      secondaryActions={[]}
      density="comfortable" layout="work" onLayoutMode={() => undefined}
    >
      <SfStatePanel
        state={resultState()}
        messageKey={key(resultState() === "loading" ? "sf.common.loading" :
          resultState() === "empty" ? "sf.common.empty" :
          resultState() === "denied" ? "sf.common.noAccess" :
          resultState() === "session-expired" ? "sf.common.loginAgain" :
          resultState() === "outcome-unknown" ? "sf.common.operationUnknown" :
          resultState() === "invalid" ? "sf.common.fieldErrorSummary" :
          resultState() === "not-found" ? "sf.u08.notFound" : "sf.common.unavailable")}
        onRetryRead={() => reload()}
      >
        <Show when={state.page}>
          {(page) => (
            <div class="sf-u08" data-sf-surface="CAP20" data-sf-polish="planner" data-sf-wave="four" hidden={!!currentReview()}>
              <div class="sf-u08-toolbar">
                <label>{t("sf.u08.version")}
                  <select aria-label={t("sf.u08.version")} value={page().data.selectedVersion?.id ?? ""}
                    onChange={(event) => {
                      const id = event.currentTarget.value
                      if (!id || state.busy) return
                      // F01 keeps version-scoped drafts; the effect aborts any superseded GET.
                      setState({ pageVersion: id, page: null, phase: "loading", review: null,
                        recordId: "", formKind: null })
                    }}>
                    <For each={page().data.versions}>{(version) =>
                      <option value={version.id}>{version.name}</option>}
                    </For>
                  </select>
                </label>
                <Show when={allowed("import-workbook")} fallback={<span aria-disabled="true">{t("sf.u08.import")}</span>}>
                  <a class="mx-btn" href="/orchestra/sf-imports/new">{t("sf.u08.import")}</a>
                </Show>
                <button type="button" class="mx-btn" disabled={!allowed("sync")}
                  onClick={() => openReview("sync", "", cas(`${currentVersion()}:positions:sync`))}>
                  {t("sf.u08.sync")}
                </button>
              </div>
              <section class="sf-u08-plan-summary">
                <h2>{t("sf.u08.metrics")}</h2>
                <dl class="sf-u08-summary">
                  <div><dt>{t("sf.u08.fte")}</dt><dd>{page().data.metrics?.fte === undefined || page().data.metrics?.fte === null
                    ? t("sf.u08.none") : page().data.metrics?.fte}</dd></div>
                  <Show when={page().data.rates !== undefined && page().data.metrics?.hrTotal !== undefined}>
                    <div><dt>{hrTotalLabel(page().data.rates)}</dt><dd>{money(page().data.metrics?.hrTotal, soleRateCurrency(page().data.rates), language.intl(), missingCurrency()) ?? t("sf.u08.none")}</dd></div>
                  </Show>
                </dl>
              </section>
              <details class="sf-u08-positions" open={!pos()}>
                <summary id="sf-u08-positions">{t("sf.u08.positions")}</summary>
                <div class="sf-u08-table-scroll" role="region" aria-labelledby="sf-u08-positions" tabIndex={0}>
                  <table>
                    <thead><tr>
                      <th>{t("sf.u08.position")}</th><th>{t("sf.u08.domain")}</th>
                      <th>{t("sf.u08.fte")}</th><th>{t("sf.u08.include")}</th>
                      <th>{t("sf.u08.source")}</th><th>{t("sf.u08.edit")}</th>
                    </tr></thead>
                    <tbody>
                      <For each={page().data.positions}>{(p) => <tr>
                        <th scope="row">{p.name}</th>
                        <td>{p.domain ?? t("sf.u08.none")}</td>
                        <td>{p.fte === undefined ? t("sf.u08.none") : new Intl.NumberFormat(language.intl()).format(p.fte)}</td>
                        <td>{t(p.include ? "sf.u08.inPlan" : "sf.u08.excluded")}</td>
                        <td>{p.left ? t("sf.u08.left") : p.src === "new" ? t("sf.u08.new") : p.src ?? t("sf.u08.none")}</td>
                        <td><button class="mx-btn" type="button" onClick={() => selectPosition(p)}>
                          {t("sf.common.showDetails")}
                        </button></td>
                      </tr>}</For>
                    </tbody>
                  </table>
                </div>
              </details>
              <Show when={pos()}>
                {(selected) => (
                  <section class="sf-u08-detail" data-sf-headcount-position={selected().id}>
                    <h2>{selected().name}</h2>
                    <Show when={state.formKind === "position" && currentForm()?.availability === "active"}
                      fallback={<button type="button" class="mx-btn" disabled={readOnly()}
                        onClick={() => selectPosition(selected())}>{t("sf.common.edit")}</button>}>
                      <form onSubmit={(event) => {
                        event.preventDefault()
                        openReview("position-save", selected().id, selected().revision)
                      }}>
                        <div class="sf-u08-fields">
                          <For each={["name","type","location","domain","rateId"] as const}>{(field) =>
                            <label>{t("sf.u08." + field)}
                              <input value={activePosition()?.value[field] ?? ""}
                                disabled={readOnly()} onInput={(e) => {
                                  const draft = positionDraft(selected())
                                  const snapshot = draft?.snapshot()
                                  if (snapshot?.availability === "active") draft?.edit({ ...snapshot.value, [field]: e.currentTarget.value })
                                }} />
                            </label>}
                          </For>
                          <For each={["fte","start","end"] as const}>{(field) =>
                            <label>{t("sf.u08." + field)}
                              <input type="number" step={field === "fte" ? "0.01" : "1"}
                                min={field === "fte" ? "0" : "1"}
                                max={field === "fte" ? "2" : "12"}
                                value={activePosition()?.value[field] ?? ""}
                                disabled={readOnly()} onInput={(e) => {
                                  const draft = positionDraft(selected())
                                  const snapshot = draft?.snapshot()
                                  if (snapshot?.availability === "active") draft?.edit({ ...snapshot.value, [field]: e.currentTarget.value })
                                }} />
                            </label>}
                          </For>
                          <Show when={page().data.rates !== undefined && selected().rateOverride !== undefined}>
                            <label>{t("sf.u08.rateOverride")}
                              <input type="number" step="any"
                                value={activePosition()?.value.rateOverride ?? ""}
                                disabled={readOnly()} onInput={(e) => {
                                  const draft = positionDraft(selected())
                                  const snapshot = draft?.snapshot()
                                  if (snapshot?.availability === "active") draft?.edit({ ...snapshot.value, rateOverride: e.currentTarget.value })
                                }} />
                            </label>
                          </Show>
                          <label class="sf-u08-checkbox"><input type="checkbox" checked={activePosition()?.value.include ?? false}
                            disabled={readOnly()} onChange={(e) => {
                              const draft = positionDraft(selected())
                              const snapshot = draft?.snapshot()
                              if (snapshot?.availability === "active") draft?.edit({ ...snapshot.value, include: e.currentTarget.checked })
                            }} />
                            {t("sf.u08.include")}
                          </label>
                        </div>
                        <p>{t("sf.u08.restricted")}</p>
                        <div class="sf-u08-actions">
                          <button type="submit" class="mx-btn primary" disabled={readOnly() || !activePosition()?.dirty}>
                            {t("sf.common.review")}
                          </button>
                          <button type="button" class="mx-btn" disabled={state.busy}
                            onClick={() => positionDraft(selected())?.discard()}>{t("sf.common.discard")}</button>
                          <button type="button" class="mx-btn" disabled={!allowed("delete")}
                            onClick={() => openReview("position-delete", selected().id, selected().revision)}>
                            {t("sf.u08.delete")}
                          </button>
                        </div>
                      </form>
                    </Show>
                    <Show when={page().data.rates !== undefined && selected().months}>
                      {(months) => (
                        <div class="sf-u08-table-scroll" role="region" aria-label={t("sf.u08.monthly")} tabIndex={0}>
                          <h3>{t("sf.u08.monthly")}</h3>
                          <table><thead><tr><For each={months()}>{(_, index) => <th>{index() + 1}</th>}</For></tr></thead>
                            <tbody><tr><For each={months()}>{(amount) =>
                              <td>{money(amount, page().data.rates?.find((rate) => rate.id === selected().rateId)?.cur, language.intl(), missingCurrency()) ?? t("sf.u08.none")}</td>}</For></tr></tbody>
                          </table>
                        </div>
                      )}
                    </Show>
                  </section>
                )}
              </Show>
              <Show when={page().data.rates}>
                {(rates) => (
                  <section>
                    <h2>{t("sf.u08.rates")}</h2>
                    <div class="sf-u08-rate-list"><For each={rates()}>{(r) =>
                      <button type="button" class="mx-btn" onClick={() => selectRate(r)}>
                        <span>{r.name}</span><span>{r.cur} · {money(r.annual,r.cur,language.intl(),missingCurrency()) ?? t("sf.u08.none")}</span>
                      </button>}
                    </For></div>
                    <Show when={state.formKind === "rate" && state.rateForm}>
                      <form class="sf-u08-fields" onSubmit={(e) => {
                        e.preventDefault(); openReview("rate-save", state.recordId, rate()?.revision)
                      }}>
                        <For each={["name","locs","cur","annual"] as const}>{(field) =>
                          <label>{t("sf.u08." + (field === "locs" ? "locations" : field === "cur" ? "currency" : field))}
                            <input value={state.rateForm?.[field] ?? ""} disabled={readOnly()}
                              onInput={(event) => setState("rateForm",(old) =>
                                old ? { ...old, [field]: event.currentTarget.value } : old)} />
                          </label>}
                        </For>
                        <button class="mx-btn primary" type="submit" disabled={readOnly()}>{t("sf.common.review")}</button>
                        <button class="mx-btn" type="button" disabled={!allowed("delete")}
                          onClick={() => openReview("rate-delete", state.recordId, rate()?.revision)}>{t("sf.u08.delete")}</button>
                      </form>
                    </Show>
                  </section>
                )}
              </Show>
              <Show when={page().data.increase && page().data.rates !== undefined}>
                <section>
                  <h2>{t("sf.u08.increase")}</h2>
                  <dl class="sf-u08-summary">
                    <div><dt>{t("sf.u08.inc")}</dt><dd>{page().data.increase?.inc}</dd></div>
                    <div><dt>{t("sf.u08.incMonth")}</dt><dd>{page().data.increase?.incMonth}</dd></div>
                  </dl>
                  <button class="mx-btn" type="button" disabled={readOnly()} onClick={openIncrease}>{t("sf.common.edit")}</button>
                  <Show when={state.formKind === "increase" && state.increaseForm}>
                    <form onSubmit={(e) => { e.preventDefault(); openReview("increase", "", cas(`${currentVersion()}:increase`)) }}
                      class="sf-u08-fields">
                      <label>{t("sf.u08.inc")}<input type="number" step="any" value={state.increaseForm?.inc ?? ""}
                        disabled={readOnly()}
                        onInput={(e) => setState("increaseForm", old => old ? { ...old, inc: e.currentTarget.value } : old)}/></label>
                      <label>{t("sf.u08.incMonth")}<input type="number" min="1" max="12" step="1" value={state.increaseForm?.incMonth ?? ""}
                        disabled={readOnly()}
                        onInput={(e) => setState("increaseForm", old => old ? { ...old, incMonth: e.currentTarget.value } : old)}/></label>
                      <button class="mx-btn primary" type="submit" disabled={readOnly()}>{t("sf.common.review")}</button>
                    </form>
                  </Show>
                </section>
              </Show>
              <Show when={page().data.leaderDomains && page().data.rates !== undefined}>
                {(mapping) => (
                  <section><h2>{t("sf.u08.mapping")}</h2>
                    <ul><For each={Object.entries(mapping())}>{([leader,domain]) =>
                      <li>{leader} · {domain}{" "}
                        <button class="mx-btn" type="button" disabled={readOnly()} onClick={() => openMapping(leader)}>
                          {t("sf.common.edit")}
                        </button>
                      </li>}
                    </For></ul>
                    <Show when={state.formKind === "mapping" && state.mappingForm}>
                      <form onSubmit={(e) => { e.preventDefault(); openReview("mapping", "", cas(`${currentVersion()}:leaderDomains`)) }}>
                        <label>{t("sf.u08.domain")}<input value={state.mappingForm?.domain ?? ""}
                          disabled={readOnly()}
                          onInput={(e) => setState("mappingForm", old => old ? { ...old, domain: e.currentTarget.value } : old)}/></label>
                        <button type="submit" class="mx-btn primary" disabled={readOnly()}>{t("sf.common.review")}</button>
                      </form>
                    </Show>
                  </section>
                )}
              </Show>
            </div>
          )}
        </Show>
      </SfStatePanel>
      <Show when={state.error}><p role="status" class="sf-u08-message">{state.error}</p></Show>
      <Show when={currentReview()} keyed>
        {(current) => <div class="sf-u08-review" data-sf-polish="planner" data-sf-wave="four">
          <p>{t("sf.u08.reviewChange")}</p>
          <Show when={current.kind === "sync"}><p>{t("sf.u08.noRoster")}</p></Show>
          <SfChangeReview
            operation={{ ref: current.operationRef, label: msg("sf.cap20.primary"),
              scope: { kind: "data", text: currentVersion() } }}
            base={{ kind: "persisted", ref: ("id" in current ? (current as {id: string}).id : currentVersion()) as SfRef,
              version: current.version, fields: reviewFields() }}
            current={{ kind: "persisted", ref: ("id" in current ? (current as {id: string}).id : currentVersion()) as SfRef,
              version: current.version, fields: reviewFields() }}
            proposed={{ kind: "draft", intentRef: current.operationRef as unknown as SfIntentRef,
              sourceRef: ("id" in current ? (current as {id: string}).id : currentVersion()) as SfRef,
              sourceVersion: current.version, fields: proposedFields() }}
            effects={[]}
            coverage={current.kind === "sync"
              ? { state: "partial", summary: msg("sf.u08.scope"), reasons: [msg("sf.u08.noRoster")], knownCount: 1, expectedCount: null }
              : { state: "complete", summary: msg("sf.u08.scope"), reasons: [], knownCount: 1, expectedCount: 1 }}
            blockingReasons={canReview() ? [] : [msg("sf.u08.unavailableAction")]}
            confirmation={canReview()
              ? { kind: "admitted", labelKey: key("sf.cap20.primary"), purpose: reviewPurpose(),
                binding: { kind: "catalog-command", operationId: operationId(),
                  version: { kind: "record", expectedVersion: current.version }, confirmation: "presentation-only" } }
              : { kind: "blocked", labelKey: key("sf.cap20.primary"), reasons: [msg("sf.u08.unavailableAction")] }}
            state={state.phase}
            onConfirm={() => void submit()}
            onRevise={() => setState("review", null)}
            onCancel={() => setState("review", null)}
          />
        </div>}
      </Show>
    </SfPageFrame>
  )
}
