import { expect, test } from "bun:test"
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { AgentV2 } from "@orchestra/core/agent"
import { Catalog } from "@orchestra/core/catalog"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Location } from "@orchestra/core/location"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { ModelV2 } from "@orchestra/core/model"
import { ProviderV2 } from "@orchestra/core/provider"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionStore } from "@orchestra/core/session/store"
import { SkillV2 } from "@orchestra/core/skill"
import { Context, Deferred, Effect, Layer } from "effect"
import { createSfNativeHostContribution, SfNativeHost } from "../../../../../../../apps/cli/src/sucafina-product/native-host.ts"
import { sfNativeLocationRef } from "../../../../../../../apps/cli/src/sucafina-product/native-identity.ts"
import type { SfNativeRun } from "../../../../../../../apps/cli/src/sucafina-product/native-host.ts"
import { createSfNativeExecution } from "../../../../../../../apps/cli/src/sucafina-product/native-execution.ts"
import type { SfTokenGateTicket } from "../../../../../../../apps/cli/src/sucafina-product/token-gate.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { TrustedCallContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfExecutionBindingRegistry } from "../../../../product/host-binding/execution-context.ts"
import { registerSfResidentAgents } from "../../../../product/host-binding/resident-agents.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import type { SfNativeRunRecord } from "../../../../product/contracts/state.ts"
import type { createSfRunStore } from "../../../../product/ai/run-store.ts"
import { selection } from "../resident-runtime/fixture.ts"

// Session recording, skill loading, execution ownership and interruption use Core.
// The synthetic budget admission isolates lifecycle; this is not a live C15/GNATIVE proof.
test.each(["dispose", "interrupt-failure", "abort-attach", "revoke-attach", "throw-attach", "throw-announcement", "pending-interruption"] as const)("native host ownership cleanup: %s", async (mode) => {
  const failure = mode === "interrupt-failure"
  const root = await mkdtemp(path.join(tmpdir(), "sf-host-disposal-"))
  try {
    const source = path.join(root, "skills")
    const skillFile = "---\nname: sf-explicar-forecast\ndescription: Lifecycle fixture\n---\n# Lifecycle instructions\n"
    await mkdir(path.join(source, "sf-explicar-forecast"), { recursive: true })
    await writeFile(path.join(source, "sf-explicar-forecast", "SKILL.md"), skillFile)
    const selected = selection({ id: "sf_finance", version: "1", mission: "Lifecycle fixture", sourcePath: "profile.json",
      sourceDigest: "a".repeat(64), allowedSkills: ["sf-explicar-forecast"], allowedOperations: ["sf_forecast_compare"],
      outputTypes: ["FinancialAnalysis"], contextBudgetTokens: 1000, maxSteps: 2, maxDelegations: 0, modelClass: "reasoning", resumePolicy: "fresh" })
    const runtime = { ...selected, skills: [{ ...selected.skills[0]!,
      sourceDigest: new Bun.CryptoHasher("sha256").update(skillFile).digest("hex"),
      instructionsDigest: new Bun.CryptoHasher("sha256").update("# Lifecycle instructions").digest("hex") }] }
    // Core persists this optional key explicitly; registration and Session.skill must share the same Location scope.
    const location = sfNativeLocationRef(Location.Ref.make({ directory: AbsolutePath.make(root) }))
    const otherDirectory = path.join(root, "other")
    await mkdir(otherDirectory)
    const model = { providerID: ProviderV2.ID.make("sf-disposal-fixture"), id: ModelV2.ID.make("lifecycle") }
    const layer = AppNodeBuilder.build(LayerNode.group([SessionV2.node, SessionStore.node, SessionExecution.node, LocationServiceMap.node]),
      [[SessionExecution.node, SessionExecutionLocal.node]])
    await Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const store = yield* SessionStore.Service
      const execution = yield* SessionExecution.Service
      const locations = yield* LocationServiceMap.Service
      const tickets = new Map<SessionSchema.ID, SfTokenGateTicket>()
      const leases: TrustedCallContext[] = []
      const interrupted: SessionSchema.ID[] = []
      const released: SessionSchema.ID[] = []
      const fail: { sessionID?: SessionSchema.ID } = {}
      const authorization = { allowed: true }
      const interruption = { hold: false, entered: Promise.withResolvers<void>(), resume: Promise.withResolvers<void>() }
      const changed: { create?: Partial<Parameters<SessionV2.Interface["create"]>[0]> } = {}
      const registry = createSfExecutionBindingRegistry({
        authenticateAndResolve: async (admission) => {
          const current = await Effect.runPromise(store.get(admission.sessionID))
          return current ? { installationId: "fixture", hostId: "fixture-host", projectId: current.projectID, locationId: "fixture-location",
            principalRef: "fixture-person", policyVersion: "fixture-policy", accessRevision: "fixture-access", providerGeneration: 1,
            expiresAt: new Date(Date.now() + 60_000).toISOString() } : undefined
        }, revalidateAdmission: async () => true,
      })
      const native = createSfNativeHostContribution({ registry, admit: () => Effect.succeed(true), authorize: () => Effect.succeed(authorization.allowed),
        onSkillLoaded: (observation) => () => { released.push(observation.session.id) },
        budget: { reserveSession: () => Effect.void, persistReceipt: () => Effect.void, gate: {
          reserveSession: () => undefined,
          register: (input) => Effect.sync(() => {
            const ticket = Object.freeze({}) as SfTokenGateTicket
            tickets.set(input.admission.sessionID, ticket)
            return ticket
          }),
          revoke: (ticket) => { tickets.forEach((current, id) => { if (current === ticket) tickets.delete(id) }) },
          revokeSession: (id) => { tickets.delete(id) }, valid: () => Effect.succeed(true),
        } },
      })
      const hostSession: SessionV2.Interface = { ...session,
        // Fault injection persists a different real Core identity; the product must refuse it before any skill grant.
        create: (args) => session.create({ ...args, ...changed.create }),
        interrupt: (id) => Effect.gen(function* () {
        interrupted.push(id)
        expect(tickets.size).toBe(0)
        expect(leases.every((lease) => registry.requestFor(lease) === undefined)).toBe(true)
        if (interruption.hold) {
          interruption.entered.resolve()
          yield* Effect.promise(() => interruption.resume.promise)
        }
        if (id === fail.sessionID) return yield* Effect.die("synthetic interruption failure")
        yield* session.interrupt(id)
      }) }
      const activate = (id: SessionSchema.ID) => Effect.gen(function* () {
        const entered = yield* Deferred.make<void>()
        yield* execution.exclusive(id, Deferred.succeed(entered, undefined).pipe(Effect.andThen(Effect.never))).pipe(Effect.forkChild)
        yield* Deferred.await(entered)
      })
      yield* Effect.gen(function* () {
        const catalog = yield* Catalog.Service
        const skills = yield* SkillV2.Service
        const agents = yield* AgentV2.Service
        yield* catalog.transform((draft) => {
          draft.provider.update(model.providerID, () => undefined)
          draft.model.update(model.providerID, model.id, (value) => { value.enabled = true })
        })
        const sourceCapability = yield* registerSfResidentAgents({ agents, skills, selected: [runtime], source: { type: "directory", path: AbsolutePath.make(source) } })
        native.onRegistered({ skills, sourceCapability })
        const unrelated = yield* session.create({ location, agent: AgentV2.ID.make("ordinary") })
        yield* activate(unrelated.id)
        const retained = yield* Effect.gen(function* () {
          if (native.node.kind !== "layer") throw new Error("native-host-layer-unavailable")
          const implementation = native.node.implementation as Layer.Layer<SfNativeHost, never, SessionV2.Service | SessionStore.Service | LocationServiceMap.Service>
          const context = yield* Layer.build(implementation).pipe(Effect.provideService(SessionV2.Service, hostSession),
            Effect.provideService(SessionStore.Service, store), Effect.provideService(LocationServiceMap.Service, locations))
          const host = Context.get(context, SfNativeHost)
          for (const change of [
            { model: { ...model, providerID: ProviderV2.ID.make("other-provider") } },
            { model: { ...model, id: ModelV2.ID.make("other-model") } },
            { model: { ...model, variant: ModelV2.VariantID.make("explicit-other-variant") } },
            { location: sfNativeLocationRef({ directory: AbsolutePath.make(otherDirectory) }) },
            { agent: AgentV2.ID.make("ordinary") },
            { id: SessionSchema.ID.create() },
          ]) {
            changed.create = change
            const rejected = yield* host.prepare({ request: new Request("https://example.test/sf"), selected: runtime, location, model,
              skillId: "sf-explicar-forecast", prompt: "Identity boundary fixture", runId: "changed-identity",
              caseRef: { id: "case", incarnation: "incarnation", version: 1 }, entryMode: "interactive", toolCallBudget: 1, skillLoadBudget: 0 })
            expect(rejected).toEqual({ status: "denied", reason: "native-session-conflict" })
            expect(tickets.size).toBe(0)
            expect(released).toHaveLength(0)
          }
          delete changed.create
          const runs: SfNativeRun[] = []
          if (mode !== "dispose" && mode !== "interrupt-failure") {
            const abort = new AbortController()
            const request = new Request("https://example.test/sf", { signal: abort.signal })
            const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "fixture", projectId: unrelated.projectID,
              principalRef: "fixture-person", policyVersion: "fixture-policy", accessRevision: "fixture-access" }),
              commandIdentity: async () => "lifecycle", createId: () => "lifecycle", now: Date.now })
            const analysis = { caseRef: { id: "cleanup", incarnation: "cleanup", version: 1 }, profileId: runtime.profile.id,
              profileVersion: runtime.profile.version, skillId: runtime.skills[0]!.id, skillVersion: runtime.skills[0]!.version,
              manifestDigest: runtime.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: runtime.operationIds,
              objective: "Cleanup", contextFingerprint: digestSfValue("cleanup") }
            const access = yield* Effect.promise(() => ui.admit(request, "sf_forecast_compare", digestSfValue(analysis)))
            if (access.status !== "ok") throw new Error("UI lifecycle grant unavailable")
            if (!(yield* Effect.promise(() => ui.validate(access.value, "sf_forecast_compare", digestSfValue(analysis))))) throw new Error("UI lifecycle grant unavailable")
            const record: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef: "cleanup", version: 1, intentDigest: digestSfValue("intent"),
              requestDigest: digestSfValue(analysis), skillInputDigest: digestSfValue({}), principalRef: "fixture-person", policyVersion: "fixture-policy",
              accessRevision: "fixture-access", caseRef: analysis.caseRef, selection: runtime, model, skillId: analysis.skillId,
              objective: analysis.objective, contextFingerprint: analysis.contextFingerprint, createdAt: "2026-11-14T00:00:00Z", updatedAt: "2026-11-14T00:00:00Z", state: "preparing" }
            // Persistence outcomes are injected here to reach exact failure windows;
            // Core Session, skill observation, opaque binding and token ownership are real.
            const persistence: ReturnType<typeof createSfRunStore> = {
              create: async () => ({ status: "ok", value: record }), read: async () => ({ status: "unavailable", reason: "not-exercised" }),
              readLifecycle: async () => ({ status: "unavailable", reason: "not-exercised" }),
              markStale: async () => ({ status: "unavailable", reason: "not-exercised" }), preserveStale: async () => ({ status: "unavailable", reason: "not-exercised" }),
              publish: async () => ({ status: "unavailable", reason: "not-exercised" }), transition: async () => ({ status: "denied", reason: "revoked-transition" }),
              attach: async (_run, _version, sessionID, skillReceipt) => {
                authorization.allowed = mode !== "abort-attach" && mode !== "revoke-attach"
                const run = runs[0]
                if (!run) throw new Error("Native preparation did not retain its resources")
                const leased = await registry.lease({ sessionID: run.sessionID, agent: AgentV2.ID.make(runtime.profile.id),
                  assistantMessageID: SessionMessage.ID.create(), toolCallID: "attach-failure" }, "sf_forecast_compare", digestSfValue({}))
                if (leased.status !== "ok" || !registry.consume(leased.value, "sf_forecast_compare", digestSfValue({}))) throw new Error("Actual native lease unavailable")
                leases.push(leased.value)
                expect(tickets.size).toBe(1)
                expect(released).toHaveLength(0)
                if (mode === "abort-attach") abort.abort()
                if (mode === "revoke-attach") registry.revoke(run.binding)
                if (mode === "pending-interruption") interruption.hold = true
                if (mode === "throw-attach") throw new Error("Injected attachment failure")
                if (mode !== "throw-announcement") return { status: "denied", reason: "injected-attachment-veto" }
                fail.sessionID = run.sessionID
                return { status: "ok", value: { ...record, version: 2, state: "queued", native: { sessionID, skillReceipt } } }
              },
            }
            const executor = createSfNativeExecution({ host: { ...host, prepare: (value) => host.prepare(value).pipe(Effect.tap((result) => Effect.sync(() => {
              expect(result).toMatchObject({ status: "ok" })
              if (result.status === "ok") runs.push(result.value)
            }))) }, store: persistence, withRunContext: (_run, work) => work(access.value), intentDigest: record.intentDigest,
              preflight: async () => ({ status: "ok", value: { record, native: { request, selected: runtime, location, model, skillId: analysis.skillId,
                prompt: "Cleanup", runId: record.runRef, caseRef: record.caseRef, entryMode: "interactive", toolCallBudget: 1, skillLoadBudget: 0 } } }),
              verifyOutput: async () => ({ status: "unavailable", reason: "not-exercised" }),
              onAdmitted: () => { throw new Error("Injected announcement failure") },
            })
            try {
              const admitted = executor.admit(analysis, {})
              if (mode === "pending-interruption") {
                try {
                  yield* Effect.promise(() => interruption.entered.promise)
                  expect(authorization.allowed).toBe(true)
                  expect(interrupted).toEqual([runs[0]!.sessionID])
                  expect(tickets.size).toBe(0)
                  expect(released).toEqual([runs[0]!.sessionID])
                  expect(leases.every((lease) => registry.requestFor(lease) === undefined)).toBe(true)
                } finally { interruption.resume.resolve() }
              }
              const result = yield* Effect.promise(() => admitted)
              expect(result.status).not.toBe("ok")
              expect(runs).toHaveLength(1)
              expect(tickets.size).toBe(0)
              expect(released).toEqual([runs[0]!.sessionID])
              expect(leases.every((lease) => registry.requestFor(lease) === undefined)).toBe(true)
              expect(yield* Effect.promise(() => executor.releaseRun(record.runRef))).toBeUndefined()
              yield* Effect.promise(() => executor.shutdown())
              yield* host.release(runs[0]!.binding)
              expect(released).toHaveLength(1)
              expect((yield* host.collect(runs[0]!.binding)).status).toBe("denied")
            } finally { ui.finish(access.value) }
            return { host, runs, lifecycle: true as const }
          }
          for (const suffix of ["first", "second", "idle"]) {
            const prepared = yield* host.prepare({ request: new Request("https://example.test/sf"), selected: runtime, location, model,
              skillId: "sf-explicar-forecast", prompt: "Lifecycle fixture", runId: suffix, caseRef: { id: suffix, incarnation: suffix, version: 1 },
              entryMode: "interactive", toolCallBudget: 1, skillLoadBudget: 0 })
            expect(prepared).toMatchObject({ status: "ok" })
            if (prepared.status !== "ok") throw new Error(`Native lifecycle preparation: ${prepared.status}:${prepared.reason}`)
            const persisted = yield* store.get(prepared.value.sessionID)
            expect(persisted?.model).toEqual({ ...model, variant: ModelV2.VariantID.make("default") })
            expect(persisted?.location).toEqual(location)
            runs.push(prepared.value)
            const lease = yield* Effect.promise(() => registry.lease({ sessionID: prepared.value.sessionID, agent: AgentV2.ID.make("sf_finance"),
              assistantMessageID: SessionMessage.ID.create(), toolCallID: suffix }, "sf_forecast_compare", digestSfValue({})))
            expect(lease.status).toBe("ok")
            if (lease.status !== "ok") throw new Error(lease.reason)
            expect(registry.consume(lease.value, "sf_forecast_compare", digestSfValue({}))).toBe(true)
            leases.push(lease.value)
          }
          yield* activate(runs[0]!.sessionID)
          yield* activate(runs[1]!.sessionID)
          if (failure) fail.sessionID = runs[0]!.sessionID
          return { host, runs, lifecycle: false as const }
        }).pipe(Effect.scoped)
        if (retained.lifecycle) {
          expect((yield* session.active).has(unrelated.id)).toBe(true)
          yield* session.interrupt(unrelated.id)
          return
        }
        expect(interrupted.toSorted()).toEqual(retained.runs.slice(0, 2).map((run) => run.sessionID).toSorted())
        expect(released.toSorted()).toEqual(retained.runs.map((run) => run.sessionID).toSorted())
        expect(tickets.size).toBe(0)
        const active = yield* session.active
        expect(active.has(unrelated.id)).toBe(true)
        expect(active.has(retained.runs[1]!.sessionID)).toBe(false)
        expect(active.has(retained.runs[0]!.sessionID)).toBe(failure)
        yield* retained.host.release(retained.runs[0]!.binding)
        expect(interrupted).toHaveLength(2)
        expect((yield* retained.host.collect(retained.runs[0]!.binding)).status).toBe("denied")
        yield* session.interrupt(retained.runs[0]!.sessionID)
        yield* session.interrupt(unrelated.id)
      }).pipe(Effect.provide(locations.get(location)))
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
  } finally { await rm(root, { recursive: true, force: true }) }
})
