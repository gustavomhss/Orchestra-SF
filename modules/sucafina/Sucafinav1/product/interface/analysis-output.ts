import type { ContributionEnvelope } from "../contracts/resident-ai.ts"
import { contribution } from "../ui/components.ts"

/** Project a persisted contribution after the caller's current admission.
 * The preview reference is navigation only; the files producer reauthorizes
 * the exact manifest before returning its current preview or accepting changes.
 */
export function presentSfAnalysisOutput(output: ContributionEnvelope) {
  const html = contribution(output)
  if (output.state !== "ready") return { html }
  const importPreviewRef = (output.kind === "FinancialAnalysis" || output.kind === "IntentFrame") &&
    output.payload.analysisBasis === "import-preview" ? output.payload.importPreviewRef : undefined
  return { html, outputRef: output.id, ...(importPreviewRef ? { importPreviewRef } : {}) }
}
