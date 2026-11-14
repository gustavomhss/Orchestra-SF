import { expect, test } from "bun:test"
import type { Page } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { launchBrowserDriver } from "./browser-driver-fixture.ts"
import { createRecoveryFixture, initialCaseRef, storeExistingChoice } from "./workbench-recovery-fixture.ts"

type RecoveryFixture = Awaited<ReturnType<typeof createRecoveryFixture>>

async function openWorkbench(page: Page, fixture: RecoveryFixture) {
  await page.goto(`${fixture.origin}/sucafina/auth/local?code=${await fixture.identity.enroll()}`)
  await page.goto(`${fixture.origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`)
  await page.locator("[data-dashboard-workbench-panel] > summary").click()
  const panel = page.locator("[data-dashboard-workbench]")
  await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
  await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
  return panel
}

async function editNewDraft(page: Page, action: string) {
  const panel = page.locator("[data-dashboard-workbench]")
  await panel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
  await panel.getByLabel(/^Rascunho/).selectOption("new")
  await panel.getByLabel(/^Hot Topic de origem/).selectOption({ label: "Original action" })
  await panel.getByLabel("Ação", { exact: true }).fill(action)
  await panel.getByLabel("Notas", { exact: true }).fill("Private operational explanation")
}

async function currentDraft(fixture: RecoveryFixture) {
  const available = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
  if (available.status !== "ok" || available.value.length !== 1) throw new Error("Exactly one saved draft is required")
  const current = await fixture.read((context) => fixture.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: available.value[0]!.draftRef }, context))
  if (current.status !== "ok") throw new Error("Saved draft unavailable")
  return current.value
}

test("Dashboard recovers a committed draft after response loss, restores only its authorized identity on reload, and fences revoked late discovery", async () => {
  expectSpawn(import.meta.path)
  const f = await createRecoveryFixture()
  const driver = await launchBrowserDriver("host-draft-recovery").catch(async (error) => { await f.close(); throw error })
  const release = Promise.withResolvers<void>(), delivered = Promise.withResolvers<void>()
  let revocationReleased = false
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await openWorkbench(page, f)
    const attempts: { body: string | null; key: string | undefined; status: number }[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-draft", async (route) => {
      // The real host commits and returns its real response. Only delivery to the browser is lost.
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status() })
      if (attempts.length === 1) await route.abort("failed")
      else await route.fulfill({ response })
    })
    await editNewDraft(page, "Retained private draft")
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(200)
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("Retained private draft")
    expect(await panel.getByLabel("Ação", { exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByLabel(/^Caso/).isDisabled()).toBe(true)
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBe("true")
    const committed = await currentDraft(f)
    expect(committed).toMatchObject({ version: 1, fields: { action: "Retained private draft" } })
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    await panel.getByText("Rascunho salvo.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(attempts[0]!.key).toBeTruthy()
    const recovered = await currentDraft(f)
    expect(recovered).toMatchObject({ id: committed.id, incarnation: committed.incarnation, version: 1, draftRef: committed.draftRef })
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
    const navigation = await page.evaluate(() => history.state)
    expect(object(object(navigation).sfDashboardWorkbench).draft).toEqual({ id: committed.id, incarnation: committed.incarnation, caseId: initialCaseRef.id, caseIncarnation: initialCaseRef.incarnation })
    expect(JSON.stringify(navigation)).not.toContain("Retained private draft")
    expect(JSON.stringify(navigation)).not.toContain("Private operational explanation")

    await page.reload()
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("Retained private draft")
    expect(await panel.getByLabel(/^Rascunho/).locator("option:checked").textContent()).toBe("Retained private draft")
    expect(await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).isDisabled()).toBe(true)
    expect(attempts).toHaveLength(2)

    const assembled = Promise.withResolvers<void>(), responses: number[] = [], deliveryErrors: unknown[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-workbench", async (route) => {
      try {
        const response = await route.fetch()
        responses.push(response.status()); assembled.resolve()
        await release.promise
        await route.fulfill({ response })
      } catch (error) { if (!revocationReleased) deliveryErrors.push(error) }
      finally { delivered.resolve() }
    })
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await assembled.promise
    expect(responses).toEqual([200])
    const before = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    if (before.status !== "ok" || !before.value) throw new Error("Case unavailable before participation removal")
    const removed = await f.authority.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: before.storageVersion,
      targetRef: initialCaseRef.id, targetIncarnation: initialCaseRef.incarnation, idempotencyKey: "withdraw-recovery-participation", commandDigest: digestSfValue({ withdraw: initialCaseRef }) }, async (state) => {
        const decision = state.cases[initialCaseRef.id]!
        state.cases[initialCaseRef.id] = { ...decision, version: decision.version + 1, participants: [] }
        return { commit: true, value: true }
      })
    expect(removed.status).toBe("ok")
    revocationReleased = true
    await page.evaluate(() => window.dispatchEvent(new Event("sf-access-revoked")))
    release.resolve(); await delivered.promise
    await panel.getByText("Seu acesso mudou. Reabra a página com o acesso atual.", { exact: true }).waitFor()
    expect(await panel.textContent()).not.toContain("Retained private draft")
    expect(await panel.locator("input, textarea, select").count()).toBe(0)
    expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).draft).toBeUndefined()
    expect(deliveryErrors).toEqual([])
    await page.unrouteAll({ behavior: "wait" })
    await page.reload()
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("")
    expect(await panel.getByLabel(/^Caso/).textContent()).not.toContain("Review the action")
    expect(await panel.textContent()).not.toContain("Retained private draft")
    expect(errors).toEqual([])
  } finally {
    release.resolve()
    try { await driver.close() } finally { await f.close() }
  }
  driver.report()
}, 60000)

test("Dashboard recovers the same C12 application receipt after a committed response is lost and the page reloads", async () => {
  expectSpawn(import.meta.path)
  const f = await createRecoveryFixture()
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await f.close(); throw error })
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await openWorkbench(page, f)
    await editNewDraft(page, "Applied once despite response loss")
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await panel.getByText("Rascunho salvo.", { exact: false }).waitFor()
    await storeExistingChoice(f, await currentDraft(f))
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    await panel.getByLabel("Escolha existente para preparar").selectOption({ index: 1 })
    await panel.getByRole("button", { name: "Preparar escolha", exact: true }).click()
    await panel.getByText("Escolha preparada.", { exact: false }).waitFor()
    await panel.getByLabel(/^Alteração preparada/).selectOption({ index: 1 })
    await panel.getByRole("button", { name: "Revisar alterações", exact: true }).click()
    await panel.getByText("Confira os valores atuais e propostos.", { exact: false }).waitFor()
    const reviewed = await panel.locator("[data-dashboard-review-view]").textContent()
    await panel.getByLabel("Revisei os campos e confirmo estas alterações.").check()
    const attempts: { key: string | undefined; body: string | null; status: number; receipt: unknown }[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-apply", async (route) => {
      const response = await route.fetch()
      attempts.push({ key: route.request().headers()["idempotency-key"], body: route.request().postData(), status: response.status(), receipt: object(await response.json()).value })
      if (attempts.length === 1) await route.abort("failed")
      else await route.fulfill({ response })
    })
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(200)
    expect(await panel.locator("[data-dashboard-review-view]").textContent()).toBe(reviewed)
    expect(await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Preparar escolha", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByLabel("Ação", { exact: true }).isDisabled()).toBe(true)
    const first = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    if (first.status !== "ok" || !first.value) throw new Error("Applied case unavailable")
    expect(first.value.receipts).toHaveLength(1)
    expect(first.value.preparedChanges[0]?.state).toBe("applied")
    const applied = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { action: rows(snapshot.data.hotTopics)[0]!.action, version: snapshot.versions["hotTopics:topic"]?.version } }))
    expect(applied.action).toBe("Applied once despite response loss")
    const navigation = await page.evaluate(() => history.state)
    expect(object(object(navigation).sfDashboardWorkbench).application).toEqual({ body: attempts[0]!.body, key: attempts[0]!.key })
    expect(JSON.stringify(navigation)).not.toContain("Applied once despite response loss")
    expect(JSON.stringify(navigation)).not.toContain("Private operational explanation")

    // A confirmed reload abandons the old document, but not the receipt correlation.
    page.once("dialog", (dialog) => void dialog.accept())
    await page.reload()
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    await panel.getByText("Há uma tentativa anterior para conferir.", { exact: false }).waitFor()
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isVisible()).toBe(false)
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções atualizadas com seu acesso atual.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isEnabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Preparar escolha", exact: true }).isDisabled()).toBe(true)
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    await panel.getByText("Alterações aplicadas. O comprovante foi registrado no caso.", { exact: true }).waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(attempts[0]!.key).toBeTruthy()
    const recovered = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    expect(recovered.status === "ok" && recovered.value?.receipts).toEqual(first.value.receipts)
    expect(recovered.status === "ok" && recovered.value?.version).toBe(first.value.version)
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { action: rows(snapshot.data.hotTopics)[0]!.action, version: snapshot.versions["hotTopics:topic"]?.version } }))).toEqual(applied)
    expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).application).toBeUndefined()
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBeNull()
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await f.close() } }
  driver.report()
}, 60000)
