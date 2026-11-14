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
import { createSfAnalysisRunContext } from "../../../../../../../apps/cli/src/sucafina-product/analysis-run-context.ts"
import { createSfStaleAnalysisAccess } from "../../../../../../../apps/cli/src/sucafina-product/analysis-stale-commit.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../../product/ai/run-store.ts"
import { digestSfContribution, digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord, SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { sfRunFixture } from "../../wp12/run-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Real C08, human authority, Planner calculation, ledger capture and Atlas scanner.
// The existing WP12 run/output fixture supplies only deterministic lifecycle bytes;
// it is not a completed provider run, a native witness, or AM acceptance evidence.
async function staleCalculationFixture(deadline: ReturnType<typeof compositionTestDeadline>, name: string) {
  const metrics = { transactions: 0, allTransactions: 0, currentSnapshotReads: 0, authentications: 0, environments: 0,
    coverageReads: 0, calculationReads: 0, calculationSettled: 0, historicalReads: 0, historicalSettled: 0,
    privateAdmissions: 0, contextReads: 0, privateContextReads: 0, settlements: 0 }
  // Counters observe existing calls only. Nested phase deltas are inclusive;
  // a settled calculation can still be unavailable or rejected, not a proof.
  const phase = <T>(label: string, work: () => Promise<T>) => {
    const before = { ...metrics }
    return deadline.phase(label, async () => {
      try { return await work() }
      finally {
        console.info("SF_STALE_CALCULATION_COUNTERS", JSON.stringify({ fixture: name, phase: label,
          delta: Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, value - before[key as keyof typeof before]])), total: { ...metrics } }))
      }
    })
  }
  const observeStore = (driver: Awaited<ReturnType<typeof openLocalStore>>): typeof driver => {
    const allTransactions: typeof driver.transactionAll = driver.transactionAll
      ? (work, options) => { metrics.allTransactions++; return driver.transactionAll!(work, options) } : undefined
    return { ...driver,
      transaction: (surface, work, options) => { metrics.transactions++; return driver.transaction(surface, work, options) },
      ...(allTransactions ? { transactionAll: allTransactions } : {}),
      ...(driver.currentSnapshots ? { currentSnapshots: () => { metrics.currentSnapshotReads++; return driver.currentSnapshots!() } } : {}),
    }
  }
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-stale-calculation-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const storeDirectory = path.join(directory, "store")
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "stale-calculation-case", incarnation: "stale-calculation-inc", version: 1 }
  const control = { active: true }
  let store = observeStore(await phase("fixture.store-open", () => openLocalStore(storeDirectory)))
  deadline.own(() => store.dispose())
  const services: { current?: ReturnType<typeof createSfBusinessServices> } = {}
  deadline.own(() => services.current?.dispose())
  const known = KNOWN_SCANNERS.find((entry) => entry.name === "gitleaks")
  if (!known) throw new Error("Pinned scanner unavailable")
  const ready = await phase("fixture.scanner-ready", () => Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, path.join(directory, "toolkit")))))
  const spec = { ...known, command: ready.executable }
  const probe = await phase("fixture.scanner-version", () => Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node)))))
  const version = probe.stdout.toString("utf8").trim()
  if (probe.exitCode !== 0 || !version) throw new Error("Scanner version unavailable")
  const open = async (initialize: boolean) => {
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => at) }) }
    if (initialize) {
      for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [{ id: "v0", name: "Stale calculation fixture", year: 2027, closed: 1,
          lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
          officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    }
    const proposalCoverageWrites = new WeakSet<object>()
    const identity = { installationId: "stale-calculation-installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const request = () => new Request("https://example.test/analysis", { method: "POST", headers: { origin: "https://example.test", "Idempotency-Key": randomUUID() }, signal: deadline.signal })
    const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "stale-calculation-policy",
      persistence, proposalCoverageWrites, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
        operations: ["sf_scenario_simulate", "sf_source_get", "sf_evidence_get", "sf_context_get", "sf_freshness_check", "sf_decision_recall"], humanActions: ["analysis.start"] }],
      authenticate: async (_request, scope) => { metrics.authentications++; deadline.check(); return control.active && scope ? { id: "person", canWrite: true, roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null },
      environment: async () => { metrics.environments++; deadline.check(); return { at, id: randomUUID, directory: [] } }, createId: randomUUID, now: Date.now,
      commandIdentity: async (request, operation) => {
        const key = request.headers.get("Idempotency-Key")
        return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
      }, inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
    services.current = business
    const resolveCalculation = business.calculations.resolveEvidence
    business.calculations.resolveEvidence = async (ref, call) => {
      const sequence = ++metrics.calculationReads
      return phase(`calculation.current.${initialize ? "initial" : "reopened"}.${sequence}`, async () => {
        try { return await resolveCalculation(ref, call) }
        finally { metrics.calculationSettled++ }
      })
    }
    const resolveHistorical = business.calculations.resolveHistoricalEvidence
    business.calculations.resolveHistoricalEvidence = async (...args) => {
      const sequence = ++metrics.historicalReads
      return phase(`calculation.historical.${initialize ? "initial" : "reopened"}.${sequence}`, async () => {
        try { return await resolveHistorical(...args) }
        finally { metrics.historicalSettled++ }
      })
    }
    business.bindForecastCoverage(async (reference, call) => {
      metrics.coverageReads++
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
      const created = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
        targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed-case", commandDigest: digestSfValue(caseRef) }, async (state) => {
        state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "Late analysis lifecycle", horizon: period, currency: "USD", criteria: [], participants: ["person"],
          sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
        return { commit: true, value: true }
      })
      expect(created.status).toBe("ok")
    }
    return { persistence, authority, business, atlas, ui, request }
  }
  let runtime = await phase("fixture.runtime-initial", () => open(true))
  const produced = await phase("fixture.calculation-produce", () => runtime.ui("sf_scenario_simulate", {}, (call) => runtime.business.withCase(call, caseRef, {}, async () => {
    const source = await phase("fixture.calculation-source", () => runtime.business.plannerProduct.issueSource("v0", call))
    if (source.status !== "ok") return source
    const scenario = { baseRef: source.value.evidence.refId, operations: [], assumptions: [] }
    const result = await phase("fixture.calculation-simulate", () => runtime.business.planner.simulateScenario(scenario, call))
    if (result.status !== "ok") return result
    const saved = await phase("fixture.calculation-persist", () => runtime.business.calculations.persist({ kind: "scenario", request: scenario, result: result.value }, "stale-calculation-fixture", call))
    if (saved.status !== "ok") return saved
    const issued = await phase("fixture.calculation-issue", () => runtime.business.calculations.issue(saved.value.resultRef, call))
    return issued.status === "ok" ? { status: "ok", value: { source: source.value.evidence, calculation: issued.value } } : issued
  })))
  if (produced.status !== "ok") throw new Error(`Canonical calculation unavailable: ${produced.reason}`)
  const { calculation, source } = produced.value
  const event: CaseLedgerEvent = { id: "stale-calculation-event", caseRef, kind: "analysis-accepted", principalRef: "person", at,
    consideredActions: ["retain-original"], factualGaps: ["fixture-training-unresolved"], lifecycleState: "investigating", rationale: "Exercise late calculation access",
    evidenceRefs: [calculation], outputDigest: "c".repeat(64) }
  const base: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "stale-calculation-event-ref",
    installationId: calculation.installationId, projectId: calculation.projectId, refDigest: "", evidenceLevel: "decision",
    target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: [calculation] } }
  const eventRef = { ...base, refDigest: digestSfEvidenceRef(base) }
  const versions = await runtime.authority.state.read(runtime.request(), "cases", (state, actor) => ({ versions: state.versions, actor }))
  if (versions.status !== "ok") throw new Error("Actual C08 versions unavailable")
  expect((await runtime.authority.state.transaction(runtime.request(), { namespace: "cases", expectedStorageVersion: versions.value.versions.cases,
    additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: versions.value.versions.outbox }], targetRef: caseRef.id, targetIncarnation: caseRef.incarnation,
    idempotencyKey: "fixture-ledger", commandDigest: digestSfValue(event) }, async (state) => {
    state.cases[caseRef.id]!.sourceRefs = [source, calculation]
    state.cases[caseRef.id]!.ledger = [event]
    state.outbox[JSON.stringify([caseRef.id, caseRef.incarnation, event.id])] = { eventRef, writerPrincipalRef: "person", accessRevision: versions.value.actor.accessRevision,
      createdAt: at, attempts: 0, state: "pending" }
    return { commit: true, value: true }
  })).status).toBe("ok")
  expect(await phase("fixture.atlas-archive", () => runtime.ui("sf_evidence_get", { evidenceRef: calculation }, (call) => runtime.business.context.emitFromLedger(eventRef, call)))).toMatchObject({ status: "committed" })
  const start = { request: { caseRef }, purpose: "Deterministic late-output settlement fixture" }
  const original = sfRunFixture()
  const run: SfNativeRunRecord = { ...original.run, caseRef, principalRef: versions.value.actor.principalRef,
    policyVersion: versions.value.actor.policyVersion, accessRevision: versions.value.actor.accessRevision }
  const output: ContributionEnvelope = { ...structuredClone(original.output), caseRef, evidenceRefs: [calculation], accessRevision: run.accessRevision }
  if (output.kind !== "MatchExplanation") throw new Error("Unexpected deterministic output fixture")
  output.payload.candidateCaseRef = caseRef
  output.outputDigest = digestSfContribution(output)
  const contributions = await runtime.authority.state.read(runtime.request(), "contributions", () => null)
  if (contributions.status !== "ok") throw new Error("Actual run namespace unavailable")
  // Seed the existing deterministic lifecycle record through actual C08. The
  // fixture does not invoke a provider or claim its receipt as native evidence.
  expect((await runtime.authority.state.transaction(runtime.request(), { namespace: "contributions", expectedStorageVersion: contributions.storageVersion,
    targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "fixture-running-record", commandDigest: digestSfValue(run) }, async (state) => {
    state.nativeRuns ??= {}
    state.nativeRuns[run.runRef] = structuredClone(run)
    return { commit: true, value: true }
  })).status).toBe("ok")
  const currentCase = await runtime.authority.state.read(runtime.request(), "cases", () => null)
  if (currentCase.status !== "ok") throw new Error("Actual case namespace unavailable")
  expect((await runtime.authority.state.transaction(runtime.request(), { namespace: "cases", expectedStorageVersion: currentCase.storageVersion,
    targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "fixture-case-advance", commandDigest: digestSfValue([caseRef, 2]) }, async (state) => {
    state.cases[caseRef.id]!.version = 2
    return { commit: true, value: true }
  })).status).toBe("ok")
  const reopen = async () => phase("fixture.restart", async () => {
    runtime.business.dispose()
    services.current = undefined
    await store.dispose()
    store = observeStore(await openLocalStore(storeDirectory))
    runtime = await open(false)
    return runtime
  })
  const change = async (work: (state: SfProductState) => void) => store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    if (!state?.cases || !state.atlas) throw new Error("Actual persisted fixture state unavailable")
    work(state)
    return { commit: true, value: undefined }
  })
  return { runtime, caseRef, calculation, control, start, run, output, reopen, change, at, phase, metrics }
}

function settlement(fixture: Awaited<ReturnType<typeof staleCalculationFixture>>, options: {
  afterPrivateRead?: (call: TrustedDomainContext) => Promise<void>
  privateRequest?: (request: Request) => Request
  afterPrivateAdmission?: (call: TrustedUiContext) => void
} = {}) {
  const { runtime, caseRef, calculation, start, run, phase, metrics } = fixture
  const settlementId = ++metrics.settlements
  const { authority, business, persistence } = runtime
  const controller = new AbortController(), base = runtime.request()
  const request = new Request(base, { signal: AbortSignal.any([base.signal, controller.signal]) })
  const privateCalls: TrustedUiContext[] = []
  const privateStates: string[][] = []
  let originalCall: TrustedDomainContext | undefined
  const human = { ...authority.human, admit: async (...args: Parameters<typeof authority.human.admit>) => {
    const admitted = await authority.human.admit(originalCall && options.privateRequest ? options.privateRequest(args[0]) : args[0], args[1], args[2])
    if (originalCall && admitted.status === "ok") { metrics.privateAdmissions++; privateCalls.push(admitted.value); options.afterPrivateAdmission?.(admitted.value) }
    return admitted
  } }
  const currentAuthority = { host: authority.host, human }
  const stale = createSfStaleAnalysisAccess({ authority: currentAuthority, persistence, request, start,
    proof: { runRef: run.runRef, caseRef, contextFingerprint: run.contextFingerprint, evidenceRefs: [calculation] },
    context: { context: async (selection, call) => {
      const read = ++metrics.contextReads
      const privateRead = call !== originalCall
      if (privateRead) metrics.privateContextReads++
      const sources = await phase(`settlement.${settlementId}.context.${privateRead ? "private" : "original"}.${read}`,
        () => business.context.context(selection, call))
      if (call !== originalCall) {
        privateStates.push(sources.map((source) => source.state))
        await options.afterPrivateRead?.(call)
      }
      return sources
    } } })
  const raw = createSfRunStore({ state: authority.state, requestFor: authority.host.requestFor, revalidate: authority.host.revalidate,
    preflight: async (record, call, output) => {
      if (record.state === "stale") return phase(`settlement.${settlementId}.preflight`, () => stale.preflight(record, call, output))
      const selected = await business.selectedCase(call)
      if (selected.status !== "ok" || digestSfValue(selected.value) !== digestSfValue(record.caseRef)) return { status: "denied", reason: "fixture-original-selector-unavailable" }
      return persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { status: "ok" as const, value: { sourceFence: sfRunSourceFence(snapshot) } } }))
    },
    revalidateForCommit: async (record, call, snapshot, output) => {
      expect(privateCalls.every((privateCall) => authority.host.requestFor(privateCall) === undefined)).toBe(true)
      if (record.state !== "stale") return { status: "denied", reason: "fixture-fresh-publication-unavailable" }
      const result = await phase(`settlement.${settlementId}.commit`, () => stale.commit(record, call, snapshot, output))
      expect(privateCalls.every((privateCall) => authority.host.requestFor(privateCall) === undefined)).toBe(true)
      return result
    }, now: () => fixture.at })
  const store = stale.wrapStore(raw)
  const enter = createSfAnalysisRunContext({ authority: currentAuthority, business, request, runRef: run.runRef, caseRef, start,
    active: () => fixture.control.active, replayContexts: new WeakMap() })
  const withRun = async <T>(action: (call: TrustedDomainContext) => Promise<PortResult<T>>) => phase(`settlement.${settlementId}.with-run`, () => enter(run.runRef, async (call) => {
    originalCall = call
    try { return await action(call) } finally { originalCall = undefined }
  }))
  return { withRun, store, stale, raw, privateCalls, privateStates, request, controller }
}

async function withStaleCalculation(name: string, work: (fixture: Awaited<ReturnType<typeof staleCalculationFixture>>) => Promise<void>) {
  const deadline = compositionTestDeadline(`analysis-stale-calculation.${name}`, 105_000)
  try {
    const fixture = await deadline.phase("fixture.prepare", () => staleCalculationFixture(deadline, name))
    await fixture.phase("scenario", () => work(fixture))
  }
  finally { await deadline.close() }
}

test("Late captured calculation settles its original output after case advance without changing the active selector, and survives restart", async () => {
  expectSpawn(import.meta.path)
  await withStaleCalculation("settlement-and-restart", async (fixture) => {
    const { runtime, calculation, caseRef, run, output } = fixture
    const originalOutput = digestSfValue(output)
    const access = settlement(fixture)
    const settled = await access.withRun(async (call) => {
      expect((await runtime.business.selectedCase(call)).status).toBe("unavailable")
      const scoped = await fixture.phase("positive.original-scoped-read", () => runtime.business.context.resolve(calculation, call))
      expect(scoped.state).toBe("unavailable")
      expect(scoped.authorizedProjection).toBeUndefined()
      const result = await fixture.phase("positive.preserve-stale", () => access.store.preserveStale(run.runRef, "case-changed", output, call))
      expect((await runtime.business.selectedCase(call)).status).toBe("unavailable")
      expect((await fixture.phase("positive.original-current-issue", () => runtime.business.calculations.issue(calculation.target.runId, call))).status).toBe("unavailable")
      return result
    })
    expect(settled).toMatchObject({ status: "ok", value: { state: "stale", version: run.version + 1, caseRef, outputRef: output.id } })
    expect(access.privateCalls).toHaveLength(2)
    expect(access.privateStates).toEqual([["historical"], ["historical"]])
    expect(access.privateCalls.every((call) => runtime.authority.host.requestFor(call) === undefined)).toBe(true)
    expect(digestSfValue(output)).toBe(originalOutput)
    const reopened = await fixture.reopen()
    const saved = await reopened.authority.state.read(reopened.request(), "contributions", (state) => ({ run: state.nativeRuns?.[run.runRef], output: state.contributions[output.id] }))
    if (saved.status !== "ok" || !saved.value.run || !saved.value.output) throw new Error("Durable original output unavailable")
    expect(saved.value.run).toMatchObject({ state: "stale", caseRef, outputRef: output.id, version: run.version + 1 })
    expect(digestSfValue(saved.value.output)).toBe(originalOutput)
    const current = await reopened.authority.state.read(reopened.request(), "cases", (state) => state.cases[caseRef.id])
    expect(current.status === "ok" && current.value?.version).toBe(2)
    const again = settlement({ ...fixture, runtime: reopened })
    expect(await fixture.phase("positive.reopened-lifecycle", () => again.withRun((call) => again.store.readLifecycle(run.runRef, call)))).toMatchObject({ status: "ok", value: { state: "stale", caseRef } })
    expect(await fixture.phase("positive.reopened-publication-refusal", () => again.withRun((call) => again.store.publish(run.runRef, run.version + 1, output, call))))
      .toEqual({ status: "conflict", reason: "invalid-run-output" })
  })
}, 120_000)

test("Late calculation settlement rejects another case, a later producer, missing ledger/capture and changed sources without writing output", async () => {
  expectSpawn(import.meta.path)
  await withStaleCalculation("lineage-and-source-fences", async (fixture) => {
    const { runtime, caseRef, calculation, run, output } = fixture
    const held: { snapshot?: Snapshot } = {}
    const mutation = settlement(fixture, { afterPrivateRead: async () => {
      if (!held.snapshot) throw new Error("Real shared C08 snapshot unavailable")
      held.snapshot.data.changedDuringPrivateRead = true
    } })
    if (!run.native) throw new Error("Deterministic running fixture unavailable")
    const pending: SfNativeRunRecord = { ...run, native: run.native, state: "stale", version: run.version + 1, outputRef: output.id }
    const transactionAll = runtime.persistence.transactionAll
    if (!transactionAll) throw new Error("Actual shared C08 transaction unavailable")
    expect(await mutation.withRun((call) => transactionAll(async (snapshots) => {
      held.snapshot = snapshots.dashboard
      try { return { commit: false, value: await mutation.stale.preflight(pending, call, output) } }
      finally { delete held.snapshot }
    }))).toEqual({ status: "denied", reason: "analysis-stale-access-unavailable" })
    expect(mutation.privateStates).toEqual([["historical"]])
    expect(mutation.privateCalls.every((call) => runtime.authority.host.requestFor(call) === undefined)).toBe(true)
    const before = await runtime.authority.state.read(runtime.request(), "cases", (state) => ({ decision: state.cases[caseRef.id], result: state.decisionResults?.[calculation.target.runId], atlas: state.atlas }))
    if (before.status !== "ok" || !before.value.decision || !before.value.result) throw new Error("Real captured calculation unavailable")
    const original = { ...before.value, decision: before.value.decision, result: before.value.result }
    const restore = (state: SfProductState) => {
      state.cases[caseRef.id] = structuredClone(original.decision)
      state.decisionResults![calculation.target.runId] = structuredClone(original.result)
      state.atlas = structuredClone(original.atlas)
    }
    const mutations: readonly { mutate: (state: SfProductState) => void; reason: string }[] = [
      { mutate: (state) => { state.decisionResults![calculation.target.runId]!.caseRef.id = "other-case" }, reason: "analysis-stale-access-unavailable" },
      { mutate: (state) => { state.decisionResults![calculation.target.runId]!.caseRef.incarnation = "replaced-incarnation" }, reason: "analysis-stale-access-unavailable" },
      { mutate: (state) => { state.decisionResults![calculation.target.runId]!.caseRef.version = 2 }, reason: "analysis-stale-access-unavailable" },
      { mutate: (state) => { state.cases[caseRef.id]!.ledger = [] }, reason: "analysis-stale-access-unavailable" },
      { mutate: (state) => { state.atlas = {} }, reason: "analysis-stale-access-unavailable" },
      { mutate: (state) => { state.cases[caseRef.id]!.participants = [] }, reason: "run-case-access-unavailable" },
    ]
    const access = settlement(fixture)
    expect(await access.withRun(async (call) => {
      // Mutate only after the original case scope was admitted, so these
      // counterexamples exercise settlement rather than an earlier UI guard.
      for (const entry of mutations) {
        await fixture.change((state) => { restore(state); entry.mutate(state) })
        expect(await access.store.preserveStale(run.runRef, "case-changed", output, call))
          .toEqual({ status: "denied", reason: entry.reason })
        expect(access.privateCalls.every((privateCall) => runtime.authority.host.requestFor(privateCall) === undefined)).toBe(true)
      }
      await fixture.change(restore)
      const saved = await runtime.authority.state.read(runtime.request(), "contributions", (state) => ({ run: state.nativeRuns?.[run.runRef], output: state.contributions[output.id] }))
      expect(saved.status === "ok" && saved.value.run).toEqual(run)
      expect(saved.status === "ok" && saved.value.output).toBeUndefined()
      await runtime.persistence.transaction("planner", async (snapshot) => {
        snapshot.data.entities = [{ id: "source-drift", name: "Changed after original capture" }]
        return { commit: true, value: undefined }
      })
      expect(await access.store.preserveStale(run.runRef, "case-changed", output, call))
        .toEqual({ status: "denied", reason: "analysis-stale-access-unavailable" })
      return { status: "ok", value: true }
    })).toEqual({ status: "ok", value: true })
    const after = await runtime.authority.state.read(runtime.request(), "contributions", (state) => ({ run: state.nativeRuns?.[run.runRef], output: state.contributions[output.id] }))
    expect(after.status === "ok" && after.value.run).toEqual(run)
    expect(after.status === "ok" && after.value.output).toBeUndefined()
  })
}, 120_000)

test("Private historical read refuses a substituted Request, first or last authorization loss, and closes every admitted lease", async () => {
  expectSpawn(import.meta.path)
  await withStaleCalculation("private-authority-boundaries", async (fixture) => {
    const { runtime, run, output, control } = fixture
    for (const fault of ["request", "first-authorize", "last-authorize", "finish"] as const) {
      let fired = false
      const access = settlement(fixture, {
        privateRequest: fault === "request" ? (request) => { fired = true; return new Request(request) } : undefined,
        afterPrivateAdmission: fault === "first-authorize" ? () => { fired = true; control.active = false } : undefined,
        afterPrivateRead: fault === "last-authorize" || fault === "finish" ? async (call) => {
          fired = true
          if (fault === "last-authorize") control.active = false
          else if (call.kind === "ui") runtime.authority.human.finish(call)
        } : undefined,
      })
      try {
        const denied = await fixture.phase(`fault.${fault}`, () => access.withRun((call) => access.store.preserveStale(run.runRef, "case-changed", output, call)))
        expect(fired).toBe(true)
        expect(denied).toEqual({ status: "denied", reason: fault === "first-authorize" || fault === "last-authorize"
          ? "analysis-authority-unavailable" : "analysis-stale-access-unavailable" })
        expect(access.privateCalls.every((call) => runtime.authority.host.requestFor(call) === undefined)).toBe(true)
      } finally { control.active = true }
      const saved = await runtime.authority.state.read(runtime.request(), "contributions", (state) => ({ run: state.nativeRuns?.[run.runRef], output: state.contributions[output.id] }))
      expect(saved.status === "ok" && saved.value.run).toEqual(run)
      expect(saved.status === "ok" && saved.value.output).toBeUndefined()
    }
  })
}, 120_000)
