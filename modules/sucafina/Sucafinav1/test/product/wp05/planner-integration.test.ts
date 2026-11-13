import { expect, test } from "bun:test"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { bindPlannerBiPort, createPlannerBiSource } from "../../../product/analytics/planner.ts"
import { createBiDescriptor, readBiPresentation } from "../../../product/analytics/capabilities.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SfDomainValidation } from "../../../product/contracts/runtime.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { testPersistence } from "../../fixture/persistence.ts"

const period = { start: "2027-01-01", end: "2027-12-31" }
const actor = { id: "finance", roles: ["finance"], canWrite: true, assigned: [], domains: [] }
const initial = (): Snapshot => ({ data: { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [72000, 84000].map((license, index) => ({ id: `v${index}`, year: 2027, closed: 9, lines: [{ id: "line", sec: "opex", el: "licenses", cur: "USD", b: [40000, 45000, 45000, 50000, 50000, 50000, 50000, 50000, 50000, 50000, 60000, 60000], a: [null, 0, 45000, 45000, 45000, 45000, 45000, 45000, 50000, null, null, null], f: [null, null, null, null, null, null, null, null, null, 38000, 40000 + license, 40000] }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} })) }, versions: {}, sequences: {}, audit: [], notices: [] })

test("real planner projection reaches BI with distinct missing and zero values", async () => {
  const storage = testPersistence({ planner: initial() })
  const refs = ["v0", "v1"].map((id): Extract<BusinessEvidenceRef, { kind: "record" }> => {
    const projection = projectPlannerSource(storage.state.planner, actor, id)!
    const ref: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: id, installationId: "i", projectId: "p", refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: id, incarnation: `inc-${id}`, version: 1, fields: Object.keys(projection), period, projectionDigest: digestSfValue({ versionId: id, projection }) } }
    ref.refDigest = digestSfEvidenceRef(ref)
    return ref
  })
  const ids = { count: 0 }
  const ui = createSfUiAuthority({ authorize: async () => ({ installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: "1" }), commandIdentity: async () => "command", createId: () => `request-${++ids.count}`, now: () => Date.parse("2026-11-13T00:00:00Z") })
  const request = { viewId: "BI01", selectionRef: "selection", period }
  const admitted = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  expect(admitted.status).toBe("ok")
  if (admitted.status !== "ok") return
  const context = admitted.value
  expect(await ui.validate(context, "sf_bi_view", digestSfValue(request))).toBe(true)
  const authority: SfDomainValidation = {
    validateDomainContext: async (input, operation, digest) => input.kind === "ui" && await ui.validate(input, operation, digest),
    revalidateDomainContext: async (input) => input.kind === "ui" && await ui.revalidate(input),
    receiptFor: (input, operation, digest, resultDigest) => input.kind === "ui" ? ui.receiptFor(input, operation, digest, resultDigest) : undefined,
  }
  const observations = { count: 0 }
  const planner = createPlannerPort({
    host: { persistence: storage.persistence, authenticate: async (_request, input) => resolve("finance", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => ({ at: new Date(Date.parse("2026-11-13T00:00:00Z") + ++observations.count * 1000).toISOString(), id: () => "unused", directory: [] }), requestFor: (input) => input.kind === "ui" ? ui.requestFor(input) : undefined, revalidate: async (input) => input.kind === "ui" && await ui.revalidate(input) },
    sources: { resolveForecastSource: async (id) => { const ref = refs.find((item) => item.refId === id); return ref ? { status: "ok", value: { versionId: id, evidence: ref } } : { status: "unavailable", reason: "missing" } }, resolveForecastCoverage: async () => ({ status: "unavailable", reason: "missing" }) },
  })
  const host = bindPlannerBiPort({ planner, resolve: async () => ({ status: "ok", value: { comparison: { baseRef: "v0", candidateRef: "v1", period, currency: "USD" }, side: "candidate", present: () => ({ viewId: "BI01", series: [{ id: "actual", label: "Actual", role: "actual", unit: "USD", valueIds: ["line:1:actual", "line:2:actual"] }], limitations: [] }) } }), revalidate: async (_request, input) => input.kind === "ui" && await ui.revalidate(input) })
  const result = await readBiPresentation(request, context, createPlannerBiSource(host), authority)
  expect(result.status).toBe("ok")
  if (result.status !== "ok") return
  const values = result.value.projection.values
  expect(values.find((value) => value.id === "line:1:actual")?.value).toBeNull()
  expect(values.find((value) => value.id === "line:2:actual")?.value).toBe(0)
  expect(observations.count).toBeGreaterThan(1)
  expect(result.value.presentation.series[0]?.valueIds).toEqual(["line:1:actual", "line:2:actual"])
  expect(values.find((value) => value.id === "line:2:actual")?.drilldown?.refId).toBe("v1")
  const second = await ui.admit(new Request("https://example.test"), "sf_bi_view", digestSfValue(request))
  expect(second.status).toBe("ok")
  if (second.status !== "ok") return
  const dispatchContext = second.value
  const dispatch = () => dispatchSfCapability({ operation: "sf_bi_view", payload: request, context: dispatchContext, descriptors: [createBiDescriptor(createPlannerBiSource(host), authority)], authority, validateInput: (_descriptor, payload) => decodeSfOperationInput("sf_bi_view", payload).ok, validateOutput: (_descriptor, output) => output.status !== "ok" || decodeSfOperationOutput("sf_bi_view", output.result).ok })
  const capability = await dispatch()
  expect(capability.status).toBe("ok")
  if (capability.status === "ok") {
    expect(capability.receipt.handlerExport).toBe("readBiView")
    const output = decodeSfOperationOutput("sf_bi_view", capability.result)
    expect(output.ok).toBe(true)
    if (output.ok) expect(output.value.values.find((value) => value.id === "line:2:actual")?.value).toBe(0)
  }
  expect((await dispatch()).status).toBe("denied")
})
