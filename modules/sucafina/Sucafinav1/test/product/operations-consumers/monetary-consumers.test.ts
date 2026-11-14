import { expect, test } from "bun:test"
import { domain, render } from "../../../runtime/procurement.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { buyer, consumerFixture, environment, holder } from "./fixture.ts"

type Fixture = Awaited<ReturnType<typeof consumerFixture>>

test("submitted sourcing reconciles domain, unmounted Requests, C02/C06 and register while its future PO remains distinct", async () => {
  const fixture = await consumerFixture()
  try {
    const selected = await fixture.material()
    expect(selected.record).toMatchObject({ status: "sourcing", value: 108, po: { currency: "EUR", lines: [{ qty: 1, unitPrice: 100 }] } })
    await fixture.run(buyer, "submit_sourcing")
    const submitted = await fixture.material()
    expect(submitted.record).toMatchObject({ status: "src_pending", sourcing: { approval: { amount: 108 }, approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 } } })
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })

    const current = await unmounted(fixture)
    expect(current.record).toMatchObject({ status: "src_pending", value: 108 })
    expect(rows(current.view.data.register)[0]?.value).toBe(108)
    expect(current.table).toContain("<td>pending approval</td><td>108 USD</td>")
    expect(current.table).not.toContain("200 USD")
    expect(current.summary).toContain("108 USD")
    expect(current.summary).not.toContain("200 USD")
    expect(current.requestMoney).toContain("Current request value: 100 EUR; base value: 108 USD; FX: 1.08 (submitted)")
    expect(current.po).toContain("Estimate value: 100 EUR; base value: 200 USD; FX: 2 (current)")
    expect(current.po).toContain("Order value 200 USD; approved sourcing value 108 USD. Review the difference.")

    const connected = await fixture.read()
    expect(connected.projection.values.find((field) => field.id === "baseAmount")?.value).toBe(108)
    expect(connected.queue.rows.find((row) => row.id === fixture.target.id)).toMatchObject({ baseAmount: 108, monetaryState: "pending-approval" })
    const confirmation = await fixture.confirmation()
    expect(confirmation.observation.projection.values.find((field) => field.id === "baseAmount")?.value).toBe(108)
    expect(confirmation.observation.projection.values.find((field) => field.id === "submittedFxRate")?.value).toBe(1.08)
    expect((await fixture.material()).persisted).toEqual(submitted.persisted)
  } finally { await fixture.close() }
})

test("a submitted PO freezes 200 USD through later FX, exports and cancellation", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.run(holder, "approve")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    await fixture.run(buyer, "submit_po", { po: { description: "Agreed service", paymentTerms: "Net 30", deliveryDate: "2026-12-01", deliveryConditions: "Service delivery", expenseType: "OPEX" } })
    const submitted = await fixture.material()
    expect(submitted.record).toMatchObject({ status: "po_pending", value: 200, po: { approval: { amount: 200 }, approvalBaseCurrency: "USD", fxRate: 2 } })
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 3 }] })

    const current = await unmounted(fixture)
    expect(current.record.value).toBe(200)
    expect(rows(current.view.data.register)[0]?.value).toBe(200)
    expect(current.table).toContain("<td>pending approval</td><td>200 USD</td>")
    expect(current.summary).toContain("200 USD")
    expect(current.requestMoney).toContain("base value: 200 USD; FX: 2 (submitted)")
    expect(current.po).toContain("Pending approval value: 100 EUR; base value: 200 USD; FX: 2 (submitted)")
    expect(current.po).toContain("Order value 200 USD; approved sourcing value 108 USD.")
    const register = csvRecord(await exportText(fixture, "register"))
    expect(register).toMatchObject({ Status: "po_pending", "PO total": "100", "PO total (base)": "200", "PO base currency": "USD", "PO FX rate": "2", "PO FX source": "submitted", "PO monetary state": "pending-approval", "PO submitted amount": "200", "PO submitted currency": "USD", "PO submitted FX rate": "2" })
    const document = await exportText(fixture, "po")
    expect(document).toContain("Status: po_pending")
    expect(document).toContain("Monetary state: pending-approval. Current base amount: 200.00 USD. FX: 2 (submitted). Submitted approval: 200.00 USD; submitted FX: 2.")
    expect(document).not.toContain("300.00 USD")
    expect((await fixture.material()).persisted).toEqual(submitted.persisted)

    await fixture.run(fixture.requester, "cancel", { reason: "The order is no longer needed" })
    const cancelled = await unmounted(fixture)
    expect(cancelled.record).toMatchObject({ status: "cancelled", value: 200 })
    expect(cancelled.record.po).toEqual(object(submitted.persisted).po)
    expect(cancelled.table).toContain("<td>cancelled</td><td>200 USD</td>")
    expect(cancelled.po).toContain("Cancelled value: 100 EUR; base value: 200 USD; FX: 2 (submitted)")
    expect(cancelled.metrics.match(/No matching purchase orders/g)).toHaveLength(4)
    expect(cancelled.metrics).not.toContain("200 USD")
    expect(csvRecord(await exportText(fixture, "register"))).toMatchObject({ Status: "cancelled", "PO total (base)": "200", "PO monetary state": "cancelled", "PO submitted amount": "200" })
    expect(await exportText(fixture, "po")).toContain("Monetary state: cancelled. Current base amount: 200.00 USD.")
  } finally { await fixture.close() }
})

test("missing live FX stays unavailable in unmounted consumers and refuses sourcing submission", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }] })
    const before = await fixture.material()
    const current = await unmounted(fixture)
    expect(current.record).toMatchObject({ status: "sourcing", value: null })
    expect(rows(current.view.data.register)[0]?.value).toBeNull()
    expect(current.table).toContain("<td>estimate</td><td>Unavailable</td>")
    expect(current.summary).toContain("Value unavailable")
    expect(current.requestMoney).toContain("Current request value: 100 EUR; base value: Unavailable; FX: Unavailable")
    expect(current.po).toContain("Estimate value: 100 EUR; base value: Unavailable; FX: Unavailable")
    expect(current.table).not.toContain("0 USD")
    expect(await fixture.execute(buyer, "submit_sourcing")).toMatchObject({ ok: false, status: 422 })
    expect((await fixture.material()).persisted).toEqual(before.persisted)
  } finally { await fixture.close() }
})

test("missing historical sourcing FX never borrows the future PO rate in pending or rejected request consumers", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    for (const status of ["src_pending", "src_rejected"]) {
      if (status === "src_rejected") await fixture.run(holder, "reject", { reason: "Review the sourcing evidence" })
      const persisted = await fixture.material()
      expect(persisted.record.status).toBe(status)
      // A damaged historical snapshot is a read premise only; the durable request is not rewritten.
      const current = await unmounted(fixture, (snapshot) => {
        const request = object(object(object(object(snapshot.data.store).requests)[fixture.target.id]).request)
        delete object(request.sourcing).fxSnapshot
      })
      expect(current.record).toMatchObject({ status, value: null })
      expect(rows(current.view.data.register)[0]?.value).toBeNull()
      expect(current.table).toContain("<td>Unavailable</td>")
      expect(current.table).not.toContain("200 USD")
      expect(current.summary).toContain("Value unavailable")
      expect(current.requestMoney).toContain("base value: Unavailable; FX: Unavailable")
      expect(current.po).toContain("Estimate value: 100 EUR; base value: 200 USD; FX: 2 (current)")
      expect((await fixture.material()).persisted).toEqual(persisted.persisted)
    }
  } finally { await fixture.close() }
})

test("changing the base withholds current request value and keeps the submitted 108 USD history", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    const submitted = await fixture.material()
    await fixture.settings({ currency: "EUR", fxRates: [{ code: "USD", rate: 0.9 }] })
    const current = await unmounted(fixture)
    expect(current.record).toMatchObject({ status: "src_pending", value: null, sourcing: { approvalBaseCurrency: "USD", approval: { amount: 108 }, fxSnapshot: { EUR: 1.08 } } })
    expect(rows(current.view.data.register)[0]?.value).toBeNull()
    expect(current.table).toContain("<td>pending approval</td><td>Unavailable</td>")
    expect(current.summary).toContain("Value unavailable")
    expect(current.requestMoney).toContain("base value: Unavailable; FX: Unavailable")
    expect(current.po).toContain("Order and approved sourcing values cannot be compared because the submitted base currency is missing or changed.")
    expect(current.approvals).toContain("108 USD")
    expect(current.approvals).not.toContain("108 EUR")
    expect((await fixture.material()).persisted).toEqual(submitted.persisted)
  } finally { await fixture.close() }
})

test("cancelling directly from sourcing preserves the inherited PO value and labels it cancelled", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    await fixture.run(fixture.requester, "cancel", { reason: "Stop this purchase" })
    const cancelled = await unmounted(fixture)
    expect(cancelled.record).toMatchObject({ status: "cancelled", value: 200, sourcing: { approvalBaseCurrency: "USD", approval: { amount: 108 } } })
    expect(object(object(cancelled.record.po).approval).amount).toBeUndefined()
    expect(rows(cancelled.view.data.register)[0]?.value).toBe(200)
    expect(cancelled.table).toContain("<td>cancelled</td><td>200 USD</td>")
    expect(cancelled.summary).toContain("200 USD")
    expect(cancelled.requestMoney).toContain("base value: 200 USD; FX: 2 (current)")
    expect(cancelled.po).toContain("Cancelled value: 100 EUR; base value: 200 USD; FX: 2 (current)")
    expect(cancelled.metrics.match(/No matching purchase orders/g)).toHaveLength(4)
    expect(cancelled.metrics).not.toContain("200 USD")
  } finally { await fixture.close() }
})

test("an incidental PO with missing or malformed lines cannot borrow a sourcing amount for PO-only text", async () => {
  const fixture = await consumerFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "EUR", rate: 2 }] })
    const before = await fixture.material()
    for (const lines of [[], [null]]) {
      const current = await unmounted(fixture, (snapshot) => {
        const request = object(object(object(object(snapshot.data.store).requests)[fixture.target.id]).request)
        object(request.po).lines = lines
      })
      expect(current.record.value).toBe(108)
      expect(current.summary).toContain("108 USD")
      expect(current.po).toContain("Estimate value: Unavailable; base value: Unavailable; FX: Unavailable")
      expect(current.po).toContain("Order and approved sourcing values cannot be compared because an amount or applicable FX is unavailable.")
      expect(current.po).not.toContain("Order value 0 USD")
      expect(current.po).not.toContain("Order value 108 USD")
    }
    expect((await fixture.material()).persisted).toEqual(before.persisted)
  } finally { await fixture.close() }
})

test("missing monetary inputs stay unavailable in quote choices and the PO document while actual zero stays zero", async () => {
  const fixture = await consumerFixture()
  try {
    const persisted = await fixture.material()
    for (const total of [undefined, Number.NaN]) {
      const current = await unmounted(fixture, (snapshot) => {
        const request = object(object(object(object(snapshot.data.store).requests)[fixture.target.id]).request)
        rows(object(request.sourcing).quotes)[0]!.total = total
        object(request.po).lines = [{ description: "Absent inputs", qty: null, unitPrice: Number.NaN }, { description: "Observed zero", qty: 0, unitPrice: 0 }]
      })
      expect(current.html).toContain('value="EUR-100" selected>European supplier · EUR Unavailable</option>')
      const document = current.html.match(/<article class="po-document">[\s\S]*?<\/article>/)?.[0]
      expect(document).toContain("<td>Absent inputs</td><td>Unavailable</td><td>Unavailable</td>")
      expect(document).toContain("<td>Observed zero</td><td>0</td><td>0</td>")
    }
    const zero = await unmounted(fixture, (snapshot) => {
      const request = object(object(object(object(snapshot.data.store).requests)[fixture.target.id]).request)
      rows(object(request.sourcing).quotes)[0]!.total = 0
    })
    expect(zero.html).toContain('value="EUR-100" selected>European supplier · EUR 0</option>')
    expect((await fixture.material()).persisted).toEqual(persisted.persisted)
  } finally { await fixture.close() }
})

async function unmounted(fixture: Fixture, premise?: (snapshot: Snapshot) => void) {
  return fixture.persistence.transaction("procurement", async (saved) => {
    const snapshot = structuredClone(saved)
    premise?.(snapshot)
    const before = structuredClone(snapshot)
    const view = domain.view(snapshot, buyer, environment)
    expect(view.data).not.toHaveProperty("procurementQueueView")
    const data = { ...view.data, filter: "All" }
    const context = { actor: buyer, year: 2026, month: 11, at: environment.at, versions: view.versions }
    const html = render("Requests", data, context)
    const dashboard = render("Dashboard", data, context)
    const approvals = render("My approvals", data, { ...context, actor: holder })
    if (!html || !dashboard || !approvals) throw new Error("Consumer rendering unavailable")
    const record = rows(view.data.requests).find((request) => request.number === fixture.target.id)
    if (!record) throw new Error("Consumer request unavailable")
    const summary = html.match(/<p data-request-summary="[^"]+">[^<]*<\/p>/)?.[0]
    const requestMoney = html.match(/<p data-request-money="[^"]+">[^<]*<\/p>/)?.[0]
    if (!summary || !requestMoney) throw new Error("Current request monetary summary unavailable")
    const poStart = html.indexOf(`<section id="${fixture.target.id}-po">`)
    if (poStart < 0) throw new Error("Purchase order section unavailable")
    expect(snapshot).toEqual(before)
    return { commit: false, value: { view, record, html, approvals, summary, requestMoney,
      table: html.slice(0, html.indexOf("<details")), po: html.slice(poStart, html.indexOf("</section>", poStart)),
      metrics: dashboard.slice(0, dashboard.indexOf("<table")) } }
  })
}

async function exportText(fixture: Fixture, kind: string) {
  const result = await fixture.export(kind)
  expect(result.ok).toBe(true)
  if (!result.ok) throw new Error(`Actual ${kind} download failed`)
  return new TextDecoder().decode(result.bytes)
}

function csvRecord(csv: string) {
  const records = csv.split("\r\n").map((row) => [...row.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((cell) => cell[1]!.replaceAll('""', '"')))
  expect(records).toHaveLength(2)
  expect(records[1]).toHaveLength(records[0]!.length)
  return Object.fromEntries(records[0]!.map((column, index) => [column, records[1]![index]]))
}
