import { expect, test, type Dialog, type Request, type Route } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import { SfDomainPageCap04 } from "@orchestra/schema/sucafina/domain"
import { startPlannerInstallation } from "../wp03/installation-fixture"
import { addOwner, dashboardUrl, observeDashboardRequests, openMonth, readOpex } from "./support"

test.use({ trace: "off" })

// Intercepted responses first execute against the original installed producer.
// Only delivery is lost or delayed; authority, data and receipts are not invented.
test("installed Dashboard confirms exact monthly changes and purges late results after real logout", async ({ page }, info) => {
  test.setTimeout(180_000)
  const installation = await startPlannerInstallation(info)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const reader = await page.context().newPage()
  reader.on("pageerror", (error) => errors.push(error.message))
  const transport = observeDashboardRequests(info, [{ page, label: "primary" }, { page: reader, label: "reader" }])
  const url = dashboardUrl(installation.origin, "OPEX Detail")
  const producerURL = installation.origin + "/sucafina/dashboard?" + new URLSearchParams({ page: "OPEX Detail" })
  const isOpex = (target: URL) => target.origin === installation.origin && target.pathname === "/sucafina/dashboard" &&
    target.searchParams.get("page") === "OPEX Detail" && !target.searchParams.has("sf")
  const isRead = (target: URL) => target.origin === installation.origin && target.pathname === "/sucafina/api/ui/pages/CAP04"
  let owner = "", unrelated = "", applications = 0
  let issuedOwnerHeader = ""
  const lateDelivery: { release?: () => void } = {}
  const countApplications = (request: Request) => {
    if (request.method() === "POST" && isOpex(new URL(request.url())) &&
      ["save-entry", "year-amount"].includes(request.postDataJSON()?.action)) applications++
  }
  page.on("request", countApplications)
  try {
    await test.step("create real fiscal lines and cancel the native review without persisting a month", async () => {
      await installation.signIn(page)
      await page.goto(url)
      owner = await addOwner(page, "M67 Installed operating line", "1200")
      unrelated = await addOwner(page, "M67 Installed unrelated line", "2400")
      const month = await openMonth(page, owner, 1)
      await month.getByLabel("budget", { exact: true }).fill("123")
      await month.getByLabel("actual", { exact: true }).fill("34")
      await month.getByLabel("forecast", { exact: true }).fill("140")
      await month.getByRole("button", { name: "Review changes", exact: true }).click()
      const review = month.locator('[data-component="sf-change-review"]')
      await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
      for (const value of ["123", "34", "140"]) await expect(review).toContainText(value)
      await reader.goto(url)
      const before = await readOpex(reader, 2026)
      // The original producer omits the collection until its first monthly write.
      expect(Object.hasOwn(before.data, "opexEntries")).toBe(false)
      expect(before.entries).toBeUndefined()
      const unsaved = await openMonth(reader, owner, 1)
      await expect(unsaved.getByLabel("actual", { exact: true })).toHaveValue("")
      await unsaved.getByRole("button", { name: "Cancel", exact: true }).click()
      expect(applications).toBe(0)
      await review.getByRole("button", { name: "Revise", exact: true }).click()
      await month.getByRole("button", { name: "Discard draft", exact: true }).click()
      const discard = month.getByRole("group", { name: "Discard the draft and change context?", exact: true })
      await discard.getByRole("button", { name: "Discard draft", exact: true }).click()
      await expect(month).toBeHidden()
      await page.reload()
      const unchanged = await readOpex(page, 2026)
      expect(unchanged.entries).toBeUndefined()
      expect(unchanged.data).toEqual(before.data)
      expect(unchanged.versions).toEqual(before.versions)
      expect(applications).toBe(0)
    })

    await test.step("read the applied monthly values after losing the one real successful response", async () => {
      const month = await openMonth(page, owner, 1)
      await month.getByLabel("budget", { exact: true }).fill("123")
      await month.getByLabel("actual", { exact: true }).fill("34")
      await month.getByLabel("forecast", { exact: true }).fill("140")
      await month.getByRole("button", { name: "Review changes", exact: true }).click()
      const review = month.locator('[data-component="sf-change-review"]')
      await expect(review).toBeVisible()
      expect(applications).toBe(0)
      type Applied = { status: number; ok: boolean; submitted: unknown }
      let delivered: ((value: Applied) => void) | undefined
      const lost = new Promise<Applied>((resolve) => { delivered = resolve })
      const dropSave = async (route: Route) => {
        if (route.request().method() !== "POST" || route.request().postDataJSON()?.action !== "save-entry") {
          await route.continue()
          return
        }
        issuedOwnerHeader = route.request().headers()["x-sf-native-owner"] ?? ""
        expect(issuedOwnerHeader).not.toBe("")
        const actual = await route.fetch()
        const body = await actual.json() as { ok?: unknown }
        const submitted: unknown = route.request().postDataJSON()
        await route.abort("failed")
        delivered?.({ status: actual.status(), ok: body.ok === true, submitted })
      }
      await page.route(isOpex, dropSave)
      await review.getByRole("button", { name: "Save", exact: true }).click()
      const applied = await lost
      expect(applied).toMatchObject({ status: 200, ok: true, submitted: {
        page: "OPEX Detail", action: "save-entry", version: 0,
        values: { ownerId: owner, year: 2026, month: 1, budget: 123, actual: 34, forecast: 140 },
      } })
      const outcome = month.locator('[data-component="sf-receipt-view"]')
      await expect(outcome).toHaveAttribute("data-state", "outcome-unknown")
      await expect(outcome.getByRole("button", { name: "Check outcome", exact: true })).toBeEnabled()
      await page.unroute(isOpex, dropSave)
      const reread = page.waitForResponse((response) => isRead(new URL(response.url())) && response.request().method() === "GET")
      await outcome.getByRole("button", { name: "Check outcome", exact: true }).click()
      const observed = await reread
      expect(observed.status()).toBe(200)
      const current = Schema.decodeUnknownSync(SfDomainPageCap04.output)(await observed.json())
      if (current.status !== "ok" || current.value.data.opexEntries === undefined) throw new Error("The authorized saved months were unavailable")
      expect(current.value.data.opexEntries.filter((entry) => String(entry.ownerId) === owner && entry.year === 2026 && entry.month === 1))
        .toMatchObject([{ budget: 123, actual: 34, forecast: 140 }])
      // A source reread is evidence of persisted values, not an invented receipt.
      await expect(outcome).toHaveAttribute("data-state", "outcome-unknown")
      await expect(outcome.getByRole("button", { name: "Save", exact: true })).toHaveCount(0)
      expect(applications).toBe(1)
      const acceptReload = async (dialog: Dialog) => {
        expect(dialog.type()).toBe("beforeunload")
        await dialog.accept()
      }
      page.on("dialog", acceptReload)
      try { await page.reload() } finally { page.off("dialog", acceptReload) }
      await reader.reload()
      for (const surface of [page, reader]) {
        const saved = await readOpex(surface, 2026)
        if (saved.entries === undefined) throw new Error("The authorized saved months were unavailable")
        const selected = saved.entries.filter((entry) => String(entry.ownerId) === owner && entry.year === 2026 && entry.month === 1)
        expect(selected).toHaveLength(1)
        expect(selected[0]).toMatchObject({ budget: 123, actual: 34, forecast: 140 })
        expect(saved.entries.filter((entry) => String(entry.ownerId) === owner && entry.year === 2026 && entry.month === 2)).toEqual([])
        expect(saved.entries.filter((entry) => String(entry.ownerId) === unrelated && entry.year === 2026 && entry.month === 1)).toEqual([])
        const reopened = await openMonth(surface, owner, 1)
        await expect(reopened.getByLabel("budget", { exact: true })).toHaveValue("123")
        await expect(reopened.getByLabel("actual", { exact: true })).toHaveValue("34")
        await expect(reopened.getByLabel("forecast", { exact: true })).toHaveValue("140")
        await reopened.getByRole("button", { name: "Cancel", exact: true }).click()
        const shown = surface.locator('.sf-budget-detail tr[data-sf-month="1"]')
        await expect(shown.getByRole("cell").nth(0)).toHaveText("123")
        await expect(shown.getByRole("cell").nth(1)).toHaveText("34")
        await expect(shown.getByRole("cell").nth(2)).toHaveText("140")
      }
      expect(applications).toBe(1)
      await info.attach("dashboard-installed-confirmed-month.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
    })

    await test.step("revoke the real session while an authorized monthly projection is in flight", async () => {
      await page.reload()
      const ownerRow = page.locator(`tr[data-sf-row="${owner}"]`)
      await ownerRow.locator('button[data-sf-action="select"]').click()
      await expect(ownerRow).toHaveAttribute("aria-selected", "true")
      const historyBeforeEdit: unknown = await page.evaluate(() => history.state)
      const source = await readOpex(page, 2026)
      if (source.entries === undefined) throw new Error("The authorized saved months were unavailable")
      expect(typeof source.versions.budgetYtd).toBe("number")
      await page.locator(".sf-budget-detail").getByRole("button", { name: "Apply year amount", exact: true }).click()
      const editor = page.locator('.sf-budget-editor[data-sf-action="year-amount"]')
      const year = editor.locator("form")
      await expect(year).toBeVisible()
      await year.getByLabel("Year amount", { exact: true }).fill("777")
      await year.getByRole("button", { name: "Review changes", exact: true }).click()
      const preview = editor.locator('[data-component="sf-change-review"]')
      await expect(preview).toContainText("777")
      expect(applications).toBe(1)
      await preview.getByRole("button", { name: "Revise", exact: true }).click()
      await expect(year.getByLabel("Year amount", { exact: true })).toHaveValue("777")
      type LateProjection = { status: number; admitted: boolean; containsOwner: boolean }
      let captured: ((value: LateProjection) => void) | undefined, completed: (() => void) | undefined
      let heldRequest: Request | undefined, aborted = false
      const failed = (request: Request) => {
        if (request === heldRequest && /ERR_ABORTED/.test(request.failure()?.errorText ?? "")) aborted = true
      }
      page.on("requestfailed", failed)
      const observed = new Promise<LateProjection>((resolve) => { captured = resolve })
      const released = new Promise<void>((resolve) => { completed = resolve })
      const hold = new Promise<void>((resolve) => { lateDelivery.release = resolve })
      const delayRead = async (route: Route) => {
        if (route.request().method() !== "GET") { await route.continue(); return }
        heldRequest = route.request()
        const actual = await route.fetch()
        const body = Schema.decodeUnknownSync(SfDomainPageCap04.output)(await actual.json())
        captured?.({ status: actual.status(), admitted: body.status === "ok",
          containsOwner: body.status === "ok" && body.value.data.opexOwners?.some((line) => String(line.id) === owner) === true })
        await hold
        try { await route.fulfill({ response: actual }) }
        catch (error) { if (!aborted) throw error }
        finally { completed?.() }
      }
      await page.route(isRead, delayRead)
      await page.getByRole("button", { name: "Refresh data", exact: true }).click()
      expect(await observed).toEqual({ status: 200, admitted: true, containsOwner: true })
      const signedOut = reader.waitForResponse((response) => response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/sucafina/auth/logout", { timeout: 15_000 })
      const readerDenied = reader.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
      await reader.getByRole("button", { name: "Sign out", exact: true }).click()
      expect((await signedOut).status()).toBe(204)
      expect((await readerDenied).status()).toBe(401)
      await expect(reader.locator('[data-sf-f01="unauthenticated"]')).toBeVisible()
      const deniedContext = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
      await page.getByRole("button", { name: "Refresh access", exact: true }).click()
      expect((await deniedContext).status()).toBe(401)
      const unavailable = page.locator('[data-sf-f01="unauthenticated"]')
      await expect(unavailable).toBeVisible()
      await expect(unavailable).toHaveText("Sign in again to continue.")
      await expect(page.locator(".sf-budget-editor form")).toHaveCount(0)
      await expect(page.locator('[data-component="sf-change-review"]')).toHaveCount(0)
      expect(await page.evaluate(() => history.state)).toEqual(historyBeforeEdit)
      lateDelivery.release?.()
      await released
      await page.unroute(isRead, delayRead)
      page.off("requestfailed", failed)
      await expect(unavailable).toBeVisible()
      await expect(page.locator('[data-component="sf-change-review"]')).toHaveCount(0)
      await expect(page.locator("body")).not.toContainText("M67 Installed operating line")
      expect(await page.evaluate(() => history.state)).toEqual(historyBeforeEdit)
      const denied = await page.context().request.post(producerURL, {
        headers: { origin: installation.origin, "x-sf-native-owner": issuedOwnerHeader, "idempotency-key": randomUUID() },
        data: { page: "OPEX Detail", action: "year-amount", id: owner, version: source.versions.budgetYtd,
          values: { year: 2026, amount: 777, versions: source.versions } },
      })
      expect(denied.status()).toBe(403)
      expect(applications).toBe(1)
      await info.attach("dashboard-installed-access-purged.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
      const deniedAgain = page.waitForResponse((response) => new URL(response.url()).pathname === "/sucafina/api/ui/context" && response.status() === 401)
      await page.getByRole("button", { name: "Refresh access", exact: true }).click()
      expect((await deniedAgain).status()).toBe(401)
      await expect(unavailable).toBeVisible()
      await expect(page.locator("body")).not.toContainText("M67 Installed operating line")
    })
    expect(errors).toEqual([])
  } finally {
    lateDelivery.release?.()
    page.off("request", countApplications)
    try { await transport() } finally { try { await reader.close() } finally { await installation.stop() } }
  }
})
