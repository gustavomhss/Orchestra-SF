/**
 * Mission 237 — real installed, originally authenticated SF browser journeys.
 * Mandatory F04 0600 manifest / host-owned CDP; no browser, user or grant is
 * created here. CI successor 232 selects only after C composition and readiness.
 */
import { expect, type Locator, type Page, type Request } from "@playwright/test"
import { nativeInstalledFixture as test, type InstalledNativeHarness } from "../fixture"
import { nativeOwnerQuery, type NativeTarget } from "../fixture/manifest-contract.ts"

function ui33Href(target: NativeTarget) {
  const url = new URL("/orchestra/sf-decisions", target.shellOrigin)
  url.search = nativeOwnerQuery(target).toString()
  return url.href
}
async function openEditor(page: Page, nativeHarness: InstalledNativeHarness) {
  const target = nativeHarness.manifest.target
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  const href = ui33Href(target)
  await page.goto(href)
  await expect(page.locator("[data-sf-teams-shell]")).toHaveAttribute("data-sf-team-selected", target.teamObjectId)
  await page.getByRole("button", { name: /New case|Novo caso/ }).click()
  await expect(page.getByRole("heading", { name: /Create a decision|Criar uma decisão/ })).toBeVisible()
  return { href, objective: page.getByRole("textbox", { name: /Decision objective|Objetivo da decisão/ }) }
}
const draft = "UI33 shell-guard237 unsent private draft"
const fields = (page: Page, objective: Locator) => [
  [objective, draft],
  [page.getByLabel(/^Start$|^Início$/), "2026-11-16"],
  [page.getByLabel(/^End$|^Fim$/), "2026-12-16"],
  [page.getByRole("textbox", { name: /Currency|Moeda/ }), "USD"],
  [page.getByRole("textbox", { name: /Criteria, one per line|Critérios/ }), "Original evidence only"],
] as const

async function fillOriginalFields(page: Page, objective: Locator) {
  for (const [field, value] of fields(page, objective)) await field.fill(value)
  await expect(objective).toHaveValue(draft)
}

function observeBusinessWrites(page: Page, target: NativeTarget) {
  const writes: Request[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method()) &&
        url.origin === target.publicOrigin && url.pathname.startsWith(target.mount + "/api/")) writes.push(request)
  })
  return writes
}

async function openDiscardDialog(page: Page, trigger: Locator) {
  await trigger.press("Enter")
  const dialog = page.locator("dialog.sf-team-dialog[open]")
  await expect(dialog).toBeVisible()
  return dialog
}

test("UI33 dirty sidebar exit: cancel retains URL, all fields and focus; accept purges and leaves @sf-237", async ({ page, nativeHarness }) => {
  const { href, objective } = await openEditor(page, nativeHarness)
  const target = nativeHarness.manifest.target
  const writes = observeBusinessWrites(page, target)
  await fillOriginalFields(page, objective)
  const trigger = page.locator(".sf-team-sidebar").getByRole("button", { name: /^(Context and access|Contexto e acesso)$/ })
  const dialog = await openDiscardDialog(page, trigger)
  await dialog.locator("button[autofocus]").click()
  await expect(dialog).toHaveCount(0)
  await expect(page).toHaveURL(href)
  await expect(trigger).toBeFocused()
  for (const [field, value] of fields(page, objective)) await expect(field).toHaveValue(value)

  await (await openDiscardDialog(page, trigger)).locator("[data-sf-confirm-discard]").click()
  const context = new URL("/orchestra/sf-home/context", target.shellOrigin)
  context.search = nativeOwnerQuery(target).toString()
  context.searchParams.delete("teamObjectId")
  await expect(page).toHaveURL(context.href)
  await expect(page.locator("[data-sf-team-context]")).toBeVisible()
  await expect(objective).toHaveCount(0)
  await page.goto(href)
  await page.getByRole("button", { name: /New case|Novo caso/ }).click()
  await expect(objective).toHaveValue("")
  expect(writes).toHaveLength(0)
})

test("UI33 dirty native chapter transition keeps canceled drafts and discards only with consent, without server mutation @sf-237", async ({ page, nativeHarness }) => {
  const { href, objective } = await openEditor(page, nativeHarness)
  const target = nativeHarness.manifest.target
  const writes = observeBusinessWrites(page, target)
  await fillOriginalFields(page, objective)
  const sidebar = page.locator(".sf-team-sidebar")
  const today = sidebar.getByRole("button", { name: /^(Today|Hoje)$/ })
  await (await openDiscardDialog(page, today)).locator("button[autofocus]").click()
  await expect(page).toHaveURL(href)
  for (const [field, value] of fields(page, objective)) await expect(field).toHaveValue(value)

  await (await openDiscardDialog(page, today)).locator("[data-sf-confirm-discard]").click()
  const next = new URL("/orchestra/sf-home", target.shellOrigin)
  next.search = nativeOwnerQuery(target).toString()
  await expect(page).toHaveURL(next.href)
  await expect(objective).toHaveCount(0)
  await sidebar.getByRole("button", { name: /^(Decisions|Decisões)$/ }).click()
  await expect(page).toHaveURL(href)
  await page.getByRole("button", { name: /New case|Novo caso/ }).click()
  await expect(objective).toHaveValue("")
  expect(writes).toHaveLength(0)
})

test("explicit wrong-project owner is never auto-admitted or populated from a dirty editor @sf-237", async ({ page, nativeHarness }) => {
  const { objective } = await openEditor(page, nativeHarness)
  await fillOriginalFields(page, objective)
  const rejected = ui33Href(nativeHarness.manifest.wrongTeam)
  // Full reload invokes the original browser's beforeunload guard; accept only
  // this explicit exit, then require the destination's independent real denial.
  page.once("dialog", (dialog) => dialog.accept())
  await page.goto(rejected)
  await expect(page.locator("#sf-team-content").getByRole("alert")
    .filter({ hasText: /^(This Team is not available for this account\.|Esta equipe não está disponível para esta conta\.)$/ })).toBeVisible()
  await expect(page).toHaveURL(rejected)
  await expect(page.locator('[data-sf-frame="page"]')).toHaveCount(0)
  await expect(objective).toHaveCount(0)
  await expect(page.getByText("UI33 shell-guard237 unsent private draft")).toHaveCount(0)
})
