import { memoryStore, openRevision, parseSource, withStore } from "@orchestra/rag-studio"
import { uploadAsset } from "../../../runtime/assets.ts"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { SfDocumentReadPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { KnowledgeSearchRequest } from "../../../product/contracts/operations.ts"
import type { DocumentSchemaInput } from "../../../product/documents/schemas.ts"
import type { StoredDocumentIndex } from "../../../product/documents/index.ts"
import { createSfDocumentEvidenceAdapter } from "../../../product/documents/rag-adapter.ts"
import { searchDocumentEvidence } from "../../../product/documents/capabilities.ts"
import { createWp06Runtime } from "../wp06/runtime-fixture.ts"

export async function createDocumentSearchFixture() {
  const fixture = await createWp06Runtime()
  try {
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", uploadCap: 100_000 }, requests: {
        r1: { request: { number: "r1", status: "sourcing", createdBy: fixture.principal.id, pr: { title: "Search sources", estAmount: 42 }, history: [] } },
      } }
      return { commit: true, value: undefined }
    })
    const upload = async (id: string, text: string) => {
      const result = await fixture.store.transaction("procurement", async (snapshot, blobs) => {
        const value = await uploadAsset(snapshot, blobs, { id: fixture.principal.id, roles: ["buyer"], canWrite: true, assigned: [], domains: [] },
          { page: "Requests", action: "upload", id: "r1", version: snapshot.versions["requests:r1"]?.version ?? 0, values: {} },
          { at: fixture.at, id: () => id, directory: [] }, fixture.runtime.assets.services, "quote", { name: `${id}.txt`, type: "text/plain", bytes: new TextEncoder().encode(text) })
        return { commit: value.ok, value }
      })
      if (!result.ok) throw new Error("Search fixture upload failed")
      const response = await fixture.documentRequest("document-sources")
      const sources = await response.json() as { value: { selectionRef: string; label: string }[] }
      const selected = sources.value?.find((source) => source.label === `${id}.txt`)
      if (response.status !== 200 || !selected) throw new Error("Search fixture discovery failed")
      const admission = await fixture.documentRequest("document-admit", { selectionRef: selected.selectionRef })
      const admitted = await admission.json() as { value: { documentRef: string } }
      if (admission.status !== 200 || admitted.value.documentRef !== id) throw new Error("Search fixture admission failed")
      return admitted.value.documentRef
    }
    const extract = async (documentRef: string, fields: DocumentSchemaInput["fields"]) => {
      const response = await fixture.documentRequest("document-schema", { documentRef, fields })
      const schema = await response.json() as { value: { ref: string } }
      if (response.status !== 200) throw new Error("Search fixture schema failed")
      const extracted = await fixture.documentRequest("document-extract", { documentRef, fieldSchemaRef: schema.value.ref })
      if (extracted.status !== 200) throw new Error("Search fixture extraction failed: " + JSON.stringify(await extracted.json()))
    }
    const search = async (input: KnowledgeSearchRequest) => {
      const response = await fixture.documentRequest("document-search", input)
      const body = await response.json()
      const decoded = decodeSfOperationOutput("sf_knowledge_search", body.value)
      if (response.status !== 200 || !decoded.ok) throw new Error("Search fixture query failed: " + JSON.stringify(body))
      return decoded.value
    }
    const editRecords = (change: (documents: Record<string, unknown>) => Record<string, unknown>) => fixture.store.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1)
      if (state.schemaVersion !== 1) throw new Error("Search fixture product state missing")
      state.documents = change(object(state.documents))
      return { commit: true, value: undefined }
    })
    return { ...fixture, upload, extract, search, editRecords }
  } catch (error) {
    await fixture.dispose()
    throw error
  }
}

/** Synthetic byte policy avoids admitting 101 attachments. SQLite/authority, text
 * extraction, RAG indexing, evidence adapter, resolver and search remain real.
 * This fixture proves the search budget and egress, not native ACL qualification. */
export async function createDocumentBudgetFixture() {
  const fixture = await createDocumentSearchFixture()
  try {
    await fixture.upload("budget-anchor", "Anchor: 1")
    const binding = await fixture.uiCall("sf_knowledge_search", { query: "anchor", limit: 10 }, async (context) => context.binding)
    const entries = new Map<string, { index: StoredDocumentIndex; bytes: Uint8Array; principalRef: string; revoked: boolean }>()
    const allowed = (id: string, context: TrustedDomainContext) => {
      const entry = entries.get(id)
      return entry && !entry.revoked && entry.principalRef === context.binding.principalRef &&
        entry.index.installationId === context.binding.installationId && entry.index.projectId === context.binding.projectId ? entry : undefined
    }
    const documents: SfDocumentReadPort = {
      read: async (id, context) => {
        const entry = allowed(id, context)
        if (!entry) return { status: "denied", reason: "document-access-unavailable" }
        const snapshot = entry.index.snapshot
        return { status: "ok", value: { documentId: id, incarnation: snapshot.incarnation, revision: snapshot.revision,
          fileName: `${id}.txt`, mediaType: "text/plain", blobDigest: { algorithm: "sha256", value: snapshot.blobDigest }, bytes: entry.bytes } }
      },
      revalidate: async (id, identity, context) => {
        const entry = allowed(id, context)
        return !!entry && entry.index.snapshot.incarnation === identity.incarnation && entry.index.snapshot.revision === identity.revision &&
          entry.index.snapshot.blobDigest === identity.blobDigest && new Bun.CryptoHasher("sha256").update(entry.bytes).digest("hex") === identity.blobDigest
      },
    }
    const reader = createSfDocumentEvidenceAdapter(async (id, context) => {
      const entry = allowed(id, context)
      return entry ? { status: "ok", snapshot: entry.index.snapshot } : { status: "denied", accessRevision: context.binding.accessRevision }
    }, documents, fixture.documents.documents.evidenceHost.parser)
    const add = async (id: string, text: string, access: "allowed" | "revoked" | "other-principal" | "other-installation" | "other-project" = "allowed") => {
      const bytes = new TextEncoder().encode(text)
      const store = memoryStore({ projectRoot: "/sf-project" })
      const file = `/sf-authorized/${id}.txt`, sourceId = `source-${id}`, locationId = "budget-location"
      store.writeFile(file, text)
      store.putSource({ id: sourceId, locationId, path: file, contentHash: "", status: "not_yet_read", text: "" })
      const ragRevision = await withStore(store, async () => { await parseSource(sourceId); return openRevision(locationId) })
      const index: StoredDocumentIndex = { schema: "sf-document-index-v1",
        installationId: access === "other-installation" ? "other-installation" : binding.installationId,
        projectId: access === "other-project" ? "other-project" : binding.projectId,
        snapshot: { documentRef: id, accessRevision: binding.accessRevision, locationId, incarnation: `incarnation-${id}`, revision: 1,
          blobDigest: new Bun.CryptoHasher("sha256").update(bytes).digest("hex"), source: store.sources()[0]!, chunks: store.chunks(), ragRevision } }
      entries.set(id, { index, bytes, principalRef: access === "other-principal" ? fixture.otherPrincipal.id : binding.principalRef, revoked: access === "revoked" })
      return id
    }
    const select = (ids: readonly string[]) => fixture.editRecords(() => Object.fromEntries(ids.map((id) => {
      const entry = entries.get(id)
      if (!entry) throw new Error("Budget fixture entry missing")
      return [`document-index:${digestSfValue([entry.index.installationId, entry.index.projectId, id])}`, entry.index]
    })))
    const revoke = (id: string) => {
      const entry = entries.get(id)
      if (!entry) throw new Error("Budget fixture source missing")
      entry.revoked = true
    }
    const search = (query: string, revokeAtEgress?: string) => {
      const input = { query, limit: 10 }
      return fixture.uiCall("sf_knowledge_search", input, (context) => searchDocumentEvidence(input, context, {
        ...fixture.documents.documents.evidenceHost, documents,
        reader: async (id, call, candidateId, ref) => {
          const result = await reader(id, call, candidateId, ref)
          if (result.status !== "ok" || id !== revokeAtEgress) return result
          let validations = 0
          // Mutate the real byte policy on the returned handle's egress fence;
          // all document parsing and evidence verification still use the real reader.
          return { ...result, revalidate: async () => { if (++validations === 2) revoke(id); return result.revalidate() } }
        },
      }))
    }
    return { add, select, search, revoke, dispose: fixture.dispose }
  } catch (error) {
    await fixture.dispose()
    throw error
  }
}
