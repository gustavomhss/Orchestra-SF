import { expect, test, type Page, type Request } from "@playwright/test"
import { asRecord, caseIdentity, clickCommand, draft, enterWorkbench, isCommand, reopenCase } from "./journey"
import { loseClosureResponse } from "./closure-response"
import { changePlannerSource } from "./planner-sources"
import { registerKnownIncreaseRule } from "./comparison-rule"

type Selection = {
  reference: string
  objective: string
  sources: { baseline: string; candidate: string }
  titles: { baseline: string; candidate: string }
}

/** Continue the same UI-created case; no choice, source or operation is inserted by the harness. */
export async function choiceHistoryJourney(page: Page, installation: { origin: string }, selection: Selection, observations: Record<string, unknown>[]) {
  const identity = caseIdentity(selection.reference)
  const reason = "I choose the candidate under the recorded pending cost conditions. This choice does not approve any financial change."
  await reopenCase(page, selection.reference, selection.objective)
  const choice = page.locator("form[data-decision-choice]")
  await expect(choice).toHaveAttribute("data-sf-choice-ready", "true")
  const before = asRecord(JSON.parse((await choice.getAttribute("data-context"))!))
  expect(before.caseRef).toEqual({ ...identity, version: 4 })
  expect(before.choices).toEqual([])
  const alternative = (before.alternatives as unknown[]).map(asRecord).find((item) => item.title === selection.titles.candidate)
  expect(alternative).toBeDefined()
  await choice.getByLabel("Baseline", { exact: true }).selectOption({ label: selection.titles.baseline })
  await choice.getByLabel("Alternative", { exact: true }).selectOption({ label: selection.titles.candidate })
  const initial = asRecord((await clickCommand(page, choice.getByRole("button", { name: "Compare", exact: true }), "decision-compare", observations)).value)
  expect(asRecord(initial.comparison)).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
  await expect(choice.getByRole("button", { name: "Record choice", exact: true })).toBeDisabled()
  const rule = await registerKnownIncreaseRule(page, observations)
  const compared = asRecord((await clickCommand(page, choice.getByRole("button", { name: "Compare", exact: true }), "decision-compare", observations)).value)
  expect(asRecord(compared.comparison)).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
  expect(asRecord(compared.comparison).criterionResults).toEqual([{ criterionId: rule.criterionId, state: "unknown", reason: "criterion-metric-conditioned" }])
  await choice.getByLabel("Reason for choosing", { exact: true }).fill(reason)
  await expect(choice.getByRole("button", { name: "Record choice", exact: true })).toBeEnabled()
  const commands: { body: string | null; key: string | undefined }[] = []
  const capture = (request: Request) => {
    if (isCommand(request, "decision-choose")) commands.push({ body: request.postData(), key: request.headers()["idempotency-key"] })
  }
  page.on("request", capture)
  try {
    await test.step("record a human choice, lose its response, then explicitly retry the exact retained intent after reload", async () => {
      const interruption = await loseClosureResponse(page, installation.origin, "dashboard", "decision-choose")
      const lost = await (async () => {
        try {
          const failed = page.waitForEvent("requestfailed", { predicate: (request) => isCommand(request, "decision-choose") })
          const observed = Promise.all([interruption.completed, failed])
          await choice.getByRole("button", { name: "Record choice", exact: true }).click()
          return (await observed)[0]
        } finally { await interruption.close() }
      })()
      expect(lost.httpStatus).toBe(200)
      expect(lost.contentType).toContain("application/json")
      expect(lost.body).toEqual({ status: "ok", value: { caseRef: { ...identity, version: 5 } } })
      expect(lost.payload).toEqual({ caseRef: before.caseRef, alternativeId: alternative!.id, alternativeVersion: alternative!.version,
        comparison: compared.request, criteria: asRecord(compared.request).criteria, reason })
      expect(commands).toHaveLength(1)
      expect(commands[0]!.key).toMatch(/^[a-f0-9-]{36}$/)
      expect(JSON.parse(commands[0]!.body!)).toEqual(lost.payload)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toHaveValue(reason)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toBeDisabled()
      await expect(choice.getByRole("button", { name: "Retry the same choice", exact: true })).toBeEnabled()
      page.once("dialog", (dialog) => dialog.accept())
      await page.reload()
      await expect(choice).toHaveAttribute("data-sf-choice-ready", "true")
      const reloaded = asRecord(JSON.parse((await choice.getAttribute("data-context"))!))
      expect(reloaded.caseRef).toEqual({ ...identity, version: 5 })
      expect(reloaded.choices).toHaveLength(1)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toHaveValue(reason)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toBeDisabled()
      await expect(choice.getByRole("button", { name: "Retry the same choice", exact: true })).toBeEnabled()
      expect(commands).toHaveLength(1)
      const reloadedAfterRetry = page.waitForEvent("domcontentloaded")
      const reconciled = await clickCommand(page, choice.getByRole("button", { name: "Retry the same choice", exact: true }), "decision-choose", observations)
      await reloadedAfterRetry
      expect(reconciled).toEqual(lost.body)
      expect(commands).toHaveLength(2)
      expect(commands[1]).toEqual(commands[0])
      observations.push({ stage: "human-choice-response-recovered", caseRef: { ...identity, version: 5 },
        mutationRequests: 2, distinctIntentions: 1, originalMutationKey: commands[0]!.key, financialApproval: false, financialApplication: false })
    })
    const snapshot = await test.step("read the durable choice without treating it as financial approval", async () => {
      const current = await currentChoice(page, selection.reference, selection.objective)
      expect(current.caseRef).toEqual({ ...identity, version: 5 })
      expect(current.choices).toHaveLength(1)
      const saved = asRecord((current.choices as unknown[])[0])
      expect(saved).toMatchObject({ alternativeId: alternative!.id, alternativeVersion: 1, basisVersion: 1,
        principalRef: asRecord(before.authority).principalRef, reason, comparisonStatus: "conditioned" })
      expect(typeof saved.id).toBe("string")
      expect(Number.isFinite(Date.parse(String(saved.at)))).toBe(true)
      expect(saved.criteria).toEqual(asRecord(compared.request).criteria)
      expect(saved.comparison).toEqual(compared.comparison)
      expect(asRecord(saved.result)).toMatchObject({ currency: "USD", horizon: draft.horizon, knownSubtotal: 2400, total: null, comparisonStatus: "conditioned" })
      expect(asRecord(saved.costCoverage)).toMatchObject({ basisVersion: 1, alternativeId: alternative!.id, alternativeVersion: 1, coverageState: "pending", currency: "USD", horizon: draft.horizon })
      expect(asRecord(saved.costCoverage).entries).toHaveLength(9)
      for (const entry of (asRecord(saved.costCoverage).entries as unknown[]).map(asRecord)) expect(entry.status).toBe("pending")
      expect((asRecord(saved.result).unresolvedConditions as unknown[]).length).toBeGreaterThan(0)
      expect((saved.evidenceRefs as unknown[]).length).toBeGreaterThan(0)
      expect(asRecord(saved.scenario).operations).toEqual([])
      expect(asRecord(saved.scenario).assumptions).toEqual([])
      await assertHistoricalChoice(page, reason)
      const prepare = page.locator("[data-decision-prepare]")
      await expect(prepare.getByRole("button", { name: "Prepare changes from this choice", exact: true })).toBeDisabled()
      await expect(prepare.locator("[data-choice-prepare-status]")).toHaveText("This recorded choice contains no executable operations. No changes were prepared.")
      await expect(page.getByText("No changes prepared.", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
      observations.push({ stage: "persisted-human-choice", caseRef: current.caseRef, choice: saved,
        financialApproval: false, financialApplication: false, applicationBoundary: "The public Planner alternatives contain no executable Procurement operation." })
      return saved
    })
    await test.step("reopen the same choice and retain its historical values after the real Planner source changes", async () => {
      await page.reload()
      expect((await currentChoice(page, selection.reference, selection.objective)).choices).toEqual([snapshot])
      await reopenCase(page, selection.reference, selection.objective)
      expect((await currentChoice(page, selection.reference, selection.objective)).choices).toEqual([snapshot])
      await changePlannerSource(page, installation.origin, selection.sources.candidate, 3600, observations)
      await enterWorkbench(page, installation.origin)
      const link = page.getByRole("link", { name: selection.objective, exact: true })
      await expect(link).toHaveCount(1)
      expect(new URL((await link.getAttribute("href"))!, page.url()).searchParams.get("caseRef")).toBe(selection.reference)
      await link.click()
      const historical = await currentChoice(page, selection.reference, selection.objective)
      expect(historical.caseRef).toEqual({ ...identity, version: 5 })
      // Compare the complete emitted immutable record, not only its title or subtotal.
      expect(historical.choices).toEqual([snapshot])
      await assertHistoricalChoice(page, reason)
      expect(commands).toHaveLength(2)
      observations.push({ stage: "historical-choice-after-source-change", caseRef: historical.caseRef,
        choiceId: snapshot.id, originalChoice: snapshot, currentSourceAnnualInput: 3600, choiceUnchanged: true,
        mutationRequests: commands.length, nativeRestartProved: false, financialApplication: false })
    })
  } finally { page.off("request", capture) }
}

async function currentChoice(page: Page, reference: string, objective: string) {
  await expect(page).toHaveURL((url) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === "workbench-case" && url.searchParams.get("caseRef") === reference)
  const decision = page.getByRole("region", { name: "Decision", exact: true })
  await expect(decision.getByRole("heading", { name: objective, exact: true })).toBeVisible()
  await expect(decision.locator("header > p")).toHaveText(`chosen · Version 5 · ${draft.horizon.start} – ${draft.horizon.end} · USD`)
  const form = page.locator("form[data-decision-choice]")
  await expect(form).toHaveAttribute("data-sf-choice-ready", "true")
  return asRecord(JSON.parse((await form.getAttribute("data-context"))!))
}

async function assertHistoricalChoice(page: Page, reason: string) {
  const decision = page.getByRole("region", { name: "Decision", exact: true })
  const history = decision.locator(":scope > details").filter({ has: page.getByText("History and sources", { exact: true }) })
  await expect(history).toHaveCount(1)
  if (!(await history.getAttribute("open") === "")) await history.getByText("History and sources", { exact: true }).click()
  const choice = history.locator(":scope > article")
  await expect(choice).toHaveCount(1)
  await expect(choice.getByText(reason, { exact: true })).toBeVisible()
  await expect(choice.getByText("Known subtotal: 2400 USD", { exact: true })).toBeVisible()
  await expect(choice.getByText("Known difference: 1200 USD", { exact: true })).toBeVisible()
  await expect(choice.getByText(/^Total:/)).toHaveCount(0)
  await expect(choice.getByText(/^Difference:/)).toHaveCount(0)
  await expect(choice.getByRole("list", { name: "Pending cost categories", exact: true }).getByRole("listitem")).toHaveCount(9)
  await expect(choice).not.toContainText("Known subtotal: 3600")
}
