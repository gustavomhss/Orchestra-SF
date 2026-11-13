import { expect, test } from "bun:test"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { compareReviews } from "../../../product/reviews/compare.ts"
import { createReviewComparisonPort } from "../../../product/reviews/comparison-port.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const context = { kind: "ui", binding: { principalRef: "principal", installationId: "install", projectId: "project", accessRevision: "access", policyVersion: "policy" } } as unknown as TrustedDomainContext

function value(id: string, recordId: string, amount: string | number | null, field = "forecast", incarnation = "original"): DomainProjection["values"][number] {
  const evidence: BusinessEvidenceRef = { schema: "sf-evidence-v1", refId: `source:${recordId}:${field}`, installationId: "install", projectId: "project", refDigest: "a".repeat(64), evidenceLevel: "observed", kind: "record", target: { surface: "dashboard", recordType: "projects", recordId, incarnation, version: 1, fields: [field], period, projectionDigest: "b".repeat(64) } }
  return { id, value: amount, currency: typeof amount === "number" ? "USD" : undefined, unit: typeof amount === "number" ? "USD" : undefined, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: amount === null ? "absent" : "confirmed" }
}

function review(id: string, values: readonly DomainProjection["values"][number][], previousReviewRef?: string): PreservedReview {
  const projection: DomainProjection = { version: 1, engineVersion: "v1", context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] }, components: [], values, missing: [] }
  return { id, version: 1, createdAt: "2026-11-13T00:00:00Z", sourceRefs: [], comments: [], sections: [{ id: "projects", title: "Projects", period, count: values.length, sourceRefs: [], content: projection }], ...(previousReviewRef ? { previousReviewRef } : {}) }
}

test("comparison follows unambiguous record identity across a row rename and retains removals, status and due changes", () => {
  const before = review("first", [value("forecast-old", "one", 1320), value("removed", "removed", 40), value("status", "one", "open", "status"), value("due", "one", "2026-11-01", "due")])
  const after = review("second", [value("forecast-renamed", "one", 1400), value("status", "one", "done", "status"), value("due", "one", "2026-11-30", "due")], "first")
  const compared = compareReviews(before, after)
  expect(compared.state).toBe("compared")
  expect(compared.changes).toHaveLength(4)
  expect(compared.changes).toEqual(expect.arrayContaining([
    expect.objectContaining({ kind: "changed", delta: 80, before: expect.objectContaining({ id: "forecast-old", value: 1320 }), after: expect.objectContaining({ id: "forecast-renamed", value: 1400 }) }),
    expect.objectContaining({ kind: "removed", before: expect.objectContaining({ id: "removed" }) }),
    expect.objectContaining({ kind: "changed", before: expect.objectContaining({ value: "open" }), after: expect.objectContaining({ value: "done" }) }),
    expect.objectContaining({ kind: "changed", before: expect.objectContaining({ value: "2026-11-01" }), after: expect.objectContaining({ value: "2026-11-30" }) }),
  ]))
  expect(JSON.stringify(before)).toContain("1320")
})

test("replacement, unit, currency, period and missing values never produce an invented monetary delta", () => {
  const original = value("forecast", "one", 1320)
  const before = review("first", [original])
  for (const changed of [
    value("forecast", "one", 1400, "forecast", "replacement"),
    { ...original, value: 1400, currency: "BRL" },
    { ...original, value: 1400, unit: "hours" },
    { ...original, value: 1400, period: { start: "2027-01-01", end: "2027-12-31" } },
  ]) {
    const compared = compareReviews(before, review("second", [changed], "first"))
    expect(compared.changes).toHaveLength(1)
    expect(compared.changes[0]?.kind).toBe("incompatible")
    expect(compared.changes[0]).not.toHaveProperty("delta")
  }
  const absent = { ...original, value: null, evidenceState: "absent" as const }
  const zero = { ...original, value: 0 }
  const missing = compareReviews(review("first", [absent]), review("second", [zero], "first"))
  expect(missing.changes[0]).toMatchObject({ kind: "changed", before: { value: null }, after: { value: 0 } })
  expect(missing.changes[0]).not.toHaveProperty("delta")
})

test("comparison reader exposes a canonical forwarding separately and removes all content on access revocation", async () => {
  const previous = review("first", [value("forecast", "one", 1320)])
  const current = review("second", [value("forecast", "one", 1400)], "first")
  const topic = { id: "canonical-action", version: 1, action: "Confirm forecast", owner: "Owner", due: "2026-11-30", status: "open", priority: "normal", notes: "" }
  const sourceRef = value("forecast", "one", 1320).sourceRefs[0]!
  const access = { calls: 0, revokeOnFinalRead: false }
  const port = createReviewComparisonPort({
    host: { revalidate: async () => true },
    reviews: { read: async (ref) => {
      access.calls++
      if (access.revokeOnFinalRead && access.calls > 2) return { status: "denied", reason: "restricted" }
      return { status: "ok", value: ref === previous.id ? previous : current }
    } },
    closures: { listByReview: async (reviewRef) => ({ status: "ok", value: { coverage: "complete", limitations: [], entries: reviewRef === previous.id ? [{ review: previous, currentAction: { ...topic, version: 2, status: "done" }, closure: { kind: "sf-review-action-v1", id: `review-closure:${"a".repeat(64)}`, reviewRef, reviewDigest: "b".repeat(64), principalRef: "principal", relationId: "same-relation", topic, handoff: { sourceRef: sourceRef.refId, relationKey: "same-relation", intent: { correlationKey: "same-action", sourceRefs: [sourceRef], action: topic.action, owner: topic.owner, due: topic.due, priority: "normal", notes: "" } } } }] : [] } }) },
  })
  const compared = await port.read("second", context)
  expect(compared).toMatchObject({ status: "ok", value: { comparison: { changes: [{ delta: 80 }] }, forwardingCoverage: "complete", forwardings: [{ relationId: "same-relation", preservedAction: { id: "canonical-action", status: "open" }, currentAction: { id: "canonical-action", status: "done" } }] } })
  access.calls = 0
  access.revokeOnFinalRead = true
  const denied = await port.read("second", context)
  expect(denied.status).toBe("denied")
  expect(denied).not.toHaveProperty("value")
  expect(JSON.stringify(denied)).not.toContain("Confirm forecast")
})

test("first review and an unavailable referenced predecessor have different states", async () => {
  const first = review("first", [value("forecast", "one", 1320)])
  const later = review("later", [value("forecast", "one", 1400)], "missing")
  const port = createReviewComparisonPort({ host: { revalidate: async () => true }, reviews: { read: async (ref) => ref === "missing" ? { status: "denied", reason: "restricted" } : { status: "ok", value: ref === "first" ? first : later } } })
  expect(await port.read("first", context)).toMatchObject({ status: "ok", value: { comparison: { state: "first-review", changes: [] }, forwardingCoverage: "unavailable" } })
  expect(await port.read("later", context)).toMatchObject({ status: "ok", value: { comparison: { state: "unavailable", changes: [] }, forwardings: [] } })
})
