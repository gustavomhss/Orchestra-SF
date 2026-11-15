import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

/**
 * N17 / U05 installed-host qualification input; NOT_RUN in author session.
 * No mocked responses, fake auth or local runner. 120 supplies a real F04
 * manifest, authorized actor and source corpus before this is meaningful.
 */
function ownerRoute(page: Page, target: Readonly<{
  shellOrigin: string; serverKey: string; projectId: string; installationId: string
}>, suffix: string) {
  const query = new URLSearchParams({
    server: target.serverKey, project: target.projectId, installation: target.installationId,
  })
  return target.shellOrigin + "/orchestra/sf-portfolio/" + suffix + "?" + query
}
async function bindRealHost(page: Page, nativeHarness: Parameters<Parameters<typeof test>[0]>[0]["nativeHarness"]) {
  const manifest = nativeHarness.manifest
  await page.goto(manifest.target.shellOrigin + manifest.target.chapterHref)
  const chapter = page.locator('[data-sf-frame="page"]')
  await nativeHarness.proveWeb(chapter)
}
test("U05 CAP09 and CAP10 retain current producer identity, progress and milestones without local totals", async ({
  page, nativeHarness,
}) => {
  await bindRealHost(page, nativeHarness)
  const target = nativeHarness.manifest.target
  await page.goto(ownerRoute(page, target, "overview"))
  const overview = page.locator("[data-sf-portfolio-overview]")
  await expect(overview).toBeVisible()
  await expect(overview.locator('[data-sf-state]')).toHaveAttribute("data-sf-state", /^(ready|partial|empty)$/)
  await expect(overview.locator("[data-sf-source=CAP09]")).toHaveCount(0) // source attribute lives on root
  await expect(overview).toHaveAttribute("data-sf-source", "CAP09")
  await expect(overview.getByRole("heading", { name: /Portfolio review|Revisão do portfólio/ })).toBeVisible()
  await expect(overview.getByText(/Current project records|Registros atuais dos projetos/)).toBeVisible()
  await page.goto(ownerRoute(page, target, "projects"))
  const projects = page.locator("[data-sf-projects]")
  await expect(projects).toBeVisible()
  await expect(projects).toHaveAttribute("data-sf-source", "CAP10")
  await expect(projects.locator('[data-sf-state]')).toHaveAttribute("data-sf-state", /^(ready|partial|empty)$/)
  await expect(projects.getByRole("table")).toBeVisible()
})
test("U05 source-only filters preserve list identity and never mutate producer on a read", async ({
  page, nativeHarness,
}) => {
  await bindRealHost(page, nativeHarness)
  await page.goto(ownerRoute(page, nativeHarness.manifest.target, "projects"))
  const root = page.locator("[data-sf-projects]")
  await expect(root.locator('[data-sf-state]')).toHaveAttribute("data-sf-state", /^(ready|partial|empty)$/)
  const filter = root.getByRole("searchbox")
  const outbound: string[] = []
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.url().includes("/sucafina/"))
      outbound.push(request.method() + " " + new URL(request.url()).pathname)
  })
  await filter.fill("N17-unique-nonexisting-record-identifier")
  await expect(root.locator('[data-sf-state="filtered-empty"]')).toBeVisible()
  await root.getByRole("button", { name: /Reset filters|Limpar filtros/ }).click()
  await expect(filter).toHaveValue("")
  expect(outbound, "Filters must be local read-only and cannot invoke the original producer command").toEqual([])
})
test("U05 owner fencing denies cross-project and cross-installation data without leaking protected rows", async ({
  page, nativeHarness,
}) => {
  await bindRealHost(page, nativeHarness)
  const manifest = nativeHarness.manifest
  const variants = [
    { ...manifest.target, projectId: manifest.wrongProject.projectId },
    { ...manifest.target, installationId: manifest.wrongInstallation.installationId },
  ]
  for (const wrong of variants) {
    await page.goto(ownerRoute(page, wrong, "projects"))
    const root = page.locator("[data-sf-projects]")
    await expect(root).toBeVisible()
    await expect(root.locator('[data-sf-state]')).toHaveAttribute("data-sf-state",
      /^(denied|unavailable|invalid|session-expired)$/)
    await expect(root.getByRole("table")).toHaveCount(0)
    await expect(root.locator("[data-sf-project-editor]")).toHaveCount(0)
  }
})
for (const width of [320, 768, 1024, 1280, 1440]) {
  test("U05 CAP09 reflows within viewport width " + width, async ({
    page, nativeHarness,
  }) => {
    await bindRealHost(page, nativeHarness)
    await page.setViewportSize({ width, height: 900 })
    await page.goto(ownerRoute(page, nativeHarness.manifest.target, "overview"))
    const root = page.locator("[data-sf-portfolio-overview]")
    await expect(root).toBeVisible()
    await expect(root.locator('[data-sf-state]')).toHaveAttribute("data-sf-state", /^(ready|partial|empty)$/)
    const measure = await page.evaluate(() => ({
      viewport: window.innerWidth, document: document.documentElement.scrollWidth,
      root: document.querySelector("[data-sf-portfolio-overview]")?.getBoundingClientRect().width ?? 0,
    }))
    expect(measure.root).toBeGreaterThan(0)
    expect(measure.document, "Page may scroll within a table but must not scroll the document").toBeLessThanOrEqual(measure.viewport + 1)
  })
}
// Browser 200% zoom, 400% text reflow, denied-auth and state-changing CAS
// cases are assigned to 120's authenticated real-host/desktop matrix.
// No pass or visual proof is asserted from the existence of this spec.
