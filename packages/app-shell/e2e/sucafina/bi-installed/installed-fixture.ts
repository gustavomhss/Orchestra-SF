import { expect, type Locator, type Page, type Request, type Response } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { asRecord, caseIdentity, enterWorkbench } from "../decisions-support/journey"
import { observedReportResponse, retainReportResponse } from "../reports-support/model"

export const horizon = { start: "2027-01-01", end: "2027-12-31" }
export const objective = "BI62 · renewal versus transition with separately quoted training"
const criterion = "Known subtotal difference must be at most 50000 USD; unquoted costs remain unresolved."
const categories = ["service", "service_overlap", "implementation", "contract_exit", "migration", "taxes", "training", "internal_costs", "other_relevant_costs"]
const names = { baseline: "BI62 renewal 240000", missing: "BI62 transition with training unquoted", resolved: "BI62 transition with training 40000" }
const lineNames = { renewal: "BI62 final renewal including taxes", bridge: "BI62 final bridge including taxes", implementation: "BI62 implementation and migration excluding training", service: "BI62 final new service including taxes", zero: "BI62 explicitly quoted zero ancillary charges", training: "BI62 separately quoted training 40000" }

type CaseRef = { id: string; incarnation: string; version: number }
type Plan = { id: string; name: string; lines: Record<string, string> }
type Alternative = { id: string; title: string; resultRef: string }
export type InstalledBiCorpus = {
  caseRef: CaseRef
  caseSelector: string
  plans: { baseline: Plan; missing: Plan; resolved: Plan }
  alternatives: { baseline: Alternative; missing: Alternative; resolved: Alternative }
  comparisons: { missing: string; missingInverse: string; resolved: string; resolvedInverse: string }
  baselines: { missing: Alternative; resolved: Alternative }
  caseRefs: { missing: CaseRef; resolved: CaseRef }
  portfolioResultRef: string
  scenarioRefs: { missing: string; resolved: string }
}

/** Only source inputs are synthetic. The existing Planner UI saves them, and
 * normal authenticated HTTP commands issue sources, classify coverage, promote
 * scenarios and persist every comparison/portfolio. No result, reference,
 * grant, provider or installation store is replaced. The Planner observer retains
 * the complete original response bytes through a single pass-through request.
 */
export async function prepareInstalledBi(page: Page, installation: { origin: string; actorId: string }, observations: Record<string, unknown>[]): Promise<InstalledBiCorpus> {
  const plans = await preparePlanner(page, installation, observations)
  // BI only enumerates current case revisions. Independent decisions prove the
  // two quotes without relabeling a historical scenario as a current revision.
  const missing = await preparePair(page, installation, { baseline: plans.baseline, candidate: plans.missing }, "missing", observations)
  const resolved = await preparePair(page, installation, { baseline: plans.baseline, candidate: plans.resolved }, "resolved", observations)
  return { caseRef: resolved.caseRef, caseSelector: resolved.caseSelector, plans,
    caseRefs: { missing: missing.caseRef, resolved: resolved.caseRef },
    baselines: { missing: missing.baseline, resolved: resolved.baseline },
    alternatives: { baseline: resolved.baseline, missing: missing.candidate, resolved: resolved.candidate },
    comparisons: { missing: missing.comparisonRef, missingInverse: missing.inverseComparisonRef,
      resolved: resolved.comparisonRef, resolvedInverse: resolved.inverseComparisonRef },
    portfolioResultRef: resolved.portfolioResultRef,
    scenarioRefs: { missing: missing.candidate.resultRef, resolved: resolved.candidate.resultRef } }
}

async function preparePair(page: Page, installation: { origin: string; actorId: string }, plans: { baseline: Plan; candidate: Plan }, trainingState: "missing" | "resolved", observations: Record<string, unknown>[]) {
  const caseObjective = `${objective} · ${trainingState}`
  await enterWorkbench(page, installation.origin)
  await page.getByRole("button", { name: "New case", exact: true }).click()
  const create = page.locator("section.sf-n24-create form")
  await expect(create).toHaveCount(1)
  await expect(create).toBeVisible()
  await create.getByLabel("Decision objective", { exact: true }).fill(caseObjective)
  await create.getByLabel("Start", { exact: true }).fill(horizon.start)
  await create.getByLabel("End", { exact: true }).fill(horizon.end)
  await create.getByLabel("Currency", { exact: true }).fill("USD")
  await create.getByLabel("Criteria, one per line", { exact: true }).fill(criterion)
  await create.getByRole("button", { name: "Review creation", exact: true }).click()
  const reviewed = create.getByRole("group", { name: "Review creation", exact: true })
  await expect(reviewed).toContainText(caseObjective)
  await expect(reviewed).toContainText(criterion)
  const creating = page.waitForResponse((response) => {
    const target = new URL(response.url())
    return response.request().method() === "POST" && target.origin === installation.origin &&
      target.pathname === "/sucafina/dashboard" && target.searchParams.get("sf") === "workbench-command" &&
      response.request().postDataJSON()?.operation === "sf_case_draft"
  })
  await create.getByRole("button", { name: "Confirm this decision creation", exact: true }).click()
  const createdResponse = await creating
  expect(createdResponse.status()).toBe(200)
  expect(createdResponse.request().postDataJSON()).toEqual({
    operation: "sf_case_draft", input: { objective: caseObjective, horizon, currency: "USD", criteria: [criterion], sourceRefs: [] },
  })
  const created = asRecord(await createdResponse.json())
  expect(created.status).toBe("ok")
  expect(typeof created.outputRef).toBe("string")
  const caseSelector = created.outputRef as string
  const identity = caseIdentity(caseSelector)
  observations.push({ stage: "native-decision-created", httpStatus: createdResponse.status(), caseSelector })
  await create.getByRole("link", { name: "Open decision", exact: true }).click()
  await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-decisions/" + encodeSfRouteRef(caseSelector))
  await expect(page.getByRole("heading", { name: "Case summary", exact: true, level: 1 })).toBeVisible()
  await expect(page.getByRole("region", { name: "Question", exact: true })).toContainText(caseObjective)

  await page.getByRole("button", { name: "Edit decision", exact: true }).click()
  const edit = page.locator("[data-sf-decision-editor]")
  await expect(edit).toBeVisible()
  await edit.getByRole("button", { name: "Find Planner sources", exact: true }).click()
  const sourceChoice = edit.getByLabel("Planner source", { exact: true })
  for (const [index, plan] of Object.values(plans).entries()) {
    const option = sourceChoice.getByRole("option").filter({ hasText: plan.id })
    await expect(option).toHaveCount(1)
    await sourceChoice.selectOption({ label: (await option.textContent())!.trim() })
    await edit.getByRole("button", { name: "Inspect selected source", exact: true }).click()
    await expect(edit.locator("[data-sf-source-preview]")).toHaveAttribute("data-state", "ready")
    await expect(edit.locator("[data-sf-source-preview]")).toContainText(plan.name)
    await expect(edit.locator("[data-sf-source-preview]")).toContainText("USD")
    await edit.getByRole("button", { name: "Attach source to draft", exact: true }).click()
    await expect(edit.locator("[data-sf-decision-sources] > li")).toHaveCount(index + 1)
  }
  await edit.getByRole("button", { name: "Review source attachments", exact: true }).click()
  const attachmentReview = edit.getByRole("group", { name: "Review source attachments", exact: true })
  await expect(attachmentReview.getByRole("listitem")).toHaveCount(2)
  const attaching = page.waitForResponse((response) => {
    const target = new URL(response.url())
    return response.request().method() === "POST" && target.origin === installation.origin &&
      target.pathname === "/sucafina/dashboard" && target.searchParams.get("sf") === "decision-edit"
  })
  await attachmentReview.getByRole("button", { name: "Save decision", exact: true }).click()
  const attachedResponse = await attaching
  expect(attachedResponse.status()).toBe(200)
  const attached = asRecord(await attachedResponse.json())
  expect(attached.status).toBe("ok")
  let caseRef = readCaseRef(asRecord(attached.value).caseRef)
  expect(caseRef).toEqual({ ...identity, version: 2 })
  await expect(edit).toHaveCount(0)
  observations.push({ stage: "native-decision-sources-attached", httpStatus: attachedResponse.status(), caseRef })

  const controls = await readControls(page, installation.origin, caseSelector)
  const selected = asRecord(controls.selected)
  const decision = asRecord(selected.decision)
  expect(decision.objective).toBe(caseObjective)
  expect(decision.horizon).toEqual(horizon)
  expect(decision.currency).toBe("USD")
  expect(records(decision.criteria).map((entry) => entry.description)).toEqual([criterion])
  const sources = records(selected.forecasts).map((entry) => asRecord(entry.source))
  expect(sources).toHaveLength(2)
  const bases = records(decision.costCoverageBases).filter((basis) => basis.decisionType === "renewal-transition-v1")
  expect(bases).toHaveLength(1)
  const basis = bases[0]!
  expect(basis.categoryIds).toEqual(categories)
  const coverage = new Map<string, { source: Record<string, unknown>; ref: string }>()

  for (const [sourceKind, plan] of Object.entries(plans)) {
    const found = sources.filter((source) => asRecord(source.target).recordId === plan.id)
    expect(found).toHaveLength(1)
    const source = found[0]!
    const inspected = await readControls(page, installation.origin, caseSelector, String(source.refDigest))
    const forecast = asRecord(asRecord(inspected.selected).forecast)
    expect(forecast.source).toEqual(source)
    expect(forecast.expectedVersion).toBe(0)
    const projection = asRecord(forecast.projection)
    const components = records(projection.components)
    const refs = (line: string) => components.filter((component) => String(component.id).startsWith(`${plan.lines[line]}:`)).map((component) => String(component.id))
    for (const id of Object.values(plan.lines)) expect(components.filter((component) => String(component.id).startsWith(`${id}:`))).toHaveLength(12)
    // One source line may establish two coverage categories without becoming a
    // second monetary contribution. The source explicitly includes taxes and
    // migration, and explicitly excludes training from implementation.
    const entries = categories.flatMap((categoryId) => {
      if (sourceKind === "candidate" && trainingState === "missing" && categoryId === "training") return []
      const line = sourceKind === "baseline" ? ["service", "taxes"].includes(categoryId) ? "renewal" : "zero"
        : categoryId === "service" ? "service" : categoryId === "service_overlap" ? "bridge"
          : ["implementation", "migration"].includes(categoryId) ? "implementation"
            : categoryId === "training" ? "training" : "zero"
      return [{ categoryId, status: "included", componentRefs: sourceKind !== "baseline" && categoryId === "taxes" ? components.map((component) => String(component.id)) : refs(line),
        evidenceRefs: [source], scopeNote: categoryId === "taxes" ? "Every quoted source amount is final including taxes; this classification adds no second amount."
          : categoryId === "migration" && sourceKind !== "baseline" ? "Migration is included in the implementation quote, which excludes training."
            : line === "zero" ? "The source explicitly quotes zero additional charges for this category."
              : `Human classification of the separately quoted ${line} source.` }]
    })
    const registered = await command(page, installation.origin, "decision-coverage", { caseRef, source, basis, entries, expectedVersion: 0 }, observations)
    expect(typeof registered.coverageRef).toBe("string")
    expect(registered.version).toBe(1)
    coverage.set(sourceKind, { source, ref: String(registered.coverageRef) })
  }

  const promoted: Record<string, { resultRef: string; title: string }> = {}
  for (const [sourceKind, plan] of Object.entries(plans)) {
    const current = coverage.get(sourceKind)!
    const result = await command(page, installation.origin, "decision-promote", { caseRef, title: plan.name,
      scenario: { baseRef: current.source.refId, operations: [], assumptions: [] }, coverageRef: current.ref }, observations)
    const next = readCaseRef(result.caseRef)
    expect(next).toEqual({ ...caseRef, version: caseRef.version + 1 })
    expect(typeof result.resultRef).toBe("string")
    promoted[sourceKind] = { title: plan.name, resultRef: String(result.resultRef) }
    caseRef = next
  }
  const current = asRecord((await readControls(page, installation.origin, caseSelector)).selected)
  expect(current.caseRef).toEqual(caseRef)
  const savedCase = asRecord(current.decision)
  const alternatives = Object.fromEntries(Object.entries(promoted).map(([sourceKind, value]) => {
    const matches = records(savedCase.alternatives).filter((entry) => entry.title === value.title)
    expect(matches).toHaveLength(1)
    const result = asRecord(matches[0]!.result)
    expect(result.knownSubtotal).toBe(sourceKind === "baseline" ? 240000 : trainingState === "missing" ? 210000 : 250000)
    expect(result.total).toBe(sourceKind === "candidate" && trainingState === "missing" ? null : sourceKind === "baseline" ? 240000 : 250000)
    expect(result.comparisonStatus).toBe(sourceKind === "candidate" && trainingState === "missing" ? "conditioned" : "complete")
    observations.push({ stage: "scenario-persisted", trainingState, sourceKind, resultRef: value.resultRef, knownSubtotal: result.knownSubtotal,
      total: result.total, comparisonStatus: result.comparisonStatus, costCoverage: result.costCoverage })
    return [sourceKind, { ...value, id: String(matches[0]!.id) }]
  })) as { baseline: Alternative; candidate: Alternative }
  const criteria = records(savedCase.criteria)
  expect(criteria).toHaveLength(1)
  const criterionId = String(criteria[0]!.id)
  const rules = records(current.rules).filter((rule) => rule.id === criterionId)
  expect(rules).toHaveLength(1)
  expect(rules[0]!.expectedVersion).toBe(0)
  await command(page, installation.origin, "decision-criteria", { caseRef, criterionId, metricRef: "planner:known-subtotal-difference",
    operator: "lte", value: 50000, unit: "USD", period: horizon, evidenceRefs: sources, expectedRuleVersion: 0 }, observations)

  const catalog = await command(page, installation.origin, "decision-portfolio-catalog", { purpose: "catalog", caseRefs: [caseRef] }, observations)
  const catalogCases = records(catalog.cases)
  expect(catalogCases).toHaveLength(1)
  expect(catalogCases[0]!.caseRef).toEqual(caseRef)
  const candidates = records(catalogCases[0]!.alternatives)
  const matching = candidates.filter((entry) => entry.alternativeId === alternatives.candidate.id)
  expect(matching).toHaveLength(1)
  const inverseCandidate = candidates.filter((entry) => entry.alternativeId === alternatives.baseline.id)
  expect(inverseCandidate).toHaveLength(1)
  // The normal installed preview persists its C08 comparison and binding. It
  // does not persist an inverse portfolio or rewrite a historical scenario.
  const inverse = await evaluatePair(page, installation.origin, caseRef, alternatives.candidate, alternatives.baseline,
    criterionId, inverseCandidate[0]!.candidateRef, trainingState === "missing" ? 30000 : -10000,
    trainingState === "missing" ? null : -10000, observations, false)
  const comparison = await evaluatePair(page, installation.origin, caseRef, alternatives.baseline, alternatives.candidate,
    criterionId, matching[0]!.candidateRef, trainingState === "missing" ? -30000 : 10000, trainingState === "missing" ? null : 10000, observations)
  expect(typeof comparison.portfolioResultRef).toBe("string")
  return { caseRef, caseSelector, ...alternatives, comparisonRef: comparison.comparisonRef,
    inverseComparisonRef: inverse.comparisonRef, portfolioResultRef: String(comparison.portfolioResultRef) }
}

async function evaluatePair(page: Page, origin: string, caseRef: CaseRef, base: Alternative, candidate: Alternative,
  criterionId: string, candidateRef: unknown, knownDifference: number, completeDifference: number | null, observations: Record<string, unknown>[], persistPortfolio = true) {
  const selected = await command(page, origin, "decision-portfolio-selection", { caseRef }, observations)
  expect(typeof selected.version).toBe("number")
  await command(page, origin, "decision-select-portfolio", { caseRef, baselineAlternativeId: base.id,
    alternativeId: candidate.id, criteria: [criterionId], expectedVersion: selected.version }, observations)
  const saved = await command(page, origin, persistPortfolio ? "decision-portfolio-evaluate" : "decision-portfolio-preview", { caseRef,
    request: { scope: { horizon, currency: "USD" }, candidateRefs: [candidateRef], operations: [], constraints: [criterionId], priorities: [], explorationLimit: 4 } }, observations)
  if (persistPortfolio) {
    expect(saved.caseRef).toEqual(caseRef)
    expect(typeof saved.portfolioResultRef).toBe("string")
  } else expect(typeof saved.evaluationDigest).toBe("string")
  const combinations = records(asRecord(saved.portfolio).combinations)
  expect(combinations).toHaveLength(1)
  const analysis = asRecord(combinations[0]!.analysis)
  const comparison = asRecord(analysis.comparison)
  expect(analysis.scenarioResultRef).toBe(candidate.resultRef)
  expect(comparison.baselineResultRef).toBe(base.resultRef)
  expect(comparison.alternativeResultRef).toBe(candidate.resultRef)
  expect(comparison.knownDifference).toBe(knownDifference)
  expect(comparison.completeDifference).toBe(completeDifference)
  expect(typeof analysis.comparisonRef).toBe("string")
  observations.push({ stage: persistPortfolio ? "canonical-comparison-and-portfolio-persisted" : "canonical-inverse-comparison-persisted-via-preview", caseRef, comparisonRef: analysis.comparisonRef,
    portfolioResultRef: persistPortfolio ? saved.portfolioResultRef : null, baselineResultRef: base.resultRef, alternativeResultRef: candidate.resultRef,
    knownDifference: comparison.knownDifference, completeDifference: comparison.completeDifference })
  return { comparisonRef: String(analysis.comparisonRef), portfolioResultRef: persistPortfolio ? String(saved.portfolioResultRef) : undefined }
}

async function preparePlanner(page: Page, installation: { origin: string; actorId: string }, observations: Record<string, unknown>[]) {
  // Keep the original command body observable when the native review rerenders.
  await page.route((url) => url.origin === installation.origin && url.pathname === "/sucafina/planner" &&
    !url.searchParams.has("sf") && ["Versions", "OPEX"].includes(url.searchParams.get("page") ?? ""),
  async (route) => {
    if (route.request().method() !== "POST") return route.fallback()
    const original = await route.fetch({ maxRetries: 0, maxRedirects: 0 })
    await retainReportResponse(route.request(), original)
    await route.fulfill({ response: original })
  })
  const url = (name: "Versions" | "OPEX", version?: string) => "/orchestra/sf-planner/" +
    (name === "Versions" ? "versions" : "opex") + "?" + new URLSearchParams({ year: "2027", ...(version ? { version } : {}) })
  const versionRow = (id: string) => page.locator('tr[data-sf-row="' + id + '"]')
  const manager = page.getByRole("region", { name: "Manage record", exact: true })
  // The installation fixture still owns its real producer origin; only the
  // browser uses the native :3000 chapter. No cookie or transport is synthesized.
  await page.goto("/orchestra/sf-planner/versions/new")
  const created = await plannerCommand(page, page.getByRole("button", { name: "Create first version", exact: true }),
    "save", observations, installation.origin)
  if (!created.createdVersion) throw new Error("The created version was not supplied by the authorized Planner read")
  expect(created.createdVersion.id).toMatch(/\S+/)
  const baseline: Plan = { id: created.createdVersion.id, name: names.baseline, lines: {} }
  await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions/" + encodeSfRouteRef(baseline.id))
  await expect(page.locator("#sf-u46-name")).toBeEnabled()
  await page.locator("#sf-u46-name").fill(baseline.name)
  await page.locator("#sf-u46-year").fill("2027")
  await plannerCommand(page, page.getByRole("button", { name: "Save", exact: true }),
    "save", observations, installation.origin, baseline.id)
  await page.goto(url("OPEX", baseline.id))
  baseline.lines.renewal = await addLine(page, lineNames.renewal, 240000, installation.actorId, observations, installation.origin)
  baseline.lines.zero = await addLine(page, lineNames.zero, 0, installation.actorId, observations, installation.origin)
  await explicitForecast(page, { [lineNames.renewal]: 240000, [lineNames.zero]: 0 })

  const copy = async (source: Plan, name: string): Promise<Plan> => {
    await page.goto(url("Versions"))
    const row = versionRow(source.id)
    await expect(row).toHaveCount(1)
    const copied = await plannerCommand(page, row.getByRole("button", { name: "copy", exact: true }),
      "copy", observations, installation.origin, source.id)
    if (!copied.createdVersion) throw new Error("The copied version was not supplied by the authorized Planner read")
    const id = copied.createdVersion.id
    expect(id).toMatch(/\S+/)
    expect(id).not.toBe(source.id)
    await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions/" + encodeSfRouteRef(id))
    await expect(page.locator("#sf-u46-name")).toHaveValue(source.name + " — Copy")
    await page.locator("#sf-u46-name").fill(name)
    await plannerCommand(page, page.getByRole("button", { name: "Save", exact: true }),
      "save", observations, installation.origin, id)
    await page.goto(url("OPEX", id))
    return { id, name, lines: {} }
  }
  const missing = await copy(baseline, names.missing)
  const renewalId = await lineId(page, lineNames.renewal)
  const renewal = page.locator('tr[data-sf-row="' + renewalId + '"]')
  await renewal.getByRole("button", { name: "Manage", exact: true }).click()
  await expect(manager).toHaveCount(1)
  await manager.getByLabel("Name", { exact: true }).fill(lineNames.bridge)
  await manager.getByLabel("Annual budget", { exact: true }).fill("60000")
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }),
    "save", observations, installation.origin, renewalId)
  missing.lines.bridge = await lineId(page, lineNames.bridge)
  missing.lines.zero = await lineId(page, lineNames.zero)
  missing.lines.implementation = await addLine(page, lineNames.implementation, 45000, installation.actorId, observations, installation.origin)
  missing.lines.service = await addLine(page, lineNames.service, 105000, installation.actorId, observations, installation.origin)
  await explicitForecast(page, { [lineNames.bridge]: 60000, [lineNames.implementation]: 45000, [lineNames.service]: 105000, [lineNames.zero]: 0 })

  const resolved = await copy(missing, names.resolved)
  for (const key of ["bridge", "zero", "implementation", "service"] as const) resolved.lines[key] = await lineId(page, lineNames[key])
  resolved.lines.training = await addLine(page, lineNames.training, 0, installation.actorId, observations, installation.origin)
  await explicitForecast(page, { [lineNames.bridge]: 60000, [lineNames.implementation]: 45000, [lineNames.service]: 105000, [lineNames.zero]: 0, [lineNames.training]: 40000 })
  observations.push({ stage: "planner-inputs-saved-through-ui", horizon, currency: "USD", plans: { baseline, missing, resolved },
    declaredAmounts: { renewal: 240000, bridge: 60000, implementationIncludingMigration: 45000, newService: 105000, trainingNovember: 40000, otherQuotedCharges: 0 } })
  return { baseline, missing, resolved }
}

/** Declare every monthly forecast, including zeros. A budget inherited through
 * a null forecast is estimated and cannot establish complete cost coverage.
 * The native TSV review controls send the human input to the original producer.
 */
async function explicitForecast(page: Page, amounts: Record<string, number>) {
  await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/opex")
  const monthly = page.locator("section.sf-s02")
  await expect(monthly).toHaveCount(1)
  const grid = monthly.getByRole("grid", { name: "Monthly values", exact: true })
  const rows = grid.locator(".sf-s02-row")
  await expect(rows).toHaveCount(Object.keys(amounts).length)
  const labels = await rows.evaluateAll((elements) => elements.map((row) =>
    row.querySelector('[role="rowheader"]')?.textContent?.trim() ?? ""))
  expect(labels.slice().sort()).toEqual(Object.keys(amounts).sort())
  const matrix = labels.map((label) => Array.from({ length: 12 }, (_, month) => month === 10 ? amounts[label] : 0))
  const tsv = matrix.map((row) => row.join("\t")).join("\n")
  // Select the real Forecast cell; the grid owns its 0-based coordinate. Pasting
  // invokes the original producer preview and does not persist monthly values.
  const firstForecast = rows.first().getByRole("gridcell").first()
    .locator(".sf-s02-measure").filter({ has: page.getByText("Forecast", { exact: true }) })
  await expect(firstForecast).toHaveCount(1)
  await firstForecast.click()
  await monthly.getByRole("textbox", { name: "Paste tab-separated values", exact: true }).fill(tsv)
  const previewPending = page.waitForResponse((response) => response.request().method() === "POST" &&
    new URL(response.url()).searchParams.get("sf") === "workbench-planner" && response.request().postDataJSON()?.action === "preview")
  await monthly.getByRole("button", { name: "Review pasted values", exact: true }).click()
  const previewResponse = await previewPending
  expect(previewResponse.status()).toBe(200)
  const preview = asRecord(await previewResponse.json())
  expect(preview.status).toBe("ok")
  const previewRows = records(asRecord(preview.value).rows)
  expect(previewRows).toHaveLength(labels.length)
  const reviewedRows = monthly.locator(".sf-s02-preview-row")
  await expect(reviewedRows).toHaveCount(labels.length)
  for (let row = 0; row < labels.length; row++) {
    await expect(reviewedRows.nth(row)).toHaveAttribute("data-result", "ready")
    await expect(reviewedRows.nth(row).locator("code")).toHaveText(matrix[row]!.map(String))
  }
  const applying = page.waitForResponse((response) => response.request().method() === "POST" &&
    new URL(response.url()).searchParams.get("sf") === "workbench-planner" && response.request().postDataJSON()?.action === "apply")
  await monthly.getByRole("button", { name: "Apply reviewed rows", exact: true }).click()
  const response = await applying
  expect(response.status()).toBe(200)
  const result = asRecord(await response.json())
  expect(result.status).toBe("ok")
  const appliedRows = records(asRecord(result.value).rows)
  expect(appliedRows).toHaveLength(labels.length)
  for (const row of appliedRows) {
    expect(row.errors).toEqual([])
    expect(asRecord(row.result).ok).toBe(true)
  }
  await expect(monthly.getByRole("status")).toContainText("The producer confirmed the applied rows.")
  await page.reload()
  await expect(rows).toHaveCount(labels.length)
  expect(await rows.evaluateAll((elements) => elements.map((row) =>
    row.querySelector('[role="rowheader"]')?.textContent?.trim() ?? ""))).toEqual(labels)
  for (const [row, label] of labels.entries()) for (let month = 1; month <= 12; month++) {
    const cell = rows.nth(row).getByRole("gridcell").nth(month - 1)
      .locator(".sf-s02-measure").filter({ has: page.getByText("Forecast", { exact: true }) })
    await expect(cell, `${label} forecast month ${month}`).toHaveCount(1)
    await expect(cell.locator(".sf-s02-cell-amount")).toHaveText(new Intl.NumberFormat("en-US", {
      minimumFractionDigits: 2, maximumFractionDigits: 2,
    }).format(matrix[row]![month - 1]!))
    await expect(cell.locator(".sf-s02-cell-unit")).toHaveText("USD")
    await expect(cell.locator(".sf-s02-cell-source")).toHaveCount(0)
  }
}

async function lineId(page: Page, name: string) {
  const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name, exact: true }) })
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("data-sf-row", /\S+/)
  return (await row.getAttribute("data-sf-row"))!
}

async function addLine(page: Page, name: string, amount: number, actorId: string, observations: Record<string, unknown>[], origin: string) {
  await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/opex")
  const surface = page.getByRole("region", { name: "OPEX", exact: true })
  await expect(surface).toHaveCount(1)
  await expect(surface.getByLabel("Name", { exact: true })).toBeVisible()
  await surface.getByLabel("Name", { exact: true }).fill(name)
  await surface.getByLabel("Owner", { exact: true }).selectOption(actorId)
  await surface.getByLabel("Element", { exact: true }).selectOption("licenses")
  await expect(surface.getByLabel("Currency", { exact: true })).toHaveValue("USD")
  await surface.getByLabel("Annual budget", { exact: true }).fill(String(amount))
  await plannerCommand(page, surface.getByRole("button", { name: "Save", exact: true }), "save", observations, origin)
  return lineId(page, name)
}

async function plannerCommand(page: Page, button: Locator, action: string, observations: Record<string, unknown>[], origin: string, record = "") {
  await expect(button).toBeEnabled()
  const current = new URL(page.url())
  const capability = current.pathname === "/orchestra/sf-planner/opex" ? "CAP18" :
    /^\/orchestra\/sf-planner\/versions(?:\/|$)/.test(current.pathname) ? "CAP23" : undefined
  if (!capability) throw new Error("Planner commands require the native CAP18 or CAP23 route")
  const query = new URLSearchParams()
  for (const key of ["year", "version"]) {
    const value = current.searchParams.get(key)
    if (value !== null && (key === "year" || capability === "CAP18")) query.set(key, value)
  }
  const read = await page.request.get(origin + "/sucafina/api/ui/pages/" + capability + (query.size ? "?" + query : ""))
  expect(read.status()).toBe(200)
  const source = asRecord(await read.json())
  expect(source.status).toBe("ok")
  const projected = asRecord(source.value)
  expect(projected.capabilityId).toBe(capability)
  const data = asRecord(projected.data)
  const versions = asRecord(projected.versions)
  const key = capability === "CAP23" ? "versions:" + (record || "first") :
    String(asRecord(data.selectedVersion).id) + ":lines:" + record
  const version = record || capability === "CAP23" ? asRecord(versions[key] ?? {}).version ?? 0 : 0
  expect(typeof version, "The native Planner command requires the producer's numeric CAS token").toBe("number")
  expect(Number.isSafeInteger(version) && Number(version) >= 0).toBe(true)
  if (record) {
    const entries = records(capability === "CAP23" ? data.versions : data.lines)
    expect(entries.filter((entry) => entry.id === record)).toHaveLength(1)
  }
  const intent = { page: capability === "CAP23" ? "Versions" : "OPEX", action, record, version: String(version) }
  const observed: { response?: Response; failure?: string; unknown: boolean; count: number } = { unknown: false, count: 0 }
  let contextReadUrl: string | undefined
  const nativeRead = (request: Request) => {
    const target = new URL(request.url())
    return request.method() === "GET" && target.origin === origin &&
      ["/sucafina/api/ui/context", "/sucafina/api/ui/pages/CAP23", "/api/sucafina/installations"].includes(target.pathname)
      ? target : undefined
  }
  const matches = (request: Request) => {
    const url = new URL(request.url())
    if (request.method() !== "POST" || url.origin !== origin || url.pathname !== "/sucafina/planner" ||
        url.searchParams.get("page") !== intent.page || url.searchParams.has("sf")) return false
    try {
      const payload: unknown = request.postDataJSON()
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false
      const body = payload as Record<string, unknown>
      return body.action === action && body.page === intent.page && (body.id ?? "") === intent.record &&
        typeof body.version === "number" && String(body.version) === intent.version && body.confirmed === true
    } catch { return false }
  }
  const onRequest = (request: Request) => {
    if (matches(request)) observed.count++
    const target = nativeRead(request)
    if (target?.pathname === "/sucafina/api/ui/context") contextReadUrl = target.toString()
    if (target) observations.push({ stage: "planner-admission-request", path: target.pathname, queryKeys: [...target.searchParams.keys()].sort() })
  }
  const onResponse = (response: Response) => {
    const target = nativeRead(response.request())
    if (target) observations.push({ stage: "planner-admission-response", path: target.pathname, httpStatus: response.status() })
    if (!matches(response.request())) return
    observed.response = response
    observations.push({ stage: "planner-command-response", ...intent, httpStatus: response.status(), contentType: response.headers()["content-type"] ?? null })
  }
  const onFailed = (request: Request) => {
    const target = nativeRead(request)
    if (target) observations.push({ stage: "planner-admission-failed", path: target.pathname, failure: request.failure()?.errorText ?? "request-failed" })
    if (!matches(request)) return
    observed.failure = request.failure()?.errorText ?? "request-failed"
    observations.push({ stage: "planner-command-request-failed", ...intent, failure: observed.failure })
  }
  page.on("request", onRequest)
  page.on("response", onResponse)
  page.on("requestfailed", onFailed)
  try {
    await button.click()
    const review = page.locator('[data-component="sf-change-review"]')
    await expect(review).toHaveCount(1)
    await expect(review).toHaveAttribute("data-state", "ready")
    await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
    expect(observed.count, "Opening a native review must not submit the command").toBe(0)
    const confirm = review.getByRole("button", { name: "Confirm", exact: true })
    await expect(confirm).toBeEnabled()
    await confirm.click()
    // Observe terminal transport or native uncertainty; never resend a mutation.
    await expect.poll(async () => {
      if (observed.failure) return "request-failed"
      if (observed.response) return "response"
      observed.unknown = await review.evaluateAll((reviews) => reviews.some((element) => element.getAttribute("data-state") === "outcome-unknown"))
      return observed.unknown ? "outcome-unknown" : "pending"
    }, { message: `Planner ${intent.page}/${action} must produce a response or an explicit transport/UI outcome`, timeout: 15_000 }).not.toBe("pending")
    if (observed.failure || observed.unknown) {
      observations.push({ stage: "planner-command-unconfirmed", ...intent, outcome: observed.failure ? "request-failed" : "outcome-unknown", retried: false })
      // Preserve the terminal failure. Read only the original admission URL
      // already requested by this browser, without publishing owner selectors.
      try {
        const destination = new URL(page.url())
        const f01 = await page.locator('[data-sf-host="owner-runtime231"]').evaluateAll((elements) => elements.map((element) => ({
          discovery: element.getAttribute("data-sf-discovery-state"), provider: element.getAttribute("data-sf-provider-state"),
          reason: element.getAttribute("data-sf-provider-reason"), view: element.getAttribute("data-sf-view-state"),
        })))
        observations.push({ stage: "planner-terminal-route", path: destination.pathname,
          queryKeys: [...destination.searchParams.keys()].sort(), year: destination.searchParams.get("year"),
          ownerTriplet: ["server", "project", "installation"].every((key) => destination.searchParams.getAll(key).length === 1 && !!destination.searchParams.get(key)),
          f01, count: observed.count,
        })
        if (observed.response) observations.push({ stage: "planner-terminal-response",
          originalOk: asRecord(observedReportResponse(observed.response)).ok === true })
        if (contextReadUrl) {
          const original = await page.request.get(contextReadUrl)
          const context = Schema.decodeUnknownSync(SfContextResult)(await original.json())
          observations.push({ stage: "planner-terminal-context", httpStatus: original.status(), status: context.status,
            ...(context.status === "ok" ? {
              destinations: context.value.destinations.filter((item) => item.capabilityId === capability)
                .map(({ capabilityId, canRead, allowedActionIds }) => ({ capabilityId, canRead, allowedActionIds })),
              availability: context.value.availability.filter((item) => item.resource === capability),
            } : {}),
          })
        }
      } catch { observations.push({ stage: "planner-terminal-diagnostic-unavailable" }) }
      throw new Error(`Planner ${intent.page}/${action} was not confirmed (${observed.failure ?? "UI outcome unknown"}); the command was not resent.`)
    }
    expect(observed.count, "One native confirmation must submit exactly once").toBe(1)
    const response = observed.response!
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/json")
    const body = asRecord(observedReportResponse(response))
    expect(body.ok).toBe(true)
    await expect(review).toHaveCount(0)
    observations.push({ stage: "planner-command", action, httpStatus: response.status() })
    if (capability === "CAP23" && (action === "copy" || action === "save" && !record)) {
      // The application deliberately returns only ok/warnings. Preserve the
      // producer's identity through the original authorized read and row action.
      const beforeIds = records(data.versions).map((entry) => {
        expect(typeof entry.id).toBe("string")
        return String(entry.id)
      })
      const refreshed = await page.request.get(origin + "/sucafina/api/ui/pages/CAP23" + (query.size ? "?" + query : ""))
      expect(refreshed.status()).toBe(200)
      const readback = Schema.decodeUnknownSync(SfPlanner.operations["domain.page.CAP23"].output)(await refreshed.json())
      if (readback.status !== "ok") throw new Error("The saved Planner versions were unavailable")
      expect(readback.value.data.versions).toHaveLength(beforeIds.length + 1)
      const added = readback.value.data.versions.filter((entry) => !beforeIds.includes(entry.id))
      expect(added).toHaveLength(1)
      const createdVersion = added[0]!
      expect(createdVersion.id).toMatch(/\S+/)
      expect(createdVersion.name).toMatch(/\S+/)
      expect(Number.isInteger(createdVersion.year) && createdVersion.year > 2000 && createdVersion.year < 2100).toBe(true)
      await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions")
      const row = page.locator('tr[data-sf-row="' + createdVersion.id + '"]')
      await expect(row).toHaveCount(1)
      await expect(row).toContainText(createdVersion.name)
      await expect(row).toContainText(String(createdVersion.year))
      await row.locator('button[data-sf-action="select"]').click()
      await expect(page).toHaveURL((current) => current.pathname === "/orchestra/sf-planner/versions/" + encodeSfRouteRef(createdVersion.id))
      await expect(page.locator("#sf-u46-name")).toHaveValue(createdVersion.name)
      await expect(page.locator("#sf-u46-year")).toHaveValue(String(createdVersion.year))
      observations.push({ stage: "planner-authorized-created-record", action, id: createdVersion.id, year: createdVersion.year })
      return { response: body, createdVersion }
    }
    return { response: body }
  } finally {
    page.off("request", onRequest)
    page.off("response", onResponse)
    page.off("requestfailed", onFailed)
  }
}

async function readControls(page: Page, origin: string, reference: string, source?: string) {
  const response = await page.request.get(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "decision-controls", case: reference, format: "json", ...(source ? { source } : {}) })}`)
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const body = asRecord(await response.json())
  expect(body.status).toBe("ok")
  return asRecord(body.value)
}

async function command(page: Page, origin: string, mode: string, payload: object, observations: Record<string, unknown>[]) {
  const response = await page.request.post(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: mode })}`, {
    headers: { origin, "idempotency-key": randomUUID() }, data: payload,
  })
  expect(response.headers()["content-type"], mode).toContain("application/json")
  const body = asRecord(await response.json())
  observations.push({ stage: "installed-command", mode, httpStatus: response.status(), status: body.status, reason: body.reason })
  expect(response.status(), `${mode}: ${String(body.reason ?? body.status)}`).toBe(200)
  expect(body.status, mode).toBe("ok")
  return asRecord(body.value)
}

function readCaseRef(value: unknown): CaseRef {
  const ref = asRecord(value)
  expect(typeof ref.id).toBe("string")
  expect(typeof ref.incarnation).toBe("string")
  expect(Number.isSafeInteger(ref.version)).toBe(true)
  return ref as CaseRef
}

export function records(value: unknown): Record<string, unknown>[] {
  expect(Array.isArray(value)).toBe(true)
  return (value as unknown[]).map(asRecord)
}
