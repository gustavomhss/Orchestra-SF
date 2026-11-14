import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createProcurementPromotionIntention } from "../../../product/ui/procurement-alternatives.ts"
import { createSfProcurementScenarioHttp, createSfProcurementScenarioServices } from "../../../../../../apps/cli/src/sucafina-product/procurement-scenario-services.ts"
import { createScenarioFixture, scenarioPeriod } from "./fixture.ts"

test("typed human controls discover attached requisitions and preview without business or case writes", async () => {
  const fixture = await createControlsFixture()
  try {
    const before = await fixture.snapshots()
    const writes = fixture.writes.length
    const controls = await fixture.http(new Request(`https://scenario.invalid/sf/dashboard?sf=procurement-scenario-controls&case=${encodeURIComponent(encodeCaseRef(fixture.caseRef))}&version=1`, { headers: { authorization: "Bearer alice" } }), "dashboard")
    expect(controls?.status).toBe(200)
    const discovered = object(await controls!.json())
    expect(discovered).toMatchObject({ status: "ok", value: { caseRef: fixture.caseRef, sources: [{ sourceDigest: fixture.evidence.refDigest, source: fixture.evidence, currency: "USD", period: scenarioPeriod }], financialApproval: "blocked" } })
    const first = await fixture.post(fixture.selection)
    expect(first?.status).toBe(200)
    const observed = object(await first!.json())
    expect(observed).toMatchObject({ status: "ok", value: { scenario: { knownSubtotal: 140, total: null, comparisonStatus: "conditioned" }, financialApproval: "blocked", request: { baseRef: fixture.sourceRef, operations: [{ kind: "replace", targetRef: fixture.sourceRef, amount: 140, currency: "USD", period: scenarioPeriod }], assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", state: "hypothetical", evidenceRefs: [] }] } } })
    const repeated = await fixture.post(fixture.selection)
    expect(await repeated!.json()).toEqual(observed)
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    const value = object(observed.value)
    const payload = { caseRef: fixture.caseRef, title: "Reviewed synthetic proposal", scenario: value.request, coverageRef: value.coverageRef }
    const retained = createProcurementPromotionIntention(payload, "same-synthetic-promotion")
    payload.title = "Changed after retaining the reviewed proposal"
    expect(Object.isFrozen(retained)).toBe(true)
    expect(retained.action).toBe("decision-promote")
    expect(JSON.parse(retained.body)).toEqual({ ...payload, title: "Reviewed synthetic proposal" })
    expect(retained.key).toBe("same-synthetic-promotion")
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
  } finally { await fixture.dispose() }
})

test("typed preview routes reject free-form targets, source drift and changed authority without writes", async () => {
  const fixture = await createControlsFixture()
  try {
    const before = await fixture.snapshots()
    const writes = fixture.writes.length
    const invalid = [
      { value: { ...fixture.selection, baseRef: fixture.sourceRef }, status: 400 },
      { value: { ...fixture.selection, costInventory: "unknown" }, status: 400 },
      { value: { ...fixture.selection, operation: { ...fixture.selection.operation, target: "PR.justification" } }, status: 400 },
      { value: { ...fixture.selection, operation: { ...fixture.selection.operation, amount: null } }, status: 400 },
      { value: { ...fixture.selection, operation: { ...fixture.selection.operation, currency: "EUR" } }, status: 400 },
      { value: { ...fixture.selection, operation: { ...fixture.selection.operation, period: { start: "2027-01-01", end: "2027-12-31" } } }, status: 400 },
      { value: { ...fixture.selection, sourceDigest: "f".repeat(64) }, status: 403 },
      { value: { ...fixture.selection, caseRef: { ...fixture.caseRef, incarnation: "another-case" } }, status: 403 },
      { value: { ...fixture.selection, caseRef: { ...fixture.caseRef, version: 2 } }, status: 409 },
    ]
    for (const item of invalid) {
      expect((await fixture.post(item.value))?.status).toBe(item.status)
      expect(await fixture.snapshots()).toEqual(before)
      expect(fixture.writes).toHaveLength(writes)
    }
    expect((await fixture.post(fixture.selection, "bob"))?.status).toBe(403)
    expect((await fixture.post(fixture.selection, "alice", "https://foreign.invalid"))?.status).toBe(403)
    expect(await fixture.snapshots()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
    const current = await fixture.snapshot()
    expect((await fixture.execute(fixture.requester, { page: "Requests", action: "save", id: fixture.requestId, version: current.versions[`requests:${fixture.requestId}`]!.version, values: { pr: { estAmount: 120 } } })).ok).toBe(true)
    const changed = await fixture.snapshots()
    expect((await fixture.post(fixture.selection))?.status).toBe(409)
    expect(await fixture.snapshots()).toEqual(changed)
  } finally { await fixture.dispose() }
})

async function createControlsFixture() {
  const fixture = await createScenarioFixture()
  const caseRef = { id: "synthetic-controls-case", incarnation: "case-incarnation", version: 1 }
  const state = createSfProductState({ persistence: fixture.persistence, createId: randomUUID, resolveTarget: async (_request, _snapshot, namespace, target) => namespace === "cases" && target === caseRef.id ? { incarnation: caseRef.incarnation } : undefined, authorize: async (request) => {
    const actor = await fixture.host.authenticate(request)
    return actor ? { principalRef: actor.id, accessRevision: "access-1", policyVersion: "policy-1" } : undefined
  } })
  const seeded = await state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-controls-case", commandDigest: digestSfValue(caseRef) }, async (current) => {
    current.cases[caseRef.id] = { ...caseRef, state: "draft", objective: "Synthetic typed-control case", currency: "USD", horizon: scenarioPeriod, criteria: [], participants: ["alice"], sourceRefs: [fixture.evidence], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Synthetic control case unavailable")
  const unavailable = async () => ({ status: "unavailable" as const, reason: "unused" })
  const port = createProcurementPort({ ...fixture.host, resolveRequestSource: fixture.sources.resolve, isCurrentRequestSource: fixture.sources.isCurrent, resolveSupplierSource: fixture.sources.resolve, isCurrentSupplierSource: fixture.sources.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, readContractSource: unavailable })
  const services = createSfProcurementScenarioServices({ host: fixture.host, state, sources: fixture.sources, port, withCase: async (call, selected, work) => {
    const request = fixture.host.requestFor(call)
    if (!request || !await fixture.host.revalidate(call)) return { status: "denied", reason: "fixture-current-authority-unavailable" }
    const current = await state.read(request, "cases", (value) => value.cases[selected.id])
    if (current.status !== "ok" || !current.value || !current.value.participants.includes(call.binding.principalRef) || current.value.incarnation !== selected.incarnation) return { status: "denied", reason: "fixture-case-access-unavailable" }
    if (current.value.version !== selected.version) return { status: "stale", reason: "fixture-case-changed" }
    return work()
  } })
  const http = createSfProcurementScenarioHttp({ origin: "https://scenario.invalid", mount: "/sf", host: fixture.host, ui: fixture.ui, services })
  const selection = { caseRef, sourceDigest: fixture.evidence.refDigest, costInventory: "renewal-transition-v1" as const, operation: { kind: "replace" as const, target: "PR.estAmount" as const, amount: 140, currency: "USD", period: scenarioPeriod } }
  return { ...fixture, caseRef, selection, http,
    post: (value: unknown, principal = "alice", origin = "https://scenario.invalid") => http(new Request("https://scenario.invalid/sf/dashboard?sf=procurement-scenario-preview", { method: "POST", headers: { authorization: `Bearer ${principal}`, origin, "content-type": "application/json" }, body: JSON.stringify(value) }), "dashboard"),
    snapshots: () => Promise.all([fixture.snapshot(), fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))]),
  }
}
