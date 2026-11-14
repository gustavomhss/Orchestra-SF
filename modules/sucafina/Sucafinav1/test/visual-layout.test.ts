import { expect, test } from "bun:test"
import type { Browser, BrowserContext, Page } from "@playwright/test"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"
import { launchWp01Browser, closeWp01Browser } from "./product/wp01/browser-fixture.ts"

async function within<T>(operation: Promise<T>, stage: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([operation, new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(`Visual layout timed out at: ${stage}`)), 10_000)
    })])
  } finally { clearTimeout(timer) }
}

test("Executive metrics align, fill the content area and fit desktop and mobile viewports", async () => {
  const resources: { root?: string; installation?: Awaited<ReturnType<typeof createLocalInstallation>>; browser?: Browser; context?: BrowserContext; page?: Page; server?: { stop(closeActiveConnections?: boolean): void | Promise<void> } } = {}
  let stage = "reserve installation listener"
  let failure: unknown
  let closing = false
  const failures: string[] = []
  const step = <T>(name: string, operation: () => T | Promise<T>) => {
    stage = name
    return within(Promise.resolve().then(operation), name)
  }
  try {
    // The real configuration loader and enrollment contract require localhost:4110.
    // Reserve it before setup so a collision fails at a named step; do not rewrite
    // requests or relax the installation's origin checks to simulate another port.
    const server = await step("reserve installation listener at localhost:4110", () => Bun.serve({ hostname: "localhost", port: 4110,
      fetch: async (request) => resources.installation ? await resources.installation.handler(request) ?? new Response(null, { status: 404 }) : new Response(null, { status: 503 }) }))
    resources.server = server
    const origin = server.url.origin
    const temporary = await step("resolve private temporary directory", () => realpath(tmpdir()))
    const root = await step("create private installation directory", async () => {
      const directory = await mkdtemp(path.join(temporary, "operator-browser-"))
      if (closing) { await within(rm(directory, { recursive: true, force: true }), "remove late private directory"); throw new Error("Private directory completed after fixture closure") }
      resources.root = directory
      return directory
    })
    const file = await step("prepare isolated installation configuration", () => prepareLocalConfiguration(root))
    const access = await step("prepare real operator enrollment", () => prepareOperatorAccess(file, true))
    const environment = {
      ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
      TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
      XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
    }
    await step("create real local installation", async () => {
      const installation = await createLocalInstallation({ origin }, file, environment)
      if (closing) { await within(installation.dispose(), "dispose late installation"); throw new Error("Installation completed after fixture closure") }
      resources.installation = installation
    })
    stage = "launch owned browser server and client"
    const browser = await launchWp01Browser()
    resources.browser = browser
    const context = await step("create isolated browser context", async () => {
      const value = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
      if (closing) { await within(value.close(), "close late browser context"); throw new Error("Browser context completed after fixture closure") }
      resources.context = value
      return value
    })
    const page = await step("create browser page", async () => {
      const value = await context.newPage()
      if (closing) { await within(value.close({ runBeforeUnload: false }), "close late page"); throw new Error("Page completed after fixture closure") }
      resources.page = value
      return value
    })
    page.setDefaultTimeout(10_000)
    page.setDefaultNavigationTimeout(10_000)
    page.on("pageerror", (error) => { failures.push(error.message) })
    await step("open private operator enrollment", () => page.goto(pathToFileURL(access.artifact).href))
    await step("complete real operator enrollment", () => page.waitForURL(`${origin}/sucafina/dashboard`))
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
        const hrefs = await step(`${entry}: read authorized navigation`, () => page.locator("nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href")!)))
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
          const active = page.locator('nav a[aria-current="page"]')
          expect(await step(`${route}: active navigation count`, () => active.count())).toBe(1)
          if (width === 1440) {
            const name = new URL(page.url()).searchParams.get("page")!.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
            await step(`${route}: screenshot`, () => page.screenshot({ path: path.join(import.meta.dir, "artifacts", `visual-${surface}-${name}.png`), fullPage: true, timeout: 10_000 }))
          }
        }
      }
    }
    expect(failures).toEqual([])
  } catch (error) {
    failure = error
    console.error(`WP01 visual layout failed at: ${stage}`)
    throw error
  } finally {
    closing = true
    const cleanup: unknown[] = []
    const actions: { name: string; close: () => Promise<unknown>; managedDeadline?: boolean }[] = [
      { name: "close visual page", close: async () => { if (resources.page && !resources.page.isClosed()) await resources.page.close({ runBeforeUnload: false }) } },
      { name: "close visual browser context", close: async () => resources.context?.close() },
      { name: "close visual browser", managedDeadline: true, close: async () => { if (resources.browser) await closeWp01Browser(resources.browser) } },
      { name: "stop visual server", close: async () => resources.server?.stop(true) },
      { name: "dispose real local installation", close: async () => resources.installation?.dispose() },
      { name: "remove private visual installation", close: async () => { if (resources.root) await rm(resources.root, { recursive: true, force: true }) } },
    ]
    for (const action of actions) {
      try {
        if (action.managedDeadline) { stage = action.name; await action.close() }
        else await step(action.name, action.close)
      }
      catch (error) { console.error(`WP01 visual cleanup failed at: ${action.name}`); cleanup.push(error) }
    }
    if (cleanup.length) throw new AggregateError(failure ? [failure, ...cleanup] : cleanup, "Visual layout assertion/setup and cleanup failures")
  }
  // 28 routes at five widths, plus entry/desktop captures: visual operations keep
  // their 10s deadline; browser cleanup owns 10s graceful + 10s forced termination.
  // Only this aggregate visual test receives 120s.
}, 120000)
