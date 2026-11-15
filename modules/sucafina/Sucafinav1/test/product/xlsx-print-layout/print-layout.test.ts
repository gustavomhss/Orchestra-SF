import { expect, test } from "bun:test"
import JSZip from "jszip"
import { Workbook } from "exceljs"
import { legacyDownloadFixture } from "../export-artifact-closure/legacy-fixture.ts"
import { recordExportEvidence } from "../export-artifact-closure/evidence.ts"

type PrintSpec = {
  name: string
  paper: number
  orientation: "portrait" | "landscape"
  pagesWide: number
  repeatHeader: boolean
}

const plannerSpecs: PrintSpec[] = [
  { name: "Info", paper: 9, orientation: "landscape", pagesWide: 1, repeatHeader: false },
  { name: "OPEX", paper: 8, orientation: "landscape", pagesWide: 2, repeatHeader: true },
  { name: "CAPEX", paper: 8, orientation: "landscape", pagesWide: 2, repeatHeader: true },
  { name: "Headcount", paper: 8, orientation: "landscape", pagesWide: 1, repeatHeader: true },
  { name: "Rate cards", paper: 9, orientation: "landscape", pagesWide: 1, repeatHeader: true },
  { name: "FX rates", paper: 9, orientation: "portrait", pagesWide: 1, repeatHeader: true },
]
const memberSpecs: PrintSpec[] = ["All Members", "Summary by Leader"].map((name) => ({
  name, paper: 8, orientation: "landscape" as const, pagesWide: 1, repeatHeader: true,
}))
const templateSpecs: PrintSpec[] = [
  { name: "OPEX", paper: 9, orientation: "landscape", pagesWide: 1, repeatHeader: true },
]

function attributes(tag: string) {
  return Object.fromEntries([...tag.matchAll(/(\w+)="([^"]*)"/g)].map((match) => [match[1]!, match[2]!]))
}

/** Inspect the actual ZIP parts, not a mirrored model of production print settings. */
async function inspect(bytes: Uint8Array, specs: PrintSpec[]) {
  const zip = await JSZip.loadAsync(bytes, { checkCRC32: true })
  const mainXml = await zip.file("xl/workbook.xml")?.async("string")
  if (!mainXml) throw new Error("Missing OOXML workbook")
  const names = new Map<string, string>()
  for (const match of mainXml.matchAll(/<definedName\b([^>]*)>([^<]*)<\/definedName>/g)) {
    const attr = attributes(match[1]!)
    names.set((attr.localSheetId ?? "") + ":" + attr.name,
      match[2]!.replaceAll("&apos;", "'").replaceAll("$", "").replaceAll("'", ""))
  }
  const book = new Workbook()
  await book.xlsx.load(new Uint8Array(bytes).buffer)
  expect(book.worksheets.map((sheet) => sheet.name)).toEqual(specs.map((spec) => spec.name))
  for (const [index, spec] of specs.entries()) {
    const sheet = book.worksheets[index]!
    const xml = await zip.file("xl/worksheets/sheet" + (index + 1) + ".xml")?.async("string")
    if (!xml) throw new Error("Missing sheet " + spec.name)
    const page = xml.match(/<pageSetup\b([^>]*)\/>/)
    if (!page) throw new Error("Missing pageSetup for " + spec.name)
    const attr = attributes(page[1]!)
    expect(attr.paperSize).toBe(String(spec.paper))
    expect(attr.orientation).toBe(spec.orientation)
    expect(attr.fitToWidth).toBe(String(spec.pagesWide))
    expect(attr.fitToHeight).toBe("0")
    expect(xml).toMatch(/<pageSetUpPr\b[^>]*fitToPage="1"/)
    const margin = xml.match(/<pageMargins\b([^>]*)\/>/)
    if (!margin) throw new Error("Missing pageMargins")
    const m = attributes(margin[1]!)
    expect(m.left).toBe("0.25")
    expect(m.right).toBe("0.25")
    expect(m.top).toBe("0.5")
    expect(m.bottom).toBe("0.5")
    const usedEnd = sheet.getColumn(sheet.columnCount).letter + sheet.rowCount
    expect(names.get(index + ":_xlnm.Print_Area")).toBe(spec.name + "!A1:" + usedEnd)
    expect(names.get(index + ":_xlnm.Print_Titles")).toBe(
      spec.repeatHeader ? spec.name + "!1:1" : undefined,
    )
    // Every exported sheet is non-empty at least at its header/title row.
    expect(sheet.rowCount).toBeGreaterThan(0)
    expect(sheet.columnCount).toBeGreaterThan(0)
  }
  return { zip, book }
}

async function actualDownload(
  fixture: Awaited<ReturnType<typeof legacyDownloadFixture>>,
  user: string,
  surface: "planner" | "dashboard",
  kind: string,
) {
  const response = await fixture.serve(fixture.request(user, surface, {
    download: kind, ...(kind === "xlsx" ? { version: "v66" } : {}),
  }))
  expect(response?.status).toBe(200)
  if (!response || response.status !== 200) throw new Error("Product export failed: " + response?.status)
  expect(response.headers.get("cache-control")).toBe("no-store")
  return {
    name: kind + ".xlsx",
    mediaType: response.headers.get("content-type") ?? "",
    bytes: new Uint8Array(await response.arrayBuffer()),
  }
}

type Scenario = "normal" | "empty" | "wide" | "long"

async function arrange(fixture: Awaited<ReturnType<typeof legacyDownloadFixture>>, scenario: Scenario) {
  if (scenario === "normal") return
  await fixture.store.transaction("planner", async (snapshot) => {
    const versions = snapshot.data.versions as Record<string, Record<string, unknown>>
    const version = versions.v66!
    if (scenario === "empty") {
      version.lines = []
      version.projects = []
      version.fx = []
      version.hc = { inc: 10, incMonth: 7, positions: [], rates: [], hrAF: {} }
    } else {
      const count = scenario === "wide" ? 2 : 120
      const lines = Array.from({ length: count }, (_, index) => ({
        id: "print-layout-" + index,
        sec: index % 2 ? "capex" : "opex",
        proj: "print-project",
        el: "licenses",
        name: "Synthetic vendor " + index,
        desc: "Synthetic long note " + ("ação 2026 / comparison ".repeat(scenario === "wide" ? 12 : 3)),
        owner: "Owner 102",
        cur: "EUR",
        b: Array(12).fill(index + 1),
        a: Array(12).fill(null),
        f: Array(12).fill(index + 2),
      }))
      version.lines = [...(version.lines as unknown[]), ...lines]
      version.projects = [{ id: "print-project", code: "P102", name: "Synthetic print project", owner: "Owner 102" }]
    }
    return { commit: true, value: undefined }
  })
  await fixture.store.transaction("dashboard", async (snapshot) => {
    if (scenario === "empty") {
      snapshot.data.members = []
      snapshot.data.leaders = []
    } else {
      const count = scenario === "wide" ? 8 : 120
      const leaders = Array.from({ length: scenario === "wide" ? 2 : 12 }, (_, index) => ({
        id: "print-leader-" + index, name: "Synthetic leader " + index, domain: "Finance", location: "Example",
      }))
      snapshot.data.leaders = [...(snapshot.data.leaders as unknown[]), ...leaders]
      snapshot.data.members = [...(snapshot.data.members as unknown[]), ...Array.from({ length: count }, (_, index) => ({
        id: "print-member-" + index,
        name: "Synthetic member layout " + index,
        title: "Financial Operations Specialist",
        type: index % 2 ? "Contractor" : "Employee",
        leaderId: leaders[index % leaders.length]!.id,
        location: "Example",
        start: "2025-01-01",
        end: "",
        status: "Active",
        cls: "Talent",
        outlook: "Stay",
        notes: "Synthetic note " + "Café ação euro ".repeat(scenario === "wide" ? 16 : 8),
        salary: "PRIVATE_SALARY_LAYOUT_102",
      })) ]
    }
    return { commit: true, value: undefined }
  })
}

test.each(["normal", "empty", "wide", "long"] as Scenario[])(
  "VIS88-002/003 %s — production HTTP XLSX + OOXML print range, scaling and source content",
  async (scenario) => {
    const fixture = await legacyDownloadFixture()
    try {
      await arrange(fixture, scenario)
      const planner = await actualDownload(fixture, "viewer", "planner", "xlsx")
      const plannerResult = await inspect(planner.bytes, plannerSpecs)
      const info = plannerResult.book.getWorksheet("Info")!
      expect(info.getCell("B3").value).toBe("v66")
      const opex = plannerResult.book.getWorksheet("OPEX")!
      const capex = plannerResult.book.getWorksheet("CAPEX")!
      expect(opex.getCell("A1").value).toBe("Line ID")
      expect(capex.getCell("X1").value).toBe("Total")
      if (scenario !== "empty") {
        expect(opex.getCell("C2").value).toBe('=HYPERLINK("https://example.invalid","literal")')
        expect(opex.getCell("C2").formula).toBeUndefined()
        expect(opex.getCell("V2").value).toEqual({ formula: "SUM(J2:U2)", result: 24 })
        expect(plannerResult.book.getWorksheet("Headcount")!.getCell("L2").value).toBeNull()
      }
      if (scenario === "empty") {
        expect(opex.rowCount).toBe(1)
        expect(capex.rowCount).toBe(1)
      }
      if (scenario === "wide") expect(capex.rowCount).toBe(4)
      if (scenario === "long") {
        expect(opex.rowCount).toBeGreaterThan(170)
        expect(capex.rowCount).toBeGreaterThan(170)
      }
      const plannerXml = (await Promise.all(Object.entries(plannerResult.zip.files)
        .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
        .map(([, file]) => file.async("string")))).join("\n")
      for (const secret of ["PRIVATE_RATE_SENTINEL_66", "987654.32", "123456.78"])
        expect(plannerXml).not.toContain(secret)
      await recordExportEvidence({
        caseId: "layout102-planner-" + scenario, ...planner,
        observations: { mission: 102, scenario, source: "production authenticated XLSX HTTP", sheets: plannerSpecs.map((s) => s.name),
          formula_and_privacy_checked: true, ooxml_print_settings_checked: true,
          rendered_pages: "PENDING_101_HOSTED_READER88" },
      })

      const members = await actualDownload(fixture, "admin", "dashboard", "members")
      const membersResult = await inspect(members.bytes, memberSpecs)
      expect(membersResult.book.getWorksheet("All Members")!.getCell("A1").value).toBe("Name")
      if (scenario !== "empty") {
        expect(membersResult.book.getWorksheet("All Members")!.getCell("A2").value).toBe("Synthetic member 66")
        expect(membersResult.book.getWorksheet("All Members")!.getCell("L2").value).toBe("Ação — synthetic note")
      }
      if (scenario === "empty") {
        expect(membersResult.book.getWorksheet("All Members")!.rowCount).toBe(1)
        expect(membersResult.book.getWorksheet("Summary by Leader")!.rowCount).toBe(1)
      }
      if (scenario === "long") expect(membersResult.book.getWorksheet("All Members")!.rowCount).toBe(122)
      const memberXml = (await Promise.all(Object.entries(membersResult.zip.files)
        .filter(([name]) => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))
        .map(([, file]) => file.async("string")))).join("\n")
      expect(memberXml).not.toContain("SALARY_SENTINEL_66")
      expect(memberXml).not.toContain("PRIVATE_SALARY_LAYOUT_102")
      await recordExportEvidence({
        caseId: "layout102-members-" + scenario, ...members,
        observations: { mission: 102, scenario, source: "production authenticated members HTTP", sheets: memberSpecs.map((s) => s.name),
          private_salary_absent: true, ooxml_print_settings_checked: true, rendered_pages: "PENDING_101_HOSTED_READER88" },
      })

      if (scenario === "normal") {
        const template = await actualDownload(fixture, "admin", "dashboard", "opex-template")
        const result = await inspect(template.bytes, templateSpecs)
        expect(result.book.getWorksheet("OPEX")!.getRow(1).values).toEqual([
          undefined, "Owner", "Annual", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
        ])
        expect(result.book.getWorksheet("OPEX")!.rowCount).toBe(1)
        await recordExportEvidence({
          caseId: "layout102-opex-template", ...template,
          observations: { mission: 102, scenario: "header-only", source: "production authenticated template HTTP",
            ooxml_print_settings_checked: true, rendered_pages: "PENDING_101_HOSTED_READER88" },
        })
        expect((await fixture.serve(fixture.request("viewer", "dashboard", { download: "members" })))?.status).toBe(403)
        expect((await fixture.serve(fixture.request("viewer", "dashboard", { download: "opex-template" })))?.status).toBe(403)
      }
    } finally {
      await fixture.close()
    }
  },
  120000,
)
