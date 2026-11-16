/**
 * Inert installed-browser consumer for mission 232. Do not register this spec
 * until the exact F01/227/228/231 postimages are applied to candidate C.
 * No route.fulfill, login token, fabricated principal, synthetic permission,
 * mocked source body, or AM positive claim.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test, armHeldResponse } from "../fixture"

function installedHref(shellOrigin: string, chapterHref: string, pathname: string) {
  const url = new URL(chapterHref, shellOrigin)
  url.pathname = pathname
  return url.toString()
}

test("F01/231 native Today resumes original source case, UI34 opens, browser back restores focus", async ({ page, nativeHarness }) => {
  const { target } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await page.goto(installedHref(target.shellOrigin, target.chapterHref, "/orchestra/sf-home"))
  const home = page.locator('[data-sf-home="authorized"]')
  await expect(home).toBeVisible()
  const resumes = home.getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes, "Original projection.home must expose an admitted case").not.toHaveCount(0)
  const button = resumes.first()
  const label = await button.getAttribute("aria-label")
  expect(label).toBeTruthy()
  await button.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/orchestra\/sf-decisions\/r_[A-Za-z0-9_-]+(?:\?|$)/)
  await expect(page.locator(".sf-n24-metadata")).toBeVisible()
  await page.goBack()
  await expect(home).toBeVisible()
  await expect(home.getByRole("button", { name: label! })).toBeFocused()
})

test("F01/231 denies exact wrong original project/installation and never retains Home data", async ({ page, nativeHarness }) => {
  const { target, wrongProject, wrongInstallation } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  for (const wrong of [wrongProject, wrongInstallation]) {
    const url = new URL("/orchestra/sf-home", target.shellOrigin)
    url.search = new URLSearchParams({
      server: target.serverKey,
      project: wrong.projectId,
      installation: wrong.installationId,
    }).toString()
    await page.goto(url.toString())
    await expect(page.locator('[data-sf-home="authorized"]')).not.toBeVisible()
    await expect(page.locator('[data-sf-f01]')).toBeVisible()
  }
})

test("F01/231 rejects wrong ServerConnection and partial owner query before a source read", async ({ page, nativeHarness }) => {
  const { target, wrongServer } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const wrong = new URL("/orchestra/sf-home", target.shellOrigin)
  wrong.search = new URLSearchParams({
    server: wrongServer.serverKey,
    project: target.projectId,
    installation: target.installationId,
  }).toString()
  await page.goto(wrong.toString())
  await expect(page.locator('[data-sf-home="authorized"]')).not.toBeVisible()
  const partial = new URL("/orchestra/sf-home?server=" + encodeURIComponent(target.serverKey), target.shellOrigin)
  await page.goto(partial.toString())
  await expect(page.locator('[data-sf-f01="invalid-link"]')).toBeVisible()
  await expect(page.locator('[data-sf-home="authorized"]')).not.toBeVisible()
})

test("F01/231 aborts one held real projection.case response after leaving Today", async ({ page, nativeHarness }) => {
  const { target } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await page.goto(installedHref(target.shellOrigin, target.chapterHref, "/orchestra/sf-home"))
  const resumes = page.locator('[data-sf-home="authorized"]')
    .getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes).not.toHaveCount(0)
  const source = new URL(target.mount + "/api/ui/projections/case", target.publicOrigin)
  const held = await armHeldResponse(page, { origin: source.origin,
    pathname: source.pathname, method: "GET" })
  try {
    await resumes.first().click()
    await expect.poll(() => held.observations().attempts).toBe(1)
    await page.goto(installedHref(target.shellOrigin, target.chapterHref, "/orchestra/sf-home/context"), {
      waitUntil: "domcontentloaded",
    })
    held.release()
    await expect(page.locator(".sf-n24-metadata")).not.toBeVisible()
  } finally {
    await held.dispose()
  }
})

/*
 * Additional negative source-backed obligations for 232, NOT_RUN at 231:
 * - Revoked access: requires a privileged original producer revocation action;
 *   call fixture.requestRealRevocation with an ACTUAL provided revokeViaProducer.
 *   No revoker public seam exists here; do not invent one.
 * - Dirty owner-switch: requires an original editor that acquires the F01
 *   SfDraftRegistry; the existing UI33 form has only its own local state.
 *   Verify genuine pending edit, cancel discard, owner remains, then explicit
 *   discard purges before switching the real installation.
 * - Same-owner accessRevision drift: require a legitimate original source policy
 *   revision and a subsequent context read, not a forged 403.
 */
