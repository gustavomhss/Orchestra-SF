import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { decodeSfOperationInput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { resolveDashboardBiSelection } from "../../../../modules/sucafina/Sucafinav1/product/dashboard/bi-metadata.ts"
import { createDashboardSourceIssuer } from "../../../../modules/sucafina/Sucafinav1/product/integration/dashboard-sources.ts"
import { documentHtml, pageMain } from "../../../../modules/sucafina/Sucafinav1/src/screen-shell.ts"
import { htmlPolicy } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { SfScopedSourcePort } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfBiServices } from "./bi-services.ts"
import type { createSfReviewServices } from "./review-services.ts"
import type { createSfExtendedAssets } from "./extended-assets.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { createSfExtendedBiOptions } from "./extended-bi-options.ts"
import { readSfDecisionBiSelection, sfPlannerBiSelection } from "./bi-selections.ts"
import { createSfExtendedReviewCycle, sfDashboardReviewAgendaItem } from "./extended-review-cycle.ts"
import { sfExtendedSourceLinks } from "./extended-source-links.ts"
import { sameBiProjection } from "../../../../modules/sucafina/Sucafinav1/product/analytics/projection.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"

export function createSfExtendedHttp(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  bi: ReturnType<typeof createSfBiServices>
  reviews: ReturnType<typeof createSfReviewServices>["application"]
  persistence: SfScopedSourcePort
  origin: string
  assets: Pick<ReturnType<typeof createSfExtendedAssets>, "bi" | "reviews">
}) {
  const { authority, business } = input
  const issue = createDashboardSourceIssuer({ host: authority.host, scopedSources: input.persistence })
  const options = createSfExtendedBiOptions(input)
  const reviewCycle = createSfExtendedReviewCycle(input)
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const reviewed = await input.reviews?.http(request, surface)
    if (reviewed) return reviewed
    const url = new URL(request.url), mode = url.searchParams.get("sf")
    if (!["bi", "bi-data", "bi-source", "bi-options", "review", "review-update", "review-source"].includes(mode ?? "")) return undefined
    const json = (value: unknown, status = 200) => new Response(request.method === "HEAD" ? null : JSON.stringify(value), { status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" || url.origin !== input.origin || request.signal.aborted) return json({ status: "denied", reason: "surface-unavailable" }, 403)
    if (request.method !== "GET" && request.method !== "HEAD") return json({ status: "denied", reason: "read-method-required" }, 405)
    const allowed = mode === "review" ? ["sf", "page", "reviewRef", "previousReviewRef", "sectionId", "start", "end"] : mode === "review-update" ? ["sf", "reviewRef"] : mode === "review-source" ? ["sf", "reviewRef", "referenceId"] : mode === "bi-source" ? ["sf", "selectionRef", "viewId", "start", "end", "valueId"] : mode === "bi-options" ? ["sf", "page", "viewId", "start", "end"] : ["sf", "page", "viewId", "selectionRef", "start", "end", "baseRef", "candidateRef", "currency"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return json({ status: "needs-input", reason: "invalid-query" }, 400)
    const period = { start: url.searchParams.get("start") ?? `${new Date().getUTCFullYear()}-01-01`, end: url.searchParams.get("end") ?? `${new Date().getUTCFullYear()}-12-31` }
    if (!isSfPeriod(period)) return json({ status: "needs-input", reason: "invalid-period" }, 400)
    const viewId = url.searchParams.get("viewId") ?? "BI01"
    const bootstrap = { mode, page: url.searchParams.get("page"), period, viewId, selectionRef: url.searchParams.get("selectionRef"), reviewRef: url.searchParams.get("reviewRef"), baseRef: url.searchParams.get("baseRef"), candidateRef: url.searchParams.get("candidateRef"), currency: url.searchParams.get("currency"), previousReviewRef: url.searchParams.get("previousReviewRef"), sectionId: url.searchParams.get("sectionId"), referenceId: url.searchParams.get("referenceId"), valueId: url.searchParams.get("valueId") }
    const digest = digestSfValue(bootstrap)
    const action = mode?.startsWith("review") ? "sf_review_prepare" : "sf_dashboard_read"
    const admitted = await authority.ui.admit(request, action, digest)
    if (admitted.status !== "ok") return json(admitted, 403)
    const call = admitted.value
    try {
      if (!await authority.ui.validate(call, action, digest)) return json({ status: "denied", reason: "authority-unavailable" }, 403)
      if (mode === "review-update") {
        const reference = url.searchParams.get("reviewRef")
        if (!reference || reference.length > 2048) return json({ status: "needs-input", reason: "invalid-review-reference" }, 400)
        const result = await reviewCycle.update(reference, call)
        return json(result, result.status === "ok" ? 200 : result.status === "denied" ? 403 : 409)
      }
      if (mode === "review-source") {
        const reference = url.searchParams.get("reviewRef"), referenceId = url.searchParams.get("referenceId")
        if (!input.reviews || !reference || !referenceId || reference.length > 2048 || referenceId.length > 16384) return json({ status: "needs-input", reason: "invalid-review-source" }, 400)
        const reviewed = await input.reviews.reviews.read(reference, call)
        if (reviewed.status !== "ok") return json(reviewed, reviewed.status === "denied" ? 403 : 409)
        const preserved = [{ reference, digest: digestSfValue(reviewed.value) }]
        let sources = reviewCycle.evidence(reviewed.value, referenceId)
        if (!sources.length && reviewed.value.previousReviewRef) {
          const previous = await input.reviews.reviews.read(reviewed.value.previousReviewRef, call)
          if (previous.status !== "ok") return json(previous, previous.status === "denied" ? 403 : 409)
          preserved.push({ reference: reviewed.value.previousReviewRef, digest: digestSfValue(previous.value) })
          sources = reviewCycle.evidence(previous.value, referenceId)
        }
        if (!sources.length || sources.some((source) => digestSfValue(source) !== digestSfValue(sources[0]))) return json({ status: "denied", reason: "source-outside-preserved-review" }, 403)
        const links = await sfExtendedSourceLinks({ business, reference: sources[0]!, call, url })
        // The record destination does not authorize its association with a
        // preserved review. Reopen every review used by that association after
        // resolving links, in one real C08 read scope, including the predecessor.
        const checked = await authority.state.read(request, "reviews", async () => {
          for (const expected of preserved) {
            const current = await input.reviews!.reviews.read(expected.reference, call)
            if (current.status !== "ok") return current
            if (digestSfValue(current.value) !== expected.digest) return { status: "stale" as const, reason: "review-source-changed" }
          }
          return { status: "ok" as const, value: true }
        })
        if (checked.status !== "ok") return json(checked, checked.status === "denied" ? 403 : 409)
        if (checked.value.status !== "ok") return json(checked.value, checked.value.status === "denied" ? 403 : 409)
        return links.length ? json({ links }) : json({ status: "unavailable", reason: "source-or-destination-period-unavailable" }, 409)
      }
      if (mode === "bi-options") {
        const found = await options.read(viewId, period, call)
        return json(found, found.status === "ok" ? 200 : found.status === "denied" ? 403 : 409)
      }
      if (mode === "bi-source") {
        const ref = url.searchParams.get("selectionRef")
        if (!ref || ref.length > 16_384) return json({ status: "needs-input", reason: "invalid-selection" }, 400)
        const referenceDigest = url.searchParams.get("referenceDigest")
        if (referenceDigest !== null && !/^[a-f0-9]{64}$/.test(referenceDigest)) return json({ status: "needs-input", reason: "invalid-source-choice" }, 400)
        const selectedCase = readSfDecisionBiSelection(ref) ? await options.caseFor(ref, call) : undefined
        if (readSfDecisionBiSelection(ref) && !selectedCase) return json({ status: "denied", reason: "bi-case-selection-unavailable" }, 403)
        const read = async () => {
          const current = await input.bi.source.read({ viewId, selectionRef: ref, period }, call)
          if (current.status !== "ok") return current
          const value = current.value.values.find((entry) => entry.id === url.searchParams.get("valueId"))
          if (!value) return { status: "unavailable" as const, reason: "bi-value-source-unavailable" }
          // Match the producer's explicit drilldown or require a human choice
          // among this exact row's origins. Client bytes never supply a source.
          const origins = value.drilldown ? [value.drilldown] : value.sourceRefs.filter((entry, index, all) => all.findIndex((candidate) => digestSfValue(candidate) === digestSfValue(entry)) === index)
          if (!origins.length) return { status: "unavailable" as const, reason: "bi-value-source-unavailable" }
          if (referenceDigest === null && origins.length !== 1) return { status: "needs-input" as const, reason: "bi-source-choice-required" }
          const reference = referenceDigest === null ? origins[0] : origins.find((entry) => entry.refDigest === referenceDigest)
          if (!reference) return { status: "denied" as const, reason: "bi-source-outside-selected-value" }
          const links = await sfExtendedSourceLinks({ business, reference, call, url })
          // Reopen the protected selection after destination resolution. The
          // producer's digest comparison ignores only observation timestamps.
          const latest = await input.bi.source.read({ viewId, selectionRef: ref, period }, call)
          if (latest.status !== "ok") return latest
          if (!sameBiProjection(latest.value, current.value)) return { status: "stale" as const, reason: "bi-source-changed" }
          return links.length ? { status: "ok" as const, value: { links } } : { status: "unavailable" as const, reason: "source-or-destination-period-unavailable" }
        }
        const result = selectedCase ? await business.withCase(call, selectedCase, {}, read) : await read()
        return result.status === "ok" ? json(result.value) : json(result, result.status === "denied" ? 403 : 409)
      }
      if (mode === "bi-data") {
        let selectionRef = url.searchParams.get("selectionRef")
        if (url.searchParams.has("baseRef") || url.searchParams.has("candidateRef") || url.searchParams.has("currency")) {
          if (selectionRef || !["BI01", "BI02", "BI03", "BI04"].includes(viewId)) return json({ status: "needs-input", reason: "ambiguous-bi-selection" }, 400)
          const selected = decodeSfOperationInput("sf_forecast_compare", { baseRef: url.searchParams.get("baseRef"), candidateRef: url.searchParams.get("candidateRef"), currency: url.searchParams.get("currency"), period })
          if (!selected.ok) return json({ status: "needs-input", reason: "choose-two-versions-and-currency" }, 422)
          selectionRef = sfPlannerBiSelection(selected.value)
        }
        if (!selectionRef) {
          const route = resolveDashboardBiSelection(viewId, period)
          if (!route) return json({ status: "needs-input", reason: "choose-producer-selection" }, 422)
          const selected = await issue({ ...route, period }, call)
          if (selected.status !== "ok") return json(selected, selected.status === "denied" ? 403 : 409)
          selectionRef = selected.value.selectionRef
        }
        const payload = { viewId, selectionRef, period }
        if (!decodeSfOperationInput("sf_bi_view", payload).ok) return json({ status: "needs-input", reason: "invalid-bi-selection" }, 422)
        const next = await authority.ui.admit(request, "sf_bi_view", digestSfValue(payload))
        if (next.status !== "ok") return json(next, 403)
        try {
          // The shared C16 dispatcher consumes this new admission. Its source
          // composition binds the selected case only after that validation.
          const result = await input.bi.dispatchPresentation(payload, next.value)
          return result.status === "ok" ? json(result.value) : json(result, result.status === "denied" ? 403 : 409)
        } finally { authority.ui.finish(next.value) }
      }
      let data: unknown = undefined
      let verifyReviewBootstrap: (() => Promise<Response | undefined>) | undefined
      if (mode === "review") {
        if (!input.reviews) return json({ status: "unavailable", reason: "review-producers-unavailable" }, 503)
        const reviewRef = url.searchParams.get("reviewRef")
        if (reviewRef) {
          const current = await input.reviews.reviews.read(reviewRef, call)
          if (current.status !== "ok") return json(current, current.status === "denied" ? 403 : 409)
          const captured = digestSfValue(current.value)
          verifyReviewBootstrap = async () => {
            const again = await input.reviews!.reviews.read(reviewRef, call)
            if (again.status !== "ok") return json(again, again.status === "denied" ? 403 : 409)
            if (digestSfValue(again.value) !== captured) return json({ status: "stale", reason: "review-changed-before-display" }, 409)
            return undefined
          }
          const sectionId = url.searchParams.get("sectionId")
          const selectedSection = sectionId ? current.value.sections.find((section) => section.id === sectionId) : undefined
          if (sectionId && !selectedSection) return json({ status: "denied", reason: "review-section-unavailable" }, 403)
          data = { reviewRef, ...(selectedSection ? { selectedSection: { ...selectedSection, content: selectedSection.content as DomainProjection } } : {}) }
        } else if (url.searchParams.has("previousReviewRef")) {
          const updated = await reviewCycle.update(url.searchParams.get("previousReviewRef")!, call)
          if (updated.status !== "ok") return json(updated, updated.status === "denied" ? 403 : 409)
          data = updated.value
          const captured = digestSfValue(updated.value)
          verifyReviewBootstrap = async () => {
            const again = await reviewCycle.update(url.searchParams.get("previousReviewRef")!, call)
            if (again.status !== "ok") return json(again, again.status === "denied" ? 403 : 409)
            if (digestSfValue(again.value) !== captured) return json({ status: "stale", reason: "review-update-changed-before-display" }, 409)
            return undefined
          }
        } else {
          const current = await business.dashboardServices.discover({ page: url.searchParams.get("page") ?? "Budget Overview", period }, call)
          if (current.status !== "ok") return json(current, current.status === "denied" ? 403 : 409)
          if (!current.value.agenda) return json({ status: "unavailable", reason: "review-source-selection-unavailable" }, 409)
          data = { items: [sfDashboardReviewAgendaItem(current.value.agenda.section)] }
        }
      }
      const script = await (mode === "review" ? input.assets.reviews() : input.assets.bi()).catch(() => undefined)
      if (!await authority.ui.revalidate(call)) return json({ status: "denied", reason: "authority-unavailable" }, 403)
      if (!script) return json({ status: "unavailable", reason: "browser-unavailable" }, 503)
      // Asset loading can outlive case membership. The destination producer
      // reopens that specific review after the last unrelated await.
      if (verifyReviewBootstrap) {
        const unavailable = await verifyReviewBootstrap()
        if (unavailable) return unavailable
      }
      // These client workspaces retain their live state across shell probes.
      // The published shell still owns navigation, notifications and sign-out.
      const content = mode === "review" ? '<section data-sf-review-workspace data-sf-retain-view><p role="status">Loading review…</p></section>' : '<section data-sf-bi data-sf-retain-view><p role="status">Loading analyses…</p></section>'
      const inline = script.replace(/<\/script/gi, "<\\/script")
      const bootstrapHtml = data === undefined ? "" : `<script type="application/json" data-sf-review-bootstrap>${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`
      const title = mode === "review" ? "Review and reports" : "Business intelligence"
      const shell = documentHtml(title, "dashboard", `<a href="${url.pathname}">Dashboard</a>`, pageMain({ drawn: true, key: title, index: 0 }, content), "")
      const html = shell
        // A replacement string would interpret dollar sequences in the bundle
        // or bootstrap as substitutions of the surrounding document.
        .replace("</body>", () => `${bootstrapHtml}<script>${inline}</script></body>`)
      return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
    } finally { authority.ui.finish(call) }
  }
}
