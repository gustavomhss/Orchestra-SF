import { randomUUID } from "node:crypto"
import { Effect, Schema } from "effect"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { Location } from "@orchestra/core/location"
import type { ModelV2 } from "@orchestra/core/model"
import type { SessionScope } from "@orchestra/core/session/scope"
import type { Persistence } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { SfTokenCountReceipt } from "./token-count.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfMaestroHostInput, SfNativeHostApi } from "./native-host.ts"

type CaseRef = Readonly<{ id: string; incarnation: string; version: number }>
type RunIntent = Readonly<{
  planRevisionId: string
  authorizationId: string
  inputDigest: string
  caseRef: CaseRef
}>
type Authority = Pick<ReturnType<typeof createSfProductAuthority>,
  "human" | "host" | "authority" | "state" | "nativeEvidenceWrites">

/** Exactly the structural input consumed by mission90. This is issued here, not injected here.
 * The native policy is a live token gate; source IDs are consistency checks, never proof.
 */
export type SfNativeMaestroOrigin = Readonly<{
  request: Request
  context: TrustedUiContext
  authoritySessionID: SessionSchema.ID
  intent: RunIntent
  signal: AbortSignal
  current: () => Promise<boolean>
  nativePolicy: Readonly<{ signal: AbortSignal; current: () => Promise<boolean> }>
}>

export type SfNativeMaestroHistory = Readonly<{
  authoritySessionID: SessionSchema.ID
  signal: AbortSignal
  current: (context: TrustedUiContext, request: Request) => Promise<boolean>
}>

type OriginListener = (value: SfNativeMaestroOrigin) => Promise<(() => void) | undefined>
type Marker = Readonly<{
  schema: "sf-native-maestro-origin-v1"
  sessionID: SessionSchema.ID
  projectId: string
  installationId: string
  principalRef: string
  accessRevision: string
  policyVersion: string
  admissionRequestId: string
  originDigest: string
  caseRef: CaseRef
  model: ModelV2.Ref
  scopeDigest: string
  generation: number
  createdAt: string
  tokenReceipts: ReadonlyArray<{ attemptId: string; generation: number; receipt: SfTokenCountReceipt }>
}>
type HostIdentity = Readonly<{ installationId: string; hostId: string; projectId: string; location: Location.Ref }>

/**
 * The only SF-native authority producer. It mints a native Maestro Session from an ORIGINAL
 * human-authenticated routines.admit Request, writes a C09 principal/case origin before creation,
 * and later readmits that same durable Session under a DIFFERENT routines.run human Request.
 *
 * It does not accept a caller-provided SfNativeMaestroOrigin, Task witness or provider grant.
 * The genuine core Task/Relay and approval checks remain owned by 64/41; no synthetic replay
 * or Permission.reply occurs here.
 */
export function createSfNativeAuthorityProducer(input: {
  authority: Authority
  identity: () => HostIdentity | undefined
  nativeHost: () => SfNativeHostApi | undefined
  persistence: Persistence
  generation: () => Promise<number | undefined>
  /** Chosen by the installed native Catalog/host, NEVER by the submitted HTTP payload. */
  model: () => Promise<ModelV2.Ref | undefined>
  /** Root-owned policy only: no model-supplied tools, grants, or token limits. */
  policy: Readonly<{
    tools: readonly string[]
    contextBudgetTokens: number
    toolCallBudget: number
  }>
  /** Actual Task/governance/Location/policy installation; absent/default false leaves readiness OFF. */
  enabled: () => boolean
}) {
  const listeners = new Set<OriginListener>()
  const active = new Map<SessionSchema.ID, { request: Request; close: () => void }>()
  const acquiring = new WeakSet<Request>()
  let disposed = false
  const reservedPrefix = "sf:native-maestro:"
  const scope: SessionScope.Scope = Object.freeze({
    skills: Object.freeze({ entry: "sf-native-maestro-c15-provenance-v1", allow: [] }),
    tools: [...input.policy.tools],
    budgets: Object.freeze({ loads: 0, toolCalls: input.policy.toolCallBudget }),
  })
  // This SessionScope entry is a PROVENANCE marker, not a loaded resident Skill receipt.
  // Native Maestro is a different agent from sf_maestro. A real skill requires its own load proof.
  const permissions: SfMaestroHostInput["permissions"] = [
    { permission: "external_directory", pattern: "*", action: "deny" },
    { permission: "bash", pattern: "*", action: "deny" },
    { permission: "write", pattern: "*", action: "deny" },
    { permission: "edit", pattern: "*", action: "deny" },
    { permission: "mcp_*", pattern: "*", action: "deny" },
    { permission: "sf_*", pattern: "*", action: "deny" },
  ]
  const keyOf = (id: SessionSchema.ID) => reservedPrefix + id
  const parentReady = () => !disposed && !!input.identity() && !!input.nativeHost() &&
    Number.isSafeInteger(input.policy.contextBudgetTokens) && input.policy.contextBudgetTokens > 0 &&
    input.policy.contextBudgetTokens <= 24_000 && Number.isSafeInteger(input.policy.toolCallBudget) &&
    input.policy.toolCallBudget > 0 && input.policy.toolCallBudget <= 12 &&
    input.policy.tools.length > 0 && input.policy.tools.length <= 12 &&
    new Set(input.policy.tools).size === input.policy.tools.length &&
    input.policy.tools.every((tool) => !!tool.trim() && !tool.startsWith("sf_") && !tool.startsWith("mcp_"))
  const ready = () => parentReady() && input.enabled()

  const sameCase = (value: CaseRef, other: CaseRef) =>
    value.id === other.id && value.incarnation === other.incarnation && value.version === other.version
  const validCase = (ref: CaseRef) => !!ref && !!ref.id?.trim() && !!ref.incarnation?.trim() &&
    Number.isSafeInteger(ref.version) && ref.version > 0
  const validIntent = (intent: RunIntent) => !!intent && !!intent.planRevisionId?.trim() &&
    !!intent.authorizationId?.trim() && /^[a-f0-9]{64}$/.test(intent.inputDigest) && validCase(intent.caseRef)
  const admission = async (context: TrustedUiContext, request: Request, action: "routines.admit" | "routines.run",
    value: unknown): Promise<boolean> => {
    if (!parentReady() || (action === "routines.run" && !ready()) || context.kind !== "ui" || request.method !== "POST" || request.signal.aborted ||
      input.authority.host.requestFor(context) !== request || !input.identity() ||
      context.binding.installationId !== input.identity()?.installationId ||
      context.binding.projectId !== input.identity()?.projectId || Date.now() >= Date.parse(context.binding.expiresAt))
      return false
    if (!await input.authority.authority.revalidateDomainContext(context).catch(() => false) ||
      !await input.authority.human.authorize(context, action, value).catch(() => false)) return false
    return parentReady() && (action !== "routines.run" || ready()) && input.authority.host.requestFor(context) === request && !request.signal.aborted &&
      await input.authority.human.authorize(context, action, value).catch(() => false)
  }
  const currentCase = async (request: Request, context: TrustedUiContext, ref: CaseRef) => {
    if (!validCase(ref) || request.signal.aborted) return false
    const result = await input.authority.state.read(request, "cases", (state, actor) => {
      const row = state.cases[ref.id]
      return !!row && row.id === ref.id && row.incarnation === ref.incarnation &&
        row.version === ref.version && row.participants.includes(actor.principalRef) &&
        actor.principalRef === context.binding.principalRef &&
        actor.accessRevision === context.binding.accessRevision &&
        actor.policyVersion === context.binding.policyVersion
    }).catch(() => undefined)
    return result?.status === "ok" && result.value === true
  }
  const markerCurrent = async (request: Request, context: TrustedUiContext, sessionID: SessionSchema.ID,
    ref?: CaseRef): Promise<Marker | undefined> => {
    if (!input.identity() || request.signal.aborted || input.authority.host.requestFor(context) !== request ||
      !await input.authority.authority.revalidateDomainContext(context).catch(() => false)) return undefined
    const result = await input.authority.state.read(request, "preferences", (state, actor) => {
      const raw = object(state.preferences[keyOf(sessionID)])
      const caseRef = object(raw.caseRef)
      const model = object(raw.model)
      if (raw.schema !== "sf-native-maestro-origin-v1" || raw.sessionID !== sessionID ||
        raw.projectId !== input.identity()?.projectId || raw.installationId !== input.identity()?.installationId ||
        raw.principalRef !== actor.principalRef || raw.principalRef !== context.binding.principalRef ||
        raw.accessRevision !== actor.accessRevision || raw.accessRevision !== context.binding.accessRevision ||
        raw.policyVersion !== actor.policyVersion || raw.policyVersion !== context.binding.policyVersion ||
        raw.scopeDigest !== digestSfValue(scope) || typeof raw.originDigest !== "string" ||
        !/^[a-f0-9]{64}$/.test(raw.originDigest) || typeof raw.admissionRequestId !== "string" ||
        typeof raw.generation !== "number" || !Number.isSafeInteger(raw.generation) ||
        !validCase(caseRef as CaseRef) || ref && !sameCase(caseRef as CaseRef, ref) ||
        typeof model.providerID !== "string" || typeof model.id !== "string" ||
        typeof raw.createdAt !== "string" || !Number.isFinite(Date.parse(raw.createdAt))) return undefined
      const row = state.cases[caseRef.id as string]
      if (!row || row.incarnation !== caseRef.incarnation || row.version !== caseRef.version ||
        !row.participants.includes(actor.principalRef)) return undefined
      return raw as unknown as Marker
    }).catch(() => undefined)
    return result?.status === "ok" ? result.value : undefined
  }
  const reserve = async (request: Request, context: TrustedUiContext, caseRef: CaseRef, model: ModelV2.Ref,
    intent: unknown, generation: number, sessionID: SessionSchema.ID): Promise<boolean> => {
    if (!await admission(context, request, "routines.admit", intent) || !await currentCase(request, context, caseRef)) return false
    const identity = input.identity()
    if (!identity) return false
    const before = await input.authority.state.read(request, "preferences", (_state, actor) => actor).catch(() => undefined)
    if (before?.status !== "ok") return false
    const marker: Marker = Object.freeze({
      schema: "sf-native-maestro-origin-v1", sessionID,
      projectId: identity.projectId, installationId: identity.installationId,
      principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision,
      policyVersion: context.binding.policyVersion, admissionRequestId: context.binding.requestId,
      originDigest: digestSfValue({ admission: intent, caseRef, model, identity: { installationId: identity.installationId, projectId: identity.projectId },
        principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion }),
      caseRef: { ...caseRef }, model: { ...model }, scopeDigest: digestSfValue(scope), generation,
      createdAt: new Date().toISOString(), tokenReceipts: [],
    })
    const work = async (state: SfProductState, actor: SfStateAuthority) => {
      const row = state.cases[caseRef.id]
      if (!row || row.incarnation !== caseRef.incarnation || row.version !== caseRef.version ||
        !row.participants.includes(actor.principalRef) || actor.principalRef !== marker.principalRef ||
        actor.accessRevision !== marker.accessRevision || actor.policyVersion !== marker.policyVersion ||
        Object.hasOwn(state.preferences, keyOf(sessionID))) throw new Error("SF_NATIVE_MAESTRO_RESERVATION_CONFLICT")
      state.preferences[keyOf(sessionID)] = marker
      return { commit: true, value: true }
    }
    input.authority.nativeEvidenceWrites.add(work)
    let saved: { status: string; value?: boolean } | undefined
    try {
      saved = await input.authority.state.transaction(request, {
        namespace: "preferences", expectedStorageVersion: before.storageVersion,
        targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation,
        idempotencyKey: "native-maestro:" + sessionID, commandDigest: digestSfValue(marker),
      }, work)
    } catch { return false }
    finally { input.authority.nativeEvidenceWrites.delete(work) }
    return saved?.status === "ok" && saved.value === true && !request.signal.aborted &&
      !!await markerCurrent(request, context, sessionID, caseRef) &&
      await admission(context, request, "routines.admit", intent)
  }
  const tokensCurrent = async (context: TrustedUiContext, request: Request, sessionID: SessionSchema.ID, ref: CaseRef,
    action: "routines.admit" | "routines.run", payload: unknown, generation: number) =>
    !!await markerCurrent(request, context, sessionID, ref) &&
    await admission(context, request, action, payload) &&
    await input.generation().catch(() => undefined) === generation &&
    !request.signal.aborted
  /** Uses the existing C09 private preference-CAS writer, not a second Task ledger.
   * Persist BEFORE model dispatch. A receipt without a committed origin is not evidence.
   */
  const receiptFor = (request: Request, context: TrustedUiContext, sessionID: SessionSchema.ID, caseRef: CaseRef,
    action: "routines.admit" | "routines.run", payload: unknown, generation: number) =>
    (receipt: SfTokenCountReceipt) => Effect.tryPromise(async () => {
      const valid = receipt.schema === "sf-token-count-v1" &&
        receipt.oracle === "https://api.openai.com/v1/responses/input_tokens" &&
        !!receipt.model && /^[a-f0-9]{64}$/.test(receipt.inputDigest) &&
        /^[a-f0-9]{64}$/.test(receipt.requestDigest) &&
        Number.isSafeInteger(receipt.inputTokens) && receipt.inputTokens >= 0 &&
        Number.isSafeInteger(receipt.maxOutputTokens) && receipt.maxOutputTokens > 0 &&
        receipt.contextBudgetTokens === input.policy.contextBudgetTokens &&
        receipt.inputTokens + receipt.maxOutputTokens <= receipt.contextBudgetTokens
      if (!valid || !await tokensCurrent(context, request, sessionID, caseRef, action, payload, generation))
        throw new Error("SF_NATIVE_MAESTRO_RECEIPT_INVALID")
      const before = await input.authority.state.read(request, "preferences", () => null)
      if (before.status !== "ok") throw new Error("SF_NATIVE_MAESTRO_RECEIPT_STORAGE_UNAVAILABLE")
      const attemptId = randomUUID()
      const work = async (state: SfProductState, actor: SfStateAuthority) => {
        const raw = object(state.preferences[keyOf(sessionID)])
        const row = state.cases[caseRef.id]
        const old = Array.isArray(raw.tokenReceipts) ? raw.tokenReceipts : []
        if (raw.schema !== "sf-native-maestro-origin-v1" || raw.sessionID !== sessionID ||
          raw.principalRef !== actor.principalRef || raw.accessRevision !== actor.accessRevision ||
          raw.policyVersion !== actor.policyVersion || raw.scopeDigest !== digestSfValue(scope) ||
          digestSfValue(raw.caseRef) !== digestSfValue(caseRef) ||
          !row || row.incarnation !== caseRef.incarnation || row.version !== caseRef.version ||
          !row.participants.includes(actor.principalRef) || !Array.isArray(raw.tokenReceipts) ||
          old.length >= 128)
          throw new Error("SF_NATIVE_MAESTRO_RECEIPT_ORIGIN_CHANGED")
        state.preferences[keyOf(sessionID)] = { ...raw,
          tokenReceipts: [...old, { attemptId, generation, receipt }] }
        return { commit: true, value: true }
      }
      input.authority.nativeEvidenceWrites.add(work)
      try {
        const result = await input.authority.state.transaction(request, {
          namespace: "preferences", expectedStorageVersion: before.storageVersion,
          targetRef: encodeCaseRef(caseRef), targetIncarnation: caseRef.incarnation,
          idempotencyKey: "native-maestro-token:" + sessionID + ":" + attemptId,
          commandDigest: digestSfValue({ sessionID, attemptId, generation, receipt }),
        }, work)
        if (result.status !== "ok" || result.value !== true)
          throw new Error("SF_NATIVE_MAESTRO_RECEIPT_NOT_DURABLE")
      } finally { input.authority.nativeEvidenceWrites.delete(work) }
      if (!await tokensCurrent(context, request, sessionID, caseRef, action, payload, generation))
        throw new Error("SF_NATIVE_MAESTRO_RECEIPT_AUTHORITY_CHANGED")
    })
  const admit = async (request: Request, value: Readonly<{ caseRef: CaseRef; objective: string }>): Promise<PortResult<{ sessionID: SessionSchema.ID }>> => {
    if (!parentReady() || acquiring.has(request) || !value?.objective?.trim() || value.objective.length > 30_000 ||
      !validCase(value.caseRef)) return { status: "denied", reason: "native-maestro-start-unavailable" }
    acquiring.add(request)
    let context: TrustedUiContext | undefined
    let created: SessionSchema.ID | undefined
    let native: SfNativeHostApi | undefined
    try {
      const accepted = await input.authority.human.admit(request, "routines.admit", value)
      if (accepted.status !== "ok") return accepted
      context = accepted.value
      if (!await admission(context, request, "routines.admit", value) ||
        !await currentCase(request, context, value.caseRef)) return { status: "denied", reason: "native-maestro-case-unavailable" }
      const host = input.nativeHost()
      native = host
      const identity = input.identity()
      const model = await input.model().catch(() => undefined)
      const generation = await input.generation().catch(() => undefined)
      if (!host || !identity || !model || generation === undefined || !Number.isSafeInteger(generation) ||
        generation < 0) return { status: "unavailable", reason: "native-maestro-model-or-location-unavailable" }
      const pending = new Map<SessionSchema.ID, boolean>()
      const plan: SfMaestroHostInput = {
        request, context, action: "routines.admit", intent: value, location: identity.location, model,
        scope, permissions, expiresAt: context.binding.expiresAt,
        contextBudgetTokens: input.policy.contextBudgetTokens,
        reserve: (sessionID) => Effect.tryPromise(async () => {
          pending.set(sessionID, true)
          return await reserve(request, context!, value.caseRef, model, value, generation, sessionID)
        }),
        revalidate: () => Effect.tryPromise(async () => {
          const ids = [...pending.keys()]
          // Before the durable reservation the initial human admission is the only
          // authority; once an ID exists it MUST carry the C09 origin marker.
          if (ids.length === 0) return admission(context!, request, "routines.admit", value) &&
            await input.generation().catch(() => undefined) === generation
          return ids.length === 1 && await tokensCurrent(context!, request, ids[0]!, value.caseRef,
            "routines.admit", value, generation)
        }),
        persistReceipt: (receipt) => Effect.suspend(() => {
          const ids = [...pending.keys()]
          if (ids.length !== 1) return Effect.fail(new Error("SF_NATIVE_MAESTRO_SESSION_UNAVAILABLE"))
          return receiptFor(request, context!, ids[0]!, value.caseRef, "routines.admit", value, generation)(receipt)
        }),
      }
      const result = await Effect.runPromise(host.admitMaestro(plan), { signal: request.signal }).catch(() => undefined)
      if (result?.status !== "ok") return result ?? { status: "unavailable", reason: "native-maestro-admission-failed" }
      created = result.value.sessionID
      // The authenticated human objective is the first native Maestro message.
      // No approval text or Permission reply is synthesized.
      const started = await Effect.runPromise(host.resumeMaestro(created, value.objective), { signal: request.signal })
        .catch(() => undefined)
      return started?.status === "ok" ? result :
        { status: "unavailable", reason: "native-maestro-first-turn-unavailable" }
    } finally {
      acquiring.delete(request)
      if (created && native) await Effect.runPromise(native.releaseMaestro(created)).catch(() => {})
      if (context) input.authority.human.finish(context)
    }
  }
  const run = async (request: Request, value: Readonly<{
    sessionID: SessionSchema.ID
    intent: RunIntent
    humanText: string
  }>): Promise<PortResult<{ sessionID: SessionSchema.ID }>> => {
    if (!ready() || acquiring.has(request) || !Schema.is(SessionSchema.ID)(value?.sessionID) || !validIntent(value.intent) ||
      !value.humanText?.trim() || value.humanText.length > 100_000 ||
      active.has(value.sessionID)) return { status: "denied", reason: "native-maestro-run-unavailable" }
    acquiring.add(request)
    let context: TrustedUiContext | undefined
    let release: (() => void) | undefined
    try {
      const accepted = await input.authority.human.admit(request, "routines.run", value.intent)
      if (accepted.status !== "ok") return accepted
      context = accepted.value
      const marker = await markerCurrent(request, context, value.sessionID, value.intent.caseRef)
      const host = input.nativeHost()
      const identity = input.identity()
      const generation = await input.generation().catch(() => undefined)
      if (!marker || !identity || !host || generation === undefined || generation !== marker.generation ||
        !await admission(context, request, "routines.run", value.intent))
        return { status: "denied", reason: "native-maestro-durable-origin-or-policy-unavailable" }
      const abort = new AbortController()
      const signal = AbortSignal.any([request.signal, abort.signal])
      const current = async () => !signal.aborted && !disposed &&
        await tokensCurrent(context!, request, value.sessionID, value.intent.caseRef,
          "routines.run", value.intent, generation) &&
        await Effect.runPromise(host.currentMaestro(value.sessionID)).catch(() => false)
      release = () => {
        if (active.get(value.sessionID)?.request !== request) return
        active.delete(value.sessionID)
        abort.abort()
        void Effect.runPromise(host.releaseMaestro(value.sessionID)).catch(() => {})
      }
      const bound = await Effect.runPromise(host.bindMaestro(value.sessionID, {
        request, context, action: "routines.run", intent: value.intent,
        model: marker.model, location: identity.location, scope, permissions,
        contextBudgetTokens: input.policy.contextBudgetTokens, expiresAt: context.binding.expiresAt,
        revalidate: () => Effect.tryPromise(async () =>
          !signal.aborted && await tokensCurrent(context!, request, value.sessionID, value.intent.caseRef,
            "routines.run", value.intent, generation)),
        persistReceipt: receiptFor(request, context, value.sessionID, value.intent.caseRef, "routines.run", value.intent, generation),
      }), { signal: request.signal }).catch(() => undefined)
      if (bound?.status !== "ok") return { status: "denied", reason: "native-maestro-rebind-or-budget-unavailable" }
      active.set(value.sessionID, { request, close: release })
      request.signal.addEventListener("abort", release, { once: true })
      if (!await current() || listeners.size !== 1) return { status: "denied", reason: "native-maestro-original-subscriber-unavailable" }
      const source: SfNativeMaestroOrigin = Object.freeze({
        request, context, authoritySessionID: value.sessionID,
        intent: Object.freeze({ ...value.intent, caseRef: Object.freeze({ ...value.intent.caseRef }) }),
        signal, current,
        nativePolicy: Object.freeze({ signal, current }),
      })
      const accept = [...listeners][0]!
      const undo = await accept(source).catch(() => undefined)
      if (!undo || !await current()) {
        undo?.()
        return { status: "denied", reason: "native-maestro-original-admission-unavailable" }
      }
      const resumed = await Effect.runPromise(host.resumeMaestro(value.sessionID, value.humanText), { signal: request.signal })
        .catch(() => undefined)
      undo()
      return resumed?.status === "ok" && await current()
        ? { status: "ok", value: { sessionID: value.sessionID } }
        : { status: "unavailable", reason: "native-maestro-continuation-unavailable" }
    } finally {
      acquiring.delete(request)
      release?.()
      if (context) input.authority.human.finish(context)
    }
  }

  /** Historical access is a fresh human-authenticated Request and durable C09 principal binding.
   * Multiple candidate parents are ambiguous: never pick by plan.owner or an arbitrary Session ID.
   * Registry90 independently rechecks Session metadata and downstream case/sources/Relay.
   */
  const historical = async (context: TrustedUiContext, request: Request): Promise<SfNativeMaestroHistory | undefined> => {
    if (!parentReady() || context?.kind !== "ui" || input.authority.host.requestFor(context) !== request ||
      !await input.authority.authority.revalidateDomainContext(context).catch(() => false)) return undefined
    const candidates = await input.authority.state.read(request, "preferences", (state, actor) =>
      Object.entries(state.preferences)
        .filter(([key]) => key.startsWith(reservedPrefix))
        .map(([, value]) => object(value))
        .filter((value) => value.schema === "sf-native-maestro-origin-v1" &&
          value.principalRef === actor.principalRef && value.accessRevision === actor.accessRevision &&
          value.policyVersion === actor.policyVersion && typeof value.sessionID === "string")
        .map((value) => value.sessionID as SessionSchema.ID)).catch(() => undefined)
    if (candidates?.status !== "ok" || candidates.value.length !== 1) return undefined
    const id = candidates.value[0]!
    if (!await markerCurrent(request, context, id)) return undefined
    const abort = new AbortController()
    const signal = AbortSignal.any([request.signal, abort.signal])
    const current = async (actualContext: TrustedUiContext, actualRequest: Request) => {
      const ok = !disposed && !signal.aborted && context === actualContext && request === actualRequest &&
        !!await markerCurrent(request, context, id)
      if (!ok) abort.abort()
      return ok
    }
    return Object.freeze({ authoritySessionID: id, signal, current })
  }
  return {
    parentReady, ready, admit, run, historical,
    subscribe: (listener: OriginListener) => {
      if (disposed || listeners.size) return () => {}
      listeners.add(listener)
      return () => { listeners.delete(listener); for (const state of [...active.values()]) state.close() }
    },
    /** Durable marker is a deny-only classifier for cold-start C15 lineage; not an authorization. */
    isDurablyOwned: async (sessionID: SessionSchema.ID): Promise<boolean> => input.persistence.transaction("dashboard", async (snapshot) => {
      const raw = snapshot.data.__sfProductV1
      const value = object(raw)
      if (raw === undefined) return { commit: false, value: false }
      const preferences = object(value.preferences)
      if (value.schemaVersion !== 1 || !Number.isSafeInteger(value.revision)) throw new Error("SF_NATIVE_MAESTRO_OWNER_STORAGE_INVALID")
      return { commit: false, value: Object.hasOwn(preferences, keyOf(sessionID)) }
    }),
    dispose: () => {
      if (disposed) return
      disposed = true
      for (const state of [...active.values()]) state.close()
      listeners.clear()
    },
  }
}


/** A surgical adapter on the EXISTING workbench product HTTP hook. No listener, transport,
 * credential, endpoint privilege, permission reply or new installation is introduced.
 */
export function createSfNativeMaestroHttp(input: {
  origin: string
  mount: string
  producer: () => ReturnType<typeof createSfNativeAuthorityProducer> | undefined
}) {
  const record = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value)
  const closed = (value: Record<string, unknown>, keys: readonly string[]) =>
    Object.keys(value).every((key) => keys.includes(key))
  const bounded = async (request: Request, max: number) => {
    if (!request.body) return undefined
    const reader = request.body.getReader()
    const chunks: Uint8Array[] = []
    let size = 0
    try {
      while (true) {
        if (request.signal.aborted) return undefined
        const part = await reader.read()
        if (part.done) break
        size += part.value.byteLength
        if (size > max) { await reader.cancel("sf-native-maestro-body-too-large").catch(() => {}); return undefined }
        chunks.push(part.value)
      }
      const bytes = new Uint8Array(size)
      let offset = 0
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
      return bytes
    } catch { return undefined }
    finally { reader.releaseLock() }
  }
  const reply = (result: unknown, status: number) => new Response(JSON.stringify(result), {
    status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" },
  })
  const resultReply = (value: PortResult<unknown>) => reply(value,
    value.status === "ok" ? 200 : value.status === "denied" ? 403 :
      value.status === "unavailable" ? 503 : value.status === "conflict" ? 409 : 400)
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.searchParams.get("sf") !== "workbench-native-maestro") return undefined
    if (url.origin !== input.origin || request.method !== "POST" ||
      !["dashboard", "planner", "procurement"].includes(surface) ||
      url.pathname !== input.mount + "/" + surface ||
      request.headers.get("origin") !== input.origin ||
      request.headers.get("sec-fetch-site") === "cross-site")
      return reply({ status: "denied", reason: "native-maestro-transport-denied" }, 403)
    if (url.searchParams.size !== 1 || url.searchParams.getAll("sf").length !== 1 ||
      request.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase().trim() !== "application/json" ||
      !/^[A-Za-z0-9._:-]{8,128}$/.test(request.headers.get("idempotency-key") ?? ""))
      return reply({ status: "needs-input", reason: "native-maestro-request-invalid" }, 400)
    const bytes = await bounded(request, 65_536)
    if (!bytes) return reply({ status: "needs-input", reason: "native-maestro-body-limit" }, 413)
    const parsed: unknown = await Promise.resolve().then(() =>
      JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))).catch(() => undefined)
    if (!record(parsed) || !["admit", "run"].includes(String(parsed.action)))
      return reply({ status: "needs-input", reason: "native-maestro-command-invalid" }, 400)
    const producer = input.producer()
    if (!producer || parsed.action === "admit" && !producer.parentReady() ||
      parsed.action === "run" && !producer.ready())
      return reply({ status: "unavailable", reason: "native-maestro-c15-or-publication-unavailable" }, 503)
    if (parsed.action === "admit" && closed(parsed, ["action", "caseRef", "objective"]) &&
      record(parsed.caseRef) && closed(parsed.caseRef, ["id", "incarnation", "version"]) &&
      typeof parsed.caseRef.id === "string" && typeof parsed.caseRef.incarnation === "string" &&
      typeof parsed.caseRef.version === "number" && typeof parsed.objective === "string") {
      return resultReply(await producer.admit(request, { caseRef: {
        id: parsed.caseRef.id, incarnation: parsed.caseRef.incarnation, version: parsed.caseRef.version },
        objective: parsed.objective }).catch(() => ({ status: "unavailable", reason: "native-maestro-admit-error" })))
    }
    if (parsed.action === "run" && closed(parsed, ["action", "sessionID", "intent", "humanText"]) &&
      typeof parsed.sessionID === "string" && record(parsed.intent) &&
      closed(parsed.intent, ["caseRef", "planRevisionId", "authorizationId", "inputDigest"]) &&
      record(parsed.intent.caseRef) && closed(parsed.intent.caseRef, ["id", "incarnation", "version"]) &&
      typeof parsed.intent.planRevisionId === "string" && typeof parsed.intent.authorizationId === "string" &&
      typeof parsed.intent.inputDigest === "string" && typeof parsed.intent.caseRef.id === "string" &&
      typeof parsed.intent.caseRef.incarnation === "string" && typeof parsed.intent.caseRef.version === "number" &&
      typeof parsed.humanText === "string") {
      return resultReply(await producer.run(request, {
        sessionID: SessionSchema.ID.make(parsed.sessionID), humanText: parsed.humanText,
        intent: { planRevisionId: parsed.intent.planRevisionId, authorizationId: parsed.intent.authorizationId,
          inputDigest: parsed.intent.inputDigest, caseRef: {
            id: parsed.intent.caseRef.id, incarnation: parsed.intent.caseRef.incarnation, version: parsed.intent.caseRef.version } },
      }).catch(() => ({ status: "unavailable", reason: "native-maestro-run-error" })))
    }
    return reply({ status: "needs-input", reason: "native-maestro-command-invalid" }, 400)
  }
}
