import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object } from "../../../runtime/contract.ts"
import type { Persistence } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { plannerScenarioDigest } from "../../../product/planner/preview-comparison.ts"
import { createProcurementScenarioProducer } from "../../../product/procurement/scenario-producer.ts"
import { createScenarioFixture, scenarioAt, scenarioPeriod } from "./fixture.ts"

test("read-only producer computes the exact hypothetical amount and derives every missing C10 category", async () => {
  const fixture = await createScenarioFixture()
  try {
    const request = proposal(fixture.sourceRef)
    const before = await fixture.snapshot()
    const writes = fixture.writes.length
    const baseline = await fixture.producer.preview({ ...request, operations: [] }, fixture.context)
    const preview = await fixture.producer.preview(request, fixture.context)
    if (baseline.status !== "ok" || preview.status !== "ok") throw new Error("Real Procurement preview unavailable")
    expect(baseline.value.scenario.knownSubtotal).toBe(100)
    expect(preview.value.scenario).toMatchObject({ knownSubtotal: 140, total: null, currency: "USD", horizon: scenarioPeriod, comparisonStatus: "conditioned" })
    expect(preview.value.scenario.components).toHaveLength(1)
    expect(preview.value.scenario.components[0]).toMatchObject({ amount: 140, currency: "USD", period: scenarioPeriod, evidenceState: "hypothetical" })
    expect(preview.value.scenario.sourceRefs).toEqual([fixture.evidence])
    expect(preview.value.scenario.id).not.toBe(baseline.value.scenario.id)
    expect(preview.value.assessment).toEqual(preview.value.scenario.costCoverage)
    expect(preview.value.assessment.coverageState).toBe("pending")
    expect(preview.value.assessment.derivedMissingCategoryIds).toEqual([...RENEWAL_TRANSITION_CATEGORIES])
    expect(preview.value.assessment.entries).toEqual(RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending", reason: "missing-category" })))
    expect(preview.value.scenario.unresolvedConditions.length).toBeGreaterThan(0)
    expect(await fixture.producer.resolveForecastCoverage(preview.value.coverageRef, fixture.context)).toEqual({ status: "ok", value: { coverageRef: preview.value.coverageRef, basis: preview.value.basis, assessment: preview.value.assessment } })
    expect(await fixture.producer.simulateScenario(request, fixture.context)).toEqual({ status: "ok", value: preview.value.scenario })
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    const callerOwned = proposal(fixture.sourceRef)
    const retained = fixture.producer.preview(callerOwned, fixture.context)
    callerOwned.operations[0]!.amount = 900
    callerOwned.assumptions[0]!.value = "changed-after-the-first-await"
    expect(await retained).toEqual(preview)
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)

    const changed = { ...request, operations: [{ ...request.operations[0]!, amount: 160 }] }
    const other = await fixture.producer.preview(changed, fixture.context)
    if (other.status !== "ok") throw new Error("Changed hypothetical preview unavailable")
    expect(other.value.scenario.id).not.toBe(preview.value.scenario.id)
    expect(other.value.coverageRef).not.toBe(preview.value.coverageRef)
    expect(preview.value.scenario.knownSubtotal).toBe(140)
    expect(await fixture.snapshot()).toEqual(before)
    expect(fixture.writes).toHaveLength(writes)
  } finally { await fixture.dispose() }
})

test("typed Procurement preview rejects target, amount, currency, period and unsupported-operation drift without writes", async () => {
  const fixture = await createScenarioFixture()
  try {
    const request = proposal(fixture.sourceRef)
    const operation = request.operations[0]!
    const invalid: ScenarioRequest[] = [
      { ...request, operations: [{ ...operation, targetRef: "other-target" }] },
      { ...request, operations: [{ ...operation, amount: undefined }] },
      { ...request, operations: [{ ...operation, amount: Number.NaN }] },
      { ...request, operations: [{ ...operation, amount: -1 }] },
      { ...request, operations: [{ ...operation, currency: "EUR" }] },
      { ...request, operations: [{ ...operation, period: { start: "2027-01-01", end: "2027-12-31" } }] },
      { ...request, operations: [{ ...operation, replacementRef: fixture.sourceRef }] },
      { ...request, operations: [{ ...operation, kind: "include" }] },
      { ...request, operations: [operation, operation] },
      { ...request, assumptions: [] },
      { ...request, assumptions: [{ id: "procurement-cost-inventory", value: "unknown-inventory", evidenceRefs: [], state: "hypothetical" }] },
      { ...request, assumptions: [{ id: "unsourced-cost", value: 0, evidenceRefs: [], state: "hypothetical" }] },
    ]
    const before = await fixture.snapshot()
    const writes = fixture.writes.length
    for (const value of invalid) {
      expect((await fixture.producer.preview(value, fixture.context)).status).not.toBe("ok")
      expect(await fixture.snapshot()).toEqual(before)
      expect(fixture.writes).toHaveLength(writes)
    }
  } finally { await fixture.dispose() }
})

test("missing source cost remains unavailable and a recorded zero remains distinct", async () => {
  const missing = await createScenarioFixture({ amount: null })
  try {
    const request = proposal(missing.sourceRef)
    const before = await missing.snapshot()
    const writes = missing.writes.length
    const baseline = await missing.producer.preview({ ...request, operations: [] }, missing.context)
    if (baseline.status !== "ok") throw new Error("Absent source cost must remain inspectable")
    expect(baseline.value.scenario.knownSubtotal).toBeNull()
    expect(baseline.value.scenario.total).toBeNull()
    expect(baseline.value.scenario.comparisonStatus).not.toBe("complete")
    expect(baseline.value.scenario.components.every((component) => component.amount === null)).toBe(true)
    expect(await missing.producer.preview(request, missing.context)).toEqual({ status: "needs-input", reason: "procurement-source-cost-unavailable" })
    expect(await missing.snapshot()).toEqual(before)
    expect(missing.writes).toHaveLength(writes)
  } finally { await missing.dispose() }
  const zero = await createScenarioFixture({ amount: 0 })
  try {
    const baseline = await zero.producer.preview({ ...proposal(zero.sourceRef), operations: [] }, zero.context)
    if (baseline.status !== "ok") throw new Error("Recorded zero disappeared")
    expect(baseline.value.scenario.knownSubtotal).toBe(0)
    expect(baseline.value.scenario.components[0]?.amount).toBe(0)
    expect(baseline.value.scenario.total).toBeNull()
    expect(baseline.value.scenario.sourceRefs).toEqual([zero.evidence])
  } finally { await zero.dispose() }
})

test("preview revalidates principal, source version, revocation and replacement incarnation", async () => {
  const fixture = await createScenarioFixture()
  try {
    const request = proposal(fixture.sourceRef)
    const other = await fixture.admit("bob")
    const before = await fixture.snapshot()
    expect((await fixture.producer.preview(request, other.context)).status).not.toBe("ok")
    expect((await fixture.producer.preview({ ...request, baseRef: "sf-procurement:other-incarnation:1", operations: [] }, fixture.context)).status).not.toBe("ok")
    expect(await fixture.snapshot()).toEqual(before)
    fixture.access.allowed = false
    expect((await fixture.producer.preview(request, fixture.context)).status).toBe("denied")
    expect(await fixture.snapshot()).toEqual(before)
    fixture.access.allowed = true
    const admission = await fixture.admit()
    const version = before.versions[`requests:${fixture.requestId}`]!.version
    expect((await fixture.execute(fixture.requester, { page: "Requests", action: "save", id: fixture.requestId, version, values: { pr: { title: "Materially changed source" } } })).ok).toBe(true)
    const changed = await fixture.snapshot()
    expect((await fixture.producer.preview(request, admission.context)).status).toBe("stale")
    expect(await fixture.snapshot()).toEqual(changed)

    const originalRow = structuredClone(object(object(changed.data.store).requests)[fixture.requestId])
    expect((await fixture.execute(fixture.requester, { page: "Requests", action: "delete", id: fixture.requestId, version: changed.versions[`requests:${fixture.requestId}`]!.version, values: {} })).ok).toBe(true)
    // Synthetic imported replacement reuses the physical ID in a later commit;
    // the real lifecycle must allocate another incarnation, not inherit a scope.
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      object(object(snapshot.data.store).requests)[fixture.requestId] = originalRow
      return { commit: true, value: undefined }
    })
    const replacement = await fixture.sources.issue("procurement-request", fixture.requestId, admission.context)
    if (replacement.status !== "ok") throw new Error("Replacement source not issued")
    expect(replacement.value).not.toBe(fixture.sourceRef)
    const replaced = await fixture.snapshot()
    expect((await fixture.producer.preview(request, admission.context)).status).not.toBe("ok")
    expect(await fixture.snapshot()).toEqual(replaced)
  } finally { await fixture.dispose() }
})

test("a delete, replacement and restoration race invalidates preview without reissuing or writing sources", async () => {
  const fixture = await createScenarioFixture()
  try {
    const before = await fixture.snapshot()
    const initialWrites = fixture.writes.length
    const row = structuredClone(object(object(before.data.store).requests)[fixture.requestId])
    const gate = { pending: true, enter: () => {}, release: () => {} }
    const entered = new Promise<void>((resolve) => { gate.enter = resolve })
    const released = new Promise<void>((resolve) => { gate.release = resolve })
    // The real transaction has completed and released its SQLite lock before
    // pausing. Only the fixture's explicit concurrent commands can write.
    const intercepted: Persistence = { transaction: async (surface, work, options) => {
      const result = await fixture.persistence.transaction(surface, work, options)
      if (surface === "procurement" && gate.pending) { gate.pending = false; gate.enter(); await released }
      return result
    } }
    const producer = createProcurementScenarioProducer({ host: { ...fixture.host, persistence: intercepted }, sources: fixture.sources })
    const pending = producer.preview(proposal(fixture.sourceRef), fixture.context)
    const concurrent = { snapshot: before, writes: initialWrites }
    try {
      await Promise.race([entered, pending.then(() => { throw new Error("Preview returned before the read boundary") })])
      expect(await fixture.snapshot()).toEqual(before)
      expect(fixture.writes).toHaveLength(initialWrites)
      expect((await fixture.execute(fixture.requester, { page: "Requests", action: "delete", id: fixture.requestId, version: before.versions[`requests:${fixture.requestId}`]!.version, values: {} })).ok).toBe(true)
      // A synthetic imported replacement reuses the physical ID, then restores
      // the original business bytes. The lifecycle must still retain its new
      // incarnation; content restoration cannot revive the old issued scope.
      await fixture.persistence.transaction("procurement", async (snapshot) => {
        const replacement = structuredClone(object(row))
        const request = object(replacement.request)
        replacement.request = { ...request, pr: { ...object(request.pr), estAmount: 120 } }
        object(object(snapshot.data.store).requests)[fixture.requestId] = replacement
        return { commit: true, value: undefined }
      })
      await fixture.persistence.transaction("procurement", async (snapshot) => {
        object(object(snapshot.data.store).requests)[fixture.requestId] = structuredClone(row)
        return { commit: true, value: undefined }
      })
      concurrent.snapshot = await fixture.snapshot()
      concurrent.writes = fixture.writes.length
      expect(concurrent.writes).toBe(initialWrites + 3)
      expect(object(object(concurrent.snapshot.data.store).requests)[fixture.requestId]).toEqual(row)
    } finally {
      gate.release()
      await pending
    }
    expect((await pending).status).toBe("stale")
    expect(await fixture.snapshot()).toEqual(concurrent.snapshot)
    expect(fixture.writes).toHaveLength(concurrent.writes)
    const replacement = await fixture.sources.issue("procurement-request", fixture.requestId, fixture.context)
    if (replacement.status !== "ok") throw new Error("Replacement source unavailable after the read")
    expect(replacement.value).not.toBe(fixture.sourceRef)
  } finally { await fixture.dispose() }
})

test("canonical result persistence replays one result after SQLite reopen and refuses changed content or authority", async () => {
  const fixture = await createScenarioFixture()
  const lifecycle = { current: fixture, closed: false }
  try {
    const request = proposal(fixture.sourceRef)
    const preview = await fixture.producer.preview(request, fixture.context)
    if (preview.status !== "ok") throw new Error("Producer preview unavailable")
    const caseRef = { id: "procurement-case", incarnation: "case-incarnation", version: 1 }
    const create = (current: Awaited<ReturnType<typeof createScenarioFixture>>) => {
      const state = createSfProductState({ persistence: current.persistence, createId: randomUUID, resolveTarget: async (_request, _snapshot, namespace, target) => namespace === "cases" && target === caseRef.id ? { incarnation: caseRef.incarnation } : undefined, authorize: async (incoming) => {
        const principal = await current.host.authenticate(incoming)
        return principal ? { principalRef: principal.id, accessRevision: "access-1", policyVersion: "policy-1" } : undefined
      } })
      const results = createSfDecisionResultStore({ state, host: current.host, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && current.host.revalidate(context), verifySources: async (_value, refs, context) => {
        const verified = await Promise.all(refs.map(async (ref) => {
          const resolved = await current.sources.resolveForPreparation(ref.refId, context)
          return resolved.status === "ok" && digestSfValue(resolved.value.evidence) === digestSfValue(ref)
        }))
        return refs.length > 0 && verified.every(Boolean)
      }, createId: randomUUID, now: () => scenarioAt })
      return { state, results }
    }
    const first = create(fixture)
    const seeded = await first.state.transaction(fixture.request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: digestSfValue(caseRef), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (state) => {
      state.cases[caseRef.id] = { ...caseRef, state: "draft", objective: "Synthetic procurement comparison", currency: "USD", horizon: scenarioPeriod, criteria: [], participants: ["alice"], sourceRefs: [fixture.evidence], alternatives: [], costCoverageBases: [preview.value.basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    })
    expect(seeded.status).toBe("ok")
    const write = { kind: "scenario" as const, result: preview.value.scenario, caseRef, requestDigest: digestSfValue(request), sourceRefs: preview.value.scenario.sourceRefs, idempotencyKey: "procurement-scenario" }
    const lookup = { kind: write.kind, caseRef, idempotencyKey: write.idempotencyKey, requestDigest: write.requestDigest }
    const business = await fixture.snapshot()
    const stored = await first.results.write(write, fixture.context)
    if (stored.status !== "ok") throw new Error(`Result persistence failed: ${stored.reason}`)
    expect(await first.results.write(write, fixture.context)).toEqual(stored)
    expect((await first.results.write({ ...write, requestDigest: "f".repeat(64) }, fixture.context)).status).toBe("conflict")
    expect(await fixture.snapshot()).toEqual(business)
    await fixture.close()
    lifecycle.closed = true
    const reopened = await createScenarioFixture({ directory: fixture.directory, requestId: fixture.requestId })
    lifecycle.current = reopened
    lifecycle.closed = false
    reopened.clock.at = "2026-11-14T12:05:00Z"
    const again = create(reopened)
    const recomputed = await reopened.producer.simulateScenario(request, reopened.context)
    if (recomputed.status !== "ok") throw new Error("Reopened producer unavailable")
    expect(recomputed.value.id).toBe(preview.value.scenario.id)
    expect(recomputed.value.knownSubtotal).toBe(preview.value.scenario.knownSubtotal)
    expect(recomputed.value.sourceRefs).toEqual(preview.value.scenario.sourceRefs)
    expect(recomputed.value.components[0]?.sourceRefs[0]?.observedAt).toBe(reopened.clock.at)
    expect(recomputed.value.components[0]?.sourceRefs[0]?.observedAt).not.toBe(preview.value.scenario.components[0]?.sourceRefs[0]?.observedAt)
    expect(plannerScenarioDigest(recomputed.value)).toBe(plannerScenarioDigest(preview.value.scenario))
    expect(await again.results.readByRequest(lookup, reopened.context)).toEqual({ status: "ok", value: { state: "found", result: stored.value } })
    expect(await again.results.write(write, reopened.context)).toEqual(stored)
    const records = await again.state.read(reopened.request, "cases", (state) => Object.keys(object(object(state).decisionResults)))
    if (records.status !== "ok") throw new Error("Stored result inventory unavailable")
    expect(records.value).toHaveLength(1)
    const bob = await reopened.admit("bob")
    expect((await again.results.read({ kind: "scenario", resultRef: stored.value.resultRef }, bob.context)).status).toBe("denied")
    expect((await again.results.readByRequest({ ...lookup, caseRef: { ...caseRef, incarnation: "other-case" } }, reopened.context)).status).toBe("denied")
    const current = await reopened.snapshot()
    expect((await reopened.execute(reopened.requester, { page: "Requests", action: "save", id: reopened.requestId, version: current.versions[`requests:${reopened.requestId}`]!.version, values: { pr: { estAmount: 120 } } })).ok).toBe(true)
    expect((await again.results.read({ kind: "scenario", resultRef: stored.value.resultRef }, reopened.context)).status).toBe("denied")
  } finally {
    if (!lifecycle.closed) await lifecycle.current.dispose()
  }
})

function proposal(sourceRef: string): ScenarioRequest {
  return { baseRef: sourceRef, operations: [{ kind: "replace", targetRef: sourceRef, amount: 140, currency: "USD", period: scenarioPeriod }], assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", evidenceRefs: [], state: "hypothetical" }] }
}
