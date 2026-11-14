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
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"

async function within<T>(operation: Promise<T>, step: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error(`Contextual decision timed out: ${step}`)), 10000) })])
  } finally { clearTimeout(timer) }
}

test("contract context uses mounted evidence, survives a lost response, and rejects tamper and revocation", async () => {
  let phase = "open store"
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-contextual-decision-"))
  await chmod(directory, 0o700)
  const driver = await within(openLocalStore(directory), phase)
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
  let failure: unknown
  try {
    phase = "initialize contract sources"
    await within(persistence.initializeSources("dashboard"), phase)
    await within(persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.contracts = [{ id: "contract-a", vendor: "Context contract Alpha", amount: 120, currency: "USD" }, { id: "contract-b", vendor: "Context contract Beta", amount: 240, currency: "USD" }]
      return { commit: true, value: undefined }
    }), "seed contracts")
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
    phase = "enroll actual operator"
    const authenticated = await within(identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await within(identity.enroll(), phase)}`)), phase)
    const cookie = authenticated!.headers.get("set-cookie")!.split(";")[0]!
    const returnTo = "/sucafina/dashboard?page=Vendor+Contracts&year=2026&q=Context&filter=#record-contract-a"
    const contextUrl = (back = returnTo) => `${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "workbench-context", recordId: "contract-a", start: "2026-01-01", end: "2026-12-31", returnTo: back })}`
    const get = (url: string) => within(app(new Request(url, { headers: { cookie } })), `GET ${new URL(url).searchParams.get("sf")}`)
    phase = "validate work and contextual boundaries"
    const unavailableWork = await get(`${origin}/sucafina/dashboard?sf=workbench-work-select&start=2026-01-01&end=2026-12-31`)
    expect(unavailableWork?.status).toBe(503)
    expect(unavailableWork?.headers.get("content-type")).toContain("text/html")
    expect(await unavailableWork!.text()).toContain("Retry this selection")
    const invalidWork = await get(`${origin}/sucafina/dashboard?sf=workbench-work-select&start=invalid&end=2026-12-31`)
    expect(invalidWork?.status).toBe(400)
    expect(await invalidWork!.text()).toContain('name="end" type="date" required value="2026-12-31"')
    for (const back of [`https://other.example${returnTo}`, returnTo.replace("/sucafina/", "/foreign/"), returnTo.replace("Vendor+Contracts", "All+Projects"), returnTo.replace("record-contract-a", "record-contract-b"), returnTo.replace("year=2026", "year=2025"), returnTo.replace("&filter=", "&sf=workbench")]) {
      const response = await get(contextUrl(back))
      expect(response?.status).toBe(400)
      expect(await response!.text()).not.toContain("data-source-refs=")
    }
    const absentSource = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => ({ ...services, host: { ...authority.host, persistence: driver } }) })
    expect((await within(absentSource(new Request(contextUrl(), { headers: { cookie } }), "dashboard"), "missing source port"))?.status).toBe(503)
    // The source projection can issue evidence only for its actual as-of period.
    const futureContext = new URL(contextUrl())
    futureContext.searchParams.set("start", "2027-01-01")
    futureContext.searchParams.set("end", "2027-12-31")
    futureContext.searchParams.set("returnTo", returnTo.replace("year=2026", "year=2027"))
    const unavailablePeriod = await get(futureContext.href)
    expect(unavailablePeriod?.status).toBe(503)
    const unavailablePeriodHtml = await unavailablePeriod!.text()
    expect(unavailablePeriodHtml).toContain("The selected contract could not be revalidated")
    expect(unavailablePeriodHtml).not.toContain("data-source-refs=")
    const issuedContext = await get(contextUrl())
    expect(issuedContext?.status).toBe(200)
    expect(await issuedContext!.text()).toContain("Create a decision from Context contract Alpha")
    phase = "launch browser"
    const browser = await launchWp01Browser()
    let tab: import("@playwright/test").Page | undefined
    const errors: string[] = []
    let browserFailure: unknown
    try {
      tab = await within(browser.newPage(), "open page")
      tab.setDefaultTimeout(10000)
      tab.setDefaultNavigationTimeout(15000)
      const separator = cookie.indexOf("=")
      await tab.context().addCookies([{ name: cookie.slice(0, separator), value: cookie.slice(separator + 1), url: origin }])
      tab.on("pageerror", (error) => { errors.push(error.message) })
      const dialogs: string[] = []
      tab.on("dialog", async (dialog) => { dialogs.push(dialog.type()); await dialog.accept() })
      phase = "open source contract and confirm discard once"
      await tab.goto(`${origin}${returnTo}`, { waitUntil: "domcontentloaded" })
      // Enter an unsaved draft in the real record form before the contextual link.
      await tab.locator('form[data-record="contract-a"] input[name="vendor"]').evaluate((node) => {
        const field = node as HTMLInputElement
        field.value = "Unsaved local vendor"
        field.dispatchEvent(new Event("input", { bubbles: true }))
      })
      expect(await tab.locator('form[data-dirty="true"]').count()).toBeGreaterThan(0)
      await tab.getByRole("button", { name: "Create decision for Context contract Alpha", exact: true }).click()
      await tab.getByRole("heading", { name: "Create a decision from Context contract Alpha", exact: true }).waitFor()
      expect(dialogs).toEqual(["confirm"])
      const form = tab.locator("[data-decision-create]")
      const sourceRefs: BusinessEvidenceRef[] = JSON.parse(await form.getAttribute("data-source-refs") ?? "[]")
      expect(sourceRefs).toHaveLength(1)
      const original = sourceRefs[0]!
      expect(original.kind).toBe("record")
      if (original.kind !== "record") throw new Error("Expected real record evidence")
      expect(original.target.recordId).toBe("contract-a")
      expect(original.target.fields).toEqual(["amount", "vendor"])
      expect(original.target.period).toEqual({ start: "2026-01-01", end: "2026-12-31" })
      expect(original.refDigest).toBe(digestSfEvidenceRef(original))
      const draft = (refs: readonly BusinessEvidenceRef[]) => ({ objective: "Review contextual renewal", horizon: original.target.period!, currency: "USD", criteria: ["Cost", "Continuity"], sourceRefs: refs })
      const post = (refs: readonly BusinessEvidenceRef[], key: string) => within(app(new Request(`${origin}/sucafina/dashboard?sf=workbench-command`, { method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify({ operation: "sf_case_draft", input: draft(refs) }) })), "create case command")
      const readCases = () => within(authority.state.read(new Request(`${origin}/sucafina/dashboard`, { headers: { cookie } }), "cases", (state) => Object.values(state.cases)), "read persisted cases")
      phase = "reject altered source evidence"
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
      phase = "lose delivery after real commit"
      await tab.route("**/dashboard?sf=workbench-command", async (route) => {
        seen.push({ key: route.request().headers()["idempotency-key"], body: route.request().postData() })
        if (seen.length !== 1) { await route.continue(); return }
        const committed = await route.fetch({ timeout: 10000 })
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
      phase = "reconcile identical request and return to source"
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
      expect(new URL(tab.url()).searchParams.get("year")).toBe("2026")
      phase = "reject stale source and revoked session"
      await within(persistence.transaction("dashboard", async (snapshot) => { snapshot.data.contracts = [{ id: "contract-a", vendor: "Context contract Alpha", amount: 180, currency: "USD" }]; return { commit: true, value: undefined } }), "change source contract")
      expect((await post(sourceRefs, "changed-source"))?.status).toBe(503)
      const unchanged = await readCases()
      expect(unchanged.status === "ok" && unchanged.value.length).toBe(1)
      await tab.goto(contextUrl(), { waitUntil: "domcontentloaded" })
      await form.getByLabel("Decision objective", { exact: true }).fill("Must not persist after logout")
      await form.getByLabel("Currency", { exact: true }).fill("USD")
      await form.getByLabel("Criteria, one per line", { exact: true }).fill("Cost")
      expect(await within(tab.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST", credentials: "same-origin", signal: AbortSignal.timeout(5000) })).status), "logout operator")).toBe(204)
      await form.getByRole("button", { name: "Create decision", exact: true }).click()
      await tab.getByText("Your access changed. Reload before creating a decision.", { exact: true }).waitFor()
      expect(await tab.locator("[data-source-refs], [data-decision-context] h2, [data-decision-context] input").count()).toBe(0)
      expect((await get(contextUrl()))?.status).toBe(403)
      expect((await post(sourceRefs, "revoked-session"))?.status).toBe(403)
      expect(errors).toEqual([])
    } catch (error) {
      browserFailure = error
      console.error("WP01 contextual browser failure", { phase, url: tab?.url(), errors })
      throw error
    } finally {
      const cleanup: unknown[] = []
      try { if (tab && !tab.isClosed()) await within(tab.close({ runBeforeUnload: false }), "close page") } catch (error) { cleanup.push(error) }
      try { await closeWp01Browser(browser) } catch (error) { cleanup.push(error) }
      if (cleanup.length) throw new AggregateError(browserFailure ? [browserFailure, ...cleanup] : cleanup, "Contextual browser cleanup failed")
    }
  } catch (error) { failure = error; console.error("WP01 contextual failure", { phase }); throw error }
  finally {
    const cleanup: unknown[] = []
    try { await within(Promise.resolve(server.stop(true)), "stop server") } catch (error) { cleanup.push(error) }
    try { await within(driver.dispose(), "dispose store") } catch (error) { cleanup.push(error) }
    try { await within(rm(directory, { recursive: true, force: true }), "remove directory") } catch (error) { cleanup.push(error) }
    if (cleanup.length) throw new AggregateError(failure ? [failure, ...cleanup] : cleanup, "Contextual persistence cleanup failed")
  }
}, 90000)
