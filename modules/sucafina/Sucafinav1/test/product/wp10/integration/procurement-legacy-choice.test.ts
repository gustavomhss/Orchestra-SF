import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ChoiceRecord, DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../../product/contracts/operations.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createProcurementApprovalLifecycle } from "../../../../product/procurement/decision-preparation.ts"
import { domain } from "../../../../runtime/procurement.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

test("Procurement refuses a legacy unavailable choice before preparing a draft command", async () => {
  const deadline = compositionTestDeadline("procurement-legacy-choice")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-procurement-choice-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(join(directory, "store"))
  deadline.own(() => store.dispose())
  const at = "2027-02-02T00:00:00Z", horizon = { start: "2027-01-01", end: "2027-12-31" }
  const control = { active: true }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
  const request = new Request("https://example.test/procurement", { method: "POST", signal: deadline.signal,
    headers: { origin: "https://example.test" } })
  const identity = { installationId: "procurement-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const coverageWrites = new WeakSet<object>(), procurementWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId,
    origin: "https://example.test", policyVersion: "procurement-policy", persistence,
    proposalCoverageWrites: coverageWrites, procurementEvidenceWrites: procurementWrites,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_request_read", "sf_case_read", "sf_evidence_get"],
      humanActions: ["decisions.prepare-changes"] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: "admin" }] } : null,
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: coverageWrites,
    procurementEvidenceWrites: procurementWrites, procurementRequest: { request, period: horizon } })
  deadline.own(() => business.dispose())
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const recordId = await persistence.transaction("procurement", async (snapshot) => {
      const actor = { id: "person", canWrite: true, roles: ["admin"] }, environment = { at, id: randomUUID, directory: [] }
      expect(domain.execute(snapshot, actor, { page: "Settings", action: "reset", version: 0, values: {} }, environment).ok).toBe(true)
      expect(domain.execute(snapshot, actor, { page: "Requests", action: "create", version: 0, values: {
        pr: { title: "Service renewal", type: "service", description: "Renewal", estAmount: 100, costCenter: "IT",
          needBy: "2027-03-01", justification: "Service", recurring: false, expenseType: "OPEX" },
      } }, environment).ok).toBe(true)
      const requests = domain.view(snapshot, actor, environment).data.requests as { number: string }[]
      return { commit: true, value: requests[0]!.number }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const digest = digestSfValue({})
    const sourceCall = ok(await authority.ui.admit(request, "sf_scenario_simulate", digest))
    expect(await authority.ui.validate(sourceCall, "sf_scenario_simulate", digest)).toBe(true)
    const sourceRef = ok(await business.individual.issue("procurement-request", recordId, sourceCall))
    const source = ok(await business.individual.resolve(sourceRef, sourceCall)).evidence
    const scenario: ScenarioRequest = { baseRef: sourceRef,
      operations: [{ kind: "replace", targetRef: sourceRef, amount: 80, currency: "USD", period: horizon }],
      assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", state: "hypothetical", evidenceRefs: [] }] }
    const preview = ok(await business.procurementScenarios.producer.preview(scenario, sourceCall))
    authority.ui.finish(sourceCall)
    expect(preview.scenario.knownSubtotal).toBe(80)
    expect(preview.scenario.total).toBeNull()
    const block = "financial-approval-command-unavailable"
    const baseChoice: ChoiceRecord = { id: "choice", alternativeId: preview.assessment.alternativeId,
      alternativeVersion: preview.assessment.alternativeVersion, basisVersion: preview.basis.version,
      criteria: [], values: [], evidenceRefs: [source], principalRef: "person", reason: "Reviewed draft estimate", at,
      scenario, result: preview.scenario, costCoverage: preview.assessment, comparisonStatus: "conditioned",
      comparison: { baselineResultRef: sourceRef, alternativeResultRef: preview.scenario.id, costCoverageRefs: [preview.coverageRef],
        criterionResults: [], unresolvedConditions: [], comparisonStatus: "conditioned", knownDifference: -20, completeDifference: null } }
    let version = 0, storageVersion = 0
    const save = async (choice: ChoiceRecord) => {
      version++
      const ref = { id: "procurement-case", incarnation: "procurement-case-inc", version }
      const decision: DecisionCase = { ...ref, state: "chosen", objective: "Edit the draft estimate", horizon, currency: "USD",
        criteria: [], participants: ["person"], sourceRefs: [source], alternatives: [], costCoverageBases: [preview.basis],
        assumptions: [], questions: [], choices: [choice], preparedChanges: [], receipts: [], ledger: [] }
      const saved = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: storageVersion,
        targetRef: version === 1 ? authority.creationTarget.ref : ref.id,
        targetIncarnation: version === 1 ? authority.creationTarget.incarnation : ref.incarnation,
        idempotencyKey: "case-" + version, commandDigest: digestSfValue(decision) }, async (state) => {
        state.cases[ref.id] = decision
        return { commit: true, value: true }
      })
      if (saved.status !== "ok") throw new Error(JSON.stringify(saved))
      storageVersion = saved.storageVersion
      return ref
    }
    const domainBefore = await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data) }))
    for (const field of ["unresolvedConditions", "restrictions"] as const) {
      const legacy = { ...baseChoice, result: { ...preview.scenario,
        unresolvedConditions: preview.scenario.unresolvedConditions.filter((condition) => condition !== block),
        restrictions: preview.scenario.restrictions.filter((condition) => condition !== block) } }
      legacy.result[field] = [...legacy.result[field], block]
      const ref = await save(legacy)
      const payload = { caseRef: ref, choiceId: baseChoice.id, operations: scenario.operations }
      const call = ok(await authority.human.admit(request, "decisions.prepare-changes", payload))
      try {
        const before = await authority.state.read(request, "preferences", (state) => state.preferences)
        const prepared = await business.procurementDecisions.prepareDomainCommands(ref, baseChoice.id, scenario.operations, call)
        expect(prepared).toEqual({ status: "needs-input", reason: block })
        expect(await authority.state.read(request, "preferences", (state) => state.preferences)).toEqual(before)
      } finally { authority.human.finish(call) }
    }
    expect(preview.scenario.unresolvedConditions).not.toContain(block)
    expect(preview.scenario.restrictions).not.toContain(block)
    const ref = await save(baseChoice)
    const payload = { caseRef: ref, choiceId: baseChoice.id, operations: scenario.operations }
    const call = ok(await authority.human.admit(request, "decisions.prepare-changes", payload))
    try {
      const lifecycle = createProcurementApprovalLifecycle({ host: authority.host })
      const review = ok(await lifecycle.review(sourceRef, call))
      const plan = ok(await lifecycle.prepare({ review, action: { kind: "save-estimate", amount: 80 } }, call))
      expect(plan).toMatchObject({ requiresExplicitAction: true, approvalGranted: false, receipt: null,
        command: { page: "Requests", action: "save", confirmed: false } })
      const prepared = ok(await business.procurementDecisions.prepareDomainCommands(ref, baseChoice.id, scenario.operations, call))
      expect(prepared).toHaveLength(1)
      expect(prepared[0]!.command.command).toMatchObject({ page: "Requests", action: "save", confirmed: false,
        values: { pr: { estAmount: 80 } } })
      expect(prepared[0]!.preview).toEqual(preview.scenario)
    } finally { authority.human.finish(call) }
    expect(await persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data) }))).toEqual(domainBefore)
    const currentCase = await authority.state.read(request, "cases", (state) => state.cases[ref.id])
    expect(currentCase.status === "ok" ? currentCase.value?.preparedChanges : undefined).toEqual([])
    const revoked = ok(await authority.human.admit(request, "decisions.prepare-changes", payload))
    try {
      control.active = false
      expect((await business.procurementDecisions.prepareDomainCommands(ref, baseChoice.id, scenario.operations, revoked)).status).toBe("denied")
    } finally { control.active = true; authority.human.finish(revoked) }
  } finally { await deadline.close() }
}, 120_000)

function ok<Value>(result: PortResult<Value>) {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}
