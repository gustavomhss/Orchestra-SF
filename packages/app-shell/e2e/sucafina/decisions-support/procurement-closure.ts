import { expect, test, type Page } from "@playwright/test"
import { asRecord, caseIdentity, clickCommand, draft, isCommand, readReply, reopenCase } from "./journey"
import { initialAlternativesJourney } from "./initial-alternatives"
import { sourceNames } from "./planner-sources"
import { registerKnownIncreaseRule } from "./comparison-rule"
import { approveExactRequisition, createRequisition, openRequisition } from "./procurement-source"
import { applyRecoveryJourney } from "./apply-recovery"

/** Nominal selection: every unmet public producer is a failure at its first required action. */
export async function procurementClosureJourney(page: Page, installation: { origin: string; actorId: string }, observations: Record<string, unknown>[]) {
  const requestId = await test.step("create the real requisition through its human form", () => createRequisition(page, installation.origin, observations))
  const selection = await initialAlternativesJourney(page, installation, observations)
  await reopenCase(page, selection.reference, selection.objective)
  const source = await attachRequisition(page, selection.reference, requestId, observations)
  const titles = { baseline: "Requisition proposal for 120 USD", candidate: "Requisition proposal for 140 USD" }
  await typedAlternative(page, selection.sources.baseline, sourceNames.baseline, source, titles.baseline, 120, observations)
  await typedAlternative(page, selection.sources.candidate, sourceNames.candidate, source, titles.candidate, 140, observations)
  const choiceId = await test.step("compare the two typed proposals and record a human choice without approving spending", async () => {
    const form = page.locator("form[data-decision-choice]")
    await expect(form).toHaveAttribute("data-sf-choice-ready", "true")
    const before = asRecord(JSON.parse((await form.getAttribute("data-context"))!))
    expect(before.choices).toEqual([])
    expect(before.alternatives).toHaveLength(4)
    await form.getByLabel("Baseline", { exact: true }).selectOption({ label: titles.baseline })
    await form.getByLabel("Alternative", { exact: true }).selectOption({ label: titles.candidate })
    await clickCommand(page, form.getByRole("button", { name: "Compare", exact: true }), "decision-compare", observations)
    await registerKnownIncreaseRule(page, observations)
    const compared = asRecord((await clickCommand(page, form.getByRole("button", { name: "Compare", exact: true }), "decision-compare", observations)).value)
    expect(asRecord(compared.comparison)).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
    const reason = "I choose the 140 USD proposal under its unresolved external cost conditions. Financial approval is still required before Apply."
    await form.getByLabel("Reason for choosing", { exact: true }).fill(reason)
    const sent = page.waitForRequest((request) => isCommand(request, "decision-choose"))
    const loaded = page.waitForEvent("domcontentloaded")
    const receipt = await clickCommand(page, form.getByRole("button", { name: "Record choice", exact: true }), "decision-choose", observations)
    const payload = asRecord((await sent).postDataJSON())
    expect(payload).toMatchObject({ caseRef: before.caseRef, comparison: compared.request, criteria: asRecord(compared.request).criteria, reason })
    expect(asRecord(receipt.value).caseRef).toEqual({ ...asRecord(before.caseRef), version: Number(asRecord(before.caseRef).version) + 1 })
    await loaded
    await expect(form).toHaveAttribute("data-sf-choice-ready", "true")
    const current = asRecord(JSON.parse((await form.getAttribute("data-context"))!))
    expect(current.choices).toHaveLength(1)
    const saved = asRecord((current.choices as unknown[])[0])
    expect(saved).toMatchObject({ alternativeId: payload.alternativeId, alternativeVersion: 1, reason,
      principalRef: installation.actorId, comparisonStatus: "conditioned", comparison: compared.comparison })
    expect(asRecord(saved.scenario).operations).toEqual([{ kind: "replace", targetRef: source.refId, amount: 140, currency: "USD", period: draft.horizon }])
    expect(asRecord(saved.result)).toMatchObject({ knownSubtotal: 2400, total: null, comparisonStatus: "conditioned" })
    expect((asRecord(saved.result).unresolvedConditions as string[]).some((condition) => condition.startsWith("external-operation:"))).toBe(true)
    expect((asRecord(saved.result).sourceRefs as unknown[]).map(asRecord)).toContainEqual(source)
    observations.push({ stage: "human-procurement-choice-recorded", caseRef: current.caseRef, choice: saved,
      financialApproval: false, financialApplication: false, externalCostRemainsUnresolved: true })
    return String(saved.id)
  })
  const audit = await page.context().newPage()
  try {
    const original = await openRequisition(audit, installation.origin, requestId)
    const form = original.locator(`section[id="${requestId}-pr"] form[data-command="save"]`)
    await expect(form).toHaveAttribute("data-version", "1")
    await expect(form.getByLabel("Estimated amount", { exact: true })).toHaveValue("100")
    await expect(original.locator("[data-request-summary]")).toContainText("Requisition draft")
  } finally { await audit.close() }
  // Published C12 is consumed here; no Apply is sent until its current preview and
  // a real, compatible domain approval both succeed. Missing stages never pass.
  await applyRecoveryJourney(page, installation.origin, { ...selection, choiceId }, observations,
    (approvalPage, review, operation) => approveExactRequisition(approvalPage, installation.origin, review, operation, observations))
}

async function attachRequisition(page: Page, reference: string, requestId: string, observations: Record<string, unknown>[]) {
  return test.step("inspect the authorized Procurement evidence and attach it to the human case", async () => {
    await page.getByText("Edit decision", { exact: true }).click()
    const editor = page.locator("form[data-decision-edit]")
    await expect(editor).toHaveAttribute("data-sf-edit-ready", "true")
    const before = asRecord(JSON.parse((await editor.getAttribute("data-context"))!))
    expect(before.caseRef).toEqual({ ...caseIdentity(reference), version: 4 })
    const discovered = page.waitForResponse((response) => isCommand(response.request(), "decision-controls", "GET"))
    await editor.getByRole("button", { name: "Find Procurement sources", exact: true }).click()
    const controls = asRecord((await readReply(await discovered, observations)).value)
    const selected = asRecord(controls.selected)
    expect(selected.caseRef).toEqual(before.caseRef)
    const entries = (asRecord(selected.procurementEvidence).sources as unknown[]).map(asRecord)
      .filter((entry) => asRecord(asRecord(entry.source).target).recordId === requestId)
    expect(entries).toHaveLength(1)
    const observed = asRecord(entries[0]!.source)
    expect(observed.refId, "A temporary BI06 approval-row reference is not durable Procurement evidence").toMatch(/^sf-procurement:[^:]+:[1-9]\d*$/)
    const source = editor.getByLabel("Procurement source", { exact: true })
    await expect(source).toBeEnabled()
    const option = source.getByRole("option", { name: new RegExp(`^${requestId} · revision [1-9]\\d*$`) })
    await expect(option).toHaveCount(1)
    await source.selectOption({ label: (await option.textContent())!.trim() })
    const digest = await source.inputValue()
    expect(digest).toBe(observed.refDigest)
    const inspected = page.waitForResponse((response) => isCommand(response.request(), "decision-controls", "GET"))
    await editor.getByRole("button", { name: "Inspect selected procurement source", exact: true }).click()
    const current = asRecord((await readReply(await inspected, observations)).value)
    const currentEntries = (asRecord(asRecord(current.selected).procurementEvidence).sources as unknown[]).map(asRecord)
      .filter((entry) => asRecord(entry.source).refDigest === digest)
    expect(currentEntries).toHaveLength(1)
    expect(currentEntries[0]!.source).toEqual(observed)
    await expect(editor.locator("[data-procurement-preview]")).toHaveAttribute("data-state", "ready")
    await expect(editor.locator("[data-procurement-preview]")).toContainText(requestId)
    await expect(editor.locator("[data-procurement-preview]")).toContainText("USD")
    await editor.getByRole("button", { name: "Attach procurement source to draft", exact: true }).click()
    await expect(editor.locator("[data-decision-sources] > li")).toHaveCount(3)
    const sent = page.waitForRequest((request) => isCommand(request, "decision-edit"))
    const loaded = page.waitForEvent("domcontentloaded")
    const receipt = await clickCommand(page, editor.getByRole("button", { name: "Save decision", exact: true }), "decision-edit", observations)
    const request = asRecord((await sent).postDataJSON())
    const refs = (request.sourceRefs as unknown[]).map(asRecord)
    const added = refs.filter((ref) => ref.refDigest === digest)
    expect(added).toHaveLength(1)
    expect(added[0]).toEqual(observed)
    expect(added[0]!).toMatchObject({ kind: "record", evidenceLevel: "observed", target: { surface: "procurement", recordType: "procurement-request", recordId: requestId, period: draft.horizon } })
    expect(refs).toHaveLength(3)
    expect(refs).toEqual(expect.arrayContaining(before.sourceRefs as unknown[]))
    expect(asRecord(receipt.value).caseRef).toEqual({ ...caseIdentity(reference), version: 5 })
    await loaded
    await expect(editor).toHaveAttribute("data-sf-edit-ready", "true")
    expect(asRecord(JSON.parse((await editor.getAttribute("data-context"))!)).sourceRefs).toEqual(refs)
    observations.push({ stage: "authorized-procurement-source-attached", caseRef: asRecord(receipt.value).caseRef, source: added[0] })
    return added[0]!
  })
}

async function typedAlternative(page: Page, versionId: string, sourceName: string, requestSource: Record<string, unknown>, title: string, amount: number, observations: Record<string, unknown>[]) {
  return test.step(`create the typed Procurement alternative for ${amount} USD through public controls`, async () => {
    const form = page.locator("form[data-decision-alternatives]")
    await expect(form).toHaveAttribute("data-sf-alternatives-ready", "true")
    const before = asRecord(JSON.parse((await page.locator("form[data-decision-edit]").getAttribute("data-context"))!))
    await form.getByRole("button", { name: "Load attached scenarios", exact: true }).click()
    const planner = form.getByLabel("Source for alternative", { exact: true })
    const option = planner.getByRole("option", { name: new RegExp(sourceName) })
    await expect(option).toHaveCount(1)
    await planner.selectOption({ label: (await option.textContent())!.trim() })
    const digest = await planner.inputValue()
    const refs = (before.sourceRefs as unknown[]).map(asRecord).filter((ref) => ref.refDigest === digest)
    expect(refs).toHaveLength(1)
    expect(asRecord(refs[0]!.target)).toMatchObject({ surface: "planner", recordType: "planner-version", recordId: versionId })
    await form.getByRole("button", { name: "Inspect scenario", exact: true }).click()
    await expect(form.locator("[data-alternative-preview]")).toHaveAttribute("data-state", "ready")
    await expect(form.getByRole("button", { name: "Create alternative", exact: true }), "The existing canonical coverage must reopen, without an invented inventory").toBeEnabled()
    observations.push({ stage: "typed-procurement-producer-required", caseRef: before.caseRef, requestId: asRecord(requestSource.target).recordId,
      requiredControls: ["Procurement request", "Proposed estimated amount"], amount,
      dependency: "Owner23 must publish human authoring of an evidenced typed Procurement operation and its authorized composite scenario producer. The current initial-alternatives UI emits operations=[]." })
    const target = form.getByLabel("Procurement request", { exact: true })
    await expect(target, "An executable Procurement operation must be authored through the public product; a missing producer cannot satisfy C12").toBeEnabled()
    const requestId = String(asRecord(requestSource.target).recordId)
    const targetOption = target.getByRole("option", { name: new RegExp(`^${requestId}(?: ·|$)`) })
    await expect(targetOption).toHaveCount(1)
    await target.selectOption({ label: (await targetOption.textContent())!.trim() })
    await form.getByLabel("Proposed estimated amount", { exact: true }).fill(String(amount))
    await form.getByLabel("Alternative title", { exact: true }).fill(title)
    const sent = page.waitForRequest((request) => isCommand(request, "decision-promote"))
    const loaded = page.waitForEvent("domcontentloaded")
    const receipt = await clickCommand(page, form.getByRole("button", { name: "Create alternative", exact: true }), "decision-promote", observations)
    const payload = asRecord((await sent).postDataJSON())
    expect(payload).toEqual({ caseRef: before.caseRef, title, coverageRef: expect.any(String), scenario: { baseRef: refs[0]!.refId,
      operations: [{ kind: "replace", targetRef: requestSource.refId, amount, currency: "USD", period: draft.horizon }], assumptions: [] } })
    expect(asRecord(receipt.value)).toEqual({ caseRef: { ...asRecord(before.caseRef), version: Number(asRecord(before.caseRef).version) + 1 }, resultRef: expect.stringMatching(/^decision-result:/) })
    await loaded
    await expect(page.getByRole("heading", { name: title, exact: true })).toBeVisible()
    observations.push({ stage: "human-typed-procurement-alternative-created", caseRef: asRecord(receipt.value).caseRef, title,
      source: requestSource, operation: asRecord(payload.scenario).operations, financialApproval: false, financialApplication: false })
  })
}
