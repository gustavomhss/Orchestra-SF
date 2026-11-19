import { expect, test } from "@playwright/test"
import { retainReportResponse } from "./model.ts"
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
        if (message.text().startsWith("SF_REPORTS_AGENDA_RESULT ")) console.info(message.text())
      }
      page.on("console", diagnostic)
      const dashboardPath = new URL(app.dashboardURL).pathname
      const reportJson = (url: URL) => url.origin === new URL(page.url()).origin &&
        (url.pathname.endsWith("/api/ui/projections/review") ||
          url.pathname === app.mount + "/api/ui/pages/CAP03" && url.searchParams.get("year") === String(corpus.year) ||
          url.pathname === dashboardPath && url.searchParams.has("sf") &&
            url.searchParams.get("sf") !== "review-download")
      await page.route(reportJson, async (route) => {
        const original = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
        await retainReportResponse(route.request(), original)
        await route.fulfill({ response: original })
      })
      try { await use({ app, corpus }) }
      finally {
        await page.unroute(reportJson)
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
