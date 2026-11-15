import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { KNOWN_SCANNERS } from "@orchestra/atlas-boundary/native-memory"
import { BackendToolkit } from "@orchestra/core/backend-toolkit"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AbsolutePath } from "@orchestra/core/schema"
import { Location } from "@orchestra/core/location"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { domain } from "../../../runtime/procurement.ts"
import { object } from "../../../runtime/contract.ts"
import type { Actor, Command } from "../../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { plannerValueRef } from "../../../product/planner/scenario-inputs.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfScenarioOperationAccess } from "../../../../../../apps/cli/src/sucafina-product/scenario-operation-access.ts"
import { createSfRecordedPlannerOperationAccess } from "../../../../../../apps/cli/src/sucafina-product/recorded-planner-operation-access.ts"
import { compositionTestDeadline } from "../wp10/integration/composition-test-deadline.ts"

export const mixedPeriod = { start: "2026-01-01", end: "2026-12-31" }

// Synthetic identity and C08 membership; real SQLite, source issuers, mixed
// scenario, authority, Atlas capture and scanner. No original or grant is seeded.
export async function createMixedPlannerFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-mixed-contracts-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) })
  const identity = { principal: "person", allowed: true, canWrite: true }
  const clock = { at: "2026-11-14T00:00:00Z" }
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => clock.at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
    snapshot.data.opexOwners = [{ id: "owner", name: "Operations", budget: 1200 }]
    snapshot.data.opexEntries = []
    snapshot.data.capexProjects = []
    snapshot.data.capexEntries = []
    return { commit: true, value: undefined }
  })
  const guards = { proposalCoverageWrites: new WeakSet<object>(), dashboardHostWrites: new WeakSet<object>(), procurementEvidenceWrites: new WeakSet<object>(),
    caseSelectionWrites: new WeakSet<object>(), threadHistoryWrites: new WeakSet<object>(), analysisSelectionWrites: new WeakSet<object>() }
  const config: Parameters<typeof createSfProductAuthority>[0] = {
    installationId: "installation", origin: "https://example.test", policyVersion: "mixed-policy", persistence, ...guards,
    identity: () => ({ installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    grants: ["person", "other"].map((principalRef) => ({ principalRef,
      namespaces: ["cases", "preferences", "bi-artifacts", "reviews", "documents", "threads", "relations", "confirmations", "receipts", "outbox", "atlas"],
      operations: ["sf_work_list", "sf_review_prepare", "sf_case_read", "sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare"], humanActions: [] })),
    createId: randomUUID, now: Date.now, commandIdentity: async (request) => request.headers.get("x-operation") ?? randomUUID(),
    authenticate: async (_request, context) => identity.allowed && context ? { id: identity.principal, canWrite: identity.canWrite,
      roles: [{ surface: context.surface, role: "admin" }] } : null,
    environment: async () => { deadline.check(); return { at: clock.at, id: randomUUID, directory: [{ id: "person", name: "Person" }, { id: "other", name: "Other" }] } },
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => 1, authorizeDocument: async () => undefined,
  }
  const authority = createSfProductAuthority(config)
  const business = createSfBusinessServices({ authority, persistence, ...guards })
  deadline.own(() => business.dispose())
  business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
  const controller = new AbortController()
  const request = (operation = randomUUID()) => new Request("https://example.test/dashboard", { method: "POST",
    signal: AbortSignal.any([deadline.signal, controller.signal]), headers: { origin: "https://example.test", "x-operation": operation } })
  const admit = async (operation = "sf_review_prepare", value: unknown = { purpose: "mixed-contract-read" }) => {
    const transport = request(), digest = digestSfValue(value)
    const admitted = await authority.ui.admit(transport, operation, digest)
    if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digest)) throw new Error("Real mixed authority admission failed")
    deadline.own(() => authority.ui.finish(admitted.value))
    return { call: admitted.value, transport }
  }
  const { call, transport } = await admit()
  const execute = async (command: Command) => persistence.transaction("procurement", async (snapshot) => {
    const actor: Actor = { id: "person", roles: ["admin"], canWrite: true }
    const result = domain.execute(snapshot, actor, command, { at: clock.at, id: randomUUID, directory: [{ id: "person", name: "Person" }] })
    return { commit: result.ok, value: result }
  })
  if (!(await execute({ page: "Settings", action: "reset", version: 0, values: {} })).ok) throw new Error("Real Settings initialization failed")
  const created = await execute({ page: "Requests", action: "create", version: 0, values: { pr: { title: "Mixed contract source", type: "service",
    description: "Real mutable source for mixed historical authorization", estAmount: 100, recurring: false, expenseType: "OPEX", costCenter: "IT",
    needBy: "2026-12-01", justification: "Compare a read-only external hypothesis" } } })
  if (!created.ok) throw new Error("Real request creation failed")
  const requestId = String(object(created.value).number)
  const selection = await admit("sf_work_list", { purpose: "work-selection", period: mixedPeriod })
  const selected = await business.procurementSelections.create(selection.call, mixedPeriod)
  if (selected.status !== "ok") throw new Error(`Real Procurement period selection failed: ${selected.reason}`)
  authority.ui.finish(selection.call)
  const amounts = { base: 100, replacement: 80 }
  const setForecast = (amount: number, id: "base" | "replacement" = "base") => persistence.transaction("planner", async (snapshot) => {
    amounts[id] = amount
    snapshot.data.versions = Object.entries(amounts).map(([versionId, forecast]) => ({ id: versionId, name: `Mixed ${versionId}`, year: 2026, closed: 0,
      lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(forecast) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }))
    return { commit: true, value: undefined }
  })
  await setForecast(100)
  const caseRef = { id: "mixed-recorded-case", incarnation: "mixed-recorded-incarnation", version: 1 }
  const initial: DecisionCase = { ...caseRef, state: "comparing", objective: "Retain a mixed result without financial approval", horizon: mixedPeriod, currency: "USD",
    criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const saveCase = async (value: DecisionCase, eventRef?: Extract<BusinessEvidenceRef, { kind: "case-event" }>) => {
    const versions = await authority.state.read(transport, "cases", (state) => state.versions)
    if (versions.status !== "ok") throw new Error("Real C08 versions unavailable")
    const saved = await authority.state.transaction(transport, { namespace: "cases", expectedStorageVersion: versions.value.cases,
      ...(eventRef ? { additionalNamespaces: [{ namespace: "outbox" as const, expectedStorageVersion: versions.value.outbox }] } : {}),
      targetRef: versions.value.cases === 0 ? authority.creationTarget.ref : caseRef.id,
      targetIncarnation: versions.value.cases === 0 ? authority.creationTarget.incarnation : caseRef.incarnation,
      idempotencyKey: randomUUID(), commandDigest: digestSfValue(value) }, async (state) => {
      state.cases[caseRef.id] = structuredClone(value)
      if (eventRef) state.outbox[JSON.stringify([caseRef.id, caseRef.incarnation, eventRef.target.eventId])] = {
        eventRef, writerPrincipalRef: "person", accessRevision: call.binding.accessRevision, createdAt: clock.at, attempts: 0, state: "pending" }
      return { commit: true, value: true }
    })
    if (saved.status !== "ok") throw new Error(`Real C08 fixture persistence failed: ${saved.reason}`)
  }
  await saveCase(initial)
  business.bindForecastCoverage(async (reference, context) => {
    const source = await business.plannerSources.resolveForecastSource(reference, context)
    if (source.status !== "ok") return source
    return { status: "ok", value: { coverageRef: "fixture:mixed-pending-coverage", basis: { id: "mixed-basis", version: 1,
      decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
      assessment: { basisId: "mixed-basis", basisVersion: 1, alternativeId: "mixed", alternativeVersion: 1, currency: "USD", horizon: mixedPeriod,
        issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
        entries: [{ status: "pending", categoryId: "training", reason: "No training evidence" }], derivedMissingCategoryIds: ["training"] } } }
  })
  const issued = await business.withCase(call, caseRef, {}, async () => {
    const base = await business.plannerProduct.issueSource("base", call)
    if (base.status !== "ok") return base
    const replacement = await business.plannerProduct.issueSource("replacement", call)
    if (replacement.status !== "ok") return replacement
    const procurement = await business.individual.issue("procurement-request", requestId, call)
    if (procurement.status !== "ok") return procurement
    const resolved = await business.individual.resolveForPreparation(procurement.value, call)
    if (resolved.status !== "ok") return resolved
    return { status: "ok", value: { base: base.value.evidence, replacement: replacement.value.evidence, procurement: resolved.value.evidence } }
  })
  if (issued.status !== "ok") throw new Error(`Real mixed source issuance failed: ${issued.reason}`)
  const refs = issued.value
  const sourceRefs = [refs.base, refs.replacement, refs.procurement]
  const attached = { ...initial, sourceRefs }
  await saveCase(attached)
  const scenario: ScenarioRequest = { baseRef: refs.base.refId, operations: [
    { kind: "replace", targetRef: refs.procurement.refId, amount: 140, currency: "USD", period: mixedPeriod },
    { kind: "replace", targetRef: "line:2", replacementRef: plannerValueRef(refs.replacement.refId, "line:2:forecast") },
  ], assumptions: [] }
  const result = await business.withCase(call, caseRef, {}, () => business.planner.simulateScenario(scenario, call))
  if (result.status !== "ok") throw new Error(`Real mixed scenario failed: ${JSON.stringify(result)}`)
  const alternative = { id: "mixed", version: 1, title: "Produced mixed scenario", scenario, result: result.value }
  const event: CaseLedgerEvent = { id: "mixed-analysis-event", caseRef, kind: "analysis-accepted", principalRef: "person", at: clock.at,
    consideredActions: [alternative.id], factualGaps: ["training", "external-procurement-cost"], lifecycleState: "comparing",
    rationale: "Record real mixed analysis, without selection, promotion, preparation or financial approval", evidenceRefs: sourceRefs, outputDigest: digestSfValue(alternative) }
  const baseEvent: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "mixed-analysis-event",
    installationId: call.binding.installationId, projectId: call.binding.projectId, refDigest: "", evidenceLevel: "decision",
    target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: sourceRefs } }
  const eventRef = { ...baseEvent, refDigest: digestSfEvidenceRef(baseEvent) }
  const decision: DecisionCase = { ...attached, alternatives: [alternative], ledger: [event] }
  await saveCase(decision)
  const archive = async () => {
    const known = KNOWN_SCANNERS.find((entry) => entry.name === "gitleaks")
    if (!known) throw new Error("Pinned Atlas scanner missing")
    const ready = await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(Effect.provideService(BackendToolkit.Root, join(directory, "toolkit"))))
    const spec = { ...known, command: ready.executable }
    const probe = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"], { extendEnv: true, stdin: "ignore" })))
      .pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const version = probe.stdout.toString("utf8").trim()
    if (probe.exitCode !== 0 || !version || probe.stdoutTruncated) throw new Error("Real scanner version unavailable")
    business.initializeAtlas({ spec, version }, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    await saveCase(decision, eventRef)
    const emitted = await business.context.emitFromLedger(eventRef, call)
    if (emitted.status !== "committed") throw new Error(`Real mixed Atlas capture failed: ${JSON.stringify(emitted)}`)
    return emitted
  }
  const observations: { fallback: number; refs: { id: string; state: string }[]; afterResolve?: (...args: Parameters<BusinessContextService["resolve"]>) => Promise<void> } = { fallback: 0, refs: [] }
  const resolve: BusinessContextService["resolve"] = async (ref, context) => {
    const found = await business.context.resolve(ref, context)
    observations.refs.push({ id: ref.refId, state: found.state })
    if (observations.afterResolve) await observations.afterResolve(ref, context)
    return found
  }
  const recorded = createSfRecordedPlannerOperationAccess({ host: authority.host, state: authority.state, resolveEvidence: resolve })
  const access = createSfScenarioOperationAccess({ host: authority.host, sources: business.plannerSources, projectPlanner: business.projectPlannerEvidence,
    scenarioInputs: business.plannerProduct.scenarioInputs, readSourceFences: business.readSourceFences, resolveProcurementEvidence: resolve,
    externalOperation: business.dashboardDecisions.resolveOperation, recordedPlanner: async (...args) => { observations.fallback++; return recorded(...args) } })
  const audit = () => Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) => persistence.transaction(surface, async (snapshot) =>
    ({ commit: false, value: structuredClone({ surface, data: snapshot.data, versions: snapshot.versions }) }))))
  const preview = (context: TrustedUiContext = call) => business.withCase(context, caseRef, {}, () => business.planner.simulateScenario(scenario, context))
  return { directory, store, persistence, identity, config, controller, clock, authority, business, request, transport, call, admit, execute, requestId,
    caseRef, refs, decision, scenario, alternative, setForecast, saveCase, archive, access, recorded, observations, resolve, audit, preview }
}
