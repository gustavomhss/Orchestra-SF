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
      const result = await f.port.read(f.request(), "cases", opaque ? (state, actor) => read(state, actor) : read)
      expect(f.control.calls).toEqual([{ namespace: "cases", mode: "read" }, { namespace: "cases", mode: "read" }])
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
      f.control.before = (snapshot, count) => {
        if (count !== 1) return
        const state = snapshot.data.__sfProductV1 as SfProductState
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
