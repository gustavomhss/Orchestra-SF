import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("case projection denies an inaccessible operation even with no result components", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-operation-access-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const decision = { id: "case", incarnation: "inc", version: 1, state: "draft", participants: ["principal"], sourceRefs: [], costCoverageBases: [], assumptions: [], choices: [], preparedChanges: [], receipts: [], ledger: [], alternatives: [{ id: "a", version: 1, title: "Alternative", scenario: { baseRef: "base", operations: [{ kind: "replace", targetRef: "restricted", replacementRef: "restricted-replacement" }], assumptions: [] }, result: { components: [], sourceRefs: [], costCoverage: { evaluatedSourceRefs: [], entries: [] } } }] } as unknown as DecisionCase
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    const evidence: BusinessContextService = { context: async () => [], resolve: async () => { throw new Error("unexpected evidence") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected emission") } }
    const scope = { allowed: false, calls: 0 }
    const retainedRequest = new Request("https://example.test")
    const cases = createDecisionCasePort({ state, host: { requestFor: () => retainedRequest, revalidate: async () => true }, creationTarget: { ref: "case", incarnation: "inc" }, operationIdentity: () => "intent", authorizeCase: async () => true, verifyScenarioOperations: async (value) => { scope.calls += 1; return scope.allowed && value.alternatives[0]?.scenario.operations[0]?.targetRef === "restricted" && value.alternatives[0]?.scenario.operations[0]?.replacementRef === "restricted-replacement" }, evidence, createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    const request = { caseRef: encodeCaseRef(decision) }
    expect((await cases.read(request, context)).status).toBe("unavailable")
    scope.allowed = true
    scope.calls = 0
    expect((await cases.read(request, context)).status).toBe("ok")
    expect(scope.calls).toBe(2)
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
