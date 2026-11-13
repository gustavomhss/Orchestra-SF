import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createDecisionCaseManagement } from "../../../product/decisions/case-management.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("case listing and editing recheck access, actor intent, CAS and exact retry", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-case-management-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const decision = { id: "case", incarnation: "inc", version: 1, state: "draft", objective: "Initial", criteria: [{ id: "cost", description: "Cost", required: true }], participants: ["principal"], sourceRefs: [], horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", assumptions: [], alternatives: [], choices: [], preparedChanges: [], ledger: [] } as unknown as DecisionCase
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "a".repeat(64) }, async (staged) => { staged.cases.case = decision; return { commit: true, value: true } })
    const gate = { allowed: true, intent: false, sources: true }
    const management = createDecisionCaseManagement({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, authorizeCase: async () => gate.allowed, authorizeEdit: async () => true, verifyEvidence: async () => gate.sources, verifyEdit: () => gate.intent, operationIdentity: () => "intent" })
    expect(await management.list(context)).toMatchObject({ status: "ok", value: [{ caseRef: { id: "case", incarnation: "inc", version: 1 }, objective: "Initial" }] })
    const request = { caseRef: { id: "case", incarnation: "inc", version: 1 }, objective: "Revised", criteria: [{ id: "cost", description: "Cost", required: true }], sourceRefs: [] }
    expect((await management.edit(request, context)).status).toBe("conflict")
    gate.intent = true
    const edited = await management.edit(request, context)
    expect(edited).toEqual({ status: "ok", value: { caseRef: { id: "case", incarnation: "inc", version: 2 } } })
    expect(await management.edit(request, context)).toEqual(edited)
    expect((await management.edit({ ...request, objective: "Different" }, context)).status).toBe("conflict")
    gate.sources = false
    expect(await management.list(context)).toEqual({ status: "ok", value: [] })
    gate.sources = true
    gate.allowed = false
    expect(await management.list(context)).toEqual({ status: "ok", value: [] })
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
