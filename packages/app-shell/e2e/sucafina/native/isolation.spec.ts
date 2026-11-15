/**
 * Q01.complete: real installed actor/owner isolation. Never synthesizes a
 * principal, an ACL result, a session cookie, or a successful revocation.
 * A runner must supply separate genuinely authenticated actor contexts.
 */
import { randomUUID } from "node:crypto"
import { expect } from "@playwright/test"
import { armHeldResponse, nativeInstalledFixture as test } from "./fixture"
import type { NativeTarget } from "./fixture/readiness"

function urlFor(target: NativeTarget, route = target.chapterHref): string {
  const url = new URL(route, target.shellOrigin)
  url.searchParams.set("server", target.serverKey)
  url.searchParams.set("project", target.projectId)
  url.searchParams.set("installation", target.installationId)
  return url.href
}
async function actualContext(page: import("@playwright/test").Page, target: NativeTarget) {
  const url = new URL(target.mount + "/api/ui/context", target.publicOrigin)
  url.searchParams.set("installationId", target.installationId)
  url.searchParams.set("projectId", target.projectId)
  url.searchParams.set("hostId", target.hostId)
  const response = await page.request.get(url.href, { maxRedirects: 0, maxRetries: 0 })
  const body: unknown = response.headers()["content-type"]?.includes("application/json")
    ? await response.json() : undefined
  return { status: response.status(), body }
}
function stampOf(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || !("status" in value) || value.status !== "ok" ||
      !("value" in value) || !value.value || typeof value.value !== "object" ||
      !("stamp" in value.value) || !value.value.stamp ||
      typeof value.value.stamp !== "object") throw new Error("Q01_REAL_CONTEXT_NOT_AUTHORIZED")
  return value.value.stamp as Record<string, unknown>
}
async function verified(page: import("@playwright/test").Page,
                        harness: import("./fixture").InstalledNativeHarness) {
  await page.goto(new URL(harness.manifest.target.chapterHref, harness.manifest.target.shellOrigin).href)
  return harness.proveWeb(page.locator('[data-sf-frame="page"]'))
}

test.describe("Q01 real actor/context and stale projection fences", () => {
  test.describe.configure({ retries: 0 })
  for (const actor of ["requester", "holder", "denied"] as const) {
    test("Q01-ISO-REAL-ACTOR-" + actor + " must be an authentic principal", async ({ page, nativeHarness }) => {
      // F04's manifest only NAMES the expected real actors. We do not turn its
      // names into a login, token, session or proof of holder authority.
      const identity = await verified(page, nativeHarness)
      expect(identity.principalRef,
        "129 must execute this case under the real " + actor + " session; never reuse requester storageState")
        .toBe(nativeHarness.manifest.actors[actor])
      const actual = await actualContext(page, nativeHarness.manifest.target)
      expect(actual.status).toBe(200)
      const stamp = stampOf(actual.body)
      expect(stamp.principalRef).toBe(identity.principalRef)
      expect(stamp.projectId).toBe(identity.projectId)
      expect(stamp.installationId).toBe(identity.installationId)
      expect(stamp.hostId).toBe(identity.hostId)
    })
  }

  test("Q01-ISO-CROSS-OWNER denies B without falling back to selected A", async ({ page, nativeHarness }) => {
    const { target, wrongServer, wrongProject, wrongInstallation } = nativeHarness.manifest
    const before = await verified(page, nativeHarness)
    const original = await actualContext(page, target)
    expect(original.status).toBe(200)
    expect(stampOf(original.body).principalRef).toBe(before.principalRef)
    for (const other of [wrongServer, wrongProject, wrongInstallation]) {
      await test.step("Q01-ISO-BOUNDARY-" + (
        other === wrongServer ? "SERVER" : other === wrongProject ? "PROJECT" : "INSTALLATION"
      ), async () => {
        await page.goto(urlFor(other, "/orchestra/sf-home/context"))
        await expect(page.locator('[data-sf-context="authorized"]')).toHaveCount(0)
        await expect(page.locator('[data-sf-state="denied"], [data-sf-state="invalid"], [data-sf-state="unavailable"], [data-sf-state="session-expired"]')).toBeVisible()
        expect(page.url()).not.toContain("principalRef=")
        expect(page.url()).not.toContain("auth=")
        const next = await actualContext(page, other)
        // No forged host/project/installation can be accepted as A's exact stamp.
        if (next.status === 200) {
          const stamp = stampOf(next.body)
          expect(
            stamp.projectId !== target.projectId ||
            stamp.installationId !== target.installationId ||
            stamp.hostId !== target.hostId ||
            stamp.principalRef !== before.principalRef,
          ).toBe(true)
        } else {
          expect([400, 401, 403, 404, 409, 503]).toContain(next.status)
        }
      })
    }
  })

  test("Q01-ISO-LOGOUT purges private UI and does not replay the session", async ({ page, nativeHarness }) => {
    const { target } = nativeHarness.manifest
    await verified(page, nativeHarness)
    await page.goto(urlFor(target, "/orchestra/sf-home/context"))
    await expect(page.locator('[data-sf-context="authorized"]')).toBeVisible()
    const logout = await page.request.post(target.publicOrigin + target.mount + "/auth/logout", {
      headers: { "Idempotency-Key": randomUUID() }, maxRedirects: 0, maxRetries: 0,
    })
    expect(logout.status(), "Only a real producer-confirmed logout can satisfy this check").toBe(204)
    await page.reload()
    await expect(page.locator('[data-sf-context="authorized"]')).toHaveCount(0)
    await expect(page.locator('[data-sf-state="session-expired"], [data-sf-state="denied"]')).toBeVisible()
    const after = await actualContext(page, target)
    expect([401, 403]).toContain(after.status)
  })

  test("Q01-ISO-LATE-READ cannot resurrect owner A after real owner-B transition", async ({ page, nativeHarness }) => {
    const { target, wrongProject } = nativeHarness.manifest
    await verified(page, nativeHarness)
    const fault = await armHeldResponse(page, {
      origin: target.publicOrigin, pathname: target.mount + "/api/ui/context", method: "GET",
    })
    try {
      // The existing producer is called; the response is held at delivery only.
      const reloaded = await page.reload({ waitUntil: "domcontentloaded" })
      expect(reloaded?.ok()).toBe(true)
      await expect.poll(() => {
        try { return fault.observations().attempts }
        catch { return 0 }
      }, { message: "Real producer GET must be observed before the transition" }).toBe(1)
      await page.goto(urlFor(wrongProject, "/orchestra/sf-home/context"), { waitUntil: "domcontentloaded" })
      fault.release()
      const observation = fault.observations()
      expect(observation.producerStatus).toBe(200)
      await expect(page.locator('[data-sf-context="authorized"]')).toHaveCount(0)
      await expect(page.locator('[data-sf-state="denied"], [data-sf-state="invalid"], [data-sf-state="unavailable"], [data-sf-state="session-expired"]')).toBeVisible()
    } finally { await fault.dispose() }
  })
})
