import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { DecisionCase, CostCoverageBasis } from "../../../../product/contracts/decisions.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../../product/contracts/decisions.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateNamespace, SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { BusinessEvidenceRef, BusinessEvidenceResolution } from "../../../../product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../product/contracts/context.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createSfProductState, initializeAbsentSfProductState, selectSfPreferencesProjection } from "../../../../product/host-binding/state-provider.ts"
import { createDecisionBaselineCoverage } from "../../../../product/decisions/baseline-coverage.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Read<Value> = (state: Readonly<SfProductState>, actor: SfStateAuthority) => Value | Promise<Value>

function ok<Value>(result: SfStateResult<Value> | PortResult<Value>): Value {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

function decision(id: string): DecisionCase {
  return { id, incarnation: id + "-inc", version: 1, state: "investigating", objective: "Complete original case",
    horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", participants: ["person"],
    criteria: [{ id: "cost", description: "Observe the original amount", required: true }],
    sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [],
    preparedChanges: [], receipts: [], ledger: [] }
}

function frozenContext(): TrustedUiContext {
  // This protocol fixture supplies deterministic authority and source ports;
  // all state admission, cloning and coverage registration remain real producers.
  return Object.freeze({ kind: "ui", binding: Object.freeze({ installationId: "selector-installation", projectId: "project",
    principalRef: "person", requestId: "request", policyVersion: "policy", accessRevision: "access",
    expiresAt: "2028-01-01T00:00:00Z" }), lease: {} }) as TrustedUiContext
}

async function preferencesFixture(deadline: Deadline) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-preferences-selector-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  await initializeAbsentSfProductState(store, () => "selector-state")
  await store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.cases.selected = decision("selected")
    state.cases.other = decision("other")
    state.preferences.private = { retained: "complete preferences", amount: 12 }
    state.preferences.unrelated = { retained: "a second preference" }
    return { commit: true, value: undefined }
  })
  const actor = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }
  const control: {
    active: boolean
    actor: SfStateAuthority
    calls: { namespace: SfStateNamespace; mode: "read" | "write" }[]
    before?: (snapshot: Snapshot, count: number) => void | Promise<void>
  } = { active: true, actor: { ...actor }, calls: [] }
  const writes = new WeakSet<object>()
  const port = createSfProductState({ persistence: store, createId: randomUUID, proposalCoverageWrites: writes,
    authorize: async (_request, snapshot, namespace, mode) => {
      deadline.check()
      control.calls.push({ namespace, mode })
      await control.before?.(snapshot, control.calls.length)
      return control.active ? { ...control.actor } : undefined
    },
    resolveTarget: async (_request, snapshot, _namespace, id) => {
      const value = (snapshot.data.__sfProductV1 as SfProductState).cases[id]
      return value ? { incarnation: value.incarnation } : undefined
    },
  })
  const request = () => new Request("https://selector.example.test/read", { signal: deadline.signal })
  const reset = () => { control.active = true; control.actor = { ...actor }; control.calls = []; control.before = undefined }
  const observe = async <Value>(namespace: SfStateNamespace, read: Read<Value>, incoming = request()) => {
    try { return { value: await port.read(incoming, namespace, read) } }
    catch (error) { return { error: error instanceof Error ? { name: error.name, message: error.message } : String(error) } }
  }
  return { store, port, control, request, reset, observe, writes, call: frozenContext() }
}

test("C08 preferences projection keeps the complete fresh graph and detaches every observation", async () => {
  const deadline = compositionTestDeadline("preferences-complete-graph", 12_000)
  try {
    const f = await preferencesFixture(deadline)
    type Graph = { amount: number; self: Graph; preferences: SfProductState["preferences"] }
    const retained: SfProductState["preferences"][] = []
    const read = selectSfPreferencesProjection(f.call, (preferences, actor) => {
      expect(f.control.calls).toEqual([{ namespace: "preferences", mode: "read" }])
      const graph = preferences.private as Graph
      expect(graph.self).toBe(graph)
      expect(graph.preferences).toBe(preferences)
      expect<unknown>(preferences.alias).toBe(graph)
      expect(Object.keys(preferences).sort()).toEqual(["alias", "insideClone", "private", "unrelated"])
      retained.push(preferences)
      return { preferences, actor: { ...actor } }
    })
    const run = async (opaque: boolean) => {
      f.reset()
      let fullClones = 0, preferenceGetters = 0
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        Object.defineProperty(state.cases.other!, "cloneProbe", { enumerable: true, get: () => { fullClones++; return "cloneable" } })
        const graph = state.preferences.private as Graph
        graph.self = graph
        graph.preferences = state.preferences
        state.preferences.alias = graph
        Object.defineProperty(state.preferences, "insideClone", { enumerable: true, get: () => { preferenceGetters++; return { original: true } } })
      }
      const result = await f.port.read(f.request(), "preferences", opaque ? (state, actor) => read(state, actor) : read)
      expect(f.control.calls).toEqual([{ namespace: "preferences", mode: "read" }, { namespace: "preferences", mode: "read" }])
      expect(fullClones).toBe(opaque ? 1 : 0)
      expect(preferenceGetters).toBe(1)
      return result
    }
    const baseline = await run(true), selected = await run(false)
    expect(selected).toEqual(baseline)
    expect(retained).toHaveLength(2)
    expect(retained[0]).not.toBe(retained[1])
    expect(retained[0]!.private).not.toBe(retained[1]!.private)
    ;(retained[1]!.private as Graph).amount = 999
    retained[1]!.callerOnly = { changed: true }
    expect((retained[0]!.private as Graph).amount).toBe(12)
    expect(await run(false)).toEqual(baseline)
    await f.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.preferences.private = { retained: "complete preferences", amount: 24 }
      state.preferences.newPreference = { persisted: true }
      state.versions.preferences++
      state.revision++
      return { commit: true, value: undefined }
    })
    f.reset()
    const fresh = await f.port.read(f.request(), "preferences", selectSfPreferencesProjection(f.call, (preferences) => preferences))
    f.reset()
    const canonical = await f.port.read(f.request(), "preferences", (state) => state.preferences)
    expect(fresh).toEqual(canonical)
    expect(fresh).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1, incarnation: "selector-state" })
    expect(ok(fresh)).toEqual({ private: { retained: "complete preferences", amount: 24 },
      unrelated: { retained: "a second preference" }, newPreference: { persisted: true } })
    expect(Reflect.has(ok(fresh), "callerOnly")).toBe(false)
  } finally { await deadline.close() }
}, 15_000)

test("C08 preferences projection preserves opaque context and descriptor fallback", async () => {
  const deadline = compositionTestDeadline("preferences-fallback", 12_000)
  try {
    const f = await preferencesFixture(deadline)
    type Counts = { fullClones: number; getters: number; traps: number; projects: number }
    const contexts: { name: string; context: (counts: Counts) => TrustedDomainContext; wrapped?: boolean; wrongNamespace?: boolean; proxyProject?: boolean }[] = [
      { name: "mutable", context: () => ({ ...f.call, binding: { ...f.call.binding } }) },
      { name: "wrapped", context: () => f.call, wrapped: true },
      { name: "wrong namespace", context: () => f.call, wrongNamespace: true },
      { name: "proxy projector", context: () => f.call, proxyProject: true },
      { name: "proxy context", context: (counts) => new Proxy(f.call, {
        get: (target, key, receiver) => { counts.traps++; return Reflect.get(target, key, receiver) },
        getOwnPropertyDescriptor: (target, key) => { counts.traps++; return Reflect.getOwnPropertyDescriptor(target, key) },
      }) },
      { name: "binding getter", context: (counts) => Object.freeze(Object.defineProperty({ ...f.call }, "binding",
        { enumerable: true, get: () => { counts.getters++; return f.call.binding } })) },
      { name: "kind getter", context: (counts) => Object.freeze(Object.defineProperty({ ...f.call }, "kind",
        { enumerable: true, get: () => { counts.getters++; return "ui" } })) },
    ]
    for (const entry of contexts) {
      const run = async (opaque: boolean) => {
        f.reset()
        const counts: Counts = { fullClones: 0, getters: 0, traps: 0, projects: 0 }
        const call = entry.context(counts)
        const project = (preferences: SfProductState["preferences"], actor: SfStateAuthority) => {
          counts.projects++
          return { preferences, actor, kind: call.kind, principal: call.binding.principalRef }
        }
        const callback = entry.proxyProject ? new Proxy(project, { apply: (target, receiver, args) => {
          counts.traps++; return Reflect.apply(target, receiver, args)
        } }) : project
        const read = selectSfPreferencesProjection(call, callback)
        expect({ getters: counts.getters, traps: counts.traps }).toEqual({ getters: 0, traps: 0 })
        f.control.before = (snapshot, count) => {
          if (count === 1) Object.defineProperty((snapshot.data.__sfProductV1 as SfProductState).cases.other!, "cloneProbe",
            { enumerable: true, get: () => { counts.fullClones++; return "cloneable" } })
        }
        const namespace = entry.wrongNamespace ? "cases" : "preferences"
        const observed = await f.observe(namespace, opaque || entry.wrapped ? (state, actor) => read(state, actor) : read)
        expect(counts.fullClones).toBe(1)
        expect(counts.projects).toBe(1)
        expect(f.control.calls).toEqual([{ namespace, mode: "read" }, { namespace, mode: "read" }])
        return { observed, counts }
      }
      expect({ name: entry.name, ...await run(false) }).toEqual({ name: entry.name, ...await run(true) })
    }
    for (const shape of ["missing", "inherited", "nonenumerable", "accessor", "nonplain", "proxy", "invalid state", "uncloneable"] as const) {
      const run = async (opaque: boolean) => {
        f.reset()
        const counts = { fullClones: 0, getters: 0, traps: 0, projects: 0 }
        f.control.before = (snapshot, count) => {
          if (count !== 1) return
          const state = snapshot.data.__sfProductV1 as SfProductState, preferences = state.preferences
          Object.defineProperty(state.cases.other!, "cloneProbe", { enumerable: true, get: () => { counts.fullClones++; return "cloneable" } })
          if (shape === "missing") Reflect.deleteProperty(state, "preferences")
          if (shape === "inherited") { Reflect.deleteProperty(state, "preferences"); Object.setPrototypeOf(state, { preferences }) }
          if (shape === "nonenumerable") Object.defineProperty(state, "preferences", { value: preferences, enumerable: false })
          if (shape === "accessor") Object.defineProperty(state, "preferences", { enumerable: true, get: () => { counts.getters++; return preferences } })
          if (shape === "nonplain") Object.setPrototypeOf(preferences, { inherited: true })
          if (shape === "proxy") state.preferences = new Proxy(preferences, {
            get: (target, key, receiver) => { counts.traps++; return Reflect.get(target, key, receiver) },
            getOwnPropertyDescriptor: (target, key) => { counts.traps++; return Reflect.getOwnPropertyDescriptor(target, key) },
          })
          if (shape === "invalid state") Reflect.set(state, "documents", [])
          if (shape === "uncloneable") preferences.uncloneable = () => undefined
        }
        const read = selectSfPreferencesProjection(f.call, (preferences, actor) => { counts.projects++; return { preferences, actor } })
        const observed = await f.observe("preferences", opaque ? (state, actor) => read(state, actor) : read)
        return { observed, counts, authorizations: [...f.control.calls] }
      }
      const baseline = await run(true), selected = await run(false)
      // A selected clone error occurs before any unrelated namespace is visited.
      if (shape === "uncloneable") {
        expect(selected.observed).toEqual(baseline.observed)
        expect(selected.counts.projects).toBe(0)
        expect(selected.authorizations).toEqual(baseline.authorizations)
      } else expect({ shape, ...selected }).toEqual({ shape, ...baseline })
    }
  } finally { await deadline.close() }
}, 15_000)

test("C08 preferences projection keeps both authority checks around asynchronous callbacks", async () => {
  const deadline = compositionTestDeadline("preferences-authority", 12_000)
  try {
    const f = await preferencesFixture(deadline)
    for (const attack of ["admission", "revocation", "revision", "throw", "abort"] as const) {
      const run = async (opaque: boolean) => {
        f.reset()
        let projects = 0
        const cancelled = new AbortController()
        const read = selectSfPreferencesProjection(f.call, async (preferences) => {
          projects++
          expect(f.control.calls).toHaveLength(1)
          if (attack === "throw") throw new Error("Original preference callback failed")
          await Promise.resolve()
          if (attack === "revocation") f.control.active = false
          if (attack === "revision") f.control.actor.accessRevision = "changed"
          if (attack === "abort") cancelled.abort(new Error("Original preference read cancelled"))
          return preferences
        })
        if (attack === "admission") f.control.active = false
        const observed = await f.observe("preferences", opaque ? (state, actor) => read(state, actor) : read,
          new Request("https://selector.example.test/read", { signal: attack === "abort" ? cancelled.signal : deadline.signal }))
        expect(projects).toBe(attack === "admission" ? 0 : 1)
        expect(f.control.calls).toHaveLength(attack === "revocation" || attack === "revision" ? 2 : 1)
        if (attack === "admission") expect(observed).toEqual({ value: { status: "denied", reason: "product-access-unavailable" } })
        if (attack === "revocation" || attack === "revision") expect(observed).toEqual({ value: { status: "denied", reason: "product-authority-changed" } })
        if ("value" in observed) expect(observed.value?.status).not.toBe("ok")
        return { observed, projects, authorizations: [...f.control.calls] }
      }
      expect({ attack, ...await run(false) }).toEqual({ attack, ...await run(true) })
    }
    for (const opaque of [true, false]) {
      f.reset()
      const entered = Promise.withResolvers<void>(), release = Promise.withResolvers<void>()
      let projects = 0
      const read = selectSfPreferencesProjection(f.call, async (preferences) => {
        projects++; entered.resolve()
        await release.promise
        return preferences
      })
      const pending = f.observe("preferences", opaque ? (state, actor) => read(state, actor) : read).finally(() => entered.resolve())
      try {
        await entered.promise
        expect(projects).toBe(1)
        expect(f.control.calls).toHaveLength(1)
        f.control.active = false
        release.resolve()
        expect(await pending).toEqual({ value: { status: "denied", reason: "product-authority-changed" } })
        expect(projects).toBe(1)
        expect(f.control.calls).toHaveLength(2)
      } finally { release.resolve(); await pending }
    }
    const detached = async (opaque: boolean) => {
      f.reset()
      f.control.before = (snapshot, count) => {
        if (count === 2) expect((snapshot.data.__sfProductV1 as SfProductState).preferences.private)
          .toEqual({ retained: "complete preferences", amount: 12 })
      }
      const read = selectSfPreferencesProjection(f.call, async (preferences) => {
        await Promise.resolve()
        preferences.private = { callerOnly: true }
        return preferences
      })
      const result = await f.port.read(f.request(), "preferences", opaque ? (state, actor) => read(state, actor) : read)
      expect(f.control.calls).toHaveLength(2)
      return result
    }
    expect(await detached(false)).toEqual(await detached(true))
  } finally { await deadline.close() }
}, 15_000)
