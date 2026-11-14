import { randomUUID } from "node:crypto"
import { object, rows } from "../../../../runtime/contract.ts"
import type { DomainProjection, PreservedReview } from "../../../../product/contracts/context.ts"
import type { ThreadSourceContext } from "../../../../product/collaboration/thread-context.ts"
import { reviewProjectionEvidence } from "../../../../product/reviews/port.ts"
import { createRecoveryFixture } from "../../wp02/workbench-recovery-fixture.ts"

export const meetingPeriod = { start: "2026-01-01", end: "2026-12-31" }

/** Reuse the installed Dashboard fixture and its actual HTTP, C08, source
 * lifecycle and review reader. Only the initial business records are seeded. */
export async function createMeetingFixture() {
  const fixture = await createRecoveryFixture()
  try {
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.opexOwners = [{ id: "ui-review-owner", name: "Preserved Operations", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "ui-review-january", ownerId: "ui-review-owner", year: 2026, month: 1, budget: 200, actual: 0, forecast: 200 }]
      snapshot.data.capexProjects = []
      snapshot.data.capexEntries = []
      return { commit: true, value: undefined }
    })
    const cookie = fixture.request().headers.get("cookie")!
    const post = (mode: string, payload: unknown) => fetch(`${fixture.origin}/sucafina/dashboard?sf=${mode}`, {
      method: "POST", headers: { cookie, origin: fixture.origin, "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify(payload),
    })
    const discovered = await ok(await post("dashboard-workbench", { page: "Budget Overview", period: meetingPeriod }))
    const preview = await ok(await post("dashboard-agenda", { sections: [object(discovered.agenda).section] }))
    const receipt = await ok(await post("dashboard-review-preserve", { selectionRef: preview.selectionRef, sectionRefs: rows(preview.sections).map((section) => section.id) }))
    if (typeof receipt.id !== "string") throw new Error("Real WholeReview identity missing")
    const reviewId = receipt.id
    const original = await fixture.read((context) => fixture.dashboard.readReview(reviewId, context))
    if (original.status !== "ok") throw new Error(`Real WholeReview read failed: ${original.reason}`)
    const historyUrl = new URL(`${fixture.origin}/sucafina/dashboard`)
    historyUrl.searchParams.set("sf", "dashboard-review")
    historyUrl.searchParams.set("id", reviewId)
    const changeBudget = () => fetch(`${fixture.origin}/sucafina/dashboard?page=OPEX+Detail&year=2026`, {
      method: "POST", headers: { cookie, origin: fixture.origin, "content-type": "application/json" },
      body: JSON.stringify({ page: "OPEX Detail", action: "save", id: "ui-review-owner", version: 0, values: { name: "Preserved Operations", budget: 2400 } }),
    })
    const stored = () => fixture.authority.state.read(fixture.request(), "reviews", (state) => ({
      reviews: structuredClone(state.reviews),
      receipts: Object.values(state.transactions).filter((entry) => entry.namespace === "reviews").length,
    }))
    return { ...fixture, cookie, post, historyUrl, changeBudget, stored, original: original.value }
  } catch (error) { await fixture.close(); throw error }
}

export function meetingTotal(review: PreservedReview) {
  const projection = object(review.sections[0]?.content)
  const values = rows(projection.values).filter((value) => value.id === "budgetMetrics.2026.totalBudget")
  if (review.sections.length !== 1 || values.length !== 1) throw new Error("Real financial meeting projection missing")
  return values[0]!.value
}

export function meetingBasis(review: PreservedReview): ThreadSourceContext {
  const section = review.sections[0]
  if (!section) throw new Error("Real preserved section missing")
  const source = reviewProjectionEvidence(section.content as DomainProjection).find((ref) => ref.kind === "record" &&
    ref.target.period?.start === meetingPeriod.start && ref.target.period.end === meetingPeriod.end && ref.target.version > 0)
  if (!source || source.kind !== "record") throw new Error("Real C17 record basis missing from preserved section")
  return { sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version,
    period: section.period, evidenceRefs: [source] }
}

async function ok(response: Response) {
  const result = object(await response.json())
  if (!response.ok || result.status !== "ok") throw new Error(`Real meeting setup failed: ${response.status} ${String(result.reason)}`)
  return object(result.value)
}
