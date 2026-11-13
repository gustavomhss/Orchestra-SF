import { AgentV2 } from "@orchestra/core/agent"
import { Catalog } from "@orchestra/core/catalog"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import type { Host } from "@orchestra/core/host"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import type { Location } from "@orchestra/core/location"
import { Mcp } from "@orchestra/core/mcp"
import type { ModelV2 } from "@orchestra/core/model"
import { SessionV2 } from "@orchestra/core/session"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { Context, Effect, Layer } from "effect"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfBindingRegistry, SfNativeAdmission, SfSelectedRuntime, SfSourceCapability } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"
import type { TrustedExecutionBinding } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { loadSfSkill } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/skill-loader.ts"
import type { SfTokenCountReceipt } from "./token-count.ts"
import type { createSfTokenGate, SfTokenGateTicket } from "./token-gate.ts"
import { hasSfProviderConflict } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/sf-mcp-bridge.ts"

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

export type SfNativeHostApi = {
  prepare: (input: SfNativePrepareInput) => Effect.Effect<PortResult<SfNativeRun>>
  collect: (binding: TrustedExecutionBinding) => Effect.Effect<PortResult<ReadonlyArray<{ seq: number; message: import("@orchestra/core/session/message").SessionMessage.Message }>>>
  execute: (binding: TrustedExecutionBinding) => Effect.Effect<PortResult<true>>
  interrupt: (binding: TrustedExecutionBinding) => Effect.Effect<PortResult<true>>
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
  registry: SfBindingRegistry
  onReady?: (api: SfNativeHostApi) => () => void
  onSkillLoaded?: (observation: SfLoadedSkillObservation) => () => void
  budget?: {
    gate: ReturnType<typeof createSfTokenGate>
    reserveSession: (input: SfNativeBudgetReservation) => Effect.Effect<void, unknown>
    persistReceipt: (binding: TrustedExecutionBinding, receipt: SfTokenCountReceipt) => Effect.Effect<void, unknown>
  }
  admit: (input: SfNativePrepareInput) => Effect.Effect<boolean, unknown>
  authorize: (admission: SfNativeAdmission, binding: TrustedExecutionBinding) => Effect.Effect<boolean, unknown>
}

/** Product-owned node and registration callback share one private Location-bound capability registry. */
export function createSfNativeHostContribution(input: SfNativeHostPolicy) {
  const sources = new WeakMap<SkillV2.Interface, SfSourceCapability>()
  const runs = new WeakMap<TrustedExecutionBinding, { admission: SfNativeAdmission; ticket: SfTokenGateTicket; prompt: string; used: boolean; release: () => void }>()
  const observations = new Set<() => void>()
  const lifetime = { open: true }
  const onRegistered = (registration: { skills: SkillV2.Interface; sourceCapability: SfSourceCapability }) => {
    sources.set(registration.skills, registration.sourceCapability)
  }
  const node = makeGlobalNode({
      service: SfNativeHost,
      deps: [SessionV2.node, SessionStore.node, LocationServiceMap.node],
      layer: Layer.effect(SfNativeHost, Effect.gen(function* () {
        const session = yield* SessionV2.Service
        const store = yield* SessionStore.Service
        const locations = yield* LocationServiceMap.Service
        yield* Effect.addFinalizer(() => Effect.gen(function* () {
          lifetime.open = false
          yield* Effect.forEach(observations, (release) => Effect.exit(Effect.sync(release)), { discard: true })
          observations.clear()
        }))
        const authorized = (binding: TrustedExecutionBinding) => {
          const run = runs.get(binding)
          if (!lifetime.open || !run || run.admission.request.signal.aborted || Date.now() >= Date.parse(binding.expiresAt)) return Effect.succeed(false)
          return Effect.suspend(() => input.authorize(run.admission, binding)).pipe(Effect.catch(() => Effect.succeed(false)),
            Effect.map((valid) => valid && lifetime.open && runs.get(binding) === run && !run.admission.request.signal.aborted && Date.now() < Date.parse(binding.expiresAt)))
        }
        const api = SfNativeHost.of({
          prepare: (request) => Effect.gen(function* () {
            const args = Object.freeze({ ...freezeHostInput(structuredClone({ selected: request.selected, location: request.location, model: request.model,
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
              const model = available.find((item) => item.providerID === args.model.providerID && item.id === args.model.id &&
                (args.model.variant === undefined || item.variants.some((variant) => variant.id === args.model.variant)))
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
                  if (!observations.delete(discard)) return
                  budget.gate.revoke(ticket)
                  input.registry.revoke(bound.value)
                  runs.delete(bound.value)
                  release?.()
                }
                observations.add(discard)
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
          interrupt: (binding) => Effect.gen(function* () {
            if (!(yield* authorized(binding))) return { status: "denied", reason: "native-authority-unavailable" } as const
            const run = runs.get(binding)!
            yield* session.interrupt(run.admission.sessionID)
            run.release()
            return { status: "ok", value: true } as const
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
