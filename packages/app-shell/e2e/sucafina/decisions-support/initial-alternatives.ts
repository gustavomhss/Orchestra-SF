import { expect, test, type Page, type Request } from "@playwright/test"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { asRecord, assertPortfolioCatalog, caseIdentity, clickCommand, draft, enterWorkbench, fillDecision, isCommand, readCase, readReply, reopenCase } from "./journey"
import { createPlannerSources, sourceNames } from "./planner-sources"
import { loseAlternativeResponse } from "./alternative-response"

const titles = { baseline: "Keep the baseline service", candidate: "Consider the candidate service" }
const pendingReason = "Cost categories still need evidence; a known service amount does not establish complete coverage."
export const knownIncreaseCriterion = "Keep the increase in known annual subtotal at or below 2000 USD; unresolved cost categories remain pending."

export async function initialAlternativesJourney(page: Page, installation: { origin: string; actorId: string }, observations: Record<string, unknown>[]) {
  const sources = await test.step("create two actual Planner versions through human controls", () => createPlannerSources(page, installation.origin, installation.actorId, observations))
  await enterWorkbench(page, installation.origin)
  const objective = `${draft.objective} — initial alternatives`
  const form = await fillDecision(page, objective, [knownIncreaseCriterion])
  const created = await clickCommand(page, form.getByRole("button", { name: "Confirm this decision creation", exact: true }), "workbench-command", observations)
  expect(typeof created.outputRef).toBe("string")
  const reference = created.outputRef as string
  const identity = caseIdentity(reference)
  await form.getByRole("link", { name: "Open decision", exact: true }).click()
  await currentCase(page, reference, objective, 1, "draft")

  await test.step("discover and inspect authorized sources before attaching them to the saved case", async () => {
    await page.getByRole("button", { name: "Edit decision", exact: true }).click()
    const editor = page.locator("[data-sf-decision-editor]")
    await expect(editor).toBeVisible()
    await editor.getByRole("button", { name: "Find Planner sources", exact: true }).click()
    const select = editor.getByRole("combobox", { name: "Planner source", exact: true })
    for (const entry of [{ name: sourceNames.baseline, id: sources.baseline, monthlyAmount: 100, count: 1 }, { name: sourceNames.candidate, id: sources.candidate, monthlyAmount: 200, count: 2 }]) {
      await expect(select).toBeEnabled()
      const option = select.getByRole("option", { name: new RegExp(`^${entry.name} \\(${entry.id}\\) · 2027 · draft · r[1-9]\\d*$`) })
      await expect(option).toHaveCount(1)
      const label = (await option.textContent())!.trim()
      await select.selectOption({ label })
      const selected = await select.inputValue()
      const inspect = editor.getByRole("button", { name: "Inspect selected source", exact: true })
      const [inspection] = await Promise.all([page.waitForResponse((response) => {
        const url = new URL(response.url())
        return url.origin === installation.origin && isCommand(response.request(), "bi-data", "GET") &&
          url.searchParams.get("baseRef") === selected && url.searchParams.get("candidateRef") === selected
      }).then(async (response) => {
        expect(response.status()).toBe(200)
        expect(response.headers()["content-type"]).toContain("application/json")
        return asRecord(await response.json())
      }), inspect.click()])
      expect(asRecord(inspection.projection).components).toEqual(expect.arrayContaining([
        expect.objectContaining({ amount: entry.monthlyAmount, currency: "USD",
          period: { start: "2027-01-01", end: "2027-01-31" } }),
      ]))
      const preview = editor.locator("[data-sf-source-preview]")
      await expect(preview).toHaveAttribute("data-state", "ready")
      await expect(preview.getByRole("heading", { name: label, exact: true })).toBeVisible()
      await expect(preview).toContainText("USD")
      await expect(preview).toContainText("2027-01-01")
      await expect(preview).toContainText("2027-12-31")
      await editor.getByRole("button", { name: "Attach source to draft", exact: true }).click()
      await expect(editor.locator("[data-sf-decision-sources] > li")).toHaveCount(entry.count)
    }
    await editor.getByRole("button", { name: "Review source attachments", exact: true }).click()
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
    expect((await readCase(page, reference)).sourceRefs).toEqual(payload.sourceRefs)
    const persistedSources = page.getByRole("region", { name: "Source references", exact: true }).getByRole("listitem")
    await expect(persistedSources).toHaveText(refs.map((ref) => `${ref.refId} · ${ref.evidenceLevel}`))
    observations.push({ stage: "authorized-sources-attached", caseRef: { ...identity, version: 2 }, sources: refs })
  })

  const promotions: { payload: unknown; key: string | undefined }[] = []
  const registrations: unknown[] = []
  const listener = (request: Request) => {
    if (new URL(request.url()).origin !== installation.origin) return
    if (isCommand(request, "decision-promote")) promotions.push({ payload: request.postDataJSON(), key: request.headers()["idempotency-key"] })
    if (isCommand(request, "decision-coverage")) registrations.push(request.postDataJSON())
  }
  page.on("request", listener)
  try {
    const first = await test.step("save the first alternative with an explicit pending cost inventory", async () => {
      const draftCase = await readCase(page, reference)
      expect(draftCase.alternatives).toEqual([])
      const { source, basis, coverage, registration, payload, confirm } = await prepareAlternative(page,
        installation.origin, reference, draftCase, sources.baseline, titles.baseline, 100, "first", observations)
      expect(registrations).toEqual([registration])
      expect(basis.sourceRefs).toEqual([source])
      await currentCase(page, reference, objective, 2, "draft")
      expect((await readCase(page, reference)).alternatives).toEqual([])
      expect(promotions).toHaveLength(0)
      const saved = await clickCommand(page, confirm, "decision-promote", observations)
      const receipt = asRecord(saved.value)
      expect(receipt.resultRef).toMatch(/^decision-result:/)
      expect(receipt).toEqual({ caseRef: { ...identity, version: 3 }, resultRef: receipt.resultRef })
      await currentCase(page, reference, objective, 3, "comparing")
      expect(promotions).toHaveLength(1)
      expect(promotions[0]!.payload).toEqual(payload)
      const persisted = await readCase(page, reference)
      expect(persisted.alternatives).toHaveLength(1)
      const baseline = persisted.alternatives[0]!
      assertAlternative(baseline, payload, source, basis, 1200)
      await page.locator('[data-sf-surface="UI34"]').getByRole("link", { name: "Alternatives", exact: true }).click()
      await assertComparisonCard(page, baseline)
      await expect(page.locator(".sf-n24-compare-card")).toHaveCount(1)
      await page.getByRole("link", { name: "Back to case", exact: true }).click()
      await currentCase(page, reference, objective, 3, "comparing")
      observations.push({ stage: "first-alternative-saved", caseRef: receipt.caseRef, resultRef: receipt.resultRef, registration, coverage })
      return { baseline, basis, registration, coverage, resultRef: receipt.resultRef }
    })

    const second = await test.step("lose the second creation response and read back its exact saved outcome without replay", async () => {
      const before = await readCase(page, reference)
      expect(before.alternatives).toEqual([first.baseline])
      const { source, basis, coverage, registration, payload, editor, confirm } = await prepareAlternative(page,
        installation.origin, reference, before, sources.candidate, titles.candidate, 200, "second", observations, first.basis)
      expect(registration.caseRef).toEqual({ ...identity, version: 3 })
      expect(basis).toEqual(first.basis)
      expect(coverage.coverageRef).not.toBe(first.coverage.coverageRef)
      expect(registrations).toEqual([first.registration, registration])
      await currentCase(page, reference, objective, 3, "comparing")
      expect((await readCase(page, reference)).alternatives).toEqual([first.baseline])
      expect(promotions).toHaveLength(1)
      const lost = await (async () => {
        const interruption = await loseAlternativeResponse(page, installation.origin)
        try {
          const failed = page.waitForEvent("requestfailed", { predicate: (request) => isCommand(request, "decision-promote") })
          const observed = Promise.all([interruption.completed, failed])
          await confirm.click()
          const [result] = await observed
          return result
        } finally { await interruption.close() }
      })()
      expect(lost.httpStatus).toBe(200)
      expect(lost.contentType).toContain("application/json")
      const receipt = asRecord(asRecord(lost.body).value)
      expect(receipt.resultRef).toMatch(/^decision-result:/)
      expect(receipt.resultRef).not.toBe(first.resultRef)
      expect(lost.body).toEqual({ status: "ok", value: { caseRef: { ...identity, version: 4 }, resultRef: receipt.resultRef } })
      await expect(editor.getByRole("alert")).toContainText("Save outcome unknown.")
      await expect(editor.getByLabel("Alternative title", { exact: true })).toHaveValue(titles.candidate)
      await expect(editor.getByLabel("Alternative title", { exact: true })).toBeDisabled()
      await expect(editor.getByRole("combobox", { name: "Attached Planner source", exact: true })).toBeDisabled()
      await expect(confirm).toBeDisabled()
      expect(promotions).toHaveLength(2)
      const original = promotions[1]!
      expect(original.payload).toEqual(payload)
      expect(lost.payload).toEqual(payload)
      expect(original.key).toMatch(/^[a-f0-9-]{36}$/)
      expect(original.key).not.toBe(promotions[0]!.key)
      const [read] = await Promise.all([waitForAttachedRead(page, installation.origin, reference, source.refDigest),
        editor.getByRole("button", { name: "Check saved outcome", exact: true }).click()])
      const recovered = asRecord(asRecord((await readReply(read, observations)).value).selected)
      expect(recovered.caseRef).toEqual(receipt.caseRef)
      const forecast = asRecord(recovered.forecast)
      expect(forecast.source).toEqual(source)
      expect(forecast.expectedVersion).toBe(coverage.version)
      expect(asRecord(forecast.classification).version).toBe(coverage.version)
      expect(asRecord(forecast.coverage)).toMatchObject({ coverageRef: coverage.coverageRef, basis })
      await expect(editor.getByText(`Alternative save verified: v4 · ${receipt.resultRef}`, { exact: true })).toBeVisible()
      await editor.getByRole("button", { name: "Reload recovered case", exact: true }).click()
      await currentCase(page, reference, objective, 4, "comparing")
      const persisted = await readCase(page, reference)
      expect(persisted.alternatives).toHaveLength(2)
      expect(persisted.alternatives).toContainEqual(first.baseline)
      const candidate = persisted.alternatives.find((alternative) => alternative.title === titles.candidate)!
      assertAlternative(candidate, payload, source, basis, 2400)
      expect(candidate.id).not.toBe(first.baseline.id)
      expect(asRecord(recovered.decision).alternatives).toEqual(persisted.alternatives)
      expect(recovered.scenarios).toEqual(expect.arrayContaining([
        expect.objectContaining({ ref: first.resultRef, alternativeId: first.baseline.id, caseRef: { ...identity, version: 3 } }),
        expect.objectContaining({ ref: receipt.resultRef, alternativeId: candidate.id, caseRef: { ...identity, version: 4 } }),
      ]))
      expect(promotions).toHaveLength(2)
      expect(registrations).toHaveLength(2)
      observations.push({ stage: "alternative-response-reconciled", caseRef: receipt.caseRef, resultRef: receipt.resultRef,
        alternativeId: candidate.id, originalMutationKey: original.key, mutationRequests: 2, distinctIntentions: 2, financialApplication: false })
      return candidate
    })

    await test.step("reopen the exact two alternatives in native comparison and the positive portfolio catalog", async () => {
      await page.reload()
      await currentCase(page, reference, objective, 4, "comparing")
      await reopenCase(page, reference, objective)
      await currentCase(page, reference, objective, 4, "comparing")
      const alternatives = [first.baseline, second]
      expect(await readCase(page, reference)).toMatchObject({ alternatives, choices: [], preparedChanges: [], receipts: [] })
      await page.locator('[data-sf-surface="UI34"]').getByRole("link", { name: "Alternatives", exact: true }).click()
      await expect(page).toHaveURL((url) => url.pathname === `/orchestra/sf-decisions/${encodeSfRouteRef(reference)}/alternatives`)
      const compare = page.getByRole("button", { name: "Compare alternatives", exact: true })
      await expect(compare).toBeDisabled()
      for (const alternative of alternatives) {
        const card = await assertComparisonCard(page, alternative)
        await card.getByRole("button", { name: "Select for comparison", exact: true }).click()
        await expect(card).toHaveAttribute("aria-current", "true")
      }
      await compare.click()
      await expect(page.locator('.sf-n24-compare-card[aria-current="true"]')).toHaveCount(2)
      await expect(page.locator(".sf-n24-compare-card")).toHaveCount(2)
      await expect(page.getByText("A complete numerical comparison is not authorized for these bases, periods or currencies.", { exact: true })).toBeVisible()
      await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
      observations.push({ stage: "persisted-alternatives-compared", caseRef: { ...identity, version: 4 },
        alternativeIds: alternatives.map((alternative) => alternative.id), knownSubtotals: [1200, 2400],
        completeComparison: false, choiceRecorded: false, financialApplication: false })

      const item = await assertPortfolioCatalog(page, installation.origin, reference, 4, observations)
      const candidates = item.alternatives
      expect(candidates).toHaveLength(2)
      expect(candidates.map((candidate) => candidate.alternativeId).sort()).toEqual(alternatives.map((alternative) => alternative.id).sort())
      for (const candidate of candidates) {
        expect(candidate.alternativeVersion).toBe(1)
        expect(candidate.comparisonStatus).toBe("conditioned")
        expect(candidate.costCoverage.coverageState).toBe("pending")
      }
      expect(promotions).toHaveLength(2)
      expect(registrations).toHaveLength(2)
      observations.push({ stage: "portfolio-consumed-identical-alternatives", caseRef: item.caseRef,
        alternativeIds: candidates.map((candidate) => candidate.alternativeId), portfolioEvaluated: false })
    })
  } finally { page.off("request", listener) }
  return { reference, objective, sources, titles }
}

async function currentCase(page: Page, reference: string, objective: string, version: number, state: "draft" | "comparing") {
  await expect(page).toHaveURL((url) => url.pathname === "/orchestra/sf-decisions/" + encodeSfRouteRef(reference))
  const decision = page.locator('[data-sf-surface="UI34"]')
  await expect(decision).toHaveAttribute("data-sf-case-ref", reference)
  await expect(decision).toHaveAttribute("data-sf-case-version", String(version))
  await expect(decision.getByRole("region", { name: "Question", exact: true }).getByText(objective, { exact: true })).toBeVisible()
  await expect(decision.locator(".sf-n24-metadata > span")).toHaveText([
    `Current version: ${version}`, `State: ${state}`,
    `Period: ${draft.horizon.start} – ${draft.horizon.end}`, "USD",
  ])
  expect(await readCase(page, reference)).toMatchObject({ ...caseIdentity(reference), version, objective, state,
    horizon: draft.horizon, currency: "USD" })
}

type SavedCase = Awaited<ReturnType<typeof readCase>>
type SavedAlternative = SavedCase["alternatives"][number]

async function assertComparisonCard(page: Page, alternative: SavedAlternative) {
  const article = page.locator(".sf-n24-compare-card").filter({ has: page.getByRole("heading", { name: alternative.title, exact: true }) })
  await expect(article).toHaveCount(1)
  await expect(article.getByText(`Version: ${alternative.version}`, { exact: true })).toBeVisible()
  await expect(article.getByText("Known subtotal", { exact: true })).toBeVisible()
  await expect(article.getByText(`${alternative.result.knownSubtotal} USD`, { exact: true })).toBeVisible()
  await expect(article.getByText("conditioned", { exact: true })).toBeVisible()
  await expect(article.getByText("pending", { exact: true })).toBeVisible()
  await expect(article.getByText("Total", { exact: true })).toHaveCount(0)
  await expect(article).toContainText(`${alternative.result.costCoverage.basisId} · ${alternative.result.costCoverage.basisVersion}`)
  await expect(article).toContainText(`${draft.horizon.start} – ${draft.horizon.end}`)
  return article
}

function assertAlternative(alternative: SavedAlternative, payload: { title: string; scenario: unknown }, source: SavedCase["sourceRefs"][number],
  basis: Record<string, unknown>, subtotal: number) {
  expect(alternative).toMatchObject({ id: expect.any(String), title: payload.title, version: 1, scenario: payload.scenario,
    result: { comparisonStatus: "conditioned", knownSubtotal: subtotal, total: null, currency: "USD", horizon: draft.horizon,
      costCoverage: { coverageState: "pending", alternativeId: alternative.id, alternativeVersion: 1, basisId: basis.id, basisVersion: basis.version } } })
  expect(alternative.result.sourceRefs).toContainEqual(source)
}

async function prepareAlternative(page: Page, origin: string, reference: string, before: SavedCase, versionId: string, title: string,
  monthlyAmount: number, ordinal: "first" | "second", observations: Record<string, unknown>[], existingBasis?: Record<string, unknown>) {
  const matches = before.sourceRefs.filter((ref) => ref.kind === "record" && ref.target.surface === "planner" &&
    ref.target.recordType === "planner-version" && ref.target.recordId === versionId)
  expect(matches).toHaveLength(1)
  const source = matches[0]!
  const caseRef = { id: before.id, incarnation: before.incarnation, version: before.version }
  const editor = page.getByRole("region", { name: `Create ${ordinal} alternative`, exact: true })
  await editor.getByRole("combobox", { name: "Attached Planner source", exact: true }).selectOption(source.refDigest)
  const [read] = await Promise.all([waitForAttachedRead(page, origin, reference, source.refDigest),
    editor.getByRole("button", { name: "Inspect attached forecast", exact: true }).click()])
  const inspection = asRecord(asRecord((await readReply(read, observations)).value).selected)
  expect(inspection.caseRef).toEqual(caseRef)
  const forecast = asRecord(inspection.forecast)
  expect(forecast.source).toEqual(source)
  expect(forecast.expectedVersion).toBe(0)
  const preview = editor.getByRole("region", { name: "Inspected forecast", exact: true })
  await expect(preview).toContainText("USD · 2027-01-01 – 2027-12-31")
  await expect(preview.getByText(`${monthlyAmount} USD · 2027-01-01 – 2027-01-31`, { exact: true })).toBeVisible()
  await editor.getByRole("checkbox", { name: "Use renewal or transition cost inventory", exact: true }).check()
  await editor.getByRole("textbox", { name: "Reason for pending cost review", exact: true }).fill(pendingReason)
  await editor.getByRole("button", { name: "Review pending coverage", exact: true }).click()
  const coverageReview = editor.getByRole("group", { name: "Review pending coverage", exact: true })
  await expect(coverageReview.getByRole("listitem")).toHaveCount(9)
  await expect(coverageReview.getByRole("listitem").filter({ hasText: pendingReason })).toHaveCount(9)
  const sent = page.waitForRequest((request) => isCommand(request, "decision-coverage"))
  const registered = await clickCommand(page, coverageReview.getByRole("button", { name: "Confirm pending coverage", exact: true }), "decision-coverage", observations)
  const registration = asRecord((await sent).postDataJSON())
  const basis = asRecord(registration.basis)
  expect(basis).toEqual(existingBasis ?? inspection.initialCoverageBasis)
  if (existingBasis) expect(asRecord(inspection.decision).costCoverageBases).toEqual([existingBasis])
  expect(basis).toMatchObject({ decisionType: "renewal-transition-v1", version: 1, additionalCategoryIds: [] })
  expect(basis.categoryIds).toHaveLength(9)
  expect(registration).toEqual({ caseRef, expectedVersion: 0, source, basis,
    entries: (basis.categoryIds as string[]).map((categoryId) => ({ categoryId, status: "pending", reason: pendingReason })) })
  const coverage = asRecord(registered.value)
  expect(coverage.coverageRef).toMatch(/^baseline-coverage:/)
  expect(coverage.version).toBe(1)
  await editor.getByRole("textbox", { name: "Alternative title", exact: true }).fill(title)
  const reviewLabel = `Review ${ordinal} alternative`
  await editor.getByRole("button", { name: reviewLabel, exact: true }).click()
  const promotionReview = editor.getByRole("group", { name: reviewLabel, exact: true })
  await expect(promotionReview).toContainText(title)
  await expect(promotionReview).toContainText(source.refId)
  await expect(promotionReview).toContainText(`${coverage.coverageRef} · v1`)
  return { editor, source, basis, coverage, registration,
    payload: { caseRef, title, scenario: { baseRef: source.refId, operations: [], assumptions: [] }, coverageRef: coverage.coverageRef },
    confirm: promotionReview.getByRole("button", { name: `Confirm ${ordinal} alternative`, exact: true }) }
}

function waitForAttachedRead(page: Page, origin: string, reference: string, sourceDigest: string) {
  return page.waitForResponse((response) => {
    const url = new URL(response.url())
    return url.origin === origin && isCommand(response.request(), "decision-controls", "GET") &&
      url.searchParams.get("case") === reference && url.searchParams.get("source") === sourceDigest &&
      url.searchParams.get("procurement") === "attached" && url.searchParams.get("format") === "json"
  })
}
