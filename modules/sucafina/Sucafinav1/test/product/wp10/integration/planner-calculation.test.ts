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
import type { BusinessEvidenceRef, BusinessMemoryEnvelope } from "../../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { object } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Each group owns a new real SQLite store, source issuer, Planner, UI capability,
// BCS and Atlas. Calculation results and captures are produced, never seeded.
// Coverage and the accepted ledger event remain explicit fixtures; these tests do
// not qualify C09 human acceptance, provider completion or global acceptance.
// Partitioning removes accumulated independent work from each deadline. It does
// not fix product latency; every group still needs its own hosted execution.
async function calculationFixture(deadline: ReturnType<typeof compositionTestDeadline>, name: string) {
  const started = performance.now()
  const checkDeadline = deadline.check
  const phase = (phase: string) => { checkDeadline(); console.info("SF_CALCULATION_PHASE", JSON.stringify({ fixture: name, phase, elapsedMs: Math.round(performance.now() - started) })) }
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-calculation-composition-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const storeDirectory = path.join(directory, "store")
  const at = "2027-02-02T00:00:00Z"
  const clock = { at }
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "calculation-case", incarnation: "calculation-inc", version: 1 }
  const control = { active: true, coverageReads: 0, calculationResolves: 0, calculationResolved: 0, coverageIssue: "fixture-training-unresolved" }
  const interleave: { environment?: () => Promise<void>; coverage?: () => Promise<void>; evidence?: () => Promise<void>; outbox?: () => Promise<void> } = {}
  let store = await openLocalStore(storeDirectory)
  deadline.own(() => store.dispose())
  const services: { current?: ReturnType<typeof createSfBusinessServices> } = {}
  deadline.own(() => services.current?.dispose())
  checkDeadline()
  const known = KNOWN_SCANNERS.find((entry) => entry.name === "gitleaks")
  if (!known) throw new Error("Pinned scanner unavailable")
  const ready = await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, path.join(directory, "toolkit"))))
  const spec = { ...known, command: ready.executable }
  const probe = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  const version = probe.stdout.toString("utf8").trim()
  if (probe.exitCode !== 0 || !version) throw new Error("Scanner version unavailable")
  const open = async (initialize: boolean) => {
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => clock.at) }) }
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
    const request = () => new Request("https://example.test/planner", { method: "POST", headers: { origin: "https://example.test" }, signal: deadline.signal })
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
        return { at: clock.at, id: randomUUID, directory: [] }
      }, createId: randomUUID, now: Date.now,
      commandIdentity: async () => { checkDeadline(); return randomUUID() },
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const readState = authority.state.read
    authority.state.read = async (request, namespace, read) => {
      const result = await readState(request, namespace, read)
      if (namespace === "outbox" && result.status === "ok") await interleave.outbox?.()
      return result
    }
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
    services.current = business
    const resolveCalculation = business.calculations.resolveEvidence
    business.calculations.resolveEvidence = async (ref, call) => {
      const sequence = ++control.calculationResolves, began = performance.now()
      console.info("SF_CALCULATION_RESOLUTION", JSON.stringify({ fixture: name, generation: initialize ? "initial" : "reopened", sequence, state: "started" }))
      try { return await resolveCalculation(ref, call) }
      finally {
        control.calculationResolved++
        console.info("SF_CALCULATION_RESOLUTION", JSON.stringify({ fixture: name, generation: initialize ? "initial" : "reopened", sequence,
          state: "returned", elapsedMs: Math.round(performance.now() - began), completed: control.calculationResolved, entered: control.calculationResolves }))
      }
    }
    business.bindForecastCoverage(async (reference, call) => {
      control.coverageReads++
      const waiting = interleave.coverage
      delete interleave.coverage
      await waiting?.()
      const source = await business.plannerSources.resolveForecastSource(reference, call)
      if (source.status !== "ok") return source
      return { status: "ok", value: { coverageRef: "fixture:explicit-pending-coverage", basis: { id: "fixture-basis", version: 1,
        decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
        assessment: { basisId: "fixture-basis", basisVersion: 1, alternativeId: "baseline", alternativeVersion: 1, currency: "USD", horizon: period,
          issues: [control.coverageIssue], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
          entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
    })
    const atlas = business.initializeAtlas(initialize ? { spec, version } : undefined,
      { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const resolveEvidence = atlas.context.resolve
    atlas.context.resolve = async (ref, call) => {
      const waiting = interleave.evidence
      delete interleave.evidence
      await waiting?.()
      return resolveEvidence(ref, call)
    }
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
  const produced = await deadline.phase("calculation.produce", () => first.ui("sf_scenario_simulate", {}, (call) => first.business.withCase(call, caseRef, {}, async () => {
    const issued = await first.business.plannerProduct.issueSource("v0", call)
    if (issued.status !== "ok") return issued
    const scenario = { baseRef: issued.value.evidence.refId, operations: [], assumptions: [] }
    const result = await first.business.planner.simulateScenario(scenario, call)
    if (result.status !== "ok") return result
    const saved = await first.business.calculations.persist({ kind: "scenario", request: scenario, result: result.value }, "scenario-fixture", call)
    if (saved.status !== "ok") return saved
    const canonical = await first.business.calculations.issue(saved.value.resultRef, call)
    return canonical.status === "ok" ? { status: "ok", value: { source: issued.value.evidence, calculation: canonical.value, result: result.value } } : canonical
  })))
  expect(produced.status).toBe("ok")
  if (produced.status !== "ok") throw new Error(produced.reason)
  const source = produced.value.source
  const calculation = produced.value.calculation
  phase("persisted-and-replayed-calculation")
  expect(control.coverageReads).toBeGreaterThan(0)
  // Corrupt only the persisted test store. No alternate reader, permissive
  // authority, fabricated capture or replacement continuity proof is used.
  const change = async (work: (state: SfProductState) => void) => store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    if (!state?.atlas || !state.cases) throw new Error("Actual C08 fixture store unavailable")
    work(state)
    return { commit: true, value: undefined }
  })
  const reopen = async () => {
    const payload = { evidenceRef: calculation }
    const event: CaseLedgerEvent = { id: "calculation-event", caseRef, kind: "analysis-accepted", principalRef: "person", at,
      consideredActions: ["retain-original"], factualGaps: ["fixture-training-unresolved"], lifecycleState: "investigating", rationale: "Exercise authorized calculation memory",
      evidenceRefs: [calculation], outputDigest: "c".repeat(64) }
    const base: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "calculation-event-ref",
      installationId: calculation.installationId, projectId: calculation.projectId, refDigest: "", evidenceLevel: "decision",
      target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: [calculation] } }
    const eventRef = { ...base, refDigest: digestSfEvidenceRef(base) }
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
    // Reopen both the SQLite store and authority. The new Atlas reads its actual
    // durable capture; no calculation result or scanner receipt is substituted.
    first.dispose()
    services.current = undefined
    await store.dispose()
    store = await openLocalStore(storeDirectory)
    const reopened = await open(false)
    phase("reopened-sqlite-and-authority")
    return { reopened, eventRef }
  }
  return { first, produced, calculation, caseRef, control, clock, interleave, reopen, change, phase }
}

async function withCalculation(name: string, work: (fixture: Awaited<ReturnType<typeof calculationFixture>>) => Promise<void>) {
  const deadline = compositionTestDeadline(`planner-calculation.${name}`, 105_000)
  try { await work(await calculationFixture(deadline, name)) }
  finally { await deadline.close() }
}

test("Planner calculation preserves UI and repeated BCS reads and rejects cycles, tampering and over-budget selectors", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("ui-and-selectors", async ({ first, produced, calculation, control, interleave, phase }) => {
    const payload = { evidenceRef: calculation }
    const resolved = await first.ui("sf_source_get", payload, (call) => {
      const descriptor = first.business.descriptors.find((entry) => entry.id === "sf_source_get")
      if (!descriptor) throw new Error("Mounted source consumer missing")
      return descriptor.handler(payload, call)
    })
    expect(resolved).toMatchObject({ status: "ok", result: { state: "fresh", currentRef: calculation } })
    await first.ui("sf_evidence_get", payload, async (call) => {
      // Repeated selectors in one authorization pass use the actual BCS.
      // Independent overlapping same-run replays remain prohibited by the producer.
      const repeated = await first.business.context.context({ refs: [calculation, calculation] }, call)
      expect(repeated.map((item) => item.state)).toEqual(["fresh", "fresh"])
      expect(repeated.map((item) => item.currentRef)).toEqual([calculation, calculation])
      let reentered = false
      interleave.coverage = async () => {
        reentered = true
        expect(await first.business.calculations.issue(calculation.target.runId, call))
          .toEqual({ status: "unavailable", reason: "calculation-replay-cycle" })
      }
      expect((await first.business.calculations.issue(calculation.target.runId, call)).status).toBe("ok")
      expect(reentered).toBe(true)
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
    phase("ordered-read-and-real-cycle-negative-proofs")
  })
}, 120_000)

test("Planner calculation survives SQLite and Atlas reopen with continuity, original and ancestor context", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("reopen-and-context", async ({ calculation, caseRef, reopen, phase }) => {
    const { reopened, eventRef } = await reopen()
    const payload = { evidenceRef: calculation }
    await reopened.ui("sf_evidence_get", payload, async (call) => {
      expect((await reopened.business.context.resolve(calculation, call)).state).toBe("fresh")
      phase("reopened-calculation-resolved")
      expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(true)
      phase("reopened-continuity-authorized")
      expect(await reopened.atlas.memory.readOriginal(caseRef, calculation.refDigest, call)).toEqual(calculation)
      phase("reopened-original-capture-read")
      // The event resolves this calculation as an ancestor. Direct and
      // repeated selectors must not overlap that same producer replay.
      const refs = [eventRef, calculation, calculation]
      const resolved = await reopened.business.context.context({ refs }, call)
      expect(resolved).toHaveLength(refs.length)
      for (const [index, result] of resolved.entries()) {
        expect(result).toMatchObject({ state: "fresh", ref: refs[index], currentRef: refs[index] })
        expect(result.authorizedProjection).toBeDefined()
      }
      phase("reopened-ancestor-and-repeated-context-authorized")
    })
  })
}, 120_000)

test("Planner calculation recalls the actual reopened Atlas record and does not append it twice", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("reopen-and-recall", async ({ calculation, caseRef, reopen, control, phase }) => {
    const { reopened, eventRef } = await reopen()
    const payload = { evidenceRef: calculation }
    await reopened.ui("sf_evidence_get", payload, async (call) => {
      phase("starting-reopened-calculation-resolve-before-recall")
      expect((await reopened.business.context.resolve(calculation, call)).state).toBe("fresh")
      phase("finished-reopened-calculation-resolve-before-recall")
      phase("starting-real-atlas-recall")
      const beforeRecall = control.calculationResolves
      const recalled = await reopened.atlas.memory.recall(caseRef, call)
      expect(recalled.status).toBe("ok")
      if (recalled.status === "ok") expect(recalled.records).toHaveLength(1)
      expect(control.calculationResolves - beforeRecall).toBe(1)
      phase("real-atlas-recall-authorized")
      expect((await reopened.business.context.emitFromLedger(eventRef, call)).status).toBe("already-committed")
    })
  })
}, 120_000)

test("Planner calculation rejects foreign case routing and all six corrupted durable Atlas capture fields", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("capture-integrity", async ({ calculation, caseRef, reopen, change, phase }) => {
    const { reopened } = await reopen()
    const payload = { evidenceRef: calculation }
    await reopened.ui("sf_evidence_get", payload, async (call) => {
      // These positives must succeed on this test's own capture before corruption.
      expect(await reopened.atlas.memory.readOriginal(caseRef, calculation.refDigest, call)).toEqual(calculation)
      expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(true)
      const captured = await reopened.authority.state.read(reopened.request(), "atlas", (state) => ({ atlas: state.atlas, value: state.cases[caseRef.id] }))
      if (captured.status !== "ok" || !captured.value.value) throw new Error("Protected capture fixture unavailable")
      const owners = Object.entries(captured.value.atlas).filter(([, value]) => object(object(value).originals)[calculation.refDigest])
      if (owners.length !== 1) throw new Error("Expected exactly one actual Atlas capture owner")
      const owner = owners[0]![0]
      type Partition = { originals: Record<string, { ref: BusinessEvidenceRef; projection: unknown }>; captureDigests: Record<string, Record<string, string>>; envelopes: Record<string, BusinessMemoryEnvelope> }
      const otherCase = { ...captured.value.value, id: "other-authorized-case", incarnation: "other-case-incarnation", ledger: [] }
      await change((state) => { state.cases[otherCase.id] = otherCase })
      expect(await reopened.atlas.memory.readOriginal(otherCase, calculation.refDigest, call)).toBeUndefined()
      const mutations: readonly ((partition: Partition) => void)[] = [
        (partition) => { delete partition.originals[calculation.refDigest] },
        (partition) => { partition.originals[calculation.refDigest]!.ref = { ...calculation, refId: "tampered-original" } },
        (partition) => { partition.originals[calculation.refDigest]!.projection = { tampered: true } },
        (partition) => { Object.values(partition.captureDigests).forEach((entry) => { entry[calculation.refDigest] = "0".repeat(64) }) },
        (partition) => { Object.values(partition.envelopes).forEach((entry) => { entry.caseRef = { id: otherCase.id, incarnation: otherCase.incarnation, version: otherCase.version } }) },
        (partition) => { partition.envelopes = {} },
      ]
      for (const mutate of mutations) {
        await change((state) => { state.atlas = structuredClone(captured.value.atlas); mutate(state.atlas[owner] as Partition) })
        expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(false)
      }
      await change((state) => { state.atlas = structuredClone(captured.value.atlas) })
      expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(true)
      await change((state) => { delete state.cases[otherCase.id] })
      phase("protected-capture-routing-and-integrity-negative-proofs")
    })
  })
}, 120_000)

test("Planner continuity fences membership changes during a real environment await and recovers after restoration", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("membership-race", async ({ calculation, caseRef, reopen, change, interleave, phase }) => {
    const { reopened } = await reopen()
    const payload = { evidenceRef: calculation }
    await reopened.ui("sf_evidence_get", payload, async (call) => {
      expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(true)
      const captured = await reopened.authority.state.read(reopened.request(), "atlas", (state) => ({ atlas: state.atlas, value: state.cases[caseRef.id] }))
      if (captured.status !== "ok" || !captured.value.value) throw new Error("Protected capture fixture unavailable")
      // Membership changes after the first protected lookup, while the real
      // domain projection awaits its environment. Session authority stays live.
      interleave.environment = async () => { await change((state) => { state.cases[caseRef.id]!.participants = [] }) }
      expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(false)
      expect(interleave.environment).toBeUndefined()
      expect(await reopened.authority.host.revalidate(call)).toBe(true)
      await change((state) => {
        state.cases[caseRef.id] = structuredClone(captured.value.value!)
      })
      expect(await reopened.atlas.proveContinuity(calculation, calculation, call)).toBe(true)
      phase("current-membership-negative-proof-and-restoration")
    })
  })
}, 120_000)

test("Planner overlapping replays and Atlas recall disclose nothing after principal revocation", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("overlapping-revocation", async ({ calculation, caseRef, reopen, control, interleave, phase }) => {
    const { reopened } = await reopen()
    const payload = { evidenceRef: calculation }
    await reopened.ui("sf_evidence_get", payload, async (call) => {
      phase("starting-reopened-calculation-resolve-before-overlap")
      expect((await reopened.business.context.resolve(calculation, call)).state).toBe("fresh")
      phase("finished-reopened-calculation-resolve-before-overlap")
      phase("starting-real-atlas-recall-before-overlap")
      const recalled = await reopened.atlas.memory.recall(caseRef, call)
      expect(recalled.status).toBe("ok")
      if (recalled.status === "ok") expect(recalled.records).toHaveLength(1)
      phase("reopened-positive-before-overlapping-revocation")
      // Pause at an actual host environment read, overlap another proof, then
      // revoke the principal before either can disclose its result.
      const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      interleave.environment = async () => { entered.resolve(); await release.promise }
      const running = reopened.business.calculations.issue(calculation.target.runId, call)
      try {
        await Promise.race([entered.promise, running.then(() => { throw new Error("Actual Planner replay did not reach the environment boundary") })])
        const overlapping = reopened.business.calculations.issue(calculation.target.runId, call)
        control.active = false
        release.resolve()
        const outcomes = await Promise.all([running, overlapping])
        expect(outcomes[0]!.status).not.toBe("ok")
        expect(outcomes[1]!.status).not.toBe("ok")
      } finally { release.resolve(); delete interleave.environment }
      expect((await reopened.business.context.resolve(calculation, call)).state).toBe("unavailable")
      expect((await reopened.atlas.memory.recall(caseRef, call)).status).toBe("unavailable")
    })
  })
}, 120_000)

test("Planner calculation becomes unavailable after its real persisted source changes", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("changed-source", async ({ calculation, reopen, control }) => {
    const { reopened } = await reopen()
    const payload = { evidenceRef: calculation }
    await reopened.ui("sf_evidence_get", payload, async (call) => {
      expect((await reopened.business.context.resolve(calculation, call)).state).toBe("fresh")
    })
    control.active = true
    await reopened.persistence.transaction("planner", async (snapshot) => { snapshot.data.entities = [{ id: "changed-source", name: "Changed source" }]; return { commit: true, value: true } })
    await reopened.ui("sf_evidence_get", payload, async (call) => {
      expect((await reopened.business.context.resolve(calculation, call)).state).toBe("unavailable")
    })
  })
}, 120_000)

// The first real cases.read completes the financial proof before Atlas calls
// its public evidence resolver. Each mutation below therefore challenges a
// completed proof, not a denied admission or fabricated calculation result.
for (const mutation of ["source", "membership", "capture", "coverage", "selector", "clock", "principal", "lease"] as const) {
  test(`Planner reopened recall rejects ${mutation} drift after a completed calculation proof`, async () => {
    expectSpawn(import.meta.path)
    await withCalculation(`recall-proof-${mutation}`, async ({ calculation, caseRef, reopen, change, control, clock, interleave, phase }) => {
      const { reopened } = await reopen()
      await reopened.ui("sf_evidence_get", { evidenceRef: calculation }, async (call) => {
        const selected = { ...caseRef }, before = control.calculationResolves
        let applied = 0, outboxReads = 0, finalEnvironmentReads = 0
        const mutate = async () => {
          expect(control.calculationResolved).toBe(control.calculationResolves)
          expect(control.calculationResolves - before).toBe(1)
          applied++
          if (mutation === "source") await reopened.persistence.transaction("planner", async (snapshot) => {
            snapshot.data.entities = [{ id: "after-completed-proof", name: "Changed source" }]
            return { commit: true, value: undefined }
          })
          if (mutation === "membership") await change((state) => { state.cases[caseRef.id]!.participants = [] })
          if (mutation === "capture") await change((state) => {
            const captures = Object.values(state.atlas).map((partition) => object(object(partition).originals)).filter((originals) => originals[calculation.refDigest])
            expect(captures).toHaveLength(1)
            delete captures[0]![calculation.refDigest]
          })
          if (mutation === "coverage") control.coverageIssue = "changed-after-completed-proof"
          if (mutation === "selector") selected.incarnation = "different-case-incarnation"
          if (mutation === "clock") clock.at = "2027-02-03T00:00:00Z"
          if (mutation === "principal") control.active = false
          if (mutation === "lease") reopened.authority.ui.finish(call)
          phase(`mutated-${mutation}-after-completed-proof`)
        }
        const final = mutation === "clock" || mutation === "principal" || mutation === "lease"
        if (!final) interleave.evidence = mutate
        if (final) interleave.outbox = async () => {
          if (++outboxReads !== 2) return
          delete interleave.outbox
          // The second actual outbox read is the canonical memory reader's
          // final snapshot. Its subsequent authorization and the private case
          // egress must complete before the new final fence reads environment.
          const observeFinalEnvironment = async () => {
            finalEnvironmentReads++
            // Two clocks in the first C08 proof, one in the real record reader,
            // then two in the final C08 proof. Mutate at that last clock await.
            if (finalEnvironmentReads === 5) await mutate()
            else interleave.environment = observeFinalEnvironment
          }
          interleave.environment = observeFinalEnvironment
        }
        phase(`starting-recall-proof-${mutation}`)
        const result = await reopened.atlas.memory.recall(selected, call)
        expect(applied).toBe(1)
        expect(result.status).toBe("unavailable")
        expect("records" in result).toBe(false)
        expect(control.calculationResolves - before).toBe(1)
        if (final) {
          expect(outboxReads).toBe(2)
          expect(finalEnvironmentReads).toBe(5)
        }
        phase(`rejected-recall-proof-${mutation}`)
      })
    })
  }, 120_000)
}

test("Planner recall proof stays lexical while an independent same-call calculation resolves in parallel", async () => {
  expectSpawn(import.meta.path)
  await withCalculation("recall-proof-lexical-isolation", async ({ calculation, caseRef, reopen, control, interleave, phase }) => {
    const { reopened } = await reopen()
    await reopened.ui("sf_evidence_get", { evidenceRef: calculation }, async (call) => {
      const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      const before = control.calculationResolves
      interleave.evidence = async () => { entered.resolve(); await release.promise }
      const running = reopened.atlas.memory.recall(caseRef, call)
      try {
        await Promise.race([entered.promise, running.then(() => { throw new Error("Real Atlas recall did not reach its warmed evidence boundary") })])
        expect(control.calculationResolves - before).toBe(1)
        // This continuation was created outside recall's AsyncLocalStorage.
        // It must run the actual producer even though the same UI call is live.
        const independent = await reopened.business.context.resolve(calculation, call)
        expect(independent.state).toBe("fresh")
        expect(control.calculationResolves - before).toBe(2)
        phase("independent-calculation-did-not-borrow-recall-proof")
      } finally { release.resolve(); delete interleave.evidence; await running }
      const recalled = await running
      expect(recalled.status).toBe("ok")
      if (recalled.status === "ok") expect(recalled.records).toHaveLength(1)
      expect(control.calculationResolves - before).toBe(2)
      phase("lexically-isolated-real-atlas-recall-authorized")
    })
  })
}, 120_000)
