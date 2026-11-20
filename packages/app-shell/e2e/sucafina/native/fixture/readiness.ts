// F04: live installed-host observation. Never supplies authentication or a fake server.
import { lstat, readFile, realpath } from "node:fs/promises"
import path from "node:path"
import { expect } from "@playwright/test"
import type { Locator, Page } from "@playwright/test"
import { validateNativeManifest } from "./manifest-contract.ts"
import type { NativeManifest, NativeTarget } from "./manifest-contract.ts"

export { validateNativeTarget } from "./manifest-contract.ts"
export type { NativeActor, NativeManifest, NativeTarget } from "./manifest-contract.ts"

type RecordValue = Record<string, unknown>
function record(value: unknown): value is RecordValue {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
function requiredText(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("F04_REQUIRED_REAL_TEXT_MISSING")
  return value
}

export async function requirePrivateNativeRoot(root: string): Promise<string> {
  if (!path.isAbsolute(root) || path.resolve(root) !== root) throw new Error("F04_SCRATCH_ABSOLUTE_PATH_REQUIRED")
  const info = await lstat(root)
  if (!info.isDirectory() || info.isSymbolicLink() || await realpath(root) !== root ||
      (info.mode & 0o077) !== 0 ||
      (typeof process.getuid === "function" && info.uid !== process.getuid()))
    throw new Error("F04_PRIVATE_SCRATCH_ROOT_REQUIRED")
  return root
}

/** The runner must emit this 0600 file after binding live sessions; a filename
 * or an environment flag alone is never evidence of login or producer access. */
export async function readNativeManifest(): Promise<NativeManifest> {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("F04_ACTIONS_ONLY")
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || !path.isAbsolute(file)) throw new Error("F04_REAL_INSTALLED_MANIFEST_REQUIRED")
  const metadata = await lstat(file)
  if (!metadata.isFile() || metadata.isSymbolicLink() || metadata.size > 65_536 ||
      (metadata.mode & 0o077) !== 0 || await realpath(file) !== path.resolve(file) ||
      (typeof process.getuid === "function" && metadata.uid !== process.getuid()))
    throw new Error("F04_PRIVATE_MANIFEST_ISOLATION_REQUIRED")
  const raw: unknown = JSON.parse(await readFile(file, "utf8"))
  const manifest = validateNativeManifest(raw)
  if (!process.env.SF_NATIVE_CANDIDATE_SHA ||
      process.env.SF_NATIVE_CANDIDATE_SHA !== manifest.candidateSha)
    throw new Error("F04_INSTALLED_CANDIDATE_NOT_BOUND_TO_RUNNER")
  await requirePrivateNativeRoot(manifest.scratchRoot)
  if (path.dirname(path.resolve(file)) !== manifest.scratchRoot)
    throw new Error("F04_MANIFEST_MUST_BE_INSIDE_PRIVATE_INSTALLATION_ROOT")
  return manifest
}

export type NativeLiveDestination = Readonly<{
  capabilityId: string
  surface: "dashboard" | "planner" | "procurement"
  page: string
  canRead: boolean
  allowedActionIds: readonly string[]
}>
export type NativeLiveBinding = Readonly<{
  authMode: "microsoft" | "local-operator"
  stamp: Readonly<{
    installationId: string; projectId: string; hostId: string; principalRef: string
    policyVersion: string; accessRevision: string
  }>
  destinations: readonly NativeLiveDestination[]
}>

/** Uses the original Playwright BrowserContext's cookie jar, after legitimate
 * host login. No headers/tokens/storageState are created or supplied here. */
export async function observeNativeBinding(page: Page, selected: NativeTarget): Promise<NativeLiveBinding> {
  const discoveryURL = new URL("/api/sucafina/installations", selected.discoveryOrigin)
  discoveryURL.search = new URLSearchParams({
    select: "ids", installationId: selected.installationId, projectId: selected.projectId,
  }).toString()
  const discovery = await page.request.get(discoveryURL.toString(), { maxRedirects: 0, maxRetries: 0 })
  if (discovery.status() !== 200) throw new Error("F04_INSTALLED_DISCOVERY_UNAVAILABLE_" + discovery.status())
  const discovered: unknown = await discovery.json()
  if (!record(discovered) || !Array.isArray(discovered.installations) ||
      discovered.installations.length !== 1 || !record(discovered.installations[0]))
    throw new Error("F04_DISCOVERY_OWNER_MISMATCH")
  const descriptor = discovered.installations[0]
  if (descriptor.installationId !== selected.installationId ||
      descriptor.projectId !== selected.projectId || descriptor.hostId !== selected.hostId ||
      descriptor.publicOrigin !== selected.publicOrigin || descriptor.mount !== selected.mount ||
      descriptor.contractRevision !== "sf-native-ui/1" ||
      (descriptor.authMode !== "microsoft" && descriptor.authMode !== "local-operator"))
    throw new Error("F04_DISCOVERY_OWNER_MISMATCH")
  const contextURL = new URL(selected.mount + "/api/ui/context", selected.publicOrigin)
  contextURL.search = new URLSearchParams({
    installationId: selected.installationId, projectId: selected.projectId, hostId: selected.hostId,
  }).toString()
  const response = await page.request.get(contextURL.toString(), { maxRedirects: 0, maxRetries: 0 })
  if (response.status() !== 200) throw new Error("F04_AUTHENTICATED_CONTEXT_NOT_READY_" + response.status())
  const context: unknown = await response.json()
  if (!record(context) || context.status !== "ok" || !record(context.value) ||
      context.value.contractRevision !== "sf-native-ui/1" ||
      context.value.authMode !== descriptor.authMode || !record(context.value.stamp) ||
      !Array.isArray(context.value.destinations))
    throw new Error("F04_CONTEXT_AUTHORITY_MISMATCH")
  const stamp = context.value.stamp
  if (stamp.installationId !== selected.installationId ||
      stamp.projectId !== selected.projectId || stamp.hostId !== selected.hostId)
    throw new Error("F04_CONTEXT_BINDING_MISMATCH")
  const destinations: NativeLiveDestination[] = context.value.destinations.map((value: unknown) => {
    if (!record(value) || !Array.isArray(value.allowedActionIds) ||
        !value.allowedActionIds.every((action: unknown) => typeof action === "string" && !!action.trim()) ||
        typeof value.canRead !== "boolean" ||
        !["dashboard", "planner", "procurement"].includes(String(value.surface)))
      throw new Error("F04_REAL_DESTINATION_INVALID")
    return {
      capabilityId: requiredText(value.capabilityId),
      surface: value.surface as NativeLiveDestination["surface"],
      page: requiredText(value.page),
      canRead: value.canRead,
      allowedActionIds: value.allowedActionIds,
    }
  })
  if (new Set(destinations.map((value) => value.capabilityId)).size !== destinations.length)
    throw new Error("F04_DUPLICATE_LIVE_DESTINATION")
  return {
    authMode: descriptor.authMode,
    stamp: {
      installationId: selected.installationId, projectId: selected.projectId,
      hostId: selected.hostId, principalRef: requiredText(stamp.principalRef),
      policyVersion: requiredText(stamp.policyVersion),
      accessRevision: requiredText(stamp.accessRevision),
    },
    destinations,
  }
}

export type NativeWebObservation = Readonly<{
  proofClass: "WEB_INSTALLED_CONTEXT_OBSERVED"
  candidateSha: string
  installationId: string
  projectId: string
  hostId: string
  principalRef: string
  nativeChapterLocatorVisible: true
  nativeChapterRendered: "NOT_PROVEN_BY_LOCATOR_ALONE"
  transactionP0P1: "NOT_PROVEN_BY_READINESS"
  desktop: "NOT_PROVEN_REQUIRES_D01"
}>

export async function proveNativeWebReadiness(
  page: Page, manifest: NativeManifest, nativeChapter: Locator,
): Promise<NativeWebObservation> {
  const actualURL = new URL(page.url())
  const expectedURL = new URL(manifest.target.chapterHref, manifest.target.shellOrigin)
  if (actualURL.origin !== manifest.target.shellOrigin ||
      actualURL.pathname !== expectedURL.pathname || actualURL.search !== expectedURL.search)
    throw new Error("F04_NOT_ON_THE_REAL_INSTALLED_NATIVE_CHAPTER")
  await expect(nativeChapter, "A native chapter, not a mock or legacy page, must be visible").toBeVisible()
  const live = await observeNativeBinding(page, manifest.target)
  if (!Object.values(manifest.actors).includes(live.stamp.principalRef))
    throw new Error("F04_CONTEXT_PRINCIPAL_NOT_IN_REAL_ACTORS")
  return {
    proofClass: "WEB_INSTALLED_CONTEXT_OBSERVED", candidateSha: manifest.candidateSha,
    installationId: live.stamp.installationId, projectId: live.stamp.projectId,
    hostId: live.stamp.hostId, principalRef: live.stamp.principalRef,
    nativeChapterLocatorVisible: true,
    nativeChapterRendered: "NOT_PROVEN_BY_LOCATOR_ALONE",
    transactionP0P1: "NOT_PROVEN_BY_READINESS", desktop: "NOT_PROVEN_REQUIRES_D01",
  }
}
