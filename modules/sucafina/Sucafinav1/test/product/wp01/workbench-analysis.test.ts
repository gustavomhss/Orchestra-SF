import { expect, test } from "bun:test"
import path from "node:path"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { randomBytes, randomUUID } from "node:crypto"
import { createEmbeddedRoutes } from "../../../../../../packages/server/src/routes.ts"
import { Context, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { ProductHost } from "../../../../../../apps/cli/src/host.ts"
import { createSfHostRuntime } from "../../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { createSfAnalysisHttp } from "../../../../../../apps/cli/src/sucafina-product/analysis-http.ts"
import { createPlannerProduct } from "../../../product/planner/product.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { digestSfContribution, digestSfValue } from "../../../product/contracts/canonical.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { prepareReviewAnalysisInput } from "../../../product/interface/review-analysis-input.ts"
import { handleSfAnalysis } from "../../../product/interface/analysis-http.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { SfAnalysisRequest } from "../../../product/interface/analysis-input-port.ts"
import type { AuthorizedCaseProjection } from "../../../product/contracts/business-context.ts"
import type { ScenarioComparison, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfNativeRunRecord } from "../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"

test("Workbench analysis HTTP enforces human authority and hides forged run references", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-analysis-http-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "business"))
  const installationId = randomUUID()
  const operator = { installationId, uid: 1000, name: "Test operator" }
  const principalRef = `macos:${installationId}:${operator.uid}`
  let runtime: Awaited<ReturnType<typeof createSfHostRuntime>> | undefined
  let workbench: ReturnType<typeof createSfWorkbenchHttp> | undefined
  let identity: ReturnType<typeof createOperatorIdentity> | undefined
  let web: ReturnType<typeof HttpRouter.toWebHandler> | undefined
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => {
    const localAuth = await identity?.handle(request)
    if (localAuth) return localAuth
    if (new URL(request.url).pathname.startsWith("/api/")) return web?.handler(request, Context.makeUnsafe<unknown>(new Map())) ?? new Response(null, { status: 503 })
    return await runtime?.services?.()?.productHttp?.(request, "dashboard") ??
      await workbench?.(request, "dashboard") ?? new Response(null, { status: 404 })
  } })
  const origin = server.url.origin
  identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    // Business fixture data only. C06 issues its scope; the installed host must
    // resolve the resulting evidence before it can enter a case or skill input.
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "analysis-v0", name: "Renewal source", year: 2027, closed: 1,
        lines: [{ id: "renewal-line", name: "Licenses", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }]
      return { commit: true, value: undefined }
    })
    runtime = await createSfHostRuntime({ installationId, directory, sourceRoot: path.resolve(import.meta.dir, "../../../product/ai"), origin,
      mount: "/sucafina", persistence, authenticate: identity.authenticate,
      grants: [{ principalRef, namespaces: ["cases", "contributions", "preferences"], operations: ["sf_case_draft", "sf_case_read", "sf_source_get"], humanActions: ["analysis.prepare", "analysis.start", "analysis.read", "analysis.cancel"] }],
      environment: async () => ({ at: new Date().toISOString(), id: randomUUID, directory: [] }) })
    workbench = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => runtime?.services?.() })
    web = HttpRouter.toWebHandler(createEmbeddedRoutes({ host: [...ProductHost.contributions(), ...runtime.contributions] })
      .pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true, memoMap: Layer.makeMemoMapUnsafe() })

    const ready = new URL("/api/agent", origin)
    ready.searchParams.set("location[directory]", directory)
    expect((await fetch(ready)).status).toBe(200)
    const enrollment = await identity.enroll()
    const authenticated = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${enrollment}`))
    const cookie = authenticated?.headers.get("set-cookie")?.split(";")[0]
    expect(cookie).toBeTruthy()
    const post = (body: unknown, extraHeaders: Record<string, string> = {}) => fetch(`${origin}/sucafina/dashboard?sf=workbench-analysis`, {
      method: "POST", headers: { cookie: cookie ?? "", origin, "sec-fetch-site": "same-origin", "content-type": "application/json",
        "idempotency-key": randomUUID(), ...extraHeaders }, body: JSON.stringify(body),
    })

    const services = runtime.services?.()
    if (!services?.analysisInputs || !services.analyses || !services.productHttp) throw new Error("analysis host services unavailable after host startup")
    const { analysisInputs, analyses } = services
    expect(services.selected).toHaveLength(5)
    for (const selected of services.selected) {
      expect(selected.skills.length).toBeGreaterThan(0)
      expect(selected.operationIds.length).toBeGreaterThan(0)
      for (const operation of selected.operationIds) {
        expect(selected.profile.allowedOperations).toContain(operation)
        expect(selected.skills.some((skill) => skill.allowedOperations.includes(operation))).toBe(true)
      }
    }
    const unauthenticated = await fetch(`${origin}/sucafina/dashboard?sf=workbench-analysis`, { method: "POST",
      headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ action: "read", runRef: "sf-run-forged-reference" }) })
    expect(unauthenticated.status).toBe(403)
    const uninitialized = await post({ action: "read", runRef: "sf-run-forged-reference" })
    expect(uninitialized.status).toBe(503)
    expect(await uninitialized.json()).toEqual({ status: "unavailable" })
    // C06 source initialization does not create C08. Initialize through the real
    // authenticated state port before testing the missing-run authorization path.
    const stateRequest = new Request(`${origin}/sucafina/dashboard`, { method: "POST",
      headers: { cookie: cookie ?? "", origin, "sec-fetch-site": "same-origin", "idempotency-key": "analysis-c08-initialize" } })
    const initialized = await services.state.transaction(stateRequest, { namespace: "cases", expectedStorageVersion: 0,
      targetRef: services.creationTarget.ref, targetIncarnation: services.creationTarget.incarnation,
      idempotencyKey: "analysis-c08-initialize", commandDigest: digestSfValue({ purpose: "initialize-analysis-state" }) },
    async () => ({ commit: true, value: true }))
    expect(initialized.status).toBe("ok")
    expect((await post({ action: "read", runRef: "sf-run-forged-reference" })).status).toBe(403)
    const missingOutput = await post({ action: "output", runRef: "sf-run-forged-reference" })
    expect(missingOutput.status).toBe(503)
    expect(await missingOutput.json()).toEqual({ status: "unavailable" })
    const forgedList = await post({ action: "list", caseRef: { id: "missing", incarnation: "missing", version: 1 } })
    expect(forgedList.status).toBe(403)
    expect(await forgedList.text()).not.toContain("nativeSessionId")
    const cancel = await post({ action: "cancel", runRef: "sf-run-forged-reference" })
    expect(cancel.status).toBe(503)
    expect(await cancel.text()).not.toContain("nativeSessionId")

    const command = (operation: string, input: unknown) => fetch(`${origin}/sucafina/dashboard?sf=workbench-command`, {
      method: "POST", headers: { cookie: cookie ?? "", origin, "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ operation, input }),
    })
    // Source issuance uses a real UI admission and the canonical C06 issuer.
    // Coverage is outside this source-only fixture and must never be fabricated.
    const sourceProduct = createPlannerProduct({ host: services.host, scopedSources: persistence,
      coverageFor: async () => { throw new Error("Source issuance must not request fixture coverage") } })
    const sourceSelection = { versionId: "analysis-v0" }
    const sourceRequest = new Request(`${origin}/sucafina/planner`, { method: "POST",
      headers: { cookie: cookie ?? "", origin, "content-type": "application/json", "idempotency-key": randomUUID() } })
    const sourceAdmission = await services.ui.admit(sourceRequest, "sf_source_get", digestSfValue(sourceSelection))
    if (sourceAdmission.status !== "ok") throw new Error("Real source issuer admission unavailable")
    const source = await (async () => {
      try {
        expect(await services.ui.validate(sourceAdmission.value, "sf_source_get", digestSfValue(sourceSelection))).toBe(true)
        const issued = await sourceProduct.issueSource(sourceSelection.versionId, sourceAdmission.value)
        if (issued.status !== "ok") throw new Error(`Canonical Planner source unavailable: ${issued.reason}`)
        expect(issued.value.evidence.target).toMatchObject({ surface: "planner", recordType: "planner-version",
          recordId: sourceSelection.versionId, period: { start: "2027-01-01", end: "2027-12-31" } })
        return issued.value.evidence
      } finally { services.ui.finish(sourceAdmission.value) }
    })()
    expect(services.host.requestFor(sourceAdmission.value)).toBeUndefined()
    const draftInput = { objective: "Frame the current renewal", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost", "Coverage"], sourceRefs: [source] }
    const draft = await command("sf_case_draft", draftInput)
    expect(draft.status).toBe(200)
    const created = await draft.json()
    const projection = await (async () => {
      const payload = { caseRef: created.outputRef }
      const source = new Request(`${origin}/sucafina/dashboard?sf=workbench-case`, { headers: { cookie: cookie ?? "" } })
      const admitted = await services.ui.admit(source, "sf_case_read", digestSfValue(payload))
      if (admitted.status !== "ok") throw new Error("real case read was not authorized")
      try {
        const result = await services.dispatch("sf_case_read", payload, admitted.value)
        if (result.status !== "ok") throw new Error("real case read failed")
        const decoded = decodeSfOperationOutput("sf_case_read", result.result)
        if (!decoded.ok || !await services.ui.revalidate(admitted.value)) throw new Error("real case projection was rejected")
        return decoded.value
      } finally { services.ui.finish(admitted.value) }
    })()
    const currentCase = projection.case
    const intentRuntime = services.selected.find((item) => item.skills.some((skill) => skill.id === "sf-enquadrar-decisao"))
    const intentSkill = intentRuntime?.skills.find((skill) => skill.id === "sf-enquadrar-decisao")
    if (!intentRuntime || !intentSkill) throw new Error("intent skill must be registered")
    const intentRequest: SfAnalysisRequest = { caseRef: { id: currentCase.id, incarnation: currentCase.incarnation, version: currentCase.version },
      profileId: intentRuntime.profile.id, profileVersion: intentRuntime.profile.version, skillId: intentSkill.id, skillVersion: intentSkill.version,
      manifestDigest: intentRuntime.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: intentSkill.allowedOperations,
      objective: currentCase.objective }
    const intentPrepare = { action: "prepare", input: { request: intentRequest, selection: {} } }
    const framed = await post(intentPrepare)
    expect(framed.status).toBe(200)
    const framedBody = await framed.json()
    expect(currentCase.sourceRefs).toEqual([source])
    expect(framedBody).toEqual({ status: "ok", value: { intentText: currentCase.objective, case: intentRequest.caseRef,
      context: { surface: "planner", period: currentCase.horizon, currency: currentCase.currency, sourceRefs: [{
        surface: source.target.surface, type: source.target.recordType, id: source.target.recordId,
        incarnation: source.target.incarnation, version: source.target.version, fields: source.target.fields,
        period: source.target.period, observedAt: expect.any(String),
      }] }, selectedSourceRefs: currentCase.sourceRefs } })
    expect(Number.isFinite(Date.parse(framedBody.value.context.sourceRefs[0].observedAt))).toBe(true)
    const preparedSelections = await services.state.read(stateRequest, "preferences", (state) =>
      Object.entries(state.preferences).filter(([key]) => key.startsWith("sf:analysis-selection:")))
    if (preparedSelections.status !== "ok") throw new Error("Actual prepared selection unavailable")
    expect(preparedSelections.value).toHaveLength(1)
    expect(preparedSelections.value[0]![1]).toMatchObject({ request: intentRequest, selection: {},
      inputDigest: digestSfValue(framedBody.value) })
    const caseBeforeRefusals = await services.state.read(stateRequest, "cases", (state) => state.cases)
    if (caseBeforeRefusals.status !== "ok") throw new Error("Actual case state unavailable")
    const refused = async (body: unknown, status: number, value: { status: string; reason: string }) => {
      const response = await post(body)
      expect(response.status).toBe(status)
      expect(await response.json()).toEqual(value)
    }
    await refused({ ...intentPrepare, input: { ...intentPrepare.input, selection: { sourceRefs: ["forged"] } } },
      400, { status: "needs-input", reason: "invalid-analysis-input" })
    await refused({ ...intentPrepare, input: { ...intentPrepare.input, selection: { evidenceRefIds: [] } } },
      400, { status: "needs-input", reason: "intent-single-surface-period-selection-required" })
    await refused({ ...intentPrepare, input: { ...intentPrepare.input, selection: { evidenceRefIds: ["forged"] } } },
      503, { status: "unavailable", reason: "analysis-source-unavailable" })
    await refused({ ...intentPrepare, input: { ...intentPrepare.input, request: { ...intentRequest, caseRef: { ...intentRequest.caseRef, version: currentCase.version + 1 } } } },
      403, { status: "denied", reason: "case-selection-unavailable" })
    // Neither a read lease, a different preparation payload, nor a closed lease
    // may be reused as preparation authority in the installed producer.
    const authorityRequest = () => new Request(`${origin}/sucafina/dashboard?sf=workbench-analysis`, { method: "POST",
      headers: { cookie: cookie ?? "", origin, "content-type": "application/json", "idempotency-key": randomUUID() } })
    const readLease = await services.human.admit(authorityRequest(), "analysis.read", { runRef: "sf-run-forged-reference" })
    if (readLease.status !== "ok") throw new Error("Real read admission unavailable")
    try {
      expect(await analysisInputs.prepare(readLease.value, intentPrepare.input))
        .toEqual({ status: "denied", reason: "analysis-input-authority-unavailable" })
    } finally { services.human.finish(readLease.value) }
    const prepareLease = await services.human.admit(authorityRequest(), "analysis.prepare", intentPrepare.input)
    if (prepareLease.status !== "ok") throw new Error("Real preparation admission unavailable")
    try {
      expect(await services.human.authorize(prepareLease.value, "analysis.prepare", intentPrepare.input)).toBe(true)
      expect(await analysisInputs.prepare(prepareLease.value, { ...intentPrepare.input, selection: { evidenceRefIds: [source.refId] } }))
        .toEqual({ status: "denied", reason: "analysis-input-authority-unavailable" })
    } finally { services.human.finish(prepareLease.value) }
    expect(await analysisInputs.prepare(prepareLease.value, intentPrepare.input))
      .toEqual({ status: "denied", reason: "analysis-input-authority-unavailable" })
    expect(services.host.requestFor(readLease.value)).toBeUndefined()
    expect(services.host.requestFor(prepareLease.value)).toBeUndefined()
    const scenarioRuntime = services.selected.find((item) => item.skills.some((skill) => skill.id === "sf-comparar-cenarios"))
    const scenarioSkill = scenarioRuntime?.skills.find((skill) => skill.id === "sf-comparar-cenarios")
    if (!scenarioRuntime || !scenarioSkill) throw new Error("scenario skill must be registered")
    const scenarioRequest = { ...intentRequest, profileId: scenarioRuntime.profile.id, profileVersion: scenarioRuntime.profile.version,
      skillId: scenarioSkill.id, skillVersion: scenarioSkill.version, manifestDigest: scenarioRuntime.manifestDigest, requestedOperationScope: scenarioSkill.allowedOperations }
    const scenarioPrepare = { action: "prepare", input: { request: scenarioRequest, selection: { caseRef: scenarioRequest.caseRef,
      alternatives: [{ id: "missing-first", version: 1 }, { id: "missing-second", version: 1 }] } } }
    // A real empty case cannot acquire invented saved alternatives through selection.
    await refused(scenarioPrepare, 503, { status: "unavailable", reason: "scenario-alternative-unavailable" })
    expect((await post({ ...scenarioPrepare, input: { ...scenarioPrepare.input, selection: { ...scenarioPrepare.input.selection,
      alternatives: [{ id: "same", version: 1 }, { id: "same", version: 1 }] } } })).status).toBe(400)
    expect((await post({ ...scenarioPrepare, input: { ...scenarioPrepare.input, selection: { ...scenarioPrepare.input.selection,
      caseRef: { ...scenarioRequest.caseRef, id: "another-case" } } } })).status).toBe(400)
    const reviewer = services.selected.find((item) => item.profile.id === "sf_reviewer")
    const reviewSkill = reviewer?.skills.find((item) => item.id === "sf-contestar-decisao")
    if (!reviewer || !reviewSkill) throw new Error("independent reviewer must be registered")
    const reviewPrepare = { action: "prepare", input: { request: { ...intentRequest, profileId: reviewer.profile.id,
      profileVersion: reviewer.profile.version, skillId: reviewSkill.id, skillVersion: reviewSkill.version, manifestDigest: reviewer.manifestDigest,
      requestedOperationScope: reviewSkill.allowedOperations }, selection: { authorAnalysis: { runRef: "missing-author-run", outputDigest: "a".repeat(64) } } } }
    await refused(reviewPrepare, 400, { status: "needs-input", reason: "invalid-analysis-input" })
    expect((await post({ ...reviewPrepare, input: { ...reviewPrepare.input, selection: { ...reviewPrepare.input.selection,
      comparison: { fabricated: true } } } })).status).toBe(400)
    const model = (await services.models().catch(() => []))[0]
    const selection = services.selected.find((item) => item.skills.some((skill) => skill.id === "sf-explicar-forecast"))
    const skill = selection?.skills.find((item) => item.id === "sf-explicar-forecast")
    if (!selection || !skill) throw new Error("forecast skill must be registered for the boundary test")
    const prepare = { action: "prepare", input: {
      request: { caseRef: { id: "missing-case", incarnation: "missing-incarnation", version: 1 }, profileId: selection.profile.id,
        profileVersion: selection.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: selection.manifestDigest,
        outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations, objective: "Review forecast" },
      selection: {},
    } }
    await refused(prepare, 403, { status: "denied", reason: "case-selection-unavailable" })
    // Exercise the optional boundary with real authority and an intentionally invalid producer payload.
    // This checks schema/selection rejection; it is not a native analysis or producer witness.
    let prepareCalls = 0
    const boundary = createSfAnalysisHttp({ origin, mount: "/sucafina", runtime: () => ({ human: services.human,
      selected: services.selected, models: services.models, start: analyses.start,
      inputs: { prepare: async () => { prepareCalls++; return { status: "ok" as const, value: {} } } },
    }) })
    const historyBoundary = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
    const boundaryPost = async (body: unknown) => {
      const request = new Request(`${origin}/sucafina/dashboard?sf=workbench-analysis`, {
        method: "POST", headers: { cookie: cookie ?? "", origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify(body),
      })
      return await boundary(request, "dashboard") ?? await historyBoundary(request, "dashboard")
    }
    expect((await boundaryPost(prepare))?.status).toBe(503)
    expect(prepareCalls).toBe(1)
    expect((await boundaryPost({ ...prepare, input: { ...prepare.input, request: { ...prepare.input.request, manifestDigest: "forged" } } }))?.status).toBe(403)
    expect(prepareCalls).toBe(1)
    expect((await boundaryPost({ ...prepare, input: { ...prepare.input, request: { ...prepare.input.request, caseRef: { id: "", incarnation: "", version: -1 } } } }))?.status).toBe(400)
    expect((await boundaryPost({ action: "list", caseRef: { id: "", incarnation: "", version: -1 } }))?.status).toBe(400)
    if (model && selection && skill) {
      const start = await post({ action: "start", input: {
        request: { caseRef: { id: "missing-case", incarnation: "missing-incarnation", version: 1 }, profileId: selection.profile.id,
          profileVersion: selection.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: selection.manifestDigest,
          outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations, objective: "Review forecast" },
        skillInput: {}, model,
      } })
      expect(start.status).toBe(400)
    }



    const crossOrigin = await post({ action: "read", runRef: "sf-run-forged-reference" }, { origin: "https://other.example" })
    expect(crossOrigin.status).toBe(403)
    const crossSite = await post({ action: "read", runRef: "sf-run-forged-reference" }, { "sec-fetch-site": "cross-site" })
    expect(crossSite.status).toBe(403)
    const missingIdempotency = await post({ action: "read", runRef: "sf-run-forged-reference" }, { "idempotency-key": "" })
    expect(missingIdempotency.status).toBe(400)
    const unchanged = await services.state.read(stateRequest, "contributions", (state) => ({ runs: Object.keys(state.nativeRuns ?? {}), outputs: Object.keys(state.contributions) }))
    expect(unchanged.status === "ok" && unchanged.value).toEqual({ runs: [], outputs: [] })
    const selectionsAfter = await services.state.read(stateRequest, "preferences", (state) =>
      Object.entries(state.preferences).filter(([key]) => key.startsWith("sf:analysis-selection:")))
    expect(selectionsAfter.status === "ok" && selectionsAfter.value).toEqual(preparedSelections.value)
    const casesAfter = await services.state.read(stateRequest, "cases", (state) => state.cases)
    expect(casesAfter.status === "ok" && casesAfter.value).toEqual(caseBeforeRefusals.value)
    await identity.handle(new Request(`${origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: cookie ?? "", origin } }))
    expect((await post(intentPrepare)).status).toBe(403)
  } finally {
    await web?.dispose()
    await server.stop(true)
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)

test("Workbench analysis returns unavailable when its host services are absent", async () => {
  const request = new Request("http://localhost/sucafina/dashboard?sf=workbench-analysis", { method: "POST",
    headers: { origin: "http://localhost", "sec-fetch-site": "same-origin", "content-type": "application/json", "idempotency-key": "workbench-absent-1" },
    body: JSON.stringify({ action: "read", runRef: "sf-run-any" }) })
  const handler = createSfWorkbenchHttp({ origin: "http://localhost", mount: "/sucafina", runtime: () => undefined })
  expect((await handler(request, "dashboard"))?.status).toBe(503)
})

type ReviewFixtureMode = "valid" | "financial" | "read-denied" | "wrong-case" | "wrong-digest" | "wrong-provenance" | "missing-native" | "case-changed" | "author-changed" | "revoked"

/** These deliberately synthetic author/case ports test the consumer's closed
 * contract and repeated reads. The UI/human lease registries are real, but their
 * policy below is an explicit test policy. No native Session exists, and these
 * fixtures are not evidence of native execution or a production author receipt.
 * The full-host/SQLite/authenticated integration above remains independently required. */
async function reviewConsumerFixture(mode: ReviewFixtureMode = "valid") {
  const origin = "http://localhost"
  const sourceRoot = path.resolve(import.meta.dir, "../../../product/ai")
  const bundle = await createResidentAiBundle({ root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json") })
  const profile = bundle.profiles.find((item) => item.id === "sf_finance")!
  const skill = bundle.skills.find((item) => item.id === "sf-comparar-cenarios")!
  const reviewer = bundle.profiles.find((item) => item.id === "sf_reviewer")!
  const reviewSkill = bundle.skills.find((item) => item.id === "sf-contestar-decisao")!
  const identity = { installationId: "consumer-fixture-installation", projectId: "consumer-fixture-project", principalRef: "consumer-fixture-reader", policyVersion: "consumer-policy", accessRevision: "consumer-access" }
  const state = { allowed: true, caseReads: 0, authorReads: 0, outputReads: 0, readAdmissions: 0, readFinishes: 0 }
  const contexts: TrustedUiContext[] = []
  const ui = createSfUiAuthority({
    privateCommands: ["sf-human:analysis.read", "sf-human:analysis.start"], createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
    authorize: async (request, operation) => state.allowed && new URL(request.url).origin === origin && request.headers.get("origin") === origin &&
      ["sf_case_read", "sf-human:analysis.read", "sf-human:analysis.start"].includes(operation) && !(mode === "read-denied" && operation === "sf-human:analysis.read") ? identity : undefined,
  })
  const baseHuman = createSfHumanAuthority({ origin, ui })
  const human: SfHostServices["human"] = { ...baseHuman,
    admit: async (request, action, payload) => {
      const admitted = await baseHuman.admit(request, action, payload)
      if (admitted.status === "ok" && action === "analysis.read") { state.readAdmissions++; contexts.push(admitted.value) }
      return admitted
    },
    finish: (context) => { if (contexts.includes(context)) state.readFinishes++; baseHuman.finish(context) },
  }
  const caseRef = { id: "consumer-case", incarnation: "consumer-incarnation", version: 1 }
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const comparison: ScenarioComparison = { baselineResultRef: "decision-result:baseline", alternativeResultRef: "decision-result:alternative",
    costCoverageRefs: ["coverage:baseline", "coverage:alternative"], criterionResults: [], unresolvedConditions: ["Training remains unconfirmed"],
    comparisonStatus: "conditioned", knownDifference: 0, completeDifference: null }
  const result: ScenarioResult = { id: "scenario-id-is-not-a-persisted-result-ref", version: 1, components: [], currency: "USD", horizon, sourceRefs: [],
    unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 0, total: null,
    costCoverage: { basisId: "consumer-basis", basisVersion: 1, alternativeId: "current-alternative", alternativeVersion: 1, currency: "USD", horizon,
      issues: [], evaluatedSourceRefs: [], entries: [], derivedMissingCategoryIds: ["training"], coverageState: "pending" } }
  const projection: AuthorizedCaseProjection = { context: { ...identity, kind: "ui" }, checkedAt: "2026-11-13T01:00:00Z", events: [], evidenceRefs: [],
    case: { ...caseRef, state: "comparing", objective: "Review the saved comparison", horizon, currency: "USD", criteria: [], participants: [identity.principalRef],
      sourceRefs: [], costCoverageBases: [], assumptions: [], questions: [], preparedChanges: [], receipts: [], ledger: [],
      alternatives: [{ id: "current-alternative", version: 1, title: "Saved alternative", scenario: { baseRef: "baseline-source", operations: [], assumptions: [] }, result }],
      choices: [{ id: "matching-choice", alternativeId: "current-alternative", alternativeVersion: 1, basisVersion: 1, criteria: [], values: [], evidenceRefs: [],
        principalRef: identity.principalRef, reason: "Saved conditional choice", at: "2026-11-13T01:00:00Z", scenario: { baseRef: "baseline-source", operations: [], assumptions: [] },
        result, comparison, comparisonStatus: "conditioned", costCoverage: result.costCoverage }],
    } }
  const receipt = { runId: "consumer-author-run", nativeSessionId: "synthetic-author-session-for-contract-test", profileId: profile.id,
    profileVersion: profile.version, profileDigest: profile.sourceDigest, skillId: skill.id, skillVersion: skill.version, sourceDigest: skill.sourceDigest,
    instructionsDigest: skill.instructionsDigest, loadedMessageId: "synthetic-load-observation", loadedAt: "2026-11-13T01:00:00Z", manifestDigest: bundle.manifestDigest }
  const run: SfNativeRunRecord = { schema: "sf-native-run-v1", runRef: receipt.runId, version: 1, requestDigest: digestSfValue("consumer-request"), skillInputDigest: digestSfValue("consumer-input"),
    principalRef: identity.principalRef, accessRevision: identity.accessRevision, policyVersion: identity.policyVersion, caseRef,
    selection: { profile, skills: [skill], manifestDigest: bundle.manifestDigest, operationIds: skill.allowedOperations }, model: { providerID: "consumer-provider", id: "consumer-model" },
    skillId: skill.id, objective: projection.case.objective, contextFingerprint: digestSfValue("consumer-context"), createdAt: "2026-11-13T01:00:00Z", updatedAt: "2026-11-13T01:00:00Z",
    state: "ready", native: { sessionID: receipt.nativeSessionId, skillReceipt: receipt }, outputRef: "consumer-author-output" }
  const base = { id: run.outputRef!, caseRef, schemaVersion: "sf-contribution-v1" as const, evidenceRefs: [], accessRevision: identity.accessRevision,
    createdAt: "2026-11-13T01:00:00Z", outputDigest: "", runProvenance: { ...receipt, actualModel: "consumer-provider/consumer-model", contextFingerprint: run.contextFingerprint } }
  const domain = { context: { ...identity, surface: "planner" as const, period: horizon, currency: "USD", sourceRefs: [], capabilities: [] },
    version: 1, engineVersion: "consumer-engine", components: [], values: [], missing: [] }
  const output: ContributionEnvelope = mode === "financial" ? { ...base, kind: "FinancialAnalysis", state: "ready", payload: { baseline: domain, candidate: domain,
    sourceRefs: [], gaps: [], explanation: "Conditional comparison", comparison, knownDifference: 0, completeDifference: null, analysisBasis: "domain", domainApplied: false } }
    : { ...base, kind: "ScenarioComparison", state: "ready", payload: comparison }
  if (mode === "wrong-case") output.caseRef = { ...caseRef, incarnation: "another-incarnation" }
  if (mode === "wrong-provenance") output.runProvenance.nativeSessionId = "different-synthetic-session"
  if (mode === "missing-native") Reflect.deleteProperty(run, "native")
  output.outputDigest = digestSfContribution(output)
  const wanted: SfAnalysisRequest = { caseRef, objective: projection.case.objective, profileId: reviewer.id, profileVersion: reviewer.version, skillId: reviewSkill.id,
    skillVersion: reviewSkill.version, manifestDigest: bundle.manifestDigest, outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: reviewSkill.allowedOperations }
  const input = { request: wanted, selection: { authorAnalysis: { runRef: run.runRef, outputDigest: mode === "wrong-digest" ? "0".repeat(64) : output.outputDigest } } }
  const services: Pick<SfHostServices, "ui" | "human" | "analyses" | "dispatch"> = {
    ui, human,
    dispatch: async (operation, payload, context) => {
      if (context.kind !== "ui" || operation !== "sf_case_read" || !await ui.validate(context, operation, digestSfValue(payload)))
        return { status: "denied", reason: "consumer-case-denied", receipt: { kind: "unbound", operation, code: "invalid-binding", at: "2026-11-13T01:00:00Z" } }
      const receipt = ui.receiptFor(context, operation, digestSfValue(payload))
      if (!receipt) throw new Error("case fixture requires its own consumed UI read lease")
      state.caseReads++
      const value = structuredClone(projection)
      if (mode === "case-changed" && state.caseReads === 2) value.case.version++
      return { status: "ok", result: value, receipt }
    },
    analyses: {
      start: async () => { throw new Error("this consumer fixture cannot execute native analysis") },
      cancel: async () => ({ status: "unavailable", reason: "consumer-fixture" }),
      list: async () => ({ status: "unavailable", reason: "consumer-fixture" }),
      read: async (context, runRef) => {
        if (!await human.authorize(context, "analysis.read", { runRef }) || runRef !== run.runRef) return { status: "denied", reason: "consumer-author-denied" }
        state.authorReads++
        const value = structuredClone(run)
        if (mode === "author-changed" && state.authorReads === 2) value.updatedAt = "2026-11-13T01:00:01Z"
        return { status: "ok", value }
      },
      output: async (context, runRef) => {
        if (!await human.authorize(context, "analysis.read", { runRef }) || runRef !== run.runRef) return { status: "denied", reason: "consumer-author-denied" }
        state.outputReads++
        if (mode === "revoked" && state.outputReads === 2) state.allowed = false
        return { status: "ok", value: structuredClone(output) }
      },
    },
  }
  const request = (body?: unknown) => new Request(`${origin}/sucafina/dashboard?sf=workbench-analysis`, { method: "POST",
    headers: { origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: body === undefined ? undefined : JSON.stringify(body) })
  return { services, state, contexts, input, request, comparison, origin, output }
}

for (const kind of ["valid", "financial"] as const) test(`Reviewer consumer projects the actual ${kind === "financial" ? "FinancialAnalysis comparison" : "ScenarioComparison"} from its supplied ports and rereads both sources`, async () => {
  const f = await reviewConsumerFixture(kind)
  const prepared = await prepareReviewAnalysisInput(f.request(), f.services, f.input)
  expect(prepared).toEqual({ status: "ok", value: { alternativeRefs: ["current-alternative"], choiceRefs: ["matching-choice"], comparison: f.comparison,
    authorAnalysis: f.input.selection.authorAnalysis, authorizedEvidenceRefs: [] } })
  expect(f.state).toMatchObject({ caseReads: 2, authorReads: 2, outputReads: 2, readAdmissions: 2, readFinishes: 2 })
  expect(await Promise.all(f.contexts.map((context) => f.services.ui.revalidate(context)))).toEqual([false, false])
  expect(JSON.stringify(prepared)).not.toContain("synthetic-author-session")
})

for (const [mode, status] of [["read-denied", "denied"], ["wrong-case", "unavailable"], ["wrong-digest", "unavailable"], ["wrong-provenance", "unavailable"],
  ["missing-native", "unavailable"], ["case-changed", "stale"], ["author-changed", "stale"], ["revoked", "denied"]] as const)
  test(`Reviewer consumer refuses ${mode} through the existing read grants and saved-author checks`, async () => {
    const f = await reviewConsumerFixture(mode)
    expect((await prepareReviewAnalysisInput(f.request(), f.services, f.input)).status).toBe(status)
    expect(f.state.readFinishes).toBe(f.state.readAdmissions)
    if (mode === "read-denied") expect(f.state.authorReads).toBe(0)
    expect((await Promise.all(f.contexts.map((context) => f.services.ui.revalidate(context)))).every((value) => !value)).toBe(true)
  })

test("Reviewer consumer rejects a supplied comparison, evidence or nonreviewer profile before reading ports", async () => {
  const f = await reviewConsumerFixture()
  for (const selection of [{ ...f.input.selection, comparison: f.comparison }, { ...f.input.selection, authorizedEvidenceRefs: ["injected"] },
    { authorAnalysis: { ...f.input.selection.authorAnalysis, nativeSessionId: "caller-session" } }]) {
    expect((await prepareReviewAnalysisInput(f.request(), f.services, { ...f.input, selection })).status).toBe("needs-input")
  }
  expect((await prepareReviewAnalysisInput(f.request(), f.services, { ...f.input, request: { ...f.input.request, profileId: "sf_finance" } })).status).toBe("denied")
  expect(f.state.caseReads).toBe(0)
  expect(f.state.authorReads).toBe(0)
})

test("analysis output renders an authorized contribution and closes its read lease", async () => {
  const f = await reviewConsumerFixture()
  let revalidations = 0
  let modelReads = 0
  const runtime: Parameters<typeof handleSfAnalysis>[2] = {
    ...f.services,
    models: async () => { modelReads++; return [] },
    ui: { ...f.services.ui, revalidate: async (context) => {
      revalidations++
      return f.services.ui.revalidate(context)
    } },
  }
  const response = await handleSfAnalysis(f.request({ action: "output", runRef: f.input.selection.authorAnalysis.runRef }), f.origin, runtime)
  expect(response.status).toBe(200)
  const body = await response.json()
  expect(body).toMatchObject({ status: "ok", value: { outputRef: f.output.id } })
  expect(body.value.html).toContain("Scenario comparison")
  expect(body.value.html).toContain(f.input.selection.authorAnalysis.runRef)
  expect(revalidations).toBe(2)
  expect(f.state.outputReads).toBe(1)
  expect(modelReads).toBe(0)
  expect(f.state.readAdmissions).toBe(1)
  expect(f.state.readFinishes).toBe(f.state.readAdmissions)
})

test.each(["output", "render"] as const)("analysis output returns a denial when access changes after %s", async (phase) => {
  const f = await reviewConsumerFixture()
  const analyses = f.services.analyses
  if (!analyses) throw new Error("The consumer fixture requires its declared analysis read port")
  let revalidations = 0
  let modelReads = 0
  // The former optional model discovery was after rendering. Exercise both
  // current egress fences; this contract fixture executes no native analysis.
  const runtime: Parameters<typeof handleSfAnalysis>[2] = {
    ...f.services,
    models: async () => { modelReads++; return [] },
    analyses: {
      ...analyses,
      output: async (context, runRef) => {
        const result = await analyses.output(context, runRef)
        expect(result.status).toBe("ok")
        if (phase === "output") f.state.allowed = false
        return result
      },
    },
    ui: { ...f.services.ui, revalidate: async (context) => {
      revalidations++
      // The second consumer check is reached only after contribution HTML
      // was rendered successfully. Revoke before its real authority lookup.
      if (phase === "render" && revalidations === 2) f.state.allowed = false
      return f.services.ui.revalidate(context)
    } },
  }
  const response = await handleSfAnalysis(f.request({ action: "output", runRef: f.input.selection.authorAnalysis.runRef }), f.origin, runtime)
  expect(response.status).toBe(403)
  expect(await response.json()).toEqual({ status: "denied" })
  expect(revalidations).toBe(phase === "output" ? 1 : 2)
  expect(f.state.outputReads).toBe(1)
  expect(modelReads).toBe(0)
  expect(f.state.readAdmissions).toBe(1)
  expect(f.state.readFinishes).toBe(f.state.readAdmissions)
})
