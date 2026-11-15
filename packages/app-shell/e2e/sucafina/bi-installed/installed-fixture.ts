import { expect, type Locator, type Page, type Request, type Response } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { asRecord, caseIdentity, clickCommand, enterWorkbench, fillDecision } from "../decisions-support/journey"

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
 * grant, provider, response, route handler or installation store is replaced.
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
  const create = await fillDecision(page, caseObjective)
  await create.getByLabel("Criteria, one per line", { exact: true }).fill(criterion)
  const created = await clickCommand(page, create.getByRole("button", { name: "Create decision", exact: true }), "workbench-command", observations)
  expect(typeof created.outputRef).toBe("string")
  const caseSelector = created.outputRef as string
  const identity = caseIdentity(caseSelector)
  await expect(page.getByRole("region", { name: "Decision", exact: true }).getByRole("heading", { name: caseObjective, exact: true })).toBeVisible()

  await page.getByText("Edit decision", { exact: true }).click()
  const edit = page.locator("form[data-decision-edit]")
  await expect(edit).toHaveAttribute("data-sf-edit-ready", "true")
  await edit.getByRole("button", { name: "Find Planner sources", exact: true }).click()
  const sourceChoice = edit.getByLabel("Planner source", { exact: true })
  for (const [index, plan] of Object.values(plans).entries()) {
    const option = sourceChoice.getByRole("option").filter({ hasText: plan.id })
    await expect(option).toHaveCount(1)
    await sourceChoice.selectOption({ label: (await option.textContent())!.trim() })
    await edit.getByRole("button", { name: "Inspect selected source", exact: true }).click()
    await expect(edit.locator("[data-source-preview]")).toHaveAttribute("data-state", "ready")
    await expect(edit.locator("[data-source-preview]")).toContainText(plan.name)
    await expect(edit.locator("[data-source-preview]")).toContainText("USD")
    await edit.getByRole("button", { name: "Attach source to draft", exact: true }).click()
    await expect(edit.locator("[data-decision-sources] > li")).toHaveCount(index + 1)
  }
  const attached = await clickCommand(page, edit.getByRole("button", { name: "Save decision", exact: true }), "decision-edit", observations)
  let caseRef = readCaseRef(asRecord(attached.value).caseRef)
  expect(caseRef).toEqual({ ...identity, version: 2 })

  const controls = await readControls(page, installation.origin, caseSelector)
  const selected = asRecord(controls.selected)
  const decision = asRecord(selected.decision)
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
  const url = (name: string, version?: string) => `${installation.origin}/sucafina/planner?${new URLSearchParams({ page: name, ...(version ? { version } : {}) })}`
  const versionRow = (id: string) => page.getByRole("row").filter({ has: page.locator(`form[data-page="Versions"][data-command="save"][data-record="${id}"]`) })
  const manager = page.getByRole("dialog", { name: "Manage record", exact: true })
  await page.goto(url("Versions"))
  await plannerCommand(page, page.getByRole("button", { name: "Create first version", exact: true }), "save", observations)
  const first = page.locator('form[data-page="Versions"][data-command="save"]:not([data-record=""])')
  await expect(first).toHaveCount(1)
  const baseline: Plan = { id: (await first.getAttribute("data-record"))!, name: names.baseline, lines: {} }
  await versionRow(baseline.id).getByRole("button", { name: "Manage", exact: true }).click()
  await manager.getByLabel("Name", { exact: true }).fill(baseline.name)
  await manager.getByLabel("Year", { exact: true }).fill("2027")
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  await page.goto(url("OPEX", baseline.id))
  baseline.lines.renewal = await addLine(page, lineNames.renewal, 240000, installation.actorId, observations)
  baseline.lines.zero = await addLine(page, lineNames.zero, 0, installation.actorId, observations)
  await explicitForecast(page, installation.origin, { [lineNames.renewal]: 240000, [lineNames.zero]: 0 })

  const copy = async (source: Plan, name: string): Promise<Plan> => {
    await page.goto(url("Versions"))
    await versionRow(source.id).getByRole("button", { name: "Manage", exact: true }).click()
    await plannerCommand(page, manager.getByRole("button", { name: "copy", exact: true }), "copy", observations)
    const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: `${source.name} — Copy`, exact: true }) })
    await expect(row).toHaveCount(1)
    const id = (await row.locator('form[data-page="Versions"][data-command="save"]').getAttribute("data-record"))!
    expect(id).not.toBe(source.id)
    await row.getByRole("button", { name: "Manage", exact: true }).click()
    await manager.getByLabel("Name", { exact: true }).fill(name)
    await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
    await page.goto(url("OPEX", id))
    return { id, name, lines: {} }
  }
  const missing = await copy(baseline, names.missing)
  const renewal = page.getByRole("row").filter({ has: page.getByRole("cell", { name: lineNames.renewal, exact: true }) })
  await renewal.getByRole("button", { name: "Manage", exact: true }).click()
  await manager.getByLabel("Name", { exact: true }).fill(lineNames.bridge)
  await manager.getByLabel("Annual budget", { exact: true }).fill("60000")
  await plannerCommand(page, manager.getByRole("button", { name: "Save", exact: true }), "save", observations)
  missing.lines.bridge = await lineId(page, lineNames.bridge)
  missing.lines.zero = await lineId(page, lineNames.zero)
  missing.lines.implementation = await addLine(page, lineNames.implementation, 45000, installation.actorId, observations)
  missing.lines.service = await addLine(page, lineNames.service, 105000, installation.actorId, observations)
  await explicitForecast(page, installation.origin, { [lineNames.bridge]: 60000, [lineNames.implementation]: 45000, [lineNames.service]: 105000, [lineNames.zero]: 0 })

  const resolved = await copy(missing, names.resolved)
  for (const key of ["bridge", "zero", "implementation", "service"] as const) resolved.lines[key] = await lineId(page, lineNames[key])
  resolved.lines.training = await addLine(page, lineNames.training, 0, installation.actorId, observations)
  await explicitForecast(page, installation.origin, { [lineNames.bridge]: 60000, [lineNames.implementation]: 45000, [lineNames.service]: 105000, [lineNames.zero]: 0, [lineNames.training]: 40000 })
  observations.push({ stage: "planner-inputs-saved-through-ui", horizon, currency: "USD", plans: { baseline, missing, resolved },
    declaredAmounts: { renewal: 240000, bridge: 60000, implementationIncludingMigration: 45000, newService: 105000, trainingNovember: 40000, otherQuotedCharges: 0 } })
  return { baseline, missing, resolved }
}

/** Declare every monthly forecast, including zeros. A budget inherited through
 * a null forecast is estimated and cannot establish complete cost coverage.
 * Clipboard paste is the existing human bulk-edit interaction, not DOM mutation.
 */
async function explicitForecast(page: Page, origin: string, amounts: Record<string, number>) {
  const monthly = page.locator("section").filter({ has: page.getByRole("heading", { name: "Edit monthly values together", exact: true }) })
  await expect(monthly).toHaveCount(1)
  await monthly.getByRole("combobox", { name: "Measure", exact: true }).selectOption("forecast")
  const labels = (await monthly.getByRole("rowheader").allTextContents()).map((label) => label.trim())
  expect(labels.slice().sort()).toEqual(Object.keys(amounts).map((name) => `licenses · ${name}`).sort())
  const matrix = labels.map((label) => Array.from({ length: 12 }, (_, month) => month === 10 ? amounts[label.slice("licenses · ".length)] : 0))
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], { origin })
  await page.evaluate((text) => navigator.clipboard.writeText(text), matrix.map((row) => row.join("\t")).join("\n"))
  await monthly.getByRole("textbox", { name: `${labels[0]} forecast month 1`, exact: true }).focus()
  await page.keyboard.press("Control+V")
  for (const [index, label] of labels.entries()) {
    await expect(monthly.getByRole("textbox", { name: `${label} forecast month 1`, exact: true })).toHaveValue("0")
    await expect(monthly.getByRole("textbox", { name: `${label} forecast month 11`, exact: true })).toHaveValue(String(matrix[index]![10]))
    await expect(monthly.getByRole("textbox", { name: `${label} forecast month 12`, exact: true })).toHaveValue("0")
  }
  for (const [label, action] of [["Preview changes", "preview"], ["Save changes", "apply"]] as const) {
    const pending = page.waitForResponse((response) => response.request().method() === "POST" && new URL(response.url()).searchParams.get("sf") === "workbench-planner" && response.request().postDataJSON()?.action === action)
    await monthly.getByRole("button", { name: label, exact: true }).click()
    const response = await pending
    expect(response.status()).toBe(200)
    const result = asRecord(await response.json())
    expect(result.status).toBe("ok")
    const rows = records(asRecord(result.value).rows)
    expect(rows).toHaveLength(labels.length)
    if (action === "apply") for (const row of rows) {
      expect(row.errors).toEqual([])
      expect(asRecord(row.result).ok).toBe(true)
    }
    await expect(monthly.getByRole("status")).toContainText(action === "preview" ? "Preview complete" : "Changes saved")
  }
  await page.reload()
  await monthly.getByRole("combobox", { name: "Measure", exact: true }).selectOption("forecast")
  for (const [index, label] of labels.entries()) for (let month = 1; month <= 12; month++)
    await expect(monthly.getByRole("textbox", { name: `${label} forecast month ${month}`, exact: true })).toHaveValue(String(matrix[index]![month - 1]))
}

async function lineId(page: Page, name: string) {
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) })
  await expect(row).toHaveCount(1)
  const form = row.locator('form[data-page="OPEX"][data-command="save"]').filter({ has: page.getByLabel("Name", { exact: true }) })
  await expect(form).toHaveCount(1)
  await expect(form).toHaveAttribute("data-record", /\S+/)
  return (await form.getAttribute("data-record"))!
}

async function addLine(page: Page, name: string, amount: number, actorId: string, observations: Record<string, unknown>[]) {
  const form = page.locator('form[data-page="OPEX"][data-command="save"][data-record=""]').filter({ has: page.getByLabel("Name", { exact: true }) })
  await expect(form).toHaveCount(1)
  await form.getByLabel("Name", { exact: true }).fill(name)
  await form.getByLabel("Owner", { exact: true }).selectOption(actorId)
  await form.getByLabel("Element", { exact: true }).selectOption("licenses")
  await expect(form.getByLabel("Currency", { exact: true })).toHaveValue("USD")
  await form.getByLabel("Annual budget", { exact: true }).fill(String(amount))
  await plannerCommand(page, form.getByRole("button", { name: "Save", exact: true }), "save", observations)
  return lineId(page, name)
}

async function plannerCommand(page: Page, button: Locator, action: string, observations: Record<string, unknown>[]) {
  await expect(button).toBeEnabled()
  const intent = await button.evaluate((element) => {
    const form = element.closest<HTMLFormElement>("form[data-command]")
    if (!form) throw new Error("Planner command form is unavailable")
    return { page: form.dataset.page, action: form.dataset.command, record: form.dataset.record ?? "", version: form.dataset.version }
  })
  expect(intent.action).toBe(action)
  // runtime/ui.form always supplies data-version; screen-shell serializes its
  // numeric value. An absent token is not an equivalent command or safe replay.
  expect(intent.version, "Planner command form must expose its canonical version token").toMatch(/^(0|[1-9]\d*)$/)
  expect(Number.isSafeInteger(Number(intent.version))).toBe(true)
  const observed: { response?: Response; failure?: string; unknown: boolean } = { unknown: false }
  const matches = (request: Request) => {
    if (request.method() !== "POST" || new URL(request.url()).pathname !== "/sucafina/planner") return false
    try {
      const payload: unknown = request.postDataJSON()
      if (!payload || typeof payload !== "object" || Array.isArray(payload)) return false
      const body = payload as Record<string, unknown>
      return body.action === action && body.page === intent.page && (body.id ?? "") === intent.record &&
        typeof body.version === "number" && String(body.version) === intent.version
    } catch { return false }
  }
  const onResponse = (response: Response) => {
    if (!matches(response.request())) return
    observed.response = response
    observations.push({ stage: "planner-command-response", ...intent, httpStatus: response.status(), contentType: response.headers()["content-type"] ?? null })
  }
  const onFailed = (request: Request) => {
    if (!matches(request)) return
    observed.failure = request.failure()?.errorText ?? "request-failed"
    observations.push({ stage: "planner-command-request-failed", ...intent, failure: observed.failure })
  }
  page.on("response", onResponse)
  page.on("requestfailed", onFailed)
  try {
    await button.click()
    // R4 proved that the shell can abort this request at 10s without receiving
    // headers. A response-only wait would then consume the entire 180s test.
    // Observe the real terminal network/UI state; never retry this mutation.
    await expect.poll(async () => {
      if (observed.failure) return "request-failed"
      if (observed.response) return "response"
      observed.unknown = await page.locator("form[data-command]").evaluateAll((forms, expected) => forms.some((element) => {
        const form = element as HTMLFormElement
        return form.dataset.page === expected.page && form.dataset.command === expected.action &&
          (form.dataset.record ?? "") === expected.record && form.dataset.version === expected.version && form.dataset.resultUncertain === "true"
      }), intent)
      return observed.unknown ? "outcome-unknown" : "pending"
    }, { message: `Planner ${intent.page}/${action} must produce a response or an explicit transport/UI outcome`, timeout: 15_000 }).not.toBe("pending")
    if (observed.failure || observed.unknown) {
      observations.push({ stage: "planner-command-unconfirmed", ...intent, outcome: observed.failure ? "request-failed" : "outcome-unknown", retried: false })
      throw new Error(`Planner ${intent.page}/${action} was not confirmed (${observed.failure ?? "UI outcome unknown"}); the command was not resent.`)
    }
    const response = observed.response!
    expect(response.status()).toBe(200)
    expect(response.headers()["content-type"]).toContain("application/json")
    expect(asRecord(await response.json()).ok).toBe(true)
    observations.push({ stage: "planner-command", action, httpStatus: response.status() })
  } finally {
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
