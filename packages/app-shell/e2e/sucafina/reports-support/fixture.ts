import { expect, test } from "@playwright/test"
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
      await use({ app, corpus })
    })
  }, { timeout: 180_000 }],
})
