import { expect, test } from "bun:test"
import {
  autoRate,
  changeAnnual,
  clampFte,
  chosenRate,
  effectiveOwner,
  emptyFlags,
  fteDecember,
  hrLineDomains,
  hrMonth,
  isGone,
  lockAllows,
  natureTotals,
  nextCpx,
  orderSpan,
  outlookMonth,
  projectElements,
  resetSpread,
  spread,
  startMonth,
  syncDomain,
  syncRoster,
  syncEnters,
  syntheticHr,
  typeMonth,
  usdAmount,
  variance,
  ytd,
  zeroMonths,
} from "../src/planner-accounts.ts"

const IDS = [
  "S4-1",
  "S4-2",
  "S4-3",
  "S4-4",
  "S4-5",
  "S4-6",
  "S4-7",
  "S4-8",
  "S4-9",
  "S4-10",
  "S4-11",
  "S4-12",
  "S4-13",
  "S4-14",
  "S4-15",
]

test("S4 registry", async () => {
  const text = await Bun.file(new URL(import.meta.url)).text()
  for (const id of IDS) expect(text).toContain(`test("${id} `)
})

test("S4-1 100000 across 12 open months is 8333.33 eleven times and 8333.37 last", () => {
  const line = spread({ annual: 100000, b: zeroMonths(), bm: emptyFlags() })
  expect(line.b.slice(0, 11)).toEqual(Array.from({ length: 11 }, () => 8333.33))
  expect(line.b[11]).toBe(8333.37)
  expect(line.b.reduce((sum, value) => sum + value, 0)).toBeCloseTo(100000, 2)
  const trunc = spread({ annual: 100.02, b: zeroMonths(), bm: emptyFlags() })
  expect(trunc.b[0]).toBe(8.33)
  expect(trunc.b[0]).not.toBe(8.34)
  expect(trunc.b[11]).toBe(8.39)
})

test("S4-2 typing a month marks it manual; changing annual keeps manuals; reset clears flags", () => {
  const typed = typeMonth({ annual: 0, b: zeroMonths(), bm: emptyFlags() }, 0, 100)
  expect(typed.bm[0]).toBe(true)
  expect(typed.b[0]).toBe(100)
  expect(typed.annual).toBe(100)
  const blank = typeMonth(typed, 1, null)
  expect(blank.b[1]).toBe(0)
  expect(blank.bm[1]).toBe(true)
  const changed = changeAnnual(typed, 1000)
  expect(changed.bm[0]).toBe(true)
  expect(changed.b[0]).toBe(100)
  expect(changed.b[1]).toBe(81.81)
  expect(changed.b[11]).toBe(81.9)
  expect(changed.b.reduce((sum, value) => sum + value, 0)).toBeCloseTo(1000, 2)
  const allManual = {
    annual: 120,
    b: Array.from({ length: 12 }, () => 10),
    bm: Array.from({ length: 12 }, () => true),
  }
  const cleared = changeAnnual(allManual, 120)
  expect(cleared.bm.every((flag) => !flag)).toBe(true)
  const reset = resetSpread(typed)
  expect(reset.bm.every((flag) => !flag)).toBe(true)
  expect(reset.b.reduce((sum, value) => sum + value, 0)).toBeCloseTo(typed.annual, 2)
})

test("S4-3 closed month uses actual and null counts zero; open month uses forecast including zero", () => {
  expect(outlookMonth(0, 2, null, 9, 5)).toBe(0)
  expect(outlookMonth(1, 2, 4, null, 5)).toBe(4)
  expect(outlookMonth(2, 2, 4, 0, 5)).toBe(0)
  expect(outlookMonth(3, 2, 4, null, 5)).toBe(5)
})

test("S4-4 variance above zero is over cost; absolute difference under 0.5 shows a dash", () => {
  const over = variance(10, 4)
  expect(over.value).toBe(6)
  expect(over.over).toBe(true)
  expect(variance(10, 4).shown).toBe(6)
  expect(variance(4.2, 4).shown).toBe("–")
  expect(variance(4.5, 4).shown).toBe(0.5)
  expect(variance(3, 4).over).toBe(false)
})

test("S4-5 closed zero means YTD is zero, not January", () => {
  expect(ytd([9, 8, 7], 0)).toBe(0)
  expect(ytd([9, 8, 7], 2)).toBe(17)
})

test("S4-6 missing or non-positive rate counts zero and names the code; it is not a submit refusal", () => {
  expect(usdAmount(10, "USD", null)).toEqual({ usd: 10, warning: null })
  expect(usdAmount(10, "eur", 1.08).usd).toBeCloseTo(10.8, 8)
  expect(usdAmount(10, "CHF", 0)).toEqual({ usd: 0, warning: "CHF" })
  expect(usdAmount(10, "CHF", -2)).toEqual({ usd: 0, warning: "CHF" })
  expect(usdAmount(10, "USD", 0)).toEqual({ usd: 10, warning: null })
  expect(usdAmount(10, "BRL", null)).toEqual({ usd: 0, warning: "BRL" })
})

test("S4-7 HR month applies the increase from the effective month, as a percentage", () => {
  expect(hrMonth(false, true, 1, 12000, 1, 6, 1, 12, 7, 10)).toBe(0)
  expect(hrMonth(true, false, 1, 12000, 1, 6, 1, 12, 7, 10)).toBe(0)
  expect(hrMonth(true, true, 1, 12000, 1, 6, 1, 12, 7, 10)).toBe(1000)
  expect(hrMonth(true, true, 0.5, 12000, 2, 6, 1, 12, 7, 10)).toBe(1000)
  expect(hrMonth(true, true, 1, 12000, 1, 7, 1, 12, 7, 10)).toBe(1100)
  expect(hrMonth(true, true, 1, 12000, 1, 13, 1, 12, 7, 10)).toBe(0)
})

test("S4-8 rate is override, else the chosen card, else auto; no rate is no month cost", () => {
  const cards = [
    {
      id: "c",
      name: "Contractor day",
      locs: "Geneva",
      annual: 100,
      cur: "USD",
    },
    {
      id: "e",
      name: "Geneva",
      locs: "Geneva, Zurich",
      annual: 120000,
      cur: "CHF",
    },
  ]
  expect(autoRate(cards, "Contractor", "Geneva")?.id).toBe("c")
  expect(autoRate(cards, "Employee", "")).toBe(null)
  expect(autoRate(cards, "Employee", "Geneva")?.id).toBe("e")
  expect(autoRate(cards, "Employee", "Geneva Centre")?.id).toBe("e")
  expect(
    autoRate(
      [
        {
          id: "wide",
          name: "City",
          locs: "Geneva Centre",
          annual: 1,
          cur: "USD",
        },
      ],
      "Employee",
      "Geneva",
    ),
  ).toBe(null)
  expect(chosenRate(cards, "Employee", "Geneva", "e", 50)).toEqual({
    annual: 50,
    cur: "CHF",
  })
  expect(chosenRate(cards, "Employee", "Geneva", "e", "")?.annual).toBe(120000)
  expect(chosenRate(cards, "Employee", "", null, null)).toBe(null)
  expect(chosenRate(cards, "Employee", "", null, 50)).toBe(null)
  expect(chosenRate(cards, "Employee", "", null, 50)).not.toEqual({
    annual: 50,
    cur: "USD",
  })
  expect(hrMonth(true, false, 1, 0, 1, 1, 1, 12, 1, 0)).toBe(0)
})

test("S4-9 synthetic HR budget follows positions; actual and forecast stay on hrAF", () => {
  const first = syntheticHr(
    "Apps",
    [
      {
        include: true,
        fte: 1,
        start: 1,
        end: 12,
        type: "Employee",
        months: [10, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
    {
      a: [1, null, null, null, null, null, null, null, null, null, null, null],
      f: [2, null, null, null, null, null, null, null, null, null, null, null],
      owner: "ada",
    },
  )
  const later = syntheticHr(
    "Apps",
    [
      {
        include: true,
        fte: 1,
        start: 1,
        end: 12,
        type: "Employee",
        months: [99, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      },
    ],
    {
      a: first.actual,
      f: first.forecast,
      owner: "ada",
      entity: "CH",
      alloc: "IT",
    },
  )
  expect(first.budget[0]).toBe(10)
  expect(later.budget[0]).toBe(99)
  expect(later.actual).toBe(first.actual)
  expect(later.forecast?.[0]).toBe(2)
  expect(later.owner).toBe("ada")
  expect(later.entity).toBe("CH")
  expect(later.alloc).toBe("IT")
  expect(hrLineDomains([{ domain: "Apps" }], { Infra: {} })).toEqual(["Apps", "Infra"])
})

test("S4-10 December FTE does not require end equal to 12", () => {
  expect(fteDecember([{ include: true, fte: 1, start: 1, end: 12 }])).toBe(1)
  expect(fteDecember([{ include: true, fte: 0.5, start: 3, end: 14 }])).toBe(0.5)
  expect(fteDecember([{ include: true, fte: 1, start: 1, end: 11 }])).toBe(0)
  expect(fteDecember([{ include: true, fte: 1, start: 13, end: 14 }])).toBe(0)
  expect(fteDecember([{ include: true, fte: 1, start: 12, end: 12 }])).toBe(1)
  expect(fteDecember([{ include: false, fte: 1, start: 1, end: 12 }])).toBe(0)
  expect(fteDecember([{ include: true, fte: 1, end: 12 }])).toBe(0)
  expect(fteDecember([{ include: true, fte: null, start: 1, end: 12 }])).toBe(0)
  expect(clampFte(null)).toBe(1)
  expect(clampFte(3)).toBe(2)
  expect(clampFte(-1)).toBe(0)
  expect(clampFte(0.5)).toBe(0.5)
  expect(orderSpan(9, 3)).toEqual({ start: 3, end: 9 })
})

test("S4-11 depreciation does not enter a project; opex total includes synthetic HR and opex-classed project lines", () => {
  expect(projectElements()).not.toContain("depr")
  expect(projectElements()).toContain("hr")
  const totals = natureTotals([
    { sec: "opex", el: "hr", synthetic: true, usd: 10 },
    { sec: "opex", el: "licenses", usd: 5 },
    { sec: "capex", el: "licenses", cls: "opex", usd: 3 },
    { sec: "capex", el: "hwo", cls: "capex", usd: 7 },
    { sec: "capex", el: "depr", cls: "capex", usd: 100 },
    { sec: "capex", el: "depr", cls: "opex", usd: 40 },
  ])
  expect(totals.opex).toBe(18)
  expect(totals.capex).toBe(7)
})

test("S4-12 CPX is above the counter and every version; delete does not reuse; the counter does not go backwards", () => {
  const first = nextCpx(2026, 0, [])
  expect(first).toEqual({ n: 1, code: "CPX-2026-001", counter: 1 })
  const next = nextCpx(2027, 1, ["CPX-2026-009", "cpx-2024-0004"])
  expect(next.n).toBe(10)
  expect(next.code).toBe("CPX-2027-010")
  const afterDelete = nextCpx(2026, next.counter, [])
  expect(afterDelete.n).toBe(11)
  expect(afterDelete.n).not.toBe(1)
})

test("S4-13 effective owner is a display placeholder, not a stored value", () => {
  expect(effectiveOwner("ada", "capex", "project", ["lead"])).toEqual(["ada"])
  expect(effectiveOwner("", "capex", "project", ["lead"])).toEqual(["project"])
  expect(effectiveOwner("", "hr", "", ["lead"])).toEqual(["lead"])
  expect(effectiveOwner("", "opex", "", ["lead"])).toEqual([])
})

test("S4-14 lock blocks budget and structure; official cannot be deleted or unlocked; close-through stays", () => {
  for (const field of [
    "budget",
    "structure",
    "entity",
    "allocation",
    "classification",
    "currency",
    "fx",
    "headcount",
    "rate",
    "increase",
    "year",
  ]) {
    expect(lockAllows(field, true, false, true)).toBe(false)
  }
  for (const field of ["owner", "actual", "forecast", "note", "name"]) {
    expect(lockAllows(field, true, false, true)).toBe(true)
  }
  expect(lockAllows("closedThrough", true, true, true)).toBe(true)
  expect(lockAllows("closedThrough", true, false, false)).toBe(false)
  expect(lockAllows("unlock", false, true, true)).toBe(false)
  expect(lockAllows("delete", false, true, true)).toBe(false)
  expect(lockAllows("unlock", true, false, true)).toBe(true)
})

test("S4-15 planner budget zero is zero; null forecast uses budget; this is not the dashboard rule", () => {
  expect(outlookMonth(3, 0, null, null, 0)).toBe(0)
  expect(outlookMonth(0, 1, 0, null, 9)).toBe(0)
  expect(outlookMonth(1, 1, null, null, 0)).toBe(0)
  expect(outlookMonth(1, 1, null, 0, 9)).toBe(0)
})

test("sync matches the written roster rules", () => {
  expect(startMonth("2026-04-01", 2026)).toBe(4)
  expect(startMonth("2025-08-01", 2026)).toBe(1)
  expect(startMonth("2027-01-01", 2026)).toBe(13)
  expect(isGone({ name: "a", status: "Terminated" })).toBe(true)
  expect(isGone({ name: "b", end: "2026-00-01" })).toBe(true)
  expect(syncEnters({ name: "c", start: "2027-01-01" }, 2026)).toBe(false)
  expect(syncEnters({ name: "d", start: "2026-02-01", status: "Active" }, 2026)).toBe(true)
  expect(syncDomain(true, "Kept", "Ann", { Ann: "Apps" }, "Other")).toBe("Kept")
  expect(syncDomain(false, "Kept", "Ann", { Ann: "Apps" }, "Other")).toBe("Apps")
  expect(syncDomain(false, "Kept", "Bob", {}, undefined)).toBe("Unassigned")
  const kept = [{ name: "Jose", end: 12, domain: "Old" }]
  expect(syncRoster(kept, [], 2026, {}, true)).toEqual({ ok: false })
  expect(kept).toEqual([{ name: "Jose", end: 12, domain: "Old" }])
  const synced = syncRoster(kept, [{ name: "José", leader: "Ann", end: "2026-04-01" }], 2026, { Ann: "Apps" }, false)
  if (!synced.ok) throw new Error("sync refused an open version")
  expect(synced.positions).toEqual([{ name: "Jose", end: 4, domain: "Apps" }])
  const left = syncRoster([{ name: "Bea", end: 9 }], [], 2026, {}, false)
  if (!left.ok) throw new Error("sync refused")
  expect(left.positions).toEqual([{ name: "Bea", end: 9, left: true }])
  expect(left.positions).toHaveLength(1)
})
