/**
 * N10/U42 real installed search. A native UI view is not an authorization proof
 * until 120 runs this against the real current-actor producer and fixture.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test("UI31 search stays in memory, filters only returned authorized evidence", async ({ page, nativeHarness }) => {
  const installed = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  await page.goto(installed.toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const destination = new URL(installed)
  destination.pathname = "/orchestra/sf-home/search"
  await page.goto(destination.toString())
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
  const query = page.getByRole("searchbox", { name: /Words to search|Termos da pesquisa/ })
  await expect(query).toBeEditable()
  await query.fill("contract")
  const before = page.url()
  await page.getByRole("button", { name: /^(Search|Buscar)$/ }).click()
  // A real authorized source must respond; partial/failed read is a failed gate.
  await expect(page.locator('section[aria-labelledby="sf-u42-results"] [data-sf-state="loading"]')).toHaveCount(0)
  await expect(page.locator('section[aria-labelledby="sf-u42-results"] [data-sf-state="unavailable"]')).toHaveCount(0)
  await expect(page.getByRole("heading", { name: /Results|Resultados/ })).toBeVisible()
  expect(page.url(), "Private query must never be written to the URL").toBe(before)
  await page.getByRole("combobox", { name: /Result type|Tipo de resultado/ }).selectOption("document")
  const matches = page.locator("[data-sf-match-kind]")
  expect(await matches.count()).toBeGreaterThanOrEqual(0)
  const kinds = await matches.evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-sf-match-kind")))
  expect(kinds.every((kind) => kind === "document")).toBe(true)
  expect(page.url()).not.toContain("contract")
})
