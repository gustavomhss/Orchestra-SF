import { expect, test } from "bun:test"
import { uploadAsset } from "../../../../runtime/assets.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"

test("independent authorized extractions reuse the same candidates and preserve human confirmation without duplicate writes", async () => {
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
        { at: fixture.at, id: () => "reuse-asset", directory: [] }, fixture.runtime.assets.services, "quote", { name: "quote.txt", type: "text/plain", bytes })
      return { commit: result.ok, value: result }
    })
    expect(uploaded.ok).toBe(true)
    const sources = await (await fixture.documentRequest("document-sources")).json() as { value: { selectionRef: string }[] }
    expect(sources.value).toHaveLength(1)
    const admitted = await fixture.documentRequest("document-admit", { selectionRef: sources.value[0]!.selectionRef })
    expect(admitted.status).toBe(200)
    const documentRef = ((await admitted.json()) as { value: { documentRef: string } }).value.documentRef
    const schema = await fixture.documentRequest("document-schema", { documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }, { id: "Active", type: "boolean" }] })
    expect(schema.status).toBe(200)
    const fieldSchemaRef = ((await schema.json()) as { value: { ref: string } }).value.ref
    const input = { documentRef, fieldSchemaRef }
    const extract = async () => {
      const response = await fixture.documentRequest("document-extract", input)
      expect(response.status).toBe(200)
      const decoded = decodeSfOperationOutput("sf_document_extract", (await response.json()).value)
      if (!decoded.ok) throw new Error("Extraction output unavailable")
      return decoded.value
    }
    const first = await extract()
    expect(first).toMatchObject({ status: "extracted", fieldCandidate: "Price", value: 42, unit: "USD" })
    const namespace = () => fixture.authority.state.read(fixture.request(), "documents", (state) => digestSfValue(state.documents))
    const beforeReuse = await namespace()
    expect(beforeReuse.status).toBe("ok")
    if (beforeReuse.status !== "ok") throw new Error("Document namespace unavailable")
    expect(await extract()).toEqual(first)
    const afterReuse = await namespace()
    expect(afterReuse.status).toBe("ok")
    if (afterReuse.status !== "ok") throw new Error("Document namespace unavailable")
    expect(afterReuse.value).toBe(beforeReuse.value)
    expect(afterReuse.storageVersion).toBe(beforeReuse.storageVersion)
    const confirmation = await fixture.documentRequest("document-confirm", first)
    expect(confirmation.status).toBe(200)
    const confirmed = decodeSfOperationOutput("sf_document_extract", (await confirmation.json()).value)
    if (!confirmed.ok) throw new Error("Confirmation output unavailable")
    expect(confirmed.value).toMatchObject({ status: "confirmed", id: first.id, ref: { refId: first.ref.refId, target: { confirmationVersion: 1 } } })
    const confirmedState = await namespace()
    expect(confirmedState.status).toBe("ok")
    if (confirmedState.status !== "ok") throw new Error("Confirmed namespace unavailable")
    expect(await extract()).toEqual(confirmed.value)
    const afterConfirmationReuse = await namespace()
    expect(afterConfirmationReuse.status).toBe("ok")
    if (afterConfirmationReuse.status !== "ok") throw new Error("Confirmed namespace unavailable")
    expect(afterConfirmationReuse.value).toBe(confirmedState.value)
    expect(afterConfirmationReuse.storageVersion).toBe(confirmedState.storageVersion)
    const candidates = await fixture.uiCall("sf_document_extract", input, (call) => fixture.documents.documents.list(documentRef, call))
    expect(candidates.status).toBe("ok")
    if (candidates.status !== "ok") throw new Error("Candidate list unavailable")
    expect(candidates.value).toHaveLength(2)
    expect(candidates.value.map((value) => value.status)).toEqual(["confirmed", "extracted"])
    const different = await fixture.documentRequest("document-schema", { documentRef, fields: [{ id: "Price", type: "number", unit: "EUR" }, { id: "Active", type: "boolean" }] })
    expect(different.status).toBe(200)
    const conflictingInput = { documentRef, fieldSchemaRef: ((await different.json()) as { value: { ref: string } }).value.ref }
    const unchanged = await namespace()
    expect(unchanged.status).toBe("ok")
    if (unchanged.status !== "ok") throw new Error("Document namespace unavailable")
    const conflict = await fixture.uiCall("sf_document_extract", conflictingInput, (call) => fixture.documents.documents.extract(conflictingInput, call))
    expect(conflict).toEqual({ status: "conflict", reason: "candidate-schema-conflict" })
    const afterConflict = await namespace()
    expect(afterConflict.status).toBe("ok")
    if (afterConflict.status !== "ok") throw new Error("Document namespace unavailable")
    expect(afterConflict.value).toBe(unchanged.value)
    expect(afterConflict.storageVersion).toBe(unchanged.storageVersion)
    await fixture.store.transaction("procurement", async (_, blobs) => {
      await blobs.put("quote/r1/reuse-asset", new TextEncoder().encode("Price: 99\nActive: true"), "text/plain")
      return { commit: true, value: undefined }
    })
    const changed = await fixture.documentRequest("document-extract", input)
    expect(changed.status).toBe(409)
    const changedBody = await changed.json()
    expect(changedBody).toMatchObject({ status: "stale" })
    expect(JSON.stringify(changedBody)).not.toContain(first.ref.refId)
    const open = await fixture.documentRequest("document-open", undefined, { ref: JSON.stringify(confirmed.value.ref) })
    expect(open.status).toBe(409)
  } finally { await fixture.dispose() }
}, 120_000)
