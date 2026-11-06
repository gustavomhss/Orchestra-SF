import "./httpapi-exercise/environment"
import { expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createRoutes } from "@orchestra/server/routes"
import { Context, Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"

const scratch = mkdtempSync(path.join(os.tmpdir(), "orchestra-host-policy-"))
const webRoot = path.join(scratch, "index.html")
writeFileSync(webRoot, "host-policy-static-marker")
const password = "host-policy-synthetic-secret"
const valid = `Basic ${Buffer.from(`orchestra:${password}`).toString("base64")}`
const wrong = `Basic ${Buffer.from("orchestra:wrong").toString("base64")}`
const allowedHosts = ["localhost", "127.0.0.1", "[::1]", "192.168.1.42", "studio.local", "proxy.example"]

function app(options: { password?: string; webRoot?: string; cors?: readonly string[]; allowedHosts?: readonly string[] }) {
  return HttpRouter.toWebHandler(createRoutes(options).pipe(Layer.provide(HttpServer.layerServices)), {
    disableLogger: true,
    memoMap: Layer.makeMemoMapUnsafe(),
  })
}

function request(host: string | undefined, pathname = "/api/skill", init: RequestInit = {}) {
  const url = new URL(pathname, "http://localhost")
  url.searchParams.set("location[directory]", scratch)
  const headers = new Headers(init.headers)
  if (host !== undefined) headers.set("host", host)
  return new Request(url, { ...init, headers })
}

function send(web: ReturnType<typeof app>, req: Request) {
  return web.handler(req, Context.makeUnsafe<unknown>(new Map()))
}

test("unknown actual Host cannot be rescued by matching Origin, valid credentials or forwarded headers", async () => {
  const web = app({ password, allowedHosts, cors: ["http://attacker.example"] })
  try {
    const response = await send(web, request("attacker.example", "/api/skill", { headers: {
      authorization: valid,
      origin: "http://attacker.example",
      forwarded: "host=localhost;proto=http",
      "x-forwarded-host": "localhost",
    } }))
    expect(response.status).toBe(421)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
    expect(response.headers.get("www-authenticate")).toBeNull()
    expect(await response.text()).not.toContain("attacker.example")
  } finally {
    await web.dispose()
  }
})

test("canonical configured loopback, LAN, mDNS and proxy hosts retain authentication", async () => {
  const web = app({ password, allowedHosts })
  try {
    for (const host of ["LOCALHOST.:4096", "127.0.0.1:80", "[::1]:4096", "192.168.1.42:8080", "STUDIO.LOCAL.", "PROXY.EXAMPLE.:443"]) {
      expect((await send(web, request(host))).status).toBe(401)
    }
  } finally {
    await web.dispose()
  }
})

test("allowed Host still requires valid Basic credentials on the skill catalog", async () => {
  const web = app({ password, allowedHosts })
  try {
    expect((await send(web, request("localhost", "/api/skill", { headers: { authorization: valid } }))).status).toBe(200)
    expect((await send(web, request("localhost", "/api/skill", { headers: { authorization: wrong } }))).status).toBe(401)
  } finally {
    await web.dispose()
  }
})

test("unknown Host is refused before CORS preflight", async () => {
  const web = app({ password, allowedHosts })
  try {
    const response = await send(web, request("attacker.example", "/api/skill", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:4096", "access-control-request-method": "GET", "access-control-request-headers": "authorization" },
    }))
    expect(response.status).toBe(421)
    expect(response.headers.get("access-control-allow-origin")).toBeNull()
  } finally {
    await web.dispose()
  }
})

test("public web UI is subject to the same host policy", async () => {
  const web = app({ password, allowedHosts, webRoot: scratch })
  try {
    const allowed = await send(web, request("localhost", "/"))
    expect(allowed.status).toBe(200)
    expect(await allowed.text()).toContain("host-policy-static-marker")
    expect((await send(web, request("attacker.example", "/"))).status).toBe(421)
  } finally {
    await web.dispose()
  }
})

test("missing and malformed Host authorities are refused", async () => {
  const web = app({ password, allowedHosts })
  try {
    for (const host of [undefined, "", "localhost:bad", "localhost:65536", "localhost,evil.example", "user@localhost", "localhost/path", "*.localhost"]) {
      expect((await send(web, request(host, "/api/skill", { headers: { authorization: valid } }))).status).toBe(421)
    }
  } finally {
    await web.dispose()
  }
})

test("an explicitly empty allowlist denies even localhost", async () => {
  const web = app({ password, allowedHosts: [] })
  try {
    expect((await send(web, request("localhost", "/api/skill", { headers: { authorization: valid } }))).status).toBe(421)
  } finally {
    await web.dispose()
  }
})

test("invalid configuration fails visibly; omitted policy preserves embedding behavior", async () => {
  const web = app({ password })
  try {
    expect((await send(web, request("custom.example"))).status).toBe(401)
    expect((await send(web, request("custom.example", "/api/skill", { headers: { authorization: valid } }))).status).toBe(200)
  } finally {
    await web.dispose()
  }
  for (const host of ["*.example", "user@localhost", "localhost/path", "localhost:bad", "localhost,evil.example"]) {
    const options = { password, allowedHosts: [host] }
    expect(() => createRoutes(options)).toThrow()
  }
})
