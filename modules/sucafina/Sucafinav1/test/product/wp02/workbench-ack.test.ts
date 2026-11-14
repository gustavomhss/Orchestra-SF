import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser, BrowserContext, Locator, Page } from "@playwright/test"
import { object, rows } from "../../../runtime/contract.ts"
import { closeWp01Browser, launchWp01Browser } from "../wp01/browser-fixture.ts"
import { createRecoveryFixture, initialCaseRef, storeExistingChoice } from "./workbench-recovery-fixture.ts"

type Fixture = Awaited<ReturnType<typeof createRecoveryFixture>>
type Attempt = { body: string | null; key: string | undefined; status: number; value: unknown }
let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

async function withWorkbench(check: (f: Fixture, page: Page, panel: Locator) => Promise<void>) {
  const f = await createRecoveryFixture()
  let context: BrowserContext | undefined
  try {
    context = await browser.newContext()
    const page = await context.newPage(), errors: string[] = []
    page.setDefaultTimeout(10_000)
    page.on("pageerror", (error) => errors.push(error.message))
    await page.goto(`${f.origin}/sucafina/auth/local?code=${await f.identity.enroll()}`)
    await page.goto(`${f.origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`)
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    const panel = page.locator("[data-dashboard-workbench]")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    await check(f, page, panel)
    expect(errors).toEqual([])
  } finally { try { await context?.close() } finally { await f.close() } }
}

async function damageDelivery(page: Page, mode: string, faults: readonly ((value: Record<string, unknown>) => unknown)[]) {
  const attempts: Attempt[] = []
  await page.route((url) => url.searchParams.get("sf") === mode, async (route) => {
    // Execute the authenticated producer and its durable transaction unchanged.
    // Corrupt only the ACK delivered after that real operation has completed.
    const response = await route.fetch(), result = object(await response.json())
    const fault = faults[attempts.length]
    attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status(), value: result.value })
    if (fault && response.status() === 200) await route.fulfill({ response, json: { ...result, value: fault(object(result.value)) } })
    else await route.fulfill({ response })
  })
  return attempts
}

async function recover(panel: Locator, attempts: Attempt[], faults: number, message: string) {
  for (let index = 0; index < faults; index++) {
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(index + 1)
    expect(attempts[index]!.status).toBe(200)
    expect(attempts[index]!.body).toBe(attempts[0]!.body)
    expect(attempts[index]!.key).toBe(attempts[0]!.key)
    expect(attempts[index]!.value).toEqual(attempts[0]!.value)
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBe("true")
    expect(await panel.getByText(message, { exact: false }).count()).toBe(0)
    expect(await panel.getByRole("button", { name: "Preservar retrato", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Preparar escolha", exact: true }).isDisabled()).toBe(true)
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
  }
  await panel.getByText(message, { exact: false }).waitFor()
  expect(attempts).toHaveLength(faults + 1)
  expect(attempts[0]!.key).toBeTruthy()
  expect(attempts.every((attempt) => attempt.status === 200 && attempt.body === attempts[0]!.body && attempt.key === attempts[0]!.key)).toBe(true)
  expect(attempts.at(-1)!.value).toEqual(attempts[0]!.value)
  expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBeNull()
  expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isVisible()).toBe(false)
}

async function editDraft(panel: Locator) {
  await panel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
  await panel.getByLabel(/^Rascunho/).selectOption("new")
  await panel.getByLabel(/^Hot Topic de origem/).selectOption({ label: "Original action" })
  await panel.getByLabel("Ação", { exact: true }).fill("ACK retained operational action")
  await panel.getByLabel("Notas", { exact: true }).fill("Private ACK draft explanation")
}

async function currentDraft(f: Fixture) {
  const listed = await f.read((context) => f.decisions.drafts.list({ caseRef: initialCaseRef }, context))
  if (listed.status !== "ok" || listed.value.length !== 1) throw new Error("Expected one real draft")
  const current = await f.read((context) => f.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: listed.value[0]!.draftRef }, context))
  if (current.status !== "ok") throw new Error("Real draft unavailable")
  return current.value
}

async function chooseDraft(f: Fixture, panel: Locator) {
  await editDraft(panel)
  await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
  await panel.getByText("Rascunho salvo.", { exact: false }).waitFor()
  await storeExistingChoice(f, await currentDraft(f))
  await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
  await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
  await panel.getByLabel("Escolha existente para preparar").selectOption({ index: 1 })
}

test("Dashboard does not acknowledge empty or malformed capture replies and recovers the one real capture", async () => {
  await withWorkbench(async (f, page, panel) => {
    const attempts = await damageDelivery(page, "dashboard-capture", [() => ({}), () => ({ captureId: "unrelated" })])
    await panel.getByLabel("Registro para preservar").selectOption({ label: "Original action" })
    await panel.getByRole("button", { name: "Preservar retrato", exact: true }).click()
    await recover(panel, attempts, 2, "Retrato do registro preservado.")
    const saved = await f.authority.state.read(f.request(), "preferences", (state) => Object.keys(state.preferences).filter((key) => key.startsWith("sf:dashboard-host:capture:")))
    expect(saved.status === "ok" && saved.value).toHaveLength(1)
    expect(await panel.getByLabel("Reunião ou retrato preservado").locator("option").count()).toBe(2)
    await panel.getByLabel("Reunião ou retrato preservado").selectOption({ index: 1 })
    await panel.getByRole("button", { name: "Abrir histórico", exact: true }).click()
    await panel.getByText("Histórico aberto com seu acesso atual.", { exact: true }).waitFor()
    expect(await panel.locator("[data-dashboard-history-view]").textContent()).toContain("Original action")
  })
}, 45_000)

test("Dashboard requires the requested review sections before acknowledging its real preserved meeting", async () => {
  await withWorkbench(async (f, page, panel) => {
    const attempts = await damageDelivery(page, "dashboard-review-preserve", [() => ({}), (value) => ({ ...value, sections: [] }),
      (value) => ({ ...value, sections: rows(value.sections).map((section) => ({ ...section, id: "other-section" })) })])
    await panel.getByRole("button", { name: "Pré-visualizar pauta", exact: true }).click()
    await panel.getByText("Pauta pronta para revisão.", { exact: true }).waitFor()
    await panel.getByRole("button", { name: "Preservar reunião", exact: true }).click()
    await recover(panel, attempts, 3, "Reunião preservada.")
    const saved = await f.authority.state.read(f.request(), "reviews", (state) => Object.values(state.reviews))
    expect(saved.status === "ok" && saved.value).toHaveLength(1)
    expect<unknown>(saved.status === "ok" && saved.value[0]).toEqual(attempts[0]!.value)
  })
}, 45_000)

test("Dashboard keeps the draft values and frozen request until its exact next-version receipt arrives", async () => {
  await withWorkbench(async (f, page, panel) => {
    const attempts = await damageDelivery(page, "dashboard-hot-topic-draft", [() => ({}), (value) => ({ ...value, version: Number(value.version) + 1 })])
    await editDraft(panel)
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("ACK retained operational action")
    expect(await panel.getByLabel("Notas", { exact: true }).inputValue()).toBe("Private ACK draft explanation")
    expect(await panel.getByLabel("Ação", { exact: true }).isDisabled()).toBe(true)
    expect(await panel.locator("form[data-dashboard-draft]").getAttribute("data-dirty")).toBe("true")
    await recover(panel, attempts, 2, "Rascunho salvo.")
    expect(await currentDraft(f)).toMatchObject({ version: 1, fields: { action: "ACK retained operational action", notes: "Private ACK draft explanation" } })
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
    expect(JSON.stringify(await page.evaluate(() => history.state))).not.toContain("Private ACK draft explanation")
  })
}, 45_000)

test("Dashboard does not acknowledge a preparation for another case choice or revision and replays one real preparation", async () => {
  await withWorkbench(async (f, page, panel) => {
    await chooseDraft(f, panel)
    const attempts = await damageDelivery(page, "dashboard-hot-topic-prepare", [() => ({}),
      (value) => ({ ...value, caseRef: { ...object(value.caseRef), incarnation: "other-case" } }),
      (value) => ({ ...value, choiceId: "other-choice" }),
      (value) => ({ ...value, caseRef: { ...object(value.caseRef), version: Number(object(value.caseRef).version) + 1 } })])
    await panel.getByRole("button", { name: "Preparar escolha", exact: true }).click()
    await recover(panel, attempts, 4, "Escolha preparada.")
    const saved = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    expect(saved.status === "ok" && saved.value?.version).toBe(3)
    expect(saved.status === "ok" && saved.value?.preparedChanges).toHaveLength(1)
    expect(saved.status === "ok" && saved.value?.receipts).toEqual([])
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
  })
}, 60_000)

test("Dashboard rejects an incomplete C12 ACK after the real commit and preserves its unresolved application correlation", async () => {
  await withWorkbench(async (f, page, panel) => {
    await chooseDraft(f, panel)
    await panel.getByRole("button", { name: "Preparar escolha", exact: true }).click()
    await panel.getByText("Escolha preparada.", { exact: false }).waitFor()
    await panel.getByLabel(/^Alteração preparada/).selectOption({ index: 1 })
    await panel.getByRole("button", { name: "Revisar alterações", exact: true }).click()
    await panel.getByText("Confira os valores atuais e propostos.", { exact: false }).waitFor()
    const reviewed = await panel.locator("[data-dashboard-review-view]").textContent()
    const attempts = await damageDelivery(page, "dashboard-hot-topic-apply", [(value) => ({ id: value.id, surface: value.surface, version: value.version, result: value.result })])
    await panel.getByLabel("Revisei os campos e confirmo estas alterações.").check()
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(200)
    const saved = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    expect<unknown>(saved.status === "ok" && saved.value?.receipts).toEqual([attempts[0]!.value])
    expect(saved.status === "ok" && saved.value?.preparedChanges[0]?.state).toBe("applied")
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("ACK retained operational action")
    expect(await panel.locator("[data-dashboard-review-view]").textContent()).toBe(reviewed)
    expect(await panel.getByText("Alterações aplicadas.", { exact: false }).count()).toBe(0)
    expect(await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isEnabled()).toBe(true)
    expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).application).toEqual({ body: attempts[0]!.body, key: attempts[0]!.key })
    // This is the ACK boundary, not the separately pending C12 reload/readback proof.
  })
}, 45_000)

test("Dashboard acknowledges the complete receipt of one real reviewed application", async () => {
  await withWorkbench(async (f, page, panel) => {
    await chooseDraft(f, panel)
    await panel.getByRole("button", { name: "Preparar escolha", exact: true }).click()
    await panel.getByText("Escolha preparada.", { exact: false }).waitFor()
    await panel.getByLabel(/^Alteração preparada/).selectOption({ index: 1 })
    await panel.getByRole("button", { name: "Revisar alterações", exact: true }).click()
    await panel.getByText("Confira os valores atuais e propostos.", { exact: false }).waitFor()
    await panel.getByLabel("Revisei os campos e confirmo estas alterações.").check()
    const delivered = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-hot-topic-apply")
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    const response = await delivered
    expect(response.status()).toBe(200)
    const receipt = object(await response.json()).value
    await panel.getByText("Alterações aplicadas. O comprovante foi registrado no caso.", { exact: false }).waitFor()
    const saved = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    expect<unknown>(saved.status === "ok" && saved.value?.receipts).toEqual([receipt])
    expect(saved.status === "ok" && saved.value?.preparedChanges[0]?.state).toBe("applied")
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("ACK retained operational action")
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBeNull()
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isVisible()).toBe(false)
    expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).application).toBeUndefined()
  })
}, 45_000)
