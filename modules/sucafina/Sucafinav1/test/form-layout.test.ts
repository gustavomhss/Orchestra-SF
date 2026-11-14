import { expect, test } from "bun:test"
import { closeWp01Browser, launchWp01Browser } from "./product/wp01/browser-fixture.ts"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"

test("All editor screens keep readable field widths and ordered configuration sections", async () => {
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
  const browser = await launchWp01Browser()
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
    const topic = await page.request.post("http://localhost:4110/sucafina/dashboard", {
      headers: { Origin: "http://localhost:4110" },
      data: { page: "Hot Topics & Actions", action: "save", version: 0, values: { action: "Browser layout acceptance", owner: "", due: "2026-12-01", status: "open", priority: "normal", notes: "Temporary browser fixture" } },
    })
    expect(topic.ok()).toBe(true)
    expect(await topic.json()).toMatchObject({ ok: true })
    await page.goto("http://localhost:4110/sucafina/dashboard?page=Executive+Dashboard")
    await page.screenshot({ path: path.join(import.meta.dir, "artifacts", "forms-dashboard-desktop.png"), fullPage: true })
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
        await page.screenshot({ path: path.join(import.meta.dir, "artifacts", `forms-${surface}-${width}.png`), fullPage: true })
        for (const href of hrefs) {
          const response = await page.goto(new URL(href, `http://localhost:4110/sucafina/${surface}`).href)
          expect(response?.status()).toBe(200)
          for (const summary of await page.locator('details.editor-panel > summary').all()) {
            if (await summary.locator('..').getAttribute('open') === null) await summary.click()
          }
          const expectedPage = new URL(href, page.url()).searchParams.get("page")!
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
            await editor.screenshot({ path: path.join(import.meta.dir, "artifacts", `forms-row-editor-${width}.png`) })
            const dialog = await editor.boundingBox()
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
            await page.evaluate(() => scrollTo(0, 0))
            await page.screenshot({ path: path.join(import.meta.dir, "artifacts", `forms-${surface}-${name}.png`), fullPage: true })
          }
        }
      }
    }
    expect(failures).toEqual([])
  } finally {
    await server.stop(true)
    await closeWp01Browser(browser)
    await installation.dispose()
    await rm(root, { recursive: true, force: true })
  }
}, 60000)
