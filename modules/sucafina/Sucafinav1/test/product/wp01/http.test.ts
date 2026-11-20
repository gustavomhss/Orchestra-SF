import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "../wp02/browser-driver-fixture.ts"
import { createNativeBrowserAssets } from "../native-ui-browser/browser-assets.ts"
import { createNativeBrowserHost } from "../native-ui-browser/host.ts"
import { enrollNativeBrowser } from "../native-ui-browser/session.ts"
import { observeSfDecisionIntentHealth } from "../../../../../../apps/cli/src/sucafina-product/native-ui/decision-intent-health.ts"
import type { SfNativeChapterNavigationResult } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/host/native-chapter-entry.ts"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { contributions, createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCapabilities } from "../../../product/decisions/capabilities.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"

test("native Decisions uses actual identity, SQLite and case dispatcher with revocation and CSRF", async () => {
  expectSpawn(import.meta.path)
  const assets = await createNativeBrowserAssets(new URL("./http-entry.tsx", import.meta.url))
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-workbench-http-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const at = "2026-11-13T08:00:00Z"
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => at) })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const serverState: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 404 }) })
  const origin = server.url.origin
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const person = `macos:${operator.installationId}:${operator.uid}`
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
  const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
  const environment = async (request: Request) => ({ at, id: randomUUID, directory: await identity.directory(request) })
  const binding = { installationId: operator.installationId, projectId: "project", hostId: "host", location }
  const authority = createSfProductAuthority({ identity: () => binding, installationId: operator.installationId, origin, policyVersion: "policy", persistence, authenticate: identity.authenticate, isAuthenticated: async (request) => Boolean(await identity.person(request)), environment, grants: [{ principalRef: person, namespaces: ["cases"], operations: ["sf_case_draft", "sf_case_read", "sf_work_list", "sf_request_read"] }], createId: randomUUID, now: Date.now, commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined, inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const evidence = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: async (ref, context) => ({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: new Date().toISOString() }), proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" } }) })
  const cases = createDecisionCasePort({ state: authority.state, host: authority.host, creationTarget: authority.creationTarget, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), verifyScenarioOperations: async (value) => !value.preparedChanges.length && value.alternatives.every((item) => !item.scenario.operations.length) && value.choices.every((item) => !item.scenario.operations.length), evidence, createId: randomUUID, now: () => "2026-11-13T08:00:00Z" })
  const descriptors = createDecisionCapabilities({ cases, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: authority.authority.receiptFor })
  const dispatch: SfHostServices["dispatch"] = (operation, payload, context) => dispatchSfCapability({ operation, payload, context, descriptors, authority: authority.authority,
    validateInput: (_descriptor, value) => operation === "sf_case_read" ? decodeSfOperationInput("sf_case_read", value).ok : operation === "sf_case_draft" && decodeSfOperationInput("sf_case_draft", value).ok,
    validateOutput: (_descriptor, result) => result.status !== "ok" || (operation === "sf_case_read" ? decodeSfOperationOutput("sf_case_read", result.result).ok : operation === "sf_case_draft" && decodeSfOperationOutput("sf_case_draft", result.result).ok) })
  // The native Procurement entry consumes its original scoped collection reader.
  // Its real authority grants sf_request_read; readiness is still derived by F01.
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
  const services = { ...authority, dispatch, productView: business.procurementQueueView } as SfHostServices
  const product = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const application = { persistence, authenticate: identity.authenticate, environment, product,
    productView: business.procurementQueueView, maxJsonBytes: 100000 }
  const app = createModule("/sucafina", application)
  const native = createNativeBrowserHost({ origin, mount: "/sucafina", directory, identity: () => binding,
    application: { ...application, domains: contributions }, authority, services: () => services,
    observe: (request, stamp) => observeSfDecisionIntentHealth({
      ui: authority.ui, state: authority.state, humanActions: authority.humanActions,
      binding: (_operation, producer) => producer === product && application.product === product ? application.product : undefined,
      source: (operation) => {
        if (operation !== "decisions.command.sf_case_draft") return undefined
        const draft = descriptors.filter((descriptor) => descriptor.id === "sf_case_draft")
        if (draft.length !== 1 || draft[0]?.handlerExport !== "draftCase") return undefined
        return { producer: product, dependencies: [services.dispatch, draft[0], cases, cases.draft, persistence] }
      },
    }, request, stamp),
  })
  serverState.handle = async (request) => await identity.handle(request) ??
    assets.handle(request, { directory, mode: "component" }) ?? await native.handle(request) ?? await app(request)
  try {
    // Discovery precedes the product session and is confined to this transport
    // and its exact admitted Location; product context still requires identity.
    const discovery = (selectedDirectory: string, headers?: HeadersInit) => native.handle(new Request(
      `${origin}/api/sucafina/installations?${new URLSearchParams({ select: "location", "location[directory]": selectedDirectory })}`,
      { headers }))
    const discovered = await discovery(directory)
    expect(discovered?.status).toBe(200)
    expect(await discovered!.json()).toEqual({ installations: [native.descriptor()] })
    expect(await (await discovery(path.join(directory, "other")))!.json()).toEqual({ installations: [] })
    expect((await discovery(directory, { "sec-fetch-site": "cross-site" }))?.status).toBe(403)
    const anonymousContext = await native.handle(new Request(`${origin}/sucafina/api/ui/context?${new URLSearchParams({
      installationId: binding.installationId, projectId: binding.projectId, hostId: binding.hostId,
    })}`))
    expect(anonymousContext?.status).toBe(401)
    const enrollment = await identity.enroll()
    const authenticated = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${enrollment}`))
    const cookie = authenticated!.headers.get("set-cookie")!.split(";")[0]!
    const readProcurement = () => native.handle(new Request(`${origin}/sucafina/api/ui/pages/CAP25`, { headers: { cookie } }))
    const procurement = await readProcurement()
    expect(procurement?.status).toBe(200)
    expect(await procurement!.json()).toMatchObject({ status: "ok", value: { capabilityId: "CAP25" } })
    const payload = { operation: "sf_case_draft", input: { objective: "Review renewal", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost"], sourceRefs: [] } }
    const post = (requestOrigin: string) => app(new Request(`${origin}/sucafina/dashboard?sf=workbench-command`, { method: "POST", headers: { cookie, origin: requestOrigin, "content-type": "application/json", "idempotency-key": "decision-intent-1" }, body: JSON.stringify(payload) }))
    expect((await post("https://other.example"))?.status).toBe(403)
    const created = await post(origin)
    expect(created?.status).toBe(200)
    const result = await created!.json() as { status: string; outputRef: string }
    expect(result.status).toBe("ok")
    expect(result.outputRef).toMatch(/^case:[^:]+:[^:]+$/)
    const landing = await native.handle(new Request(`${origin}/sucafina/api/ui/projections/cases`, { headers: { cookie } }))
    expect(landing?.status).toBe(200)
    expect(await landing!.json()).toMatchObject({ status: "ok", value: { cases: [
      { caseRef: result.outputRef, title: "Review renewal", version: 1 },
    ] } })
    const select = (start: string, end: string) => app(new Request(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "workbench-work-select", start, end })}`, { headers: { cookie } }))
    expect((await select("invalid", "2027-12-31"))?.status).toBe(400)
    expect((await select("2027-01-01", "2027-12-31"))?.status).toBe(503)
    const read = () => native.handle(new Request(`${origin}/sucafina/api/ui/projections/case?${new URLSearchParams({ caseRef: result.outputRef })}`, { headers: { cookie } }))
    const initial = await read()
    expect(initial?.status).toBe(200)
    expect(await initial!.json()).toMatchObject({ status: "ok", value: { projection: { case: {
      objective: "Review renewal", horizon: payload.input.horizon, currency: "USD",
      criteria: [expect.objectContaining({ description: "Cost" })],
    } } } })
    const { expect: browserExpect } = await import("@playwright/test")
    const driver = await launchBrowserDriver("wp01-native-decisions")
    try {
      const context = await driver.browser.newContext()
      context.setDefaultTimeout(5000)
      context.setDefaultNavigationTimeout(5000)
      await enrollNativeBrowser(context, origin, () => identity.enroll())
      const tab = await context.newPage(), errors: string[] = []
      tab.on("pageerror", (error) => errors.push(error.message))
      await tab.goto(origin + "/orchestra/sf-decisions")
      const casesList = tab.getByRole("region", { name: "Authorized decision cases", exact: true })
      await casesList.getByRole("link", { name: "Open decision", exact: true }).click()
      await browserExpect(tab.getByRole("heading", { name: "Case summary", exact: true })).toBeVisible()
      await browserExpect(tab.getByRole("region", { name: "Question", exact: true })).toContainText("Review renewal")
      await tab.goBack()
      await browserExpect(casesList).toContainText("Review renewal")
      expect(await tab.locator('input[name="caseRef"], input[name="selectionRef"], input[name="runRef"]').count()).toBe(0)
      await tab.getByRole("button", { name: "New case", exact: true }).click()
      const creation = tab.getByRole("region", { name: "Create a decision", exact: true })
      await creation.getByLabel("Decision objective", { exact: true }).fill("Compare renewals")
      await creation.getByLabel("Start", { exact: true }).fill("2027-01-01")
      await creation.getByLabel("End", { exact: true }).fill("2027-12-31")
      await creation.getByLabel("Currency", { exact: true }).fill("USD")
      await creation.getByLabel("Criteria, one per line", { exact: true }).fill("Cost\nCoverage")
      await creation.getByRole("button", { name: "Review creation", exact: true }).click()
      const [createdInBrowser] = await Promise.all([
        tab.waitForResponse((response) => response.request().method() === "POST" &&
          new URL(response.url()).searchParams.get("sf") === "workbench-command"),
        creation.getByRole("button", { name: "Confirm this decision creation", exact: true }).click(),
      ])
      expect(createdInBrowser.status()).toBe(200)
      expect(createdInBrowser.request().postDataJSON()).toEqual({ operation: "sf_case_draft", input: {
        objective: "Compare renewals", horizon: payload.input.horizon, currency: "USD",
        criteria: ["Cost", "Coverage"], sourceRefs: [],
      } })
      const browserResult = await createdInBrowser.json() as { status: string; outputRef: string }
      expect(browserResult.status).toBe("ok")
      expect(browserResult.outputRef).toMatch(/^case:[^:]+:[^:]+$/)
      expect(browserResult.outputRef).not.toBe(result.outputRef)
      await creation.getByRole("link", { name: "Open decision", exact: true }).click()
      await browserExpect(tab.getByRole("region", { name: "Question", exact: true })).toContainText("Compare renewals")
      const persisted = await native.handle(new Request(`${origin}/sucafina/api/ui/projections/case?${new URLSearchParams({ caseRef: browserResult.outputRef })}`, { headers: { cookie } }))
      expect(persisted?.status).toBe(200)
      expect(await persisted!.json()).toMatchObject({ status: "ok", value: { projection: { case: {
        objective: "Compare renewals", horizon: payload.input.horizon, currency: "USD",
        criteria: [expect.objectContaining({ description: "Cost" }), expect.objectContaining({ description: "Coverage" })],
      } } } })
      // The published shell now enters Decisions through the owner navigation
      // callback. Exercise that exact callback from all three application entries;
      // no legacy Workbench link or replacement navigation is manufactured.
      for (const chapter of ["sf-dashboard", "sf-planner", "sf-procurement"]) {
        const move = (chapter: string) => tab.evaluate(async (chapter) => {
          const request = (window as typeof window & {
            sfHttpChapterNavigation?: (chapter: string) => Promise<SfNativeChapterNavigationResult>
          }).sfHttpChapterNavigation
          if (!request) throw new Error("SF_HTTP_NATIVE_NAVIGATION_MISSING")
          return request(chapter)
        }, chapter)
        expect(await move(chapter)).toBe("committed")
        expect(new URL(tab.url()).pathname).toContain("/orchestra/" + chapter + "/")
        expect(await move("sf-decisions")).toBe("committed")
        await browserExpect(tab.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible()
        await browserExpect(casesList).toContainText("Review renewal")
        await browserExpect(casesList).toContainText("Compare renewals")
        expect(await tab.locator('input[name="caseRef"], input[name="selectionRef"], input[name="runRef"]').count()).toBe(0)
      }
      expect(errors).toEqual([])
    } finally { await driver.close(); driver.report() }
    await identity.handle(new Request(`${origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie, origin } }))
    expect((await read())?.status).toBe(403)
    expect((await readProcurement())?.status).toBe(403)
  } finally { business.dispose(); await server.stop(true); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 60000)
