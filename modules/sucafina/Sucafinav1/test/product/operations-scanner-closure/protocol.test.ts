import { expect, test } from "bun:test"
import { once } from "node:events"
import { createServer } from "node:net"
import type { Socket } from "node:net"
import { scanLocalFile } from "../../../runtime/local-scanner.ts"

// These adversarial peers exercise refusal only. They are never installed as
// an Operations scanner and cannot substitute for real-clamd.check.ts.
for (const [name, reply] of [
  ["clean prefix followed by a detection", "stream: OK\0stream: Eicar-Signature FOUND\0"],
  ["clean prefix followed by an error", "stream: OK\0stream: ERROR\0"],
  ["duplicate clean records", "stream: OK\0stream: OK\0"],
  ["extra NUL after clean record", "stream: OK\0\0"],
  ["unterminated clean reply", "stream: OK"],
  ["wrong reply delimiter", "stream: OK\n"],
  ["unexpected Unicode replacement character before clean terminator", "stream: OK\ufffd\0"],
  ["oversized clean-prefixed reply", "stream: OK\0" + "x".repeat(4096)],
] as const) {
  test("ClamD protocol refuses " + name, async () => {
    const f = await peer(reply)
    try {
      expect(await scanLocalFile(new Uint8Array([1, 2, 3]), f.endpoint)).toBe(false)
      expect(Buffer.concat(f.received)).toEqual(Buffer.concat([
        Buffer.from("zINSTREAM\0"), Buffer.from([0, 0, 0, 3, 1, 2, 3, 0, 0, 0, 0]),
      ]))
    } finally { await f.close() }
  })
}

test("ClamD protocol refuses a clean reply before the complete stream is sent", async () => {
  const f = await peer("stream: OK\0", true)
  try {
    // The peer does not consume the upload; the sender encounters real socket
    // backpressure before this payload can complete. No clock or mock is used.
    expect(await scanLocalFile(new Uint8Array(16 * 1024 * 1024), f.endpoint)).toBe(false)
  } finally { await f.close() }
})

test("ClamD protocol refuses a missing or invalid loopback endpoint", async () => {
  const bytes = new Uint8Array([1])
  expect(await scanLocalFile(bytes, null)).toBe(false)
  for (const port of [0, -1, 65536, 1.5, Number.NaN]) {
    expect(await scanLocalFile(bytes, { host: "127.0.0.1", port })).toBe(false)
  }
})

async function peer(reply: string, early = false) {
  const sockets = new Set<Socket>()
  const received: Buffer[] = []
  const server = createServer((socket) => {
    sockets.add(socket)
    socket.once("close", () => sockets.delete(socket))
    // A refusal can close the connection while the adversarial peer is writing.
    socket.on("error", () => socket.destroy())
    if (early) {
      socket.pause()
      socket.end(reply)
      return
    }
    socket.on("data", (chunk) => {
      received.push(chunk)
      const wire = Buffer.concat(received)
      if (wire.length === 21) socket.end(reply)
    })
  })
  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address()
  if (!address || typeof address === "string") throw new Error("SCANNER_PROTOCOL_PEER_NOT_LISTENING")
  return {
    endpoint: { host: "127.0.0.1" as const, port: address.port }, received,
    close: async () => {
      sockets.forEach((socket) => socket.destroy())
      await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    },
  }
}
