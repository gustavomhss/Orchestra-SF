import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import { SfDashboardDashboardAgenda, SfDashboardDashboardReview, SfDashboardDashboardReviewPreserve, SfProjectionReview, SfReviewDomainProjection, SfReviewsReviewUpdate } from "@orchestra/schema/sucafina/reviews"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { object } from "../../../../runtime/contract.ts"
import { createSfDashboardHttp } from "../../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"
import { createSfExtendedBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfReviewsProjectionHandlers } from "../../../../../../../apps/cli/src/sucafina-product/native-ui/reviews.ts"
import type { DashboardReviewRequest } from "../../../../../../../apps/cli/src/sucafina-product/dashboard-services.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }

// Actual Dashboard selection, human preservation, C08 storage, history authority,
// and HTTP reader. Fault injection only alters the isolated store's saved bytes.
async function dashboardReviewFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await deadline.phase("fixture.initialize", async () => {
    const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() })
    deadline.own(() => fixture.dispose())
    return fixture
  })
  const call = await fixture.read()
  deadline.own(() => fixture.authority.ui.finish(call))
  const dashboard = fixture.business.dashboardServices
  const select = async () => {
    const discovered = await dashboard.discover({ page: "Budget Overview", period }, call)
    if (discovered.status !== "ok" || !discovered.value.agenda) throw new Error("Real Dashboard agenda unavailable")
    const preview = await dashboard.agenda({ sections: [discovered.value.agenda.section] }, call)
    expect(preview.status, preview.status !== "ok" ? preview.reason : undefined).toBe("ok")
    if (preview.status !== "ok") throw new Error(preview.reason)
    const section = preview.value.sections[0]
    if (!section) throw new Error("Real Dashboard section unavailable")
    const source = section.projection.context.sourceRefs.find((ref) => ref.type === "dashboard-page" && ref.id === "Budget Overview")
    if (!source) throw new Error("Real Dashboard source unavailable")
    return { preview: preview.value, source, total: section.projection.values.find((value) => value.id === "budgetMetrics.2026.totalBudget")?.value, history: discovered.value.history }
  }
  const preserve = async (request: DashboardReviewRequest) => {
    const admitted = await fixture.authority.human.admit(fixture.request(`dashboard-preserve:${randomUUID()}`), "reviews.preserve", request)
    if (admitted.status !== "ok") throw new Error("Real human Review admission unavailable")
    try {
      const result = await dashboard.preserveReview(request, admitted.value)
      expect(result.status, result.status !== "ok" ? result.reason : undefined).toBe("ok")
      if (result.status !== "ok") throw new Error(result.reason)
      return result.value
    } finally { fixture.authority.ui.finish(admitted.value) }
  }
  const selected = await deadline.phase("dashboard.select", select)
  expect(selected.total).toBe(1200)
  const request = { selectionRef: selected.preview.selectionRef, sectionRefs: selected.preview.sections.map((section) => section.id) }
  const original = await deadline.phase("dashboard.preserve", () => preserve(request))
  const http = createSfDashboardHttp({ origin: "https://example.test", mount: "", runtime: () => ({ authority: fixture.authority, dashboard, decisions: fixture.business.dashboardDecisions }) })
  const get = async (id = original.id) => {
    const url = new URL("https://example.test/dashboard")
    url.searchParams.set("sf", "dashboard-review")
    url.searchParams.set("id", id)
    const response = await http(new Request(url, { signal: deadline.signal }), "dashboard")
    if (!response) throw new Error("Dashboard Review HTTP route unavailable")
    const body: unknown = await response.json()
    return { status: response.status, body }
  }
  const changeBudget = () => fixture.persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1800 }]
    return { commit: true, value: undefined }
  })
  expect(await get()).toEqual({ status: 200, body: { status: "ok", value: original } })
  return { fixture, selected, request, original, select, preserve, get, changeBudget }
}

test("Dashboard C05 history retains its captured number after an edit and denies current ACL loss or a replacement source incarnation", async () => {
  const deadline = compositionTestDeadline("dashboard-review-history-authority")
  try {
    const { fixture, selected, original, select, preserve, get, changeBudget } = await dashboardReviewFixture(deadline)
    await deadline.phase("dashboard.edit", changeBudget)
    const current = await deadline.phase("dashboard.current", select)
    expect(current.total).toBe(1800)
    expect(current.source.incarnation).toBe(selected.source.incarnation)
    expect(current.source.version).toBeGreaterThan(selected.source.version)
    expect(current.history).toContainEqual(expect.objectContaining({ kind: "review", ref: original.id }))
    expect(await deadline.phase("history.after-edit", () => get())).toEqual({ status: 200, body: { status: "ok", value: original } })
    // A successor uses a fresh agenda and may cite the authorized old review.
    // The writer still captures the current 1800 source, not the old 1200 body.
    const successor = await deadline.phase("dashboard.successor", () => preserve({ selectionRef: current.preview.selectionRef,
      sectionRefs: current.preview.sections.map((section) => section.id), previousReviewRef: original.id }))
    expect(successor.previousReviewRef).toBe(original.id)
    expect(successor.sourceRefs).toContainEqual(current.source)
    expect(successor.sourceRefs).not.toContainEqual(selected.source)
    expect(digestSfValue(successor.sections[0]!.content)).not.toBe(digestSfValue(original.sections[0]!.content))
    fixture.active.value = false
    const revoked = await deadline.phase("history.revoked", () => get())
    expect(revoked.status).toBe(403)
    expect(object(revoked.body).value).toBeUndefined()
    fixture.active.value = true
    expect(await get()).toEqual({ status: 200, body: { status: "ok", value: original } })

    // Exercise the actual lifecycle replacement marker. The business values and
    // C08 archives survive, while the producer assigns fresh physical identities.
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const before = structuredClone(snapshot.data)
      snapshot.audit.push({ record: "dataset", who: "person", at: fixture.at, was: before, became: structuredClone(snapshot.data) })
      return { commit: true, value: undefined }
    })
    const replacement = await deadline.phase("dashboard.replacement", select)
    expect(replacement.total).toBe(1800)
    expect(replacement.source.incarnation).not.toBe(selected.source.incarnation)
    const denied = await deadline.phase("history.replaced", () => get())
    expect(denied.status).toBe(403)
    expect(object(denied.body).value).toBeUndefined()
    const stored = await fixture.authority.state.read(fixture.request(), "reviews", (state) => state.reviews[original.id])
    expect(stored.status === "ok" && stored.value).toEqual(original)
  } finally { await deadline.close() }
}, 120_000)

test("RPT-03 producer reissues the exact C04 subset and refuses stale, revoked or mixed selections", async () => {
  const deadline = compositionTestDeadline("reports-successor-producer")
  try {
    const f = await deadline.phase("fixture.initialize", () => financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check() }))
    deadline.own(() => f.dispose())
    const origin = "https://example.test", mount = "/sucafina"
    const extended = createSfExtendedBusinessServices({ authority: f.authority, business: f.business, persistence: f.persistence, ...f.guards, origin })
    deadline.own(() => extended.dispose())
    if (!extended.reviews) throw new Error("Real review producer unavailable")
    const dashboard = f.business.dashboardServices
    const dashboardHttp = createSfDashboardHttp({ origin, mount, runtime: () => ({ authority: f.authority, dashboard, decisions: f.business.dashboardDecisions }) })
    const native = createSfReviewsProjectionHandlers({ origin, mount, authority: f.authority, business: f.business, reviews: extended.reviews, persistence: f.persistence })
    const exchange = async <S extends Schema.Top>(schema: S, query: Record<string, string>, payload?: unknown) => {
      const operation = randomUUID()
      const request = new Request(`${origin}${mount}/dashboard?${new URLSearchParams(query)}`, payload === undefined ? { signal: deadline.signal } : {
        method: "POST", signal: deadline.signal, body: JSON.stringify(payload),
        headers: { origin, "content-type": "application/json", "idempotency-key": operation, "x-operation": operation },
      })
      const response = await extended.productHttp(request, "dashboard") ?? await dashboardHttp(request, "dashboard")
      if (!response) throw new Error(`Installed ${query.sf} route unavailable`)
      expect(response.headers.get("cache-control")).toContain("no-store")
      return { status: response.status, body: Schema.decodeUnknownSync(Schema.toType(schema))(await response.json(), { onExcessProperty: "error" }) }
    }
    const discover = async (page: string) => {
      const response = await native.handle(new Request(`${origin}${mount}/api/ui/projections/review?${new URLSearchParams({ page, ...period })}`, { signal: deadline.signal }), "dashboard")
      if (!response) throw new Error(`Installed review projection route unavailable for ${page}`)
      expect(response.status).toBe(200)
      const result = Schema.decodeUnknownSync(Schema.toType(SfProjectionReview.output))(await response.json())
      if (result.status !== "ok" || !("period" in result.value) || result.value.items.length !== 1) throw new Error(`No agenda for ${page}`)
      const { id, topic, selectionRef, period: sectionPeriod } = result.value.items[0]!
      return { id, title: topic, topic, selectionRef, period: sectionPeriod }
    }
    const preview = async (request: Schema.Schema.Type<typeof SfDashboardDashboardAgenda.input>) => {
      const result = await exchange(SfDashboardDashboardAgenda.output, { sf: "dashboard-agenda" }, request)
      if (result.body.status !== "ok" || result.status !== 200) throw new Error(`Dashboard agenda refused: ${JSON.stringify(result)}`)
      return result.body.value
    }
    const preserve = async (agenda: Awaited<ReturnType<typeof preview>>, previousReviewRef?: string) => {
      const result = await exchange(SfDashboardDashboardReviewPreserve.output, { sf: "dashboard-review-preserve" }, {
        selectionRef: agenda.selectionRef, sectionRefs: agenda.sections.map((section) => section.id), ...(previousReviewRef ? { previousReviewRef } : {}),
      })
      if (result.body.status !== "ok" || result.status !== 200) throw new Error(`Dashboard preservation refused: ${JSON.stringify(result)}`)
      return result.body.value
    }
    const projectRows = ["retained:west", "excluded-middle", "retained-east"].map((id) => ({ id, name: id, milestones: [] }))
    const entries = Array.from({ length: 12 }, (_, index) => ({ id: `entry-${index}`, ownerId: "owner", year: 2026, month: index + 1, budget: 100, actual: 100, forecast: 110 }))
    await f.persistence.transaction("dashboard", async (snapshot) => {
      Object.assign(snapshot.data, { projects: projectRows, opexEntries: entries, hotTopics: [] })
      return { commit: true, value: undefined }
    })
    const budget = await discover("Budget Overview"), portfolio = await discover("Portfolio Dashboard"), hotTopics = await discover("Hot Topics & Actions")
    const forecast = "budgetMetrics.2026.totalForecast"
    const projectIds = (projection: Schema.Schema.Type<typeof SfReviewDomainProjection>) => projection.values
      .filter((value) => /^projects\[id:[^\]]+\]\.id$/.test(value.id)).map((value) => value.value)
    const readProjection = Schema.decodeUnknownSync(Schema.toType(SfReviewDomainProjection))
    const full = await deadline.phase("dashboard.full-preview", () => preview({ sections: [budget, portfolio, hotTopics] }))
    expect(projectIds(full.sections[1]!.projection)).toEqual(projectRows.map((row) => row.id))
    const references = full.sections[1]!.recordRefs
    expect(references).toHaveLength(3)
    const kept = [references[0]!, references[2]!]
    const expectedIds = ["retained:west", "retained-east"]
    const exactSections = [budget, { ...portfolio, recordRefs: kept }, { ...hotTopics, recordRefs: [] }]
    const original = await deadline.phase("dashboard.preserve-predecessor", async () => preserve(await preview({ sections: exactSections })))
    expect(original.id).toStartWith("dashboard-review:")
    expect(original.sections.map((section) => section.count)).toEqual([1, 2, 0])
    expect(projectIds(readProjection(original.sections[1]!.content))).toEqual(expectedIds)
    expect(readProjection(original.sections[0]!.content).values.find((value) => value.id === forecast)?.value).toBe(1320)
    const outside = await discover("OPEX Detail")
    const mixed = await deadline.phase("dashboard.preserve-mixed", async () => preserve(await preview({ sections: [...exactSections, outside] })))
    // A successor must derive membership from the stored C04 body, not the original preview registry.
    dashboard.dispose()
    const update = (reviewRef: string) => exchange(SfReviewsReviewUpdate.output, { sf: "review-update", reviewRef })
    expect(await update(original.id)).toMatchObject({ status: 200, body: { status: "ok", value: { available: false, previousReviewRef: original.id } } })
    const editedEntries = entries.map((entry) => entry.month === 1 ? { ...entry, forecast: 190 } : entry)
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexEntries = editedEntries
      return { commit: true, value: undefined }
    })
    const result = await deadline.phase("dashboard.review-update", () => update(original.id))
    if (result.body.status !== "ok" || result.status !== 200) throw new Error(`C04 successor refused: ${JSON.stringify(result)}`)
    expect(result.body.value).toMatchObject({ available: true, previousReviewRef: original.id, confirmations: [], unavailableSections: [] })
    expect(result.body.value.items.map((item) => item.id)).toEqual(original.sections.map((section) => section.id))
    expect(result.body.value.items[1]!.recordRefs).toEqual(kept)
    expect(result.body.value.items[2]!.recordRefs).toEqual([])
    const currentSections = result.body.value.items.map(({ id, period, selectionRef, topic, recordRefs }, index) => ({
      id, period, selectionRef, topic, recordRefs: recordRefs!, title: original.sections[index]!.title,
    }))
    const successor = await deadline.phase("dashboard.preserve-successor", async () => {
      const current = await preview({ sections: currentSections })
      expect(current.sections[1]!.recordRefs).toEqual(kept)
      expect(projectIds(current.sections[1]!.projection)).toEqual(expectedIds)
      expect(current.sections[0]!.projection.values.find((value) => value.id === forecast)?.value).toBe(1400)
      return preserve(current, original.id)
    })
    expect(successor.id).not.toBe(original.id)
    expect(successor.previousReviewRef).toBe(original.id)
    expect(successor.sections.map(({ id, title, period, count }) => ({ id, title, period, count })))
      .toEqual(original.sections.map(({ id, title, period, count }) => ({ id, title, period, count })))
    expect(projectIds(readProjection(successor.sections[1]!.content))).toEqual(expectedIds)
    expect(readProjection(successor.sections[0]!.content).values.find((value) => value.id === forecast)?.value).toBe(1400)
    const reread = () => exchange(SfDashboardDashboardReview.output, { sf: "dashboard-review", id: original.id })
    expect(await reread()).toEqual({ status: 200, body: { status: "ok", value: original } })
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { projects: snapshot.data.projects, opexEntries: snapshot.data.opexEntries } })))
      .toEqual({ projects: projectRows, opexEntries: editedEntries })
    expect(await deadline.phase("dashboard.mixed-refused", () => update(mixed.id)))
      .toEqual({ status: 503, body: { status: "unavailable", reason: "review-record-selection-unavailable" } })
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = projectRows.map((row, index) => index === 0 ? { ...row, name: "Changed source" } : row)
      return { commit: true, value: undefined }
    })
    expect(await deadline.phase("dashboard.stale-refused", () => update(original.id)))
      .toEqual({ status: 409, body: { status: "stale", reason: "review-record-selection-changed" } })
    expect(await reread()).toEqual({ status: 200, body: { status: "ok", value: original } })
    f.active.value = false
    const revoked = await deadline.phase("dashboard.revoked-refused", () => update(original.id))
    expect(revoked).toMatchObject({ status: 403, body: { status: "denied" } })
    expect(revoked.body).not.toHaveProperty("value")
  } finally { await deadline.close() }
}, 120_000)

test("Dashboard C05 history requires its own intact capture and receipt despite an authentic successor with the same captured source", async () => {
  const deadline = compositionTestDeadline("dashboard-review-history-integrity")
  try {
    const { fixture, request, original, preserve, get, changeBudget } = await dashboardReviewFixture(deadline)
    const successor = await deadline.phase("dashboard.same-source-successor", () => preserve({ ...request, previousReviewRef: original.id }))
    expect(successor.sourceRefs).toEqual(original.sourceRefs)
    await deadline.phase("dashboard.edit", changeBudget)
    expect(await get()).toEqual({ status: 200, body: { status: "ok", value: original } })
    expect(await get(successor.id)).toEqual({ status: 200, body: { status: "ok", value: successor } })
    const saved = await fixture.authority.state.read(fixture.request(), "reviews", (state) => structuredClone(state))
    if (saved.status !== "ok") throw new Error("C08 snapshot unavailable")
    const receipts = Object.entries(saved.value.transactions).filter(([, receipt]) => receipt.namespace === "reviews" &&
      object(receipt.value).schema === "sf-review-receipt-v1" && object(receipt.value).reviewRef === original.id)
    expect(receipts).toHaveLength(1)
    const [receiptKey, receipt] = receipts[0]!
    const mutate = (change: (state: SfProductState) => void) => fixture.store.transaction("dashboard", async (snapshot) => {
      const state = structuredClone(saved.value)
      change(state)
      snapshot.data.__sfProductV1 = state
      return { commit: true, value: undefined }
    })
    for (const [label, corrupt] of [
      ["missing-receipt", (state: SfProductState) => { delete state.transactions[receiptKey] }],
      ["receipt-digest", (state: SfProductState) => { state.transactions[receiptKey] = { ...receipt, value: { schema: "sf-review-receipt-v1", reviewRef: original.id, reviewDigest: "0".repeat(64) } } }],
      ["capture-body", (state: SfProductState) => { state.reviews[original.id] = { ...original, createdAt: "2026-01-02T00:00:00Z" } }],
    ] as const) {
      await mutate(corrupt)
      const denied = await deadline.phase(`history.${label}`, () => get())
      expect(denied.status).toBe(403)
      expect(object(denied.body).value).toBeUndefined()
      // A different legitimate receipt cannot authorize the corrupted target.
      expect(await get(successor.id)).toEqual({ status: 200, body: { status: "ok", value: successor } })
      await mutate(() => {})
      expect(await get()).toEqual({ status: 200, body: { status: "ok", value: original } })
    }
  } finally { await deadline.close() }
}, 120_000)
