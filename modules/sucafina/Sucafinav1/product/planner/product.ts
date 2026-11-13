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
import { createPlannerVersionsHost } from "./versions-host.ts"
import { createPlannerOverviewHost } from "./overview-host.ts"

/** Bind Planner to the installation's authenticated source lifecycle and domain ports. */
export function createPlannerProduct(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort; coverageFor: PlannerSourceHost["resolveForecastCoverage"]; evidence?: BusinessContextService; scenarios?: PlannerScenarioHost; criteria?: PlannerCriteriaHost; scenarioInputs?: PlannerScenarioInputs; verifyAssumption?: PlannerScenarioInputs["verifyAssumption"]; sensitivity?: PlannerPort["evaluateSensitivity"]; storedScenarios?: Omit<Parameters<typeof createStoredPlannerScenarioHost>[0], "planner">; versionAuthorize?: Parameters<typeof createPlannerVersionsHost>[0]["humanAuthorize"] }) {
  const sources = createSfPlannerSourceHost({ host: input.host, scopedSources: input.scopedSources, coverageFor: input.coverageFor })
  const base = createPlannerPort({ ...input, sources })
  const scenarioInputs = input.scenarioInputs ?? createPlannerScenarioInputs({ planner: base, sources, verifyAssumption: input.verifyAssumption })
  const scenarios = input.storedScenarios ? createStoredPlannerScenarioHost({ ...input.storedScenarios, planner: base }) : input.scenarios
  const planner = createPlannerPort({ ...input, sources, scenarios, scenarioInputs })
  const issueSource = createPlannerSourceIssuer({ host: input.host, scopedSources: input.scopedSources, sources })
  const versions = createPlannerVersionsHost({ host: input.host, humanAuthorize: input.versionAuthorize ?? (async () => false) })
  const overview = createPlannerOverviewHost({ host: input.host, planner, issueSource, versions })
  return { planner, sources, scenarios, scenarioInputs, issueSource, versions, overview }
}

/** Route case coverage to its case-scoped authority and original sources to the forecast authority. */
export function createPlannerCoverageRouter(input: { forecast: PlannerSourceHost["resolveForecastCoverage"]; decision: PlannerSourceHost["resolveForecastCoverage"] }): PlannerSourceHost["resolveForecastCoverage"] {
  return (reference, context) => reference.startsWith("case-coverage:") ? input.decision(reference, context) : input.forecast(reference, context)
}
