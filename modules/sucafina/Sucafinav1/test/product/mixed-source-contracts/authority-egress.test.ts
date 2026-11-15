import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PlannerPort } from "../../../product/contracts/ports.ts"
import { createSfProcurementCompositePlanner } from "../../../../../../apps/cli/src/sucafina-product/procurement-composite-planner.ts"
import { authorizeSfCompositeProcurementOperations } from "../../../../../../apps/cli/src/sucafina-product/scenario-operation-access.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"
import { createMixedPlannerFixture } from "./planner-fixture.ts"

for (const mutation of ["revoked", "actor", "access", "policy", "request", "headers", "lease", "abort", "source"] as const) {
  test(`mixed external authority refuses ${mutation} after a successful independent source read`, async () => {
    const deadline = compositionTestDeadline(`mixed-between-reads-${mutation}`, 105_000)
    try {
      const f = await deadline.phase("real-mixed-producers", () => createMixedPlannerFixture(deadline))
      const check = () => authorizeSfCompositeProcurementOperations({ host: f.authority.host, resolve: f.resolve }, f.decision, f.alternative, f.call)
      expect(await check()).toBe(true)
      expect(f.observations.refs.filter((entry) => entry.id === f.refs.procurement.refId)).toHaveLength(2)
      const originalRequestFor = f.authority.host.requestFor
      const replacement = new Request(f.transport)
      const race: { fired: boolean; after?: Awaited<ReturnType<typeof f.audit>> } = { fired: false }
      f.authority.host.requestFor = (context) => race.fired && mutation === "request" && context === f.call ? replacement : originalRequestFor(context)
      f.observations.refs.length = 0
      f.observations.afterResolve = async (ref) => {
        if (race.fired || ref.refId !== f.refs.procurement.refId) return
        expect(f.observations.refs.at(-1)).toEqual({ id: ref.refId, state: "fresh" })
        expect(originalRequestFor(f.call)).toBe(f.transport)
        race.fired = true
        if (mutation === "revoked") f.identity.allowed = false
        if (mutation === "actor") f.identity.principal = "other"
        if (mutation === "access") f.identity.canWrite = false
        if (mutation === "policy") f.config.policyVersion = "policy-after-source-read"
        if (mutation === "headers") f.transport.headers.set("x-mixed-observation", "changed")
        if (mutation === "lease") f.authority.ui.finish(f.call)
        if (mutation === "abort") f.controller.abort(new Error("Requested source observation abort"))
        if (mutation === "source") {
          const version = await f.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.versions[`requests:${f.requestId}`]!.version }))
          expect((await f.execute({ page: "Requests", action: "save", id: f.requestId, version, values: { pr: { estAmount: 150 } } })).ok).toBe(true)
        }
        race.after = await f.audit()
      }
      const allowed = await deadline.phase("between-independent-reads", check)
      expect(allowed).toBe(false)
      expect(race.fired).toBe(true)
      expect(race.after).toBeDefined()
      expect(f.observations.refs[0]).toEqual({ id: f.refs.procurement.refId, state: "fresh" })
      expect(await f.audit()).toEqual(race.after)
      expect(f.decision.choices).toEqual([])
      expect(f.decision.preparedChanges).toEqual([])
      expect(f.decision.receipts).toEqual([])
      console.info("SF_MIXED_AUTHORITY_PROOF", JSON.stringify({ mutation, eventFired: race.fired, allowed,
        observations: f.observations.refs, persistentEffectsDigest: digestSfValue(race.after), promotion: false, financialEffect: false }))
      f.authority.host.requestFor = originalRequestFor
    } finally { await deadline.close() }
  }, 120_000)
}

for (const mutation of ["request", "headers", "lease", "abort"] as const) {
  test(`mixed preview fences ${mutation} after its final genuine authority observation`, async () => {
    const deadline = compositionTestDeadline(`mixed-final-await-${mutation}`, 105_000)
    try {
      const f = await deadline.phase("real-mixed-producers", () => createMixedPlannerFixture(deadline))
      const revalidate = f.authority.host.revalidate, requestFor = f.authority.host.requestFor
      const replacement = new Request(f.transport)
      const observed = { withinProducer: false, calls: 0, target: 0, fired: false }
      f.authority.host.requestFor = (context) => observed.fired && mutation === "request" && context === f.call ? replacement : requestFor(context)
      f.authority.host.revalidate = async (context) => {
        const permitted = await revalidate(context)
        if (context !== f.call || !observed.withinProducer) return permitted
        observed.calls++
        if (permitted && observed.target > 0 && observed.calls === observed.target) {
          expect(requestFor(context)).toBe(f.transport)
          if (mutation === "headers") f.transport.headers.set("x-mixed-final-observation", "changed")
          if (mutation === "lease") f.authority.ui.finish(f.call)
          if (mutation === "abort") f.controller.abort(new Error("Abort after genuine revalidation"))
          observed.fired = true
        }
        return permitted
      }
      const direct = async () => {
        const captured: { result?: Awaited<ReturnType<PlannerPort["simulateScenario"]>> } = {}
        const outer = await f.business.withCase(f.call, f.caseRef, {}, async () => {
          observed.withinProducer = true
          try { captured.result = await f.business.planner.simulateScenario(f.scenario, f.call); return captured.result }
          finally { observed.withinProducer = false }
        })
        return { result: captured.result, outer }
      }
      // Calibrate the completed genuine producer, excluding the outer case guard.
      // The refusal assertion applies to the producer's own egress, so the outer
      // guard cannot hide a leaked result from the missing final-await fence.
      expect((await direct()).result?.status).toBe("ok")
      observed.calls = 0
      expect((await direct()).result?.status).toBe("ok")
      expect(observed.calls).toBeGreaterThan(0)
      observed.target = observed.calls
      observed.calls = 0
      const before = await f.audit()
      const refused = await deadline.phase("after-final-await", direct)
      expect(observed.fired).toBe(true)
      expect(observed.calls).toBe(observed.target)
      expect(refused.result?.status).not.toBe("ok")
      expect(refused.result && "value" in refused.result).toBe(false)
      expect(refused.outer.status).not.toBe("ok")
      expect(await f.audit()).toEqual(before)
      console.info("SF_MIXED_EGRESS_PROOF", JSON.stringify({ mutation, eventFired: observed.fired, finalObservation: observed.calls,
        producerStatus: refused.result?.status, outerStatus: refused.outer.status, noProjection: !(refused.result && "value" in refused.result),
        persistentEffectsDigest: digestSfValue(before), promotion: false, financialEffect: false }))
      f.authority.host.revalidate = revalidate
      f.authority.host.requestFor = requestFor
    } finally { await deadline.close() }
  }, 120_000)
}

test("mixed preview refuses a real C08 membership change between its protected case observations", async () => {
  const deadline = compositionTestDeadline("mixed-case-read-race", 105_000)
  try {
    const f = await deadline.phase("real-mixed-producers", () => createMixedPlannerFixture(deadline))
    const race: { armed: boolean; fired: boolean; reads: number; after?: Awaited<ReturnType<typeof f.audit>> } = { armed: false, fired: false, reads: 0 }
    const composed = createSfProcurementCompositePlanner({ host: f.authority.host, state: f.authority.state, planner: f.business.plannerProduct.planner,
      selectedCase: f.business.selectedCase, readSourceFences: async (context) => {
        const actual = await f.business.readSourceFences(context)
        race.reads++
        if (race.armed && !race.fired) {
          expect(actual).toBeDefined()
          race.fired = true
          await f.saveCase({ ...f.decision, participants: [] })
          race.after = await f.audit()
        }
        return actual
      } })
    const direct = async () => {
      const captured: { result?: Awaited<ReturnType<PlannerPort["simulateScenario"]>> } = {}
      await f.business.withCase(f.call, f.caseRef, {}, async () => {
        captured.result = await composed.planner.simulateScenario(f.scenario, f.call)
        return captured.result
      })
      return captured.result
    }
    expect((await direct())?.status).toBe("ok")
    race.reads = 0
    race.armed = true
    const result = await direct()
    expect(race.fired).toBe(true)
    expect(race.reads).toBeGreaterThan(0)
    expect(result?.status).not.toBe("ok")
    expect(result && "value" in result).toBe(false)
    expect(await f.audit()).toEqual(race.after)
    console.info("SF_MIXED_AUTHORITY_PROOF", JSON.stringify({ mutation: "C08-membership", eventFired: race.fired,
      sourceFenceReads: race.reads, producerStatus: result?.status, effectsDigest: digestSfValue(race.after), financialEffect: false }))
  } finally { await deadline.close() }
}, 120_000)

test("mixed authority rejects substituted binding and lease objects while the genuine admitted context remains valid", async () => {
  const deadline = compositionTestDeadline("mixed-immutable-admission", 105_000)
  try {
    const f = await createMixedPlannerFixture(deadline)
    const verify = (context: Parameters<typeof authorizeSfCompositeProcurementOperations>[3]) =>
      authorizeSfCompositeProcurementOperations({ host: f.authority.host, resolve: f.resolve }, f.decision, f.alternative, context)
    expect(Object.isFrozen(f.call)).toBe(true)
    expect(Object.isFrozen(f.call.binding)).toBe(true)
    expect(Object.isFrozen(f.call.lease)).toBe(true)
    expect(await verify(f.call)).toBe(true)
    const before = await f.audit()
    expect(await verify({ ...f.call, binding: { ...f.call.binding, principalRef: "other" } })).toBe(false)
    expect(await verify({ ...f.call, binding: { ...f.call.binding, policyVersion: "other-policy" } })).toBe(false)
    expect(await verify({ ...f.call, binding: { ...f.call.binding, accessRevision: "other-access" } })).toBe(false)
    expect(await verify({ ...f.call, lease: structuredClone(f.call.lease) })).toBe(false)
    expect(await verify(f.call)).toBe(true)
    expect(await f.audit()).toEqual(before)
  } finally { await deadline.close() }
}, 120_000)
