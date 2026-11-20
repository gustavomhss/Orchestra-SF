/** F04 installed-session manifest factory.
 * Called only by the authorized GitHub Actions host installer, after its
 * original connection, provisioning and browser sign-ins have completed.
 * It never creates credentials, principals, cookies, grants or a listener.
 */
import { open, rm } from "node:fs/promises"
import path from "node:path"
import type { Page } from "@playwright/test"
import {
  observeNativeBinding, requireNativeInvocation, requirePrivateNativeRoot,
} from "./readiness.ts"
import { serializeNativeManifest, validateNativeBoundaries, validateNativeInvocation } from "./manifest-contract.ts"
import type { NativeInvocation, NativeManifest, NativeTarget } from "./manifest-contract.ts"

type ActorPages = Readonly<{
  requester: Page
  holder: Page
  denied: Page
  dashboardAdmin?: Page
}>

export type ApprovedConnection = Readonly<{
  serverKey: string
  projectId: string
  installationId: string
  tenantId: string
  hostId: string
  origin: string
  publicOrigin: string
  mount: string
}>

export type NativeInstalledRegistration = Readonly<{
  scratchRoot: string
  candidateSha: string
  invocation: NativeInvocation
  target: NativeTarget
  wrongServer: NativeTarget
  wrongTeam: NativeTarget
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
  const boundaries = validateNativeBoundaries(input)
  const invocation = validateNativeInvocation(input.invocation)
  const originalActors = Object.freeze({ ...input.actors })
  const root = await requirePrivateNativeRoot(input.scratchRoot)
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || path.dirname(path.resolve(file)) !== root || path.resolve(file) !== file)
    throw new Error("F04_MANIFEST_MUST_BE_INSIDE_PRIVATE_INSTALLATION_ROOT")
  const target = boundaries.target
  await requireApprovedNativeConnection(target, input.resolveApprovedConnection)
  await requireApprovedNativeConnection(boundaries.wrongServer, input.resolveApprovedConnection)

  const pages = [originalActors.requester, originalActors.holder, originalActors.denied, ...(originalActors.dashboardAdmin ? [originalActors.dashboardAdmin] : [])]
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
    ...(originalActors.dashboardAdmin ? { dashboardAdmin: principalRefs[3]! } : {}),
  }

  // A denied actor is not a success merely because it is different; its
  // current producer-admitted CAP14 read must actually be absent or refused.
  const deniedVendor = live[2]!.destinations.find((entry) => entry.capabilityId === "CAP14")
  if (deniedVendor?.canRead) throw new Error("F04_DENIED_ACTOR_CAN_READ_CAP14")
  const admin = originalActors.dashboardAdmin ? live[3] : undefined
  if (admin && !["CAP04", "CAP05"].every((id) =>
    admin.destinations.some((entry) =>
      entry.capabilityId === id && entry.canRead && entry.allowedActionIds.includes("save"))))
    throw new Error("F04_DASHBOARD_MUTATION_NOT_ADMITTED_BY_CURRENT_PRODUCER")

  const manifest: NativeManifest = {
    schema: "sf2h.native-installed-manifest.v2",
    candidateSha: input.candidateSha,
    invocation, ...boundaries, actors, scratchRoot: root,
  }
  // Exclusive private creation: no existing session file is replaced, and
  // no auth cookies, bearer tokens, session storage or grants are serialized.
  requireNativeInvocation(manifest)
  await requireApprovedNativeConnection(target, input.resolveApprovedConnection)
  await requireApprovedNativeConnection(boundaries.wrongServer, input.resolveApprovedConnection)
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

/** Registry metadata alone grants nothing; original Microsoft/F02 follows this check. */
export async function requireApprovedNativeConnection(
  target: NativeTarget, resolve: NativeInstalledRegistration["resolveApprovedConnection"],
): Promise<ApprovedConnection> {
  const connection = await resolve(target.serverKey)
  if (!connection || connection.serverKey !== target.serverKey || connection.projectId !== target.projectId ||
      connection.installationId !== target.installationId || connection.tenantId !== target.tenantId ||
      connection.hostId !== target.hostId || connection.origin !== target.discoveryOrigin ||
      connection.publicOrigin !== target.publicOrigin || connection.mount !== target.mount)
    throw new Error("F04_APPROVED_ORCHESTRA_CONNECTION_REQUIRED")
  return Object.freeze({ ...connection })
}
