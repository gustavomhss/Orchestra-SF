import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { createSfHumanAuthority, sfHumanReadActions } from "../../../product/integration/human-authority.ts"
import { createReviewDiscussionClient, ReviewDiscussionError } from "../../../product/reviews/collaboration-client.ts"
import { createThreadActorsFixture } from "../wp08/thread-actors-fixture.ts"
import { receiptQuestion } from "../wp08/recipient-receipt-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"

/** Actual SQLite/C03/C08, source issuers, admissions, readers and HTTP adapter.
 * Actor identities and recipient grants are the existing explicit WP08 fixture;
 * this is a boundary proof, not an installed/native or corporate identity proof.
 */
export async function createReadBoundaryFixture(reader: "base" | "recipient", selectedActor?: string) {
  const fixture = await createThreadActorsFixture()
  // Use the installed transport's digest shape in the fixture's authority input,
  // then obtain fresh admissions through the real authority registry.
  for (const [id, actor] of Object.entries(fixture.actors)) actor.access = digestSfValue({ actor: id, revision: 1 })
  fixture.author = await fixture.admitRead("person")
  fixture.recipient = await fixture.admitRead("reader-b")
  fixture.homonym = await fixture.admitRead("reader-c")
  const actor = selectedActor ?? (reader === "base" ? "person" : "reader-b")
  const binding = fixture.actors[actor]!.access
  const question = await receiptQuestion(fixture)
  const humanRead = createSfHumanAuthority({ origin: "https://example.test", ui: fixture.ui })
  const io: { armed: boolean; reads: number; failSecond: boolean; failureReason: string; afterFirst?: () => Promise<void> } = { armed: false, reads: 0, failSecond: false, failureReason: "test-storage-read-unavailable" }
  const originalRead = fixture.state.read
  fixture.state.read = async (request, namespace, inspect) => {
    const selected = io.armed && namespace === "threads" && request.headers.get("X-SF-Test-Read") === "reports48"
    const ordinal = selected ? ++io.reads : 0
    if (ordinal === 2 && io.failSecond) {
      io.armed = false
      return { status: "unavailable", reason: io.failureReason }
    }
    const result = await originalRead(request, namespace, inspect)
    if (ordinal === 1) await io.afterFirst?.()
    if (ordinal === 2) io.armed = false
    return result
  }
  const evidence: { fault: "" | "throw" | "unavailable" | "stale" | "revoked"; calls: number } = { fault: "", calls: 0 }
  const originalContext = fixture.evidence.context
  fixture.evidence.context = async (selection, context) => {
    const result = await originalContext(selection, context)
    const selected = fixture.host.requestFor(context)?.headers.get("X-SF-Test-Read") === "reports48"
    if (!selected || !evidence.fault) return result
    evidence.calls += 1
    if (evidence.fault === "throw") throw new Error("Injected evidence transport outage after the real read")
    const state = evidence.fault
    return result.map((resolution) => ({ ...resolution, state }))
  }
  const admission = { unavailable: false }
  const requests: { mode: string; body: string; key: string | null; status: number; result: Record<string, unknown> }[] = []
  const lost: string[] = []
  const transport = { drop: "", afterResponse: undefined as undefined | (() => Promise<void>) }
  const compose = () => createCollaborationHttp({
    origin: "https://example.test", mount: "/product",
    host: reader === "base" ? { ...fixture.port, recipientThread: undefined } : fixture.port,
    human: fixture.human,
    admitRead: async (request, operation, payload) => {
      if (admission.unavailable) throw new Error("Injected read admission transport outage")
      const action = sfHumanReadActions.find((value) => value === operation)
      return action ? humanRead.admit(request, action, payload) : { status: "denied", reason: "unregistered-test-read" }
    },
    finishRead: humanRead.finish,
  })
  let http = compose()
  const createClient = () => createReviewDiscussionClient(() => { lost.push("access") }, {
    url: () => "https://example.test/product?review=preserved",
    binding: () => binding,
    fetch: async (input, init) => {
      const headers = new Headers(init?.headers)
      headers.set("actor", actor); headers.set("origin", "https://example.test")
      headers.set("X-SF-Test-Read", "reports48")
      const request = new Request(input, { ...init, headers })
      const mode = new URL(request.url).searchParams.get("sf") ?? ""
      const body = await request.clone().text()
      const response = await http(request)
      if (!response) throw new Error("Actual collaboration route was not mounted")
      const result = await response.clone().json() as Record<string, unknown>
      requests.push({ mode, body, key: request.headers.get("Idempotency-Key"), status: response.status, result })
      await transport.afterResponse?.()
      if (transport.drop === mode) {
        transport.drop = ""
        throw new TypeError("Synthetic transport loss after the actual HTTP response")
      }
      return response
    },
  })
  let client = createClient()
  return { fixture, actor, binding, question, io, evidence, admission, requests, lost, transport,
    get client() { return client },
    read: () => client.post("collaboration-thread-read", { id: question.id }),
    reply: async (body = "Concurrent authorized reply") => {
      const author = reader === "base" ? "person" : "reader-b"
      const context = reader === "base" ? fixture.author : fixture.recipient
      const mutation = { expectedStorageVersion: available(await fixture.port.storageVersion("threads", context)), idempotencyKey: `reports48-${crypto.randomUUID()}` }
      const intent = { id: question.id, body, mutation }
      if (reader === "base") return available(await fixture.port.threads.reply(question.id, body, mutation, await fixture.admit(author, "collaboration.thread.reply", intent)))
      if (!fixture.port.recipientActions) throw new Error("Actual recipient actions are required")
      return available(await fixture.port.recipientActions.reply(question.id, body, mutation, await fixture.admit(author, "collaboration.thread.reply", intent)))
    },
    reopen: async () => {
      client.dispose()
      await fixture.reopen()
      fixture.author = await fixture.admitRead("person")
      fixture.recipient = await fixture.admitRead("reader-b")
      fixture.port = fixture.compose()
      http = compose(); client = createClient()
    },
    dispose: async () => { client.dispose(); fixture.state.read = originalRead; fixture.evidence.context = originalContext; await fixture.dispose() },
  }
}

export async function discussionFailure(operation: Promise<unknown>) {
  try { await operation } catch (error) {
    if (error instanceof ReviewDiscussionError) return error
    throw error
  }
  throw new Error("Expected the real discussion client to reject this boundary result")
}
