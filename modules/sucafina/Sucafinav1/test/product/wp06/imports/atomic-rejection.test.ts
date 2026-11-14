import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { importHostFixture } from "./host-fixture.ts"

const mixed = [
  ["owned", "Licenses", "owned", "USD", "Forecast", 0],
  ["foreign", "Licenses", "foreign", "USD", "Forecast", 200],
]

test("the real import host rejects a mixed-owner workbook preview without domain writes", async () => {
  const app = await importHostFixture()
  try {
    app.policy.role = "budget owner"
    const before = await app.read()
    expect(await app.prepare(mixed)).toMatchObject({ status: "denied", reason: "planner-command-rejected" })
    expect(await app.read()).toEqual(before)
    const stored = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.__sfProductV1 as { documents: Record<string, unknown>; receipts: Record<string, unknown> } }))
    expect(Object.keys(stored.documents).filter((key) => key.startsWith("import-preview:"))).toEqual([])
    expect(stored.receipts).toEqual({})
  } finally { await app.close() }
})

test("a later-row domain refusal after preview has a rejected summary and no partial Apply", async () => {
  const app = await importHostFixture()
  try {
    const preview = await app.prepare(mixed)
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") throw new Error(preview.reason)
    const selection = { manifestId: preview.value.id, version: preview.value.version }
    const before = await app.read()
    app.policy.role = "budget owner"
    expect(await app.apply(selection)).toMatchObject({ status: "denied", reason: "import-rejected" })
    expect(await app.read()).toEqual(before)
    const settled = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const state = settled.data.__sfProductV1 as { documents: Record<string, unknown>; receipts: Record<string, unknown> }
    expect(state.receipts).toEqual({})
    const rejections = Object.entries(state.documents).filter(([key]) => key.startsWith("import-rejection:"))
    expect(rejections).toHaveLength(1)
    expect(rejections[0]![1]).toMatchObject({ outcome: "rejected", changedFields: 0, manifestId: preview.value.id })
    expect(state.documents[`import-preview:${preview.value.id}`]).toMatchObject({ manifest: { state: "preview", domainApplied: false, receipts: [] } })
    expect(await app.apply(selection)).toMatchObject({ status: "denied", reason: "import-rejected" })
    expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(settled)
    const grant = await app.ui.admit(app.request, "sf_import_preview", digestSfValue(selection))
    if (grant.status !== "ok" || !await app.ui.validate(grant.value, "sf_import_preview", digestSfValue(selection))) throw new Error("Missing read grant")
    expect(await app.imports.detail(selection, grant.value)).toMatchObject({ status: "ok", value: { receipt: { outcome: "rejected", changedFields: 0 } } })
    app.ui.finish(grant.value)
  } finally { await app.close() }
})

test("revocation after preview denies Apply and preserves the selected file and domain", async () => {
  const app = await importHostFixture()
  try {
    const preview = await app.prepare([mixed[0]!])
    if (preview.status !== "ok") throw new Error(preview.reason)
    const domain = await app.read()
    const metadata = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    app.policy.active = false
    expect((await app.apply({ manifestId: preview.value.id, version: preview.value.version })).status).toBe("denied")
    expect(await app.read()).toEqual(domain)
    expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(metadata)
  } finally { await app.close() }
})
