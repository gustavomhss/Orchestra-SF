import { expect, test } from "bun:test"
import { exportPlanner, exportMembers, parseWorkbook, parseOperationsWorkbook } from "../runtime/workbooks.ts"
import type { Snapshot, Actor } from "../runtime/contract.ts"
import type { ArtifactResult } from "../runtime/artifact.ts"

const environment = {
  at: "2026-11-11T12:00:00Z",
  id: () => "generated",
  directory: [],
}
const admin: Actor = {
  id: "directory-admin",
  roles: ["admin"],
  canWrite: true,
}
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
function snapshot(): Snapshot {
  return {
    data: {
      curId: "v1",
      app: {
        currency: "EUR",
        entities: [{ id: "entity", name: "Test entity" }],
        allocations: [{ id: "allocation", name: "Test allocation" }],
      },
      versions: {
        v1: {
          id: "v1",
          name: "Synthetic plan",
          year: 2026,
          closed: 2,
          created: "2026-01-01",
          lines: [
            {
              id: "line",
              sec: "opex",
              el: "licenses",
              name: "Example vendor",
              desc: "Example description",
              owner: "Example owner",
              entity: "entity",
              alloc: "allocation",
              cur: "EUR",
              b: [12, 12],
              a: [null, 0],
              f: [0, null],
            },
            {
              id: "project-line",
              sec: "capex",
              proj: "project",
              el: "services",
              name: "Example delivery",
              cur: "EUR",
              cls: "opex",
              b: [15],
              a: [null],
              f: [null],
            },
          ],
          projects: [
            {
              id: "project",
              code: "CPX-2026-001",
              name: "Example project",
              owner: "Project owner",
            },
          ],
          hc: {
            inc: 10,
            incMonth: 7,
            positions: [
              {
                id: "position",
                name: "Synthetic person",
                title: "Engineer",
                include: true,
                domain: "Test domain",
                location: "Test location",
                type: "Employee",
                fte: 1,
                start: 1,
                end: 12,
                rateId: "rate",
                rateOverride: 123456.78,
              },
              {
                id: "second-position",
                name: "Another synthetic person",
                title: "Analyst",
                include: true,
                domain: "Test domain",
                location: "Test location",
                type: "Employee",
                fte: 1,
                start: 1,
                end: 12,
                rateId: "rate",
                rateOverride: 22222.22,
              },
            ],
            rates: [
              {
                id: "rate",
                name: "SECRET_RATE_LABEL",
                locs: "Test location",
                annual: 987654.32,
                cur: "EUR",
              },
            ],
          },
          hrAF: {
            "Test domain": {
              a: [null, 0],
              f: [null, 0],
              owner: "HR owner",
              entity: "entity",
              alloc: "allocation",
            },
          },
          fx: [
            { cur: "EUR", rate: 1.2 },
            { cur: "GBP", rate: null },
          ],
        },
      },
    },
    versions: {},
    sequences: {},
    audit: [],
    notices: [],
  }
}
async function open(result: ArtifactResult) {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error("Expected workbook")
  expect(result.type).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
  expect(result.bytes.slice(0, 2)).toEqual(new Uint8Array([80, 75]))
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  await workbook.xlsx.load(new Uint8Array(result.bytes).buffer)
  return workbook
}
async function xml(result: ArtifactResult) {
  if (!result.ok) throw new Error("Expected workbook")
  const { default: JSZip } = await import("jszip")
  const archive = await JSZip.loadAsync(result.bytes)
  return (
    await Promise.all(
      Object.values(archive.files)
        .filter((file) => !file.dir)
        .map((file) => file.async("string")),
    )
  ).join("\n")
}
test("planner creates exact sheets, headers, measures, SUM totals and blank versus zero", async () => {
  const state = snapshot(),
    before = structuredClone(state)
  const result = await exportPlanner(state, admin, environment)
  const workbook = await open(result)
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual([
    "Info",
    "OPEX",
    "CAPEX",
    "Headcount",
    "Rate cards",
    "FX rates",
  ])
  expect(workbook.getWorksheet("OPEX")!.getRow(1).values).toEqual([
    undefined,
    "Line ID",
    "Cost element",
    "Vendor / item",
    "Description",
    "Owner",
    "Entity",
    "Allocation",
    "Currency",
    "Measure",
    ...months,
    "Total",
  ])
  expect(workbook.getWorksheet("CAPEX")!.getRow(1).values).toEqual([
    undefined,
    "Line ID",
    "Project code",
    "Project",
    "Project owner",
    "Cost element",
    "Vendor / item",
    "Description",
    "Owner",
    "Classification",
    "Currency",
    "Measure",
    ...months,
    "Total",
  ])
  expect(workbook.getWorksheet("Headcount")!.getRow(1).values).toEqual([
    undefined,
    "Position ID",
    "Include",
    "Name",
    "Title",
    "Domain",
    "Location",
    "Type",
    "Rate card",
    "FTE",
    "Start month",
    "End month",
    "Rate override",
    "FY cost USD (calculated)",
  ])
  expect(workbook.getWorksheet("Rate cards")!.getRow(1).values).toEqual([
    undefined,
    "Rate ID",
    "Rate card",
    "Locations",
    "Currency",
    "Annual cost per FTE",
  ])
  expect(workbook.getWorksheet("FX rates")!.getRow(1).values).toEqual([undefined, "Currency", "USD per 1 unit"])
  const opex = workbook.getWorksheet("OPEX")!
  expect(opex.getCell("I2").value).toBe("Budget")
  expect(opex.getCell("I3").value).toBe("Actual")
  expect(opex.getCell("I4").value).toBe("Forecast")
  expect(opex.getCell("J3").value).toBeNull()
  expect(opex.getCell("K3").value).toBe(0)
  expect(opex.getCell("J4").value).toBe(0)
  expect(opex.getCell("K4").value).toBeNull()
  expect(opex.getCell("V2").value).toEqual({
    formula: "SUM(J2:U2)",
    result: 24,
  })
  expect(opex.getCell("H2").value).toBe("EUR")
  expect(opex.getCell("F2").value).toBe("Test entity")
  expect(opex.getCell("G2").value).toBe("Test allocation")
  expect(workbook.getWorksheet("CAPEX")!.getCell("X2").value).toEqual({
    formula: "SUM(L2:W2)",
    result: 15,
  })
  expect(workbook.getWorksheet("CAPEX")!.getCell("H2").value).toBe("Project owner")
  expect(workbook.getWorksheet("CAPEX")!.getCell("I2").value).toBe("OPEX")
  expect(state).toEqual(before)
})
test("headcount cost uses FX and effective increase; HR aggregates include domain AF and original rate shapes", async () => {
  const workbook = await open(await exportPlanner(snapshot(), admin, environment, "v1"))
  expect(workbook.getWorksheet("Headcount")!.getCell("L2").value).toBe(123456.78)
  expect(workbook.getWorksheet("Headcount")!.getCell("M2").value).toBe(155555.58)
  expect(workbook.getWorksheet("Rate cards")!.getCell("E2").value).toBe(987654.32)
  expect(workbook.getWorksheet("FX rates")!.getCell("B3").value).toBeNull()
  const opex = workbook.getWorksheet("OPEX")!
  expect(opex.getCell("A5").value).toBe("HR:Test domain")
  expect(opex.getCell("I5").value).toBe("Budget (from headcount)")
  expect(opex.getCell("J5").value).toBe(14567.9)
  expect(opex.getCell("P5").value).toBe(16024.69)
  expect(opex.getCell("J6").value).toBeNull()
})
test("viewer and budget owner never receive rate values, override or position cost, even in XML or cached formulas", async () => {
  for (const role of ["viewer", "budget owner"]) {
    const state = snapshot(),
      before = structuredClone(state)
    const result = await exportPlanner(state, { ...admin, canWrite: false, roles: [role] }, environment)
    const workbook = await open(result)
    expect(workbook.getWorksheet("Rate cards")!.rowCount).toBe(1)
    expect(workbook.getWorksheet("Headcount")!.getCell("H2").value).toBeNull()
    expect(workbook.getWorksheet("Headcount")!.getCell("L2").value).toBeNull()
    expect(workbook.getWorksheet("Headcount")!.getCell("M2").value).toBeNull()
    expect(workbook.getWorksheet("OPEX")!.getCell("I5").value).toBe("Budget (from headcount)")
    const raw = await xml(result)
    expect(raw).not.toContain("SECRET_RATE_LABEL")
    expect(raw).not.toContain("987654.32")
    expect(raw).not.toContain("123456.78")
    expect(raw).not.toContain("155555.58")
    workbook.eachSheet((sheet) =>
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          expect(cell.text).not.toContain("SECRET_RATE_LABEL")
        }),
      ),
    )
    expect(state).toEqual(before)
  }
})
test("admin, hr and finance may export salary; other-surface roles cannot export planner", async () => {
  for (const role of ["admin", "hr", "finance"])
    expect(
      (await open(await exportPlanner(snapshot(), { ...admin, roles: [role] }, environment))).getWorksheet(
        "Rate cards",
      )!.rowCount,
    ).toBe(2)
  for (const role of ["buyer", "contributor", "domain leader"])
    expect(await exportPlanner(snapshot(), { ...admin, roles: [role] }, environment)).toMatchObject({
      ok: false,
      status: 403,
    })
  expect(await exportPlanner(snapshot(), admin, environment, "missing")).toMatchObject({ ok: false, status: 404 })
})
test("version arrays and nested hc.hrAF survive export without reshaping source", async () => {
  const state = snapshot()
  const version = (state.data.versions as Record<string, Record<string, unknown>>).v1!
  ;(version.hc as Record<string, unknown>).hrAF = version.hrAF
  delete version.hrAF
  state.data.versions = [version]
  const before = structuredClone(state)
  const workbook = await open(await exportPlanner(state, admin, environment, "v1"))
  expect(workbook.getWorksheet("OPEX")!.getCell("E5").value).toBe("HR owner")
  expect(state).toEqual(before)
})
test("members export has exact columns and leader summary, no salary, and audits every read", async () => {
  const state = snapshot()
  state.data.members = [
    {
      id: "member",
      name: "Synthetic member",
      title: "Analyst",
      type: "Contractor",
      leaderId: "leader",
      location: "Example",
      start: "2025-01-01",
      end: "",
      status: "Active",
      cls: "Talent",
      outlook: "Stay",
      notes: "Synthetic note",
      salary: "SALARY_SENTINEL",
    },
  ]
  state.data.leaders = [
    {
      id: "leader",
      name: "Synthetic leader",
      domain: "Test domain",
      location: "Example",
    },
  ]
  const result = await exportMembers(state, admin, environment)
  const workbook = await open(result)
  expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(["All Members", "Summary by Leader"])
  expect(workbook.getWorksheet("All Members")!.getRow(1).values).toEqual([
    undefined,
    "Name",
    "Title",
    "Type",
    "Leader",
    "Location",
    "Start Date",
    "End Date",
    "Tenure",
    "Status",
    "Classification",
    "Outlook",
    "Notes",
  ])
  expect(workbook.getWorksheet("Summary by Leader")!.getRow(1).values).toEqual([
    undefined,
    "Leader",
    "Domain",
    "Location",
    "Total HC",
    "Active",
    "Active Employees",
    "Active Contractors",
    "Talent",
    "Solid Contributor",
    "Lagger",
    "Avg Tenure",
  ])
  expect(workbook.getWorksheet("All Members")!.getCell("H2").value).toBe("1y 10m")
  expect(workbook.getWorksheet("Summary by Leader")!.getCell("G2").value).toBe(1)
  expect(workbook.getWorksheet("Summary by Leader")!.getCell("H2").value).toBe(1)
  expect(await xml(result)).not.toContain("SALARY_SENTINEL")
  expect(state.audit).toEqual([
    expect.objectContaining({
      who: admin.id,
      at: environment.at,
      member: "member",
    }),
  ])
})
test("members export denies nonadmin atomically until directory leader join is specified", async () => {
  const state = snapshot(),
    before = structuredClone(state)
  for (const role of ["domain leader", "hr", "finance", "viewer"])
    expect(await exportMembers(state, { ...admin, roles: [role] }, environment)).toMatchObject({
      ok: false,
      status: 403,
    })
  expect(state).toEqual(before)
})
test("parse XLSX reads known sheets, blank columns and formula cache only, without mutating bytes", async () => {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("OPEX")
  sheet.addRow(["Line ID", "Description", "Jan", "Feb", "Total"])
  sheet.addRow(["row", "", null, 0, { formula: "SUM(C2:D2)", result: 0 }])
  sheet.addRow(["second", "literal =WEBSERVICE()", 2, null, { formula: "1+1" }])
  workbook.addWorksheet("Unknown").addRow(["ignored"])
  workbook.addWorksheet("All Members").addRows([
    ["Name", "Start Date"],
    ["Synthetic member", "2025-01-01"],
  ])
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer()),
    before = bytes.slice()
  const { default: JSZip } = await import("jszip")
  const archive = await JSZip.loadAsync(bytes)
  const worksheetXml = await archive.file("xl/worksheets/sheet1.xml")!.async("string")
  // Verify the actual cache, independently of ExcelJS's cell.value getter (which drops zero).
  expect(worksheetXml).toMatch(/<c\b[^>]*\br="E2"[^>]*><f>SUM\(C2:D2\)<\/f><v>0<\/v><\/c>/)
  expect(worksheetXml).toMatch(/<c\b[^>]*\br="E3"[^>]*><f>1\+1<\/f><\/c>/)
  const result = await parseWorkbook(bytes)
  expect(result).toEqual({
    ok: true,
    sheets: {
      OPEX: [
        { "Line ID": "row", Description: "", Jan: null, Feb: 0, Total: 0 },
        {
          "Line ID": "second",
          Description: "literal =WEBSERVICE()",
          Jan: 2,
          Feb: null,
          Total: null,
        },
      ],
      "All Members": [{ Name: "Synthetic member", "Start Date": "2025-01-01" }],
    },
  })
  expect(bytes).toEqual(before)
})
test("invalid XLSX, unsupported sheets, duplicate headers and external links are refused cleanly", async () => {
  expect(await parseWorkbook(new TextEncoder().encode("not an xlsx"))).toMatchObject({ ok: false })
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("OPEX")
  sheet.addRows([
    ["Line ID", "Line ID"],
    ["x", "y"],
  ])
  expect(await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).toMatchObject({ ok: false })
  sheet.getCell("B1").value = "Description"
  sheet.getCell("B2").value = {
    text: "outside",
    hyperlink: "https://example.invalid/private",
  }
  expect(await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).toMatchObject({ ok: false })
})
async function operationsBytes() {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook(),
    sheet = workbook.addWorksheet("Ticket Register")
  sheet.addRow(["Year", 2026])
  sheet.addRow(["Category", "Metric", ...months.flatMap((month) => [month, null])])
  sheet.addRow(["Infrastructure", "Initial Balance", 1, 2, 0, 0])
  sheet.addRow([null, "Opened", 3, 4, 5, 6])
  sheet.addRow([null, "Closed", 1, 2, 3, 4])
  sheet.addRow([null, "Final Balance", 999, 999])
  sheet.addRow(["TOTAL", "Opened", 999, 999])
  workbook.addWorksheet("SLA").addRows([
    ["Year", "Jan"],
    [2026, 17],
  ])
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}
test("Operations source Ticket Register maps paired months and metric labels, excludes totals and never invents SLA/heatmap", async () => {
  const bytes = await operationsBytes(),
    before = bytes.slice()
  const result = await parseOperationsWorkbook(bytes)
  expect(result).toEqual({
    ok: true,
    year: 2026,
    categories: ["Infrastructure"],
    months: {
      "1": {
        "Infrastructure|Incidents|Initial Balance": 1,
        "Infrastructure|Service Requests|Initial Balance": 2,
        "Infrastructure|Incidents|Open": 3,
        "Infrastructure|Service Requests|Open": 4,
        "Infrastructure|Incidents|Closed": 1,
        "Infrastructure|Service Requests|Closed": 2,
      },
      "2": {
        "Infrastructure|Incidents|Initial Balance": 0,
        "Infrastructure|Service Requests|Initial Balance": 0,
        "Infrastructure|Incidents|Open": 5,
        "Infrastructure|Service Requests|Open": 6,
        "Infrastructure|Incidents|Closed": 3,
        "Infrastructure|Service Requests|Closed": 4,
      },
    },
  })
  if (result.ok)
    for (const month of Object.values(result.months)) {
      expect(month).not.toHaveProperty("sla")
      expect(month).not.toHaveProperty("heatmap")
    }
  expect(bytes).toEqual(before)
})
test("Operations requires exact tab, six-month header, numeric data; no invented schema", async () => {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRow(["Jan", "Feb", "Mar"])
  expect(await parseOperationsWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).toMatchObject({ ok: false })
  workbook.addWorksheet("Ticket Register").addRow(["Jan", "Feb", "Mar"])
  expect(await parseOperationsWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).toMatchObject({ ok: false })
})

test("parser treats structured reference formula caches as values and refuses external workbook formula caches", async () => {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook(),
    sheet = workbook.addWorksheet("OPEX")
  sheet.addRows([
    ["Line ID", "Jan", "Total"],
    ["row", 4, { formula: "SUM(Table1[Amount])", result: 4 }],
  ])
  expect(await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).toEqual({
    ok: true,
    sheets: { OPEX: [{ "Line ID": "row", Jan: 4, Total: 4 }] },
  })
  sheet.getCell("C2").value = {
    formula: "'[external.xlsx]Sheet1'!A1",
    result: 123,
  }
  expect(await parseWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).toMatchObject({ ok: false })
  const unknown = new Workbook()
  unknown.addWorksheet("Unknown").addRows([["Name"], ["ignored"]])
  expect(await parseWorkbook(new Uint8Array(await unknown.xlsx.writeBuffer()))).toMatchObject({ ok: false })
})
test("literal spreadsheet-looking member names stay text, all members are audited, and no fields mutate", async () => {
  const state = snapshot()
  state.data.members = [
    {
      id: "one",
      name: '=HYPERLINK("https://example.invalid")',
      type: "",
      leaderId: "",
      start: "",
      status: "Terminated",
    },
    { id: "two", name: "Another synthetic member", status: "On Leave" },
  ]
  const before = structuredClone(state.data)
  const workbook = await open(await exportMembers(state, { ...admin, canWrite: false }, environment))
  expect(workbook.getWorksheet("All Members")!.getCell("A2").value).toBe('=HYPERLINK("https://example.invalid")')
  expect(workbook.getWorksheet("All Members")!.getCell("C2").value).toBe("Employee")
  expect(workbook.getWorksheet("All Members")!.getCell("H2").value).toBe("")
  expect(state.data).toEqual(before)
  expect(state.audit).toEqual([
    expect.objectContaining({
      member: "one",
      who: admin.id,
      at: environment.at,
    }),
    expect.objectContaining({
      member: "two",
      who: admin.id,
      at: environment.at,
    }),
  ])
})
test("Operations follows original 2026 fallback and preserves sparse month keys without selecting months", async () => {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook(),
    sheet = workbook.addWorksheet("Ticket Register")
  sheet.addRow(["Category", "Metric", ...months.flatMap((month) => [month, null])])
  sheet.addRow(["Application", "Open", 1, 0, null, null, 5, 0])
  const result = await parseOperationsWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))
  expect(result).toEqual({
    ok: true,
    year: 2026,
    categories: ["Application"],
    months: {
      "1": {
        "Application|Incidents|Open": 1,
        "Application|Service Requests|Open": 0,
      },
      "3": {
        "Application|Incidents|Open": 5,
        "Application|Service Requests|Open": 0,
      },
    },
  })
  sheet.spliceRows(2, 1)
  expect(await parseOperationsWorkbook(new Uint8Array(await workbook.xlsx.writeBuffer()))).toMatchObject({ ok: false })
})

test("macro-enabled OOXML can be previewed as data without executing or returning macros", async () => {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("Headcount").addRows([
    ["Position ID", "Name"],
    ["position", "Synthetic position"],
  ])
  const { default: JSZip } = await import("jszip")
  const archive = await JSZip.loadAsync(await workbook.xlsx.writeBuffer())
  const content = await archive.file("[Content_Types].xml")!.async("string")
  archive.file(
    "[Content_Types].xml",
    content.replace(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml",
      "application/vnd.ms-excel.sheet.macroEnabled.main+xml",
    ),
  )
  expect(await parseWorkbook(await archive.generateAsync({ type: "uint8array" }))).toEqual({
    ok: true,
    sheets: {
      Headcount: [{ "Position ID": "position", Name: "Synthetic position" }],
    },
  })
})

test("generic parser recognizes Ticket Register through its source-specific month parser", async () => {
  const result = await parseWorkbook(await operationsBytes())
  expect(result.ok).toBe(true)
  if (!result.ok) return
  expect(Object.keys(result.sheets)).toEqual(["Ticket Register"])
  expect(result.sheets["Ticket Register"]).toEqual([
    {
      year: 2026,
      month: 1,
      tickets: {
        "Infrastructure|Incidents|Initial Balance": 1,
        "Infrastructure|Service Requests|Initial Balance": 2,
        "Infrastructure|Incidents|Open": 3,
        "Infrastructure|Service Requests|Open": 4,
        "Infrastructure|Incidents|Closed": 1,
        "Infrastructure|Service Requests|Closed": 2,
      },
    },
    {
      year: 2026,
      month: 2,
      tickets: {
        "Infrastructure|Incidents|Initial Balance": 0,
        "Infrastructure|Service Requests|Initial Balance": 0,
        "Infrastructure|Incidents|Open": 5,
        "Infrastructure|Service Requests|Open": 6,
        "Infrastructure|Incidents|Closed": 3,
        "Infrastructure|Service Requests|Closed": 4,
      },
    },
  ])
  expect(JSON.stringify(result)).not.toContain('"sla"')
  expect(JSON.stringify(result)).not.toContain('"heatmap"')
})

test("technical workbook budgets reject compressed size, expansion, entry count and invalid host overrides", async () => {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([
    ["Line ID", "Description"],
    ["row", "x".repeat(65536)],
  ])
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  expect(await parseWorkbook(bytes, { maxCompressedBytes: bytes.length - 1 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxEntryBytes: 1024 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxExpandedBytes: 1024 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxEntries: 1 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxCells: 0 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxCells: Number.MAX_SAFE_INTEGER })).toMatchObject({ ok: false })
})
test("sparse Operations coordinates are bounded before ExcelJS and accepted sparse rows do not become dense matrices", async () => {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook(),
    sheet = workbook.addWorksheet("Ticket Register")
  sheet.addRow(["Year", 2026])
  sheet.addRow(["Category", "Metric", ...months.flatMap((month) => [month, null])])
  sheet.getCell("A1000").value = "Application"
  sheet.getCell("B1000").value = "Open"
  sheet.getCell("C1000").value = 7
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  expect(await parseOperationsWorkbook(bytes, { maxRows: 999 })).toMatchObject({ ok: false })
  expect(await parseOperationsWorkbook(bytes, { maxRows: 1000 })).toEqual({
    ok: true,
    year: 2026,
    categories: ["Application"],
    months: { "1": { "Application|Incidents|Open": 7 } },
  })
  expect(await parseOperationsWorkbook(bytes, { maxColumns: 20 })).toMatchObject({ ok: false })
})
test("XML relationship character entities cannot hide external targets; DTDs are refused", async () => {
  const { default: JSZip } = await import("jszip")
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([["Line ID"], ["row"]])
  const original = await workbook.xlsx.writeBuffer()
  for (const relationship of [
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r" Type="example" TargetMode="Ext&#101;rnal" Target="https://example.invalid"/></Relationships>',
    '<!DOCTYPE Relationships [<!ENTITY outside "External">]><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r" Type="example" TargetMode="&outside;" Target="https://example.invalid"/></Relationships>',
  ]) {
    const archive = await JSZip.loadAsync(original)
    archive.file("custom/_rels/unused.xml.rels", relationship)
    expect(await parseWorkbook(await archive.generateAsync({ type: "uint8array" }))).toMatchObject({ ok: false })
  }
})

test("lying ZIP expanded sizes are stopped by actual streaming byte counts", async () => {
  const { default: JSZip } = await import("jszip")
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([["Line ID"], ["row"]])
  const archive = await JSZip.loadAsync(await workbook.xlsx.writeBuffer())
  archive.file("bomb.bin", "x".repeat(65536))
  const bytes = await archive.generateAsync({ type: "uint8array", compression: "DEFLATE" })
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const decoder = new TextDecoder()
  for (let offset = 0; offset + 46 <= bytes.length; offset++) {
    if (view.getUint32(offset, true) !== 0x02014b50) continue
    const length = view.getUint16(offset + 28, true)
    if (decoder.decode(bytes.subarray(offset + 46, offset + 46 + length)) !== "bomb.bin") continue
    view.setUint32(offset + 24, 1, true)
    const local = view.getUint32(offset + 42, true)
    view.setUint32(local + 22, 1, true)
  }
  expect(await parseWorkbook(bytes, { maxEntryBytes: 32768 })).toEqual({
    ok: false,
    errors: ["Workbook actual expansion limit"],
  })
})
test("XML column definitions, merges, cells, nodes, text and output allocations obey technical limits", async () => {
  const { default: JSZip } = await import("jszip")
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([
    ["Line ID", "Jan"],
    ["row", 1],
  ])
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  expect(await parseWorkbook(bytes, { maxCells: 1 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxXmlNodes: 1 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxTextLength: 8 })).toMatchObject({ ok: false })
  expect(await parseWorkbook(bytes, { maxOutputCells: 2 })).toMatchObject({ ok: false })
  for (const payload of [
    '<cols><col min="1" max="16384" width="10"/></cols><sheetData/>',
    '<sheetData/><mergeCells><mergeCell ref="A1:IV20000"/></mergeCells>',
    '<sheetData><row r="20001"><c r="A20001" t="n"><v>1</v></c></row></sheetData>',
  ]) {
    const archive = await JSZip.loadAsync(bytes)
    archive.file(
      "xl/worksheets/sheet1.xml",
      `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">${payload}</worksheet>`,
    )
    expect(await parseWorkbook(await archive.generateAsync({ type: "uint8array" }))).toMatchObject({ ok: false })
  }
})

test("ExcelJS XML consumer aliases cannot bypass sparse-coordinate and merge preflight", async () => {
  const { default: JSZip } = await import("jszip")
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.addWorksheet("OPEX").addRows([["Line ID"], ["row"]])
  const original = await workbook.xlsx.writeBuffer()
  for (const name of [
    "xl/worksheets/sheet9.xml.extra",
    "prefix/xl/worksheets/sheet9.xml",
    "xl//worksheets/sheet9.xml",
    "xl/tables/table1.xml.extra",
    "xl/drawings/drawing1.xml.extra",
    "xl/theme/theme1.xml.extra",
    "xl/worksheets/_rels/sheet1.xml.rels.extra",
    "xl/worksheets/_rels/sheet1.xmlXrels",
    "xl/drawings/_rels/drawing1.xml.rels.extra",
    "xl/comments1.xml.extra",
    "xl/drawings/vmlDrawing1.vml.extra",
  ]) {
    const archive = await JSZip.loadAsync(original)
    archive.file(
      name,
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1048576"><c r="XFD1048576"><v>1</v></c></row></sheetData><mergeCells><mergeCell ref="A1:XFD1048576"/></mergeCells></worksheet>',
      { createFolders: false },
    )
    expect(await parseWorkbook(await archive.generateAsync({ type: "uint8array" }))).toMatchObject({ ok: false })
  }
})
