import { expect, test } from "bun:test"
import { object, rows } from "../../../../runtime/contract.ts"
import { closeWp01Browser, launchWp01Browser } from "../../wp01/browser-fixture.ts"
import { createMeetingFixture, meetingTotal } from "./meeting-fixture.ts"
import { loadOptions, openReview } from "./browser-steps.ts"

test("WholeReview UI reopens 1300 after reload and explicitly preserves a distinct 2400 observation", async () => {
  const fixture = await createMeetingFixture()
  const browser = await launchWp01Browser().catch(async (error) => { await fixture.close(); throw error })
  try {
    const context = await browser.newContext()
    const page = await context.newPage(), errors: string[] = []
    page.setDefaultTimeout(10_000)
    page.on("pageerror", (error) => errors.push(error.message))
    expect((await page.goto(`${fixture.origin}/sucafina/auth/local?code=${await fixture.identity.enroll()}`))?.status()).toBe(200)
    await page.goto(`${fixture.origin}/sucafina/dashboard?page=Budget+Overview&year=2026`)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const panel = page.locator("[data-dashboard-workbench]")
    const firstOptions = await loadOptions(page)
    expect(await openReview(page, firstOptions, fixture.original.id)).toEqual({ status: "ok", value: fixture.original })
    const history = panel.locator("[data-dashboard-history-view]")
    const originalText = await history.textContent()
    const total = history.getByRole("row").filter({ has: page.getByRole("cell", { name: "Orçamento total", exact: true }) })
    expect(await total.locator("td").nth(2).textContent()).toBe("1300")

    const changed = await fixture.changeBudget()
    expect(changed.status).toBe(200)
    expect(await changed.json()).toMatchObject({ ok: true })
    await page.evaluate(() => (window as unknown as { sucafinaRefresh: () => Promise<void> }).sucafinaRefresh())
    expect(await history.textContent()).toBe(originalText)
    expect(await total.locator("td").nth(2).textContent()).toBe("1300")

    expect((await page.reload())?.status()).toBe(200)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const currentOptions = await loadOptions(page)
    expect(rows(currentOptions.history)).toContainEqual(expect.objectContaining({ kind: "review", ref: fixture.original.id }))
    expect(await openReview(page, currentOptions, fixture.original.id)).toEqual({ status: "ok", value: fixture.original })
    expect(await history.textContent()).toBe(originalText)
    expect(await total.locator("td").nth(2).textContent()).toBe("1300")

    await panel.getByRole("button", { name: "Pré-visualizar pauta", exact: true }).click()
    await panel.getByText("Pauta pronta para revisão.", { exact: true }).waitFor()
    const agendaTotal = panel.locator("[data-dashboard-agenda-view]").getByRole("row")
      .filter({ has: page.getByRole("cell", { name: "Orçamento total", exact: true }) })
    expect(await agendaTotal.locator("td").nth(2).textContent()).toBe("2400")
    expect(await total.locator("td").nth(2).textContent()).toBe("1300")
    const created = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-review-preserve")
    await panel.getByRole("button", { name: "Preservar reunião", exact: true }).click()
    const response = await created
    expect(response.status()).toBe(200)
    const second = object(object(await response.json()).value)
    expect(typeof second.id).toBe("string")
    expect(second.id).not.toBe(fixture.original.id)
    expect(second.version).toBe(1)
    if (typeof second.id !== "string") throw new Error("Real second observation identity missing")
    await panel.getByText("Reunião preservada. Ela está disponível no histórico enquanto suas fontes permanecem autorizadas.", { exact: true }).waitFor()
    const both = await loadOptions(page)
    expect(rows(both.history).filter((entry) => entry.kind === "review")).toHaveLength(2)
    expect(await openReview(page, both, fixture.original.id)).toEqual({ status: "ok", value: fixture.original })
    expect(await total.locator("td").nth(2).textContent()).toBe("1300")
    expect(await openReview(page, both, second.id)).toEqual({ status: "ok", value: second })
    expect(await total.locator("td").nth(2).textContent()).toBe("2400")
    const saved = await fixture.stored()
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") throw new Error("Real preserved review state unavailable")
    expect(saved.value.reviews[fixture.original.id]).toEqual(fixture.original)
    expect(meetingTotal(saved.value.reviews[second.id]!)).toBe(2400)
    expect(Object.keys(saved.value.reviews)).toHaveLength(2)
    expect(saved.value.receipts).toBe(2)
    expect(errors).toEqual([])
  } finally {
    const results = await Promise.allSettled([closeWp01Browser(browser), fixture.close()])
    const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : [])
    if (errors.length) throw new AggregateError(errors, "WholeReview browser cleanup failed")
  }
}, 60_000)
