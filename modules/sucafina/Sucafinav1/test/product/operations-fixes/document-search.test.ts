import { expect, test } from "bun:test"
import { object, rows } from "../../../runtime/contract.ts"
import { createDocumentSearchFixture } from "./document-search-fixture.ts"

test("OPS-REV-03 real HTTP search reaches B after A's index and 100 extracted fields, including candidate-only storage and revoked A", async () => {
  const fixture = await createDocumentSearchFixture()
  try {
    const fields = Array.from({ length: 100 }, (_, index) => ({ id: `Field${String(index).padStart(3, "0")}`, type: "number" as const }))
    const a = await fixture.upload("search-a", fields.map((field, index) => `${field.id}: ${index + 1}`).join("\n"))
    await fixture.extract(a, fields)
    const candidates = await fixture.documentRequest("document-candidates", undefined, { documentRef: a })
    expect(candidates.status).toBe(200)
    expect((await candidates.json()).value).toHaveLength(100)
    const b = await fixture.upload("search-b", "Token: NEEDLE_B")
    await fixture.extract(b, [{ id: "Token", type: "string" }])
    const currentA = await fixture.search({ query: "Field099", documentRefs: [a], limit: 10 })
    expect(currentA.matches).toHaveLength(1)
    expect(currentA.matches[0]).toMatchObject({ documentRef: { target: { documentId: a } } })
    const query = { query: "NEEDLE_B", limit: 10 }
    const baseline = await fixture.search({ ...query, documentRefs: [b] })
    expect(baseline.matches).toHaveLength(1)
    expect(baseline.matches[0]).toMatchObject({ text: "NEEDLE_B", documentRef: { target: { documentId: b } } })
    expect(baseline.limitations).toEqual(["lexical-exact-match"])
    expect(await fixture.search(query)).toEqual(baseline)
    expect(await fixture.search({ ...query, documentRefs: [a, b] })).toEqual(baseline)
    expect(await fixture.search({ query: "NOT_IN_EITHER_SOURCE", limit: 10 })).toEqual({ matches: [], limitations: ["lexical-exact-match"] })

    // Historical candidate-only storage has no index to hide the original defect.
    await fixture.editRecords((documents) => Object.fromEntries(Object.entries(documents).filter(([, value]) =>
      !(object(value).schema === "sf-document-index-v1" && [a, b].includes(String(object(object(value).snapshot).documentRef))))))
    const candidateOnly = await fixture.search({ ...query, documentRefs: [a, b] })
    expect(candidateOnly.matches).toHaveLength(1)
    expect(candidateOnly.matches[0]).toMatchObject({ text: "NEEDLE_B", documentRef: { refId: baseline.matches[0]!.documentRef.refId, target: { documentId: b } } })
    expect(candidateOnly.limitations).toEqual(baseline.limitations)

    // Withdraw the source while leaving its 100 persisted candidates before B.
    await fixture.store.transaction("procurement", async (snapshot) => {
      snapshot.data.assets = rows(snapshot.data.assets).filter((asset) => asset.id !== a)
      const request = object(object(object(snapshot.data.store).requests).r1).request
      if (!request || typeof request !== "object") throw new Error("Search fixture Request missing")
      const row = object(request)
      row.attachments = rows(row.attachments).filter((asset) => asset.id !== a)
      return { commit: true, value: undefined }
    })
    expect(await fixture.search(query)).toEqual(candidateOnly)
    expect(await fixture.search({ query: "Field099", limit: 10 })).toEqual({ matches: [], limitations: ["lexical-exact-match"] })
  } finally { await fixture.dispose() }
}, 120_000)
