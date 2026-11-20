import { expect, test } from "bun:test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { launchBrowserDriver } from "./browser-driver-fixture.ts"
import { createNativeDashboardFixture } from "./native-browser-fixture.ts"
import { object, rows } from "../../../runtime/contract.ts"

// The production F01 owner mounts the native leaves. Browser edits reach the
// admitted transport, encrypted operator identity, original commands and SQLite.
test("Dashboard browser keeps the monthly draft through a real conflict, reviews three values and preserves record navigation", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createNativeDashboardFixture()
  const { origin, persistence, ownerId, otherOwnerId, janId, febId, delayed } = fixture
  const browserDriver = await launchBrowserDriver("dashboard-monthly").catch(async (error) => {
    await fixture.close()
    throw error
  })
  try {
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.projects = [
        { id: "project-1", name: "Cloud migration", status: "Planning", risk: "High", pm: "Owner", end: "2026-12-10", watchList: true },
        { id: "project-2", name: "Other project", status: "Completed", risk: "Low", pm: "Other", watchList: false },
      ]
      snapshot.data.hotTopics = [{ id: "review-action", action: "Review action", owner: "owner", status: "open", priority: "normal", due: "2026-10-01", notes: "" }]
      snapshot.data.risks = Array.from({ length: 20 }, (_, index) => ({ id: `risk-${index + 1}`, title: `Review risk ${String(index + 1).padStart(2, "0")}`, status: "open", impact: 4, probability: 4, due: `2026-11-${String(index + 1).padStart(2, "0")}` }))
      return { commit: true, value: undefined }
    })
    const context = await browserDriver.browser.newContext()
    await context.addCookies([fixture.cookie])
    const page = await context.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    page.on("dialog", (dialog) => dialog.accept())
    const url = origin + "/orchestra/sf-dashboard/opex?year=2026"
    expect((await page.goto(url))?.ok()).toBe(true)
    await page.locator(`tr[data-sf-row="${ownerId}"] button[data-sf-action="select"]`).click()
    const row = page.locator('.sf-budget-detail tr[data-sf-month="1"]')
    const openMonth = row.getByRole("button", { name: "Save month", exact: true })
    await openMonth.click()
    const month = page.locator('.sf-budget-editor[data-sf-action="save-entry"]')
    await month.getByLabel("budget", { exact: true }).fill("123")
    await month.getByLabel("actual", { exact: true }).fill("34")
    await month.getByLabel("forecast", { exact: true }).fill("140")

    // Corpus creation used actual commands, so this editor holds v1. A second
    // authenticated request commits v2 without touching the local three-field draft.
    const competing = await context.request.post(origin + "/sucafina/dashboard", {
      headers: { origin }, data: { page: "OPEX Detail", action: "save-entry", id: janId, version: 1,
        values: { ownerId, year: 2026, month: 1, budget: 110, actual: 30, forecast: 115 } },
    })
    expect(competing.status()).toBe(200)
    expect(await competing.json()).toMatchObject({ ok: true })
    await month.getByRole("button", { name: "Review changes", exact: true }).click()
    await month.getByRole("button", { name: "Save", exact: true }).click()
    await month.getByText("The source changed. Review your draft against the current version.", { exact: true }).waitFor()
    expect(await month.getByLabel("budget", { exact: true }).inputValue()).toBe("123")
    expect(await month.getByLabel("actual", { exact: true }).inputValue()).toBe("34")
    expect(await month.getByLabel("forecast", { exact: true }).inputValue()).toBe("140")
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: rows(snapshot.data.opexEntries).find((item) => item.id === janId) }))).toMatchObject({ budget: 110, actual: 30, forecast: 115 })
    await month.getByRole("button", { name: "Load current version and keep my edits", exact: true }).click()
    const currentRecord = month.locator('.sf-budget-current[data-sf-current-version="2"]')
    await currentRecord.waitFor()
    expect(await currentRecord.textContent()).toContain("110")
    expect(await currentRecord.textContent()).toContain("30")
    expect(await currentRecord.textContent()).toContain("115")
    expect(await month.getAttribute("data-sf-version")).toBe("2")
    expect(await month.getByLabel("budget", { exact: true }).inputValue()).toBe("123")
    expect(await month.getByLabel("actual", { exact: true }).inputValue()).toBe("34")
    expect(await month.getByLabel("forecast", { exact: true }).inputValue()).toBe("140")
    await month.getByRole("button", { name: "Review changes", exact: true }).click()
    const review = month.locator('[data-component="sf-change-review"]')
    const current = review.locator(".sf-s03-snapshot").filter({ has: page.getByRole("heading", { name: "Current source", exact: true }) })
    const proposed = review.locator(".sf-s03-snapshot").filter({ has: page.getByRole("heading", { name: "Proposed values", exact: true }) })
    for (const [field, before, after] of [["budget", "110", "123"], ["actual", "30", "34"], ["forecast", "115", "140"]]) {
      const label = page.locator("dt").filter({ hasText: new RegExp("^" + field + "$") })
      expect((await current.locator(".sf-s03-field").filter({ has: label }).locator("dd").first().textContent())?.trim()).toBe(before)
      expect((await proposed.locator(".sf-s03-field").filter({ has: label }).locator("dd").first().textContent())?.trim()).toBe(after)
    }
    await review.getByRole("button", { name: "Save", exact: true }).click()
    await month.waitFor({ state: "hidden" })
    expect(new URL(page.url()).searchParams.get("year")).toBe("2026")
    expect(await row.locator('button[data-sf-action="save-entry"]:focus').count()).toBe(1)
    const after = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(rows(after.data.opexEntries).find((item) => item.id === janId)).toMatchObject({ budget: 123, actual: 34, forecast: 140 })
    expect(rows(after.data.opexEntries).find((item) => item.id === febId)).toEqual({ id: febId, ownerId, year: 2026, month: 2, budget: 100, actual: 50, forecast: 95 })
    expect(rows(after.data.opexOwners).find((item) => item.id === otherOwnerId)).toEqual({ id: otherOwnerId, name: "Other area", budget: 2400 })

    await row.getByRole("button", { name: "Save deviation", exact: true }).click()
    const deviation = page.locator('.sf-budget-editor[data-sf-action="save-deviation"]')
    const firstNote = "Approved renewal shifted the January forecast."
    const finalNote = "Approved renewal shifted the January forecast. Supplier timing is confirmed."
    await deviation.getByLabel("Deviation notes", { exact: true }).fill(firstNote)
    await deviation.getByLabel("Flag", { exact: true }).selectOption("dev-amber")
    const started = new Promise<void>((resolve) => { delayed.started = resolve })
    delayed.next = true
    await deviation.getByRole("button", { name: "Review changes", exact: true }).click()
    await deviation.getByRole("button", { name: "Save", exact: true }).click()
    let commitTimer: ReturnType<typeof setTimeout> | undefined
    try {
      await Promise.race([started, new Promise<never>((_, reject) => {
        commitTimer = setTimeout(() => reject(new Error("Native deviation command did not reach its committed response")), 10000)
      })])
    } finally { clearTimeout(commitTimer) }
    await deviation.getByLabel("Deviation notes", { exact: true }).fill(finalNote)
    delayed.release?.()
    await page.getByText("Submitted changes saved. Later edits are still unsaved.", { exact: true }).waitFor()
    expect(await deviation.getByLabel("Deviation notes", { exact: true }).inputValue()).toBe(finalNote)
    expect(await deviation.getAttribute("data-sf-draft-dirty")).toBe("true")
    const deviationId = "opex-" + ownerId + "-2026-1"
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: object(snapshot.data.deviations)[deviationId] }))).toEqual({ flag: "dev-amber", text: firstNote })
    // The successful write rebinds to its real v1 source. Create a new competing
    // v2 write so the retained later draft must pass another genuine 409 recovery.
    await fixture.command({ page: "OPEX Detail", action: "save-deviation", id: ownerId, version: 1,
      values: { year: 2026, month: 1, flag: "dev-amber", text: "A concurrent note while the later draft remains open." } })
    await deviation.getByRole("button", { name: "Review changes", exact: true }).click()
    await deviation.getByRole("button", { name: "Save", exact: true }).click()
    await deviation.getByRole("button", { name: "Load current version and keep my edits", exact: true }).waitFor()
    expect(await deviation.getByLabel("Deviation notes", { exact: true }).inputValue()).toBe(finalNote)
    await deviation.getByRole("button", { name: "Load current version and keep my edits", exact: true }).click()
    await deviation.locator('.sf-budget-current[data-sf-current-version="2"]').waitFor()
    expect(await deviation.getByLabel("Deviation notes", { exact: true }).inputValue()).toBe(finalNote)
    await deviation.getByRole("button", { name: "Review changes", exact: true }).click()
    await deviation.getByRole("button", { name: "Save", exact: true }).click()
    await deviation.waitFor({ state: "hidden" })
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: object(snapshot.data.deviations)[deviationId] }))).toEqual({ flag: "dev-amber", text: finalNote })
    await page.reload()
    await row.getByText(finalNote, { exact: true }).waitFor()
    expect((await row.locator("td").allTextContents()).slice(0, 3).map((value) => value.split(" · ")[0])).toEqual(["123", "34", "140"])

    // One native navigation retains the same private criteria and original
    // project identity. The search text stays out of URLs and producer queries.
    await page.goto(origin + "/orchestra/sf-portfolio/overview?year=2026&filter=watch")
    const overview = page.locator("[data-sf-portfolio-overview]")
    await overview.getByLabel("Search", { exact: true }).fill("Cloud")
    expect(await overview.getByLabel("Show", { exact: true }).inputValue()).toBe("watch")
    await overview.locator('tr[data-sf-row="project-1"] button[data-sf-action="select"]').click()
    await page.waitForURL((target) => target.pathname === "/orchestra/sf-portfolio/projects/r_cHJvamVjdC0x")
    const destination = new URL(page.url())
    expect(destination.pathname).toBe("/orchestra/sf-portfolio/projects/r_cHJvamVjdC0x")
    expect(destination.searchParams.get("year")).toBe("2026")
    expect(destination.searchParams.has("q")).toBe(false)
    const projects = page.locator("[data-sf-projects]")
    await projects.locator("[data-sf-record-detail]").getByRole("heading", { name: "Cloud migration", exact: true }).waitFor()
    expect(await projects.getByLabel("Search", { exact: true }).inputValue()).toBe("Cloud")
    expect(await projects.getByLabel("Show", { exact: true }).inputValue()).toBe("watch")
    await projects.locator("[data-sf-record-detail]").getByRole("button", { name: "Back", exact: true }).click()
    await page.waitForURL((target) => target.pathname === "/orchestra/sf-portfolio/projects")
    expect(await projects.getByLabel("Search", { exact: true }).inputValue()).toBe("Cloud")
    expect(await projects.getByLabel("Show", { exact: true }).inputValue()).toBe("watch")
    expect(await projects.locator('tr[data-sf-row="project-1"]').count()).toBe(1)
    expect(await projects.locator('tr[data-sf-row="project-2"]').count()).toBe(0)
    expect(new URL(page.url()).searchParams.get("year")).toBe("2026")
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: rows(snapshot.data.projects).map((item) => item.id) }))).toEqual(["project-1", "project-2"])

    await page.goto(url)
    await page.locator(`tr[data-sf-row="${ownerId}"] button[data-sf-action="select"]`).click()
    await page.locator(".sf-budget-detail").getByRole("button", { name: "Apply year amount", exact: true }).click()
    const invalid = page.locator('.sf-budget-editor[data-sf-action="year-amount"]')
    await invalid.getByLabel("Year amount", { exact: true }).fill("-10")
    await invalid.getByRole("button", { name: "Review changes", exact: true }).click()
    await invalid.getByText("Enter a nonnegative year amount or clear the field.", { exact: true }).waitFor()
    expect(await invalid.getByLabel("Year amount", { exact: true }).inputValue()).toBe("-10")
    expect(await invalid.getAttribute("data-sf-draft-dirty")).toBe("true")
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: rows(snapshot.data.opexEntries) }))).toEqual(rows(after.data.opexEntries))
    await invalid.getByRole("button", { name: "Discard draft", exact: true }).click()
    await invalid.getByRole("group", { name: "Discard the draft and change context?", exact: true })
      .getByRole("button", { name: "Discard draft", exact: true }).click()
    await invalid.waitFor({ state: "hidden" })

    const risks = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.risks) }))
    await page.goto(origin + "/orchestra/sf-dashboard/executive?year=2026&month=11")
    const signals = page.locator("[data-dashboard-signals]")
    await signals.getByText("Showing 21 of 21 eligible signals", { exact: true }).waitFor()
    const sourceOrder = ["hotTopics:review-action", ...Array.from({ length: 20 }, (_, index) => "risks:risk-" + (index + 1))]
    expect(await signals.locator("tr[data-signal-id]").evaluateAll((items) => items.map((item) => item.getAttribute("data-signal-id")))).toEqual(sourceOrder)
    expect(await signals.locator("tbody tr").first().textContent()).toContain("Review action")
    await signals.getByRole("button", { name: "Prioritize Review risk 20", exact: true }).click()
    await page.waitForURL((target) => target.searchParams.getAll("signalPriority").join(",") === "risks:risk-20")
    await signals.getByRole("button", { name: "Remove priority for Review risk 20", exact: true }).waitFor()
    const priorityOrder = ["risks:risk-20", ...sourceOrder.filter((id) => id !== "risks:risk-20")]
    expect(await signals.locator("tr[data-signal-id]").evaluateAll((items) => items.map((item) => item.getAttribute("data-signal-id")))).toEqual(priorityOrder)
    await signals.getByText("1 of 21 signals prioritized by you", { exact: true }).waitFor()
    expect(new URL(page.url()).searchParams.getAll("signalPriority")).toEqual(["risks:risk-20"])
    await page.reload()
    await signals.getByRole("button", { name: "Remove priority for Review risk 20", exact: true }).waitFor()
    expect(await signals.locator("tr[data-signal-id]").evaluateAll((items) => items.map((item) => item.getAttribute("data-signal-id")))).toEqual(priorityOrder)
    await signals.locator('tr[data-signal-id="risks:risk-20"]').getByRole("button", { name: "Open record", exact: true }).click()
    await page.waitForURL((target) => target.pathname === "/orchestra/sf-operations/risks/r_cmlzay0yMA")
    expect(new URL(page.url()).searchParams.get("year")).toBe("2026")
    expect(new URL(page.url()).searchParams.get("month")).toBe("11")
    await page.locator('[data-sf-surface="CAP13"]').getByRole("heading", { name: "Review risk 20", exact: true }).waitFor()
    expect(await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.risks }))).toEqual(risks)
    expect(errors).toEqual([])
  } finally {
    delayed.release?.()
    try { await browserDriver.close() }
    finally { await fixture.close() }
  }
  browserDriver.report()
}, 60000)
