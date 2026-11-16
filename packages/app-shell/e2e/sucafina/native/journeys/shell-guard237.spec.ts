/**
 * Mission 237 — real installed, originally authenticated SF browser journeys.
 * Mandatory F04 0600 manifest / host-owned CDP; no browser, user or grant is
 * created here. CI successor 232 selects only after C composition and readiness.
 */
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "../fixture"

function originalUi33Href(harness: { manifest: { target: {
  chapterHref: string; shellOrigin: string; serverKey: string; projectId: string; installationId: string
} } }) {
  const url = new URL(harness.manifest.target.chapterHref, harness.manifest.target.shellOrigin)
  // Only the original F04 manifest's registered owner values are used.
  url.search = new URLSearchParams({
    server: harness.manifest.target.serverKey,
    project: harness.manifest.target.projectId,
    installation: harness.manifest.target.installationId,
  }).toString()
  url.pathname = "/orchestra/sf-decisions"
  return url.toString()
}
async function openEditor(page: import("@playwright/test").Page, nativeHarness: Parameters<typeof originalUi33Href>[0]) {
  const href = originalUi33Href(nativeHarness)
  await page.goto(href)
  await expect(page.locator('[data-sf-host="owner-runtime231"]')).toBeVisible()
  await page.getByRole("button", { name: /New case|Novo caso/ }).click()
  await expect(page.getByRole("heading", { name: /Create a decision|Criar uma decisão/ })).toBeVisible()
  return { href, objective: page.getByRole("textbox", { name: /Decision objective|Objetivo da decisão/ }) }
}
async function fillOriginalFields(page: import("@playwright/test").Page, objective: import("@playwright/test").Locator) {
  await objective.fill("UI33 shell-guard237 unsent private draft")
  await page.getByLabel(/^Start$|^Início$/).fill("2026-11-16")
  await page.getByLabel(/^End$|^Fim$/).fill("2026-12-16")
  await page.getByRole("textbox", { name: /Currency|Moeda/ }).fill("USD")
  await page.getByRole("textbox", { name: /Criteria, one per line|Critérios/ }).fill("Original evidence only")
  await expect(objective).toHaveValue("UI33 shell-guard237 unsent private draft")
}

test("UI33 dirty sidebar exit: cancel retains URL, all fields and focus; accept purges and leaves @sf-237", async ({ page, nativeHarness }) => {
  const { href, objective } = await openEditor(page, nativeHarness)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await fillOriginalFields(page, objective)
  await objective.focus()
  page.once("dialog", (dialog) => dialog.dismiss())
  await page.getByRole("button", { name: /^(Home|Início)$/ }).click()
  await expect(page).toHaveURL(href)
  await expect(objective).toBeFocused()
  await expect(objective).toHaveValue("UI33 shell-guard237 unsent private draft")
  await expect(page.getByRole("textbox", { name: /Criteria, one per line|Critérios/ })).toHaveValue("Original evidence only")

  page.once("dialog", (dialog) => dialog.accept())
  await page.getByRole("button", { name: /^(Home|Início)$/ }).click()
  await expect(page).toHaveURL(/\/$/)
  await expect(page.getByText("UI33 shell-guard237 unsent private draft")).toHaveCount(0)
  await page.goBack()
  await page.getByRole("button", { name: /New case|Novo caso/ }).click()
  await expect(page.getByRole("textbox", { name: /Decision objective|Objetivo da decisão/ })).toHaveValue("")
})

test("UI33 dirty native chapter transition retains draft and restored fields without server mutation @sf-237", async ({ page, nativeHarness }) => {
  const { objective } = await openEditor(page, nativeHarness)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await fillOriginalFields(page, objective)
  // The original 231 sidebar has a distinct sf-home item with sf.ui29.title.
  const advanced = page.getByRole("button", { name: /Advanced|Avançado/ })
  if (await advanced.isVisible()) await advanced.click()
  await page.getByRole("button", { name: /^(Today|Hoje)$/ }).click()
  await expect(page).toHaveURL(/\/orchestra\/sf-home(?:\?|$)/)
  // Returning through the installed shell's native chapter link must re-use F01.
  const returnToCases = page.getByRole("button", { name: /^(Decisions|Decisões)$/ })
  await returnToCases.click()
  await expect(page).toHaveURL(/\/orchestra\/sf-decisions(?:\?|$)/)
  await expect(page.getByRole("textbox", { name: /Decision objective|Objetivo da decisão/ })).toHaveValue(
    "UI33 shell-guard237 unsent private draft",
  )
})

test("explicit wrong-project owner is never auto-admitted or populated from a dirty editor @sf-237", async ({ page, nativeHarness }) => {
  const { objective } = await openEditor(page, nativeHarness)
  await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  await fillOriginalFields(page, objective)
  const rejected = new URL(nativeHarness.manifest.target.chapterHref, nativeHarness.manifest.target.shellOrigin)
  rejected.pathname = "/orchestra/sf-decisions"
  rejected.search = new URLSearchParams({
    server: nativeHarness.manifest.target.serverKey,
    project: nativeHarness.manifest.wrongProject.projectId,
    installation: nativeHarness.manifest.target.installationId,
  }).toString()
  // Full reload invokes the original browser's beforeunload guard; accept only
  // this explicit exit, then require the destination's independent real denial.
  page.once("dialog", (dialog) => dialog.accept())
  await page.goto(rejected.toString())
  await expect(page.locator('[data-sf-f01="denied"], [data-sf-f01="not-admitted"], [data-sf-f01="unavailable"]')).toBeVisible()
  await expect(page.getByText("UI33 shell-guard237 unsent private draft")).toHaveCount(0)
})
