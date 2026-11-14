import { expect, test } from "bun:test"
import { rows } from "../../../../runtime/contract.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import { procurementMonetaryFacts } from "../../../../product/procurement/monetary.ts"
import { buyer, holder, moneyFields, sourcingMoneyFixture } from "./fixture.ts"

function values(projection: DomainProjection) {
  return Object.fromEntries(projection.values.filter((value) => moneyFields.includes(value.id)).map((value) => [value.id, value.value]))
}

function sameMoney(read: Awaited<ReturnType<Awaited<ReturnType<typeof sourcingMoneyFixture>>["read"]>>, projection: DomainProjection) {
  expect(values(read.projection)).toEqual(values(projection))
  for (const field of moneyFields) {
    const c02 = read.projection.values.find((value) => value.id === field)!
    const c06 = projection.values.find((value) => value.id === field)!
    expect({ currency: c02.currency, state: c02.evidenceState }).toEqual({ currency: c06.currency, state: c06.evidenceState })
  }
  expect(read.queue.rows[0]?.baseAmount).toBe(values(read.projection).baseAmount)
  expect(read.comparison.requestVersion).toBe(read.projection.version)
  expect(read.comparison.sourceRefs).toEqual(read.projection.values.find((value) => value.id === "baseAmount")!.sourceRefs)
}

test("OPS-REV-01: real select_quote -> submit_sourcing freezes USD108 across C02, C06, detail and summary despite the future PO", async () => {
  const fixture = await sourcingMoneyFixture()
  try {
    const selected = await fixture.material()
    expect(selected.record).toMatchObject({ status: "sourcing", po: { currency: "EUR", lines: [{ qty: 1, unitPrice: 100 }], fxRate: null, approval: null } })
    expect(rows(selected.record.history).some((entry) => String(entry.action).includes("PO proposal generated"))).toBe(true)
    await fixture.run(buyer, "submit_sourcing")
    const before = await fixture.read()
    expect(before.record).toMatchObject({ status: "src_pending", sourcing: { approval: { amount: 108 }, approvalBaseCurrency: "USD", fxSnapshot: { EUR: 1.08 } }, po: { fxRate: null, approval: null } })
    const confirmed = await fixture.confirmation()
    sameMoney(before, confirmed.observation.projection)
    expect(values(before.projection)).toEqual({ baseAmount: 108, originalAmount: 100, originalCurrency: "EUR", fxRate: 1.08, fxSource: "submitted", monetaryState: "pending-approval", submittedAmount: 108, submittedCurrency: "USD", submittedFxRate: 1.08 })

    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }] })
    const after = await fixture.read()
    const observed = await fixture.observer.observe(confirmed.scope, fixture.binding)
    if (observed.state !== "available") throw new Error(`C06 after FX update: ${observed.state}`)
    sameMoney(after, observed.projection)
    expect(values(after.projection)).toEqual(values(before.projection))
    expect(observed.scopeFingerprint).toBe(confirmed.observation.scopeFingerprint)
    expect(observed.sourceFingerprint).toBe(confirmed.observation.sourceFingerprint)
    expect(observed.dependencyFingerprint).toBe(confirmed.observation.dependencyFingerprint)
    expect(after.persisted).toEqual(before.persisted)
    expect(after.comparison.proposals.find((proposal) => proposal.proposalRef === "EUR-100")).toMatchObject({ convertedAmount: 108, money: { originalAmount: 100, originalCurrency: "EUR", baseCurrency: "USD", fxRate: 1.08, fxSource: "submitted" } })
    expect(after.comparison.ranking).toEqual(before.comparison.ranking)
    expect(after.comparison.weights).toEqual(before.comparison.weights)
    expect(after.html.match(/<p data-request-summary="[^"]+">([^<]+)<\/p>/)?.[1]).toContain("108 USD")
    expect(after.html).toContain("base value: 108 USD; FX: 1.08 (submitted)")
    expect(after.html).toContain("108 USD (submitted FX: 1.08)")
    expect(after.approvals).toContain("108 USD")
    const table = after.html.match(/<table[\s\S]*?<\/table>/)?.[0]
    expect(table).toContain("108 USD")
    expect(table).not.toContain("200 USD")
    console.info("sourcing-money:pending", JSON.stringify({ rawLegacyValue: after.record.value, c02: values(after.projection), c06: values(observed.projection), comparison: after.comparison.proposals.find((proposal) => proposal.proposalRef === "EUR-100")?.convertedAmount, sameFingerprint: observed.scopeFingerprint === confirmed.observation.scopeFingerprint }))
    expect(procurementMonetaryFacts(after.record, "USD", after.view.data.formSettings).baseAmount).toBe(108)
    fixture.access.allowed = false
    expect((await fixture.observer.observe(confirmed.scope, fixture.binding)).state).toBe("access-unavailable")
  } finally { await fixture.close() }
})

test("a genuinely submitted PO owns its later USD200 approval while historical sourcing stays USD108", async () => {
  const fixture = await sourcingMoneyFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }] })
    await fixture.run(holder, "approve")
    expect((await fixture.material()).record.status).toBe("po_draft")
    await fixture.run(buyer, "submit_po", { po: { description: "Agreed service", paymentTerms: "Net 30", deliveryDate: "2026-12-01", deliveryConditions: "Service delivery", expenseType: "OPEX" } })
    const before = await fixture.read()
    expect(before.record).toMatchObject({ status: "po_pending", po: { approval: { amount: 200 }, approvalBaseCurrency: "USD", fxRate: 2 } })
    const confirmed = await fixture.confirmation()
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 3 }] })
    const after = await fixture.read()
    const observed = await fixture.observer.observe(confirmed.scope, fixture.binding)
    if (observed.state !== "available") throw new Error(`PO C06 unavailable: ${observed.state}`)
    sameMoney(after, observed.projection)
    expect(values(after.projection)).toMatchObject({ baseAmount: 200, originalAmount: 100, fxRate: 2, fxSource: "submitted", submittedAmount: 200, submittedCurrency: "USD", submittedFxRate: 2, monetaryState: "pending-approval" })
    expect(observed.scopeFingerprint).toBe(confirmed.observation.scopeFingerprint)
    expect(after.persisted).toEqual(before.persisted)
    expect(after.comparison.proposals.find((proposal) => proposal.proposalRef === "EUR-100")?.convertedAmount).toBe(108)
    expect(after.html.match(/<p data-request-summary="[^"]+">([^<]+)<\/p>/)?.[1]).toContain("200 USD")
    expect(after.html).toContain("Pending approval value: 100 EUR; base value: 200 USD; FX: 2 (submitted)")
    expect(after.approvals).toContain("200 USD")
  } finally { await fixture.close() }
})

test("missing live FX after real selection remains absent and refuses submission without inventing zero", async () => {
  const fixture = await sourcingMoneyFixture()
  try {
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }] })
    const read = await fixture.read()
    const confirmed = await fixture.confirmation()
    sameMoney(read, confirmed.observation.projection)
    expect(read.record).toMatchObject({ status: "sourcing", po: { fxRate: null, approval: null } })
    expect(values(read.projection)).toEqual({ baseAmount: null, originalAmount: 100, originalCurrency: "EUR", fxRate: null, fxSource: null, monetaryState: "estimate", submittedAmount: null, submittedCurrency: null, submittedFxRate: null })
    expect(read.projection.values.find((value) => value.id === "baseAmount")?.evidenceState).toBe("absent")
    expect(read.projection.missing).toContainEqual({ field: "fxRate", reason: "missing-fx" })
    expect(read.comparison.proposals.find((proposal) => proposal.proposalRef === "EUR-100")?.convertedAmount).toBeNull()
    expect(read.comparison.ranking).toEqual([])
    expect(read.html.match(/<p data-request-summary="[^"]+">([^<]+)<\/p>/)?.[1]).toContain("Value unavailable")
    expect(read.html).toContain("base value: Unavailable; FX: Unavailable")
    const rejected = await fixture.execute(buyer, "submit_sourcing")
    expect(rejected).toMatchObject({ ok: false, status: 422 })
    if (rejected.ok) throw new Error("Missing FX submission was accepted")
    expect(rejected.errors?.some((error) => error.includes("no FX rate defined for EUR"))).toBe(true)
    expect((await fixture.material()).persisted).toEqual(read.persisted)
  } finally { await fixture.close() }
})

test("a changed base currency preserves submitted USD provenance and makes the current comparison unavailable", async () => {
  const fixture = await sourcingMoneyFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    const before = await fixture.read()
    const confirmed = await fixture.confirmation()
    await fixture.settings({ currency: "GBP", fxRates: [{ code: "GBP", rate: 1 }, { code: "EUR", rate: 2 }, { code: "USD", rate: 0.8 }] })
    const after = await fixture.read()
    const observed = await fixture.observer.observe(confirmed.scope, fixture.binding)
    if (observed.state !== "available") throw new Error(`Changed-base C06 unavailable: ${observed.state}`)
    sameMoney(after, observed.projection)
    expect(after.projection.context.currency).toBe("GBP")
    expect(values(after.projection)).toEqual({ baseAmount: null, originalAmount: 100, originalCurrency: "EUR", fxRate: null, fxSource: null, monetaryState: "pending-approval", submittedAmount: 108, submittedCurrency: "USD", submittedFxRate: 1.08 })
    expect(after.projection.values.find((value) => value.id === "submittedAmount")?.currency).toBe("USD")
    expect(after.projection.values.find((value) => value.id === "baseAmount")?.evidenceState).toBe("absent")
    expect(observed.scopeFingerprint).not.toBe(confirmed.observation.scopeFingerprint)
    expect(after.persisted).toEqual(before.persisted)
    const proposal = after.comparison.proposals.find((item) => item.proposalRef === "EUR-100")!
    expect(proposal.convertedAmount).toBeNull()
    expect(proposal.issues).toContain("Submitted base currency unavailable or changed")
    expect(after.html.match(/<p data-request-summary="[^"]+">([^<]+)<\/p>/)?.[1]).toContain("Value unavailable")
    expect(after.html).toContain("base value: Unavailable; FX: Unavailable")
    expect(after.html).not.toContain("108 GBP")
  } finally { await fixture.close() }
})

test("a legally rejected sourcing decision does not fall back to the retained future PO or live FX", async () => {
  const fixture = await sourcingMoneyFixture()
  try {
    await fixture.run(buyer, "submit_sourcing")
    await fixture.settings({ fxRates: [{ code: "USD", rate: 1 }, { code: "EUR", rate: 2 }] })
    await fixture.run(holder, "reject", { reason: "Reassess the selected proposal" })
    const read = await fixture.read()
    const confirmed = await fixture.confirmation()
    sameMoney(read, confirmed.observation.projection)
    expect(read.record).toMatchObject({ status: "src_rejected", sourcing: { fxSnapshot: null, approval: { amount: 108 } }, po: { fxRate: null, approval: null } })
    expect(values(read.projection)).toMatchObject({ baseAmount: null, originalAmount: 100, fxRate: null, submittedAmount: 108, submittedCurrency: "USD", submittedFxRate: null })
    expect(read.comparison.proposals.find((proposal) => proposal.proposalRef === "EUR-100")?.convertedAmount).toBeNull()
    expect(read.html.match(/<p data-request-summary="[^"]+">([^<]+)<\/p>/)?.[1]).toContain("Value unavailable")
  } finally { await fixture.close() }
})
