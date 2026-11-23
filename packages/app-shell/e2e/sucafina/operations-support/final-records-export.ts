import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import { chapterURL, login, observation } from "./runtime"
import { captureRecord, captureRecordVariants, capturePortugueseRecord } from "./final-records"

export async function exportRecordJourney(page: Page, info: TestInfo) {
  // The original host already issues this independent single-use enrollment.
  const account = await login(page, "first", "settings")
  expect((await page.goto(chapterURL(account, "/orchestra/sf-imports/exports").href))?.status()).toBe(200)
  const surface = page.locator('[data-sf-surface="UI68"]')
  await expect(surface).toHaveAttribute("data-sf-read-state", "ready")
  const format = surface.getByRole("combobox", { name: "File format", exact: true })
  await expect(format).toHaveValue("xlsx")
  const submit = page.getByRole("button", { name: "Export", exact: true })
  await expect(submit).toBeEnabled()
  await captureRecordVariants(page, info, "UI68", "authorized-format")
  await capturePortugueseRecord(page, info, "UI68", "authorized-format")

  const exported = page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.origin === account.origin && url.pathname === new URL(account.baseURL).pathname + "/planner" &&
      url.searchParams.get("download") === "xlsx" && response.request().method() === "GET"
  })
  const downloaded = page.waitForEvent("download")
  const [response, download] = await Promise.all([exported, downloaded, submit.click()])
  expect(response.status()).toBe(200)
  const producer = await response.body()
  expect(producer.byteLength).toBeGreaterThan(0)
  const bytes = await readFile(await download.path())
  expect(bytes).toEqual(producer)
  expect(Array.from(bytes.subarray(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04])
  expect(download.suggestedFilename()).toMatch(/\.xlsx$/)
  await expect(surface.locator('[data-sf-export="authorized-bytes"]')).toContainText(download.suggestedFilename())
  await expect(surface.locator('a[href^="blob:"]')).toHaveCount(0)
  await captureRecord(page, info, "UI68", "exact-producer-download")
  await observation(info, "final-records-export-exact-bytes", {
    surface: "UI68", format: "xlsx", bytes: bytes.byteLength,
    digest: createHash("sha256").update(bytes).digest("hex"),
    delivery: "browser download equals the exact authorized original Planner response",
    persistence: "no reusable blob link remains in the page",
  })
}
