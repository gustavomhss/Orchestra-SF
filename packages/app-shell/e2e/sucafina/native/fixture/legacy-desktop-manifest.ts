/** Frozen Desktop-only v1 metadata reader. The SF Web F04 reader has no v1 fallback.
 * Teams v2 is rejected here before browser attachment, IPC or a resource read.
 * No legacy manifest writer or installation producer is exported. */
import path from "node:path"
import { lstat, readFile, realpath } from "node:fs/promises"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { requirePrivateNativeRoot, readPrivateNativeText } from "./readiness.ts"
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

export function validateLegacyDesktopManifest(value: unknown): NativeManifest {
  if (record(value) && value.schema === "sf2h.native-installed-manifest.v2")
    throw new Error("D01_TEAMS_MANIFEST_UNSUPPORTED")
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


export async function readNativeManifest(): Promise<NativeManifest> {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("F04_ACTIONS_ONLY")
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || !path.isAbsolute(file)) throw new Error("F04_REAL_INSTALLED_MANIFEST_REQUIRED")
  const raw: unknown = JSON.parse(await readPrivateNativeText(path.dirname(file), file, 65_536))
  const manifest = validateLegacyDesktopManifest(raw)
  if (process.env.SF_NATIVE_CANDIDATE_SHA !== manifest.candidateSha || manifest.scratchRoot !== path.dirname(file))
    throw new Error("F04_INSTALLED_CANDIDATE_NOT_BOUND_TO_RUNNER")
  return manifest
}
type NativeInstalledSuite = "U15" | "U39" | "U40"
type NativeInstalledCase = "list" | "editable" | "denied" | "stale" | "lost" | "entry"
type NativeJourney = "CAP14" | "CAP04" | "CAP05"
const specs = {
  U15: { capabilityId: "CAP14", cases: ["list", "editable", "denied", "stale", "lost"] },
  U39: { capabilityId: "CAP04", cases: ["entry"] },
  U40: { capabilityId: "CAP05", cases: ["entry"] },
} as const
const collections = { CAP14: "contracts", CAP04: "opexOwners", CAP05: "capexProjects" } as const
const entryPaths = { CAP14: "/orchestra/sf-procurement/contracts",
  CAP04: "/orchestra/sf-dashboard/opex", CAP05: "/orchestra/sf-dashboard/capex" } as const
function requireValue(ok: unknown, message: string): asserts ok { if (!ok) throw new Error(message) }
function exact(value: RecordValue, keys: string[]) { return exactKeys(value, keys) }
function selectionPath(manifest: NativeManifest, suite: NativeInstalledSuite) {
  return path.join(manifest.scratchRoot, "native-installed-" + suite.toLowerCase() + ".json")
}
function nativeJourneyEntryHref(target: NativeTarget, capabilityId: NativeJourney, year?: number) {
  if (year !== undefined && (!Number.isSafeInteger(year) || year < 2024 || year > 2100))
    throw new Error("F04_INVALID_PRODUCER_YEAR")
  const url = new URL(entryPaths[capabilityId], target.shellOrigin)
  if (year !== undefined) url.searchParams.set("year", String(year))
  return url.href
}
function nativeJourneyResolvedHref(target: NativeTarget, capabilityId: NativeJourney, resolvedHref: string) {
  const url = new URL(resolvedHref)
  if (url.origin !== target.shellOrigin || url.username || url.password || url.hash ||
      !url.pathname.startsWith(entryPaths[capabilityId] + "/") || url.pathname.includes("//"))
    throw new Error("F04_RESOLVED_SOURCE_ROUTE_OWNER_MISMATCH")
  return url.href
}
type NativeSourceVersion = Readonly<{ collection: "contracts" | "opexOwners" | "capexProjects";
  recordId: string; versionKey: string; version: number }>
type NativeSelectedInstallation = Readonly<{ schema: "sf2h.native-selected-installation.v1";
  suite: NativeInstalledSuite; candidateSha: string; serverKey: string; installationId: string;
  projectId: string; hostId: string; chapterHref: string; selections: readonly Readonly<{
    caseId: NativeInstalledCase; actor: NativeActor; href: string; route: SfResolvedRoute;
    intent: "read" | "edit" | "denied";
    observed: Readonly<{ principalRef: string; policyVersion: string; accessRevision: string }>;
    source: NativeSourceVersion | null
  }>[] }>
function selectedHref(manifest: NativeManifest, suite: NativeInstalledSuite, route: SfResolvedRoute): string {
  const spec = specs[suite]
  requireValue(record(route) && route.surfaceId === spec.capabilityId &&
    record(route.ownerSelection) &&
    route.ownerSelection.serverKey === manifest.target.serverKey &&
    route.ownerSelection.projectId === manifest.target.projectId &&
    (route.ownerSelection.installationId === undefined ||
      route.ownerSelection.installationId === manifest.target.installationId) &&
    typeof route.href === "string" && typeof route.pathname === "string" &&
    typeof route.kind === "string" && record(route.params) && record(route.query),
    "F04_ORIGINAL_F01_SELECTED_ROUTE_OWNER_REQUIRED")
  const url = new URL(route.href, manifest.target.shellOrigin)
  requireValue(url.origin === manifest.target.shellOrigin && !url.username && !url.password &&
    !url.hash && url.pathname === route.pathname && !url.pathname.includes("//") &&
    !/[\x00-\x1f\x7f]/.test(url.href),
    "F04_F01_ROUTE_NOT_BOUND_TO_ORIGINAL_SHELL")
  const installed = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
  const entry = new URL(nativeJourneyEntryHref(manifest.target, spec.capabilityId,
    suite === "U15" ? undefined : 2026))
  requireValue(suite === "U15"
    ? installed.origin === entry.origin && installed.search === entry.search &&
      (installed.pathname === entry.pathname ||
        installed.pathname.startsWith(entry.pathname + "/")) &&
      !installed.hash && !installed.username && !installed.password
    : installed.href === entry.href,
    "F04_SUITE_MUST_HAVE_EXACT_INSTALLED_CHAPTER_BINDING")
  if (suite !== "U15") {
    requireValue(route.kind === "entry" && url.href === entry.href && Object.keys(route.params).length === 0,
      "F04_BUDGET_F01_ENTRY_YEAR_2026_REQUIRED")
  } else {
    requireValue(url.search === installed.search &&
      (url.pathname === entry.pathname ||
        url.href === nativeJourneyResolvedHref(manifest.target, "CAP14", url.href)),
      "F04_U15_REAL_F01_CONTRACT_ROUTE_REQUIRED")
  }
  return url.href
}

export async function readNativeSelectedInstallation(
  manifest: NativeManifest, suite: NativeInstalledSuite,
): Promise<NativeSelectedInstallation> {
  const root = await requirePrivateNativeRoot(manifest.scratchRoot)
  const file = selectionPath(manifest, suite)
  const stat = await lstat(file).catch(() => {
    throw new Error("F04_PRIVATE_SELECTED_SUITE_FILE_REQUIRED_" + suite)
  })
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > 131072 ||
      (stat.mode & 0o077) !== 0 || await realpath(file) !== file ||
      path.dirname(file) !== root ||
      (typeof process.getuid === "function" && stat.uid !== process.getuid()))
    throw new Error("F04_SELECTED_SUITE_PRIVATE_FILE_INVALID")
  const bundle: unknown = JSON.parse(await readFile(file, "utf8"))
  const spec = specs[suite]
  if (!record(bundle) || !exact(bundle, [
    "schema", "suite", "candidateSha", "serverKey", "installationId",
    "projectId", "hostId", "chapterHref", "selections",
  ]) || bundle.schema !== "sf2h.native-selected-installation.v1" ||
      bundle.suite !== suite || bundle.candidateSha !== manifest.candidateSha ||
      bundle.serverKey !== manifest.target.serverKey ||
      bundle.installationId !== manifest.target.installationId ||
      bundle.projectId !== manifest.target.projectId ||
      bundle.hostId !== manifest.target.hostId ||
      bundle.chapterHref !== manifest.target.chapterHref ||
      !Array.isArray(bundle.selections) || bundle.selections.length !== spec.cases.length)
    throw new Error("F04_SELECTED_SUITE_CANDIDATE_OR_OWNER_MISMATCH")
  const selected = bundle.selections
  if (new Set(selected.map((row: unknown) => record(row) ? row.caseId : undefined)).size !== spec.cases.length)
    throw new Error("F04_PRIVATE_SUITE_CASE_SET_INVALID")
  for (const row of selected) {
    if (!record(row) || !exact(row, ["caseId", "actor", "href", "route", "intent", "observed", "source"]) ||
        !spec.cases.some((name) => name === row.caseId) ||
        !["requester", "holder", "denied", "dashboardAdmin"].includes(String(row.actor)) ||
        !record(row.observed) || row.observed.principalRef !== manifest.actors[row.actor as NativeActor] ||
        typeof row.observed.policyVersion !== "string" ||
        typeof row.observed.accessRevision !== "string" ||
        !record(row.route) || !record(row.route.ownerSelection) ||
        row.href !== selectedHref(manifest, suite, row.route as SfResolvedRoute) ||
        (row.caseId === "denied") !== (row.source === null))
      throw new Error("F04_PRIVATE_SELECTION_CONTRACT_INVALID")
    if (row.source !== null) {
      if (!record(row.source) || !exact(row.source, ["collection", "recordId", "versionKey", "version"]) ||
          row.source.collection !== collections[spec.capabilityId] ||
          row.source.versionKey !== row.source.collection + ":" + row.source.recordId ||
          typeof row.source.version !== "number" || !Number.isSafeInteger(row.source.version) ||
          row.source.version < 0)
        throw new Error("F04_PRIVATE_SOURCE_VERSION_RECORD_INVALID")
    }
  }
  return bundle as unknown as NativeSelectedInstallation
}


export function nativeSuiteFromChapter(manifest: NativeManifest): NativeInstalledSuite | undefined {
  const chapter = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
  return (Object.keys(specs) as NativeInstalledSuite[]).find((suite) => {
    const route = nativeJourneyEntryHref(manifest.target, specs[suite].capabilityId,
      suite === "U15" ? undefined : 2026)
    if (suite !== "U15") return chapter.href === route
    const entry = new URL(route)
    return chapter.origin === entry.origin && chapter.search === entry.search &&
      !chapter.hash && !chapter.username && !chapter.password &&
      (chapter.pathname === entry.pathname ||
        chapter.pathname.startsWith(entry.pathname + "/"))
  })
}
