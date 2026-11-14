import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import { esc } from "../../src/screen-shell.ts"

const list = (items: readonly string[]) => items.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "<p>None recorded.</p>"
export type ContributionRenderOptions = { mount: string }

/** The verifier binds these source refs to the selected C04 target. Ambiguous surfaces
 * cannot select a destination; the workbench revalidates the current manifest on open. */
function importPreview(reference: string, refs: readonly BusinessEvidenceRef[], options?: ContributionRenderOptions): string {
  const label = "<p>Import preview; not applied.</p>"
  const surfaces = new Set(refs.flatMap((ref) => ref.kind === "record" ? [ref.target.surface] : []))
  if (surfaces.size !== 1) return label
  const surface = [...surfaces][0]
  if (surface !== "planner" && surface !== "dashboard") return label
  const mount = options?.mount
  if (mount !== undefined && mount !== "" && (!mount.startsWith("/") || mount.startsWith("//") || /[\\?#]/.test(mount))) return label
  const base = mount === undefined ? "" : `${mount.replace(/\/+$/, "")}/`
  const href = `${base}${surface}?${new URLSearchParams({ sf: "imports", importPreviewRef: reference })}`
  return `${label}<p><a href="${esc(href)}" data-import-preview-link>Open import preview</a></p>`
}

/** Display persisted outputs without deriving financial values or granting actions. */
export function contributionBody(output: ContributionEnvelope, options?: ContributionRenderOptions): string {
  if (output.state !== "ready") return ""
  switch (output.kind) {
    case "IntentFrame": return `<p>${esc(output.payload.objective)} · ${esc(output.payload.horizon.start)} – ${esc(output.payload.horizon.end)} · ${esc(output.payload.currency)}</p>${output.payload.analysisBasis === "import-preview" ? importPreview(output.payload.importPreviewRef, output.payload.sourceRefs, options) : ""}<p>Criteria</p>${list(output.payload.criteria.map((criterion) => `${criterion.description}${criterion.required ? " (required)" : ""}`))}${list(output.payload.gaps.map((gap) => gap.reason))}`
    case "AnalysisPlan": return `<p>${esc(output.payload.objective)}</p>${list(output.payload.steps.map((step) => step.expectedOutputTypes.join(", ")))}${list(output.payload.gaps.map((gap) => gap.reason))}`
    case "DecisionBrief": return `<p>${esc(output.payload.objective)}</p>${list(output.payload.conditions.map((item) => item.reason))}`
    case "QuestionProposal": return `<p>${esc(output.payload.question)}</p><p>${output.payload.recipientRef ? `Recipient: ${esc(output.payload.recipientRef)}` : "Recipient not selected"}</p>`
    case "FinancialAnalysis": return `<p>${esc(output.payload.explanation)}</p><p>Comparison: ${esc(output.payload.comparison.comparisonStatus)} · Known difference: ${output.payload.knownDifference ?? "Unavailable"}</p>${output.payload.analysisBasis === "import-preview" ? importPreview(output.payload.importPreviewRef, output.payload.sourceRefs, options) : ""}${list(output.payload.gaps)}`
    case "ScenarioComparison": return `<p>Comparison: ${esc(output.payload.comparisonStatus)} · ${output.payload.comparisonStatus === "complete" ? "Difference" : "Known difference"}: ${output.payload.knownDifference ?? "Unavailable"}</p>${list(output.payload.unresolvedConditions)}`
    case "SensitivityResult": return `<p>Comparison: ${esc(output.payload.comparisonStatus)} · ${output.payload.thresholdEvidence.state === "exact" ? `Threshold: ${output.payload.thresholdEvidence.value}` : output.payload.thresholdEvidence.state === "sampled" ? `Sampled interval: ${output.payload.thresholdEvidence.interval.minimum} – ${output.payload.thresholdEvidence.interval.maximum}` : `Threshold unavailable: ${esc(output.payload.thresholdEvidence.reason)}`} ${esc(output.payload.unit)}</p>${list(output.payload.evaluated.map((point) => `${point.parameterValue}: ${point.value ?? "Unavailable"}`))}${list(output.payload.unresolvedConditions.map((item) => item.reason))}`
    case "CommercialComparison": return list(output.payload.proposals.map((item) => `${item.proposalRef}: ${item.eligible ? "eligible" : "ineligible"}; ${item.convertedAmount ?? "amount unavailable"} ${output.payload.currency}; ${item.issues.join(", ")}`)) + list(output.payload.conditions.map((item) => item.reason))
    case "CommercialGap": return `<p>${esc(output.payload.field)}: ${esc(output.payload.issue)}</p><p>${esc(output.payload.question)}</p>`
    case "EvidenceCandidate": return `<p>${esc(String(output.payload.value ?? "Unavailable"))} ${esc(output.payload.unit ?? "")} · ${esc(output.payload.state)}</p>`
    case "PreparedChangeSet": return list(output.payload.changes.map((item) => `${item.changeRef} · expected version ${item.expectedVersion} · ${item.requiredAuthority.join(", ")}`)) + list(output.payload.conditions.map((item) => item.reason))
    case "DossierDraft": return `<p>Preparation only; not applied.</p>${list(output.payload.alternatives)}${list(output.payload.gaps)}`
    case "DeliveryAssessment": return list(output.payload.dependencies.map((item) => `${item.fromRef} → ${item.toRef}: ${item.state}`)) + list(output.payload.unresolvedConditions.map((item) => item.reason))
    case "DependencyConflict": return `<p>${esc(output.payload.fromRef)} → ${esc(output.payload.toRef)} · ${esc(output.payload.state)}</p><p>${esc(output.payload.reason)}</p>`
    case "PortfolioComparison": return list(output.payload.combinations.map((item) => `${item.id}: ${item.eligibility} · ${item.comparisonStatus}; ${item.restrictions.join(", ")}`)) + list(output.payload.limitations)
    case "ReconsiderationProposal": return `<p>Original choice remains recorded.</p>${list(output.payload.impacts.map((item) => `${item.state}: ${item.reason}`))}`
    case "CritiqueReport": return list(output.payload.claimIssues.map((item) => `${item.kind}: ${item.reason}`)) + list(output.payload.unresolvedConditions.map((item) => item.reason))
    case "UnresolvedCondition": return `<p>${esc(output.payload.category)}: ${esc(output.payload.reason)}</p>`
    case "ClaimIssue": return `<p>${esc(output.payload.kind)}: ${esc(output.payload.reason)}</p>`
    case "DocumentEvidence": return `<p>${esc(output.payload.fieldCandidate)}: ${esc(String(output.payload.value ?? "Unavailable"))} ${esc(output.payload.unit ?? "")} · ${esc(output.payload.status)}</p><p>${esc(output.payload.location)}</p>`
    case "ContextualBIProposal": return `<p>View: ${esc(output.payload.approvedViewId)} · Table: ${esc(output.payload.tableRef)}</p>`
    case "MeetingMaterialProposal": return list(output.payload.coverage.map((item) => `${item.sectionRef}: ${item.includedCount}/${item.totalCount}`)) + list(output.payload.gaps.map((item) => item.reason))
    case "CaseRecall": return list(output.payload.matches.map((item) => `${item.caseRef.id}: ${item.explanation.matchedCriteria.join(", ")}; ${item.explanation.currentDifferences.join(", ")}`)) + list(output.payload.limitations)
    case "MatchExplanation": return list(output.payload.matchedCriteria) + list(output.payload.currentDifferences) + list(output.payload.limitations)
  }
}
