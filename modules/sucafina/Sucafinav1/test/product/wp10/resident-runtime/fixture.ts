import type { ResidentProfile, SkillManifest } from "../../../../product/contracts/resident-ai.ts"
import type { SfSelectedRuntime } from "../../../../product/contracts/runtime.ts"

export const skill: SkillManifest = {
  id: "sf-explicar-forecast", version: "1", sourcePath: "ai/skills/sf-explicar-forecast/SKILL.md",
  sourceDigest: "b".repeat(64), instructionsDigest: "c".repeat(64), inputSchemaRef: "ForecastExplainInput",
  outputSchemaRefs: ["FinancialAnalysis"], allowedProfiles: ["sf_finance"],
  allowedOperations: ["sf_forecast_compare", "sf_context_get"], workflow: ["compare"],
  limits: { maxSteps: 2, contextBudgetTokens: 1000 }, positiveAcceptance: ["compare"], negativeAcceptance: ["deny"],
}
export const selection = (profile: ResidentProfile, operationIds: readonly string[] = profile.allowedOperations): SfSelectedRuntime => ({
  profile, manifestDigest: "d".repeat(64), skills: [{ ...skill, allowedOperations: skill.allowedOperations.filter((operation) => profile.allowedOperations.includes(operation)) }], operationIds,
})
