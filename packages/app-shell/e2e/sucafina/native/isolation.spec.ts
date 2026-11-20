/**
 * Q01.complete: real installed actor/owner isolation. Never synthesizes a
 * principal, an ACL result, a session cookie, or a successful revocation.
 * A runner must supply separate genuinely authenticated actor contexts.
 */
import { expect, type Page } from "@playwright/test"
import { Schema } from "effect"
import { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { armHeldResponse, nativeInstalledFixture, observeNativeBinding,
  type InstalledNativeHarness, type NativeTarget } from "./fixture"
import { nativeOwnerQuery } from "./fixture/manifest-contract"
import { nativeContextURL } from "./fixture/readiness"

const test = nativeInstalledFixture
const homePath = "/orchestra/sf-home"
const authorized = '[data-sf-frame="page"], [data-sf-context="authorized"], [data-sf-home="authorized"]'
const options = { maxRedirects: 0, maxRetries: 0 }
const decodeContext = Schema.decodeUnknownSync(Schema.toCodecJson(SfTeamContextResult), { onExcessProperty: "error" })

function urlFor(target: NativeTarget, route = homePath): string {
  return new URL(route + "?" + nativeOwnerQuery(target), target.shellOrigin).href
}

async function expectBlocked(page: Page, branch: "invalid" | "denied") {
  const content = page.locator("#sf-team-content")
  const alert = content.getByRole("alert").filter({ hasText: branch === "invalid"
    ? /^(This link does not identify a valid Team profile for this installation\.|Este link n\u00e3o identifica um perfil do Teams v\u00e1lido para esta instala\u00e7\u00e3o\.)$/
    : /^(This Team is not available for this account\.|Esta equipe n\u00e3o est\u00e1 dispon\u00edvel para esta conta\.)$/ })
  const denied = page.locator('[data-sf-teams-state="denied"] [data-sf-team-status]').and(page.getByRole("status"))
  await expect(branch === "denied" ? alert.or(denied) : alert).toBeVisible()
  await expect(content.locator(authorized)).toHaveCount(0)
}

async function verified(page: Page, harness: InstalledNativeHarness) {
  await page.goto(new URL(harness.manifest.target.chapterHref, harness.manifest.target.shellOrigin).href)
  return harness.proveWeb(page.locator('[data-sf-frame="page"]'))
}

test.describe("Q01 real actor/context and stale projection fences", () => {
  test.describe.configure({ mode: "default", retries: 0 })
  for (const actor of ["requester", "holder", "denied"] as const) {
    test("Q01-ISO-REAL-ACTOR-" + actor + " must be an authentic principal", async ({ page, nativeHarness }) => {
      // F04's manifest only NAMES the expected real actors. We do not turn its
      // names into a login, token, session or proof of holder authority.
      const { target, actors } = nativeHarness.manifest
      await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
      // A genuine Microsoft principal can have no business rights; do not
      // require a mounted chapter to observe the actor in that case.
      const live = await observeNativeBinding(page, target)
      await expect(page.locator('[data-sf-teams-state="authenticated"]')).toBeVisible()
      expect(live.stamp.principalRef,
        "129 must execute this case under the real " + actor + " session; never reuse requester storageState")
        .toBe(actors[actor])
      expect(live.profile.principal.principalObjectId).toBe(actors[actor])
      expect(live.profile.principal.tenantId).toBe(target.tenantId)
      expect(live.stamp).toMatchObject({ installationId: target.installationId, projectId: target.projectId, hostId: target.hostId })
    })
  }

  test("Q01-ISO-CROSS-OWNER denies B without falling back to selected A", async ({ page, nativeHarness }) => {
    const { target, wrongServer, wrongTeam, wrongInstallation } = nativeHarness.manifest
    const before = await verified(page, nativeHarness)
    const original = await observeNativeBinding(page, target)
    expect(original.stamp.principalRef).toBe(before.principalRef)
    const profile = original.stamp.team?.owner.profile
    expect(profile).toEqual({ installationId: target.installationId, tenantId: target.tenantId, teamObjectId: target.teamObjectId })
    const boundaries = [
      { id: "SERVER", other: wrongServer, branch: "invalid" },
      // Retain the frozen reporting ID; the changed selector is now Team only.
      { id: "PROJECT", other: wrongTeam, branch: "denied" },
      { id: "INSTALLATION", other: wrongInstallation, branch: "invalid" },
    ] as const
    for (const { id, other, branch } of boundaries) {
      await test.step("Q01-ISO-BOUNDARY-" + id, async () => {
        await page.goto(urlFor(other))
        await expectBlocked(page, branch)
        expect(page.url()).not.toContain("principalRef=")
        expect(page.url()).not.toContain("auth=")
        const next = await page.request.get(nativeContextURL(other), options)
        if (next.status() === 200) {
          const result = decodeContext(await next.json())
          if (result.status !== "ok") throw new Error("Q01_REAL_CONTEXT_NOT_AUTHORIZED")
          // An authenticated denial can lack a business stamp. If a stamp is
          // returned, it cannot be the original Team A authority.
          expect(result.value.stamp).not.toMatchObject({
            principalRef: before.principalRef, hostId: target.hostId, projectId: target.projectId,
            installationId: target.installationId, team: { owner: { profile } },
          })
          return
        }
        expect([400, 401, 403, 404, 409, 503]).toContain(next.status())
      })
    }
  })

  test("Q01-ISO-LATE-READ cannot resurrect owner A after real owner-B transition", async ({ page, nativeHarness }) => {
    const { target, wrongTeam } = nativeHarness.manifest
    await verified(page, nativeHarness)
    await page.goto(urlFor(target))
    await expect(page.locator('[data-sf-home="authorized"]')).toBeVisible()
    const source = new URL(nativeContextURL(target))
    const fault = await armHeldResponse(page, {
      origin: source.origin, pathname: source.pathname, method: "GET", query: Object.fromEntries(source.searchParams),
    })
    try {
      // The existing producer is called; the response is held at delivery only.
      const [heldRequest, reloaded] = await Promise.all([
        page.waitForRequest((request) => {
          const url = new URL(request.url())
          return request.method() === "GET" && url.origin === source.origin && url.pathname === source.pathname &&
            [...source.searchParams].every(([key, value]) => url.searchParams.get(key) === value)
        }),
        page.reload({ waitUntil: "domcontentloaded" }),
      ])
      expect(reloaded?.ok()).toBe(true)
      await expect.poll(() => {
        try { return fault.observations().attempts }
        catch { return 0 }
      }, { message: "Real producer GET must be observed before the transition" }).toBe(1)
      await page.goto(urlFor(wrongTeam), { waitUntil: "domcontentloaded" })
      await expectBlocked(page, "denied")
      const observation = fault.observations()
      expect(observation.producerStatus).toBe(200)
      fault.release()
      await (await heldRequest.response())?.finished()
      await expectBlocked(page, "denied")
    } finally { await fault.dispose() }
  })

  // Run last and with a disposable invocation: the real sign-out invalidates
  // the host-owned requester session, not just this test page.
  test("Q01-ISO-LOGOUT purges private UI and does not replay the session", async ({ page, nativeHarness }) => {
    const { target } = nativeHarness.manifest
    await verified(page, nativeHarness)
    await page.goto(urlFor(target))
    await expect(page.locator('[data-sf-home="authorized"]')).toBeVisible()
    const logoutURL = new URL(target.mount + "/auth/logout", target.publicOrigin).href
    const [logout] = await Promise.all([
      page.waitForResponse((response) => response.url() === logoutURL && response.request().method() === "POST"),
      page.getByRole("button").and(page.locator("[data-sf-sign-out]")).click(),
    ])
    expect(logout.status(), "Only a real producer-confirmed logout can satisfy this check").toBe(204)
    const signedOut = page.locator('[data-sf-teams-state="unauthenticated"] [data-sf-team-status]').and(page.getByRole("status"))
    await expect(signedOut).toBeVisible()
    await expect(page.locator(authorized)).toHaveCount(0)
    await page.goto(urlFor(target))
    await expect(signedOut).toBeVisible()
    await expect(page.locator(authorized)).toHaveCount(0)
    const after = await page.request.get(nativeContextURL(target), options)
    expect([401, 403]).toContain(after.status())
  })
})
