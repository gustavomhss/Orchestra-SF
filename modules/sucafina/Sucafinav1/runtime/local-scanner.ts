import { createConnection } from "node:net"

/** ClamD INSTREAM protocol; only the exact clean response admits a private file. */
export async function scanLocalFile(bytes: Uint8Array, endpoint: { host: "127.0.0.1"; port: number } | null): Promise<boolean> {
  if (!endpoint) return false
  if (endpoint.host !== "127.0.0.1" || !Number.isInteger(endpoint.port) || endpoint.port < 1 || endpoint.port > 65535) return false
  return new Promise<boolean>((resolve) => {
    const socket = createConnection({ host: endpoint.host, port: endpoint.port })
    const output: Buffer[] = []
    const finished = { value: false, offset: -1 }
    const finish = (clean: boolean) => {
      if (finished.value) return
      finished.value = true
      clearTimeout(deadline)
      socket.destroy()
      resolve(clean)
    }
    const deadline = setTimeout(() => finish(false), 30000)
    socket.on("error", () => finish(false))
    socket.on("close", () => finish(false))
    socket.on("data", (chunk) => {
      output.push(chunk)
      const response = Buffer.concat(output)
      if (response.length > 4096) return finish(false)
      const end = response.indexOf(0)
      if (end >= 0) finish(response.subarray(0, end).toString("utf8") === "stream: OK")
    })
    const send = () => {
      if (finished.value) return
      if (finished.offset === -1) {
        finished.offset = 0
        if (!socket.write(Buffer.from("zINSTREAM\0"))) return
      }
      while (finished.offset < bytes.length) {
        const chunk = bytes.subarray(finished.offset, finished.offset + 65536)
        const packet = Buffer.alloc(4 + chunk.length)
        packet.writeUInt32BE(chunk.length)
        packet.set(chunk, 4)
        finished.offset += chunk.length
        if (!socket.write(packet)) return
      }
      if (finished.offset === bytes.length) {
        finished.offset++
        socket.write(Buffer.alloc(4))
      }
    }
    socket.on("connect", send)
    socket.on("drain", send)
  })
}
