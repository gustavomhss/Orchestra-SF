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
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const reviewed = await input.reviews?.http(request, surface)
    if (reviewed) return reviewed
    const url = new URL(request.url), mode = url.searchParams.get("sf")
    if (!["bi", "bi-data", "bi-source", "review"].includes(mode ?? "")) return undefined
    const json = (value: unknown, status = 200) => new Response(request.method === "HEAD" ? null : JSON.stringify(value), { status,
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } })
    if (surface !== "dashboard" || url.origin !== input.origin || request.signal.aborted) return json({ status: "denied", reason: "surface-unavailable" }, 403)
    if (request.method !== "GET" && request.method !== "HEAD") return json({ status: "denied", reason: "read-method-required" }, 405)
    const allowed = mode === "review" ? ["sf", "page", "reviewRef", "start", "end"] : mode === "bi-source" ? ["sf", "selectionRef"] : ["sf", "viewId", "selectionRef", "start", "end"]
    if ([...url.searchParams.keys()].some((key) => !allowed.includes(key) || url.searchParams.getAll(key).length !== 1)) return json({ status: "needs-input", reason: "invalid-query" }, 400)
    const period = { start: url.searchParams.get("start") ?? `${new Date().getUTCFullYear()}-01-01`, end: url.searchParams.get("end") ?? `${new Date().getUTCFullYear()}-12-31` }
    const viewId = url.searchParams.get("viewId") ?? "BI01"
    const bootstrap = { mode, page: url.searchParams.get("page"), period, viewId, selectionRef: url.searchParams.get("selectionRef"), reviewRef: url.searchParams.get("reviewRef") }
    const digest = digestSfValue(bootstrap)
    const admitted = await authority.ui.admit(request, mode === "review" ? "sf_review_prepare" : "sf_dashboard_read", digest)
    if (admitted.status !== "ok") return json(admitted, 403)
    const call = admitted.value
    try {
      if (!await authority.ui.validate(call, mode === "review" ? "sf_review_prepare" : "sf_dashboard_read", digest)) return json({ status: "denied", reason: "authority-unavailable" }, 403)
      if (mode === "bi-source") {
        const ref = url.searchParams.get("selectionRef")
        if (!ref || ref.length > 16_384) return json({ status: "needs-input", reason: "invalid-selection" }, 400)
        const current = await business.dashboardSources.resolveDashboardSource(ref, call)
        if (current.status !== "ok") return json(current, 409)
        const source = current.value.evidence.target
        if (!source.period || !await authority.ui.revalidate(call)) return json({ status: "denied", reason: "source-access-changed" }, 403)
        return json({ url: `${url.pathname}?${new URLSearchParams({ page: current.value.page, year: source.period.start.slice(0, 4) })}`, source: { id: source.recordId, version: source.version } })
      }
      if (mode === "bi-data") {
        let selectionRef = url.searchParams.get("selectionRef")
        if (!selectionRef) {
          const route = resolveDashboardBiSelection(viewId, period)
          if (!route) return json({ status: "needs-input", reason: "choose-producer-selection" }, 422)
          const selected = await issue({ ...route, period }, call)
          if (selected.status !== "ok") return json(selected, 409)
          selectionRef = selected.value.selectionRef
        }
        const payload = { viewId, selectionRef, period }
        if (!decodeSfOperationInput("sf_bi_view", payload).ok) return json({ status: "needs-input", reason: "invalid-bi-selection" }, 422)
        const next = await authority.ui.admit(request, "sf_bi_view", digestSfValue(payload))
        if (next.status !== "ok") return json(next, 403)
        try {
          const result = await input.bi.dispatchPresentation(payload, next.value)
          return result.status === "ok" ? json(result.value) : json(result, result.status === "denied" ? 403 : 409)
        } finally { authority.ui.finish(next.value) }
      }
      let data: unknown = undefined
      if (mode === "review") {
        if (!input.reviews) return json({ status: "unavailable", reason: "review-producers-unavailable" }, 503)
        const reviewRef = url.searchParams.get("reviewRef")
        if (reviewRef) {
          const current = await input.reviews.reviews.read(reviewRef, call)
          if (current.status !== "ok") return json(current, 409)
          data = { reviewRef }
        } else {
          const current = await business.dashboardServices.discover({ page: url.searchParams.get("page") ?? "Budget Overview", period }, call)
          if (current.status !== "ok") return json(current, 409)
          if (!current.value.agenda) return json({ status: "unavailable", reason: "review-source-selection-unavailable" }, 409)
          data = { items: [{ kind: "dashboard", ...current.value.agenda.section }] }
        }
      }
      const script = await (mode === "review" ? input.assets.reviews() : input.assets.bi()).catch(() => undefined)
      if (!script || !await authority.ui.revalidate(call)) return json({ status: "unavailable", reason: "browser-or-authority-unavailable" }, 503)
      const content = mode === "review" ? '<section data-sf-review-workspace><p role="status">Loading review…</p></section>' : '<section data-sf-bi><p role="status">Loading analyses…</p></section>'
      const inline = script.replace(/<\/script/gi, "<\\/script")
      const bootstrapHtml = data === undefined ? "" : `<script type="application/json" data-sf-review-bootstrap>${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`
      const title = mode === "review" ? "Review and reports" : "Business intelligence"
      const html = documentHtml(title, "dashboard", `<a href="${url.pathname}">Dashboard</a>`, pageMain({ drawn: true, key: title, index: 0 }, content), "")
        .replace("</body>", `${bootstrapHtml}<script>${inline}</script></body>`)
      return new Response(request.method === "HEAD" ? null : html, { headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Content-Security-Policy": htmlPolicy(html), "X-Content-Type-Options": "nosniff" } })
    } finally { authority.ui.finish(call) }
  }
}
