import { test } from "bun:test"
import { expect } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { launchBrowserDriver } from "../product/wp02/browser-driver-fixture.ts"
import { sourceNavigationChapters } from "./source-navigation-oracles"

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
console.log("SF_SOURCE_NAVIGATION_COMPONENT_BUILT")
`

// Consumer proof only: real component/provider/navigation-state, explicitly
// supplied context and delayed resolver inputs. This is not the installed
// 28-route visual journey, nor a server-side grant/availability/fence claim.
test("Source navigation component filters original pages and fences delegated owner transitions", async () => {
  expectSpawn(import.meta.path)
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-source-navigation-component-"))
  const cleanup: (() => Promise<unknown> | void)[] = [() => rm(root, { recursive: true, force: true })]
  const owned: { driver?: Awaited<ReturnType<typeof launchBrowserDriver>> } = {}
  let failure: unknown
  try {
    const shellDirectory = path.resolve(import.meta.dir, "../../../../../packages/app-shell")
    const node = Bun.which("node")
    if (!node) throw new Error("Node is unavailable for the source navigation component")
    const built = await Effect.gen(function* () {
      const processes = yield* AppProcess.Service
      return yield* processes.run(ChildProcess.make(node, [
        "--input-type=module", "-e", buildComponent,
        Bun.resolveSync("vite", shellDirectory), Bun.resolveSync("vite-plugin-solid", shellDirectory),
        shellDirectory, path.join(import.meta.dir, "source-navigation-entry.tsx"), root,
      ], { cwd: shellDirectory, extendEnv: true }), { timeout: "20 seconds", maxOutputBytes: 8192, maxErrorBytes: 16384 })
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
    if (built.exitCode !== 0 || !built.stdout.toString("utf8").includes("SF_SOURCE_NAVIGATION_COMPONENT_BUILT"))
      throw new Error("Source navigation component build failed: " + built.stderr.toString("utf8"))
    const assets = await readdir(root)
    if (!assets.includes("component.js") || assets.some((name) => !/^[A-Za-z0-9_-]+\.(?:js|css)$/.test(name)))
      throw new Error("Source navigation component assets are invalid")
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => {
      const url = new URL(request.url)
      if (request.method !== "GET") return new Response(null, { status: 405 })
      if (url.pathname === "/favicon.ico") return new Response(null, { status: 204 })
      if (url.pathname === "/") return new Response('<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        assets.filter((name) => name.endsWith(".css")).map((name) => '<link rel="stylesheet" href="/assets/' + name + '">').join("") +
        '</head><body><div id="root"></div><script type="module" src="/assets/component.js"></script></body></html>',
        { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
      if (url.pathname.startsWith("/assets/")) {
        const name = url.pathname.slice("/assets/".length)
        return assets.includes(name) ? new Response(Bun.file(path.join(root, name))) : new Response(null, { status: 404 })
      }
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
    const context = page.locator("[data-fixture-context]")
    const owner = page.locator("[data-fixture-owner]")
    const navigation = page.locator("[data-sf-source-navigation]")
    const links = navigation.locator("a")
    const action = (name: string) => page.locator('[data-fixture-action="' + name + '"]').click()
    const chapter = (name: string) => page.locator('[data-fixture-chapter="' + name + '"]').click()
    const read = async (name: "calls" | "commits" | "results"): Promise<unknown[]> => {
      const value: unknown = JSON.parse(await page.locator("[data-fixture-" + name + "]").textContent() ?? "null")
      if (!Array.isArray(value)) throw new Error("Navigation fixture observation is not an array")
      return value
    }
    const waitResult = async (count: number) => {
      await expect.poll(async () => (await read("results")).length, { timeout: 10000 }).toBe(count)
    }
    await expect(context).toHaveText("ready")
    expect(sourceNavigationChapters.map((entry) => entry.pages.length)).toEqual([5, 3, 2, 5, 6, 7])
    const allCaps = sourceNavigationChapters.flatMap((entry) => entry.pages.map((item) => item.cap))
    expect(allCaps.toSorted()).toEqual(Array.from({ length: 28 }, (_, index) => "CAP" + String(index + 1).padStart(2, "0")))
    for (const width of [1440, 1024, 768, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 })
      for (const entry of sourceNavigationChapters) {
        await chapter(entry.chapter)
        await expect(navigation).toHaveAttribute("data-sf-source-navigation", entry.chapter)
        await expect(links).toHaveText(entry.pages.map((item) => item.page))
        const rendered = await links.evaluateAll((nodes) => nodes.map((node) => ({
          cap: node.getAttribute("data-sf-capability"), href: node.getAttribute("href")!, height: node.getBoundingClientRect().height,
        })))
        expect(rendered.map((item) => item.cap)).toEqual(entry.pages.map((item) => item.cap))
        expect(new Set(rendered.map((item) => item.href)).size).toBe(entry.pages.length)
        for (const [index, item] of rendered.entries()) {
          const url = new URL(item.href, server.url.origin)
          expect(url.origin).toBe(server.url.origin)
          expect(url.pathname).toBe(entry.pages[index]!.path)
          expect([...url.searchParams]).toEqual([["server", "fixture-server"], ["project", "fixture-project"], ["installation", "fixture-install"]])
          expect(item.height).toBeGreaterThanOrEqual(44)
        }
        await expect(navigation.locator('[aria-current="page"]')).toHaveCount(1)
        await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute("data-sf-capability", entry.pages[0]!.cap)
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
      }
    }
    expect(await read("calls")).toEqual([])
    await chapter("sf-dashboard")
    const originalOwner = await owner.textContent()
    expect(originalOwner).toBeTruthy()
    const target = navigation.locator('[data-sf-capability="CAP02"]')
    const href = await target.getAttribute("href")
    await target.click()
    await waitResult(1)
    expect(await read("calls")).toEqual([{ href, cause: "sidebar", expectedOwnerKey: originalOwner, actualOwnerKey: originalOwner }])
    expect(await read("commits")).toEqual(["CAP02"])
    expect(await read("results")).toEqual(["committed"])
    await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute("data-sf-capability", "CAP02")
    // A document observer suppresses the fixture's HTTP default after checking
    // that the component itself leaves modified clicks untouched.
    for (const modifier of ["ctrlKey", "metaKey"] as const) {
      const prevented = await navigation.locator('[data-sf-capability="CAP03"]').evaluate((link, modifier) => {
        let prevented = true
        document.addEventListener("click", (event) => { prevented = event.defaultPrevented; event.preventDefault() }, { once: true })
        link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, [modifier]: true }))
        return prevented
      }, modifier)
      expect(prevented).toBe(false)
    }
    expect((await read("calls")).length).toBe(1)
    // A previous listener may cancel this ordinary click. Native navigation
    // must preserve that cancellation without delegating or committing it.
    expect(await navigation.locator('[data-sf-capability="CAP03"]').evaluate((link) => {
      const event = new MouseEvent("click", { bubbles: true, cancelable: true })
      event.preventDefault()
      return link.dispatchEvent(event)
    })).toBe(false)
    expect((await read("calls")).length).toBe(1)
    expect(await read("commits")).toEqual(["CAP02"])
    await action("limited")
    await expect(context).toHaveText("ready")
    await expect(links).toHaveCount(1)
    await expect(links).toHaveAttribute("data-sf-capability", "CAP01")
    await action("partial")
    await expect(links).toHaveCount(5)
    await action("denied")
    await expect(context).toHaveText("denied")
    await expect(navigation).toHaveCount(0)
    await action("all")
    await expect(context).toHaveText("ready")
    await action("mismatch")
    await expect(navigation).toHaveCount(0)
    await chapter("sf-dashboard")
    await expect(links).toHaveCount(5)
    // Current denial remains visible and logged.
    await action("hold-deny")
    await target.click()
    await expect(page.locator("[data-fixture-pending]")).toHaveText("true")
    await action("release")
    await waitResult(2)
    await expect(page.locator('[data-sf-state="denied"]')).toBeVisible()
    expect(consoleErrors).toHaveLength(1)
    expect(consoleErrors[0]).toContain("Sucafina source navigation did not commit")
    consoleErrors.length = 0
    await chapter("sf-people")
    await expect(page.locator("[role=alert]")).toHaveCount(0)
    // Changing the route under the same owner invalidates old feedback.
    await chapter("sf-dashboard")
    await action("hold-deny")
    await target.click()
    await expect(page.locator("[data-fixture-pending]")).toHaveText("true")
    await chapter("sf-people")
    await action("release")
    await waitResult(3)
    await expect(navigation.locator('[aria-current="page"]')).toHaveAttribute("data-sf-capability", "CAP06")
    await expect(page.locator("[role=alert]")).toHaveCount(0)
    expect(consoleErrors).toEqual([])
    // Unmount retains the provider on purpose: cleanup, rather than a changed
    // owner token, must prevent publication from this obsolete component.
    await chapter("sf-dashboard")
    await action("hold-deny")
    await target.click()
    await expect(page.locator("[data-fixture-pending]")).toHaveText("true")
    await action("unmount")
    await expect(navigation).toHaveCount(0)
    await action("release")
    await waitResult(4)
    expect(consoleErrors).toEqual([])
    await action("mount")
    await expect(links).toHaveCount(5)
    await expect(page.locator("[role=alert]")).toHaveCount(0)
    // The actual navigation-state checks the original expectedOwnerKey again
    // after a delayed resolution when the real provider is revoked/reloaded.
    for (const change of ["revoke", "owner"] as const) {
      await action("all")
      await expect(context).toHaveText("ready")
      const before = await owner.textContent()
      await action("hold-allow")
      await target.click()
      await expect(page.locator("[data-fixture-pending]")).toHaveText("true")
      await action(change)
      if (change === "revoke") {
        await expect(context).toHaveText("denied")
        await expect(navigation).toHaveCount(0)
      } else {
        await expect(context).toHaveText("ready")
        await expect(owner).not.toHaveText(before!)
      }
      await action("release")
      await waitResult(change === "revoke" ? 5 : 6)
      expect((await read("results")).at(-1)).toBe("denied")
      expect(await read("commits")).toEqual(["CAP02"])
      await expect(page.locator("[role=alert]")).toHaveCount(0)
      expect(consoleErrors).toEqual([])
    }
    expect(pageErrors).toEqual([])
  } catch (error) {
    failure = error
    throw error
  } finally {
    const failures: unknown[] = []
    for (const close of cleanup.reverse()) await Promise.resolve().then(close).catch((error) => failures.push(error))
    if (failures.length) throw new AggregateError(failure ? [failure, ...failures] : failures, "Source navigation component cleanup failed")
  }
  if (!owned.driver) throw new Error("Source navigation component browser did not start")
  owned.driver.report()
}, 90000)
