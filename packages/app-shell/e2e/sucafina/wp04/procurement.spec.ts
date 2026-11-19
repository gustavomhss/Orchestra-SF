import { readFile } from "node:fs/promises"
import path from "node:path"
import { expect, test } from "@playwright/test"
import { Schema } from "effect"
import { SfDomainPageCap25 } from "@orchestra/schema/sucafina/procurement"
import type { Locator, Page, TestInfo } from "@playwright/test"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { encodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"
import { login as loginNative, type Account } from "../operations-support/runtime"
import { approveRequest, confirmCommand, setEurRate } from "../operations-support/procurement-snapshot"

type Manifest = { origin: string; accounts: Record<"first" | "second" | "viewer", Omit<Account, "origin"> & { enrollments: Record<string, string> }>; records: { supplier: string; comparison: string } }

test.describe.configure({ retries: 0 })

async function readManifest() {
  return JSON.parse(await readFile(path.join(import.meta.dirname, ".host-manifest.json"), "utf8")) as Manifest
}

async function login(page: Page, account: "first" | "second" | "viewer", scenario: string) {
  const selected = await loginNative(page, account, scenario)
  const create = page.locator('form[data-command="create"][data-page="Requests"]').getByRole("button", { name: "Create request", exact: true })
  if (account === "viewer") await expect(create).toHaveCount(0)
  if (account !== "viewer") await expect(create).toBeEnabled()
  const entry = await page.goto(new URL("/orchestra/sf-procurement/requests", selected.baseURL).href)
  expect(entry?.status()).toBe(200)
  const original = await page.request.get(selected.baseURL + "/api/ui/pages/CAP25")
  expect(original.status()).toBe(200)
  const projection = Schema.decodeUnknownSync(Schema.toType(SfDomainPageCap25.output), { onExcessProperty: "error" })(await original.json())
  if (projection.status !== "ok") throw new Error("The native Procurement projection was not admitted")
  expect(projection.context.principalRef).toBe(selected.principal)
  const manifest = await readManifest()
  const published = projection.value.data.requests.find((record) => record.number === manifest.records.comparison)
  if (!published) throw new Error("The original comparison request is missing from CAP25")
  expect(published.sourceRef, "The producer must publish the current request source").toMatch(/.+/)
  expect(published.sourceDigest).toMatch(/^[a-f0-9]{64}$/)
  expect(published.sourceVersion).toBeGreaterThan(0)
  await expect(page.locator('[data-component="sf-requests-pr-po"]').getByRole("heading", { name: "Requests", exact: true })).toBeVisible()
  // Match the exact producer record and provenance, not whichever link appears first.
  const source = page.getByRole("link", { name: manifest.records.comparison, exact: true })
  await expect(source).toBeVisible()
  await expect(source).toHaveAttribute("data-source-ref", published.sourceRef!)
  await expect(source).toHaveAttribute("data-source-digest", published.sourceDigest!)
  await expect(source).toHaveAttribute("data-source-version", String(published.sourceVersion))
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
  const nativeOrigin = new URL(account.baseURL)
  nativeOrigin.port = "3000"
  await page.goto(new URL("/orchestra/sf-procurement/requests/new", nativeOrigin).href)
  const form = page.locator("article.sf-u11-detail").locator('form[data-command="create"][data-page="Requests"]')
  await expect(form).toHaveCount(1)
  await form.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await form.getByRole("combobox", { name: "Type", exact: true }).selectOption("service")
  await form.getByRole("textbox", { name: "Description", exact: true }).fill("Recorded service scope")
  await form.getByRole("spinbutton", { name: "Estimated amount", exact: true }).fill("100")
  await form.getByRole("textbox", { name: "Cost center", exact: true }).fill("Synthetic IT")
  await form.getByLabel("Needed by", { exact: true }).fill("2026-12-01")
  await form.getByRole("textbox", { name: "Justification", exact: true }).fill("Recorded business need")
  const response = responseFor(page, "create")
  await form.getByRole("button", { name: "Create request", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await expect(review.getByRole("heading", { name: "Review changes", exact: true })).toBeVisible()
  const confirm = review.getByRole("button", { name: "Confirm action", exact: true })
  await expect(confirm).toBeEnabled()
  await confirm.click()
  const created = await response
  expect(created.status()).toBe(200)
  expect(await created.json()).toMatchObject({ ok: true })
  expect(created.request().postDataJSON()).toMatchObject({ page: "Requests", action: "create", values: { pr: { title } } })
  const row = page.locator("tr[data-sf-row]").filter({ has: page.getByRole("cell", { name: title, exact: true }) })
  await expect(row).toHaveCount(1)
  const id = (await row.getAttribute("data-sf-row")) ?? ""
  expect(id).toMatch(/^PR-2026-\d+$/)
  await expect(row.getByRole("cell").first()).toContainText(id)
  await expect(row.getByRole("link")).toHaveCount(0)
  await openRecord(page, account, id)
  await expect(page.locator('[data-request-summary="' + id + '"]')).toContainText("Requisition draft")
  return id
}

async function openRecord(page: Page, account: Account, id: string) {
  expect(id).toMatch(/^PR-2026-\d+$/)
  const encoded = encodeSfRouteRef(id)
  const nativeOrigin = new URL(account.baseURL)
  nativeOrigin.port = "3000"
  await page.goto(new URL(`/orchestra/sf-procurement/requests/${encoded}`, nativeOrigin).href)
  await expect(page).toHaveURL((url) => url.origin === nativeOrigin.origin && url.pathname === `/orchestra/sf-procurement/requests/${encoded}`)
  const row = page.locator(`tr[data-sf-row="${id}"]`)
  await expect(row).toHaveCount(1)
  await expect(row).toHaveAttribute("aria-selected", "true")
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await expect(detail).toHaveCount(1)
  await expect(detail.locator("p").filter({ hasText: /^Request identity:/ })).toHaveText(`Request identity: ${id}`)
  await expect(detail.locator("p").filter({ hasText: /^Current source version:/ })).toHaveText(/^Current source version: [1-9]\d*$/)
  await expect(detail.locator(`[data-request-summary="${id}"]`)).toContainText("Version")
  return detail
}

async function proof(page: Page, info: TestInfo, name: string, observation: Record<string, unknown>, mask: Locator[] = []) {
  const path = info.outputPath(name + ".png")
  await page.screenshot({ path, mask })
  await info.attach(name + ".png", { path, contentType: "image/png" })
  await info.attach(name + ".json", { body: Buffer.from(JSON.stringify({ ...observation, humanTimingMeasured: false })), contentType: "application/json" })
}

async function supplierValidation(page: Page, account: Account, number: string) {
  const response = await page.request.get(account.baseURL + "/procurement?download=suppliers")
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]).toContain("text/csv")
  const parsed = (await response.text()).split("\r\n").map((line) =>
    [...line.matchAll(/"((?:[^"]|"")*)"(?:,|$)/g)].map((match) => match[1]!.replaceAll('""', '"')),
  )
  const columns = parsed[0] ?? []
  // This authorized read uses the viewer's existing CSV, which excludes bank fields.
  for (const field of ["iban", "account", "bankName", "swift", "accountHolder", "bankCountry"]) expect(columns).not.toContain(field)
  const selected = parsed.slice(1).filter((row) => row[columns.indexOf("number")] === number)
  expect(selected).toHaveLength(1)
  return Object.fromEntries(["number", "status", "validatedBy", "validatedAt"].map((field) => [field, selected[0]![columns.indexOf(field)]]))
}

async function requestAction(page: Page, account: Account, id: string, source: Locator, button: Locator, action: string, confirmName = "Confirm action") {
  const version = Number(await source.getAttribute("data-source-version"))
  expect(Number.isSafeInteger(version)).toBe(true)
  const response = await confirmCommand(page, account, action, id, button, confirmName)
  expect(response.request().postDataJSON().version).toBe(version)
  await expect(source).toHaveAttribute("data-source-version", String(version + 1))
  return response
}

async function saveTitle(page: Page, id: string, title: string, version: number) {
  const editor = page.locator('[data-component="sf-request-title-save"]')
  await expect(editor).toHaveCount(1)
  await editor.getByRole("textbox", { name: "Title", exact: true }).fill(title)
  await editor.getByRole("button", { name: "Review save", exact: true }).click()
  const review = editor.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  const pending = responseFor(page, "save", id)
  await review.getByRole("button", { name: "Confirm save", exact: true }).click()
  const response = await pending
  expect(response.status()).toBe(200)
  expect(await response.json()).toMatchObject({ ok: true })
  expect(response.request().postDataJSON()).toEqual({ page: "Requests", action: "save", id, version, values: { pr: { title } } })
  await expect(page.locator(`article[data-sf-request-ref="${id}"] p`).filter({ hasText: /^Current source version:/ }))
    .toHaveText("Current source version: " + String(version + 1))
}

test("keyboard submission uses current entries and focuses the real 422 field without clearing the draft", async ({ page }, info) => {
  const account = await login(page, "first", "validation")
  const id = await createDraft(page, account, "Keyboard validation request")
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  const section = detail.locator('section[data-stage="pr"]')
  const title = detail.locator('[data-component="sf-request-title-save"]').getByRole("textbox", { name: "Title", exact: true })
  const description = section.getByRole("textbox", { name: "Description", exact: true })
  const justification = section.getByRole("textbox", { name: "Justification", exact: true })
  const changedTitle = "Unsent title retained through validation"
  const changedDescription = "Unsent scope retained through validation"
  await title.fill(changedTitle)
  await description.fill(changedDescription)
  await justification.fill("")
  const invalid = responseFor(page, "submit_pr", id)
  await section.getByRole("button", { name: "Submit requisition", exact: true }).focus()
  await page.keyboard.press("Enter")
  const review = detail.locator('[data-component="sf-change-review"]')
  await expect(review).toHaveCount(1)
  await review.getByRole("button", { name: "Confirm action", exact: true }).focus()
  await page.keyboard.press("Enter")
  const rejected = await invalid
  expect(rejected.status()).toBe(422)
  expect(rejected.request().postDataJSON().values.pr).toMatchObject({ description: changedDescription, justification: "" })
  // W19 owns title mutation. A residual PR submit must not silently absorb its draft.
  expect(rejected.request().postDataJSON().values.pr).not.toHaveProperty("title")
  expect((await rejected.json()).fieldErrors).toContainEqual({ field: "pr.justification", message: "Business justification is required" })
  await expect(justification).toBeFocused()
  await expect(justification).toHaveAttribute("aria-invalid", "true")
  await expect(justification).toHaveAccessibleName("Justification")
  await expect(justification).toHaveAccessibleDescription("Business justification is required")
  await expect(section.locator('[data-field-error="pr.justification"]')).toHaveText("Business justification is required")
  await expect(title).toHaveValue(changedTitle)
  await expect(description).toHaveValue(changedDescription)
  await expect(section).toHaveAttribute("data-draft-version", "1")
  await expect(detail.locator("p").filter({ hasText: /^Current source version:/ })).toHaveText("Current source version: 1")
  await proof(page, info, "keyboard-422", { id, status: 422, focusedField: "pr.justification", draftPreserved: true })

  // Commit the separate title intent through its original W19 command, then
  // explicitly review the newer source before retaining this PR draft.
  await saveTitle(page, id, changedTitle, 1)
  const conflict = detail.locator('[data-draft-conflict="pr"]')
  await expect(conflict).toBeVisible()
  await conflict.getByRole("button", { name: "Review current record", exact: true }).click()
  await expect(conflict.locator("[data-current-version-cas]")).toHaveText("Current version: 2.")
  await conflict.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true }).click()
  await expect(section).toHaveAttribute("data-draft-version", "2")
  await expect(description).toHaveValue(changedDescription)
  await justification.fill("Corrected explanation remains part of this submission")
  const accepted = responseFor(page, "submit_pr", id)
  await section.getByRole("button", { name: "Submit requisition", exact: true }).focus()
  await page.keyboard.press("Enter")
  await expect(review).toHaveCount(1)
  await review.getByRole("button", { name: "Confirm action", exact: true }).press("Enter")
  const submitted = await accepted
  expect(submitted.status()).toBe(200)
  expect(submitted.request().postDataJSON()).toMatchObject({ page: "Requests", action: "submit_pr", id, version: 2,
    values: { pr: { description: changedDescription, justification: "Corrected explanation remains part of this submission" } } })
  expect(submitted.request().postDataJSON().values.pr).not.toHaveProperty("title")
  await expect(detail.locator("[data-request-summary]")).toContainText("Requisition approval")
  await expect(detail.getByRole("button", { name: "Submit requisition", exact: true })).toHaveCount(0)
  await expect(detail.getByRole("heading", { name: changedTitle, exact: true })).toBeVisible()
  const readonly = detail.locator('section[data-stage="pr-readonly"]')
  await expect(readonly.getByRole("textbox", { name: "Description", exact: true })).toHaveValue(changedDescription)
  await expect(readonly.getByRole("textbox", { name: "Justification", exact: true })).toHaveValue("Corrected explanation remains part of this submission")
  await expect(readonly.getByRole("textbox", { name: "Justification", exact: true })).toBeDisabled()
  await expect(detail.locator("[data-field-error]")).toHaveCount(0)
})

test("two authenticated actors review an actual CAS conflict and submit only after an explicit version choice", async ({ page, browser }, info) => {
  const first = await login(page, "first", "conflict")
  const id = await createDraft(page, first, "Concurrent procurement request")
  const secondContext = await browser.newContext()
  let releaseStale: (() => void) | undefined
  try {
    const secondPage = await secondContext.newPage()
    const second = await login(secondPage, "second", "conflict")
    const firstDetail = page.locator(`article[data-sf-request-ref="${id}"]`)
    const firstSection = firstDetail.locator('section[data-stage="pr"]')
    const secondDetail = await openRecord(secondPage, second, id)
    const secondSection = secondDetail.locator('section[data-stage="pr"]')
    const secondDescription = secondSection.getByRole("textbox", { name: "Description", exact: true })
    const save = secondSection.getByRole("button", { name: "Save requisition draft", exact: true })
    const posts: string[] = []
    secondPage.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/procurement")) posts.push(request.postData() ?? "")
    })
    await secondDescription.fill("Second actor's unsent scope")

    // Let the real native preflight finish, then delay this unchanged outgoing
    // command while the other authenticated actor advances the producer CAS.
    // No response, cookie, command body or authority is replaced.
    let observedStale: ((payload: unknown) => void) | undefined
    const observed = new Promise<unknown>((resolve) => { observedStale = resolve })
    const release = new Promise<void>((resolve) => { releaseStale = resolve })
    let held = false
    await secondPage.route((url) => url.pathname.endsWith("/procurement"), async (route) => {
      const request = route.request()
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as { action?: string; id?: string }
        if (!held && payload.action === "save" && payload.id === id) {
          held = true
          observedStale?.(payload)
          await release
        }
      }
      await route.continue()
    })
    const conflict = responseFor(secondPage, "save", id)
    await save.press("Enter")
    const confirmation = secondDetail.locator('[data-component="sf-change-review"]')
    await expect(confirmation).toHaveCount(1)
    await confirmation.getByRole("button", { name: "Confirm action", exact: true }).press("Enter")
    expect(await observed).toMatchObject({ page: "Requests", action: "save", id, version: 1,
      values: { pr: { description: "Second actor's unsent scope" } } })
    await saveTitle(page, id, "First actor's saved title", 1)
    releaseStale?.()
    const stale = await conflict
    expect(stale.status()).toBe(409)
    expect(await stale.json()).toMatchObject({ ok: false, currentVersionCAS: 2, stored: { pr: { title: "First actor's saved title" } } })
    expect(stale.request().postDataJSON().values.pr).not.toHaveProperty("title")
    const review = secondDetail.getByRole("region", { name: "Review the changed record", exact: true })
    await expect(review.getByRole("heading", { name: "Review the changed record", exact: true })).toBeFocused()
    await expect(review.locator("[data-current-version-cas]")).toHaveText("Current version: 2.")
    await expect(secondDescription).toHaveValue("Second actor's unsent scope")
    await expect(secondSection).toHaveAttribute("data-draft-version", "1")
    await expect(save).toBeDisabled()
    await save.press("Enter")
    expect(posts).toHaveLength(1)
    await openRecord(page, first, id)
    await expect(firstDetail.getByRole("heading", { name: "First actor's saved title", exact: true })).toBeVisible()
    await expect(firstSection.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Recorded service scope")

    // W19 owns the current title. The explicit choice retains only this PR
    // editor's unsent fields; it never copies title into the residual command.
    await review.getByRole("button", { name: "Review current record", exact: true }).click()
    await expect(review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true })).toBeFocused()
    await expect(review.getByRole("table")).toContainText("Second actor's unsent scope")
    await expect(review.getByRole("table")).toContainText("Recorded service scope")
    await expect(review).toContainText("First actor's saved title")
    await expect(secondSection).toHaveAttribute("data-draft-version", "1")
    expect(posts).toHaveLength(1)
    await proof(secondPage, info, "cas-explicit-review-step", { id, status: 409, currentVersionCAS: 2, postCountBeforeChoice: posts.length })
    await review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true }).press("Enter")
    await expect(secondSection).toHaveAttribute("data-draft-version", "2")
    await expect(secondDescription).toBeFocused()
    await expect(secondDescription).toHaveValue("Second actor's unsent scope")
    expect(posts).toHaveLength(1)
    const reviewedSave = responseFor(secondPage, "save", id)
    await save.click()
    await expect(confirmation).toHaveCount(1)
    await confirmation.getByRole("button", { name: "Confirm action", exact: true }).click()
    const accepted = await reviewedSave
    expect(accepted.status()).toBe(200)
    expect(accepted.request().postDataJSON()).toMatchObject({ page: "Requests", action: "save", id, version: 2,
      values: { pr: { description: "Second actor's unsent scope" } } })
    expect(accepted.request().postDataJSON().values.pr).not.toHaveProperty("title")
    await expect(secondDetail.locator("[data-request-summary]")).toContainText("Version 3")
    await expect(save).toBeEnabled()
    await expect(save).toBeFocused()
    expect(posts).toHaveLength(2)
    await openRecord(page, first, id)
    await expect(firstDetail.getByRole("heading", { name: "First actor's saved title", exact: true })).toBeVisible()
    await expect(firstSection.getByRole("textbox", { name: "Description", exact: true })).toHaveValue("Second actor's unsent scope")
  } finally {
    releaseStale?.()
    await secondContext.close()
  }
})

test("a stale approval preserves the typed comment and refuses to revive an action after cancellation", async ({ page, browser }, info) => {
  const second = await login(page, "second", "comment")
  const id = await createDraft(page, second, "Approval comment conflict")
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  await detail.getByRole("button", { name: "Submit requisition", exact: true }).click()
  const submitted = responseFor(page, "submit_pr", id)
  await detail.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm action", exact: true }).click()
  expect((await submitted).status()).toBe(200)
  await expect(detail.locator("[data-request-summary]")).toContainText("Requisition approval")
  const holderContext = await browser.newContext()
  let releaseApproval: (() => void) | undefined
  try {
    const holderPage = await holderContext.newPage()
    const first = await login(holderPage, "first", "comment")
    const encoded = encodeSfRouteRef(id)
    await holderPage.goto(new URL(`/orchestra/sf-procurement/approvals/${encoded}`, first.baseURL).href)
    await expect(holderPage).toHaveURL((url) => url.pathname === `/orchestra/sf-procurement/approvals/${encoded}`)
    const approval = holderPage.locator('[data-sf-cap26="submitted-pr"]')
    const opener = approval.getByRole("button", { name: "Review decision", exact: true })
    await expect(opener).toBeEnabled()
    await opener.click()
    const comment = approval.getByRole("textbox", { name: "Approval comment (optional)", exact: true })
    await comment.fill("My approval rationale must remain unsent")
    const writes: string[] = []
    holderPage.on("request", (request) => {
      if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/procurement")) writes.push(request.postData() ?? "")
    })
    let observeApproval: ((payload: unknown) => void) | undefined
    const observed = new Promise<unknown>((resolve) => { observeApproval = resolve })
    const release = new Promise<void>((resolve) => { releaseApproval = resolve })
    let held = false
    await holderPage.route((url) => url.pathname.endsWith("/procurement"), async (route) => {
      const request = route.request()
      if (request.method() === "POST") {
        const payload = request.postDataJSON() as { action?: string; id?: string }
        if (!held && payload.action === "approve" && payload.id === id) {
          held = true
          observeApproval?.(payload)
          await release
        }
      }
      await route.continue()
    })
    const conflict = responseFor(holderPage, "approve", id)
    await approval.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Approve PR", exact: true }).press("Enter")
    expect(await observed).toMatchObject({ page: "My approvals", action: "approve", id, version: 2,
      values: { comment: "My approval rationale must remain unsent" } })

    await detail.getByRole("textbox", { name: "Cancellation reason", exact: true }).fill("Requester no longer needs this purchase")
    await detail.getByRole("button", { name: "Cancel request", exact: true }).click()
    const cancelled = responseFor(page, "cancel", id)
    await detail.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm action", exact: true }).click()
    const cancellation = await cancelled
    expect(cancellation.status()).toBe(200)
    expect(cancellation.request().postDataJSON()).toMatchObject({ page: "Requests", action: "cancel", id, version: 2,
      values: { reason: "Requester no longer needs this purchase" } })
    await expect(detail.locator("[data-request-summary]")).toContainText("Cancelled")
    releaseApproval?.()
    const rejected = await conflict
    expect(rejected.status()).toBe(409)
    expect(await rejected.json()).toMatchObject({ currentVersionCAS: 3, stored: { status: "cancelled" } })
    await expect(comment).toHaveValue("My approval rationale must remain unsent")
    const review = approval.getByRole("region", { name: "Review the changed record", exact: true })
    await expect(review.getByRole("heading", { name: "Review the changed record", exact: true })).toBeFocused()
    await expect(review.locator("[data-current-version-cas]")).toHaveText("Current version: 3.")
    await expect(opener).toBeDisabled()
    await opener.press("Enter")
    expect(writes).toHaveLength(1)
    await review.getByRole("button", { name: "Review current record", exact: true }).click()
    await expect(review.getByRole("status")).toHaveText("This action is no longer available for the current record. Your unsaved entries remain here; reopen the record to continue.")
    await expect(review.getByRole("button", { name: "Use reviewed version and keep my entries", exact: true })).toHaveCount(0)
    await expect(comment).toHaveValue("My approval rationale must remain unsent")
    await expect(comment).toHaveAttribute("readonly", "")
    await expect(approval.getByRole("button", { name: "Approve PR", exact: true })).toHaveCount(0)
    await expect(opener).toHaveCount(0)
    expect(writes).toHaveLength(1)
    await proof(holderPage, info, "approval-comment-preserved", { id, status: 409, currentVersionCAS: 3, postCount: writes.length, unavailableAction: "approve" })
    await openRecord(page, second, id)
    await expect(detail.locator("[data-request-summary]")).toContainText("Cancelled")
    await expect(detail.getByRole("button", { name: "Approve PR", exact: true })).toHaveCount(0)
  } finally {
    releaseApproval?.()
    await holderContext.close()
  }
})

test("a native save locks its pending entries and preserves later local edits without another POST", async ({ page, browser }, info) => {
  const first = await login(page, "first", "late-edit")
  const id = await createDraft(page, first, "Edits during save response")
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  const section = detail.locator('section[data-stage="pr"]')
  const description = section.getByRole("textbox", { name: "Description", exact: true })
  const save = section.getByRole("button", { name: "Save requisition draft", exact: true })
  const committed: { release?: () => void; signal?: (status: number) => void } = {}
  const observed = new Promise<number>((resolve) => { committed.signal = resolve })
  const release = new Promise<void>((resolve) => { committed.release = resolve })
  const writes: string[] = []
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname.endsWith("/procurement")) writes.push(request.postData() ?? "")
  })
  await page.route((url) => url.pathname.endsWith("/procurement"), async (route) => {
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
    await save.click()
    await detail.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm action", exact: true }).click()
    expect(await observed).toBe(200)
    // Native S03 forbids editing a pending operation; this is an observable
    // product fence, rather than a test writing into a disabled field.
    await expect(description).toBeDisabled()
    await expect(description).toHaveValue("The value sent to the real host")
    await expect(save).toBeDisabled()
    await expect(page.locator('[data-component="sf-requests-pr-po"]')).toHaveAttribute("aria-busy", "true")
    expect(writes).toHaveLength(1)
    committed.release?.()
    const response = await saved
    expect(response.status()).toBe(200)
    expect(response.request().postDataJSON()).toMatchObject({ page: "Requests", action: "save", id, version: 1,
      values: { pr: { description: "The value sent to the real host" } } })
    await expect(page.locator(".sf-u11-notice")).toContainText("The current source version was verified after saving.")
    await expect(section).toHaveAttribute("data-draft-version", "2")
    await expect(description).toBeEnabled()
    await description.fill("Later edits remain unsaved")
    await expect(description).toHaveValue("Later edits remain unsaved")
    await expect(section).toHaveAttribute("data-draft-dirty", "true")
    expect(writes).toHaveLength(1)
    const observer = await observerContext.newPage()
    const second = await login(observer, "second", "late-edit")
    const observedDetail = await openRecord(observer, second, id)
    await expect(observedDetail.locator('section[data-stage="pr"]').getByRole("textbox", { name: "Description", exact: true })).toHaveValue("The value sent to the real host")
    await expect(observedDetail.locator("p").filter({ hasText: /^Current source version:/ })).toHaveText("Current source version: 2")
    await expect(description).toHaveValue("Later edits remain unsaved")
    expect(writes).toHaveLength(1)
    await proof(page, info, "later-edits-preserved", { id, status: 200, pendingInputDisabled: true,
      committedValue: "The value sent to the real host", unsavedValue: "Later edits remain unsaved", postCount: writes.length })
  } finally { committed.release?.(); await observerContext.close() }
})

test("a recurring request reaches an internally issued PO with source values and negotiated entries preserved", async ({ page }, info) => {
  const account = await login(page, "first", "journey")
  const manifest = await readManifest()
  const id = await createDraft(page, account, "Recurring source-to-order browser journey")
  const encoded = encodeSfRouteRef(id)
  const detail = page.locator(`article[data-sf-request-ref="${id}"]`)
  const pr = detail.locator('section[data-stage="pr"]')
  const savePr = pr.getByRole("button", { name: "Save requisition draft", exact: true })
  await pr.getByRole("checkbox", { name: "Recurring", exact: true }).check()
  await pr.getByRole("textbox", { name: "Frequency", exact: true }).fill("Monthly")
  await pr.getByRole("spinbutton", { name: "Estimated annual", exact: true }).fill("1200")
  await requestAction(page, account, id, detail, savePr, "save")
  await pr.getByRole("checkbox", { name: "Recurring", exact: true }).uncheck()
  await requestAction(page, account, id, detail, savePr, "save")
  await expect(pr.getByRole("textbox", { name: "Frequency", exact: true })).toHaveValue("Monthly")
  await expect(pr.getByRole("spinbutton", { name: "Estimated annual", exact: true })).toHaveValue("1200")
  await pr.getByRole("checkbox", { name: "Recurring", exact: true }).check()
  await pr.getByRole("textbox", { name: "Expense type", exact: true }).fill("OPEX")
  await requestAction(page, account, id, detail, pr.getByRole("button", { name: "Submit requisition", exact: true }), "submit_pr")
  await expect(detail.locator("[data-request-summary]")).toContainText("Requisition approval")
  const submittedPrVersion = Number(await detail.getAttribute("data-source-version"))
  await approveRequest(page, account, id)
  await openRecord(page, account, id)
  await expect(detail).toHaveAttribute("data-source-version", String(submittedPrVersion + 1))

  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing`)
  const source = page.locator("header.sf-u12-heading")
  const sourcing = page.locator("section.sf-u12-editor")
  await sourcing.getByRole("textbox", { name: "Evaluator", exact: true }).fill("Browser sourcing evaluator")
  await sourcing.getByRole("textbox", { name: "Fewer quotations justification", exact: true }).fill("One qualified proposal is recorded; this does not establish a complete competition")
  await sourcing.getByRole("textbox", { name: "Selection justification", exact: true }).fill("Recorded service continuity decision")
  await sourcing.getByRole("textbox", { name: "Contract strategy", exact: true }).fill("existing")
  if (await sourcing.locator("fieldset.sf-u12-quote").count() === 0)
    await sourcing.getByRole("button", { name: "Add quotation", exact: true }).click()
  const quote = sourcing.locator("fieldset.sf-u12-quote").first()
  await quote.getByRole("textbox", { name: "Supplier", exact: true }).fill("Journey registered supplier")
  await quote.getByRole("combobox", { name: "Registered supplier", exact: true }).selectOption(manifest.records.supplier)
  await quote.getByRole("textbox", { name: "Currency", exact: true }).fill("EUR")
  await quote.getByRole("spinbutton", { name: "Stated total", exact: true }).fill("100")
  await quote.getByRole("spinbutton", { name: "Quantity", exact: true }).fill("2")
  await quote.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("50")
  const technical = quote.locator("section").filter({ has: page.getByRole("heading", { name: "Technical scores", exact: true }) }).getByRole("spinbutton")
  const commercial = quote.locator("section").filter({ has: page.getByRole("heading", { name: "Commercial scores", exact: true }) }).getByRole("spinbutton")
  await expect(technical).toHaveCount(5)
  await expect(commercial).toHaveCount(3)
  for (const index of [0, 1, 2, 3, 4]) await technical.nth(index).fill("5")
  await expect(commercial.nth(0)).toBeDisabled()
  for (const index of [1, 2]) await commercial.nth(index).fill("4")
  await requestAction(page, account, id, source, sourcing.getByRole("button", { name: "Save sourcing", exact: true }), "save", "Confirm once")
  await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
  const comparison = page.locator("section.sf-u12-comparison")
  const selection = comparison.getByRole("combobox", { name: "Selected quotation", exact: true })
  await selection.selectOption({ label: "Journey registered supplier · EUR 100" })
  const quoteId = await selection.inputValue()
  expect(quoteId).not.toBe("")
  const selected = await requestAction(page, account, id, source, comparison.getByRole("button", { name: "Select winning quote", exact: true }), "select_quote", "Confirm once")
  expect(selected.request().postDataJSON().values).toEqual({ quoteId })
  const preview = page.locator("section").filter({ has: page.getByRole("button", { name: "Submit purchase order", exact: true }) })
  await expect(preview).toHaveCount(1)
  await expect(preview.getByRole("textbox", { name: "Registered supplier", exact: true })).toHaveValue(manifest.records.supplier)
  await expect(preview.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(preview.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  for (const strategy of ["new", "existing"]) {
    await page.getByRole("button", { name: "Sourcing", exact: true }).click()
    await sourcing.getByRole("textbox", { name: "Contract strategy", exact: true }).fill(strategy)
    await requestAction(page, account, id, source, sourcing.getByRole("button", { name: "Save sourcing", exact: true }), "save", "Confirm once")
    await expect(sourcing.getByRole("textbox", { name: "Selection justification", exact: true })).toHaveValue("Recorded service continuity decision")
    await expect(quote.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
    await expect(preview.getByRole("textbox", { name: "Registered supplier", exact: true })).toHaveValue(manifest.records.supplier)
    await page.getByRole("button", { name: "Compare quotations", exact: true }).click()
    await expect(selection).toHaveValue(quoteId)
  }
  await page.getByRole("button", { name: "Sourcing", exact: true }).click()
  await requestAction(page, account, id, source, sourcing.getByRole("button", { name: "Submit sourcing", exact: true }), "submit_sourcing", "Confirm once")
  await expect(source.locator("[data-request-summary]")).toContainText("Sourcing approval")
  const submittedSourcingVersion = Number(await source.getAttribute("data-source-version"))
  await page.goto(`/orchestra/sf-procurement/approvals/${encoded}/review`)
  const sourcingDecision = page.locator("section.sf-u13-remaining-detail")
  await sourcingDecision.getByRole("button", { name: "Approve current step", exact: true }).click()
  let decision = responseFor(page, "approve", id)
  await page.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm once", exact: true }).click()
  const sourcingApproved = await decision
  expect(sourcingApproved.status()).toBe(200)
  expect(sourcingApproved.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, version: submittedSourcingVersion })
  await expect(page.locator(".sf-u13-remaining-root")).toContainText("The producer acknowledged the command. No receipt was returned.")
  await openRecord(page, account, id)
  await expect(detail).toHaveAttribute("data-source-version", String(submittedSourcingVersion + 1))
  await expect(detail.locator("[data-request-summary]")).toContainText("Purchase order draft")

  const po = detail.locator('section[data-stage="po"]')
  const poFields = po.locator("fieldset[data-sf-po-fields]")
  const line = poFields.locator("fieldset[data-sf-line-ref]").first()
  await poFields.getByRole("textbox", { name: "Description", exact: true }).fill("Negotiated delivery scope")
  await poFields.getByRole("textbox", { name: "Payment terms", exact: true }).fill("Net 60 negotiated")
  await poFields.getByLabel("Delivery date", { exact: true }).fill("2026-12-20")
  await poFields.getByRole("textbox", { name: "Delivery conditions", exact: true }).fill("Inspection and acceptance on delivery")
  await poFields.getByRole("textbox", { name: "Billing address", exact: true }).fill("Negotiated invoice address")
  await line.getByRole("spinbutton", { name: "Unit price", exact: true }).fill("48")
  await po.getByRole("button", { name: "Submit purchase order", exact: true }).click()
  const missingReference = responseFor(page, "submit_po", id)
  await detail.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm action", exact: true }).click()
  const invalid = await missingReference
  expect(invalid.status()).toBe(422)
  expect((await invalid.json()).fieldErrors).toContainEqual({ field: "po.contractRef", message: "Contract reference is required (call-off under existing contract)" })
  const contract = poFields.getByRole("textbox", { name: "Contract reference", exact: true })
  await expect(contract).toBeFocused()
  await expect(contract).toHaveAccessibleName("Contract reference")
  await expect(contract).toHaveAccessibleDescription("Contract reference is required (call-off under existing contract)")
  await expect(poFields.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(line.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("48")
  await contract.fill("FRAME-2026-01")
  const savePo = po.getByRole("button", { name: "Save purchase order draft", exact: true })
  const saved = await requestAction(page, account, id, detail, savePo, "save")
  expect(await saved.json()).toMatchObject({ ok: true })
  const savedVersion = await detail.getAttribute("data-source-version")
  await openRecord(page, account, id)
  await expect(detail).toHaveAttribute("data-source-version", savedVersion!)
  await expect(poFields.getByRole("textbox", { name: "Supplier ID", exact: true })).toHaveValue(manifest.records.supplier)
  await expect(poFields.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(contract).toHaveValue("FRAME-2026-01")
  await expect(poFields.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(line.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  await expect(line.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("48")
  const sources = po.getByRole("region", { name: "Purchase order field sources", exact: true })
  await expect(sources).toContainText("Net 45")
  await expect(sources).toContainText("Net 60 negotiated")
  await expect(sources).toContainText("Current authorized values; this comparison does not establish historical field provenance.")
  await poFields.getByRole("textbox", { name: "Notes", exact: true }).fill("A later edit must not reapply master defaults")
  await requestAction(page, account, id, detail, savePo, "save")
  await expect(poFields.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(poFields.getByRole("textbox", { name: "Billing address", exact: true })).toHaveValue("Negotiated invoice address")
  await expect(contract).toHaveValue("FRAME-2026-01")
  await expect(line.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  await requestAction(page, account, id, detail, po.getByRole("button", { name: "Submit purchase order", exact: true }), "submit_po")
  await expect(detail.locator("[data-request-summary]")).toContainText("Purchase order approval")
  const submittedPoVersion = Number(await detail.getAttribute("data-source-version"))
  await page.goto(`/orchestra/sf-procurement/approvals/${encoded}/review`)
  await page.locator("section.sf-u13-remaining-detail").getByRole("button", { name: "Approve current step", exact: true }).click()
  decision = responseFor(page, "approve", id)
  await page.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm once", exact: true }).click()
  const poApproved = await decision
  expect(poApproved.status()).toBe(200)
  expect(poApproved.request().postDataJSON()).toMatchObject({ page: "My approvals", action: "approve", id, version: submittedPoVersion })
  await expect(page.locator(".sf-u13-remaining-root")).toContainText("The producer acknowledged the command. No receipt was returned.")
  await openRecord(page, account, id)
  await expect(detail).toHaveAttribute("data-source-version", String(submittedPoVersion + 1))
  await expect(detail.locator("[data-request-summary]")).toContainText("Purchase order approved")
  const issued = await requestAction(page, account, id, detail, po.getByRole("button", { name: "Issue purchase order internally", exact: true }), "issue")
  expect(await issued.json()).toMatchObject({ ok: true })
  const issuedVersion = await detail.getAttribute("data-source-version")
  await openRecord(page, account, id)
  await expect(detail).toHaveAttribute("data-source-version", issuedVersion!)
  await expect(poFields.getByRole("textbox", { name: "Supplier ID", exact: true })).toHaveValue(manifest.records.supplier)
  await expect(poFields.getByRole("textbox", { name: "Currency", exact: true })).toHaveValue("EUR")
  await expect(poFields.getByRole("textbox", { name: "Payment terms", exact: true })).toHaveValue("Net 60 negotiated")
  await expect(contract).toHaveValue("FRAME-2026-01")
  await expect(line.getByRole("spinbutton", { name: "Quantity", exact: true })).toHaveValue("2")
  await expect(line.getByRole("spinbutton", { name: "Unit price", exact: true })).toHaveValue("48")
  await expect(contract).toBeDisabled()
  await expect(detail.locator("[data-request-summary]")).toContainText("Issued internally")
  await expect(detail.locator("[data-request-summary]")).toContainText("103.68 USD")
  await po.scrollIntoViewIfNeeded()
  await proof(page, info, "pr-sourcing-po-issued", { id, sourceSupplier: manifest.records.supplier, currency: "EUR", quantity: 2,
    negotiatedUnitPrice: 48, savedPaymentTerms: "Net 60 negotiated", issuedInternally: true })
})

test("the A B C comparison shows score components and retains submitted FX in the real detail and queue", async ({ page }, info) => {
  const account = await login(page, "first", "comparison")
  const manifest = await readManifest()
  const id = manifest.records.comparison
  const encoded = encodeSfRouteRef(id)
  await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
  const sourcing = page.locator("section.sf-u12-comparison")
  const comparison = sourcing.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Base amount / FX", exact: true }) })
  const row = (name: string) => comparison.getByRole("row").filter({ has: page.getByRole("cell", { name, exact: true }) })
  // Native columns separate currency and stated total; all ten original
  // financial/score/rank facts remain literal assertions.
  for (const expected of [
    ["Browser quote A", "Eligible", "USD", "32400", "32400 USD (base: 1)", "87.0", "93.3", "89.3", "87.9", "1"],
    ["Browser quote B", "Eligible", "EUR", "28000", "30240 USD (submitted FX: 1.08)", "77.0", "100.0", "97.0", "85.0", "2"],
    ["Browser quote C", "Not compliant", "USD", "29000", "29000 USD (base: 1)", "Unavailable", "Unavailable", "Unavailable", "Unavailable", "Unavailable"],
  ]) {
    const cells = row(expected[0]!).getByRole("cell")
    await expect(cells).toHaveCount(15)
    for (const [index, value] of expected.entries()) await expect(cells.nth(index)).toHaveText(value)
  }
  await expect(sourcing).toContainText("Rank 1: Browser quote A")
  await expect(sourcing).toContainText("2160 USD (7.14%) above the lowest eligible proposal")
  await expect(sourcing.locator("[data-sf-recorded-selection]")).toHaveText("Selected quotation: Browser quote A. Selection justification: Recorded technical preference")
  await comparison.scrollIntoViewIfNeeded()
  await proof(page, info, "abc-submitted-comparison", { id, selectedBaseAmount: 32400, euroOriginal: 28000, submittedFx: 1.08, euroBaseAmount: 30240, rank: ["A", "B"], excluded: ["C"] })
  const detail = await openRecord(page, account, id)
  await expect(detail.locator("[data-request-summary]")).toContainText("32400 USD")
  await page.goto("/orchestra/sf-procurement/requests")
  const queue = page.getByRole("table").filter({ has: page.getByRole("columnheader", { name: "Value basis", exact: true }) })
  const queueRow = queue.getByRole("row").filter({ has: page.getByRole("cell", { name: "Frozen browser sourcing comparison", exact: true }) })
  await expect(queueRow.getByRole("cell", { name: "32400 USD", exact: true })).toHaveCount(1)

  const originalRate = await setEurRate(page, account, "2")
  try {
    await page.goto(`/orchestra/sf-procurement/requests/${encoded}/sourcing/compare`)
    await expect(row("Browser quote B").getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
    await expect(comparison).not.toContainText("56000 USD")
    await openRecord(page, account, id)
    await expect(detail.locator("[data-request-summary]")).toContainText("32400 USD")

    await page.goto("/orchestra/sf-procurement/requests")
    const filters = page.locator("fieldset.sf-procurement-queue-filters")
    const statusFilter = filters.getByRole("combobox", { name: "Status", exact: true })
    const stageFilter = filters.getByRole("combobox", { name: "Decision", exact: true })
    const search = filters.getByRole("searchbox", { name: "Search", exact: true })
    const statuses = await statusFilter.locator("option").evaluateAll((options) => options.map((option) => (option as HTMLOptionElement).value))
    const sourcingIndex = statuses.indexOf("src_pending")
    expect(sourcingIndex).toBeGreaterThan(0)
    await statusFilter.focus()
    await page.keyboard.press("Home")
    for (let index = 0; index < sourcingIndex; index++) await page.keyboard.press("ArrowDown")
    await expect(statusFilter).toHaveValue("src_pending")
    await page.keyboard.press("Tab")
    await expect(stageFilter).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(search).toBeFocused()
    await page.keyboard.press("ControlOrMeta+A")
    await page.keyboard.type("unmatched-wp04-request")
    await page.keyboard.press("Enter")
    await expect(queueRow).toHaveCount(0)
    await statusFilter.focus()
    await page.keyboard.press("Home")
    await expect(statusFilter).toHaveValue("")
    await expect(statusFilter.locator("option:checked")).toHaveText("All")
    await page.keyboard.press("Tab")
    await expect(stageFilter).toBeFocused()
    await page.keyboard.press("Tab")
    await expect(search).toBeFocused()
    await page.keyboard.press("ControlOrMeta+A")
    await page.keyboard.type(id)
    await page.keyboard.press("Enter")
    await expect(queueRow.getByRole("cell", { name: "32400 USD", exact: true })).toHaveCount(1)
    await expect(search).toHaveValue(id)
    await proof(page, info, "queue-keyboard-filter-restored", { id, filter: "All", search: id,
      interaction: "Native immediate filters: Home, ArrowDown to source status, Tab, Tab, text, Enter; Home, Tab, Tab, text, Enter",
      retainedBaseAmount: 32400 })
  } finally {
    await setEurRate(page, account, originalRate)
  }
})

test("an authorized bank change requires supplier revalidation and a real viewer cannot read or update bank details", async ({ page, browser }, info) => {
  const first = await login(page, "first", "suppliers")
  const manifest = await readManifest()
  const id = manifest.records.supplier
  const route = `/orchestra/sf-procurement/suppliers/${encodeSfRouteRef(id)}`
  await page.goto(route)
  const supplier = page.locator(`[data-sf-supplier-ref="${id}"]`)
  await expect(supplier).toHaveCount(1)
  const supplierRow = page.locator(`tr[data-sf-row="${id}"]`)
  await expect(supplierRow).toHaveCount(1)
  await expect(supplierRow).toHaveAttribute("aria-selected", "true")
  await expect(supplierRow).toContainText("Journey registered supplier")
  await expect(supplierRow).toContainText("active")
  const supplierNumber = (await supplierRow.getByRole("cell").first().innerText()).trim()
  expect(supplierNumber).toMatch(/^SUP-\d+$/)
  const before = Number(await supplier.getAttribute("data-source-version"))
  expect(Number.isSafeInteger(before)).toBe(true)
  await supplier.getByRole("button", { name: "Review bank change", exact: true }).click()
  const editor = page.locator("section.sf-u14-editor")
  await editor.getByRole("textbox", { name: "IBAN", exact: true }).fill("TEST-REVISED-IBAN")
  await editor.getByRole("button", { name: "Review bank change", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await expect(review).not.toContainText("TEST-REVISED-IBAN")
  await expect(review).not.toContainText("TEST-ORIGINAL-IBAN")
  const changed = responseFor(page, "change-bank", id)
  await review.getByRole("button", { name: "Confirm once", exact: true }).click()
  const response = await changed
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON()).toMatchObject({ page: "Suppliers", action: "change-bank", id, version: before,
    values: { supplier: { iban: "TEST-REVISED-IBAN" } } })
  const result = await response.json()
  expect(result).toMatchObject({ ok: true })
  expect(JSON.stringify(result)).not.toContain("TEST-REVISED-IBAN")
  expect(JSON.stringify(result)).not.toContain("TEST-ORIGINAL-IBAN")
  await expect(supplier).toHaveAttribute("data-source-version", String(before + 1))
  const bank = supplier.locator("fieldset.sf-u14-bank-values")
  await expect(supplier).toContainText("Bank details changed after activation; validation must be repeated.")
  await expect(bank.getByRole("textbox", { name: "IBAN", exact: true })).toHaveValue("TEST-REVISED-IBAN")
  await supplier.getByText("Bank details changed after activation; validation must be repeated.", { exact: true }).scrollIntoViewIfNeeded()
  await proof(page, info, "supplier-bank-revalidation", { supplier: id, result: "pending", validationCleared: true, actorRole: "admin" }, [bank])

  const viewerContext = await browser.newContext()
  try {
    const observer = await viewerContext.newPage()
    const viewer = await login(observer, "viewer", "suppliers")
    const sourcePath = SfOperationRegistry["domain.page.CAP27"].pathTemplate.replace("{mount}", new URL(viewer.baseURL).pathname)
    const projection = observer.waitForResponse((response) => response.request().method() === "GET" &&
      new URL(response.url()).pathname === sourcePath)
    const read = await observer.goto(new URL(route, viewer.origin).href)
    expect(read?.status()).toBe(200)
    const source = await projection
    expect(source.status()).toBe(200)
    const projected = await source.json()
    expect(projected).toMatchObject({ status: "ok", value: { capabilityId: "CAP27" } })
    const projectedSupplier = projected.value.data.suppliers.find((item: { id?: string }) => item.id === id)
    expect(projectedSupplier).toMatchObject({ id, number: supplierNumber, status: "pending", validatedBy: null, validatedAt: null })
    for (const field of ["iban", "account", "bankName", "swift", "accountHolder", "bankCountry"])
      expect(projectedSupplier).not.toHaveProperty(field)
    const visible = observer.locator(`[data-sf-supplier-ref="${id}"]`)
    await expect(observer.locator(`tr[data-sf-row="${id}"]`).getByRole("cell").first()).toHaveText(supplierNumber)
    expect(await supplierValidation(observer, viewer, supplierNumber)).toEqual({ number: supplierNumber, status: "pending", validatedBy: "", validatedAt: "" })
    await expect(visible).toContainText("Bank details are masked for this role.")
    await expect(visible.locator('[name="iban"], [name="account"], [name="bankName"], [name="swift"]')).toHaveCount(0)
    await expect(visible.getByRole("button", { name: "Review bank change", exact: true })).toHaveCount(0)
    expect(JSON.stringify(projected)).not.toContain("TEST-REVISED-IBAN")
    expect(JSON.stringify(projected)).not.toContain("TEST-ORIGINAL-ACCOUNT")
    const denied = await observer.request.post(viewer.baseURL + "/procurement?page=Suppliers", { headers: { origin: manifest.origin, "sec-fetch-site": "same-origin" },
      data: { page: "Suppliers", action: "change-bank", id, version: before + 1, values: { supplier: { iban: "FORGED-VIEWER-CHANGE" } } } })
    expect(denied.status()).toBe(403)
    expect(await denied.text()).not.toContain("TEST-REVISED-IBAN")
    await proof(observer, info, "supplier-viewer-redaction", { supplier: id, bankControls: 0, unauthorizedWrite: 403, syntheticPolicy: "viewer-only" })
    await page.reload()
    await expect(bank.getByRole("textbox", { name: "IBAN", exact: true })).toHaveValue("TEST-REVISED-IBAN")
    await supplier.getByRole("button", { name: "Activate", exact: true }).click()
    const reactivated = responseFor(page, "activate", id)
    await review.getByRole("button", { name: "Confirm once", exact: true }).click()
    const confirmed = await reactivated
    expect(confirmed.status()).toBe(200)
    expect(confirmed.request().postDataJSON()).toMatchObject({ page: "Suppliers", action: "activate", id, version: before + 1 })
    expect(await confirmed.json()).toMatchObject({ ok: true })
    await expect(supplier).toHaveAttribute("data-source-version", String(before + 2))
    await expect(supplier).not.toContainText("Bank details changed after activation; validation must be repeated.")
    await expect(supplierRow).toContainText("active")
    await observer.reload()
    expect(await supplierValidation(observer, viewer, supplierNumber)).toEqual({ number: supplierNumber, status: "active", validatedBy: first.principal, validatedAt: "2026-11-13T12:00:00Z" })
    await expect(visible).toContainText("Bank details are masked for this role.")
    await expect(visible.locator('[name="iban"], [name="account"]')).toHaveCount(0)
    await proof(observer, info, "supplier-reactivated-masked", { supplier: id, result: "active", revalidatedBy: first.principal, bankControls: 0 })
  } finally { await viewerContext.close() }
})

test("settings reject invalid currencies with visible feedback and reset restores defaults without changing a submitted request", async ({ page }, info) => {
  const account = await login(page, "first", "settings")
  const manifest = await readManifest()
  const comparison = await openRecord(page, account, manifest.records.comparison)
  const unchanged = await comparison.locator("[data-request-summary]").textContent()
  await page.goto("/orchestra/sf-procurement/settings")
  const settings = page.locator("form.sf-n21-settings-form")
  await expect(settings).toHaveCount(1)
  const version = Number(await settings.getAttribute("data-version"))
  expect(Number.isSafeInteger(version)).toBe(true)
  const rate = settings.locator("#sf-u36-fx-rate-1")
  const address = settings.getByRole("textbox", { name: "Default invoice-to address", exact: true })
  await expect(settings.locator("#sf-u36-fx-code-1")).toHaveValue("EUR")
  await rate.fill("0")
  await address.fill("Preserved unsent settings address")
  const rejected = responseFor(page, "save")
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  const review = page.locator('[data-component="sf-change-review"]')
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const invalid = await rejected
  expect(invalid.status()).toBe(422)
  expect(invalid.request().postDataJSON()).toMatchObject({ page: "Settings", action: "save", version,
    values: { settings: { billingAddress: "Preserved unsent settings address" } } })
  await expect(page.locator(".sf-n21-settings-error")).toHaveText("Invalid matrix or currencies")
  await expect(settings).toHaveAttribute("data-version", String(version))
  await expect(rate).toHaveValue("0")
  await expect(address).toHaveValue("Preserved unsent settings address")
  await expect(rate).toBeEnabled()
  await rate.fill("1.2")
  const accepted = responseFor(page, "save")
  await settings.getByRole("button", { name: "Review changes", exact: true }).click()
  await review.getByRole("button", { name: "Save", exact: true }).click()
  const saved = await accepted
  expect(saved.status()).toBe(200)
  expect(saved.request().postDataJSON()).toMatchObject({ page: "Settings", action: "save", version })
  await expect(settings).toHaveAttribute("data-version", String(version + 1))
  await expect(page.locator(".sf-n21-settings-notice")).toHaveText("Changes saved.")
  await expect(address).toHaveValue("Preserved unsent settings address")
  const reset = settings.getByRole("button", { name: "Reset settings", exact: true })
  await expect(reset).toBeFocused()
  await page.keyboard.press("Enter")
  await expect(review).toHaveCount(1)
  await expect(review).toContainText("Requests, suppliers, issued identifiers and submitted approval/FX snapshots remain preserved")
  await expect(review).toContainText("The producer does not publish default values before reset. Review the authorized result after confirmation.")
  const confirmReset = review.getByRole("button", { name: "Reset settings", exact: true })
  await confirmReset.focus()
  await expect(confirmReset).toBeFocused()
  const restored = responseFor(page, "reset")
  await page.keyboard.press("Space")
  const result = await restored
  expect(result.status()).toBe(200)
  expect(result.request().postDataJSON()).toEqual({ page: "Settings", action: "reset", version: version + 1, values: {} })
  await expect(settings).toHaveAttribute("data-version", String(version + 2))
  await expect(rate).toHaveValue("1.08")
  await expect(settings.getByRole("spinbutton", { name: "Minimum quotations", exact: true })).toHaveValue("3")
  await expect(address).toHaveValue("")
  await expect(page.locator(".sf-n21-settings-notice")).toHaveText("Changes saved.")
  await openRecord(page, account, manifest.records.comparison)
  await expect(comparison.locator("[data-request-summary]")).toHaveText(unchanged!)
  await page.goto(`/orchestra/sf-procurement/requests/${encodeSfRouteRef(manifest.records.comparison)}/sourcing/compare`)
  await expect(page.locator("section.sf-u12-comparison").getByRole("cell", { name: "30240 USD (submitted FX: 1.08)", exact: true })).toHaveCount(1)
  await proof(page, info, "settings-reset-preserves-submitted-source", { invalidSave: 422, validSave: 200, reset: 200,
    resetInteraction: "Native reset control Enter, review confirmation Space", defaultsSource: "authorized read after original reset",
    retainedRequest: manifest.records.comparison, submittedEuroFx: 1.08 })
})
