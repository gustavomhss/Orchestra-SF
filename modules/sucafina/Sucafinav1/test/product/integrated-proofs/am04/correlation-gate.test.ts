import { expect, test } from "bun:test"
import { correlateAm04 } from "../../../../../../../script/sf2h/proofs/am04/correlate.ts"

/**
 * These intentionally synthetic inputs ONLY test strict rejection by the
 * AM04 evidence correlator. Even a structurally consistent observation is
 * CORRELATABLE_NOT_ATTESTED, never an AM04 positive, a simulated host grant,
 * a model execution, an actual scanner run or a domain effect.
 *
 * Product behavior is exercised by existing WP11/C12/Finance/Procurement
 * tests. Hosted native observation + independent attestation remain mandatory.
 */
function structuralSample() {
  const digest = "a".repeat(64)
  const changed = "b".repeat(64)
  const witnessSha256 = "c".repeat(64)
  const binding = {
    principalRef: "actual-user-id-not-provided",
    installationId: "installation-ref",
    projectId: "project-ref",
    providerGeneration: "generation-1",
    targetIncarnation: "planner-incarnation",
    idempotencyKey: "planner-command-key",
    commandDigest: digest,
    receiptId: "planner-domain-receipt",
    witnessSha256,
  }
  const events: Record<string, unknown>[] = []
  const emit = (phase: string, value: Record<string, unknown> = {}) => {
    events.push({ ...binding, phase, seq: events.length + 1, runStepId: "step-" + (events.length + 1), ...value })
  }
  emit("model-prepared", { actorKind: "model", effectCount: 0 })
  emit("model-apply-denied", { actorKind: "model", outcome: "denied" })
  emit("human-choice", { actorKind: "human", authorization: "human-choice-grant", choiceId: "choice", caseId: "case", caseIncarnation: "case-inc", caseVersion: 1 })
  emit("human-review", { actorKind: "human", authorization: "source-specific-review", reviewDigest: digest })
  emit("human-apply-authorized", { actorKind: "human", authorization: "separate-human-apply-grant", choiceId: "choice", caseId: "case", caseIncarnation: "case-inc", reviewDigest: digest })
  emit("planner-authority-revalidated", { domain: "planner", outcome: "authorized", expectedVersion: 3 })
  emit("planner-domain-committed", {
    domain: "planner", outcome: "applied", domainVersionBefore: 3, domainVersionAfter: 4,
    effectCountBefore: 0, effectCountAfter: 1, caseVersion: 1,
    receiptPersisted: true, domainTransactionId: "planner-atomic-tx", receiptTransactionId: "planner-atomic-tx",
  })
  emit("response-lost-before-case", {
    source: "host-fault-boundary", interruptionPoint: "between-domain-commit-and-case-reconciliation",
    caseVersion: 1, domainVersion: 4, caseReceiptPresent: false,
  })
  emit("new-host-binding", {
    bindingKind: "new-authenticated-request", nativeSessionId: "new-session",
    authenticatedRequestRef: "new-request", modelRunId: "run-real-ref",
  })
  emit("planner-receipt-read", { source: "durable-domain-receipt-store", persisted: true, domainVersion: 4, effectCount: 1 })
  emit("case-reconciled", {
    source: "case-state-CAS", caseVersionBefore: 1, caseVersionAfter: 2,
    domainVersion: 4, effectCount: 1, caseTransactionId: "separate-case-tx",
  })
  emit("same-key-retry", { outcome: "receipt-replayed", domainVersion: 4, effectCount: 1 })
  emit("different-digest-conflict", { outcome: "conflict", commandDigest: changed, domainVersion: 4, effectCount: 1 })
  emit("procurement-authority-revalidated", {
    domain: "procurement", outcome: "authorized", targetIncarnation: "procurement-inc", expectedVersion: 5,
  })
  emit("procurement-denied", {
    domain: "procurement", outcome: "conflict", targetIncarnation: "procurement-inc",
    domainVersionBefore: 5, domainVersionAfter: 5, effectCountBefore: 0, effectCountAfter: 0,
  })
  emit("partial-case-observed", {
    caseState: "partially-applied", changes: ["planner:applied", "procurement:conflict"],
    preservedReceiptId: "planner-domain-receipt", plannerEffectCount: 1, procurementEffectCount: 0,
    globalTransactionClaim: false,
  })
  return {
    schema: "sf2h.am04.hosted-observation.v1",
    run: {
      provider: "github-actions-hosted", workflowRunId: "synthetic-only-not-an-actual-run",
      jobId: "synthetic-job", attempt: 1, sourceSha: "1".repeat(40),
      candidateSha: "2".repeat(40), treeSha: "3".repeat(40),
      artifactSha256: "4".repeat(64), selectors: ["negative-correlator-test"],
    },
    host: {
      runtimeImplementation: "native-runtime-claimed-by-input-not-verified",
      nativeSessionId: "old-session", providerObjectId: "provider-object", providerGeneration: "generation-1",
      installationId: binding.installationId, projectId: binding.projectId,
      principalRef: binding.principalRef, authenticatedRequestRef: "old-request",
      accessRevision: "access-1", hostAuthentication: "Application.authenticate(Request)",
      modelRunId: "run-real-ref", effectiveModelId: "model-reference", loadedSkillId: "skill-ref",
      loadedSkillVersion: "version", loadedSkillDigest: digest, modelOutputDigest: digest,
      modelExecution: "real-native-model", scannerBinaryPath: "/scanner/not-run",
      scannerBinaryDigest: digest, scannerVersion: "version", scannerInvocationId: "not-run",
      scannerResult: "clean",
    },
    events,
  }
}

function event(input: ReturnType<typeof structuralSample>, name: string) {
  const found = input.events.find((entry) => entry.phase === name)
  if (!found) throw new Error("Missing synthetic event")
  return found
}

test("AM04 correlate gate never converts a structurally consistent synthetic trace into PASS", () => {
  const result = correlateAm04(structuralSample())
  expect(result).toMatchObject({ status: "CORRELATABLE_NOT_ATTESTED", findings: [] })
  expect(result.status).not.toBe("PASS")
})

for (const variant of [
  {
    name: "missing real scanner binary",
    mutate: (v: ReturnType<typeof structuralSample>) => { v.host.scannerBinaryDigest = "" },
    finding: "real-native-model-scanner-authentication-not-established",
  },
  {
    name: "mocked model",
    mutate: (v: ReturnType<typeof structuralSample>) => { Object.assign(v.host, { mockModel: true }) },
    finding: "real-native-model-scanner-authentication-not-established",
  },
  {
    name: "model applied without human grant",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "model-apply-denied").outcome = "applied" },
    finding: "model-preparation-not-separated-from-human-choice-review-and-apply",
  },
  {
    name: "browser response lost only after handler return",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "response-lost-before-case").interruptionPoint = "after-handler-return" },
    finding: "lost-response-not-isolated-before-case-reconciliation",
  },
  {
    name: "receipt created in separate transaction",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "planner-domain-committed").receiptTransactionId = "unsafe-separate-tx" },
    finding: "domain-mutation-and-receipt-not-atomically-witnessed",
  },
  {
    name: "two domain effects under one command",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "planner-domain-committed").effectCountAfter = 2 },
    finding: "domain-mutation-and-receipt-not-atomically-witnessed",
  },
  {
    name: "receipt silently changed across restart",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "planner-receipt-read").receiptId = "other-receipt" },
    finding: "receipt-identity-lost-across-recovery",
  },
  {
    name: "retry caused second mutation",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "same-key-retry").effectCount = 2 },
    finding: "retry-receipt-CAS-or-changed-digest-conflict-not-witnessed",
  },
  {
    name: "same key reused with different digest was accepted",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "different-digest-conflict").outcome = "applied" },
    finding: "retry-receipt-CAS-or-changed-digest-conflict-not-witnessed",
  },
  {
    name: "case and domain falsely claimed one global transaction",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "case-reconciled").caseTransactionId = "planner-atomic-tx" },
    finding: "retry-receipt-CAS-or-changed-digest-conflict-not-witnessed",
  },
  {
    name: "unrecognized second domain effect concealed in partial result",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "procurement-denied").effectCountAfter = 1 },
    finding: "per-domain-revalidation-and-partiality-not-witnessed",
  },
  {
    name: "forged principal on receipt lookup",
    mutate: (v: ReturnType<typeof structuralSample>) => { event(v, "planner-receipt-read").principalRef = "different-principal" },
    finding: "event-witness-or-host-binding:planner-receipt-read",
  },
] as const) {
  test("AM04 rejects " + variant.name, () => {
    const capture = structuralSample()
    variant.mutate(capture)
    const verdict = correlateAm04(capture)
    expect(verdict.status).toBe("REJECTED")
    expect(verdict.findings).toContain(variant.finding)
  })
}
