import { expect, test } from "bun:test"
import { createContextualBiSelectionReader, createStoredContextualBiSelectionReader } from "../../../product/analytics/contextual.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfBiArtifact } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const caseRef = { id: "case", incarnation: "inc", version: 2 }
const ref: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "source", installationId: "i", projectId: "p", refDigest: "source-digest", evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "dashboard-page", recordId: "budget", incarnation: "page-inc", version: 1, fields: ["budgetMetrics"], period, projectionDigest: "projection-digest" } }
const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "engine", components: [], missing: [], values: [{ id: "value", value: 0, unit: "USD", currency: "USD", period, granularity: "year", sourceRefs: [ref], drilldown: ref, evidenceState: "confirmed" }] }
const artifacts = { dashboardSelection: { selectionRef: "actual-selection", period, fields: ["budgetMetrics"] }, projectionRefs: [ref], projection, canonicalProjectionRefs: ["actual-projection"], tableRef: "actual-table" }

test("contextual BI preserves the complete DashboardReadRequest and rejects missing fields", async () => {
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const request = { viewId: "BI01", selectionRef: "actual-selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  expect(await ui.validate(admitted.value, "sf_bi_view", digestSfValue(request))).toBe(true)
  const state = { omitFields: false }
  const reader = createContextualBiSelectionReader({ approvedViews: [{ id: "BI01", version: 1, allowedFilters: [] }], readHumanSelection: async () => ({ status: "ok", value: { viewId: "BI01", version: 1, filters: [] } }),
    readArtifacts: async () => ({ status: "ok", value: state.omitFields ? { ...artifacts, dashboardSelection: { selectionRef: "actual-selection", period } as typeof artifacts.dashboardSelection } : artifacts }),
    verifyArtifacts: async () => true, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  })
  const result = await reader(caseRef, admitted.value)
  expect(result.status).toBe("ok")
  if (result.status === "ok") expect(result.value.dashboardSelection).toEqual(artifacts.dashboardSelection)
  state.omitFields = true
  expect(await reader(caseRef, admitted.value)).toEqual({ status: "unavailable", reason: "bi-dashboard-selection-invalid" })
})

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

test("contextual readers keep the original case while initial authority validation is pending", async () => {
  for (const stored of [false, true]) {
    const admitted = await contextualAuthority()
    const selectedCase = structuredClone(caseRef)
    const observed: typeof caseRef[] = []
    const artifact = contextualArtifact()
    let release!: () => void
    const gate = new Promise<void>((resolve) => { release = resolve })
    let checks = 0
    const revalidate: typeof admitted.revalidate = async (context) => {
      if (++checks === 1) await gate
      return admitted.revalidate(context)
    }
    const reader = stored ? createStoredContextualBiSelectionReader({
      approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }],
      readHumanChoice: async (received) => {
        observed.push(structuredClone(received))
        return { status: "ok", value: { selection: artifact.selection, projectionRef: artifact.projectionRef, tableRef: artifact.tableRef } }
      },
      readArtifact: async () => ({ status: "ok", value: artifact }),
      revalidate,
    }) : createContextualBiSelectionReader({
      approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }],
      readHumanSelection: async (received) => {
        observed.push(structuredClone(received))
        return { status: "ok", value: artifact.selection }
      },
      readArtifacts: async () => ({ status: "ok", value: artifacts }),
      verifyArtifacts: async (received) => { observed.push(structuredClone(received)); return true },
      revalidate,
    })
    const pending = reader(selectedCase, admitted.context)
    selectedCase.id = "other-case"
    selectedCase.incarnation = "replaced"
    selectedCase.version = 999
    release()
    expect((await pending).status).toBe("ok")
    expect(observed.length).toBeGreaterThanOrEqual(2)
    expect(observed.every((received) => digestSfValue(received) === digestSfValue(caseRef))).toBe(true)
  }
})

test("selection callbacks cannot change the case they are authorizing", async () => {
  for (const stored of [false, true]) {
    const admitted = await contextualAuthority()
    const selectedCase = structuredClone(caseRef)
    const artifact = contextualArtifact()
    const reader = stored ? createStoredContextualBiSelectionReader({
      approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }],
      readHumanChoice: async (received) => {
        received.version = 999
        return { status: "ok", value: { selection: artifact.selection, projectionRef: artifact.projectionRef, tableRef: artifact.tableRef } }
      },
      readArtifact: async () => ({ status: "ok", value: artifact }),
      revalidate: admitted.revalidate,
    }) : createContextualBiSelectionReader({
      approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }],
      readHumanSelection: async (received) => { received.version = 999; return { status: "ok", value: artifact.selection } },
      readArtifacts: async () => ({ status: "ok", value: artifacts }),
      verifyArtifacts: async () => true,
      revalidate: admitted.revalidate,
    })
    expect(await reader(selectedCase, admitted.context)).toEqual({ status: "denied", reason: "bi-case-changed" })
    expect(selectedCase).toEqual(caseRef)
  }
})

test("stored selection detects a projection changed while its table reference is opening", async () => {
  const admitted = await contextualAuthority()
  const artifact = contextualArtifact()
  const reader = createStoredContextualBiSelectionReader({
    approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }],
    readHumanChoice: async () => ({ status: "ok", value: { selection: artifact.selection, projectionRef: artifact.projectionRef, tableRef: artifact.tableRef } }),
    readArtifact: async (reference) => {
      if (reference === artifact.tableRef) {
        artifact.projection.values[0]!.value = 999
        artifact.projectionDigest = digestSfValue(artifact.projection)
      }
      return { status: "ok", value: artifact }
    },
    revalidate: admitted.revalidate,
  })
  expect(await reader(caseRef, admitted.context)).toEqual({ status: "unavailable", reason: "bi-selection-unavailable" })
})

test("artifact verification cannot mutate a caller's case or authorize a different case", async () => {
  const admitted = await contextualAuthority()
  const selectedCase = structuredClone(caseRef)
  const reader = createContextualBiSelectionReader({
    approvedViews: [{ id: "BI01", version: 1, allowedFilters: [] }],
    readHumanSelection: async () => ({ status: "ok", value: { viewId: "BI01", version: 1, filters: [] } }),
    readArtifacts: async () => ({ status: "ok", value: artifacts }),
    verifyArtifacts: async (received) => { received.id = "different-case"; return true },
    revalidate: admitted.revalidate,
  })
  expect(await reader(selectedCase, admitted.context)).toEqual({ status: "denied", reason: "bi-artifacts-unavailable" })
  expect(selectedCase).toEqual(caseRef)
})

async function contextualAuthority() {
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "u", policyVersion: "v", accessRevision: "a" }), commandIdentity: async () => "command", createId: () => "request", now: () => Date.parse("2026-11-13T00:00:00Z") })
  const request = { viewId: "BI01", selectionRef: "actual-selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  if (admitted.status !== "ok") throw new Error(admitted.reason)
  expect(await ui.validate(admitted.value, "sf_bi_view", digestSfValue(request))).toBe(true)
  return { context: admitted.value, revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }
}

function contextualArtifact(): SfBiArtifact {
  return structuredClone({
    schemaVersion: 1, id: "artifact", incarnation: "inc", version: 1, caseRef,
    selection: { viewId: "BI01", version: 3, filters: [{ field: "department", values: ["IT"] }] },
    dashboardSelection: { selectionRef: "actual-selection", period, fields: ["budgetMetrics"] }, period,
    projectionRef: "actual-projection", tableRef: "actual-table", projection, projectionDigest: digestSfValue(projection),
    presentation: { viewId: "BI01", series: [], limitations: [] }, rows: projection.values, tableDigest: "table-digest",
    projectionRefs: [ref], sourceRefs: [ref], sourceFenceDigest: "fence",
    binding: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v" },
    createdAt: "2026-11-13T00:00:00Z",
  })
}

test("verification callbacks cannot mutate contextual evidence after successful delivery", async () => {
  const admitted = await contextualAuthority()
  let change!: () => void
  const reader = createContextualBiSelectionReader({
    approvedViews: [{ id: "BI01", version: 3, allowedFilters: ["department"] }],
    readHumanSelection: async () => ({ status: "ok", value: { viewId: "BI01", version: 3, filters: [{ field: "department", values: ["IT"] }] } }),
    readArtifacts: async () => ({ status: "ok", value: artifacts }),
    verifyArtifacts: async (received, selection, actual) => {
      change = () => {
        received.id = "different-case"
        selection.filters[0]!.field = "secret"
        actual.projectionRefs[0]!.refId = "changed-source"
        actual.tableRef = "different-table"
        actual.canonicalProjectionRefs = ["different-projection"]
        actual.projectionRefs = []
        actual.projection.values[0]!.value = 999
      }
      return true
    },
    revalidate: admitted.revalidate,
  })
  const result = await reader(caseRef, admitted.context)
  expect(result.status).toBe("ok")
  const delivered = structuredClone(result)
  change()
  expect(result).toEqual(delivered)
})
