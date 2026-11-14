import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../../product/contracts/operations.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Real SQLite/C08, admitted UI calls, Planner producer, persisted request/result
// stores and BCS. The pending coverage and accepted ledger event are explicit
// fixtures; this does not claim native model, scanner or human acceptance proof.
test("C17 composition reopens a calculation with ledger ancestry and rejects a persisted cycle and revoked authority", async () => {
  const deadline = compositionTestDeadline("calculation-ancestry-composition")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-calculation-ancestry-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const storeDirectory = path.join(directory, "store")
  const at = "2027-02-02T00:00:00Z"
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "ancestry-case", incarnation: "ancestry-inc", version: 1 }
  const otherCaseRef = { id: "other-case", incarnation: "other-inc", version: 1 }
  const control = { active: true }
  const open = async (initialize: boolean) => {
    const store = await openLocalStore(storeDirectory)
    deadline.own(() => store.dispose())
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => at) }) }
    if (initialize) {
      for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [{ id: "v0", name: "Ancestry fixture", year: 2027, closed: 1,
          lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }], officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    }
    const writes = new WeakSet<object>()
    const identity = { installationId: "ancestry-installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal, headers: { origin: "https://example.test" } })
    const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "ancestry-policy",
      persistence, proposalCoverageWrites: writes, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
        operations: ["sf_scenario_simulate", "sf_evidence_get"], humanActions: [] }],
      authenticate: async (_request, scope) => { deadline.check(); return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null },
      environment: async () => { deadline.check(); return { at, id: randomUUID, directory: [] } }, createId: randomUUID, now: Date.now,
      commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
    deadline.own(() => business.dispose())
    business.bindForecastCoverage(async (reference, call) => {
      const source = await business.plannerSources.resolveForecastSource(reference, call)
      if (source.status !== "ok") return source
      return { status: "ok", value: { coverageRef: "fixture:pending-coverage", basis: { id: "fixture-basis", version: 1,
        decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
        assessment: { basisId: "fixture-basis", basisVersion: 1, alternativeId: "baseline", alternativeVersion: 1, currency: "USD", horizon: period,
          issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
          entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const ui = async <T>(operation: string, work: (call: TrustedUiContext) => Promise<T>) => {
      const digest = digestSfValue({})
      const admitted = await authority.ui.admit(request(), operation, digest)
      if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digest)) throw new Error(`UI ${operation} unavailable`)
      try { return await work(admitted.value) } finally { authority.ui.finish(admitted.value) }
    }
    if (initialize) {
      const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
        targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "fixture-cases", commandDigest: digestSfValue([caseRef, otherCaseRef]) }, async (state) => {
        for (const selected of [caseRef, otherCaseRef]) state.cases[selected.id] = { ...selected, state: "investigating", objective: "Ancestry composition fixture", horizon: period,
          currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
        return { commit: true, value: true }
      })
      if (seeded.status !== "ok") throw new Error("Case fixtures unavailable")
    }
    const produce = (scenario: ScenarioRequest | undefined, idempotencyKey: string) => ui("sf_scenario_simulate", (call) => business.withCase(call, caseRef, {}, async () => {
      const issued = await business.plannerProduct.issueSource("v0", call)
      if (issued.status !== "ok") return issued
      const input = scenario ?? { baseRef: issued.value.evidence.refId, operations: [], assumptions: [] }
      const simulated = await business.planner.simulateScenario(input, call)
      if (simulated.status !== "ok") return simulated
      const saved = await business.calculations.persist({ kind: "scenario", request: input, result: simulated.value }, idempotencyKey, call)
      if (saved.status !== "ok") return saved
      const calculation = await business.calculations.issue(saved.value.resultRef, call)
      return calculation.status === "ok" ? { status: "ok" as const, value: { input, result: simulated.value, calculation: calculation.value } } : calculation
    }))
    return { store, authority, business, ui, produce, request }
  }
  try {
    const first = await deadline.phase("initialize", () => open(true))
    const inner = await deadline.phase("produce-inner", () => first.produce(undefined, "inner"))
    expect(inner.status).toBe("ok")
    if (inner.status !== "ok") throw new Error(inner.reason)
    const event: CaseLedgerEvent = { id: "prior-analysis", caseRef, kind: "analysis-accepted", principalRef: "person", at,
      consideredActions: ["retain-original"], factualGaps: ["fixture-training-unresolved"], lifecycleState: "investigating",
      rationale: "Retain the earlier calculation as analysis, without applying it", evidenceRefs: [inner.value.calculation], outputDigest: digestSfValue(inner.value.result) }
    const base: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "fixture:prior-analysis",
      installationId: inner.value.calculation.installationId, projectId: inner.value.calculation.projectId, evidenceLevel: "decision", refDigest: "",
      target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: [inner.value.calculation] } }
    const eventRef = { ...base, refDigest: digestSfEvidenceRef(base) }
    const current = await first.authority.state.read(first.request(), "cases", (state) => state.versions.cases)
    if (current.status !== "ok") throw new Error("Case version unavailable")
    const ledger = await first.authority.state.transaction(first.request(), { namespace: "cases", expectedStorageVersion: current.value,
      targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "fixture-ledger", commandDigest: digestSfValue(event) }, async (state) => {
      state.cases[caseRef.id]!.ledger = [event]
      return { commit: true, value: true }
    })
    expect(ledger.status).toBe("ok")
    const outer = await deadline.phase("produce-outer", () => first.produce({ ...inner.value.input, assumptions: [{ id: "previous-analysis",
      value: "Cite the prior calculation and accepted ledger, without approving a financial assumption", state: "hypothetical", evidenceRefs: [eventRef] }] }, "outer"))
    expect(outer.status).toBe("ok")
    if (outer.status !== "ok") throw new Error(outer.reason)
    expect(outer.value.calculation.target.sourceRefs).toContainEqual(eventRef)
    expect(outer.value.result.knownSubtotal).toBe(inner.value.result.knownSubtotal)
    expect(outer.value.result.total).toBeNull()
    expect(outer.value.result.comparisonStatus).toBe("conditioned")
    first.business.dispose()
    await first.store.dispose()
    const reopened = await deadline.phase("reopen", () => open(false))
    await deadline.phase("resolve-reopened-ancestry", () => reopened.ui("sf_evidence_get", async (call) => {
      const resolved = await reopened.business.context.resolve(outer.value.calculation, call)
      expect(resolved.state).toBe("fresh")
      expect(resolved.currentRef).toEqual(outer.value.calculation)
      expect(resolved.authorizedProjection && "values" in resolved.authorizedProjection ? resolved.authorizedProjection.values.find((value) => value.id === "scenario:total")?.value : undefined).toBeNull()
      expect((await reopened.business.selectedCase(call)).status).toBe("unavailable")
      const foreignScope = await reopened.business.withCase(call, otherCaseRef, {}, () => reopened.business.calculations.issue(outer.value.calculation.target.runId, call))
      expect(foreignScope.status).not.toBe("ok")
      expect(Object.hasOwn(foreignScope, "value")).toBe(false)
    }))
    // Corrupt the actual persisted ancestor only. Its updated valid result digest
    // points back to the outer run, whose old inner reference remains intact.
    // Admission must stop this cycle before the producer replay itself starts.
    const original = await reopened.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      const stored = state.decisionResults?.[inner.value.calculation.target.runId]
      if (!stored || stored.kind !== "scenario") throw new Error("Persisted ancestor unavailable")
      const before = structuredClone(stored)
      stored.sourceRefs = [...stored.sourceRefs, outer.value.calculation]
      stored.result = { ...stored.result, sourceRefs: [...stored.result.sourceRefs, outer.value.calculation] }
      stored.resultDigest = digestSfValue(stored.result)
      return { commit: true, value: before }
    })
    await deadline.phase("reject-persisted-cycle", () => reopened.ui("sf_evidence_get", async (call) => {
      const result = await reopened.business.calculations.issue(outer.value.calculation.target.runId, call)
      expect(result.status).not.toBe("ok")
      expect(Object.hasOwn(result, "value")).toBe(false)
      expect((await reopened.business.selectedCase(call)).status).toBe("unavailable")
    }))
    await reopened.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      if (!state.decisionResults) throw new Error("Persisted results unavailable")
      state.decisionResults[original.resultRef] = original
      return { commit: true, value: undefined }
    })
    await deadline.phase("recovery-and-revocation", () => reopened.ui("sf_evidence_get", async (call) => {
      expect(await reopened.business.calculations.issue(inner.value.calculation.target.runId, call)).toEqual({ status: "ok", value: inner.value.calculation })
      control.active = false
      const refused = await reopened.business.context.resolve(outer.value.calculation, call)
      expect(refused.state).toBe("unavailable")
      expect(refused.authorizedProjection).toBeUndefined()
    }))
  } finally { await deadline.close() }
}, 120_000)
