import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { caseWorkSelectionForm, caseWorkSelectionScript } from "../../../../product/ui/case-work-selection.ts"
import { closeWp01Browser, launchWp01Browser } from "../../wp01/browser-fixture.ts"
import { createWorkSelectionDomainFixture } from "../../wp01/work-selection-domain-fixture.ts"

let browser: Browser
beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

const fixture = () => createWorkSelectionDomainFixture(browser, (projection) => ({ html: caseWorkSelectionForm(projection), script: caseWorkSelectionScript }))
type Fixture = Awaited<ReturnType<typeof fixture>>
async function choose(app: Fixture) {
  expect((await app.page.goto(`${app.origin}${app.mount}`))?.status()).toBe(200)
  const form = app.page.locator("[data-case-work-selection]")
  await form.getByRole("checkbox").check()
  await form.getByLabel("Work start", { exact: true }).fill("2026-03-01")
  await form.getByLabel("Work end", { exact: true }).fill("2026-03-31")
  return form
}
async function stored(app: Fixture, request = app.request()) {
  const result = await app.authority.state.read(request, "preferences", (state) => Object.entries(state.preferences).filter(([id]) => id.startsWith("sf:case-work-selection:")))
  if (result.status !== "ok") throw new Error("Selection storage unavailable")
  return result
}

// Same real-CAS counterexample as ui-work, with the rejected-state observation
// corrected: the submit remains locked until the user explicitly reviews it.
// The published producer is consumed verbatim; only delivery is damaged below.
test("G03 acceptance requires the real precommit CAS conflict and preserves the reviewed selection", async () => {
  const app = await fixture()
  try {
    const form = await choose(app)
    const initialContext = await form.getAttribute("data-context")
    const initial = await stored(app)
    const writes = () => app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")
    let caseReads = 0
    app.page.on("request", (request) => {
      if (request.method() === "GET" && new URL(request.url()).searchParams.get("sf") === "workbench-case") caseReads++
    })
    let competed = false
    let damaged = false
    await app.page.route("**/*?sf=collaboration-selection-create", async (route) => {
      if (!competed) {
        competed = true
        const submitted = route.request().postDataJSON()
        const key = randomUUID()
        const winner = await app.post("collaboration-selection-create", { ...submitted, mutation: { ...submitted.mutation, idempotencyKey: key } }, key)
        expect(winner.status).toBe(200)
        await route.continue()
        return
      }
      const response = await route.fetch()
      if (!damaged && response.status() === 200) {
        damaged = true
        await route.fulfill({ response, body: "{" })
        return
      }
      await route.fulfill({ response })
    })
    const pending = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-selection-create")
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    const response = await pending
    const payload = await response.json()
    console.info("WORK_G03_CAS", JSON.stringify({ http: response.status(), payload, caseRef: app.caseRef }))
    // A generic 503 remains a failure; no synthetic conflict response is used.
    expect(response.status()).toBe(409)
    expect(payload).toEqual({ status: "conflict", reason: "selection-not-committed" })
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("The selection was not saved because its protected state changed."))
    const review = form.getByRole("button", { name: "Review rejected selection", exact: true })
    expect(await review.isVisible()).toBe(true)
    expect(await review.isEnabled()).toBe(true)
    expect(await form.getByRole("button", { name: "Save work selection", exact: true }).isDisabled()).toBe(true)
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(await form.getByRole("checkbox").isDisabled()).toBe(true)
    expect(await form.getByRole("checkbox").inputValue()).toBe(app.source.refDigest)
    expect(await form.getByLabel("Work start", { exact: true }).inputValue()).toBe("2026-03-01")
    expect(await form.getByLabel("Work end", { exact: true }).inputValue()).toBe("2026-03-31")
    expect(await form.getByLabel("Work start", { exact: true }).isDisabled()).toBe(true)
    expect(await form.getByLabel("Work end", { exact: true }).isDisabled()).toBe(true)
    expect(await form.getAttribute("data-context")).toBe(initialContext)
    const won = await stored(app)
    expect(initial.value).toHaveLength(0)
    expect(won.value).toHaveLength(1)
    expect(won.storageVersion).toBe(initial.storageVersion + 1)
    expect(writes().map((attempt) => attempt.status)).toEqual([200, 409])
    const rejected = writes()[1]!
    const draft = { caseRef: app.caseRef, period: { start: "2026-03-01", end: "2026-03-31" }, sourceRefs: [app.source] }
    expect(JSON.parse(rejected.body).draft).toEqual(draft)
    expect(JSON.parse(rejected.body).mutation).toEqual({ expectedStorageVersion: initial.storageVersion, idempotencyKey: rejected.key })
    expect(writes()[0]!.key).not.toBe(rejected.key)

    const readsBeforeReview = caseReads
    const versionsBeforeReview = app.attempts.filter((attempt) => attempt.route === "collaboration-selection-version").length
    await review.click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("The rejected request was not saved."))
    expect(caseReads).toBe(readsBeforeReview + 1)
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-selection-version")).toHaveLength(versionsBeforeReview + 1)
    expect(writes()).toHaveLength(2)
    expect(await stored(app)).toEqual(won)
    expect(await review.isHidden()).toBe(true)
    expect(await form.getByRole("button", { name: "Save work selection", exact: true }).isEnabled()).toBe(true)
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(await form.getByLabel("Work start", { exact: true }).inputValue()).toBe("2026-03-01")
    expect(await form.getByLabel("Work end", { exact: true }).inputValue()).toBe("2026-03-31")
    expect(await form.getAttribute("data-context")).toBe(initialContext)

    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Could not confirm the selection."))
    expect(damaged).toBe(true)
    expect(writes()).toHaveLength(3)
    const reviewed = writes()[2]!
    expect(reviewed.status).toBe(200)
    expect(reviewed.key).not.toBe(rejected.key)
    expect(reviewed.key).not.toBe(writes()[0]!.key)
    expect(JSON.parse(reviewed.body)).toEqual({ draft, mutation: { expectedStorageVersion: won.storageVersion, idempotencyKey: reviewed.key } })
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(await form.getByRole("checkbox").isDisabled()).toBe(true)
    expect(await form.getByLabel("Work start", { exact: true }).isDisabled()).toBe(true)
    expect(await form.getByLabel("Work end", { exact: true }).isDisabled()).toBe(true)
    const committed = await stored(app)
    expect(committed.value).toHaveLength(2)
    expect(committed.storageVersion).toBe(won.storageVersion + 1)
    const selectionRef = committed.value.find(([id]) => id !== won.value[0]![0])?.[0]
    expect(typeof selectionRef).toBe("string")
    await form.getByRole("button", { name: "Retry same selection", exact: true }).click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Work selection saved."))
    expect(writes().map((attempt) => attempt.status)).toEqual([200, 409, 200, 200])
    expect(writes()[3]!.body).toBe(reviewed.body)
    expect(writes()[3]!.key).toBe(reviewed.key)
    expect(await stored(app)).toEqual(committed)
    expect(await form.getAttribute("data-dirty")).toBeNull()
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(await form.getByLabel("Work start", { exact: true }).inputValue()).toBe("2026-03-01")
    expect(await form.getByLabel("Work end", { exact: true }).inputValue()).toBe("2026-03-31")

    expect((await app.page.reload())?.status()).toBe(200)
    const listed = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-selection-list")
    await form.getByRole("button", { name: "Load saved selections", exact: true }).click()
    const list = await listed
    expect(list.status()).toBe(200)
    expect(await list.json()).toEqual({ status: "ok", value: committed.value.map(([id]) => ({ selectionRef: id, period: draft.period, state: "active" })) })
    await form.getByRole("link", { name: "Open my work", exact: false }).first().waitFor()
    const links = await form.getByRole("link", { name: "Open my work", exact: false }).evaluateAll((items) => items.map((item) => item.getAttribute("href")))
    expect(links.map((href) => Object.fromEntries(new URL(href!).searchParams))).toEqual(committed.value.map(([id]) => ({ sf: "workbench-work", selectionRef: id, start: "2026-03-01", end: "2026-03-31" })))
    expect(writes()).toHaveLength(4)
    expect(await stored(app)).toEqual(committed)

    await form.getByLabel("Work end", { exact: true }).fill("2026-03-30")
    expect(await form.getAttribute("data-dirty")).toBe("true")
    await app.page.evaluate(() => {
      document.documentElement.dataset.workRevocations = "0"
      addEventListener("sf-access-revoked", () => { document.documentElement.dataset.workRevocations = String(Number(document.documentElement.dataset.workRevocations) + 1) })
    })
    expect(await app.page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST" })).status)).toBe(204)
    const denied = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-selection-list")
    await form.getByRole("button", { name: "Load saved selections", exact: true }).click()
    expect((await denied).status()).toBe(403)
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Work selection access changed."))
    expect(await form.getAttribute("data-context")).toBeNull()
    expect(await form.getAttribute("data-dirty")).toBeNull()
    expect(await form.locator("a,input,button").count()).toBe(0)
    expect(await form.textContent()).not.toContain(app.source.target.recordId)
    expect(await app.page.locator("html").getAttribute("data-work-revocations")).toBe("1")
    expect(writes()).toHaveLength(4)
    // Retry remains subject to the revoked real session even for an existing receipt.
    expect((await app.post("collaboration-selection-create", JSON.parse(reviewed.body), reviewed.key!)).status).toBe(403)
    expect(writes()).toHaveLength(5)
    expect(writes()[4]!.status).toBe(403)

    // A freshly enrolled observer reads the same protected state; the revoked
    // browser does not receive this credential or regain access.
    const login = await app.identity.handle(new Request(app.origin + "/sucafina/auth/local?code=" + await app.identity.enroll()))
    const cookie = login?.headers.get("set-cookie")?.split(";")[0]
    if (!cookie) throw new Error("Fresh authorized state observation unavailable")
    const audit = app.request()
    audit.headers.set("cookie", cookie)
    expect(await stored(app, audit)).toEqual(committed)
    expect((await app.page.reload())?.status()).toBe(403)
    expect(app.errors).toEqual([])
    console.info("WORK_G03_REVIEW_REPLAY_REVOKE", JSON.stringify({
      caseRef: app.caseRef, sourceRef: app.source.refId, period: draft.period, selectionRef,
      createHttp: writes().map((attempt) => attempt.status), storageVersions: [initial.storageVersion, won.storageVersion, committed.storageVersion],
      effects: { competitor: 1, rejected: 0, reviewed: 1, retry: 0, reload: 0, revokedReplay: 0 },
      exactRetryBody: writes()[3]!.body === reviewed.body, exactRetryKey: writes()[3]!.key === reviewed.key,
      reviewedCaseReads: caseReads - readsBeforeReview, sessionRevoked: true, revokedReloadHttp: 403,
    }))
  } finally { await app.close() }
}, 45_000)
