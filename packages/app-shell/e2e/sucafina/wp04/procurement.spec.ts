import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"

type Account = { baseURL: string; principal: string; enrollments: Record<string, string> }
type Manifest = { origin: string; accounts: { first: Account; second: Account } }

test.describe.configure({ retries: 0 })

async function login(page: Page, account: "first" | "second", scenario: string) {
  const manifest = JSON.parse(await readFile(path.join(import.meta.dirname, ".host-manifest.json"), "utf8")) as Manifest
  const selected = manifest.accounts[account]
  const enrollment = selected.enrollments[scenario]
  if (!enrollment) throw new Error("The selected real-host enrollment is unavailable")
  const response = await page.request.get(enrollment, { maxRedirects: 0 })
  expect(response.status()).toBe(303)
  await page.goto(selected.baseURL + "/procurement?page=Requests")
  await expect(page.getByRole("heading", { name: "Requests", exact: true })).toBeVisible()
  await expect(page.getByRole("button", { name: "Create request", exact: true })).toBeEnabled()
  return selected
}

function responseFor(page: Page, action: string, id?: string) {
  return page.waitForResponse((response) => {
    const request = response.request()
    if (request.method() !== "POST" || !new URL(request.url()).pathname.endsWith("/procurement")) return false
    const payload = request.postDataJSON() as { action?: string; id?: string }
    return payload.action === action && (id === undefined || payload.id === id)
  })
}

async function createDraft(page: Page, account: Account, title: string) {
  const form = page.locator('form[data-command="create"][data-page="Requests"]')
  await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("Recorded service scope")
  await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  await form.getByRole("textbox", { name: "Cost centre", exact: true }).fill("Synthetic IT")
  await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Recorded business need")
  const response = responseFor(page, "create")
  await form.getByRole("button", { name: "Create request", exact: true }).click()
  expect((await response).status()).toBe(200)
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const link = row.getByRole("link", { name: /^PR-/ })
  await expect(link).toHaveText(/^PR-2026-\d+$/)
  const id = (await link.textContent())!.trim()
  await openRecord(page, account, id)
  await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("Draft")
  return id
}

async function openRecord(page: Page, account: Account, id: string) {
  await page.goto(account.baseURL + "/procurement?" + new URLSearchParams({ page: "Requests", request: id, q: id }))
  const detail = page.locator('details[id="' + id + '"]')
  await expect(detail).toHaveAttribute("open", "")
  await expect(detail.locator("[data-request-summary]")).toContainText("Version")
  return detail
}

async function proof(page: Page, info: TestInfo, name: string, observation: Record<string, unknown>) {
  await info.attach(name + ".png", { body: await page.screenshot(), contentType: "image/png" })
  await info.attach(name + ".json", { body: Buffer.from(JSON.stringify({ ...observation, humanTimingMeasured: false })), contentType: "application/json" })
}

test("keyboard submission uses current entries and focuses the real 422 field without clearing the draft", async ({ page }, info) => {
  const account = await login(page, "first", "validation")
  const id = await createDraft(page, account, "Keyboard validation request")
  const section = page.locator('section[id="' + id + '-pr"]')
  const title = section.getByRole("textbox", { name: "Title", exact: true })
  const justification = section.getByRole("textbox", { name: /^Justification/ })
  await title.fill("Unsent title retained through validation")
  await justification.fill("")
  const invalid = responseFor(page, "submit_pr", id)
  await section.getByRole("button", { name: "Submit requisition", exact: true }).focus()
  await page.keyboard.press("Enter")
  const rejected = await invalid
  expect(rejected.status()).toBe(422)
  expect(rejected.request().postDataJSON().values.pr).toMatchObject({ title: "Unsent title retained through validation", justification: "" })
  expect((await rejected.json()).fieldErrors).toContainEqual({ field: "pr.justification", message: "Business justification is required" })
  await expect(justification).toBeFocused()
  await expect(justification).toHaveAttribute("aria-invalid", "true")
  await expect(justification).toHaveAccessibleDescription("Business justification is required")
  await expect(section.locator('[data-field-error="pr.justification"]')).toHaveText("Business justification is required")
  await expect(title).toHaveValue("Unsent title retained through validation")
  await expect(section.locator('form[data-command="save"]')).toHaveAttribute("data-version", "1")
  await proof(page, info, "keyboard-422", { id, status: 422, focusedField: "pr.justification", draftPreserved: true })

  await justification.fill("Corrected explanation remains part of this submission")
  const accepted = responseFor(page, "submit_pr", id)
  await section.getByRole("button", { name: "Submit requisition", exact: true }).focus()
  await page.keyboard.press("Enter")
  expect((await accepted).status()).toBe(200)
  await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("Requisition approval")
  await expect(section.getByRole("button", { name: "Submit requisition", exact: true })).toBeDisabled()
  await expect(title).toHaveValue("Unsent title retained through validation")
  await expect(justification).toHaveValue("Corrected explanation remains part of this submission")
  await expect(section.locator("[data-field-error]")).toHaveCount(0)
})

test("two authenticated actors review an actual CAS conflict and submit only after an explicit version choice", async ({ page, browser }, info) => {
  const first = await login(page, "first", "conflict")
  const id = await createDraft(page, first, "Concurrent procurement request")
  const secondContext = await browser.newContext()
  try {
    const secondPage = await secondContext.newPage()
    const second = await login(secondPage, "second", "conflict")
    await openRecord(secondPage, second, id)
    const firstSection = page.locator('section[id="' + id + '-pr"]')
    const secondSection = secondPage.locator('section[id="' + id + '-pr"]')
    const secondForm = secondSection.locator('form[data-command="save"]')
    const secondTitle = secondSection.getByRole("textbox", { name: "Title", exact: true })
    const secondDescription = secondSection.getByRole("textbox", { name: "Description", exact: true })
    const posts: string[] = []
    secondPage.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/procurement")) posts.push(request.postData() ?? "")
    })
    await secondDescription.fill("Second actor's unsent scope")
    await firstSection.getByRole("textbox", { name: "Title", exact: true }).fill("First actor's saved title")
    const firstSaved = responseFor(page, "save", id)
    await firstSection.getByRole("button", { name: "Save requisition", exact: true }).click()
    expect((await firstSaved).status()).toBe(200)
    await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("Version 2")
    const conflict = responseFor(secondPage, "save", id)
    await secondSection.getByRole("button", { name: "Save requisition", exact: true }).focus()
    await secondPage.keyboard.press("Enter")
    const stale = await conflict
    expect(stale.status()).toBe(409)
    expect(await stale.json()).toMatchObject({ ok: false, currentVersionCAS: 2, stored: { pr: { title: "First actor's saved title" } } })
    const review = secondForm.getByRole("region", { name: "Review conflicting changes", exact: true })
    await expect(review.getByRole("heading", { name: "Review the changed record", exact: true })).toBeFocused()
    await expect(review.locator("[data-current-version-cas]")).toHaveText("Current version: 2.")
    await expect(secondDescription).toHaveValue("Second actor's unsent scope")
    await expect(secondForm).toHaveAttribute("data-version", "1")
    expect(posts).toHaveLength(1)
    await secondSection.getByRole("button", { name: "Save requisition", exact: true }).click()
    await expect(secondPage.locator("#notice")).toHaveText("Review the current record before submitting your preserved entries.")
    expect(posts).toHaveLength(1)
    await openRecord(page, first, id)
    await expect(firstSection.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("First actor's saved title")
    await expect(firstSection.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Recorded service scope")

    // The operator keeps the current title while retaining their separate unsaved change.
    await secondTitle.fill("First actor's saved title")
    await review.getByRole("button", { name: "Review current record", exact: true }).click()
    await expect(review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true })).toBeFocused()
    await expect(review.getByRole("table")).toContainText("Second actor's unsent scope")
    await expect(secondForm).toHaveAttribute("data-version", "1")
    expect(posts).toHaveLength(1)
    await proof(secondPage, info, "cas-explicit-review-step", { id, status: 409, currentVersionCAS: 2, postCountBeforeChoice: posts.length })
    await review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true }).press("Enter")
    await expect(secondForm).toHaveAttribute("data-version", "2")
    await expect(secondTitle).toBeFocused()
    await expect(secondDescription).toHaveValue("Second actor's unsent scope")
    expect(posts).toHaveLength(1)
    const reviewedSave = responseFor(secondPage, "save", id)
    await secondSection.getByRole("button", { name: "Save requisition", exact: true }).click()
    expect((await reviewedSave).status()).toBe(200)
    await expect(secondPage.locator('[data-request-summary="' + id + '"]')).toContainText("Version 3")
    expect(posts).toHaveLength(2)
    await openRecord(page, first, id)
    await expect(firstSection.getByRole("textbox", { name: "Title", exact: true })).toHaveValue("First actor's saved title")
    await expect(firstSection.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Second actor's unsent scope")
  } finally { await secondContext.close() }
})

test("a stale approval preserves the typed comment and refuses to revive an action after cancellation", async ({ page, browser }, info) => {
  const second = await login(page, "second", "comment")
  const id = await createDraft(page, second, "Approval comment conflict")
  const submitted = responseFor(page, "submit_pr", id)
  await page.locator('section[id="' + id + '-pr"]').getByRole("button", { name: "Submit requisition", exact: true }).click()
  expect((await submitted).status()).toBe(200)
  await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("Requisition approval")
  const holderContext = await browser.newContext()
  try {
    const holderPage = await holderContext.newPage()
    const first = await login(holderPage, "first", "comment")
    const detail = await openRecord(holderPage, first, id)
    const approval = detail.locator('form[data-command="approve"]')
    const comment = approval.getByRole("textbox", { name: "Comment", exact: true })
    await expect(approval.getByRole("button", { name: "Approve", exact: true })).toBeEnabled()
    await comment.fill("My approval rationale must remain unsent")
    const cancel = page.locator('details[id="' + id + '"] form[data-command="cancel"]')
    await cancel.getByRole("textbox", { name: "Reason", exact: true }).fill("Requester no longer needs this purchase")
    const cancelled = responseFor(page, "cancel", id)
    await cancel.getByRole("button", { name: "Cancel", exact: true }).click()
    expect((await cancelled).status()).toBe(200)
    await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("Cancelled")
    const writes: string[] = []
    holderPage.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/procurement")) writes.push(request.postData() ?? "")
    })
    const conflict = responseFor(holderPage, "approve", id)
    await approval.getByRole("button", { name: "Approve", exact: true }).press("Enter")
    const rejected = await conflict
    expect(rejected.status()).toBe(409)
    expect(await rejected.json()).toMatchObject({ currentVersionCAS: 3, stored: { status: "cancelled" } })
    await expect(comment).toHaveValue("My approval rationale must remain unsent")
    const review = approval.getByRole("region", { name: "Review conflicting changes", exact: true })
    await review.getByRole("button", { name: "Review current record", exact: true }).click()
    await expect(review.getByRole("status")).toHaveText("This action is no longer available for the current record. Your unsaved entries remain here; reopen the record to continue.")
    await expect(review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true })).toHaveCount(0)
    await expect(comment).toHaveValue("My approval rationale must remain unsent")
    await approval.getByRole("button", { name: "Approve", exact: true }).click()
    await expect(holderPage.locator("#notice")).toHaveText("Review the current record before submitting your preserved entries.")
    expect(writes).toHaveLength(1)
    await proof(holderPage, info, "approval-comment-preserved", { id, status: 409, currentVersionCAS: 3, postCount: writes.length, unavailableAction: "approve" })
    await openRecord(page, second, id)
    await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("Cancelled")
    await expect(page.locator('details[id="' + id + '"] form[data-command="approve"]')).toHaveCount(0)
  } finally { await holderContext.close() }
})

test("a real committed save cannot clear edits typed before its response arrives", async ({ page, browser }, info) => {
  const first = await login(page, "first", "late-edit")
  const id = await createDraft(page, first, "Edits during save response")
  const section = page.locator('section[id="' + id + '-pr"]')
  const description = section.getByRole("textbox", { name: "Description", exact: true })
  const committed: { release?: () => void; signal?: (status: number) => void } = {}
  const observed = new Promise<number>((resolve) => { committed.signal = resolve })
  const release = new Promise<void>((resolve) => { committed.release = resolve })
  await page.route("**/procurement?*", async (route) => {
    const request = route.request()
    if (request.method() !== "POST" || request.postDataJSON().action !== "save") { await route.continue(); return }
    const response = await route.fetch()
    committed.signal?.(response.status())
    await release
    await route.fulfill({ response })
  })
  const observerContext = await browser.newContext()
  try {
    await description.fill("The value sent to the real host")
    const saved = responseFor(page, "save", id)
    await section.getByRole("button", { name: "Save requisition", exact: true }).click()
    expect(await observed).toBe(200)
    await description.fill("Later edits remain unsaved")
    committed.release?.()
    expect((await saved).status()).toBe(200)
    await expect(page.locator("#notice")).toHaveText("The submitted changes were saved. Later edits remain unsaved; review them before continuing.")
    await expect(description).toHaveValue("Later edits remain unsaved")
    await expect(section.locator('form[data-command="save"]')).toHaveAttribute("data-dirty", "true")
    const observer = await observerContext.newPage()
    const second = await login(observer, "second", "late-edit")
    await openRecord(observer, second, id)
    await expect(observer.locator('section[id="' + id + '-pr"]').getByRole("textbox", { name: "Description", exact: true })).toHaveValue("The value sent to the real host")
    await proof(page, info, "later-edits-preserved", { id, status: 200, committedValue: "The value sent to the real host", unsavedValue: "Later edits remain unsaved" })
  } finally { committed.release?.(); await observerContext.close() }
})
