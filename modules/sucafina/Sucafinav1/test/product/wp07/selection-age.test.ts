import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ProductContext, SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { projectProcurementSource } from "../../../product/procurement/port.ts"
import { createReviewAgendaSelection } from "../../../product/reviews/selection.ts"
import type { ReviewAgendaPorts } from "../../../product/reviews/selection.ts"

const period = { start: "2026-11-01", end: "2026-11-30" }
const context = { kind: "ui", binding: { principalRef: "reviewer", installationId: "installation", projectId: "project", accessRevision: "1", policyVersion: "1" } } as TrustedDomainContext

function fixture() {
  const state = { at: "2026-11-14T00:00:00Z", allowed: true, version: 1, status: "pr_pending", enteredAt: "2026-11-13T00:00:00Z" }
  const project = () => {
    const record = { number: "REQ-1", status: state.status, subject: "Coffee contract", history: [{ at: state.enteredAt, action: "Requisition submitted for approval" }], prApproval: { steps: [{ status: "pending", levelName: "Level 1", holder: "buyer" }] } }
    const source: SourceRef = { surface: "procurement", type: "requests", id: "REQ-1", incarnation: "request-inc", version: state.version, fields: ["status", "stageEnteredAt", "ageDays"], period, observedAt: state.at }
    const draft: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "request-evidence", installationId: "installation", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "procurement", recordType: "requests", recordId: "REQ-1", incarnation: "request-inc", version: state.version, fields: source.fields, period, projectionDigest: digestSfValue(record) } }
    const evidence = { ...draft, refDigest: digestSfEvidenceRef(draft) }
    const productContext: ProductContext = { ...context.binding, surface: "procurement", period, currency: "USD", sourceRefs: [source], capabilities: [] }
    return projectProcurementSource(record, productContext, evidence, state.at)
  }
  const ports = { procurement: { read: async () => ({ status: "ok" as const, value: project() }) } } as ReviewAgendaPorts
  const agenda = createReviewAgendaSelection({ ports, revalidate: async () => state.allowed, now: () => state.at })
  return { state, project, agenda }
}

test("a Request can be preserved after its stage age advances without changing the captured age", async () => {
  const f = fixture()
  const created = await f.agenda.create([{ id: "request", kind: "procurement-request", title: "Request", period, requestRef: "request-evidence" }], context)
  if (created.status !== "ok") throw new Error(created.reason)
  expect(created.value.sections[0]?.projection.values.find((value) => value.id === "ageDays")?.value).toBe(1)
  f.state.at = "2026-11-14T00:05:00Z"
  expect(f.project().values.find((value) => value.id === "ageDays")?.value).toBeGreaterThan(1)
  const selected = await f.agenda.select(created.value.selectionRef, ["request"], context, period)
  if (selected.status !== "ok") throw new Error(selected.reason)
  expect(selected.value[0]).toEqual(created.value.sections[0])
  expect(selected.value[0]?.projection.values.find((value) => value.id === "ageDays")?.value).toBe(1)
  f.state.allowed = false
  expect((await f.agenda.select(created.value.selectionRef, ["request"], context)).status).toBe("denied")
})

test.each(["stage", "status", "missing-age"])("a material %s change still invalidates the Request selection", async (change) => {
  const f = fixture()
  const created = await f.agenda.create([{ id: "request", kind: "procurement-request", title: "Request", period, requestRef: "request-evidence" }], context)
  if (created.status !== "ok") throw new Error(created.reason)
  if (change === "stage") f.state.enteredAt = "2026-11-13T01:00:00Z"
  if (change === "status") f.state.status = "src_pending"
  if (change === "missing-age") f.state.enteredAt = "not-a-date"
  expect((await f.agenda.select(created.value.selectionRef, ["request"], context)).status).toBe("stale")
})
