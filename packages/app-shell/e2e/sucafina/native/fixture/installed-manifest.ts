/** F04 installed-session manifest factory.
 * Called only by the authorized GitHub Actions host installer, after its
 * original connection, provisioning and browser sign-ins have completed.
 * It never creates credentials, principals, cookies, grants or a listener.
 */
import { open, rm } from "node:fs/promises"
import path from "node:path"
import type { Page } from "@playwright/test"
import {
  observeNativeBinding, requirePrivateNativeRoot,
} from "./readiness.ts"
import { serializeNativeManifest, validateNativeBoundaries } from "./manifest-contract.ts"
import type { NativeManifest, NativeTarget } from "./manifest-contract.ts"

type ActorPages = Readonly<{
  requester: Page
  holder: Page
  denied: Page
  dashboardAdmin?: Page
}>

type ApprovedConnection = Readonly<{
  serverKey: string
  projectId: string
  origin: string
}>

export type NativeInstalledRegistration = Readonly<{
  scratchRoot: string
  candidateSha: string
  target: NativeTarget
  wrongServer: NativeTarget
  wrongProject: NativeTarget
  wrongInstallation: NativeTarget
  actors: ActorPages
  /** Must query the real, already-approved connection registry, not env input. */
  resolveApprovedConnection: (serverKey: string) => Promise<ApprovedConnection | undefined>
}>

export async function registerNativeInstalledManifest(input: NativeInstalledRegistration) {
  if (process.env.GITHUB_ACTIONS !== "true") throw new Error("F04_ACTIONS_ONLY")
  if (!/^[0-9a-f]{40}$/.test(input.candidateSha) ||
      process.env.SF_NATIVE_CANDIDATE_SHA !== input.candidateSha)
    throw new Error("F04_CANDIDATE_MUST_MATCH_AUTHORIZED_RUNNER")
  const root = await requirePrivateNativeRoot(input.scratchRoot)
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || path.dirname(path.resolve(file)) !== root || path.resolve(file) !== file)
    throw new Error("F04_MANIFEST_MUST_BE_INSIDE_PRIVATE_INSTALLATION_ROOT")
  const boundaries = validateNativeBoundaries(input)
  const target = boundaries.target
  const connection = await input.resolveApprovedConnection(target.serverKey)
  if (!connection || connection.serverKey !== target.serverKey ||
      connection.projectId !== target.projectId ||
      connection.origin !== target.discoveryOrigin)
    throw new Error("F04_APPROVED_ORCHESTRA_CONNECTION_REQUIRED")

  const pages = [input.actors.requester, input.actors.holder, input.actors.denied, ...(input.actors.dashboardAdmin ? [input.actors.dashboardAdmin] : [])]
  if (pages.length < 3 || new Set(pages.map((page) => page.context())).size !== pages.length)
    throw new Error("F04_DISTINCT_AUTHENTICATED_BROWSER_CONTEXTS_REQUIRED")
  for (const page of pages) {
    if (new URL(page.url()).origin !== target.shellOrigin)
      throw new Error("F04_ACTOR_NOT_IN_APPROVED_PRODUCTION_SHELL")
  }
  const live = await Promise.all(pages.map((page) => observeNativeBinding(page, target)))
  // Local-operator binds the OS UID, so it cannot establish three real actors.
  if (live.some((observed) => observed.authMode !== "microsoft"))
    throw new Error("F04_MULTIACTOR_REQUIRES_REAL_MICROSOFT_SESSIONS")
  const principalRefs = live.map((observed) => observed.stamp.principalRef)
  if (new Set(principalRefs).size !== pages.length)
    throw new Error("F04_DUPLICATE_REAL_PRINCIPAL")
  const actors = {
    requester: principalRefs[0]!,
    holder: principalRefs[1]!,
    denied: principalRefs[2]!,
    ...(input.actors.dashboardAdmin ? { dashboardAdmin: principalRefs[3]! } : {}),
  }

  // A denied actor is not a success merely because it is different; its
  // current producer-admitted CAP14 read must actually be absent or refused.
  const deniedVendor = live[2]!.destinations.find((entry) => entry.capabilityId === "CAP14")
  if (deniedVendor?.canRead) throw new Error("F04_DENIED_ACTOR_CAN_READ_CAP14")
  const admin = input.actors.dashboardAdmin ? live[3] : undefined
  if (admin && !["CAP04", "CAP05"].every((id) =>
    admin.destinations.some((entry) =>
      entry.capabilityId === id && entry.canRead && entry.allowedActionIds.includes("save"))))
    throw new Error("F04_DASHBOARD_MUTATION_NOT_ADMITTED_BY_CURRENT_PRODUCER")

  const manifest: NativeManifest = {
    schema: "sf2h.native-installed-manifest.v1",
    candidateSha: input.candidateSha,
    ...boundaries, actors, scratchRoot: root,
  }
  // Exclusive private creation: no existing session file is replaced, and
  // no auth cookies, bearer tokens, session storage or grants are serialized.
  const serialized = serializeNativeManifest(manifest)
  const handle = await open(file, "wx", 0o600)
  try {
    await handle.writeFile(serialized, "utf8")
    await handle.sync()
  } catch (error) {
    await handle.close()
    await rm(file, { force: true })
    throw error
  }
  await handle.close()
  return {
    path: file,
    proofClass: "LIVE_CONTEXT_IDENTITIES_OBSERVED_NOT_UI_QUALIFICATION" as const,
    principals: actors,
    candidateSha: manifest.candidateSha,
    desktop: "NOT_RUN_D01_REAL_ELECTRON_REQUIRED" as const,
  }
}
