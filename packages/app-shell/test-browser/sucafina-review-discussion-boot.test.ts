import { afterEach, expect, test } from "bun:test"
import type { Window } from "happy-dom"
import type { BusinessEvidenceRef } from "../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { ReviewDiscussionTransport } from "../../../modules/sucafina/Sucafinav1/product/reviews/collaboration-client.ts"
import { createReviewCollaborationView } from "../../../modules/sucafina/Sucafinav1/product/reviews/collaboration-view.ts"

const binding = "a".repeat(64)
const dom = window as unknown as Window
const originalUrl = location.href
const views: ReturnType<typeof createReviewCollaborationView>[] = []
afterEach(() => { views.splice(0).forEach((view) => view.dispose()); document.body.replaceChildren(); dom.happyDOM.setURL(originalUrl) })

async function settled(view: ReturnType<typeof createReviewCollaborationView>) {
  for (let turn = 0; turn < 20 && view.element.inert; turn++) await new Promise<void>((resolve) => setTimeout(resolve, 0))
  expect(view.element.inert).toBe(false)
}

function fixture(options: { thread?: boolean; response?: (mode: string, request: Request) => Response | undefined } = {}) {
  // Presentation and request-order regression only. The injected transport does not grant real domain authority.
  dom.happyDOM.setURL("https://reports.example.invalid/sucafina/dashboard?sf=review&reviewRef=render-review" + (options.thread ? "&reviewThread=render-thread" : ""))
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const reference: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", kind: "record", refId: "render-source",
    installationId: "render", projectId: "render", refDigest: "b".repeat(64), evidenceLevel: "observed",
    target: { surface: "dashboard", recordType: "dashboard-page", recordId: "Budget Overview", incarnation: "render-source", version: 1,
      fields: ["forecast"], period, projectionDigest: "c".repeat(64) } }
  const projection: DomainProjection = { context: { installationId: "render", projectId: "render", principalRef: "person",
    accessRevision: binding, policyVersion: "render", surface: "dashboard", period, currency: "USD", sourceRefs: [], capabilities: [] },
    version: 1, engineVersion: "render", components: [], missing: [], values: [{ id: "forecast", value: 110, currency: "USD",
      period, granularity: "year", sourceRefs: [reference], drilldown: reference, evidenceState: "confirmed" }] }
  const review: PreservedReview = { id: "render-review", version: 1, createdAt: "2026-11-19T00:00:00Z", sourceRefs: [], comments: [],
    sections: [{ id: "budget", title: "Budget", period, content: projection, count: 1, sourceRefs: [] }] }
  const pin = { reviewRef: review.id, reviewVersion: review.version, reviewDigest: "d".repeat(64), sectionId: "budget" }
  const basis = { sourceRef: reference.refId, sourceIncarnation: reference.target.incarnation, observedVersion: reference.target.version, period, evidenceRefs: [reference] }
  const question = "  Exact question about the captured forecast.  "
  const thread = { id: "render-thread", recipientRef: "person", state: "open", messages: [{
    id: "render-message", incarnation: "render-message", version: 1, authorRef: "person", body: question,
    createdAt: "2026-11-19T00:00:00Z", sourceContext: { ...basis, reviewContext: pin } }] }
  const requests: Request[] = []
  const transport: ReviewDiscussionTransport = {
    binding: () => binding,
    url: () => location.href,
    fetch: async (input, init) => {
      const request = new Request(input, init), mode = new URL(request.url).searchParams.get("sf") ?? ""
      requests.push(request.clone())
      const response = options.response?.(mode, request)
      if (response) return response
      if (mode === "collaboration-recipients") return ok([{ id: "person", name: "Person" }])
      if (mode === "review-thread-context") return ok(pin)
      if (mode === "collaboration-storage-version") return ok(7)
      if (mode === "collaboration-thread-create" || mode === "collaboration-thread-read") return ok(thread)
      if (mode === "collaboration-answer-read") return Response.json({ status: "unavailable", reason: "no-confirmed-answer" }, { status: 503, headers: { "X-SF-Review-Binding": binding } })
      throw new Error("Unexpected presentation request: " + mode)
    },
  }
  const view = createReviewCollaborationView({ review, principalRef: "person", transport })
  views.push(view); document.body.append(view.element)
  const modes = () => requests.map((request) => new URL(request.url).searchParams.get("sf"))
  const button = (name: string) => {
    const found = [...view.element.querySelectorAll("button")].find((entry) => entry.textContent === name)
    expect(found).toBeDefined()
    return found!
  }
  const enterQuestion = () => {
    const input = view.element.querySelector<HTMLTextAreaElement>('textarea[aria-label="Question"]')!
    input.value = question; input.dispatchEvent(new Event("input", { bubbles: true }))
    return input
  }
  return { view, review, pin, basis, requests, modes, button, enterQuestion, question }
}

function ok(value: unknown) {
  return Response.json({ status: "ok", value }, { headers: { "X-SF-Review-Binding": binding } })
}

test("an empty discussion boots with recipients only; explicit refresh still checks its draft context", async () => {
  const state = fixture()
  await settled(state.view)
  expect(state.modes()).toEqual(["collaboration-recipients"])
  expect([...state.view.element.querySelectorAll("select")].map((select) => ({ label: select.getAttribute("aria-label"), value: select.value,
    selectedIndex: select.selectedIndex, options: [...select.options].map((option) => ({ text: option.textContent, value: option.value, defaultSelected: option.defaultSelected })) }))).toEqual([
    { label: "Review section", value: "budget", selectedIndex: 0, options: [{ text: "Budget", value: "budget", defaultSelected: false }] },
    { label: "Review source", value: "render-source", selectedIndex: 0, options: [{ text: "dashboard · Budget Overview · version 1", value: "render-source", defaultSelected: false }] },
    { label: "Recipient", value: "person", selectedIndex: 0, options: [{ text: "Person", value: "person", defaultSelected: false }] },
  ])
  expect(state.button("Ask about this review").disabled).toBe(false)
  const draft = state.enterQuestion()
  await state.view.refresh()
  expect(state.modes()).toEqual(["collaboration-recipients", "collaboration-recipients", "review-thread-context"])
  expect(draft.value).toBe(state.question)
  expect(state.requests.every((request) => request.headers.get("X-SF-Review-Binding") === binding)).toBe(true)
  expect(state.modes()).not.toContain("collaboration-storage-version")
  expect(state.modes()).not.toContain("collaboration-thread-create")
})

test("Ask obtains a fresh bound context before mutation and preserves the exact human draft", async () => {
  const state = fixture()
  await settled(state.view)
  state.enterQuestion(); state.button("Ask about this review").click()
  await settled(state.view)
  expect(state.modes()).toEqual(["collaboration-recipients", "review-thread-context", "collaboration-storage-version",
    "collaboration-thread-create", "collaboration-thread-read", "collaboration-answer-read"])
  expect(await state.requests[1]!.json()).toEqual({ reviewRef: state.review.id, sectionId: "budget", basis: state.basis })
  const created = state.requests[3]!, payload = await created.json()
  expect(payload.draft).toEqual({ kind: "clarification", ...state.basis, reviewContext: state.pin, recipientRef: "person", body: state.question })
  expect(payload.mutation.expectedStorageVersion).toBe(7)
  expect(payload.mutation.idempotencyKey).toBe(created.headers.get("Idempotency-Key"))
  expect(payload.mutation.idempotencyKey).toMatch(/^[a-f0-9-]{36}$/)
  expect(state.requests.every((request) => request.method === "POST" && request.headers.get("X-SF-Review-Binding") === binding)).toBe(true)
  expect(state.requests.slice(0, 3).every((request) => request.headers.get("Idempotency-Key") === null)).toBe(true)
  expect(state.view.element.querySelector('[role="status"]')?.textContent).toBe("Question saved against the preserved review.")
  expect(new URL(location.href).searchParams.get("reviewThread")).toBe("render-thread")
})

test.each(["denied", "unavailable"] as const)("a %s question context never acquires a mutation or sends the draft", async (status) => {
  const state = fixture({ response: (mode) => mode === "review-thread-context" ? Response.json({ status, reason: "context-test-" + status },
    { status: status === "denied" ? 403 : 503, headers: { "X-SF-Review-Binding": binding } }) : undefined })
  await settled(state.view)
  const draft = state.enterQuestion(); state.button("Ask about this review").click()
  await settled(state.view)
  expect(state.modes()).toEqual(["collaboration-recipients", "review-thread-context"])
  expect(state.modes()).not.toContain("collaboration-storage-version")
  expect(state.modes()).not.toContain("collaboration-thread-create")
  expect(draft.value).toBe(status === "denied" ? "" : state.question)
  if (status === "denied") expect(state.view.element.querySelectorAll("textarea")).toHaveLength(0)
  else expect(state.button("Reconcile discussion").disabled).toBe(false)
})

test("explicit reconciliation after an unavailable boot still obtains the current draft pin", async () => {
  let fail = true
  const state = fixture({ response: (mode) => fail && mode === "collaboration-recipients" ? Response.json({ status: "unavailable", reason: "directory-test-unavailable" },
    { status: 503, headers: { "X-SF-Review-Binding": binding } }) : undefined })
  await settled(state.view)
  expect(state.modes()).toEqual(["collaboration-recipients"])
  const draft = state.enterQuestion()
  fail = false; state.button("Reconcile discussion").click()
  await settled(state.view)
  expect(state.modes()).toEqual(["collaboration-recipients", "collaboration-recipients", "review-thread-context"])
  expect(draft.value).toBe(state.question)
  expect(state.button("Ask about this review").disabled).toBe(false)
})

test("an existing thread URL still reopens its thread and confirmed answer on boot", async () => {
  const state = fixture({ thread: true })
  await settled(state.view)
  expect(state.modes()).toEqual(["collaboration-recipients", "collaboration-thread-read", "collaboration-answer-read"])
  expect(await state.requests[1]!.json()).toEqual({ id: "render-thread" })
  expect(await state.requests[2]!.json()).toEqual({ questionId: "render-thread" })
  expect(state.view.element.querySelector("article")?.textContent).toContain(state.question)
  expect(state.view.element.textContent).toContain("No confirmed answer is currently available")
  expect(state.modes()).not.toContain("review-thread-context")
  expect(state.modes()).not.toContain("collaboration-thread-create")
})

test.each(["denied", "changed-binding"] as const)("recipient %s removes the discussion before any context or mutation", async (reason) => {
  const state = fixture({ response: (mode) => mode === "collaboration-recipients"
    ? reason === "denied" ? Response.json({ status: "denied", reason }, { status: 403, headers: { "X-SF-Review-Binding": binding } })
      : Response.json({ status: "ok", value: [{ id: "person", name: "Person" }] }, { headers: { "X-SF-Review-Binding": "e".repeat(64) } })
    : undefined })
  await settled(state.view)
  expect(state.modes()).toEqual(["collaboration-recipients"])
  expect(state.view.element.querySelectorAll("button, textarea, select")).toHaveLength(0)
  expect(state.view.element.isConnected).toBe(false)
})
