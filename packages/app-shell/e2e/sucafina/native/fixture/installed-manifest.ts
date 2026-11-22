/** Original Microsoft pages -> closed private v2. Registration does not qualify a journey. */
import path from "node:path"
import { constants } from "node:fs"
import { lstat, open, unlink } from "node:fs/promises"
import { Schema } from "effect"
import { SfTeamContext } from "@orchestra/schema/sucafina/context"
import type { Page } from "@playwright/test"
import { privateText } from "../../../../../../script/sf-ci/g08-private-evidence.mjs"
import { nativeTeamRef, serializeNativeManifest, validateNativeBoundaries, validateNativeInvocation, validateNativeManifest } from "./manifest-contract.ts"
import type { NativeManifest, NativeTarget, NativeInvocation } from "./manifest-contract.ts"
import { observeNativeBinding, requireNativeInvocation, requirePrivateNativeRoot } from "./readiness.ts"
import { nativeTargetInReservation, readNativeInstalledHost } from "./installed-host.ts"

/** Exclusive private writer; failed publication removes only the inode it created. */
export async function writeNativePrivate(rootPath: string, name: string, value: unknown) {
  const root = await requirePrivateNativeRoot(rootPath)
  if (!/^[a-z0-9][a-z0-9.-]{0,254}$/.test(name)) throw new Error("F04_PRIVATE_FILENAME_REQUIRED")
  const file = path.join(root, name)
  const handle = await open(file, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600)
  const owned = await handle.stat()
  const cleanup = async () => {
    const current = await lstat(file)
    if (current.dev !== owned.dev || current.ino !== owned.ino || current.nlink !== 1)
      throw new Error("F04_PRIVATE_PARTIAL_WRITE_OWNERSHIP_CHANGED")
    await unlink(file)
  }
  try {
    if (!owned.isFile() || owned.nlink !== 1 || (owned.mode & 0o777) !== 0o600)
      throw new Error("F04_PRIVATE_EXCLUSIVE_FILE_REQUIRED")
    await handle.writeFile(JSON.stringify(value) + "\n", "utf8")
    await handle.sync()
  } catch (error) { await handle.close(); await cleanup(); throw error }
  await handle.close()
  return { file, dev: owned.dev, ino: owned.ino }
}

export type NativeActorPages = Readonly<{ requester: Page; holder: Page; denied: Page; dashboardAdmin: Page }>
type ApprovedConnection = Readonly<{ serverKey: string; origin: string }>
export type NativeInstalledRegistration = Readonly<{
  scratchRoot: string; candidateSha: string; invocation: NativeInvocation
  target: NativeTarget; wrongServer: NativeTarget; wrongTeam: NativeTarget; wrongInstallation: NativeTarget
  actors: NativeActorPages
  /** The original approved connection registry, not a callback returning env metadata. */
  resolveApprovedConnection: (serverKey: string) => Promise<ApprovedConnection | undefined>
}>
export async function registerNativeInstalledManifest(input: NativeInstalledRegistration) {
  const root = await requirePrivateNativeRoot(input.scratchRoot)
  const host = await readNativeInstalledHost(root)
  const boundaries = validateNativeBoundaries(input)
  nativeTargetInReservation(host, boundaries.target)
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || path.dirname(file) !== root || path.resolve(file) !== file ||
    input.candidateSha !== host.plan.candidate.sha) throw new Error("F04_BOUND_PRIVATE_MANIFEST_PATH_REQUIRED")
  const connection = await input.resolveApprovedConnection(boundaries.target.serverKey)
  if (!connection || connection.serverKey !== boundaries.target.serverKey || connection.origin !== boundaries.target.discoveryOrigin)
    throw new Error("F04_APPROVED_ORIGINAL_CONNECTION_REQUIRED")
  const names = ["requester", "holder", "denied", "dashboardAdmin"] as const
  const pages = names.map((name) => input.actors[name])
  if (new Set(pages.map((page) => page.context())).size !== names.length ||
    pages.some((page) => new URL(page.url()).origin !== boundaries.target.shellOrigin))
    throw new Error("F04_DISTINCT_ORIGINAL_MICROSOFT_CONTEXTS_REQUIRED")
  const live = await Promise.all(pages.map((page) => observeNativeBinding(page, boundaries.target)))
  for (const [index, value] of live.entries()) {
    if (value.authMode !== "microsoft" || value.stamp.principalRef !== host.plan.actors[names[index]!])
      throw new Error("F04_ORIGINAL_PRINCIPAL_NOT_RESERVED")
  }
  const manifest = validateNativeManifest({
    schema: "sf2h.native-installed-manifest.v2", candidateSha: input.candidateSha,
    invocation: validateNativeInvocation(input.invocation), ...boundaries,
    actors: host.plan.actors, scratchRoot: root,
  })
  requireNativeInvocation(manifest)
  // writePrivate opens wx/0600 under the owned0700 root, without following links.
  const name = path.basename(file)
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) throw new Error("F04_MANIFEST_FILENAME_REQUIRED")
  const owned = await writeNativePrivate(root, name, manifest)
  try {
  const raw = await privateText(root, name, 65536)
  if (raw !== serializeNativeManifest(manifest)) throw new Error("F04_MANIFEST_ROUND_TRIP_CHANGED")
  await writeNativePrivate(root, "native-context-observations.json", {
    schema: "sf2h.native-context-observations.v2", candidateSha: manifest.candidateSha,
    invocation: manifest.invocation, profile: nativeTeamRef(manifest.target),
    contexts: Object.fromEntries(names.map((name, index) => [name, live[index]])),
  })
  } catch (error) {
    const current = await lstat(owned.file)
    if (current.dev !== owned.dev || current.ino !== owned.ino || current.nlink !== 1)
      throw new Error("F04_FAILED_MANIFEST_OWNERSHIP_CHANGED")
    await unlink(owned.file)
    throw error
  }
  return { path: file, candidateSha: manifest.candidateSha, proofClass: "REGISTERED_ONLY_NOT_EXECUTED" as const }
}
/** Stored original context is historical input for F04's zero-network negative, never a grant. */
export async function readNativeContextObservation(manifest: NativeManifest) {
  const raw = await privateText(manifest.scratchRoot, "native-context-observations.json", 4_000_000)
  const value = JSON.parse(raw)
  if (!value || typeof value !== "object" || Array.isArray(value) ||
    Object.keys(value).sort().join() !== ["schema", "candidateSha", "invocation", "profile", "contexts"].sort().join() ||
    !value.contexts || typeof value.contexts !== "object" ||
    Object.keys(value.contexts).sort().join() !== ["requester", "holder", "denied", "dashboardAdmin"].sort().join() ||
    raw !== JSON.stringify(value) + "\n" || value.schema !== "sf2h.native-context-observations.v2" ||
    value.candidateSha !== manifest.candidateSha || JSON.stringify(value.invocation) !== JSON.stringify(manifest.invocation) ||
    JSON.stringify(value.profile) !== JSON.stringify(nativeTeamRef(manifest.target)))
    throw new Error("F04_ORIGINAL_CONTEXT_OBSERVATION_BINDING_REQUIRED")
  const context = Schema.decodeUnknownSync(SfTeamContext, { onExcessProperty: "error" })(value.contexts?.requester)
  if (context.authMode !== "microsoft" || context.stamp.principalRef !== manifest.actors.requester ||
    JSON.stringify(context.stamp.team?.owner.profile) !== JSON.stringify(nativeTeamRef(manifest.target)))
    throw new Error("F04_ORIGINAL_CONTEXT_OBSERVATION_OWNER_REQUIRED")
  return context
}
