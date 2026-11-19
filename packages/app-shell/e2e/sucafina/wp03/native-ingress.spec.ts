import { expect, test } from "@playwright/test"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { startPlannerInstallation } from "./installation-fixture"

test.use({ trace: "off", video: "off" })

test("the real installed operator reaches native CAP23 through the shell origin", async ({ page }, info) => {
  const network: { operation: string; status: number; outcome?: string; reason?: string }[] = []
  const browserErrors: string[] = []
  page.on("pageerror", (error) => browserErrors.push(error.name))
  page.on("console", (message) => {
    if (message.type() === "warning" && message.text().startsWith("Sucafina context transport failed "))
      console.info(message.text())
  })
  page.on("response", async (response) => {
    const path = new URL(response.url()).pathname
    const operation = path === "/api/sucafina/installations" ? "discovery" :
      path === "/sucafina/api/ui/context" ? "context" : undefined
    if (!operation || network.length >= 40) return
    const entry: (typeof network)[number] = { operation, status: response.status() }
    network.push(entry)
    if (operation === "context") {
      const body: unknown = await response.json().catch(() => undefined)
      if (body && typeof body === "object") {
        if ("status" in body && typeof body.status === "string") entry.outcome = body.status
        if ("reason" in body && typeof body.reason === "string") entry.reason = body.reason
      }
    }
  })
  const installation = await test.step("Launch the real isolated installation", () => startPlannerInstallation(info))
  try {
    const live = await test.step("Discover and select the original installed context", () => installation.signIn(page))
    const expectedBinding = {
      installationId: live.binding.installationId,
      projectId: live.binding.projectId,
      hostId: live.binding.hostId,
    }
    expect(SfNativeOperationBindings["ctx.context"]?.decodeInput(expectedBinding))
      .toEqual({ status: "ok", value: expectedBinding })
    await page.goto("/orchestra/sf-planner/versions")
    expect(new URL(page.url()).origin).toBe(installation.origin)
    await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
    expect(live.context.stamp.principalRef).toBe(installation.actorId)
    await page.reload()
    await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
    await page.goto("/orchestra/sf-planner/versions?year=2026")
    await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
    const refreshed = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.request().method() === "GET")
    await page.getByRole("button", { name: "Refresh access", exact: true }).click()
    expect((await refreshed).status()).toBe(200)
    await expect(page.locator('[data-sf-surface="CAP23"]')).toBeVisible()
    const logout = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/sucafina/auth/logout" && response.request().method() === "POST")
    const revoked = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
    await page.getByRole("button", { name: "Sign out", exact: true }).click()
    expect((await logout).status()).toBe(204)
    expect((await revoked).status()).toBe(401)
    await expect(page.locator('[data-sf-host="owner-runtime231"]')).toHaveAttribute("data-sf-provider-state", "unauthenticated")
    await expect(page.locator('[data-sf-surface="CAP23"]')).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Sign out", exact: true })).toHaveCount(0)
    const deniedReload = page.waitForResponse((response) =>
      new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
    await page.getByRole("button", { name: "Refresh access", exact: true }).click()
    expect((await deniedReload).status()).toBe(401)
    await expect(page.locator('[data-sf-surface="CAP23"]')).toHaveCount(0)
  } catch (error) {
    console.log("INSTALLED_NATIVE_RENDER", JSON.stringify({
      path: new URL(page.url()).pathname,
      owners: await page.locator('[data-sf-host="owner-runtime231"]').evaluateAll((nodes) => nodes.map((node) => ({
        discovery: node.getAttribute("data-sf-discovery-state"),
        provider: node.getAttribute("data-sf-provider-state"),
        reason: node.getAttribute("data-sf-provider-reason"),
        view: node.getAttribute("data-sf-view-state"),
      }))),
      states: await page.locator("[data-sf-f01]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-sf-f01"))),
      network, browserErrors,
    }))
    throw error
  } finally {
    await installation.stop()
  }
})
