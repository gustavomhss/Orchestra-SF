import { expect, test } from "bun:test"
import { isDeepStrictEqual } from "node:util"
import { Effect } from "effect"
import { createSfRoutineNativeOrigin } from "../../../../../../apps/cli/src/sucafina-product/routine-native-origin.ts"
import type { SfRoutineNativeOriginalAdmission } from "../../../../../../apps/cli/src/sucafina-product/routine-native-origin.ts"
import { ids } from "../routine-native-owner-binding/fixture.ts"
import { withAdmissionFixture, type AdmissionFixture } from "../native-admission-closure/fixture.ts"

/**
 * COMPONENT PROOF ONLY. The original UI Request, core Task frame, C15 policy, admission, plan,
 * human answer and provider settlement are synthetic. SQLite and the canonical owner/64 hooks are
 * exercised, but no installed native Maestro, provider, Relay or historical consumer is proved.
 */
const make = (f: AdmissionFixture) => {
  const state = { ready: true, native: true }
  const native = new AbortController()
  const source: SfRoutineNativeOriginalAdmission = {
    request: f.state.request, context: f.uiContext, authoritySessionID: ids.parent,
    intent: f.expectedIntent, signal: f.nativeController.signal,
    current: async () => f.admissionState.nativeCurrent,
    nativePolicy: { signal: native.signal, current: async () => state.native },
  }
  const bridge = createSfRoutineNativeOrigin({
    ready: () => state.ready, resources: () => f.state.resources,
    requestFor: (context) => context === f.state.context ? f.state.request : undefined,
    authorize: async (context) => context === f.state.context && f.state.authorized,
    authorizeIntent: async (context, intent) => context === f.state.context &&
      f.admissionState.intentAuthorized && isDeepStrictEqual(intent, f.expectedIntent),
    generation: async () => f.state.generation, now: () => f.state.now,
  })
  f.admissionState.origin = bridge.origin
  return { state, native, source, bridge }
}

test("component: native original-Request association remains unavailable without an installed C15 owner", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = make(f)
    yield* Effect.addFinalizer(() => Effect.sync(x.bridge.dispose))
    x.state.ready = false
    expect(x.bridge.origin.ready()).toBe(false)
    expect(yield* Effect.promise(() => x.bridge.admit(x.source))).toBeUndefined()
    expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
  })))

test("component: original admission binds the exact Task intent and reference-stable origin, not IDs alone", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = make(f)
    yield* Effect.addFinalizer(() => Effect.sync(x.bridge.dispose))
    const release = yield* Effect.promise(() => x.bridge.admit(x.source))
    expect(typeof release).toBe("function")
    const first = yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))
    expect(first?.request).toBe(f.state.request)
    expect(first?.authoritySessionID).toBe(ids.parent)
    expect(first?.context).toBe(f.uiContext)
    expect(first?.intent).toEqual(f.expectedIntent)
    expect(Object.isFrozen(first)).toBe(true)
    expect(Object.isFrozen(first?.intent.caseRef)).toBe(true)
    expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBe(first)
    expect(yield* Effect.promise(() => x.bridge.origin.resolve({ ...f.invocation,
      args: { ...f.invocation.args, authorizationID: "authorization-forged" } }))).toBeUndefined()
    expect(yield* Effect.promise(() => x.bridge.origin.resolve({ ...f.invocation,
      args: { ...f.invocation.args, workflow: { planRevisionID: "revision-forged" } } }))).toBeUndefined()
    expect(yield* Effect.promise(() => x.bridge.admit(x.source))).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
    release?.()
    expect(first?.signal.aborted).toBe(true)
    expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBeUndefined()
  })))

test("component: the admitted bridge reuses 64's genuine hook boundary without dispatching a Task", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = make(f)
    yield* Effect.addFinalizer(() => Effect.sync(x.bridge.dispose))
    const release = yield* Effect.promise(() => x.bridge.admit(x.source))
    expect(release).toBeDefined()
    const observed = { original: 0 }
    const value = yield* f.enter(Effect.sync(() => ++observed.original))
    expect(value).toBe(1)
    expect(observed.original).toBe(1)
    expect(f.trace.bindAttempts).toBe(1)
    expect(f.trace.binds).toBe(1)
    expect(f.trace.releases).toBe(1)
    expect(f.registry.owners.available()).toBe(false)
    release?.()
    expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBeUndefined()
  })))

test("component: C15 revocation aborts origin and cannot revive historical authority", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = make(f)
    yield* Effect.addFinalizer(() => Effect.sync(x.bridge.dispose))
    expect(yield* Effect.promise(() => x.bridge.admit(x.source))).toBeDefined()
    const original = yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))
    expect(original).toBeDefined()
    x.native.abort()
    expect(original?.signal.aborted).toBe(true)
    expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBeUndefined()
    expect(yield* Effect.promise(() => x.bridge.admit(x.source))).toBeUndefined()
  })))

test("component: generation drift, exact intent withdrawal, expiry and lifecycle each refuse current authority", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    for (const change of [
      (x: ReturnType<typeof make>) => { f.state.generation = 3 },
      (x: ReturnType<typeof make>) => { f.admissionState.intentAuthorized = false },
      (x: ReturnType<typeof make>) => { f.state.now += 301_000 },
      (x: ReturnType<typeof make>) => { x.bridge.revoke(f.state.request) },
      (x: ReturnType<typeof make>) => { x.bridge.invalidateGeneration(2) },
      (x: ReturnType<typeof make>) => { x.bridge.dispose() },
    ]) {
      f.state.generation = 2
      f.state.now = Date.now()
      f.admissionState.intentAuthorized = true
      const x = make(f)
      const release = yield* Effect.promise(() => x.bridge.admit(x.source))
      expect(release).toBeDefined()
      const binding = yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))
      expect(binding).toBeDefined()
      change(x)
      expect(yield* Effect.promise(() => binding!.current())).toBe(false)
      expect(binding?.signal.aborted).toBe(true)
      expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBeUndefined()
      release?.()
      x.bridge.dispose()
    }
    expect(f.registry.owners.available()).toBe(false)
  })))

test("component: a different Request, a non-native target and a denied native policy cannot stage authority", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = make(f)
    yield* Effect.addFinalizer(() => Effect.sync(x.bridge.dispose))
    expect(yield* Effect.promise(() => x.bridge.admit({ ...x.source,
      request: new Request(f.state.request.url, { method: "POST" }) }))).toBeUndefined()
    const fakeContext = f.nativeContext
    expect(yield* Effect.promise(() => x.bridge.admit({ ...x.source,
      context: fakeContext as unknown as SfRoutineNativeOriginalAdmission["context"] }))).toBeUndefined()
    x.state.native = false
    expect(yield* Effect.promise(() => x.bridge.admit(x.source))).toBeUndefined()
    expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBeUndefined()
  })))

test("component: explicit revoke and disposal cancel an origin admission still acquiring C15 authority", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    for (const cancel of ["revoke", "dispose"] as const) {
      const x = make(f)
      let entered = () => {}
      let release = () => {}
      const enteredPromise = new Promise<void>((resolve) => { entered = resolve })
      const held = new Promise<boolean>((resolve) => { release = () => resolve(true) })
      const source: SfRoutineNativeOriginalAdmission = { ...x.source,
        nativePolicy: { ...x.source.nativePolicy, current: async () => { entered(); return held } } }
      const attempting = x.bridge.admit(source)
      yield* Effect.promise(() => enteredPromise)
      if (cancel === "revoke") x.bridge.revoke(f.state.request)
      if (cancel === "dispose") x.bridge.dispose()
      expect(yield* Effect.promise(() => attempting)).toBeUndefined()
      release()
      expect(yield* Effect.promise(() => x.bridge.origin.resolve(f.invocation))).toBeUndefined()
      expect(f.registry.owners.available()).toBe(false)
      x.bridge.dispose()
    }
  })))
