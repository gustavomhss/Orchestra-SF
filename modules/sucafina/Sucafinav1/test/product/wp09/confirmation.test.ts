import { expect, test } from "bun:test"
import { createForecastConfirmationHost, createScopedConfirmationIndex } from "../../../product/routines/confirmation.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import type { ForecastCompareRequest } from "../../../product/contracts/operations.ts"
import type { PlannerPort } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const request = {} as ForecastCompareRequest
const context = {} as TrustedDomainContext
const planner = {} as PlannerPort

test("forecast confirmation uses scoped projection, not global version equality", async () => {
  const ids: string[] = []
  const host = createForecastConfirmationHost({ planner, listConfirmationIds: async () => ({ status: "ok", value: ["jan", "jan"] }), revalidate: async () => true, confirmation: { project: async (id) => { ids.push(id); return { status: "ok", value: { confirmationId: id, state: "valid", reason: "unchanged-scope", scopeFingerprint: "same", evaluatedSourceVersion: 8, evaluatedAt: "2026-11-13" } } } } })
  const result = await host.confirmations(request, context)
  expect(ids).toEqual(["jan"])
  expect(result.status === "ok" && result.value[0]?.state).toBe("valid")
})

test("missing producer and revoked scope never become a valid confirmation", async () => {
  const base = { planner, listConfirmationIds: async () => ({ status: "ok" as const, value: ["jan"] }), revalidate: async () => true }
  expect((await createForecastConfirmationHost(base).confirmations(request, context)).status).toBe("unavailable")
  const host = createForecastConfirmationHost({ ...base, confirmation: { project: async (id) => ({ status: "ok", value: { confirmationId: id, state: "unavailable", reason: "access-unavailable", evaluatedSourceVersion: 7, evaluatedAt: "2026-11-13" } }) } })
  expect(await host.confirmations(request, context)).toEqual({ status: "unavailable", reason: "confirmation-source-unavailable" })
})

test("confirmation lookup rejects a scope changed during discovery", async () => {
  let reads = 0
  const lookup = createScopedConfirmationIndex({
    resolveScopes: async () => ({ status: "ok", value: [{ scopeDefinitionVersion: ++reads === 1 ? "one" : "two" } as ConfirmationScope] }),
    confirmation: { find: async () => ({ status: "ok", value: { confirmationIds: ["jan"] } }) },
    revalidate: async () => true,
  })
  expect(await lookup(request, context)).toEqual({ status: "stale", reason: "confirmation-scope-changed" })
})

// Selector boundary tests use an explicit C06 readScope stub; domain/C06 composition is in forecast-coverage.test.ts.
test.each(["audit-only", "period", "incarnation", "material"])("scope coverage distinguishes %s dependency changes", async (change) => {
  const period = { start: "2027-01-01", end: "2027-01-31" }
  const dependency = { surface: "planner" as const, type: "planner-version", id: "dependency", incarnation: "physical-scope", version: 1,
    fields: ["fx", "rates"], period, observedAt: "2026-11-14T01:00:00Z" }
  const scope: ConfirmationScope = { sourceRef: { surface: "planner", type: "planner-version", id: "selected", incarnation: "selected-scope" }, fields: ["summary"], period,
    materialDependencies: [dependency], scopeDefinitionVersion: "producer-v1" }
  const changedScope: ConfirmationScope = { ...scope, ...(change === "period" ? { period: { start: "2027-02-01", end: "2027-02-28" } } : {}),
    materialDependencies: [{ ...dependency, version: 2, fields: [...dependency.fields].reverse(), observedAt: "2026-11-14T02:00:00Z",
      ...(change === "incarnation" ? { incarnation: "replacement-scope" } : {}) }] }
  let reads = 0
  let projections = 0
  const index = createScopedConfirmationIndex({ resolveScopes: async () => ({ status: "ok", value: [++reads === 1 ? scope : changedScope] }),
    confirmation: { find: async () => { throw new Error("readScope is the authoritative coverage reader") }, readScope: async () => ({ status: "ok", value: {
      confirmationId: "confirmed", state: "valid", reason: "unchanged-scope", scopeFingerprint: change === "material" && ++projections > 1 ? "changed" : "same", evaluatedAt: "2026-11-14T01:00:00Z", evaluatedSourceVersion: reads,
    } }) }, revalidate: async () => true })
  const result = await index.readCoverage!(request, context)
  if (change === "audit-only") expect(result).toMatchObject({ status: "ok", value: { scopes: [{ scope, confirmation: { state: "valid", scopeFingerprint: "same" } }] } })
  if (change === "period" || change === "incarnation") expect(result).toEqual({ status: "stale", reason: "confirmation-scope-changed" })
  if (change === "material") expect(result).toEqual({ status: "stale", reason: "confirmation-source-changed" })
})

