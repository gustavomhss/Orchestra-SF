import { expect, test } from "bun:test"
import { mkdtemp, rm } from "node:fs/promises"
import { connect } from "node:net"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Deferred, Effect, Stream } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { loadSfInstallation } from "../src/sucafina-product/installation"

const fixture = fileURLToPath(new URL("./fixture/sucafina-installation.ts", import.meta.url))
const entry = fileURLToPath(new URL("../src/index.ts", import.meta.url))
const it = testEffect(LayerNode.compile(AppProcess.node))

it.live.skipIf(process.platform === "win32")("serve mounts the factory on the Node listener and disposes it on SIGTERM", () =>
  Effect.scoped(Effect.gen(function* () {
    const directory = yield* Effect.acquireRelease(
      Effect.promise(() => mkdtemp(path.join(tmpdir(), "sf-serve-"))),
      (directory) => Effect.promise(() => rm(directory, { recursive: true, force: true })),
    )
    const hostname = "127.0.0.1"
    const reservation = Bun.serve({ hostname, port: 0, fetch: () => new Response() })
    const port = reservation.port!
    yield* Effect.promise(async () => { await reservation.stop(true) })
    const origin = `http://${hostname}:${port}`
    const app = yield* AppProcess.Service
    expectSpawn(import.meta.path)
    const child = yield* app.spawn(ChildProcess.make(process.execPath, [
      entry, "serve", "--hostname", hostname, "--port", `${port}`, "--installation", fixture,
    ], {
      cwd: directory,
      env: {
        ...process.env,
        ORCHESTRA_DB: path.join(directory, "orchestra.db"),
        ORCHESTRA_CONFIG_DIR: path.join(directory, "config"),
        ORCHESTRA_INHERIT_CREDENTIALS: "0",
        ORCHESTRA_SERVER_PASSWORD: "synthetic-daemon-password",
        XDG_CACHE_HOME: directory,
        XDG_CONFIG_HOME: directory,
        XDG_DATA_HOME: directory,
        XDG_STATE_HOME: directory,
      },
    }))
    const ready = yield* Deferred.make<void>()
    yield* Effect.forkScoped(child.stdout.pipe(Stream.decodeText, Stream.splitLines, Stream.runForEach((line) =>
      line.includes(`server listening on ${origin}`) ? Effect.asVoid(Deferred.succeed(ready, undefined)) : Effect.void,
    )))
    yield* Effect.forkScoped(child.stderr.pipe(Stream.decodeText, Stream.runForEach((chunk) =>
      Effect.sync(() => console.error(chunk)),
    )))
    yield* Deferred.await(ready).pipe(
      Effect.raceFirst(child.exitCode.pipe(Effect.flatMap((code) => Effect.fail(new Error(`serve exited before ready (${code})`))))),
      Effect.timeout("45 seconds"),
    )

    yield* Effect.promise(async () => {
      const dispatch = (route: string, init?: RequestInit) => fetch(origin + route, { ...init, signal: AbortSignal.timeout(8_000) })
      const base = await dispatch("/sucafina")
      expect(base.status).toBe(200)
      expect(await base.json()).toMatchObject({ origin, path: "/sucafina", method: "GET" })
      const nested = await dispatch("/sucafina/planner?year=2026", {
        method: "POST", headers: { cookie: "installation=fixture" }, body: "original body",
      })
      expect(await nested.json()).toEqual({
        origin, path: "/sucafina/planner?year=2026", method: "POST", cookie: "installation=fixture", body: "original body",
      })
      expect((await dispatch("/sucafina/", { method: "HEAD" })).status).toBe(200)
      expect((await dispatch("/sucafina-extra")).status).toBe(404)
      expect((await dispatch("/sucafina/missing")).status).toBe(404)
      expect((await dispatch("/sucafina/unavailable")).status).toBe(503)
      expect((await dispatch("/sucafina", { headers: { host: `${hostname}:${port === 65_535 ? port - 1 : port + 1}` } })).status).toBe(403)
      expect((await dispatch("/sucafina", { headers: { "x-forwarded-proto": "https" } })).status).toBe(403)
      const api = await dispatch("/api/session")
      expect(api.status).toBe(401)
      expect(api.headers.get("www-authenticate")).toBe('Basic realm="Secure Area"')

      const body = new Uint8Array(17 * 1024 * 1024)
      const contract = await dispatch("/sucafina/dashboard?upload=contract", { method: "POST", body })
      expect(contract.status).toBe(200)
      expect(await contract.json()).toBe(body.byteLength)
      expect((await dispatch("/sucafina/dashboard?upload=contract&upload=contract", { method: "POST", body })).status).toBe(413)
      const rejected = await new Promise<string>((resolve, reject) => {
        const socket = connect(port, hostname)
        socket.setTimeout(8_000, () => {
          socket.destroy()
          reject(new Error("Timed out waiting for the early upload rejection"))
        })
        socket.once("error", reject)
        socket.once("close", () => reject(new Error("Upload socket closed before returning the status line")))
        socket.once("connect", () => {
          // Deliver a complete chunk but leave the request body open until the server answers.
          socket.write(`POST /sucafina/reject HTTP/1.1\r\nHost: ${hostname}:${port}\r\nTransfer-Encoding: chunked\r\n\r\nb\r\nfirst chunk\r\n`)
        })
        let response = ""
        socket.on("data", (bytes) => {
          response += bytes.toString()
          if (!response.includes("\r\n\r\n")) return
          resolve(response)
          socket.destroy()
        })
      })
      expect(rejected).toMatch(/^HTTP\/1\.1 413 /)
      expect(rejected).toMatch(/\r\nConnection: close\r\n/i)
    })
    yield* child.kill({ killSignal: "SIGTERM" })
    yield* child.exitCode.pipe(Effect.timeout("8 seconds"))
    expect(yield* Effect.promise(() => Bun.file(path.join(directory, "installation-disposed")).text())).toBe("yes")
  })), { timeout: 70_000 },
)

test("rejects a relative path and missing or ephemeral ports before loading the factory", async () => {
  expect(await loadSfInstallation("relative.ts", "localhost", 4110).catch((error: Error) => error.message))
    .toContain("absolute")
  for (const port of [undefined, 0, 65_536]) {
    expect(await loadSfInstallation(fixture, "localhost", port).catch((error: Error) => error.message))
      .toContain("explicit port")
  }
})
