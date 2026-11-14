import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createChangeProposalStore } from "../../../product/decisions/change-proposal-store.ts"
import { createDecisionChoiceResultLookup } from "../../../product/decisions/choice-result-lookup.ts"
import { createDecisionCasePort, encodeCaseRef, parseCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionCapabilities, encodeReceiptRef } from "../../../product/decisions/capabilities.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("case draft survives a real store reopen, exact retry is idempotent and revoked access is denied", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-case-test-"))
  await chmod(directory, 0o700)
  const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const evidence: BusinessContextService = { context: async () => [], resolve: async () => { throw new Error("unexpected evidence") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected emission") } }
  const access = { allowed: true }
  const ids = { n: 0 }
  const open = async () => {
    const store = await openLocalStore(directory)
    const state = createSfProductState({ persistence: store, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: "installation-incarnation" }), authorize: async () => access.allowed ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const cases = createDecisionCasePort({ state, host: { requestFor: () => new Request("https://example.test/"), revalidate: async () => access.allowed }, creationTarget: { ref: "installation:install:cases", incarnation: "installation-incarnation" }, operationIdentity: () => "operation-1", authorizeCase: async () => access.allowed, verifyScenarioOperations: async () => access.allowed, evidence, createId: () => `id-${++ids.n}`, now: () => "2026-11-13T00:00:00Z" })
    return { store, cases }
  }
  try {
    const first = await open()
    const request = { objective: "Choose a transition", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["cost"], sourceRefs: [] }
    const descriptors = createDecisionCapabilities({ cases: first.cases, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: operation === "sf_case_read" ? "readCase" : "draftCase", inputDigest, resultDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" }) })
    expect(descriptors.map((descriptor) => descriptor.id)).toEqual(["sf_case_read", "sf_receipt_get", "sf_case_draft"])
    expect((await descriptors[1]!.handler({ receiptRef: "unscoped" }, binding)).status).toBe("needs-input")
    const denied = createDecisionCapabilities({ cases: first.cases, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: () => undefined })
    expect((await denied[2]!.handler(request, binding)).status).toBe("denied")
    expect((await first.cases.draft({ ...request, criteria: [] }, binding)).status).toBe("needs-input")
    const native = { kind: "native" } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedCallContext
    expect((await first.cases.draft(request, native)).status).toBe("denied")
    expect((await denied[2]!.handler(request, native)).status).toBe("denied")
    const draft = await first.cases.draft(request, binding)
    expect(draft.status).toBe("ok")
    if (draft.status !== "ok") return
    const ref = encodeCaseRef(draft.value)
    const boundNative = { kind: "native", binding: { ...binding.binding, profileId: "sf_maestro", caseId: draft.value.id, caseIncarnation: draft.value.incarnation, caseVersion: draft.value.version }, lease: {} } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedCallContext
    const intent = await first.cases.prepareIntent({ ...request, objective: "Reframe within this case" }, boundNative)
    expect(intent.status).toBe("ok")
    if (intent.status === "ok") expect(intent.value.criteria).toEqual(draft.value.criteria)
    const reviewRef = { id: draft.value.id, incarnation: draft.value.incarnation, version: draft.value.version }
    expect(await first.cases.prepareIntentForCase({ ...request, objective: "Reframe within this case" }, reviewRef, binding)).toEqual(intent)
    expect((await first.cases.prepareIntentForCase(request, { ...reviewRef, version: reviewRef.version + 1 }, binding)).status).toBe("stale")
    const outside = { schema: "sf-evidence-v1", refId: "outside", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "outside", incarnation: "inc", version: 1, fields: ["amount"], projectionDigest: "b".repeat(64) } } as const
    expect(await first.cases.prepareIntent({ ...request, sourceRefs: [outside] }, boundNative)).toEqual({ status: "denied", reason: "source-outside-case-scope" })
    const afterIntent = await first.cases.read({ caseRef: ref }, binding)
    if (afterIntent.status === "ok") expect(afterIntent.value.case).toMatchObject({ version: 1, objective: request.objective })
    expect(parseCaseRef(ref)).toEqual({ id: draft.value.id, incarnation: draft.value.incarnation })
    expect(parseCaseRef(draft.value.id)).toBeUndefined()
    const capability = await descriptors[0]!.handler({ caseRef: ref }, binding)
    expect(capability.status).toBe("ok")
    if (capability.status === "ok") expect(capability.result).toMatchObject({ case: { id: draft.value.id, version: 1 } })
    expect(await first.cases.draft(request, binding)).toEqual(draft)
    await first.store.dispose()
    const reopened = await open()
    const read = await reopened.cases.read({ caseRef: ref }, binding)
    expect(read.status).toBe("ok")
    if (read.status === "ok") expect(read.value.case).toMatchObject({ id: draft.value.id, incarnation: draft.value.incarnation, objective: request.objective, version: 1 })
    expect((await reopened.cases.read({ caseRef: encodeCaseRef({ id: draft.value.id, incarnation: "replacement" }) }, binding)).status).toBe("denied")
    expect((await reopened.cases.read({ caseRef: draft.value.id }, binding)).status).toBe("needs-input")
    access.allowed = false
    expect((await reopened.cases.read({ caseRef: ref }, binding)).status).toBe("denied")
    expect((await reopened.cases.prepareIntentForCase(request, reviewRef, binding)).status).toBe("denied")
    await reopened.store.dispose()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

test("an entirely omitted renewal category remains pending", async () => {
  const { assessCostCoverage } = await import("../../../product/decisions/cost-coverage.ts")
  const { RENEWAL_TRANSITION_CATEGORIES } = await import("../../../product/contracts/decisions.ts")
  const result = assessCostCoverage({ basis: { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [] }, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, entries: [], components: [], evidence: [], supports: () => false })
  expect(result.coverageState).toBe("pending")
  expect(result.derivedMissingCategoryIds).toContain("training")
  expect(result.entries).toContainEqual({ categoryId: "training", status: "pending", reason: "missing-category" })
})

test("coverage distinguishes a sourced zero from an omitted category", async () => {
  const { assessCostCoverage } = await import("../../../product/decisions/cost-coverage.ts")
  const { RENEWAL_TRANSITION_CATEGORIES } = await import("../../../product/contracts/decisions.ts")
  const ref = { schema: "sf-evidence-v1", refId: "r", installationId: "install", projectId: "project", refDigest: "digest", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "q", incarnation: "i", version: 1, fields: ["amount"], period: { start: "2027-01-01", end: "2027-12-31" }, projectionDigest: "hash" } } as const
  const evidence = [{ state: "fresh", ref, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" }] as const
  const common = { basis: { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [ref] }, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, evidence, supports: () => true }
  const entries = RENEWAL_TRANSITION_CATEGORIES.filter((category) => category !== "training").map((categoryId) => ({ status: "not-applicable" as const, categoryId, justification: "supported by scope", evidenceRefs: [ref] }))
  const missing = assessCostCoverage({ ...common, entries, components: [] })
  expect(missing.coverageState).toBe("pending")
  expect(missing.derivedMissingCategoryIds).toEqual(["training"])
  const complete = assessCostCoverage({ ...common, entries: [...entries, { status: "included", categoryId: "training", componentRefs: ["zero"], evidenceRefs: [ref], scopeNote: "free training" }], components: [{ id: "zero", amount: 0, currency: "USD", period: common.horizon, evidenceState: "confirmed", sourceRefs: [{ surface: "planner", type: "quote", id: "q", incarnation: "i", version: 1, fields: ["amount"], period: common.horizon, observedAt: "2026-11-13T00:00:00Z" }] }] })
  expect(complete.coverageState).toBe("complete")
  const unsupported = assessCostCoverage({ ...common, supports: () => false, entries, components: [] })
  expect(unsupported.entries).toContainEqual({ categoryId: "service", status: "pending", reason: "scope-not-supported" })
})

test("case references encode both identities without accepting ambiguous aliases", () => {
  const value = { id: "case:a/b", incarnation: "inc:%x" }
  const ref = encodeCaseRef(value)
  expect(parseCaseRef(ref)).toEqual(value)
  expect(parseCaseRef("case:id:%ZZ")).toBeUndefined()
  expect(parseCaseRef("case:id:inc:extra")).toBeUndefined()
  expect(parseCaseRef("case:id:%69nc")).toBeUndefined()
})

test("receipt reconciliation preserves partial application and rejects changed identity", async () => {
  const { reconcileDomainReceipt, caseApplicationState } = await import("../../../product/decisions/receipts.ts")
  const change = { id: "one", target: { surface: "planner", incarnation: "inc" }, idempotencyKey: "key", operation: { commandDigest: "digest", idempotencyKey: "key", target: { surface: "planner", incarnation: "inc" } }, state: "planned" } as unknown as import("../../../product/contracts/decisions.ts").PreparedChange
  const receipt = { id: "receipt", idempotencyKey: "key", commandDigest: "digest", targetIncarnation: "inc", principalRef: "principal", surface: "planner", version: 1, result: { ok: true }, at: "2026-11-13T00:00:00Z" } as const
  const applied = reconcileDomainReceipt({ change, receipt, principalRef: "principal", state: "applied" })
  expect(applied.status).toBe("ok")
  if (applied.status !== "ok") return
  expect(caseApplicationState([applied.change, { ...change, id: "two" }])).toBe("partially-applied")
  expect(reconcileDomainReceipt({ change: applied.change, receipt, principalRef: "principal", state: "applied" })).toEqual(applied)
  expect(reconcileDomainReceipt({ change: applied.change, receipt: { ...receipt, commandDigest: "changed" }, principalRef: "principal", state: "applied" }).status).toBe("conflict")
})

test("a conditional human choice freezes the comparison and cost gap", async () => {
  const { createChoiceSnapshot } = await import("../../../product/decisions/choice.ts")
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const scenario = { id: "result-1", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: ["training:missing-category"], restrictions: [], comparisonStatus: "conditioned", costCoverage: { basisId: "renewal", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "missing-category" }], derivedMissingCategoryIds: ["training"] }, knownSubtotal: 210000, total: null } as const
  const comparison = { baselineResultRef: "base", alternativeResultRef: "result-1", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null } as const
  const value = { choices: [], costCoverageBases: [{ id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: [], additionalCategoryIds: [], sourceRefs: [] }], criteria: [{ id: "cost", description: "cost", required: true }], currency: "USD", horizon, alternatives: [{ id: "a", version: 1, title: "replace", scenario: { baseRef: "base", operations: [], assumptions: [] }, result: scenario }] } as unknown as import("../../../product/contracts/decisions.ts").DecisionCase
  const chosen = createChoiceSnapshot({ case: value, alternativeId: "a", alternativeVersion: 1, comparison, criteria: ["cost"], values: [], evidenceRefs: [], id: "choice", principalRef: "principal", reason: "conditional", at: "2026-11-13T00:00:00Z" })
  expect(chosen.status).toBe("ok")
  if (chosen.status !== "ok") return
  expect(chosen.choice.scenario.baseRef).toBe("base")
  expect(chosen.choice.result.knownSubtotal).toBe(210000)
  expect(chosen.choice.comparison.knownDifference).toBe(30000)
  expect(chosen.choice.costCoverage.coverageState).toBe("pending")
  expect(chosen.choice.result).not.toBe(scenario)
  ;(scenario.unresolvedConditions as unknown as string[]).push("later-change")
  expect(chosen.choice.result.unresolvedConditions).toEqual(["training:missing-category"])
  expect(createChoiceSnapshot({ case: value, alternativeId: "a", alternativeVersion: 1, comparison: { ...comparison, alternativeResultRef: "other" }, criteria: ["cost"], values: [], evidenceRefs: [], id: "choice", principalRef: "principal", reason: "conditional", at: "2026-11-13T00:00:00Z" }).status).toBe("conflict")
  const { RENEWAL_TRANSITION_CATEGORIES } = await import("../../../product/contracts/decisions.ts")
  const basisRef = { refDigest: "scope" } as import("../../../product/contracts/business-context.ts").BusinessEvidenceRef
  const claimedComplete = structuredClone(value)
  claimedComplete.costCoverageBases = [{ id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: RENEWAL_TRANSITION_CATEGORIES, additionalCategoryIds: [], sourceRefs: [basisRef] }]
  const result = { ...scenario, comparisonStatus: "complete", knownSubtotal: 210000, total: 210000, components: [{ amount: 210000, evidenceState: "estimated", currency: "USD", sourceRefs: [{}] }], costCoverage: { ...scenario.costCoverage, coverageState: "complete", evaluatedSourceRefs: [basisRef], entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => ({ status: "not-applicable", categoryId })), derivedMissingCategoryIds: [] } }
  claimedComplete.alternatives = [{ id: "a", version: 1, title: "replace", scenario: { baseRef: "base", operations: [], assumptions: [] }, result: result as unknown as import("../../../product/contracts/decisions.ts").ScenarioResult }]
  const comparisonComplete = { ...comparison, comparisonStatus: "complete", completeDifference: 30000 } as const
  expect(createChoiceSnapshot({ case: claimedComplete, alternativeId: "a", alternativeVersion: 1, comparison: comparisonComplete, criteria: ["cost"], values: [], evidenceRefs: [], id: "choice", principalRef: "principal", reason: "conditional", at: "2026-11-13T00:00:00Z" }).status).toBe("conflict")
})

test("preparing a change preserves the domain command and never applies it", async () => {
  const { prepareDomainChange } = await import("../../../product/decisions/prepared-change.ts")
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const decision = { id: "case", version: 3, currency: "USD", horizon, choices: [{ id: "choice" }] } as unknown as import("../../../product/contracts/decisions.ts").DecisionCase
  const command = { id: "cmd", idempotencyKey: "key", commandDigest: "a".repeat(64), expectedVersion: 0, requiredAuthority: ["domain-authority"], target: { surface: "planner", type: "forecast", id: "f", incarnation: "i", version: 1, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" }, command: { page: "planner", action: "edit", version: 0, values: {} }, preview: {} } as unknown as import("../../../product/contracts/context.ts").PreparedCommand
  const preview = { currency: "USD", horizon } as unknown as import("../../../product/contracts/decisions.ts").ScenarioResult
  const result = prepareDomainChange({ case: decision, expectedCaseVersion: 3, choiceId: "choice", command, preview, id: "change" })
  expect(result.status).toBe("ok")
  if (result.status === "ok") expect(result.change).toMatchObject({ state: "planned", expectedVersion: 0, target: { incarnation: "i", version: 1 }, operation: { command: { version: 0 } }, idempotencyKey: "key" })
  expect(prepareDomainChange({ case: decision, expectedCaseVersion: 2, choiceId: "choice", command, preview, id: "change" }).status).toBe("conflict")
  expect(prepareDomainChange({ case: decision, expectedCaseVersion: 3, choiceId: "choice", command: { ...command, command: { ...command.command, version: 1 } }, preview, id: "change" }).status).toBe("conflict")
  expect(prepareDomainChange({ case: decision, expectedCaseVersion: 3, choiceId: "choice", command: { ...command, target: { ...command.target, incarnation: "" } }, preview, id: "change" }).status).toBe("conflict")
  expect(prepareDomainChange({ case: decision, expectedCaseVersion: 3, choiceId: "choice", command: { ...command, target: { ...command.target, version: -1 } }, preview, id: "change" }).status).toBe("conflict")
  expect(prepareDomainChange({ case: decision, expectedCaseVersion: 3, choiceId: "choice", command: { ...command, command: { ...command.command, confirmed: true } }, preview, id: "change" }).status).toBe("conflict")
  expect(decision.version).toBe(3)
})

test("revoked source suppresses an otherwise authorized case", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-case-source-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const ref = { schema: "sf-evidence-v1", refId: "source", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "quote", recordId: "q", incarnation: "inc", version: 1, fields: ["amount"], projectionDigest: "b".repeat(64) } } as const
    const source = { fresh: true }
    const evidence: BusinessContextService = { context: async ({ refs }) => refs.map((item) => ({ ref: item, state: source.fresh ? "fresh" as const : "revoked" as const, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" })).reverse(), resolve: async () => { throw new Error("unused") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unused") } }
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => ({ incarnation: targetRef === "installation:install:cases" ? "installation-inc" : "source-case-2" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const ids = { n: 0 }
    const cases = createDecisionCasePort({ state, host: { requestFor: () => new Request("https://example.test/"), revalidate: async () => true }, creationTarget: { ref: "installation:install:cases", incarnation: "installation-inc" }, operationIdentity: () => "operation", authorizeCase: async () => true, verifyScenarioOperations: async () => true, evidence, createId: () => `source-case-${++ids.n}`, now: () => "2026-11-13T00:00:00Z" })
    const draft = await cases.draft({ objective: "source-bound", currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, criteria: ["cost"], sourceRefs: [ref] }, binding)
    expect(draft.status).toBe("ok")
    if (draft.status !== "ok") return
    expect((await cases.read({ caseRef: encodeCaseRef(draft.value) }, binding)).status).toBe("ok")
    const receipt = { id: "receipt", idempotencyKey: "key", commandDigest: "c".repeat(64), targetIncarnation: "target-inc", principalRef: "principal", surface: "planner", version: 1, result: { ok: true }, at: "2026-11-13T00:00:00Z" } as const
    const receiptRef = { schema: "sf-evidence-v1", refId: "receipt-evidence", installationId: "install", projectId: "project", refDigest: "d".repeat(64), evidenceLevel: "observed", kind: "receipt", target: { surface: "planner", receiptId: "receipt", idempotencyKey: "key", targetIncarnation: "target-inc", commandDigest: "c".repeat(64), version: 1 } } as const
    const horizon = draft.value.horizon
    const target = { surface: "planner", type: "forecast", id: "target", incarnation: "target-inc", version: 1, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" } as const
    const targetRef = { schema: "sf-evidence-v1", refId: "target-ref", installationId: "install", projectId: "project", refDigest: "f".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast", recordId: "target", incarnation: "target-inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "a".repeat(64) } } as const
    const preview = { id: "preview", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: ["pending"], restrictions: [], comparisonStatus: "conditioned", costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending", entries: [], derivedMissingCategoryIds: [] }, knownSubtotal: null, total: null } as const
    const prepared = { id: "change", caseId: draft.value.id, caseVersion: 1, choiceId: "choice", target, expectedVersion: 1, operation: { id: "command", target, command: { page: "planner", action: "edit", version: 1, values: {} }, idempotencyKey: "key", commandDigest: "c".repeat(64), expectedVersion: 1, requiredAuthority: [], preview: {} as import("../../../product/contracts/context.ts").DomainProjection }, preview, requiredAuthority: [], idempotencyKey: "key", state: "awaiting-approval", receipt } as const
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 1, idempotencyKey: "receipt", commandDigest: "e".repeat(64), targetRef: draft.value.id, targetIncarnation: draft.value.incarnation }, async (staged) => { staged.cases[draft.value.id] = { ...draft.value, version: 2, sourceRefs: [...draft.value.sourceRefs, receiptRef, targetRef], preparedChanges: [prepared], receipts: [receipt] }; return { commit: true, value: true } })
    const descriptors = createDecisionCapabilities({ cases, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "readReceipt", inputDigest, resultDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" }) })
    const retrieved = await descriptors[1]!.handler({ receiptRef: encodeReceiptRef(encodeCaseRef(draft.value), receipt.id) }, binding)
    expect(retrieved.status).toBe("ok")
    if (retrieved.status === "ok") expect(retrieved.result).toMatchObject({ receipts: [{ id: "receipt", status: "awaiting-approval" }] })
    source.fresh = false
    const revoked = await cases.read({ caseRef: encodeCaseRef(draft.value) }, binding)
    expect(revoked).toEqual({ status: "unavailable", reason: "case-evidence-unavailable" })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("partial domain execution reconciles a durable receipt and never repeats it on retry", async () => {
  const { createPreparedExecution } = await import("../../../product/decisions/apply.ts")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-apply-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const receipt = { id: "receipt", idempotencyKey: "key", commandDigest: "a".repeat(64), targetIncarnation: "target-inc", principalRef: "principal", surface: "planner", version: 1, result: { ok: true }, at: "2026-11-13T00:00:00Z" } as const
    const change = { id: "change", choiceId: "choice", target: { surface: "planner", id: "target", incarnation: "target-inc" }, idempotencyKey: "key", operation: { idempotencyKey: "key", commandDigest: "a".repeat(64), target: { surface: "planner", incarnation: "target-inc" } }, state: "planned" } as unknown as import("../../../product/contracts/decisions.ts").PreparedChange
    const decision = { id: "case", incarnation: "case-inc", version: 1, state: "chosen", participants: ["principal"], sourceRefs: [], choices: [{ id: "choice" }], preparedChanges: [change, { ...change, id: "other" }], receipts: [] } as unknown as import("../../../product/contracts/decisions.ts").DecisionCase
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "case-inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "case-inc" }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    const domain = { calls: 0, unavailable: true, loseResponse: true, confirmed: false, authorized: true, revokeOnConfirm: false }
    const apply: import("../../../product/contracts/ports.ts").PreparedApplyPort = {
      readReceipt: async () => domain.unavailable ? { status: "unavailable", reason: "unknown" } : store.transaction("planner", async (snapshot) => ({ commit: false, value: { status: "ok" as const, value: snapshot.data.receipt ? { state: "found" as const, receipt } : { state: "not-found" as const } } })),
      executePrepared: async () => {
        const result = await store.transaction("planner", async (snapshot) => { domain.calls += 1; snapshot.data.receipt = receipt; return { commit: true, value: { status: "ok" as const, value: receipt } } })
        if (domain.loseResponse) throw new Error("response-lost")
        return result
      },
    }
    const execute = createPreparedExecution({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, apply, reviewDigestFor: () => "a".repeat(64), revalidateProducer: async () => ({ status: "ok", value: { reviewDigest: "a".repeat(64) } }), authorizeCase: async () => true, authorizeApplication: async () => domain.authorized, confirmApplication: async () => { if (domain.revokeOnConfirm) domain.authorized = false; return domain.confirmed }, operationIdentity: () => "operation", classifyReceipt: async () => ({ state: "applied", evidence: { schema: "sf-evidence-v1", refId: "receipt-ref", installationId: "install", projectId: "project", refDigest: "d".repeat(64), evidenceLevel: "observed", kind: "receipt", target: { surface: "planner", receiptId: "receipt", idempotencyKey: "key", targetIncarnation: "target-inc", commandDigest: "a".repeat(64), version: 1 } } }) })
    const request = { caseRef: { id: "case", incarnation: "case-inc", version: 1 }, changeId: "change", choiceId: "choice" }
    expect((await execute(request, binding)).status).toBe("unavailable")
    expect(domain.calls).toBe(0)
    domain.unavailable = false
    expect((await execute(request, binding)).status).toBe("denied")
    expect(domain.calls).toBe(0)
    domain.confirmed = true
    domain.revokeOnConfirm = true
    expect((await execute(request, binding)).status).toBe("denied")
    expect(domain.calls).toBe(0)
    domain.authorized = true
    domain.revokeOnConfirm = false
    expect((await execute(request, binding)).status).toBe("unavailable")
    domain.loseResponse = false
    expect(await execute(request, binding)).toMatchObject({ status: "unavailable", reason: "review-proof-unbound" })
    expect(domain.calls).toBe(1)
    const result = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    expect(result.status).toBe("ok")
    if (result.status === "ok") expect(result.value).toMatchObject({ state: "chosen", version: 1 })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

test("human choice persists a versioned snapshot and ledger using the planner comparison", async () => {
  const { createDecisionMutations } = await import("../../../product/decisions/mutations.ts")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-choice-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    const plannerRef = { schema: "sf-evidence-v1", kind: "record", refId: "planner", installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "base", incarnation: "base-inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "b".repeat(64) } } as const
    const scenario = { id: "result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [plannerRef], unresolvedConditions: ["training:missing-category"], restrictions: [], comparisonStatus: "conditioned", costCoverage: { basisId: "renewal", basisVersion: 1, alternativeId: "a", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [plannerRef], coverageState: "pending", entries: [{ status: "pending", categoryId: "training", reason: "missing-category" }], derivedMissingCategoryIds: ["training"] }, knownSubtotal: 210000, total: null } as const
    const comparison = { baselineResultRef: "base", alternativeResultRef: "result", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null } as const
    const decision = { id: "case", incarnation: "inc", version: 1, state: "comparing", objective: "transition", currency: "USD", horizon, criteria: [{ id: "cost", description: "cost", required: true }], participants: ["principal"], sourceRefs: [plannerRef], alternatives: [{ id: "a", version: 1, title: "replace", scenario: { baseRef: "base", operations: [], assumptions: [] }, result: scenario }], costCoverageBases: [{ id: "renewal", version: 1, decisionType: "unknown", categoryIds: [], additionalCategoryIds: [], sourceRefs: [] }], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
    const proposalCoverageWrites = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, proposalCoverageWrites, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (staged) => { staged.cases.case = decision; staged.decisionResults = { result: { schema: "sf-decision-result-v1", kind: "scenario", resultRef: "result", caseRef: { id: "case", incarnation: "inc", version: 1 }, principalRef: "principal", accessRevision: "access", policyVersion: "policy", requestDigest: digestSfValue(decision.alternatives[0].scenario), resultDigest: digestSfValue(scenario), sourceRefs: [plannerRef], createdAt: "2026-11-13T00:00:00Z", result: scenario } }; return { commit: true, value: true } })
    const revised = { ...scenario, id: "result-2", version: 2, costCoverage: { ...scenario.costCoverage, alternativeVersion: 2 } } as const
    const simulation: { value: import("../../../product/contracts/decisions.ts").ScenarioResult } = { value: revised }
    const admission = { confirmed: false }
    const unavailable = async () => ({ status: "unavailable" as const, reason: "unused" })
    const { createDecisionProposalService } = await import("../../../product/decisions/proposals.ts")
    const evidence: BusinessContextService = { context: async ({ refs }) => refs.map((ref) => ({ ref, state: "fresh" as const, accessRevision: "access", checkedAt: "2026-11-13T00:00:00Z" })), resolve: async () => { throw new Error("unused") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unused") } }
    const host = { requestFor: () => new Request("https://example.test"), revalidate: async () => true }
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "case", incarnation: "inc" }, operationIdentity: () => "operation", authorizeCase: async () => true, verifyScenarioOperations: async () => true, evidence, createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    const alternative = createDecisionProposalService({ cases, host, planner: { compareForecast: unavailable, simulateScenario: async () => ({ status: "ok", value: simulation.value }), compareScenarios: async () => ({ status: "ok", value: comparison }), evaluateSensitivity: unavailable }, sources: { resolveForecastSource: unavailable, resolveForecastCoverage: async () => ({ status: "ok", value: { coverageRef: "coverage-2", basis: decision.costCoverageBases[0], assessment: simulation.value.costCoverage } }) }, resolveAlternative: async () => ({ status: "ok", value: { scenario: { baseRef: "base", operations: [], assumptions: [] }, coverageRef: "coverage-2" } }), authorizeProposal: async () => true })
    const descriptors = createDecisionCapabilities({ cases, alternative, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "draftAlternative", inputDigest, resultDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" }) })
    expect(descriptors.some((item) => item.id === "sf_alternative_draft")).toBe(true)
    const proposal = await alternative({ caseRef: encodeCaseRef(decision), proposal: { title: "revised", description: "reconsider", sourceRefs: [] }, sourceRefs: [] }, binding)
    expect(proposal.status).toBe("ok")
    if (proposal.status === "ok") expect(proposal.value.coverageRef).toBe("coverage-2")
    const capabilityProposal = await descriptors.find((item) => item.id === "sf_alternative_draft")!.handler({ caseRef: encodeCaseRef(decision), proposal: { title: "revised", description: "reconsider", sourceRefs: [] }, sourceRefs: [] }, binding)
    expect(capabilityProposal.status).toBe("ok")
    const beforeChoice = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (beforeChoice.status === "ok") expect(beforeChoice.value?.version).toBe(1)
    const mutations = createDecisionMutations({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, planner: { compareForecast: unavailable, simulateScenario: async () => ({ status: "ok", value: simulation.value }), compareScenarios: async () => ({ status: "ok", value: comparison }), evaluateSensitivity: unavailable }, sources: { resolveForecastSource: unavailable, resolveForecastCoverage: async () => ({ status: "ok", value: { coverageRef: "coverage-2", basis: decision.costCoverageBases[0], assessment: simulation.value.costCoverage } }) }, authorizeCase: async () => true, authorizeMutation: async () => true, verifyMutation: () => true, operationIdentity: () => "operation", confirmChoice: async () => admission.confirmed, resolveQuestion: async () => ({ status: "ok", value: { id: "choice-event", text: "Is training priced?", evidenceRefs: [{ schema: "sf-evidence-v1", refId: "question-ref", installationId: "install", projectId: "project", refDigest: "d".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "question", recordId: "choice-event", incarnation: "question-inc", version: 1, fields: ["text"], projectionDigest: "e".repeat(64) } }] } }), prepareDomainCommands: async () => ({ status: "ok", value: [{ command: { id: "domain-command", idempotencyKey: "domain-key", commandDigest: "c".repeat(64), expectedVersion: 0, requiredAuthority: ["planner"], target: { surface: "planner", type: "forecast", id: "target", incarnation: "target-inc", version: 1, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" }, command: { page: "planner", action: "edit", version: 0, values: {} }, preview: {} as import("../../../product/contracts/context.ts").DomainProjection }, preview: scenario, targetEvidence: { schema: "sf-evidence-v1", refId: "target-ref", installationId: "install", projectId: "project", refDigest: "f".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast", recordId: "target", incarnation: "target-inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "a".repeat(64) } } }] }), confirmAnswer: async () => false, resolveAnswer: unavailable, resolveChoiceValues: async () => ({ status: "ok", value: [] }), createId: () => "choice-event", now: () => "2026-11-13T00:00:00Z" })
    const native = { kind: "native" } as unknown as import("../../../product/contracts/sf-execution.ts").TrustedCallContext
    expect((await mutations.addQuestion({ caseRef: { id: "case", incarnation: "inc", version: 1 }, questionRef: "choice-event" }, native)).status).toBe("denied")
    const request = { caseRef: { id: "case", incarnation: "inc", version: 1 }, alternativeId: "a", alternativeVersion: 1, comparison: { scenarioRefs: ["base", "result"], criteria: ["cost"] }, criteria: ["cost"], reason: "conditional" }
    expect((await mutations.recordChoice(request, binding)).status).toBe("denied")
    admission.confirmed = true
    const chosen = await mutations.recordChoice(request, binding)
    expect(chosen.status).toBe("ok")
    if (chosen.status === "ok") expect(chosen.value.caseRef.version).toBe(2)
    const outbox = await state.read(new Request("https://example.test"), "outbox", (staged) => Object.values(staged.outbox))
    if (outbox.status === "ok") expect(outbox.value).toMatchObject([{ state: "pending", writerPrincipalRef: "principal", eventRef: { kind: "case-event", target: { caseId: "case", caseIncarnation: "inc", caseVersion: 2, eventId: "choice-event" } } }])
    else throw new Error("outbox unavailable")
    const { createChangeProposalService } = await import("../../../product/decisions/proposals.ts")
    const target = { surface: "planner", type: "forecast", id: "target", incarnation: "target-inc", version: 1, fields: ["amount"], period: horizon, observedAt: "2026-11-13T00:00:00Z" } as const
    const targetEvidence = { schema: "sf-evidence-v1", refId: "target-ref", installationId: "install", projectId: "project", refDigest: "f".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "forecast", recordId: "target", incarnation: "target-inc", version: 1, fields: ["amount"], period: horizon, projectionDigest: "a".repeat(64) } } as const
    const results = createSfDecisionResultStore({ state, host, authorizeCase: async () => true, verifySources: async (_value, refs, context) => (await evidence.context({ refs }, context)).every((item) => item.state === "fresh"), createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    const resolvePreview = createDecisionChoiceResultLookup({ cases, state, results, host })
    const proposalStore = createChangeProposalStore({ state, host, authorizeCase: async () => true, authorizeProposal: async () => true, verifySources: async () => true, verifySnapshot: () => true, operationIdentity: () => "proposal-operation", proposalCoverageWrites, now: () => "2026-11-13T00:00:00Z" })
    const change = createChangeProposalService({ cases, host, store: proposalStore, resolvePreview, resolveChanges: async () => ({ status: "ok", value: { changes: [{ command: { id: "domain-command", target, expectedVersion: 0, idempotencyKey: "domain-key", commandDigest: "c".repeat(64), requiredAuthority: ["planner"], command: { page: "planner", action: "edit", version: 0, values: {} }, preview: {} as import("../../../product/contracts/context.ts").DomainProjection }, preview: scenario, targetEvidence }], conditions: [] } }), authorizeProposal: async () => true })
    const changeDescriptors = createDecisionCapabilities({ cases, change, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: (_context, operation, inputDigest, resultDigest) => ({ kind: "ui", operation, handlerExport: "prepareChange", inputDigest, resultDigest, principalRef: "principal", callId: "call", requestId: "request", accessRevision: "access", at: "2026-11-13T00:00:00Z" }) })
    const changeProposal = await changeDescriptors.find((item) => item.id === "sf_change_prepare")!.handler({ caseRef: encodeCaseRef(decision), choiceRef: "choice-event", operations: [{ kind: "include", targetRef: "target" }] }, binding)
    expect(changeProposal.status).toBe("ok")
    const replayedProposal = await change({ caseRef: encodeCaseRef(decision), choiceRef: "choice-event", operations: [{ kind: "include", targetRef: "target" }] }, binding)
    expect(replayedProposal.status).toBe("ok")
    if (replayedProposal.status === "ok") {
      const refs = replayedProposal.value.changes.map((item) => item.changeRef)
      const set = await proposalStore.readSet({ caseRef: { id: "case", incarnation: "inc", version: 2 }, changeRefs: refs }, binding)
      expect(set.status).toBe("ok")
      if (set.status === "ok") expect(set.value.output).toEqual(replayedProposal.value)
      expect((await proposalStore.readSet({ caseRef: { id: "case", incarnation: "inc", version: 2 }, changeRefs: [...refs, "unrelated"] }, binding)).status).toBe("unavailable")
    }
    const afterProposal = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (afterProposal.status === "ok") expect(afterProposal.value?.version).toBe(2)
    admission.confirmed = false
    expect(await mutations.recordChoice(request, binding)).toEqual(chosen)
    expect((await mutations.recordChoice({ ...request, reason: "different" }, binding)).status).toBe("conflict")
    const persisted = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (persisted.status === "ok") expect(persisted.value).toMatchObject({ version: 2, state: "chosen", choices: [{ result: { knownSubtotal: 210000 }, comparison: { knownDifference: 30000 } }], ledger: [{ kind: "choice-recorded", principalRef: "principal" }] })
    const question = await mutations.addQuestion({ caseRef: { id: "case", incarnation: "inc", version: 2 }, questionRef: "choice-event" }, binding)
    expect(question.status).toBe("ok")
    expect((await mutations.answerQuestion({ caseRef: { id: "case", incarnation: "inc", version: 3 }, questionId: "choice-event", answerRef: "answer" }, binding)).status).toBe("denied")
    const prepared = await mutations.prepareChanges({ caseRef: { id: "case", incarnation: "inc", version: 3 }, choiceId: "choice-event", operations: [{ kind: "include", targetRef: "target" }] }, binding)
    expect(prepared.status).toBe("ok")
    const after = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (after.status === "ok") expect(after.value).toMatchObject({ version: 4, preparedChanges: [{ state: "planned", choiceId: "choice-event", expectedVersion: 0, target: { incarnation: "target-inc", version: 1 } }] })
    simulation.value = { ...revised, comparisonStatus: "complete", knownSubtotal: 0, total: 0, costCoverage: { ...revised.costCoverage, coverageState: "complete", entries: [], derivedMissingCategoryIds: [] } }
    const unsupported = await mutations.addAlternative({ caseRef: { id: "case", incarnation: "inc", version: 4 }, title: "revised", scenario: { baseRef: "base", operations: [], assumptions: [] }, coverageRef: "coverage-2", alternativeRef: { id: "a", version: 1 } }, binding)
    expect(unsupported).toEqual({ status: "conflict", reason: "incomplete-cost-coverage" })
    simulation.value = revised
    const updated = await mutations.addAlternative({ caseRef: { id: "case", incarnation: "inc", version: 4 }, title: "revised", scenario: { baseRef: "base", operations: [], assumptions: [] }, coverageRef: "coverage-2", alternativeRef: { id: "a", version: 1 } }, binding)
    expect(updated.status).toBe("ok")
    if (updated.status === "ok") {
      const resultRef = updated.value.resultRef
      if (!resultRef) throw new Error("scenario result reference unavailable")
      const recorded = await state.read(new Request("https://example.test"), "cases", (staged) => staged.decisionResults?.[resultRef])
      if (recorded.status === "ok") expect(recorded.value).toMatchObject({ kind: "scenario", caseRef: { id: "case", incarnation: "inc", version: 5 }, result: { costCoverage: { alternativeId: "a", alternativeVersion: 2 } } })
      else throw new Error("scenario result unavailable")
      expect(await mutations.addAlternative({ caseRef: { id: "case", incarnation: "inc", version: 4 }, title: "revised", scenario: { baseRef: "base", operations: [], assumptions: [] }, coverageRef: "coverage-2", alternativeRef: { id: "a", version: 1 } }, binding)).toEqual(updated)
    }
    const reconsidered = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (reconsidered.status === "ok") expect(reconsidered.value).toMatchObject({ version: 5, state: "reconsidering", alternatives: [{ id: "a", version: 2 }], choices: [{ alternativeVersion: 1, result: { knownSubtotal: 210000 } }] })
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
