import { expect, test } from "bun:test"
import { mkdir } from "node:fs/promises"
import path from "node:path"
import { localBrowser } from "./fixture/local-browser.ts"

async function within<T>(operation: Promise<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Visual layout timed out at: ${stage}`)), 10_000)
    })])
  } finally { clearTimeout(timer) }
}

test("Executive metrics align, fill the content area and fit desktop and mobile viewports", async () => {
  // This generic CI-SF suite selects the full module subtree with a JUnit reporter.
  // The WP01 pooled lease explicitly refuses that selection (it requires a named
  // startup-first/lifecycle-last invocation). Use the independently OS-certified
  // disposable Chrome fixture here; leave the strict WP01 lease guards intact.
  let fixture: Awaited<ReturnType<typeof localBrowser>> | undefined
  let stage = "open authenticated private installation"
  let failure: unknown
  const step = <T>(name: string, operation: () => T | Promise<T>) => {
    stage = name
    return within(Promise.resolve().then(operation), name)
  }
  try {
    fixture = await step("open owned browser and enroll real local operator", () => localBrowser())
    const page = fixture.page
    const origin = "http://localhost:4110"
    await step("prepare screenshot directory", () => mkdir(path.join(import.meta.dir, "artifacts"), { recursive: true }))
    // Exercise populated planner layouts through the same durable command path as the UI.
    // This is isolated test data, never a write to the owner's installation.
    const plan = await step("create planner version through durable command", () => page.request.post(`${origin}/sucafina/planner`, {
      headers: { Origin: origin }, timeout: 10_000,
      data: { page: "Versions", action: "save", version: 0, values: {} },
    }))
    expect(plan.ok()).toBe(true)
    expect(await step("read planner version receipt", () => plan.json())).toMatchObject({ ok: true })
    await step("dashboard Executive Dashboard at 1440px: navigate", () => page.goto(`${origin}/sucafina/dashboard?page=Executive+Dashboard`))
    await step("dashboard Executive Dashboard at 1440px: screenshot", () => page.screenshot({ path: path.join(import.meta.dir, "artifacts", "visual-dashboard-desktop.png"), fullPage: true, timeout: 10_000 }))
    const metrics = page.locator(".metric")
    const first = await step("dashboard Executive Dashboard at 1440px: first metric", () => metrics.nth(0).boundingBox())
    const third = await step("dashboard Executive Dashboard at 1440px: third metric", () => metrics.nth(2).boundingBox())
    const content = await step("dashboard Executive Dashboard at 1440px: content bounds", () => page.locator("#content").boundingBox())
    expect(first).not.toBeNull()
    expect(third).not.toBeNull()
    expect(content).not.toBeNull()
    expect(third!.x + third!.width - first!.x).toBeGreaterThan(content!.width * 0.85)
    const people = await step("dashboard Executive Dashboard at 1440px: people metric bounds", () => Promise.all(["Total IT Users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD"].map(async (label) => {
      const card = metrics.filter({ has: page.locator("span", { hasText: label }).filter({ hasText: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }) })
      return await card.boundingBox()
    })))
    expect(people.every(Boolean)).toBe(true)
    expect(Math.max(...people.map((box) => box!.y)) - Math.min(...people.map((box) => box!.y))).toBeLessThanOrEqual(2)
    expect(Math.max(...people.map((box) => box!.width)) - Math.min(...people.map((box) => box!.width))).toBeLessThanOrEqual(2)
    expect(Math.max(...people.map((box) => box!.height)) - Math.min(...people.map((box) => box!.height))).toBeLessThanOrEqual(2)
    // Include the pack's 320/768/1440 widths alongside the prior layout checks.
    for (const width of [1440, 1024, 768, 390, 320]) {
      await step(`set viewport to ${width}px`, () => page.setViewportSize({ width, height: 1000 }))
      for (const surface of ["dashboard", "planner", "procurement"]) {
        const entry = `${surface} entry at ${width}px`
        console.info(`WP01 visual layout phase: ${entry}`)
        await step(`${entry}: navigate`, () => page.goto(`${origin}/sucafina/${surface}`))
        const hrefs = await step(`${entry}: read authorized navigation`, () => page.locator("aside.sidebar > nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href")!)))
        expect(hrefs).toHaveLength(surface === "dashboard" ? 16 : surface === "planner" ? 7 : 5)
        expect(new Set(hrefs).size).toBe(hrefs.length)
        if (surface === "dashboard") {
          const cards = await step(`${entry}: people metric bounds`, () => Promise.all(["Total IT Users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD"].map(async (label) => await page.locator(".metric").filter({ has: page.getByText(label, { exact: true }) }).boundingBox())))
          expect(cards.every(Boolean)).toBe(true)
          expect(new Set(cards.map((box) => Math.round(box!.x))).size).toBe(width === 1440 ? 4 : 2)
          expect(new Set(cards.map((box) => Math.round(box!.y))).size).toBe(width === 1440 ? 1 : 2)
          expect(Math.max(...cards.map((box) => box!.width)) - Math.min(...cards.map((box) => box!.width))).toBeLessThanOrEqual(2)
          expect(Math.max(...cards.map((box) => box!.height)) - Math.min(...cards.map((box) => box!.height))).toBeLessThanOrEqual(2)
          expect(Math.min(...cards.map((box) => box!.height))).toBeGreaterThanOrEqual(100)
        }
        await step(`${entry}: screenshot`, () => page.screenshot({ path: path.join(import.meta.dir, "artifacts", `visual-${surface}-${width}.png`), fullPage: true, timeout: 10_000 }))
        for (const href of hrefs) {
          const route = `${surface} ${new URL(href, page.url()).searchParams.get("page")} at ${width}px`
          const response = await step(`${route}: navigate`, () => page.goto(new URL(href, `${origin}/sucafina/${surface}`).href))
          expect(response?.status()).toBe(200)
          const expectedPage = new URL(href, page.url()).searchParams.get("page")!
          expect(await step(`${route}: page identity`, () => page.locator("main").getAttribute("data-page"))).toBe(expectedPage)
          expect(await step(`${route}: visible heading`, () => page.locator("h1").innerText())).toBe(expectedPage)
          expect(await step(`${route}: document width`, () => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1))).toBe(true)
          const charts = await step(`${route}: chart bounds`, () => page.locator("figure svg").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height)))
          expect(charts.every((height) => height <= 241)).toBe(true)
          const active = page.locator('aside.sidebar > nav a[aria-current="page"]')
          expect(await step(`${route}: active navigation count`, () => active.count())).toBe(1)
          if (width === 1440) {
            const name = new URL(page.url()).searchParams.get("page")!.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
            await step(`${route}: screenshot`, () => page.screenshot({ path: path.join(import.meta.dir, "artifacts", `visual-${surface}-${name}.png`), fullPage: true, timeout: 10_000 }))
          }
        }
      }
    }
    expect(fixture.errors).toEqual([])
  } catch (error) {
    failure = error
    console.error(`WP01 visual layout failed at: ${stage}`)
    throw error
  } finally {
    const cleanup: unknown[] = []
    try {
      // The shared fixture independently proves all owned Chrome process-group
      // members exited and its transport disconnected; never stop it unobserved.
      if (fixture) await fixture.dispose()
    } catch (error) { cleanup.push(error) }
    if (cleanup.length) throw new AggregateError(failure ? [failure, ...cleanup] : cleanup, "Visual layout assertion/setup and owned Chrome cleanup failures")
  }
  // 28 routes at five widths, plus entry/desktop captures. The browser fixture
  // owns a bounded OS/transport teardown; every visual stage remains bounded.
}, 120000)
