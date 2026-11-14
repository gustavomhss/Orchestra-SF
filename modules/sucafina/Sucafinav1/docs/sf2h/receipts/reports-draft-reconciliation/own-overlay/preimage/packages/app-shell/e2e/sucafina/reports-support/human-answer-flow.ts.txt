import { expect } from "@playwright/test"
import type { Locator, Page, Response, TestInfo } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import { object, projection, responseFor, text } from "./model.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import type { ReportsCorpus } from "./corpus.ts"
import { expectConfirmedReviewAnswer, expectCreatedReviewQuestion, expectEditedReviewAnswer, expectPreparedReviewAnswer, expectRepliedReviewQuestion, reportsCollaboration } from "./confirmation.ts"
import type { ReportsCollaboration, ReviewAnswer, ReviewBasis, ReviewPin } from "./confirmation.ts"
import { expectCapturedBudget } from "./review-flow.ts"

/** The installed Review controls perform every human mutation. Direct HTTP
 * calls below only read back authority/state or probe negative boundaries.
 * The real local operator is the recipient; distinct-person authority is not
 * asserted without a genuinely admitted second identity.
 */
export async function confirmHumanAnswer(page: Page, app: ReportsInstallation, saved: PreservedReview, corpus: ReportsCorpus, info: TestInfo) {
  const sections = saved.sections.filter((section) => section.title === "Budget")
  expect(sections).toHaveLength(1)
  const section = sections[0]!
  const captured = projection(section.content)
  const values = captured.values.filter((value) => value.id === corpus.forecastField)
  expect(values).toHaveLength(1)
  expect(values[0]!.sourceRefs).toHaveLength(1)
  const source = values[0]!.sourceRefs[0]!
  if (source.kind !== "record") throw new Error("C05 human confirmation needs the actual selected record evidence")
  expect(source.target.period).toEqual(section.period)
  const basis: ReviewBasis = {
    sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version,
    period: section.period, evidenceRefs: values[0]!.sourceRefs,
  }
  const api = reportsCollaboration(page.request, app.dashboardURL)
  const issued = object(await api.ok("review-thread-context", { reviewRef: saved.id, sectionId: section.id, basis }))
  expect(issued).toMatchObject({ reviewRef: saved.id, reviewVersion: saved.version, sectionId: section.id })
  expect(issued.reviewDigest).toMatch(/^[a-f0-9]{64}$/)
  const pin: ReviewPin = { reviewRef: saved.id, reviewVersion: saved.version, sectionId: section.id, reviewDigest: text(issued.reviewDigest) }
  expect(issued).toEqual(pin)

  const discussion = page.getByRole("region", { name: "Review discussion", exact: true })
  await expect(discussion).toBeVisible()
  await discussion.getByLabel("Review section", { exact: true }).selectOption(section.id)
  await discussion.getByLabel("Review source", { exact: true }).selectOption(source.refId)
  await discussion.getByLabel("Recipient", { exact: true }).selectOption(app.actorId)
  const questionBody = `Confirm the preserved ${corpus.year} forecast of ${corpus.before}; distinguish it from the current source.`
  await discussion.getByRole("textbox", { name: "Question", exact: true }).fill(questionBody)
  const beforeQuestion = await api.version()
  const created = await submit(page, app, discussion.getByRole("button", { name: "Ask about this review", exact: true }), "collaboration-thread-create")
  expect(created.payload.draft).toEqual({
    kind: "clarification", ...basis, reviewContext: pin, recipientRef: app.actorId, body: questionBody,
  })
  expectMutation(created.payload.mutation, beforeQuestion)
  const question = await expectCreatedReviewQuestion(api, { pin, basis, principalRef: app.actorId, question: questionBody }, created.value)
  await expect(page).toHaveURL((url) => url.searchParams.get("reviewThread") === question.id)
  await expect(discussion.getByRole("status")).toHaveText("Question saved against the preserved review.")

  const replyBody = `Human answer: this review retains ${corpus.before} for ${corpus.annual.start} through ${corpus.annual.end}. REPORTS_HUMAN_ORIGINAL`
  await discussion.getByRole("textbox", { name: "Reply", exact: true }).fill(replyBody)
  const beforeReply = await api.version()
  const replied = await submit(page, app, discussion.getByRole("button", { name: "Send reply", exact: true }), "collaboration-thread-reply")
  expect(replied.payload).toMatchObject({ id: question.id, body: replyBody })
  expectMutation(replied.payload.mutation, beforeReply)
  const message = await expectRepliedReviewQuestion(api, question, { principalRef: app.actorId, body: replyBody }, replied.value)
  await expect(discussion.getByRole("status")).toHaveText("Reply saved. Review and confirm the exact answer before reusing it.")
  const article = discussion.getByRole("article", { name: `Message ${message.id}`, exact: true })
  await expect(article).toContainText(message.body)
  const prepared = await submit(page, app, article.getByRole("button", { name: "Review this answer", exact: true }), "collaboration-answer-prepare-message")
  expect(prepared.payload).toEqual({ questionId: question.id, messageId: message.id, incarnation: message.incarnation, version: message.version })
  const answer = expectPreparedReviewAnswer(question, message, prepared.value)
  expect(answer.projection).toEqual(captured)
  expect(projection(answer.projection).values.filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.before, period: corpus.annual, currency: "unspecified" }])
  await expectCapturedBudget(page, corpus)

  const confirmation = discussion.getByRole("region", { name: "Answer confirmation", exact: true })
  await expect(confirmation).toBeVisible()
  await expect(confirmation).toContainText(message.body)
  await confirmation.getByText("Inspect captured source details", { exact: true }).click()
  const shownProjection = confirmation.getByLabel("Observed source projection", { exact: true })
  const shownPin = confirmation.getByLabel("Review context", { exact: true })
  await expect(shownProjection).toBeVisible()
  await expect(shownPin).toBeVisible()
  expect(JSON.parse(text(await shownProjection.textContent()))).toEqual(captured)
  expect(JSON.parse(text(await shownPin.textContent()))).toEqual(pin)

  // The button submits exactly the displayed observation. No re-prepare or mutation retry.
  const beforeConfirmation = await api.version()
  const confirmed = await submit(page, app, confirmation.getByRole("button", { name: "Confirm this answer", exact: true }), "collaboration-answer-confirm")
  expect(confirmed.payload).toMatchObject({
    questionId: question.id, answerRef: answer.answerRef, mutation: {
      observationRef: answer.observationRef, observedSourceVersion: answer.observedSourceVersion,
      expectedScopeFingerprint: answer.expectedScopeFingerprint,
    },
  })
  expectMutation(confirmed.payload.mutation, beforeConfirmation)
  const receipt = await expectConfirmedReviewAnswer(api, answer, confirmed.value)
  await expect(discussion.getByRole("status")).toHaveText("Answer confirmed against the inspected preserved source.")
  await expectConfirmedAnswerVisible(page, answer)
  await info.attach("human-answer-confirmation", { body: JSON.stringify({
    questionId: question.id, messageId: message.id, incarnation: message.incarnation, version: message.version,
    reviewContext: pin, basis, answerRef: answer.answerRef, receipt: receipt.receipt,
    route: "installed Review controls and authenticated collaboration producers",
    uiConfirmationButton: "executed against the exact displayed server observation",
    recipientScope: "the legitimately enrolled local operator",
    separateRecipientAuthority: "NOT_PROVEN",
  }, null, 2), contentType: "application/json" })
  return { api, answer }
}

export async function expectConfirmedAnswerVisible(page: Page, answer: ReviewAnswer) {
  const confirmed = page.getByRole("region", { name: "Review discussion", exact: true })
    .getByRole("region", { name: "Confirmed answer", exact: true })
  await expect(confirmed).toBeVisible()
  await expect(confirmed).toContainText(answer.message.body)
  await expect(confirmed).toContainText(`Author ${answer.message.authorRef} · preserved source version ${answer.observedSourceVersion}`)
  await expect(page).toHaveURL((url) => url.searchParams.get("reviewThread") === answer.questionId)
}

export async function editHumanAnswer(page: Page, app: ReportsInstallation, api: ReportsCollaboration, answer: ReviewAnswer, body: string) {
  const discussion = page.getByRole("region", { name: "Review discussion", exact: true })
  const article = discussion.getByRole("article", { name: `Message ${answer.message.id}`, exact: true })
  await article.getByRole("textbox", { name: "Edited answer", exact: true }).fill(body)
  const beforeEdit = await api.version()
  const edited = await submit(page, app, article.getByRole("button", { name: "Save answer edit", exact: true }), "collaboration-thread-edit")
  expect(edited.payload).toMatchObject({
    id: answer.questionId, messageId: answer.message.id, expectedVersion: answer.message.version, body,
  })
  expectMutation(edited.payload.mutation, beforeEdit)
  const current = await expectEditedReviewAnswer(api, answer, { body }, edited.value)
  await expect(discussion.getByRole("status")).toHaveText("Answer edited. Its previous version remains protected history; review the new answer before confirming again.")
  await expect(article).toContainText(body)
  const unavailable = discussion.getByRole("region", { name: "Confirmed answer", exact: true })
  await expect(unavailable).toHaveText("No currently reusable confirmed answer.")
  await expect(unavailable.getByRole("heading")).toHaveCount(0)
  await expect(unavailable).not.toContainText(answer.message.body)
  const history = discussion.getByRole("region", { name: "Answer history", exact: true })
  const original = await submit(page, app, history.getByRole("button", { name: "Read original answer", exact: true }), "collaboration-thread-history")
  expect(original.payload).toEqual({
    id: answer.questionId, messageId: answer.message.id, incarnation: answer.message.incarnation, version: answer.message.version,
  })
  const historical = object(original.value)
  expect(historical).toMatchObject({ ...answer.basis, reviewContext: answer.pin })
  expect(historical.message).toMatchObject(answer.message)
  await expect(discussion.getByRole("status")).toHaveText("Original answer opened under current access.")
  await expect(history).toContainText(answer.message.body)
  await expect(article).toContainText(body)
  const url = new URL(page.url())
  expect(url.searchParams.get("reviewThread")).toBe(answer.questionId)
  expect(url.searchParams.get("reviewMessage")).toBe(answer.message.id)
  expect(url.searchParams.get("reviewIncarnation")).toBe(answer.message.incarnation)
  expect(url.searchParams.get("reviewVersion")).toBe(String(answer.message.version))
  expect(url.href).not.toContain(answer.message.body)
  expect(url.href).not.toContain(body)
  return current
}

async function submit(page: Page, app: ReportsInstallation, button: Locator, mode: string) {
  const pending = page.waitForResponse(responseFor(app.dashboardURL, mode, "POST"))
  await button.click()
  const response = await pending
  return observed(response, mode)
}

export async function observed(response: Response, mode: string) {
  expect(response.status(), mode).toBe(200)
  expect(response.headers()["cache-control"], mode).toContain("no-store")
  const body = object(await response.json())
  expect(body.status, mode).toBe("ok")
  const payload = object(response.request().postDataJSON())
  if (payload.mutation) expect(await response.request().headerValue("idempotency-key"), mode)
    .toBe(text(object(payload.mutation).idempotencyKey))
  return { payload, value: body.value }
}

function expectMutation(value: unknown, expectedStorageVersion: number) {
  const mutation = object(value)
  expect(mutation.expectedStorageVersion).toBe(expectedStorageVersion)
  text(mutation.idempotencyKey)
}
