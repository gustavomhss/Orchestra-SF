import { expect } from "@playwright/test"
import type { Locator, Page, Response } from "@playwright/test"
import { officePackageText } from "../../reports-support/ooxml.ts"
import { nativeInstalledFixture as test, observeNativeBinding } from "../fixture.ts"
import type { NativeTarget } from "../fixture.ts"

test.describe.configure({ retries: 0, timeout: 180_000 })
test.use({ trace: "off", video: "off", screenshot: "off" })

test("native issuer preserves the agenda, reopens it for the same owner, and downloads real Office bytes", async ({ page, nativeHarness }) => {
  const target = nativeHarness.manifest.target
  const before = await observeNativeBinding(page, target)
  const source = before.destinations.find((entry) => entry.surface === "dashboard" && entry.canRead)
  if (!source) throw new Error("installed dashboard page required")

  await page.goto(chapterUrl(target, "/orchestra/sf-reviews/agenda"))
  const agenda = page.locator('[data-sf-surface="UI47"]')
  await expect(agenda).toBeVisible()
  await agenda.getByLabel(/Source dashboard page|Página de origem do dashboard/).fill(source.page)
  await agenda.getByRole("button", { name: /Find authorized sections|Buscar seções autorizadas/ }).click()
  const add = agenda.getByRole("button", { name: /Add to agenda|Adicionar à pauta/ })
  await expect(add.first()).toBeEnabled()
  await add.first().click()
  const selected = agenda.locator("[data-sf-agenda-order] > li")
  await expect(selected).toHaveCount(1)
  const sectionId = await selected.getAttribute("data-section-id")
  const title = (await selected.locator("strong").innerText()).trim()
  if (!sectionId || !title) throw new Error("agenda selection required")

  await page.getByRole("button", { name: /Review selected sections|Revisar seções selecionadas/ }).click()
  const preview = agenda.locator("[data-sf-agenda-preview]")
  await expect(preview).toBeVisible()
  await expect(preview.locator("strong")).toHaveText(title)
  const confirm = agenda.getByRole("button", { name: /Confirm preservation|Confirmar preservação/ })
  await expect(confirm).toBeEnabled()
  const preservedResponse = page.waitForResponse(producer("review-preserve", "POST"))
  await confirm.click()
  expect((await preservedResponse).status()).toBe(200)
  const confirmed = agenda.locator("[data-sf-preserved-confirmed]")
  await expect(confirmed).toBeVisible()
  const reviewRef = (await confirmed.locator("dd").first().innerText()).trim()
  expect(reviewRef.length).toBeGreaterThan(0)

  await page.goto(chapterUrl(target, "/orchestra/sf-reviews/reviews/" + encodeRef(reviewRef)))
  const review = page.locator('[data-sf-surface="UI48"]')
  await expect(review).toBeVisible()
  const article = review.locator(`[data-review-ref="${reviewRef}"]`)
  await expect(article).toBeVisible()
  const section = article.locator(`[data-section-id="${sectionId}"]`)
  await expect(section.locator("h3")).toHaveText(title)
  const comments = article.getByRole("region", { name: /Preserved questions and comments|Perguntas e comentários preservados/ })
  await expect(comments).toBeVisible()
  const recorded = await commentTexts(comments)
  const owner = (await observeNativeBinding(page, target)).stamp

  await page.reload()
  const reopened = await observeNativeBinding(page, target)
  expect(reopened.stamp.principalRef).toBe(owner.principalRef)
  expect(reopened.stamp.principalRef).toBe(before.stamp.principalRef)
  expect(reopened.stamp.installationId).toBe(owner.installationId)
  expect(reopened.stamp.projectId).toBe(owner.projectId)
  await expect(article).toHaveAttribute("data-review-ref", reviewRef)
  await expect(section.locator("h3")).toHaveText(title)
  expect(await commentTexts(comments)).toEqual(recorded)

  await page.goto(chapterUrl(target, "/orchestra/sf-reviews/reports/" + encodeRef(reviewRef)))
  const report = page.locator('[data-sf-surface="UI50"]')
  await expect(report).toBeVisible()
  await expect(report.locator("[data-preserved-review]")).toHaveAttribute("data-preserved-review", reviewRef)
  await expect(report.getByText(/The preserved content was re-read under the current owner\.|O conteúdo preservado foi relido sob o contexto atual\./)).toBeVisible()
  const row = report.locator(`[data-section-id="${sectionId}"]`)
  await expect(row.locator("input[type=checkbox]")).toBeChecked()
  await expect(row).toContainText(title)
  const reportComments = report.getByRole("region", { name: /Preserved notes and comments|Notas e comentários preservados/ })
  await expect(reportComments).toBeVisible()
  for (const text of recorded) await expect(reportComments).toContainText(text)

  const docx = await downloadOffice(page, report, "docx")
  const pptx = await downloadOffice(page, report, "pptx")
  expect(docx.sha256).not.toBe(pptx.sha256)
  for (const file of [docx, pptx]) {
    expect(file.text).toContain(reviewRef)
    expect(file.text).toContain(title)
    for (const text of recorded) expect(file.text).toContain(text.replace(/\s+/g, " ").trim())
  }
  const after = await observeNativeBinding(page, target)
  expect(after.stamp.principalRef).toBe(owner.principalRef)
})

function chapterUrl(target: NativeTarget, pathname: string) {
  const url = new URL(target.chapterHref, target.shellOrigin)
  url.pathname = pathname
  url.search = ""
  return url.toString()
}

function encodeRef(value: string) {
  return "r_" + Buffer.from(value, "utf8").toString("base64url")
}

function producer(mode: string, method: string) {
  return (response: Response) => {
    const url = new URL(response.url())
    return response.request().method() === method && url.searchParams.get("sf") === mode
  }
}

async function commentTexts(comments: Locator) {
  return (await comments.locator("li p").allTextContents()).map((text) => text.trim()).filter((text) => text.length > 0)
}

async function downloadOffice(page: Page, report: Locator, format: "docx" | "pptx") {
  const mime = format === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  await report.getByLabel(/Office format|Formato Office/).selectOption(format)
  const action = page.getByRole("button", { name: /Generate report|Gerar relatório/ })
  await expect(action).toBeEnabled()
  const responsePromise = page.waitForResponse(producer("review-download", "GET"))
  await action.click()
  const response = await responsePromise
  expect(response.status()).toBe(200)
  expect(response.headers()["content-type"]?.split(";")[0]?.trim().toLowerCase()).toBe(mime)
  const disposition = response.headers()["content-disposition"] ?? ""
  expect(disposition.toLowerCase()).toContain("attachment")
  expect(disposition.toLowerCase()).toContain("." + format)
  const artifact = new URL(response.url()).searchParams.get("artifactRef") ?? ""
  expect(artifact).toMatch(/^report:[a-f0-9]{64}$/)
  const bytes = Buffer.from(await response.body())
  await expect(action).toBeEnabled()
  await expect(report.locator("[data-sf-file-unavailable]")).toHaveCount(0)
  await expect(report.getByRole("alert")).toHaveCount(0)
  const text = officePackageText(bytes, format)
  const sha256 = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))
  return { text, sha256: [...sha256].map((byte) => byte.toString(16).padStart(2, "0")).join("") }
}
