import { expect, test } from "bun:test"
import { Workbook } from "exceljs"
import { parseWorkbook, parseWorkbookDetailed } from "../../../../runtime/workbooks.ts"

test("physical workbook locations survive empty rows and cached formula zero", async () => {
  const book = new Workbook()
  const sheet = book.addWorksheet("OPEX")
  sheet.addRow(["Line ID", "Measure", "Jan"])
  sheet.getRow(4).values = ["line-1", "Forecast", { formula: "1-1", result: 0 }]
  sheet.getRow(7).values = ["line-2", "Forecast", 12]
  const bytes = new Uint8Array(await book.xlsx.writeBuffer())
  const detailed = await parseWorkbookDetailed(bytes)
  expect(detailed.ok).toBe(true)
  if (!detailed.ok) return
  expect(detailed.sheets.OPEX).toEqual([{ "Line ID": "line-1", Measure: "Forecast", Jan: 0 }, { "Line ID": "line-2", Measure: "Forecast", Jan: 12 }])
  expect(detailed.origins.filter((origin) => origin.field === "Jan")).toEqual([
    { sheet: "OPEX", recordIndex: 0, row: 4, column: 3, address: "C4", field: "Jan" },
    { sheet: "OPEX", recordIndex: 1, row: 7, column: 3, address: "C7", field: "Jan" },
  ])
  expect(await parseWorkbook(bytes)).toEqual({ ok: true, sheets: detailed.sheets })
})

test("rejected workbook does not expose partial values or locations", async () => {
  const book = new Workbook(); const sheet = book.addWorksheet("OPEX")
  sheet.addRow(["Line ID", "Jan", "Jan"]); sheet.addRow(["line", 0, 1])
  const result = await parseWorkbookDetailed(new Uint8Array(await book.xlsx.writeBuffer()))
  expect(result.ok).toBe(false)
  expect(result).not.toHaveProperty("origins")
  expect(result).not.toHaveProperty("sheets")
})

test("legacy XLS preserves physical row and column locations", async () => {
  const { utils, write } = await import("xlsx")
  const book = utils.book_new()
  const sheet = utils.aoa_to_sheet([["Line ID", "Measure", "Jan"], [], [], ["line-1", "Forecast", 0]])
  utils.book_append_sheet(book, sheet, "OPEX")
  const bytes = new Uint8Array(write(book, { type: "array", bookType: "biff8" }))
  const detailed = await parseWorkbookDetailed(bytes)
  expect(detailed.ok).toBe(true)
  if (!detailed.ok) return
  expect(detailed.sheets.OPEX?.[0]?.Jan).toBe(0)
  expect(detailed.origins).toContainEqual({ sheet: "OPEX", recordIndex: 0, row: 4, column: 3, address: "C4", field: "Jan" })
  expect(await parseWorkbook(bytes)).toEqual({ ok: true, sheets: detailed.sheets })
})

test("ticket register locations point to the numeric cells used for each month", async () => {
  const book = new Workbook(); const sheet = book.addWorksheet("Ticket Register")
  sheet.getRow(2).values = ["Category", "Metric", "Jan", "", "Feb", "", "Mar", "", "Apr", "", "May", "", "Jun"]
  sheet.getRow(5).values = ["Support", "Open", 0, 4, 8, 2]
  const detailed = await parseWorkbookDetailed(new Uint8Array(await book.xlsx.writeBuffer()))
  expect(detailed.ok).toBe(true)
  if (!detailed.ok) return
  expect(detailed.origins).toContainEqual({ sheet: "Ticket Register", recordIndex: 0, row: 5, column: 3, address: "C5", field: "tickets.Support|Incidents|Open" })
  expect(detailed.origins).toContainEqual({ sheet: "Ticket Register", recordIndex: 0, row: 5, column: 4, address: "D5", field: "tickets.Support|Service Requests|Open" })
  expect(detailed.origins).toContainEqual({ sheet: "Ticket Register", recordIndex: 1, row: 5, column: 5, address: "E5", field: "tickets.Support|Incidents|Open" })
  expect(detailed.sheets["Ticket Register"]?.[1]?.month).toBe(2)
})
