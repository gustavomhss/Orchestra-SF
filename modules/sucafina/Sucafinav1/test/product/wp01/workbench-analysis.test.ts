import { expect, test } from "bun:test"
import path from "node:path"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { randomBytes, randomUUID } from "node:crypto"
import { createEmbeddedRoutes } from "@orchestra/server/routes"
import { Context, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { ProductHost } from "../../../../../../apps/cli/src/host.ts"
import { createSfHostRuntime } from "../../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"

test("Workbench analysis HTTP enforces human authority and hides forged run references", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-analysis-http-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(path.join(directory, "business"))
  const installationId = randomUUID()
  const operator = { installationId, uid: 1000, name: "Test operator" }
  const principalRef = `macos:${installationId}:${operator.uid}`
  let workbench: ReturnType<typeof createSfWorkbenchHttp> | undefined
  let identity: ReturnType<typeof createOperatorIdentity> | undefined
  let web: ReturnType<typeof HttpRouter.toWebHandler> | undefined
  const server = Bun.serve({ hostname: "localhost", port: 0, fetch: async (request) => {
    const localAuth = await identity?.handle(request)
    if (localAuth) return localAuth
    if (new URL(request.url).pathname.startsWith("/api/")) return web?.handler(request, Context.makeUnsafe<unknown>(new Map())) ?? new Response(null, { status: 503 })
    return await workbench?.(request, "dashboard") ?? new Response(null, { status: 404 })
  } })
  const origin = server.url.origin
  identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => new Date().toISOString()) })
  let runtime: Awaited<ReturnType<typeof createSfHostRuntime>> | undefined
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    runtime = await createSfHostRuntime({ installationId, directory, sourceRoot: path.resolve(import.meta.dir, "../../../product/ai"), origin,
      mount: "/sucafina", persistence, authenticate: identity.authenticate,
      grants: [{ principalRef, namespaces: ["cases", "contributions"], operations: [], humanActions: ["analysis.start", "analysis.read", "analysis.cancel"] }],
      environment: async () => ({ at: new Date().toISOString(), id: randomUUID, directory: [] }) })
    workbench = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => runtime?.services?.() })
    web = HttpRouter.toWebHandler(createEmbeddedRoutes({ host: [...ProductHost.contributions(), ...runtime.contributions] })
      .pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true, memoMap: Layer.makeMemoMapUnsafe() })

    const ready = new URL("/api/agent", origin)
    ready.searchParams.set("location[directory]", directory)
    expect((await fetch(ready)).status).toBe(200)
    const enrollment = await identity.enroll()
    const authenticated = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${enrollment}`))
    const cookie = authenticated?.headers.get("set-cookie")?.split(";")[0]
    expect(cookie).toBeTruthy()
    const post = (body: unknown, extraHeaders: Record<string, string> = {}) => fetch(`${origin}/sucafina/dashboard?sf=workbench-analysis`, {
      method: "POST", headers: { cookie: cookie ?? "", origin, "sec-fetch-site": "same-origin", "content-type": "application/json",
        "idempotency-key": randomUUID(), ...extraHeaders }, body: JSON.stringify(body),
    })

    const services = runtime.services?.()
    if (!services) throw new Error("host services unavailable after host startup")
    const model = (await services.models().catch(() => []))[0]
    const selection = services.selected.find((item) => item.skills.some((skill) => skill.id === "sf-explicar-forecast"))
    const skill = selection?.skills.find((item) => item.id === "sf-explicar-forecast")
    if (model && selection && skill) {
      const start = await post({ action: "start", input: {
        request: { caseRef: { id: "missing-case", incarnation: "missing-incarnation", version: 1 }, profileId: selection.profile.id,
          profileVersion: selection.profile.version, skillId: skill.id, skillVersion: skill.version, manifestDigest: selection.manifestDigest,
          outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: skill.allowedOperations, objective: "Review forecast" },
        skillInput: {}, model,
      } })
      expect(start.status).toBe(400)
    }

    const unauthenticated = await fetch(`${origin}/sucafina/dashboard?sf=workbench-analysis`, { method: "POST",
      headers: { origin, "sec-fetch-site": "same-origin", "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify({ action: "read", runRef: "sf-run-forged-reference" }) })
    expect(unauthenticated.status).toBe(403)
    expect((await post({ action: "read", runRef: "sf-run-forged-reference" })).status).toBe(403)
    expect((await post({ action: "output", runRef: "sf-run-forged-reference" })).status).toBe(403)
    const forgedList = await post({ action: "list", caseRef: { id: "missing", incarnation: "missing", version: 1 } })
    expect(forgedList.status).toBe(403)
    expect(await forgedList.text()).not.toContain("nativeSessionId")
    const cancel = await post({ action: "cancel", runRef: "sf-run-forged-reference" })
    expect(cancel.status).toBe(503)
    expect(await cancel.text()).not.toContain("nativeSessionId")

    const crossOrigin = await post({ action: "read", runRef: "sf-run-forged-reference" }, { origin: "https://other.example" })
    expect(crossOrigin.status).toBe(403)
    const crossSite = await post({ action: "read", runRef: "sf-run-forged-reference" }, { "sec-fetch-site": "cross-site" })
    expect(crossSite.status).toBe(403)
    const missingIdempotency = await post({ action: "read", runRef: "sf-run-forged-reference" }, { "idempotency-key": "" })
    expect(missingIdempotency.status).toBe(400)
  } finally {
    await web?.dispose()
    await server.stop(true)
    await driver.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 60_000)

test("Workbench analysis returns unavailable when its host services are absent", async () => {
  const request = new Request("http://localhost/sucafina/dashboard?sf=workbench-analysis", { method: "POST",
    headers: { origin: "http://localhost", "sec-fetch-site": "same-origin", "content-type": "application/json", "idempotency-key": "workbench-absent-1" },
    body: JSON.stringify({ action: "read", runRef: "sf-run-any" }) })
  const handler = createSfWorkbenchHttp({ origin: "http://localhost", mount: "/sucafina", runtime: () => undefined })
  expect((await handler(request, "dashboard"))?.status).toBe(503)
})
