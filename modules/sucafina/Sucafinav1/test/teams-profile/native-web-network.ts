import { createServer, connect } from "node:net"
import type { Duplex } from "node:stream"
import path from "node:path"
import { authority } from "../microsoft-login/oidc-fixture.ts"

/**
 * A real TLS listener behind a closed CONNECT proxy. Public browser URLs, cookies,
 * redirects and streaming bodies are unchanged. Both permitted hosts are synthetic:
 * the installed application and this fixture's signed OIDC authorization endpoint.
 * No destination is resolved or contacted outside loopback.
 */
export async function serveNativeTeamsWeb(input: Readonly<{
  origin: string
  handle(request: Request): Promise<Response>
  authorize(url: string): Promise<Response>
}>) {
  const publicHost = new URL(input.origin).host + ":443"
  const providerOrigin = new URL(authority).origin, providerHost = new URL(providerOrigin).host + ":443"
  if (new URL(input.origin).protocol !== "https:" || new URL(input.origin).port ||
      input.origin !== new URL(input.origin).origin) throw new Error("Fixed public HTTPS origin required")
  const cert = Bun.file(path.resolve(import.meta.dir, "../../../../../packages/core/test/fixture/pinned-example-cert.pem"))
  const key = Bun.file(path.resolve(import.meta.dir, "../../../../../packages/core/test/fixture/pinned-example-key.pem"))
  let disposed = false
  const calls: { authority: string; allowed: boolean }[] = []
  const peers = new Map<Duplex, Promise<void>>()
  const secure = Bun.serve({
    hostname: "127.0.0.1", port: 0, tls: { cert, key },
    // SSE owns its lifetime and sends bounded server heartbeats.
    idleTimeout: 0,
    fetch: async (request) => {
      if (disposed) return new Response(null, { status: 503 })
      const url = new URL(request.url)
      if (url.origin === input.origin) return input.handle(request)
      if (url.origin === providerOrigin && url.pathname === new URL(authority).pathname + "/oauth2/v2.0/authorize" &&
          request.method === "GET") return input.authorize(request.url)
      return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } })
    },
  })
  const securePort = secure.port
  if (typeof securePort !== "number") { await secure.stop(true); throw new Error("TLS listener did not bind") }
  const remember = (socket: Duplex) => {
    peers.set(socket, new Promise<void>((resolve) => socket.once("close", () => { peers.delete(socket); resolve() })))
    // Cancelled browser connections can close either half first. Their peer is
    // destroyed below; cleanup never logs a private payload.
    socket.on("error", () => socket.destroy())
    return socket
  }
  const proxy = createServer((socket) => {
    remember(socket)
    let received = Buffer.alloc(0)
    const timer = setTimeout(() => socket.destroy(), 3000)
    socket.once("close", () => clearTimeout(timer))
    const deny = () => {
      clearTimeout(timer); socket.off("data", parse)
      socket.end("HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n")
    }
    const parse = (chunk: Buffer) => {
      received = Buffer.concat([received, chunk])
      if (received.length > 4096 || received.includes(0)) { deny(); return }
      const end = received.indexOf("\r\n\r\n")
      if (end < 0) return
      const lines = received.subarray(0, end).toString("latin1").split("\r\n")
      const match = /^CONNECT ([A-Za-z0-9.:-]+) HTTP\/1\.[01]$/.exec(lines[0] ?? "")
      const target = match?.[1] ?? ""
      const hosts = lines.slice(1).filter((line) => /^host:/i.test(line)).map((line) => line.slice(5).trim())
      const allowed = !disposed && (target === publicHost || target === providerHost) &&
        hosts.length === 1 && hosts[0] === target && end + 4 === received.length
      calls.push({ authority: target, allowed })
      if (!allowed) { deny(); return }
      clearTimeout(timer); socket.off("data", parse); socket.pause()
      const upstream = remember(connect({ host: "127.0.0.1", port: securePort }))
      const close = () => { socket.destroy(); upstream.destroy() }
      socket.once("close", close); upstream.once("close", close)
      upstream.once("connect", () => {
        if (disposed || socket.destroyed) { close(); return }
        socket.write("HTTP/1.1 200 Connection Established\r\n\r\n")
        socket.pipe(upstream); upstream.pipe(socket)
      })
    }
    socket.on("data", parse)
  })
  try {
    await new Promise<void>((resolve, reject) => {
      const failure = (error: Error) => reject(error)
      proxy.once("error", failure)
      proxy.listen(0, "127.0.0.1", () => { proxy.off("error", failure); resolve() })
    })
    const address = proxy.address()
    if (!address || typeof address === "string") throw new Error("Loopback proxy did not bind")
    return Object.freeze({
      proxy: "http://127.0.0.1:" + address.port,
      calls,
      async close() {
        if (disposed) return
        disposed = true
        // A stream can set .closed before emitting close. Await the event
        // registered at acquisition, never infer cleanup from that early flag.
        const closed = [...peers.values()]
        peers.forEach((_closed, socket) => socket.destroy())
        await secure.stop(true)
        await Promise.all(closed)
        await new Promise<void>((resolve, reject) => proxy.close((error) => error ? reject(error) : resolve()))
        if (proxy.listening || peers.size) throw new Error("Native TLS proxy cleanup was incomplete")
      },
    })
  } catch (error) {
    disposed = true; peers.forEach((_closed, socket) => socket.destroy()); await secure.stop(true)
    await new Promise<void>((resolve) => proxy.close(() => resolve()))
    throw error
  }
}
