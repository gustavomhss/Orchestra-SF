import { expect, test } from "bun:test"
import { memoryStore, openRevision, parseSource, withStore } from "@orchestra/rag-studio"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { DocumentEvidence } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiLease } from "../../../product/contracts/sf-execution.ts"
import { createSfDocumentEvidenceAdapter } from "../../../product/documents/rag-adapter.ts"
import { createPrivateDocumentParser } from "../../../product/documents/parser.ts"
import { createSfDocumentSourceAccess } from "../../../product/decision-memory/source-access.ts"

const call: TrustedDomainContext = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "alice", requestId: "r", policyVersion: "1", accessRevision: "1", expiresAt: "2099-01-01T00:00:00Z" }, lease: {} as TrustedUiLease }

test("document memory egress requires the current confirmed candidate and access", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-document-evidence-"))
  const local = await openLocalStore(directory, { lockTimeoutMs: 500 })
  try {
    const persistence = createSfSourcePersistence({ persistence: local, createId: randomUUID, enumerate: enumerateSfSources })
    const session = { active: true }
    const host: DomainPortHost = { persistence, requestFor: () => new Request("https://example.test"), revalidate: async () => session.active && await local.transaction("dashboard", async () => ({ commit: false, value: true })), environment: async () => ({ at: "2026-11-13T12:00:00Z", id: randomUUID, directory: [] }), authenticate: async () => null }
    const text = "Price: 42"
    const bytes = new TextEncoder().encode(text)
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const store = memoryStore({ projectRoot: "/project" })
    store.writeFile("/document.txt", text)
    store.putSource({ id: "source", locationId: "location", path: "/document.txt", contentHash: "", status: "not_yet_read", text: "" })
    const revision = await withStore(store, async () => { await parseSource("source"); return openRevision("location") })
    const ref = { schema: "sf-evidence-v1" as const, refId: "candidate", installationId: "i", projectId: "p", kind: "document" as const, evidenceLevel: "claim" as const, refDigest: "", target: { documentId: "doc", incarnation: "inc", revision: 1, blobDigest: { algorithm: "sha256" as const, value: digest }, ragSourceId: "source", ragRevisionId: revision.id, ragSourceHash: { algorithm: "blake3" as const, value: store.sources()[0].contentHash }, fieldCandidateId: "candidate", segment: { start: 7, end: 9, unit: "utf16" as const, textDigest: { algorithm: "sha256" as const, value: new Bun.CryptoHasher("sha256").update("42").digest("hex") } } } }
    const sealed = { ...ref, refDigest: digestSfEvidenceRef(ref) }
    const evidence: DocumentEvidence = { id: "candidate", fileRef: "doc", version: 1, location: "location", textRange: { start: 7, end: 9, unit: "utf16" }, fieldCandidate: "price", value: 42, status: "confirmed", ref: sealed }
    const state = { evidence, allowed: true }
    const port = { read: async () => ({ status: "ok" as const, value: { documentId: "doc", incarnation: "inc", revision: 1, fileName: "a.txt", mediaType: "text/plain" as const, blobDigest: { algorithm: "sha256" as const, value: digest }, bytes } }), revalidate: async () => state.allowed }
    const reader = createSfDocumentEvidenceAdapter(async () => ({ status: "ok", snapshot: { evidence: state.evidence, documentRef: "doc", accessRevision: "1", locationId: "location", incarnation: "inc", revision: 1, blobDigest: digest, source: store.sources()[0], chunks: store.chunks(), ragRevision: revision } }), port, createPrivateDocumentParser({ maxBytes: 100, maxTextLength: 100, maxPages: 1, maxXmlBytes: 1000, maxZipEntries: 10 }))
    const access = createSfDocumentSourceAccess({ host, read: reader })
    const fresh = await access(sealed, call)
    expect(fresh.state).toBe("fresh")
    expect(fresh.currentRef).toEqual(sealed)
    state.evidence = { ...evidence, status: "extracted" }
    expect((await access(sealed, call)).state).toBe("unavailable")
    state.evidence = { ...evidence, id: "other" }
    expect((await access(sealed, call)).state).toBe("unavailable")
    state.evidence = evidence
    const unbound = { ...sealed, target: { ...sealed.target, fieldCandidateId: undefined }, refDigest: "" }
    expect((await access({ ...unbound, refDigest: digestSfEvidenceRef(unbound) }, call)).state).toBe("unavailable")
    state.allowed = false
    expect((await access(sealed, call)).state).toBe("unavailable")
    state.allowed = true
    session.active = false
    expect((await access(sealed, call)).state).toBe("unavailable")
  } finally { await local.dispose(); await rm(directory, { recursive: true, force: true }) }
})
