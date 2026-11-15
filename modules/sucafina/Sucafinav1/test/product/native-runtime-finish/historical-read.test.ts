import { expect, test } from "bun:test"
import { Effect } from "effect"
import type { SfRoutineNativeHistoricalAuthority } from "../../../../../../apps/cli/src/sucafina-product/routine-native-registry.ts"
import { ids } from "../routine-native-owner-binding/fixture.ts"
import { withAdmissionFixture, type AdmissionFixture } from "../native-admission-closure/fixture.ts"

/**
 * COMPONENT ONLY. Canonical native record readers and adapter are real; user identity, persisted
 * origin attestation, native grants/Task and model execution are synthetic fixtures. This tests
 * the read-only integration boundary, NOT a restart, real provider, consumption or AM06.
 */
const newRead = (f: AdmissionFixture) => {
  const controller = new AbortController()
  const request = new Request("https://sf-fixture.invalid/routines/results", {
    method: "GET", signal: controller.signal,
    headers: { "x-sf-fixture-actor": f.binding.principalRef },
  })
  const context = f.ui()
  f.state.request = request
  f.state.context = context
  const native = new AbortController()
  const state = { current: true }
  const evidence: SfRoutineNativeHistoricalAuthority = {
    authoritySessionID: ids.parent, signal: native.signal,
    current: async (incomingContext, incomingRequest) =>
      state.current && incomingContext === context && incomingRequest === request,
  }
  return { controller, request, context, native, state, evidence }
}

test("component: no native Task owner is exposed by a new Request without trusted durable-origin evidence", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = newRead(f)
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* Effect.promise(() => f.registry.owners.resolve(x.context, x.request))).toBeUndefined()
    expect(f.adapter.native()).toBeUndefined()
  })))

test("component: fresh reauthorized read projects native admission with no Task execution authority", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = newRead(f)
    const observed = yield* Effect.promise(() => f.registry.withReauthenticatedRead(x.context, x.request, x.evidence, async () => {
      expect(f.registry.owners.available()).toBe(true)
      const owner = await f.registry.owners.resolve(x.context, x.request)
      expect(owner?.request).toBe(x.request)
      expect(owner?.authoritySessionID).toBe(ids.parent)
      expect(owner?.task).toBeUndefined()
      const port = f.adapter.native()
      expect(port).toBeDefined()
      const nativeAdmission = await port!.readAdmission(ids.authorization, x.context)
      expect(nativeAdmission.status).toBe("ok")
      return nativeAdmission
    }))
    expect(observed?.status).toBe("ok")
    expect(f.registry.owners.available()).toBe(false)
    expect(yield* Effect.promise(() => f.registry.owners.resolve(x.context, x.request))).toBeUndefined()
  })))

test("component: historical owner is read-only; no original Task invocation can be reconstructed after settlement", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = newRead(f)
    const value = yield* Effect.promise(() => f.registry.withReauthenticatedRead(x.context, x.request, x.evidence, async () => {
      const owner = await f.registry.owners.resolve(x.context, x.request)
      expect(owner?.task).toBeUndefined()
      const port = f.adapter.native()
      expect(port).toBeDefined()
      const plan = await port!.resolveRecipe(f.plan.workflowBinding.publication.documentID, x.context)
      // No provider/Task or native approval may be issued by this read-only binding.
      return { owner, plan }
    }))
    expect(value?.owner?.task).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
  })))

test("component: revocation before result return prevents historical bytes leaving the read boundary", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = newRead(f)
    const received = yield* Effect.promise(() => f.registry.withReauthenticatedRead(x.context, x.request, x.evidence, async () => {
      expect(await f.registry.owners.resolve(x.context, x.request)).toBeDefined()
      f.state.authorized = false
      return { restricted: "synthetic-protected-result" }
    }))
    expect(received).toBeUndefined()
    expect(f.registry.owners.available()).toBe(false)
  })))

test("component: request abort, native revocation, generation rotation and explicit revoke close read capability", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    for (const revoke of [
      (x: ReturnType<typeof newRead>) => x.controller.abort(),
      (x: ReturnType<typeof newRead>) => x.native.abort(),
      (x: ReturnType<typeof newRead>) => f.registry.revoke(x.request),
      (x: ReturnType<typeof newRead>) => f.registry.invalidateGeneration(2),
    ]) {
      f.state.authorized = true
      f.state.generation = 2
      const x = newRead(f)
      const outcome = yield* Effect.promise(() => f.registry.withReauthenticatedRead(x.context, x.request, x.evidence, async () => {
        revoke(x)
        return { restricted: "synthetic-protected-result" }
      }))
      expect(outcome).toBeUndefined()
      expect(f.registry.owners.available()).toBe(false)
    }
  })))

test("component: denied origin attestation, wrong native parent and duplicate same-Request readers fail closed", () =>
  withAdmissionFixture((f) => Effect.gen(function* () {
    const x = newRead(f)
    x.state.current = false
    expect(yield* Effect.promise(() => f.registry.withReauthenticatedRead(x.context, x.request,
      x.evidence, async () => "must-not-run"))).toBeUndefined()
    x.state.current = true
    const wrong = { ...x.evidence, authoritySessionID: "ses_missing" as typeof ids.parent }
    expect(yield* Effect.promise(() => f.registry.withReauthenticatedRead(x.context, x.request,
      wrong, async () => "must-not-run"))).toBeUndefined()
    const entered = { seen: false }
    const outcome = yield* Effect.promise(() => f.registry.withReauthenticatedRead(x.context, x.request, x.evidence, async () => {
      entered.seen = true
      const duplicate = await f.registry.withReauthenticatedRead(x.context, x.request, x.evidence, async () => "duplicate")
      expect(duplicate).toBeUndefined()
      return "single-read"
    }))
    expect(entered.seen).toBe(true)
    expect(outcome).toBe("single-read")
  })))
