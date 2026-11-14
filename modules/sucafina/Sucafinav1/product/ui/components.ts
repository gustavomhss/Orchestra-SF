import type { ProductContext, RoutineResult } from "../contracts/context.ts"
import type { ScenarioResult, ScenarioComparison } from "../contracts/decisions.ts"
import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import type { AuthorizedCaseProjection } from "../contracts/business-context.ts"
import type { AuthorizedWorkList } from "../contracts/outputs.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import { esc } from "../../src/screen-shell.ts"
import { contributionBody } from "./contribution-body.ts"

/** Render only a context already filtered by the host for the current principal. */
export function contextBar(context: ProductContext, version: number): string {
  const modules = { dashboard: "Dashboard", planner: "Budget Planner", procurement: "Procurement" }
  const scope = context.sourceRefs.map((ref) => `${ref.type} ${ref.id} · version ${ref.version}`).join("; ")
  return `<section class="product-context" aria-label="Work context"><span>${modules[context.surface]}</span><span>Period: ${esc(context.period.start)} – ${esc(context.period.end)}</span><span>Version: ${version}</span><span>Currency: ${esc(context.currency)}</span><span>Scope: ${scope ? esc(scope) : "Current authorized selection"}</span></section>`
}

export function workState(state: "loading" | "empty" | "saving" | "saved" | "error" | "conflict" | "readonly", detail: string): string {
  const labels = { loading: "Loading", empty: "Nothing to show", saving: "Saving", saved: "Saved", error: "Could not save", conflict: "Changed by another user", readonly: "Read only" }
  return `<p class="product-state" role="status"><strong>${labels[state]}</strong>${detail ? ` · ${esc(detail)}` : ""}</p>`
}

/** Work items are projections of canonical records, never a separate task ledger. */
export function workList(work: AuthorizedWorkList): string {
  if (!work.items.length) return workState("empty", "No work is currently assigned in this selection.")
  return `<section aria-label="My work"><h2>My work</h2><ul>${work.items.map((item) => `<li><strong>${esc(item.actionRef)}</strong> · ${esc(item.state)} · ${esc(item.ownerRef)}</li>`).join("")}</ul></section>`
}

export function routineStatus(routine: RoutineResult): string {
  return `<section class="product-state" aria-label="Routine status"><h3>Routine</h3><p role="status">${esc(routine.admission)}</p>${routine.admission === "admitted" ? `<p>Admission ${esc(routine.admissionRef)} · version ${routine.admissionVersion}</p>` : ""}${routine.runRef ? `<p>Run: ${esc(routine.runRef)}</p>` : ""}${routine.resultRef ? `<p>Result: ${esc(routine.resultRef)}</p>` : ""}${routine.pending.length ? `<ul>${routine.pending.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : ""}</section>`
}

/** Values and coverage come from the same domain result; no totals are calculated here. */
export function scenario(result: ScenarioResult, comparison?: ScenarioComparison): string {
  const coverage = result.costCoverage
  const pending = coverage.entries.flatMap((entry) => entry.status === "pending" ? [entry] : [])
  const gaps = [...new Set([...result.unresolvedConditions, ...(comparison?.unresolvedConditions ?? []), ...coverage.issues])]
  const amount = result.comparisonStatus === "complete" ? result.total : result.knownSubtotal
  const status = comparison?.comparisonStatus ?? result.comparisonStatus
  const difference = comparison && (comparison.comparisonStatus === "complete" ? comparison.completeDifference : comparison.knownDifference)
  const complete = status === "complete" && result.comparisonStatus === "complete"
  return `<section class="product-scenario" aria-label="Scenario cost and coverage"><h3>${complete ? comparison ? "Complete comparison" : "Coverage complete" : `Comparison ${esc(status === "complete" ? result.comparisonStatus : status)}`}</h3>
<p>${result.comparisonStatus === "complete" ? "Total" : "Known subtotal"}: ${amount == null ? "Unavailable" : esc(String(amount))} ${esc(result.currency)}</p>
${comparison ? `<p>${comparison.comparisonStatus === "complete" ? "Difference" : "Known difference"}: ${difference == null ? "Unavailable" : esc(String(difference))} ${esc(result.currency)}</p>` : ""}
<p>Period: ${esc(result.horizon.start)} – ${esc(result.horizon.end)}</p>
<p>Cost coverage: ${esc(coverage.coverageState)} · Basis ${esc(coverage.basisId)} · version ${coverage.basisVersion}</p>
${comparison ? `<p>Comparison coverage references:</p>${comparison.costCoverageRefs.length ? `<ul aria-label="Comparison coverage references">${comparison.costCoverageRefs.map((ref) => `<li>${esc(ref)}</li>`).join("")}</ul>` : "<p>No coverage references supplied. Review the source comparison before choosing.</p>"}` : ""}
${coverage.derivedMissingCategoryIds.length ? `<ul aria-label="Missing cost categories">${coverage.derivedMissingCategoryIds.map((category) => `<li>Missing category: ${esc(category)}. Next step: confirm its cost or document why it does not apply.</li>`).join("")}</ul>` : ""}
${pending.length ? `<ul aria-label="Pending cost categories">${pending.map((entry) => `<li>Pending category: ${esc(entry.categoryId)} · ${esc(entry.reason)}. Next step: ${entry.questionRef ? `answer question ${esc(entry.questionRef)}` : "confirm the cost or document why it does not apply"}.</li>`).join("")}</ul>` : ""}
${gaps.length ? `<p>Conditions to resolve:</p><ul>${gaps.map((gap) => `<li>${esc(gap)}</li>`).join("")}</ul>` : ""}
${!complete ? `<p class="product-next-step">${status === "unavailable" || status === "incompatible" ? "Review source access, currency and period, then request a new comparison." : "Resolve the listed conditions and request a new comparison before treating the known difference as complete."}</p>` : ""}
${result.restrictions.length ? `<ul aria-label="Scenario restrictions">${result.restrictions.map((restriction) => `<li>${esc(restriction)}</li>`).join("")}</ul>` : ""}
${comparison?.criterionResults.length ? `<ul aria-label="Comparison criteria">${comparison.criterionResults.map((criterion) => `<li>${esc(criterion.criterionId)} · ${esc(criterion.state)} · ${esc(criterion.reason)}</li>`).join("")}</ul>` : ""}
<details><summary>Coverage and sources</summary><p>Result ${esc(result.id)} · version ${result.version}</p><ul>${coverage.entries.flatMap((entry) => entry.status === "pending" ? [] : [`<li>${esc(entry.categoryId)} · ${entry.status === "included" ? `Included: ${esc(entry.scopeNote)}` : `Not applicable: ${esc(entry.justification)}`}</li>`]).join("")}</ul><ul>${[...new Set([...result.sourceRefs, ...coverage.evaluatedSourceRefs].map((ref) => ref.refId))].map((ref) => `<li>${esc(ref)}</li>`).join("")}</ul></details></section>`
}

function scenarioBasis(input: ScenarioRequest): string {
  return `<details><summary>Scenario basis</summary><p>Base: ${esc(input.baseRef)}</p><ul>${input.operations.map((operation) => `<li>${esc(operation.kind)} · ${esc(operation.targetRef)}${operation.replacementRef ? ` → ${esc(operation.replacementRef)}` : ""}</li>`).join("")}</ul><p>${input.assumptions.length} assumptions recorded.</p></details>`
}

/** The caller must revalidate access and supply a persisted, authorized contribution. */
export function contribution(output: ContributionEnvelope): string {
  const provenance = output.runProvenance
  const status = output.state === "ready" ? "Ready for review" : output.state
  const labels: Record<ContributionEnvelope["kind"], string> = { IntentFrame: "Decision framing", AnalysisPlan: "Analysis plan", DecisionBrief: "Decision brief", QuestionProposal: "Question", FinancialAnalysis: "Financial analysis", AlternativeDraft: "Alternative proposal", ScenarioComparison: "Scenario comparison", SensitivityResult: "Sensitivity", CommercialComparison: "Commercial comparison", CommercialGap: "Commercial gap", EvidenceCandidate: "Evidence candidate", PreparedChangeSet: "Prepared changes", DossierDraft: "Purchase preparation", DeliveryAssessment: "Delivery assessment", DependencyConflict: "Dependency conflict", PortfolioComparison: "Portfolio comparison", ReconsiderationProposal: "Reconsideration", CritiqueReport: "Decision review", UnresolvedCondition: "Open condition", ClaimIssue: "Evidence review", DocumentEvidence: "Document evidence", ContextualBIProposal: "Contextual view", MeetingMaterialProposal: "Meeting material", CaseRecall: "Related decisions", MatchExplanation: "Relevance and differences" }
  return `<section class="product-contribution"><h3>${labels[output.kind]}</h3><p role="status">${esc(status)}${output.state === "ready" ? "" : ` · ${esc(output.reason)}`}</p>${contributionBody(output)}<details><summary>Sources (${output.evidenceRefs.length})</summary><ul>${output.evidenceRefs.map((ref) => `<li>${esc(ref.refId)} · ${esc(ref.evidenceLevel)}</li>`).join("")}</ul></details><details><summary>Contribution details</summary><dl><dt>Profile</dt><dd>${esc(provenance.profileId)} ${esc(provenance.profileVersion)}</dd><dt>Skill</dt><dd>${esc(provenance.skillId)} ${esc(provenance.skillVersion)}</dd><dt>Digest</dt><dd>${esc(provenance.sourceDigest)}</dd><dt>Model</dt><dd>${esc(provenance.actualModel)}</dd><dt>Run</dt><dd>${esc(provenance.runId)}</dd></dl></details></section>`
}

/** Read-only composition of an authorized case. Actions remain in the domain host. */
export function decisionDesk(projection: AuthorizedCaseProjection): string {
  const record = projection.case
  return `<section class="product-decision" aria-label="Decision"><header><h2>${esc(record.objective)}</h2><p>${esc(record.state)} · Version ${record.version} · ${esc(record.horizon.start)} – ${esc(record.horizon.end)} · ${esc(record.currency)}</p></header><section><h3>Criteria</h3>${record.criteria.length ? `<ul>${record.criteria.map((item) => `<li>${esc(item.description)}${item.required ? " (required)" : ""}</li>`).join("")}</ul>` : "<p>No criteria recorded.</p>"}</section><section><h3>Alternatives</h3>${record.alternatives.length ? record.alternatives.map((item) => `<article><h4>${esc(item.title)}</h4>${scenario(item.result)}${scenarioBasis(item.scenario)}</article>`).join("") : "<p>No alternatives recorded.</p>"}</section><section><h3>Questions</h3>${record.questions.length ? `<ul>${record.questions.map((item) => `<li>${esc(item.text)} · ${esc(item.state)}</li>`).join("")}</ul>` : "<p>No questions recorded.</p>"}</section><section><h3>Changes</h3>${record.preparedChanges.length ? `<ul>${record.preparedChanges.map((item) => `<li>${esc(item.state)} · ${esc(item.target.surface)} · version ${item.expectedVersion} · choice ${esc(item.choiceId)}</li>`).join("")}</ul>` : "<p>No changes prepared.</p>"}</section><details><summary>History and sources</summary><p>${projection.evidenceRefs.length} source references · ${record.receipts.length} receipts</p>${record.choices.map((choice) => `<article><h4>Recorded choice · ${esc(choice.at)}</h4><p>${esc(choice.reason)}</p>${scenario(choice.result, choice.comparison)}${scenarioBasis(choice.scenario)}</article>`).join("")}<ul>${projection.events.map((event) => `<li>${esc(event.kind)} · ${esc(event.at)} · ${esc(event.rationale)}</li>`).join("")}</ul></details></section>`
}

