import { Context, Effect, Schema } from "effect"
import { isDeepStrictEqual } from "node:util"
import { AgentV2 } from "@orchestra/core/agent"
import { SessionSchema } from "@orchestra/core/session/schema"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfRoutineNativeOwnerBinding, SfRoutineNativeOwnerPort } from "./routine-native-adapter.ts"
import { withSfRoutineNativeAbort } from "./routine-native-dispatch.ts"
import type { SfRoutineNativeOwnerHook } from "./routine-native-governance.ts"
import { observeSfRoutineNative } from "./routine-native-origin.ts"
import { captureSfRoutineNativeOwner } from "./routine-native-owner.ts"
import { sameSfRoutineNativeOwner } from "./routine-native-input.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"

export type SfRoutineNativeRegistryInput = {
  readonly resources: () => SfRoutineNativeRuntimeResources | undefined
  readonly requestFor: (context: TrustedDomainContext) => Request | undefined
  readonly authorize: (context: TrustedDomainContext) => Promise<boolean>
  readonly generation: () => Promise<number | undefined>
  readonly now?: () => number
}

type RequestScope = {
  readonly registry: object
  readonly request: Request
  readonly context: TrustedDomainContext
  readonly resources: SfRoutineNativeRuntimeResources
  readonly generation: number
  readonly sync: () => boolean
  readonly current: () => Promise<boolean>
  readonly close: () => void
}
type Entry = {
  readonly scope: RequestScope
  readonly binding: SfRoutineNativeOwnerBinding
  readonly current: () => Promise<boolean>
  readonly close: () => void
}

/** Supplied ONLY by a trusted producer that re-verifies durable native origin evidence after reload.
 * Native records/plan.owner/IDs do not issue this attestation and are never accepted as its substitute.
 * It conveys read-only authority; it cannot bind a running Task or authorize model continuation.
 */
export type SfRoutineNativeHistoricalAuthority = Readonly<{
  authoritySessionID: SessionSchema.ID
  signal: AbortSignal
  current: (context: TrustedUiContext, request: Request) => Promise<boolean>
}>

type ReadEntry = {
  readonly context: TrustedUiContext
  readonly request: Request
  readonly binding: SfRoutineNativeOwnerBinding
  readonly generation: number
  readonly current: () => Promise<boolean>
  readonly close: () => void
}

// Effect-local and host-only. It carries the actual authenticated Request, never decoded identifiers.
const CurrentRequest = Context.Reference<RequestScope | undefined>("sucafina/routine-native-request", {
  defaultValue: () => undefined,
})

/**
 * Ephemeral ownership only; native Task/governance records remain the sole durable ledger.
 * withRequest is a private admission boundary, NOT an HTTP endpoint or a session-ID resolver.
 * The current host has no Request-to-Maestro admission producer: installing this hook alone
 * leaves owners unavailable. Never use a retained plan or a resident sf_maestro as that producer.
 */
export function createSfRoutineNativeOwnerRegistry(input: SfRoutineNativeRegistryInput) {
  const identity = Object.freeze({})
  const scopes = new Set<RequestScope>()
  // These are cancellable acquisitions in this same registry, never issued ownership capabilities.
  const acquiring = new Set<{ request: Request; close: () => void }>()
  const entries = new Map<string, Entry>()
  const readEntries = new Map<Request, ReadEntry>()
  const acquiringReads = new Map<Request, () => void>()
  const issued = new Set<string>()
  const invalidGenerations = new Set<number>()
  const now = input.now ?? Date.now
  let disposed = false

  const withRequest = <A, E, R>(
    context: TrustedDomainContext, request: Request, effect: Effect.Effect<A, E, R>,
  ): Effect.Effect<A, E | ToolSafety.Denied, R> => Effect.gen(function* () {
    if (disposed || (yield* CurrentRequest) || !context || !request || input.requestFor(context) !== request ||
      request.signal.aborted) return yield* denied()
    const expires = Date.parse(context.binding.expiresAt)
    const acquiredAt = now()
    if (!Number.isFinite(expires) || expires <= acquiredAt) return yield* denied()
    const binding = context.binding
    const lease = context.lease
    const kind = context.kind
    const bindingDigest = digestSfValue(binding)
    const headersDigest = digestSfValue([...request.headers])
    const lifetime = Math.min(expires - acquiredAt, 300_000)
    const deadline = acquiredAt + lifetime
    const monotonicDeadline = performance.now() + lifetime
    const cancellation = new AbortController()
    let expiryTimer: ReturnType<typeof setTimeout> | undefined
    let releaseScope: (() => void) | undefined
    let active = true
    const close = () => {
      if (!active) return
      active = false
      acquiring.delete(acquisition)
      if (expiryTimer !== undefined) clearTimeout(expiryTimer)
      request.signal.removeEventListener("abort", close)
      releaseScope?.()
      // Interrupt only this privately scoped operation, never another session owner selected by ID.
      cancellation.abort()
    }
    const acquisition = { request, close }
    return yield* Effect.acquireUseRelease(Effect.sync(() => {
      // revoke/dispose/expiry must reach generation/authority awaits before a full scope can exist.
      acquiring.add(acquisition)
      expiryTimer = setTimeout(close, lifetime)
      request.signal.addEventListener("abort", close, { once: true })
      if (request.signal.aborted || disposed) close()
    }), () => withSfRoutineNativeAbort(Effect.gen(function* () {
      const resources = input.resources()
      const generation = yield* Effect.tryPromise({ try: input.generation, catch: () => denied() })
      if (!active || disposed || !resources?.current() || generation === undefined ||
        !Number.isSafeInteger(generation) || generation < 0 || invalidGenerations.has(generation)) return yield* denied()
      const resourcesDigest = digestSfValue(resources.identity)
      const sync = () => active && !disposed && scopes.has(scope) && input.resources() === resources &&
        resources.current() && input.requestFor(context) === request && !request.signal.aborted &&
        !invalidGenerations.has(generation) && now() < deadline && performance.now() < monotonicDeadline &&
        context.kind === kind && context.binding === binding && context.lease === lease &&
        digestSfValue(context.binding) === bindingDigest && digestSfValue(resources.identity) === resourcesDigest &&
        digestSfValue([...request.headers]) === headersDigest &&
        binding.installationId === resources.identity.installationId && binding.projectId === resources.identity.projectId &&
        (context.kind !== "native" || (context.binding.hostId === resources.identity.hostId &&
          context.binding.locationId === digestSfValue(resources.identity.location) &&
          context.binding.providerGeneration === generation))
      const current = async () => {
        const authorized = sync() && await input.authorize(context).catch(() => false)
        const actualGeneration = authorized && sync() ? await input.generation().catch(() => undefined) : undefined
        if (authorized && actualGeneration === generation && sync()) return true
        close()
        return false
      }
      const scope: RequestScope = { registry: identity, request, context, resources, generation, sync, current, close }
      releaseScope = () => {
        scopes.delete(scope)
        for (const entry of [...entries.values()]) if (entry.scope === scope) entry.close()
      }
      scopes.add(scope)
      acquiring.delete(acquisition)
      if (!(yield* checked(current))) return yield* denied()
      const result = yield* Effect.provideService(effect, CurrentRequest, scope)
      if (!(yield* checked(current))) return yield* denied()
      return result
    }), cancellation.signal), () => Effect.sync(close))
  })

  const run: SfRoutineNativeOwnerHook["run"] = (invocation, effect) => Effect.gen(function* () {
    if (invocation.tool !== "task") return yield* effect
    const scope = yield* CurrentRequest
    // Unrelated native calls keep their existing policy. SF plans without an authority lease
    // are still refused by the original governance guard inside this hook.
    if (!scope) return yield* effect
    if (scope.registry !== identity || !(yield* checked(scope.current))) return yield* denied()
    const witness = yield* captureSfRoutineNativeOwner(scope.resources, invocation)
      .pipe(Effect.mapError(() => denied()))
    const expected = {
      installationId: scope.resources.identity.installationId, hostId: scope.resources.identity.hostId,
      projectId: scope.resources.identity.projectId, locationId: digestSfValue(scope.resources.identity.location),
      authoritySessionId: witness.authoritySessionID, principalRef: scope.context.binding.principalRef,
      policyVersion: scope.context.binding.policyVersion, accessRevision: scope.context.binding.accessRevision,
      providerGeneration: scope.generation,
    }
    if (!sameSfRoutineNativeOwner(witness.retained.owner, expected) ||
      (scope.context.kind === "native" && (scope.context.binding.nativeSessionId !== witness.authoritySessionID ||
        scope.context.binding.caseId !== witness.retained.input.caseRef.id ||
        scope.context.binding.caseIncarnation !== witness.retained.input.caseRef.incarnation ||
        scope.context.binding.caseVersion !== witness.retained.input.caseRef.version)) ||
      !(yield* checked(scope.current))) return yield* denied()
    const key = JSON.stringify([expected.installationId, expected.hostId, expected.projectId, expected.locationId,
      witness.authoritySessionID, witness.task.assistantMessageID, witness.task.toolCallID])
    // This process-local replay fence contains identities only; it is never an admission/run store.
    if (issued.has(key) || [...entries.values()].some((entry) => entry.scope.request === scope.request))
      return yield* denied()
    const binding: SfRoutineNativeOwnerBinding = Object.freeze({
      request: scope.request, authoritySessionID: witness.authoritySessionID,
      task: Object.freeze({ ...witness.task }),
    })
    let active = true
    const close = () => {
      if (!active) return
      active = false
      if (entries.get(key) === entry) entries.delete(key)
    }
    const current = async () => {
      const valid = active && entries.get(key) === entry && await scope.current() &&
        await witness.current().catch(() => false) && await scope.current()
      if (valid && active && entries.get(key) === entry && scope.sync()) return true
      close()
      scope.close()
      return false
    }
    const entry: Entry = { scope, binding, current, close }
    return yield* Effect.acquireUseRelease(Effect.sync(() => {
      if (!scope.sync() || issued.has(key) || [...entries.values()].some((value) => value.scope.request === scope.request))
        return false
      entries.set(key, entry)
      issued.add(key)
      return true
    }), (admitted) => Effect.gen(function* () {
      if (!admitted) return yield* denied()
      if (!(yield* checked(current))) return yield* denied()
      // Ownership is not a plan grant. Preserve the adapter/admission's stronger case/source/publication
      // lease; the original governance guard still refuses an SF plan without that independently admitted lease.
      // Exactly one original settlement. No reentrant adapter dispatch and no retained frame after this effect.
      const result = yield* effect
      if (!(yield* checked(current))) return yield* denied()
      return result
    }), () => Effect.sync(close))
  })

  /**
   * Fresh UI Request -> read-only native historical projection. Unlike withRequest, this does not
   * acquire Task owner authority or revive an already settled CapabilityInvocation frame. The host
   * must first resolve durable principal/native-origin evidence through an independent canonical
   * producer and supply its live attestation; the current host does not yet expose that producer.
   *
   * The existing adapter's readAdmission/readRun/readExecution/readArtifact execute within consume,
   * rechecking case/source/publication through their canonical readers. prepare/start cannot run:
   * historical owner has no Task invocation. No new run database, Task dispatch, or synthetic grant.
   */
  const withReauthenticatedRead = async <A>(
    context: TrustedUiContext, request: Request, evidence: SfRoutineNativeHistoricalAuthority,
    consume: () => Promise<A>,
  ): Promise<A | undefined> => {
    if (disposed || context?.kind !== "ui" || request.signal.aborted || evidence.signal.aborted ||
      input.requestFor(context) !== request || !Schema.is(SessionSchema.ID)(evidence.authoritySessionID) ||
      readEntries.has(request) || acquiringReads.has(request) || readEntries.size + acquiringReads.size >= 100)
      return undefined
    const resources = input.resources()
    const beganAt = now()
    const expires = Date.parse(context.binding.expiresAt)
    if (!resources?.current() || !Number.isFinite(expires) || expires <= beganAt) return undefined
    const until = Math.min(expires, beganAt + 300_000)
    const monotonicUntil = performance.now() + until - beganAt
    const contextDigest = digestSfValue(context.binding)
    const identityDigest = digestSfValue(resources.identity)
    const headersDigest = digestSfValue([...request.headers])
    const cancellation = new AbortController()
    const signal = AbortSignal.any([request.signal, evidence.signal, cancellation.signal])
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let entry: ReadEntry | undefined
    const close = () => {
      if (!active) return
      active = false
      acquiringReads.delete(request)
      if (readEntries.get(request) === entry) readEntries.delete(request)
      if (timer !== undefined) clearTimeout(timer)
      request.signal.removeEventListener("abort", close)
      evidence.signal.removeEventListener("abort", close)
      cancellation.abort()
    }
    const sync = () => active && !disposed && input.resources() === resources && resources.current() &&
      input.requestFor(context) === request && !signal.aborted && now() < until && performance.now() < monotonicUntil &&
      context.kind === "ui" && digestSfValue(context.binding) === contextDigest &&
      digestSfValue(resources.identity) === identityDigest && digestSfValue([...request.headers]) === headersDigest &&
      context.binding.installationId === resources.identity.installationId &&
      context.binding.projectId === resources.identity.projectId

    acquiringReads.set(request, close)
    try {
      const generation = await observeSfRoutineNative(input.generation, signal)
      if (!sync() || generation === undefined || !Number.isSafeInteger(generation) ||
        generation < 0 || invalidGenerations.has(generation) || !await observeSfRoutineNative(() => input.authorize(context), signal) ||
        !await observeSfRoutineNative(() => evidence.current(context, request), signal) || !sync()) return undefined
      const sessionCurrent = async () => {
        const session = await observeSfRoutineNative(() => Effect.runPromise(resources.store.get(evidence.authoritySessionID)), signal)
        return !!session && !session.time.archived && session.projectID === resources.identity.projectId &&
          (session.agent === undefined || session.agent === AgentV2.defaultID) &&
          isDeepStrictEqual(session.location, resources.identity.location)
      }
      if (!await sessionCurrent() || !sync()) return undefined
      const current = async () => {
        if (!sync() || invalidGenerations.has(generation) || await observeSfRoutineNative(input.generation, signal) !== generation ||
          !await sessionCurrent() || !await observeSfRoutineNative(() => input.authorize(context), signal) ||
          !await observeSfRoutineNative(() => evidence.current(context, request), signal) || !sync()) {
          close()
          return false
        }
        return true
      }
      const binding = Object.freeze({ request, authoritySessionID: evidence.authoritySessionID } satisfies SfRoutineNativeOwnerBinding)
      entry = { context, request, binding, generation, current, close }
      if (readEntries.has(request) || !sync()) return undefined
      readEntries.set(request, entry)
      acquiringReads.delete(request)
      timer = setTimeout(close, Math.max(0, until - now()))
      request.signal.addEventListener("abort", close, { once: true })
      evidence.signal.addEventListener("abort", close, { once: true })
      if (!await current()) return undefined
      const result = await observeSfRoutineNative(consume, signal, 30_000)
      return await current() ? result : undefined
    } finally {
      close()
    }
  }

  const owners: SfRoutineNativeOwnerPort & { available: () => boolean } = Object.freeze({
    available: () => !disposed && ([...entries.values()].some((entry) => entry.scope.sync()) ||
      [...readEntries.values()].some((entry) => !entry.request.signal.aborted)),
    resolve: async (context, request) => {
      const found = [...entries.values()].filter((entry) => entry.scope.context === context && entry.scope.request === request)
      const historical = readEntries.get(request)
      if (found.length > 1 || (found.length && historical)) return undefined
      if (found.length === 1) {
        const entry = found[0]!
        return await entry.current() && entriesHas(entry) ? entry.binding : undefined
      }
      return historical?.context === context && await historical.current() && readEntries.get(request) === historical
        ? historical.binding : undefined
    },
  })
  const entriesHas = (entry: Entry) => [...entries.values()].includes(entry) && entry.scope.sync()

  return {
    owners, withRequest, withReauthenticatedRead, run,
    revoke: (request: Request) => {
      for (const acquisition of [...acquiring]) if (acquisition.request === request) acquisition.close()
      for (const scope of [...scopes]) if (scope.request === request) scope.close()
      readEntries.get(request)?.close()
      acquiringReads.get(request)?.()
    },
    invalidateGeneration: (generation: number) => {
      invalidGenerations.add(generation)
      // An acquisition has not established its generation yet; none may span a rotation.
      for (const acquisition of [...acquiring]) acquisition.close()
      for (const close of [...acquiringReads.values()]) close()
      for (const scope of [...scopes]) if (scope.generation === generation) scope.close()
      for (const entry of [...readEntries.values()]) if (entry.generation === generation) entry.close()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const acquisition of [...acquiring]) acquisition.close()
      for (const close of [...acquiringReads.values()]) close()
      for (const scope of [...scopes]) scope.close()
      for (const entry of [...entries.values()]) entry.close()
      for (const entry of [...readEntries.values()]) entry.close()
    },
  }
}

function denied() {
  return new ToolSafety.Denied({ reason: "SF_ROUTINE_NATIVE_OWNER_UNAVAILABLE" })
}

function checked(current: () => Promise<boolean>) {
  return Effect.tryPromise({ try: current, catch: () => denied() })
}

