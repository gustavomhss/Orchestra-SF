import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { BackendToolkit } from "@orchestra/core/backend-toolkit"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { KNOWN_SCANNERS } from "@orchestra/atlas-boundary/native-memory"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

// Real SQLite, source issuer, Planner engine, request/result stores, UI capability,
// BCS and Atlas. Coverage and the accepted ledger event are explicit fixtures;
// no C09 human acceptance, provider completion or global qualification is claimed.
test("Planner calculation replays through UI and BCS, survives Atlas reopen, and rejects tampering or revocation", async () => {
  const started = performance.now(), deadline = started + 105_000
  const deadlineError = new Error("Planner calculation fixture exceeded its 105000ms cooperative deadline")
  const cancellation = new AbortController()
  const checkDeadline = () => {
    if (performance.now() >= deadline && !cancellation.signal.aborted) cancellation.abort(deadlineError)
    cancellation.signal.throwIfAborted()
  }
  const phase = (name: string) => { checkDeadline(); console.info("SF_CALCULATION_PHASE", JSON.stringify({ phase: name, elapsedMs: Math.round(performance.now() - started) })) }
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-calculation-composition-"))
  const storeDirectory = path.join(directory, "store")
  const at = "2027-02-02T00:00:00Z"
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "calculation-case", incarnation: "calculation-inc", version: 1 }
  const control = { active: true, coverageReads: 0 }
  const interleave: { environment?: () => Promise<void> } = {}
  let store = await openLocalStore(storeDirectory)
  const timer = setTimeout(() => cancellation.abort(deadlineError), Math.max(0, deadline - performance.now()))
  try {
    checkDeadline()
    expectSpawn(import.meta.path)
    const known = KNOWN_SCANNERS.find((entry) => entry.name === "gitleaks")
    if (!known) throw new Error("Pinned scanner unavailable")
    const ready = await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, path.join(directory, "toolkit"))))
    const spec = { ...known, command: ready.executable }
    const probe = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const version = probe.stdout.toString("utf8").trim()
    if (probe.exitCode !== 0 || !version) throw new Error("Scanner version unavailable")
    const open = async (initialize: boolean) => {
      const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
        projectScope: createSfSourceScopeProjector(() => at) }) }
      if (initialize) {
        for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
        await persistence.transaction("planner", async (snapshot) => {
          snapshot.data = { versions: [{ id: "v0", name: "Calculation fixture", year: 2027, closed: 1,
            lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
              b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
            fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
            officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
          return { commit: true, value: undefined }
        })
      }
      const proposalCoverageWrites = new WeakSet<object>()
      const identity = { installationId: "calculation-installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
      const request = () => new Request("https://example.test/planner", { method: "POST", headers: { origin: "https://example.test" }, signal: cancellation.signal })
      const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "calculation-policy",
        persistence, proposalCoverageWrites, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
          operations: ["sf_scenario_simulate", "sf_source_get", "sf_evidence_get", "sf_context_get", "sf_freshness_check", "sf_decision_recall"], humanActions: [] }],
        authenticate: async (_request, scope) => { checkDeadline(); return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null },
        environment: async () => {
          checkDeadline()
          const waiting = interleave.environment
          delete interleave.environment
          await waiting?.()
          checkDeadline()
          return { at, id: randomUUID, directory: [] }
        }, createId: randomUUID, now: Date.now,
        commandIdentity: async () => { checkDeadline(); return randomUUID() },
        inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
        providerGeneration: async () => 1, authorizeDocument: async () => undefined })
      const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
      business.bindForecastCoverage(async (reference, call) => {
        control.coverageReads++
        const source = await business.plannerSources.resolveForecastSource(reference, call)
        if (source.status !== "ok") return source
        return { status: "ok", value: { coverageRef: "fixture:explicit-pending-coverage", basis: { id: "fixture-basis", version: 1,
          decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
          assessment: { basisId: "fixture-basis", basisVersion: 1, alternativeId: "baseline", alternativeVersion: 1, currency: "USD", horizon: period,
            issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
            entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
      })
      const atlas = business.initializeAtlas(initialize ? { spec, version } : undefined,
        { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
      const ui = async <T>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<T>) => {
        const admitted = await authority.ui.admit(request(), operation, digestSfValue(payload))
        if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digestSfValue(payload))) throw new Error(`UI ${operation} unavailable`)
        try { return await work(admitted.value) } finally { authority.ui.finish(admitted.value) }
      }
      if (initialize) {
        const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
          targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed", commandDigest: digestSfValue(caseRef) }, async (state) => {
          state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "Calculation fixture", horizon: period, currency: "USD", criteria: [], participants: ["person"],
            sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
          return { commit: true, value: true }
        })
        if (seeded.status !== "ok") throw new Error("Case fixture unavailable")
      }
      return { persistence, authority, business, atlas, ui, request, dispose: () => business.dispose() }
    }
    const first = await open(true)
    phase("initialized-real-store-producers-and-scanner")
    let source: Extract<BusinessEvidenceRef, { kind: "record" }>
    let calculation: Extract<BusinessEvidenceRef, { kind: "calculation" }>
    let eventRef: Extract<BusinessEvidenceRef, { kind: "case-event" }>
    try {
      const produced = await first.ui("sf_scenario_simulate", {}, (call) => first.business.withCase(call, caseRef, {}, async () => {
        const issued = await first.business.plannerProduct.issueSource("v0", call)
        if (issued.status !== "ok") return issued
        const scenario = { baseRef: issued.value.evidence.refId, operations: [], assumptions: [] }
        const result = await first.business.planner.simulateScenario(scenario, call)
        if (result.status !== "ok") return result
        const saved = await first.business.calculations.persist({ kind: "scenario", request: scenario, result: result.value }, "scenario-fixture", call)
        if (saved.status !== "ok") return saved
        const canonical = await first.business.calculations.issue(saved.value.resultRef, call)
        return canonical.status === "ok" ? { status: "ok", value: { source: issued.value.evidence, calculation: canonical.value, result: result.value } } : canonical
      }))
      expect(produced.status).toBe("ok")
      if (produced.status !== "ok") throw new Error(produced.reason)
      source = produced.value.source
      calculation = produced.value.calculation
      phase("persisted-and-replayed-calculation")
      expect(control.coverageReads).toBeGreaterThan(0)
      const payload = { evidenceRef: calculation }
      const resolved = await first.ui("sf_source_get", payload, (call) => {
        const descriptor = first.business.descriptors.find((entry) => entry.id === "sf_source_get")
        if (!descriptor) throw new Error("Mounted source consumer missing")
        return descriptor.handler(payload, call)
      })
      expect(resolved).toMatchObject({ status: "ok", result: { state: "fresh", currentRef: calculation } })
      await first.ui("sf_evidence_get", payload, async (call) => {
        // Both branches use the same real admission, persisted request/result
        // and Planner replay. Neither branch may consume another's case scope.
        const simultaneous = await Promise.all([first.business.context.resolve(calculation, call), first.business.context.resolve(calculation, call)])
        expect(simultaneous.map((item) => item.state)).toEqual(["fresh", "fresh"])
        expect(simultaneous.map((item) => item.currentRef)).toEqual([calculation, calculation])
        const found = await first.business.context.resolve(calculation, call)
        if (!found.authorizedProjection || !("context" in found.authorizedProjection)) throw new Error("Authorized calculation projection missing")
        expect(found.authorizedProjection.components).toEqual(produced.value.result.components)
        expect(found.authorizedProjection.decision).toBeUndefined()
        expect(found.authorizedProjection.values.find((value) => value.id === "scenario:total")?.value).toBeNull()
        expect(JSON.parse(String(found.authorizedProjection.values.find((value) => value.id === "scenario:result")?.value))).toEqual(produced.value.result)
        for (const target of [{ ...calculation.target, engineVersion: "invented" }, { ...calculation.target, inputDigest: "0".repeat(64) },
          { ...calculation.target, resultDigest: "0".repeat(64) }, { ...calculation.target, sourceRefs: [] }]) {
          const tampered = { ...calculation, target, refDigest: "" }
          expect((await first.business.context.resolve({ ...tampered, refDigest: digestSfEvidenceRef(tampered) }, call)).state).toBe("unavailable")
        }
        const reads = control.coverageReads
        const cyclic = structuredClone(calculation)
        cyclic.target.sourceRefs = [cyclic]
        expect((await first.business.context.resolve(cyclic, call)).state).toBe("unavailable")
        expect((await first.business.context.context({ refs: Array.from({ length: 513 }, () => calculation) }, call)).every((item) => item.state === "unavailable")).toBe(true)
        expect(control.coverageReads).toBe(reads)
      })
      phase("parallel-read-and-negative-proofs")
      const event: CaseLedgerEvent = { id: "calculation-event", caseRef, kind: "analysis-accepted", principalRef: "person", at,
        consideredActions: ["retain-original"], factualGaps: ["fixture-training-unresolved"], lifecycleState: "investigating", rationale: "Exercise authorized calculation memory",
        evidenceRefs: [calculation], outputDigest: "c".repeat(64) }
      const base: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "calculation-event-ref",
        installationId: calculation.installationId, projectId: calculation.projectId, refDigest: "", evidenceLevel: "decision",
        target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: [calculation] } }
      eventRef = { ...base, refDigest: digestSfEvidenceRef(base) }
      const versions = await first.authority.state.read(first.request(), "cases", (state, actor) => ({ versions: state.versions, actor }))
      if (versions.status !== "ok") throw new Error("Fixture versions unavailable")
      const seeded = await first.authority.state.transaction(first.request(), { namespace: "cases", expectedStorageVersion: versions.value.versions.cases,
        additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: versions.value.versions.outbox }], targetRef: caseRef.id, targetIncarnation: caseRef.incarnation,
        idempotencyKey: "fixture-ledger", commandDigest: digestSfValue(event) }, async (state) => {
        state.cases[caseRef.id]!.sourceRefs = [source, calculation]
        state.cases[caseRef.id]!.ledger = [event]
        state.outbox[JSON.stringify([caseRef.id, caseRef.incarnation, event.id])] = { eventRef, writerPrincipalRef: "person", accessRevision: versions.value.actor.accessRevision,
          createdAt: at, attempts: 0, state: "pending" }
        return { commit: true, value: true }
      })
      expect(seeded.status).toBe("ok")
      const appended = await first.ui("sf_evidence_get", payload, (call) => first.business.context.emitFromLedger(eventRef, call))
      expect(appended).toMatchObject({ status: "committed" })
      phase("real-atlas-write-committed")
    } finally { first.dispose() }
    await store.dispose()
    store = await openLocalStore(storeDirectory)
    const reopened = await open(false)
    phase("reopened-sqlite-and-authority")
    try {
      const payload = { evidenceRef: calculation }
      await reopened.ui("sf_evidence_get", payload, async (call) => {
        expect((await reopened.business.context.resolve(calculation, call)).state).toBe("fresh")
        expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(true)
        expect(await reopened.atlas.memory.readOriginal(caseRef, calculation.refDigest, call)).toEqual(calculation)
        const recalled = await reopened.atlas.memory.recall(caseRef, call)
        expect(recalled.status).toBe("ok")
        if (recalled.status === "ok") expect(recalled.records).toHaveLength(1)
        phase("real-atlas-recall-authorized")
        expect((await reopened.business.context.emitFromLedger(eventRef, call)).status).toBe("already-committed")
        // Pause at an actual host environment read, queue another proof, then
        // revoke the principal before either can disclose its result.
        const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
        interleave.environment = async () => { entered.resolve(); await release.promise }
        const running = reopened.business.calculations.issue(calculation.target.runId, call)
        try {
          await Promise.race([entered.promise, running.then(() => { throw new Error("Actual Planner replay did not reach the environment boundary") })])
          const queued = reopened.business.calculations.issue(calculation.target.runId, call)
          control.active = false
          release.resolve()
          const outcomes = await Promise.all([running, queued])
          expect(outcomes[0]!.status).not.toBe("ok")
          expect(outcomes[1]!.status).not.toBe("ok")
        } finally { release.resolve(); delete interleave.environment }
        expect((await reopened.business.context.resolve(calculation, call)).state).toBe("unavailable")
        expect((await reopened.atlas.memory.recall(caseRef, call)).status).toBe("unavailable")
      })
      control.active = true
      await reopened.persistence.transaction("planner", async (snapshot) => { snapshot.data.entities = [{ id: "changed-source", name: "Changed source" }]; return { commit: true, value: true } })
      await reopened.ui("sf_evidence_get", payload, async (call) => {
        expect((await reopened.business.context.resolve(calculation, call)).state).toBe("unavailable")
      })
    } finally { reopened.dispose() }
  } finally {
    clearTimeout(timer)
    try { await store.dispose() } finally {
      await rm(directory, { recursive: true, force: true })
      // A port may translate abort into unavailable; a timed-out negative must
      // still fail after the real resources have been released.
      if (cancellation.signal.reason === deadlineError || performance.now() >= deadline) throw deadlineError
    }
  }
}, 120_000)
