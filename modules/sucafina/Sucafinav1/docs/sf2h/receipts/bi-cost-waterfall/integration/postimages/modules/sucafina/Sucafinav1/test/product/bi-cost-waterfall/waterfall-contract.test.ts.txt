import { expect, test } from "bun:test"
import { resolveWaterfall } from "../../../product/analytics/waterfall.ts"
import type { WaterfallPlan } from "../../../product/analytics/waterfall.ts"
import type { DomainProjection, ProjectionValue } from "../../../product/contracts/context.ts"

type Observations = { initial: number | null; first: number | null; firstEnd: number | null; second: number | null; secondEnd: number | null; final: number | null }

// Resolver contract fixture only. Every amount and endpoint is declared as an
// independent producer observation; this fixture does not calculate costs.
function fixture(observations: Observations = { initial: 100, first: 20, firstEnd: 120, second: -5, secondEnd: 115, final: 115 }) {
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const supplied: [string, number | null][] = [
    ["baseline", observations.initial],
    ["first-contribution", observations.first],
    ["first-end", observations.firstEnd],
    ["second-contribution", observations.second],
    ["second-end", observations.secondEnd],
    ["candidate-total", observations.final],
  ]
  const projection: DomainProjection = {
    context: { installationId: "installation", projectId: "project", principalRef: "finance", policyVersion: "policy-1", accessRevision: "access-1", surface: "planner", period, currency: "USD", capabilities: [], sourceRefs: [{ surface: "planner", type: "planner-version", id: "forecast", incarnation: "forecast-incarnation", version: 3, fields: ["cost"], period, observedAt: "2027-01-01T00:00:00Z" }] },
    version: 3,
    engineVersion: "producer-v1",
    values: supplied.map(([id, value]) => ({ id, value, unit: "money", currency: "USD", period, granularity: "aggregate", sourceRefs: [], drilldown: null, evidenceState: value === null ? "absent" : "confirmed" })),
    components: [],
    missing: [],
  }
  const plan: WaterfallPlan = {
    segments: [
      { label: "Freight", startValueId: "baseline", componentValueId: "first-contribution", endValueId: "first-end" },
      { label: "Storage", startValueId: "first-end", componentValueId: "second-contribution", endValueId: "second-end" },
    ],
    finalValueId: "candidate-total",
    reconciliation: "reconciled",
  }
  return { projection, plan }
}

function changeValue(projection: DomainProjection, id: string, change: Partial<ProjectionValue>): DomainProjection {
  return { ...projection, values: projection.values.map((value) => value.id === id ? { ...value, ...change } : value) }
}

test("waterfall resolves the supplied 100 +20 -5 composition without changing its table or envelope", () => {
  const { projection, plan } = fixture()
  const original = structuredClone({ projection, plan })
  const result = resolveWaterfall(projection, plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("reconciled")
  expect(result.initial).toBe(100)
  expect(result.final).toBe(115)
  expect(result.segments.map(({ start, amount, end }) => ({ start, amount, end }))).toEqual([
    { start: 100, amount: 20, end: 120 },
    { start: 120, amount: -5, end: 115 },
  ])
  expect(result.segments.map((segment) => segment.componentValueId)).toEqual(["first-contribution", "second-contribution"])
  expect(result.segments[0]!.source).toBe(projection.values[1])
  expect(result.segments[1]!.source).toBe(projection.values[3])
  expect(result.initialSource).toBe(projection.values[0])
  expect(result.finalSource).toBe(projection.values[5])
  expect({ projection, plan }).toEqual(original)
})

test("waterfall reports a tampered delta without repairing it or inserting a residual", () => {
  const { projection, plan } = fixture()
  const changed = changeValue(projection, "first-contribution", { value: 21 })
  const original = structuredClone(changed)
  const result = resolveWaterfall(changed, plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("unreconciled")
  expect(result.segments).toHaveLength(2)
  expect(result.segments[0]!.amount).toBe(21)
  expect(result.segments[0]!.end).toBe(120)
  expect(result.final).toBe(115)
  expect(changed).toEqual(original)
})

test("waterfall keeps the producer's inconsistent final endpoint explicit without a balancing component", () => {
  const { projection, plan } = fixture()
  const result = resolveWaterfall(changeValue(projection, "candidate-total", { value: 116 }), plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("unreconciled")
  expect(result.segments.map(({ amount, end }) => ({ amount, end }))).toEqual([{ amount: 20, end: 120 }, { amount: -5, end: 115 }])
  expect(result.final).toBe(116)
})

test("waterfall reports discontinuous supplied endpoints even when both deltas individually match", () => {
  const { projection, plan } = fixture({ initial: 100, first: 20, firstEnd: 120, second: -5, secondEnd: 114, final: 114 })
  const changed: DomainProjection = { ...projection, values: [...projection.values, { ...projection.values[2]!, id: "separate-start", value: 119 }] }
  const separated: WaterfallPlan = { ...plan, segments: [plan.segments[0]!, { ...plan.segments[1]!, startValueId: "separate-start" }] }
  const result = resolveWaterfall(changed, separated)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("unreconciled")
  expect(result.segments.map(({ start, amount, end }) => ({ start, amount, end }))).toEqual([{ start: 100, amount: 20, end: 120 }, { start: 119, amount: -5, end: 114 }])
})

test("waterfall retains negative endpoints and cancelling contributions", () => {
  const { projection, plan } = fixture({ initial: 10, first: -20, firstEnd: -10, second: 20, secondEnd: 10, final: 10 })
  const result = resolveWaterfall(projection, plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("reconciled")
  expect(result.initial).toBe(10)
  expect(result.final).toBe(10)
  expect(result.segments.map(({ start, amount, end }) => ({ start, amount, end }))).toEqual([{ start: 10, amount: -20, end: -10 }, { start: -10, amount: 20, end: 10 }])
})

test("waterfall retains a confirmed zero contribution", () => {
  const { projection, plan } = fixture({ initial: 100, first: 0, firstEnd: 100, second: -5, secondEnd: 95, final: 95 })
  const result = resolveWaterfall(projection, plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("reconciled")
  expect(result.segments[0]!.amount).toBe(0)
  expect(result.segments[0]!.start).toBe(100)
  expect(result.segments[0]!.end).toBe(100)
})

for (const id of ["baseline", "first-contribution", "first-end", "candidate-total"]) test(`waterfall keeps absent ${id} unavailable instead of substituting zero`, () => {
  const { projection, plan } = fixture()
  const changed = changeValue(projection, id, { value: null, evidenceState: "absent" })
  const result = resolveWaterfall(changed, plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("unavailable")
  expect(changed.values.find((value) => value.id === id)?.value).toBeNull()
  if (id === "baseline") expect(result.initial).toBeNull()
  if (id === "first-contribution") expect(result.segments[0]!.amount).toBeNull()
  if (id === "first-end") expect(result.segments[0]!.end).toBeNull()
  if (id === "candidate-total") expect(result.final).toBeNull()
})

test("waterfall does not treat an absent zero observation as a confirmed cost", () => {
  const { projection, plan } = fixture({ initial: 100, first: 0, firstEnd: 100, second: -5, secondEnd: 95, final: 95 })
  const result = resolveWaterfall(changeValue(projection, "first-contribution", { evidenceState: "absent" }), plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("unavailable")
  expect(result.segments[0]!.amount).toBeNull()
  expect(result.segments[0]!.source.value).toBe(0)
  expect(result.segments[0]!.source.evidenceState).toBe("absent")
})

test("waterfall accepts the producer's finite floating-point addition without subtractive reconstruction", () => {
  const { projection, plan } = fixture({ initial: 0.1, first: 0.2, firstEnd: 0.30000000000000004, second: 0, secondEnd: 0.30000000000000004, final: 0.30000000000000004 })
  const result = resolveWaterfall(projection, plan)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe("reconciled")
  expect(result.segments[0]!.amount).toBe(0.2)
  expect(result.final).toBe(0.30000000000000004)
})

for (const [label, change, reason] of [
  ["currency", { currency: "EUR" }, "incompatible-unit-or-currency"],
  ["unit", { unit: "fte" }, "incompatible-unit-or-currency"],
  ["horizon", { period: { start: "2027-01-01", end: "2027-06-30" } }, "incompatible-period"],
] as const satisfies readonly (readonly [string, Partial<ProjectionValue>, string])[]) test(`waterfall withholds incompatible ${label} without converting the supplied values`, () => {
  const { projection, plan } = fixture()
  const changed = changeValue(projection, "first-contribution", change)
  const original = structuredClone(changed)
  expect(resolveWaterfall(changed, plan)).toEqual({ status: "unavailable", reason })
  expect(changed).toEqual(original)
})

test("waterfall cannot invent a missing referenced observation", () => {
  const { projection, plan } = fixture()
  expect(resolveWaterfall({ ...projection, values: projection.values.filter((value) => value.id !== "first-contribution") }, plan)).toEqual({ status: "unavailable", reason: "missing-waterfall-value" })
})

test("waterfall refuses duplicate value identities rather than choosing one observation", () => {
  const { projection, plan } = fixture()
  expect(resolveWaterfall({ ...projection, values: [...projection.values, { ...projection.values[1]!, value: 999 }] }, plan)).toEqual({ status: "unavailable", reason: "duplicate-value-id" })
})

for (const reconciliation of ["unavailable", "unreconciled"] as const) test(`waterfall preserves the producer's ${reconciliation} reconciliation claim`, () => {
  const { projection, plan } = fixture()
  const result = resolveWaterfall(projection, { ...plan, reconciliation })
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  expect(result.reconciliation).toBe(reconciliation)
  expect(result.segments).toHaveLength(2)
})
