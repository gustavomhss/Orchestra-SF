import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createSfAnalysisHost } from "../../../product/ai/analysis-host.ts"
import { publishSfContribution, runSfAnalysis } from "../../../product/ai/analysis-port.ts"
import type { SfAnalysisHost, SfNativeExecutionTicket } from "../../../product/ai/analysis-port.ts"
import { buildSfContribution } from "../../../product/ai/contribution-builder.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { digestSfContribution, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { ContributionEnvelope, ResidentProfile, SkillLoadReceipt, SkillManifest } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord, SfProductState, SfProductStatePort } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { sfCaseFixture, sfRunFixture } from "./run-fixture.ts"

// Real publisher, run store, C08 and SQLite. The injected authority and collection
// boundary do not claim a native provider, capability call, or financial calculation.
async function fixture(options?: { alternative?: boolean; closeStrictOnStale?: boolean }) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-publication-lifecycle-"))
  const persistence = await openLocalStore(directory)
  const request = new Request("https://example.test/publication")
  const material: { caseRef: SfNativeRunRecord["caseRef"]; profile: ResidentProfile; skill: SkillManifest; receipt: SkillLoadReceipt; run: SfNativeRunRecord; output: ContributionEnvelope } = sfRunFixture()
  if (options?.alternative) {
    const profile = { ...material.profile, id: "sf_portfolio" as const, allowedSkills: ["sf-compor-portfolio"], outputTypes: ["AlternativeDraft" as const] }
    const skill = { ...material.skill, id: "sf-compor-portfolio", allowedProfiles: ["sf_portfolio" as const], outputSchemaRefs: ["AlternativeDraft"] }
    material.receipt = { ...material.receipt, profileId: profile.id, skillId: skill.id }
    material.run = { ...material.run, state: "running", skillId: skill.id, selection: { ...material.run.selection, profile, skills: [skill] }, native: { sessionID: "session", skillReceipt: material.receipt } }
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    const output: ContributionEnvelope = { ...material.output, kind: "AlternativeDraft", state: "ready", runProvenance: { ...material.output.runProvenance, ...material.receipt }, payload: {
      caseRef: encodeCaseRef(material.caseRef), proposal: { id: "alternative", version: 1, title: "Unconfirmed alternative", scenario: { baseRef: "base", operations: [], assumptions: [] },
        result: { id: "scenario", version: 1, comparisonStatus: "conditioned", components: [], currency: "BRL", horizon, sourceRefs: [], unresolvedConditions: ["implementation cost unknown"], restrictions: [], knownSubtotal: null, total: null,
          costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "BRL", horizon, issues: ["implementation cost unknown"], evaluatedSourceRefs: [], coverageState: "pending", entries: [{ status: "pending", categoryId: "implementation", reason: "Cost is unconfirmed" }], derivedMissingCategoryIds: [] } } },
      costCoverageBasis: { id: "basis", version: 1, decisionType: "portfolio", categoryIds: ["implementation"], additionalCategoryIds: [], sourceRefs: [] }, coverageRef: "coverage", domainApplied: false,
    } }
    output.outputDigest = digestSfContribution(output)
    material.output = output
  }
  const authority = { principalRef: material.run.principalRef, policyVersion: material.run.policyVersion, accessRevision: material.run.accessRevision }
  const access = { allowed: true }
  const scopes: TrustedDomainContext[] = []
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const hooks: {
    beforeWrite?: () => Promise<void>
    beforeStateTransaction?: () => Promise<void>
    beforeLifecycle?: () => Promise<void>
    afterReadyCommit?: () => Promise<void>
    collect?: (context: TrustedDomainContext) => Promise<PortResult<ContributionEnvelope>>
    denyStaleCommit?: boolean
    publicationOutcome?: { status: "unavailable" | "needs-input" | "denied" | "conflict"; reason: string }
    outcomeAfterCommit?: boolean
  } = {}
  const observations = { readyObservedBeforeChange: false, captureReads: 0, lifecycleCalls: 0, strictRefusals: 0, staleCommitHadOutput: [] as boolean[] }
  const rawState = createSfProductState({ persistence, createId: () => "store", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => access.allowed ? authority : undefined })
  const state: SfProductStatePort = { ...rawState, transaction: async (incoming, command, work) => {
    const before = hooks.beforeStateTransaction
    if (before) { delete hooks.beforeStateTransaction; await before() }
    return rawState.transaction(incoming, command, work)
  } }
  let sourceCurrent = true
  const changeSource = () => persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.wp12SourceRevision = Number(snapshot.data.wp12SourceRevision ?? 0) + 1
    return { commit: true, value: true }
  }).then(() => { sourceCurrent = false })
  const stored = () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.__sfProductV1) as SfProductState }))
  const store = createSfRunStore({ state, requestFor: () => request, revalidate: async () => access.allowed,
    preflight: async (record) => {
      if (!access.allowed) return { status: "denied", reason: "access-revoked" }
      const after = hooks.afterReadyCommit
      if (record.state === "ready" && after) {
        const current = await stored()
        if (current.nativeRuns?.run?.state === "ready") {
          observations.readyObservedBeforeChange = true
          delete hooks.afterReadyCommit
          await after()
        }
      }
      return persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: Number(snapshot.data.wp12SourceRevision ?? 0) === 0
        ? { status: "ok" as const, value: { sourceFence: sfRunSourceFence(snapshot) } }
        : { status: "stale" as const, reason: "source-changed" } }))
    },
    revalidateForCommit: async (record, _context, snapshot, output) => {
      if (!access.allowed) return { status: "denied", reason: "access-revoked" }
      if (record.state === "stale") observations.staleCommitHadOutput.push(output !== undefined)
      if (record.state === "stale" && hooks.denyStaleCommit) return { status: "denied", reason: "historical-source-access-unavailable" }
      if (record.state === "stale" || record.state === "cancelled") return { status: "ok", value: true }
      return Number(snapshot.data.wp12SourceRevision ?? 0) === 0 ? { status: "ok", value: true } : { status: "stale", reason: "source-changed" }
    }, now: () => material.receipt.loadedAt })
  expect((await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
    current.cases.case = sfCaseFixture(material.caseRef, [authority.principalRef])
    return { commit: true, value: true }
  })).status).toBe("ok")
  const { native: _native, outputRef: _outputRef, ...base } = material.run
  expect((await store.create({ ...base, state: "preparing", version: 1 }, context)).status).toBe("ok")
  expect((await store.attach("run", 1, "session", material.receipt, context)).status).toBe("ok")
  expect((await store.transition("run", 2, "running", undefined, context)).status).toBe("ok")
  const withCurrentContext: SfAnalysisHost["withRunContext"] = async (runRef, action) => {
      if (!access.allowed || runRef !== "run") return { status: "denied", reason: "access-revoked" }
      const current = { kind: "ui", binding: { ...authority } } as unknown as TrustedDomainContext
      scopes.push(current)
      return action(current)
  }
  const withLifecycleContext: SfAnalysisHost["withRunContext"] = async (runRef, action) => {
    observations.lifecycleCalls++
    const before = hooks.beforeLifecycle
    if (before) { delete hooks.beforeLifecycle; await before() }
    return withCurrentContext(runRef, action)
  }
  const hostBase = createSfAnalysisHost({ store,
    withRunContext: async (runRef, action) => {
      if (options?.closeStrictOnStale && !sourceCurrent) { observations.strictRefusals++; return { status: "denied", reason: "old-source-context-unavailable" } }
      return withCurrentContext(runRef, action)
    },
    ...(options?.closeStrictOnStale ? { withLifecycleContext } : {}),
    verify: async () => access.allowed ? { status: "ok", value: true } : { status: "denied", reason: "access-revoked" },
    alternativeForOutput: async () => { observations.captureReads++; return { status: "unavailable", reason: "alternative-capture-unavailable" } },
    analysis: { create: async () => ({ status: "unavailable", reason: "not-used" }), read: async () => ({ status: "unavailable", reason: "not-used" }), cancel: async () => ({ status: "unavailable", reason: "not-used" }) },
    routines: {} as SfAnalysisHost["routines"],
    execution: {
      admit: async () => ({ status: "ok", value: { runRef: "run", sessionID: "session", skillReceipt: material.receipt, executionTicket: {} as SfNativeExecutionTicket } }),
      execute: async () => ({ status: "ok", value: true }),
      collect: async (_ticket, call) => hooks.collect ? hooks.collect(call) : { status: "ok", value: material.output },
      interrupt: async () => ({ status: "unavailable", reason: "not-used" }),
    },
  })
  const host: SfAnalysisHost = { ...hostBase, result: { write: async (incoming, call) => {
    const before = hooks.beforeWrite
    if (before) { delete hooks.beforeWrite; await before() }
    if (hooks.publicationOutcome && !hooks.outcomeAfterCommit) return hooks.publicationOutcome
    const written = await hostBase.result.write(incoming, call)
    return written.status === "ok" && hooks.publicationOutcome ? hooks.publicationOutcome : written
  } } }
  const publish = () => publishSfContribution({ host, output: material.output, skillReceipt: material.receipt, runRef: "run" })
  const run = () => runSfAnalysis({ host, request: { caseRef: material.caseRef, profileId: material.receipt.profileId, profileVersion: material.receipt.profileVersion,
    skillId: material.receipt.skillId, skillVersion: material.receipt.skillVersion, manifestDigest: material.receipt.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: "Recall", contextFingerprint: "context" },
    skillInput: { currentCase: material.caseRef, recallScope: { cases: [], period: { start: "2027-01-01", end: "2027-12-31" }, includeHistorical: true }, query: "current case" } })
  return { material, access, hooks, observations, scopes, state, rawState, store, context, request, changeSource, stored, publish, run,
    [Symbol.asyncDispose]: async () => { await persistence.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test("source changed strictly between publication authorization and write settles the original output as stale", async () => {
  await using f = await fixture()
  f.hooks.beforeWrite = f.changeSource
  expect(await f.publish()).toEqual({ status: "stale", reason: "source-changed" })
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "stale", version: 4, outputRef: "output" })
  expect(digestSfValue(persisted.contributions.output)).toBe(digestSfValue(f.material.output))
  expect(new Set(f.scopes).size).toBe(3)
})

test("source changed after the ready commit downgrades only the exact persisted output", async () => {
  await using f = await fixture()
  f.hooks.afterReadyCommit = f.changeSource
  expect(await f.publish()).toEqual({ status: "stale", reason: "source-changed" })
  expect(f.observations.readyObservedBeforeChange).toBe(true)
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "stale", version: 5, outputRef: "output" })
  expect(digestSfValue(persisted.contributions.output)).toBe(digestSfValue(f.material.output))
  expect(new Set(f.scopes).size).toBe(3)
})

test("a closed strict source scope settles a pre-write run through current lifecycle without content", async () => {
  for (const alternative of [false, true]) {
    await using f = await fixture({ closeStrictOnStale: true, alternative })
    f.hooks.beforeWrite = f.changeSource
    expect(await f.publish()).toEqual({ status: "stale", reason: "source-changed" })
    const persisted = await f.stored()
    expect(persisted.nativeRuns?.run).toMatchObject({ state: "stale", version: 4 })
    expect(persisted.nativeRuns?.run?.outputRef).toBeUndefined()
    expect(Object.keys(persisted.contributions)).toEqual([])
    expect(Object.keys(persisted.preferences)).toEqual([])
    expect(persisted.cases.case?.alternatives).toEqual([])
    expect(f.observations).toMatchObject({ captureReads: 0, lifecycleCalls: 1, strictRefusals: 1, staleCommitHadOutput: [false] })
    expect(new Set(f.scopes).size).toBe(3)
  }
})

test("a closed strict source scope marks the exact committed output stale through metadata only", async () => {
  await using f = await fixture({ closeStrictOnStale: true })
  f.hooks.afterReadyCommit = f.changeSource
  const outputDigest = digestSfValue(f.material.output)
  expect(await f.publish()).toEqual({ status: "stale", reason: "source-changed" })
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "stale", version: 5, outputRef: f.material.output.id })
  expect(digestSfValue(persisted.contributions[f.material.output.id])).toBe(outputDigest)
  expect(persisted.nativeRuns?.run?.selection).toEqual(f.material.run.selection)
  expect(Object.keys(persisted.preferences)).toEqual([])
  expect(f.observations).toMatchObject({ readyObservedBeforeChange: true, lifecycleCalls: 1, strictRefusals: 1, staleCommitHadOutput: [false] })
})

test("revocation of current lifecycle authority prevents stale metadata writes after strict scope closes", async () => {
  for (const committed of [false, true]) {
    await using f = await fixture({ closeStrictOnStale: true })
    if (committed) f.hooks.afterReadyCommit = f.changeSource
    else f.hooks.beforeWrite = f.changeSource
    f.hooks.beforeLifecycle = async () => { f.access.allowed = false }
    expect(await f.publish()).toEqual({ status: "denied", reason: "access-revoked" })
    const persisted = await f.stored()
    expect(persisted.nativeRuns?.run).toMatchObject({ state: committed ? "ready" : "running", version: committed ? 4 : 3 })
    expect(f.observations.staleCommitHadOutput).toEqual([])
    expect<ContributionEnvelope | undefined>(persisted.contributions.output).toEqual(committed ? f.material.output : undefined)
    expect(Object.keys(persisted.preferences)).toEqual([])
  }
})

test("lifecycle fallback cannot overwrite a concurrent cancellation at the C08 boundary", async () => {
  await using f = await fixture({ closeStrictOnStale: true })
  f.hooks.beforeWrite = f.changeSource
  f.hooks.beforeLifecycle = async () => {
    f.hooks.beforeStateTransaction = async () => {
      expect(await f.store.transition("run", 3, "cancelled", "human-cancelled", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 4 } })
    }
  }
  expect(await f.publish()).toMatchObject({ status: "conflict" })
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "cancelled", version: 4 })
  expect(Object.keys(persisted.contributions)).toEqual([])
  expect(Object.keys(persisted.preferences)).toEqual([])
})

test("ready metadata fallback refuses injected run or output changes between its read and C08 commit", async () => {
  for (const injection of ["cancelled-run", "changed-output"] as const) {
    await using f = await fixture({ closeStrictOnStale: true })
    f.hooks.afterReadyCommit = f.changeSource
    let injected: SfProductState | undefined
    f.hooks.beforeLifecycle = async () => {
      f.hooks.beforeStateTransaction = async () => {
        const version = await f.rawState.read(f.request, "contributions", () => null)
        if (version.status !== "ok") throw new Error("Ready state unavailable for race injection")
        expect((await f.rawState.transaction(f.request, { namespace: "contributions", expectedStorageVersion: version.storageVersion,
          idempotencyKey: `inject-${injection}`, commandDigest: digestSfValue(injection), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
          if (injection === "cancelled-run") {
            // Storage-level adversarial injection, not a new domain permission to cancel a ready run.
            const prior = state.nativeRuns!.run!
            state.nativeRuns!.run = { ...prior, version: prior.version + 1, state: "cancelled", reason: "concurrent-terminal" }
          } else {
            const output = state.contributions.output!
            output.createdAt = "2026-11-14T00:00:00Z"
            output.outputDigest = digestSfContribution(output)
          }
          return { commit: true, value: true }
        })).status).toBe("ok")
        injected = await f.stored()
      }
    }
    expect(await f.publish()).toMatchObject({ status: "conflict" })
    if (!injected) throw new Error("C08 race injection did not execute")
    const persisted = await f.stored()
    expect(digestSfValue(persisted)).toBe(digestSfValue(injected))
    expect(persisted.nativeRuns?.run).toMatchObject({ state: injection === "cancelled-run" ? "cancelled" : "ready" })
    expect(f.observations.staleCommitHadOutput).toEqual([])
  }
})

test("stale observation refuses a replacement publication before the lifecycle callback begins", async () => {
  for (const injection of ["changed-output", "replacement-output-ref", "advanced-run-version", "changed-receipt"] as const) {
    await using f = await fixture({ closeStrictOnStale: true })
    f.hooks.afterReadyCommit = f.changeSource
    let injected: SfProductState | undefined
    f.hooks.beforeLifecycle = async () => {
      const version = await f.rawState.read(f.request, "contributions", () => null)
      if (version.status !== "ok") throw new Error("Ready state unavailable for pre-callback injection")
      expect((await f.rawState.transaction(f.request, { namespace: "contributions", expectedStorageVersion: version.storageVersion,
        idempotencyKey: `before-lifecycle-${injection}`, commandDigest: digestSfValue(injection), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
        const run = state.nativeRuns!.run!
        const output = state.contributions.output!
        if (injection === "changed-output") {
          output.createdAt = "2026-11-14T00:00:00Z"
          output.outputDigest = digestSfContribution(output)
          // Also replace the retained caller candidate. The fallback must use
          // the earlier observation, not discover this substituted output anew.
          Object.assign(f.material.output, structuredClone(output))
        } else if (injection === "replacement-output-ref") {
          const replacement = { ...structuredClone(output), id: "replacement-output" }
          replacement.outputDigest = digestSfContribution(replacement)
          state.contributions[replacement.id] = replacement
          run.outputRef = replacement.id
        } else if (injection === "advanced-run-version") run.version++
        else {
          if (!run.native) throw new Error("Native receipt missing from ready fixture")
          run.native.skillReceipt.loadedMessageId = "another-observed-load"
          output.runProvenance.loadedMessageId = "another-observed-load"
          output.outputDigest = digestSfContribution(output)
        }
        return { commit: true, value: true }
      })).status).toBe("ok")
      injected = await f.stored()
    }
    expect(await f.publish()).toEqual(injection === "changed-output"
      ? { status: "denied", reason: "contribution-input-changed-during-authorization" }
      : { status: "conflict", reason: "stale-observation-changed" })
    if (!injected) throw new Error("Pre-callback injection did not execute")
    const persisted = await f.stored()
    expect(digestSfValue(persisted)).toBe(digestSfValue(injected))
    expect(persisted.nativeRuns?.run?.state).toBe("ready")
    expect(f.observations.staleCommitHadOutput).toEqual([])
  }
})

test("stale reconciliation cannot overwrite a concurrent cancellation at the C08 commit boundary", async () => {
  await using f = await fixture()
  f.hooks.beforeWrite = async () => {
    await f.changeSource()
    f.hooks.beforeStateTransaction = async () => {
      expect(await f.store.transition("run", 3, "cancelled", "human-cancelled", f.context)).toMatchObject({ status: "ok", value: { state: "cancelled", version: 4 } })
    }
  }
  expect(await f.publish()).toMatchObject({ status: "conflict" })
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "cancelled", version: 4 })
  expect(persisted.contributions.output).toBeUndefined()
})

test("ready reconciliation validates the original output bytes inside C08 and never overwrites a replacement", async () => {
  await using f = await fixture()
  expect((await f.publish()).status).toBe("ok")
  const current = await f.state.read(f.request, "contributions", () => null)
  if (current.status !== "ok") throw new Error("contributions unavailable")
  const replacement = { ...f.material.output, createdAt: "2026-11-14T00:00:00Z" }
  replacement.outputDigest = digestSfContribution(replacement)
  expect((await f.state.transaction(f.request, { namespace: "contributions", expectedStorageVersion: current.storageVersion, idempotencyKey: "replace-output", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
    state.contributions.output = replacement
    return { commit: true, value: true }
  })).status).toBe("ok")
  expect(await f.store.preserveStale("run", "source-changed", f.material.output, f.context)).toMatchObject({ status: "stale" })
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "ready", version: 4 })
  expect(digestSfValue(persisted.contributions.output)).toBe(digestSfValue(replacement))
  const another = { ...f.material.output, id: "another-output" }
  another.outputDigest = digestSfContribution(another)
  expect(await f.store.preserveStale("run", "source-changed", another, f.context)).toEqual({ status: "conflict", reason: "invalid-stale-run-output" })
})

test("unpublished AlternativeDraft without private capture settles stale without persisting a payload or new grant", async () => {
  await using f = await fixture({ alternative: true })
  await f.changeSource()
  const selectedBefore = digestSfValue(f.material.run.selection)
  expect(await f.publish()).toEqual({ status: "stale", reason: "source-changed" })
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "stale", version: 4 })
  expect(persisted.nativeRuns?.run?.outputRef).toBeUndefined()
  expect(persisted.contributions.output).toBeUndefined()
  expect(Object.keys(persisted.preferences)).toEqual([])
  expect(digestSfValue(persisted.nativeRuns?.run?.selection)).toBe(selectedBefore)
  expect(f.observations.captureReads).toBe(0)
})

test("revocation or a denied historical-source validator prevents stale preservation", async () => {
  for (const boundary of ["authority", "historical-source"] as const) {
    await using f = await fixture()
    f.hooks.beforeWrite = async () => {
      await f.changeSource()
      if (boundary === "authority") f.access.allowed = false
      else f.hooks.denyStaleCommit = true
    }
    expect(await f.publish()).toMatchObject({ status: "denied" })
    const persisted = await f.stored()
    expect(persisted.nativeRuns?.run).toMatchObject({ state: "running", version: 3 })
    expect(persisted.contributions.output).toBeUndefined()
  }
})

test("invalid model payload and ungranted kind finish failed through the real C08 host", async () => {
  for (const invalid of ["payload", "kind"] as const) {
    await using f = await fixture()
    f.hooks.collect = async (context) => {
      const current = await f.store.read("run", context)
      if (current.status !== "ok") return current
      return buildSfContribution({ run: current.value, candidate: { kind: invalid === "kind" ? "FinancialAnalysis" : "MatchExplanation", payload: {}, evidenceRefs: [] },
        actualModel: f.material.run.model, outputId: "invalid-output", createdAt: f.material.receipt.loadedAt })
    }
    expect(await f.run()).toEqual({ status: "failed", reason: invalid === "kind" ? "native-output-kind-not-granted" : "invalid-native-output" })
    const persisted = await f.stored()
    expect(persisted.nativeRuns?.run).toMatchObject({ state: "failed", version: 4 })
    expect(persisted.contributions["invalid-output"]).toBeUndefined()
    expect(new Set(f.scopes).size).toBe(3)
  }
})

test("publication validation failure settles failed under new authority, and simultaneous revocation prevents the write", async () => {
  for (const revoke of [false, true]) {
    await using f = await fixture()
    f.hooks.collect = async () => {
      const output = { ...f.material.output, outputDigest: "0".repeat(64) }
      if (revoke) f.access.allowed = false
      return { status: "ok", value: output }
    }
    expect(await f.run()).toEqual(revoke ? { status: "denied", reason: "access-revoked" } : { status: "failed", reason: "contribution-digest-mismatch" })
    const persisted = await f.stored()
    expect(persisted.nativeRuns?.run).toMatchObject({ state: revoke ? "running" : "failed", version: revoke ? 3 : 4 })
    expect(persisted.contributions.output).toBeUndefined()
  }
})

test("invalid collected model output cannot settle through revoked authority", async () => {
  await using f = await fixture()
  f.hooks.collect = async () => {
    const outcome = buildSfContribution({ run: f.material.run, candidate: { kind: "MatchExplanation", payload: {}, evidenceRefs: [] },
      actualModel: f.material.run.model, outputId: "invalid-output", createdAt: f.material.receipt.loadedAt })
    expect(outcome).toEqual({ status: "failed", reason: "invalid-native-output" })
    f.access.allowed = false
    return outcome
  }
  expect(await f.run()).toEqual({ status: "denied", reason: "access-revoked" })
  const persisted = await f.stored()
  expect(persisted.nativeRuns?.run).toMatchObject({ state: "running", version: 3 })
  expect(persisted.contributions["invalid-output"]).toBeUndefined()
})

test("publication unavailable or needs-input settles through a fresh C08 authority, and revocation prevents it", async () => {
  for (const state of ["unavailable", "needs-input"] as const) {
    for (const revoke of [false, true]) {
      await using f = await fixture()
      f.hooks.publicationOutcome = { status: state, reason: `publication-${state}` }
      if (revoke) f.hooks.beforeWrite = async () => { f.access.allowed = false }
      expect(await f.run()).toEqual(revoke ? { status: "denied", reason: "access-revoked" } : f.hooks.publicationOutcome)
      const persisted = await f.stored()
      expect(persisted.nativeRuns?.run).toMatchObject({ state: revoke ? "running" : state, version: revoke ? 3 : 4 })
      expect(persisted.contributions.output).toBeUndefined()
      expect(new Set(f.scopes).size).toBe(revoke ? 4 : 5)
    }
  }
})

test("a late unavailable or needs-input signal cannot overwrite a committed ready output", async () => {
  for (const state of ["unavailable", "needs-input"] as const) {
    await using f = await fixture()
    f.hooks.publicationOutcome = { status: state, reason: `publication-${state}` }
    f.hooks.outcomeAfterCommit = true
    expect(await f.run()).toEqual({ status: "conflict", reason: "invalid-run-transition" })
    const persisted = await f.stored()
    expect(persisted.nativeRuns?.run).toMatchObject({ state: "ready", version: 4, outputRef: "output" })
    expect(digestSfValue(persisted.contributions.output)).toBe(digestSfValue(f.material.output))
  }
})

test("publication denied or conflict does not create a terminal lifecycle write", async () => {
  for (const state of ["denied", "conflict"] as const) {
    await using f = await fixture()
    f.hooks.publicationOutcome = { status: state, reason: `publication-${state}` }
    expect(await f.run()).toEqual(f.hooks.publicationOutcome)
    const persisted = await f.stored()
    expect(persisted.nativeRuns?.run).toMatchObject({ state: "running", version: 3 })
    expect(persisted.contributions.output).toBeUndefined()
    expect(new Set(f.scopes).size).toBe(4)
  }
})
