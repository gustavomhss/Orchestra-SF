import { expect, test } from "bun:test"
import { createReviewReadBoundaryFixture } from "./review-read-boundary-fixture.ts"

test("C05 persistent shared evidence outage remains unavailable before boolean source gates", async () => {
  const f = await createReviewReadBoundaryFixture()
  const resolve = f.fixture.evidence.resolve
  let calls = 0
  try {
    expect(await f.fixture.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(true)
    f.fixture.evidence.resolve = async (...args: Parameters<typeof resolve>) => {
      const result = await resolve(...args)
      calls += 1
      return { ...result, state: "unavailable" as const }
    }
    // This shared dependency is also called inside the fixture's actual
    // authorizeSections/revalidate gates, not only by the isolated consumer.
    for (const services of [f.fixture.services, f.services]) {
      expect(await services.reviews.read(f.fixture.review.id, f.fixture.author)).toEqual({ status: "unavailable", reason: "review-read-unavailable" })
      const pin = await services.threadContext.read(f.pin, f.basis, f.fixture.author)
      expect(pin.status).toBe("unavailable")
      expect(pin).not.toHaveProperty("value")
    }
    for (const mode of ["review-read", "review-thread-context"] as const) {
      const response = await f.send(mode)
      expect(response.status).toBe(503)
      expect(response.body.status).toBe("unavailable")
      expect(response.body).not.toHaveProperty("value")
    }
    expect(calls).toBeGreaterThan(0)
    f.fixture.evidence.resolve = resolve
    expect(await f.fixture.services.reviews.read(f.fixture.review.id, f.fixture.author)).toEqual({ status: "ok", value: f.fixture.review })
    expect(await f.fixture.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(true)
    expect((await f.send("review-read")).status).toBe(200)
    expect((await f.send("review-thread-context")).body).toEqual({ status: "ok", value: f.pin })
  } finally { f.fixture.evidence.resolve = resolve; await f.dispose() }
}, 120000)

// Same 120000 budget as the existing real C05/recipient fixture journeys.
for (const fault of ["throw", "unavailable", "stale"] as const) {
  test(`C05 evidence ${fault} remains unavailable through services, pin and HTTP`, async () => {
    const f = await createReviewReadBoundaryFixture()
    try {
      expect(await f.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(true)
      f.evidence.fault = fault
      const read = await f.services.reviews.read(f.fixture.review.id, f.fixture.author)
      expect(read.status).toBe("unavailable")
      expect(read).not.toHaveProperty("value")
      expect(f.evidence.calls).toBeGreaterThan(0)
      const pin = await f.services.threadContext.read(f.pin, f.basis, f.fixture.author)
      expect(pin.status).toBe("unavailable")
      expect(pin).not.toHaveProperty("value")
      for (const mode of ["review-read", "review-thread-context"] as const) {
        const response = await f.send(mode)
        expect(response.status).toBe(503)
        expect(response.body.status).toBe("unavailable")
        expect(response.body).not.toHaveProperty("value")
      }
      f.evidence.fault = ""
      expect(await f.services.reviews.read(f.fixture.review.id, f.fixture.author)).toEqual({ status: "ok", value: f.fixture.review })
      expect(await f.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(true)
      expect((await f.send("review-thread-context")).body).toEqual({ status: "ok", value: f.pin })
    } finally { await f.dispose() }
  }, 120000)
}

test("C05 explicit revoked evidence is denied through services, pin and HTTP", async () => {
  const f = await createReviewReadBoundaryFixture()
  try {
    expect(await f.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(true)
    f.evidence.fault = "revoked"
    const read = await f.services.reviews.read(f.fixture.review.id, f.fixture.author)
    expect(read.status).toBe("denied")
    expect(read).not.toHaveProperty("value")
    expect(await f.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(false)
    expect(f.evidence.calls).toBeGreaterThan(0)
    for (const mode of ["review-read", "review-thread-context"] as const) {
      const response = await f.send(mode)
      expect(response.status).toBe(403)
      expect(response.body.status).toBe("denied")
      expect(response.body).not.toHaveProperty("value")
    }
  } finally { await f.dispose() }
}, 120000)

for (const kind of ["missing", "identity"] as const) {
  test(`C05 actual storage target ${kind} invalidates the preserved pin`, async () => {
    const f = await createReviewReadBoundaryFixture()
    try {
      expect(await f.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(true)
      expect((await f.send("review-thread-context")).status).toBe(200)
      await f.alterTarget(kind)
      const read = await f.services.reviews.read(f.fixture.review.id, f.fixture.author)
      expect(read).toEqual({ status: "denied", reason: "review-target-changed" })
      expect(await f.services.threadContext.authorize(f.pin, f.basis, f.fixture.author)).toBe(false)
      for (const mode of ["review-read", "review-thread-context"] as const) {
        const response = await f.send(mode)
        expect(response.status).toBe(403)
        expect(response.body.status).toBe("denied")
        expect(response.body).not.toHaveProperty("value")
      }
    } finally { await f.dispose() }
  }, 120000)
}

for (const mode of ["review-read", "review-thread-context", "review-closure"] as const) {
  test(`${mode} admission unavailability is not converted to authorization loss`, async () => {
    const f = await createReviewReadBoundaryFixture()
    try {
      const closureRef = mode === "review-closure" ? await f.close() : undefined
      expect((await f.send(mode, closureRef)).status).toBe(200)
      for (const fault of ["unavailable", "throw"] as const) {
        f.admission.fault = fault
        const response = await f.send(mode, closureRef)
        expect(response.status).toBe(503)
        expect(response.body.status).toBe("unavailable")
        expect(response.body).not.toHaveProperty("value")
      }
      expect(f.admission.calls).toBe(2)
      f.admission.fault = ""
      expect((await f.send(mode, closureRef)).status).toBe(200)
      f.fixture.actors.person!.enabled = false
      const revoked = await f.send(mode, closureRef)
      expect(revoked.status).toBe(403)
      expect(revoked.body.status).toBe("denied")
      expect(revoked.body).not.toHaveProperty("value")
    } finally { await f.dispose() }
  }, 120000)
}
