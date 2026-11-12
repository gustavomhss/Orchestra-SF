import { expect, test } from "bun:test"
import { scanLocalFile } from "../runtime/local-scanner.ts"

test("unconfigured scanner cannot admit a file", async () => { expect(await scanLocalFile(new Uint8Array([1]), null)).toBe(false) })

for (const verdict of ["stream: OK", "stream: Eicar-Signature FOUND", "stream: ERROR", "not-stream: OK"]) {
  test(`INSTREAM requires exact clean verdict: ${verdict}`, async () => {
    const received: Buffer[] = []
    const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: {
      data(socket, bytes) {
        received.push(Buffer.from(bytes))
        const wire = Buffer.concat(received)
        if (wire.length < 10 || wire.subarray(0, 10).toString() !== "zINSTREAM\0") return
        const progress = { offset: 10 }
        while (progress.offset + 4 <= wire.length) {
          const size = wire.readUInt32BE(progress.offset)
          if (size === 0) { socket.end(`${verdict}\0`); return }
          if (progress.offset + 4 + size > wire.length) return
          progress.offset += 4 + size
        }
      },
    } })
    const bytes = new Uint8Array(150000).fill(37)
    try {
      expect(await scanLocalFile(bytes, { host: "127.0.0.1", port: listener.port! })).toBe(verdict === "stream: OK")
      const wire = Buffer.concat(received)
      const payload: Buffer[] = []
      const progress = { offset: 10 }
      while (progress.offset + 4 <= wire.length) {
        const size = wire.readUInt32BE(progress.offset)
        if (size === 0) break
        payload.push(wire.subarray(progress.offset + 4, progress.offset + 4 + size))
        progress.offset += size + 4
      }
      expect(Buffer.concat(payload)).toEqual(Buffer.from(bytes))
    } finally { listener.stop(true) }
  })
}
