import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { observeSfStaleRun } from "../../../../product/ai/run-store.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority, SfStateNamespace } from "../../../../product/contracts/state.ts"
import { object } from "../../../../runtime/contract.ts"
import { analysisLifecycleFixture } from "./analysis-lifecycle-fixture.ts"

test("real lifecycle authority settles non-executing states after source loss without granting fresh data or replay", async () => {
  const f = await analysisLifecycleFixture()
  try {
    await f.changeSource()
    const currentCase = await f.authority.state.read(f.request, "cases", (state) => state.cases[f.run.caseRef.id])
    if (currentCase.status !== "ok" || !currentCase.value) throw new Error("Case unavailable")
    const advanced = { ...currentCase.value, version: 2 }
    expect((await f.authority.state.transaction(f.request, { namespace: "cases", expectedStorageVersion: currentCase.storageVersion,
      targetRef: `case:${f.run.caseRef.id}:${f.run.caseRef.incarnation}`, targetIncarnation: f.run.caseRef.incarnation,
      idempotencyKey: "advance-case", commandDigest: digestSfValue(advanced) }, async (state) => {
      state.cases[f.run.caseRef.id] = advanced
      return { commit: true, value: true }
    })).status).toBe("ok")
    let retained: TrustedDomainContext | undefined
    for (const [index, state] of (["failed", "unavailable", "needs-input"] as const).entries()) {
      const original = { ...f.run, version: f.run.version + index * 2 }
      await f.seed(original)
      const result = await f.lifecycle.withContext(f.run.runRef, async (call) => {
        retained = call
        expect(f.authority.host.requestFor(call)).toBe(f.request)
        expect(f.replayContexts.has(call)).toBe(false)
        expect((await f.business.selectedCase(call)).status).toBe("unavailable")
        expect((await f.store.read(f.run.runRef, call)).status).toBe("stale")
        expect(await f.store.preserveStale(f.run.runRef, "lost-source", f.output, call))
          .toEqual({ status: "denied", reason: "analysis-lifecycle-content-unavailable" })
        expect((await f.store.publish(f.run.runRef, original.version, f.output, call)).status).not.toBe("ok")
        return f.store.transition(f.run.runRef, original.version, state, "provider-result-unavailable", call)
      })
      expect(result).toMatchObject({ status: "ok", value: { state, version: original.version + 1, caseRef: { version: 1 } } })
      expect(await f.read()).toMatchObject({ status: "ok", value: { run: { state }, output: undefined } })
      if (!retained) throw new Error("No lifecycle scope")
      expect(f.authority.host.requestFor(retained)).toBeUndefined()
      expect(f.lifecycle.owns(retained)).toBe(false)
    }
    expect(f.counts.sources).toBe(0)
  } finally { await f.dispose() }
}, 120_000)

test("lifecycle forwards an isolated stale observation and retains only the exact already-stored output under CAS", async () => {
  const f = await analysisLifecycleFixture()
  try {
    await f.changeSource()
    const ready = { ...f.run, state: "ready" as const, version: f.run.version + 1, outputRef: f.output.id }
    await f.seed(ready, true)
    const observation = observeSfStaleRun(f.run, { outputRef: f.output.id, outputDigest: digestSfValue(f.output) })
    const supplied = { ...observation, publication: { ...observation.publication } }
    const read = f.authority.state.read
    let armed = false
    f.authority.state.read = async <Value>(request: Request, namespace: SfStateNamespace,
      callback: (state: Readonly<SfProductState>, actor: SfStateAuthority) => Value | Promise<Value>) => {
      if (armed) { armed = false; supplied.publication.outputDigest = "0".repeat(64) }
      return read(request, namespace, callback)
    }
    expect(await f.lifecycle.withContext(f.run.runRef, async (call) => {
      armed = true
      return f.store.markStale(f.run.runRef, "source-changed-after-publication", call, supplied)
    })).toMatchObject({ status: "ok", value: { state: "stale", version: ready.version + 1, outputRef: f.output.id } })
    expect(supplied.publication.outputDigest).toBe("0".repeat(64))
    const saved = await f.read()
    expect(saved.status === "ok" && digestSfValue(saved.value.output)).toBe(digestSfValue(f.output))
    expect(f.counts.sources).toBe(0)
    expect(f.counts.preflight).toBe(0)

    await f.seed(ready, true)
    expect(await f.lifecycle.withContext(f.run.runRef, (call) => f.store.markStale(f.run.runRef, "unobserved", call)))
      .toEqual({ status: "conflict", reason: "invalid-run-transition" })
    expect(await f.lifecycle.withContext(f.run.runRef, (call) => f.store.markStale(f.run.runRef, "changed", call,
      { ...observation, publication: { ...observation.publication, outputDigest: "f".repeat(64) } })))
      .toEqual({ status: "denied", reason: "stale-output-access-unavailable" })
    expect(await f.read()).toMatchObject({ status: "ok", value: { run: ready, output: f.output } })
    await f.seed({ ...f.run, state: "cancelled", version: f.run.version + 1, reason: "human-cancelled" })
    expect((await f.lifecycle.withContext(f.run.runRef, (call) => f.store.markStale(f.run.runRef, "late", call, observation))).status).toBe("conflict")
    expect(await f.read()).toMatchObject({ status: "ok", value: { run: { state: "cancelled" }, output: undefined } })
  } finally { await f.dispose() }
}, 120_000)

test("lifecycle rejects current authority loss, released leases, changed case identity and abort without metadata writes", async () => {
  const abort = new AbortController()
  const f = await analysisLifecycleFixture({ signal: abort.signal })
  try {
    await f.changeSource()
    for (const revoke of [() => { f.active.access = false }, (call: TrustedDomainContext) => { f.authority.human.finish(call) }]) {
      f.hooks.commit = async (call) => revoke(call)
      expect((await f.lifecycle.withContext(f.run.runRef, (call) => f.store.markStale(f.run.runRef, "late", call))).status).not.toBe("ok")
      f.active.access = true
      f.hooks.commit = undefined
      expect(await f.read()).toMatchObject({ status: "ok", value: { run: f.run, output: undefined } })
    }
    expect((await f.lifecycle.withContext("another-run", async () => ({ status: "ok", value: true }))).status).toBe("denied")
    for (const replacement of [{ participants: [] }, { incarnation: "replacement-incarnation" }]) {
      await f.persistence.transaction("dashboard", async (snapshot) => {
        const state = object(snapshot.data.__sfProductV1)
        const cases = object(state.cases)
        cases[f.run.caseRef.id] = { ...object(cases[f.run.caseRef.id]), ...replacement }
        return { commit: true, value: undefined }
      })
      expect((await f.lifecycle.withContext(f.run.runRef, (call) => f.store.markStale(f.run.runRef, "late", call))).status).toBe("denied")
      await f.persistence.transaction("dashboard", async (snapshot) => {
        const cases = object(object(snapshot.data.__sfProductV1).cases)
        cases[f.run.caseRef.id] = { ...object(cases[f.run.caseRef.id]), incarnation: f.run.caseRef.incarnation, participants: [f.run.principalRef] }
        return { commit: true, value: undefined }
      })
    }
    f.active.host = false
    expect((await f.lifecycle.withContext(f.run.runRef, async () => ({ status: "ok", value: true }))).status).toBe("denied")
    f.active.host = true
    expect((await f.lifecycle.withContext(f.run.runRef, async (call) => {
      abort.abort()
      return f.store.markStale(f.run.runRef, "aborted", call)
    })).status).not.toBe("ok")
    const persisted = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
      value: object(object(snapshot.data.__sfProductV1).nativeRuns)[f.run.runRef] }))
    expect(persisted).toEqual(f.run)
  } finally { await f.dispose() }
}, 120_000)

test("lifecycle cannot substitute for the separate current human cancellation intent", async () => {
  const f = await analysisLifecycleFixture()
  try {
    await f.changeSource()
    expect((await f.lifecycle.withContext(f.run.runRef, (call) => f.store.transition(f.run.runRef, f.run.version, "cancelled", "human-cancelled", call))).status).toBe("denied")
    expect(await f.read()).toMatchObject({ status: "ok", value: { run: f.run } })
    const admitted = await f.authority.human.admit(f.request, "analysis.cancel", { runRef: f.run.runRef })
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    try {
      expect(f.lifecycle.owns(admitted.value)).toBe(false)
      expect(await f.store.transition(f.run.runRef, f.run.version, "cancelled", "human-cancelled", admitted.value))
        .toMatchObject({ status: "ok", value: { state: "cancelled", version: f.run.version + 1 } })
    } finally { f.authority.human.finish(admitted.value) }
    expect(await f.read()).toMatchObject({ status: "ok", value: { run: { state: "cancelled" }, output: undefined } })
    expect(f.counts.sources).toBe(0)
  } finally { await f.dispose() }
}, 120_000)
