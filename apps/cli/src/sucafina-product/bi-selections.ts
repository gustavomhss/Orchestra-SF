import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import type { ForecastCompareRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"

export type SfDecisionBiSelection = { scenarioResultRef: string; comparisonRef: string; sensitivityResultRef?: string; advantageComparisonRef?: string } |
  { portfolioResultRef: string; sourceScenarioRef: string }

/** These selectors carry identifiers only. Every referenced source/result is reauthorized by its producer. */
export const sfPlannerBiSelection = (selection: ForecastCompareRequest) => `sf-bi-planner:${encodeURIComponent(JSON.stringify(selection))}`
export const sfDecisionBiSelection = (selection: SfDecisionBiSelection) => `sf-bi-decision:${encodeURIComponent(JSON.stringify(selection))}`

function decode(reference: string, prefix: string): unknown {
  if (!reference.startsWith(prefix) || reference.length > 16_384) return undefined
  try {
    const encoded = reference.slice(prefix.length)
    const text = decodeURIComponent(encoded)
    if (encodeURIComponent(text) !== encoded) return undefined
    return JSON.parse(text)
  } catch { return undefined }
}

export function readSfPlannerBiSelection(reference: string) {
  const result = decodeSfOperationInput("sf_forecast_compare", decode(reference, "sf-bi-planner:"))
  return result.ok ? result.value : undefined
}

export function readSfDecisionBiSelection(reference: string): SfDecisionBiSelection | undefined {
  const value = decode(reference, "sf-bi-decision:")
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
  const fields = Object.entries(value)
  if (fields.some(([, entry]) => typeof entry !== "string" || !entry.trim())) return undefined
  if ("portfolioResultRef" in value && "sourceScenarioRef" in value && fields.length === 2 && typeof value.portfolioResultRef === "string" && typeof value.sourceScenarioRef === "string")
    return { portfolioResultRef: value.portfolioResultRef, sourceScenarioRef: value.sourceScenarioRef }
  if (!("scenarioResultRef" in value) || !("comparisonRef" in value) || typeof value.scenarioResultRef !== "string" || typeof value.comparisonRef !== "string" ||
    fields.some(([key]) => !["scenarioResultRef", "comparisonRef", "sensitivityResultRef", "advantageComparisonRef"].includes(key))) return undefined
  return { scenarioResultRef: value.scenarioResultRef, comparisonRef: value.comparisonRef,
    ...("sensitivityResultRef" in value && typeof value.sensitivityResultRef === "string" ? { sensitivityResultRef: value.sensitivityResultRef } : {}),
    ...("advantageComparisonRef" in value && typeof value.advantageComparisonRef === "string" ? { advantageComparisonRef: value.advantageComparisonRef } : {}) }
}

export function sameSfBiPeriod(first: { start: string; end: string }, second: { start: string; end: string }) {
  return digestSfValue(first) === digestSfValue(second)
}
