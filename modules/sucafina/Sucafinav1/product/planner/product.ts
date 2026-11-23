import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { ScenarioRequest } from "../contracts/operations.ts"
import type { BusinessContextService } from "../contracts/business-context.ts"
import type { DomainPortHost, PlannerPort, PlannerSourceHost } from "../contracts/ports.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"
import { createSfPlannerSourceHost } from "../integration/planner-sources.ts"
import { createPlannerPort } from "./port.ts"
import type { PlannerCriteriaHost, PlannerScenarioHost, PlannerScenarioObservation } from "./scenario-comparison-port.ts"
import type { PlannerScenarioInputs } from "./scenario-port.ts"
import { createPlannerSourceIssuer } from "./source-issuer.ts"
import { createStoredPlannerScenarioHost } from "./stored-scenarios.ts"
import { createPlannerScenarioInputs } from "./scenario-inputs.ts"
import { createPlannerVersionsHost } from "./versions-host.ts"
import { createPlannerOverviewHost } from "./overview-host.ts"
import { plannerScenarioCostPresentation } from "./comparison.ts"

export type StandaloneScenarioProducer = {
  supports: (request: ScenarioRequest) => boolean
  supportsSource: (reference: string) => boolean
  simulateScenario: PlannerPort["simulateScenario"]
  resolveSource: PlannerSourceHost["resolveForecastSource"]
  resolveStored: NonNullable<Parameters<typeof createStoredPlannerScenarioHost>[0]["external"]>["resolve"]
}

/** Bind Planner to the installation's authenticated source lifecycle and domain ports. */
export function createPlannerProduct(input: { standalone?: StandaloneScenarioProducer; host: DomainPortHost; scopedSources: SfScopedSourcePort; coverageFor: PlannerSourceHost["resolveForecastCoverage"]; evidence?: BusinessContextService; scenarios?: PlannerScenarioHost; criteria?: PlannerCriteriaHost; observeScenarios?: PlannerScenarioObservation; scenarioInputs?: PlannerScenarioInputs; currentChoicePreparing?: (context: TrustedDomainContext, baseRef: string) => boolean; verifyAssumption?: PlannerScenarioInputs["verifyAssumption"]; sensitivity?: PlannerPort["evaluateSensitivity"]; storedScenarios?: Omit<Parameters<typeof createStoredPlannerScenarioHost>[0], "planner">; versionAuthorize?: Parameters<typeof createPlannerVersionsHost>[0]["humanAuthorize"] }) {
  const plannerSources = createSfPlannerSourceHost({ host: input.host, scopedSources: input.scopedSources, coverageFor: input.coverageFor })
  const sources: PlannerSourceHost = input.standalone ? { ...plannerSources,
    resolveForecastSource: (reference, context) => input.standalone!.supportsSource(reference)
      ? input.standalone!.resolveSource(reference, context) : plannerSources.resolveForecastSource(reference, context) } : plannerSources
  const base = createPlannerPort({ ...input, sources: plannerSources })
  const scenarioInputs = input.scenarioInputs ?? createPlannerScenarioInputs({ planner: base, sources: plannerSources, verifyAssumption: input.verifyAssumption })
  const scenarios = input.storedScenarios ? createStoredPlannerScenarioHost({ ...input.storedScenarios, planner: base, ...(input.standalone ? { external: { supports: input.standalone.supports, resolve: input.standalone.resolveStored } } : {}) }) : input.scenarios
  const canonical = createPlannerPort({ ...input, sources, scenarios, scenarioInputs })
  const planner: PlannerPort = input.standalone ? { ...canonical, compareForecast: base.compareForecast,
    simulateScenario: (request, context) => input.standalone!.supports(request) ? input.standalone!.simulateScenario(request, context) : canonical.simulateScenario(request, context) } : canonical
  const issueSource = createPlannerSourceIssuer({ host: input.host, scopedSources: input.scopedSources, sources: plannerSources })
  const versions = createPlannerVersionsHost({ host: input.host, humanAuthorize: input.versionAuthorize ?? (async () => false) })
  const overview = createPlannerOverviewHost({ host: input.host, planner, issueSource, versions })
  return { planner, sources, scenarios, scenarioInputs, issueSource, versions, overview, presentComparison: plannerScenarioCostPresentation }
}

/** Route case coverage to its case-scoped authority and original sources to the forecast authority. */
export function createPlannerCoverageRouter(input: { forecast: PlannerSourceHost["resolveForecastCoverage"]; decision: PlannerSourceHost["resolveForecastCoverage"] }): PlannerSourceHost["resolveForecastCoverage"] {
  return (reference, context) => reference.startsWith("case-coverage:") ? input.decision(reference, context) : input.forecast(reference, context)
}
