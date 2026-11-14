import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfNativeEvidenceStore } from "../../../../product/integration/native-evidence.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ResidentProfile } from "../../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../../product/contracts/state.ts"
import { object } from "../../../../runtime/contract.ts"
import { selection } from "../resident-runtime/fixture.ts"

// Persistence/authority boundary fixture, not a live model or AM proof.
test("native denial markers survive SQLite reopen and ordinary preference replacement cannot erase them", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-native-evidence-"))
  await chmod(directory, 0o700)
  const request = new Request("https://fixture.example/sucafina/dashboard")
  const authority = { principalRef: "principal-1", accessRevision: "access-1", policyVersion: "policy-1" }
  const access = { active: true }
  const caseRef = { id: "case-1", incarnation: "case-inc-1", version: 1 }
  const value: DecisionCase = { ...caseRef, state: "draft", objective: "Native persistence", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: [authority.principalRef], criteria: [], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const open = async () => {
    const store = await openLocalStore(directory)
    const nativeEvidenceWrites = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, nativeEvidenceWrites, createId: randomUUID,
      authorize: async (actual) => actual === request && access.active ? authority : undefined,
      resolveTarget: async () => ({ incarnation: caseRef.incarnation }),
    })
    const evidence = createSfNativeEvidenceStore({ state, nativeEvidenceWrites, persistence: store, createId: randomUUID,
      requestForRun: (runId) => runId === "run-1" ? request : undefined,
      authorizeRun: async () => access.active, authorizeBinding: async () => access.active,
    })
    return { store, state, evidence }
  }
  const first = await open()
  try {
    expect((await first.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: "create-case", targetIncarnation: caseRef.incarnation, idempotencyKey: "case-create", commandDigest: "a".repeat(64) }, async (state) => {
      state.cases[value.id] = value
      return { commit: true, value: true }
    })).status).toBe("ok")
    const profile: ResidentProfile = { id: "sf_finance", version: "1", mission: "Persistence boundary", sourcePath: "profile.json", sourceDigest: "a".repeat(64),
      allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: ["FinancialAnalysis"], contextBudgetTokens: 1000,
      maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" }
    const run: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef: "run-1", version: 1, requestDigest: "d".repeat(64), skillInputDigest: "e".repeat(64),
      ...authority, caseRef, selection: selection(profile), model: { providerID: "openai", id: "fixture-model" }, skillId: "sf-explicar-forecast",
      objective: "Persistence boundary", contextFingerprint: "fixture-context", createdAt: "2026-11-14T00:00:00Z", updatedAt: "2026-11-14T00:00:00Z", state: "preparing" }
    // Persist an actual C08 record: replacing an already empty map would not exercise the namespace fence.
    expect((await first.state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, targetRef: caseRef.id,
      targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-run", commandDigest: digestSfValue(run) }, async (state) => {
      state.nativeRuns ??= {}
      state.nativeRuns[run.runRef] = run
      return { commit: true, value: true }
    })).status).toBe("ok")
    expect(await first.evidence.isSfOwned("session-1")).toBe(false)
    await first.evidence.reserveSession({ sessionID: "session-1", runId: run.runRef, caseRef, profileId: profile.id, manifestDigest: run.selection.manifestDigest })
    expect(await first.evidence.isSfOwned("session-1")).toBe(true)
    const current = await first.state.read(request, "preferences", (state) => state)
    if (current.status !== "ok") throw new Error("Fixture state unavailable")
    expect(current.value.nativeRuns?.[run.runRef]).toEqual(run)
    const command = { namespace: "preferences", expectedStorageVersion: current.storageVersion, targetRef: "preferences", targetIncarnation: caseRef.incarnation, idempotencyKey: "replace-preferences", commandDigest: "c".repeat(64) } as const
    expect(await first.state.transaction(request, command, async (state) => {
      state.preferences = {}
      return { commit: true, value: true }
    })).toEqual({ status: "denied", reason: "native-evidence-write-outside-authority" })
    expect(await first.state.transaction(request, { ...command, idempotencyKey: "tamper-jobs" }, async (state) => {
      state.nativeRuns = {}
      return { commit: true, value: true }
    })).toEqual({ status: "denied", reason: "namespace-write-outside-authority" })
    // Both denials preserve the entire state, namespace version and aggregate revision.
    expect(await first.state.read(request, "preferences", (state) => state)).toEqual(current)
    expect(await first.evidence.isSfOwned("session-1")).toBe(true)
    expect((await first.state.transaction(request, { ...command, idempotencyKey: "theme-only" }, async (state) => {
      state.preferences.theme = "dark"
      return { commit: true, value: true }
    })).status).toBe("ok")
    await first.store.dispose()
    const second = await open()
    try {
      const reopened = await second.state.read(request, "contributions", (state) => state.nativeRuns?.[run.runRef])
      expect(reopened.status).toBe("ok")
      if (reopened.status !== "ok") throw new Error("Persisted run unavailable after reopen")
      expect(reopened.value).toEqual(run)
      access.active = false
      // Revocation blocks grants, but can never turn an owned Session into a non-SF Session.
      expect(await second.evidence.isSfOwned("session-1")).toBe(true)
      await expect(second.evidence.reserveSession({ sessionID: "session-2", runId: run.runRef, caseRef, profileId: profile.id, manifestDigest: run.selection.manifestDigest })).rejects.toThrow()
      expect(await second.evidence.isSfOwned("session-2")).toBe(false)
      const saved = await second.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: object(object(snapshot.data.__sfProductV1).preferences).theme }))
      expect(saved).toBe("dark")
    } finally { await second.store.dispose() }
  } finally { await first.store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
