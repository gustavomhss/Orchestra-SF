import { expect, test } from "bun:test"
import { quoteAssessment } from "../../../src/form.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { requestValue } from "../../../src/procurement-screen.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { projectProcurementConfirmationFields } from "../../../product/procurement/confirmation-fields.ts"
import { procurementMonetaryFacts } from "../../../product/procurement/monetary.ts"

test("the canonical three-offer fixture preserves scoring, eligibility and exact price premium", () => {
  const settings = initialProcurementSettings()
  const sourcing = {
    quotes: [
      { id: "A", total: 32400, currency: "USD", techPass: true, scores: [5, 4, 4, 4, 4], cscores: [null, 4, 4] },
      { id: "B", total: 28000, currency: "EUR", techPass: true, scores: [4, 4, 4, 3, 4], cscores: [null, 5, 4] },
      { id: "C", total: 29000, currency: "USD", techPass: false, scores: [5, 5, 5, 5, 5], cscores: [null, 5, 5] },
    ],
  }
  const ranking = quoteAssessment({ sourcing }, settings)
  expect(ranking[0]).toMatchObject({ id: "A", rank: 1, eligible: true, complete: true })
  expect(ranking[0]!.overall).toBeCloseTo(87.93333333333334, 10)
  expect(ranking[1]).toMatchObject({ id: "B", rank: 2, eligible: true, complete: true, overall: 85 })
  expect(ranking[2]).toMatchObject({ id: "C", rank: null, eligible: false })
  const a = requestValue({ status: "sourcing", createdBy: "buyer", sourcing: { ...sourcing, selectedId: "A" } }, settings)
  const b = requestValue({ status: "sourcing", createdBy: "buyer", sourcing: { ...sourcing, selectedId: "B" } }, settings)
  if (a == null || b == null) throw new Error("Canonical monetary basis unavailable")
  expect(a - b).toBeCloseTo(2160, 10)
  expect((a - b) / b * 100).toBeCloseTo(7.142857142857142, 10)
})

test("missing currency and incomplete purchase orders cannot inherit a base-currency estimate", () => {
  const settings = initialProcurementSettings()
  const missingCurrency = { status: "po_draft", value: 100, po: { lines: [{ qty: 1, unitPrice: 100 }] } }
  expect(procurementMonetaryFacts(missingCurrency, "USD", settings)).toMatchObject({ original: 100, currency: "", baseAmount: null, validRate: null, fxSource: null })
  const missingLines = { status: "po_issued", value: 100, pr: { estAmount: 100 }, po: { currency: "USD", approvalBaseCurrency: "USD", lines: [] }, sourcing: { selectedId: "q", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1 }, quotes: [{ id: "q", currency: "USD", total: 90 }] } }
  expect(procurementMonetaryFacts(missingLines, "USD", settings)).toMatchObject({ original: null, baseAmount: null, monetaryState: "issued-internally" })
  const missingQuote = { status: "src_pending", value: 100, pr: { estAmount: 100 }, sourcing: { selectedId: "gone", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1 }, quotes: [] } }
  expect(procurementMonetaryFacts(missingQuote, "USD", settings)).toMatchObject({ original: null, baseAmount: null, currency: "" })
  expect(procurementMonetaryFacts({ status: "sourcing", value: 100, sourcing: { quotes: [{ total: 100, currency: "USD" }] } }, "USD", settings).original).toBeNull()
})

test("ambiguous selected quotes and an overflowing order remain unavailable", () => {
  const settings = initialProcurementSettings()
  const duplicate = { status: "sourcing", value: 10, sourcing: { selectedId: "q", quotes: [{ id: "q", currency: "USD", total: 10 }, { id: "q", currency: "USD", total: 20 }] } }
  expect(procurementMonetaryFacts(duplicate, "USD", settings)).toMatchObject({ original: null, baseAmount: null, currency: "" })
  const overflow = { status: "po_draft", value: 1, po: { currency: "USD", lines: [{ qty: 1, unitPrice: Number.MAX_VALUE }, { qty: 1, unitPrice: Number.MAX_VALUE }] } }
  expect(procurementMonetaryFacts(overflow, "USD", settings)).toMatchObject({ original: null, baseAmount: null })
  const malformed = { status: "po_draft", value: 100, po: { currency: "USD", lines: [{ qty: 1, unitPrice: 100 }, null] } }
  expect(procurementMonetaryFacts(malformed, "USD", settings)).toMatchObject({ original: null, baseAmount: null })
})

test("rejected submissions preserve the submitted currency and never reinterpret a frozen rate", () => {
  const settings = { currency: "GBP", fxRates: [{ code: "EUR", rate: 0.8 }] }
  const record = { status: "po_rejected", value: 80, po: { currency: "EUR", fxRate: 1.08, approvalBaseCurrency: "USD", approval: { amount: 108 }, lines: [{ qty: 1, unitPrice: 100 }] } }
  expect(procurementMonetaryFacts(record, "GBP", settings)).toMatchObject({ original: 100, currency: "EUR", baseAmount: null, validRate: null, submittedAmount: 108, submittedCurrency: "USD", submittedFxRate: 1.08 })
  const sourcing = { selectedId: "q", approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 }, approval: { amount: 108 }, quotes: [{ id: "q", currency: "EUR", total: 100 }] }
  expect(procurementMonetaryFacts({ status: "src_rejected", value: 80, sourcing }, "GBP", settings)).toMatchObject({ original: 100, baseAmount: null, validRate: null, submittedAmount: 108, submittedCurrency: "USD" })
})

test("C06 preserves zero versus absence and fingerprints compensating financial inputs", () => {
  const settings = initialProcurementSettings()
  const empty = projectProcurementConfirmationFields({ status: "draft", pr: {} }, ["baseAmount"], { currency: "USD", formSettings: settings })!
  const zero = projectProcurementConfirmationFields({ status: "draft", value: 999, pr: { estAmount: 0 } }, ["baseAmount"], { currency: "USD", formSettings: settings })!
  expect(empty.values.baseAmount).toBeNull()
  expect(empty.states.baseAmount).toBe("absent")
  expect(zero.values.baseAmount).toBe(0)
  expect(zero.states.baseAmount).toBe("estimated")
  expect(zero.dependencies.rules).toEqual({ monetary: "procurement-money-v2" })
  expect(projectProcurementConfirmationFields({ status: "draft", pr: { title: "Need" } }, ["subject"])!.dependencies).not.toHaveProperty("rules")
  expect(digestSfValue(zero)).not.toBe(digestSfValue(empty))
  const first = { status: "po_approved", po: { currency: "EUR", approvalBaseCurrency: "USD", fxRate: 2, lines: [{ qty: 2, unitPrice: 5 }] } }
  const second = { status: "po_approved", po: { ...first.po, fxRate: 4, lines: [{ qty: 1, unitPrice: 5 }] } }
  const a = projectProcurementConfirmationFields(first, ["baseAmount"], { currency: "USD", formSettings: settings })!
  const b = projectProcurementConfirmationFields(second, ["baseAmount"], { currency: "USD", formSettings: settings })!
  expect(a.values.baseAmount).toBe(20)
  expect(b.values.baseAmount).toBe(20)
  expect(digestSfValue(a.dependencies)).not.toBe(digestSfValue(b.dependencies))
  const unrelatedRate = { ...settings, fxRates: [...settings.fxRates, { code: "XYZ", rate: 200 }] }
  expect(projectProcurementConfirmationFields(first, ["baseAmount"], { currency: "USD", formSettings: unrelatedRate })).toEqual(a)
})
