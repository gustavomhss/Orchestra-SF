import { expect, test } from "bun:test"
import type { Page } from "@playwright/test"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../runtime/contract.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
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
    const retainedPanel = await panel.elementHandle()
    expect(retainedPanel).not.toBeNull()
    await page.evaluate(() => window.dispatchEvent(new Event("sf-access-revoked")))
    release.resolve(); await delivered.promise
    await page.locator("main[data-access-unavailable]").waitFor()
    expect(await retainedPanel!.evaluate((element) => element.textContent)).toContain("Seu acesso mudou. Reabra a página com o acesso atual.")
    expect(await retainedPanel!.evaluate((element) => element.textContent)).not.toContain("Retained private draft")
    expect(await retainedPanel!.evaluate((element) => element.querySelectorAll("input, textarea, select").length)).toBe(0)
    expect(await panel.locator("input, textarea, select").count()).toBe(0)
    expect(await panel.count()).toBe(0)
    expect(await page.evaluate(() => history.state)).toBeNull()
    expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).draft).toBeUndefined()
    await retainedPanel!.dispose()
    expect(deliveryErrors).toEqual([])
    await page.unrouteAll({ behavior: "wait" })
    await page.reload()
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("")
    expect(await panel.getByLabel(/^Caso/).textContent()).not.toContain("Review the action")
    expect(await panel.textContent()).not.toContain("Retained private draft")

    await panel.getByLabel("Registro para preservar").selectOption({ label: "Original action" })
    await panel.getByRole("button", { name: "Preservar retrato", exact: true }).click()
    await panel.getByText("Retrato do registro preservado.", { exact: true }).waitFor()
    await panel.getByLabel("Reunião ou retrato preservado").selectOption({ index: 1 })
    await panel.getByRole("button", { name: "Abrir histórico", exact: true }).click()
    await panel.getByText("Histórico aberto com seu acesso atual.", { exact: true }).waitFor()
    expect(await panel.locator("[data-dashboard-history-view]").textContent()).toContain("Original action")
    const version = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.versions["hotTopics:topic"]?.version ?? 0 }))
    const deleted = await fetch(`${f.origin}/sucafina/dashboard`, { method: "POST", headers: f.request().headers,
      body: JSON.stringify({ page: "Hot Topics & Actions", action: "delete", id: "topic", version, values: {}, confirmed: true }) })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toMatchObject({ ok: true })
    const discovery = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-workbench")
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    const discovered = await discovery
    expect(discovered.status()).toBe(200)
    expect(object(object(await discovered.json()).value).history).toEqual([])
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await panel.locator("[data-dashboard-history-view]").textContent()).toBe("")
    expect(await panel.getByLabel("Reunião ou retrato preservado").locator("option").count()).toBe(1)
    expect(errors).toEqual([])
  } finally {
    release.resolve()
    try { await driver.close() } finally { await f.close() }
  }
  driver.report()
}, 60000)

test("Dashboard retains the exact draft attempt when its first response is denied after the real host commits", async () => {
  expectSpawn(import.meta.path)
  const f = await createRecoveryFixture()
  const driver = await launchBrowserDriver("host-egress-recovery").catch(async (error) => { await f.close(); throw error })
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await openWorkbench(page, f)
    const register = f.decisions.drafts.register
    let committed: { draftRef: string; version: number } | undefined
    f.decisions.drafts.register = async (...args) => {
      const result = await register(...args)
      // The producer completed its real C08 transaction. Change authority before the
      // real HTTP egress check, which must produce the denied response itself.
      if (!committed && result.status === "ok") { committed = result.value; f.policy.writable = false }
      return result
    }
    const attempts: { body: string | null; key: string | undefined; status: number }[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-draft", async (route) => {
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status() })
      // Restore authority before delivery, so fresh discovery can prove the original
      // exact source again. The response remains the host's actual post-commit 403.
      if (attempts.length === 1) f.policy.writable = true
      await route.fulfill({ response })
    })
    await editNewDraft(page, "Committed before egress authority changed")
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await panel.getByText("Seu acesso não permite esta ação agora.", { exact: false }).waitFor()
    expect(committed?.version).toBe(1)
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(403)
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("Committed before egress authority changed")
    expect(await panel.getByLabel("Notas", { exact: true }).inputValue()).toBe("Private operational explanation")
    expect(await panel.locator("[data-dashboard-draft]").getAttribute("data-dirty")).toBe("true")
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBe("true")
    expect(await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isEnabled()).toBe(true)
    const before = await currentDraft(f)
    expect(before).toMatchObject({ draftRef: committed!.draftRef, version: committed!.version, fields: { action: "Committed before egress authority changed" } })
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    await panel.getByText("Rascunho salvo.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual({ ...attempts[0]!, status: 200 })
    expect(attempts[0]!.key).toBeTruthy()
    const recovered = await currentDraft(f)
    expect(recovered).toMatchObject({ id: before.id, incarnation: before.incarnation, draftRef: before.draftRef, version: 1 })
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBeNull()
    expect(await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await f.close() } }
  driver.report()
}, 60000)

test("Dashboard clears dirty draft consumers when the source disappears or is replaced under the same id while the case remains readable", async () => {
  expectSpawn(import.meta.path)
  const f = await createRecoveryFixture()
  const driver = await launchBrowserDriver("host-source-recovery").catch(async (error) => { await f.close(); throw error })
  try {
    const unsavedPage = await driver.browser.newPage(), replacementPage = await driver.browser.newPage(), savedPage = await driver.browser.newPage(), errors: string[] = []
    for (const page of [unsavedPage, replacementPage, savedPage]) page.on("pageerror", (error) => errors.push(error.message))
    const unsaved = await openWorkbench(unsavedPage, f)
    await editNewDraft(unsavedPage, "Private unsaved source wording")
    const replacement = await openWorkbench(replacementPage, f)
    await editNewDraft(replacementPage, "Private unsaved wording for original incarnation")
    const saved = await openWorkbench(savedPage, f)
    await editNewDraft(savedPage, "Private saved source wording")
    await saved.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await saved.getByText("Rascunho salvo.", { exact: false }).waitFor()
    expect((await currentDraft(f)).fields.action).toBe("Private saved source wording")
    await saved.getByLabel("Ação", { exact: true }).fill("Private later edits to saved source")
    const original = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: { row: rows(snapshot.data.hotTopics)[0]!,
      identity: sfSourceIdentity(snapshot, "hotTopics", "topic"), version: snapshot.versions["hotTopics:topic"]?.version ?? 0 } }))
    expect(original.identity).toBeDefined()
    const deleted = await fetch(`${f.origin}/sucafina/dashboard`, { method: "POST", headers: f.request().headers,
      body: JSON.stringify({ page: "Hot Topics & Actions", action: "delete", id: "topic", version: original.version, values: {}, confirmed: true }) })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toMatchObject({ ok: true })
    const assertPurged = async (page: Page, panel: Awaited<ReturnType<typeof openWorkbench>>, recordCount: number) => {
      const retainedPanel = await panel.elementHandle()
      expect(retainedPanel).not.toBeNull()
      const discovery = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-workbench")
      await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
      const response = await discovery
      expect(response.status()).toBe(200)
      const value = object(object(await response.json()).value), decisions = object(value.decisions)
      expect(rows(decisions.cases).map((entry) => object(entry.caseRef).id)).toContain(initialCaseRef.id)
      expect(decisions.drafts).toEqual([])
      expect(rows(value.records)).toHaveLength(recordCount)
      await page.locator("main[data-access-unavailable]").waitFor()
      expect(await retainedPanel!.evaluate((element) => element.textContent)).toContain("Seu acesso mudou. Reabra a página com o acesso atual.")
      expect(await retainedPanel!.evaluate((element) => element.querySelectorAll("input, textarea, select, button").length)).toBe(0)
      expect(await panel.locator("input, textarea, select, button").count()).toBe(0)
      expect(await retainedPanel!.evaluate((element) => element.textContent)).not.toContain("Private")
      expect(await panel.count()).toBe(0)
      expect(await page.evaluate(() => history.state)).toBeNull()
      expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).draft).toBeUndefined()
      await retainedPanel!.dispose()
    }
    await assertPurged(unsavedPage, unsaved, 0)
    // Seed an external replacement through the real scoped persistence after a canonical
    // delete. Identical public id and fields must not stand in for C17 incarnation proof.
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [structuredClone(original.row)]
      return { commit: true, value: undefined }
    })
    const replaced = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "hotTopics", "topic") }))
    expect(replaced).toBeDefined()
    expect(replaced!.incarnation).not.toBe(original.identity!.incarnation)
    await assertPurged(replacementPage, replacement, 1)
    await assertPurged(savedPage, saved, 1)
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await f.close() } }
  driver.report()
}, 60000)

test("Dashboard discards an uncertain private application review when fresh discovery no longer authorizes its case", async () => {
  expectSpawn(import.meta.path)
  const f = await createRecoveryFixture()
  const driver = await launchBrowserDriver("host-access-recovery").catch(async (error) => { await f.close(); throw error })
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await openWorkbench(page, f)
    await editNewDraft(page, "Private application retained only with case access")
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
    await panel.getByLabel("Revisei os campos e confirmo estas alterações.").check()
    const statuses: number[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-apply", async (route) => {
      const response = await route.fetch()
      statuses.push(response.status())
      if (statuses.length === 1) await route.abort("failed")
      else await route.fulfill({ response })
    })
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(statuses).toEqual([200])
    expect(await panel.locator("[data-dashboard-draft]").getAttribute("data-dirty")).toBeNull()
    expect(await panel.locator("[data-dashboard-review-view]").textContent()).toContain("Private application retained only with case access")
    const before = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    if (before.status !== "ok" || !before.value) throw new Error("Case unavailable before participation removal")
    expect(before.value.receipts).toHaveLength(1)
    const removed = await f.authority.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: before.storageVersion,
      targetRef: initialCaseRef.id, targetIncarnation: initialCaseRef.incarnation, idempotencyKey: "withdraw-uncertain-application", commandDigest: digestSfValue({ withdraw: initialCaseRef }) }, async (state) => {
        const decision = state.cases[initialCaseRef.id]!
        state.cases[initialCaseRef.id] = { ...decision, version: decision.version + 1, participants: [] }
        return { commit: true, value: true }
      })
    expect(removed.status).toBe("ok")
    // The real host rejects the same replay; no synthetic browser revocation event is emitted here.
    const retainedPanel = await panel.elementHandle()
    expect(retainedPanel).not.toBeNull()
    const discovery = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "dashboard-workbench")
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    const response = await discovery
    expect(statuses).toEqual([200, 403])
    expect(response.status()).toBe(200)
    expect(rows(object(object(object(await response.json()).value).decisions).cases)).toEqual([])
    await page.locator("main[data-access-unavailable]").waitFor()
    expect(await retainedPanel!.evaluate((element) => element.textContent)).toContain("Seu acesso mudou. Reabra a página com o acesso atual.")
    expect(await retainedPanel!.evaluate((element) => element.textContent)).not.toContain("Private application retained only with case access")
    expect(await retainedPanel!.evaluate((element) => element.querySelectorAll("input, textarea, select, button").length)).toBe(0)
    expect(await panel.locator("input, textarea, select, button").count()).toBe(0)
    expect(await panel.count()).toBe(0)
    expect(await page.evaluate(() => history.state)).toBeNull()
    await retainedPanel!.dispose()
    const navigation = object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench)
    expect(navigation.application).toBeUndefined()
    expect(navigation.draft).toBeUndefined()
    const after = await f.authority.state.read(f.request(), "cases", (state) => state.cases[initialCaseRef.id])
    expect(after.status === "ok" && after.value?.receipts).toEqual(before.value.receipts)
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await f.close() } }
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
