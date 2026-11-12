import { expect, test } from "bun:test"
import { readPmoNames, setPmoNames } from "../src/elo.ts"
import { emptyMap, resolve, setGroupName } from "../src/identity.ts"
import type { ResolvedActor } from "../src/identity.ts"
import type { Change } from "../src/records.ts"
import { quoteAgainst, setQuoteCap } from "../src/procurement-screen.ts"
import {
  budgetLineWrite,
  dashboardPages,
  setBudgetLines,
  setViewerSummaries,
  showPage,
  DASHBOARD_PAGES,
  PROCUREMENT_NAV,
} from "../src/surfaces.ts"

const AT = "2026-11-11T12:00:00Z"

function admin(surface: "dashboard" | "planner" | "procurement", canWrite = true): ResolvedActor {
  return { id: "ada", canWrite, roles: [{ surface, role: "admin" }] }
}

test("admin of the surface writes the five plugs, another admin does not, and an empty plug does not guess", () => {
  const audit: Change[] = []
  const dash = admin("dashboard")
  const plan = admin("planner")
  const proc = admin("procurement")

  expect(setViewerSummaries(null, ["IT Risks"], 0, proc, AT, audit)).toEqual({
    ok: false,
  })
  expect(setBudgetLines(null, ["line-9"], 0, plan, AT, audit)).toEqual({
    ok: false,
  })
  expect(setPmoNames(null, ["Ada"], 0, dash, AT, audit)).toEqual({ ok: false })
  expect(setQuoteCap(null, 10, 0, dash, AT, audit)).toEqual({ ok: false })
  expect(setGroupName(emptyMap(), "procurement", "buyer", "SG-Buyers", 0, dash, AT, audit)).toEqual({ ok: false })
  expect(audit).toEqual([])
  expect(setViewerSummaries(null, ["IT Risks"], 0, { ...dash, canWrite: false }, AT, audit)).toEqual({ ok: false })

  const summaries = setViewerSummaries(
    null,
    ["IT Risks", "Hardware", "Executive Dashboard", "Generate Report", "IT Risks"],
    0,
    dash,
    AT,
    audit,
  )
  if (!summaries.ok) throw new Error("dashboard admin did not set summaries")
  expect(summaries.row).toEqual({ version: 1, by: "ada", value: ["IT Risks"] })
  expect(dashboardPages({ roles: ["viewer"] }, summaries.row.value)).toEqual(["Executive Dashboard", "IT Risks"])
  expect(dashboardPages({ roles: ["viewer"] })).toEqual(["Executive Dashboard"])
  expect(showPage("Hardware")).toEqual({ drawn: false })
  expect(showPage("Generate Report")).toEqual({ drawn: false })
  expect(DASHBOARD_PAGES).toHaveLength(16)
  expect(PROCUREMENT_NAV).toHaveLength(5)
  const staleSummaries = setViewerSummaries(summaries.row, ["Hot Topics & Actions"], 0, dash, AT, audit)
  expect(staleSummaries).toEqual({
    ok: false,
    status: 409,
    stored: ["IT Risks"],
    by: "ada",
  })
  expect(summaries.row.value).toEqual(["IT Risks"])

  const lines = setBudgetLines(null, [" line-9 ", "", "line-9", "opex-1"], 0, dash, AT, audit)
  if (!lines.ok) throw new Error("dashboard admin did not set budget lines")
  expect(lines.row.value).toEqual(["line-9", "opex-1"])
  expect(budgetLineWrite({ canWrite: true, roles: ["domain leader"] }, "opex-1", lines.row.value)).toBe(true)
  expect(budgetLineWrite({ canWrite: true, roles: ["domain leader"] }, "other", lines.row.value)).toBe(false)
  expect(budgetLineWrite({ canWrite: true, roles: ["domain leader"] }, "opex-1")).toBe(false)
  expect(
    setBudgetLines(
      null,
      ["x"],
      0,
      {
        id: "lead",
        canWrite: true,
        roles: [{ surface: "dashboard", role: "domain leader" }],
      },
      AT,
      audit,
    ),
  ).toEqual({ ok: false })

  const projects = [{ name: "ERP" }]
  const names = setPmoNames(null, [" Ada ", "", "Ada", "Gus"], 0, plan, AT, audit)
  if (!names.ok) throw new Error("planner admin did not set pmo names")
  expect(names.row.value).toEqual(["Ada", "Gus"])
  expect(readPmoNames(names.row.value, projects)).toEqual({
    names: ["Ada", "Gus"],
    projects,
    imported: false,
  })
  expect(projects).toEqual([{ name: "ERP" }])
  expect(showPage("app.pmo")).toEqual({ drawn: false })

  expect(setQuoteCap(null, 0, 0, proc, AT, audit)).toEqual({ ok: false })
  expect(setQuoteCap(null, -1, 0, proc, AT, audit)).toEqual({ ok: false })
  expect(quoteAgainst(null, 1)).toEqual({ ok: false })
  expect(quoteAgainst(null, 25 * 1024 * 1024)).toEqual({ ok: false })
  const cap = setQuoteCap(null, 10, 0, proc, AT, audit)
  if (!cap.ok) throw new Error("procurement admin did not set the cap")
  expect(cap.row.value).toBe(10)
  expect(cap.row.value).not.toBe(25 * 1024 * 1024)
  expect(quoteAgainst(cap.row, 10)).toEqual({ ok: true })
  expect(quoteAgainst(cap.row, 11)).toEqual({ ok: false })
  const zero = setQuoteCap(cap.row, 0, cap.row.version, proc, AT, audit)
  expect(zero).toEqual({ ok: false })
  expect(cap.row.value).toBe(10)
  const cleared = setQuoteCap(cap.row, null, cap.row.version, proc, AT, audit)
  if (!cleared.ok) throw new Error("admin did not clear the cap")
  expect(cleared.row.value).toBeNull()
  expect(quoteAgainst(cleared.row, 1)).toEqual({ ok: false })

  const asked: string[] = []
  const named = setGroupName(emptyMap(), "procurement", "buyer", " SG-Buyers ", 0, proc, AT, audit)
  if (!named.ok) throw new Error("procurement admin did not name the group")
  expect(named.map.find((row) => row.role === "buyer" && row.surface === "procurement")?.entra).toBe("SG-Buyers")
  expect(named.map.find((row) => row.role === "buyer" && row.surface === "procurement")?.version).toBe(1)
  expect(emptyMap().every((row) => row.entra == null)).toBe(true)
  expect(setGroupName(named.map, "procurement", "cio", "X", 1, proc, AT, audit)).toEqual({ ok: false })
  const clearedName = setGroupName(named.map, "procurement", "buyer", "  ", 1, proc, AT, audit)
  if (!clearedName.ok) throw new Error("admin did not clear the group name")
  expect(clearedName.map.find((row) => row.surface === "procurement" && row.role === "buyer")?.entra).toBeNull()
  expect(
    resolve("dir-1", clearedName.map, (group) => {
      asked.push(group)
      return true
    }).roles,
  ).toEqual([])
  expect(asked).toEqual([])
  expect(JSON.stringify(named)).not.toContain("local:")
  expect(audit.some((line) => line.who === "ada" && line.at === AT && line.became != null)).toBe(true)
  expect(audit.find((line) => Array.isArray(line.became) && line.became[0] === "IT Risks")).toEqual({
    who: "ada",
    at: AT,
    was: null,
    became: ["IT Risks"],
  })
})
