import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { bridgeFixture, holdSdkClose, beforeSettlement } from "./bridge-fixture.ts"

test("bridge pins its input before the first configuration await", async () => {
  const fixture = await bridgeFixture("configuration", { pauseConfiguration: true })
  const payload = fixture.payload()
  const original = structuredClone(payload)
  const pending = fixture.bridge.call(fixture.context, fixture.descriptor.id, payload)
  try {
    await beforeSettlement(fixture.configuration.entered, pending)
    payload.purpose = "MUTATED_AFTER_CALL"
    payload.selectionRefs.push("other-selection")
    payload.period.end = "2026-02-28"
    fixture.configuration.release()
    const answer = await pending
    expect(answer.status).toBe("ok")
    if (answer.status !== "ok") throw new Error(`Bridge refused snapshot: ${answer.reason}`)
    expect(fixture.inputs).toEqual([original])
    expect(answer.receipt.inputDigest).toBe(digestSfValue(original))
    expect(fixture.captures).toHaveLength(1)
    expect(fixture.captures[0]![1]).toEqual(original)
    expect(fixture.finishes).toHaveLength(1)
    expect(await fixture.registry.revalidate(fixture.finishes[0]!)).toBe(false)
    expect(JSON.stringify(answer)).not.toContain("MUTATED_AFTER_CALL")
  } finally {
    fixture.configuration.release()
    await pending.catch(() => undefined)
  }
})

for (const held of ["client", "server"] as const) {
  test(`bridge preserves wire result, receipt and capture while producer aliases change during ${held}.close`, async () => {
    const fixture = await bridgeFixture(`result-${held}`)
    const lifecycle = holdSdkClose(held)
    const payload = fixture.payload()
    const original = structuredClone(payload)
    const pending = fixture.bridge.call(fixture.context, fixture.descriptor.id, payload)
    try {
      await beforeSettlement(lifecycle.entered, pending)
      const emitted = fixture.emitted.result
      if (!emitted || emitted.status !== "ok" || emitted.receipt.kind !== "native") throw new Error("Missing synthetic domain result")
      const verified = structuredClone(emitted)
      fixture.output.accessRevision = "MUTATED_DOMAIN_RESULT"
      emitted.outputRef = "MUTATED_OUTPUT_REF"
      emitted.receipt.resultDigest = "e".repeat(64)
      emitted.receipt.inputDigest = "f".repeat(64)
      emitted.receipt.runId = "MUTATED_RUN_ID"
      payload.purpose = "MUTATED_CAPTURE_INPUT"
      payload.selectionRefs.push("other-selection")
      expect(fixture.captures).toHaveLength(0)
      expect(fixture.finishes).toHaveLength(0)
      lifecycle.release()
      const answer = await pending
      expect(answer).toEqual(verified)
      if (answer.status !== "ok") throw new Error(`Bridge refused unchanged authority: ${answer.reason}`)
      expect(answer.receipt.inputDigest).toBe(digestSfValue(original))
      expect(answer.receipt.resultDigest).toBe(digestSfValue(answer.result))
      expect(fixture.captures).toHaveLength(1)
      expect(fixture.captures[0]![1]).toEqual(original)
      expect(fixture.captures[0]![2]).toEqual(verified)
      expect(fixture.inputs).toEqual([original])
      expect(lifecycle.completed).toEqual({ client: 1, server: 1 })
      expect(fixture.finishes).toHaveLength(1)
      expect(await fixture.registry.revalidate(fixture.finishes[0]!)).toBe(false)
      expect(fixture.registry.requestFor(fixture.finishes[0]!)).toBeUndefined()
      expect(JSON.stringify(answer)).not.toContain("MUTATED_")
    } finally {
      lifecycle.release()
      await pending.catch(() => undefined)
      lifecycle.restore()
    }
  })
}

test("observer receives detached input and output without changing the caller's result", async () => {
  const fixture = await bridgeFixture("observer", { capture: (payload, result) => {
    if (payload && typeof payload === "object" && "purpose" in payload) payload.purpose = "MUTATED_OBSERVER_INPUT"
    if (result.status === "ok") {
      result.outputRef = "MUTATED_OBSERVER_OUTPUT"
      result.receipt.resultDigest = "e".repeat(64)
    }
  } })
  const payload = fixture.payload()
  const original = structuredClone(payload)
  const answer = await fixture.bridge.call(fixture.context, fixture.descriptor.id, payload)
  expect(answer.status).toBe("ok")
  if (answer.status !== "ok") throw new Error(`Bridge refused capture: ${answer.reason}`)
  expect(answer.outputRef).toBe("synthetic-output-observer")
  expect(answer.receipt.inputDigest).toBe(digestSfValue(original))
  expect(answer.receipt.resultDigest).toBe(digestSfValue(answer.result))
  expect(payload).toEqual(original)
  expect(JSON.stringify(answer)).not.toContain("MUTATED_OBSERVER")
})

test("raw identity and token arguments are rejected without domain execution or reflected credentials", async () => {
  const fixture = await bridgeFixture("raw-authority")
  const secret = "SYNTHETIC_SECRET_CANARY_DO_NOT_RETURN"
  const answer = await fixture.bridge.call(fixture.context, fixture.descriptor.id, {
    ...fixture.payload(), actorId: "other-person", projectId: "other-project", token: secret,
  })
  expect(answer.status).toBe("denied")
  expect(answer.receipt.kind).toBe("unbound")
  expect(fixture.inputs).toHaveLength(0)
  expect(fixture.captures).toHaveLength(0)
  expect(JSON.stringify(answer)).not.toContain(secret)
  expect(Object.hasOwn(answer, "result")).toBe(false)
})

test("uncloneable and nonfinite inputs fail closed before any domain call", async () => {
  const fixture = await bridgeFixture("invalid-input")
  for (const extra of [{ callback: () => "synthetic-secret" }, { value: Number.POSITIVE_INFINITY }]) {
    const answer = await fixture.bridge.call(fixture.context, fixture.descriptor.id, { ...fixture.payload(), ...extra })
    expect(answer.status).toBe("denied")
    expect(answer.receipt.kind).toBe("unbound")
    expect(JSON.stringify(answer)).not.toContain("synthetic-secret")
  }
  expect(fixture.inputs).toHaveLength(0)
  expect(fixture.captures).toHaveLength(0)
  expect(fixture.finishes).toHaveLength(0)
})
