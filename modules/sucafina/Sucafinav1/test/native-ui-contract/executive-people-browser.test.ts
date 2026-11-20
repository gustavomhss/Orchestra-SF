import { test } from "bun:test"
import { expect } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Schema } from "effect"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { localBrowser } from "../fixture/local-browser.ts"

test("native Executive shows producer-owned people measures, preserves their period and purges them on access loss", async () => {
  expectSpawn(import.meta.path)
  const fixture = await localBrowser({ nativePlanner: true })
  try {
    const page = fixture.page
    const origin = new URL(page.url()).origin
    page.setDefaultTimeout(10000)
    page.setDefaultNavigationTimeout(10000)
    // Fixture setup uses the original admitted durable commands with the real
    // enrolled operator. No snapshot, projection, response or grant is substituted.
    for (const command of [
      { page: "OPEX Detail", action: "save", values: { name: "Executive OPEX", budget: 1200 } },
      { page: "CAPEX Projects", action: "save", values: { name: "Executive CAPEX", budget: 600 } },
      { page: "Executive Dashboard", action: "save-users", values: { year: 2026, month: 1, value: 20 } },
      { page: "Executive Dashboard", action: "save-users", values: { year: 2026, month: 2, value: 40 } },
    ]) {
      const response = await page.request.post(origin + "/sucafina/dashboard", {
        headers: { Origin: origin }, data: { ...command, version: 0 }, timeout: 10000,
      })
      expect(response.status()).toBe(200)
      expect(await response.json()).toMatchObject({ ok: true })
    }
    const matches = (response: { url(): string }, month: number) => {
      const url = new URL(response.url())
      return url.origin === origin && url.pathname === "/sucafina/api/ui/pages/CAP01" &&
        url.searchParams.get("execYear") === "2026" && url.searchParams.get("executiveMonth") === String(month)
    }
    const [first, document] = await Promise.all([
      page.waitForResponse((response) => matches(response, 1), { timeout: 10000 }),
      page.goto(origin + "/orchestra/sf-dashboard/executive?year=2026&month=1"),
    ])
    expect(document?.status()).toBe(200)
    expect(first.status()).toBe(200)
    const initial = Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP01"].output)(await first.json())
    expect(initial.status).toBe("ok")
    if (initial.status !== "ok") throw new Error("Original Executive source was not admitted")
    expect(initial.value.data.people).toEqual({
      year: 2026, month: 1, users: 20, opexCostPerUser: 60, totalCostPerUser: 90, attritionYtd: null,
    })
    const dashboard = page.locator('[data-sf-surface="CAP01"]')
    await expect(dashboard.locator('[data-sf-state="ready"]')).toBeVisible()
    const cards = dashboard.locator(".sf-u02-people-metrics [data-sf-metric]")
    await expect(cards).toHaveCount(4)
    await expect(cards.locator("dt")).toHaveText([
      "Total IT users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD",
    ])
    await expect(cards.locator("dd")).toHaveText(["20", "60", "90", "Not available from this source"])
    await expect(dashboard.locator('[data-sf-metric="benchmark"]')).toBeVisible()
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      const boxes = await cards.evaluateAll((nodes) => nodes.map((node) => {
        const box = node.getBoundingClientRect()
        return { x: box.x, y: box.y, width: box.width, height: box.height }
      }))
      expect(boxes).toHaveLength(4)
      expect(new Set(boxes.map((box) => Math.round(box.x))).size).toBe(width === 1440 ? 4 : 2)
      expect(new Set(boxes.map((box) => Math.round(box.y))).size).toBe(width === 1440 ? 1 : 2)
      expect(Math.max(...boxes.map((box) => box.width)) - Math.min(...boxes.map((box) => box.width))).toBeLessThanOrEqual(2)
      expect(Math.max(...boxes.map((box) => box.height)) - Math.min(...boxes.map((box) => box.height))).toBeLessThanOrEqual(2)
      expect(Math.min(...boxes.map((box) => box.height))).toBeGreaterThanOrEqual(100)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    }
    const [second] = await Promise.all([
      page.waitForResponse((response) => matches(response, 2), { timeout: 10000 }),
      dashboard.getByLabel("Month", { exact: true }).selectOption("2"),
    ])
    expect(second.status()).toBe(200)
    const changed = Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP01"].output)(await second.json())
    expect(changed.status).toBe("ok")
    if (changed.status !== "ok") throw new Error("Changed Executive period was not admitted")
    expect(changed.value.data.people).toEqual({
      year: 2026, month: 2, users: 40, opexCostPerUser: 30, totalCostPerUser: 45, attritionYtd: null,
    })
    await expect(cards.locator("dd")).toHaveText(["40", "30", "45", "Not available from this source"])
    // A real session loss must remove values from this mounted page on refresh.
    await page.context().clearCookies()
    await page.getByRole("button", { name: "Refresh access", exact: true }).click()
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-provider-state", "unauthenticated")
    await expect(page.locator('[data-sf-metric]')).toHaveCount(0)
    expect(fixture.errors).toEqual([])
  } finally {
    await fixture.dispose()
    console.info("SF Executive people physical browser closure", fixture.report())
  }
}, 90000)
