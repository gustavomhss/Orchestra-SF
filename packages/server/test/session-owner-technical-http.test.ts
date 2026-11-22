import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import path from "node:path"
import { Layer, Schema } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { Database } from "@orchestra/core/database/database"
import { Global } from "@orchestra/core/global"
import { sessionOwnerFixture } from "../../core/test/fixture/session-owner"
import { tmpdir } from "../../core/test/fixture/tmpdir"
import { ServerAuth } from "../src/auth"
import { createRoutes } from "../src/routes"
import { List } from "./fixture/session-http"

async function server(directory: string, filename: string) {
  const web = HttpRouter.toWebHandler(createRoutes({
    password: "technical-http-component",
    host: [{
      id: "technical-http-component",
      replacements: [
        [Database.node, Database.layerFromPath(filename)],
        [Global.node, Global.layerWith({ home: directory, data: directory, config: directory, cache: directory, state: directory })],
      ],
    }],
  }).pipe(Layer.provide(HttpServer.layerServices)), { disableLogger: true })
  const listener = Bun.serve({ hostname: "127.0.0.1", port: 0, fetch: (request) => web.handler(request) })
  const headers = ServerAuth.headers({ username: "orchestra", password: "technical-http-component" })
  return {
    request: (pathname: string, init: RequestInit = {}) => fetch(new URL(pathname, listener.url), { headers, ...init }),
    async [Symbol.asyncDispose]() {
      await listener.stop(true)
      await web.dispose()
    },
  }
}

test("the real technical host retains Basic, unwrapped Session collections and SSE without creating a corporate control file", async () => {
  await using temporary = await tmpdir()
  const filename = path.join(temporary.path, "technical.sqlite")
  await using http = await server(temporary.path, filename)
  const refused = await http.request("/api/session", { headers: {} })
  expect(refused.status).toBe(401)
  await refused.arrayBuffer()
  const response = await http.request("/api/session")
  expect(response.status).toBe(200)
  const value: unknown = await response.json()
  const list = Schema.decodeUnknownSync(Schema.toCodecJson(List))(value)
  expect(list.data).toEqual([])
  expect(value).not.toHaveProperty("namespace")
  const cursor = await http.request("/api/session?cursor=sf1.invalid")
  expect(cursor.status).toBe(400)
  await cursor.arrayBuffer()
  const events = await http.request("/api/event")
  expect(events.status).toBe(200)
  expect(events.headers.get("content-type")).toContain("text/event-stream")
  if (!events.body) throw new Error("Real technical SSE body required")
  const reader = events.body.getReader()
  try {
    const decoder = new TextDecoder()
    let text = ""
    while (!text.includes("\n\n")) {
      const chunk = await reader.read()
      if (chunk.done) throw new Error("Technical SSE closed before its connected frame")
      text += decoder.decode(chunk.value, { stream: true })
    }
    expect(text).toContain("server.connected")
    expect(text).not.toContain('"namespace"')
  } finally { await reader.cancel() }
  expect(existsSync(filename)).toBe(true)
  expect(existsSync(filename + ".authority.sqlite")).toBe(false)
})

test.skipIf(process.platform === "win32")("the compiled generic host refuses a marked corporate database even with valid Basic", async () => {
  await using owned = await sessionOwnerFixture()
  await using http = await server(owned.directory, owned.filename)
  for (const [method, pathname] of [
    ["GET", "/api/session"], ["POST", "/api/session"], ["GET", "/api/event"], ["GET", "/api/reference"],
    ["GET", "/api/config"], ["PATCH", "/api/config"], ["GET", "/api/provider"], ["GET", "/api/trust"],
  ]) {
    const response = await http.request(pathname, { method,
      ...(method === "GET" ? {} : { headers: { ...ServerAuth.headers({ username: "orchestra", password: "technical-http-component" }),
        "content-type": "application/json" }, body: "{invalid" }),
    })
    expect(response.status).toBe(401)
    await response.arrayBuffer()
  }
  const health = await http.request("/api/health")
  expect(health.status).toBe(200)
  await health.arrayBuffer()
  expect(owned.business.all("SELECT id FROM session")).toEqual([])
  expect(owned.control.pendingWriters(owned.storage)).toEqual([])
})
