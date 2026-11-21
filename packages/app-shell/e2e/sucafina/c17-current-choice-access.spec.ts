import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import type { Page } from "@playwright/test"
import { withReportsInstallation } from "./reports-support/production-installation.ts"

// This smoke tests the installed selector and prepare admission. Recursive
// calculation ancestry requires a real recorded choice with issued evidence.
test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0, timeout: 180_000 })

test("C17 CurrentChoice access smoke · installed case, absent choice and revoked session", async ({ page, browser }, info) => {
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  info.annotations.push({ type: "scope", description: "Installed CurrentChoice access only. No recorded choice, calculation, or ancestry proof." })

  await withReportsInstallation({
    page,
    setupEntry: "production-state.ts",
    startupTimeoutMs: 120_000,
    initialize: async () => {},
  }, async (app) => {
    const objective = "C17 installed CurrentChoice access"
    const response = await page.request.post(`${app.dashboardURL}?sf=workbench-command`, {
      data: {
        operation: "sf_case_draft",
        input: { objective, horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD",
          criteria: ["Preserve the annual horizon"], sourceRefs: [] },
      },
      headers: { origin: app.origin, "Content-Type": "application/json", "Idempotency-Key": randomUUID() },
    })
    expect(response.status()).toBe(200)
    const result: { status?: string; outputRef?: unknown } = await response.json()
    expect(result.status).toBe("ok")
    const match = typeof result.outputRef === "string" ? /^case:([^:]+):([^:]+)$/.exec(result.outputRef) : null
    if (!match) throw new Error("Installed creation did not return a case reference")
    const caseRef = { id: decodeURIComponent(match[1]!), incarnation: decodeURIComponent(match[2]!), version: 1 }

    const currentChoice = new URL(app.dashboardURL)
    currentChoice.search = new URLSearchParams({ sf: "current-choice", case: match[0] }).toString()
    expect((await page.goto(currentChoice.href))?.status()).toBe(200)
    const choicePage = page.locator("section.sf-current-choice")
    await expect(choicePage.getByRole("heading", { name: "Escolha vigente", exact: true })).toBeVisible()
    await expect(choicePage.getByRole("heading", { name: objective, exact: true })).toBeVisible()
    await expect(choicePage.getByText("Este caso ainda não tem escolhas registradas.", { exact: true })).toBeVisible()
    await expect(choicePage.getByRole("button", { name: "Preparar escolha vigente", exact: true })).toHaveCount(0)

    const prepare = {
      caseRef, choiceId: "missing-choice", alternativeRef: { id: "missing-alternative", version: 1 },
      coverageRef: "missing-coverage",
    }
    const attempt = (browserPage: Page) => browserPage.evaluate(async ({ url, body }) => {
      const response = await fetch(url, { method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify(body) })
      return { status: response.status, cache: response.headers.get("cache-control"), body: await response.json() as unknown }
    }, { url: `${app.dashboardURL}?sf=current-choice-prepare`, body: prepare })
    expect(await attempt(page)).toEqual({
      status: 409, cache: "no-store", body: { status: "stale", reason: "choice-or-alternative-changed" },
    })

    const reopened = new URL(currentChoice)
    reopened.searchParams.set("format", "json")
    const read = await page.request.get(reopened.href)
    expect(read.status()).toBe(200)
    expect(await read.json()).toEqual({ status: "ok", value: {
      cases: [{ ref: match[0], title: objective, version: 1 }], selected: { caseRef, title: objective, choices: [] },
    } })

    // Keep the genuine old credential in memory to prove server-side logout.
    const retained = await browser.newContext({ storageState: await page.context().storageState() })
    try {
      const previous = await retained.newPage()
      expect((await previous.goto(currentChoice.href))?.status()).toBe(200)
      const logout = await page.evaluate(async (url) =>
        (await fetch(url, { method: "POST", credentials: "same-origin" })).status, `${app.origin}${app.mount}/auth/logout`)
      expect(logout).toBe(204)
      expect(await attempt(previous)).toEqual({ status: 403, cache: "no-store", body: { status: "denied" } })
      const revoked = await previous.request.get(reopened.href, { maxRedirects: 0 })
      expect(revoked.status()).toBe(303)
      expect(revoked.headers().location).toContain(`${app.mount}/auth/login`)
    } finally { await retained.close() }
  })
})
