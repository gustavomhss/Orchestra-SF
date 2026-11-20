import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfDomainPageData } from "@orchestra/schema/sucafina/domain"
import { projectSfDomainData } from "../../../../../apps/cli/src/sucafina-product/native-ui/domain/projection.ts"

const finance = {
  opexOwners: [{ id: "opex", budget: 1200 }], opexEntries: [],
  capexProjects: [{ id: "capex", budget: 600 }], capexEntries: [],
}
const users = [
  { id: "prior-year", year: 2025, month: 12, users: 70 },
  { id: "january", year: 2026, month: 1, users: 20 },
  { id: "march", year: 2026, month: 3, users: 30 },
  { id: "august", year: 2026, month: 8, users: 40 },
]
const read = (source: Record<string, unknown>, year: number, month?: number) =>
  Schema.decodeUnknownSync(SfDomainPageData.CAP01)(projectSfDomainData("CAP01", source, year, month))

test("Executive four people measures preserve selected budget, user fallback and authorized yearly attrition", () => {
  const source = {
    ...finance, itUsersMonthly: users,
    executive: { active: 10, departures: 100, privateSalary: 999 },
    executiveByYear: { "2026": { active: 90, departures: 20, privateSalary: 888 } },
  }
  const before = structuredClone(source)
  const projected = read(source, 2026, 4)
  expect(projected.people).toEqual({
    year: 2026, month: 4, users: 30, opexCostPerUser: 40, totalCostPerUser: 60, attritionYtd: 20,
  })
  expect(source).toEqual(before)
  expect(JSON.stringify(projected)).not.toContain("privateSalary")
  expect(projected.people).not.toHaveProperty("members")
})

test("Executive users keep the original exact, preceding and latest-record fallback", () => {
  const source = { ...finance, itUsersMonthly: users }
  expect(read(source, 2026, 3).people).toMatchObject({ users: 30, opexCostPerUser: 40, totalCostPerUser: 60 })
  expect(read(source, 2026, 2).people).toMatchObject({ users: 20, opexCostPerUser: 60, totalCostPerUser: 90 })
  expect(read(source, 2027, 1).people).toMatchObject({ users: 40, opexCostPerUser: 30, totalCostPerUser: 45 })
})

test("Executive missing and nonpositive user denominators remain distinct from observed zero costs", () => {
  expect(read(finance, 2026, 4).people).toEqual({
    year: 2026, month: 4, users: null, opexCostPerUser: null, totalCostPerUser: null, attritionYtd: null,
  })
  const empty = { opexOwners: [], opexEntries: [], capexProjects: [], capexEntries: [] }
  expect(read({ ...empty, itUsersMonthly: [{ year: 2026, month: 4, users: 10 }] }, 2026, 4).people)
    .toMatchObject({ users: 10, opexCostPerUser: 0, totalCostPerUser: 0 })
  for (const users of [0, -1]) {
    expect(read({ ...finance, itUsersMonthly: [{ year: 2026, month: 4, users }] }, 2026, 4).people)
      .toMatchObject({ users, opexCostPerUser: null, totalCostPerUser: null })
  }
  expect(read({ itUsersMonthly: [{ year: 2026, month: 4, users: 10 }] }, 2026, 4).people)
    .toMatchObject({ users: 10, opexCostPerUser: null, totalCostPerUser: null })
})

test("Executive null yearly inputs override current inputs and never manufacture attrition", () => {
  const base = { executive: { active: 90, departures: 20 } }
  expect(read(base, 2026, 4).people?.attritionYtd).toBe(20)
  expect(read({ ...base, executiveByYear: { "2026": { active: null } } }, 2026, 4).people?.attritionYtd).toBeNull()
  expect(read({ executive: { active: 0, departures: 0 } }, 2026, 4).people?.attritionYtd).toBeNull()
  expect(read({ executive: { active: 90, departures: 0 } }, 2026, 4).people?.attritionYtd).toBe(0)
  expect(read({ executive: { active: 90 } }, 2026, 4).people?.attritionYtd).toBeNull()
})

test("Executive does not invent a month for callers without an admitted producer period", () => {
  expect(read({}, 2026)).toEqual({ itUsersMonthly: [], costPerUserBenchmarks: [] })
  for (const month of [0, 13, 1.5]) expect(read({}, 2026, month)).not.toHaveProperty("people")
  expect(read({}, 2026, 4).people).toMatchObject({ year: 2026, month: 4 })
})
