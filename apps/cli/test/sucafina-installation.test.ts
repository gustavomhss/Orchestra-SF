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

function unfinishedPost(hostname: string, port: number, route: string, headers: string[]) {
  return new Promise<string>((resolve, reject) => {
    const socket = connect(port, hostname)
    socket.setTimeout(8_000, () => {
      socket.destroy()
      reject(new Error("Timed out waiting for the early upload rejection"))
    })
    socket.once("error", reject)
    socket.once("close", () => reject(new Error("Upload socket closed before returning the status line")))
    socket.once("connect", () => {
      // Deliver a complete chunk but leave the request body open until the server answers.
      socket.write([
        `POST ${route} HTTP/1.1`, ...headers, "Transfer-Encoding: chunked", "", "b", "first chunk", "",
      ].join("\r\n"))
    })
    let response = ""
    socket.on("data", (bytes) => {
      response += bytes.toString()
      if (!response.includes("\r\n\r\n")) return
      resolve(response)
      socket.destroy()
    })
  })
}

const serveInstallation = (trusted: boolean) => () =>
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
        SF_TEST_TRUSTED_INGRESS: trusted ? "1" : "0",
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
      if (trusted) {
        expect(await Bun.file(path.join(directory, "orchestra.db")).exists()).toBe(false)
        const host = `teams-ingress.example.test:${port}`
        const proof = "synthetic-sf-ingress-proof"
        const rejected: Record<string, string>[] = [
          { host },
          { host, "x-sf-ingress-proof": "wrong" },
          { host, "x-forwarded-for": hostname, "x-forwarded-host": host, "x-forwarded-proto": "http" },
          { host: new URL(origin).host, "x-sf-ingress-proof": proof },
        ]
        // Check a route whose handler would return 503 to distinguish that from the ingress rejection.
        for (const headers of rejected) expect((await dispatch("/sucafina/unavailable", { headers })).status).toBe(403)
        expect((await dispatch("/openapi.json")).status).toBe(404)
        expect((await dispatch("/openapi.json", { headers: { host, "x-sf-ingress-proof": proof } })).status).toBe(404)
        for (const headers of [
          [],
          [`X-SF-Ingress-Proof: ${proof}`, `x-sf-ingress-proof: ${proof}`],
          [`Host: ${host}`, `X-SF-Ingress-Proof: ${proof}`],
        ]) {
          const response = await unfinishedPost(hostname, port, "/sucafina/dashboard", [`Host: ${host}`, ...headers])
          expect(response).toMatch(/^HTTP\/1\.1 403 /)
        }
        const approved = await dispatch("/sucafina/planner?year=2026", {
          method: "POST",
          headers: {
            host,
            "x-sf-ingress-proof": proof,
            cookie: "installation=fixture",
            forwarded: "for=192.0.2.11;host=untrusted.example.test;proto=https",
            "x-forwarded-for": "192.0.2.11",
            "x-forwarded-host": "untrusted.example.test",
            "x-forwarded-proto": "https",
            "x-forwarded-custom": "also stripped",
          },
          body: "original body",
        })
        expect(approved.status).toBe(200)
        expect(await approved.json()).toEqual({
          origin, requestOrigin: `http://${host}`, path: "/sucafina/planner?year=2026",
          ingressProof: null, forwardingHeaders: [], method: "POST", cookie: "installation=fixture", body: "original body",
        })
        const attachment = new Uint8Array(17 * 1024 * 1024)
        const upload = (route: string, query: string) => dispatch(`/sucafina${route}?${query}`, {
          method: "POST", headers: { host, "x-sf-ingress-proof": proof }, body: attachment,
        })
        for (const route of ["/dashboard", "/teams/44444444-4444-4444-8444-444444444444/dashboard"]) {
          const contract = await upload(route, "upload=contract")
          expect(contract.status).toBe(200)
          expect(await contract.json()).toBe(attachment.byteLength)
          expect((await upload(route, "upload=contract&upload=contract")).status).toBe(413)
        }
        expect((await upload("/teams/not-a-team/dashboard", "upload=contract")).status).toBe(413)
        return
      }
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
      const rejected = await unfinishedPost(hostname, port, "/sucafina/reject", [`Host: ${hostname}:${port}`])
      expect(rejected).toMatch(/^HTTP\/1\.1 413 /)
      expect(rejected).toMatch(/\r\nConnection: close\r\n/i)
    })
    yield* child.kill({ killSignal: "SIGTERM" })
    yield* child.exitCode.pipe(Effect.timeout("8 seconds"))
    expect(yield* Effect.promise(() => Bun.file(path.join(directory, "installation-disposed")).text())).toBe("yes")
  }))

it.live.skipIf(process.platform === "win32")(
  "serve mounts the factory on the Node listener and disposes it on SIGTERM",
  serveInstallation(false), { timeout: 70_000 },
)

it.live.skipIf(process.platform === "win32")(
  "serve admits trusted installation ingress on the Node listener and strips the proof",
  serveInstallation(true), { timeout: 70_000 },
)

test("rejects a relative path and missing or ephemeral ports before loading the factory", async () => {
  expect(await loadSfInstallation("relative.ts", "localhost", 4110).catch((error: Error) => error.message))
    .toContain("absolute")
  for (const port of [undefined, 0, 65_536]) {
    expect(await loadSfInstallation(fixture, "localhost", port).catch((error: Error) => error.message))
      .toContain("explicit port")
  }
})
