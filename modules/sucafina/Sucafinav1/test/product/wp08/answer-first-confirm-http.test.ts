import { expect, test } from "bun:test"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { createSfHumanAuthority, sfHumanReadActions } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"

type Prepared = { observationRef: string; observedSourceVersion: number; expectedScopeFingerprint: string; answerRef: string; answer: string; authorRef: string }

// Real HTTP adapter, UI grant, C06, source issuer and confirmation. The actor
// authenticator/recipient lease remain explicitly provided by the fixture.
test("first answer confirmation issues its selector server-side and rejects another recipient, wrong thread, edited version and revoked access", async () => {
  const fixture = await createThreadActorsFixture()
  try {
    const port = fixture.port
    if (!port.recipientActions || !port.threadHistory || !port.answerReuse) throw new Error("Answer producers unavailable")
    const source = await fixture.issueProject(fixture.author)
    const draft = { kind: "clarification" as const, sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: source.target.version, period: fixture.period, recipientRef: "person", body: "Please clarify this exact project.", evidenceRefs: [source] }
    const mutation = { expectedStorageVersion: available(await port.storageVersion("threads", fixture.author)), idempotencyKey: "first-http-question" }
    const thread = available(await port.threads.create(draft, mutation, await fixture.admit("person", "collaboration.thread.create", { draft, mutation })))
    const body = "My first answer for the selected project."
    const replyMutation = { expectedStorageVersion: available(await port.storageVersion("threads", fixture.author)), idempotencyKey: "first-http-answer" }
    const replied = available(await port.recipientActions.reply(thread.id, body, replyMutation, await fixture.admit("person", "collaboration.thread.reply", { id: thread.id, body, mutation: replyMutation })))
    const message = replied.messages[1]!
    const selection = { questionId: thread.id, messageId: message.id, incarnation: message.incarnation, version: message.version }
    const human = createSfHumanAuthority({ origin: "https://example.test", ui: fixture.ui })
    const admissions: TrustedUiContext[] = []
    const http = createCollaborationHttp({ origin: "https://example.test", mount: "/product", host: port, human,
      admitRead: async (request, operation, payload) => {
        if (!sfHumanReadActions.some((action) => action === operation)) return { status: "denied", reason: "unregistered-read" }
        const admitted = await human.admit(request, operation as SfHumanAction, payload)
        if (admitted.status === "ok") admissions.push(admitted.value)
        return admitted
      }, finishRead: human.finish,
    })
    const send = async <T>(route: string, payload: unknown, actor = "person") => {
      const response = await http(new Request(`https://example.test/product?sf=collaboration-${route}`, { method: "POST", headers: { origin: "https://example.test", "content-type": "application/json", actor }, body: JSON.stringify(payload) }))
      if (!response) throw new Error("HTTP route missing")
      const raw = await response.text()
      return { status: response.status, raw, value: JSON.parse(raw) as PortResult<T> }
    }
    expect((await send("answer-read", { questionId: thread.id })).value).toMatchObject({ status: "needs-input", reason: "answer-unconfirmed" })
    const homonym = await send("answer-prepare-message", selection, "reader-c")
    expect(homonym.value.status).not.toBe("ok")
    expect(homonym.raw).not.toContain(body)
    expect(homonym.raw).not.toContain("answerRef")
    const otherThread = await send("answer-prepare-message", { ...selection, questionId: `${thread.id}-not-selected` })
    expect(otherThread.value.status).not.toBe("ok")
    expect(otherThread.raw).not.toContain(body)
    const question = await send("answer-prepare-message", { ...selection, messageId: thread.messages[0]!.id, incarnation: thread.messages[0]!.incarnation, version: thread.messages[0]!.version })
    expect(question.value.status).not.toBe("ok")
    const edit = { id: thread.id, messageId: message.id, expectedVersion: 1, body: "My corrected answer for the same project.", mutation: { expectedStorageVersion: available(await port.storageVersion("threads", fixture.author)), idempotencyKey: "first-http-edited-answer" } }
    available(await port.threadHistory.edit(edit.id, edit.messageId, edit.expectedVersion, edit.body, edit.mutation, await fixture.admit("person", "collaboration.thread.edit", edit)))
    const stale = await send("answer-prepare-message", selection)
    expect(stale).toMatchObject({ status: 409, value: { status: "stale", reason: "answer-selection-changed" } })
    expect(stale.raw).not.toContain(edit.body)
    const prepared = await send<Prepared>("answer-prepare-message", { ...selection, version: 2 })
    expect(prepared.status).toBe(200)
    const display = available(prepared.value)
    expect(display.answer).toBe(edit.body)
    expect(display.authorRef).toBe("person")
    expect(display.answerRef).toBe(available(await port.answerEvidence.issue(thread.id, message.id, fixture.author)).refId)
    expect(await fixture.ui.revalidate(admissions.at(-1)!)).toBe(false)
    const confirmation = { questionId: thread.id, answerRef: display.answerRef, mutation: { expectedStorageVersion: available(await port.storageVersion("threads", fixture.author)), idempotencyKey: "first-http-confirm", observationRef: display.observationRef, observedSourceVersion: display.observedSourceVersion, expectedScopeFingerprint: display.expectedScopeFingerprint } }
    expect((await send("answer-confirm", confirmation)).status).toBe(200)
    expect((await send("answer-read", { questionId: thread.id })).value).toMatchObject({ status: "ok", value: { answerRef: display.answerRef, answer: edit.body, authorRef: "person" } })
    fixture.actors.person!.enabled = false
    const revoked = await send("answer-prepare-message", { ...selection, version: 2 })
    expect(revoked.status).toBe(403)
    expect(revoked.raw).not.toContain(edit.body)
    expect(revoked.raw).not.toContain(display.answerRef)
  } finally {
    await fixture.dispose()
  }
})
