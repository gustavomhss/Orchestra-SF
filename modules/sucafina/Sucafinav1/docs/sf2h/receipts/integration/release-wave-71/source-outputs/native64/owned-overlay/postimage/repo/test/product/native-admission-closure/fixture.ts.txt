import { isDeepStrictEqual } from "node:util"
import { Effect, type Scope } from "effect"
import { CapabilityInvocation } from "@orchestra/core/capability/invocation"
import type { ToolSafety } from "@orchestra/core/tool-safety"
import type { RoutinePublicationHost } from "../../../product/routines/publication.ts"
import { createSfRoutineNativeAdmission } from "../../../../../../apps/cli/src/sucafina-product/routine-native-admission.ts"
import type { SfRoutineNativeAdmissionBinding, SfRoutineNativeAdmissionInput, SfRoutineNativeAdmissionIntent, SfRoutineNativeAdmissionOrigin } from "../../../../../../apps/cli/src/sucafina-product/routine-native-admission.ts"
import { createSfRoutineNativeGovernance } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import type { SfRoutineNativeAuthorityLease } from "../../../../../../apps/cli/src/sucafina-product/routine-native-governance.ts"
import { readSfRoutineNativeInput } from "../../../../../../apps/cli/src/sucafina-product/routine-native-input.ts"
import { ids, withOwnerFixture, type OwnerFixture } from "../routine-native-owner-binding/fixture.ts"

/**
 * COMPONENT PROOF ONLY. Reuses component41's real SQLite, records, Permission, ToolRegistry,
 * publication compiler/store and owner registry. Request/UI lease, authenticated origin, native
 * CapabilityInvocation frame, sessions, approval, arm and Task records are synthetic fixture data.
 * installed/guardsInstalled below are fixture predicates; no production composition is installed.
 * Original settlement is an observable test Effect, never a Task/provider/Relay/Schedule dispatch.
 * The inherited Task registration throws SYNTHETIC_TASK_MUST_NOT_DISPATCH if execution is attempted.
 * These tests cannot certify native execution, AM02, AM06, provider return or installed admission.
 */
const build = Effect.fn("SfNativeAdmissionComponentFixture.build")(function* (owner: OwnerFixture) {
  const uiContext = owner.ui()
  owner.state.context = uiContext
  owner.state.request = new Request("https://sf-fixture.invalid/routines/run", {
    method: "POST", signal: owner.controller.signal,
    headers: { "x-sf-fixture-actor": owner.retained.owner.principalRef },
  })
  const retained = readSfRoutineNativeInput(owner.plan)
  if (!retained) return yield* Effect.die("Existing synthetic native plan has no retained SF input")
  const expectedIntent: SfRoutineNativeAdmissionIntent = {
    planRevisionId: owner.plan.id, authorizationId: ids.authorization,
    inputDigest: retained.inputDigest, caseRef: { ...retained.input.caseRef },
  }
  const nativeController = new AbortController()
  const admissionState: {
    origin: SfRoutineNativeAdmissionOrigin | undefined
    binding: SfRoutineNativeAdmissionBinding | undefined
    originReady: boolean
    nativeCurrent: boolean
    intentAuthorized: boolean
    installed: boolean
    guardsInstalled: boolean
    publication: RoutinePublicationHost | undefined
    publicationAuthorized: boolean
    selectedCase: Awaited<ReturnType<SfRoutineNativeAdmissionInput["resolveCase"]>>
    sources: Awaited<ReturnType<SfRoutineNativeAdmissionInput["resolveInputs"]>>
    sourceReader: SfRoutineNativeAdmissionInput["resolveInputs"] | undefined
    sourcesCurrent: boolean
  } = {
    origin: undefined, binding: undefined, originReady: true, nativeCurrent: true,
    intentAuthorized: true, installed: true, guardsInstalled: true,
    publication: undefined, publicationAuthorized: true,
    selectedCase: { status: "ok", value: { ...retained.input.caseRef } },
    sources: { status: "ok", value: [...retained.sourceRefs] }, sourceReader: undefined, sourcesCurrent: true,
  }
  const trace = {
    resolutions: [] as ToolSafety.Invocation[], intents: [] as SfRoutineNativeAdmissionIntent[],
    bindAttempts: 0, binds: 0, releases: 0,
    active: new Map<string, SfRoutineNativeAuthorityLease>(),
  }
  const admissionBinding: SfRoutineNativeAdmissionBinding = {
    request: owner.state.request, context: uiContext, authoritySessionID: ids.parent,
    intent: structuredClone(expectedIntent), signal: nativeController.signal,
    current: async () => admissionState.nativeCurrent,
  }
  const fixtureOrigin: SfRoutineNativeAdmissionOrigin = {
    ready: () => admissionState.originReady,
    resolve: async (invocation) => {
      trace.resolutions.push(invocation)
      // An explicit fake issuer maps the exact invocation object, never a user-supplied ID.
      return invocation === owner.invocation ? admissionState.binding : undefined
    },
  }
  admissionState.binding = admissionBinding
  admissionState.origin = fixtureOrigin
  const publicationHost: RoutinePublicationHost = {
    publication: owner.publication,
    authorize: async (context) => admissionState.publicationAuthorized && owner.state.authorized && context === owner.state.context,
    authorSession: async () => ids.parent,
  }
  admissionState.publication = publicationHost
  const realGovernance = createSfRoutineNativeGovernance({ records: () => owner.resources.records })
  const governance: ReturnType<typeof createSfRoutineNativeGovernance> = {
    ...realGovernance,
    // ONLY the composition predicates are substituted. Binding/replay/release use the real map.
    installed: (service) => admissionState.installed && service === owner.resources.governance,
    guardsInstalled: (safety, relay) => admissionState.guardsInstalled && safety === owner.resources.safety && relay === owner.resources.relay,
    tryBind: (planRevisionId, authority) => {
      trace.bindAttempts++
      const release = realGovernance.tryBind(planRevisionId, authority)
      if (!release) return undefined
      trace.binds++
      trace.active.set(planRevisionId, authority)
      let active = true
      const observedRelease = () => {
        if (!active) return
        active = false
        authority.signal.removeEventListener("abort", observedRelease)
        release()
        trace.releases++
        if (trace.active.get(planRevisionId) === authority) trace.active.delete(planRevisionId)
      }
      authority.signal.addEventListener("abort", observedRelease, { once: true })
      if (authority.signal.aborted) observedRelease()
      return observedRelease
    },
  }
  const admission = createSfRoutineNativeAdmission({
    resources: () => owner.state.resources,
    requestFor: (context) => context === owner.state.context ? owner.state.request : undefined,
    authorize: async (context) => owner.state.authorized && context === owner.state.context,
    generation: async () => owner.state.generation,
    publication: () => admissionState.publication,
    resolveCase: async () => admissionState.selectedCase,
    resolveInputs: async (references, context) => admissionState.sourceReader
      ? admissionState.sourceReader(references, context) : admissionState.sources,
    revalidateSources: async () => admissionState.sourcesCurrent,
    origin: () => admissionState.origin,
    registry: owner.registry, governance,
    authorizeIntent: async (context, intent) => {
      trace.intents.push(structuredClone(intent))
      return admissionState.intentAuthorized && context === owner.state.context && isDeepStrictEqual(intent, expectedIntent)
    },
  })
  yield* Effect.addFinalizer(() => Effect.sync(() => { admission.dispose(); realGovernance.dispose() }))
  const enter = <A, E, R>(effect: Effect.Effect<A, E, R>, options: {
    invocation?: ToolSafety.Invocation; frame?: CapabilityInvocation.HostInput | null
  } = {}) => {
    const settled = admission.run(options.invocation ?? owner.invocation, effect)
    return options.frame === null ? settled : CapabilityInvocation.withContext(options.frame ?? owner.frame, settled)
  }
  return { ...owner, enter, uiContext, admissionBinding, expectedIntent, admissionState, nativeController,
    fixtureOrigin, publicationHost, realGovernance, governance, trace, admission }
})

export type AdmissionFixture = Effect.Success<ReturnType<typeof build>>

export const withAdmissionFixture = <A, E>(body: (fixture: AdmissionFixture) => Effect.Effect<A, E, Scope.Scope>) =>
  withOwnerFixture((owner) => Effect.gen(function* () {
    const fixture = yield* build(owner)
    return yield* body(fixture)
  }))
