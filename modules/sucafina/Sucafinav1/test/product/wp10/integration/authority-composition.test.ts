import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase, ScenarioResult } from "../../../../product/contracts/decisions.ts"
import type { PreparedCommand } from "../../../../product/contracts/context.ts"
import type { SfProductState, SfStateMutation } from "../../../../product/contracts/state.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { testPersistence } from "../../../fixture/persistence.ts"

const request = () => new Request("https://example.test/product")
const command: SfStateMutation = { namespace: "preferences", expectedStorageVersion: 0, targetRef: "target", targetIncarnation: "incarnation", idempotencyKey: "write", commandDigest: "a".repeat(64) }

test("composition write capabilities protect both prefixes and cannot authorize each other's writes", async () => {
  const storage = testPersistence()
  const dashboardHostWrites = new WeakSet<object>()
  const procurementEvidenceWrites = new WeakSet<object>()
  const state = createSfProductState({ persistence: storage.persistence, dashboardHostWrites, procurementEvidenceWrites,
    authorize: async () => ({ principalRef: "person", accessRevision: "access", policyVersion: "policy" }),
    createId: () => "state", resolveTarget: async () => ({ incarnation: command.targetIncarnation }) })
  const dashboard = async (value: SfProductState) => {
    value.preferences["sf:dashboard-host:prepared:change"] = { revision: 1 }
    return { commit: true, value: "dashboard" }
  }
  const procurement = async (value: SfProductState) => {
    value.preferences["sf:procurement-evidence:selection"] = { revision: 1 }
    return { commit: true, value: "procurement" }
  }
  expect(await state.transaction(request(), command, dashboard)).toMatchObject({ status: "denied", reason: "dashboard-host-write-outside-authority" })
  expect(await state.transaction(request(), command, procurement)).toMatchObject({ status: "denied", reason: "procurement-evidence-write-outside-authority" })
  dashboardHostWrites.add(procurement)
  expect(await state.transaction(request(), command, procurement)).toMatchObject({ status: "denied", reason: "procurement-evidence-write-outside-authority" })
  dashboardHostWrites.delete(procurement)
  dashboardHostWrites.add(dashboard)
  expect(await state.transaction(request(), command, (value) => dashboard(value))).toMatchObject({ status: "denied", reason: "dashboard-host-write-outside-authority" })
  expect(await state.transaction(request(), command, dashboard)).toMatchObject({ status: "ok", storageVersion: 1 })
  procurementEvidenceWrites.add(procurement)
  expect(await state.transaction(request(), { ...command, expectedStorageVersion: 1, idempotencyKey: "procurement" }, procurement)).toMatchObject({ status: "ok", storageVersion: 2 })
  expect(await state.read(request(), "preferences", (value) => value.preferences)).toMatchObject({ status: "ok", value: {
    "sf:dashboard-host:prepared:change": { revision: 1 }, "sf:procurement-evidence:selection": { revision: 1 },
  } })
})

test("a Dashboard host capability does not bypass earlier protected preferences or the BI namespace", async () => {
  const storage = testPersistence()
  const dashboardHostWrites = new WeakSet<object>()
  const state = createSfProductState({ persistence: storage.persistence, dashboardHostWrites,
    authorize: async () => ({ principalRef: "person", accessRevision: "access", policyVersion: "policy" }),
    createId: () => "state", resolveTarget: async () => ({ incarnation: command.targetIncarnation }) })
  for (const [prefix, reason] of [
    ["sf:native-session:", "native-evidence-write-outside-authority"],
    ["sf:portfolio:campaign:", "proposal-coverage-write-outside-authority"],
    ["sf:memory-condition:", "signal-registry-write-outside-authority"],
    ["sf:case-work-selection:", "case-selection-write-outside-authority"],
  ]) {
    const work = async (value: SfProductState) => {
      value.preferences[`${prefix}forged`] = true
      return { commit: true, value: true }
    }
    dashboardHostWrites.add(work)
    expect(await state.transaction(request(), command, work)).toMatchObject({ status: "denied", reason })
  }
  const crossNamespace = async (value: SfProductState) => {
    value.biArtifacts = undefined
    return { commit: true, value: true }
  }
  dashboardHostWrites.add(crossNamespace)
  expect(await state.transaction(request(), command, crossNamespace)).toMatchObject({ status: "denied", reason: "namespace-write-outside-authority" })
  expect(storage.state.dashboard.data.__sfProductV1).toBeUndefined()
})

test("target revalidation receives the same command at admission, commit and receipt retry", async () => {
  const storage = testPersistence()
  const observed: SfStateMutation[] = []
  const state = createSfProductState({ persistence: storage.persistence,
    authorize: async () => ({ principalRef: "person", accessRevision: "access", policyVersion: "policy" }), createId: () => "state",
    resolveTarget: async (_request, _snapshot, _namespace, _target, selected) => { observed.push(selected); return { incarnation: command.targetIncarnation } } })
  expect(await state.transaction(request(), command, async () => ({ commit: true, value: true }))).toMatchObject({ status: "ok" })
  expect(await state.transaction(request(), command, async () => { throw new Error("retry must not execute") })).toMatchObject({ status: "ok" })
  expect(observed).toHaveLength(4)
  expect(observed.every((value) => value === command)).toBe(true)
})

async function fixture(work: (value: Awaited<ReturnType<typeof authorityFixture>>) => Promise<void>) {
  const value = await authorityFixture()
  try { await work(value) } finally { await value.store.dispose(); await rm(value.directory, { recursive: true, force: true }) }
}

async function authorityFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-authority-composition-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(join(directory, "store"))
  const actor = { active: true, writable: true }
  const dashboardHostWrites = new WeakSet<object>()
  const prepared = { active: false, calls: 0 }
  const product = createSfProductAuthority({ installationId: "installation", origin: "https://example.test", policyVersion: "policy",
    identity: () => ({ installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    persistence: store, dashboardHostWrites, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "receipts"], operations: [], humanActions: ["decisions.apply"] }],
    createId: () => "state", now: Date.now, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }),
    authenticate: async (_request, context) => !actor.active || !context ? null : { id: "person", canWrite: actor.writable, roles: [{ surface: context.surface, role: "contributor" }] },
    commandIdentity: async () => "command", inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => 1, authorizeDocument: async () => undefined,
    authorizePreparedTarget: async (_request, _snapshot, target) => { prepared.calls += 1; return prepared.active && target === "domain-target" ? { incarnation: "domain-incarnation" } : undefined } })
  return { directory, store, product, actor, dashboardHostWrites, prepared }
}

function caseFixture(): DecisionCase {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const target = { surface: "dashboard" as const, type: "hotTopics", id: "domain-target", incarnation: "domain-incarnation", version: 1, fields: ["title"], period, observedAt: "2026-11-13T00:00:00Z" }
  const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period,
    issues: ["Pending"], evaluatedSourceRefs: [], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: ["service"] }
  const result: ScenarioResult = { id: "result", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [], unresolvedConditions: ["Pending"], restrictions: [],
    comparisonStatus: "conditioned", costCoverage: coverage, knownSubtotal: null, total: null }
  const operation: PreparedCommand = { id: "operation", target, command: { page: "hotTopics", action: "update", id: target.id, version: 1, values: { title: "Updated" } },
    idempotencyKey: "domain-command", commandDigest: "b".repeat(64), expectedVersion: 1, requiredAuthority: ["contributor"], preview: { context: {
      installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "access", policyVersion: "policy", surface: "dashboard", period, currency: "USD", sourceRefs: [target], capabilities: [] },
      version: 1, engineVersion: "fixture", components: [], values: [], missing: [] } }
  return { id: "domain-target", incarnation: "case-incarnation", version: 1, state: "chosen", objective: "Update", horizon: period, currency: "USD", criteria: [], participants: ["person"],
    sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], receipts: [], ledger: [],
    choices: [{ id: "choice", alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [], principalRef: "person", reason: "Synthetic", at: "2026-11-13T00:00:00Z",
      scenario: { baseRef: "base", operations: [], assumptions: [] }, result, comparison: { baselineResultRef: "base", alternativeResultRef: "result", costCoverageRefs: [], criterionResults: [], unresolvedConditions: ["Pending"], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null },
      comparisonStatus: "conditioned", costCoverage: coverage }],
    preparedChanges: [{ id: "change", caseId: "domain-target", caseVersion: 1, choiceId: "choice", target, expectedVersion: 1, operation, preview: result, requiredAuthority: ["contributor"], idempotencyKey: "domain-command", state: "planned" }] }
}

test("domain receipt targets cannot borrow a case with the same ID and require the current prepared binding", async () => {
  await fixture(async ({ product, dashboardHostWrites, store }) => {
    const decision = caseFixture()
    expect(await product.state.transaction(request(), { ...command, namespace: "cases", targetRef: product.creationTarget.ref, targetIncarnation: product.creationTarget.incarnation }, async (state) => {
      state.cases[decision.id] = decision
      return { commit: true, value: true }
    })).toMatchObject({ status: "ok" })
    const receipt: SfStateMutation = { ...command, namespace: "receipts", domainSurface: "dashboard", targetRef: decision.id,
      targetIncarnation: decision.preparedChanges[0]!.target.incarnation, idempotencyKey: "prepared:domain-command" }
    const run = async () => ({ commit: true, value: "receipt" })
    expect(await product.state.transaction(request(), { ...receipt, targetIncarnation: decision.incarnation }, run)).toMatchObject({ status: "denied", reason: "target-access-unavailable" })
    const binding = async (state: SfProductState, authority: { principalRef: string; accessRevision: string; policyVersion: string }) => {
      const value = { schema: "sf-dashboard-prepared-binding-v1", caseRef: { id: decision.id, incarnation: decision.incarnation, version: decision.version },
        changeId: "change", choiceId: "choice", choiceDigest: digestSfValue(decision.choices[0]), command: decision.preparedChanges[0]!.operation, ...authority }
      state.preferences["sf:dashboard-host:prepared:change"] = { ...value, recordDigest: digestSfValue(value) }
      return { commit: true, value: true }
    }
    dashboardHostWrites.add(binding)
    expect(await product.state.transaction(request(), { ...command, targetRef: decision.id, targetIncarnation: decision.incarnation }, binding)).toMatchObject({ status: "ok" })
    expect(await product.state.transaction(request(), { ...receipt, idempotencyKey: "prepared:other" }, run)).toMatchObject({ status: "denied" })
    expect(await product.state.transaction(request(), receipt, run)).toMatchObject({ status: "ok", value: "receipt" })
    await store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases[decision.id] = { ...decision, participants: ["other"] }
      return { commit: true, value: undefined }
    })
    expect(await product.state.transaction(request(), receipt, async () => { throw new Error("revoked retry") })).toMatchObject({ status: "denied", reason: "target-access-unavailable" })
  })
})

test("Procurement receipt authority is live, domain-specific and checked again on retries", async () => {
  await fixture(async ({ product, prepared, actor }) => {
    const receipt: SfStateMutation = { ...command, namespace: "receipts", domainSurface: "procurement", targetRef: "domain-target", targetIncarnation: "domain-incarnation" }
    const run = async () => ({ commit: true, value: "sensitive-receipt" })
    expect(await product.state.transaction(request(), receipt, run)).toMatchObject({ status: "denied" })
    prepared.active = true
    expect(await product.state.transaction(request(), { ...receipt, domainSurface: "dashboard" }, run)).toMatchObject({ status: "denied" })
    expect(prepared.calls).toBe(1)
    expect(await product.state.transaction(request(), receipt, run)).toMatchObject({ status: "ok", value: "sensitive-receipt" })
    prepared.active = false
    expect(await product.state.transaction(request(), receipt, async () => { throw new Error("revoked retry") })).toMatchObject({ status: "denied" })
    expect(await product.humanActions(request())).toEqual(["decisions.apply"])
    actor.writable = false
    expect(await product.humanActions(request())).toEqual([])
  })
})
