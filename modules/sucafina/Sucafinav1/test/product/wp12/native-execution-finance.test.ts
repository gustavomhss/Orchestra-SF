import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Catalog } from "@orchestra/core/catalog"
import { AppNodeBuilder } from "@orchestra/core/effect/app-node-builder"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Host } from "@orchestra/core/host"
import { LocationServiceMap } from "@orchestra/core/location-service-map"
import { SessionV2 } from "@orchestra/core/session"
import { SessionExecution } from "@orchestra/core/session/execution"
import { SessionExecutionLocal } from "@orchestra/core/session/execution/local"
import { SessionRunnerModel } from "@orchestra/core/session/runner/model"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { ModelV2 } from "@orchestra/core/model"
import { Effect } from "effect"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { ProductHost } from "../../../../../../apps/cli/src/host.ts"
import { createSfHostRuntime } from "../../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import atlasPackage from "../../../../../../modules/atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfSkillInput } from "../../../product/contracts/schema-admission.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { handleSfAnalysis } from "../../../product/interface/analysis-http.ts"
import { object } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { executeWp12NativeMission, observeWp12UnavailableMission, readWp12NativeMissionAfterReload, withWp12NativeMissionHost } from "./native-mission-harness.ts"
import { assertWp12ChangedImportBaseRefused, assertWp12ImportCaseUnchanged, initializeWp12ImportPlanner, prepareWp12ImportCase, wp12InstalledImportAssets, WP12_IMPORT_PERIOD } from "./native-import-preparation.ts"

// Only the domain data and this private Request authenticator are synthetic.
// Host/project identities, Session, C15 admission, MCP calls, model completion,
// contribution persistence and the reopened HTTP consumer use product services.
// A provider is never registered by this test. The available branch uses the
// installed catalog and fails on every non-ready native execution outcome.
test("configured Finance executes through the real host and its persisted contribution opens after reload", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp12-native-finance-"))
  await chmod(directory, 0o700)
  const sourceRoot = path.resolve(import.meta.dir, "../../../product/ai")
  const origin = "https://wp12-native-proof.example.test"
  const principalRef = "wp12-synthetic-finance-principal"
  const admittedRequests = new WeakSet<Request>()
  const at = new Date().toISOString()
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const request = (body?: unknown) => {
    const value = new Request(`${origin}/sucafina/planner?sf=analysis`, { method: "POST",
      headers: { origin, "content-type": "application/json", "idempotency-key": randomUUID() },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
    admittedRequests.add(value)
    return value
  }
  const human = async <T>(services: SfHostServices, action: SfHumanAction, payload: unknown,
    work: (call: TrustedUiContext) => Promise<T>) => {
    const admitted = await services.human.admit(request(), action, payload)
    if (admitted.status !== "ok") throw new Error(`Native Finance human admission failed: ${admitted.reason}`)
    try { return await work(admitted.value) } finally { services.human.finish(admitted.value) }
  }
  const ui = async <T>(services: SfHostServices, operation: string, payload: unknown,
    work: (call: TrustedUiContext) => Promise<T>) => {
    const digest = digestSfValue(payload)
    const admitted = await services.ui.admit(request(), operation, digest)
    if (admitted.status !== "ok") throw new Error(`Native Finance UI admission failed: ${admitted.reason}`)
    try {
      if (!await services.ui.validate(admitted.value, operation, digest)) throw new Error("Native Finance UI intent was refused")
      return await work(admitted.value)
    } finally { services.ui.finish(admitted.value) }
  }
  const host = async <T>(driver: Awaited<ReturnType<typeof openLocalStore>>, initialize: boolean,
    work: (services: SfHostServices, session: SessionV2.Interface, models: readonly ModelV2.Ref[],
      persistence: ReturnType<typeof createSfSourcePersistence>, catalogState: "available" | "empty" | "unsupported") => Promise<T>) => {
    const persistence = createSfSourcePersistence({ persistence: driver, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    if (initialize) {
      for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
      await persistence.transaction("planner", async (snapshot) => {
        snapshot.data = { versions: [120, 100].map((amount, index) => ({ id: `wp12-forecast-${index}`, name: `Synthetic forecast ${index}`,
          year: 2027, closed: 0, lines: [{ id: "wp12-service", name: "Synthetic service", ownerId: "wp12-owner", sec: "opex", el: "licenses", cur: "USD",
            b: Array(12).fill(120), a: Array(12).fill(null), f: Array(12).fill(amount) }],
          fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })),
          officials: { "2027": "wp12-forecast-0" }, entities: [], allocations: [], roster: [] }
        return { commit: true, value: undefined }
      })
    }
    const runtime = await createSfHostRuntime({ installationId: "wp12-native-proof-installation", directory: sourceRoot, sourceRoot,
      origin, mount: "/sucafina", persistence,
      authenticate: async (incoming, context) => admittedRequests.has(incoming) && context
        ? { id: principalRef, canWrite: true, roles: [{ surface: context.surface, role: context.surface === "planner" ? "finance" : "admin" }] } : null,
      environment: async () => ({ at, id: randomUUID, directory: [{ id: principalRef, name: "Explicit synthetic native proof principal" }] }),
      grants: [{ principalRef, namespaces: ["cases", "preferences", "documents", "contributions", "receipts", "outbox", "atlas"],
        operations: ["sf_case_draft", "sf_case_read", "sf_forecast_compare", "sf_context_get", "sf_source_get", "sf_evidence_get", "sf_freshness_check"],
        humanActions: ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel"] }],
    })
    const merged = Host.merge([...ProductHost.contributions(), ...runtime.contributions])
    const layer = AppNodeBuilder.build(LayerNode.group([...merged.nodes, SessionV2.node, SessionExecution.node, LocationServiceMap.node]),
      [[SessionExecution.node, SessionExecutionLocal.node], ...merged.replacements], merged.locationNodes)
    return Effect.gen(function* () {
      const session = yield* SessionV2.Service
      const locations = yield* LocationServiceMap.Service
      const identity = runtime.identity()
      const services = runtime.services?.()
      if (!identity || !services) throw new Error("Native Finance host did not publish its own identity and services")
      const catalogObservation = yield* Effect.gen(function* () {
        const catalog = yield* Catalog.Service
        const available = yield* catalog.model.available()
        const preferred = yield* catalog.model.default()
        // C15 currently admits only the Responses HTTP transport. Prefer an
        // existing compatible catalog model. Models unsupported by the native
        // runner remain an availability observation; a runner-supported model
        // with an incompatible C15 transport still reaches the real gate.
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
      const models = catalogObservation.supported.filter((candidate) => published.some((model) => model.providerID === candidate.providerID && model.id === candidate.id))
      const mismatch = catalogObservation.supported.length > 0 && models.length === 0
      const catalogState = models.length > 0 ? "available" : catalogObservation.available.length === 0 ? "empty" : "unsupported"
      console.log("SF_WP12_NATIVE_FINANCE_CATALOG:" + JSON.stringify({ scope: "host-installed-catalog", phase: initialize ? "initial" : "reopened",
        githubSha: process.env.GITHUB_SHA ?? null, state: mismatch ? "mismatch" : catalogState,
        available: catalogObservation.available, supported: catalogObservation.supported, published, intersection: models }))
      if (mismatch) throw new Error("Native Finance catalog has supported models absent from published host services")
      return yield* Effect.promise(() => work(services, session, models, persistence, catalogState))
    }).pipe(Effect.scoped, Effect.provide(layer), Effect.runPromise)
  }

  try {
    const first = await openLocalStore(path.join(directory, "business"))
    const completed = await host(first, true, async (services, session, models, persistence, catalogState) => {
      const selected = services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = selected?.skills.find((entry) => entry.id === "sf-explicar-forecast")
      if (!selected || !skill || !services.analysisInputs || !services.analyses) throw new Error("Native Finance published analysis services are incomplete")
      // These production domain services issue the actual source refs and draft
      // the persisted case under the already-composed host authority. They do
      // not supply outputs, native receipts, bindings or inference to the host.
      const business = createSfBusinessServices({ authority: services, persistence, proposalCoverageWrites: new WeakSet<object>() })
      business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256,
        manifestVersion: selected.manifestDigest, skillVersion: skill.version })
      const decision = await ui(services, "sf_case_draft", { purpose: "native-finance-source-selection" }, async (call) => {
        const base = await business.plannerProduct.issueSource("wp12-forecast-0", call)
        const candidate = await business.plannerProduct.issueSource("wp12-forecast-1", call)
        if (base.status !== "ok" || candidate.status !== "ok") throw new Error("Native Finance sources were refused by their real issuer")
        const draft = { objective: "Explique a mudança de forecast desta decisão. Leia as referências selecionadas com sf_source_get e invoque sf_forecast_compare. Preserve o resultado canônico no FinancialAnalysis, sem inventar causalidade.",
          horizon: period, currency: "USD", criteria: ["A comparação deve reconciliar as fontes atuais em USD"], sourceRefs: [base.value.evidence, candidate.value.evidence] }
        return ui(services, "sf_case_draft", draft, (create) => business.cases.draft(draft, create))
      }).finally(() => business.dispose())
      if (decision.status !== "ok") throw new Error(`Native Finance case creation failed: ${decision.reason}`)
      const caseRef = { id: decision.value.id, incarnation: decision.value.incarnation, version: decision.value.version }
      const incoming = { request: { caseRef, objective: decision.value.objective, profileId: selected.profile.id,
        profileVersion: selected.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest,
        outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: ["sf_forecast_compare", "sf_source_get"] },
        selection: { caseRef, baseRef: decision.value.sourceRefs[0]!.refId, candidateRef: decision.value.sourceRefs[1]!.refId, period, currency: "USD" } }
      const prepared = await human(services, "analysis.prepare", incoming, (call) => services.analysisInputs!.prepare(call, incoming))
      if (prepared.status !== "ok") throw new Error(`Native Finance producer failed: ${prepared.reason}`)
      const decodedInput = decodeSfSkillInput("ForecastExplainInput", prepared.value)
      if (!decodedInput.ok) throw new Error("Native Finance producer returned an invalid skill input")
      expect(decodedInput.value.forecastComparison.knownDifference).toBe(-240)
      expect(decodedInput.value.selectedPeriod).toEqual(period)
      expect(decodedInput.value.currency).toBe("USD")
      expect(decodedInput.value.sourceRefs.length).toBeGreaterThan(0)
      const inputDigest = digestSfValue(prepared.value)
      console.log("SF_WP12_NATIVE_FINANCE_INPUT:" + JSON.stringify({ scope: "real-host-input-producer",
        githubSha: process.env.GITHUB_SHA ?? null, profileId: selected.profile.id, skillId: skill.id,
        caseRef, inputDigest, sourceRefIds: decodedInput.value.sourceRefs.map((source) => source.refId),
        knownDifference: decodedInput.value.forecastComparison.knownDifference, inferenceExecuted: false }))
      if (models.length === 0) {
        console.log("SF_WP12_NATIVE_FINANCE:" + JSON.stringify({ scope: "host-input-preparation-and-availability", status: "unavailable",
          reason: catalogState === "empty" ? "installed-host-catalog-empty" : "installed-host-catalog-has-no-supported-model",
          classification: "catalog-observation", catalogState, inputPrepared: true, inputDigest, caseRef,
          githubSha: process.env.GITHUB_SHA ?? null, candidates: [],
          inferenceExecuted: false, outputRef: null, consumerRef: null, gnativeAccepted: false }))
        return undefined
      }
      // The native execution branch must spawn through the runner. Input
      // preparation and empty-catalog observations start no provider turn.
      expectSpawn(import.meta.path)
      const input = { request: incoming.request, skillInput: prepared.value, model: models[0]! }
      const started = await human(services, "analysis.start", input, (call) => services.analyses!.start(call, input))
      if (started.status !== "ok") throw new Error(`Native Finance admission failed: ${started.reason}`)
      const runRef = started.value.runRef
      const deadline = Date.now() + 150_000
      const read = async () => human(services, "analysis.read", { runRef }, (call) => services.analyses!.read(call, runRef))
      let run = await read()
      while (run.status === "ok" && ["preparing", "queued", "running"].includes(run.value.state) && Date.now() < deadline) {
        await new Promise<void>((resolve) => setTimeout(resolve, 250))
        run = await read()
      }
      console.log("SF_WP12_NATIVE_FINANCE_RUN:" + JSON.stringify({ runRef, state: run.status === "ok" ? run.value.state : run.status,
        nativeSessionId: run.status === "ok" ? run.value.native?.sessionID ?? null : null, githubSha: process.env.GITHUB_SHA ?? null }))
      if (run.status !== "ok" || run.value.state !== "ready" || !run.value.native) throw new Error("Native Finance did not reach ready through the installed provider")
      const native = run.value.native
      const output = await human(services, "analysis.read", { runRef }, (call) => services.analyses!.output(call, runRef))
      if (output.status !== "ok" || output.value.kind !== "FinancialAnalysis" || output.value.state !== "ready") throw new Error("Native Finance contribution was not published")
      expect(output.value.payload.knownDifference).toBe(-240)
      expect(output.value.runProvenance.nativeSessionId).toBe(native.sessionID)
      expect(output.value.runProvenance.sourceDigest).toBe(skill.sourceDigest)
      expect(output.value.runProvenance.instructionsDigest).toBe(skill.instructionsDigest)
      expect(output.value.runProvenance.actualModel).toBe(`${models[0]!.providerID}/${models[0]!.id}`)
      const messages = await Effect.runPromise(session.messages({ sessionID: SessionSchema.ID.make(native.sessionID) }))
      expect(messages.find((message) => message.id === native.skillReceipt.loadedMessageId)?.type).toBe("synthetic")
      const assistants = messages.flatMap((message) => message.type === "assistant" && !!message.time.completed && !message.error ? [message] : [])
      expect(assistants.length).toBeGreaterThan(0)
      const calls = assistants.flatMap((message) => message.content.flatMap((part) => {
        if (part.type !== "tool" || part.state.status !== "completed") return []
        const receipt = object(part.state.structured.receipt)
        return part.state.structured.status === "ok" && receipt.kind === "native" && receipt.operation === part.name &&
          receipt.runId === runRef && receipt.nativeSessionId === native.sessionID && receipt.principalRef === principalRef && receipt.callId === part.id
          ? [{ operation: part.name, toolCallId: part.id, handlerExport: receipt.handlerExport }] : []
      }))
      expect(calls.some((call) => call.operation === "sf_forecast_compare" && call.handlerExport === "compareForecast")).toBe(true)
      expect(calls.some((call) => call.operation === "sf_source_get" && call.handlerExport === "resolveSfSource")).toBe(true)
      return { runRef, caseRef, inputDigest, outputRef: output.value.id, outputDigest: output.value.outputDigest,
        receipt: native.skillReceipt, actualModel: output.value.runProvenance.actualModel,
        contextFingerprint: output.value.runProvenance.contextFingerprint, accessRevision: output.value.accessRevision,
        toolCallIds: calls.map((call) => call.toolCallId), tools: calls }
    }).finally(() => first.dispose())
    if (!completed) return

    const reopened = await openLocalStore(path.join(directory, "business"))
    await host(reopened, false, async (services) => {
      const response = await handleSfAnalysis(request({ action: "output", runRef: completed.runRef }), origin, services)
      const body = object(await response.json())
      const value = object(body.value)
      expect(response.status).toBe(200)
      expect(body.status).toBe("ok")
      expect(value.outputRef).toBe(completed.outputRef)
      expect(typeof value.html).toBe("string")
      expect(typeof value.html === "string" && value.html.length > 0).toBe(true)
      const output = await human(services, "analysis.read", { runRef: completed.runRef }, (call) => services.analyses!.output(call, completed.runRef))
      if (output.status !== "ok") throw new Error("Native Finance persisted output was not readable after reload")
      expect(output.value.outputDigest).toBe(completed.outputDigest)
      console.log("SF_WP12_NATIVE_FINANCE:" + JSON.stringify({ scope: "one-finance-skill-native-execution-and-reopened-http-consumer",
        status: "consumed", githubSha: process.env.GITHUB_SHA ?? null, identityKind: "explicit-synthetic-authentication-harness",
        ...completed, consumerRef: "handleSfAnalysis:output", consumerObservedAction: "reopened-host-rendered-persisted-output",
        inferenceExecuted: true, allEighteenSkillsAccepted: false, independentGnativeReview: false }))
    }).finally(() => reopened.dispose())
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 240_000)

test("Finance reads a genuinely admitted import preview and retains its conditional analysis after reload", async () => {
  const assets = await wp12InstalledImportAssets("sf-explicar-forecast")
  if (!assets) return
  const objective = "Explique a comparação do arquivo selecionado com a versão de referência. Consulte o arquivo admitido com sf_import_preview usando importPreview, resolva as fontes selecionadas com sf_source_get e preserve a base, a proveniência e as limitações retornadas pelas portas. Produza FinancialAnalysis sem aplicar a importação nem alterar o domínio."
  await withWp12NativeMissionHost({ label: "finance-import", assets,
    operations: ["sf_case_draft", "sf_case_read", "sf_source_get", "sf_import_preview"],
    humanActions: ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel", "imports.admit"],
    initialize: initializeWp12ImportPlanner,
  }, async ({ open }) => {
    const completed = await open("initial", async (context) => {
      const selected = context.services.selected.find((entry) => entry.profile.id === "sf_finance")
      const skill = selected?.skills.find((entry) => entry.id === "sf-explicar-forecast")
      if (!selected || !skill || !context.services.analysisInputs || !context.services.productHttp)
        throw new Error("The real Finance import analysis services are missing")
      const prepared = await prepareWp12ImportCase(context, objective)
      const incoming = { request: { caseRef: prepared.caseRef, objective, profileId: selected.profile.id, profileVersion: selected.profile.version,
        skillId: skill.id, skillVersion: skill.version, manifestDigest: selected.manifestDigest, outputSchemaVersion: "sf-contribution-v1",
        requestedOperationScope: ["sf_import_preview", "sf_source_get"] },
        selection: { caseRef: prepared.caseRef, previewRef: prepared.previewRef, importRequest: prepared.importRequest,
          period: WP12_IMPORT_PERIOD, currency: "USD" } }
      const response = await context.services.productHttp(context.request({ action: "prepare", input: incoming }, "/sucafina/planner?sf=workbench-analysis"), "planner")
      if (!response) throw new Error("The real Finance import input route is missing")
      const body = object(await response.json())
      expect(response.status).toBe(200)
      expect(body.status).toBe("ok")
      const decoded = decodeSfSkillInput("ForecastExplainInput", body.value)
      if (!decoded.ok) throw new Error("The real import analysis producer failed the ForecastExplainInput contract")
      expect(decoded.value.importPreview).toEqual(prepared.importRequest)
      expect(decoded.value.sourceRefs).toEqual([prepared.sourceRef])
      expect(decoded.value.selectedPeriod).toEqual(WP12_IMPORT_PERIOD)
      expect(decoded.value.currency).toBe("USD")
      expect(decoded.value.forecastComparison.analysisBasis).toBe("import-preview")
      expect(decoded.value.forecastComparison.importPreviewRef).toBe(prepared.previewRef)
      expect(decoded.value.forecastComparison.domainApplied).toBe(false)
      expect(decoded.value.forecastComparison.knownDifference).toBe(-20)
      expect(decoded.value.forecastComparison.completeDifference).toBeNull()
      expect(decoded.value.forecastComparison.comparison?.comparisonStatus).toBe("conditioned")
      expect(decoded.value.forecastComparison.gaps).toContain("import-preview-not-applied")
      expect(decoded.value.forecastComparison.gaps).toContain("import-preview-coverage-unresolved")
      expect(decoded.value.forecastComparison.candidate.components.some((component) => component.evidenceState === "hypothetical")).toBe(true)
      const changed = { ...incoming, selection: { ...incoming.selection, importRequest: { ...prepared.importRequest, options: { headerRow: 2 } } } }
      const refused = await context.human("analysis.prepare", changed, (call) => context.services.analysisInputs!.prepare(call, changed))
      expect(refused.status).not.toBe("ok")
      const restored = await context.human("analysis.prepare", incoming, (call) => context.services.analysisInputs!.prepare(call, incoming))
      if (restored.status !== "ok") throw new Error("The authorized Finance import selection could not be restored")
      expect(digestSfValue(restored.value)).toBe(digestSfValue(decoded.value))
      await assertWp12ImportCaseUnchanged(context, prepared)
      console.log("SF_WP12_NATIVE_FINANCE_IMPORT_INPUT:" + JSON.stringify({ scope: "real-C04-preview-and-Planner-replay-input",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: prepared.caseRef, previewRef: prepared.previewRef,
        inputDigest: digestSfValue(decoded.value), analysisBasis: decoded.value.forecastComparison.analysisBasis,
        domainApplied: false, completeDifference: null, changedOptionsStatus: refused.status, inferenceExecuted: false, gnativeAccepted: false }))
      if (!context.models.length) {
        observeWp12UnavailableMission(context, { request: incoming.request, skillInput: restored.value })
        return { prepared, witness: undefined }
      }
      expectSpawn(import.meta.path)
      // An import preview reference is not a persisted Planner version selector.
      // The ordinary-domain mission separately witnesses sf_forecast_compare.
      const witness = await executeWp12NativeMission(context, { request: incoming.request, skillInput: restored.value,
        expectedKind: "FinancialAnalysis", requiredTools: [{ operation: "sf_import_preview", handlerExport: "previewImport" },
          { operation: "sf_source_get", handlerExport: "resolveSfSource" }] })
      if (witness.output.kind !== "FinancialAnalysis") throw new Error("The Finance import mission changed output kind")
      expect(witness.output.payload.analysisBasis).toBe("import-preview")
      expect(witness.output.payload.importPreviewRef).toBe(prepared.previewRef)
      expect(witness.output.payload.domainApplied).toBe(false)
      expect(witness.output.payload.knownDifference).toBe(-20)
      expect(witness.output.payload.completeDifference).toBeNull()
      expect(witness.output.payload.comparison?.comparisonStatus).toBe("conditioned")
      expect(witness.output.evidenceRefs).toEqual([prepared.sourceRef])
      await assertWp12ImportCaseUnchanged(context, prepared)
      return { prepared, witness }
    })
    await open("reopened", async (context) => {
      await assertWp12ImportCaseUnchanged(context, completed.prepared)
      console.log("SF_WP12_NATIVE_FINANCE_IMPORT_CONSUMER:" + JSON.stringify({ scope: "reopened-real-C04-reference-detail-and-case",
        githubSha: process.env.GITHUB_SHA ?? null, caseRef: completed.prepared.caseRef, previewRef: completed.prepared.previewRef,
        previewDigest: completed.prepared.consumer.digest, domainApplied: false, inferenceExecuted: !!completed.witness, gnativeAccepted: false }))
      if (completed.witness) {
        const consumed = await readWp12NativeMissionAfterReload(context, completed.witness)
        if (consumed.output.kind !== "FinancialAnalysis") throw new Error("The reopened Finance import contribution changed kind")
        expect(consumed.output.payload.analysisBasis).toBe("import-preview")
        expect(consumed.output.payload.importPreviewRef).toBe(completed.prepared.previewRef)
        expect(consumed.output.payload.completeDifference).toBeNull()
      }
      await assertWp12ChangedImportBaseRefused(context, completed.prepared, completed.witness?.runRef)
    })
  })
}, 300_000)
