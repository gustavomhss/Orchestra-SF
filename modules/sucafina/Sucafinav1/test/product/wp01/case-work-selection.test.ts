import { afterAll, beforeAll, expect, test } from "bun:test"
import type { Browser } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { caseWorkSelectionForm, caseWorkSelectionScript } from "../../../product/ui/case-work-selection.ts"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { createWorkSelectionDomainFixture } from "./work-selection-domain-fixture.ts"

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
  const state = await app.authority.state.read(app.request(), "preferences", (value) => Object.entries(value.preferences).filter(([id]) => id.startsWith("sf:case-work-selection:")))
  expect(state.status).toBe("ok")
  if (state.status !== "ok") throw new Error("Real selection state unavailable")
  return state.value
}

async function changeCase(app: Fixture) {
  const before = await app.authority.state.read(app.request(), "cases", (state) => state.cases["work-decision"])
  expect(before.status).toBe("ok")
  if (before.status !== "ok" || !before.value) throw new Error("Real case unavailable")
  const changed = { ...before.value, version: before.value.version + 1, objective: "A concurrently revised operational decision" }
  const committed = await app.authority.state.transaction(app.request(), { namespace: "cases", expectedStorageVersion: before.storageVersion, idempotencyKey: randomUUID(),
    commandDigest: digestSfValue(changed), targetRef: changed.id, targetIncarnation: changed.incarnation }, async (state) => { state.cases[changed.id] = changed; return { commit: true, value: true } })
  expect(committed.status).toBe("ok")
}

test("the real case selection persists chosen records and period and keeps missing work composition distinct from no configuration", async () => {
  const app = await fixture()
  try {
    expect((await app.page.goto(`${app.origin}${app.mount}`))?.status()).toBe(200)
    const form = app.page.locator("[data-case-work-selection]")
    const empty = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-selection-list")
    await form.getByRole("button", { name: "Load saved selections", exact: true }).click()
    expect((await empty).status()).toBe(200)
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.includes("No work selection is configured"))
    expect(await stored(app)).toEqual([])
    await form.getByRole("checkbox").check()
    await form.getByLabel("Work start", { exact: true }).fill("2026-03-01")
    await form.getByLabel("Work end", { exact: true }).fill("2026-03-31")
    const saved = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-selection-create")
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    const response = await saved
    expect(response.status()).toBe(200)
    const receipt = await response.json()
    expect(receipt.status).toBe("ok")
    expect(typeof receipt.value.selectionRef).toBe("string")
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Work selection saved."))
    const writes = app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")
    expect(writes).toHaveLength(1)
    const body = JSON.parse(writes[0]!.body)
    expect(body.draft).toEqual({ caseRef: app.caseRef, period: { start: "2026-03-01", end: "2026-03-31" }, sourceRefs: [app.source] })
    expect(body.mutation.expectedStorageVersion).toBe(0)
    expect(body.mutation.idempotencyKey).toBe(writes[0]!.key)
    expect(body.draft).not.toHaveProperty("responsibleIds")
    expect((await stored(app)).map(([id]) => id)).toEqual([receipt.value.selectionRef])
    const link = new URL((await form.getByRole("link", { name: "Open my work", exact: false }).getAttribute("href"))!)
    expect(link.origin).toBe(app.origin)
    expect(Object.fromEntries(link.searchParams)).toEqual({ sf: "workbench-work", selectionRef: receipt.value.selectionRef, start: "2026-03-01", end: "2026-03-31" })
    // The published host composition does not bind WorkSignals. Keep that real
    // 503 visible; a fabricated empty provider would erase the integration gap.
    const pending = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-cycle-read")
    await form.getByRole("button", { name: "Check pending work", exact: true }).click()
    const unavailable = await pending
    expect(unavailable.status()).toBe(503)
    expect(await unavailable.json()).toEqual({ status: "unavailable", reason: "work-signals-unavailable" })
    await app.page.waitForFunction(() => document.querySelector('[data-work-selections] [role="status"]')?.textContent?.includes("This does not mean there are no pending items."))
    expect(await form.textContent()).not.toContain("there are no pending work items or questions")
    expect(await form.getByLabel("Work start", { exact: true }).inputValue()).toBe("2026-03-01")
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    const reloaded = await app.page.reload()
    expect(reloaded?.status()).toBe(200)
    const list = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-selection-list")
    await app.page.getByRole("button", { name: "Load saved selections", exact: true }).click()
    expect(await (await list).json()).toEqual({ status: "ok", value: [{ selectionRef: receipt.value.selectionRef, period: { start: "2026-03-01", end: "2026-03-31" }, state: "active" }] })
    await app.page.getByRole("link", { name: "Open my work", exact: false }).waitFor()
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")).toHaveLength(1)
    expect(app.errors).toEqual([])
  } finally { await app.close() }
}, 45_000)

test("a lost first selection response keeps the exact request and resolves to one real C08 selection", async () => {
  const app = await fixture()
  try {
    const form = await choose(app)
    let damaged = false
    await app.page.route("**/*?sf=collaboration-selection-create", async (route) => {
      const response = await route.fetch()
      if (damaged || response.status() !== 200) { await route.fulfill({ response }); return }
      damaged = true
      // Damage delivery only after the actual HTTP producer commits. Its durable
      // state and replay response are never supplied by this transport hook.
      await route.fulfill({ response, body: "{" })
    })
    const firstResponse = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-selection-create")
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    expect((await firstResponse).status()).toBe(200)
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Could not confirm the selection."))
    expect(await form.getByLabel("Work start", { exact: true }).isDisabled()).toBe(true)
    expect(await form.getByRole("checkbox").isDisabled()).toBe(true)
    const first = await stored(app)
    expect(first).toHaveLength(1)
    const original = app.attempts.find((attempt) => attempt.route === "collaboration-selection-create")!
    expect(original.status).toBe(200)
    const list = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-selection-list")
    await form.getByRole("button", { name: "Load saved selections", exact: true }).click()
    expect((await list).status()).toBe(200)
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.includes("Your original save is still unconfirmed"))
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")).toHaveLength(1)
    const replay = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-selection-create")
    await form.getByRole("button", { name: "Retry same selection", exact: true }).click()
    expect((await replay).status()).toBe(200)
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Work selection saved."))
    expect(await stored(app)).toEqual(first)
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create").map((attempt) => ({ body: attempt.body, key: attempt.key }))).toEqual([{ body: original.body, key: original.key }, { body: original.body, key: original.key }])
    expect(await form.getAttribute("data-dirty")).toBeNull()
    expect(await form.getByLabel("Work end", { exact: true }).inputValue()).toBe("2026-03-31")
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(app.errors).toEqual([])
  } finally { await app.close() }
}, 45_000)

test("a current case change is read before saving and does not silently adopt another case version", async () => {
  const app = await fixture()
  try {
    const form = await choose(app)
    await changeCase(app)
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("This decision changed."))
    expect(await form.getByRole("button", { name: "Reload decision to review sources", exact: true }).isVisible()).toBe(true)
    expect(await form.getByLabel("Work start", { exact: true }).inputValue()).toBe("2026-03-01")
    expect(await form.getByRole("checkbox").isChecked()).toBe(true)
    expect(await stored(app)).toEqual([])
    expect(app.attempts.some((attempt) => attempt.route === "collaboration-selection-version" || attempt.route === "collaboration-selection-create")).toBe(false)
    expect(app.errors).toEqual([])
  } finally { await app.close() }
}, 45_000)

test("a case change after preflight keeps the real save acknowledged without presenting it as the reviewed case or retrying it", async () => {
  const app = await fixture()
  try {
    const form = await choose(app)
    await app.page.route("**/*?sf=collaboration-selection-create", async (route) => {
      // The actual case changes after the browser's preflight and before the
      // actual selection producer receives its request. No HTTP result is faked.
      await changeCase(app)
      await route.continue()
    })
    const saved = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-selection-create")
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    expect((await saved).status()).toBe(200)
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("The selection was saved, but this decision changed."))
    expect(await stored(app)).toHaveLength(1)
    expect(await form.getByRole("link", { name: "Open my work", exact: false }).count()).toBe(0)
    expect(await form.getByRole("button", { name: "Retry same selection", exact: true }).count()).toBe(0)
    expect(await form.getByRole("button", { name: "Reload decision to review sources", exact: true }).isVisible()).toBe(true)
    expect(await form.getAttribute("data-dirty")).toBeNull()
    expect(await form.getByLabel("Work start", { exact: true }).inputValue()).toBe("2026-03-01")
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")).toHaveLength(1)
    expect(app.errors).toEqual([])
  } finally { await app.close() }
}, 45_000)

test("real session revocation purges saved work links and the unsaved record selection", async () => {
  const app = await fixture()
  try {
    const form = await choose(app)
    const saved = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-selection-create")
    await form.getByRole("button", { name: "Save work selection", exact: true }).click()
    expect((await saved).status()).toBe(200)
    await form.getByRole("link", { name: "Open my work", exact: false }).waitFor()
    await form.getByLabel("Work end", { exact: true }).fill("2026-03-30")
    expect(await form.getAttribute("data-dirty")).toBe("true")
    await app.page.evaluate(() => {
      document.documentElement.dataset.workRevocations = "0"
      addEventListener("sf-access-revoked", () => { document.documentElement.dataset.workRevocations = String(Number(document.documentElement.dataset.workRevocations) + 1) })
    })
    expect(await app.page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST" })).status)).toBe(204)
    const denied = app.page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "collaboration-selection-list")
    await form.getByRole("button", { name: "Load saved selections", exact: true }).click()
    expect((await denied).status()).toBe(403)
    await app.page.waitForFunction(() => document.querySelector('[data-case-work-selection] [role="status"]')?.textContent?.startsWith("Work selection access changed."))
    expect(await form.getAttribute("data-context")).toBeNull()
    expect(await form.getAttribute("data-dirty")).toBeNull()
    expect(await form.locator("a,input,button").count()).toBe(0)
    expect(await app.page.locator("html").getAttribute("data-work-revocations")).toBe("1")
    expect(await form.textContent()).not.toContain(app.source.target.recordId)
    expect(app.attempts.filter((attempt) => attempt.route === "collaboration-selection-create")).toHaveLength(1)
    expect(app.errors).toEqual([])
  } finally { await app.close() }
}, 45_000)
