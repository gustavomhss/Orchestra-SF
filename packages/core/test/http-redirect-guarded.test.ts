import { Effect } from "effect"
import { createServer } from "node:http"
import { describe, expect, test } from "bun:test"
import { HttpClientRequest } from "effect/unstable/http"
import { HttpRedirect } from "../src/tool/http-redirect"

const address = (value: string) => ({ address: value, family: 4 as const })

test("direct local fetch keeps caller permission semantics (dial follows injected resolution)", async () => {
  let hits = 0
  const server = createServer((_request, response) => {
    hits++
    response.writeHead(200, { "content-type": "text/plain" })
    response.end("hello")
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  const bound = server.address()
  if (!bound || typeof bound === "string") throw new Error("missing address")
  try {
    const body = await Effect.runPromise(
      Effect.scoped(
        HttpRedirect.followGuarded(HttpClientRequest.get(`http://public.test:${bound.port}/`), {
          deps: { lookup: async () => [address("127.0.0.1")] },
        }).pipe(Effect.flatMap((response) => response.text)),
      ),
    )
    expect(body).toBe("hello")
    expect(hits).toBe(1)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}, 30_000)

test("a public redirect whose dial-time answer changed to loopback never dials it", async () => {
  let hits = 0
  let bound: { port: number } = { port: 0 }
  const server = createServer((_request, response) => {
    hits++
    response.writeHead(302, { location: `http://evil.test:${bound.port}/` })
    response.end()
  })
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
  bound = server.address() as { port: number }
  if (!bound || typeof bound === "string") throw new Error("missing address")
  try {
    const failure = await Effect.runPromise(
      Effect.scoped(
        HttpRedirect.followGuarded(HttpClientRequest.get(`http://public.test:${bound.port}/`), {
          deps: {
            lookup: async (hostname) => [address(hostname === "evil.test" || hostname === "public.test" ? "127.0.0.1" : "127.0.0.1")],
          },
        }).pipe(Effect.exit),
      ),
    )
    // First hop is direct (caller semantics) and reaches the server; the redirect hop is public-origin, so the
    // connector refuses the rebound loopback answer before dialing it a second time.
    expect(failure._tag).toBe("Failure")
    expect(hits).toBe(1)
  } finally {
    server.closeAllConnections()
    await new Promise<void>((resolve) => server.close(() => resolve()))
  }
}, 30_000)
