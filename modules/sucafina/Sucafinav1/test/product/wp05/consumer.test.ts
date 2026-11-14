import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { dispatchBiPresentation, readBiDestination } from "../../../product/analytics/consumer.ts"
import { createBiDescriptor, readBiView } from "../../../product/analytics/capabilities.ts"
import type { BiPresentationPort } from "../../../product/analytics/capabilities.ts"
import { presentProjection } from "../../../product/analytics/catalog.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }

function fixture() {
  const active = { value: true }
  const ui = createSfUiAuthority({ authorize: async () => active.value ? { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "1", accessRevision: "1" } : undefined, commandIdentity: async () => "command", createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z") })
  const authority: SfDomainValidation = {
    validateDomainContext: (context, operation, digest) => context.kind === "ui" ? ui.validate(context, operation, digest) : Promise.resolve(false),
    revalidateDomainContext: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
    receiptFor: (context, operation, digest, output) => context.kind === "ui" ? ui.receiptFor(context, operation, digest, output) : undefined,
  }
  const reference: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: "exact-record", installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v1", incarnation: "record-inc", version: 2, fields: ["fte"], period, projectionDigest: digestSfValue({ fte: 0 }) } }
  reference.refDigest = digestSfEvidenceRef(reference)
  const projection: DomainProjection = { context: { installationId: "i", projectId: "p", principalRef: "u", policyVersion: "1", accessRevision: "1", surface: "planner", period, currency: "USD", sourceRefs: [], capabilities: [] }, version: 2, engineVersion: "fixture-adapter-v1", components: [], missing: [], values: [{ id: "fte", value: 0, unit: "fte", period, granularity: "year", sourceRefs: [reference], drilldown: reference, evidenceState: "confirmed" }] }
  const request = { viewId: "BI04", selectionRef: "authorized-selection", period }
  const source: BiPresentationPort = { read: async () => ({ status: "ok", value: projection }), revalidate: (_request, context) => authority.revalidateDomainContext(context), describe: async () => ({ status: "ok", value: { viewId: "BI04", series: [{ id: "capacity", label: "Capacity", unit: "fte", role: "fte", valueIds: ["fte"] }], limitations: ["Adapter fixture; no host or native-execution claim."] } }) }
  const admit = async () => {
    const result = await ui.admit(new Request("https://example.test/bi"), "sf_bi_view", digestSfValue(request))
    if (result.status !== "ok") throw new Error(result.reason)
    return result.value
  }
  return { active, ui, authority, reference, projection, request, source, admit }
}

test("consumer goes through the real UI lease and dispatcher, rejects direct calls and reuse", async () => {
  const f = fixture()
  const context = await f.admit()
  expect((await createBiDescriptor(f.source, f.authority).handler(f.request, context)).status).toBe("denied")
  const result = await dispatchBiPresentation(f.request, context, f.source, f.authority)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(result.reason)
  expect(result.value.projection).toEqual(f.projection)
  expect(result.value.projection.values[0]?.value).toBe(0)
  expect(result.value.receipt.resultDigest).toBe(digestSfValue(result.value.projection))
  expect((await dispatchBiPresentation(f.request, context, f.source, f.authority)).status).toBe("denied")
  expect((await dispatchBiPresentation(f.request, structuredClone(context), f.source, f.authority)).status).toBe("denied")
})

test("exact mark destination revalidates identity, version and C17 evidence without a collection fallback", async () => {
  const f = fixture()
  const selection = presentProjection(f.projection, f.request.selectionRef).rows[0]!.selection
  const seen: BusinessEvidenceRef[] = []
  const resolution: BusinessEvidenceResolution = { state: "fresh", ref: f.reference, authorizedProjection: f.projection, accessRevision: "1", checkedAt: "2026-11-13T00:00:00Z" }
  const business = { resolve: async (reference: BusinessEvidenceRef) => { seen.push(reference); return resolution } }
  const opened = await readBiDestination({ request: f.request, selection, context: await f.admit(), source: f.source, authority: f.authority, business })
  expect(opened.status).toBe("ok")
  expect(seen).toEqual([f.reference])
  if (opened.status !== "ok") throw new Error(opened.reason)
  expect(opened.value.selection).toEqual(selection)
  expect(opened.value.source.authorizedProjection).toEqual(f.projection)
  for (const altered of [{ ...selection, projectionVersion: 1 }, { ...selection, engineVersion: "other" }, { ...selection, valueId: "other" }, { ...selection, reference: { ...f.reference, refId: "collection-overview" } }]) {
    expect((await readBiDestination({ request: f.request, selection: altered, context: await f.admit(), source: f.source, authority: f.authority, business })).status).not.toBe("ok")
  }
  expect(seen).toHaveLength(1)
  for (const visualPeriod of [{ start: "2026-12-31", end: "2027-01-31" }, { start: "2027-02-01", end: "2027-01-01" }, { start: "2027-01-01", end: "2028-01-01" }]) {
    expect(await readBiDestination({ request: f.request, selection: { ...selection, visualPeriod }, context: await f.admit(), source: f.source, authority: f.authority, business })).toEqual({ status: "unavailable", reason: "selection-visual-period-invalid" })
  }
  expect(seen).toHaveLength(1)
  for (const state of ["historical", "replaced", "revoked", "missing"] as const) {
    const result = await readBiDestination({ request: f.request, selection, context: await f.admit(), source: f.source, authority: f.authority, business: { resolve: async () => ({ ...resolution, state }) } })
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  }
})

test("checked projections reject a mutating host fence and access is fenced at egress", async () => {
  const f = fixture()
  const context = await f.admit()
  expect(await f.ui.validate(context, "sf_bi_view", digestSfValue(f.request))).toBe(true)
  const source: BiPresentationPort = { ...f.source, revalidate: async (_request, _context, checked) => {
    if (checked) { checked.context.currency = "EUR"; f.projection.context.currency = "EUR" }
    return true
  } }
  const result = await readBiView(f.request, context, source, f.authority)
  expect(result).toEqual({ status: "denied", reason: "access-changed" })
  expect(result).not.toHaveProperty("value")
  const revoked = { ...f.source, describe: async () => { f.active.value = false; return { status: "ok" as const, value: { viewId: "BI04" as const, series: [], limitations: [] } } } }
  expect((await dispatchBiPresentation(f.request, await f.admit(), revoked, f.authority)).status).toBe("denied")
})

test("the final C17 fence cannot authorize a different selection or projection after evidence resolution", async () => {
  for (const target of ["selection", "projection"] as const) {
    const f = fixture()
    const selection = presentProjection(f.projection, f.request.selectionRef).rows[0]!.selection
    const resolved = { value: false }
    const source: BiPresentationPort = { ...f.source, revalidate: async (request, context, projection) => {
      if (resolved.value) {
        if (target === "selection") request.selectionRef = "different-selection"
        if (target === "projection" && projection) projection.version++
      }
      return f.authority.revalidateDomainContext(context)
    } }
    const result = await readBiDestination({ request: f.request, selection, context: await f.admit(), source, authority: f.authority, business: { resolve: async (reference) => {
      resolved.value = true
      return { state: "fresh", ref: reference, authorizedProjection: f.projection, accessRevision: "1", checkedAt: "2026-11-13T00:00:00Z" }
    } } })
    expect(resolved.value).toBe(true)
    expect(result).toEqual({ status: "denied", reason: "access-changed" })
    expect(result).not.toHaveProperty("value")
    expect(f.request.selectionRef).toBe("authorized-selection")
    expect(f.projection.version).toBe(2)
    expect(selection.projectionVersion).toBe(2)
  }
})

test("C17 fresh evidence cannot advertise a different current reference from the selected mark", async () => {
  const f = fixture()
  const selection = presentProjection(f.projection, f.request.selectionRef).rows[0]!.selection
  const changed = { ...f.reference, refId: "different-current-record" }
  changed.refDigest = digestSfEvidenceRef(changed)
  for (const currentRef of [f.reference, changed]) {
    const result = await readBiDestination({ request: f.request, selection, context: await f.admit(), source: f.source, authority: f.authority, business: { resolve: async () => ({ state: "fresh", ref: f.reference, currentRef, authorizedProjection: f.projection, accessRevision: "1", checkedAt: "2026-11-13T00:00:00Z" }) } })
    if (currentRef === f.reference) expect(result.status).toBe("ok")
    else {
      expect(result).toEqual({ status: "stale", reason: "selection-source-changed" })
      expect(result).not.toHaveProperty("value")
    }
  }
})

test("an explicit A or B origin must belong in full to the same current comparison row", async () => {
  const f = fixture()
  const sign = (reference: Extract<BusinessEvidenceRef, { kind: "record" }>) => ({ ...reference, refDigest: digestSfEvidenceRef(reference) })
  const second = sign({ ...structuredClone(f.reference), refId: "comparison-origin-B", target: { ...f.reference.target, recordId: "v2", incarnation: "record-B" } })
  const third = sign({ ...structuredClone(f.reference), refId: "different-row-origin", target: { ...f.reference.target, recordId: "v3", incarnation: "record-C" } })
  f.projection.values = [
    { ...f.projection.values[0]!, sourceRefs: [f.reference, second], drilldown: null },
    { ...f.projection.values[0]!, id: "other-row", sourceRefs: [third], drilldown: third },
  ]
  const base = presentProjection(f.projection, f.request.selectionRef).rows[0]!.selection
  expect(base.reference).toBeNull()
  const seen: BusinessEvidenceRef[] = []
  const business = { resolve: async (reference: BusinessEvidenceRef): Promise<BusinessEvidenceResolution> => {
    seen.push(reference)
    return { state: "fresh", ref: reference, currentRef: reference, authorizedProjection: f.projection, accessRevision: "1", checkedAt: "2026-11-13T00:00:00Z" }
  } }
  for (const reference of [f.reference, second]) {
    const selection = { ...base, reference }
    const result = await readBiDestination({ request: f.request, selection, context: await f.admit(), source: f.source, authority: f.authority, business })
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value.selection).toEqual(selection)
    expect(result.value.source.ref).toEqual(reference)
  }
  expect(seen).toEqual([f.reference, second])
  const alteredFields = sign({ ...structuredClone(second), target: { ...second.target, fields: ["another-field"] } })
  const alteredVersion = sign({ ...structuredClone(second), target: { ...second.target, version: second.target.version + 1 } })
  for (const selection of [base, { ...base, reference: third }, { ...base, reference: alteredFields }, { ...base, reference: alteredVersion }, { ...base, reference: second, valueId: "other-row" }, { ...base, reference: second, projectionVersion: base.projectionVersion + 1 }, { ...base, reference: second, engineVersion: "different-engine" }, { ...base, reference: second, selectionRef: "different-selection" }, { ...base, reference: second, context: { ...base.context, currency: "EUR" } }]) {
    const result = await readBiDestination({ request: f.request, selection, context: await f.admit(), source: f.source, authority: f.authority, business })
    expect(result.status).not.toBe("ok")
    expect(result).not.toHaveProperty("value")
  }
  expect(seen).toHaveLength(2)
  for (const change of ["revoke-source", "different-current-ref", "revoke-after-resolve"] as const) {
    const selection = { ...base, reference: second }
    const result = await readBiDestination({ request: f.request, selection, context: await f.admit(), source: f.source, authority: f.authority, business: { resolve: async (reference) => {
      if (change === "revoke-after-resolve") f.active.value = false
      return { state: change === "revoke-source" ? "revoked" : "fresh", ref: reference, currentRef: change === "different-current-ref" ? f.reference : reference, authorizedProjection: f.projection, accessRevision: "1", checkedAt: "2026-11-13T00:00:00Z" }
    } } })
    expect(result.status).toBe(change === "different-current-ref" ? "stale" : "denied")
    expect(result).not.toHaveProperty("value")
    f.active.value = true
  }
})

test("a new projection between dispatch and presentation is stale", async () => {
  const f = fixture()
  let reads = 0
  const source = { ...f.source, read: async () => ({ status: "ok" as const, value: { ...f.projection, version: ++reads } }) }
  expect(await dispatchBiPresentation(f.request, await f.admit(), source, f.authority)).toEqual({ status: "stale", reason: "projection-changed-before-presentation" })
})
