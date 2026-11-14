// Selective copy of the two ordinary failing regressions from Operations 15df31a6.
// The original runtime record.value precondition is replaced by persisted facts;
// its owner-only runtime/procurement.ts correction is not imported into this lane.
import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { buyer, procurementExportFixture } from "./fixture.ts"
import { exportFiles } from "./artifacts.ts"

test("OPS-CONSUMER-EXPORT-01: future PO exports use their current estimate while the real sourcing decision stays frozen", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }] })
    const before = await fixture.material()
    expect(before).toMatchObject({ status: "src_pending", sourcing: { approval: { amount: 108 }, approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 } }, po: { currency: "EUR", lines: [{ qty: 1, unitPrice: 100 }], approval: null, fxRate: null } })
    const { register, money, html } = await exportFiles(fixture, "EXPORT-01")
    expect({ register, money }).toMatchObject({
      register: {
        "Selected quote total": "EUR 100.00",
        "PO currency": "EUR",
        "PO total": "100",
        "PO total (base)": "200",
        "PO base currency": "USD",
        "PO FX rate": "2",
        "PO FX source": "current",
        "PO monetary state": "estimate",
        "PO submitted amount": "Unavailable",
        "PO submitted currency": "Unavailable",
        "PO submitted FX rate": "Unavailable",
      },
      money: "<p>Monetary state: estimate. Current base amount: 200.00 USD. FX: 2 (current). Submitted approval: Unavailable; submitted FX: Unavailable.</p>",
    })
    expect(html).toContain("Status: src_pending")
    expect(html).not.toContain("<h2>Approvals</h2>")
    expect(html).not.toContain("108.00 USD")
    expect(await fixture.material()).toEqual(before)
  } finally { await fixture.close() }
})

test("OPS-CONSUMER-EXPORT-02: future PO line totals do not borrow the whole selected quote", async () => {
  const fixture = await procurementExportFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }] })
    const before = await fixture.material()
    expect(object(before).status).toBe("src_pending")
    // Read premise only; no claim that pending sourcing permits PO line edits.
    const files = await exportFiles(fixture, "EXPORT-02", (request) => {
      object(request.po).lines = [
        { description: "First separate line", qty: 1, unitPrice: 40, unit: "service" },
        { description: "Second separate line", qty: 1, unitPrice: 60, unit: "service" },
      ]
    })
    expect(files.lines).toEqual([
      { description: "First separate line", quantity: "1", unit: "service", unitPrice: "40.00", total: "40.00" },
      { description: "Second separate line", quantity: "1", unit: "service", unitPrice: "60.00", total: "60.00" },
    ])
    expect(files.html).toContain('<tr><th colspan="5">Total agreed price (excl. VAT)</th><td>100.00</td></tr>')
    expect(files.register).toMatchObject({ "PO currency": "EUR", "PO total": "100", "PO total (base)": "200", "PO FX source": "current", "PO monetary state": "estimate" })
    expect(await fixture.material()).toEqual(before)
  } finally { await fixture.close() }
})
