import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"

test("Chrome follows the private enrollment gateway into actual HTML screens without Microsoft", async () => {
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
    for (const surface of ["dashboard", "planner", "procurement"]) {
      const response = await page.goto(`http://localhost:4110/sucafina/${surface}`)
      expect(response?.status()).toBe(200)
      await page.locator(`body[data-surface="${surface}"]`).waitFor()
      expect(await page.locator("#content").innerText()).toContain("Homologação local")
      expect(await page.locator("body").innerText()).not.toContain("Microsoft 365 application is not configured")
      const hrefs = await page.locator("nav a").evaluateAll((links) => links.map((link) => link.getAttribute("href")!))
      expect(hrefs).toHaveLength(surface === "dashboard" ? 16 : surface === "planner" ? 7 : 5)
      await page.screenshot({ path: path.join(import.meta.dir, "artifacts", `operator-${surface}.png`), fullPage: true })
      for (const href of hrefs) {
        const screen = await page.goto(new URL(href, `http://localhost:4110/sucafina/${surface}`).href)
        expect(screen?.status()).toBe(200)
        await page.locator(`body[data-surface="${surface}"]`).waitFor()
        expect(await page.locator("#content").innerText()).toContain("Homologação local")
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
