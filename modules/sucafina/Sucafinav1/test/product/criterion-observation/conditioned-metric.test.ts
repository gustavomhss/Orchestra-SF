import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { criterionRuleKey } from "../../../product/decisions/criterion-rules.ts"
import type { CriterionRule } from "../../../product/decisions/criterion-rules.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createPlannerCriterionObservationReader, createPlannerScenarioComparator, resolvePlannerScenarioBatch } from "../../../product/planner/scenario-comparison-port.ts"
import type { PlannerCriteriaHost, PlannerScenarioHost } from "../../../product/planner/scenario-comparison-port.ts"
import { createSfConditionedCriterionMetric } from "../../../../../../apps/cli/src/sucafina-product/portfolio-criterion-observation.ts"
import { criterionFixture, ok } from "./fixture.ts"

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((done) => { resolve = done })
  return { promise, resolve }
}
type Fixture = Awaited<ReturnType<typeof criterionFixture>>
function metricConditioned(result: Awaited<ReturnType<Fixture["compare"]>>) {
  expect(result).toMatchObject({ status: "ok", value: { comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null,
    criterionResults: [{ criterionId: "cost", state: "unknown", reason: "criterion-metric-conditioned" }] } })
}

test("ordinary source-only rule uses both current observations and never satisfies a conditioned metric", async () => {
  const f = await criterionFixture()
  try {
    const start = f.controls.environmentReads
    const first = await f.compare()
    const fastReads = f.controls.environmentReads - start
    metricConditioned(first)
    expect(f.controls.metricCalls).toBe(2)
    expect(f.controls.metricCaseReads).toBe(4)
    const repeat = await f.compare()
    expect(repeat).toEqual(first)
    expect(f.controls.metricCalls).toBe(4)
    expect(f.controls.metricCaseReads).toBe(8)

    // An opaque wrapper has no registered observation channel. It must still
    // produce the identical real answer using the original complete producer.
    const original = f.business.planner.compareScenarios
    f.business.planner.compareScenarios = (request, call) => original(request, call)
    const beforeWrapped = f.controls.environmentReads
    const wrapped = await f.compare()
    expect(wrapped).toEqual(first)
    expect(f.controls.metricCaseReads).toBe(8)
    expect(f.controls.environmentReads - beforeWrapped).toBeGreaterThan(fastReads)
  } finally { await f.dispose() }
}, 120000)

for (const fault of ["case", "result", "source", "coverage", "acl", "preferences"] as const) {
  test("conditioned metric refuses current " + fault + " drift after its first C08 observation", async () => {
    const f = await criterionFixture()
    try {
      let changed = false
      const metricResults: PortResult<unknown>[] = []
      f.controls.afterMetric = async (value) => { metricResults.push(value) }
      f.controls.afterState = async (namespace) => {
        if (changed || !f.controls.metricDepth || namespace !== "cases" || f.controls.metricCaseReads !== 1) return
        changed = true
        if (fault === "acl") { f.active.value = false; return }
        if (fault === "preferences") { f.controls.preferencesAllowed = false; return }
        if (fault === "source") {
          await f.persistence.transaction("planner", async (snapshot) => {
            const versions = snapshot.data.versions as { lines: { f: number[] }[] }[]
            versions[1]!.lines[0]!.f[0] = 999
            return { commit: true, value: undefined }
          })
          return
        }
        await f.mutate((state) => {
          const decision = state.cases[f.caseRef.id]!
          if (fault === "case") decision.objective += " changed without a version bump"
          if (fault === "result") {
            const stored = state.decisionResults![f.resultRefs[1]!]!
            if (stored.kind !== "scenario") throw new Error("Actual scenario missing")
            stored.result = { ...stored.result, knownSubtotal: 999999 }
            stored.resultDigest = digestSfValue(stored.result)
          }
          if (fault === "coverage") {
            const alternative = decision.alternatives[1]!
            alternative.result = { ...alternative.result, costCoverage: { ...alternative.result.costCoverage, issues: ["changed actual coverage"] } }
          }
        })
      }
      const result = await f.compare()
      expect(changed).toBe(true)
      expect(result.status).not.toBe("ok")
      expect(metricResults).toHaveLength(1)
      expect(metricResults[0]!.status).not.toBe("ok")
    } finally { await f.dispose() }
  }, 120000)
}

for (const fault of ["headers", "request-provider", "method", "borrowed-state"] as const) {
  test("conditioned metric keeps its final await fence for " + fault, async () => {
    const f = await criterionFixture()
    try {
      let transport: Request | undefined
      let changed = false
      f.controls.beforeMetric = async (_request, call) => { transport = f.authority.host.requestFor(call) }
      f.controls.afterState = async (namespace, found) => {
        if (changed || !f.controls.metricDepth || namespace !== "cases" || f.controls.metricCaseReads !== 2) return
        changed = true
        if (fault === "headers") transport!.headers.set("x-operation", "changed-after-final-state-authority")
        if (fault === "request-provider") f.authority.host.requestFor = () => new Request(transport!)
        if (fault === "method") {
          const previous = f.business.planner.compareScenarios
          f.business.planner.compareScenarios = (request, call) => previous(request, call)
        }
        if (fault === "borrowed-state") {
          const result = found as { status: string; value?: { digest: string } }
          if (result.status !== "ok" || !result.value) throw new Error("Real final C08 sample missing")
          result.value.digest = "0".repeat(64)
        }
      }
      expect((await f.compare()).status).not.toBe("ok")
      expect(changed).toBe(true)
    } finally { await f.dispose() }
  }, 120000)
}

for (const fault of ["reversed-pair", "wrong-criterion"] as const) {
  test("conditioned observation cannot attest " + fault, async () => {
    const f = await criterionFixture()
    try {
      f.controls.beforeMetric = async (request) => fault === "wrong-criterion"
        ? { ...request, criterionId: "not-the-evaluated-criterion" }
        : { ...request, scenarioRef: request.baselineRef!, baselineRef: request.scenarioRef }
      expect((await f.compare()).status).not.toBe("ok")
      expect(f.controls.metricCalls).toBe(1)
      expect(f.controls.metricCaseReads).toBe(0)
    } finally { await f.dispose() }
  }, 120000)
}

test("a legitimate human rule revision between evaluation phases invalidates the comparison", async () => {
  const f = await criterionFixture()
  try {
    let changed = false
    f.controls.beforeMetric = async () => {
      if (f.controls.metricCalls !== 2 || changed) return
      changed = true
      await f.register({ ...f.ruleInput, value: 1500, expectedRuleVersion: 1 })
    }
    expect((await f.compare()).status).not.toBe("ok")
    expect(changed).toBe(true)
    const observed = await f.authority.state.read(f.request(), "preferences", (state) =>
      state.preferences[criterionRuleKey(f.caseRef, "cost")] as CriterionRule)
    expect(observed.status === "ok" && observed.value.version).toBe(2)
  } finally { await f.dispose() }
}, 120000)

test("another concurrent caller cannot borrow the active lexical owner", async () => {
  const f = await criterionFixture()
  const reached = deferred(), release = deferred()
  const reader = createPlannerCriterionObservationReader(f.business.planner.compareScenarios, () => true)
  const { call } = await f.admit()
  let compared: ReturnType<typeof f.business.planner.compareScenarios> | undefined
  try {
    f.controls.afterState = async (namespace) => {
      if (!f.controls.metricDepth || namespace !== "cases" || f.controls.metricCaseReads !== 1) return
      reached.resolve()
      await release.promise
    }
    compared = f.business.withCase(call, f.caseRef, {}, () => f.business.planner.compareScenarios(f.compareRequest, call))
    await Promise.race([reached.promise, compared.then((result) => { throw new Error("Comparison finished before the real metric observation: " + JSON.stringify(result)) })])
    let verified = false
    const outside = await reader(f.metricRequest, call, async () => { verified = true; return true })
    expect(outside).toMatchObject({ status: "denied", reason: "criterion-observation-owner-unavailable" })
    expect(verified).toBe(false)
    release.resolve()
    metricConditioned(await compared)
  } finally {
    release.resolve()
    await compared?.catch(() => undefined)
    f.authority.ui.finish(call)
    await f.dispose()
  }
}, 120000)

test("an asynchronous descendant cannot consume a criterion scope after the callback has completed", async () => {
  const f = await criterionFixture()
  const release = deferred()
  const reader = createPlannerCriterionObservationReader(f.business.planner.compareScenarios, () => true)
  let later: ReturnType<typeof reader> | undefined
  let verified = false
  try {
    f.controls.beforeMetric = async (request, call) => {
      if (!later) later = release.promise.then(() => reader(request, call, async () => { verified = true; return true }))
    }
    metricConditioned(await f.compare())
    release.resolve()
    expect((await later)?.status).not.toBe("ok")
    expect(verified).toBe(false)
  } finally { release.resolve(); await later; await f.dispose() }
}, 120000)

test("borrowed observation mutation poisons the scope instead of minting a new metric", async () => {
  const f = await criterionFixture()
  const reader = createPlannerCriterionObservationReader(f.business.planner.compareScenarios, () => true)
  let rejected: Awaited<ReturnType<typeof reader>>
  try {
    f.controls.beforeMetric = async (request, call) => {
      rejected = await reader(request, call, async (observation) => {
        observation.metric.value = 0
        return true
      })
    }
    expect((await f.compare()).status).not.toBe("ok")
    expect(rejected!).toMatchObject({ status: "stale", reason: "criterion-observation-changed" })
  } finally { await f.dispose() }
}, 120000)

test("a registered comparator with forged scenario values still cannot attest a C08 metric", async () => {
  const f = await criterionFixture()
  const { call } = await f.admit()
  try {
    const result = await f.business.withCase(call, f.caseRef, {}, async () => {
      const actual = await resolvePlannerScenarioBatch(f.business.plannerProduct.scenarios!, f.resultRefs, call)
      const values = actual.map((entry) => ok(entry, "Resolve real scenario for counterproof"))
      const invented = structuredClone(values)
      invented[1]!.result = { ...invented[1]!.result, knownSubtotal: 999999 }
      const scenarios: PlannerScenarioHost = {
        resolve: async (reference) => ({ status: "ok", value: structuredClone(invented[f.resultRefs.indexOf(reference)]!) }),
        resolveMany: async (references) => references.map((reference) => ({ status: "ok", value: structuredClone(invented[f.resultRefs.indexOf(reference)]!) })),
      }
      let metric!: ReturnType<typeof createSfConditionedCriterionMetric>
      let observed: Awaited<ReturnType<typeof metric>>
      const criteria: PlannerCriteriaHost = { evaluate: async () => {
        const stored = ok(await f.business.results.readHistoricalScenario({ resultRef: f.resultRefs[1]! }, call), "Reopen real stored scenario")
        observed = await metric(f.metricRequest, call, stored)
        return observed && observed.status !== "ok" ? observed
          : { status: "ok", value: { criterionId: "cost", state: "unknown", reason: "unexpected-forged-metric", evidenceRefs: [] } }
      } }
      const compare = createPlannerScenarioComparator({ host: f.authority.host, sources: f.business.plannerSources, scenarios, criteria })
      const business = { ...f.business, planner: { ...f.business.planner, compareScenarios: compare }, plannerProduct: { ...f.business.plannerProduct, scenarios } }
      metric = createSfConditionedCriterionMetric({ authority: f.authority, business })
      const result = await compare(f.compareRequest, call)
      expect(observed).toMatchObject({ status: "stale", reason: "criterion-observation-changed" })
      expect(result.status).not.toBe("ok")
      return result
    })
    expect(result.status).not.toBe("ok")
  } finally { f.authority.ui.finish(call); await f.dispose() }
}, 120000)

test("a copied binding or lease cannot use the real criterion callback's observation", async () => {
  const f = await criterionFixture()
  const reader = createPlannerCriterionObservationReader(f.business.planner.compareScenarios, () => true)
  const refused: (Awaited<ReturnType<typeof reader>>)[] = []
  try {
    f.controls.beforeMetric = async (request, call) => {
      expect(Object.isFrozen(call)).toBe(true)
      expect(Object.isFrozen(call.binding)).toBe(true)
      for (const replacement of [{ ...call, binding: { ...call.binding } }, { ...call, lease: { ...call.lease } }]) {
        let verified = false
        refused.push(await reader(request, replacement as TrustedDomainContext, async () => { verified = true; return true }))
        expect(verified).toBe(false)
      }
    }
    expect((await f.compare()).status).not.toBe("ok")
    expect(refused).toHaveLength(2)
    expect(refused.every((entry) => entry?.status === "stale")).toBe(true)
  } finally { await f.dispose() }
}, 120000)

for (const field of ["state-read", "selected-case", "source-fences", "compare"] as const) {
  test("accessor-backed " + field + " retains the full metric producer at entry", async () => {
    const f = await criterionFixture()
    try {
      const [object, key] = field === "state-read" ? [f.authority.state, "read"] as const
        : field === "selected-case" ? [f.business, "selectedCase"] as const
        : field === "source-fences" ? [f.business, "lockedSourceFences"] as const
        : [f.business.planner, "compareScenarios"] as const
      const descriptor = Object.getOwnPropertyDescriptor(object, key)!
      Object.defineProperty(object, key, { enumerable: descriptor.enumerable, configurable: true, get: () => descriptor.value })
      metricConditioned(await f.compare())
      expect(f.controls.metricCalls).toBe(2)
      expect(f.controls.metricCaseReads).toBe(0)
    } finally { await f.dispose() }
  }, 120000)
}
