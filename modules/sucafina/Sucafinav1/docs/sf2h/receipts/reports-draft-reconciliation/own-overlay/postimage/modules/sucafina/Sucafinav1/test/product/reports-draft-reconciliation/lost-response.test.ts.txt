import { expect, test } from "bun:test"
import { createReadBoundaryFixture, discussionFailure } from "./read-boundary-fixture.ts"

for (const action of ["reply", "edit"] as const) {
  test(`lost ${action} response: explicit replay after SQLite reopen retains the exact request and one effect`, async () => {
    const f = await createReadBoundaryFixture(action === "edit" ? "base" : "recipient")
    try {
      if (action === "edit") await f.reply("Original author answer")
      const before = await f.read() as { messages: { id: string; incarnation: string; version: number; body: string }[] }
      const original = before.messages.at(-1)!
      const mutation = await f.client.mutation()
      const payload = action === "reply"
        ? { id: f.question.id, body: "Private reply kept after response loss", mutation }
        : { id: f.question.id, messageId: original.id, expectedVersion: original.version, body: "Private edit kept after response loss", mutation }
      const serializedIntent = JSON.stringify(payload)
      const mode = `collaboration-thread-${action}`
      f.transport.drop = mode
      const failure = await discussionFailure(f.client.post(mode, JSON.parse(serializedIntent), mutation.idempotencyKey))
      expect(failure.kind).toBe("recoverable")
      expect(failure.outcome).toBe("unknown")
      expect(f.lost).toEqual([])
      const first = f.requests.filter((request) => request.mode === mode)
      expect(first).toHaveLength(1)
      // The fault occurs only after the actual domain and HTTP adapter succeed.
      expect(first[0]!.status).toBe(200)
      expect(first[0]!.body).toBe(serializedIntent)
      expect(first[0]!.key).toBe(mutation.idempotencyKey)

      await f.reopen()
      const reopened = await f.read() as { messages: { id: string; incarnation: string; version: number; body: string }[] }
      expect(reopened.messages).toHaveLength(2)
      expect(reopened.messages.at(-1)!.body).toBe(payload.body)
      expect(reopened.messages.at(-1)!.version).toBe(action === "reply" ? 1 : original.version + 1)
      // New admission/reopen and authorized reads do not resend the command.
      expect(f.requests.filter((request) => request.mode === mode)).toHaveLength(1)
      expect(JSON.stringify(payload)).toBe(serializedIntent)
      await f.client.post(mode, JSON.parse(serializedIntent), mutation.idempotencyKey)
      const retried = f.requests.filter((request) => request.mode === mode)
      expect(retried).toHaveLength(2)
      expect(retried.map((request) => request.body)).toEqual([serializedIntent, serializedIntent])
      expect(retried.map((request) => request.key)).toEqual([mutation.idempotencyKey, mutation.idempotencyKey])
      expect(retried.map((request) => request.status)).toEqual([200, 200])
      expect(await f.read()).toEqual(reopened)
      expect(f.lost).toEqual([])
      if (action === "edit") {
        const history = await f.client.post("collaboration-thread-history", { id: f.question.id, messageId: original.id, incarnation: original.incarnation, version: original.version }) as { message: { body: string; version: number } }
        expect(history.message.body).toBe("Original author answer")
        expect(history.message.version).toBe(original.version)
      }
    } finally { await f.dispose() }
  })
}
