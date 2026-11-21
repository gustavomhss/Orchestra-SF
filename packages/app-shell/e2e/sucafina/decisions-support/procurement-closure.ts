import { expect, test, type Locator, type Page } from "@playwright/test"
import { asRecord, caseIdentity, clickCommand, draft, isCommand, observeDecisionReply, readCase, readReply, reopenCase } from "./journey"
import { initialAlternativesJourney, knownIncreaseCriterion } from "./initial-alternatives"
import { approveExactRequisition, createRequisition, openRequisition } from "./procurement-source"
import type { startPlannerInstallation } from "../wp03/installation-fixture"
import { applyRecoveryJourney } from "./apply-recovery"

/** Nominal selection: every unmet public producer is a failure at its first required action. */
export async function procurementClosureJourney(page: Page, installation: Awaited<ReturnType<typeof startPlannerInstallation>>, observations: Record<string, unknown>[]) {
  const requestId = await test.step("create the real requisition through its human form", () => createRequisition(page, installation.origin, observations))
  const selection = await initialAlternativesJourney(page, installation, observations)
  await reopenCase(page, selection.reference, selection.objective)
  const source = await attachRequisition(page, installation.origin, selection.reference, requestId, observations)
  const titles = { baseline: "Requisition proposal for 120 USD", candidate: "Requisition proposal for 140 USD" }
  const baseline = await typedAlternative(page, installation.origin, selection.reference, selection.sources.baseline, source, titles.baseline, 120, observations)
  const candidate = await typedAlternative(page, installation.origin, selection.reference, selection.sources.candidate, source, titles.candidate, 140, observations)
  const choiceId = await test.step("compare the two typed proposals and record a human choice without approving spending", async () => {
    const { origin } = installation
    const { reference } = selection
    const before = await readCase(page, reference)
    const caseRef = { ...caseIdentity(reference), version: 7 }
    expect(before.version).toBe(caseRef.version)
    expect(before.choices).toEqual([])
    expect(before.alternatives).toHaveLength(4)
    expect(before.alternatives).toEqual(expect.arrayContaining([baseline.saved, candidate.saved]))
    await page.locator('[data-sf-surface="UI34"]').getByRole("link", { name: "Alternatives", exact: true }).click()
    for (const alternative of [baseline.saved, candidate.saved]) {
      const card = page.locator(".sf-n24-compare-card").filter({ has: page.getByRole("heading", { name: alternative.title, exact: true }) })
      await expect(card).toHaveCount(1)
      const select = card.getByRole("button", { name: "Select for comparison", exact: true })
      await select.click()
      await expect(select).toHaveAttribute("aria-pressed", "true")
    }
    const eligibility = page.getByRole("region", { name: "Elegibilidade de alternativas e decisão", exact: true })
    const choiceReview = eligibility.getByRole("button", { name: "Revisar elegibilidade e escolha", exact: true })
    const justification = eligibility.getByRole("textbox", { name: "Justificativa para registrar a escolha", exact: true })
    const criteria = before.criteria.map((criterion) => criterion.id)
    const compare = async () => {
      const response = await observeDecisionReply(page, (request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-compare` &&
        isCommand(request, "decision-compare"), () => page.getByRole("button", { name: "Compare alternatives", exact: true }).click())
      expect(response.request().postDataJSON()).toEqual({ caseRef, baselineAlternativeId: baseline.saved.id, alternativeId: candidate.saved.id, criteria })
      const compared = asRecord((await readReply(response, observations)).value)
      const scenarioRefs = [baseline.resultRef, candidate.resultRef]
      expect(compared.request).toEqual({ scenarioRefs, criteria })
      expect(compared.comparison).toMatchObject({ baselineResultRef: scenarioRefs[0], alternativeResultRef: scenarioRefs[1],
        comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
      await expect(page.getByRole("region", { name: "Comparison", exact: true }).getByText("1200 USD", { exact: true })).toBeVisible()
      return compared
    }
    const initial = await compare()
    expect(asRecord(initial.comparison).criterionResults).toEqual(criteria.map((criterionId) => ({ criterionId, state: "unknown", reason: "criterion-rule-unavailable" })))
    const reason = "I choose the 140 USD proposal under its unresolved external cost conditions. Financial approval is still required before Apply."
    await justification.fill(reason)
    await expect(choiceReview).toBeDisabled()
    const rule = page.getByRole("group", { name: "Numeric comparison rule", exact: true })
    const matchingCriteria = before.criteria.filter((criterion) => criterion.description === knownIncreaseCriterion)
    expect(matchingCriteria).toHaveLength(1)
    const criterionId = matchingCriteria[0]!.id
    await rule.getByRole("combobox", { name: "Criterion for numeric comparison", exact: true }).selectOption(criterionId)
    const controls = await readControls(page, origin, reference, rule.getByRole("button", { name: "Load comparison rule", exact: true }), observations)
    expect(controls.caseRef).toEqual(caseRef)
    expect((controls.rules as unknown[]).map(asRecord).filter((item) => item.id === criterionId)).toEqual([{ id: criterionId, expectedVersion: 0 }])
    const evidence = rule.getByRole("listbox", { name: "Evidence for the numeric rule", exact: true })
    await expect(evidence).toBeEnabled()
    await expect(evidence.getByRole("option")).not.toHaveCount(0)
    const digests = await evidence.getByRole("option").evaluateAll((options) => options.map((option) => option.getAttribute("value") ?? ""))
    expect(new Set(digests).size).toBe(digests.length)
    const visibleRefs = digests.map((digest) => {
      const matches = (controls.evidence as unknown[]).map(asRecord).map((entry) => asRecord(entry.evidence)).filter((ref) => ref.refDigest === digest)
      expect(matches).toHaveLength(1)
      expect([baseline.saved, candidate.saved].some((alternative) => alternative.result.sourceRefs.some((ref) => ref.refDigest === digest))).toBe(true)
      return matches[0]!
    })
    const refs = visibleRefs.filter((ref) => asRecord(ref.target).surface === "planner")
    expect(refs).toHaveLength(2)
    for (const ref of refs) expect(ref.target).toMatchObject({ surface: "planner", recordType: "planner-version", period: draft.horizon })
    await evidence.selectOption(refs.map((ref) => String(ref.refDigest)))
    await rule.getByRole("combobox", { name: "Numeric comparison condition", exact: true }).selectOption("lte")
    const limit = rule.getByRole("spinbutton", { name: "Limit for known subtotal difference in USD", exact: true })
    await expect(limit).toHaveValue("")
    await limit.fill("2000")
    const [ruleRequest, ruleResult] = await Promise.all([
      page.waitForRequest((request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-criteria` && isCommand(request, "decision-criteria")),
      clickCommand(page, rule.getByRole("button", { name: "Save comparison rule", exact: true }), "decision-criteria", observations),
    ])
    expect(ruleRequest.postDataJSON()).toEqual({ caseRef, criterionId, metricRef: "planner:known-subtotal-difference",
      operator: "lte", value: 2000, unit: "USD", period: draft.horizon, evidenceRefs: refs, expectedRuleVersion: 0 })
    expect(ruleRequest.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
    expect(ruleResult.value).toEqual({ ruleRef: expect.stringMatching(/^criterion-rule:/), version: 1 })
    await expect(rule.getByText("Comparison rule saved at revision 1. Compare again before choosing. Financial approval remains separate.", { exact: true })).toBeVisible()
    await expect(choiceReview).toBeDisabled()
    expect((await readCase(page, reference)).version).toBe(caseRef.version)
    observations.push({ stage: "human-numeric-rule-saved", caseRef, criterionId, rule: ruleResult.value, operator: "lte", limit: 2000,
      unit: "USD", evidenceRefs: refs, financialApproval: false, unknownCostsRemainPending: true })
    const compared = await compare()
    expect(compared.request).toEqual(initial.request)
    expect(asRecord(compared.comparison).criterionResults).toEqual([{ criterionId, state: "unknown", reason: "criterion-metric-conditioned" }])
    await justification.fill(reason)
    await choiceReview.click()
    const confirmation = eligibility.getByRole("button", { name: "Confirmar escolha com CAS", exact: true })
    await expect(eligibility.locator(".sf-n24-review").getByText(`alternativeId ${candidate.saved.id} · v1`, { exact: true })).toBeVisible()
    expect((await readCase(page, reference)).choices).toEqual([])
    const [sent, receipt] = await Promise.all([
      page.waitForRequest((request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-choose` && isCommand(request, "decision-choose")),
      clickCommand(page, confirmation, "decision-choose", observations),
    ])
    expect(sent.postDataJSON()).toEqual({ caseRef, alternativeId: candidate.saved.id, alternativeVersion: candidate.saved.version,
      comparison: compared.request, criteria, reason })
    expect(sent.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
    const confirmed = { ...caseRef, version: caseRef.version + 1 }
    expect(asRecord(receipt.value).caseRef).toEqual(confirmed)
    const current = await readCase(page, reference)
    expect(current).toMatchObject({ ...confirmed, state: "chosen", preparedChanges: [], receipts: [] })
    expect(current.choices).toHaveLength(1)
    const saved = current.choices[0]!
    expect(saved).toMatchObject({ alternativeId: candidate.saved.id, alternativeVersion: 1, reason,
      principalRef: installation.actorId, comparisonStatus: "conditioned", comparison: compared.comparison })
    expect(saved.scenario.operations).toEqual([{ kind: "replace", targetRef: source.refId, amount: 140, currency: "USD", period: draft.horizon }])
    expect(saved.result).toMatchObject({ knownSubtotal: 2400, total: null, comparisonStatus: "conditioned" })
    expect(saved.result.unresolvedConditions.some((condition) => condition.startsWith("external-operation:"))).toBe(true)
    expect(saved.result.sourceRefs).toContainEqual(source)
    observations.push({ stage: "human-procurement-choice-recorded", caseRef: confirmed, choice: saved,
      financialApproval: false, financialApplication: false, externalCostRemainsUnresolved: true })
    return saved.id
  })
  const audit = await page.context().newPage()
  try {
    const original = await openRequisition(audit, installation.origin, requestId)
    await expect(original.locator("p").filter({ hasText: /^Status:/ })).toHaveText("Status: draft")
    await expect(original.locator("p").filter({ hasText: /^Stage:/ })).toHaveText("Stage: pr")
    await expect(original.locator("p").filter({ hasText: /^Current source version:/ })).toHaveText("Current source version: 1")
    await expect(original.getByLabel("Estimated amount", { exact: true })).toHaveValue("100")
  } finally { await audit.close() }
  // Published C12 is consumed here; no Apply is sent until its current preview and
  // a real, compatible domain approval both succeed. Missing stages never pass.
  await applyRecoveryJourney(page, installation.origin, { ...selection, choiceId }, observations,
    (approvalPage, selector, review, operation) => approveExactRequisition(approvalPage, installation, selector, review, operation, observations))
}

async function attachRequisition(page: Page, origin: string, reference: string, requestId: string, observations: Record<string, unknown>[]) {
  return test.step("inspect the authorized Procurement evidence and attach it to the human case", async () => {
    const decision = page.locator('[data-sf-surface="UI34"]')
    await expect(decision).toHaveAttribute("data-sf-case-ref", reference)
    await expect(decision).toHaveAttribute("data-sf-case-version", "4")
    const before = await readCase(page, reference)
    const caseRef = { ...caseIdentity(reference), version: 4 }
    expect(before.version).toBe(caseRef.version)
    await page.getByRole("button", { name: "Edit decision", exact: true }).click()
    const editor = decision.locator("[data-sf-decision-editor]")
    await expect(editor).toBeVisible()
    const selected = await readControls(page, origin, reference,
      editor.getByRole("button", { name: "Find Procurement sources", exact: true }), observations)
    expect(selected.caseRef).toEqual(caseRef)
    const entries = (asRecord(selected.procurementEvidence).sources as unknown[]).map(asRecord)
      .filter((entry) => asRecord(asRecord(entry.source).target).recordId === requestId)
    expect(entries).toHaveLength(1)
    const observed = asRecord(entries[0]!.source)
    expect(observed.refId, "A temporary BI06 approval-row reference is not durable Procurement evidence").toMatch(/^sf-procurement:[^:]+:[1-9]\d*$/)
    const source = editor.getByRole("combobox", { name: "Procurement source", exact: true })
    await expect(source).toBeEnabled()
    const option = source.getByRole("option", { name: `Request ${requestId} · revision ${asRecord(observed.target).version}`, exact: true })
    await expect(option).toHaveCount(1)
    await source.selectOption({ label: (await option.textContent())!.trim() })
    const digest = await source.inputValue()
    expect(digest).toBe(observed.refDigest)
    const current = await readControls(page, origin, reference,
      editor.getByRole("button", { name: "Inspect selected procurement source", exact: true }), observations)
    expect(current.caseRef).toEqual(caseRef)
    const currentEntries = (asRecord(current.procurementEvidence).sources as unknown[]).map(asRecord)
      .filter((entry) => asRecord(entry.source).refDigest === digest)
    expect(currentEntries).toHaveLength(1)
    expect(currentEntries[0]!.source).toEqual(observed)
    await expect(editor.locator("[data-procurement-preview]")).toHaveAttribute("data-state", "ready")
    await expect(editor.locator("[data-procurement-preview]")).toContainText(requestId)
    await expect(editor.locator("[data-procurement-preview]")).toContainText("USD")
    await editor.getByRole("button", { name: "Attach procurement source to draft", exact: true }).click()
    await expect(editor.locator("[data-decision-sources] > li")).toHaveCount(3)
    await expect(editor.getByRole("button", { name: "Save decision", exact: true })).toHaveCount(0)
    await editor.getByRole("button", { name: "Review source attachments", exact: true }).click()
    const review = editor.getByRole("group", { name: "Review source attachments", exact: true })
    await expect(review.getByText(String(observed.refId), { exact: true })).toBeVisible()
    await expect(review.getByText("Current version: 4", { exact: true })).toBeVisible()
    expect((await readCase(page, reference)).sourceRefs).toEqual(before.sourceRefs)
    const [sent, receipt] = await Promise.all([
      page.waitForRequest((request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-edit` && isCommand(request, "decision-edit")),
      clickCommand(page, review.getByRole("button", { name: "Save decision", exact: true }), "decision-edit", observations),
    ])
    const request = asRecord(sent.postDataJSON())
    expect(request).toEqual({ caseRef, objective: before.objective, criteria: before.criteria, horizon: before.horizon,
      currency: before.currency, sourceRefs: [...before.sourceRefs, observed] })
    expect(sent.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
    const refs = (request.sourceRefs as unknown[]).map(asRecord)
    const added = refs.filter((ref) => ref.refDigest === digest)
    expect(added).toHaveLength(1)
    expect(added[0]).toEqual(observed)
    expect(added[0]!).toMatchObject({ kind: "record", evidenceLevel: "observed", target: { surface: "procurement", recordType: "procurement-request", recordId: requestId, period: draft.horizon } })
    expect(refs).toHaveLength(3)
    expect(refs).toEqual(expect.arrayContaining([...before.sourceRefs]))
    expect(asRecord(receipt.value).caseRef).toEqual({ ...caseIdentity(reference), version: 5 })
    await expect(decision).toHaveAttribute("data-sf-case-version", "5")
    await expect(decision.getByRole("region", { name: "Source references", exact: true })).toContainText(String(observed.refId))
    const saved = await readCase(page, reference)
    expect(saved).toMatchObject({ ...caseIdentity(reference), version: 5, objective: before.objective, criteria: before.criteria,
      horizon: before.horizon, currency: before.currency, alternatives: before.alternatives, choices: [] })
    expect(saved.sourceRefs).toEqual(refs)
    observations.push({ stage: "authorized-procurement-source-attached", caseRef: asRecord(receipt.value).caseRef, source: added[0] })
    return added[0]!
  })
}

async function readControls(page: Page, origin: string, reference: string, button: Locator, observations: Record<string, unknown>[], source?: string) {
  const observed = await observeDecisionReply(page, (request) => {
    const url = new URL(request.url())
    return url.origin === origin && isCommand(request, "decision-controls", "GET") &&
      url.searchParams.get("format") === "json" && url.searchParams.get("case") === reference &&
      url.searchParams.size === (source ? 5 : 3) && (!source ||
        url.searchParams.get("source") === source && url.searchParams.get("procurement") === "attached")
  }, () => button.click())
  const reply = await readReply(observed, observations)
  return asRecord(asRecord(reply.value).selected)
}

async function typedAlternative(page: Page, origin: string, reference: string, versionId: string, requestSource: Record<string, unknown>, title: string, amount: number, observations: Record<string, unknown>[]) {
  return test.step(`create the typed Procurement alternative for ${amount} USD through public controls`, async () => {
    const decision = page.locator('[data-sf-surface="UI34"]')
    const form = decision.getByRole("region", { name: "Create Procurement proposal", exact: true })
    await expect(form).toBeVisible()
    const before = await readCase(page, reference)
    const caseRef = { ...caseIdentity(reference), version: before.version }
    const refs = before.sourceRefs.filter((ref) => ref.kind === "record" && ref.target.surface === "planner" &&
      ref.target.recordType === "planner-version" && ref.target.recordId === versionId)
    expect(refs).toHaveLength(1)
    const source = refs[0]!
    expect(source.target).toMatchObject({ surface: "planner", recordType: "planner-version", recordId: versionId })
    const planner = form.getByRole("combobox", { name: "Attached Planner source", exact: true })
    await planner.selectOption(source.refDigest)
    await expect(planner).toHaveValue(source.refDigest)
    const selected = await readControls(page, origin, reference,
      form.getByRole("button", { name: "Inspect attached forecast", exact: true }), observations, source.refDigest)
    expect(selected.caseRef).toEqual(caseRef)
    const forecast = asRecord(selected.forecast)
    expect(forecast.source).toEqual(source)
    const coverage = asRecord(forecast.coverage)
    expect(coverage.coverageRef).toMatch(/^baseline-coverage:/)
    expect(asRecord(coverage.assessment).coverageState).toBe("pending")
    const authorized = (asRecord(selected.procurementEvidence).sources as unknown[]).map(asRecord)
      .filter((entry) => asRecord(entry.source).refDigest === requestSource.refDigest)
    expect(authorized).toHaveLength(1)
    expect(authorized[0]!.source).toEqual(requestSource)
    await expect(form.getByRole("region", { name: "Inspected forecast", exact: true })).toContainText(source.refId)
    const target = form.getByRole("combobox", { name: "Procurement request", exact: true })
    await expect(target, "An executable Procurement operation must be authored through the public product; a missing producer cannot satisfy C12").toBeEnabled()
    const requestId = String(asRecord(requestSource.target).recordId)
    const targetOption = target.getByRole("option", { name: `${requestId} · source revision ${asRecord(requestSource.target).version}`, exact: true })
    await expect(targetOption).toHaveCount(1)
    await target.selectOption(String(requestSource.refDigest))
    await expect(target).toHaveValue(String(requestSource.refDigest))
    await form.getByRole("spinbutton", { name: "Proposed estimated amount", exact: true }).fill(String(amount))
    await form.getByLabel("Alternative title", { exact: true }).fill(title)
    await expect(form.getByRole("button", { name: "Confirm Procurement proposal", exact: true })).toHaveCount(0)
    await form.getByRole("button", { name: "Review Procurement proposal", exact: true }).click()
    const review = form.getByRole("group", { name: "Review Procurement proposal", exact: true })
    await expect(review.getByText(`${requestSource.refId} · ${amount} USD · ${draft.horizon.start} – ${draft.horizon.end}`, { exact: true })).toBeVisible()
    expect((await readCase(page, reference)).alternatives).toEqual(before.alternatives)
    const [sent, receipt] = await Promise.all([
      page.waitForRequest((request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-promote` && isCommand(request, "decision-promote")),
      clickCommand(page, review.getByRole("button", { name: "Confirm Procurement proposal", exact: true }), "decision-promote", observations),
    ])
    const scenario = { baseRef: source.refId, operations: [{ kind: "replace", targetRef: requestSource.refId, amount, currency: "USD", period: draft.horizon }], assumptions: [] }
    const next = { ...caseRef, version: caseRef.version + 1 }
    expect(sent.postDataJSON()).toEqual({ caseRef, title, coverageRef: coverage.coverageRef, scenario })
    expect(sent.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
    expect(receipt.value).toEqual({ caseRef: next, resultRef: expect.stringMatching(/^decision-result:/) })
    await expect(decision).toHaveAttribute("data-sf-case-version", String(next.version))
    const after = await readCase(page, reference)
    expect(after).toMatchObject({ ...next, choices: [], preparedChanges: [], receipts: [] })
    expect(after.alternatives).toHaveLength(before.alternatives.length + 1)
    const matches = after.alternatives.filter((item) => item.title === title)
    expect(matches).toHaveLength(1)
    const saved = matches[0]!
    expect(saved).toMatchObject({ title, version: 1, scenario, result: { comparisonStatus: "conditioned", total: null,
      costCoverage: { coverageState: "pending" } } })
    expect(saved.result.sourceRefs).toContainEqual(requestSource)
    expect(saved.result.unresolvedConditions).toEqual(expect.arrayContaining([expect.stringMatching(/^external-operation:.*:procurement-replacement-cost-unresolved$/)]))
    expect(after.alternatives.filter((item) => item.id !== saved.id)).toEqual(before.alternatives)
    observations.push({ stage: "human-typed-procurement-alternative-created", caseRef: next, title,
      source: requestSource, operation: scenario.operations, financialApproval: false, financialApplication: false })
    return { saved, resultRef: asRecord(receipt.value).resultRef }
  })
}
