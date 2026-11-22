import { expect } from "@playwright/test"
import type { APIResponse, Locator, Page, Route } from "@playwright/test"
import { Schema } from "effect"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import type { Account } from "./runtime"

export function sourcingStage(page: Page) {
  return page.locator(".sf-u12-heading p").filter({ hasText: /^Stage: .* · Source version:/ })
}

export async function queueIdentity(page: Page, account: Account, id: string, moneySentence: string, monetaryState: string | null, options?: { reload: true }) {
  const listPath = "/orchestra/sf-procurement/requests"
  const navigation = options?.reload ? await page.reload() : await page.goto(listPath)
  expect(navigation?.status()).toBe(200)
  const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) })
  await expect(table).toHaveCount(1)
  const link = table.getByRole("link", { name: id, exact: true })
  const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: id, exact: true }) })
  await expect(row).toHaveCount(1)
  if (monetaryState) await expect(row.getByRole("cell", { name: monetaryState, exact: true })).toHaveCount(1)
  await expect(link).toHaveAttribute("href", `?request=${id}#${id}`)
  await expect(link).toHaveAttribute("data-source-ref", /^[a-f0-9-]{36}$/)
  await expect(link).toHaveAttribute("data-source-digest", /^[a-f0-9]{64}$/)
  await expect(link).toHaveAttribute("data-source-version", /^[1-9]\d*$/)
  const identity = { sourceRef: await link.getAttribute("data-source-ref"), sourceDigest: await link.getAttribute("data-source-digest"),
    sourceVersion: Number(await link.getAttribute("data-source-version")) }
  const response = await page.request.get(account.baseURL + "/api/ui/pages/CAP25?" + new URLSearchParams({ request: id }), { maxRetries: 0 })
  expect(response.status()).toBe(200)
  const projection = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].output)(await response.json())
  if (projection.status !== "ok") throw new Error("The authorized C02 drilldown is unavailable")
  expect(projection.context).toMatchObject({ principalRef: account.principal, installationId: account.installationId, projectId: account.projectId })
  expect(projection.value.selection).toEqual({ request: id })
  const matching = projection.value.data.requests.filter((record) => record.number === id)
  expect(matching).toHaveLength(1)
  expect(matching[0]).toMatchObject({ ...identity, moneySentence, monetaryState })
  if (!options?.reload) await link.click()
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === listPath &&
    url.searchParams.get("request") === id && decodeURIComponent(url.hash.slice(1)) === id)
  await expect(page.getByText(moneySentence, { exact: true })).toBeVisible()
  return { ...identity, domainVersion: projection.value.versions["requests:" + id]?.version,
    selectedQuoteId: matching[0]?.sourcing?.selectedId, selectionJustification: matching[0]?.sourcing?.selectionJustification }
}

export async function captureProcurementCommand(page: Page, account: Account, confirm: Locator, expected: {
  page: "Requests" | "My approvals" | "Settings"; action: string; id?: string; version?: number; values?: Record<string, unknown>
}, beforeDelivery?: (response: APIResponse) => Promise<void>) {
  const endpoint = new URL(account.baseURL + "/procurement")
  const match = (url: URL) => url.origin === endpoint.origin && url.pathname === endpoint.pathname &&
    url.searchParams.size === 1 && url.searchParams.get("page") === expected.page
  const producer = Promise.withResolvers<{ response: APIResponse; command: unknown }>()
  void producer.promise.catch(() => undefined)
  let posts = 0
  const forward = async (route: Route) => {
    const request = route.request()
    if (request.method() !== "POST") return route.fallback()
    try {
      const command = request.postDataJSON() as { page?: unknown; action?: unknown; id?: unknown } | null
      if (command?.page !== expected.page || command.action !== expected.action || command.id !== expected.id) return route.fallback()
      expect(++posts, `one ${expected.page} ${expected.action} POST per confirmation`).toBe(1)
      expect(command).toMatchObject(expected)
      // Retain the real response before Chromium can discard its copy during readback.
      const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
      try {
        await beforeDelivery?.(response)
      } finally {
        await route.fulfill({ response })
      }
      producer.resolve({ response, command })
    } catch (error) {
      producer.reject(error)
      await route.abort("failed").catch(() => undefined)
    }
  }
  await page.route(match, forward)
  try {
    const [{ response, command }] = await Promise.all([producer.promise, confirm.click()])
    const body: unknown = await response.json()
    expect(posts).toBe(1)
    return { status: response.status(), body, command }
  } finally {
    if (!page.isClosed()) await page.unroute(match, forward)
  }
}

export async function createRequest(page: Page, account: Account, title: string) {
  expect((await page.goto("/orchestra/sf-procurement/requests/new"))?.status()).toBe(200)
  const form = page.locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("Isolated Operations sourcing scope")
  await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Operations fixture only")
  const confirm = await openCommandReview(page, form.getByRole("button", { name: "Create request", exact: true }), "Confirm action")
  const created = await captureProcurementCommand(page, account, confirm, {
    page: "Requests", action: "create", version: 0, values: { pr: { title, estAmount: 100 } },
  })
  expect(created.status).toBe(200)
  expect(created.body).toMatchObject({ ok: true })
  // The acknowledgement has no ID. Reopen the authorized list without re-submitting.
  expect((await page.goto("/orchestra/sf-procurement/requests"))?.status()).toBe(200)
  const requests = page.getByRole("table", { name: "Requests", exact: true })
  await expect(requests).toHaveCount(1)
  const row = requests.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const id = (await row.getAttribute("data-sf-row")) ?? ""
  expect(id).toMatch(/^PR-2026-\d+$/)
  await expect(requests.locator(`tr[data-sf-row="${id}"]`)).toHaveCount(1)
  await expect(row.getByText(id, { exact: true })).toBeVisible()
  return id
}

export async function approveRequest(page: Page, account: Account, id: string, comment: string) {
  const encoded = encodeSfRouteRef(id)
  await page.goto(`/orchestra/sf-procurement/approvals/${encoded}`)
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}`)
  await page.getByRole("button", { name: "Review decision", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await page.getByRole("textbox", { name: "Approval comment (optional)", exact: true }).fill(comment)
  const approved = await captureProcurementCommand(page, account, review.getByRole("button", { name: "Approve PR", exact: true }), {
    page: "My approvals", action: "approve", id, values: { comment: comment },
  })
  expect(approved.status).toBe(200)
  expect(approved.body).toMatchObject({ ok: true })
}

export async function confirmCommand(page: Page, account: Account, action: string, id: string | undefined, openReview: Locator, confirmName: string) {
  const confirm = await openCommandReview(page, openReview, confirmName)
  const response = await captureProcurementCommand(page, account, confirm, { page: "Requests", action, id })
  expect(response.status).toBe(200)
  expect(response.body).toMatchObject({ ok: true })
  return response
}

export async function openCommandReview(page: Page, openReview: Locator, confirmName: string) {
  await expect(openReview).toBeEnabled()
  await openReview.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  const confirm = review.getByRole("button", { name: confirmName, exact: true })
  await expect(confirm).toBeEnabled()
  return confirm
}

export async function fillEnabledScores(quote: Locator) {
  for (const name of ["Technical scores", "Commercial scores"]) {
    const section = quote.locator("section").filter({ has: quote.page().getByRole("heading", { name, exact: true }) })
    const scores = section.getByRole("spinbutton")
    const count = await scores.count()
    for (let index = 0; index < count; index++) {
      const input = scores.nth(index)
      if (await input.isEnabled()) await input.fill("4")
    }
  }
}
