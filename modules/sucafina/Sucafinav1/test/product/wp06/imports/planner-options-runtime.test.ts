import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { utils, write } from "xlsx"
import { createImportHttpFixture } from "./http-fixture.ts"

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const line = (id: string, sec = "opex") => ({ id, sec, el: "licenses", name: id, desc: "Original description", cur: "USD", proj: sec === "capex" ? "project" : "", owner: { id: "known", name: "Known owner" }, annual: 120, b: Array(12).fill(10), bm: Array(12).fill(false), a: Array(12).fill(null), f: Array(12).fill(null) })
const plan = () => ({ id: "v1", name: "FY27", year: 2027, closed: 0, locked: false,
  lines: [line("kept"), line("removed"), line("capex", "capex")],
  projects: [{ id: "project", name: "Existing project", code: "CPX-2027-0001", owner: "" }], fx: [],
  hc: { positions: [{ id: "position", name: "Manual position", title: "Analyst", include: false, domain: "Team", location: "Geneva", type: "Employee", fte: 1, start: 1, end: 12, rateId: "", rateOverride: null }], rates: [], hrAF: {}, inc: 0, incMonth: 1 }, lists: {} })

async function seed(app: Awaited<ReturnType<typeof createImportHttpFixture>>, locked = false) {
  await app.store.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ ...plan(), locked }]
    snapshot.data.officials = locked ? { "2027": "v1" } : {}
    snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
    return { commit: true, value: undefined }
  })
}

async function target(app: Awaited<ReturnType<typeof createImportHttpFixture>>) {
  const selected = (await app.discover()).find((choice) => choice.label === "FY27")
  if (!selected) throw new Error("Planner target missing")
  return selected
}

test("locked HTTP preview labels retained inputs while applying only the permitted forecast", async () => {
  const app = await createImportHttpFixture("planner")
  try {
    await seed(app, true)
    const workbook = new Workbook(); const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Description", "Currency", "Owner", "Measure", ...months])
    sheet.addRow(["kept", "Licenses", "Forbidden rename", "Forbidden description", "EUR", "Unrecognized owner label", "Budget", 999])
    sheet.addRow(["kept", "Licenses", "kept", undefined, "USD", undefined, "Forecast", 84])
    const selection = await app.admit(await target(app), new Uint8Array(await workbook.xlsx.writeBuffer()), { newVersion: false, removeMissing: true, preview: {} })
    const before = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const preview = await app.preview(selection)
    const detail = await app.detail(preview)
    expect(detail.receipt).toBeUndefined()
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    for (const field of ["Jan", "Vendor / item", "Description", "Currency", "Owner"]) {
      expect(detail.detail.changes.some((change) => change.kind === "unchanged" && change.source.kind === "file" && change.source.row === 2 && change.source.field === field && change.reason?.includes("will not be applied"))).toBe(true)
    }
    expect(preview.issues.some((issue) => issue.reason === "Unknown owner; the existing reference is retained.")).toBe(true)
    expect(JSON.stringify({ preview, detail })).not.toContain("Unrecognized owner label")
    const applied = await app.apply(preview)
    expect(applied).toMatchObject({ state: "applied", domainApplied: true })
    const after = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const version = (after.data.versions as ReturnType<typeof plan>[])[0]!
    expect(version.lines.map((entry) => entry.id)).toEqual(["kept", "removed", "capex"])
    expect(version.lines[0]).toMatchObject({ name: "kept", desc: "Original description", cur: "USD", owner: { id: "known", name: "Known owner" }, b: Array(12).fill(10), f: [84, ...Array(11).fill(null)] })
    expect((await app.detail(preview)).receipt).toMatchObject({ outcome: "applied" })
  } finally { await app.dispose() }
}, 90_000)

test("HTTP newVersion uses a stable preview identity, preserves its official source and returns one receipt", async () => {
  const app = await createImportHttpFixture("planner")
  try {
    await seed(app, true)
    const workbook = new Workbook(); const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", ...months])
    sheet.addRow(["kept", "Licenses", "kept", "USD", "Budget", 900])
    const selection = await app.admit(await target(app), new Uint8Array(await workbook.xlsx.writeBuffer()), { newVersion: true, removeMissing: false, preview: {} })
    const before = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const previewKey = randomUUID()
    const preview = await app.preview(selection, previewKey)
    expect(await app.preview(selection, previewKey)).toEqual(preview)
    const detail = await app.detail(preview)
    const idChange = detail.detail.changes.find((change) => change.kind === "added" && /^\/versions\/@id=[^/]+\/id$/.test(change.path))
    if (idChange?.after.state !== "present" || typeof idChange.after.value !== "string") throw new Error("New version identity missing from preview")
    const newId = idChange.after.value
    expect(newId).toMatch(/^import-[a-f0-9]{32}$/)
    expect(detail.detail.changes.some((change) => change.source.kind === "file" && change.source.field === "Jan" && change.reason?.includes("will not be applied"))).toBe(false)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    const key = randomUUID()
    const applied = await app.apply(preview, key)
    const after = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const versions = after.data.versions as ReturnType<typeof plan>[]
    expect(versions).toHaveLength(2)
    expect(versions.find((version) => version.id === "v1")).toEqual((before.data.versions as ReturnType<typeof plan>[])[0])
    const copied = versions.find((version) => version.id === newId)
    expect(copied).toMatchObject({ id: newId, locked: false, name: "FY27 — Import" })
    expect(copied!.lines[0]!.b).toEqual([900, ...Array(11).fill(0)])
    expect(after.data.officials).toEqual({ "2027": "v1" })
    expect((await app.detail(preview)).receipt).toMatchObject({ outcome: "applied", manifestId: preview.id })
    expect(await app.apply(preview, key)).toEqual(applied)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(after)
  } finally { await app.dispose() }
}, 90_000)

test("legacy XLS removeMissing removes only supplied OPEX and a subsequent no-op has an unchanged receipt", async () => {
  const app = await createImportHttpFixture("planner")
  try {
    await seed(app)
    const book = utils.book_new()
    utils.book_append_sheet(book, utils.aoa_to_sheet([
      ["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", ...months],
      ["kept", "Licenses", "kept", "USD", "Budget", 120, ...Array(11).fill(0)],
    ]), "OPEX")
    const bytes = new Uint8Array(write(book, { type: "buffer", bookType: "biff8" }))
    const options = { newVersion: false, removeMissing: true, preview: {} }
    const selection = await app.admit(await target(app), bytes, options, "xls")
    const before = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const preview = await app.preview(selection)
    expect(preview.format).toBe("xls")
    const detail = await app.detail(preview)
    const removed = detail.detail.changes.filter((change) => change.kind === "removed")
    // The real Planner view includes the source row and its calculated summary row.
    // Both disappear together; no other raw or derived record may be removed.
    const removedPrefixes = ["/versions/@id=v1/lines/@id=removed/", "/versions/@id=v1/summary/lines/@id=removed/"]
    expect(removedPrefixes.every((prefix) => removed.some((change) => change.path.startsWith(prefix)))).toBe(true)
    expect(removed.every((change) => removedPrefixes.some((prefix) => change.path.startsWith(prefix)))).toBe(true)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    const key = randomUUID()
    const applied = await app.apply(preview, key)
    const after = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const original = (before.data.versions as ReturnType<typeof plan>[])[0]!
    const version = (after.data.versions as ReturnType<typeof plan>[])[0]!
    expect(version.lines.map((entry) => entry.id)).toEqual(["kept", "capex"])
    expect(version.lines[1]).toEqual(original.lines[2])
    expect(version.projects).toEqual(original.projects)
    expect(version.hc).toEqual(original.hc)
    expect((await app.detail(preview)).receipt).toMatchObject({ outcome: "applied", manifestId: preview.id })
    expect(await app.apply(preview, key)).toEqual(applied)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(after)

    const unchanged = await app.preview(await app.admit(await target(app), bytes, options, "xls"))
    const noChangeBefore = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const noChangeKey = randomUUID()
    const result = await app.apply(unchanged, noChangeKey)
    expect((await app.detail(unchanged)).receipt).toMatchObject({ outcome: "unchanged", changedFields: 0 })
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(noChangeBefore)
    expect(await app.apply(unchanged, noChangeKey)).toEqual(result)
  } finally { await app.dispose() }
}, 90_000)
