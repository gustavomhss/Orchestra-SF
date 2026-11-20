import { chmod, mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { pathToFileURL } from "node:url"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"

// The configured production build owns Solid, Tailwind, import.meta.glob and
// worker compilation. No browser source or generated client is substituted.
const buildScript = String.raw`
if (process.versions.bun || process.release.name !== "node") throw new Error("Node build owner required")
process.env.ORCHESTRA_BRAND = "sucafina"
process.env.ORCHESTRA_CHANNEL = "prod"
process.env.VITE_SENTRY_DSN = ""
process.env.SENTRY_AUTH_TOKEN = ""
process.env.SENTRY_ORG = ""
process.env.SENTRY_PROJECT = ""
delete process.env.ORCHESTRA_SF_E2E_UPSTREAM
const { build } = await import(process.argv[1])
await build({
  root: process.argv[2],
  configFile: process.argv[2] + "/vite.config.ts",
  logLevel: "warn",
  build: { outDir: process.argv[3], emptyOutDir: false, sourcemap: false },
})
console.log("SF_TEAMS_NATIVE_WEB_BUILD " + JSON.stringify({
  entry: "apps/web/src/entry.tsx", command: "vite build", brand: "sucafina", completed: true,
}))
`
export async function buildNativeTeamsWeb() {
  const directory = await mkdtemp(path.join(tmpdir(), "sf-teams-native-web-"))
  await chmod(directory, 0o700)
  const root = path.resolve(import.meta.dir, "../../../../../apps/web"), node = Bun.which("node")
  if (!node) { await rm(directory, { recursive: true, force: true }); throw new Error("Node unavailable for production Web build") }
  try {
    const vite = pathToFileURL(Bun.resolveSync("vite", root)).href
    const result = await Effect.gen(function* () {
      const process = yield* AppProcess.Service
      return yield* process.run(ChildProcess.make(node, ["--input-type=module", "-e", buildScript, vite, root, directory], {
        cwd: root, extendEnv: true, stdout: "pipe", stderr: "pipe",
      }), { timeout: "120 seconds", maxOutputBytes: 262144, maxErrorBytes: 262144 })
    }).pipe(Effect.flatMap(AppProcess.requireSuccess), Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
    const marker = result.stdout.toString("utf8").split("\n").find((line) => line.startsWith("SF_TEAMS_NATIVE_WEB_BUILD "))
    if (!marker || result.stdoutTruncated || result.stderrTruncated) throw new Error("Production Web build proof missing or truncated")
    console.info(marker)
    const index = await Bun.file(path.join(directory, "index.html")).text()
    if (!index.includes('data-orchestra-brand="sucafina"')) throw new Error("Production SF deployment identity missing")
    return {
      directory,
      async asset(request: Request): Promise<Response | undefined> {
        const url = new URL(request.url)
        if (request.method !== "GET" && request.method !== "HEAD") return
        const route = url.pathname === "/" || url.pathname.startsWith("/orchestra/")
        let relative: string
        try { relative = route ? "index.html" : decodeURIComponent(url.pathname).slice(1) } catch { return }
        if (!relative || relative.includes("\\") || relative.split("/").some((part) => part === ".." || part === ".")) return
        const file = path.resolve(directory, relative)
        if (!file.startsWith(directory + path.sep)) return
        const content = Bun.file(file)
        if (!await content.exists()) return
        return new Response(request.method === "HEAD" ? null : content, {
          headers: { "Content-Type": content.type || "application/octet-stream", "Cache-Control": "no-store" },
        })
      },
      close: () => rm(directory, { recursive: true, force: true }),
    }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}
