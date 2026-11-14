import { expect, test } from "bun:test"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { SourceRef } from "../../../product/contracts/context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createReviewAgendaSelection } from "../../../product/reviews/selection.ts"
import { createReviewPort } from "../../../product/reviews/port.ts"
import { createReviewHumanPort } from "../../../product/reviews/human.ts"
import { createReviewRoutinePreparation } from "../../../product/routines/review-host.ts"
import { createRoutinePlannerFixture, routineJanuary } from "./planner-review-fixture.ts"

test("routine review returns a real WP07 selection consumed by human preservation and immutable C05 reads", async () => {
  const fixture = await createRoutinePlannerFixture()
  try {
    const unavailable = async () => ({ status: "unavailable" as const, reason: "surface-not-selected" })
    const agenda = createReviewAgendaSelection({ ports: { planner: fixture.product.planner, procurement: { read: unavailable, readSupplier: unavailable, readContract: unavailable }, selectDashboardAgenda: unavailable }, revalidate: fixture.host.revalidate, now: () => fixture.at })
    // A historical C05 source stays readable only while its real producer authorizes the same incarnation.
    const sourceAccess = async (refs: readonly SourceRef[], context: TrustedDomainContext) => {
      if (!await fixture.host.revalidate(context)) return false
      const reads = await Promise.all(refs.map(async (ref) => {
        if (ref.surface !== "planner" || ref.type !== "planner-version") return false
        const current = await fixture.product.issueSource(ref.id, context)
        return current.status === "ok" && current.value.evidence.target.incarnation === ref.incarnation && digestSfValue([...current.value.evidence.target.fields].sort()) === digestSfValue([...ref.fields].sort())
      }))
      return reads.every(Boolean) && await fixture.host.revalidate(context)
    }
    const evidenceAccess = async (refs: readonly BusinessEvidenceRef[], context: TrustedDomainContext) => {
      const checks = await Promise.all(refs.map(async (ref) => {
        if (ref.kind !== "record" || ref.refDigest !== digestSfEvidenceRef(ref) || ref.installationId !== context.binding.installationId || ref.projectId !== context.binding.projectId || ref.target.surface !== "planner" || ref.target.recordType !== "planner-version") return false
        const current = await fixture.product.issueSource(ref.target.recordId, context)
        return current.status === "ok" && current.value.evidence.target.incarnation === ref.target.incarnation && digestSfValue([...current.value.evidence.target.fields].sort()) === digestSfValue([...ref.target.fields].sort())
      }))
      return checks.every(Boolean) && await fixture.host.revalidate(context)
    }
    const reviews = createReviewPort({ state: fixture.state, creationTarget: fixture.creationTarget, now: () => fixture.at, requestFor: fixture.host.requestFor, select: agenda.select,
      authorizeSections: (context, sections) => sourceAccess(sections.flatMap((section) => section.sourceRefs), context),
      authorizeComments: async (_context, comments) => comments.length === 0,
      authorizeOutcomeComparison: async (_context, comparisons) => comparisons.length === 0,
      authorizeOutcome: async (_context, outcomes) => outcomes.length === 0,
      authorizeDecision: async (_context, decisions) => decisions.length === 0,
      authorizeSensitivity: async (_context, results) => results.length === 0,
      revalidate: (context, refs) => sourceAccess(refs, context), revalidateEvidence: (context, refs) => evidenceAccess(refs, context),
    })
    const human = createReviewHumanPort({ state: fixture.state, reviews, human: fixture.human, ui: fixture.ui, creationTarget: fixture.creationTarget })
    const prepare = createReviewRoutinePreparation({ agenda, reviews, confirmationFor: async () => ({ status: "ok", value: null }), revalidate: fixture.host.revalidate })
    const items = async () => [{ kind: "forecast-comparison" as const, id: "forecast", title: "January forecast", baseRef: (await fixture.source("v0")).refId, candidateRef: (await fixture.source("v1")).refId, currency: "USD", sides: ["baseline", "candidate"] as const, period: routineJanuary }]
    const first = await prepare({ items: await items(), period: routineJanuary }, fixture.context)
    expect(first).toMatchObject({ status: "ok", value: { preserved: false, synthesisIncluded: false, draft: { coverage: { selectedTopics: 2, includedTopics: 2, includedRecordCount: 2 } } } })
    if (first.status !== "ok") throw new Error(`first draft failed: ${first.reason}`)
    expect(first.value.reviewSelection.sectionRefs).toEqual(["forecast:baseline", "forecast:candidate"])
    expect(await fixture.state.read(fixture.request(), "reviews", (state) => Object.keys(state.reviews))).toMatchObject({ status: "unavailable", reason: "product-state-uninitialized" })
    const preserved = await human.preserve(fixture.request("preserve-first"), first.value.reviewSelection)
    expect(preserved.status).toBe("ok")
    if (preserved.status !== "ok") throw new Error(`first preservation failed: ${preserved.reason}`)
    const original = structuredClone(preserved.value)
    expect(await reviews.read(preserved.value.id, fixture.context)).toEqual({ status: "ok", value: original })
    expect(preserved.value.sections.map((section) => ({ id: section.id, count: section.count, content: section.content }))).toEqual(first.value.draft.sections.map((section) => ({ id: section.id, count: section.count, content: section.content })))
    await fixture.editActual("v1", 0, 42000)
    expect(await reviews.preview(first.value.reviewSelection.selectionRef, first.value.reviewSelection.sectionRefs, fixture.context, routineJanuary)).toMatchObject({ status: "stale" })
    expect(await reviews.read(preserved.value.id, fixture.context)).toEqual({ status: "ok", value: original })
    const second = await prepare({ items: await items(), period: routineJanuary, previousReviewRef: preserved.value.id }, fixture.context)
    if (second.status !== "ok") throw new Error(`second draft failed: ${second.reason}`)
    expect(second.value.draft.previousReview).toEqual(original)
    const secondCandidate = second.value.topics.find((topic) => topic.state === "available" && topic.topicRef === "forecast:candidate")
    expect(secondCandidate?.state === "available" && secondCandidate.changes).toContainEqual(expect.objectContaining({ state: "changed", delta: 2000, current: expect.objectContaining({ id: "line:1:actual", value: 42000 }) }))
    const current = await human.preserve(fixture.request("preserve-second"), second.value.reviewSelection)
    if (current.status !== "ok") throw new Error(`second preservation failed: ${current.reason}`)
    const latestItems = await items()
    const compared = await prepare({ items: latestItems, period: routineJanuary, currentReviewRef: current.value.id, previousReviewRef: preserved.value.id }, fixture.context)
    expect(compared).toMatchObject({ status: "ok", value: { draft: { previousReview: original } } })
    if (compared.status !== "ok") throw new Error(`comparison draft failed: ${compared.reason}`)
    const candidate = compared.value.topics.find((topic) => topic.state === "available" && topic.topicRef === "forecast:candidate")
    expect(candidate?.state === "available" && candidate.changes).toContainEqual(expect.objectContaining({ state: "changed", delta: 2000, current: expect.objectContaining({ id: "line:1:actual", value: 42000 }) }))
    expect(await fixture.state.read(fixture.request(), "reviews", (state) => state.reviews[preserved.value.id])).toMatchObject({ status: "ok", value: original })
    fixture.access.allowed = false
    expect((await reviews.read(current.value.id, fixture.context)).status).not.toBe("ok")
    const revoked = await prepare({ items: latestItems, period: routineJanuary }, fixture.context)
    expect(revoked.status).not.toBe("ok")
    expect(revoked).not.toHaveProperty("value")
  } finally { await fixture.dispose() }
}, 120_000)
