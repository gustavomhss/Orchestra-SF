import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import { createStoredPortfolioReader } from "../../../product/portfolio/stored.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"

test("stored contribution survives reopen and remains case-authorized", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-portfolio-output-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test")
  const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
  const active = { value: true }
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const decision = { ...caseRef, state: "comparing", objective: "transition", currency: "USD", horizon, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] } as const
  const receipt: SkillLoadReceipt = { runId: "run", nativeSessionId: "session", profileId: "sf_portfolio", profileVersion: "1", profileDigest: "a", skillId: "skill", skillVersion: "1", sourceDigest: "b", instructionsDigest: "c", loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d" }
  const output: ContributionEnvelope = { id: "output", caseRef, schemaVersion: "sf-contribution-v1", evidenceRefs: [], runProvenance: { ...receipt, actualModel: "synthetic", contextFingerprint: "fingerprint" }, accessRevision: "access", createdAt: "2026-11-13T00:00:00Z", outputDigest: "", kind: "PortfolioComparison", state: "ready", payload: { combinations: [], limitations: [], evidenceRefs: [] } }
  output.outputDigest = digestSfContribution(output)
  const run = { runRef: "run", state: "ready", outputRef: output.id, principalRef: "principal", accessRevision: "access", policyVersion: "policy", caseRef, contextFingerprint: "fingerprint", native: { sessionID: "session", skillReceipt: receipt } } as unknown as SfNativeRunRecord
  const evidence: BusinessContextService = { context: async () => [], resolve: async () => { throw new Error("unexpected evidence") }, recall: async () => [], emitFromLedger: async () => { throw new Error("unexpected emission") } }
  const open = async () => {
    const store = await openLocalStore(directory)
    const state = createSfProductState({ persistence: store, createId: () => "state-inc", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => active.value ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const cases = createDecisionCasePort({ state, host: { requestFor: () => request, revalidate: async () => active.value }, creationTarget: { ref: "case", incarnation: "inc" }, operationIdentity: () => "operation", authorizeCase: async () => active.value, evidence, createId: () => "unused", now: () => "2026-11-13T00:00:00Z" })
    const read = createStoredPortfolioReader({ state, cases, evidence, requestFor: () => request, revalidate: async () => active.value, revalidatePortfolio: async () => active.value })
    return { store, state, read }
  }
  try {
    const first = await open()
    const seeded = await first.state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "cases", expectedStorageVersion: 0 }], idempotencyKey: "seed", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => { state.cases.case = decision; state.contributions[output.id] = output; state.nativeRuns = { run }; return { commit: true, value: true } })
    expect(seeded.status).toBe("ok")
    await first.store.dispose()
    const reopened = await open()
    const actual = await reopened.read(output.id, binding)
    expect(actual.status).toBe("ok")
    if (actual.status === "ok") expect(actual.value.portfolioResultRef).toBe(output.id)
    active.value = false
    expect((await reopened.read(output.id, binding)).status).toBe("denied")
    await reopened.store.dispose()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
