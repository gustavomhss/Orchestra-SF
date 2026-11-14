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

