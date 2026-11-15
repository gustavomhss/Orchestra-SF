import { expect, test } from "bun:test"
import JSZip from "jszip"
import { Workbook } from "exceljs"
import { parseWorkbook } from "../../../runtime/workbooks.ts"
import { object } from "../../../runtime/contract.ts"
import { buyer, holder, procurementExportFixture } from "../procurement-exports/fixture.ts"
import { createLegacyDownloadApplication, fixtureRoleMap, legacyDownloadFixture } from "./legacy-fixture.ts"
import { recordExportEvidence } from "./evidence.ts"

async function file(response: Response | undefined) {
  expect(response?.status).toBe(200)
  if (!response || response.status !== 200) throw new Error(`Download failed: ${response?.status}`)
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(response.headers.get("x-content-type-options")).toBe("nosniff")
  const disposition = response.headers.get("content-disposition") ?? ""
  expect(disposition.startsWith("attachment; filename*=UTF-8''")).toBe(true)
  return { name: decodeURIComponent(disposition.slice("attachment; filename*=UTF-8''".length)), mediaType: response.headers.get("content-type") ?? "", bytes: new Uint8Array(await response.arrayBuffer()) }
}

async function workbookXml(bytes: Uint8Array) {
  const zip = await JSZip.loadAsync(bytes)
  return (await Promise.all(Object.values(zip.files).filter((entry) => !entry.dir && entry.name.endsWith(".xml")).map((entry) => entry.async("string")))).join("\n")
}

/** RFC4180 reader for the actual returned body, including quoted newlines and escaped quotes. */
function csvRows(body: string): string[][] {
  const rows: string[][] = []
  const cursor = { row: [] as string[], value: "", quoted: false }
  for (let index = 0; index < body.length; index++) {
    const char = body[index]
    if (char === '"') {
      if (cursor.quoted && body[index + 1] === '"') { cursor.value += '"'; index++; continue }
      cursor.quoted = !cursor.quoted
    } else if (!cursor.quoted && (char === "," || char === "\r" || char === "\n")) {
      cursor.row.push(cursor.value); cursor.value = ""
      if (char !== ",") {
        rows.push(cursor.row); cursor.row = []
        if (char === "\r" && body[index + 1] === "\n") index++
      }
    } else cursor.value += char
  }
  if (cursor.quoted) throw new Error("Unterminated CSV field")
  cursor.row.push(cursor.value); rows.push(cursor.row)
  return rows
}

async function inspectHtml(bytes: Uint8Array) {
  const observed = { heading: "", stylesheet: "", text: "", scripts: 0, cells: 0 }
  const reader = new HTMLRewriter()
    .on("h1", { text: (chunk) => { observed.heading += chunk.text } })
    .on("style", { text: (chunk) => { observed.stylesheet += chunk.text } })
    .on("body", { text: (chunk) => { observed.text += chunk.text } })
    .on("script", { element: () => { observed.scripts++ } })
    .on("td", { element: () => { observed.cells++ } })
  await reader.transform(new Response(new Uint8Array(bytes), { headers: { "content-type": "text/html" } })).text()
  return observed
}

test("EA66-XLSX reads downloaded Planner bytes, version, currency, horizon, blank/zero and formula safety", async () => {
  const fixture = await legacyDownloadFixture()
  try {
    const before = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const exported = await file(await fixture.serve(fixture.request("viewer", "planner", { download: "xlsx", version: "v66" })))
    expect(exported.mediaType).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    const workbook = new Workbook()
    await workbook.xlsx.load(new Uint8Array(exported.bytes).buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["Info", "OPEX", "CAPEX", "Headcount", "Rate cards", "FX rates"])
    const info = workbook.getWorksheet("Info")!
    const pairs: Record<string, unknown> = {}
    info.eachRow((row) => { pairs[String(row.getCell(1).value)] = row.getCell(2).value })
    expect(pairs).toMatchObject({ "Version ID": "v66", Version: "Frozen synthetic version 66", "Budget year": 2026, Currency: "USD", "Actuals closed through": "Feb" })
    const opex = workbook.getWorksheet("OPEX")!
    expect(opex.getCell("A2").value).toBe("line-66")
    expect(opex.getCell("C2").value).toBe('=HYPERLINK("https://example.invalid","literal")')
    expect(opex.getCell("C2").formula).toBeUndefined()
    expect(opex.getCell("D2").value).toBe('Ação, "quoted"\nsecond line')
    expect(opex.getCell("H2").value).toBe("EUR")
    expect(opex.getCell("J3").value).toBeNull()
    expect(opex.getCell("K3").value).toBe(0)
    expect(opex.getCell("J4").value).toBe(0)
    expect(opex.getCell("K4").value).toBeNull()
    expect(opex.getCell("V2").value).toEqual({ formula: "SUM(J2:U2)", result: 24 })
    expect(opex.views[0]?.state).toBe("frozen")
    expect(opex.autoFilter).toBeTruthy()
    expect(opex.getColumn(1).width).toBeGreaterThan(0)
    expect(workbook.getWorksheet("Rate cards")!.rowCount).toBe(1)
    expect(workbook.getWorksheet("Headcount")!.getCell("L2").value).toBeNull()
    const xml = await workbookXml(exported.bytes)
    for (const privateValue of ["PRIVATE_RATE_SENTINEL_66", "987654.32", "123456.78"]) expect(xml).not.toContain(privateValue)
    const imported = await parseWorkbook(exported.bytes)
    expect(imported.ok).toBe(true)
    if (!imported.ok) throw new Error(imported.errors.join("; "))
    expect(imported.sheets).toHaveProperty("OPEX")
    expect(JSON.stringify(imported)).toContain("line-66")
    expect(await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(before)
    await recordExportEvidence({ caseId: "planner-viewer", ...exported, observations: { sheets: workbook.worksheets.map((sheet) => sheet.name), version: pairs, original_currency: "EUR", currency: "USD", horizon: "FY2026", literal_formula_cell: opex.getCell("C2").value, cached_total: opex.getCell("V2").value, reader: "ExcelJS + JSZip + production parseWorkbook", visual_inspection: "NOT_RUN" } })
    expect((await fixture.serve(fixture.request("outsider", "planner", { download: "xlsx" })))?.status).toBe(403)
    fixture.sessions.delete("viewer")
    expect((await fixture.serve(fixture.request("viewer", "planner", { download: "xlsx" })))?.status).toBe(401)
  } finally { await fixture.close() }
})

test("EA66-JSON/MEMBERS/TEMPLATE opens actual HTTP files and excludes protected product state", async () => {
  const fixture = await legacyDownloadFixture()
  try {
    const backup = await file(await fixture.serve(fixture.request("admin", "dashboard", { download: "json" })))
    const body = new TextDecoder().decode(backup.bytes)
    const parsed = JSON.parse(body)
    expect(parsed.members[0].id).toBe("member-66")
    expect(parsed.nested).toEqual([{ label: "public" }])
    for (const marker of ["__sfProductV1", "PRIVATE_ATLAS_SENTINEL_66", "PRIVATE_RECEIPT_SENTINEL_66", "PRIVATE_NESTED_SENTINEL_66"]) expect(body).not.toContain(marker)
    await recordExportEvidence({ caseId: "dashboard-backup", ...backup, observations: { reader: "JSON.parse", members: parsed.members.length, protected_namespace_absent: true, identity_boundary: "synthetic sessions + production role resolver", source_record_id: parsed.members[0].id, version_stamp_in_file: "not provided by legacy JSON producer" } })
    const roster = await file(await fixture.serve(fixture.request("admin", "dashboard", { download: "members" })))
    const workbook = new Workbook()
    await workbook.xlsx.load(new Uint8Array(roster.bytes).buffer)
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["All Members", "Summary by Leader"])
    expect(workbook.getWorksheet("All Members")!.getCell("A2").value).toBe("Synthetic member 66")
    expect(workbook.getWorksheet("All Members")!.getCell("D2").value).toBe("Synthetic leader 66")
    expect(workbook.getWorksheet("All Members")!.getCell("L2").value).toBe("Ação — synthetic note")
    expect(await workbookXml(roster.bytes)).not.toContain("SALARY_SENTINEL_66")
    await recordExportEvidence({ caseId: "members-admin", ...roster, observations: { sheets: workbook.worksheets.map((sheet) => sheet.name), reader: "ExcelJS + JSZip", row_count: workbook.getWorksheet("All Members")!.actualRowCount - 1, excluded_salary: true, authorized_read_audit: true, visual_inspection: "NOT_RUN" } })
    const template = await file(await fixture.serve(fixture.request("admin", "dashboard", { download: "opex-template" })))
    const templateBook = new Workbook()
    await templateBook.xlsx.load(new Uint8Array(template.bytes).buffer)
    expect(templateBook.worksheets.map((sheet) => sheet.name)).toEqual(["OPEX"])
    expect(templateBook.getWorksheet("OPEX")!.getRow(1).values).toEqual([undefined, "Owner", "Annual", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"])
    expect(templateBook.getWorksheet("OPEX")!.actualRowCount).toBe(1)
    await recordExportEvidence({ caseId: "opex-template", ...template, observations: { reader: "ExcelJS", header_only: true, columns: 14, visual_inspection: "NOT_RUN" } })
    for (const download of ["json", "members", "opex-template"]) expect((await fixture.serve(fixture.request("viewer", "dashboard", { download })))?.status).toBe(403)
    const audit = await fixture.store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.audit }))
    expect(audit.filter((entry) => entry.record === "members:member-66")).toHaveLength(2)
  } finally { await fixture.close() }
})

test("EA66-CSV/HTML reads authenticated procurement files with frozen FX, source identity, escaping and recipient isolation", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.run(holder, "approve")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    await fixture.run(buyer, "submit_po", { po: { description: '<script>alert("synthetic")</script> & ação', paymentTerms: "Net 30", deliveryDate: "2026-12-01", deliveryConditions: "Service delivery", expenseType: "OPEX" } })
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 3 }] })
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.roleMap = fixtureRoleMap()
      object(snapshot.data.store).suppliers = ["=1+1", "+1+1", "-1+1", "@SUM(1,1)", "\t=1+1", "\r=1+1", 'Ação, "quoted"\nsecond line'].map((legalName, index) => ({ id: `supplier-${index}`, number: `SUP-${index}`, status: "active", legalName, currency: "EUR", bankName: "PRIVATE_BANK_SENTINEL_66", accountNumber: "PRIVATE_ACCOUNT_SENTINEL_66" }))
      return { commit: true, value: undefined }
    })
    const application = createLegacyDownloadApplication(fixture.persistence)
    const before = await fixture.material()
    const register = await file(await application.serve(application.request("buyer", "procurement", { download: "register" })))
    const rows = csvRows(new TextDecoder().decode(register.bytes))
    const record = Object.fromEntries(rows[0]!.map((header, index) => [header, rows[1]![index]]))
    expect(record).toMatchObject({ "PR number": fixture.target.id, Status: "po_pending", "PO currency": "EUR", "PO total (base)": "200", "PO base currency": "USD", "PO FX rate": "2", "PO FX source": "submitted", "PO submitted amount": "200" })
    await recordExportEvidence({ caseId: "procurement-register", ...register, observations: { reader: "RFC4180 state machine", record, source_id: fixture.target.id, snapshot_fx: 2, current_fx: 3, expected_frozen_base: 200 } })
    const po = await file(await application.serve(application.request("buyer", "procurement", { download: "po", request: fixture.target.id })))
    const html = new TextDecoder().decode(po.bytes)
    const parsedHtml = await inspectHtml(po.bytes)
    expect(html).toContain("<!doctype html>")
    expect(html).toContain("<style>")
    expect(html).toContain("200.00 USD")
    expect(html).not.toContain("300.00 USD")
    expect(html).toContain("&lt;script&gt;")
    expect(html).not.toContain("<script>")
    expect(html).not.toContain("PRIVATE_BANK_SENTINEL_66")
    expect(html).toContain("2026-12-01")
    expect(parsedHtml.heading).toBe("PURCHASE ORDER")
    expect(parsedHtml.scripts).toBe(0)
    expect(parsedHtml.cells).toBeGreaterThan(0)
    expect(parsedHtml.stylesheet).toContain("font:13px/1.5 Arial")
    expect(parsedHtml.text).toContain("200.00 USD")
    await recordExportEvidence({ caseId: "purchase-order", ...po, observations: { reader: "Bun HTMLRewriter + UTF-8 structural/escaping assertions", source_id: fixture.target.id, currency: "EUR", base_currency: "USD", base_amount: 200, delivery_date: "2026-12-01", stylesheet_present: true, parsed_cells: parsedHtml.cells, script_elements: parsedHtml.scripts, visual_inspection: "NOT_RUN" } })
    const suppliers = await file(await application.serve(application.request("buyer", "procurement", { download: "suppliers" })))
    const suppliersText = new TextDecoder().decode(suppliers.bytes)
    const supplierRows = csvRows(suppliersText)
    const legalIndex = supplierRows[0]!.indexOf("legalName")
    expect(legalIndex).toBeGreaterThan(-1)
    for (const row of supplierRows.slice(1, 7)) expect(row[legalIndex]?.startsWith("'")).toBe(true)
    expect(supplierRows[7]![legalIndex]).toBe('Ação, "quoted"\nsecond line')
    expect(suppliersText).not.toContain("PRIVATE_BANK_SENTINEL_66")
    expect(suppliersText).not.toContain("PRIVATE_ACCOUNT_SENTINEL_66")
    await recordExportEvidence({ caseId: "suppliers-buyer", ...suppliers, observations: { reader: "RFC4180 state machine", rows: supplierRows.length - 1, formula_prefixes_guarded: ["=", "+", "-", "@", "TAB", "CR"], restricted_bank_fields_absent: true, unicode_quoted_multiline_preserved: true } })
    expect((await application.serve(application.request("other-requester", "procurement", { download: "po", request: fixture.target.id })))?.status).toBe(404)
    expect((await application.serve(application.request("outsider", "procurement", { download: "register" })))?.status).toBe(403)
    expect(await fixture.material()).toEqual(before)
  } finally { await fixture.close() }
})
