import { expect, test } from "@playwright/test"

// N12/U38: the native SF installed harness provides the *real* owner, C12
// workbench, A10 topic producer, and scratch records. No fake DOM/API/auth.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })
const topicsUrl = process.env.SF_NATIVE_E2E_HOT_TOPICS_URL
const topicDetailUrl = process.env.SF_NATIVE_E2E_HOT_TOPIC_DETAIL_URL
const topicEditUrl = process.env.SF_NATIVE_E2E_HOT_TOPIC_EDIT_URL
const topicId = process.env.SF_NATIVE_E2E_HOT_TOPIC_ID
const proposalUrl = process.env.SF_NATIVE_E2E_HOT_TOPIC_PROPOSAL_URL

test("U38/CAP02 — authorized list, status filter and record identity", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "A10 domain.page.CAP02; real installed authority and statuses" })
  expect(topicsUrl, "120 must provide CAP02 URL in a real authorized Sucafina installation").toBeTruthy()
  await page.goto(topicsUrl!)
  const topics = page.locator('[data-sf-surface="CAP02"]')
  await expect(topics).toBeVisible()
  await expect(topics.locator('[data-sf-state="ready"], [data-sf-state="empty"]')).toBeVisible()
  await expect(topics.getByRole("heading", { name: /topics|tópicos/i })).toBeVisible()
  const filter = topics.getByLabel(/filter by status|filtrar por status/i)
  await filter.selectOption("blocked")
  await expect(topics.locator('[data-sf-state="ready"], [data-sf-state="filtered-empty"]')).toBeVisible()
  await expect(filter).toHaveValue("blocked")
  await filter.selectOption("")
  await expect(topics.locator('[data-sf-state="ready"], [data-sf-state="empty"]')).toBeVisible()
  await expect(filter).toHaveValue("")
})

test("U38/CAP02 — original topic detail and version are not synthesized", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "Current A10 source, exact record ref and CAS version, not another same-name record" })
  expect(topicDetailUrl, "120 must supply a real authorized CAP02 detail link").toBeTruthy()
  expect(topicId, "120 must supply the exact immutable topic id for this fixture").toBeTruthy()
  await page.goto(topicDetailUrl!)
  const topics = page.locator('[data-sf-surface="CAP02"]')
  await expect(topics).toBeVisible()
  await expect(topics.locator('[data-sf-state="ready"]')).toBeVisible()
  const detail = topics.locator('[data-sf-topic-detail]')
  await expect(detail).toBeVisible()
  await expect(detail.getByText(/record version|versão do registro/i)).toBeVisible()
  await expect(topics.locator('[data-sf-topic-editor]')).toHaveCount(0)
  // No record can be deleted merely by opening its detail.
  await expect(topics.locator('[data-delete-state="saved"]')).toHaveCount(0)
})

test("U38/CAP02 — edit remains draft until explicit review and save", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "qualification", description: "Uses an authorized scratch topic and A10 CAS; does not execute Save/Delete" })
  expect(topicEditUrl, "120 must supply a writable scratch topic in the installed native harness").toBeTruthy()
  await page.goto(topicEditUrl!)
  const topics = page.locator('[data-sf-surface="CAP02"]')
  await expect(topics.locator('[data-sf-state="ready"]')).toBeVisible()
  const editor = topics.locator('[data-sf-topic-editor]')
  await expect(editor).toBeVisible()
  await expect(editor.getByRole("textbox", { name: /action|ação/i })).toBeVisible()
  await expect(editor.getByRole("combobox", { name: /status|situação/i })).toBeVisible()
  await expect(editor.getByRole("combobox", { name: /priority|prioridade/i })).toBeVisible()
  await expect(editor.getByRole("button", { name: /review save|revisar salvamento/i })).toBeVisible()
  await expect(topics.locator('[data-topic-feedback="saved"]')).toHaveCount(0)
})

test("U38/UI54 — producer workbench proposal is separate from direct Hot Topic save", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "source", description: "C12 dashboard-workbench, prepared-change review digest, C12 apply and original receipt" })
  expect(proposalUrl, "120 must provide an authorized C12 proposal reference from source discovery").toBeTruthy()
  await page.goto(proposalUrl!)
  const proposal = page.locator('[data-sf-surface="UI54"]')
  await expect(proposal).toBeVisible()
  await expect(proposal.locator('[data-sf-state="ready"]')).toBeVisible()
  await expect(proposal.getByRole("heading", { name: /follow-up proposal|proposta de encaminhamento/i })).toBeVisible()
  await expect(proposal.getByText(/proposal reference|referência da proposta/i)).toBeVisible()
  await expect(proposal.locator('[data-sf-topic-editor]')).toHaveCount(0)
  // Visiting a proposal never executes apply/prepare, even with a real review.
  await expect(proposal.locator('[data-proposal-outcome="applied"]')).toHaveCount(0)
})

test("U38 — privacy states never present private record children", async ({ page }) => {
  test.setTimeout(120_000)
  expect(topicsUrl).toBeTruthy()
  await page.goto(topicsUrl!)
  const topics = page.locator('[data-sf-surface="CAP02"]')
  await expect(topics).toBeVisible()
  await expect(topics.locator('[data-sf-state="denied"] [data-sf-topic-detail]')).toHaveCount(0)
  await expect(topics.locator('[data-sf-state="session-expired"] [data-sf-topic-detail]')).toHaveCount(0)
})
