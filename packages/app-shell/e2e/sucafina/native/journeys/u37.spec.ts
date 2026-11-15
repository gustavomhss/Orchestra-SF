import { expect, test, type Page, type TestInfo } from "@playwright/test"

// N30/U37 tests are authored for 120's installed native harness. No mocks,
// source-state injections, local test invocations or synthetic model sessions.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

function origin(info: TestInfo) {
  const value = process.env.SF_NATIVE_APP_ORIGIN ?? info.project.use.baseURL
  if (!value) throw new Error("CI120 must supply the installed F01 native shell origin")
  return value
}
function caseRef() {
  const id = process.env.SF_NATIVE_N30_CASE_ID
  const incarnation = process.env.SF_NATIVE_N30_CASE_INCARNATION
  if (!id || !incarnation) throw new Error("CI120 must provide a real authorized case ID and incarnation")
  return "case:" + encodeURIComponent(id) + ":" + encodeURIComponent(incarnation)
}
function routeRef(ref: string) { return "r_" + Buffer.from(ref, "utf8").toString("base64url") }
function isAnalysis(response: import("@playwright/test").Response, action: string) {
  const request = response.request()
  const url = new URL(response.url())
  if (url.searchParams.get("sf") !== "workbench-analysis" || request.method() !== "POST") return false
  const body: unknown = request.postDataJSON()
  return !!body && typeof body === "object" && "action" in body && body.action === action
}
async function open(page: Page, info: TestInfo, runRef?: string) {
  const ref = routeRef(caseRef())
  const suffix = runRef ? "/" + routeRef(runRef) : ""
  const choices = page.waitForResponse((response) => isAnalysis(response, "choices"))
  await page.goto(new URL("/orchestra/sf-decisions/" + ref + "/analyses" + suffix, origin(info)).toString())
  const response = await choices
  expect(response.headers()["content-type"]).toContain("application/json")
  expect(response.request().headers()["idempotency-key"]).toMatch(/^[a-zA-Z0-9._:-]{8,128}$/)
  const root = page.locator('[data-sf-surface="UI41"]')
  await expect(root).toBeVisible()
  await expect(root.getByRole("heading", { name: /Analysis history|Histórico de análises/ })).toBeVisible()
  return root
}

test("U37-AC01 — choices and history only use the authenticated case, never another owner", async ({ page }, info) => {
  info.annotations.push({ type: "criteria", description: "Real A15 choices and list; owner-bound F01 routeRef; no generic RPC" })
  const root = await open(page, info)
  const selected = await root.getByLabel(/Authorized case|Caso autorizado/).inputValue()
  expect(selected).toContain(process.env.SF_NATIVE_N30_CASE_ID!)
  await expect(root.getByLabel(/Admitted model|Modelo admitido/)).toBeVisible()
  await expect(root.getByRole("button", { name: /Load analysis history|Carregar histórico de análises/ })).toBeEnabled()
})

test("U37-AC02 — explicit prepare/review/start emits one original command with idempotency", async ({ page }, info) => {
  info.annotations.push({ type: "dependency", description: "CI120 must supply current case with installed sf-enquadrar-decisao and real model session" })
  const root = await open(page, info)
  const skill = root.getByLabel(/Analysis type|Tipo de análise/)
  const candidates = await skill.locator("option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value)
      .filter((value) => value.includes("sf-enquadrar-decisao")))
  expect(candidates).toHaveLength(1)
  await skill.selectOption(candidates[0]!)
  const model = root.getByLabel(/Admitted model|Modelo admitido/)
  const admitted = await model.locator("option").evaluateAll((options) =>
    options.map((option) => (option as HTMLOptionElement).value).filter(Boolean))
  expect(admitted.length).toBeGreaterThan(0)
  await model.selectOption(admitted[0]!)
  await root.getByLabel(/Analysis objective|Objetivo da análise/).fill("Evidence-grounded context of the real authorized decision")
  const preparation = page.waitForResponse((response) => isAnalysis(response, "prepare"))
  await root.getByRole("button", { name: /Prepare analysis|Preparar análise/ }).click()
  const prepared = await preparation
  expect((await prepared.json()).status).toBe("ok")
  const review = root.locator("[data-sf-analysis-review]")
  await expect(review).toBeVisible()
  await expect(review).toContainText(/server prepared|servidor preparou/)
  let starts = 0
  const listener = (request: import("@playwright/test").Request) => {
    const url = new URL(request.url())
    if (url.searchParams.get("sf") === "workbench-analysis" && request.postDataJSON()?.action === "start") starts++
  }
  page.on("request", listener)
  try {
    const start = page.waitForResponse((response) => isAnalysis(response, "start"))
    await review.getByRole("button", { name: /Confirm start|Confirmar início/ }).click()
    const response = await start
    expect(response.request().headers()["idempotency-key"]).toMatch(/^[a-zA-Z0-9._:-]{8,128}$/)
    expect((await response.json()).status).toBe("ok")
    expect(starts).toBe(1)
  } finally { page.off("request", listener) }
})

test("U37-AC03 — authorized output is escaped, not executed or mounted in an iframe", async ({ page }, info) => {
  info.annotations.push({ type: "dependency", description: "CI120 must provide SF_NATIVE_N30_READY_RUN_REF in the same real case" })
  const runRef = process.env.SF_NATIVE_N30_READY_RUN_REF
  if (!runRef) throw new Error("A real ready analysis run is required; never fabricate output HTML")
  const root = await open(page, info, runRef)
  const run = root.locator("[data-sf-analysis-run]")
  await expect(run).toBeVisible()
  await expect(run).toContainText(runRef)
  await run.getByRole("button", { name: /Read authorized result|Consultar resultado autorizado/ }).click()
  const original = root.locator(".sf-analyses-original")
  await expect(original).toBeVisible()
  await expect(root.locator("[data-sf-analysis-output] iframe")).toHaveCount(0)
  await expect(root.locator("[data-sf-analysis-output] script")).toHaveCount(0)
})

test("U37 cancellation — only an explicitly disposable real run is cancelled once", async ({ page }, info) => {
  info.annotations.push({ type: "dependency", description: "CI120 must create SF_NATIVE_N30_DISPOSABLE_RUN_REF in queued/running state; mutation is not replayed" })
  const runRef = process.env.SF_NATIVE_N30_DISPOSABLE_RUN_REF
  if (!runRef) throw new Error("Disallowed to cancel an unidentified or production run")
  const root = await open(page, info, runRef)
  const run = root.locator("[data-sf-analysis-run]")
  await expect(run).toBeVisible()
  await run.getByRole("button", { name: /Request cancellation|Solicitar cancelamento/ }).click()
  await expect(root).toContainText(/does not prove|não comprova/)
  const cancellation = page.waitForResponse((response) => isAnalysis(response, "cancel"))
  await root.getByRole("button", { name: /Confirm cancellation|Confirmar cancelamento/ }).click()
  const response = await cancellation
  expect(response.request().postDataJSON()).toEqual({ action: "cancel", runRef })
  expect(response.request().headers()["idempotency-key"]).toMatch(/^[a-zA-Z0-9._:-]{8,128}$/)
})

test("U37 responsive — run layout handles the original shell at five widths", async ({ page }, info) => {
  const root = await open(page, info)
  for (const width of [320, 768, 1024, 1280, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    await expect(root).toBeVisible()
    await expect.poll(async () => root.evaluate((node) => node.getBoundingClientRect().width <= window.innerWidth + 1)).toBe(true)
  }
})
