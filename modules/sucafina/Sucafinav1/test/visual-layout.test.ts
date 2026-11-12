import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"

test("Executive metrics align, fill the content area and fit desktop and mobile viewports", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "operator-browser-"))
  const file = await prepareLocalConfiguration(root)
  const access = await prepareOperatorAccess(file, true)
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
  }
  const installation = await createLocalInstallation({ origin: "http://localhost:4110" }, file, environment)
  const server = Bun.serve({ hostname: "localhost", port: 4110, fetch: async (request) => await installation.handler(request) ?? new Response(null, { status: 404 }) })
  const { chromium } = await import("@playwright/test")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  const failures: string[] = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on("pageerror", (error) => { failures.push(error.message) })
    await page.goto(pathToFileURL(access.artifact).href)
    await page.waitForURL("http://localhost:4110/sucafina/dashboard")
    await mkdir(path.join(import.meta.dir, "artifacts"), { recursive: true })
    // Exercise populated planner layouts through the same durable command path as the UI.
    // This is isolated test data, never a write to the owner's installation.
    const plan = await page.request.post("http://localhost:4110/sucafina/planner", {
      headers: { Origin: "http://localhost:4110" },
      data: { page: "Versions", action: "save", version: 0, values: {} },
    })
    expect(plan.ok()).toBe(true)
    expect(await plan.json()).toMatchObject({ ok: true })
    await page.goto("http://localhost:4110/sucafina/dashboard?page=Executive+Dashboard")
    await page.screenshot({ path: path.join(import.meta.dir, "artifacts", "visual-dashboard-desktop.png"), fullPage: true })
    const metrics = page.locator(".metric")
    const first = await metrics.nth(0).boundingBox()
    const third = await metrics.nth(2).boundingBox()
    const content = await page.locator("#content").boundingBox()
    expect(first).not.toBeNull()
    expect(third).not.toBeNull()
    expect(content).not.toBeNull()
    expect(third!.x + third!.width - first!.x).toBeGreaterThan(content!.width * 0.85)
    const people = await Promise.all(["Total IT Users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD"].map(async (label) => {
      const card = metrics.filter({ has: page.locator("span", { hasText: label }).filter({ hasText: new RegExp("^" + label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$") }) })
      return await card.boundingBox()
    }))
    expect(people.every(Boolean)).toBe(true)
    expect(Math.max(...people.map((box) => box!.y)) - Math.min(...people.map((box) => box!.y))).toBeLessThanOrEqual(2)
    expect(Math.max(...people.map((box) => box!.width)) - Math.min(...people.map((box) => box!.width))).toBeLessThanOrEqual(2)
    expect(Math.max(...people.map((box) => box!.height)) - Math.min(...people.map((box) => box!.height))).toBeLessThanOrEqual(2)
    for (const width of [1440, 1024, 390]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const surface of ["dashboard", "planner", "procurement"]) {
        await page.goto(`http://localhost:4110/sucafina/${surface}`)
        const hrefs = await page.locator("nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href")!))
        expect(hrefs).toHaveLength(surface === "dashboard" ? 16 : surface === "planner" ? 7 : 5)
        expect(new Set(hrefs).size).toBe(hrefs.length)
        if (surface === "dashboard") {
          const cards = await Promise.all(["Total IT Users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD"].map(async (label) => await page.locator(".metric").filter({ has: page.getByText(label, { exact: true }) }).boundingBox()))
          expect(cards.every(Boolean)).toBe(true)
          expect(new Set(cards.map((box) => Math.round(box!.x))).size).toBe(width === 1440 ? 4 : 2)
          expect(new Set(cards.map((box) => Math.round(box!.y))).size).toBe(width === 1440 ? 1 : 2)
          expect(Math.max(...cards.map((box) => box!.width)) - Math.min(...cards.map((box) => box!.width))).toBeLessThanOrEqual(2)
          expect(Math.max(...cards.map((box) => box!.height)) - Math.min(...cards.map((box) => box!.height))).toBeLessThanOrEqual(2)
          expect(Math.min(...cards.map((box) => box!.height))).toBeGreaterThanOrEqual(100)
        }
        await page.screenshot({ path: path.join(import.meta.dir, "artifacts", `visual-${surface}-${width}.png`), fullPage: true })
        for (const href of hrefs) {
          const response = await page.goto(new URL(href, `http://localhost:4110/sucafina/${surface}`).href)
          expect(response?.status()).toBe(200)
          const expectedPage = new URL(href, page.url()).searchParams.get("page")!
          expect(await page.locator("main").getAttribute("data-page")).toBe(expectedPage)
          expect(await page.locator("h1").innerText()).toBe(expectedPage)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
          const charts = await page.locator("figure svg").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
          expect(charts.every((height) => height <= 241)).toBe(true)
          const active = page.locator('nav a[aria-current="page"]')
          expect(await active.count()).toBe(1)
          if (width === 1440) {
            const name = new URL(page.url()).searchParams.get("page")!.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
            await page.screenshot({ path: path.join(import.meta.dir, "artifacts", `visual-${surface}-${name}.png`), fullPage: true })
          }
        }
      }
    }
    expect(failures).toEqual([])
  } finally {
    await server.stop(true)
    await browser.close()
    await installation.dispose()
    await rm(root, { recursive: true, force: true })
  }
}, 60000)
