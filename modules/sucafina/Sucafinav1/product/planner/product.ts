import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import { createSfPlannerSourceHost } from "../integration/planner-sources.ts"
import { createPlannerPort } from "./port.ts"
import type { PlannerCriteriaHost, PlannerScenarioHost } from "./scenario-comparison-port.ts"
import type { PlannerScenarioInputs } from "./scenario-port.ts"
import { createPlannerSourceIssuer } from "./source-issuer.ts"
import { createStoredPlannerScenarioHost } from "./stored-scenarios.ts"
import { createPlannerScenarioInputs } from "./scenario-inputs.ts"

/** Bind Planner to the installation's authenticated source lifecycle and domain ports. */
export function createPlannerProduct(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort; coverageFor: PlannerSourceHost["resolveForecastCoverage"]; evidence?: BusinessContextService; scenarios?: PlannerScenarioHost; criteria?: PlannerCriteriaHost; scenarioInputs?: PlannerScenarioInputs; verifyAssumption?: PlannerScenarioInputs["verifyAssumption"]; sensitivity?: PlannerPort["evaluateSensitivity"]; storedScenarios?: Omit<Parameters<typeof createStoredPlannerScenarioHost>[0], "planner"> }) {
  const sources = createSfPlannerSourceHost({ host: input.host, scopedSources: input.scopedSources, coverageFor: input.coverageFor })
  const base = createPlannerPort({ ...input, sources })
  const scenarioInputs = input.scenarioInputs ?? createPlannerScenarioInputs({ planner: base, sources, verifyAssumption: input.verifyAssumption })
  const scenarios = input.storedScenarios ? createStoredPlannerScenarioHost({ ...input.storedScenarios, planner: base }) : input.scenarios
  const planner = createPlannerPort({ ...input, sources, scenarios, scenarioInputs })
  return { planner, sources, scenarios, scenarioInputs, issueSource: createPlannerSourceIssuer({ host: input.host, scopedSources: input.scopedSources, sources }) }
}

/** Route case coverage to its case-scoped authority and original sources to the forecast authority. */
export function createPlannerCoverageRouter(input: { forecast: PlannerSourceHost["resolveForecastCoverage"]; decision: PlannerSourceHost["resolveForecastCoverage"] }): PlannerSourceHost["resolveForecastCoverage"] {
  return (reference, context) => reference.startsWith("case-coverage:") ? input.decision(reference, context) : input.forecast(reference, context)
}
