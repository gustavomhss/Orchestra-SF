import type { Browser, BrowserContext } from "@playwright/test"
import { randomUUID } from "node:crypto"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { createSfHumanAuthority, sfHumanReadActions } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { caseQuestionScript, caseQuestionThreads } from "../../../product/ui/work-collaboration.ts"
import { createThreadActorsFixture } from "../ui-split/ui-work/actors-fixture.ts"
import { loadRecipientActions } from "./producer-loader.ts"
import { createCollaborationMutationFence } from "../../../product/collaboration/mutation-fence.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import { esc } from "../../../src/screen-shell.ts"
import { object, rows } from "../../../runtime/contract.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { available } from "../ui-split/ui-work/domain-fixture.ts"

/** Actual shared Collaboration HTTP/C08/source issuers and SQLite; the recipient action
 * factory is the pinned producer loaded verbatim in this test-owned composition.
 * This is a component proof, not proof that the production host has adopted that producer.
 * Actor authentication and recipient leases are the published fixture boundary.
 * The case's question link is seeded test corpus, not proof of question attachment.
 * Decision-answer attachment is deliberately unmounted: no success is fabricated.
 */
export async function createAckBrowserFixture(browser: Browser) {
  const routing: { handle?: (request: Request) => Promise<Response> } = {}
  const server = Bun.serve({ hostname: "127.0.0.1", port: 0, idleTimeout: 30,
    fetch: (request) => routing.handle?.(request) ?? new Response(null, { status: 503 }) })
  const origin = server.url.origin
  let actors: Awaited<ReturnType<typeof createThreadActorsFixture>> | undefined
  let context: BrowserContext | undefined
  let producer: Awaited<ReturnType<typeof loadRecipientActions>> | undefined
  const close = async () => {
    const errors: unknown[] = []
    try { await context?.close() } catch (error) { errors.push(error) }
    try { await server.stop(true) } catch (error) { errors.push(error) }
    try { await actors?.dispose() } catch (error) { errors.push(error) }
    try { await producer?.close() } catch (error) { errors.push(error) }
    if (errors.length) throw new AggregateError(errors, "Shared Collaboration browser cleanup failed")
  }
  try {
    const app = actors = await createThreadActorsFixture(origin)
    producer = await loadRecipientActions()
    if (!app.port.recipientThread) throw new Error("Real recipient reader unavailable")
    const recipientActions = producer.createRecipientThreadActions({ state: app.state, host: app.host, human: app.human,
      mutationFence: createCollaborationMutationFence(app.host), read: app.port.recipientThread,
      creationTarget: app.creationTarget, createId: randomUUID, now: () => app.clock.at })
    const port = { ...app.port, recipientActions }
    const source = await app.issueProject(app.author)
    const draft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation,
      observedVersion: source.target.version, period: app.period, recipientRef: "reader-b", body: "Clarify the selected project's work.", evidenceRefs: [source] }
    const mutation = { expectedStorageVersion: available(await app.port.storageVersion("threads", app.author)), idempotencyKey: randomUUID() }
    const thread = available(await app.port.threads.create(draft, mutation, await app.admit("person", "collaboration.thread.create", { draft, mutation })))
    const selected = await app.issueProject(app.recipient)
    const caseDraft = { objective: "Review the project answer", horizon: app.period, currency: "USD", criteria: ["Use the exact confirmed answer"], sourceRefs: [selected] }
    const call = available(await app.ui.admit(app.request("reader-b"), "sf_case_draft", digestSfValue(caseDraft)))
    if (!await app.ui.validate(call, "sf_case_draft", digestSfValue(caseDraft))) throw new Error("Case admission unavailable")
    const decision = available(await app.cases.draft(caseDraft, call))
    app.ui.finish(call)
    const caseRef = encodeCaseRef(decision)
    const before = await app.state.read(app.request("reader-b"), "cases", (state) => state.cases[decision.id])
    if (before.status !== "ok" || !before.value) throw new Error("Case corpus unavailable")
    const withQuestion = { ...before.value, state: "investigating" as const, questions: [{ id: thread.id, text: draft.body, state: "open" as const }] }
    const seeded = await app.state.transaction(app.request("reader-b"), { namespace: "cases", expectedStorageVersion: before.storageVersion,
      idempotencyKey: randomUUID(), commandDigest: digestSfValue(withQuestion), targetRef: app.creationTarget.ref, targetIncarnation: app.creationTarget.incarnation }, async (state) => {
      state.cases[decision.id] = withQuestion
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok" || !seeded.value) throw new Error("Question corpus could not be seeded")
    const human = createSfHumanAuthority({ origin, ui: app.ui })
    const admitRead = async (request: Request, operation: string, payload: unknown): Promise<PortResult<TrustedUiContext>> => {
      if (!sfHumanReadActions.some((action) => action === operation)) return { status: "denied", reason: "unregistered-read" }
      return human.admit(request, operation as SfHumanAction, payload)
    }
    const http = createCollaborationHttp({ origin, mount: "/product", host: port, human, admitRead, finishRead: human.finish })
    const attempts: { route: string | null; body: string; key: string | null; status: number; response: string }[] = []
    // This optional selector is always issued by the real producer. It represents
    // a previously rendered selector, and never changes the authorized case read.
    const view: { savedAnswerRef?: string } = {}
    routing.handle = async (request) => {
      if (new URL(request.url).pathname !== "/product") return new Response(null, { status: 404 })
      if (request.method === "GET") {
        const payload = { caseRef }, digest = digestSfValue(payload)
        const admission = await app.ui.admit(request, "sf_case_read", digest)
        if (admission.status !== "ok") return new Response(null, { status: 403 })
        try {
          if (!await app.ui.validate(admission.value, "sf_case_read", digest)) return new Response(null, { status: 403 })
          const found = await app.cases.read(payload, admission.value)
          if (found.status !== "ok") return new Response(null, { status: found.status === "denied" ? 403 : 503 })
          const projection = view.savedAnswerRef ? { ...found.value, case: { ...found.value.case,
            questions: found.value.case.questions.map((question) => ({ ...question, answerRef: view.savedAnswerRef })) } } : found.value
          return new Response(`<!doctype html><html><head><meta charset="utf-8"><meta name="sf-access-revision" content="${esc(projection.context.accessRevision)}"></head><body>${caseQuestionThreads(projection)}<script>${caseQuestionScript}</script></body></html>`,
            { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "X-SF-Access-Revision": projection.context.accessRevision } })
        } finally { app.ui.finish(admission.value) }
      }
      const body = await request.clone().text()
      const response = await http(request) ?? new Response(null, { status: 404 })
      attempts.push({ route: new URL(request.url).searchParams.get("sf"), body, key: request.headers.get("idempotency-key"), status: response.status, response: await response.clone().text() })
      return response
    }
    context = await browser.newContext({ extraHTTPHeaders: { actor: "reader-b" } })
    const page = await context.newPage(), errors: string[] = []
    page.setDefaultTimeout(5_000)
    page.on("pageerror", (error) => errors.push(error.message))
    const send = async (route: string, payload: unknown, actor = "reader-b") => {
      const response = await fetch(`${origin}/product?sf=collaboration-${route}`, { method: "POST", headers: { origin, actor, "content-type": "application/json" }, body: JSON.stringify(payload) })
      return { status: response.status, result: await response.json() as PortResult<unknown> }
    }
    const reply = async (body: string) => {
      if (!port.recipientActions) throw new Error("Recipient action producer unavailable")
      const current = await app.admitRead("reader-b")
      const mutation = { expectedStorageVersion: available(await app.port.storageVersion("threads", current)), idempotencyKey: randomUUID() }
      return available(await port.recipientActions.reply(thread.id, body, mutation, await app.admit("reader-b", "collaboration.thread.reply", { id: thread.id, body, mutation })))
    }
    const inspect = () => app.state.read(app.request("person"), "threads", (state) => {
      const stored = state.threads[thread.id]
      return isThread(stored) ? stored : undefined
    })
    const resolveThread = async () => {
      const current = await app.admitRead("reader-b")
      const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", current)), idempotencyKey: randomUUID() }
      return available(await port.recipientActions.resolve(thread.id, mutation, await app.admit("reader-b", "collaboration.thread.resolve", { id: thread.id, mutation })))
    }
    const editMessage = async (messageId: string, expectedVersion: number, body: string) => {
      if (!port.threadHistory) throw new Error("Actual message history writer unavailable")
      const current = await app.admitRead("reader-b")
      const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", current)), idempotencyKey: randomUUID() }
      return available(await port.threadHistory.edit(thread.id, messageId, expectedVersion, body, mutation,
        await app.admit("reader-b", "collaboration.thread.edit", { id: thread.id, messageId, expectedVersion, body, mutation })))
    }
    // Negative-only corpus mutation of an existing C08 value; never constructs a positive receipt.
    const legacyOutcome = (key: string) => app.persistence.transaction("dashboard", async (snapshot) => {
      const product = snapshot.data.__sfProductV1 as SfProductState
      const transaction = product.transactions[JSON.stringify(["reader-b", "threads", app.creationTarget.ref, key])]
      if (!transaction) throw new Error("Committed C08 transaction unavailable")
      transaction.value = true
      return { commit: true, value: undefined }
    })
    const historyCount = () => app.state.read(app.request("person"), "threads", (state) =>
      Object.keys(state.threads).filter((id) => id.startsWith("sf:thread-resolution-history:")).length)
    const replaceSource = async () => {
      const before = await app.snapshots()
      const previous = sfSourceIdentity(before.dashboard, "projects", "project")
      const version = before.dashboard.versions["projects:project"]
      if (!previous || !version) throw new Error("Original physical source unavailable")
      await app.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "delete", id: "project", version: version.version, values: {} })
      // Hostile reuse corpus: canonical commands do not permit tombstone reuse.
      // Real source lifecycle still detects the replacement on this SQLite write.
      await app.persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.projects = [...rows(snapshot.data.projects), { ...object(rows(before.dashboard.data.projects).find((row) => row.id === "project")), id: "project", name: "Replacement source with the same ID" }]
        return { commit: true, value: undefined }
      })
      const current = sfSourceIdentity((await app.snapshots()).dashboard, "projects", "project")
      if (!current) throw new Error("Replacement physical source unavailable")
      return { previous, current }
    }
    return { ...app, port, origin, context, page, errors, attempts, thread, caseRef, view, send, reply, inspect, resolveThread, editMessage, legacyOutcome, historyCount, replaceSource, close }
  } catch (error) {
    try { await close() } catch (cleanup) { throw new AggregateError([error, cleanup], "Shared Collaboration setup and cleanup failed") }
    throw error
  }
}

