import { beforeAll, expect, test } from "bun:test"
import { createServer } from "node:http"
import { writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { Effect, Layer, Option, Tracer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import type { EntraOptions } from "../runtime/local-contract.ts"
import type { MicrosoftTransport } from "../runtime/microsoft-installation.ts"
import { microsoftFixture } from "./microsoft-login/oidc-fixture.ts"
import { privateFixture, ingressOrigin, publicOrigin } from "./microsoft-login/private-fixture.ts"
import { integrationModule } from "./microsoft-login/integration-fixture.ts"

type Installation = { mount: `/${string}`; handler: (request: Request) => Promise<Response | undefined>; dispose: () => void | Promise<void>; transport?: MicrosoftTransport }
type Entry = { createMicrosoftInstallation: (context: { origin: string }, file: string | undefined, environment: Readonly<Record<string, string | undefined>>, overrides?: { fetch?: EntraOptions["fetch"]; now?: () => Date }) => Promise<Installation> }
type Loader = { composeSfInstallation: (value: unknown, origin: string) => Promise<Installation & { layer: Layer.Layer<never, never, HttpRouter.HttpRouter>; privacy: Layer.Layer<never> }> }
// This call must fail in preflight, before it can require the intentionally absent host services.
type PreflightServe = { serveForever: (input: { hostname: string; port: Option.Option<number>; register: boolean; installation: Option.Option<string> }) => Effect.Effect<unknown, unknown> }
type NodeServer = { layer: (evaluate: () => ReturnType<typeof createServer>, options: { host: string; port: number }) => Layer.Layer<HttpServer.HttpServer, unknown> }
let entry: Entry
let loader: Loader
let serve: PreflightServe
let NodeHttpServer: NodeServer
beforeAll(async () => {
  // This adapter is an existing CLI dependency; resolve it from that package without adding a Sucafina dependency.
  const cli = createRequire(path.resolve(import.meta.dir, "../../../../apps/cli/package.json"))
  const platform = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href) as { NodeHttpServer: NodeServer }
  NodeHttpServer = platform.NodeHttpServer
  entry = await integrationModule<Entry>("modules/sucafina/Sucafinav1/local/entry.ts")
  loader = await integrationModule<Loader>("apps/cli/src/sucafina-product/installation.ts")
  serve = await integrationModule<PreflightServe>("apps/cli/src/commands/handlers/serve.ts")
})

test("actual serve preflight rejects absent Microsoft configuration before requiring daemon or database services", async () => {
  const f = await privateFixture()
  try {
    const file = path.join(f.root, "missing-configuration.ts")
    await writeFile(file, `import { prepareMicrosoftInstallation } from ${JSON.stringify(new URL("../runtime/microsoft-installation.ts", import.meta.url).href)}\nexport default (context: { origin: string }) => prepareMicrosoftInstallation(context, undefined, {})\n`, { mode: 0o600, flag: "wx" })
    const exit = await Effect.runPromise(Effect.exit(serve.serveForever({ hostname: "127.0.0.1", port: Option.some(0), register: false, installation: Option.some(file) })))
    expect(exit._tag).toBe("Failure")
    if (exit._tag === "Failure") {
      const failed = exit.cause.reasons.find((reason) => reason._tag === "Fail")
      expect(failed?._tag).toBe("Fail")
      if (failed?._tag === "Fail") expect(failed.error).toEqual(new Error("One explicit Microsoft installation profile required"))
    }
    expect(await Bun.file(path.join(f.directory, "host-data", "orchestra.db")).exists()).toBe(false)
    expect(await Bun.file(path.join(f.directory, "business-microsoft", "installation.sqlite")).exists()).toBe(false)
  } finally { await f.close() }
})

test("real Node ingress strips forwarded hints before toWeb and reaches the pinned HTTPS Microsoft identity", async () => {
  const f = await privateFixture()
  const provider = await microsoftFixture()
  const spans: Tracer.NativeSpan[] = []
  const tracer = Tracer.make({ span(options) { const span = new Tracer.NativeSpan(options); spans.push(span); return span } })
  const server = createServer()
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const httpServer = yield* HttpServer.HttpServer
      if (httpServer.address._tag !== "TcpAddress") throw new Error("Expected ephemeral TCP listener")
      const listener = `http://127.0.0.1:${httpServer.address.port}`
      yield* Effect.promise(() => writeFile(f.file, JSON.stringify({ ...f.config, listenerOrigin: listener })))
      const application = yield* Effect.acquireRelease(
        Effect.promise(() => entry.createMicrosoftInstallation({ origin: listener }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })),
        (application) => Effect.promise(async () => { await application.dispose() }),
      )
      const installation = yield* Effect.promise(() => loader.composeSfInstallation(application, listener))
      yield* Layer.build(HttpRouter.serve(installation.layer, { disableLogger: true, disableListenLog: true }).pipe(
        Layer.provide(installation.privacy),
        Layer.provide(Layer.succeed(Tracer.Tracer)(tracer)),
      ))
      yield* Effect.promise(async () => {
        // Node's raw URL is only a path. Without the pre-toWeb strip, Effect uses this forged HTTPS hint and the ingress fence fails.
        const request = (pathname: string, headers: Record<string, string> = {}, body?: Record<string, unknown>) => fetch(`${listener}${pathname}`, {
          method: body === undefined ? "GET" : "POST",
          redirect: "manual", headers: { host: new URL(ingressOrigin).host, connection: "close", forwarded: "proto=https;host=evil.example", "x-forwarded-proto": "https", "x-forwarded-host": "evil.example",
            ...(body === undefined ? {} : { origin: publicOrigin, "content-type": "application/json" }), ...headers },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        })
        const begin = await request("/sucafina/auth/login?returnTo=%2Fsucafina%2Fdashboard")
        expect(begin.status).toBe(303)
        const location = begin.headers.get("location")!
        const authorization = new URL(location)
        expect(authorization.searchParams.get("redirect_uri")).toBe(`${publicOrigin}/sucafina/auth/callback`)
        const loginCookie = begin.headers.getSetCookie()[0].split(";")[0]
        const code = await provider.issueCode(location)
        const completed = await request(`/sucafina/auth/callback?state=${authorization.searchParams.get("state")}&code=${code}`, { cookie: loginCookie })
        expect(completed.status).toBe(303)
        expect(completed.headers.get("location")).toBe("/sucafina/dashboard")
        const session = completed.headers.getSetCookie().find((cookie) => cookie.includes("_session="))!
        expect(session).toStartWith("__Secure-")
        expect(session).toContain("HttpOnly")
        expect(session).toContain("Secure")
        expect(session).toContain("SameSite=Lax")
        // The signed member receives only its configured viewer role. Exercise
        // the live producer command to prove that login cannot grant write access.
        const authenticated = await request("/sucafina/dashboard", { cookie: session.split(";")[0] }, {
          page: "IT Risks", action: "save", version: 0,
          values: { name: "Denied viewer risk", impact: 3, probability: 2 },
        })
        expect(authenticated.status).toBe(403)
        await authenticated.arrayBuffer()
        expect((await request("/sucafina/dashboard", { cookie: session.split(";")[0] })).status).toBe(404)
        expect((await request("/sucafina/status", { host: "evil.example", "x-forwarded-host": new URL(ingressOrigin).host })).status).toBe(403)
        for (const pathname of ["/outside", "/sucafina-other"]) expect((await request(pathname)).status).toBe(404)
        expect(spans).toHaveLength(0)
      })
    })).pipe(Effect.provide(NodeHttpServer.layer(() => server, { host: "127.0.0.1", port: 0 }))))
  } finally {
    server.closeAllConnections?.()
    await f.close()
  }
})
