import { isDeepStrictEqual } from "node:util"
import { Effect } from "effect"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import type { SessionSchema } from "@orchestra/core/session/schema"
import { TaskTool } from "@orchestra/core/tool/task"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfRoutineNativeAdapterInput } from "./routine-native-adapter.ts"
import { withSfRoutineNativeAbort } from "./routine-native-dispatch.ts"
import type { createSfRoutineNativeGovernance, SfRoutineNativeOwnerHook } from "./routine-native-governance.ts"
import { readSfRoutineNativeInput, sameSfRoutineNativeOwner, SF_ROUTINE_INPUT_PARAMETER } from "./routine-native-input.ts"
import { captureSfRoutineNativeOwner } from "./routine-native-owner.ts"
import type { createSfRoutineNativeOwnerRegistry } from "./routine-native-registry.ts"
import { routineSourceDigest } from "./routine-services.ts"

/** The exact payload independently authorized by the existing SF human routines.run command. */
export type SfRoutineNativeAdmissionIntent = Readonly<{
  planRevisionId: string
  authorizationId: string
  inputDigest: string
  caseRef: Readonly<{ id: string; incarnation: string; version: number }>
}>

/**
 * Issued only by the authenticated native admission origin. The original Request and consumed SF lease
 * accompany a separately admitted native Maestro Session. IDs and SF_ROUTINE_INPUT are consistency data.
 * current/signal must also fence the native policy, C15 budget and admitted human continuation.
 */
export type SfRoutineNativeAdmissionBinding = Readonly<{
  request: Request
  context: TrustedUiContext
  authoritySessionID: SessionSchema.ID
  intent: SfRoutineNativeAdmissionIntent
  signal: AbortSignal
  current: () => Promise<boolean>
}>

/**
 * Private host capability, never an HTTP/model service or a session-ID lookup. resolve observes the exact
 * original core invocation and returns the same live object until its native owner releases it. A production
 * implementation must possess the authenticated native origin; resolving plan.owner or caller IDs is invalid.
 * No default implementation is installed: the SF resident registry cannot issue this native capability.
 */
export type SfRoutineNativeAdmissionOrigin = {
  ready: () => boolean
  resolve: (invocation: ToolSafety.Invocation) => Promise<SfRoutineNativeAdmissionBinding | undefined>
}

export type SfRoutineNativeAdmissionInput = Pick<SfRoutineNativeAdapterInput,
  "resources" | "requestFor" | "authorize" | "generation" | "publication" | "resolveCase" | "resolveInputs" | "revalidateSources"> & {
  origin: () => SfRoutineNativeAdmissionOrigin | undefined
  registry: ReturnType<typeof createSfRoutineNativeOwnerRegistry>
  governance: ReturnType<typeof createSfRoutineNativeGovernance>
  /** Must be createSfHumanAuthority.authorize(context, "routines.run", intent), with the exact payload. */
  authorizeIntent: (context: TrustedUiContext, intent: SfRoutineNativeAdmissionIntent) => Promise<boolean>
}

/**
 * Installs the missing C07 lease around the ORIGINAL native Task settlement, after independent Request/native
 * origin verification. It never allocates a Session/Task, answers Permission, publishes an approval, invokes
 * another dispatcher or adopts a busy coordinator. Native governance still owns review/approval/arm/Task/Relay.
 */
export function createSfRoutineNativeAdmission(input: SfRoutineNativeAdmissionInput) {
  let disposed = false
  const lifetime = new AbortController()
  const readiness = () => {
    if (disposed) return "disposed" as const
    const resources = input.resources()
    if (!resources?.current() || !input.governance.installed(resources.governance) ||
      !input.governance.guardsInstalled(resources.safety, resources.relay)) return "native-runtime-unavailable" as const
    if (!input.publication()) return "publication-unavailable" as const
    if (!input.origin()?.ready()) return "authenticated-native-origin-unavailable" as const
    return "ready" as const
  }

  const run: SfRoutineNativeOwnerHook["run"] = (invocation, effect) => Effect.gen(function* () {
    if (invocation.tool !== TaskTool.name) return yield* effect
    const args = invocation.args
    const workflow = args && typeof args === "object" && "workflow" in args ? args.workflow : undefined
    const revisionId = workflow && typeof workflow === "object" && "planRevisionID" in workflow
      ? workflow.planRevisionID : undefined
    if (typeof revisionId !== "string") return yield* effect
    const resources = input.resources()
    // The existing governance wrapper remains responsible for refusing unavailable/malformed plans.
    if (!resources?.current()) return yield* effect
    const plan = yield* checked(() => resources.records.readPlan(revisionId))
    if (!plan || !Object.hasOwn(plan.workflowBinding.parameters, SF_ROUTINE_INPUT_PARAMETER)) return yield* effect
    if (!readSfRoutineNativeInput(plan) || readiness() !== "ready") return yield* denied()
    // Dispose interrupts only the SF branch, even while its origin lookup is still pending.
    return yield* withSfRoutineNativeAbort(Effect.gen(function* () {
      const origin = input.origin()
      if (!origin) return yield* denied()
      const binding = yield* checked(() => origin.resolve(invocation))
      if (!binding || binding.context.kind !== "ui" || binding.request.method !== "POST" || binding.signal.aborted ||
        binding.request.signal.aborted || input.requestFor(binding.context) !== binding.request) return yield* denied()
      const context = binding.context
      const request = binding.request
      const signal = binding.signal
      // Protect all post-origin awaits, including initial registry acquisition, not only the Task body.
      return yield* withSfRoutineNativeAbort(input.registry.withRequest(context, request, Effect.gen(function* () {
        const intent = Object.freeze({ planRevisionId: binding.intent.planRevisionId,
          authorizationId: binding.intent.authorizationId, inputDigest: binding.intent.inputDigest,
          caseRef: Object.freeze({ ...binding.intent.caseRef }) })
        const bindingDigest = digestSfValue(context.binding)
        const headersDigest = digestSfValue([...request.headers])
        const nativeCurrent = binding.current
        const generation = yield* checked(input.generation)
        if (generation === undefined || !Number.isSafeInteger(generation) || generation < 0) return yield* denied()
        const witness = yield* captureSfRoutineNativeOwner(resources, invocation)
        if (!isDeepStrictEqual(plan, witness.plan) || binding.authoritySessionID !== witness.authoritySessionID ||
          intent.planRevisionId !== witness.plan.id || intent.inputDigest !== witness.retained.inputDigest ||
          !isDeepStrictEqual(intent.caseRef, witness.retained.input.caseRef) ||
          !args || typeof args !== "object" || !("authorizationID" in args) || args.authorizationID !== intent.authorizationId)
          return yield* denied()
        const expectedOwner = {
          installationId: resources.identity.installationId, hostId: resources.identity.hostId,
          projectId: resources.identity.projectId, locationId: digestSfValue(resources.identity.location),
          authoritySessionId: witness.authoritySessionID, principalRef: context.binding.principalRef,
          policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision, providerGeneration: generation,
        }
        if (!sameSfRoutineNativeOwner(witness.retained.owner, expectedOwner)) return yield* denied()
        const publication = input.publication()
        if (!publication || publication.publication.projectID !== resources.identity.projectId) return yield* denied()
        const publicationPort = publication.publication
        const sync = () => !disposed && input.resources() === resources && resources.current() &&
          input.origin() === origin && origin.ready() && input.publication() === publication && publication.publication === publicationPort &&
          input.governance.installed(resources.governance) && input.governance.guardsInstalled(resources.safety, resources.relay) &&
          binding.request === request && binding.context === context && binding.signal === signal && binding.current === nativeCurrent &&
          binding.authoritySessionID === witness.authoritySessionID && !request.signal.aborted && !signal.aborted &&
          input.requestFor(context) === request && digestSfValue(context.binding) === bindingDigest &&
          digestSfValue([...request.headers]) === headersDigest && isDeepStrictEqual(binding.intent, intent)
        const current = async () => {
          if (!sync() || !await nativeCurrent() || !sync() || !await input.authorize(context) ||
            !await input.authorizeIntent(context, intent) || !sync() || await origin.resolve(invocation) !== binding ||
            await input.generation() !== generation || !await witness.current() || !sync()) return false
          const selectedCase = await input.resolveCase(context)
          if (selectedCase.status !== "ok" || !isDeepStrictEqual(selectedCase.value, witness.retained.input.caseRef) || !sync()) return false
          const sources = await input.resolveInputs(witness.retained.input.inputRefs, context)
          if (sources.status !== "ok" || routineSourceDigest(sources.value) !== routineSourceDigest(witness.retained.sourceRefs) || !sync() ||
            !await publication.authorize(context)) return false
          const verified = await Effect.runPromise(Effect.result(RelayWorkflowBinding.revalidate(publicationPort, witness.plan.workflowBinding)))
          if (verified._tag === "Failure" || !sync() || !await input.revalidateSources(witness.retained.sourceRefs, context)) return false
          // All source/publication awaits precede one final identity/authority fence, including egress.
          return sync() && await input.authorize(context) && await input.authorizeIntent(context, intent) &&
            await nativeCurrent() && await origin.resolve(invocation) === binding && await input.generation() === generation &&
            await witness.current() && sync()
        }
        if (!(yield* checked(current))) return yield* denied()
        const guarded = Effect.acquireUseRelease(
          Effect.sync(() => input.governance.tryBind(witness.plan.id, { current, signal: AbortSignal.any([request.signal, signal]) })),
          (release) => Effect.gen(function* () {
            if (!release) return yield* denied()
            if (!(yield* checked(current))) return yield* denied()
            const result = yield* effect
            if (!(yield* checked(current))) return yield* denied()
            return result
          }),
          (release) => Effect.sync(() => release?.()),
        )
        // The native coordinator already owns this settlement. No exclusive/resume/Task call is made here.
        // Claim the existing registry replay fence before touching the plan lease. A rejected duplicate must
        // not replace/release the original caller's authority, including two calls with distinct Request objects.
        return yield* input.registry.run(invocation, guarded)
      })), AbortSignal.any([request.signal, signal]))
    }), lifetime.signal)
  })

  return {
    run, readiness,
    revoke: input.registry.revoke,
    invalidateGeneration: input.registry.invalidateGeneration,
    dispose: () => { disposed = true; lifetime.abort(); input.registry.dispose() },
  }
}

function denied() {
  return new ToolSafety.Denied({ reason: "SF_ROUTINE_NATIVE_ADMISSION_UNAVAILABLE" })
}

function checked<A>(read: () => Promise<A>) {
  return Effect.tryPromise({ try: read, catch: () => denied() })
}

