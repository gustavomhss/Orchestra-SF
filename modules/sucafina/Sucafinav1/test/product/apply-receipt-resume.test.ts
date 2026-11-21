import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import type { CommandReceipt, SourceRef } from "../../product/contracts/context.ts"
import type { DecisionCase, PreparedChange } from "../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../product/contracts/sf-execution.ts"
import { applicationAttempt, applicationAttemptKey } from "../../product/decisions/application-attempt.ts"
import { createPreparedExecution } from "../../product/decisions/apply.ts"
import { createSfPreparedApply } from "../../product/decisions/prepared-apply.ts"
import { preparedOriginalIntent, receiptProofKey, receiptReviewBinding } from "../../product/decisions/receipt-review-binding.ts"
import { createSfProductState } from "../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../runtime/local-store.ts"

test("Apply resumes at the current case version with the original receipt and no new dispatch", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-apply-resume-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const at = "2027-01-03T00:00:00Z"
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    const request = new Request("https://example.test")
    const authority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
    const context: TrustedUiContext = {
      kind: "ui",
      binding: { ...authority, installationId: "install", projectId: "project", requestId: "request", expiresAt: "2100-01-01T00:00:00Z" },
      lease: {} as TrustedUiContext["lease"],
    }
    const target: SourceRef = {
      surface: "planner", type: "forecast", id: "forecast", incarnation: "forecast-inc",
      version: 7, fields: ["amount"], period: horizon, observedAt: at,
    }
    const reviewDigest = "b".repeat(64)
    const commandDigest = "c".repeat(64)
    const original = { caseRef: { id: "case", incarnation: "case-inc", version: 3 }, changeId: "change", choiceId: "choice" }
    const coverage = {
      basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1,
      currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending" as const,
      entries: [], derivedMissingCategoryIds: ["service"],
    }
    const preview = {
      id: "preview", version: 1, components: [], currency: "USD", horizon, sourceRefs: [],
      unresolvedConditions: [], restrictions: ["preview-not-applied"], comparisonStatus: "conditioned" as const,
      knownSubtotal: 120, total: null, costCoverage: coverage,
    }
    const choice = {
      id: original.choiceId, alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1,
      criteria: [], values: [], evidenceRefs: [], principalRef: authority.principalRef, reason: "Reviewed amount", at,
      scenario: { baseRef: "baseline", operations: [], assumptions: [] }, result: preview,
      comparison: {
        baselineResultRef: "baseline", alternativeResultRef: "alternative", costCoverageRefs: [], criterionResults: [],
        unresolvedConditions: [], comparisonStatus: "conditioned" as const, knownDifference: 20, completeDifference: null,
      },
      comparisonStatus: "conditioned" as const, costCoverage: coverage,
    }
    const projection = {
      context: {
        installationId: context.binding.installationId, projectId: context.binding.projectId, ...authority,
        surface: target.surface, period: horizon, currency: "USD", sourceRefs: [target], capabilities: [],
      },
      version: target.version, engineVersion: "fixture", components: [], values: [], missing: [],
    }
    const change: PreparedChange = {
      id: original.changeId, caseId: original.caseRef.id, caseVersion: original.caseRef.version, choiceId: original.choiceId,
      target, expectedVersion: target.version, preview, requiredAuthority: ["planner"], idempotencyKey: "apply-key", state: "planned",
      operation: {
        id: "command", target, command: { page: "planner", action: "edit", version: target.version, values: { amount: 120 } },
        idempotencyKey: "apply-key", commandDigest, expectedVersion: target.version, requiredAuthority: ["planner"], preview: projection,
      },
    }
    const receipt: CommandReceipt = {
      id: "original-receipt", idempotencyKey: change.idempotencyKey, commandDigest, targetIncarnation: target.incarnation,
      principalRef: authority.principalRef, surface: target.surface, version: 8, result: { ok: true, value: { amount: 120 } }, at,
    }
    const decision: DecisionCase = {
      ...original.caseRef, version: 5, state: "applied", objective: "Change the forecast", horizon, currency: "USD",
      criteria: [], participants: [authority.principalRef], sourceRefs: [], alternatives: [], costCoverageBases: [],
      assumptions: [], questions: [], choices: [choice], preparedChanges: [{ ...change, state: "applied", receipt }],
      receipts: [receipt], ledger: [],
    }
    const state = createSfProductState({
      persistence: store,
      createId: () => "state-inc",
      resolveTarget: async (_request, _snapshot, _namespace, ref) =>
        ref === decision.id ? { incarnation: decision.incarnation } : ref === target.id ? { incarnation: target.incarnation } : undefined,
      authorize: async () => authority,
    })
    const caseTarget = { targetRef: decision.id, targetIncarnation: decision.incarnation }
    const seeded = await state.transaction(request, {
      namespace: "cases", expectedStorageVersion: 0, ...caseTarget, idempotencyKey: "seed-case", commandDigest: digestSfValue(decision),
    }, async (data) => {
      data.cases[decision.id] = decision
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error(JSON.stringify(seeded))
    const attempt = {
      ...applicationAttempt(original, change, reviewDigest, authority.principalRef, "apply-operation"),
      originalIntent: preparedOriginalIntent(original, change, choice, reviewDigest, context),
    }
    const recorded = await state.transaction(request, {
      namespace: "cases", expectedStorageVersion: seeded.storageVersion, ...caseTarget,
      idempotencyKey: applicationAttemptKey(original), commandDigest: digestSfValue(attempt),
    }, async () => ({ commit: true, value: attempt }))
    if (recorded.status !== "ok") throw new Error(JSON.stringify(recorded))
    const receiptWrite = await state.transaction(request, {
      namespace: "receipts", domainSurface: target.surface, expectedStorageVersion: 0,
      additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: recorded.storageVersion }],
      targetRef: target.id, targetIncarnation: target.incarnation, idempotencyKey: receiptProofKey(change.idempotencyKey),
      commandDigest: receiptReviewBinding(change, reviewDigest),
    }, async (data) => {
      data.receipts[receipt.id] = receipt
      return { commit: true, value: receipt }
    })
    expect(receiptWrite.status).toBe("ok")

    const host = { requestFor: () => request, revalidate: async () => true }
    const read = createSfPreparedApply({
      state, host, authorizeCase: async () => true, authorizeLookup: async () => true, authorizeReceipt: async () => true,
      confirmHuman: async () => false, resolveActor: () => undefined, resolveMutation: () => undefined, verifyGrant: () => false,
      receiptVersion: () => undefined, environment: () => ({ at, id: () => "unused", directory: [] }),
      createId: () => "unused", now: () => at, reviewDigestFor: () => reviewDigest,
    })
    let dispatches = 0
    const execute = createPreparedExecution({
      state, host, apply: { readReceipt: read.readReceipt, executePrepared: async () => {
        dispatches++
        return { status: "unavailable", reason: "unexpected-dispatch" }
      } },
      authorizeCase: async () => true, authorizeApplication: async () => true, confirmApplication: async () => false,
      operationIdentity: () => "new-operation", classifyReceipt: async () => undefined, reviewDigestFor: () => reviewDigest,
      revalidateProducer: async () => ({ status: "unavailable", reason: "historical-application" }),
    })
    const before = await state.read(request, "cases", (data) => digestSfValue(data))
    const resume = { ...original, caseRef: { ...original.caseRef, version: decision.version } }
    expect(await execute(resume, context)).toEqual({ status: "ok", value: receipt })
    expect(await execute(original, context)).toEqual({ status: "ok", value: receipt })
    expect(await execute({ ...resume, caseRef: { ...resume.caseRef, version: 4 } }, context)).toEqual({
      status: "conflict", reason: "original-intent-mismatch",
    })
    expect(await execute(resume, context, "recover")).toEqual({ status: "conflict", reason: "original-intent-mismatch" })
    expect(dispatches).toBe(0)
    expect(await state.read(request, "cases", (data) => digestSfValue(data))).toEqual(before)
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
