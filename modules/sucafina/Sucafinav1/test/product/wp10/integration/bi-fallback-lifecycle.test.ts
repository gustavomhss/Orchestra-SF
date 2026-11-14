import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createModule } from "../../../../index.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfBiHttp } from "../../../../product/integration/bi-http.ts"
import biBrowser from "../../../../product/integration/generated/bi-entry.txt" with { type: "text" }

test("fallback BI retains its real workspace through shell and periodic refresh and purges after access revocation", async () => {
  const { chromium } = await import("@playwright/test")
  const { captureChromiumCleanup } = await import("../../wp07/chromium-cleanup.ts")
  const directory = await mkdtemp(join(await realpath(tmpdir()), "wp10-bi-fallback-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(directory)
  const route: { handle?: (request: Request) => Promise<Response | undefined> } = {}
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => await route.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  const operator = { installationId: randomUUID(), uid: 1000, name: "BI lifecycle operator" }
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const now = () => "2026-11-14T08:00:00Z"
  const persistence = { ...driver, ...createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(now), createId: randomUUID }) }
  const environment = async (request: Request) => ({ at: now(), id: randomUUID, directory: await identity.directory(request) })
  let closeBrowser: (() => Promise<void>) | undefined
  try {
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "owner", name: "Lifecycle owner", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 100, actual: 50, forecast: 0 }]
      return { commit: true, value: undefined }
    })
    // This is the real local fallback composition, without createHostRuntime.
    const product = createSfBiHttp({ installationId: operator.installationId, projectId: operator.installationId, policyVersion: "sf-product-v1", origin,
      mount: "/sucafina", persistence, authenticate: identity.authenticate, environment, browserScript: async () => biBrowser })
    const app = createModule("/sucafina", { persistence, authenticate: identity.authenticate, environment, product, maxJsonBytes: 100_000 })
    route.handle = async (request) => await identity.handle(request) ?? await app(request)
    const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"], timeout: 15_000 })
    try { closeBrowser = await captureChromiumCleanup(browser) }
    catch (error) { await browser.close(); throw error }
    const page = await browser.newPage()
    page.setDefaultTimeout(15_000)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`)
    await page.clock.install()
    const first = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.goto(`${origin}/sucafina/dashboard?sf=bi&viewId=BI01&start=2026-01-01&end=2026-12-31`)
    expect((await first).status()).toBe(200)
    await page.getByText("Visualização atualizada para 2026-01-01 – 2026-12-31 (meses completos).").waitFor()
    const workspace = await page.locator("[data-sf-bi]").elementHandle()
    expect(workspace).not.toBeNull()
    const before = await page.locator("[data-sf-bi] table").first().textContent()
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 100, actual: 75, forecast: 0 }]
      return { commit: true, value: undefined }
    })
    const manual = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.getByRole("button", { name: "Refresh data", exact: true }).click()
    expect((await manual).status()).toBe(200)
    await page.getByText("Visualização atualizada para 2026-01-01 – 2026-12-31 (meses completos).").waitFor()
    expect(await workspace!.evaluate((node) => node.isConnected)).toBe(true)
    expect(await page.locator("[data-sf-bi] table").first().textContent()).not.toBe(before)
    const periodic = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
    await page.clock.runFor(30_000)
    expect((await periodic).status()).toBe(200)
    await page.getByText("Visualização atualizada para 2026-01-01 – 2026-12-31 (meses completos).").waitFor()
    expect(await workspace!.evaluate((node) => node.isConnected)).toBe(true)
    expect(await page.locator("[data-sf-bi] table").count()).toBeGreaterThan(0)
    expect(await page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST", credentials: "same-origin" })).status)).toBe(204)
    await page.getByRole("button", { name: "Refresh data", exact: true }).click()
    await page.locator("[data-access-unavailable]").waitFor()
    expect(await page.locator("[data-sf-bi]").count()).toBe(0)
    expect(await workspace!.evaluate((node) => node.childElementCount)).toBe(0)
    expect(errors).toEqual([])
  } finally {
    await closeBrowser?.()
    await server.stop(true)
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 120_000)
