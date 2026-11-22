import { expect, test, type Locator } from "@playwright/test"
import { withDesignInstallation } from "./design-support/installation"
import { authenticateRecordingInstallation } from "./design-support/recording-installation"
import { createFilm, type Film } from "./design-support/film-support"
import { waveThreeData } from "./design-support/wave-three-data"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"

test.use({ trace: "off", video: "off", screenshot: "off" })
test.describe.configure({ retries: 0 })

type CaseSource = {
  id: string; incarnation: string; version: number; objective: string
  alternatives: { title: string; result: { knownSubtotal: number | null; comparisonStatus: string; sourceRefs: { refId: string }[] } }[]
  assumptions: { state: string }[]; choices: unknown[]; preparedChanges: unknown[]; receipts: unknown[]
}
const object = (value: unknown): Record<string, unknown> => value !== null && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : {}

test("record original Today, native chapters and source-bound decision review", async ({ browser }, info) => {
  test.setTimeout(1_800_000)
  expect(info.project.metadata.bundle).toBe("production")
  await withDesignInstallation(async (installed) => {
    const context = await browser.newContext({ locale: "en-US", viewport: { width: 1920, height: 1080 },
      deviceScaleFactor: 1, colorScheme: "dark", reducedMotion: "no-preference",
      httpCredentials: { username: "orchestra", password: installed.serverPassword },
      recordVideo: { dir: info.outputPath("continuous-video"), size: { width: 1920, height: 1080 } } })
    try {
      const owner = await authenticateRecordingInstallation(context, installed, async (value) => {
        await info.attach("native-discovery-" + value.selector, { body: JSON.stringify(value), contentType: "application/json" })
      })
      const film = await createFilm(context, info, installed, owner, "A-native-decisions")
      try { await nativeChapters(film) } finally { await film.finish() }
      expect(film.missingCritical(), "the real opening and authorized decision sources must be readable").toEqual([])
    } finally { await context.close() }
  }, "four-decisions")
})

async function nativeChapters(film: Film) {
  const page = film.page
  const data = waveFourDecisionsData
  const state: { href?: string; caseRef?: string; source?: CaseSource; analysisModels?: number;
    analysisChoices?: number; preparedAnalysis?: boolean; routineRecipes?: string[] } = {}
  const h1 = () => page.locator('[data-sf-host="owner-runtime231"]').getByRole("heading", { level: 1 })
  const observedOptions = (locator: Locator) => locator.locator("option").evaluateAll((items) => items.map((item) => ({
    label: item.textContent?.trim() ?? "", value: (item as HTMLOptionElement).value,
  })))
  const sourceRead = async () => {
    if (!state.caseRef) throw new Error("No original authorized case reference has been observed")
    const response = await page.request.get(film.installed.origin + film.installed.mount + "/api/ui/projections/case", {
      params: { caseRef: state.caseRef }, timeout: 60_000,
    })
    expect(response.status()).toBe(200)
    const body = object(await response.json())
    expect(body.status).toBe("ok")
    const current = object(object(body.value).projection).case as CaseSource
    expect(current.objective).toBe(data.objective)
    expect(typeof current.id).toBe("string")
    expect(typeof current.incarnation).toBe("string")
    expect(Number.isSafeInteger(current.version) && current.version > 0).toBe(true)
    state.source = current
    film.proof({ kind: "original-authorized-case-read", source: "projection.case", httpStatus: response.status(),
      caseRef: state.caseRef, id: current.id, incarnation: current.incarnation, version: current.version,
      objective: current.objective, alternatives: current.alternatives.map((item) => ({ title: item.title,
        knownSubtotal: item.result.knownSubtotal, comparisonStatus: item.result.comparisonStatus })),
      assumptionStates: current.assumptions.map((item) => item.state), choices: current.choices.length,
      preparedChanges: current.preparedChanges.length, receipts: current.receipts.length,
      installationExample: "A" })
    return current
  }
  const openCase = async () => {
    await film.go("/orchestra/sf-decisions", "Decisions")
    const list = page.getByRole("region", { name: "Authorized decision cases", exact: true })
    const link = list.getByRole("listitem").filter({ hasText: data.objective })
      .getByRole("link", { name: "Open decision", exact: true })
    await expect(link).toHaveCount(1)
    const href = await link.getAttribute("href")
    if (!href) throw new Error("The original authorized case omitted its link")
    const target = new URL(href, film.installed.origin)
    if (target.origin !== film.installed.origin) throw new Error("The authorized case link has an unexpected origin")
    state.href = target.href
    await film.click(link, "Open the original regional operating-plan decision")
    await film.nativeReady("Case summary")
    const root = page.locator('[data-sf-decision="UI34"]')
    await expect(root.locator(".sf-decision-brief")).toBeVisible()
    const caseRef = await root.getAttribute("data-sf-case-ref")
    if (!caseRef || !/^case:[^:]+:[^:]+$/.test(caseRef)) throw new Error("The native case omitted its original source reference")
    state.caseRef = caseRef
    await sourceRead()
  }
  const caseRoute = async (suffix: string, title: string) => {
    if (!state.href) await openCase()
    const target = new URL(state.href!)
    // This registered subroute retains the exact opaque reference and owner
    // query from the observed UI33 link. No test-generated case ID or codec.
    target.pathname += suffix
    await film.go(target.href, title)
  }

  await film.cue("01-welcome", async () => {
    await film.go("/orchestra/sf-home", "Today")
    await dark(film)
    await film.focus(h1(), "Today / actual Sucafina application")
    const attention = page.locator(".sf-today-attention")
    await expect(attention).toBeVisible()
    await film.focus(attention.getByRole("heading", { name: "Needs attention", exact: true }), "Needs attention / source-backed priorities")
    await expect(page.locator(".sf-today-resume")).toContainText(data.objective)
    film.proof({ kind: "actual-native-opening", installationExample: "A", data: "original demonstration producers",
      topic: film.installed.topicName, caseObjective: data.objective,
      routineActivity: await page.locator('[data-sf-frame="page"]').innerText().then((text) =>
        text.includes("Routine activity cannot be confirmed.") ? "cannot-be-confirmed" : "read-visible-state") })
  }, true)

  await film.cue("02-context", async () => {
    await film.go("/orchestra/sf-home/context", "Context and access")
    await film.focus(h1(), "Context and access / original installation")
    film.proof({ kind: "original-context", owner: { projectId: film.owner.projectId, installationId: film.owner.installationId,
      hostId: film.owner.hostId }, authority: "unchanged original enrollment and session guards" })
    await film.snap("02-context-selected")
    await film.pause(3500)
    await film.go("/orchestra/sf-home", "Today")
    const resume = page.locator('[data-sf-case-row="authorized"]').filter({ hasText: data.objective })
    await expect(resume).toHaveCount(1)
    await film.focus(resume, "Resume / original regional operating-plan case")
    await film.pause(2000)
    await film.click(resume.locator('[data-sf-resume-case="authorized"]'), "Resume the authorized decision")
    await film.nativeReady("Case summary")
    await expect(page.locator(".sf-decision-brief")).toContainText(data.objective)
    film.proof({ kind: "actual-resume-navigation", objective: data.objective, nativePath: new URL(page.url()).pathname })
  }, true)

  await film.cue("14-executive-budget", async () => {
    await film.go("/orchestra/sf-dashboard/executive?year=" + film.installed.year, "Executive Dashboard")
    await film.focus(h1(), "Executive dashboard / selected financial context")
    await film.snap("14-executive-overview")
    await film.pause(4000)
    await film.go("/orchestra/sf-dashboard/budget?year=" + film.installed.year)
    await film.focus(h1(), "Budget / original financial source")
    await film.pause(2500)
    await film.go("/orchestra/sf-dashboard/capex?year=" + film.installed.year, "CAPEX Projects")
    const row = page.locator(".sf-budget-owners tr[data-sf-row]").filter({ hasText: waveThreeData.capex.primary })
    await expect(row).toHaveCount(1)
    await film.click(row.getByRole("button", { name: "Open record", exact: true }), "Open the original capital investment")
    const detail = page.locator("[data-sf-capex-detail]")
    await expect(detail.getByRole("heading", { name: waveThreeData.capex.primary, exact: true })).toBeVisible()
    await expect(detail.locator("tr[data-sf-month]")).toHaveCount(12)
    await film.focus(detail.getByRole("heading", { name: waveThreeData.capex.primary, exact: true }), "Capital investment / twelve source months")
    film.proof({ kind: "financial-source-detail", name: waveThreeData.capex.primary, year: film.installed.year,
      observedMonths: await detail.locator("tr[data-sf-month]").count(), wholeYearTotalClaimed: false })
  })

  await film.cue("15-people-operations", async () => {
    await film.go("/orchestra/sf-people/overview", "Headcount Overview")
    await film.focus(page.locator('[data-sf-metrics="headcount"]'), "People / reported headcount")
    await film.pause(2500)
    await film.go("/orchestra/sf-people/structure", "Team Structure")
    const people = page.locator('[data-sf-surface="CAP07"]')
    await film.click(people.getByRole("button", { name: waveThreeData.people.leader, exact: true }), "Open the actual regional team leader")
    await expect(people.locator('[data-sf-selection="details"]')).toContainText(waveThreeData.people.leader)
    await film.snap("15-team-source")
    await film.pause(3500)
    await film.go("/orchestra/sf-operations/service?year=" + film.installed.year + "&month=" + film.installed.month, "IT Operations")
    const service = page.locator('[data-sf-surface="CAP11"]')
    await expect(service.getByLabel("Year", { exact: true })).toHaveValue(String(film.installed.year))
    await expect(service.getByLabel("Month", { exact: true })).toHaveValue(String(film.installed.month))
    await expect(service.locator(".sf-ops-metrics")).toContainText("98.4")
    await film.focus(service.locator(".sf-ops-metrics"), "Selected month / original service levels")
    film.proof({ kind: "people-and-operations", leader: waveThreeData.people.leader, year: film.installed.year,
      month: film.installed.month, serviceMetrics: await service.locator(".sf-ops-metrics").innerText() })
  })

  await film.cue("16-portfolio-bi", async () => {
    await film.go("/orchestra/sf-portfolio/overview", "Portfolio Dashboard")
    await film.focus(h1(), "Portfolio / source project commitments")
    await film.pause(2500)
    await film.go("/orchestra/sf-portfolio/projects", "All Projects")
    const surface = page.locator('[data-sf-surface="CAP10"]')
    const row = surface.locator("tr[data-sf-row]").filter({ hasText: waveThreeData.projects.primary })
    await expect(row).toHaveCount(1)
    await film.click(row.locator('[data-sf-action="select"]'), "Open the original regional delivery programme")
    const detail = surface.locator("[data-sf-record-detail]")
    await expect(detail).toContainText(waveThreeData.projects.primary)
    await film.focus(detail.getByRole("heading", { name: waveThreeData.projects.primary, exact: true }), "Project / recorded dates, budget and milestones")
    await film.snap("16-project-detail")
    await film.pause(3500)
    await film.go("/orchestra/sf-bi", "Analytics")
    const catalog = page.locator(".sf-bi-catalog")
    const views = catalog.getByLabel("Analysis view", { exact: true })
    await expect(views.locator('option[value="BI08"]')).toHaveText("Which milestones are planned or completed?")
    await film.select(views, { value: "BI08" }, "Analytics / original planned and completed milestones question")
    await film.input(catalog.getByLabel("Start date", { exact: true }), film.installed.year + "-01-01", "Set the demonstration reporting period start")
    await film.input(catalog.getByLabel("End date", { exact: true }), film.installed.year + "-12-31", "Set the demonstration reporting period end")
    await film.click(catalog.getByRole("button", { name: "Choose context", exact: true }), "Read the original authorized analysis selections")
    await film.nativeReady("Analytics")
    const selection = catalog.getByLabel("Selection", { exact: true })
    const choices = await selection.count() ? (await observedOptions(selection)).filter((item) => item.value) : []
    const exactProject = choices.filter((item) => item.label.includes(waveThreeData.projects.primary))
    if (exactProject.length === 1)
      await film.select(selection, { value: exactProject[0]!.value }, "Use the producer-returned regional project selection")
    film.proof({ kind: "actual-analytics-catalog", view: "BI08", period: { start: film.installed.year + "-01-01", end: film.installed.year + "-12-31" },
      actualChoices: choices, selected: exactProject.length === 1 ? exactProject[0] : null })
    const preview = catalog.getByRole("button", { name: "View data", exact: true })
    if (await preview.count() === 1 && await preview.isEnabled()) {
      await film.click(preview, "Read actual source-backed milestone data")
      await film.nativeReady("Analytics")
      const figure = catalog.locator('[data-sf-bi-view="BI08"]')
      if (await figure.isVisible()) {
        await film.focus(figure, "Actual milestone projection / original source evidence")
        const milestone = figure.locator("[data-sf-milestone]").filter({ hasText: waveThreeData.projects.milestone })
        const sourceAction = milestone.getByRole("button", { name: "Open original source", exact: true })
        if (await sourceAction.count() === 1 && await sourceAction.isEnabled()) {
          await film.click(sourceAction, "Resolve the original milestone source")
          await film.nativeReady("Analytics")
        }
      }
    }
    film.proof({ kind: "actual-analytics-readback", visibleState: (await catalog.innerText()).slice(0, 9000) })
  })

  await film.cue("17-decision-case", async () => {
    await openCase()
    expect(state.source!.alternatives).toHaveLength(2)
    expect(state.source!.assumptions).toHaveLength(2)
    expect(state.source!.choices).toHaveLength(1)
    expect(state.source!.preparedChanges).toHaveLength(0)
    expect(state.source!.receipts).toHaveLength(0)
    await film.focus(page.locator(".sf-decision-brief"), "Authorized decision / objective, scope and criteria")
  }, true)

  await film.cue("18-assumptions-options", async () => {
    await caseRoute("/assumptions", "Assumptions")
    const assumptions = page.getByRole("region", { name: "Assumption", exact: true })
    await film.select(assumptions.getByRole("combobox", { name: "State", exact: true }), { value: "open" }, "Filter actual open assumptions")
    const item = assumptions.getByRole("listitem").filter({ hasText: data.assumption })
    await expect(item).toHaveCount(1)
    await film.click(item.getByRole("button", { name: "Review assumption", exact: true }), "Read the regional service assumption")
    const assumption = page.locator("#sf-n24-assumption-detail")
    await expect(assumption).toContainText(data.assumption)
    await film.focus(assumption, "Open assumption / original evidence")
    await film.snap("18-open-assumption")
    await film.pause(3500)
    await caseRoute("/alternatives", "Alternatives")
    const board = page.locator(".sf-decision-compare-board")
    await expect(board.locator("article")).toHaveCount(2)
    for (const alternative of state.source!.alternatives) {
      const card = board.locator("article").filter({ has: page.getByRole("heading", { name: alternative.title, exact: true }) })
      await expect(card).toHaveCount(1)
      await expect(card.locator(".sf-decision-amount")).toContainText(String(alternative.result.knownSubtotal))
      await film.click(card.getByRole("button", { name: "Select for comparison", exact: true }), "Select observed alternative / " + alternative.title)
    }
    await film.click(page.getByRole("button", { name: "Compare alternatives", exact: true }), "Compare the two original alternatives")
    await expect(board).toHaveAttribute("data-sf-comparing", "true")
    const qualification = page.getByText("A complete numerical comparison is not authorized for these bases, periods or currencies.", { exact: true })
    await expect(qualification).toBeVisible()
    await film.focus(qualification, "Known figures retain their comparison limitation")
    const baseline = board.locator("article").filter({ has: page.getByRole("heading", { name: data.plannerBaseline, exact: true }) })
    await film.click(baseline.locator("summary").filter({ hasText: "Evidence sources" }), "Inspect the baseline source reference")
    await expect(baseline).toContainText(state.source!.alternatives.find((item) => item.title === data.plannerBaseline)!.result.sourceRefs[0]!.refId)
    film.proof({ kind: "actual-alternative-comparison", comparisonStatus: "conditioned", completeComparisonClaimed: false,
      assumptionConfirmed: false, titles: state.source!.alternatives.map((item) => item.title) })
  }, true)

  await film.cue("19-analysis-input", async () => {
    await caseRoute("/analyses", "Analysis")
    const cases = page.getByRole("combobox", { name: "Authorized case", exact: true })
    const analyses = page.getByRole("combobox", { name: "Analysis type", exact: true })
    const models = page.getByRole("combobox", { name: "Admitted model", exact: true })
    await film.focus(cases, "Analysis / original authorized case")
    const actualAnalyses = (await observedOptions(analyses)).filter((item) => item.value)
    const actualModels = (await observedOptions(models)).filter((item) => item.value)
    state.analysisChoices = actualAnalyses.length
    state.analysisModels = actualModels.length
    const method = actualAnalyses.find((item) => /sf-enquadrar-decisao/.test(item.value + " " + item.label))
    if (method) await film.select(analyses, { value: method.value }, "Choose the published decision-framing method")
    await film.input(page.getByLabel("Analysis objective", { exact: true }), data.objective, "Enter the demonstration analysis objective", true)
    await film.focus(models, "Admitted model / current producer choices")
    film.proof({ kind: "actual-analysis-choices", cases: await observedOptions(cases), analyses: actualAnalyses,
      models: actualModels, objective: data.objective, started: false })
    const prepare = page.getByRole("button", { name: "Prepare analysis", exact: true })
    if (method && actualModels.length === 1) {
      await film.select(models, { value: actualModels[0]!.value }, "Select the sole admitted model")
      if (await prepare.isEnabled()) {
        await film.click(prepare, "Prepare actual analysis input for review")
        const review = page.locator("[data-sf-analysis-review]")
        await expect(review).toBeVisible({ timeout: 60_000 })
        await expect(review).toContainText(data.objective)
        await film.focus(review, "Prepared input / no analysis started")
        state.preparedAnalysis = true
        film.proof({ kind: "actual-analysis-preparation", prepared: true, started: false })
      }
    }
    if (actualAnalyses.length && !actualModels.length)
      await expect(page.getByText("No admitted model is available.", { exact: true })).toBeVisible()
    if (!actualAnalyses.length)
      await expect(page.getByText("No admitted analysis option is available.", { exact: true })).toBeVisible()
  })

  await film.cue("20-analysis-result", async () => {
    if (!new URL(page.url()).pathname.endsWith("/analyses")) await caseRoute("/analyses", "Analysis")
    if (state.preparedAnalysis) await film.click(page.locator("[data-sf-analysis-review]").getByRole("button", {
      name: "Return to history", exact: true,
    }), "Return to actual analysis history without starting a run")
    const history = page.getByRole("heading", { name: "Analysis history", exact: true })
    await film.focus(history, "Analysis history / actual recorded state")
    const empty = page.getByText("No analyses were recorded for this authorized case.", { exact: true })
    await expect(empty).toBeVisible()
    film.proof({ kind: "actual-analysis-history", analysisRunsRecorded: 0, successfulRunClaimed: false,
      modelChoices: state.analysisModels ?? null, inputPrepared: state.preparedAnalysis === true })
    await film.snap("20-actual-analysis-history")
    await film.pause(3500)
    await caseRoute("/choice", "Current choice")
    const choice = page.locator("[data-choice-id]")
    await expect(choice).toHaveCount(1)
    await expect(choice).toContainText(data.plannerCandidate)
    await film.focus(choice, "Recorded business choice / separate human rationale")
    film.proof({ kind: "recorded-business-choice", selectedAlternative: data.plannerCandidate,
      source: "original decision seed", generatedByThisAnalysis: false, changedDuringCapture: false })
  })

  await film.cue("37-memory", async () => {
    if (!state.caseRef) await openCase()
    const current = await sourceRead()
    await film.go("/orchestra/sf-memory/signals", "Signals")
    await film.input(page.getByLabel("Case ID", { exact: true }), current.id, "Use the exact original case ID")
    await film.input(page.getByLabel("Case incarnation", { exact: true }), current.incarnation, "Use the original case incarnation")
    await film.input(page.getByLabel("Case version", { exact: true }), String(current.version), "Use the fresh original case version")
    await film.click(page.getByRole("button", { name: "Read authorized case", exact: true }), "Read actual memory for this authorized case")
    await film.nativeReady("Signals")
    const memory = page.locator(".sf-memory")
    const conditions = memory.locator("[data-sf-condition-id]")
    film.proof({ kind: "actual-case-memory", caseId: current.id, incarnation: current.incarnation, version: current.version,
      visibleState: (await memory.innerText()).slice(0, 9000), conditionCount: await conditions.count() })
    if (await conditions.count() === 1) {
      await film.click(conditions.getByRole("button", { name: "Review condition", exact: true }), "Inspect the single returned decision condition")
      await film.nativeReady("Signals")
      const material = memory.locator("[data-sf-memory-materiality]")
      if (await material.isVisible()) await film.focus(material, "Condition / source, observed period and materiality")
    } else await film.focus(h1(), "Business memory / actual returned state")
    await film.snap("37-memory-signals")
    await film.pause(3000)
    await film.go("/orchestra/sf-memory/outcomes", "Expected and observed")
    await film.input(page.getByLabel("Case ID", { exact: true }), current.id, "Re-use the original case for outcome review")
    await film.input(page.getByLabel("Case incarnation", { exact: true }), current.incarnation, "Preserve the exact case incarnation")
    await film.input(page.getByLabel("Case version", { exact: true }), String(current.version), "Preserve the fresh case version")
    await film.click(page.getByRole("button", { name: "Read authorized case", exact: true }), "Read the actual outcome conditions")
    await film.nativeReady("Expected and observed")
    film.proof({ kind: "actual-memory-outcomes-availability", visibleState: (await page.locator(".sf-memory").innerText()).slice(0, 9000),
      comparisonOrCausationInvented: false })
    await film.focus(h1(), "Expected and observed / verified availability")
  })

  await film.cue("39-routine-prepare", async () => {
    await film.go("/orchestra/sf-routines", "Routines")
    const cases = page.getByLabel("Choose an existing authorized case", { exact: true })
    const options = (await observedOptions(cases)).filter((item) => item.value && item.label.includes(data.objective))
    expect(options).toHaveLength(1)
    await film.select(cases, { value: options[0]!.value }, "Select the same authorized regional decision")
    await film.input(page.getByLabel("Task / purpose", { exact: true }), "Review regional operating-plan evidence and open questions.",
      "State a real demonstration routine purpose", true)
    const find = page.getByRole("button", { name: "Find published recipes", exact: true })
    await film.focus(find, "Find published recipes / current admission boundary")
    if (await find.isEnabled()) {
      await film.click(find, "Read the original published-recipe catalog")
      await film.nativeReady("Routines")
      const recipes = page.getByLabel("Select a published recipe", { exact: true })
      const actual = await recipes.count() ? (await observedOptions(recipes)).filter((item) => item.value) : []
      state.routineRecipes = actual.map((item) => item.label)
      if (actual.length === 1) {
        await film.select(recipes, { value: actual[0]!.value }, "Inspect the single returned published recipe")
        await film.focus(page.getByRole("region", { name: "Published recipe", exact: true }), "Recipe / actual version and write scope")
      }
    }
    film.proof({ kind: "actual-routine-catalog", objective: data.objective, recipes: state.routineRecipes ?? [],
      visibleState: (await page.locator(".sf-n29-routines").innerText()).slice(0, 9000),
      admissionPrepared: false, executed: false })
  })

  await film.cue("40-routine-state", async () => {
    await film.go("/orchestra/sf-routines/runs", "Routine result")
    await film.focus(h1(), "Routine result / actual recorded state")
    film.proof({ kind: "actual-routine-result-availability", visibleState: (await page.locator('[data-sf-frame="page"]').innerText()).slice(0, 9000),
      executedDuringCapture: false, completionClaimed: false })
    await film.snap("40-actual-routine-result")
    await film.pause(3500)
    await film.go("/orchestra/sf-routines/schedules")
    await film.focus(h1(), "Schedules / actual available configuration")
    film.proof({ kind: "actual-schedule-availability", visibleState: (await page.locator('[data-sf-frame="page"]').innerText()).slice(0, 9000),
      scheduleCreated: false })
  })
}

async function dark(film: Film) {
  const html = film.page.locator("html")
  await expect(html).toHaveAttribute("data-color-scheme", /^(dark|light)$/)
  if (await html.getAttribute("data-color-scheme") !== "dark")
    await film.click(film.page.locator('[data-slot="orchestra-theme-toggle"]'), "Select Dark appearance")
  await expect(html).toHaveAttribute("data-color-scheme", "dark")
}
