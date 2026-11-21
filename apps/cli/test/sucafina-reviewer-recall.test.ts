import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Catalog } from "@orchestra/core/catalog"
import { Database } from "@orchestra/core/database/database"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { LayerNodePlatform } from "@orchestra/core/effect/app-node-platform"
import { Host } from "@orchestra/core/host"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { ModelV2 } from "@orchestra/core/model"
import { AppProcess } from "@orchestra/core/process"
import { ProviderV2 } from "@orchestra/core/provider"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionSchema } from "@orchestra/core/session/schema"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { LLMClient, LLMEvent } from "@orchestra/llm"
import type { LLMClientShape, LLMRequest } from "@orchestra/llm"
import { Effect, Layer, Stream } from "effect"
import { ProductHost } from "../src/host.ts"
import { createSfHostRuntime } from "../src/sucafina-product/host-context.ts"
import { createSfBusinessServices } from "../src/sucafina-product/business-services.ts"
import { reviewerRecallSkill } from "../src/sucafina-product/reviewer-recall.ts"
import atlasPackage from "../../../modules/atlas/boundary/package.json" with { type: "json" }
import freeze from "../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { CaseLedgerEvent, DecisionCase } from "../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { CaseRecall } from "../../../modules/sucafina/Sucafinav1/product/contracts/outputs.ts"
import type { PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfStateResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { createResidentAiBundle } from "../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"
import type { TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { probeSfAtlasScanner } from "../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-scanner.ts"
import { createDashboardSourceIssuer } from "../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
import type { SfHumanAction } from "../../../modules/sucafina/Sucafinav1/product/integration/human-authority.ts"
import { enqueueSfLedgerEvent } from "../../../modules/sucafina/Sucafinav1/product/integration/ledger-outbox.ts"
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { object } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"

const origin = "https://reviewer.example.test"
const providerID = ProviderV2.ID.make("reviewer-fixture")
const modelID = ModelV2.ID.make("reviewer-fixture")
const operation = "sf_decision_recall"
const sourceRoot = path.resolve(import.meta.dir, "../../../modules/sucafina/Sucafinav1/product/ai")

function value<T>(result: PortResult<T> | SfStateResult<T>, step: string): T {
  if (result.status !== "ok") throw new Error(`${step}: ${result.status} (${"reason" in result ? result.reason : "unknown"})`)
  return result.value
}

test.skipIf(process.platform === "win32")("native sf_reviewer recalls a selected Atlas precedent and rejects other cases without writing business state", async () => {
  expectSpawn(import.meta.path)
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-reviewer-"))
  const store = await openLocalStore(path.join(root, "business"))
  const at = new Date().toISOString()
  const year = at.slice(0, 4)
  const period = { start: year + "-01-01", end: year + "-12-31" }
  const actors = new WeakMap<Request, string>()
  const request = (principal = "reviewer") => {
    const incoming = new Request(origin + "/sucafina/dashboard", { method: "POST", headers: { origin, "idempotency-key": randomUUID() } })
    actors.set(incoming, principal)
    return incoming
  }
  const toolInputs: { selected?: string; outside?: string } = {}
  let turns = 0
  // Only the provider response is scripted. The runner executes the real tool
  // and the test separately reads and verifies its recorded native receipt.
  const llm = Layer.succeed(LLMClient.Service, LLMClient.Service.of({
    prepare: () => Effect.die("unused provider prepare"),
    generate: () => Effect.die("unexpected provider generate"),
    stream: ((incoming: LLMRequest) => {
      turns++
      if (turns === 1) {
        expect(incoming.tools.some((tool) => tool.name === operation)).toBe(true)
        return Stream.make(LLMEvent.stepStart({ index: 0 }), ...Object.entries(toolInputs).map(([id, ref]) => LLMEvent.toolCall({
          id, name: operation, input: { selectionRefs: [ref], similarityCriteria: ["decision-type"], period, limit: 5 },
        })), LLMEvent.stepFinish({ index: 0, reason: "tool-calls" }), LLMEvent.finish({ reason: "tool-calls" }))
      }
      const prompt = incoming.messages.flatMap((message) => message.content.flatMap((part) => {
        if (part.type !== "text" || !part.text.trimStart().startsWith("{")) return []
        const candidate = object(JSON.parse(part.text))
        return Object.hasOwn(candidate, "skillInput") ? [candidate] : []
      }))[0]
      const canonical = object(object(object(prompt?.context).decisionRecall).result)
      const matches = canonical.matches as CaseRecall["matches"]
      expect(matches).toHaveLength(1)
      return Stream.make(LLMEvent.stepStart({ index: 0 }), LLMEvent.textStart({ id: "recall" }), LLMEvent.textDelta({ id: "recall", text: JSON.stringify({
        kind: "CaseRecall", payload: canonical, evidenceRefs: matches.flatMap((match) => match.evidenceRefs),
      }) }), LLMEvent.textEnd({ id: "recall" }), LLMEvent.stepFinish({ index: 0, reason: "stop" }), LLMEvent.finish({ reason: "stop" }))
    }) as unknown as LLMClientShape["stream"],
  }))
  try {
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "january", ownerId: "owner", year: Number(year), month: 1, budget: 200, actual: 0 }]
      snapshot.data.capexProjects = []
      snapshot.data.capexEntries = []
      return { commit: true, value: undefined }
    })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const runtime = await createSfHostRuntime({
      installationId: "reviewer-recall", directory: root, sourceRoot, origin, mount: "/sucafina", authMode: "local-operator", persistence,
      authenticate: async (incoming, scope) => {
        const principal = actors.get(incoming)
        return principal && scope ? { id: principal, canWrite: true, roles: [{ surface: scope.surface, role: "admin" }] } : null
      },
      environment: async () => ({ at, id: randomUUID, directory: [] }),
      grants: ["reviewer", "other"].map((principalRef) => ({ principalRef, namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
        operations: ["sf_dashboard_read", "sf_case_draft", "sf_case_read", operation], humanActions: ["analysis.prepare", "analysis.start", "analysis.read"] })),
    })
    const merged = Host.merge([...ProductHost.contributions(), ...runtime.contributions])
    const layer = AppNodeBuilder.build(LayerNode.group([...merged.nodes, AppProcess.node, SessionV2.node, SessionExecution.node, LocationServiceMap.node]),
      [[SessionExecution.node, SessionExecutionLocal.node], ...merged.replacements, [Database.node, Database.layerFromPath(":memory:")],
        [LayerNodePlatform.llmClient, llm]], merged.locationNodes)
    await Effect.gen(function* () {
      const sessions = yield* SessionV2.Service
      const locations = yield* LocationServiceMap.Service
      const process = yield* AppProcess.Service
      const identity = runtime.identity()
      const services = runtime.services?.()
      if (!identity || !services?.analyses || !services.analysisInputs) throw new Error("Local SF host unavailable")
      yield* Effect.gen(function* () {
        const catalog = yield* Catalog.Service
        yield* catalog.transform((draft) => {
          draft.model.update(providerID, modelID, (model) => {
            model.api = { type: "aisdk", id: modelID, package: "@ai-sdk/openai", url: "http://127.0.0.1:1/v1" }
            model.limit = { context: 64_000, output: 4_000 }
            model.capabilities = { tools: true, input: ["text"], output: ["text"] }
          })
        })
      }).pipe(Effect.provide(locations.get(identity.location)))

      yield* Effect.promise(async () => {
        const analyses = services.analyses!
        const selected = services.selected.find((entry) => entry.profile.id === "sf_reviewer")!
        const skill = selected.skills.find((entry) => entry.id === reviewerRecallSkill)!
        const business = createSfBusinessServices({ authority: services, persistence, proposalCoverageWrites: new WeakSet() })
        try {
          const scanner = await probeSfAtlasScanner(process)
          if (!scanner) throw new Error("Atlas scanner unavailable")
          const bundle = await createResidentAiBundle({ root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json") })
          business.initializeAtlas(scanner, { boundaryVersion: atlasPackage.version, schemaVersion: freeze.canonicalSha256,
            manifestVersion: selected.manifestDigest, skillVersion: digestSfValue(bundle.skills
              .map((entry) => ({ id: entry.id, version: entry.version, sourceDigest: entry.sourceDigest }))) })
          const ui = async <T>(operationId: string, payload: unknown, work: (call: TrustedUiContext) => Promise<T>, principal = "reviewer") => {
            const digest = digestSfValue(payload)
            const call = value(await services.ui.admit(request(principal), operationId, digest), operationId)
            try {
              if (!await services.ui.validate(call, operationId, digest)) throw new Error("UI intent was not admitted")
              return await work(call)
            } finally { services.ui.finish(call) }
          }
          const human = async <T>(action: SfHumanAction, payload: unknown, work: (call: TrustedUiContext) => Promise<T>, principal = "reviewer") => {
            const call = value(await services.human.admit(request(principal), action, payload), action)
            try { return await work(call) } finally { services.human.finish(call) }
          }
          const issue = createDashboardSourceIssuer({ host: business.host, scopedSources: persistence })
          const dashboard = { page: "Budget Overview", fields: ["budgetSeries"], period }
          const source = value(await ui("sf_dashboard_read", dashboard, (call) => issue(dashboard, call)), "budget source").evidence
          const draft = async (objective: string, principal = "reviewer") => {
            const evidence = principal === "reviewer" ? source : value(await ui("sf_dashboard_read", dashboard, (call) => issue(dashboard, call), principal), "other source").evidence
            const payload = { objective, horizon: period, currency: "USD", criteria: ["Review budget"], sourceRefs: [evidence] }
            return value(await ui("sf_case_draft", payload, (call) => business.cases.draft(payload, call), principal), objective)
          }
          const ref = (entry: DecisionCase) => ({ id: entry.id, incarnation: entry.incarnation, version: entry.version })
          const current = ref(await draft("Current review"))
          const previous = await draft("Previous authorized review")
          const outside = ref(await draft("Unselected review"))
          const other = ref(await draft("Another principal's review", "other"))
          const precedent = { ...ref(previous), version: previous.version + 1 }
          const ledger: CaseLedgerEvent = { id: randomUUID(), caseRef: precedent, kind: "reconsideration-accepted", principalRef: "reviewer", at,
            consideredActions: ["Review budget"], factualGaps: [], lifecycleState: "investigating", rationale: "Preserve the observed budget",
            evidenceRefs: [source], outputDigest: digestSfValue(source) }
          const sourceRequest = request()
          const before = value(await services.state.read(sourceRequest, "cases", (state) => ({ cases: state.versions.cases, outbox: state.versions.outbox })), "ledger revisions")
          const staged = value(await services.state.transaction(sourceRequest, { namespace: "cases", expectedStorageVersion: before.cases,
            additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: before.outbox }], targetRef: previous.id, targetIncarnation: previous.incarnation,
            idempotencyKey: ledger.id, commandDigest: digestSfValue(ledger) }, async (state, actor) => {
            state.cases[previous.id] = { ...previous, version: precedent.version, state: "investigating", ledger: [ledger] }
            return { commit: true, value: value(enqueueSfLedgerEvent(state, ledger, { installationId: identity.installationId,
              projectId: identity.projectId, authority: actor }), "canonical ledger outbox") }
          }), "persist ledger fixture")
          const payload = { caseRef: encodeCaseRef(precedent) }
          const archived = await ui("sf_case_read", payload, (call) => business.context.emitFromLedger(staged.eventRef, call))
          if (archived.status !== "committed") throw new Error(`Archive fixture: ${archived.status} (${archived.reason ?? "unknown"})`)
          const analysis = { caseRef: current, objective: "Read the authorized precedent", profileId: selected.profile.id,
            profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest,
            outputSchemaVersion: "sf-contribution-v1" as const, requestedOperationScope: [operation] }
          const prepare = (candidate: typeof precedent, principal = "reviewer") => {
            const input = { request: analysis, selection: { currentCase: current, query: analysis.objective,
              recallScope: { cases: [candidate], period, includeHistorical: true } } }
            return human("analysis.prepare", input, (call) => services.analysisInputs!.prepare(call, input), principal)
          }
          expect((await prepare(ref(previous))).status).not.toBe("ok")
          expect((await prepare(other)).status).not.toBe("ok")
          expect((await prepare(precedent, "other")).status).not.toBe("ok")
          const skillInput = value(await prepare(precedent), "prepare authorized precedent")
          const businessDigest = async () => digestSfValue(value(await services.state.read(request(), "cases", (state) =>
            ({ cases: state.cases, atlas: state.atlas, outbox: state.outbox })), "business snapshot"))
          const initial = await businessDigest()
          toolInputs.selected = encodeCaseRef(precedent)
          toolInputs.outside = encodeCaseRef(outside)
          const start = { request: analysis, skillInput, model: { providerID, id: modelID } }
          const { runRef } = value(await human("analysis.start", start, (call) => analyses.start(call, start)), "start reviewer")
          const progress = () => human("analysis.read", { runRef }, (call) => analyses.read(call, runRef))
          const deadline = Date.now() + 75_000
          let run = value(await progress(), "read reviewer")
          while (["queued", "running", "preparing"].includes(run.state) && Date.now() < deadline) {
            await Bun.sleep(100)
            run = value(await progress(), "poll reviewer")
          }
          if (run.state !== "ready" || !run.native) throw new Error(`Reviewer ended as ${run.state} (${run.reason ?? "unknown"}) after ${turns} provider turns`)
          const messages = await Effect.runPromise(sessions.messages({ sessionID: SessionSchema.ID.make(run.native.sessionID) }))
          const calls = messages.flatMap((message) => message.type === "assistant" ? message.content.flatMap((part) =>
            part.type === "tool" && part.state.status === "completed" ? [object(part.state.structured)] : []) : [])
          expect(calls).toHaveLength(2)
          const accepted = calls.find((call) => call.status === "ok")
          expect(accepted?.receipt).toMatchObject({ kind: "native", operation, handlerExport: "recallSfDecisions", nativeSessionId: run.native.sessionID })
          expect(object(accepted?.result).matches).toEqual([expect.objectContaining({ caseRef: precedent,
            evidenceRefs: expect.arrayContaining([source]), memoryRecordRef: archived.eventId })])
          expect(calls.find((call) => call.status === "unavailable")).toHaveProperty("reason", "unavailable")
          const output = value(await human("analysis.read", { runRef }, (call) => analyses.output(call, runRef)), "read verified contribution")
          expect(output).toMatchObject({ kind: "CaseRecall", state: "ready", evidenceRefs: expect.arrayContaining([source]),
            runProvenance: expect.objectContaining({ profileId: "sf_reviewer", nativeSessionId: run.native.sessionID }) })
          expect(await businessDigest()).toBe(initial)
        } finally { business.dispose() }
      })
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
  } finally {
    await store.dispose()
    await rm(root, { recursive: true, force: true })
  }
}, 180_000)
