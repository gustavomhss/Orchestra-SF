import { createRequire } from "node:module"
import path from "node:path"
import { fileURLToPath } from "node:url"

const prefix = "/__sf-native-fixture/"
const appShell = fileURLToPath(new URL("../../../../../../packages/app-shell/", import.meta.url))
const compiler = createRequire(Bun.resolveSync("vite-plugin-solid", appShell))

const browserPackages = new Map<string, Promise<string>>()
function browserExport(value: unknown): string | undefined {
  if (typeof value === "string") return value.startsWith("./") ? value : undefined
  if (Array.isArray(value)) {
    for (const item of value) { const found = browserExport(item); if (found) return found }
    return undefined
  }
  if (!value || typeof value !== "object") return undefined
  for (const [condition, target] of Object.entries(value)) {
    if (!["browser", "import", "production", "default"].includes(condition)) continue
    const found = browserExport(target)
    if (found) return found
  }
  return undefined
}
function browserPackage(specifier: string): Promise<string> {
  let resolved = browserPackages.get(specifier)
  if (!resolved) {
    resolved = (async () => {
      const parts = specifier.split("/")
      const name = parts.slice(0, specifier.startsWith("@") ? 2 : 1).join("/")
      const suffix = specifier.slice(name.length)
      const packageFile = Bun.resolveSync(name + "/package.json", appShell)
      const metadata: unknown = await Bun.file(packageFile).json()
      if (!metadata || typeof metadata !== "object" || !("exports" in metadata))
        throw new Error("SF_NATIVE_BROWSER_PACKAGE_EXPORTS_MISSING:" + specifier)
      const exports = metadata.exports
      const subpath = "." + suffix
      const selected = exports && typeof exports === "object" && !Array.isArray(exports) &&
        Object.keys(exports).some((key) => key.startsWith("."))
        ? Reflect.get(exports, subpath) : suffix ? undefined : exports
      const target = browserExport(selected)
      if (!target) throw new Error("SF_NATIVE_BROWSER_EXPORT_MISSING:" + specifier)
      return path.resolve(path.dirname(packageFile), target)
    })()
    browserPackages.set(specifier, resolved)
  }
  return resolved
}

// Compile the real entries together once. In Actions, a second build of this
// shared graph failed with EISDIR after the first build had succeeded. Reuse
// immutable artifacts across tests; never carry their runtime config or session.
const entrypoints = new Map([
  [fileURLToPath(new URL("./client.tsx", import.meta.url)), "client.js"],
  [fileURLToPath(new URL("../wp01/http-entry.tsx", import.meta.url)), "http-entry.js"],
  [fileURLToPath(new URL("../wp06/native/import-output-entry.tsx", import.meta.url)), "import-output-entry.js"],
])
let compiled: ReturnType<typeof compileNativeBrowserAssets> | undefined

/** Cache only immutable build artifacts. Every HTTP handler still receives its
 * own server-generated config, and each page loads one entry with one Solid graph.
 */
async function compileNativeBrowserAssets() {
  const built = await Bun.build({
    entrypoints: [...entrypoints.keys()],
    target: "browser",
    format: "esm",
    sourcemap: "none",
    splitting: false,
    conditions: ["browser"],
    define: { "process.env.NODE_ENV": JSON.stringify("production") },
    naming: { entry: "[name].[ext]", chunk: "chunk-[hash].[ext]", asset: "asset-[hash].[ext]" },
    publicPath: prefix,
    loader: { ".svg": "file", ".png": "file", ".jpg": "file", ".woff": "file", ".woff2": "file" },
    plugins: [{
      name: "sf-native-browser-solid",
      setup(build) {
        // The fixture entry lives in sucafina, which does not own the app's
        // browser dependencies. Resolve the published browser/import exports
        // from app-shell, keeping its one Solid DOM runtime throughout the graph.
        build.onResolve({ filter: /^(solid-js|@solidjs\/router)(\/.*)?$/ }, async (args) => ({
          path: await browserPackage(args.path),
        }))
        build.onResolve({ filter: /^@\// }, (args) => ({
          path: Bun.resolveSync(path.join(appShell, "src", args.path.slice(2)), appShell),
        }))
        build.onLoad({ filter: /\.tsx$/ }, async (args) => {
          const result = await compiler("@babel/core").transformAsync(await Bun.file(args.path).text(), {
            filename: args.path,
            presets: [[compiler("babel-preset-solid"), { generate: "dom" }]],
            parserOpts: { plugins: ["jsx", "typescript"] },
            configFile: false,
            babelrc: false,
          })
          if (!result?.code) throw new Error("SF_NATIVE_BROWSER_SOLID_OUTPUT_MISSING")
          return { contents: result.code, loader: "ts" }
        })
      },
    }],
  })
  if (!built.success) throw new AggregateError(built.logs, "SF native browser bundle failed")
  const outputs = new Map(built.outputs.map((output) => [prefix + path.basename(output.path), output]))
  for (const name of entrypoints.values()) {
    if (outputs.get(prefix + name)?.kind !== "entry-point")
      throw new Error("SF_NATIVE_BROWSER_ENTRY_MISSING:" + name)
  }
  return { outputs, styles: built.outputs.filter((output) => output.path.endsWith(".css")) }
}

/** Serve an isolated composition of the original product renderer. Build output
 * is shared; directory, mode, values, identity and authority are never retained.
 */
export async function createNativeBrowserAssets(entry = new URL("./client.tsx", import.meta.url)) {
  const name = entrypoints.get(fileURLToPath(entry))
  if (!name) throw new Error("SF_NATIVE_BROWSER_ENTRY_UNREGISTERED")
  const { outputs, styles } = await (compiled ??= compileNativeBrowserAssets())
  const javascript = outputs.get(prefix + name)
  if (!javascript || javascript.kind !== "entry-point") throw new Error("SF_NATIVE_BROWSER_ENTRY_MISSING:" + name)
  const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
  return {
    handle(request: Request, config: Readonly<{ directory?: string; mode?: "owner" | "component"; value?: unknown }>): Response | undefined {
      const url = new URL(request.url)
      if (request.method !== "GET") return undefined
      const output = url.pathname === prefix + "client.js" ? javascript : outputs.get(url.pathname)
      if (output) return new Response(output, { headers: { ...headers, "Content-Type": output.type } })
      if (!url.pathname.startsWith("/orchestra/")) return undefined
      const payload = JSON.stringify(config).replace(/</g, "\\u003c").replace(/&/g, "\\u0026")
      const css = styles.map((style) => '<link rel="stylesheet" href="' + prefix + path.basename(style.path) + '">').join("")
      return new Response('<!doctype html><html lang="en" data-sf-fixture-mode="' +
        (config.mode ?? "owner") + '"><head><meta charset="utf-8"><title>Sucafina native fixture</title>' + css +
        '</head><body><main id="sf-native-root"></main><script id="sf-native-fixture" type="application/json">' + payload +
        '</script><script type="module" src="' + prefix + 'client.js"></script></body></html>',
        { headers: { ...headers, "Content-Type": "text/html; charset=utf-8" } })
    },
  }
}
