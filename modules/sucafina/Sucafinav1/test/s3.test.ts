import { expect, test } from "bun:test"
import {
  annualEntryMonths,
  applyYearAmount,
  attritionTone,
  attritionYtd,
  budgetChartSeries,
  computeBudgetTotals,
  costPerUser,
  costPerUserTone,
  effectiveMonthlyBudget,
  executiveReportTotals,
  isYearDeparture,
  itPerfScore,
  itUsersForMonth,
  itUsersWrite,
  onTargetCount,
  relevance,
  relevanceTier,
  riskFactorWrite,
  riskScore,
  riskTier,
  SECURITY_KPIS,
  securityKpiStatus,
  socClosureValue,
  stakeholderCategory,
  stakeholderFactorWrite,
  sumOwnerBudget,
} from "../src/dashboard-accounts.ts"

const IDS = ["S3-1", "S3-2", "S3-3", "S3-4", "S3-5", "S3-6", "S3-7", "S3-8", "S3-9", "S3-10", "S3-11", "S3-12"]

test("S3 registry", async () => {
  const text = await Bun.file(new URL(import.meta.url)).text()
  for (const id of IDS) expect(text).toContain(`test("${id} `)
})

test("S3-1 monthly budget above zero replaces annual/12; zero and absence are not zero", () => {
  expect(effectiveMonthlyBudget(500, 1200)).toBe(500)
  expect(effectiveMonthlyBudget(100, 1200)).toBe(100)
  expect(effectiveMonthlyBudget(0, 1200)).toBe(100)
  expect(effectiveMonthlyBudget(undefined, 1200)).toBe(100)
  expect(effectiveMonthlyBudget(-1, 1200)).toBe(100)
  expect(effectiveMonthlyBudget(0, 1200)).not.toBe(0)
})

test("S3-2 year amount absorbs the cent; clear does not write months", () => {
  const applied = applyYearAmount(100, 3)
  if (applied.cleared) throw new Error("expected a spread")
  expect(applied.per).toBe(33.33)
  expect(applied.last).toBe(33.34)
  expect(applied.actual.slice(0, 3)).toEqual([33.33, 33.33, 33.34])
  expect(applied.actual.slice(3)).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0])
  expect(applied.forecast).toEqual(Array.from({ length: 12 }, () => 33.33))
  expect(applied.forecast[2]).toBe(33.33)
  expect(applied.forecast[2]).not.toBe(33.34)
  expect(applyYearAmount("", 6)).toEqual({ cleared: true })
  expect(applyYearAmount(null, 6)).toEqual({ cleared: true })
})

test("S3-3 annual entry divides by 12 with no remainder on the last month", () => {
  const months = annualEntryMonths(100000)
  expect(months).toHaveLength(12)
  expect(new Set(months).size).toBe(1)
  expect(months[0]).toBe(8333.33)
  expect(months.reduce((sum, value) => sum + value, 0)).not.toBe(100000)
  const year = applyYearAmount(100000, 12)
  if (year.cleared) throw new Error("expected a year amount")
  expect(months[11]).not.toBe(year.actual[11])
})

test("S3-4 official actual and forecast sum twelve months, not the current month only", () => {
  const totals = computeBudgetTotals(
    {
      opexOwners: [{ id: "a", budget: 1200 }],
      opexEntries: [
        { year: 2026, month: 1, ownerId: "a", actual: 10, forecast: 20 },
        { year: 2026, month: 12, ownerId: "a", actual: 5, forecast: 7 },
        { year: 2025, month: 1, ownerId: "a", actual: 999, forecast: 999 },
      ],
      capexProjects: [{ id: "p", budget: 0 }],
      capexEntries: [
        { year: 2026, month: 1, projId: "p", actual: 1, forecast: 2 },
        { year: 2026, month: 12, projectId: "p", actual: 8, forecast: 9 },
      ],
    },
    2026,
  )
  expect(totals.opexActual).toBe(15)
  expect(totals.opexForecast).toBe(27)
  expect(totals.capexActual).toBe(9)
  expect(totals.capexForecast).toBe(11)
  expect(totals.totalActual).toBe(24)
  expect(totals.totalForecast).toBe(38)
})

test("S3-5 cost per user uses IT users of the month; zero users shows zero", () => {
  const entries = [
    { year: 2025, month: 12, users: 40 },
    { year: 2026, month: 2, users: 10 },
    { year: 2026, month: 5, users: 0 },
  ]
  expect(itUsersForMonth(entries, 5, 2026)).toBe(0)
  expect(itUsersForMonth(entries, 4, 2026)).toBe(10)
  expect(
    itUsersForMonth(
      [
        { year: 2026, month: 1, users: 4 },
        { year: 2026, month: 3, users: 9 },
      ],
      4,
      2026,
    ),
  ).toBe(9)
  expect(itUsersForMonth(entries, 1, 2027)).toBe(0)
  expect(itUsersWrite("")).toBe(0)
  expect(itUsersWrite(null)).toBe(0)
  expect(itUsersWrite(12)).toBe(12)
  expect(costPerUser(1200, 0)).toBe(0)
  expect(costPerUser(1200, 10)).toBe(120)
  expect(costPerUser(1200, itUsersForMonth([{ year: 2024, month: 3, users: 8 }], 1, 2026))).toBe(150)
})

test("S3-6 attrition excludes on leave; colour is a threshold, not a stored rule", () => {
  expect(isYearDeparture("Terminated", "2026-03-01", "2026")).toBe(true)
  expect(isYearDeparture("On Leave", "2026-03-01", "2026")).toBe(false)
  expect(isYearDeparture("Terminated", "2025-12-01", "2026")).toBe(false)
  expect(attritionYtd(2, 10)).toBeCloseTo(18.18181818, 5)
  expect(attritionYtd(2, 10)).not.toBe(20)
  expect(attritionTone(15)).toBe("amber")
  expect(attritionTone(15)).not.toBe("red")
  expect(attritionTone(16)).toBe("red")
  expect(attritionTone(9)).toBe("amber")
  expect(attritionTone(8)).toBe("green")
})

test("S3-7 risk score is impact times probability, with the written tiers", () => {
  expect(riskScore(5, 5)).toBe(25)
  expect(riskTier(21)).toBe("Critical")
  expect(riskTier(20)).toBe("Very High")
  expect(riskTier(16)).toBe("Very High")
  expect(riskTier(15)).toBe("High")
  expect(riskTier(9)).toBe("High")
  expect(riskTier(8)).toBe("Medium")
  expect(riskTier(3)).toBe("Medium")
  expect(riskTier(2)).toBe("Low")
  expect(riskFactorWrite("")).toBe(1)
  expect(riskFactorWrite(9)).toBe(9)
})

test("S3-8 security KPI uses section 7.11; empty is not zero; closure derives when the sum exists", () => {
  expect(SECURITY_KPIS).toEqual([
    { key: "training", target: 95, moderate: 80, better: "high" },
    { key: "patch", target: 95, moderate: 70, better: "high" },
    { key: "patchEndpoint", target: 95, moderate: 70, better: "high" },
    { key: "patchServer", target: 95, moderate: 70, better: "high" },
    { key: "scan", target: 95, moderate: 85, better: "high" },
    { key: "assessment", target: 80, moderate: 70, better: "high" },
    { key: "socPending", target: 0, moderate: 5, better: "low" },
    { key: "socClosure", target: 100, moderate: 95, better: "high" },
  ])
  expect(securityKpiStatus("high", 95, 80, "")).toBe("No data")
  expect(securityKpiStatus("high", 95, 80, 0)).toBe("High risk")
  expect(securityKpiStatus("high", 95, 80, 95)).toBe("Good")
  expect(securityKpiStatus("high", 95, 80, 80)).toBe("Moderate")
  expect(securityKpiStatus("high", 80, 70, 70)).toBe("Moderate")
  expect(securityKpiStatus("high", 95, 85, 85)).toBe("Moderate")
  expect(securityKpiStatus("low", 0, 5, 0)).toBe("Good")
  expect(securityKpiStatus("low", 0, 5, 5)).toBe("Moderate")
  expect(securityKpiStatus("low", 0, 5, 6)).toBe("High risk")
  expect(
    socClosureValue({
      socCritical: 4,
      socHigh: 0,
      socMedium: 0,
      socLow: 0,
      socPending: 1,
    }),
  ).toBe(75)
  expect(
    socClosureValue({
      socCritical: 4,
      socHigh: 0,
      socMedium: 0,
      socLow: 0,
      socPending: 1,
    }),
  ).not.toBe(25)
  expect(
    socClosureValue({
      socCritical: 1,
      socHigh: 1,
      socMedium: 0,
      socLow: 0,
      socPending: 1,
      socClosure: 1,
    }),
  ).toBe(50)
  expect(
    socClosureValue({
      socCritical: 0,
      socHigh: 0,
      socMedium: 0,
      socLow: 0,
      socPending: 0,
      socClosure: 40,
    }),
  ).toBe(40)
  expect(socClosureValue({ socClosure: 40 })).toBe(40)
  expect(socClosureValue({ socClosure: "" })).toBe(null)
})

test("S3-9 relevance is biz times iti; category follows section 7.14", () => {
  expect(relevance(5, 4)).toBe(20)
  expect(relevanceTier(17)).toBe("action")
  expect(relevanceTier(16)).toBe("monitor")
  expect(relevanceTier(10)).toBe("monitor")
  expect(relevanceTier(9)).toBe("low")
  expect(stakeholderCategory(10, 4)).toBe("Champion")
  expect(stakeholderCategory(10, 2)).toBe("Sceptic")
  expect(stakeholderCategory(10, 3)).toBe("Engaged Neutral")
  expect(stakeholderCategory(10, 0)).toBe("Sceptic")
  expect(stakeholderCategory(9, 0)).toBe("Low Engagement")
  expect(stakeholderCategory(9, 4)).toBe("Ally")
  expect(stakeholderCategory(9, 1)).toBe("Low Engagement")
  expect(stakeholderCategory(9, 3)).toBe("Passive")
  expect(stakeholderFactorWrite("")).toBe(1)
})

test("S3-10 IT perf is a weighted average; empty score is out; on target is ahead, on, complete", () => {
  expect(
    itPerfScore([
      { score: "", totalWeight: 1 },
      { score: 4, totalWeight: 1 },
      { score: 2, totalWeight: 3 },
    ]),
  ).toBe(2.5)
  expect(
    itPerfScore([
      { score: 0, totalWeight: 1 },
      { score: 4, totalWeight: 1 },
    ]),
  ).toBe(2)
  expect(itPerfScore([{ score: "", totalWeight: 1 }])).toBe(null)
  expect(itPerfScore([{ score: 4, totalWeight: 0 }])).toBe(null)
  expect(
    onTargetCount([
      { score: 1, totalWeight: 1, status: "ahead" },
      { score: 1, totalWeight: 1, status: "on" },
      { score: 1, totalWeight: 1, status: "behind" },
      { score: 1, totalWeight: 1, status: "complete" },
    ]),
  ).toBe(3)
})

test("S3-11 chart stays flat total/12; cards stay computeBudgetTotals", () => {
  const data = {
    opexOwners: [{ id: "a", budget: 1200 }],
    opexEntries: [{ year: 2026, month: 1, ownerId: "a", budget: 500 }],
  }
  const cards = computeBudgetTotals(data, 2026)
  const chart = budgetChartSeries(cards.totalBudget)
  expect(chart.every((value) => value === cards.totalBudget / 12)).toBe(true)
  expect(chart[0]).not.toBe(500)
  expect(cards.opexBudget).toBe(500 + 100 * 11)
})

test("S3-12 executive report uses the twelve-month total, not the sum of owner.budget", () => {
  const data = {
    opexOwners: [{ id: "a", budget: 1200 }],
    opexEntries: [
      {
        year: 2026,
        month: 1,
        ownerId: "a",
        budget: 500,
        actual: 1,
        forecast: 1,
      },
    ],
  }
  const report = executiveReportTotals(data, 2026)
  expect(report.totalBudget).toBe(computeBudgetTotals(data, 2026).totalBudget)
  expect(report.totalBudget).not.toBe(sumOwnerBudget(data))
  expect(costPerUserTone(10, 10)).toBe("green")
  expect(costPerUserTone(11, 10)).toBe("red")
})
