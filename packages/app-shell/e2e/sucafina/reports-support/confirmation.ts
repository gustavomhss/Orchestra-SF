import { expect } from "@playwright/test"
import type { APIRequestContext } from "@playwright/test"

type ObjectValue = Record<string, unknown>
export type ReviewPin = { reviewRef: string; reviewVersion: number; reviewDigest: string; sectionId: string }
export type ReviewBasis = {
  sourceRef: string
  sourceIncarnation: string
  observedVersion: number
  period: { start: string; end: string }
  evidenceRefs: readonly unknown[]
}
export type ReviewMessage = { id: string; incarnation: string; version: number; authorRef: string; body: string; createdAt: string; sourceContext: ObjectValue }
export type ReviewAnswer = {
  questionId: string
  message: ReviewMessage
  pin: ReviewPin
  basis: ReviewBasis
  answerRef: string
  observationRef: string
  observedSourceVersion: number
  expectedScopeFingerprint: string
  projection: ObjectValue
}

/** Uses the supplied authenticated application session and its existing mount.
 * No actor header, grant, replay, retry, route interception or alternate server.
 * The parent spec must establish real isolated installation/session state first.
 */
export function reportsCollaboration(request: APIRequestContext, mount: string) {
  const base = new URL(mount)
  const post = async (mode: string, payload: unknown, key?: string) => {
    const url = new URL(base)
    url.search = ""
    url.hash = ""
    url.searchParams.set("sf", mode)
    const response = await request.post(url.href, {
      data: payload,
      headers: { Origin: url.origin, "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) },
      failOnStatusCode: false,
      maxRedirects: 0,
    })
    const value: unknown = await response.json()
    expect(response.headers()["cache-control"], mode).toContain("no-store")
    return { httpStatus: response.status(), body: object(value) }
  }
  const ok = async (mode: string, payload: unknown, key?: string) => {
    const result = await post(mode, payload, key)
    expect(result.httpStatus, `${mode}: ${String(result.body.reason ?? result.body.status)}`).toBe(200)
    expect(result.body.status, mode).toBe("ok")
    return result.body.value
  }
  const version = async () => integer(await ok("collaboration-storage-version", { namespace: "threads" }), 0)
  const thread = async (id: string) => {
    const value = object(await ok("collaboration-thread-read", { id }))
    expect(value.id).toBe(id)
    expect(["open", "resolved"]).toContain(value.state)
    expect(Array.isArray(value.messages)).toBe(true)
    return value
  }
  return { post, ok, version, thread }
}

export type ReportsCollaboration = ReturnType<typeof reportsCollaboration>

/** C05 self-recipient scenario: proves the real human's own answer lifecycle.
 * A separate-person authority/lease proof is outside this scenario's claim.
 */
export async function createReviewQuestion(api: ReportsCollaboration, input: {
  pin: ReviewPin
  basis: ReviewBasis
  principalRef: string
  question: string
  key: string
}) {
  const pin = object(await api.ok("review-thread-context", {
    reviewRef: input.pin.reviewRef, sectionId: input.pin.sectionId, basis: input.basis,
  }))
  expect(pin).toEqual(input.pin)
  const mutation = { expectedStorageVersion: await api.version(), idempotencyKey: input.key }
  const draft = { kind: "clarification", ...input.basis, reviewContext: input.pin, recipientRef: input.principalRef, body: input.question }
  const created = object(await api.ok("collaboration-thread-create", { draft, mutation }, input.key))
  const id = text(created.id)
  expect(created).toMatchObject({ id, kind: "clarification", state: "open", recipientRef: input.principalRef, ...input.basis })
  const messages = array(created.messages).map(message)
  expect(messages).toHaveLength(1)
  expect(messages[0]).toMatchObject({ version: 1, authorRef: input.principalRef, body: input.question, sourceContext: { ...input.basis, reviewContext: input.pin } })
  const reopened = await api.thread(id)
  expect(reopened.messages).toEqual(created.messages)
  return { id, messages, pin: input.pin, basis: input.basis }
}

export async function replyReviewQuestion(api: ReportsCollaboration, question: Awaited<ReturnType<typeof createReviewQuestion>>, input: {
  principalRef: string
  body: string
  key: string
}) {
  const mutation = { expectedStorageVersion: await api.version(), idempotencyKey: input.key }
  const replied = object(await api.ok("collaboration-thread-reply", { id: question.id, body: input.body, mutation }, input.key))
  expect(replied.id).toBe(question.id)
  // The C05 HTTP adapter selects threads.reply and returns its committed snapshot.
  // A RecipientThread.current projection is deliberately not accepted as that ACK.
  expect(Object.hasOwn(replied, "current")).toBe(false)
  const messages = array(replied.messages).map(message)
  expect(messages).toHaveLength(question.messages.length + 1)
  expect(messages.filter((entry) => question.messages.some((prior) => prior.id === entry.id))).toEqual(question.messages)
  const appended = messages.filter((entry) => !question.messages.some((prior) => prior.id === entry.id))
  expect(appended).toHaveLength(1)
  const answer = appended[0]!
  expect(answer).toMatchObject({ version: 1, authorRef: input.principalRef, body: input.body, sourceContext: { ...question.basis, reviewContext: question.pin } })
  expect(question.messages.some((prior) => prior.incarnation === answer.incarnation)).toBe(false)
  expect((await api.thread(question.id)).messages).toEqual(replied.messages)
  const unconfirmed = await api.post("collaboration-answer-read", { questionId: question.id })
  expect(unconfirmed).toEqual({ httpStatus: 400, body: { status: "needs-input", reason: "answer-unconfirmed" } })
  return answer
}

/** Preparation is separate from confirmation so the caller can assert the
 * actual preserved UI/projection before submitting this exact observation.
 */
export async function prepareReviewAnswer(api: ReportsCollaboration, question: { id: string; pin: ReviewPin; basis: ReviewBasis }, answer: ReviewMessage): Promise<ReviewAnswer> {
  const prepared = object(await api.ok("collaboration-answer-prepare-message", {
    questionId: question.id, messageId: answer.id, incarnation: answer.incarnation, version: answer.version,
  }))
  expect(prepared.answer).toBe(answer.body)
  expect(prepared.authorRef).toBe(answer.authorRef)
  expect(prepared.reviewContext).toEqual(question.pin)
  expect(prepared.observedSourceVersion).toBe(question.basis.observedVersion)
  const sources = question.basis.evidenceRefs.map(object).filter((entry) => entry.refId === question.basis.sourceRef)
  expect(sources).toHaveLength(1)
  const source = sources[0]!
  expect(source.kind).toBe("record")
  const target = object(source.target)
  expect(target).toMatchObject({
    surface: "dashboard", recordType: "dashboard-page", recordId: "Budget Overview",
    incarnation: question.basis.sourceIncarnation, version: question.basis.observedVersion, period: question.basis.period,
  })
  const fields = array(target.fields).map(text)
  expect(fields).toContain("budgetMetrics")
  expect(new Set(fields).size).toBe(fields.length)
  // This scenario selects the plain Budget section: every captured cell uses
  // the same real page record; C06 has no additional record dependencies.
  expect(prepared.scope).toEqual({
    sourceRef: { surface: target.surface, type: target.recordType, id: target.recordId, incarnation: target.incarnation },
    fields: [...fields].sort(), period: question.basis.period, materialDependencies: [],
    scopeDefinitionVersion: "review-thread-c06-v1",
  })
  expect(prepared.evidence).toEqual(source)
  expect(Object.hasOwn(prepared, "accessLeaseRef")).toBe(false)
  expect(Object.hasOwn(prepared, "physicalIncarnation")).toBe(false)
  return {
    questionId: question.id, message: answer, pin: question.pin, basis: question.basis,
    answerRef: text(prepared.answerRef), observationRef: text(prepared.observationRef),
    observedSourceVersion: integer(prepared.observedSourceVersion, 1), expectedScopeFingerprint: text(prepared.expectedScopeFingerprint),
    projection: object(prepared.projection),
  }
}

export async function confirmReviewAnswer(api: ReportsCollaboration, answer: ReviewAnswer, key: string) {
  const mutation = {
    expectedStorageVersion: await api.version(), idempotencyKey: key,
    observationRef: answer.observationRef, observedSourceVersion: answer.observedSourceVersion,
    expectedScopeFingerprint: answer.expectedScopeFingerprint,
  }
  const payload = { questionId: answer.questionId, answerRef: answer.answerRef, mutation }
  const receipt = await api.ok("collaboration-answer-confirm", payload, key)
  expect(receipt).toEqual({ answerRef: answer.answerRef, observedVersion: answer.observedSourceVersion })
  await expectReusedReviewAnswer(api, answer)
  return { payload, receipt }
}

/** Calling this after page/context reopen verifies reuse without a new write. */
export async function expectReusedReviewAnswer(api: ReportsCollaboration, answer: ReviewAnswer) {
  const before = await api.version()
  const reused = await api.ok("collaboration-answer-read", { questionId: answer.questionId })
  expect(reused).toEqual({
    answerRef: answer.answerRef, answer: answer.message.body, authorRef: answer.message.authorRef,
    observedVersion: answer.observedSourceVersion, reviewContext: answer.pin,
  })
  expect(await api.version()).toBe(before)
  return reused
}

export async function editReviewAnswer(api: ReportsCollaboration, answer: ReviewAnswer, input: { body: string; key: string }) {
  const mutation = { expectedStorageVersion: await api.version(), idempotencyKey: input.key }
  const edited = await api.ok("collaboration-thread-edit", {
    id: answer.questionId, messageId: answer.message.id, expectedVersion: answer.message.version, body: input.body, mutation,
  }, input.key)
  expect(edited).toEqual({ id: answer.questionId, messageId: answer.message.id, version: answer.message.version + 1 })
  const current = await api.thread(answer.questionId)
  const matches = array(current.messages).map(message).filter((entry) => entry.id === answer.message.id)
  expect(matches).toHaveLength(1)
  expect(matches[0]).toMatchObject({
    id: answer.message.id, incarnation: answer.message.incarnation, version: answer.message.version + 1,
    authorRef: answer.message.authorRef, body: input.body, createdAt: answer.message.createdAt,
    sourceContext: { ...answer.basis, reviewContext: answer.pin },
  })
  const staleSelection = await api.post("collaboration-answer-prepare-message", {
    questionId: answer.questionId, messageId: answer.message.id, incarnation: answer.message.incarnation, version: answer.message.version,
  })
  expect(staleSelection).toEqual({ httpStatus: 409, body: { status: "stale", reason: "answer-selection-changed" } })
  const staleReuse = await api.post("collaboration-answer-read", { questionId: answer.questionId })
  expect(staleReuse).toEqual({ httpStatus: 503, body: { status: "unavailable", reason: "answer-reuse-unavailable" } })
  const historical = object(await api.ok("collaboration-thread-history", {
    id: answer.questionId, messageId: answer.message.id, incarnation: answer.message.incarnation, version: answer.message.version,
  }))
  expect(historical).toMatchObject({ ...answer.basis, reviewContext: answer.pin })
  expect(message(historical.message)).toEqual(answer.message)
  return matches[0]!
}

function object(value: unknown): ObjectValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Expected an actual JSON object from the product")
  return value as ObjectValue
}

function array(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected the product's message array")
  return value
}

function text(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) throw new Error("Expected a nonempty product reference")
  return value
}

function integer(value: unknown, minimum: number): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < minimum) throw new Error("Expected a valid product version")
  return value
}

function message(value: unknown): ReviewMessage {
  const source = object(value)
  return {
    id: text(source.id), incarnation: text(source.incarnation), version: integer(source.version, 1),
    authorRef: text(source.authorRef), body: text(source.body), createdAt: text(source.createdAt), sourceContext: object(source.sourceContext),
  }
}
