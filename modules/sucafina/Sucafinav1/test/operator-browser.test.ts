import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"

test("Chrome follows the private enrollment gateway into the Orchestra shell without Microsoft", async () => {
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
  const server = Bun.serve({ hostname: "localhost", port: 4110, fetch: async (request) => {
    const url = new URL(request.url)
    if (url.pathname === "/") return new Response("<!doctype html><title>Orchestra</title><main>Orchestra</main>", { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" } })
    return await installation.handler(request) ?? new Response(null, { status: 404 })
  } })
  const { chromium } = await import("@playwright/test")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  const failures: string[] = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on("pageerror", (error) => { failures.push(error.message) })
    const enrollment = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/auth/local")
    await page.goto(pathToFileURL(access.artifact).href)
    const admitted = await enrollment
    expect(admitted.status()).toBe(303)
    expect(admitted.headers()["location"]).toBe("/")
    await page.waitForURL((url) => url.origin === "http://localhost:4110" && url.pathname === "/")
    expect(await page.locator("main").innerText()).toBe("Orchestra")
    expect(await page.locator("body").innerText()).not.toContain("Microsoft 365 application is not configured")
    const status = await page.goto("http://localhost:4110/sucafina/status")
    expect(status?.status()).toBe(200)
    expect(await status!.json()).toMatchObject({ login: "local-operator" })
    const notifications = await page.goto("http://localhost:4110/sucafina/notifications")
    expect(notifications?.status()).toBe(200)
    expect(notifications?.headers()["content-type"]).toContain("application/json")
    expect(await notifications!.json()).toEqual({ items: [] })
    for (const surface of ["dashboard", "planner", "procurement"]) {
      const response = await page.goto(`http://localhost:4110/sucafina/${surface}`)
      expect(response?.status()).toBe(404)
      expect(await response!.text()).toBe("legacy console decommissioned — use /")
    }
    expect(failures).toEqual([])
  } finally {
    await server.stop(true)
    await browser.close()
    await installation.dispose()
    await rm(root, { recursive: true, force: true })
  }
}, 60000)
