import { expect, test } from "bun:test"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createForecastConfirmationHost, createScopedConfirmationIndex } from "../../../product/routines/confirmation.ts"
import { prepareForecastReview } from "../../../product/routines/forecast.ts"
import { createRoutinePlannerFixture, routineJanuary, routinePlannerPeriod } from "./planner-review-fixture.ts"

// Actual Planner, C06, authority and SQLite. This is not a native Relay execution witness.
test("Forecast retains every required C06 scope: one confirmation cannot close a second unconfirmed scope", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    const first = await fixture.source("v0")
    const second = await fixture.source("v1")
    const scope = (id: string, incarnation: string): ConfirmationScope => ({ sourceRef: { surface: "planner", type: "planner-version", id, incarnation },
      fields: ["summary"], period: routineJanuary, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" })
    const a = scope("v0", first.target.incarnation)
    const b = scope("v1", second.target.incarnation)
    const selected = { scopes: [a, b] }
    const revalidate = (_request: unknown, context: TrustedDomainContext) => fixture.host.revalidate(context)
    const index = createScopedConfirmationIndex({ resolveScopes: async () => ({ status: "ok", value: selected.scopes }), confirmation: fixture.confirmations, revalidate })
    const host = createForecastConfirmationHost({ planner: fixture.product.planner, confirmation: fixture.confirmations, listConfirmationIds: index, revalidate })
    const read = async () => {
      const base = await fixture.source("v0")
      const candidate = await fixture.source("v1")
      return prepareForecastReview({ request: { baseRef: base.refId, candidateRef: candidate.refId, period: routinePlannerPeriod, currency: "USD" }, context: fixture.context, host })
    }
    expect(await read()).toMatchObject({ status: "ok", value: { reviewState: "unconfirmed", confirmations: [], pendingConfirmationIds: [], complete: false,
      confirmationCoverage: { state: "checked", scopes: expect.arrayContaining([{ scope: a, confirmation: null }, { scope: b, confirmation: null }]) } } })
    const confirmedA = await fixture.confirm(a, "first-only")
    const partial = await read()
    expect(partial).toMatchObject({ status: "ok", value: { reviewState: "pending", complete: false, pendingConfirmationIds: [],
      confirmationCoverage: { state: "checked", scopes: expect.arrayContaining([{ scope: b, confirmation: null }]) } } })
    if (partial.status !== "ok") throw new Error(partial.reason)
    expect(partial.value.confirmations.map((entry) => entry.confirmationId)).toEqual([confirmedA.id])
    const confirmedB = await fixture.confirm(b, "second-confirmed")
    const complete = await read()
    expect(complete).toMatchObject({ status: "ok", value: { reviewState: "confirmed", pendingConfirmationIds: [], confirmationCoverage: { state: "checked" } } })
    if (complete.status !== "ok") throw new Error(complete.reason)
    expect(complete.value.confirmations.map((entry) => entry.confirmationId).sort()).toEqual([confirmedA.id, confirmedB.id].sort())
    // January remains valid after a February edit; a January edit only reopens its own existing record.
    await fixture.editActual("v1", 1, 41000)
    expect(await read()).toMatchObject({ status: "ok", value: { reviewState: "confirmed", pendingConfirmationIds: [] } })
    await fixture.editActual("v1", 0, 42000)
    expect(await read()).toMatchObject({ status: "ok", value: { reviewState: "pending", pendingConfirmationIds: [confirmedB.id] } })
    expect(await fixture.confirmations.project(confirmedA.id, fixture.context)).toMatchObject({ status: "ok", value: { state: "valid" } })
    // A different period is a different required scope, never inherited from January.
    const february = { ...b, period: { start: "2027-02-01", end: "2027-02-28" } }
    selected.scopes = [a, february]
    expect(await read()).toMatchObject({ status: "ok", value: { reviewState: "pending", pendingConfirmationIds: [],
      confirmationCoverage: { state: "checked", scopes: expect.arrayContaining([{ scope: february, confirmation: null }]) } } })
  } finally { await fixture.dispose() }
}, 120_000)

test("an unavailable C06 scope is not erased as absent and releases no Forecast data", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    const first = await fixture.source("v0")
    const second = await fixture.source("v1")
    const scopes: ConfirmationScope[] = [first, second].map((ref) => ({ sourceRef: { surface: "planner", type: "planner-version", id: ref.target.recordId, incarnation: ref.target.incarnation },
      fields: ["summary"], period: routineJanuary, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }))
    await fixture.confirm(scopes[0]!, "only-accessible-confirmation")
    const revalidate = (_request: unknown, context: TrustedDomainContext) => fixture.host.revalidate(context)
    const index = createScopedConfirmationIndex({ resolveScopes: async () => ({ status: "ok", value: scopes }), confirmation: fixture.confirmations, revalidate })
    const host = createForecastConfirmationHost({ planner: fixture.product.planner, confirmation: fixture.confirmations, listConfirmationIds: index, revalidate })
    await fixture.persistence.transaction("planner", async (snapshot) => {
      snapshot.data.versions = (snapshot.data.versions as { id: string }[]).filter((version) => version.id !== "v1")
      return { commit: true, value: undefined }
    })
    const current = await fixture.source("v0")
    const request = { baseRef: current.refId, candidateRef: current.refId, period: routineJanuary, currency: "USD" }
    expect(await index.readCoverage!(request, fixture.context)).toMatchObject({ status: "unavailable" })
    const result = await prepareForecastReview({ request, context: fixture.context, host })
    expect(result.status).toBe("unavailable")
    expect(result).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
}, 120_000)

test("legacy ID-only confirmation readers keep facts but cannot assert complete scope coverage", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    const source = await fixture.source("v0")
    const scope: ConfirmationScope = { sourceRef: { surface: "planner", type: "planner-version", id: "v0", incarnation: source.target.incarnation },
      fields: ["summary"], period: routineJanuary, materialDependencies: [], scopeDefinitionVersion: "planner-c06-v1" }
    const confirmed = await fixture.confirm(scope, "legacy-confirmed")
    const host = createForecastConfirmationHost({ planner: fixture.product.planner, confirmation: fixture.confirmations,
      listConfirmationIds: async () => ({ status: "ok", value: [confirmed.id] }), revalidate: (_request, context) => fixture.host.revalidate(context) })
    const result = await prepareForecastReview({ request: { baseRef: source.refId, candidateRef: source.refId, period: routineJanuary, currency: "USD" }, context: fixture.context, host })
    expect(result).toMatchObject({ status: "ok", value: { reviewState: "pending", complete: false, synthesisIncluded: false,
      confirmationCoverage: { state: "unavailable", reason: "confirmation-scope-coverage-unavailable" } } })
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.confirmations[0]?.confirmationId).toBe(confirmed.id)
    expect(result.value.comparison.baseline.values.length).toBeGreaterThan(0)
  } finally { await fixture.dispose() }
}, 120_000)
