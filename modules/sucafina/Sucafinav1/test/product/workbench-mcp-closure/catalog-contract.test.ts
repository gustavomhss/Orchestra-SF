import { expect, test } from "bun:test"
import { randomBytes } from "node:crypto"
import path from "node:path"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import resident from "../../../product/ai/manifests/resident.json" with { type: "json" }
import freeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { sfOperationInputSchemas } from "../../../product/contracts/operations.ts"
import { sfOperationOutputSchemas } from "../../../product/contracts/output-schemas.ts"
import { financialCompositionFixture } from "../wp10/integration/financial-composition-fixture.ts"
import { createSfExtendedBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/extended-business-services.ts"
import { createSfDocumentServices } from "../../../../../../apps/cli/src/sucafina-product/document-services.ts"
import { createSfImportServices } from "../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfRoutineServices } from "../../../../../../apps/cli/src/sucafina-product/routine-services.ts"

// Contract/readiness evidence only. The byte-verified bundle is not a SkillLoadReceipt,
// a descriptor is not a successful call, and absent native ports are not AM02/AM06.
const packs = {
  performance: ["sf_dashboard_read", "sf_kpi_explain", "sf_bi_view", "sf_source_get"],
  planning: ["sf_forecast_compare", "sf_scenario_simulate", "sf_scenario_compare", "sf_sensitivity_evaluate", "sf_portfolio_evaluate"],
  procurement: ["sf_request_read", "sf_supplier_read", "sf_contract_read", "sf_sourcing_compare"],
  decisions: ["sf_case_read", "sf_case_draft", "sf_alternative_draft", "sf_change_prepare", "sf_receipt_get"],
  collaboration: ["sf_work_list", "sf_question_prepare", "sf_answer_read", "sf_relation_read", "sf_handoff_prepare"],
  documents_reports: ["sf_document_extract", "sf_import_preview", "sf_review_prepare", "sf_report_prepare", "sf_artifact_get"],
  knowledge: ["sf_context_get", "sf_knowledge_search", "sf_evidence_get", "sf_decision_recall", "sf_freshness_check"],
  routines: ["sf_routine_catalog", "sf_routine_prepare", "sf_routine_run", "sf_routine_status", "sf_routine_result", "sf_watch_prepare"],
} as const
const operations = Object.values(packs).flat()
const residentRoot = path.resolve(import.meta.dir, "../../../product/ai")

test("all 39 canonical routes fit the actual byte-verified profile and skill ceilings", async () => {
  const bundle = await createResidentAiBundle({ root: residentRoot, manifestPath: path.join(residentRoot, "manifests/resident.json") })
  expect(resident.packs.map((pack) => ({ id: pack.id, operations: pack.operations.map((operation) => operation.id) })))
    .toEqual(Object.entries(packs).map(([id, operations]) => ({ id, operations })))
  expect(operations).toHaveLength(39)
  expect(new Set(operations).size).toBe(39)
  expect(Object.keys(sfOperationInputSchemas).sort()).toEqual([...operations].sort())
  expect(Object.keys(sfOperationOutputSchemas).sort()).toEqual([...operations].sort())
  expect(freeze.operations.map((operation) => operation.operation).sort()).toEqual([...operations].sort())
  expect(resident.operation_call_routes.map((route) => route.operation_id).sort()).toEqual([...operations].sort())
  expect(bundle.profiles.map((profile) => profile.id).sort()).toEqual(["sf_finance", "sf_maestro", "sf_portfolio", "sf_procurement", "sf_reviewer"])
  expect(bundle.skills).toHaveLength(18)
  expect(new Set(bundle.skills.map((skill) => skill.id)).size).toBe(18)
  expect(bundle.profiles.reduce((count, profile) => count + profile.allowedSkills.length, 0)).toBe(25)

  for (const route of resident.operation_call_routes) {
    const selected = bundle.selected.find((value) => value.profile.id === route.profile_id)
    const skill = selected?.skills.find((value) => value.id === route.skill_id)
    const operation = freeze.operations.find((value) => value.operation === route.operation_id)
    if (!selected || !skill || !operation) throw new Error(`Incomplete canonical route: ${route.operation_id}`)
    expect(selected.operationIds).toContain(route.operation_id)
    expect(skill.allowedOperations).toContain(route.operation_id)
    expect(skill.allowedProfiles).toContain(selected.profile.id)
    expect(operation.profiles).toContain(selected.profile.id)
    expect(operation.routeProfile).toBe(route.profile_id)
    expect(operation.routeSkill).toBe(route.skill_id)
    expect(operation.pack).toBe(route.pack_id)
    expect(route.requires_loaded_skill_receipt).toBe(true)
    expect(route.requires_current_c07_admission).toBe(route.operation_id === "sf_routine_run")
    const schema = sfOperationInputSchemas[route.operation_id as keyof typeof sfOperationInputSchemas]
    expect(schema.type).toBe("object")
    expect(schema.additionalProperties).toBe(false)
    for (const field of ["actor", "role", "projectId", "sessionId", "profileId", "provider", "endpoint", "owner", "binding", "skillReceipt"])
      expect(Object.hasOwn(schema.properties, field)).toBe(false)
  }

  for (const selected of bundle.selected) {
    const supported = selected.profile.allowedOperations.filter((operation) =>
      selected.skills.some((skill) => skill.allowedOperations.includes(operation)) && operations.some((id) => id === operation))
    expect(selected.operationIds).toEqual(supported)
    expect(selected.skills.map((skill) => skill.id).sort()).toEqual([...selected.profile.allowedSkills].sort())
  }
  // Maestro has a policy ceiling for watches but no granting skill. Do not silently
  // expand its grant to make profile counts match. The canonical watch route is Portfolio.
  const maestro = bundle.selected.find((selected) => selected.profile.id === "sf_maestro")
  expect(maestro?.profile.allowedOperations).toContain("sf_watch_prepare")
  expect(maestro?.operationIds).not.toContain("sf_watch_prepare")
  expect(resident.operation_call_routes.find((route) => route.operation_id === "sf_watch_prepare"))
    .toMatchObject({ profile_id: "sf_portfolio", skill_id: "sf-reavaliar-compromissos" })
})

test("real domain composition exposes canonical descriptors and keeps missing native capabilities unadvertised", async () => {
  const fixture = await financialCompositionFixture()
  const runtime = {
    installationId: "installation", directory: fixture.directory, sourceRoot: residentRoot,
    origin: "https://example.test", mount: "/sucafina", persistence: fixture.persistence,
    authenticate: fixture.authority.host.authenticate, environment: fixture.authority.host.environment,
    assets: {
      persistence: fixture.persistence,
      services: {
        signingKey: randomBytes(32),
        // This catalog test must not claim that a document was scanned or admitted.
        scan: async () => { throw new Error("Catalog qualification cannot scan or admit bytes") },
      },
    },
  }
  const documents = createSfDocumentServices({ runtime, authority: fixture.authority })
  const imports = createSfImportServices({ runtime, authority: fixture.authority })
  const extended = createSfExtendedBusinessServices({ authority: fixture.authority, business: fixture.business,
    persistence: fixture.persistence, ...fixture.guards, origin: runtime.origin })
  try {
    if (!documents || !imports) throw new Error("Actual shared asset services failed to compose")
    const replaced = new Set(extended.replacements.map((descriptor) => descriptor.id))
    const descriptors = [
      ...fixture.business.descriptors.filter((descriptor) => !replaced.has(descriptor.id)),
      ...extended.replacements, ...extended.descriptors, ...documents.descriptors, ...imports.descriptors,
    ]
    const expected = Object.entries(packs).filter(([pack]) => pack !== "routines").flatMap(([, ids]) => ids)
    expect(descriptors.map((descriptor) => descriptor.id).sort()).toEqual([...expected].sort())
    expect(new Set(descriptors.map((descriptor) => descriptor.id)).size).toBe(descriptors.length)
    for (const descriptor of descriptors) {
      const operation = freeze.operations.find((entry) => entry.operation === descriptor.id)
      if (!operation) throw new Error(`Uncatalogued capability: ${descriptor.id}`)
      const id = descriptor.id as keyof typeof sfOperationInputSchemas
      expect(descriptor.inputSchema).toEqual(sfOperationInputSchemas[id])
      expect(descriptor.outputSchema).toEqual(sfOperationOutputSchemas[id])
      expect(descriptor.pack).toBe(operation.pack)
      expect(descriptor.mode).toBe(operation.mode)
      expect(descriptor.handlerExport).toBe(operation.handlerExport)
      expect(descriptor.producerTask).toBe(operation.producerTask)
      expect([...descriptor.grantProfiles].sort()).toEqual([...operation.profiles].sort())
      expect(descriptor.handler).toBeFunction()
      expect(operation.officialDomainMutation).toBe("none")
    }
    const routine = createSfRoutineServices({ authority: fixture.authority.authority, resolveCase: fixture.business.resolveCase,
      resolveInputs: async () => { throw new Error("Missing native owner cannot resolve routine inputs") },
      revalidateSources: async () => { throw new Error("Missing native owner cannot revalidate routine sources") },
    })
    expect(routine.descriptors).toEqual([])
    expect(operations.filter((operation) => !descriptors.some((descriptor) => descriptor.id === operation))).toEqual(packs.routines)
    expect(createSfDocumentServices({ runtime: { ...runtime, assets: undefined }, authority: fixture.authority })).toBeUndefined()
    expect(createSfImportServices({ runtime: { ...runtime, assets: undefined }, authority: fixture.authority })).toBeUndefined()
  } finally {
    documents?.dispose()
    extended.dispose()
    await fixture.dispose()
  }
})
