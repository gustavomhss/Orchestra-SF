import { expect, test } from "@playwright/test"
import { asRecord, assertCase, caseIdentity, clickCommand, draft, enterWorkbench, fillDecision, isCommand, reopenCase, withInstallation } from "./decisions-support/journey"
import { loseCreationResponse } from "./decisions-support/lost-response"

// Enrollment and the HttpOnly operator session are real. Do not retain auth in traces.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

// This selection remains red when its installed producers are missing. It does not
// seed alternatives/choices, turn a dependency into a skip, or assert an expected failure.
// The append-only coverage receipt identifies the C10/C12/critique/C17 stages that
// cannot yet be reached through this head's real UI; these tests do not accept them.

test("CI-UI-DECISIONS — create, edit and reopen the same durable case through Workbench", async ({ page }, info) => {
  test.setTimeout(180_000)
  await withInstallation(page, info, async (installation, observations) => {
    await test.step("enter the installed Workbench from the dashboard", async () => {
      await enterWorkbench(page, installation.origin)
    })
    const form = await fillDecision(page, draft.objective)
    const sent = page.waitForRequest((request) => isCommand(request, "workbench-command"))
    const created = await test.step("submit one explicit human intention", async () => {
      const result = await clickCommand(page, form.getByRole("button", { name: "Create decision", exact: true }), "workbench-command", observations)
      const request = await sent
      expect(request.postDataJSON()).toEqual({ operation: "sf_case_draft", input: draft })
      expect(request.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
      expect(typeof result.outputRef).toBe("string")
      caseIdentity(result.outputRef as string)
      return result.outputRef as string
    })
    await test.step("read the exact saved case and preserve its identity after reload", async () => {
      const decision = await assertCase(page, created, draft.objective, 1)
      await decision.getByText("History and sources", { exact: true }).click()
      await expect(decision.getByText("0 source references · 0 receipts", { exact: true })).toBeVisible()
      await page.reload()
      await assertCase(page, created, draft.objective, 1)
      await reopenCase(page, created, draft.objective)
      await assertCase(page, created, draft.objective, 1)
      observations.push({ stage: "case-reopened", caseRef: created, version: 1, financialApplication: false })
    })
    await test.step("save a new human revision and reopen the persisted current version", async () => {
      await page.getByText("Edit decision", { exact: true }).click()
      const editor = page.locator("form[data-decision-edit]")
      await expect(editor).toHaveAttribute("data-sf-edit-ready", "true")
      const context = asRecord(JSON.parse((await editor.getAttribute("data-context"))!))
      const objective = `${draft.objective} — revised by the operator`
      await editor.getByLabel("Decision objective", { exact: true }).fill(objective)
      const sent = page.waitForRequest((request) => isCommand(request, "decision-edit"))
      const saved = await clickCommand(page, editor.getByRole("button", { name: "Save decision", exact: true }), "decision-edit", observations)
      expect((await sent).postDataJSON()).toEqual({ caseRef: { ...caseIdentity(created), version: 1 }, objective,
        horizon: draft.horizon, currency: draft.currency, sourceRefs: [],
        criteria: (context.criteria as { id: string; required: boolean }[]).map((criterion, index) => ({ ...criterion, description: draft.criteria[index] })) })
      expect(saved.value).toEqual({ caseRef: { ...caseIdentity(created), version: 2 } })
      const decision = await assertCase(page, created, objective, 2)
      await decision.getByText("History and sources", { exact: true }).click()
      await expect(decision.getByText("0 source references · 0 receipts", { exact: true })).toBeVisible()
      await page.reload()
      await assertCase(page, created, objective, 2)
      await reopenCase(page, created, objective)
      await assertCase(page, created, objective, 2)
      observations.push({ stage: "case-edited-and-reopened", caseRef: created, version: 2, financialApplication: false })
    })
  })
})

test("CI-UI-DECISIONS — alternative discovery consumes a real Decisions catalog, not HTML 200", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "dependency", description: "WP10: installed decision-list/decision-portfolio-catalog and a public UI producer for initial C09/C10 alternatives" })
  await withInstallation(page, info, async (installation, observations) => {
    await enterWorkbench(page, installation.origin)
    const form = await fillDecision(page, draft.objective)
    const created = await clickCommand(page, form.getByRole("button", { name: "Create decision", exact: true }), "workbench-command", observations)
    expect(typeof created.outputRef).toBe("string")
    const reference = created.outputRef as string
    // This test isolates discovery. Browser Back returns from the submitted case;
    // the separate case test owns assertions about successful case rendering.
    await expect(page).toHaveURL((url) => url.searchParams.get("sf") === "workbench-case" && url.searchParams.get("caseRef") === reference)
    await page.goBack()
    await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible()
    await page.getByText("Explore a portfolio", { exact: true }).click()
    const portfolio = page.locator("section[data-portfolio]")
    await expect(portfolio).toHaveCount(1)
    await expect(portfolio).toHaveAttribute("data-sf-portfolio-ready", "true")
    await test.step("bind discovery to the exact empty case without inventing alternatives", async () => {
      const listed = await clickCommand(page, portfolio.getByRole("button", { name: "Find decisions", exact: true }), "decision-list", observations, "GET")
      expect(Array.isArray(listed.value)).toBe(true)
      expect(listed.value).toHaveLength(1)
      expect(asRecord((listed.value as unknown[])[0]).caseRef).toEqual({ ...caseIdentity(reference), version: 1 })
      await expect(portfolio.locator(":scope > p[role=status]")).toHaveText("Choose decisions, then find alternatives.")
      const checkbox = portfolio.getByRole("checkbox", { name: draft.objective, exact: true })
      await expect(checkbox).toHaveCount(1)
      await checkbox.check()
      const requested = page.waitForRequest((request) => isCommand(request, "decision-portfolio-catalog"))
      const catalog = await clickCommand(page, portfolio.getByRole("button", { name: "Find alternatives", exact: true }), "decision-portfolio-catalog", observations)
      expect((await requested).postDataJSON()).toEqual({ purpose: "catalog", caseRefs: [{ ...caseIdentity(reference), version: 1 }] })
      observations.push({ stage: "alternative-catalog", caseRef: reference, catalog: catalog.value })
      const result = asRecord(catalog.value)
      expect(Array.isArray(result.cases)).toBe(true)
      expect(result.cases).toHaveLength(1)
      const current = asRecord((result.cases as unknown[])[0])
      expect(current.caseRef).toEqual({ ...caseIdentity(reference), version: 1 })
      expect(current.caseVersion).toBe(1)
      expect(current.alternatives).toEqual([])
      const candidates = portfolio.locator("fieldset[data-portfolio-candidates]")
      await expect(candidates.getByRole("checkbox")).toHaveCount(0)
      await expect(portfolio.locator(":scope > p[role=status]")).toHaveText("Choose alternatives and enter the portfolio scope.")
      await expect(portfolio.getByRole("button", { name: "Save this evaluation", exact: true })).toBeDisabled()
      // A new case correctly has no alternatives. Positive C09/C10 comparison,
      // choice and Apply remain blocked until their real UI producer is composed.
    })
  })
})

test("CI-UI-DECISIONS — recover a lost creation response by reading the same case without resubmitting", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "proof-limit", description: "Creation confirmation C09 only; not a financial Apply receipt/retry proof under C12 or AM04" })
  await withInstallation(page, info, async (installation, observations) => {
    await enterWorkbench(page, installation.origin)
    const objective = `${draft.objective} — lost response`
    const form = await fillDecision(page, objective)
    const requests: string[] = []
    page.on("request", (request) => { if (isCommand(request, "workbench-command")) requests.push(request.postData() ?? "") })
    const interruption = await loseCreationResponse(page, installation.origin)
    try {
      // CDP pauses the original browser response, after the real handler committed.
      // It neither issues an APIRequest/route.fetch nor supplies a synthetic response.
      const failed = page.waitForEvent("requestfailed", { predicate: (request) => isCommand(request, "workbench-command") })
      const observed = Promise.all([interruption.completed, failed])
      await form.getByRole("button", { name: "Create decision", exact: true }).click()
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
      await expect(form.getByRole("status")).toHaveText("Could not confirm creation. Your entries are preserved; retry to check the same request.")
      await expect(form.getByLabel("Decision objective", { exact: true })).toHaveValue(objective)
      await expect(form.getByLabel("Criteria, one per line", { exact: true })).toHaveValue(draft.criteria.join("\n"))
      await expect(form.getByRole("button", { name: "Create decision", exact: true })).toBeEnabled()
      observations.push({ stage: "lost-response-draft-preserved", caseRef: reference, creationSubmits: requests.length })
      expect(requests).toHaveLength(1)
      // Leave the uncertain form and reconcile by authorized reads, not another mutation.
      page.once("dialog", (dialog) => dialog.accept())
      await reopenCase(page, reference, objective)
      await assertCase(page, reference, objective, 1)
      await page.reload()
      await assertCase(page, reference, objective, 1)
      expect(requests).toHaveLength(1)
      observations.push({ stage: "lost-response-reconciled", caseRef: reference, creationSubmits: requests.length })
    } finally { await interruption.close() }
  })
})
