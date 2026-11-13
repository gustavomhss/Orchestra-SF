import { expect, test } from "bun:test"
import { createModule } from "../index.ts"
import { rows } from "../runtime/contract.ts"
import type { ResolvedActor } from "../src/identity.ts"
import { testPersistence } from "./fixture/persistence.ts"

const AT = "2026-11-12T15:04:00Z"
const ADMIN: ResolvedActor = {
  id: "admin",
  canWrite: true,
  roles: [{ surface: "dashboard", role: "admin" }],
}
const DIRECTORY = [{ id: "admin", name: "Alex Admin" }]
const MALFORMED_LEADER = { id: "L-empty", name: "   " }
const VALID_LEADER = { id: "L1", name: "Jane Doe" }
const BASE_HEADERS = ["Name", "Status", "Risk", "Priority", "Budget (USD)", "Spent (USD)", "% Complete"]

function installation() {
  const ids = { value: 0 }
  const storage = testPersistence({
    dashboard: {
      data: {
        leaders: [MALFORMED_LEADER, VALID_LEADER],
        projects: [],
        capexProjects: [],
        access: {},
        summaries: ["All Projects"],
      },
      versions: {},
      sequences: { projects: 0 },
      audit: [],
      notices: [],
    },
  })
  const handler = createModule("/sucafina", {
    authenticate: async () => ADMIN,
    persistence: storage.persistence,
    environment: async () => ({ at: AT, id: () => `project-new-${++ids.value}`, directory: DIRECTORY }),
    maxJsonBytes: 2_000_000,
  })
  const command = async (page: string, action: string, values: Record<string, unknown>) => {
    const response = await handler(
      new Request(`https://installation.example/sucafina/dashboard?page=${encodeURIComponent(page)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://installation.example" },
        body: JSON.stringify({ page, action, version: 0, values }),
      }),
    )
    if (!response) throw new Error("Unhandled dashboard request")
    return response
  }
  return { state: storage.state, command }
}

async function importRows(
  headers: string[],
  inputs: { name: string; leaders: Record<string, string | null>; expectedLeaderId: string }[],
) {
  const app = installation()
  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("Projects Import")
  sheet.addRow(headers)
  for (const input of inputs)
    sheet.addRow(
      headers.map((header) => {
        if (header === "Name") return input.name
        if (header === "Status") return "Planning"
        if (header === "Risk") return "Low"
        if (header === "Priority") return "Medium"
        if (["Budget (USD)", "Spent (USD)", "% Complete"].includes(header)) return 0
        return input.leaders[header] ?? null
      }),
    )
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const previewResponse = await app.command("All Projects", "preview-workbook", {
    bytes: [...bytes],
    kind: "projects",
  })
  expect(previewResponse.status).toBe(200)
  const previewBody = (await previewResponse.json()) as {
    ok: boolean
    sheets: Record<string, Record<string, unknown>[]>
  }
  expect(previewBody.ok).toBe(true)
  const preview = previewBody.sheets["Projects Import"]
  expect(preview.map((row) => row.leaderId)).toEqual(inputs.map((input) => input.expectedLeaderId))
  const imported = await app.command("All Projects", "import", { rows: preview, mode: "update" })
  expect(imported.status).toBe(200)
  expect(await imported.json()).toEqual({ ok: true })
  expect(
    rows(app.state.dashboard.data.projects).map((project) => [project.name, project.leaderId]),
  ).toEqual(inputs.map((input) => [input.name, input.expectedLeaderId]))
  expect(app.state.dashboard.data.leaders).toEqual([MALFORMED_LEADER, VALID_LEADER])
}

test("IT Leader blanks do not resolve a whitespace-named master record", async () => {
  const header = "IT Leader"
  await importRows([...BASE_HEADERS.slice(0, 4), header, ...BASE_HEADERS.slice(4)], [
    { name: "Export null", leaders: { [header]: null }, expectedLeaderId: "" },
    { name: "Export empty", leaders: { [header]: "" }, expectedLeaderId: "" },
    { name: "Export spaces", leaders: { [header]: "   " }, expectedLeaderId: "" },
    { name: "Export valid", leaders: { [header]: "  jAnE dOe " }, expectedLeaderId: "L1" },
  ])
})

test("IT Leader / Sponsor blanks do not resolve a whitespace-named master record", async () => {
  const header = "IT Leader / Sponsor"
  await importRows([...BASE_HEADERS.slice(0, 4), header, ...BASE_HEADERS.slice(4)], [
    { name: "Template null", leaders: { [header]: null }, expectedLeaderId: "" },
    { name: "Template empty", leaders: { [header]: "" }, expectedLeaderId: "" },
    { name: "Template spaces", leaders: { [header]: "   " }, expectedLeaderId: "" },
    { name: "Template valid", leaders: { [header]: "  jAnE dOe " }, expectedLeaderId: "L1" },
  ])
})

test("an explicitly present template leader header takes precedence, including when blank", async () => {
  const templateHeader = "IT Leader / Sponsor"
  const exportHeader = "IT Leader"
  await importRows([...BASE_HEADERS.slice(0, 4), templateHeader, exportHeader, ...BASE_HEADERS.slice(4)], [
    {
      name: "Template blank wins",
      leaders: { [templateHeader]: "   ", [exportHeader]: "Jane Doe" },
      expectedLeaderId: "",
    },
    {
      name: "Template value wins",
      leaders: { [templateHeader]: " Jane Doe ", [exportHeader]: null },
      expectedLeaderId: "L1",
    },
  ])
})
