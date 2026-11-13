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
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCapabilities } from "../../../product/decisions/capabilities.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { decorateSfProductHtml } from "../../../product/interface/html.ts"

test("contract context uses mounted evidence, survives a lost response, and rejects tamper and revocation", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-contextual-decision-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const routed: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await routed.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const now = () => "2026-11-13T08:00:00Z"
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(now), createId: randomUUID }) }
  const operator = { installationId: randomUUID(), uid: 1000, name: "Context test operator" }
  const person = `macos:${operator.installationId}:${operator.uid}`
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
  const environment = async (request: Request) => ({ at: now(), id: randomUUID, directory: await identity.directory(request) })
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.contracts = [{ id: "contract-a", vendor: "Context contract Alpha", amount: 120, currency: "USD" }, { id: "contract-b", vendor: "Context contract Beta", amount: 240, currency: "USD" }]
      return { commit: true, value: undefined }
    })
    const authority = createSfProductAuthority({ identity: () => ({ installationId: operator.installationId, projectId: "project", hostId: "host", location }), installationId: operator.installationId, origin, policyVersion: "policy", persistence, authenticate: identity.authenticate, environment,
      grants: [{ principalRef: person, namespaces: ["cases"], operations: ["sf_case_draft", "sf_case_read", "sf_work_list"] }], createId: randomUUID, now: Date.now,
      commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() : request.headers.get("idempotency-key") ? digestSfValue({ operation, key: request.headers.get("idempotency-key") }) : undefined,
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
    const records = createDashboardRecordEvidenceHost({ host: authority.host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host: authority.host, scopedSources: persistence }) })
    const evidence = createSfBusinessContext({ revalidate: authority.host.revalidate, resolveSource: createSfDashboardRecordSourceAccess({ host: authority.host, records }), proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" } }) })
    const cases = createDecisionCasePort({ state: authority.state, host: authority.host, creationTarget: authority.creationTarget, operationIdentity: (context) => context.kind === "ui" ? authority.ui.operationIdentity(context) : undefined,
      authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await authority.host.revalidate(context), evidence, createId: randomUUID, now })
    const descriptors = createDecisionCapabilities({ cases, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: authority.authority.receiptFor })
    const dispatch: SfHostServices["dispatch"] = (operation, payload, context) => dispatchSfCapability({ operation, payload, context, descriptors, authority: authority.authority,
      validateInput: (_descriptor, value) => operation === "sf_case_read" ? decodeSfOperationInput("sf_case_read", value).ok : operation === "sf_case_draft" && decodeSfOperationInput("sf_case_draft", value).ok,
      validateOutput: (_descriptor, result) => result.status !== "ok" || (operation === "sf_case_read" ? decodeSfOperationOutput("sf_case_read", result.result).ok : operation === "sf_case_draft" && decodeSfOperationOutput("sf_case_draft", result.result).ok) })
    const services = { ...authority, dispatch } as SfHostServices
    const product = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
    const app = createModule("/sucafina", { persistence, authenticate: identity.authenticate, environment, product, productHtml: decorateSfProductHtml, maxJsonBytes: 100000 })
    routed.handle = async (request) => await identity.handle(request) ?? await app(request)
    const authenticated = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
    const cookie = authenticated!.headers.get("set-cookie")!.split(";")[0]!
    const returnTo = "/sucafina/dashboard?page=Vendor+Contracts&year=2027&q=Context&filter=#record-contract-a"
    const contextUrl = (back = returnTo) => `${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "workbench-context", recordId: "contract-a", start: "2027-01-01", end: "2027-12-31", returnTo: back })}`
    const get = (url: string) => app(new Request(url, { headers: { cookie } }))
    const unavailableWork = await get(`${origin}/sucafina/dashboard?sf=workbench-work-select&start=2027-01-01&end=2027-12-31`)
    expect(unavailableWork?.status).toBe(503)
    expect(unavailableWork?.headers.get("content-type")).toContain("text/html")
    expect(await unavailableWork!.text()).toContain("Retry this selection")
    const invalidWork = await get(`${origin}/sucafina/dashboard?sf=workbench-work-select&start=invalid&end=2027-12-31`)
    expect(invalidWork?.status).toBe(400)
    expect(await invalidWork!.text()).toContain('name="end" type="date" required value="2027-12-31"')
    for (const back of [`https://other.example${returnTo}`, returnTo.replace("/sucafina/", "/foreign/"), returnTo.replace("Vendor+Contracts", "All+Projects"), returnTo.replace("record-contract-a", "record-contract-b"), returnTo.replace("year=2027", "year=2026"), returnTo.replace("&filter=", "&sf=workbench")]) {
      const response = await get(contextUrl(back))
      expect(response?.status).toBe(400)
      expect(await response!.text()).not.toContain("data-source-refs=")
    }
    const absentSource = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => ({ ...services, host: { ...authority.host, persistence: driver } }) })
    expect((await absentSource(new Request(contextUrl(), { headers: { cookie } }), "dashboard"))?.status).toBe(503)
    const { chromium } = await import("@playwright/test")
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
    try {
      const tab = await browser.newPage()
      tab.setDefaultTimeout(10000)
      tab.setDefaultNavigationTimeout(15000)
      const separator = cookie.indexOf("=")
      await tab.context().addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: origin }])
      const errors: string[] = []
      tab.on("pageerror", (error) => { errors.push(error.message) })
      await tab.goto(`${origin}${returnTo}`, { waitUntil: "domcontentloaded" })
      await tab.getByRole("button", { name: "Create decision for Context contract Alpha", exact: true }).click()
      await tab.getByRole("heading", { name: "Create a decision from Context contract Alpha", exact: true }).waitFor()
      const form = tab.locator("[data-decision-create]")
      const sourceRefs: BusinessEvidenceRef[] = JSON.parse(await form.getAttribute("data-source-refs") ?? "[]")
      expect(sourceRefs).toHaveLength(1)
      const original = sourceRefs[0]!
      expect(original.kind).toBe("record")
      if (original.kind !== "record") throw new Error("Expected real record evidence")
      expect(original.target.recordId).toBe("contract-a")
      expect(original.target.fields).toEqual(["amount", "vendor"])
      expect(original.target.period).toEqual({ start: "2027-01-01", end: "2027-12-31" })
      expect(original.refDigest).toBe(digestSfEvidenceRef(original))
      const draft = (refs: readonly BusinessEvidenceRef[]) => ({ objective: "Review contextual renewal", horizon: original.target.period!, currency: "USD", criteria: ["Cost", "Continuity"], sourceRefs: refs })
      const post = (refs: readonly BusinessEvidenceRef[], key: string) => app(new Request(`${origin}/sucafina/dashboard?sf=workbench-command`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ operation: "sf_case_draft", input: draft(refs) }) }))
      const readCases = () => authority.state.read(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie } }), "cases", (state) => Object.values(state.cases))
      const corrupted = { ...original, refDigest: "0".repeat(64) }
      // A self-consistent digest still cannot move an issued selector to a different record.
      const substituted = { ...original, target: { ...original.target, recordId: "contract-b" } }
      substituted.refDigest = digestSfEvidenceRef(substituted)
      for (const ref of [corrupted, substituted]) {
        expect(decodeSfOperationInput("sf_case_draft", draft([ref])).ok).toBe(true)
        expect((await post([ref], randomUUID()))?.status).toBe(503)
      }
      const before = await readCases()
      expect(before.status === "ok" ? before.value.length : before.status === "unavailable" && before.reason === "product-state-uninitialized" ? 0 : -1).toBe(0)
      const seen: { key: string | undefined; body: string | null }[] = []
      let deliveredStatus = 0
      await tab.route("**/dashboard?sf=workbench-command", async (route) => {
        seen.push({ key: route.request().headers()["idempotency-key"], body: route.request().postData() })
        if (seen.length !== 1) { await route.continue(); return }
        const committed = await route.fetch()
        deliveredStatus = committed.status()
        await route.abort("failed")
      })
      await form.getByLabel("Decision objective", { exact: true }).fill("Review contextual renewal")
      await form.getByLabel("Currency", { exact: true }).fill("USD")
      await form.getByLabel("Criteria, one per line", { exact: true }).fill("Cost\nContinuity")
      await form.getByRole("button", { name: "Create decision", exact: true }).click()
      await form.getByText("Creation is unconfirmed.", { exact: false }).waitFor()
      expect(deliveredStatus).toBe(200)
      expect(await form.getByLabel("Decision objective", { exact: true }).isDisabled()).toBe(true)
      const uncertain = await readCases()
      expect(uncertain.status).toBe("ok")
      if (uncertain.status !== "ok") throw new Error("Committed case missing")
      expect(uncertain.value).toHaveLength(1)
      expect(uncertain.value[0]!.sourceRefs).toEqual(sourceRefs)
      await form.evaluate((node, ref) => { node.setAttribute("data-source-refs", JSON.stringify([ref])); const objective = node.querySelector<HTMLInputElement>('input[name="objective"]'); if (objective) objective.value = "Changed after lost response" }, substituted)
      await form.getByRole("button", { name: "Retry same creation", exact: true }).click()
      await tab.getByRole("heading", { name: "Review contextual renewal", exact: true }).waitFor()
      expect(seen).toHaveLength(2)
      expect(seen[1]).toEqual(seen[0])
      const after = await readCases()
      expect(after.status).toBe("ok")
      if (after.status !== "ok") throw new Error("Saved case missing")
      expect(after.value).toHaveLength(1)
      expect(after.value[0]!.id).toBe(uncertain.value[0]!.id)
      expect(after.value[0]!.sourceRefs).toEqual(sourceRefs)
      const back = tab.getByRole("link", { name: "Return to contract", exact: true })
      expect(await back.getAttribute("href")).toBe(returnTo)
      const savedUrl = new URL(tab.url()); savedUrl.searchParams.set("returnTo", returnTo.replace("record-contract-a", "record-contract-b"))
      expect((await get(savedUrl.href))?.status).toBe(400)
      await back.click()
      await tab.locator("#record-contract-a").waitFor()
      expect(new URL(tab.url()).searchParams.get("q")).toBe("Context")
      expect(new URL(tab.url()).searchParams.get("year")).toBe("2027")
      await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.contracts = [{ id: "contract-a", vendor: "Context contract Alpha", amount: 180, currency: "USD" }]; return { commit: true, value: undefined } })
      expect((await post(sourceRefs, "changed-source"))?.status).toBe(503)
      const unchanged = await readCases()
      expect(unchanged.status === "ok" && unchanged.value.length).toBe(1)
      await tab.goto(contextUrl(), { waitUntil: "domcontentloaded" })
      await form.getByLabel("Decision objective", { exact: true }).fill("Must not persist after logout")
      await form.getByLabel("Currency", { exact: true }).fill("USD")
      await form.getByLabel("Criteria, one per line", { exact: true }).fill("Cost")
      expect(await tab.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST", credentials: "same-origin" })).status)).toBe(204)
      await form.getByRole("button", { name: "Create decision", exact: true }).click()
      await tab.getByText("Your access changed. Reload before creating a decision.", { exact: true }).waitFor()
      expect(await tab.locator("[data-source-refs], [data-decision-context] h2, [data-decision-context] input").count()).toBe(0)
      expect((await get(contextUrl()))?.status).toBe(403)
      expect((await post(sourceRefs, "revoked-session"))?.status).toBe(403)
      expect(errors).toEqual([])
    } finally { await browser.close() }
  } finally { await server.stop(true); await driver.dispose(); await rm(directory, { recursive: true, force: true }) }
}, 90000)
