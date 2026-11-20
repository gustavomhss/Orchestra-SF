import { expect } from "@playwright/test"
import type { Locator, Page, Response } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { chapterURL } from "./runtime"
import type { Account } from "./runtime"

export function commandResponse(page: Page, action: string, id?: string) {
  const origin = new URL(page.url()).origin
  return page.waitForResponse((response) => matchesCommand(response, origin, action, id))
}

export async function openRequest(page: Page, account: Account, id: string) {
  expect(id).toMatch(/^PR-2026-\d+$/)
  const encoded = encodeSfRouteRef(id)
  await page.goto(chapterURL(account, `/orchestra/sf-procurement/requests/${encoded}`).href)
  await expect(page).toHaveURL((url) => url.origin === account.origin && url.pathname === `/orchestra/sf-procurement/requests/${encoded}`)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  await expect(labeledLine(detail, "Request identity")).toHaveText(`Request identity: ${id}`)
  await expect(versionLine(detail)).toHaveText(/^Current source version: [1-9]\d*$/)
  await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("Version ")
  await expect(detail.locator("section.sf-u11-stage").first()).toBeVisible()
  return detail
}

export async function createDraft(page: Page, account: Account, title: string) {
  await page.goto(chapterURL(account, "/orchestra/sf-procurement/requests/new").href)
  const form = page.locator("article.sf-u11-detail").locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("Isolated Operations sourcing scope")
  await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Operations fixture only")
  const response = await admitCommand(page, "create", form.getByRole("button", { name: "Create request", exact: true }))
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  const posted = response.request().postDataJSON()
  expect(posted).toMatchObject({ page: "Requests", action: "create", values: { pr: { title } } })
  expect(posted.values.pr.estAmount).toBe(100)
  const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const id = (await row.getAttribute("data-sf-row")) ?? ""
  expect(id).toMatch(/^PR-2026-\d+$/)
  await expect(row.getByRole("cell").first()).toContainText(id)
  await expect(row.getByRole("link", { name: id, exact: true })).toHaveCount(1)
  const detail = await openRequest(page, account, id)
  await expect(detail.locator(`p[data-request-summary="${id}"]`)).toContainText("Requisition draft")
  expect(await sourceVersion(detail)).toBe(1)
  await expect(detail.getByLabel("Estimated amount", { exact: true })).toHaveValue("100")
  await expect(labeledLine(detail, "Status")).toHaveText("Status: draft")
  await expect(labeledLine(detail, "Stage")).toHaveText("Stage: pr")
  return id
}

export async function requestAction(page: Page, id: string, form: Locator, label: string) {
  await expect(form).toHaveCount(1)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  const version = await sourceVersion(detail)
  const action = await form.getAttribute("data-command") ?? postedAction(label)
  if (!action || !Number.isSafeInteger(version) || version < 1) throw new Error("Current Procurement command identity is unavailable")
  const button = form.getByRole("button", { name: label, exact: true })
  await expect(button).toBeEnabled()
  const response = await admitCommand(page, action, button, id)
  expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action, id, version })
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  await expect(versionLine(detail)).toHaveText("Current source version: " + String(version + 1))
  return response
}

/** Verify the unique C02 row for this record; scoped C02 version is not the domain CAS counter. */
export async function queueIdentity(page: Page, account: Account, id: string, amount: string) {
  const table = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) })
  await expect(table).toHaveCount(1)
  const row = table.getByRole("row").filter({ has: page.getByRole("link", { name: id, exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row.getByRole("cell", { name: amount, exact: true })).toHaveCount(1)
  const link = row.getByRole("link", { name: id, exact: true })
  await expect(link).toHaveAttribute("data-source-ref", /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/)
  await expect(link).toHaveAttribute("data-source-digest", /^[a-f0-9]{64}$/)
  await expect(link).toHaveAttribute("data-source-version", /^[1-9]\d*$/)
  const href = await link.getAttribute("href")
  if (!href) throw new Error("C02 drilldown is missing")
  const url = new URL(href, page.url())
  expect(url.origin).toBe(account.origin)
  expect(url.pathname).toBe("/orchestra/sf-procurement/requests")
  expect(url.searchParams.get("request")).toBe(id)
  expect([...url.searchParams.keys()]).toEqual(["request"])
  expect(decodeURIComponent(url.hash.slice(1))).toBe(id)
  return { id, amount, sourceRef: await link.getAttribute("data-source-ref"), refDigest: await link.getAttribute("data-source-digest"), sourceVersion: Number(await link.getAttribute("data-source-version")) }
}

function labeledLine(detail: Locator, label: string) {
  return detail.locator("p").filter({ hasText: new RegExp(`^${label}:`) })
}

function versionLine(detail: Locator) {
  return labeledLine(detail, "Current source version")
}

async function sourceVersion(detail: Locator) {
  const line = versionLine(detail)
  await expect(line).toHaveText(/^Current source version: [1-9]\d*$/)
  return Number((await line.innerText()).replace("Current source version: ", ""))
}

function postedAction(label: string) {
  if (label === "Create request") return "create"
  if (label === "Save requisition draft" || label === "Save purchase order draft") return "save"
  if (label === "Submit requisition") return "submit_pr"
  if (label === "Submit purchase order") return "submit_po"
  if (label === "Issue purchase order internally") return "issue"
  if (label === "Cancel request") return "cancel"
  if (label === "Delete draft") return "delete"
  return undefined
}

function matchesCommand(response: Response, origin: string, action: string, id?: string) {
  const request = response.request()
  const url = new URL(request.url())
  if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/procurement" || url.searchParams.has("sf")) return false
  const body = request.postDataJSON() as { action?: string; id?: string }
  return body.action === action && (id === undefined || body.id === id)
}

async function admitCommand(page: Page, action: string, openReview: Locator, id?: string) {
  const origin = new URL(page.url()).origin
  const seen = { posted: false }
  const pending = page.waitForResponse((response) => {
    const matched = matchesCommand(response, origin, action, id)
    if (matched) seen.posted = true
    return matched
  })
  await expect(openReview).toBeEnabled()
  await openReview.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  expect(seen.posted).toBe(false)
  const confirm = review.getByRole("button", { name: "Confirm action", exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  return pending
}
