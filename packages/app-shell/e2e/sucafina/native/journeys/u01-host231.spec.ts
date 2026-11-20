/**
 * Inert installed-browser consumer for mission 232. Do not register this spec
 * until the exact F01/227/228/231 postimages are applied to candidate C.
 * No route.fulfill, login token, fabricated principal, synthetic permission,
 * mocked source body, or AM positive claim.
 */
import { expect, type Page, type Request } from "@playwright/test"
import { nativeInstalledFixture, armHeldResponse, type NativeTarget } from "../fixture"
import { nativeOwnerQuery } from "../fixture/manifest-contract"
import { nativeContextURL } from "../fixture/readiness"

const test = nativeInstalledFixture
const homePath = "/orchestra/sf-home"
const homeProjection = '[data-sf-home="authorized"]'

function installedHref(target: NativeTarget, pathname: string, query = nativeOwnerQuery(target)) {
  return new URL(pathname + "?" + query, target.shellOrigin).href
}

async function expectHomeBlocked(page: Page, branch: "invalid" | "denied") {
  const content = page.locator("#sf-team-content")
  const alert = content.getByRole("alert").filter({ hasText: branch === "invalid"
    ? /^(This link does not identify a valid Team profile for this installation\.|Este link n\u00e3o identifica um perfil do Teams v\u00e1lido para esta instala\u00e7\u00e3o\.)$/
    : /^(This Team is not available for this account\.|Esta equipe n\u00e3o est\u00e1 dispon\u00edvel para esta conta\.)$/ })
  const denied = page.locator('[data-sf-teams-state="denied"] [data-sf-team-status]').and(page.getByRole("status"))
  await expect(branch === "denied" ? alert.or(denied) : alert).toBeVisible()
  await expect(content.locator(homeProjection + ', [data-sf-frame="page"]')).toHaveCount(0)
}

test("F01/231 native Today resumes original source case, UI34 opens, browser back restores focus", async ({ page, nativeHarness }) => {
  const { target } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const homeHref = installedHref(target, homePath)
  await page.goto(homeHref)
  const home = page.locator(homeProjection)
  await expect(home).toBeVisible()
  const resumes = home.getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes, "Original projection.home must expose an admitted case").not.toHaveCount(0)
  const button = resumes.first()
  const label = await button.getAttribute("aria-label")
  if (!label) throw new Error("F01/231 resume button did not expose its case label")
  await button.focus()
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL((url) => /^\/orchestra\/sf-decisions\/r_[A-Za-z0-9_-]+$/.test(url.pathname) &&
    url.href === installedHref(target, url.pathname))
  await expect(page.locator(".sf-n24-metadata")).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(homeHref)
  await expect(home).toBeVisible()
  await expect(home.getByRole("button", { name: label, exact: true })).toBeFocused()
})

// Keep the registered title; the former project selector is now the exact Team.
test("F01/231 denies exact wrong original project/installation and never retains Home data", async ({ page, nativeHarness }) => {
  const { target, wrongTeam, wrongInstallation } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await page.goto(installedHref(target, homePath))
  await expect(page.locator(homeProjection)).toBeVisible()
  await page.goto(installedHref(wrongTeam, homePath))
  await expectHomeBlocked(page, "denied")
  await page.goto(installedHref(wrongInstallation, homePath))
  await expectHomeBlocked(page, "invalid")
})

test("F01/231 rejects wrong ServerConnection and partial owner query before a source read", async ({ page, nativeHarness }) => {
  const { target, wrongServer } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const requests: URL[] = []
  const observeRead = (request: Request) => {
    const url = new URL(request.url())
    if ([target.publicOrigin, wrongServer.publicOrigin].includes(url.origin) &&
        [target.mount, wrongServer.mount].some((mount) => url.pathname.startsWith(mount + "/api/ui/"))) requests.push(url)
  }
  page.on("request", observeRead)
  try {
    await page.goto(installedHref(target, homePath))
    await expect(page.locator(homeProjection)).toBeVisible()
    const context = new URL(nativeContextURL(target))
    expect(requests.some((url) => url.origin === context.origin && url.pathname === context.pathname &&
      url.searchParams.get("teamObjectId") === target.teamObjectId)).toBe(true)
    requests.length = 0

    const wrong = nativeOwnerQuery(target)
    wrong.set("server", wrongServer.serverKey)
    await page.goto(installedHref(target, homePath, wrong))
    await expectHomeBlocked(page, "invalid")
    expect(requests).toHaveLength(0)

    const partial = new URLSearchParams({ server: target.serverKey })
    await page.goto(installedHref(target, homePath, partial))
    await expectHomeBlocked(page, "invalid")
    expect(requests).toHaveLength(0)
  } finally { page.off("request", observeRead) }
})

test("F01/231 aborts one held real projection.case response after leaving Today", async ({ page, nativeHarness }) => {
  const { target } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).toString())
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await page.goto(installedHref(target, homePath))
  const resumes = page.locator(homeProjection)
    .getByRole("button", { name: /^(Resume case|Retomar caso):/ })
  await expect(resumes).not.toHaveCount(0)
  const source = new URL(target.mount + "/api/ui/projections/case", target.publicOrigin)
  const held = await armHeldResponse(page, { origin: source.origin,
    pathname: source.pathname, method: "GET" })
  try {
    const [heldRequest] = await Promise.all([
      page.waitForRequest((request) => request.url().startsWith(source.href + "?") && request.method() === "GET"),
      resumes.first().click(),
    ])
    await expect.poll(() => {
      try { return held.observations().producerStatus }
      catch { return undefined }
    }, { message: "Exactly one real projection.case GET must return before leaving Today" }).toBe(200)
    await page.goto(installedHref(target, "/orchestra/sf-home/context"), {
      waitUntil: "domcontentloaded",
    })
    const shell = page.locator('[data-sf-teams-state="authenticated"]')
    await expect(shell).toHaveAttribute("data-sf-team-selected", target.teamObjectId)
    await expect(shell.locator("[data-sf-team-status]").and(page.getByRole("status"))).toBeVisible()
    held.release()
    await (await heldRequest.response())?.finished()
    await expect(page.locator(homeProjection + ", .sf-n24-metadata")).toHaveCount(0)
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
