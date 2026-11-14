import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { bindDashboardBiPort, createDashboardBiSource } from "../../../product/analytics/dashboard.ts"
import { createBiDescriptor, readBiPresentation } from "../../../product/analytics/capabilities.ts"
import { dashboardBiPresentation } from "../../../product/dashboard/bi.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const historicalPeriod = { start: "2026-01-01", end: "2026-02-28" }
const environment = { at: "2026-11-13T00:00:00Z", id: () => "unused", directory: [] }

test("authorized dashboard source reaches BI through the real UI dispatcher", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "dashboard-bi-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => environment.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.opexOwners = [{ id: "o", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "o", year: 2026, month: 1, budget: 200, actual: 0 }]
      snapshot.data.projects = [{ id: "p", milestones: [{ id: "dated", name: "Launch", date: "2026-03-05", status: "done" }, { id: "planned", name: "Review", date: "2026-12-05", status: "upcoming" }, { id: "historical", name: "Past checkpoint", date: "2026-02-05", status: "upcoming" }, { id: "undated", name: "No date" }] }]
      return { commit: true, value: undefined }
    })
    const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "admin", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse(environment.at) })
    const authority: SfDomainValidation = {
      validateDomainContext: async (context, operation, digest) => context.kind === "ui" && await ui.validate(context, operation, digest),
      revalidateDomainContext: async (context) => context.kind === "ui" && await ui.revalidate(context),
      receiptFor: (context, operation, digest, output) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined,
    }
    const host: DomainPortHost = { persistence, authenticate: async (_request, input) => resolve("admin", [...input!.roleMap], (group) => group === "admins"), environment: async () => environment, requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: authority.revalidateDomainContext }
    const issuerInput = { page: "Budget Overview", fields: ["budgetMetrics"], period }
    const issuerRequest = { viewId: "BI01", selectionRef: "source-discovery", period }
    const issuerContext = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(issuerRequest))
    expect(issuerContext.status).toBe("ok")
    if (issuerContext.status !== "ok") return
    expect(await ui.validate(issuerContext.value, "sf_bi_view", digestSfValue(issuerRequest))).toBe(true)
    const issued = await createDashboardSourceIssuer({ host, scopedSources: persistence })(issuerInput, issuerContext.value)
    expect(issued.status).toBe("ok")
    if (issued.status !== "ok") return
    const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const source = createDashboardBiSource(bindDashboardBiPort({ dashboard, resolve: async (request) => request.viewId === "BI01" ? { status: "ok", value: { fields: ["budgetMetrics"], present: (projection) => dashboardBiPresentation("BI01", projection) } } : { status: "unavailable", reason: "unsupported-view" }, revalidate: async (_request, context) => authority.revalidateDomainContext(context) }))
    const request = { viewId: "BI01", selectionRef: issued.value.selectionRef, period }
    const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    const dispatched = await dispatchSfCapability({ operation: "sf_bi_view", payload: request, context: admitted.value, descriptors: [createBiDescriptor(source, authority)], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_bi_view", result.result).ok })
    expect(dispatched.status).toBe("ok")
    if (dispatched.status === "ok") {
      const projection = decodeSfOperationOutput("sf_bi_view", dispatched.result)
      expect(projection.ok).toBe(true)
      if (projection.ok) expect(projection.value.values).toContainEqual(expect.objectContaining({ id: "budget:2026-01:actual", value: 0 }))
    }
    const presentation = await readBiPresentation(request, admitted.value, source, authority)
    expect(presentation.status).toBe("ok")
    if (presentation.status === "ok") expect(presentation.value.presentation.series.find((series) => series.role === "actual")?.valueIds).toContain("budget:2026-01:actual")
    const milestoneSelection = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Portfolio Dashboard", fields: ["milestoneDates"], period }, issuerContext.value)
    expect(milestoneSelection.status).toBe("ok")
    if (milestoneSelection.status !== "ok") return
    const milestoneSource = createDashboardBiSource(bindDashboardBiPort({ dashboard, resolve: async (input) => input.viewId === "BI08" ? { status: "ok", value: { fields: ["milestoneDates"], present: (projection) => dashboardBiPresentation("BI08", projection) } } : { status: "unavailable", reason: "unsupported-view" }, revalidate: async (_request, context) => authority.revalidateDomainContext(context) }))
    const milestoneRequest = { viewId: "BI08", selectionRef: milestoneSelection.value.selectionRef, period }
    const milestoneAdmission = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(milestoneRequest))
    expect(milestoneAdmission.status).toBe("ok")
    if (milestoneAdmission.status !== "ok") return
    const milestoneOutput = await dispatchSfCapability({ operation: "sf_bi_view", payload: milestoneRequest, context: milestoneAdmission.value, descriptors: [createBiDescriptor(milestoneSource, authority)], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, output) => output.status !== "ok" || decodeSfOperationOutput("sf_bi_view", output.result).ok })
    expect(milestoneOutput.status).toBe("ok")
    if (milestoneOutput.status !== "ok") return
    const milestoneProjection = decodeSfOperationOutput("sf_bi_view", milestoneOutput.result)
    expect(milestoneProjection.ok).toBe(true)
    if (milestoneProjection.ok) {
      expect(milestoneProjection.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:undated:date", value: null, evidenceState: "absent" }))
      expect(milestoneProjection.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:planned:status", value: "upcoming", period: { start: "2026-11-13", end: "2026-11-13" } }))
    }
    const milestonePresentation = await readBiPresentation(milestoneRequest, milestoneAdmission.value, milestoneSource, authority)
    expect(milestonePresentation.status).toBe("ok")
    if (milestonePresentation.status === "ok") {
      expect(milestonePresentation.value.presentation.timeline?.items).toContainEqual(expect.objectContaining({ label: "No date", dateValueId: "milestone:p:undated:date", state: "unknown" }))
      expect(milestonePresentation.value.presentation.timeline?.items).toContainEqual(expect.objectContaining({ label: "Review", dateValueId: "milestone:p:planned:date", state: "planned" }))
      expect(milestonePresentation.value.presentation.timeline?.items).toContainEqual(expect.objectContaining({ label: "Launch", dateValueId: "milestone:p:dated:date", state: "unknown" }))
    }
    const historicalIssuerRequest = { viewId: "BI08", selectionRef: "historical-source-discovery", period: historicalPeriod }
    const historicalIssuerContext = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(historicalIssuerRequest))
    expect(historicalIssuerContext.status).toBe("ok")
    if (historicalIssuerContext.status !== "ok") return
    expect(await ui.validate(historicalIssuerContext.value, "sf_bi_view", digestSfValue(historicalIssuerRequest))).toBe(true)
    const historicalSelection = await createDashboardSourceIssuer({ host, scopedSources: persistence })({ page: "Portfolio Dashboard", fields: ["milestoneDates"], period: historicalPeriod }, historicalIssuerContext.value)
    expect(historicalSelection.status).toBe("ok")
    if (historicalSelection.status !== "ok") return
    const historicalRequest = { viewId: "BI08", selectionRef: historicalSelection.value.selectionRef, period: historicalPeriod }
    const historicalAdmission = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(historicalRequest))
    expect(historicalAdmission.status).toBe("ok")
    if (historicalAdmission.status !== "ok") return
    const historicalOutput = await dispatchSfCapability({ operation: "sf_bi_view", payload: historicalRequest, context: historicalAdmission.value, descriptors: [createBiDescriptor(milestoneSource, authority)], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, output) => output.status !== "ok" || decodeSfOperationOutput("sf_bi_view", output.result).ok })
    expect(historicalOutput.status).toBe("ok")
    if (historicalOutput.status !== "ok") return
    const historicalProjection = decodeSfOperationOutput("sf_bi_view", historicalOutput.result)
    expect(historicalProjection.ok).toBe(true)
    if (historicalProjection.ok) {
      expect(historicalProjection.value.values).toContainEqual(expect.objectContaining({ id: "milestone:p:historical:date", value: "2026-02-05" }))
      expect(historicalProjection.value.values.some((value) => value.id === "milestone:p:historical:status")).toBe(false)
    }
    const historicalPresentation = await readBiPresentation(historicalRequest, historicalAdmission.value, milestoneSource, authority)
    expect(historicalPresentation.status).toBe("ok")
    if (historicalPresentation.status === "ok") expect(historicalPresentation.value.presentation.timeline?.items).toContainEqual(expect.objectContaining({ label: "Past checkpoint", dateValueId: "milestone:p:historical:date", state: "unknown" }))
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", budget: 1300 }]; return { commit: true, value: undefined } })
    expect((await readBiPresentation(request, admitted.value, source, authority)).status).toBe("stale")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
