import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority } from "../../../../product/contracts/state.ts"
import { createSfProductState, initializeAbsentSfProductState, selectSfPreferencesProjection, selectSfPreferencesRead } from "../../../../product/host-binding/state-provider.ts"
import { createDecisionBaselineCoverage } from "../../../../product/decisions/baseline-coverage.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type Read = (state: Readonly<SfProductState>, authority: SfStateAuthority) => unknown | Promise<unknown>

const actor: SfStateAuthority = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }

function context(): TrustedUiContext {
  return Object.freeze({ kind: "ui", binding: Object.freeze({
    installationId: "baseline-read-set-installation", projectId: "project", principalRef: "person",
    requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2028-01-01T00:00:00Z",
  }), lease: {} }) as TrustedUiContext
}

function decision(): DecisionCase {
  return { id: "selected", incarnation: "selected-inc", version: 1, state: "investigating",
    objective: "Original baseline read", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD",
    participants: ["person"], criteria: [], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [],
    questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
}

async function capture<T>(work: () => T | Promise<T>) {
  try { return { value: await work() } }
  catch (error) { return { error } }
}

test("Explicit preferences read-set returns the same callback and preserves actual C08 fallback", async () => {
  const deadline = compositionTestDeadline("preferences-identity-read-set", 12_000)
  try {
    const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-preferences-read-set-"))
    deadline.own(() => rm(directory, { recursive: true, force: true }))
    const store = await openLocalStore(path.join(directory, "store"))
    deadline.own(() => store.dispose())
    await initializeAbsentSfProductState(store, () => "read-set-state")
    await store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.preferences.private = { amount: 12 }
      state.cases.selected = decision()
      return { commit: true, value: undefined }
    })
    const call = context()
    let authorizeCalls = 0
    let before: ((snapshot: Snapshot) => void) | undefined
    const port = createSfProductState({ persistence: store, createId: randomUUID,
      authorize: async (_request, snapshot) => {
        deadline.check()
        authorizeCalls++
        if (authorizeCalls === 1) before?.(snapshot)
        return { ...actor }
      },
      resolveTarget: async () => undefined,
    })
    const incoming = () => new Request("https://baseline-read-set.example.test", { signal: deadline.signal })
    for (const mode of ["marked", "wrapped", "mutable", "binding accessor", "proxy context", "proxy callback", "wrong namespace"] as const) {
      authorizeCalls = 0
      let callbackCalls = 0, getterCalls = 0, contextTraps = 0, callbackTraps = 0
      const sentinel = new Error("Original full-state clone failure")
      const sourceContext = mode === "mutable" ? { ...call, binding: { ...call.binding } }
        : mode === "binding accessor" ? Object.freeze(Object.defineProperty({ ...call }, "binding",
          { enumerable: true, get: () => { contextTraps++; return call.binding } }))
        : mode === "proxy context" ? new Proxy(call, {
          get: (target, key, receiver) => { contextTraps++; return Reflect.get(target, key, receiver) },
          getOwnPropertyDescriptor: (target, key) => { contextTraps++; return Reflect.getOwnPropertyDescriptor(target, key) },
        }) : call
      const original = (state: Pick<SfProductState, "preferences">, authority: SfStateAuthority) => {
        callbackCalls++
        return { selected: state.preferences.private, authority }
      }
      const read = mode === "proxy callback" ? new Proxy(original, {
        apply: (target, receiver, args) => { callbackTraps++; return Reflect.apply(target, receiver, args) },
        get: (target, key, receiver) => { callbackTraps++; return Reflect.get(target, key, receiver) },
      }) : original
      const declared = selectSfPreferencesRead(sourceContext, read)
      expect(declared).toBe(read)
      expect(callbackCalls).toBe(0)
      expect(callbackTraps).toBe(0)
      expect(contextTraps).toBe(0)
      before = (snapshot) => Object.defineProperty((snapshot.data.__sfProductV1 as SfProductState).cases.selected!, "outsideReadSet",
        { enumerable: true, get: () => { getterCalls++; throw sentinel } })
      const result = await capture(() => port.read(incoming(), mode === "wrong namespace" ? "cases" : "preferences",
        mode === "wrapped" ? (state, authority) => declared(state, authority) : declared))
      if (mode === "marked") {
        expect(result.error).toBeUndefined()
        expect(result.value).toEqual({ status: "ok", storageVersion: 0, aggregateRevision: 0,
          incarnation: "read-set-state", value: { selected: { amount: 12 }, authority: actor } })
        expect(callbackCalls).toBe(1)
        expect(authorizeCalls).toBe(2)
        expect(getterCalls).toBe(0)
      } else {
        expect(result.value).toBeUndefined()
        expect(result.error).toBe(sentinel)
        expect(callbackCalls).toBe(0)
        expect(authorizeCalls).toBe(1)
        expect(getterCalls).toBe(1)
      }
      expect(contextTraps).toBe(0)
      expect(callbackTraps).toBe(0)
    }
    authorizeCalls = 0
    before = undefined
    const sentinel = new Error("Original declared callback failure")
    let entered = 0
    const original = () => { entered++; throw sentinel }
    const declared = selectSfPreferencesRead(call, original)
    expect(declared).toBe(original)
    expect(entered).toBe(0)
    const result = await capture(() => port.read(incoming(), "preferences", declared))
    expect(result.error).toBe(sentinel)
    expect(entered).toBe(1)
    expect(authorizeCalls).toBe(1)
  } finally { await deadline.close() }
}, 15_000)

/** Capture the actual callback delivered by the baseline consumer to a custom
 * port. The port deliberately stops before a coverage result exists. Invocation
 * and all getter/error assertions happen later, outside readCoverage's catch. */
async function baselineCallback(call: TrustedDomainContext, classified: boolean, deadline: Deadline) {
  const request = new Request("https://baseline-custom.example.test", { signal: deadline.signal })
  const value = decision()
  const seen: { namespace: string; request: Request }[] = []
  const callbacks: Read[] = []
  let caseChecks = 0, revalidations = 0, unused = 0
  const state: SfProductStatePort = {
    read: async (incoming, namespace, read) => {
      seen.push({ namespace, request: incoming })
      if (namespace === "preferences") {
        callbacks.push(read)
        return { status: "unavailable", reason: "callback-captured-without-invocation" }
      }
      return { status: "ok", storageVersion: 0, aggregateRevision: 0, incarnation: "custom-state",
        value: await read({ cases: { selected: value } } as Readonly<SfProductState>, actor) }
    },
    transaction: async () => { unused++; throw new Error("No custom write belongs to callback capture") },
  }
  const source = createDecisionBaselineCoverage({
    state, host: { requestFor: () => request, revalidate: async () => { revalidations++; return true } },
    resolveCase: async () => ({ status: "ok", value: { id: value.id, incarnation: value.incarnation, version: value.version } }),
    authorizeCase: async (current, context) => {
      caseChecks++
      return current.id === value.id && current.participants.includes(context.binding.principalRef)
    },
    authorizeCoverage: async () => { unused++; return false },
    projectForecast: async () => { unused++; return { status: "unavailable", reason: "capture-only" } },
    resolveEvidence: async () => { unused++; return [] },
    supports: () => { unused++; return false },
    verifySnapshot: () => { unused++; return false },
    operationIdentity: () => { unused++; return undefined },
    proposalCoverageWrites: new WeakSet<object>(),
    now: () => { unused++; return "2027-02-02T00:00:00Z" },
  })
  const result = classified ? await source.resolveClassifiedCoverage("source", call)
    : await source.resolveForecastCoverage("source", call)
  expect(result).toEqual({ status: "unavailable", reason: "baseline-coverage-unavailable" })
  expect(seen).toEqual([{ namespace: "cases", request }, { namespace: "preferences", request }])
  expect(caseChecks).toBe(1)
  expect(revalidations).toBe(1)
  expect(unused).toBe(0)
  expect(callbacks).toHaveLength(1)
  const read = callbacks[0]
  if (!read) throw new Error("The real baseline callback was not delivered")
  return read
}

test("Baseline custom callback keeps its original authority gate and repeated namespace getter observations", async () => {
  const deadline = compositionTestDeadline("baseline-original-state-callback", 12_000)
  try {
    const fields = ["principalRef", "policyVersion", "accessRevision"] as const
    for (const frozen of [true, false]) {
      for (const classified of [false, true]) {
        const mutable = { ...context(), binding: { ...context().binding } }
        const call = frozen ? context() : mutable
        const read = await baselineCallback(call, classified, deadline)
        const sentinel = new Error("Original baseline namespace getter")
        for (const mismatch of [...fields, "none"] as const) {
          const run = async (historicalProjection: boolean) => {
            let getters = 0
            const order: string[] = []
            const authority = { ...actor }
            for (const field of fields) Object.defineProperty(authority, field, { enumerable: true,
              get: () => { order.push(field); return field === mismatch ? "different" : actor[field] } })
            const state = Object.defineProperty({}, "preferences", {
              enumerable: true, get: () => { getters++; throw sentinel },
            }) as Readonly<SfProductState>
            // This negative control reproduces only the general helper's C3
            // eager namespace observation, not an alternate coverage producer.
            const callback = historicalProjection
              ? selectSfPreferencesProjection(call, (preferences, current) => read({ preferences } as Readonly<SfProductState>, current))
              : read
            const observed = await capture(() => callback(state, authority))
            if (historicalProjection) {
              expect(observed.error).toBe(sentinel)
              expect(getters).toBe(1)
              expect(order).toEqual([])
            } else {
              const reached = mismatch === "none" ? fields.length : fields.indexOf(mismatch) + 1
              expect(order).toEqual(fields.slice(0, reached))
              expect(getters).toBe(mismatch === "none" ? 1 : 0)
              if (mismatch === "none") expect(observed.error).toBe(sentinel)
              else { expect(observed.error).toBeUndefined(); expect(observed.value).toBeUndefined() }
            }
          }
          await run(false)
          await run(true)
        }

        // The first map contains only the shape needed to reach the ORIGINAL
        // second namespace lookup. It never represents accepted coverage.
        const firstMap = { "sf:proposal-coverage:baseline:active:probe": {
          schema: "sf-baseline-coverage-v1", coverageRef: "coverage", caseRef: { id: "selected", incarnation: "selected-inc", version: 1 },
          source: { refId: "source" }, basis: {}, assessment: {}, version: 1,
          recordDigest: "unused", classificationDigest: "unused", caseScopeDigest: "unused",
        } }
        const repeat = async (historicalProjection: boolean) => {
          let getters = 0
          const state = Object.defineProperty({}, "preferences", { enumerable: true, get: () => {
            getters++
            if (getters === 1) return firstMap
            throw sentinel
          } }) as Readonly<SfProductState>
          const callback = historicalProjection
            ? selectSfPreferencesProjection(call, (preferences, current) => read({ preferences } as Readonly<SfProductState>, current))
            : read
          const observed = await capture(() => callback(state, actor))
          if (historicalProjection) {
            expect(getters).toBe(1)
            expect(observed.error).toBeUndefined()
            expect(observed.value).toEqual([])
          } else {
            expect(getters).toBe(2)
            expect(observed.error).toBe(sentinel)
            expect(observed.value).toBeUndefined()
          }
        }
        await repeat(false)
        await repeat(true)

        if (!frozen) {
          let getters = 0
          const state = Object.defineProperty({}, "preferences",
            { enumerable: true, get: () => { getters++; throw sentinel } }) as Readonly<SfProductState>
          mutable.binding.accessRevision = "changed after callback construction"
          expect(await capture(() => read(state, actor))).toEqual({ value: undefined })
          expect(getters).toBe(0)
          const matching = { ...actor, accessRevision: mutable.binding.accessRevision }
          const observed = await capture(() => read(state, matching))
          expect(observed.error).toBe(sentinel)
          expect(getters).toBe(1)
        }
      }
    }
  } finally { await deadline.close() }
}, 15_000)
