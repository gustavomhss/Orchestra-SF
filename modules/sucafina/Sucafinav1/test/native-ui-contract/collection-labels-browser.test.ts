import { test } from "bun:test"
import { expect } from "@playwright/test"
import { Effect, Schema } from "effect"
import { SfContext } from "@orchestra/schema/sucafina/context"
import { SfDomain } from "@orchestra/schema/sucafina/domain"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { ChildProcess } from "effect/unstable/process"
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
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
console.log("SF_COLLECTION_LABEL_COMPONENT_BUILT")
`

// Exact Playwright label selection against the real component, F01 draft and
// canonical F02 query transport. The HTTP source below is explicitly a fixture;
// this is not the installed Runtime journey or a source/CAS/save qualification.
test("Risk collection component labels select values and apply the original Status query", async () => {
  expectSpawn(import.meta.path)
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-collection-label-component-"))
  const cleanup: (() => Promise<unknown> | void)[] = [() => rm(root, { recursive: true, force: true })]
  const owned: { driver?: Awaited<ReturnType<typeof launchBrowserDriver>> } = {}
  let failure: unknown
  try {
    const shellDirectory = path.resolve(import.meta.dir, "../../../../../packages/app-shell")
    const node = Bun.which("node")
    if (!node) throw new Error("Node is unavailable for the collection label component")
    const built = await Effect.gen(function* () {
      const processes = yield* AppProcess.Service
      return yield* processes.run(ChildProcess.make(node, [
        "--input-type=module", "-e", buildComponent,
        Bun.resolveSync("vite", shellDirectory), Bun.resolveSync("vite-plugin-solid", shellDirectory),
        shellDirectory, path.join(import.meta.dir, "collection-labels-entry.tsx"), root,
      ], { cwd: shellDirectory, extendEnv: true }), { timeout: "20 seconds", maxOutputBytes: 8192, maxErrorBytes: 16384 })
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
    if (built.exitCode !== 0 || !built.stdout.toString("utf8").includes("SF_COLLECTION_LABEL_COMPONENT_BUILT"))
      throw new Error("Collection label component build failed: " + built.stderr.toString("utf8"))
    const assets = await readdir(root)
    if (!assets.includes("component.js") || assets.some((name) => !/^[A-Za-z0-9_-]+\.(?:js|css)$/.test(name)))
      throw new Error("Collection label component assets are invalid")
    const context = Schema.decodeUnknownSync(SfContext, { onExcessProperty: "error" })({
      stamp: { installationId: "fixture-install", projectId: "fixture-project", hostId: "fixture-host",
        principalRef: "fixture-actor", policyVersion: "fixture-policy", accessRevision: "fixture-access" },
      contractRevision: "sf-native-ui/1", authMode: "microsoft",
      destinations: [{ capabilityId: "CAP13", surface: "dashboard", page: "IT Risks", canRead: true, allowedActionIds: ["save"] }],
      availability: [{ family: "domain-read", resource: "CAP13", state: "ready", operations: [
        { operationId: "domain.page.CAP13", state: "ready", reason: null, operational: true },
        { operationId: "domain.command.CAP13.save", state: "ready", reason: null, operational: true },
      ] }],
    })
    const config = JSON.stringify(context).replaceAll("<", "\\u003c")
    const reads: Record<string, string>[] = [], unexpected: string[] = []
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => {
      const url = new URL(request.url)
      if (request.method !== "GET") {
        unexpected.push(request.method + " " + url.pathname)
        return new Response(null, { status: 405 })
      }
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 })
      if (url.pathname === "/") return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        assets.filter((name) => name.endsWith(".css")).map((name) => '<link rel="stylesheet" href="/assets/' + name + '">').join("") +
        '</head><body><div id="root"></div><script id="sf-collection-fixture" type="application/json">' + config +
        '</script><script type="module" src="/assets/component.js"></script></body></html>',
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
      if (url.pathname.startsWith("/assets/")) {
        const name = url.pathname.slice("/assets/".length)
        return assets.includes(name) ? new Response(Bun.file(path.join(root, name))) : new Response(null, { status: 404 })
      }
      if (url.pathname === "/sucafina/api/ui/pages/CAP13") {
        const observed = Object.fromEntries(url.searchParams)
        const selection = Schema.decodeUnknownSync(Schema.toType(SfDomain.operations["domain.page.CAP13"].input),
          { onExcessProperty: "error" })(observed)
        reads.push(observed)
        const body = Schema.decodeUnknownSync(Schema.toType(SfDomain.operations["domain.page.CAP13"].output),
          { onExcessProperty: "error" })({
          status: "ok", context: context.stamp,
          value: { capabilityId: "CAP13", selection, data: { risks: [] }, versions: {}, allowedActionIds: ["save"] },
        })
        return Response.json(body, { headers: { "Cache-Control": "no-store" } })
      }
      unexpected.push(request.method + " " + url.pathname)
      return new Response(null, { status: 404 })
    } })
    cleanup.push(() => server.stop(true))
    const driver = await launchBrowserDriver("dashboard-monthly")
    owned.driver = driver
    cleanup.push(() => driver.close())
    const page = await driver.browser.newPage()
    page.setDefaultTimeout(10000)
    page.setDefaultNavigationTimeout(10000)
    const pageErrors: string[] = [], consoleErrors: string[] = []
    page.on("pageerror", (error) => pageErrors.push(error.message))
    page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()) })
    expect((await page.goto(server.url.origin))?.status()).toBe(200)
    await expect(page.locator("[data-fixture-context]")).toHaveText("ready")
    await page.getByRole("button", { name: "New risk", exact: true }).click()
    const editor = page.locator("form.sf-u30-editor")
    await editor.getByLabel("Impact", { exact: true }).selectOption("3")
    await editor.getByLabel("Probability", { exact: true }).selectOption("2")
    await editor.getByLabel("Status", { exact: true }).selectOption("open")
    await expect(editor.getByLabel("Impact", { exact: true })).toHaveValue("3")
    await expect(editor.getByLabel("Probability", { exact: true })).toHaveValue("2")
    await expect(editor.getByLabel("Status", { exact: true })).toHaveValue("open")
    expect(reads.length).toBeGreaterThan(0)
    expect(reads.every((query) => Object.keys(query).length === 0)).toBe(true)
    const filters = page.locator(".sf-u30-filters")
    await filters.getByLabel("Status", { exact: true }).selectOption("open")
    const [response] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.origin === server.url.origin &&
          url.pathname === "/sucafina/api/ui/pages/CAP13" && url.searchParams.get("status") === "open"
      }, { timeout: 10000 }),
      filters.getByRole("button", { name: "Apply filters", exact: true }).click(),
    ])
    expect(response.status()).toBe(200)
    expect([...new URL(response.url()).searchParams]).toEqual([["status", "open"]])
    expect(reads.at(-1)).toEqual({ status: "open" })
    // The real controlled draft survives the source filter response; these are
    // DOM values obtained through the standard label engine, not attribute checks.
    await expect(filters.getByLabel("Status", { exact: true })).toHaveValue("open")
    await expect(editor.getByLabel("Impact", { exact: true })).toHaveValue("3")
    await expect(editor.getByLabel("Probability", { exact: true })).toHaveValue("2")
    await expect(editor.getByLabel("Status", { exact: true })).toHaveValue("open")
    expect(unexpected).toEqual([])
    expect(pageErrors).toEqual([])
    expect(consoleErrors).toEqual([])
  } catch (error) {
    failure = error
    throw error
  } finally {
    const failures: unknown[] = []
    for (const close of cleanup.reverse()) await Promise.resolve().then(close).catch((error) => failures.push(error))
    if (failures.length) throw new AggregateError(failure ? [failure, ...failures] : failures, "Collection label component cleanup failed")
  }
  if (!owned.driver) throw new Error("Collection label component browser did not start")
  owned.driver.report()
}, 90000)
