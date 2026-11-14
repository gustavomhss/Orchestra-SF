import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { createSfBiFactory } from "../../../product/analytics/factory.ts"
import { readBiPresentation } from "../../../product/analytics/capabilities.ts"
import { createProcurementCollectionRegistry } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { projectSfProcurementScope } from "../../../product/integration/procurement-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { inspectWp05Browser } from "./browser.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }

test("real procurement registry and port supply scoped BI stock and deny revoked access", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "procurement-bi-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, projectScope: projectSfProcurementScope, enumerate: enumerateSfSources })
    await persistence.initializeSources("procurement")
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: { own: { request: { number: "own", createdBy: "a", status: "draft", pr: { title: "visible" } }, version: 1, by: "a" }, waiting: { request: { number: "waiting", createdBy: "a", status: "pr_pending", pr: { title: "no entry" }, prApproval: { steps: [{ status: "pending" }] }, history: [] }, version: 1, by: "a" }, resubmitted: { request: { number: "resubmitted", createdBy: "a", status: "pr_pending", pr: { title: "resubmitted" }, prApproval: { steps: [{ status: "pending", holderId: "a" }] }, history: [{ action: "Requisition submitted for approval", at: "2025-12-30T00:00:00Z", by: "a", note: "" }, { action: "Saved", at: "2026-01-01T00:00:00Z", by: "a", note: "" }] }, version: 1, by: "a" }, returned: { request: { number: "returned", createdBy: "a", status: "pr_rejected", pr: { title: "returned" }, history: [{ action: "Saved", at: "2026-01-01T00:00:00Z", by: "a", note: "" }] }, version: 1, by: "a" }, hidden: { request: { number: "hidden", createdBy: "b", status: "pr_pending", prApproval: { steps: [{ status: "pending", holderId: "b" }] }, history: [{ action: "Requisition submitted for approval", at: "2025-12-01T00:00:00Z", by: "b", note: "" }] }, version: 1, by: "b" } }, suppliers: [], settings: { currency: "USD" } }
      return { commit: true, value: undefined }
    })
    const access = { enabled: true }
    const ui = createSfUiAuthority({ authorize: async (request) => access.enabled && request.headers.get("authorization") === "test-a" ? { installationId: "i", projectId: "p", principalRef: "a", policyVersion: "1", accessRevision: "1" } : undefined, commandIdentity: async () => "command", createId: randomUUID, now: Date.now })
    const authority: SfDomainValidation = {
      validateDomainContext: (context, operation, digest) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false),
      revalidateDomainContext: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
      receiptFor: (context, operation, digest, output) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined,
    }
    const host: DomainPortHost = { persistence, requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: authority.revalidateDomainContext, environment: async () => ({ at: "2026-01-01T00:00:00Z", directory: [], id: randomUUID }), authenticate: async (request) => request.headers.get("authorization") === "test-a" ? { id: "a", canWrite: true, roles: [{ surface: "procurement", role: "requester" }] } : null }
    const productContext = { installationId: "i", projectId: "p", principalRef: "a", policyVersion: "1", accessRevision: "1", surface: "procurement" as const, period, currency: "USD", sourceRefs: [], capabilities: [] }
    const registry = createProcurementCollectionRegistry({ host, scopedSources: persistence, contextFor: async () => ({ status: "ok", value: productContext }) })
    const bootstrap = { requestRef: "unused" }
    const issuer = await ui.admit(new Request("https://local.invalid/procurement", { headers: { authorization: "test-a" } }), "sf_request_read", digestSfValue(bootstrap))
    expect(issuer.status).toBe("ok")
    if (issuer.status !== "ok") return
    expect(await ui.validate(issuer.value, "sf_request_read", digestSfValue(bootstrap))).toBe(true)
    const selected = await registry.createSelection(issuer.value)
    expect(selected.status).toBe("ok")
    if (selected.status !== "ok") return
    const port = createProcurementPort({ ...host, ...registry, resolveSupplierSource: async () => ({ status: "unavailable", reason: "unused" }), isCurrentSupplierSource: () => false, readContractSource: async () => ({ status: "unavailable", reason: "unused" }) })
    const factory = createSfBiFactory({ authority, procurement: { views: ["BI05", "BI06"], host: { list: (selection, context) => port.list(selection, context), revalidate: async (request, context) => (await registry.resolveRequestCollection(request.selectionRef, context)).status === "ok" && await authority.revalidateDomainContext(context) } } })
    const source = factory.source
    const payload = { viewId: "BI05", selectionRef: selected.value, period }
    const admitted = await ui.admit(new Request("https://local.invalid/procurement", { headers: { authorization: "test-a" } }), "sf_bi_view", digestSfValue(payload))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    const dispatched = await dispatchSfCapability({ operation: "sf_bi_view", payload, context: admitted.value, descriptors: [factory.descriptor], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_bi_view", result.result).ok })
    expect(dispatched.status).toBe("ok")
    if (dispatched.status !== "ok") return
    const output = decodeSfOperationOutput("sf_bi_view", dispatched.result)
    expect(output.ok).toBe(true)
    if (!output.ok) return
    expect(output.value.values.map((value) => [value.id, value.value])).toEqual([["stock:draft", 1], ["stock:pr_pending", 2], ["stock:pr_rejected", 1]])
    expect(JSON.stringify(output.value)).not.toContain("hidden")
    expect(JSON.stringify(output.value)).not.toContain("2025-12-01")
    expect(output.value.values[0]?.drilldown?.refId).toBeTruthy()
    const uiProjection = await readBiPresentation(payload, admitted.value, source, authority)
    expect(uiProjection.status).toBe("ok")
    if (uiProjection.status === "ok") expect(uiProjection.value.projection).toEqual(output.value)
    const listed = await port.list(selected.value, admitted.value)
    expect(listed.status).toBe("ok")
    if (listed.status !== "ok" || uiProjection.status !== "ok") return
    expect(uiProjection.value.projection.values.map((value) => [value.id, value.value, value.drilldown])).toEqual(listed.value.stock.values.map((value) => [value.id, value.value, value.drilldown]))
    expect(uiProjection.value.projection.values.every((value) => value.drilldown?.kind === "record" && value.drilldown.target.recordType === "procurement-request-selection" && value.drilldown.target.recordId === "all")).toBe(true)
    expect(uiProjection.value.presentation.series.map((series) => series.role)).toEqual(["stock"])
    expect(uiProjection.value.presentation.limitations.join(" ")).toContain("não representa coorte ou conversão")
    expect(uiProjection.value.projection.values.some((value) => value.id.includes("rate") || value.id.includes("cohort") || value.id === "sla")).toBe(false)
    const agingPayload = { ...payload, viewId: "BI06" }
    const agingAdmission = await ui.admit(new Request("https://local.invalid/procurement", { headers: { authorization: "test-a" } }), "sf_bi_view", digestSfValue(agingPayload))
    expect(agingAdmission.status).toBe("ok")
    if (agingAdmission.status !== "ok") return
    const agingDispatch = await dispatchSfCapability({ operation: "sf_bi_view", payload: agingPayload, context: agingAdmission.value, descriptors: [factory.descriptor], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_bi_view", result.result).ok })
    expect(agingDispatch.status).toBe("ok")
    if (agingDispatch.status !== "ok") return
    const aging = decodeSfOperationOutput("sf_bi_view", agingDispatch.result)
    expect(aging.ok).toBe(true)
    if (aging.ok) {
      expect(aging.value.values.find((value) => value.id.endsWith(":ageDays"))).toMatchObject({ value: null, evidenceState: "absent" })
      expect(JSON.stringify(aging.value)).not.toContain("hidden")
      expect(JSON.stringify(aging.value)).not.toContain("2025-12-01")
    }
    const agingView = await readBiPresentation(agingPayload, agingAdmission.value, source, authority)
    expect(agingView.status).toBe("ok")
    if (agingView.status !== "ok") return
    const published = agingView.value.projection
    expect(published.values.find((value) => value.id.startsWith("waiting:") && value.id.endsWith(":ageDays"))).toMatchObject({ value: null, evidenceState: "absent", drilldown: { target: { recordType: "procurement-request", recordId: "waiting" } } })
    expect(published.values.find((value) => value.id.startsWith("resubmitted:") && value.id.endsWith(":ageDays"))).toMatchObject({ value: 2, evidenceState: "confirmed", drilldown: { target: { recordType: "procurement-request", recordId: "resubmitted" } } })
    expect(published.values.find((value) => value.id.startsWith("resubmitted:") && value.id.endsWith(":stageEnteredAt"))?.value).toBe("2025-12-30T00:00:00Z")
    expect(published.missing).toEqual(expect.arrayContaining([{ field: expect.stringMatching(/^waiting:.*:ageDays$/), reason: "unavailable" }, { field: expect.stringMatching(/^waiting:.*:holder$/), reason: "missing" }]))
    expect(published.values.some((value) => value.id.endsWith(":ageDays") && (value.id.startsWith("returned:") || value.id.startsWith("own:") || value.id.startsWith("hidden:")))).toBe(false)
    expect(agingView.value.presentation.series).toEqual([expect.objectContaining({ id: "aging", role: "aging", valueIds: published.values.filter((value) => value.id.endsWith(":ageDays")).map((value) => value.id) })])
    expect(agingView.value.presentation.limitations.join(" ")).toContain("indisponíveis")
    for (const row of listed.value.aging) for (const value of row.values) if (value.evidenceState === "absent" || value.evidenceState === "estimated") expect(published.values.find((item) => item.drilldown?.kind === "record" && value.drilldown?.kind === "record" && item.drilldown.target.recordId === value.drilldown.target.recordId && item.id.endsWith(`:${value.id}`))).toMatchObject({ value: value.value, evidenceState: value.evidenceState })

    const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
    if (!built.success || !built.outputs[0]) throw new Error("analytics browser bundle failed")
    const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
    await inspectWp05Browser("procurement scoped stock and aging", async (page, phase) => {
      phase("render")
      await page.evaluate(async (input) => {
        const module = await import(input.url)
        for (const entry of input.entries) {
          const section = module.renderBiView(entry.request, entry.value.projection, (selection: unknown) => { document.body.dataset.selection = JSON.stringify(selection) }, entry.value.presentation)
          section.id = entry.id
          document.body.append(section)
        }
      }, { url, entries: [{ id: "scoped-stock", request: payload, value: uiProjection.value }, { id: "scoped-aging", request: agingPayload, value: agingView.value }] })
      phase("assertions")
      for (const entry of [{ id: "scoped-stock", value: uiProjection.value }, { id: "scoped-aging", value: agingView.value }]) {
        phase(`assertions:${entry.id}`)
        const section = page.locator(`#${entry.id}`)
        const renderedRows = await section.locator("table tbody tr").evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll("td")).slice(0, 6).map((cell) => cell.textContent)))
        expect(renderedRows).toEqual(entry.value.projection.values.map((value) => [
          value.id,
          value.evidenceState === "absent" || value.value === null ? "Indisponível" : String(value.value),
          value.unit ?? value.currency ?? "—",
          `${value.period.start} – ${value.period.end}`,
          value.granularity,
          value.evidenceState,
        ]))
        for (const value of entry.value.projection.values) {
          if (!value.drilldown) continue
          phase(`navigation:${entry.id}:${value.id}`)
          const origin = section.locator(`table button[data-bi-focus="${value.id}"]`)
          expect(await origin.count()).toBe(1)
          await origin.click()
          const selection = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
          expect(selection.valueId).toBe(value.id)
          expect(selection.reference).toEqual(value.drilldown)
          expect(selection.context).toEqual(entry.value.projection.context)
          expect(selection.visualPeriod).toEqual(period)
          expect(JSON.stringify(selection)).not.toContain("hidden")
          expect(JSON.stringify(selection)).not.toContain("2025-12-01")
        }
      }
      phase("assertions:stock")
      const stock = page.locator("#scoped-stock")
      expect(await stock.locator('svg [data-bi-series="stock"]').count()).toBe(3)
      for (const value of uiProjection.value.projection.values) {
        const mark = stock.locator(`svg [data-bi-focus="${value.id}"]`)
        expect(await mark.count()).toBe(1)
        expect(await mark.getAttribute("aria-label")).toContain(`${value.id}: ${value.value} `)
        phase(`navigation:stock:${value.id}`)
        await mark.click()
        expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null").reference).toEqual(value.drilldown)
      }
      phase("assertions:aging")
      const aged = page.locator("#scoped-aging")
      expect(await aged.locator('svg [data-bi-series="aging"]').count()).toBe(1)
      expect(await aged.textContent()).toContain("Idade indisponível: 1 de 2 pedidos nesta seleção.")
      const known = published.values.find((value) => value.id.startsWith("resubmitted:") && value.id.endsWith(":ageDays"))
      expect(known).toBeDefined()
      if (!known) throw new Error("real scoped producer omitted known age")
      const point = aged.locator(`svg [data-bi-focus="${known.id}"]`)
      expect(await point.getAttribute("aria-label")).toContain(": 2 ")
      phase("navigation:aging")
      await point.click()
      expect(JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null").reference).toEqual(known.drilldown)
      const unavailable = aged.getByRole("list", { name: "Pedidos com idade indisponível" })
      expect(await unavailable.getByRole("listitem").count()).toBe(1)
      phase("navigation:unavailable")
      await unavailable.getByRole("button", { name: "Abrir waiting", exact: true }).click()
      const unknown = JSON.parse(await page.locator("body").getAttribute("data-selection") ?? "null")
      expect(unknown.reference.target.recordId).toBe("waiting")
      phase("assertions:privacy")
      const html = await page.content()
      expect(html).not.toContain("hidden")
      expect(html).not.toContain("2025-12-01")
    })
    access.enabled = false
    expect((await readBiPresentation(payload, admitted.value, source, authority)).status).toBe("denied")
    expect((await readBiPresentation(agingPayload, agingAdmission.value, source, authority)).status).toBe("denied")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 180000)

