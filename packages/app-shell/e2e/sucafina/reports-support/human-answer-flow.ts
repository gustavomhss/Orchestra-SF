import { expect } from "@playwright/test"
import type { Page, TestInfo } from "@playwright/test"
import type { PreservedReview } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import { object, projection, text } from "./model.ts"
import type { ReportsInstallation } from "./production-installation.ts"
import type { ReportsCorpus } from "./corpus.ts"
import { confirmReviewAnswer, createReviewQuestion, prepareReviewAnswer, replyReviewQuestion, reportsCollaboration } from "./confirmation.ts"
import type { ReviewBasis, ReviewPin } from "./confirmation.ts"
import { expectCapturedBudget } from "./review-flow.ts"

/** Exercises the human HTTP boundary with the real operator cookie, alongside
 * the real preserved meeting. It does not claim a C05 confirmation button exists.
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
  const question = await createReviewQuestion(api, {
    pin, basis, principalRef: app.actorId, key: `reports-question:${saved.id}`,
    question: `Confirm the preserved ${corpus.year} forecast of ${corpus.before}; distinguish it from the current source.`,
  })
  const message = await replyReviewQuestion(api, question, {
    principalRef: app.actorId, key: `reports-reply:${question.id}`,
    body: `Human answer: this review retains ${corpus.before} for ${corpus.annual.start} through ${corpus.annual.end}. REPORTS_HUMAN_ORIGINAL`,
  })
  const answer = await prepareReviewAnswer(api, question, message)
  expect(answer.projection).toEqual(captured)
  expect(projection(answer.projection).values.filter((value) => value.id === corpus.forecastField))
    .toMatchObject([{ value: corpus.before, period: corpus.annual, currency: "unspecified" }])
  await expectCapturedBudget(page, corpus)
  // Confirm exactly the observation just inspected. No re-prepare or mutation retry.
  const confirmed = await confirmReviewAnswer(api, answer, `reports-confirm:${question.id}`)
  await info.attach("human-answer-confirmation", { body: JSON.stringify({
    questionId: question.id, messageId: message.id, incarnation: message.incarnation, version: message.version,
    reviewContext: pin, basis, answerRef: answer.answerRef, receipt: confirmed.receipt,
    route: "real authenticated collaboration HTTP", uiConfirmationButton: "NOT_PROVEN", separateRecipientAuthority: "NOT_PROVEN",
  }, null, 2), contentType: "application/json" })
  return { api, answer }
}
