import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { Application } from "../../../runtime/application.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Actor } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { domain } from "../../../runtime/procurement.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PreparedCommand, ProductContext, SourceRef } from "../../../product/contracts/context.ts"
import type { ChoiceRecord, DecisionCase, PreparedChange, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PreparedApplyPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createPreparedApplicationStatus } from "../../../product/decisions/application-status.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { proposalReviewDigest } from "../../../product/decisions/receipt-review-binding.ts"
import type { PreparedApplyRequest, ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { plannerPreparedRevision, preparePlannerMutation } from "../../../product/planner/prepared.ts"
import { createPlannerPreparedReview } from "../../../product/planner/prepared-review.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createProcurementC12Bridge } from "../../../product/procurement/c12.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { prepareProcurementMutation } from "../../../product/procurement/prepared.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createProcurementSourceResolver } from "../../../product/procurement/sources.ts"

const at = "2026-11-13T00:00:00Z"
const period = { start: "2027-01-01", end: "2027-12-31" }
const caseId = "case-cross-domain"
const caseIncarnation = "case-cross-domain-incarnation"
const choiceId = "choice-cross-domain"
const plannerActor: Actor = { id: "alice", canWrite: true, roles: ["finance"], assigned: [], domains: [] }
const procurementActor: Actor = { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }
type ReviewedIntent = { commandDigest: string; reviewDigest: string }

// WP04's published prepared-production fixture supplies the canonical Procurement seed,
// source issuance and stale mutation path. The pinned intake manifest records its exact blobs.
test("Planner applies and Procurement conflicts in one durable case; ordered receipts replay after restart without effects", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-cross-domain-apply-"))
  await chmod(directory, 0o700)
  const driver = { value: await openLocalStore(directory), open: true }
  const reviewed = new Map<string, ReviewedIntent>()
  try {
    const session = await createSession(driver.value, reviewed)
    const { choice, plannerRequest } = await prepareCase(session, reviewed)
    const untouched = await session.domains()
    expect(await session.execute(plannerRequest)).toMatchObject({ status: "denied", reason: "application-confirmation-required" })
    expect(session.controls.executions).toEqual([])
    expect(await session.domains()).toEqual(untouched)
    session.controls.confirmed = true
    const applied = await session.execute(plannerRequest)
    expect(applied).toMatchObject({ status: "ok", value: { surface: "planner", result: { ok: true }, version: 1 } })
    if (applied.status !== "ok") throw new Error("Planner application failed")
    const afterPlanner = await session.readCase()
    expect(afterPlanner).toMatchObject({ state: "partially-applied", preparedChanges: [{ state: "applied" }, { state: "planned" }] })
    const procurementRequest: PreparedApplyRequest = { caseRef: { id: caseId, incarnation: caseIncarnation, version: afterPlanner.version }, changeId: "procurement-change", choiceId }
    session.controls.racePending = true
    const refused = await session.execute(procurementRequest)
    expect(refused).toMatchObject({ status: "ok", value: { surface: "procurement", result: { ok: false, status: 409 }, version: 1 } })
    if (refused.status !== "ok") throw new Error("Procurement conflict receipt unavailable")
    expect(session.controls.executions).toEqual(["planner", "procurement"])
    expect(session.controls.races).toBe(1)
    const persisted = await session.readCase()
    expect(persisted.state).toBe("partially-applied")
    expect(persisted.preparedChanges.map((change) => [change.id, change.state, change.receipt?.id])).toEqual([["planner-change", "applied", applied.value.id], ["procurement-change", "conflict", refused.value.id]])
    expect(persisted.receipts.map((receipt) => [receipt.id, receipt.surface])).toEqual([[applied.value.id, "planner"], [refused.value.id, "procurement"]])
    expect(persisted.choices).toEqual([choice])
    expect(persisted.sourceRefs.filter((ref) => ref.kind === "receipt")).toHaveLength(2)
    const official = await session.domains()
    const forecastRow = rows(rows(official.planner.data.versions)[0]?.lines)[0]
    const appliedForecast = forecastRow?.f
    if (!Array.isArray(appliedForecast)) throw new Error("Applied Planner forecast unavailable")
    expect(appliedForecast[0]).toBe(42)
    const requisition = object(object(object(official.procurement.data.store).requests)["PR-1"])
    expect(requisition.request).toMatchObject({ pr: { title: "Concurrent requisition edit", justification: "Original scope" } })
    expect(object(requisition.request).history).toHaveLength(1)
    expect(official.procurement.versions["requests:PR-1"]?.version).toBe(1)

    // Historical requests replay in either order without a new human application or domain call.
    session.controls.confirmed = false
    expect(await session.execute(procurementRequest)).toEqual(refused)
    expect(await session.execute(plannerRequest)).toEqual(applied)
    expect(session.controls.executions).toEqual(["planner", "procurement"])
    expect(await session.readCase()).toEqual(persisted)
    expect(await session.domains()).toEqual(official)
    await driver.value.dispose()
    driver.open = false
    driver.value = await openLocalStore(directory)
    driver.open = true
    // A fresh authority session presents the original reviewed intents. SQLite must recover
    // the case and receipts; persistence of a human/native grant is outside this fixture.
    const restarted = await createSession(driver.value, reviewed)
    expect(await restarted.readCase()).toEqual(persisted)
    expect(await restarted.execute(plannerRequest)).toEqual(applied)
    expect(await restarted.execute(procurementRequest)).toEqual(refused)
    expect(restarted.controls.executions).toEqual([])
    expect(restarted.controls.producerReviews).toBe(0)
    expect(restarted.controls.races).toBe(0)
    expect(await restarted.readCase()).toEqual(persisted)
    expect(await restarted.domains()).toEqual(official)
  } finally {
    if (driver.open) await driver.value.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("both real domain edits apply, retain ordered receipts and replay after restart without another effect", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-cross-domain-success-"))
  await chmod(directory, 0o700)
  const driver = { value: await openLocalStore(directory), open: true }
  const reviewed = new Map<string, ReviewedIntent>()
  try {
    const session = await createSession(driver.value, reviewed)
    const prepared = await prepareCase(session, reviewed)
    const initialCase = await session.readCase()
    const initialDomains = await session.domains()
    // The published C12 producer supports reviewed requisition edits only. Its
    // refusal is not a simulated awaiting-approval receipt or formal approval.
    expect(prepareProcurementMutation({ ...prepared.procurementPreparation, command: { ...prepared.procurementPreparation.command, action: "submit_pr" } })).toBeUndefined()
    expect(await session.readCase()).toEqual(initialCase)
    expect(await session.domains()).toEqual(initialDomains)
    expect(session.controls.executions).toEqual([])

    session.controls.confirmed = true
    const procurementRequest: PreparedApplyRequest = { ...prepared.plannerRequest, changeId: "procurement-change" }
    const procurement = await session.execute(procurementRequest)
    expect(procurement).toMatchObject({ status: "ok", value: { surface: "procurement", result: { ok: true, value: { status: "applied" } }, version: 1 } })
    if (procurement.status !== "ok") throw new Error("Procurement application failed")
    const partial = await session.readCase()
    expect(partial).toMatchObject({ state: "partially-applied", preparedChanges: [{ state: "planned" }, { state: "applied" }] })
    const plannerRequest: PreparedApplyRequest = { ...prepared.plannerRequest, caseRef: { ...prepared.plannerRequest.caseRef, version: partial.version } }
    const planner = await session.execute(plannerRequest)
    expect(planner).toMatchObject({ status: "ok", value: { surface: "planner", result: { ok: true }, version: 1 } })
    if (planner.status !== "ok") throw new Error("Planner application failed")
    const persisted = await session.readCase()
    expect(persisted.state).toBe("applied")
    expect(persisted.preparedChanges.map((change) => [change.id, change.state, change.receipt?.id])).toEqual([["planner-change", "applied", planner.value.id], ["procurement-change", "applied", procurement.value.id]])
    expect(persisted.receipts.map((receipt) => [receipt.id, receipt.surface])).toEqual([[procurement.value.id, "procurement"], [planner.value.id, "planner"]])
    expect(persisted.choices).toEqual([prepared.choice])
    expect(persisted.sourceRefs.filter((ref) => ref.kind === "receipt")).toHaveLength(2)
    const official = await session.domains()
    const forecast = rows(rows(official.planner.data.versions)[0]?.lines)[0]?.f
    if (!Array.isArray(forecast)) throw new Error("Applied Planner forecast unavailable")
    expect(forecast[0]).toBe(42)
    const requisition = object(object(object(official.procurement.data.store).requests)["PR-1"])
    expect(requisition.request).toMatchObject({ status: "draft", pr: { title: "Updated requisition", justification: "Approved scope", estAmount: 100 } })
    expect(object(requisition.request).history).toHaveLength(1)
    expect(official.procurement.versions["requests:PR-1"]?.version).toBe(1)
    const currentRef = { id: caseId, incarnation: caseIncarnation, version: persisted.version }
    for (const changeId of ["planner-change", "procurement-change"]) expect(await session.applicationStatus({ caseRef: currentRef, choiceId, changeId })).toMatchObject({ status: "ok", value: { recordedState: "applied", status: "reconciled" } })
    expect(await session.readAggregate()).toMatchObject({ status: "ok", value: { case: { state: "applied", receipts: [{ id: procurement.value.id, status: "applied" }, { id: planner.value.id, status: "applied" }] } } })

    session.controls.confirmed = false
    const reviews = session.controls.producerReviews
    expect(await Promise.all([session.execute(plannerRequest), session.execute(procurementRequest), session.execute(plannerRequest)])).toEqual([planner, procurement, planner])
    expect(session.controls.executions).toEqual(["procurement", "planner"])
    expect(session.controls.producerReviews).toBe(reviews)
    expect(await session.readCase()).toEqual(persisted)
    expect(await session.domains()).toEqual(official)
    await driver.value.dispose()
    driver.open = false
    driver.value = await openLocalStore(directory)
    driver.open = true
    // Fresh UI admission and the reviewed-intent map are explicit host boundaries;
    // the reopened SQLite store, domain effects and receipts are real.
    const restarted = await createSession(driver.value, reviewed)
    expect(await Promise.all([restarted.execute(procurementRequest), restarted.execute(plannerRequest)])).toEqual([procurement, planner])
    expect(restarted.controls.executions).toEqual([])
    expect(restarted.controls.producerReviews).toBe(0)
    expect(restarted.controls.races).toBe(0)
    expect(await restarted.readCase()).toEqual(persisted)
    expect(await restarted.domains()).toEqual(official)
    expect(await restarted.readAggregate()).toMatchObject({ status: "ok", value: { case: { state: "applied" } } })
  } finally {
    if (driver.open) await driver.value.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("domain permission and receipt revocation preserve case access while denying pending application and restricted aggregate results", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-cross-domain-revocation-"))
  await chmod(directory, 0o700)
  const driver = { value: await openLocalStore(directory), open: true }
  const reviewed = new Map<string, ReviewedIntent>()
  try {
    const session = await createSession(driver.value, reviewed)
    const { choice, plannerRequest } = await prepareCase(session, reviewed)
    const procurementAtPreparation: PreparedApplyRequest = { ...plannerRequest, changeId: "procurement-change" }
    const pending = await session.readCase()
    const untouched = await session.domains()
    expect(await session.readAggregate()).toMatchObject({ status: "ok", value: { case: { state: "chosen" } } })
    session.controls.confirmed = true
    session.controls.domainAccess.procurement.application = false
    expect(await session.execute(procurementAtPreparation)).toEqual({ status: "denied", reason: "application-authority-unavailable" })
    expect(await session.readAggregate()).toMatchObject({ status: "ok", value: { case: { state: "chosen" } } })
    expect(await session.readCase()).toEqual(pending)
    expect(await session.domains()).toEqual(untouched)
    expect(session.controls.executions).toEqual([])
    expect(session.controls.producerReviews).toBe(0)

    session.controls.domainAccess.procurement.application = true
    session.controls.domainAccess.procurement.lookup = false
    const deniedLookup = await session.execute(procurementAtPreparation)
    expect(deniedLookup).toMatchObject({ status: "denied" })
    expect("value" in deniedLookup).toBe(false)
    expect(await session.readCase()).toEqual(pending)
    expect(await session.applicationStatus(procurementAtPreparation)).toMatchObject({ status: "ok", value: { recordedState: "planned", status: "not-attempted" } })
    expect(session.controls.executions).toEqual([])
    expect(session.controls.producerReviews).toBe(0)
    expect(await session.domains()).toEqual(untouched)

    session.controls.domainAccess.procurement.lookup = true
    const planner = await session.execute(plannerRequest)
    if (planner.status !== "ok") throw new Error("Planner application failed after Procurement revocation")
    const partial = await session.readCase()
    const procurementRequest: PreparedApplyRequest = { ...procurementAtPreparation, caseRef: { ...procurementAtPreparation.caseRef, version: partial.version } }
    const procurement = await session.execute(procurementRequest)
    if (procurement.status !== "ok") throw new Error("Procurement application failed after restored permission")
    expect(planner.value.result.ok).toBe(true)
    expect(procurement.value.result.ok).toBe(true)
    const persisted = await session.readCase()
    expect(persisted.state).toBe("applied")
    expect(persisted.choices).toEqual([choice])
    const official = await session.domains()
    const currentRef = { id: caseId, incarnation: caseIncarnation, version: persisted.version }
    const statusRequest: PreparedApplyRequest = { caseRef: currentRef, choiceId, changeId: "procurement-change" }
    expect(await session.applicationStatus(statusRequest)).toMatchObject({ status: "ok", value: { recordedState: "applied", status: "reconciled" } })
    expect(await session.readAggregate()).toMatchObject({ status: "ok", value: { case: { state: "applied" } } })

    // The UI/case lease stays authorized. Only the already produced Procurement
    // receipt is revoked, so case aggregates must not disclose its terminal result.
    session.controls.confirmed = false
    session.controls.domainAccess.procurement.receipt = false
    const checksBefore = session.controls.receiptChecks.length
    const restrictedStatus = await session.applicationStatus(statusRequest)
    expect(restrictedStatus).toEqual({ status: "denied", reason: "receipt-access-unavailable" })
    expect("value" in restrictedStatus).toBe(false)
    const restrictedAggregate = await session.readAggregate()
    expect(restrictedAggregate).toEqual({ status: "unavailable", reason: "case-evidence-unavailable" })
    expect("value" in restrictedAggregate).toBe(false)
    expect(session.controls.receiptChecks.slice(checksBefore)).toContain("procurement:receipt")
    const restrictedReplay = await session.execute(procurementRequest)
    expect(restrictedReplay).toMatchObject({ status: "denied" })
    expect("value" in restrictedReplay).toBe(false)
    expect(await session.applicationStatus({ ...statusRequest, changeId: "planner-change" })).toMatchObject({ status: "ok", value: { recordedState: "applied", status: "reconciled" } })
    expect(await session.execute(plannerRequest)).toEqual(planner)
    expect(await session.readCase()).toEqual(persisted)
    expect(await session.domains()).toEqual(official)
    expect(session.controls.executions).toEqual(["planner", "procurement"])

    await driver.value.dispose()
    driver.open = false
    driver.value = await openLocalStore(directory)
    driver.open = true
    const restarted = await createSession(driver.value, reviewed)
    restarted.controls.domainAccess.procurement.receipt = false
    expect(await restarted.readCase()).toEqual(persisted)
    expect(await restarted.applicationStatus(statusRequest)).toEqual({ status: "denied", reason: "receipt-access-unavailable" })
    expect(await restarted.readAggregate()).toEqual({ status: "unavailable", reason: "case-evidence-unavailable" })
    expect(await restarted.execute(procurementRequest)).toMatchObject({ status: "denied" })
    expect(restarted.controls.executions).toEqual([])
    expect(restarted.controls.producerReviews).toBe(0)
    restarted.controls.domainAccess.procurement.receipt = true
    expect(await restarted.applicationStatus(statusRequest)).toMatchObject({ status: "ok", value: { recordedState: "applied", status: "reconciled" } })
    expect(await restarted.readAggregate()).toMatchObject({ status: "ok", value: { case: { state: "applied", choices: [choice] } } })
    expect(await restarted.execute(procurementRequest)).toEqual(procurement)
    expect(await restarted.execute(plannerRequest)).toEqual(planner)
    expect(restarted.controls.executions).toEqual([])
    expect(restarted.controls.producerReviews).toBe(0)
    expect(await restarted.readCase()).toEqual(persisted)
    expect(await restarted.domains()).toEqual(official)
  } finally {
    if (driver.open) await driver.value.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

async function prepareCase(session: Awaited<ReturnType<typeof createSession>>, reviewed: Map<string, ReviewedIntent>) {
  await session.persistence.initializeSources("dashboard")
  await session.persistence.initializeSources("planner")
  await session.persistence.initializeSources("procurement")
  await session.persistence.transaction("planner", async (snapshot) => {
    snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
    snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [100] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
    return { commit: true, value: true }
  })
  await session.persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = {
      requests: { "PR-1": { request: { number: "PR-1", createdBy: "alice", status: "draft", pr: { title: "Original requisition", justification: "Original scope", estAmount: 100 }, history: [] }, version: 1, by: "alice" } },
      suppliers: [], settings: { currency: "USD", fxRates: [] }, issued: { pr: ["PR-1"], po: [] },
    }
    snapshot.versions["requests:PR-1"] = { version: 0, by: "alice" }
    return { commit: true, value: true }
  })

  const issuedPlanner = await session.planner.issueSource("v0", session.context)
  if (issuedPlanner.status !== "ok" || !issuedPlanner.value.evidence.target.period) throw new Error("Planner source unavailable")
  const plannerEvidence = issuedPlanner.value.evidence
  const plannerTarget: SourceRef = { surface: "planner", type: "planner-version", id: "v0", incarnation: plannerEvidence.target.incarnation, version: plannerEvidence.target.version, fields: plannerEvidence.target.fields, period: issuedPlanner.value.evidence.target.period, observedAt: at }
  const plannerSnapshot = await session.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const preparedPlanner = preparePlannerMutation({
    snapshot: plannerSnapshot, actor: plannerActor, environment: session.environment, context: session.context, target: plannerTarget, evidence: plannerEvidence,
    scope: { principalRef: "alice", accessRevision: "a1", policyVersion: "p1", recordType: "planner-version", recordId: "v0", selector: sfPlannerProjectionSelector(plannerSnapshot, plannerActor) },
    command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 42 } }, operationId: "planner-operation", idempotencyKey: "planner-edit",
  })
  if (!preparedPlanner?.preview) throw new Error("Planner preparation unavailable")
  const forecast = rows(preparedPlanner.preview.lines).find((line) => line.id === "line")?.f
  if (!Array.isArray(forecast) || typeof forecast[0] !== "number") throw new Error("Canonical Planner preview unavailable")
  const plannerOperation: PreparedCommand = {
    id: "planner-operation", target: plannerTarget, command: preparedPlanner.command, expectedVersion: 0, idempotencyKey: "planner-edit", commandDigest: preparedPlanner.mutation.commandDigest, requiredAuthority: ["finance"],
    preview: { context: session.productContext("planner"), version: plannerTarget.version, engineVersion: "wp11-canonical-command-fixture", components: [], missing: [], values: [{ id: "line:1:forecast", value: forecast[0], currency: "USD", period, granularity: "month", sourceRefs: [plannerEvidence], drilldown: plannerEvidence, evidenceState: "confirmed" }] },
  }
  const issuedProcurement = await session.procurementSources.issue("procurement-request", "PR-1", session.context)
  if (issuedProcurement.status !== "ok") throw new Error("Procurement source unavailable")
  const procurementSource = await session.procurementSources.resolveForPreparation(issuedProcurement.value, session.context)
  if (procurementSource.status !== "ok") throw new Error("Procurement scope unavailable")
  const procurementEvidence = procurementSource.value.evidence
  const procurementTarget: SourceRef = { surface: "procurement", type: "procurement-request", id: "PR-1", incarnation: procurementEvidence.target.incarnation, version: procurementEvidence.target.version, fields: procurementEvidence.target.fields, period, observedAt: at }
  const procurementSnapshot = await session.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
  const procurementPreparation: Parameters<typeof prepareProcurementMutation>[0] = {
    snapshot: procurementSnapshot, actor: procurementActor, environment: session.environment, context: session.context, target: procurementTarget, scope: procurementSource.value.scope, evidence: procurementEvidence,
    command: { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { title: "Updated requisition", justification: "Approved scope" } } }, operationId: "procurement-operation", idempotencyKey: "procurement-edit",
  }
  const preparedProcurement = prepareProcurementMutation(procurementPreparation)
  if (!preparedProcurement) throw new Error("Procurement preparation unavailable")

  // This fixture exercises execution of a recorded human choice; it asserts no financial total.
  const preview: ScenarioResult = { id: "execution-scenario", version: 1, components: [], currency: "USD", horizon: period, sourceRefs: [plannerEvidence, procurementEvidence], unresolvedConditions: ["financial-comparison-outside-this-fixture"], restrictions: [], comparisonStatus: "unavailable", knownSubtotal: null, total: null,
    costCoverage: { basisId: "execution-basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: ["execution-fixture"], evaluatedSourceRefs: [plannerEvidence, procurementEvidence], coverageState: "unavailable", entries: [{ status: "pending", categoryId: "service", reason: "financial-comparison-outside-this-fixture" }], derivedMissingCategoryIds: ["service"] },
  }
  const choice: ChoiceRecord = { id: choiceId, alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [plannerEvidence, procurementEvidence], principalRef: "alice", reason: "Human choice to apply the two separately reviewed domain edits", at, scenario: { baseRef: "v0", operations: [], assumptions: [] }, result: preview, comparison: { baselineResultRef: "baseline", alternativeResultRef: preview.id, costCoverageRefs: ["execution-basis"], criterionResults: [], unresolvedConditions: preview.unresolvedConditions, comparisonStatus: "unavailable", knownDifference: null, completeDifference: null }, comparisonStatus: "unavailable", costCoverage: preview.costCoverage }
  const changes: PreparedChange[] = [plannerOperation, preparedProcurement.command].map((operation) => ({ id: `${operation.target.surface}-change`, caseId, caseVersion: 1, choiceId, target: operation.target, expectedVersion: operation.expectedVersion, operation, preview, requiredAuthority: operation.requiredAuthority, idempotencyKey: operation.idempotencyKey, state: "planned" }))
  const decision: DecisionCase = { id: caseId, incarnation: caseIncarnation, version: 1, state: "chosen", objective: "Apply reviewed Planner and Procurement changes independently", horizon: period, currency: "USD", criteria: [], participants: ["alice"], sourceRefs: [plannerEvidence, procurementEvidence], alternatives: [{ id: "alternative", version: 1, title: "Human selection", scenario: choice.scenario, result: preview }], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: changes, receipts: [], ledger: [] }
  const seeded = await session.state.transaction(session.request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseId, targetIncarnation: caseIncarnation, idempotencyKey: "seed-cross-domain", commandDigest: digestSfValue(decision) }, async (state) => { state.cases[caseId] = decision; return { commit: true, value: true } })
  if (seeded.status !== "ok") throw new Error("Case seed failed")
  for (const change of changes) {
    const review = await session.reviewDomain(change.operation, session.context)
    if (review.status !== "ok") throw new Error(`Domain review failed: ${review.reason}`)
    reviewed.set(change.id, { commandDigest: change.operation.commandDigest, reviewDigest: proposalReviewDigest({ caseId, caseIncarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: review.value.fields, sourceRefDigest: review.value.source.refDigest }) })
  }

  const plannerRequest: PreparedApplyRequest = { caseRef: { id: caseId, incarnation: caseIncarnation, version: 1 }, changeId: "planner-change", choiceId }
  return { choice, plannerRequest, changes, procurementPreparation }
}

async function createSession(store: Awaited<ReturnType<typeof openLocalStore>>, reviewed: ReadonlyMap<string, ReviewedIntent>) {
  const projector = createSfSourceScopeProjector(() => at)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: (surface, snapshot, scope) => surface === "procurement" ? projectProcurementScope(surface, snapshot, scope) : projector(surface, snapshot, scope) })
  const controls = {
    confirmed: false, racePending: false, races: 0, producerReviews: 0, executions: [] as string[], receiptChecks: [] as string[],
    domainAccess: {
      planner: { application: true, lookup: true, receipt: true },
      procurement: { application: true, lookup: true, receipt: true },
    },
  }
  const domainAccess = (surface: string) => surface === "planner" || surface === "procurement" ? controls.domainAccess[surface] : undefined
  const environment = { at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }] }
  const request = new Request("https://local.invalid/cases", { headers: { authorization: "Bearer alice" } })
  const authorize = async (current: Request) => current.headers.get("authorization") === "Bearer alice" ? { installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1" } : undefined
  const ui = createSfUiAuthority({ authorize, commandIdentity: async (_current, operation, digest) => `${operation}:${digest}`, createId: randomUUID, now: Date.now, privateCommands: ["wp11-human-application"] })
  const admit = async (operation: string, digest: string) => {
    const admission = await ui.admit(request, operation, digest)
    if (admission.status !== "ok" || !await ui.validate(admission.value, operation, digest)) throw new Error("UI authority admission failed")
    return admission.value
  }
  const context = await admit("sf_request_read", digestSfValue({ caseId }))
  const authenticate: Application["authenticate"] = async (current, scope) => current.headers.get("authorization") === "Bearer alice" ? { id: "alice", canWrite: domainAccess(scope?.surface ?? "procurement")?.application === true, roles: [{ surface: scope?.surface ?? "procurement", role: scope?.surface === "planner" ? "finance" : "requester" }] } : null
  const host = { persistence, authenticate, environment: async () => environment, requestFor: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.requestFor(binding) : undefined, revalidate: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false) }
  const productContext = (surface: "planner" | "procurement"): ProductContext => ({ installationId: "install", projectId: "project", principalRef: "alice", accessRevision: "a1", policyVersion: "p1", surface, period, currency: "USD", sourceRefs: [], capabilities: [] })
  const procurementSources = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: productContext("procurement") }) })
  const unavailable = async () => ({ status: "unavailable" as const, reason: "unused" })
  const procurementHost = { ...host, resolveRequestSource: procurementSources.resolve, resolveSupplierSource: procurementSources.resolve, isCurrentRequestSource: procurementSources.isCurrent, isCurrentSupplierSource: procurementSources.isCurrent, resolveRequestCollection: unavailable, isCurrentRequestCollection: () => false, readContractSource: unavailable }
  const bridge = createProcurementC12Bridge({ host: procurementHost, individual: procurementSources, port: createProcurementPort(procurementHost) })
  const planner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: unavailable })
  const plannerReview = createPlannerPreparedReview({ host, issueSource: planner.issueSource })
  const reviewDomain = (operation: PreparedCommand, binding: TrustedDomainContext) => operation.target.surface === "planner" ? plannerReview(operation, binding) : bridge.reviewDomain(operation, binding)
  const state = createSfProductState({ persistence, createId: randomUUID, authorize, resolveTarget: async (_current, snapshot, namespace, targetRef) => {
    if (namespace === "cases" && targetRef === caseId) return { incarnation: caseIncarnation }
    if (namespace !== "receipts") return undefined
    const decision = object(object(object(snapshot.data.__sfProductV1).cases)[caseId])
    const targets = rows(decision.preparedChanges).map((change) => object(change.target)).filter((target) => target.id === targetRef)
    return targets.length === 1 && typeof targets[0]!.incarnation === "string" ? { incarnation: targets[0]!.incarnation } : undefined
  } })
  const readCase = async () => {
    const current = await state.read(request, "cases", (value) => value.cases[caseId])
    if (current.status !== "ok" || !current.value) throw new Error("Persisted case unavailable")
    return current.value
  }
  const reviewDigestFor: ReviewDigestFor = (binding, incoming, change) => binding.binding.principalRef === "alice" && incoming.caseRef.id === caseId && incoming.caseRef.incarnation === caseIncarnation && incoming.choiceId === choiceId && incoming.changeId === change.id && reviewed.get(change.id)?.commandDigest === change.operation.commandDigest ? reviewed.get(change.id)?.reviewDigest : undefined
  const authorizeCase = async (value: DecisionCase, binding: TrustedDomainContext) => value.participants.includes(binding.binding.principalRef) && await host.revalidate(binding)
  const producer = createSfPreparedApply({
    state, host, authorizeCase,
    authorizeLookup: async (lookup, binding) => { controls.receiptChecks.push(`${lookup.surface}:lookup`); return domainAccess(lookup.surface)?.lookup === true && await host.revalidate(binding) },
    authorizeReceipt: async (receipt, lookup, binding) => { controls.receiptChecks.push(`${receipt.surface}:receipt`); return domainAccess(receipt.surface)?.receipt === true && receipt.principalRef === binding.binding.principalRef && receipt.surface === lookup.surface && receipt.idempotencyKey === lookup.idempotencyKey && await host.revalidate(binding) },
    confirmHuman: async (_incoming, change, binding) => controls.confirmed && domainAccess(change.target.surface)?.application === true && await host.revalidate(binding), reviewDigestFor,
    resolveActor: (snapshot, binding) => {
      const surface = Array.isArray(snapshot.data.versions) ? "planner" : "procurement"
      return binding.binding.principalRef === "alice" && domainAccess(surface)?.application === true ? surface === "planner" ? plannerActor : procurementActor : undefined
    },
    resolveMutation: (snapshot, change, actor, binding) => {
      if (change.target.surface === "procurement") return bridge.resolveMutation(snapshot, change, actor, binding)
      const evidence = change.operation.preview.values[0]?.sourceRefs[0]
      if (evidence?.kind !== "record") return undefined
      const scope = { principalRef: actor.id, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, recordType: change.target.type, recordId: change.target.id, selector: sfPlannerProjectionSelector(snapshot, actor) }
      return preparePlannerMutation({ snapshot, actor, environment, context: binding, target: change.target, evidence, scope, command: change.operation.command, operationId: change.operation.id, idempotencyKey: change.idempotencyKey })?.mutation
    },
    verifyGrant: (_snapshot, _incoming, change, actor, binding) => domainAccess(change.target.surface)?.application === true && actor.id === binding.binding.principalRef && actor.canWrite && actor.roles.includes(change.target.surface === "planner" ? "finance" : "requester"),
    receiptVersion: (snapshot, change) => change.target.surface === "planner" ? plannerPreparedRevision(snapshot, change.operation.command) : bridge.receiptVersion(snapshot, change),
    environment: () => environment, createId: randomUUID, now: () => at,
  })
  const apply: PreparedApplyPort = { ...producer, executePrepared: async (incoming, binding) => {
    const decision = await readCase()
    const selected = decision.preparedChanges.find((change) => change.id === incoming.changeId)
    if (!selected) throw new Error("Selected prepared change unavailable")
    controls.executions.push(selected.target.surface)
    return producer.executePrepared(incoming, binding)
  } }
  const execute = createPreparedExecution({
    state, host, apply, authorizeCase, authorizeApplication: async (_incoming, change, binding) => domainAccess(change.target.surface)?.application === true && await host.revalidate(binding),
    confirmApplication: async (incoming, binding) => {
      if (!controls.confirmed || !await host.revalidate(binding)) return false
      if (controls.racePending && incoming.changeId === "procurement-change") {
        controls.racePending = false
        const changed = await persistence.transaction("procurement", async (snapshot) => {
          const result = domain.execute(snapshot, procurementActor, { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { title: "Concurrent requisition edit" } } }, environment)
          return { commit: result.ok, value: result }
        })
        if (!changed.ok) throw new Error("Concurrent official Procurement edit failed")
        controls.races += 1
      }
      return true
    },
    operationIdentity: (binding) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined, reviewDigestFor,
    revalidateProducer: async (incoming, binding) => {
      controls.producerReviews += 1
      const decision = await readCase()
      const change = decision.preparedChanges.find((entry) => entry.id === incoming.changeId)
      const choice = decision.choices.find((entry) => entry.id === incoming.choiceId)
      if (!change || !choice) return { status: "unavailable", reason: "review-choice-unavailable" }
      const review = await reviewDomain(change.operation, binding)
      if (review.status !== "ok") return { status: review.status, reason: review.reason }
      return { status: "ok", value: { reviewDigest: proposalReviewDigest({ caseId, caseIncarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: review.value.fields, sourceRefDigest: review.value.source.refDigest }) } }
    },
    classifyReceipt: async (receipt, _change, binding) => {
      if (domainAccess(receipt.surface)?.receipt !== true || !await host.revalidate(binding)) return undefined
      const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: receipt.id, installationId: binding.binding.installationId, projectId: binding.binding.projectId, evidenceLevel: "observed", refDigest: "", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
    },
  })
  const domains = async () => ({
    planner: await persistence.transaction("planner", async ({ data, versions, sequences, audit, notices }) => ({ commit: false, value: structuredClone({ data, versions, sequences, audit, notices }) })),
    procurement: await persistence.transaction("procurement", async ({ data, versions, sequences, audit, notices }) => ({ commit: false, value: structuredClone({ data, versions, sequences, audit, notices }) })),
  })
  const applicationStatus = createPreparedApplicationStatus({ state, host, receipts: producer, authorizeCase })
  // Record-history authority is an explicit fixture boundary. Receipt evidence always
  // delegates to the real persisted producer lookup and its current per-domain ACL.
  const resolveEvidence: BusinessContextService["resolve"] = async (ref, binding) => {
    const checked = { ref, accessRevision: binding.binding.accessRevision, checkedAt: at }
    const decision = await readCase()
    if (!await authorizeCase(decision, binding)) return { ...checked, state: "revoked" }
    if (ref.refDigest !== digestSfEvidenceRef(ref)) return { ...checked, state: "invalid" }
    if (ref.kind === "record") {
      const recorded = decision.sourceRefs.some((source) => digestSfValue(source) === digestSfValue(ref))
      return { ...checked, state: recorded && domainAccess(ref.target.surface)?.lookup === true ? "historical" : "revoked" }
    }
    if (ref.kind !== "receipt") return { ...checked, state: "unavailable" }
    const change = decision.preparedChanges.find((item) => item.receipt?.id === ref.target.receiptId && item.target.surface === ref.target.surface)
    if (!change?.receipt) return { ...checked, state: "unavailable" }
    const receipt = await producer.readReceipt({ surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, binding)
    if (receipt.status !== "ok") return { ...checked, state: receipt.status === "denied" ? "revoked" : "unavailable" }
    if (receipt.value.state !== "found" || digestSfValue(receipt.value.receipt) !== digestSfValue(change.receipt) || ref.target.version !== receipt.value.receipt.version || ref.target.commandDigest !== receipt.value.receipt.commandDigest || ref.target.idempotencyKey !== receipt.value.receipt.idempotencyKey || ref.target.targetIncarnation !== receipt.value.receipt.targetIncarnation) return { ...checked, state: "unavailable" }
    return { ...checked, state: "fresh", currentRef: ref }
  }
  const evidence: BusinessContextService = { resolve: resolveEvidence, context: async ({ refs }, binding) => Promise.all(refs.map((ref) => resolveEvidence(ref, binding))), recall: async () => [], emitFromLedger: async () => { throw new Error("Memory emission is outside this execution fixture") } }
  const cases = createDecisionCasePort({ state, host, creationTarget: { ref: caseId, incarnation: caseIncarnation }, operationIdentity: (binding) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined, authorizeCase, verifyScenarioOperations: async (decision) => decision.alternatives.every((alternative) => alternative.scenario.operations.length === 0 && alternative.scenario.assumptions.length === 0), evidence, createId: randomUUID, now: () => at })
  return {
    persistence, context, environment, request, state, planner, procurementSources, reviewDomain, productContext, controls, readCase, domains,
    execute: async (incoming: PreparedApplyRequest) => execute(incoming, await admit("wp11-human-application", digestSfValue(incoming))),
    applicationStatus: async (incoming: PreparedApplyRequest) => applicationStatus(incoming, await admit("sf_case_read", digestSfValue(incoming))),
    readAggregate: async () => { const incoming = { caseRef: encodeCaseRef({ id: caseId, incarnation: caseIncarnation }) }; return cases.read(incoming, await admit("sf_case_read", digestSfValue(incoming))) },
  }
}
