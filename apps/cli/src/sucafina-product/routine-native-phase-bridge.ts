import { isDeepStrictEqual } from "node:util"
import { Context, Effect, Option, Schedule, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { ExecutionHost } from "@orchestra/core/session/runner"
import type { SessionV2 } from "@orchestra/core/session"
import { SessionSchema } from "@orchestra/core/session/schema"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessPorts } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { sfRoutineHumanRunCommand219 } from "./native-routine-producer219.ts"
import type { SfRoutineNativeHumanRunCommand } from "./native-routine-producer219.ts"
import type { createSfRoutineNativeAdmission, SfRoutineNativeAdmissionIntent } from "./routine-native-admission.ts"
import type { SfRoutineNativeAdapterInput, SfRoutineNativeOwnerBinding, SfRoutineNativeOwnerPort } from "./routine-native-adapter.ts"
import { withSfRoutineNativeAbort } from "./routine-native-dispatch.ts"
import { readSfRoutineNativeInput, sameSfRoutineNativeOwner } from "./routine-native-input.ts"
import type { SfRoutineNativeOwner } from "./routine-native-input.ts"
import { createSfRoutineNativeOrigin, observeSfRoutineNative } from "./routine-native-origin.ts"
import { createSfRoutinePhaseOrigin } from "./routine-native-phase-origin.ts"
import type { SfRoutinePhaseScope } from "./routine-native-phase-origin.ts"
import { captureSfRoutineApprovedChain } from "./routine-native-phase-chain.ts"
import { createSfRoutinePhaseFence, SF_ROUTINE_PHASE_PARENT_PREFIX } from "./routine-native-phase-fence.ts"
import { createSfRoutineNativePhasePolicy } from "./routine-native-phase-policy.ts"
import { initializeSfRoutinePhaseScope, SF_ROUTINE_PHASE_SCOPE, sfRoutinePhaseArsenalAllowed } from "./routine-native-phase-scope.ts"
import { Seats } from "../../../../modules/maestro/coordination/src/seats/index.ts"
import type { NativeAdmission } from "./routine-native-records.ts"
import type { SfRoutineNativeHistoricalAuthority } from "./routine-native-registry.ts"
import { routineSourceDigest } from "./routine-services.ts"

const sourceBrand = Symbol("native-phase-source")
const approvedBrand = Symbol("native-phase-approved")
const planningBrand = Symbol("native-phase-planning")
export type Source = Readonly<{ [sourceBrand]: true }>
export type ApprovedRun = Readonly<{ [approvedBrand]: true }>
export type PlanningLease = Readonly<{
  [planningBrand]: true
  authoritySessionID: SessionSchema.ID
  owner: SfRoutineNativeOwner
  /** Runs the original runner, including native upstream planning Tasks. It cannot authorize an SF execution Task. */
  resume: () => Effect.Effect<"settled" | "busy", BridgeError>
}>
export class BridgeError extends Schema.TaggedErrorClass<BridgeError>()("SfNativePhaseBridge.Error", {
  reason: Schema.String,
}) {
  get message() { return this.reason }
}
export interface NativePhaseBridge {
  withPlanning<A, E>(source: Source, use: (lease: PlanningLease) => Effect.Effect<A, E>): Effect.Effect<A, E | BridgeError>
  run(source: Source, approved: ApprovedRun): Effect.Effect<"settled" | "busy", BridgeError>
  withInvocation<A, E, R>(invocation: ToolSafety.Invocation, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | ToolSafety.Denied, R>
  historical(source: Source): Promise<SfRoutineNativeHistoricalAuthority | undefined>
}
type RunInput = Parameters<BusinessPorts["routines"]["run"]>[0]
/** Passed only by the ORIGINAL authenticated host method after ingress decode/withCase. These are intent data,
 * never identity, a Session selector, execution authority, or a direct native human approval reply. */
export type PlanningIntent = Readonly<{ operation: "catalog"; purpose: string } | {
  operation: "prepare"; request: Parameters<BusinessPorts["routines"]["prepareAdmission"]>[0]
}>
export type HistoryIntent = Readonly<{ operation: "read-admission" | "read-run"; reference: string }>
export type SourceIntent = PlanningIntent | HistoryIntent | Readonly<{ operation: "run"; request: RunInput }> |
  Readonly<{ operation: "native-recipe"; reference: string }>
type Input = Pick<SfRoutineNativeAdapterInput, "resources" | "requestFor" | "authorize" | "generation" | "publication" |
  "governance" | "resolveCase" | "resolveInputs" | "revalidateSources"> & {
  sessions: () => SessionV2.Interface | undefined
  originDirectory: string | (() => string | undefined)
  owners: SfRoutineNativeOwnerPort
  readOwners?: SfRoutineNativeOwnerPort
  admission: () => ReturnType<typeof createSfRoutineNativeAdmission> | undefined
  authorizeRun: (context: TrustedUiContext, command: SfRoutineNativeHumanRunCommand) => Promise<boolean>
}
type Provenance = NonNullable<Awaited<ReturnType<ReturnType<typeof createSfRoutinePhaseOrigin>["read"]>>>
type SourceState = {
  request: Request
  context: TrustedDomainContext
  resources: NonNullable<ReturnType<Input["resources"]>>
  sessions: SessionV2.Interface
  generation: number
  intent: SourceIntent
  mode: "planning" | "run" | "history"
  sessionID: SessionSchema.ID
  scope?: SfRoutinePhaseScope
  readProof: () => Promise<Provenance | undefined>
  registrations?: ReadonlyMap<string, object>
  proof?: Provenance
  signal: AbortSignal
  current: () => Promise<boolean>
  close: () => void
}
type RunState = {
  source: SourceState
  before: NativeAdmission
  intent: SfRoutineNativeAdmissionIntent
  current: () => Promise<boolean>
  chain: NonNullable<ReturnType<typeof captureSfRoutineApprovedChain>>
  nativePolicy: ReturnType<typeof createSfRoutineNativePhasePolicy>
}
type Phase = { bridge: object; source: SourceState; run?: RunState }
const CurrentPhase = Context.Reference<Phase | undefined>("sucafina/native-phase", { defaultValue: () => undefined })

/** No wire constructor. Only this host factory issues opaque identities after authenticating the exact Request.
 * Association is installed INSIDE exclusive's operation: the coordinator owns an independent runtime.
 * Native Session/approval/Task/Relay services remain the only producers of their own records and execution.
 */
export function createSfRoutineNativePhaseBridge(input: Input) {
  const identity = Object.freeze({})
  const provenance = createSfRoutinePhaseOrigin(input.originDirectory)
  const fence = createSfRoutinePhaseFence(input)
  const releaseFence = input.governance.installPhaseFence(fence)
  const sources = new WeakMap<Source, SourceState>()
  const live = new Set<SourceState>()
  const approvals = new WeakMap<ApprovedRun, RunState>()
  const planning = new Map<SourceState, SfRoutineNativeOwnerBinding>()
  const staged = new Map<SessionSchema.ID, RunState>()
  const invalidGenerations = new Set<number>()
  let disposed = false
  const ready = () => !disposed && (process.platform === "darwin" || process.platform === "linux") && !!input.sessions() && !!input.publication() &&
    !!(typeof input.originDirectory === "string" ? input.originDirectory : input.originDirectory()) &&
    !!input.resources()?.current() && input.governance.installed(input.resources()!.governance) &&
    input.governance.guardsInstalled(input.resources()!.safety, input.resources()!.relay)

  const issue = (context: TrustedDomainContext, intent?: SourceIntent): Effect.Effect<Source, BridgeError> => checked(async () => {
    const request = input.requestFor(context), resources = input.resources(), sessions = input.sessions()
    if (!intent || !ready() || !request || request.signal.aborted || !resources || !sessions || live.size >= 100)
      throw unavailable()
    const expires = Math.min(Date.parse(context.binding.expiresAt), Date.now() + 300_000)
    if (!Number.isFinite(expires) || expires <= Date.now()) throw unavailable()
    const deadline = performance.now() + expires - Date.now()
    const abort = new AbortController()
    const signal = AbortSignal.any([request.signal, abort.signal])
    const bindingDigest = digestSfValue(context.binding), headersDigest = digestSfValue([...request.headers])
    const binding = context.binding, lease = context.lease
    const resourceDigest = digestSfValue(resources.identity)
    const close = () => { abort.abort(); live.delete(state); planning.delete(state); clearTimeout(timer) }
    const timer = setTimeout(close, Math.max(0, expires - Date.now()))
    // Track pending authentication too: revoke/dispose must not miss a source still acquiring authority.
    const state: SourceState = { request, context, resources, sessions, generation: -1, signal, close,
      intent: structuredClone(intent), mode: intent.operation === "catalog" || intent.operation === "prepare" || intent.operation === "native-recipe" ? "planning" :
        intent.operation === "run" ? "run" : "history",
      sessionID: SessionSchema.ID.make(SF_ROUTINE_PHASE_PARENT_PREFIX + SessionSchema.ID.create().slice(4)), readProof: async () => undefined,
      current: async () => false }
    live.add(state)
    const sync = () => live.has(state) && !disposed && !signal.aborted && Date.now() < expires && performance.now() < deadline &&
      input.requestFor(context) === request && input.resources() === resources && resources.current() && input.sessions() === sessions &&
      context.binding === binding && context.lease === lease &&
      digestSfValue(context.binding) === bindingDigest && digestSfValue([...request.headers]) === headersDigest &&
      digestSfValue(resources.identity) === resourceDigest && context.binding.installationId === resources.identity.installationId &&
      context.binding.projectId === resources.identity.projectId && !invalidGenerations.has(state.generation) &&
      (context.kind !== "native" || context.binding.hostId === resources.identity.hostId &&
        context.binding.locationId === digestSfValue(resources.identity.location) &&
        (state.generation === -1 || context.binding.providerGeneration === state.generation)) &&
      (!state.registrations || [...state.registrations].every(([name, registration]) => resources.registry.currentRegistrationIdentity(name) === registration))
    state.current = async () => {
      const expectedProof = state.proof, registrations = state.registrations
      const authorized = sync() && await observeSfRoutineNative(() => input.authorize(context), signal)
      const generation = authorized && sync() ? await observeSfRoutineNative(input.generation, signal) : undefined
      const selected = state.scope && sync() ? await observeSfRoutineNative(() => input.resolveCase(context), signal) : undefined
      const narrowed = registrations && sync() ? await observeSfRoutineNative(() => Effect.runPromise(resources.store.scope(state.sessionID)), signal) : undefined
      const proof = expectedProof && generation === state.generation && sync()
        ? await observeSfRoutineNative(state.readProof, signal) : undefined
      // Initial scope/provenance publication may advance while the revocation monitor is observing. Re-read the
      // fully established phase instead of mistaking our own monotonic initialization for authority withdrawal.
      if (sync() && (state.proof !== expectedProof || state.registrations !== registrations)) return state.current()
      if (authorized && generation === state.generation && (!state.scope || selected?.status === "ok" &&
        isDeepStrictEqual(selected.value, state.scope.caseRef)) && (!state.proof || isDeepStrictEqual(proof, state.proof)) &&
        (!state.registrations || isDeepStrictEqual(narrowed?.scope, SF_ROUTINE_PHASE_SCOPE)) && sync()) return true
      close()
      return false
    }
    request.signal.addEventListener("abort", close, { once: true })
    signal.addEventListener("abort", () => request.signal.removeEventListener("abort", close), { once: true })
    try {
      const generation = await observeSfRoutineNative(input.generation, signal)
      if (generation === undefined || !Number.isSafeInteger(generation) || generation < 0 || !sync()) throw unavailable()
      state.generation = generation
      if (!await state.current()) throw unavailable()
      if (context.kind === "native") {
        const resident = await Effect.runPromise(resources.store.get(SessionSchema.ID.make(context.binding.nativeSessionId)))
        if (context.binding.profileId === AgentV2.defaultID || !resident || resident.agent !== context.binding.profileId ||
          resident.projectID !== resources.identity.projectId || !isDeepStrictEqual(resident.location, resources.identity.location)) throw unavailable()
      }
      const selected = await input.resolveCase(context)
      if (selected.status !== "ok" || !await state.current()) throw unavailable()
      const currentCase = structuredClone(selected.value)
      if (context.kind === "native" && (context.binding.caseId !== currentCase.id || context.binding.caseIncarnation !== currentCase.incarnation ||
        context.binding.caseVersion !== currentCase.version || context.binding.entryMode === "routine-result" &&
          (intent.operation === "prepare" || intent.operation === "native-recipe"))) throw unavailable()
      if (intent.operation === "catalog") {
        state.scope = { caseRef: currentCase, job: intent.purpose, providerGeneration: generation,
          policyVersion: binding.policyVersion, accessRevision: binding.accessRevision, originKind: context.kind }
        const scope = state.scope
        state.readProof = async () => {
          const current = await input.resolveCase(context)
          if (current.status !== "ok" || !isDeepStrictEqual(current.value, currentCase)) throw unavailable()
          return provenance.read(resources, context, scope)
        }
        state.proof = await state.readProof()
        if (context.kind === "native" && context.binding.entryMode === "routine-result" && !state.proof) throw unavailable()
      }
      if (intent.operation !== "catalog") {
        const recipeProof = intent.operation === "native-recipe" ? await provenance.readRecipe(resources, context, intent.reference) : undefined
        const recipePlans = recipeProof ? await resources.records.listPlans(recipeProof.authoritySessionID) : []
        const recipePlan = intent.operation === "native-recipe" ? (await Promise.all(recipePlans.map(async (plan) =>
          await resources.records.isLatestPlan(plan) && plan.workflowBinding.publication.documentID === intent.reference ? plan : undefined)))
          .filter((plan) => plan !== undefined) : []
        if (intent.operation === "native-recipe" && recipePlan.length !== 1) throw unavailable()
        const readNative = () => {
          if (intent.operation === "read-run") return resources.records.readRun(intent.reference)
          if (intent.operation === "read-admission") return resources.records.readAdmission(intent.reference)
          if (intent.operation === "run") return resources.records.readAdmission(intent.request.admissionRef)
          return Promise.resolve(undefined)
        }
        const native = await readNative()
        const plan = intent.operation === "prepare" ? await resources.records.readPlan(intent.request.planRevisionId) :
          intent.operation === "native-recipe" ? recipePlan[0] : native?.revision
        if (!plan || intent.operation !== "prepare" && intent.operation !== "native-recipe" && !native) throw unavailable()
        if (intent.operation === "run" && (!native || !captureSfRoutineApprovedChain(native) ||
          native.reference !== intent.request.admissionRef || native.version !== intent.request.expectedAdmissionVersion ||
          !isDeepStrictEqual(currentCase, intent.request.caseRef) ||
          context.kind !== "ui" || !await input.authorizeRun(context, sfRoutineHumanRunCommand219(intent.request)))) throw unavailable()
        const proof = await provenance.readSession(resources, context, SessionSchema.ID.make(plan.sessionID))
        const retained = readSfRoutineNativeInput(plan)
        if (!proof || !retained || !isDeepStrictEqual(proof.scope.caseRef, currentCase) || proof.scope.job !== retained.purpose ||
          retained.owner.installationId !== proof.installationId || retained.owner.projectId !== proof.projectId ||
          retained.owner.locationId !== proof.locationId ||
          retained.owner.hostId !== proof.hostId || retained.owner.principalRef !== proof.principalRef ||
          retained.owner.authoritySessionId !== proof.authoritySessionID || retained.owner.providerGeneration !== proof.scope.providerGeneration ||
          retained.owner.policyVersion !== proof.scope.policyVersion || retained.owner.accessRevision !== proof.scope.accessRevision)
          throw unavailable()
        if (state.mode !== "history" && (proof.hostId !== resources.identity.hostId || proof.scope.providerGeneration !== generation ||
          proof.scope.policyVersion !== binding.policyVersion || proof.scope.accessRevision !== binding.accessRevision)) throw unavailable()
        state.scope = proof.scope
        const original = native && nativeIdentity(native, state.mode === "history")
        state.readProof = async () => {
          const current = await input.resolveCase(context)
          if (current.status !== "ok" || !isDeepStrictEqual(current.value, currentCase)) throw unavailable()
          if (intent.operation === "prepare" || intent.operation === "native-recipe") {
            if (!isDeepStrictEqual(await resources.records.readPlan(plan.id), plan) || !await resources.records.isLatestPlan(plan)) throw unavailable()
          }
          if (intent.operation !== "prepare" && intent.operation !== "native-recipe") {
            const after = await readNative()
            if (!after || !isDeepStrictEqual(nativeIdentity(after, state.mode === "history"), original)) throw unavailable()
          }
          const resolved = await input.resolveInputs(retained.input.inputRefs, context)
          if (resolved.status !== "ok" || routineSourceDigest(resolved.value) !== routineSourceDigest(retained.sourceRefs) ||
            !await input.revalidateSources(retained.sourceRefs, context)) throw unavailable()
          return provenance.readSession(resources, context, proof.authoritySessionID)
        }
        state.proof = proof
      }
      if (state.proof) state.sessionID = state.proof.authoritySessionID
      if (!await state.current()) throw unavailable()
      const source: Source = Object.freeze({ [sourceBrand]: true as const })
      sources.set(source, state)
      return source
    } catch (error) {
      close()
      throw error
    }
  })

  const sourceFor = (source: Source) => {
    const state = sources.get(source)
    if (!state || !live.has(state) || state.signal.aborted) throw unavailable()
    return state
  }
  const metadata = (state: SourceState): SfRoutineNativeOwner => {
    return { installationId: state.resources.identity.installationId, hostId: state.resources.identity.hostId,
      projectId: state.resources.identity.projectId, locationId: digestSfValue(state.resources.identity.location),
      authoritySessionId: state.sessionID, principalRef: state.context.binding.principalRef,
      policyVersion: state.context.binding.policyVersion, accessRevision: state.context.binding.accessRevision,
      providerGeneration: state.generation }
  }

  const validate = async (run: RunState) => {
    const state = run.source
    if (!state.proof || !await state.current()) return false
    const after = await observeSfRoutineNative(() => state.resources.records.readAdmission(run.intent.authorizationId), state.signal)
    if (!after || !run.chain.accept(after) || !await state.resources.records.isLatestPlan(after.revision) ||
      !await state.resources.records.isCurrentApproval(after)) return false
    const retained = readSfRoutineNativeInput(after.revision)
    if (!retained || !sameSfRoutineNativeOwner(retained.owner, metadata(state))) return false
    const selected = await input.resolveCase(state.context)
    if (selected.status !== "ok" || !isDeepStrictEqual(selected.value, retained.input.caseRef)) return false
    const resolved = await input.resolveInputs(retained.input.inputRefs, state.context)
    const publication = input.publication()
    if (resolved.status !== "ok" || routineSourceDigest(resolved.value) !== routineSourceDigest(retained.sourceRefs) ||
      !publication || publication.publication.projectID !== retained.owner.projectId || !await publication.authorize(state.context)) return false
    const pinned = await Effect.runPromise(Effect.result(RelayWorkflowBinding.revalidate(publication.publication, after.revision.workflowBinding)))
    return pinned._tag === "Success" && input.publication() === publication &&
      await input.revalidateSources(retained.sourceRefs, state.context) && await state.current()
  }

  const approve = (source: Source, command: RunInput): Effect.Effect<ApprovedRun, BridgeError> => checked(async () => {
    const state = sourceFor(source)
    if (state.mode !== "run" || state.intent.operation !== "run" || !isDeepStrictEqual(state.intent.request, command) ||
      state.context.kind !== "ui" || state.request.method !== "POST" || !state.proof || !await state.current()) throw unavailable()
    const ui = state.context
    const exact = sfRoutineHumanRunCommand219(command)
    if (!await observeSfRoutineNative(() => input.authorizeRun(ui, exact), state.signal)) throw unavailable()
    const before = await observeSfRoutineNative(() => state.resources.records.readAdmission(command.admissionRef), state.signal)
    const chain = before && captureSfRoutineApprovedChain(before)
    if (!before || !chain ||
      before.reference !== command.admissionRef || before.version !== command.expectedAdmissionVersion ||
      before.parent.id !== state.proof.authoritySessionID) throw unavailable()
    const retained = readSfRoutineNativeInput(before.revision)
    if (!retained || !isDeepStrictEqual(command.caseRef, retained.input.caseRef)) throw unavailable()
    const permissions = await observeSfRoutineNative(() => Effect.runPromise(state.resources.store.permissions(before.parent.id)), state.signal)
    if (!permissions) throw unavailable()
    const policySnapshot = structuredClone(permissions)
    const run: RunState = { source: state, before: chain.before, chain,
      nativePolicy: createSfRoutineNativePhasePolicy(state.resources, before),
      intent: Object.freeze({ planRevisionId: before.revision.id, authorizationId: before.authorizationID,
        inputDigest: retained.inputDigest, caseRef: Object.freeze({ ...retained.input.caseRef }) }), current: async () => false }
    // Readers span awaits. Serialize observations so an older in-flight projection cannot look like a rollback
    // after the monitor/native hook has already observed a later reservation/binding. Bound the waiter set too.
    const observation = { tail: Promise.resolve(), waiting: 0 }
    run.current = () => {
      if (observation.waiting >= 16 || state.signal.aborted) { state.close(); return Promise.resolve(false) }
      observation.waiting++
      const attempt = observation.tail.then(async () => {
        const valid = await observeSfRoutineNative(async () => {
          const currentPermissions = await Effect.runPromise(state.resources.store.permissions(before.parent.id))
          return isDeepStrictEqual(policySnapshot, currentPermissions) && await validate(run) &&
            await input.authorizeRun(ui, exact) && await state.current()
        }, state.signal)
        if (!valid) state.close()
        return valid === true
      }).finally(() => { observation.waiting-- })
      observation.tail = attempt.then(() => undefined, () => { state.close() })
      return attempt
    }
    if (!await run.current()) throw unavailable()
    const token: ApprovedRun = Object.freeze({ [approvedBrand]: true as const })
    approvals.set(token, run)
    return token
  })

  const authorizeIntent = async (context: TrustedUiContext, intent: SfRoutineNativeAdmissionIntent) => {
    const run = [...staged.values()].find((candidate) => candidate.source.context === context && isDeepStrictEqual(candidate.intent, intent))
    return !!run && await run.current()
  }
  const origin = createSfRoutineNativeOrigin({ ready, resources: input.resources, requestFor: input.requestFor,
    authorize: input.authorize, authorizeIntent, generation: input.generation })

  const activate = (state: SourceState, run?: RunState): Effect.Effect<"settled" | "busy", BridgeError> => Effect.gen(function* () {
    const sessionID = state.sessionID
    if (state.mode === "history" || run && state.mode !== "run" || !state.scope || !(yield* checked(state.current))) return yield* unavailable()
    const operation = fence.enter<void, BridgeError, never>(sessionID, {
      ready: () => !!state.registrations,
      signal: run ? AbortSignal.any([state.signal, run.nativePolicy.signal]) : state.signal,
      current: run ? async () => await run.current() && await run.nativePolicy.current() : state.current,
      data: JSON.stringify({ originKind: state.context.kind, originalIntent: state.intent, owner: metadata(state),
        caseRef: state.scope.caseRef, classification: state.context.kind === "native" ? "model-derived DATA, never human approval" : "original human command, not native approval" }),
    }, Effect.scoped(Effect.gen(function* () {
      if (!(yield* checked(state.current)) || staged.has(sessionID)) return yield* unavailable()
      const phase: Phase = { bridge: identity, source: state, ...(run ? { run } : {}) }
      // This is the first safe boundary: exclusive already owns the Session, but no provider/tool work has begun.
      return yield* Effect.acquireUseRelease(Effect.sync(() => {
        if (run) staged.set(sessionID, run)
      }), () => Effect.gen(function* () {
        // Provider waits and pending permissions must also observe revocation, not only the next tool boundary.
        yield* Effect.forkScoped(checked(run ? async () => await run.current() && await run.nativePolicy.current() : state.current).pipe(
          Effect.tap((valid) => valid ? Effect.void : Effect.sync(state.close)),
          Effect.catch(() => Effect.sync(state.close)), Effect.repeat(Schedule.spaced("1 second")),
        ))
        // A Claude parent has no genuine governed-load observer. Report that before any prompt, provider, or admission work.
        const parent = yield* state.resources.store.get(sessionID)
        if (parent?.agent === AgentV2.defaultID) {
          const engine = yield* ExecutionHost.engineOf(state.resources.agents, state.resources.store)(parent).pipe(Effect.mapError(() => unavailable()))
          if (engine === "claude-code") return yield* new BridgeError({ reason: "SF_NATIVE_PHASE_GOVERNED_HOST_RECEIPT_API_REQUIRED" })
        }
        // Scaffold has a durable denial-only parent marker before any input. It contains no prompt/model data.
        if (!state.proof) yield* provenance.reserve(state.resources, state.sessions, state.context, sessionID, state.current)
          .pipe(Effect.mapError(() => unavailable()))
        return yield* state.resources.execution.withRunner(sessionID, (runner) => Effect.gen(function* () {
          // Verify the actual installed runner adapter BEFORE sensitive durable admission, not a ready:true callback.
          if (!fence.installed(runner)) return yield* unavailable()
          yield* initializeSfRoutinePhaseScope(state.resources, runner, sessionID).pipe(Effect.mapError((error) =>
            new BridgeError({ reason: error.message })))
          const registrations = SF_ROUTINE_PHASE_SCOPE.tools.map((name) => [name, state.resources.registry.currentRegistrationIdentity(name)] as const)
          if (registrations.some((entry) => !entry[1])) return yield* unavailable()
          state.registrations ??= new Map(registrations.map((entry) => [entry[0], entry[1]!] as const))
          if (!state.proof) {
            if (state.intent.operation !== "catalog" || !state.scope) return yield* unavailable()
            state.proof = yield* provenance.create(state.resources, state.sessions, state.context, state.request,
              state.scope, sessionID, state.current).pipe(Effect.mapError(() => unavailable()))
          }
          const parent = yield* state.resources.store.get(sessionID)
          if (!parent) return yield* unavailable()
          // This internal parent title is host-owned. Keep the original location-scoped title-generator side fiber
          // out of phase business data on every activation, including a later user reset to the default title.
          yield* state.sessions.rename({ sessionID, title: "Routine planning" }).pipe(Effect.mapError(() => unavailable()))
          if (run && state.context.kind !== "ui") return yield* unavailable()
          const ui = state.context.kind === "ui" ? state.context : undefined
          const release = run && ui ? yield* checked(() => origin.admit({ request: state.request, context: ui,
            authoritySessionID: sessionID, intent: run.intent, signal: state.signal, current: run.current,
            nativePolicy: { signal: run.nativePolicy.signal, current: run.nativePolicy.current } })) : undefined
          if (run && !release) return yield* unavailable()
          return yield* Effect.acquireUseRelease(Effect.succeed(release), () => Effect.gen(function* () {
          if (run) {
            if (!(yield* checked(run.current))) return yield* unavailable()
            const intent = run.before.presentation!.intent
            // This is the real fresh human run POST, NOT a synthesized approval. Public prompt admits without
            // waking; the already-owned original runner below promotes it. No assistant/tool event is fabricated.
            yield* state.sessions.prompt({ sessionID, resume: false,
              prompt: { text: `Original authenticated routine run command (NOT a native approval reply):\n${JSON.stringify({
                admissionRef: run.before.reference, expectedAdmissionVersion: run.before.version, caseRef: run.intent.caseRef,
              })}\nThe planning phase has ended. Execute only this ALREADY natively reviewed/approved authorization through the original Task tool; keep all Task Permission and Relay checks. Do not create another approval or grant a permission. Exact approved Task intent:\n${JSON.stringify({
                description: run.before.revision.goal.value, prompt: intent.prompt, subagent_type: intent.subagentType,
                ...(intent.model ? { model: intent.model } : {}), authorizationID: run.intent.authorizationId,
                workflow: { documentID: run.before.revision.workflowBinding.publication.documentID,
                  planRevisionID: run.intent.planRevisionId, parameters: run.before.revision.workflowBinding.parameters },
                writePaths: run.before.revision.workflowBinding.writePaths,
              })}` },
            }).pipe(Effect.mapError(() => unavailable()))
            if (!(yield* checked(run.current))) return yield* unavailable()
          }
          return yield* runner.run({ sessionID, force: true }).pipe(Effect.mapError(() => unavailable()))
          }), (close) => Effect.sync(() => close?.()))
        }).pipe(Effect.provideService(CurrentPhase, phase)))
      }), () => Effect.sync(() => { if (run && staged.get(sessionID) === run) staged.delete(sessionID) }))
    }))).pipe(Effect.mapError((error) => error instanceof BridgeError ? error : unavailable()))
    // Cancellation of exclusive's waiter alone does not cancel its independent operation. Close THIS capability,
    // and race the operation itself; never interrupt a Session selected by ID (it may have a successor owner).
    const result = yield* state.resources.execution.exclusive(sessionID,
      withSfRoutineNativeAbort(operation, run ? AbortSignal.any([state.signal, run.nativePolicy.signal]) : state.signal), { wait: false })
      .pipe(Effect.onInterrupt(() => Effect.sync(state.close)))
    if (Option.isNone(result)) return "busy" as const
    if (!(yield* checked(run ? run.current : state.current))) return yield* unavailable()
    return "settled" as const
  })

  const bridge: NativePhaseBridge = {
    withPlanning: (source, use) => Effect.suspend(() => Effect.gen(function* () {
      const state = yield* Effect.try({ try: () => sourceFor(source), catch: () => unavailable() })
      if (state.mode !== "planning") return yield* unavailable()
      if (!state.proof && (yield* activate(state).pipe(Effect.tapCause(() => Effect.sync(state.close)))) === "busy") return yield* unavailable()
      return yield* withSfRoutineNativeAbort(Effect.acquireUseRelease(checked(async () => {
        if (state.context.kind === "ui" && state.request.method !== "POST" || !await state.current() || planning.has(state)) throw unavailable()
        if (!state.proof || !await state.current()) throw unavailable()
        const binding = Object.freeze({ request: state.request, authoritySessionID: state.sessionID })
        planning.set(state, binding)
        return Object.freeze({ [planningBrand]: true as const, authoritySessionID: binding.authoritySessionID,
          owner: Object.freeze(metadata(state)), resume: () => activate(state) })
      }), (lease) => withSfRoutineNativeAbort(use(lease).pipe(Effect.tap(() => Effect.gen(function* () {
        if (!(yield* checked(state.current))) return yield* unavailable()
      }))), state.signal), () => Effect.sync(state.close)), state.signal).pipe(Effect.ensuring(Effect.sync(state.close)))
    })),
    run: (source, token) => Effect.gen(function* () {
      const state = yield* Effect.try({ try: () => sourceFor(source), catch: () => unavailable() })
      const run = approvals.get(token)
      if (!run || run.source !== state) return yield* unavailable()
      // A token can activate only once, even after a busy result; a retry reauthenticates a fresh Request.
      approvals.delete(token)
      return yield* activate(state, run).pipe(Effect.ensuring(Effect.sync(state.close)))
    }),
    withInvocation: <A, E, R>(invocation: ToolSafety.Invocation, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | ToolSafety.Denied, R> => Effect.gen(function* () {
      const phase = yield* CurrentPhase
      if (phase && invocation.sessionID === phase.source.sessionID) {
        if (!sfRoutinePhaseArsenalAllowed(invocation, phase.source.sessionID))
          return yield* new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_WORKFLOW_TOOL_OUTSIDE_SCOPE" })
        if (invocation.tool === "task" && !phase.run) {
          const target = Seats.planner()
          const args = invocation.args
          if (!target || target.profileKey !== "upstream" || !args || typeof args !== "object" ||
            !("subagent_type" in args) || args.subagent_type !== target.id)
            return yield* new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_NATIVE_PLANNER_REQUIRED" })
        }
      }
      const run = [...staged.values()].find((candidate) => candidate.before.parent.id === invocation.sessionID)
      if (run && (!phase || phase.bridge !== identity || phase.source !== run.source || phase.run !== run))
        return yield* new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_SCOPE_REQUIRED" })
      const admission = input.admission()
      const original = admission ? admission.run(invocation, effect) : effect
      const native = run && invocation.tool === "task" ? run.nativePolicy.observe(invocation, original) : original
      return yield* fence.observe(invocation, native)
    }),
    historical: async (source) => {
      const state = sources.get(source)
      if (!state?.proof || !await state.current()) return undefined
      const proof = state.proof
      // Re-read the independent host-written association, including its actual durable initial prompt, on every fence.
      return Object.freeze({ authoritySessionID: proof.authoritySessionID, signal: state.signal,
        current: async (context: TrustedDomainContext, request: Request) => {
          const valid = context === state.context && request === state.request &&
            isDeepStrictEqual(await observeSfRoutineNative(state.readProof, state.signal), proof) && await state.current()
          if (!valid) state.close()
          return valid
        } })
    },
  }
  const owners: SfRoutineNativeOwnerPort = {
    available: () => !disposed && (planning.size > 0 || input.readOwners?.available?.() === true),
    resolve: async (context, request) => {
      const found = [...planning].filter(([state]) => state.context === context && state.request === request)
      if (found.length > 1) return undefined
      if (found.length === 1) return await found[0]![0].current() ? found[0]![1] : undefined
      // No resident/profile/old Task-registry fallback can masquerade as the independently issued Maestro parent.
      return input.readOwners?.resolve(context, request)
    },
  }
  return { ...bridge, issue, approve, owners, origin: origin.origin, authorizeIntent, contribution: fence.contribution,
    beforeTurn: fence.beforeTurn, admitted: fence.admitted,
    rememberNativeRecipe: async (context: TrustedDomainContext, reference: string, planRevisionID: string) => {
      if (context.kind !== "native") return
      const found = [...planning.keys()].filter((state) => state.context === context && state.request === input.requestFor(context))
      if (found.length !== 1) throw unavailable()
      const state = found[0]!
      if (!state.proof || !await state.current()) throw unavailable()
      const plan = await state.resources.records.readPlan(planRevisionID)
      if (!plan || plan.sessionID !== state.sessionID || plan.workflowBinding.publication.documentID !== reference ||
        !await state.resources.records.isLatestPlan(plan) || readSfRoutineNativeInput(plan)?.purpose !== state.scope?.job) throw unavailable()
      await provenance.rememberRecipe(state.resources, context, reference, state.proof)
      if (!await state.current()) throw unavailable()
    },
    /** Adapter-only projection bridge. Neither command selectors nor an approval record issue Source. */
    start: async (context: TrustedDomainContext, command: RunInput): Promise<false | "settled" | "busy"> => {
      if (context.kind !== "ui") return false
      const source = await Effect.runPromise(issue(context, { operation: "run", request: command }))
      return Effect.runPromise(approve(source, command).pipe(Effect.flatMap((token) => bridge.run(source, token)),
        Effect.ensuring(Effect.sync(() => sources.get(source)?.close()))))
    },
    finish: (source: Source) => sources.get(source)?.close(),
    revoke: (request: Request) => { for (const state of live) if (state.request === request) state.close(); origin.revoke(request) },
    invalidateGeneration: (generation: number) => {
      invalidGenerations.add(generation)
      for (const state of live) if (state.generation === generation || state.generation === -1) state.close()
      origin.invalidateGeneration(generation)
    },
    dispose: () => { disposed = true; for (const state of live) state.close(); origin.dispose(); releaseFence() },
  }
}

function unavailable() { return new BridgeError({ reason: "SF_NATIVE_PHASE_UNAVAILABLE" }) }
function nativeIdentity(value: NativeAdmission, history: boolean) {
  return structuredClone({ revision: value.revision, authorizationID: value.authorizationID, authorization: value.authorization,
    validation: value.validation, context: value.context, review: value.review, approval: value.approval, presentation: value.presentation,
    parent: { id: value.parent.id, parentID: value.parent.parentID, projectID: value.parent.projectID, location: value.parent.location,
      agent: value.parent.agent, model: value.parent.model },
    ...(history ? { reference: value.reference, version: value.version, reservation: value.reservation, bound: value.bound } : {}) })
}
function checked<A>(read: () => Promise<A>) {
  return Effect.tryPromise({ try: read, catch: () => unavailable() })
}
