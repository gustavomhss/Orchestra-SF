/**
 * AM03 source-to-run evidence correlation. A structural preflight ONLY:
 * it never authenticates an actor, checks GitHub Actions, grants an operation,
 * or returns a PASS verdict. The independent reviewer must verify original
 * hosted artifacts and accepted C. Component logs are never upgraded to AM03.
 */
export const am03Scenarios = [
  "actor-a", "actor-b", "cache-isolation",
  "wrong-case-direct", "wrong-session-direct", "wrong-installation-direct",
  "wrong-project-direct", "wrong-location-direct", "forged-actor-direct",
  "forged-role-direct", "forged-grant-direct", "outside-grant-direct",
  "revoked-discovery-execution", "revoked-search-detail",
  "revoked-memory", "revoked-source", "revoked-prompt",
  "revoked-bi", "revoked-report", "revoked-link",
  "provider-namesake", "provider-object-replaced", "provider-generation-replaced",
  "restart-old-binding-denied", "restart-new-binding-authenticated",
] as const

export type Am03Scenario = typeof am03Scenarios[number]

export type Am03Observation = Readonly<{
  scenario: Am03Scenario
  candidateSha: string
  candidateTreeSha: string
  ciSnapshotSha: string
  ciRunId: number
  ciRunUrl: string
  sourcePath: string
  sourceBlobSha: string
  evidenceUri: string
  evidenceClass: "native-installed" | "component" | "fixture" | "historical"
  outcome: "ok" | "denied" | "unavailable" | "provider-conflict"
  /** A machine-observed native host admission, not a model-supplied identity. */
  binding: Readonly<{
    authenticatedRequestId: string
    authenticatedBindingId: string
    nativeSessionId: string
    nativeRunId: string
    principalRef: string
    profileId: string
    profileVersion: string
    caseId: string
    caseIncarnation: string
    caseVersion: number
    installationId: string
    projectId: string
    locationId: string
    accessRevision: string
    providerGeneration: number
  }>
  effectiveProvider: string
  effectiveModel: string
  skillSourceDigest: string
  skillLoadedMessageId: string
  bridgeCallId?: string
  domainCallId?: string
  domainPort?: string
  /** Actual scanned-memory source; a mock or always-clean adapter is invalid. */
  scannerBinaryVersion?: string
  scannerResult?: "clean" | "hit" | "could-not-run"
  /** Only private references, never raw source bytes or secret cache keys. */
  privateRefDigests?: readonly string[]
  privateCacheNamespaceDigest?: string
  exposedRecordCount?: number
  discoveryCalls?: number
  handlerCalls?: number
  authorizedAtFirstBoundary?: boolean
  deniedAtFinalBoundary?: boolean
  leakedPayloadBytes: number
  leakedPrivateCount: number
  oldAuthenticatedBindingId?: string
  oldNativeSessionId?: string
  oldAuthenticatedRequestId?: string
  oldProviderGeneration?: number
  providerObjectFingerprint?: string
  priorProviderObjectFingerprint?: string
  priorProviderGeneration?: number
  runtimeInstanceId?: string
  oldRuntimeInstanceId?: string
}>

export type Am03HostedCandidate = Readonly<{
  productCandidateSha: string
  productTreeSha: string
  ciSnapshotSha: string
  ciRunId: number
  ciRunUrl: string
  observations: readonly Am03Observation[]
}>

const sha40 = /^[a-f0-9]{40}$/
const digest64 = /^[a-f0-9]{64}$/
const direct = new Set<Am03Scenario>([
  "wrong-case-direct", "wrong-session-direct", "wrong-installation-direct",
  "wrong-project-direct", "wrong-location-direct", "forged-actor-direct",
  "forged-role-direct", "forged-grant-direct", "outside-grant-direct",
])
const revoked = new Set<Am03Scenario>([
  "revoked-discovery-execution", "revoked-search-detail",
  "revoked-memory", "revoked-source", "revoked-prompt", "revoked-bi",
  "revoked-report", "revoked-link",
])
const blocked = new Set<Am03Scenario>([
  ...direct, ...revoked, "provider-namesake", "provider-object-replaced",
  "provider-generation-replaced", "restart-old-binding-denied",
])

/**
 * Returns only whether a set of independently produced hosted witnesses is
 * structurally correlatable. NOT_RUN is invariant: this code cannot verify
 * the original runner, permission, scanner, model, causal exploit or reviewer.
 */
export function correlateAm03(input: Am03HostedCandidate) {
  const gaps: string[] = []
  if (!sha40.test(input.productCandidateSha) || !sha40.test(input.productTreeSha) ||
    !sha40.test(input.ciSnapshotSha) || !Number.isSafeInteger(input.ciRunId) || input.ciRunId <= 0 ||
    !input.ciRunUrl.startsWith("https://github.com/gustavomhss/Orchestra-SF/actions/runs/" + input.ciRunId))
    gaps.push("hosted-candidate-provenance")

  for (const id of am03Scenarios) {
    const records = input.observations.filter((item) => item.scenario === id)
    if (records.length !== 1) {
      gaps.push("scenario:" + id + ":expected-one-original-witness")
      continue
    }
    const record = records[0]!
    if (record.evidenceClass !== "native-installed") gaps.push("scenario:" + id + ":not-installed-native")
    if (!sha40.test(record.sourceBlobSha) || !record.sourcePath ||
      !record.evidenceUri.startsWith(input.ciRunUrl) ||
      record.candidateSha !== input.productCandidateSha ||
      record.candidateTreeSha !== input.productTreeSha ||
      record.ciSnapshotSha !== input.ciSnapshotSha ||
      record.ciRunId !== input.ciRunId || record.ciRunUrl !== input.ciRunUrl)
      gaps.push("scenario:" + id + ":source-or-run-mismatch")
    const binding = record.binding
    if (!binding) {
      gaps.push("scenario:" + id + ":missing-authenticated-native-binding")
      continue
    }
    if (!binding.authenticatedBindingId || !binding.authenticatedRequestId ||
      !binding.nativeSessionId || !binding.nativeRunId ||
      !binding.principalRef || !binding.profileId || !binding.profileVersion ||
      !binding.caseId || !binding.caseIncarnation || !Number.isSafeInteger(binding.caseVersion) ||
      binding.caseVersion < 1 || !binding.installationId || !binding.projectId || !binding.locationId ||
      !binding.accessRevision || !Number.isSafeInteger(binding.providerGeneration) ||
      !record.effectiveProvider || !record.effectiveModel ||
      !digest64.test(record.skillSourceDigest) || !record.skillLoadedMessageId)
      gaps.push("scenario:" + id + ":missing-authenticated-native-skill-model")
    if (record.leakedPayloadBytes !== 0 || record.leakedPrivateCount !== 0)
      gaps.push("scenario:" + id + ":private-egress")
    if (blocked.has(id) && !["denied", "unavailable", "provider-conflict"].includes(record.outcome))
      gaps.push("scenario:" + id + ":negative-not-refused")
    if (direct.has(id) && (record.discoveryCalls !== 0 || record.handlerCalls !== 0))
      gaps.push("scenario:" + id + ":direct-call-performed-discovery-or-handler")
    if (revoked.has(id) && (record.authorizedAtFirstBoundary !== true ||
      record.deniedAtFinalBoundary !== true))
      gaps.push("scenario:" + id + ":no-causal-revocation-boundary")
    if (id === "provider-namesake" && record.outcome !== "provider-conflict")
      gaps.push("scenario:" + id + ":namesake-not-conflict")
    if ((id === "actor-a" || id === "actor-b") &&
      (record.outcome !== "ok" || !record.bridgeCallId || !record.domainCallId ||
        !record.domainPort || !Number.isSafeInteger(record.exposedRecordCount) ||
        !record.privateCacheNamespaceDigest || !digest64.test(record.privateCacheNamespaceDigest) ||
        !record.privateRefDigests || record.privateRefDigests.length === 0 ||
        record.exposedRecordCount <= 0 ||
        !record.privateRefDigests.every((value) => digest64.test(value))))
      gaps.push("scenario:" + id + ":missing-real-bridge-to-domain-or-cache-correlation")
    if (id === "revoked-memory" && (!record.scannerBinaryVersion || record.scannerResult !== "clean"))
      gaps.push("scenario:" + id + ":real-clean-scanner-not-observed")
    if (id === "provider-object-replaced" &&
      (!record.providerObjectFingerprint || !record.priorProviderObjectFingerprint ||
        record.providerObjectFingerprint === record.priorProviderObjectFingerprint))
      gaps.push("scenario:" + id + ":real-provider-object-change-not-observed")
    if (id === "provider-generation-replaced" &&
      (!Number.isSafeInteger(record.priorProviderGeneration) ||
        record.priorProviderGeneration === record.binding.providerGeneration))
      gaps.push("scenario:" + id + ":real-provider-generation-change-not-observed")
    if (id === "restart-new-binding-authenticated" &&
      (record.outcome !== "ok" || !record.oldAuthenticatedBindingId ||
        !record.oldAuthenticatedRequestId || !record.oldNativeSessionId ||
        !Number.isSafeInteger(record.oldProviderGeneration) ||
        record.binding.authenticatedBindingId === record.oldAuthenticatedBindingId ||
        record.binding.authenticatedRequestId === record.oldAuthenticatedRequestId ||
        record.binding.nativeSessionId === record.oldNativeSessionId ||
        record.binding.providerGeneration === record.oldProviderGeneration ||
        !record.runtimeInstanceId || !record.oldRuntimeInstanceId ||
        record.runtimeInstanceId === record.oldRuntimeInstanceId))
      gaps.push("scenario:" + id + ":no-fresh-post-restart-authentication")
  }

  const a = input.observations.find((item) => item.scenario === "actor-a")
  const b = input.observations.find((item) => item.scenario === "actor-b")
  if (a && b && (
    !a.binding || !b.binding ||
    a.binding.profileId !== b.binding.profileId ||
    a.binding.profileVersion !== b.binding.profileVersion ||
    a.binding.principalRef === b.binding.principalRef ||
    a.binding.nativeSessionId === b.binding.nativeSessionId ||
    a.binding.caseId === b.binding.caseId ||
    a.binding.authenticatedBindingId === b.binding.authenticatedBindingId ||
    a.privateCacheNamespaceDigest === b.privateCacheNamespaceDigest ||
    a.privateRefDigests?.some((digest) => b.privateRefDigests?.includes(digest))
  )) gaps.push("actor-pair:case-principal-session-cache-or-private-refs-crossed")
  const cache = input.observations.find((item) => item.scenario === "cache-isolation")
  if (cache && (!a || !b || cache.outcome !== "denied" ||
    cache.leakedPrivateCount !== 0 || cache.leakedPayloadBytes !== 0))
    gaps.push("scenario:cache-isolation:private-count-or-cache-egress")
  const old = input.observations.find((item) => item.scenario === "restart-old-binding-denied")
  const fresh = input.observations.find((item) => item.scenario === "restart-new-binding-authenticated")
  if (old && fresh && (!old.binding || !fresh.binding ||
    old.binding.authenticatedBindingId !== fresh.oldAuthenticatedBindingId ||
    old.binding.nativeSessionId !== fresh.oldNativeSessionId ||
    old.binding.authenticatedRequestId !== fresh.oldAuthenticatedRequestId ||
    old.binding.providerGeneration !== fresh.oldProviderGeneration))
    gaps.push("restart:old-binding-provenance-does-not-match")
  return {
    status: "NOT_RUN" as const,
    structurallyCorrelatable: gaps.length === 0,
    gaps: [...new Set(gaps)],
    requiredScenarios: am03Scenarios.length,
    providedScenarios: input.observations.length,
    warning: "Structural correlation only. Verify original GitHub Actions artifacts, host-authenticated principal, runtime/model, actual scanner and independent review against accepted C; never infer PASS or exploit.",
  }
}
