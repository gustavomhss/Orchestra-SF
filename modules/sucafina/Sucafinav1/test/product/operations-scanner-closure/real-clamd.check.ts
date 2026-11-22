import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFile, readlink, realpath } from "node:fs/promises"
import { createConnection } from "node:net"
import path from "node:path"
import { scanLocalFile } from "../../../runtime/local-scanner.ts"

// Mandatory live selection. Missing service/configuration fails; no skip, mock
// scanner or synthetic signature database can make this selection green.
test("real ClamD INSTREAM accepts clean, rejects EICAR and accepts clean again", async () => {
  const main = endpoint("SF_OPERATIONS_CLAMD_PORT")
  expect(process.env.GITHUB_RUN_ID).toMatch(/^\d+$/)
  expect((await exchange(main.port, Buffer.from("zPING\0"))).toString()).toBe("PONG\0")
  const version = (await exchange(main.port, Buffer.from("zVERSIONCOMMANDS\0"))).toString()
  expect(version).toMatch(/^ClamAV \d+\.\d+\.\d+\//)
  expect(version).toContain("INSTREAM")
  const clean = new TextEncoder().encode("Operations63 clean stream control\n".repeat(8192))
  const eicar = Buffer.from("WDVPIVAlQEFQWzRcUFpYNTQoUF4pN0NDKTd9JEVJQ0FSLVNUQU5EQVJELUFOVElWSVJVUy1URVNULUZJTEUhJEgrSCo=", "base64")
  expect(eicar.length).toBe(68)
  expect(createHash("md5").update(eicar).digest("hex")).toBe("44d88612fea8a8f36de82e1278abb02f")
  expect(await scanLocalFile(clean, main)).toBe(true)
  expect(await scanLocalFile(eicar, main)).toBe(false)
  expect(await scanLocalFile(clean, main)).toBe(true)
  console.info("OPERATIONS63_REAL_CLAMD " + JSON.stringify({
    sha: process.env.GITHUB_SHA, run: process.env.GITHUB_RUN_ID, version: version.replaceAll("\0", ""),
    clean_bytes: clean.length, eicar_bytes: eicar.length, clean: true, eicar: false, clean_after: true,
  }))
})

test("real ClamD size-limit error is rejected while both real daemons remain responsive", async () => {
  const main = endpoint("SF_OPERATIONS_CLAMD_PORT")
  const limited = endpoint("SF_OPERATIONS_CLAMD_ERROR_PORT")
  expect(limited.port).not.toBe(main.port)
  const bytes = Buffer.alloc(2048, 42)
  const header = Buffer.alloc(4)
  header.writeUInt32BE(bytes.length)
  // ClamD rejects the declared chunk length before reading its body. Sending
  // only that header observes its real ERROR without unread-body TCP resets.
  const response = (await exchange(limited.port, Buffer.concat([
    Buffer.from("zINSTREAM\0"), header,
  ]))).toString()
  expect(response).toContain("INSTREAM size limit exceeded")
  expect(response).toMatch(/ERROR\0$/)
  expect(await scanLocalFile(bytes, limited)).toBe(false)
  expect((await exchange(limited.port, Buffer.from("zPING\0"))).toString()).toBe("PONG\0")
  expect(await scanLocalFile(bytes, main)).toBe(true)
  console.info("OPERATIONS63_REAL_ERROR " + JSON.stringify({ response, admitted: false, main_clean: true }))
})

test("real ClamD outage fails closed after the owned error daemon is stopped", async () => {
  const evidence = process.env.SF_OPERATIONS_SCANNER_EVIDENCE
  const temporary = process.env.RUNNER_TEMP
  if (!evidence || !temporary) throw new Error("OPERATIONS63_REQUIRES_VERIFIED_JOB_LOCAL_SERVICE_RECEIPT")
  const receipt = JSON.parse(await readFile(path.join(evidence, "service.json"), "utf8"))
  expect(receipt.run_id).toBe(process.env.GITHUB_RUN_ID)
  expect(receipt.run_attempt).toBe(process.env.GITHUB_RUN_ATTEMPT)
  expect(receipt.github_sha).toBe(process.env.GITHUB_SHA)
  const directory = await realpath(receipt.work_directory)
  expect(directory.startsWith(await realpath(temporary) + path.sep)).toBe(true)
  expect(await realpath(evidence)).toBe(path.join(directory, "evidence"))
  const service = receipt.error
  expect(Number.isInteger(service.pid) && service.pid > 1 && service.pid !== process.pid).toBe(true)
  expect(service.pid).not.toBe(receipt.main.pid)
  expect(service.port).toBe(endpoint("SF_OPERATIONS_CLAMD_ERROR_PORT").port)
  expect((await exchange(service.port, Buffer.from("zPING\0"))).toString()).toBe("PONG\0")
  const executable = await realpath(service.executable)
  expect(executable.startsWith(directory + path.sep)).toBe(true)
  expect(await readlink(`/proc/${service.pid}/exe`)).toBe(executable)
  const config = await realpath(service.config)
  expect(config.startsWith(directory + path.sep)).toBe(true)
  expect((await readFile(`/proc/${service.pid}/cmdline`, "utf8")).split("\0")).toContain("--config-file=" + config)
  const stat = await readFile(`/proc/${service.pid}/stat`, "utf8")
  expect(stat.slice(stat.lastIndexOf(")") + 2).split(" ")[19]).toBe(String(service.start_time))
  process.kill(service.pid, "SIGTERM")
  const deadline = Date.now() + 30000
  while (true) {
    const observation = await exchange(service.port, Buffer.from("zPING\0")).then(
      () => "running", (error: NodeJS.ErrnoException) => error.code,
    )
    if (observation === "ECONNREFUSED") break
    if (Date.now() >= deadline) throw new Error("OPERATIONS63_OWNED_CLAMD_DID_NOT_STOP")
    await Bun.sleep(25)
  }
  expect(await scanLocalFile(new Uint8Array([1]), endpoint("SF_OPERATIONS_CLAMD_ERROR_PORT"))).toBe(false)
  expect(await scanLocalFile(new Uint8Array([1]), endpoint("SF_OPERATIONS_CLAMD_PORT"))).toBe(true)
  console.info("OPERATIONS63_REAL_DOWN " + JSON.stringify({ pid: service.pid, connection_refused: true, admitted: false, main_clean: true }))
})

function endpoint(name: string) {
  const value = process.env[name]
  if (!value || !/^\d+$/.test(value)) throw new Error("OPERATIONS63_REAL_CLAMD_NOT_PROVISIONED:" + name)
  const port = Number(value)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("OPERATIONS63_INVALID_CLAMD_PORT:" + name)
  return { host: "127.0.0.1" as const, port }
}

function exchange(port: number, command: Buffer) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = []
    const state = { bytes: 0, done: false }
    const socket = createConnection({ host: "127.0.0.1", port })
    const finish = (error?: Error) => {
      if (state.done) return
      state.done = true
      clearTimeout(deadline)
      socket.destroy()
      if (error) { reject(error); return }
      resolve(Buffer.concat(chunks))
    }
    const deadline = setTimeout(() => finish(new Error("CLAMD_CONTROL_DEADLINE")), 30000)
    socket.on("connect", () => socket.write(command))
    socket.on("data", (chunk) => {
      state.bytes += chunk.length
      if (state.bytes > 8192) { finish(new Error("CLAMD_CONTROL_RESPONSE_LIMIT")); return }
      chunks.push(chunk)
    })
    socket.on("end", () => finish())
    socket.on("error", (error) => finish(error))
    socket.on("close", () => finish(new Error("CLAMD_CONTROL_CLOSED_WITHOUT_EOF")))
  })
}
