import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createReadBoundaryFixture, discussionFailure } from "./read-boundary-fixture.ts"

for (const reader of ["base", "recipient"] as const) {
  test(`${reader}: authorized reply between state reads requires reconciliation without revoking`, async () => {
    const f = await createReadBoundaryFixture(reader)
    try {
      f.io.armed = true
      f.io.afterFirst = async () => { await f.reply() }
      const failure = await discussionFailure(f.read())
      expect(failure.kind).toBe("conflict")
      expect(failure.outcome).toBe("unknown")
      expect(failure.message).toBe("thread-content-changed")
      expect(f.io.reads).toBe(2)
      expect(f.lost).toEqual([])
      expect(f.requests[0]!.status).toBe(409)
      expect(f.requests[0]!.result).toEqual({ status: "stale", reason: "thread-content-changed" })
      const current = await f.read() as { messages: { body: string }[] }
      expect(current.messages.map((message) => message.body)).toEqual(["Explain this exact source.", "Concurrent authorized reply"])
      expect(f.requests.map((request) => request.mode)).toEqual(["collaboration-thread-read", "collaboration-thread-read"])
      expect(f.lost).toEqual([])
    } finally { await f.dispose() }
  })

  test(`${reader}: second state read failure keeps the client alive for an authorized reread`, async () => {
    const f = await createReadBoundaryFixture(reader)
    try {
      f.io.armed = true; f.io.failSecond = true
      const failure = await discussionFailure(f.read())
      expect(failure.kind).toBe("recoverable")
      expect(failure.outcome).toBe("unknown")
      expect(f.io.reads).toBe(2)
      expect(f.lost).toEqual([])
      expect(f.requests[0]!.status).toBe(503)
      expect(f.requests[0]!.result).toEqual({ status: "unavailable", reason: reader === "base" ? "test-storage-read-unavailable" : "thread-read-unavailable" })
      const current = await f.read() as { messages: { body: string }[] }
      expect(current.messages.map((message) => message.body)).toEqual(["Explain this exact source."])
      expect(f.requests.map((request) => request.mode)).toEqual(["collaboration-thread-read", "collaboration-thread-read"])
      expect(f.lost).toEqual([])
    } finally { await f.dispose() }
  })

  test(`${reader}: actual authorization loss after the first state read is denied and terminal`, async () => {
    const f = await createReadBoundaryFixture(reader)
    try {
      f.io.armed = true
      f.io.afterFirst = async () => { f.fixture.actors[f.actor]!.enabled = false }
      const failure = await discussionFailure(f.read())
      expect(failure.kind).toBe("access")
      expect(f.lost).toEqual(["access"])
      expect(f.requests[0]!.status).toBe(403)
      expect(f.requests[0]!.result.status).toBe("denied")
      expect(f.requests[0]!.result).not.toHaveProperty("value")
      f.fixture.actors[f.actor]!.enabled = true
      expect((await discussionFailure(f.read())).kind).toBe("access")
      expect(f.requests).toHaveLength(1)
      expect(f.lost).toEqual(["access"])
    } finally { await f.dispose() }
  })
}

test("recipient denial cannot fall through to the older ambiguous base reader", async () => {
  const f = await createReadBoundaryFixture("recipient", "reader-c")
  try {
    const failure = await discussionFailure(f.read())
    expect(failure.kind).toBe("access")
    expect(f.lost).toEqual(["access"])
    expect(f.requests[0]!.status).toBe(403)
    expect(f.requests[0]!.result.status).toBe("denied")
    expect(f.requests[0]!.result).not.toHaveProperty("value")
  } finally { await f.dispose() }
})

test("binding change during the actual reader wins over recoverable content drift", async () => {
  const f = await createReadBoundaryFixture("recipient")
  try {
    f.io.armed = true
    f.io.afterFirst = async () => {
      await f.reply()
      f.fixture.actors[f.actor]!.access = digestSfValue({ actor: f.actor, revision: 2 })
    }
    const failure = await discussionFailure(f.read())
    expect(failure.kind).toBe("access")
    expect(f.lost).toEqual(["access"])
    expect(f.requests[0]!.status).toBe(403)
    expect(f.requests[0]!.result.status).toBe("denied")
    expect(f.requests[0]!.result).not.toHaveProperty("value")
  } finally { await f.dispose() }
})
