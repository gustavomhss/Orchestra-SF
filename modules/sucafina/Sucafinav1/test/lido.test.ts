import { expect, test } from "bun:test"
import {
  completedQuarter,
  deptFailColor,
  heatCell,
  importProjects,
  itPerfColor,
  itPerfOwnerOver,
  itPerfWeightWarn,
  phishRate,
  phishTone,
  riskFactorWrite,
} from "../src/dashboard-accounts.ts"
import { applyRemoveMissing } from "../src/planner-accounts.ts"
import { wordScript } from "../src/surfaces.ts"

test("heat, phishing and IT perf color use the thresholds that were in the HTML", () => {
  expect(heatCell(0, 0, 0)).toEqual({ bg: "", dot: "⚪" })
  expect(heatCell(2, 0, 0).dot).toBe("🔴")
  expect(heatCell(1, 0, 0).dot).toBe("🟠")
  expect(heatCell(0, 5, 0).dot).toBe("🟠")
  expect(heatCell(0, 1, 0).dot).toBe("🟡")
  expect(heatCell(0, 0, 20).dot).toBe("🟡")
  expect(heatCell(0, 0, 1).dot).toBe("🟢")
  expect(phishRate(1, 0)).toBeNull()
  expect(phishRate(1, 10)).toBe(10)
  expect(phishTone("low", 10, 10, 20)).toBe("moderate")
  expect(phishTone("low", 9.9, 10, 20)).toBe("good")
  expect(phishTone("high", 20, 20, 10)).toBe("moderate")
  expect(phishTone("high", 20.1, 20, 10)).toBe("good")
  expect(deptFailColor(40)).toBe("red")
  expect(deptFailColor(20)).toBe("amber")
  expect(deptFailColor(null)).toBe("green")
  expect(itPerfColor(2.5)).toBe("amber")
  expect(itPerfColor(2.49)).toBe("red")
  expect(itPerfColor(null)).toBe("muted")
  expect(itPerfColor(null)).not.toBe("red")
})

test("a weight that is not 100 warns after the save, and the quarter is the previous one", () => {
  expect(itPerfWeightWarn(0.5, 1)).toBe(true)
  expect(itPerfWeightWarn(1.004, 1)).toBe(false)
  expect(itPerfWeightWarn(1.006, 1)).toBe(true)
  expect(itPerfOwnerOver(0.2, 0.1, 0.1, 0.1)).toBe(true)
  expect(itPerfOwnerOver(0.2, 0.2, 0, 0)).toBe(false)
  expect(completedQuarter(1)).toBe("q4")
  expect(completedQuarter(4)).toBe("q1")
  expect(completedQuarter(12)).toBe("q3")
  expect(riskFactorWrite(0)).toBe(1)
  expect(riskFactorWrite(6)).toBe(6)
  expect(riskFactorWrite("")).toBe(1)
})

test("project import merges by name, replace needs confirmation, and capex is not deleted", () => {
  const projects = [
    {
      id: "old",
      name: "ERP",
      milestones: ["m"],
      createdAt: "2020-01-01",
      budget: 1,
    },
  ]
  const capex = [{ id: "old" }]
  const refused = importProjects(
    projects,
    capex,
    [{ name: "ERP", budget: 9 }],
    "replace",
    false,
    "2026-11-11",
    () => "new",
  )
  expect(refused).toEqual({ ok: false })
  expect(projects).toEqual([
    {
      id: "old",
      name: "ERP",
      milestones: ["m"],
      createdAt: "2020-01-01",
      budget: 1,
    },
  ])
  const replaced = importProjects(
    projects,
    capex,
    [
      { name: "erp", budget: 9, _status: "ok" },
      { name: "Bad", _status: "error" },
    ],
    "replace",
    true,
    "2026-11-11",
    () => "new",
  )
  if (!replaced.ok) throw new Error("replace did not import")
  expect(replaced.projects).toEqual([
    {
      id: "new",
      createdAt: "2026-11-11",
      milestones: [],
      name: "erp",
      desc: undefined,
      status: undefined,
      risk: undefined,
      priority: undefined,
      pm: undefined,
      leaderId: undefined,
      start: undefined,
      end: undefined,
      budget: 9,
      spent: undefined,
      pct: undefined,
      notes: undefined,
      updatedAt: "2026-11-11",
    },
  ])
  expect(replaced.capexProjects).toEqual(capex)
  expect(replaced.added).toBe(1)
  const updated = importProjects(
    projects,
    capex,
    [{ name: " ERP ", budget: 4 }],
    "update",
    false,
    "2026-11-11",
    () => "nope",
  )
  if (!updated.ok) throw new Error("update did not match")
  expect(updated.updated).toBe(1)
  expect(updated.projects[0].id).toBe("old")
  expect(updated.projects[0].milestones).toEqual(["m"])
  expect(updated.projects[0].budget).toBe(4)
  expect(
    importProjects(projects, capex, [{ name: "X", _status: "error" }], "replace", true, "2026-11-11", () => "new"),
  ).toEqual({ ok: false })
})

test("removeMissing drops unseen lines and positions, and does not drop an orphan project", () => {
  const lines = [
    { id: "a", sec: "opex" },
    { id: "b", sec: "capex" },
    { id: "c", sec: "opex" },
  ]
  const projects = [{ id: "orphan" }]
  const positions = [{ id: "p1" }, { id: "p2" }]
  const kept = applyRemoveMissing(
    lines,
    projects,
    positions,
    { opex: ["a"], capex: [] },
    ["p1"],
    { opex: true, capex: true, headcount: true },
    true,
    true,
  )
  expect(kept.lines.map((line) => line.id)).toEqual(["a"])
  expect(kept.positions.map((position) => position.id)).toEqual(["p1"])
  expect(kept.projects).toEqual(projects)
  const locked = applyRemoveMissing(
    lines,
    projects,
    positions,
    { opex: [], capex: [] },
    [],
    { opex: true, headcount: true },
    false,
    true,
  )
  expect(locked.lines).toEqual(lines)
  expect(locked.positions).toEqual(positions)
  const noSheet = applyRemoveMissing(
    lines,
    projects,
    positions,
    { opex: [], capex: ["b"] },
    [],
    { capex: true },
    true,
    true,
  )
  expect(noSheet.lines.map((line) => line.id)).toEqual(["a", "b", "c"])
})

test("Word is a script, not a slide and not a page", () => {
  expect(wordScript("", 2026, "11 Nov 2026", [])).toEqual({ ok: false })
  const script = wordScript("CIO Report", 2026, "11 Nov 2026", [
    {
      title: "Budget",
      subtitle: "FY",
      bullets: ["Say the total"],
      metrics: [{ label: "OPEX", value: "$1" }],
    },
  ])
  if (!script.ok) throw new Error("word did not generate")
  expect(script.page).toBe(false)
  expect(script.line).toBe("Presenter script · FY 2026 · Generated 11 Nov 2026")
  expect(script.file).toBe("CIO_Report.docx")
  expect(script.sections[0].heading).toBe("1. Budget")
  expect(script.sections[0].bullets).toEqual(["» Say the total"])
  expect(script.sections[0].figures).toBe("OPEX: $1")
  expect(script.sections[0]).not.toHaveProperty("rows")
})
