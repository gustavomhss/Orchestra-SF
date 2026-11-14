import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfStaleAnalysisAccess } from "../../../../../../../apps/cli/src/sucafina-product/analysis-stale-commit.ts"
import type { SfAnalysisRequest } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { domain } from "../../../../runtime/procurement.ts"
import { object } from "../../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../../src/initial-settings.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { createChoiceSnapshot } from "../../../../product/decisions/choice.ts"
import { digestSfContribution, digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../../product/contracts/state.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult, CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../../product/contracts/operations.ts"
import type { DecisionRecallInput } from "../../../../product/contracts/skill-inputs.ts"
import { sfRunFixture } from "../../wp12/run-fixture.ts"
import { prepareAtlasScanner } from "../../wp02/atlas-consumer-fixture.ts"
import { compositionTestDeadline } from "../integration/composition-test-deadline.ts"
import atlasPackage from "../../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }

const period = { start: "2026-01-01", end: "2026-12-31" }
const caseRef = { id: "integrity-case", incarnation: "integrity-case-incarnation", version: 1 }
const at = "2026-11-14T00:00:00Z"

/** Synthetic chosen-case/lifecycle metadata, real source issuance, C12, C08/SQLite,
 * BCS, scanner and Atlas. This does not admit a native Session or execute a model. */
export async function withMemoryIntegrityFixture(work: (fixture: Awaited<ReturnType<typeof createFixture>>) => Promise<void>, scenario: string) {
  const deadline = compositionTestDeadline(`memory-integrity:${scenario}`, 105_000)
  try { await work(await createFixture(deadline)) }
  finally { await deadline.close() }
}

async function createFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-memory-integrity-"))
  await chmod(directory, 0o700)
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const scanner = await deadline.phase("scanner.real", () => prepareAtlasScanner(directory))
  const driver = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => driver.dispose())
  if (!driver.transactionAll) throw new Error("Real C08/SQLite transaction unavailable")
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "alice", status: "draft",
      pr: { title: "Integrity requisition", justification: "Recorded need", estAmount: 100 }, history: [], attachments: [] }, version: 0, by: "alice" } },
      suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-1"], po: [] } }
    snapshot.versions["requests:PR-1"] = { version: 0, by: "alice" }
    return { commit: true, value: undefined }
  })
  const origin = "https://memory-integrity.test"
  const access = { allowed: true }
  const request = () => new Request(`${origin}/sf/procurement`, { method: "POST", signal: deadline.signal,
    headers: { authorization: "alice", origin, "idempotency-key": randomUUID() } })
  const procurementEvidenceWrites = new WeakSet<object>()
  const proposalCoverageWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ installationId: "installation", origin, policyVersion: "policy", persistence,
    identity: () => ({ installationId: "installation", hostId: "memory-integrity", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
    grants: [{ principalRef: "alice", namespaces: ["cases", "preferences", "atlas", "outbox", "contributions"],
      operations: ["sf_work_list", "sf_request_read", "sf_case_read"], humanActions: ["decisions.prepare-changes", "analysis.prepare", "analysis.start", "analysis.cancel", "analysis.read"] }],
    authenticate: async (incoming, selection) => access.allowed && incoming.headers.get("authorization") === "alice" && selection
      ? { id: "alice", canWrite: true, roles: [{ surface: selection.surface, role: selection.surface === "procurement" ? "requester" : "admin" }] } : null,
    environment: async () => { deadline.check(); return { at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }] } },
    commandIdentity: async (incoming, operation, digest) => digestSfValue({ key: incoming.headers.get("idempotency-key"), operation, digest }),
    now: Date.now, createId: randomUUID, inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
    procurementEvidenceWrites, proposalCoverageWrites })
  const business = createSfBusinessServices({ authority, persistence, procurementEvidenceWrites, proposalCoverageWrites })
  deadline.own(() => business.dispose())
  const aiRoot = path.resolve(import.meta.dir, "../../../../product/ai")
  const bundle = await createResidentAiBundle({ root: aiRoot, manifestPath: path.join(aiRoot, "manifests/resident.json") })
  const atlas = business.initializeAtlas(scanner, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
    manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
  const selectionPayload = { purpose: "work-selection", period }
  const selected = await authority.ui.admit(request(), "sf_work_list", digestSfValue(selectionPayload))
  if (selected.status !== "ok") throw new Error("Procurement period admission unavailable")
  try {
    if (!await authority.ui.validate(selected.value, "sf_work_list", digestSfValue(selectionPayload))) throw new Error("Procurement selection lease unavailable")
    const selection = await business.procurementSelections.create(selected.value, period)
    if (selection.status !== "ok") throw new Error(selection.reason)
  } finally { authority.ui.finish(selected.value) }
  const payload = { request: "PR-1" }
  const issued = await authority.ui.admit(request(), "sf_request_read", digestSfValue(payload))
  if (issued.status !== "ok") throw new Error("Source issuance admission unavailable")
  const original = await (async () => {
    try {
      if (!await authority.ui.validate(issued.value, "sf_request_read", digestSfValue(payload))) throw new Error("Source issuance lease unavailable")
      const source = await business.individual.issue("procurement-request", "PR-1", issued.value)
      if (source.status !== "ok") throw new Error(source.reason)
      const resolved = await business.individual.resolve(source.value, issued.value)
      if (resolved.status !== "ok") throw new Error(resolved.reason)
      return resolved.value.evidence
    } finally { authority.ui.finish(issued.value) }
  })()
  const operation: ScenarioOperation = { kind: "replace", targetRef: original.refId, amount: 150, currency: "USD", period }
  const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "requisition", categoryIds: ["purchase"], additionalCategoryIds: [], sourceRefs: [original] }
  const result: ScenarioResult = { id: "result", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [original],
    unresolvedConditions: ["Explicit upstream fixture has pending coverage"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 150, total: null,
    costCoverage: { basisId: basis.id, basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period,
      issues: ["Coverage pending"], evaluatedSourceRefs: [original], coverageState: "pending", entries: [{ status: "pending", categoryId: "purchase", reason: "No complete cost assertion" }], derivedMissingCategoryIds: ["purchase"] } }
  const decision: DecisionCase = { ...caseRef, state: "chosen", objective: "Review source capture integrity", horizon: period, currency: "USD",
    participants: ["alice"], criteria: [{ id: "cost", description: "Budget impact", required: true }], sourceRefs: [original], assumptions: [], questions: [],
    alternatives: [{ id: "alternative", version: 1, title: "Explicit amount replacement", scenario: { baseRef: original.refId, operations: [operation], assumptions: [] }, result }],
    costCoverageBases: [basis], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const choice = createChoiceSnapshot({ case: decision, alternativeId: "alternative", alternativeVersion: 1,
    comparison: { baselineResultRef: "baseline", alternativeResultRef: result.id, costCoverageRefs: [], criterionResults: [], unresolvedConditions: result.unresolvedConditions,
      comparisonStatus: "conditioned", knownDifference: 50, completeDifference: null }, criteria: ["cost"], values: [], evidenceRefs: [original],
    id: "choice", principalRef: "alice", reason: "Review an explicitly seeded human choice", at })
  if (choice.status !== "ok") throw new Error(choice.reason)
  const event: CaseLedgerEvent = { id: "choice-event", caseRef, kind: "choice-recorded", principalRef: "alice", at,
    consideredActions: ["Explicit requisition replacement"], factualGaps: result.unresolvedConditions, lifecycleState: "chosen",
    rationale: "Preserve the original source considered for this choice", evidenceRefs: [original], outputDigest: digestSfValue(choice.choice) }
  const base: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "integrity-choice-event",
    installationId: "installation", projectId: "project", refDigest: "", evidenceLevel: "decision", target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation,
      caseVersion: 1, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: [original] } }
  const eventRef = { ...base, refDigest: digestSfEvidenceRef(base) }
  const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }],
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "integrity-choice", commandDigest: digestSfValue(eventRef) }, async (state, actor) => {
    state.cases[caseRef.id] = { ...decision, choices: [choice.choice], ledger: [event] }
    state.outbox[JSON.stringify([caseRef.id, caseRef.incarnation, event.id])] = { eventRef, writerPrincipalRef: actor.principalRef,
      accessRevision: actor.accessRevision, createdAt: at, attempts: 0, state: "pending" }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("C08 case fixture unavailable")
  const prepare = { caseRef, choiceId: choice.choice.id, operations: [operation] }
  const preparation = await authority.human.admit(request(), "decisions.prepare-changes", prepare)
  if (preparation.status !== "ok") throw new Error(preparation.reason)
  try {
    const commands = await business.procurementDecisions.prepareDomainCommands(caseRef, choice.choice.id, [operation], preparation.value)
    if (commands.status !== "ok" || commands.value.length !== 1) throw new Error("Real C12 original capture unavailable")
    const receipt = await business.context.emitFromLedger(eventRef, preparation.value)
    if (receipt.status !== "committed" || receipt.scanner.status !== "clean") throw new Error("Real Atlas capture unavailable")
  } finally { authority.human.finish(preparation.value) }
  const edit = async (amount: number) => {
    const edited = await persistence.transaction("procurement", async (snapshot) => {
      const outcome = domain.execute(snapshot, { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] },
        { page: "Requests", action: "save", id: "PR-1", version: snapshot.versions["requests:PR-1"]?.version ?? 0, values: { pr: { estAmount: amount } } },
        await authority.host.environment(request()))
      return { commit: outcome.ok, value: outcome }
    })
    if (!edited.ok) throw new Error(`Real source edit failed: ${edited.status}`)
  }
  const value: DecisionRecallInput = { currentCase: caseRef, recallScope: { cases: [caseRef], period, includeHistorical: true }, query: decision.objective }
  const skill = bundle.skills.find((entry) => entry.id === "sf-consultar-memoria-decisoria")!
  const profile = bundle.profiles.find((entry) => entry.id === "sf_maestro")!
  const analysis: SfAnalysisRequest = { caseRef, profileId: profile.id, profileVersion: profile.version, skillId: skill.id, skillVersion: skill.version,
    manifestDigest: bundle.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations, objective: value.query }
  const fixture = sfRunFixture()
  if (!fixture.run.native) throw new Error("Unexecuted lifecycle fixture metadata missing")
  const start = { request: analysis, skillInput: value, model: fixture.run.model }
  const staleRequest = request()
  const admit = async (incoming = staleRequest) => {
    const admitted = await authority.human.admit(incoming, "analysis.start", start)
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    return admitted.value
  }
  const call = await admit()
  const run: SfNativeRunRecord = { ...fixture.run, native: fixture.run.native, caseRef, principalRef: call.binding.principalRef,
    policyVersion: call.binding.policyVersion, accessRevision: call.binding.accessRevision }
  const output: ContributionEnvelope = { ...fixture.output, caseRef, evidenceRefs: [original], accessRevision: run.accessRevision }
  output.outputDigest = digestSfContribution(output)
  const record: SfNativeRunRecord = { ...run, native: fixture.run.native, version: run.version + 1, state: "stale", reason: "source-changed", outputRef: output.id }
  const proof = { runRef: run.runRef, caseRef, contextFingerprint: run.contextFingerprint, evidenceRefs: [original] }
  const stale = createSfStaleAnalysisAccess({ authority, persistence, context: business.context, request: staleRequest, start, proof })
  authority.human.finish(call)
  const seedRun = async () => {
    const prior = await authority.state.read(staleRequest, "contributions", () => null)
    if (prior.status !== "ok") throw new Error("Lifecycle fixture state unavailable")
    const saved = await authority.state.transaction(staleRequest, { namespace: "contributions", expectedStorageVersion: prior.storageVersion,
      targetRef: `case:${encodeURIComponent(caseRef.id)}:${encodeURIComponent(caseRef.incarnation)}`, targetIncarnation: caseRef.incarnation,
      idempotencyKey: "unexecuted-integrity-lifecycle", commandDigest: digestSfValue(run) }, async (state) => {
      state.nativeRuns ??= {}
      state.nativeRuns[run.runRef] = structuredClone(run)
      return { commit: true, value: true }
    })
    if (saved.status !== "ok") throw new Error("Lifecycle fixture could not be seeded")
  }
  const readAtlas = () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(object(snapshot.data.__sfProductV1).atlas) }))
  const mutateAtlas = (change: (partition: Record<string, unknown>, capture: Record<string, unknown>) => void) => persistence.transaction("dashboard", async (snapshot) => {
    const partitions = Object.values(object(object(snapshot.data.__sfProductV1).atlas))
    const partition = partitions.find((entry) => object(object(entry).originals)[original.refDigest])
    if (!partition) throw new Error("Canonical Atlas original missing")
    change(object(partition), object(object(object(partition).originals)[original.refDigest]))
    return { commit: true, value: undefined }
  })
  return { deadline, driver, persistence, authority, business, atlas, scanner, access, request, staleRequest, admit, start, proof,
    analysis, value, caseRef, original, eventRef, edit, run, record, output, stale, seedRun, readAtlas, mutateAtlas, at }
}
