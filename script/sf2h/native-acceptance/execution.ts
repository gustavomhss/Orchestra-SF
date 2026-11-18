import { object, requireSha, text } from "./schema.ts"
import type { PreparedPlan } from "./schema.ts"
import type { createInstalledSfProofAdapter, SfWorkbenchAnalysisRequest } from "./installed-host.ts"

export type CandidateAdmission = {
  candidateC: string
  candidateTree: string
  accepted: true
  acceptedBy: "S0"
  acceptanceEvidenceRef: string
}

/** An in-memory verifier owned by S0 resolves the actual acceptance record.
 * A --accepted flag, a saved capture or a collection of branch heads cannot
 * supply this function. This is a launch gate; product authority stays in C16. */
export type CandidateVerifier = (candidateC: string) => Promise<CandidateAdmission | undefined>

export async function requireExecutionGate(input: {
  plan: PreparedPlan
  installedCommit: string
  installedTree: string
  mode: "preproof" | "final"
  verifyAcceptedCandidate?: CandidateVerifier
}) {
  const commit = requireSha(input.installedCommit, "installedCommit")
  const tree = requireSha(input.installedTree, "installedTree")
  if (!input.plan.candidateC || input.plan.candidateC !== commit) throw new Error("Installed product does not match the plan's candidate C")
  if (input.mode === "preproof") return { mode: input.mode, candidateC: commit, candidateTree: tree, finalAccepted: false as const }
  if (input.mode !== "final") throw new Error("Invalid execution mode")
  if (!input.verifyAcceptedCandidate) throw new Error("NEEDS_HOST: verify accepted C; resource=S0 acceptance record; owner=S0")
  const verified = await input.verifyAcceptedCandidate(commit)
  if (!verified || verified.accepted !== true || verified.acceptedBy !== "S0" || verified.candidateC !== commit || verified.candidateTree !== tree)
    throw new Error("NEEDS_HOST: no accepted C matching the installed commit/tree; owner=S0")
  text(verified.acceptanceEvidenceRef, "acceptanceEvidenceRef")
  return { mode: input.mode, candidateC: commit, candidateTree: tree, finalAccepted: false as const,
    candidateAcceptanceRef: verified.acceptanceEvidenceRef }
}

/** Finite, one-request execution through the actual installed route. No worker,
 * scheduler, retry, provider fallback or hidden inference loop is created.
 * Ready HTTP output still needs native observation + downstream reload evidence. */
export async function executePreparedAnalysisRequest(input: {
  gate: Parameters<typeof requireExecutionGate>[0]
  adapter: ReturnType<typeof createInstalledSfProofAdapter>
  request: SfWorkbenchAnalysisRequest
}) {
  const gate = await requireExecutionGate(input.gate)
  const response = await input.adapter.callWorkbenchAnalysis(input.request)
  const result: unknown = await response.json()
  const body = object(result, "installed response")
  return { gate, action: input.request.action, httpStatus: response.status,
    status: body.status === "ok" && response.ok ? "OBSERVED_REQUIRES_NATIVE_CAPTURE" : "OBSERVED_NON_SUCCESS",
    nativeAccepted: false as const, body }
}

/** Metadata-only execution skeleton. All payloads are resolved by choices/UI or
 * the authenticated host; source definitions are never used as fabricated data. */
export function captureTemplate(plan: PreparedPlan) {
  return { schema: "sf2h-native-capture-v1", testedCommit: plan.candidateC, testedTree: null,
    mode: "preproof", coverageDigest: plan.coverageDigest,
    proofReceipts: Object.entries(plan.requiredReceiptFields).map(([proofId, fields]) => ({ proofId,
      ...Object.fromEntries(fields.map((field) => [field, null])), evidenceRefs: [] })),
    checkResults: plan.checks.map((check) => ({ checkId: check.id, proofId: check.proofId, testedCommit: plan.candidateC,
      expected: check.expected, status: "NOT_RUN", matched: false, observed: null, evidenceRefs: [] })),
    skillExecutions: [], operationParity: [], independentReviews: [],
    campaignEvidence: Object.keys(plan.requiredReceiptFields).map((proofId) => ({
      ...Object.fromEntries(plan.campaignEvidenceFields.map((field) => [field, null])),
      proofId, scope: "integrated", status: "NOT_RUN", evidenceRefs: [],
    })),
    campaignEvidenceFields: plan.campaignEvidenceFields,
    warning: "Unresolved input template. It is not a receipt and cannot authorize execution or pass capture validation." }
}
