import { expect, test } from "bun:test"
import { join } from "node:path"
import { KNOWN_SCANNERS } from "@orchestra/atlas-boundary/native-memory"
import { BackendToolkit } from "@orchestra/core/backend-toolkit"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent, DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { plannerValueRef } from "../../../../product/planner/scenario-inputs.ts"
import { createPlannerOperationVerifier } from "../../../../product/planner/operation-verifier.ts"
import { createSfScenarioOperationAccess } from "../../../../../../../apps/cli/src/sucafina-product/scenario-operation-access.ts"
import { createSfRecordedPlannerOperationAccess } from "../../../../../../../apps/cli/src/sucafina-product/recorded-planner-operation-access.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Scenario results are produced by the real Planner. Case promotion/ledger data
// are explicit C08 fixtures, not human or native execution evidence. Atlas uses
// its real durable writer and pinned scanner; no original capture is injected.
test("stored Planner operations read protected originals after drift while new execution stays current", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("planner-recorded-history", 165_000)
  try {
    const f = await deadline.phase("actual-producers-and-archive", () => historicalFixture(deadline))
    const originalCase = structuredClone(f.decision)
    const originalProjection = await f.business.context.resolve(f.ref, f.call)
    expect(originalProjection.state).toBe("fresh")
    await f.setForecast(150, "v1")
    expect((await f.business.plannerSources.resolveForecastSource(f.ref.refId, f.call)).status).toBe("ok")
    expect(await deadline.phase("historical-replacement-only", () => f.access(f.decision, f.call))).toBe(true)
    await f.setForecast(160)
    expect((await f.business.plannerSources.resolveForecastSource(f.ref.refId, f.call)).status).toBe("stale")
    const before = f.reads.coverage
    const historical = await deadline.phase("historical-source", () => f.business.context.resolve(f.ref, f.call))
    expect(historical.state).toBe("historical")
    expect(historical.authorizedProjection).toEqual(originalProjection.authorizedProjection)
    expect(historical.currentRef?.refDigest).not.toBe(f.ref.refDigest)
    expect(await deadline.phase("stored-operation-access", () => f.access(f.decision, f.call))).toBe(true)
    const opened = await deadline.phase("composed-case-read", () => f.business.cases.read({ caseRef: encodeCaseRef(f.decision) }, f.call))
    expect(opened.status).toBe("ok")
    if (opened.status !== "ok") throw new Error(opened.reason)
    expect(opened.value.case.alternatives).toEqual(originalCase.alternatives)
    expect(f.decision).toEqual(originalCase)
    expect(f.reads.coverage).toBe(before)
    expect(f.decision.alternatives[0]!.result.components.find((entry) => entry.id === "line:2")?.amount).toBe(80)
    expect(f.decision.alternatives[1]!.result.components.find((entry) => entry.id === "line:2")?.amount).toBe(100)
    const verify = createPlannerOperationVerifier({ host: f.authority.host, planner: f.business.planner, sources: f.business.plannerSources,
      scenarioInputs: f.business.plannerProduct.scenarioInputs })
    expect(await verify(f.decision.alternatives[0]!.scenario, f.call)).toBe(false)
    expect((await f.business.planner.simulateScenario(f.decision.alternatives[0]!.scenario, f.call)).status).not.toBe("ok")
    expect((await f.business.plannerProduct.scenarioInputs.resolveAmount(f.decision.alternatives[1]!.scenario.operations[0]!.replacementRef!, f.call)).status).not.toBe("ok")
  } finally { await deadline.close() }
}, 180_000)

test("stored Planner historical access rejects unrecorded input, missing capture, read races, cycles and replacement", async () => {
  expectSpawn(import.meta.path)
  const deadline = compositionTestDeadline("planner-recorded-history-negative", 165_000)
  const during: { action?: () => Promise<void> } = {}
  try {
    const f = await deadline.phase("actual-producers-and-archive", () => historicalFixture(deadline, async () => {
      const action = during.action
      delete during.action
      await action?.()
    }))
    await f.setForecast(160)
    expect(await deadline.phase("positive-before-faults", () => f.access(f.decision, f.call))).toBe(true)
    const unrecorded = structuredClone(f.decision)
    unrecorded.alternatives[0]!.scenario.operations[0]!.amount = 1
    expect(await deadline.phase("unrecorded-operation", () => f.access(unrecorded, f.call))).toBe(false)
    const saved = await f.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.__sfProductV1) as SfProductState }))
    const fault = (change: (state: SfProductState) => void) => f.store.transaction("dashboard", async (snapshot) => {
      snapshot.data.__sfProductV1 = structuredClone(saved)
      change(snapshot.data.__sfProductV1 as SfProductState)
      return { commit: true, value: undefined }
    })
    // Fault injection edits protected bytes only in the isolated test store.
    await fault((state) => { state.atlas = {} })
    expect(await deadline.phase("missing-protected-capture", () => f.access(f.decision, f.call))).toBe(false)
    await fault(() => {})
    expect(await deadline.phase("restored-capture", () => f.access(f.decision, f.call))).toBe(true)
    const nestedSelector = structuredClone(f.decision)
    const nestedOperation = nestedSelector.alternatives[1]!.scenario.operations[0]!
    nestedOperation.replacementRef = plannerValueRef(nestedOperation.replacementRef!, "line:2:forecast")
    await fault((state) => { state.cases[f.decision.id] = nestedSelector })
    expect(await deadline.phase("nested-selector", () => f.access(nestedSelector, f.call))).toBe(false)
    await fault(() => {})
    during.action = async () => { await f.setForecast(170) }
    expect(await deadline.phase("source-race", () => f.access(f.decision, f.call))).toBe(false)
    expect(during.action).toBeUndefined()
    expect(await deadline.phase("fresh-source-after-race", () => f.access(f.decision, f.call))).toBe(true)
    during.action = async () => { await fault((state) => { state.cases[f.decision.id]!.participants = [] }) }
    expect(await deadline.phase("membership-race", () => f.access(f.decision, f.call))).toBe(false)
    expect(during.action).toBeUndefined()
    await fault(() => {})

    let cyclic: ReturnType<typeof createSfScenarioOperationAccess> | undefined
    const nested: boolean[] = []
    const recorded = createSfRecordedPlannerOperationAccess({ host: f.authority.host, state: f.authority.state,
      resolveEvidence: async (ref, call) => {
        if (!cyclic) throw new Error("Cycle fixture is not initialized")
        nested.push(await cyclic(f.decision, call))
        return f.business.context.resolve(ref, call)
      } })
    cyclic = f.createAccess(recorded)
    expect(await cyclic(f.decision, f.call)).toBe(false)
    expect(nested).toEqual([false])
    expect(await deadline.phase("after-cycle", () => f.access(f.decision, f.call))).toBe(true)

    const revoked = await f.read()
    try {
      f.active.value = false
      expect(await f.access(f.decision, revoked)).toBe(false)
    } finally { f.active.value = true; f.authority.ui.finish(revoked) }
    expect(await deadline.phase("after-principal-revocation", () => f.access(f.decision, f.call))).toBe(true)

    await f.persistence.transaction("planner", async (snapshot) => { snapshot.data.versions = []; return { commit: true, value: undefined } })
    await f.setForecast(170)
    expect(await deadline.phase("replaced-source-incarnation", () => f.access(f.decision, f.call))).toBe(false)
    expect((await f.business.cases.read({ caseRef: encodeCaseRef(f.decision) }, f.call)).status).not.toBe("ok")
  } finally { await deadline.close() }
}, 180_000)

async function historicalFixture(deadline: ReturnType<typeof compositionTestDeadline>, beforeEnvironment?: () => Promise<void>) {
  const f = await financialCompositionFixture({ signal: deadline.signal, atlas: true, beforeEnvironment: async () => {
    deadline.check()
    await beforeEnvironment?.()
    deadline.check()
  } })
  deadline.own(() => f.dispose())
  const call = await f.read()
  deadline.own(() => f.authority.ui.finish(call))
  const known = KNOWN_SCANNERS.find((entry) => entry.name === "gitleaks")
  if (!known) throw new Error("Pinned Atlas scanner spec unavailable")
  const ready = await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, join(f.directory, "toolkit"))))
  const spec = { ...known, command: ready.executable }
  const probe = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], {
    extendEnv: true, stdin: "ignore",
  }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
  const version = probe.stdout.toString("utf8").trim()
  if (probe.exitCode !== 0 || !version || probe.stdoutTruncated) throw new Error("Real Atlas scanner version unavailable")
  f.business.initializeAtlas({ spec, version }, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const caseRef = { id: "planner-history-case", incarnation: "planner-history-incarnation", version: 1 }
  const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Read retained Planner decisions", horizon: period, currency: "USD",
    criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const forecast = (id: string, amount: number) => ({ id, name: "History forecast", year: 2026, closed: 0,
    lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(amount) }],
    fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })
  const amounts = { v0: 100, v1: 100 }
  const setForecast = (amount: number, id: "v0" | "v1" = "v0") => f.persistence.transaction("planner", async (snapshot) => {
    amounts[id] = amount
    snapshot.data.versions = [forecast("v0", amounts.v0), forecast("v1", amounts.v1)]
    return { commit: true, value: undefined }
  })
  await setForecast(100)
  const seeded = await f.authority.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: 0,
    targetRef: f.authority.creationTarget.ref, targetIncarnation: f.authority.creationTarget.incarnation,
    idempotencyKey: "planner-history-case", commandDigest: digestSfValue(initial) }, async (state) => {
    state.cases[caseRef.id] = initial
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Historical case fixture unavailable")
  const reads = { coverage: 0 }
  f.business.bindForecastCoverage(async (reference, context) => {
    reads.coverage++
    const source = await f.business.plannerSources.resolveForecastSource(reference, context)
    if (source.status !== "ok") return source
    return { status: "ok", value: { coverageRef: "fixture:history-pending-coverage", basis: { id: "history-basis", version: 1,
      decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
      assessment: { basisId: "history-basis", basisVersion: 1, alternativeId: "history", alternativeVersion: 1, currency: "USD", horizon: period,
        issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
        entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
  })
  const produced = await f.business.withCase(call, caseRef, {}, async () => {
    const source = await f.business.plannerProduct.issueSource("v0", call)
    if (source.status !== "ok") return source
    const replacement = await f.business.plannerProduct.issueSource("v1", call)
    if (replacement.status !== "ok") return replacement
    const scenario = { baseRef: source.value.evidence.refId, operations: [{ kind: "replace" as const, targetRef: "line:2", amount: 80,
      currency: "USD", period: { start: "2026-02-01", end: "2026-02-28" } }], assumptions: [] }
    const referenced = { baseRef: scenario.baseRef, operations: [{ kind: "replace" as const, targetRef: "line:2",
      replacementRef: plannerValueRef(replacement.value.evidence.refId, "line:2:forecast") }], assumptions: [] }
    const first = await f.business.planner.simulateScenario(scenario, call)
    if (first.status !== "ok") return first
    const second = await f.business.planner.simulateScenario(referenced, call)
    if (second.status !== "ok") return second
    return { status: "ok", value: { ref: source.value.evidence, replacement: replacement.value.evidence, alternatives: [
      { id: "literal", version: 1, title: "Produced literal operation", scenario, result: first.value },
      { id: "reference", version: 1, title: "Produced amount reference", scenario: referenced, result: second.value },
    ] } }
  })
  if (produced.status !== "ok") throw new Error(produced.reason)
  const ref = produced.value.ref
  const sourceRefs = [ref, produced.value.replacement]
  const event: CaseLedgerEvent = { id: "history-event", caseRef, kind: "analysis-accepted", principalRef: "person", at: f.clock.at,
    consideredActions: ["literal", "reference"], factualGaps: ["training"], lifecycleState: "comparing",
    rationale: "Retain the produced operational scenarios without complete coverage", evidenceRefs: sourceRefs, outputDigest: digestSfValue(produced.value.alternatives) }
  const eventBase: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "planner-history-event",
    installationId: call.binding.installationId, projectId: call.binding.projectId, refDigest: "", evidenceLevel: "decision",
    target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: sourceRefs } }
  const eventRef = { ...eventBase, refDigest: digestSfEvidenceRef(eventBase) }
  const decision: DecisionCase = { ...initial, sourceRefs, alternatives: produced.value.alternatives, ledger: [event] }
  const before = await f.authority.state.read(f.request(), "cases", (state) => state.versions)
  if (before.status !== "ok") throw new Error("Historical case storage unavailable")
  const stored = await f.authority.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: before.value.cases,
    additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: before.value.outbox }], targetRef: caseRef.id, targetIncarnation: caseRef.incarnation,
    idempotencyKey: "planner-history-produced", commandDigest: digestSfValue(decision) }, async (state) => {
    state.cases[caseRef.id] = decision
    state.outbox[JSON.stringify([caseRef.id, caseRef.incarnation, event.id])] = { eventRef, writerPrincipalRef: "person",
      accessRevision: call.binding.accessRevision, createdAt: f.clock.at, attempts: 0, state: "pending" }
    return { commit: true, value: true }
  })
  if (stored.status !== "ok") throw new Error("Produced historical scenario unavailable")
  const archived = await f.business.context.emitFromLedger(eventRef, call)
  if (archived.status !== "committed") throw new Error(`Real Atlas capture failed: ${JSON.stringify(archived)}`)
  const createAccess = (recordedPlanner: ReturnType<typeof createSfRecordedPlannerOperationAccess>) => createSfScenarioOperationAccess({ host: f.authority.host,
    sources: f.business.plannerSources, projectPlanner: f.business.projectPlannerEvidence, scenarioInputs: f.business.plannerProduct.scenarioInputs,
    readSourceFences: f.business.readSourceFences, resolveProcurementEvidence: f.business.context.resolve,
    externalOperation: f.business.dashboardDecisions.resolveOperation, recordedPlanner })
  const access = createAccess(createSfRecordedPlannerOperationAccess({ host: f.authority.host, state: f.authority.state, resolveEvidence: f.business.context.resolve }))
  return { ...f, call, decision, ref, reads, setForecast, access, createAccess }
}
