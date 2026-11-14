import { expect, test, type Page } from "@playwright/test"
import { asRecord, clickCommand, draft, isCommand, readReply } from "./journey"
import { knownIncreaseCriterion } from "./initial-alternatives"

/** The human supplies a real numeric criterion; this never converts unknown costs to zero. */
export async function registerKnownIncreaseRule(page: Page, observations: Record<string, unknown>[]) {
  return test.step("register the explicit limit for the known subtotal increase using current comparison evidence", async () => {
    const form = page.locator("form[data-decision-choice]")
    const context = asRecord(JSON.parse((await form.getAttribute("data-context"))!))
    const criteria = (context.criteria as unknown[]).map(asRecord).filter((criterion) => criterion.description === knownIncreaseCriterion)
    expect(criteria).toHaveLength(1)
    const criterionId = String(criteria[0]!.id)
    await expect(form.locator("[data-numeric-rule]")).toBeVisible()
    await form.locator("[data-numeric-criterion]").selectOption(criterionId)
    const loaded = page.waitForResponse((response) => isCommand(response.request(), "decision-controls", "GET"))
    await form.getByRole("button", { name: "Load comparison rule", exact: true }).click()
    const controls = asRecord((await readReply(await loaded, observations)).value)
    const selected = asRecord(controls.selected)
    expect(selected.caseRef).toEqual(context.caseRef)
    const rules = (selected.rules as unknown[]).map(asRecord).filter((rule) => rule.id === criterionId)
    expect(rules).toHaveLength(1)
    expect(rules[0]!.expectedVersion).toBe(0)
    const evidence = form.locator("[data-numeric-evidence]")
    await expect(evidence).toBeEnabled()
    await expect(evidence.getByRole("option")).not.toHaveCount(0)
    const digests = await evidence.getByRole("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    expect(new Set(digests).size).toBe(digests.length)
    const selectedIds = [await form.getByLabel("Baseline", { exact: true }).inputValue(), await form.getByLabel("Alternative", { exact: true }).inputValue()]
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
    await form.locator("[data-numeric-operator]").selectOption("lte")
    await expect(form.locator("[data-numeric-value]")).toHaveValue("")
    await form.locator("[data-numeric-value]").fill("2000")
    const sent = page.waitForRequest((request) => isCommand(request, "decision-criteria"))
    const result = await clickCommand(page, form.getByRole("button", { name: "Save comparison rule", exact: true }), "decision-criteria", observations)
    const request = await sent
    expect(request.postDataJSON()).toEqual({ caseRef: context.caseRef, criterionId, metricRef: "planner:known-subtotal-difference",
      operator: "lte", value: 2000, unit: "USD", period: draft.horizon, evidenceRefs: refs, expectedRuleVersion: 0 })
    expect(request.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
    const receipt = asRecord(result.value)
    expect(receipt).toEqual({ ruleRef: expect.stringMatching(/^criterion-rule:/), version: 1 })
    await expect(form.locator("[data-numeric-status]")).toHaveText("Comparison rule saved at revision 1. Compare again before choosing. Financial approval remains separate.")
    await expect(form.getByRole("button", { name: "Record choice", exact: true })).toBeDisabled()
    expect(asRecord(JSON.parse((await form.getAttribute("data-context"))!)).caseRef).toEqual(context.caseRef)
    observations.push({ stage: "human-numeric-rule-saved", caseRef: context.caseRef, criterionId, ruleRef: receipt.ruleRef,
      ruleVersion: 1, operator: "lte", limit: 2000, unit: "USD", metricRef: "planner:known-subtotal-difference",
      evidenceRefs: refs, financialApproval: false, unknownCostsRemainPending: true })
    return { criterionId, ruleRef: receipt.ruleRef }
  })
}
