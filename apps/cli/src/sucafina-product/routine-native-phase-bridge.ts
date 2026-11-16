import { isDeepStrictEqual } from "node:util"
import { Context, Effect, Option, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import type { SessionV2 } from "@orchestra/core/session"
import type { SessionSchema } from "@orchestra/core/session/schema"
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
}) {}
export interface NativePhaseBridge {
  withPlanning<A, E>(source: Source, use: (lease: PlanningLease) => Effect.Effect<A, E>): Effect.Effect<A, E | BridgeError>
  run(source: Source, approved: ApprovedRun): Effect.Effect<"settled" | "busy", BridgeError>
  withInvocation<A, E, R>(invocation: ToolSafety.Invocation, effect: Effect.Effect<A, E, R>): Effect.Effect<A, E | ToolSafety.Denied, R>
  historical(source: Source): Promise<SfRoutineNativeHistoricalAuthority | undefined>
}
type RunInput = Parameters<BusinessPorts["routines"]["run"]>[0]
type Input = Pick<SfRoutineNativeAdapterInput, "resources" | "requestFor" | "authorize" | "generation" | "publication" |
  "governance" | "resolveCase" | "resolveInputs" | "revalidateSources"> & {
  sessions: () => SessionV2.Interface | undefined
  originDirectory: string
  owners: SfRoutineNativeOwnerPort
  admission: () => ReturnType<typeof createSfRoutineNativeAdmission> | undefined
  authorizeRun: (context: TrustedUiContext, command: SfRoutineNativeHumanRunCommand) => Promise<boolean>
}
type Provenance = NonNullable<Awaited<ReturnType<ReturnType<typeof createSfRoutinePhaseOrigin>["read"]>>>
type SourceState = {
  request: Request
  context: TrustedUiContext
  resources: NonNullable<ReturnType<Input["resources"]>>
  sessions: SessionV2.Interface
  generation: number
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
  const sources = new WeakMap<Source, SourceState>()
  const live = new Set<SourceState>()
  const approvals = new WeakMap<ApprovedRun, RunState>()
  const planning = new Map<SourceState, SfRoutineNativeOwnerBinding>()
  const staged = new Map<SessionSchema.ID, RunState>()
  const invalidGenerations = new Set<number>()
  let disposed = false
  const ready = () => !disposed && !!input.sessions() && !!input.publication() &&
    !!input.resources()?.current() && input.governance.installed(input.resources()!.governance) &&
    input.governance.guardsInstalled(input.resources()!.safety, input.resources()!.relay)

  const issue = (context: TrustedUiContext): Effect.Effect<Source, BridgeError> => checked(async () => {
    const request = input.requestFor(context), resources = input.resources(), sessions = input.sessions()
    if (!ready() || !request || request.signal.aborted || !resources || !sessions || context.kind !== "ui" || live.size >= 100)
      throw unavailable()
    const expires = Math.min(Date.parse(context.binding.expiresAt), Date.now() + 300_000)
    if (!Number.isFinite(expires) || expires <= Date.now()) throw unavailable()
    const deadline = performance.now() + expires - Date.now()
    const abort = new AbortController()
    const signal = AbortSignal.any([request.signal, abort.signal])
    const bindingDigest = digestSfValue(context.binding), headersDigest = digestSfValue([...request.headers])
    const resourceDigest = digestSfValue(resources.identity)
    const close = () => { abort.abort(); live.delete(state); planning.delete(state); clearTimeout(timer) }
    const timer = setTimeout(close, Math.max(0, expires - Date.now()))
    // Track pending authentication too: revoke/dispose must not miss a source still acquiring authority.
    const state: SourceState = { request, context, resources, sessions, generation: -1, signal, close,
      current: async () => false }
    live.add(state)
    const sync = () => live.has(state) && !disposed && !signal.aborted && Date.now() < expires && performance.now() < deadline &&
      input.requestFor(context) === request && input.resources() === resources && resources.current() && input.sessions() === sessions &&
      digestSfValue(context.binding) === bindingDigest && digestSfValue([...request.headers]) === headersDigest &&
      digestSfValue(resources.identity) === resourceDigest && context.binding.installationId === resources.identity.installationId &&
      context.binding.projectId === resources.identity.projectId && !invalidGenerations.has(state.generation)
    state.current = async () => {
      const authorized = sync() && await observeSfRoutineNative(() => input.authorize(context), signal)
      const generation = authorized && sync() ? await observeSfRoutineNative(input.generation, signal) : undefined
      const proof = state.proof && generation === state.generation && sync()
        ? await observeSfRoutineNative(() => provenance.read(resources, context), signal) : undefined
      if (authorized && generation === state.generation && (!state.proof || isDeepStrictEqual(proof, state.proof)) && sync()) return true
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
      state.proof = await observeSfRoutineNative(() => provenance.read(resources, context), signal)
      if (!await state.current()) throw unavailable()
      const source: Source = Object.freeze({ [sourceBrand]: true })
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
    if (!state.proof) throw unavailable()
    return { installationId: state.resources.identity.installationId, hostId: state.resources.identity.hostId,
      projectId: state.resources.identity.projectId, locationId: digestSfValue(state.resources.identity.location),
      authoritySessionId: state.proof.authoritySessionID, principalRef: state.context.binding.principalRef,
      policyVersion: state.context.binding.policyVersion, accessRevision: state.context.binding.accessRevision,
      providerGeneration: state.generation }
  }

  const validate = async (run: RunState) => {
    const state = run.source
    if (!state.proof || !await state.current()) return false
    const after = await observeSfRoutineNative(() => state.resources.records.readAdmission(run.intent.authorizationId), state.signal)
    if (!after || !sameChain(run.before, after) || !await state.resources.records.isLatestPlan(after.revision)) return false
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
    if (state.request.method !== "POST" || !state.proof || !await state.current()) throw unavailable()
    const exact = sfRoutineHumanRunCommand219(command)
    if (!await input.authorizeRun(state.context, exact)) throw unavailable()
    const before = await state.resources.records.readAdmission(command.admissionRef)
    if (!before || before.state !== "preparing" || before.reservation || before.bound || !approved(before) ||
      before.reference !== command.admissionRef || before.version !== command.expectedAdmissionVersion ||
      before.parent.id !== state.proof.authoritySessionID) throw unavailable()
    const retained = readSfRoutineNativeInput(before.revision)
    if (!retained || !isDeepStrictEqual(command.caseRef, retained.input.caseRef)) throw unavailable()
    const snapshot = structuredClone(before)
    const permissions = await Effect.runPromise(state.resources.store.permissions(before.parent.id))
    const run: RunState = { source: state, before: snapshot,
      intent: Object.freeze({ planRevisionId: before.revision.id, authorizationId: before.authorizationID,
        inputDigest: retained.inputDigest, caseRef: Object.freeze({ ...retained.input.caseRef }) }), current: async () => false }
    run.current = async () => {
      const currentPermissions = await Effect.runPromise(state.resources.store.permissions(before.parent.id))
      return isDeepStrictEqual(permissions, currentPermissions) && await validate(run) &&
        await input.authorizeRun(state.context, exact) && await state.current()
    }
    if (!await run.current()) throw unavailable()
    const token: ApprovedRun = Object.freeze({ [approvedBrand]: true })
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
    const proof = state.proof
    if (!proof || !(yield* checked(state.current))) return yield* unavailable()
    const operation = Effect.gen(function* () {
      if (!(yield* checked(state.current)) || staged.has(proof.authoritySessionID)) return yield* unavailable()
      const phase: Phase = { bridge: identity, source: state, ...(run ? { run } : {}) }
      // This is the first safe boundary: exclusive already owns the Session, but no provider/tool work has begun.
      return yield* Effect.acquireUseRelease(Effect.sync(() => {
        if (run) staged.set(proof.authoritySessionID, run)
      }), () => Effect.gen(function* () {
        const release = run ? yield* checked(() => origin.admit({ request: state.request, context: state.context,
          authoritySessionID: proof.authoritySessionID, intent: run.intent, signal: state.signal,
          current: run.current, nativePolicy: { signal: state.signal, current: run.current } })) : undefined
        if (run && !release) return yield* unavailable()
        return yield* Effect.acquireUseRelease(Effect.succeed(release), () =>
          state.resources.execution.withRunner(proof.authoritySessionID, (runner) => runner.run({ sessionID: proof.authoritySessionID, force: true }))
            .pipe(Effect.provideService(CurrentPhase, phase), Effect.mapError(() => unavailable())),
        (close) => Effect.sync(() => close?.()))
      }), () => Effect.sync(() => { if (run && staged.get(proof.authoritySessionID) === run) staged.delete(proof.authoritySessionID) }))
    })
    // Cancellation of exclusive's waiter alone does not cancel its independent operation. Close THIS capability,
    // and race the operation itself; never interrupt a Session selected by ID (it may have a successor owner).
    const result = yield* state.resources.execution.exclusive(proof.authoritySessionID,
      withSfRoutineNativeAbort(operation, state.signal), { wait: false })
      .pipe(Effect.onInterrupt(() => Effect.sync(state.close)))
    if (Option.isNone(result)) return "busy" as const
    if (!(yield* checked(run ? run.current : state.current))) return yield* unavailable()
    return "settled" as const
  })

  const bridge: NativePhaseBridge = {
    withPlanning: (source, use) => Effect.suspend(() => Effect.gen(function* () {
      const state = yield* Effect.try({ try: () => sourceFor(source), catch: () => unavailable() })
      return yield* Effect.acquireUseRelease(checked(async () => {
        if (state.request.method !== "POST" || !await state.current() || planning.has(state)) throw unavailable()
        state.proof ??= await provenance.create(state.resources, state.sessions, state.context, state.request, state.current)
        if (!await state.current()) throw unavailable()
        const binding = Object.freeze({ request: state.request, authoritySessionID: state.proof.authoritySessionID })
        planning.set(state, binding)
        return Object.freeze({ [planningBrand]: true as const, authoritySessionID: binding.authoritySessionID,
          owner: Object.freeze(metadata(state)), resume: () => activate(state) })
      }), (lease) => withSfRoutineNativeAbort(use(lease).pipe(Effect.tap(() => Effect.gen(function* () {
        if (!(yield* checked(state.current))) return yield* unavailable()
      }))), state.signal), () => Effect.sync(state.close))
    })),
    run: (source, token) => Effect.gen(function* () {
      const state = yield* Effect.try({ try: () => sourceFor(source), catch: () => unavailable() })
      const run = approvals.get(token)
      if (!run || run.source !== state) return yield* unavailable()
      // A token can activate only once, even after a busy result; a retry reauthenticates a fresh Request.
      approvals.delete(token)
      return yield* activate(state, run).pipe(Effect.ensuring(Effect.sync(state.close)))
    }),
    withInvocation: (invocation, effect) => Effect.gen(function* () {
      const phase = yield* CurrentPhase
      const run = [...staged.values()].find((candidate) => candidate.before.parent.id === invocation.sessionID)
      if (run && (!phase || phase.bridge !== identity || phase.source !== run.source || phase.run !== run))
        return yield* new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_SCOPE_REQUIRED" })
      const admission = input.admission()
      return admission ? yield* admission.run(invocation, effect) : yield* effect
    }),
    historical: async (source) => {
      const state = sources.get(source)
      if (!state?.proof || !await state.current()) return undefined
      const proof = state.proof
      // Re-read the independent host-written association, including its actual durable initial prompt, on every fence.
      return Object.freeze({ authoritySessionID: proof.authoritySessionID, signal: state.signal,
        current: async (context: TrustedUiContext, request: Request) => context === state.context && request === state.request &&
          isDeepStrictEqual(await provenance.read(state.resources, context), proof) && await state.current() })
    },
  }
  const owners: SfRoutineNativeOwnerPort = {
    available: () => !disposed && (planning.size > 0 || input.owners.available?.() !== false),
    resolve: async (context, request) => {
      const found = [...planning].filter(([state]) => state.context === context && state.request === request)
      if (found.length > 1) return undefined
      if (found.length === 1) return await found[0]![0].current() ? found[0]![1] : undefined
      return input.owners.resolve(context, request)
    },
  }
  return { ...bridge, issue, approve, owners, origin: origin.origin, authorizeIntent,
    /** Adapter-only projection bridge. Neither command selectors nor an approval record issue Source. */
    start: async (context: TrustedDomainContext, command: RunInput) => {
      if (context.kind !== "ui") return false
      const source = await Effect.runPromise(issue(context))
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
    dispose: () => { disposed = true; for (const state of live) state.close(); origin.dispose() },
  }
}

function approved(value: NativeAdmission) {
  return value.review?.verdict === "APPROVE" && value.approval?.outcome === "APPROVED" && !!value.presentation
}

/** Reservation and workflow binding are the ONLY mutable admission facts. Native records verify their deterministic
 * IDs, hashes, Task call and Relay arm. Never pin the pre-reservation version, or accept another preparing chain.
 */
function sameChain(before: NativeAdmission, after: NativeAdmission) {
  if (!approved(after) || !isDeepStrictEqual({ revision: before.revision, authorization: before.authorization,
    validation: before.validation, context: before.context, review: before.review, approval: before.approval,
    presentation: before.presentation }, { revision: after.revision, authorization: after.authorization,
    validation: after.validation, context: after.context, review: after.review, approval: after.approval,
    presentation: after.presentation }) || before.authorizationID !== after.authorizationID ||
    before.parent.id !== after.parent.id || before.parent.agent !== after.parent.agent ||
    !isDeepStrictEqual(before.parent.location, after.parent.location) || !isDeepStrictEqual(before.parent.model, after.parent.model) ||
    after.parent.time.archived) return false
  if (!after.reservation) return after.state === "preparing" && !after.bound &&
    after.reference === before.reference && after.version === before.version
  return after.reference === after.reservation.id && after.version === after.reservation.seq &&
    after.version > before.version && (after.state === "preparing" && !after.bound || after.state === "admitted" && !!after.bound)
}
function unavailable() { return new BridgeError({ reason: "SF_NATIVE_PHASE_UNAVAILABLE" }) }
function checked<A>(read: () => Promise<A>) {
  return Effect.tryPromise({ try: read, catch: () => unavailable() })
}
