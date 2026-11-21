import { expect, test, type Locator, type Page, type Request } from "@playwright/test"
import { Schema } from "effect"
import { SfDecisionsChoiceRead } from "@orchestra/schema/sucafina/decisions"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { asRecord, caseIdentity, clickCommand, draft, enterWorkbench, isCommand, observeDecisionReply, readCase, readReply, reopenCase } from "./journey"
import { loseClosureResponse } from "./closure-response"
import { changePlannerSource } from "./planner-sources"
import { knownIncreaseCriterion, type initialAlternativesJourney } from "./initial-alternatives"

type Selection = Awaited<ReturnType<typeof initialAlternativesJourney>>
const casePath = (reference: string) => `/orchestra/sf-decisions/${encodeSfRouteRef(reference)}`

/** Continue the same UI-created case; no choice, source or operation is inserted by the harness. */
export async function choiceHistoryJourney(page: Page, installation: { origin: string }, selection: Selection, observations: Record<string, unknown>[]) {
  const { origin } = installation
  const { reference, objective, sources, titles } = selection
  const identity = caseIdentity(reference)
  const caseRef = { ...identity, version: 4 }
  const chosenRef = { ...identity, version: 5 }
  const reason = "I choose the candidate under the recorded pending cost conditions. This choice does not approve any financial change."
  const writes: Request[] = []
  const capture = (request: Request) => {
    const url = new URL(request.url())
    if (url.origin !== origin || request.method() !== "POST") return
    const mode = url.searchParams.get("sf")
    if (url.pathname === "/sucafina/dashboard" && (mode === "decision-choose" || mode === "current-choice-promote") ||
      url.pathname === "/sucafina/procurement" && (mode === "decision-prepare-changes" || mode === "decision-apply")) writes.push(request)
  }
  page.on("request", capture)
  try {
    const source = await observeDecisionReply(page, (request) => request.method() === "GET" &&
      request.url() === `${origin}/sucafina/api/ui/projections/case?${new URLSearchParams({ caseRef: reference })}`,
      () => openCase(page, origin, selection))
    const projection = await readReply(source, observations)
    const before = await currentCase(page, selection, 4, "comparing")
    const principal = asRecord(projection.context).principalRef
    expect(typeof principal).toBe("string")
    expect(before.choices).toEqual([])
    expect(before.alternatives).toHaveLength(2)
    const alternatives = [titles.baseline, titles.candidate].map((title, index) => {
      const matches = before.alternatives.filter((item) => item.title === title)
      expect(matches).toHaveLength(1)
      expect(matches[0]).toMatchObject({ version: 1, result: { horizon: draft.horizon, currency: "USD", comparisonStatus: "conditioned",
        knownSubtotal: index === 0 ? 1200 : 2400, total: null } })
      const source = matches[0]!.result.sourceRefs.filter((item) => item.kind === "record" && item.refId === matches[0]!.scenario.baseRef)
      expect(source).toHaveLength(1)
      expect(source[0]).toMatchObject({ target: { surface: "planner", recordType: "planner-version", recordId: index === 0 ? sources.baseline : sources.candidate } })
      return matches[0]!
    })
    const alternative = alternatives[1]!
    expect(new Set(alternatives.map((item) => item.id)).size).toBe(2)
    const criteria = before.criteria.map((item) => item.id)

    await assertNoApplication(page, origin, selection, 4, "comparing")
    const choice = page.locator('section[aria-label="Current choice"]')
    expect(writes).toEqual([])

    await page.locator('[data-sf-surface="UI34"]').getByRole("link", { name: "Alternatives", exact: true }).click()
    await expect(page).toHaveURL((url) => url.pathname === `${casePath(reference)}/alternatives`)
    const cards = page.locator(".sf-n24-compare-card")
    for (const item of alternatives) {
      const card = cards.filter({ has: page.getByRole("heading", { name: item.title, exact: true }) })
      await expect(card).toHaveCount(1)
      await expect(card.getByText(`${item.result.knownSubtotal} USD`, { exact: true })).toBeVisible()
      await expect(card.getByText("conditioned", { exact: true })).toBeVisible()
      const select = card.getByRole("button", { name: "Select for comparison", exact: true })
      await select.click()
      await expect(select).toHaveAttribute("aria-pressed", "true")
    }

    const eligibility = page.getByRole("region", { name: "Elegibilidade de alternativas e decisão", exact: true })
    const review = eligibility.getByRole("button", { name: "Revisar elegibilidade e escolha", exact: true })
    const confirm = eligibility.getByRole("button", { name: "Confirmar escolha com CAS", exact: true })
    const justification = eligibility.getByRole("textbox", { name: "Justificativa para registrar a escolha", exact: true })
    const compare = page.getByRole("button", { name: "Compare alternatives", exact: true })
    const comparisonResult = page.getByRole("region", { name: "Comparison", exact: true })
    const compareExactPair = async () => {
      // The native comparison must return the exact ordered C10 request.
      const observed = await observeDecisionReply(page, (request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-compare` &&
        isCommand(request, "decision-compare"), () => compare.click())
      const request = observed.request()
      const reply = await readReply(observed, observations)
      expect(request.postDataJSON()).toEqual({ caseRef, baselineAlternativeId: alternatives[0]!.id,
        alternativeId: alternative.id, criteria })
      const value = asRecord(reply.value)
      const comparison = asRecord(value.comparison)
      const scenarioRefs = [comparison.baselineResultRef, comparison.alternativeResultRef]
      expect(scenarioRefs).toEqual([expect.stringMatching(/^decision-result:/), expect.stringMatching(/^decision-result:/)])
      expect(new Set(scenarioRefs).size).toBe(2)
      expect(value.request).toEqual({ scenarioRefs, criteria })
      expect(comparison).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
      await expect(comparisonResult.getByText("1200 USD", { exact: true })).toBeVisible()
      return { comparison, request: { scenarioRefs, criteria } }
    }
    const initial = await test.step("require native comparison of the exact conditioned alternatives", compareExactPair)
    expect(initial.comparison.criterionResults).toEqual(criteria.map((criterionId) => ({
      criterionId, state: "unknown", reason: "criterion-rule-unavailable",
    })))
    await justification.fill(reason)
    await expect(review).toBeDisabled()
    await expect(confirm).toHaveCount(0)
    const criterionId = await registerRule(page, origin, before, reference,
      [alternatives[0]!.id, alternative.id], initial.request.scenarioRefs, observations)
    await expect(comparisonResult).toHaveCount(0)
    await expect(review).toBeDisabled()
    const compared = await test.step("require an updated native comparison after human rule registration", compareExactPair)
    expect(compared.request).toEqual(initial.request)
    expect(compared.comparison.criterionResults).toEqual([{ criterionId, state: "unknown", reason: "criterion-metric-conditioned" }])
    await justification.fill(reason)
    await expect(review, "The exact conditioned pair needs a native human-choice review").toBeEnabled()
    await review.click()
    const reviewed = eligibility.locator(".sf-n24-review").filter({ has: page.getByRole("heading", { name: "Revisar decisão (impacta o caso)", exact: true }) })
    await expect(reviewed.getByText(`caseRef ${identity.id} · ${identity.incarnation} · v4`, { exact: true })).toBeVisible()
    await expect(reviewed.getByText(`baselineId ${alternatives[0]!.id} · v${alternatives[0]!.version}`, { exact: true })).toBeVisible()
    await expect(reviewed.getByText(`alternativeId ${alternative.id} · v${alternative.version}`, { exact: true })).toBeVisible()
    await expect(reviewed.getByText(`criteria ${criteria.join(", ")}`, { exact: true })).toBeVisible()
    await expect(reviewed.getByText(`comparison.criteria ${criteria.join(", ")}`, { exact: true })).toBeVisible()
    await expect(reviewed.getByText(`scenarioRefs ${compared.request.scenarioRefs.join(" / ")}`, { exact: true })).toBeVisible()
    await expect(reviewed.getByText(`reason ${reason}`, { exact: true })).toBeVisible()
    await expect(confirm).toBeEnabled()
    expect(writes).toEqual([])
    expect((await readCase(page, reference)).choices).toEqual([])

    // Check the pre-write UI38 state without navigating away from the reviewed comparison.
    const reader = await page.context().newPage()
    reader.on("request", capture)
    try {
      await openChoice(reader, origin, selection, 4, observations)
      const emptyChoice = reader.locator('section[aria-label="Current choice"]')
      await expect(emptyChoice.getByText("This case has no recorded choices.", { exact: true })).toBeVisible()
      await expect(emptyChoice.getByRole("button", { name: "Review current sources", exact: true })).toHaveCount(0)
    } finally {
      reader.off("request", capture)
      await reader.close()
    }
    expect(writes).toEqual([])

    await test.step("confirm one human choice, lose its response and reconcile without resubmitting", async () => {
      const interruption = await loseClosureResponse(page, origin, "dashboard", "decision-choose")
      try {
        const lost = Promise.all([interruption.completed, page.waitForEvent("requestfailed", {
          predicate: (request) => request.url() === `${origin}/sucafina/dashboard?sf=decision-choose` && request.method() === "POST",
        })])
        await confirm.click()
        const [reply, failed] = await lost
        expect(reply.httpStatus).toBe(200)
        expect(reply.contentType).toContain("application/json")
        expect(reply.body).toEqual({ status: "ok", value: { caseRef: chosenRef } })
        expect(reply.payload).toEqual({ caseRef, alternativeId: alternative.id, alternativeVersion: alternative.version,
          comparison: compared.request, criteria, reason })
        expect(writes).toEqual([failed])
        expect(failed.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
        expect(failed.postDataJSON()).toEqual(reply.payload)
        await expect(eligibility.getByRole("alert")).toContainText("Resultado incerto. Não reenviar")
        await expect(justification).toHaveValue(reason)
        await expect(justification).toBeDisabled()
        await expect(eligibility.getByRole("button")).toBeDisabled()
      } finally { await interruption.close() }
      await openCase(page, origin, selection)
      const reloaded = await currentCase(page, selection, 5, "chosen")
      expect(reloaded.choices).toHaveLength(1)
      expect(reloaded.choices[0]?.reason).toBe(reason)
      expect(writes).toHaveLength(1)
      observations.push({ stage: "human-choice-response-reconciled-by-read", caseRef: chosenRef,
        mutationRequests: 1, distinctIntentions: 1, originalMutationKey: writes[0]!.headers()["idempotency-key"], financialApproval: false, financialApplication: false })
    })
    const snapshot = await test.step("read the durable choice without treating it as financial approval", async () => {
      const current = await currentCase(page, selection, 5, "chosen")
      expect(current.choices).toHaveLength(1)
      const saved = current.choices[0]!
      expect(saved).toMatchObject({ alternativeId: alternative.id, alternativeVersion: 1, basisVersion: 1,
        principalRef: principal, reason, comparisonStatus: "conditioned" })
      expect(typeof saved.id).toBe("string")
      expect(Number.isFinite(Date.parse(saved.at))).toBe(true)
      expect(saved.criteria).toEqual(criteria)
      expect(saved.comparison).toEqual(compared.comparison)
      expect(saved.result).toMatchObject({ currency: "USD", horizon: draft.horizon, knownSubtotal: 2400, total: null, comparisonStatus: "conditioned" })
      expect(saved.costCoverage).toMatchObject({ basisVersion: 1, alternativeId: alternative.id, alternativeVersion: 1, coverageState: "pending", currency: "USD", horizon: draft.horizon })
      expect(saved.costCoverage.entries).toHaveLength(9)
      for (const entry of saved.costCoverage.entries) expect(entry.status).toBe("pending")
      expect(saved.result.unresolvedConditions.length).toBeGreaterThan(0)
      expect(saved.evidenceRefs.length).toBeGreaterThan(0)
      expect(saved.scenario.operations).toEqual([])
      expect(saved.scenario.assumptions).toEqual([])
      const options = await openChoice(page, origin, selection, 5, observations)
      expect(options.choices[0]?.id).toBe(saved.id)
      await assertHistoricalChoice(choice, saved.id, alternative.title, reason)
      await assertNoApplication(page, origin, selection, 5, "chosen")
      observations.push({ stage: "persisted-human-choice", caseRef: chosenRef, choice: saved,
        financialApproval: false, financialApplication: false, applicationBoundary: "The public Planner alternatives contain no executable Procurement operation." })
      return saved
    })
    await test.step("retain the identical historical choice after the real Planner source changes", async () => {
      await page.reload()
      expect((await currentCase(page, selection, 5, "chosen")).choices).toEqual([snapshot])
      await reopenCase(page, reference, objective)
      expect((await currentCase(page, selection, 5, "chosen")).choices).toEqual([snapshot])
      await changePlannerSource(page, origin, sources.candidate, 3600, observations)
      await openCase(page, origin, selection)
      const historical = await currentCase(page, selection, 5, "chosen")
      // Compare the complete immutable producer record, not only its title or subtotal.
      expect(historical.choices).toEqual([snapshot])
      const options = await openChoice(page, origin, selection, 5, observations)
      expect(options.choices[0]?.id).toBe(snapshot.id)
      await assertHistoricalChoice(choice, snapshot.id, alternative.title, reason)
      await assertNoApplication(page, origin, selection, 5, "chosen")
      expect(writes).toHaveLength(1)
      observations.push({ stage: "historical-choice-after-source-change", caseRef: chosenRef,
        choiceId: snapshot.id, originalChoice: snapshot, currentSourceAnnualInput: 3600, choiceUnchanged: true,
        mutationRequests: writes.length, nativeRestartProved: false, financialApplication: false })
    })
  } finally { page.off("request", capture) }
}

async function openCase(page: Page, origin: string, selection: Selection) {
  await enterWorkbench(page, origin)
  await reopenCase(page, selection.reference, selection.objective)
}

async function currentCase(page: Page, selection: Selection, version: number, state: "comparing" | "chosen") {
  await expect(page).toHaveURL((url) => url.pathname === casePath(selection.reference))
  const decision = page.locator('[data-sf-surface="UI34"]')
  await expect(decision).toHaveAttribute("data-sf-case-ref", selection.reference)
  await expect(decision).toHaveAttribute("data-sf-case-version", String(version))
  await expect(decision.getByRole("region", { name: "Question", exact: true }).getByText(selection.objective, { exact: true })).toBeVisible()
  await expect(decision.locator(".sf-n24-metadata > span")).toHaveText([
    `Current version: ${version}`, `State: ${state}`, `Period: ${draft.horizon.start} – ${draft.horizon.end}`, "USD",
  ])
  const current = await readCase(page, selection.reference)
  expect(current).toMatchObject({ ...caseIdentity(selection.reference), version, objective: selection.objective, state, horizon: draft.horizon, currency: "USD" })
  return current
}

async function openChoice(page: Page, origin: string, selection: Selection, version: number, observations: Record<string, unknown>[]) {
  const pathname = casePath(selection.reference) + "/choice"
  const observed = await observeDecisionReply(page, (request) => isCaseJsonRead(request, origin, "current-choice", selection.reference), async () => {
    await page.goto(origin + pathname)
    await expect(page).toHaveURL((url) => url.origin === origin && url.pathname === pathname)
    await expect(page.getByRole("heading", { name: "Current choice", exact: true, level: 1 }),
      "UI38 requires the installed owner to publish decisions.choice.read").toBeVisible()
  })
  const reply = await readReply(observed, observations)
  const result = Schema.decodeUnknownSync(Schema.toType(SfDecisionsChoiceRead.output), { onExcessProperty: "error" })(reply)
  if (result.status !== "ok" || !result.value.selected) throw new Error("The producer did not return the exact authorized choice scope")
  const selected = result.value.selected
  expect(selected).toMatchObject({ caseRef: { ...caseIdentity(selection.reference), version }, title: selection.objective })
  expect(selected.choices).toHaveLength(version === 4 ? 0 : 1)
  return selected
}

function isCaseJsonRead(request: Request, origin: string, mode: string, reference: string) {
  const url = new URL(request.url())
  return url.origin === origin && isCommand(request, mode, "GET") && url.searchParams.size === 3 &&
    url.searchParams.get("format") === "json" && url.searchParams.get("case") === reference
}

async function assertNoApplication(page: Page, origin: string, selection: Selection, version: number, state: "comparing" | "chosen") {
  await page.goto(origin + casePath(selection.reference) + "/changes")
  await expect(page.getByRole("heading", { name: "Prepared changes", exact: true, level: 1 })).toBeVisible()
  await expect(page.getByText("No records yet.", { exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Read producer review", exact: true })).toHaveCount(0)
  await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
  await page.goto(origin + casePath(selection.reference) + "/history")
  const ledger = page.getByRole("region", { name: "Application history", exact: true })
  await expect(ledger.getByText("No application receipt has been returned for this authorized case.", { exact: true })).toBeVisible()
  await expect(ledger.locator("[data-producer-receipt]")).toHaveCount(0)
  await openCase(page, origin, selection)
  await expect(page.locator('[data-sf-surface="UI34"]').getByText("No changes prepared.", { exact: true })).toBeVisible()
  const current = await currentCase(page, selection, version, state)
  expect(current.preparedChanges).toEqual([])
  expect(current.receipts).toEqual([])
}

async function assertHistoricalChoice(choice: Locator, id: string, title: string, reason: string) {
  const cards = choice.getByRole("article")
  await expect(cards).toHaveCount(1)
  await expect(cards).toHaveAttribute("data-choice-id", id)
  await expect(cards.getByRole("heading", { name: title, exact: true })).toBeVisible()
  const history = cards.getByRole("region", { name: "Registered result", exact: true })
  await expect(history.getByText(reason, { exact: true })).toBeVisible()
  await expect(history.getByText("Known subtotal", { exact: true })).toBeVisible()
  await expect(history.getByText("2400 USD", { exact: true })).toBeVisible()
  await expect(history.getByText("1200 USD", { exact: true })).toBeVisible()
  await expect(history.getByText("Qualified total", { exact: true })).toHaveCount(0)
  const categories = history.getByRole("list", { name: "Cost coverage", exact: true }).getByRole("listitem")
  await expect(categories).toHaveCount(9)
  await expect(categories.filter({ hasText: /· pending$/ })).toHaveCount(9)
  await expect(history).not.toContainText("3600 USD")
}

async function registerRule(page: Page, origin: string, current: Awaited<ReturnType<typeof readCase>>, reference: string,
  alternativeIds: string[], scenarioRefs: unknown[], observations: Record<string, unknown>[]) {
  // Exercise the native rule controls rather than issuing harness writes.
  const criteria = current.criteria.filter((item) => item.description === knownIncreaseCriterion)
  expect(criteria).toHaveLength(1)
  const criterionId = criteria[0]!.id
  const caseRef = { ...caseIdentity(reference), version: current.version }
  const rule = page.getByRole("group", { name: "Numeric comparison rule", exact: true })
  const criterion = rule.getByRole("combobox", { name: "Criterion for numeric comparison", exact: true })
  await criterion.selectOption(criterionId)
  const observed = await observeDecisionReply(page, (request) => isCaseJsonRead(request, origin, "decision-controls", reference),
    () => rule.getByRole("button", { name: "Load comparison rule", exact: true }).click())
  const reply = await readReply(observed, observations)
  const selected = asRecord(asRecord(reply.value).selected)
  expect(selected.caseRef).toEqual(caseRef)
  expect((selected.rules as unknown[]).map(asRecord).filter((rule) => rule.id === criterionId)).toEqual([{ id: criterionId, expectedVersion: 0 }])
  for (const [index, alternativeId] of alternativeIds.entries())
    expect((selected.scenarios as unknown[]).map(asRecord).filter((scenario) => scenario.alternativeId === alternativeId))
      .toEqual([expect.objectContaining({ ref: scenarioRefs[index] })])
  const evidence = rule.getByRole("listbox", { name: "Evidence for the numeric rule", exact: true })
  await expect(evidence).toBeEnabled()
  await expect(evidence.getByRole("option")).not.toHaveCount(0)
  const digests = await evidence.getByRole("option").evaluateAll((options) => options.map((option) => option.getAttribute("value") ?? ""))
  expect(new Set(digests).size).toBe(digests.length)
  const refs = digests.map((digest) => {
    const matching = (selected.evidence as unknown[]).map(asRecord).map((entry) => asRecord(entry.evidence)).filter((ref) => ref.refDigest === digest)
    expect(matching).toHaveLength(1)
    expect(current.alternatives.some((item) => item.result.sourceRefs.some((ref) => ref.refDigest === digest))).toBe(true)
    expect(asRecord(matching[0]!.target)).toMatchObject({ surface: "planner", recordType: "planner-version", period: draft.horizon })
    return matching[0]!
  })
  await evidence.selectOption(digests)
  await rule.getByRole("combobox", { name: "Numeric comparison condition", exact: true }).selectOption("lte")
  const limit = rule.getByRole("spinbutton", { name: "Limit for known subtotal difference in USD", exact: true })
  await expect(limit).toHaveValue("")
  await limit.fill("2000")
  const sent = page.waitForRequest((request) => new URL(request.url()).origin === origin && isCommand(request, "decision-criteria"))
  const result = await clickCommand(page, rule.getByRole("button", { name: "Save comparison rule", exact: true }), "decision-criteria", observations)
  const request = await sent
  expect(request.postDataJSON()).toEqual({ caseRef, criterionId, metricRef: "planner:known-subtotal-difference",
    operator: "lte", value: 2000, unit: "USD", period: draft.horizon, evidenceRefs: refs, expectedRuleVersion: 0 })
  expect(request.headers()["idempotency-key"]).toMatch(/^[a-f0-9-]{36}$/)
  expect(result.value).toEqual({ ruleRef: expect.stringMatching(/^criterion-rule:/), version: 1 })
  await expect(page.getByText("Comparison rule saved at revision 1. Compare again before choosing. Financial approval remains separate.", { exact: true })).toBeVisible()
  expect((await readCase(page, reference)).version).toBe(caseRef.version)
  observations.push({ stage: "human-numeric-rule-saved", caseRef, criterionId, rule: result.value,
    operator: "lte", limit: 2000, unit: "USD", evidenceRefs: refs, financialApproval: false, unknownCostsRemainPending: true })
  return criterionId
}
