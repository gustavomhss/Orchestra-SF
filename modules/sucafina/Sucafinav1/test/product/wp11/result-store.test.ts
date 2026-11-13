import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("decision result persistence binds retries, current case and source authority", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-result-"))
  await chmod(directory, 0o700)
  const db = await openLocalStore(directory)
  try {
    const access = { case: true, sources: true }
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: db, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    const decision = { id: "case", incarnation: "inc", version: 1, state: "draft", objective: "decision", currency: "USD", horizon, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
    const source = new Request("https://example.test")
    await state.transaction(source, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    const ids = { next: 0 }
    const results = createSfDecisionResultStore({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, authorizeCase: async () => access.case, verifySources: async () => access.sources, createId: () => `result-${++ids.next}`, now: () => "2026-11-13T00:00:00Z" })
    const request = { kind: "comparison", result: { baselineResultRef: "base", alternativeResultRef: "result", costCoverageRefs: ["coverage"], criterionResults: [], unresolvedConditions: ["training:missing-category"], comparisonStatus: "conditioned", knownDifference: 30000, completeDifference: null }, caseRef: { id: "case", incarnation: "inc", version: 1 }, requestDigest: "b".repeat(64), sourceRefs: [], idempotencyKey: "operation" } as const
    const created = await results.write(request, context)
    expect(created.status).toBe("ok")
    if (created.status !== "ok") throw new Error(created.reason)
    expect(await results.write(request, context)).toEqual(created)
    expect((await results.write({ ...request, requestDigest: "c".repeat(64) }, context)).status).toBe("conflict")
    expect((await results.read({ resultRef: created.value.resultRef, kind: "scenario" }, context)).status).toBe("unavailable")
    expect((await results.read({ resultRef: created.value.resultRef, kind: "comparison" }, context)).status).toBe("ok")
    access.sources = false
    expect((await results.read({ resultRef: created.value.resultRef, kind: "comparison" }, context)).status).toBe("denied")
    access.sources = true
    access.case = false
    expect((await results.read({ resultRef: created.value.resultRef, kind: "comparison" }, context)).status).toBe("denied")
    access.case = true
    const before = await state.read(source, "cases", () => null)
    if (before.status !== "ok") throw new Error("state unavailable")
    await state.transaction(source, { namespace: "cases", expectedStorageVersion: before.storageVersion, idempotencyKey: "advance", commandDigest: "d".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (staged) => { staged.cases.case = { ...staged.cases.case!, version: 2 }; return { commit: true, value: true } })
    expect((await results.read({ resultRef: created.value.resultRef, kind: "comparison" }, context)).status).toBe("denied")
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
