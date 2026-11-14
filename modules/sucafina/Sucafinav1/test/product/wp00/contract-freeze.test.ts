import { expect, test } from "bun:test"
import path from "node:path"
import freeze from "../../../product/contracts/freeze-v1.json"
import normative from "../../../product/contracts/normative-contracts.json"
import { sfOperationInputSchemas } from "../../../product/contracts/operations.ts"
import { sfContributionOutputSchemas, sfOperationOutputSchemas, sfSkillInputSchemas } from "../../../product/contracts/output-schemas.ts"
import { sfProductStateNamespaceFields, sfProductStateProviderFields, sfProductStateAdditiveFields, sfProductStateSchemaVersion } from "../../../product/contracts/state-layout.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"

const root = path.resolve(import.meta.dir, "../../../../../..")

test("the contract freeze binds current artifact bytes without hashing itself", async () => {
  expect(freeze.revision).toBe(8)
  expect(freeze.planningSha).toBe("dbf9547211d9b0fade619790de7c19c0869b7c7d")
  expect(freeze.canonicalSha256).toBe("703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba")
  expect(Object.hasOwn(freeze.artifacts, "freeze-v1.json")).toBe(false)
  for (const [file, digest] of Object.entries(freeze.artifacts)) {
    const bytes = await Bun.file(path.join(import.meta.dir, "../../../product/contracts", file)).arrayBuffer()
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(digest)
  }
})

test("all seventeen contracts identify actual public exports, writers and consumers", async () => {
  expect(freeze.contracts.map((contract) => contract.id)).toEqual(Array.from({ length: 17 }, (_, index) => `C${String(index + 1).padStart(2, "0")}`))
  for (const contract of freeze.contracts) {
    expect(contract.definitionOwner).toBe("WP00.T02")
    expect(contract.producers.length).toBeGreaterThan(0)
    expect(contract.consumers.length).toBeGreaterThan(0)
    const source = await Bun.file(path.join(root, contract.path)).text()
    for (const name of contract.exports) expect(source).toMatch(new RegExp(`export (?:type|const|function) ${name}\\b`))
  }
})

test("five profiles and eighteen skills have schemas, consumers and proof assignments", () => {
  expect(freeze.nativeProfiles).toEqual(normative.resident.profiles)
  expect(new Set(freeze.nativeProfiles.map((profile) => profile.id)).size).toBe(5)
  expect(new Set(freeze.skills.map((skill) => skill.id)).size).toBe(18)
  expect(freeze.requiredProofs).toEqual(["AM01", "AM02", "AM03", "AM04", "AM05", "AM06"])
  for (const skill of freeze.skills) {
    expect(Object.hasOwn(sfSkillInputSchemas, skill.inputType)).toBe(true)
    expect(skill.consumerTasks.length).toBeGreaterThan(0)
    expect(skill.proofIds.length).toBeGreaterThan(0)
    expect(skill.sourceDigestPolicy).toBe("verified-from-distributed-bytes-at-build")
    for (const output of skill.outputTypes) expect(Object.hasOwn(sfContributionOutputSchemas, output)).toBe(true)
    for (const proof of skill.proofIds) expect(freeze.requiredProofs).toContain(proof)
    for (const profileId of skill.profiles) {
      const profile = freeze.nativeProfiles.find((entry) => entry.id === profileId)
      expect(profile?.allowed_skills).toContain(skill.id)
      for (const operation of skill.operations) expect(profile?.allowed_operations).toContain(operation)
      for (const output of skill.outputTypes) expect(profile?.output_types).toContain(output)
    }
  }
})

test("eight packs and every operation have a declared producer and effective loaded-skill route", () => {
  expect(freeze.capabilityPacks).toHaveLength(8)
  const packed = freeze.capabilityPacks.flatMap((pack) => pack.operations).sort()
  expect(packed).toHaveLength(39)
  expect(new Set(packed).size).toBe(39)
  expect(packed).toEqual(Object.keys(sfOperationInputSchemas).sort())
  expect(packed).toEqual(Object.keys(sfOperationOutputSchemas).sort())
  expect(freeze.skillRoutes).toEqual(normative.resident.operation_call_routes)
  for (const operation of freeze.operations) {
    const route = freeze.skillRoutes.filter((entry) => entry.operation_id === operation.operation)
    expect(route).toHaveLength(1)
    expect(operation.requiresLoadedSkillReceipt).toBe(true)
    expect(operation.consumerTasks.length).toBeGreaterThan(0)
    const skill = freeze.skills.find((entry) => entry.id === operation.routeSkill)
    expect(skill?.profiles).toContain(operation.routeProfile)
    expect(skill?.operations).toContain(operation.operation)
    expect(operation.profiles).toContain(operation.routeProfile)
    expect(operation.entryMode).toBe("interactive")
    expect(operation.handlerPath.startsWith("modules/sucafina/Sucafinav1/product/")).toBe(true)
    expect(operation.handlerExport.length).toBeGreaterThan(0)
    expect(operation.producerTask).toMatch(/^WP\d{2}\.T\d{2}$/)
  }
  expect(freeze.operations.find((operation) => operation.operation === "sf_import_preview")?.officialDomainMutation).toBe("none")
  expect(freeze.operations.find((operation) => operation.operation === "sf_routine_run")).toMatchObject({ requiresCurrentAdmission: true, officialDomainMutation: "existing-admission-only" })
  expect(packed).not.toContain("sf_import_apply")
})

test("C08 assigns every stored field to one namespace or to the provider", () => {
  const fields = Object.values(sfProductStateNamespaceFields).flat()
  expect(new Set(fields).size).toBe(fields.length)
  expect(Object.keys(sfProductStateNamespaceFields)).toHaveLength(12)
  expect(sfProductStateSchemaVersion).toBe(1)
  expect(sfProductStateNamespaceFields.cases).toEqual(["cases", "claimBindings", "commandProposals", "compositeScenarios", "decisionResults"])
  expect(sfProductStateNamespaceFields["bi-artifacts"]).toEqual(["biArtifacts"])
  for (const field of sfProductStateAdditiveFields) expect(fields).toContain(field)
  for (const field of sfProductStateProviderFields) expect(fields).not.toContain(field)
  // A newly added state field cannot silently evade namespace ownership during package typecheck.
  const exhaustive: Record<Exclude<keyof SfProductState, typeof fields[number] | typeof sfProductStateProviderFields[number]>, never> = {}
  expect(exhaustive).toEqual({})
})
