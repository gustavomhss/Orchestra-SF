import { chmod, mkdir, mkdtemp, readdir, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Effect, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { ChildProcess } from "effect/unstable/process"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import type { SfOperationAvailability } from "@orchestra/schema/sucafina/context"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { object } from "../../../runtime/contract.ts"
import { createSfProductDispatch } from "../../../../../../apps/cli/src/sucafina-product/contribution.ts"
import { createSfPortfolioServices } from "../../../../../../apps/cli/src/sucafina-product/portfolio-services.ts"
import { createSfLiveContext, sfContextDestinationsFromPages } from "../../../../../../apps/cli/src/sucafina-product/native-ui/live-context.ts"
import { createSfContextHandler } from "../../../../../../apps/cli/src/sucafina-product/native-ui/context.ts"
import { createSfDecisionsProjectionHandlers, observeSfCases } from "../../../../../../apps/cli/src/sucafina-product/native-ui/decisions.ts"
import { observeSfDecisionApplicationHealth } from "../../../../../../apps/cli/src/sucafina-product/native-ui/decision-application-health.ts"
import { mountSfNativeProjections } from "../../../../../../apps/cli/src/sucafina-product/native-ui/router.ts"
import type { SfTrustedInstallationSource } from "../../../../../../packages/server/src/sucafina-installations.ts"
import { encodeSfRouteRef } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/navigation-state/index.ts"
import { matchSfNativeRoutePath } from "../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/route-registry.ts"
import { createC12Fixture, prepareC12Change } from "./fixture.ts"

type Fixture = Awaited<ReturnType<typeof createC12Fixture>>

/** The same C12 authority, C08, original Request, application and business
 * instances feed the installed native readers. Every ready operation comes
 * from its production health observer; nothing supplies a context DTO.
 */
function nativeC12(fixture: Fixture, origin: string, current: () => boolean) {
  const { authority, business, installationIdentity } = fixture
  const portfolio = createSfPortfolioServices({
    authority, business, proposalCoverageWrites: fixture.proposalCoverageWrites,
    procurementEvidenceWrites: fixture.procurementEvidenceWrites,
  })
  // I00 installs this original review handler before Procurement. Both adapters
  // call this fixture's same procurementDecisions.reviewChange instance.
  const portfolioHttp = portfolio.http({ origin, mount: "/sf" })
  const productHttp: NonNullable<SfHostServices["productHttp"]> = async (request, surface) =>
    surface === "procurement" ? await portfolioHttp(request, surface) ?? await fixture.application(request) : undefined
  const unsupported = async (): Promise<never> => {
    throw new Error("C12 native browser does not mount model or execution services")
  }
  let nativeUiProducts: ReturnType<typeof createSfLiveContext> | undefined
  const runtime: SfHostServices & { readonly nativeUiProducts: typeof nativeUiProducts } = {
    ...authority, productHttp,
    dispatch: createSfProductDispatch({ descriptors: business.descriptors, authority: authority.authority }),
    get nativeUiProducts() { return nativeUiProducts },
    // These unavailable services are never advertised or invoked by UI39.
    // An unexpected model/session call fails instead of returning a fake result.
    selected: [], models: unsupported,
    sessions: { prepare: unsupported, execute: unsupported, collect: unsupported, interrupt: unsupported },
  }
  const base = { origin, mount: "/sf", application: fixture.applicationOptions,
    runtime: () => current() ? runtime : undefined }
  const context = createSfContextHandler(base)
  const deps = { ...base, readContext: context.readContext }
  const handlers = createSfDecisionsProjectionHandlers(deps)
    .filter((handler) => handler.operationId === "projection.case")
  nativeUiProducts = createSfLiveContext({
    origin, mount: "/sf",
    currentBinding: () => current() ? installationIdentity : undefined,
    admit: async (request) => {
      const admitted = await authority.readContextAdmission(request)
      if (admitted.status !== "ok") return admitted
      const destinations = sfContextDestinationsFromPages(admitted.pages)
      return destinations ? { status: "ok", stamp: admitted.stamp, authMode: "local-operator", destinations }
        : { status: "unavailable", reason: "contract-mismatch" }
    },
    operational: async (request, stamp) => {
      const observations = await Promise.allSettled([
        observeSfCases(deps, handlers, request, stamp),
        observeSfDecisionApplicationHealth({
          ui: authority.ui, state: authority.state, humanActions: authority.humanActions,
          binding: (operationId, producer) => current() && runtime.productHttp === productHttp &&
            producer === productHttp && ["decisions.decision-review", "decisions.decision-apply",
              "decisions.decision-recover"].includes(operationId) ? productHttp : undefined,
          source: (operationId) => {
            if (!current() || runtime.productHttp !== productHttp) return undefined
            const producer = business.procurementDecisions
            const operation = operationId === "decisions.decision-review" ? producer.reviewChange
              : operationId === "decisions.decision-apply" ? producer.apply : producer.recover
            return { producer: productHttp, dependencies: [authority, authority.ui, authority.state,
              operationId === "decisions.decision-review" ? portfolioHttp : fixture.application,
              producer, operation, business.withCase, business.cases, fixture.persistence] }
          },
        }, request, stamp),
      ])
      return observations.flatMap<SfOperationAvailability>((result) => result.status === "fulfilled" ? result.value : [])
    },
  })
  const projections = mountSfNativeProjections({ mount: "/sf", context, handlers })
  return { projections, productHttp, close: () => portfolio.dispose() }
}

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
console.log("SF_C12_NATIVE_BUNDLE_BUILT")
`

/** Browser migration only: the same SQLite fixture and interleaving hooks
 * survive; UI39, F01, A05 clients and all response bytes are production code.
 */
export async function createC12NativeConsumer() {
  const started = performance.now()
  const phase = (name: string) => console.info("SF_C12_NATIVE_PHASE",
    JSON.stringify({ phase: name, elapsedMs: Math.round(performance.now() - started) }))
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-c12-native-"))
  await chmod(directory, 0o700)
  let fixture: Fixture | undefined
  let installed: ReturnType<typeof nativeC12> | undefined
  let closeEmbedded: (() => Promise<void>) | undefined
  const traffic: { mode: string | null; body: string; key: string | null; status: number; result: Record<string, unknown> }[] = []
  const route: { handle?: (request: Request) => Promise<Response> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0,
    fetch: async (request) => await route.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  let closing: Promise<void> | undefined
  const close = () => closing ??= (async () => {
    const failures: unknown[] = []
    for (const cleanup of [
      () => server.stop(true), () => closeEmbedded?.(), () => installed?.close(),
      () => fixture?.dispose(), () => rm(directory, { recursive: true, force: true }),
    ]) {
      try { await cleanup() } catch (error) { failures.push(error) }
    }
    installed = undefined; fixture = undefined
    if (failures.length) throw new AggregateError(failures, "C12 native consumer cleanup failed")
  })()
  try {
    phase("bundle")
    const shellDirectory = path.resolve(import.meta.dirname, "../../../../../../packages/app-shell")
    const bundleDirectory = path.join(directory, "native")
    await mkdir(bundleDirectory, { mode: 0o700 })
    const node = Bun.which("node")
    if (!node) throw new Error("Node is unavailable for the C12 native bundle")
    const result = await Effect.gen(function* () {
      const processes = yield* AppProcess.Service
      return yield* processes.run(ChildProcess.make(node, [
        "--input-type=module", "-e", buildNative,
        Bun.resolveSync("vite", shellDirectory), Bun.resolveSync("vite-plugin-solid", shellDirectory),
        shellDirectory, path.join(import.meta.dirname, "native-browser-entry.tsx"), bundleDirectory,
      ], { cwd: shellDirectory, extendEnv: true }), { timeout: "20 seconds", maxOutputBytes: 8192, maxErrorBytes: 16384 })
    }).pipe(Effect.provide(LayerNode.compile(AppProcess.node)), Effect.runPromise)
    if (result.exitCode !== 0 || !result.stdout.toString("utf8").includes("SF_C12_NATIVE_BUNDLE_BUILT"))
      throw new Error("C12 native browser bundle failed: " + result.stderr.toString("utf8"))
    const assets = await readdir(bundleDirectory)
    if (!assets.includes("native.js") || assets.some((name) => !/^[A-Za-z0-9_-]+\.(?:js|css)$/.test(name)))
      throw new Error("C12 native browser bundle files are invalid")
    phase("fixture")
    fixture = await createC12Fixture("I-OPS-02-H05", origin)
    const prepared = await prepareC12Change(fixture)
    const mount = (value: Fixture) => nativeC12(value, origin, () => fixture === value)
    installed = mount(fixture)
    const discovery: SfTrustedInstallationSource = {
      current: async (signal) => {
        const value = fixture
        return signal.aborted || !value ? undefined : {
          publicOrigin: origin, mount: "/sf", authMode: "local-operator",
          identity: () => fixture === value ? value.installationIdentity : undefined,
        }
      },
      forAdmittedLocation: async (location, signal) => {
        const value = fixture
        return signal.aborted || !value || location.workspace ||
          location.directory !== value.installationIdentity.location.directory ? [] : [{
            publicOrigin: origin, mount: "/sf", authMode: "local-operator",
            identity: () => fixture === value ? value.installationIdentity : undefined,
          }]
      },
    }
    await import("@orchestra/core/global")
    const { createEmbeddedRoutes } = await import("../../../../../../packages/server/src/routes.ts")
    const { AppNodeBuilder } = await import("@orchestra/core/effect/app-node-builder")
    const { PermissionSaved } = await import("@orchestra/core/permission/saved")
    const { ClaudeCodeAccount } = await import("@orchestra/core/claude-code-account")
    const embedded = HttpRouter.toWebHandler(createEmbeddedRoutes({ sucafinaInstallations: discovery }).pipe(
      HttpRouter.provideRequest(AppNodeBuilder.build(LayerNode.group([PermissionSaved.node, ClaudeCodeAccount.node]))),
      Layer.provide(HttpServer.layerServices),
    ), { disableLogger: true })
    closeEmbedded = () => embedded.dispose()
    const health = await embedded.handler(new Request(origin + "/api/health"))
    if (health.status !== 200) throw new Error("C12 native discovery server did not initialize")
    route.handle = async (request) => {
      const value = fixture, native = installed
      if (!value || !native) return new Response(null, { status: 503 })
      const url = new URL(request.url)
      if (url.origin !== origin) return new Response(null, { status: 403 })
      if (request.method === "GET" && url.pathname.startsWith("/orchestra/")) {
        const config = JSON.stringify({ directory: value.directory }).replaceAll("<", "\\u003c")
        const html = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
          assets.filter((name) => name.endsWith(".css")).map((name) => '<link rel="stylesheet" href="/__sf_native/' + name + '">').join("") +
          '</head><body><div id="root"></div><script id="sf-native-fixture" type="application/json">' + config +
          '</script><script type="module" src="/__sf_native/native.js"></script></body></html>'
        return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } })
      }
      if (request.method === "GET" && url.pathname.startsWith("/__sf_native/")) {
        const name = url.pathname.slice("/__sf_native/".length)
        return assets.includes(name) ? new Response(Bun.file(path.join(bundleDirectory, name))) : new Response(null, { status: 404 })
      }
      if (url.pathname.startsWith("/api/")) return embedded.handler(request)
      if (request.method === "POST" && url.pathname === "/sf/procurement") {
        const body = await request.clone().text()
        const response = await native.productHttp(request, "procurement")
        if (!response) throw new Error("Original C12 application did not handle the native request")
        traffic.push({ mode: url.searchParams.get("sf"), body, key: request.headers.get("idempotency-key"),
          status: response.status, result: object(await response.clone().json()) })
        return response
      }
      return await native.projections(request) ?? new Response(null, { status: 404 })
    }
    const caseRef = encodeCaseRef(prepared.request.caseRef)
    const pathname = "/orchestra/sf-decisions/" + encodeSfRouteRef(caseRef) +
      "/changes/" + encodeSfRouteRef(prepared.request.changeId)
    // The installed shell admits only canonical F01 route tokens. Parse this
    // actual link before launching Chrome; syntax does not grant case access.
    const routeCandidate = matchSfNativeRoutePath(pathname)
    if (routeCandidate?.surfaceId !== "UI39" || routeCandidate.kind !== "entry" ||
      routeCandidate.parameters.caseRef !== caseRef || routeCandidate.parameters.changeRef !== prepared.request.changeId)
      throw new Error("C12 native prepared-change route does not preserve its original references")
    const url = origin + pathname
    phase("ready")
    return {
      url, prepared, traffic,
      current: () => { if (!fixture) throw new Error("C12 native fixture closed"); return fixture },
      reopen: async () => {
        if (!fixture || !installed) throw new Error("C12 native fixture closed")
        const retained = { directory: fixture.directory, caseId: fixture.caseId }
        await installed.close()
        installed = undefined
        await fixture.dispose(false)
        fixture = undefined
        const next = await createC12Fixture("I-OPS-02-reopen", origin, retained)
        fixture = next
        installed = mount(next)
        phase("reopened")
      },
      close,
    }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error, cleanup], "C12 native setup and cleanup failed") }
    throw error
  }
}
