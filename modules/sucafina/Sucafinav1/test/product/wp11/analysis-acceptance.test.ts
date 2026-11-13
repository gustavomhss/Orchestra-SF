import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import { createAnalysisAcceptance } from "../../../product/decisions/analysis-acceptance.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("human acceptance commits the existing analysis ledger event and outbox atomically", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-analysis-accept-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => ({ principalRef: "principal", policyVersion: "policy", accessRevision: "access" }) })
    const caseRef = { id: "case", incarnation: "inc", version: 1 }
    const receipt = { runId: "run", nativeSessionId: "session", profileId: "sf_finance", profileVersion: "1", profileDigest: "a".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) } as const
    const initial = { id: "output", caseRef, kind: "MatchExplanation", schemaVersion: "sf-contribution-v1", state: "ready", payload: { candidateCaseRef: caseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [], runProvenance: { ...receipt, actualModel: "model", contextFingerprint: "context" }, accessRevision: "access", createdAt: "2026-11-13T00:00:00Z", outputDigest: "" } as const
    const output: ContributionEnvelope = { ...initial, outputDigest: digestSfContribution(initial) }
    const run = { runRef: "run", state: "ready", outputRef: "output", principalRef: "principal", accessRevision: "access", policyVersion: "policy", caseRef, native: { sessionID: "session", skillReceipt: receipt } } as unknown as SfNativeRunRecord
    const decision = { id: "case", incarnation: "inc", version: 1, state: "draft", participants: ["principal"], ledger: [] } as unknown as DecisionCase
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: 0, additionalNamespaces: [{ namespace: "contributions", expectedStorageVersion: 0 }], targetRef: "case", targetIncarnation: "inc", idempotencyKey: "seed", commandDigest: "e".repeat(64) }, async (staged) => { staged.cases.case = decision; staged.contributions.output = output; staged.nativeRuns = { run }; return { commit: true, value: true } })
    const grant = { confirmed: false, current: true }
    const accept = createAnalysisAcceptance({ state, host: { requestFor: () => new Request("https://example.test"), revalidate: async () => true }, authorizeCase: async () => true, authorizeAcceptance: async () => true, readContribution: async () => ({ status: "ok", value: { output, run } }), confirmAcceptance: async () => grant.confirmed, verifyAcceptance: () => grant.current, operationIdentity: () => "human-intent", createId: () => "event", now: () => "2026-11-13T00:00:00Z" })
    const request = { caseRef, outputRef: "output", runRef: "run", rationale: "Reviewed with the team" }
    expect((await accept(request, context)).status).toBe("denied")
    grant.confirmed = true
    grant.current = false
    expect((await accept(request, context)).status).toBe("conflict")
    const before = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (before.status === "ok") expect(before.value?.version).toBe(1)
    grant.current = true
    const accepted = await accept(request, context)
    expect(accepted).toEqual({ status: "ok", value: { caseRef: { ...caseRef, version: 2 } } })
    grant.confirmed = false
    expect(await accept(request, context)).toEqual(accepted)
    expect((await accept({ ...request, rationale: "Different" }, context)).status).toBe("conflict")
    const after = await state.read(new Request("https://example.test"), "cases", (staged) => staged.cases.case)
    if (after.status === "ok") expect(after.value).toMatchObject({ version: 2, ledger: [{ kind: "analysis-accepted", analysisRunId: "run", outputDigest: output.outputDigest }] })
    const outbox = await state.read(new Request("https://example.test"), "outbox", (staged) => Object.values(staged.outbox))
    if (outbox.status === "ok") expect(outbox.value).toMatchObject([{ state: "pending", eventRef: { kind: "case-event", target: { eventId: "event", outputDigest: output.outputDigest } } }])
    if (after.status !== "ok") throw new Error("case unavailable")
    await state.transaction(new Request("https://example.test"), { namespace: "cases", expectedStorageVersion: after.storageVersion, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "corrupt-fixture", commandDigest: "f".repeat(64) }, async (staged) => { staged.cases.case = { ...staged.cases.case!, version: 3, ledger: [] }; return { commit: true, value: true } })
    expect((await accept(request, context)).status).toBe("unavailable")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
