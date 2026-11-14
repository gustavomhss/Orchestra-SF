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
async function stored(app: Fixture) {
  const result = await app.authority.state.read(app.request(), "preferences", (state) => Object.entries(state.preferences).filter(([id]) => id.startsWith("sf:case-work-selection:")))
  if (result.status !== "ok") throw new Error("Selection storage unavailable")
  return result
}

test("first-cycle selection retains case, sources and period after lost delivery, exact retry and reload", async () => {
  const app = await fixture()
  try {
    const form = await choose(app)
    let damaged = false
    await app.page.route("**/*?sf=collaboration-selection-create", async (route) => {
      const response = await route.fetch()
      if (!damaged && response.status() === 200) { damaged = true; await route.fulfill({ response, body: "{" }); return }
      await route.fulfill({ response })
    })
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Could not confirm the selection."))
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(await form.getByLabel("Work start", { exact: true }).isDisabled()).toBe(true)
    const committed = await stored(app)
    expect(committed.value).toHaveLength(1)
    await form.getByRole("button", { name: "Retry same selection", exact: true }).click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Work selection saved."))
    const writes = app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")
    expect(writes).toHaveLength(2)
    expect(writes.every((attempt) => attempt.status === 200)).toBe(true)
    expect(writes[1]!.body).toBe(writes[0]!.body)
    expect(writes[1]!.key).toBe(writes[0]!.key)
    const draft = JSON.parse(writes[0]!.body).draft
    expect(draft).toEqual({ caseRef: app.caseRef, period: { start: "2026-03-01", end: "2026-03-31" }, sourceRefs: [app.source] })
    expect(await stored(app)).toEqual(committed)
    await app.page.reload()
    await app.page.getByRole("button", { name: "Load saved selections", exact: true }).click()
    const link = app.page.getByRole("link", { name: "Open my work", exact: false })
    await link.waitFor()
    const target = new URL((await link.getAttribute("href"))!)
    expect(Object.fromEntries(target.searchParams)).toEqual({ sf: "workbench-work", selectionRef: committed.value[0]![0], start: "2026-03-01", end: "2026-03-31" })
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")).toHaveLength(2)
    expect(await stored(app)).toEqual(committed)
    expect(app.errors).toEqual([])
    console.info("UI_WORK_SELECTION_REPLAY", JSON.stringify({ caseRef: app.caseRef, period: draft.period, sourceRef: app.source.refId, selectionRef: committed.value[0]![0], attempts: 2, storageVersion: committed.storageVersion }))
  } finally { await app.close() }
}, 45_000)

test("G03 acceptance requires the real precommit CAS conflict and preserves the reviewed selection", async () => {
  const app = await fixture()
  try {
    const form = await choose(app)
    let competed = false
    await app.page.route("**/*?sf=collaboration-selection-create", async (route) => {
      if (!competed) {
        competed = true
        const submitted = route.request().postDataJSON()
        const key = randomUUID()
        const winner = await app.post("collaboration-selection-create", { ...submitted, mutation: { ...submitted.mutation, idempotencyKey: key } }, key)
        expect(winner.status).toBe(200)
      }
      await route.continue()
    })
    const pending = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-selection-create")
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    const response = await pending, payload = await response.json()
    expect(response.status()).toBe(409)
    expect(payload).toEqual({ status: "conflict", reason: "selection-not-committed" })
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("The selection was not saved because its protected state changed."))
    expect(await form.getByRole("button", { name: "Save work selection", exact: true }).isDisabled()).toBe(true)
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(await form.getByLabel("Work start", { exact: true }).inputValue()).toBe("2026-03-01")
    expect(await form.getByLabel("Work end", { exact: true }).inputValue()).toBe("2026-03-31")
    expect((await stored(app)).value).toHaveLength(1)
    console.info("UI_WORK_G03_CAS", JSON.stringify({ http: response.status(), payload, caseRef: app.caseRef, selected: true, period: ["2026-03-01", "2026-03-31"], producer: "retained baseline; published collab fix awaits owner intake" }))
    // This is an acceptance assertion, intentionally not rewritten to accept the
    // retained producer's 503. The owner patch is pinned in the receipt.
    expect(response.status()).toBe(409)
    expect(payload).toEqual({ status: "conflict", reason: "selection-not-committed" })
    await form.getByRole("button", { name: "Review rejected selection", exact: true }).click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("The rejected request was not saved."))
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Work selection saved."))
    expect((await stored(app)).value).toHaveLength(2)
    expect(app.errors).toEqual([])
  } finally { await app.close() }
}, 45_000)
