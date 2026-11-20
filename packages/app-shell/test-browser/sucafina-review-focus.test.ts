import { expect, spyOn, test } from "bun:test"
import type { Window } from "happy-dom"
import type { BusinessEvidenceRef } from "../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection, PreservedReview } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"

const dom = window as unknown as Window
const turn = () => new Promise<void>((resolve) => setTimeout(resolve, 0))
async function until(check: () => boolean) {
  for (let count = 0; count < 40 && !check(); count++) await turn()
  expect(check()).toBe(true)
}

test("installed focus refreshes a reconciled discussion without replaying its retained command", async () => {
  // Presentation wiring only: explicit HTTP results do not prove installed domain authority.
  const originalUrl = location.href, binding = "a".repeat(64)
  dom.happyDOM.setURL("https://reports.example.invalid/sucafina/dashboard?sf=review&reviewRef=render-review")
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
  const question = "  Exact retained human question.  "
  const thread = { id: "render-thread", recipientRef: "person", state: "open", messages: [{
    id: "render-message", incarnation: "render-message", version: 1, authorRef: "person", body: question,
    createdAt: "2026-11-19T00:00:00Z", sourceContext: { ...basis, reviewContext: pin } }] }
  const meta = document.createElement("meta")
  meta.name = "sf-access-revision"; meta.content = binding; document.head.append(meta)
  const main = document.createElement("main"), root = document.createElement("section"), bootstrap = document.createElement("script")
  root.dataset.sfReviewWorkspace = ""; bootstrap.dataset.sfReviewBootstrap = ""
  bootstrap.textContent = JSON.stringify({ reviewRef: review.id, principalRef: "person" })
  root.append(bootstrap); main.append(root); document.body.append(main)
  const requests: Request[] = []
  let dropCreatedRead = true, probeStatus = 200
  let probeReply: ReturnType<typeof Promise.withResolvers<Response>> | undefined
  const ok = (value: unknown) => Response.json({ status: "ok", value }, { headers: { "X-SF-Review-Binding": binding } })
  const fetcher = spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const request = new Request(input, init), mode = new URL(request.url).searchParams.get("sf") ?? ""
    requests.push(request.clone())
    if (request.method === "GET" && mode === "review") return probeReply?.promise ?? new Response("focus probe", { status: probeStatus })
    if (request.method === "GET" && mode === "review-read") return ok(review)
    if (mode === "collaboration-recipients") return ok([{ id: "person", name: "Person" }])
    if (mode === "review-thread-context") return ok(pin)
    if (mode === "collaboration-storage-version") return ok(7)
    if (mode === "collaboration-thread-create") return ok(thread)
    if (mode === "collaboration-thread-read") {
      if (dropCreatedRead) { dropCreatedRead = false; throw new TypeError("lost post-create read") }
      return ok(thread)
    }
    if (mode === "collaboration-answer-read") return Response.json({ status: "unavailable", reason: "answer-reuse-unavailable" },
      { status: 503, headers: { "X-SF-Review-Binding": binding } })
    throw new Error("Unexpected presentation request: " + request.method + " " + mode)
  })
  const mode = (request: Request) => new URL(request.url).searchParams.get("sf")
  const matching = (name: string) => requests.filter((request) => mode(request) === name)
  const discussion = () => root.querySelector<HTMLElement>('section[aria-label="Review discussion"]')
  const status = () => discussion()?.querySelector('[role="status"]')?.textContent ?? ""
  const button = (name: string) => {
    const found = [...(discussion()?.querySelectorAll("button") ?? [])].find((entry) => entry.textContent === name)
    expect(found).toBeDefined(); return found!
  }
  try {
    await import("../../../apps/cli/src/sucafina-product/extended-browser.ts")
    await until(() => !!discussion() && !discussion()!.inert)
    const mounted = discussion()!
    const recipient = mounted.querySelector<HTMLSelectElement>('select[aria-label="Recipient"]')!
    recipient.value = "person"; recipient.dispatchEvent(new Event("change", { bubbles: true }))
    const draft = mounted.querySelector<HTMLTextAreaElement>('textarea[aria-label="Question"]')!
    draft.value = question; draft.dispatchEvent(new Event("input", { bubbles: true }))
    button("Ask about this review").click()
    await until(() => !mounted.inert && status().includes("retained"))
    expect(matching("collaboration-thread-create")).toHaveLength(1)
    const originalCommand = matching("collaboration-thread-create")[0]!
    const originalPayload = await originalCommand.clone().text()
    const originalKey = originalCommand.headers.get("Idempotency-Key")
    expect(originalKey).toMatch(/^[a-f0-9-]{36}$/)
    expect(draft.value).toBe(question)
    button("Reconcile action").click()
    await until(() => !mounted.inert && status().startsWith("Action reconciled."))
    expect(new URL(location.href).searchParams.get("reviewThread")).toBe(thread.id)
    expect(draft.readOnly).toBe(true)
    const focusStart = requests.length
    probeReply = Promise.withResolvers<Response>()
    window.dispatchEvent(new Event("focus")); window.dispatchEvent(new Event("focus"))
    await turn()
    expect(requests.slice(focusStart).map(mode)).toEqual(["review"])
    probeReply.resolve(new Response("authorized review", { status: 200 }))
    await until(() => matching("collaboration-answer-read").length === 1 && !mounted.inert)
    probeReply = undefined
    expect(requests.slice(focusStart).map(mode)).toEqual(["review", "collaboration-recipients", "collaboration-thread-read", "collaboration-answer-read"])
    expect(discussion()).toBe(mounted)
    expect(draft.value).toBe(question)
    expect(draft.readOnly).toBe(true)
    expect(button("Ask about this review").disabled).toBe(true)
    expect(button("Retry same action").disabled).toBe(false)
    expect(matching("collaboration-storage-version")).toHaveLength(1)
    expect(matching("collaboration-thread-create")).toHaveLength(1)
    button("Retry same action").click()
    await until(() => !mounted.inert && status() === "Question saved against the preserved review.")
    const replay = matching("collaboration-thread-create")
    expect(replay).toHaveLength(2)
    expect(await replay[1]!.clone().text()).toBe(originalPayload)
    expect(replay[1]!.headers.get("Idempotency-Key")).toBe(originalKey)
    expect(matching("collaboration-storage-version")).toHaveLength(1)
    expect(draft.value).toBe("")
    const unavailableStart = requests.length
    probeStatus = 503; window.dispatchEvent(new Event("focus"))
    for (let count = 0; count < 4; count++) await turn()
    expect(requests.slice(unavailableStart).map(mode)).toEqual(["review"])
    expect(discussion()).toBe(mounted)
    const deniedStart = requests.length
    probeStatus = 403; window.dispatchEvent(new Event("focus"))
    await until(() => !discussion())
    expect(requests.slice(deniedStart).map(mode)).toEqual(["review"])
    expect(root.querySelectorAll("textarea, article")).toHaveLength(0)
    const closedCount = requests.length
    window.dispatchEvent(new Event("focus")); await turn()
    expect(requests).toHaveLength(closedCount)
  } finally {
    window.dispatchEvent(new Event("pagehide"))
    fetcher.mockRestore(); meta.remove(); main.remove(); dom.happyDOM.setURL(originalUrl)
  }
})
