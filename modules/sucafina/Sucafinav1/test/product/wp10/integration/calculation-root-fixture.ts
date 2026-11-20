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
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

// Reuses the real SQLite/UI/Planner fixture recipe of calculation-case-scope.
// The pending coverage is explicit fixture data, not a completeness or native
// execution claim. Hooks observe actual readers; no stored result is synthesized.
export async function calculationRootFixture(count = 0) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-calculation-root-"))
  const store = await openLocalStore(path.join(directory, "store"))
  const at = "2027-02-02T00:00:00Z"
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "calculation-case", incarnation: "calculation-inc", version: 1 }
  const otherCaseRef = { id: "other-case", incarnation: "other-inc", version: 1 }
  const control: { active: boolean; coverageReads: number; roots: number; rootCallbacks: number; rootsClosed: number;
    coverage?: (call: TrustedDomainContext) => Promise<void>; afterRoot?: () => Promise<void> } =
    { active: true, coverageReads: 0, roots: 0, rootCallbacks: 0, rootsClosed: 0 }
  const candidate = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => at) }) }
  if (typeof candidate.readSnapshotRoot !== "function" || typeof candidate.currentSnapshots !== "function") {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
    throw new Error("Real LocalStore read-root capabilities unavailable")
  }
  // Refine the actual guarded adapter in place; retain its object and methods.
  const persistence = Object.assign(candidate, {
    readSnapshotRoot: candidate.readSnapshotRoot, currentSnapshots: candidate.currentSnapshots,
  })
  const readRoot = persistence.readSnapshotRoot
  persistence.readSnapshotRoot = async (work, options) => {
    control.roots++
    const result = await readRoot(async () => { control.rootCallbacks++; return work() }, options)
    control.rootsClosed++
    await control.afterRoot?.()
    return result
  }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [{ id: "v0", name: "Calculation concurrency fixture", year: 2027, closed: 1,
      lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }], officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
  const proposalCoverageWrites = new WeakSet<object>()
  const identity = { installationId: "calculation-installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const request = (signal?: AbortSignal) => new Request("https://example.test/planner", { method: "POST", signal, headers: { origin: "https://example.test" } })
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "calculation-policy",
    persistence, proposalCoverageWrites, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_evidence_get"], humanActions: [] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  const dispose = async () => { business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  const admit = async (operation = "sf_evidence_get") => {
    const controller = new AbortController()
    const source = request(controller.signal)
    const digest = digestSfValue({})
    const admitted = await authority.ui.admit(source, operation, digest)
    if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digest)) throw new Error(`UI ${operation} unavailable`)
    return { call: admitted.value, request: source, controller }
  }
  try {
    business.bindForecastCoverage(async (reference, call) => {
      control.coverageReads++
      const source = await business.plannerSources.resolveForecastSource(reference, call)
      if (source.status !== "ok") return source
      await control.coverage?.(call)
      return { status: "ok", value: { coverageRef: "fixture:explicit-pending-coverage", basis: { id: "fixture-basis", version: 1,
        decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
        assessment: { basisId: "fixture-basis", basisVersion: 1, alternativeId: "baseline", alternativeVersion: 1, currency: "USD", horizon: period,
          issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
          entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed", commandDigest: digestSfValue([caseRef, otherCaseRef]) }, async (state) => {
      for (const selected of [caseRef, otherCaseRef]) state.cases[selected.id] = { ...selected, state: "investigating", objective: "Calculation concurrency fixture", horizon: period,
        currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error("Cases unavailable")
    const calculations: Extract<BusinessEvidenceRef, { kind: "calculation" }>[] = []
    // Distinct real stored runs: the foreign calculation reader intentionally
    // rejects a concurrent replay of the SAME run/binding as a recursive cycle.
    // This test preserves that guard and exercises permitted same-case overlap.
    for (let index = 0; index < count; index++) {
      const producer = await admit("sf_scenario_simulate")
      try {
        const produced = await business.withCase(producer.call, caseRef, {}, async () => {
          const source = await business.plannerProduct.issueSource("v0", producer.call)
          if (source.status !== "ok") return source
          const scenario = { baseRef: source.value.evidence.refId, operations: [], assumptions: [] }
          const result = await business.planner.simulateScenario(scenario, producer.call)
          if (result.status !== "ok") return result
          const saved = await business.calculations.persist({ kind: "scenario", request: scenario, result: result.value }, `scenario-fixture-${index}`, producer.call)
          return saved.status === "ok" ? business.calculations.issue(saved.value.resultRef, producer.call) : saved
        })
        if (produced.status !== "ok") throw new Error(`Real calculation fixture unavailable: ${produced.reason}`)
        calculations.push(produced.value)
      } finally { authority.ui.finish(producer.call) }
    }
    if (new Set(calculations.map((value) => value.target.runId)).size !== count) throw new Error("Distinct stored calculation runs required")
    return { authority, business, control, caseRef, otherCaseRef, calculations, persistence, store, admit, dispose }
  } catch (error) { await dispose(); throw error }
}
