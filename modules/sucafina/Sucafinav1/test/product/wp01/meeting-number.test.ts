import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object, rows } from "../../../runtime/contract.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { createRecoveryFixture } from "../wp02/workbench-recovery-fixture.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }

function budgetTotal(response: unknown) {
  expect(object(response).status).toBe("ok")
  const sections = rows(object(object(response).value).sections)
  expect(sections).toHaveLength(1)
  const projection = object(sections[0]!.projection)
  expect(object(projection.context).period).toEqual(period)
  const values = rows(projection.values).filter((value) => value.id === "budgetMetrics.2026.totalBudget")
  expect(values).toHaveLength(1)
  expect(values[0]).toMatchObject({ currency: "unspecified", period, granularity: "year", evidenceState: "estimated" })
  return values[0]!.value
}

// Reuse the published real host fixture: encrypted operator identity, SQLite,
// source lifecycle, C08 authority, Dashboard services and actual HTTP handlers.
// The initial business records are fixtures. The later change is a canonical
// domain command, not a store edit or a replacement consumer response.
test("a live Dashboard meeting keeps its financial number during background refresh and reopens an authorized historical capture", async () => {
  const fixture = await createRecoveryFixture()
  const browser = await launchWp01Browser().catch(async (error) => { await fixture.close(); throw error })
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "meeting-owner", name: "Meeting Operations", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "meeting-january", ownerId: "meeting-owner", year: 2026, month: 1, budget: 200, actual: 0, forecast: 200 }]
      snapshot.data.capexProjects = []
      snapshot.data.capexEntries = []
      return { commit: true, value: undefined }
    })
    const context = await browser.newContext()
    const page = await context.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(`${fixture.origin}/sucafina/auth/local?code=${await fixture.identity.enroll()}`))?.status()).toBe(200)
    const url = `${fixture.origin}/sucafina/dashboard?page=Budget+Overview&year=2026`
    await page.goto(url)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const panel = page.locator("[data-dashboard-workbench]")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()

    const captured = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-capture")
    await panel.getByLabel("Registro para preservar").selectOption({ label: "Meeting Operations" })
    await panel.getByRole("button", { name: "Preservar retrato", exact: true }).click()
    const captureResponse = await captured
    expect(captureResponse.status()).toBe(200)
    const capture = object(object(await captureResponse.json()).value)
    expect(typeof capture.captureId).toBe("string")
    await panel.getByText("Retrato do registro preservado.", { exact: true }).waitFor()

    const previewed = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-agenda")
    await panel.getByRole("button", { name: "Pré-visualizar pauta", exact: true }).click()
    const previewResponse = await previewed
    expect(previewResponse.status()).toBe(200)
    expect(budgetTotal(await previewResponse.json())).toBe(1300)
    await panel.getByText("Pauta pronta para revisão.", { exact: true }).waitFor()
    const agenda = panel.locator("[data-dashboard-agenda-view]")
    const total = agenda.getByRole("row").filter({ has: page.getByRole("cell", { name: "Orçamento total", exact: true }) })
    expect(await total.locator("td").allTextContents()).toEqual([
      "Orçamento total", "2026-01-01 a 2026-12-31", "1300", "Moeda não informada", "Estimado", "Budget Overview",
    ])
    const meeting = await agenda.textContent()

    const historySelect = panel.getByLabel("Reunião ou retrato preservado")
    expect(await historySelect.locator("option").count()).toBe(2)
    await historySelect.selectOption({ index: 1 })
    const firstHistory = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-history")
    await panel.getByRole("button", { name: "Abrir histórico", exact: true }).click()
    const firstResponse = await firstHistory
    expect(firstResponse.status()).toBe(200)
    expect(new URL(firstResponse.url()).searchParams.get("id")).toBe(capture.captureId)
    const original = object(object(await firstResponse.json()).value)
    expect(original.state).toBe("historical")
    expect(rows(object(original.projection).values)).toContainEqual(expect.objectContaining({ id: "opexOwners:meeting-owner:budget", value: 1200 }))
    await panel.getByText("Histórico aberto com seu acesso atual.", { exact: true }).waitFor()
    const history = panel.locator("[data-dashboard-history-view]")
    expect(await history.textContent()).toContain("Retrato histórico de 2026-11-13")
    const originalHistory = await history.textContent()
    const originalSelection = await historySelect.inputValue()

    const changed = await context.request.post(`${fixture.origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`, {
      headers: { origin: fixture.origin },
      data: { page: "OPEX Detail", action: "save", id: "meeting-owner", version: 0, values: { name: "Meeting Operations", budget: 2400 } },
    })
    expect(changed.status()).toBe(200)
    expect(await changed.json()).toMatchObject({ ok: true })
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: {
      owner: rows(snapshot.data.opexOwners)[0], version: snapshot.versions["opexOwners:meeting-owner"]?.version,
      january: rows(snapshot.data.opexEntries)[0],
    } }))).toEqual({
      owner: { id: "meeting-owner", name: "Meeting Operations", budget: 2400 }, version: 1,
      january: { id: "meeting-january", ownerId: "meeting-owner", year: 2026, month: 1, budget: 200, actual: 0, forecast: 200 },
    })

    const refreshed = page.waitForResponse((response) => response.url() === url && response.request().method() === "GET")
    await page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
    expect((await refreshed).status()).toBe(200)
    expect(await panel.getAttribute("data-sf-retain-view")).toBe("true")
    expect(await agenda.textContent()).toBe(meeting)
    expect(await total.locator("td").nth(2).textContent()).toBe("1300")
    expect(await history.textContent()).toBe(originalHistory)
    expect(await historySelect.inputValue()).toBe(originalSelection)
    expect(await panel.getByLabel("Início do período").inputValue()).toBe(period.start)
    expect(await panel.getByLabel("Fim do período").inputValue()).toBe(period.end)

    // A separate authorized read proves that the real producer has changed;
    // the meeting's stability cannot pass merely because refresh failed.
    const currentOptions = await context.request.post(`${fixture.origin}/sucafina/dashboard?sf=dashboard-workbench`, {
      headers: { origin: fixture.origin, "idempotency-key": randomUUID() }, data: { page: "Budget Overview", period },
    })
    expect(currentOptions.status()).toBe(200)
    const selection = object(object(object(await currentOptions.json()).value).agenda).section
    const currentAgenda = await context.request.post(`${fixture.origin}/sucafina/dashboard?sf=dashboard-agenda`, {
      headers: { origin: fixture.origin, "idempotency-key": randomUUID() }, data: { sections: [selection] },
    })
    expect(currentAgenda.status()).toBe(200)
    expect(budgetTotal(await currentAgenda.json())).toBe(2400)
    expect(await total.locator("td").nth(2).textContent()).toBe("1300")

    // Refreshing the chosen agenda is explicit. The historical capture remains
    // separately identified and can still be read under current authorization.
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await agenda.textContent()).toBe("")
    expect(await history.textContent()).toBe("")
    await panel.getByRole("button", { name: "Pré-visualizar pauta", exact: true }).click()
    await panel.getByText("Pauta pronta para revisão.", { exact: true }).waitFor()
    expect(await total.locator("td").nth(2).textContent()).toBe("2400")
    await historySelect.selectOption({ index: 1 })
    const reopened = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-history")
    await panel.getByRole("button", { name: "Abrir histórico", exact: true }).click()
    const historicalResponse = await reopened
    expect(historicalResponse.status()).toBe(200)
    expect(new URL(historicalResponse.url()).searchParams.get("id")).toBe(capture.captureId)
    const historical = object(object(await historicalResponse.json()).value)
    expect(historical.state).toBe("historical")
    expect(historical.capturedAt).toBe(original.capturedAt)
    expect(historical.projection).toEqual(original.projection)
    await panel.getByText("Histórico aberto com seu acesso atual.", { exact: true }).waitFor()
    expect(await history.textContent()).toBe(originalHistory)
    expect(await total.locator("td").nth(2).textContent()).toBe("2400")
    expect(errors).toEqual([])
  } finally {
    const outcomes = await Promise.allSettled([closeWp01Browser(browser), fixture.close()])
    const failures = outcomes.flatMap((outcome) => outcome.status === "rejected" ? [outcome.reason] : [])
    if (failures.length) throw new AggregateError(failures, "Meeting number fixture cleanup failed")
  }
}, 60_000)

// C05 requires the whole preserved review to survive a material source update.
// This independent HTTP test deliberately requires the positive contract; a
// current-source denial is a host integration failure, not an accepted outcome.
test("C05 reopens the same preserved financial meeting after a canonical budget change with its original authorized content", async () => {
  const fixture = await createRecoveryFixture()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "preserved-owner", name: "Preserved Operations", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "preserved-january", ownerId: "preserved-owner", year: 2026, month: 1, budget: 200, actual: 0, forecast: 200 }]
      snapshot.data.capexProjects = []
      snapshot.data.capexEntries = []
      return { commit: true, value: undefined }
    })
    const cookie = fixture.request().headers.get("cookie")!
    const post = (mode: string, value: unknown) => fetch(`${fixture.origin}/sucafina/dashboard?sf=${mode}`, {
      method: "POST", headers: { cookie, origin: fixture.origin, "content-type": "application/json", "idempotency-key": randomUUID() }, body: JSON.stringify(value),
    })
    const discovered = await post("dashboard-workbench", { page: "Budget Overview", period })
    expect(discovered.status).toBe(200)
    const options = object(object(await discovered.json()).value)
    const previewed = await post("dashboard-agenda", { sections: [object(options.agenda).section] })
    expect(previewed.status).toBe(200)
    const previewResponse = await previewed.json()
    expect(budgetTotal(previewResponse)).toBe(1300)
    const preview = object(object(previewResponse).value)
    const preserved = await post("dashboard-review-preserve", { selectionRef: preview.selectionRef, sectionRefs: rows(preview.sections).map((section) => section.id) })
    expect(preserved.status).toBe(200)
    const preservedResponse = object(await preserved.json())
    expect(preservedResponse.status).toBe("ok")
    const original = object(preservedResponse.value)
    expect(typeof original.id).toBe("string")
    expect(typeof original.createdAt).toBe("string")
    expect(Number.isFinite(Date.parse(String(original.createdAt)))).toBe(true)
    expect(original.version).toBe(1)
    const originalSections = rows(original.sections)
    expect(originalSections).toHaveLength(1)
    expect(originalSections[0]).toMatchObject({ title: "Budget Overview", period, count: 1 })
    const originalProjection = object(originalSections[0]!.content)
    expect(rows(originalProjection.values)).toContainEqual(expect.objectContaining({ id: "budgetMetrics.2026.totalBudget", value: 1300, period, currency: "unspecified", evidenceState: "estimated" }))
    const originalSource = rows(object(originalProjection.context).sourceRefs).find((source) => source.type === "dashboard-page" && source.id === "Budget Overview")
    expect(originalSource).toBeDefined()
    const historyUrl = new URL(`${fixture.origin}/sucafina/dashboard`)
    historyUrl.searchParams.set("sf", "dashboard-review")
    historyUrl.searchParams.set("id", String(original.id))
    const before = await fetch(historyUrl, { headers: { cookie } })
    expect(before.status).toBe(200)
    expect(await before.json()).toEqual({ status: "ok", value: original })

    const changed = await fetch(`${fixture.origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`, {
      method: "POST", headers: { cookie, origin: fixture.origin, "content-type": "application/json" },
      body: JSON.stringify({ page: "OPEX Detail", action: "save", id: "preserved-owner", version: 0, values: { name: "Preserved Operations", budget: 2400 } }),
    })
    expect(changed.status).toBe(200)
    expect(await changed.json()).toMatchObject({ ok: true })
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: {
      budget: rows(snapshot.data.opexOwners)[0]!.budget, version: snapshot.versions["opexOwners:preserved-owner"]?.version,
    } }))).toEqual({ budget: 2400, version: 1 })

    // The same authenticated operator still reads the same source incarnation.
    // Its larger current version changes the live number, not the historical body.
    const currentDiscovery = await post("dashboard-workbench", { page: "Budget Overview", period })
    expect(currentDiscovery.status).toBe(200)
    const currentOptions = object(object(await currentDiscovery.json()).value)
    const current = await post("dashboard-agenda", { sections: [object(currentOptions.agenda).section] })
    expect(current.status).toBe(200)
    const currentResponse = await current.json()
    expect(budgetTotal(currentResponse)).toBe(2400)
    const currentProjection = object(rows(object(object(currentResponse).value).sections)[0]!.projection)
    const currentSource = rows(object(currentProjection.context).sourceRefs).find((source) => source.type === "dashboard-page" && source.id === "Budget Overview")
    expect(currentSource?.incarnation).toBe(originalSource!.incarnation)
    expect(Number(currentSource?.version)).toBeGreaterThan(Number(originalSource!.version))

    const reopened = await fetch(historyUrl, { headers: { cookie } })
    const reopenedResponse = object(await reopened.json())
    console.info("SF_WP01_C05_HISTORICAL_REVIEW", { reviewId: original.id, originalCreatedAt: original.createdAt, originalTotal: 1300, currentTotal: 2400,
      sameSourceIncarnation: currentSource?.incarnation === originalSource!.incarnation, httpStatus: reopened.status, resultStatus: reopenedResponse.status, reason: reopenedResponse.reason })
    expect(reopened.status).toBe(200)
    expect(reopenedResponse.status).toBe("ok")
    expect(reopenedResponse.value).toEqual(original)
    expect(rows(currentOptions.history)).toContainEqual(expect.objectContaining({ kind: "review", ref: original.id }))
  } finally { await fixture.close() }
}, 60_000)
