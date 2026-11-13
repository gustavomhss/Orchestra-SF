import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { createSfBiFactory } from "../../../product/analytics/factory.ts"
import { createProcurementCollectionRegistry } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../product/integration/procurement-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { domain } from "../../../runtime/procurement.ts"
import { object, text } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { localBrowser } from "../../fixture/local-browser.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const requisition = {
  title: "WP05 real lifecycle",
  type: "service",
  description: "Synthetic service for scoped BI lifecycle proof",
  estAmount: 1000,
  costCenter: "IT",
  needBy: "2026-06-30",
  justification: "Exercise the actual domain state machine",
  recurring: false,
  expenseType: "OPEX",
}

async function procurementFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp05-stages-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const clock = { at: "2026-01-01T00:00:00Z" }
  const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, projectScope: projectSfProcurementScope, enumerate: enumerateSfSources })
  await persistence.initializeSources("procurement")
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = {
      requests: {},
      suppliers: [],
      settings: { ...initialProcurementSettings(), levels: [{ id: "L1", name: "Review", threshold: 0, holderId: "approver" }], blockSelfApproval: true },
    }
    return { commit: true, value: undefined }
  })
  const http = () => new Request("https://local.invalid/procurement", { headers: { authorization: "wp05-approver" } })
  const ui = createSfUiAuthority({
    authorize: async (request) => request.headers.get("authorization") === "wp05-approver" ? { installationId: "i", projectId: "p", principalRef: "approver", policyVersion: "1", accessRevision: "1" } : undefined,
    commandIdentity: async () => "command",
    createId: randomUUID,
    now: Date.now,
  })
  const authority: SfDomainValidation = {
    validateDomainContext: (context, operation, digest) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false),
    revalidateDomainContext: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
    receiptFor: (context, operation, digest, output) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined,
  }
  const host: DomainPortHost = {
    persistence,
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: authority.revalidateDomainContext,
    environment: async () => ({ at: clock.at, directory: [], id: randomUUID }),
    authenticate: async (request) => request.headers.get("authorization") === "wp05-approver" ? { id: "approver", canWrite: true, roles: [{ surface: "procurement", role: "approver" }] } : null,
  }
  const context = { installationId: "i", projectId: "p", principalRef: "approver", policyVersion: "1", accessRevision: "1", surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] }
  const registry = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: context }) })
  const port = createProcurementPort({ ...host, ...registry, resolveSupplierSource: async () => ({ status: "unavailable", reason: "unused" }), isCurrentSupplierSource: () => false, readContractSource: async () => ({ status: "unavailable", reason: "unused" }) })
  const factory = createSfBiFactory({ authority, procurement: { views: ["BI05", "BI06"], host: {
    list: (selection, binding) => port.list(selection, binding),
    revalidate: async (request, binding) => (await registry.resolveRequestCollection(request.selectionRef, binding)).status === "ok" && await authority.revalidateDomainContext(binding),
  } } })
  return {
    clock,
    persistence,
    async execute(role: "requester" | "buyer" | "approver", action: string, id: string | undefined, values: Record<string, unknown>, at: string) {
      clock.at = at
      const result = await persistence.transaction("procurement", async (snapshot) => {
        const result = domain.execute(snapshot, { id: role, roles: [role], canWrite: true, assigned: [], domains: [] }, {
          page: "Requests", action, ...(id ? { id } : {}), version: snapshot.versions["requests:" + (id ?? "")]?.version ?? 0, values,
        }, { at, id: randomUUID, directory: [] })
        return { commit: result.ok, value: result }
      })
      expect(result.ok).toBe(true)
      if (!result.ok) throw new Error("Real procurement command failed: " + action + ": " + JSON.stringify(result))
      return object(result.value)
    },
    async read(viewId: "BI05" | "BI06") {
      const bootstrap = { requestRef: "selection-bootstrap" }
      const issuer = await ui.admit(http(), "sf_request_read", digestSfValue(bootstrap))
      expect(issuer.status).toBe("ok")
      if (issuer.status !== "ok") throw new Error("UI admission refused")
      expect(await ui.validate(issuer.value, "sf_request_read", digestSfValue(bootstrap))).toBe(true)
      const selected = await registry.createSelection(issuer.value)
      expect(selected.status).toBe("ok")
      if (selected.status !== "ok") throw new Error("Real collection selection refused")
      const request = { viewId, selectionRef: selected.value, period }
      const admitted = await ui.admit(http(), "sf_bi_view", digestSfValue(request))
      expect(admitted.status).toBe("ok")
      if (admitted.status !== "ok") throw new Error("BI admission refused")
      const result = await factory.dispatchPresentation(request, admitted.value)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error("Real BI source refused: " + JSON.stringify(result))
      return result.value
    },
    async readRequest(requestRef: string) {
      const request = { requestRef }
      const admitted = await ui.admit(http(), "sf_request_read", digestSfValue(request))
      expect(admitted.status).toBe("ok")
      if (admitted.status !== "ok") throw new Error("Detail admission refused")
      expect(await ui.validate(admitted.value, "sf_request_read", digestSfValue(request))).toBe(true)
      const result = await port.read(request, admitted.value)
      expect(result.status).toBe("ok")
      if (result.status !== "ok") throw new Error("Real request detail refused: " + JSON.stringify(result))
      return result.value
    },
    async dispose() {
      await store.dispose()
      await rm(directory, { recursive: true, force: true })
    },
  }
}

test("real request commands traverse every open procurement stage without historical cohort counts", async () => {
  const fixture = await procurementFixture()
  try {
    const request = await fixture.execute("requester", "create", undefined, { pr: requisition }, "2026-01-01T00:00:00Z")
    const id = text(request.number)
    expect(id).toMatch(/^PR-2026-/)
    const observe = async (expected: string) => {
      const view = await fixture.read("BI05")
      expect(view.projection.values.map((value) => [value.id, value.value])).toEqual([["stock:" + expected, 1]])
      expect(view.presentation.series.map((series) => series.role)).toEqual(["stock"])
      expect(view.presentation.limitations.join(" ")).toContain("não representa coorte ou conversão")
      expect(view.projection.values[0]?.sourceRefs.map((reference) => reference.kind === "record" ? reference.target.recordId : undefined)).toEqual([id])
      expect(view.projection.values.some((value) => /conversion|cohort|rate/.test(value.id))).toBe(false)
    }
    await observe("draft")
    await fixture.execute("requester", "submit_pr", id, {}, "2026-01-02T00:00:00Z")
    await observe("pr_pending")
    await fixture.execute("approver", "reject", id, { reason: "Clarify service scope" }, "2026-01-03T00:00:00Z")
    await observe("pr_rejected")
    await fixture.execute("requester", "submit_pr", id, { pr: { justification: "Scope clarified" } }, "2026-01-04T00:00:00Z")
    await observe("pr_pending")
    await fixture.execute("approver", "approve", id, { comment: "PR checked" }, "2026-01-05T00:00:00Z")
    await observe("sourcing")

    const sourcing = {
      quotes: [
        { id: "quote-a", supplier: "Synthetic supplier A", supplierId: null, currency: "USD", total: 1000, qty: 1, unitPrice: 1000, techPass: true, scores: [5, 5, 5, 5, 5], cscores: [5, 5, 5] },
        { id: "quote-b", supplier: "Synthetic supplier B", supplierId: null, currency: "USD", total: 1100, qty: 1, unitPrice: 1100, techPass: true, scores: [5, 5, 5, 5, 5], cscores: [5, 5, 5] },
        { id: "quote-c", supplier: "Synthetic supplier C", supplierId: null, currency: "USD", total: 1200, qty: 1, unitPrice: 1200, techPass: true, scores: [5, 5, 5, 5, 5], cscores: [5, 5, 5] },
      ],
      evaluator: "evaluator",
      selectedId: "quote-a",
      selectionJustification: "Highest-ranked complete proposal",
      contractStrategy: "",
    }
    await fixture.execute("buyer", "submit_sourcing", id, { sourcing }, "2026-01-06T00:00:00Z")
    await observe("src_pending")
    await fixture.execute("approver", "reject", id, { reason: "Clarify delivery terms" }, "2026-01-07T00:00:00Z")
    await observe("src_rejected")
    await fixture.execute("buyer", "submit_sourcing", id, { sourcing }, "2026-01-08T00:00:00Z")
    await observe("src_pending")
    await fixture.execute("approver", "approve", id, { comment: "Sourcing checked" }, "2026-01-09T00:00:00Z")
    await observe("po_draft")

    const po = { description: "Synthetic approved service", paymentTerms: "Net 30", expenseType: "OPEX", currency: "USD", deliveryDate: "2026-06-30", deliveryConditions: "Provide the agreed service" }
    await fixture.execute("buyer", "submit_po", id, { po }, "2026-01-10T00:00:00Z")
    await observe("po_pending")
    await fixture.execute("approver", "reject", id, { reason: "Clarify acceptance" }, "2026-01-11T00:00:00Z")
    await observe("po_rejected")
    await fixture.execute("buyer", "submit_po", id, { po }, "2026-01-12T00:00:00Z")
    await observe("po_pending")
    await fixture.execute("approver", "approve", id, { comment: "PO checked" }, "2026-01-13T00:00:00Z")
    await observe("po_approved")
    const issued = await fixture.execute("buyer", "issue", id, {}, "2026-01-14T00:00:00Z")
    expect(issued.status).toBe("po_issued")
    expect((await fixture.read("BI05")).projection.values).toEqual([])
    expect(Array.isArray(issued.history)).toBe(true)
    const history = Array.isArray(issued.history) ? issued.history.map(object) : []
    expect(history.filter((entry) => entry.action === "Requisition submitted for approval")).toHaveLength(2)
    expect(history.filter((entry) => entry.action === "Sourcing submitted for approval")).toHaveLength(2)
    expect(history.filter((entry) => entry.action === "Purchase order submitted for approval")).toHaveLength(2)

    const cancel = await fixture.execute("requester", "create", undefined, { pr: requisition }, "2026-01-15T00:00:00Z")
    const cancelled = await fixture.execute("requester", "cancel", text(cancel.number), { reason: "No longer needed" }, "2026-01-16T00:00:00Z")
    expect(cancelled.status).toBe("cancelled")
    expect((await fixture.read("BI05")).projection.values).toEqual([])
  } finally {
    await fixture.dispose()
  }
}, 60000)

test("approver opens the oldest proven request while a missing age stays visible", async () => {
  const fixture = await procurementFixture()
  try {
    const older = await fixture.execute("requester", "create", undefined, { pr: requisition }, "2026-01-01T00:00:00Z")
    await fixture.execute("requester", "submit_pr", text(older.number), {}, "2026-01-01T00:00:00Z")
    const newer = await fixture.execute("requester", "create", undefined, { pr: requisition }, "2026-01-09T00:00:00Z")
    await fixture.execute("requester", "submit_pr", text(newer.number), {}, "2026-01-09T00:00:00Z")
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      const stored = object(snapshot.data.store)
      const requests = object(stored.requests)
      // A legacy persisted record has no entry event. The producer must retain that absence.
      requests["legacy-unknown"] = { version: 1, by: "requester", request: {
        number: "legacy-unknown", status: "pr_pending", createdBy: "requester", pr: requisition, sourcing: null, po: null, history: [],
        prApproval: { amount: 1000, fxRate: null, steps: [{ levelId: "L1", levelName: "Review", threshold: 0, holderId: "approver", status: "pending" }] },
      } }
      return { commit: true, value: undefined }
    })
    fixture.clock.at = "2026-01-11T00:00:00Z"
    const view = await fixture.read("BI06")
    const ages = view.projection.values.filter((value) => value.id.endsWith(":ageDays"))
    const ageFor = (id: string) => ages.find((value) => value.drilldown?.kind === "record" && value.drilldown.target.recordId === id)
    expect(ages).toHaveLength(3)
    expect(ageFor(text(older.number))).toMatchObject({ value: 10, evidenceState: "confirmed" })
    expect(ageFor(text(newer.number))).toMatchObject({ value: 2, evidenceState: "confirmed" })
    expect(ageFor("legacy-unknown")).toMatchObject({ value: null, evidenceState: "absent" })
    const known = ageFor(text(older.number))
    expect(known?.drilldown?.kind).toBe("record")
    if (!known?.drilldown) throw new Error("Oldest request lacks its actual source reference")

    const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
    if (!built.success || !built.outputs[0]) throw new Error("Analytics browser bundle failed")
    const url = "data:text/javascript;base64," + Buffer.from(await built.outputs[0].text()).toString("base64")
    const browser = await localBrowser()
    try {
      const page = await browser.browser.newPage()
      await page.goto("about:blank")
      await page.evaluate(async (input) => {
        const module = await import(input.url)
        document.body.append(module.renderBiView(input.view.request, input.view.projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, input.view.presentation))
      }, { url, view })
      expect(await page.locator('svg [data-bi-series="aging"]').count()).toBe(2)
      expect(await page.locator("body").textContent()).toContain("Idade indisponível: 1 de 3 pedidos nesta seleção.")
      for (const value of ages) {
        const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: value.id, exact: true }) })
        expect(await row.getByRole("cell").nth(1).textContent()).toBe(value.value === null ? "Indisponível" : String(value.value))
      }
      const mark = page.locator('svg [data-bi-focus="' + known.id + '"]')
      expect(await mark.getAttribute("aria-label")).toContain(": 10 Review · days")
      await mark.click()
      const selection = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
      expect(selection.reference).toEqual(known.drilldown)
      expect(selection.context.principalRef).toBe("approver")
      const detail = await fixture.readRequest(selection.reference.refId)
      expect(detail.values.find((value) => value.id === "ageDays")).toMatchObject({ value: 10, evidenceState: "confirmed" })
      expect(detail.values.find((value) => value.id === "holder")?.value).toBe("approver")
      expect(detail.values.find((value) => value.id === "status")?.value).toBe("pr_pending")
      expect(detail.values.every((value) => value.drilldown?.kind === "record" && value.drilldown.target.recordId === older.number)).toBe(true)
      const missing = page.getByRole("list", { name: "Pedidos com idade indisponível" })
      expect(await missing.getByRole("listitem").count()).toBe(1)
      expect(await missing.textContent()).toContain("legacy-unknown: idade indisponível")
    } finally {
      await browser.dispose()
    }
  } finally {
    await fixture.dispose()
  }
}, 180000)

