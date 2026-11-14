import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createPlannerSensitivity } from "../../../product/portfolio/planner-sensitivity.ts"
import { createPortfolioProofVerifier } from "../../../product/portfolio/verification.ts"
import { createWp13SensitivityFixture, createWp13SensitivityRuntimeFixture } from "./sensitivity-fixture.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"

const stage = (name: string) => process.stderr.write(`SF_WP13_RENEWAL_STAGE:${name}\n`)

type World = Awaited<ReturnType<typeof createWp13SensitivityFixture>>
const at = (world: World, amount: number) => world.preview({ baselineRef: world.baselineRef, scenario: { ...world.scenario, operations: world.scenario.operations.map((operation) => operation.targetRef === world.sensitivityRequest.parameterBounds.parameterRef ? { ...operation, amount } : operation) } }, world.context)

test("C10 omitted training keeps an exact real 55000 subtotal boundary conditioned, including replay and restart", async () => {
  expectSpawn(import.meta.path)
  const childDeadline = Date.now() + 55000
  stage("fixture-start")
  const world = await createWp13SensitivityFixture({ renewal: {} })
  stage("fixture-ready")
  try {
    expect(world.baselineResult.knownSubtotal).toBe(240000)
    expect(world.selectedResult.knownSubtotal).toBe(210000)
    expect(world.selectedResult.total).toBeNull()
    expect(world.selectedResult.costCoverage.derivedMissingCategoryIds).toContain("training")
    const result = world.saved.sensitivity
    expect(result.thresholdEvidence.state).toBe("exact")
    expect(result.threshold).toBeCloseTo(55000, 8)
    expect(result.comparisonStatus).toBe("conditioned")
    expect(result.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
    expect(result.unresolvedConditions.some((condition) => condition.id === "known-subtotal-threshold")).toBe(true)
    expect(result.costCoverageRefs).toHaveLength(2)
    const boundary = await at(world, 55000)
    const beyond = await at(world, 55001)
    const changed = await at(world, 70000)
    expect(boundary.status).toBe("ok")
    expect(beyond.status).toBe("ok")
    expect(changed.status).toBe("ok")
    if (boundary.status !== "ok" || beyond.status !== "ok" || changed.status !== "ok") throw new Error("real boundary previews unavailable")
    expect(boundary.value.sample.knownSubtotal).toBe(220000)
    expect(boundary.value.metric.value).toBe(-20000)
    expect(beyond.value.metric.value).toBe(-19999)
    expect(changed.value.sample.knownSubtotal).toBe(235000)
    expect(changed.value.metric.value).toBe(-5000)
    expect(boundary.value.comparison.completeDifference).toBeNull()
    const transactionAll = world.store.transactionAll
    if (!transactionAll) throw new Error("cross-surface verification required")
    const fence = (snapshots: Record<"dashboard" | "planner" | "procurement", Snapshot>) => ({ dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) })
    const verifier = createPortfolioProofVerifier({ cases: world.cases, planner: world.plannerWithCriteria, sources: world.sources, evidence: world.evidenceService, results: world.results, revalidate: world.host.revalidate, readSourceFences: async () => world.access.allowed ? transactionAll(async (snapshots) => ({ commit: false, value: fence(snapshots) })) : undefined, lockedSourceFences: () => { const snapshots = world.store.currentSnapshots?.(); return snapshots ? fence(snapshots) : undefined }, caseFor: async () => ({ status: "ok", value: world.caseRef }), idempotencyKey: async (digest) => `verify-${digest}`, decisions: { prepareChanges: async () => ({ status: "unavailable", reason: "unused-by-read-only-replay" }) }, createReceipt: async () => undefined, candidateCoverageRefFor: async () => ({ status: "unavailable", reason: "unused-by-sensitivity-replay" }), revalidateAnalysis: async () => false, units: world.issuer, sensitivityPreview: world.preview, exactThreshold: (request, binding, trusted) => world.exact(request, binding.baselineRef, trusted) })
    const binding = await world.bindings.read({ caseRef: world.caseRef, resultRef: world.saved.sensitivityResultRef }, world.context)
    const stored = await world.results.read({ kind: "sensitivity", resultRef: world.saved.sensitivityResultRef }, world.context)
    if (binding.status !== "ok" || stored.status !== "ok" || stored.value.kind !== "sensitivity") throw new Error("bound sensitivity unavailable")
    const ids = world.ids.value
    stage("replay-start")
    expect(await verifier.verifySensitivity(binding.value, stored.value, world.context)).toBe(true)
    stage("replay-ready")
    const forged = { ...stored.value, result: { ...stored.value.result, threshold: 55001, thresholdEvidence: { state: "exact" as const, value: 55001, evidenceRefs: stored.value.result.evidenceRefs } } }
    expect(await verifier.verifySensitivity(binding.value, { ...forged, resultDigest: digestSfValue(forged.result) }, world.context)).toBe(false)
    expect(world.ids.value).toBe(ids)
    expect(await world.persistent.evaluateAndStore(world.sensitivityRequest, world.caseRef, world.context)).toEqual({ status: "ok", value: world.saved })
    expect(world.ids.value).toBe(ids)
    const orphan = await world.results.write({ kind: "sensitivity", result, caseRef: world.caseRef, requestDigest: digestSfValue(world.sensitivityRequest), sourceRefs: stored.value.sourceRefs, idempotencyKey: "restart-orphan" }, world.context)
    if (orphan.status !== "ok") throw new Error("orphan counterexample could not be persisted")
    await world.store.dispose()
    const reader = new URL("./renewal-restart-reader.ts", import.meta.url).pathname
    const restart = async (ref: string, permission: "allowed" | "revoked" | "revoked-during-proof") => {
      stage(`restart-${permission}-start`)
      const child = await Effect.runPromise(AppProcess.Service.use((runner) => runner.run(
        ChildProcess.make(Bun.argv[0]!, [reader, world.directory, ref, permission], { extendEnv: true, stdin: "ignore" }),
        { timeout: Math.max(1, childDeadline - Date.now()), inspect: (chunk) => { process.stderr.write(chunk) } },
      )).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
      stage(`restart-${permission}-returned`)
      expect(child.exitCode).toBe(0)
      const line = child.stdout.toString("utf8").split("\n").find((value) => value.startsWith("SF_WP13_RESTART_PROBE:"))
      if (child.exitCode !== 0 || !line) throw new Error(`Restart reader failed: ${child.stderr.toString("utf8")}`)
      return JSON.parse(line.slice("SF_WP13_RESTART_PROBE:".length))
    }
    const observed = await restart(world.saved.sensitivityResultRef, "allowed")
    expect(observed.status, JSON.stringify(observed)).toBe("ok")
    expect(observed.proof).toBe("bound-reader-and-current-producer-replay")
    expect(observed.pid).not.toBe(process.pid)
    expect(observed.resultDigest).toBe(stored.value.resultDigest)
    expect(observed.evaluated).toEqual(result.evaluated)
    expect(observed.thresholdEvidence).toEqual(result.thresholdEvidence)
    expect(observed.comparisonStatus).toBe("conditioned")
    expect((await restart(orphan.value.resultRef, "allowed")).status).toBe("unavailable")
    expect((await restart(world.saved.sensitivityResultRef, "revoked")).status).toBe("denied")
    const revokedDuringProof = await restart(world.saved.sensitivityResultRef, "revoked-during-proof")
    expect(revokedDuringProof.revocationInjected).toBe(true)
    expect(revokedDuringProof.operationProofHits).toBeGreaterThan(0)
    expect(revokedDuringProof.status).not.toBe("ok")
    expect(revokedDuringProof.resultDigest).toBeUndefined()
  } finally { await world.cleanup() }
}, 60000)

test("C10 priced training changes real subtotal 210000 to 250000 and the boundary to 15000", async () => {
  const world = await createWp13SensitivityFixture({ renewal: { training: 40000 } })
  try {
    expect(world.baselineResult.knownSubtotal).toBe(240000)
    expect(world.selectedResult.knownSubtotal).toBe(250000)
    expect(world.selectedResult.components.find((component) => component.id === "training:11")?.amount).toBe(40000)
    expect(world.selectedResult.costCoverage.entries.find((entry) => entry.categoryId === "training")?.status).toBe("included")
    expect(world.selectedResult.costCoverage.derivedMissingCategoryIds).not.toContain("training")
    expect(world.saved.sensitivity.thresholdEvidence.state).toBe("exact")
    expect(world.saved.sensitivity.threshold).toBeCloseTo(15000, 8)
    expect(world.saved.sensitivity.comparisonStatus).toBe("conditioned")
    const current = await at(world, 45000)
    const boundary = await at(world, 15000)
    const beyond = await at(world, 15001)
    if (current.status !== "ok" || boundary.status !== "ok" || beyond.status !== "ok") throw new Error("real training previews unavailable")
    expect(current.value.metric.value).toBe(10000)
    expect(current.value.sample.knownSubtotal).toBeGreaterThan(240000)
    expect(boundary.value.sample.knownSubtotal).toBe(220000)
    expect(boundary.value.metric.value).toBe(-20000)
    expect(beyond.value.metric.value).toBe(-19999)
    world.access.allowed = false
    expect((await world.persistent.read(world.saved.sensitivityResultRef, world.context)).status).toBe("denied")
  } finally { await world.cleanup() }
}, 60000)

test("a false scalar certificate cannot replace real boundary evidence; sampled fallback remains conditioned", async () => {
  const world = await createWp13SensitivityRuntimeFixture({ renewal: {} })
  try {
    const evaluated = createPlannerSensitivity({ results: world.results, resolve: world.issuer.resolve, revalidate: world.issuer.revalidate, preview: world.preview, exactThreshold: async () => ({ status: "ok", value: { value: 55001, evidenceRefs: [world.evidence] } }), idempotencyKey: async (digest) => `invalid-certificate-${digest}` })
    const result = await evaluated(world.sensitivityRequest, world.context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.threshold).toBeNull()
    expect(result.value.thresholdEvidence).toMatchObject({ state: "sampled", interval: { minimum: 50000, maximum: 100000 } })
    expect(result.value.comparisonStatus).toBe("conditioned")
    expect(result.value.unresolvedConditions.some((condition) => condition.reason === "missing-category:training")).toBe(true)
  } finally { await world.cleanup() }
}, 60000)
