import { expect, test, type Page, type TestInfo } from "@playwright/test"

// Live installed N30 journeys. No fixtures, mocked responses or skips.
// 120 supplies a real native shell/owner and source-owned case/condition IDs.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

function installed(info: TestInfo) {
  const origin = process.env.SF_NATIVE_APP_ORIGIN ?? info.project.use.baseURL
  if (!origin) throw new Error("CI120 must supply SF_NATIVE_APP_ORIGIN or Playwright baseURL")
  return origin
}
function realCase() {
  const caseId = process.env.SF_NATIVE_N30_CASE_ID
  const incarnation = process.env.SF_NATIVE_N30_CASE_INCARNATION
  const version = process.env.SF_NATIVE_N30_CASE_VERSION
  if (!caseId || !incarnation || !version || !/^\d+$/.test(version) || Number(version) < 1)
    throw new Error("CI120 must provide the real N30 case ID, incarnation and version")
  return { caseId, incarnation, version }
}
async function navigate(page: Page, info: TestInfo, path: string, surface: string) {
  await page.goto(new URL(path, installed(info)).toString())
  const root = page.locator('[data-sf-surface="' + surface + '"]')
  await expect(root).toBeVisible()
  return root
}
async function openOriginalCase(page: Page, info: TestInfo, path: string, surface: string) {
  const source = realCase()
  const root = await navigate(page, info, path, surface)
  await root.getByLabel(/Case ID|ID do caso/).fill(source.caseId)
  await root.getByLabel(/Case incarnation|Instância do caso/).fill(source.incarnation)
  await root.getByLabel(/Case version|Versão do caso/).fill(source.version)
  const conditions = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "memory-conditions")
  const signals = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "memory-signals")
  await root.getByRole("button", { name: /Read authorized case|Consultar caso autorizado/ }).click()
  const responses = await Promise.all([conditions, signals])
  for (const response of responses) {
    expect(response.request().method()).toBe("GET")
    expect(response.headers()["content-type"]).toContain("application/json")
    const url = new URL(response.url())
    expect(url.searchParams.get("caseId")).toBe(source.caseId)
    expect(url.searchParams.get("incarnation")).toBe(source.incarnation)
    expect(url.searchParams.get("version")).toBe(source.version)
  }
  await expect(root.getByRole("button", { name: /Refresh authorized readings|Atualizar leituras autorizadas/ })).toBeEnabled()
  return root
}

test("U26-AC01 — read real conditions/signals against the original current owner", async ({ page }, info) => {
  info.annotations.push({ type: "criteria", description: "UI61 / source-locked memory-conditions and memory-signals. No synthetic case" })
  const root = await openOriginalCase(page, info, "/orchestra/sf-memory/signals", "UI61")
  await expect(root.getByRole("heading", { name: /Recorded conditions|Condições registradas/ })).toBeVisible()
  await expect(root.getByRole("heading", { name: /Reconsideration signals|Sinais de reavaliação/ })).toBeVisible()
  await expect(root.locator("[data-sf-memory-outcome]")).toHaveCount(0)
})

test("U26-AC02 — materiality preserves selected condition ID and source scope", async ({ page }, info) => {
  info.annotations.push({ type: "dependency", description: "Requires a real materiality condition in SF_NATIVE_N30_CONDITION_ID" })
  const conditionId = process.env.SF_NATIVE_N30_CONDITION_ID
  if (!conditionId) throw new Error("CI120 must provide one real admitted condition ID")
  const root = await openOriginalCase(page, info, "/orchestra/sf-memory/signals", "UI61")
  const selected = root.locator('[data-sf-condition-id="' + conditionId + '"]')
  await expect(selected).toHaveCount(1)
  const materiality = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "memory-materiality")
  await selected.getByRole("button", { name: /Review condition|Revisar condição/ }).click()
  const response = await materiality
  expect(response.request().method()).toBe("GET")
  expect(new URL(response.url()).searchParams.get("conditionId")).toBe(conditionId)
  await expect(root.locator("[data-sf-memory-materiality]")).toBeVisible()
  await expect(root.locator("[data-sf-memory-materiality]")).toContainText(/Materiality|Materialidade/)
})

test("U26-AC03 — observed comparison discloses cutoff and refuses causal attribution", async ({ page }, info) => {
  info.annotations.push({ type: "dependency", description: "Requires real comparable choice SF_NATIVE_N30_CHOICE_ID from producer" })
  const choiceId = process.env.SF_NATIVE_N30_CHOICE_ID
  if (!choiceId) throw new Error("CI120 must provide one real comparable choice ID")
  const root = await openOriginalCase(page, info, "/orchestra/sf-memory/outcomes", "UI63")
  const selected = root.locator('[data-sf-choice-id="' + choiceId + '"]')
  await expect(selected).toHaveCount(1)
  const outcome = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "memory-outcome")
  await selected.getByRole("button", { name: /Review choice outcome|Revisar resultado da escolha/ }).click()
  const response = await outcome
  expect(response.request().method()).toBe("GET")
  expect(new URL(response.url()).searchParams.get("choiceId")).toBe(choiceId)
  await expect(root.locator("[data-sf-memory-outcome]")).toBeVisible()
  await expect(root.locator("[data-sf-memory-outcome]")).toContainText(/Observation cutoff|Data-limite da observação/)
  await expect(root.locator("[data-sf-memory-outcome]")).toContainText(/No causal attribution|Nenhuma causalidade/)
})

test("U26 source-linked UI62 — original catalog selector, not permanent unavailable", async ({ page }, info) => {
  info.annotations.push({ type: "dependency", description: "Requires 211 applied 217 operation + real C09/C17 source" })
  const root = await navigate(page, info, "/orchestra/sf-memory/cases", "UI62")
  await expect(root.getByLabel(/Original decision case|Caso de decisão original/)).toBeVisible()
  // The richer two-actor recall and original source proof is in similarity217/ui62.spec.ts.
})

test("U26 responsive — owner-scoped page survives 320/768/1024/1280/1440 viewports", async ({ page }, info) => {
  info.annotations.push({ type: "criteria", description: "Layout smoke only, not an installed qualification verdict" })
  const root = await navigate(page, info, "/orchestra/sf-memory/signals", "UI61")
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(root).toBeVisible()
    await expect.poll(async () => root.evaluate((element) => element.getBoundingClientRect().width <= window.innerWidth + 1)).toBe(true)
  }
})
