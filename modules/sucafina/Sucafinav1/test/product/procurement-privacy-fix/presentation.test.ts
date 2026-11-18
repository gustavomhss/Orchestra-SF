import { expect, test } from "bun:test"
import { domain, render } from "../../../runtime/procurement.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { procurementMonetaryFacts } from "../../../product/procurement/monetary.ts"
import { projectProcurementSource } from "../../../product/procurement/port.ts"
import { createProcurementQueueView } from "../../../product/procurement/queue-view.ts"
import { digestProcurementSource } from "../../../product/procurement/sources.ts"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, ProductContext } from "../../../product/contracts/context.ts"

const actor = { id: "presentation73-requester", canWrite: true, roles: ["requester"] }
const id = "PR-2026-0073"
const at = "2026-11-15T02:00:00Z"
const environment = { at, id: () => "presentation73-id", directory: [] }

// Synthetic records isolate presentation; no browser, authentication or financial-transition proof is claimed.
function snapshot(request: Record<string, unknown>): Snapshot {
  return {
    data: { store: {
      settings: initialProcurementSettings(), suppliers: [],
      requests: { [id]: { version: 7, by: actor.id, request: { number: id, createdBy: actor.id, history: [], ...request } } },
    } },
    versions: { [`requests:${id}`]: { version: 7, by: actor.id } },
    sequences: {}, audit: [], notices: [],
  }
}

function frozenSourcing(approved = 28000 * 1.08) {
  return snapshot({
    status: "src_pending",
    pr: { title: "Synthetic EUR sourcing", estAmount: 28000, recurring: false, expenseType: "OPEX" },
    sourcing: {
      selectedId: "quote73", approvalBaseCurrency: "USD", fxSnapshot: { USD: 1, EUR: 1.08 },
      approval: { amount: approved, steps: [{ holderId: "presentation73-holder", status: "pending", levelName: "Review" }] },
      quotes: [{ id: "quote73", supplier: "Synthetic supplier", currency: "EUR", total: 28000, qty: 1, unitPrice: 28000, techPass: true }],
    },
    po: { currency: "EUR", lines: [{ qty: 1, unitPrice: 28000 }], supplier: "Synthetic supplier" },
  })
}

function present(state: Snapshot) {
  const before = structuredClone(state)
  const view = domain.view(state, actor, environment)
  const record = rows(view.data.requests)[0]!
  const context: ProductContext = {
    installationId: "presentation73-installation", projectId: "presentation73-project", principalRef: actor.id,
    accessRevision: "presentation73-access", policyVersion: "presentation73-policy", surface: "procurement",
    period: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", sourceRefs: [], capabilities: [],
  }
  // Evidence/context identities and unused stock are fixtures, not authority grants. Row values come from the real C02 producer.
  const reference: Extract<BusinessEvidenceRef, { kind: "record" }> = {
    schema: "sf-evidence-v1", refId: "presentation73-reference", installationId: context.installationId,
    projectId: context.projectId, refDigest: "", evidenceLevel: "observed", kind: "record",
    target: {
      surface: "procurement", recordType: "procurement-request", recordId: id, incarnation: "presentation73-incarnation", version: 7,
      fields: ["status", "subject", "holder", "baseAmount", "monetaryState", "nextStep", "submittedAmount", "submittedCurrency", "originalAmount", "originalCurrency", "fxRate", "fxSource"],
      period: context.period, projectionDigest: digestProcurementSource(record, view.data.formSettings),
    },
  }
  const projection = projectProcurementSource(record, context, { ...reference, refDigest: digestSfEvidenceRef(reference) }, at, view.data.formSettings)
  const stock: DomainProjection = { context, version: 1, engineVersion: "procurement-v1", components: [], values: [], missing: [] }
  const queue = createProcurementQueueView({ queue: [projection], stock, aging: [] })
  if (!queue) throw new Error("Canonical C02 presentation was refused")
  const projectedBefore = structuredClone(projection)
  const renderContext = { actor, year: 2026, month: 11, at, versions: view.versions }
  const html = [
    render("Requests", view.data, renderContext),
    render("Requests", { ...view.data, procurementQueueView: queue }, renderContext),
  ]
  expect(html.every((page) => typeof page === "string" && page.includes(`data-request-money="${id}"`))).toBe(true)
  expect(html[1]).toContain('data-source-ref="presentation73-reference"')
  expect(html[1]).toContain('data-source-version="7"')
  expect(state).toEqual(before)
  expect(projection).toEqual(projectedBefore)
  if (record.value !== null && typeof record.value !== "number") throw new Error("Canonical Procurement base amount was not numeric or null")
  expect(queue.rows[0]?.baseAmount).toBe(record.value)
  return { html, record, projection, money: procurementMonetaryFacts(record, "USD", view.data.formSettings) }
}

test("M73 submitted FX remains canonical while fallback and C02 display clean base amounts after current FX changes", () => {
  const state = frozenSourcing()
  const submitted = structuredClone(object(object(object(state.data.store).requests)[id]).request)
  const first = present(state)
  expect(first.money.baseAmount).toBe(28000 * 1.08)
  expect(first.money.baseAmount).not.toBe(30240)
  for (const html of first.html) {
    expect(html).toContain("<td>30240 USD</td>")
    expect(html).toContain("Estimate value: 28000 EUR; base value: 30240 USD; FX: 1.08 (current).")
  }

  expect(domain.execute(state, { id: "presentation73-admin", canWrite: true, roles: ["admin"] }, {
    page: "Settings", action: "save", version: 0,
    values: { fxRates: rows(object(object(state.data.store).settings).fxRates).map((rate) => rate.code === "EUR" ? { ...rate, rate: 2 } : rate) },
  }, environment)).toEqual({ ok: true })
  const changed = present(state)
  expect(object(object(object(state.data.store).requests)[id]).request).toEqual(submitted)
  expect(state.versions[`requests:${id}`]?.version).toBe(7)
  expect(changed.money).toMatchObject({ original: 28000, currency: "EUR", validRate: 1.08, baseAmount: 28000 * 1.08, fxSource: "submitted" })
  expect(changed.projection.values.find((value) => value.id === "baseAmount")?.value).toBe(28000 * 1.08)
  expect(changed.projection.values.find((value) => value.id === "submittedAmount")?.value).toBe(28000 * 1.08)
  for (const html of changed.html) {
    expect(html).toContain("<td>30240 USD</td>")
    expect(html).toMatch(/data-request-summary="PR-2026-0073">[^<]*Version 7 · 30240 USD<\/p>/)
    expect(html).toContain("Current request value: 28000 EUR; base value: 30240 USD; FX: 1.08 (submitted).")
    expect(html).toContain("Estimate value: 28000 EUR; base value: 56000 USD; FX: 2 (current).")
    expect(html).toContain("Order value 56000 USD; approved sourcing value 30240 USD. Review the difference.")
    expect(html).not.toContain("30240.000000000004 USD")
  }
})

test("M73 the order difference formats both figures without changing its canonical tolerance or amounts", () => {
  const state = frozenSourcing(27000 * 1.08)
  const shown = present(state)
  expect(shown.money.baseAmount).toBe(28000 * 1.08)
  expect(shown.money.submittedAmount).toBe(27000 * 1.08)
  for (const html of shown.html) {
    expect(html).toContain("Order value 30240 USD; approved sourcing value 29160 USD. Review the difference.")
    expect(html).toContain("Estimate value: 28000 EUR; base value: 30240 USD; FX: 1.08 (current).")
  }
  for (const html of present(frozenSourcing(28000 * 1.08 - 0.004)).html)
    expect(html).not.toContain("Review the difference.</p>")
})

test.each([
  { label: "missing", estimate: undefined, amount: null, shown: "Unavailable" },
  { label: "null", estimate: null, amount: null, shown: "Unavailable" },
  { label: "zero", estimate: 0, amount: 0, shown: "0 USD" },
  { label: "fractional precision", estimate: 12.3456789, amount: 12.3456789, shown: "12.3456789 USD" },
])("M73 display preserves $label in the fallback and C02 paths", ({ estimate, amount, shown }) => {
  const state = snapshot({
    status: "draft", pr: { title: "Synthetic amount", ...(estimate === undefined ? {} : { estAmount: estimate }) },
    sourcing: null, po: null,
  })
  const output = present(state)
  expect(output.money.baseAmount).toBe(amount)
  expect(output.money.original).toBe(amount)
  expect(output.projection.values.find((value) => value.id === "baseAmount")).toMatchObject({ value: amount, evidenceState: amount === null ? "absent" : "estimated" })
  for (const html of output.html) {
    expect(html).toContain(`<td>${shown}</td>`)
    expect(html).toContain(`Current request value: ${shown}; base value: ${shown}; FX: 1 (base).`)
    expect(html).toContain(`Version 7 · ${amount === null ? "Value unavailable" : shown}</p>`)
  }
})
