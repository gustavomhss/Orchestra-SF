import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import { esc } from "../../src/screen-shell.ts"

const list = (items: readonly string[]) => items.length ? `<ul>${items.map((item) => `<li>${esc(item)}</li>`).join("")}</ul>` : "<p>None recorded.</p>"
const coverage = (refs: readonly string[], state: string) => `<p>Cost coverage references</p>${list(refs)}${state === "complete" ? "" : "<p>Review the unresolved coverage with the responsible owner before treating this comparison as complete.</p>"}`

/** Display persisted outputs without deriving financial values or granting actions. */
export function contributionBody(output: ContributionEnvelope): string {
  if (output.state !== "ready") return ""
  switch (output.kind) {
    case "IntentFrame": return `<p>${esc(output.payload.objective)} · ${esc(output.payload.horizon.start)} – ${esc(output.payload.horizon.end)} · ${esc(output.payload.currency)}</p>${output.payload.analysisBasis === "import-preview" ? "<p>Import preview; not applied.</p>" : ""}<p>Criteria</p>${list(output.payload.criteria.map((criterion) => `${criterion.description}${criterion.required ? " (required)" : ""}`))}${list(output.payload.gaps.map((gap) => gap.reason))}`
    case "AnalysisPlan": return `<p>${esc(output.payload.objective)}</p>${list(output.payload.steps.map((step) => step.expectedOutputTypes.join(", ")))}${list(output.payload.gaps.map((gap) => gap.reason))}`
    case "DecisionBrief": return `<p>${esc(output.payload.objective)}</p>${list(output.payload.conditions.map((item) => item.reason))}`
    case "QuestionProposal": return `<p>${esc(output.payload.question)}</p><p>${output.payload.recipientRef ? `Recipient: ${esc(output.payload.recipientRef)}` : "Recipient not selected"}</p>`
    case "FinancialAnalysis": return `<p>${esc(output.payload.explanation)}</p><p>Comparison: ${esc(output.payload.comparison.comparisonStatus)} · ${output.payload.comparison.comparisonStatus === "complete" ? "Difference" : "Known difference"}: ${(output.payload.comparison.comparisonStatus === "complete" ? output.payload.completeDifference : output.payload.knownDifference) ?? "Unavailable"}</p>${coverage(output.payload.comparison.costCoverageRefs, output.payload.comparison.comparisonStatus)}${output.payload.analysisBasis === "import-preview" ? "<p>Import preview; not applied.</p>" : ""}${list(output.payload.gaps)}`
    case "ScenarioComparison": return `<p>Comparison: ${esc(output.payload.comparisonStatus)} · ${output.payload.comparisonStatus === "complete" ? "Difference" : "Known difference"}: ${(output.payload.comparisonStatus === "complete" ? output.payload.completeDifference : output.payload.knownDifference) ?? "Unavailable"}</p>${coverage(output.payload.costCoverageRefs, output.payload.comparisonStatus)}${list(output.payload.unresolvedConditions)}`
    case "SensitivityResult": return `<p>Comparison: ${esc(output.payload.comparisonStatus)} · ${output.payload.thresholdEvidence.state === "exact" ? `Threshold: ${output.payload.thresholdEvidence.value}` : output.payload.thresholdEvidence.state === "sampled" ? `Sampled interval: ${output.payload.thresholdEvidence.interval.minimum} – ${output.payload.thresholdEvidence.interval.maximum}` : `Threshold unavailable: ${esc(output.payload.thresholdEvidence.reason)}`} ${esc(output.payload.unit)}</p>${coverage(output.payload.costCoverageRefs, output.payload.comparisonStatus)}${list(output.payload.evaluated.map((point) => `${point.parameterValue}: ${point.value ?? "Unavailable"}`))}${list(output.payload.unresolvedConditions.map((item) => item.reason))}`
    case "CommercialComparison": {
      const payload = output.payload
      const position = (ref: string) => { const found = payload.proposals.flatMap((item, index) => item.proposalRef === ref ? [index + 1] : []); return found.length === 1 ? `Proposal ${found[0]}` : "Unmatched supplied entry" }
      const rows = payload.proposals.map((item, index) => {
        const components = item.components
        const money = item.money
        const componentText = !components ? "Component scores not supplied" : [["Technical", components.technical], ["Price", components.price], ["Commercial", components.commercial], ["Overall", components.overall]].flatMap(([name, value]) => value === null ? [] : [`${name}: ${esc(String(value))}`]).join(", ") || "Component scores not supplied"
        const moneyText = !money ? "Money breakdown not supplied" : [money.originalAmount === null ? "" : `Original amount: ${esc(String(money.originalAmount))}`, money.originalCurrency ? `Original currency: ${esc(money.originalCurrency)}` : "", money.baseCurrency ? `Base currency: ${esc(money.baseCurrency)}` : "", money.fxRate === null ? "" : `FX rate: ${esc(String(money.fxRate))}`, money.fxSource ? `FX source: ${esc(money.fxSource)}` : ""].filter(Boolean).join(" · ") || "Money breakdown not supplied"
        const amount = item.convertedAmount === null ? "Amount unavailable" : `${esc(String(item.convertedAmount))} ${esc(payload.currency)}`
        return `<tr><th scope="row">Proposal ${index + 1}</th><td>${item.eligible ? "Eligible" : "Ineligible"}</td><td>${amount}</td><td>${item.score === null ? "Score not supplied" : esc(String(item.score))}</td><td>${componentText}</td><td>${moneyText}</td><td>${item.issues.length ? item.issues.map((issue) => esc(issue)).join(", ") : "No issues recorded"}</td></tr>`
      }).join("")
      const ranking = payload.ranking.length ? `<p>Recorded order: ${payload.ranking.map((ref) => esc(position(ref))).join(", ")}</p>` : "<p>No ranking is supplied.</p>"
      const weights = payload.weights
      const weightsBody = !weights ? "<p>Weights not supplied.</p>" : `<p>Technical weight: ${weights.technical === null ? "not supplied" : esc(String(weights.technical))}. Commercial weight: ${weights.commercial === null ? "not supplied" : esc(String(weights.commercial))}.</p>${list(weights.technicalCriteria.map((item) => `${item.name}: ${item.weight}`))}${list(weights.commercialCriteria.map((item) => `${item.name}: ${item.weight} · ${item.automatic ? "Automatic" : "Not automatic"}`))}`
      const selection = payload.selection
      const selectionText = !selection?.proposalRef ? "No selection recorded." : `${esc(position(selection.proposalRef))}. ${selection.reason ? `Selection reason: ${esc(selection.reason)}` : "Selection reason not supplied."}`
      const table = rows ? `<div class="table-scroll"><table><caption>Commercial comparison · ${esc(payload.currency)}</caption><thead><tr><th scope="col">Proposal</th><th scope="col">Eligibility</th><th scope="col">Amount</th><th scope="col">Score</th><th scope="col">Components</th><th scope="col">Money</th><th scope="col">Issues</th></tr></thead><tbody>${rows}</tbody></table></div>` : "<p>No proposals recorded.</p>"
      return `${table}${ranking}${weightsBody}<p>${selectionText}</p>${list(payload.conditions.map((item) => item.reason))}`
    }
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

