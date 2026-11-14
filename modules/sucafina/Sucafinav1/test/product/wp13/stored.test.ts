import { expect, test } from "bun:test"
import { digestSfContribution } from "../../../product/contracts/canonical.ts"
import { createStoredPortfolioReader } from "../../../product/portfolio/stored.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCasePort } from "../../../product/contracts/ports.ts"
import type { ContributionEnvelope, SkillLoadReceipt } from "../../../product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../../../product/contracts/state.ts"

const context = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy" }, lease: {} } as unknown as TrustedDomainContext
const receipt: SkillLoadReceipt = { runId: "run", nativeSessionId: "session", profileId: "sf_portfolio", profileVersion: "1", profileDigest: "a", skillId: "skill", skillVersion: "1", sourceDigest: "b", instructionsDigest: "c", loadedMessageId: "message", loadedAt: "2026-11-13T00:00:00Z", manifestDigest: "d" }
const caseRef = { id: "case", incarnation: "inc", version: 1 }
const output: ContributionEnvelope = { id: "persisted-output", caseRef, schemaVersion: "sf-contribution-v1", evidenceRefs: [], runProvenance: { ...receipt, actualModel: "model", contextFingerprint: "fingerprint" }, accessRevision: "access", createdAt: "2026-11-13T00:00:00Z", outputDigest: "", kind: "PortfolioComparison", state: "ready", payload: { combinations: [], limitations: [], evidenceRefs: [] } }
output.outputDigest = digestSfContribution(output)
const run = { runRef: "run", state: "ready", outputRef: output.id, principalRef: "principal", accessRevision: "access", policyVersion: "policy", caseRef, contextFingerprint: "fingerprint", native: { sessionID: "session", skillReceipt: receipt } } as unknown as SfNativeRunRecord
const evidence = { context: async () => [] } as unknown as BusinessContextService
const cases = { read: async () => ({ status: "ok", value: { case: { version: 1 } } }) } as unknown as DecisionCasePort

test("reads an existing bound contribution and denies a revoked portfolio", async () => {
  const allowed = { current: true }
  const state = { read: async (_request: Request, _namespace: string, read: (state: unknown, authority: unknown) => unknown) => ({ status: "ok", value: await read({ contributions: { [output.id]: output }, nativeRuns: { run } }, { principalRef: "principal", accessRevision: "access", policyVersion: "policy" }) }) } as unknown as SfProductStatePort
  const read = createStoredPortfolioReader({ state, cases, evidence, requestFor: () => new Request("https://example.test"), revalidate: async () => allowed.current, revalidatePortfolio: async () => allowed.current })
  const result = await read(output.id, context)
  expect(result.status).toBe("ok")
  if (result.status === "ok") expect(result.value.portfolioResultRef).toBe(output.id)
  allowed.current = false
  expect(await read(output.id, context)).toEqual({ status: "denied", reason: "portfolio-access-unavailable" })
  expect((await read("invented-ref", context)).status).toBe("denied")
})

test("reports an unavailable store instead of exposing an error", async () => {
  const state = { read: async () => { throw new Error("private store detail") } } as unknown as SfProductStatePort
  const read = createStoredPortfolioReader({ state, cases, evidence, requestFor: () => new Request("https://example.test"), revalidate: async () => true, revalidatePortfolio: async () => true })
  expect(await read(output.id, context)).toEqual({ status: "unavailable", reason: "portfolio-state-unavailable" })
})

test("does not return persisted payload when source access changes during read", async () => {
  const state = { read: async (_request: Request, _namespace: string, read: (state: unknown, authority: unknown) => unknown) => ({ status: "ok", value: await read({ contributions: { [output.id]: output }, nativeRuns: { run } }, { principalRef: "principal", accessRevision: "access", policyVersion: "policy" }) }) } as unknown as SfProductStatePort
  const checks = { n: 0 }
  const read = createStoredPortfolioReader({ state, cases, evidence, requestFor: () => new Request("https://example.test"), revalidate: async () => true, revalidatePortfolio: async () => ++checks.n === 1 })
  expect(await read(output.id, context)).toEqual({ status: "stale", reason: "portfolio-source-or-authority-changed" })
})
