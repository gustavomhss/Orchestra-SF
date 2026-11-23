import { expect } from "@playwright/test"
import type { Browser, Page } from "@playwright/test"
import type { DesignInstallation } from "./installation"
import { observePage } from "./wave-three"

/** The same original scoped session; only the supported language preference changes. */
export async function withFinalMemoryPortuguese(
  browser: Browser,
  original: Page,
  installation: DesignInstallation,
  run: (page: Page) => Promise<void>,
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
    await run(page)
    expect(diagnostics.pageErrors).toEqual([])
    expect(diagnostics.consoleErrors).toEqual([])
  } finally { await context.close() }
}
