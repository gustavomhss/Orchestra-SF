import { expect, test } from "bun:test"
import { object } from "../../../runtime/contract.ts"
import { download } from "../../../runtime/downloads.ts"
import { buyer, consumerFixture, environment } from "./fixture.ts"

function artifactText(result: Awaited<ReturnType<typeof download>>) {
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(`Export unavailable: ${result.status}`)
  return new TextDecoder().decode(result.bytes)
}

test("OPS-CONSUMER-EXPORT-01: future PO exports use their current estimate while the real sourcing decision stays frozen", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }] })
    const before = await fixture.material()
    expect(before.record).toMatchObject({ status: "src_pending", value: 108, sourcing: { approval: { amount: 108 }, approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 } }, po: { currency: "EUR", lines: [{ qty: 1, unitPrice: 100 }], approval: null, fxRate: null } })

    const csv = artifactText(await fixture.export("register"))
    const html = artifactText(await fixture.export("po"))
    const cells = csv.split("\r\n").map((line) => [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1]!.replaceAll('""', '"')))
    expect(cells).toHaveLength(2)
    const register = Object.fromEntries(cells[0]!.map((name, index) => [name, cells[1]![index]]))
    expect((await fixture.material()).persisted).toEqual(before.persisted)

    // These columns describe the future PO, not the pending sourcing approval.
    expect({ register, money: html.match(/<p>Monetary state:[\s\S]*?<\/p>/)?.[0] }).toMatchObject({
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
  } finally { await fixture.close() }
})

test("OPS-CONSUMER-EXPORT-02: future PO line totals do not borrow the whole selected quote", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }] })
    const before = await fixture.material()
    const snapshot = await fixture.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const request = object(object(object(snapshot.data.store).requests)[fixture.target.id]).request
    // Output-only robustness fixture: this copied snapshot is never committed.
    // It does not claim that a buyer can edit PO lines during pending sourcing.
    object(object(request).po).lines = [
      { description: "First separate line", qty: 1, unitPrice: 40, unit: "service" },
      { description: "Second separate line", qty: 1, unitPrice: 60, unit: "service" },
    ]
    expect(object(request).status).toBe("src_pending")
    const html = artifactText(await download("po", snapshot, buyer, environment, new URLSearchParams({ request: fixture.target.id })))
    const lineTotals = [...html.matchAll(/<tr><td>\d+<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><td>([^<]*)<\/td><\/tr>/g)].map((match) => ({ description: match[1], quantity: match[2], unitPrice: match[4], total: match[5] }))
    expect((await fixture.material()).persisted).toEqual(before.persisted)
    expect(lineTotals).toEqual([
      { description: "First separate line", quantity: "1", unitPrice: "40.00", total: "40.00" },
      { description: "Second separate line", quantity: "1", unitPrice: "60.00", total: "60.00" },
    ])
    expect(html).toContain('<tr><th colspan="5">Total agreed price (excl. VAT)</th><td>100.00</td></tr>')
  } finally { await fixture.close() }
})
