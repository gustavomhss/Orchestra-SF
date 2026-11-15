// F04 native fixture: implementation only; installed/auth/desktop proof requires the real host.
import { lstat, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import { expect } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"

type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("F04_INVALID_PRIVATE_MANIFEST")
  return value
}
export type NativeTarget = Readonly<{
  serverKey: string
  // Orchestra SDK/discovery connection and shell UI are distinct from the SF host origin.
  discoveryOrigin: string
  shellOrigin: string
  publicOrigin: string
  installationId: string
  projectId: string
  hostId: string
  mount: string
  chapterHref: string
}>
export type NativeManifest = Readonly<{
  schema: "sf2h.native-installed-manifest.v1"
  candidateSha: string
  target: NativeTarget
  wrongServer: NativeTarget
  wrongProject: NativeTarget
  wrongInstallation: NativeTarget
  actors: Readonly<{ requester: string; holder: string; denied: string }>
  scratchRoot: string
}>
function target(value: unknown): NativeTarget {
  if (!record(value)) throw new Error("F04_MISSING_REAL_TARGET")
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
  if (!/^\/[A-Za-z0-9_\/-]+$/.test(result.mount) ||
      !result.chapterHref.startsWith("/") || result.chapterHref.startsWith("//") ||
      new URL(result.chapterHref, result.shellOrigin).origin !== result.shellOrigin)
    throw new Error("F04_TARGET_MOUNT_OR_CHAPTER_INVALID")
  return result
}

/** Only a private manifest emitted by the real installed host is admissible. */
export async function readNativeManifest(): Promise<NativeManifest> {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("F04_ACTIONS_ONLY")
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || !path.isAbsolute(file)) throw new Error("F04_REAL_INSTALLED_MANIFEST_REQUIRED")
  const metadata = await lstat(file)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 65_536 ||
      (metadata.mode & 0o077) !== 0 ||
      await realpath(file) !== path.resolve(file) ||
      (typeof process.getuid === "function" && metadata.uid !== process.getuid()))
    throw new Error("F04_PRIVATE_MANIFEST_ISOLATION_REQUIRED")
  const raw: unknown = JSON.parse(await readFile(file, "utf8"))
  if (!record(raw) || raw.schema !== "sf2h.native-installed-manifest.v1" || !record(raw.actors))
    throw new Error("F04_REAL_INSTALLED_MANIFEST_INVALID")
  const manifest: NativeManifest = {
    schema: "sf2h.native-installed-manifest.v1",
    candidateSha: requiredText(raw.candidateSha),
    target: target(raw.target),
    wrongServer: target(raw.wrongServer),
    wrongProject: target(raw.wrongProject),
    wrongInstallation: target(raw.wrongInstallation),
    actors: {
      requester: requiredText(raw.actors.requester),
      holder: requiredText(raw.actors.holder),
      denied: requiredText(raw.actors.denied),
    },
    scratchRoot: requiredText(raw.scratchRoot),
  }
  // The candidate binding comes from the authorized runner, never from the manifest alone.
  if (!process.env.SF_NATIVE_CANDIDATE_SHA ||
      process.env.SF_NATIVE_CANDIDATE_SHA !== manifest.candidateSha)
    throw new Error("F04_INSTALLED_CANDIDATE_NOT_BOUND_TO_RUNNER")
  if (!/^[0-9a-f]{40}$/.test(manifest.candidateSha) ||
      new Set(Object.values(manifest.actors)).size !== 3 ||
      manifest.target.serverKey === manifest.wrongServer.serverKey ||
      manifest.target.projectId === manifest.wrongProject.projectId ||
      manifest.target.installationId === manifest.wrongInstallation.installationId ||
      manifest.target.publicOrigin !== manifest.wrongProject.publicOrigin ||
      manifest.target.publicOrigin !== manifest.wrongInstallation.publicOrigin)
    throw new Error("F04_REAL_HOST_BOUNDARIES_NOT_DISTINCT")
  const scratch = await lstat(manifest.scratchRoot)
  if (!scratch.isDirectory() || scratch.isSymbolicLink() ||
      await realpath(manifest.scratchRoot) !== path.resolve(manifest.scratchRoot) ||
      (scratch.mode & 0o077) !== 0 ||
      (typeof process.getuid === "function" && scratch.uid !== process.getuid()))
    throw new Error("F04_PRIVATE_SCRATCH_ROOT_REQUIRED")
  return manifest
}

export type NativeWebObservation = Readonly<{
  proofClass: "WEB_INSTALLED_CONTEXT_OBSERVED"
  candidateSha: string
  installationId: string
  projectId: string
  hostId: string
  principalRef: string
  nativeChapterRendered: true
  transactionP0P1: "NOT_PROVEN_BY_READINESS"
  desktop: "NOT_PROVEN_REQUIRES_D01"
}>

/**
 * Call only AFTER the real login and real chapter mount. The caller provides
 * the exact installed chapter's visible locator; HTML from the legacy renderer
 * or a mock never satisfies a native mounting contract.
 */
export async function proveNativeWebReadiness(
  page: Page,
  manifest: NativeManifest,
  nativeChapter: Locator,
): Promise<NativeWebObservation> {
  const selected = manifest.target
  const actualURL = new URL(page.url())
  const expectedURL = new URL(selected.chapterHref, selected.shellOrigin)
  if (actualURL.origin !== selected.shellOrigin ||
      actualURL.pathname !== expectedURL.pathname ||
      actualURL.search !== expectedURL.search)
    throw new Error("F04_NOT_ON_THE_REAL_INSTALLED_NATIVE_CHAPTER")
  await expect(nativeChapter, "Native chapter must be present, not a mock/legacy page").toBeVisible()
  // Discovery belongs to the approved Orchestra connection, not the SF host.
  const installedURL = new URL("/api/sucafina/installations", selected.discoveryOrigin)
  installedURL.search = new URLSearchParams({
    select: "ids", installationId: selected.installationId, projectId: selected.projectId,
  }).toString()
  const discovery = await page.request.get(installedURL.toString(), { maxRedirects: 0, maxRetries: 0 })
  if (discovery.status() !== 200) throw new Error("F04_INSTALLED_DISCOVERY_UNAVAILABLE")
  const discovered: unknown = await discovery.json()
  if (!record(discovered) || !Array.isArray(discovered.installations) ||
      discovered.installations.length !== 1 ||
      !record(discovered.installations[0]) ||
      discovered.installations[0].installationId !== selected.installationId ||
      discovered.installations[0].projectId !== selected.projectId ||
      discovered.installations[0].hostId !== selected.hostId ||
      discovered.installations[0].publicOrigin !== selected.publicOrigin ||
      discovered.installations[0].mount !== selected.mount ||
      discovered.installations[0].contractRevision !== "sf-native-ui/1" ||
      !["local-operator", "microsoft"].includes(String(discovered.installations[0].authMode)))
    throw new Error("F04_DISCOVERY_OWNER_MISMATCH")
  const contextURL = new URL(selected.mount + "/api/ui/context", selected.publicOrigin)
  contextURL.search = new URLSearchParams({
    installationId: selected.installationId, projectId: selected.projectId, hostId: selected.hostId,
  }).toString()
  const response = await page.request.get(contextURL.toString(), { maxRedirects: 0, maxRetries: 0 })
  if (response.status() !== 200) throw new Error("F04_AUTHENTICATED_CONTEXT_NOT_READY")
  const context: unknown = await response.json()
  if (!record(context) || context.status !== "ok" || !record(context.value) ||
      !record(context.value.stamp) ||
      context.value.contractRevision !== "sf-native-ui/1" ||
      context.value.authMode !== discovered.installations[0].authMode ||
      !["local-operator", "microsoft"].includes(String(context.value.authMode)) ||
      !context.value.stamp.policyVersion || !context.value.stamp.accessRevision ||
      context.value.stamp.installationId !== selected.installationId ||
      context.value.stamp.projectId !== selected.projectId ||
      context.value.stamp.hostId !== selected.hostId)
    throw new Error("F04_CONTEXT_AUTHORITY_MISMATCH")
  const principalRef = requiredText(context.value.stamp.principalRef)
  if (!Object.values(manifest.actors).includes(principalRef))
    throw new Error("F04_CONTEXT_PRINCIPAL_NOT_IN_REAL_ACTORS")
  return {
    proofClass: "WEB_INSTALLED_CONTEXT_OBSERVED",
    candidateSha: manifest.candidateSha,
    installationId: selected.installationId,
    projectId: selected.projectId,
    hostId: selected.hostId,
    principalRef,
    nativeChapterRendered: true,
    transactionP0P1: "NOT_PROVEN_BY_READINESS",
    desktop: "NOT_PROVEN_REQUIRES_D01",
  }
}
