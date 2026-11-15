import { expect, test } from "bun:test"
import { Effect } from "effect"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createSfRoutineNativeOrigin } from "../../../../../../apps/cli/src/sucafina-product/routine-native-origin.ts"
import type { SfRoutineNativeOriginalAdmission } from "../../../../../../apps/cli/src/sucafina-product/routine-native-origin.ts"
import type { SfRoutineNativeHistoricalAuthority } from "../../../../../../apps/cli/src/sucafina-product/routine-native-registry.ts"
import { ids } from "../routine-native-owner-binding/fixture.ts"
import { withAdmissionFixture } from "../native-admission-closure/fixture.ts"

// The original Request/lease must bound pending attestations, before any binding is published.
test("pending native admission expires during the first unresolved C15 reader", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const beganAt = Date.now()
    f.state.now = beganAt
    const context = { ...f.uiContext, binding: {
      ...f.uiContext.binding, expiresAt: new Date(beganAt + 400).toISOString(),
    } }
    f.state.context = context
    const bridge = createSfRoutineNativeOrigin({
      ready: () => true,
      resources: () => f.state.resources,
      requestFor: (incoming) => incoming === context ? f.state.request : undefined,
      authorize: async (incoming) => incoming === context && f.state.authorized,
      authorizeIntent: async () => true,
      generation: async () => f.state.generation,
      now: () => f.state.now,
    })
    yield* Effect.addFinalizer(() => Effect.sync(bridge.dispose))
    const blocked = new Promise<boolean>(() => {})
    const source: SfRoutineNativeOriginalAdmission = {
      request: f.state.request, context, authoritySessionID: ids.parent,
      intent: f.expectedIntent, signal: f.nativeController.signal,
      current: async () => blocked,
      nativePolicy: { signal: new AbortController().signal, current: async () => true },
    }
    expect(yield* Effect.promise(() => bridge.admit(source))).toBeUndefined()
    expect(yield* Effect.promise(() => bridge.origin.resolve(f.invocation))).toBeUndefined()
  })))

test("pending historical read expires before attestation, with zero egress or Task authority", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const beganAt = Date.now()
    f.state.now = beganAt
    const request = new Request("https://sf-fixture.invalid/routines/history", { method: "GET" })
    const ui = f.ui()
    const context: TrustedUiContext = { ...ui, binding: {
      ...ui.binding, expiresAt: new Date(beganAt + 400).toISOString(),
    } }
    f.state.request = request
    f.state.context = context
    const blocked = new Promise<boolean>(() => {})
    const evidence: SfRoutineNativeHistoricalAuthority = {
      authoritySessionID: ids.parent, signal: new AbortController().signal,
      current: async () => blocked,
    }
    let exposed = false
    const result = yield* Effect.promise(() => f.registry.withReauthenticatedRead(context, request, evidence,
      async () => { exposed = true; return "restricted" }))
    expect(result).toBeUndefined()
    expect(exposed).toBe(false)
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* Effect.promise(() => f.registry.owners.resolve(context, request))).toBeUndefined()
  })))
