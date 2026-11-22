import { expect, test } from "bun:test"
import { readFile } from "node:fs/promises"
import { createConnection } from "node:net"
import path from "node:path"
import { scanLocalFile } from "../../../runtime/local-scanner.ts"

test("real ClamD rejects unknown and malformed INSTREAM commands and remains healthy", async () => {
  const value = process.env.SF_OPERATIONS_CLAMD_PORT
  const evidence = process.env.SF_OPERATIONS_SCANNER_EVIDENCE
  if (!value || !/^\d+$/.test(value) || !evidence)
    throw new Error("OPERATIONS75_REQUIRES_REAL_CLAMD")
  const endpoint = { host: "127.0.0.1" as const, port: Number(value) }
  const receipt = JSON.parse(await readFile(path.join(evidence, "service.json"), "utf8"))
  expect(receipt.run_id).toBe(process.env.GITHUB_RUN_ID)
  expect(receipt.run_attempt).toBe(process.env.GITHUB_RUN_ATTEMPT)
  expect(receipt.github_sha).toBe(process.env.GITHUB_SHA)
  expect(receipt.main.host).toBe(endpoint.host)
  expect(receipt.main.port).toBe(endpoint.port)
  const clean = new TextEncoder().encode("Operations75 clean after malformed protocol\n")
  const replies = []
  for (const command of ["zOPERATIONS75_UNKNOWN\0", "zINSTREAM trailing-garbage\0"]) {
    // Upstream session.c returns UNKNOWN COMMAND for unknown commands and
    // for trailing garbage after INSTREAM. No peer or alternate server is used.
    const response = await exchange(endpoint.port, command)
    expect(response).toBe("UNKNOWN COMMAND\0")
    expect(await exchange(endpoint.port, "zPING\0")).toBe("PONG\0")
    expect(await scanLocalFile(clean, endpoint)).toBe(true)
    replies.push({ command: command.replaceAll("\0", ""), response: response.replaceAll("\0", ""), clean_after: true })
  }
  console.info("OPERATIONS75_REAL_MALFORMED " + JSON.stringify({
    sha: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID, replies,
  }))
})

function exchange(port: number, command: string) {
  return new Promise<string>((resolve, reject) => {
    const socket = createConnection({ host: "127.0.0.1", port })
    const state = { done: false, bytes: 0 }
    const chunks: Buffer[] = []
    const finish = (error?: Error) => {
      if (state.done) return
      state.done = true
      clearTimeout(timer)
      socket.destroy()
      if (error) { reject(error); return }
      resolve(Buffer.concat(chunks).toString("utf8"))
    }
    const timer = setTimeout(() => finish(new Error("OPERATIONS75_REAL_PROTOCOL_TIMEOUT")), 5000)
    socket.on("connect", () => socket.write(command))
    socket.on("data", (chunk) => {
      state.bytes += chunk.length
      if (state.bytes > 4096) { finish(new Error("OPERATIONS75_REAL_PROTOCOL_RESPONSE_TOO_LARGE")); return }
      chunks.push(chunk)
    })
    socket.on("end", () => finish())
    socket.on("error", (error) => finish(error))
    socket.on("close", () => finish(new Error("OPERATIONS75_REAL_PROTOCOL_MISSING_EOF")))
  })
}
