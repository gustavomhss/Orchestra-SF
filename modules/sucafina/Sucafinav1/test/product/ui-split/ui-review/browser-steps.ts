import { expect } from "bun:test"
import type { Page } from "@playwright/test"
import { object, rows } from "../../../../runtime/contract.ts"

// Browser interactions only; the shared production driver and routes stay intact.
export async function loadOptions(page: Page) {
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-workbench"),
    page.locator("[data-dashboard-workbench]").getByRole("button", { name: "Carregar opções", exact: true }).click(),
  ])
  expect(response.status()).toBe(200)
  const result = object(await response.json())
  expect(result.status).toBe("ok")
  await page.getByText("Opções carregadas.", { exact: false }).waitFor()
  return object(result.value)
}

export async function openReview(page: Page, options: Record<string, unknown>, id: string) {
  const index = rows(options.history).findIndex((entry) => entry.kind === "review" && entry.ref === id)
  expect(index).toBeGreaterThanOrEqual(0)
  const panel = page.locator("[data-dashboard-workbench]")
  await panel.getByLabel("Reunião ou retrato preservado").selectOption({ index: index + 1 })
  const [response] = await Promise.all([
    page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-review"),
    panel.getByRole("button", { name: "Abrir histórico", exact: true }).click(),
  ])
  expect(response.status()).toBe(200)
  expect(new URL(response.url()).searchParams.get("id")).toBe(id)
  const result: unknown = await response.json()
  await panel.getByText("Histórico aberto com seu acesso atual.", { exact: true }).waitFor()
  return result
}
