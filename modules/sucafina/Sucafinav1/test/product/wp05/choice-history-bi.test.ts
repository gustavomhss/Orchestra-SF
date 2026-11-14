import { expect, test } from "bun:test"
import path from "node:path"
import { createStoredScenarioBiProjection } from "../../../product/analytics/stored-scenario.ts"
import { sameBiProjection } from "../../../product/analytics/projection.ts"
import type { StoredScenarioSelection } from "../../../product/analytics/stored-scenario.ts"
import type { DomainProjection } from "../../../product/contracts/context.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createRenewalChoiceHistory } from "../wp11/renewal-choice-fixture.ts"
import { inspectWp05Browser } from "./browser.ts"

type Phase = Awaited<ReturnType<typeof createRenewalChoiceHistory>>["before"]

async function persistAdvantage(phase: Phase, context: TrustedDomainContext) {
  const saved = await phase.results.write({ kind: "comparison", result: phase.advantageComparison, caseRef: phase.caseRef, requestDigest: digestSfValue({ scenarioRefs: [phase.selectedRef, phase.baselineRef], criteria: [] }), sourceRefs: phase.sourceRefs, idempotencyKey: `bi-advantage-${phase.caseRef.version}` }, context)
  if (saved.status !== "ok" || saved.value.kind !== "comparison") throw new Error(`Canonical inverse comparison persistence unavailable: ${JSON.stringify(saved)}`)
  expect(saved.value.result).toEqual(phase.advantageComparison)
  return saved.value.resultRef
}

/** Real current-version results and source replay; a historical result is never relabeled as current. */
function consumer(phase: Phase, host: Pick<DomainPortHost, "revalidate">, advantageComparisonRef: string) {
  const selection = { selectionRef: `same-case:${phase.caseRef.id}:${phase.caseRef.version}`, scenarioResultRef: phase.selectedRef, comparisonRef: phase.comparisonRef, advantageComparisonRef }
  const readProjection: Parameters<typeof createStoredScenarioBiProjection>[0]["readProjection"] = async (reference, context) => {
    if (reference !== selection.selectionRef || !await host.revalidate(context)) return { status: "denied", reason: "selection-unavailable" }
    const value = await phase.planner.compareForecast({ baseRef: phase.scenario.baseRef, candidateRef: phase.scenario.baseRef, period: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD" }, context)
    return value.status === "ok" ? { status: "ok", value: value.value.candidate } : value
  }
  const read = createStoredScenarioBiProjection({ results: phase.results, readProjection,
    revalidateProjection: async (selected, projection, caseRef, context) => {
      if (digestSfValue(selected) !== digestSfValue(selection) || digestSfValue(caseRef) !== digestSfValue(phase.caseRef)) return false
      const current = await phase.cases.read({ caseRef: encodeCaseRef(caseRef) }, context)
      const source = await readProjection(selection.selectionRef, context)
      return current.status === "ok" && current.value.case.version === caseRef.version && source.status === "ok" && sameBiProjection(source.value, projection) && await host.revalidate(context)
    },
  })
  return { selection, read }
}

test("same-case BI preserves the human choice while the confirmed training revision changes its current source result and table", async () => {
  const history = await createRenewalChoiceHistory()
  try {
    const beforeReader = consumer(history.before, history.fixture.host, await persistAdvantage(history.before, history.fixture.context))
    const before = await beforeReader.read(beforeReader.selection, history.fixture.context)
    expect(before.status).toBe("ok")
    if (before.status !== "ok" || before.value.decision?.kind !== "scenario") throw new Error(`Original current BI unavailable: ${JSON.stringify(before)}`)
    expect(before.value.decision.scenario.knownSubtotal).toBe(210000)
    expect(before.value.decision.scenario.total).toBeNull()
    expect(before.value.decision.scenario.costCoverage.coverageState).toBe("pending")
    expect(before.value.decision.scenario.components.some((component) => component.id.startsWith("training:"))).toBe(false)
    expect(history.before.advantageComparison.knownDifference).toBe(30000)
    expect(before.value.comparison?.comparisonRef).toBe(beforeReader.selection.advantageComparisonRef)
    expect(before.value.comparison?.values.find((row) => row.id === "scenario:advantage-known-difference")?.value).toBe(30000)
    expect(before.value.comparison?.values.find((row) => row.id === "scenario:advantage-known-difference")?.sourceRefs).toEqual(history.before.sourceRefs)
    expect(history.before.sourceRefs.map((ref) => ref.refId)).toContain(history.before.scenario.baseRef)
    expect(history.before.sourceRefs.map((ref) => ref.refId)).toContain(history.before.baselineScenario.baseRef)
    const originalProjection = structuredClone(before.value)
    const built = await Bun.build({ entrypoints: [path.resolve(import.meta.dir, "../../../product/analytics/view.ts")], target: "browser", format: "esm" })
    if (!built.success || !built.outputs[0]) throw new Error("Same-case BI bundle unavailable")
    const url = `data:text/javascript;base64,${Buffer.from(await built.outputs[0].text()).toString("base64")}`
    await renderObservation({ label: "before", projection: before.value, selection: beforeReader.selection }, url)
    const chosen = await history.choose()
    const originalChoice = structuredClone(chosen.choice)
    expect(originalChoice.result).toEqual(before.value.decision.scenario)
    expect(originalChoice.comparisonStatus).toBe("conditioned")
    const afterPhase = await history.resolveTraining()
    expect(afterPhase.caseRef.id).toBe(history.before.caseRef.id)
    expect(afterPhase.caseRef.incarnation).toBe(history.before.caseRef.incarnation)
    expect(afterPhase.caseRef.version).toBeGreaterThan(chosen.caseRef.version)
    const afterReader = consumer(afterPhase, history.fixture.host, await persistAdvantage(afterPhase, history.fixture.context))
    const after = await afterReader.read(afterReader.selection, history.fixture.context)
    expect(after.status).toBe("ok")
    if (after.status !== "ok" || after.value.decision?.kind !== "scenario") throw new Error(`Revised current BI unavailable: ${JSON.stringify(after)}`)
    expect(after.value.decision.scenario.knownSubtotal).toBe(250000)
    expect(after.value.decision.scenario.total).toBe(250000)
    expect(after.value.decision.scenario.costCoverage.coverageState).toBe("complete")
    expect(after.value.decision.scenario.components.find((component) => component.id === "training:11")).toMatchObject({ amount: 40000, evidenceState: "confirmed", currency: "USD" })
    expect(after.value.decision.comparison.comparisonStatus).toBe("complete")
    expect(afterPhase.advantageComparison.knownDifference).toBe(-10000)
    expect(afterPhase.advantageComparison.completeDifference).toBe(-10000)
    expect(after.value.comparison?.comparisonRef).toBe(afterReader.selection.advantageComparisonRef)
    expect(after.value.comparison?.values.find((row) => row.id === "scenario:advantage-known-difference")?.value).toBe(-10000)
    expect(after.value.comparison?.values.find((row) => row.id === "scenario:advantage-known-difference")?.sourceRefs).toEqual(afterPhase.sourceRefs)
    expect(afterPhase.sourceRefs.map((ref) => ref.refId)).toContain(afterPhase.scenario.baseRef)
    expect(afterPhase.sourceRefs.map((ref) => ref.refId)).toContain(afterPhase.baselineScenario.baseRef)
    expect(after.value.decision.scenarioResultRef).not.toBe(before.value.decision.scenarioResultRef)
    const current = await afterPhase.cases.read({ caseRef: encodeCaseRef(afterPhase.caseRef) }, history.fixture.context)
    if (current.status !== "ok") throw new Error(`Updated case unavailable: ${JSON.stringify(current)}`)
    expect(current.value.case.choices.find((choice) => choice.id === originalChoice.id)).toEqual(originalChoice)
    expect(current.value.case.preparedChanges).toHaveLength(0)
    expect(current.value.case.receipts).toHaveLength(0)
    expect(current.value.case.state).not.toBe("applied")
    expect(before.value).toEqual(originalProjection)
    const stale = await beforeReader.read(beforeReader.selection, history.fixture.context)
    expect(stale.status).not.toBe("ok")
    expect(stale).not.toHaveProperty("value")

    await renderObservation({ label: "after", projection: after.value, selection: afterReader.selection }, url)
    const finalCase = await afterPhase.cases.read({ caseRef: encodeCaseRef(afterPhase.caseRef) }, history.fixture.context)
    if (finalCase.status !== "ok") throw new Error("Current case unavailable after read-only BI")
    expect(finalCase.value.case.choices.find((choice) => choice.id === originalChoice.id)).toEqual(originalChoice)
  } finally { await history.cleanup() }
}, 180000)

async function renderObservation(observation: { label: "before" | "after"; projection: DomainProjection; selection: StoredScenarioSelection }, url: string) {
  await inspectWp05Browser(`same-case ${observation.label} training`, async (page, phase) => {
    phase("module-import")
    await page.evaluate(async (url) => { const module = await import(url); if (typeof module.renderBiView !== "function") throw new Error("BI renderer export unavailable") }, url)
    phase(`render:${observation.label}`)
    await page.evaluate(async ({ url, observation }) => {
      const module = await import(url)
      document.body.replaceChildren()
      document.body.append(module.renderBiView({ viewId: "BI09", selectionRef: observation.selection.selectionRef, period: observation.projection.context.period }, observation.projection, () => {}, { viewId: "BI09", series: [], limitations: [] }, {
        openSource: (source: unknown) => { document.body.dataset.source = JSON.stringify(source) },
        openEvidence: (reference: unknown) => { document.body.dataset.evidence = JSON.stringify(reference) },
        openResult: (reference: string) => { document.body.dataset.result = reference },
      }))
    }, { url, observation })
    phase(`table:${observation.label}`)
    const decision = observation.projection.decision
    if (decision?.kind !== "scenario") throw new Error("Decision disappeared from its captured observation")
    const table = page.getByRole("table", { name: "Componentes fornecidos pelo domínio", exact: true })
    const rows = await table.locator("tbody tr").evaluateAll((rows) => rows.map((row) => Array.from(row.querySelectorAll("td")).slice(0, 5).map((cell) => cell.textContent)))
    expect(rows).toEqual(decision.scenario.components.map((component) => [component.id, component.amount === null || component.evidenceState === "absent" ? "Indisponível" : String(component.amount), component.currency, `${component.period.start} – ${component.period.end}`, component.evidenceState]))
    const timeline = page.locator('svg[aria-label="Períodos no horizonte selecionado; os detalhes estão na lista seguinte"] [role="button"]')
    expect(await timeline.count()).toBe(decision.scenario.components.filter((component) => component.sourceRefs.length).length)
    const text = await page.locator("body").innerText()
    expect(text).toContain(`Comparação de custos: alternativa ${decision.comparison.alternativeResultRef} menos referência ${decision.comparison.baselineResultRef}.`)
    expect(text).toContain("Diferença negativa indica custo conhecido menor da alternativa; positiva indica custo conhecido maior.")
    const advantage = page.getByRole("region", { name: "Vantagem conhecida da alternativa", exact: true })
    const advantageTable = advantage.getByRole("table", { name: "Vantagem fornecida pela comparação persistida", exact: true })
    const advantageCells = await advantageTable.locator("tbody tr td").allTextContents()
    expect(advantageCells.slice(0, 5)).toEqual(["Vantagem conhecida (referência − alternativa)", observation.label === "before" ? "30000" : "-10000", "USD", "2027-01-01 – 2027-12-31", observation.label === "before" ? "Condicionada" : "Completa"])
    expect(await advantage.innerText()).toContain(`Vantagem (referência − alternativa): resultado ${decision.comparison.baselineResultRef} menos ${decision.comparison.alternativeResultRef}.`)
    const advantageBar = advantage.locator("svg rect")
    expect(await advantageBar.count()).toBe(1)
    expect(await advantageBar.getAttribute("aria-label")).toBe(observation.label === "before" ? "30000 USD; Condicionada" : "-10000 USD; Completa")
    expect(Number(await advantageBar.getAttribute("height"))).toBeGreaterThan(0)
    expect(await advantage.locator("svg").getAttribute("aria-label")).toBe(observation.label === "before" ? "Vantagem conhecida (referência − alternativa): 30000 USD; Condicionada" : "Vantagem conhecida (referência − alternativa): -10000 USD; Completa")
    await advantage.getByRole("button", { name: "Abrir comparação de vantagem", exact: true }).click()
    expect(await page.locator("body").getAttribute("data-result")).toBe(observation.selection.advantageComparisonRef ?? null)
    const advantageValue = observation.projection.comparison?.values.find((row) => row.id === "scenario:advantage-known-difference")
    if (!advantageValue?.sourceRefs.length) throw new Error("Canonical advantage sources unavailable")
    for (const source of advantageValue.sourceRefs) {
      await advantage.getByRole("button", { name: `Abrir fonte ${source.refId}`, exact: true }).click()
      expect(JSON.parse(await page.locator("body").getAttribute("data-evidence") ?? "null")).toEqual(source)
    }
    if (observation.label === "before") {
      expect(await advantage.innerText()).toContain("Valor conhecido condicionado às pendências do resultado persistido.")
      expect(rows.some((row) => row[0]?.startsWith("training:"))).toBe(false)
      expect(text).toContain("total: indisponível")
      expect(text).toContain("training: pendente")
      expect(decision.comparison.knownDifference).toBe(-30000)
      expect(text).toContain("diferença conhecida (alternativa − referência): -30000")
    } else {
      expect(rows.find((row) => row[0] === "training:11")?.[1]).toBe("40000")
      expect(text).toContain("Completa · USD")
      expect(text).toContain("total: 250000")
      expect(decision.comparison.knownDifference).toBe(10000)
      expect(text).toContain("diferença conhecida (alternativa − referência): 10000")
      const componentIndex = decision.scenario.components.findIndex((component) => component.id === "training:11")
      const component = decision.scenario.components[componentIndex]!
      const mark = timeline.nth(componentIndex)
      phase("training-origin")
      await mark.click()
      expect(JSON.parse(await page.locator("body").getAttribute("data-source") ?? "null")).toEqual(component.sourceRefs[0])
      await page.evaluate(() => { delete document.body.dataset.source })
      await mark.focus()
      await page.keyboard.press("Enter")
      expect(JSON.parse(await page.locator("body").getAttribute("data-source") ?? "null")).toEqual(component.sourceRefs[0])
      const trainingRow = table.getByRole("row").filter({ has: page.getByRole("cell", { name: "training:11", exact: true }) })
      await trainingRow.getByRole("button").first().click()
      expect(JSON.parse(await page.locator("body").getAttribute("data-source") ?? "null")).toEqual(component.sourceRefs[0])
    }
  })
}
