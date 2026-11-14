import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { createReviewArtifactStorage } from "../../../../modules/sucafina/Sucafinav1/product/reports/storage.ts"
import type { createSfDecisionResultStore } from "../../../../modules/sucafina/Sucafinav1/product/decisions/result-store.ts"
import { reviewInclusion } from "../../../../modules/sucafina/Sucafinav1/product/reviews/inclusion.ts"
import type { ReviewCapabilityHost } from "../../../../modules/sucafina/Sucafinav1/product/reviews/capabilities.ts"
import { renderReviewBars, renderReviewChart, renderReviewSensitivity, renderReviewTimeline, renderReviewWaterfall } from "../../../../modules/sucafina/Sucafinav1/product/reviews/chart.ts"
import { matchesSelectedSources } from "../../../../modules/sucafina/Sucafinav1/product/reviews/references.ts"
import { reviewChartEvidence } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import type { ReviewChart } from "../../../../modules/sucafina/Sucafinav1/product/reviews/port.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { SfAnalysisDependencies, SfAnalysisVerifier } from "./analysis-verifier.ts"

export function createSfMeetingVerifier(dependencies: SfAnalysisDependencies & {
  reviews: ReviewCapabilityHost["reviews"]
  artifacts: ReviewCapabilityHost["artifacts"] & Pick<ReturnType<typeof createReviewArtifactStorage>, "inclusion">
  results: Pick<ReturnType<typeof createSfDecisionResultStore>, "read">
}): SfAnalysisVerifier {
  return {
    skillIds: ["sf-produzir-material-reuniao"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("MeetingMaterialInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (value.factualRoutineResults.length) return { status: "unavailable", reason: "review-result-link-unavailable" }
      if (!value.authorizedSections.length || new Set(value.authorizedSections).size !== value.authorizedSections.length) return { status: "needs-input", reason: "invalid-review-selection" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const cases = await Promise.all(value.decisionRefs.map((ref) => dependencies.cases.read({ caseRef: encodeCaseRef(ref) }, currentCall)))
        if (cases.some((item, index) => item.status !== "ok" || item.value.case.version !== value.decisionRefs[index]?.version)) return undefined
        const review = await dependencies.reviews.read(value.preservedReviewRef.id, currentCall)
        if (review.status !== "ok" || review.value.version !== value.preservedReviewRef.version || value.authorizedSections.some((id) => !review.value.sections.some((section) => section.id === id))) return undefined
        const sections = value.authorizedSections.flatMap((id) => review.value.sections.filter((section) => section.id === id))
        if (sections.some((section) => !Array.isArray((section.content as DomainProjection).missing))) return undefined
        const inclusion = reviewInclusion(review.value, value.authorizedSections)
        if (!inclusion) return undefined
        const refs = inclusion.sections.flatMap((section) => section.sourceRefs).filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, review: review.value, sections, inclusion, sources, refs }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "MeetingMaterialProposal") return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || digestSfValue(current.review) !== digestSfValue(proof.review)) return { status: "unavailable", reason: "analysis-output-unverified" }
        const material = output.payload
        if (material.reviewSelectionRef !== value.preservedReviewRef.id || material.orderedResultRefs.length !== 1 || material.coverage.length !== current.sections.length || material.coverage.some((item) => !current.sections.some((section) => section.id === item.sectionRef && section.count === item.includedCount && section.count === item.totalCount)) ||
          current.sections.some((section) => !material.coverage.some((item) => item.sectionRef === section.id)) || output.evidenceRefs.some((ref) => !current.refs.some((item) => digestSfValue(item) === digestSfValue(ref)))) return { status: "unavailable", reason: "analysis-output-unverified" }
        const artifact = await dependencies.artifacts.read(material.orderedResultRefs[0]!, currentCall)
        if (artifact.status !== "ok" || artifact.value.reviewRef !== value.preservedReviewRef.id || digestSfValue(artifact.value.sectionRefs) !== digestSfValue(value.authorizedSections) || artifact.value.artifact.artifactRef !== material.orderedResultRefs[0] || artifact.value.artifact.accessRevision !== currentCall.binding.accessRevision || artifact.value.artifact.recordCount !== current.sections.reduce((total, section) => total + section.count, 0) || digestSfValue(artifact.value.artifact.evidenceRefs) !== digestSfValue(output.evidenceRefs)) return { status: "unavailable", reason: "analysis-output-unverified" }
        const included = await dependencies.artifacts.inclusion(material.orderedResultRefs[0]!, currentCall)
        if (included.status !== "ok" || included.value.artifactRef !== material.orderedResultRefs[0] || !included.value.artifactDigest ||
          digestSfValue({ reviewRef: included.value.reviewRef, reviewVersion: included.value.reviewVersion, reviewDigest: included.value.reviewDigest, sections: included.value.sections, comments: included.value.comments }) !== digestSfValue(current.inclusion)) return { status: "unavailable", reason: "review-result-link-unavailable" }
        const rows = included.value.sections.flatMap((section) => section.decisionResults)
        const decisions = await Promise.all(rows.map(async (row) => {
          const scenario = await dependencies.results.read({ resultRef: row.resultRef, kind: "scenario" }, currentCall)
          const comparison = await dependencies.results.read({ resultRef: row.comparisonRef, kind: "comparison" }, currentCall)
          if (scenario.status !== "ok" || comparison.status !== "ok" || scenario.value.resultRef !== row.resultRef || scenario.value.resultDigest !== row.resultDigest || comparison.value.resultRef !== row.comparisonRef || comparison.value.resultDigest !== row.comparisonDigest || digestSfValue(scenario.value.caseRef) !== digestSfValue(comparison.value.caseRef)) return undefined
          return scenario.value.caseRef
        }))
        if (decisions.some((item) => !item) || value.decisionRefs.some((ref) => !decisions.some((item) => digestSfValue(item) === digestSfValue(ref))) || decisions.some((item) => !value.decisionRefs.some((ref) => digestSfValue(item) === digestSfValue(ref)))) return { status: "unavailable", reason: "review-result-link-unavailable" }
        const selectedRefs = current.sections.flatMap((section) => section.sourceRefs)
        const gaps = [
          ...current.sections.flatMap((section) => (section.content as DomainProjection).missing.map((item) => ({ id: `${section.id}:${item.field}`, category: item.field, reason: item.reason, evidenceRefs: [] }))),
          ...(current.review.comments.some((comment) => !matchesSelectedSources(comment.sourceRefs, selectedRefs)) ? [{ id: "comments-outside-selection", category: "comment", reason: "Comment sources do not match the selected sections.", evidenceRefs: [] }] : []),
          ...current.sections.flatMap((section) => {
            const projection = section.content as DomainProjection & { reviewChart?: ReviewChart }
            const chart = projection.reviewChart
            return chart && !renderReviewChart(projection, chart) && !renderReviewBars(projection, chart) && !renderReviewTimeline(projection, chart) && !renderReviewWaterfall(projection, chart) && !renderReviewSensitivity(chart)
              ? [{ id: `${section.id}:chart`, category: "chart", reason: chart.status === "ok" ? "Chart rendering unavailable; captured data remains in the report." : chart.reason, evidenceRefs: [] }] : []
          }),
        ]
        return digestSfValue(material.gaps) === digestSfValue(gaps) && !!await read(currentCall)
          ? { status: "ok", value: true } : { status: "unavailable", reason: "analysis-output-unverified" }
      } } }
    },
  }
}

export function createSfExecutiveReviewVerifier(dependencies: SfAnalysisDependencies & { reviews: ReviewCapabilityHost["reviews"] }): SfAnalysisVerifier {
  return {
    skillIds: ["sf-preparar-revisao-executiva"],
    verify: async (input, request, call) => {
      const decoded = decodeSfSkillInput("ExecutiveReviewInput", input)
      if (!decoded.ok) return { status: "needs-input", reason: "invalid-analysis-input" }
      const value = decoded.value
      if (value.factualRoutineResults.length || value.confirmations.length || value.routinePreparation || value.admittedRun) return { status: "unavailable", reason: "review-result-link-unavailable" }
      if (!value.decisionRefs.some((ref) => digestSfValue(ref) === digestSfValue(request.caseRef))) return { status: "needs-input", reason: "review-case-not-selected" }
      const read = async (currentCall: TrustedDomainContext) => {
        const current = await dependencies.cases.read({ caseRef: encodeCaseRef(request.caseRef) }, currentCall)
        if (current.status !== "ok" || current.value.case.version !== request.caseRef.version) return undefined
        const cases = await Promise.all(value.decisionRefs.map((ref) => dependencies.cases.read({ caseRef: encodeCaseRef(ref) }, currentCall)))
        if (cases.some((item, index) => item.status !== "ok" || item.value.case.version !== value.decisionRefs[index]?.version)) return undefined
        const review = await dependencies.reviews.preview(value.reviewSelection.selectionRef, value.reviewSelection.sectionRefs, currentCall, value.reviewSelection.period)
        if (review.status !== "ok" || review.value.some((section) => !Array.isArray(section.projection.values) || !Array.isArray(section.projection.missing))) return undefined
        const refs = review.value.flatMap((section) => [...section.projection.values.flatMap((item) => item.sourceRefs), ...reviewChartEvidence(section.chart)]).filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
        const sources = await dependencies.context.context({ refs }, currentCall)
        if (sources.length !== refs.length || sources.some((item, index) => item.state !== "fresh" || !item.authorizedProjection || !item.currentRef || digestSfValue(item.ref) !== digestSfValue(refs[index]) || digestSfValue(item.currentRef) !== digestSfValue(item.ref)) || !await dependencies.host.revalidate(currentCall)) return undefined
        return { current: current.value.case, review: review.value, refs, sources }
      }
      const proof = await read(call)
      if (!proof) return { status: "unavailable", reason: "analysis-source-unavailable" }
      return { status: "ok", value: { current: proof.current, input: value, sources: proof.sources, acceptsOutput: async (output, currentCall) => {
        if (output.state !== "ready" || output.kind !== "DecisionBrief") return { status: "unavailable", reason: "analysis-output-unverified" }
        const current = await read(currentCall)
        if (!current || digestSfValue(current.review) !== digestSfValue(proof.review)) return { status: "unavailable", reason: "analysis-output-unverified" }
        const brief = output.payload
        const gaps = current.review.flatMap((section) => section.projection.missing.map((item) => ({ id: `${section.id}:${item.field}`, category: item.field, reason: item.reason, evidenceRefs: [] })))
        if (brief.caseRef !== encodeCaseRef(request.caseRef) || brief.caseVersion !== request.caseRef.version || brief.objective !== current.current.objective || brief.orderedResultRefs.length || brief.runRef || brief.resultRef ||
          (brief.choiceRef !== undefined && !current.current.choices.some((choice) => choice.id === brief.choiceRef)) || digestSfValue(brief.conditions) !== digestSfValue(gaps) || digestSfValue(brief.evidenceRefs) !== digestSfValue(current.refs) || digestSfValue(output.evidenceRefs) !== digestSfValue(brief.evidenceRefs)) return { status: "unavailable", reason: "analysis-output-unverified" }
        return { status: "ok", value: true }
      } } }
    },
  }
}

