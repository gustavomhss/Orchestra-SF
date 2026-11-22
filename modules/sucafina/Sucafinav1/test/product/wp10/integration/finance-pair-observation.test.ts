import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPortfolioAuthority } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-authority.ts"
import { createSfPortfolioCoverageAuthority } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-coverage-authority.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"

import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { resolvePlannerScenarioBatch } from "../../../../product/planner/scenario-comparison-port.ts"
import type { AssetPersistence } from "../../../../runtime/assets.ts"
import { rows } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Counts = { physical: number; roots: number; work: number; afterClose?: { root: number; work: number; outside: boolean } }

test("Finance and criterion metrics use original pair reads and close on revocation or source change", async () => {
  const deadline = compositionTestDeadline("finance-pair-observation")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-finance-pair-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const physical = new AsyncLocalStorage<boolean>()
  const control: { active: boolean; counts?: Counts; afterRoot?: () => Promise<void> } = { active: true }
  const assets: AssetPersistence = store
  const transaction = assets.transaction, all = store.transactionAll, root = store.readSnapshotRoot
  const currentSnapshots = store.currentSnapshots
  if (!all || !root || !currentSnapshots) {
    await deadline.close()
    throw new Error("Finance fixture requires multi-surface transactions and snapshot-root reads")
  }
  const observeTransaction: AssetPersistence["transaction"] = (surface, work, options) => {
    if (control.counts && !physical.getStore()) control.counts.physical++
    return transaction(surface, (...args) => physical.run(true, () => work(...args)), options)
  }
  store.transaction = observeTransaction
  store.transactionAll = (work, options) => {
    if (control.counts && !physical.getStore()) control.counts.physical++
    return all((...args) => physical.run(true, () => work(...args)), options)
  }
  store.readSnapshotRoot = async (work, options) => {
    if (control.counts) {
      control.counts.roots++
      if (!physical.getStore()) control.counts.physical++
    }
    const value = await root(() => physical.run(true, work), options)
    const after = control.afterRoot
    control.afterRoot = undefined
    if (after && control.counts) control.counts.afterClose = { root: control.counts.roots, work: control.counts.work,
      outside: !physical.getStore() && currentSnapshots() === undefined }
    await after?.()
    return value
  }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => at) }) }
  const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal, headers: { origin: "https://example.test" } })
  const identity = { installationId: "finance-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const proposalCoverageWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
    policyVersion: "finance-policy", persistence, proposalCoverageWrites, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_evidence_get"], humanActions: ["decisions.criteria"] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  deadline.own(() => business.dispose())
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { versions: [100, 80].map((amount, index) => ({ id: `v${index}`, name: `Forecast ${index}`, year: 2027, closed: 0,
        lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(amount), a: Array(12).fill(null), f: Array(12).fill(amount) }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
        officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const admissionDigest = digestSfValue({})
    const admitted = ok(await authority.ui.admit(request(), "sf_scenario_simulate", admissionDigest))
    deadline.own(() => authority.ui.finish(admitted))
    expect(await authority.ui.validate(admitted, "sf_scenario_simulate", admissionDigest)).toBe(true)
    const baseline = ok(await business.plannerProduct.issueSource("v0", admitted)).evidence
    const candidate = ok(await business.plannerProduct.issueSource("v1", admitted)).evidence
    const ref = { id: "finance-case", incarnation: "case-inc", version: 1 }
    const basis = { id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: ["training"],
      additionalCategoryIds: [], sourceRefs: [baseline, candidate] }
    business.bindForecastCoverage(async (reference, call) => {
      const source = await business.plannerSources.resolveForecastSource(reference, call)
      if (source.status !== "ok") return source
      return { status: "ok", value: { coverageRef: "fixture:pending-coverage", basis, assessment: {
        basisId: basis.id, basisVersion: basis.version, alternativeId: source.value.versionId === "v0" ? "baseline" : "candidate",
        alternativeVersion: 1, currency: "USD", horizon: period, issues: ["training-pending"], evaluatedSourceRefs: [source.value.evidence],
        coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "No training evidence" }],
        derivedMissingCategoryIds: ["training"],
      } } }
    })
    const decision: DecisionCase = { ...ref, state: "comparing", objective: "Compare forecasts", horizon: period, currency: "USD",
      criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], participants: ["person"], sourceRefs: basis.sourceRefs, alternatives: [], costCoverageBases: [basis],
      assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "seed-case", commandDigest: digestSfValue(decision) }, async (state) => {
      state.cases[ref.id] = decision
      return { commit: true, value: true }
    })
    expect(seed.status).toBe("ok")
    const results: { reference: string; alternative: DecisionCase["alternatives"][number] }[] = []
    for (const [id, source] of [["baseline", baseline], ["candidate", candidate]] as const) {
      const scenario = { baseRef: source.refId, operations: [], assumptions: [] }
      const result = ok(await business.withCase(admitted, ref, {}, () => business.planner.simulateScenario(scenario, admitted)))
      const saved = ok(await business.withCase(admitted, ref, {}, () => business.results.write({ kind: "scenario", result, caseRef: ref,
        requestDigest: digestSfValue(scenario), sourceRefs: result.sourceRefs, idempotencyKey: id }, admitted)))
      results.push({ reference: saved.resultRef, alternative: { id, version: 1, title: id, scenario, result } })
    }
    const current = await authority.state.read(request(), "cases", () => true)
    if (current.status !== "ok") throw new Error("Case version unavailable")
    const bound = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: ref.id, targetIncarnation: ref.incarnation, idempotencyKey: "bind-alternatives", commandDigest: digestSfValue(results) }, async (state) => {
      state.cases[ref.id] = { ...decision, alternatives: results.map((result) => result.alternative) }
      return { commit: true, value: true }
    })
    expect(bound.status).toBe("ok")
    const scenarios = business.plannerProduct.scenarios
    if (!scenarios) throw new Error("Canonical scenario reader unavailable")
    const pair = { scenarioRefs: [results[1]!.reference, results[0]!.reference], criteria: [] }
    const observe = business.withPlannerObservation
    const measure = async (grouped: boolean, afterRoot?: () => Promise<void>) => {
      const counts: Counts = { physical: 0, roots: 0, work: 0 }
      const call = ok(await authority.ui.admit(request(), "sf_scenario_simulate", admissionDigest))
      try {
        expect(await authority.ui.validate(call, "sf_scenario_simulate", admissionDigest)).toBe(true)
        const result = await business.withCase(call, ref, {}, async () => {
          control.counts = counts
          control.afterRoot = afterRoot
          try {
            const work = async () => {
              counts.work++
              return { status: "ok" as const, value: await resolvePlannerScenarioBatch(scenarios, pair.scenarioRefs, call) }
            }
            return grouped ? await observe(pair, call, work) : await work()
          } finally { control.counts = undefined; control.afterRoot = undefined }
        })
        return { result, counts }
      } finally { authority.ui.finish(call) }
    }
    const scalar = await measure(false)
    const value = ok(scalar.result)
    expect(value.map((entry) => ok(entry).result)).toEqual([results[1]!.alternative.result, results[0]!.alternative.result])
    const grouped = await measure(true)
    expect(ok(grouped.result).map((entry) => ok(entry).result)).toEqual(value.map((entry) => ok(entry).result))
    expect(grouped.counts.work).toBe(1)
    expect(grouped.counts.roots).toBe(2)
    expect(grouped.counts.physical).toBeLessThan(scalar.counts.physical)
    const typedFailure = { status: "stale", reason: "fixture-canonical-stale" } as const
    expect(await business.withCase(admitted, ref, {}, () => observe(pair, admitted, async () => typedFailure))).toEqual(typedFailure)
    const coverageRequest: SensitivityRequest = { scenarioRef: pair.scenarioRefs[0]!,
      parameterBounds: { parameterRef: "line:1", minimum: 0, maximum: 400, steps: 2 },
      criterion: { id: "cost", operator: "lte", value: 0 } }
    const actor = { principalRef: admitted.binding.principalRef, accessRevision: admitted.binding.accessRevision, policyVersion: admitted.binding.policyVersion }
    const coverage = createSfPortfolioCoverageAuthority({ authority, business, registries: {
      selection: { read: async () => ({ status: "ok", value: {
        ...actor, schema: "sf-portfolio-selection-v1", selectionRef: "fixture-selection", caseRef: ref,
        baselineAlternativeId: "baseline", alternativeId: "candidate", baselineRef: pair.scenarioRefs[1]!,
        alternativeRef: pair.scenarioRefs[0]!, criteria: ["cost"], comparisonDigest: digestSfValue(pair),
        version: 1, createdAt: at, selectionDigest: digestSfValue(ref),
      } }) },
      rules: { resolve: async () => ({ status: "ok", value: {
        ...actor, schema: "sf-criterion-rule-v1", ruleRef: "fixture-rule", caseRef: ref,
        criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte", value: 0,
        unit: "USD", period, evidenceRefs: basis.sourceRefs, version: 1, criterionDigest: digestSfValue(ref),
        installationId: admitted.binding.installationId, projectId: admitted.binding.projectId,
        createdAt: at, recordDigest: digestSfValue(pair),
      } }) },
    } })
    const scalarReads: string[] = []
    const readHistorical = business.results.readHistoricalScenario
    business.results.readHistoricalScenario = async (request, call) => {
      scalarReads.push(request.resultRef)
      return readHistorical(request, call)
    }
    let pairCalls = 0
    business.withPlannerObservation = async (incoming, call, work) => {
      pairCalls++
      expect(incoming).toEqual(pair)
      expect(call).toBe(admitted)
      expect(scalarReads).toEqual(pair.scenarioRefs)
      const resolved = ok(await observe(incoming, call, work))
      expect(Array.isArray(resolved)).toBe(true)
      expect(resolved).toMatchObject(value.map((entry) => ({ status: "ok", value: { result: ok(entry).result } })))
      return typedFailure
    }
    try {
      const runCoverage = (baselineRef: string) => business.withCase(admitted, ref, {}, () => coverage(coverageRequest, baselineRef, admitted))
      expect(await runCoverage(coverageRequest.scenarioRef)).toEqual({ status: "unavailable", reason: "portfolio-coverage-selection-mismatch" })
      expect(scalarReads).toEqual([])
      expect(pairCalls).toBe(0)
      expect(await runCoverage(pair.scenarioRefs[1]!)).toEqual(typedFailure)
      expect(pairCalls).toBe(1)
    } finally {
      business.results.readHistoricalScenario = readHistorical
      business.withPlannerObservation = observe
    }
    // Exercise the real criterion consumer with the same published scenarios.
    // Mode "scalar" disables only the physical root. Capability "absent" exercises
    // the actual scalar resolver fallback. Both delegate to original producers;
    // no successful result or source is stubbed. Metric/comparison counts.work
    // counts scenario references; scenarioReads distinguishes scalar and batch calls.
    const portfolio = createSfPortfolioAuthority({ authority, business, proposalCoverageWrites, proof: () => undefined })
    const metricRequest = { caseRef: ref, criterionId: "cost", ruleRef: "fixture-rule", ruleVersion: 1,
      metricRef: "planner:known-subtotal-difference", baselineRef: results[0]!.reference, scenarioRef: results[1]!.reference }
    const metricPair = { scenarioRefs: [metricRequest.baselineRef, metricRequest.scenarioRef], criteria: [] }
    const measureMetric = async (mode: "scalar" | "grouped" | "unsupported", afterRoot?: () => Promise<void>,
      batch: "original" | "absent" | "short" = "original", afterBatch?: () => void) => {
      const counts: Counts = { physical: 0, roots: 0, work: 0 }
      const reads = { scalar: 0, batch: 0, references: 0 }
      const phases: string[][] = []
      const call = ok(await authority.ui.admit(request(), "sf_scenario_simulate", admissionDigest))
      const resolve = scenarios.resolve, resolveMany = scenarios.resolveMany, readRoot = persistence.readSnapshotRoot
      const plannerProduct = business.plannerProduct
      let observations = 0
      const started = performance.now()
      scenarios.resolve = async (reference, binding) => {
        reads.scalar++
        reads.references++
        counts.work++
        return resolve.call(scenarios, reference, binding)
      }
      scenarios.resolveMany = batch !== "absent" && resolveMany ? async (references, binding) => {
        reads.batch++
        reads.references += references.length
        counts.work += references.length
        phases.push([...references])
        const value = await resolveMany.call(scenarios, references, binding)
        afterBatch?.()
        // Negative specimen derives from original results; it issues no source.
        return batch === "short" ? value.slice(0, -1) : value
      } : undefined
      business.withPlannerObservation = (incoming, binding, work) => {
        observations++
        expect(incoming).toEqual(metricPair)
        expect(binding).toBe(call)
        return mode === "scalar" ? work() : observe(incoming, binding, work)
      }
      if (mode === "unsupported") persistence.readSnapshotRoot = undefined
      try {
        expect(await authority.ui.validate(call, "sf_scenario_simulate", admissionDigest)).toBe(true)
        const result = await business.withCase(call, ref, {}, async () => {
          control.counts = counts
          control.afterRoot = afterRoot
          try { return await portfolio.readMetric(metricRequest, call) }
          finally { control.counts = undefined; control.afterRoot = undefined }
        })
        const elapsedMs = Math.round(performance.now() - started)
        console.info("SF_METRIC_OBSERVATION", JSON.stringify({ mode, batch, status: result.status, elapsedMs,
          observations, scenarioReads: reads, phases, ...counts }))
        return { result, counts, observations, reads, phases }
      } finally {
        scenarios.resolve = resolve
        scenarios.resolveMany = resolveMany
        business.plannerProduct = plannerProduct
        business.withPlannerObservation = observe
        persistence.readSnapshotRoot = readRoot
        authority.ui.finish(call)
      }
    }
    const metricScalar = await measureMetric("scalar")
    const metricGrouped = await measureMetric("grouped")
    const metricValue = ok(metricScalar.result)
    expect(metricValue).toMatchObject({ ...metricRequest, state: "conditioned", unit: "USD", period,
      value: results[1]!.alternative.result.knownSubtotal! - results[0]!.alternative.result.knownSubtotal! })
    expect(ok(metricGrouped.result)).toEqual(metricValue)
    expect(metricScalar.reads).toEqual({ scalar: 0, batch: 2, references: 4 })
    expect(metricGrouped.reads).toEqual(metricScalar.reads)
    expect(metricScalar.phases).toEqual([metricPair.scenarioRefs, metricPair.scenarioRefs])
    expect(metricGrouped.phases).toEqual(metricScalar.phases)
    expect(metricScalar.observations).toBe(1)
    expect(metricGrouped.observations).toBe(1)
    expect(metricScalar.counts.roots).toBe(0)
    expect(metricGrouped.counts.roots).toBe(2)
    expect(metricGrouped.counts.work).toBeGreaterThan(0)
    expect(metricGrouped.counts.work).toBe(metricScalar.counts.work)
    expect(metricGrouped.counts.physical).toBeLessThan(metricScalar.counts.physical)
    const metricRepeated = await measureMetric("grouped")
    expect(ok(metricRepeated.result)).toEqual(metricValue)
    expect(metricRepeated.counts).toEqual(metricGrouped.counts)
    expect(metricRepeated.reads).toEqual(metricGrouped.reads)
    const metricUnsupported = await measureMetric("unsupported")
    expect(ok(metricUnsupported.result)).toEqual(metricValue)
    expect(metricUnsupported.observations).toBe(1)
    expect(metricUnsupported.counts.roots).toBe(0)
    expect(metricUnsupported.counts.work).toBe(metricScalar.counts.work)
    expect(metricUnsupported.counts.physical).toBe(metricScalar.counts.physical)
    expect(metricUnsupported.reads).toEqual(metricScalar.reads)
    const metricWithoutBatch = await measureMetric("scalar", undefined, "absent")
    expect(ok(metricWithoutBatch.result)).toEqual(metricValue)
    expect(metricWithoutBatch.reads).toEqual({ scalar: 4, batch: 0, references: 4 })
    expect(metricWithoutBatch.phases).toEqual([])
    expect(metricScalar.counts.physical).toBeLessThan(metricWithoutBatch.counts.physical)
    const nativeBatch = scenarios.resolveMany
    if (!nativeBatch) throw new Error("Original sibling resolver unavailable")
    let replacementCalls = 0
    const replacement = async (...args: Parameters<NonNullable<typeof nativeBatch>>) => {
      replacementCalls++
      return nativeBatch.call(scenarios, ...args)
    }
    const replacedBatch = await measureMetric("scalar", undefined, "original", () => {
      scenarios.resolveMany = replacement
    })
    expect(replacedBatch.result.status).not.toBe("ok")
    expect(replacedBatch.reads).toEqual({ scalar: 0, batch: 1, references: 2 })
    expect(replacementCalls).toBe(0)
    const replacedOwner = await measureMetric("scalar", undefined, "original", () => {
      business.plannerProduct = { ...business.plannerProduct, scenarios: { ...scenarios, resolveMany: replacement } }
    })
    expect(replacedOwner.result.status).not.toBe("ok")
    expect(replacedOwner.reads).toEqual({ scalar: 0, batch: 1, references: 2 })
    expect(replacementCalls).toBe(0)
    const shortBatch = await measureMetric("scalar", undefined, "short")
    expect(shortBatch.result).toEqual({ status: "unavailable", reason: "scenario-batch-invalid" })
    expect(shortBatch.reads).toEqual({ scalar: 0, batch: 1, references: 2 })
    // The public comparison keeps the real required criterion. Only the
    // persistence adapter changes for the scalar control; all outputs come
    // from the original rules, scenario lookup, comparator and stored results.
    const comparisonRequest = { caseRef: ref, baselineAlternativeId: "baseline",
      alternativeId: "candidate", criteria: ["cost"] }
    const comparisonPair = { scenarioRefs: [results[0]!.reference, results[1]!.reference], criteria: ["cost"] }
    const makeObservation = business.createPlannerCriteriaObservation
    const measureComparison = async (route: "alternatives" | "scenarios", grouped: boolean,
      afterRoot?: (current: ReturnType<typeof createSfPortfolioAuthority>) => Promise<void>, afterRootAt = 1) => {
      const counts: Counts = { physical: 0, roots: 0, work: 0 }
      const reads = { scalar: 0, batch: 0, references: 0 }
      const call = ok(await authority.ui.admit(request(), "sf_scenario_simulate", admissionDigest))
      const resolve = scenarios.resolve, resolveMany = scenarios.resolveMany, readRoot = persistence.readSnapshotRoot
      const lookup = business.scenarioLookup, businessHost = business.host, ownerHost = authority.host
      let ruleReads = 0
      scenarios.resolve = async (reference, binding) => {
        reads.scalar++
        reads.references++
        counts.work++
        return resolve.call(scenarios, reference, binding)
      }
      scenarios.resolveMany = resolveMany ? async (references, binding) => {
        reads.batch++
        reads.references += references.length
        counts.work += references.length
        return resolveMany.call(scenarios, references, binding)
      } : undefined
      business.createPlannerCriteriaObservation = (criteria) => makeObservation({
        ...criteria,
        resolve: async (...args) => { ruleReads++; return criteria.resolve(...args) },
      })
      if (!grouped) persistence.readSnapshotRoot = undefined
      const current = createSfPortfolioAuthority({ authority, business, proposalCoverageWrites, proof: () => undefined })
      const started = performance.now()
      try {
        expect(await authority.ui.validate(call, "sf_scenario_simulate", admissionDigest)).toBe(true)
        const result = await business.withCase(call, ref, {}, async () => {
          control.counts = counts
          const after = async () => {
            if (counts.roots === afterRootAt) await afterRoot?.(current)
            else control.afterRoot = after
          }
          control.afterRoot = afterRoot ? after : undefined
          try {
            if (route === "alternatives") {
              const value = await current.compare(comparisonRequest, call)
              if (value.status !== "ok") return value
              expect(value.value.request).toEqual(comparisonPair)
              return { status: "ok" as const, value: value.value.comparison }
            }
            return await current.planner.compareScenarios(comparisonPair, call)
          } finally { control.counts = undefined; control.afterRoot = undefined }
        })
        console.info("SF_CRITERION_COMPARISON_OBSERVATION", JSON.stringify({ route, grouped,
          status: result.status, elapsedMs: Math.round(performance.now() - started), ruleReads, scenarioReads: reads, ...counts }))
        return { result, counts, ruleReads, reads }
      } finally {
        scenarios.resolve = resolve
        scenarios.resolveMany = resolveMany
        business.createPlannerCriteriaObservation = makeObservation
        business.scenarioLookup = lookup
        business.host = businessHost
        authority.host = ownerHost
        persistence.readSnapshotRoot = readRoot
        authority.ui.finish(call)
      }
    }
    const missingScalar = await measureComparison("scenarios", false)
    const missingGrouped = await measureComparison("scenarios", true)
    expect(ok(missingGrouped.result)).toEqual(ok(missingScalar.result))
    expect(ok(missingGrouped.result).criterionResults).toEqual([{ criterionId: "cost", state: "unknown",
      reason: "criterion-rule-unavailable" }])
    expect(missingGrouped.counts.work).toBe(missingScalar.counts.work)
    expect(missingGrouped.reads).toEqual({ scalar: 0, batch: 3, references: 6 })
    expect(missingGrouped.reads).toEqual(missingScalar.reads)
    expect(missingGrouped.counts.roots).toBe(0)

    const ruleInput = { caseRef: ref, criterionId: "cost", metricRef: "planner:known-subtotal-difference",
      operator: "lte" as const, value: 0, unit: "USD", period, evidenceRefs: basis.sourceRefs, expectedRuleVersion: 0 }
    const registerRule = async (expectedRuleVersion: number, value: number) => {
      const payload = { ...ruleInput, expectedRuleVersion, value }
      const operation = "sf-human:decisions.criteria", digest = digestSfValue(payload)
      const call = ok(await authority.ui.admit(request(), operation, digest))
      try {
        expect(await authority.ui.validate(call, operation, digest)).toBe(true)
        const saved = ok(await business.withCase(call, ref, {}, () => portfolio.rules.register(payload, call)))
        const resolved = ok(await business.withCase(call, ref, {}, () => portfolio.rules.resolve({
          caseRef: ref, criterionId: "cost" }, call)))
        expect(resolved).toMatchObject({ ...saved, caseRef: ref, criterionId: "cost", value,
          evidenceRefs: basis.sourceRefs, version: expectedRuleVersion + 1 })
        return saved
      } finally { authority.ui.finish(call) }
    }
    await registerRule(0, 0)
    const originalComparison = await measureComparison("alternatives", false)
    const groupedComparison = await measureComparison("alternatives", true)
    const comparison = ok(originalComparison.result)
    expect(comparison).toMatchObject({ baselineResultRef: results[0]!.reference,
      alternativeResultRef: results[1]!.reference,
      knownDifference: results[1]!.alternative.result.knownSubtotal! - results[0]!.alternative.result.knownSubtotal! })
    expect(ok(groupedComparison.result)).toEqual(comparison)
    expect(groupedComparison.counts.roots).toBe(2)
    expect(groupedComparison.counts.work).toBe(originalComparison.counts.work)
    expect(groupedComparison.reads).toEqual({ scalar: 0, batch: 7, references: 14 })
    expect(groupedComparison.reads).toEqual(originalComparison.reads)
    expect(groupedComparison.counts.physical).toBeLessThan(originalComparison.counts.physical)
    expect(groupedComparison.ruleReads).toBeGreaterThan(1)
    const directComparison = await measureComparison("scenarios", true)
    expect(ok(directComparison.result)).toEqual(comparison)
    expect(directComparison.counts.roots).toBe(2)
    expect(directComparison.reads).toEqual(groupedComparison.reads)
    const repeatedComparison = await measureComparison("scenarios", true)
    expect(ok(repeatedComparison.result)).toEqual(comparison)
    expect(repeatedComparison.counts).toEqual(directComparison.counts)
    expect(repeatedComparison.reads).toEqual(directComparison.reads)
    expect(repeatedComparison.ruleReads).toBe(directComparison.ruleReads)
    const revokedComparison = await measureComparison("scenarios", true, async () => { control.active = false })
    expect(revokedComparison.result.status).not.toBe("ok")
    expect(revokedComparison.counts.work).toBe(directComparison.counts.work)
    expect(revokedComparison.counts.afterClose).toEqual({ root: 1, work: directComparison.counts.work, outside: true })
    control.active = true
    const replacedRuleReader = await measureComparison("scenarios", true, async (current) => {
      const resolve = current.rules.resolve
      current.rules.resolve = (...args) => resolve(...args)
    })
    expect(replacedRuleReader.result.status).not.toBe("ok")
    expect(replacedRuleReader.counts.work).toBe(directComparison.counts.work)
    expect(replacedRuleReader.counts.afterClose).toEqual({ root: 1, work: directComparison.counts.work, outside: true })
    const changedLookupAtEgress = await measureComparison("alternatives", true, async () => {
      const lookup = business.scenarioLookup
      business.scenarioLookup = (...args) => lookup(...args)
    }, 2)
    expect(changedLookupAtEgress.result.status).not.toBe("ok")
    expect(changedLookupAtEgress.counts.work).toBe(groupedComparison.counts.work)
    expect(changedLookupAtEgress.counts.afterClose).toEqual({ root: 2, work: groupedComparison.counts.work, outside: true })
    const changedOwnerAtEgress = await measureComparison("scenarios", true, async () => {
      business.host = { ...business.host }
    }, 2)
    expect(changedOwnerAtEgress.result.status).not.toBe("ok")
    expect(changedOwnerAtEgress.counts.work).toBe(directComparison.counts.work)
    expect(changedOwnerAtEgress.counts.afterClose).toEqual({ root: 2, work: directComparison.counts.work, outside: true })
    const changedRule = await measureComparison("scenarios", true, async () => { await registerRule(1, 1) })
    expect(changedRule.result.status).not.toBe("ok")
    expect(changedRule.counts.work).toBe(directComparison.counts.work)
    expect(changedRule.counts.afterClose).toEqual({ root: 1, work: directComparison.counts.work, outside: true })
    const revoked = await measureMetric("grouped", async () => { control.active = false })
    expect(revoked.result.status).not.toBe("ok")
    expect(revoked.counts.work).toBe(metricGrouped.counts.work)
    expect(revoked.counts.afterClose).toEqual({ root: 1, work: metricGrouped.counts.work, outside: true })
    control.active = true
    const changed = await measureMetric("grouped", async () => {
      await persistence.transaction("planner", async (snapshot) => {
        baselineAmounts(snapshot.data)[0] = 999
        return { commit: true, value: undefined }
      })
    })
    expect(changed.result.status).not.toBe("ok")
    expect(changed.counts.work).toBe(metricGrouped.counts.work)
    expect(changed.counts.afterClose).toEqual({ root: 1, work: metricGrouped.counts.work, outside: true })
    expect(await persistence.transaction("planner", async (snapshot) => ({
      commit: false, value: baselineAmounts(snapshot.data)[0],
    }))).toBe(999)
  } finally { await deadline.close() }
}, 120_000)

function ok<Value>(result: PortResult<Value>) {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

function baselineAmounts(data: Record<string, unknown>): unknown[] {
  const line = rows(rows(data.versions).find((version) => version.id === "v0")?.lines)[0]
  if (!line || !Array.isArray(line.f)) throw new Error("Fixture forecast line unavailable")
  return line.f
}
