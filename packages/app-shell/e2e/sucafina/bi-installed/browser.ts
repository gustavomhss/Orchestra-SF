import { expect, type Page, type Response } from "@playwright/test"
import { asRecord } from "../decisions-support/journey"
import { horizon, records, type InstalledBiCorpus } from "./installed-fixture"

export async function showScenario(page: Page, origin: string, corpus: InstalledBiCorpus, kind: "missing" | "resolved", viewId: "BI09" | "BI10") {
  const comparison = corpus.comparisons[kind]
  const inverse = kind === "missing" ? corpus.comparisons.missingInverse : corpus.comparisons.resolvedInverse
  return showBi(page, origin, viewId, (label) => label.includes(`cenário ${corpus.scenarioRefs[kind]}`) && label.includes(`comparação ${comparison}`) && label.includes(`vantagem ${inverse}`))
}

export async function showBi(page: Page, origin: string, viewId: "BI09" | "BI10", choose: (label: string) => boolean) {
  const pending = page.waitForResponse(responseFor("bi-options", viewId))
  const response = await page.goto(`${origin}/sucafina/dashboard?${new URLSearchParams({ sf: "bi", viewId, start: horizon.start, end: horizon.end })}`)
  expect(response?.status()).toBe(200)
  expect(response?.headers()["content-type"]).toContain("text/html")
  expect(response?.headers()["content-security-policy"]).toContain("script-src")
  const optionsResponse = await pending
  expect(optionsResponse.status()).toBe(200)
  const options = asRecord(await optionsResponse.json())
  expect(options.status).toBe("ok")
  const selected = records(asRecord(options.value).choices).filter((choice) => choose(String(choice.label)))
  expect(selected, "The exact saved producer identities must be available under current authority").toHaveLength(1)
  const selection = page.getByLabel("Dados para visualizar", { exact: true })
  await selection.selectOption(String(selected[0]!.selectionRef))
  await expect(selection).toHaveValue(String(selected[0]!.selectionRef))
  const data = page.waitForResponse((response) => responseFor("bi-data", viewId)(response) && new URL(response.url()).searchParams.get("selectionRef") === selected[0]!.selectionRef)
  await page.getByRole("button", { name: "Atualizar visualização", exact: true }).click()
  const result = await biReply(await data)
  expect(asRecord(result.request)).toMatchObject({ selectionRef: selected[0]!.selectionRef, viewId, period: horizon })
  expect(asRecord(result.presentation).viewId).toBe(viewId)
  await expect(page.getByRole("table", { name: "Dados e referências", exact: true })).toBeVisible()
  await expect(page.getByRole("heading", { name: viewId === "BI09" ? "Quais parcelas sustentam a alternativa?" : "Qual data altera custo ou viabilidade?", exact: true })).toBeVisible()
  return result
}

export async function biReply(response: Response) {
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("application/json")
  const result = asRecord(await response.json())
  expect(asRecord(asRecord(result.projection).context)).toMatchObject({ period: horizon, currency: "USD" })
  expect(records(asRecord(result.projection).values).length).toBeGreaterThan(0)
  return result
}

export function responseFor(mode: string, viewId: string) {
  return (response: Response) => {
    const url = new URL(response.url())
    return response.request().method() === "GET" && url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode && url.searchParams.get("viewId") === viewId
  }
}

export function dataRow(page: Page, id: string) {
  return page.getByRole("table", { name: "Dados e referências", exact: true }).getByRole("row").filter({ has: page.getByRole("cell", { name: id, exact: true }) })
}

export async function expectValue(page: Page, id: string, value: string) {
  const row = dataRow(page, id)
  await expect(row).toHaveCount(1)
  await expect(row.getByRole("cell")).toHaveCount(7)
  await expect(row.getByRole("cell").nth(1)).toHaveText(value)
}

export async function expectAdvantage(page: Page, projection: Record<string, unknown>, comparisonRef: string, amount: number, state: "Completa" | "Condicionada") {
  const comparison = asRecord(projection.comparison)
  expect(comparison.comparisonRef).toBe(comparisonRef)
  expect(records(comparison.values).find((value) => value.id === "scenario:advantage-known-difference")?.value).toBe(amount)
  const table = page.getByRole("table", { name: "Vantagem fornecida pela comparação persistida", exact: true })
  await expect(table.locator("tbody > tr")).toHaveCount(1)
  await expect(table.locator("tbody > tr").getByRole("cell").nth(1)).toHaveText(String(amount))
  await expect(table.locator("tbody > tr").getByRole("cell").nth(4)).toHaveText(state)
  await expect(page.getByRole("img", { name: `Vantagem conhecida (referência − alternativa): ${amount} USD; ${state}`, exact: true })).toBeVisible()
}

export async function expectWaterfall(page: Page, result: Record<string, unknown>, initial: number, final: number) {
  const table = page.getByRole("table", { name: "Composição e origens", exact: true })
  const plan = asRecord(asRecord(result.presentation).waterfall)
  const segments = records(plan.segments)
  await expect(table.getByRole("columnheader")).toHaveText(["Componente", "Início", "Contribuição", "Fim", "Origem"])
  await expect(table.locator("tbody > tr")).toHaveCount(segments.length + 2)
  await expect(table.locator("tbody > tr").nth(0).getByRole("cell").nth(3)).toHaveText(String(initial))
  await expect(table.locator("tbody > tr").nth(segments.length + 1).getByRole("cell").nth(3)).toHaveText(String(final))
  const chart = page.getByRole("group", { name: "Waterfall de componentes; valores e fontes estão na tabela equivalente", exact: true })
  await expect(chart).toBeVisible()
  await expect(chart.locator("[data-bi-value]")).toHaveCount(segments.length + 2)
  const values = records(asRecord(result.projection).values)
  for (const [index, segment] of segments.entries()) {
    const amount = values.find((value) => value.id === segment.componentValueId)!.value
    expect(typeof amount).toBe("number")
    await expect(table.locator("tbody > tr").nth(index + 1).getByRole("cell").nth(2)).toHaveText(Number(amount) > 0 ? `+${amount}` : String(amount))
  }
}
