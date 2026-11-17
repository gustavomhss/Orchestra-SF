import { expect, test } from "bun:test"
import { uploadAsset } from "../../../../runtime/assets.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"

// The fixture has real product authority and persisted state, but an in-memory
// test scanner. This test does NOT qualify the deployment's ClamD integration.
test("WS3 human rejection persists reason/page, forbids confirmation and prevents re-extraction", async () => {
  const fixture = await createWp06Runtime({ additionalHumanActions: ["documents.reject"] })
  try {
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { settings: { currency: "USD", uploadCap: 100_000 }, requests: {
        r1: { request: { number: "r1", status: "sourcing", createdBy: fixture.principal.id, pr: { title: "Review" }, history: [] } },
      } }
      return { commit: true, value: undefined }
    })
    const uploaded = await fixture.store.transaction("procurement", async (snapshot, blobs) => {
      const result = await uploadAsset(snapshot, blobs,
        { id: fixture.principal.id, roles: ["buyer"], canWrite: true, assigned: [], domains: [] },
        { page: "Requests", action: "upload", id: "r1",
          version: snapshot.versions["requests:r1"]?.version ?? 0, values: {} },
        { at: fixture.at, id: () => "ws3-asset", directory: [] },
        fixture.runtime.assets.services, "quote",
        { name: "ws3.txt", type: "text/plain", bytes: new TextEncoder().encode("Price: 42") })
      return { commit: result.ok, value: result }
    })
    expect(uploaded.ok).toBe(true)
    const sources = await (await fixture.documentRequest("document-sources")).json()
    expect(sources.value).toHaveLength(1)
    const admitted = await fixture.documentRequest("document-admit",
      { selectionRef: sources.value[0].selectionRef })
    expect(admitted.status).toBe(200)
    const documentRef = (await admitted.json()).value.documentRef
    const schema = await fixture.documentRequest("document-schema",
      { documentRef, fields: [{ id: "Price", type: "number", unit: "USD" }] })
    expect(schema.status).toBe(200)
    const fieldSchemaRef = (await schema.json()).value.ref
    const extraction = await fixture.documentRequest("document-extract",
      { documentRef, fieldSchemaRef })
    expect(extraction.status).toBe(200)
    const candidate = (await extraction.json()).value
    expect(candidate).toMatchObject({ status: "extracted", value: 42 })
    const invalidReview = { action: "reject", evidence: candidate,
      reason: "Contradição documental", page: 0 }
    expect((await fixture.documentRequest("document-confirm", invalidReview)).status).toBe(400)
    const review = { ...invalidReview, page: 1 }
    expect((await fixture.documentRequest("document-confirm", review, {}, "")).status).toBe(403)
    const refused = await fixture.documentRequest("document-confirm", review)
    expect(refused.status).toBe(200)
    expect(await refused.json()).toMatchObject({ status: "ok", value: {
      id: candidate.id, status: "rejected",
      rejection: { reason: review.reason, page: 1 },
    } })
    const candidates = await fixture.documentRequest("document-candidates", undefined, { documentRef })
    expect(candidates.status).toBe(200)
    expect((await candidates.json()).value).toContainEqual(expect.objectContaining({
      id: candidate.id, status: "rejected", rejection: { reason: review.reason, page: 1 },
    }))
    const after = await fixture.authority.state.read(fixture.request(), "documents",
      (state) => state.documents[candidate.id])
    expect(after.status).toBe("ok")
    expect(after.status === "ok" ? after.value : undefined).toMatchObject({
      evidence: { status: "rejected", rejection: { reason: review.reason, page: 1 } },
    })
    expect((await fixture.documentRequest("document-confirm", candidate)).status).toBe(409)
    expect((await fixture.documentRequest("document-extract", { documentRef, fieldSchemaRef })).status).toBe(409)
    const afterFailed = await fixture.authority.state.read(fixture.request(), "documents",
      (state) => state.documents[candidate.id])
    expect(afterFailed).toEqual(after)
  } finally { await fixture.dispose() }
})
