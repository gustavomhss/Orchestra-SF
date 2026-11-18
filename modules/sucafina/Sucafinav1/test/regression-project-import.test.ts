// INV-PROJ-LEADER, INV-PROJ-SENTINEL, INV-PROJ-DEFAULTS, INV-PROJ-PCT.
// Each case posts a real XLSX through preview-workbook, then imports those preview rows.
// Leader names below are snapshot leader records, not the Entra directory. Spreadsheet cells vary case and surrounding space.
// Bob Wilson is stored with outer spaces so a match has to trim the record, not only the cell.

import { expect, test } from "bun:test"
import { createModule } from "../index.ts"
import { rows } from "../runtime/contract.ts"
import type { Snapshot } from "../runtime/contract.ts"
import type { ResolvedActor } from "../src/identity.ts"
import { testPersistence } from "./fixture/persistence.ts"

const AT = "2026-11-12T15:04:00Z"
const INSTRUCTION = "\u2014 DELETE EXAMPLE ROWS, ADD YOUR DATA BELOW \u2014"
const DRAFT = "\u2014 draft"
const HYPHEN = "--- hyphen fence"
const PUNCTUATED = "Q3 Cutover (pilot) \u2014 weekend"
const TEMPLATE_HEADERS = [
  "Name",
  "Description",
  "Status",
  "Risk",
  "Priority",
  "Project Manager",
  "IT Leader / Sponsor",
  "Start Date",
  "End Date",
  "Budget (USD)",
  "Spent (USD)",
  "% Complete",
  "Notes",
] as const

type Cell = string | number | null

const LEADERS = [
  { id: "L1", name: "Jane Doe", domain: "Enterprise", location: "Geneva" },
  { id: "L2", name: "  Bob Wilson  ", domain: "Infrastructure", location: "Santos" },
]
const CAPEX = [{ id: "capex-erp", budget: 4242, name: "ERP capex" }]
const NOTICES = [{ kind: "pending" as const, to: ["admin"], record: "projects:erp-existing", at: "2026-01-01T00:00:00Z" }]
const ERP_MILESTONES = [{ id: "ms-1", name: "Go live", date: "2026-06-01", status: "upcoming" }]
const LEGACY_MILESTONES = [{ id: "ms-legacy", name: "Retired", status: "done" }]
const ERP_EXISTING = {
  id: "erp-existing",
  name: "ERP Migration",
  createdAt: "2024-05-01T08:00:00Z",
  milestones: ERP_MILESTONES,
  leaderId: "L1",
  status: "Planning",
  risk: "Low",
  priority: "Low",
  budget: 1,
  spent: 1,
  pct: 1,
  notes: "old",
  custom: "source-meta",
  watchList: true,
}
const LEGACY = {
  id: "legacy",
  name: "Legacy Portal",
  createdAt: "2022-02-02T00:00:00Z",
  milestones: LEGACY_MILESTONES,
  leaderId: "L1",
  status: "Completed",
  risk: "High",
  priority: "Critical",
  budget: 20,
  spent: 20,
  pct: 100,
  custom: "legacy-meta",
}
const UNTOUCHED = {
  id: "untouched",
  name: "Untouched Portfolio",
  createdAt: "2023-01-01T00:00:00Z",
  status: "On Hold",
  risk: "Medium",
  priority: "High",
  leaderId: "L2",
  milestones: [{ id: "ms-untouched", name: "Hold", status: "upcoming" }],
  custom: "leave",
}
const ADMIN: ResolvedActor = {
  id: "admin",
  canWrite: true,
  roles: [{ surface: "dashboard", role: "admin" }],
}
const DIRECTORY = [
  { id: "admin", name: "Alex Admin" },
  { id: "domain-leader", name: "Dana Leader" },
  { id: "contributor", name: "Casey Contributor" },
  { id: "viewer", name: "Vera Viewer" },
  { id: "readonly", name: "Riley Readonly" },
]

function leaderHeaders(leader: string): string[] {
  return TEMPLATE_HEADERS.flatMap((header) => {
    if (header === "Start Date" || header === "End Date") return []
    if (header === "IT Leader / Sponsor") return [leader]
    return [header]
  })
}

function templateErp(leaderHeader = "IT Leader / Sponsor", leader: Cell = "Jane Doe"): Record<string, Cell> {
  return {
    Name: "ERP Migration",
    Description: "Full migration to SAP S/4HANA",
    Status: "In Progress",
    Risk: "High",
    Priority: "Critical",
    "Project Manager": "John Smith",
    [leaderHeader]: leader,
    "Start Date": "2026-01-15",
    "End Date": "2026-12-31",
    "Budget (USD)": 2500000,
    "Spent (USD)": 850000,
    "% Complete": 35,
    Notes: "Phase 1 complete. Phase 2 delayed by 3 weeks.",
  }
}

function templateCloud(leaderHeader = "IT Leader / Sponsor", leader: Cell = "Bob Wilson"): Record<string, Cell> {
  return {
    Name: "Cloud Infra Refresh",
    Description: "Azure migration of on-prem servers",
    Status: "Planning",
    Risk: "Medium",
    Priority: "High",
    "Project Manager": "Maria Silva",
    [leaderHeader]: leader,
    "Start Date": "2026-04-01",
    "End Date": "2026-09-30",
    "Budget (USD)": 800000,
    "Spent (USD)": 0,
    "% Complete": 5,
    Notes: "Vendor selection in progress",
  }
}

function validRow(
  leaderHeader: string,
  name: string,
  leader: Cell,
  overrides: Record<string, Cell> = {},
): Record<string, Cell> {
  return {
    Name: name,
    Description: "",
    Status: "Planning",
    Risk: "Low",
    Priority: "Medium",
    "Project Manager": "",
    [leaderHeader]: leader,
    "Budget (USD)": 0,
    "Spent (USD)": 0,
    "% Complete": 0,
    Notes: "",
    ...overrides,
  }
}

function emptyNamed(name: string): Record<string, Cell> {
  return Object.fromEntries(TEMPLATE_HEADERS.map((header) => [header, header === "Name" ? name : ""]))
}

function record(value: unknown): Record<string, unknown> {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return value as Record<string, unknown>
  throw new Error("Expected an object")
}

function stored(snapshot: Snapshot, name: string): Record<string, unknown> {
  const found = rows(snapshot.data.projects).find((row) => row.name === name)
  if (!found) throw new Error(`Missing project ${name}`)
  return found
}

function requireRow(list: Record<string, unknown>[], name: string): Record<string, unknown> {
  const found = list.find((row) => row.name === name)
  if (!found) throw new Error(`Missing preview row ${name}`)
  return found
}

function installation(projects: Record<string, unknown>[]) {
  const serial = { value: 0 }
  const identity: { principal: ResolvedActor } = { principal: ADMIN }
  const versions = Object.fromEntries(
    projects.flatMap((project) => {
      const id = project.id
      if (typeof id !== "string") return []
      return [[`projects:${id}`, { version: 2, by: "admin" }]]
    }),
  )
  const storage = testPersistence({
    dashboard: {
      data: {
        leaders: LEADERS.map((leader) => ({ ...leader })),
        projects,
        capexProjects: CAPEX.map((project) => ({ ...project })),
        access: { contributor: { assigned: ["projects"] } },
        summaries: ["All Projects"],
      },
      versions,
      sequences: { projects: 7 },
      audit: [],
      notices: NOTICES.map((notice) => ({ ...notice })),
    },
  })
  const handler = createModule("/sucafina", {
    authenticate: async () => identity.principal,
    persistence: storage.persistence,
    environment: async () => ({
      at: AT,
      id: () => `proj-${++serial.value}`,
      directory: DIRECTORY,
    }),
    maxJsonBytes: 2_000_000,
  })
  const send = (page: string, init?: RequestInit) =>
    handler(
      new Request(`https://installation.example/sucafina/dashboard?page=${encodeURIComponent(page)}`, init),
    ).then((response) => {
      if (!response) throw new Error("Unhandled dashboard request")
      return response
    })
  const command = (page: string, action: string, version: number, values: Record<string, unknown>, id?: string) =>
    send(page, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://installation.example",
      },
      body: JSON.stringify(
        id === undefined ? { page, action, version, values } : { page, action, id, version, values },
      ),
    })
  return { state: storage.state, identity, command, open: (page: string) => send(page) }
}

type App = ReturnType<typeof installation>

async function workbookBytes(headers: readonly string[], lines: readonly Record<string, Cell>[]): Promise<Uint8Array> {
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Projects Import")
  sheet.addRow(headers.slice())
  lines.forEach((line) => {
    sheet.addRow(headers.map((header) => line[header] ?? null))
  })
  return new Uint8Array(await workbook.xlsx.writeBuffer())
}

async function previewOf(
  app: App,
  headers: readonly string[],
  lines: readonly Record<string, Cell>[],
): Promise<Record<string, unknown>[]> {
  const bytes = await workbookBytes(headers, lines)
  const response = await app.command("All Projects", "preview-workbook", 0, {
    bytes: [...bytes],
    kind: "projects",
  })
  const body = record(await response.json())
  expect(response.status, JSON.stringify(body)).toBe(200)
  expect(body.ok).toBe(true)
  const preview = record(body.sheets)["Projects Import"]
  if (!Array.isArray(preview)) throw new Error("Projects Import preview missing")
  return preview.map((row) => record(row))
}

function readTokens(html: string, snapshot: Snapshot): Record<string, string> {
  const formStart = html.indexOf('data-command="import"')
  if (formStart < 0) throw new Error("Import form missing")
  const formEnd = html.indexOf("</form>", formStart)
  if (formEnd < 0) throw new Error("Import form incomplete")
  const form = html.slice(formStart, formEnd)
  const tokens = Object.fromEntries(
    [...form.matchAll(/name="(version:projects:[^"]+)" value="([^"]*)"/g)].flatMap((match) => {
      const name = match[1]
      if (!name) return []
      return [[name, match[2] ?? ""]]
    }),
  )
  rows(snapshot.data.projects).forEach((project) => {
    const id = typeof project.id === "string" ? project.id : ""
    const version = snapshot.versions[`projects:${id}`]?.version ?? 0
    if (!id || tokens[`version:projects:${id}`] !== String(version))
      throw new Error(`Own token for ${id} does not match the stored project version`)
  })
  return tokens
}

async function importPreview(
  app: App,
  preview: Record<string, unknown>[],
  tokens: Record<string, string>,
  id?: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const response = await app.command(
    "All Projects",
    "import",
    0,
    { ...tokens, rows: preview, mode: "update" },
    id,
  )
  return { status: response.status, body: record(await response.json()) }
}

function expectHeld(snapshot: Snapshot) {
  expect(snapshot.data.leaders).toEqual(LEADERS)
  expect(snapshot.data.capexProjects).toEqual(CAPEX)
  expect(snapshot.data.access).toEqual({ contributor: { assigned: ["projects"] } })
  expect(snapshot.data.summaries).toEqual(["All Projects"])
  expect(snapshot.sequences).toEqual({ projects: 7 })
  expect(snapshot.notices).toEqual(NOTICES)
  expect(stored(snapshot, "Untouched Portfolio")).toEqual(UNTOUCHED)
  expect(snapshot.versions["projects:untouched"]).toEqual({ version: 2, by: "admin" })
  expect(snapshot.audit.length).toBeGreaterThan(0)
  expect(snapshot.audit.every((entry) => entry.name === "Alex Admin" && entry.who === "admin" && entry.at === AT)).toBe(
    true,
  )
}

function expectErpIdentity(project: Record<string, unknown>) {
  expect(project).toMatchObject({
    id: "erp-existing",
    createdAt: "2024-05-01T08:00:00Z",
    custom: "source-meta",
    watchList: true,
    milestones: ERP_MILESTONES,
    updatedAt: AT,
  })
}

async function loadTokens(app: App): Promise<Record<string, string>> {
  const response = await app.open("All Projects")
  expect(response.status).toBe(200)
  return readTokens(await response.text(), app.state.dashboard)
}

test("template header IT Leader / Sponsor resolves trimmed leader names and stores an empty id for unknown or blank names", async () => {
  await expectLeaderHeader("IT Leader / Sponsor")
})

test("export header IT Leader resolves trimmed leader names and stores an empty id for unknown or blank names", async () => {
  await expectLeaderHeader("IT Leader")
})

test("a workbook with neither leader header still updates and does not invent a leader", async () => {
  const app = installation([ERP_EXISTING, UNTOUCHED])
  const headers = TEMPLATE_HEADERS.filter(
    (header) => header !== "IT Leader / Sponsor" && header !== "Start Date" && header !== "End Date",
  )
  const preview = await previewOf(app, headers, [templateErp()])
  const tokens = await loadTokens(app)
  const imported = await importPreview(app, preview, tokens)
  expect(imported).toEqual({ status: 200, body: { ok: true } })
  const project = stored(app.state.dashboard, "ERP Migration")
  expectErpIdentity(project)
  expect(project).toMatchObject({
    desc: "Full migration to SAP S/4HANA",
    status: "In Progress",
    risk: "High",
    priority: "Critical",
    pm: "John Smith",
    budget: 2500000,
    spent: 850000,
    pct: 35,
    notes: "Phase 1 complete. Phase 2 delayed by 3 weeks.",
  })
  expect(project.leaderId === "L1" || project.leaderId === "" || project.leaderId === undefined).toBe(true)
  expect(app.state.dashboard.versions["projects:erp-existing"]).toEqual({ version: 3, by: "admin" })
  expect(app.state.dashboard.audit[0]?.was).toMatchObject({
    id: "erp-existing",
    createdAt: "2024-05-01T08:00:00Z",
    custom: "source-meta",
  })
  expectHeld(app.state.dashboard)
})

test("the em-dash instruction row is left out of preview and import while example and punctuated rows import", async () => {
  const app = installation([ERP_EXISTING, UNTOUCHED])
  const preview = await previewOf(app, TEMPLATE_HEADERS, [
    templateErp(),
    templateCloud(),
    emptyNamed(INSTRUCTION),
    { ...emptyNamed(""), "Budget (USD)": 9, Notes: "blank name" },
    {
      ...templateErp(),
      Name: DRAFT,
      Status: "In Progress",
      Risk: "Low",
      Priority: "Medium",
      "Budget (USD)": 4,
      "Spent (USD)": 0,
      "% Complete": 1,
      Notes: "not an instruction",
    },
    validRow("IT Leader / Sponsor", HYPHEN, "Jane Doe", {
      "Budget (USD)": 15,
      "Spent (USD)": 0,
      "% Complete": 1,
      Notes: "punctuation stays",
    }),
    validRow("IT Leader / Sponsor", PUNCTUATED, "Jane Doe", {
      "Budget (USD)": 16,
      "Spent (USD)": 0,
      "% Complete": 2,
      Notes: "internal em dash stays",
    }),
  ])
  expect(preview.map((row) => row.name)).toEqual(["ERP Migration", "Cloud Infra Refresh", HYPHEN, PUNCTUATED])
  const imported = await importPreview(app, preview, await loadTokens(app))
  expect(imported).toEqual({ status: 200, body: { ok: true } })
  const names = rows(app.state.dashboard.data.projects).map((row) => row.name)
  expect(names).toEqual(expect.arrayContaining(["ERP Migration", "Cloud Infra Refresh", HYPHEN, PUNCTUATED, "Untouched Portfolio"]))
  expect(names.some((name) => name === "" || name === INSTRUCTION || (typeof name === "string" && name.startsWith("\u2014")))).toBe(
    false,
  )
  const erp = stored(app.state.dashboard, "ERP Migration")
  expectErpIdentity(erp)
  expect(erp).toMatchObject({
    desc: "Full migration to SAP S/4HANA",
    status: "In Progress",
    risk: "High",
    priority: "Critical",
    pm: "John Smith",
    leaderId: "L1",
    budget: 2500000,
    spent: 850000,
    pct: 35,
    notes: "Phase 1 complete. Phase 2 delayed by 3 weeks.",
  })
  expect(stored(app.state.dashboard, "Cloud Infra Refresh")).toMatchObject({
    desc: "Azure migration of on-prem servers",
    status: "Planning",
    risk: "Medium",
    priority: "High",
    pm: "Maria Silva",
    leaderId: "L2",
    budget: 800000,
    spent: 0,
    pct: 5,
    notes: "Vendor selection in progress",
    createdAt: AT,
    milestones: [],
    updatedAt: AT,
  })
  expect(stored(app.state.dashboard, HYPHEN)).toMatchObject({
    status: "Planning",
    risk: "Low",
    priority: "Medium",
    leaderId: "L1",
    budget: 15,
    pct: 1,
    milestones: [],
  })
  expect(stored(app.state.dashboard, PUNCTUATED)).toMatchObject({
    status: "Planning",
    risk: "Low",
    priority: "Medium",
    leaderId: "L1",
    budget: 16,
    pct: 2,
    notes: "internal em dash stays",
  })
  expectHeld(app.state.dashboard)
})

test("blank, null and whitespace status, risk and priority default while recognized values stay", async () => {
  const app = installation([ERP_EXISTING, LEGACY, UNTOUCHED])
  const headers = leaderHeaders("IT Leader")
  const preview = await previewOf(app, headers, [
    {
      ...templateErp("IT Leader", "Jane Doe"),
      Status: " In Progress ",
      Risk: " High ",
      Priority: " Critical ",
    },
    validRow("IT Leader", "Legacy Portal", "Jane Doe", {
      Status: "",
      Risk: "",
      Priority: "",
      "Budget (USD)": 21,
      "Spent (USD)": 0,
      "% Complete": 10,
    }),
    validRow("IT Leader", "Network Refresh", "Jane Doe", {
      Status: "   ",
      Risk: " Low ",
      Priority: "   ",
      "Budget (USD)": 800000,
      "Spent (USD)": 0,
      "% Complete": 10,
    }),
    validRow("IT Leader", "Null Enums", "Jane Doe", {
      Status: null,
      Risk: null,
      Priority: null,
      "Budget (USD)": 4,
      "Spent (USD)": 0,
      "% Complete": 4,
    }),
  ])
  const imported = await importPreview(app, preview, await loadTokens(app))
  expect(imported).toEqual({ status: 200, body: { ok: true } })
  const erp = stored(app.state.dashboard, "ERP Migration")
  expectErpIdentity(erp)
  expect(erp).toMatchObject({
    status: "In Progress",
    risk: "High",
    priority: "Critical",
    leaderId: "L1",
    pct: 35,
    budget: 2500000,
  })
  expect(stored(app.state.dashboard, "Legacy Portal")).toMatchObject({
    id: "legacy",
    createdAt: "2022-02-02T00:00:00Z",
    custom: "legacy-meta",
    milestones: LEGACY_MILESTONES,
    status: "Planning",
    risk: "Low",
    priority: "Medium",
    leaderId: "L1",
    budget: 21,
    spent: 0,
    pct: 10,
    updatedAt: AT,
  })
  expect(stored(app.state.dashboard, "Network Refresh")).toMatchObject({
    status: "Planning",
    risk: "Low",
    priority: "Medium",
    leaderId: "L1",
    budget: 800000,
    spent: 0,
    pct: 10,
    createdAt: AT,
    milestones: [],
  })
  expect(stored(app.state.dashboard, "Null Enums")).toMatchObject({
    status: "Planning",
    risk: "Low",
    priority: "Medium",
    leaderId: "L1",
    pct: 4,
    createdAt: AT,
    milestones: [],
  })
  expectHeld(app.state.dashboard)
})

test("omitted status, risk and priority default on create and update", async () => {
  const app = installation([LEGACY, UNTOUCHED])
  const headers = leaderHeaders("IT Leader").filter(
    (header) => header !== "Status" && header !== "Risk" && header !== "Priority",
  )
  const preview = await previewOf(app, headers, [
    {
      Name: "Legacy Portal",
      Description: "kept",
      "Project Manager": "",
      "IT Leader": "Jane Doe",
      "Budget (USD)": 80,
      "Spent (USD)": 20,
      "% Complete": 8,
      Notes: "",
    },
    {
      Name: "Omitted Enums",
      Description: "",
      "Project Manager": "",
      "IT Leader": "Jane Doe",
      "Budget (USD)": 5,
      "Spent (USD)": 0,
      "% Complete": 9,
      Notes: "",
    },
  ])
  const imported = await importPreview(app, preview, await loadTokens(app))
  expect(imported).toEqual({ status: 200, body: { ok: true } })
  expect(stored(app.state.dashboard, "Legacy Portal")).toMatchObject({
    id: "legacy",
    createdAt: "2022-02-02T00:00:00Z",
    custom: "legacy-meta",
    milestones: LEGACY_MILESTONES,
    status: "Planning",
    risk: "Low",
    priority: "Medium",
    leaderId: "L1",
    budget: 80,
    spent: 20,
    pct: 8,
    updatedAt: AT,
  })
  expect(stored(app.state.dashboard, "Omitted Enums")).toMatchObject({
    status: "Planning",
    risk: "Low",
    priority: "Medium",
    leaderId: "L1",
    budget: 5,
    spent: 0,
    pct: 9,
    createdAt: AT,
    milestones: [],
    updatedAt: AT,
  })
  expectHeld(app.state.dashboard)
})

test("unknown status or risk rejects the whole batch with versions, audit, notices and sequences unchanged", async () => {
  await expectRejected(
    [
      validRow("IT Leader", "Kept Aside", "Jane Doe", { "Budget (USD)": 3, "Spent (USD)": 0, "% Complete": 1 }),
      validRow("IT Leader", "Network Refresh", "Jane Doe", {
        Status: "Archived",
        "Budget (USD)": 4,
        "Spent (USD)": 0,
        "% Complete": 2,
      }),
    ],
    "Choose a project status and risk.",
  )
  await expectRejected(
    [
      validRow("IT Leader", "Kept Aside", "Jane Doe", { "Budget (USD)": 3, "Spent (USD)": 0, "% Complete": 1 }),
      validRow("IT Leader", "Network Refresh", "Jane Doe", {
        Risk: "Severe",
        "Budget (USD)": 4,
        "Spent (USD)": 0,
        "% Complete": 2,
      }),
    ],
    "Choose a project status and risk.",
  )
})

test("the text 75% imports as 75, a blank as 0, and numeric 35.9 stays 35.9", async () => {
  const app = installation([ERP_EXISTING, UNTOUCHED])
  const headers = leaderHeaders("IT Leader")
  const preview = await previewOf(app, headers, [
    templateErp("IT Leader", "Jane Doe"),
    templateCloud("IT Leader", "  BOB WILSON  "),
    validRow("IT Leader", "Signal Upgrade", "Jane Doe", {
      "Budget (USD)": 1,
      "Spent (USD)": 0,
      "% Complete": 35.9,
    }),
    validRow("IT Leader", "Blank Percent", "Jane Doe", {
      "Budget (USD)": 2,
      "Spent (USD)": 0,
      "% Complete": null,
    }),
    validRow("IT Leader", "Empty Percent", "Jane Doe", {
      "Budget (USD)": 3,
      "Spent (USD)": 0,
      "% Complete": "",
    }),
    validRow("IT Leader", "Network Refresh", "Jane Doe", {
      "Budget (USD)": 4,
      "Spent (USD)": 0,
      "% Complete": "75%",
    }),
  ])
  const imported = await importPreview(app, preview, await loadTokens(app))
  expect(imported).toEqual({ status: 200, body: { ok: true } })
  expect(stored(app.state.dashboard, "ERP Migration").pct).toBe(35)
  expect(stored(app.state.dashboard, "Cloud Infra Refresh")).toMatchObject({ pct: 5, leaderId: "L2", spent: 0 })
  expect(stored(app.state.dashboard, "Signal Upgrade").pct).toBe(35.9)
  expect(stored(app.state.dashboard, "Blank Percent").pct).toBe(0)
  expect(stored(app.state.dashboard, "Empty Percent").pct).toBe(0)
  expect(stored(app.state.dashboard, "Network Refresh").pct).toBe(75)
  expectHeld(app.state.dashboard)
})

test("non-numeric progress text rejects the whole batch unchanged", async () => {
  await expectRejected(
    [
      validRow("IT Leader", "Kept Aside", "Jane Doe", { "Budget (USD)": 35, "Spent (USD)": 0, "% Complete": 35 }),
      validRow("IT Leader", "Network Refresh", "Jane Doe", {
        "Budget (USD)": 4,
        "Spent (USD)": 0,
        "% Complete": "n/a",
      }),
    ],
    "Project amounts must be numbers.",
  )
})

test("a stale own project token rolls back the batch including an earlier new row", async () => {
  const app = installation([ERP_EXISTING, UNTOUCHED])
  const headers = leaderHeaders("IT Leader")
  const preview = await previewOf(app, headers, [
    validRow("IT Leader", "Cloud Infra Refresh", "Jane Doe", {
      "Budget (USD)": 50,
      "Spent (USD)": 0,
      "% Complete": 5,
    }),
    { ...templateErp("IT Leader", "Jane Doe"), "Budget (USD)": 999 },
  ])
  const tokens = await loadTokens(app)
  expect(tokens["version:projects:erp-existing"]).toBe(
    String(app.state.dashboard.versions["projects:erp-existing"]?.version ?? ""),
  )
  app.state.dashboard.versions["projects:erp-existing"] = { version: 9, by: "other" }
  const before = structuredClone(app.state.dashboard)
  const imported = await importPreview(app, preview, tokens)
  expect(imported.status).toBe(409)
  expect(imported.body).toMatchObject({ ok: false, status: 409, by: "other" })
  expect(app.state.dashboard).toEqual(before)
  expect(rows(app.state.dashboard.data.projects).some((row) => row.name === "Cloud Infra Refresh")).toBe(false)
  expect(stored(app.state.dashboard, "ERP Migration").budget).toBe(1)
})

test("domain leader, contributor, viewer and read-only actors cannot import posted project ids", async () => {
  const app = installation([ERP_EXISTING, UNTOUCHED])
  const before = structuredClone(app.state.dashboard)
  const preview = await previewOf(app, leaderHeaders("IT Leader"), [
    { ...templateErp("IT Leader", "Jane Doe"), Status: "Completed", "Budget (USD)": 999 },
  ])
  const tokens = await loadTokens(app)
  const posted = preview.map((row, index) => (index === 0 ? { ...row, id: "erp-existing", leaderId: "L2" } : row))
  const denied: ResolvedActor[] = [
    { id: "domain-leader", canWrite: true, roles: [{ surface: "dashboard", role: "domain leader" }] },
    { id: "contributor", canWrite: true, roles: [{ surface: "dashboard", role: "contributor" }] },
    { id: "viewer", canWrite: true, roles: [{ surface: "dashboard", role: "viewer" }] },
    { id: "readonly", canWrite: false, roles: [{ surface: "dashboard", role: "admin" }] },
  ]
  for (const principal of denied) {
    app.identity.principal = principal
    const imported = await importPreview(app, posted, tokens, "erp-existing")
    expect(imported.status).toBe(403)
    expect(imported.body.ok).toBe(false)
  }
  expect(app.state.dashboard).toEqual(before)
})

async function expectLeaderHeader(leaderHeader: "IT Leader / Sponsor" | "IT Leader") {
  const app = installation([ERP_EXISTING, UNTOUCHED])
  const headers = leaderHeaders(leaderHeader)
  const preview = await previewOf(app, headers, [
    templateErp(leaderHeader, "  jAnE dOe "),
    templateCloud(leaderHeader, "  BOB WILSON  "),
    validRow(leaderHeader, "Shadow Initiative", "Pat Unknown", {
      "Budget (USD)": 10,
      "Spent (USD)": 0,
      "% Complete": 0,
    }),
    validRow(leaderHeader, "Unassigned Relay", null, { "Budget (USD)": 0, "Spent (USD)": 0, "% Complete": 0 }),
    validRow(leaderHeader, "Spacer Relay", "   ", { "Budget (USD)": 0, "Spent (USD)": 0, "% Complete": 0 }),
  ])
  expect(requireRow(preview, "ERP Migration").leaderId).toBe("L1")
  expect(requireRow(preview, "Cloud Infra Refresh").leaderId).toBe("L2")
  expect(requireRow(preview, "Shadow Initiative").leaderId).toBe("")
  expect(requireRow(preview, "Unassigned Relay").leaderId).toBe("")
  expect(requireRow(preview, "Spacer Relay").leaderId).toBe("")
  const imported = await importPreview(app, preview, await loadTokens(app))
  expect(imported).toEqual({ status: 200, body: { ok: true } })
  const erp = stored(app.state.dashboard, "ERP Migration")
  expectErpIdentity(erp)
  expect(erp).toMatchObject({
    leaderId: "L1",
    status: "In Progress",
    risk: "High",
    priority: "Critical",
    budget: 2500000,
    spent: 850000,
    pct: 35,
  })
  expect(stored(app.state.dashboard, "Cloud Infra Refresh")).toMatchObject({
    leaderId: "L2",
    status: "Planning",
    risk: "Medium",
    priority: "High",
    pm: "Maria Silva",
    budget: 800000,
    spent: 0,
    pct: 5,
    createdAt: AT,
    milestones: [],
    updatedAt: AT,
  })
  expect(stored(app.state.dashboard, "Shadow Initiative").leaderId).toBe("")
  expect(stored(app.state.dashboard, "Unassigned Relay").leaderId).toBe("")
  expect(stored(app.state.dashboard, "Spacer Relay").leaderId).toBe("")
  expect(app.state.dashboard.data.leaders).toEqual(LEADERS)
  expectHeld(app.state.dashboard)
}

async function expectRejected(lines: Record<string, Cell>[], error: string) {
  const app = installation([ERP_EXISTING, UNTOUCHED])
  const before = structuredClone(app.state.dashboard)
  const preview = await previewOf(app, leaderHeaders("IT Leader"), lines)
  const imported = await importPreview(app, preview, await loadTokens(app))
  expect(imported).toEqual({ status: 422, body: { ok: false, status: 422, errors: [error] } })
  expect(app.state.dashboard).toEqual(before)
  expect(rows(app.state.dashboard.data.projects).some((row) => row.name === "Kept Aside")).toBe(false)
}
