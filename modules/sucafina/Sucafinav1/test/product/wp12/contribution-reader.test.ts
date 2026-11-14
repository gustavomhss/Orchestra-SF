import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createSfContributionReader } from "../../../product/ai/contribution-reader.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { digestSfContribution, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { testPersistence } from "../../fixture/persistence.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { sfCaseFixture, sfRunFixture } from "./run-fixture.ts"

test("consumer opens the stored result and refuses revoked or mismatched provenance", async () => {
  const storage = testPersistence()
  const request = new Request("https://example.test/")
  const access = { allowed: true }
  const authority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "store", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => access.allowed ? authority : undefined })
  const runs = createSfRunStore({ state, requestFor: () => request, revalidate: async () => access.allowed, preflight: async () => ({ status: "ok", value: { sourceFence: sfRunSourceFence(storage.state.dashboard) } }), revalidateForCommit: async () => ({ status: "ok", value: true }), now: () => "2026-11-13T00:00:00Z" })
  const fixture = sfRunFixture()
  const caseRef = fixture.caseRef
  const output = fixture.output
  const run: SfNativeRunRecord = { ...fixture.run, state: "ready", outputRef: "output" }
  await state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "e".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => { current.nativeRuns = { run }; current.contributions.output = output; return { commit: true, value: true } })
  const read = createSfContributionReader({ state, runs, requestFor: () => request, revalidate: async () => access.allowed, verify: async () => ({ status: "ok", value: true }) })
  expect(await read({ outputRef: "output", caseRef }, context)).toMatchObject({ status: "ok", value: { output: { id: "output" }, run: { runRef: "run" } } })
  expect(await read({ outputRef: "output", caseRef: { ...caseRef, version: 2 } }, context)).toMatchObject({ status: "unavailable" })
  const version = await state.read(request, "contributions", () => null)
  if (version.status !== "ok") throw new Error("contributions unavailable")
  const forged = { ...output, runProvenance: { ...output.runProvenance, actualModel: "other/model" } }
  forged.outputDigest = digestSfContribution(forged)
  await state.transaction(request, { namespace: "contributions", expectedStorageVersion: version.storageVersion, idempotencyKey: "wrong-model", commandDigest: "f".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
    current.contributions.output = forged
    return { commit: true, value: true }
  })
  expect(await read({ outputRef: "output", caseRef }, context)).toEqual({ status: "denied", reason: "contribution-provenance-mismatch" })
  await state.transaction(request, { namespace: "contributions", expectedStorageVersion: version.storageVersion + 1, idempotencyKey: "restore-model", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
    current.contributions.output = output
    return { commit: true, value: true }
  })
  const revokedDuringVerification = createSfContributionReader({ state, runs, requestFor: () => request, revalidate: async () => access.allowed, verify: async () => { access.allowed = false; return { status: "ok", value: true } } })
  expect(await revokedDuringVerification({ outputRef: "output", caseRef }, context)).toMatchObject({ status: "denied" })
  access.allowed = false
  expect(await read({ outputRef: "output", caseRef }, context)).toMatchObject({ status: "denied" })
})

test("consumer refuses verifier mutations through final authorization and isolates returned records", async () => {
  const storage = testPersistence()
  const request = new Request("https://example.test/")
  const authority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "store", resolveTarget: async () => ({ incarnation: "inc" }), authorize: async () => authority })
  const runs = createSfRunStore({ state, requestFor: () => request, revalidate: async () => true, preflight: async () => ({ status: "ok", value: { sourceFence: sfRunSourceFence(storage.state.dashboard) } }), revalidateForCommit: async () => ({ status: "ok", value: true }), now: () => "2026-11-13T00:00:00Z" })
  const fixture = sfRunFixture()
  const run: SfNativeRunRecord = { ...fixture.run, state: "ready", outputRef: fixture.output.id }
  const persistedDigest = digestSfValue({ output: fixture.output, run })
  expect((await state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: "e".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (current) => {
    current.nativeRuns = { run }
    current.contributions[fixture.output.id] = fixture.output
    return { commit: true, value: true }
  })).status).toBe("ok")
  const control = { verifications: 0, mutateAtVerification: 0, mutateAtEgress: false, revokeAtEgress: false, target: "output" as "output" | "run" | "cycle" }
  const retained: { output?: ContributionEnvelope; run?: SfNativeRunRecord } = {}
  const mutate = () => {
    if (!retained.output || !retained.run) throw new Error("Verifier did not receive stored records")
    if (control.target === "output") retained.output.createdAt = "2026-11-14T00:00:00Z"
    if (control.target === "run") retained.run.objective = "Changed after provenance verification"
    if (control.target === "cycle") Object.assign(retained.output, { evidenceRefs: [retained.output] })
  }
  const read = createSfContributionReader({ state, runs, requestFor: () => request, revalidate: async () => {
    if (control.verifications === 2 && control.revokeAtEgress) return false
    if (control.verifications === 2 && control.mutateAtEgress) mutate()
    return true
  }, verify: async (output, record) => {
    control.verifications++
    retained.output = output
    retained.run = record
    if (control.mutateAtVerification === control.verifications) mutate()
    return { status: "ok", value: true }
  } })
  const selection = { outputRef: fixture.output.id, caseRef: fixture.caseRef }
  for (const target of ["output", "run", "cycle"] as const) {
    control.target = target
    for (const phase of [1, 2]) {
      control.verifications = 0
      control.mutateAtVerification = phase
      expect(await read(selection, context)).toEqual({ status: "denied", reason: "contribution-verification-mutated-input" })
      expect(control.verifications).toBe(phase)
    }
    control.mutateAtVerification = 0
    control.verifications = 0
    control.mutateAtEgress = true
    expect(await read(selection, context)).toEqual({ status: "denied", reason: "contribution-verification-mutated-input" })
    expect(control.verifications).toBe(2)
    control.mutateAtEgress = false
  }
  control.verifications = 0
  control.revokeAtEgress = true
  expect(await read(selection, context)).toEqual({ status: "denied", reason: "contribution-access-unavailable" })
  control.revokeAtEgress = false
  control.verifications = 0
  const result = await read(selection, context)
  expect(result.status).toBe("ok")
  if (result.status !== "ok" || !retained.output || !retained.run) throw new Error("Verified contribution was not returned")
  expect(digestSfValue(result.value)).toBe(persistedDigest)
  retained.output.createdAt = "2026-11-15T00:00:00Z"
  retained.run.objective = "Changed after reader returned"
  expect(digestSfValue(result.value)).toBe(persistedDigest)
  expect(await state.read(request, "contributions", (current) => digestSfValue({ output: current.contributions[fixture.output.id], run: current.nativeRuns?.run }))).toMatchObject({ status: "ok", value: persistedDigest })
})

test("real C08 current reader fences verifier aliases and returns private output and run copies", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-current-contribution-"))
  const persistence = await openLocalStore(directory)
  // The records and principal are explicit fixtures; this proves the real C08/SQLite
  // reader boundary, not a provider completion or an installed host consumer.
  const fixture = sfRunFixture()
  const request = new Request("https://example.test/current-contribution")
  const authority = { principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const access = { allowed: true, revokeAtEgress: false }
  const retained: { output?: ContributionEnvelope; runs: SfNativeRunRecord[] } = { runs: [] }
  const fault: { phase?: 1 | 2 | "egress"; target: "output" | "first-run" | "latest-run"; cycle: boolean; verifications: number; mutateIdentity?: () => void } = {
    target: "output", cycle: false, verifications: 0,
  }
  const mutate = () => {
    if (fault.target === "output") {
      if (!retained.output) throw new Error("Verifier did not retain an output")
      if (fault.cycle) Object.assign(retained.output, { evidenceRefs: [retained.output] })
      else {
        retained.output.createdAt = "2026-11-14T00:00:00Z"
        retained.output.outputDigest = digestSfContribution(retained.output)
      }
    } else {
      const run = fault.target === "first-run" ? retained.runs[0] : retained.runs.at(-1)
      if (!run) throw new Error("Verifier did not retain a run")
      if (fault.cycle) Object.assign(run, { reviewTarget: run })
      else run.objective = "changed-by-retained-verifier-alias"
    }
  }
  const reset = () => {
    fault.phase = undefined
    fault.mutateIdentity = undefined
    fault.verifications = 0
    retained.output = undefined
    retained.runs = []
    access.allowed = true
    access.revokeAtEgress = false
  }
  const state = createSfProductState({ persistence, createId: () => "store", resolveTarget: async () => ({ incarnation: "inc" }),
    authorize: async () => access.allowed ? authority : undefined })
  const runs = createSfRunStore({ state, requestFor: () => request, revalidate: async () => access.allowed,
    preflight: async () => {
      const sourceFence = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
      return { status: "ok", value: { sourceFence } }
    },
    revalidateForCommit: async () => ({ status: "ok", value: true }), now: () => "2026-11-13T00:00:00Z" })
  const read = createSfContributionReader({ state, runs, requestFor: () => request,
    revalidate: async () => {
      if (fault.verifications === 2) {
        if (fault.phase === "egress") mutate()
        fault.mutateIdentity?.()
        if (access.revokeAtEgress) access.allowed = false
      }
      return access.allowed
    },
    verify: async (output, run) => {
      retained.output = output
      retained.runs.push(run)
      fault.verifications++
      if (fault.phase === fault.verifications) mutate()
      return { status: "ok", value: true }
    },
  })
  try {
    expect((await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "current-case", commandDigest: "1".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (stored) => {
      stored.cases.case = sfCaseFixture(fixture.caseRef, [authority.principalRef])
      return { commit: true, value: true }
    })).status).toBe("ok")
    const run: SfNativeRunRecord = { ...fixture.run, state: "ready", outputRef: fixture.output.id }
    expect((await state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, idempotencyKey: "current-output", commandDigest: "2".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (stored) => {
      stored.nativeRuns = { [run.runRef]: structuredClone(run) }
      stored.contributions[fixture.output.id] = structuredClone(fixture.output)
      return { commit: true, value: true }
    })).status).toBe("ok")
    const stored = () => state.read(request, "contributions", (current) => ({ run: current.nativeRuns?.[run.runRef], output: current.contributions[fixture.output.id] }))
    const before = await stored()
    if (before.status !== "ok") throw new Error("Current contribution was not persisted")
    const originalDigest = digestSfValue(before.value)
    const selection = { outputRef: fixture.output.id, caseRef: fixture.caseRef }

    for (const phase of [1, 2, "egress"] as const) {
      for (const target of ["output", "first-run", "latest-run"] as const) {
        for (const cycle of [false, true]) {
          reset()
          Object.assign(fault, { phase, target, cycle })
          expect({ phase, target, cycle, result: await read(selection, context) }).toEqual({ phase, target, cycle,
            result: { status: "denied", reason: "contribution-verification-mutated-input" } })
          const after = await stored()
          expect(after.status).toBe("ok")
          if (after.status !== "ok") throw new Error("Current contribution became unavailable")
          expect(after.storageVersion).toBe(before.storageVersion)
          expect(digestSfValue(after.value)).toBe(originalDigest)
        }
      }
    }

    // Real UI/native authority factories freeze binding and lease. These mutable
    // fixture probes prove the reader's additional defense for divergent composition.
    for (const change of [
      { name: "selection", mutate: () => { selection.outputRef = "another-output" }, restore: () => { selection.outputRef = fixture.output.id } },
      { name: "binding-value", mutate: () => Object.assign(authority, { accessRevision: "changed-at-egress" }), restore: () => Object.assign(authority, { accessRevision: "access" }) },
      { name: "binding-identity", mutate: () => Object.assign(context, { binding: { ...authority } }), restore: () => Object.assign(context, { binding: authority }) },
      { name: "lease-identity", mutate: () => Object.assign(context, { lease: {} }), restore: () => Object.assign(context, { lease: undefined }) },
    ]) {
      reset()
      fault.mutateIdentity = change.mutate
      expect({ change: change.name, result: await read(selection, context) }).toEqual({ change: change.name,
        result: { status: "denied", reason: "contribution-read-identity-changed" } })
      change.restore()
    }
    reset()
    access.revokeAtEgress = true
    expect(await read(selection, context)).toEqual({ status: "denied", reason: "contribution-access-unavailable" })
    reset()
    const accepted = await read(selection, context)
    expect(accepted.status).toBe("ok")
    if (accepted.status !== "ok") throw new Error("Unchanged current contribution was refused")
    expect(fault.verifications).toBe(2)
    expect(accepted.value.output).not.toBe(retained.output)
    expect(accepted.value.run).not.toBe(retained.runs[0])
    expect(accepted.value.run).not.toBe(retained.runs[1])
    expect(digestSfValue(accepted.value)).toBe(originalDigest)
    fault.cycle = false
    for (const target of ["output", "first-run", "latest-run"] as const) { fault.target = target; mutate() }
    expect(digestSfValue(accepted.value)).toBe(originalDigest)
    accepted.value.run.objective = "consumer-private-copy"
    accepted.value.output.createdAt = "2026-11-15T00:00:00Z"
    const after = await stored()
    expect(after.status).toBe("ok")
    if (after.status !== "ok") throw new Error("Original current contribution was lost")
    expect(after.storageVersion).toBe(before.storageVersion)
    expect(digestSfValue(after.value)).toBe(originalDigest)
  } finally {
    await persistence.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
