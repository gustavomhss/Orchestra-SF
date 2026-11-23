import { expect } from "@playwright/test"
import type { Browser, Page } from "@playwright/test"
import type { DesignInstallation } from "./installation"
import { observePage } from "./wave-three"
import { navigateFinalSurface, observeFinalGet } from "./final-navigation"

type Owner = Parameters<typeof navigateFinalSurface>[0]["owner"]
type Area = "UI61" | "UI62" | "UI63" | "UI63-reference" | "UI67" | "UI69"

/** Register the actual initial readers before navigation. Their response bodies
 * are captured at the Request, then checked before the original 10s DOM gate. */
export async function enterFinalMemorySurface(
  page: Page, owner: Owner, installation: DesignInstallation, href: string, title: string, area: Area,
  beforeReady?: () => Promise<void>,
) {
  const readers: { label: string; observed: Awaited<ReturnType<typeof observeFinalGet>> }[] = []
  try {
    if (area === "UI61" || area === "UI62" || area === "UI63")
      readers.push({ label: "projection.cases", observed: await observeFinalGet(page, installation.origin,
        installation.mount + "/api/ui/projections/cases") })
    if (area === "UI61" || area === "UI63" || area === "UI63-reference")
      readers.push({ label: "memory-catalog", observed: await observeFinalGet(page, installation.origin,
        installation.mount + "/dashboard", 1, (url) => url.searchParams.get("sf") === "memory-catalog") })
    if (area === "UI69")
      readers.push({ label: "summary-settings", observed: await observeFinalGet(page, installation.origin,
        installation.mount + "/api/ui/local-admin/summary-settings") })
    return await navigateFinalSurface({
      page, owner, installation, href, title,
      beforeReady: async (context) => {
        await Promise.all(readers.map(async ({ label, observed }) => {
          const original = await observed.next()
          expect(original.status).toBe(200)
          expect(original.body).toMatchObject({ status: "ok" })
          if (label === "summary-settings") expect(original.body).toMatchObject({ context: context.stamp })
        }))
        await beforeReady?.()
      },
    })
  } finally {
    const closed = await Promise.allSettled(readers.map(({ observed }) => observed.close()))
    const failures = closed.flatMap((result) => result.status === "rejected" ? [result.reason] : [])
    if (failures.length) throw new AggregateError(failures, "Original memory navigation observers did not close")
  }
}

/**
 * A 503 is expected only after its exact original memory-outcome response proves
 * coverage-incomplete. All other browser console errors still fail the test.
 */
export function observeFinalMemoryOutcomeFailures(page: Page, installation: Pick<DesignInstallation, "origin" | "mount">) {
  const expected = new Set<string>()
  const consoleErrors: { text: string; url: string }[] = []
  page.on("console", (entry) => {
    if (entry.type() === "error") consoleErrors.push({ text: entry.text(), url: entry.location().url })
  })
  return {
    expectUnavailable: async (action: (waitForOriginal: () => Promise<void>) => Promise<unknown>) => {
      const observed = await observeFinalGet(page, installation.origin, installation.mount + "/dashboard", 1,
        (url) => url.searchParams.get("sf") === "memory-outcome")
      let checked: Promise<void> | undefined
      const waitForOriginal = () => checked ??= (async () => {
        const original = await observed.next()
        expect(original.status).toBe(503)
        expect(original.body).toMatchObject({ status: "unavailable", reason: "coverage-incomplete" })
        expected.add(original.url)
      })()
      try {
        // During navigation the caller awaits this after its two real F01 reads
        // and before ready(). A click simply awaits it after the single action.
        await action(waitForOriginal)
        await waitForOriginal()
      } finally { await observed.close() }
    },
    assertOnlyExpectedErrors: (recorded: readonly string[]) => {
      const unexpected = consoleErrors.filter((entry) => !expected.has(entry.url) ||
        entry.text !== "Failed to load resource: the server responded with a status of 503 (Service Unavailable)")
      expect(unexpected).toEqual([])
      expect(recorded).toEqual([...new Set(consoleErrors.map((entry) => entry.text))])
    },
  }
}

/** The same owner-bound F01 and original coverage refusal, before DOM readiness. */
export async function enterFinalMemoryOutcome(
  page: Page, owner: Owner, installation: DesignInstallation, href: string, title: string,
  outcomes: ReturnType<typeof observeFinalMemoryOutcomeFailures>,
) {
  await outcomes.expectUnavailable((waitForOriginal) =>
    enterFinalMemorySurface(page, owner, installation, href, title, "UI63-reference", waitForOriginal))
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
    const outcomes = observeFinalMemoryOutcomeFailures(page, installation)
    await run(page, outcomes)
    expect(diagnostics.pageErrors).toEqual([])
    outcomes.assertOnlyExpectedErrors(diagnostics.consoleErrors)
  } finally { await context.close() }
}
