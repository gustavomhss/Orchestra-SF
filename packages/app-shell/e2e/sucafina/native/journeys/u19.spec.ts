import { expect } from "@playwright/test"
import type { Page } from "@playwright/test"
import { nativeInstalledFixture as test, type InstalledNativeHarness } from "../fixture"

/** U19 browser journeys bound to the original real F04 private manifest.
 * Auth, A04 cases and A05 stored results must come from the installed product.
 * NOT_RUN by N17; only hosted 120 may qualify. No mocked backends or bypass.
 */
function route(target: Readonly<{
  shellOrigin: string; serverKey: string; projectId: string; installationId: string
}>, suffix: string) {
  const query = new URLSearchParams({
    server: target.serverKey, project: target.projectId, installation: target.installationId,
  })
  return target.shellOrigin + suffix + "?" + query
}
async function mounted(page: Page, fixture: InstalledNativeHarness) {
  await page.goto(fixture.manifest.target.shellOrigin + fixture.manifest.target.chapterHref)
  await fixture.proveWeb(page.locator('[data-sf-frame="page"]'))
}
async function readCases(page: Page, fixture: InstalledNativeHarness) {
  await mounted(page, fixture)
  await page.goto(route(fixture.manifest.target, "/orchestra/sf-portfolio/scenarios"))
  const root = page.locator("[data-sf-scenarios]")
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute("data-sf-surface", "UI42")
  await expect(root.locator('[data-sf-state]')).toHaveAttribute("data-sf-state", /^(ready|partial|empty)$/)
  return root
}
test("U19 UI42 lists cases from the original A04 source; no automatic simulation or persistence", async ({
  page, nativeHarness,
}) => {
  const root = await readCases(page, nativeHarness)
  await expect(root.getByRole("heading", { name: /Authorized cases|Casos autorizados/ })).toBeVisible()
  await expect(root.locator(".sf-u19-case-list")).toBeVisible()
  expect(await root.locator(".sf-u19-case-list button").count(),
    "A04 must supply at least one real authorized case for the campaign qualification").toBeGreaterThan(0)
  await expect(root.getByRole("button", { name: /Persist evaluation|Persistir avaliação/ })).toHaveCount(0)
})
test("U19 UI42 case review uses versioned producer candidates and never computes a local total", async ({
  page, nativeHarness,
}) => {
  const root = await readCases(page, nativeHarness)
  const first = root.locator(".sf-u19-case-list button").filter({ has: root.locator("small") })
  expect(await first.count()).toBeGreaterThan(0)
  await first.nth(0).click()
  await expect(page.locator("[data-sf-scenarios]")).toBeVisible()
  const caseView = page.locator("[data-sf-scenarios]")
  await expect(caseView.locator('[data-sf-state="ready"]')).toBeVisible()
  await expect(caseView.getByText(/No client-side feasibility|Não calculamos viabilidade/)).toBeVisible()
  await expect(caseView.getByRole("group", { name: /Candidate scenarios|Cenários candidatos/ })).toBeVisible()
  // No preview is presented without an explicit source-authorized request.
  await expect(caseView.getByRole("heading", { name: /Preview combinations|Prévia das combinações/ })).toHaveCount(0)
})
test("U19 UI44 requires genuine selected results and A05-issued sensitivity units", async ({
  page, nativeHarness,
}) => {
  await mounted(page, nativeHarness)
  await page.goto(route(nativeHarness.manifest.target, "/orchestra/sf-portfolio/sensitivity"))
  const root = page.locator("[data-sf-sensitivity]")
  await expect(root).toBeVisible()
  await expect(root).toHaveAttribute("data-sf-surface", "UI44")
  await expect(root.locator('[data-sf-state]')).toHaveAttribute("data-sf-state", /^(ready|partial|empty)$/)
  await expect(root.locator(".sf-u19-sensitivity-results")).toHaveCount(0)
  await expect(root.locator(".sf-u19-review")).toHaveCount(0)
  await expect(root.getByRole("button", { name: /Confirm sensitivity evaluation|Confirmar avaliação de sensibilidade/ })).toHaveCount(0)
})
test("U19 cross-owner context cannot expose case, portfolio combinations or sensitivity samples", async ({
  page, nativeHarness,
}) => {
  await mounted(page, nativeHarness)
  const manifest = nativeHarness.manifest
  const wrongProject = { ...manifest.target, projectId: manifest.wrongProject.projectId }
  await page.goto(route(wrongProject, "/orchestra/sf-portfolio/scenarios"))
  const scenario = page.locator("[data-sf-scenarios]")
  await expect(scenario).toBeVisible()
  await expect(scenario.locator('[data-sf-state]')).toHaveAttribute("data-sf-state",
    /^(denied|unavailable|invalid|session-expired)$/)
  await expect(scenario.locator(".sf-u19-combination")).toHaveCount(0)
  const wrongInstallation = { ...manifest.target, installationId: manifest.wrongInstallation.installationId }
  await page.goto(route(wrongInstallation, "/orchestra/sf-portfolio/sensitivity"))
  const sensitivity = page.locator("[data-sf-sensitivity]")
  await expect(sensitivity).toBeVisible()
  await expect(sensitivity.locator('[data-sf-state]')).toHaveAttribute("data-sf-state",
    /^(denied|unavailable|invalid|session-expired)$/)
  await expect(sensitivity.locator(".sf-u19-sensitivity-results")).toHaveCount(0)
})
for (const width of [320, 768, 1024, 1280, 1440]) {
  test("U19 case chooser reflows at viewport " + width, async ({
    page, nativeHarness,
  }) => {
    await mounted(page, nativeHarness)
    await page.setViewportSize({ width, height: 900 })
    await page.goto(route(nativeHarness.manifest.target, "/orchestra/sf-portfolio/sensitivity"))
    const root = page.locator("[data-sf-sensitivity]")
    await expect(root).toBeVisible()
    await expect(root.locator('[data-sf-state]')).toHaveAttribute("data-sf-state", /^(ready|partial|empty)$/)
    const visual = await page.evaluate(() => ({
      viewportWidth: window.innerWidth,
      bodyWidth: document.documentElement.scrollWidth,
      rootWidth: document.querySelector("[data-sf-sensitivity]")?.getBoundingClientRect().width ?? 0,
    }))
    expect(visual.rootWidth).toBeGreaterThan(0)
    expect(visual.bodyWidth).toBeLessThanOrEqual(visual.viewportWidth + 1)
  })
}
// UI43/recorded UI44 evaluation requires 120's real seeded C08 results and
// criterion binding; their absence must fail an explicit qualification task,
// never be filled with preview JSON or synthetic browser interception.
// Actual 200% zoom, 400% text scaling and desktop D01 proof remain 120/119.
