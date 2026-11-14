import { expect, test } from "bun:test"
import { cancelSfAnalysis } from "../../../product/ai/analysis-port.ts"

test("cancellation refuses a session different from the loaded skill receipt", async () => {
  const input = { sessionID: "session-current", skillReceipt: { nativeSessionId: "session-other" } } as unknown as Parameters<typeof cancelSfAnalysis>[0]
  expect(await cancelSfAnalysis(input)).toEqual({ status: "denied", reason: "session-mismatch" })
})

test("cancellation persists before interrupting and permits a source-stale run under current authority", async () => {
  const { sfRunFixture } = await import("./run-fixture.ts")
  const { receipt, caseRef, run } = sfRunFixture()
  const operations: string[] = []
  const scopes: object[] = []
  const host = {
    readRun: async () => ({ status: "ok", value: run }),
    withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
      const context = { binding: { accessRevision: "access" } }
      scopes.push(context)
      return action(context)
    },
    revalidate: async () => { operations.push("revalidate"); return { status: "stale", reason: "source-changed" } },
    analysis: { cancel: async () => { operations.push("persist-cancel"); return { status: "ok", value: { cancelled: true } } } },
    execution: { interrupt: async () => { operations.push("interrupt-own-ticket"); return { status: "ok", value: true } } },
  }
  const input = { host, runRef: receipt.runId, sessionID: receipt.nativeSessionId, executionTicket: {}, skillReceipt: receipt, caseRef, contextFingerprint: "context" } as unknown as Parameters<typeof cancelSfAnalysis>[0]
  expect(await cancelSfAnalysis(input)).toEqual({ status: "ok", value: { cancelled: true } })
  expect(operations).toEqual(["revalidate", "persist-cancel", "interrupt-own-ticket"])
  expect(new Set(scopes).size).toBe(3)
  expect(await cancelSfAnalysis({ ...input, runRef: "another-run" })).toEqual({ status: "denied", reason: "session-mismatch" })
  expect(operations).toHaveLength(3)
})

test("revocation after durable cancellation prevents interruption through an expired authority", async () => {
  const { sfRunFixture } = await import("./run-fixture.ts")
  const { receipt, caseRef, run } = sfRunFixture()
  let calls = 0
  let interrupted = false
  const host = {
    readRun: async () => ({ status: "ok", value: run }),
    withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
      if (++calls === 3) return { status: "denied", reason: "access-revoked" }
      return action({ binding: { accessRevision: "access" } })
    },
    revalidate: async () => ({ status: "ok", value: true }),
    analysis: { cancel: async () => ({ status: "ok", value: { cancelled: true } }) },
    execution: { interrupt: async () => { interrupted = true; return { status: "ok", value: true } } },
  }
  const input = { host, runRef: receipt.runId, sessionID: receipt.nativeSessionId, executionTicket: {}, skillReceipt: receipt, caseRef, contextFingerprint: "context" } as unknown as Parameters<typeof cancelSfAnalysis>[0]
  expect(await cancelSfAnalysis(input)).toEqual({ status: "denied", reason: "access-revoked" })
  expect(interrupted).toBe(false)
})

test("a routine result cannot start another routine", async () => {
  const { runSfAnalysisRoutine } = await import("../../../product/ai/analysis-port.ts")
  const input = { binding: { kind: "native", binding: { entryMode: "routine-result" } } } as unknown as Parameters<typeof runSfAnalysisRoutine>[0]
  expect(await runSfAnalysisRoutine(input)).toEqual({ status: "denied", reason: "recursive-routine" })
})

test("tampered contribution digest is rejected before publication", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const receipt = {
    runId: "run-1", nativeSessionId: "session-1", profileId: "sf_finance", profileVersion: "1.0.0", profileDigest: "a".repeat(64),
    skillId: "sf-explicar-forecast", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64),
  }
  const output = {
    id: "output-1", caseRef: { id: "case-1", version: 1, incarnation: "inc-1" }, kind: "FinancialAnalysis", schemaVersion: "sf-contribution-v1",
    state: "failed", reason: "provider-unavailable", evidenceRefs: [], runProvenance: { ...receipt, actualModel: "configured-model", contextFingerprint: "context-1" },
    accessRevision: "access-1", createdAt: "2026-11-13T00:00:00Z", outputDigest: "0".repeat(64),
  }
  const input = { output, skillReceipt: receipt, runRef: "run-1" } as unknown as Parameters<typeof publishSfContribution>[0]
  expect(await publishSfContribution(input)).toEqual({ status: "failed", reason: "contribution-digest-mismatch" })
})

test("a review cannot reuse the author's run or session", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const receipt = {
    runId: "same-run", nativeSessionId: "same-session", profileId: "sf_reviewer", profileVersion: "1.0.0", profileDigest: "a".repeat(64),
    skillId: "sf-contestar-decisao", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64),
  }
  const caseRef = { id: "case-1", version: 1, incarnation: "inc-1" }
  const output = {
    id: "output-1", caseRef, kind: "CritiqueReport", schemaVersion: "sf-contribution-v1", state: "failed", reason: "not-reviewed",
    evidenceRefs: [], runProvenance: { ...receipt, actualModel: "configured-model", contextFingerprint: "context-1", reviewerRunId: "same-run", targetRunId: "same-run", targetOutputDigest: "e".repeat(64) },
    accessRevision: "access-1", createdAt: "2026-11-13T00:00:00Z", outputDigest: "0".repeat(64),
  }
  const input = { output, skillReceipt: receipt, runRef: "same-run", reviewTarget: { caseRef, targetRunId: "same-run", targetSessionId: "same-session", targetOutputDigest: "e".repeat(64) } } as unknown as Parameters<typeof publishSfContribution>[0]
  expect(await publishSfContribution(input)).toEqual({ status: "failed", reason: "review-not-independent" })
})

test("analysis rejects invalid skill input before host admission", async () => {
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const input = { request: { skillId: "sf-explicar-forecast" }, skillInput: {} } as unknown as Parameters<typeof runSfAnalysis>[0]
  expect(await runSfAnalysis(input)).toEqual({ status: "failed", reason: "invalid-skill-input" })
})

test("revoked access after a native wait blocks collection and publication", async () => {
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const caseRef = { id: "case-1", incarnation: "incarnation-1", version: 1 }
  const receipt = {
    runId: "run-1", nativeSessionId: "session-1", profileId: "sf_finance", profileVersion: "1.0.0", profileDigest: "a".repeat(64),
    skillId: "sf-consultar-memoria-decisoria", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64),
  }
  const observations = { scopes: 0, writes: 0 }
  const host = {
    withRunContext: async (_runRef: string, action: (context: unknown) => Promise<unknown>) => {
      observations.scopes++
      if (observations.scopes === 2) return { status: "denied", reason: "access-revoked" }
      return action({ binding: { accessRevision: "access-1" } })
    },
    revalidate: async () => ({ status: "ok", value: true }),
    execution: { admit: async () => ({ status: "ok", value: { runRef: "run-1", sessionID: "session-1", skillReceipt: receipt, executionTicket: {} } }), execute: async () => ({ status: "ok", value: true }), collect: async () => { throw new Error("collection must not run") } },
    result: { write: async () => { observations.writes++; throw new Error("publication must not run") } },
  }
  const request = { caseRef, profileId: "sf_finance", profileVersion: "1.0.0", skillId: receipt.skillId, skillVersion: "1.0.0", manifestDigest: receipt.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Review", contextFingerprint: "context-1" }
  const skillInput = { currentCase: caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "renewal" }
  const input = { host, request, skillInput } as unknown as Parameters<typeof runSfAnalysis>[0]
  expect(await runSfAnalysis(input)).toEqual({ status: "denied", reason: "access-revoked" })
  expect(observations.scopes).toBe(2)
  expect(observations.writes).toBe(0)
})

// This injected harness checks orchestration only; it is not evidence of a real authenticated host.
test("analysis uses separate host authority scopes before and after the native wait", async () => {
  const { digestSfContribution } = await import("../../../product/contracts/canonical.ts")
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const caseRef = { id: "case-1", incarnation: "incarnation-1", version: 1 }
  const receipt = {
    runId: "run-1", nativeSessionId: "session-1", profileId: "sf_finance", profileVersion: "1.0.0", profileDigest: "a".repeat(64),
    skillId: "sf-consultar-memoria-decisoria", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64),
    loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64),
  }
  const output = {
    id: "output-1", caseRef, kind: "MatchExplanation", schemaVersion: "sf-contribution-v1", state: "ready",
    payload: { candidateCaseRef: caseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [],
    runProvenance: { ...receipt, actualModel: "configured-model", contextFingerprint: "context-1" }, accessRevision: "access-1",
    createdAt: "2026-11-13T00:00:00Z", outputDigest: "",
  } as unknown as Parameters<typeof digestSfContribution>[0]
  output.outputDigest = digestSfContribution(output)
  const scopes = new Set<object>()
  const host = {
    withRunContext: async (_runRef: string, action: (context: unknown) => Promise<unknown>) => {
      const context = { binding: { accessRevision: "access-1" } }
      scopes.add(context)
      return action(context)
    },
    revalidate: async () => ({ status: "ok", value: true }),
    execution: { admit: async () => ({ status: "ok", value: { runRef: "run-1", sessionID: "session-1", skillReceipt: receipt, executionTicket: {} } }), execute: async () => ({ status: "ok", value: true }), collect: async () => ({ status: "ok", value: output }) },
    result: { write: async () => ({ status: "ok", value: { outputRef: "output-1", caseVersion: 1 } }) },
  }
  const request = { caseRef, profileId: "sf_finance", profileVersion: "1.0.0", skillId: receipt.skillId, skillVersion: "1.0.0", manifestDigest: receipt.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Review", contextFingerprint: "context-1" }
  const skillInput = { currentCase: caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "renewal" }
  const input = { host, request, skillInput } as unknown as Parameters<typeof runSfAnalysis>[0]
  expect(await runSfAnalysis(input)).toEqual({ status: "ok", value: { outputRef: "output-1", caseVersion: 1 } })
  expect(scopes.size).toBe(4)
})

test("analysis rejects model-supplied identity before host admission", async () => {
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const caseRef = { id: "case-1", incarnation: "incarnation-1", version: 1 }
  const skillInput = { currentCase: caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "renewal", currentAuthorization: { principalRef: "forged" } }
  const input = { request: { skillId: "sf-consultar-memoria-decisoria" }, skillInput } as unknown as Parameters<typeof runSfAnalysis>[0]
  expect(await runSfAnalysis(input)).toEqual({ status: "failed", reason: "invalid-skill-input" })
})

test("admitted runs persist non-executing native outcomes under fresh authority", async () => {
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const caseRef = { id: "case-1", incarnation: "incarnation-1", version: 1 }
  const receipt = { runId: "run-1", nativeSessionId: "session-1", profileId: "sf_finance", profileVersion: "1.0.0", profileDigest: "a".repeat(64), skillId: "sf-consultar-memoria-decisoria", skillVersion: "1.0.0", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), loadedMessageId: "message-1", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d".repeat(64) }
  const request = { caseRef, profileId: "sf_finance", profileVersion: "1.0.0", skillId: receipt.skillId, skillVersion: receipt.skillVersion, manifestDigest: receipt.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Review", contextFingerprint: "context-1" }
  const skillInput = { currentCase: caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "renewal" }
  for (const outcome of [{ status: "unavailable", reason: "native-gate-unavailable" }, { status: "needs-input", reason: "input-required" }, { status: "unavailable", reason: "native-execution-outcome-unknown" }] as const) {
    const scopes: object[] = []
    const settled: unknown[] = []
    const host = {
      withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => { const context = { binding: { accessRevision: "access-1" } }; scopes.push(context); return action(context) },
      revalidate: async () => ({ status: "ok", value: true }),
      settle: async (runRef: string, state: string, reason: string, context: object) => { settled.push({ runRef, state, reason, context }); return { status: "ok", value: true } },
      fail: async (runRef: string, reason: string, context: object) => { settled.push({ runRef, state: "failed", reason, context }); return { status: "ok", value: true } },
      execution: { admit: async () => ({ status: "ok", value: { runRef: "run-1", sessionID: "session-1", skillReceipt: receipt, executionTicket: {} } }), execute: async () => { if (outcome.reason === "native-execution-outcome-unknown") throw new Error("execution aborted"); return outcome } },
    }
    const input = { host, request, skillInput } as unknown as Parameters<typeof runSfAnalysis>[0]
    expect(await runSfAnalysis(input)).toEqual(outcome)
    expect(scopes).toHaveLength(2)
    expect(scopes[0]).not.toBe(scopes[1])
    expect(settled).toEqual([{ runRef: "run-1", state: outcome.status, reason: outcome.reason, context: scopes[1] }])
  }
})

test("revoked authority prevents settling an admitted run", async () => {
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const caseRef = { id: "case-1", incarnation: "incarnation-1", version: 1 }
  const receipt = { runId: "run-1", nativeSessionId: "session-1", profileId: "sf_finance", profileVersion: "1.0.0", skillId: "sf-consultar-memoria-decisoria", skillVersion: "1.0.0", manifestDigest: "d".repeat(64) }
  const observed = { scopes: 0, writes: 0 }
  const host = {
    withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
      observed.scopes++
      if (observed.scopes === 2) return { status: "denied", reason: "authority-revoked" }
      return action({ binding: { accessRevision: "access-1" } })
    },
    revalidate: async () => ({ status: "ok", value: true }),
    settle: async () => { observed.writes++; return { status: "ok", value: true } },
    execution: { admit: async () => ({ status: "ok", value: { runRef: "run-1", sessionID: "session-1", skillReceipt: receipt, executionTicket: {} } }), execute: async () => ({ status: "unavailable", reason: "native-gate-unavailable" }) },
  }
  const request = { caseRef, profileId: "sf_finance", profileVersion: "1.0.0", skillId: receipt.skillId, skillVersion: receipt.skillVersion, manifestDigest: receipt.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Review", contextFingerprint: "context-1" }
  const skillInput = { currentCase: caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "renewal" }
  expect(await runSfAnalysis({ host, request, skillInput } as unknown as Parameters<typeof runSfAnalysis>[0])).toEqual({ status: "denied", reason: "authority-revoked" })
  expect(observed.writes).toBe(0)
})

test("real SQLite and C08 reject a changed Planner source and persist settlement after reopening", async () => {
  const { chmod, mkdtemp, realpath, rm } = await import("node:fs/promises")
  const { tmpdir } = await import("node:os")
  const { join } = await import("node:path")
  const { AgentV2 } = await import("@orchestra/core/agent")
  const { SessionMessage } = await import("@orchestra/core/session/message")
  const { SessionSchema } = await import("@orchestra/core/session/schema")
  const { openLocalStore } = await import("../../../runtime/local-store.ts")
  const { createSfProductState } = await import("../../../product/host-binding/state-provider.ts")
  const { createSfExecutionBindingRegistry } = await import("../../../product/host-binding/execution-context.ts")
  const { createSfRunStore, sfRunSourceFence } = await import("../../../product/ai/run-store.ts")
  const { createSfAnalysisHost } = await import("../../../product/ai/analysis-host.ts")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-analysis-c08-"))
  await chmod(directory, 0o700)
  const request = new Request("https://example.test/analysis")
  const sessionID = SessionSchema.ID.make("ses_sf_analysis")
  const caseRef = { id: "case", incarnation: "inc", version: 1 }
  const profile = { id: "sf_finance", version: "1", mission: "Finance", allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"], outputTypes: ["MatchExplanation"], contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh", sourcePath: "profile.json", sourceDigest: "a".repeat(64) } as const
  const skill = { id: "sf-explicar-forecast", version: "1", sourcePath: "skill/SKILL.md", sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), inputSchemaRef: "input", outputSchemaRefs: ["MatchExplanation"], allowedProfiles: ["sf_finance"], allowedOperations: ["sf_forecast_compare"], workflow: [], limits: { maxSteps: 2, contextBudgetTokens: 1000 }, positiveAcceptance: [], negativeAcceptance: [] } as const
  const selection = { profile, skills: [skill], operationIds: ["sf_forecast_compare"], manifestDigest: "d".repeat(64) }
  const receipt = { runId: "run", nativeSessionId: sessionID, profileId: profile.id, profileVersion: profile.version, profileDigest: profile.sourceDigest, skillId: skill.id, skillVersion: skill.version, sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest, loadedMessageId: "msg_loaded", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: selection.manifestDigest }
  const access = { allowed: true, calls: 0, expectedPlanner: 0, preparingChecks: 0, revokeAtEgress: true }
  const registry = createSfExecutionBindingRegistry({ authenticateAndResolve: async () => access.allowed ? { installationId: "installation", hostId: "host", projectId: "project", locationId: "location", principalRef: "principal", policyVersion: "policy", accessRevision: "access", providerGeneration: 1, expiresAt: new Date(Date.now() + 600_000).toISOString() } : undefined, revalidateAdmission: async () => access.allowed })
  const bound = await registry.bind({ request, selected: selection, sessionID, runId: "run", caseRef, profile, manifestDigest: selection.manifestDigest, skillReceipts: [receipt], entryMode: "interactive" })
  expect(bound.status).toBe("ok")
  if (bound.status !== "ok") {
    await rm(directory, { recursive: true, force: true })
    return
  }
  const withRunContext = async <T>(_runRef: string, action: (context: import("../../../product/contracts/sf-execution.ts").TrustedDomainContext) => Promise<import("../../../product/contracts/ports.ts").PortResult<T>>) => {
    const call = `call-${++access.calls}`
    const lease = await registry.lease({ sessionID, agent: AgentV2.ID.make(profile.id), assistantMessageID: SessionMessage.ID.make("msg_assistant"), toolCallID: call }, "sf_forecast_compare", "e".repeat(64))
    if (lease.status !== "ok") return lease
    if (!registry.consume(lease.value, "sf_forecast_compare", "e".repeat(64))) return { status: "denied", reason: "lease-consume-failed" } as const
    try { return await action(lease.value) } finally { registry.finish(lease.value) }
  }
  const open = async () => {
    const persistence = await openLocalStore(directory)
    const locked: { planner?: number } = {}
    const state = createSfProductState({ persistence: { ...persistence, transactionAll: (work, options) => persistence.transactionAll!(async (snapshots) => {
      locked.planner = Number(snapshots.planner.data.revision ?? 0)
      try { return await work(snapshots) } finally { delete locked.planner }
    }, options) }, createId: () => "store", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async (source) => source === request && access.allowed ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
    const store = createSfRunStore({ state, requestFor: (context) => context.kind === "native" ? registry.requestFor(context) : undefined, revalidate: (context) => context.kind === "native" ? registry.revalidate(context) : Promise.resolve(false), preflight: async (_record, context) => {
      if (context.kind !== "native" || !await registry.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
      const sourceFence = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
      if (_record.state === "ready") {
        access.expectedPlanner = await persistence.transaction("planner", async (snapshot) => ({ commit: false, value: Number(snapshot.data.revision ?? 0) }))
        await persistence.transaction("planner", async (snapshot) => { snapshot.data.revision = access.expectedPlanner + 1; return { commit: true, value: true } })
      }
      if (_record.state === "preparing" && ++access.preparingChecks === 2 && access.revokeAtEgress) access.allowed = false
      return { status: "ok", value: { sourceFence } }
    }, revalidateForCommit: async (_record, context, _snapshot, output) => {
      if (context.kind !== "native" || !await registry.revalidate(context)) return { status: "denied", reason: "invalid-authority" }
      if (!output) return { status: "ok", value: true }
      // C08 supplied the snapshot under transactionAll. No nested cross-surface read occurs.
      if (locked.planner === undefined || locked.planner !== access.expectedPlanner) return { status: "stale", reason: "planner-source-changed" }
      return { status: "ok", value: true }
    }, now: () => "2026-11-13T00:00:00Z" })
    return { persistence, state, store }
  }
  try {
    const first = await open()
    await first.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "f".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
      state.cases.case = { id: "case", incarnation: "inc", version: 1, participants: ["principal"] } as unknown as typeof state.cases[string]
      return { commit: true, value: true }
    })
    const record = { schema: "sf-native-run-v1", runRef: "run", version: 1, intentDigest: "c".repeat(64), requestDigest: "1".repeat(64), skillInputDigest: "2".repeat(64), principalRef: "principal", accessRevision: "access", policyVersion: "policy", caseRef, selection, model: { providerID: "openai", id: "model" }, skillId: skill.id, objective: "review", contextFingerprint: "context", createdAt: "2026-11-13T00:00:00Z", updatedAt: "2026-11-13T00:00:00Z", state: "preparing" } as const
    expect(await withRunContext("run", (context) => first.store.create(record, context))).toEqual({ status: "denied", reason: "invalid-authority" })
    access.allowed = true
    access.revokeAtEgress = false
    expect(await withRunContext("run", (context) => first.store.read("run", context))).toMatchObject({ status: "ok", value: { state: "preparing", version: 1 } })
    expect((await withRunContext("run", (context) => first.store.attach("run", 1, sessionID, receipt, context))).status).toBe("ok")
    expect(await withRunContext("run", (context) => first.store.create(record, context))).toEqual({ status: "stale", reason: "run-or-output-changed" })
    expect((await withRunContext("run", (context) => first.store.transition("run", 2, "running", undefined, context))).status).toBe("ok")
    const { digestSfContribution } = await import("../../../product/contracts/canonical.ts")
    const output = { id: "output", caseRef, kind: "MatchExplanation", schemaVersion: "sf-contribution-v1", state: "ready", payload: { candidateCaseRef: caseRef, matchedCriteria: [], currentDifferences: [], sourceStates: [], limitations: [] }, evidenceRefs: [], runProvenance: { ...receipt, actualModel: "openai/model", contextFingerprint: "context" }, accessRevision: "access", createdAt: "2026-11-13T00:00:00Z", outputDigest: "" } as const
    const contribution = { ...output, outputDigest: digestSfContribution(output) }
    expect(await withRunContext("run", (context) => first.store.publish("run", 3, contribution, context))).toEqual({ status: "stale", reason: "planner-source-changed" })
    expect(await first.state.read(request, "contributions", (state) => state.contributions.output)).toMatchObject({ status: "ok", value: undefined })
    const host = createSfAnalysisHost({ store: first.store, withRunContext, verify: async () => ({ status: "ok", value: true }) } as unknown as Parameters<typeof createSfAnalysisHost>[0])
    expect(await withRunContext("run", (context) => host.settle("run", "unavailable", "native-gate-unavailable", context))).toEqual({ status: "ok", value: true })
    await first.persistence.dispose()
    const reopened = await open()
    expect(await withRunContext("run", (context) => reopened.store.read("run", context))).toMatchObject({ status: "ok", value: { state: "unavailable", reason: "native-gate-unavailable", version: 4 } })
    access.allowed = false
    expect((await withRunContext("run", (context) => reopened.store.read("run", context))).status).toBe("denied")
    await reopened.persistence.dispose()
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})
