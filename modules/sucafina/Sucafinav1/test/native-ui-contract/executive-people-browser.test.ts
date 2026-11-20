import { test } from "bun:test"
import { expect } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect, Schema } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { projectSfDomainData } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain/projection.ts"
import { launchBrowserDriver } from "../product/wp02/browser-driver-fixture.ts"

const buildComponent = String.raw`
import { pathToFileURL } from "node:url"
const [vitePath, solidPath, shellDirectory, entry, outDir] = process.argv.slice(1)
const { build } = await import(pathToFileURL(vitePath).href)
const { default: solid } = await import(pathToFileURL(solidPath).href)
await build({
  configFile: false, root: shellDirectory, publicDir: false, logLevel: "error",
  plugins: [solid()],
  resolve: { alias: { "@": shellDirectory + "/src" }, dedupe: ["solid-js", "@solidjs/router"] },
  build: { target: "esnext", outDir, emptyOutDir: true, minify: false, sourcemap: false,
    lib: { entry, formats: ["es"], fileName: () => "component.js" },
    rollupOptions: { output: { entryFileNames: "component.js", chunkFileNames: "chunk-[hash].js", assetFileNames: "asset-[hash].[ext]" } },
  },
})
console.log("SF_EXECUTIVE_COMPONENT_BUILT")
`

// This causal browser test qualifies the real CAP01 component, producer DTO,
// formatting, CSS and provider purge. It does not qualify an installed journey.
test("Executive component renders four canonical measures with compatible, missing and stale periods", async () => {
  expectSpawn(import.meta.path)
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-executive-component-"))
  const cleanup: (() => Promise<unknown> | void)[] = [() => rm(root, { recursive: true, force: true })]
  try {
    const shellDirectory = path.resolve(import.meta.dir, "../../../../../packages/app-shell")
    const node = Bun.which("node")
    if (!node) throw new Error("Node is unavailable for the Executive component bundle")
    const built = await Effect.gen(function* () {
      const processes = yield* AppProcess.Service
      return yield* processes.run(ChildProcess.make(node, [
        "--input-type=module", "-e", buildComponent,
        Bun.resolveSync("vite", shellDirectory), Bun.resolveSync("vite-plugin-solid", shellDirectory),
        shellDirectory, path.join(import.meta.dir, "executive-people-entry.tsx"), root,
      ], { cwd: shellDirectory, extendEnv: true }), { timeout: "20 seconds", maxOutputBytes: 8192, maxErrorBytes: 16384 })
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
    if (built.exitCode !== 0 || !built.stdout.toString("utf8").includes("SF_EXECUTIVE_COMPONENT_BUILT"))
      throw new Error("Executive component bundle failed: " + built.stderr.toString("utf8"))
    const assets = await readdir(root)
    if (!assets.includes("component.js") || assets.some((name) => !/^[A-Za-z0-9_-]+\.(?:js|css)$/.test(name)))
      throw new Error("Executive component bundle assets are invalid")
    const finance = { opexOwners: [{ id: "opex", budget: 1200 }], opexEntries: [],
      capexProjects: [{ id: "capex", budget: 600 }], capexEntries: [] }
    const users = [{ id: "march", year: 2026, month: 3, users: 20 },
      { id: "april", year: 2026, month: 4, users: 30 }, { id: "may", year: 2026, month: 5, users: 40 }]
    const source = { ...finance, itUsersMonthly: users, executiveByYear: { "2026": { active: 90, departures: 20 } } }
    const reads: { scenario: string; month: number }[] = []
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: async (request) => {
      const url = new URL(request.url)
      if (request.method !== "GET") return new Response(null, { status: 405 })
      if (url.pathname === "/") return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        assets.filter((name) => name.endsWith(".css")).map((name) => '<link rel="stylesheet" href="/assets/' + name + '">').join("") +
        '</head><body><div id="root"></div><script type="module" src="/assets/component.js"></script></body></html>',
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
      if (url.pathname.startsWith("/assets/")) {
        const name = url.pathname.slice("/assets/".length)
        return assets.includes(name) ? new Response(Bun.file(path.join(root, name))) : new Response(null, { status: 404 })
      }
      if (url.pathname !== "/fixture/read") return new Response(null, { status: 404 })
      const scenario = url.searchParams.get("scenario") ?? "current"
      const month = Number(url.searchParams.get("month"))
      if (!["current", "legacy", "stale", "missing", "zero"].includes(scenario) || !Number.isInteger(month) || month < 1 || month > 12)
        return new Response(null, { status: 400 })
      reads.push({ scenario, month })
      const selected = scenario === "missing" ? {} : scenario === "zero"
        ? { opexOwners: [], opexEntries: [], capexProjects: [], capexEntries: [], itUsersMonthly: users,
          executive: { active: 90, departures: 0 } } : source
      // Legacy omission and deliberately mismatched producer period are separate
      // valid DTO scenarios. No display value is replaced in the fixture.
      const data = projectSfDomainData("CAP01", selected, 2026, scenario === "legacy" ? undefined : scenario === "stale" ? 3 : month)
      const body = Schema.decodeUnknownSync(SfDomain.operations["domain.page.CAP01"].output)({
        status: "ok", value: { capabilityId: "CAP01", selection: { year: 2026, month },
          data, versions: { "itUsersMonthly:march": 0, "itUsersMonthly:april": 0, "itUsersMonthly:may": 0 }, allowedActionIds: [] },
      })
      return Response.json(body)
    } })
    cleanup.push(() => server.stop(true))
    const driver = await launchBrowserDriver("dashboard-monthly")
    cleanup.push(async () => { await driver.close(); driver.report() })
    const page = await driver.browser.newPage()
    page.setDefaultTimeout(10000)
    page.setDefaultNavigationTimeout(10000)
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const open = async (scenario: string) => {
      expect((await page.goto(server.url.origin + "/?scenario=" + scenario))?.status()).toBe(200)
      await expect(page.locator('[data-sf-surface="CAP01"] [data-sf-state="ready"]')).toBeVisible()
    }
    const cards = page.locator(".sf-u02-people-metrics [data-sf-metric]")
    const missing = "Not available from this source"
    await open("current")
    await expect(cards).toHaveCount(4)
    await expect(cards.locator("dt")).toHaveText([
      "Total IT users", "Cost per User (OPEX)", "Cost per User (OPEX + CAPEX)", "Attrition YTD",
    ])
    await expect(cards.locator("dd")).toHaveText(["30", "40", "60", "20.00%"])
    await expect(page.locator('[data-sf-metric="benchmark"]')).toBeVisible()
    await expect(page.locator('[aria-labelledby="sf-u02-delivery"] [data-sf-metric="active"] dd')).toHaveText("90")
    await expect(page.locator(".sf-u02-financial-metrics [data-sf-metric]")).toHaveCount(3)
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
    await page.getByLabel("Month", { exact: true }).selectOption("5")
    await expect(cards.locator("dd")).toHaveText(["40", "30", "45", "20.00%"])
    expect(reads).toContainEqual({ scenario: "current", month: 5 })
    await open("legacy")
    await expect(cards.locator("dd")).toHaveText(["30", missing, missing, missing])
    await open("stale")
    await expect(cards.locator("dd")).toHaveText([missing, missing, missing, missing])
    await open("missing")
    await expect(cards.locator("dd")).toHaveText([missing, missing, missing, missing])
    await open("zero")
    await expect(cards.locator("dd")).toHaveText(["30", "0", "0", "0.00%"])
    await page.getByRole("button", { name: "Invalidate fixture access", exact: true }).click()
    await expect(page.locator("[data-fixture-context]")).not.toHaveText("ready")
    await expect(page.locator("[data-sf-metric]")).toHaveCount(0)
    expect(errors).toEqual([])
  } finally {
    const failures: unknown[] = []
    for (const close of cleanup.reverse()) await Promise.resolve().then(close).catch((error) => failures.push(error))
    if (failures.length) throw new AggregateError(failures, "Executive component cleanup failed")
  }
}, 90000)
