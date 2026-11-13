import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { createWp06Runtime } from "./runtime-fixture.ts"
import { createSfImportServices } from "../../../../../../apps/cli/src/sucafina-product/import-services.ts"
import { createSfImportHttp } from "../../../product/interface/import-http.ts"

/** Actual HTTP/service/authority/SQLite boundary; model execution and the scanner are not qualified here. */
test("HTTP dispatch previews without domain writes, applies once, returns a receipt and denies revoked access", async () => {
  const app = await createWp06Runtime()
  try {
    await app.store.transaction("planner", async (snapshot) => {
      snapshot.data.versions = [{ id: "v1", name: "FY27", year: 2027, closed: 0, locked: false,
        lines: [{ id: "42", sec: "opex", el: "licenses", name: "Licences", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(null) }],
        projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
      snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []; snapshot.data.roster = []
      return { commit: true, value: undefined }
    })
    const service = createSfImportServices({ runtime: app.runtime, authority: app.authority })
    if (!service) throw new Error("Import service not composed")
    const http = createSfImportHttp({ origin: app.origin, mount: "/sucafina", runtime: () => ({ ui: app.authority.ui, human: app.authority.human, service }) })
    const call = async (mode: string, payload?: unknown, query: Record<string, string> = {}, key = randomUUID(), cookie = app.cookie) => {
      const url = new URL(`${app.origin}/sucafina/planner`)
      url.searchParams.set("sf", mode)
      Object.entries(query).forEach(([name, value]) => url.searchParams.set(name, value))
      const response = await http(new Request(url, payload === undefined ? { headers: { cookie } } : {
        method: "POST", headers: { cookie, origin: app.origin, "Idempotency-Key": key, ...(payload instanceof FormData ? {} : { "Content-Type": "application/json" }) },
        body: payload instanceof FormData ? payload : JSON.stringify(payload),
      }), "planner")
      if (!response) throw new Error("Import route missing")
      return response
    }
    const page = await call("imports")
    expect(page.status).toBe(200)
    expect(page.headers.get("content-security-policy")).toContain("sha256-")
    expect(await page.text()).toContain("Apply reviewed import")
    const targets = await call("import-targets", undefined, { surface: "planner" }).then((response) => response.json())
    const target = targets.value.find((entry: { label: string }) => entry.label === "FY27")
    expect(target).toBeDefined()
    const workbook = new Workbook(); const sheet = workbook.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"])
    sheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 0])
    const form = new FormData()
    form.set("file", new File([new Uint8Array(await workbook.xlsx.writeBuffer())], "forecast.xlsx"))
    form.set("surface", "planner"); form.set("selectionRef", target.selectionRef)
    form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
    const admitted = await call("import-admit", form).then((response) => response.json())
    expect(admitted.status).toBe("ok")
    const selection = { admittedFileRef: admitted.value.ref, format: "xlsx", options: {} }
    const before = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const preview = await call("import-preview", selection).then((response) => response.json())
    expect(preview.status).toBe("ok")
    expect(preview.receipt).toMatchObject({ kind: "ui", operation: "sf_import_preview", handlerExport: "previewImport" })
    expect(preview.value).toMatchObject({ state: "preview", domainApplied: false, receipts: [] })
    expect(preview.value.commands[0]).not.toHaveProperty("command")
    const reference = await call("import-reference", undefined, { importPreviewRef: preview.value.id }).then((response) => response.json())
    expect(reference.value.manifest).toEqual(preview.value)
    expect(reference.value.manifest.commands[0]).not.toHaveProperty("command")
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    const selected = { manifestId: preview.value.id, version: preview.value.version }
    const detail = await call("import-detail", undefined, { manifestId: selected.manifestId, version: String(selected.version) }).then((response) => response.json())
    expect(detail.value.detail.changes.some((entry: { kind: string }) => entry.kind === "changed")).toBe(true)
    expect((await call("import-apply", selected, {}, randomUUID(), app.otherCookie)).status).toBe(403)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    const applyKey = randomUUID()
    const applied = await call("import-apply", selected, {}, applyKey).then((response) => response.json())
    expect(applied).toMatchObject({ status: "ok", value: { state: "applied", domainApplied: true } })
    const after = await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect((after.data.versions as { lines: { f: unknown[] }[] }[])[0]!.lines[0]!.f[0]).toBe(0)
    expect(await call("import-apply", selected, {}, applyKey).then((response) => response.json())).toEqual(applied)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(after)
    const receipt = await call("import-detail", undefined, { manifestId: selected.manifestId, version: String(selected.version) }).then((response) => response.json())
    expect(receipt.value.receipt).toMatchObject({ outcome: "applied", manifestId: selected.manifestId })
    expect(receipt.value.receipt.changedFields).toBeGreaterThan(0)
    await app.identity.handle(new Request(`${app.origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie: app.cookie, origin: app.origin } }))
    expect((await call("import-detail", undefined, { manifestId: selected.manifestId, version: String(selected.version) })).status).toBe(403)
    expect((await call("import-apply", selected, {}, applyKey)).status).toBe(403)
    expect(await app.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(after)
  } finally { await app.dispose() }
})
