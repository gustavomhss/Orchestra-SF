/** G08's installed journeys do not exercise a foreign server. The original v2
 * remains strict and byte-identical; this additive contract records only used boundaries.
 * Neither schema supplies authentication or establishes a successful installed test. */
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { validateNativeInvocation, validateNativeManifest, validateNativeTarget, serializeNativeManifest } from "./manifest-contract.ts"
import type { NativeManifest, NativeTarget } from "./manifest-contract.ts"

type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}
function exact(value: RecordValue, fields: readonly string[]) {
  return Object.keys(value).length === fields.length && fields.every((field) => Object.hasOwn(value, field))
}
function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error("G08_NATIVE_REQUIRED_TEXT")
  return value
}
export type G08NativeBoundaries = Readonly<{
  target: NativeTarget; wrongTeam: NativeTarget; wrongInstallation: NativeTarget
}>
export type G08NativeManifest = G08NativeBoundaries & Readonly<{
  schema: "sf-g08-native-installed-v1"
  candidateSha: string
  invocation: NativeManifest["invocation"]
  actors: Readonly<{ requester: string; holder: string; denied: string; dashboardAdmin: string }>
  scratchRoot: string
}>
export type InstalledNativeManifest = NativeManifest | G08NativeManifest

export function validateG08NativeBoundaries(value: Readonly<{
  target: unknown; wrongTeam: unknown; wrongInstallation: unknown
}>): G08NativeBoundaries {
  const target = validateNativeTarget(value.target)
  const wrongTeam = validateNativeTarget(value.wrongTeam), wrongInstallation = validateNativeTarget(value.wrongInstallation)
  const fixed = ["serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin",
    "tenantId", "projectId", "hostId", "mount"] as const
  if (target.shellOrigin !== target.publicOrigin || target.discoveryOrigin !== target.publicOrigin ||
    ![wrongTeam, wrongInstallation].every((other) => fixed.every((key) => other[key] === target[key])) ||
    wrongTeam.teamObjectId === target.teamObjectId || wrongTeam.installationId !== target.installationId ||
    wrongInstallation.installationId === target.installationId || wrongInstallation.teamObjectId !== target.teamObjectId)
    throw new Error("G08_NATIVE_USED_BOUNDARIES_NOT_DISTINCT")
  return { target, wrongTeam, wrongInstallation }
}
export function validateG08NativeManifest(value: unknown): G08NativeManifest {
  if (!record(value) || !exact(value, ["schema", "candidateSha", "invocation", "target",
    "wrongTeam", "wrongInstallation", "actors", "scratchRoot"]) || value.schema !== "sf-g08-native-installed-v1" ||
    !record(value.actors) || !exact(value.actors, ["requester", "holder", "denied", "dashboardAdmin"]))
    throw new Error("G08_NATIVE_MANIFEST_INVALID")
  const principal = (value: unknown) => Schema.decodeUnknownSync(TeamProfile.PrincipalObjectId)(text(value))
  const actors = { requester: principal(value.actors.requester), holder: principal(value.actors.holder),
    denied: principal(value.actors.denied), dashboardAdmin: principal(value.actors.dashboardAdmin) }
  const candidateSha = text(value.candidateSha)
  if (!/^[a-f0-9]{40}$/.test(candidateSha) || new Set(Object.values(actors)).size !== 4)
    throw new Error("G08_NATIVE_CANDIDATE_OR_ACTORS_INVALID")
  return { schema: "sf-g08-native-installed-v1", candidateSha, invocation: validateNativeInvocation(value.invocation),
    ...validateG08NativeBoundaries({ target: value.target, wrongTeam: value.wrongTeam, wrongInstallation: value.wrongInstallation }),
    actors, scratchRoot: text(value.scratchRoot) }
}
/** Explicit schema dispatch. Incomplete historical v2 never falls back to G08. */
export function validateInstalledNativeManifest(value: unknown): InstalledNativeManifest {
  if (!record(value)) throw new Error("G08_NATIVE_SCHEMA_REQUIRED")
  if (value.schema === "sf2h.native-installed-manifest.v2") return validateNativeManifest(value)
  if (value.schema === "sf-g08-native-installed-v1") return validateG08NativeManifest(value)
  throw new Error("G08_NATIVE_SCHEMA_REQUIRED")
}
export function serializeG08NativeManifest(value: G08NativeManifest): string {
  return JSON.stringify(validateG08NativeManifest(value)) + "\n"
}
export function serializeInstalledNativeManifest(value: InstalledNativeManifest): string {
  return value.schema === "sf2h.native-installed-manifest.v2"
    ? serializeNativeManifest(value) : serializeG08NativeManifest(value)
}
