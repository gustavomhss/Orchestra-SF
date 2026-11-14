import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createSfHistoricalContributionReader } from "../../../product/ai/contribution-reader.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import { sfRunFixture } from "./run-fixture.ts"

test("historical contribution survives SQLite reopen and requires current access to case and sources", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-historical-output-"))
  const request = new Request("https://example.test/history")
  const authority = { principalRef: "principal", policyVersion: "policy-current", accessRevision: "access-current" }
  const context = { kind: "ui", binding: authority } as unknown as TrustedDomainContext
  const access = { case: true, source: true, revokeAtSecondVerification: false, verifications: 0, mutateAtVerification: 0, mutateAtEgress: false, cyclicAtVerification: 0 }
  const retained: { output?: ContributionEnvelope } = {}
  const fixture = sfRunFixture()
  const open = async () => {
    const persistence = await openLocalStore(directory)
    const state = createSfProductState({ persistence, createId: () => "store", resolveTarget: async () => ({ incarnation: "inc" }),
      authorize: async () => access.case ? authority : undefined })
    const read = createSfHistoricalContributionReader({ state, requestFor: () => request, revalidate: async () => {
      if (access.mutateAtEgress && access.verifications === 2 && retained.output) retained.output.createdAt = "2026-11-14T00:00:00Z"
      return access.case
    },
      verifyHistorical: async (output) => {
        access.verifications++
        retained.output = output
        if (access.mutateAtVerification === access.verifications) output.createdAt = "2026-11-14T00:00:00Z"
        if (access.cyclicAtVerification === access.verifications) Object.assign(output, { evidenceRefs: [output] })
        if (!access.source || (access.revokeAtSecondVerification && access.verifications % 2 === 0)) return { status: "denied", reason: "source-access-revoked" }
        return { status: "ok", value: true }
      } })
    return { persistence, state, read }
  }
  try {
    const first = await open()
    try {
      expect((await first.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "case", commandDigest: "1".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
        state.cases.case = { ...fixture.caseRef, state: "draft", objective: "Read authorized history", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: [authority.principalRef],
          criteria: [], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
        return { commit: true, value: true }
      })).status).toBe("ok")
      expect((await first.state.transaction(request, { namespace: "contributions", expectedStorageVersion: 0, idempotencyKey: "result", commandDigest: "2".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
        state.nativeRuns = { run: { ...fixture.run, state: "stale", reason: "source-changed", outputRef: fixture.output.id } }
        state.contributions[fixture.output.id] = fixture.output
        return { commit: true, value: true }
      })).status).toBe("ok")
    } finally {
      await first.persistence.dispose()
    }
    const reopened = await open()
    try {
      const selection = { outputRef: fixture.output.id, currentCase: fixture.caseRef }
      const historical = await reopened.read(selection, context)
      expect(historical).toMatchObject({ status: "ok", value: { state: "historical", output: { accessRevision: "access", caseRef: fixture.caseRef } } })
      expect(access.verifications).toBe(2)
      expect(historical.status === "ok" && digestSfValue(historical.value.output)).toBe(digestSfValue(fixture.output))
      const native = { kind: "native", binding: { ...authority, caseId: fixture.caseRef.id, caseIncarnation: fixture.caseRef.incarnation, caseVersion: fixture.caseRef.version } } as unknown as TrustedDomainContext
      const beforeMismatches = access.verifications
      for (const changed of [{ caseId: "another-case" }, { caseIncarnation: "replacement" }, { caseVersion: 2 }]) {
        expect(await reopened.read(selection, { ...native, binding: { ...native.binding, ...changed } } as TrustedDomainContext)).toEqual({ status: "denied", reason: "historical-case-binding-mismatch" })
      }
      expect(access.verifications).toBe(beforeMismatches)
      expect(await reopened.read(selection, native)).toMatchObject({ status: "ok", value: { state: "historical" } })
      access.source = false
      expect(await reopened.read(selection, context)).toEqual({ status: "denied", reason: "source-access-revoked" })
      access.source = true
      access.verifications = 0
      access.revokeAtSecondVerification = true
      expect(await reopened.read(selection, context)).toEqual({ status: "denied", reason: "source-access-revoked" })
      access.revokeAtSecondVerification = false
      for (const phase of [1, 2]) {
        access.verifications = 0
        access.mutateAtVerification = phase
        expect(await reopened.read(selection, context)).toEqual({ status: "denied", reason: "historical-verification-mutated-input" })
      }
      access.mutateAtVerification = 0
      for (const phase of [1, 2]) {
        access.verifications = 0
        access.cyclicAtVerification = phase
        expect(await reopened.read(selection, context)).toEqual({ status: "denied", reason: "historical-verification-mutated-input" })
      }
      access.cyclicAtVerification = 0
      access.verifications = 0
      access.mutateAtEgress = true
      expect(await reopened.read(selection, context)).toEqual({ status: "denied", reason: "historical-verification-mutated-input" })
      access.mutateAtEgress = false
      expect(await reopened.state.read(request, "contributions", (state) => digestSfValue(state.contributions[fixture.output.id]))).toMatchObject({ status: "ok", value: digestSfValue(fixture.output) })
      expect(await reopened.read({ ...selection, currentCase: { ...fixture.caseRef, incarnation: "replacement" } }, context)).toMatchObject({ status: "unavailable" })
      access.case = false
      expect(await reopened.read(selection, context)).toEqual({ status: "denied", reason: "contribution-access-unavailable" })
    } finally {
      await reopened.persistence.dispose()
    }
  } finally {
    await rm(directory, { recursive: true, force: true })
  }
})

