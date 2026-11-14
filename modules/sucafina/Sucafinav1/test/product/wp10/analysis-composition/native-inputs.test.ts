import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionSchema } from "@orchestra/core/session/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDecisionDomainServices } from "../../../../../../../apps/cli/src/sucafina-product/decision-domain-services.ts"
import { createSfDecisionDomainHttp } from "../../../../../../../apps/cli/src/sucafina-product/decision-domain-http.ts"
import { createSfNativeAnalysisInputs, createSfAlternativeRunState } from "../../../../../../../apps/cli/src/sucafina-product/analysis-native-inputs.ts"
import type { SfAdmittedAnalysisInput } from "../../../../../../../apps/cli/src/sucafina-product/analysis-native-inputs.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ResidentProfile, SkillLoadReceipt } from "../../../../product/contracts/resident-ai.ts"
import type { SfProductStatePort } from "../../../../product/contracts/state.ts"
import type { TrustedExecutionBinding } from "../../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { selection } from "../resident-runtime/fixture.ts"

// Session metadata and receipts are explicit boundary fixtures. No model, skill loader or native execution is claimed.
async function fixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-native-input-authority-"))
  const driver = await openLocalStore(path.join(directory, "store"))
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const control: { active: boolean; revokeDuringAuthentication: boolean; binding?: TrustedExecutionBinding } = { active: true, revokeDuringAuthentication: false }
  const proposalCoverageWrites = new WeakSet<object>()
  const nativePublicationGuards = new WeakMap<object, () => boolean>()
  const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const request = new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test" } })
  const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Finance", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
    allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: ["FinancialAnalysis"], contextBudgetTokens: 1000,
    maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
  const selected = selection(profile)
  const sessionID = SessionSchema.ID.make("ses_native_input_boundary")
  const receipt: SkillLoadReceipt = { runId: "run", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version, profileDigest: profile.sourceDigest,
    skillId: "sf-explicar-forecast", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "msg_boundary",
    loadedAt: "2026-11-14T00:00:00Z", manifestDigest: selected.manifestDigest }
  const session = Schema.decodeUnknownSync(SessionSchema.Info)({ id: sessionID, projectID: identity.projectId, agent: profile.id, location: identity.location,
    model: { providerID: "openai", id: "model" }, cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
    time: { created: Date.now(), updated: Date.now() }, title: "Authority boundary fixture" })
  const authority: ReturnType<typeof createSfProductAuthority> = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "policy", persistence,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions"], operations: ["sf_forecast_compare"], humanActions: [] }],
    proposalCoverageWrites, nativePublicationGuards, now: Date.now, createId: randomUUID,
    authenticate: async (_request, scope) => {
      if (control.revokeDuringAuthentication && control.binding) { authority.native.revoke(control.binding); control.revokeDuringAuthentication = false }
      return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null
    },
    environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [] }), commandIdentity: async (_request, operation, digest) => `${operation}:${digest}`,
    inspectSession: async (id) => id === sessionID ? session : undefined,
    verifySelection: async (value) => digestSfValue(value) === digestSfValue(selected),
    verifySkillReceipt: async (value) => value.sessionID === sessionID && value.runId === receipt.runId && digestSfValue(value.skillReceipts) === digestSfValue([receipt]),
    providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
  const created = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "case", commandDigest: digestSfValue(caseRef) }, async (state) => {
    state.cases.case = { ...caseRef, state: "draft", objective: "Boundary", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [], participants: ["person"],
      sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (created.status !== "ok") throw new Error("C08 case initialization failed")
  const admitted: SfAdmittedAnalysisInput = { request: { caseRef, profileId: profile.id, profileVersion: profile.version, skillId: receipt.skillId, skillVersion: receipt.skillVersion,
    manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_forecast_compare"], objective: "Boundary", contextFingerprint: "fixture-context" },
    input: { selectedByHuman: "boundary-fixture" } }
  const principal = await authority.state.read(request, "contributions", (_state, actor) => actor)
  if (principal.status !== "ok") throw new Error("Contributions authority unavailable")
  const seeded = await authority.state.transaction(request, { namespace: "contributions", expectedStorageVersion: principal.storageVersion, targetRef: caseRef.id,
    targetIncarnation: caseRef.incarnation, idempotencyKey: "run", commandDigest: digestSfValue(admitted) }, async (state) => {
    state.nativeRuns ??= {}
    state.nativeRuns.run = { schema: "sf-native-run-v1", runRef: "run", version: 1, requestDigest: digestSfValue(admitted.request), skillInputDigest: digestSfValue(admitted.input),
      principalRef: "person", accessRevision: principal.value.accessRevision, policyVersion: principal.value.policyVersion, caseRef, selection: selected,
      model: { providerID: "openai", id: "model" }, skillId: receipt.skillId, objective: admitted.request.objective, contextFingerprint: admitted.request.contextFingerprint,
      createdAt: "2026-11-14T00:00:00Z", updatedAt: "2026-11-14T00:00:00Z", state: "preparing" }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("C08 run initialization failed")
  const bound = await authority.native.bind({ request, selected, sessionID, runId: "run", caseRef, profile, manifestDigest: selected.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
  if (bound.status !== "ok") throw new Error(`Boundary binding unavailable: ${bound.reason}`)
  control.binding = bound.value
  const recorded = await authority.state.transaction(request, { namespace: "contributions", expectedStorageVersion: seeded.storageVersion, targetRef: caseRef.id,
    targetIncarnation: caseRef.incarnation, idempotencyKey: "queued", commandDigest: digestSfValue(receipt) }, async (state) => {
    const run = state.nativeRuns?.run
    if (!run) return { commit: false, value: false }
    state.nativeRuns!.run = { ...run, version: 2, state: "running", native: { sessionID, skillReceipt: receipt } }
    return { commit: true, value: true }
  })
  if (recorded.status !== "ok") throw new Error("C08 running fixture unavailable")
  // Tool.Context fields outside identity are irrelevant to this boundary; no Tool or model is executed.
  const tool = { sessionID, agent: profile.id, assistantMessageID: "msg_capability", toolCallID: "call_boundary" } as Parameters<typeof authority.native.lease>[0]
  const digest = digestSfValue({ boundary: true })
  const leased = await authority.native.lease(tool, "sf_forecast_compare", digest)
  if (leased.status !== "ok" || !authority.native.consume(leased.value, "sf_forecast_compare", digest)) throw new Error("Real one-use capability lease unavailable")
  const call = leased.value
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  const readers = createSfNativeAnalysisInputs({ authority, selectedCase: business.selectedCase, requestForRun: (id) => id === "run" ? request : undefined,
    admittedInput: (id) => id === "run" ? admitted : undefined, captures: () => [], revalidateCapture: async () => false })
  const snapshot = () => authority.state.read(request, "contributions", (state) => ({ run: state.nativeRuns?.run, preferences: state.preferences, version: state.revision }))
  const versions = async () => {
    const value = await authority.state.read(request, "contributions", (state) => state.versions)
    if (value.status !== "ok") throw new Error("Current storage versions unavailable")
    return value.value
  }
  const close = async () => { authority.native.finish(call); authority.native.revoke(bound.value); business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
  return { authority, business, request, caseRef, call, admitted, readers, control, proposalCoverageWrites, nativePublicationGuards, snapshot, versions, close }
}

test("native input reader requires an exact consumed lease, stored run and admitted input, and observes revocation", async () => {
  const state = await fixture()
  try {
    expect(await state.readers.verifiedInputFor(state.call)).toEqual({ status: "ok", value: state.admitted.input })
    const ui = await state.authority.ui.admit(state.request, "sf_forecast_compare", digestSfValue({ boundary: true }))
    if (ui.status !== "ok") throw new Error("UI admission unavailable")
    expect((await state.readers.verifiedInputFor(ui.value)).status).toBe("unavailable")
    state.authority.ui.finish(ui.value)
    const forged = { ...state.call, binding: { ...state.call.binding, runId: "forged-run" } }
    expect((await state.readers.verifiedInputFor(forged)).status).toBe("unavailable")
    const original = state.admitted.input
    state.admitted.input = { selectedByModel: "different" }
    expect((await state.readers.verifiedInputFor(state.call)).status).toBe("unavailable")
    state.admitted.input = original
    expect((await state.readers.verifiedInputFor(state.call)).status).toBe("ok")
    state.authority.native.revoke(state.call.binding)
    expect((await state.readers.verifiedInputFor(state.call)).status).toBe("unavailable")
  } finally { await state.close() }
})

test("alternative publication adapter cannot grant arbitrary preferences or provenance writes and clears both private guards", async () => {
  const state = await fixture()
  try {
    const callbacks: object[] = []
    const observed: SfProductStatePort = { ...state.authority.state, transaction: (request, command, work) => {
      callbacks.push(work)
      expect(state.proposalCoverageWrites.has(work)).toBe(true)
      expect(state.nativePublicationGuards.has(work)).toBe(true)
      return state.authority.state.transaction(request, command, work)
    } }
    const scoped = createSfAlternativeRunState({ state: observed, proposalCoverageWrites: state.proposalCoverageWrites, nativePublicationGuards: state.nativePublicationGuards,
      runRef: "run", captures: () => [], captureCurrent: () => false })
    const before = await state.snapshot()
    for (const name of ["ordinary-preference", "sf:proposal-coverage:alternative-provenance:forged"]) {
      const versions = await state.versions()
      const result = await scoped.transaction(state.request, { namespace: "contributions", expectedStorageVersion: versions.contributions,
        additionalNamespaces: [{ namespace: "preferences", expectedStorageVersion: versions.preferences }], sourceFence: "all", targetRef: state.caseRef.id,
        targetIncarnation: state.caseRef.incarnation, idempotencyKey: name, commandDigest: digestSfValue(name) }, async (stored) => {
        stored.preferences[name] = { forged: true }
        return { commit: true, value: true }
      })
      expect(result.status).not.toBe("ok")
      expect(callbacks.every((work) => !state.proposalCoverageWrites.has(work) && !state.nativePublicationGuards.has(work))).toBe(true)
      expect(await state.snapshot()).toEqual(before)
    }
    const versions = await state.versions()
    const outside = await scoped.transaction(state.request, { namespace: "cases", expectedStorageVersion: versions.cases,
      additionalNamespaces: [{ namespace: "preferences", expectedStorageVersion: versions.preferences }], sourceFence: "all", targetRef: state.caseRef.id,
      targetIncarnation: state.caseRef.incarnation, idempotencyKey: "wrong-namespace", commandDigest: digestSfValue("wrong-namespace") }, async () => ({ commit: true, value: true }))
    expect(outside).toMatchObject({ status: "denied", reason: "alternative-publication-scope-invalid" })
    expect(callbacks.length).toBe(2)
  } finally { await state.close() }
})

test("the C08 final publication guard rejects native revocation during authentication after the work callback", async () => {
  const state = await fixture()
  try {
    const before = await state.snapshot()
    const versions = await state.versions()
    const work: Parameters<SfProductStatePort["transaction"]>[2] = async (stored) => {
      stored.preferences["late-publication-marker"] = "must-not-commit"
      state.control.revokeDuringAuthentication = true
      return { commit: true, value: true }
    }
    state.nativePublicationGuards.set(work, () => state.authority.native.requestFor(state.call) === state.request)
    try {
      const result = await state.authority.state.transaction(state.request, { namespace: "contributions", expectedStorageVersion: versions.contributions,
        additionalNamespaces: [{ namespace: "preferences", expectedStorageVersion: versions.preferences }], sourceFence: "all", targetRef: state.caseRef.id,
        targetIncarnation: state.caseRef.incarnation, idempotencyKey: "late-revocation", commandDigest: digestSfValue("late-revocation") }, work)
      expect(result).toMatchObject({ status: "denied", reason: "native-publication-authority-changed" })
      expect(await state.snapshot()).toEqual(before)
      expect(state.authority.native.requestFor(state.call)).toBeUndefined()
    } finally { state.nativePublicationGuards.delete(work) }
  } finally { await state.close() }
})

test("decision registry HTTP routes reject malformed or foreign-origin inputs and never upgrade a read grant", async () => {
  const state = await fixture()
  const domain = createSfDecisionDomainServices({ authority: state.authority, business: state.business, baseline: state.business.baselineCoverage,
    proposalCoverageWrites: state.proposalCoverageWrites, signalRegistryWrites: new WeakSet(), selectedCase: state.business.selectedCase })
  try {
    const http = createSfDecisionDomainHttp({ origin: "https://example.test", mount: "/sf", runtime: () => ({ authority: state.authority, business: state.business, domain }) })
    const request = (mode: string, payload: unknown, origin = "https://example.test") => new Request(`https://example.test/sf/planner?sf=${mode}`,
      { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(payload) })
    for (const mode of ["decision-coverage", "decision-criteria", "decision-select-portfolio", "decision-condition"]) {
      expect((await http(request(mode, {}), "planner"))?.status).toBe(400)
      expect((await http(request(mode, {}, "https://foreign.test"), "planner"))?.status).toBe(403)
    }
    const before = await state.snapshot()
    const criterion = { caseRef: state.caseRef, criterionId: "cost", metricRef: "planner:known-subtotal-difference", operator: "lte", value: 100,
      unit: "USD", period: { start: "2026-01-01", end: "2026-12-31" }, evidenceRefs: [], expectedRuleVersion: 0 }
    const attempted = await http(request("decision-criteria", criterion), "planner")
    expect(attempted?.status).toBe(403)
    expect(attempted?.headers.get("Cache-Control")).toBe("no-store")
    expect(await state.snapshot()).toEqual(before)
  } finally { domain.dispose(); await state.close() }
})
