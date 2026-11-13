import type { SfHostServices } from "../contracts/host-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { DecisionCritiqueInput } from "../contracts/skill-inputs.ts"
import { digestSfContribution, digestSfValue } from "../contracts/canonical.ts"
import { decodeSfContributionEnvelope, decodeSfSkillInput } from "../contracts/schema-admission.ts"
import type { SfAnalysisRequest } from "./analysis-input-port.ts"
import { readCaseAnalysisProjection } from "./case-analysis-input.ts"

type AuthorTarget = DecisionCritiqueInput["authorAnalysis"]
type ReviewReadServices = Pick<SfHostServices, "ui" | "human" | "analyses" | "dispatch">

/** Read the saved author through a separate human read admission. No identity or
 * native receipt is accepted from the browser, or returned in a review offer. */
async function readAuthor(request: Request, runtime: ReviewReadServices, caseRef: SfAnalysisRequest["caseRef"], target: AuthorTarget) {
  const analyses = runtime.analyses
  if (!analyses) return { status: "unavailable", reason: "author-analysis-unavailable" } as const
  const admitted = await runtime.human.admit(request, "analysis.read", { runRef: target.runRef })
  if (admitted.status !== "ok") return admitted
  try {
    const found = await analyses.read(admitted.value, target.runRef)
    if (found.status !== "ok") return found
    const result = await analyses.output(admitted.value, target.runRef)
    if (result.status !== "ok") return result
    const run = found.value
    const decoded = decodeSfContributionEnvelope(result.value)
    const binding = admitted.value.binding
    if (run.state !== "ready" || !run.native || run.runRef !== target.runRef || !run.outputRef ||
      run.principalRef !== binding.principalRef || run.accessRevision !== binding.accessRevision || run.policyVersion !== binding.policyVersion ||
      digestSfValue(run.caseRef) !== digestSfValue(caseRef) || !decoded.ok || decoded.value.state !== "ready")
      return { status: "unavailable", reason: "author-analysis-unavailable" } as const
    const output = decoded.value
    const receipt = run.native.skillReceipt
    const provenance = output.runProvenance
    if (output.id !== run.outputRef || digestSfValue(output.caseRef) !== digestSfValue(caseRef) ||
      output.outputDigest !== target.outputDigest || digestSfContribution(output) !== target.outputDigest ||
      output.accessRevision !== run.accessRevision || provenance.runId !== run.runRef ||
      provenance.nativeSessionId !== run.native.sessionID || provenance.contextFingerprint !== run.contextFingerprint ||
      provenance.actualModel !== `${run.model.providerID}/${run.model.id}` ||
      digestSfValue(Object.fromEntries(Object.keys(receipt).map((key) => [key, provenance[key as keyof typeof receipt]]))) !== digestSfValue(receipt))
      return { status: "unavailable", reason: "author-analysis-invalid" } as const
    const comparison = output.kind === "ScenarioComparison" ? output.payload : output.kind === "FinancialAnalysis" ? output.payload.comparison : undefined
    if (!comparison) return { status: "needs-input", reason: "author-comparison-unavailable" } as const
    if (!await runtime.human.authorize(admitted.value, "analysis.read", { runRef: target.runRef }))
      return { status: "denied", reason: "author-access-changed" } as const
    return { status: "ok", value: { run, output, comparison, context: {
      installationId: binding.installationId, projectId: binding.projectId, principalRef: binding.principalRef,
      accessRevision: binding.accessRevision, policyVersion: binding.policyVersion,
    } } } as const
  } finally { runtime.human.finish(admitted.value) }
}

/** Assemble only the current case and its real, ready author contribution. The
 * native start verifier independently replays the comparison, resolves evidence,
 * and enforces a reviewer run/session distinct from the author's. */
export async function prepareReviewAnalysisInput(request: Request, runtime: ReviewReadServices, input: {
  request: SfAnalysisRequest; selection: Record<string, unknown>
}): Promise<PortResult<DecisionCritiqueInput>> {
  const wanted = structuredClone(input)
  if (wanted.request.profileId !== "sf_reviewer" || wanted.request.skillId !== "sf-contestar-decisao")
    return { status: "denied", reason: "review-profile-unavailable" }
  const target = wanted.selection.authorAnalysis
  if (Object.keys(wanted.selection).some((key) => key !== "authorAnalysis") || !isAuthorTarget(target))
    return { status: "needs-input", reason: "review-selection-invalid" }
  const current = await readCaseAnalysisProjection(request, runtime, wanted.request.caseRef)
  if (current.status !== "ok") return current
  const author = await readAuthor(request, runtime, wanted.request.caseRef, target)
  if (author.status !== "ok") return author
  const caseContext = current.value.context
  if (caseContext.kind !== "ui" || digestSfValue(author.value.context) !== digestSfValue({
    installationId: caseContext.installationId, projectId: caseContext.projectId, principalRef: caseContext.principalRef,
    accessRevision: caseContext.accessRevision, policyVersion: caseContext.policyVersion,
  }))
    return { status: "denied", reason: "review-access-changed" }
  const domain = current.value.case
  const alternativeRefs = domain.alternatives.map((alternative) => alternative.id)
  if (!alternativeRefs.length || new Set(alternativeRefs).size !== alternativeRefs.length)
    return { status: "needs-input", reason: "review-alternatives-unavailable" }
  const comparison = author.value.comparison
  const value: DecisionCritiqueInput = {
    alternativeRefs,
    choiceRefs: domain.choices.filter((choice) => alternativeRefs.includes(choice.alternativeId) &&
      digestSfValue(choice.comparison) === digestSfValue(comparison)).map((choice) => choice.id),
    comparison,
    authorAnalysis: target,
    authorizedEvidenceRefs: current.value.evidenceRefs,
  }
  if (!decodeSfSkillInput("DecisionCritiqueInput", value).ok) return { status: "unavailable", reason: "review-input-invalid" }
  const again = await readCaseAnalysisProjection(request, runtime, wanted.request.caseRef)
  if (again.status !== "ok") return again
  const authorAgain = await readAuthor(request, runtime, wanted.request.caseRef, target)
  if (authorAgain.status !== "ok") return authorAgain
  if (digestSfValue({ case: again.value.case, refs: again.value.evidenceRefs, context: again.value.context }) !==
    digestSfValue({ case: domain, refs: current.value.evidenceRefs, context: current.value.context }) ||
    digestSfValue(authorAgain.value) !== digestSfValue(author.value))
    return { status: "stale", reason: "review-sources-changed" }
  return { status: "ok", value: structuredClone(value) }
}

/** Optional action on an opened result. An absent offer is not a claim that a
 * reviewer or model exists. Preparation always repeats these reads on submit. */
export async function reviewAnalysisOffer(request: Request, runtime: SfHostServices, runRef: string, output: ContributionEnvelope) {
  if (output.state !== "ready" || output.runProvenance.runId !== runRef || !["ScenarioComparison", "FinancialAnalysis"].includes(output.kind)) return undefined
  const parent = runtime.selected.find((item) => item.profile.id === "sf_reviewer" && item.skills.some((skill) => skill.id === "sf-contestar-decisao"))
  const skill = parent?.skills.find((item) => item.id === "sf-contestar-decisao")
  const model = (await runtime.models().catch(() => []))[0]
  if (!parent || !skill || !model) return undefined
  const current = await readCaseAnalysisProjection(request, runtime, output.caseRef)
  if (current.status !== "ok") return undefined
  const reviewRequest: SfAnalysisRequest = {
    caseRef: output.caseRef, objective: current.value.case.objective, profileId: parent.profile.id, profileVersion: parent.profile.version,
    skillId: skill.id, skillVersion: skill.version, manifestDigest: parent.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
    requestedOperationScope: skill.allowedOperations.filter((operation) => parent.operationIds.includes(operation)),
  }
  const authorAnalysis = { runRef: output.runProvenance.runId, outputDigest: output.outputDigest }
  const input = { request: reviewRequest, selection: { authorAnalysis } }
  const admitted = await runtime.human.admit(request, "analysis.start", input)
  if (admitted.status !== "ok") return undefined
  try {
    const prepared = await prepareReviewAnalysisInput(request, runtime, input)
    if (prepared.status !== "ok" || !await runtime.human.authorize(admitted.value, "analysis.start", input)) return undefined
    return { request: reviewRequest, model, authorAnalysis }
  } finally { runtime.human.finish(admitted.value) }
}

function isAuthorTarget(value: unknown): value is AuthorTarget {
  return !!value && typeof value === "object" && !Array.isArray(value) &&
    Object.keys(value).every((key) => key === "runRef" || key === "outputDigest") &&
    "runRef" in value && typeof value.runRef === "string" && !!value.runRef.trim() &&
    "outputDigest" in value && typeof value.outputDigest === "string" && /^[a-f0-9]{64}$/.test(value.outputDigest)
}
