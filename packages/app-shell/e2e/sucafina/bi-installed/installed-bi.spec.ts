import { expect, test } from "@playwright/test"
import { asRecord } from "../decisions-support/journey"
import { startPlannerInstallation } from "../wp03/installation-fixture"
import { horizon, objective, prepareInstalledBi, records } from "./installed-fixture"
import { biReply, dataRow, expectAdvantage, expectValue, expectWaterfall, responseFor, showBi, showScenario } from "./browser"

// The actual private enrollment and HttpOnly session must not enter retained
// network traces. Screenshots and observations contain synthetic business data.
test.use({ trace: "off", video: "off" })
test.describe.configure({ retries: 0 })

test("BI62 installed BI09 and BI10 preserve the literal training quote, real sources and current authority", async ({ page, browser }, info) => {
  test.setTimeout(180_000)
  const installation = await startPlannerInstallation(info)
  const observations: Record<string, unknown>[] = []
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  let completed = false
  try {
    await page.context().addCookies([installation.cookie])
    const corpus = await test.step("save real Planner inputs and canonical scenarios, comparisons and portfolio", () => prepareInstalledBi(page, installation, observations))

    await test.step("show the omitted-training gap without changing it into a complete total or zero", async () => {
      const before = await showScenario(page, installation.origin, corpus, "missing", "BI09")
      const projection = asRecord(before.projection), decision = asRecord(projection.decision)
      const scenario = asRecord(decision.scenario), comparison = asRecord(decision.comparison)
      expect(scenario.knownSubtotal).toBe(210000)
      expect(scenario.total).toBeNull()
      expect(comparison.knownDifference).toBe(-30000)
      expect(comparison.completeDifference).toBeNull()
      await expectValue(page, "scenario:candidate-known-subtotal", "210000")
      await expectValue(page, "scenario:candidate-complete-total", "Indisponível")
      await expectValue(page, "scenario:known-difference", "-30000")
      await expectValue(page, "scenario:complete-difference", "Indisponível")
      await expect(page.locator("[data-sf-bi]")).toContainText("training")
      await expectWaterfall(page, before, 240000, 210000)
      await expectAdvantage(page, projection, corpus.comparisons.missingInverse, 30000, "Condicionada")
      observations.push({ stage: "installed-training-unquoted", scenarioResultRef: corpus.scenarioRefs.missing,
        comparisonRef: corpus.comparisons.missing, knownSubtotal: scenario.knownSubtotal, total: scenario.total,
        knownDifference: comparison.knownDifference, inverseKnownDifference: 30000 })
      await info.attach("bi62-training-unquoted.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
    })

    let resolved: Record<string, unknown> = {}
    await test.step("render the separate 40000 training quote and the canonical inversion of advantage", async () => {
      resolved = await showScenario(page, installation.origin, corpus, "resolved", "BI09")
      const projection = asRecord(resolved.projection), decision = asRecord(projection.decision)
      const scenario = asRecord(decision.scenario), comparison = asRecord(decision.comparison)
      expect(scenario.knownSubtotal).toBe(250000)
      expect(scenario.total).toBe(250000)
      expect(comparison.knownDifference).toBe(10000)
      expect(comparison.completeDifference).toBe(10000)
      const training = records(scenario.components).filter((component) => String(component.id).startsWith(`${corpus.plans.resolved.lines.training}:`) && component.amount === 40000)
      expect(training).toHaveLength(1)
      expect(training[0]!.period).toEqual({ start: "2027-11-01", end: "2027-11-30" })
      const coverage = asRecord(scenario.costCoverage)
      expect(records(coverage.entries).find((entry) => entry.categoryId === "training")).toMatchObject({ status: "included" })
      await expectValue(page, "scenario:baseline-known-subtotal", "240000")
      await expectValue(page, "scenario:candidate-known-subtotal", "250000")
      await expectValue(page, "scenario:candidate-complete-total", "250000")
      await expectValue(page, "scenario:known-difference", "10000")
      await expectValue(page, "scenario:complete-difference", "10000")
      await expectWaterfall(page, resolved, 240000, 250000)
      const plan = asRecord(asRecord(resolved.presentation).waterfall)
      const values = records(projection.values)
      const quoted = records(plan.segments).filter((segment) => values.some((value) => value.id === segment.componentValueId && value.value === 40000))
      expect(quoted).toHaveLength(1)
      const mark = page.getByRole("group", { name: "Waterfall de componentes; valores e fontes estão na tabela equivalente", exact: true }).locator(`[data-bi-value="${String(quoted[0]!.componentValueId)}"]`)
      await expect(mark).toBeVisible()
      await expect(mark.locator("title")).toContainText("+40000 USD")
      await expectAdvantage(page, projection, corpus.comparisons.resolvedInverse, -10000, "Completa")
      const previousViewport = page.viewportSize()
      for (const width of [320, 768, 1440]) {
        await page.setViewportSize({ width, height: 900 })
        await expectValue(page, "scenario:candidate-complete-total", "250000")
        const chart = page.getByRole("group", { name: "Waterfall de componentes; valores e fontes estão na tabela equivalente", exact: true })
        await expect(chart).toBeVisible()
        const bounds = await chart.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.width).toBeGreaterThan(0)
        const geometry = await page.evaluate(() => ({ viewport: window.innerWidth, document: document.documentElement.scrollWidth }))
        observations.push({ stage: "installed-responsive-measurement", requestedWidth: width, ...geometry, chart: bounds,
          horizontalOverflow: geometry.document > geometry.viewport, nativeZoom: "not-executed" })
        await info.attach(`bi62-viewport-${width}.png`, { body: await page.screenshot(), contentType: "image/png" })
      }
      if (previousViewport) await page.setViewportSize(previousViewport)
      const trainingValue = values.find((value) => value.id === quoted[0]!.componentValueId)!
      const markOrigins = trainingValue.drilldown ? [asRecord(trainingValue.drilldown)]
        : records(trainingValue.sourceRefs).filter((ref, index, refs) => refs.findIndex((other) => other.refDigest === ref.refDigest) === index)
      const trainingOrigin = markOrigins.filter((ref) => ref.kind === "record" && asRecord(ref.target).recordId === corpus.plans.resolved.id)
      expect(trainingOrigin).toHaveLength(1)
      await expect(mark).toHaveAttribute("role", "button")
      await expect(mark).toHaveAttribute("tabindex", "0")
      await mark.focus()
      await expect(mark).toBeFocused()
      const sourceRequest = page.waitForResponse(responseFor("bi-source", "BI09"))
      await mark.press("Enter")
      if (markOrigins.length > 1) {
        const chooser = page.locator("[data-bi-source-chooser]:visible")
        await expect(chooser).toHaveCount(1)
        await chooser.locator(`button[data-bi-origin="${String(trainingOrigin[0]!.refDigest)}"]`).press("Enter")
      }
      const sourceResponse = await sourceRequest
      expect(sourceResponse.status()).toBe(200)
      const destinations = records(asRecord(await sourceResponse.json()).links)
      expect(destinations.some((link) => new URL(String(link.url), installation.origin).searchParams.get("version") === corpus.plans.resolved.id)).toBe(true)
      await expect(page.getByRole("navigation", { name: "Origens autorizadas do valor", exact: true })).toBeVisible()
      observations.push({ stage: "waterfall-mark-keyboard-origin", valueId: quoted[0]!.componentValueId,
        sourceDigest: trainingOrigin[0]!.refDigest, action: "Enter", authorizedDestinationCount: destinations.length })
      observations.push({ stage: "installed-training-40000", training: 40000, knownSubtotal: scenario.knownSubtotal, total: scenario.total,
        knownDifference: comparison.knownDifference, inverseKnownDifference: -10000,
        scenarioResultRef: corpus.scenarioRefs.resolved, comparisonRef: corpus.comparisons.resolved })
      await info.attach("bi62-training-40000.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
    })

    await test.step("reopen the selected persisted result after a real page reload", async () => {
      const selected = await page.getByLabel("Dados para visualizar", { exact: true }).inputValue()
      const pending = page.waitForResponse(responseFor("bi-data", "BI09"))
      await page.reload()
      const again = await biReply(await pending)
      await expect(page.getByLabel("Dados para visualizar", { exact: true })).toHaveValue(selected)
      expect(asRecord(again.request).selectionRef).toBe(selected)
      expect(asRecord(again.projection).decision).toEqual(asRecord(resolved.projection).decision)
      await expectValue(page, "scenario:candidate-complete-total", "250000")
      await expectWaterfall(page, again, 240000, 250000)
    })

    await test.step("open a reauthorized source and follow its real Planner destination", async () => {
      const row = dataRow(page, "scenario:candidate-known-subtotal")
      const sourceValue = records(asRecord(resolved.projection).values).find((value) => value.id === "scenario:candidate-known-subtotal")!
      const source = records(sourceValue.sourceRefs).filter((ref) => ref.kind === "record" && asRecord(ref.target).recordId === corpus.plans.resolved.id)
      expect(source).toHaveLength(1)
      const origins = row.locator(`button[data-bi-origin="${String(source[0]!.refDigest)}"]`)
      await expect(origins).toHaveCount(1)
      const pending = page.waitForResponse(responseFor("bi-source", "BI09"))
      await origins.click()
      const response = await pending
      expect(response.status()).toBe(200)
      const body = asRecord(await response.json())
      const links = records(body.links)
      const matching = links.filter((link) => {
        const url = new URL(String(link.url), installation.origin)
        return url.pathname === "/sucafina/planner" && url.searchParams.get("version") === corpus.plans.resolved.id
      })
      expect(matching).toHaveLength(1)
      const nav = page.getByRole("navigation", { name: "Origens autorizadas do valor", exact: true })
      const destination = nav.getByRole("link", { name: String(matching[0]!.label), exact: true })
      await expect(destination).toBeVisible()
      await destination.click()
      await expect(page).toHaveURL((url) => url.pathname === "/sucafina/planner" && url.searchParams.get("version") === corpus.plans.resolved.id)
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
      // The destination is the actual saved Planner version, not a fabricated
      // callback or an echo of the chart's displayed amount.
      await expect(page.getByRole("heading", { name: "Overview", exact: true, level: 1 })).toBeVisible()
      observations.push({ stage: "real-source-destination", surface: "planner", versionId: corpus.plans.resolved.id })
    })

    await test.step("show real dates and crop marks and rows to November without prorating costs", async () => {
      const timeline = await showScenario(page, installation.origin, corpus, "resolved", "BI10")
      const projection = asRecord(timeline.projection)
      expect(asRecord(projection.context).period).toEqual(horizon)
      const items = records(asRecord(asRecord(timeline.presentation).timeline).items)
      expect(items.length).toBeGreaterThan(0)
      const panel = page.locator("[data-sf-bi]")
      await expect(panel.getByRole("heading", { name: "Datas e marcos fornecidos pelo domínio", exact: true })).toBeVisible()
      await expect(panel.getByRole("group", { name: "Marcos no horizonte; a lista informa estado, data e origem", exact: true }).locator("circle")).toHaveCount(items.length)
      await panel.getByLabel("Início do período", { exact: true }).fill("2027-11-01")
      await panel.getByLabel("Fim do período", { exact: true }).fill("2027-11-30")
      await panel.getByRole("button", { name: "Aplicar filtro", exact: true }).click()
      const values = records(projection.values)
      const expectedDates = items.filter((item) => values.some((value) => value.id === item.dateValueId && typeof value.value === "string" && value.value >= "2027-11-01" && value.value <= "2027-11-30"))
      expect(expectedDates.length).toBeGreaterThan(0)
      expect(expectedDates.length).toBeLessThan(items.length)
      await expect(panel.getByRole("list", { name: "Marcos com data", exact: true }).getByRole("listitem")).toHaveCount(expectedDates.length)
      for (const item of expectedDates) await expect(dataRow(page, String(item.dateValueId))).toBeVisible()
      for (const item of items.filter((item) => !expectedDates.includes(item))) await expect(dataRow(page, String(item.dateValueId))).toHaveCount(0)
      await expectValue(page, "scenario:candidate-known-subtotal", "250000")
      await expect(panel.getByRole("status").filter({ hasText: "Os valores de períodos parcialmente selecionados permanecem integrais" })).toBeVisible()
      observations.push({ stage: "installed-BI10-period-crop", authorizedPeriod: horizon, displayPeriod: { start: "2027-11-01", end: "2027-11-30" }, visibleDates: expectedDates.length, originalDates: items.length })
      await info.attach("bi62-dates-november.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
    })

    await test.step("consume the same persisted portfolio in both BI views", async () => {
      for (const viewId of ["BI09", "BI10"] as const) {
        const portfolio = await showBi(page, installation.origin, viewId, (label) => label.includes(`portfolio ${corpus.portfolioResultRef}`))
        const decision = asRecord(asRecord(portfolio.projection).decision)
        expect(decision.kind).toBe("portfolio")
        expect(decision.portfolioResultRef).toBe(corpus.portfolioResultRef)
        const combinations = records(asRecord(decision.portfolio).combinations)
        expect(combinations).toHaveLength(1)
        expect(asRecord(combinations[0]!.analysis).scenarioResultRef).toBe(corpus.scenarioRefs.resolved)
        await expect(page.getByRole("button", { name: `Abrir portfólio ${corpus.portfolioResultRef}`, exact: true })).toBeVisible()
        if (viewId === "BI09") await expectWaterfall(page, portfolio, 240000, 250000)
        else await expect(page.getByRole("heading", { name: "Datas e marcos fornecidos pelo domínio", exact: true })).toBeVisible()
      }
      const pending = page.waitForResponse(responseFor("bi-decision", "BI10"))
      await page.getByRole("button", { name: `Abrir portfólio ${corpus.portfolioResultRef}`, exact: true }).click()
      expect((await pending).status()).toBe(200)
      const detail = page.getByRole("region", { name: "Detalhe da análise", exact: true })
      await expect(detail).toBeVisible()
      await expect(detail).toContainText(corpus.portfolioResultRef)
      await expect(detail.getByRole("button", { name: "Voltar à análise", exact: true })).toBeEnabled()
      await detail.getByRole("button", { name: "Voltar à análise", exact: true }).click()
      await expect(detail).toHaveCount(0)
      await expect(page.getByRole("button", { name: `Abrir portfólio ${corpus.portfolioResultRef}`, exact: true })).toBeFocused()
      observations.push({ stage: "installed-portfolio-views-and-authorized-detail", portfolioResultRef: corpus.portfolioResultRef, views: ["BI09", "BI10"] })
    })

    await test.step("deny a period with no saved result and remove the old projection", async () => {
      const pending = page.waitForResponse((response) => responseFor("bi-options", "BI10")(response) && new URL(response.url()).searchParams.get("start") === "2027-02-01")
      await page.getByLabel("Início", { exact: true }).fill("2027-02-01")
      await page.getByLabel("Início", { exact: true }).press("Tab")
      expect((await pending).status()).toBe(200)
      const panel = page.locator("[data-sf-bi]")
      await expect(panel.getByRole("table")).toHaveCount(0)
      await expect(panel.getByRole("button", { name: "Atualizar visualização", exact: true })).toBeDisabled()
      await expect(panel.getByLabel("Dados para visualizar", { exact: true }).getByRole("option")).toHaveCount(1)
      await expect(panel.getByRole("status")).toContainText("Nenhum conjunto de resultados preservados")
    })

    await test.step("revoke the actual session and clear every protected BI surface", async () => {
      await showScenario(page, installation.origin, corpus, "resolved", "BI09")
      const selectionRef = await page.getByLabel("Dados para visualizar", { exact: true }).inputValue()
      const oldCredentials = await browser.newContext()
      try {
        await oldCredentials.addCookies([installation.cookie])
        const dataUrl = `${installation.origin}/sucafina/dashboard?${new URLSearchParams({ sf: "bi-data", viewId: "BI09", selectionRef, start: horizon.start, end: horizon.end })}`
        expect((await oldCredentials.request.get(dataUrl)).status()).toBe(200)
        const logout = await page.request.post(`${installation.origin}/sucafina/auth/logout`, { headers: { origin: installation.origin } })
        expect(logout.status()).toBe(204)
        const pending = page.waitForResponse(responseFor("bi-options", "BI09"))
        await page.getByRole("button", { name: "Recarregar escolhas autorizadas", exact: true }).click()
        expect([401, 403]).toContain((await pending).status())
        const panel = page.locator("[data-sf-bi]")
        await expect(panel.getByRole("status")).toHaveText("O acesso mudou. Abra novamente os dados autorizados.")
        await expect(panel.getByRole("table")).toHaveCount(0)
        await expect(panel.locator("svg")).toHaveCount(0)
        await expect(panel.getByRole("region", { name: "Detalhe da análise", exact: true })).toHaveCount(0)
        await expect(panel.getByRole("navigation").getByRole("link")).toHaveCount(0)
        await expect(panel.getByLabel("Dados para visualizar", { exact: true }).getByRole("option")).toHaveCount(1)
        expect([401, 403]).toContain((await oldCredentials.request.get(dataUrl)).status())
        observations.push({ stage: "real-session-revoked", retiredCookieDenied: true, protectedTables: 0, protectedMarks: 0, protectedDestinations: 0 })
      } finally { await oldCredentials.close() }
    })
    expect(errors).toEqual([])
    completed = true
  } finally {
    try {
      await info.attach("bi62-installed-observations.json", { body: JSON.stringify({ snapshot: process.env.GITHUB_SHA ?? null,
        title: info.title, completed, objective, observations, pageErrors: errors,
        boundary: "Real CLI, factory, HTTP, generated extended asset, persisted domain and browser. Two independent decisions preserve the omitted and resolved training quotes; this is not a same-revision ChoiceRecord journey. Inverse comparisons are persisted through canonical portfolio preview; only direct portfolios are persisted. Responsive geometry and captures are recorded without claiming native 200% zoom. Native visual migration, provider execution and financial approval are outside this proof." }, null, 2), contentType: "application/json" })
    } finally { await installation.stop() }
  }
})
