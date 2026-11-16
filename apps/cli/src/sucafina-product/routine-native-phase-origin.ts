import path from "node:path"
import { link, mkdir, open, readFile, unlink } from "node:fs/promises"
import { randomUUID } from "node:crypto"
import { isDeepStrictEqual } from "node:util"
import { Effect, Option, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { Project } from "@orchestra/core/project"
import type { SessionV2 } from "@orchestra/core/session"
import { SessionInput } from "@orchestra/core/session/input"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"

const Provenance = Schema.Struct({
  schema: Schema.Literal("sf-native-phase-origin-v1"),
  installationId: Schema.NonEmptyString,
  hostId: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  locationId: Schema.NonEmptyString,
  principalRef: Schema.NonEmptyString,
  authoritySessionID: SessionSchema.ID,
  initialMessageID: SessionMessage.ID,
  intentDigest: Schema.NonEmptyString,
})
type Provenance = typeof Provenance.Type

/** Host-owned provenance, NOT a run/approval ledger. The directory must be private application data.
 * Only this writer associates a principal with a Session it really created and a prompt it really admitted.
 * Native plan.owner, request headers, and model-supplied Session IDs never select a file or issue evidence.
 */
export function createSfRoutinePhaseOrigin(input: string | (() => string | undefined)) {
  const directory = () => {
    const value = typeof input === "string" ? input : input()
    if (!value || !path.isAbsolute(value)) throw new Error("SF_NATIVE_PHASE_ORIGIN_DIRECTORY_INVALID")
    return value
  }
  const creating = new Set<string>()
  const privateDirectory = (resources: SfRoutineNativeRuntimeResources) => {
    const roots = [resources.identity.location.directory, ...(Project.isRoot(resources.location.project.directory)
      ? [] : [resources.location.project.directory])]
    if (roots.some((root) => {
      const relative = path.relative(root, directory())
      return relative === "" || !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
    })) throw new Error("SF_NATIVE_PHASE_ORIGIN_MUST_BE_HOST_PRIVATE")
  }
  const identity = (resources: SfRoutineNativeRuntimeResources, context: TrustedUiContext) => ({
    installationId: resources.identity.installationId, hostId: resources.identity.hostId,
    projectId: resources.identity.projectId, locationId: digestSfValue(resources.identity.location),
    principalRef: context.binding.principalRef,
  })
  const file = (resources: SfRoutineNativeRuntimeResources, context: TrustedUiContext) =>
    path.join(directory(), `${digestSfValue(identity(resources, context))}.json`)
  const read = async (resources: SfRoutineNativeRuntimeResources, context: TrustedUiContext): Promise<Provenance | undefined> => {
    privateDirectory(resources)
    const text = await readFile(file(resources, context), "utf8").catch((error: NodeJS.ErrnoException) => {
      if (error.code === "ENOENT") return undefined
      throw error
    })
    if (text === undefined) return undefined
    if (text.length > 8192) throw new Error("SF_NATIVE_PHASE_ORIGIN_INVALID")
    const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(Provenance))(text, { onExcessProperty: "error" })
    if (Option.isNone(decoded)) throw new Error("SF_NATIVE_PHASE_ORIGIN_INVALID")
    const proof = decoded.value
    if (!isDeepStrictEqual({ installationId: proof.installationId, hostId: proof.hostId,
      projectId: proof.projectId, locationId: proof.locationId, principalRef: proof.principalRef }, identity(resources, context)))
      throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    const session = await Effect.runPromise(resources.store.get(proof.authoritySessionID))
    const admitted = await Effect.runPromise(SessionInput.find(resources.database.db, proof.initialMessageID))
    if (!session || session.parentID || session.time.archived || session.agent !== AgentV2.defaultID ||
      session.projectID !== resources.identity.projectId || !isDeepStrictEqual(session.location, resources.identity.location) ||
      !admitted || admitted.sessionID !== session.id || digestSfValue(admitted.prompt) !== proof.intentDigest)
      throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    return proof
  }
  return {
    read,
    create: async (resources: SfRoutineNativeRuntimeResources, sessions: SessionV2.Interface, context: TrustedUiContext,
      request: Request, command: string, current: () => Promise<boolean>): Promise<Provenance> => {
      const key = file(resources, context)
      if (creating.has(key)) throw new Error("SF_NATIVE_PHASE_ORIGIN_BUSY")
      creating.add(key)
      try {
        const existing = await read(resources, context)
        if (existing) return existing
        if (request.method !== "POST" || !await current()) throw new Error("SF_NATIVE_PHASE_ORIGIN_DENIED")
        // Ingress already consumed/decoded the Request body. The private host passes its original typed command;
        // reparsing/cloning rawRequest here would fail on every genuine bodyUsed request.
        if (!command.trim() || command.length > 256 * 1024 || !await current()) throw new Error("SF_NATIVE_PHASE_ORIGIN_DENIED")
        const parent = await Effect.runPromise(sessions.create({ agent: AgentV2.defaultID, location: resources.identity.location }))
        if (!await current()) throw new Error("SF_NATIVE_PHASE_ORIGIN_DENIED")
        // The first, original command precedes every native presentation. Never manufacture a later human reply.
        const admitted = await Effect.runPromise(sessions.prompt({ sessionID: parent.id, resume: false,
          prompt: { text: `Original authenticated routine planning command (data, not an approval):\n${command}` } }))
        const proof: Provenance = { schema: "sf-native-phase-origin-v1", ...identity(resources, context),
          authoritySessionID: parent.id, initialMessageID: admitted.id, intentDigest: digestSfValue(admitted.prompt) }
        if (!await current()) throw new Error("SF_NATIVE_PHASE_ORIGIN_DENIED")
        await mkdir(directory(), { recursive: true, mode: 0o700 })
        // Publish complete, synced bytes without replacing another process's association. A crash mid-write may
        // leave our unreferenced temp file, never a half-written authoritative provenance record.
        const temporary = path.join(directory(), `.origin-${randomUUID()}.tmp`)
        const handle = await open(temporary, "wx", 0o600)
        try {
          await handle.writeFile(JSON.stringify(proof))
          await handle.sync()
          await handle.close()
          if (!await current()) throw new Error("SF_NATIVE_PHASE_ORIGIN_DENIED")
          await link(temporary, key)
        } finally {
          await handle.close().catch(() => undefined)
          await unlink(temporary)
        }
        if (!await current()) throw new Error("SF_NATIVE_PHASE_ORIGIN_DENIED")
        return proof
      } finally {
        creating.delete(key)
      }
    },
  }
}
