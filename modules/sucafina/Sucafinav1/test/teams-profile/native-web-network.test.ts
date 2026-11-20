import { expect, test } from "bun:test"
import { request } from "node:http"
import { connect as secureConnect } from "node:tls"
import type { Duplex } from "node:stream"
import { serveNativeTeamsWeb } from "./native-web-network.ts"
import { publicOrigin } from "../microsoft-login/private-fixture.ts"

const tunnel = (proxy: string, target: string) => new Promise<{ status: number; socket: Duplex }>((resolve, reject) => {
  const address = new URL(proxy)
  const call = request({ host: address.hostname, port: address.port, method: "CONNECT", path: target, agent: false })
  const timer = setTimeout(() => { call.destroy(); reject(new Error("Fixture CONNECT deadline expired")) }, 3000)
  call.once("error", (error) => { clearTimeout(timer); reject(error) })
  call.once("connect", (response, socket) => { clearTimeout(timer); resolve({ status: response.statusCode ?? 0, socket }) })
  call.end()
})

test("native Web TLS proxy admits only exact fixture hosts and streams the original request", async () => {
  let incoming: Request | undefined, controller: ReadableStreamDefaultController<Uint8Array> | undefined
  const text = new TextEncoder()
  const f = await serveNativeTeamsWeb({
    origin: publicOrigin,
    authorize: async () => new Response(null, { status: 303 }),
    handle: async (request) => {
      incoming = request
      return new Response(new ReadableStream<Uint8Array>({
        start(value) { controller = value; value.enqueue(text.encode("data: first\n\n")) },
      }), { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-store" } })
    },
  })
  try {
    for (const target of ["evil.example.test:443", "mvp.example.test:80", "mvp.example.test.:443", "mvp.example.test:443@evil.test"]) {
      const denied = await tunnel(f.proxy, target)
      expect(denied.status).toBe(403); denied.socket.destroy()
    }
    expect(incoming).toBeUndefined()
    const allowed = await tunnel(f.proxy, "mvp.example.test:443")
    expect(allowed.status).toBe(200)
    const socket = secureConnect({ socket: allowed.socket, servername: "mvp.example.test", rejectUnauthorized: false })
    let received = ""
    const first = Promise.withResolvers<void>(), ended = Promise.withResolvers<void>()
    const timer = setTimeout(() => {
      socket.destroy()
      first.reject(new Error("Fixture first TLS frame deadline expired"))
      ended.reject(new Error("Fixture TLS stream deadline expired"))
    }, 3000)
    // Both observers are installed before the request and their rejection is owned.
    void first.promise.catch(() => {}); void ended.promise.catch(() => {})
    socket.on("error", (error) => { first.reject(error); ended.reject(error) })
    socket.on("data", (chunk: Buffer) => {
      received += chunk.toString("utf8")
      if (received.includes("data: first\n\n")) first.resolve()
    })
    socket.once("end", () => ended.resolve())
    socket.write("GET /stream?exact=1 HTTP/1.1\r\nHost: mvp.example.test\r\nOrigin: " + publicOrigin +
      "\r\nCookie: synthetic_fixture=value\r\nConnection: close\r\n\r\n")
    try {
      await first.promise
      expect(incoming?.url).toBe(publicOrigin + "/stream?exact=1")
      expect(incoming?.headers.get("origin")).toBe(publicOrigin)
      expect(incoming?.headers.get("cookie")).toBe("synthetic_fixture=value")
      expect(received).toContain("200 OK")
      expect(received).not.toContain("data: second")
      controller!.enqueue(text.encode("data: second\n\n")); controller!.close()
      await ended.promise
      expect(received).toContain("data: second\n\n")
      expect(f.calls.filter((call) => call.allowed)).toEqual([{ authority: "mvp.example.test:443", allowed: true }])
    } finally { clearTimeout(timer); socket.destroy() }
  } finally { await f.close() }
}, 10000)
