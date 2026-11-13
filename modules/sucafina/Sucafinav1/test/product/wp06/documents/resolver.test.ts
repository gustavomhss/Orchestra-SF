import { expect, test } from "bun:test"
import { memoryStore, openRevision, parseSource, withStore } from "@orchestra/rag-studio"
import { digestSfEvidenceRef } from "../../../../product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfDocumentEvidenceAdapter } from "../../../../product/documents/rag-adapter.ts"
import { resolveSfDocumentEvidence } from "../../../../product/documents/evidence-resolver.ts"
import { createPrivateDocumentParser } from "../../../../product/documents/parser.ts"

test("document evidence resolves only while source bytes and access remain current", async () => {
  const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v", requestId: "r", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedDomainContext
  const text = "Price: 42"
  const bytes = new TextEncoder().encode(text)
  const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  const store = memoryStore({ projectRoot: "/project" })
  store.writeFile("/document.txt", text)
  store.putSource({ id: "source", locationId: "location", path: "/document.txt", contentHash: "", status: "not_yet_read", text: "" })
  const revision = await withStore(store, async () => { await parseSource("source"); return openRevision("location") })
  const ref = { schema: "sf-evidence-v1" as const, refId: "ref", installationId: "i", projectId: "p", kind: "document" as const, evidenceLevel: "claim" as const, refDigest: "", target: { documentId: "doc", incarnation: "inc", revision: 1, blobDigest: { algorithm: "sha256" as const, value: digest }, ragSourceId: "source", ragRevisionId: revision.id, ragSourceHash: { algorithm: "blake3" as const, value: store.sources()[0].contentHash }, segment: { start: 7, end: 9, unit: "utf16" as const, textDigest: { algorithm: "sha256" as const, value: new Bun.CryptoHasher("sha256").update("42").digest("hex") } } } }
  const sealed = { ...ref, refDigest: digestSfEvidenceRef(ref) }
  let allowed = true
  const port = { read: async () => ({ status: "ok" as const, value: { documentId: "doc", incarnation: "inc", revision: 1, fileName: "a.txt", mediaType: "text/plain" as const, blobDigest: { algorithm: "sha256" as const, value: digest }, bytes } }), revalidate: async () => allowed }
  const reader = createSfDocumentEvidenceAdapter(async () => ({ status: "ok", snapshot: { documentRef: "doc", accessRevision: "a", locationId: "location", incarnation: "inc", revision: 1, blobDigest: digest, source: store.sources()[0], chunks: store.chunks(), ragRevision: revision } }), port, createPrivateDocumentParser({ maxBytes: 100, maxTextLength: 100, maxPages: 1, maxXmlBytes: 1000, maxZipEntries: 10 }))
  expect((await resolveSfDocumentEvidence(sealed, context, reader)).state).toBe("fresh")
  expect((await resolveSfDocumentEvidence({ ...sealed, refDigest: "forged" }, context, reader)).state).toBe("invalid")
  allowed = false
  expect((await resolveSfDocumentEvidence(sealed, context, reader)).state).not.toBe("fresh")
})
