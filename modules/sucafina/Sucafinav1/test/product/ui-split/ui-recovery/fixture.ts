import { expect } from "bun:test"
import type { Page } from "@playwright/test"
import { rows } from "../../../../runtime/contract.ts"
import { createRecoveryFixture, initialCaseRef, storeExistingChoice } from "../../wp02/workbench-recovery-fixture.ts"

export type RecoveryFixture = Awaited<ReturnType<typeof createRecoveryFixture>>

export async function openWorkbench(page: Page, fixture: RecoveryFixture) {
  await page.goto(`${fixture.origin}/sucafina/auth/local?code=${await fixture.identity.enroll()}`)
  await page.goto(`${fixture.origin}/sucafina/dashboard?page=Hot+Topics+%26+Actions`)
  await page.locator("[data-dashboard-workbench-panel] > summary").click()
  const panel = page.locator("[data-dashboard-workbench]")
  await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
  await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
  return panel
}

export async function editNewDraft(page: Page, action: string) {
  const panel = page.locator("[data-dashboard-workbench]")
  await panel.getByLabel(/^Caso/).selectOption({ label: "Review the action" })
  await panel.getByLabel(/^Rascunho/).selectOption("new")
  await panel.getByLabel(/^Hot Topic de origem/).selectOption({ label: "Original action" })
  await panel.getByLabel("Ação", { exact: true }).fill(action)
  await panel.getByLabel("Notas", { exact: true }).fill("Private recovery explanation")
}

export async function prepareApply(page: Page, fixture: RecoveryFixture, action: string) {
  const panel = await openWorkbench(page, fixture)
  await editNewDraft(page, action)
  await panel.getByRole("button", { name: "Salvar rascunho", exact: true }).click()
  await panel.getByText("Rascunho salvo.", { exact: false }).waitFor()
  const listed = await fixture.read((context) => fixture.decisions.drafts.list({ caseRef: initialCaseRef }, context))
  if (listed.status !== "ok" || listed.value.length !== 1) throw new Error("Expected one real draft")
  const draft = await fixture.read((context) => fixture.decisions.drafts.readCurrent({ caseRef: initialCaseRef, draftRef: listed.value[0]!.draftRef }, context))
  if (draft.status !== "ok") throw new Error("Expected authorized draft")
  await storeExistingChoice(fixture, draft.value)
  await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
  await panel.getByText("Opções carregadas.", { exact: false }).waitFor()
  await panel.getByLabel("Escolha existente para preparar").selectOption({ index: 1 })
  await panel.getByRole("button", { name: "Preparar escolha", exact: true }).click()
  await panel.getByText("Escolha preparada.", { exact: false }).waitFor()
  await panel.getByLabel(/^Alteração preparada/).selectOption({ index: 1 })
  await panel.getByRole("button", { name: "Revisar alterações", exact: true }).click()
  await panel.getByText("Confira os valores atuais e propostos.", { exact: false }).waitFor()
  await panel.getByLabel("Revisei os campos e confirmo estas alterações.").check()
  return panel
}

export async function reloadApply(page: Page) {
  page.once("dialog", (dialog) => void dialog.accept())
  await page.reload()
  await page.locator("[data-dashboard-workbench-panel] > summary").click()
  const panel = page.locator("[data-dashboard-workbench]")
  await panel.getByText("Há uma tentativa anterior para conferir.", { exact: false }).waitFor()
  expect(await panel.getByRole("button", { name: "Repetir mesma tentativa", exact: true }).isVisible()).toBe(false)
  await panel.getByRole("button", { name: "Carregar opções", exact: true }).click()
  await panel.getByText("Opções atualizadas com seu acesso atual.", { exact: false }).waitFor()
  expect(await panel.getByRole("button", { name: "Aplicar alterações", exact: true }).isDisabled()).toBe(true)
  expect(await panel.getByRole("button", { name: "Preparar escolha", exact: true }).isDisabled()).toBe(true)
  return panel
}

export async function observedApplication(fixture: RecoveryFixture) {
  const current = await fixture.authority.state.read(fixture.request(), "cases", (state) => state.cases[initialCaseRef.id])
  if (current.status !== "ok" || !current.value) throw new Error("Expected persisted case")
  const domain = await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
    value: { action: rows(snapshot.data.hotTopics)[0]!.action, version: snapshot.versions["hotTopics:topic"]?.version } }))
  return { decision: current.value, domain }
}
