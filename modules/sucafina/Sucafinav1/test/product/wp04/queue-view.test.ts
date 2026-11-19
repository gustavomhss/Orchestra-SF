import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createApplication } from "../../../runtime/application.ts"
import type { Application, ApplicationPageView } from "../../../runtime/application.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { domain, pages, render } from "../../../runtime/procurement.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { procurementApprovalGroups, readProcurementQueueView } from "../../../product/procurement/queue-view.ts"

const states = ["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled", "imported-unknown"]
const at = "2026-11-13T00:00:00Z"

test("first authorized C02 JSON projection is empty and cannot resurrect the retired HTML console", async () => {
  const fixture = await pageFixture(true)
  try {
    const before = await fixture.material()
    expect(before.store).toBeUndefined()
    const dashboard = await fixture.get("requester", undefined)
    expect(dashboard.response.status).toBe(200)
    expect(dashboard.response.headers.get("content-type")).toContain("text/html")
    expect(dashboard.body).toContain("data-page=")

    const first = await fixture.get("requester", "Requests")
    expect(first.response.status).toBe(200)
    expect(first.response.headers.get("content-type")).toContain("application/json")
    expect(JSON.parse(first.body)).toMatchObject({ status: "ok", value: { rows: [], stock: { values: [] } } })
    expect(first.body).not.toContain("procurement-queue-unavailable")
    const queue = readProcurementQueueView(fixture.prepared.at(-1)?.data.procurementQueueView)
    if (!queue) throw new Error("The first visit did not prepare the production C02 queue")
    expect(queue.rows).toEqual([])
    expect(queue.stock.values).toEqual([])

    const approvals = await fixture.get("buyer", "My approvals")
    expect(approvals.response.status).toBe(200)
    expect(readProcurementQueueView(fixture.prepared.at(-1)?.data.procurementQueueView)?.rows).toEqual([])
    expect(await fixture.material()).toEqual(before)

    // Defaults do not grant an identity access or relax a revoked session.
    const ungranted = await fixture.get("reader-without-product-grant", "Requests")
    expect(ungranted.response.status).toBe(403)
    // Revoke after admission but before the actual C02 page is rendered:
    // a pre-revoked unauthenticated request is a 403, not an in-flight 401.
    fixture.interleave(async () => { fixture.revoke("requester") })
    const revoked = await fixture.get("requester", "Requests")
    expect(revoked.response.status).toBe(401)
  } finally { await fixture.dispose() }
})

test("persisted incomplete Procurement stores fail closed instead of silently rendering an empty queue", async () => {
  for (const persisted of [{ issued: { pr: [], po: [] } }, { settings: {} }, {}]) {
    const fixture = await pageFixture(true)
    try {
      await fixture.persistence.transaction("procurement", async (snapshot) => {
        snapshot.data.store = structuredClone(persisted)
        return { commit: true, value: undefined }
      })
      const before = await fixture.material()
      const result = await fixture.get("requester", "Requests")
      expect(result.response.status).toBe(503)
      expect(result.response.headers.get("content-type")).toContain("application/json")
      expect(JSON.parse(result.body)).toEqual({ status: "unavailable", reason: "procurement-queue-unavailable" })
      expect(fixture.prepared).toEqual([])
      expect(await fixture.material()).toEqual(before)
    } finally { await fixture.dispose() }
  }
})

test("authorized Requests and My approvals expose the actual source-fenced C02 JSON queue across baseline states", async () => {
  const fixture = await pageFixture()
  try {
    const work = await fixture.workSelection({ start: "2027-01-01", end: "2027-12-31" })
    const workBefore = await work.read()
    expect(workBefore.status).toBe("ok")
    expect(workBefore.status === "ok" && workBefore.value.stock.context.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
    const before = await fixture.material()
    const requested = await fixture.get("requester", "Requests", "filter=All")
    expect(requested.response.status).toBe(200)
    const published = JSON.parse(requested.body)
    expect(published.status).toBe("ok")
    const queue = readProcurementQueueView(fixture.prepared.at(-1)?.data.procurementQueueView)
    if (!queue) throw new Error("The application did not consume the production C02 page hook")
    expect(queue.rows).toHaveLength(states.length)
    expect(queue.rows.map((row) => row.status)).toEqual(states.map((state) => state === "imported-unknown" ? null : state))
    expect(published.value.rows).toHaveLength(states.length)
    for (const row of queue.rows) {
      const publishedRow = published.value.rows.find((entry: { id: string }) => entry.id === row.id)
      expect(publishedRow).toMatchObject({ id: row.id, evidence: {
        refId: row.evidence.refId, refDigest: row.evidence.refDigest,
      }, version: row.version, subject: row.subject, status: row.status, baseAmount: row.baseAmount })
      const baseAmount = row.projection.values.find((value) => value.id === "baseAmount")?.value
      if (baseAmount !== null && (typeof baseAmount !== "number" || !Number.isFinite(baseAmount))) throw new Error("C02 must expose a finite base amount or explicit null")
      expect(row.baseAmount).toBe(baseAmount)
    }
    expect(published.value.rows.some((entry: { id: string }) => entry.id === "PR-foreign")).toBe(false)
    expect(published.value.rows.find((entry: { id: string }) => entry.id === "PR-imported-unknown").status).toBeNull()
    expect(fixture.finished).toBe(1)
    expect((await work.resolvePageSource(queue.rows[0]!.evidence.refId)).status).toBe("unavailable")

    const approvals = await fixture.get("buyer", "My approvals")
    expect(approvals.response.status).toBe(200)
    const approved = JSON.parse(approvals.body)
    expect(approved.status).toBe("ok")
    const buyer = readProcurementQueueView(fixture.prepared.at(-1)?.data.procurementQueueView)
    if (!buyer) throw new Error("The approval page did not receive C02")
    expect(buyer.rows).toHaveLength(states.length + 1)
    const grouped = procurementApprovalGroups(buyer, "buyer")
    expect(grouped.waitingForYou.map((row) => row.id)).toEqual(["PR-pr_pending"])
    expect(grouped.waitingForOthers.map((row) => row.id)).toEqual(["PR-src_pending"])
    expect(grouped.unassigned.map((row) => row.id)).toEqual(["PR-po_pending"])
    expect(grouped.unassigned[0]!.stageEnteredAt).toBeNull()
    expect(grouped.unassigned[0]!.ageDays).toBeNull()
    expect(approved.value.rows).toHaveLength(states.length + 1)
    for (const row of [...grouped.waitingForYou, ...grouped.waitingForOthers, ...grouped.unassigned]) {
      expect(approved.value.rows).toContainEqual(expect.objectContaining({
        id: row.id, evidence: expect.objectContaining({ refId: row.evidence.refId, refDigest: row.evidence.refDigest }),
      }))
    }
    expect(new Set([...grouped.waitingForYou, ...grouped.waitingForOthers, ...grouped.unassigned].map((row) => row.id)).size)
      .toBe(grouped.waitingForYou.length + grouped.waitingForOthers.length + grouped.unassigned.length)

    const detail = await fixture.get("requester", "Requests", "filter=Closed&request=PR-po_issued")
    expect(detail.response.status).toBe(200)
    expect(JSON.parse(detail.body).value.rows).toContainEqual(expect.objectContaining({ id: "PR-po_issued", status: "po_issued" }))
    expect(JSON.parse(detail.body).value.rows.some((entry: { id: string }) => entry.id === "PR-foreign")).toBe(false)
    const foreign = await fixture.get("requester", "Requests", "filter=All&request=PR-foreign")
    expect(foreign.response.status).toBe(200)
    expect(JSON.parse(foreign.body).value.rows.some((entry: { id: string }) => entry.id === "PR-foreign")).toBe(false)
    expect(await fixture.material()).toEqual(before)
    expect(await work.read()).toEqual(workBefore)
    expect(fixture.finished).toBe(4)
    expect((await fixture.get("reader-without-product-grant", undefined)).response.status).toBe(404)
    expect(fixture.finished).toBe(4)
  } finally { await fixture.dispose() }
})

test("the page fence refuses material changes and revocation between C02 preparation and rendering", async () => {
  const fixture = await pageFixture()
  try {
    fixture.interleave(async () => {
      const changed = await fixture.persistence.transaction("procurement", async (snapshot) => {
        const result = domain.execute(snapshot, { id: "requester", roles: ["requester"], canWrite: true }, { page: "Requests", action: "save", id: "PR-draft", version: 0, values: { pr: { estAmount: 125 } } }, await fixture.environment())
        return { commit: result.ok, value: result }
      })
      expect(changed.ok).toBe(true)
    })
    const stale = await fixture.get("requester", "Requests", "filter=All")
    expect(stale.response.status).toBe(503)
    expect(stale.body).not.toContain("Recorded draft")
    expect(fixture.finished).toBe(1)
    const fresh = await fixture.get("requester", "Requests", "filter=All")
    expect(fresh.response.status).toBe(200)
    const observed = readProcurementQueueView(fixture.prepared.at(-1)?.data.procurementQueueView)
    expect(observed?.rows.find((row) => row.id === "PR-draft")?.baseAmount).toBe(125)

    fixture.interleave(async () => { fixture.revoke("requester") })
    const revoked = await fixture.get("requester", "Requests", "filter=All")
    expect(revoked.response.status).toBe(401)
    expect(revoked.body).not.toContain("Recorded draft")
    expect(fixture.finished).toBe(3)
    const repeat = await fixture.get("requester", "Requests", "filter=All")
    expect(repeat.response.status).toBe(403)
    expect(repeat.body).not.toContain("Recorded draft")
    expect(fixture.finished).toBe(3)
  } finally { await fixture.dispose() }
})

async function pageFixture(fresh = false) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp04-queue-view-"))
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at), createId: randomUUID })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const environment: Application["environment"] = async () => ({ at, id: randomUUID, directory: [{ id: "requester", name: "Recorded requester" }, { id: "buyer", name: "Recorded buyer" }, { id: "other-holder", name: "Other approver" }] })
  const revoked = new Set<string>()
  const authenticate: Application["authenticate"] = async (request) => {
    const id = request.headers.get("x-fixture-principal")
    if (!id || revoked.has(id)) return null
    const role = id === "requester" ? "requester" : id === "buyer" ? "buyer" : "viewer"
    return { id, canWrite: role !== "viewer", roles: [{ surface: "procurement", role }] }
  }
  if (!fresh) await persistence.transaction("procurement", async (snapshot) => {
    const entries = states.map((status) => {
      const number = `PR-${status}`
      const approval = { amount: 100, steps: [{ status: "pending", holderId: status === "pr_pending" ? "buyer" : status === "src_pending" ? "other-holder" : null, levelName: "Recorded approval" }] }
      const action = status === "pr_pending" ? "Requisition submitted for approval" : status === "src_pending" ? "Sourcing submitted for approval" : "Saved"
      return [number, { request: { number, status, createdBy: "requester", buyerId: "buyer", pr: { title: `Recorded ${status}`, type: "product", category: "Hardware", costCenter: "IT", estAmount: 100, justification: "Recorded business reason" },
        ...(["pr_pending", "pr_rejected"].includes(status) ? { prApprovalBaseCurrency: "USD", prApproval: approval } : {}),
        ...(["sourcing", "src_pending", "src_rejected"].includes(status) || status.startsWith("po_") ? { sourcing: { selectedId: "quote", selectionJustification: "Recorded choice", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1 }, approval, quotes: [{ id: "quote", supplier: "Recorded supplier", currency: "USD", total: 100 }] } } : {}),
        ...(status.startsWith("po_") ? { po: { number: status === "po_issued" ? "PO-2026-0001" : "", currency: "USD", fxRate: 1, approvalBaseCurrency: "USD", approval, description: "Recorded order reason", lines: [{ desc: "Recorded item", qty: 1, unitPrice: 100 }] } } : {}),
        history: [{ at: "2026-11-01T00:00:00Z", action }, { at: "2026-11-12T00:00:00Z", action: "Saved" }] }, version: 0, by: "requester" }]
    })
    snapshot.data.store = { settings: initialProcurementSettings(), suppliers: [], requests: { ...Object.fromEntries(entries), "PR-foreign": { request: { number: "PR-foreign", status: "draft", createdBy: "other", pr: { title: "Foreign hidden request", estAmount: 900 } }, version: 0, by: "other" } }, issued: { pr: [...states.map((status) => `PR-${status}`), "PR-foreign"], po: ["PO-2026-0001"] } }
    return { commit: true, value: undefined }
  })
  const origin = "https://procurement.test"
  const authority = createSfProductAuthority({ identity: () => ({ installationId: "i", hostId: "queue-pages", projectId: "p", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    installationId: "i", origin, policyVersion: "p1", persistence, authenticate, environment,
    grants: ["requester", "buyer"].map((principalRef) => ({ principalRef, namespaces: [], operations: ["sf_request_read", "sf_work_list"] })), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet(), procurementEvidenceWrites: new WeakSet() })
  const workContexts: TrustedUiContext[] = []
  const prepared: ApplicationPageView[] = []
  const metrics = { finished: 0, interleave: undefined as (() => Promise<void>) | undefined }
  const fetch = createApplication("/sf", { persistence, authenticate, environment, maxJsonBytes: 1024 * 1024, domains: { dashboard: [], planner: [], procurement: [{ domain, pages, render }] },
    productView: async (...args) => {
      const result = await business.procurementQueueView(...args)
      if (!result || result instanceof Response) return result
      prepared.push(result)
      const after = metrics.interleave
      metrics.interleave = undefined
      if (after) await after()
      return { ...result, finish: () => { metrics.finished++; result.finish() } }
    },
  })
  return {
    persistence, prepared, environment: () => environment(new Request(origin)),
    get finished() { return metrics.finished },
    workSelection: async (period: { start: string; end: string }) => {
      const request = new Request(`${origin}/sf/procurement`, { headers: { "x-fixture-principal": "requester" } })
      const digest = digestSfValue({ purpose: "work-selection", period })
      const admitted = await authority.ui.admit(request, "sf_work_list", digest)
      if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, "sf_work_list", digest)) throw new Error("Actual Work selection admission unavailable")
      workContexts.push(admitted.value)
      const selected = await business.procurementSelections.create(admitted.value, period)
      if (selected.status !== "ok") throw new Error("Actual Work selection unavailable")
      return { read: () => business.procurement.list(selected.value.selectionRef, admitted.value), resolvePageSource: (ref: string) => business.registry.resolveRequestSource(ref, admitted.value) }
    },
    revoke: (id: string) => revoked.add(id),
    interleave: (run: () => Promise<void>) => { metrics.interleave = run },
    get: async (principal: string, page: string | undefined, query = "") => {
      const params = new URLSearchParams(query)
      if (page) { params.set("page", page); params.set("projection", "c02") }
      const response = await fetch(new Request(`${origin}/sf/procurement?${params.toString()}`, { headers: { "x-fixture-principal": principal } }))
      if (!response) throw new Error("Actual application did not handle its Procurement route")
      return { response, body: await response.text() }
    },
    material: () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone({ store: snapshot.data.store, versions: snapshot.versions, audit: snapshot.audit, notices: snapshot.notices }) })),
    dispose: async () => { for (const context of workContexts) authority.ui.finish(context); business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
