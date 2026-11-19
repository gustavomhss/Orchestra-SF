import { randomUUID } from "node:crypto"
import { expect, test } from "@playwright/test"
import { createDocumentSupplier } from "../operations-support/documents"
import { createRequest } from "../operations-support/procurement-snapshot"
import { login } from "../operations-support/runtime"

test("native request creation retains the exact record after reload", async ({ page }) => {
  const account = await login(page, "first", "settings")
  const title = "Operations create boundary " + randomUUID()
  const id = await createRequest(page, account, title)
  await page.reload()
  const row = page.locator(`tr[data-sf-row="${id}"]`)
  await expect(row).toHaveCount(1)
  await expect(row.getByRole("cell", { name: title, exact: true })).toHaveCount(1)
})

test("native supplier creation retains the exact identity and number after reload", async ({ page }) => {
  const account = await login(page, "first", "suppliers")
  const key = randomUUID()
  const name = "Operations supplier boundary " + key
  const { supplier, supplierNumber } = await createDocumentSupplier(page, account, key, name)
  await page.reload()
  const row = page.locator(`tr[data-sf-row="${supplier}"]`)
  await expect(row).toHaveCount(1)
  await expect(row.getByRole("cell", { name, exact: true })).toHaveCount(1)
  await expect(row.getByRole("cell").first().locator(".sf-s01-cell-value")).toHaveText(supplierNumber)
})
