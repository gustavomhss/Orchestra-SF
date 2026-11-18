import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { KNOWN_SCANNERS } from "@orchestra/atlas-boundary/native-memory"
import { BackendToolkit } from "@orchestra/core/backend-toolkit"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Location } from "@orchestra/core/location"
import { AppProcess } from "@orchestra/core/process"
import { AbsolutePath } from "@orchestra/core/schema"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { expectSpawn } from "../../../../../../../packages/core/test/fixture/omni-expect.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfMemoryInputProducer } from "../../../../../../../apps/cli/src/sucafina-product/input-producer-memory.ts"
import { createSfDecisionMemoryVerifier } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier-memory.ts"
import { createSfAnalysisSelectionReaders } from "../../../../../../../apps/cli/src/sucafina-product/analysis-services-readers.ts"
import { sfAnalysisSourcesAuthorized, sfMemoryEvidence } from "../../../../../../../apps/cli/src/sucafina-product/analysis-memory-evidence.ts"
import { sfAnalysisPrompt, withoutObservationTimes } from "../../../../../../../apps/cli/src/sucafina-product/analysis-verifier.ts"
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
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult, CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../../product/contracts/operations.ts"
import type { ContributionEnvelope } from "../../../../product/contracts/resident-ai.ts"
import { contributionPayloadMetadata } from "./contribution-payload-fixture.ts"
import type { DecisionRecallInput } from "../../../../product/contracts/skill-inputs.ts"
import atlasPackage from "../../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }

const period = { start: "2026-01-01", end: "2026-12-31" }
const caseRef = { id: "historical-case", incarnation: "historical-case-incarnation", version: 1 }
const at = "2026-11-14T00:00:00Z"

// The chosen case is an explicit upstream fixture with pending coverage. Source archives,
// the scanner, C08, source lifecycle, continuity, CaseRecall and all adapter checks are real.
// No model, Session, SkillLoadReceipt or native publication is constructed by this test.
test("historical decision recall binds original/current evidence and rejects changed proof or authority", async () => {
  expectSpawn(import.meta.path)
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-historical-recall-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "store"))
  let business: ReturnType<typeof createSfBusinessServices> | undefined
  try {
    const pinned = KNOWN_SCANNERS.find((scanner) => scanner.name === "gitleaks")
    if (!pinned) throw new Error("Qualified Atlas scanner missing")
    const spec = { ...pinned, command: (await Effect.runPromise(BackendToolkit.ensure("gitleaks").pipe(
      Effect.provideService(BackendToolkit.Root, path.join(directory, "toolkit"))))).executable }
    const scanVersion = await Effect.runPromise(AppProcess.Service.use((process) => process.run(ChildProcess.make(spec.command, ["--version"],
      { extendEnv: true, stdin: "ignore" }))).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
    const version = scanVersion.stdout.toString("utf8").trim()
    if (scanVersion.exitCode !== 0 || !version) throw new Error("Atlas scanner version unavailable")
    const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "alice", status: "draft",
        pr: { title: "Historical requisition", justification: "Recorded need", estAmount: 100 }, history: [], attachments: [] }, version: 0, by: "alice" } },
        suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-1"], po: [] } }
      snapshot.versions["requests:PR-1"] = { version: 0, by: "alice" }
      return { commit: true, value: undefined }
    })
    const origin = "https://example.test"
    const access = { allowed: true }
    const request = () => new Request(`${origin}/sf/procurement`, { method: "POST", headers: { authorization: "alice", origin, "idempotency-key": randomUUID() } })
    const procurementEvidenceWrites = new WeakSet<object>()
    const proposalCoverageWrites = new WeakSet<object>()
    const authority = createSfProductAuthority({ installationId: "installation", origin, policyVersion: "policy", persistence,
      identity: () => ({ installationId: "installation", hostId: "memory-test", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }),
      grants: [{ principalRef: "alice", namespaces: ["cases", "preferences", "atlas", "outbox", "contributions"],
        operations: ["sf_work_list", "sf_request_read", "sf_case_read"], humanActions: ["decisions.prepare-changes", "analysis.prepare", "analysis.start", "analysis.read"] }],
      authenticate: async (value, selection) => access.allowed && value.headers.get("authorization") === "alice" && selection
        ? { id: "alice", canWrite: true, roles: [{ surface: selection.surface, role: selection.surface === "procurement" ? "requester" : "admin" }] } : null,
      environment: async () => ({ at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }] }),
      commandIdentity: async (value, operation, digest) => digestSfValue({ key: value.headers.get("idempotency-key"), operation, digest }),
      now: Date.now, createId: randomUUID, inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
      procurementEvidenceWrites, proposalCoverageWrites })
    business = createSfBusinessServices({ authority, persistence, procurementEvidenceWrites, proposalCoverageWrites })
    const activeBusiness = business
    const aiRoot = path.resolve(import.meta.dir, "../../../../product/ai")
    const bundle = await createResidentAiBundle({ root: aiRoot, manifestPath: path.join(aiRoot, "manifests/resident.json") })
    const atlas = activeBusiness.initializeAtlas({ spec, version }, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
      manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
    const selectionPayload = { purpose: "work-selection", period }
    const selected = await authority.ui.admit(request(), "sf_work_list", digestSfValue(selectionPayload))
    if (selected.status !== "ok") throw new Error("Human procurement period unavailable")
    try {
      if (!await authority.ui.validate(selected.value, "sf_work_list", digestSfValue(selectionPayload))) throw new Error("Human procurement period admission was not consumed")
      const selectedPeriod = await activeBusiness.procurementSelections.create(selected.value, period)
      if (selectedPeriod.status !== "ok") throw new Error(selectedPeriod.reason)
    } finally { authority.ui.finish(selected.value) }
    const sourcePayload = { request: "PR-1" }
    const issuedCall = await authority.ui.admit(request(), "sf_request_read", digestSfValue(sourcePayload))
    if (issuedCall.status !== "ok") throw new Error("Source issuance authority unavailable")
    const resolved = await (async () => {
      try {
        if (!await authority.ui.validate(issuedCall.value, "sf_request_read", digestSfValue(sourcePayload))) throw new Error("Source issuance admission was not consumed")
        const issued = await activeBusiness.individual.issue("procurement-request", "PR-1", issuedCall.value)
        if (issued.status !== "ok") throw new Error(issued.reason)
        return await activeBusiness.individual.resolve(issued.value, issuedCall.value)
      } finally { authority.ui.finish(issuedCall.value) }
    })()
    if (resolved.status !== "ok") throw new Error(resolved.reason)
    const original = resolved.value.evidence
    const operation: ScenarioOperation = { kind: "replace", targetRef: original.refId, amount: 150, currency: "USD", period }
    const basis: CostCoverageBasis = { id: "basis", version: 1, decisionType: "requisition", categoryIds: ["purchase"], additionalCategoryIds: [], sourceRefs: [original] }
    const result: ScenarioResult = { id: "result", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [original],
      unresolvedConditions: ["Upstream choice fixture has pending coverage"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 150, total: null,
      costCoverage: { basisId: basis.id, basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period,
        issues: ["Coverage pending"], evaluatedSourceRefs: [original], coverageState: "pending", entries: [{ status: "pending", categoryId: "purchase", reason: "No complete cost assertion" }], derivedMissingCategoryIds: ["purchase"] } }
    const decision: DecisionCase = { ...caseRef, state: "chosen", objective: "Review authorized requisition history", horizon: period, currency: "USD",
      participants: ["alice"], criteria: [{ id: "cost", description: "Budget impact", required: true }], sourceRefs: [original], assumptions: [], questions: [],
      alternatives: [{ id: "alternative", version: 1, title: "Explicit amount replacement", scenario: { baseRef: original.refId, operations: [operation], assumptions: [] }, result }],
      costCoverageBases: [basis], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const choice = createChoiceSnapshot({ case: decision, alternativeId: "alternative", alternativeVersion: 1,
      comparison: { baselineResultRef: "baseline", alternativeResultRef: result.id, costCoverageRefs: [], criterionResults: [], unresolvedConditions: result.unresolvedConditions,
        comparisonStatus: "conditioned", knownDifference: 50, completeDifference: null }, criteria: ["cost"], values: [], evidenceRefs: [original],
      id: "choice", principalRef: "alice", reason: "Review a preserved human choice", at })
    if (choice.status !== "ok") throw new Error(choice.reason)
    const event: CaseLedgerEvent = { id: "choice-event", caseRef, kind: "choice-recorded", principalRef: "alice", at,
      consideredActions: ["Explicit requisition replacement"], factualGaps: result.unresolvedConditions, lifecycleState: "chosen",
      rationale: "Preserve the source considered for this choice", evidenceRefs: [original], outputDigest: digestSfValue(choice.choice) }
    const eventBase: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "historical-choice-event",
      installationId: "installation", projectId: "project", refDigest: "", evidenceLevel: "decision", target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation,
        caseVersion: 1, eventId: event.id, outputDigest: event.outputDigest, evidenceRefs: [original] } }
    const eventRef = { ...eventBase, refDigest: digestSfEvidenceRef(eventBase) }
    const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: 0 }],
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "historical-choice", commandDigest: digestSfValue(eventRef) }, async (state, actor) => {
      state.cases[caseRef.id] = { ...decision, choices: [choice.choice], ledger: [event] }
      state.outbox[JSON.stringify([caseRef.id, caseRef.incarnation, event.id])] = { eventRef, writerPrincipalRef: actor.principalRef,
        accessRevision: actor.accessRevision, createdAt: at, attempts: 0, state: "pending" }
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error("Real historical case storage unavailable")
    const preparePayload = { caseRef, choiceId: choice.choice.id, operations: [operation] }
    const preparation = await authority.human.admit(request(), "decisions.prepare-changes", preparePayload)
    if (preparation.status !== "ok") throw new Error(preparation.reason)
    try {
      const commands = await activeBusiness.procurementDecisions.prepareDomainCommands(caseRef, choice.choice.id, [operation], preparation.value)
      if (commands.status !== "ok") throw new Error(`Original source capture unavailable: ${commands.reason}`)
      expect(commands.value).toHaveLength(1)
      const committed = await activeBusiness.context.emitFromLedger(eventRef, preparation.value)
      if (committed.status !== "committed") throw new Error(`Real Atlas append failed: ${committed.status}:${committed.reason}`)
      expect(committed.scanner).toMatchObject({ name: "gitleaks", status: "clean", version })
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
    await edit(150)
    const value: DecisionRecallInput = { currentCase: caseRef, recallScope: { cases: [caseRef], period, includeHistorical: true }, query: decision.objective }
    const skill = bundle.skills.find((entry) => entry.id === "sf-consultar-memoria-decisoria")!
    const profile = bundle.profiles.find((entry) => entry.id === "sf_maestro")!
    const analysis: SfAnalysisRequest = { caseRef, profileId: profile.id, profileVersion: profile.version, skillId: skill.id, skillVersion: skill.version,
      manifestDigest: bundle.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations, objective: value.query }
    const admitted = await authority.human.admit(request(), "analysis.prepare", { request: analysis, selection: value })
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    const call = admitted.value
    try {
      const source = await activeBusiness.context.resolve(original, call)
      expect(source.state).toBe("historical")
      expect(source.ref).toEqual(original)
      expect(source.currentRef?.refDigest).not.toBe(original.refDigest)
      expect(source.differences).toContainEqual({ field: "originalAmount", before: 100, after: 150 })
      const dependencies = { cases: activeBusiness.cases, planner: activeBusiness.planner, procurement: activeBusiness.procurement,
        context: activeBusiness.context, host: authority.host, caseRecall: activeBusiness.caseRecall }
      const producer = createSfMemoryInputProducer(dependencies)
      expect(await producer.prepare(value, analysis, call)).toEqual({ status: "ok", value })
      const readers = createSfAnalysisSelectionReaders({ authority, business: activeBusiness })
      const verifier = createSfDecisionMemoryVerifier({ ...dependencies, readRecallSelection: readers.recallSelection(value) })
      const verified = await verifier.verify(value, analysis, call)
      if (verified.status !== "ok") throw new Error(verified.reason)
      const proof = verified.value
      expect(sfAnalysisSourcesAuthorized(proof, analysis, call)).toBe(true)
      const prompt = proof.promptContext && "decisionRecall" in proof.promptContext ? proof.promptContext.decisionRecall : undefined
      if (!prompt) throw new Error("Historical proof absent from model context")
      expect(prompt.result.matches).toHaveLength(1)
      expect(prompt.result.matches[0]!.explanation.sourceStates).toContain("historical")
      expect(JSON.parse(sfAnalysisPrompt(analysis.objective, proof)).context.decisionRecall.sources)
        .toContainEqual(JSON.parse(JSON.stringify(sfMemoryEvidence(source))))
      for (const other of bundle.skills.filter((entry) => entry.id !== skill.id))
        expect(sfAnalysisSourcesAuthorized(proof, { ...analysis, skillId: other.id }, call)).toBe(false)
      expect(sfAnalysisSourcesAuthorized({ ...proof, input: { ...value, recallScope: { ...value.recallScope, includeHistorical: false } } }, analysis, call)).toBe(false)
      expect(sfAnalysisSourcesAuthorized({ ...proof, promptContext: undefined }, analysis, call)).toBe(false)
      for (const state of ["stale", "revoked", "replaced", "missing", "invalid", "unavailable"] as const)
        expect(sfAnalysisSourcesAuthorized({ ...proof, sources: proof.sources.map((item) => item.state === "historical" ? { ...item, state } : item) }, analysis, call)).toBe(false)
      const historical = proof.sources.find((item) => item.state === "historical")!
      for (const malformed of [{ ...historical, differences: undefined }, { ...historical, currentRef: undefined },
        { ...historical, authorizedProjection: undefined }, { ...historical, accessRevision: "other-access" }, { ...historical, ref: historical.currentRef! }]) {
        const changed = proof.sources.map((item) => item === historical ? malformed : item)
        expect(sfAnalysisSourcesAuthorized({ ...proof, sources: changed, promptContext: { decisionRecall: { ...prompt, sources: changed.map(sfMemoryEvidence) } } }, analysis, call)).toBe(false)
      }
      // The complete declared fixture envelope tests only the payload verifier;
      // its synthetic provenance carries no native or publication authority.
      const output: ContributionEnvelope = { ...contributionPayloadMetadata(caseRef), kind: "CaseRecall", state: "ready", payload: prompt.result, evidenceRefs: proof.sources.map((item) => item.ref) }
      output.outputDigest = digestSfContribution(output)
      expect(await proof.acceptsOutput(output, call)).toEqual({ status: "ok", value: true })
      const excluded = await activeBusiness.caseRecall({ caseRef, limit: 50, scope: { query: value.query, recallScope: { ...value.recallScope, includeHistorical: false } } }, call)
      expect(excluded).toMatchObject({ status: "ok", matches: [] })
      await edit(180)
      const changed = await activeBusiness.context.resolve(original, call)
      expect(changed.state).toBe("historical")
      expect(withoutObservationTimes(changed.authorizedProjection)).toEqual(withoutObservationTimes(source.authorizedProjection))
      expect(digestSfValue(withoutObservationTimes(sfMemoryEvidence(changed)))).not.toBe(digestSfValue(withoutObservationTimes(sfMemoryEvidence(source))))
      expect((await proof.acceptsOutput(output, call)).status).toBe("unavailable")
      // Corrupt the persisted capture, without recalculating the writer's digest. Atlas must refuse it.
      await persistence.transaction("dashboard", async (snapshot) => {
        const partitions = Object.values(object(object(snapshot.data.__sfProductV1).atlas))
        const partition = partitions.find((item) => object(object(item).originals)[original.refDigest])
        if (!partition) throw new Error("Real Atlas original missing")
        object(object(object(partition).originals)[original.refDigest]).projection = { damaged: true }
        return { commit: true, value: undefined }
      })
      expect((await atlas.memory.recall(caseRef, call)).status).toBe("unavailable")
      access.allowed = false
      expect((await producer.prepare(value, analysis, call)).status).toBe("unavailable")
      expect((await verifier.verify(value, analysis, call)).status).toBe("unavailable")
      expect((await proof.acceptsOutput(output, call)).status).toBe("unavailable")
    } finally { authority.human.finish(call) }
  } finally { business?.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 240_000)
