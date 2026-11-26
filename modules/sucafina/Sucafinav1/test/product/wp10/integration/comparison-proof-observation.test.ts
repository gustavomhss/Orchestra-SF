import { AsyncLocalStorage } from "node:async_hooks"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, test } from "bun:test"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPortfolioServices } from "../../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { ScenarioCompareRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createCriterionComparisonBindings } from "../../../../product/decisions/criterion-comparison.ts"
import type { CriterionComparisonBinding } from "../../../../product/decisions/criterion-comparison.ts"
import type { StoredDecisionResult } from "../../../../product/decisions/result-store.ts"
import { createPortfolioProofVerifier } from "../../../../product/portfolio/verification.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence, currentSfReadonlySnapshotScope } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { comparePlannerPreview } from "../../../../product/planner/preview-comparison.ts"
import type { AssetPersistence } from "../../../../runtime/assets.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type VerifierInput = Parameters<typeof createPortfolioProofVerifier>[0]
type Counts = {
  physical: number; roots: number; transactionAll: number; fenceTransactionAll: number
  admissions: number; observationWork: number; comparisons: number
  fenceReads: number; fenceAuthorizations: number; captureAuthorizations: number
  sealedFences: number; sealIdentities: object[]
}
type Hooks = {
  afterAuthorization?: (index: number, allowed: boolean, verifier: ReturnType<typeof createPortfolioProofVerifier>, call: TrustedDomainContext) => Promise<void>
  signal?: AbortSignal
  compare?: VerifierInput["planner"]["compareScenarios"]
  observe?: NonNullable<VerifierInput["observeComparison"]>
}
const emptyCounts = (): Counts => ({
  physical: 0, roots: 0, transactionAll: 0, fenceTransactionAll: 0,
  admissions: 0, observationWork: 0, comparisons: 0, fenceReads: 0,
  fenceAuthorizations: 0, captureAuthorizations: 0, sealedFences: 0, sealIdentities: [],
})
function ok<Value>(result: PortResult<Value>) {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}
function deferred<Value>() {
  let resolve!: (value: Value) => void
  const promise = new Promise<Value>((done) => { resolve = done })
  return { promise, resolve }
}

/** The native fixture follows finance-pair-observation's canonical producers.
 * Only the initial case/forecast and coverage fixture are supplied; comparisons,
 * rules, source checks, C08, Finance and LocalStore all execute their real code. */
async function fixture(deadline: ReturnType<typeof compositionTestDeadline>, principalRef = "person",
  mode: "native" | "instrumented" = "native") {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-comparison-proof-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const physical = new AsyncLocalStorage<boolean>()
  const fenceRead = new AsyncLocalStorage<boolean>()
  const control: {
  active: boolean; counts?: Counts; afterRoot?: (index: number) => Promise<void>
  rootsInAttempt: number
  } = { active: true, rootsInAttempt: 0 }
  const assets: AssetPersistence = store
  const transaction = assets.transaction, all = store.transactionAll, root = store.readSnapshotRoot
  const currentSnapshots = store.currentSnapshots
  const nativeMethods = ["currentSnapshots", "currentSnapshot", "hasCurrentSnapshots", "transaction", "transactionAll", "readSnapshotRoot", "currentSnapshotScope"] as const
  const nativePins = nativeMethods.map((name) => Object.getOwnPropertyDescriptor(store, name)?.value)
  const nativeMethodsCurrent = () => nativeMethods.every((name, index) =>
    Object.getOwnPropertyDescriptor(store, name)?.value === nativePins[index])
  if (!all || !root || !currentSnapshots) throw new Error("Native comparison roots unavailable")
  const observeTransaction: AssetPersistence["transaction"] = (surface, work, options) => {
  if (control.counts && !physical.getStore()) control.counts.physical++
  return transaction(surface, (...args) => physical.run(true, () => work(...args)), options)
  }
  const observeAll: NonNullable<typeof store.transactionAll> = (work, options) => {
  if (control.counts) {
    control.counts.transactionAll++
    if (fenceRead.getStore()) control.counts.fenceTransactionAll++
    if (!physical.getStore()) control.counts.physical++
  }
  return all((...args) => physical.run(true, () => work(...args)), options)
  }
  type RootOptions = Parameters<NonNullable<typeof store.readSnapshotRoot>>[1]
  const observeRoot = async <Value>(owner: object,
    original: (work: () => Promise<Value>, options?: RootOptions) => Promise<Value>,
    work: () => Promise<Value>, options?: RootOptions): Promise<Value> => {
  if (control.counts) {
    control.counts.roots++
    if (mode === "instrumented" && !physical.getStore()) control.counts.physical++
  }
  const value = await original.call(owner, () => physical.run(true, work), options)
  await control.afterRoot?.(++control.rootsInAttempt)
  return value
  }
  // Native identity is part of the sealed capability. Physical instrumentation
  // deliberately uses a different fixture and does not claim that capability.
  if (mode === "instrumented") {
    store.transaction = observeTransaction
    store.transactionAll = observeAll
    store.readSnapshotRoot = <Value>(work: () => Promise<Value>, options?: RootOptions) =>
      observeRoot<Value>(store, root, work, options)
  }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
  projectScope: createSfSourceScopeProjector(() => at) }) }
  // Registered source forwarders permit this facade-only bracket. The seven
  // methods pinned privately by LocalStore remain untouched in native mode.
  if (mode === "native") {
    const sourceRoot = persistence.readSnapshotRoot
    if (!sourceRoot) throw new Error("Original source root forwarder unavailable")
    persistence.readSnapshotRoot = <Value>(work: () => Promise<Value>, options?: RootOptions) =>
      observeRoot<Value>(persistence, sourceRoot, work, options)
  }
  const request = (signal = deadline.signal) => new Request("https://example.test/planner", { method: "POST", signal, headers: { origin: "https://example.test" } })
  const identity = { installationId: "finance-installation", hostId: "host", projectId: "project",
  location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const proposalCoverageWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
  policyVersion: "finance-policy", persistence, proposalCoverageWrites, grants: [{ principalRef, namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
    operations: ["sf_scenario_simulate", "sf_scenario_compare", "sf_evidence_get"], humanActions: ["decisions.criteria"] }],
  authenticate: async (_request, scope) => {
    if (control.counts && fenceRead.getStore()) control.counts.fenceAuthorizations++
    return control.active && scope ? { id: principalRef, canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null
  },
  environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
  commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
  verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  deadline.own(() => business.dispose())
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
    criteria: [{ id: "cost", description: "Known subtotal difference", required: true }], participants: [principalRef], sourceRefs: basis.sourceRefs, alternatives: [], costCoverageBases: [basis],
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

  const makeObservation = business.createPlannerCriteriaObservation
  business.createPlannerCriteriaObservation = (criteria) => {
    const original = makeObservation(criteria)
    return async <Value>(incoming: ScenarioCompareRequest, call: TrustedDomainContext,
      work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
      if (control.counts) control.counts.admissions++
      return original(incoming, call, async () => {
        if (control.counts) control.counts.observationWork++
        return work()
      })
    }
  }
  const portfolio = createSfPortfolioServices({ authority, business, proposalCoverageWrites })
  deadline.own(() => portfolio.dispose())
  const units = portfolio.units
  if (!units) throw new Error("Canonical Planner units unavailable")
  const ruleInput = { caseRef: ref, criterionId: "cost", metricRef: "planner:known-subtotal-difference",
    operator: "lte" as const, value: 0, unit: "USD", period, evidenceRefs: basis.sourceRefs, expectedRuleVersion: 0 }
  const ruleOperation = "sf-human:decisions.criteria", ruleDigest = digestSfValue(ruleInput)
  const ruleCall = ok(await authority.ui.admit(request(), ruleOperation, ruleDigest))
  try {
    expect(await authority.ui.validate(ruleCall, ruleOperation, ruleDigest)).toBe(true)
    ok(await business.withCase(ruleCall, ref, {}, () => portfolio.rules.register(ruleInput, ruleCall)))
  } finally { authority.ui.finish(ruleCall) }
  const pair = { scenarioRefs: [results[0]!.reference, results[1]!.reference], criteria: ["cost"] }
  const comparison = ok(await business.withCase(admitted, ref, {}, () => portfolio.planner.compareScenarios(pair, admitted)))
  const stored = ok(await business.withCase(admitted, ref, {}, () => business.results.write({
    kind: "comparison", result: comparison, caseRef: ref, requestDigest: digestSfValue(pair),
    sourceRefs: basis.sourceRefs, idempotencyKey: "comparison-proof-control",
  }, admitted)))
  if (stored.kind !== "comparison") throw new Error("Original comparison result unavailable")
  const proofs = ok(await business.withCase(admitted, ref, {}, () => portfolio.comparisonBindings.proofs(ref, pair.criteria, admitted)))
  const binding = ok(await business.withCase(admitted, ref, {}, () => portfolio.comparisonBindings.bind({
    caseRef: ref, resultRef: stored.resultRef, request: pair, expectedRules: proofs,
  }, admitted)))
  const makeVerifier = (observed: boolean, hooks: Hooks = {}) => {
    let verifier!: ReturnType<typeof createPortfolioProofVerifier>
    let authorizations = 0
    const input: VerifierInput = {
      cases: business.cases, sources: business.plannerSources, evidence: business.context, results: business.results,
      planner: { ...portfolio.planner, compareScenarios: async (incoming, call) => {
        if (control.counts) control.counts.comparisons++
        return hooks.compare ? hooks.compare(incoming, call) : portfolio.planner.compareScenarios(incoming, call)
      } },
      revalidate: async (call) => {
        const allowed = await authority.host.revalidate(call)
        const index = ++authorizations
        if (control.counts) control.counts.captureAuthorizations++
        await hooks.afterAuthorization?.(index, allowed, verifier, call)
        return allowed
      },
      readSourceFences: (call) => fenceRead.run(true, async () => {
        if (control.counts) control.counts.fenceReads++
        const value = await business.readSourceFences(call)
        const seal = currentSfReadonlySnapshotScope(persistence)
        if (control.counts && seal) {
          control.counts.sealedFences++
          control.counts.sealIdentities.push(seal.bytesIdentity ?? seal.identity)
        }
        return value
      }),
      lockedSourceFences: business.lockedSourceFences, caseFor: business.resolveCase,
      idempotencyKey: async (digest, call) => {
        const identity = business.operationIdentity(call)
        return identity && await authority.host.revalidate(call) ? "comparison-proof:" + digestSfValue({ identity, digest }) : undefined
      },
      decisions: portfolio.mutations,
      createReceipt: async (call, operation, digest, result) => business.receipt(call, operation, digest, result),
      candidateCoverageRefFor: async () => ({ status: "unavailable", reason: "unused-comparison-control" }),
      revalidateAnalysis: async () => false,
      units, sensitivityPreview: (incoming, call) => comparePlannerPreview({
        host: authority.host, sources: business.plannerSources, scenarios, planner: portfolio.planner,
      }, incoming, call),
      ...(observed ? { observeComparison: hooks.observe ?? portfolio.observeComparisonProof } : {}),
    }
    verifier = createPortfolioProofVerifier(input)
    return { input, verifier }
  }
  const hasGrant = async (verifier: ReturnType<typeof createPortfolioProofVerifier>, call: TrustedDomainContext) => {
    const counts = control.counts
    control.counts = undefined
    try {
      return await persistence.transaction("planner", async (snapshot) => ({
        commit: false, value: verifier.verifySnapshot(snapshot, binding, call),
      }))
    } finally { control.counts = counts }
  }
  const run = async (observed: boolean, hooks: Hooks = {}, afterRoot?: (index: number,
    verifier: ReturnType<typeof createPortfolioProofVerifier>, call: TrustedDomainContext) => Promise<void>) => {
    const transport = request(hooks.signal)
    const operation = "sf_scenario_compare", digest = digestSfValue(pair)
    const call = ok(await authority.ui.admit(transport, operation, digest))
    const counts = emptyCounts(), { verifier } = makeVerifier(observed, hooks)
    try {
      expect(await authority.ui.validate(call, operation, digest)).toBe(true)
      const accepted = await business.withCase(call, ref, {}, async () => {
        control.counts = counts
        control.rootsInAttempt = 0
        control.afterRoot = afterRoot ? (index) => afterRoot(index, verifier, call) : undefined
        try { return { status: "ok" as const, value: await verifier.verifyComparison(binding, stored, call) } }
        finally { control.counts = undefined; control.afterRoot = undefined }
      })
      return { value: ok(accepted), counts, grant: await hasGrant(verifier, call) }
    } finally { authority.ui.finish(call) }
  }
  const withCall = async <Value>(work: (call: TrustedDomainContext) => Promise<Value>) => {
    const operation = "sf_scenario_compare", digest = digestSfValue(pair)
    const call = ok(await authority.ui.admit(request(), operation, digest))
    try {
      expect(await authority.ui.validate(call, operation, digest)).toBe(true)
      return await work(call)
    } finally { authority.ui.finish(call) }
  }
  const verify = (verifier: ReturnType<typeof createPortfolioProofVerifier>, call: TrustedDomainContext,
    incomingBinding = binding, incomingStored: StoredDecisionResult = stored) =>
    business.withCase(call, ref, {}, async () => ({
      status: "ok" as const, value: await verifier.verifyComparison(incomingBinding, incomingStored, call),
    })).then(ok)
  const consumer = (verifier: ReturnType<typeof createPortfolioProofVerifier>) => createCriterionComparisonBindings({
    state: authority.state, host: authority.host, rules: portfolio.rules, results: business.results,
    authorizeCase: portfolio.authorizeCase,
    verifyBinding: (bound, result, call) => verifier.verifyComparison(bound, result, call),
    verifySnapshot: verifier.verifySnapshot, operationIdentity: business.operationIdentity,
    proposalCoverageWrites, now: () => at,
  })
  return { authority, business, portfolio, persistence, store, control, physical, request, ref, pair,
    binding, stored, makeVerifier, hasGrant, run, withCall, verify, consumer, currentSnapshots, at, admitted, principalRef,
    mode, nativeMethodsCurrent }
}


test("Comparison proof owns Finance reads and publishes only after accepted roots and the latest attempt", async () => {
  const deadline = compositionTestDeadline("comparison-proof-observation", 110_000)
  try {
    const native = await deadline.phase("native-fixture", () => fixture(deadline))
    expect(native.nativeMethodsCurrent()).toBe(true)
    const outside = await deadline.phase("unscoped-verification", () => native.run(false))
    const captureVisibility: boolean[] = [], rootVisibility: boolean[] = []
    const owned = await deadline.phase("owned-verification", () => native.run(true, {
      afterAuthorization: async (_index, allowed, verifier, call) => {
        expect(allowed).toBe(true)
        captureVisibility.push(await native.hasGrant(verifier, call))
      },
    }, async (index, verifier, call) => {
      expect(index === 1 || index === 2).toBe(true)
      expect(native.currentSnapshots()).toBeUndefined()
      expect(native.physical.getStore()).toBeUndefined()
      rootVisibility.push(await native.hasGrant(verifier, call))
    }))
    expect(outside.value).toBe(true)
    expect(owned.value).toBe(true)
    expect(outside.grant).toBe(true)
    expect(owned.grant).toBe(true)
    expect(captureVisibility).toEqual([false, false])
    expect(rootVisibility).toEqual([false, false])
    expect(outside.counts.fenceReads).toBe(2)
    expect(owned.counts.fenceReads).toBe(2)
    expect(outside.counts.comparisons).toBe(1)
    expect(owned.counts.comparisons).toBe(1)
    expect(outside.counts.captureAuthorizations).toBe(2)
    expect(owned.counts.captureAuthorizations).toBe(2)
    expect(outside.counts.fenceAuthorizations).toBeGreaterThan(0)
    expect(owned.counts.fenceAuthorizations).toBe(outside.counts.fenceAuthorizations)
    expect(native.nativeMethodsCurrent()).toBe(true)
    expect(outside.counts.sealedFences).toBe(0)
    expect(owned.counts.sealedFences).toBe(2)
    expect(owned.counts.sealIdentities).toHaveLength(2)
    expect(owned.counts.sealIdentities[0]).toBe(owned.counts.sealIdentities[1])
    expect(outside.counts.roots).toBe(2)
    expect(owned.counts.roots).toBe(2)
    // An inner admission still runs, but sees the current root and does not open
    // another owner. This does not claim identical global admission reads.
    expect(owned.counts.admissions).toBe(outside.counts.admissions + 1)
    console.info("SF_COMPARISON_PROOF_CONTROL", JSON.stringify({
      scenario: "admitted", mode: "native-sealed", qualification: false,
      nativeMethodsIntact: native.nativeMethodsCurrent(), physicalCountersMeasured: false,
      outside: withoutIdentities(outside.counts, false), owned: withoutIdentities(owned.counts, false),
    }))

    const instrumented = await deadline.phase("instrumented-fixture", () => fixture(deadline, "person", "instrumented"))
    expect(instrumented.nativeMethodsCurrent()).toBe(false)
    const physicalOutside = await deadline.phase("instrumented-unscoped", () => instrumented.run(false))
    const physicalOwned = await deadline.phase("instrumented-owned", () => instrumented.run(true))
    expect(physicalOutside.value).toBe(true)
    expect(physicalOwned.value).toBe(true)
    expect(physicalOutside.grant).toBe(true)
    expect(physicalOwned.grant).toBe(true)
    expect(physicalOutside.counts.fenceReads).toBe(2)
    expect(physicalOwned.counts.fenceReads).toBe(2)
    expect(physicalOutside.counts.comparisons).toBe(1)
    expect(physicalOwned.counts.comparisons).toBe(1)
    expect(physicalOutside.counts.captureAuthorizations).toBe(2)
    expect(physicalOwned.counts.captureAuthorizations).toBe(2)
    expect(physicalOutside.counts.fenceAuthorizations).toBeGreaterThan(0)
    expect(physicalOwned.counts.fenceAuthorizations).toBe(physicalOutside.counts.fenceAuthorizations)
    expect(physicalOutside.counts.fenceTransactionAll).toBe(2)
    expect(physicalOwned.counts.fenceTransactionAll).toBe(0)
    expect(physicalOutside.counts.sealedFences).toBe(0)
    expect(physicalOwned.counts.sealedFences).toBe(0)
    expect(physicalOutside.counts.roots).toBe(2)
    expect(physicalOwned.counts.roots).toBe(2)
    expect(physicalOwned.counts.physical).toBe(physicalOutside.counts.physical - 2)
    expect(physicalOwned.counts.admissions).toBe(physicalOutside.counts.admissions + 1)
    console.info("SF_COMPARISON_PROOF_CONTROL", JSON.stringify({
      scenario: "instrumented-physical", mode: "instrumented", qualification: false,
      sealedCapabilityClaimed: false, outside: withoutIdentities(physicalOutside.counts),
      owned: withoutIdentities(physicalOwned.counts),
    }))
    const instrumentedRoot = instrumented.persistence.readSnapshotRoot
    if (!instrumentedRoot) throw new Error("Instrumented root method unavailable")
    instrumented.persistence.readSnapshotRoot = undefined
    try {
      const legacy = await deadline.phase("absent-capability", () => instrumented.run(true))
      expect(legacy.value).toBe(true)
      expect(legacy.grant).toBe(true)
      expect(legacy.counts.roots).toBe(0)
      expect(legacy.counts.fenceTransactionAll).toBe(2)
      expect(legacy.counts.comparisons).toBe(1)
      console.info("SF_COMPARISON_PROOF_CONTROL", JSON.stringify({
        scenario: "capability-absent", mode: "instrumented", qualification: false,
        sealedCapabilityClaimed: false, counts: withoutIdentities(legacy.counts),
      }))
    } finally { instrumented.persistence.readSnapshotRoot = instrumentedRoot }
    const rootMethod = native.persistence.readSnapshotRoot
    if (!rootMethod) throw new Error("Native root method unavailable")

    await deadline.phase("borrowed-and-hidden-parent", () => native.withCall(async (call) => {
      const empty = { ...native.pair, criteria: [] }
      let entries = 0
      expect(await native.portfolio.observeComparisonProof(empty, call, async () => { entries++; return true })).toBe(true)
      expect(entries).toBe(1)
      for (const mode of ["ordinary", "function", "getter", "provider"] as const) {
        entries = 0
        const result = await native.business.withCase(call, native.ref, {}, async () => ({
          status: "ok" as const, value: await rootMethod.call(native.persistence, async () => {
            const descriptor = Object.getOwnPropertyDescriptor(native.persistence, "currentSnapshots")
            const provider = Object.getOwnPropertyDescriptor(native.authority.host, "persistence")
            if (!descriptor || !provider) throw new Error("Original native descriptors unavailable")
            let getters = 0
            const hidden = () => undefined
            try {
              if (mode === "function") Object.defineProperty(native.persistence, "currentSnapshots", { ...descriptor, value: hidden })
              if (mode === "getter") Object.defineProperty(native.persistence, "currentSnapshots", {
                configurable: true, enumerable: descriptor.enumerable, get() { getters++; return hidden },
              })
              if (mode === "provider") Object.defineProperty(native.authority.host, "persistence", {
                ...provider, value: { ...native.persistence, currentSnapshots: hidden },
              })
              const accepted = await native.portfolio.observeComparisonProof(empty, call, async () => { entries++; return true })
              if (mode === "getter") expect(getters).toBeGreaterThan(0)
              return accepted
            } finally {
              Object.defineProperty(native.persistence, "currentSnapshots", descriptor)
              Object.defineProperty(native.authority.host, "persistence", provider)
            }
          }, { signal: deadline.signal }),
        }))
        expect(ok(result)).toBe(false)
        expect(entries).toBe(0)
      }
    }))

    const comparison = native.stored.result
    const returnComparison: NonNullable<Hooks["compare"]> = async () => ({ status: "ok", value: structuredClone(comparison) })
    let poisonAttempts = 0
    const poisoned = await deadline.phase("poisoned-owner", () => native.run(true, {
      compare: returnComparison,
      afterAuthorization: async (index, _allowed, verifier, call) => {
        if (index !== 2) return
        expect(await native.hasGrant(verifier, call)).toBe(false)
        try {
          await native.persistence.transaction("planner", async () => ({ commit: true, value: undefined }))
        } catch { poisonAttempts++ }
      },
    }))
    expect(poisonAttempts).toBe(1)
    expect(poisoned.value).toBe(false)
    expect(poisoned.grant).toBe(false)
    expect(poisoned.counts.comparisons).toBe(1)
    const abort = new AbortController()
    const aborted = await deadline.phase("aborted-owner", () => native.run(true, {
      compare: returnComparison, signal: AbortSignal.any([deadline.signal, abort.signal]),
      afterAuthorization: async (index) => { if (index === 2) abort.abort("comparison-control") },
    }))
    expect(aborted.value).toBe(false)
    expect(aborted.grant).toBe(false)
    expect(aborted.counts.comparisons).toBe(1)
    const ownerError = new Error("root accepted the body but the outer owner rejected")
    let closedRoots = 0
    const refused = await deadline.phase("owner-refused-after-body", () => native.run(true, {
      compare: returnComparison,
    }, async () => { closedRoots++; throw ownerError }))
    expect(closedRoots).toBe(1)
    expect(refused.value).toBe(false)
    expect(refused.grant).toBe(false)
    expect(refused.counts.comparisons).toBe(1)

    // This principal deliberately takes Finance's documented unsupported branch.
    // It is not the macos principal used by Analytics. The extra failed admission
    // is measured, rather than being hidden by a new context or cached decision.
    const unsupported = await deadline.phase("unsupported-fixture", () => fixture(deadline, "local:person", "instrumented"))
    const oldFallback = await deadline.phase("old-unsupported", () => unsupported.run(false))
    const newFallback = await deadline.phase("new-unsupported", () => unsupported.run(true))
    expect(oldFallback.value).toBe(true)
    expect(newFallback.value).toBe(oldFallback.value)
    expect(newFallback.grant).toBe(true)
    expect(oldFallback.counts.comparisons).toBe(1)
    expect(newFallback.counts.comparisons).toBe(1)
    expect(oldFallback.counts.fenceTransactionAll).toBe(2)
    expect(newFallback.counts.fenceTransactionAll).toBe(2)
    expect(oldFallback.counts.sealedFences).toBe(0)
    expect(newFallback.counts.sealedFences).toBe(0)
    expect(newFallback.counts.roots).toBe(oldFallback.counts.roots + 1)
    expect(newFallback.counts.physical).toBeGreaterThan(oldFallback.counts.physical)
    console.info("SF_COMPARISON_PROOF_CONTROL", JSON.stringify({
      scenario: "unsupported", mode: "instrumented", qualification: false,
      sealedCapabilityClaimed: false, outside: withoutIdentities(oldFallback.counts),
      observed: withoutIdentities(newFallback.counts),
    }))

    await deadline.phase("concurrent-publication", () => native.withCall(async (olderCall) =>
      native.withCall(async (newerCall) => {
        const waiting = deferred<void>(), release = deferred<void>()
        const { verifier } = native.makeVerifier(false, {
          compare: returnComparison,
          afterAuthorization: async (index) => {
            if (index !== 2) return
            expect(await native.hasGrant(verifier, olderCall)).toBe(false)
            waiting.resolve(undefined)
            await release.promise
          },
        })
        const older = native.verify(verifier, olderCall)
        await waiting.promise
        try {
          expect(await native.verify(verifier, newerCall)).toBe(true)
          expect(await native.hasGrant(verifier, newerCall)).toBe(true)
        } finally { release.resolve(undefined) }
        expect(await older).toBe(false)
        expect(await native.hasGrant(verifier, newerCall)).toBe(true)
        const invalid = { ...structuredClone(native.stored), requestDigest: "f".repeat(64) }
        expect(await native.verify(verifier, newerCall, native.binding, invalid)).toBe(false)
        expect(await native.hasGrant(verifier, newerCall)).toBe(false)
      })))

    await deadline.phase("late-input-and-expiry", () => native.withCall(async (call) => {
      const copied = structuredClone(native.binding)
      const borrowed = { ...copied, request: { ...copied.request, criteria: [...copied.request.criteria] } }
      const late = native.makeVerifier(false, { compare: returnComparison,
        afterAuthorization: async (index) => { if (index === 2) borrowed.request.criteria.push("late") },
      }).verifier
      expect(await native.verify(late, call, borrowed)).toBe(false)
      expect(await native.hasGrant(late, call)).toBe(false)
      const originalNow = Date.now
      try {
        const expires = native.makeVerifier(false, { compare: returnComparison,
          afterAuthorization: async (index) => { if (index === 2) Date.now = () => originalNow() + 30_001 },
        }).verifier
        expect(await native.verify(expires, call)).toBe(false)
        expect(await native.hasGrant(expires, call)).toBe(false)
      } finally { Date.now = originalNow }
    }))

    await deadline.phase("rejection-and-false-contract", () => native.withCall(async (call) => {
      for (const error of [new Error("original comparison rejection"), undefined]) {
        let producerCalls = 0, caught = false
        const { verifier } = native.makeVerifier(true, { compare: async () => { producerCalls++; throw error } })
        try { await native.verify(verifier, call) }
        catch (observedError) { caught = true; expect(observedError).toBe(error) }
        expect(caught).toBe(true)
        expect(producerCalls).toBe(1)
        expect(await native.hasGrant(verifier, call)).toBe(false)
        const unavailable = await native.business.withCase(call, native.ref, {}, () =>
          native.consumer(verifier).read({ caseRef: native.ref, resultRef: native.stored.resultRef }, call))
        expect(unavailable.status).toBe("unavailable")
        expect(producerCalls).toBe(2)
      }
      let falseCalls = 0
      const { verifier } = native.makeVerifier(true, { compare: async () => {
        falseCalls++
        return { status: "stale", reason: "controlled-original-false" }
      } })
      const stale = await native.business.withCase(call, native.ref, {}, () =>
        native.consumer(verifier).read({ caseRef: native.ref, resultRef: native.stored.resultRef }, call))
      expect(stale.status).toBe("stale")
      expect(falseCalls).toBe(1)
      expect(await native.hasGrant(verifier, call)).toBe(false)

      let comparisons = 0, second = true
      const reentered = native.makeVerifier(true, {
        compare: async () => { comparisons++; return returnComparison(native.pair, call) },
        observe: async (_request, _call, work) => {
          const first = await work()
          second = await work()
          return first
        },
      }).verifier
      expect(await native.verify(reentered, call)).toBe(false)
      expect(second).toBe(false)
      expect(comparisons).toBe(1)
      expect(await native.hasGrant(reentered, call)).toBe(false)
    }))

    await deadline.phase("attempt-cap-and-cleanup", () => native.withCall(async (call) => {
      const release = deferred<void>(), entered = { count: 0 }, workCalls = { count: 0 }
      const { verifier } = native.makeVerifier(true, {
        compare: async () => { workCalls.count++; return returnComparison(native.pair, call) },
        observe: async () => { entered.count++; await release.promise; return false },
      })
      const attempts: Promise<boolean>[] = []
      try {
        for (let index = 0; index < 2048; index++) attempts.push(verifier.verifyComparison({
          ...native.binding, bindingDigest: index.toString(16).padStart(64, "0"),
        }, native.stored, call))
        expect(entered.count).toBe(2048)
        expect(await verifier.verifyComparison({ ...native.binding, bindingDigest: "f".repeat(64) }, native.stored, call)).toBe(false)
        expect(entered.count).toBe(2048)
      } finally { release.resolve(undefined) }
      expect((await Promise.all(attempts)).every((value) => value === false)).toBe(true)
      expect(await verifier.verifyComparison(native.binding, native.stored, call)).toBe(false)
      expect(entered.count).toBe(2049)
      expect(workCalls.count).toBe(0)
      expect(await native.hasGrant(verifier, call)).toBe(false)
    }))
  } finally { await deadline.close() }
}, 120_000)

function withoutIdentities(counts: Counts, physicalMeasured = true) {
  const { sealIdentities, physical, transactionAll, fenceTransactionAll, ...value } = counts
  return { ...value, ...(physicalMeasured ? { physical, transactionAll, fenceTransactionAll } : {}),
    sealedIdentities: new Set(sealIdentities).size }
}
