// F04: original installed Microsoft contexts only; metadata never supplies authentication.
import { constants } from "node:fs"
import { lstat, open, realpath } from "node:fs/promises"
import path from "node:path"
import { Schema } from "effect"
import { SfInstallationList, SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import type { SfTeamContext } from "@orchestra/schema/sucafina/context"
import { expect } from "@playwright/test"
import { nativeOriginalRequest } from "./browser-transport.ts"
import type { Locator, Page } from "@playwright/test"
import { nativeTeamRef, serializeNativeManifest, validateNativeManifest, validateNativeTarget } from "./manifest-contract.ts"
import type { NativeManifest, NativeTarget } from "./manifest-contract.ts"

export { validateNativeTarget } from "./manifest-contract.ts"
export type { NativeActor, NativeInvocation, NativeManifest, NativeRole, NativeTarget } from "./manifest-contract.ts"
const strict = { onExcessProperty: "error" } as const

export async function requirePrivateNativeRoot(root: string): Promise<string> {
  if (!path.isAbsolute(root) || path.resolve(root) !== root) throw new Error("F04_SCRATCH_ABSOLUTE_PATH_REQUIRED")
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(root) !== root ||
      (info.mode & 0o777) !== 0o700 ||
      (typeof process.getuid === "function" && info.uid !== process.getuid()))
    throw new Error("F04_PRIVATE_SCRATCH_ROOT_REQUIRED")
  return root
}

/** Open the same regular private file that was inspected; bounded bytes and no symlink follow. */
export async function readPrivateNativeText(rootPath: string, file: string, maximum: number): Promise<string> {
  const root = await requirePrivateNativeRoot(rootPath)
  if (!path.isAbsolute(file) || path.resolve(file) !== file || path.dirname(file) !== root)
    throw new Error("F04_PRIVATE_FILE_OUTSIDE_OWNED_ROOT")
  const before = await lstat(file)
  if (!before.isFile() || before.isSymbolicLink() || before.size === 0 || before.size > maximum ||
      (before.mode & 0o777) !== 0o600 || await realpath(file) !== file ||
      (typeof process.getuid === "function" && before.uid !== process.getuid()))
    throw new Error("F04_PRIVATE_FILE_ISOLATION_REQUIRED")
  const handle = await open(file, constants.O_RDONLY | constants.O_NOFOLLOW)
  try {
    const current = await handle.stat()
    if (!current.isFile() || current.dev !== before.dev || current.ino !== before.ino ||
        current.uid !== before.uid || current.mode !== before.mode || current.size !== before.size)
      throw new Error("F04_PRIVATE_FILE_CHANGED_DURING_OPEN")
    const bytes = await handle.readFile()
    if (bytes.byteLength !== current.size || bytes.byteLength > maximum)
      throw new Error("F04_PRIVATE_FILE_CHANGED_DURING_READ")
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes)
  } finally { await handle.close() }
}

export function requireNativeInvocation(manifest: Pick<NativeManifest, "candidateSha" | "invocation">) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.CI !== "true" ||
      process.env.SF_NATIVE_CANDIDATE_SHA !== manifest.candidateSha ||
      process.env.GITHUB_RUN_ID !== manifest.invocation.runId ||
      process.env.GITHUB_RUN_ATTEMPT !== manifest.invocation.runAttempt ||
      process.env.SF_NATIVE_INVOCATION_ID !== manifest.invocation.invocationId)
    throw new Error("F04_INSTALLED_INVOCATION_NOT_BOUND_TO_RUNNER")
}

/** The only Web reader accepts v2, including original writer serialization.
 * No v1/project fallback and no duplicate or escaped-duplicate JSON keys. */
export async function readNativeManifest(): Promise<NativeManifest> {
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || !path.isAbsolute(file)) throw new Error("F04_REAL_INSTALLED_MANIFEST_REQUIRED")
  const text = await readPrivateNativeText(path.dirname(file), file, 65_536)
  const manifest = validateNativeManifest(JSON.parse(text))
  if (text !== serializeNativeManifest(manifest) || manifest.scratchRoot !== path.dirname(file))
    throw new Error("F04_PRIVATE_MANIFEST_WRITER_CONTRACT_REQUIRED")
  requireNativeInvocation(manifest)
  return manifest
}

export type NativeLiveDestination = SfTeamContext["destinations"][number]
export type NativeLiveBinding = SfTeamContext

export function nativeContextURL(target: NativeTarget): string {
  const selected = validateNativeTarget(target)
  const url = new URL(selected.mount + "/api/ui/context", selected.publicOrigin)
  url.search = new URLSearchParams({
    contractRevision: "sf-team-profile/1", installationId: selected.installationId,
    tenantId: selected.tenantId, hostId: selected.hostId, kind: "team", teamObjectId: selected.teamObjectId,
  }).toString()
  return url.href
}
export function nativeTeamHeaders(target: NativeTarget) {
  return { "x-sf-team-profile": JSON.stringify({
    contractRevision: "sf-team-profile/1", kind: "team", profile: nativeTeamRef(target),
  }) }
}

/** Original Playwright context cookie jar only. Discovery records installation
 * metadata; the following original F02 read is the independent current authority. */
export async function observeNativeBinding(page: Page, target: NativeTarget): Promise<NativeLiveBinding> {
  const selected = validateNativeTarget(target)
  if (new URL(page.url()).origin !== selected.shellOrigin)
    throw new Error("F04_ACTOR_NOT_IN_APPROVED_PRODUCTION_SHELL")
  const discoveryURL = new URL("/api/sucafina/installations", selected.discoveryOrigin)
  discoveryURL.search = new URLSearchParams({
    select: "current", contractRevision: "sf-team-profile/1",
  }).toString()
  const discovery = await nativeOriginalRequest(page, discoveryURL.href)
  if (discovery.status() !== 200) throw new Error("F04_INSTALLED_DISCOVERY_UNAVAILABLE_" + discovery.status())
  const discovered = Schema.decodeUnknownSync(Schema.toCodecJson(SfInstallationList), strict)(await discovery.json())
  if (discovered.installations.length !== 1) throw new Error("F04_DISCOVERY_OWNER_MISMATCH")
  const descriptor = discovered.installations[0]!
  if (descriptor.contractRevision !== "sf-team-profile/1" || descriptor.authMode !== "microsoft" ||
      descriptor.installationId !== selected.installationId || descriptor.tenantId !== selected.tenantId ||
      descriptor.projectId !== selected.projectId || descriptor.hostId !== selected.hostId ||
      descriptor.publicOrigin !== selected.publicOrigin || descriptor.mount !== selected.mount)
    throw new Error("F04_DISCOVERY_OWNER_MISMATCH")
  const response = await nativeOriginalRequest(page, nativeContextURL(selected))
  if (response.status() !== 200) throw new Error("F04_AUTHENTICATED_CONTEXT_NOT_READY_" + response.status())
  const result = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult), strict)(await response.json())
  if (result.status !== "ok") throw new Error("F04_CONTEXT_AUTHORITY_MISMATCH")
  const value = result.value, stamp = value.stamp, state = value.profile.teams
  if (stamp.installationId !== selected.installationId || stamp.projectId !== selected.projectId ||
      stamp.hostId !== selected.hostId || value.profile.principal.tenantId !== selected.tenantId ||
      state.status === "ready" && (state.selected.installationId !== selected.installationId ||
        state.selected.tenantId !== selected.tenantId || state.selected.teamObjectId !== selected.teamObjectId) ||
      stamp.team && (stamp.team.owner.profile.teamObjectId !== selected.teamObjectId ||
        stamp.team.owner.profile.tenantId !== selected.tenantId ||
        stamp.team.owner.profile.installationId !== selected.installationId))
    throw new Error("F04_CONTEXT_BINDING_MISMATCH")
  if (new Set(value.destinations.map((entry) => entry.capabilityId)).size !== value.destinations.length)
    throw new Error("F04_DUPLICATE_LIVE_DESTINATION")
  return value
}

export type NativeWebObservation = Readonly<{
  proofClass: "WEB_INSTALLED_CONTEXT_OBSERVED"; candidateSha: string
  installationId: string; tenantId: string; teamObjectId?: string
  projectId: string; hostId: string; principalRef: string
  nativeChapterLocatorVisible: true; nativeChapterRendered: "NOT_PROVEN_BY_LOCATOR_ALONE"
  transactionP0P1: "NOT_PROVEN_BY_READINESS"; desktop: "NOT_PROVEN_REQUIRES_D01"
}>
export async function proveNativeWebReadiness(
  page: Page, manifest: Pick<NativeManifest, "candidateSha" | "target" | "actors">, nativeChapter: Locator,
): Promise<NativeWebObservation> {
  const actualURL = new URL(page.url()), expectedURL = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
  if (actualURL.origin !== manifest.target.shellOrigin || actualURL.pathname !== expectedURL.pathname ||
      actualURL.search !== expectedURL.search)
    throw new Error("F04_NOT_ON_THE_REAL_INSTALLED_NATIVE_CHAPTER")
  await expect(nativeChapter, "The original native chapter must be visible").toBeVisible()
  const live = await observeNativeBinding(page, manifest.target)
  if (!Object.values(manifest.actors).includes(live.stamp.principalRef))
    throw new Error("F04_CONTEXT_PRINCIPAL_NOT_IN_REAL_ACTORS")
  return { proofClass: "WEB_INSTALLED_CONTEXT_OBSERVED", candidateSha: manifest.candidateSha,
    installationId: live.stamp.installationId, tenantId: live.profile.principal.tenantId,
    ...(live.profile.teams.status === "ready" ? { teamObjectId: live.profile.teams.selected.teamObjectId } : {}),
    projectId: live.stamp.projectId,
    hostId: live.stamp.hostId, principalRef: live.stamp.principalRef, nativeChapterLocatorVisible: true,
    nativeChapterRendered: "NOT_PROVEN_BY_LOCATOR_ALONE", transactionP0P1: "NOT_PROVEN_BY_READINESS",
    desktop: "NOT_PROVEN_REQUIRES_D01" }
}
