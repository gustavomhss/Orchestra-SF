import { randomBytes, randomUUID } from "node:crypto"
import { chmod, mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { initializeAbsentSfProductState } from "../../../product/host-binding/state-provider.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import type { Command } from "../../../runtime/contract.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { readOperatorSessionCookie } from "../../../../../../packages/app-shell/e2e/sucafina/decisions-support/operator-session-cookie.ts"

const buildNative = String.raw`
import { pathToFileURL } from "node:url"
const [vitePath, solidPath, shellDirectory, entry, outDir] = process.argv.slice(1)
const { build } = await import(pathToFileURL(vitePath).href)
const { default: solid } = await import(pathToFileURL(solidPath).href)
await build({
  configFile: false, root: shellDirectory, publicDir: false, logLevel: "error",
  plugins: [solid()],
  resolve: { alias: { "@": shellDirectory + "/src" }, dedupe: ["solid-js", "@solidjs/router"] },
  build: {
    target: "esnext", outDir, emptyOutDir: true, minify: false, sourcemap: false,
    lib: { entry, formats: ["es"], fileName: () => "native.js" },
    rollupOptions: { output: { entryFileNames: "native.js", chunkFileNames: "chunk-[hash].js", assetFileNames: "asset-[hash].[ext]" } },
  },
})
console.log("SF_NATIVE_BROWSER_BUNDLE_BUILT")
`

/** Real native browser consumer composition. The fixture owns its loopback
 * listener, SQLite, encrypted operator, host graph, and temporary Vite output.
 * No legacy renderer, fabricated discovery response or injected context is used.
 * The caller declares expectSpawn before acquiring the fixture and Chrome.
 */
export async function createNativeDashboardFixture() {
  const started = performance.now()
  const phase = (name: string) => console.info("SF_NATIVE_DASHBOARD_PHASE",
    JSON.stringify({ phase: name, elapsedMs: Math.round(performance.now() - started) }))
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-native-dashboard-"))
  await chmod(directory, 0o700)
  const cleanups: (() => Promise<void>)[] = [() => rm(directory, { recursive: true, force: true })]
  let closing: Promise<void> | undefined
  const close = () => closing ??= (async () => {
    const failures: unknown[] = []
    for (const cleanup of [...cleanups].reverse()) {
      try { await cleanup() } catch (error) { failures.push(error) }
    }
    if (failures.length) throw new AggregateError(failures, "Native Dashboard fixture cleanup failed")
  })()
  try {
    phase("bundle")
    const shellDirectory = path.resolve(import.meta.dirname, "../../../../../../packages/app-shell")
    const bundleDirectory = path.join(directory, "native")
    const node = Bun.which("node")
    if (!node) throw new Error("Node is unavailable for the native browser bundle")
    const result = await Effect.gen(function* () {
      const processes = yield* AppProcess.Service
      return yield* processes.run(ChildProcess.make(node, [
        "--input-type=module", "-e", buildNative,
        Bun.resolveSync("vite", shellDirectory), Bun.resolveSync("vite-plugin-solid", shellDirectory),
        shellDirectory, path.join(import.meta.dirname, "native-browser-entry.tsx"), bundleDirectory,
      ], { cwd: shellDirectory, extendEnv: true }), { timeout: "20 seconds", maxOutputBytes: 8192, maxErrorBytes: 16384 })
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
    if (result.exitCode !== 0 || !result.stdout.toString("utf8").includes("SF_NATIVE_BROWSER_BUNDLE_BUILT"))
      throw new Error("Native browser bundle failed: " + result.stderr.toString("utf8"))
    const assets = await readdir(bundleDirectory)
    if (!assets.includes("native.js") || assets.some((name) => !/^[A-Za-z0-9_-]+\.(?:js|css)$/.test(name)))
      throw new Error("Native browser bundle files are invalid")
    phase("store")
    const stateDirectory = path.join(directory, "state")
    await mkdir(stateDirectory, { mode: 0o700 })
    const driver = await openLocalStore(stateDirectory)
    cleanups.push(() => driver.dispose())
    const at = "2026-11-13T08:00:00Z", mount = "/sucafina"
    const persistence = { ...driver, ...createSfSourcePersistence({
      persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
      projectScope: createSfSourceScopeProjector(() => at),
    }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const)
      await persistence.initializeSources(surface)
    await initializeAbsentSfProductState(persistence, randomUUID)
    const route: { handle?: (request: Request) => Promise<Response> } = {}
    const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
      fetch: async (request) => await route.handle?.(request) ?? new Response(null, { status: 503 }) })
    cleanups.push(() => server.stop(true))
    const origin = server.url.origin, installationId = randomUUID()
    const identity = createOperatorIdentity({
      origin, mount, operator: { installationId, uid: 1000, name: "Dashboard operator" },
      secrets: driver.secrets, key: randomBytes(32),
    })
    const principalRef = "macos:" + installationId + ":1000"
    phase("host")
    await import("@orchestra/core/global")
    const { createOperationsInstallation } = await import("../../../../../../packages/app-shell/e2e/sucafina/operations-support/installation.ts")
    const { createEmbeddedRoutes } = await import("../../../../../../packages/server/src/routes.ts")
    const { AppNodeBuilder } = await import("@orchestra/core/effect/app-node-builder")
    const { PermissionSaved } = await import("@orchestra/core/permission/saved")
    const { ClaudeCodeAccount } = await import("@orchestra/core/claude-code-account")
    const installation = await createOperationsInstallation({
      installationId, directory: stateDirectory, origin, mount,
      operators: [{ principalRef, readOnly: false }], persistence,
      authenticate: identity.authenticate, isAuthenticated: async (request) => Boolean(await identity.person(request)),
      environment: async (request) => ({ at, id: randomUUID, directory: await identity.directory(request) }),
      signingKey: randomBytes(32), scanner: null,
      grants: [{
        principalRef, namespaces: ["cases", "reviews", "preferences", "receipts", "documents"],
        operations: ["sf_dashboard_read", "sf_case_read", "sf_import_preview"],
        humanActions: ["reviews.preserve", "decisions.edit", "imports.admit", "imports.apply"],
      }],
    })
    const embedded = HttpRouter.toWebHandler(createEmbeddedRoutes({
      host: installation.host, sucafinaInstallations: installation.discovery,
    }).pipe(
      HttpRouter.provideRequest(AppNodeBuilder.build(LayerNode.group([PermissionSaved.node, ClaudeCodeAccount.node]))),
      Layer.provide(HttpServer.layerServices),
    ), { disableLogger: true })
    cleanups.push(() => embedded.dispose())
    const health = await embedded.handler(new Request(origin + "/api/health"))
    if (health.status !== 200 || !installation.identity()) throw new Error("Native Dashboard host did not initialize")
    const config = JSON.stringify({ directory: stateDirectory }).replaceAll("<", "\\u003c")
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      assets.filter((name) => name.endsWith(".css")).map((name) => '<link rel="stylesheet" href="/__sf_native/' + name + '">').join("") +
      '</head><body><div id="root"></div><script id="sf-native-fixture" type="application/json">' + config +
      '</script><script type="module" src="/__sf_native/native.js"></script></body></html>'
    const delayed: { next: boolean; release?: () => void; started?: () => void } = { next: false }
    route.handle = async (request) => {
      const url = new URL(request.url)
      if (url.origin !== origin) return new Response(null, { status: 403 })
      if (request.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/orchestra/")))
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
      if (request.method === "GET" && url.pathname.startsWith("/__sf_native/")) {
        const name = url.pathname.slice("/__sf_native/".length)
        return assets.includes(name) ? new Response(Bun.file(path.join(bundleDirectory, name))) : new Response(null, { status: 404 })
      }
      if (url.pathname.startsWith("/api/")) return embedded.handler(request)
      const authentication = await identity.handle(request)
      if (authentication) return authentication
      const command: unknown = request.method === "POST" ? await request.clone().json().catch(() => undefined) : undefined
      const response = await installation.application(request) ?? new Response(null, { status: 404 })
      if (delayed.next && request.method === "POST" && url.pathname === mount + "/dashboard" &&
          object(command).page === "OPEX Detail" && object(command).action === "save-deviation" && response.ok) {
        delayed.next = false
        await new Promise<void>((resolve) => { delayed.release = resolve; delayed.started?.() })
      }
      return response
    }
    // Enroll through the original identity handler; only its issued cookie is
    // transferred to Chrome. The one-use private URL never enters a trace.
    const admitted = await identity.handle(new Request(origin + mount + "/auth/local?code=" + await identity.enroll()))
    if (admitted?.status !== 303) throw new Error("Native Dashboard enrollment failed")
    const cookie = readOperatorSessionCookie(admitted.headers, origin)
    const cookieHeader = cookie.name + "=" + cookie.value
    const command = async (input: Command) => {
      const response = await fetch(origin + mount + "/dashboard", {
        method: "POST", headers: { cookie: cookieHeader, origin, "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      const result: unknown = await response.json()
      if (response.status !== 200 || object(result).ok !== true) throw new Error("Native Dashboard corpus command failed")
      return result
    }
    // Create the financial rows through the real command producer, including
    // their CAS versions. IDs are read from SQLite after these actual commits.
    const owner = async (name: string, budget: number) => {
      await command({ page: "OPEX Detail", action: "save", version: 0, values: { name, budget } })
      return persistence.transaction("dashboard", async (snapshot) => {
        const found = rows(snapshot.data.opexOwners).filter((item) => item.name === name)
        if (found.length !== 1 || typeof found[0]!.id !== "string") throw new Error("Created budget owner is unavailable")
        return { commit: false, value: found[0]!.id }
      })
    }
    const ownerId = await owner("Operations", 1200), otherOwnerId = await owner("Other area", 2400)
    for (const [month, actual, forecast] of [[1, 25, 90], [2, 50, 95]] as const)
      await command({ page: "OPEX Detail", action: "save-entry", version: 0, values: { ownerId, year: 2026, month, budget: 100, actual, forecast } })
    // Establish the empty year hint through a canonical command so its v1 CAS
    // exists; clearing it does not create or recalculate any monthly amounts.
    await command({ page: "OPEX Detail", action: "year-amount", id: ownerId, version: 0, values: { year: 2026, amount: null } })
    const entries = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: rows(snapshot.data.opexEntries).map((entry) => ({ ...entry })) }))
    const jan = entries.find((entry) => entry.month === 1), feb = entries.find((entry) => entry.month === 2)
    if (typeof jan?.id !== "string" || typeof feb?.id !== "string") throw new Error("Created monthly rows are unavailable")
    phase("ready")
    return { origin, directory: stateDirectory, persistence, identity, cookie, principalRef, delayed,
      ownerId, otherOwnerId, janId: jan.id, febId: feb.id, command, close }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error, cleanup], "Native Dashboard setup and cleanup failed") }
    throw error
  }
}
