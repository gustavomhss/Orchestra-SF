import { expect, test } from "bun:test"
import { createSfContributionReader } from "../../../product/ai/contribution-reader.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { testPersistence } from "../../fixture/persistence.ts"
import { sfRunFixture } from "./run-fixture.ts"

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
