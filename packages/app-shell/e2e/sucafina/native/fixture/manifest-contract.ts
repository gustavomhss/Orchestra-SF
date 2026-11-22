/** F04 v2: closed Teams metadata shared by the installed writer and reader.
 * It records an invocation and selection, never membership or authority.
 * projectId/hostId are technical provenance and are never profile selectors.
 */
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
}
function exactKeys(value: RecordValue, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}
function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value.trim() || value.length > 2048 || /[\u0000-\u001f\u007f]/.test(value))
    throw new Error("F04_REQUIRED_REAL_TEXT_MISSING")
  return value
}
const strict = { onExcessProperty: "error" } as const
export type NativeTarget = Readonly<{
  serverKey: string
  discoveryOrigin: string
  shellOrigin: string
  publicOrigin: string
  installationId: TeamProfile.InstallationId
  tenantId: TeamProfile.TenantId
  teamObjectId: TeamProfile.TeamObjectId
  /** Fixed installed workspace provenance; never the corporate profile. */
  projectId: string
  hostId: string
  mount: string
  chapterHref: string
}>
export type NativeActor = "requester" | "holder" | "denied" | "dashboardAdmin"
export type NativeRole = "teams" | "u15" | "u39" | "u40" | "recovery"
export type NativeInvocation = Readonly<{
  treeSha: string; runId: string; runAttempt: string; role: NativeRole
  invocationId: string; archiveSha256: string
}>
export type NativeBoundaries = Readonly<{
  target: NativeTarget; wrongServer: NativeTarget; wrongTeam: NativeTarget; wrongInstallation: NativeTarget
}>
export type NativeManifest = NativeBoundaries & Readonly<{
  schema: "sf2h.native-installed-manifest.v2"
  candidateSha: string
  invocation: NativeInvocation
  actors: Readonly<{ requester: string; holder: string; denied: string; dashboardAdmin?: string }>
  scratchRoot: string
}>

export function nativeTeamRef(target: NativeTarget): TeamProfile.Ref {
  return Schema.decodeUnknownSync(TeamProfile.Ref, strict)({
    installationId: target.installationId, tenantId: target.tenantId, teamObjectId: target.teamObjectId,
  })
}
export function nativeOwnerQuery(target: NativeTarget) {
  return new URLSearchParams({
    contractRevision: "sf-team-profile/1", server: target.serverKey,
    installationId: target.installationId, tenantId: target.tenantId, teamObjectId: target.teamObjectId,
  })
}
export function validateNativeTarget(value: unknown): NativeTarget {
  if (!record(value) || !exactKeys(value, [
    "serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin", "installationId",
    "tenantId", "teamObjectId", "projectId", "hostId", "mount", "chapterHref",
  ])) throw new Error("F04_MISSING_OR_EXTRA_REAL_TARGET_FIELD")
  const profile = Schema.decodeUnknownSync(TeamProfile.Ref, strict)({
    installationId: value.installationId, tenantId: value.tenantId, teamObjectId: value.teamObjectId,
  })
  const result: NativeTarget = {
    serverKey: requiredText(value.serverKey), discoveryOrigin: requiredText(value.discoveryOrigin),
    shellOrigin: requiredText(value.shellOrigin), publicOrigin: requiredText(value.publicOrigin),
    ...profile, projectId: requiredText(value.projectId), hostId: requiredText(value.hostId),
    mount: requiredText(value.mount), chapterHref: requiredText(value.chapterHref),
  }
  for (const source of [result.serverKey, result.discoveryOrigin, result.shellOrigin, result.publicOrigin]) {
    const origin = new URL(source)
    if (origin.origin !== source || origin.username || origin.password || origin.protocol !== "https:")
      throw new Error("F04_TARGET_ORIGIN_INVALID")
  }
  // The shipped corporate shell uses the exact installed public origin as its server key.
  if (result.serverKey !== result.publicOrigin ||
      !/^\/[A-Za-z0-9_/-]+$/.test(result.mount) || result.mount.includes("//") ||
      result.mount.endsWith("/") || !result.chapterHref.startsWith("/") || result.chapterHref.startsWith("//"))
    throw new Error("F04_TARGET_MOUNT_OR_CHAPTER_INVALID")
  const chapter = new URL(result.chapterHref, result.shellOrigin)
  if (chapter.origin !== result.shellOrigin || chapter.username || chapter.password || chapter.hash ||
      !chapter.pathname.startsWith("/orchestra/sf-") || chapter.pathname.includes("//") ||
      /%(?![\da-fA-F]{2})/.test(chapter.search))
    throw new Error("F04_TARGET_MOUNT_OR_CHAPTER_INVALID")
  const expected = nativeOwnerQuery(result)
  const extras = [...chapter.searchParams.keys()].filter((key) => !expected.has(key))
  if ([...chapter.searchParams.keys()].some((key) => chapter.searchParams.getAll(key).length !== 1) ||
      [...expected].some(([key, entry]) => chapter.searchParams.get(key) !== entry) ||
      extras.some((key) => key !== "year") ||
      (chapter.searchParams.has("year") && !/^(?:202[4-9]|20[3-9][0-9]|2100)$/.test(chapter.searchParams.get("year")!)))
    throw new Error("F04_CLOSED_TEAMS_CHAPTER_REQUIRED")
  return result
}

/** Scope negatives keep the same endpoint/cookie and alter exactly one Team
 * selector. A different cookie origin cannot masquerade as cross-owner denial. */
export function validateNativeBoundaries(value: Readonly<{
  target: unknown; wrongServer: unknown; wrongTeam: unknown; wrongInstallation: unknown
}>): NativeBoundaries {
  const target = validateNativeTarget(value.target), wrongServer = validateNativeTarget(value.wrongServer)
  const wrongTeam = validateNativeTarget(value.wrongTeam), wrongInstallation = validateNativeTarget(value.wrongInstallation)
  const sameEndpoint = [wrongTeam, wrongInstallation].every((other) =>
    other.serverKey === target.serverKey && other.discoveryOrigin === target.discoveryOrigin &&
    other.shellOrigin === target.shellOrigin && other.publicOrigin === target.publicOrigin &&
    other.hostId === target.hostId && other.projectId === target.projectId && other.mount === target.mount &&
    other.tenantId === target.tenantId)
  if (target.shellOrigin !== target.publicOrigin || !sameEndpoint || wrongTeam.teamObjectId === target.teamObjectId ||
      wrongTeam.installationId !== target.installationId ||
      wrongInstallation.installationId === target.installationId ||
      wrongInstallation.teamObjectId !== target.teamObjectId ||
      wrongServer.serverKey === target.serverKey || wrongServer.discoveryOrigin === target.discoveryOrigin ||
      wrongServer.shellOrigin !== target.shellOrigin ||
      (wrongServer.installationId === target.installationId && wrongServer.tenantId === target.tenantId &&
        wrongServer.teamObjectId === target.teamObjectId && wrongServer.hostId === target.hostId))
    throw new Error("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  return { target, wrongServer, wrongTeam, wrongInstallation }
}

export function validateNativeInvocation(value: unknown): NativeInvocation {
  if (!record(value) || !exactKeys(value, ["treeSha", "runId", "runAttempt", "role", "invocationId", "archiveSha256"]) ||
      typeof value.treeSha !== "string" || !/^[a-f0-9]{40}$/.test(value.treeSha) ||
      typeof value.runId !== "string" || !/^[1-9][0-9]*$/.test(value.runId) ||
      typeof value.runAttempt !== "string" || !/^[1-9][0-9]*$/.test(value.runAttempt) ||
      typeof value.invocationId !== "string" || !/^[a-f0-9]{32}$/.test(value.invocationId) ||
      typeof value.archiveSha256 !== "string" || !/^[a-f0-9]{64}$/.test(value.archiveSha256) ||
      value.role !== "teams" && value.role !== "u15" && value.role !== "u39" && value.role !== "u40" && value.role !== "recovery")
    throw new Error("F04_REAL_INVOCATION_BINDING_INVALID")
  return { treeSha: value.treeSha, runId: value.runId, runAttempt: value.runAttempt,
    role: value.role, invocationId: value.invocationId, archiveSha256: value.archiveSha256 }
}
export function validateNativeManifest(value: unknown): NativeManifest {
  if (!record(value) || !exactKeys(value, [
    "schema", "candidateSha", "invocation", "target", "wrongServer", "wrongTeam", "wrongInstallation", "actors", "scratchRoot",
  ]) || value.schema !== "sf2h.native-installed-manifest.v2" || !record(value.actors) ||
      !(exactKeys(value.actors, ["requester", "holder", "denied"]) ||
        exactKeys(value.actors, ["requester", "holder", "denied", "dashboardAdmin"])))
    throw new Error("F04_REAL_INSTALLED_MANIFEST_INVALID")
  const actor = (entry: unknown) => Schema.decodeUnknownSync(TeamProfile.PrincipalObjectId)(requiredText(entry))
  const actors = {
    requester: actor(value.actors.requester), holder: actor(value.actors.holder), denied: actor(value.actors.denied),
    ...(value.actors.dashboardAdmin === undefined ? {} : { dashboardAdmin: actor(value.actors.dashboardAdmin) }),
  }
  const candidateSha = requiredText(value.candidateSha)
  if (!/^[a-f0-9]{40}$/.test(candidateSha) || new Set(Object.values(actors)).size !== Object.values(actors).length)
    throw new Error("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  return { schema: "sf2h.native-installed-manifest.v2", candidateSha,
    invocation: validateNativeInvocation(value.invocation),
    ...validateNativeBoundaries({ target: value.target, wrongServer: value.wrongServer,
      wrongTeam: value.wrongTeam, wrongInstallation: value.wrongInstallation }),
    actors, scratchRoot: requiredText(value.scratchRoot) }
}
export function serializeNativeManifest(value: NativeManifest): string {
  return JSON.stringify(validateNativeManifest(value)) + "\n"
}
