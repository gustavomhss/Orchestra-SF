import { expect } from "@playwright/test"
import type { Browser, Page } from "@playwright/test"
import type { DesignInstallation } from "./installation"
import { enter, observePage, ready, reflow, scrollPageTop } from "./wave-three"
import { ServerConnection } from "../../../src/context/server-connection"


/**
 * A 503 is expected only after its exact original memory-outcome response proves
 * coverage-incomplete. All other browser console errors still fail the test.
 */
export function observeFinalMemoryOutcomeFailures(page: Page) {
  const expected = new Set<string>()
  const consoleErrors: { text: string; url: string }[] = []
  page.on("console", (entry) => {
    if (entry.type() === "error") consoleErrors.push({ text: entry.text(), url: entry.location().url })
  })
  return {
    expectUnavailable: async (action: () => Promise<unknown>) => {
      const pending = page.waitForResponse((response) => response.request().method() === "GET" &&
        new URL(response.url()).searchParams.get("sf") === "memory-outcome", { timeout: 40_000 })
      const [response] = await Promise.all([pending, action()])
      expect(response.status()).toBe(503)
      expect(await response.json()).toMatchObject({ status: "unavailable", reason: "coverage-incomplete" })
      expected.add(response.url())
    },
    assertOnlyExpectedErrors: (recorded: readonly string[]) => {
      const unexpected = consoleErrors.filter((entry) => !expected.has(entry.url) ||
        entry.text !== "Failed to load resource: the server responded with a status of 503 (Service Unavailable)")
      expect(unexpected).toEqual([])
      expect(recorded).toEqual([...new Set(consoleErrors.map((entry) => entry.text))])
    },
  }
}

/** Original owner-bound navigation; data readiness is checked after its bounded source reply. */
export async function enterFinalMemoryOutcome(
  page: Page, owner: Parameters<typeof enter>[1], href: string, title: string,
  outcomes: ReturnType<typeof observeFinalMemoryOutcomeFailures>,
) {
  const target = new URL(href)
  target.searchParams.set("server", ServerConnection.key({ type: "http", http: { url: target.origin } }))
  target.searchParams.set("project", owner.projectId)
  target.searchParams.set("installation", owner.installationId)
  await outcomes.expectUnavailable(() => page.goto(target.href))
  // These are the same 10-second ready/URL/layout assertions as the original enter helper.
  await ready(page, title)
  await expect(page).toHaveURL((url) => url.origin === target.origin && url.pathname === target.pathname &&
    url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
  await reflow(page)
  await scrollPageTop(page)
}

/** The same original scoped session; only the supported language preference changes. */
export async function withFinalMemoryPortuguese(
  browser: Browser,
  original: Page,
  installation: DesignInstallation,
  run: (page: Page, outcomes: ReturnType<typeof observeFinalMemoryOutcomeFailures>) => Promise<void>,
) {
  const cookies = await original.context().cookies(installation.origin + installation.mount)
  const context = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const page = await context.newPage()
    page.setDefaultTimeout(15_000)
    const diagnostics = observePage(page)
    const outcomes = observeFinalMemoryOutcomeFailures(page)
    await run(page, outcomes)
    expect(diagnostics.pageErrors).toEqual([])
    outcomes.assertOnlyExpectedErrors(diagnostics.consoleErrors)
  } finally { await context.close() }
}
