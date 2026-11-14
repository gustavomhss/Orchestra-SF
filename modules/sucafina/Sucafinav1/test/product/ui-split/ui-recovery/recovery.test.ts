import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { launchBrowserDriver } from "../../wp02/browser-driver-fixture.ts"
import { createRecoveryFixture, initialCaseRef } from "../../wp02/workbench-recovery-fixture.ts"
import { editNewDraft, observedApplication, openWorkbench, prepareApply, reloadApply } from "./fixture.ts"

test("UI recovery rejects an incomplete apply ACK then recovers the exact authorized receipt after reload", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createRecoveryFixture()
  const driver = await launchBrowserDriver("ui-recovery-invalid-ack").catch(async (error) => { await fixture.close(); throw error })
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await prepareApply(page, fixture, "One effect with an incomplete ACK")
    const attempts: { body: string | null; key: string | undefined; status: number; receipt: unknown }[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-apply", async (route) => {
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status(), receipt: object(await response.json()).value })
      // Execute the real host and corrupt only the first delivered acknowledgement.
      if (attempts.length === 1) await route.fulfill({ response, json: { status: "ok", value: { result: { ok: true } } } })
      else await route.fulfill({ response })
    })
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(200)
    const committed = await observedApplication(fixture)
    expect(committed.decision.receipts).toHaveLength(1)
    expect(committed.domain.action).toBe("One effect with an incomplete ACK")
    const saved = object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).application
    expect(saved).toEqual({ body: attempts[0]!.body, key: attempts[0]!.key })
    expect(JSON.stringify(saved)).not.toContain("One effect with an incomplete ACK")
    expect(JSON.stringify(saved)).not.toContain("Private recovery explanation")
    await reloadApply(page)
    expect(attempts).toHaveLength(1)
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isEnabled()).toBe(true)
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    await panel.getByText("Alterações aplicadas. O comprovante foi registrado no caso.", { exact: true }).waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual(attempts[0])
    expect(await observedApplication(fixture)).toEqual(committed)
    expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).application).toBeUndefined()
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBeNull()
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await fixture.close() } }
  driver.report()
}, 60000)

test("UI recovery reauthorizes the restored attempt and purges it on real denial without another effect", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createRecoveryFixture()
  const driver = await launchBrowserDriver("ui-recovery-revocation").catch(async (error) => { await fixture.close(); throw error })
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await prepareApply(page, fixture, "Private revoked recovery")
    const attempts: { body: string | null; key: string | undefined; status: number }[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-apply", async (route) => {
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status() })
      if (attempts.length === 1) await route.abort("failed")
      else await route.fulfill({ response })
    })
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    const committed = await observedApplication(fixture)
    expect(committed.decision.receipts).toHaveLength(1)
    await reloadApply(page)
    const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[initialCaseRef.id])
    if (current.status !== "ok" || !current.value) throw new Error("Case unavailable before revocation")
    const removed = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: initialCaseRef.id, targetIncarnation: initialCaseRef.incarnation, idempotencyKey: "ui-recovery-revoke", commandDigest: digestSfValue({ participants: [] }) }, async (state) => {
        const decision = state.cases[initialCaseRef.id]!
        state.cases[decision.id] = { ...decision, version: decision.version + 1, participants: [] }
        return { commit: true, value: true }
      })
    expect(removed.status).toBe("ok")
    const retained = await panel.elementHandle()
    expect(retained).not.toBeNull()
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    await page.locator("main[data-access-unavailable]").waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toEqual({ ...attempts[0]!, status: 403 })
    expect(await page.evaluate(() => history.state)).toBeNull()
    expect(await retained!.evaluate((element) => element.querySelectorAll("input,textarea,select,button").length)).toBe(0)
    expect(await retained!.evaluate((element) => element.textContent)).not.toContain("Private revoked recovery")
    await retained!.dispose()
    const revoked = await observedApplication(fixture)
    expect(revoked.domain).toEqual(committed.domain)
    expect(revoked.decision.receipts).toEqual(committed.decision.receipts)

    // A fresh grant cannot resurrect browser correlation purged on revocation.
    // The missing server discovery/lookup remains SHARED-APPLY-LOOKUP, not a PASS.
    const previous = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[initialCaseRef.id])
    if (previous.status !== "ok" || !previous.value) throw new Error("Case unavailable before reauthorization")
    expect((await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: previous.storageVersion,
      targetRef: initialCaseRef.id, targetIncarnation: initialCaseRef.incarnation, idempotencyKey: "ui-recovery-reauthorize", commandDigest: digestSfValue({ participants: [fixture.principalRef] }) }, async (state) => {
        const decision = state.cases[initialCaseRef.id]!
        state.cases[decision.id] = { ...decision, version: decision.version + 1, participants: [fixture.principalRef] }
        return { commit: true, value: true }
      })).status).toBe("ok")
    await page.reload()
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isVisible()).toBe(false)
    expect(attempts).toHaveLength(2)
    expect((await observedApplication(fixture)).domain).toEqual(committed.domain)
    expect((await observedApplication(fixture)).decision.receipts).toEqual(committed.decision.receipts)
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await fixture.close() } }
  driver.report()
}, 60000)

test("UI recovery retains an ambiguous authoritative receipt outcome across repeated reloads without another apply", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createRecoveryFixture()
  const driver = await launchBrowserDriver("ui-recovery-ambiguous-receipt").catch(async (error) => { await fixture.close(); throw error })
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await prepareApply(page, fixture, "One effect before ambiguous receipt")
    const attempts: { body: string | null; key: string | undefined; status: number; result: unknown }[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-apply", async (route) => {
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status(), result: await response.json() })
      if (attempts.length === 1) await route.abort("failed")
      else await route.fulfill({ response })
    })
    await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    const committed = await observedApplication(fixture)
    expect(committed.decision.receipts).toHaveLength(1)
    // Corrupt only durable fixture input. The actual host must detect the collision;
    // no replacement HTTP response or receipt-reader implementation is installed.
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1), receipts = object(state.receipts)
      const receipt = Object.values(receipts)[0]
      if (!receipt) throw new Error("Expected durable domain receipt")
      receipts["ui-recovery-collision"] = { ...object(receipt), id: "ui-recovery-collision" }
      return { commit: true, value: true }
    })
    const saved = object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).application
    await reloadApply(page)
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(2)
    expect(attempts[1]).toMatchObject({ body: attempts[0]!.body, key: attempts[0]!.key, status: 503, result: { status: "unavailable", reason: "receipt-identity-conflict" } })
    expect(object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench).application).toEqual(saved)
    expect(await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).isDisabled()).toBe(true)
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBe("true")
    await reloadApply(page)
    expect(attempts).toHaveLength(2)
    await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(3)
    expect(attempts[2]).toEqual(attempts[1])
    expect(await observedApplication(fixture)).toEqual(committed)
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await fixture.close() } }
  driver.report()
}, 60000)

test("UI recovery distinguishes a lost first save without draftRef and never guesses its identity after reload", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createRecoveryFixture()
  const driver = await launchBrowserDriver("ui-recovery-first-save").catch(async (error) => { await fixture.close(); throw error })
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await openWorkbench(page, fixture)
    const attempts: { body: string | null; key: string | undefined; status: number; result: unknown }[] = []
    await page.route((url) => url.searchParams.get("sf") === "dashboard-hot-topic-draft", async (route) => {
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status(), result: await response.json() })
      await route.abort("failed")
    })
    await editNewDraft(page, "Two independent drafts with the same title")
    await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
    await panel.getByText("O resultado não foi confirmado.", { exact: false }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(200)
    expect(JSON.parse(attempts[0]!.body!).draftRef).toBeUndefined()
    const first = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
    if (first.status !== "ok") throw new Error("Expected authorized saved draft")
    expect(first.value).toHaveLength(1)
    const navigation = object(object(await page.evaluate(() => history.state)).sfDashboardWorkbench)
    expect(navigation.draftAttempt).toEqual({ caseRef: initialCaseRef, key: attempts[0]!.key })
    expect(navigation.application).toBeUndefined()
    expect(navigation.draft).toBeUndefined()
    expect(JSON.stringify(navigation)).not.toContain("Two independent drafts with the same title")
    expect(JSON.stringify(navigation)).not.toContain("Private recovery explanation")

    // A distinct, explicitly admitted intent with identical text disproves title/target
    // matching. It is not a retry and must remain a separate real saved draft.
    const headers = new Headers(fixture.request().headers)
    headers.set("idempotency-key", randomUUID())
    const second = await fetch(`${fixture.origin}/sucafina/dashboard?sf=dashboard-hot-topic-draft`, { method: "POST", headers, body: attempts[0]!.body })
    expect(second.status).toBe(200)
    expect(object(object(await second.json()).value).draftRef).not.toBe(first.value[0]!.draftRef)
    page.once("dialog", (dialog) => void dialog.accept())
    await page.reload()
    await page.locator("[data-dashboard-workbench-panel] > summary").click()
    await panel.getByText("O resultado do primeiro salvamento ainda não foi confirmado.", { exact: false }).waitFor()
    await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
    await panel.getByText("Opções carregadas. O resultado do primeiro salvamento permanece pendente", { exact: false }).waitFor()
    expect(await panel.getByLabel("Ação", { exact: true }).inputValue()).toBe("")
    expect(await panel.getByLabel("Notas", { exact: true }).inputValue()).toBe("")
    expect(await panel.getByLabel(/^Rascunho/).inputValue()).toBe("")
    expect(await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isVisible()).toBe(false)
    expect(await panel.locator("[data-dashboard-pending]").getAttribute("data-dirty")).toBe("true")
    expect(attempts).toHaveLength(1)
    const available = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
    expect(available.status === "ok" && available.value.length).toBe(2)
    expect(available.status === "ok" && available.value.filter((draft) => draft.draftRef === first.value[0]!.draftRef)).toHaveLength(1)
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
    expect(errors).toEqual([])
  } finally { try { await driver.close() } finally { await fixture.close() } }
  driver.report()
}, 60000)
