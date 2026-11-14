import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { object } from "../../../runtime/contract.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { createDocumentFixFixture } from "./document-fixture.ts"

test("D-OPS-01 two complete schema/extract submissions preserve the existing candidate and human confirmation", async () => {
  const fixture = await createDocumentFixFixture()
  try {
    const firstKey = randomUUID(), secondKey = randomUUID()
    const firstSchema = await fixture.schema(fixture.payload, firstKey)
    const first = await fixture.extract(firstSchema.ref)
    expect(first).toMatchObject({ fieldCandidate: "Price", value: 42, unit: "USD", status: "extracted" })
    const initial = await fixture.material()
    const secondSchema = await fixture.schema(fixture.payload, secondKey)
    const second = await fixture.extract(secondSchema.ref)
    expect(secondSchema).toEqual(firstSchema)
    expect(second).toEqual(first)
    expect(await fixture.material()).toMatchObject({ digest: initial.digest, schemas: 1, candidates: 1 })
    const response = await fixture.post("document-confirm", second)
    expect(response.status).toBe(200)
    const confirmed = decodeSfOperationOutput("sf_document_extract", (await response.json()).value)
    if (!confirmed.ok) throw new Error("Confirmed evidence output invalid")
    expect(confirmed.value).toMatchObject({ id: first.id, status: "confirmed", ref: { refId: first.ref.refId, target: { confirmationVersion: 1 } } })
    const preserved = await fixture.material()
    const thirdSchema = await fixture.schema(fixture.payload)
    expect(await fixture.extract(thirdSchema.ref)).toEqual(confirmed.value)
    expect(await fixture.material()).toMatchObject({ digest: preserved.digest, schemas: 1, candidates: 1 })
    // New schema submissions need one existing C08 operation receipt; schemas and
    // candidates remain unchanged. An exact request retry creates no further receipt.
    const beforeRetry = await fixture.material()
    expect(await fixture.schema(fixture.payload, secondKey)).toEqual(firstSchema)
    expect(await fixture.material()).toEqual(beforeRetry)
    for (const key of [firstKey, secondKey]) {
      const changed = await fixture.post("document-schema", { ...fixture.payload, fields: [{ id: "Price", type: "number", unit: "EUR" }] }, key)
      expect(changed.status).toBe(409)
      expect(await changed.json()).toMatchObject({ status: "conflict" })
      expect(await fixture.material()).toEqual(beforeRetry)
    }
  } finally { await fixture.dispose() }
}, 90_000)

test("D-OPS-01 historical duplicate definitions retain the candidate-bound schema and support legacy boolean receipts", async () => {
  const fixture = await createDocumentFixFixture()
  try {
    const key = randomUUID()
    const original = await fixture.schema(fixture.payload, key)
    const candidate = await fixture.extract(original.ref)
    // Reconstruct the old registry shape: one used schema, one unused equivalent
    // whose ID sorts first, and the old boolean value in the existing C08 receipt.
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1), documents = object(state.documents)
      const duplicateId = "schema_" + "0".repeat(40)
      documents["schema:" + duplicateId] = { ...structuredClone(object(documents["schema:" + original.id])), id: duplicateId }
      const receipt = Object.values(object(state.transactions)).map(object).find((entry) => object(entry.value).id === original.id)
      if (!receipt) throw new Error("Original schema transaction missing")
      receipt.value = true
      return { commit: true, value: undefined }
    })
    const before = await fixture.material()
    expect(await fixture.schema(fixture.payload, key)).toEqual(original)
    expect(await fixture.material()).toEqual(before)
    const reused = await fixture.schema(fixture.payload)
    expect(reused).toEqual(original)
    expect(await fixture.extract(reused.ref)).toEqual(candidate)
    expect(await fixture.material()).toMatchObject({ digest: before.digest, schemas: 2, candidates: 1 })
    // If the old operation-derived schema disappeared, its boolean receipt cannot
    // be interpreted as success for a different equivalent schema.
    await fixture.store.transaction("dashboard", async (snapshot) => {
      delete object(object(snapshot.data.__sfProductV1).documents)["schema:" + original.id]
      return { commit: true, value: undefined }
    })
    const deleted = await fixture.material()
    const rejected = await fixture.post("document-schema", fixture.payload, key)
    expect(rejected.status).toBe(409)
    expect(await fixture.material()).toEqual(deleted)
  } finally { await fixture.dispose() }
}, 90_000)

test("D-OPS-01 changed type, unit and explicit schema version remain conflicts without altering existing candidates", async () => {
  const fixture = await createDocumentFixFixture()
  try {
    const original = await fixture.schema(fixture.payload)
    const candidate = await fixture.extract(original.ref)
    for (const fields of [[{ id: "Price", type: "string" as const, unit: "USD" }], [{ id: "Price", type: "number" as const, unit: "EUR" }]]) {
      const changed = await fixture.schema({ ...fixture.payload, fields })
      expect(changed.id).not.toBe(original.id)
      const payload = { documentRef: fixture.documentRef, fieldSchemaRef: changed.ref }
      const before = await fixture.material()
      const refused = await fixture.uiCall("sf_document_extract", payload, (context) => fixture.documents.documents.extract(payload, context))
      expect(refused).toEqual({ status: "conflict", reason: "candidate-schema-conflict" })
      expect((await fixture.post("document-extract", payload)).status).toBe(503)
      expect(await fixture.material()).toEqual(before)
    }
    const reusedKey = randomUUID()
    expect(await fixture.schema(fixture.payload, reusedKey)).toEqual(original)
    const updateKey = randomUUID()
    const versioned = await fixture.schema({ ...fixture.payload, id: original.id, expectedVersion: 1 }, updateKey)
    expect(versioned).toMatchObject({ id: original.id, version: 2 })
    const input = { documentRef: fixture.documentRef, fieldSchemaRef: versioned.ref }
    const before = await fixture.material()
    expect(await fixture.uiCall("sf_document_extract", input, (context) => fixture.documents.documents.extract(input, context))).toEqual({ status: "conflict", reason: "candidate-schema-conflict" })
    expect((await fixture.post("document-extract", { ...input, fieldSchemaRef: original.ref })).status).not.toBe(200)
    const candidates = await fixture.documentRequest("document-candidates", undefined, { documentRef: fixture.documentRef })
    expect(candidates.status).toBe(200)
    expect((await candidates.json()).value).toEqual([candidate])
    expect(await fixture.material()).toEqual(before)
    // A prior re-use operation never advances to the new version merely because
    // the new definition happens to have identical fields.
    const retried = await fixture.post("document-schema", { ...fixture.payload, id: original.id, expectedVersion: 1 }, updateKey)
    expect(retried.status).toBe(200)
    expect((await retried.json()).value).toEqual(versioned)
    expect((await fixture.post("document-schema", fixture.payload, reusedKey)).status).toBe(409)
    expect(await fixture.material()).toEqual(before)
  } finally { await fixture.dispose() }
}, 90_000)

test("D-OPS-01 physical source replacement denies schema reuse and extraction replay", async () => {
  const fixture = await createDocumentFixFixture()
  try {
    const schemaKey = randomUUID(), extractKey = randomUUID()
    const schema = await fixture.schema(fixture.payload, schemaKey)
    const candidate = await fixture.extract(schema.ref, extractKey)
    const beforeIdentity = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", "operations-document") }))
    // A physical remove/re-create with identical text must not revive old references.
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.assets = []
      object(object(object(object(snapshot.data.store).requests).r1).request).attachments = []
      return { commit: true, value: undefined }
    })
    const missing = await fixture.post("document-schema", fixture.payload, schemaKey)
    expect(missing.status).not.toBe(200)
    const { uploadAsset } = await import("../../../runtime/assets.ts")
    const replaced = await fixture.store.transaction("procurement", async (snapshot, blobs) => {
      const result = await uploadAsset(snapshot, blobs, { id: fixture.principal.id, roles: ["buyer"], canWrite: true, assigned: [], domains: [] },
        { page: "Requests", action: "upload", id: "r1", version: snapshot.versions["requests:r1"]?.version ?? 0, values: {} },
        { at: fixture.at, id: () => "operations-document", directory: [] }, fixture.runtime.assets.services, "quote", { name: "quote.txt", type: "text/plain", bytes: fixture.bytes })
      return { commit: result.ok, value: result }
    })
    expect(replaced.ok).toBe(true)
    const afterIdentity = await fixture.store.transaction("procurement", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "document-asset", "operations-document") }))
    expect(afterIdentity?.incarnation).not.toBe(beforeIdentity?.incarnation)
    const before = await fixture.material()
    expect((await fixture.post("document-schema", fixture.payload, schemaKey)).status).not.toBe(200)
    expect((await fixture.post("document-extract", { documentRef: fixture.documentRef, fieldSchemaRef: schema.ref }, extractKey)).status).not.toBe(200)
    expect((await fixture.documentRequest("document-open", undefined, { ref: JSON.stringify(candidate.ref) })).status).not.toBe(200)
    expect(await fixture.material()).toEqual(before)
  } finally { await fixture.dispose() }
}, 90_000)


test("D-OPS-01 revoked credentials deny replay while the original source and schema remain current", async () => {
  const fixture = await createDocumentFixFixture()
  try {
    const schemaKey = randomUUID(), extractKey = randomUUID()
    const schema = await fixture.schema(fixture.payload, schemaKey)
    const candidate = await fixture.extract(schema.ref, extractKey)
    expect((await fixture.documentRequest("document-open", undefined, { ref: JSON.stringify(candidate.ref) })).status).toBe(200)
    const before = await fixture.material()
    const revoked = await fixture.identity.handle(new Request(fixture.origin + "/sucafina/auth/logout", { method: "POST", headers: { cookie: fixture.cookie, origin: fixture.origin } }))
    expect(revoked?.status).toBe(204)
    expect((await fixture.post("document-schema", fixture.payload, schemaKey)).status).toBe(403)
    expect((await fixture.post("document-extract", { documentRef: fixture.documentRef, fieldSchemaRef: schema.ref }, extractKey)).status).toBe(403)
    expect((await fixture.documentRequest("document-open", undefined, { ref: JSON.stringify(candidate.ref) })).status).toBe(403)
    expect(await fixture.material()).toEqual(before)
  } finally { await fixture.dispose() }
}, 60_000)
