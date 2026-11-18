import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ChoiceRecord, DecisionCase, PreparedChange, ScenarioResult } from "../../../product/contracts/decisions.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfPreparedApply } from "../../../product/decisions/prepared-apply.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../product/integration/source-projections.ts"
import { plannerPreparedRevision, preparePlannerMutation } from "../../../product/planner/prepared.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"

const at = "2026-11-13T00:00:00Z"

test("Planner preparation and the real WP11 apply consumer preserve grants, atomic receipts, retry, reopen and stale rejection", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-planner-prepared-integration-"))
  await chmod(directory, 0o700)
  let database = await openLocalStore(directory)
  try {
    // Forward to the current driver so reopening exercises every read against the reopened SQLite file.
    const driver: Parameters<typeof createSfSourcePersistence>[0]["persistence"] = {
      transaction: (surface, work, options) => database.transaction(surface, work, options),
      transactionAll: (work, options) => database.transactionAll!(work, options),
      currentSnapshots: () => database.currentSnapshots?.(),
    }
    const persistence = createSfSourcePersistence({ persistence: driver, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    // The consumer commits Planner and Dashboard together; every installation surface has source identities.
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }]
      snapshot.data.versions = [{ id: "v0", year: 2027, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [100] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "finance", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const request = new Request("https://example.test/planner", { headers: { authorization: "finance" } })
    const authority = { active: true, granted: false, nextReceipt: 0 }
    const host: DomainPortHost = { persistence, authenticate: async (http, snapshot) => { const id = http.headers.get("authorization"); return authority.active && id ? resolve(id, [...snapshot!.roleMap], (group) => id === "finance" && group === "finance-group") : null }, environment: async () => ({ at, id: randomUUID, directory: [] }), requestFor: () => request, revalidate: async () => authority.active }
    const planner = createPlannerProduct({ host, scopedSources: persistence, coverageFor: async () => ({ status: "unavailable", reason: "coverage-not-published" }) })
    const issued = await planner.issueSource("v0", context)
    if (issued.status !== "ok") throw new Error(issued.reason)
    const snapshot = await persistence.transaction("planner", async (value) => ({ commit: false, value: structuredClone(value) }))
    const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
    const environment = { at, id: randomUUID, directory: [] }
    const target = { surface: "planner" as const, type: "planner-version", id: "v0", incarnation: issued.value.evidence.target.incarnation, version: issued.value.evidence.target.version, fields: issued.value.evidence.target.fields, period: issued.value.evidence.target.period!, observedAt: at }
    const scope = { principalRef: "finance", accessRevision: "1", policyVersion: "1", recordType: "planner-version", recordId: "v0", selector: sfPlannerProjectionSelector(snapshot, actor) }
    const produced = preparePlannerMutation({ snapshot, actor, environment, context, target, scope, evidence: issued.value.evidence, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 42 } }, operationId: "operation", idempotencyKey: "edit" })
    const stale = preparePlannerMutation({ snapshot, actor, environment, context, target, scope, evidence: issued.value.evidence, command: { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 43 } }, operationId: "stale-operation", idempotencyKey: "stale-edit" })
    if (!produced || !stale) throw new Error("Planner producer unavailable")
    const current = await planner.planner.compareForecast({ baseRef: issued.value.evidence.refId, candidateRef: issued.value.evidence.refId, period: target.period, currency: "USD" }, context)
    if (current.status !== "ok") throw new Error(current.reason)
    const scenarioRequest = { baseRef: issued.value.evidence.refId, operations: [], assumptions: [] }
    const scenario: ScenarioResult = { id: "case-preview", version: 0, components: current.value.baseline.components, currency: "USD", horizon: target.period, sourceRefs: [issued.value.evidence], costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon: target.period, issues: ["coverage-pending"], evaluatedSourceRefs: [issued.value.evidence], coverageState: "pending", derivedMissingCategoryIds: [...RENEWAL_TRANSITION_CATEGORIES], entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ categoryId, status: "pending" as const, reason: "Awaiting case coverage" })) }, comparisonStatus: "conditioned", knownSubtotal: null, total: null, unresolvedConditions: ["coverage-pending"], restrictions: ["preview-not-applied"] }
    const change: PreparedChange = { id: "change", caseId: "case", caseVersion: 1, choiceId: "choice", target, expectedVersion: 0, operation: { id: "operation", target, command: produced.command, idempotencyKey: "edit", commandDigest: produced.mutation.commandDigest, expectedVersion: 0, requiredAuthority: [], preview: current.value.baseline }, preview: scenario, requiredAuthority: [], idempotencyKey: "edit", state: "planned" }
    const staleChange: PreparedChange = { ...change, id: "stale-change", idempotencyKey: "stale-edit", operation: { ...change.operation, id: "stale-operation", idempotencyKey: "stale-edit", command: stale.command, commandDigest: stale.mutation.commandDigest } }
    const choice: ChoiceRecord = { id: "choice", alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [issued.value.evidence], principalRef: "finance", reason: "Human selected the explicitly conditioned forecast edit", at, scenario: scenarioRequest, result: scenario, comparison: { baselineResultRef: "case-baseline", alternativeResultRef: "case-alternative", costCoverageRefs: [], criterionResults: [], unresolvedConditions: ["coverage-pending"], comparisonStatus: "conditioned", knownDifference: null, completeDifference: null }, comparisonStatus: "conditioned", costCoverage: scenario.costCoverage }
    const decision: DecisionCase = { id: "case", incarnation: "case-inc", version: 1, state: "chosen", objective: "Apply the selected forecast edit", horizon: target.period, currency: "USD", criteria: [], participants: ["finance"], sourceRefs: [issued.value.evidence], alternatives: [{ id: "alternative", version: 1, title: "Forecast edit", scenario: scenarioRequest, result: scenario }], costCoverageBases: [{ id: "basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [issued.value.evidence] }], assumptions: [], questions: [], choices: [choice], preparedChanges: [change, staleChange], receipts: [], ledger: [] }
    const state = createSfProductState({ persistence, createId: () => "state", resolveTarget: async (_request, _snapshot, namespace) => ({ incarnation: namespace === "cases" ? "case-inc" : target.incarnation }), authorize: async () => authority.active ? { principalRef: "finance", policyVersion: "1", accessRevision: "1" } : undefined })
    expect(await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (value) => { value.cases.case = decision; return { commit: true, value: true } })).toMatchObject({ status: "ok" })
    const options: Parameters<typeof createSfPreparedApply>[0] = { state, host, authorizeCase: async () => authority.active, authorizeLookup: async () => authority.active, authorizeReceipt: async () => authority.active, confirmHuman: async () => authority.granted, resolveActor: () => actor, resolveMutation: (_snapshot, selected) => selected.id === "stale-change" ? stale.mutation : produced.mutation, verifyGrant: () => authority.granted, receiptVersion: (value, selected) => plannerPreparedRevision(value, selected.operation.command), environment: () => environment, createId: () => `receipt-${++authority.nextReceipt}`, now: () => at }
    const apply = createSfPreparedApply(options)
    const operation = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, changeId: "change", choiceId: "choice" }
    const all = () => persistence.transactionAll!(async (snapshots) => ({ commit: false, value: structuredClone(snapshots) }))
    const before = await all()
    expect(await apply.executePrepared(operation, context)).toMatchObject({ status: "denied", reason: "human-authority-required" })
    expect(await all()).toEqual(before)

    authority.granted = true
    const noReceiptVersion = createSfPreparedApply({ ...options, receiptVersion: () => undefined })
    expect(await noReceiptVersion.executePrepared(operation, context)).toEqual({ status: "unavailable", reason: "domain-application-unavailable" })
    // The domain mutation was staged, but a receipt failure commits neither surface nor audit.
    expect(await all()).toEqual(before)

    const result = await apply.executePrepared(operation, context)
    expect(result).toMatchObject({ status: "ok", value: { result: { ok: true }, version: 1 } })
    if (result.status !== "ok") throw new Error(result.reason)
    const committed = await all()
    const changed = committed.planner.data.versions as { lines: { f: (number | null)[] }[] }[]
    expect(changed[0]!.lines[0]!.f[0]).toBe(42)
    expect(committed.planner.audit.length).toBeGreaterThan(before.planner.audit.length)
    const receipts = await state.read(request, "receipts", (value) => Object.values(value.receipts))
    expect(receipts).toMatchObject({ status: "ok", value: [result.value] })
    expect(await apply.executePrepared(operation, context)).toEqual(result)
    expect(await all()).toEqual(committed)

    await database.dispose()
    database = await openLocalStore(directory)
    expect(await all()).toEqual(committed)
    expect(await apply.executePrepared(operation, context)).toEqual(result)
    expect(await all()).toEqual(committed)
    expect(await apply.readReceipt({ surface: "planner", targetRef: target.id, targetIncarnation: target.incarnation, idempotencyKey: "edit", commandDigest: produced.mutation.commandDigest }, context)).toEqual({ status: "ok", value: { state: "found", receipt: result.value } })
    expect(await apply.readReceipt({ surface: "planner", targetRef: target.id, targetIncarnation: target.incarnation, idempotencyKey: "edit", commandDigest: "f".repeat(64) }, context)).toEqual({ status: "conflict", reason: "idempotency-content-changed" })

    const rejected = await apply.executePrepared({ ...operation, changeId: "stale-change" }, context)
    expect(rejected).toMatchObject({ status: "ok", value: { result: { ok: false, status: 409 } } })
    const afterRejected = await all()
    expect(afterRejected.planner).toEqual(committed.planner)
    expect(await state.read(request, "receipts", (value) => Object.values(value.receipts).length)).toMatchObject({ status: "ok", value: 2 })
    const currentCase = await state.read(request, "cases", (value) => value.cases.case)
    if (currentCase.status !== "ok" || !currentCase.value) throw new Error("Case unavailable")
    expect(await state.transaction(request, { namespace: "cases", expectedStorageVersion: currentCase.storageVersion, targetRef: "case", targetIncarnation: "case-inc", idempotencyKey: "reconcile", commandDigest: digestSfValue(result.value) }, async (value) => {
      value.cases.case = { ...currentCase.value!, version: 2, preparedChanges: currentCase.value!.preparedChanges.map((item) => item.id === "change" ? { ...item, state: "applied" as const, receipt: result.value } : item) }
      return { commit: true, value: true }
    })).toMatchObject({ status: "ok" })
    expect(await apply.executePrepared(operation, context)).toEqual(result)
    const reconciled = await all()
    authority.active = false
    expect(await apply.executePrepared(operation, context)).toMatchObject({ status: "denied" })
    expect(await all()).toEqual(reconciled)
  } finally { await database.dispose(); await rm(directory, { recursive: true, force: true }) }
})
