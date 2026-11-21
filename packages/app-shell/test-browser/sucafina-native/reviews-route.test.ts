import { describe, expect, test } from "bun:test"
import { createStore } from "solid-js/store"
import { Schema } from "effect"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { SfReviews } from "@orchestra/schema/sucafina/reviews"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { parseReviewsRouteQuery, reviewsRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/reviews-route"
import { preservedSourceBasis, readPreservedProjection } from "../../src/orchestra/chapters/sucafina/reviews/preserved/model"
import { sourceDestinations } from "../../test/sucafina-native/source-context-fixture"

describe("review routes", () => {
  test("retains original review refs and validates closed query selectors", () => {
    const detail = matchSfNativeRoutePath(`/orchestra/sf-reviews/reviews/${encodeSfRouteRef("review")}/present`)!
    expect(detail).toMatchObject({ surfaceId: "UI48", kind: "present", parameters: { reviewRef: "review" } })
    expect(parseReviewsRouteQuery(new URLSearchParams(), detail)).toEqual({})
    for (const query of ["server=s", "server=s&server=t&project=p&installation=i", "returnTo=x"])
      expect(parseReviewsRouteQuery(new URLSearchParams(query), detail)).toBeUndefined()
    const compare = matchSfNativeRoutePath("/orchestra/sf-reviews/compare")!
    expect(parseReviewsRouteQuery(new URLSearchParams("previousReview=a&currentReview=b"), compare)).toEqual({ previousReview: "a", currentReview: "b" })
    expect(parseReviewsRouteQuery(new URLSearchParams("previousReview=a&currentReview=a"), compare)).toBeUndefined()
  })
  test("requires the original review operation with CAP-only destinations", () => {
    const candidate = matchSfNativeRoutePath("/orchestra/sf-reviews/compare")!
    const context = { destinations: sourceDestinations, availability: [{ family: "reviews", resource: "preserved", operations: [{ operationId: "dashboard.dashboard-review", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(reviewsRouteAvailable(context, candidate)).toBe(true)
    expect(reviewsRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    expect(reviewsRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, candidate)).toBe(false)
  })
  test("report admission uses source-backed prepare and download, not legacy Office codecs", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-reviews/reports/${encodeSfRouteRef("review")}`)!
    const context = { destinations: sourceDestinations, availability: [
      { family: "reviews", resource: "preserved", state: "ready", operations: [{ operationId: "dashboard.dashboard-review", state: "ready", operational: true }] },
      { family: "reviews", resource: "report-export", state: "unavailable", operations: [
        { operationId: "reviews.export.docx", state: "unavailable", operational: false },
        { operationId: "reviews.report.prepare", state: "ready", operational: true },
      ] },
      { family: "files", resource: "exports", state: "ready", operations: [{ operationId: "files.export.review", state: "ready", operational: true }] },
    ] } as unknown as SfContext
    expect(reviewsRouteAvailable(context, candidate)).toBe(true)
    expect(reviewsRouteAvailable({ ...context, availability: context.availability.slice(0, 2) }, candidate)).toBe(false)
    expect(reviewsRouteAvailable({ ...context, availability: [context.availability[0]!, context.availability[2]!] }, candidate)).toBe(false)
    expect(reviewsRouteAvailable({ ...context, availability: [context.availability[1]!, context.availability[2]!] }, candidate)).toBe(false)
  })
})

test("Reports and Preserved Review decode C04 projection content from a Solid store", () => {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const owner = { installationId: "installation", projectId: "global", principalRef: "operator",
    accessRevision: "revision", policyVersion: "sf-product-v1" }
  const source = { surface: "dashboard" as const, type: "dashboard-page", id: "Budget Overview", incarnation: "budget-1",
    version: 1, fields: ["budgetMetrics"], period, observedAt: "2026-11-20T22:14:54.433Z" }
  const evidence = { schema: "sf-evidence-v1", kind: "record", refId: "sf-source:budget-1:1", refDigest: "digest", evidenceLevel: "observed",
    installationId: owner.installationId, projectId: owner.projectId, target: { surface: source.surface, recordType: source.type,
      recordId: source.id, incarnation: source.incarnation, version: source.version, fields: source.fields, period, projectionDigest: "projection-digest" } }
  const content = { context: { ...owner, surface: "dashboard", period, currency: "unspecified", sourceRefs: [source], capabilities: ["sf_dashboard_read"] },
    version: 1, engineVersion: "dashboard-runtime-v1", components: [], missing: [],
    values: [{ id: "budgetMetrics.2026.totalForecast", value: 1320, currency: "unspecified", period, granularity: "year",
      sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }] }
  expect(readPreservedProjection(content)).toEqual(content)

  const stored = structuredClone(content)
  const [review] = createStore({ sections: [{ id: "budget", title: "budget", count: 1, period: { ...period }, sourceRefs: [source], content: stored }] })
  expect(review.sections[0]!.content).not.toBe(stored)
  expect(readPreservedProjection(review.sections[0]!.content)).toEqual(content)
  const basis = preservedSourceBasis(review.sections[0]!, evidence.refId)
  expect(basis?.period).not.toBe(review.sections[0]!.period)
  const pinRequest = { reviewRef: "review", sectionId: "budget", basis }
  expect(Schema.decodeUnknownSync(SfReviews["reviews.review-thread-context"].input, { onExcessProperty: "error" })(pinRequest))
    .toEqual({ ...pinRequest, basis: { sourceRef: evidence.refId, sourceIncarnation: "budget-1", observedVersion: 1,
      period, evidenceRefs: [evidence] } })

  const [invalid] = createStore({ content: { ...content, context: { ...content.context, period: { ...period, extra: true } } } })
  expect(readPreservedProjection(invalid.content)).toBeUndefined()
})
