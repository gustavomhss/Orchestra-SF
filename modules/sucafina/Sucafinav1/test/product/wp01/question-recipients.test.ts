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
  type Fixture = Awaited<ReturnType<typeof fixture>>
  const recipientURL = (app: Fixture) => new URL("?sf=collaboration-recipients", app.caseUrl).href
  const recipientResponse = (app: Fixture) =>
    app.page.waitForResponse((response) => response.url() === recipientURL(app) && response.request().method() === "POST")

  async function within<T>(operation: Promise<T>, phase: string): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([operation, new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Question recipient verification timed out: ${phase}`)), 5_000)
      })])
    } finally { if (timeout !== undefined) clearTimeout(timeout) }
  }
  // The installed Workbench can load unrelated panels. Every collaboration attempt still counts.
  const collaborationAttempts = (app: Fixture) =>
    app.attempts.filter((attempt) => attempt.route?.startsWith("collaboration-"))

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
      const response = recipientResponse(app)
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
      const attempts = collaborationAttempts(app)
      expect(attempts.map((attempt) => attempt.route)).toEqual(["collaboration-recipients"])
      expect(JSON.parse(attempts[0]!.body)).toEqual({})
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
      const listed = recipientResponse(app)
      await form.getByRole("button", { name: "Find recipients", exact: true }).click()
      expect((await listed).status()).toBe(200)
      await app.page.waitForFunction((principal) => [...document.querySelectorAll<HTMLOptionElement>('select[name="recipient"] option')].some((option) => option.value === principal), app.principalRef)
      expect(await form.getByLabel("Recipient", { exact: true }).count()).toBe(1)
      expect(await form.getByLabel("Recipient", { exact: true }).isEnabled()).toBe(true)
      await form.getByLabel("Recipient", { exact: true }).selectOption(app.principalRef)
      const retainedForm = await form.elementHandle()
      if (!retainedForm) throw new Error("Live question form unavailable before revocation")
      const logout = await app.context.request.post(`${app.origin}/sucafina/auth/logout`, { headers: { origin: app.origin }, timeout: 5_000 })
      expect(logout.status()).toBe(204)
      // The widget ignores denied bodies. Read the real producer response
      // before forwarding it unchanged to the browser for revocation.
      const producer = Promise.withResolvers<{ status: number; body: unknown }>()
      void producer.promise.catch(() => undefined)
      await app.page.route(recipientURL(app), async (route) => {
        try {
          expect(route.request().method()).toBe("POST")
          const response = await route.fetch({ maxRedirects: 0, maxRetries: 0, timeout: 5_000 })
          const body: unknown = await within(response.json(), "read the real denial body")
          await route.fulfill({ response })
          producer.resolve({ status: response.status(), body })
        } catch (error) {
          producer.reject(error)
          await route.abort("failed").catch(() => undefined)
        }
      }, { times: 1 })
      const [refused, actual] = await Promise.all([
        within(recipientResponse(app), "observe the canonical directory denial"),
        within(producer.promise, "verify the producer denial before browser delivery"),
        form.getByRole("button", { name: "Find recipients", exact: true }).click(),
      ])
      expect(refused.status()).toBe(403)
      expect(actual.status).toBe(403)
      const refusal = actual.body
      expect(refusal).toMatchObject({ status: "denied" })
      expect(refusal).not.toHaveProperty("value")
      await app.page.locator("main[data-access-unavailable]").waitFor()
      expect(await retainedForm.evaluate((element) => element.querySelector('[role="status"]')?.textContent)).toMatch(/^Question access changed/)
      expect(await retainedForm.getAttribute("data-context")).toBeNull()
      expect(await retainedForm.getAttribute("data-dirty")).toBeNull()
      expect(await retainedForm.evaluate((element) => element.querySelectorAll("select,textarea,input,button").length)).toBe(0)
      expect(await form.count()).toBe(0)
      expect(await app.page.content()).not.toContain("Private recipient draft")
      expect(await retainedForm.textContent()).not.toContain("Authorized work reviewer")
      await retainedForm.dispose()
      const attempts = collaborationAttempts(app)
      expect(attempts.map((attempt) => [attempt.route, attempt.status, JSON.parse(attempt.body)])).toEqual([
        ["collaboration-recipients", 200, {}],
        ["collaboration-recipients", 403, {}],
      ])
      expect(app.attempts.some((attempt) => attempt.route === "collaboration-thread-create")).toBe(false)
      // Read durable state with a fresh observer session outside the revoked browser.
      const enrollment = await within(app.identity.enroll(), "prepare the state observer enrollment")
      const login = await within(app.identity.handle(new Request(`${app.origin}/sucafina/auth/local?code=${enrollment}`)), "admit the state observer")
      const cookie = login?.headers.get("set-cookie")?.split(";")[0]
      if (!cookie) throw new Error("The authorized state observer did not receive a session")
      const request = app.request()
      request.headers.set("cookie", cookie)
      const state = await within(app.authority.state.read(request, "threads", (value) => Object.keys(value.threads)), "read persisted threads")
      expect(state.status).toBe("ok")
      if (state.status === "ok") expect(state.value).toEqual([])
      expect(app.errors).toEqual([])
    } finally { await app.close() }
  }, 45_000)
}
