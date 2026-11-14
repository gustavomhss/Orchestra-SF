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
  const failures: string[] = []
  const settlements: { state: string; reason: string }[] = []
  let publicationOutcome: { status: "unavailable" | "needs-input" | "denied" | "conflict"; reason: string } | undefined
  const host = {
    withRunContext: async (_runRef: string, action: (context: unknown) => Promise<unknown>) => {
      const context = { binding: { accessRevision: "access-1" } }
      scopes.add(context)
      return action(context)
    },
    revalidate: async () => ({ status: "ok", value: true }),
    execution: { admit: async () => ({ status: "ok", value: { runRef: "run-1", sessionID: "session-1", skillReceipt: receipt, executionTicket: {} } }), execute: async () => ({ status: "ok", value: true }), collect: async () => ({ status: "ok", value: output }) },
    result: { write: async () => publicationOutcome ?? ({ status: "ok", value: { outputRef: "output-1", caseVersion: 1 } }) },
    fail: async (_runRef: string, reason: string) => { failures.push(reason); return { status: "ok", value: true } },
    settle: async (_runRef: string, state: string, reason: string) => { settlements.push({ state, reason }); return { status: "ok", value: true } },
  }
  const request = { caseRef, profileId: "sf_finance", profileVersion: "1.0.0", skillId: receipt.skillId, skillVersion: "1.0.0", manifestDigest: receipt.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Review", contextFingerprint: "context-1" }
  const skillInput = { currentCase: caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "renewal" }
  const input = { host, request, skillInput } as unknown as Parameters<typeof runSfAnalysis>[0]
  expect(await runSfAnalysis(input)).toEqual({ status: "ok", value: { outputRef: "output-1", caseVersion: 1 } })
  expect(scopes.size).toBe(4)
  output.outputDigest = "0".repeat(64)
  expect(await runSfAnalysis(input)).toEqual({ status: "failed", reason: "contribution-digest-mismatch" })
  expect(failures).toEqual(["contribution-digest-mismatch"])
  expect(scopes.size).toBe(7)
  output.outputDigest = digestSfContribution(output)
  for (const status of ["unavailable", "needs-input", "denied", "conflict"] as const) {
    publicationOutcome = { status, reason: `publication-${status}` }
    expect(await runSfAnalysis(input)).toEqual(publicationOutcome)
  }
  expect(settlements).toEqual([{ state: "unavailable", reason: "publication-unavailable" }, { state: "needs-input", reason: "publication-needs-input" }])
  expect(failures).toEqual(["contribution-digest-mismatch"])
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

test("publication settles an exact output after a stale post-write check using fresh authority", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  const original = sfRunFixture()
  const scopes: object[] = []
  const authority = { allowed: true }
  const observed: { step: string; context: object; output?: unknown }[] = []
  const host = {
    withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
      const context = { binding: { accessRevision: "access" } }
      scopes.push(context)
      return action(context)
    },
    revalidate: async (context: object) => { observed.push({ step: "authorize", context }); return { status: "ok", value: true } },
    result: { write: async (_request: unknown, context: object) => { observed.push({ step: "write", context }); return { status: "stale", reason: "source-changed-after-commit" } } },
    preserveStale: async (_runRef: string, _reason: string, output: unknown, context: object) => {
      observed.push({ step: "preserve", context, output })
      return authority.allowed ? { status: "ok", value: true } : { status: "denied", reason: "access-revoked" }
    },
  }
  const input = { host, output: original.output, skillReceipt: original.receipt, runRef: original.run.runRef } as unknown as Parameters<typeof publishSfContribution>[0]
  expect(await publishSfContribution(input)).toEqual({ status: "stale", reason: "source-changed-after-commit" })
  expect(observed.map((item) => item.step)).toEqual(["authorize", "write", "preserve"])
  expect(new Set(scopes).size).toBe(3)
  expect(observed[2]!.output).toBe(original.output)
  authority.allowed = false
  expect(await publishSfContribution(input)).toEqual({ status: "denied", reason: "access-revoked" })
})

test("terminal metadata uses current lifecycle authority after the execution source scope closes", async () => {
  const { runSfAnalysis } = await import("../../../product/ai/analysis-port.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  const original = sfRunFixture()
  const request = { caseRef: original.caseRef, profileId: original.receipt.profileId, profileVersion: original.receipt.profileVersion,
    skillId: original.receipt.skillId, skillVersion: original.receipt.skillVersion, manifestDigest: original.receipt.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Review", contextFingerprint: "context" }
  const skillInput = { currentCase: original.caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "renewal" }
  for (const state of ["failed", "unavailable", "needs-input", "stale"] as const) {
    const access = { sourceCurrent: true, lifecycleAllowed: true, strictCalls: 0, lifecycleCalls: 0 }
    const writes: { state: string; context: object }[] = []
    const lifecycleContext = { binding: { principalRef: "principal", accessRevision: "access", currentCaseVersion: 2 } }
    const host = {
      withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
        access.strictCalls++
        return access.sourceCurrent ? action({ binding: { accessRevision: "access" } }) : { status: "denied", reason: "old-case-selection-unavailable" }
      },
      withLifecycleContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
        access.lifecycleCalls++
        return access.lifecycleAllowed ? action(lifecycleContext) : { status: "denied", reason: "current-case-access-revoked" }
      },
      revalidate: async () => ({ status: "ok", value: true }),
      fail: async (_runRef: string, _reason: string, context: object) => { writes.push({ state: "failed", context }); return { status: "ok", value: true } },
      settle: async (_runRef: string, state: string, _reason: string, context: object) => { writes.push({ state, context }); return { status: "ok", value: true } },
      markStale: async (_runRef: string, _reason: string, context: object) => { writes.push({ state: "stale", context }); return { status: "ok", value: true } },
      execution: {
        admit: async () => ({ status: "ok", value: { runRef: original.run.runRef, sessionID: original.receipt.nativeSessionId, skillReceipt: original.receipt, executionTicket: {} } }),
        execute: async () => { access.sourceCurrent = false; return { status: state, reason: "source-changed-during-execution" } },
        collect: async () => { throw new Error("terminal execution cannot collect content") },
      },
    }
    const input = { host, request, skillInput } as unknown as Parameters<typeof runSfAnalysis>[0]
    expect(await runSfAnalysis(input)).toEqual({ status: state, reason: "source-changed-during-execution" })
    expect(writes).toEqual([{ state, context: lifecycleContext }])
    expect(access.strictCalls).toBe(1)
    expect(access.lifecycleCalls).toBe(1)
    access.sourceCurrent = true
    access.lifecycleAllowed = false
    expect(await runSfAnalysis(input)).toEqual({ status: "denied", reason: "current-case-access-revoked" })
    expect(writes).toHaveLength(1)
  }
})

test("lifecycle progress cannot use its current metadata authority to return a ready payload", async () => {
  const { readSfAnalysisRun } = await import("../../../product/ai/analysis-port.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  const original = sfRunFixture()
  const observed = { ready: false, strictCalls: 0, lifecycleCalls: 0 }
  const host = {
    withRunContext: async () => { observed.strictCalls++; return { status: "denied", reason: "old-case-selection-unavailable" } },
    withLifecycleContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => { observed.lifecycleCalls++; return action({ binding: { accessRevision: "access" } }) },
    readRun: async () => ({ status: "ok", value: { ...original.run, state: observed.ready ? "ready" : "stale", outputRef: original.output.id, reason: "case-changed" } }),
    analysis: { read: async () => { throw new Error("metadata authority cannot return contribution content") } },
  }
  const input = { host, runRef: original.run.runRef } as unknown as Parameters<typeof readSfAnalysisRun>[0]
  const progress = await readSfAnalysisRun(input)
  expect(progress).toEqual({ status: "ok", value: { run: { runRef: original.run.runRef, version: original.run.version, caseRef: original.caseRef, skillId: original.run.skillId,
    state: "stale", createdAt: original.run.createdAt, updatedAt: original.run.updatedAt, reason: "case-changed", outputRef: original.output.id } } })
  expect(observed).toEqual({ ready: false, strictCalls: 0, lifecycleCalls: 1 })
  observed.ready = true
  expect(await readSfAnalysisRun(input)).toEqual({ status: "denied", reason: "old-case-selection-unavailable" })
  expect(observed).toEqual({ ready: true, strictCalls: 1, lifecycleCalls: 2 })
})

test("publication pins its envelope across authorization and later write or preservation scopes", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const { digestSfContribution } = await import("../../../product/contracts/canonical.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  for (const phase of ["verifier", "after-verifier-scope", "write-scope", "preservation-scope", "post-write-preservation-scope"] as const) {
    const original = sfRunFixture()
    const observed = { scopes: 0, writes: 0, preservations: 0 }
    const change = () => {
      original.output.createdAt = "2026-11-14T00:00:00Z"
      original.output.outputDigest = digestSfContribution(original.output)
    }
    const host = {
      withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
        observed.scopes++
        if (observed.scopes === 2 && (phase === "write-scope" || phase === "preservation-scope")) change()
        if (observed.scopes === 3 && phase === "post-write-preservation-scope") change()
        const result = await action({ binding: { accessRevision: "access" } })
        if (observed.scopes === 1 && phase === "after-verifier-scope") change()
        return result
      },
      revalidate: async () => {
        if (phase === "verifier") change()
        return phase === "preservation-scope" ? { status: "stale", reason: "case-changed" } : { status: "ok", value: true }
      },
      result: { write: async () => {
        observed.writes++
        return phase === "post-write-preservation-scope" ? { status: "stale", reason: "source-changed-after-commit" }
          : { status: "ok", value: { outputRef: original.output.id, caseVersion: 1 } }
      } },
      preserveStale: async () => { observed.preservations++; return { status: "ok", value: true } },
    }
    const input = { host, output: original.output, skillReceipt: original.receipt, runRef: original.run.runRef } as unknown as Parameters<typeof publishSfContribution>[0]
    expect(await publishSfContribution(input)).toEqual({ status: "denied", reason: "contribution-input-changed-during-authorization" })
    expect(observed.writes).toBe(phase === "post-write-preservation-scope" ? 1 : 0)
    expect(observed.preservations).toBe(0)
  }
})

test("publication refuses changed load provenance even when a verifier reseals the contribution", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const { digestSfContribution } = await import("../../../product/contracts/canonical.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  const original = sfRunFixture()
  const observed = { writes: 0 }
  const host = {
    withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => action({ binding: { accessRevision: "access" } }),
    revalidate: async () => {
      original.receipt.loadedMessageId = "unobserved-message"
      original.output.runProvenance.loadedMessageId = "unobserved-message"
      original.output.outputDigest = digestSfContribution(original.output)
      return { status: "ok", value: true }
    },
    result: { write: async () => { observed.writes++; return { status: "ok", value: { outputRef: original.output.id, caseVersion: 1 } } } },
  }
  const input = { host, output: original.output, skillReceipt: original.receipt, runRef: original.run.runRef } as unknown as Parameters<typeof publishSfContribution>[0]
  expect(await publishSfContribution(input)).toEqual({ status: "denied", reason: "contribution-input-changed-during-authorization" })
  expect(observed.writes).toBe(0)
})

test("publication pins the independent review target until its write scope", async () => {
  const { publishSfContribution } = await import("../../../product/ai/analysis-port.ts")
  const { digestSfContribution } = await import("../../../product/contracts/canonical.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  const original = sfRunFixture()
  const receipt = { ...original.receipt, profileId: "sf_reviewer", skillId: "sf-contestar-decisao" } satisfies Parameters<typeof publishSfContribution>[0]["skillReceipt"]
  const reviewTarget = { targetRunId: "author-run", targetSessionId: "author-session", targetOutputDigest: "e".repeat(64), caseRef: original.caseRef }
  const output: Parameters<typeof digestSfContribution>[0] = {
    ...original.output, kind: "CritiqueReport", state: "ready",
    payload: { targetRunId: reviewTarget.targetRunId, targetOutputDigest: reviewTarget.targetOutputDigest, reviewerRunId: receipt.runId,
      reviewerSessionId: receipt.nativeSessionId, claimIssues: [], unresolvedConditions: [], evidenceRefs: [] },
    runProvenance: { ...receipt, actualModel: "provider/model", contextFingerprint: "context", targetRunId: reviewTarget.targetRunId,
      targetOutputDigest: reviewTarget.targetOutputDigest, reviewerRunId: receipt.runId },
  }
  output.outputDigest = digestSfContribution(output)
  const observed = { scopes: 0, writes: 0 }
  const host = {
    withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
      if (++observed.scopes === 2) reviewTarget.targetSessionId = receipt.nativeSessionId
      return action({ binding: { accessRevision: "access" } })
    },
    revalidate: async () => ({ status: "ok", value: true }),
    result: { write: async () => { observed.writes++; return { status: "ok", value: { outputRef: output.id, caseVersion: 1 } } } },
  }
  const input = { host, output, skillReceipt: receipt, runRef: receipt.runId, reviewTarget } as unknown as Parameters<typeof publishSfContribution>[0]
  expect(await publishSfContribution(input)).toEqual({ status: "denied", reason: "contribution-input-changed-during-authorization" })
  expect(observed).toEqual({ scopes: 2, writes: 0 })
})

test("ready read returns copies that retained host references cannot rewrite", async () => {
  const { readSfAnalysisRun } = await import("../../../product/ai/analysis-port.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  const original = sfRunFixture()
  const readyRun = { ...original.run, state: "ready", outputRef: original.output.id }
  const host = {
    withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => action({ binding: { accessRevision: "access" } }),
    readRun: async () => ({ status: "ok", value: readyRun }),
    analysis: { read: async () => ({ status: "ok", value: original.output }) },
    revalidate: async () => ({ status: "ok", value: true }),
  }
  const result = await readSfAnalysisRun({ host, runRef: readyRun.runRef } as unknown as Parameters<typeof readSfAnalysisRun>[0])
  expect(result.status).toBe("ok")
  if (result.status !== "ok" || !("output" in result.value) || !result.value.output) throw new Error("Expected a verified ready output")
  const originalDate = result.value.output.createdAt
  original.output.createdAt = "2026-11-14T00:00:00Z"
  readyRun.caseRef.version = 9
  expect(result.value.output.createdAt).toBe(originalDate)
  expect(result.value.output.caseRef.version).toBe(1)
  expect(result.value.run.caseRef.version).toBe(1)
})

test("ready read pins the scoped result and isolates the final returned copy", async () => {
  const { readSfAnalysisRun } = await import("../../../product/ai/analysis-port.ts")
  const { digestSfContribution } = await import("../../../product/contracts/canonical.ts")
  const { sfRunFixture } = await import("./run-fixture.ts")
  for (const mutation of ["mutate-result", "replace-result", "retain-result"] as const) {
    const original = sfRunFixture()
    const readyRun = { ...original.run, state: "ready", outputRef: original.output.id }
    const observed: { scopes: number; retained?: { value: { output: typeof original.output } } } = { scopes: 0 }
    const host = {
      withRunContext: async (_runRef: string, action: (context: object) => Promise<unknown>) => {
        observed.scopes++
        const result = await action({ binding: { accessRevision: "access" } })
        if (observed.scopes !== 2) return result
        const ready = (mutation === "replace-result" ? structuredClone(result) : result) as { value: { output: typeof original.output } }
        observed.retained = ready
        if (mutation !== "retain-result") {
          ready.value.output.createdAt = "2026-11-14T00:00:00Z"
          ready.value.output.outputDigest = digestSfContribution(ready.value.output)
        }
        return ready
      },
      readRun: async () => ({ status: "ok", value: readyRun }),
      analysis: { read: async () => ({ status: "ok", value: original.output }) },
      revalidate: async () => ({ status: "ok", value: true }),
    }
    const result = await readSfAnalysisRun({ host, runRef: readyRun.runRef } as unknown as Parameters<typeof readSfAnalysisRun>[0])
    if (mutation !== "retain-result") {
      expect(result).toEqual({ status: "denied", reason: "analysis-read-mutated-input" })
      continue
    }
    expect(result.status).toBe("ok")
    if (result.status !== "ok" || !("output" in result.value) || !result.value.output || !observed.retained) throw new Error("Expected a verified ready result")
    const date = result.value.output.createdAt
    observed.retained.value.output.createdAt = "2026-11-14T00:00:00Z"
    expect(result.value.output.createdAt).toBe(date)
    expect(result).not.toBe(observed.retained)
  }
})
