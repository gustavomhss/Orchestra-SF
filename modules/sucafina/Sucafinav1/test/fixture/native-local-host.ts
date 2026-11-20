import { readdir } from "node:fs/promises"
import path from "node:path"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { microsoftNativeHost } from "../microsoft-login/native-host.ts"
import { launchBrowserDriver } from "../product/wp02/browser-driver-fixture.ts"

export { createSfHostRuntime } from "../../../../../apps/cli/src/sucafina-product/host-context.ts"

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

/** Native presentation for the original localBrowser installation.
 * The installed host initializes its real discovery, identity, grants, health
 * and file producers. Only the selected directory enters the HTML. The original
 * installation still handles enrollment and every business/file Request.
 */
export async function mountNativeLocalBrowser(
  disk: Parameters<typeof microsoftNativeHost>[0],
  installation: Parameters<typeof microsoftNativeHost>[1],
) {
  const shellDirectory = path.resolve(import.meta.dirname, "../../../../../packages/app-shell")
  const bundleDirectory = path.join(disk.directory, "native-browser")
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
  const host = await microsoftNativeHost(disk, installation)
  try {
    const selected = await installation.discovery?.current(new AbortController().signal)
    const identity = selected?.identity()
    if (!selected || !identity || identity.location.directory !== disk.directory)
      throw new Error("Native browser must select the original installed directory")
    const origin = selected.publicOrigin
    const config = JSON.stringify({ directory: identity.location.directory }).replaceAll("<", "\\u003c")
    const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
      assets.filter((name) => name.endsWith(".css")).map((name) => '<link rel="stylesheet" href="/__sf_native/' + name + '">').join("") +
      '</head><body><div id="root"></div><script id="sf-native-fixture" type="application/json">' + config +
      '</script><script type="module" src="/__sf_native/native.js"></script></body></html>'
    return {
      dispose: host.dispose,
      handle: async (request: Request): Promise<Response | undefined> => {
        const url = new URL(request.url)
        if (url.origin !== origin) return new Response(null, { status: 403 })
        if (request.method === "GET" && (url.pathname === "/" || url.pathname.startsWith("/orchestra/")))
          return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
        if (request.method === "GET" && url.pathname.startsWith("/__sf_native/")) {
          const name = url.pathname.slice("/__sf_native/".length)
          return assets.includes(name) ? new Response(Bun.file(path.join(bundleDirectory, name))) : new Response(null, { status: 404 })
        }
        if (url.pathname.startsWith("/api/")) return host.handler(request)
        return undefined
      },
    }
  } catch (error) {
    try { await host.dispose() } catch (cleanup) { throw new AggregateError([error, cleanup], "Native browser host setup and cleanup failed") }
    throw error
  }
}

export const launchNativeLocalBrowser = () => launchBrowserDriver("native-private-io")
