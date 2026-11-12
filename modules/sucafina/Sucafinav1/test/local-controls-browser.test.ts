import { test } from "bun:test"
import { expect } from "@playwright/test"
import path from "node:path"
import { localBrowser } from "./fixture/local-browser.ts"
import { openLocalStore } from "../runtime/local-store.ts"

test("actual local inbox delivery, read receipt, backups and logout operate through Chrome", async () => {
  const started = Date.now()
  const phase = (name: string) => console.info(`local controls: ${name} (${Date.now() - started}ms)`)
  const f = await localBrowser()
  phase("store open start")
  const store = await openLocalStore(path.join(f.root, "business-local"))
  phase("store open complete")
  try {
    phase("notice seed start")
    await store.transaction("procurement", async (snapshot) => {
      snapshot.notices.push({ kind: "pending", to: [f.actorId], record: "PR-BROWSER-NOTICE", at: new Date().toISOString() })
      return { commit: true, value: undefined }
    })
    phase("notice seed complete")
    phase("Backups navigation start")
    await Promise.all([
      f.page.waitForURL("http://localhost:4110/sucafina/backups", { timeout: 10000 }),
      f.page.getByRole("link", { name: "Backups", exact: true }).click(),
    ])
    phase("Backups navigation complete")
    phase("maintenance start")
    const [maintained] = await Promise.all([
      f.page.waitForResponse((response) => response.request().method() === "POST" && response.url().endsWith("/backups"), { timeout: 10000 }),
      f.page.getByRole("button", { name: "Run maintenance now" }).click(),
    ])
    expect(maintained.status()).toBe(200)
    phase("maintenance complete")
    phase("Backups reload start")
    await f.page.reload()
    phase("Backups reload complete")
    const archiveRows = f.page.locator("tbody > tr").filter({ has: f.page.locator('form[data-command="restore-backup"]') })
    await expect(archiveRows).toHaveCount(6)
    const archiveIds = new Set<string>()
    for (const surface of ["dashboard", "planner", "procurement"]) {
      for (const tier of ["daily", "monthly"]) {
        phase(`${surface}/${tier} inspect`)
        const row = archiveRows
          .filter({ has: f.page.getByRole("cell", { name: surface, exact: true }) })
          .filter({ has: f.page.getByRole("cell", { name: tier, exact: true }) })
        await expect(row).toHaveCount(1)
        const cells = row.locator(":scope > td")
        await expect(cells).toHaveCount(6)
        await expect(cells.nth(1)).toHaveText(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
        await expect(cells.nth(3)).toHaveText(/^\d+$/)
        await expect(cells.nth(4)).toHaveText(/^\d+$/)
        const restore = row.locator('form[data-command="restore-backup"]')
        await expect(restore).toHaveAttribute("data-page", "Backups")
        await expect(restore).toHaveAttribute("data-version", /^\d+$/)
        await expect(restore.locator('input[name="surface"]')).toHaveValue(surface)
        const id = await restore.locator('input[name="id"]').inputValue()
        expect(id).toMatch(/^backup-[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
        archiveIds.add(id)
        const selectedRow = archiveRows.filter({ has: f.page.locator(`input[name="id"][value="${id}"]`) })
        const dialog = f.page.locator("dialog[open]")
        phase(`${surface}/${tier} Manage open start`)
        await Promise.all([
          dialog.waitFor({ state: "visible", timeout: 10000 }),
          selectedRow.getByRole("button", { name: "Manage", exact: true }).click(),
        ])
        phase(`${surface}/${tier} Manage open complete`)
        await expect(dialog).toHaveCount(1)
        await expect(dialog.locator('input[name="id"]')).toHaveValue(id)
        await expect(dialog.locator('input[name="surface"]')).toHaveValue(surface)
        await expect(dialog.getByRole("button", { name: "Restore backup", exact: true })).toBeVisible()
        await expect(dialog.getByRole("button", { name: "Restore backup", exact: true })).toBeEnabled()
        phase(`${surface}/${tier} Close start`)
        await Promise.all([
          dialog.waitFor({ state: "hidden", timeout: 10000 }),
          dialog.getByRole("button", { name: "Close editor", exact: true }).click(),
        ])
        phase(`${surface}/${tier} Close complete`)
      }
    }
    expect(archiveIds.size).toBe(6)
    const menu = f.page.locator("details[data-notifications]")
    phase("notifications open start")
    await menu.locator("summary").click()
    await expect(menu.getByRole("link", { name: /PR-BROWSER-NOTICE/ })).toBeVisible()
    await expect(menu.locator("[data-notification-count]")).toHaveText("1")
    phase("notifications open complete")
    phase("notifications mark read start")
    await menu.getByRole("button", { name: "Mark read" }).click()
    await expect(menu.locator("[data-notification-count]")).toHaveText("")
    phase("notifications mark read complete")
    phase("notifications reload start")
    await f.page.reload()
    phase("notifications reload complete")
    phase("notifications reopen start")
    await menu.locator("summary").click()
    await expect(menu.getByRole("link", { name: /PR-BROWSER-NOTICE/ })).toBeVisible()
    await expect(menu.getByRole("button", { name: "Mark read" })).toHaveCount(0)
    await menu.locator("summary").click()
    phase("notifications checks complete")
    phase("screenshot start")
    await f.page.screenshot({ path: path.join(import.meta.dir, "artifacts/browser-business-backups.png"), fullPage: true, timeout: 10000, animations: "disabled" })
    phase("screenshot complete")
    phase("logout start")
    await Promise.all([
      f.page.waitForURL("http://localhost:4110/sucafina/auth/login", { timeout: 10000 }),
      f.page.getByRole("button", { name: "Sign out", exact: true }).click(),
    ])
    await expect(f.page.getByRole("heading", { name: "Signed out", exact: true })).toBeVisible()
    await expect(f.page.getByText(/Abrir Sucafina shortcut/)).toBeVisible()
    const denied = await f.page.request.get("http://localhost:4110/sucafina/dashboard", { maxRedirects: 0 })
    expect(denied.status()).toBe(303)
    expect(f.errors).toEqual([])
    phase("logout complete")
  } finally { phase("cleanup start"); await store.dispose(); await f.dispose(); phase("cleanup complete") }
}, 60000)
