import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Catalog } from "@orchestra/core/catalog"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Host } from "@orchestra/core/host"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import type { ModelV2 } from "@orchestra/core/model"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionRunnerModel } from "@orchestra/core/session/runner/model"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import { ProductHost } from "../../../../../../apps/cli/src/host.ts"
import { createSfHostRuntime } from "../../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import atlasPackage from "../../../../../../modules/atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import type { SfProductGrant } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { handleSfAnalysis } from "../../../product/interface/analysis-http.ts"
import { object } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

type AnalysisInput = Parameters<NonNullable<SfHostServices["analyses"]>["start"]>[1]
type SourcePersistence = ReturnType<typeof createSfSourcePersistence>

export type Wp12NativeMissionContext = {
  services: SfHostServices
  session: SessionV2.Interface
  persistence: SourcePersistence
  business: ReturnType<typeof createSfBusinessServices>
  models: readonly ModelV2.Ref[]
  catalogState: "available" | "empty" | "unsupported"
  origin: string
  principalRef: string
  at: string
  request: (body?: unknown, route?: string) => Request
  human: <T>(action: SfHumanAction, payload: unknown, work: (call: TrustedUiContext) => Promise<T>) => Promise<T>
  ui: <T>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<T>) => Promise<T>
}

/** Only domain fixtures and the private Request authenticator are supplied by a
 * driver. Sessions, source issuance, catalog resolution, receipts, inference and
 * output persistence all come from the production host. No provider is installed. */
export async function withWp12NativeMissionHost<T>(options: {
  label: string
  operations: readonly string[]
  humanActions?: readonly SfHumanAction[]
  namespaces?: SfProductGrant["namespaces"]
  initialize: (persistence: SourcePersistence) => Promise<void>
}, work: (harness: {
  open: <R>(phase: "initial" | "reopened", work: (context: Wp12NativeMissionContext) => Promise<R>) => Promise<R>
}) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), `sf-wp12-${options.label}-`))
  await chmod(directory, 0o700)
  const sourceRoot = path.resolve(import.meta.dir, "../../../product/ai")
  const origin = "https://wp12-native-missions.example.test"
  const principalRef = `wp12-synthetic-${options.label}-principal`
  const admittedRequests = new WeakSet<Request>()
  const at = new Date().toISOString()
  const request = (body?: unknown, route = "/sucafina/planner?sf=analysis") => {
    const value = new Request(new URL(route, origin), { method: "POST",
      headers: { origin, "content-type": "application/json", "idempotency-key": randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    admittedRequests.add(value)
    return value
  }
  const open = async <R>(phase: "initial" | "reopened", action: (context: Wp12NativeMissionContext) => Promise<R>): Promise<R> => {
    const driver = await openLocalStore(path.join(directory, "business"))
    try {
      const persistence = createSfSourcePersistence({ persistence: driver, createId: randomUUID,
        enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
      if (phase === "initial") {
        for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
        await options.initialize(persistence)
      }
      const runtime = await createSfHostRuntime({ installationId: `wp12-native-${options.label}-installation`, directory: sourceRoot, sourceRoot,
        origin, mount: "/sucafina", persistence,
        authenticate: async (incoming, context) => admittedRequests.has(incoming) && context
          ? { id: principalRef, canWrite: true, roles: [{ surface: context.surface, role: context.surface === "planner" ? "finance" : "admin" }] } : null,
        environment: async () => ({ at, id: randomUUID, directory: [{ id: principalRef, name: "Explicit synthetic native mission principal" }] }),
        grants: [{ principalRef, namespaces: options.namespaces ?? ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas"],
          operations: [...options.operations], humanActions: [...(options.humanActions ?? ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel"])] }],
      })
      const merged = Host.merge([...ProductHost.contributions(), ...runtime.contributions])
      const layer = AppNodeBuilder.build(LayerNode.group([...merged.nodes, SessionV2.node, SessionExecution.node, LocationServiceMap.node]),
        [[SessionExecution.node, SessionExecutionLocal.node], ...merged.replacements], merged.locationNodes)
      return await Effect.gen(function* () {
        const session = yield* SessionV2.Service
        const locations = yield* LocationServiceMap.Service
        const identity = runtime.identity()
        const services = runtime.services?.()
        if (!identity || !services) throw new Error("Native mission host did not publish its own identity and services")
        const observation = yield* Effect.gen(function* () {
          const catalog = yield* Catalog.Service
          const available = yield* catalog.model.available()
          const preferred = yield* catalog.model.default()
          // Prefer an installed Responses-compatible model, without hiding other
          // runner-supported models from the real C15 transport gate.
          const supported = available.filter(SessionRunnerModel.supported).toSorted((left, right) =>
            2 * Number(right.api.type === "aisdk" && right.api.package === "@ai-sdk/openai") +
            Number(right.providerID === preferred?.providerID && right.id === preferred?.id) -
            2 * Number(left.api.type === "aisdk" && left.api.package === "@ai-sdk/openai") -
            Number(left.providerID === preferred?.providerID && left.id === preferred?.id))
            .map((model) => ({ providerID: model.providerID, id: model.id }))
          return { available: available.map((model) => ({ providerID: model.providerID, id: model.id,
            supported: SessionRunnerModel.supported(model) })), supported }
        }).pipe(Effect.provide(locations.get(identity.location)))
        const published = (yield* Effect.promise(() => services.models())).map((model) => ({ providerID: model.providerID, id: model.id }))
        const models = observation.supported.filter((candidate) => published.some((model) => model.providerID === candidate.providerID && model.id === candidate.id))
        const mismatch = observation.supported.length > 0 && models.length === 0
        const catalogState = models.length > 0 ? "available" : observation.available.length === 0 ? "empty" : "unsupported"
        console.log("SF_WP12_NATIVE_MISSION_CATALOG:" + JSON.stringify({ label: options.label, phase, scope: "host-installed-catalog",
          githubSha: process.env.GITHUB_SHA ?? null, state: mismatch ? "mismatch" : catalogState,
          available: observation.available, supported: observation.supported, published, intersection: models }))
        if (mismatch) throw new Error("Native mission catalog has supported models absent from published host services")
        const business = createSfBusinessServices({ authority: services, persistence, proposalCoverageWrites: new WeakSet<object>() })
        const selected = services.selected[0]
        const skill = selected?.skills[0]
        if (!selected || !skill) throw new Error("Native mission host published no resident selections")
        business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
          manifestVersion: selected.manifestDigest, skillVersion: skill.version })
        const human = async <V>(humanAction: SfHumanAction, payload: unknown, invoke: (call: TrustedUiContext) => Promise<V>): Promise<V> => {
          const admitted = await services.human.admit(request(), humanAction, payload)
          if (admitted.status !== "ok") throw new Error(`Native mission human admission failed: ${admitted.reason}`)
          try { return await invoke(admitted.value) } finally { services.human.finish(admitted.value) }
        }
        const ui = async <V>(operation: string, payload: unknown, invoke: (call: TrustedUiContext) => Promise<V>): Promise<V> => {
          const digest = digestSfValue(payload)
          const admitted = await services.ui.admit(request(), operation, digest)
          if (admitted.status !== "ok") throw new Error(`Native mission UI admission failed: ${admitted.reason}`)
          try {
            if (!await services.ui.validate(admitted.value, operation, digest)) throw new Error("Native mission UI intent was refused")
            return await invoke(admitted.value)
          } finally { services.ui.finish(admitted.value) }
        }
        return yield* Effect.promise(() => action({ services, session, persistence, business, models, catalogState,
          origin, principalRef, at, request, human, ui }).finally(() => business.dispose()))
      }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
    } finally { await driver.dispose() }
  }
  try { return await work({ open }) } finally { await rm(directory, { recursive: true, force: true }) }
}

export function observeWp12UnavailableMission(context: Wp12NativeMissionContext, input: Pick<AnalysisInput, "request" | "skillInput">) {
  if (context.models.length) throw new Error("An available installed model cannot be recorded as unavailable")
  console.log("SF_WP12_NATIVE_MISSION:" + JSON.stringify({ scope: "real-host-input-preparation-and-availability", status: "unavailable",
    reason: context.catalogState === "empty" ? "installed-host-catalog-empty" : "installed-host-catalog-has-no-supported-model",
    catalogState: context.catalogState, githubSha: process.env.GITHUB_SHA ?? null, profileId: input.request.profileId,
    skillId: input.request.skillId, caseRef: input.request.caseRef, inputPrepared: true, inputDigest: digestSfValue(input.skillInput),
    inferenceExecuted: false, outputRef: null, consumerRef: null, gnativeAccepted: false }))
}

/** Call expectSpawn(import.meta.path) in the caller's test before this function.
 * Every non-ready outcome on an available model is a failure, never an empty-catalog observation. */
export async function executeWp12NativeMission(context: Wp12NativeMissionContext, incoming: Pick<AnalysisInput, "request" | "skillInput"> & {
  expectedKind: ContributionEnvelope["kind"]
  requiredTools: readonly { operation: string; handlerExport?: string }[]
  authorAnalysis?: { runRef: string; outputDigest: string }
}) {
  const analyses = context.services.analyses
  const model = context.models[0]
  if (!analyses || !model) throw new Error("Native mission execution requires real analysis services and an installed model")
  const selected = context.services.selected.find((entry) => entry.profile.id === incoming.request.profileId)
  const skill = selected?.skills.find((entry) => entry.id === incoming.request.skillId)
  if (!selected || !skill) throw new Error("Native mission selection is not published by the host")
  const input = { request: incoming.request, skillInput: incoming.skillInput, model,
    ...(incoming.authorAnalysis ? { authorAnalysis: incoming.authorAnalysis } : {}) }
  const started = await context.human("analysis.start", input, (call) => analyses.start(call, input))
  if (started.status !== "ok") throw new Error(`Native mission admission failed for ${skill.id}: ${started.reason}`)
  const runRef = started.value.runRef
  const deadline = Date.now() + 150_000
  const read = () => context.human("analysis.read", { runRef }, (call) => analyses.read(call, runRef))
  let run = await read()
  while (run.status === "ok" && ["preparing", "queued", "running"].includes(run.value.state) && Date.now() < deadline) {
    await new Promise<void>((resolve) => setTimeout(resolve, 250))
    run = await read()
  }
  console.log("SF_WP12_NATIVE_MISSION_RUN:" + JSON.stringify({ skillId: skill.id, runRef, githubSha: process.env.GITHUB_SHA ?? null,
    state: run.status === "ok" ? run.value.state : run.status, nativeSessionId: run.status === "ok" ? run.value.native?.sessionID ?? null : null }))
  if (run.status !== "ok" || run.value.state !== "ready" || !run.value.native) throw new Error(`Native mission ${skill.id} did not reach ready through the installed provider`)
  const native = run.value.native
  const output = await context.human("analysis.read", { runRef }, (call) => analyses.output(call, runRef))
  if (output.status !== "ok" || output.value.state !== "ready" || output.value.kind !== incoming.expectedKind) throw new Error(`Native mission ${skill.id} did not publish its required contribution kind`)
  expect(output.value.caseRef).toEqual(incoming.request.caseRef)
  expect(output.value.runProvenance.nativeSessionId).toBe(native.sessionID)
  expect(output.value.runProvenance.runId).toBe(runRef)
  expect(output.value.runProvenance.profileId).toBe(selected.profile.id)
  expect(output.value.runProvenance.profileDigest).toBe(selected.profile.sourceDigest)
  expect(output.value.runProvenance.sourceDigest).toBe(skill.sourceDigest)
  expect(output.value.runProvenance.instructionsDigest).toBe(skill.instructionsDigest)
  expect(output.value.runProvenance.actualModel).toBe(`${model.providerID}/${model.id}`)
  const messages = await Effect.runPromise(context.session.messages({ sessionID: SessionSchema.ID.make(native.sessionID) }))
  expect(messages.find((message) => message.id === native.skillReceipt.loadedMessageId)?.type).toBe("synthetic")
  const assistants = messages.flatMap((message) => message.type === "assistant" && !!message.time.completed && !message.error ? [message] : [])
  expect(assistants.length).toBeGreaterThan(0)
  const tools = assistants.flatMap((message) => message.content.flatMap((part) => {
    if (part.type !== "tool" || part.state.status !== "completed") return []
    const receipt = object(part.state.structured.receipt)
    return part.state.structured.status === "ok" && receipt.kind === "native" && receipt.operation === part.name &&
      receipt.runId === runRef && receipt.nativeSessionId === native.sessionID && receipt.principalRef === context.principalRef && receipt.callId === part.id
      ? [{ operation: part.name, handlerExport: receipt.handlerExport, toolCallId: part.id }] : []
  }))
  for (const required of incoming.requiredTools) expect(tools.some((tool) => tool.operation === required.operation &&
    (required.handlerExport === undefined || tool.handlerExport === required.handlerExport))).toBe(true)
  return { runRef, caseRef: incoming.request.caseRef, inputDigest: digestSfValue(incoming.skillInput), output: output.value,
    receipt: native.skillReceipt, actualModel: output.value.runProvenance.actualModel,
    contextFingerprint: output.value.runProvenance.contextFingerprint, accessRevision: output.value.accessRevision,
    toolCallIds: tools.map((tool) => tool.toolCallId), tools }
}

export type Wp12CompletedNativeMission = Awaited<ReturnType<typeof executeWp12NativeMission>>

/** The real HTTP consumer renders the durable contribution after a fresh host
 * opens the same store. Domain-specific consumers and assertions remain in each driver. */
export async function readWp12NativeMissionAfterReload(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission) {
  const response = await handleSfAnalysis(context.request({ action: "output", runRef: completed.runRef }), context.origin, context.services)
  const body = object(await response.json())
  const value = object(body.value)
  expect(response.status).toBe(200)
  expect(body.status).toBe("ok")
  expect(value.outputRef).toBe(completed.output.id)
  if (typeof value.html !== "string" || !value.html.length) throw new Error("Native mission contribution was not rendered after reload")
  const output = await context.human("analysis.read", { runRef: completed.runRef }, (call) => context.services.analyses!.output(call, completed.runRef))
  if (output.status !== "ok" || output.value.state !== "ready") throw new Error("Native mission persisted output was not readable after reload")
  expect(output.value.outputDigest).toBe(completed.output.outputDigest)
  expect(digestSfValue(output.value)).toBe(digestSfValue(completed.output))
  console.log("SF_WP12_NATIVE_MISSION:" + JSON.stringify({ scope: "one-skill-native-execution-and-reopened-http-consumer", status: "consumed",
    githubSha: process.env.GITHUB_SHA ?? null, identityKind: "explicit-synthetic-authentication-harness",
    profileId: completed.receipt.profileId, skillId: completed.receipt.skillId, runRef: completed.runRef,
    caseRef: completed.caseRef, inputDigest: completed.inputDigest, outputRef: completed.output.id, outputDigest: completed.output.outputDigest,
    receipt: completed.receipt, actualModel: completed.actualModel, toolCallIds: completed.toolCallIds,
    consumerRef: "handleSfAnalysis:output", consumerObservedAction: "reopened-host-rendered-persisted-output",
    inferenceExecuted: true, allEighteenSkillsAccepted: false, independentGnativeReview: false }))
  return { html: value.html, output: output.value }
}
