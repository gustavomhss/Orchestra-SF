import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SensitivityRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { CriterionResultBinding } from "../../../product/decisions/criterion-rules.ts"
import { plannerSourceActor } from "../../../product/planner/port.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { domain } from "../../../runtime/planner.ts"
import { createPortfolioCoverageFixture } from "./coverage-preview-fixture.ts"
import { persistedServices } from "./sensitivity-read-scope-fixture.ts"

test("sensitivity read scope refuses a swallowed canonical nested write and publishes no provisional fence", async () => {
  const proof = await scopeProof("nested-write")
  try {
    const before = await proof.snapshots()
    const observed = { caught: false, provisional: undefined as boolean | undefined }
    proof.scope.final = async () => {
      observed.provisional = proof.fenceInsideScope()
      try { await proof.changeSource(46000) }
      catch { observed.caught = true }
    }
    expect(await proof.verify()).toBe(false)
    expect(proof.scope.checks).toBe(2)
    expect(proof.writes.attempts).toBe(1)
    expect(proof.writes.canonicalAccepted).toBe(true)
    expect(observed.caught).toBe(true)
    expect(observed.provisional).toBe(false)
    expect(await proof.snapshots()).toEqual(before)
    expect(await proof.fence()).toBe(false)
  } finally { await proof.cleanup() }
}, 120000)

test("each sensitivity verification reads a fresh committed Planner source instead of retaining its previous scope", async () => {
  const proof = await scopeProof("fresh-source")
  try {
    const before = await proof.snapshots()
    expect(await proof.verify()).toBe(true)
    expect(proof.scope.checks).toBe(2)
    expect(await proof.fence()).toBe(true)
    expect(await proof.snapshots()).toEqual(before)
    expect((await proof.changeSource(46000)).ok).toBe(true)
    expect(await proof.snapshots()).not.toEqual(before)
    expect(await proof.verify()).toBe(false)
    expect(proof.scope.checks).toBeGreaterThan(0)
    expect(await proof.fence()).toBe(false)
  } finally { await proof.cleanup() }
}, 120000)

test("final UI authority revocation inside a sensitivity scope suppresses the staged proof", async () => {
  const proof = await scopeProof("final-revocation")
  try {
    const before = await proof.snapshots()
    const observed = { provisional: undefined as boolean | undefined }
    proof.scope.final = async () => {
      observed.provisional = proof.fenceInsideScope()
      // The real fixture UI authorizer checks this private Request header.
      // Its next revalidation revokes the actual admitted lease.
      proof.fixture.request.headers.delete("authorization")
    }
    expect(await proof.verify()).toBe(false)
    expect(proof.scope.checks).toBe(2)
    expect(observed.provisional).toBe(false)
    expect(await proof.fixture.host.revalidate(proof.fixture.context)).toBe(false)
    expect(proof.fixture.host.requestFor(proof.fixture.context)).toBeUndefined()
    expect(await proof.snapshots()).toEqual(before)
    expect(await proof.fence()).toBe(false)
  } finally { await proof.cleanup() }
}, 120000)

test("a failed sensitivity scope cannot retain its old grant or publish a callback-mutated replay input", async () => {
  const proof = await scopeProof("old-grant")
  const resolve = proof.fixture.issuer.resolve
  try {
    const inherited = await proof.fixture.store.transaction("planner", async () => {
      const accepted = await proof.verify()
      return { commit: false, value: { accepted, grant: proof.fenceInsideScope() } }
    })
    expect(inherited.accepted).toBe(false)
    expect(inherited.grant).toBe(false)
    expect(proof.scope.checks).toBe(0)
    expect(await proof.fence()).toBe(false)
    expect(await proof.verify()).toBe(true)
    expect(await proof.fence()).toBe(true)
    const before = await proof.snapshots()
    const borrowedDigest = digestSfValue({ binding: proof.binding, stored: proof.stored })
    const observed: { request?: SensitivityRequest; provisional?: boolean } = {}
    proof.fixture.issuer.resolve = async (request, context) => {
      // Retain the actual argument, while keeping the canonical resolver intact.
      observed.request ??= request
      return resolve(request, context)
    }
    proof.scope.final = async () => {
      observed.provisional = proof.fenceInsideScope()
      if (!observed.request) throw new Error("The canonical units callback was not reached")
      observed.request.parameterBounds.maximum += 1
    }
    expect(await proof.verify()).toBe(false)
    expect(proof.scope.checks).toBe(2)
    expect(observed.request).toBeDefined()
    expect(observed.request).not.toBe(proof.binding.request)
    expect(observed.provisional).toBe(false)
    expect(digestSfValue({ binding: proof.binding, stored: proof.stored })).toBe(borrowedDigest)
    expect(await proof.snapshots()).toEqual(before)
    expect(await proof.fence()).toBe(false)
  } finally {
    proof.fixture.issuer.resolve = resolve
    await proof.cleanup()
  }
}, 120000)

/** Financial observations, samples and sensitivity C08 are produced by the real
 * Planner and persisted through the real store. The binding envelope below is
 * private verifier input derived from that result and the real rule issuer;
 * full binding publication and all four cold replays remain in the integration
 * suite, avoiding seven unrelated verifier replays in each scope counterexample. */
async function scopeProof(label: string) {
  const fixture = await createPortfolioCoverageFixture("omitted")
  try {
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
    const services = await persistedServices(fixture, `scope-${label}`, { readScopeHost: host })
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
    const saved = await services.results.write({ kind: "sensitivity", result: evaluated.value, caseRef: fixture.caseRef, requestDigest: digestSfValue(request), sourceRefs, idempotencyKey: `scope-result:${label}` }, fixture.context)
    if (saved.status !== "ok" || saved.value.kind !== "sensitivity") throw new Error(`Real sensitivity C08 unavailable: ${JSON.stringify(saved)}`)
    const stored = structuredClone(saved.value)
    const body = { schema: "sf-criterion-result-v1" as const, caseRef: structuredClone(fixture.caseRef), resultRef: stored.resultRef, resultDigest: stored.resultDigest, request: structuredClone(request), requestDigest: stored.requestDigest, criterionId: request.criterion.id, ruleRef: units.value.ruleRef, ruleVersion: units.value.ruleVersion, principalRef: fixture.context.binding.principalRef, accessRevision: fixture.context.binding.accessRevision, policyVersion: fixture.context.binding.policyVersion, createdAt: "2026-11-13T00:00:00Z" }
    const binding: CriterionResultBinding = { ...body, bindingDigest: digestSfValue(body) }
    const transactionAll = fixture.store.transactionAll?.bind(fixture.store)
    if (!transactionAll) throw new Error("Read-scope counterexamples require a real multi-surface LocalStore")
    const snapshots = () => transactionAll(async (value) => ({ commit: false, value: structuredClone(value) }))
    const fence = () => fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: services.verifier.verifySnapshot(snapshot, binding, fixture.context) }))
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
    const verify = async () => {
      scope.checks = 0
      return services.verifier.verifySensitivity(binding, stored, fixture.context)
    }
    return { fixture, services, scope, binding, stored, snapshots, fence, fenceInsideScope, writes, changeSource, verify, cleanup: fixture.cleanup }
  } catch (error) {
    await fixture.cleanup()
    throw error
  }
}
