// Setup adapted from sourcing-money@a3b7fb9b45d7852a3000e01098336a1aca9526c3; consumer assertions are separate.
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { domain, render } from "../../../runtime/procurement.ts"
import { object, rows, text } from "../../../runtime/contract.ts"
import { download } from "../../../runtime/downloads.ts"
import type { Actor } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectProcurementScope } from "../../../product/procurement/source-projection.ts"
import { createProcurementCollectionRegistry, createProcurementSourceResolver } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createProcurementConfirmationObserver } from "../../../product/procurement/confirmation.ts"
import { createProcurementQueueView } from "../../../product/procurement/queue-view.ts"

export const buyer = { id: "buyer", roles: ["buyer"], canWrite: true }
export const holder = { id: "holder", roles: ["approver"], canWrite: true }
export const admin = { id: "settings-admin", roles: ["admin"], canWrite: true }
export const moneyFields = ["baseAmount", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "submittedAmount", "submittedCurrency", "submittedFxRate"].sort()
const period = { start: "2026-01-01", end: "2026-12-31" }
const at = "2026-11-14T12:00:00Z"
export const environment = { at, directory: [{ id: "holder", name: "Assigned holder" }], id: randomUUID }

/** Real domain commands and durable source lifecycle; no hand-built approval or future PO. */
export async function consumerFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-sourcing-money-"))
  const store = await openLocalStore(directory)
  const persistence = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: projectProcurementScope, createId: randomUUID })
  await persistence.initializeSources("procurement")
  const target = { id: "" }
  const execute = async (actor: Actor, action: string, values: Record<string, unknown> = {}, page = "Requests") => {
    const result = await persistence.transaction("procurement", async (snapshot) => {
      const key = page === "Settings" ? "settings" : `requests:${action === "create" ? "" : target.id}`
      const value = domain.execute(snapshot, actor, { page, action, id: action === "create" ? undefined : target.id, version: snapshot.versions[key]?.version ?? 0, values }, environment)
      return { commit: value.ok, value }
    })
    if (result.ok && page === "Requests" && action === "create") target.id = text(object(result.value).number)
    return result
  }
  const run = async (actor: Actor, action: string, values: Record<string, unknown> = {}, page = "Requests") => {
    const result = await execute(actor, action, values, page)
    if (!result.ok) throw new Error(`${page}/${action}: ${JSON.stringify(result)}`)
    return result
  }
  await run(admin, "reset", {}, "Settings")
  const initial = initialProcurementSettings()
  await run(admin, "save", { settings: { levels: initial.levels.map((level) => ({ ...level, holderId: "holder" })) } }, "Settings")
  const requester = { id: "requester", roles: ["requester"], canWrite: true }
  await run(requester, "create", { pr: { title: "Sourcing snapshot regression", type: "service", description: "A real sourcing decision", estAmount: 100, costCenter: "IT", needBy: "2026-12-01", justification: "Compare the same submitted record", recurring: false, expenseType: "OPEX" } })
  await run(requester, "submit_pr")
  await run(holder, "approve")
  await run(buyer, "save", { sourcing: {
    evaluator: "Technical evaluator", selectionJustification: "Recorded selection",
    quotes: [
      { id: "EUR-100", supplier: "European supplier", currency: "EUR", total: 100, qty: 1, unitPrice: 100, techPass: true, scores: [5, 5, 5, 5, 5], cscores: [null, 5, 5] },
      { id: "USD-150", supplier: "US supplier", currency: "USD", total: 150, qty: 1, unitPrice: 150, techPass: true, scores: [4, 4, 4, 4, 4], cscores: [null, 4, 4] },
      { id: "USD-180", supplier: "Third supplier", currency: "USD", total: 180, qty: 1, unitPrice: 180, techPass: true, scores: [3, 3, 3, 3, 3], cscores: [null, 3, 3] },
    ],
  } })
  await run(buyer, "select_quote", { quoteId: "EUR-100" })
  const material = () => persistence.transaction("procurement", async (snapshot) => {
    const view = domain.view(snapshot, buyer, environment)
    const record = rows(view.data.requests).find((request) => request.number === target.id)
    if (!record) throw new Error("Real request unavailable")
    return { commit: false, value: { view, record, persisted: structuredClone(object(object(object(snapshot.data.store).requests)[target.id]).request) } }
  })
  const access = { allowed: true }
  const authorized = (request: Request) => access.allowed && request.headers.get("authorization") === "Bearer sourcing-money"
  const ui = createSfUiAuthority({
    authorize: async (request) => authorized(request) ? { installationId: "i", projectId: "p", principalRef: buyer.id, accessRevision: "1", policyVersion: "1" } : undefined,
    commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now,
  })
  const request = new Request("https://local.invalid/procurement", { headers: { authorization: "Bearer sourcing-money" } })
  const intent = digestSfValue({ requestRef: "sourcing-money" })
  const admission = await ui.admit(request, "sf_request_read", intent)
  if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_request_read", intent)) throw new Error("UI source admission failed")
  const binding = admission.value
  const host: DomainPortHost = {
    persistence,
    requestFor: (call) => call.kind === "ui" ? ui.requestFor(call) : undefined,
    revalidate: (call) => call.kind === "ui" ? ui.revalidate(call) : Promise.resolve(false),
    environment: async () => environment,
    authenticate: async (call) => authorized(call) ? { id: buyer.id, canWrite: true, roles: [{ surface: "procurement", role: "buyer" }] } : null,
  }
  const contextFor = async (call: TrustedDomainContext) => ({
    status: "ok" as const,
    value: { installationId: call.binding.installationId, projectId: call.binding.projectId, principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
      surface: "procurement" as const, period, currency: text(object((await material()).view.data.formSettings).currency), sourceRefs: [], capabilities: [] },
  })
  const sources = createProcurementSourceResolver({ host, scopedSources: persistence, contextFor })
  const collection = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor })
  const unavailable = async () => ({ status: "unavailable" as const, reason: "outside-sourcing-money-scope" })
  const port = createProcurementPort({ ...host, resolveRequestSource: sources.resolve, isCurrentRequestSource: (snapshot, evidence) => sources.isCurrent(snapshot, evidence) || collection.isCurrentRequestSource(snapshot, evidence), resolveSupplierSource: sources.resolve, isCurrentSupplierSource: sources.isCurrent, resolveRequestCollection: collection.resolveRequestCollection, isCurrentRequestCollection: collection.isCurrentRequestCollection, readContractSource: unavailable })
  const observer = createProcurementConfirmationObserver({ host, scopedSources: persistence, contextFor })
  const confirmation = async () => {
    const issued = await observer.issue(target.id, moneyFields, period, binding)
    if (issued.status !== "ok") throw new Error(`C06 issue: ${issued.reason}`)
    const scope: ConfirmationScope = { sourceRef: { surface: "procurement", type: "procurement-request", id: target.id, incarnation: issued.value.evidence.target.incarnation }, fields: moneyFields, period, materialDependencies: [], scopeDefinitionVersion: "procurement-c06-v1" }
    const observation = await observer.observe(scope, binding)
    if (observation.state !== "available") throw new Error(`C06 observe: ${observation.state}`)
    return { scope, observation }
  }
  const read = async () => {
    const issued = await sources.issue("procurement-request", target.id, binding)
    if (issued.status !== "ok") throw new Error(`C02 issue: ${issued.reason}`)
    const projection = await port.read({ requestRef: issued.value }, binding)
    const comparison = await port.compareSourcing({ requestRef: issued.value, proposalRefs: ["EUR-100", "USD-150", "USD-180"], criteria: [] }, binding)
    const selection = await collection.createSelection(binding)
    if (projection.status !== "ok" || comparison.status !== "ok" || selection.status !== "ok") throw new Error(`C02 read: ${JSON.stringify({ projection, comparison, selection })}`)
    const listed = await port.list(selection.value, binding)
    if (listed.status !== "ok") throw new Error(`C02 list: ${listed.reason}`)
    const queue = createProcurementQueueView(listed.value)
    if (!queue) throw new Error("C02 queue presentation unavailable")
    const current = await material()
    const renderContext = { actor: buyer, year: 2026, month: 11, at, versions: current.view.versions }
    const data = { ...current.view.data, procurementQueueView: queue }
    const html = render("Requests", data, renderContext)
    const approvals = render("My approvals", data, { ...renderContext, actor: holder })
    if (!html || !approvals) throw new Error("Real Procurement renderer unavailable")
    return { ...current, projection: projection.value, comparison: comparison.value, queue, html, approvals, reference: issued.value }
  }
  return {
    target, execute, run, material, read, confirmation, observer, binding, persistence, access, requester,
    export: (kind: string) => persistence.transaction("procurement", async (snapshot) => ({
      commit: false, value: await download(kind, snapshot, buyer, environment, new URLSearchParams({ request: target.id })),
    })),
    settings: (values: Record<string, unknown>) => run(admin, "save", { settings: values }, "Settings"),
    close: async () => { await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}
