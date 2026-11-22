import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"
import type { Page } from "@playwright/test"
import { captureBrowserPng, withinBrowserDeadline } from "./fixture/browser-evidence.ts"

const peopleLabels = ["Total IT Users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD"]

function measureMetrics(page: Page) {
  return page.evaluate((labels) => {
    const box = (element: Element | undefined | null) => {
      if (!element) return null
      const bounds = element.getBoundingClientRect()
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height }
    }
    const cards = [...document.querySelectorAll(".metric")]
    return {
      first: box(cards[0]), third: box(cards[2]), content: box(document.querySelector("#content")),
      people: labels.map((label) => box(cards.find((card) => [...card.querySelectorAll("span")].some((span) => span.textContent?.trim() === label)))),
    }
  }, peopleLabels)
}


test("All editor screens keep readable field widths and ordered configuration sections", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "operator-browser-"))
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
  }
  const resources: {
    installation?: Awaited<ReturnType<typeof createLocalInstallation>>
    browser?: import("@playwright/test").Browser
  } = {}
  const server = Bun.serve({
    hostname: "127.0.0.1", port: 0,
    fetch: async (request) => await resources.installation?.handler(request) ?? new Response(null, { status: 404 }),
  })
  const origin = `http://127.0.0.1:${server.port}`
  const failures: string[] = []
  const phase = async <T>(label: string, operation: () => Promise<T>) => {
    console.info("browser form layout: phase start", label)
    const result = await withinBrowserDeadline(label, operation, 8_000)
    console.info("browser form layout: phase complete", label)
    return result
  }
  try {
    const file = await prepareLocalConfiguration(root, origin)
    const access = await prepareOperatorAccess(file, true)
    resources.installation = await createLocalInstallation({ origin }, file, environment)
    const { chromium } = await import("@playwright/test")
    resources.browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 8000 })
    const page = await resources.browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.setDefaultTimeout(8000)
    page.setDefaultNavigationTimeout(8000)
    page.on("pageerror", (error) => { failures.push(error.message) })
    const [enrollment] = await phase("enrollment", () => Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin === origin && url.pathname === "/sucafina/auth/local"
      }),
      page.goto(pathToFileURL(access.artifact).href),
    ]))
    expect(enrollment.status()).toBe(303)
    await page.waitForURL(`${origin}/sucafina/dashboard`)
    const artifacts = path.join(import.meta.dir, "artifacts")
    await mkdir(artifacts, { recursive: true })
    const navigate = async (destination: URL) => {
      const response = await phase("navigate " + destination.pathname + destination.search, () => page.goto(destination.href, { waitUntil: "domcontentloaded" }))
      expect({ status: response?.status(), url: page.url() }).toEqual({ status: 200, url: destination.href })
    }
    const capture = (name: string) => captureBrowserPng(page, path.join(artifacts, name), { milliseconds: 8_000 })
    // Exercise populated planner layouts through the same durable command path as the UI.
    // This is isolated test data, never a write to the owner's installation.
    const plan = await page.request.post(`${origin}/sucafina/planner`, {
      headers: { Origin: origin },
      data: { page: "Versions", action: "save", version: 0, values: {} },
      timeout: 8000,
    })
    expect(plan.ok()).toBe(true)
    expect(await phase("read plan receipt", () => plan.json())).toMatchObject({ ok: true })
    const topic = await page.request.post(`${origin}/sucafina/dashboard`, {
      headers: { Origin: origin },
      data: { page: "Hot Topics & Actions", action: "save", version: 0, values: { action: "Browser layout acceptance", owner: "", due: "2026-12-01", status: "open", priority: "normal", notes: "Temporary browser fixture" } },
      timeout: 8000,
    })
    expect(topic.ok()).toBe(true)
    expect(await phase("read topic receipt", () => topic.json())).toMatchObject({ ok: true })
    await navigate(new URL("/sucafina/dashboard?page=Executive+Dashboard", origin))
    console.info("browser form layout: executive dashboard loaded")
    const geometry = await phase("executive dashboard metric geometry", () => measureMetrics(page))
    expect(geometry.first).not.toBeNull()
    expect(geometry.third).not.toBeNull()
    expect(geometry.content).not.toBeNull()
    expect(geometry.third!.x + geometry.third!.width - geometry.first!.x).toBeGreaterThan(geometry.content!.width * 0.85)
    const people = geometry.people
    expect(people.every(Boolean)).toBe(true)
    expect(Math.max(...people.map((box) => box!.y)) - Math.min(...people.map((box) => box!.y))).toBeLessThanOrEqual(2)
    expect(Math.max(...people.map((box) => box!.width)) - Math.min(...people.map((box) => box!.width))).toBeLessThanOrEqual(2)
    expect(Math.max(...people.map((box) => box!.height)) - Math.min(...people.map((box) => box!.height))).toBeLessThanOrEqual(2)
    await capture("forms-dashboard-desktop.png")
    for (const width of [1440, 1024, 390]) {
      await phase("viewport " + width, () => page.setViewportSize({ width, height: 1000 }))
      for (const surface of ["dashboard", "planner", "procurement"]) {
        await navigate(new URL(`/sucafina/${surface}`, origin))
        const hrefs = await page.locator("nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href")!))
        expect(hrefs).toHaveLength(surface === "dashboard" ? 16 : surface === "planner" ? 7 : 5)
        expect(new Set(hrefs).size).toBe(hrefs.length)
        if (surface === "dashboard") {
          const cards = (await phase("responsive metric geometry " + width, () => measureMetrics(page))).people
          expect(cards.every(Boolean)).toBe(true)
          expect(new Set(cards.map((box) => Math.round(box!.x))).size).toBe(width === 1440 ? 4 : 2)
          expect(new Set(cards.map((box) => Math.round(box!.y))).size).toBe(width === 1440 ? 1 : 2)
          expect(Math.max(...cards.map((box) => box!.width)) - Math.min(...cards.map((box) => box!.width))).toBeLessThanOrEqual(2)
          expect(Math.max(...cards.map((box) => box!.height)) - Math.min(...cards.map((box) => box!.height))).toBeLessThanOrEqual(2)
          expect(Math.min(...cards.map((box) => box!.height))).toBeGreaterThanOrEqual(100)
        }
        await capture(`forms-${surface}-${width}.png`)
        for (const href of hrefs) {
          const destination = new URL(href, `${origin}/sucafina/${surface}`)
          await navigate(destination)
          for (const summary of await page.locator('details.editor-panel > summary').all()) {
            if (await summary.locator('..').getAttribute('open') === null) await summary.click()
          }
          const expectedPage = destination.searchParams.get("page")!
          expect(await page.locator("main").getAttribute("data-page")).toBe(expectedPage)
          expect(await page.locator("h1").innerText()).toBe(expectedPage)
          expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
          if (width === 1440) {
            const editors = await page.locator('form[data-command]').evaluateAll((forms) => forms.flatMap((form) => {
              if (form.closest('table, .compact-forms')) return []
              const fields = Array.from(form.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea'))
                .filter((field) => !field.closest("table") && field.getBoundingClientRect().width > 0)
              return fields.length < 3 ? [] : fields.map((field) => ({ page: new URL(location.href).searchParams.get("page"), name: field.getAttribute('name'), width: field.getBoundingClientRect().width }))
            }))
            expect(editors.filter((field) => field.width < 170)).toEqual([])
            if (surface === 'procurement' && expectedPage === 'Settings') {
              const approval = await page.getByText('Approval matrix', { exact: true }).boundingBox()
              const currencies = await page.getByText('Currencies', { exact: true }).boundingBox()
              expect(currencies!.y).toBeGreaterThan(approval!.y + approval!.height)
            }
          }
          if (surface === "dashboard" && expectedPage === "Hot Topics & Actions") {
            await page.getByRole("button", { name: "Edit", exact: true }).click()
            const editor = page.getByRole("dialog", { name: "Edit record", exact: true })
            expect(await editor.isVisible()).toBe(true)
            await captureBrowserPng(page, path.join(artifacts, `forms-row-editor-${width}.png`), { element: editor, milliseconds: 8_000 })
            const dialog = await phase("dialog geometry " + width, () => editor.boundingBox())
            expect(dialog!.width).toBeLessThanOrEqual(width - 20)
            expect(await editor.evaluate((node) => node.scrollWidth <= node.clientWidth + 1)).toBe(true)
            for (let index = 0; index < 12; index++) {
              await page.keyboard.press("Tab")
              expect(await editor.evaluate((node) => node.contains(document.activeElement))).toBe(true)
            }
            await page.keyboard.press("Escape")
            expect(await editor.isVisible()).toBe(false)
            expect(await page.getByRole("button", { name: "Edit", exact: true }).evaluate((node) => node === document.activeElement)).toBe(true)
            await page.getByRole("button", { name: "Edit", exact: true }).click()
            await editor.locator('[name="action"]').fill(" ")
            await editor.getByRole("button", { name: "Save", exact: true }).click()
            await editor.getByRole("status").waitFor({ state: "visible" })
            expect(await editor.getByRole("status").innerText()).not.toBe("")
            expect(await editor.isVisible()).toBe(true)
            await editor.locator('[name="action"]').fill("Browser layout acceptance")
            await editor.getByRole("button", { name: "Save", exact: true }).click()
            await editor.waitFor({ state: "hidden" })
            await page.getByRole("button", { name: "Edit", exact: true }).waitFor()
            expect(await page.getByRole("button", { name: "Edit", exact: true }).evaluate((node) => node === document.activeElement)).toBe(true)
            await page.getByRole("button", { name: "Edit", exact: true }).click()
            await page.getByRole("button", { name: "Close editor" }).click()
            expect(await editor.isVisible()).toBe(false)
          }
          const charts = await page.locator("figure svg").evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().height))
          expect(charts.every((height) => height <= 241)).toBe(true)
          const active = page.locator('nav a[aria-current="page"]')
          expect(await active.count()).toBe(1)
          if (width === 1440) {
            const name = new URL(page.url()).searchParams.get("page")!.replace(/[^a-z0-9]+/gi, "-").toLowerCase()
            await phase("return to page origin " + name, () => page.evaluate(() => scrollTo(0, 0)))
            await capture(`forms-${surface}-${name}.png`)
          }
        }
      }
    }
    expect(failures).toEqual([])
  } catch (error) {
    console.error("browser form layout: failed before cleanup", error)
    throw error
  } finally {
    console.info("browser form layout: cleanup start")
    await server.stop(true)
    try {
      if (resources.browser) await withinBrowserDeadline("form layout browser close", () => resources.browser!.close(), 2_000)
    } finally {
      try {
        await resources.installation?.dispose()
      } finally {
        await rm(root, { recursive: true, force: true })
      }
    }
  }
}, 60000)
