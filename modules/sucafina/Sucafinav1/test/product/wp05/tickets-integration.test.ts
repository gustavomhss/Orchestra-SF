import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { bindDashboardBiPort, createDashboardBiSource } from "../../../product/analytics/dashboard.ts"
import { createBiDescriptor, readBiPresentation } from "../../../product/analytics/capabilities.ts"
import { presentDashboardBi } from "../../../product/dashboard/bi-metadata.ts"
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

test("real Dashboard ticket observations reach BI with source evidence and deny changed selection or revoked authority", async () => {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "dashboard-tickets-bi-"))
  const store = await openLocalStore(directory)
  try {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => environment.at) })
    await persistence.initializeSources("dashboard")
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "admin" }]
      snapshot.data.opsCats = ["Infrastructure"]
      snapshot.data.opsTickets = [
        { id: "2026-1", year: 2026, month: 1, "Infrastructure|Incidents|Initial Balance": 4, "Infrastructure|Incidents|Open": 3, "Infrastructure|Incidents|Closed": 1 },
        { id: "2026-2", year: 2026, month: 2, "Infrastructure|Incidents|Initial Balance": 4, "Infrastructure|Incidents|Open": 0, "Infrastructure|Incidents|Closed": 2 },
      ]
      return { commit: true, value: undefined }
    })
    const access = { enabled: true }
    const ui = createSfUiAuthority({ authorize: async (request) => access.enabled && request.headers.get("authorization") === "test-admin" ? { installationId: "i", projectId: "p", principalRef: "admin", policyVersion: "1", accessRevision: "1" } : undefined, commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse(environment.at) })
    const authority: SfDomainValidation = {
      validateDomainContext: async (context, operation, digest) => context.kind === "ui" && await ui.validate(context, operation, digest),
      revalidateDomainContext: async (context) => context.kind === "ui" && await ui.revalidate(context),
      receiptFor: (context, operation, digest, output) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined,
    }
    const host: DomainPortHost = { persistence, authenticate: async (request, input) => request.headers.get("authorization") === "test-admin" ? resolve("admin", [...input!.roleMap], (group) => group === "admins") : null, environment: async () => environment, requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: authority.revalidateDomainContext }
    const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const issueRequest = { viewId: "BI07", selectionRef: "source-admission", period }
    const issueContext = await ui.admit(new Request("https://example.test", { headers: { authorization: "test-admin" } }), "sf_bi_view", digestSfValue(issueRequest))
    expect(issueContext.status).toBe("ok")
    if (issueContext.status !== "ok") return
    expect(await ui.validate(issueContext.value, "sf_bi_view", digestSfValue(issueRequest))).toBe(true)
    const selected = await issue({ page: "IT Operations", fields: ["opsTickets"], period }, issueContext.value)
    expect(selected.status).toBe("ok")
    if (selected.status !== "ok") return

    const dashboard = createDashboardPort({ host, sources: createDashboardSourceHost({ host, scopedSources: persistence }) })
    const source = createDashboardBiSource(bindDashboardBiPort({
      dashboard,
      resolve: async (request) => request.viewId === "BI07" ? { status: "ok", value: { fields: ["opsTickets"], present: (projection) => {
        const presentation = presentDashboardBi("BI07", projection)
        if (presentation.status !== "ok") throw new Error(presentation.reason)
        return presentation.value
      } } } : { status: "unavailable", reason: "unsupported-view" },
      revalidate: async (_request, context) => authority.revalidateDomainContext(context),
    }))
    const request = { viewId: "BI07", selectionRef: selected.value.selectionRef, period }
    const admitted = await ui.admit(new Request("https://example.test", { headers: { authorization: "test-admin" } }), "sf_bi_view", digestSfValue(request))
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") return
    const dispatched = await dispatchSfCapability({ operation: "sf_bi_view", payload: request, context: admitted.value, descriptors: [createBiDescriptor(source, authority)], authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_bi_view", value).ok, validateOutput: (_descriptor, result) => result.status !== "ok" || decodeSfOperationOutput("sf_bi_view", result.result).ok })
    expect(dispatched.status).toBe("ok")
    if (dispatched.status !== "ok") return
    const decoded = decodeSfOperationOutput("sf_bi_view", dispatched.result)
    expect(decoded.ok).toBe(true)
    if (!decoded.ok) return
    expect(decoded.value.values).toContainEqual(expect.objectContaining({ id: "tickets:2026-01:Infrastructure|Incidents|Open", value: 3, granularity: "month", evidenceState: "confirmed" }))
    expect(decoded.value.values).toContainEqual(expect.objectContaining({ id: "tickets:2026-02:Infrastructure|Incidents|Open", value: 0, granularity: "month", evidenceState: "confirmed" }))
    expect(decoded.value.values).toContainEqual(expect.objectContaining({ id: "tickets:2026-02:Infrastructure|Incidents|Closed", value: 2, granularity: "month", evidenceState: "confirmed" }))
    expect(decoded.value.values.find((value) => value.id === "tickets:2026-02:Infrastructure|Incidents|Open")?.sourceRefs[0]).toMatchObject({ kind: "record", target: { recordType: "dashboard-page", recordId: "IT Operations", fields: ["opsTickets"] } })

    const presentation = await readBiPresentation(request, admitted.value, source, authority)
    expect(presentation.status).toBe("ok")
    if (presentation.status !== "ok") return
    expect(presentation.value.presentation.series).toContainEqual(expect.objectContaining({ id: "Infrastructure|Incidents|Open", role: "opened", valueIds: ["tickets:2026-01:Infrastructure|Incidents|Open", "tickets:2026-02:Infrastructure|Incidents|Open"] }))
    expect(presentation.value.presentation.series).toContainEqual(expect.objectContaining({ id: "Infrastructure|Incidents|Closed", role: "closed", valueIds: ["tickets:2026-01:Infrastructure|Incidents|Closed", "tickets:2026-02:Infrastructure|Incidents|Closed"] }))
    expect(presentation.value.presentation.limitations.join(" ")).toContain("not an event log or a backlog")

    const changedSelection = { ...request, selectionRef: `${selected.value.selectionRef}-changed` }
    const changedAdmission = await ui.admit(new Request("https://example.test", { headers: { authorization: "test-admin" } }), "sf_bi_view", digestSfValue(changedSelection))
    expect(changedAdmission.status).toBe("ok")
    if (changedAdmission.status !== "ok") return
    expect(await ui.validate(changedAdmission.value, "sf_bi_view", digestSfValue(changedSelection))).toBe(true)
    expect((await readBiPresentation(changedSelection, changedAdmission.value, source, authority)).status).not.toBe("ok")

    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opsTickets = [
        { id: "2026-1", year: 2026, month: 1, "Infrastructure|Incidents|Initial Balance": 4, "Infrastructure|Incidents|Open": 3, "Infrastructure|Incidents|Closed": 1 },
        { id: "2026-2", year: 2026, month: 2, "Infrastructure|Incidents|Initial Balance": 4, "Infrastructure|Incidents|Open": 7, "Infrastructure|Incidents|Closed": 2 },
      ]
      return { commit: true, value: undefined }
    })
    expect((await readBiPresentation(request, admitted.value, source, authority)).status).toBe("stale")

    const refreshIssueRequest = { viewId: "BI07", selectionRef: "source-admission-refresh", period }
    const refreshIssueContext = await ui.admit(new Request("https://example.test", { headers: { authorization: "test-admin" } }), "sf_bi_view", digestSfValue(refreshIssueRequest))
    expect(refreshIssueContext.status).toBe("ok")
    if (refreshIssueContext.status !== "ok") return
    expect(await ui.validate(refreshIssueContext.value, "sf_bi_view", digestSfValue(refreshIssueRequest))).toBe(true)
    const refreshedSelection = await issue({ page: "IT Operations", fields: ["opsTickets"], period }, refreshIssueContext.value)
    expect(refreshedSelection.status).toBe("ok")
    if (refreshedSelection.status !== "ok") return
    const refreshedRequest = { ...request, selectionRef: refreshedSelection.value.selectionRef }
    const refreshedAdmission = await ui.admit(new Request("https://example.test", { headers: { authorization: "test-admin" } }), "sf_bi_view", digestSfValue(refreshedRequest))
    expect(refreshedAdmission.status).toBe("ok")
    if (refreshedAdmission.status !== "ok") return
    expect(await ui.validate(refreshedAdmission.value, "sf_bi_view", digestSfValue(refreshedRequest))).toBe(true)
    const refreshedPresentation = await readBiPresentation(refreshedRequest, refreshedAdmission.value, source, authority)
    expect(refreshedPresentation.status).toBe("ok")
    if (refreshedPresentation.status === "ok") {
      expect(refreshedPresentation.value.projection.values.find((value) => value.id === "tickets:2026-01:Infrastructure|Incidents|Open")?.value).toBe(3)
      expect(refreshedPresentation.value.projection.values.find((value) => value.id === "tickets:2026-02:Infrastructure|Incidents|Open")?.value).toBe(7)
    }

    access.enabled = false
    expect((await readBiPresentation(request, admitted.value, source, authority)).status).toBe("denied")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
