import { expect, test, type Locator, type Page, type Request } from "@playwright/test"
import { Schema } from "effect"
import {
  SfDecisionsChoiceRead, SfDecisionsDecisionPrepareChanges, SfDecisionsDecisionApply,
  SfDecisionsDecisionRecover, SfDecisionsDecisionReview,
} from "@orchestra/schema/sucafina/decisions"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { asRecord, caseIdentity, enterWorkbench, isCommand, observeDecisionReply, readCase, reopenCase } from "./journey"
import { loseClosureResponse } from "./closure-response"
import { openRequisition } from "./procurement-source"

type CaseRecord = Awaited<ReturnType<typeof readCase>>
type Change = CaseRecord["preparedChanges"][number]
type CaseRef = typeof SfDecisionsDecisionReview.input.Type["caseRef"]
const casePath = (reference: string) => `/orchestra/sf-decisions/${encodeSfRouteRef(reference)}`
const reviewPanel = (page: Page) => page.locator('[data-component="sf-change-review"]')
const applyButton = (page: Page) => reviewPanel(page).getByRole("button", { name: "Apply reviewed change", exact: true })
const retryButton = (page: Page) => page.getByRole("button", { name: "Retry same application", exact: true })
const digest = /^[a-f0-9]{64}$/
const commandKey = /^[a-f0-9-]{36}$/

/** Consume the published C12 path only after the caller proves a compatible domain approval. */
export async function applyRecoveryJourney(page: Page, origin: string, selection: { reference: string; objective: string; choiceId: string }, observations: Record<string, unknown>[], approveBeforeApply: (page: Page, selection: typeof SfDecisionsDecisionReview.input.Type, review: Record<string, unknown>, operation: Record<string, unknown>) => Promise<{ requestId: string; amount: unknown; currency: string; version: number; currentAmount: number; action: string }>) {
  const { reference, objective, choiceId } = selection
  const identity = caseIdentity(reference)
  const original = await readCase(page, reference)
  const chosenRef = { ...identity, version: original.version }
  expect(original).toMatchObject({ objective, state: "chosen", preparedChanges: [], receipts: [] })
  const choices = original.choices.filter((choice) => choice.id === choiceId)
  expect(choices, "The public journey must have persisted the exact human Procurement choice").toHaveLength(1)
  const choice = choices[0]!
  expect(choice.scenario.operations, "C12 requires exactly one recorded Procurement operation").toHaveLength(1)
  const operation = choice.scenario.operations[0]!
  expect(operation).toMatchObject({ kind: "replace", currency: original.currency, period: original.horizon })
  expect(operation.replacementRef).toBeUndefined()
  expect(typeof operation.amount === "number" && Number.isFinite(operation.amount) && operation.amount > 0).toBe(true)
  const sources = choice.result.sourceRefs.flatMap((ref) => ref.kind === "record" && ref.refId === operation.targetRef &&
    ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" ? [ref] : [])
  expect(sources).toHaveLength(1)
  const source = sources[0]!
  expect(source.target).toMatchObject({ period: operation.period, fields: expect.arrayContaining(["originalAmount"]) })
  expect(original.sourceRefs).toContainEqual(source)
  const requestId = source.target.recordId

  const commands: Request[] = []
  const record = (request: Request) => {
    const url = new URL(request.url())
    if (url.origin === origin && request.method() === "POST" && ["decision-apply", "decision-recover"].includes(url.searchParams.get("sf") ?? ""))
      commands.push(request)
  }
  const context = page.context()
  const audit = await context.newPage()
  context.on("request", record)
  try {
    await test.step("read the recorded conditioned Procurement choice in UI38", async () => {
      const pathname = `${casePath(reference)}/choice`
      const response = await observeDecisionReply(page, (request) => {
        const url = new URL(request.url())
        return url.origin === origin && isCommand(request, "current-choice", "GET") && url.searchParams.size === 3 &&
          url.searchParams.get("format") === "json" && url.searchParams.get("case") === reference
      }, () => page.goto(origin + pathname))
      await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === pathname)
      await expect(page.getByRole("heading", { name: "Current choice", exact: true, level: 1 })).toBeVisible()
      const options = Schema.decodeUnknownSync(Schema.toType(SfDecisionsChoiceRead.output), { onExcessProperty: "error" })(
        await producerReply(response, observations, "UI38 current-choice read"),
      )
      if (options.status !== "ok" || !options.value.selected) throw new Error("UI38 did not return the exact authorized choice scope")
      const selected = options.value.selected
      expect(selected.caseRef).toEqual(chosenRef)
      expect(selected.title).toBe(objective)
      expect(options.value.cases.filter((item) => item.ref === reference)).toEqual([{ ref: reference, title: objective, version: original.version }])
      const matches = selected.choices.filter((item) => item.id === choiceId)
      expect(matches).toHaveLength(1)
      const option = matches[0]!
      const card = page.getByRole("region", { name: "Current choice", exact: true })
        .locator(`article[data-choice-id=${JSON.stringify(choiceId)}]`)
      await expect(card.getByRole("heading", { name: option.title, exact: true })).toBeVisible()
      await expect(card.getByRole("region", { name: "Registered result", exact: true }).getByText(choice.reason, { exact: true })).toBeVisible()
      await expect(card.getByRole("region", { name: "Registered result", exact: true })).toContainText("conditioned")
      expect(choice.result.comparisonStatus).toBe("conditioned")
      expect(choice.result.total).toBeNull()
      expect(choice.result.unresolvedConditions.some((condition) => condition.startsWith("external-operation:"))).toBe(true)
      expect(commands).toEqual([])
    })

    const { change, preparedRef } = await test.step("explicitly prepare and reread the exact Procurement proposal in UI39", async () => {
      const pathname = `${casePath(reference)}/changes`
      await page.goto(origin + pathname)
      await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === pathname)
      await expect(page.getByRole("heading", { name: "Prepared changes", exact: true, level: 1 })).toBeVisible()
      const pending = page.getByRole("region", { name: "Prepare Procurement proposal", exact: true })
      await expect(pending).toContainText(`${requestId} · ${operation.amount} ${operation.currency}`)
      const prepare = pending.getByRole("button", { name: "Prepare Procurement proposal", exact: true })
      const reply = await observeDecisionReply(page, (request) => procurementCommand(request, origin, "decision-prepare-changes"),
        () => prepare.click())
      expect(reply.request().postDataJSON()).toEqual({ caseRef: chosenRef, choiceId, operations: [operation] })
      expect(reply.request().headers()["idempotency-key"]).toMatch(commandKey)
      const result = Schema.decodeUnknownSync(Schema.toType(SfDecisionsDecisionPrepareChanges.output), { onExcessProperty: "error" })(
        await producerReply(reply, observations, "UI39 exact Procurement preparation"),
      )
      if (result.status !== "ok") throw new Error(`C12 preparation failed: ${result.status} ${result.reason ?? ""}`)
      expect(result.value.caseRef).toEqual({ ...chosenRef, version: chosenRef.version + 1 })
      expect(commands).toEqual([])
      const prepared = await readCase(page, reference)
      expect(prepared).toMatchObject({ objective, choices: original.choices, receipts: [] })
      // Preparing the exact domain command keeps the original choice and its economic conditions.
      const changes = prepared.preparedChanges.filter((item) => item.choiceId === choiceId && item.target.surface === "procurement" &&
        item.target.type === "procurement-request" && item.target.id === requestId && item.target.incarnation === source.target.incarnation)
      expect(changes, "UI39 requires a real C12 prepared change for this choice and requisition; UI38 review is not decision-prepare-changes").toHaveLength(1)
      const change = changes[0]!
      expect(change).toMatchObject({ caseId: identity.id, caseVersion: original.version, state: "planned" })
      expect(change.receiptRef).toBeUndefined()
      expect(prepared.version).toBe(change.caseVersion + 1)
      const row = changeButton(page, change)
      await expect(row).toHaveCount(1)
      await row.click()
      await expect(row).toHaveAttribute("aria-current", "true")
      return { change, preparedRef: { ...identity, version: prepared.version } }
    })
    const reviewInput = { caseRef: preparedRef, choiceId, changeId: change.id }

    const preview = await test.step("read the exact Procurement preview without applying it", async () => {
      await expect(applyButton(page)).toHaveCount(0)
      const review = await readChangeReview(page, origin, reviewInput, observations, "pre-approval Procurement review")
      expect(review).toMatchObject({ choiceId, changeId: change.id, surface: "procurement", state: "planned",
        target: { type: "procurement-request", id: requestId }, expectedVersion: change.expectedVersion })
      expect(review.receipt).toBeUndefined()
      expect(review.requiresProcurementApproval).toBe(true)
      expect(review.fields.filter((field) => field.field === "originalAmount")).toEqual([
        expect.objectContaining({ before: expect.any(Number), beforeCurrency: operation.currency, after: operation.amount, afterCurrency: operation.currency }),
      ])
      expect(commands).toEqual([])
      return review
    })

    const approval = await approveBeforeApply(page, reviewInput, asRecord(preview), asRecord(operation))
    expect(approval).toMatchObject({ requestId, amount: operation.amount, currency: operation.currency, action: "approve" })
    expect(commands).toEqual([])

    const reviewed = await test.step("require a new producer review after explicit Procurement approval", async () => {
      await reviewPanel(page).getByRole("button", { name: "Revise", exact: true }).click()
      await expect(applyButton(page)).toHaveCount(0)
      const review = await readChangeReview(page, origin, reviewInput, observations, "post-approval review of the original prepared Procurement CAS")
      expect(review).toEqual({ ...preview, reviewDigest: expect.stringMatching(digest) })
      await expect(applyButton(page)).toBeEnabled()
      return review
    })
    const domain = await openRequisition(audit, origin, requestId)
    const domainVersion = await sourceVersion(domain)
    expect(domainVersion, "Approval must leave a compatible, freshly reviewed domain CAS").toBe(approval.version)
    expect(reviewed.expectedVersion).toBe(domainVersion)
    await expect(domain.getByLabel("Estimated amount", { exact: true })).toHaveValue(String(approval.currentAmount))
    await expect(domain.locator("p").filter({ hasText: /^Status:/ })).toHaveText("Status: draft")
    expect(commands).toEqual([])

    const lost = await test.step("confirm one Apply and drop its original response after the producer completes", async () => {
      const interruption = await loseClosureResponse(page, origin, "procurement", "decision-apply")
      try {
        const [result, failed] = await Promise.all([
          interruption.completed,
          page.waitForEvent("requestfailed", { predicate: (request) => procurementCommand(request, origin, "decision-apply") }),
          applyButton(page).click(),
        ])
        expect(commands).toEqual([failed])
        const applyKey = failed.headers()["idempotency-key"]
        expect(applyKey).toMatch(commandKey)
        const payload = { ...reviewInput, reviewDigest: reviewed.reviewDigest }
        expect(failed.postDataJSON()).toEqual(payload)
        expect(result.payload).toEqual(payload)
        expect(result.contentType).toContain("application/json")
        expect(result.httpStatus, `Original Apply response: ${JSON.stringify(result.body)}`).toBe(200)
        const committed = Schema.decodeUnknownSync(Schema.toType(SfDecisionsDecisionApply.output), { onExcessProperty: "error" })(result.body)
        if (committed.status !== "ok") throw new Error(`Apply did not commit: ${committed.status} ${committed.reason ?? ""}`)
        expect(committed.value).toEqual({ receiptId: expect.stringMatching(/\S/), surface: "procurement", outcome: "applied", version: domainVersion + 1 })
        await expect(page.locator('.sf-state-panel[data-sf-state="outcome-unknown"]')).toBeVisible()
        await expect(applyButton(page)).toHaveCount(0)
        await expect(retryButton(page)).toBeEnabled() // Observe uncertainty; never retry.
        observations.push({ stage: "apply-response-lost", ...reviewInput, preview: reviewed, receipt: committed.value, approval,
          applyRequests: 1, explicitApplyConfirmation: true, separateFinancialApproval: true,
          interruptionPoint: "Original HTTP response after the real handler returned; this does not isolate the domain-commit/case-reconciliation gap." })
        return { committed, failed, applyKey }
      } finally { await interruption.close() }
    })

    const revisedObjective = `${objective} — concurrent note after application`
    const edited = await test.step("edit only the intent of the same case in a second page while Apply remains uncertain", async () => {
      const appliedDomain = await openRequisition(audit, origin, requestId)
      expect(await sourceVersion(appliedDomain)).toBe(domainVersion + 1)
      await expect(appliedDomain.getByLabel("Estimated amount", { exact: true })).toHaveValue(String(operation.amount))
      await enterWorkbench(audit, origin)
      await reopenCase(audit, reference, objective)
      const before = await readCase(audit, reference)
      const beforeRef = { ...identity, version: preparedRef.version + 1 }
      expect(before).toMatchObject({ ...beforeRef, objective, choices: original.choices })
      const appliedChange = { ...change, state: "applied", receiptRef: lost.committed.value.receiptId } as const
      expect(before.preparedChanges.filter((item) => item.id === change.id)).toEqual([appliedChange])
      expect(before.receipts).toHaveLength(1)
      const persisted = before.receipts[0]!
      expect(persisted).toMatchObject({ id: lost.committed.value.receiptId, surface: "procurement", status: "applied",
        version: lost.committed.value.version, targetIncarnation: change.target.incarnation, idempotencyKey: change.idempotencyKey,
        principalRef: choice.principalRef, commandDigest: expect.stringMatching(digest), errors: [] })
      const receiptEvidence = before.sourceRefs.flatMap((ref) => ref.kind === "receipt" && ref.target.receiptId === persisted.id ? [ref.target] : [])
      expect(receiptEvidence).toEqual([{ receiptId: persisted.id, surface: persisted.surface, version: persisted.version,
        targetIncarnation: persisted.targetIncarnation, idempotencyKey: persisted.idempotencyKey, commandDigest: persisted.commandDigest }])

      const decision = audit.locator('[data-sf-surface="UI34"]')
      await expect(decision).toHaveAttribute("data-sf-case-ref", reference)
      await expect(decision).toHaveAttribute("data-sf-case-version", String(beforeRef.version))
      await audit.getByRole("button", { name: "Edit decision", exact: true }).click()
      const editor = decision.locator("[data-sf-decision-editor]")
      const objectiveEdit = editor.getByLabel("Decision objective", { exact: true })
      await expect(objectiveEdit).toHaveValue(objective)
      await objectiveEdit.fill(revisedObjective)
      await editor.getByRole("button", { name: "Review source attachments", exact: true }).click()
      const editReview = editor.getByRole("group", { name: "Review source attachments", exact: true })
      await expect(editReview.getByText(`Current version: ${beforeRef.version}`, { exact: true })).toBeVisible()
      await expect(editReview.getByText(revisedObjective, { exact: true })).toBeVisible()
      const reply = await observeDecisionReply(audit, (request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-edit` &&
        isCommand(request, "decision-edit"), () => editReview.getByRole("button", { name: "Save decision", exact: true }).click())
      expect(reply.request().postDataJSON()).toEqual({ caseRef: beforeRef, objective: revisedObjective, criteria: before.criteria,
        horizon: before.horizon, currency: before.currency, sourceRefs: before.sourceRefs })
      expect(reply.request().headers()["idempotency-key"]).toMatch(commandKey)
      const ref = { ...identity, version: beforeRef.version + 1 }
      expect(await producerReply(reply, observations, "UI34 objective-only edit after Apply")).toEqual({ status: "ok", value: { caseRef: ref } })
      await expect(decision).toHaveAttribute("data-sf-case-version", String(ref.version))
      await expect(decision.getByRole("region", { name: "Question", exact: true }).getByText(revisedObjective, { exact: true })).toBeVisible()
      const record = await readCase(audit, reference)
      expect(record).toEqual({ ...before, ...ref, objective: revisedObjective })
      expect(commands).toEqual([lost.failed])
      return { ref, record, change: appliedChange }
    })

    await test.step("recover the exact persisted receipt once in a fresh authorized UI39 page", async () => {
      const fresh = await context.newPage()
      try {
        const pathname = `${casePath(reference)}/changes/${encodeSfRouteRef(change.id)}`
        await fresh.goto(origin + pathname)
        await expect(fresh).toHaveURL((url) => url.origin === origin && url.pathname === pathname)
        await expect(fresh.getByRole("heading", { name: "Prepared changes", exact: true, level: 1 })).toBeVisible()
        expect(await readCase(fresh, reference)).toEqual(edited.record)
        await expect(changeButton(fresh, edited.change)).toHaveAttribute("aria-current", "true")
        await expect(retryButton(fresh)).toHaveCount(0)
        await expect(applyButton(fresh)).toHaveCount(0)
        const recover = fresh.getByRole("button", { name: "Recover recorded receipt", exact: true })
        await expect(recover, "The fresh page must be authorized for decisions.decision-recover").toBeEnabled()
        expect(commands).toEqual([lost.failed])
        const reply = await observeDecisionReply(fresh, (request) => procurementCommand(request, origin, "decision-recover"), () => recover.click())
        const request = reply.request()
        expect(request.postDataJSON()).toEqual({ purpose: "recover", caseRef: edited.ref, choiceId, changeId: change.id })
        expect(request.headers()["idempotency-key"]).toMatch(commandKey)
        expect(request.headers()["idempotency-key"]).not.toBe(lost.applyKey)
        const recovered = Schema.decodeUnknownSync(Schema.toType(SfDecisionsDecisionRecover.output), { onExcessProperty: "error" })(
          await producerReply(reply, observations, "UI39 fresh receipt recovery"),
        )
        expect(recovered).toEqual(lost.committed)
        const receipt = lost.committed.value
        const outcome = fresh.getByRole("status").filter({ has: fresh.getByRole("heading", { name: "Producer receipt reference", exact: true }) })
        await expect(outcome.locator("dd")).toHaveText([receipt.outcome, receipt.receiptId, String(receipt.version)])
        const persisted = fresh.locator('[data-component="sf-receipt-view"] [data-receipt="producer"]')
        await expect(persisted).toHaveCount(1)
        await expect(persisted.getByText(receipt.receiptId, { exact: true })).toBeVisible()
        await expect(persisted.getByText(`Source version ${receipt.version}`, { exact: true })).toBeVisible()
        expect(await readCase(fresh, reference)).toEqual(edited.record)
        const unchangedDomain = await openRequisition(audit, origin, requestId)
        expect(await sourceVersion(unchangedDomain)).toBe(domainVersion + 1)
        await expect(unchangedDomain.getByLabel("Estimated amount", { exact: true })).toHaveValue(String(operation.amount))
        expect(commands).toEqual([lost.failed, request])
        observations.push({ stage: "c12-fresh-admission-recovered", originalCaseRef: preparedRef, editedCaseRef: edited.ref,
          currentCaseRef: edited.ref, choiceId, changeId: change.id, receipt, applyRequests: 1, recoverRequests: 1,
          domainVersionBefore: domainVersion, domainVersionAfter: domainVersion + 1, originalChoiceUnchanged: true, nativeRestartProved: false })
      } finally { await fresh.close() }
    })
  } finally {
    context.off("request", record)
    await audit.close()
  }
}

function procurementCommand(request: Request, origin: string, action: string) {
  return request.method() === "POST" && request.url() === `${origin}/sucafina/procurement?sf=${action}`
}

function changeButton(page: Page, change: Pick<Change, "target" | "state" | "expectedVersion">) {
  return page.getByRole("button", { name: `${change.target.id} · ${change.state} · v${change.expectedVersion}`, exact: true })
}

async function readChangeReview(page: Page, origin: string, input: { caseRef: CaseRef; choiceId: string; changeId: string },
  observations: Record<string, unknown>[], stage: string) {
  const button = page.getByRole("button", { name: "Read producer review", exact: true })
  await expect(button, stage).toBeEnabled()
  const response = await observeDecisionReply(page, (request) => procurementCommand(request, origin, "decision-review"), () => button.click())
  expect(response.request().postDataJSON()).toEqual(input)
  const result = Schema.decodeUnknownSync(Schema.toType(SfDecisionsDecisionReview.output), { onExcessProperty: "error" })(
    await producerReply(response, observations, stage),
  )
  if (result.status !== "ok") throw new Error(`${stage}: ${result.status} ${result.reason ?? ""}`)
  const proposed = reviewPanel(page).getByRole("region", { name: "Proposed values", exact: true })
  await expect(proposed.locator("dd")).toHaveText([
    input.caseRef.id, input.caseRef.incarnation, String(input.caseRef.version), input.choiceId, input.changeId, result.value.reviewDigest,
    ...result.value.fields.map((field) => field.after === null ? "Unavailable" : String(field.after) + (field.afterCurrency ? ` ${field.afterCurrency}` : "")),
  ])
  return result.value
}

async function producerReply(response: Awaited<ReturnType<typeof observeDecisionReply>>, observations: Record<string, unknown>[], stage: string) {
  const url = new URL(response.url())
  const path = url.pathname + url.search
  expect(response.headers()["content-type"], `${stage}: expected JSON from ${path}`).toContain("application/json")
  const result = asRecord(await response.json())
  const diagnostic = { stage, path, httpStatus: response.status(), status: result.status, reason: result.reason }
  observations.push(diagnostic)
  expect({ httpStatus: diagnostic.httpStatus, status: diagnostic.status }, JSON.stringify(diagnostic)).toEqual({ httpStatus: 200, status: "ok" })
  return result
}

async function sourceVersion(detail: Locator) {
  const line = detail.locator("p").filter({ hasText: /^Current source version:/ })
  await expect(line).toHaveText(/^Current source version: [1-9]\d*$/)
  return Number((await line.innerText()).replace("Current source version: ", ""))
}
