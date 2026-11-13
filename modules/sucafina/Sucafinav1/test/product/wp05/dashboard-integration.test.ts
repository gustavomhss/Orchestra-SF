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
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.opexOwners = [{ id: "o", budget: 1300 }]; return { commit: true, value: undefined } })
    expect((await readBiPresentation(request, admitted.value, source, authority)).status).toBe("stale")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
