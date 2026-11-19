import { expect, test, type Request } from "@playwright/test"
import { startPlannerInstallation } from "../wp03/installation-fixture"
import { addOwner, command, confirmDialog, dashboardUrl, monthlyForm, observeDashboardRequests, openMonth } from "./support"

test.use({ trace: "off" })

// All requests reach the installed CLI, its operator identity and durable store.
// The two intercepted replies below first execute against that real server; only
// delivery is interrupted or delayed. They never fabricate an authorized result.
test("installed Dashboard confirms exact monthly changes and purges late results after real logout", async ({ page }, info) => {
  test.setTimeout(180_000)
  const installation = await startPlannerInstallation(info)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const reader = await page.context().newPage()
  reader.on("pageerror", (error) => errors.push(error.message))
  const transport = observeDashboardRequests(info, [{ page, label: "primary" }, { page: reader, label: "reader" }])
  const url = dashboardUrl(installation.origin, "OPEX Detail")
  const producerURL = "/sucafina/dashboard?" + new URLSearchParams({ page: "OPEX Detail" })
  let owner = "", unrelated = "", applications = 0
  const lateDelivery: { release?: () => void } = {}
  const countApplications = (request: Request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/sucafina/dashboard" &&
      new URL(request.url()).searchParams.get("page") === "OPEX Detail" && request.postDataJSON()?.action === "apply-preview") applications++
  }
  page.on("request", countApplications)
  try {
    await test.step("create real fiscal lines and cancel a preview without changing saved months", async () => {
      await page.context().addCookies([installation.cookie])
      await page.goto(url)
      owner = await addOwner(page, "M67 Installed operating line", "1200")
      unrelated = await addOwner(page, "M67 Installed unrelated line", "2400")
      const month = await openMonth(page, owner, 1)
      await month.getByLabel("budget", { exact: true }).fill("123")
      await month.getByLabel("actual", { exact: true }).fill("34")
      await month.getByLabel("forecast", { exact: true }).fill("140")
      await command(page, month.getByRole("button", { name: "Save month", exact: true }), "preview-change")
      await expect(month.getByRole("heading", { name: "Review changes before applying", exact: true })).toBeVisible()
      await expect(month.locator("[data-preview]")).toContainText("123")
      await expect(month.locator("[data-preview]")).toContainText("34")
      await expect(month.locator("[data-preview]")).toContainText("140")
      await reader.goto(url)
      await expect(monthlyForm(reader, owner, 1)).toHaveAttribute("data-record", "")
      await expect(monthlyForm(reader, owner, 1).getByLabel("actual", { exact: true })).toHaveValue("")
      expect(applications).toBe(0)
      await confirmDialog(page, page.getByRole("dialog", { name: "Edit record", exact: true }).getByRole("button", { name: "Close editor", exact: true }), "Discard unsaved changes?", true)
      await expect(page.getByRole("dialog", { name: "Edit record", exact: true })).toBeHidden()
      await page.reload()
      await expect(monthlyForm(page, owner, 1)).toHaveAttribute("data-record", "")
      await expect(monthlyForm(page, owner, 1).getByLabel("budget", { exact: true })).toHaveValue("")
      expect(applications).toBe(0)
    })

    await test.step("recover an applied preview after its real successful response is lost", async () => {
      const month = await openMonth(page, owner, 1)
      await month.getByLabel("budget", { exact: true }).fill("123")
      await month.getByLabel("actual", { exact: true }).fill("34")
      await month.getByLabel("forecast", { exact: true }).fill("140")
      await command(page, month.getByRole("button", { name: "Save month", exact: true }), "preview-change")
      const preview = month.locator("[data-preview]")
      await expect(preview).toBeVisible()
      const ref = await preview.getAttribute("data-preview-ref")
      expect(ref).toBeTruthy()
      type Receipt = { status: number; applied: boolean; previewRef?: string }
      let delivered: ((receipt: Receipt) => void) | undefined
      const lost = new Promise<Receipt>((resolve) => { delivered = resolve })
      const dropApply = async (route: import("@playwright/test").Route) => {
        if (route.request().method() !== "POST" || route.request().postDataJSON()?.action !== "apply-preview") {
          await route.continue()
          return
        }
        const actual = await route.fetch()
        const body = await actual.json() as { value?: { applied?: boolean; previewRef?: string } }
        await route.abort("failed")
        delivered?.({ status: actual.status(), applied: body.value?.applied === true, previewRef: body.value?.previewRef })
      }
      await page.route(producerURL, dropApply)
      await month.getByRole("button", { name: "Confirm and apply", exact: true }).click()
      const receipt = await lost
      expect(receipt).toMatchObject({ status: 200, applied: true, previewRef: ref })
      await expect(month.getByRole("button", { name: "Check saved outcome", exact: true })).toBeEnabled()
      await page.unroute(producerURL, dropApply)
      const outcome = await command(page, month.getByRole("button", { name: "Check saved outcome", exact: true }), "read-preview")
      expect(outcome.value).toMatchObject({ applied: true, previewRef: ref })
      await expect(page.getByRole("dialog", { name: "Edit record", exact: true })).toBeHidden()
      expect(applications).toBe(1)
      await page.reload()
      await reader.reload()
      for (const surface of [page, reader]) {
        await expect(monthlyForm(surface, owner, 1).getByLabel("budget", { exact: true })).toHaveValue("123")
        await expect(monthlyForm(surface, owner, 1).getByLabel("actual", { exact: true })).toHaveValue("34")
        await expect(monthlyForm(surface, owner, 1).getByLabel("forecast", { exact: true })).toHaveValue("140")
        await expect(monthlyForm(surface, owner, 2)).toHaveAttribute("data-record", "")
        await expect(monthlyForm(surface, unrelated, 1)).toHaveAttribute("data-record", "")
      }
      const reopened = await openMonth(page, owner, 1)
      await expect(reopened.getByLabel("budget", { exact: true })).toHaveValue("123")
      await info.attach("dashboard-installed-confirmed-month.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
      await page.getByRole("dialog", { name: "Edit record", exact: true }).getByRole("button", { name: "Close editor", exact: true }).click()
    })

    await test.step("revoke the real session while a server-authorized preview is in flight", async () => {
      await page.reload()
      const ownerRow = page.locator(`tr[data-sf-row="${owner}"]`)
      await ownerRow.locator('button[data-sf-action="select"]').click()
      await expect(ownerRow).toHaveAttribute("aria-selected", "true")
      await page.locator(".sf-budget-detail").getByRole("button", { name: "Apply year amount", exact: true }).click()
      const year = page.locator('.sf-budget-editor[data-sf-action="year-amount"] form')
      await expect(year).toBeVisible()
      await year.getByLabel("Year amount", { exact: true }).fill("777")
      type LatePreview = { status: number; previewRef?: string }
      let captured: ((preview: LatePreview) => void) | undefined, completed: (() => void) | undefined
      const observed = new Promise<LatePreview>((resolve) => { captured = resolve })
      const released = new Promise<void>((resolve) => { completed = resolve })
      const hold = new Promise<void>((resolve) => { lateDelivery.release = resolve })
      const delayPreview = async (route: import("@playwright/test").Route) => {
        const request = route.request()
        if (request.method() !== "POST" || request.postDataJSON()?.action !== "preview-change") {
          await route.continue()
          return
        }
        const actual = await route.fetch()
        const body = await actual.json() as { value?: { previewRef?: string } }
        captured?.({ status: actual.status(), previewRef: body.value?.previewRef })
        await hold
        try { await route.fulfill({ response: actual }) } finally { completed?.() }
      }
      await page.route(producerURL, delayPreview)
      await year.getByRole("button", { name: "Apply year amount", exact: true }).click()
      const late = await observed
      expect(late.status).toBe(200)
      expect(late.previewRef).toBeTruthy()
      await expect(year.getByLabel("Year amount", { exact: true })).toHaveValue("777")
      const signedOut = reader.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).pathname === "/sucafina/auth/logout", { timeout: 15_000 })
      await reader.getByRole("button", { name: "Sign out", exact: true }).click()
      expect((await signedOut).status()).toBe(204)
      await expect(reader).toHaveURL(`${installation.origin}/sucafina/auth/login`)
      await page.getByRole("button", { name: "Refresh data", exact: true }).click()
      await expect(page.locator("[data-access-unavailable]")).toBeVisible()
      await expect(page.getByRole("status")).toHaveText("The previous view was removed. Reload to continue with your current permissions.")
      await expect(page.locator("form[data-command]")).toHaveCount(0)
      await expect(page.locator("[data-preview]")).toHaveCount(0)
      expect(await page.evaluate(() => history.state)).toBeNull()
      lateDelivery.release?.()
      await released
      await page.unroute(producerURL, delayPreview)
      await expect(page.locator("[data-access-unavailable]")).toBeVisible()
      await expect(page.locator("[data-preview]")).toHaveCount(0)
      await expect(page.locator("body")).not.toContainText("M67 Installed operating line")
      expect(await page.evaluate(() => history.state)).toBeNull()
      const denied = await page.context().request.post(producerURL, {
        headers: { origin: new URL(producerURL, page.url()).origin },
        data: { page: "OPEX Detail", action: "apply-preview", version: 0, values: { previewRef: late.previewRef } },
      })
      expect(denied.status()).toBe(403)
      expect(applications).toBe(1)
      await info.attach("dashboard-installed-access-purged.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
      await page.getByRole("button", { name: "Reload access", exact: true }).click()
      await expect(page).toHaveURL(new RegExp("/sucafina/auth/login(?:\\?|$)"))
    })
    expect(errors).toEqual([])
  } finally {
    lateDelivery.release?.()
    page.off("request", countApplications)
    try { await transport() } finally { try { await reader.close() } finally { await installation.stop() } }
  }
})
