import { expect, test, type Locator, type Page } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { asRecord, decisionsChapterURL } from "./journey"

const requestPattern = /^PR-\d{4}-\d+$/
const stages = [
  ["Requisition", "requisition"],
  ["Sourcing", "sourcing"],
  ["Purchase order", "po"],
  ["History", "history"],
] as const

export async function createRequisition(page: Page, origin: string, observations: Record<string, unknown>[]) {
  const entry = await page.goto(decisionsChapterURL(page, origin, "/orchestra/sf-procurement/requests/new").href)
  // Regression: a fresh installation must serve a functional Requests form,
  // not the previously observed 503 swallowed as a missing form.
  expect(entry?.status()).toBe(200)
  await expect(page.getByRole("region", { name: "Requests", exact: true }).getByRole("heading", { name: "Requests", exact: true }), "The real Procurement chapter must own the form").toBeVisible()
  const article = page.locator("article.sf-u11-detail")
  const form = article.locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  await expect(form.getByRole("button", { name: "Create request", exact: true })).toBeEnabled()
  const title = "CI Decisions — explicit requisition proposal"
  await form.getByLabel("Title", { exact: true }).fill(title)
  const type = form.locator('select[name="pr.type"]')
  await expect(type).toHaveCount(1)
  await expect(type.locator('option[value="service"]')).toHaveCount(1)
  await type.selectOption("service")
  await form.getByLabel("Description", { exact: true }).fill("Human requisition for the Decisions approval and recovery journey")
  await form.getByLabel("Estimated amount", { exact: true }).fill("100")
  await form.getByLabel("Cost center", { exact: true }).fill("Decisions verification")
  await form.getByLabel("Needed by", { exact: true }).fill("2027-01-01")
  await form.getByLabel("Justification", { exact: true }).fill("Compare explicit alternatives before any financial approval or application")
  await domainCommand(page, origin, { page: "Requests", action: "create" }, form.getByRole("button", { name: "Create request", exact: true }), "Confirm action", observations)
  // The producer accepted one write without returning a canonical new identity.
  // Use its offered source refresh and the existing list control, never resubmit.
  const accepted = page.getByRole("status").filter({ hasText: /^New request accepted without a canonical new record reference\./ })
  await expect(accepted).toBeVisible()
  await accepted.getByRole("button", { name: "Refresh source", exact: true }).click()
  await article.getByRole("button", { name: "Back to requests", exact: true }).click()
  const requests = page.getByRole("table", { name: "Requests", exact: true })
  await expect(requests).toHaveCount(1)
  const row = requests.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const id = (await row.getAttribute("data-sf-row")) ?? ""
  expect(id).toMatch(requestPattern)
  await expect(row.getByRole("cell").first()).toContainText(id)
  await expect(row.getByRole("link")).toHaveCount(0)
  const detail = await openRequisition(page, origin, id)
  expect(await sourceVersion(detail)).toBe(1)
  await expect(detail.getByLabel("Estimated amount", { exact: true })).toHaveValue("100")
  await expect(labeledLine(detail, "Status")).toHaveText("Status: draft")
  await expect(labeledLine(detail, "Stage")).toHaveText("Stage: pr")
  observations.push({ stage: "human-requisition-created", requestId: id, amount: 100, currency: "USD", version: 1,
    financialApproval: false, decisionsApply: false })
  return id
}

/** Approval uses Procurement's actual transition, never the Decisions choice or Apply checkbox. */
export async function approveExactRequisition(page: Page, origin: string, review: Record<string, unknown>, operation: Record<string, unknown>, observations: Record<string, unknown>[]) {
  return test.step("require a compatible explicit Procurement approval for the exact reviewed amount before Apply", async () => {
    const requestId = String(asRecord(review.target).id)
    expect(requestId).toMatch(requestPattern)
    const fields = (review.fields as unknown[]).map(asRecord).filter((field) => field.after === operation.amount)
    expect(fields, "The domain preview must identify the same finite amount selected by the human").toHaveLength(1)
    expect(operation.currency).toBe("USD")
    const encoded = encodeSfRouteRef(requestId)
    await page.goto(decisionsChapterURL(page, origin, `/orchestra/sf-procurement/approvals/${encoded}`).href)
    await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === `/orchestra/sf-procurement/approvals/${encoded}`)
    const approval = page.locator("section.sf-u13-remaining-detail")
    await expect(approval).toHaveCount(1)
    await expect(approval).toContainText(requestId)
    const facts = approval.locator("dl.sf-u13-remaining-facts")
    const fact = (label: string) => facts.locator("div").filter({ has: page.locator(`dt:text-is("${label}")`) }).locator("dd")
    await expect(fact("Request ID")).toHaveText(requestId)
    const submitted = fact("Submitted amount")
    await expect(submitted, "Never approve a different amount from the reviewed proposal").toContainText("USD")
    const shown = Number((await submitted.innerText()).replace(/[^\d.]/g, ""))
    expect(shown, "Never approve a different amount from the reviewed proposal").toBe(operation.amount)
    const header = approval.locator("p").first()
    const versionText = await header.innerText()
    const versionMatch = /Persisted version:\s*(\d+)/.exec(versionText)
    expect(versionMatch, "The approval must show the persisted source version").not.toBeNull()
    const version = Number(versionMatch![1])
    expect(version).toBeGreaterThan(0)
    observations.push({ stage: "financial-approval-gate-entered", requestId, proposedAmount: operation.amount,
      currentEstimatedAmount: shown, currentSummary: versionText,
      dependency: "The domain must provide an approvable proposal compatible with the prepared change. C3 only prepares draft requisition saves, which cannot run after formal approval." })
    // A draft amount change is not a submitted financial proposal. Do not submit or
    // approve the old amount just to manufacture an approval unrelated to the preview.
    const comment = `I explicitly approve this requisition for ${operation.amount} USD after reviewing the recorded choice and proposal.`
    const response = await domainCommand(page, origin, { action: "approve", id: requestId, version },
      approval.getByRole("button", { name: "Approve current step", exact: true }), "Confirm once", observations, async () => {
        await approval.getByLabel("Approval comment", { exact: true }).fill(comment)
      })
    expect(response.request().postDataJSON()).toMatchObject({ action: "approve", id: requestId, values: { comment } })
    const detail = await openRequisition(page, origin, requestId)
    expect(await sourceVersion(detail)).toBe(version + 1)
    await expect(labeledLine(detail, "Status"), "A completed requisition approval must move the request into sourcing").toHaveText("Status: sourcing")
    await expect(labeledLine(detail, "Stage")).toHaveText("Stage: sourcing")
    const receipt = detail.locator('[data-stage="history"]').getByRole("listitem").filter({ hasText: comment })
    await expect(receipt).toHaveCount(1)
    await expect(receipt).toContainText(/Requisition approved by /)
    const proof = { requestId, amount: operation.amount, currency: "USD", version: version + 1, action: "approve", comment }
    observations.push({ stage: "explicit-financial-approval", ...proof })
    return proof
  })
}

export async function openRequisition(page: Page, origin: string, id: string) {
  expect(id).toMatch(requestPattern)
  const encoded = encodeSfRouteRef(id)
  await page.goto(decisionsChapterURL(page, origin, `/orchestra/sf-procurement/requests/${encoded}`).href)
  await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === `/orchestra/sf-procurement/requests/${encoded}`)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  await expect(detail).toBeVisible()
  await expect(labeledLine(detail, "Request identity")).toHaveText(`Request identity: ${id}`)
  await detail.getByRole("button", { name: "Back to requests", exact: true }).click()
  const row = page.locator(`tr[data-sf-row="${id}"]`)
  await expect(row).toHaveCount(1)
  await expect(row).toBeVisible()
  await expect(row).toHaveAttribute("aria-selected", "true")
  await expect(row.getByRole("cell").first()).toContainText(id)
  await expect(row.getByRole("link")).toHaveCount(0)
  await row.getByRole("button", { name: "Open record", exact: true }).click()
  await expect(detail).toHaveCount(1)
  await expect(detail).toBeVisible()
  await expect(labeledLine(detail, "Request identity")).toHaveText(`Request identity: ${id}`)
  await expect(labeledLine(detail, "Current source version")).toHaveText(/^Current source version: [1-9]\d*$/)
  const tabs = detail.getByRole("navigation", { name: "Request progress" })
  for (const [name, stage] of stages) {
    const href = await tabs.getByRole("link", { name, exact: true }).getAttribute("href")
    expect(new URL(href ?? "", "http://orchestra.invalid").pathname).toBe(`/orchestra/sf-procurement/requests/${encoded}/${stage}`)
  }
  return detail
}

type Command = Readonly<{ page?: "Requests"; action: string; id?: string; version?: number }>

// The chapter admits the command from the review confirm, never from the field editor.
async function domainCommand(page: Page, origin: string, command: Command, openReview: Locator, confirmName: string, observations: Record<string, unknown>[], prepare?: () => Promise<void>) {
  const seen = { posted: false }
  const pending = page.waitForResponse((response) => {
    const request = response.request()
    const url = new URL(request.url())
    if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/procurement" || url.searchParams.has("sf")) return false
    const body = request.postDataJSON()
    const matched = body.action === command.action && (!command.page || body.page === command.page) && (!command.id || body.id === command.id)
    if (matched) seen.posted = true
    return matched
  })
  await expect(openReview).toBeEnabled()
  await openReview.click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  expect(seen.posted, "The command is sent only after the review is confirmed").toBe(false)
  if (prepare) await prepare()
  const confirm = review.getByRole("button", { name: confirmName, exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  const response = await pending
  expect(response.request().postDataJSON()).toMatchObject({ ...(command.page ? { page: command.page } : {}), action: command.action, ...(command.id ? { id: command.id, version: command.version } : {}) })
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  expect(asRecord(await response.json()).ok).toBe(true)
  observations.push({ stage: "procurement-human-command", action: command.action, httpStatus: response.status(), body: response.request().postDataJSON() })
  return response
}

function labeledLine(detail: Locator, label: string) {
  return detail.locator("p").filter({ hasText: new RegExp(`^${label}:`) })
}

async function sourceVersion(detail: Locator) {
  const line = labeledLine(detail, "Current source version")
  await expect(line).toHaveText(/^Current source version: [1-9]\d*$/)
  return Number((await line.innerText()).replace("Current source version: ", ""))
}
