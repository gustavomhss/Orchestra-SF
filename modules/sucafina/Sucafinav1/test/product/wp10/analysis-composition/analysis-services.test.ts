import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfAnalysisServices } from "../../../../../../../apps/cli/src/sucafina-product/analysis-services.ts"
import type { SfAnalysisPair, SfAnalysisPreparation } from "../../../../../../../apps/cli/src/sucafina-product/analysis-services.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ResidentProfile } from "../../../../product/contracts/resident-ai.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { selection } from "../resident-runtime/fixture.ts"

const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
  allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: ["FinancialAnalysis"], contextBudgetTokens: 1000,
  maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
const runtime = selection(profile)

async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-analysis-composition-"))
  const driver = await openLocalStore(path.join(directory, "store"))
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const actor = { active: true, producerCalls: 0, verifierCalls: 0, revokeAfterPrepare: false, alterPreparedSelection: false }
  const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy", persistence,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences"], operations: ["sf_forecast_compare"], humanActions: ["analysis.prepare"] }],
    now: Date.now, createId: randomUUID, authenticate: async (_request, scope) => actor.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null,
    environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [] }), commandIdentity: async () => "analysis-test-selection",
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
  const request = new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test" } })
  const seeded = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "seed-analysis-case", commandDigest: digestSfValue(caseRef) }, async (state) => {
    state.cases.case = { ...caseRef, state: "draft", objective: "Review", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [], participants: ["person"],
      sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Synthetic case initialization failed")
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet(), dashboardHostWrites: new WeakSet() })
  // This pair only exercises the host admission boundary. It is never native/runtime evidence.
  const pair: SfAnalysisPair = {
    producer: { skillIds: ["sf-explicar-forecast"], prepare: async (value) => {
      actor.producerCalls++
      if (actor.revokeAfterPrepare) actor.active = false
      if (actor.alterPreparedSelection && value && typeof value === "object") Object.assign(value, { changed: true })
      return { status: "ok", value }
    } },
    verifier: { skillIds: ["sf-explicar-forecast"], verify: async (value, incoming, call) => {
      actor.verifierCalls++
      const current = await business.cases.read({ caseRef: encodeCaseRef(incoming.caseRef) }, call)
      return current.status === "ok" ? { status: "ok", value: { current: current.value.case, input: value, sources: [], acceptsOutput: async () => ({ status: "unavailable", reason: "no-native-proof-in-boundary-fixture" }) } } : current
    } },
  }
  const dependencies = { cases: business.cases, planner: business.planner, procurement: business.procurement, context: business.context, host: authority.host }
  const create = (enabled = true) => createSfAnalysisServices({ dependencies, selected: [runtime], bindings: enabled ? { forecast: pair } : {},
    authorizeSelection: (call, incoming) => authority.human.authorize(call, "analysis.prepare", incoming) })
  const incoming: SfAnalysisPreparation = { request: { caseRef, profileId: profile.id, profileVersion: profile.version, skillId: "sf-explicar-forecast", skillVersion: "1",
    manifestDigest: runtime.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_forecast_compare"], objective: "Review" }, selection: { ref: "selected-by-human" } }
  const close = async () => { business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
  return { actor, authority, business, request, incoming, create, close }
}

test("analysis input rejects a read lease and a different human payload before producer access", async () => {
  const state = await fixture()
  try {
    const service = state.create()
    const read = await state.authority.ui.admit(state.request, "sf_forecast_compare", digestSfValue(state.incoming))
    expect(read.status).toBe("ok")
    if (read.status !== "ok") return
    expect((await service.prepare(read.value, state.incoming)).status).toBe("denied")
    state.authority.ui.finish(read.value)
    const admitted = await state.authority.human.admit(state.request, "analysis.prepare", state.incoming)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    expect((await service.prepare(admitted.value, { ...state.incoming, selection: { ref: "changed" } })).status).toBe("denied")
    expect(state.actor.producerCalls).toBe(0)
    state.authority.human.finish(admitted.value)
  } finally { await state.close() }
})

test("a missing factory is unavailable and a stale case does not reach the producer", async () => {
  const state = await fixture()
  try {
    const admitted = await state.authority.human.admit(state.request, "analysis.prepare", state.incoming)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    expect(state.create(false).discovery()).toEqual([{ skillId: "sf-explicar-forecast", status: "unavailable" }])
    expect(await state.create(false).prepare(admitted.value, state.incoming)).toMatchObject({ status: "unavailable", reason: "analysis-skill-binding-unavailable" })
    state.authority.human.finish(admitted.value)
    const stale = { ...state.incoming, request: { ...state.incoming.request, caseRef: { ...state.incoming.request.caseRef, version: 2 } } }
    const next = await state.authority.human.admit(state.request, "analysis.prepare", stale)
    expect(next.status).toBe("ok")
    if (next.status !== "ok") return
    expect((await state.create().prepare(next.value, stale)).status).toBe("unavailable")
    expect(state.actor.producerCalls).toBe(0)
    state.authority.human.finish(next.value)
  } finally { await state.close() }
})

test("the current human choice is prepared but revocation during preparation prevents its return", async () => {
  const state = await fixture()
  try {
    const admitted = await state.authority.human.admit(state.request, "analysis.prepare", state.incoming)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    const service = state.create()
    expect(await service.prepare(admitted.value, state.incoming)).toEqual({ status: "ok", value: state.incoming.selection })
    expect(state.actor.producerCalls).toBe(1)
    expect(state.actor.verifierCalls).toBe(1)
    state.actor.revokeAfterPrepare = true
    expect((await service.prepare(admitted.value, state.incoming)).status).toBe("unavailable")
    expect(state.actor.producerCalls).toBe(2)
    expect(state.actor.verifierCalls).toBe(1)
    state.authority.human.finish(admitted.value)
  } finally { await state.close() }
})

test("a producer cannot rewrite the human choice while obtaining a valid proof", async () => {
  const state = await fixture()
  try {
    const admitted = await state.authority.human.admit(state.request, "analysis.prepare", state.incoming)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    state.actor.alterPreparedSelection = true
    expect((await state.create().prepare(admitted.value, state.incoming)).status).toBe("unavailable")
    expect(state.incoming.selection).toEqual({ ref: "selected-by-human" })
    state.authority.human.finish(admitted.value)
  } finally { await state.close() }
})

test("case reads reject an operation whose hidden target has no authorized source", async () => {
  const state = await fixture()
  try {
    const admitted = await state.authority.human.admit(state.request, "analysis.prepare", state.incoming)
    if (admitted.status !== "ok") throw new Error("Human authority missing")
    const before = await state.authority.state.read(state.request, "cases", (stored) => stored.versions.cases)
    if (before.status !== "ok") throw new Error("Case authority missing")
    const inserted = await state.authority.state.transaction(state.request, { namespace: "cases", expectedStorageVersion: before.value,
      targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "hidden-operation", commandDigest: digestSfValue("hidden-operation") }, async (stored) => {
      const current = stored.cases.case!
      const result = { id: "hidden-result", version: 1, components: [], currency: "USD", horizon: current.horizon, sourceRefs: [], unresolvedConditions: [], restrictions: [],
        comparisonStatus: "conditioned" as const, total: null, knownSubtotal: null,
        costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "hidden", alternativeVersion: 1, currency: "USD", horizon: current.horizon,
          issues: [], evaluatedSourceRefs: [], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: ["service"] } }
      current.alternatives = [{ id: "hidden", version: 1, title: "Hidden target", scenario: { baseRef: "unissued-planner-source", operations: [{ kind: "exclude", targetRef: "restricted-row" }], assumptions: [] }, result }]
      return { commit: true, value: true }
    })
    expect(inserted.status).toBe("ok")
    expect(await state.business.cases.read({ caseRef: encodeCaseRef(state.incoming.request.caseRef) }, admitted.value))
      .toMatchObject({ status: "unavailable", reason: "case-evidence-unavailable" })
    state.authority.human.finish(admitted.value)
  } finally { await state.close() }
})
