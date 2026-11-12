import { expect, test } from "bun:test"
import { fileURLToPath } from "node:url"
import { readdir } from "node:fs/promises"
import { join } from "node:path"
import { dashboardMoney, deleteBudgetProject, deletePmoProject } from "../src/dashboard-accounts.ts"
import { contractVendor, exportAllMembers } from "../src/dashboard-role.ts"
import { readPmoNames } from "../src/elo.ts"
import { validatePO } from "../src/form.ts"
import { legalInitialSettings } from "../src/initial-settings.ts"
import { usdAmount, nextCpx } from "../src/planner-accounts.ts"
import { importHeadcount } from "../src/planner-role.ts"
import { createRequest } from "../src/procurement.ts"
import type { Store } from "../src/procurement.ts"
import { poExpense } from "../src/procurement-screen.ts"
import { sidebarYear } from "../src/surfaces.ts"

const GROUPS: Record<string, string[]> = {
  dashboard: ["dashboard-accounts.ts", "dashboard-role.ts", "dashboard-screen.ts", "surfaces.ts"],
  planner: ["planner-accounts.ts", "planner-role.ts", "planner-screen.ts"],
  procurement: [
    "form.ts",
    "initial-settings.ts",
    "procurement-screen.ts",
    "procurement.ts",
    "requests.ts",
    "supplier.ts",
  ],
  none: ["elo.ts", "identity.ts", "nav.ts", "records.ts", "screen-shell.ts"],
}

test("ELO-1 no surface module imports another surface, and the named links stay refused", async () => {
  expect(crossImports("procurement-screen.ts", `import { REQUEST_TABS } from "./surfaces.ts"`)).toEqual(["surfaces.ts"])
  expect(crossImports("procurement.ts", `import("./dashboard-role.ts")`)).toEqual(["dashboard-role.ts"])
  expect(crossImports("elo.ts", `import { usdAmount } from "./planner-accounts.ts"`)).toEqual(["planner-accounts.ts"])
  expect(crossImports("planner-role.ts", `import { lockAllows } from "./planner-accounts.ts"`)).toEqual([])
  expect(crossImports("procurement.ts", `import { act } from "../../porta/act.ts"`)).toEqual([])

  const dir = fileURLToPath(new URL("../src/", import.meta.url))
  const files = (await readdir(dir)).filter((file) => file.endsWith(".ts")).sort()
  const known = Object.values(GROUPS).flat().sort()
  expect(files).toEqual(known)
  const hits: string[] = []
  for (const file of files) {
    const source = await Bun.file(join(dir, file)).text()
    for (const target of crossImports(file, source)) hits.push(`${file} -> ${target}`)
  }
  expect(hits).toEqual([])

  const expense = poExpense("line-9", "CPX-2026-001")
  expect(expense).toEqual({
    expenseType: "line-9",
    assetRef: "CPX-2026-001",
    plannerLineId: null,
    capexProjectId: null,
    projectId: null,
    cpx: null,
  })
  expect(expense.assetRef).toBe(nextCpx(2026, 0, []).code)
  expect(expense.cpx).toBeNull()
  expect(expense.cpx).not.toBe(nextCpx(2026, 0, []).code)

  const vendor = contractVendor("SUP-00001")
  expect(vendor).toEqual({ vendor: "SUP-00001", supplierId: null })
  expect(vendor.vendor).toBe("SUP-00001")
  expect(vendor.supplierId).not.toBe("SUP-00001")

  const projects = [{ id: "same", name: "ERP" }]
  const capex = [{ id: "same", budget: 40 }]
  const dropped = deletePmoProject(projects, capex, "same")
  expect(dropped.projects).toEqual([])
  expect(dropped.capexProjects).toEqual(capex)
  expect(capex).toEqual([{ id: "same", budget: 40 }])
  const budget = deleteBudgetProject([{ id: "same", name: "ERP" }], [{ id: "same", budget: 40 }], "same")
  expect(budget.projects).toEqual([{ id: "same", name: "ERP" }])
  expect(budget.capexProjects).toEqual([])

  const suggested = readPmoNames(["Ada"], [{ name: "ERP" }])
  expect(suggested).toEqual({
    names: ["Ada"],
    projects: [{ name: "ERP" }],
    imported: false,
  })
  expect(suggested.names).not.toContain("ERP")
  expect(suggested.projects.map((project) => project.name)).not.toContain("Ada")
})

test("ELO-1 three FX and three years stay apart", () => {
  expect(dashboardMoney(10)).toBe("$10")
  expect(usdAmount(10, "EUR", null)).toEqual({ usd: 0, warning: "EUR" })
  expect(usdAmount(10, "EUR", 1.08).usd).toBe(10.8)
  const refused = validatePO(
    {
      po: {
        currency: "EUR",
        expenseType: "OPEX",
        supplier: "Acme",
        description: "kit",
        lines: [{ qty: 1, unitPrice: 10 }],
        paymentTerms: "30",
        deliveryDate: "2026-12-01",
        deliveryConditions: "desk",
      },
    },
    { currency: "USD", fxRates: [] },
    [],
  )
  expect(refused.some((error) => error.includes("No FX rate"))).toBe(true)
  expect(refused).not.toContain("0")
  expect(dashboardMoney(10)).not.toBe(String(usdAmount(10, "EUR", null).usd))

  expect(sidebarYear(2026)).toBe(2026)
  expect(nextCpx(2027, 0, []).code).toBe("CPX-2027-001")
  const created = createRequest(
    store(),
    { type: "create", pr: { estAmount: 1, recurring: false, expenseType: "" } },
    { id: "ada", canWrite: true, roles: ["requester"] },
    "2025-06-01T00:00:00Z",
  )
  if (!created.ok) throw new Error(created.code)
  expect(created.request.number).toBe("PR-2025-0001")
  expect(created.request.number).not.toContain("2026")
  expect(created.request.number).not.toContain("2027")
  expect(nextCpx(2027, 0, []).code).not.toContain("2025")
})

test("ELO-2 the headcount Excel stays a file and the planner import does not read talent, notes, or salary", () => {
  const member = {
    id: "m1",
    name: "Ada",
    title: "CIO",
    type: "Employee",
    leader: "Gus",
    leaderId: "lead-1",
    location: "SP",
    start: "2020-01-01",
    end: "",
    status: "Active",
    cls: "Talent",
    outlook: "Promote",
    notes: "private-note",
    rateOverride: 900,
    rates: [1],
    inc: 4,
  }
  expect(exportAllMembers([member], { roles: ["domain leader"] })).toEqual({
    ok: false,
  })
  expect(exportAllMembers([member], { roles: ["viewer"] })).toEqual({
    ok: false,
  })
  expect(exportAllMembers([member], { roles: ["admin", "domain leader"] }).ok).toBe(true)
  const file = exportAllMembers([member], { roles: ["admin"] })
  if (!file.ok) throw new Error("admin does not generate All Members")
  expect(file.file).toBe(true)
  expect(file.live).toBe(false)
  expect(file.rows[0]).toEqual({
    Name: "Ada",
    Title: "CIO",
    Type: "Employee",
    Leader: "Gus",
    Location: "SP",
    Start: "2020-01-01",
    End: "",
    Status: "Active",
    Classification: "Talent",
    Outlook: "Promote",
  })
  expect(JSON.stringify(file)).not.toContain("private-note")
  expect(JSON.stringify(file)).not.toContain("lead-1")
  expect(JSON.stringify(file)).not.toContain("rateOverride")
  expect(JSON.stringify(file)).not.toContain("900")
  expect(Object.keys(file.rows[0])).not.toContain("Notes")

  const imported = importHeadcount([
    {
      ...file.rows[0],
      Notes: "private-note",
      cls: "Talent",
      outlook: "Promote",
      notes: "private-note",
      rateOverride: 900,
      "rate card": "A",
      increase: 3,
      aumento: 3,
      rates: [1],
      inc: 4,
    },
  ])
  expect(imported).toEqual({
    file: true,
    live: false,
    rows: [
      {
        Name: "Ada",
        Title: "CIO",
        Type: "Employee",
        Leader: "Gus",
        Location: "SP",
        Start: "2020-01-01",
        End: "",
        Status: "Active",
      },
    ],
  })
  expect(JSON.stringify(imported)).not.toContain("Talent")
  expect(JSON.stringify(imported)).not.toContain("Promote")
  expect(JSON.stringify(imported)).not.toContain("private-note")
  expect(JSON.stringify(imported)).not.toContain("900")
  expect(JSON.stringify(imported)).not.toContain("rate card")
})

function crossImports(file: string, source: string): string[] {
  const from = groupOf(file)
  const hits: string[] = []
  const pattern = /(?:import\s*\(\s*|from\s+)["'](\.[^"']+)["']/g
  for (const match of source.matchAll(pattern)) {
    const target = match[1].split("/").pop()
    if (!target) continue
    const name = target.endsWith(".ts") ? target : `${target}.ts`
    const to = groupOf(name)
    if (!to || to === "none") continue
    if (from === "none" || from !== to) hits.push(name)
  }
  return hits
}

function groupOf(file: string): string | undefined {
  for (const [group, files] of Object.entries(GROUPS)) {
    if (files.includes(file)) return group
  }
  return undefined
}

function store(): Store {
  const settings = legalInitialSettings()
  return {
    settings,
    form: {
      currency: "USD",
      fxRates: settings.fxRates,
      minQuotes: 3,
      requireActiveSupplier: false,
      techWeight: 60,
      commWeight: 40,
      criteria: [{ weight: 100 }],
      commCriteria: [{ weight: 100, auto: true }],
    },
    issued: { pr: [], po: [] },
    sup: [],
    suppliers: [],
    requests: {},
    actCalls: 0,
    lastIssued: null,
  }
}
