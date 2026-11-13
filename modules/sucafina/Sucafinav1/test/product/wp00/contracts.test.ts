import { expect, test } from "bun:test"
import { decodeProductContext } from "../../../product/contracts/validation.ts"
import { sfOperationInputSchemas } from "../../../product/contracts/operations.ts"
import type { ProductContext } from "../../../product/contracts/context.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { CapabilityDescriptor } from "../../../product/contracts/sf-execution.ts"
import type { ContributionEnvelope } from "../../../product/contracts/resident-ai.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const context: ProductContext = {
  installationId: "installation-1", projectId: "project-1", principalRef: "principal-1",
  accessRevision: "access-1", policyVersion: "policy-1", surface: "planner", currency: "USD",
  period: { start: "2026-01-01", end: "2026-12-31" }, capabilities: ["sf_forecast_compare"],
  sourceRefs: [{ surface: "planner", type: "forecast", id: "forecast-1", incarnation: "incarnation-1", version: 1,
    fields: ["amount"], period: { start: "2026-01-01", end: "2026-12-31" }, observedAt: "2026-11-13T04:01:10Z" }],
}

// These references make package typechecking traverse every shared seam before domain consumers land.
type ContractSeams = [BusinessContextService, CapabilityDescriptor, ContributionEnvelope, SfProductStatePort]
const seamCount: ContractSeams["length"] = 4

test("context admission preserves explicit scope without sharing mutable input", () => {
  const result = decodeProductContext(context)
  expect(result).toEqual({ ok: true, value: context })
  if (result.ok) expect(result.value.sourceRefs).not.toBe(context.sourceRefs)
  expect(seamCount).toBe(4)
})

test("context admission rejects absent or impossible periods and unversioned references", () => {
  expect(decodeProductContext({ ...context, period: undefined }).ok).toBe(false)
  expect(decodeProductContext({ ...context, period: { start: "2026-02-30", end: "2026-12-31" } }).ok).toBe(false)
  expect(decodeProductContext({ ...context, period: { start: "2026-12-31", end: "2026-01-01" } }).ok).toBe(false)
  expect(decodeProductContext({ ...context, sourceRefs: [{ ...context.sourceRefs[0], incarnation: "" }] }).ok).toBe(false)
  expect(decodeProductContext({ ...context, currency: "USD+EUR" }).ok).toBe(false)
  expect(decodeProductContext({ ...context, owner: "forged-owner" })).toEqual({ ok: false, reason: "unexpected-context-field" })
})

test("all capability entry schemas close their host identity argument boundary", () => {
  expect(Object.keys(sfOperationInputSchemas)).toHaveLength(39)
  for (const schema of Object.values(sfOperationInputSchemas)) {
    expect(schema.additionalProperties).toBe(false)
    for (const key of ["principalRef", "profileId", "owner", "provider", "nativeSessionId", "credentials"])
      expect(key in schema.properties).toBe(false)
  }
})

test("reading an old installation never initializes or persists product state implicitly", async () => {
  const storage = testPersistence()
  const before = structuredClone(storage.state.dashboard)
  const state = createSfProductState({ persistence: storage.persistence, createId: () => "incarnation-1", authorize: async () => ({ principalRef: "principal-1", policyVersion: "policy-1", accessRevision: "access-1" }) })
  expect(await state.read(new Request("https://example.test/product"), "preferences", () => "content")).toEqual({ status: "unavailable", reason: "product-state-uninitialized-or-invalid" })
  expect(await state.transaction(new Request("https://example.test/product"), { namespace: "preferences", expectedVersion: 0, idempotencyKey: "preview-1", commandDigest: "a".repeat(64) }, async (staged) => {
    staged.preferences.theme = "dark"
    return { commit: false, value: "preview" }
  })).toMatchObject({ status: "ok", revision: 0, value: "preview" })
  expect(storage.state.dashboard).toEqual(before)
})
