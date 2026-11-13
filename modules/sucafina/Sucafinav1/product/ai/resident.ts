import { createHash } from "node:crypto"
import { realpath } from "node:fs/promises"
import path from "node:path"
import { ConfigMarkdown } from "@orchestra/core/config/markdown"
import { SkillV2 } from "@orchestra/core/skill"
import { Schema } from "effect"
import type { ResidentProfile, SkillManifest } from "../contracts/resident-ai.ts"
import normative from "../contracts/normative-contracts.json"
import { sfSkillInputSchemas } from "../contracts/output-schemas.ts"

/** Verify the distributed manifest and source bytes before providing them to the native loader. */
export async function createResidentAiBundle(input: { root: string; manifestPath: string }) {
  const root = await realpath(input.root)
  const manifestPath = await realpath(input.manifestPath)
  if (!manifestPath.startsWith(`${root}${path.sep}`)) throw new Error("Manifest outside resident root")
  const bytes = await Bun.file(manifestPath).arrayBuffer()
  const manifest: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  if (!manifest || typeof manifest !== "object" || !("schemaVersion" in manifest) || manifest.schemaVersion !== 1 ||
      !("version" in manifest) || manifest.version !== "1.0.0" || !("profiles" in manifest) || !Array.isArray(manifest.profiles) ||
      !("skills" in manifest) || !Array.isArray(manifest.skills)) throw new Error("Invalid resident manifest")
  const profiles = manifest.profiles as ResidentProfile[]
  const skills = manifest.skills as SkillManifest[]
  if (!profiles.length || !skills.length || new Set(profiles.map((item) => item.id)).size !== profiles.length ||
      new Set(skills.map((item) => item.id)).size !== skills.length) throw new Error("Empty or duplicate resident entries")
  const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && new Set(a).size === a.length && a.every((value) => b.includes(value))
  const probe = profiles.length === 1 && skills.length === 1 && profiles[0]?.id === "sf_finance" && skills[0]?.id === "sf-explicar-forecast"
  if (!probe && (profiles.length !== 5 || skills.length !== 18)) throw new Error("Incomplete resident manifest")
  if (!("packs" in manifest) || !("operation_call_routes" in manifest)) throw new Error("Missing resident routes")
  const expectedPacks = probe
    ? normative.resident.mcp_packs.filter((pack) => pack.id === "planning").map((pack) => ({ ...pack, operations: pack.operations.filter((operation) => operation.id === "sf_forecast_compare") }))
    : normative.resident.mcp_packs
  const expectedRoutes = probe
    ? normative.resident.operation_call_routes.filter((route) => route.operation_id === "sf_forecast_compare")
    : normative.resident.operation_call_routes
  if (JSON.stringify(manifest.packs) !== JSON.stringify(expectedPacks) || JSON.stringify(manifest.operation_call_routes) !== JSON.stringify(expectedRoutes)) throw new Error("Resident route mismatch")
  const hash = (value: ArrayBuffer | string) => createHash("sha256").update(typeof value === "string" ? value : new Uint8Array(value)).digest("hex")
  const read = async (file: string) => {
    const resolved = await realpath(path.join(root, file))
    if (!resolved.startsWith(`${root}${path.sep}`)) throw new Error("Resident source outside root")
    return Bun.file(resolved).arrayBuffer()
  }
  for (const profile of profiles) {
    if (!/^sf_(maestro|finance|procurement|portfolio|reviewer)$/.test(profile.id) || !/^[a-f0-9]{64}$/.test(profile.sourceDigest)) throw new Error("Invalid resident profile")
    const expected = normative.resident.profiles.find((item) => item.id === profile.id)
    if (!expected || profile.version !== expected.version || profile.sourcePath !== expected.source_path ||
        !sameSet(profile.allowedSkills, expected.allowed_skills) || !sameSet(profile.allowedOperations, expected.allowed_operations) ||
        !sameSet(profile.outputTypes, expected.output_types) || profile.contextBudgetTokens !== expected.context_budget_tokens ||
        profile.maxSteps !== expected.max_steps || profile.maxDelegations !== expected.max_delegations || profile.modelClass !== expected.model_class ||
        profile.resumePolicy !== expected.resume_policy || profile.mission !== expected.mission) throw new Error(`Profile policy mismatch: ${profile.id}`)
    const file = await read(`profiles/${profile.id}.json`)
    if (hash(file) !== profile.sourceDigest) throw new Error(`Profile digest mismatch: ${profile.id}`)
    const stored: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(file))
    const { sourceDigest, ...definition } = profile
    if (JSON.stringify(stored) !== JSON.stringify(definition) || !sourceDigest) throw new Error(`Profile mismatch: ${profile.id}`)
  }
  for (const skill of skills) {
    if (!/^sf-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(skill.id) || !/^[a-f0-9]{64}$/.test(skill.sourceDigest) ||
        !/^[a-f0-9]{64}$/.test(skill.instructionsDigest) || !Array.isArray(skill.allowedProfiles) || !Array.isArray(skill.allowedOperations) ||
        !skill.allowedProfiles.length || !skill.outputSchemaRefs?.length || !skill.workflow?.length || !skill.positiveAcceptance?.length || !skill.negativeAcceptance?.length) throw new Error("Invalid resident skill")
    const expected = normative.resident.skills.find((item) => item.id === skill.id)
    if (!expected || skill.version !== expected.version || skill.sourcePath !== expected.source_path || skill.inputSchemaRef !== expected.input_type ||
        !sameSet(skill.allowedProfiles, expected.profiles) || !sameSet(skill.allowedOperations, expected.allowed_operations) ||
        !sameSet(skill.outputSchemaRefs, expected.output_types) || JSON.stringify(skill.workflow) !== JSON.stringify(expected.workflow) ||
        JSON.stringify(skill.positiveAcceptance) !== JSON.stringify([expected.positive_acceptance]) ||
        JSON.stringify(skill.negativeAcceptance) !== JSON.stringify([expected.negative_acceptance]) ||
        skill.limits?.maxSteps !== Math.max(...normative.resident.profiles.filter((item) => expected.profiles.includes(item.id)).map((item) => item.max_steps)) ||
        skill.limits?.contextBudgetTokens !== Math.max(...normative.resident.profiles.filter((item) => expected.profiles.includes(item.id)).map((item) => item.context_budget_tokens))) throw new Error(`Skill policy mismatch: ${skill.id}`)
    if (!Object.hasOwn(sfSkillInputSchemas, skill.inputSchemaRef)) throw new Error(`Skill input schema unavailable: ${skill.inputSchemaRef}`)
    const file = await read(`skills/${skill.id}/SKILL.md`)
    const parsed = ConfigMarkdown.parse(new TextDecoder("utf-8", { fatal: true }).decode(file))
    if (hash(file) !== skill.sourceDigest || hash(parsed.content.trim()) !== skill.instructionsDigest || parsed.data.name !== skill.id || !parsed.content.trim()) throw new Error(`Skill digest mismatch: ${skill.id}`)
    if (skill.allowedProfiles.some((id) => !profiles.some((profile) => profile.id === id && profile.allowedSkills.includes(skill.id) && skill.allowedOperations.every((operation) => profile.allowedOperations.includes(operation))))) throw new Error(`Skill grant mismatch: ${skill.id}`)
  }
  if (!probe && normative.resident.operation_call_routes.some((route) => !skills.some((skill) => skill.id === route.skill_id && skill.allowedProfiles.includes(route.profile_id as ResidentProfile["id"]) && skill.allowedOperations.includes(route.operation_id)))) throw new Error("Missing operation route")
  return { profiles, skills, source: Schema.decodeUnknownSync(SkillV2.DirectorySource)({ type: "directory", path: path.join(root, "skills") }), manifestDigest: hash(bytes) }
}
