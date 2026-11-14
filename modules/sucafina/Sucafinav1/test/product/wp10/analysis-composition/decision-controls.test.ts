import { expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { decorateSfDecisionControlsHtml } from "../../../../product/integration/decision-controls-link.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfDecisionDomainServices } from "../../../../../../../apps/cli/src/sucafina-product/decision-domain-services.ts"
import { createSfDecisionDomainHttp } from "../../../../../../../apps/cli/src/sucafina-product/decision-domain-http.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import type { BaselineCoverageRequest } from "../../../../product/decisions/baseline-coverage.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"

// Real C08, SQLite, source issuer, domain registries and HTTP. The identity fixture is not a native/global acceptance run.
async function fixture(origin: string) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-decision-controls-"))
  const driver = await openLocalStore(path.join(directory, "store"))
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") }) }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  const actor = { active: true, canWrite: true, milliseconds: Date.parse("2026-11-14T00:00:00Z") }
  const proposalCoverageWrites = new WeakSet<object>()
  const signalRegistryWrites = new WeakSet<object>()
  const identity = { installationId: "installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin, policyVersion: "policy", persistence,
    grants: ["person", "person-two"].map((principalRef) => ({ principalRef, namespaces: ["cases", "preferences"] as const, operations: ["sf_case_read", "sf_forecast_compare"] as const,
      humanActions: ["decisions.coverage", "decisions.criteria", "decisions.select-portfolio", "decisions.condition.record"] as const })),
    proposalCoverageWrites, signalRegistryWrites, now: Date.now, createId: randomUUID,
    authenticate: async (request, scope) => actor.active && scope ? { id: request.headers.get("x-sf-test-principal") === "person-two" ? "person-two" : "person", canWrite: actor.canWrite, roles: [{ surface: scope.surface, role: actor.canWrite ? "admin" : "viewer" }] } : null,
    environment: async () => ({ at: new Date(actor.milliseconds).toISOString(), id: randomUUID, directory: [] }),
    commandIdentity: async (request, operation) => request.method === "GET" || request.method === "HEAD" ? randomUUID() : request.headers.get("Idempotency-Key") ? digestSfValue({ operation, key: request.headers.get("Idempotency-Key") }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const request = new Request(`${origin}/sf/planner`, { method: "POST", headers: { origin, "Idempotency-Key": "fixture-seed" } })
  const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
  const horizon = { start: "2026-01-01", end: "2026-12-31" }
  const seeded = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: authority.creationTarget.ref,
    targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "seed-controls-case", commandDigest: digestSfValue(caseRef) }, async (state) => {
    state.cases.case = { ...caseRef, state: "draft", objective: "Renovação de licenças", horizon, currency: "USD", criteria: [{ id: "cost", description: "Limite de custo", required: true }],
      participants: ["person", "person-two"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    state.cases.private = { ...structuredClone(state.cases.case), id: "private", incarnation: "private-inc", objective: "SEGREDO OUTRO PARTICIPANTE", participants: ["other"] }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("Controls fixture could not initialize C08")
  await persistence.transaction("planner", async (snapshot) => {
    const version = { id: "v0", name: "Forecast", year: 2026, closed: 0, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD",
      b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }
    snapshot.data.versions = [version, { ...structuredClone(version), id: "v1" }]
    return { commit: true, value: true }
  })
  await persistence.initializeSources("planner")
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  const domain = createSfDecisionDomainServices({ authority, business, baseline: business.baselineCoverage, proposalCoverageWrites, signalRegistryWrites, selectedCase: business.selectedCase })
  business.bindDecisionDomain(domain)
  business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "a".repeat(64), manifestVersion: "b".repeat(64), skillVersion: "c".repeat(64) })
  const digest = digestSfValue({ caseRef })
  const reader = await authority.ui.admit(new Request(`${origin}/sf/planner`), "sf_forecast_compare", digest)
  if (reader.status !== "ok" || !await authority.ui.validate(reader.value, "sf_forecast_compare", digest)) throw new Error("Controls read authority unavailable")
  const issued = await business.plannerProduct.issueSource("v0", reader.value)
  if (issued.status !== "ok") throw new Error("Controls source unavailable")
  const second = await business.plannerProduct.issueSource("v1", reader.value)
  if (second.status !== "ok") throw new Error("Second authorized controls source unavailable")
  const forecast = await business.planner.compareForecast({ baseRef: issued.value.evidence.refId, candidateRef: issued.value.evidence.refId, period: horizon, currency: "USD" }, reader.value)
  if (forecast.status !== "ok") throw new Error("Controls forecast unavailable")
  authority.ui.finish(reader.value)
  const basis = { id: "renewal", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: [issued.value.evidence] }
  const current = await authority.state.read(request, "cases", () => null)
  if (current.status !== "ok") throw new Error("Controls case unavailable")
  const linked = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id,
    targetIncarnation: caseRef.incarnation, idempotencyKey: "link-controls-source", commandDigest: digestSfValue(basis) }, async (state) => {
    state.cases.case!.sourceRefs = [issued.value.evidence, second.value.evidence]
    state.cases.case!.costCoverageBases = [basis]
    return { commit: true, value: true }
  })
  if (linked.status !== "ok") throw new Error("Controls source linkage unavailable")
  const coverage: BaselineCoverageRequest = { caseRef, source: issued.value.evidence, basis, expectedVersion: 0,
    entries: RENEWAL_TRANSITION_CATEGORIES.map((categoryId) => categoryId === "service"
      ? { categoryId, status: "included", componentRefs: forecast.value.baseline.components.map((component) => component.id), evidenceRefs: [issued.value.evidence], scopeNote: "Serviço classificado pelo usuário" }
      : { categoryId, status: "pending", reason: "Aguardando comprovante" }) }
  const http = createSfDecisionDomainHttp({ origin, mount: "/sf", runtime: () => ({ authority, business, domain }) })
  const addOtherCase = async () => {
    const current = await authority.state.read(request, "cases", () => null)
    if (current.status !== "ok") throw new Error("Cases unavailable")
    const result = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "other-case",
      commandDigest: digestSfValue("other-case") }, async (state) => {
      state.cases.other = { ...structuredClone(state.cases.case!), id: "other", incarnation: "other-inc", objective: "Outra decisão autorizada" }
      return { commit: true, value: true }
    })
    if (result.status !== "ok") throw new Error("Other case could not be saved")
  }
  return { actor, authority, business, domain, http, coverage, caseRef, request, source: issued.value.evidence, secondSource: second.value.evidence, addOtherCase,
    close: async () => { domain.dispose(); business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}

test("decision controls use authorized cases and real absence, and revalidate every surface and read", async () => {
  const state = await fixture("https://example.test")
  try {
    const query = new URLSearchParams({ sf: "decision-controls", case: encodeCaseRef(state.caseRef), source: state.source.refDigest })
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      const response = await state.http(new Request(`https://example.test/sf/${surface}?${query}`), surface)
      expect(response?.status).toBe(200)
      expect(response?.headers.get("Content-Security-Policy")).toContain("script-src")
      const html = await response!.text()
      expect(html).toContain("Renovação de licenças")
      expect(html).toContain("Nova classificação")
      expect(html).toContain('data-decision-action="decision-coverage"')
      expect(html).toContain("dois cenários armazenados")
      expect(html).toContain("Forecast v0 ·")
      expect(html).toContain("Forecast v1 ·")
      expect(html).not.toContain("SEGREDO OUTRO PARTICIPANTE")
    }
    const head = await state.http(new Request(`https://example.test/sf/planner?${query}`, { method: "HEAD" }), "planner")
    expect(head?.status).toBe(200)
    expect(await head!.text()).toBe("")
    const wrong = await state.http(new Request(`https://example.test/sf/other?${query}`), "planner")
    expect(wrong?.status).toBe(403)
    const cross = await state.http(new Request(`https://example.test/sf/planner?${query}`, { headers: { "Sec-Fetch-Site": "cross-site" } }), "planner")
    expect(cross?.status).toBe(403)
    state.actor.active = false
    expect((await state.http(new Request(`https://example.test/sf/planner?${query}`), "planner"))?.status).toBe(403)
  } finally { await state.close() }
}, 60_000)

test("human coverage POSTs from all workbench surfaces share the real CAS and identical-retry receipt", async () => {
  const state = await fixture("https://example.test")
  try {
    const post = (surface: string, payload: unknown, key = "coverage-human-choice") => state.http(new Request(`https://example.test/sf/${surface}?sf=decision-coverage`, {
      method: "POST", headers: { origin: "https://example.test", "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload) }), surface)
    const first = await post("dashboard", state.coverage)
    expect(first?.status).toBe(200)
    const expected = await first!.json()
    const before = await state.authority.state.read(state.request, "preferences", () => null)
    for (const surface of ["planner", "procurement"]) {
      const retry = await post(surface, state.coverage)
      expect(retry?.status).toBe(200)
      expect(await retry!.json()).toEqual(expected)
    }
    const after = await state.authority.state.read(state.request, "preferences", () => null)
    expect(before.status === "ok" && after.status === "ok" && before.storageVersion === after.storageVersion).toBe(true)
    const conflict = await post("procurement", { ...state.coverage, expectedVersion: 99 })
    expect(conflict?.status).toBe(409)
    const stale = await post("planner", state.coverage, "new-human-choice")
    expect(stale?.status).toBe(409)
    state.actor.canWrite = false
    expect((await post("dashboard", state.coverage))?.status).toBe(403)
  } finally { await state.close() }
}, 60_000)

test("Chromium navigates the own decision controls, saves real classification and removes revoked content", async () => {
  const { chromium } = await import("@playwright/test")
  const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
  const handle: { http?: ReturnType<typeof createSfDecisionDomainHttp> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => {
    const response = await handle.http?.(request, "planner")
    return response ?? new Response(decorateSfDecisionControlsHtml('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main><h1>Planner</h1></main></body></html>', "planner"), { headers: { "Content-Type": "text/html; charset=utf-8" } })
  } })
  const resources: { state?: Awaited<ReturnType<typeof fixture>>; browser?: Browser; closeBrowser?: () => Promise<void> } = {}
  try {
    const state = await fixture(server.url.origin)
    resources.state = state
    handle.http = state.http
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
    resources.browser = browser
    resources.closeBrowser = await captureChromiumCleanup(browser)
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const landing = await page.goto(`${server.url.origin}/sf/planner`)
    expect(landing?.status()).toBe(200)
    expect(await page.evaluate(() => document.characterSet)).toBe("UTF-8")
    await page.getByRole("link", { name: "Controles da decisão" }).click()
    await page.getByLabel("Caso de decisão", { exact: true }).selectOption({ label: "Renovação de licenças · revisão 1" })
    await page.getByRole("button", { name: "Abrir caso", exact: true }).click()
    const forecastChoices = await page.getByLabel("Forecast para classificar", { exact: true }).locator('option').allTextContents()
    expect(new Set(forecastChoices).size).toBe(forecastChoices.length)
    await page.getByLabel("Forecast para classificar", { exact: true }).selectOption(state.secondSource.refDigest)
    await page.getByRole("button", { name: "Abrir forecast", exact: true }).click()
    await page.locator('[data-classification-version="0"]').waitFor()
    const groups = page.locator('[data-decision-action="decision-coverage"] fieldset')
    expect(await groups.count()).toBe(RENEWAL_TRANSITION_CATEGORIES.length)
    await groups.nth(0).getByLabel("Escopo ou motivo da pendência").fill("Rascunho preservado após nova observação")
    state.actor.milliseconds += 60_000
    await state.addOtherCase()
    const observed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("format") === "json")
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    expect((await observed).status()).toBe(200)
    await page.waitForFunction(() => !document.getElementById("sf-decision-status")?.textContent?.includes("mudaram"))
    expect(await groups.nth(0).getByLabel("Escopo ou motivo da pendência").inputValue()).toBe("Rascunho preservado após nova observação")
    for (let index = 0; index < RENEWAL_TRANSITION_CATEGORIES.length; index++) await groups.nth(index).getByLabel("Escopo ou motivo da pendência").fill(index === 0 ? "Licenças do serviço no período selecionado" : "Aguardando comprovante")
    await groups.nth(0).getByLabel("Classificação", { exact: true }).selectOption("included")
    await groups.nth(0).getByLabel("Componentes incluídos", { exact: true }).selectOption({ index: 0 })
    await page.getByRole("button", { name: "Salvar classificação", exact: true }).focus()
    await page.keyboard.press("Enter")
    await page.locator('[data-classification-version="1"]').waitFor({ timeout: 20_000 })
    const selected = new URL(page.url()); selected.searchParams.set("format", "json")
    const stored = await (await page.request.get(selected.href)).json()
    expect(stored.value.selected.forecast.source.refDigest).toBe(state.secondSource.refDigest)
    expect(stored.value.selected.forecast.expectedVersion).toBe(1)
    expect(await page.locator("body").textContent()).toContain("Licenças do serviço no período selecionado")
    // Existing test-ci Bun artifact transport; the payload and receipt identify WP10 explicitly.
    const output = path.resolve(import.meta.dir, "../../../../../e2e/test-results/lean-visual")
    await mkdir(output, { recursive: true })
    for (const width of [320, 768, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.screenshot({ path: path.join(output, `wp10-decision-controls-${width}.png`), fullPage: true, timeout: 10_000 })
      expect(await page.locator(".sf-decision-controls").evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth)).toBe(true)
    }
    await writeFile(path.join(output, "wp10-decision-controls.json"), JSON.stringify({
      schema: "wp10-decision-controls-viewport-v1", executedSnapshotCommit: process.env.GITHUB_SHA,
      workflowRunId: process.env.GITHUB_RUN_ID, workflowRunAttempt: process.env.GITHUB_RUN_ATTEMPT,
      widths: [320, 768, 1440], height: 1000, screenshots: [320, 768, 1440].map((width) => `wp10-decision-controls-${width}.png`),
      identityQualification: "Two test principals authorized by real C08; no installed enterprise identity or native AI acceptance",
      transportQualification: "Existing test-ci Bun PNG/JSON upload directory; this is WP10 decision controls, not a Lean dashboard proof",
      observed: ["Published Planner evidence and real classification receipt", "Save submitted by keyboard Enter", "Transient observation timestamp preserves pending edits"],
    }, null, 2) + "\n")
    const humanDraft = "Observação humana preservada após edição concorrente"
    await groups.nth(0).getByLabel("Escopo ou motivo da pendência").fill(humanDraft)
    await groups.nth(0).getByLabel("Classificação", { exact: true }).selectOption("included")
    const secondRequest = new Request(`${server.url.origin}/sf/planner`, { method: "POST", headers: { origin: server.url.origin,
      "Idempotency-Key": "second-participant-edit", "x-sf-test-principal": "person-two" } })
    const beforeEdit = await state.authority.state.read(secondRequest, "cases", (_stored, actor) => actor.principalRef)
    if (beforeEdit.status !== "ok") throw new Error("Concurrent edit fixture cannot read the case")
    expect(beforeEdit.value).toBe("person-two")
    const edited = await state.authority.state.transaction(secondRequest, { namespace: "cases", expectedStorageVersion: beforeEdit.storageVersion,
      targetRef: state.caseRef.id, targetIncarnation: state.caseRef.incarnation, idempotencyKey: "concurrent-authorized-edit",
      commandDigest: digestSfValue({ objective: "Renovação revisada por participante" }) }, async (stored, actor) => {
      stored.cases.case!.version += 1
      stored.cases.case!.objective = "Renovação revisada por participante"
      return { commit: true, value: actor.principalRef }
    })
    expect(edited.status).toBe("ok")
    if (edited.status === "ok") expect(edited.value).toBe("person-two")
    const conflictRead = page.waitForResponse((response) => new URL(response.url()).searchParams.get("format") === "json")
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    expect((await conflictRead).status()).toBe(200)
    await page.getByLabel("Rascunho local preservado", { exact: true }).waitFor()
    expect(await page.getByLabel("Rascunho local preservado", { exact: true }).inputValue()).toContain(humanDraft)
    expect(await page.getByLabel("Rascunho local preservado", { exact: true }).inputValue()).toContain("included")
    expect(await page.locator('[data-decision-action]').count()).toBe(0)
    expect(await page.locator("#sf-decision-data").count()).toBe(0)
    expect(await page.locator("select option").count()).toBe(0)
    expect(await page.locator("body").textContent()).not.toContain("Renovação de licenças")
    await page.screenshot({ path: path.join(output, "wp10-decision-controls-preserved-draft.png"), fullPage: true, timeout: 10_000 })
    const stillAuthorized = page.waitForResponse((response) => new URL(response.url()).searchParams.get("format") === "json")
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    expect((await stillAuthorized).status()).toBe(200)
    expect(await page.getByLabel("Rascunho local preservado", { exact: true }).inputValue()).toContain(humanDraft)
    state.actor.active = false
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await page.getByText("O acesso ou as fontes mudaram. Abra novamente o caso.", { exact: true }).waitFor({ timeout: 15_000 })
    expect(await page.locator("#sf-decision-selected").count()).toBe(0)
    expect(await page.locator("#sf-decision-data").count()).toBe(0)
    expect(await page.locator("#sf-decision-draft").count()).toBe(0)
    await page.screenshot({ path: path.join(output, "wp10-decision-controls-revoked.png"), fullPage: true, timeout: 10_000 })
    expect(await page.locator("body").textContent()).not.toContain("Renovação de licenças")
    expect(await page.locator("select option").count()).toBe(0)
    state.actor.active = true
    await page.goto(`${server.url.origin}/sf/planner?sf=decision-controls`)
    expect(await page.getByLabel("Caso de decisão", { exact: true }).textContent()).toContain("Renovação revisada por participante")
    state.actor.active = false
    await page.evaluate(() => window.dispatchEvent(new Event("focus")))
    await page.getByText("O acesso ou as fontes mudaram. Abra novamente o caso.", { exact: true }).waitFor({ timeout: 15_000 })
    expect(await page.locator("body").textContent()).not.toContain("Renovação revisada por participante")
    expect(await page.locator("select option").count()).toBe(0)
    expect(errors).toEqual([])
  } finally {
    server.stop(true)
    try {
      // The published ownership helper bounds Chrome RPC closure and verifies the process group.
      if (resources.closeBrowser) await resources.closeBrowser()
      else await resources.browser?.close()
    } finally { await resources.state?.close() }
  }
}, 120_000)
