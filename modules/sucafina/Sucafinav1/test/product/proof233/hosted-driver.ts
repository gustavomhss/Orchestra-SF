import { createHash } from "node:crypto"
import { qualifyAm02, type Am02OperationWitness } from "../../../../../../script/sf2h/proofs/am02/qualify.ts"
import { correlateAm03, type Am03HostedCandidate } from "../../../../../../script/sf2h/proofs/am03/correlation.ts"
import { am01HostedSelectors, loadProof233SourceFixture } from "./source-fixture.ts"

/**
 * Read-only intake of observed hosted CI bytes. Neither a CI dispatcher nor a
 * substitute for the existing original AM01 correlator / AM02 C16 reconciler.
 * It never manufactures or authenticates a provider, principal, receipt or PASS.
 * GitHub MCP run/job/artifact readbacks and independent reviewer still required.
 */
export type HostedRun233 = Readonly<{
  id: number
  url: string
  headSha: string
  candidateSha: string
  sucafinaSubtreeSha: string
  ciRequestSha256: string
  conclusion: string
  selectedFiles: readonly string[]
  log: string
}>
export type HostedInput233 = Readonly<{
  schema: "sf2h.proof233.hosted-input.v1"
  productCandidateSha: string
  productTreeSha: string
  sucafinaSubtreeSha: string
  runs: readonly HostedRun233[]
  am02Witnesses: readonly Am02OperationWitness[]
  am03Candidate: Am03HostedCandidate | null
}>
const sha40 = /^[a-f0-9]{40}$/
const sha64 = /^[a-f0-9]{64}$/
const url = (id: number) => "https://github.com/gustavomhss/Orchestra-SF/actions/runs/" + id

export async function inspectProof233Hosted(input: HostedInput233) {
  const fixture = await loadProof233SourceFixture()
  const gaps: string[] = []
  if (input.schema !== "sf2h.proof233.hosted-input.v1") gaps.push("invalid-hosted-schema")
  if (![input.productCandidateSha, input.productTreeSha, input.sucafinaSubtreeSha].every((value) => sha40.test(value)))
    gaps.push("candidate-C-tree-or-product-subtree-not-observed")
  if (!Array.isArray(input.runs) || input.runs.length === 0) gaps.push("no-original-GitHub-Actions-runs")
  const runs = (Array.isArray(input.runs) ? input.runs : []).map((run) => {
    const valid = Number.isSafeInteger(run.id) && run.id > 0 && run.url === url(run.id) &&
      sha40.test(run.headSha) && run.candidateSha === input.productCandidateSha &&
      run.sucafinaSubtreeSha === input.sucafinaSubtreeSha &&
      sha64.test(run.ciRequestSha256) && run.conclusion === "success" &&
      Array.isArray(run.selectedFiles) && run.selectedFiles.length > 0 &&
      new Set(run.selectedFiles).size === run.selectedFiles.length &&
      run.selectedFiles.every((entry) =>
        /^(Sucafinav1\/test\/product\/)[a-zA-Z0-9/_.-]+\.test\.ts$/.test(entry)) &&
      typeof run.log === "string" && run.log.length > 0
    if (!valid) gaps.push("hosted-run-fields-or-provenance-invalid:" + String(run.id))
    return {
      runId: run.id, url: run.url, snapshotSha: run.headSha,
      selectedFiles: run.selectedFiles, candidateSha: run.candidateSha,
      ciRequestSha256: run.ciRequestSha256,
      logSha256: typeof run.log === "string" ? createHash("sha256").update(run.log).digest("hex") : null,
      shapeAdmitted: valid,
    }
  })
  if (new Set(runs.map((run) => run.runId)).size !== runs.length) gaps.push("duplicate-hosted-run")
  const selected = new Set(runs.filter((run) => run.shapeAdmitted).flatMap((run) => run.selectedFiles))
  const missingAm01Selectors = am01HostedSelectors.filter((file) => !selected.has(file))
  if (missingAm01Selectors.length) gaps.push("AM01-native-selector-coverage-incomplete")

  // Only the ORIGINAL correlator may interpret the WP12 native execution logs:
  // script/sf2h/proofs/am01/correlate-hosted-evidence.ts
  // Its input includes raw logs, not the digests below. Run/job/subtree attestations
  // must first be verified independently via GitHub MCP, never self-declared here.
  const am02 = qualifyAm02(Array.isArray(input.am02Witnesses) ? input.am02Witnesses : [])
  const am03 = input.am03Candidate ? correlateAm03(input.am03Candidate) : null
  if (!Array.isArray(input.am02Witnesses)) gaps.push("AM02-witnesses-not-array")
  if (input.am03Candidate && (input.am03Candidate.productCandidateSha !== input.productCandidateSha ||
      input.am03Candidate.productTreeSha !== input.productTreeSha))
    gaps.push("AM03-witness-targets-another-candidate")

  return {
    schema: "sf2h.proof233.read-only-preflight.v1" as const,
    status: "NOT_RUN" as const, GLOBAL_RELEASE: false, productCandidateSha: input.productCandidateSha,
    originalSource: { manifestDigest: fixture.manifestDigest, profiles: fixture.profiles.length,
      skills: fixture.skills.length, routes: fixture.routes.length, packs: fixture.packs.length,
      am03Scenarios: fixture.scenarios.length, status: "SOURCE_INSPECTED_NOT_NATIVE_PROOF" as const },
    hosted: { status: "NOT_RUN" as const, runs, gaps: [...new Set(gaps)],
      verifiedAgainstGitHubActionsByThisDriver: false },
    AM01: { status: "NOT_RUN" as const, sources: fixture.assignments,
      missingSelectors: missingAm01Selectors,
      canonicalCorrelator: "script/sf2h/proofs/am01/correlate-hosted-evidence.ts",
      positiveNativeModelAndConsumedOutputs: "NOT_PROVEN" as const },
    AM02: { status: "NOT_RUN" as const, eightPackThirtyNine: fixture.routes,
      structuralQualification: am02.status, qualificationRows: am02.rows,
      originalReconciler: "script/sf2h/proofs/am02/reconcile-hosted-traces.ts",
      observedSameCaseUiAgentSdkMcp: "NOT_PROVEN" as const },
    AM03: { status: "NOT_RUN" as const, requiredScenarios: fixture.scenarios,
      sourceToRunCorrelation: am03, installedF04AuthorityAndRestart: "NOT_PROVEN" as const },
    admissionRule: "Authentic GH MCP readbacks + accepted C + actual installed host and provider + owner independent review are mandatory; no catalog, fixture, screenshot or structural equality is PASS.",
  }
}

// A caller may create the original AM01 correlator's exact shape only from
// independently verified real Actions observations. This helper never runs it.
export function asOriginalAm01CorrelatorInput(input: HostedInput233) {
  return {
    schema: "sf2h.am01.hosted-input.v2" as const,
    candidateSha: input.productCandidateSha, candidateTreeSha: input.productTreeSha,
    sucafinaSubtreeSha: input.sucafinaSubtreeSha,
    runs: input.runs.map((run) => ({
      id: run.id, url: run.url, headSha: run.headSha,
      candidateSha: run.candidateSha, sucafinaSubtreeSha: run.sucafinaSubtreeSha,
      ciRequestSha256: run.ciRequestSha256, conclusion: run.conclusion,
      selectedFiles: [...run.selectedFiles], log: run.log,
    })),
  }
}
