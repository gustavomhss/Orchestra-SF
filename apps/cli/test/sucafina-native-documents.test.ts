import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Document, Packer, Paragraph } from "docx"
import { Effect } from "effect"
import { uploadAsset, type AssetPersistence } from "../../../modules/sucafina/Sucafinav1/runtime/assets.ts"
import { object } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { scanLocalFile } from "../../../modules/sucafina/Sucafinav1/runtime/local-scanner.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { withNativeInstallation } from "./fixture/sucafina-native-installation"

const it = testEffect(LayerNode.compile(AppProcess.node))
const documentName = "native-proof-terms.docx"
const documentType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const marker = "Native document worker receipt"
const supplierId = "native-proof-supplier"
const assetId = "native-proof-docx"

// The fixture acknowledges only the expected DOCX on the original ClamD wire
// protocol. The installation still owns scanning, authorization and parsing.
function testScanner(expected: Uint8Array) {
  const incoming = new WeakMap<object, Buffer>()
  let accepted = 0
  const listener = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: {
    data(socket, bytes) {
      const wire = Buffer.concat([incoming.get(socket) ?? Buffer.alloc(0), bytes])
      if (wire.length > expected.byteLength + 128) {
        socket.end("stream: ERROR\0")
        return
      }
      incoming.set(socket, wire)
      if (wire.length < 10 || wire.subarray(0, 10).toString() !== "zINSTREAM\0") return
      const parts: Buffer[] = []
      for (let offset = 10; offset + 4 <= wire.length;) {
        const length = wire.readUInt32BE(offset)
        offset += 4
        if (length === 0) {
          const matches = Buffer.concat(parts).equals(Buffer.from(expected))
          if (matches) accepted += 1
          socket.end(matches ? "stream: OK\0" : "stream: ERROR\0")
          return
        }
        if (offset + length > wire.length) return
        parts.push(wire.subarray(offset, offset + length))
        offset += length
      }
    },
  } })
  return {
    endpoint: { host: "127.0.0.1" as const, port: listener.port! },
    accepted: () => accepted,
    dispose: () => listener.stop(true),
  }
}

async function result<T>(response: Response): Promise<T> {
  const value: { status: string; reason?: string; value?: T } = await response.json()
  if (response.status !== 200 || value.status !== "ok" || value.value === undefined)
    throw new Error(`Native Documents response failed (${response.status} ${value.status} ${value.reason ?? ""})`)
  return value.value
}

it.live.skipIf(process.platform === "win32")(
  "installed Documents extracts DOCX through its worker and persists original evidence",
  () => Effect.scoped(Effect.gen(function* () {
    const bytes = yield* Effect.promise(async () => new Uint8Array(await Packer.toBuffer(new Document({
      sections: [{ children: [new Paragraph(marker), new Paragraph("Price: 42")] }],
    }))))
    const scanner = yield* Effect.acquireRelease(
      Effect.sync(() => testScanner(bytes)),
      (scanner) => Effect.sync(() => { scanner.dispose() }),
    )
    expectSpawn(import.meta.path)
    const installed = yield* withNativeInstallation({
      scanner: scanner.endpoint,
      seed: async ({ actorId, keys, store }) => {
        const assets: AssetPersistence = store
        const staged = await assets.transaction("procurement", async (snapshot, blobs) => {
          snapshot.data.store = { suppliers: [{ id: supplierId, name: "Documents proof supplier" }], settings: { uploadCap: 100_000 } }
          const uploaded = await uploadAsset(
            snapshot, blobs,
            { id: actorId, roles: ["admin"], canWrite: true, assigned: [], domains: [] },
            { page: "Suppliers", action: "upload", id: supplierId, version: 0, values: {} },
            { at: new Date().toISOString(), id: () => assetId, directory: [] },
            { signingKey: keys.assets, scan: (content) => scanLocalFile(content, scanner.endpoint) },
            "supplier", { name: documentName, type: documentType, bytes },
          )
          return { commit: uploaded.ok, value: uploaded }
        })
        expect(staged).toMatchObject({ ok: true })
        expect(scanner.accepted()).toBe(1)
      },
    })
    yield* Effect.promise(async () => {
      const mode = (name: string) => `/dashboard?sf=${name}`
      const post = (name: string, input: unknown) => installed.request(mode(name), {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
        body: JSON.stringify(input),
      })
      const sources = await result<Array<{ selectionRef: string; label: string; surface: string }>>(await installed.request(mode("document-sources")))
      const source = sources.find((item) => item.label === documentName && item.surface === "procurement")
      if (!source) throw new Error("The installed Documents route did not discover the persisted DOCX")
      const admitted = await result<{ documentRef: string }>(await post("document-admit", { selectionRef: source.selectionRef }))
      expect(admitted.documentRef).toBe(assetId)
      const schema = await result<{ ref: string }>(await post("document-schema", {
        documentRef: admitted.documentRef,
        fields: [{ id: "Price", type: "number", unit: "USD" }],
      }))
      const evidence = await result<{ id: string }>(await post("document-extract", {
        documentRef: admitted.documentRef,
        fieldSchemaRef: schema.ref,
      }))
      expect(evidence).toMatchObject({ fieldCandidate: "Price", value: 42, status: "extracted" })

      const store = await openLocalStore(installed.businessDirectory)
      try {
        await store.transaction("dashboard", async (snapshot) => {
          const documents = object(object(snapshot.data.__sfProductV1).documents)
          const index = Object.values(documents).map(object).find((entry) =>
            entry.schema === "sf-document-index-v1" && object(entry.snapshot).documentRef === admitted.documentRef)
          expect(index).toBeDefined()
          expect(object(object(index?.snapshot).source).text).toContain(marker)
          expect(object(documents[evidence.id]).evidence).toMatchObject({
            id: evidence.id, fieldCandidate: "Price", value: 42, status: "extracted",
          })
          return { commit: false, value: undefined }
        })
      } finally {
        await store.dispose()
      }
    })
  })),
  { timeout: 180_000 },
)
