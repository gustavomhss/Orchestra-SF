import { cents, chosenRate, hrMonth, hrLineDomains, syntheticHr, usdAmount } from "../src/planner-accounts.ts"
import type { Position, RateCard, HrAf } from "../src/planner-accounts.ts"
import { finite, object, rows, text } from "./contract.ts"
import type { Actor, Environment, Snapshot } from "./contract.ts"
import type { ArtifactResult } from "./artifact.ts"
import type { Cell, CellValue, Worksheet } from "exceljs"

const type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
const elements = [
  { key: "licenses", name: "Licenses" },
  { key: "services", name: "Services" },
  { key: "hwo", name: "Hardware" },
  { key: "depr", name: "Depreciation" },
  { key: "hr", name: "HR Staff" },
  { key: "fac", name: "Facilities" },
  { key: "te", name: "Travel & Expenses" },
  { key: "oth", name: "Others" },
]
const plannerSheets = ["Info", "OPEX", "CAPEX", "Headcount", "Rate cards", "FX rates"]
const domains = ["Application Management", "Infrastructure & Security", "IT Engineering", "CIO Office"]

export async function exportPlanner(
  snapshot: Snapshot,
  actor: Actor,
  environment: Environment,
  versionID?: string,
): Promise<ArtifactResult> {
  if (!actor.roles.some((role) => ["admin", "hr", "finance", "budget owner", "viewer"].includes(role)))
    return { ok: false, status: 403 }
  const app = object(snapshot.data.app)
  const versions = Array.isArray(snapshot.data.versions)
    ? rows(snapshot.data.versions)
    : Object.entries(object(snapshot.data.versions)).map<Record<string, unknown>>(([id, value]) => ({
        ...object(value),
        id: object(value).id ?? id,
      }))
  const selected = versionID ?? (text(snapshot.data.curId) || text(app.officialId))
  const version = selected
    ? versions.find((version) => String(version.id) === selected)
    : versions.toSorted((a, b) => text(a.created).localeCompare(text(b.created))).at(-1)
  if (!version) return { ok: false, status: 404, errors: ["Planner version not found"] }
  const salary = actor.roles.some((role) => ["admin", "hr", "finance"].includes(role))
  const hc = object(version.hc)
  const rates: RateCard[] = rows(hc.rates).map((rate) => ({
    id: String(rate.id ?? ""),
    name: text(rate.name),
    locs: text(rate.locs),
    annual: finite(rate.annual),
    cur: text(rate.cur) || "USD",
  }))
  const fx = rows(version.fx)
  const positions = rows(hc.positions).map((position) => {
    const rate = chosenRate(
      rates,
      text(position.type),
      text(position.location),
      position.rateId == null ? null : String(position.rateId),
      typeof position.rateOverride === "number" || typeof position.rateOverride === "string"
        ? position.rateOverride
        : null,
    )
    const multiplier = usdAmount(
      1,
      rate?.cur ?? "USD",
      finite(fx.find((entry) => entry.cur === rate?.cur)?.rate, 0),
    ).usd
    return {
      source: position,
      calculated: {
        include: position.include === true,
        domain: text(position.domain) || "Unassigned",
        fte: finite(position.fte),
        start: finite(position.start, 1) || 1,
        end: finite(position.end, 12) || 12,
        type: text(position.type),
        location: text(position.location),
        rateId: position.rateId == null ? "" : String(position.rateId),
        rateOverride:
          typeof position.rateOverride === "number" || typeof position.rateOverride === "string"
            ? position.rateOverride
            : null,
        months: months.map((_, index) =>
          hrMonth(
            position.include === true,
            rate !== null,
            finite(position.fte),
            rate?.annual ?? 0,
            multiplier,
            index + 1,
            finite(position.start, 1) || 1,
            finite(position.end, 12) || 12,
            finite(hc.incMonth, 1) || 1,
            finite(hc.inc),
          ),
        ),
      } satisfies Position,
    }
  })
  // Both migrated hc.hrAF and the original version-level hrAF are accepted without changing either shape.
  const hrAF = object(hc.hrAF ?? version.hrAF)
  const synthetic = hrLineDomains(
    positions.map((position) => position.calculated),
    hrAF,
  )
    .toSorted((a, b) => {
      const left = domains.indexOf(a),
        right = domains.indexOf(b)
      return (left < 0 ? 99 : left) - (right < 0 ? 99 : right) || a.localeCompare(b)
    })
    .map((domain) => {
      const group = positions
        .filter((position) => position.calculated.domain === domain)
        .map((position) => position.calculated)
      const stored = object(hrAF[domain])
      const af: HrAf = {
        a: nullableMonths(stored.a),
        f: nullableMonths(stored.f),
        owner: owner(stored.owner),
        entity: text(stored.entity),
        alloc: text(stored.alloc),
      }
      const aggregate = syntheticHr(domain, group, af)
      const fte = group
        .filter((position) => position.include && position.start <= 12 && position.end >= 12)
        .reduce((sum, position) => sum + position.fte, 0)
      return {
        id: `HR:${domain}`,
        sec: "opex",
        el: "hr",
        synthetic: true,
        name: domain,
        desc: `${group.filter((position) => position.include).length} positions · ${Number(fte.toFixed(2))} FTE`,
        owner: aggregate.owner,
        entity: aggregate.entity,
        alloc: aggregate.alloc,
        cur: "USD",
        b: aggregate.budget,
        a: aggregate.actual,
        f: aggregate.forecast,
      }
    })
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  workbook.calcProperties.fullCalcOnLoad = true
  const info = workbook.addWorksheet("Info")
  info.addRows([
    ["IT Budget Planner — upload workbook"],
    [],
    ["Version ID", String(version.id ?? "")],
    ["Version", text(version.name)],
    ["Budget year", finite(version.year)],
    ["Currency", "USD"],
    ["Actuals closed through", finite(version.closed) ? (months[finite(version.closed) - 1] ?? "none") : "none"],
    ["Exported", environment.at.slice(0, 16).replace("T", " ")],
    [],
    ["How to use"],
    [
      "1. Edit amounts on the OPEX, CAPEX, Headcount and Rate cards sheets. Keep the Line ID / Position ID / Rate ID columns as they are.",
    ],
    [
      "2. Each line has three rows: Budget, Actual and Forecast. Leave a Forecast month empty to use the budget for it.",
    ],
    [
      "3. To add a line, add rows with an empty Line ID and fill Cost element (OPEX) or Project + Cost element (CAPEX). A new project name creates the project.",
    ],
    [
      "4. HR Staff budget rows come from headcount and are ignored on import; their Actual, Forecast and Owner are imported.",
    ],
    [
      "5. Owner: the person accountable for the line. On CAPEX, a line with no owner of its own takes the Project owner.",
    ],
    ["6. Entity and Allocation (OPEX): use names from the lists below, as set up in the Entities & allocations tab."],
    [
      "7. CAPEX: Project code identifies the project. Leave it empty for a new project and the app assigns the next code.",
    ],
    ["8. CAPEX: Classification is CAPEX (capitalised) or OPEX (expensed). Empty means CAPEX for a new line."],
    [
      "9. Currency: amounts on each row are in that row's currency. Rates are on the FX rates sheet (USD per 1 unit); all totals in the app are in USD.",
    ],
    ["10. In the app, use Import Excel. You can update this version or load the file as a new version."],
    [],
    ["Valid OPEX cost elements", elements.map((element) => element.name).join(", ")],
    [
      "Valid CAPEX project cost elements",
      elements
        .filter((element) => element.key !== "depr")
        .map((element) => element.name)
        .join(", "),
    ],
    ["Valid classifications (CAPEX sheet)", "CAPEX, OPEX"],
    ["Measures", "Budget, Actual, Forecast"],
    [
      "Valid entities",
      rows(app.entities)
        .map((entity) => text(entity.name))
        .join(", ") || "(none set up)",
    ],
    [
      "Valid allocations",
      rows(app.allocations)
        .map((allocation) => text(allocation.name))
        .join(", ") || "(none set up)",
    ],
    ["Valid currencies", ["USD", ...fx.map((entry) => text(entry.cur))].join(", ")],
  ])
  const opex = workbook.addWorksheet("OPEX")
  opex.addRow([
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
  const lines = rows(version.lines)
  elements.forEach((element) => {
    const selected = [
      ...(element.key === "hr" ? synthetic : []),
      ...lines.filter((line) => line.sec === "opex" && line.el === element.key),
    ]
    selected.forEach((line) =>
      addLine(
        opex,
        [
          scalar(line.id),
          element.name,
          text(line.name),
          text(line.desc),
          owner(line.owner),
          optionName(app.entities, line.entity),
          optionName(app.allocations, line.alloc),
          text(line.cur) || "USD",
        ],
        line,
        10,
      ),
    )
  })
  const capex = workbook.addWorksheet("CAPEX")
  capex.addRow([
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
  rows(version.projects).forEach((project) =>
    lines
      .filter((line) => line.sec === "capex" && line.proj === project.id)
      .forEach((line) => {
        addLine(
          capex,
          [
            scalar(line.id),
            text(project.code),
            text(project.name),
            owner(project.owner),
            elements.find((element) => element.key !== "depr" && element.key === line.el)?.name ?? "Others",
            text(line.name),
            text(line.desc),
            owner(line.owner) || owner(project.owner),
            text(line.cls).toLowerCase() === "opex" ? "OPEX" : "CAPEX",
            text(line.cur) || "USD",
          ],
          line,
          12,
        )
      }),
  )
  const headcount = workbook.addWorksheet("Headcount")
  headcount.addRow([
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
  positions.forEach((position) => {
    const source = position.source
    headcount.addRow([
      scalar(source.id),
      source.include ? "Y" : "N",
      text(source.name),
      text(source.title),
      text(source.domain),
      text(source.location),
      text(source.type),
      salary ? (rates.find((rate) => rate.id === String(source.rateId))?.name ?? "") : null,
      finite(source.fte),
      months[(finite(source.start, 1) || 1) - 1] ?? "",
      months[(finite(source.end, 12) || 12) - 1] ?? "",
      salary ? scalar(source.rateOverride) : null,
      salary ? cents(position.calculated.months.reduce((sum, value) => sum + value, 0)) : null,
    ])
  })
  const cards = workbook.addWorksheet("Rate cards")
  cards.addRow(["Rate ID", "Rate card", "Locations", "Currency", "Annual cost per FTE"])
  if (salary) rates.forEach((rate) => cards.addRow([rate.id, rate.name, rate.locs, rate.cur, rate.annual]))
  const fxSheet = workbook.addWorksheet("FX rates")
  fxSheet.addRow(["Currency", "USD per 1 unit"])
  fx.forEach((entry) => fxSheet.addRow([text(entry.cur), scalar(entry.rate)]))
  workbook.eachSheet((sheet) => {
    sheet.views = [{ state: "frozen", ySplit: 1 }]
    sheet.columns.forEach((column) => {
      column.width = 20
    })
    if (sheet.name !== "Info")
      sheet.autoFilter = {
        from: { row: 1, column: 1 },
        to: { row: sheet.rowCount, column: sheet.columnCount },
      }
  })
  return {
    ok: true,
    name: `IT_Budget_Planner_${String(version.year ?? "")}.xlsx`,
    type,
    bytes: new Uint8Array(await workbook.xlsx.writeBuffer()),
  }
}

function scalar(value: unknown): string | number | boolean | null {
  return typeof value === "string" ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
    ? value
    : null
}
function owner(value: unknown) {
  return typeof value === "string" ? value : text(object(value).name)
}
function optionName(options: unknown, id: unknown) {
  return text(rows(options).find((option) => option.id === id)?.name)
}
function nullableMonths(value: unknown): (number | null)[] {
  return months.map((_, index) =>
    Array.isArray(value) && typeof value[index] === "number" && Number.isFinite(value[index]) ? value[index] : null,
  )
}
function addLine(
  sheet: Worksheet,
  base: (string | number | boolean | null)[],
  line: Record<string, unknown>,
  first: number,
) {
  ;[
    ["b", line.synthetic ? "Budget (from headcount)" : "Budget"],
    ["a", "Actual"],
    ["f", "Forecast"],
  ].forEach(([key, label]) => {
    const values = nullableMonths(line[key!])
    const row = sheet.addRow([...base, label, ...values])
    row.getCell(first + 12).value = {
      formula: `SUM(${first === 10 ? "J" : "L"}${row.number}:${first === 10 ? "U" : "W"}${row.number})`,
      result: cents(values.reduce<number>((sum, value) => sum + (value ?? 0), 0)),
    }
  })
}

export async function exportMembers(
  snapshot: Snapshot,
  actor: Actor,
  environment: Environment,
): Promise<ArtifactResult> {
  // §11 has no directory-account ↔ dashboard leader join. No guessed identity grants talent access.
  if (!actor.roles.includes("admin")) return { ok: false, status: 403 }
  if (!Number.isFinite(Date.parse(environment.at)))
    return {
      ok: false,
      status: 422,
      errors: ["Valid export timestamp required"],
    }
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const members = rows(snapshot.data.members)
  const leaders = rows(snapshot.data.leaders)
  snapshot.audit.push(
    ...members.map((member) => ({
      who: actor.id,
      at: environment.at,
      member: member.id,
      record: `member:${String(member.id ?? "")}`,
      was: null,
      became: null,
    })),
  )
  const all = workbook.addWorksheet("All Members")
  all.addRow([
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
  members.forEach((member) =>
    all.addRow([
      text(member.name),
      text(member.title),
      member.type === "Contractor" ? "Contractor" : "Employee",
      text(leaders.find((leader) => leader.id === member.leaderId)?.name),
      text(member.location),
      text(member.start),
      text(member.end),
      tenure(member.start, environment.at)?.label ?? "",
      text(member.status),
      text(member.cls),
      text(member.outlook),
      text(member.notes),
    ]),
  )
  const summary = workbook.addWorksheet("Summary by Leader")
  summary.addRow([
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
  leaders.forEach((leader) => {
    const group = members.filter((member) => member.leaderId === leader.id)
    const active = group.filter((member) => member.status === "Active")
    const tenures = active.map((member) => tenure(member.start, environment.at)).filter((value) => value !== undefined)
    const average = tenures.length
      ? Math.round(tenures.reduce((sum, value) => sum + value.months, 0) / tenures.length)
      : 0
    summary.addRow([
      text(leader.name),
      text(leader.domain),
      text(leader.location),
      group.length,
      active.length,
      active.filter((member) => member.type !== "Contractor").length,
      active.filter((member) => member.type === "Contractor").length,
      ...["Talent", "Solid Contributor", "Lagger"].map(
        (classification) => active.filter((member) => member.cls === classification).length,
      ),
      average >= 12 ? `${Math.floor(average / 12)}y ${average % 12}m` : average ? `${average}m` : "—",
    ])
  })
  workbook.eachSheet((sheet) => {
    sheet.columns.forEach((column) => {
      column.width = 22
    })
    sheet.views = [{ state: "frozen", ySplit: 1 }]
  })
  return {
    ok: true,
    name: `headcount_export_${environment.at.slice(0, 10)}.xlsx`,
    type,
    bytes: new Uint8Array(await workbook.xlsx.writeBuffer()),
  }
}
function tenure(start: unknown, at: string) {
  if (!text(start) || !Number.isFinite(Date.parse(text(start)))) return undefined
  const beginning = new Date(text(start)),
    now = new Date(at)
  const months = (now.getUTCFullYear() - beginning.getUTCFullYear()) * 12 + now.getUTCMonth() - beginning.getUTCMonth()
  return {
    months,
    label: Math.floor(months / 12) > 0 ? `${Math.floor(months / 12)}y ${months % 12}m` : `${months % 12}m`,
  }
}

/** Technical resource ceilings, unrelated to procurement/business attachment limits.
 * Hosts may reduce any ceiling through the optional parser argument; raising one is rejected.
 * Expanded bytes include every ZIP member, even sheets/media the preview does not use.
 */
export const WORKBOOK_LIMITS = Object.freeze({
  maxCompressedBytes: 16 * 1024 * 1024,
  maxEntryBytes: 16 * 1024 * 1024,
  maxExpandedBytes: 64 * 1024 * 1024,
  maxEntries: 512,
  maxPathLength: 512,
  maxPathDepth: 16,
  maxSheets: 32,
  maxRows: 20000,
  maxColumns: 256,
  maxCells: 200000,
  maxOutputCells: 500000,
  maxTextLength: 1024 * 1024,
  maxXmlNodes: 1000000,
  maxXmlDepth: 64,
  maxMergedCells: 200000,
  maxMergeRanges: 1024,
})
export type WorkbookLimits = { [Key in keyof typeof WORKBOOK_LIMITS]: number }

function workbookLimits(overrides: Partial<WorkbookLimits>): WorkbookLimits {
  if (Object.keys(overrides).some((key) => !Object.hasOwn(WORKBOOK_LIMITS, key)))
    throw new Error("Unknown workbook limit")
  const limits = { ...WORKBOOK_LIMITS, ...overrides }
  for (const key of Object.keys(WORKBOOK_LIMITS) as (keyof WorkbookLimits)[]) {
    if (!Number.isSafeInteger(limits[key]) || limits[key] <= 0 || limits[key] > WORKBOOK_LIMITS[key])
      throw new Error("Invalid workbook limit")
  }
  return limits
}

// Parse the central directory ourselves BEFORE handing anything to a ZIP/XML library.
// ZIP64, encryption, split archives, duplicate/unsafe names and inconsistent local headers fail closed.
function zipEntries(bytes: Uint8Array, limits: WorkbookLimits) {
  if (bytes.length > limits.maxCompressedBytes || bytes.length < 22)
    throw new Error("Workbook compressed-byte limit or invalid ZIP")
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const candidates: number[] = []
  for (let offset = bytes.length - 22; offset >= Math.max(0, bytes.length - 65557); offset--) {
    if (view.getUint32(offset, true) === 0x06054b50 && offset + 22 + view.getUint16(offset + 20, true) === bytes.length)
      candidates.push(offset)
  }
  if (candidates.length !== 1) throw new Error("Invalid ZIP directory")
  const end = candidates[0]!
  const count = view.getUint16(end + 10, true),
    size = view.getUint32(end + 12, true),
    start = view.getUint32(end + 16, true)
  if (
    view.getUint16(end + 4, true) ||
    view.getUint16(end + 6, true) ||
    view.getUint16(end + 8, true) !== count ||
    count === 65535 ||
    count > limits.maxEntries ||
    start + size !== end
  )
    throw new Error("ZIP directory limit or unsupported ZIP layout")
  const decoder = new TextDecoder("utf-8", { fatal: true })
  const entries: { name: string; compressed: Uint8Array; method: number; size: number; offset: number; end: number }[] =
    []
  const state = { offset: start, expanded: 0 }
  for (let index = 0; index < count; index++) {
    const offset = state.offset
    if (offset + 46 > end || view.getUint32(offset, true) !== 0x02014b50) throw new Error("Invalid ZIP directory entry")
    const flags = view.getUint16(offset + 8, true),
      method = view.getUint16(offset + 10, true)
    const compressed = view.getUint32(offset + 20, true),
      expanded = view.getUint32(offset + 24, true)
    const nameLength = view.getUint16(offset + 28, true),
      extraLength = view.getUint16(offset + 30, true),
      commentLength = view.getUint16(offset + 32, true)
    const local = view.getUint32(offset + 42, true)
    state.offset += 46 + nameLength + extraLength + commentLength
    if (
      state.offset > end ||
      flags & 0x2041 ||
      ![0, 8].includes(method) ||
      view.getUint16(offset + 34, true) ||
      local + 30 > start
    )
      throw new Error("Unsupported ZIP entry")
    const name = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength))
    if (
      !name ||
      name.length > limits.maxPathLength ||
      name.split("/").length > limits.maxPathDepth ||
      name
        .replace(/\/$/, "")
        .split("/")
        .some((part) => !part) ||
      name.startsWith("/") ||
      name.includes("\\") ||
      name.includes("\0") ||
      name.split("/").some((part) => part === ".." || part === ".") ||
      entries.some((entry) => entry.name === name)
    )
      throw new Error("Unsafe or duplicate ZIP entry")
    state.expanded += expanded
    if (
      expanded > limits.maxEntryBytes ||
      state.expanded > limits.maxExpandedBytes ||
      compressed === 0xffffffff ||
      expanded === 0xffffffff
    )
      throw new Error("Workbook declared expansion limit")
    if (
      view.getUint32(local, true) !== 0x04034b50 ||
      view.getUint16(local + 6, true) !== flags ||
      view.getUint16(local + 8, true) !== method
    )
      throw new Error("Inconsistent ZIP local header")
    const localNameLength = view.getUint16(local + 26, true),
      localExtraLength = view.getUint16(local + 28, true)
    const payload = local + 30 + localNameLength + localExtraLength
    if (
      payload + compressed > start ||
      decoder.decode(bytes.subarray(local + 30, local + 30 + localNameLength)) !== name ||
      (method === 0 && compressed !== expanded)
    )
      throw new Error("Inconsistent ZIP payload")
    if (
      !(flags & 8) &&
      (view.getUint32(local + 18, true) !== compressed || view.getUint32(local + 22, true) !== expanded)
    )
      throw new Error("Inconsistent ZIP local sizes")
    // Mirror every unanchored XML/VML consumer in ExcelJS xlsx.load. No prefix/suffix aliases.
    const consumers = [
      /xl\/worksheets\/sheet\d+\.xml/,
      /xl\/worksheets\/_rels\/sheet\d+\.xml.rels/,
      /xl\/theme\/[a-zA-Z0-9]+\.xml/,
      /xl\/drawings\/[a-zA-Z0-9]+\.xml/,
      /xl\/comments\d+\.xml/,
      /xl\/tables\/table\d+\.xml/,
      /xl\/drawings\/_rels\/[a-zA-Z0-9]+\.xml\.rels/,
      /xl\/drawings\/vmlDrawing\d+\.vml/,
    ]
    // ExcelJS's worksheet relationship matcher has an unescaped separator before "rels".
    if (
      /xl\/worksheets\/_rels\/sheet\d+\.xml.rels/.test(name) &&
      !/^xl\/worksheets\/_rels\/sheet\d+\.xml\.rels$/.test(name)
    )
      throw new Error("Noncanonical workbook XML path")
    if (
      consumers.some((consumer) => {
        const match = name.match(consumer)
        return match !== null && match[0] !== name
      })
    )
      throw new Error("Noncanonical workbook XML path")
    if (entries.some((entry) => local < entry.end && payload + compressed > entry.offset))
      throw new Error("Overlapping ZIP entries")
    entries.push({
      name,
      compressed: bytes.subarray(payload, payload + compressed),
      method,
      size: expanded,
      offset: local,
      end: payload + compressed,
    })
  }
  if (state.offset !== end) throw new Error("Invalid ZIP directory length")
  return entries
}

async function inflateEntry(
  entry: ReturnType<typeof zipEntries>[number],
  limits: WorkbookLimits,
  total: { bytes: number },
) {
  const chunks: Uint8Array[] = []
  const state = { bytes: 0 }
  const accept = (chunk: Uint8Array) => {
    state.bytes += chunk.length
    total.bytes += chunk.length
    if (state.bytes > limits.maxEntryBytes || total.bytes > limits.maxExpandedBytes)
      throw new Error("Workbook actual expansion limit")
    chunks.push(chunk)
  }
  if (entry.method === 0) accept(entry.compressed)
  if (entry.method === 8) {
    const { createInflateRaw } = await import("node:zlib")
    await new Promise<void>((resolve, reject) => {
      const stream = createInflateRaw({ chunkSize: 16384 })
      stream.on("data", (chunk: Uint8Array) => {
        try {
          accept(chunk)
        } catch (error) {
          stream.destroy(error instanceof Error ? error : new Error("Workbook expansion limit"))
        }
      })
      stream.once("error", reject)
      stream.once("end", resolve)
      stream.end(entry.compressed)
    })
  }
  if (state.bytes !== entry.size) throw new Error("ZIP expanded size mismatch")
  const output = new Uint8Array(state.bytes)
  chunks.reduce((offset, chunk) => {
    output.set(chunk, offset)
    return offset + chunk.length
  }, 0)
  return output
}

async function validateXml(
  name: string,
  bytes: Uint8Array,
  limits: WorkbookLimits,
  totals: { nodes: number; cells: number; sheets: number; merged: number; ranges: number },
) {
  const { SaxesParser } = await import("saxes")
  const parser = new SaxesParser({ xmlns: true })
  const state = { depth: 0, text: 0 }
  const worksheet = /^xl\/worksheets\/[^/]+\.xml$/i.test(name)
  const coordinate = (address: string) => {
    const match = address.match(/^([A-Z]{1,3})([1-9]\d*)$/)
    if (!match) throw new Error("Invalid worksheet coordinate")
    const column = [...match[1]!].reduce((value, char) => value * 26 + char.charCodeAt(0) - 64, 0)
    const row = Number(match[2])
    if (!Number.isSafeInteger(row) || row > limits.maxRows || column > limits.maxColumns)
      throw new Error("Workbook coordinate limit")
    return { row, column }
  }
  parser.on("error", (error) => {
    throw error
  })
  parser.on("doctype", () => {
    throw new Error("Workbook DTD is not accepted")
  })
  parser.on("opentag", (tag) => {
    totals.nodes++
    state.depth++
    if (totals.nodes > limits.maxXmlNodes || state.depth > limits.maxXmlDepth || tag.name.length > limits.maxTextLength)
      throw new Error("Workbook XML complexity limit")
    const attributes = Object.fromEntries(
      Object.values(tag.attributes).map((attribute) => {
        if (attribute.value.length > limits.maxTextLength) throw new Error("Workbook text limit")
        return [attribute.uri ? attribute.name : attribute.local, attribute.value]
      }),
    )
    if (
      tag.local === "Relationship" &&
      (attributes.TargetMode?.toLowerCase() === "external" ||
        /^(?:[a-z][a-z0-9+.-]*:|\/\/)/i.test(attributes.Target ?? "") ||
        /\/externalLink$/i.test(attributes.Type ?? ""))
    )
      throw new Error("External relationships are not accepted")
    if (tag.local === "sheet" && ++totals.sheets > limits.maxSheets) throw new Error("Workbook sheet limit")
    if (tag.local === "si") state.text = 0
    if (!worksheet) return
    if (
      tag.local === "col" &&
      (!/^[1-9]\d*$/.test(attributes.min ?? "") ||
        !/^[1-9]\d*$/.test(attributes.max ?? "") ||
        Number(attributes.min) > Number(attributes.max) ||
        Number(attributes.max) > limits.maxColumns)
    )
      throw new Error("Workbook column-definition limit")
    if (tag.local === "row" && (!/^[1-9]\d*$/.test(attributes.r ?? "") || Number(attributes.r) > limits.maxRows))
      throw new Error("Workbook row limit")
    if (tag.local === "c") {
      coordinate(attributes.r ?? "")
      if (++totals.cells > limits.maxCells) throw new Error("Workbook cell limit")
      state.text = 0
    }
    if (tag.local === "mergeCell") {
      const range = (attributes.ref ?? "").split(":")
      const first = coordinate(range[0] ?? ""),
        last = coordinate(range[1] ?? range[0] ?? "")
      if (last.row < first.row || last.column < first.column) throw new Error("Invalid worksheet merge")
      totals.merged += (last.row - first.row + 1) * (last.column - first.column + 1)
      if (++totals.ranges > limits.maxMergeRanges || totals.merged > limits.maxMergedCells)
        throw new Error("Workbook merge limit")
    }
  })
  const acceptText = (text: string) => {
    state.text += text.length
    if (state.text > limits.maxTextLength) throw new Error("Workbook text limit")
  }
  parser.on("text", acceptText)
  parser.on("cdata", acceptText)
  parser.on("closetag", () => {
    state.depth--
  })
  const decoder = new TextDecoder("utf-8", { fatal: true })
  for (let offset = 0; offset < bytes.length; offset += 16384)
    parser.write(decoder.decode(bytes.subarray(offset, offset + 16384), { stream: true }))
  parser.write(decoder.decode()).close()
}

// Only bounded, fully inspected STORE entries reach ExcelJS. It never inflates attacker-controlled DEFLATE.
async function loadWorkbook(bytes: Uint8Array, overrides: Partial<WorkbookLimits>) {
  try {
    const limits = workbookLimits(overrides)
    if (bytes.byteLength >= 8 && Buffer.from(bytes.subarray(0, 8)).toString("hex") === "d0cf11e0a1b11ae1")
      return { ok: true as const, workbook: await loadLegacyWorkbook(bytes, limits) }
    const entries = zipEntries(bytes, limits)
    if (
      !entries.some((entry) => entry.name === "[Content_Types].xml") ||
      !entries.some((entry) => entry.name === "xl/workbook.xml")
    )
      throw new Error("Not an OOXML workbook")
    const { default: JSZip } = await import("jszip")
    const safe = new JSZip()
    const total = { bytes: 0 },
      xml = { nodes: 0, cells: 0, sheets: 0, merged: 0, ranges: 0 }
    for (const entry of entries) {
      if (/^xl\/externalLinks\//i.test(entry.name)) throw new Error("External workbook links are not accepted")
      const data = await inflateEntry(entry, limits, total)
      if (/\.(xml|rels|vml)$/i.test(entry.name)) await validateXml(entry.name, data, limits, xml)
      safe.file(entry.name, data, { binary: true, compression: "STORE", createFolders: false })
    }
    const { Workbook } = await import("exceljs")
    const workbook = new Workbook()
    await workbook.xlsx.load(await safe.generateAsync({ type: "arraybuffer", compression: "STORE" }))
    const output = { cells: 0 }
    workbook.eachSheet((sheet) => {
      output.cells += sheet.actualRowCount * Math.max(2, sheet.columnCount)
      if (output.cells > limits.maxOutputCells) throw new Error("Workbook preview-cell limit")
      sheet.eachRow((row) =>
        row.eachCell((cell) => {
          if (
            cell.type === 5 ||
            (cell.formula &&
              /\[[^\]]+\][^!]*!|(?:https?|file|ftp):|WEBSERVICE\s*\(|HYPERLINK\s*\(|DDE\s*\(|\|[^!]*!/i.test(
                cell.formula,
              ))
          )
            throw new Error("External links are not accepted")
        }),
      )
    })
    return { ok: true as const, workbook }
  } catch (error) {
    return { ok: false as const, errors: [error instanceof Error ? error.message : "Could not read workbook"] }
  }
}

// BIFF's compound container has no ZIP inflation. Bound it before parsing and bound the
// declared grid before converting cached values; formulas and links are never executed.
async function loadLegacyWorkbook(bytes: Uint8Array, limits: WorkbookLimits) {
  if (bytes.byteLength > limits.maxCompressedBytes || bytes.byteLength > limits.maxExpandedBytes || bytes.byteLength < 512)
    throw new Error("Legacy workbook byte limit")
  const header = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (header.getUint16(28, true) !== 0xfffe || ![9, 12].includes(header.getUint16(30, true)))
    throw new Error("Invalid legacy workbook container")
  const { read, utils, CFB } = await import("xlsx")
  const container: unknown = CFB.read(bytes, { type: "buffer" })
  const paths = object(container).FullPaths
  if (!Array.isArray(paths) || paths.length > limits.maxEntries || paths.some((entry) => typeof entry !== "string" || entry.length > limits.maxPathLength || entry.split("/").length > limits.maxPathDepth || /(?:^|\/)(?:VBA|_VBA_PROJECT_CUR|ObjectPool|EncryptionInfo|EncryptedPackage)(?:\/|$)/i.test(entry)))
    throw new Error("Unsafe legacy workbook streams")
  const names = read(bytes, { type: "buffer", bookSheets: true }).SheetNames
  if (names.length > limits.maxSheets) throw new Error("Workbook sheet limit")
  const legacy = read(bytes, { type: "buffer", sheetRows: limits.maxRows + 1, cellDates: true, UTC: true, cellFormula: true, cellHTML: false, cellStyles: false, bookVBA: false })
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const total = { cells: 0, output: 0, merges: 0, merged: 0 }
  names.forEach((name) => {
    const source = legacy.Sheets[name]
    const range = utils.decode_range(String(source?.["!fullref"] ?? source?.["!ref"] ?? "A1"))
    if (range.e.r >= limits.maxRows || range.e.c >= limits.maxColumns) throw new Error("Workbook grid limit")
    total.output += (range.e.r + 1) * Math.max(2, range.e.c + 1)
    if (total.output > limits.maxOutputCells) throw new Error("Workbook preview-cell limit")
    const sheet = workbook.addWorksheet(name)
    Object.entries(source ?? {}).forEach(([address, cell]) => {
      if (address.startsWith("!")) return
      total.cells++
      if (total.cells > limits.maxCells) throw new Error("Workbook cell limit")
      const coordinate = utils.decode_cell(address)
      if (coordinate.r >= limits.maxRows || coordinate.c >= limits.maxColumns) throw new Error("Workbook grid limit")
      if (cell.l || (cell.f && /\[[^\]]+\][^!]*!|(?:https?|file|ftp):|WEBSERVICE\s*\(|HYPERLINK\s*\(|DDE\s*\(|\|[^!]*!/i.test(cell.f)))
        throw new Error("External links are not accepted")
      if (typeof cell.v === "string" && cell.v.length > limits.maxTextLength) throw new Error("Workbook text limit")
      if (cell.v == null) return
      if (!(cell.v instanceof Date) && !["string", "number", "boolean"].includes(typeof cell.v)) throw new Error("Invalid legacy cell value")
      sheet.getCell(coordinate.r + 1, coordinate.c + 1).value = cell.v
    })
    ;(source?.["!merges"] ?? []).forEach((merge) => {
      total.merges++
      total.merged += (merge.e.r - merge.s.r + 1) * (merge.e.c - merge.s.c + 1)
      if (total.merges > limits.maxMergeRanges || total.merged > limits.maxMergedCells || merge.e.r >= limits.maxRows || merge.e.c >= limits.maxColumns)
        throw new Error("Workbook merge limit")
      sheet.mergeCells(merge.s.r + 1, merge.s.c + 1, merge.e.r + 1, merge.e.c + 1)
    })
  })
  return workbook
}

function cellValue(cell: Cell): unknown {
  // ExcelJS's formula cell.value getter drops falsy caches; cell.result preserves XML's numeric zero.
  return value(cell.type === 6 ? (cell.result ?? null) : cell.value)
}

function value(cell: CellValue): unknown {
  if (cell == null || typeof cell === "string" || typeof cell === "number" || typeof cell === "boolean") return cell
  if (cell instanceof Date) return Number.isFinite(cell.getTime()) ? cell.toISOString().slice(0, 10) : null
  if ("formula" in cell || "sharedFormula" in cell) return cell.result == null ? null : value(cell.result)
  if ("richText" in cell) return cell.richText.map((part) => part.text).join("")
  if ("error" in cell) return cell.error
  return null
}

export async function parseWorkbook(
  bytes: Uint8Array,
  limits: Partial<WorkbookLimits> = {},
): Promise<{ ok: true; sheets: Record<string, Record<string, unknown>[]> } | { ok: false; errors: string[] }> {
  const result = await parseWorkbookInternal(bytes, limits, false)
  if (!result.ok) return result
  return { ok: true, sheets: result.sheets }
}

export type WorkbookCellOrigin = { sheet: string; recordIndex: number; row: number; column: number; address: string; field: string }

/** Cell origins are captured while interpreting the same bounded workbook as the legacy parser. */
export async function parseWorkbookDetailed(
  bytes: Uint8Array,
  limits: Partial<WorkbookLimits> = {},
): Promise<{ ok: true; sheets: Record<string, Record<string, unknown>[]>; origins: WorkbookCellOrigin[] } | { ok: false; errors: string[] }> {
  return parseWorkbookInternal(bytes, limits, true)
}

async function parseWorkbookInternal(bytes: Uint8Array, limits: Partial<WorkbookLimits>, capture: boolean): Promise<{ ok: true; sheets: Record<string, Record<string, unknown>[]>; origins: WorkbookCellOrigin[] } | { ok: false; errors: string[] }> {
  const loaded = await loadWorkbook(bytes, limits)
  if (!loaded.ok) return loaded
  const sheets: Record<string, Record<string, unknown>[]> = {}
  const origins: WorkbookCellOrigin[] = []
  for (const sheet of loaded.workbook.worksheets) {
    if (sheet.name === "Ticket Register") {
      const cells: { month: string; row: number; column: number; field: string }[] = []
      const operations = operationsSheet(sheet, capture ? cells : undefined)
      if (!operations.ok) return operations
      // This source sheet has title rows and paired month columns, not a single table header.
      sheets[sheet.name] = Object.entries(operations.months).map(([month, tickets]) => ({
        year: operations.year,
        month: Number(month),
        tickets,
      }))
      const months = Object.keys(operations.months)
      const last = new Map(cells.map((cell) => [JSON.stringify([cell.month, cell.field]), cell]))
      last.forEach((cell) => {
        origins.push({ sheet: sheet.name, recordIndex: months.indexOf(cell.month), row: cell.row, column: cell.column, address: sheet.getRow(cell.row).getCell(cell.column).address, field: `tickets.${cell.field}` })
      })
      continue
    }
    if (sheet.name === "Info") {
      const values: Record<string, unknown>[] = []
      sheet.eachRow((row, number) => {
        const field = cellValue(row.getCell(1))
        if (typeof field !== "string") return
        const recordIndex = values.length
        values.push({ Field: field, Value: cellValue(row.getCell(2)) })
        if (capture) ["Field", "Value"].forEach((name, index) => { const cell = row.getCell(index + 1); if (cell.type !== 0) origins.push({ sheet: sheet.name, recordIndex, row: number, column: index + 1, address: cell.address, field: name }) })
      })
      sheets.Info = values
      continue
    }
    if (
      ![
        ...plannerSheets,
        "All Members",
        "Summary by Leader",
        "All Projects",
        "Projects Import",
        "Summary by Status",
        "At-Risk Projects",
      ].includes(sheet.name)
    )
      continue
    if (!sheet.rowCount) {
      sheets[sheet.name] = []
      continue
    }
    const headers = Array.from({ length: sheet.columnCount }, (_, index) => {
      const header = cellValue(sheet.getRow(1).getCell(index + 1))
      return header == null ? "" : String(header)
    })
    if (new Set(headers).size !== headers.length) return { ok: false, errors: [`${sheet.name}: duplicate headers`] }
    const output: Record<string, unknown>[] = []
    sheet.eachRow((row, index) => {
      if (index === 1) return
      const recordIndex = output.length
      output.push(Object.fromEntries(headers.map((header, column) => [header, cellValue(row.getCell(column + 1))])))
      if (capture) headers.forEach((header, column) => { const cell = row.getCell(column + 1); if (cell.type !== 0) origins.push({ sheet: sheet.name, recordIndex, row: index, column: column + 1, address: cell.address, field: header }) })
    })
    sheets[sheet.name] = output
  }
  if (!Object.keys(sheets).length) return { ok: false, errors: ["No supported workbook sheets"] }
  return { ok: true, sheets, origins }
}

export async function parseOperationsWorkbook(
  bytes: Uint8Array,
  limits: Partial<WorkbookLimits> = {},
): Promise<
  | {
      ok: true
      year: number
      months: Record<string, Record<string, unknown>>
      categories: string[]
    }
  | { ok: false; errors: string[] }
> {
  const loaded = await loadWorkbook(bytes, limits)
  if (!loaded.ok) return loaded
  const sheet = loaded.workbook.getWorksheet("Ticket Register")
  if (!sheet) return { ok: false, errors: ['No "Ticket Register" tab found'] }
  return operationsSheet(sheet)
}

function operationsSheet(sheet: Worksheet, origins?: { month: string; row: number; column: number; field: string }[]):
  | {
      ok: true
      year: number
      months: Record<string, Record<string, unknown>>
      categories: string[]
    }
  | { ok: false; errors: string[] } {
  const clean = (input: unknown) =>
    input == null
      ? ""
      : String(input)
          .replace(/[^\x20-\x7E\u00C0-\u024F]/g, "")
          .trim()
  const existing: { number: number; cells: Map<number, unknown> }[] = []
  sheet.eachRow((row, number) => {
    const cells = new Map<number, unknown>()
    row.eachCell((cell, column) => {
      cells.set(column - 1, cellValue(cell))
    })
    existing.push({ number, cells })
  })
  const header = existing
    .filter((row) => row.number <= 15)
    .map((row) => ({
      number: row.number,
      columns: Object.fromEntries(
        months.flatMap((month) => {
          const found = [...row.cells].find(([, cell]) => clean(cell) === month)
          return found ? [[month, found[0]]] : []
        }),
      ),
    }))
    .find((row) => Object.keys(row.columns).length >= 6)
  if (!header)
    return {
      ok: false,
      errors: ["Could not find the month header row (at least six Jan–Dec month labels)"],
    }
  const detected =
    existing
      .filter((row) => row.number <= 12)
      .flatMap((row) =>
        [0, 1, 2, 3].flatMap((column) => {
          const cleaned = clean(row.cells.get(column)),
            next = Number(row.cells.get(column + 1))
          if (/year/i.test(cleaned) && next > 2000 && next < 2100) return [next]
          const match = cleaned.match(/year\s*[:\u2192]?\s*(20\d\d)/i)
          return match ? [Number(match[1])] : []
        }),
      )[0] ?? 2026
  const year = detected
  const categories: string[] = []
  const monthly: Record<string, Record<string, number>> = {}
  const category = { current: "" }
  const metrics: Record<string, string> = {
    "initial balance": "Initial Balance",
    opened: "Open",
    open: "Open",
    closed: "Closed",
    close: "Closed",
  }
  for (const row of existing.filter((row) => row.number > header.number)) {
    if (clean(row.cells.get(0))) category.current = clean(row.cells.get(0))
    if (!category.current || /^total$/i.test(category.current)) continue
    const label = clean(row.cells.get(1)).toLowerCase()
    if (!Object.hasOwn(metrics, label)) continue
    if (category.current.includes("|"))
      return {
        ok: false,
        errors: ["Category contains reserved metric separator |"],
      }
    if (!categories.includes(category.current)) categories.push(category.current)
    for (const [index, month] of months.entries()) {
      const column = header.columns[month]
      if (column === undefined) continue
      ;["Incidents", "Service Requests"].forEach((type, offset) => {
        const raw = row.cells.get(column + offset)
        if (raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw))) return
        const key = String(index + 1)
        monthly[key] ??= {}
        monthly[key]![`${category.current}|${type}|${metrics[label]}`] = Number(raw)
        origins?.push({ month: key, row: row.number, column: column + offset + 1, field: `${category.current}|${type}|${metrics[label]}` })
      })
    }
  }
  const found = Object.keys(monthly)
    .map(Number)
    .sort((a, b) => a - b)
  if (!found.length)
    return {
      ok: false,
      errors: ["Ticket Register tab found, but no numeric data"],
    }
  // Original import deliberately ignores SLA/Availability/Heat Map. These are complete ticket-month replacements only.
  return { ok: true, year, months: monthly, categories }
}
