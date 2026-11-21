import { expect, type Page, type Request, type TestInfo } from "@playwright/test"
import type { DecisionCase } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"
import {
  waveFourTest, enter, ready, observePage, scheme, reflow, capture, scrollPageTop,
} from "./design-support/wave-four"

// Public producer fields only; projection-only change/receipt collections are counted, not interpreted.
type SfCase = Pick<DecisionCase, "id" | "incarnation" | "version" | "objective" | "criteria" | "sourceRefs" |
  "alternatives" | "assumptions" | "questions" | "choices"> & {
    preparedChanges: readonly unknown[]
    receipts: readonly unknown[]
  }
waveFourTest.use({ designWave: "four-decisions" })

type Owner = Parameters<typeof enter>[1]
type Screen = { id: string; href: string; title: string; titleBr: string }

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected original response object")
  return value as Record<string, unknown>
}
function action(request: Request, mode: string, operation?: string) {
  if (request.method() !== "POST" || new URL(request.url()).searchParams.get("sf") !== mode) return false
  return !operation || object(request.postDataJSON()).operation === operation
}
function observeDecisionReads(page: Page) {
  const pending = new Map<Request, { operation: string; started: number }>()
  const completed: { operation: string; elapsedMs: number; status: number | "failed" }[] = []
  page.on("request", (request) => {
    const mode = new URL(request.url()).searchParams.get("sf")
    if (request.method() === "GET" && mode === "current-choice") {
      pending.set(request, { operation: mode, started: performance.now() })
      console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "decision-read-start", operation: mode }))
    }
  })
  page.on("response", (response) => {
    const read = pending.get(response.request())
    if (!read) return
    pending.delete(response.request())
    const value = { operation: read.operation, elapsedMs: Math.round(performance.now() - read.started), status: response.status() }
    completed.push(value)
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "decision-read", ...value }))
  })
  page.on("requestfailed", (request) => {
    const read = pending.get(request)
    if (!read) return
    pending.delete(request)
    const value = { operation: read.operation, elapsedMs: Math.round(performance.now() - read.started), status: "failed" as const }
    completed.push(value)
    console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "decision-read", ...value }))
  })
  return completed
}
async function observeAvailability(page: Page, owner: Owner) {
  const query = new URLSearchParams({
    installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
  })
  const response = await page.request.get(owner.publicOrigin + owner.mount + "/api/ui/context?" + query)
  expect(response.status()).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  const resources = object(body.value).availability
  expect(Array.isArray(resources)).toBe(true)
  const ids = ["decisions.choice.read", "decisions.command.sf_question_prepare",
    "intelligence.analysis.choices", "intelligence.analysis.list", "intelligence.analysis.prepare",
    "collaboration.selection-list", "collaboration.cycle-read", "collaboration.recipients"]
  const operations = (resources as unknown[]).flatMap((resource) => object(resource).operations as unknown[])
    .map(object).filter((operation) => ids.includes(String(operation.operationId)))
  const summary = ids.map((id) => {
    const found = operations.filter((operation) => operation.operationId === id)
    expect(found.length).toBeGreaterThan(0)
    const value = { operation: id, state: found[0]!.state, operational: found[0]!.operational }
    expect(found.every((entry) => entry.state === value.state && entry.operational === value.operational)).toBe(true)
    return value
  })
  console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "decision-availability", operations: summary }))
  return summary
}
async function readCase(page: Page, origin: string, mount: string, caseRef: string) {
  const response = await page.request.get(origin + mount + "/api/ui/projections/case", { params: { caseRef } })
  expect(response.status()).toBe(200)
  const body = object(await response.json())
  expect(body.status).toBe("ok")
  return object(object(body.value).projection).case as SfCase
}
async function openScreen(page: Page, owner: Owner, screen: Screen, localized = false) {
  // Current-choice options revalidate every authorized case before the selected choice.
  await enter(page, owner, screen.href, localized ? screen.titleBr : screen.title,
    screen.id === "UI35" || screen.id === "UI38" ? 40_000 : 10_000)
  const root = page.locator('[data-sf-decision="' + screen.id + '"]')
  await expect(root).toHaveAttribute("data-sf-wave", "four")
  await expect(root).toBeVisible()
  await expect(root.locator('[aria-busy="true"]')).toHaveCount(0)
  const bounds = await root.boundingBox()
  expect(bounds?.width).toBeLessThanOrEqual(1160)
  await reflow(page)
}
async function reviewViewport(page: Page, info: TestInfo, review: ReturnType<Page["locator"]>, name: string) {
  await review.scrollIntoViewIfNeeded()
  const actions = review.getByRole("button")
  for (const button of await actions.all()) {
    await button.scrollIntoViewIfNeeded()
    await expect(button).toBeInViewport()
    expect((await button.boundingBox())?.height).toBeGreaterThanOrEqual(44)
  }
  await reflow(page)
  await capture(page, info, name)
}

waveFourTest("wave four decisions: real sources, retained drafts, uncertainty and native review", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(780_000)
  expect(info.project.metadata.bundle).toBe("production")
  expect(info.config.workers).toBe(1)
  const diagnostic = observePage(page)
  const readTimes = observeDecisionReads(page)
  const writes: Request[] = []
  page.on("request", (request) => {
    if (action(request, "decision-edit") || action(request, "workbench-command", "sf_question_prepare") ||
        action(request, "current-choice-promote") || action(request, "decision-apply"))
      writes.push(request)
  })

  await enter(page, owner, installation.origin + "/orchestra/sf-decisions", "Decisions")
  const list = page.getByRole("region", { name: "Authorized decision cases", exact: true })
  const findCase = async (objective: string) => {
    const link = list.getByRole("listitem").filter({ hasText: objective }).getByRole("link", { name: "Open decision", exact: true })
    await expect(link).toHaveCount(1)
    const href = await link.getAttribute("href")
    if (!href) throw new Error("The original case list omitted its route")
    return new URL(href, installation.origin)
  }
  const main = await findCase(waveFourDecisionsData.objective)
  const editable = await findCase(waveFourDecisionsData.editableObjective)
  // The original UI33 href is admitted and decoded by the native route, not a test codec.
  await enter(page, owner, main.href, "Case summary")
  const caseRef = await page.locator('[data-sf-decision="UI34"]').getAttribute("data-sf-case-ref")
  await enter(page, owner, editable.href, "Case summary")
  const editableRef = await page.locator('[data-sf-decision="UI34"]').getAttribute("data-sf-case-ref")
  if (!caseRef || !editableRef) throw new Error("The native case route omitted its source reference")
  expect(caseRef).toMatch(/^case:[^:]+:[^:]+$/)
  const availability = await observeAvailability(page, owner)
  for (const operation of ["decisions.choice.read", "decisions.command.sf_question_prepare",
    "intelligence.analysis.choices", "intelligence.analysis.list"])
    expect(availability.find((entry) => entry.operation === operation)).toMatchObject({ state: "ready", operational: true })
  const source = await readCase(page, installation.origin, installation.mount, caseRef)
  const editableSource = await readCase(page, installation.origin, installation.mount, editableRef)
  expect(source.alternatives).toHaveLength(2)
  expect(source.choices).toHaveLength(1)
  expect(source.assumptions).toHaveLength(2)
  expect(source.assumptions.every((entry) => entry.state === "open")).toBe(true)
  expect(source.preparedChanges).toHaveLength(0)
  expect(source.receipts).toHaveLength(0)
  expect(source.alternatives.every((entry) => entry.result.total === null && entry.result.comparisonStatus === "conditioned")).toBe(true)

  const href = (suffix: string) => {
    const url = new URL(main.href)
    url.pathname += suffix
    return url.href
  }
  const screens: Screen[] = [
    { id: "UI34", href: editable.href, title: "Case summary", titleBr: "Resumo do caso" },
    { id: "UI35", href: href("/alternatives"), title: "Alternatives", titleBr: "Alternativas" },
    { id: "UI36", href: href("/assumptions"), title: "Assumptions", titleBr: "Premissas" },
    { id: "UI37", href: href("/questions"), title: "Questions", titleBr: "Perguntas" },
    { id: "UI38", href: href("/choice"), title: "Current choice", titleBr: "Escolha atual" },
    { id: "UI39", href: href("/changes"), title: "Prepared changes", titleBr: "Mudanças preparadas" },
    { id: "UI40", href: href("/history"), title: "Application result", titleBr: "Resultado da aplicação" },
    { id: "UI41", href: href("/analyses"), title: "Analysis", titleBr: "Análise" },
  ]

  await waveFourTest.step("UI34 reads and edits the exact case with retained review fields and CAS", async () => {
    await openScreen(page, owner, screens[0]!)
    await page.getByRole("button", { name: "Edit decision", exact: true }).click()
    const editor = page.locator("[data-sf-decision-editor]")
    const objective = editor.getByLabel("Decision objective", { exact: true })
    await expect(objective).toHaveValue(waveFourDecisionsData.editableObjective)
    await objective.fill(waveFourDecisionsData.editedObjective)
    await objective.focus()
    await expect(objective).toHaveCSS("outline-style", "solid")
    await expect(editor.getByLabel("Currency", { exact: true })).toHaveValue("USD")
    await capture(page, info, "UI34-dark-desktop-editor-test-data")
    await editor.getByRole("button", { name: "Review source attachments", exact: true }).click()
    const review = editor.getByRole("group", { name: "Review source attachments", exact: true })
    await expect(review).toContainText(waveFourDecisionsData.editedObjective)
    const reviewedSources = review.locator("details.sf-decision-source-scope")
    await reviewedSources.locator("summary").click()
    for (const source of editableSource.sourceRefs) await expect(reviewedSources).toContainText(source.refId)
    await reviewedSources.locator("summary").click()
    await expect(editor.locator("textarea")).toHaveCount(1)
    await expect(objective).toBeHidden()
    expect(writes).toHaveLength(0)
    await review.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(objective).toHaveValue(waveFourDecisionsData.editedObjective)
    await editor.getByRole("button", { name: "Back to case", exact: true }).click()
    await expect(editor).toBeHidden()
    await page.getByRole("button", { name: "Edit decision", exact: true }).click()
    await expect(objective).toHaveValue(waveFourDecisionsData.editedObjective)
    await editor.getByRole("button", { name: "Review source attachments", exact: true }).click()
    await page.setViewportSize({ width: 390, height: 844 })
    await reviewViewport(page, info, review, "UI34-dark-390-review-actions-test-data")
    const saved = page.waitForResponse((response) => action(response.request(), "decision-edit"))
    await review.getByRole("button", { name: "Save decision", exact: true }).click()
    expect((await saved).status()).toBe(200)
    await expect(editor).toHaveCount(0)
    await ready(page, "Case summary")
    const changed = await readCase(page, installation.origin, installation.mount, editableRef)
    expect(changed.objective).toBe(waveFourDecisionsData.editedObjective)
    expect(changed.version).toBeGreaterThan(editableSource.version)
    expect(changed.sourceRefs).toEqual(editableSource.sourceRefs)
    expect(changed.criteria).toEqual(editableSource.criteria)
    expect(writes.filter((request) => action(request, "decision-edit"))).toHaveLength(1)
    const posted = object(writes[0]!.postDataJSON())
    expect(posted.caseRef).toEqual({ id: editableSource.id, incarnation: editableSource.incarnation, version: editableSource.version })
    expect(writes[0]!.headers()["idempotency-key"]).toBeTruthy()
    expect(diagnostic.consoleErrors).toEqual([])
    await page.setViewportSize({ width: 1440, height: 1100 })
  })

  await waveFourTest.step("UI35 reports an authorized case with no historical choice", async () => {
    const empty = new URL(editable.href)
    empty.pathname += "/alternatives"
    await openScreen(page, owner, { ...screens[1]!, href: empty.href })
    const current = await readCase(page, installation.origin, installation.mount, editableRef)
    expect(current.alternatives).toHaveLength(0)
    expect(current.choices).toHaveLength(0)
    await expect(page.getByText("No alternatives are recorded in this case.", { exact: true })).toBeVisible()
    const recorded = page.getByRole("region", { name: "Recorded choice", exact: true })
    await expect(recorded.getByText("No authorized historical choices are available for this selection.", { exact: true })).toBeVisible()
    await expect(recorded.getByRole("button", { name: "Recalculate current choice", exact: true })).toHaveCount(0)
    await capture(page, info, "UI35-dark-desktop-empty-choice-test-data")
  })

  await waveFourTest.step("UI35 keeps the recorded choice on its opaque case route and compares source values", async () => {
    await openScreen(page, owner, screens[1]!)
    const board = page.locator(".sf-decision-compare-board")
    await expect(board.locator("article")).toHaveCount(2)
    await expect(board.getByRole("heading", { name: waveFourDecisionsData.plannerBaseline, exact: true })).toBeVisible()
    await expect(board.getByRole("heading", { name: waveFourDecisionsData.plannerCandidate, exact: true })).toBeVisible()
    for (const alternative of source.alternatives) {
      const card = board.locator("article").filter({ has: page.getByRole("heading", { name: alternative.title, exact: true }) })
      await expect(card.locator(".sf-decision-amount")).toContainText(String(alternative.result.knownSubtotal))
      await card.getByRole("button", { name: "Select for comparison", exact: true }).click()
    }
    await page.getByRole("button", { name: "Compare alternatives", exact: true }).click()
    await expect(board).toHaveAttribute("data-sf-comparing", "true")
    await expect(page.getByText("A complete numerical comparison is not authorized for these bases, periods or currencies.", { exact: true })).toBeVisible()
    const recorded = page.getByRole("region", { name: "Recorded choice", exact: true })
    await expect(recorded.getByRole("heading", { name: source.alternatives[1]!.title, exact: true })).toBeVisible()
    await expect(recorded.getByRole("button", { name: "Recalculate current choice", exact: true })).toBeDisabled()
    await expect(recorded.locator('[data-sf-state="stale"]')).toHaveCount(0)
    await board.locator("article").first().locator("summary").filter({ hasText: "Evidence sources" }).click()
    await expect(board.locator("article").first()).toContainText(source.alternatives[0]!.result.sourceRefs[0]!.refId)
    await page.setViewportSize({ width: 320, height: 800 })
    await reflow(page)
    await scrollPageTop(page)
    await capture(page, info, "UI35-dark-320-comparison-test-data")
    await page.setViewportSize({ width: 1440, height: 1100 })
  })

  await waveFourTest.step("UI36 filters genuine open assumptions and reviews their source without confirming them", async () => {
    await openScreen(page, owner, screens[2]!)
    const assumptions = page.getByRole("region", { name: "Assumption", exact: true })
    await expect(assumptions.getByRole("listitem")).toHaveCount(2)
    await assumptions.getByLabel("State", { exact: true }).selectOption("confirmed")
    await expect(assumptions.locator('[data-sf-state="filtered-empty"]')).toBeVisible()
    await assumptions.getByLabel("State", { exact: true }).selectOption("open")
    await assumptions.getByRole("listitem").filter({ hasText: waveFourDecisionsData.assumption })
      .getByRole("button", { name: "Review assumption", exact: true }).click()
    const detail = page.locator("#sf-n24-assumption-detail")
    await expect(detail).toContainText(waveFourDecisionsData.assumption)
    await expect(detail).toContainText(source.assumptions[0]!.evidenceRefs[0]!.refId)
    await expect(page.getByRole("region", { name: "Missing cost categories", exact: true })).toContainText("migration")
    await capture(page, info, "UI36-dark-desktop-assumption-detail-test-data")
  })

  await waveFourTest.step("UI37 prepares a question after retained review, without recording or sending it", async () => {
    await openScreen(page, owner, screens[3]!)
    if (!availability.some((entry) => entry.operation === "collaboration.selection-list" &&
      entry.state === "ready" && entry.operational === true)) {
      const cycles = page.locator('section[aria-labelledby="sf-n24-cycles"]')
      await expect(cycles.locator('[data-sf-state="unavailable"]')).toBeVisible()
      await expect(cycles.locator('[data-sf-state="empty"]')).toHaveCount(0)
    }
    const composer = page.locator("[data-sf-question-composer]")
    await composer.locator("summary").first().click()
    const question = composer.getByLabel("Question text", { exact: true })
    await question.fill(waveFourDecisionsData.question)
    await composer.getByLabel("Related criterion", { exact: true }).selectOption(source.criteria[0]!.id)
    await composer.getByRole("button", { name: "Prepare question", exact: true }).click()
    const review = composer.getByRole("group", { name: "Confirm preparation", exact: true })
    await expect(review).toContainText(waveFourDecisionsData.question)
    await expect(question).toBeHidden()
    await expect(composer.locator("textarea")).toHaveCount(1)
    expect(writes.filter((request) => action(request, "workbench-command", "sf_question_prepare"))).toHaveLength(0)
    await review.getByRole("heading", { name: "Confirm preparation", exact: true }).scrollIntoViewIfNeeded()
    await composer.getByRole("button", { name: "Cancel", exact: true }).click()
    await expect(question).toHaveValue(waveFourDecisionsData.question)
    await composer.getByRole("button", { name: "Prepare question", exact: true }).click()
    await capture(page, info, "UI37-dark-desktop-question-review-test-data")
    const prepared = page.waitForResponse((response) => action(response.request(), "workbench-command", "sf_question_prepare"))
    await composer.getByRole("button", { name: "Confirm preparation", exact: true }).click()
    expect((await prepared).status()).toBe(200)
    await expect(composer.getByText("Preparing a question is not the same as recording or sending it.", { exact: true })).toBeVisible()
    expect(writes.filter((request) => action(request, "workbench-command", "sf_question_prepare"))).toHaveLength(1)
    const after = await readCase(page, installation.origin, installation.mount, caseRef)
    expect(after.version).toBe(source.version)
    expect(after.questions).toEqual(source.questions)
    await capture(page, info, "UI37-dark-desktop-prepared-proposal-test-data")
  })

  await waveFourTest.step("UI38–UI40 preserve current-source admission and the genuine empty change/receipt ledgers", async () => {
    await openScreen(page, owner, screens[4]!)
    await expect(page.locator("[data-choice-id]")).toHaveCount(1)
    await expect(page.locator("[data-choice-id]")).toContainText(source.alternatives[1]!.title)
    await expect(page.getByRole("button", { name: "Review current sources", exact: true })).toBeDisabled()
    await expect(page.getByText("The producer has not admitted a preparation for this choice.", { exact: true })).toBeVisible()
    await openScreen(page, owner, screens[5]!)
    await expect(page.locator(".sf-decision-change-ledger")).toBeVisible()
    await expect(page.locator(".sf-decision-change-select")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Apply reviewed change", exact: true })).toHaveCount(0)
    await openScreen(page, owner, screens[6]!)
    await expect(page.getByText("No application receipt has been returned for this authorized case.", { exact: true })).toBeVisible()
    await expect(page.locator("[data-producer-receipt]")).toHaveCount(0)
    await expect(page.getByRole("button", { name: "Recover recorded receipt", exact: true })).toHaveCount(0)
    expect(writes.filter((request) => action(request, "current-choice-promote") || action(request, "decision-apply"))).toHaveLength(0)
  })

  await waveFourTest.step("UI41 makes real POST reads and exposes exactly the producer's admitted selections", async () => {
    const choicesResponse = page.waitForResponse((response) => {
      const request = response.request()
      return request.method() === "POST" && new URL(request.url()).searchParams.get("sf") === "workbench-analysis" &&
        object(request.postDataJSON()).action === "choices"
    }).then((response) => ({ status: response.status(), request: response.request() }))
    const [nativeRead] = await Promise.all([choicesResponse, openScreen(page, owner, screens[7]!)])
    expect(nativeRead.status).toBe(200)
    expect(new URL(nativeRead.request.url()).origin).toBe(installation.origin)
    expect(nativeRead.request.postDataJSON()).toEqual({ action: "choices" })
    // This original POST is a read. APIRequestContext retains its body independently
    // of Chromium's response-handle lifetime; no CDP body or simulated response is used.
    const response = await page.request.post(nativeRead.request.url(), {
      headers: { origin: installation.origin, "content-type": "application/json", "idempotency-key": crypto.randomUUID() },
      data: nativeRead.request.postDataJSON(),
    })
    expect(response.status()).toBe(200)
    const body = object(await response.json())
    expect(body.status).toBe("ok")
    const choices = object(body.value)
    const cases = choices.cases as { caseRef: { id: string; incarnation: string; version: number }; label: string }[]
    const analyses = choices.analyses as { skillId: string; label: string }[]
    const models = choices.models as { id: string; providerID: string }[]
    expect(cases.some((entry) => entry.caseRef.id === source.id && entry.caseRef.incarnation === source.incarnation)).toBe(true)
    await expect(page.getByLabel("Authorized case", { exact: true }).locator("option")).toHaveCount(cases.length + 1)
    await expect(page.getByLabel("Analysis type", { exact: true }).locator("option")).toHaveCount(analyses.length + 1)
    await expect(page.getByLabel("Admitted model", { exact: true }).locator("option")).toHaveCount(models.length + 1)
    await expect(page.getByRole("heading", { name: "Analysis history", exact: true })).toBeVisible()
    await expect(page.getByText("No analyses were recorded for this authorized case.", { exact: true })).toBeVisible()
    await page.getByLabel("Analysis objective", { exact: true }).fill(waveFourDecisionsData.objective)
    const published = analyses.findIndex((entry) => entry.skillId === "sf-enquadrar-decisao")
    if (published >= 0) await page.getByLabel("Analysis type", { exact: true }).selectOption({ index: published + 1 })
    if (models.length) await page.getByLabel("Admitted model", { exact: true }).selectOption({ index: 1 })
    if (!analyses.length) await expect(page.getByText("No admitted analysis option is available.", { exact: true })).toBeVisible()
    if (analyses.length && !models.length) await expect(page.getByText("No admitted model is available.", { exact: true })).toBeVisible()
    const preparationAvailable = availability.some((entry) => entry.operation === "intelligence.analysis.prepare" &&
      entry.state === "ready" && entry.operational === true)
    if (published < 0 || !models.length || !preparationAvailable) {
      await expect(page.getByRole("button", { name: "Prepare analysis", exact: true })).toBeDisabled()
    } else {
      await page.getByRole("button", { name: "Prepare analysis", exact: true }).click()
      const review = page.locator("[data-sf-analysis-review]")
      await expect(review).toBeVisible()
      await expect(review).toContainText(waveFourDecisionsData.objective)
      await review.locator("summary").filter({ hasText: "Source record" }).click()
      await expect(review.locator("pre")).not.toBeEmpty()
      await capture(page, info, "UI41-dark-desktop-prepared-input-test-data")
      await review.getByRole("button", { name: "Return to history", exact: true }).click()
      await expect(page.getByLabel("Analysis objective", { exact: true })).toHaveValue(waveFourDecisionsData.objective)
    }
    await info.attach("UI41-original-catalog-counts", { contentType: "application/json",
      body: JSON.stringify({ cases: cases.length, analyses: analyses.length, models: models.length, preparationAvailable, preparedInputExercised: published >= 0 && models.length > 0 && preparationAvailable }) })
  })

  for (const color of ["dark", "light"] as const) {
    for (const screen of screens) {
      await openScreen(page, owner, screen)
      await scheme(page, color)
      await scrollPageTop(page)
      await capture(page, info, screen.id + "-" + color + "-desktop-test-data")
    }
  }
  await scheme(page, "dark")
  await page.setViewportSize({ width: 390, height: 844 })
  for (const screen of screens) {
    await openScreen(page, owner, screen)
    await capture(page, info, screen.id + "-dark-390-test-data")
  }

  const cookies = await page.context().cookies(installation.origin + installation.mount)
  expect(cookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name))).toHaveLength(1)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  const localized = await portuguese.newPage()
  const localizedDiagnostic = observePage(localized)
  const localizedReadTimes = observeDecisionReads(localized)
  try {
    for (const screen of screens) {
      await openScreen(localized, owner, screen, true)
      await capture(localized, info, screen.id + "-pt-BR-dark-desktop-test-data")
    }
    await openScreen(localized, owner, screens[3]!, true)
    const composer = localized.locator("[data-sf-question-composer]")
    await composer.locator("summary").first().click()
    await composer.getByLabel("Texto da pergunta", { exact: true }).fill(waveFourDecisionsData.question)
    await composer.getByRole("button", { name: "Preparar pergunta", exact: true }).click()
    await expect(composer.getByRole("group", { name: "Confirmar preparação", exact: true })).toBeVisible()
    await localized.setViewportSize({ width: 320, height: 800 })
    await reflow(localized)
    await composer.getByRole("button", { name: "Confirmar preparação", exact: true }).scrollIntoViewIfNeeded()
    await capture(localized, info, "UI37-pt-BR-dark-320-review-test-data")
    await composer.getByRole("button", { name: "Cancelar", exact: true }).click()
    await expect(composer.getByLabel("Texto da pergunta", { exact: true })).toHaveValue(waveFourDecisionsData.question)
    expect(localizedDiagnostic.pageErrors).toEqual([])
    expect(localizedDiagnostic.consoleErrors).toEqual([])
  } finally { await portuguese.close() }

  expect(diagnostic.pageErrors).toEqual([])
  expect(diagnostic.consoleErrors).toEqual([])
  await info.attach("decisions-scope", { contentType: "application/json", body: JSON.stringify({
    surfaces: screens.map((screen) => screen.id),
    realCommands: ["decision-edit", "sf_question_prepare"],
    sourceState: { alternatives: 2, assumptions: 2, choices: 1, preparedChanges: 0, applicationReceipts: 0 },
    preservedLimits: ["Current-choice preparation requires producer provenance", "No application was prepared or applied", "No analysis model or result was invented"],
    consoleErrors: diagnostic.consoleErrors,
    sourceReadTimes: [...readTimes, ...localizedReadTimes],
    operationAvailability: availability,
  }) })
})
