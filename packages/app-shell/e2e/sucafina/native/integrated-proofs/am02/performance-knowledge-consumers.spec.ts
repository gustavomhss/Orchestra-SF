import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../../fixture"
import { nativeOwnerQuery, type NativeTarget } from "../../fixture/manifest-contract.ts"

/**
 * Installed DOM consumers for AM02. They do not pretend to be C16, to execute
 * a resident skill, or to certify UI/agent/MCP input/result digest parity.
 * Only an F04 provisioned, authenticated original Orchestra installation
 * may run these cases. Missing F04/installed sources fail explicitly.
 */
function destination(target: NativeTarget, pathname: string) {
  const url = new URL(pathname, target.shellOrigin)
  url.search = nativeOwnerQuery(target).toString()
  return url.href
}

test.describe("AM02 installed native consumer boundaries", () => {
  test.describe.configure({ timeout: 180_000, retries: 0 })

  test("AM02-PERFORMANCE: source-backed CAP01 and BI01 remain visible only for original bound project", async ({ page, nativeHarness }) => {
    const { manifest } = nativeHarness
    await page.goto(new URL(manifest.target.chapterHref, manifest.target.shellOrigin).href)
    const readiness = await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
    expect(readiness.candidateSha).toBe(manifest.candidateSha)
    expect(readiness.principalRef).toMatch(/\S/)
    const url = destination(manifest.target, "/orchestra/sf-dashboard/executive")
    const response = await page.goto(url)
    expect(response?.ok(), "Real installed CAP01 must respond, never a component fallback").toBe(true)
    await expect(page).toHaveURL(url)
    const dashboard = page.locator('[data-sf-surface="CAP01"]')
    await expect(dashboard, "Real original Dashboard consumer is required").toBeVisible()
    await expect(dashboard.locator('[data-sf-state="ready"]')).toBeVisible()
    for (const metric of ["budget", "actual", "forecast"])
      await expect(dashboard.locator(`[data-sf-metric="${metric}"]`)).toBeVisible()
    const bi = dashboard.locator('[data-sf-bi-slot="BI01"] table')
    await expect(bi, "BI01 must render from real current producer").toBeVisible()
    expect(await bi.locator("tbody tr").count(), "An empty BI catalog does not prove consumption").toBeGreaterThan(0)
    expect(page.url()).not.toContain(readiness.principalRef)

    console.info("SF_AM02_INSTALLED_UI_CONSUMED:" + JSON.stringify({
      githubSha: process.env.GITHUB_SHA ?? null, candidateSha: manifest.candidateSha,
      pack: "performance", consumer: "CAP01:BI01", principalRef: readiness.principalRef,
      installationId: readiness.installationId, projectId: readiness.projectId,
      selectors: ["CAP01", "budget", "actual", "forecast", "BI01"],
      status: "real-installed-DOM-source-consumed", c16ReceiptObserved: false,
      fullAm02Parity: false,
    }))
    const wrongTeam = destination(manifest.wrongTeam, "/orchestra/sf-dashboard/executive")
    await page.goto(wrongTeam)
    // There is no separate actor session invented in this test. The F04
    // wrong-Team URL alone must not disclose the previous owner's figures.
    await expect(page.locator("#sf-team-content").getByRole("alert")
      .filter({ hasText: /^(This Team is not available for this account\.|Esta equipe n\u00e3o est\u00e1 dispon\u00edvel para esta conta\.)$/ })).toBeVisible()
    await expect(page).toHaveURL(wrongTeam)
    await expect(dashboard).toHaveCount(0)
    await expect(page.locator('[data-sf-metric], [data-sf-bi-slot="BI01"] table')).toHaveCount(0)
  })

  test("AM02-KNOWLEDGE: UI31 private search consumes an installed authorized producer without URL disclosure", async ({ page, nativeHarness }) => {
    const { manifest } = nativeHarness
    await page.goto(new URL(manifest.target.chapterHref, manifest.target.shellOrigin).href)
    const readiness = await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
    const url = destination(manifest.target, "/orchestra/sf-home/search")
    await page.goto(url)
    await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
    const search = page.getByRole("searchbox", { name: /Words to search|Termos da pesquisa/ })
    await expect(search).toBeEditable()
    const query = "contract"
    const captures: { method: string; url: string; body: unknown; idempotency: string | undefined }[] = []
    page.on("request", (request) => {
      if (!request.url().includes("/api/ui/projections/search")) return
      captures.push({ method: request.method(), url: request.url(), body: request.postDataJSON(),
        idempotency: request.headers()["idempotency-key"] })
    })
    await search.fill(query)
    await page.getByRole("button", { name: /^(Search|Buscar)$/ }).click()
    const results = page.locator('section[aria-labelledby="sf-u42-results"]')
    await expect(results.locator('[data-sf-state="loading"]')).toHaveCount(0)
    await expect(results.locator('[data-sf-state="unavailable"]')).toHaveCount(0)
    expect(captures).toHaveLength(1)
    expect(captures[0]).toMatchObject({ method: "POST", body: { q: query } })
    expect(captures[0]!.idempotency).toBeTruthy()
    expect(captures[0]!.url).not.toContain(query)
    expect(new URL(page.url()).searchParams.has("q")).toBe(false)
    const hits = results.locator("[data-sf-match-kind]")
    expect(await hits.count(), "No actual private source match; F04/199 must supply one").toBeGreaterThan(0)
    console.info("SF_AM02_INSTALLED_UI_CONSUMED:" + JSON.stringify({
      githubSha: process.env.GITHUB_SHA ?? null, candidateSha: manifest.candidateSha,
      pack: "knowledge", consumer: "UI31:authorized-private-search",
      installationId: readiness.installationId, projectId: readiness.projectId,
      principalRef: readiness.principalRef, actualHits: await hits.count(),
      status: "real-installed-private-source-consumed", c16ReceiptObserved: false, fullAm02Parity: false,
    }))
  })
})
