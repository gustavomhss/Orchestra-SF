import { expect, test } from "bun:test"
import { documentAsset, documentSourceCurrent } from "../../../../product/documents/source-fence.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"

test("document write fence uses the locked source incarnation and revision", () => {
  const digest = "a".repeat(64)
  const state = { documents: { "asset:doc": { schema: "sf-asset-v1", documentId: "doc", assetId: "asset", surface: "procurement", incarnation: "inc", revision: 2, blobDigest: digest } } } as unknown as SfProductState
  const snapshot: Snapshot = { data: {}, versions: {}, sequences: {}, audit: [], notices: [], sfSources: { schemaVersion: 1, records: { [JSON.stringify(["document-asset", "asset"])]: { incarnation: "inc", version: 2, alive: true, inputDigest: digest } } } }
  expect(documentAsset(state, "doc")?.surface).toBe("procurement")
  const identity = { incarnation: "inc", revision: 2, blobDigest: digest }
  expect(documentSourceCurrent(state, snapshot, "doc", identity, "procurement")).toBe(true)
  expect(documentSourceCurrent(state, snapshot, "doc", identity, "dashboard")).toBe(false)
  const replaced = structuredClone(snapshot)
  replaced.sfSources!.records[JSON.stringify(["document-asset", "asset"])]!.incarnation = "replacement"
  expect(documentSourceCurrent(state, replaced, "doc", identity, "procurement")).toBe(false)
  const changed = structuredClone(snapshot)
  changed.sfSources!.records[JSON.stringify(["document-asset", "asset"])]!.version++
  expect(documentSourceCurrent(state, changed, "doc", identity, "procurement")).toBe(false)
  expect(documentSourceCurrent(state, snapshot, "doc", { ...identity, blobDigest: "b".repeat(64) }, "procurement")).toBe(false)
})
