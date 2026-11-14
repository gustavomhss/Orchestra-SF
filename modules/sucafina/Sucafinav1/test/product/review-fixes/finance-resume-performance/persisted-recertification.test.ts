import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SensitivityRequest } from "../../../../product/contracts/operations.ts"
import type { DomainPortHost } from "../../../../product/contracts/ports.ts"
import type { CriterionResultBinding } from "../../../../product/decisions/criterion-rules.ts"
import { createPlannerIntervalProof } from "../../../../product/planner/interval-proof.ts"
import { plannerSourceActor } from "../../../../product/planner/port.ts"
import { validatePlannerThreshold } from "../../../../product/portfolio/threshold-proof.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { domain } from "../../../../runtime/planner.ts"
import { createPortfolioCoverageFixture } from "../../wp13/coverage-preview-fixture.ts"
import { persistedServices } from "../../wp13/sensitivity-read-scope-fixture.ts"

// Selective provenance: W26 threshold-recertification.test.ts blob
// 42ddb74c93873d0dec1e9d255ba90a2ae71cab7d supplies the interval/witness oracle;
// Finance sensitivity-read-scope.test.ts blob a25539d00f8a43f2e7e3be02a16c29ba1c0272f2
// supplies the real C08 result, private binding envelope and scope counterexamples.
// Fixture construction and all positive calculations use the current Finance code.
test("persisted Finance candidates recertify without another search and retain witness, evidence, root and lease fences", async () => {
  const started = performance.now()
  const proof = await candidateProof()
  console.info("SF_FINANCE_RECERTIFICATION", JSON.stringify({ phase: "fixture", elapsedMs: performance.now() - started }))
  try {
    const before = await proof.snapshots()
    expect(proof.stored.result.threshold).toBeCloseTo(55000, 8)
    expect(proof.stored.result.comparisonStatus).toBe("conditioned")
    expect(proof.fixture.selectedCoverage.assessment.coverageState).toBe("pending")
    expect(proof.stored.result.unresolvedConditions.some((condition) => condition.id === "known-components-threshold")).toBe(true)
    expect(await proof.verify("positive")).toBe(true)
    expect(proof.counts.searches).toBe(0)
    expect(proof.counts.units).toBeGreaterThan(0)
    expect(proof.counts.previews).toBeGreaterThan(0)
    expect(proof.scope.checks).toBe(2)
    expect(await proof.fence()).toBe(true)
    expect(await proof.snapshots()).toEqual(before)

    const binding = await proof.fixture.issuer.resolve(proof.request, proof.fixture.context)
    const structural = await createPlannerIntervalProof({ units: proof.fixture.issuer, preview: proof.fixture.preview })(proof.request, proof.fixture.baselineRef, proof.fixture.context)
    if (binding.status !== "ok" || structural.status !== "ok" || proof.stored.result.thresholdEvidence.state !== "exact") throw new Error("Current canonical candidate proof unavailable")
    const certificate = { value: proof.stored.result.thresholdEvidence.value, evidenceRefs: structural.value.sourceRefs }
    const original = { request: proof.request, binding: binding.value, source: proof.fixture.selectedResult, baseline: proof.fixture.baselineResult, structural: structural.value, context: proof.fixture.context, preview: proof.fixture.preview }
    const bits = new DataView(new ArrayBuffer(8))
    bits.setFloat64(0, certificate.value)
    bits.setBigUint64(0, bits.getBigUint64(0) + 1n)
    expect((await validatePlannerThreshold({ ...original, certificate: { ...certificate, value: bits.getFloat64(0) } })).status).not.toBe("ok")
    expect((await validatePlannerThreshold({ ...original, certificate: { ...certificate, evidenceRefs: certificate.evidenceRefs.slice(1) } })).status).not.toBe("ok")

    // Both hashes are recomputed: a self-consistent stored envelope must still
    // reproduce the canonical Finance evidence union, not merely accept its hash.
    const forged = structuredClone(proof.stored)
    if (forged.result.thresholdEvidence.state !== "exact" || !forged.result.thresholdEvidence.evidenceRefs.length) throw new Error("Exact persisted evidence missing")
    forged.result.thresholdEvidence.evidenceRefs = [...forged.result.thresholdEvidence.evidenceRefs, structuredClone(forged.result.thresholdEvidence.evidenceRefs[0]!)]
    forged.resultDigest = digestSfValue(forged.result)
    const forgedBinding = { ...proof.binding, resultDigest: forged.resultDigest, bindingDigest: "" }
    forgedBinding.bindingDigest = digestSfValue(Object.fromEntries(Object.entries(forgedBinding).filter(([key]) => key !== "bindingDigest")))
    expect(await proof.verify("forged-evidence", forgedBinding, forged)).toBe(false)
    expect(proof.counts.searches).toBe(0)
    expect(await proof.fence(forgedBinding)).toBe(false)
    expect(await proof.snapshots()).toEqual(before)

    const poisoned = { caught: false, provisional: undefined as boolean | undefined }
    proof.scope.final = async () => {
      poisoned.provisional = proof.fenceInsideScope()
      try { await proof.changeSource(46000) }
      catch { poisoned.caught = true }
    }
    expect(await proof.verify("root-poison")).toBe(false)
    expect(proof.counts.searches).toBe(0)
    expect(proof.scope.checks).toBe(2)
    expect(proof.writes.attempts).toBe(1)
    expect(proof.writes.canonicalAccepted).toBe(true)
    expect(poisoned.caught).toBe(true)
    expect(poisoned.provisional).toBe(false)
    expect(await proof.snapshots()).toEqual(before)
    expect(await proof.fence()).toBe(false)

    const revoked = { provisional: undefined as boolean | undefined }
    proof.scope.final = async () => {
      revoked.provisional = proof.fenceInsideScope()
      proof.fixture.request.headers.delete("authorization")
    }
    expect(await proof.verify("late-lease-revocation")).toBe(false)
    expect(proof.counts.searches).toBe(0)
    expect(proof.scope.checks).toBe(2)
    expect(revoked.provisional).toBe(false)
    expect(await proof.fixture.host.revalidate(proof.fixture.context)).toBe(false)
    expect(proof.fixture.host.requestFor(proof.fixture.context)).toBeUndefined()
    expect(await proof.snapshots()).toEqual(before)
    expect(await proof.fence()).toBe(false)
  } finally { await proof.fixture.cleanup() }
}, 120000)

async function candidateProof() {
  const fixture = await createPortfolioCoverageFixture("omitted")
  try {
    const counts = { searches: 0, units: 0, previews: 0 }
    const exact = fixture.exact
    const issue = fixture.issuer.issue
    const preview = fixture.preview
    fixture.exact = async (request, baselineRef, context) => { counts.searches++; return exact(request, baselineRef, context) }
    fixture.issuer.issue = async (request, context) => { counts.units++; return issue(request, context) }
    fixture.preview = async (request, context) => { counts.previews++; return preview(request, context) }
    const scope: { checks: number; final?: () => Promise<void> } = { checks: 0 }
    const host: Pick<DomainPortHost, "persistence" | "requestFor" | "revalidate"> = {
      persistence: fixture.store,
      requestFor: fixture.host.requestFor,
      revalidate: async (context) => {
        scope.checks++
        if (scope.checks === 2) await scope.final?.()
        return fixture.host.revalidate(context)
      },
    }
    const services = await persistedServices(fixture, "finance-performance-candidate", { readScopeHost: host })
    const request: SensitivityRequest = { ...fixture.sensitivityRequest, parameterBounds: { ...fixture.sensitivityRequest.parameterBounds, steps: 1 } }
    const evaluated = await services.sensitivity(request, fixture.context)
    if (evaluated.status !== "ok") throw new Error(`Canonical sensitivity unavailable: ${JSON.stringify(evaluated)}`)
    const units = await fixture.issuer.resolve(request, fixture.context)
    if (units.status !== "ok") throw new Error(`Canonical units unavailable: ${JSON.stringify(units)}`)
    const source = await services.results.readHistoricalScenario({ resultRef: request.scenarioRef }, fixture.context)
    const samples = await Promise.all(evaluated.value.evaluated.map((point) => services.results.read({ kind: "scenario", resultRef: point.resultRef }, fixture.context)))
    if (source.status !== "ok" || source.value.kind !== "scenario" || samples.some((sample) => sample.status !== "ok" || sample.value.kind !== "scenario")) throw new Error("Canonical sensitivity sample C08 unavailable")
    const sourceRefs = [...evaluated.value.evidenceRefs, ...source.value.sourceRefs, ...samples.flatMap((sample) => sample.status === "ok" ? sample.value.sourceRefs : [])]
      .filter((ref, index, all) => all.findIndex((other) => other.refDigest === ref.refDigest) === index)
    const saved = await services.results.write({ kind: "sensitivity", result: evaluated.value, caseRef: fixture.caseRef, requestDigest: digestSfValue(request), sourceRefs, idempotencyKey: "finance-performance-candidate-result" }, fixture.context)
    if (saved.status !== "ok" || saved.value.kind !== "sensitivity") throw new Error(`Real sensitivity C08 unavailable: ${JSON.stringify(saved)}`)
    const stored = structuredClone(saved.value)
    const body = { schema: "sf-criterion-result-v1" as const, caseRef: structuredClone(fixture.caseRef), resultRef: stored.resultRef, resultDigest: stored.resultDigest, request: structuredClone(request), requestDigest: stored.requestDigest, criterionId: request.criterion.id, ruleRef: units.value.ruleRef, ruleVersion: units.value.ruleVersion, principalRef: fixture.context.binding.principalRef, accessRevision: fixture.context.binding.accessRevision, policyVersion: fixture.context.binding.policyVersion, createdAt: "2026-11-13T00:00:00Z" }
    const binding: CriterionResultBinding = { ...body, bindingDigest: digestSfValue(body) }
    const transactionAll = fixture.store.transactionAll?.bind(fixture.store)
    if (!transactionAll) throw new Error("Recertification proof requires real multi-surface LocalStore")
    const snapshots = () => transactionAll(async (value) => ({ commit: false, value: structuredClone(value) }))
    const fence = (selected = binding) => fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: services.verifier.verifySnapshot(snapshot, selected, fixture.context) }))
    const fenceInsideScope = () => {
      const current = fixture.store.currentSnapshots?.()
      if (!current) throw new Error("Expected the real immutable source scope")
      return services.verifier.verifySnapshot(current.planner, binding, fixture.context)
    }
    const writes = { attempts: 0, canonicalAccepted: false }
    const changeSource = (amount: number) => fixture.store.transaction("planner", async (snapshot) => {
      writes.attempts++
      const principal = await fixture.host.authenticate(fixture.request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      const actor = plannerSourceActor(snapshot, principal, fixture.context.binding.principalRef)
      if (!actor) throw new Error("Current Planner actor unavailable")
      const environment = await fixture.host.environment(fixture.request)
      const sourceId = fixture.scenario.baseRef
      const changed = domain.execute(snapshot, actor, { page: "OPEX", action: "save", id: "implementation", version: snapshot.versions[`${sourceId}:lines:implementation`]?.version ?? 0, values: { versionId: sourceId, f10: amount } }, environment)
      writes.canonicalAccepted = changed.ok
      return { commit: changed.ok, value: changed }
    })
    const verify = async (phase: string, selected = binding, result = stored) => {
      scope.checks = 0
      counts.searches = 0
      counts.units = 0
      counts.previews = 0
      const started = performance.now()
      const accepted = await services.verifier.verifySensitivity(selected, result, fixture.context)
      console.info("SF_FINANCE_RECERTIFICATION", JSON.stringify({ phase, accepted, elapsedMs: performance.now() - started, ...counts, scopeChecks: scope.checks }))
      return accepted
    }
    return { fixture, services, request, scope, counts, binding, stored, snapshots, fence, fenceInsideScope, writes, changeSource, verify }
  } catch (error) {
    await fixture.cleanup()
    throw error
  }
}
