import { expect, test } from "bun:test"
import { importHostFixture } from "./host-fixture.ts"

const table = { name: "All Members", headers: ["Name", "Title", "Type", "Leader", "Location", "Start Date", "End Date", "Status"] }
const rows = [["Workbook person", "Engineer", "Employee", "Lead", "Geneva", "2027-01-01", "", "Active"]]

for (const read of [2, 3]) test(`roster change on source read ${read} prevents publishing a stale preview`, async () => {
  const app = await importHostFixture()
  try {
    app.policy.role = "admin"
    app.policy.changeRosterOnRead = read
    const before = await app.read()
    expect(await app.prepare(rows, table)).toMatchObject({ status: "stale", reason: "roster-source-changed" })
    const after = await app.read()
    expect(after.data.versions).toEqual(before.data.versions)
    expect(after.data.roster).toEqual([{ name: "Concurrent person", title: "Analyst", type: "Employee", leader: "Lead", location: "Geneva", start: "2027-01-01", end: "", status: "Active" }])
    expect(after.audit).toEqual(before.audit)
    const state = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.__sfProductV1 as { documents: Record<string, unknown>; receipts: Record<string, unknown> } }))
    expect(state.receipts).toEqual({})
    const previews = Object.keys(state.documents).filter((key) => key.startsWith("import-preview:"))
    expect(previews).toHaveLength(read === 2 ? 0 : 1)
    if (read === 3) {
      const grant = await app.ui.admit(app.request, "sf_import_preview", "e".repeat(64))
      if (grant.status !== "ok" || !await app.ui.validate(grant.value, "sf_import_preview", "e".repeat(64))) throw new Error("Missing read grant")
      expect(await app.imports.readPreviewReference(previews[0]!.slice("import-preview:".length), grant.value)).toMatchObject({ status: "stale", reason: "roster-source-changed" })
      app.ui.finish(grant.value)
    }
  } finally { await app.close() }
})
