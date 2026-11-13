import { expect, test } from "bun:test"
import { createContextualBiSelectionReader, createStoredContextualBiSelectionReader } from "../../../product/analytics/contextual.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfBiArtifact } from "../../../product/contracts/state.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const caseRef = { id: "case", incarnation: "inc", version: 2 }
const ref: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "source", installationId: "i", projectId: "p", refDigest: "source-digest", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: "budget", incarnation: "page-inc", version: 1, fields: ["budgetMetrics"], period, projectionDigest: "projection-digest" } }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "engine", components: [], missing: [], values: [{ id: "value", value: 0, unit: "USD", currency: "USD", period, granularity: "year", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" }] }
const artifacts = { dashboardSelection: { selectionRef: "actual-selection", period, fields: ["budgetMetrics"] }, projectionRefs: [ref], projection, canonicalProjectionRefs: ["actual-projection"], tableRef: "actual-table" }

test("contextual selection passes host-owned refs and denies revoked authority", async () => {
  const active = { value: true }
  const ui = createSfUiAuthority({ authorize: async () => active.value ? { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" } : undefined, commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const payload = { viewId: "BI01", selectionRef: "actual-selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(payload))
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") return
  expect(await ui.validate(admitted.value, "sf_bi_view", digestSfValue(payload))).toBe(true)
  const reader = createContextualBiSelectionReader({ approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }], readHumanSelection: async () => ({ status: "ok", value: { viewId: "BI01", version: 3, filters: [{ field: "department", values: ["IT"] }] } }), readArtifacts: async () => ({ status: "ok", value: artifacts }), verifyArtifacts: async (_case, _selection, actual) => actual.tableRef === "actual-table" && actual.canonicalProjectionRefs[0] === "actual-projection", revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) })
  const result = await reader(caseRef, admitted.value)
  expect(result.status).toBe("ok")
  if (result.status === "ok") {
    expect(result.value).toMatchObject({ viewId: "BI01", canonicalProjectionRefs: ["actual-projection"], tableRef: "actual-table", approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }] })
    expect(result.value.projection.values[0]?.value).toBe(0)
  }
  active.value = false
  expect((await reader(caseRef, admitted.value)).status).toBe("denied")
})

test("host must verify references and cannot return a different principal or unlisted evidence", async () => {
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const payload = { viewId: "BI01", selectionRef: "actual-selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(payload))
  if (admitted.status !== "ok") throw new Error("admission failed")
  const state = { mode: "unverified" }
  const reader = createContextualBiSelectionReader({ approvedViews: [{ id: "BI01", version: 1, allowedFilters: [] }], readHumanSelection: async () => ({ status: "ok", value: { viewId: "BI01", version: 1, filters: [] } }), readArtifacts: async () => ({ status: "ok", value: state.mode === "principal" ? { ...artifacts, projection: { ...projection, context: { ...projection.context, principalRef: "other" } } } : state.mode === "evidence" ? { ...artifacts, projectionRefs: [{ ...ref, refId: "other" }] } : artifacts }), verifyArtifacts: async () => state.mode !== "unverified", revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) })
  expect(await reader(caseRef, admitted.value)).toEqual({ status: "denied", reason: "bi-artifacts-unavailable" })
  state.mode = "principal"
  expect(await reader(caseRef, admitted.value)).toEqual({ status: "denied", reason: "bi-context-mismatch" })
  state.mode = "evidence"
  expect(await reader(caseRef, admitted.value)).toEqual({ status: "unavailable", reason: "bi-evidence-unavailable" })
})

test("stored contextual selection reopens both references and detects a changed human choice", async () => {
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const payload = { viewId: "BI01", selectionRef: "actual-selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(payload))
  if (admitted.status !== "ok") throw new Error("admission failed")
  expect(await ui.validate(admitted.value, "sf_bi_view", digestSfValue(payload))).toBe(true)
  const selection = { viewId: "BI01" as const, version: 3, filters: [{ field: "department", values: ["IT"] }] }
  const artifact: SfBiArtifact = { schemaVersion: 1, id: "artifact", incarnation: "inc", version: 1, caseRef, selection, dashboardSelection: { selectionRef: "actual-selection", period, fields: ["budgetMetrics"] }, period, projectionRef: "actual-projection", tableRef: "actual-table", projection, projectionDigest: digestSfValue(projection), presentation: { viewId: "BI01", series: [], limitations: [] }, rows: projection.values, tableDigest: "table-digest", projectionRefs: [ref], sourceRefs: [ref], sourceFenceDigest: "fence", binding: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v" }, createdAt: "2026-11-13T00:00:00Z" }
  const state = { reads: 0, choiceReads: 0, changeChoice: false, differentTable: false }
  const reader = createStoredContextualBiSelectionReader({
    approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }],
    readHumanChoice: async () => { state.choiceReads++; return { status: "ok", value: { selection: state.changeChoice && state.choiceReads > 1 ? { ...selection, filters: [{ field: "department", values: ["HR"] }] } : selection, projectionRef: artifact.projectionRef, tableRef: artifact.tableRef } } },
    readArtifact: async (reference) => { state.reads++; return reference === artifact.projectionRef || reference === artifact.tableRef ? { status: "ok", value: state.differentTable && reference === artifact.tableRef ? { ...artifact, version: 2 } : artifact } : { status: "unavailable", reason: "unknown-reference" } },
    revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  })
  expect((await reader(caseRef, admitted.value)).status).toBe("ok")
  expect(state.reads).toBe(4)
  state.differentTable = true
  expect((await reader(caseRef, admitted.value)).status).toBe("unavailable")
  state.differentTable = false
  state.changeChoice = true
  state.choiceReads = 0
  expect(await reader(caseRef, admitted.value)).toEqual({ status: "denied", reason: "bi-artifacts-unavailable" })
})
