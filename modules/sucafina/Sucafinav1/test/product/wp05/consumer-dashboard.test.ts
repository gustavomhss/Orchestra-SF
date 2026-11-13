import { test } from "bun:test"
import { chromium, expect } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { presentProjection } from "../../../product/analytics/catalog.ts"
import type { BiSelection } from "../../../product/analytics/catalog.ts"
import { dispatchBiPresentation, readBiDestination } from "../../../product/analytics/consumer.ts"
import type { BiPresentationResult } from "../../../product/analytics/consumer.ts"
import { bindDashboardBiPort, createDashboardBiSource } from "../../../product/analytics/dashboard.ts"
import { sameBiProjection } from "../../../product/analytics/projection.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { Period } from "../../../product/contracts/context.ts"
import type { BiViewRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import { decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { dashboardBiPresentation } from "../../../product/dashboard/bi.ts"
import { resolveDashboardBiSelection } from "../../../product/dashboard/bi-metadata.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createSfDashboardSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }

// This integration proves the published Dashboard page-level C17 destination for BI01.
// It does not stand in for eight chart destinations or an installed browser runtime.
test("C02 consumer and table reopen the authorized C17 page and reject changed sources and revoked roles", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp05-consumer-dashboard-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => environment.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.opexOwners = [{ id: "owner", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 200, actual: 0 }]
      snapshot.data.capexProjects = []
      snapshot.data.capexEntries = []
      return { commit: true, value: undefined }
    })

    const authenticatedRequest = () => new Request("https://example.test/bi", { headers: { authorization: "Bearer fixture-admin" } })
    const ui = createSfUiAuthority({
      authorize: async (request, operation) => request.headers.get("authorization") === "Bearer fixture-admin" && operation === "sf_bi_view"
        ? { installationId: "installation", projectId: "project", principalRef: "admin", policyVersion: "1", accessRevision: "1" }
        : undefined,
      commandIdentity: async (request, operation, digest) => request.headers.get("authorization") === "Bearer fixture-admin" ? `${operation}:${digest}` : undefined,
      createId: randomUUID,
      now: () => Date.parse(environment.at),
    })
    const authority: SfDomainValidation = {
      validateDomainContext: async (context, operation, digest) => context.kind === "ui" && await ui.validate(context, operation, digest),
      revalidateDomainContext: async (context) => context.kind === "ui" && await ui.revalidate(context),
      receiptFor: (context, operation, digest, output) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined,
    }
    const host: DomainPortHost = {
      persistence,
      authenticate: async (request, input) => request.headers.get("authorization") === "Bearer fixture-admin" && input
        ? resolve("admin", [...input.roleMap], (group) => group === "admins")
        : null,
      environment: async () => environment,
      requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: authority.revalidateDomainContext,
    }
    const admit = async (request: BiViewRequest) => requireOk(await ui.admit(authenticatedRequest(), "sf_bi_view", digestSfValue(request)))
    const discovery = { viewId: "BI01", selectionRef: "source-discovery", period }
    expect((await ui.admit(new Request("https://example.test/bi"), "sf_bi_view", digestSfValue(discovery))).status).toBe("denied")
    const discoveryContext = await admit(discovery)
    expect(await ui.validate(discoveryContext, "sf_bi_view", digestSfValue(discovery))).toBe(true)
    const producerSelection = resolveDashboardBiSelection("BI01", period)
    expect(producerSelection).toEqual({ page: "Budget Overview", fields: ["budgetSeries"] })
    if (!producerSelection) throw new Error("Published Dashboard BI01 routing is unavailable")
    const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const issued = requireOk(await issue({ ...producerSelection, period }, discoveryContext))
    const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const source = createDashboardBiSource(bindDashboardBiPort({
      dashboard,
      resolve: async (request) => {
        const selection = resolveDashboardBiSelection(request.viewId, request.period)
        return request.viewId === "BI01" && selection
          ? { status: "ok", value: { fields: selection.fields, present: (projection) => dashboardBiPresentation("BI01", projection) } }
          : { status: "unavailable", reason: "unsupported-view" }
      },
      revalidate: async (_request, context) => authority.revalidateDomainContext(context),
    }))
    const business = { resolve: createSfDashboardSourceAccess({ host, issue, dashboard }) }
    const request = { viewId: "BI01", selectionRef: issued.selectionRef, period }
    const canonical = requireOk(await dashboard.read({ selectionRef: issued.selectionRef, fields: producerSelection.fields, period }, discoveryContext))
    const readContext = await admit(request)
    const delivered = requireOk(await dispatchBiPresentation(request, readContext, source, authority))
    expect(sameBiProjection(delivered.projection, canonical)).toBe(true)
    expect(delivered.receipt).toMatchObject({ kind: "ui", operation: "sf_bi_view", handlerExport: "readBiView", inputDigest: digestSfValue(request), resultDigest: digestSfValue(delivered.projection), principalRef: "admin", accessRevision: "1" })
    expect(delivered.presentation.series.find((series) => series.role === "actual")?.valueIds).toContain("budget:2026-01:actual")
    expect(delivered.presentation.limitations).toContain("Forecast is the recorded field; an outlook combining closed actual and open forecast is unavailable.")

    const table = presentProjection(delivered.projection, request.selectionRef)
    expect(table.context).toMatchObject({ installationId: "installation", projectId: "project", principalRef: "admin", surface: "dashboard", period, currency: "unspecified" })
    expect(table.rows).toContainEqual(expect.objectContaining({ id: "budget:2026-01:effective", value: 200, evidenceState: "estimated" }))
    expect(table.rows).toContainEqual(expect.objectContaining({ id: "budget:2026-02:effective", value: 100, evidenceState: "estimated" }))
    expect(table.rows).toContainEqual(expect.objectContaining({ id: "budget:2026-02:actual", value: null, evidenceState: "absent" }))
    const zero = table.rows.find((row) => row.id === "budget:2026-01:actual")
    expect(zero).toMatchObject({ value: 0, evidenceState: "confirmed", sourceRefs: [issued.evidence], drilldown: issued.evidence })
    if (!zero) throw new Error("C02 did not publish the observed zero")
    expect(zero.selection).toEqual({ context: delivered.projection.context, selectionRef: issued.selectionRef, projectionVersion: delivered.projection.version, engineVersion: delivered.projection.engineVersion, valueId: zero.id, reference: issued.evidence })

    // The consumer consumes a new one-use admission for opening a selected table value.
    const destination = requireOk(await readBiDestination({ request, selection: zero.selection, context: await admit(request), source, authority, business }))
    expect(destination.selection).toEqual(zero.selection)
    expect(destination.source).toMatchObject({ state: "fresh", ref: issued.evidence, currentRef: issued.evidence, accessRevision: "1" })
    expect(destination.source.ref).toMatchObject({ kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: "Budget Overview", fields: ["budgetSeries"], period, version: delivered.projection.version } })
    const detail = decodeSfOperationOutput("sf_dashboard_read", destination.source.authorizedProjection)
    expect(detail.ok).toBe(true)
    if (!detail.ok) throw new Error("C17 did not return an authorized Dashboard projection")
    expect(sameBiProjection(detail.value, canonical)).toBe(true)
    expect(detail.value.values.find((value) => value.id === zero.id)?.value).toBe(0)

    const visualPeriod = { start: "2026-01-01", end: "2026-01-31" }
    const brushedSelection = await selectFromRenderedTable(delivered, visualPeriod, zero.id)
    expect(brushedSelection).toEqual({ ...zero.selection, visualPeriod })
    const brushedDestination = requireOk(await readBiDestination({ request, selection: brushedSelection, context: await admit(request), source, authority, business }))
    expect(brushedDestination.selection).toEqual(brushedSelection)
    expect(brushedDestination.selection.context.period).toEqual(period)
    expect(brushedDestination.source.ref).toEqual(issued.evidence)
    // A visual brush cannot replace the producer's authorized annual ProductContext.
    const changedContext = { ...brushedSelection, context: { ...brushedSelection.context, period: visualPeriod } }
    expect(await readBiDestination({ request, selection: changedContext, context: await admit(request), source, authority, business })).toEqual({ status: "stale", reason: "selection-context-changed" })

    const replay = await readBiDestination({ request, selection: zero.selection, context: readContext, source, authority, business })
    expect(replay).toEqual({ status: "denied", reason: "authority-unavailable" })
    const changedReference = { ...zero.selection, reference: { ...issued.evidence, refId: "different-selection" } }
    expect(await readBiDestination({ request, selection: changedReference, context: await admit(request), source, authority, business })).toEqual({ status: "stale", reason: "selection-source-changed" })

    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 200, actual: 37 }]
      return { commit: true, value: undefined }
    })
    const staleRead = await dispatchBiPresentation(request, await admit(request), source, authority)
    expect(staleRead.status).toBe("stale")
    expect("value" in staleRead).toBe(false)
    const staleDestination = await readBiDestination({ request, selection: zero.selection, context: await admit(request), source, authority, business })
    expect(staleDestination.status).toBe("stale")
    expect("value" in staleDestination).toBe(false)

    const refreshed = requireOk(await issue({ ...producerSelection, period }, discoveryContext))
    expect(refreshed.selectionRef).not.toBe(issued.selectionRef)
    expect(refreshed.evidence.target.version).toBeGreaterThan(issued.evidence.target.version)
    const currentRequest = { ...request, selectionRef: refreshed.selectionRef }
    const currentContext = await admit(currentRequest)
    const current = requireOk(await dispatchBiPresentation(currentRequest, currentContext, source, authority))
    const currentRow = presentProjection(current.projection, currentRequest.selectionRef).rows.find((row) => row.id === zero.id)
    expect(currentRow).toMatchObject({ value: 37, evidenceState: "confirmed", drilldown: refreshed.evidence })
    if (!currentRow) throw new Error("Updated C02 value is unavailable")
    const currentDestination = requireOk(await readBiDestination({ request: currentRequest, selection: currentRow.selection, context: await admit(currentRequest), source, authority, business }))
    const currentDetail = decodeSfOperationOutput("sf_dashboard_read", currentDestination.source.authorizedProjection)
    expect(currentDetail.ok).toBe(true)
    if (currentDetail.ok) expect(currentDetail.value.values.find((value) => value.id === zero.id)?.value).toBe(37)

    // Revoke persisted domain roles while keeping the UI lease valid. Authorization must
    // fail at the real Dashboard scope reader, rather than a synthetic resolver callback.
    const revokedReadContext = await admit(currentRequest)
    const revokedDestinationContext = await admit(currentRequest)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = []
      return { commit: true, value: undefined }
    })
    expect(await ui.revalidate(revokedReadContext)).toBe(true)
    const revokedRead = await dispatchBiPresentation(currentRequest, revokedReadContext, source, authority)
    expect(revokedRead.status).toBe("denied")
    expect("value" in revokedRead).toBe(false)
    const revokedDestination = await readBiDestination({ request: currentRequest, selection: currentRow.selection, context: revokedDestinationContext, source, authority, business })
    expect(revokedDestination.status).toBe("denied")
    expect("value" in revokedDestination).toBe(false)
    const revokedEvidence = await business.resolve(refreshed.evidence, currentContext)
    expect(revokedEvidence.state).toBe("unavailable")
    expect(revokedEvidence.authorizedProjection).toBeUndefined()
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 90000)

function requireOk<T>(result: PortResult<T>): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

async function selectFromRenderedTable(delivered: BiPresentationResult, visualPeriod: Period, valueId: string): Promise<BiSelection> {
  const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
  if (!built.success || !built.outputs[0]) throw new Error("BI consumer renderer bundle failed")
  const moduleUrl = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
  const browser = await chromium.launch({ channel: "chrome", headless: true, args: ["--no-sandbox"] })
  try {
    const page = await browser.newPage()
    const errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto("about:blank")
    await page.evaluate(async (input) => {
      const module = await import(input.moduleUrl)
      document.body.append(module.renderBiView(input.request, input.projection, (selection: BiSelection) => { document.body.dataset.selection = JSON.stringify(selection) }, input.presentation))
    }, { moduleUrl, request: delivered.request, projection: delivered.projection, presentation: delivered.presentation })
    const table = page.getByRole("table", { name: "Dados e referências" })
    await expect(table.getByRole("row").filter({ hasText: valueId }).getByRole("cell").nth(1)).toHaveText("0")
    await expect(table.getByRole("row").filter({ hasText: "budget:2026-02:actual" }).getByRole("cell").nth(1)).toHaveText("Indisponível")
    await page.getByLabel("Fim do período", { exact: true }).fill(visualPeriod.end)
    await page.getByRole("button", { name: "Aplicar filtro", exact: true }).focus()
    await page.keyboard.press("Enter")
    await expect(table.getByRole("row").filter({ hasText: "budget:2026-02:actual" })).toHaveCount(0)
    const selected = table.getByRole("row").filter({ hasText: valueId })
    await expect(selected.getByRole("cell").nth(1)).toHaveText("0")
    await selected.getByRole("button", { name: "Abrir origem", exact: true }).focus()
    await page.keyboard.press("Enter")
    const emitted = await page.locator("body").getAttribute("data-selection")
    if (!emitted) throw new Error("Keyboard selection did not reach the renderer consumer callback")
    expect(errors).toEqual([])
    return JSON.parse(emitted) as BiSelection
  } finally {
    await browser.close()
  }
}
