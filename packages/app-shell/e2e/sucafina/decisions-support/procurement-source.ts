import { expect, test, type Locator, type Page } from "@playwright/test"
import { asRecord } from "./journey"

export async function createRequisition(page: Page, origin: string, observations: Record<string, unknown>[]) {
  await page.goto(`${origin}/sucafina/procurement?page=Requests`)
  const form = page.locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  const title = "CI Decisions — explicit requisition proposal"
  await form.getByLabel("Title", { exact: true }).fill(title)
  await form.getByLabel("Type", { exact: true }).selectOption("service")
  await form.getByLabel("Description", { exact: true }).fill("Human requisition for the Decisions approval and recovery journey")
  await form.getByLabel("Estimated amount", { exact: true }).fill("100")
  await form.getByLabel("Cost centre", { exact: true }).fill("Decisions verification")
  await form.getByLabel("Needed by", { exact: true }).fill("2027-01-01")
  await form.getByLabel("Justification", { exact: true }).fill("Compare explicit alternatives before any financial approval or application")
  await domainCommand(page, origin, form, "Create request", observations)
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const link = row.getByRole("link", { name: /^PR-\d{4}-\d+$/ })
  await expect(link).toHaveCount(1)
  const id = (await link.innerText()).trim()
  const detail = await openRequisition(page, origin, id)
  const saved = detail.locator(`section[id="${id}-pr"] form[data-command="save"]`)
  await expect(saved).toHaveAttribute("data-version", "1")
  await expect(saved.getByLabel("Estimated amount", { exact: true })).toHaveValue("100")
  await expect(detail.locator("[data-request-summary]")).toContainText("Requisition draft")
  observations.push({ stage: "human-requisition-created", requestId: id, amount: 100, currency: "USD", version: 1,
    financialApproval: false, decisionsApply: false })
  return id
}

/** Approval uses Procurement's actual transition, never the Decisions choice or Apply checkbox. */
export async function approveExactRequisition(page: Page, origin: string, review: Record<string, unknown>, operation: Record<string, unknown>, observations: Record<string, unknown>[]) {
  return test.step("require a compatible explicit Procurement approval for the exact reviewed amount before Apply", async () => {
    const requestId = String(asRecord(review.target).id)
    const detail = await openRequisition(page, origin, requestId)
    const pr = detail.locator(`section[id="${requestId}-pr"] form[data-command="save"]`)
    const fields = (review.fields as unknown[]).map(asRecord).filter((field) => field.after === operation.amount)
    expect(fields, "The domain preview must identify the same finite amount selected by the human").toHaveLength(1)
    expect(operation.currency).toBe("USD")
    const summary = await detail.locator("[data-request-summary]").innerText()
    observations.push({ stage: "financial-approval-gate-entered", requestId, proposedAmount: operation.amount,
      currentEstimatedAmount: await pr.getByLabel("Estimated amount", { exact: true }).inputValue(), currentSummary: summary,
      dependency: "The domain must provide an approvable proposal compatible with the prepared change. C3 only prepares draft requisition saves, which cannot run after formal approval." })
    // A draft amount change is not a submitted financial proposal. Do not submit or
    // approve the old amount just to manufacture an approval unrelated to the preview.
    await expect(detail.locator("[data-request-summary]"), "A legitimate pending approval for this exact proposal must exist before Apply").toContainText("Requisition approval")
    await expect(pr.getByLabel("Estimated amount", { exact: true }), "Never approve a different amount from the reviewed proposal").toHaveValue(String(operation.amount))
    const approval = detail.locator('form[data-command="approve"]')
    await expect(approval).toHaveCount(1)
    const version = Number(await approval.getAttribute("data-version"))
    const comment = `I explicitly approve this requisition for ${operation.amount} USD after reviewing the recorded choice and proposal.`
    await approval.getByLabel("Comment", { exact: true }).fill(comment)
    await domainCommand(page, origin, approval, "Approve", observations)
    await expect(detail.locator("[data-request-summary]")).toContainText("Sourcing")
    await expect(pr).toHaveAttribute("data-version", String(version + 1))
    const history = detail.locator(`section[id="${requestId}-history"]`)
    const receipt = history.getByRole("row").filter({ has: page.getByRole("cell", { name: comment, exact: true }) })
    await expect(receipt).toHaveCount(1)
    await expect(receipt.getByRole("cell", { name: /^Requisition approved by / })).toHaveCount(1)
    const proof = { requestId, amount: operation.amount, currency: "USD", version: version + 1, action: "approve", comment }
    observations.push({ stage: "explicit-financial-approval", ...proof })
    return proof
  })
}

export async function openRequisition(page: Page, origin: string, id: string) {
  expect(id).toMatch(/^PR-\d{4}-\d+$/)
  await page.goto(`${origin}/sucafina/procurement?${new URLSearchParams({ page: "Requests", request: id, q: id })}`)
  const detail = page.locator(`details[id="${id}"]`)
  await expect(detail).toHaveCount(1)
  await expect(detail).toHaveAttribute("open", "")
  await expect(detail.locator(`section[id="${id}-pr"] form[data-command="save"]`)).toHaveAttribute("data-version", /^[1-9]\d*$/)
  return detail
}

async function domainCommand(page: Page, origin: string, form: Locator, label: string, observations: Record<string, unknown>[]) {
  const action = await form.getAttribute("data-command")
  const recordId = await form.getAttribute("data-record")
  const version = Number(await form.getAttribute("data-version"))
  expect(action).not.toBeNull()
  const pending = page.waitForResponse((response) => {
    const request = response.request(); const url = new URL(request.url())
    if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/procurement" || url.searchParams.has("sf")) return false
    const body = request.postDataJSON()
    return body.page === "Requests" && body.action === action && (!recordId || body.id === recordId)
  })
  const button = form.getByRole("button", { name: label, exact: true })
  await expect(button).toBeEnabled()
  await button.click()
  const response = await pending
  expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action, ...(recordId ? { id: recordId, version } : {}) })
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  expect(asRecord(await response.json()).ok).toBe(true)
  observations.push({ stage: "procurement-human-command", action, httpStatus: response.status(), body: response.request().postDataJSON() })
}
