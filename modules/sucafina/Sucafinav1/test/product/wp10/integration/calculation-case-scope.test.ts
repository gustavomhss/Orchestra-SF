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
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

// Real SQLite/C08, admitted UI context, Planner engine, source issuer and stored
// calculation replay. Pending cost coverage is explicit fixture data. Gates only
// delay real completed C08 reads / the fixture coverage provider; they do not
// replace authorization, source validation, computation or stored requests.
// This is a composition/concurrency proof, not a native model or Atlas acceptance.
test("concurrent calculation admissions retain one case scope across two real replays and release it after the last replay", async () => {
  const fixture = await calculationFixture()
  const { authority, business } = fixture
  const lease = await fixture.admit()
  const reads = [gate(), gate()]
  const coverage = [gate(), gate()]
  const read = authority.state.read
  let readIndex = 0
  let coverageIndex = 0
  // Only the initial raw membership projection returns boolean true. Hold its
  // already-authenticated result outside the transaction so both admissions see
  // no binding, reproducing the held/read/await ownership window deterministically.
  authority.state.read = async (request, namespace, projection) => {
    const result = await read(request, namespace, projection)
    if (request === lease.request && namespace === "cases" && result.status === "ok" && result.value === true && readIndex < reads.length) {
      const held = reads[readIndex++]!
      held.enter()
      await held.released
    }
    return result
  }
  fixture.control.coverage = async (call) => {
    if (call !== lease.call || coverageIndex >= coverage.length) return
    const held = coverage[coverageIndex++]!
    held.enter()
    await held.released
  }
  const first = business.calculations.issue(fixture.calculation.target.runId, lease.call)
  let second: ReturnType<typeof business.calculations.issue> | undefined
  try {
    await reached(reads[0]!.entered, first)
    second = business.calculations.issue(fixture.otherCalculation.target.runId, lease.call)
    await reached(reads[1]!.entered, second)
    reads[0]!.release()
    await reached(coverage[0]!.entered, first)
    reads[1]!.release()
    await reached(coverage[1]!.entered, second)
    expect(readIndex).toBe(2)
    expect((await business.selectedCase(lease.call)).status).toBe("ok")

    coverage[0]!.release()
    expect(await first).toEqual({ status: "ok", value: fixture.calculation })
    // The first owner's finally must not erase the second replay's selection.
    expect(await business.selectedCase(lease.call)).toEqual({ status: "ok", value: fixture.caseRef })
    coverage[1]!.release()
    expect(await second).toEqual({ status: "ok", value: fixture.otherCalculation })
    expect((await business.selectedCase(lease.call)).status).toBe("unavailable")
    // Cleanup must permit a new independently authorized scope on the same call.
    expect(await business.withCase(lease.call, fixture.otherCaseRef, {}, async () => business.selectedCase(lease.call)))
      .toEqual({ status: "ok", value: fixture.otherCaseRef })
    expect((await business.selectedCase(lease.call)).status).toBe("unavailable")
  } finally {
    reads.forEach((held) => held.release())
    coverage.forEach((held) => held.release())
    await Promise.allSettled([first, ...(second ? [second] : [])])
    authority.state.read = read
    authority.ui.finish(lease.call)
    await fixture.dispose()
  }
}, 120_000)

test("a real calculation retains a withCase owner's selection after the outer action completes", async () => {
  const fixture = await calculationFixture()
  const { authority, business } = fixture
  const lease = await fixture.admit()
  const held = gate()
  let seen = false
  let replay: ReturnType<typeof business.calculations.issue> | undefined
  fixture.control.coverage = async (call) => {
    if (call !== lease.call || seen) return
    seen = true
    held.enter()
    await held.released
  }
  try {
    const outer = await business.withCase(lease.call, fixture.caseRef, {}, async () => {
      replay = business.calculations.issue(fixture.calculation.target.runId, lease.call)
      await reached(held.entered, replay)
      return { status: "ok", value: "outer-complete" }
    })
    expect(outer).toEqual({ status: "ok", value: "outer-complete" })
    expect(await business.selectedCase(lease.call)).toEqual({ status: "ok", value: fixture.caseRef })
    held.release()
    expect(await replay).toEqual({ status: "ok", value: fixture.calculation })
    expect((await business.selectedCase(lease.call)).status).toBe("unavailable")
  } finally {
    held.release()
    await replay?.catch(() => undefined)
    authority.ui.finish(lease.call)
    await fixture.dispose()
  }
}, 120_000)

test("calculation replay cannot borrow another selected case even when the same principal belongs to both", async () => {
  const fixture = await calculationFixture()
  const { authority, business } = fixture
  const lease = await fixture.admit()
  try {
    const reads = fixture.control.coverageReads
    const refused = await business.withCase(lease.call, fixture.otherCaseRef, {}, async () =>
      business.calculations.issue(fixture.calculation.target.runId, lease.call))
    expect(refused).toEqual({ status: "denied", reason: "calculation-case-scope-mismatch" })
    expect(Object.hasOwn(refused, "value")).toBe(false)
    expect(fixture.control.coverageReads).toBe(reads)
    expect((await business.selectedCase(lease.call)).status).toBe("unavailable")
    expect(await business.calculations.issue(fixture.calculation.target.runId, lease.call)).toEqual({ status: "ok", value: fixture.calculation })
    expect((await business.selectedCase(lease.call)).status).toBe("unavailable")
  } finally { authority.ui.finish(lease.call); await fixture.dispose() }
}, 120_000)

for (const change of ["revoke", "abort"] as const) {
  test(`two real calculation replays refuse ${change} during overlap and release every retention`, async () => {
    const fixture = await calculationFixture()
    const { authority, business } = fixture
    const lease = await fixture.admit()
    const coverage = [gate(), gate()]
    let index = 0
    fixture.control.coverage = async (call) => {
      if (call !== lease.call || index >= coverage.length) return
      const held = coverage[index++]!
      held.enter()
      await held.released
    }
    const first = business.calculations.issue(fixture.calculation.target.runId, lease.call)
    let second: ReturnType<typeof business.calculations.issue> | undefined
    try {
      await reached(coverage[0]!.entered, first)
      second = business.calculations.issue(fixture.otherCalculation.target.runId, lease.call)
      await reached(coverage[1]!.entered, second)
      if (change === "revoke") fixture.control.active = false
      else lease.controller.abort("calculation-call-revoked")
      coverage[0]!.release()
      coverage[1]!.release()
      for (const answer of await Promise.all([first, second])) {
        expect(answer.status).not.toBe("ok")
        expect(Object.hasOwn(answer, "value")).toBe(false)
      }
      expect((await business.selectedCase(lease.call)).status).toBe("unavailable")
      if (change === "revoke") {
        fixture.control.active = true
      }
      // The real UI authority permanently discards the revoked/aborted lease;
      // recovery requires another admission, never revival of its old binding.
      expect(await authority.host.revalidate(lease.call)).toBe(false)
      expect(authority.host.requestFor(lease.call)).toBeUndefined()
      const recovery = await fixture.admit()
      try {
        expect(await business.withCase(recovery.call, fixture.otherCaseRef, {}, async () => business.selectedCase(recovery.call)))
          .toEqual({ status: "ok", value: fixture.otherCaseRef })
        expect((await business.selectedCase(recovery.call)).status).toBe("unavailable")
      } finally { authority.ui.finish(recovery.call) }
    } finally {
      coverage.forEach((held) => held.release())
      await Promise.allSettled([first, ...(second ? [second] : [])])
      authority.ui.finish(lease.call)
      await fixture.dispose()
    }
  }, 120_000)
}

async function calculationFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-calculation-case-scope-"))
  const store = await openLocalStore(path.join(directory, "store"))
  const at = "2027-02-02T00:00:00Z"
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "calculation-case", incarnation: "calculation-inc", version: 1 }
  const otherCaseRef = { id: "other-case", incarnation: "other-inc", version: 1 }
  const control: { active: boolean; coverageReads: number; coverage?: (call: TrustedDomainContext) => Promise<void> } = { active: true, coverageReads: 0 }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => at) }) }
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
    for (const index of [0, 1]) {
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
    const calculation = calculations[0]!
    const otherCalculation = calculations[1]!
    if (calculation.target.runId === otherCalculation.target.runId) throw new Error("Distinct stored calculation runs required")
    return { authority, business, control, caseRef, otherCaseRef, calculation, otherCalculation, admit, dispose }
  } catch (error) { await dispose(); throw error }
}

function gate() {
  let enter!: () => void
  let release!: () => void
  const entered = new Promise<void>((resolve) => { enter = resolve })
  const released = new Promise<void>((resolve) => { release = resolve })
  return { entered, released, enter, release }
}

function reached(entered: Promise<void>, pending: Promise<unknown>) {
  return Promise.race([entered, pending.then(() => { throw new Error("Calculation settled without reaching the scheduled overlap") })])
}
