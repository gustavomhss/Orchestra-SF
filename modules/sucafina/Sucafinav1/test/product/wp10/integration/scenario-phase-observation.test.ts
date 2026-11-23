import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { compareScenarios, resolvePlannerScenarioBatch } from "../../../../product/planner/scenario-comparison-port.ts"
import type { PlannerScenarioObservation } from "../../../../product/planner/scenario-comparison-port.ts"
import { rows } from "../../../../runtime/contract.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"
import { sensitivityObservationFixture, sensitivityOk } from "./sensitivity-observation-fixture.ts"

test("scenario comparison preserves canonical values and independently closes every pair phase", async () => {
  const deadline = compositionTestDeadline("scenario-phase-observation")
  try {
    const fixture = await deadline.phase("native-fixture", () => sensitivityObservationFixture(deadline))
    const scenarios = fixture.business.plannerProduct.scenarios
    if (!scenarios) throw new Error("Canonical stored scenario reader unavailable")
    const input = { scenarioRefs: fixture.references, criteria: ["cost"] }
    const originalCaseRead = fixture.business.cases.read
    const counts = { phases: 0, reads: 0, criteria: 0 }
    const run = async (observeScenarios?: PlannerScenarioObservation) => {
      const digest = digestSfValue(input)
      const call = sensitivityOk(await fixture.authority.ui.admit(fixture.transport, "sf_scenario_compare", digest))
      try {
        expect(await fixture.authority.ui.validate(call, "sf_scenario_compare", digest)).toBe(true)
        return await fixture.business.withCase(call, fixture.caseRef, {}, () => compareScenarios({
          host: fixture.authority.host, sources: fixture.business.plannerSources, scenarios,
          ...(observeScenarios ? { observeScenarios } : {}),
          criteria: { evaluate: async (request, context) => {
            // Rules keep their original producer and execute after each pair root has closed.
            expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
            counts.criteria++
            return fixture.portfolio.rules.evaluate({ ...request, caseRef: fixture.caseRef }, context)
          } },
        }, input, call))
      } finally { fixture.authority.ui.finish(call) }
    }
    const observe: PlannerScenarioObservation = async (references, call, read) => {
      expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
      const observed = await fixture.business.observePlannerScenarios(references, call, async () => {
        counts.reads++
        expect(fixture.persistence.currentSnapshots?.()).toBeDefined()
        return read()
      })
      expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
      counts.phases++
      return observed
    }
    const canonical = sensitivityOk(await deadline.phase("canonical-without-callback", () => run()))
    expect(canonical).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    expect(canonical.criterionResults).toHaveLength(1)
    const criteriaBefore = counts.criteria
    const observed = sensitivityOk(await deadline.phase("observed-comparison", () => run(observe)))
    expect(observed).toEqual(canonical)
    expect(counts).toEqual({ phases: 3, reads: 3, criteria: criteriaBefore + 2 })
    // A second invocation must perform all initial/second/final reads again.
    expect(sensitivityOk(await deadline.phase("fresh-comparison", () => run(observe)))).toEqual(canonical)
    expect(counts).toEqual({ phases: 6, reads: 6, criteria: criteriaBefore + 4 })
    try {
      const revoked = await deadline.phase("revoked-during-pair", () => run((references, call, read) =>
        fixture.business.observePlannerScenarios(references, call, async () => {
          const value = await read()
          fixture.control.active = false
          return value
        })))
      expect(revoked.status).not.toBe("ok")
    } finally { fixture.control.active = true }
    let caseReads = 0
    fixture.business.cases.read = async (request, call) => {
      const current = await originalCaseRead(request, call)
      if (++caseReads === 2) fixture.business.cases.read = originalCaseRead
      return current
    }
    try {
      const replaced = await deadline.phase("reader-replaced-during-pair", () => run(observe))
      expect(replaced.status).not.toBe("ok")
      expect(caseReads).toBe(2)
    } finally { fixture.business.cases.read = originalCaseRead }
    let closedPhases = 0
    const changed = await deadline.phase("source-changed-after-pair-root", () => run(async (references, call, read) => {
      const value = await observe(references, call, read)
      if (++closedPhases === 1) await fixture.persistence.transaction("planner", async (snapshot) => {
        const line = rows(rows(snapshot.data.versions).find((version) => version.id === "v0")?.lines)[0]
        if (!line || !Array.isArray(line.b)) throw new Error("Original Planner baseline unavailable")
        line.b[0] = 999
        return { commit: true, value: undefined }
      })
      return value
    }))
    expect(changed.status).not.toBe("ok")
    expect(closedPhases).toBeGreaterThan(0)
  } finally { await deadline.close() }
}, 120_000)

test("scenario observation boundaries refuse incomplete phases and detach retained canonical responses", async () => {
  const deadline = compositionTestDeadline("scenario-observation-boundary")
  try {
    const fixture = await deadline.phase("native-fixture", () => sensitivityObservationFixture(deadline))
    const scenarios = fixture.business.plannerProduct.scenarios
    if (!scenarios) throw new Error("Canonical stored scenario reader unavailable")
    const input = { scenarioRefs: fixture.references, criteria: ["cost"] }
    const counts = { observations: 0, batches: 0, scalar: 0 }
    const measured = {
      resolve: (...args: Parameters<typeof scenarios.resolve>) => {
        counts.scalar++
        return scenarios.resolve(...args)
      },
      resolveMany: (references: readonly string[], context: Parameters<typeof scenarios.resolve>[1]) => {
        counts.batches++
        return resolvePlannerScenarioBatch(scenarios, references, context)
      },
    }
    const reset = () => { counts.observations = 0; counts.batches = 0; counts.scalar = 0 }
    const run = async (observeScenarios?: PlannerScenarioObservation) => {
      const digest = digestSfValue(input)
      const call = sensitivityOk(await fixture.authority.ui.admit(fixture.transport, "sf_scenario_compare", digest))
      try {
        expect(await fixture.authority.ui.validate(call, "sf_scenario_compare", digest)).toBe(true)
        return await fixture.business.withCase(call, fixture.caseRef, {}, () => compareScenarios({
          host: fixture.authority.host, sources: fixture.business.plannerSources, scenarios: measured,
          ...(observeScenarios ? { observeScenarios } : {}),
          criteria: { evaluate: (request, context) =>
            fixture.portfolio.rules.evaluate({ ...request, caseRef: fixture.caseRef }, context) },
        }, input, call))
      } finally { fixture.authority.ui.finish(call) }
    }
    const canonical = sensitivityOk(await deadline.phase("canonical-boundary-reference", () => run()))
    expect(canonical).toMatchObject({ comparisonStatus: "conditioned", completeDifference: null })
    expect(canonical.criterionResults).toHaveLength(1)
    // Every truncated response starts with an actual successful canonical pair.
    // Neither a missing later phase nor an initial short array can release it.
    for (const fault of [{ phase: 1, length: 0 }, { phase: 2, length: 0 }, { phase: 2, length: 1 },
      { phase: 3, length: 0 }, { phase: 3, length: 1 }]) {
      reset()
      const refused = await deadline.phase("incomplete-phase-" + fault.phase + "-length-" + fault.length, () =>
        run(async (references, call, read) => {
          counts.observations++
          const values = await fixture.business.observePlannerScenarios(references, call, read)
          expect(values).toHaveLength(2)
          expect(values.every((value) => value.status === "ok")).toBe(true)
          return counts.observations === fault.phase ? values.slice(0, fault.length) : values
        }))
      expect(refused).toEqual(fault.phase === 1
        ? { status: "unavailable", reason: "scenario-batch-invalid" }
        : { status: "stale", reason: fault.phase === 2 ? "scenario-or-authority-changed" : "criterion-or-authority-changed" })
      expect(counts).toEqual({ observations: fault.phase, batches: fault.phase, scalar: 0 })
    }
    for (const status of ["denied", "unavailable", "stale"] as const) {
      reset()
      const refusal = { status, reason: "host-observation-refused" }
      const refused = await deadline.phase("typed-refusal-" + status, () => run(async (references) => {
        counts.observations++
        return references.map(() => ({ ...refusal }))
      }))
      expect(refused).toEqual(refusal)
      expect(counts).toEqual({ observations: 1, batches: 0, scalar: 0 })
    }
    reset()
    let retained: Awaited<ReturnType<PlannerScenarioObservation>> | undefined
    const detached = await deadline.phase("retained-response-mutated-between-phases", () =>
      run(async (references, call, read) => {
        counts.observations++
        if (counts.observations === 2) {
          const earlier = retained?.[0]
          if (!earlier || earlier.status !== "ok") throw new Error("The first canonical observation was not retained")
          expect(Reflect.set(earlier.value.result.sourceRefs, "length", 0)).toBe(true)
          expect(earlier.value.result.sourceRefs).toHaveLength(0)
        }
        const values = await fixture.business.observePlannerScenarios(references, call, read)
        expect(values).toHaveLength(2)
        expect(values.every((value) => value.status === "ok")).toBe(true)
        if (counts.observations === 1) retained = values
        return values
      }))
    expect(detached).toEqual({ status: "ok", value: canonical })
    expect(counts).toEqual({ observations: 3, batches: 3, scalar: 0 })
  } finally { await deadline.close() }
}, 120_000)
