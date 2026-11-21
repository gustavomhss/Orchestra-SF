import { expect, test, type Locator, type Page, type Request } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { Schema } from "effect"
import { SfDecisionsProposalAdvance, SfDecisionsProposalReview } from "@orchestra/schema/sucafina/decisions"
import type { startPlannerInstallation } from "../wp03/installation-fixture"
import { asRecord, observeDecisionReply } from "./journey"

const requestPattern = /^PR-\d{4}-\d+$/
const stages = [
  ["Requisition", "requisition"],
  ["Sourcing", "sourcing"],
  ["Purchase order", "po"],
  ["History", "history"],
] as const

export async function createRequisition(page: Page, origin: string, observations: Record<string, unknown>[]) {
  const entry = await page.goto("/orchestra/sf-procurement/requests/new")
  // Regression: a fresh installation must serve a functional Requests form,
  // not the previously observed 503 swallowed as a missing form.
  expect(entry?.status()).toBe(200)
  await expect(page.getByRole("heading", { name: "Requests", exact: true }), "The real Procurement chapter must own the form").toBeVisible()
  await expect(page.locator(".mx-heading").getByRole("button", { name: "Create request", exact: true })).toBeEnabled()
  const article = page.locator("article.sf-u11-detail")
  const form = article.locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
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
  const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
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

/** Canonical approvals bind the proposal while the live requisition remains a draft. */
export async function approveExactRequisition(page: Page, installation: Awaited<ReturnType<typeof startPlannerInstallation>>,
  selection: typeof SfDecisionsProposalReview.input.Type, review: Record<string, unknown>, operation: Record<string, unknown>,
  observations: Record<string, unknown>[]) {
  return test.step("submit and approve the exact Procurement proposal with two separate operator sessions", async () => {
    const requestId = String(asRecord(review.target).id)
    expect(requestId).toMatch(requestPattern)
    const fields = (review.fields as unknown[]).map(asRecord).filter((field) => field.field === "originalAmount" && field.after === operation.amount)
    expect(fields).toHaveLength(1)
    const currentAmount = fields[0]!.before
    expect(typeof currentAmount).toBe("number")
    const currency = String(operation.currency)
    expect(currency).toBe("USD")
    const expected = { targetId: requestId, domainVersion: Number(review.expectedVersion), currentAmount,
      amount: operation.amount, currency, domainApplied: false }
    const panel = (surface: Page) => surface.getByRole("region", { name: "Procurement proposal", exact: true })
    const command = async (surface: Page, kind: "submit" | "approve", button: Locator) => {
      const response = await observeDecisionReply(surface, (request) =>
        request.url() === `${installation.origin}/sucafina/procurement?sf=decision-proposal-advance` && request.method() === "POST",
        () => button.click())
      expect(response.status()).toBe(200)
      expect(response.headers()["content-type"]).toContain("application/json")
      expect(response.request().postDataJSON()).toEqual({ ...selection, action: { kind, reviewDigest: expect.stringMatching(/^[a-f0-9]{64}$/) } })
      const result = Schema.decodeUnknownSync(SfDecisionsProposalAdvance.output)(await response.json())
      if (result.status !== "ok") throw new Error(`Proposal ${kind} failed with ${result.status}`)
      expect(result.value).toMatchObject(expected)
      return result.value
    }
    const submitted = await command(page, "submit", panel(page).getByRole("button", { name: "Submit exact proposal for approval", exact: true }))
    expect(submitted).toMatchObject({ state: "pending", step: { index: 0 }, allowedActions: [] })
    await expect(panel(page).getByRole("button", { name: "Approve exact proposal", exact: true })).toHaveCount(0)
    const href = await panel(page).getByRole("link", { name: "Open approver view", exact: true }).getAttribute("href")
    expect(href).toBeTruthy()
    const browser = page.context().browser()
    if (!browser || !installation.approvers) throw new Error("The approval journey requires two separately enrolled operators")
    const distinct = new Set([installation.actorId, ...installation.approvers.map((approver) => approver.actorId)])
    expect(distinct.size).toBe(3)
    const destination = new URL(href!, installation.origin)
    expect(destination.origin).toBe(installation.origin)
    for (const [index, approver] of installation.approvers.entries()) {
      const context = await browser.newContext({ baseURL: installation.origin })
      try {
        const approvalPage = await context.newPage()
        await approver.signIn(approvalPage)
        await approvalPage.goto(destination.href)
        await expect(panel(approvalPage).getByText(`${currentAmount} ${currency}`, { exact: true })).toBeVisible()
        await expect(panel(approvalPage).getByText(`${operation.amount} ${currency}`, { exact: true })).toBeVisible()
        await expect(panel(approvalPage).getByRole("status")).toHaveText("Pending approval")
        const approved = await command(approvalPage, "approve", panel(approvalPage).getByRole("button", { name: "Approve exact proposal", exact: true }))
        expect(approved.proposalDigest).toBe(submitted.proposalDigest)
        expect(approved.state).toBe(index === 0 ? "pending" : "approved")
        if (index === 0) expect(approved.step?.index).toBe(1)
        else expect(approved.step).toBeNull()
        observations.push({ stage: "explicit-procurement-proposal-approval", requestId, approver: approver.actorId, index, ...approved })
      } finally { await context.close() }
    }
    return { requestId, amount: operation.amount, currency, version: expected.domainVersion, currentAmount: Number(currentAmount), action: "approve" }
  })
}

export async function openRequisition(page: Page, origin: string, id: string) {
  expect(id).toMatch(requestPattern)
  const encoded = encodeSfRouteRef(id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}`)
  await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === `/orchestra/sf-procurement/requests/${encoded}`)
  const row = page.locator(`tr[data-sf-row="${id}"]`)
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("aria-selected", "true")
  await expect(row.getByRole("cell").first()).toContainText(id)
  await expect(row.getByRole("link")).toHaveCount(0)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  await expect(labeledLine(detail, "Request identity")).toHaveText(`Request identity: ${id}`)
  await expect(labeledLine(detail, "Current source version")).toHaveText(/^Current source version: [1-9]\d*$/)
  const tabs = detail.getByRole("navigation", { name: "Request progress" })
  for (const [name, stage] of stages) {
    const href = await tabs.getByRole("link", { name, exact: true }).getAttribute("href")
    expect(new URL(href ?? "", "http://orchestra.invalid").pathname).toBe(`/orchestra/sf-procurement/requests/${encoded}/${stage}`)
  }
  return detail
}

type Command = Readonly<{ page: "Requests" | "My approvals"; action: string; id?: string; version?: number }>

// The chapter admits the command from the review confirm, never from the field editor.
async function domainCommand(page: Page, origin: string, command: Command, openReview: Locator, confirmName: string, observations: Record<string, unknown>[], prepare?: () => Promise<void>) {
  const endpoint = `${origin}/sucafina/procurement?${new URLSearchParams({ page: command.page })}`
  function matches(request: Request) {
    if (request.method() !== "POST" || request.url() !== endpoint) return false
    const body = request.postDataJSON() as { action?: unknown; page?: unknown; id?: unknown } | null
    return body?.action === command.action && body.page === command.page && (!command.id || body.id === command.id)
  }
  const posted: Request[] = []
  const observe = (request: Request) => { if (matches(request)) posted.push(request) }
  page.on("request", observe)
  try {
    await expect(openReview).toBeEnabled()
    await openReview.click()
    const review = page.locator('[data-component="sf-change-review"]')
    await expect(review).toHaveCount(1)
    await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
    if (prepare) await prepare()
    const confirm = review.getByRole("button", { name: confirmName, exact: true })
    await expect(confirm).toBeEnabled()
    expect(posted, "The command is sent only after the review is confirmed").toHaveLength(0)
    const response = await observeDecisionReply(page, matches, () => confirm.click())
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/json")
    expect(asRecord(await response.json()).ok).toBe(true)
    expect(posted).toHaveLength(1)
    expect(posted[0]).toBe(response.request())
    expect(response.request().postDataJSON()).toMatchObject({ page: command.page, action: command.action, ...(command.id ? { id: command.id, version: command.version } : {}) })
    observations.push({ stage: "procurement-human-command", action: command.action, httpStatus: response.status(), body: response.request().postDataJSON() })
    return response
  } finally {
    page.off("request", observe)
  }
}

function labeledLine(detail: Locator, label: string) {
  return detail.locator("p").filter({ hasText: new RegExp(`^${label}:`) })
}

async function sourceVersion(detail: Locator) {
  const line = labeledLine(detail, "Current source version")
  await expect(line).toHaveText(/^Current source version: [1-9]\d*$/)
  return Number((await line.innerText()).replace("Current source version: ", ""))
}
