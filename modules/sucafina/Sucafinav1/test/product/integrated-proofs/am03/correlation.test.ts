import { expect, test } from "bun:test"
import { am03Scenarios, correlateAm03 } from "../../../../../../../../script/sf2h/proofs/am03/correlation.ts"
import type { Am03HostedCandidate, Am03Observation } from "../../../../../../../../script/sf2h/proofs/am03/correlation.ts"

// These adversarial objects exercise evidence INTAKE ONLY. They are not auth
// grants, runner artifacts or examples of a completed AM03 witness.
test("AM03 receipt correlation does not promote missing hosted evidence or component logs", () => {
  const candidate: Am03HostedCandidate = {
    productCandidateSha: "a".repeat(40), productTreeSha: "b".repeat(40),
    ciSnapshotSha: "c".repeat(40), ciRunId: 123,
    ciRunUrl: "https://github.com/gustavomhss/Orchestra-SF/actions/runs/123",
    observations: [],
  }
  const absent = correlateAm03(candidate)
  expect(absent.status).toBe("NOT_RUN")
  expect(absent.structurallyCorrelatable).toBe(false)
  expect(absent.requiredScenarios).toBe(am03Scenarios.length)
  expect(absent.gaps).toContain("scenario:actor-a:expected-one-original-witness")
  expect(absent.gaps).toContain("scenario:restart-new-binding-authenticated:expected-one-original-witness")

  const component: Am03Observation = {
    scenario: "actor-a",
    candidateSha: candidate.productCandidateSha, candidateTreeSha: candidate.productTreeSha,
    ciSnapshotSha: candidate.ciSnapshotSha, ciRunId: candidate.ciRunId, ciRunUrl: candidate.ciRunUrl,
    sourcePath: "modules/sucafina/Sucafinav1/test/product/workbench-mcp-closure/public-tools.test.ts",
    sourceBlobSha: "d".repeat(40), evidenceUri: candidate.ciRunUrl + "/artifacts/123",
    evidenceClass: "component", outcome: "ok",
    binding: {
      authenticatedRequestId: "fixture-request", authenticatedBindingId: "fixture-binding",
      nativeSessionId: "fixture-session", nativeRunId: "fixture-run",
      principalRef: "synthetic-finance", profileId: "sf_finance", profileVersion: "1",
      caseId: "fixture-case", caseIncarnation: "fixture-incarnation", caseVersion: 1,
      installationId: "fixture-installation", projectId: "fixture-project",
      locationId: "fixture-location", accessRevision: "fixture-access", providerGeneration: 1,
    },
    effectiveProvider: "not-a-real-provider", effectiveModel: "not-a-real-model",
    skillSourceDigest: "f".repeat(64), skillLoadedMessageId: "synthetic-loaded",
    bridgeCallId: "fixture-bridge", domainCallId: "fixture-domain", domainPort: "Planner",
    privateRefDigests: [], privateCacheNamespaceDigest: "f".repeat(64),
    exposedRecordCount: 0, leakedPayloadBytes: 0, leakedPrivateCount: 0,
  }
  const refused = correlateAm03({ ...candidate, observations: [component] })
  expect(refused.status).toBe("NOT_RUN")
  expect(refused.structurallyCorrelatable).toBe(false)
  expect(refused.gaps).toContain("scenario:actor-a:not-installed-native")
  expect(refused.gaps).toContain("scenario:actor-b:expected-one-original-witness")
})

test("AM03 correlation rejects a falsely authorized direct invocation and an unbound restart", () => {
  const candidate: Am03HostedCandidate = {
    productCandidateSha: "a".repeat(40), productTreeSha: "b".repeat(40),
    ciSnapshotSha: "c".repeat(40), ciRunId: 123,
    ciRunUrl: "https://github.com/gustavomhss/Orchestra-SF/actions/runs/123",
    observations: [],
  }
  const original: Am03Observation = {
    scenario: "outside-grant-direct",
    candidateSha: candidate.productCandidateSha, candidateTreeSha: candidate.productTreeSha,
    ciSnapshotSha: candidate.ciSnapshotSha, ciRunId: candidate.ciRunId, ciRunUrl: candidate.ciRunUrl,
    sourcePath: "test/product/integrated-proofs/am03/provider-generation.test.ts",
    sourceBlobSha: "d".repeat(40), evidenceUri: candidate.ciRunUrl + "/artifacts/124",
    evidenceClass: "native-installed", outcome: "ok",
    binding: {
      authenticatedRequestId: "old-auth", authenticatedBindingId: "old-binding", nativeSessionId: "old-session",
      nativeRunId: "old-run", principalRef: "witness", profileId: "sf_finance", profileVersion: "1",
      caseId: "case", caseIncarnation: "inc", caseVersion: 1, installationId: "i",
      projectId: "p", locationId: "l", accessRevision: "a", providerGeneration: 1,
    },
    effectiveProvider: "provider", effectiveModel: "model", skillSourceDigest: "f".repeat(64),
    skillLoadedMessageId: "real-loaded", leakedPayloadBytes: 2, leakedPrivateCount: 1,
    discoveryCalls: 1, handlerCalls: 1,
  }
  const next = correlateAm03({ ...candidate, observations: [
    original,
    { ...original, scenario: "restart-new-binding-authenticated", outcome: "ok",
      leakedPayloadBytes: 0, leakedPrivateCount: 0,
      oldAuthenticatedBindingId: "old-binding", oldAuthenticatedRequestId: "old-auth",
      oldNativeSessionId: "old-session", oldProviderGeneration: 1 },
  ] })
  expect(next.status).toBe("NOT_RUN")
  expect(next.structurallyCorrelatable).toBe(false)
  expect(next.gaps).toContain("scenario:outside-grant-direct:negative-not-refused")
  expect(next.gaps).toContain("scenario:outside-grant-direct:direct-call-performed-discovery-or-handler")
  expect(next.gaps).toContain("scenario:outside-grant-direct:private-egress")
  expect(next.gaps).toContain("scenario:restart-new-binding-authenticated:no-fresh-post-restart-authentication")
})
