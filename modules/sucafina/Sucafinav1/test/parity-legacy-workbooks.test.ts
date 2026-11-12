import { expect, test } from "bun:test"
import { utils, write } from "xlsx"
import { parseWorkbook } from "../runtime/workbooks.ts"

function legacy(sheets: Record<string, unknown[][]>) {
  const book = utils.book_new()
  Object.entries(sheets).forEach(([name, values]) => utils.book_append_sheet(book, utils.aoa_to_sheet(values), name))
  return new Uint8Array(write(book, { type: "buffer", bookType: "biff8", cellDates: true }))
}

test("real BIFF8 XLS preserves workbook names, numbers, booleans and dates in the existing preview contract", async () => {
  const result = await parseWorkbook(legacy({
    Info: [["Version", "Legacy source"], ["Year", 2026]],
    OPEX: [["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan", "Feb"], ["line-1", "Services", "Legacy vendor", "USD", "Budget", 125.5, 0]],
    "All Members": [["Name", "Title", "Type", "Start Date", "Status", "Include"], ["Legacy employee", "Analyst", "Employee", new Date("2026-04-09T00:00:00Z"), "Active", true]],
  }))
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(result.errors.join("; "))
  expect(result.sheets.OPEX).toEqual([{ "Line ID": "line-1", "Cost element": "Services", "Vendor / item": "Legacy vendor", Currency: "USD", Measure: "Budget", Jan: 125.5, Feb: 0 }])
  expect(result.sheets["All Members"]).toEqual([{ Name: "Legacy employee", Title: "Analyst", Type: "Employee", "Start Date": "2026-04-09", Status: "Active", Include: true }])
  expect(result.sheets.Info).toContainEqual({ Field: "Year", Value: 2026 })
})

test("legacy XLS uses the same bounded row and sheet inspection as OOXML previews", async () => {
  const rows = legacy({ OPEX: [["Name"], ["one"], ["two"], ["three"]] })
  expect((await parseWorkbook(rows, { maxRows: 2 })).ok).toBe(false)
  const sheets = legacy({ OPEX: [["Name"], ["one"]], CAPEX: [["Name"], ["two"]] })
  expect((await parseWorkbook(sheets, { maxSheets: 1 })).ok).toBe(false)
  expect((await parseWorkbook(rows, { maxCompressedBytes: 16 })).ok).toBe(false)
})

test("legacy XLS rejects external hyperlinks without following them and preserves a safe zero cache", async () => {
  const book = utils.book_new()
  const sheet = utils.aoa_to_sheet([["Name", "Amount"], ["Safe formula", 0]])
  sheet.B2 = { t: "n", v: 0, f: "1-1" }
  utils.book_append_sheet(book, sheet, "OPEX")
  const safe = await parseWorkbook(new Uint8Array(write(book, { type: "buffer", bookType: "biff8" })))
  expect(safe.ok).toBe(true)
  if (!safe.ok) throw new Error(safe.errors.join("; "))
  expect(safe.sheets.OPEX[0]?.Amount).toBe(0)
  sheet.B2 = { t: "n", v: 1, l: { Target: "https://example.invalid/private" } }
  expect((await parseWorkbook(new Uint8Array(write(book, { type: "buffer", bookType: "biff8" })))).ok).toBe(false)
})
