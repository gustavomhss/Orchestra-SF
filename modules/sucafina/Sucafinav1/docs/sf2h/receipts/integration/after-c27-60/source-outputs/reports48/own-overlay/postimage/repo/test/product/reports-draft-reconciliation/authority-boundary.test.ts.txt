import { expect, test } from "bun:test"
import { createReadBoundaryFixture, discussionFailure } from "./read-boundary-fixture.ts"

for (const fault of ["throw", "unavailable", "stale"] as const) {
  test(`evidence ${fault} cannot become an affirmative source revocation`, async () => {
    const f = await createReadBoundaryFixture("base")
    try {
      f.evidence.fault = fault
      const failure = await discussionFailure(f.read())
      expect(failure.kind).toBe("recoverable")
      expect(failure.outcome).toBe("unknown")
      expect(f.evidence.calls).toBeGreaterThan(0)
      expect(f.lost).toEqual([])
      expect(f.requests[0]!.status).toBe(503)
      expect(f.requests[0]!.result.status).toBe("unavailable")
      expect(f.requests[0]!.result).not.toHaveProperty("value")
      f.evidence.fault = ""
      const current = await f.read() as { messages: { body: string }[] }
      expect(current.messages.map((message) => message.body)).toEqual(["Explain this exact source."])
      expect(f.requests.map((request) => request.mode)).toEqual(["collaboration-thread-read", "collaboration-thread-read"])
      expect(f.lost).toEqual([])
    } finally { await f.dispose() }
  })
}

test("an explicit revoked evidence result is denied through the real authority and HTTP adapters", async () => {
  const f = await createReadBoundaryFixture("base")
  try {
    f.evidence.fault = "revoked"
    expect((await discussionFailure(f.read())).kind).toBe("access")
    expect(f.evidence.calls).toBeGreaterThan(0)
    expect(f.lost).toEqual(["access"])
    expect(f.requests[0]!.status).toBe(403)
    expect(f.requests[0]!.result.status).toBe("denied")
    expect(f.requests[0]!.result).not.toHaveProperty("value")
    f.evidence.fault = ""
    expect((await discussionFailure(f.read())).kind).toBe("access")
    expect(f.requests).toHaveLength(1)
    expect(f.lost).toEqual(["access"])
  } finally { await f.dispose() }
})

test("a read admission exception is unavailable instead of a fabricated denial", async () => {
  const f = await createReadBoundaryFixture("base")
  try {
    f.admission.unavailable = true
    const failure = await discussionFailure(f.read())
    expect(failure.kind).toBe("recoverable")
    expect(failure.outcome).toBe("unknown")
    expect(f.requests[0]!.status).toBe(503)
    expect(f.requests[0]!.result).toEqual({ status: "unavailable", reason: "collaboration-authority-unavailable" })
    expect(f.lost).toEqual([])
    f.admission.unavailable = false
    const current = await f.read() as { id: string }
    expect(current.id).toBe(f.question.id)
    expect(f.requests).toHaveLength(2)
    expect(f.lost).toEqual([])
  } finally { await f.dispose() }
})

test("the legacy ambiguous unavailable reason is not affirmative proof of revocation", async () => {
  const f = await createReadBoundaryFixture("base")
  try {
    f.io.armed = true; f.io.failSecond = true; f.io.failureReason = "thread-access-unavailable"
    const failure = await discussionFailure(f.read())
    expect(failure.kind).toBe("recoverable")
    expect(failure.outcome).toBe("unknown")
    expect(f.io.reads).toBe(2)
    expect(f.requests[0]!.status).toBe(503)
    expect(f.requests[0]!.result).toEqual({ status: "unavailable", reason: "thread-access-unavailable" })
    expect(f.lost).toEqual([])
    const current = await f.read() as { id: string }
    expect(current.id).toBe(f.question.id)
    expect(f.requests).toHaveLength(2)
    expect(f.lost).toEqual([])
  } finally { await f.dispose() }
})
