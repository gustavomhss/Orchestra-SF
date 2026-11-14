import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { Workbook } from "exceljs"
import { previewImport } from "../../../../product/imports/capabilities.ts"
import { sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { createWp06Runtime } from "../runtime-fixture.ts"
import { createImportHttpFixture } from "./http-fixture.ts"

/** A real parser and signed UI authority exercise adapter failure; the injected file host is not an admission witness. */
test("an absent or unavailable domain adapter cannot persist or fabricate an import preview", async () => {
  const app = await createWp06Runtime()
  try {
    const workbook = new Workbook(); const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Currency", "Measure", "Jan"])
    sheet.addRow(["known", "USD", "Forecast", 42])
    const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
    const digest = createHash("sha256").update(bytes).digest("hex")
    const request = { admittedFileRef: "test-file-boundary", format: "xlsx", options: {} }
    let readCalls = 0, prepareCalls = 0, saveCalls = 0
    await app.uiCall("sf_import_preview", request, async (context) => {
      const before = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
      const host = {
        revalidate: app.authority.host.revalidate,
        files: {
          read: async () => { readCalls++; return { status: "ok" as const, value: { bytes, digest } } },
          revalidate: async () => app.authority.host.revalidate(context),
        },
        save: async () => { saveCalls++; throw new Error("An unavailable adapter must never save a preview") },
      }
      expect(await previewImport(request, context, host)).toEqual({ status: "unavailable", reason: "domain-adapter-unavailable" })
      expect(readCalls).toBe(0)
      const unavailable = await previewImport(request, context, { ...host, prepare: async ({ parsed }) => {
        prepareCalls++
        expect(parsed.sheets?.OPEX).toEqual([{ "Line ID": "known", Currency: "USD", Measure: "Forecast", Jan: 42 }])
        return { status: "unavailable", reason: "domain-adapter-offline" }
      } })
      expect(unavailable).toEqual({ status: "unavailable", reason: "domain-adapter-offline" })
      expect(prepareCalls).toBe(1)
      expect(readCalls).toBe(1)
      expect(saveCalls).toBe(0)
      expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    })
  } finally { await app.dispose() }
}, 30_000)

test("real deletion and recreation of a Planner ID invalidates its old preview and cannot emit an Apply receipt", async () => {
  const app = await createImportHttpFixture("planner")
  try {
    const version = { id: "v1", name: "FY27", year: 2027, closed: 0, locked: false,
      lines: [{ id: "known", sec: "opex", el: "licenses", name: "Known licence", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(null) }],
      projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }
    await app.store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [structuredClone(version)]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
      return { commit: true, value: undefined }
    })
    const selected = (await app.discover()).find((choice) => choice.label === "FY27")
    if (!selected) throw new Error("Planner target missing")
    const original = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "v1") }))
    if (!original) throw new Error("Original source missing")
    const workbook = new Workbook(); const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"])
    sheet.addRow(["known", "Licenses", "Known licence", "USD", "Forecast", 42])
    const preview = await app.preview(await app.admit(selected, new Uint8Array(await workbook.xlsx.writeBuffer()), { newVersion: false, removeMissing: false, preview: {} }))
    expect((await app.detail(preview)).receipt).toBeUndefined()
    await app.store.transaction("planner", async (snapshot) => { snapshot.data.versions = []; return { commit: true, value: undefined } })
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "v1") }))).toBeUndefined()
    await app.store.transaction("planner", async (snapshot) => { snapshot.data.versions = [structuredClone(version)]; return { commit: true, value: undefined } })
    const replacement = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "v1") }))
    expect(replacement).toBeDefined()
    expect(replacement!.incarnation).not.toBe(original.incarnation)
    const recreated = (await app.discover()).find((choice) => choice.label === "FY27")
    expect(recreated).toBeDefined()
    expect(recreated!.selectionRef).not.toBe(selected.selectionRef)
    const before = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const privateBefore = await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.__sfProductV1) }))
    for (const response of [
      await app.call("import-reference", undefined, { importPreviewRef: preview.id }),
      await app.call("import-detail", undefined, { manifestId: preview.id, version: String(preview.version) }),
      await app.call("import-apply", { manifestId: preview.id, version: preview.version }),
    ]) {
      expect(response.ok).toBe(false)
      const result = await response.json()
      expect(["stale", "denied"]).toContain(result.status)
      expect(result).not.toHaveProperty("value")
    }
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    expect(await app.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.__sfProductV1 }))).toEqual(privateBefore)
    expect((before.data.versions as typeof version[])[0]).toEqual(version)
  } finally { await app.dispose() }
}, 90_000)
