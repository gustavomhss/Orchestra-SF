import { expect, test, type Page, type Request } from "@playwright/test"

// These URLs and distinct identities are supplied by F04's installed, isolated
// REAL producer fixture when 114 composes P0. No route.fulfill, fake approvals,
// seeded "success" response or production-mocking here. Missing fixture is
// SKIPPED (not a passing product proof), and the 120 Actions runner owns dispatch.
const fixture = {
  draft: process.env.SF_NATIVE_P0_DRAFT_URL,
  rejected: process.env.SF_NATIVE_P0_REJECTED_URL,
  denied: process.env.SF_NATIVE_P0_SECOND_ACTOR_URL,
  stale: process.env.SF_NATIVE_P0_STALE_CAS_URL,
  lost: process.env.SF_NATIVE_P0_LOST_RESPONSE_URL,
}

test.use({ viewport: { width: 1280, height: 800 }, serviceWorkers: "block" })

function isTitleSave(request: Request) {
  const target = new URL(request.url())
  return request.method() === "POST" &&
    target.pathname.endsWith("/procurement") &&
    target.searchParams.get("page") === "Requests"
}

function titleEditor(page: Page) {
  return page.locator('[data-component="sf-request-title-save"]')
}

async function reviewTitle(page: Page, nextTitle: string) {
  const editor = titleEditor(page)
  const title = editor.getByRole("textbox", { name: "Title", exact: true })
  await expect(title).toBeEditable()
  await title.fill(nextTitle)
  await expect(
    editor.getByRole("button", { name: /Review title change|Revisar alteração do título/ }),
  ).toBeEnabled()
  await editor.getByRole("button", { name: /Review title change|Revisar alteração do título/ }).click()
  const confirm = editor.getByRole("button", { name: /^(Save|Salvar)$/ })
  await expect(confirm).toBeEnabled()
  return confirm
}

for (const [status, fixtureName] of [
  ["draft", "draft"],
  ["pr_rejected", "rejected"],
] as const) {
  test("P0 real " + status + ": only pr.title is submitted with producer CAS, persists after reload", async ({ page }) => {
    const target = fixture[fixtureName]
    test.skip(!target, "F04 real native P0 " + status + " installation/identity is not admitted")
    const newTitle = "P0 " + status + " title save from real producer"
    const requestBodies: unknown[] = []
    page.on("request", (request) => {
      if (isTitleSave(request)) requestBodies.push(request.postDataJSON())
    })
    const sourceResponse = page.waitForResponse((response) =>
      response.url().includes("/api/ui/pages/CAP25") && response.request().method() === "GET" && response.ok())
    await page.goto(target!)
    const source = await (await sourceResponse).json()
    const editor = titleEditor(page)
    await expect(editor.getByRole("textbox", { name: "Title" })).toBeEditable()

    // Wait is registered BEFORE the only save intent. The server, not the UI,
    // supplies successful mutation and the version actually used in CAS.
    const confirm = await reviewTitle(page, newTitle)
    const responsePromise = page.waitForResponse((response) => isTitleSave(response.request()))
    await confirm.click()
    const response = await responsePromise
    expect(response.status()).toBe(200)
    expect(await response.json()).toMatchObject({ ok: true })
    const command = response.request().postDataJSON()
    expect(command).toMatchObject({
      page: "Requests", action: "save", id: expect.any(String),
      version: expect.any(Number), values: { pr: { title: newTitle } },
    })
    expect(Object.keys(command.values)).toEqual(["pr"])
    expect(Object.keys(command.values.pr)).toEqual(["title"])
    expect(command.version).toBe(source.value.versions["requests:" + command.id].version)
    const headers = response.request().headers()
    expect(headers["idempotency-key"]).toMatch(/^[A-Za-z0-9._:-]{8,128}$/)
    expect(headers["x-sf-native-owner"]).toEqual(expect.any(String))
    expect(requestBodies).toHaveLength(1)
    await expect(editor.getByRole("status")).toContainText(/Changes saved|Alterações salvas/)

    // Success means an authorized refetch and persisted producer value, never
    // an optimistic echo of the edited text.
    await page.reload()
    await expect(titleEditor(page).getByRole("textbox", { name: "Title" })).toHaveValue(newTitle)
    expect(requestBodies).toHaveLength(1)
  })
}

test("P0 real second actor: no private title and no mutation", async ({ page }) => {
  test.skip(!fixture.denied, "F04 denied second-actor identity/source fixture is not admitted")
  const writes: unknown[] = []
  page.on("request", (request) => {
    if (isTitleSave(request)) writes.push(request.postData())
  })
  await page.goto(fixture.denied!)
  const editor = titleEditor(page)
  await expect(editor).toBeVisible()
  await expect(editor.getByRole("textbox", { name: "Title" })).toHaveCount(0)
  expect(writes).toHaveLength(0)
})

test("P0 real stale CAS/owner fence: rejected response never appears saved", async ({ page }) => {
  test.skip(!fixture.stale, "F04 stale producer-version/owner-fence fixture is not admitted")
  await page.goto(fixture.stale!)
  const confirm = await reviewTitle(page, "stale save must not overwrite")
  const responsePromise = page.waitForResponse((response) => isTitleSave(response.request()))
  await confirm.click()
  const result = await responsePromise
  expect(result.status()).toBe(409)
  await expect(titleEditor(page).getByText(/Changes saved|Alterações salvas/)).toHaveCount(0)
  await expect(titleEditor(page).getByRole("button", { name: /Review title change|Revisar alteração do título/ }))
    .toHaveCount(0)
})

test("P0 real lost response: one mutation, unknown result, no automatic retry", async ({ page }) => {
  test.skip(!fixture.lost, "F04 real post-commit response-loss injection is not admitted")
  const attempts: Request[] = []
  page.on("request", (request) => {
    if (isTitleSave(request)) attempts.push(request)
  })
  await page.goto(fixture.lost!)
  const confirm = await reviewTitle(page, "response-loss P0 preserved intent")
  await confirm.click()
  const editor = titleEditor(page)
  await expect(editor.getByRole("alert")).toContainText(/response was lost|resposta do salvamento foi perdida/)
  expect(attempts).toHaveLength(1)
  await editor.getByRole("button", { name: /Refresh source|Atualizar fonte/ }).click()
  await expect(editor.getByRole("alert")).toBeVisible()
  expect(attempts).toHaveLength(1)
})
