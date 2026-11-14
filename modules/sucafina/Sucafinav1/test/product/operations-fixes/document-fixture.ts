import { randomUUID } from "node:crypto"
import { uploadAsset } from "../../../runtime/assets.ts"
import { object } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { DocumentSchemaInput } from "../../../product/documents/schemas.ts"
import { createWp06Runtime } from "../wp06/runtime-fixture.ts"

/** Real SQLite, source lifecycle, human/UI authority, schemas, parser and document HTTP. */
export async function createDocumentFixFixture() {
  const fixture = await createWp06Runtime()
  try {
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", uploadCap: 100_000 }, requests: {
        r1: { request: { number: "r1", status: "sourcing", createdBy: fixture.principal.id, pr: { title: "Quote", estAmount: 42 }, history: [] } },
      } }
      return { commit: true, value: undefined }
    })
    const bytes = new TextEncoder().encode("Price: 42\nActive: true")
    const uploaded = await fixture.store.transaction("procurement", async (snapshot, blobs) => {
      const result = await uploadAsset(snapshot, blobs, { id: fixture.principal.id, roles: ["buyer"], canWrite: true, assigned: [], domains: [] },
        { page: "Requests", action: "upload", id: "r1", version: snapshot.versions["requests:r1"]?.version ?? 0, values: {} },
        { at: fixture.at, id: () => "operations-document", directory: [] }, fixture.runtime.assets.services, "quote", { name: "quote.txt", type: "text/plain", bytes })
      return { commit: result.ok, value: result }
    })
    if (!uploaded.ok) throw new Error("Real attachment upload failed")
    const sources = await (await fixture.documentRequest("document-sources")).json() as { value: { selectionRef: string }[] }
    if (sources.value.length !== 1) throw new Error("Real attachment discovery failed")
    const admitted = await fixture.documentRequest("document-admit", { selectionRef: sources.value[0]!.selectionRef })
    if (admitted.status !== 200) throw new Error("Real attachment admission failed")
    const documentRef = ((await admitted.json()) as { value: { documentRef: string } }).value.documentRef
    const payload: DocumentSchemaInput = { documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] }
    const post = async (mode: string, payload: unknown, key = randomUUID(), cookie = fixture.cookie) => {
      const response = await fixture.documentHttp(new Request(fixture.origin + "/sucafina/procurement?sf=" + mode, {
        method: "POST", headers: { cookie, origin: fixture.origin, "Content-Type": "application/json", "Idempotency-Key": key }, body: JSON.stringify(payload),
      }), "procurement")
      if (!response) throw new Error("Real document route did not handle the request")
      return response
    }
    const schema = async (payload: DocumentSchemaInput, key = randomUUID()) => {
      const response = await post("document-schema", payload, key)
      const result = await response.json() as { status: string; value: { id: string; ref: string; version: number; fields: DocumentSchemaInput["fields"] } }
      if (response.status !== 200 || result.status !== "ok") throw new Error("Real schema registration failed: " + JSON.stringify(result))
      return result.value
    }
    const extract = async (fieldSchemaRef: string, key = randomUUID()) => {
      const response = await post("document-extract", { documentRef, fieldSchemaRef }, key)
      const result = await response.json()
      const decoded = decodeSfOperationOutput("sf_document_extract", result.value)
      if (response.status !== 200 || !decoded.ok) throw new Error("Real extraction failed: " + JSON.stringify(result))
      return decoded.value
    }
    const material = () => fixture.store.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1), documents = object(state.documents)
      return { commit: false, value: {
        digest: digestSfValue(documents), schemas: Object.values(documents).filter((row) => object(row).schema === "sf-field-schema-v1").length,
        candidates: Object.values(documents).filter((row) => object(row).schema === "sf-document-v1").length,
        version: object(state.versions).documents, transactions: digestSfValue(state.transactions),
      } }
    })
    return { ...fixture, documentRef, payload, bytes, post, schema, extract, material }
  } catch (error) {
    await fixture.dispose()
    throw error
  }
}

