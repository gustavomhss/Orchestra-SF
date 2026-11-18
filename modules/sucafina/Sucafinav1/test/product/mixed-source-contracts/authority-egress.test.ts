import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
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
      if (!race.after) throw new Error("Real authority race omitted its durable audit observation")
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
    if (!race.after) throw new Error("C08 membership race omitted its durable audit observation")
    expect(await f.audit()).toEqual(race.after)
    console.info("SF_MIXED_AUTHORITY_PROOF", JSON.stringify({ mutation: "C08-membership", eventFired: race.fired,
      sourceFenceReads: race.reads, producerStatus: result?.status, effectsDigest: digestSfValue(race.after), financialEffect: false }))
  } finally { await deadline.close() }
}, 120_000)

test("mixed authority accepts canonical value evidence and rejects corrupted copies of actual Procurement observations", async () => {
  const deadline = compositionTestDeadline("mixed-canonical-procurement-values", 105_000)
  try {
    const f = await deadline.phase("real-mixed-producers", () => createMixedPlannerFixture(deadline))
    const original = await f.business.context.resolve(f.refs.procurement, f.call)
    expect(original.state).toBe("fresh")
    if (!original.authorizedProjection || !("components" in original.authorizedProjection)) throw new Error("Real canonical Procurement projection unavailable")
    expect(original.authorizedProjection.engineVersion).toBe("procurement-v1")
    expect(original.authorizedProjection.context.sourceRefs).toEqual([])
    expect(original.authorizedProjection.components).toEqual([])
    expect(original.authorizedProjection.values.find((value) => value.id === "originalAmount")).toMatchObject({
      value: 100, currency: "USD", granularity: "record", sourceRefs: [f.refs.procurement], drilldown: f.refs.procurement, evidenceState: "estimated" })
    const before = await f.audit()
    const verify = (resolve = f.business.context.resolve) =>
      authorizeSfCompositeProcurementOperations({ host: f.authority.host, resolve }, f.decision, f.alternative, f.call)
    expect(await verify()).toBe(true)
    const foreignBase = { ...f.refs.procurement, target: { ...f.refs.procurement.target, recordId: "another-request" }, refDigest: "" }
    const foreign = { ...foreignBase, refDigest: digestSfEvidenceRef(foreignBase) }
    const amount = (projection: DomainProjection, update: Partial<DomainProjection["values"][number]>): DomainProjection => ({ ...projection,
      values: projection.values.map((value) => value.id === "originalAmount" ? { ...value, ...update } : value) })
    const corruptions: { name: string; change: (projection: DomainProjection) => DomainProjection }[] = [
      { name: "engine", change: (value) => ({ ...value, engineVersion: "substitute-engine" }) },
      { name: "version", change: (value) => ({ ...value, version: value.version + 1 }) },
      { name: "principal", change: (value) => ({ ...value, context: { ...value.context, principalRef: "other" } }) },
      { name: "installation", change: (value) => ({ ...value, context: { ...value.context, installationId: "other" } }) },
      { name: "policy", change: (value) => ({ ...value, context: { ...value.context, policyVersion: "other" } }) },
      { name: "access", change: (value) => ({ ...value, context: { ...value.context, accessRevision: "other" } }) },
      { name: "currency", change: (value) => ({ ...value, context: { ...value.context, currency: "EUR" } }) },
      { name: "horizon", change: (value) => ({ ...value, context: { ...value.context, period: { start: "2026-02-01", end: "2026-12-31" } } }) },
      { name: "component", change: (value) => ({ ...value, components: [f.alternative.result.components[0]!] }) },
      { name: "missing-amount", change: (value) => ({ ...value, values: value.values.filter((entry) => entry.id !== "originalAmount") }) },
      { name: "duplicate-amount", change: (value) => ({ ...value, values: [...value.values, value.values.find((entry) => entry.id === "originalAmount")!] }) },
      { name: "unbound-amount", change: (value) => amount(value, { sourceRefs: [] }) },
      { name: "foreign-amount", change: (value) => amount(value, { sourceRefs: [foreign] }) },
      { name: "foreign-drilldown", change: (value) => amount(value, { drilldown: foreign }) },
      { name: "non-numeric-amount", change: (value) => amount(value, { value: "100" }) },
      { name: "non-finite-amount", change: (value) => amount(value, { value: NaN }) },
      { name: "wrong-amount-currency", change: (value) => amount(value, { currency: "EUR" }) },
      { name: "wrong-amount-period", change: (value) => amount(value, { period: { start: "2026-02-01", end: "2026-12-31" } }) },
      { name: "wrong-granularity", change: (value) => amount(value, { granularity: "month" }) },
      { name: "hypothetical-original", change: (value) => amount(value, { evidenceState: "hypothetical" }) },
      { name: "foreign-context-source", change: (value) => ({ ...value, context: { ...value.context, sourceRefs: [{ surface: "procurement",
        type: f.refs.procurement.target.recordType, id: "another-request", incarnation: f.refs.procurement.target.incarnation,
        version: f.refs.procurement.target.version, fields: ["originalAmount"], period: value.context.period, observedAt: f.clock.at }] } }) },
    ]
    const outcomes: { fault: string; observations: number; allowed: boolean }[] = []
    for (const fault of corruptions) {
      const observation = { reads: 0 }
      const allowed = await verify(async (ref, call) => {
        const genuine = await f.business.context.resolve(ref, call)
        expect(genuine.state).toBe("fresh")
        if (!genuine.authorizedProjection || !("components" in genuine.authorizedProjection)) throw new Error("Real observation missing before corruption")
        observation.reads++
        // Faults affect only copies returned by a wrapper around a successful
        // real read. No forged observation is used for any positive assertion.
        return { ...genuine, authorizedProjection: fault.change(structuredClone(genuine.authorizedProjection)) }
      })
      expect(observation.reads).toBeGreaterThan(0)
      expect(allowed).toBe(false)
      outcomes.push({ fault: fault.name, observations: observation.reads, allowed })
    }
    expect(await verify()).toBe(true)
    const latest = await f.business.context.resolve(f.refs.procurement, f.call)
    const { checkedAt: _originalAt, ...originalMaterial } = original
    const { checkedAt: _latestAt, ...latestMaterial } = latest
    expect(latestMaterial).toEqual(originalMaterial)
    expect(latest.authorizedProjection).toEqual(original.authorizedProjection)
    expect(await f.audit()).toEqual(before)
    console.info("SF_MIXED_CANONICAL_SHAPE_PROOF", JSON.stringify({ engine: original.authorizedProjection.engineVersion,
      contextSources: original.authorizedProjection.context.sourceRefs.length, components: original.authorizedProjection.components.length,
      reference: f.refs.procurement.refId, projectionDigest: digestSfValue(original.authorizedProjection), outcomes, financialEffect: false }))
  } finally { await deadline.close() }
}, 120_000)

test("mixed canonical Procurement retains a real absent estimate as unresolved evidence", async () => {
  const deadline = compositionTestDeadline("mixed-canonical-absent-estimate", 105_000)
  try {
    const f = await createMixedPlannerFixture(deadline, { amount: null })
    const source = await f.business.context.resolve(f.refs.procurement, f.call)
    expect(source.state).toBe("fresh")
    if (!source.authorizedProjection || !("components" in source.authorizedProjection)) throw new Error("Real missing-estimate source unavailable")
    expect(source.authorizedProjection.values.find((value) => value.id === "originalAmount")).toMatchObject({
      value: null, currency: "USD", evidenceState: "absent", sourceRefs: [f.refs.procurement], drilldown: f.refs.procurement })
    expect(source.authorizedProjection.missing).toContainEqual({ field: "baseAmount", reason: "unavailable" })
    expect(f.alternative.result.total).toBeNull()
    expect(f.alternative.result.comparisonStatus).toBe("conditioned")
    const before = await f.audit()
    const allowed = await authorizeSfCompositeProcurementOperations({ host: f.authority.host, resolve: f.business.context.resolve }, f.decision, f.alternative, f.call)
    expect(allowed).toBe(true)
    expect(await f.audit()).toEqual(before)
    console.info("SF_MIXED_CANONICAL_SHAPE_PROOF", JSON.stringify({ fixture: "real-absent-estimate", allowed,
      reference: f.refs.procurement.refId, projectionDigest: digestSfValue(source.authorizedProjection), financialEffect: false }))
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
