import { AgentV2 } from "@orchestra/core/agent"
import { Catalog } from "@orchestra/core/catalog"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import type { Host } from "@orchestra/core/host"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import type { Location } from "@orchestra/core/location"
import { Mcp } from "@orchestra/core/mcp"
import { PermissionV2 } from "@orchestra/core/permission"
import type { ModelV2 } from "@orchestra/core/model"
import { SessionV2 } from "@orchestra/core/session"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { SessionScope } from "@orchestra/core/session/scope"
import { SessionSubagentModels } from "@orchestra/core/session/subagent-models"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { Context, Effect, Layer } from "effect"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfBindingRegistry, SfNativeAdmission, SfSelectedRuntime, SfSourceCapability } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import type { TrustedExecutionBinding, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { loadSfSkill } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/skill-loader.ts"
import type { SfTokenCountReceipt } from "./token-count.ts"
import type { createSfTokenGate, SfMaestroGateTicket, SfTokenGateTicket } from "./token-gate.ts"
import { hasSfProviderConflict } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts"
import { sfNativeLocationRef, sfNativeModelRef } from "./native-identity.ts"

export type SfNativePrepareInput = {
  request: Request
  selected: SfSelectedRuntime
  location: Location.Ref
  model: ModelV2.Ref
  skillId: string
  prompt: string
  runId: string
  caseRef: SfNativeAdmission["caseRef"]
  entryMode: SfNativeAdmission["entryMode"]
  toolCallBudget: number
  skillLoadBudget: number
}

export type SfNativeRun = { binding: TrustedExecutionBinding; sessionID: SfNativeAdmission["sessionID"]; skillReceipt: SfNativeAdmission["skillReceipts"][number] }

/** The only native-Maestro entrypoint. Root-private and authenticated by the existing SF human
 * lease; an arbitrary Session ID, role, agent name or model payload cannot issue this capability.
 * Initial admission durably reserves its real principal/case origin before Session.create.
 */
export type SfMaestroHostInput = Readonly<{
  request: Request
  context: TrustedUiContext
  action: "routines.admit" | "routines.run"
  intent: unknown
  location: Location.Ref
  model: ModelV2.Ref
  scope: SessionScope.Scope
  permissions: Parameters<SessionV2.Interface["setPermission"]>[0]["permission"]
  contextBudgetTokens: number
  expiresAt: string
  /** Re-authenticates C09, principal, policy/access, model and native admission across awaits. */
  revalidate: () => Effect.Effect<boolean, unknown>
  persistReceipt: (receipt: SfTokenCountReceipt) => Effect.Effect<void, unknown>
  /** Only initial admission: durable origin marker precedes Session creation. */
  reserve?: (sessionID: SessionSchema.ID) => Effect.Effect<boolean, unknown>
}>

export type SfNativeHostApi = {
  /** New authenticated native Maestro parent, not the resident sf_maestro profile. */
  admitMaestro: (input: SfMaestroHostInput) => Effect.Effect<PortResult<{ sessionID: SessionSchema.ID }>>
  /** Rebinds an existing durable parent under a FRESH authenticated human Request. */
  bindMaestro: (sessionID: SessionSchema.ID, input: SfMaestroHostInput) => Effect.Effect<PortResult<true>>
  /** Records a literal human reply; does not answer Permission or synthesize approval. */
  resumeMaestro: (sessionID: SessionSchema.ID, prompt: string) => Effect.Effect<PortResult<true>>
  currentMaestro: (sessionID: SessionSchema.ID) => Effect.Effect<boolean>
  releaseMaestro: (sessionID: SessionSchema.ID) => Effect.Effect<void>
  prepare: (input: SfNativePrepareInput) => Effect.Effect<PortResult<SfNativeRun>>
  collect: (binding: TrustedExecutionBinding) => Effect.Effect<PortResult<ReadonlyArray<{ seq: number; message: import("@orchestra/core/session/message").SessionMessage.Message }>>>
  execute: (binding: TrustedExecutionBinding) => Effect.Effect<PortResult<true>>
  interrupt: (binding: TrustedExecutionBinding, request?: Request) => Effect.Effect<PortResult<true>>
  release: (binding: TrustedExecutionBinding) => Effect.Effect<void>
}

export class SfNativeHost extends Context.Service<SfNativeHost, SfNativeHostApi>()("@orchestra/sucafina/NativeHost") {}

export type SfNativeBudgetReservation = {
  sessionID: SessionSchema.ID
  runId: string
  caseRef: SfNativeAdmission["caseRef"]
  manifestDigest: string
  profileId: SfNativeAdmission["profile"]["id"]
}

export type SfLoadedSkillObservation = Readonly<{
  session: SessionSchema.Info
  admission: SfNativeAdmission
  skills: SkillV2.Interface
  sourceCapability: SfSourceCapability
}>

export type SfNativeHostPolicy = {
  /** Absent by default. Must be composed from real createSfHumanAuthority + the original Request. */
  maestro?: {
    gate: Pick<ReturnType<typeof createSfTokenGate>, "reserveSession" | "registerMaestro" | "validMaestro" | "revokeMaestro">
    authorize: (request: Request, context: TrustedUiContext, action: SfMaestroHostInput["action"], intent: unknown) => Effect.Effect<boolean, unknown>
  }
  registry: SfBindingRegistry
  onReady?: (api: SfNativeHostApi) => () => void
  onSkillLoaded?: (observation: SfLoadedSkillObservation) => () => void
  budget?: {
    gate: Pick<ReturnType<typeof createSfTokenGate>, "reserveSession" | "register" | "revokeSession" | "revoke" | "valid">
    reserveSession: (input: SfNativeBudgetReservation) => Effect.Effect<void, unknown>
    persistReceipt: (binding: TrustedExecutionBinding, receipt: SfTokenCountReceipt) => Effect.Effect<void, unknown>
  }
  admit: (input: SfNativePrepareInput) => Effect.Effect<boolean, unknown>
  authorize: (admission: SfNativeAdmission, binding: TrustedExecutionBinding) => Effect.Effect<boolean, unknown>
  authorizeInterrupt?: (admission: SfNativeAdmission, binding: TrustedExecutionBinding, request: Request) => Effect.Effect<boolean, unknown>
}

/** Product-owned node and registration callback share one private Location-bound capability registry. */
export function createSfNativeHostContribution(input: SfNativeHostPolicy) {
  const sources = new WeakMap<SkillV2.Interface, SfSourceCapability>()
  const runs = new WeakMap<TrustedExecutionBinding, { admission: SfNativeAdmission; ticket: SfTokenGateTicket; prompt: string; used: boolean; release: () => void }>()
  const observations = new Map<SessionSchema.ID, () => void>()
  const nativeMaestro = new Map<SessionSchema.ID, {
    request: Request; context: TrustedUiContext; action: SfMaestroHostInput["action"]; intent: unknown; location: Location.Ref;
    ticket: SfMaestroGateTicket; close: () => void
  }>()
  const maestroPending = new WeakSet<Request>()
  const lifetime = { open: true }
  const onRegistered = (registration: { skills: SkillV2.Interface; sourceCapability: SfSourceCapability }) => {
    sources.set(registration.skills, registration.sourceCapability)
  }
  const node = makeGlobalNode({
      service: SfNativeHost,
      deps: [SessionV2.node, SessionStore.node, SessionSubagentModels.node, LocationServiceMap.node],
      layer: Layer.effect(SfNativeHost, Effect.gen(function* () {
        const session = yield* SessionV2.Service
        const store = yield* SessionStore.Service
        const locations = yield* LocationServiceMap.Service
        const subagentModels = yield* SessionSubagentModels.Service
        yield* Effect.addFinalizer(() => Effect.gen(function* () {
          lifetime.open = false
          const maestroOwned = [...nativeMaestro.keys()]
          for (const owner of [...nativeMaestro.values()]) owner.close()
          yield* Effect.forEach(maestroOwned, (sessionID) => Effect.exit(session.interrupt(sessionID)), { discard: true, concurrency: "unbounded" })
          const owned = [...observations.keys()]
          // Revoke every grant before waiting on any Session; another root need not own these runs.
          yield* Effect.forEach(observations.values(), (release) => Effect.exit(Effect.sync(release)), { discard: true })
          observations.clear()
          yield* Effect.forEach(owned, (sessionID) => Effect.exit(Effect.gen(function* () {
            if ((yield* session.active).has(sessionID)) yield* session.interrupt(sessionID)
          })), { discard: true, concurrency: "unbounded" })
        }))
        const authorized = (binding: TrustedExecutionBinding) => {
          const run = runs.get(binding)
          if (!lifetime.open || !run || run.admission.request.signal.aborted || Date.now() >= Date.parse(binding.expiresAt)) return Effect.succeed(false)
          return Effect.suspend(() => input.authorize(run.admission, binding)).pipe(Effect.catch(() => Effect.succeed(false)),
            Effect.map((valid) => valid && lifetime.open && runs.get(binding) === run && !run.admission.request.signal.aborted && Date.now() < Date.parse(binding.expiresAt)))
        }
        const maestroCurrent = (sessionID: SessionSchema.ID) => Effect.gen(function* () {
          const run = nativeMaestro.get(sessionID)
          if (!run || !lifetime.open || run.request.signal.aborted || !input.maestro) return false
          return (yield* input.maestro.gate.validMaestro(run.ticket).pipe(Effect.catch(() => Effect.succeed(false)))) &&
            nativeMaestro.get(sessionID) === run && !run.request.signal.aborted && lifetime.open
        })
        const maestroAuthorize = (value: SfMaestroHostInput) => Effect.suspend(() => {
          if (!lifetime.open || !input.maestro || value.context.kind !== "ui" || value.request.method !== "POST" ||
            value.request.signal.aborted || Date.now() >= Date.parse(value.expiresAt) ||
            value.context.binding.expiresAt < value.expiresAt || 
            !Number.isSafeInteger(value.contextBudgetTokens) || value.contextBudgetTokens < 1 ||
            value.scope.budgets.toolCalls < 1 || value.scope.budgets.loads < 0 ||
            value.permissions.some((rule) => rule.action !== "deny") ||
            value.model.providerID.trim() === "" || value.model.id.trim() === "")
            return Effect.succeed(false)
          return Effect.all([
            input.maestro.authorize(value.request, value.context, value.action, value.intent),
            value.revalidate(),
          ]).pipe(Effect.catch(() => Effect.succeed([false, false])), Effect.map(([human, current]) => human === true && current === true &&
            !value.request.signal.aborted && lifetime.open))
        })
        const createMaestroBinding = (sessionID: SessionSchema.ID, value: SfMaestroHostInput) => Effect.gen(function* () {
          if (!input.maestro || !(yield* maestroAuthorize(value))) return false
          const verified = yield* Effect.result(Effect.gen(function* () {
            const catalog = yield* Catalog.Service
            const agents = yield* AgentV2.Service
            const installed = yield* agents.get(AgentV2.defaultID)
            const models = yield* catalog.model.available()
            return !!installed && installed.id === AgentV2.defaultID &&
              (!installed.engine || installed.engine === "orchestra") &&
              models.some((model) => model.providerID === value.model.providerID && model.id === value.model.id &&
                (!value.model.variant || value.model.variant === "default" ||
                  model.variants.some((variant) => variant.id === value.model.variant)))
          }).pipe(Effect.provide(locations.get(value.location))))
          if (verified._tag === "Failure" || !verified.success) return false
          const parent = yield* store.get(sessionID)
          const scope = yield* store.scope(sessionID)
          if (!parent || parent.id !== sessionID || parent.parentID ||
            parent.agent !== AgentV2.defaultID || parent.time.archived || !parent.model ||
            digestSfValue(sfNativeModelRef(parent.model)) !== digestSfValue(sfNativeModelRef(value.model)) ||
            digestSfValue(parent.location) !== digestSfValue(value.location) ||
            !scope || digestSfValue(scope.scope) !== digestSfValue(value.scope) ||
            !(yield* maestroAuthorize(value))) return false
          const ticket = yield* input.maestro.gate.registerMaestro({
            sessionID, request: value.request, model: value.model, location: value.location, projectId: parent.projectID,
            scope: value.scope, expiresAt: value.expiresAt, contextBudgetTokens: value.contextBudgetTokens,
            revalidate: () => maestroAuthorize(value), persistReceipt: value.persistReceipt,
          }).pipe(Effect.provideService(SessionStore.Service, store))
          if (!ticket || !(yield* maestroAuthorize(value))) {
            if (ticket) input.maestro.gate.revokeMaestro(ticket)
            return false
          }
          const close = () => {
            if (nativeMaestro.get(sessionID)?.ticket !== ticket) return
            nativeMaestro.delete(sessionID)
            value.request.signal.removeEventListener("abort", onAbort)
            input.maestro?.gate.revokeMaestro(ticket)
          }
          const onAbort = () => {
            close()
            void Effect.runPromise(session.interrupt(sessionID)).catch(() => {})
          }
          nativeMaestro.set(sessionID, { request: value.request, context: value.context, action: value.action,
            intent: value.intent, location: value.location, ticket, close })
          value.request.signal.addEventListener("abort", onAbort, { once: true })
          if (value.request.signal.aborted || !(yield* maestroCurrent(sessionID))) {
            close()
            return false
          }
          return true
        })
        const api = SfNativeHost.of({
          admitMaestro: (value) => Effect.gen(function* () {
            if (value.action !== "routines.admit" || !value.reserve || !input.maestro ||
              maestroPending.has(value.request) || !(yield* maestroAuthorize(value)))
              return { status: "denied", reason: "native-maestro-admission-unavailable" } as const
            maestroPending.add(value.request)
            try {
              const sessionID = SessionSchema.ID.create()
              if (yield* store.get(sessionID)) return { status: "conflict", reason: "native-maestro-session-conflict" } as const
              // The reservation precedes Session.create; even an interrupted reservation remains a deny marker.
              const durable = yield* Effect.result(value.reserve(sessionID))
              if (durable._tag !== "Success" || durable.success !== true || !(yield* maestroAuthorize(value)))
                return { status: "denied", reason: "native-maestro-origin-unavailable" } as const
              input.maestro.gate.reserveSession(sessionID)
              const created = yield* Effect.result(session.create({ id: sessionID, location: value.location,
                agent: AgentV2.defaultID, model: value.model }))
              if (created._tag !== "Success" || created.success.id !== sessionID ||
                created.success.agent !== AgentV2.defaultID) return { status: "unavailable", reason: "native-maestro-create-failed" } as const
              const narrowed = yield* Effect.result(store.narrow(sessionID, value.scope))
              if (narrowed._tag !== "Success") return { status: "unavailable", reason: "native-maestro-scope-failed" } as const
              const permissions = yield* Effect.result(session.setPermission({ sessionID, permission: value.permissions }))
              if (permissions._tag !== "Success") return { status: "unavailable", reason: "native-maestro-permission-failed" } as const
              // Native Task child model selection is bounded by the parent. Unbound child provider
              // calls still fail closed at C15 until they receive an independently admitted ticket.
              const children = yield* Effect.result(subagentModels.set(sessionID,
                { mode: "allowlist", models: [{ providerID: value.model.providerID, id: value.model.id }] }))
              if (children._tag !== "Success") return { status: "unavailable", reason: "native-maestro-child-ceiling-failed" } as const
              const bound = yield* createMaestroBinding(sessionID, value)
              return bound ? { status: "ok", value: { sessionID } } as const :
                { status: "denied", reason: "native-maestro-c15-unavailable" } as const
            } finally {
              maestroPending.delete(value.request)
            }
          }),
          bindMaestro: (sessionID, value) => Effect.gen(function* () {
            if (value.action !== "routines.run" || !input.maestro || nativeMaestro.has(sessionID) ||
              !(yield* maestroAuthorize(value))) return { status: "denied", reason: "native-maestro-rebind-unavailable" } as const
            const bound = yield* createMaestroBinding(sessionID, value)
            return bound ? { status: "ok", value: true } as const :
              { status: "denied", reason: "native-maestro-origin-or-c15-unavailable" } as const
          }),
          resumeMaestro: (sessionID, prompt) => Effect.gen(function* () {
            if (!prompt.trim() || prompt.length > 100_000 || !(yield* maestroCurrent(sessionID)))
              return { status: "denied", reason: "native-maestro-human-continuation-unavailable" } as const
            const admitted = nativeMaestro.get(sessionID)
            if (!admitted) return { status: "denied", reason: "native-maestro-origin-unavailable" } as const
            // Pending Permission belongs to the native human UI. Never manufacture reply/approval.
            const pending = yield* Effect.result(Effect.gen(function* () {
              const perm = yield* PermissionV2.Service
              return yield* perm.forSession(sessionID)
            }).pipe(Effect.provide(locations.get(admitted.location))))
            if (pending._tag !== "Success" || pending.success.length !== 0)
              return { status: "denied", reason: "native-maestro-permission-pending" } as const
            if (!(yield* maestroCurrent(sessionID))) return { status: "denied", reason: "native-maestro-origin-changed" } as const
            const written = yield* Effect.result(session.prompt({ id: SessionMessage.ID.create(), sessionID,
              prompt: { text: prompt }, resume: false }))
            if (written._tag !== "Success" || !(yield* maestroCurrent(sessionID)))
              return { status: "unavailable", reason: "native-maestro-prompt-unavailable" } as const
            const resumed = yield* Effect.result(session.resume(sessionID))
            return resumed._tag === "Success" && (yield* maestroCurrent(sessionID))
              ? { status: "ok", value: true } as const :
                { status: "unavailable", reason: "native-maestro-provider-unavailable" } as const
          }),
          currentMaestro: maestroCurrent,
          releaseMaestro: (sessionID) => Effect.gen(function* () {
            nativeMaestro.get(sessionID)?.close()
            yield* Effect.exit(session.interrupt(sessionID))
          }),
          prepare: (request) => Effect.gen(function* () {
            const args = Object.freeze({ ...freezeHostInput(structuredClone({ selected: request.selected,
              location: sfNativeLocationRef(request.location), model: sfNativeModelRef(request.model),
              skillId: request.skillId, prompt: request.prompt, runId: request.runId, caseRef: request.caseRef, entryMode: request.entryMode,
              toolCallBudget: request.toolCallBudget, skillLoadBudget: request.skillLoadBudget })), request: request.request })
            if (args.request.signal.aborted || !(yield* Effect.suspend(() => input.admit(args)).pipe(Effect.catch(() => Effect.succeed(false)))))
              return { status: "denied", reason: "native-admission-denied" } as const
            if (!lifetime.open || !input.budget) return { status: "unavailable", reason: "c15-context-budget-gate-unavailable" } as const
            const budget = input.budget
            const selected = args.selected
            const selectedSkill = selected.skills.find((skill) => skill.id === args.skillId)
            if (!selectedSkill || !args.runId || !args.prompt.trim() || !Number.isSafeInteger(args.toolCallBudget) || args.toolCallBudget < 1 ||
              !Number.isSafeInteger(args.skillLoadBudget) || args.skillLoadBudget < 0)
              return { status: "denied", reason: "invalid-native-selection" } as const
            const placed = yield* Effect.gen(function* () {
              const catalog = yield* Catalog.Service
              const skills = yield* SkillV2.Service
              const mcp = yield* Mcp.Service
              const sourceCapability = sources.get(skills)
              const available = yield* catalog.model.available()
              // Core resolves "default" through model.request.variant; only explicit alternatives need a catalog entry.
              const model = available.find((item) => item.providerID === args.model.providerID && item.id === args.model.id &&
                (args.model.variant === "default" || item.variants.some((variant) => variant.id === args.model.variant)))
              const conflict = yield* Effect.promise(() => hasSfProviderConflict(mcp).catch(() => undefined))
              return { skills, sourceCapability, model, conflict }
            }).pipe(Effect.provide(locations.get(args.location)), Effect.result)
            if (placed._tag === "Failure") return { status: "unavailable", reason: "location-unavailable" } as const
            if (placed.success.conflict === undefined) return { status: "unavailable", reason: "provider-configuration-unavailable" } as const
            if (placed.success.conflict) return { status: "provider-conflict", reason: "provider-conflict" } as const
            if (!placed.success.sourceCapability || !placed.success.model) return { status: "unavailable", reason: "resident-source-or-model-unavailable" } as const
            const reservedID = SessionSchema.ID.create()
            if (yield* store.get(reservedID)) return { status: "unavailable", reason: "native-session-id-conflict" } as const
            const reserved = yield* Effect.result(budget.reserveSession({ sessionID: reservedID, runId: args.runId, caseRef: args.caseRef,
              manifestDigest: selected.manifestDigest, profileId: selected.profile.id }))
            if (reserved._tag === "Failure") return { status: "unavailable", reason: "native-session-reservation-failed" } as const
            budget.gate.reserveSession(reservedID)
            const created = yield* Effect.result(session.create({ id: reservedID, location: args.location, agent: AgentV2.ID.make(selected.profile.id), model: args.model }))
            if (created._tag === "Failure") return { status: "unavailable", reason: "native-session-create-failed" } as const
            const sessionID = created.success.id
            if (sessionID !== reservedID || created.success.agent !== selected.profile.id ||
              !created.success.model || digestSfValue(created.success.model) !== digestSfValue(args.model) ||
              digestSfValue(created.success.location) !== digestSfValue(args.location))
              return { status: "denied", reason: "native-session-conflict" } as const
            const loaded = yield* Effect.result(loadSfSkill({ session, skills: placed.success.skills, sourceCapability: placed.success.sourceCapability,
              selected, sessionID, profile: selected.profile, skill: selectedSkill, runId: args.runId, manifestDigest: selected.manifestDigest }))
            if (loaded._tag === "Failure") {
              return { status: "unavailable", reason: "native-skill-load-failed" } as const
            }
            const narrowed = yield* Effect.result(store.narrow(sessionID, { skills: { entry: selectedSkill.id, allow: selected.skills.map((skill) => skill.id) },
              tools: [...selected.operationIds], budgets: { loads: args.skillLoadBudget, toolCalls: args.toolCallBudget } }))
            if (narrowed._tag === "Failure") {
              return { status: "unavailable", reason: "native-session-scope-failed" } as const
            }
            const admission: SfNativeAdmission = { request: args.request, selected, sessionID, runId: args.runId,
              caseRef: args.caseRef, profile: selected.profile, manifestDigest: selected.manifestDigest,
              skillReceipts: Object.freeze([Object.freeze(loaded.success)]), entryMode: args.entryMode }
            const acquired: { binding?: TrustedExecutionBinding; ticket?: SfTokenGateTicket; retained: boolean; closed: boolean } = { retained: false, closed: false }
            return yield* Effect.acquireUseRelease(
              Effect.sync(() => {
                if (!lifetime.open) throw new Error("native-host-disposed")
                return input.onSkillLoaded?.({ session: created.success, admission, skills: placed.success.skills,
                  sourceCapability: placed.success.sourceCapability! })
              }),
              (release) => Effect.gen(function* () {
                const attempted = yield* Effect.result(Effect.tryPromise({ try: () => input.registry.bind(admission).then((result) => {
                  if (result.status === "ok") {
                    if (acquired.closed) input.registry.revoke(result.value)
                    else acquired.binding = result.value
                  }
                  return result
                }), catch: () => "binding-unavailable" }))
                if (attempted._tag === "Failure") return { status: "unavailable", reason: "native-binding-unavailable" } as const
                const bound = attempted.success
                if (bound.status !== "ok") return bound
                if (!sameNativeProject(created.success, bound.value)) return { status: "denied", reason: "native-project-mismatch" } as const
                const ticket = yield* budget.gate.register({ admission, binding: bound.value, model: args.model, location: args.location,
                  revalidate: () => input.authorize(admission, bound.value),
                  persistReceipt: (receipt) => budget.persistReceipt(bound.value, receipt),
                }).pipe(Effect.provideService(SessionStore.Service, store))
                if (!ticket) return { status: "unavailable", reason: "c15-context-budget-gate-unavailable" } as const
                acquired.ticket = ticket
                if (!lifetime.open) return { status: "unavailable", reason: "c15-context-budget-gate-unavailable" } as const
                const discard = () => {
                  if (observations.get(sessionID) !== discard) return
                  observations.delete(sessionID)
                  budget.gate.revoke(ticket)
                  input.registry.revoke(bound.value)
                  runs.delete(bound.value)
                  release?.()
                }
                observations.set(sessionID, discard)
                runs.set(bound.value, { admission, ticket, prompt: args.prompt, used: false, release: discard })
                acquired.retained = true
                return { status: "ok", value: { binding: bound.value, sessionID, skillReceipt: loaded.success } } as const
              }),
              (release) => Effect.sync(() => {
                if (acquired.retained) return
                acquired.closed = true
                budget.gate.revokeSession(sessionID)
                if (acquired.ticket) budget.gate.revoke(acquired.ticket)
                if (acquired.binding) input.registry.revoke(acquired.binding)
                release?.()
              }),
            ).pipe(Effect.onInterrupt(() => Effect.sync(() => {
              if (acquired.binding) runs.get(acquired.binding)?.release()
            })))
          }),
          collect: (binding) => Effect.gen(function* () {
            if (!(yield* authorized(binding))) return { status: "denied", reason: "native-authority-unavailable" } as const
            const entries = yield* Effect.result(store.entries(runs.get(binding)!.admission.sessionID))
            if (entries._tag === "Failure") return { status: "unavailable", reason: "native-messages-unavailable" } as const
            if (!(yield* authorized(binding))) return { status: "denied", reason: "native-authority-changed" } as const
            return { status: "ok", value: entries.success } as const
          }),
          execute: (binding) => Effect.suspend<PortResult<true>, never, never>(() => {
            const run = runs.get(binding)
            const budget = input.budget
            if (!run || !budget) return Effect.succeed({ status: "unavailable", reason: "c15-context-budget-gate-unavailable" } as const)
            if (run.used) return Effect.succeed({ status: "denied", reason: "native-execution-already-used" } as const)
            run.used = true
            return Effect.gen(function* () {
              if (!(yield* authorized(binding)) || !(yield* budget.gate.valid(run.ticket, store)))
                return { status: "denied", reason: "native-authority-unavailable" } as const
              const admitted = yield* Effect.result(session.prompt({ id: SessionMessage.ID.create(), sessionID: run.admission.sessionID,
                prompt: { text: run.prompt }, resume: false }))
              if (admitted._tag === "Failure") return { status: "unavailable", reason: "native-prompt-admission-failed" } as const
              const resumed = yield* Effect.result(session.resume(run.admission.sessionID))
              if (resumed._tag === "Failure") return { status: "unavailable", reason: "native-session-failed" } as const
              return { status: "ok", value: true } as const
            })
          }),
          interrupt: (binding, request) => Effect.gen(function* () {
            const run = runs.get(binding)
            if (!run || !lifetime.open)
              return { status: "denied", reason: "native-authority-unavailable" } as const
            const current = request ? false : (yield* authorized(binding))
            const cancelled = request && !request.signal.aborted && input.authorizeInterrupt
              ? yield* Effect.suspend(() => input.authorizeInterrupt!(run.admission, binding, request)).pipe(Effect.catch(() => Effect.succeed(false))) : false
            if ((!current && !cancelled) || !lifetime.open || runs.get(binding) !== run || (request && request.signal.aborted))
              return { status: "denied", reason: "native-authority-unavailable" } as const
            run.release()
            yield* session.interrupt(run.admission.sessionID)
            return { status: "ok", value: true } as const
          }),
          release: (binding) => Effect.gen(function* () {
            const run = runs.get(binding)
            if (!run) return
            // Revoke owned resources even if the native interruption fails.
            run.release()
            yield* session.interrupt(run.admission.sessionID)
          }),
        })
        const release = input.onReady?.(api)
        if (release) yield* Effect.addFinalizer(() => Effect.sync(release))
        return api
      })),
    })
  const contribution: Host.Contribution = { id: "sucafina-native-host", nodes: [node] }
  return { contribution, onRegistered, node }
}

function freezeHostInput<T>(value: T): T {
  if (!value || typeof value !== "object") return value
  Object.values(value).forEach(freezeHostInput)
  return Object.freeze(value)
}

/** Project identity is resolved by Core; an installation ID is not a substitute. */
export function sameNativeProject(session: SessionSchema.Info, binding: TrustedExecutionBinding) {
  return session.projectID === binding.projectId
}
