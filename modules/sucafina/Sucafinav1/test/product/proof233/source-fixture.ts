import path from "node:path"
import freeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import resident from "../../../product/ai/manifests/resident.json" with { type: "json" }
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { am03Scenarios } from "../../../../../../script/sf2h/proofs/am03/correlation.ts"

/**
 * Proof-first SOURCE fixture, not a synthetic model/provider/actor fixture.
 * The original resident loader reads actual profile JSON and skill markdown,
 * hashes their bytes and validates the shipped normative C15/C16 grants.
 * Catalog integrity alone NEVER counts as AM01/AM02/AM03 execution evidence.
 */
const wp12 = "Sucafinav1/test/product/wp12/"
const am01 = "Sucafinav1/test/product/integrated-proofs/am01/"
export const am01AssignmentSource = [
  ["AM01-FINANCE", "sf_finance", "sf-explicar-forecast", wp12 + "native-execution-forecast-kpi.test.ts"],
  ["AM01-FINANCE", "sf_finance", "sf-comparar-cenarios", wp12 + "native-execution-scenarios-review.test.ts"],
  ["AM01-FINANCE", "sf_finance", "sf-avaliar-sensibilidade", wp12 + "native-execution-portfolio.test.ts"],
  ["AM01-FINANCE", "sf_finance", "sf-produzir-bi-contextual", wp12 + "native-execution-bi-public-selection.test.ts"],
  ["AM01-PROCUREMENT", "sf_procurement", "sf-comparar-sourcing", wp12 + "native-execution-sourcing.test.ts"],
  ["AM01-PROCUREMENT", "sf_procurement", "sf-revisar-condicoes-contratuais", wp12 + "native-execution-documents-contract.test.ts"],
  ["AM01-PROCUREMENT", "sf_procurement", "sf-preparar-compra", wp12 + "native-execution-purchase.test.ts"],
  ["AM01-PROCUREMENT", "sf_procurement", "sf-extrair-evidencias", wp12 + "native-execution-documents-contract.test.ts"],
  ["AM01-PORTFOLIO", "sf_portfolio", "sf-revisar-dependencias", wp12 + "native-execution-dependencies.test.ts"],
  ["AM01-PORTFOLIO", "sf_portfolio", "sf-compor-portfolio", wp12 + "native-execution-portfolio.test.ts"],
  ["AM01-PORTFOLIO", "sf_portfolio", "sf-reavaliar-compromissos", wp12 + "native-execution-reevaluation.test.ts"],
  ["AM01-PORTFOLIO", "sf_portfolio", "sf-consultar-memoria-decisoria", am01 + "portfolio-recall-proof.test.ts"],
  ["AM01-MAESTRO", "sf_maestro", "sf-enquadrar-decisao", wp12 + "native-execution-intent.test.ts"],
  ["AM01-MAESTRO", "sf_maestro", "sf-preparar-revisao-executiva", wp12 + "native-execution-executive.test.ts"],
  ["AM01-MAESTRO", "sf_maestro", "sf-coordenar-perguntas", wp12 + "native-execution-questions.test.ts"],
  ["AM01-MAESTRO", "sf_maestro", "sf-produzir-material-reuniao", wp12 + "native-execution-executive.test.ts"],
  ["AM01-REVIEWER", "sf_reviewer", "sf-contestar-decisao", wp12 + "native-execution-scenarios-review.test.ts"],
  ["AM01-REVIEWER", "sf_reviewer", "sf-revisar-evidencias", wp12 + "native-execution-documents-contract.test.ts"],
] as const

export const am01HostedSelectors = [
  wp12 + "resident-native.test.ts",
  ...new Set(am01AssignmentSource.map((row) => row[3])),
  am01 + "recall-five-profiles.test.ts",
] as const

export async function loadProof233SourceFixture() {
  const root = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({
    root, manifestPath: path.join(root, "manifests/resident.json"),
  })
  const profiles = new Set(bundle.profiles.map((entry) => entry.id))
  const skills = new Set(bundle.skills.map((entry) => entry.id))
  const routeIds = new Set(freeze.operations.map((entry) => entry.operation))
  const packs = new Set(freeze.operations.map((entry) => entry.pack))
  if (profiles.size !== 5 || skills.size !== 18 || bundle.profiles.length !== 5 ||
      bundle.skills.length !== 18 || am01AssignmentSource.length !== 18 ||
      routeIds.size !== 39 || freeze.operations.length !== 39 ||
      resident.operation_call_routes.length !== 39 || packs.size !== 8 ||
      am03Scenarios.length !== 25) {
    throw new Error("233: frozen 5/18/39/8/25 source cardinalities changed")
  }
  if (new Set(am01AssignmentSource.map((row) => row[2])).size !== 18 ||
      new Set(am01AssignmentSource.map((row) => row[1])).size !== 5)
    throw new Error("233: AM01 specialist matrix has duplicate or missing source")

  const assignments = am01AssignmentSource.map(([caseId, profileId, skillId, selector]) => {
    const selected = bundle.selected.find((entry) => entry.profile.id === profileId)
    const skill = selected?.skills.find((entry) => entry.id === skillId)
    if (!selected || !skill || !selected.profile.allowedSkills.includes(skill.id) ||
        !skill.allowedProfiles.includes(selected.profile.id))
      throw new Error("233: original distributed AM01 source/grant missing: " + profileId + "/" + skillId)
    return {
      caseId, profileId, skillId, testSelector: selector,
      profileSource: selected.profile.sourcePath, profileVersion: selected.profile.version,
      profileDigest: selected.profile.sourceDigest, skillSource: skill.sourcePath,
      skillVersion: skill.version, skillDigest: skill.sourceDigest,
      instructionsDigest: skill.instructionsDigest,
      expectedConsumer: "original persisted typed output read by authorized case/UI after reload",
      actualNativeRunId: null, actualProvider: null, actualConsumedOutput: null,
      status: "NOT_RUN" as const,
    }
  })

  const routes = freeze.operations.map((descriptor) => {
    const route = resident.operation_call_routes.find((entry) => entry.operation_id === descriptor.operation)
    const selected = bundle.selected.find((entry) => entry.profile.id === descriptor.routeProfile)
    const skill = selected?.skills.find((entry) => entry.id === descriptor.routeSkill)
    if (!route || route.pack_id !== descriptor.pack || route.profile_id !== descriptor.routeProfile ||
        route.skill_id !== descriptor.routeSkill || !selected || !skill ||
        !selected.operationIds.includes(descriptor.operation) ||
        !skill.allowedOperations.includes(descriptor.operation) ||
        !descriptor.handlerPath || !descriptor.handlerExport ||
        route.producer_task !== descriptor.producerTask ||
        JSON.stringify(route.consumer_tasks) !== JSON.stringify(descriptor.consumerTasks))
      throw new Error("233: original C16 route/producer/consumer drift: " + descriptor.operation)
    return {
      operation: descriptor.operation, pack: descriptor.pack,
      producerPath: descriptor.handlerPath, producerExport: descriptor.handlerExport,
      producerTask: descriptor.producerTask, consumers: descriptor.consumerTasks,
      profileId: route.profile_id, skillId: route.skill_id,
      sourceDigest: skill.sourceDigest, instructionsDigest: skill.instructionsDigest,
      expectedSurfaces: ["original-ui", "native-session-v2-agent", "sdk-mcp-c16"],
      requiredNegatives: ["no-grant", "revoked", "stale-version"],
      observedCallIds: null, consumerReadRef: null,
      status: "NOT_RUN" as const,
    }
  })

  // Check existing source and consumer files, never create substitute fixtures.
  const repoRoot = path.resolve(import.meta.dir, "../../../../../..")
  const consumerSources = [
    "modules/sucafina/Sucafinav1/product/interface/analysis-http.ts",
    "apps/cli/src/sucafina-product/host-context.ts",
    "modules/sucafina/Sucafinav1/test/product/integrated-proofs/am02/observe-native-c16.ts",
  ]
  const requiredTreePaths = [
    ...am01HostedSelectors.map((selector) => path.join("modules/sucafina", selector)),
    ...routes.map((route) => route.producerPath),
    ...consumerSources,
  ]
  for (const file of new Set(requiredTreePaths)) {
    if (!await Bun.file(path.join(repoRoot, file)).exists())
      throw new Error("233: original source/consumer/selector not present in candidate tree: " + file)
  }

  return {
    schema: "sf2h.proof233.original-source-fixture.v1" as const,
    proofStatus: "NOT_RUN" as const, sourceOnly: true, manifestDigest: bundle.manifestDigest,
    profiles: [...profiles].sort(), skills: [...skills].sort(), packs: [...packs].sort(),
    sourcePathsChecked: [...new Set(requiredTreePaths)].sort(), consumerSources,
    assignments, routes, scenarios: [...am03Scenarios],
    noPassFromCatalog: true,
  }
}
