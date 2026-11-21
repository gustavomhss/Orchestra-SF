import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Catalog } from "@orchestra/core/catalog"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
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
import { Effect, Layer } from "effect"
import { FetchHttpClient } from "effect/unstable/http"
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
import type { SfHumanAction } from "../../../modules/sucafina/Sucafinav1/product/integration/human-authority.ts"
import { enqueueSfLedgerEvent } from "../../../modules/sucafina/Sucafinav1/product/integration/ledger-outbox.ts"
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { object } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { initialProcurementSettings } from "../../../modules/sucafina/Sucafinav1/src/initial-settings.ts"

const origin = "https://reviewer.example.test"
const providerID = ProviderV2.ID.make("reviewer-fixture")
const modelID = ModelV2.ID.make("reviewer-fixture")
const operation = "sf_decision_recall"
const sourceRoot = path.resolve(import.meta.dir, "../../../modules/sucafina/Sucafinav1/product/ai")

function value<T>(result: PortResult<T> | SfStateResult<T>, step: string): T {
  if (result.status !== "ok") throw new Error(`${step}: ${result.status} (${"reason" in result ? result.reason : "unknown"})`)
  return result.value
}

async function step<T>(label: string, timeoutMs: number, run: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const abort = new AbortController()
  const start = performance.now()
  console.info(`SF_REVIEWER_PROOF ${label} started`)
  const timer = setTimeout(() => abort.abort(new Error(`SF_REVIEWER_PROOF ${label} exceeded ${timeoutMs}ms`)), timeoutMs)
  try {
    const expired = new Promise<never>((_, reject) => abort.signal.addEventListener("abort", () => reject(abort.signal.reason), { once: true }))
    const result = await Promise.race([run(abort.signal), expired])
    console.info(`SF_REVIEWER_PROOF ${label} completed in ${Math.round(performance.now() - start)}ms`)
    return result
  } finally { clearTimeout(timer) }
}

test.skipIf(process.platform === "win32")("native sf_reviewer recalls a selected Atlas precedent and rejects other cases without writing business state", async () => {
  expectSpawn(import.meta.path)
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-reviewer-"))
  const store = await openLocalStore(path.join(root, "business"))
  const at = new Date().toISOString()
  const year = at.slice(0, 4)
  const period = { start: year + "-01-01", end: year + "-12-31" }
  const actors = new WeakMap<Request, string>()
  const revoked = new Set<string>()
  const request = (principal = "reviewer", signal?: AbortSignal) => {
    const incoming = new Request(origin + "/sucafina/procurement", { method: "POST", signal, headers: { origin, "idempotency-key": randomUUID() } })
    actors.set(incoming, principal)
    return incoming
  }
  const toolInputs: { selected?: string; outside?: string } = {}
  let turns = 0
  let tokenCounts = 0
  // Replay the provider wire only. C15 still counts, persists a receipt and
  // authorizes the actual tool call through the full product host.
  const replayFetch = (async (incoming: RequestInfo | URL, init?: RequestInit) => {
    const request = new Request(incoming, init)
    if (new URL(request.url).origin !== "https://api.openai.com") return fetch(incoming, init)
    if (request.url === "https://api.openai.com/v1/responses/input_tokens") {
      tokenCounts++
      console.info(`SF_REVIEWER_PROOF token count ${tokenCounts}`)
      return Response.json({ object: "response.input_tokens", input_tokens: 120 })
    }
    expect(request.url).toBe("https://api.openai.com/v1/responses")
    const payload = object(await request.json())
    turns++
    console.info(`SF_REVIEWER_PROOF model turn ${turns}`)
    const toolCalls = () => {
      expect(Array.isArray(payload.tools) && payload.tools.some((tool) => object(tool).name === operation)).toBe(true)
      return Object.entries(toolInputs).map(([id, ref]) => ({ type: "response.output_item.done", item: {
        type: "function_call", id: "item-" + id, call_id: "call-" + id, name: operation,
        arguments: JSON.stringify({ selectionRefs: [ref], similarityCriteria: ["decision-type"], period, limit: 5 }),
      } }))
    }
    const finalText = () => {
      const messages = Array.isArray(payload.input) ? payload.input : []
      const prompt = messages.flatMap((message) => {
        const content = object(message).content
        return (Array.isArray(content) ? content : []).flatMap((part) => {
          const text = object(part).text
          if (typeof text !== "string" || !text.trimStart().startsWith("{")) return []
          const candidate = object(JSON.parse(text))
          return Object.hasOwn(candidate, "skillInput") ? [candidate] : []
        })
      })[0]
      const canonical = object(object(object(prompt?.context).decisionRecall).result)
      const matches = canonical.matches as CaseRecall["matches"]
      expect(matches).toHaveLength(1)
      return [{ type: "response.output_text.delta", item_id: "reviewer-answer", delta: JSON.stringify({
        kind: "CaseRecall", payload: canonical, evidenceRefs: matches.flatMap((match) => match.evidenceRefs),
      }) }]
    }
    const events = [...(turns === 1 ? toolCalls() : finalText()), { type: "response.completed", response: {} }]
    const wire = events.map((event) => "data: " + JSON.stringify(event) + "\n\n").join("")
    return new Response(wire, { headers: { "content-type": "text/event-stream" } })
  }) as typeof fetch
  try {
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const purchasers = [{ principal: "reviewer", number: "PR-1" }, { principal: "other", number: "PR-2" }]
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: Object.fromEntries(purchasers.map(({ principal, number }) => [number, {
        request: { number, createdBy: principal, status: "draft", pr: { title: `Requisition ${number}`, justification: "Recorded need", estAmount: 100 },
          history: [], attachments: [] }, version: 0, by: principal,
      }])), suppliers: [], settings: initialProcurementSettings(), issued: { pr: purchasers.map((buyer) => buyer.number), po: [] } }
      for (const buyer of purchasers) snapshot.versions[`requests:${buyer.number}`] = { version: 0, by: buyer.principal }
      return { commit: true, value: undefined }
    })
    const runtime = await createSfHostRuntime({
      installationId: "reviewer-recall", directory: root, sourceRoot, origin, mount: "/sucafina", authMode: "local-operator", persistence,
      authenticate: async (incoming, scope) => {
        const principal = actors.get(incoming)
        return principal && scope && !revoked.has(principal) ? { id: principal, canWrite: true,
          roles: [{ surface: scope.surface, role: scope.surface === "procurement" ? "requester" : "admin" }] } : null
      },
      environment: async () => ({ at, id: randomUUID, directory: purchasers.map((buyer) => ({ id: buyer.principal, name: buyer.principal })) }),
      grants: ["reviewer", "other"].map((principalRef) => ({ principalRef, namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
        operations: ["sf_work_list", "sf_request_read", "sf_case_draft", "sf_case_read", operation], humanActions: ["analysis.prepare", "analysis.start", "analysis.read"] })),
    })
    const merged = Host.merge([...ProductHost.contributions(), ...runtime.contributions])
    const layer = AppNodeBuilder.build(LayerNode.group([...merged.nodes, AppProcess.node, SessionV2.node, SessionExecution.node, LocationServiceMap.node]),
      [[SessionExecution.node, SessionExecutionLocal.node], ...merged.replacements], merged.locationNodes)
      .pipe(Layer.provideMerge(Layer.succeed(FetchHttpClient.Fetch, replayFetch)))
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
            model.api = { type: "aisdk", id: modelID, package: "@ai-sdk/openai", url: "https://api.openai.com/v1" }
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
          const human = async <T>(action: SfHumanAction, payload: unknown, work: (call: TrustedUiContext) => Promise<T>, principal = "reviewer", signal?: AbortSignal) => {
            const call = value(await services.human.admit(request(principal, signal), action, payload), action)
            try { return await work(call) } finally { services.human.finish(call) }
          }
          const issueSource = async (buyer: typeof purchasers[number]) => {
            await ui("sf_work_list", { purpose: "work-selection", period }, async (call) => {
              value(await services.procurementSelections!.create(call, period), "select period in the host")
              value(await business.procurementSelections.create(call, period), "select period for fixture seeding")
            }, buyer.principal)
            return ui("sf_request_read", { request: buyer.number }, async (call) => {
              const issued = value(await business.individual.issue("procurement-request", buyer.number, call), "issue request source")
              return value(await business.individual.resolve(issued, call), "read request source").evidence
            }, buyer.principal)
          }
          const source = await issueSource(purchasers[0]!)
          const otherSource = await issueSource(purchasers[1]!)
          const draft = async (objective: string, principal = "reviewer") => {
            const evidence = principal === "reviewer" ? source : otherSource
            const payload = { objective, horizon: period, currency: "USD", criteria: ["Review the requisition"], sourceRefs: [evidence] }
            return value(await ui("sf_case_draft", payload, (call) => business.cases.draft(payload, call), principal), objective)
          }
          const ref = (entry: DecisionCase) => ({ id: entry.id, incarnation: entry.incarnation, version: entry.version })
          const current = ref(await draft("Current review"))
          const previous = await draft("Previous authorized review")
          const outside = ref(await draft("Unselected review"))
          const other = ref(await draft("Another principal's review", "other"))
          const precedent = { ...ref(previous), version: previous.version + 1 }
          const ledger: CaseLedgerEvent = { id: randomUUID(), caseRef: precedent, kind: "reconsideration-accepted", principalRef: "reviewer", at,
            consideredActions: ["Review the requisition"], factualGaps: [], lifecycleState: "investigating", rationale: "Preserve the recorded estimate",
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
          const prepare = (candidate: typeof precedent, principal = "reviewer", signal?: AbortSignal) => {
            const input = { request: analysis, selection: { currentCase: current, query: analysis.objective,
              recallScope: { cases: [candidate], period, includeHistorical: true } } }
            return human("analysis.prepare", input, (call) => services.analysisInputs!.prepare(call, input), principal, signal)
          }
          expect((await prepare(ref(previous))).status).not.toBe("ok")
          expect((await prepare(other)).status).not.toBe("ok")
          expect((await prepare(precedent, "other")).status).not.toBe("ok")
          const skillInput = value(await step("prepare authorized precedent", 25_000, (signal) => prepare(precedent, "reviewer", signal)), "prepare authorized precedent")
          const businessDigest = async () => {
            const product = value(await services.state.read(request(), "cases", (state) =>
              ({ cases: state.cases, atlas: state.atlas, outbox: state.outbox })), "business snapshot")
            const surfaces = await store.transactionAll!(async (snapshots) => ({ commit: false,
              value: Object.values(snapshots).map((snapshot) => Object.fromEntries(Object.entries(snapshot.data).filter(([key]) => key !== "__sfProductV1"))) }))
            return digestSfValue({ product, surfaces })
          }
          const initial = await step("snapshot business state", 10_000, businessDigest)
          toolInputs.selected = encodeCaseRef(precedent)
          toolInputs.outside = encodeCaseRef(outside)
          const start = { request: analysis, skillInput, model: { providerID, id: modelID } }
          revoked.add("reviewer")
          try {
            const denied = await step("deny a revoked reviewer", 8_000, (signal) => services.human.admit(request("reviewer", signal), "analysis.start", start))
            if (denied.status === "ok") services.human.finish(denied.value)
            expect(denied.status).toBe("denied")
          } finally { revoked.delete("reviewer") }
          const { runRef } = value(await step("start reviewer runner", 30_000, (signal) =>
            human("analysis.start", start, (call) => analyses.start(call, start), "reviewer", signal)), "start reviewer")
          const run = await step("reviewer runner and tool result", 45_000, async (signal) => {
            const progress = () => human("analysis.read", { runRef }, (call) => analyses.read(call, runRef), "reviewer", signal)
            let current = value(await progress(), "read reviewer")
            while (["queued", "running", "preparing"].includes(current.state) && !signal.aborted) {
              await Bun.sleep(200)
              current = value(await progress(), "poll reviewer")
            }
            return current
          })
          if (run.state !== "ready" || !run.native) throw new Error(`Reviewer ended as ${run.state} (${run.reason ?? "unknown"}) after ${turns} provider turns`)
          const sessionID = SessionSchema.ID.make(run.native.sessionID)
          const messages = await step("read the native tool receipts", 8_000, (signal) => Effect.runPromise(sessions.messages({ sessionID }), { signal }))
          const calls = messages.flatMap((message) => message.type === "assistant" ? message.content.flatMap((part) =>
            part.type === "tool" && part.state.status === "completed" ? [object(part.state.structured)] : []) : [])
          expect(calls).toHaveLength(2)
          const accepted = calls.find((call) => call.status === "ok")
          expect(accepted?.receipt).toMatchObject({ kind: "native", operation, handlerExport: "recallSfDecisions", nativeSessionId: run.native.sessionID })
          expect(object(accepted?.result).matches).toEqual([expect.objectContaining({ caseRef: precedent,
            evidenceRefs: expect.arrayContaining([source]), memoryRecordRef: archived.eventId })])
          expect(calls.find((call) => call.status === "unavailable")).toHaveProperty("reason", "unavailable")
          const output = value(await step("read verified contribution", 10_000, (signal) =>
            human("analysis.read", { runRef }, (call) => analyses.output(call, runRef), "reviewer", signal)), "read verified contribution")
          expect(output).toMatchObject({ kind: "CaseRecall", state: "ready", evidenceRefs: expect.arrayContaining([source]),
            runProvenance: expect.objectContaining({ profileId: "sf_reviewer", nativeSessionId: run.native.sessionID }) })
          expect(tokenCounts).toBe(2)
          expect(await step("verify business state", 10_000, businessDigest)).toBe(initial)
        } finally { business.dispose() }
      })
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
  } finally {
    await step("cleanup", 8_000, async () => {
      await store.dispose()
      await rm(root, { recursive: true, force: true })
    })
  }
}, 180_000)
