import { afterAll, beforeAll, expect } from "bun:test"
import type { Browser } from "@playwright/test"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { createWorkSelectionDomainFixture } from "./work-selection-domain-fixture.ts"

// Registered once by browser-selection.test.ts; importing this source registers no tests.
export function registerPoolTests(test: typeof import("bun:test").test) {
  let browser: Browser
  beforeAll(async () => { browser = await launchWp01Browser() }, 35_000)
  afterAll(async () => { if (browser) await closeWp01Browser(browser) }, 25_000)

  const fixture = () => createWorkSelectionDomainFixture(browser)

  test("the question consumer finds recipients through the canonical HTTP route and the real authorized directory", async () => {
    const app = await fixture()
    try {
      expect((await app.page.goto(app.caseUrl))?.status()).toBe(200)
      const form = app.page.locator("[data-case-question]")
      const recipient = form.getByLabel("Recipient", { exact: true })
      expect(await recipient.count()).toBe(1)
      const recipientId = await recipient.getAttribute("id")
      if (!recipientId) throw new Error("The recipient control needs its own label association")
      expect(await recipient.evaluate((control: HTMLSelectElement) => ({ labels: [...(control.labels ?? [])].map((label) => label.textContent), explicit: [...(control.labels ?? [])].every((label) => label.htmlFor === control.id && !label.contains(control)), ids: [...document.querySelectorAll("[id]")].filter((element) => element.id === control.id).length }))).toEqual({ labels: ["Recipient"], explicit: true, ids: 1 })
      expect(await form.getByLabel("Record", { exact: true }).count()).toBe(1)
      expect(await form.getByLabel("Record", { exact: true }).getAttribute("id")).not.toBe(recipientId)
      await form.getByLabel("Question", { exact: true }).fill("Preserve this question while choosing a real recipient")
      const response = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-recipients")
      await form.getByRole("button", { name: "Find recipients", exact: true }).click()
      const found = await response
      expect(found.status()).toBe(200)
      expect(await found.json()).toEqual({ status: "ok", value: [{ id: app.principalRef, name: "Authorized work reviewer" }] })
      await app.page.waitForFunction((principal) => [...document.querySelectorAll<HTMLOptionElement>('select[name="recipient"] option')].some((option) => option.value === principal), app.principalRef)
      expect(await recipient.getAttribute("id")).toBe(recipientId)
      expect(await recipient.evaluate((control: HTMLSelectElement) => [...(control.labels ?? [])].map((label) => label.textContent))).toEqual(["Recipient"])
      expect(await form.getByLabel("Recipient", { exact: true }).isEnabled()).toBe(true)
      await form.getByLabel("Recipient", { exact: true }).selectOption(app.principalRef)
      expect(await form.getByLabel("Recipient", { exact: true }).inputValue()).toBe(app.principalRef)
      expect(await form.getByLabel("Question", { exact: true }).inputValue()).toBe("Preserve this question while choosing a real recipient")
      expect(app.attempts.map((attempt) => attempt.route)).toEqual(["collaboration-recipients"])
      expect(JSON.parse(app.attempts[0]!.body)).toEqual({})
      expect(app.attempts.some((attempt) => attempt.route === "collaboration-thread-create")).toBe(false)
      const state = await app.authority.state.read(app.request(), "threads", (value) => Object.keys(value.threads))
      expect(state.status).toBe("ok")
      if (state.status === "ok") expect(state.value).toEqual([])
      // The production router has no legacy alias. A matching mock route cannot
      // accidentally make this consumer proof pass.
      const obsolete = await app.post("collaboration-recipient-list")
      expect(obsolete.status).toBe(404)
      expect(await obsolete.json()).toEqual({ status: "unavailable", reason: "collaboration-route-unavailable" })
      expect(app.errors).toEqual([])
    } finally { await app.close() }
  }, 45_000)

  test("real logout denies directory reads and the question consumer purges its protected recipient and draft", async () => {
    const app = await fixture()
    try {
      expect((await app.page.goto(app.caseUrl))?.status()).toBe(200)
      const form = app.page.locator("[data-case-question]")
      await form.getByLabel("Question", { exact: true }).fill("Private recipient draft")
      const listed = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-recipients")
      await form.getByRole("button", { name: "Find recipients", exact: true }).click()
      expect((await listed).status()).toBe(200)
      await app.page.waitForFunction((principal) => [...document.querySelectorAll<HTMLOptionElement>('select[name="recipient"] option')].some((option) => option.value === principal), app.principalRef)
      expect(await form.getByLabel("Recipient", { exact: true }).count()).toBe(1)
      expect(await form.getByLabel("Recipient", { exact: true }).isEnabled()).toBe(true)
      await form.getByLabel("Recipient", { exact: true }).selectOption(app.principalRef)
      const retainedForm = await form.elementHandle()
      if (!retainedForm) throw new Error("Live question form unavailable before revocation")
      expect(await app.page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST" })).status)).toBe(204)
      const denied = app.page.waitForResponse((value) => new URL(value.url()).searchParams.get("sf") === "collaboration-recipients")
      await form.getByRole("button", { name: "Find recipients", exact: true }).click()
      expect((await denied).status()).toBe(403)
      await app.page.locator("main[data-access-unavailable]").waitFor()
      expect(await retainedForm.evaluate((element) => element.querySelector('[role="status"]')?.textContent)).toMatch(/^Question access changed/)
      expect(await retainedForm.getAttribute("data-context")).toBeNull()
      expect(await retainedForm.getAttribute("data-dirty")).toBeNull()
      expect(await retainedForm.evaluate((element) => element.querySelectorAll("select,textarea,input,button").length)).toBe(0)
      expect(await form.count()).toBe(0)
      expect(await app.page.content()).not.toContain("Private recipient draft")
      expect(await retainedForm.textContent()).not.toContain("Authorized work reviewer")
      await retainedForm.dispose()
      expect(app.attempts.map((attempt) => [attempt.route, attempt.status])).toEqual([["collaboration-recipients", 200], ["collaboration-recipients", 403]])
      expect(app.attempts.some((attempt) => attempt.route === "collaboration-thread-create")).toBe(false)
      expect(app.errors).toEqual([])
    } finally { await app.close() }
  }, 45_000)
}
