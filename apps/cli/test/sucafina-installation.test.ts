import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { createRoutes } from "@orchestra/server/routes"
import { Context, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { loadSfInstallation } from "../src/sucafina-product/installation"

const origin = "http://localhost:4110"
const host = "localhost:4110"
const fixture = fileURLToPath(new URL("./fixture/sucafina-installation.ts", import.meta.url))

test("installs the factory on the base and subtree and keeps daemon Basic authentication", async () => {
  const installation = await loadSfInstallation(fixture, "localhost", 4110)
  const router = HttpRouter.toWebHandler(
    Layer.merge(createRoutes({ password: "synthetic-daemon-password", allowedHosts: ["localhost"] }), installation.layer)
      .pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true },
  )
  const dispatch = (path: string, init: RequestInit = { headers: { host } }, requestOrigin = origin) =>
    router.handler(new Request(requestOrigin + path, init), Context.makeUnsafe<unknown>(new Map()))
  try {
    const base = await dispatch("/sucafina")
    expect(base.status).toBe(200)
    expect(await base.json()).toMatchObject({ origin, path: "/sucafina", method: "GET" })
    const nested = await dispatch("/sucafina/planner?year=2026", {
      method: "POST",
      headers: { host, cookie: "installation=fixture" },
      body: "original body",
    })
    expect(nested.status).toBe(200)
    expect(await nested.json()).toEqual({
      origin, path: "/sucafina/planner?year=2026", method: "POST", cookie: "installation=fixture", body: "original body",
    })
    expect((await dispatch("/sucafina/", { method: "HEAD", headers: { host } })).status).toBe(200)
    expect((await dispatch("/sucafina-extra")).status).toBe(404)
    expect((await dispatch("/sucafina/missing")).status).toBe(404)
    expect((await dispatch("/sucafina/unavailable")).status).toBe(503)
    expect((await dispatch("/sucafina", { headers: { host: "localhost:4111" } })).status).toBe(403)
    expect((await dispatch("/sucafina", { headers: { host } }, "https://localhost:4110")).status).toBe(403)
    const api = await dispatch("/api/session")
    expect(api.status).toBe(401)
    expect(api.headers.get("www-authenticate")).toBe('Basic realm="Secure Area"')
  } finally {
    await router.dispose()
    await installation.dispose()
  }
})

test("rejects a relative path and missing or ephemeral ports before loading the factory", async () => {
  expect(await loadSfInstallation("relative.ts", "localhost", 4110).catch((error: Error) => error.message))
    .toContain("absolute")
  for (const port of [undefined, 0, 65_536]) {
    expect(await loadSfInstallation(fixture, "localhost", port).catch((error: Error) => error.message))
      .toContain("explicit port")
  }
})
