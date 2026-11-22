import { expect } from "@playwright/test"
import type { APIResponse, Locator, Page, Request, Route } from "@playwright/test"
import { captureInstalledCommand } from "../installed-command-response"
import { Schema } from "effect"
import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import type { Account } from "./runtime"

export function sourcingStage(page: Page) {
  return page.locator(".sf-u12-heading .sf-u12-stage")
}

export async function sourcingSourceVersion(page: Page, expected?: number) {
  const source = page.locator(".sf-u12-heading details.sf-procurement-source")
  await expect(source).toHaveCount(1)
  if (await source.getAttribute("open") === null) await source.locator("summary").click()
  const line = source.locator("p")
  await expect(line).toHaveText(expected === undefined ? /^Source version: [1-9]\d*$/ : `Source version: ${expected}`)
  return (await line.innerText()).replace("Source version: ", "")
}

type QueueReadCapture = { forward(route: Route): Promise<void>; reject(reason: Error): void }
type QueueReadInterceptor = { endpoint: string; ready: Promise<void>; active?: QueueReadCapture }
const queueReadInterceptors = new WeakMap<Page, QueueReadInterceptor>()

/** Retain only the original authorized CAP25 GET response. Keep the exact endpoint
 * route until Page closure so live readback never loses Chromium interception.
 * Unrelated requests and reads outside the active observation use normal handlers. */
async function queueReadInterceptor(page: Page, endpoint: URL) {
  let state = queueReadInterceptors.get(page)
  if (state) {
    if (state.endpoint !== endpoint.href) throw new Error("A queue Page cannot switch read endpoints")
    await state.ready
    return state
  }
  state = { endpoint: endpoint.href, ready: Promise.resolve() }
  queueReadInterceptors.set(page, state)
  const owned = state
  const pattern = new RegExp("^" + endpoint.href.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?:\\?|$)")
  owned.ready = page.route(pattern, (route) => owned.active ? owned.active.forward(route) : route.fallback())
  page.once("close", () => {
    queueReadInterceptors.delete(page)
    const active = owned.active
    owned.active = undefined
    active?.reject(new Error("Queue Page closed before its original read completed"))
  })
  try { await owned.ready } catch (error) {
    if (queueReadInterceptors.get(page) === owned) queueReadInterceptors.delete(page)
    throw error
  }
  return owned
}

export async function queueIdentity(page: Page, account: Account, id: string, moneySentence: string, monetaryState: string | null, options?: { reload: true }) {
  const listPath = "/orchestra/sf-procurement/requests"
  const detailPath = listPath + "/" + encodeSfRouteRef(id)
  const endpoint = new URL(account.baseURL + "/api/ui/pages/CAP25")
  const decode = async (response: { status(): number; json(): Promise<unknown> }, selected: boolean) => {
    expect(response.status()).toBe(200)
    const projection = Schema.decodeUnknownSync(SfProcurement.operations["domain.page.CAP25"].output)(await response.json())
    if (projection.status !== "ok") throw new Error("The authorized C02 projection is unavailable")
    expect(projection.context).toMatchObject({ principalRef: account.principal, installationId: account.installationId, projectId: account.projectId })
    expect(projection.value.selection).toEqual(selected ? { request: id } : {})
    const matching = projection.value.data.requests.filter((record) => record.number === id)
    expect(matching).toHaveLength(1)
    const record = matching[0]!
    expect(record).toMatchObject({ moneySentence, monetaryState })
    expect(record.sourceRef).toMatch(/^[a-f0-9-]{36}$/)
    expect(record.sourceDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(record.sourceVersion).toBeGreaterThan(0)
    return { sourceRef: record.sourceRef, sourceDigest: record.sourceDigest, sourceVersion: record.sourceVersion,
      domainVersion: projection.value.versions["requests:" + id]?.version,
      selectedQuoteId: record.sourcing?.selectedId, selectionJustification: record.sourcing?.selectionJustification }
  }
  const navigate = async (selected: boolean, reload = false) => {
    const interceptor = await queueReadInterceptor(page, endpoint)
    if (interceptor.active) throw new Error("Concurrent queue read observations on one Page are not allowed")
    const matches = (request: Request) => {
      const url = new URL(request.url())
      return request.method() === "GET" && url.origin === endpoint.origin && url.pathname === endpoint.pathname &&
        url.searchParams.size === (selected ? 1 : 0) && url.searchParams.get("request") === (selected ? id : null)
    }
    // Keep the original browser-response wait and its original timeout. A retained
    // APIResponse is accepted only for that exact Request, after untouched delivery.
    const pending = page.waitForResponse((response) => matches(response.request()))
    void pending.catch(() => undefined)
    const retained = Promise.withResolvers<{ response: APIResponse; request: Request }>()
    void retained.promise.catch(() => undefined)
    let captured = false
    const capture: QueueReadCapture = {
      reject: retained.reject,
      forward: async (route) => {
        const request = route.request()
        if (captured || !matches(request)) return route.fallback()
        captured = true
        try {
          const response = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
          await route.fulfill({ response })
          retained.resolve({ response, request })
        } catch (error) {
          retained.reject(error)
          await route.abort("failed").catch(() => undefined)
        }
      },
    }
    interceptor.active = capture
    try {
      const [delivered, original] = await Promise.all([pending, retained.promise, (async () => {
        const navigation = reload ? await page.reload() : await page.goto(selected ? detailPath : listPath)
        expect(navigation?.status()).toBe(200)
      })()])
      expect(delivered.request(), "Decode the response to the UI's original authorized GET").toBe(original.request)
      expect(delivered.status()).toBe(original.response.status())
      return await decode(original.response, selected)
    } finally {
      if (interceptor.active === capture) interceptor.active = undefined
    }
  }
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  let listed: Awaited<ReturnType<typeof decode>>
  let drilled: Awaited<ReturnType<typeof decode>>
  if (options?.reload) {
    await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === detailPath)
    drilled = await navigate(true, true)
    // Compare the reloaded UI's actual response with the independently authorized list.
    listed = await decode(await page.request.get(endpoint.href, { maxRetries: 0 }), false)
  } else {
    listed = await navigate(false)
    const table = page.getByRole("table", { name: "Requests", exact: true })
    await expect(table).toHaveCount(1)
    const row = table.locator(`tr[data-sf-row="${id}"]`)
    await expect(row).toHaveCount(1)
    await expect(row.getByText(id, { exact: true })).toBeVisible()
    await row.getByRole("button", { name: "Open record", exact: true }).click()
    // The native list opens its record locally; the stage links own deep navigation.
    await expect(detail).toBeVisible()
    await expect(detail.locator("[data-request-money]")).toHaveText(moneySentence)
    drilled = await navigate(true)
  }
  expect(drilled).toEqual(listed)
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === detailPath)
  await expect(detail).toBeVisible()
  await expect(detail.locator("[data-request-money]")).toHaveText(moneySentence)
  return drilled
}

export async function captureProcurementCommand(page: Page, account: Account, confirm: Locator, expected: {
  page: "Requests" | "My approvals" | "Settings"; action: string; id?: string; version?: number; values?: Record<string, unknown>
}, beforeDelivery?: (response: APIResponse) => Promise<void>) {
  const { status, body, command } = await captureInstalledCommand(
    page, new URL(account.baseURL + "/procurement"), confirm, expected, { beforeDelivery },
  )
  return { status, body, command }
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
