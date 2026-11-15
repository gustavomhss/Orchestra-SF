import { expect, test } from "@playwright/test"

// N11/U44 — installed-only journeys. 120 chooses the exact integration runner,
// authorized owner, source evidence, and isolated mutable fixture. No route
// interceptions, mocked data, expected-failure assertions, or test-local backend.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })
const relationUrl = process.env.SF_NATIVE_E2E_RELATIONS_URL
const relationSource = process.env.SF_NATIVE_E2E_RELATION_SOURCE
const relationTarget = process.env.SF_NATIVE_E2E_RELATION_TARGET
const relationKind = process.env.SF_NATIVE_E2E_RELATION_KIND
const relationEvidence = process.env.SF_NATIVE_E2E_RELATION_EVIDENCE_JSON
const threadUrl = process.env.SF_NATIVE_E2E_THREAD_URL
const replyText = process.env.SF_NATIVE_E2E_THREAD_REPLY_TEXT
const confirmationUrl = process.env.SF_NATIVE_E2E_CONFIRMATION_URL
const materialScope = process.env.SF_NATIVE_E2E_CONFIRMATION_SCOPE_JSON

test("U44/UI51 — read only exact authorized relations and preserve source identity", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "A13 relation-read, current actor, full evidence and version; J06" })
  expect(relationUrl, "120: provide real authorized UI51 URL").toBeTruthy()
  expect(relationSource, "120: choose exact source ref, not its display name").toBeTruthy()
  await page.goto(relationUrl!)
  const pageBody = page.locator('[data-sf-surface="UI51"]')
  await expect(pageBody).toBeVisible()
  await pageBody.locator("[data-sf-relations-source]").fill(relationSource!)
  await pageBody.getByRole("button", { name: /Read relationships|Consultar relações/ }).click()
  await expect(pageBody.locator('[data-sf-component="relations"]')).toBeVisible()
  await expect(pageBody.locator('[data-sf-state="denied"]')).toHaveCount(0)
  await expect(pageBody.locator('[data-sf-state="session-expired"]')).toHaveCount(0)
})

test("U44/UI51 — explicit evidence and confirmation before writing relation", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "dependency", description: "120 must provide a disposable authorized fixture with two distinct source refs and real C17 evidence; this command changes only relation metadata" })
  for (const [name, value] of Object.entries({ relationUrl, relationSource, relationTarget, relationKind, relationEvidence })) {
    expect(value, "Missing isolated UI51 fixture: " + name).toBeTruthy()
  }
  await page.goto(relationUrl!)
  const view = page.locator('[data-sf-surface="UI51"]')
  await view.locator("[data-sf-relations-source]").fill(relationSource!)
  await view.getByRole("button", { name: /Read relationships|Consultar relações/ }).click()
  await expect(view.locator('[data-sf-component="relations"]')).toBeVisible()
  await view.locator("[data-sf-relations-target]").fill(relationTarget!)
  await view.locator("[data-sf-relations-kind]").fill(relationKind!)
  await view.locator("[data-sf-relations-evidence]").fill(relationEvidence!)
  await view.getByRole("button", { name: /Review relationship|Revisar relação/ }).click()
  await expect(view.locator("[data-sf-relation-review]")).toContainText(relationSource!)
  await expect(view.locator("[data-sf-relation-review]")).toContainText(relationTarget!)
  await view.locator("[data-sf-relations-confirm]").click()
  await expect(view.locator('[data-sf-component="relations"]')).toContainText(relationTarget!)
})

test("U44/UI52 — thread remains bound to real incarnation and source, with a single explicit reply", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "dependency", description: "120 must supply a disposable authorized, open thread; no test creates synthetic message, owner or source" })
  expect(threadUrl).toBeTruthy()
  expect(replyText).toBeTruthy()
  await page.goto(threadUrl!)
  const view = page.locator('[data-sf-surface="UI52"]')
  await expect(view).toBeVisible()
  const thread = view.locator('[data-sf-component="thread"]')
  await expect(thread).toBeVisible()
  await thread.getByRole("button", { name: /Open originating record|Abrir registro de origem/ }).click()
  await expect(view.locator("[data-sf-thread-origin]")).toBeVisible()
  const draft = thread.locator("textarea")
  await draft.fill(replyText!)
  await thread.getByRole("button", { name: /Post comment|Enviar comentário/ }).click()
  await expect(thread).toContainText(replyText!)
  await expect(view.locator('[data-sf-state="outcome-unknown"]')).toHaveCount(0)
})

test("U44/UI53 — prepare and confirm exact current material scope without altering domain data", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "dependency", description: "120 supplies existing C06-observable material scope and a disposable actor; selectionRef alone cannot authorize a confirmation" })
  expect(confirmationUrl).toBeTruthy()
  expect(materialScope).toBeTruthy()
  const scope: unknown = JSON.parse(materialScope!)
  expect(scope).toHaveProperty("sourceRef.incarnation")
  expect(scope).toHaveProperty("period.start")
  expect(scope).toHaveProperty("period.end")
  expect(scope).toHaveProperty("fields")
  expect(scope).toHaveProperty("materialDependencies")
  await page.goto(confirmationUrl!)
  const view = page.locator('[data-sf-surface="UI53"]')
  await expect(view).toBeVisible()
  await view.locator("[data-sf-confirm-scope]").fill(materialScope!)
  await view.getByRole("button", { name: /Prepare current material|Preparar material atual/ }).click()
  await expect(view.locator("[data-sf-confirm-material]")).toBeVisible()
  await view.locator('[data-sf-component="confirmation"]').getByRole("button",
    { name: /Confirm no change|Confirmar sem alteração/ }).click()
  const receipt = view.locator("[data-sf-confirm-receipt]")
  await expect(receipt).toBeVisible()
  await expect(receipt).toContainText(/(Original confirmation receipt|Recibo original da confirmação)/)
  await receipt.getByRole("button", { name: /Recheck current validity|Revalidar material atual/ }).click()
  await expect(view.locator('[data-sf-state="denied"]')).toHaveCount(0)
})
