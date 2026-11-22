import { expect, test, type Page } from "@playwright/test"
import type { startPlannerInstallation } from "../wp03/installation-fixture"
import {
  asRecord, assertCase, caseIdentity, clickCommand, draft, enterWorkbench,
  fillDecision, isCommand, openCreatedDecision, readCase, reopenCase,
} from "./journey"
import { loseCreationResponse } from "./lost-response"

type Installation = Awaited<ReturnType<typeof startPlannerInstallation>>

/** The full suite and the narrow qualification execute this same real journey. */
export async function caseLifecycleJourney(page: Page, installation: Installation, observations: Record<string, unknown>[]) {
  await test.step("enter native Decisions under the installed owner", async () => {
    await enterWorkbench(page, installation.origin)
  })
  const form = await fillDecision(page, draft.objective)
  const sent = page.waitForRequest((request) => isCommand(request, "workbench-command"))
  const created = await test.step("review and submit one explicit human intention", async () => {
    const result = await clickCommand(page, form.getByRole("button", { name: "Confirm this decision creation", exact: true }), "workbench-command", observations)
    const request = await sent
    expect(request.postDataJSON()).toEqual({ operation: "sf_case_draft", input: draft })
    expect(request.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
    expect(typeof result.outputRef).toBe("string")
    caseIdentity(result.outputRef as string)
    await openCreatedDecision(page, form, result.outputRef as string)
    return result.outputRef as string
  })
  await test.step("read the exact saved case and preserve its identity after reload", async () => {
    const decision = await assertCase(page, created, draft.objective, 1)
    await page.getByRole("button", { name: "Review intent", exact: true }).click()
    await expect(decision.getByText("0 source references · 0 receipts", { exact: true })).toBeVisible()
    await page.reload()
    await assertCase(page, created, draft.objective, 1)
    await reopenCase(page, created, draft.objective)
    await assertCase(page, created, draft.objective, 1)
    observations.push({ stage: "case-reopened", caseRef: created, version: 1, financialApplication: false })
  })
  await test.step("save a new human revision and reopen the persisted current version", async () => {
    const context = await readCase(page, created)
    expect(context.version).toBe(1)
    await page.getByRole("button", { name: "Edit decision", exact: true }).click()
    const editor = page.locator("[data-sf-decision-editor]")
    await expect(editor).toHaveCount(1)
    const objective = `${draft.objective} — revised by the operator`
    await editor.getByLabel("Decision objective", { exact: true }).fill(objective)
    await editor.getByRole("button", { name: "Review source attachments", exact: true }).click()
    const review = editor.getByRole("group", { name: "Review source attachments", exact: true })
    await expect(review).toContainText(objective)
    await expect(review).toContainText("Current version: 1")
    const sent = page.waitForRequest((request) => isCommand(request, "decision-edit"))
    const saved = await clickCommand(page, review.getByRole("button", { name: "Save decision", exact: true }), "decision-edit", observations)
    expect((await sent).postDataJSON()).toEqual({ caseRef: { ...caseIdentity(created), version: 1 }, objective,
      horizon: draft.horizon, currency: draft.currency, sourceRefs: [],
      criteria: context.criteria.map((criterion, index) => ({ id: criterion.id, required: criterion.required, description: draft.criteria[index] })) })
    expect(saved.value).toEqual({ caseRef: { ...caseIdentity(created), version: 2 } })
    const decision = await assertCase(page, created, objective, 2)
    await page.getByRole("button", { name: "Review intent", exact: true }).click()
    await expect(decision.getByText("0 source references · 0 receipts", { exact: true })).toBeVisible()
    await page.reload()
    await assertCase(page, created, objective, 2)
    await reopenCase(page, created, objective)
    await assertCase(page, created, objective, 2)
    observations.push({ stage: "case-edited-and-reopened", caseRef: created, version: 2, financialApplication: false })
  })
}

export async function lostCreationJourney(page: Page, installation: Installation, observations: Record<string, unknown>[]) {
  await enterWorkbench(page, installation.origin)
  const objective = `${draft.objective} — lost response`
  const form = await fillDecision(page, objective)
  const requests: string[] = []
  const observe = (request: Parameters<typeof isCommand>[0]) => {
    if (isCommand(request, "workbench-command")) requests.push(request.postData() ?? "")
  }
  page.on("request", observe)
  const interruption = await loseCreationResponse(page, installation.origin)
  try {
    // Drop only the original browser response after the real handler committed.
    const failed = page.waitForEvent("requestfailed", { predicate: (request) => isCommand(request, "workbench-command") })
    const observed = Promise.all([interruption.completed, failed])
    await form.getByRole("button", { name: "Confirm this decision creation", exact: true }).click()
    const [lost] = await observed
    observations.push({ stage: "creation-response-dropped", httpStatus: lost.httpStatus, contentType: lost.contentType })
    expect(lost.httpStatus).toBe(200)
    expect(lost.contentType).toContain("application/json")
    expect(lost.payload).toEqual({ operation: "sf_case_draft", input: { ...draft, objective } })
    const saved = asRecord(lost.body)
    expect(saved.status).toBe("ok")
    expect(typeof saved.outputRef).toBe("string")
    const reference = saved.outputRef as string
    caseIdentity(reference)
    await expect(form.getByRole("status")).toHaveText("The result of the original creation is unknown. No automatic retry was sent.")
    const review = form.getByRole("group", { name: "Review creation", exact: true })
    await expect(review.locator("dd")).toHaveText([objective, draft.horizon.start, draft.horizon.end, draft.currency])
    await expect(review.getByRole("listitem")).toHaveText(draft.criteria)
    await expect(form.locator("input, textarea")).toHaveCount(0)
    await expect(form.getByRole("button", { name: "Review creation", exact: true })).toBeDisabled()
    observations.push({ stage: "lost-response-draft-preserved", caseRef: reference, creationSubmits: requests.length })
    expect(requests).toHaveLength(1)
    // Reconcile through the native authorized list; no second mutation or new key.
    await form.getByRole("button", { name: "Back to decisions", exact: true }).click()
    await expect(page.getByRole("button", { name: "Refresh case list", exact: true })).toBeEnabled()
    await reopenCase(page, reference, objective)
    await assertCase(page, reference, objective, 1)
    await page.reload()
    await assertCase(page, reference, objective, 1)
    expect(requests).toHaveLength(1)
    observations.push({ stage: "lost-response-reconciled", caseRef: reference, creationSubmits: requests.length })
  } finally {
    page.off("request", observe)
    await interruption.close()
  }
}
