import { expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDossierServices } from "../../../../../../../apps/cli/src/sucafina-product/dossier-services.ts"
import { createWp06Runtime } from "../../wp06/runtime-fixture.ts"

/** Real persisted credentials, SQLite, Request producer and dossier HTTP; no native execution witness. */
async function fixture(options: { initializedDocuments?: boolean } = {}) {
  const state = await createWp06Runtime({ additionalOperations: ["sf_request_read", "sf_work_list"] })
  // This positive consumer fixture starts from a real, initialized C08 catalog.
  // A read cannot invent an empty catalog when the product state has never been written.
  if (options.initializedDocuments !== false) {
    const initialized = await state.authority.state.transaction(state.request("procurement"), {
      namespace: "documents", expectedStorageVersion: 0,
      targetRef: state.authority.creationTarget.ref, targetIncarnation: state.authority.creationTarget.incarnation,
      idempotencyKey: "fixture-empty-document-catalog", commandDigest: digestSfValue({ fixture: "empty-document-catalog" }),
    }, async () => ({ commit: true, value: null }))
    if (initialized.status !== "ok") throw new Error(`Document catalog fixture failed: ${initialized.reason}`)
  }
  const business = createSfBusinessServices({ authority: state.authority, persistence: state.store,
    proposalCoverageWrites: new WeakSet(), documentRead: state.documents.documents.reader })
  const dossier = createSfDossierServices({ runtime: state.runtime, authority: state.authority, business, documents: state.documents })
  if (!dossier) throw new Error("Dossier service unavailable")
  await state.store.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { settings: { currency: "USD", uploadCap: 100_000 }, requests: {
      r1: { request: { number: "r1", status: "sourcing", createdBy: state.principal.id,
        pr: { title: "Current Request", estAmount: 42 }, history: [], sourcing: {
          quotes: [{ id: "offer-a", currency: "USD", total: 42, techPass: true }, { id: "offer-b", currency: "EUR", techPass: false }],
          approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.1 },
        } } },
    } }
    return { commit: true, value: undefined }
  })
  const request = async (mode: string, query: Record<string, string> = {}, service = dossier) => {
    const url = new URL(`${state.origin}/sucafina/procurement`)
    url.searchParams.set("sf", mode)
    Object.entries(query).forEach(([key, value]) => url.searchParams.set(key, value))
    const response = await service.http(new Request(url, { headers: { cookie: state.cookie } }), "procurement")
    if (!response) throw new Error("Dossier route unavailable")
    return response
  }
  return { state, business, dossier, request, close: async () => { business.dispose(); await state.dispose() } }
}

test("dossier composition retains actual authorized proposal facts and fences a changed second observation", async () => {
  const value = await fixture()
  try {
    const selected = await value.request("sourcing-dossier-requests", { start: "2026-01-01", end: "2026-12-31" })
    expect(selected.status).toBe(200)
    const choices = await selected.json() as { value: { requestRef: string }[] }
    expect(choices.value).toHaveLength(1)
    const requestRef = choices.value[0]!.requestRef
    const before = await value.state.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
    const response = await value.request("sourcing-dossier-read", { requestRef })
    if (response.status !== 200) {
      const producer = await value.state.uiCall("sf_request_read", { requestRef }, (call) => value.dossier.prepare(requestRef, call))
      throw new Error(`Dossier HTTP ${response.status}; real producer ${JSON.stringify(producer)}`)
    }
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ status: "ok", value: {
      commercialSources: {
        proposalTerms: { status: "available", sourceRef: { refId: requestRef },
          offers: [{ offerRef: "offer-a", currency: "USD", amount: 42 }, { offerRef: "offer-b", currency: "EUR", amount: null }],
          submittedBaseCurrency: "USD", submittedFx: [{ from: "EUR", rate: 1.1 }, { from: "USD", rate: 1 }] },
        supplierRegister: { status: "not-selected" },
      }, draft: { domainApplied: false },
    } })
    const direct = await value.state.uiCall("sf_work_list", {}, (call) => value.business.procurementDossier.prepare(requestRef, call))
    expect(direct).toMatchObject({ status: "ok", value: { commercialSources: {
      proposalTerms: { status: "available", sourceRef: { refId: requestRef },
        offers: [{ offerRef: "offer-a", amount: 42 }, { offerRef: "offer-b", amount: null }],
        submittedBaseCurrency: "USD", submittedFx: [{ from: "EUR", rate: 1.1 }, { from: "USD", rate: 1 }] },
      supplierRegister: { status: "not-selected" },
    }, draft: { domainApplied: false } } })
    // Counterproof at the producer seam: retain the real authorization and source
    // envelope, but alter an independently returned fact after the first sample.
    const samples = { count: 0 }
    const changed = createSfDossierServices({ runtime: value.state.runtime, authority: value.state.authority,
      documents: value.state.documents, business: { ...value.business, sourcingEvidence: async (...args) => {
        const read = await value.business.sourcingEvidence(...args)
        if (read.status !== "ok" || ++samples.count === 1) return read
        return { status: "ok", value: { ...read.value, offers: read.value.offers.map((offer) => ({ ...offer, amount: 99 })) } }
      } } })
    if (!changed) throw new Error("Counterproof consumer unavailable")
    const denied = await value.request("sourcing-dossier-read", { requestRef }, changed)
    expect(denied.status).toBe(403)
    expect(await denied.json()).toEqual({ status: "denied" })
    expect(samples.count).toBeGreaterThan(1)
    expect(await value.state.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))).toBe(before)
  } finally { await value.close() }
}, 60_000)

test("dossier does not turn an uninitialized protected document catalog into an empty authorized selection", async () => {
  const value = await fixture({ initializedDocuments: false })
  try {
    const found = await value.request("sourcing-dossier-requests", { start: "2026-01-01", end: "2026-12-31" })
    expect(found.status).toBe(200)
    const choices = await found.json() as { value: { requestRef: string }[] }
    expect(choices.value).toHaveLength(1)
    const requestRef = choices.value[0]!.requestRef
    const produced = await value.state.uiCall("sf_request_read", { requestRef }, (call) => value.dossier.prepare(requestRef, call))
    expect(produced).toEqual({ status: "unavailable", reason: "document-state-unavailable" })
    const response = await value.request("sourcing-dossier-read", { requestRef })
    expect(response.status).toBe(503)
    expect(await response.json()).toEqual({ status: "unavailable" })
    const persisted = await value.state.authority.state.read(value.state.request(), "documents", (state) => state.documents)
    expect(persisted).toEqual({ status: "unavailable", reason: "product-state-uninitialized" })
  } finally { await value.close() }
}, 60_000)

test("the internal dossier reader refuses a real Request changed after authorized discovery", async () => {
  const value = await fixture()
  try {
    const found = await value.request("sourcing-dossier-requests", { start: "2026-01-01", end: "2026-12-31" })
    expect(found.status).toBe(200)
    const choices = await found.json() as { value: { requestRef: string }[] }
    expect(choices.value).toHaveLength(1)
    const ref = choices.value[0]!.requestRef
    const initial = await value.state.uiCall("sf_work_list", {}, (call) => value.business.procurementDossier.prepare(ref, call))
    expect(initial.status).toBe("ok")
    await value.state.store.transaction("procurement", async (snapshot) => {
      const store = snapshot.data.store as { requests: { r1: { request: { sourcing: { fxSnapshot: Record<string, number> } } } } }
      store.requests.r1.request.sourcing.fxSnapshot.EUR = 1.3
      return { commit: true, value: undefined }
    })
    const changed = await value.state.uiCall("sf_work_list", {}, (call) => value.business.procurementDossier.prepare(ref, call))
    expect(changed.status).not.toBe("ok")
    expect(Object.hasOwn(changed, "value")).toBe(false)
  } finally { await value.close() }
}, 60_000)

test("Chromium renders the real dossier commercial terms and next steps without financial writes", async () => {
  const value = await fixture()
  const { chromium } = await import("@playwright/test")
  const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
  const methods: string[] = []
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (incoming) => {
    methods.push(incoming.method)
    const url = new URL(incoming.url)
    const request = new Request(new URL(url.pathname + url.search, value.state.origin), { method: incoming.method, headers: incoming.headers, signal: incoming.signal })
    return await value.dossier.http(request, "procurement") ?? new Response("Not found", { status: 404 })
  } })
  const resources: { browser?: Browser; close?: () => Promise<void> } = {}
  try {
    const before = await value.state.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
    resources.browser = browser
    resources.close = await captureChromiumCleanup(browser)
    const context = await browser.newContext()
    const separator = value.state.cookie.indexOf("=")
    await context.addCookies([{ name: value.state.cookie.slice(0, separator), value: value.state.cookie.slice(separator + 1), url: server.url.origin }])
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(`${server.url.origin}/sucafina/procurement?sf=sourcing-dossier`))?.status()).toBe(200)
    await page.getByLabel("Start date", { exact: true }).fill("2026-01-01")
    await page.getByLabel("End date", { exact: true }).fill("2026-12-31")
    await page.getByRole("button", { name: "Load Requests", exact: true }).click()
    await page.getByRole("option", { name: "Request r1", exact: true }).waitFor({ state: "attached" })
    await page.getByRole("button", { name: "Show dossier", exact: true }).click()
    await page.getByRole("heading", { name: "Request proposal terms", exact: true }).waitFor({ state: "visible" })
    expect(await page.getByRole("region", { name: "Dossier", exact: true }).textContent()).toContain('"amount": 42')
    expect(await page.getByRole("region", { name: "Dossier", exact: true }).textContent()).toContain('"amount": null')
    expect(await page.getByText("Supplier register: not-selected", { exact: true }).isVisible()).toBe(true)
    expect(await page.getByRole("heading", { name: "Next steps", exact: true }).isVisible()).toBe(true)
    expect(await page.getByRole("heading", { name: "Draft conditions and gaps", exact: true }).isVisible()).toBe(true)
    expect(errors).toEqual([])
    expect(methods.length).toBeGreaterThan(2)
    expect(methods.every((method) => method === "GET")).toBe(true)
    expect(await value.state.store.transaction("procurement", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data.store) }))).toBe(before)
  } finally {
    try { await resources.close?.() } finally { if (!resources.close) await resources.browser?.close(); server.stop(true); await value.close() }
  }
}, 60_000)
