import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath } from "../../src/orchestra/chapters/sucafina/route-registry"
import { parseReviewsRouteQuery, reviewsRouteAvailable } from "../../src/orchestra/chapters/sucafina/host/reviews-route"
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
    const context = { destinations: sourceDestinations, availability: [{ family: "reviews", resource: "preserved", operations: [{ operationId: "reviews.review-read", state: "ready", operational: true }] }] } as unknown as SfContext
    expect(reviewsRouteAvailable(context, candidate)).toBe(true)
    expect(reviewsRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operationId: "dashboard.dashboard-review" }] }] }, candidate)).toBe(false)
    expect(reviewsRouteAvailable({ ...context, availability: [] }, candidate)).toBe(false)
    expect(reviewsRouteAvailable({ ...context, availability: [{ ...context.availability[0]!, operations: [{ ...context.availability[0]!.operations[0]!, operational: false }] }] }, candidate)).toBe(false)
  })
  test("report admission uses source-backed prepare and download, not legacy Office codecs", () => {
    const candidate = matchSfNativeRoutePath(`/orchestra/sf-reviews/reports/${encodeSfRouteRef("review")}`)!
    const context = { destinations: sourceDestinations, availability: [
      { family: "reviews", resource: "preserved", state: "ready", operations: [{ operationId: "reviews.review-read", state: "ready", operational: true }] },
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
