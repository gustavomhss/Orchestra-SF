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
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PreparedCommand, ProductContext, SourceRef } from "../../../product/contracts/context.ts"
import type { ChoiceRecord, DecisionCase, PreparedChange, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PreparedApplyPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
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
    const preparedProcurement = prepareProcurementMutation({
      snapshot: procurementSnapshot, actor: procurementActor, environment: session.environment, context: session.context, target: procurementTarget, scope: procurementSource.value.scope, evidence: procurementEvidence,
      command: { page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { title: "Updated requisition", justification: "Approved scope" } } }, operationId: "procurement-operation", idempotencyKey: "procurement-edit",
    })
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

async function createSession(store: Awaited<ReturnType<typeof openLocalStore>>, reviewed: ReadonlyMap<string, ReviewedIntent>) {
  const projector = createSfSourceScopeProjector(() => at)
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: projector })
  const controls = { confirmed: false, racePending: false, races: 0, producerReviews: 0, executions: [] as string[] }
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
  const authenticate: Application["authenticate"] = async (current, scope) => current.headers.get("authorization") === "Bearer alice" ? { id: "alice", canWrite: true, roles: [{ surface: scope?.surface ?? "procurement", role: scope?.surface === "planner" ? "finance" : "requester" }] } : null
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
  const producer = createSfPreparedApply({
    state, host, authorizeCase: async (value, binding) => value.participants.includes(binding.binding.principalRef) && await host.revalidate(binding),
    authorizeLookup: async (lookup, binding) => ["planner", "procurement"].includes(lookup.surface) && await host.revalidate(binding),
    authorizeReceipt: async (receipt, lookup, binding) => receipt.principalRef === binding.binding.principalRef && receipt.surface === lookup.surface && receipt.idempotencyKey === lookup.idempotencyKey && await host.revalidate(binding),
    confirmHuman: async (_incoming, _change, binding) => controls.confirmed && await host.revalidate(binding), reviewDigestFor,
    resolveActor: (snapshot, binding) => binding.binding.principalRef === "alice" ? Array.isArray(snapshot.data.versions) ? plannerActor : procurementActor : undefined,
    resolveMutation: (snapshot, change, actor, binding) => {
      if (change.target.surface === "procurement") return bridge.resolveMutation(snapshot, change, actor, binding)
      const evidence = change.operation.preview.values[0]?.sourceRefs[0]
      if (evidence?.kind !== "record") return undefined
      const scope = { principalRef: actor.id, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, recordType: change.target.type, recordId: change.target.id, selector: sfPlannerProjectionSelector(snapshot, actor) }
      return preparePlannerMutation({ snapshot, actor, environment, context: binding, target: change.target, evidence, scope, command: change.operation.command, operationId: change.operation.id, idempotencyKey: change.idempotencyKey })?.mutation
    },
    verifyGrant: (_snapshot, _incoming, change, actor, binding) => actor.id === binding.binding.principalRef && actor.canWrite && actor.roles.includes(change.target.surface === "planner" ? "finance" : "requester"),
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
    state, host, apply, authorizeCase: async (value, binding) => value.participants.includes(binding.binding.principalRef) && await host.revalidate(binding), authorizeApplication: async (_incoming, _change, binding) => host.revalidate(binding),
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
      if (!await host.revalidate(binding)) return undefined
      const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: receipt.id, installationId: binding.binding.installationId, projectId: binding.binding.projectId, evidenceLevel: "observed", refDigest: "", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
    },
  })
  const domains = async () => ({
    planner: await persistence.transaction("planner", async ({ data, versions, sequences, audit, notices }) => ({ commit: false, value: structuredClone({ data, versions, sequences, audit, notices }) })),
    procurement: await persistence.transaction("procurement", async ({ data, versions, sequences, audit, notices }) => ({ commit: false, value: structuredClone({ data, versions, sequences, audit, notices }) })),
  })
  return { persistence, context, environment, request, state, planner, procurementSources, reviewDomain, productContext, controls, readCase, domains, execute: async (incoming: PreparedApplyRequest) => execute(incoming, await admit("wp11-human-application", digestSfValue(incoming))) }
}
