import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { Layer } from "effect"
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
})
