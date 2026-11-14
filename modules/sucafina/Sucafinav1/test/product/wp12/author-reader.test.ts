import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfAnalysisAuthorReader } from "../../../../../../apps/cli/src/sucafina-product/analysis-author.ts"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

test("author reader rechecks the real stored run, receipt, case, and current authority", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-review-author-"))
  const persistence = await openLocalStore(join(directory, "store"))
  try {
    const active = { value: true }
    const request = new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test" } })
    const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const authority = createSfProductAuthority({ identity: () => identity, installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence,
      grants: [{ principalRef: "person", namespaces: ["cases", "contributions"], operations: [], humanActions: ["analysis.start"] }], now: Date.now, createId: () => crypto.randomUUID(),
      authenticate: async (_request, context) => active.value && context ? { id: "person", canWrite: true, roles: [{ surface: context.surface, role: "viewer" }] } : null,
      environment: async () => ({ at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }), commandIdentity: async () => "command", inspectSession: async () => undefined,
      verifySelection: async () => true, verifySkillReceipt: async () => true, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
    const selected = { id: "case", incarnation: "inc", version: 1 }
    const receipt = { runId: "author", nativeSessionId: "author-session", profileId: "sf_finance", profileVersion: "1", profileDigest: "a".repeat(64), skillId: "skill", skillVersion: "1", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "loaded", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) } as const
    const output = { id: "output", caseRef: selected, kind: "MatchExplanation", schemaVersion: "sf-contribution-v1", state: "ready", payload: { candidateCaseRef: selected, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [], runProvenance: { ...receipt, actualModel: "provider/model", contextFingerprint: "context" }, accessRevision: "access", createdAt: "2026-11-13T00:00:00Z", outputDigest: "" } as unknown as ContributionEnvelope
    output.outputDigest = digestSfContribution(output)
    const caseWrite = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "case", commandDigest: "a".repeat(64) }, async (state) => {
      state.cases.case = { ...selected, state: "draft", objective: "Review the authorized result", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: ["person"],
        criteria: [], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    })
    expect(caseWrite.status).toBe("ok")
    const admitted = await authority.human.admit(request, "analysis.start", { caseRef: selected })
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    const accessRevision = admitted.value.binding.accessRevision
    output.accessRevision = accessRevision
    output.outputDigest = digestSfContribution(output)
    const run = { runRef: "author", state: "ready", caseRef: selected, principalRef: "person", policyVersion: "policy", accessRevision, model: { providerID: "provider", id: "model" }, contextFingerprint: "context", native: { sessionID: "author-session", skillReceipt: receipt }, outputRef: "output" } as unknown as SfNativeRunRecord
    const seeded = await authority.state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "author", commandDigest: "b".repeat(64) }, async (state) => { state.nativeRuns = { author: run }; state.contributions.output = output; return { commit: true, value: true } })
    expect(seeded.status).toBe("ok")
    const context = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: async () => { throw new Error("no sources") }, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" } }) })
    const reader = createSfAnalysisAuthorReader({ authority, context, resolveCase: async () => ({ status: "ok", value: selected }) })
    expect(await reader("author", output.outputDigest, admitted.value)).toMatchObject({ status: "ok", value: { run: { runRef: "author" } } })
    expect(await reader("author", "0".repeat(64), admitted.value)).toMatchObject({ status: "unavailable" })
    const changed = { value: false }
    const racing = createSfAnalysisAuthorReader({ authority, resolveCase: async () => ({ status: "ok", value: selected }), context: { ...context, context: async (query, call) => {
      const resolved = await context.context(query, call)
      if (!changed.value) {
        changed.value = true
        const version = await authority.state.read(request, "contributions", () => null)
        if (version.status !== "ok") throw new Error("contributions unavailable")
        await authority.state.transaction(request, { namespace: "contributions", expectedStorageVersion: version.storageVersion, targetRef: "case", targetIncarnation: "inc", idempotencyKey: "change-author", commandDigest: "c".repeat(64) }, async (state) => {
          const author = state.nativeRuns?.author
          if (!author?.native) return { commit: false, value: false }
          state.nativeRuns!.author = { ...author, native: { ...author.native, skillReceipt: { ...author.native.skillReceipt, loadedMessageId: "changed" } } }
          return { commit: true, value: true }
        })
      }
      return resolved
    } } })
    expect(await racing("author", output.outputDigest, admitted.value)).toMatchObject({ status: "stale" })
    active.value = false
    expect(await reader("author", output.outputDigest, admitted.value)).toMatchObject({ status: "denied" })
    authority.human.finish(admitted.value)
  } finally {
    await persistence.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})

