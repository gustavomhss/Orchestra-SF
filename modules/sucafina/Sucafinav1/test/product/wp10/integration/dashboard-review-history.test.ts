import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { object } from "../../../../runtime/contract.ts"
import { createSfDashboardHttp } from "../../../../../../../apps/cli/src/sucafina-product/dashboard-http.ts"
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
