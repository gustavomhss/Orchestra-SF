import { expect, test } from "@playwright/test"
import { object, retainReportResponse } from "./model.ts"
import { Option, Schema } from "effect"
import { SfReviewDomainProjection } from "@orchestra/schema/sucafina/reviews"
import { reportsCorpus } from "./corpus.ts"
import type { ReportsCorpus } from "./corpus.ts"
import { withReportsInstallation } from "./production-installation.ts"
import type { ReportsInstallation } from "./production-installation.ts"

export const reportsTest = test.extend<{ reports: { app: ReportsInstallation; corpus: ReportsCorpus } }>({
  reports: [async ({ page }, use, info) => {
    expect(info.project.metadata.bundle, "CI-UI-REPORTS requires the existing production config").toBe("production")
    expect(info.config.workers, "The production installer binds its fixed port 4110").toBe(1)
    expect(info.project.retries, "Do not retry a Reports journey containing mutations").toBe(0)
    const corpus = reportsCorpus()
    await withReportsInstallation({
      page,
      setupEntry: "production-state.ts",
      startupTimeoutMs: 120_000,
      initialize: async (app) => {
        const seed: unknown = JSON.parse(await app.setup("seed", [corpus.today]))
        expect(seed).toEqual({ seeded: true, projects: 25, year: corpus.year, sourceForecast: corpus.before })
      },
    }, async (app) => {
      await info.attach("reports-installation", { body: JSON.stringify({
        entry: "apps/cli/src/index.ts serve --installation modules/sucafina/Sucafinav1/local/entry.ts",
        mount: app.workbenchURL, principalRef: app.actorId, authentication: "real-local-operator",
        isolated: true, projects: 25, year: corpus.year, candidateSnapshot: process.env.GITHUB_SHA ?? null,
        config: "e2e/playwright.production.config.ts", selection: "CI-UI-REPORTS",
      }, null, 2), contentType: "application/json" })
      const started = new WeakMap<import("@playwright/test").Request, number>()
      const relevant = (request: import("@playwright/test").Request) => {
        const url = new URL(request.url())
        return url.pathname.endsWith("/api/ui/context") || url.pathname.endsWith("/api/ui/projections/review") ||
          url.pathname.endsWith("/dashboard") && !!url.searchParams.get("sf")?.startsWith("review")
      }
      const begin = (request: import("@playwright/test").Request) => { if (relevant(request)) started.set(request, Date.now()) }
      const finish = (request: import("@playwright/test").Request) => {
        if (!relevant(request)) return
        const url = new URL(request.url())
        console.info("SF_REPORTS_NETWORK", JSON.stringify({ method: request.method(), path: url.pathname,
          operation: url.searchParams.get("sf"), elapsedMs: Date.now() - (started.get(request) ?? Date.now()),
          failure: request.failure()?.errorText ?? null }))
      }
      page.on("request", begin); page.on("requestfinished", finish); page.on("requestfailed", finish)
      // The native client has consumed these responses when Chromium sometimes
      // evicts their CDP bodies. Buffer the one original HTTP response, then
      // deliver its unchanged status, headers and bytes to both client and test.
      // Office downloads and authentication keep their original browser path.
      const diagnostic = (message: import("@playwright/test").ConsoleMessage) => {
        if (/^SF_REPORTS_(?:AGENDA_RESULT|NATIVE_OWNER) /.test(message.text())) console.info(message.text())
      }
      page.on("console", diagnostic)
      const dashboardPath = new URL(app.dashboardURL).pathname
      let observedStamp: Record<string, unknown> | undefined
      const reportJson = (url: URL) => url.origin === new URL(page.url()).origin &&
        (url.pathname.endsWith("/api/ui/projections/review") ||
          url.pathname === app.mount + "/api/ui/context" ||
          ["/api/ui/pages/CAP03", "/api/ui/pages/CAP04"].some((path) => url.pathname === app.mount + path) &&
            url.searchParams.get("year") === String(corpus.year) ||
          url.pathname === dashboardPath && (url.searchParams.has("sf") &&
            url.searchParams.get("sf") !== "review-download" ||
            !url.searchParams.has("sf") && url.searchParams.get("page") === "OPEX Detail"))
      await page.route(reportJson, async (route) => {
        const request = route.request(), url = new URL(request.url())
        if (url.pathname === dashboardPath && !url.searchParams.has("sf") &&
            (request.method() !== "POST" || object(request.postDataJSON()).action !== "save-entry")) return route.continue()
        const original = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
        await retainReportResponse(request, original)
        // Compare only the original responses already delivered to this page.
        // No extra context GET, stored authority, owner values or replay.
        try {
          if (url.pathname === app.mount + "/api/ui/context") {
            const body = object(await original.json())
            observedStamp = body.status === "ok" ? object(object(body.value).stamp) : undefined
          } else if (url.searchParams.get("sf") === "review-read" && original.status() === 200) {
            const body = object(await original.json()), saved = object(body.value)
            const sections = Array.isArray(saved.sections) ? saved.sections : []
            console.info("SF_REPORTS_OWNER_COMPARISON", JSON.stringify(sections.map((value) => {
              const section = object(value), content = object(section.content), context = object(content.context)
              return { title: section.title, projectionValid: Option.isSome(Schema.decodeUnknownOption(SfReviewDomainProjection)(content)),
                originalContextCaptured: observedStamp !== undefined,
                matchesCurrentStamp: Object.fromEntries(["installationId", "projectId", "principalRef", "policyVersion", "accessRevision"]
                  .map((key) => [key, observedStamp === undefined ? null : context[key] === observedStamp[key]])) }
            })))
          }
        } catch {
          observedStamp = undefined
          console.info("SF_REPORTS_OWNER_COMPARISON_UNAVAILABLE")
        }
        await route.fulfill({ response: original })
      })
      try { await use({ app, corpus }) }
      finally {
        await page.unrouteAll({ behavior: "wait" })
        page.off("console", diagnostic)
        page.off("request", begin); page.off("requestfinished", finish); page.off("requestfailed", finish)
        if (info.status !== info.expectedStatus) {
          console.info("SF_REPORTS_FAILED_SURFACE", JSON.stringify(await page.locator("body").evaluate((body) => ({
            path: location.pathname, queryKeys: [...new URLSearchParams(location.search).keys()],
            surfaces: Array.from(body.querySelectorAll("[data-sf-surface]")).map((item) => ({
              surface: item.getAttribute("data-sf-surface"), phase: item.getAttribute("data-phase"),
            })),
            headings: Array.from(body.querySelectorAll("h1,h2,[role=alert]")).map((item) => item.textContent?.slice(0, 240)),
          })).catch(() => ({ closed: true }))))
        }
      }
    })
  }, { timeout: 180_000 }],
})
