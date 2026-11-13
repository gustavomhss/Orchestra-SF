import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCapabilities } from "../../../product/decisions/capabilities.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"

test("workbench uses actual identity, SQLite and case dispatcher with revocation and CSRF", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-workbench-http-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const serverState: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await serverState.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const operator = { installationId: randomUUID(), uid: 1000, name: "Test operator" }
  const person = `macos:${operator.installationId}:${operator.uid}`
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
  const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) })
  const authority = createSfProductAuthority({ identity: () => ({ installationId: operator.installationId, projectId: "project", hostId: "host", location }), installationId: operator.installationId, origin, policyVersion: "policy", persistence: store, authenticate: identity.authenticate, environment, grants: [{ principalRef: person, namespaces: ["cases"], operations: ["sf_case_draft", "sf_case_read", "sf_work_list"] }], createId: randomUUID, now: Date.now, commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined, inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const evidence = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: async (ref, context) => ({ state: "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: new Date().toISOString() }), proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" } }) })
  const cases = createDecisionCasePort({ state: authority.state, host: authority.host, creationTarget: authority.creationTarget, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
    authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && !value.preparedChanges.length && value.alternatives.every((item) => !item.scenario.operations.length) && value.choices.every((item) => !item.scenario.operations.length), evidence, createId: randomUUID, now: () => "2026-11-13T08:00:00Z" })
  const descriptors = createDecisionCapabilities({ cases, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: authority.authority.receiptFor })
  const dispatch: SfHostServices["dispatch"] = (operation, payload, context) => dispatchSfCapability({ operation, payload, context, descriptors, authority: authority.authority,
    validateInput: (_descriptor, value) => operation === "sf_case_read" ? decodeSfOperationInput("sf_case_read", value).ok : operation === "sf_case_draft" && decodeSfOperationInput("sf_case_draft", value).ok,
    validateOutput: (_descriptor, result) => result.status !== "ok" || (operation === "sf_case_read" ? decodeSfOperationOutput("sf_case_read", result.result).ok : operation === "sf_case_draft" && decodeSfOperationOutput("sf_case_draft", result.result).ok) })
  const services = { ...authority, dispatch } as SfHostServices
  const product = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
  const app = createModule("/sucafina", { persistence: store, authenticate: identity.authenticate, environment, product, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
  serverState.handle = async (request) => await identity.handle(request) ?? await app(request)
  try {
    const enrollment = await identity.enroll()
    const authenticated = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${enrollment}`))
    const cookie = authenticated!.headers.get("set-cookie")!.split(";")[0]!
    const payload = { operation: "sf_case_draft", input: { objective: "Review renewal", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost"], sourceRefs: [] } }
    const post = (requestOrigin: string) => app(new Request(`${origin}/sucafina/dashboard?sf=workbench-command`, { method: "POST", headers: { cookie, origin: requestOrigin, "content-type": "application/json", "idempotency-key": "decision-intent-1" }, body: JSON.stringify(payload) }))
    expect((await post("https://other.example"))?.status).toBe(403)
    const created = await post(origin)
    expect(created?.status).toBe(200)
    const result = await created!.json()
    expect(result.outputRef).toBeTruthy()
    const landing = await app(new Request(`${origin}/sucafina/dashboard?sf=workbench`, { headers: { cookie } }))
    expect(landing?.status).toBe(200)
    const landingHtml = await landing!.text()
    expect(landingHtml).toContain("Review renewal")
    expect(landingHtml).toContain("workbench-case")
    expect(landingHtml).not.toContain('name="caseRef"')
    expect(landingHtml).not.toContain('name="selectionRef"')
    expect(landingHtml).not.toContain('name="runRef"')
    const select = (start: string, end: string) => app(new Request(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "workbench-work-select", start, end })}`, { headers: { cookie } }))
    expect((await select("invalid", "2027-12-31"))?.status).toBe(400)
    expect((await select("2027-01-01", "2027-12-31"))?.status).toBe(503)
    const read = () => app(new Request(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "workbench-case", caseRef: result.outputRef })}`, { headers: { cookie } }))
    const page = await read()
    expect(page?.status).toBe(200)
    expect(await page!.text()).toContain("Review renewal")
    const { chromium } = await import("@playwright/test")
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
    try {
      const tab = await browser.newPage()
      await tab.goto(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`)
      await tab.goto(`${origin}/sucafina/dashboard?sf=workbench`)
      await tab.getByRole("link", { name: "Review renewal" }).click()
      await tab.getByRole("heading", { name: "Review renewal" }).waitFor()
      await tab.goBack()
      await tab.getByRole("link", { name: "Review renewal" }).waitFor()
      expect(await tab.locator('input[name="caseRef"], input[name="selectionRef"], input[name="runRef"]').count()).toBe(0)
      await tab.getByText("Create a decision").click()
      await tab.getByLabel("Decision objective").fill("Compare renewals")
      await tab.getByLabel("Start", { exact: true }).fill("2027-01-01")
      await tab.getByLabel("End", { exact: true }).fill("2027-12-31")
      await tab.getByLabel("Currency").fill("USD")
      await tab.getByLabel("Criteria, one per line").fill("Cost\nCoverage")
      await tab.getByRole("button", { name: "Create decision" }).click()
      await tab.getByRole("heading", { name: "Compare renewals" }).waitFor()
      for (const surface of ["dashboard", "planner", "procurement"]) {
        await tab.goto(`${origin}/sucafina/${surface}`)
        await tab.getByRole("link", { name: "Workbench", exact: true }).click()
        await tab.getByRole("heading", { name: "Workbench", exact: true }).waitFor()
      }
    } finally { await browser.close() }
    await identity.handle(new Request(`${origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie, origin } }))
    expect((await read())?.status).toBe(403)
  } finally { await server.stop(true); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 60000)
