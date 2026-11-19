import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { publicSfData } from "../product/integration/public-state.ts"
import { DASHBOARD_PAGES, PLANNER_TABS, PROCUREMENT_NAV } from "../src/nav.ts"

test("Chrome follows private enrollment while retired console routes remain unavailable", async () => {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "operator-browser-"))
  const origin = "http://localhost:3000"
  const file = await prepareLocalConfiguration(root, origin)
  const access = await prepareOperatorAccess(file, true)
  const environment = {
    ORCHESTRA_DB: path.join(root, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(root, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(root, "host-credential.key"),
    TMPDIR: path.join(root, "host-tmp"), XDG_DATA_HOME: path.join(root, "host-data"), XDG_CONFIG_HOME: path.join(root, "host-config"),
    XDG_CACHE_HOME: path.join(root, "host-cache"), XDG_STATE_HOME: path.join(root, "host-state"),
  }
  const installation = await createLocalInstallation({ origin }, file, environment)
  const server = Bun.serve({ hostname: "localhost", port: 3000, fetch: async (request) => await installation.handler(request) ?? new Response(null, { status: 404 }) })
  const { chromium } = await import("@playwright/test")
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  const failures: string[] = []
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
    page.on("pageerror", (error) => { failures.push(error.message) })
    const exportUrl = `${origin}/sucafina/dashboard?download=json`
    const anonymous = await page.request.get(exportUrl, { maxRedirects: 0, maxRetries: 0 })
    expect(anonymous.status()).toBe(303)
    expect(anonymous.headers()["location"]).toBe("/sucafina/auth/login?returnTo=" + encodeURIComponent("/sucafina/dashboard?download=json"))
    expect(anonymous.headers()["cache-control"]).toBe("no-store")
    const [enrollment] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin === origin && url.pathname === "/sucafina/auth/local"
      }),
      page.goto(pathToFileURL(access.artifact).href),
    ])
    expect(enrollment.status()).toBe(303)
    expect(enrollment.headers()["location"]).toBe("/")
    expect(enrollment.headers()["cache-control"]).toBe("no-store")
    await page.waitForURL(`${origin}/`)
    const cookies = (await page.context().cookies(exportUrl)).filter((cookie) => cookie.name.startsWith("sucafina_operator_"))
    expect(cookies).toHaveLength(1)
    expect(cookies[0]).toMatchObject({ path: "/sucafina", httpOnly: true, sameSite: "Lax" })
    // The enrollment redirects to the original root. The retained authorized
    // download independently proves the real browser session after retirement
    // of the three former document consoles.
    const store = await openLocalStore(path.join(root, "business-local"))
    try {
      const expected = await store.transaction("dashboard", async (snapshot) => ({
        commit: false, value: structuredClone(publicSfData(snapshot.data)),
      }))
      const exported = await page.request.get(exportUrl)
      expect(exported.status()).toBe(200)
      expect(exported.headers()["content-type"]).toBe("application/json")
      expect(exported.headers()["content-disposition"]).toBe("attachment; filename*=UTF-8''cio-dashboard.json")
      expect(exported.headers()["cache-control"]).toBe("no-store")
      expect(await exported.json()).toEqual(expected)
    } finally { await store.dispose() }
    await mkdir(path.join(import.meta.dir, "artifacts"), { recursive: true })
    for (const [surface, pages] of [
      ["dashboard", DASHBOARD_PAGES], ["planner", PLANNER_TABS], ["procurement", PROCUREMENT_NAV],
    ] as const) {
      const response = await page.goto(`${origin}/sucafina/${surface}`)
      expect(response?.status()).toBe(404)
      expect(await response!.text()).toBe("legacy console decommissioned — use /")
      expect(await page.locator("body").innerText()).toBe("legacy console decommissioned — use /")
      expect(await page.locator("body").innerText()).not.toContain("Microsoft 365 application is not configured")
      await page.screenshot({ path: path.join(import.meta.dir, "artifacts", `operator-${surface}.png`), fullPage: true })
      for (const title of pages) {
        const destination = new URL(`/sucafina/${surface}`, origin)
        destination.searchParams.set("page", title)
        const screen = await page.goto(destination.href)
        expect(screen?.status()).toBe(404)
        expect(await screen!.text()).toBe("legacy console decommissioned — use /")
        expect(await page.locator("body").innerText()).toBe("legacy console decommissioned — use /")
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
