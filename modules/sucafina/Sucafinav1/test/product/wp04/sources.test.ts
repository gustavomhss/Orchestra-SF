import { expect, test } from "bun:test"

test("projection digest excludes bank details while retaining authorized business fields", async () => {
  const { digestProcurementSource } = await import("../../../product/procurement/sources.ts")
  const settings = { currency: "USD" }
  const before = { id: "s", legalName: "Supplier", iban: "private-a", history: [{ field: "account", value: "private-a" }] }
  const after = { id: "s", legalName: "Supplier", iban: "private-b", history: [{ field: "account", value: "private-b" }] }
  expect(digestProcurementSource(before, settings)).toBe(digestProcurementSource(after, settings))
  expect(digestProcurementSource(before, settings, "supplier")).toBe(digestProcurementSource(before, { currency: "EUR", fxRates: [{ code: "USD", rate: 2 }] }, "supplier"))
  expect(digestProcurementSource(before, settings)).not.toBe(digestProcurementSource({ ...before, legalName: "Other" }, settings))
  const request = { number: "PR-1", createdBy: "a", status: "draft", pr: { title: "Owned", internalNote: "private-a" } }
  expect(digestProcurementSource(request, settings)).toBe(digestProcurementSource({ ...request, pr: { ...request.pr, internalNote: "private-b" } }, settings))
  const submitted = { number: "PR-1", createdBy: "a", status: "src_pending", sourcing: { approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 }, selectedId: "q", quotes: [{ id: "q", currency: "EUR", total: 100, scores: [4], cscores: [3] }] } }
  expect(digestProcurementSource(submitted, settings)).not.toBe(digestProcurementSource({ ...submitted, sourcing: { ...submitted.sourcing, fxSnapshot: { EUR: 1.09 } } }, settings))
  expect(digestProcurementSource(submitted, settings)).not.toBe(digestProcurementSource(submitted, { ...settings, techWeight: 60 }))
})
