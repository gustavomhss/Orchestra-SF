import { expect, type Response } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, SfExpectedContextBinding } from "@orchestra/schema/sucafina/context"
import { reportsTest } from "./reports-support/fixture.ts"

// The original Reports fixture owns preparation, corpus, CLI, enrollment,
// authenticated discovery and real shell selection. No Reports journey is replaced.
reportsTest.use({ trace: "off", video: "off", screenshot: "off" })
reportsTest.describe.configure({ retries: 0, timeout: 180_000 })

reportsTest("Reports ingress binds the actual installed owner and revokes its native context", async ({ page, reports }, info) => {
  const app = reports.app
  expect(app.origin).toBe(info.project.use.baseURL)
  expect(app.origin).toBe("http://127.0.0.1:3000")
  expect(app.mount).toBe("/sucafina")
  const owner = page.locator('[data-sf-host="owner-runtime231"]')
  const surface = page.locator('[data-sf-surface="CAP23"]')
  const isContext = (response: Response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.origin === app.origin &&
      url.pathname === app.mount + "/api/ui/context"
  }
  const bindingFor = (response: Response) => {
    expect(isContext(response)).toBe(true)
    const query = new URL(response.url()).searchParams
    expect([...query.keys()].sort()).toEqual(["hostId", "installationId", "projectId"])
    return Schema.decodeUnknownSync(SfExpectedContextBinding, { onExcessProperty: "error" })(Object.fromEntries(query))
  }
  const admitted = async (response: Response) => {
    expect(response.status()).toBe(200)
    const binding = bindingFor(response)
    // This independent authorized read verifies the binding observed in the
    // browser request. It never substitutes or replays the browser's response.
    const original = await page.request.get(response.url(), { maxRetries: 0 })
    expect(original.status()).toBe(200)
    expect(original.headers()["content-type"]).toContain("application/json")
    const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await original.json())
    expect(context.status).toBe("ok")
    if (context.status !== "ok") throw new Error("The original Reports owner context was not admitted")
    expect(context.value.authMode).toBe("local-operator")
    expect(context.value.stamp).toMatchObject({ ...binding, principalRef: app.actorId })
    return binding
  }

  const binding = await reportsTest.step("Use the Reports fixture's original discovery and selected native owner", async () => {
    const [context, document] = await Promise.all([
      page.waitForResponse(isContext, { timeout: 10_000 }),
      page.goto(new URL("/orchestra/sf-planner/versions", app.origin).href),
    ])
    expect(document?.status()).toBe(200)
    const selected = await admitted(context)
    await expect(owner).toHaveCount(1)
    await expect(owner).toHaveAttribute("data-sf-discovery-state", "ready")
    await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
    await expect(owner).toHaveAttribute("data-sf-view-state", "ready")
    await expect(surface).toBeVisible()
    await expect(owner.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
    await expect(owner.getByRole("button", { name: "Refresh access", exact: true })).toBeEnabled()
    return selected
  })

  await reportsTest.step("Reload and refresh the same authorized installation without enrolling again", async () => {
    const [reloaded] = await Promise.all([
      page.waitForResponse(isContext, { timeout: 10_000 }),
      page.reload(),
    ])
    expect(await admitted(reloaded)).toEqual(binding)
    await expect(surface).toBeVisible()
    await expect(owner.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
    const [refreshed] = await Promise.all([
      page.waitForResponse(isContext, { timeout: 10_000 }),
      owner.getByRole("button", { name: "Refresh access", exact: true }).click(),
    ])
    expect(await admitted(refreshed)).toEqual(binding)
    await expect(owner).toHaveAttribute("data-sf-provider-state", "ready")
    await expect(surface).toBeVisible()
  })

  await reportsTest.step("Sign out through the original handler and retain the exact unauthenticated boundary", async () => {
    const [logout, revoked] = await Promise.all([
      page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "POST" && url.origin === app.origin &&
          url.pathname === app.mount + "/auth/logout"
      }, { timeout: 10_000 }),
      page.waitForResponse(isContext, { timeout: 10_000 }),
      owner.getByRole("button", { name: "Sign out", exact: true }).click(),
    ])
    expect(logout.status()).toBe(204)
    expect(revoked.status()).toBe(401)
    expect(bindingFor(revoked)).toEqual(binding)
    const original = await page.request.get(revoked.url(), { maxRetries: 0 })
    expect(original.status()).toBe(401)
    expect(await original.json()).toEqual({ status: "unauthenticated" })
    await expect(owner).toHaveAttribute("data-sf-provider-state", "unauthenticated")
    await expect(surface).toHaveCount(0)
    await expect(owner.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0)

    const [refreshed] = await Promise.all([
      page.waitForResponse(isContext, { timeout: 10_000 }),
      owner.getByRole("button", { name: "Refresh access", exact: true }).click(),
    ])
    expect(refreshed.status()).toBe(401)
    expect(bindingFor(refreshed)).toEqual(binding)
    await expect(owner).toHaveAttribute("data-sf-provider-state", "unauthenticated")
    await expect(surface).toHaveCount(0)
    await expect(owner.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0)
  })
})
