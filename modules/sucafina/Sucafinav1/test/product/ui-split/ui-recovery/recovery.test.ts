import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { object, rows } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { AdmittedApply } from "../../../../product/decisions/receipt-review-binding.ts"
import { createSfDashboardApplicationIntents } from "../../../../../../../apps/cli/src/sucafina-product/dashboard-application-intent.ts"
import { launchBrowserDriver } from "../../wp02/browser-driver-fixture.ts"
import {
  applicationPanel, assertPrivateCorrelation, correlations, createConsumerReadFixture, editNewDraft, initialCaseRef,
  loadPrivateOptions, modeUrl, observedApplication, openWorkbench, pendingSaveMessage, prepareApply, privatePanel,
  receive, recoveredMessage, recoveryPrefix, reloadApply, unknownMessage,
} from "./fixture.ts"

test("UI recovery rejects an incomplete apply ACK then recovers the exact authorized receipt after reload", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createConsumerReadFixture()
  const driver = await launchBrowserDriver("host-response-recovery").catch(async (error) => { await fixture.close(); throw error })
  const failures: unknown[] = []
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await prepareApply(page, fixture, "One effect with an incomplete ACK")

    // An admitted recovery with no original protected application is a lookup
    // failure. It cannot prepare a new review or execute the domain command.
    const before = await observedApplication(fixture), change = before.decision.preparedChanges[0]!
    const selector = { purpose: "recover", caseRef: { id: before.decision.id, incarnation: before.decision.incarnation, version: before.decision.version },
      choiceId: change.choiceId, changeId: change.id }
    const missing = await fetch(fixture.origin + "/sucafina/dashboard?sf=dashboard-hot-topic-recover", {
      method: "POST", headers: fixture.request().headers, body: JSON.stringify(selector),
    })
    expect(missing.status).toBe(503)
    expect(await missing.json()).toEqual({ status: "unavailable", reason: "dashboard-original-intent-unavailable" })
    expect(await observedApplication(fixture)).toEqual(before)

    const attempts: { body: string | null; key: string | undefined; status: number; receipt: unknown }[] = []
    await page.route(modeUrl("dashboard-hot-topic-apply"), async (route) => {
      const original = route.request().postDataJSON() as AdmittedApply
      const source = new Request(route.request().url(), { method: "POST",
        headers: await route.request().allHeaders(), body: route.request().postData() })
      const admission = await fixture.authority.human.admit(source, "decisions.apply", original)
      expect(admission.status).toBe("ok")
      if (admission.status !== "ok") throw new Error("Original application admission unavailable")
      try {
        // Reserve only the genuine original human intent while the first HTTP
        // application is paused before dispatch. Recover must not manufacture
        // its absent receipt or use apply to create one.
        expect(await createSfDashboardApplicationIntents(fixture.authority).reserve(original, admission.value)).toBe(true)
      } finally { fixture.authority.ui.finish(admission.value) }
      const noReceipt = await fetch(fixture.origin + "/sucafina/dashboard?sf=dashboard-hot-topic-recover", {
        method: "POST", headers: source.headers, body: JSON.stringify(selector),
      })
      expect(noReceipt.status).toBe(503)
      expect(await noReceipt.json()).toEqual({ status: "unavailable", reason: "original-receipt-unavailable" })
      expect(await observedApplication(fixture)).toEqual(before)
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"],
        status: response.status(), receipt: object(await response.json()).value })
      // Execute the real host once; corrupt only the delivered acknowledgement.
      await route.fulfill({ response, json: { status: "ok", value: { result: { ok: true } } } })
    })
    await panel.getByRole("button", { name: "Confirm application", exact: true }).click()
    await panel.getByText(unknownMessage, { exact: true }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(200)
    const committed = await observedApplication(fixture)
    expect(committed.decision.receipts).toHaveLength(1)
    expect(committed.domain.action).toBe("One effect with an incomplete ACK")
    const applied = object(JSON.parse(attempts[0]!.body!))
    const saved = await assertPrivateCorrelation(page, { kind: "apply", key: attempts[0]!.key,
      caseRef: applied.caseRef, choiceId: applied.choiceId, changeId: applied.changeId })
    expect(JSON.stringify(saved)).not.toContain("One effect with an incomplete ACK")
    expect(JSON.stringify(saved)).not.toContain("Private recovery explanation")
    expect(JSON.stringify(saved)).not.toContain("reviewDigest")

    // A different valid UUID cannot recover an existing application journal.
    const wrongHeaders = new Headers(fixture.request().headers)
    wrongHeaders.set("idempotency-key", randomUUID())
    const wrong = await fetch(fixture.origin + "/sucafina/dashboard?sf=dashboard-hot-topic-recover", {
      method: "POST", headers: wrongHeaders, body: JSON.stringify(selector),
    })
    expect(wrong.status).toBe(503)
    expect(await wrong.json()).toEqual({ status: "unavailable", reason: "dashboard-original-intent-unavailable" })
    expect(await observedApplication(fixture)).toEqual(committed)

    const recoveries: { key: string | undefined; body: unknown; receipt: unknown; status: number }[] = []
    await page.route(modeUrl("dashboard-hot-topic-recover"), async (route) => {
      const response = await route.fetch(), body: unknown = await response.json()
      recoveries.push({ key: route.request().headers()["idempotency-key"], body: route.request().postDataJSON(),
        receipt: object(body).value, status: response.status() })
      await route.fulfill({ response })
    })
    await reloadApply(page)
    expect(attempts).toHaveLength(1)
    expect(recoveries).toEqual([])
    await panel.getByRole("button", { name: "Read original application receipt", exact: true }).click()
    await panel.getByText(recoveredMessage, { exact: true }).waitFor()
    expect(recoveries).toEqual([{ key: attempts[0]!.key, body: selector, receipt: attempts[0]!.receipt, status: 200 }])
    expect(attempts).toHaveLength(1)
    expect(await observedApplication(fixture)).toEqual(committed)
    expect(await correlations(page)).toEqual([])
    expect(await panel.getByRole("region", { name: "Original application recovery", exact: true }).count()).toBe(0)
    expect(await panel.locator('[data-proposal-outcome="applied"]').count()).toBe(1)
    expect(JSON.stringify(await page.evaluate(() => history.state))).not.toContain(attempts[0]!.key!)
    expect(errors).toEqual([])
  } catch (error) { failures.push(error) }
  finally {
    for (const result of await Promise.allSettled([driver.close(), fixture.close()]))
      if (result.status === "rejected") failures.push(result.reason)
  }
  if (failures.length) throw new AggregateError(failures, "Native original application recovery failed")
  driver.report()
}, 60000)

test("UI recovery reauthorizes the restored attempt and purges it on real denial without another effect", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createConsumerReadFixture()
  const driver = await launchBrowserDriver("host-access-recovery").catch(async (error) => { await fixture.close(); throw error })
  const failures: unknown[] = []
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await prepareApply(page, fixture, "Private revoked recovery")
    const attempts: { body: string | null; key: string | undefined; status: number }[] = []
    await page.route(modeUrl("dashboard-hot-topic-apply"), async (route) => {
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"], status: response.status() })
      await route.abort("failed")
    })
    await panel.getByRole("button", { name: "Confirm application", exact: true }).click()
    await panel.getByText(unknownMessage, { exact: true }).waitFor()
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
    const denial = receive(page, "dashboard-hot-topic-recover")
    await panel.getByRole("button", { name: "Read original application receipt", exact: true }).click()
    const denied = await denial
    expect(denied.status).toBe(403)
    expect(object(denied.body).status).toBe("denied")
    expect(denied.key).toBe(attempts[0]!.key)
    const original = object(JSON.parse(attempts[0]!.body!))
    expect(denied.request).toEqual({ purpose: "recover", caseRef: original.caseRef, choiceId: original.choiceId, changeId: original.changeId })
    await page.locator('[data-sf-f01="denied"]').waitFor()
    expect(attempts).toHaveLength(1)
    expect(await correlations(page)).toEqual([])
    const historyValue = JSON.stringify(await page.evaluate(() => history.state))
    for (const secret of ["Private revoked recovery", "Private recovery explanation", "reviewDigest", attempts[0]!.key!])
      expect(historyValue).not.toContain(secret)
    expect(await retained!.evaluate((element) => element.querySelectorAll("input,textarea,select,button").length)).toBe(0)
    expect(await retained!.evaluate((element) => element.textContent)).not.toContain("Private revoked recovery")
    await retained!.dispose()
    expect(await applicationPanel(page).count()).toBe(0)
    const revoked = await observedApplication(fixture)
    expect(revoked.domain).toEqual(committed.domain)
    expect(revoked.decision.receipts).toEqual(committed.decision.receipts)

    const previous = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[initialCaseRef.id])
    if (previous.status !== "ok" || !previous.value) throw new Error("Case unavailable before reauthorization")
    const selfGrant = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: previous.storageVersion,
      targetRef: initialCaseRef.id, targetIncarnation: initialCaseRef.incarnation, idempotencyKey: "ui-recovery-reauthorize", commandDigest: digestSfValue({ participants: [fixture.principalRef] }) }, async (state) => {
        const decision = state.cases[initialCaseRef.id]!
        state.cases[decision.id] = { ...decision, version: decision.version + 1, participants: [fixture.principalRef] }
        return { commit: true, value: true }
      })
    expect(selfGrant).toMatchObject({ status: "denied", reason: "target-access-unavailable" })
    expect((await observedApplication(fixture)).decision).toEqual(previous.value)
    // Controlled administrative fixture input restores participation; the
    // revoked user's own command above is still rejected by the real authority.
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1), cases = object(state.cases), versions = object(state.versions)
      const decision = object(cases[initialCaseRef.id])
      expect(decision).toEqual(previous.value)
      cases[initialCaseRef.id] = { ...decision, version: Number(decision.version) + 1, participants: [fixture.principalRef] }
      versions.cases = Number(versions.cases) + 1
      state.revision = Number(state.revision) + 1
      return { commit: true, value: true }
    })
    await page.reload()
    await page.locator('[data-sf-host="owner-runtime231"][data-sf-provider-state="ready"]').waitFor()
    await applicationPanel(page).waitFor()
    expect(await page.getByRole("button", { name: "Read original application receipt", exact: true }).count()).toBe(0)
    expect(await correlations(page)).toEqual([])
    expect(attempts).toHaveLength(1)
    expect((await observedApplication(fixture)).domain).toEqual(committed.domain)
    expect((await observedApplication(fixture)).decision.receipts).toEqual(committed.decision.receipts)
    expect(errors).toEqual([])
  } catch (error) { failures.push(error) }
  finally {
    for (const result of await Promise.allSettled([driver.close(), fixture.close()]))
      if (result.status === "rejected") failures.push(result.reason)
  }
  if (failures.length) throw new AggregateError(failures, "Native recovery authority and purge failed")
  driver.report()
}, 60000)

test("UI recovery retains an ambiguous authoritative receipt outcome across repeated reloads without another apply", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createConsumerReadFixture()
  const driver = await launchBrowserDriver("host-egress-recovery").catch(async (error) => { await fixture.close(); throw error })
  const failures: unknown[] = []
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await prepareApply(page, fixture, "One effect before ambiguous receipt")
    const applications: { body: string | null; key: string | undefined; status: number; result: unknown }[] = []
    await page.route(modeUrl("dashboard-hot-topic-apply"), async (route) => {
      const response = await route.fetch()
      applications.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"],
        status: response.status(), result: await response.json() })
      await route.abort("failed")
    })
    await panel.getByRole("button", { name: "Confirm application", exact: true }).click()
    await panel.getByText(unknownMessage, { exact: true }).waitFor()
    expect(applications).toHaveLength(1)
    expect(applications[0]!.status).toBe(200)
    const committed = await observedApplication(fixture)
    expect(committed.decision.receipts).toHaveLength(1)
    // Corrupt only durable fixture input. The unchanged original receipt reader
    // must detect the collision; no replacement reader or positive DTO exists.
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1), receipts = object(state.receipts)
      const receipt = Object.values(receipts)[0]
      if (!receipt) throw new Error("Expected durable domain receipt")
      receipts["ui-recovery-collision"] = { ...object(receipt), id: "ui-recovery-collision" }
      return { commit: true, value: true }
    })
    const original = object(JSON.parse(applications[0]!.body!))
    const saved = await assertPrivateCorrelation(page, { kind: "apply", key: applications[0]!.key,
      caseRef: original.caseRef, choiceId: original.choiceId, changeId: original.changeId })
    const recoveries: { key: string | undefined; body: unknown; status: number; result: unknown }[] = []
    await page.route(modeUrl("dashboard-hot-topic-recover"), async (route) => {
      const response = await route.fetch(), result: unknown = await response.json()
      recoveries.push({ key: route.request().headers()["idempotency-key"], body: route.request().postDataJSON(),
        status: response.status(), result })
      await route.fulfill({ response })
    })
    for (let attempt = 0; attempt < 2; attempt++) {
      await reloadApply(page)
      expect(recoveries).toHaveLength(attempt)
      const read = receive(page, "dashboard-hot-topic-recover")
      await panel.getByRole("button", { name: "Read original application receipt", exact: true }).click()
      expect((await read).status).toBe(503)
      await panel.getByText(unknownMessage, { exact: true }).waitFor()
      expect(recoveries).toHaveLength(attempt + 1)
      expect(recoveries[attempt]).toEqual({ key: applications[0]!.key,
        body: { purpose: "recover", caseRef: original.caseRef, choiceId: original.choiceId, changeId: original.changeId },
        status: 503, result: { status: "unavailable", reason: "receipt-identity-conflict" } })
      expect(await correlations(page)).toEqual(saved)
      expect(await panel.getByRole("button", { name: "Confirm application", exact: true }).isDisabled()).toBe(true)
      expect(applications).toHaveLength(1)
    }
    expect(recoveries[1]).toEqual(recoveries[0])
    expect(await observedApplication(fixture)).toEqual(committed)

    // Expiry does not release another command or delete the unresolved selector.
    await page.clock.install({ time: new Date(Number(saved[0]!.value.expiresAt) + 1) })
    page.once("dialog", (dialog) => void dialog.accept())
    await page.reload()
    await panel.getByText("The saved recovery selection expired. It cannot authorize recovery or another command.", { exact: true }).waitFor()
    expect(await panel.getByRole("button", { name: "Read original application receipt", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Confirm application", exact: true }).isDisabled()).toBe(true)
    expect(await correlations(page)).toEqual(saved)
    expect(recoveries).toHaveLength(2)
    expect(applications).toHaveLength(1)
    expect(await observedApplication(fixture)).toEqual(committed)

    expect(errors).toEqual([])
  } catch (error) { failures.push(error) }
  finally {
    for (const result of await Promise.allSettled([driver.close(), fixture.close()]))
      if (result.status === "rejected") failures.push(result.reason)
  }
  if (failures.length) throw new AggregateError(failures, "Native ambiguous receipt recovery failed")
  driver.report()
}, 60000)

test("UI recovery distinguishes a lost first save without draftRef and never guesses its identity after reload", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createConsumerReadFixture()
  const driver = await launchBrowserDriver("host-draft-recovery").catch(async (error) => { await fixture.close(); throw error })
  const failures: unknown[] = []
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await openWorkbench(page, fixture)
    const attempts: { body: string | null; key: string | undefined; status: number; result: unknown }[] = []
    await page.route(modeUrl("dashboard-hot-topic-draft"), async (route) => {
      const response = await route.fetch()
      attempts.push({ body: route.request().postData(), key: route.request().headers()["idempotency-key"],
        status: response.status(), result: await response.json() })
      await route.abort("failed")
    })
    await editNewDraft(page, "Two independent drafts with the same title")
    await panel.getByRole("button", { name: "Save private draft", exact: true }).click()
    await panel.getByRole("region", { name: "Original first-save recovery", exact: true }).waitFor()
    expect(attempts).toHaveLength(1)
    expect(attempts[0]!.status).toBe(200)
    expect(JSON.parse(attempts[0]!.body!).draftRef).toBeUndefined()
    const first = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
    if (first.status !== "ok") throw new Error("Expected authorized saved draft")
    expect(first.value).toHaveLength(1)
    const saved = await assertPrivateCorrelation(page, { kind: "draft", caseRef: initialCaseRef, key: attempts[0]!.key })
    expect(JSON.stringify(saved)).not.toContain("Two independent drafts with the same title")
    expect(JSON.stringify(saved)).not.toContain("Private recovery explanation")
    expect(JSON.stringify(saved)).not.toContain(first.value[0]!.draftRef)
    expect(JSON.stringify(saved)).not.toContain("targetEvidence")

    // A distinct admitted intent with identical text disproves title/target
    // matching; it remains a separate genuine saved draft.
    const headers = new Headers(fixture.request().headers)
    headers.set("idempotency-key", randomUUID())
    const second = await fetch(fixture.origin + "/sucafina/dashboard?sf=dashboard-hot-topic-draft", {
      method: "POST", headers, body: attempts[0]!.body,
    })
    expect(second.status).toBe(200)
    const secondRef = object(object(await second.json()).value).draftRef
    expect(secondRef).not.toBe(first.value[0]!.draftRef)
    const outcomes: { key: string | undefined; body: unknown; result: unknown; status: number }[] = []
    await page.route(modeUrl("dashboard-hot-topic-draft-outcome"), async (route) => {
      const response = await route.fetch(), result: unknown = await response.json()
      outcomes.push({ key: route.request().headers()["idempotency-key"], body: route.request().postDataJSON(), result, status: response.status() })
      await route.fulfill({ response })
    })
    page.once("dialog", (dialog) => void dialog.accept())
    await page.reload()
    await panel.getByRole("region", { name: "Original first-save recovery", exact: true }).waitFor()
    await loadPrivateOptions(page, panel)
    await panel.getByText(pendingSaveMessage, { exact: true }).first().waitFor()
    expect(await panel.getByLabel("Action", { exact: true }).count()).toBe(0)
    expect(await panel.getByLabel("Notes", { exact: true }).count()).toBe(0)
    expect(await panel.getByRole("combobox", { name: "Proposal", exact: true }).inputValue()).toBe("new")
    expect(await panel.getByRole("combobox", { name: "Case", exact: true }).inputValue()).toBe("")
    expect(await panel.getByRole("button", { name: "Save private draft", exact: true }).isDisabled()).toBe(true)
    expect(await panel.getByRole("button", { name: "Read original application receipt", exact: true }).count()).toBe(0)
    expect(outcomes).toEqual([])
    expect(attempts).toHaveLength(1)
    const available = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
    expect(available.status === "ok" && available.value.length).toBe(2)
    expect(available.status === "ok" && available.value.filter((draft) => draft.draftRef === first.value[0]!.draftRef)).toHaveLength(1)
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")

    await panel.getByRole("button", { name: "Read original save outcome", exact: true }).click()
    await panel.getByText("The original saved draft was recovered from its authorized result.", { exact: true }).waitFor()
    expect(outcomes).toEqual([{ key: attempts[0]!.key, body: { caseRef: initialCaseRef },
      status: 200, result: { status: "ok", value: { draftRef: first.value[0]!.draftRef, version: 1 } } }])
    expect(await panel.getByRole("combobox", { name: "Proposal", exact: true }).inputValue()).toBe(first.value[0]!.draftRef)
    expect(await panel.getByRole("combobox", { name: "Proposal", exact: true }).inputValue()).not.toBe(secondRef)
    expect(await panel.getByLabel("Action", { exact: true }).inputValue()).toBe("Two independent drafts with the same title")
    expect(await panel.getByLabel("Notes", { exact: true }).inputValue()).toBe("Private recovery explanation")
    expect(await panel.getByRole("region", { name: "Private proposal fields", exact: true }).getAttribute("data-dirty")).toBe("false")
    expect(await correlations(page)).toEqual([])
    expect(attempts).toHaveLength(1)
    expect(await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))).toEqual(available)
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
    expect(errors).toEqual([])
  } catch (error) { failures.push(error) }
  finally {
    for (const result of await Promise.allSettled([driver.close(), fixture.close()]))
      if (result.status === "rejected") failures.push(result.reason)
  }
  if (failures.length) throw new AggregateError(failures, "Native original first-save recovery failed")
  driver.report()
}, 60000)

test("F01 purges a still-valid original correlation on owner reload outside Dashboard and never resurrects it on return", async () => {
  expectSpawn(import.meta.path)
  const fixture = await createConsumerReadFixture()
  const driver = await launchBrowserDriver("host-draft-recovery").catch(async (error) => { await fixture.close(); throw error })
  const failures: unknown[] = []
  try {
    const page = await driver.browser.newPage(), errors: string[] = []
    page.on("pageerror", (error) => errors.push(error.message))
    const panel = await openWorkbench(page, fixture), saves: unknown[] = [], outcomes: string[] = []
    await page.route(modeUrl("dashboard-hot-topic-draft"), async (route) => {
      const response = await route.fetch()
      expect(response.status()).toBe(200)
      saves.push(await response.json())
      await route.abort("failed")
    })
    page.on("request", (request) => {
      const mode = new URL(request.url()).searchParams.get("sf")
      if (mode === "dashboard-hot-topic-draft-outcome" || mode === "dashboard-hot-topic-recover") outcomes.push(mode)
    })
    await editNewDraft(page, "Owner-bound unsent recovery fields")
    await panel.getByRole("button", { name: "Save private draft", exact: true }).click()
    await panel.getByRole("region", { name: "Original first-save recovery", exact: true }).waitFor()
    expect(saves).toHaveLength(1)
    const before = await correlations(page)
    expect(before).toHaveLength(1)
    expect(before[0]!.value.kind).toBe("draft")
    expect(Number(before[0]!.value.expiresAt)).toBeGreaterThan(await page.evaluate(() => Date.now()))
    const originalDrafts = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
    expect(originalDrafts.status === "ok" && originalDrafts.value.length).toBe(1)

    // Change only the fixture host's actual current project. Discovery/context
    // then authenticate this distinct owner through the original F01 producers.
    fixture.selectProject("other-recovery-project")
    const other = new URL("/orchestra/sf-decisions", fixture.origin)
    other.search = new URLSearchParams(fixture.selection()).toString()
    const contextRead = page.waitForResponse((response) => new URL(response.url()).pathname.endsWith("/api/ui/context"))
      .then(async (response) => ({ status: response.status(), body: await response.json() as unknown }))
    page.once("dialog", (dialog) => void dialog.accept())
    expect((await page.goto(other.href))?.status()).toBe(200)
    const otherContext = await contextRead
    expect(otherContext.status).toBe(200)
    expect(object(object(object(otherContext.body).value).stamp).projectId).toBe("other-recovery-project")
    await page.locator('[data-sf-host="owner-runtime231"][data-sf-provider-state="ready"]').waitFor()
    await page.getByText("Review the action", { exact: true }).waitFor()
    await page.waitForFunction((prefix) => !Object.keys(sessionStorage).some((key) => key.startsWith(prefix)), recoveryPrefix)
    expect(await correlations(page)).toEqual([])
    expect(await applicationPanel(page).count()).toBe(0)
    expect(await privatePanel(page).count()).toBe(0)
    expect(outcomes).toEqual([])

    fixture.selectProject("project")
    const original = new URL("/orchestra/sf-dashboard/hot-topics", fixture.origin)
    original.search = new URLSearchParams(fixture.selection()).toString()
    expect((await page.goto(original.href))?.status()).toBe(200)
    await page.getByRole("link", { name: "Private follow-up proposals", exact: true }).click()
    await panel.getByText("Options loaded.", { exact: true }).waitFor()
    expect(Number(before[0]!.value.expiresAt)).toBeGreaterThan(await page.evaluate(() => Date.now()))
    expect(await correlations(page)).toEqual([])
    expect(await panel.getByRole("region", { name: "Original first-save recovery", exact: true }).count()).toBe(0)
    expect(await panel.getByLabel("Action", { exact: true }).count()).toBe(0)
    expect(await panel.getByLabel("Notes", { exact: true }).count()).toBe(0)
    expect(await panel.getByRole("combobox", { name: "Proposal", exact: true }).inputValue()).toBe("new")
    expect(await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))).toEqual(originalDrafts)
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: rows(snapshot.data.hotTopics)[0]!.action }))).toBe("Original action")
    expect(saves).toHaveLength(1)
    expect(outcomes).toEqual([])
    expect(errors).toEqual([])
  } catch (error) { failures.push(error) }
  finally {
    for (const result of await Promise.allSettled([driver.close(), fixture.close()]))
      if (result.status === "rejected") failures.push(result.reason)
  }
  if (failures.length) throw new AggregateError(failures, "F01 cross-owner original correlation purge failed")
  driver.report()
}, 60000)
