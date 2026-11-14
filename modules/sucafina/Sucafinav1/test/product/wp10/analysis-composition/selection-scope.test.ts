import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfAnalysisSelectionScope } from "../../../../../../../apps/cli/src/sucafina-product/analysis-selection-scope.ts"
import { createSfForecastInputAdapter } from "../../../../../../../apps/cli/src/sucafina-product/forecast-input-adapter.ts"
import type { SfAnalysisPreparation } from "../../../../../../../apps/cli/src/sucafina-product/analysis-services.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { ForecastExplainInput } from "../../../../product/contracts/skill-inputs.ts"
import { handleSfForecastInput } from "../../../../product/interface/forecast-http.ts"
import { selection } from "../resident-runtime/fixture.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

// These are authority/persistence boundary fixtures, not skill outputs or native model evidence.
async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-analysis-selection-"))
  const driver = await openLocalStore(path.join(directory, "store"))
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const actor = { active: true, principal: "person", canWrite: true, now: Date.now() }
  const selectionWrites = new WeakSet<object>()
  const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy", persistence,
    grants: ["person", "other"].map((principalRef) => ({ principalRef, namespaces: ["cases", "preferences"] as const, operations: ["sf_forecast_compare"], humanActions: ["analysis.prepare"] as const })),
    analysisSelectionWrites: selectionWrites, now: () => actor.now, createId: randomUUID,
    authenticate: async (_request, scope) => actor.active && scope ? { id: actor.principal, canWrite: actor.canWrite, roles: [{ surface: scope.surface, role: "admin" }] } : null,
    environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [] }), commandIdentity: async (_request, operation, digest) => `${operation}:${digest}`,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
  const request = new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test" } })
  const seeded = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "seed-selection-case", commandDigest: digestSfValue(caseRef) }, async (state) => {
    state.cases.case = { ...caseRef, state: "draft", objective: "Review", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [], participants: ["person", "other"],
      sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Case initialization failed")
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet(), dashboardHostWrites: new WeakSet() })
  const incoming: SfAnalysisPreparation = { request: { caseRef, profileId: "sf_finance", profileVersion: "1", skillId: "sf-explicar-forecast", skillVersion: "1",
    manifestDigest: "a".repeat(64), outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_forecast_compare"], objective: "Review" }, selection: { ref: "first-human-choice" } }
  const create = () => createSfAnalysisSelectionScope({ authority, cases: business.cases, selectionWrites, skills: [incoming.request.skillId], now: () => actor.now, ttlMs: 1000 })
  const admit = async (value = incoming) => {
    const admitted = await authority.human.admit(request, "analysis.prepare", value)
    if (admitted.status !== "ok") throw new Error("Human admission unavailable")
    return admitted.value
  }
  const prepared = (value: SfAnalysisPreparation) => ({ boundaryFixture: value.selection, caseRef: value.request.caseRef })
  const prepare = (scope: ReturnType<typeof create>, value: SfAnalysisPreparation, call: TrustedUiContext) => scope.selectionScope.prepare(value, call,
    () => scope.selectionScope.verify(prepared(value), value.request, call, async () => {
      const read = await scope.read(caseRef, value.request.skillId, call)
      return read.status === "ok" ? { status: "ok", value: prepared(value) } : read
    }))
  const records = () => authority.state.read(request, "preferences", (state) => Object.entries(state.preferences).filter(([key]) => key.startsWith("sf:analysis-selection:")))
  const close = async () => { business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
  return { actor, authority, business, request, caseRef, incoming, create, admit, prepared, prepare, records, close }
}

test("exact human selections survive scope reconstruction and coexist without latest fallback", async () => {
  const state = await fixture()
  try {
    const scope = state.create()
    const first = await state.admit()
    expect(await state.prepare(scope, state.incoming, first)).toEqual({ status: "ok", value: state.prepared(state.incoming) })
    expect((await scope.read(state.caseRef, state.incoming.request.skillId, first)).status).toBe("unavailable")
    state.authority.human.finish(first)
    const secondInput = { ...state.incoming, selection: { ref: "second-human-choice" } }
    const second = await state.admit(secondInput)
    expect((await state.prepare(scope, secondInput, second)).status).toBe("ok")
    state.authority.human.finish(second)
    const restored = state.create()
    const reader = await state.admit()
    expect(await restored.selectionScope.verify(state.prepared(state.incoming), state.incoming.request, reader,
      () => restored.read(state.caseRef, state.incoming.request.skillId, reader))).toEqual({ status: "ok", value: { selection: state.incoming.selection, material: {} } })
    expect((await restored.selectionScope.verify({ boundaryFixture: "unprepared-input" }, state.incoming.request, reader, async () => ({ status: "ok", value: true }))).status).toBe("unavailable")
    const stored = await state.records()
    expect(stored.status === "ok" && stored.value.length).toBe(2)
    expect((await state.prepare(restored, state.incoming, reader)).status).toBe("ok")
    const duplicate = await state.records()
    expect(duplicate.status === "ok" && duplicate.value.length).toBe(2)
    state.authority.human.finish(reader)
  } finally { await state.close() }
})

test("read admission and a changed human payload cannot create a selection", async () => {
  const state = await fixture()
  try {
    const scope = state.create()
    const read = await state.authority.ui.admit(state.request, "sf_forecast_compare", digestSfValue(state.incoming))
    if (read.status !== "ok") throw new Error("Read admission unavailable")
    expect(await state.authority.ui.validate(read.value, "sf_forecast_compare", digestSfValue(state.incoming))).toBe(true)
    expect((await state.prepare(scope, state.incoming, read.value)).status).toBe("unavailable")
    state.authority.ui.finish(read.value)
    const call = await state.admit()
    expect((await state.prepare(scope, { ...state.incoming, selection: { ref: "altered" } }, call)).status).toBe("unavailable")
    state.authority.human.finish(call)
    state.actor.canWrite = false
    expect((await state.authority.human.admit(state.request, "analysis.prepare", state.incoming)).status).toBe("denied")
    const stored = await state.records()
    expect(stored.status === "ok" && stored.value.length).toBe(0)
  } finally { await state.close() }
})

test("generic preferences writers cannot forge or replace a prepared selection", async () => {
  const state = await fixture()
  try {
    const call = await state.admit()
    expect((await state.prepare(state.create(), state.incoming, call)).status).toBe("ok")
    const before = await state.records()
    if (before.status !== "ok" || before.value.length !== 1) throw new Error("Selection not persisted")
    const result = await state.authority.state.transaction(state.request, { namespace: "preferences", expectedStorageVersion: before.storageVersion,
      targetRef: state.caseRef.id, targetIncarnation: state.caseRef.incarnation, idempotencyKey: "forge-selection", commandDigest: digestSfValue("forged-selection") }, async (stored) => {
      stored.preferences[before.value[0]![0]] = { selection: "forged" }
      return { commit: true, value: true }
    })
    expect(result).toMatchObject({ status: "denied", reason: "analysis-selection-writer-required" })
    const after = await state.records()
    expect(after.status === "ok" && after.value).toEqual(before.value)
    state.authority.human.finish(call)
  } finally { await state.close() }
})

test("revocation while preparing prevents both the value and its durable selection", async () => {
  const state = await fixture()
  try {
    const scope = state.create()
    const call = await state.admit()
    const result = await scope.selectionScope.prepare(state.incoming, call, () => scope.selectionScope.verify(state.prepared(state.incoming), state.incoming.request, call, async () => {
      expect((await scope.read(state.caseRef, state.incoming.request.skillId, call)).status).toBe("ok")
      state.actor.active = false
      return { status: "ok", value: state.prepared(state.incoming) }
    }))
    expect(result.status).toBe("unavailable")
    state.actor.active = true
    const saved = await state.records()
    expect(saved.status === "ok" && saved.value.length).toBe(0)
    state.authority.human.finish(call)
  } finally { await state.close() }
})

test("the stored selection expires and never crosses principals or case versions", async () => {
  const state = await fixture()
  try {
    const call = await state.admit()
    expect((await state.prepare(state.create(), state.incoming, call)).status).toBe("ok")
    state.authority.human.finish(call)
    state.actor.principal = "other"
    const other = await state.admit()
    expect((await state.create().selectionScope.verify(state.prepared(state.incoming), state.incoming.request, other, async () => ({ status: "ok", value: true }))).status).toBe("unavailable")
    state.authority.human.finish(other)
    state.actor.principal = "person"
    const current = await state.admit()
    const scope = state.create()
    expect((await scope.selectionScope.verify(state.prepared(state.incoming), { ...state.incoming.request, caseRef: { ...state.caseRef, incarnation: "replacement" } }, current, async () => ({ status: "ok", value: true }))).status).toBe("unavailable")
    expect((await scope.selectionScope.verify(state.prepared(state.incoming), { ...state.incoming.request, caseRef: { ...state.caseRef, version: 2 } }, current, async () => ({ status: "ok", value: true }))).status).toBe("unavailable")
    state.actor.now += 1001
    expect((await scope.selectionScope.verify(state.prepared(state.incoming), state.incoming.request, current, async () => ({ status: "ok", value: true }))).status).toBe("unavailable")
    state.authority.human.finish(current)
  } finally { await state.close() }
})

test("verification rechecks authority after the reader awaits", async () => {
  const state = await fixture()
  try {
    const call = await state.admit()
    expect((await state.prepare(state.create(), state.incoming, call)).status).toBe("ok")
    const scope = state.create()
    const result = await scope.selectionScope.verify(state.prepared(state.incoming), state.incoming.request, call, async () => {
      const selected = await scope.read(state.caseRef, state.incoming.request.skillId, call)
      expect(selected.status).toBe("ok")
      state.actor.active = false
      return selected
    })
    expect(result.status).toBe("unavailable")
    state.authority.human.finish(call)
  } finally { await state.close() }
})

test("fresh human preparation renews an expired generation with CAS and remains idempotent", async () => {
  const state = await fixture()
  try {
    const first = await state.admit()
    expect((await state.prepare(state.create(), state.incoming, first)).status).toBe("ok")
    state.authority.human.finish(first)
    const before = await state.records()
    if (before.status !== "ok" || before.value.length !== 1) throw new Error("Selection not persisted")
    state.actor.now += 1001
    const fresh = await state.admit()
    expect((await state.create().selectionScope.verify(state.prepared(state.incoming), state.incoming.request, fresh, async () => ({ status: "ok", value: true }))).status).toBe("unavailable")
    expect((await state.prepare(state.create(), state.incoming, fresh)).status).toBe("ok")
    const after = await state.records()
    if (after.status !== "ok" || after.value.length !== 1) throw new Error("Renewed selection unavailable")
    expect(after.storageVersion).toBe(before.storageVersion + 1)
    expect(after.value[0]![0]).toBe(before.value[0]![0])
    expect(after.value[0]![1]).not.toEqual(before.value[0]![1])
    expect((await state.create().selectionScope.verify(state.prepared(state.incoming), state.incoming.request, fresh, async () => ({ status: "ok", value: true }))).status).toBe("ok")
    expect((await state.prepare(state.create(), state.incoming, fresh)).status).toBe("ok")
    const repeated = await state.records()
    expect(repeated.status === "ok" && repeated.storageVersion).toBe(after.storageVersion)
    expect(repeated.status === "ok" && repeated.value).toEqual(after.value)
    state.authority.human.finish(fresh)
  } finally { await state.close() }
})

test("a fresh human prepare renews an expired exact selection without reviving it on read", async () => {
  const state = await fixture()
  try {
    const first = await state.admit()
    expect((await state.prepare(state.create(), state.incoming, first)).status).toBe("ok")
    state.authority.human.finish(first)
    const before = await state.records()
    if (before.status !== "ok") throw new Error("Selection unavailable")
    state.actor.now += 1001
    const fresh = await state.admit()
    const scope = state.create()
    const read = () => scope.selectionScope.verify(state.prepared(state.incoming), state.incoming.request, fresh,
      () => scope.read(state.caseRef, state.incoming.request.skillId, fresh))
    expect((await read()).status).toBe("unavailable")
    const expired = await state.records()
    expect(expired.status === "ok" && expired.value).toEqual(before.value)
    expect((await state.prepare(scope, state.incoming, fresh)).status).toBe("ok")
    expect((await read()).status).toBe("ok")
    const after = await state.records()
    expect(after.status === "ok" && after.value.length).toBe(1)
    expect(after.status === "ok" && after.value[0]![0]).toEqual(before.value[0]![0])
    expect(after.status === "ok" && after.value[0]![1]).not.toEqual(before.value[0]![1])
    state.authority.human.finish(fresh)
  } finally { await state.close() }
})

// The financial payload is a deliberately empty boundary fixture. This verifies
// the old form's human admission and durable selection, never financial/native acceptance.
test("published Forecast form persists the exact canonical selection and denies changed or revoked intent", async () => {
  const state = await fixture()
  try {
    const period = { start: "2026-01-01", end: "2026-12-31" }
    const legacy = { caseRef: state.caseRef, baseRef: "baseline", candidateRef: "candidate", period, currency: "USD" }
    const runtime = selection({ id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
      allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: ["FinancialAnalysis"], contextBudgetTokens: 1000,
      maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" })
    const projection = { context: { installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "boundary", policyVersion: "policy",
      surface: "planner" as const, period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "boundary-fixture", components: [], values: [], missing: [] }
    const prepared: ForecastExplainInput = { selectedPeriod: period, currency: "USD", sourceRefs: [], registeredReasons: [], forecastComparison: {
      baseline: projection, candidate: projection, sourceRefs: [], gaps: ["Boundary fixture has no financial sources"], explanation: "Boundary fixture",
      comparison: { baselineResultRef: "baseline", alternativeResultRef: "candidate", costCoverageRefs: [], criterionResults: [], unresolvedConditions: ["No source"],
        comparisonStatus: "unavailable", knownDifference: null, completeDifference: null }, knownDifference: null, completeDifference: null, analysisBasis: "domain", domainApplied: false } }
    const scope = state.create()
    let wanted: SfAnalysisPreparation | undefined
    let calls = 0
    let revoke = false
    const adapter = createSfForecastInputAdapter({ authority: state.authority, business: state.business, selected: [runtime], inputs: { prepare: async (call, input) => {
      calls++
      wanted = structuredClone(input)
      const result = await scope.selectionScope.prepare(input, call, () => scope.selectionScope.verify(prepared, input.request, call, async () => ({ status: "ok", value: prepared })))
      if (revoke) state.actor.active = false
      return result
    } } })
    const original = await state.authority.ui.admit(state.request, "sf_forecast_compare", digestSfValue(legacy))
    if (original.status !== "ok") throw new Error("Forecast UI admission unavailable")
    expect((await adapter.prepare(original.value, legacy)).status).toBe("denied")
    expect(calls).toBe(0)
    expect(await state.authority.ui.validate(original.value, "sf_forecast_compare", digestSfValue(legacy))).toBe(true)
    expect(await adapter.prepare(original.value, legacy)).toEqual({ status: "ok", value: prepared })
    // This published handler consumes the UI lease before calling the adapter.
    // Only its two used ports are mounted here, both using the real authority and
    // adapter; the deliberately empty financial payload remains a boundary fixture.
    const consumer = { ui: state.authority.ui, forecastInputs: adapter } as Parameters<typeof handleSfForecastInput>[2]
    const httpRequest = (key: string) => new Request("https://example.test/product/forecast-input", { method: "POST",
      headers: { origin: "https://example.test", "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(legacy) })
    const response = await handleSfForecastInput(httpRequest("forecast-http-valid"), "https://example.test", consumer)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ status: "ok", value: prepared })
    expect(calls).toBe(2)
    expect(wanted?.selection).toEqual(legacy)
    expect(wanted?.request.objective).toBe("Review")
    expect(wanted?.request.manifestDigest).toBe(runtime.manifestDigest)
    const stored = await state.records()
    expect(stored.status === "ok" && stored.value.length).toBe(1)
    if (!wanted) throw new Error("Canonical preparation absent")
    const followup = await state.admit(wanted)
    const reopened = state.create()
    expect(await reopened.selectionScope.verify(prepared, wanted.request, followup, () => reopened.read(state.caseRef, wanted!.request.skillId, followup)))
      .toEqual({ status: "ok", value: { selection: legacy, material: {} } })
    state.authority.human.finish(followup)
    for (const consumed of [false, true]) {
      const changedIntent = await state.authority.ui.admit(state.request, "sf_forecast_compare", digestSfValue(legacy))
      if (changedIntent.status !== "ok") throw new Error("Changed-intent UI admission unavailable")
      if (consumed) expect(await state.authority.ui.validate(changedIntent.value, "sf_forecast_compare", digestSfValue(legacy))).toBe(true)
      expect((await adapter.prepare(changedIntent.value, { ...legacy, candidateRef: "changed-without-human-admission" })).status).toBe("denied")
      state.authority.ui.finish(changedIntent.value)
    }
    expect(calls).toBe(2)
    revoke = true
    const late = await handleSfForecastInput(httpRequest("forecast-http-revoked"), "https://example.test", consumer)
    expect(late.status).toBe(503)
    expect(await late.json()).toEqual({ status: "unavailable" })
    expect(calls).toBe(3)
    expect(state.actor.active).toBe(false)
    state.authority.ui.finish(original.value)
  } finally { await state.close() }
})
