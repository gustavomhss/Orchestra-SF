import { expect, test, type Locator, type Page, type Request } from "@playwright/test"
import { asRecord, caseIdentity, clickCommand, draft, enterWorkbench, fillDecision, isCommand, reopenCase } from "./journey"
import { createPlannerSources, sourceNames } from "./planner-sources"
import { loseAlternativeResponse } from "./alternative-response"

const titles = { baseline: "Keep the baseline service", candidate: "Consider the candidate service" }
const pendingReason = "Cost categories still need evidence; a known service amount does not establish complete coverage."

export async function initialAlternativesJourney(page: Page, installation: { origin: string; actorId: string }, observations: Record<string, unknown>[]) {
  const sources = await test.step("create two actual Planner versions through human controls", () => createPlannerSources(page, installation.origin, installation.actorId, observations))
  await enterWorkbench(page, installation.origin)
  const objective = `${draft.objective} — initial alternatives`
  const form = await fillDecision(page, objective)
  const created = await clickCommand(page, form.getByRole("button", { name: "Create decision", exact: true }), "workbench-command", observations)
  expect(typeof created.outputRef).toBe("string")
  const reference = created.outputRef as string
  const identity = caseIdentity(reference)
  await currentCase(page, reference, objective, 1, "draft")

  await test.step("discover and inspect authorized sources before attaching them to the saved case", async () => {
    await page.getByText("Edit decision", { exact: true }).click()
    const editor = page.locator("form[data-decision-edit]")
    await expect(editor).toHaveAttribute("data-sf-edit-ready", "true")
    await editor.getByRole("button", { name: "Find Planner sources", exact: true }).click()
    const select = editor.getByLabel("Planner source", { exact: true })
    for (const entry of [{ name: sourceNames.baseline, id: sources.baseline, monthlyAmount: 100, count: 1 }, { name: sourceNames.candidate, id: sources.candidate, monthlyAmount: 200, count: 2 }]) {
      await selectSource(select, entry.name, entry.id)
      await editor.getByRole("button", { name: "Inspect selected source", exact: true }).click()
      const preview = editor.locator("[data-source-preview]")
      await expect(preview).toHaveAttribute("data-state", "ready")
      await expect(preview).toContainText("USD")
      await expect(preview).toContainText("2027-01-01")
      await expect(preview).toContainText("2027-12-31")
      await expect(preview).toContainText(`Component: ${entry.monthlyAmount} USD · 2027-01-01 – 2027-01-31`)
      await editor.getByRole("button", { name: "Attach source to draft", exact: true }).click()
      await expect(editor.locator("[data-decision-sources] > li")).toHaveCount(entry.count)
    }
    const sent = page.waitForRequest((request) => isCommand(request, "decision-edit"))
    const saved = await clickCommand(page, editor.getByRole("button", { name: "Save decision", exact: true }), "decision-edit", observations)
    const payload = asRecord((await sent).postDataJSON())
    expect(payload.caseRef).toEqual({ ...identity, version: 1 })
    expect(payload.objective).toBe(objective)
    expect(payload.horizon).toEqual(draft.horizon)
    expect(payload.currency).toBe("USD")
    expect(Array.isArray(payload.sourceRefs)).toBe(true)
    const refs = (payload.sourceRefs as unknown[]).map(asRecord)
    expect(refs).toHaveLength(2)
    expect(refs.map((ref) => asRecord(ref.target).recordId).sort()).toEqual([sources.baseline, sources.candidate].sort())
    for (const ref of refs) {
      expect(ref.kind).toBe("record")
      expect(asRecord(ref.target)).toMatchObject({ surface: "planner", recordType: "planner-version", period: draft.horizon })
      expect(typeof asRecord(ref.target).incarnation).toBe("string")
      expect(typeof ref.refDigest).toBe("string")
    }
    expect(saved.value).toEqual({ caseRef: { ...identity, version: 2 } })
    await currentCase(page, reference, objective, 2, "draft")
    const context = asRecord(JSON.parse((await page.locator("form[data-decision-edit]").getAttribute("data-context"))!))
    expect(context.sourceRefs).toEqual(payload.sourceRefs)
    observations.push({ stage: "authorized-sources-attached", caseRef: { ...identity, version: 2 }, sources: refs })
  })

  const promotions: { payload: unknown; body: string | null; key: string | undefined }[] = []
  const listener = (request: Request) => {
    if (isCommand(request, "decision-promote")) promotions.push({ payload: request.postDataJSON(), body: request.postData(), key: request.headers()["idempotency-key"] })
  }
  page.on("request", listener)
  let firstCoverageBasis: unknown
  try {
    await test.step("save the first alternative with an explicit pending cost inventory", async () => {
      const registration = await prepareAlternative(page, sourceNames.baseline, sources.baseline, titles.baseline, 100, observations)
      expect(registration.caseRef).toEqual({ ...identity, version: 2 })
      firstCoverageBasis = registration.basis
      await currentCase(page, reference, objective, 2, "draft")
      const saved = await clickCommand(page, page.locator("form[data-decision-alternatives]").getByRole("button", { name: "Create alternative", exact: true }), "decision-promote", observations)
      const receipt = asRecord(saved.value)
      expect(receipt.resultRef).toMatch(/^decision-result:/)
      expect(receipt).toEqual({ caseRef: { ...identity, version: 3 }, resultRef: receipt.resultRef })
      await currentCase(page, reference, objective, 3, "comparing")
      await expect(alternativeArticles(page)).toHaveCount(1)
      await assertAlternative(page, titles.baseline, 1200)
      expect(promotions).toHaveLength(1)
    })

    await test.step("lose the second creation response and explicitly recover the identical request", async () => {
      const registration = await prepareAlternative(page, sourceNames.candidate, sources.candidate, titles.candidate, 200, observations)
      expect(registration.caseRef).toEqual({ ...identity, version: 3 })
      expect(registration.basis).toEqual(firstCoverageBasis)
      await currentCase(page, reference, objective, 3, "comparing")
      const editor = page.locator("form[data-decision-alternatives]")
      const lost = await (async () => {
        const interruption = await loseAlternativeResponse(page, installation.origin)
        try {
          const failed = page.waitForEvent("requestfailed", { predicate: (request) => isCommand(request, "decision-promote") })
          const observed = Promise.all([interruption.completed, failed])
          await editor.getByRole("button", { name: "Create alternative", exact: true }).click()
          const [result] = await observed
          return result
        } finally { await interruption.close() }
      })()
      expect(lost.httpStatus).toBe(200)
      expect(lost.contentType).toContain("application/json")
      const receipt = asRecord(asRecord(lost.body).value)
      expect(receipt.resultRef).toMatch(/^decision-result:/)
      expect(lost.body).toEqual({ status: "ok", value: { caseRef: { ...identity, version: 4 }, resultRef: receipt.resultRef } })
      await expect(editor.getByLabel("Alternative title", { exact: true })).toHaveValue(titles.candidate)
      await expect(editor.getByLabel("Alternative title", { exact: true })).toBeDisabled()
      await expect(editor.getByLabel("Source for alternative", { exact: true })).toBeDisabled()
      await expect(editor.getByRole("button", { name: "Retry same request", exact: true })).toBeEnabled()
      expect(promotions).toHaveLength(2)
      const original = promotions[1]!
      expect(original.payload).toEqual(lost.payload)
      expect(original.key).toMatch(/^[a-f0-9-]{36}$/)
      expect(asRecord(original.payload).caseRef).toEqual({ ...identity, version: 3 })
      const recovered = await clickCommand(page, editor.getByRole("button", { name: "Retry same request", exact: true }), "decision-promote", observations)
      expect(recovered).toEqual(lost.body)
      expect(promotions).toHaveLength(3)
      expect(promotions[2]).toEqual(original)
      await currentCase(page, reference, objective, 4, "comparing")
      await expect(alternativeArticles(page)).toHaveCount(2)
      observations.push({ stage: "alternative-response-reconciled", caseRef: { ...identity, version: 4 },
        originalMutationKey: original.key, mutationRequests: 3, distinctIntentions: 2, financialApplication: false })
    })

    await test.step("reopen the exact alternatives and consume them in the current comparison", async () => {
      await page.reload()
      await currentCase(page, reference, objective, 4, "comparing")
      await reopenCase(page, reference, objective)
      await currentCase(page, reference, objective, 4, "comparing")
      await expect(alternativeArticles(page)).toHaveCount(2)
      await assertAlternative(page, titles.baseline, 1200)
      await assertAlternative(page, titles.candidate, 2400)
      const choice = page.locator("form[data-decision-choice]")
      await expect(choice).toHaveAttribute("data-sf-choice-ready", "true")
      const context = asRecord(JSON.parse((await choice.getAttribute("data-context"))!))
      expect(context.caseRef).toEqual({ ...identity, version: 4 })
      const alternatives = (context.alternatives as unknown[]).map(asRecord)
      expect(alternatives).toHaveLength(2)
      expect(new Set(alternatives.map((item) => item.id)).size).toBe(2)
      expect(alternatives.map((item) => item.title).sort()).toEqual(Object.values(titles).sort())
      for (const alternative of alternatives) expect(alternative).toMatchObject({ version: 1, currency: "USD", horizon: draft.horizon })
      await choice.getByLabel("Baseline", { exact: true }).selectOption({ label: titles.baseline })
      await choice.getByLabel("Alternative", { exact: true }).selectOption({ label: titles.candidate })
      const compared = await clickCommand(page, choice.getByRole("button", { name: "Compare", exact: true }), "decision-compare", observations)
      const value = asRecord(compared.value)
      // C10 compares cost as alternative minus baseline; savings has the opposite orientation.
      expect(asRecord(value.comparison)).toMatchObject({ comparisonStatus: "conditioned", knownDifference: 1200, completeDifference: null })
      expect(asRecord(value.request).criteria).toEqual((context.criteria as { id: string }[]).map((criterion) => criterion.id))
      expect(asRecord(value.comparison).criterionResults).toEqual((context.criteria as { id: string }[]).map((criterion) => ({
        criterionId: criterion.id, state: "unknown", reason: "criterion-rule-unavailable",
      })))
      expect(asRecord(value.comparison).unresolvedConditions).toContain("criterion-rules-unavailable")
      await expect(choice.locator("[data-comparison]")).toContainText("Comparison: conditioned · Known difference: 1200")
      await expect(choice.getByRole("button", { name: "Record choice", exact: true })).toBeEnabled()
      await expect(page.getByText("No changes prepared.", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
      expect(promotions).toHaveLength(3)
      observations.push({ stage: "persisted-alternatives-compared", caseRef: { ...identity, version: 4 }, alternatives,
        comparison: value.comparison, choiceRecorded: false, financialApplication: false })

      // Leaving a read comparison can warn about the unsaved human choice. No choice is submitted.
      page.once("dialog", (dialog) => dialog.accept())
      await page.getByRole("link", { name: "Workbench", exact: true }).click()
      await page.getByText("Explore a portfolio", { exact: true }).click()
      const portfolio = page.locator("section[data-portfolio]")
      await expect(portfolio).toHaveAttribute("data-sf-portfolio-ready", "true")
      await clickCommand(page, portfolio.getByRole("button", { name: "Find decisions", exact: true }), "decision-list", observations, "GET")
      await portfolio.getByRole("checkbox", { name: objective, exact: true }).check()
      const catalogReply = await clickCommand(page, portfolio.getByRole("button", { name: "Find alternatives", exact: true }), "decision-portfolio-catalog", observations)
      const catalog = asRecord(catalogReply.value)
      expect(catalog.cases).toHaveLength(1)
      const item = asRecord((catalog.cases as unknown[])[0])
      expect(item.caseRef).toEqual({ ...identity, version: 4 })
      const candidates = (item.alternatives as unknown[]).map(asRecord)
      expect(candidates).toHaveLength(2)
      expect(candidates.map((candidate) => candidate.alternativeId).sort()).toEqual(alternatives.map((alternative) => alternative.id).sort())
      for (const candidate of candidates) {
        expect(candidate.alternativeVersion).toBe(1)
        expect(candidate.comparisonStatus).toBe("conditioned")
        expect(asRecord(candidate.costCoverage).coverageState).toBe("pending")
        await expect(portfolio.locator("[data-portfolio-candidates]").getByRole("checkbox", { name: `${objective} · ${candidate.title} · conditioned`, exact: true })).toBeVisible()
      }
      observations.push({ stage: "portfolio-consumed-identical-alternatives", caseRef: item.caseRef,
        alternativeIds: candidates.map((candidate) => candidate.alternativeId), portfolioEvaluated: false })
    })
  } finally { page.off("request", listener) }
}

async function selectSource(select: Locator, name: string, id: string) {
  await expect(select).toBeEnabled()
  const option = select.getByRole("option", { name: new RegExp(`${name}|${id}`) })
  await expect(option).toHaveCount(1)
  await select.selectOption({ label: (await option.textContent())!.trim() })
}

async function currentCase(page: Page, reference: string, objective: string, version: number, state: "draft" | "comparing") {
  await expect(page).toHaveURL((url) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === "workbench-case" && url.searchParams.get("caseRef") === reference)
  const decision = page.getByRole("region", { name: "Decision", exact: true })
  await expect(decision.getByRole("heading", { name: objective, exact: true })).toBeVisible()
  await expect(decision.locator("header > p")).toHaveText(`${state} · Version ${version} · ${draft.horizon.start} – ${draft.horizon.end} · USD`)
  const context = asRecord(JSON.parse((await page.locator("form[data-decision-edit]").getAttribute("data-context"))!))
  expect(context.caseRef).toEqual({ ...caseIdentity(reference), version })
}

function alternativeArticles(page: Page) {
  return page.getByRole("region", { name: "Decision", exact: true }).locator(":scope > section")
    .filter({ has: page.getByRole("heading", { name: "Alternatives", exact: true }) }).locator(":scope > article")
}

async function assertAlternative(page: Page, title: string, subtotal: number) {
  const article = alternativeArticles(page).filter({ has: page.getByRole("heading", { name: title, exact: true }) })
  await expect(article).toHaveCount(1)
  await expect(article.getByRole("heading", { name: "Comparison conditioned", exact: true })).toBeVisible()
  await expect(article.getByText(`Known subtotal: ${subtotal} USD`, { exact: true })).toBeVisible()
  await expect(article.getByText(/^Total:/)).toHaveCount(0)
  await expect(article).toContainText(`${draft.horizon.start} – ${draft.horizon.end}`)
}

async function prepareAlternative(page: Page, sourceName: string, versionId: string, title: string, monthlyAmount: number, observations: Record<string, unknown>[]) {
  const editor = page.locator("form[data-decision-alternatives]")
  await expect(editor).toHaveAttribute("data-sf-alternatives-ready", "true")
  await editor.getByRole("button", { name: "Load attached scenarios", exact: true }).click()
  const source = editor.getByLabel("Source for alternative", { exact: true })
  await selectSource(source, sourceName, versionId)
  const sourceDigest = await source.inputValue()
  const inspected = page.waitForResponse((response) => isCommand(response.request(), "decision-controls", "GET") && new URL(response.url()).searchParams.get("source") === sourceDigest)
  await editor.getByRole("button", { name: "Inspect scenario", exact: true }).click()
  const inspectedResponse = await inspected
  expect(inspectedResponse.status()).toBe(200)
  expect(inspectedResponse.headers()["content-type"]).toContain("application/json")
  const inspectedReply = asRecord(await inspectedResponse.json())
  const controls = inspectedReply.status === "ok" ? asRecord(inspectedReply.value) : inspectedReply
  const observedSource = asRecord(asRecord(asRecord(controls.selected).forecast).source)
  expect(observedSource.refDigest).toBe(sourceDigest)
  expect(asRecord(observedSource.target)).toMatchObject({ surface: "planner", recordType: "planner-version", recordId: versionId })
  const preview = editor.locator("[data-alternative-preview]")
  await expect(preview).toHaveAttribute("data-state", "ready")
  await expect(preview).toContainText("USD")
  await expect(preview).toContainText(`Component: ${monthlyAmount} USD · 2027-01-01 – 2027-01-31`)
  await editor.getByLabel("Alternative title", { exact: true }).fill(title)
  const inventory = editor.getByLabel("Cost inventory", { exact: true })
  const offered = inventory.getByRole("option", { name: /renewal|transition/i })
  await expect(offered).toHaveCount(1)
  await inventory.selectOption({ label: (await offered.textContent())!.trim() })
  await editor.getByLabel("Reason for pending cost review", { exact: true }).fill(pendingReason)
  const sent = page.waitForRequest((request) => isCommand(request, "decision-coverage"))
  const coverage = await clickCommand(page, editor.getByRole("button", { name: "Save pending coverage", exact: true }), "decision-coverage", observations)
  const registration = asRecord((await sent).postDataJSON())
  expect(registration.expectedVersion).toBe(0)
  const basis = asRecord(registration.basis)
  expect(basis.decisionType).toBe("renewal-transition-v1")
  expect(basis.version).toBe(1)
  expect(basis.categoryIds).toHaveLength(9)
  expect(basis.additionalCategoryIds).toEqual([])
  expect(registration.entries).toEqual((basis.categoryIds as string[]).map((categoryId) => ({ categoryId, status: "pending", reason: pendingReason })))
  expect(registration.source).toEqual(observedSource)
  expect(typeof asRecord(coverage.value).coverageRef).toBe("string")
  expect(asRecord(coverage.value).version).toBe(1)
  await expect(editor.getByRole("button", { name: "Create alternative", exact: true })).toBeEnabled()
  observations.push({ stage: "human-pending-coverage-saved", sourceName, title, coverage: coverage.value, registration, pendingReason })
  return registration
}
