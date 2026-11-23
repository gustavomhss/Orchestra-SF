import path from "node:path"
import { isDeepStrictEqual } from "node:util"
import { Effect, Option, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { Project } from "@orchestra/core/project"
import type { SessionV2 } from "@orchestra/core/session"
import { SessionInput } from "@orchestra/core/session/input"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"
import { publishSfRoutinePrivateFile, readSfRoutinePrivateFile } from "./routine-native-private-files.ts"

const Scope = Schema.Struct({
  caseRef: Schema.Struct({ id: Schema.NonEmptyString, incarnation: Schema.NonEmptyString, version: Schema.Int }),
  job: Schema.NonEmptyString,
  providerGeneration: Schema.Int,
  policyVersion: Schema.NonEmptyString,
  accessRevision: Schema.NonEmptyString,
  originKind: Schema.Literals(["ui", "native"]),
})
export type SfRoutinePhaseScope = typeof Scope.Type
const Provenance = Schema.Struct({
  schema: Schema.Literal("sf-native-phase-origin-v2"),
  installationId: Schema.NonEmptyString,
  hostId: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString,
  locationId: Schema.NonEmptyString,
  principalRef: Schema.NonEmptyString,
  scope: Scope,
  authoritySessionID: SessionSchema.ID,
  initialMessageID: SessionMessage.ID.pipe(Schema.optional),
  intentDigest: Schema.NonEmptyString,
  nativeOrigin: Schema.Struct({ sessionID: SessionSchema.ID, runID: Schema.NonEmptyString, profileID: Schema.NonEmptyString,
    bindingDigest: Schema.NonEmptyString }).pipe(Schema.optional),
})
type Provenance = typeof Provenance.Type
const prefix = "Original authenticated routine planning command (data, not an approval):\n"
const Parent = Schema.Struct({ schema: Schema.Literal("sf-native-phase-parent-v1"), installationId: Schema.NonEmptyString,
  projectId: Schema.NonEmptyString, locationId: Schema.NonEmptyString, authoritySessionID: SessionSchema.ID })
const parentName = (id: SessionSchema.ID) => `parent-${digestSfValue(id)}.json`

/** Denial-only ownership marker survives phase close/restart, including interrupted creation before any prompt.
 * It cannot authenticate an actor or authorize execution; absence leaves unrelated native Sessions unchanged.
 */
export async function readSfRoutinePhaseParent(directory: string, session: SessionSchema.Info) {
  const text = await readSfRoutinePrivateFile(directory, parentName(session.id))
  if (text === undefined) return false
  const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(Parent))(text, { onExcessProperty: "error" })
  if (Option.isNone(decoded) || decoded.value.authoritySessionID !== session.id || decoded.value.projectId !== session.projectID ||
    decoded.value.locationId !== digestSfValue(session.location)) throw new Error("SF_NATIVE_PHASE_PARENT_INVALID")
  return true
}

function phaseOriginDirectory(input: string | (() => string | undefined)) {
  const value = typeof input === "string" ? input : input()
  if (!value || !path.isAbsolute(value)) throw new Error("SF_NATIVE_PHASE_ORIGIN_DIRECTORY_INVALID")
  return value
}

/** The original location-isolation predicate, shared with read-only health.
 * This checks path geometry only; the original private-directory reader checks
 * the filesystem without creating or repairing anything.
 */
export function assertSfRoutinePhaseOriginDirectory(input: string | (() => string | undefined),
  resources: Pick<SfRoutineNativeRuntimeResources, "identity" | "location">) {
  const roots = [resources.identity.location.directory, ...(Project.isRoot(resources.location.project.directory)
    ? [] : [resources.location.project.directory])]
  if (roots.some((root) => {
    const relative = path.relative(root, phaseOriginDirectory(input))
    return relative === "" || !relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative)
  })) throw new Error("SF_NATIVE_PHASE_ORIGIN_MUST_BE_HOST_PRIVATE")
}

/** Source-issued provenance only, not native admission/approval/run storage. Active lookup is case/job/epoch/host
 * isolated. By-Session lookup is stable across process hosts, but carries no execution or planning capability.
 * Only canonical native records may supply the locator to the bridge; this lower-level reader still requires the
 * independent private proof, real root Session, original admitted prompt and matching stable authenticated identity.
 */
export function createSfRoutinePhaseOrigin(input: string | (() => string | undefined)) {
  const directory = () => phaseOriginDirectory(input)
  const creating = new Set<string>()
  const privateDirectory = (resources: SfRoutineNativeRuntimeResources) => assertSfRoutinePhaseOriginDirectory(input, resources)
  const stable = (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext) => ({
    installationId: resources.identity.installationId, projectId: resources.identity.projectId,
    locationId: digestSfValue(resources.identity.location), principalRef: context.binding.principalRef,
  })
  const activeName = (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, scope: SfRoutinePhaseScope) =>
    `active-${digestSfValue({ ...stable(resources, context), hostId: resources.identity.hostId, scope,
      ...(context.kind === "native" ? { nativeOrigin: digestSfValue(context.binding) } : {}) })}.json`
  const sessionName = (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, sessionID: SessionSchema.ID) =>
    `session-${digestSfValue({ ...stable(resources, context), sessionID })}.json`
  const readProof = async (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, name: string): Promise<Provenance | undefined> => {
    privateDirectory(resources)
    const text = await readSfRoutinePrivateFile(directory(), name)
    if (text === undefined) return undefined
    const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(Provenance))(text, { onExcessProperty: "error" })
    if (Option.isNone(decoded)) throw new Error("SF_NATIVE_PHASE_ORIGIN_INVALID")
    const proof = decoded.value
    if (!isDeepStrictEqual({ installationId: proof.installationId, projectId: proof.projectId,
      locationId: proof.locationId, principalRef: proof.principalRef }, stable(resources, context)))
      throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    const session = await Effect.runPromise(resources.store.get(proof.authoritySessionID))
    const admitted = proof.initialMessageID ? await Effect.runPromise(SessionInput.find(resources.database.db, proof.initialMessageID)) : undefined
    if (!session || session.parentID || session.time.archived || session.agent !== AgentV2.defaultID ||
      session.projectID !== resources.identity.projectId || !isDeepStrictEqual(session.location, resources.identity.location))
      throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    if (proof.scope.originKind === "ui" && (!admitted || proof.nativeOrigin || admitted.sessionID !== session.id ||
      digestSfValue(admitted.prompt) !== proof.intentDigest || !originalCommand(admitted.prompt.text, proof.scope, proof)))
      throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    if (proof.scope.originKind === "native") {
      const source = proof.nativeOrigin && await Effect.runPromise(resources.store.get(proof.nativeOrigin.sessionID))
      if (proof.initialMessageID || proof.intentDigest !== digestSfValue(JSON.stringify(commandValue(proof.scope, proof))) ||
        !source || source.agent !== proof.nativeOrigin?.profileID || source.agent === AgentV2.defaultID ||
        source.projectID !== proof.projectId || digestSfValue(source.location) !== proof.locationId)
        throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    }
    return proof
  }
  const readSession = async (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, sessionID: SessionSchema.ID) => {
    const proof = await readProof(resources, context, sessionName(resources, context, sessionID))
    if (proof && proof.authoritySessionID !== sessionID) throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    return proof
  }
  const read = async (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, scope: SfRoutinePhaseScope) => {
    const proof = await readProof(resources, context, activeName(resources, context, scope))
    if (!proof) return undefined
    if (proof.hostId !== resources.identity.hostId || !isDeepStrictEqual(proof.scope, scope) ||
      context.kind === "native" && proof.nativeOrigin?.bindingDigest !== digestSfValue(context.binding) ||
      !isDeepStrictEqual(await readSession(resources, context, proof.authoritySessionID), proof))
      throw new Error("SF_NATIVE_PHASE_ORIGIN_UNBOUND")
    return proof
  }
  const reserve = (resources: SfRoutineNativeRuntimeResources, sessions: SessionV2.Interface, context: TrustedDomainContext,
    sessionID: SessionSchema.ID, current: () => Promise<boolean>) => Effect.gen(function* () {
    privateDirectory(resources)
    if (!(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_DENIED"))
    const ownership = { schema: "sf-native-phase-parent-v1" as const, installationId: resources.identity.installationId,
      projectId: resources.identity.projectId, locationId: digestSfValue(resources.identity.location), authoritySessionID: sessionID }
    const existing = yield* Effect.tryPromise(() => readSfRoutinePrivateFile(directory(), parentName(sessionID)))
    if (existing !== undefined && existing !== JSON.stringify(ownership)) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_PARENT_INVALID"))
    if (existing === undefined) {
      if (yield* resources.store.get(sessionID)) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_PARENT_ALREADY_EXISTS"))
      yield* Effect.tryPromise(() => publishSfRoutinePrivateFile(directory(), parentName(sessionID), JSON.stringify(ownership)))
    }
    const parent = yield* sessions.create({ id: sessionID, agent: AgentV2.defaultID, location: resources.identity.location })
    if (parent.id !== sessionID || parent.parentID || parent.agent !== AgentV2.defaultID ||
      parent.projectID !== resources.identity.projectId || !isDeepStrictEqual(parent.location, resources.identity.location) ||
      !(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_DENIED"))
    // No title-model side fiber may outlive the first source drain. No prompt/model data has been admitted yet.
    yield* sessions.rename({ sessionID, title: "Routine planning" })
    return parent
  })
  const recipeName = (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, reference: string) => {
    if (context.kind !== "native") throw new Error("SF_NATIVE_PHASE_NATIVE_SOURCE_REQUIRED")
    return `recipe-${digestSfValue({ ...stable(resources, context), hostId: resources.identity.hostId,
      nativeOrigin: digestSfValue(context.binding), reference })}.json`
  }
  const Recipe = Schema.Struct({ schema: Schema.Literal("sf-native-source-recipe-v1"), reference: Schema.NonEmptyString,
    authoritySessionID: SessionSchema.ID, scopeDigest: Schema.NonEmptyString })
  return {
    read, readSession, reserve,
    rememberRecipe: async (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, reference: string, proof: Provenance) => {
      if (context.kind !== "native" || proof.nativeOrigin?.bindingDigest !== digestSfValue(context.binding) ||
        proof.hostId !== resources.identity.hostId || !isDeepStrictEqual(await readSession(resources, context, proof.authoritySessionID), proof))
        throw new Error("SF_NATIVE_PHASE_NATIVE_SOURCE_REQUIRED")
      const name = recipeName(resources, context, reference)
      const text = JSON.stringify({ schema: "sf-native-source-recipe-v1", reference,
        authoritySessionID: proof.authoritySessionID, scopeDigest: digestSfValue(proof.scope) })
      const existing = await readSfRoutinePrivateFile(directory(), name)
      if (existing !== undefined) {
        if (existing !== text) throw new Error("SF_NATIVE_PHASE_NATIVE_SELECTION_AMBIGUOUS")
        return
      }
      await publishSfRoutinePrivateFile(directory(), name, text)
    },
    readRecipe: async (resources: SfRoutineNativeRuntimeResources, context: TrustedDomainContext, reference: string) => {
      const text = await readSfRoutinePrivateFile(directory(), recipeName(resources, context, reference))
      if (!text) return undefined
      const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(Recipe))(text, { onExcessProperty: "error" })
      if (Option.isNone(parsed) || parsed.value.reference !== reference) throw new Error("SF_NATIVE_PHASE_NATIVE_SELECTION_AMBIGUOUS")
      const proof = await readSession(resources, context, parsed.value.authoritySessionID)
      if (!proof || digestSfValue(proof.scope) !== parsed.value.scopeDigest || context.kind !== "native" ||
        proof.nativeOrigin?.bindingDigest !== digestSfValue(context.binding)) throw new Error("SF_NATIVE_PHASE_NATIVE_SOURCE_REQUIRED")
      return proof
    },
    create: (resources: SfRoutineNativeRuntimeResources, sessions: SessionV2.Interface, context: TrustedDomainContext,
      request: Request, scope: SfRoutinePhaseScope, sessionID: SessionSchema.ID, current: () => Promise<boolean>) => Effect.gen(function* () {
      const key = activeName(resources, context, scope)
      if (creating.has(key)) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_BUSY"))
      creating.add(key)
      try {
        const existing = yield* Effect.tryPromise(() => read(resources, context, scope))
        if (existing) return existing
        if (context.kind === "ui" && request.method !== "POST" || !(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_DENIED"))
        const parent = yield* reserve(resources, sessions, context, sessionID, current)
        if (parent.id !== sessionID || !(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_DENIED"))
        const host = { ...stable(resources, context), hostId: resources.identity.hostId, authoritySessionID: sessionID }
        const command = JSON.stringify({ operation: "catalog", purpose: scope.job, caseRef: scope.caseRef,
          hostContext: { ...host, policyVersion: scope.policyVersion, accessRevision: scope.accessRevision,
            providerGeneration: scope.providerGeneration } })
        // Native model arguments are DATA, never a human message. They enter through the registered SystemContext
        // source during the actual owned turn; no Session.prompt(user) or unscoped synthetic write is used for them.
        const admitted = context.kind === "ui" ? yield* sessions.prompt({ sessionID: parent.id, resume: false,
          prompt: { text: prefix + command } }) : undefined
        const proof: Provenance = { schema: "sf-native-phase-origin-v2", ...stable(resources, context),
          hostId: resources.identity.hostId, scope: structuredClone(scope), authoritySessionID: parent.id,
          ...(admitted ? { initialMessageID: admitted.id } : {}), intentDigest: admitted ? digestSfValue(admitted.prompt) : digestSfValue(command),
          ...(context.kind === "native" ? { nativeOrigin: { sessionID: SessionSchema.ID.make(context.binding.nativeSessionId),
            runID: context.binding.runId, profileID: context.binding.profileId, bindingDigest: digestSfValue(context.binding) } } : {}) }
        if (!(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_DENIED"))
        // Stable by-Session evidence is independently durable before publishing an active association. A crash may
        // leave an unused issued Session, never an active pointer lacking its independent original issuance proof.
        yield* Effect.tryPromise(() => publishSfRoutinePrivateFile(directory(), sessionName(resources, context, parent.id), JSON.stringify(proof)))
        if (!(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_DENIED"))
        yield* Effect.tryPromise(() => publishSfRoutinePrivateFile(directory(), key, JSON.stringify(proof)))
        if (!(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_NATIVE_PHASE_ORIGIN_DENIED"))
        return proof
      } finally { creating.delete(key) }
    }),
  }
}

function originalCommand(text: string, scope: SfRoutinePhaseScope, proof: Provenance) {
  if (!text.startsWith(prefix)) return false
  const parsed = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(text.slice(prefix.length))
  return Option.isSome(parsed) && isDeepStrictEqual(parsed.value, commandValue(scope, proof))
}
function commandValue(scope: SfRoutinePhaseScope, proof: Provenance) {
  return {
    operation: "catalog", purpose: scope.job, caseRef: scope.caseRef,
    hostContext: { installationId: proof.installationId, projectId: proof.projectId, locationId: proof.locationId,
      principalRef: proof.principalRef, hostId: proof.hostId, authoritySessionID: proof.authoritySessionID,
      policyVersion: scope.policyVersion, accessRevision: scope.accessRevision, providerGeneration: scope.providerGeneration },
  }
}
