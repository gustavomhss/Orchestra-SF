import { expect, test } from "bun:test"
import { Workbook } from "exceljs"
import { parseWorkbook, parseWorkbookDetailed } from "../../../../runtime/workbooks.ts"

test("detailed workbook provenance keeps sparse physical coordinates and legacy values", async () => {
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("OPEX")
  sheet.addRow(["Line ID", "Amount", "Optional", "Effective date"])
  sheet.getRow(4).getCell(1).value = 9001
  sheet.getRow(4).getCell(2).value = { formula: "1-1", result: 0 }
  sheet.getRow(4).getCell(4).value = new Date("2026-02-03T00:00:00.000Z")
  sheet.getRow(8).getCell(1).value = "line-8"
  sheet.getRow(8).getCell(2).value = 12

  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const detailed = await parseWorkbookDetailed(bytes)

  expect(detailed.ok).toBe(true)
  if (!detailed.ok) return
  expect(detailed.sheets.OPEX).toEqual([
    { "Line ID": 9001, Amount: 0, Optional: null, "Effective date": "2026-02-03" },
    { "Line ID": "line-8", Amount: 12, Optional: null, "Effective date": null },
  ])
  expect(detailed.origins).toEqual([
    { sheet: "OPEX", recordIndex: 0, row: 4, column: 1, address: "A4", field: "Line ID" },
    { sheet: "OPEX", recordIndex: 0, row: 4, column: 2, address: "B4", field: "Amount" },
    { sheet: "OPEX", recordIndex: 0, row: 4, column: 4, address: "D4", field: "Effective date" },
    { sheet: "OPEX", recordIndex: 1, row: 8, column: 1, address: "A8", field: "Line ID" },
    { sheet: "OPEX", recordIndex: 1, row: 8, column: 2, address: "B8", field: "Amount" },
  ])
  expect(await parseWorkbook(bytes)).toEqual({ ok: true, sheets: detailed.sheets })
})

test("detailed workbook parsing rejects a file without a supported worksheet", async () => {
  const workbook = new Workbook()
  workbook.addWorksheet("Notes").addRow(["This is not an import sheet"])

  const result = await parseWorkbookDetailed(new Uint8Array(await workbook.xlsx.writeBuffer()))

  expect(result).toEqual({ ok: false, errors: ["No supported workbook sheets"] })
  expect(result).not.toHaveProperty("sheets")
  expect(result).not.toHaveProperty("origins")
})

test("detailed workbook parsing preserves legacy behavior for a title row", async () => {
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("OPEX")
  sheet.addRow(["Budget upload"])
  sheet.addRow(["Line ID", "Amount"])
  sheet.addRow(["line-1", 0])

  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const result = await parseWorkbookDetailed(bytes)

  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(result.sheets.OPEX).toEqual([{ "Budget upload": "Line ID", "": "Amount" }, { "Budget upload": "line-1", "": 0 }])
  expect(await parseWorkbook(bytes)).toEqual({ ok: true, sheets: result.sheets })
})
