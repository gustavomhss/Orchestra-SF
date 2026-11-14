import { expect, test, type Page, type Request } from "@playwright/test"
import { asRecord, caseIdentity, clickCommand, enterWorkbench, isCommand, readReply } from "./journey"
import { loseClosureResponse } from "./closure-response"

/** Consume the published C12 path only after the caller proves a compatible domain approval. */
export async function applyRecoveryJourney(page: Page, origin: string, selection: { reference: string; objective: string; choiceId: string }, observations: Record<string, unknown>[], approveBeforeApply: (page: Page, review: Record<string, unknown>, operation: Record<string, unknown>) => Promise<{ requestId: string; amount: unknown; currency: string; version: number; action: string }>) {
  const identity = caseIdentity(selection.reference)
  const context = asRecord(JSON.parse((await page.locator("form[data-decision-choice]").getAttribute("data-context"))!))
  const selected = (context.choices as unknown[]).map(asRecord).filter((choice) => choice.id === selection.choiceId)
  expect(selected, "The public human journey must have produced the exact persisted Procurement choice").toHaveLength(1)
  const operations = asRecord(selected[0]!.scenario).operations as unknown[]
  expect(operations, "An empty Planner scenario cannot prove Procurement Apply or receipt recovery").toHaveLength(1)
  const operation = asRecord(operations[0])
  expect(operation).toMatchObject({ kind: "replace" })
  expect(typeof operation.amount).toBe("number")
  expect(Number.isFinite(operation.amount)).toBe(true)
  const commands: { mode: string; body: unknown; key: string | undefined }[] = []
  const record = (request: Request) => {
    const url = new URL(request.url())
    if (url.origin === origin && request.method() === "POST" && ["decision-apply", "decision-recover"].includes(url.searchParams.get("sf") ?? ""))
      commands.push({ mode: url.searchParams.get("sf")!, body: request.postDataJSON(), key: request.headers()["idempotency-key"] })
  }
  page.context().on("request", record)
  const audit = await page.context().newPage()
  const fresh = await page.context().newPage()
  try {
    await test.step("prepare only the operation held in the recorded human choice", async () => {
      const prepare = page.locator("[data-decision-prepare]")
      await expect(prepare.locator("[data-choice-prepare-select]")).toBeEnabled()
      await prepare.locator("[data-choice-prepare-select]").selectOption(selection.choiceId)
      const sent = page.waitForRequest((request) => isCommand(request, "decision-prepare-changes"))
      const loaded = page.waitForEvent("domcontentloaded")
      const receipt = await clickCommand(page, prepare.getByRole("button", { name: "Prepare changes from this choice", exact: true }), "decision-prepare-changes", observations)
      expect((await sent).postDataJSON()).toEqual({ caseRef: context.caseRef, choiceId: selection.choiceId, operations })
      expect(asRecord(asRecord(receipt.value).caseRef)).toMatchObject(identity)
      await loaded
    })
    const entry = page.locator("[data-decision-apply]")
    await expect(entry).toHaveCount(1)
    await expect(entry).toHaveAttribute("data-sf-apply-ready", "true")
    const change = asRecord(JSON.parse((await entry.getAttribute("data-context"))!))
    expect(change.choiceId).toBe(selection.choiceId)
    expect(change.surface).toBe("procurement")
    let reviewed = await test.step("read the exact domain preview and require explicit confirmation before Apply", async () => {
      const confirmation = entry.getByRole("checkbox", { name: "I reviewed these changes and want to apply them", exact: true })
      const apply = entry.getByRole("button", { name: "Apply reviewed change", exact: true })
      await expect(confirmation).not.toBeChecked()
      await expect(confirmation).toBeDisabled()
      await expect(apply).toBeDisabled()
      const response = page.waitForResponse((response) => procurementCommand(response.request(), origin, "decision-review"))
      await entry.getByRole("button", { name: "Review current changes", exact: true }).click()
      const review = asRecord((await readReply(await response, observations)).value)
      expect(review).toMatchObject({ choiceId: selection.choiceId, changeId: change.changeId, surface: "procurement", state: "planned", expectedVersion: change.expectedVersion })
      expect(review.reviewDigest).toMatch(/^[a-f0-9]{64}$/)
      expect(asRecord(review.target).type).toBe("procurement-request")
      expect(typeof asRecord(review.target).id).toBe("string")
      expect((review.fields as unknown[]).length).toBeGreaterThan(0)
      expect(review.receipt).toBeUndefined()
      await expect(confirmation).toBeEnabled()
      await expect(confirmation).not.toBeChecked()
      await expect(apply).toBeDisabled()
      expect(commands).toEqual([])
      return review
    })
    const requestId = String(asRecord(reviewed.target).id)
    const approval = await approveBeforeApply(audit, reviewed, operation)
    expect(approval).toMatchObject({ requestId, amount: operation.amount, currency: operation.currency, action: "approve" })
    // Formal approval cannot silently authorize a stale draft-edit preparation. The
    // existing domain review must still prove this same change after that transition.
    const reviewedAgain = page.waitForResponse((response) => procurementCommand(response.request(), origin, "decision-review"))
    await entry.getByRole("button", { name: "Review current changes", exact: true }).click()
    const afterApproval = asRecord((await readReply(await reviewedAgain, observations)).value)
    expect(afterApproval).toMatchObject({ target: reviewed.target, choiceId: selection.choiceId, changeId: change.changeId,
      surface: "procurement", state: "planned", expectedVersion: change.expectedVersion, fields: reviewed.fields })
    expect(afterApproval.reviewDigest).toMatch(/^[a-f0-9]{64}$/)
    expect(afterApproval.receipt).toBeUndefined()
    reviewed = afterApproval
    expect(commands).toEqual([])
    const domain = await openRequest(audit, origin, requestId)
    const domainVersion = Number(await domain.getAttribute("data-version"))
    expect(Number.isSafeInteger(domainVersion) && domainVersion > 0).toBe(true)
    const lost = await test.step("confirm one financial change and lose the response after the domain commit", async () => {
      await entry.getByRole("checkbox", { name: "I reviewed these changes and want to apply them", exact: true }).check()
      const interruption = await loseClosureResponse(page, origin, "procurement", "decision-apply")
      try {
        const failed = page.waitForEvent("requestfailed", { predicate: (request) => procurementCommand(request, origin, "decision-apply") })
        const observed = Promise.all([interruption.completed, failed])
        await entry.getByRole("button", { name: "Apply reviewed change", exact: true }).click()
        const result = (await observed)[0]
        expect(result.httpStatus).toBe(200)
        expect(result.contentType).toContain("application/json")
        const receipt = asRecord(asRecord(result.body).value)
        expect(asRecord(result.body).status).toBe("ok")
        expect(receipt).toMatchObject({ surface: "procurement", outcome: "applied", version: domainVersion + 1 })
        expect(typeof receipt.receiptId).toBe("string")
        expect(result.payload).toEqual({ caseRef: change.caseRef, choiceId: selection.choiceId, changeId: change.changeId, reviewDigest: reviewed.reviewDigest })
        expect(commands).toHaveLength(1)
        await expect(entry.getByRole("button", { name: "Retry same application", exact: true })).toBeEnabled()
        await expect(entry.getByRole("checkbox", { name: "I reviewed these changes and want to apply them", exact: true })).toBeDisabled()
        observations.push({ stage: "apply-response-lost", caseRef: change.caseRef, choiceId: selection.choiceId, changeId: change.changeId,
          preview: reviewed, receipt, approval, applyRequests: 1, explicitApplyConfirmation: true, separateFinancialApproval: true,
          interruptionPoint: "Original HTTP response after the real handler returned; this does not isolate the domain-commit/case-reconciliation gap." })
        return result
      } finally { await interruption.close() }
    })
    const revisedObjective = `${selection.objective} — concurrent note after application`
    const editedRef = await test.step("edit the same case in another page while the original Apply remains uncertain", async () => {
      await openCase(audit, origin, selection.reference, selection.objective)
      await audit.getByText("Edit decision", { exact: true }).click()
      const editor = audit.locator("form[data-decision-edit]")
      await expect(editor).toHaveAttribute("data-sf-edit-ready", "true")
      const before = asRecord(JSON.parse((await editor.getAttribute("data-context"))!))
      expect(asRecord(before.caseRef)).toMatchObject(identity)
      await editor.getByLabel("Decision objective", { exact: true }).fill(revisedObjective)
      const loaded = audit.waitForEvent("domcontentloaded")
      const result = await clickCommand(audit, editor.getByRole("button", { name: "Save decision", exact: true }), "decision-edit", observations)
      await loaded
      const ref = asRecord(asRecord(result.value).caseRef)
      expect(ref).toEqual({ ...identity, version: Number(asRecord(before.caseRef).version) + 1 })
      await expect(audit.getByRole("heading", { name: revisedObjective, exact: true })).toBeVisible()
      expect(commands).toHaveLength(1)
      return ref
    })
    await test.step("recover the original receipt under a fresh admission without sending another Apply", async () => {
      // A new page never held the first Apply's body, key or review token.
      await openCase(fresh, origin, selection.reference, revisedObjective)
      const recoveredEntry = fresh.locator("[data-decision-apply]")
      await expect(recoveredEntry).toHaveCount(1)
      await expect(recoveredEntry).toHaveAttribute("data-sf-apply-ready", "true")
      const current = asRecord(JSON.parse((await recoveredEntry.getAttribute("data-context"))!))
      expect(current.caseRef).toEqual(editedRef)
      expect(current.choiceId).toBe(selection.choiceId)
      expect(current.changeId).toBe(change.changeId)
      const sent = fresh.waitForRequest((request) => procurementCommand(request, origin, "decision-recover"))
      const reply = fresh.waitForResponse((response) => procurementCommand(response.request(), origin, "decision-recover"))
      const loaded = fresh.waitForEvent("domcontentloaded")
      await recoveredEntry.getByRole("button", { name: "Recover recorded receipt", exact: true }).click()
      const request = await sent
      expect(request.postDataJSON()).toEqual({ purpose: "recover", caseRef: editedRef, choiceId: selection.choiceId, changeId: change.changeId })
      expect(request.headers()["idempotency-key"]).not.toBe(commands[0]!.key)
      const recovered = await readReply(await reply, observations)
      expect(recovered).toEqual(lost.body)
      await loaded
      expect(commands.filter((command) => command.mode === "decision-apply")).toHaveLength(1)
      expect(commands.filter((command) => command.mode === "decision-recover")).toHaveLength(1)
      const currentCase = asRecord(JSON.parse((await fresh.locator("form[data-decision-choice]").getAttribute("data-context"))!))
      expect(asRecord(currentCase.caseRef)).toMatchObject(identity)
      expect(currentCase.choices).toEqual(context.choices)
      const decision = fresh.getByRole("region", { name: "Decision", exact: true })
      const history = decision.locator(":scope > details").filter({ has: fresh.getByText("History and sources", { exact: true }) })
      await history.getByText("History and sources", { exact: true }).click()
      await expect(history.locator(":scope > p")).toHaveText(/^\d+ source references · 1 receipts$/)
      const unchangedDomain = await openRequest(audit, origin, requestId)
      await expect(unchangedDomain).toHaveAttribute("data-version", String(domainVersion + 1))
      await expect(unchangedDomain.getByLabel("Estimated amount", { exact: true })).toHaveValue(String(operation.amount))
      observations.push({ stage: "c12-fresh-admission-recovered", originalCaseRef: change.caseRef, editedCaseRef: editedRef,
        currentCaseRef: currentCase.caseRef, choiceId: selection.choiceId, changeId: change.changeId, receipt: recovered.value,
        applyRequests: 1, recoverRequests: 1, domainVersionBefore: domainVersion, domainVersionAfter: domainVersion + 1,
        originalChoiceUnchanged: true, nativeRestartProved: false })
    })
  } finally {
    page.context().off("request", record)
    await fresh.close()
    await audit.close()
  }
}

function procurementCommand(request: Request, origin: string, action: string) {
  const url = new URL(request.url())
  return request.method() === "POST" && url.origin === origin && url.pathname === "/sucafina/procurement" && url.searchParams.get("sf") === action
}

async function openCase(page: Page, origin: string, reference: string, objective: string) {
  await enterWorkbench(page, origin)
  const link = page.getByRole("link", { name: objective, exact: true })
  await expect(link).toHaveCount(1)
  expect(new URL((await link.getAttribute("href"))!, page.url()).searchParams.get("caseRef")).toBe(reference)
  await link.click()
  await expect(page.getByRole("heading", { name: objective, exact: true })).toBeVisible()
}

async function openRequest(page: Page, origin: string, id: string) {
  expect(id).toMatch(/^PR-\d{4}-\d+$/)
  await page.goto(`${origin}/sucafina/procurement?${new URLSearchParams({ page: "Requests", request: id, q: id })}`)
  const detail = page.locator("details").filter({ has: page.locator(`section[id="${id}-pr"]`) })
  await expect(detail).toHaveCount(1)
  await expect(detail).toHaveAttribute("open", "")
  const form = detail.locator(`section[id="${id}-pr"] form[data-command="save"]`)
  await expect(form).toHaveCount(1)
  await expect(form).toHaveAttribute("data-version", /^[1-9]\d*$/)
  return form
}
