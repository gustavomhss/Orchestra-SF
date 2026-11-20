/** Pure F04 v1 manifest codec shared by the installed writer and reader.
 * This legacy project selector is preparatory infrastructure, not Teams authority.
 * Valid metadata never proves authentication, a live host or a passed journey.
 */
type RecordValue = Record<string, unknown>

function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}

function exactKeys(value: RecordValue, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key))
}

function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("F04_REQUIRED_REAL_TEXT_MISSING")
  return value
}

export type NativeTarget = Readonly<{
  serverKey: string
  discoveryOrigin: string
  shellOrigin: string
  publicOrigin: string
  installationId: string
  projectId: string
  hostId: string
  mount: string
  chapterHref: string
}>

export type NativeActor = "requester" | "holder" | "denied" | "dashboardAdmin"

type NativeBoundaries = Readonly<{
  target: NativeTarget
  wrongServer: NativeTarget
  wrongProject: NativeTarget
  wrongInstallation: NativeTarget
}>

export type NativeManifest = NativeBoundaries & Readonly<{
  schema: "sf2h.native-installed-manifest.v1"
  candidateSha: string
  actors: Readonly<{ requester: string; holder: string; denied: string; dashboardAdmin?: string }>
  scratchRoot: string
}>

export function validateNativeTarget(value: unknown): NativeTarget {
  if (!record(value) || !exactKeys(value, [
    "serverKey", "discoveryOrigin", "shellOrigin", "publicOrigin", "installationId",
    "projectId", "hostId", "mount", "chapterHref",
  ])) throw new Error("F04_MISSING_OR_EXTRA_REAL_TARGET_FIELD")
  const result: NativeTarget = {
    serverKey: requiredText(value.serverKey),
    discoveryOrigin: requiredText(value.discoveryOrigin),
    shellOrigin: requiredText(value.shellOrigin),
    publicOrigin: requiredText(value.publicOrigin),
    installationId: requiredText(value.installationId),
    projectId: requiredText(value.projectId),
    hostId: requiredText(value.hostId),
    mount: requiredText(value.mount),
    chapterHref: requiredText(value.chapterHref),
  }
  for (const source of [result.discoveryOrigin, result.shellOrigin, result.publicOrigin]) {
    const origin = new URL(source)
    if (origin.origin !== source || origin.username || origin.password ||
        (origin.protocol !== "https:" &&
          !(origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname))))
      throw new Error("F04_TARGET_ORIGIN_INVALID")
  }
  if (!/^\/[A-Za-z0-9_/-]+$/.test(result.mount) ||
      result.mount.includes("//") || result.mount.endsWith("/") ||
      !result.chapterHref.startsWith("/") || result.chapterHref.startsWith("//") ||
      new URL(result.chapterHref, result.shellOrigin).origin !== result.shellOrigin)
    throw new Error("F04_TARGET_MOUNT_OR_CHAPTER_INVALID")
  return result
}

/** Scope negatives use the same authenticated endpoint, changing one selector.
 * A different origin or mount could merely lose the cookie and would not isolate
 * a project/installation mismatch. The server negative keeps the shell but names
 * another discovery connection and target; metadata alone grants it no access.
 */
export function validateNativeBoundaries(value: Readonly<{
  target: unknown
  wrongServer: unknown
  wrongProject: unknown
  wrongInstallation: unknown
}>): NativeBoundaries {
  const target = validateNativeTarget(value.target)
  const wrongServer = validateNativeTarget(value.wrongServer)
  const wrongProject = validateNativeTarget(value.wrongProject)
  const wrongInstallation = validateNativeTarget(value.wrongInstallation)
  const sameEndpoint = [wrongProject, wrongInstallation].every((other) =>
    other.serverKey === target.serverKey && other.discoveryOrigin === target.discoveryOrigin &&
    other.shellOrigin === target.shellOrigin && other.publicOrigin === target.publicOrigin &&
    other.hostId === target.hostId && other.mount === target.mount)
  if (!sameEndpoint || wrongProject.projectId === target.projectId ||
      wrongProject.installationId !== target.installationId ||
      wrongInstallation.installationId === target.installationId ||
      wrongInstallation.projectId !== target.projectId ||
      wrongServer.serverKey === target.serverKey ||
      wrongServer.discoveryOrigin === target.discoveryOrigin ||
      wrongServer.shellOrigin !== target.shellOrigin ||
      (wrongServer.projectId === target.projectId &&
        wrongServer.installationId === target.installationId && wrongServer.hostId === target.hostId))
    throw new Error("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  return { target, wrongServer, wrongProject, wrongInstallation }
}

export function validateNativeManifest(value: unknown): NativeManifest {
  if (!record(value) || !exactKeys(value, [
    "schema", "candidateSha", "target", "wrongServer", "wrongProject",
    "wrongInstallation", "actors", "scratchRoot",
  ]) || value.schema !== "sf2h.native-installed-manifest.v1" || !record(value.actors) ||
      !(exactKeys(value.actors, ["requester", "holder", "denied"]) ||
        exactKeys(value.actors, ["requester", "holder", "denied", "dashboardAdmin"])))
    throw new Error("F04_REAL_INSTALLED_MANIFEST_INVALID")
  const actors = {
    requester: requiredText(value.actors.requester),
    holder: requiredText(value.actors.holder),
    denied: requiredText(value.actors.denied),
    ...(value.actors.dashboardAdmin === undefined ? {} :
      { dashboardAdmin: requiredText(value.actors.dashboardAdmin) }),
  }
  const candidateSha = requiredText(value.candidateSha)
  if (!/^[0-9a-f]{40}$/.test(candidateSha) ||
      new Set(Object.values(actors)).size !== Object.values(actors).length)
    throw new Error("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  return {
    schema: "sf2h.native-installed-manifest.v1",
    candidateSha,
    ...validateNativeBoundaries({
      target: value.target,
      wrongServer: value.wrongServer,
      wrongProject: value.wrongProject,
      wrongInstallation: value.wrongInstallation,
    }),
    actors,
    scratchRoot: requiredText(value.scratchRoot),
  }
}

/** This encoder validates metadata only; live admission remains the writer's job. */
export function serializeNativeManifest(value: NativeManifest): string {
  return JSON.stringify(validateNativeManifest(value)) + "\n"
}
