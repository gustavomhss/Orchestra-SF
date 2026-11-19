import { expect, test, type Page, type Request } from "@playwright/test"
import { asRecord, caseIdentity, clickCommand, draft, enterWorkbench, isCommand, readCaseProjection, reopenCase } from "./journey"
import { loseClosureResponse } from "./closure-response"
import { changePlannerSource } from "./planner-sources"
import { registerKnownIncreaseRule } from "./comparison-rule"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"

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
  await page.getByRole("link", { name: "Compare and choose", exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-decisions/" + encodeSfRouteRef(selection.reference) + "/choice")
  const choice = page.locator("[data-sf-choice-author]")
  await expect(choice).toHaveAttribute("data-sf-case-ref", selection.reference)
  await expect(choice).toHaveAttribute("data-sf-case-version", "4")
  const before = await readCaseProjection(page, selection.reference)
  expect(before.case).toMatchObject({ ...identity, version: 4 })
  expect(before.case.choices).toEqual([])
  const originalCaseRef = { id: before.case.id, incarnation: before.case.incarnation, version: before.case.version }
  const alternative = before.case.alternatives.find((item) => item.title === selection.titles.candidate)
  expect(alternative).toBeDefined()
  await choice.locator('select[name="baseline"]').selectOption({ label: selection.titles.baseline })
  await choice.locator('select[name="alternative"]').selectOption({ label: selection.titles.candidate })
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
  const otherDashboardPosts: string[] = []
  const capture = (request: Request) => {
    if (isCommand(request, "decision-choose")) commands.push({ body: request.postData(), key: request.headers()["idempotency-key"] })
    else if (request.method() === "POST" && new URL(request.url()).pathname === "/sucafina/dashboard") otherDashboardPosts.push(new URL(request.url()).searchParams.get("sf") ?? "")
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
      expect(lost.payload).toEqual({ caseRef: originalCaseRef, alternativeId: alternative!.id, alternativeVersion: alternative!.version,
        comparison: compared.request, criteria: asRecord(compared.request).criteria, reason })
      expect(commands).toHaveLength(1)
      expect(commands[0]!.key).toMatch(/^[a-f0-9-]{36}$/)
      expect(JSON.parse(commands[0]!.body!)).toEqual(lost.payload)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toHaveValue(reason)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toBeDisabled()
      await expect(choice.getByRole("button", { name: "Retry the same choice", exact: true })).toBeEnabled()
      page.once("dialog", (dialog) => dialog.accept())
      await page.reload()
      await expect(choice).toHaveAttribute("data-sf-case-version", "5")
      const reloaded = await readCaseProjection(page, selection.reference)
      expect(reloaded.case).toMatchObject({ ...identity, version: 5 })
      expect(reloaded.case.choices).toHaveLength(1)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toHaveValue(reason)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toBeDisabled()
      await expect(choice.getByRole("button", { name: "Retry the same choice", exact: true })).toBeEnabled()
      expect(commands).toHaveLength(1)
      const reloadedAfterRetry = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.pathname === "/sucafina/api/ui/projections/case" &&
          url.searchParams.get("caseRef") === selection.reference
      })
      const reconciled = await clickCommand(page, choice.getByRole("button", { name: "Retry the same choice", exact: true }), "decision-choose", observations)
      expect((await reloadedAfterRetry).status()).toBe(200)
      await expect(choice.getByLabel("Reason for choosing", { exact: true })).toBeEnabled()
      expect(reconciled).toEqual(lost.body)
      expect(commands).toHaveLength(2)
      expect(commands[1]).toEqual(commands[0])
      observations.push({ stage: "human-choice-response-recovered", caseRef: { ...identity, version: 5 },
        mutationRequests: 2, distinctIntentions: 1, originalMutationKey: commands[0]!.key, financialApproval: false, financialApplication: false })
    })
    const snapshot = await test.step("read the durable choice without treating it as financial approval", async () => {
      const current = await currentChoice(page, selection.reference, selection.objective)
      expect(current.case).toMatchObject({ ...identity, version: 5 })
      expect(current.case.choices).toHaveLength(1)
      const saved = asRecord(current.case.choices[0])
      expect(saved).toMatchObject({ alternativeId: alternative!.id, alternativeVersion: 1, basisVersion: 1,
        principalRef: before.context.principalRef, reason, comparisonStatus: "conditioned" })
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
      expect(current.case.preparedChanges).toEqual([])
      await expect(choice.getByText("This recorded choice contains no executable operations. No changes were prepared.", { exact: true })).toBeVisible()
      expect(otherDashboardPosts).toEqual([])
      await expect(page.getByText("No changes prepared.", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
      observations.push({ stage: "persisted-human-choice", caseRef: { ...identity, version: current.case.version }, choice: saved,
        financialApproval: false, financialApplication: false, applicationBoundary: "The public Planner alternatives contain no executable Procurement operation." })
      return saved
    })
    await test.step("reopen the same choice and retain its historical values after the real Planner source changes", async () => {
      await page.reload()
      expect((await currentChoice(page, selection.reference, selection.objective)).case.choices).toEqual([snapshot])
      await reopenCase(page, selection.reference, selection.objective)
      expect((await currentChoice(page, selection.reference, selection.objective)).case.choices).toEqual([snapshot])
      await changePlannerSource(page, installation.origin, selection.sources.candidate, 3600, observations)
      await enterWorkbench(page, installation.origin)
      // reopenCase checks the exact persisted reference, objective, one native link and its opaque-ref pathname.
      await reopenCase(page, selection.reference, selection.objective)
      const historical = await currentChoice(page, selection.reference, selection.objective)
      expect(historical.case).toMatchObject({ ...identity, version: 5 })
      // Compare the complete emitted immutable record, not only its title or subtotal.
      expect(historical.case.choices).toEqual([snapshot])
      await assertHistoricalChoice(page, reason)
      expect(commands).toHaveLength(2)
      expect(otherDashboardPosts).toEqual([])
      observations.push({ stage: "historical-choice-after-source-change", caseRef: { ...identity, version: historical.case.version },
        choiceId: snapshot.id, originalChoice: snapshot, currentSourceAnnualInput: 3600, choiceUnchanged: true,
        mutationRequests: commands.length, nativeRestartProved: false, financialApplication: false })
    })
  } finally { page.off("request", capture) }
}

async function currentChoice(page: Page, reference: string, objective: string) {
  const casePath = "/orchestra/sf-decisions/" + encodeSfRouteRef(reference)
  if (new URL(page.url()).pathname === casePath)
    await page.getByRole("link", { name: "Compare and choose", exact: true }).click()
  await expect(page).toHaveURL((url) => url.pathname === casePath + "/choice")
  const choice = page.locator("[data-sf-choice-author]")
  await expect(choice).toHaveAttribute("data-sf-case-ref", reference)
  await expect(choice).toHaveAttribute("data-sf-case-version", "5")
  await expect(choice.getByText(objective, { exact: true })).toBeVisible()
  await expect(choice.locator("[data-sf-choice-case-summary]")).toHaveText(`chosen · Version 5 · ${draft.horizon.start} – ${draft.horizon.end} · USD`)
  const projection = await readCaseProjection(page, reference)
  expect(projection.case).toMatchObject({ ...caseIdentity(reference), version: 5, objective,
    state: "chosen", horizon: draft.horizon, currency: "USD" })
  return projection
}

async function assertHistoricalChoice(page: Page, reason: string) {
  const history = page.locator("[data-sf-choice-author]").getByRole("region", { name: "Recorded choices", exact: true })
  const choice = history.locator("article[data-sf-choice-id]")
  await expect(choice).toHaveCount(1)
  await expect(choice.getByText(reason, { exact: true })).toBeVisible()
  await expect(choice.locator("dt").filter({ hasText: /^Historical known subtotal$/ }).locator("+ dd")).toHaveText("2400 USD")
  await expect(choice.locator("dt").filter({ hasText: /^Known difference$/ }).locator("+ dd")).toHaveText("1200")
  await expect(choice.locator("dt").filter({ hasText: /^Complete total$/ }).locator("+ dd")).toHaveText("Unavailable")
  await expect(choice.locator("dt").filter({ hasText: /^Complete difference$/ }).locator("+ dd")).toHaveText("Unavailable")
  await expect(choice.getByRole("list", { name: "Cost coverage categories", exact: true }).getByRole("listitem")).toHaveCount(9)
  await expect(choice.locator("dt").filter({ hasText: /^Historical known subtotal$/ }).locator("+ dd")).not.toContainText("3600")
}
