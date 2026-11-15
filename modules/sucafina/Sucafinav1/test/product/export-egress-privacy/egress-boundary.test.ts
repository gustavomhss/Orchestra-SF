import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import JSZip from "jszip"
import { SaxesParser } from "saxes"
import { createApplication } from "../../../runtime/application.ts"
import type { Persistence } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { emptyMap, resolve } from "../../../src/identity.ts"

const captured = "EA86-CAPTURED-PUBLIC-DOCX"
const changed = "EA86-CHANGED-PUBLIC-DOCX"
const privateMarker = "EA86-PRIVATE-NOT-FOR-EXPORT"

for (const scenario of ["grant-revoked", "session-revoked", "source-changed", "private-only-drift", "head-grant-revoked"] as const) {
  test(`EA86 egress: ${scenario} after initial SQLite read, before response`, async () => {
    const directory = await mkdtemp(join(await realpath(tmpdir()), "sf86-egress-"))
    await chmod(directory, 0o700)
    const store = await openLocalStore(directory)
    let sessionActive = true
    let armed = false
    let mutations = 0
    let authCalls = 0
    try {
      await store.transaction("dashboard", async (snapshot) => {
        snapshot.data.roleMap = emptyMap().map((row) => ({
          ...row,
          entra: row.surface === "dashboard" && row.role === "admin" ? "sf86-admin-grant" : null,
          version: 1,
          by: "synthetic-fixture",
        }))
        snapshot.data.hotTopics = [{ id: "source86", action: captured, status: "open", priority: "normal" }]
        snapshot.versions["hotTopics:source86"] = { version: 1, by: "synthetic-fixture" }
        return { commit: true, value: undefined }
      })
      // This wrapper delegates the real SQLite transaction verbatim. Only its completion
      // schedules the external grant/session/source change; the producer remains unchanged.
      const persistence: Persistence = {
        ...store,
        transaction: async (surface, work, options) => {
          const result = await store.transaction(surface, work, options)
          if (!armed || surface !== "dashboard" || !result || typeof result !== "object" ||
              !("snapshot" in result) || !("actor" in result)) return result
          armed = false
          mutations += 1
          if (scenario === "session-revoked") {
            sessionActive = false
            return result
          }
          await store.transaction(surface, async (latest) => {
            if (scenario === "grant-revoked" || scenario === "head-grant-revoked") {
              latest.data.roleMap = (latest.data.roleMap as ReturnType<typeof emptyMap>).map((row) => ({
                ...row,
                entra: row.surface === "dashboard" && row.role === "admin" ? null : row.entra,
              }))
            }
            if (scenario === "source-changed") {
              latest.data.hotTopics = [{ id: "source86", action: changed, status: "open", priority: "normal" }]
              latest.versions["hotTopics:source86"] = { version: 2, by: "synthetic-fixture" }
            }
            if (scenario === "private-only-drift") latest.data.__sfProductV1 = { secret: privateMarker }
            return { commit: true, value: undefined }
          })
          return result
        },
      }
      const serve = createApplication("/sf", {
        persistence,
        authenticate: async (request, context) => {
          authCalls += 1
          if (!context || !sessionActive || request.headers.get("x-sf86-session") !== "synthetic") return null
          return resolve("synthetic-owner", [...context.roleMap], (group) => group === "sf86-admin-grant")
        },
        environment: async () => ({ at: "2026-11-15T00:00:00Z", id: () => "synthetic86", directory: [] }),
        domains: { dashboard: [], planner: [], procurement: [] },
        maxJsonBytes: 4096,
      })
      const request = (method: "GET" | "HEAD" = "GET") => new Request(
        "https://sf86.invalid/sf/dashboard?download=docx&year=2026&title=Captured%20egress&topic=Hot%20Topics%20%26%20Actions",
        { method, headers: { "x-sf86-session": "synthetic" } },
      )
      const control = await serve(request())
      expect(control?.status).toBe(200)
      if (!control) throw new Error("Positive export control is missing")
      expect(await docxText(new Uint8Array(await control.arrayBuffer()))).toContain(captured)
      const before = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      const initialAuthCalls = authCalls
      armed = true
      const response = await serve(request(scenario === "head-grant-revoked" ? "HEAD" : "GET"))
      expect(mutations).toBe(1)
      expect(authCalls - initialAuthCalls).toBe(2)
      if (!response) throw new Error("No HTTP response at export egress")
      const body = new Uint8Array(await response.arrayBuffer())
      if (scenario === "private-only-drift") {
        expect(response.status).toBe(200)
        const text = await docxText(body)
        expect(text).toContain(captured)
        expect(text).not.toContain(privateMarker)
        expect(response.headers.get("content-disposition")).toContain("attachment")
      } else {
        expect(response.status).toBe(scenario === "source-changed" ? 409 : 403)
        expect(response.headers.get("content-disposition")).toBeNull()
        expect(response.headers.get("cache-control")).toBe("no-store")
        expect(new TextDecoder().decode(body)).not.toContain(captured)
        expect(new TextDecoder().decode(body)).not.toContain(privateMarker)
        if (scenario === "head-grant-revoked") expect(body.length).toBe(0)
      }
      const current = await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      if (scenario === "session-revoked") expect(current).toEqual(before)
      if (scenario === "source-changed") {
        expect(current.versions["hotTopics:source86"]?.version).toBe(2)
        const fresh = await serve(request())
        expect(fresh?.status).toBe(200)
        if (!fresh) throw new Error("Fresh download missing")
        expect(await docxText(new Uint8Array(await fresh.arrayBuffer()))).toContain(changed)
      }
      if (scenario === "grant-revoked" || scenario === "head-grant-revoked") {
        const next = await serve(request())
        expect(next?.status).toBe(403)
      }
    } finally {
      await store.dispose()
      await rm(directory, { recursive: true, force: true })
    }
  }, 30000)
}

async function docxText(bytes: Uint8Array) {
  const archive = await JSZip.loadAsync(bytes)
  const document = archive.file("word/document.xml")
  if (!document) throw new Error("Missing main DOCX document")
  const content: string[] = []
  const parser = new SaxesParser({ xmlns: false })
  parser.on("text", (value) => content.push(value))
  parser.write(await document.async("string")).close()
  return content.join("\n")
}
