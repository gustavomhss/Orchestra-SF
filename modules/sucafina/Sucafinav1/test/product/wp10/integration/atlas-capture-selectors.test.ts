import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SfProductState, SfStateAuthority, SfStateNamespace, SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfProductState, initializeAbsentSfProductState, selectSfAtlasPartition, selectSfCaseProjection } from "../../../../product/host-binding/state-provider.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Read<Value> = (state: Readonly<SfProductState>, actor: SfStateAuthority) => Value | Promise<Value>

function ok<Value>(result: SfStateResult<Value>): Value {
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
  // This protocol fixture supplies the C08 authorization callback below. The
  // separate native composition test uses actual ProductAuthority admission.
  return Object.freeze({ kind: "ui", binding: Object.freeze({ installationId: "selector-installation", projectId: "project",
    principalRef: "person", requestId: "request", policyVersion: "policy", accessRevision: "access",
    expiresAt: "2028-01-01T00:00:00Z" }), lease: {} }) as TrustedUiContext
}

async function selectorFixture(deadline: Deadline) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-atlas-selector-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  await initializeAbsentSfProductState(store, () => "selector-state")
  await store.transaction("dashboard", async (snapshot) => {
    const state = snapshot.data.__sfProductV1 as SfProductState
    state.cases.selected = decision("selected")
    state.cases.other = decision("other")
    state.atlas.owner = { marker: "selected", rows: [{ amount: 12 }] }
    state.atlas.other = { marker: "unrelated", rows: [{ amount: 34 }] }
    state.preferences.private = { retained: "full state" }
    return { commit: true, value: undefined }
  })
  const actor = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }
  const control: {
    active: boolean
    actor: SfStateAuthority
    calls: { namespace: SfStateNamespace; mode: "read" | "write" }[]
    before?: (snapshot: Snapshot, count: number) => void | Promise<void>
  } = { active: true, actor: { ...actor }, calls: [] }
  const port = createSfProductState({ persistence: store,
    authorize: async (_request, snapshot, namespace, mode) => {
      deadline.check()
      control.calls.push({ namespace, mode })
      await control.before?.(snapshot, control.calls.length)
      return control.active ? { ...control.actor } : undefined
    },
    resolveTarget: async () => undefined,
  })
  const request = () => new Request("https://selector.example.test/read", { signal: deadline.signal })
  const reset = () => { control.active = true; control.actor = { ...actor }; control.calls = []; control.before = undefined }
  const observe = async <Value>(namespace: SfStateNamespace, read: Read<Value>) => {
    try { return { value: await port.read(request(), namespace, read) } }
    catch (error) { return { error: error instanceof Error ? { name: error.name, message: error.message } : String(error) } }
  }
  return { store, port, control, request, reset, observe, call: frozenContext() }
}

test("C08 case projection retains complete payload, two authorizations and fresh detached reads", async () => {
  const deadline = compositionTestDeadline("atlas-case-selector", 12_000)
  try {
    const f = await selectorFixture(deadline)
    const callbacks: (DecisionCase | undefined)[] = []
    const read = selectSfCaseProjection("selected", f.call, (value, actor) => {
      expect(f.control.calls).toEqual([{ namespace: "cases", mode: "read" }])
      callbacks.push(value)
      return { value, actor: { ...actor } }
    })
    const run = async (opaque: boolean) => {
      f.reset()
      let fullClones = 0
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        Object.defineProperty(state.preferences, "cloneProbe", { enumerable: true, get: () => { fullClones++; return "cloneable" } })
      }
      const result = await f.port.read(f.request(), "cases", opaque ? (state, actor) => read(state, actor) : read)
      expect(f.control.calls).toEqual([{ namespace: "cases", mode: "read" }, { namespace: "cases", mode: "read" }])
      expect(fullClones).toBe(opaque ? 1 : 0)
      return result
    }
    const baseline = await run(true), selected = await run(false)
    expect(selected).toEqual(baseline)
    expect(ok(selected).value).toEqual(decision("selected"))
    expect(callbacks).toHaveLength(2)
    expect(callbacks[0]).not.toBe(callbacks[1])
    expect(callbacks[0]?.criteria).not.toBe(callbacks[1]?.criteria)
    if (!callbacks[1]) throw new Error("The selected real case is required")
    callbacks[1].objective = "Caller changed only its detached result"
    expect(ok(baseline).value?.objective).toBe("Complete original case")
    expect(ok(await run(false)).value).toEqual(decision("selected"))

    await f.store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases.selected!.objective = "A subsequent real persisted value"
      state.cases.selected!.version++
      state.versions.cases++
      state.revision++
      return { commit: true, value: undefined }
    })
    const fresh = await run(false), canonical = await run(true)
    expect(fresh).toEqual(canonical)
    expect(fresh).toMatchObject({ status: "ok", storageVersion: 1, aggregateRevision: 1, incarnation: "selector-state" })
    expect(ok(fresh).value).toMatchObject({ objective: "A subsequent real persisted value", version: 2 })
    expect(ok(baseline).value).toEqual(decision("selected"))

    f.reset()
    f.control.before = (snapshot, count) => {
      if (count === 1) (snapshot.data.__sfProductV1 as SfProductState).cases.selected!.objective = "Observed after first authority"
    }
    const afterAuthority = ok(await f.port.read(f.request(), "cases", selectSfCaseProjection("selected", f.call, (value) => value)))
    expect(afterAuthority?.objective).toBe("Observed after first authority")
    expect(f.control.calls).toHaveLength(2)
    f.reset()
    expect(ok(await f.port.read(f.request(), "cases", selectSfCaseProjection("selected", f.call, (value) => value)))?.objective)
      .toBe("A subsequent real persisted value")
  } finally { await deadline.close() }
}, 15_000)

test("C08 Atlas projection clones the complete partition and outbox as one fresh graph", async () => {
  const deadline = compositionTestDeadline("atlas-partition-selector", 12_000)
  try {
    const f = await selectorFixture(deadline)
    type Graph = { marker: string; shared: { amount: number }; outbox: SfProductState["outbox"]; self: Graph }
    const retained: Graph[] = []
    const read = selectSfAtlasPartition("owner", f.call, (partition, outbox, actor) => {
      expect(f.control.calls).toEqual([{ namespace: "atlas", mode: "read" }])
      const graph = partition as Graph
      expect(graph.outbox).toBe(outbox)
      expect(graph.shared).toBe(Reflect.get(outbox, "shared"))
      expect(graph.self).toBe(graph)
      expect(Reflect.get(outbox, "partition")).toBe(graph)
      expect(Object.keys(outbox).sort()).toEqual(["partition", "shared", "unrelated"])
      retained.push(graph)
      return { partition, outbox, actor: { ...actor } }
    })
    const run = async (opaque: boolean) => {
      f.reset()
      let fullClones = 0
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
        Object.defineProperty(state.preferences, "cloneProbe", { enumerable: true, get: () => { fullClones++; return "cloneable" } })
        const graph = state.atlas.owner as Graph
        graph.shared = { amount: 42 }
        graph.outbox = state.outbox
        graph.self = graph
        Reflect.set(state.outbox, "shared", graph.shared)
        Reflect.set(state.outbox, "partition", graph)
        Reflect.set(state.outbox, "unrelated", { complete: true })
      }
      const result = await f.port.read(f.request(), "atlas", opaque ? (state, actor) => read(state, actor) : read)
      expect(f.control.calls).toEqual([{ namespace: "atlas", mode: "read" }, { namespace: "atlas", mode: "read" }])
      expect(fullClones).toBe(opaque ? 1 : 0)
      return result
    }
    const baseline = await run(true), selected = await run(false)
    expect(selected).toEqual(baseline)
    expect(retained).toHaveLength(2)
    expect(retained[0]).not.toBe(retained[1])
    expect(retained[0]!.shared).not.toBe(retained[1]!.shared)
    expect(retained[0]!.outbox).not.toBe(retained[1]!.outbox)
    retained[1]!.shared.amount = 99
    Reflect.set(retained[1]!.outbox, "external", { changed: true })
    expect(retained[0]!.shared.amount).toBe(42)
    const fresh = await run(false)
    expect(fresh).toEqual(baseline)
    expect(retained[2]!.shared.amount).toBe(42)
    expect(Reflect.has(retained[2]!.outbox, "external")).toBe(false)
    f.reset()
    const durable = ok(await f.port.read(f.request(), "atlas", (state) => ({ atlas: state.atlas, outbox: state.outbox })))
    expect(durable.atlas.owner).toEqual({ marker: "selected", rows: [{ amount: 12 }] })
    expect(durable.outbox).toEqual({})
  } finally { await deadline.close() }
}, 15_000)

test("C08 capture selectors keep opaque contexts, readers and descriptors on the original full clone", async () => {
  const deadline = compositionTestDeadline("atlas-selector-fallback", 12_000)
  try {
    const f = await selectorFixture(deadline)
    type Counts = { fullClones: number; getters: number; traps: number; projects: number }
    type ContextCase = { name: string; context: (counts: Counts) => TrustedDomainContext; wrap?: boolean; wrongNamespace?: boolean; proxyProject?: boolean }
    const contexts: ContextCase[] = [
      { name: "mutable", context: () => ({ ...f.call, binding: { ...f.call.binding } }) },
      { name: "opaque callback", context: () => f.call, wrap: true },
      { name: "wrong namespace", context: () => f.call, wrongNamespace: true },
      { name: "projector Proxy", context: () => f.call, proxyProject: true },
      { name: "context Proxy", context: (counts) => new Proxy(f.call, {
        get: (target, key, receiver) => { counts.traps++; return Reflect.get(target, key, receiver) },
        getOwnPropertyDescriptor: (target, key) => { counts.traps++; return Reflect.getOwnPropertyDescriptor(target, key) },
        getPrototypeOf: (target) => { counts.traps++; return Reflect.getPrototypeOf(target) },
      }) },
      { name: "binding Proxy", context: (counts) => Object.freeze({ ...f.call, binding: new Proxy(f.call.binding, {
        get: (target, key, receiver) => { counts.traps++; return Reflect.get(target, key, receiver) },
        getOwnPropertyDescriptor: (target, key) => { counts.traps++; return Reflect.getOwnPropertyDescriptor(target, key) },
        getPrototypeOf: (target) => { counts.traps++; return Reflect.getPrototypeOf(target) },
      }) }) },
      { name: "frozen binding getter", context: (counts) => Object.freeze(Object.defineProperty({ ...f.call }, "binding",
        { enumerable: true, get: () => { counts.getters++; return f.call.binding } })) },
      { name: "frozen kind getter", context: (counts) => Object.freeze(Object.defineProperty({ ...f.call }, "kind",
        { enumerable: true, get: () => { counts.getters++; return "ui" } })) },
      { name: "frozen native case getter", context: (counts) => {
        const binding = Object.freeze(Object.defineProperty({ ...f.call.binding }, "caseId",
          { enumerable: true, get: () => { counts.getters++; return "selected" } }))
        return Object.freeze({ kind: "native", binding, lease: {} }) as TrustedDomainContext
      } },
    ]
    for (const kind of ["cases", "atlas"] as const) for (const entry of contexts) {
      const run = async (opaque: boolean) => {
        f.reset()
        const counts: Counts = { fullClones: 0, getters: 0, traps: 0, projects: 0 }
        const call = entry.context(counts)
        const project = (value: unknown, actor: SfStateAuthority) => {
          counts.projects++
          const contextKind = call.kind, binding = call.binding
          return { value, actor, contextKind, principal: binding.principalRef,
            nativeCase: contextKind === "native" ? Reflect.get(binding, "caseId") : undefined }
        }
        const callback = entry.proxyProject ? new Proxy(project, { apply: (target, receiver, args) => {
          counts.traps++
          return Reflect.apply(target, receiver, args)
        } }) : project
        const read = kind === "cases" ? selectSfCaseProjection("selected", call, callback)
          : selectSfAtlasPartition("owner", call, (partition, outbox, actor) => callback({ partition, outbox }, actor))
        // The Atlas projector itself must be opaque for that particular case.
        const atlasRead = kind === "atlas" && entry.proxyProject ? selectSfAtlasPartition("owner", call,
          new Proxy((partition: unknown, outbox: SfProductState["outbox"], actor: SfStateAuthority) => project({ partition, outbox }, actor),
            { apply: (target, receiver, args) => { counts.traps++; return Reflect.apply(target, receiver, args) } })) : read
        expect({ getters: counts.getters, traps: counts.traps }).toEqual({ getters: 0, traps: 0 })
        f.control.before = (snapshot, count) => {
          if (count === 1) Object.defineProperty((snapshot.data.__sfProductV1 as SfProductState).preferences, "cloneProbe",
            { enumerable: true, get: () => { counts.fullClones++; return "cloneable" } })
        }
        const namespace = entry.wrongNamespace ? kind === "cases" ? "atlas" : "cases" : kind
        const observed = await f.observe(namespace, opaque || entry.wrap ? (state, actor) => atlasRead(state, actor) : atlasRead)
        expect(counts.fullClones).toBe(1)
        expect(counts.projects).toBe(1)
        expect(f.control.calls).toEqual([{ namespace, mode: "read" }, { namespace, mode: "read" }])
        return { observed, counts }
      }
      const baseline = await run(true), projected = await run(false)
      expect({ kind, case: entry.name, ...projected }).toEqual({ kind, case: entry.name, ...baseline })
    }

    const shapes = ["missing", "inherited", "nonenumerable", "accessor", "nonplain map", "nonplain value", "proxy map", "proxy value", "proxy state", "outbox accessor"] as const
    for (const kind of ["cases", "atlas"] as const) for (const shape of shapes) {
      if (kind === "cases" && shape === "outbox accessor") continue
      const run = async (opaque: boolean) => {
        f.reset()
        const counts = { fullClones: 0, getters: 0, traps: 0, projects: 0 }
        f.control.before = (snapshot, count) => {
          if (count !== 1) return
          const state = snapshot.data.__sfProductV1 as SfProductState
          Object.defineProperty(state.preferences, "cloneProbe", { enumerable: true, get: () => { counts.fullClones++; return "cloneable" } })
          const map = kind === "cases" ? state.cases : state.atlas
          const key = kind === "cases" ? "selected" : "owner"
          const value = Reflect.get(map, key)
          const proxy = <Value extends object>(target: Value) => new Proxy(target, {
            get: (original, name, receiver) => { counts.traps++; return Reflect.get(original, name, receiver) },
            getOwnPropertyDescriptor: (original, name) => { counts.traps++; return Reflect.getOwnPropertyDescriptor(original, name) },
            ownKeys: (original) => { counts.traps++; return Reflect.ownKeys(original) },
            getPrototypeOf: (original) => { counts.traps++; return Reflect.getPrototypeOf(original) },
          })
          if (shape === "missing") Reflect.deleteProperty(map, key)
          if (shape === "inherited") { Reflect.deleteProperty(map, key); Object.setPrototypeOf(map, { [key]: value }) }
          if (shape === "nonenumerable") Object.defineProperty(map, key, { enumerable: false, value })
          if (shape === "accessor") Object.defineProperty(map, key, { enumerable: true, get: () => { counts.getters++; return value } })
          if (shape === "nonplain map") Object.setPrototypeOf(map, { originalMap: true })
          if (shape === "nonplain value") Object.setPrototypeOf(value, { originalValue: true })
          if (shape === "proxy map") Reflect.set(state, kind, proxy(map))
          if (shape === "proxy value") Reflect.set(map, key, proxy(value))
          if (shape === "proxy state") snapshot.data.__sfProductV1 = proxy(state)
          if (shape === "outbox accessor") {
            const outbox = state.outbox
            Object.defineProperty(state, "outbox", { enumerable: true, get: () => { counts.getters++; return outbox } })
          }
        }
        const read = kind === "cases"
          ? selectSfCaseProjection("selected", f.call, (value, actor) => { counts.projects++; return { value, actor } })
          : selectSfAtlasPartition("owner", f.call, (partition, outbox, actor) => { counts.projects++; return { value: { partition, outbox }, actor } })
        const observed = await f.observe(kind, opaque ? (state, actor) => read(state, actor) : read)
        return { observed, counts, authorizations: [...f.control.calls] }
      }
      const baseline = await run(true), projected = await run(false)
      expect({ kind, shape, ...projected }).toEqual({ kind, shape, ...baseline })
      if (!shape.startsWith("proxy")) expect(projected.counts.fullClones).toBe(1)
    }
  } finally { await deadline.close() }
}, 15_000)
