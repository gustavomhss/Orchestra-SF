import { expect, test } from "bun:test"
import { Effect } from "effect"
import type { SfRoutineNativeHistoricalAuthority } from "../../../../../../apps/cli/src/sucafina-product/routine-native-registry.ts"
import { ids } from "../routine-native-owner-binding/fixture.ts"
import { withAdmissionFixture, type AdmissionFixture } from "../native-admission-closure/fixture.ts"

/**
 * COMPONENT ONLY: persisted native records are real, but origin and provider/session evidence
 * are fixture-issued. These checks do not demonstrate installed C15, Task execution or AM06.
 */
const freshRead = (f: AdmissionFixture) => {
  const controller = new AbortController()
  const request = new Request("https://sf-fixture.invalid/routines/history/reauthorized", {
    method: "GET", signal: controller.signal,
    headers: { "x-sf-fixture-actor": f.binding.principalRef },
  })
  const context = f.ui()
  f.state.request = request
  f.state.context = context
  const native = new AbortController()
  const evidence: SfRoutineNativeHistoricalAuthority = {
    authoritySessionID: ids.parent, signal: native.signal,
    current: async (incoming, incomingRequest) => incoming === context && incomingRequest === request,
  }
  return { controller, request, context, native, evidence }
}

test("native historical registry returns a successful read result without minting Task authority", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = freshRead(f)
    const observed = yield* Effect.promise(() => f.registry.withReauthenticatedRead(
      x.context, x.request, x.evidence, async () => {
        const owner = await f.registry.owners.resolve(x.context, x.request)
        return { status: "ok" as const, hasTask: owner?.task !== undefined, matchesRequest: owner?.request === x.request }
      },
    ))
    expect(observed?.status).toBe("ok")
    expect(observed?.hasTask).toBe(false)
    expect(observed?.matchesRequest).toBe(true)
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* Effect.promise(() => f.registry.owners.resolve(x.context, x.request))).toBeUndefined()
  })))

test("reauthorized native history accepts canonical reservation and its validated authorization event", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = freshRead(f)
    // Keep assertions OUTSIDE the callback: observeSfRoutineNative intentionally suppresses
    // thrown reader errors, which otherwise collapse the first refusal into undefined.
    const observed = yield* Effect.promise(() => f.registry.withReauthenticatedRead(
      x.context, x.request, x.evidence, async () => {
        const admitted = await f.resources.records.readAdmission(ids.authorization)
        const port = f.adapter.native()
        const byAuthorization = await port?.readAdmission(ids.authorization, x.context)
        const byReservation = admitted ? await port?.readAdmission(admitted.reference, x.context) : undefined
        const owner = await f.registry.owners.resolve(x.context, x.request)
        return {
          authorizationID: admitted?.authorizationID, canonicalReference: admitted?.reference,
          byAuthorization, byReservation, task: owner?.task,
        }
      },
    ))
    expect(observed).toBeDefined()
    expect(observed?.authorizationID).toBe(ids.authorization)
    expect(observed?.canonicalReference).toBeDefined()
    expect(observed?.canonicalReference).not.toBe(ids.authorization)
    // Both IDs are native events validated against the same authorization chain.
    // A read never grants Task invocation; identity/case/source/publication checks remain mandatory.
    expect(observed?.byReservation?.status).toBe("ok")
    expect(observed?.byAuthorization?.status).toBe("ok")
    expect(observed?.task).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
  })))

test("disposing a live historical read blocks egress and does not reconstruct native Task", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = freshRead(f)
    const observed = yield* Effect.promise(() => f.registry.withReauthenticatedRead(
      x.context, x.request, x.evidence, async () => {
        const owner = await f.registry.owners.resolve(x.context, x.request)
        expect(owner?.task).toBeUndefined()
        f.registry.dispose()
        return { private: "must-not-escape" }
      },
    ))
    expect(observed).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* Effect.promise(() => f.registry.owners.resolve(x.context, x.request))).toBeUndefined()
  })))

test("late completion after revoking an in-flight historical read cannot escape", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = freshRead(f)
    const gate: { release?: (value: string) => void; entered?: () => void } = {}
    const entered = new Promise<void>((resolve) => { gate.entered = resolve })
    const delayed = new Promise<string>((resolve) => { gate.release = resolve })
    const inFlight = f.registry.withReauthenticatedRead(x.context, x.request, x.evidence, async () => {
      gate.entered?.()
      return delayed
    })
    yield* Effect.promise(() => entered)
    f.registry.revoke(x.request)
    const observed = yield* Effect.promise(() => inFlight)
    expect(observed).toBeUndefined()
    gate.release?.("late-protected-bytes")
    yield* Effect.promise(() => Promise.resolve())
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* Effect.promise(() => f.registry.owners.resolve(x.context, x.request))).toBeUndefined()
  })))
