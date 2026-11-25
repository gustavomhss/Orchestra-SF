import { expect, mock, test } from "bun:test"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfPlannerCalculationRootProof } from "../../src/sucafina-product/planner-calculation-root.ts"

type Receipt = {
  schema: "sf-planner-record-wiring-v2"
  pid: number
  order: string[]
  scalarReads: number
  batches: number
  batchReferences: number
  physicalRoots: number
  recordFrames: number
  coldReads: number
  hits: number
  innerPairs: number
  noPeriodResolveCalls: number
  noPeriodObserverCalls: number
  noPeriodOwnerContinued: boolean
  sourceScopeBefore: { work: number; canonicalReads: number; admissionPolicyCalls: number }
  sourceScopeDuring: { canonicalReads: number; refusedReads: number; admissionPolicyCalls: number; latchedAfterExit: boolean }
}

/** Parent-only process envelope; none of the dynamic domain imports below run
 * in the parent test process. The one child has the original 105/120s budgets. */
export async function runSfPlannerRecordWiringControl(file: string) {
  const [{ AppProcess }, { LayerNode }, { expectSpawn }, { Effect }, { ChildProcess }, { Omni }] = await Promise.all([
    import("@orchestra/core/process"), import("@orchestra/core/effect/layer-node"),
    import("@orchestra/core/test/fixture/omni-expect"), import("effect"), import("effect/unstable/process"),
    import("@orchestra/core/omni"),
  ])
  expectSpawn(file)
  const before = Omni.snapshot()
  const result = await Effect.runPromise(Effect.scoped(Effect.provide(Effect.gen(function* () {
    const processes = yield* AppProcess.Service
    return yield* processes.run(ChildProcess.make(process.execPath, ["test", import.meta.path, "--timeout", "120000"], {
      cwd: import.meta.dir, extendEnv: true, env: { SF_PLANNER_RECORD_WIRING_CHILD: "1" },
      stdin: "ignore", stdout: "pipe", stderr: "pipe", killSignal: "SIGTERM", forceKillAfter: "1 second",
    }), { timeout: 135_000, maxOutputBytes: 1_048_576, maxErrorBytes: 1_048_576 })
  }), LayerNode.compile(AppProcess.node))))
  const after = Omni.snapshot()
  const stdout = result.stdout.toString("utf8")
  // Preserve bytes even if exit status, truncation or receipt decoding fails.
  // Embedded Bun/Omni footers stay base64 data, never parent verdict lines.
  console.info("SF_PLANNER_RECORD_WIRING_OUTPUT " + JSON.stringify({ schema: "sf-child-output-v1",
    exitCode: result.exitCode, stdoutTruncated: result.stdoutTruncated, stderrTruncated: result.stderrTruncated,
    stdoutBytes: result.stdout.length, stderrBytes: result.stderr.length,
    stdoutBase64: result.stdout.toString("base64"), stderrBase64: result.stderr.toString("base64") }))
  if (result.exitCode !== 0 || result.stdoutTruncated || result.stderrTruncated)
    throw new Error("Planner record wiring child failed: " + JSON.stringify({ exitCode: result.exitCode,
      stdoutTruncated: result.stdoutTruncated, stderrTruncated: result.stderrTruncated }))
  const prefix = "SF_PLANNER_RECORD_WIRING "
  const lines = stdout.split("\n").filter((line) => line.startsWith(prefix))
  if (lines.length !== 1) throw new Error("The child must publish exactly one completed wiring receipt")
  const receipt: unknown = JSON.parse(lines[0]!.slice(prefix.length))
  if (!receipt || typeof receipt !== "object" || !("schema" in receipt) || receipt.schema !== "sf-planner-record-wiring-v2")
    throw new Error("Invalid Planner record wiring receipt")
  return { ...(receipt as Receipt), omniSpawns: after.spawns - before.spawns,
    omniDelegations: after.delegations - before.delegations }
}

async function nativeWiring() {
  const order: string[] = []
  const proofPath = new URL("../../src/sucafina-product/planner-record-proof-scope.ts", import.meta.url).pathname
  const rootPath = new URL("../../src/sucafina-product/planner-calculation-root.ts", import.meta.url).pathname
  const financePath = new URL("../../src/sucafina-product/finance-pair-observation.ts", import.meta.url).pathname
  const productPath = new URL("../../../../modules/sucafina/Sucafinav1/product/planner/product.ts", import.meta.url).pathname
  const proofModule = await import("../../src/sucafina-product/planner-record-proof-scope.ts")
  const rootModule = await import("../../src/sucafina-product/planner-calculation-root.ts")
  const financeModule = await import("../../src/sucafina-product/finance-pair-observation.ts")
  const productModule = await import("../../../../modules/sucafina/Sucafinav1/product/planner/product.ts")
  // Capture originals before mock.module updates their export namespaces.
  const makeProof = proofModule.createSfPlannerRecordProofScope
  const makeRoot = rootModule.createSfPlannerCalculationRoot
  const readProof = rootModule.readSfPlannerCalculationRootProof
  const makeFinance = financeModule.createSfFinancePairObservation
  const makeProduct = productModule.createPlannerProduct
  order.push("original-factories-loaded")

  type Owner = NonNullable<ReturnType<typeof readProof>>
  type ProofScope = ReturnType<typeof makeProof>
  type Run = { scope: ProofScope; call: TrustedDomainContext; proof: SfPlannerCalculationRootProof;
    owner: Owner; entered: boolean; closed: boolean; observations: { value: BusinessEvidenceResolution; producers: number }[] }
  const runs: Run[] = [], roots: { proof: SfPlannerCalculationRootProof; owner: Owner; closed: boolean }[] = []
  const instances: { host: DomainPortHost; scope: ProofScope; readersCurrent: () => boolean }[] = []
  const finances: { criteria: string[]; insideRoot: boolean; scope: ProofScope | undefined }[] = []
  let recording = false, rootDepth = 0, scalarReads = 0, batches = 0, batchReferences = 0
  let noPeriodObserverCalls = 0, countNoPeriod = false
  let sourceScopeStage: "before" | "during" | undefined
  const sourceScopeBefore = { work: 0, canonicalReads: 0, admissionPolicyCalls: 0 }
  const sourceScopeDuring = { canonicalReads: 0, refusedReads: 0, admissionPolicyCalls: 0, latchedAfterExit: false }
  mock.module(proofPath, () => ({ ...proofModule, createSfPlannerRecordProofScope: (input: Parameters<typeof makeProof>[0]) => {
    const original = makeProof(input)
    let active: Run | undefined
    const scope: ProofScope = {
      observe: async (ref, call, canonical) => {
        if (countNoPeriod) noPeriodObserverCalls++
        const owner = active
        let producers = 0
        const value = await original.observe(ref, call, () => {
          producers++
          if (sourceScopeStage === "before") sourceScopeBefore.canonicalReads++
          if (sourceScopeStage === "during") sourceScopeDuring.canonicalReads++
          return canonical()
        })
        if (recording && owner) owner.observations.push({ value, producers })
        return value
      },
      run: async <Value>(refs: readonly BusinessEvidenceRef[], call: TrustedDomainContext,
        proof: SfPlannerCalculationRootProof | undefined, authorize: () => Promise<boolean>, unchanged: () => boolean,
        work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => {
        if (!recording) return original.run(refs, call, proof, authorize, unchanged, work)
        const owner = proof && readProof(proof, input.host, call)
        if (!owner || !proof || !owner.bytesIdentity || !owner.current()) throw new Error("The actual Finance frame requires a genuine current physical proof")
        const row: Run = { scope, call, proof, owner, entered: false, closed: false, observations: [] }
        runs.push(row)
        const previous = active
        try {
          return await original.run(refs, call, proof, authorize, unchanged, async () => {
            row.entered = true
            active = row
            return work()
          })
        } finally { active = previous; row.closed = true }
      },
    }
    instances.push({ host: input.host, scope, readersCurrent: input.readersCurrent })
    return scope
  } }))
  mock.module(rootPath, () => ({ ...rootModule, createSfPlannerCalculationRoot: (input: Parameters<typeof makeRoot>[0]) => {
    const original = makeRoot(input)
    return { ...original, prepare: async (...args: Parameters<typeof original.prepare>) => {
      const prepared = await original.prepare(...args)
      if (!prepared) return prepared
      return { run: async <Value>(work: () => Promise<PortResult<Value>>): Promise<PortResult<Value>> => prepared.run(async () => {
        if (!recording) return work()
        const proof = original.proof(args[0]), owner = proof && readProof(proof, input.host, args[0])
        if (!proof || !owner || !owner.bytesIdentity || !owner.current()) throw new Error("The actual root did not issue its physical proof")
        const row = { proof, owner, closed: false }
        roots.push(row)
        rootDepth++
        try { return await work() }
        finally { rootDepth--; row.closed = true }
      }) }
    } }
  } }))
  mock.module(financePath, () => ({ ...financeModule, createSfFinancePairObservation: (input: Parameters<typeof makeFinance>[0]) => {
    const original = makeFinance(input)
    return <Value>(request: Parameters<typeof original>[0], call: TrustedDomainContext, work: () => Promise<PortResult<Value>>) => {
      if (recording) finances.push({ criteria: [...request.criteria], insideRoot: rootDepth > 0, scope: input.recordProof })
      return original(request, call, work)
    }
  } }))
  mock.module(productPath, () => ({ ...productModule, createPlannerProduct: (input: Parameters<typeof makeProduct>[0]) => {
    const product = makeProduct(input), scenarios = product.scenarios
    if (scenarios) {
      const resolve = scenarios.resolve, resolveMany = scenarios.resolveMany
      scenarios.resolve = function (this: typeof scenarios, ...args: Parameters<typeof resolve>): ReturnType<typeof resolve> {
        if (recording) scalarReads++
        return Reflect.apply(resolve, this, args)
      }
      if (resolveMany) scenarios.resolveMany = function (this: typeof scenarios, ...args: Parameters<typeof resolveMany>): ReturnType<typeof resolveMany> {
        if (recording) { batches++; batchReferences += args[0].length }
        return Reflect.apply(resolveMany, this, args)
      }
    }
    return product
  } }))
  order.push("transparent-wrappers-installed-before-business")

  const { sensitivityObservationFixture, sensitivityOk } = await import("../../../../modules/sucafina/Sucafinav1/test/product/wp10/integration/sensitivity-observation-fixture.ts")
  const { compositionTestDeadline } = await import("../../../../modules/sucafina/Sucafinav1/test/product/wp10/integration/composition-test-deadline.ts")
  const { createSfPortfolioAuthority } = await import("../../src/sucafina-product/portfolio-authority.ts")
  const { withSfScopedSourceChecks } = await import("../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts")
  const { digestSfValue, digestSfEvidenceRef, sfEvidenceSourceMaps } = await import("../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts")
  const deadline = compositionTestDeadline("planner-record-proof-wiring")
  let coldReads = 0, hits = 0, innerPairs = 0, noPeriodResolveCalls = 0, noPeriodOwnerContinued = false
  try {
    const native = await deadline.phase("native-fixture-and-atlas", () => sensitivityObservationFixture(deadline, "all", "lte", { plannerRecordProof: true }))
    order.push("native-business-and-atlas-ready")
    const host = native.authority.host
    const selected = instances.filter((entry) => entry.host === host)
    expect(selected).toHaveLength(1)
    const binding = selected[0]!
    expect(binding.readersCurrent()).toBe(true)
    const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal,
      headers: { origin: "https://example.test" } })
    const coverageRef = native.proofCoverageRefs?.[0]
    if (!coverageRef) throw new Error("The actual baseline coverage registration is required")
    const promotion = { caseRef: native.caseRef, title: "Shared native Planner reference",
      scenario: { baseRef: native.sources[0]!.refId, operations: [{ kind: "replace" as const, targetRef: "line:1", amount: 90, currency: "USD" }], assumptions: [] }, coverageRef }
    const human = sensitivityOk(await native.authority.human.admit(request(), "decisions.promote-alternative", promotion))
    let promoted: Awaited<ReturnType<typeof native.portfolio.mutations.addAlternative>>
    try {
      promoted = await deadline.phase("second-scenario-with-same-real-planner-ref", () => native.business.withCase(human, native.caseRef, {}, () =>
        native.portfolio.mutations.addAlternative(promotion, human)))
    } finally { native.authority.human.finish(human) }
    const candidate = sensitivityOk(promoted)
    if (!candidate.resultRef) throw new Error("The second real scenario must be persisted")
    const pair = { scenarioRefs: [native.references[0]!, candidate.resultRef], criteria: ["cost"] }
    const callDigest = digestSfValue(pair)
    const call = sensitivityOk(await native.authority.ui.admit(request(), "sf_scenario_compare", callDigest))
    try {
      expect(await native.authority.ui.validate(call, "sf_scenario_compare", callDigest)).toBe(true)
      // Direct comparison/Finance wiring only: the unused binding-verifier proof
      // callback does not make this an end-to-end Preview control.
      const portfolio = createSfPortfolioAuthority({ authority: native.authority, business: native.business,
        proposalCoverageWrites: native.writes, proof: () => undefined })
      await deadline.phase("outer-criteria-business-finance-bcs", () => native.business.withCase(call, candidate.caseRef, {}, async () => {
        const scenarios = native.business.plannerProduct.scenarios
        if (!scenarios) throw new Error("The actual stored scenarios are required")
        const first = sensitivityOk(await scenarios.resolve(pair.scenarioRefs[0]!, call))
        const second = sensitivityOk(await scenarios.resolve(pair.scenarioRefs[1]!, call))
        expect(first.result.sourceRefs.some((ref) => second.result.sourceRefs.some((other) => ref.refDigest === other.refDigest))).toBe(true)
        expect(first.result.knownSubtotal).toBe(120)
        expect(second.result.knownSubtotal).toBe(110)
        expect(first.source).toEqual(second.source)
        expect(first.source.refDigest).toBe(native.sources[0]!.refDigest)
        expect(second.source.refDigest).toBe(native.sources[0]!.refDigest)
        // All instrumentation was installed before these methods were birth-pinned.
        expect(binding.readersCurrent()).toBe(true)
        recording = true
        let result: Awaited<ReturnType<typeof portfolio.planner.compareScenarios>>
        try { result = await portfolio.planner.compareScenarios(pair, call) }
        finally { recording = false }
        const value = sensitivityOk(result)
        expect({ scenarioRefs: [value.baselineResultRef, value.alternativeResultRef],
          criteria: value.criterionResults.map((entry) => entry.criterionId) }).toEqual(pair)
        expect(value.baselineResultRef).toBe(pair.scenarioRefs[0])
        expect(value.alternativeResultRef).toBe(pair.scenarioRefs[1])
        expect(value.knownDifference).toBe(-10)
        expect(value.comparisonStatus).toBe("conditioned")
        expect(value.completeDifference).toBeNull()
        expect(value.criterionResults).toEqual([{ criterionId: "cost", state: "unknown", reason: "criterion-metric-conditioned" }])
        expect(scalarReads).toBe(0)
        expect(batches).toBe(7)
        expect(batchReferences).toBe(14)
        expect(roots).toHaveLength(2)
        expect(runs).toHaveLength(1)
        expect(runs[0]!.scope).toBe(binding.scope)
        expect(runs[0]!.owner).toBe(roots[0]!.owner)
        expect(runs[0]!.owner.identity).toBe(roots[0]!.owner.identity)
        expect(runs[0]!.owner.bytesIdentity).toBe(roots[0]!.owner.bytesIdentity)
        expect(runs[0]!.entered && runs[0]!.closed).toBe(true)
        expect(finances.filter((row) => row.criteria.length)).toHaveLength(1)
        expect(finances.find((row) => row.criteria.length)?.criteria).toEqual(["cost"])
        expect(finances.find((row) => row.criteria.length)?.scope).toBe(binding.scope)
        const inner = finances.filter((row) => !row.criteria.length)
        innerPairs = inner.length
        expect(innerPairs).toBeGreaterThan(0)
        expect(inner.every((row) => row.insideRoot && row.scope === binding.scope)).toBe(true)
        for (const row of runs[0]!.observations) {
          if (row.producers === 1) coldReads++
          if (row.producers !== 0 || row.value.state !== "fresh") continue
          const original = runs[0]!.observations.find((prior) => prior.producers === 1 &&
            prior.value.state === "fresh" && prior.value.ref.refDigest === row.value.ref.refDigest)
          if (!original) throw new Error("A retained BCS observation must have its own original completed producer")
          expect(row.value).toEqual(original.value)
          expect(row.value).not.toBe(original.value)
          hits++
        }
        expect(coldReads).toBeGreaterThan(0)
        expect(hits).toBeGreaterThan(0)
        expect(binding.readersCurrent()).toBe(true)
        for (const root of roots) {
          expect(root.closed).toBe(true)
          expect(root.owner.current()).toBe(false)
          expect(readProof(root.proof, host, call)).toBeUndefined()
        }
        return result
      }))

      await deadline.phase("valid-period-optional-ref-keeps-original-bcs-and-owner", () => native.business.withCase(call, candidate.caseRef, {}, async () => {
        const reference = structuredClone(native.sources[0]!)
        if (reference.kind !== "record") throw new Error("A real record ref is required")
        const absent = structuredClone(reference)
        delete absent.target.period
        absent.refDigest = digestSfEvidenceRef(absent)
        expect(() => sfEvidenceSourceMaps([absent])).not.toThrow()
        const expected = await native.business.context.resolve(absent, call)
        const { checkedAt: _beforeTime, ...before } = expected
        const root = makeRoot({ host })
        const prepared = await root.prepare(call, async () => true, () => true)
        if (!prepared) throw new Error("The real period-optional control owner was not prepared")
        const observed = await prepared.run(async () => {
          const proof = root.proof(call), owner = proof && readProof(proof, host, call)
          if (!proof || !owner || !owner.current()) throw new Error("The real period-optional control needs a current proof")
          return binding.scope.run([reference], call, proof, () => host.revalidate(call), () => true, async () => {
            countNoPeriod = true
            let value: BusinessEvidenceResolution
            try { value = await native.business.context.resolve(absent, call); noPeriodResolveCalls++ }
            finally { countNoPeriod = false }
            const { checkedAt: _afterTime, ...after } = value
            expect(after).toEqual(before)
            expect(noPeriodObserverCalls).toBe(0)
            expect(owner.current()).toBe(true)
            const live = await native.business.context.resolve(reference, call)
            expect(live.state).toBe("fresh")
            expect(owner.current()).toBe(true)
            noPeriodOwnerContinued = true
            return { status: "ok", value: after }
          })
        })
        expect(sensitivityOk(observed)).toEqual(before)
        expect(root.proof(call)).toBeUndefined()
        return observed
      }))

      await deadline.phase("source-policy-before-frame-keeps-two-original-producers", () => native.business.withCase(call, candidate.caseRef, {}, async () => {
        const reference = structuredClone(native.sources[0]!)
        const root = makeRoot({ host })
        const prepared = await root.prepare(call, async () => true, () => true)
        if (!prepared) throw new Error("The original source-policy fallback requires a real prepared root")
        let emitted: SfPlannerCalculationRootProof | undefined, policyCalls = 0
        sourceScopeStage = "before"
        try {
          const result = await prepared.run(async () => {
            const proof = root.proof(call), owner = proof && readProof(proof, host, call)
            const originalRequest = host.requestFor(call)
            if (!proof || !owner || !owner.current() || !originalRequest) throw new Error("The source-policy fallback needs its original owner and Request")
            emitted = proof
            const observed = await withSfScopedSourceChecks({ owner: host.persistence, request: originalRequest,
              current: () => { policyCalls++; return true } }, async () => {
              const beforePolicy = policyCalls
              expect(binding.readersCurrent()).toBe(false)
              sourceScopeBefore.admissionPolicyCalls += policyCalls - beforePolicy
              return binding.scope.run([reference], call, proof, () => host.revalidate(call), () => true, async () => {
                sourceScopeBefore.work++
                const first = await native.business.context.resolve(reference, call)
                const second = await native.business.context.resolve(reference, call)
                expect(first.state).toBe("fresh")
                expect(second.state).toBe("fresh")
                expect(sourceScopeBefore.canonicalReads).toBe(2)
                expect(owner.current()).toBe(true)
                return { status: "ok", value: true }
              })
            })
            expect(observed.current()).toBe(true)
            expect(binding.readersCurrent()).toBe(true)
            return observed.value
          })
          expect(sensitivityOk(result)).toBe(true)
          expect(sourceScopeBefore).toEqual({ work: 1, canonicalReads: 2, admissionPolicyCalls: 0 })
          expect(policyCalls).toBeGreaterThan(0)
          if (!emitted) throw new Error("The fallback phase did not enter its real physical owner")
          expect(readProof(emitted, host, call)).toBeUndefined()
          return result
        } finally { sourceScopeStage = undefined }
      }))

      await deadline.phase("source-policy-after-admission-latches-without-replay", () => native.business.withCase(call, candidate.caseRef, {}, async () => {
        const reference = structuredClone(native.sources[0]!)
        const root = makeRoot({ host })
        const prepared = await root.prepare(call, async () => true, () => true)
        if (!prepared) throw new Error("The source-policy latch requires a real prepared root")
        let emitted: SfPlannerCalculationRootProof | undefined, policyCalls = 0, live = true
        sourceScopeStage = "during"
        try {
          const result = await prepared.run(async () => {
            const proof = root.proof(call), owner = proof && readProof(proof, host, call)
            const originalRequest = host.requestFor(call)
            if (!proof || !owner || !owner.current() || !originalRequest) throw new Error("The admitted phase needs its original owner and Request")
            emitted = proof
            expect(binding.readersCurrent()).toBe(true)
            return binding.scope.run([reference], call, proof, () => host.revalidate(call), () => true, async () => {
              const cold = await native.business.context.resolve(reference, call)
              expect(cold.state).toBe("fresh")
              expect(sourceScopeDuring.canonicalReads).toBe(1)
              const observed = await withSfScopedSourceChecks({ owner: host.persistence, request: originalRequest,
                current: () => { policyCalls++; return live } }, async () => {
                const beforePolicy = policyCalls
                expect(binding.readersCurrent()).toBe(false)
                sourceScopeDuring.admissionPolicyCalls += policyCalls - beforePolicy
                live = false
                try {
                  const refused = await native.business.context.resolve(reference, call)
                  expect(refused.state).toBe("unavailable")
                  sourceScopeDuring.refusedReads++
                  expect(sourceScopeDuring.canonicalReads).toBe(1)
                  return true
                } finally { live = true }
              })
              expect(observed.value).toBe(true)
              expect(binding.readersCurrent()).toBe(true)
              const afterExit = await native.business.context.resolve(reference, call)
              expect(afterExit.state).toBe("unavailable")
              sourceScopeDuring.refusedReads++
              expect(sourceScopeDuring.canonicalReads).toBe(1)
              expect(owner.current()).toBe(true)
              sourceScopeDuring.latchedAfterExit = true
              return { status: "ok", value: true }
            })
          })
          expect(result.status).toBe("unavailable")
          expect(sourceScopeDuring).toEqual({ canonicalReads: 1, refusedReads: 2, admissionPolicyCalls: 0, latchedAfterExit: true })
          expect(policyCalls).toBeGreaterThan(0)
          if (!emitted) throw new Error("The latch phase did not enter its real physical owner")
          expect(readProof(emitted, host, call)).toBeUndefined()
          return result
        } finally { sourceScopeStage = undefined; live = true }
      }))
    } finally { recording = false; countNoPeriod = false; sourceScopeStage = undefined; native.authority.ui.finish(call) }
    order.push("all-native-wiring-period-and-source-policy-assertions-completed")
  } finally { recording = false; countNoPeriod = false; sourceScopeStage = undefined; await deadline.close() }
  order.push("native-resources-closed")
  const receipt: Receipt = { schema: "sf-planner-record-wiring-v2", pid: process.pid, order,
    scalarReads, batches, batchReferences, physicalRoots: roots.length, recordFrames: runs.length,
    coldReads, hits, innerPairs, noPeriodResolveCalls, noPeriodObserverCalls, noPeriodOwnerContinued, sourceScopeBefore, sourceScopeDuring }
  console.info("SF_PLANNER_RECORD_WIRING " + JSON.stringify(receipt))
}

if (process.env.SF_PLANNER_RECORD_WIRING_CHILD === "1") {
  test("Real Planner criteria preserve owner, terminal proof, sibling reads and optional-period fallback", nativeWiring, 120_000)
}
