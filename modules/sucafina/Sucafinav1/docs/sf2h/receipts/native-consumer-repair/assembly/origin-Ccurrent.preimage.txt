import { isDeepStrictEqual } from "node:util"
import { Effect, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { SessionSchema } from "@orchestra/core/session/schema"
import { TaskTool } from "@orchestra/core/tool/task"
import type { ToolSafety } from "@orchestra/core/tool-safety"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfRoutineNativeAdmissionBinding, SfRoutineNativeAdmissionIntent, SfRoutineNativeAdmissionOrigin } from "./routine-native-admission.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"

/** Host-private evidence from the ORIGINAL authenticated Request and independently admitted native Maestro owner.
 * Neither this object nor its IDs may be decoded from an HTTP/model input. nativePolicy must revalidate
 * native C15, its children and any pending Permission; it cannot be a synthetic or inferred grant.
 */
export type SfRoutineNativeOriginalAdmission = Readonly<{
  request: Request
  context: TrustedUiContext
  authoritySessionID: SessionSchema.ID
  intent: SfRoutineNativeAdmissionIntent
  signal: AbortSignal
  current: () => Promise<boolean>
  nativePolicy: Readonly<{ signal: AbortSignal; current: () => Promise<boolean> }>
}>

export type SfRoutineNativeOriginInput = {
  /** Actual installed native policy/human-continuation capability, not the mere presence of services. */
  ready: () => boolean
  resources: () => SfRoutineNativeRuntimeResources | undefined
  requestFor: (context: TrustedUiContext) => Request | undefined
  authorize: (context: TrustedUiContext) => Promise<boolean>
  authorizeIntent: (context: TrustedUiContext, intent: SfRoutineNativeAdmissionIntent) => Promise<boolean>
  generation: () => Promise<number | undefined>
  now?: () => number
}

type Entry = {
  readonly request: Request
  readonly generation: number
  readonly binding: SfRoutineNativeAdmissionBinding
  readonly current: () => Promise<boolean>
  readonly close: () => void
}

/**
 * Bounded, process-local original-Request association for the EXISTING 64 hook. No Task owner,
 * grant, Session, execution, settlement or durable run is created; registry41 remains their only
 * ephemeral Task owner. Native Session IDs only locate an already-verified authenticated admission.
 * The default host has no C15-native owner capable of calling admit, and must retain readiness OFF.
 */
export function createSfRoutineNativeOrigin(input: SfRoutineNativeOriginInput) {
  const entries = new Map<SessionSchema.ID, Entry>()
  const acquiring = new Map<SessionSchema.ID, { request: Request; close: () => void }>()
  const now = input.now ?? Date.now
  let disposed = false
  const ready = () => !disposed && input.ready() && !!input.resources()?.current()

  const admit = async (source: SfRoutineNativeOriginalAdmission): Promise<(() => void) | undefined> => {
    if (!ready() || source.context?.kind !== "ui" || source.request?.method !== "POST" ||
      !Schema.is(SessionSchema.ID)(source.authoritySessionID) || source.request.signal.aborted ||
      source.signal.aborted || source.nativePolicy.signal.aborted || input.requestFor(source.context) !== source.request ||
      !validIntent(source.intent) || entries.has(source.authoritySessionID) || acquiring.has(source.authoritySessionID) ||
      entries.size + acquiring.size >= 100)
      return undefined
    const started = now()
    const expires = Date.parse(source.context.binding.expiresAt)
    const resources = input.resources()
    if (!resources?.current() || !Number.isFinite(expires) || expires <= started) return undefined
    const abort = new AbortController()
    const signal = AbortSignal.any([source.request.signal, source.signal, source.nativePolicy.signal, abort.signal])
    const until = Math.min(expires, started + 300_000)
    const monotonicUntil = performance.now() + until - started
    const identityDigest = digestSfValue(resources.identity)
    const contextDigest = digestSfValue(source.context.binding)
    const headersDigest = digestSfValue([...source.request.headers])
    const intent = Object.freeze({ planRevisionId: source.intent.planRevisionId,
      authorizationId: source.intent.authorizationId, inputDigest: source.intent.inputDigest,
      caseRef: Object.freeze({ ...source.intent.caseRef }) })
    let active = true
    let timer: ReturnType<typeof setTimeout> | undefined
    let registered: Entry | undefined
    let accepted = false
    const close = () => {
      if (!active) return
      active = false
      acquiring.delete(source.authoritySessionID)
      if (registered && entries.get(source.authoritySessionID) === registered) entries.delete(source.authoritySessionID)
      if (timer !== undefined) clearTimeout(timer)
      source.request.signal.removeEventListener("abort", close)
      source.signal.removeEventListener("abort", close)
      source.nativePolicy.signal.removeEventListener("abort", close)
      abort.abort()
    }
    acquiring.set(source.authoritySessionID, { request: source.request, close })
    const sync = () => active && ready() && input.resources() === resources && resources.current() &&
      input.requestFor(source.context) === source.request && source.context.kind === "ui" &&
      source.request.method === "POST" && !signal.aborted && now() < until && performance.now() < monotonicUntil &&
      digestSfValue(resources.identity) === identityDigest && digestSfValue(source.context.binding) === contextDigest &&
      digestSfValue([...source.request.headers]) === headersDigest &&
      source.context.binding.installationId === resources.identity.installationId &&
      source.context.binding.projectId === resources.identity.projectId && isDeepStrictEqual(source.intent, intent)

    try {
      if (!sync() || !await observeSfRoutineNative(() => input.authorize(source.context), signal) ||
        !await observeSfRoutineNative(() => input.authorizeIntent(source.context, intent), signal) ||
        !await observeSfRoutineNative(source.current, signal) || !await observeSfRoutineNative(source.nativePolicy.current, signal) || !sync())
        return undefined
      const generation = await observeSfRoutineNative(input.generation, signal)
      if (generation === undefined || !Number.isSafeInteger(generation) || generation < 0 || !sync()) return undefined
      const parent = await observeSfRoutineNative(() => Effect.runPromise(resources.store.get(source.authoritySessionID)), signal)
      // Real Session placement is necessary, not sufficient; the C15 proof is supplied by its native owner.
      if (!parent || parent.time.archived || parent.projectID !== resources.identity.projectId ||
        (parent.agent !== undefined && parent.agent !== AgentV2.defaultID) ||
        !isDeepStrictEqual(parent.location, resources.identity.location) || !sync()) return undefined
      const current = async () => {
        if (!sync() || await observeSfRoutineNative(input.generation, signal) !== generation ||
          !await observeSfRoutineNative(source.nativePolicy.current, signal) || !await observeSfRoutineNative(source.current, signal) ||
          !await observeSfRoutineNative(() => input.authorize(source.context), signal) ||
          !await observeSfRoutineNative(() => input.authorizeIntent(source.context, intent), signal) ||
          !sync() || await observeSfRoutineNative(input.generation, signal) !== generation) {
          close()
          return false
        }
        return true
      }
      const binding = Object.freeze({ request: source.request, context: source.context,
        authoritySessionID: source.authoritySessionID, intent, signal, current } satisfies SfRoutineNativeAdmissionBinding)
      const entry: Entry = { request: source.request, generation, binding, current, close }
      if (!sync() || acquiring.size > 100 || entries.has(source.authoritySessionID)) return undefined
      registered = entry
      entries.set(source.authoritySessionID, entry)
      acquiring.delete(source.authoritySessionID)
      timer = setTimeout(close, Math.max(0, until - now()))
      source.request.signal.addEventListener("abort", close, { once: true })
      source.signal.addEventListener("abort", close, { once: true })
      source.nativePolicy.signal.addEventListener("abort", close, { once: true })
      if (!sync() || !await current()) return undefined
      accepted = true
      return close
    } catch {
      return undefined
    } finally {
      if (!accepted) close()
    }
  }

  const origin: SfRoutineNativeAdmissionOrigin = Object.freeze({
    ready,
    resolve: async (invocation: ToolSafety.Invocation) => {
      if (!ready() || invocation.tool !== TaskTool.name || invocation.agent !== AgentV2.defaultID ||
        !Schema.is(SessionSchema.ID)(invocation.sessionID)) return undefined
      const entry = entries.get(invocation.sessionID)
      if (!entry || !matches(invocation, entry.binding.intent) ||
        !await observeSfRoutineNative(entry.current, entry.binding.signal) || entries.get(invocation.sessionID) !== entry)
        return undefined
      return entry.binding
    },
  })
  return {
    origin, admit,
    revoke: (request: Request) => {
      for (const pending of [...acquiring.values()]) if (pending.request === request) pending.close()
      for (const entry of [...entries.values()]) if (entry.request === request) entry.close()
    },
    invalidateGeneration: (generation: number) => {
      // Pending admission has not yet observed a generation: invalidate every pending candidate.
      for (const pending of [...acquiring.values()]) pending.close()
      for (const entry of [...entries.values()]) if (entry.generation === generation) entry.close()
    },
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const pending of [...acquiring.values()]) pending.close()
      for (const entry of [...entries.values()]) entry.close()
    },
  }
}

function validIntent(intent: SfRoutineNativeAdmissionIntent) {
  return !!intent && typeof intent.planRevisionId === "string" && !!intent.planRevisionId.trim() &&
    typeof intent.authorizationId === "string" && !!intent.authorizationId.trim() &&
    /^[a-f0-9]{64}$/.test(intent.inputDigest) && typeof intent.caseRef?.id === "string" &&
    !!intent.caseRef.id.trim() && typeof intent.caseRef.incarnation === "string" &&
    !!intent.caseRef.incarnation.trim() && Number.isSafeInteger(intent.caseRef.version) && intent.caseRef.version > 0
}

function matches(invocation: ToolSafety.Invocation, intent: SfRoutineNativeAdmissionIntent) {
  const args = invocation.args
  if (!args || typeof args !== "object") return false
  const workflow = "workflow" in args ? args.workflow : undefined
  return !!workflow && typeof workflow === "object" && "planRevisionID" in workflow &&
    workflow.planRevisionID === intent.planRevisionId && "authorizationID" in args &&
    args.authorizationID === intent.authorizationId
}

/** A misbehaving native/C15 reader cannot hold a provider settlement indefinitely. */
async function bounded<T>(read: () => Promise<T>, signal: AbortSignal): Promise<T | undefined> {
  if (signal.aborted) return undefined
  let timer: ReturnType<typeof setTimeout> | undefined
  let onAbort: () => void = () => {}
  const cancelled = new Promise<undefined>((resolve) => {
    onAbort = () => resolve(undefined)
    signal.addEventListener("abort", onAbort, { once: true })
    timer = setTimeout(() => resolve(undefined), timeoutMs)
    if (signal.aborted) onAbort()
  })
  try { return await Promise.race([Promise.resolve().then(read).catch(() => undefined), cancelled]) }
  finally {
    if (timer !== undefined) clearTimeout(timer)
    signal.removeEventListener("abort", onAbort)
  }
}
