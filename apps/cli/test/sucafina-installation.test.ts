import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { Context, Layer } from "effect"
import { createRoutes } from "@orchestra/server/routes"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { loadSfInstallation } from "../src/sucafina-product/installation.ts"

const origin = "http://127.0.0.1:4096"
const fixture = fileURLToPath(new URL("./fixture/sucafina-installation.ts", import.meta.url))

test("Sucafina registers its base and subtree once for every method", async () => {
  const installation = await loadSfInstallation(fixture, origin)
  const router = HttpRouter.toWebHandler(installation.layer.pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  try {
    for (const method of ["GET", "HEAD", "POST", "ACL"]) {
      for (const pathname of ["/sucafina", "/sucafina/", "/sucafina/planner", "/sucafina/procurement"]) {
        const response = await router.handler(new Request(origin + pathname, { method, headers: { host: new URL(origin).host } }))
        expect(response.status).toBe(200)
        if (method !== "HEAD") expect(await response.text()).toBe(method + " " + pathname)
      }
    }
  } finally { await router.dispose(); await installation.dispose() }
})

test("Sucafina mount retains the host fence and leaves neighboring paths unclaimed", async () => {
  const installation = await loadSfInstallation(fixture, origin)
  const router = HttpRouter.toWebHandler(installation.layer.pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  try {
    const denied = await router.handler(new Request(origin + "/sucafina/planner", { headers: { host: "different.example" } }))
    expect(denied.status).toBe(403)
    for (const pathname of ["/sucafina-other", "/outside"]) {
      const response = await router.handler(new Request(origin + pathname, { headers: { host: new URL(origin).host } }))
      expect(response.status).toBe(404)
    }
  } finally { await router.dispose(); await installation.dispose() }
  // Independent authorization boundary proof (the product handler never sees daemon credentials).
  {
  const installation = await loadSfInstallation(fixture, origin)
  const router = HttpRouter.toWebHandler(
    Layer.merge(
      createRoutes({ password: "synthetic-daemon-password", allowedHosts: ["127.0.0.1"] }),
      installation.layer,
    ).pipe(Layer.provide(HttpServer.layerServices)),
    { disableLogger: true },
  )
  const dispatch = (pathname: string) => router.handler(
    new Request(origin + pathname, { headers: { host: new URL(origin).host } }),
    Context.makeUnsafe<unknown>(new Map()),
  )
  try {
    for (const pathname of [
      "/sucafina/status",
      "/sucafina/auth/login",
      "/sucafina/dashboard",
      "/sucafina/planner",
      "/sucafina/procurement",
    ]) {
      const response = await dispatch(pathname)
      // Synthetic producer is deliberately identity-free; any 401 here comes from the server boundary.
      expect(response.status).toBe(200)
      expect(await response.text()).toBe("GET " + pathname)
    }
    const privateApi = await dispatch("/api/sucafina/installations?select=ids&installationId=x&projectId=y")
    expect(privateApi.status).toBe(401)
    expect(privateApi.headers.get("www-authenticate")).toBe('Basic realm="Secure Area"')
    const outside = await dispatch("/sucafina-extra/dashboard")
    expect(outside.status).toBe(404)
  } finally {
    await router.dispose()
    await installation.dispose()
  }
  }

})
