import { expect, test } from "bun:test"
import { mkdtemp, readFile, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { createRequire } from "node:module"
import { pathToFileURL } from "node:url"
import type { IncomingMessage } from "node:http"
import { Effect, Layer, Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { createSfHostRuntime } from "../../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { microsoftNativeHost } from "../../microsoft-login/native-host.ts"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { withListener79, markIncoming79 } from "./listener79.ts"
import { prepareLocalConfiguration } from "../../../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../../../local/enroll.ts"
import { createLocalInstallation } from "../../../local/entry.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { readOperatorSessionCookie } from "../../../../../../packages/app-shell/e2e/sucafina/decisions-support/operator-session-cookie.ts"

const repository = path.resolve(import.meta.dir, "../../../../../..")
const cli = createRequire(path.join(repository, "apps/cli/package.json"))
const { NodeHttpServerRequest } = await import(pathToFileURL(cli.resolve("@effect/platform-node")).href)
const { composeSfInstallation } = await import(pathToFileURL(path.join(repository, "apps/cli/src/sucafina-product/installation.ts")).href)
const payload = '{"action":"list","scope":{}}'

async function request79(url: string, init: RequestInit, capture: { take: () => unknown[] }, timeout = 1800) {
  const controller = new AbortController()
  const state = { timedOut: false, beforeAbort: undefined as unknown[] | undefined }
  const started = performance.now()
  const timer = setTimeout(() => {
    state.beforeAbort = capture.take()
    state.timedOut = true
    controller.abort()
  }, timeout)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal, redirect: "manual" })
    const text = await response.text()
    return { status: response.status, text, elapsedMs: Math.round(performance.now() - started), ...state }
  } catch (error) {
    return { status: 0, text: "", error: error instanceof Error ? error.name : "unknown", elapsedMs: Math.round(performance.now() - started), ...state }
  } finally { clearTimeout(timer) }
}

function flowControl(source: IncomingMessage, signal: AbortSignal) {
  return new Promise<number>((resolve, reject) => {
    const state = { bytes: 0, settled: false }
    const cleanup = () => {
      source.off("data", data)
      source.off("end", end)
      source.off("error", failed)
      source.off("aborted", failed)
      signal.removeEventListener("abort", failed)
      source.pause()
    }
    const failed = () => {
      if (state.settled) return
      state.settled = true
      cleanup()
      reject(new Error("M79_FLOW_CONTROL_FAILED"))
    }
    const data = (chunk: Buffer) => {
      state.bytes += chunk.byteLength
      markIncoming79(source, "flow.data")
      if (state.bytes > 64) failed()
    }
    const end = () => {
      if (state.settled) return
      state.settled = true
      markIncoming79(source, "flow.end")
      cleanup()
      resolve(state.bytes)
    }
    source.on("data", data)
    source.once("end", end)
    source.once("error", failed)
    source.once("aborted", failed)
    signal.addEventListener("abort", failed, { once: true })
    if (signal.aborted) failed()
    else source.resume()
  })
}

test("M79 exact-length POST crosses the installed Node Effect Web body boundary", async () => {
  expect(Buffer.byteLength(payload)).toBe(28)
  await withListener79({
    compose: async (value, origin) => {
      const installation = await composeSfInstallation(value, origin)
      const control = HttpRouter.add("POST", "/flow-control", Effect.gen(function* () {
        const incoming = yield* HttpServerRequest.HttpServerRequest
        const source = NodeHttpServerRequest.toIncomingMessage(incoming)
        const bytes = yield* Effect.tryPromise({ try: (signal) => flowControl(source, signal), catch: () => "flow-control-failed" as const })
        return HttpServerResponse.jsonUnsafe({ bytes })
      }))
      return { ...installation, layer: Layer.merge(installation.layer, control) }
    },
    create: async () => ({ mount: "/probe", dispose() {}, async handler(request) {
      if (request.method === "GET") return Response.json({ ready: true })
      return Response.json({ bytes: Buffer.byteLength(await request.text()) })
    } }),
    run: async ({ listener, capture }) => {
      const headers = { "content-type": "application/json", "content-length": "28", connection: "close" }
      const get = await request79(`${listener}/probe`, { headers: { "x-m79-probe-id": "minimal-get", connection: "close" } }, capture)
      const flow = await request79(`${listener}/flow-control`, { method: "POST", headers: { ...headers, "x-m79-probe-id": "flow-control" }, body: payload }, capture)
      const post = await request79(`${listener}/probe`, { method: "POST", headers: { ...headers, "x-m79-probe-id": "minimal-post" }, body: payload }, capture)
      console.log("M79_OBSERVATION " + JSON.stringify({ case: "minimal", runtime: { bun: Bun.version, node: process.version }, get, flow, post, traces: capture.take() }))
      expect(get.status).toBe(200)
      expect(flow.status).toBe(200)
      expect(JSON.parse(flow.text)).toEqual({ bytes: 28 })
      expect(post.timedOut).toBe(false)
      expect(post.status).toBe(200)
      expect(JSON.parse(post.text)).toEqual({ bytes: 28 })
    },
  })
}, 12000)

test("M79 real local operator Versions save crosses body auth dispatch persistence and response once", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-post79-"))
  try {
    const file = await prepareLocalConfiguration(directory)
    const enrollment = await prepareOperatorAccess(file, true)
    const enrollmentHtml = await readFile(enrollment.artifact, "utf8")
    const enrollmentMatch = /location\.replace\(("[^"]+")\)/.exec(enrollmentHtml)
    if (!enrollmentMatch) throw new Error("M79_PRIVATE_ENROLLMENT_ARTIFACT_INVALID")
    const environment = {
      ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
      TMPDIR: path.join(directory, "host-tmp"), XDG_DATA_HOME: path.join(directory, "host-data"), XDG_CONFIG_HOME: path.join(directory, "host-config"),
      XDG_CACHE_HOME: path.join(directory, "host-cache"), XDG_STATE_HOME: path.join(directory, "host-state"),
    }
    await withListener79({
      hostname: "localhost", port: 4110, compose: composeSfInstallation,
      create: async (origin) => {
        const installation = await createLocalInstallation({ origin, createHostRuntime: createSfHostRuntime }, file, environment)
        if (!installation.mount.startsWith("/")) throw new Error("M79 installation mount is not a path")
        const host = await microsoftNativeHost({ root: directory, directory, environment }, installation)
          .catch(async (error) => { await installation.dispose(); throw error })
        return { ...installation, mount: installation.mount as `/${string}`, dispose: async () => {
          try { await host.dispose() } finally { await installation.dispose() }
        } }
      },
      run: async ({ listener, capture }) => {
        const enrolled = await fetch(JSON.parse(enrollmentMatch[1]), { redirect: "manual", headers: { connection: "close", "x-m79-probe-id": "enrollment" }, signal: AbortSignal.timeout(1800) })
        expect(enrolled.status).toBe(303)
        const session = readOperatorSessionCookie(enrolled.headers)
        const cookie = `${session.name}=${session.value}`
        await enrolled.arrayBuffer()
        const legacy = await request79(`${listener}/sucafina/planner?page=Versions`, { headers: { cookie, connection: "close", "x-m79-probe-id": "versions-legacy" } }, capture)
        expect(legacy.status).toBe(404)
        expect(legacy.text).toBe("legacy console decommissioned — use /")
        const get = await request79(`${listener}/sucafina/api/ui/pages/CAP23`, { headers: { cookie, connection: "close", "x-m79-probe-id": "versions-get" } }, capture)
        expect(get.status).toBe(200)
        const before = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(JSON.parse(get.text))
        expect(before.status).toBe("ok")
        if (before.status !== "ok") throw new Error("M79_NATIVE_VERSIONS_NOT_ADMITTED")
        expect(before.value.data.versions).toEqual([])
        // Match the first-version form and A62: undefined id is omitted; confirmed is explicit.
        const body = JSON.stringify({ page: "Versions", action: "save", version: 0, values: {}, confirmed: false })
        expect(Buffer.byteLength(body)).toBe(77)
        const post = await request79(`${listener}/sucafina/planner?page=Versions`, { method: "POST", headers: {
          cookie, origin: listener, "content-type": "application/json", "content-length": String(Buffer.byteLength(body)), connection: "close", "x-m79-probe-id": "versions-save",
        }, body }, capture)
        // Unknown outcome is reconciled by a read; the mutation is never sent a second time.
        const observer = await openLocalStore(path.join(directory, "business-local"))
        const readRoot = observer.readSnapshotRoot
        if (!readRoot) throw new Error("local store read root unavailable")
        const state = await readRoot(() => observer.transaction("planner", async (snapshot) => ({ commit: false, value: {
          versions: Array.isArray(snapshot.data.versions) ? snapshot.data.versions.length : 0,
          versionIds: Array.isArray(snapshot.data.versions) ? snapshot.data.versions.map((entry) => entry.id) : [],
          auditCount: snapshot.audit.length,
        } }))).finally(() => observer.dispose())
        const after = await request79(`${listener}/sucafina/api/ui/pages/CAP23`, { headers: { cookie, connection: "close", "x-m79-probe-id": "versions-after" } }, capture)
        console.log("M79_OBSERVATION " + JSON.stringify({ case: "versions", bodyBytes: Buffer.byteLength(body), mutationCount: 1,
          get: { status: get.status }, post: { ...post, text: undefined }, after: { status: after.status }, state, traces: capture.take() }))
        expect(post.timedOut).toBe(false)
        expect(post.status).toBe(200)
        expect(JSON.parse(post.text).ok).toBe(true)
        expect(state.versions).toBe(1)
        expect(state.auditCount).toBe(2)
        expect(after.status).toBe(200)
        const reread = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(JSON.parse(after.text))
        expect(reread.status).toBe("ok")
        if (reread.status !== "ok") throw new Error("M79_NATIVE_VERSIONS_REREAD_NOT_ADMITTED")
        expect(reread.value.data.versions).toHaveLength(1)
        expect(reread.value.data.versions.map((version) => version.id)).toEqual(state.versionIds)
        expect(reread.value.selection.year).toBe(before.value.selection.year)
      },
    })
  } finally { await rm(directory, { recursive: true, force: true }) }
}, 18000)
