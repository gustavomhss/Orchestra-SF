import { expect, test } from "bun:test"
import { closeWp01Browser, launchWp01Browser } from "../../wp01/browser-fixture.ts"
import { createMeetingFixture } from "./meeting-fixture.ts"
import { loadOptions, openReview } from "./browser-steps.ts"

test("WholeReview UI removes preserved material when the real history route revokes access", async () => {
  const fixture = await createMeetingFixture()
  const browser = await launchWp01Browser().catch(async (error) => { await fixture.close(); throw error })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    page.setDefaultTimeout(10_000)
    expect((await page.goto(`${fixture.origin}/sucafina/auth/local?code=${await fixture.identity.enroll()}`))?.status()).toBe(200)
    await page.goto(`${fixture.origin}/sucafina/dashboard?page=Budget+Overview&year=2026`)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const options = await loadOptions(page)
    expect(await openReview(page, options, fixture.original.id)).toEqual({ status: "ok", value: fixture.original })
    const panel = page.locator("[data-dashboard-workbench]")
    const oldPanel = await panel.elementHandle()
    expect(oldPanel).not.toBeNull()
    expect(await panel.locator("[data-dashboard-history-view]").textContent()).toContain("1300")
    fixture.policy.readable = false
    const denied = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-review")
    await panel.getByRole("button", { name: "Abrir histórico", exact: true }).click()
    const response = await denied
    expect(response.status()).toBe(403)
    // The real UI aborts the denied browser request while purging its view.
    // Reopen the same real route under the same revoked cookie to inspect its body.
    const replay = await fetch(fixture.historyUrl, { headers: { cookie: fixture.cookie } })
    expect(replay.status).toBe(403)
    const deniedBody = await replay.text()
    expect(deniedBody).not.toContain(fixture.original.id)
    expect(deniedBody).not.toContain("Preserved Operations")
    expect(deniedBody).not.toContain("1300")
    await page.waitForFunction(() => !document.querySelector("[data-dashboard-history-view]"))
    expect(await oldPanel!.textContent()).not.toContain("1300")
    expect(await oldPanel!.textContent()).not.toContain("Preserved Operations")
    expect(await page.locator("[data-dashboard-history-view]").count()).toBe(0)
    expect(await page.locator("body").textContent()).not.toContain(fixture.original.id)
  } finally {
    const results = await Promise.allSettled([closeWp01Browser(browser), fixture.close()])
    const errors = results.flatMap((result) => result.status === "rejected" ? [result.reason] : [])
    if (errors.length) throw new AggregateError(errors, "WholeReview revocation cleanup failed")
  }
}, 60_000)
