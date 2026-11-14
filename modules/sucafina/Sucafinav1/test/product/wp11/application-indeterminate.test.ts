import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Actor } from "../../../runtime/contract.ts"
import type { Application } from "../../../runtime/application.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CommandReceipt, PreparedCommand, SourceRef } from "../../../product/contracts/context.ts"
import type { ChoiceRecord, DecisionCase, PreparedChange, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { PreparedApplyPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createPreparedExecution } from "../../../product/decisions/apply.ts"
import { createPreparedApplicationStatus } from "../../../product/decisions/application-status.ts"
import { createDecisionHttp } from "../../../product/decisions/http.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { proposalReviewDigest } from "../../../product/decisions/receipt-review-binding.ts"
import type { PreparedApplyRequest, ReviewDigestFor } from "../../../product/decisions/receipt-review-binding.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../product/integration/source-projections.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { preparePlannerMutation, plannerPreparedRevision } from "../../../product/planner/prepared.ts"
import { createPlannerPreparedReview } from "../../../product/planner/prepared-review.ts"

const at = "2026-11-13T00:00:00Z"
const period = { start: "2027-01-01", end: "2027-12-31" }
const caseId = "indeterminate-case"
const incarnation = "indeterminate-case-incarnation"
const actor: Actor = { id: "alice", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const operation: PreparedApplyRequest = { caseRef: { id: caseId, incarnation, version: 1 }, changeId: "planner-change", choiceId: "choice" }

// Real SQLite, UI leases, Planner preparation/review/mutation and atomic receipts.
// Choice/confirmation are fixture boundaries; deleting/restoring the exact committed
// receipt simulates receipt-store damage and recovery, never a second domain command.
test("a dispatched change without its authoritative receipt stays indeterminate across concurrent actors and restart", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-application-indeterminate-"))
  await chmod(directory, 0o700)
  const driver = { value: await openLocalStore(directory), open: true }
  const entered = latch()
  const release = latch()
  const controls = { confirmed: false, hold: true, loseResponse: true, dispatches: 0, reviews: 0, confirmations: 0, revoked: false, reviewDigest: "", receipt: undefined as CommandReceipt | undefined }
  try {
    const session = await createSession(driver.value, controls, entered, release)
    await session.persistence.initializeSources("dashboard")
    await session.persistence.initializeSources("planner")
    await session.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [100] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: true }
    })
    const binding = await session.admit("alice", "prepare-fixture")
    const issued = await session.planner.issueSource("v0", binding)
    if (issued.status !== "ok" || !issued.value.evidence.target.period) throw new Error("Planner source unavailable")
    const evidence = issued.value.evidence
    const target: SourceRef = { surface: "planner", type: "planner-version", id: "v0", incarnation: evidence.target.incarnation, version: evidence.target.version, fields: evidence.target.fields, period: issued.value.evidence.target.period, observedAt: at }
    const snapshot = await session.persistence.transaction("planner", async (current) => ({ commit: false, value: structuredClone(current) }))
    const prepared = preparePlannerMutation({ snapshot, actor, environment: session.environment, context: binding, target, evidence, scope: { principalRef: actor.id, accessRevision: "a1", policyVersion: "p1", recordType: target.type, recordId: target.id, selector: sfPlannerProjectionSelector(snapshot, actor) }, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 42 } }, operationId: "planner-command", idempotencyKey: "planner-edit" })
    if (!prepared?.preview) throw new Error("Planner preparation unavailable")
    const forecast = rows(prepared.preview.lines).find((line) => line.id === "line")?.f
    if (!Array.isArray(forecast) || typeof forecast[0] !== "number") throw new Error("Planner preview unavailable")
    const command: PreparedCommand = { id: "planner-command", target, command: prepared.command, idempotencyKey: "planner-edit", commandDigest: prepared.mutation.commandDigest, expectedVersion: 0, requiredAuthority: ["finance"], preview: { context: { installationId: "install", projectId: "project", surface: "planner", policyVersion: "p1", principalRef: "alice", accessRevision: "a1", sourceRefs: [target], period, currency: "USD", capabilities: [] }, version: target.version, engineVersion: "wp11-real-prepared-command", components: [], missing: [], values: [{ id: "line:1:forecast", value: forecast[0], currency: "USD", period, granularity: "month", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }] } }
    const preview: ScenarioResult = { id: "execution-preview", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [evidence], restrictions: [], unresolvedConditions: ["financial-comparison-outside-this-fixture"], comparisonStatus: "unavailable", knownSubtotal: null, total: null, costCoverage: { basisId: "execution-basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: period, coverageState: "unavailable", issues: ["execution-fixture"], evaluatedSourceRefs: [evidence], entries: [{ status: "pending", categoryId: "service", reason: "financial-comparison-outside-this-fixture" }], derivedMissingCategoryIds: ["service"] } }
    const choice: ChoiceRecord = { id: "choice", alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [evidence], principalRef: "alice", reason: "Apply the separately reviewed Planner edit", at, scenario: { baseRef: evidence.refId, operations: [], assumptions: [] }, result: preview, comparison: { baselineResultRef: "baseline", alternativeResultRef: preview.id, costCoverageRefs: ["execution-basis"], criterionResults: [], unresolvedConditions: preview.unresolvedConditions, comparisonStatus: "unavailable", knownDifference: null, completeDifference: null }, comparisonStatus: "unavailable", costCoverage: preview.costCoverage }
    const change: PreparedChange = { id: operation.changeId, caseId, caseVersion: 1, choiceId: choice.id, target, expectedVersion: command.expectedVersion, operation: command, preview, requiredAuthority: command.requiredAuthority, idempotencyKey: command.idempotencyKey, state: "planned" }
    const decision: DecisionCase = { id: caseId, incarnation, version: 1, state: "chosen", objective: "Keep an unknown domain outcome unresolved until its receipt is recovered", horizon: period, currency: "USD", criteria: [], participants: ["alice", "bob"], sourceRefs: [evidence], alternatives: [{ id: "alternative", version: 1, title: "Selected edit", scenario: choice.scenario, result: preview }], costCoverageBases: [], assumptions: [], questions: [], choices: [choice], preparedChanges: [change], receipts: [], ledger: [] }
    const seeded = await session.state.transaction(session.request("alice"), { namespace: "cases", expectedStorageVersion: 0, targetRef: caseId, targetIncarnation: incarnation, idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (state) => { state.cases[caseId] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Case seed unavailable")
    expect(await session.readStatus("alice")).toEqual({ status: "ok", value: { ...operation, recordedState: "planned", status: "not-attempted" } })
    const review = await session.review(command, binding)
    if (review.status !== "ok") throw new Error("Real Planner review unavailable")
    controls.reviewDigest = proposalReviewDigest({ caseId, caseIncarnation: incarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: review.value.fields, sourceRefDigest: review.value.source.refDigest })
    expect(await session.execute("alice", "unconfirmed")).toMatchObject({ status: "denied", reason: "application-confirmation-required" })
    expect(controls.dispatches).toBe(0)
    controls.confirmed = true

    const first = session.execute("alice", "first-intent")
    try {
      const stage = await Promise.race([entered.promise.then(() => "entered" as const), first.then((result) => result)])
      if (stage !== "entered") throw new Error(`First dispatch unavailable: ${JSON.stringify(stage)}`)
      const reviews = controls.reviews
      const confirmations = controls.confirmations
      const concurrent = await Promise.all([session.execute("alice", "first-intent"), session.execute("alice", "different-intent"), session.execute("bob", "collaborator-intent")])
      for (const result of concurrent) expect(result).toEqual({ status: "unavailable", reason: "application-indeterminate-reconciliation-required" })
      expect(controls.dispatches).toBe(1)
      expect(controls.reviews).toBe(reviews)
      expect(controls.confirmations).toBe(confirmations)
      expect(await session.readStatus("bob")).toEqual({ status: "ok", value: { ...operation, recordedState: "planned", status: "receipt-required" } })
    } finally { release.resolve() }
    expect(await first).toMatchObject({ status: "unavailable", reason: "domain-result-unknown" })
    const receipt = controls.receipt
    if (!receipt || !receipt.result.ok) throw new Error("Committed domain receipt missing from fault injector")
    expect(await session.readReceipt(change)).toMatchObject({ status: "ok", value: { state: "found", receipt } })
    const official = await session.official()
    const actual = rows(official.data.versions)[0]
    const applied = rows(actual?.lines)[0]?.f
    if (!Array.isArray(applied)) throw new Error("Applied forecast unavailable")
    expect(applied[0]).toBe(42)
    expect((await session.readCase()).receipts).toEqual([])
    const receipts = await session.state.read(session.request("alice"), "receipts", (state) => state.receipts[receipt.id])
    if (receipts.status !== "ok" || !receipts.value) throw new Error("Actual receipt unavailable before fault")
    const removed = await session.state.transaction(session.request("alice"), { namespace: "receipts", expectedStorageVersion: receipts.storageVersion, targetRef: target.id, targetIncarnation: target.incarnation, idempotencyKey: "fault-remove-authoritative-receipt", commandDigest: digestSfValue(receipt) }, async (state) => { delete state.receipts[receipt.id]; return { commit: true, value: true } })
    if (removed.status !== "ok") throw new Error("Receipt fault was not installed")
    expect(await session.readReceipt(change)).toEqual({ status: "ok", value: { state: "not-found" } })
    controls.hold = false
    controls.loseResponse = false
    controls.confirmed = false
    await driver.value.dispose()
    driver.open = false
    driver.value = await openLocalStore(directory)
    driver.open = true
    const restarted = await createSession(driver.value, controls, entered, release)
    expect(await restarted.readReceipt(change)).toEqual({ status: "ok", value: { state: "not-found" } })
    const counters = { dispatches: controls.dispatches, reviews: controls.reviews, confirmations: controls.confirmations }
    const statusContext = await restarted.admit("alice", "status-before-revocation")
    expect(await restarted.applicationStatus(operation, statusContext)).toEqual({ status: "ok", value: { ...operation, recordedState: "planned", status: "receipt-required" } })
    const shown = await restarted.statusHttp("bob", operation)
    expect(shown?.status).toBe(200)
    expect(await shown!.json()).toEqual({ status: "ok", value: { ...operation, recordedState: "planned", status: "receipt-required" } })
    expect((await restarted.statusHttp("alice", { ...operation, effect: "applied" }))?.status).toBe(400)
    expect((await restarted.statusHttp("alice", operation, "https://untrusted.example"))?.status).toBe(403)
    expect((await restarted.statusHttp("outsider", operation))?.status).toBe(403)
    const retried = await Promise.all([restarted.execute("alice", "first-intent"), restarted.execute("alice", "new-after-restart"), restarted.execute("bob", "new-collaborator-intent")])
    for (const result of retried) expect(result).toEqual({ status: "unavailable", reason: "application-indeterminate-reconciliation-required" })
    expect({ dispatches: controls.dispatches, reviews: controls.reviews, confirmations: controls.confirmations }).toEqual(counters)
    expect(await restarted.official()).toEqual(official)
    expect(await restarted.readCase()).toEqual(decision)
    controls.revoked = true
    expect(await restarted.execute("alice", "revoked-read")).toMatchObject({ status: "denied" })
    expect(await restarted.applicationStatus(operation, statusContext)).toEqual({ status: "denied", reason: "invalid-authority" })
    expect((await restarted.statusHttp("alice", operation))?.status).toBe(403)
    restarted.finish(statusContext)
    controls.revoked = false

    // Recovery restores the exact domain-authored receipt, including the original
    // proof. The reservation must not block receipt-first reconciliation.
    const missing = await restarted.state.read(restarted.request("alice"), "receipts", (state) => state.receipts[receipt.id])
    if (missing.status !== "ok" || missing.value) throw new Error("Receipt unexpectedly present")
    const restored = await restarted.state.transaction(restarted.request("alice"), { namespace: "receipts", expectedStorageVersion: missing.storageVersion, targetRef: target.id, targetIncarnation: target.incarnation, idempotencyKey: "recover-exact-domain-receipt", commandDigest: digestSfValue(receipt) }, async (state) => { state.receipts[receipt.id] = structuredClone(receipt); return { commit: true, value: true } })
    if (restored.status !== "ok") throw new Error("Receipt recovery unavailable")
    expect(await restarted.execute("alice", "reconcile-original-receipt")).toEqual({ status: "ok", value: receipt })
    expect({ dispatches: controls.dispatches, reviews: controls.reviews, confirmations: controls.confirmations }).toEqual(counters)
    expect(await restarted.readCase()).toMatchObject({ state: "applied", version: 2, choices: [choice], preparedChanges: [{ state: "applied", receipt }], receipts: [receipt] })
    expect(await restarted.official()).toEqual(official)
    const reconciledRequest = { ...operation, caseRef: { ...operation.caseRef, version: 2 } }
    expect(await restarted.readStatus("alice", reconciledRequest)).toEqual({ status: "ok", value: { ...reconciledRequest, recordedState: "applied", status: "reconciled" } })
    expect(await restarted.readStatus("bob", reconciledRequest)).toEqual({ status: "unavailable", reason: "case-receipt-unavailable" })
    const restricted = await restarted.statusHttp("bob", reconciledRequest)
    expect(restricted?.status).toBe(503)
    expect(await restricted!.json()).toEqual({ status: "unavailable", reason: "case-receipt-unavailable" })
    expect(await restarted.readStatus("alice")).toEqual({ status: "stale", reason: "case-changed" })
    expect((await restarted.statusHttp("alice", operation))?.status).toBe(409)
    const reconciledHttp = await restarted.statusHttp("alice", reconciledRequest)
    expect(reconciledHttp?.status).toBe(200)
    expect(await reconciledHttp!.json()).toEqual({ status: "ok", value: { ...reconciledRequest, recordedState: "applied", status: "reconciled" } })
    expect({ dispatches: controls.dispatches, reviews: controls.reviews, confirmations: controls.confirmations }).toEqual(counters)

    // Reobserve after the final asynchronous ACL callback, not only before it.
    let authorizations = 0
    const raced = createPreparedApplicationStatus({ state: restarted.state, host: restarted.host, receipts: restarted.receipts, authorizeCase: async (value, context) => {
      if (++authorizations === 2) {
        const observed = await restarted.state.read(restarted.request("alice"), "cases", (state) => state.cases[caseId])
        if (observed.status !== "ok" || !observed.value) throw new Error("Concurrent case unavailable")
        const changed = await restarted.state.transaction(restarted.request("alice"), { namespace: "cases", expectedStorageVersion: observed.storageVersion, targetRef: caseId, targetIncarnation: incarnation, idempotencyKey: "status-race", commandDigest: digestSfValue({ objective: "Concurrent review" }) }, async (state) => {
          state.cases[caseId] = { ...state.cases[caseId]!, version: 3, objective: "Concurrent review" }
          return { commit: true, value: true }
        })
        if (changed.status !== "ok") throw new Error("Concurrent review did not commit")
      }
      return value.participants.includes(context.binding.principalRef) && await restarted.host.revalidate(context)
    } })
    const racedContext = await restarted.admit("alice", "read-raced-status")
    expect(await raced(reconciledRequest, racedContext)).toEqual({ status: "stale", reason: "case-changed" })
    restarted.finish(racedContext)
    expect({ dispatches: controls.dispatches, reviews: controls.reviews, confirmations: controls.confirmations }).toEqual(counters)
  } finally { release.resolve(); if (driver.open) await driver.value.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 180_000)

function latch() {
  const value: { resolve?: () => void } = {}
  const promise = new Promise<void>((resolve) => { value.resolve = resolve })
  return { promise, resolve: () => value.resolve?.() }
}

async function createSession(store: Awaited<ReturnType<typeof openLocalStore>>, controls: { confirmed: boolean; hold: boolean; loseResponse: boolean; dispatches: number; reviews: number; confirmations: number; revoked: boolean; reviewDigest: string; receipt?: CommandReceipt }, entered: ReturnType<typeof latch>, release: ReturnType<typeof latch>) {
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  const environment = { at, id: randomUUID, directory: [] }
  const request = (principal: string, identity = "fixture") => new Request("https://example.test/", { headers: { authorization: principal, "x-command-id": identity } })
  const authorize = async (incoming: Request) => {
    const principalRef = incoming.headers.get("authorization")
    return !controls.revoked && (principalRef === "alice" || principalRef === "bob") ? { installationId: "install", projectId: "project", principalRef, accessRevision: "a1", policyVersion: "p1" } : undefined
  }
  const ui = createSfUiAuthority({ authorize, commandIdentity: async (incoming) => incoming.headers.get("x-command-id") ?? undefined, createId: randomUUID, now: Date.now, privateCommands: ["wp11-application-fixture", "sf-human:decisions.portfolio.read"] })
  const human = createSfHumanAuthority({ origin: "https://example.test", ui })
  const admit = async (principal: string, identity: string) => {
    const admitted = await ui.admit(request(principal, identity), "wp11-application-fixture", digestSfValue(operation))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "wp11-application-fixture", digestSfValue(operation))) throw new Error("UI authority unavailable")
    return admitted.value
  }
  const authenticate: Application["authenticate"] = async (incoming, snapshot) => {
    const principal = incoming.headers.get("authorization")
    return principal && snapshot ? resolve(principal, [...snapshot.roleMap], (group) => (principal === "alice" || principal === "bob") && group === "finance-group") : null
  }
  const host = { persistence, authenticate, environment: async () => environment, requestFor: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.requestFor(binding) : undefined, revalidate: (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false) }
  const planner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "unused" }) })
  const review = createPlannerPreparedReview({ host, issueSource: planner.issueSource })
  const state = createSfProductState({ persistence, createId: randomUUID, authorize, resolveTarget: async (_incoming, snapshot, namespace, targetRef) => {
    if (namespace === "cases" && targetRef === caseId) return { incarnation }
    if (namespace !== "receipts") return undefined
    const current = object(object(object(snapshot.data.__sfProductV1).cases)[caseId])
    const targets = rows(current.preparedChanges).map((change) => object(change.target)).filter((target) => target.id === targetRef)
    return targets.length === 1 && typeof targets[0]!.incarnation === "string" ? { incarnation: targets[0]!.incarnation } : undefined
  } })
  const readCase = async () => {
    const current = await state.read(request("alice"), "cases", (value) => value.cases[caseId])
    if (current.status !== "ok" || !current.value) throw new Error("Case unavailable")
    return current.value
  }
  const reviewDigestFor: ReviewDigestFor = (binding, incoming, change) => ["alice", "bob"].includes(binding.binding.principalRef) && incoming.caseRef.id === caseId && incoming.caseRef.incarnation === incarnation && incoming.choiceId === change.choiceId && incoming.changeId === change.id ? controls.reviewDigest : undefined
  const producer = createSfPreparedApply({ state, host, authorizeCase: async (value, binding) => value.participants.includes(binding.binding.principalRef) && await host.revalidate(binding), authorizeLookup: async (_lookup, binding) => host.revalidate(binding), authorizeReceipt: async (receipt, _lookup, binding) => receipt.principalRef === binding.binding.principalRef && await host.revalidate(binding), confirmHuman: async (_incoming, _change, binding) => controls.confirmed && await host.revalidate(binding), reviewDigestFor,
    resolveActor: (_snapshot, binding) => ({ ...actor, id: binding.binding.principalRef }),
    resolveMutation: (snapshot, change, currentActor, binding) => {
      const evidence = change.operation.preview.values[0]?.sourceRefs[0]
      if (evidence?.kind !== "record") return undefined
      return preparePlannerMutation({ snapshot, actor: currentActor, environment, context: binding, target: change.target, evidence, scope: { principalRef: currentActor.id, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, recordType: change.target.type, recordId: change.target.id, selector: sfPlannerProjectionSelector(snapshot, currentActor) }, command: change.operation.command, operationId: change.operation.id, idempotencyKey: change.idempotencyKey })?.mutation
    }, verifyGrant: (_snapshot, _incoming, _change, currentActor, binding) => currentActor.id === binding.binding.principalRef && currentActor.canWrite && currentActor.roles.includes("finance") && !controls.revoked, receiptVersion: (snapshot, change) => plannerPreparedRevision(snapshot, change.operation.command), environment: () => environment, createId: randomUUID, now: () => at })
  const apply: PreparedApplyPort = { ...producer, executePrepared: async (incoming, binding) => {
    controls.dispatches += 1
    if (controls.hold) { entered.resolve(); await release.promise }
    const result = await producer.executePrepared(incoming, binding)
    if (result.status === "ok" && controls.loseResponse) { controls.receipt = structuredClone(result.value); throw new Error("Lost the committed domain response") }
    return result
  } }
  const execute = createPreparedExecution({ state, host, apply, authorizeCase: async (value, binding) => value.participants.includes(binding.binding.principalRef) && await host.revalidate(binding), authorizeApplication: async (_incoming, _change, binding) => host.revalidate(binding), confirmApplication: async (_incoming, binding) => { controls.confirmations += 1; return controls.confirmed && await host.revalidate(binding) }, operationIdentity: (binding) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined, reviewDigestFor,
    revalidateProducer: async (incoming, binding) => {
      controls.reviews += 1
      const current = await readCase()
      const change = current.preparedChanges.find((item) => item.id === incoming.changeId)
      const choice = current.choices.find((item) => item.id === incoming.choiceId)
      if (!change || !choice) return { status: "unavailable", reason: "review-choice-unavailable" }
      const checked = await review(change.operation, binding)
      if (checked.status !== "ok") return checked
      return { status: "ok", value: { reviewDigest: proposalReviewDigest({ caseId, caseIncarnation: incarnation, changeCaseVersion: change.caseVersion, choiceDigest: digestSfValue(choice), change, fields: checked.value.fields, sourceRefDigest: checked.value.source.refDigest }) } }
    }, classifyReceipt: async (receipt, _change, binding) => {
      if (!await host.revalidate(binding)) return undefined
      const ref: Extract<BusinessEvidenceRef, { kind: "receipt" }> = { schema: "sf-evidence-v1", kind: "receipt", refId: receipt.id, installationId: binding.binding.installationId, projectId: binding.binding.projectId, evidenceLevel: "observed", refDigest: "", target: { surface: receipt.surface, receiptId: receipt.id, idempotencyKey: receipt.idempotencyKey, targetIncarnation: receipt.targetIncarnation, commandDigest: receipt.commandDigest, version: receipt.version } }
      return { state: receipt.result.ok ? "applied" : "conflict", evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
    } })
  const receipts = { readReceipt: producer.readReceipt }
  const applicationStatus = createPreparedApplicationStatus({ state, host, receipts, authorizeCase: async (value, binding) => value.participants.includes(binding.binding.principalRef) && await host.revalidate(binding) })
  const empty = {} as unknown as Parameters<typeof createDecisionHttp>[0]
  const statusHttp = createDecisionHttp({ ...empty, origin: "https://example.test", mount: "/decisions", human, applicationStatus,
    withCase: async (_binding, _caseRef, options, action) => { expect(options.allowHistoricalRetry).toBe(false); return action() } })
  return { persistence, planner, environment, request, state, review, admit, readCase, host, receipts, applicationStatus, finish: ui.finish,
    readStatus: async (principal: string, incoming: PreparedApplyRequest = operation) => {
      const binding = await admit(principal, "read-application-status")
      try { return await applicationStatus(incoming, binding) } finally { ui.finish(binding) }
    },
    statusHttp: (principal: string, payload: unknown, origin = "https://example.test") => statusHttp(new Request("https://example.test/decisions?sf=decision-application-status", {
      method: "POST", headers: { authorization: principal, origin, "content-type": "application/json", "x-command-id": "read-application-status-http" }, body: JSON.stringify(payload),
    })),
    official: () => persistence.transaction("planner", async ({ data, versions, sequences, audit, notices }) => ({ commit: false, value: structuredClone({ data, versions, sequences, audit, notices }) })),
    readReceipt: async (change: PreparedChange) => producer.readReceipt({ surface: change.target.surface, targetRef: change.target.id, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey, commandDigest: change.operation.commandDigest }, await admit("alice", "receipt-read")),
    execute: async (principal: string, identity: string) => {
      if (controls.revoked) {
        const denied = await ui.admit(request(principal, identity), "wp11-application-fixture", digestSfValue(operation))
        return denied.status === "ok" ? execute(operation, denied.value) : denied
      }
      const binding = await admit(principal, identity)
      try { return await execute(operation, binding) } finally { ui.finish(binding) }
    },
  }
}
