import { expect } from "bun:test"
import type { BrowserContext, Locator, Page, Response } from "@playwright/test"
import { object, rows } from "../../../../runtime/contract.ts"
import { createConsumerReadFixture, initialCaseRef } from "../../dashboard-installed-closure/ownhost-fixture.ts"
import { storeExistingChoice } from "../../wp02/workbench-recovery-fixture.ts"
import { enrollNativeBrowser } from "../../native-ui-browser/session.ts"
import { observeNativeFetch, type NativeFetchCapture } from "../../native-ui-browser/observed-fetch.ts"

export { createConsumerReadFixture, initialCaseRef }
export type RecoveryFixture = Awaited<ReturnType<typeof createConsumerReadFixture>>
export const recoveryPrefix = "sf-ui54-recovery-v1:"
export const unknownMessage = "Result unknown. Check the current source before another command."
export const pendingSaveMessage = "The original first save is still unconfirmed. No fields or draft identity were restored from browser storage."
export const recoveredMessage = "The original application receipt was recovered. No application command was sent."
export const savedMessage = "Draft saved. It can be included in a case choice before preparation."
export const privatePanel = (page: Page) => page.getByRole("region", { name: "Private follow-up proposals", exact: true })
export const applicationPanel = (page: Page) => page.locator('[data-sf-surface="UI54"]')
export const modeUrl = (mode: string) => (url: URL) => url.pathname === "/sucafina/dashboard" && url.searchParams.get("sf") === mode
export const modeResponse = (mode: string) => (response: Response) =>
  response.request().method() === "POST" && modeUrl(mode)(new URL(response.url()))

const captures = new WeakMap<BrowserContext, NativeFetchCapture>()
const captureFor = (page: Page) => {
  const capture = captures.get(page.context())
  if (!capture) throw new Error("Native recovery response observer was not installed")
  return capture
}
// Copy the genuine response before its native consumer can abort or navigate.
// Keep the original browser UUID and closed JSON input in the same observation.
export const receive = async (page: Page, mode: string) => {
  const response = await captureFor(page)(page, (entry) => entry.method === "POST" && modeUrl(mode)(new URL(entry.url)))
  return { status: response.status, body: response.body, key: response.idempotencyKey,
    request: response.requestBody as Record<string, unknown> }
}
export const receiveContext = (page: Page) => captureFor(page)(page,
  (entry) => entry.method === "GET" && new URL(entry.url).pathname === "/sucafina/api/ui/context")
export const receiveCases = (page: Page) => captureFor(page)(page,
  (entry) => entry.method === "GET" && new URL(entry.url).pathname === "/sucafina/api/ui/projections/cases")

export async function correlations(page: Page) {
  return page.evaluate((prefix) => Object.entries(sessionStorage).filter(([key]) => key.startsWith(prefix))
    .map(([key, value]) => ({ partition: key, value: JSON.parse(value) as Record<string, unknown> })), recoveryPrefix)
}

export async function assertPrivateCorrelation(page: Page, expected: Record<string, unknown>) {
  const stored = await correlations(page)
  expect(stored).toHaveLength(1)
  expect(stored[0]!.partition).toMatch(/^sf-ui54-recovery-v1:[a-f0-9]{64}$/)
  const value = stored[0]!.value
  expect(Number.isSafeInteger(value.expiresAt)).toBe(true)
  expect(Number(value.expiresAt)).toBeGreaterThan(await page.evaluate(() => Date.now()))
  expect(value).toEqual({ ...expected, expiresAt: value.expiresAt })
  const historyValue = JSON.stringify(await page.evaluate(() => history.state))
  for (const text of ["reviewDigest", "Private recovery explanation", String(expected.key)])
    expect(historyValue).not.toContain(text)
  return stored
}

export async function openWorkbench(page: Page, fixture: RecoveryFixture) {
  page.setDefaultTimeout(10_000)
  page.setDefaultNavigationTimeout(15_000)
  if (!captures.has(page.context())) {
    const capture = await observeNativeFetch(page.context(), { origin: fixture.origin, timeoutMs: 10_000,
      endpoints: [
        ...["dashboard-workbench", "dashboard-hot-topic-draft", "dashboard-hot-topic-prepare", "dashboard-hot-topic-recover"]
          .map((sf) => ({ method: "POST" as const, path: "/sucafina/dashboard", sf })),
        { method: "GET", path: "/sucafina/api/ui/context" },
        { method: "GET", path: "/sucafina/api/ui/projections/cases" },
      ],
    })
    captures.set(page.context(), capture)
  }
  await enrollNativeBrowser(page.context(), fixture.origin, () => fixture.identity.enroll())
  expect((await page.goto(fixture.origin + "/orchestra/sf-dashboard/hot-topics"))?.status()).toBe(200)
  await page.getByRole("link", { name: "Private follow-up proposals", exact: true }).click()
  const panel = privatePanel(page)
  await panel.getByText("Options loaded.", { exact: true }).waitFor()
  await loadPrivateOptions(page, panel)
  expect(await panel.textContent()).not.toContain("Unrelated confidential case")
  return panel
}

export async function loadPrivateOptions(page: Page, panel = privatePanel(page)) {
  const read = receive(page, "dashboard-workbench")
  await panel.getByRole("button", { name: "Load options", exact: true }).click()
  const returned = await read
  expect(returned.status).toBe(200)
  expect(object(returned.body).status).toBe("ok")
  return returned
}

export async function editNewDraft(page: Page, action: string) {
  const panel = privatePanel(page)
  await panel.getByRole("combobox", { name: "Case", exact: true }).selectOption({ label: "Review the action" })
  await panel.getByRole("combobox", { name: "Proposal", exact: true }).selectOption("new")
  await panel.getByRole("combobox", { name: "Source Hot Topic", exact: true }).selectOption({ label: "Original action" })
  await panel.getByLabel("Action", { exact: true }).fill(action)
  await panel.getByLabel("Notes", { exact: true }).fill("Private recovery explanation")
}

export async function openPreparation(page: Page, fixture: RecoveryFixture, action: string) {
  const panel = await openWorkbench(page, fixture)
  await editNewDraft(page, action)
  const save = receive(page, "dashboard-hot-topic-draft")
  await panel.getByRole("button", { name: "Save private draft", exact: true }).click()
  expect((await save).status).toBe(200)
  await panel.getByText(savedMessage, { exact: true }).waitFor()
  const listed = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
  if (listed.status !== "ok" || listed.value.length !== 1) throw new Error("Expected one real draft")
  const draft = await fixture.read((context) => fixture.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: listed.value[0]!.draftRef }, context))
  if (draft.status !== "ok") throw new Error("Expected authorized draft")
  await storeExistingChoice(fixture, draft.value)
  await panel.getByRole("link", { name: "Review saved proposal", exact: true }).click()
  const preparation = applicationPanel(page)
  await preparation.getByText(action, { exact: true }).waitFor()
  expect(await preparation.getByRole("button", { name: "Review before applying", exact: true }).isEnabled()).toBe(true)
  return preparation
}

export async function prepareApply(page: Page, fixture: RecoveryFixture, action: string) {
  const preparation = await openPreparation(page, fixture, action)
  const prepared = receive(page, "dashboard-hot-topic-prepare")
  await preparation.getByRole("button", { name: "Review before applying", exact: true }).click()
  const result = await prepared
  expect(result.status).toBe(200)
  expect(object(result.body).status).toBe("ok")
  await preparation.locator('[data-component="sf-change-review"][data-state="ready"]').waitFor()
  expect(await preparation.getByRole("button", { name: "Confirm application", exact: true }).isEnabled()).toBe(true)
  // S03 renders the real current and proposed fields and requires an explicit
  // human confirmation bound to the producer's current review digest.
  expect(await preparation.locator('[data-component="sf-change-review"]').textContent()).toContain("Original action")
  expect(await preparation.locator('[data-component="sf-change-review"]').textContent()).toContain(action)
  return preparation
}

export async function reloadApply(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept())
  expect((await page.reload())?.status()).toBe(200)
  const panel = applicationPanel(page)
  await panel.getByRole("region", { name: "Original application recovery", exact: true }).waitFor()
  const recover = panel.getByRole("button", { name: "Read original application receipt", exact: true })
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((button) =>
    button.textContent?.trim() === "Read original application receipt" && !button.disabled))
  expect(await recover.isEnabled()).toBe(true)
  expect(await panel.getByRole("button", { name: "Confirm application", exact: true }).isDisabled()).toBe(true)
  return panel
}

export async function observedApplication(fixture: RecoveryFixture) {
  const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[initialCaseRef.id])
  if (current.status !== "ok" || !current.value) throw new Error("Expected persisted case")
  const domain = await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
    value: { action: rows(snapshot.data.hotTopics)[0]!.action, version: snapshot.versions["hotTopics:topic"]?.version } }))
  return { decision: current.value, domain }
}
