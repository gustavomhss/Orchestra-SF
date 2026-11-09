import { Effect } from "effect"
import { createServer } from "node:http"
import { describe, expect, test } from "bun:test"
import { HttpClientRequest } from "effect/unstable/http"
import {
  makePinnedClient,
  selectApprovedAddress,
  type Resolution,
} from "../src/effect/http-guarded-client"

const address = (value: string): Resolution => ({ address: value, family: 4 })

describe("selectApprovedAddress", () => {
  test("public origin dials a public address", () => {
    expect(selectApprovedAddress("example.test", "public", [address("93.184.216.34")])).toEqual({
      ok: true,
      address: "93.184.216.34",
    })
  })

  test("public origin never dials loopback, private, link-local, mixed or literal non-public", () => {
    for (const addresses of [
      [address("127.0.0.1")],
      [address("10.0.0.5")],
      [address("169.254.169.254")],
      [address("93.184.216.34"), address("127.0.0.1")],
      [],
    ]) {
      expect(selectApprovedAddress("example.test", "public", addresses).ok).toBe(false)
    }
    expect(selectApprovedAddress("127.0.0.1", "public", [address("127.0.0.1")]).ok).toBe(false)
    expect(selectApprovedAddress("localhost", "public", []).ok).toBe(false)
  })

  test("local and private origins keep their permission semantics, link-local stays refused", () => {
    expect(selectApprovedAddress("localhost", "loopback", [address("127.0.0.1")]).ok).toBe(true)
    expect(selectApprovedAddress("db.local", "private", [address("10.1.2.3")])).toEqual({
      ok: true,
      address: "10.1.2.3",
    })
    expect(selectApprovedAddress("169.254.169.254", "loopback", [address("169.254.169.254")]).ok).toBe(false)
  })

  test("the initial direct request keeps the caller's permission semantics", () => {
    expect(selectApprovedAddress("localhost", "direct", [address("127.0.0.1")])).toEqual({
      ok: true,
      address: "127.0.0.1",
    })
  })

  test("IPv6 and mapped addresses classify like their IPv4 reach", () => {
    expect(selectApprovedAddress("example.test", "public", [{ address: "2606:4700:4700::1111", family: 6 }]).ok).toBe(true)
    expect(selectApprovedAddress("example.test", "public", [{ address: "fe80::1", family: 6 }]).ok).toBe(false)
    expect(selectApprovedAddress("example.test", "public", [{ address: "::ffff:127.0.0.1", family: 6 }]).ok).toBe(false)
  })
})

describe("makePinnedClient", () => {
  test("dials the approved address while keeping Host at the URL hostname", async () => {
    let hits = 0
    let seenHost: string | undefined
    const server = createServer((request, response) => {
      hits++
      seenHost = request.headers.host
      response.writeHead(200, { "content-type": "text/plain" })
      response.end("pinned-ok")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const bound = server.address()
    if (!bound || typeof bound === "string") throw new Error("missing address")
    try {
      const client = makePinnedClient(
        () => "direct",
        async () => [address("127.0.0.1")],
      )
      const response = await Effect.runPromise(
        client.execute(HttpClientRequest.get(`http://pinned.local:${bound.port}/`)),
      )
      expect(response.status).toBe(200)
      expect(await Effect.runPromise(response.text)).toBe("pinned-ok")
      expect(hits).toBe(1)
      expect(seenHost).toBe(`pinned.local:${bound.port}`)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 30_000)

  test("a changed dial-time answer to loopback from a public origin never dials", async () => {
    let hits = 0
    const server = createServer((_request, response) => {
      hits++
      response.writeHead(200, { "content-type": "text/plain" })
      response.end("should-not-happen")
    })
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve))
    const bound = server.address()
    if (!bound || typeof bound === "string") throw new Error("missing address")
    try {
      const client = makePinnedClient(
        () => "public",
        async () => [address("127.0.0.1")],
      )
      const failure = await Effect.runPromise(
        client.execute(HttpClientRequest.get(`http://rebinding.test:${bound.port}/`)).pipe(Effect.exit),
      )
      expect(failure._tag).toBe("Failure")
      expect(hits).toBe(0)
    } finally {
      server.closeAllConnections()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 30_000)
})
