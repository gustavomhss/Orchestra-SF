import { beforeAll, expect, spyOn, test } from "bun:test"
import { createServer } from "node:http"
import { writeFile } from "node:fs/promises"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { Effect, Layer, Tracer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { BodyLimit } from "../../../../../../packages/server/src/body-limit.ts"
import { composeSfInstallation } from "../../../../../../apps/cli/src/sucafina-product/installation.ts"
import { createMicrosoftInstallation } from "../../../local/entry.ts"
import { microsoftFixture } from "../../microsoft-login/oidc-fixture.ts"
import { ingressOrigin, privateFixture, publicOrigin } from "../../microsoft-login/private-fixture.ts"

type NodeServer = { layer: (evaluate: () => ReturnType<typeof createServer>, options: { host: string; port: number }) => Layer.Layer<HttpServer.HttpServer, unknown> }
let NodeHttpServer: NodeServer
beforeAll(async () => {
  const cli = createRequire(path.resolve(import.meta.dir, "../../../../../../apps/cli/package.json"))
  const platform = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href) as { NodeHttpServer: NodeServer }
  NodeHttpServer = platform.NodeHttpServer
})

test("The bounded Node/Effect bridge preserves Microsoft proxy, login cookies, CSRF, logout and callback privacy", async () => {
  // The real identity validates PKCE/JWKS/JWT and stores encrypted sessions; the OIDC/Graph peer alone is synthetic.
  // This component test is not evidence for Azure deployment, a provisioned B2B guest or native host qualification.
  const f = await privateFixture()
  const provider = await microsoftFixture()
  const server = createServer()
  const requests: Request[] = []
  const spans: Tracer.NativeSpan[] = []
  const tracer = Tracer.make({ span(options) { const span = new Tracer.NativeSpan(options); spans.push(span); return span } })
  const logs: unknown[][] = []
  const spies = [spyOn(console, "log"), spyOn(console, "warn"), spyOn(console, "error")]
  for (const spy of spies) spy.mockImplementation((...values: unknown[]) => { logs.push(values) })
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const http = yield* HttpServer.HttpServer
      if (http.address._tag !== "TcpAddress") throw new Error("Expected ephemeral TCP listener")
      const listener = `http://127.0.0.1:${http.address.port}`
      yield* Effect.promise(() => writeFile(f.file, JSON.stringify({ ...f.config, listenerOrigin: listener })))
      const application = yield* Effect.acquireRelease(
        Effect.promise(() => createMicrosoftInstallation({ origin: listener }, f.file, f.environment, { fetch: provider.fetch, now: () => new Date(provider.clock.value) })),
        (application) => Effect.promise(async () => { await application.dispose() }),
      )
      const installation = yield* Effect.promise(() => composeSfInstallation({ ...application, handler: (request: Request) => {
        requests.push(request)
        return application.handler(request)
      } }, listener))
      yield* Layer.build(HttpRouter.serve(Layer.mergeAll(BodyLimit.layer, installation.layer), { disableLogger: true, disableListenLog: true }).pipe(
        Layer.provide(installation.privacy), Layer.provide(Layer.succeed(Tracer.Tracer)(tracer)),
      ))
      yield* Effect.addFinalizer(() => Effect.sync(() => server.closeAllConnections?.()))
      yield* Effect.promise(async () => {
        const request = (pathname: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) => fetch(`${listener}${pathname}`, {
          redirect: "manual", method: options.method, body: options.body,
          headers: { host: new URL(ingressOrigin).host, connection: "close", forwarded: "proto=https;host=forged.example", "x-forwarded-proto": "https", "x-forwarded-host": "forged.example", ...options.headers },
        })
        const begin = await request("/sucafina/auth/login?returnTo=%2Fsucafina%2Fdashboard")
        expect(begin.status).toBe(303)
        expect(begin.headers.get("cache-control")).toBe("no-store")
        const location = begin.headers.get("location")!
        const authorization = new URL(location)
        expect(authorization.searchParams.get("redirect_uri")).toBe(`${publicOrigin}/sucafina/auth/callback`)
        const login = begin.headers.getSetCookie()[0]!
        expect(login).toMatch(/(?:^|;\s*)Secure(?:;|$)/)
        expect(login).toContain("HttpOnly")
        expect(login).toContain("SameSite=Lax")
        const code = await provider.issueCode(location)
        const completed = await request(`/sucafina/auth/callback?state=${authorization.searchParams.get("state")}&code=${code}`, { headers: { cookie: login.split(";")[0]! } })
        expect(completed.status).toBe(303)
        expect(completed.headers.get("cache-control")).toBe("no-store")
        expect(completed.headers.get("location")).toBe("/sucafina/dashboard")
        const session = completed.headers.getSetCookie().find((cookie) => cookie.includes("_session="))!
        expect(session).toStartWith("__Secure-")
        expect(session).toMatch(/(?:^|;\s*)Secure(?:;|$)/)
        expect(session).toContain("HttpOnly")
        expect(session).toContain("SameSite=Lax")
        const cookie = session.split(";")[0]!
        for (const surface of ["dashboard", "planner", "procurement"]) {
          const legacy = await request("/sucafina/" + surface, { headers: { cookie } })
          expect(legacy.status).toBe(404)
          expect(await legacy.text()).toBe("legacy console decommissioned — use /")
        }
        // This fixture grants Dashboard viewer and Procurement requester, but no Planner role.
        const authorizedDownload = "/sucafina/planner?download=xlsx"
        const authenticated = await request(authorizedDownload, { headers: { cookie } })
        expect(authenticated.status).toBe(401) // The authenticated guest has no configured Planner role.
        await authenticated.arrayBuffer()

        const rejectedLogout = await request("/sucafina/auth/logout", { method: "POST", headers: { cookie, origin: "https://forged.example" } })
        expect(rejectedLogout.status).toBe(403)
        await rejectedLogout.arrayBuffer()
        const stillAuthenticated = await request(authorizedDownload, { headers: { cookie } })
        expect(stillAuthenticated.status).toBe(401)
        await stillAuthenticated.arrayBuffer()

        const marker = "synthetic-private-url-token-74"
        const excessive = await request(`/sucafina/dashboard?sf=workbench-command&code=${marker}`, {
          method: "POST", headers: { cookie, origin: publicOrigin, "content-type": "application/json", "content-length": "65537" }, body: "x".repeat(65537),
        })
        expect(excessive.status).toBe(413)
        expect(excessive.headers.get("cache-control")).toBe("no-store")
        expect(excessive.headers.get("x-content-type-options")).toBe("nosniff")
        const rejection = await excessive.text()
        expect(rejection).toBe('{"status":"invalid"}')
        expect(rejection).not.toContain(provider.account.name)
        expect(rejection).not.toContain(marker)

        const wrongHost = await request("/sucafina/status", { headers: { host: "forged.example", "x-forwarded-host": new URL(ingressOrigin).host } })
        expect(wrongHost.status).toBe(403)
        await wrongHost.arrayBuffer()
        expect(requests.length).toBeGreaterThan(0)
        for (const admitted of requests) {
          expect(new URL(admitted.url).origin).toBe(publicOrigin)
          expect(admitted.headers.get("host")).toBe(new URL(publicOrigin).host)
          expect(admitted.headers.has("forwarded")).toBe(false)
          expect([...admitted.headers.keys()].some((name) => name.startsWith("x-forwarded-"))).toBe(false)
        }
        const logout = await request("/sucafina/auth/logout", { method: "POST", headers: { cookie, origin: publicOrigin } })
        expect(logout.status).toBe(204)
        expect(logout.headers.get("cache-control")).toBe("no-store")
        const cleared = logout.headers.getSetCookie()
        expect(cleared).toHaveLength(2)
        expect(cleared.every((value) => value.includes("Max-Age=0") && /(?:^|;\s*)Secure(?:;|$)/.test(value) && value.includes("HttpOnly"))).toBe(true)
        const signedOut = await request(authorizedDownload, { headers: { cookie } })
        expect(signedOut.status).toBe(303)
        expect(signedOut.headers.get("location")).toStartWith("/sucafina/auth/login")
        expect(spans).toHaveLength(0)
        const output = logs.map((values) => values.map(String).join(" ")).join("\n")
        for (const secret of [marker, code, authorization.searchParams.get("state")!, cookie, provider.account.name, "synthetic-access-", "synthetic-refresh-"]) expect(output).not.toContain(secret)
      })
    })).pipe(Effect.provide(NodeHttpServer.layer(() => server, { host: "127.0.0.1", port: 0 }))), { signal: AbortSignal.timeout(25000) })
  } finally {
    for (const spy of spies) spy.mockRestore()
    server.closeAllConnections?.()
    await f.close()
  }
}, 30000)
