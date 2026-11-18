import { correlateAm04 } from "../../../../../../script/sf2h/proofs/am04/correlate.ts"
import { correlateAm06 } from "../integrated-proofs/am06/correlate.ts"
import type { Am06Observation } from "../integrated-proofs/am06/correlate.ts"
import type { RoutineResultAccess } from "../../../product/routines/result-access.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

/**
 * Read-only hosted/native evidence drivers for M234. No producer is emulated.
 *
 * The AM04 and AM06 correlators already exist. Reuse them rather than fork
 * their oracles. A correct correlation is NOT proof of original GitHub Actions
 * run identity, trusted enterprise principal, model inference, scanner run,
 * Task/Relay execution or independent reviewer attestation. Accordingly this
 * API is intentionally incapable of returning PASS.
 */
export type Proof234State = "NOT_RUN" | "REJECTED" | "CORRELATED_NOT_ATTESTED"
export type Proof234Verdict = {
  state: Proof234State
  findings: readonly string[]
  artifactRef: string | null
}
export type CandidatePin234 = {
  /** Accepted C, as returned by S0 for the exact execution checkout. */
  candidateSha: string
  treeSha: string
  /** Existing test:ci workflow/job IDs must be checked separately via GitHub. */
  workflowRunId: string
  jobId: string
  attempt: number
  artifactSha256: string
  selectors: readonly string[]
}
const sha = (value: unknown) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value)
const digest = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
const object = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null
const missing = (why: string): Proof234Verdict =>
  ({ state: "NOT_RUN", findings: [why], artifactRef: null })
const rejected = (findings: readonly string[]): Proof234Verdict =>
  ({ state: "REJECTED", findings, artifactRef: null })
const validPin = (pin: CandidatePin234) =>
  sha(pin.candidateSha) && sha(pin.treeSha) &&
  /^\d+$/.test(pin.workflowRunId) && /^\d+$/.test(pin.jobId) &&
  Number.isSafeInteger(pin.attempt) && pin.attempt >= 1 &&
  digest(pin.artifactSha256) && pin.selectors.length > 0 &&
  pin.selectors.every((selector) => typeof selector === "string" && selector.length > 0)

/** C12/domain observation is supplied by the real installed-host witness. */
export function inspectHostedAm04(capture: unknown, acceptedC?: CandidatePin234): Proof234Verdict {
  if (!acceptedC) return missing("accepted-C-and-real-test-ci-selection-absent")
  if (!validPin(acceptedC)) return rejected(["invalid-C-or-hosted-run-selection"])
  const run = object(object(capture)?.run)
  if (!run) return missing("original-AM04-observation-artifact-absent")
  if (run.candidateSha !== acceptedC.candidateSha || run.treeSha !== acceptedC.treeSha ||
    run.workflowRunId !== acceptedC.workflowRunId || run.jobId !== acceptedC.jobId ||
    run.attempt !== acceptedC.attempt || run.artifactSha256 !== acceptedC.artifactSha256 ||
    !Array.isArray(run.selectors) || JSON.stringify(run.selectors) !== JSON.stringify(acceptedC.selectors))
    return rejected(["original-observation-does-not-match-accepted-C-and-real-run"])
  const correlated = correlateAm04(capture)
  return correlated.status === "REJECTED"
    ? rejected(correlated.findings)
    : { state: "CORRELATED_NOT_ATTESTED", findings: ["independent-original-GitHub-host-model-domain-witness-still-required"],
      artifactRef: correlated.run }
}

export type Am05HostedObservation = {
  candidateSha: string
  treeSha: string
  source: {
    eventId: string
    sourceRefDigest: string
    sourceIncarnation: string
    committedEventId: string
    receivedEventIdAfterRestart: string
    receivedOriginalRefDigest: string
  }
  ports: {
    boundarySpecifier: string
    emitModuleDigest: string
    readModuleDigest: string
    atlasCommitRevision: number
    postRestartRevision: number
    sourceLedgerRevision: number
    importedSourceDigest: string
  }
  scanner: {
    binaryAbsolutePath: string
    binaryDigest: string
    version: string
    clean: "clean"
    canary: "scanner-blocked"
    timeout: "scanner-unavailable"
    unavailable: "scanner-unavailable"
    appendOnRefusal: number
  }
  durability: {
    committed: boolean
    reopenedDifferentProcess: boolean
    duplicateAppendCount: number
    rollbackAppendCount: number
    recoveredOriginal: boolean
  }
  access: {
    sameProfileDifferentActorsDenied: boolean
    forgedOrMissingOwnerDenied: boolean
    revokedSourceDenied: boolean
    replacementIncarnationDenied: boolean
  }
}

/** Correlation only; this object alone cannot authenticate a scanner or provider. */
export function inspectHostedAm05(value: unknown, acceptedC?: CandidatePin234): Proof234Verdict {
  if (!acceptedC) return missing("accepted-C-and-hosted-AM05-sources-absent")
  if (!validPin(acceptedC)) return rejected(["invalid-C-or-hosted-run-selection"])
  if (!object(value)) return missing("original-AM05-observation-artifact-absent")
  const input = value as Partial<Am05HostedObservation>
  const source = object(input.source)
  const ports = object(input.ports)
  const scanner = object(input.scanner)
  const durable = object(input.durability)
  const access = object(input.access)
  if (!source || !ports || !scanner || !durable || !access)
    return missing("original-AM05-source-ports-scanner-durability-access-observations-incomplete")
  const failures: string[] = []
  if (input.candidateSha !== acceptedC.candidateSha || input.treeSha !== acceptedC.treeSha)
    failures.push("AM05-C-tree-mismatch")
  if (!digest(source.sourceRefDigest) || !digest(ports.importedSourceDigest) ||
    typeof source.sourceIncarnation !== "string" || !source.sourceIncarnation ||
    typeof source.eventId !== "string" || !source.eventId ||
    source.eventId !== source.committedEventId ||
    source.eventId !== source.receivedEventIdAfterRestart ||
    source.sourceRefDigest !== source.receivedOriginalRefDigest)
    failures.push("AM05-original-evidence-or-commit-read-identity-mismatch")
  if (ports.boundarySpecifier !== "@orchestra/atlas-boundary/business-memory-ports" ||
    !digest(ports.emitModuleDigest) || !digest(ports.readModuleDigest) ||
    !Number.isSafeInteger(ports.atlasCommitRevision) ||
    ports.atlasCommitRevision !== ports.postRestartRevision ||
    !Number.isSafeInteger(ports.sourceLedgerRevision))
    failures.push("AM05-Atlas-engine-boundary-or-restart-not-correlated")
  if (typeof scanner.binaryAbsolutePath !== "string" ||
    !scanner.binaryAbsolutePath.startsWith("/") ||
    !digest(scanner.binaryDigest) || typeof scanner.version !== "string" ||
    !scanner.version.trim() || scanner.clean !== "clean" ||
    scanner.canary !== "scanner-blocked" ||
    scanner.timeout !== "scanner-unavailable" ||
    scanner.unavailable !== "scanner-unavailable" ||
    scanner.appendOnRefusal !== 0)
    failures.push("AM05-real-scanner-refusal-not-correlated")
  if (durable.committed !== true || durable.reopenedDifferentProcess !== true ||
    durable.recoveredOriginal !== true || durable.duplicateAppendCount !== 0 ||
    durable.rollbackAppendCount !== 0)
    failures.push("AM05-commit-reopen-or-idempotence-not-correlated")
  if (Object.values(access).some((v) => v !== true))
    failures.push("AM05-actor-owner-revocation-incarnation-guards-not-correlated")
  return failures.length ? rejected(failures) : {
    state: "CORRELATED_NOT_ATTESTED",
    findings: ["real-engine-scanner-process-GitHub-artifact-and-ACL-witnesses-need-independent-verification"],
    artifactRef: acceptedC.workflowRunId,
  }
}

/**
 * The 229 real Task/Relay origin MUST be supplied by the installed host,
 * not constructed from fixture Task rows, a catalog, or a candidate JSON.
 * This driver only reads C07's existing authorized run/result port.
 */
export async function inspectOriginalAm06(input: {
  acceptedC?: CandidatePin234
  context: TrustedDomainContext
  observation: Partial<Am06Observation>
  readOnlyResult: RoutineResultAccess
  /** 229 must provide this from its real native Task/Relay source, not a mock. */
  verifyTaskRelayOrigin?: (
    runRef: string, context: TrustedDomainContext,
  ) => Promise<"verified" | "unavailable" | "rejected">
}): Promise<Proof234Verdict> {
  if (!input.acceptedC) return missing("accepted-C-absent")
  if (!validPin(input.acceptedC)) return rejected(["invalid-C-or-hosted-run-selection"])
  if (!input.verifyTaskRelayOrigin) return missing("229-real-native-Task-Relay-origin-not-consumed")
  if (input.context.kind !== "native") return rejected(["installed-native-context-unavailable"])
  const runRef = input.observation.status?.runRef
  if (!runRef) return missing("original-admitted-C07-runRef-absent")
  const verified = await input.verifyTaskRelayOrigin(runRef, input.context)
  if (verified === "unavailable") return missing("229-native-origin-not-verifiable")
  if (verified !== "verified") return rejected(["229-original-Task-Relay-origin-denied"])
  const opened = await input.readOnlyResult.readResult(runRef, input.context)
  if (opened.status === "unavailable" || opened.status === "needs-input")
    return missing("original-C07-native-result-not-terminal-or-unavailable")
  if (opened.status !== "ok") return rejected(["original-C07-read-denied-or-conflicted"])
  const observed = { ...input.observation, opened: opened.value }
  if (observed.candidateSha !== input.acceptedC.candidateSha)
    return rejected(["AM06-observation-not-from-accepted-C"])
  const result = correlateAm06(observed)
  if (result.state === "NOT_RUN")
    return missing("AM06-hosted-model-skill-Task-C07-UI-witnesses-incomplete:" + result.missing.join(","))
  if (result.state === "REJECTED") return rejected(result.mismatches)
  return { state: "CORRELATED_NOT_ATTESTED",
    findings: ["independent-original-Task-Relay-provider-GitHub-run-and-UI-attestation-required"],
    artifactRef: runRef }
}
