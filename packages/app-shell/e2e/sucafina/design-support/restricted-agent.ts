import { createHash } from "node:crypto"
import { realpath, stat } from "node:fs/promises"
import path from "node:path"
import type { APIRequestContext } from "@playwright/test"
import type { DesignInstallation } from "./installation"

// Recording setup through the original public trust and agent-file APIs.
// This is an explicit operator restriction in one owned, ephemeral workspace.
// It does not modify product code, the fixture environment, or the core role.
type Json = Record<string, unknown>
type RecordProof = (name: string, proof: Json) => Promise<void>
const editableFields = ["description", "mode", "model", "avatar", "steps", "system", "disable"] as const
const coreFields = ["id", "name", "description", "mode", "hidden", "color", "avatar", "steps", "system", "engine", "skills", "toolkit"] as const

export type RestrictedAgentReadback = {
  agentId: "maestro"
  coreSha256: string
  systemSha256: string
  systemCharacters: number
  fileRevision: string
  permissionsSha256: string
  wildcardDenyIndex: number
  laterRulesOnlyDeny: true
  effectiveRules: Json[]
  advertisedToolNames: string[]
  availableSkillNames: string[]
  residualSkillDescriptor: boolean
}

export type RestrictedMaestro = {
  verify: () => Promise<RestrictedAgentReadback>
}

export async function configureRestrictedMaestro(
  request: APIRequestContext,
  installed: DesignInstallation,
  record: RecordProof,
): Promise<RestrictedMaestro> {
  const origin = new URL(installed.origin)
  const root = await realpath(installed.root)
  const directory = await realpath(path.join(root, "workspace"))
  if (origin.protocol !== "http:" || origin.hostname !== "127.0.0.1" || !origin.port || installed.mount !== "/sucafina" ||
      root !== path.resolve(installed.root) || !path.basename(root).startsWith("sf-design-capture-") ||
      directory !== path.join(root, "workspace") || ((await stat(root)).mode & 0o077) !== 0)
    throw new Error("Restricted configuration requires the original private ephemeral recording workspace")

  const locationURL = (route: string) => {
    const url = new URL(route, origin)
    url.searchParams.set("location[directory]", directory)
    return url.href
  }
  const get = async (route: string): Promise<Json> => {
    const response = await request.get(locationURL(route), { timeout: 30_000 })
    if (response.status() !== 200) throw new Error("Restricted setup read failed: " + route + " (" + response.status() + ")")
    const value = object(await response.json())
    if (object(value.location).directory !== directory)
      throw new Error("Restricted setup read belongs to a different workspace")
    return value
  }
  const agent = async () => {
    const agents = rows((await get("/api/agent")).data)
    const found = agents.find((value) => value.id === "maestro")
    if (!found || found.hidden !== false || found.mode !== "primary" ||
        (found.engine !== undefined && found.engine !== "orchestra") || typeof found.system !== "string")
      throw new Error("The original visible primary Maestro is not available on the Orchestra engine")
    return found
  }
  const trust = async () => {
    const response = await request.get(new URL("/api/trust", origin).href, { timeout: 30_000 })
    if (response.status() !== 200) throw new Error("Ordinary project trust read failed (" + response.status() + ")")
    const value: unknown = await response.json()
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
      throw new Error("Ordinary project trust returned an invalid list")
    return value as string[]
  }

  const originalAgent = await agent()
  const originalFile = object((await get("/api/agent/maestro/file")).data)
  validateFile(originalFile, directory)
  const originalCore = digest(pick(originalAgent, coreFields))
  const originalNonPermissions = digest(without(originalAgent, "permissions"))
  const protectedFile = pick(originalFile, editableFields)
  const originalTrust = await trust()
  const wasExplicitlyTrusted = originalTrust.includes(directory)
  // This is the supported approval route, scoped to the existing private
  // workspace. Never write trust files, approve an ancestor, or alter the flag.
  if (!wasExplicitlyTrusted) {
    const approved = await request.post(new URL("/api/trust/approve", origin).href, {
      data: { directory }, timeout: 30_000,
    })
    if (approved.status() !== 204) throw new Error("Ordinary exact-project trust approval failed (" + approved.status() + ")")
  }
  const afterTrust = await trust()
  if (!afterTrust.includes(directory) ||
      afterTrust.some((entry) => entry !== directory && !originalTrust.includes(entry)) ||
      originalTrust.some((entry) => !afterTrust.includes(entry)))
    throw new Error("Trust readback did not preserve existing entries and approve only the exact private workspace")

  // The API removes omitted editable fields. Copy every present non-permission
  // field and the exact revision; path/exists/invalid are not input fields.
  const payload = { ...protectedFile, revision: originalFile.revision, permission: { "*": "deny" } }
  const savedResponse = await request.put(locationURL("/api/agent/maestro/file"), {
    data: payload, timeout: 30_000,
  })
  if (savedResponse.status() !== 200)
    throw new Error("Revision-protected agent permission write failed (" + savedResponse.status() + ")")
  const savedEnvelope = object(await savedResponse.json())
  if (object(savedEnvelope.location).directory !== directory)
    throw new Error("Agent permission write returned a different workspace")
  const saved = object(savedEnvelope.data)
  validateFile(saved, directory)
  if (digest(pick(saved, editableFields)) !== digest(protectedFile))
    throw new Error("The public agent-file write changed a non-permission field")

  const verify = async (): Promise<RestrictedAgentReadback> => {
    const [resolved, fileEnvelope, detailEnvelope] = await Promise.all([
      agent(), get("/api/agent/maestro/file"), get("/api/agent/maestro/detail"),
    ])
    const file = object(fileEnvelope.data)
    const detail = object(detailEnvelope.data)
    validateFile(file, directory)
    if (file.exists !== true || file.revision !== saved.revision ||
        digest(pick(file, editableFields)) !== digest(protectedFile) ||
        digest(file.permission) !== digest({ "*": "deny" }))
      throw new Error("The current agent file does not preserve the exact restricted configuration")
    if (digest(pick(resolved, coreFields)) !== originalCore)
      throw new Error("The resolved Maestro core role/system/steps/engine changed")
    const rules = rows(resolved.permissions)
    const wildcardDenyIndex = rules.findLastIndex((rule) => rule.action === "*" && rule.resource === "*" && rule.effect === "deny")
    if (wildcardDenyIndex < 0 || rules.slice(wildcardDenyIndex).some((rule) => rule.effect !== "deny"))
      throw new Error("The ordinary resolved permissions do not deny every action/resource")
    const advertisedToolNames = rows(detail.tools).map((tool) => {
      if (typeof tool.name !== "string") throw new Error("Actual advertised tool omitted its name")
      return tool.name
    }).sort()
    // Native seat visibility may append named skill denials after the wildcard.
    // Registry.whollyDisabled then retains the skill descriptor, but its runtime
    // permission floor still denies every resource. Never edit the descriptor.
    if (advertisedToolNames.length > 1 || advertisedToolNames.some((name) => name !== "skill"))
      throw new Error("Unexpected advertised tools remain after the standard restriction: " + advertisedToolNames.join(", "))
    const residualSkillDescriptor = advertisedToolNames.length === 1
    if (residualSkillDescriptor && !rules.slice(wildcardDenyIndex + 1)
      .some((rule) => rule.action === "skill" && rule.resource !== "*" && rule.effect === "deny"))
      throw new Error("Residual skill descriptor lacks its source-proven named-denial explanation")
    const availableSkillNames = rows(detail.skills).map((skill) => {
      if (typeof skill.name !== "string") throw new Error("Actual available skill omitted its name")
      return skill.name
    }).sort()
    if (availableSkillNames.length !== 0)
      throw new Error("The resolved detail still admits skills under an all-tool denial")
    return {
      agentId: "maestro", coreSha256: originalCore, systemSha256: digest(resolved.system),
      systemCharacters: String(resolved.system).length, fileRevision: String(file.revision),
      permissionsSha256: digest(rules), wildcardDenyIndex, laterRulesOnlyDeny: true,
      effectiveRules: rules, advertisedToolNames, availableSkillNames, residualSkillDescriptor,
    }
  }
  const readback = await verify()
  if (digest(without(await agent(), "permissions")) !== originalNonPermissions)
    throw new Error("Restriction changed resolved non-permission agent fields")
  await record("restricted-agent-configuration", {
    kind: "operator-configured-tool-restriction",
    scope: "the original isolated private workspace only",
    api: { trust: "POST /api/trust/approve", file: "GET then PUT /api/agent/maestro/file", location: "[isolated-installation]/workspace" },
    trust: { wasExplicitlyTrusted, exactWorkspaceExplicitlyTrusted: true, beforeCount: originalTrust.length, afterCount: afterTrust.length,
      ancestorApprovalRequested: false, normalTrustGateUsed: true, fixtureEnvironmentUnchanged: true },
    file: { existedBefore: originalFile.exists, previousRevision: originalFile.revision, currentRevision: saved.revision,
      copiedNonPermissionFields: Object.keys(protectedFile), nonPermissionFieldsSha256: digest(protectedFile), revisionChecked: true },
    originalAgent: { coreSha256: originalCore, nonPermissionFieldsSha256: originalNonPermissions,
      systemSha256: digest(originalAgent.system), systemCharacters: String(originalAgent.system).length,
      steps: originalAgent.steps ?? null, engine: originalAgent.engine ?? "orchestra (default)", mode: originalAgent.mode },
    configuredPermission: { "*": "deny" }, readback,
    originalCoreRolePreserved: true, permissionDependentGuidanceAndSchemasMayChange: true,
    productCodeChanged: false, advertisedDescriptorsEdited: false, maxStepsChanged: false,
    narrationBadge: "Provided facts · Tool access denied",
  })
  return { verify }
}

function validateFile(file: Json, directory: string) {
  const allowed = [path.join(directory, ".orchestra/agent/maestro.md"), path.join(directory, ".orchestra/agents/maestro.md")]
  if (typeof file.path !== "string" || !allowed.includes(file.path) || typeof file.exists !== "boolean" ||
      typeof file.revision !== "string" || file.invalid === true)
    throw new Error("The ordinary Maestro file is invalid or outside the selected private workspace")
}
function object(value: unknown): Json {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Json : {}
}
function rows(value: unknown): Json[] {
  if (!Array.isArray(value)) throw new Error("Expected an actual API array")
  return value.map(object)
}
function pick(value: Json, fields: readonly string[]): Json {
  return Object.fromEntries(fields.filter((key) => Object.hasOwn(value, key)).map((key) => [key, value[key]]))
}
function without(value: Json, field: string): Json {
  return Object.fromEntries(Object.entries(value).filter(([key]) => key !== field))
}
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical)
  if (value !== null && typeof value === "object")
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(object(value)[key])]))
  return value
}
function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(canonical(value)) ?? "undefined").digest("hex")
}
