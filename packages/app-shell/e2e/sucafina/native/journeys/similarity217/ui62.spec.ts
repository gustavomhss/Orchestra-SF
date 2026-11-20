import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../../fixture"
import { nativeOwnerQuery, type NativeTarget } from "../../fixture/manifest-contract.ts"

test.describe.configure({ retries: 0 })
test.use({ trace: "off" })

/**
 * Real web-installed UI62 and its original F02/C09/Atlas sources.
 * No page.route, fake session, mocked response or skipped proof. 214 must
 * provide the actual installed authorized C09 source + committed C17 precedent
 * as inputs, not synthetic IDs constructed in this spec.
 */
function proofInputs() {
  const source = process.env.SF_NATIVE_SIMILAR217_SOURCE_REF
  const precedent = process.env.SF_NATIVE_SIMILAR217_PRECEDENT_REF
  const precedentId = process.env.SF_NATIVE_SIMILAR217_PRECEDENT_ID
  if (!source || !precedent || !precedentId || !/^case:[^:]+:[^:]+$/.test(source) ||
    !/^case:[^:]+:[^:]+$/.test(precedent) || source === precedent)
    throw new Error("214 must provide real original C09 source and C17 Atlas precedent refs for UI62")
  return { source, precedent, precedentId }
}
function installedUrl(target: NativeTarget) {
  const url = new URL("/orchestra/sf-memory/cases", target.shellOrigin)
  url.search = nativeOwnerQuery(target).toString()
  return url.href
}

test("217-UI62 — real case list → original selection → Atlas match → explanation → original detail", async ({ page, nativeHarness }) => {
  const { source, precedent, precedentId } = proofInputs()
  const target = nativeHarness.manifest.target
  await page.goto(installedUrl(target))
  const root = page.locator('[data-sf-surface="UI62"]')
  await expect(root).toBeVisible()
  // Existing authenticated projection.cases; no client-side memory catalog.
  const original = root.getByLabel(/Original decision case|Caso de decisão original/)
  await expect(original.locator('option[value="' + source + '"]')).toHaveCount(1)
  await original.selectOption(source)
  await expect(root.getByText(/Source case version|Versão do caso de origem/)).toBeVisible({ timeout: 30_000 })
  const candidate = root.locator('input[type="checkbox"][value="' + precedent + '"]')
  await expect(candidate).toBeVisible()
  await candidate.check()
  await root.getByLabel(/Recall question|Pergunta para recuperar memória/).fill("Explain original documented decision features")
  const read = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "memory-similar-cases")
  const action = root.getByRole("button", { name: /Find similar cases|Buscar casos semelhantes/ })
  await action.focus()
  await page.keyboard.press("Enter")
  const response = await read
  expect(response.request().method()).toBe("POST")
  expect(new URL(response.url()).searchParams.has("query")).toBe(false)
  expect(response.headers()["cache-control"]).toContain("no-store")
  const body = await response.json()
  expect(body.status).toBe("ok")
  expect(body.matches.some((match: { caseRef: { id: string } }) => match.caseRef.id === precedentId)).toBe(true)
  const row = root.locator('[data-sf-similar-case="' + precedentId + '"]')
  await expect(row).toBeVisible()
  await expect(row.getByRole("heading", { name: /Why related|Por que são relacionados/ })).toBeVisible()
  await expect(row).toContainText("decision-type")
  await expect(row.getByText(/Atlas memory event|Evento de memória Atlas/)).toBeVisible()
  const opening = page.waitForResponse((value) =>
    new URL(value.url()).pathname.endsWith("/api/ui/projections/case"))
  await row.getByRole("button", { name: /Open original case|Abrir caso original/ }).click()
  const detail = await opening
  expect(detail.request().method()).toBe("GET")
  await expect(root.locator("[data-sf-similar-detail]")).toContainText(/Original objective|Objetivo original/)
})

test("217-UI62 — current source/version, keyboard and 320px reflow retain source boundaries", async ({ page, nativeHarness }) => {
  const { source } = proofInputs()
  const target = nativeHarness.manifest.target
  await page.setViewportSize({ width: 320, height: 900 })
  await page.goto(installedUrl(target))
  const root = page.locator('[data-sf-surface="UI62"]')
  await expect(root).toBeVisible()
  await root.getByLabel(/Original decision case|Caso de decisão original/).selectOption(source)
  await expect(root.getByText(/Source case version|Versão do caso de origem/)).toBeVisible()
  await expect(root.getByRole("button", { name: /Find similar cases|Buscar casos semelhantes/ })).toBeDisabled()
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(root).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1)
    expect(overflow, "UI62 must not overflow after reflow").toBe(false)
  }
})

test("217-UI62 — change to another installed project never carries the previous case list or Atlas result", async ({ page, nativeHarness }) => {
  const { source, precedent } = proofInputs()
  const target = nativeHarness.manifest.target
  await page.goto(installedUrl(target))
  const root = page.locator('[data-sf-surface="UI62"]')
  await expect(root).toBeVisible()
  await root.getByLabel(/Original decision case|Caso de decisão original/).selectOption(source)
  await root.locator('input[type="checkbox"][value="' + precedent + '"]').check()
  await root.getByLabel(/Recall question|Pergunta para recuperar memória/).fill("Compare only the authorized original context")
  await root.getByRole("button", { name: /Find similar cases|Buscar casos semelhantes/ }).click()
  await expect(root.locator("[data-sf-similar-matches]")).toBeVisible()
  const rejected = installedUrl(nativeHarness.manifest.wrongTeam)
  await page.goto(rejected)
  await expect(page.locator("#sf-team-content").getByRole("alert")
    .filter({ hasText: /^(This Team is not available for this account\.|Esta equipe não está disponível para esta conta\.)$/ })).toBeVisible()
  await expect(page).toHaveURL(rejected)
  await expect(root).toHaveCount(0)
  await expect(page.locator("[data-sf-similar-matches], [data-sf-similar-detail]")).toHaveCount(0)
})
