import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { buyer, holder, procurementExportFixture } from "./fixture.ts"
import { exportFiles } from "./artifacts.ts"

type Fixture = Awaited<ReturnType<typeof procurementExportFixture>>

test("submitted PO exports keep their own FX2 snapshot after FX3 and cancellation", async () => {
  const fixture = await procurementExportFixture()
  try {
    await submitPo(fixture)
    const submitted = await fixture.material()
    expect(submitted).toMatchObject({ status: "po_pending", sourcing: { approval: { amount: 108 }, fxSnapshot: { EUR: 1.08 } }, po: { approval: { amount: 200 }, approvalBaseCurrency: "USD", fxRate: 2 } })
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 3 }] })
    const pending = await exportFiles(fixture, "PO-SUBMITTED-FX3")
    expect(pending.register).toMatchObject({ Status: "po_pending", "PO total": "100", "PO currency": "EUR", "PO total (base)": "200", "PO base currency": "USD", "PO FX rate": "2", "PO FX source": "submitted", "PO monetary state": "pending-approval", "PO submitted amount": "200", "PO submitted currency": "USD", "PO submitted FX rate": "2" })
    expect(pending.money).toBe("<p>Monetary state: pending-approval. Current base amount: 200.00 USD. FX: 2 (submitted). Submitted approval: 200.00 USD; submitted FX: 2.</p>")
    expect(pending.html).not.toContain("300.00 USD")
    expect(pending.lines[0]?.total).toBe("100.00")
    expect(await fixture.material()).toEqual(submitted)

    await fixture.run(fixture.requester, "cancel", { reason: "The order is no longer needed" })
    const cancelledRecord = await fixture.material()
    expect(object(cancelledRecord).po).toEqual(object(submitted).po)
    const cancelled = await exportFiles(fixture, "PO-CANCELLED-FROZEN")
    expect(cancelled.register).toMatchObject({ Status: "cancelled", "PO total (base)": "200", "PO FX rate": "2", "PO FX source": "submitted", "PO monetary state": "cancelled", "PO submitted amount": "200", "PO submitted currency": "USD", "PO submitted FX rate": "2" })
    expect(cancelled.money).toBe("<p>Monetary state: cancelled. Current base amount: 200.00 USD. FX: 2 (submitted). Submitted approval: 200.00 USD; submitted FX: 2.</p>")
    expect(cancelled.html).toContain("Status: cancelled")
  } finally { await fixture.close() }
})

test("cancellation directly from sourcing retains PO semantics without borrowing sourcing approval", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    await fixture.run(fixture.requester, "cancel", { reason: "Stop this purchase" })
    expect(await fixture.material()).toMatchObject({ status: "cancelled", sourcing: { approval: { amount: 108 }, approvalBaseCurrency: "USD" }, po: { approval: null, fxRate: null } })
    const files = await exportFiles(fixture, "SOURCING-CANCELLED")
    expect(files.register).toMatchObject({ Status: "cancelled", "PO total": "100", "PO total (base)": "200", "PO FX rate": "2", "PO FX source": "current", "PO monetary state": "cancelled", "PO submitted amount": "Unavailable", "PO submitted currency": "Unavailable", "PO submitted FX rate": "Unavailable" })
    expect(files.money).toBe("<p>Monetary state: cancelled. Current base amount: 200.00 USD. FX: 2 (current). Submitted approval: Unavailable; submitted FX: Unavailable.</p>")
    expect(files.html).not.toContain("<h2>Approvals</h2>")
  } finally { await fixture.close() }
})

test("missing live FX leaves the future PO unconverted and preserves the frozen sourcing record", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    const submitted = await fixture.material()
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }] })
    const files = await exportFiles(fixture, "PO-LIVE-FX-MISSING")
    expect(files.register).toMatchObject({ "PO currency": "EUR", "PO total": "100", "PO total (base)": "Unavailable", "PO base currency": "USD", "PO FX rate": "Unavailable", "PO FX source": "Unavailable", "PO monetary state": "estimate", "PO submitted amount": "Unavailable" })
    expect(files.money).toBe("<p>Monetary state: estimate. Current base amount: Unavailable. FX: Unavailable (Unavailable). Submitted approval: Unavailable; submitted FX: Unavailable.</p>")
    expect(files.lines[0]?.total).toBe("100.00")
    expect(files.html).not.toContain("0.00 USD")
    expect(await fixture.material()).toEqual(submitted)
  } finally { await fixture.close() }
})

test("a changed base currency does not relabel submitted PO approval history", async () => {
  const fixture = await procurementExportFixture()
  try {
    await submitPo(fixture)
    const submitted = await fixture.material()
    await fixture.settings({ currency: "GBP", fxRates: [{ code: "USD", rate: 0.8 }, { code: "EUR", rate: 3 }] })
    const files = await exportFiles(fixture, "PO-BASE-CHANGED")
    expect(files.register).toMatchObject({ "PO currency": "EUR", "PO total": "100", "PO total (base)": "Unavailable", "PO base currency": "GBP", "PO FX rate": "Unavailable", "PO FX source": "Unavailable", "PO submitted amount": "200", "PO submitted currency": "USD", "PO submitted FX rate": "2" })
    expect(files.money).toBe("<p>Monetary state: pending-approval. Current base amount: Unavailable. FX: Unavailable (Unavailable). Submitted approval: 200.00 USD; submitted FX: 2.</p>")
    expect(files.html).not.toContain("200.00 GBP")
    expect(await fixture.material()).toEqual(submitted)
  } finally { await fixture.close() }
})

test("missing historical PO FX never falls back to current FX3", async () => {
  const fixture = await procurementExportFixture()
  try {
    await submitPo(fixture)
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 3 }] })
    const files = await exportFiles(fixture, "PO-SUBMITTED-FX-MISSING", (request) => {
      // Damaged history premise on a discarded read copy, never a domain command.
      delete object(request.po).fxRate
    })
    expect(files.register).toMatchObject({ "PO total": "100", "PO total (base)": "Unavailable", "PO FX rate": "Unavailable", "PO FX source": "Unavailable", "PO monetary state": "pending-approval", "PO submitted amount": "200", "PO submitted currency": "USD", "PO submitted FX rate": "Unavailable" })
    expect(files.money).toBe("<p>Monetary state: pending-approval. Current base amount: Unavailable. FX: Unavailable (Unavailable). Submitted approval: 200.00 USD; submitted FX: Unavailable.</p>")
    expect(files.html).not.toContain("300.00 USD")
  } finally { await fixture.close() }
})

test("line quantities and unit prices define each exported amount even when redundant amount fields disagree", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    const files = await exportFiles(fixture, "PO-LINE-QUANTITIES", (request) => {
      object(request.po).lines = [
        { description: "Two service days", qty: 2, unitPrice: 20, amount: 999, unit: "day" },
        { desc: "Three service hours", qty: 3, unitPrice: 20, amount: 888, uom: "hour" },
      ]
    })
    expect(files.lines).toEqual([
      { description: "Two service days", quantity: "2", unit: "day", unitPrice: "20.00", total: "40.00" },
      { description: "Three service hours", quantity: "3", unit: "hour", unitPrice: "20.00", total: "60.00" },
    ])
    expect(files.register).toMatchObject({ "Selected quote total": "EUR 100.00", "PO currency": "EUR", "PO total": "100", "PO total (base)": "200" })
    expect(files.html).toContain('<tr><th colspan="5">Total agreed price (excl. VAT)</th><td>100.00</td></tr>')
    expect(files.html).not.toContain("999.00")
    expect(files.html).not.toContain("888.00")
  } finally { await fixture.close() }
})

test("missing and nonfinite monetary inputs stay unavailable while observed zero remains zero in both files", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    for (const missing of [
      { id: "QTY-ABSENT", line: { unitPrice: 20 } },
      { id: "PRICE-ABSENT", line: { qty: 2 } },
      { id: "PRICE-NAN", line: { qty: 2, unitPrice: Number.NaN } },
    ]) {
      const files = await exportFiles(fixture, missing.id, (request) => {
        object(request.po).lines = [
          { description: "Unavailable input", unit: "service", ...missing.line },
          { description: "Observed zero", qty: 0, unitPrice: 0, unit: "service" },
        ]
      })
      expect(files.lines[0]?.total).toBe("Unavailable")
      expect(files.lines[1]).toEqual({ description: "Observed zero", quantity: "0", unit: "service", unitPrice: "0.00", total: "0.00" })
      expect(files.register).toMatchObject({ "PO currency": "EUR", "PO total": "Unavailable", "PO total (base)": "Unavailable" })
      expect(files.html).toContain('<tr><th colspan="5">Total agreed price (excl. VAT)</th><td>Unavailable</td></tr>')
      expect(files.money).toContain("Current base amount: Unavailable.")
    }
    const zero = await exportFiles(fixture, "PO-OBSERVED-ZERO", (request) => {
      object(request.po).lines = [{ description: "Observed zero", qty: 0, unitPrice: 0, unit: "service" }]
    })
    expect(zero.register).toMatchObject({ "PO total": "0", "PO total (base)": "0", "PO FX rate": "2", "PO FX source": "current", "PO submitted amount": "Unavailable" })
    expect(zero.money).toBe("<p>Monetary state: estimate. Current base amount: 0.00 USD. FX: 2 (current). Submitted approval: Unavailable; submitted FX: Unavailable.</p>")
  } finally { await fixture.close() }
})

test("incidental PO without usable lines cannot borrow the selected sourcing quote", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    for (const premise of [{ id: "LINES-ABSENT", lines: undefined }, { id: "LINES-EMPTY", lines: [] }, { id: "LINES-MALFORMED", lines: [null] }]) {
      const files = await exportFiles(fixture, premise.id, (request) => { object(request.po).lines = premise.lines })
      expect(files.register).toMatchObject({ "Selected quote total": "EUR 100.00", "PO total": "Unavailable", "PO total (base)": "Unavailable", "PO FX rate": "Unavailable", "PO monetary state": "Unavailable", "PO submitted amount": "Unavailable" })
      expect(files.money).toBe("<p>Monetary state: Unavailable. Current base amount: Unavailable. FX: Unavailable (Unavailable). Submitted approval: Unavailable; submitted FX: Unavailable.</p>")
      expect(files.html).not.toContain("108.00 USD")
    }
  } finally { await fixture.close() }
})

test("future PO estimates remain separate in real sourcing and rejected sourcing stages", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    const sourcing = await exportFiles(fixture, "PO-FUTURE-SOURCING")
    expect(sourcing.register).toMatchObject({ Status: "sourcing", "PO total (base)": "200", "PO FX source": "current", "PO monetary state": "estimate", "PO submitted amount": "Unavailable" })
    expect(sourcing.money).toBe("<p>Monetary state: estimate. Current base amount: 200.00 USD. FX: 2 (current). Submitted approval: Unavailable; submitted FX: Unavailable.</p>")
    await fixture.run(buyer, "submit_sourcing")
    await fixture.run(holder, "reject", { reason: "Review the sourcing evidence" })
    const rejected = await exportFiles(fixture, "PO-FUTURE-REJECTED")
    expect(rejected.register).toMatchObject({ Status: "src_rejected", "PO total (base)": "200", "PO FX source": "current", "PO monetary state": "estimate", "PO submitted amount": "Unavailable" })
    expect(rejected.money).toBe("<p>Monetary state: estimate. Current base amount: 200.00 USD. FX: 2 (current). Submitted approval: Unavailable; submitted FX: Unavailable.</p>")
  } finally { await fixture.close() }
})

async function submitPo(fixture: Fixture) {
  await fixture.run(buyer, "submit_sourcing")
  await fixture.run(holder, "approve")
  await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
  await fixture.run(buyer, "submit_po", { po: { description: "Agreed service", paymentTerms: "Net 30", deliveryDate: "2026-12-01", deliveryConditions: "Service delivery", expenseType: "OPEX" } })
}
