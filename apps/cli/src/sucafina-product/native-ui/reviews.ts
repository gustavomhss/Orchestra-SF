/**
 * A07's only new host seam: the installed HTML review workspace already has
 * JSON producer data but no native JSON endpoint. Project the same data after
 * original Request admission, protected reads and current-source checks.
 *
 * No generic forwarding route, snapshot dump, grants, HTML/script parsing,
 * invented report bytes or second review engine.
 */
import { Option, Schema } from "effect"
import { SfProjectionReview } from "@orchestra/schema/sucafina/reviews"
import { digestSfValue } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { isSfPeriod } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { reviewAgendaItemLabel } from "../../../../../modules/sucafina/Sucafinav1/product/reviews/agenda-picker.ts"
import type { createSfProductAuthority } from "../../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfScopedSourcePort } from "../../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfBusinessServices } from "../business-services.ts"
import type { createSfReviewServices } from "../review-services.ts"
import { createSfExtendedReviewCycle, sfDashboardReviewAgendaItem } from "../extended-review-cycle.ts"

type Input = Readonly<{
  origin: string
  mount: string
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  reviews: ReturnType<typeof createSfReviewServices>["application"]
  persistence: SfScopedSourcePort
}>
const allowed = new Set([
  "page", "reviewRef", "previousReviewRef", "sectionId", "reviewThread",
  "reviewMessage", "reviewIncarnation", "reviewVersion", "start", "end",
])
const fail = (status: string, reason: string, code: number) =>
  Response.json({ status, reason }, {
    status: code,
    headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
  })
const codeFor = (status: string) =>
  status === "denied" ? 403 : status === "needs-input" ? 400 :
  status === "conflict" || status === "stale" ? 409 : 503
const text = (value: string | null, max = 16_384) =>
  value !== null && value.trim().length > 0 && value.length <= max

/**
 * F02 mounts this leaf under exactly GET /api/ui/projections/review.
 * Invoked after ingress sanitation with the ORIGINAL Request. The supplied
 * owner/service instances are the original selected installation's producers.
 */
export function createSfReviewsProjectionHandlers(input: Input) {
  const { authority, business, reviews } = input
  const cycle = createSfExtendedReviewCycle({
    authority, business, reviews, persistence: input.persistence,
  })
  const handle = async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url)
    if (url.pathname !== input.mount + "/api/ui/projections/review") return undefined
    if (url.origin !== input.origin || surface !== "dashboard" || request.signal.aborted)
      return fail("denied", "review-surface-unavailable", 403)
    if (request.method !== "GET") return fail("denied", "read-method-required", 405)
    if ([...url.searchParams.keys()].some((key) =>
      !allowed.has(key) || url.searchParams.getAll(key).length !== 1))
      return fail("needs-input", "invalid-query", 400)

    // The HTML producer has these same controls and bounds; one selection
    // cannot silently override a different review or another owner's context.
    const reviewRef = url.searchParams.get("reviewRef")
    const previousRef = url.searchParams.get("previousReviewRef")
    const sectionId = url.searchParams.get("sectionId")
    const thread = url.searchParams.get("reviewThread")
    const message = url.searchParams.get("reviewMessage")
    const incarnation = url.searchParams.get("reviewIncarnation")
    const version = url.searchParams.get("reviewVersion")
    if (reviewRef && previousRef || sectionId && !reviewRef ||
        reviewRef !== null && !text(reviewRef, 2048) ||
        previousRef !== null && !text(previousRef, 2048) ||
        sectionId !== null && !text(sectionId, 2048) ||
        thread !== null && (!reviewRef || !text(thread, 2048)) ||
        [message, incarnation, version].some((value) => value !== null) &&
          (!thread || ![message, incarnation, version].every((value) => text(value, 2048)) ||
           !/^[1-9]\d*$/.test(version ?? "") || !Number.isSafeInteger(Number(version))))
      return fail("needs-input", "invalid-review-selection", 400)

    const year = new Date().getUTCFullYear()
    const period = {
      start: url.searchParams.get("start") ?? String(year) + "-01-01",
      end: url.searchParams.get("end") ?? String(year) + "-12-31",
    }
    if (!isSfPeriod(period)) return fail("needs-input", "invalid-period", 400)
    const query = {
      ...(url.searchParams.has("page") ? { page: url.searchParams.get("page") } : {}),
      ...(reviewRef ? { reviewRef } : {}),
      ...(previousRef ? { previousReviewRef: previousRef } : {}),
      ...(sectionId ? { sectionId } : {}),
      ...(thread ? { reviewThread: thread } : {}),
      ...(message ? { reviewMessage: message } : {}),
      ...(incarnation ? { reviewIncarnation: incarnation } : {}),
      ...(version ? { reviewVersion: version } : {}),
      ...(url.searchParams.has("start") ? { start: period.start } : {}),
      ...(url.searchParams.has("end") ? { end: period.end } : {}),
    }
    if (Option.isNone(Schema.decodeUnknownOption(SfProjectionReview.input)(query)))
      return fail("needs-input", "invalid-review-query", 400)
    if (!reviews) return fail("unavailable", "review-producers-unavailable", 503)

    // Keep the source admission digest identical to the preexisting 'sf=review'
    // branch. No client-supplied principal, cookie, headers or ability flags.
    const bootstrap = {
      mode: "review", page: url.searchParams.get("page"), period, viewId: "BI01",
      selectionRef: null, reviewRef, baseRef: null, candidateRef: null,
      currency: null, previousReviewRef: previousRef, sectionId,
      referenceId: null, valueId: null, referenceDigest: null,
    }
    const digest = digestSfValue(bootstrap)
    const admitted = await authority.ui.admit(request, "sf_review_prepare", digest)
      .catch(() => ({ status: "unavailable" as const, reason: "review-authority-unavailable" }))
    if (admitted.status !== "ok") return fail(admitted.status, "review-authority-unavailable", codeFor(admitted.status))
    const call = admitted.value
    let validated = false
    try {
      if (!await authority.ui.validate(call, "sf_review_prepare", digest) ||
          authority.ui.requestFor(call) !== request)
        return fail("denied", "review-authority-unavailable", 403)
      validated = true

      let data: unknown
      let check: (() => Promise<string>) | undefined
      if (reviewRef) {
        const current = await reviews.reviews.read(reviewRef, call)
        if (current.status !== "ok")
          return fail(current.status, current.reason, codeFor(current.status))
        if (sectionId && !current.value.sections.some((section) => section.id === sectionId))
          return fail("denied", "review-section-unavailable", 403)
        const snapshotDigest = digestSfValue(current.value)
        const selectedSection = sectionId
          ? current.value.sections.find((section) => section.id === sectionId)
          : undefined
        data = { reviewRef, ...(selectedSection ? { selectedSection } : {}) }
        check = async () => {
          const again = await reviews.reviews.read(reviewRef, call)
          return again.status !== "ok" ? again.status :
            digestSfValue(again.value) === snapshotDigest ? "ok" : "stale"
        }
      } else if (previousRef) {
        const updated = await cycle.update(previousRef, call)
        if (updated.status !== "ok")
          return fail(updated.status, updated.reason, codeFor(updated.status))
        const original = digestSfValue(updated.value)
        data = updated.value
        check = async () => {
          const again = await cycle.update(previousRef, call)
          return again.status !== "ok" ? again.status :
            digestSfValue(again.value) === original ? "ok" : "stale"
        }
      } else {
        const page = url.searchParams.get("page") ?? "Budget Overview"
        if (!text(page, 2048)) return fail("needs-input", "invalid-review-page", 400)
        const discovered = await business.dashboardServices.discover({ page, period }, call)
        if (discovered.status !== "ok")
          return fail(discovered.status, discovered.reason, codeFor(discovered.status))
        if (!discovered.value.agenda)
          return fail("unavailable", "review-source-selection-unavailable", 503)
        const source = discovered.value.agenda.section
        const item = sfDashboardReviewAgendaItem({ ...source, id: source.selectionRef })
        data = { items: [{ ...item, title: reviewAgendaItemLabel(item), recordOptions: discovered.value.agenda.recordOptions }], period }
        // Preserve the same live scoped source. A new discovery would mint a
        // different selectionRef, so validate the original issued reference.
        check = async () => {
          const current = await business.dashboardSources.resolveDashboardSource(item.selectionRef, call)
          return current.status === "ok" ? "ok" : current.status
        }
      }
      if (!await authority.ui.revalidate(call) || authority.ui.requestFor(call) !== request)
        return fail("denied", "review-authority-unavailable", 403)
      if (check) {
        const outcome = await check()
        if (outcome !== "ok")
          return fail(outcome, "review-source-changed-or-inaccessible", codeFor(outcome))
      }
      if (!await authority.ui.revalidate(call) || authority.ui.requestFor(call) !== request)
        return fail("denied", "review-authority-unavailable", 403)
      return Response.json({ status: "ok", value: data }, {
        headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" },
      })
    } catch {
      const current = await authority.ui.revalidate(call).catch(() => undefined)
      return request.signal.aborted || current === false ||
        validated && authority.ui.requestFor(call) !== request
        ? fail("denied", "review-authority-unavailable", 403)
        : fail("unavailable", "review-read-unavailable", 503)
    } finally { authority.ui.finish(call) }
  }
  const run = (request: Request, surface: string): Promise<Response | undefined> =>
    reviews?.readScope ? reviews.readScope.run(request, () => handle(request, surface)) :
    handle(request, surface)
  // F02 router accepts exactly {operationId, handle(originalRequest)}. The
  // surface is the reviews domain, not a user-controlled URL/body field.
  return {
    operationId: "projection.review" as const,
    handle: async (request: Request): Promise<Response> =>
      await run(request, "dashboard") ?? fail("unavailable", "review-route-unavailable", 503),
  }
}
