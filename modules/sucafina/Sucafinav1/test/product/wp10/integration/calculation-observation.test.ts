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
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { createPlannerCalculationEvidence } from "../../../../product/planner/calculation-evidence.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// The real authority, SQLite/C08, request/result stores and Planner produce the
// reference. Faults run after canonical reads; no successful source is substituted.
test("calculation observations preserve fallback parity, fresh phases and refusal on source or authority change", async () => {
  const deadline = compositionTestDeadline("calculation-observation")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-calculation-observation-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const at = "2027-02-02T00:00:00Z"
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "observation-case", incarnation: "observation-inc", version: 1 }
  const control = { active: true, reads: 0 }
  try {
    const store = await openLocalStore(path.join(directory, "store"))
    deadline.own(() => store.dispose())
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => at) }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { versions: [{ id: "v0", name: "Observation fixture", year: 2027, closed: 1,
        lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }], officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
    const writes = new WeakSet<object>()
    const identity = { installationId: "observation-installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const request = () => new Request("https://example.test/planner", { method: "POST", signal: deadline.signal, headers: { origin: "https://example.test" } })
    const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "observation-policy",
      persistence, proposalCoverageWrites: writes, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
        operations: ["sf_scenario_simulate", "sf_evidence_get"], humanActions: [] }],
      authenticate: async (_request, scope) => { deadline.check(); return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null },
      environment: async () => { deadline.check(); return { at, id: randomUUID, directory: [] } }, createId: randomUUID, now: Date.now,
      commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
    deadline.own(() => business.dispose())
    const readCalculation = business.results.readForCalculation
    const hooks: { afterResult?: (count: number, result: Awaited<ReturnType<typeof readCalculation>>) => void | Promise<void> } = {}
    // Keep this reader identity stable before the first observation.
    business.results.readForCalculation = async (input, call) => {
      const result = await readCalculation(input, call)
      control.reads++
      await hooks.afterResult?.(control.reads, result)
      return result
    }
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
      if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digest)) throw new Error("UI operation unavailable")
      try { return await work(admitted.value) } finally { authority.ui.finish(admitted.value) }
    }
    const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "fixture-case", commandDigest: digestSfValue(caseRef) }, async (state) => {
      state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "Observation composition fixture", horizon: period,
        currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    })
    expect(seeded.status).toBe("ok")
    const produced = await deadline.phase("canonical-producer", () => ui("sf_scenario_simulate", (call) => business.withCase(call, caseRef, {}, async () => {
      const issued = await business.plannerProduct.issueSource("v0", call)
      if (issued.status !== "ok") return issued
      const input = { baseRef: issued.value.evidence.refId, operations: [], assumptions: [] }
      const simulated = await business.planner.simulateScenario(input, call)
      if (simulated.status !== "ok") return simulated
      expect(simulated.value.total).toBeNull()
      expect(simulated.value.comparisonStatus).toBe("conditioned")
      return business.calculations.persistAndIssue({ kind: "scenario", request: input, result: simulated.value }, "observation", call)
    })))
    expect(produced.status).toBe("ok")
    if (produced.status !== "ok") throw new Error(produced.reason)
    const reference = structuredClone(produced.value.calculation)
    const runId = produced.value.resultRef
    const fallbackInput: Parameters<typeof createPlannerCalculationEvidence>[0] = {
      host: authority.host,
      loadRecordOnlyRequest: business.calculations.requests.read,
      readForCalculation: (input, call) => business.results.readForCalculation({ resultRef: input.resultRef }, call),
      replayRecordOnly: business.planner.simulateScenario,
    }
    const fallback = createPlannerCalculationEvidence(fallbackInput)
    await deadline.phase("fallback-parity-and-fresh-observations", async () => {
      control.reads = 0
      const previous = await ui("sf_evidence_get", (call) => business.withCase(call, caseRef, {}, () => fallback.issue(runId, call)))
      expect(previous).toEqual({ status: "ok", value: reference })
      expect(control.reads).toBe(6)
      for (let index = 0; index < 2; index++) {
        control.reads = 0
        const observed = await ui("sf_evidence_get", (call) => business.calculations.issue(runId, call))
        expect(observed).toEqual(previous)
        // Two independent request observations, each retaining both result reads.
        expect(control.reads).toBe(4)
        if (observed.status === "ok") expect(Reflect.set(observed.value.target.sourceRefs, "length", 0)).toBe(true)
      }
    })
    await deadline.phase("typed-refusal-has-no-fallback", async () => {
      for (const status of ["denied", "unavailable", "stale"] as const) {
        const attempts = { request: 0, result: 0, replay: 0 }
        const refused = { status, reason: "canonical-observation-refused" }
        const closed = createPlannerCalculationEvidence({ ...fallbackInput,
          readObservation: async () => refused,
          loadRecordOnlyRequest: async (...args) => { attempts.request++; return fallbackInput.loadRecordOnlyRequest(...args) },
          readForCalculation: async (...args) => { attempts.result++; return fallbackInput.readForCalculation(...args) },
          replayRecordOnly: async (...args) => { attempts.replay++; return fallbackInput.replayRecordOnly(...args) },
        })
        expect(await ui("sf_evidence_get", (call) => closed.issue(runId, call))).toEqual(refused)
        expect(attempts).toEqual({ request: 0, result: 0, replay: 0 })
      }
    })
    await deadline.phase("changed-second-read-is-refused", async () => {
      control.reads = 0
      hooks.afterResult = (count, result) => {
        if (count === 2 && result.status === "ok") result.value.requestDigest = "0".repeat(64)
      }
      const changed = await ui("sf_evidence_get", (call) => business.calculations.issue(runId, call))
      expect(changed).toEqual({ status: "stale", reason: "scenario-request-changed" })
      expect(control.reads).toBe(2)
      delete hooks.afterResult
      expect(await ui("sf_evidence_get", (call) => business.calculations.issue(runId, call))).toEqual({ status: "ok", value: reference })
    })
    await deadline.phase("revocation-in-final-observation", async () => {
      control.reads = 0
      hooks.afterResult = (count) => { if (count === 3) control.active = false }
      const revoked = await ui("sf_evidence_get", (call) => business.calculations.issue(runId, call))
      expect(revoked.status).toBe("denied")
      expect(Object.hasOwn(revoked, "value")).toBe(false)
      expect(control.reads).toBe(3)
      delete hooks.afterResult
      control.active = true
    })
    await deadline.phase("source-change-in-final-observation", async () => {
      control.reads = 0
      let changed = false
      hooks.afterResult = async (count) => {
        if (count !== 3) return
        await persistence.transaction("planner", async (snapshot) => {
          const data = snapshot.data as { versions: { id: string; lines: { id: string; b: number[] }[] }[] }
          const line = data.versions.find((version) => version.id === "v0")?.lines.find((value) => value.id === "line")
          if (!line || line.b[1] !== 120) throw new Error("Canonical Planner fixture changed before fault")
          line.b[1] = 121
          return { commit: true, value: undefined }
        })
        changed = true
      }
      const stale = await ui("sf_evidence_get", (call) => business.calculations.issue(runId, call))
      expect(changed).toBe(true)
      expect(stale.status).not.toBe("ok")
      expect(Object.hasOwn(stale, "value")).toBe(false)
      expect(control.reads).toBeGreaterThanOrEqual(3)
      delete hooks.afterResult
    })
  } finally { await deadline.close() }
}, 120_000)
