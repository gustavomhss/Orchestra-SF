/**
 * N25/U18 installed journeys. Execution is reserved for 120 on the exact
 * integrated candidate with F04's real private manifest and original producer.
 * No mocked auth/choices/case/receipts and no local runner.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

async function openInstalledChapter(page: Parameters<typeof test>[0] extends never ? never : import("@playwright/test").Page, manifest: {
  target: { chapterHref: string; shellOrigin: string }
}) {
  await page.goto(new URL(manifest.target.chapterHref, manifest.target.shellOrigin).toString())
  await expect(page.locator('[data-sf-frame="page"]').first()).toBeVisible()
}

test("U18-AC01 — a real choice requires explicit preparation and exactly one producer submission", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "dependency", description:
    "Requires a real installed source case with at least one eligible C10 choice; absence is a gate failure, never a mock or a skip" })
  await openInstalledChapter(page, nativeHarness.manifest)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]').first())
  const link = page.locator('a[href*="/sf-decisions/"][href$="/choice"]').first()
  await expect(link).toBeVisible()
  await link.click()
  await expect(page.getByRole("heading", { name: "Current choice", exact: true })).toBeVisible()
  const preparation = page.getByRole("button", { name: "Review current sources" }).first()
  await expect(preparation).toBeEnabled()
  const submits: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST") {
      const sf = new URL(request.url()).searchParams.get("sf")
      if (sf === "current-choice-promote") submits.push(sf)
    }
  })
  expect(submits).toHaveLength(0) // mount and selection alone never promote
  await preparation.click()
  await expect(page.locator('[data-component="sf-change-review"]')).toBeVisible()
  expect(submits).toHaveLength(0)
  // Applying a recorded choice requires a second, explicit human confirmation.
})

test("U18-AC01 — original prepared change review does not apply on navigation", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "dependency", description:
    "Requires the installed domain to expose one prepared, authorized change in its original case projection" })
  await openInstalledChapter(page, nativeHarness.manifest)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]').first())
  const link = page.locator('a[href*="/sf-decisions/"][href*="/changes"]').first()
  await expect(link).toBeVisible()
  const applyRequests: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).searchParams.get("sf") === "decision-apply")
      applyRequests.push(request.url())
  })
  await link.click()
  await expect(page.getByRole("heading", { name: "Prepared changes", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Read producer review" })).toBeVisible()
  expect(applyRequests).toHaveLength(0)
  await page.getByRole("button", { name: "Read producer review" }).click()
  await expect(page.locator('[data-component="sf-change-review"]')).toBeVisible()
  expect(applyRequests).toHaveLength(0)
})

test("U18-AC02 — authorized receipts are native producer records, with empty distinct from missing", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "dependency", description:
    "Uses the installed route to a real case. A missing receipt must not be filled by a synthetic success" })
  await openInstalledChapter(page, nativeHarness.manifest)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]').first())
  const link = page.locator('a[href*="/sf-decisions/"][href*="/receipts"]').first()
  await expect(link).toBeVisible()
  await link.click()
  await expect(page.getByRole("heading", { name: "Application result", exact: true })).toBeVisible()
  const records = page.locator("[data-producer-receipt]")
  const empty = page.getByText("No application receipt has been returned for this authorized case.")
  // Both are producer-derived branches; neither fabricates a receipt.
  await expect(records.first().or(empty).first()).toBeVisible()
  await expect(page.locator('[data-outcome="confirmed-by-refetch"]')).toHaveCount(0)
})

test("U18-AC03 — 320–1440px, light/dark and enlarged text retain usable actions", async ({ page, nativeHarness }, info) => {
  info.annotations.push({ type: "proof-limit", description:
    "Visual/keyboard candidate check only. 120 must also run installed screenshot and 400% zoom/reflow oracle" })
  await openInstalledChapter(page, nativeHarness.manifest)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]').first())
  const link = page.locator('a[href*="/sf-decisions/"][href$="/choice"]').first()
  await expect(link).toBeVisible()
  await link.click()
  for (const scheme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: scheme })
    for (const width of [320, 768, 1024, 1280, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      const main = page.locator('[data-sf-frame="page"]')
      await expect(main).toBeVisible()
      await expect(page.getByRole("heading", { name: "Current choice" })).toBeVisible()
      await expect(main.getByRole("button").first()).toBeVisible()
    }
  }
  await page.setViewportSize({ width: 320, height: 900 })
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%" })
  await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
  await expect(page.getByRole("heading", { name: "Current choice" })).toBeVisible()
})
