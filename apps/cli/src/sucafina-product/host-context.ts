import { randomUUID } from "node:crypto"
import path from "node:path"
import { makeGlobalNode } from "@orchestra/core/effect/app-node"
import { ProjectV2 } from "@orchestra/core/project"
import { AbsolutePath } from "@orchestra/core/schema"
import { Effect, Layer } from "effect"
import { Catalog } from "@orchestra/core/catalog"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { Mcp } from "@orchestra/core/mcp"
import { SessionStore } from "@orchestra/core/session/store"
import { SessionMessage } from "@orchestra/core/session/message"
import { ClaudeCodeHost } from "@orchestra/engine-claude-code/v2/host"
import { createResidentAiBundle } from "../../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CreateSfHostRuntime, SfHostRuntime, SfHostServices } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfNativeEvidenceStore } from "../../../../modules/sucafina/Sucafinav1/product/integration/native-evidence.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { validSfSelection, sfSourceFor } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/resident-agents.ts"
import { createDashboardPort } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/port.ts"
import { createDashboardSourceHost } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/sources.ts"
import { createDashboardCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/capabilities.ts"
import { createSfProductContribution, createSfProductDispatch } from "./contribution.ts"
import { createSfTokenGate } from "./token-gate.ts"
import { createSfNativeHostContribution } from "./native-host.ts"
import type { SfNativeHostApi, SfLoadedSkillObservation } from "./native-host.ts"
import type { SfNativeAdmission, SfSelectedRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/runtime.ts"

/** Resolves placement in the application's existing graph before it accepts HTTP. No second Session coordinator. */
export const createSfHostRuntime: CreateSfHostRuntime = async (input) => {
  if (!input.installationId.trim() || !path.isAbsolute(input.directory) || path.resolve(input.directory) !== input.directory) throw new Error("SF_HOST_PLACEMENT_INVALID")
  const directory = AbsolutePath.make(input.directory)
  const bundle = await createResidentAiBundle({ root: input.sourceRoot, manifestPath: path.join(input.sourceRoot, "manifests/resident.json") })
  const selected = bundle.profiles.map((profile) => ({ profile, manifestDigest: bundle.manifestDigest,
    skills: bundle.skills.filter((skill) => profile.allowedSkills.includes(skill.id)), operationIds: profile.allowedOperations }))
  const state: { identity?: ReturnType<SfHostRuntime["identity"]>; store?: SessionStore.Interface; api?: SfNativeHostApi;
    models?: SfHostServices["models"]; configuration?: string; generation: number } = { generation: 0 }
  const requests = new Map<string, Request>()
  const observed = new Map<string, { value: SfLoadedSkillObservation; digest: string }>()
  const identity = () => state.identity
  const selectionMatches = (value: SfSelectedRuntime) => validSfSelection(value) && selected.some((parent) =>
    parent.manifestDigest === value.manifestDigest && digestSfValue(parent.profile) === digestSfValue(value.profile) &&
    value.skills.every((skill) => parent.skills.some((allowed) => digestSfValue(allowed) === digestSfValue(skill))) &&
    value.operationIds.every((operation) => parent.operationIds.includes(operation)))
  const authority = createSfProductAuthority({ ...input, identity, policyVersion: "sf-product-v1", grants: input.grants ?? [], createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation, digest) => {
      if (request.method === "GET" || request.method === "HEAD") return randomUUID()
      const key = request.headers.get("Idempotency-Key")
      return key && /^[A-Za-z0-9._:-]{8,128}$/.test(key) ? digestSfValue({ operation, key }) : undefined
    },
    inspectSession: async (id) => state.store ? Effect.runPromise(state.store.get(id)) : undefined,
    verifySelection: async (value) => selectionMatches(value),
    verifySkillReceipt: async (admission) => {
      const proof = observed.get(admission.sessionID)
      const receipt = admission.skillReceipts[0]
      if (!state.store || !proof || !receipt || admission.skillReceipts.length !== 1 || proof.value.admission.request !== admission.request ||
        proof.digest !== admissionDigest(admission) || !sfSourceFor(proof.value.sourceCapability, proof.value.skills, admission.selected)) return false
      const skill = await Effect.runPromise(proof.value.skills.get(receipt.skillId))
      const message = await Effect.runPromise(state.store.message(SessionMessage.ID.make(receipt.loadedMessageId)))
      return !!skill && message?.sessionID === admission.sessionID && message.message.type === "synthetic" &&
        message.message.text.startsWith(`<skill_content name="${skill.name}">\n# Skill: ${skill.name}\n\n${skill.content.trim()}\n\n`) &&
        new Bun.CryptoHasher("sha256").update(await Bun.file(skill.location).arrayBuffer()).digest("hex") === receipt.sourceDigest &&
        new Bun.CryptoHasher("sha256").update(skill.content.trim()).digest("hex") === receipt.instructionsDigest
    },
    providerGeneration: async () => await state.models?.() ? state.generation : undefined,
    // Document authority is supplied only after its asset/catalog adapter is composed.
    authorizeDocument: async () => undefined,
  })
  const evidence = createSfNativeEvidenceStore({ state: authority.state, nativeEvidenceWrites: authority.nativeEvidenceWrites,
    persistence: input.persistence, createId: randomUUID, requestForRun: (id) => requests.get(id),
    authorizeRun: async (reservation, expected) => {
      const request = requests.get(reservation.runId)
      if (!request) return false
      const result = await authority.state.read(request, "contributions", (stored, current) => {
        const run = stored.nativeRuns?.[reservation.runId]
        return digestSfValue(current) === digestSfValue(expected) && run?.state === "preparing" &&
          run.selection.profile.id === reservation.profileId && run.selection.manifestDigest === reservation.manifestDigest &&
          digestSfValue(run.caseRef) === digestSfValue(reservation.caseRef)
      })
      return result.status === "ok" && result.value
    },
    authorizeBinding: async (binding) => {
      const proof = observed.get(binding.nativeSessionId)
      return !!proof && authority.authorizeNative(proof.value.admission, binding)
    },
  })
  const gate = createSfTokenGate({ upstream: ClaudeCodeHost.node, isSfOwned: (id) => Effect.tryPromise(() => evidence.isSfOwned(id)) })
  const native = createSfNativeHostContribution({ registry: authority.native,
    onReady: (api) => { state.api = api; return () => { if (state.api === api) state.api = undefined } },
    onSkillLoaded: (value) => {
      if (!identity() || observed.has(value.session.id) || !selectionMatches(value.admission.selected)) throw new Error("SF_SKILL_OBSERVATION_INVALID")
      const proof = { value, digest: admissionDigest(value.admission) }
      observed.set(value.session.id, proof)
      return () => { if (observed.get(value.session.id) === proof) observed.delete(value.session.id) }
    },
    admit: (request) => Effect.tryPromise(async () => {
      if (!identity() || requests.get(request.runId) !== request.request || !selectionMatches(request.selected)) return false
      const result = await authority.state.read(request.request, "contributions", (stored, actor) => {
        const run = stored.nativeRuns?.[request.runId]
        const reserved = Object.entries(stored.preferences).some(([key, value]) => key.startsWith("sf:native-session:") && object(object(value).reservation).runId === request.runId)
        return !reserved && run?.state === "preparing" && !run.native && run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision &&
          digestSfValue(run.selection) === digestSfValue(request.selected) && digestSfValue(run.model) === digestSfValue(request.model) &&
          digestSfValue(run.caseRef) === digestSfValue(request.caseRef) && run.skillId === request.skillId &&
          digestSfValue(request.location) === digestSfValue(identity()?.location)
      })
      return result.status === "ok" && result.value
    }),
    authorize: (admission, binding) => Effect.tryPromise(() => authority.authorizeNative(admission, binding)),
    budget: { gate, reserveSession: (reservation) => Effect.tryPromise(() => evidence.reserveSession(reservation)),
      persistReceipt: (binding, receipt) => Effect.tryPromise(() => evidence.persistTokenReceipt(binding, receipt)) },
  })
  const dashboard = createDashboardPort({ host: authority.host, sources: createDashboardSourceHost({ host: authority.host, scopedSources: input.persistence }) })
  const descriptors = createDashboardCapabilities(dashboard, async (context, operation, digest, result) => authority.authority.receiptFor(context, operation, digest, result))
  const product = createSfProductContribution({ registry: authority.native, authority: authority.authority, selected, source: bundle.source,
    descriptors, onRegistered: native.onRegistered })
  const node = makeGlobalNode({
    name: "sucafina/host-context",
    deps: [ProjectV2.node, SessionStore.node, LocationServiceMap.node],
    layer: Layer.effectDiscard(Effect.gen(function* () {
      const projects = yield* ProjectV2.Service
      const store = yield* SessionStore.Service
      const locations = yield* LocationServiceMap.Service
      const project = yield* projects.resolve(directory)
      const identity = Object.freeze({ installationId: input.installationId, hostId: randomUUID(), projectId: project.id,
        location: Object.freeze({ directory }) })
      state.identity = identity
      state.store = store
      state.models = async () => {
        const data = await Effect.runPromise(Effect.gen(function* () {
          const catalog = yield* Catalog.Service
          const mcp = yield* Mcp.Service
          return { models: yield* catalog.model.available(), servers: yield* mcp.list() }
        }).pipe(Effect.provide(locations.get(identity.location)))).catch(() => undefined)
        if (!data || state.identity !== identity) throw new Error("SF_CATALOG_UNAVAILABLE")
        // Public metadata only; credentials, provider headers and endpoint configuration remain opaque.
        const digest = digestSfValue({ models: data.models.map((model) => ({ providerID: model.providerID, id: model.id,
          api: { id: model.api.id, type: model.api.type }, variants: model.variants.map((variant) => variant.id).toSorted(), limit: model.limit }))
          .toSorted((left, right) => `${left.providerID}:${left.id}`.localeCompare(`${right.providerID}:${right.id}`)),
          servers: data.servers.toSorted((left, right) => left.name.localeCompare(right.name)) })
        if (state.configuration !== digest) { state.configuration = digest; state.generation += 1 }
        return data.models.map((model) => ({ providerID: model.providerID, id: model.id }))
      }
      yield* Effect.addFinalizer(() => Effect.sync(() => {
        if (state.identity !== identity) return
        state.identity = undefined; state.store = undefined; state.models = undefined; requests.clear(); observed.clear()
      }))
    })),
  })
  const services: SfHostServices = { ...authority, selected, dispatch: createSfProductDispatch({ descriptors, authority: authority.authority }), models: async () => state.models ? state.models() : [], sessions: {
    prepare: async (request) => {
      if (!state.api || !identity()) return { status: "unavailable", reason: "native-host-unavailable" }
      if (requests.has(request.runId)) return { status: "conflict", reason: "native-run-already-admitted" }
      requests.set(request.runId, request.request)
      request.request.signal.addEventListener("abort", () => { if (requests.get(request.runId) === request.request) requests.delete(request.runId) }, { once: true })
      return Effect.runPromise(state.api.prepare(request), { signal: request.request.signal })
    },
    execute: (binding) => state.api ? Effect.runPromise(state.api.execute(binding), { signal: requests.get(binding.runId)?.signal }) : Promise.resolve({ status: "unavailable", reason: "native-host-unavailable" }),
    collect: (binding) => state.api ? Effect.runPromise(state.api.collect(binding)) : Promise.resolve({ status: "unavailable", reason: "native-host-unavailable" }),
    interrupt: (binding) => state.api ? Effect.runPromise(state.api.interrupt(binding)) : Promise.resolve({ status: "unavailable", reason: "native-host-unavailable" }),
  } }
  return { identity, services: () => identity() ? services : undefined,
    contributions: [{ id: "sucafina-host-context", nodes: [node] }, gate.contribution, native.contribution, product] }
}

function admissionDigest(admission: SfNativeAdmission) {
  return digestSfValue({ ...admission, request: undefined })
}
