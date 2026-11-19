import { expect, test, type Page } from "@playwright/test"
import { asRecord, clickCommand, draft, isCommand, readCase, readReply } from "./journey"
import { knownIncreaseCriterion } from "./initial-alternatives"

/** The human supplies a real numeric criterion; this never converts unknown costs to zero. */
export async function registerKnownIncreaseRule(page: Page, observations: Record<string, unknown>[]) {
  return test.step("register the explicit limit for the known subtotal increase using current comparison evidence", async () => {
    const form = page.locator("[data-sf-choice-author]")
    const reference = await form.getAttribute("data-sf-case-ref")
    expect(reference).toBeTruthy()
    if (!reference) throw new Error("The native choice did not expose its original case reference")
    const original = await readCase(page, reference)
    const caseRef = { id: original.id, incarnation: original.incarnation, version: original.version }
    const criteria = original.criteria.filter((criterion) => criterion.description === knownIncreaseCriterion)
    expect(criteria).toHaveLength(1)
    const criterionId = String(criteria[0]!.id)
    await expect(form.getByRole("group", { name: "Numeric comparison rule", exact: true })).toBeVisible()
    await form.getByLabel("Criterion for numeric comparison", { exact: true }).selectOption(criterionId)
    const loaded = page.waitForResponse((response) => isCommand(response.request(), "decision-controls", "GET"))
    await form.getByRole("button", { name: "Load comparison rule", exact: true }).click()
    const controls = asRecord((await readReply(await loaded, observations)).value)
    const selected = asRecord(controls.selected)
    expect(selected.caseRef).toEqual(caseRef)
    const rules = (selected.rules as unknown[]).map(asRecord).filter((rule) => rule.id === criterionId)
    expect(rules).toHaveLength(1)
    expect(rules[0]!.expectedVersion).toBe(0)
    const evidence = form.getByLabel("Evidence for the numeric rule", { exact: true })
    await expect(evidence).toBeEnabled()
    await expect(evidence.getByRole("option")).not.toHaveCount(0)
    const digests = await evidence.getByRole("option").evaluateAll((options) => options.map((option) => option.getAttribute("value") ?? ""))
    expect(new Set(digests).size).toBe(digests.length)
    const selectedIds = [await form.locator('select[name="baseline"]').inputValue(), await form.locator('select[name="alternative"]').inputValue()]
    const comparedAlternatives = (asRecord(selected.decision).alternatives as unknown[]).map(asRecord).filter((alternative) => selectedIds.includes(String(alternative.id)))
    expect(comparedAlternatives).toHaveLength(2)
    const comparedRefs = comparedAlternatives.flatMap((alternative) => asRecord(alternative.result).sourceRefs as unknown[]).map(asRecord)
    const authorized = (selected.evidence as unknown[]).map(asRecord).map((entry) => asRecord(entry.evidence))
    const refs = digests.map((digest) => {
      const matching = authorized.filter((ref) => ref.refDigest === digest)
      expect(matching).toHaveLength(1)
      expect(comparedRefs.some((ref) => ref.refDigest === digest)).toBe(true)
      expect(asRecord(matching[0]!.target)).toMatchObject({ surface: "planner", recordType: "planner-version", period: draft.horizon })
      return matching[0]!
    })
    await evidence.selectOption(digests)
    await form.getByLabel("Numeric comparison condition", { exact: true }).selectOption("lte")
    const limit = form.getByLabel("Limit for known subtotal difference in USD", { exact: true })
    await expect(limit).toHaveValue("")
    await limit.fill("2000")
    const sent = page.waitForRequest((request) => isCommand(request, "decision-criteria"))
    const result = await clickCommand(page, form.getByRole("button", { name: "Save comparison rule", exact: true }), "decision-criteria", observations)
    const request = await sent
    expect(request.postDataJSON()).toEqual({ caseRef, criterionId, metricRef: "planner:known-subtotal-difference",
      operator: "lte", value: 2000, unit: "USD", period: draft.horizon, evidenceRefs: refs, expectedRuleVersion: 0 })
    expect(request.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
    const receipt = asRecord(result.value)
    expect(receipt).toEqual({ ruleRef: expect.stringMatching(/^criterion-rule:/), version: 1 })
    await expect(form.getByRole("status")).toHaveText("Comparison rule saved. Compare the selected alternatives again before choosing. Financial approval remains separate.")
    await expect(form.locator("[data-sf-rule-version]")).toHaveAttribute("data-sf-rule-version", "1")
    await expect(form.locator("[data-sf-rule-version]")).toHaveText("Current rule revision: 1")
    await expect(form.getByRole("button", { name: "Record choice", exact: true })).toBeDisabled()
    const after = await readCase(page, reference)
    expect({ id: after.id, incarnation: after.incarnation, version: after.version }).toEqual(caseRef)
    observations.push({ stage: "human-numeric-rule-saved", caseRef, criterionId, ruleRef: receipt.ruleRef,
      ruleVersion: 1, operator: "lte", limit: 2000, unit: "USD", metricRef: "planner:known-subtotal-difference",
      evidenceRefs: refs, financialApproval: false, unknownCostsRemainPending: true })
    return { criterionId, ruleRef: receipt.ruleRef }
  })
}
