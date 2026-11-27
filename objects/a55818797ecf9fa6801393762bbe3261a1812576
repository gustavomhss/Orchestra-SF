import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createCurrentChoiceFence, currentChoiceOwnsSnapshotTransactions, isCurrentChoiceSnapshotAuthorityReader } from "../../../../product/decisions/current-choice-preview.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence, currentSfReadonlyAuthorityData, withSfScopedSourceChecks } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { createSfProductState, isSfProductStateReader, selectSfCase, selectSfCasesRead, selectSfPreferencesRead } from "../../../../product/host-binding/state-provider.ts"
import { isSfAclStateAuthorize } from "../../../../product/host-binding/acl-state-authorize.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { isLocalSnapshotAuthorityReader, observeLocalProductRead, openLocalStore } from "../../../../runtime/local-store.ts"
import { object } from "../../../../runtime/contract.ts"
import type { Persistence, Snapshot } from "../../../../runtime/contract.ts"
import type { Surface } from "../../../../src/identity.ts"

const at = "2027-02-02T00:00:00Z"
const origin = "https://c08-projection.example.test"
const period = { start: "2027-01-01", end: "2027-12-31" }
const caseRef = { id: "c14-case", incarnation: "c14-incarnation", version: 1 }
const preference = { selected: ["alpha", "beta"], nested: { version: 1, enabled: true }, nullable: null }
const domain = { records: [{ id: "domain-a", amounts: [120, 110] }, { id: "domain-b", amounts: [80, 75] }] }
type StateInput = Parameters<typeof createSfProductState>[0]
type Fixture = Awaited<ReturnType<typeof createFixture>>
type ReadMode = "readonly" | "preimage" | "top-level"

function ok<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(result.status + ": " + result.reason)
  return result.value
}
function stateValue<T>(result: SfStateResult<T>): T {
  if (result.status !== "ok") throw new Error("Original C08 refused: " + result.status)
  return result.value
}
function required<T>(value: T | undefined, name: string): T {
  if (value === undefined) throw new Error(name + " was not observed")
  return value
}
function stateInput(value: unknown, persistence: Persistence, createId: () => string): value is StateInput {
  if (!value || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false
  return Object.getOwnPropertyDescriptor(value, "persistence")?.value === persistence &&
    Object.getOwnPropertyDescriptor(value, "createId")?.value === createId &&
    typeof Object.getOwnPropertyDescriptor(value, "authorize")?.value === "function" &&
    typeof Object.getOwnPropertyDescriptor(value, "resolveTarget")?.value === "function"
}
async function bounded<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("C14 control cooperative deadline")), 110_000)
  try { return await work(controller.signal) } finally { clearTimeout(timer) }
}

// Reuse the original readonly test's LocalStore -> CurrentChoice -> Source ->
// ProductAuthority composition. The projector itself is the installed original;
// no method, codec or positive-path authorizer is wrapped to count work.
async function withFixture<T>(signal: AbortSignal, opaque: boolean, work: (fixture: Fixture) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-c08-snapshot-projection-"))
  const store = await openLocalStore(path.join(directory, "store"))
  try { return await work(await createFixture(store, directory, signal, opaque)) }
  finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}
async function createFixture(store: Awaited<ReturnType<typeof openLocalStore>>, directory: string, deadline: AbortSignal, opaque: boolean) {
  if (!store.readSnapshotRoot || !store.currentSnapshotScope || !store.transactionAll || !store.holdTargetPreimage || !store.observeAuthority)
    throw new Error("Original LocalStore snapshot capabilities required")
  let authority: ReturnType<typeof createSfProductAuthority> | undefined
  const identity = { installationId: "c14-installation", hostId: "c14-host", projectId: "c14-project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const choiceInput = {
    persistence: opaque ? { ...store } : store,
    host: () => {
      if (!authority) throw new Error("Original authority is not composed")
      return authority.host
    },
    identity: () => identity,
    operationIdentity: (call: TrustedDomainContext) => call.kind === "ui" ? authority?.ui.operationIdentity(call) : undefined,
  }
  const choice = createCurrentChoiceFence(choiceInput)
  const project = createSfSourceScopeProjector(() => at)
  const sourceInput = { persistence: choice.persistence, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: project, installedDashboardProjector: project, observeAuthority: store.observeAuthority,
    holdTargetPreimage: store.holdTargetPreimage, hasSnapshotRoot: store.hasSnapshotRoot }
  const sources = createSfSourcePersistence(sourceInput)
  const persistence = { ...store, ...choice.persistence, ...sources,
    ...(sources.transactionAll ? { dashboardSourceFence: Object.freeze({
      transaction: sources.transaction, transactionAll: sources.transactionAll,
      currentSnapshots: sources.currentSnapshots, currentSnapshot: sources.currentSnapshot,
      observeAuthority: sources.observeAuthority, readSealed: sources.readSealed,
      hasSnapshotRoot: sources.hasSnapshotRoot, readDashboardAuthority: sources.readDashboardAuthority,
      holdTargetPreimage: store.holdTargetPreimage,
      current: () => currentChoiceOwnsSnapshotTransactions(choice, choiceInput.persistence),
    }) } : {}),
  }
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    deadline.throwIfAborted()
    await persistence.initializeSources(surface)
  }
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.roleMap = roleMap(snapshot, "dashboard")
    snapshot.data.access = { person: { assigned: ["c14-assigned"], domains: ["c14-domain"] } }
    snapshot.data.c14DomainOnly = structuredClone(domain)
    snapshot.versions["c14-domain"] = { version: 2, by: "person" }
    snapshot.sequences.c14 = 3
    snapshot.audit.push({ who: "person", at, record: "c14-prefix", was: null, became: "present" })
    return { commit: true, value: undefined }
  }, { signal: deadline })
  const requests = new WeakSet<Request>()
  const request = (extra?: AbortSignal) => {
    const signal = extra ? AbortSignal.any([deadline, extra]) : deadline
    const incoming = new Request(origin + "/cases", { method: "POST", headers: { origin }, signal })
    requests.add(incoming)
    return incoming
  }
  const authentication: { surface: Surface; roles: unknown }[] = []
  const control: { active: boolean; afterDashboard?: () => void | Promise<void> } = { active: true }
  const receivers: StateInput[] = []
  function createId(this: unknown): string {
    if (stateInput(this, persistence, createId)) {
      receivers.push(this)
      // Public createId has always received the mutable C08 factory input.
      // Freezing that receiver would fail here before any positive assertion.
      Object.defineProperty(this, "c14ReceiverProbe", { value: "receiver preserved", configurable: true })
    }
    return randomUUID()
  }
  const composed = createSfProductAuthority({
    identity: () => identity, installationId: identity.installationId, origin, policyVersion: "c14-policy",
    persistence, grants: [{ principalRef: "person", namespaces: ["cases", "preferences"],
      operations: ["sf_case_read"], humanActions: [] }],
    authenticate: async (incoming, scope) => {
      if (scope) authentication.push({ surface: scope.surface, roles: structuredClone(scope.roleMap) })
      if (scope?.surface === "dashboard") {
        const hook = control.afterDashboard
        control.afterDashboard = undefined
        await hook?.()
      }
      return requests.has(incoming) && control.active && scope ? { id: "person", canWrite: true,
        roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null
    },
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined,
  })
  authority = composed
  stateValue(await composed.state.transaction(request(), {
    namespace: "cases", expectedStorageVersion: 0,
    additionalNamespaces: [{ namespace: "preferences", expectedStorageVersion: 0 }],
    targetRef: composed.creationTarget.ref, targetIncarnation: composed.creationTarget.incarnation,
    idempotencyKey: "c14-initialize", commandDigest: digestSfValue({ caseRef, preference }),
  }, async (state) => {
    state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "C08 complete product graph",
      horizon: period, currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [],
      costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    state.preferences.c14 = structuredClone(preference)
    return { commit: true, value: true }
  }))
  const captured = required(receivers[0], "C08 createId receiver")
  const canonicalAuthorize = captured.authorize
  const opaqueSnapshots: Snapshot[] = []
  const opaqueAuthorize: StateInput["authorize"] = (incoming, snapshot, namespace, mode) => {
    opaqueSnapshots.push(snapshot)
    return canonicalAuthorize.call(captured, incoming, snapshot, namespace, mode)
  }
  const customInput: StateInput = { ...captured, authorize: opaqueAuthorize }
  const custom = createSfProductState(customInput)
  const ui = async <T>(work: (call: TrustedUiContext, incoming: Request) => Promise<T>) => {
    const incoming = request(), digest = digestSfValue({})
    const call = ok(await composed.ui.admit(incoming, "sf_case_read", digest))
    try {
      if (!await composed.ui.validate(call, "sf_case_read", digest)) throw new Error("Original UI lease refused")
      return await work(call, incoming)
    } finally { composed.ui.finish(call) }
  }
  const durable = () => store.transaction("dashboard", async (snapshot) =>
    ({ commit: false, value: structuredClone(snapshot) }), { signal: deadline })
  return { store, choice, choiceInput, sourceInput, sources, persistence, authority: composed, request, ui,
    receivers, captured, createId, canonicalAuthorize, custom, customInput, opaqueAuthorize, opaqueSnapshots, authentication, control, durable }
}

async function inContext<T>(fixture: Fixture, mode: ReadMode, signal: AbortSignal, work: () => Promise<T>): Promise<T> {
  if (mode === "readonly") return fixture.persistence.readSnapshotRoot!(work, { signal })
  if (mode === "preimage") {
    const held = fixture.store.holdTargetPreimage!()
    try {
      return await fixture.store.transaction("dashboard", async () => ({ commit: false, value: await work() }),
        { signal, targetPreimageCurrent: held.current, sealedRead: true })
    } finally { held.release() }
  }
  // Top-level C08 has no pre-existing root: its first full materialization is
  // deliberately preserved and is not evidence of the new child projection.
  return work()
}

async function read(fixture: Fixture, incoming: Request, port: SfProductStatePort = fixture.authority.state) {
  const before = fixture.authentication.length
  let callbacks = 0, authenticationAtCallback = -1
  const result = await port.read(incoming, "cases", (state, authority) => {
    callbacks++
    authenticationAtCallback = fixture.authentication.length - before
    return { state, authority }
  })
  return { result, callbacks, authenticationAtCallback, authentication: fixture.authentication.slice(before) }
}

test("C14 C08 child reads preserve the complete product graph, ACL, fresh copies and both real authorizations", async () => bounded(async (deadline) => {
  await withFixture(deadline, false, async (fixture) => {
    expect(fixture.sourceInput.projectScope).toBe(fixture.sourceInput.installedDashboardProjector)
    expect(isLocalSnapshotAuthorityReader(fixture.store, fixture.store.observeAuthority)).toBe(true)
    expect(isCurrentChoiceSnapshotAuthorityReader(fixture.choice.persistence, fixture.store.observeAuthority)).toBe(true)
    expect(isSfProductStateReader(fixture.authority.state, fixture.persistence)).toBe(true)
    expect(isSfAclStateAuthorize(fixture.canonicalAuthorize)).toBe(true)
    expect(isSfAclStateAuthorize(fixture.opaqueAuthorize)).toBe(false)
    expect(fixture.receivers).toHaveLength(1)
    expect(fixture.captured.createId).toBe(fixture.createId)
    expect(Object.isFrozen(fixture.captured)).toBe(false)
    expect(Object.getOwnPropertyDescriptor(fixture.captured, "c14ReceiverProbe")?.value).toBe("receiver preserved")
    const before = await fixture.durable()
    const product = before.data.__sfProductV1
    expect(product).toBeDefined()
    expect(before.data.c14DomainOnly).toEqual(domain)
    expect(before.data.access).toEqual({ person: { assigned: ["c14-assigned"], domains: ["c14-domain"] } })
    expect(before.sfSources?.schemaVersion).toBe(1)
    expect(before.audit.length).toBeGreaterThan(0)
    const outcomes: { mode: ReadMode; callbacks: number; authentication: number; opaqueAuthorizationSnapshots: number }[] = []
    for (const mode of ["readonly", "preimage", "top-level"] as const) {
      const incoming = fixture.request()
      let copies = 0, authenticated = 0
      await inContext(fixture, mode, incoming.signal, async () => {
        if (mode === "readonly") expect(currentSfReadonlyAuthorityData(fixture.persistence, [])?.current()).toBe(true)
        else if (mode === "preimage") expect(fixture.store.observeAuthority!([])?.current()).toBe(true)
        const first = await read(fixture, incoming)
        const firstValue = stateValue(first.result)
        expect(first.callbacks).toBe(1)
        expect(first.authenticationAtCallback).toBe(3)
        expect(first.authentication.map((entry) => entry.surface))
          .toEqual(["dashboard", "planner", "procurement", "dashboard", "planner", "procurement"])
        expect(first.authentication[0]?.roles).toEqual(roleMap(before, "dashboard"))
        expect(first.authentication[3]?.roles).toEqual(roleMap(before, "dashboard"))
        expect<unknown>(firstValue.state).toEqual(product)
        expect(firstValue.state.preferences.c14).toEqual(preference)
        firstValue.state.preferences.c14 = { changedOnlyInReturnedCopy: true }
        firstValue.state.cases[caseRef.id] = { ...required(firstValue.state.cases[caseRef.id], "case copy"), objective: "returned copy only" }
        const second = await read(fixture, incoming)
        const secondValue = stateValue(second.result)
        expect(second.callbacks).toBe(1)
        expect(second.authenticationAtCallback).toBe(3)
        expect(second.authentication).toHaveLength(6)
        expect<unknown>(secondValue.state).toEqual(product)
        expect(secondValue.state).not.toBe(firstValue.state)
        expect(secondValue.state.cases).not.toBe(firstValue.state.cases)
        expect(secondValue.state.preferences).not.toBe(firstValue.state.preferences)
        expect(secondValue.authority).toEqual(firstValue.authority)
        const snapshotStart = fixture.opaqueSnapshots.length
        const full = await read(fixture, incoming, fixture.custom)
        expect(full.callbacks).toBe(1)
        expect(full.authenticationAtCallback).toBe(3)
        expect(full.authentication).toHaveLength(6)
        expect(stateValue(full.result)).toEqual(secondValue)
        const snapshots = fixture.opaqueSnapshots.slice(snapshotStart)
        expect(snapshots).toHaveLength(2)
        for (const snapshot of snapshots) {
          expect(observeLocalProductRead(snapshot)).toBeUndefined()
          expect(snapshot).toEqual(before)
          expect(snapshot.data.c14DomainOnly).toEqual(domain)
        }
        copies = first.callbacks + second.callbacks + full.callbacks
        authenticated = first.authentication.length + second.authentication.length + full.authentication.length
        outcomes.push({ mode, callbacks: copies, authentication: authenticated, opaqueAuthorizationSnapshots: snapshots.length })
      })
      expect(copies).toBe(3)
      expect(authenticated).toBe(18)
      expect(await fixture.durable()).toEqual(before)
    }
    const changed = { ...preference, nested: { version: 2, enabled: false } }
    const mutation = await fixture.authority.state.transaction(fixture.request(), {
      namespace: "preferences", expectedStorageVersion: 1,
      targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation,
      idempotencyKey: "c14-preference-change", commandDigest: digestSfValue(changed),
    }, async (state) => {
      state.preferences.c14 = changed
      return { commit: true, value: true }
    })
    expect(stateValue(mutation)).toBe(true)
    const current = await inContext(fixture, "readonly", deadline, () => read(fixture, fixture.request()))
    const value = stateValue(current.result)
    expect(value.state.preferences.c14).toEqual(changed)
    expect(value.state.versions.preferences).toBe(2)
    expect(value.state.revision).toBeGreaterThan(1)
    expect(current.callbacks).toBe(1)
    expect(current.authentication).toHaveLength(6)
    expect((await fixture.durable()).data.c14DomainOnly).toEqual(domain)
    console.log("SF_C14_SNAPSHOT_CONTROL " + JSON.stringify({
      scenario: "complete-product-and-fresh-authorization", qualification: false,
      outcomes, subsequentPreferenceVersion: value.state.versions.preferences,
      createIdReceiver: "original mutable C08 input", projector: "installed original",
      limit: "top-level stays full; no parse count, domain-size ratio or performance qualification",
    }))
  })
}), 120_000)

test("C14 projection refuses live drift and preserves opaque, scoped, abort, error and poison semantics", async () => bounded(async (deadline) => {
  const outcomes: { scenario: string; callbacks: number; authentication?: number; replacementCalls?: number }[] = []
  await withFixture(deadline, false, async (fixture) => {
    const before = await fixture.durable()
    // Unlike a counter around a pinned store method, live authorizer drift is a
    // behavioral oracle: the projected read must stop before invoking its body;
    // the custom opaque C08 retains the original full-view authorization route.
    for (const route of [
      { mode: "readonly", scoped: false },
      { mode: "preimage", scoped: false },
      { mode: "readonly", scoped: true },
    ] as const) for (const opaque of [false, true]) {
      const incoming = fixture.request()
      const input = opaque ? fixture.customInput : fixture.captured
      const port = opaque ? fixture.custom : fixture.authority.state
      const original = input.authorize
      let callbacks = 0, replacementCalls = 0, hookCalls = 0
      let result: SfStateResult<string> | undefined, failure: unknown
      let authentication = 0, scopedCurrent = false
      let warm: Awaited<ReturnType<typeof read>> | undefined
      await inContext(fixture, route.mode, incoming.signal, async () => {
        const perform = async () => {
          const start = fixture.authentication.length
          const replacement: StateInput["authorize"] = (...args) => {
            replacementCalls++
            return original.call(input, ...args)
          }
          fixture.control.afterDashboard = () => { hookCalls++; input.authorize = replacement }
          try {
            result = await port.read(incoming, "cases", () => { callbacks++; return "whole original callback" })
          } catch (error) { failure = error }
          finally { input.authorize = original; fixture.control.afterDashboard = undefined }
          authentication = fixture.authentication.length - start
        }
        if (route.scoped) {
          const native = required(fixture.store.observeAuthority!([]), "native scope owner")
          const checked = await withSfScopedSourceChecks({
            owner: fixture.authority.host, request: incoming, current: () => {
              const active = fixture.store.observeAuthority!([])
              return !!active && active.identity === native.identity && active.current()
            },
          }, async () => {
            warm = await read(fixture, incoming, port)
            await perform()
          })
          scopedCurrent = checked.current()
        } else await perform()
      })
      expect(hookCalls).toBe(1)
      if (opaque) {
        expect(failure).toBeUndefined()
        expect(stateValue(required(result, "opaque C08 result"))).toBe("whole original callback")
        expect(callbacks).toBe(1)
        expect(replacementCalls).toBe(1)
        expect(authentication).toBe(6)
      } else {
        expect(failure).toBeInstanceOf(Error)
        expect(failure instanceof Error ? failure.message : undefined).toBe("SF_PRODUCT_READ_PROJECTION_CHANGED")
        expect(result).toBeUndefined()
        expect(callbacks).toBe(0)
        expect(replacementCalls).toBe(0)
        expect(authentication).toBe(3)
      }
      if (route.scoped) {
        const observed = required(warm, "canonical scoped read")
        expect(observed.callbacks).toBe(1)
        expect(observed.authentication).toHaveLength(6)
        expect<unknown>(stateValue(observed.result).state).toEqual(before.data.__sfProductV1)
        expect(scopedCurrent).toBe(true)
      }
      outcomes.push({ scenario: route.mode + (route.scoped ? "-source-checks" : "") + (opaque ? "-opaque-drift" : "-projected-drift"),
        callbacks, authentication, replacementCalls })
      expect(await fixture.durable()).toEqual(before)
    }

    // A getter on the Source facade is never invoked merely to establish the
    // private admission. The runtimeStore spread still holds its original method.
    const descriptor = required(Object.getOwnPropertyDescriptor(fixture.sources, "transaction"), "source transaction descriptor")
    const transaction = fixture.sources.transaction
    let sourceGets = 0
    Object.defineProperty(fixture.sources, "transaction", {
      configurable: true, enumerable: descriptor.enumerable, get: () => { sourceGets++; return transaction },
    })
    let full: Awaited<ReturnType<typeof read>> | undefined
    try { full = await inContext(fixture, "readonly", deadline, () => read(fixture, fixture.request())) }
    finally { Object.defineProperty(fixture.sources, "transaction", descriptor) }
    const fullValue = required(full, "accessor fallback read")
    expect(sourceGets).toBe(0)
    expect(fullValue.callbacks).toBe(1)
    expect<unknown>(stateValue(fullValue.result).state).toEqual(before.data.__sfProductV1)
    outcomes.push({ scenario: "source-accessor-full-fallback", callbacks: fullValue.callbacks })

    // Selection precedes CurrentChoice's original authorizeCommit lookup. A
    // getter that changes its driver there must invalidate an already projected
    // Source callback before any C08 authorization/body, without replay.
    const originalDriver = fixture.choiceInput.persistence
    let commitGets = 0, driverDriftCallbacks = 0, driverDriftFailure: unknown
    let driftAuthentication = 0
    Object.defineProperty(fixture.choiceInput, "authorizeCommit", {
      configurable: true, get: () => {
        commitGets++
        fixture.choiceInput.persistence = { ...fixture.store }
        return undefined
      },
    })
    try {
      await inContext(fixture, "readonly", deadline, async () => {
        const start = fixture.authentication.length
        try {
          await fixture.authority.state.read(fixture.request(), "cases", () => { driverDriftCallbacks++; return true })
        } catch (error) { driverDriftFailure = error }
        driftAuthentication = fixture.authentication.length - start
      })
    } finally {
      fixture.choiceInput.persistence = originalDriver
      Reflect.deleteProperty(fixture.choiceInput, "authorizeCommit")
    }
    expect(commitGets).toBe(1)
    expect(driverDriftCallbacks).toBe(0)
    expect(driftAuthentication).toBe(0)
    expect(driverDriftFailure instanceof Error ? driverDriftFailure.message : undefined).toBe("SF_PRODUCT_READ_PROJECTION_CHANGED")
    outcomes.push({ scenario: "driver-drift-before-body", callbacks: driverDriftCallbacks, authentication: driftAuthentication })

    // CurrentChoice's real scoped wrapper changes the native callback identity.
    // Compare the two original C08 producers, including any publication checks;
    // the aggregate authentication count in this route is not claimed to be two.
    await fixture.ui(async (call, incoming) => {
      await inContext(fixture, "readonly", incoming.signal, () => fixture.choice.run(call, async () => {
        const canonical = await read(fixture, incoming)
        const opaque = await read(fixture, incoming, fixture.custom)
        expect(canonical.callbacks).toBe(1)
        expect(opaque.callbacks).toBe(1)
        expect(stateValue(canonical.result)).toEqual(stateValue(opaque.result))
        expect<unknown>(stateValue(canonical.result).state).toEqual(before.data.__sfProductV1)
        expect(canonical.authentication.length).toBe(opaque.authentication.length)
        expect(canonical.authentication.length).toBeGreaterThanOrEqual(6)
        outcomes.push({ scenario: "CurrentChoice-scoped-full-fallback", callbacks: canonical.callbacks + opaque.callbacks,
          authentication: canonical.authentication.length + opaque.authentication.length })
      }))
    })


    let revokedCallbacks = 0, revoked: SfStateResult<string> | undefined
    const authBeforeRevoke = fixture.authentication.length
    try {
      revoked = await inContext(fixture, "readonly", deadline, () =>
        fixture.authority.state.read(fixture.request(), "cases", () => {
          revokedCallbacks++
          fixture.control.active = false
          return "must not survive the second authorization"
        }))
    } finally { fixture.control.active = true }
    expect(revoked).toEqual({ status: "denied", reason: "product-authority-changed" })
    expect(revokedCallbacks).toBe(1)
    expect(fixture.authentication.length - authBeforeRevoke).toBe(6)
    outcomes.push({ scenario: "real-authority-revoked-after-body", callbacks: revokedCallbacks, authentication: 6 })

    const sentinel = new Error("C14 callback sentinel")
    let thrown: unknown, errorCallbacks = 0, afterError: Awaited<ReturnType<typeof read>> | undefined
    await inContext(fixture, "readonly", deadline, async () => {
      try {
        await fixture.authority.state.read(fixture.request(), "cases", () => { errorCallbacks++; throw sentinel })
      } catch (error) { thrown = error }
      afterError = await read(fixture, fixture.request())
    })
    expect(thrown).toBe(sentinel)
    expect(errorCallbacks).toBe(1)
    expect<unknown>(stateValue(required(afterError, "read after callback error").result).state).toEqual(before.data.__sfProductV1)
    outcomes.push({ scenario: "callback-error-without-replay-or-poison", callbacks: errorCallbacks })

    const controller = new AbortController(), abort = new Error("C14 actual Request abort")
    const incoming = fixture.request(controller.signal)
    let abortFailure: unknown, abortCallbacks = 0, abortAccepted = false
    const authBeforeAbort = fixture.authentication.length
    try {
      await inContext(fixture, "readonly", incoming.signal, async () => {
        await fixture.authority.state.read(incoming, "cases", () => {
          abortCallbacks++
          controller.abort(abort)
          return "must not be accepted"
        })
      })
      abortAccepted = true
    } catch (error) { abortFailure = error }
    expect(abortFailure).toBe(abort)
    expect(abortAccepted).toBe(false)
    expect(abortCallbacks).toBe(1)
    expect(fixture.authentication.length - authBeforeAbort).toBe(3)
    outcomes.push({ scenario: "request-abort-after-body", callbacks: abortCallbacks, authentication: 3 })

    let poisonCallbacks = 0, nestedWrites = 0, poisoned = false, accepted = false
    let nestedFailure: unknown, rootFailure: unknown
    try {
      await inContext(fixture, "readonly", deadline, async () => {
        await fixture.authority.state.read(fixture.request(), "cases", async () => {
          poisonCallbacks++
          try {
            await fixture.persistence.transaction("dashboard", async (snapshot) => {
              nestedWrites++
              snapshot.data.c14DomainOnly = { mustNeverCommit: true }
              return { commit: true, value: undefined }
            }, { signal: deadline })
          } catch (error) { nestedFailure = error }
          poisoned = fixture.store.currentSnapshotScope?.()?.poisoned === true
          return "must not be accepted"
        })
      })
      accepted = true
    } catch (error) { rootFailure = error }
    expect(nestedFailure instanceof Error ? nestedFailure.message : undefined).toBe("Nested local writes are forbidden")
    expect(rootFailure).toBeInstanceOf(Error)
    expect(poisonCallbacks).toBe(1)
    expect(nestedWrites).toBe(1)
    expect(poisoned).toBe(true)
    expect(accepted).toBe(false)
    expect(await fixture.durable()).toEqual(before)
    outcomes.push({ scenario: "caught-nested-write-still-poisons-owner", callbacks: poisonCallbacks })


    // The Dashboard access field is absent; both sibling ACLs are own fields.
    // Thus their native current() checks do not accidentally mask the precise
    // gap between authenticate resolving and the Dashboard access lookup.
    for (const surface of ["planner", "procurement"] as const) {
      await fixture.persistence.transaction(surface, async (snapshot) => {
        snapshot.data.roleMap = roleMap(snapshot, surface)
        snapshot.data.access = { person: { assigned: [], domains: [] } }
        return { commit: true, value: undefined }
      }, { signal: deadline })
    }
    await fixture.persistence.transaction("dashboard", async (snapshot) => {
      delete snapshot.data.access
      return { commit: true, value: undefined }
    }, { signal: deadline })
    const beforePrototype = await fixture.durable()
    expect(Object.hasOwn(beforePrototype.data, "access")).toBe(false)
    for (const scenario of ["early-prototype-full", "late-prototype-projected", "late-prototype-opaque"] as const) {
      const saved = Object.getOwnPropertyDescriptor(Object.prototype, "access")
      expect(saved).toBeUndefined()
      const incoming = fixture.request()
      const port = scenario === "late-prototype-opaque" ? fixture.custom : fixture.authority.state
      const getterReceivers: unknown[] = []
      let callbacks = 0, installed = 0, failure: unknown, result: SfStateResult<string> | undefined
      const install = () => {
        installed++
        Object.defineProperty(Object.prototype, "access", {
          configurable: true,
          get: function (this: unknown) {
            getterReceivers.push(this)
            return { person: { assigned: [], domains: [] } }
          },
        })
      }
      const authStart = fixture.authentication.length
      try {
        if (scenario === "early-prototype-full") install()
        else fixture.control.afterDashboard = install
        await inContext(fixture, "readonly", incoming.signal, async () => {
          result = await port.read(incoming, "cases", () => { callbacks++; return "original full-view receiver" })
        })
      } catch (error) { failure = error }
      finally {
        fixture.control.afterDashboard = undefined
        if (saved) Object.defineProperty(Object.prototype, "access", saved)
        else Reflect.deleteProperty(Object.prototype, "access")
      }
      expect(installed).toBe(1)
      if (scenario === "late-prototype-projected") {
        expect(failure instanceof Error ? failure.message : undefined).toBe("SF_PRODUCT_READ_PROJECTION_CHANGED")
        expect(result).toBeUndefined()
        expect(callbacks).toBe(0)
        expect(getterReceivers).toHaveLength(0)
        expect(fixture.authentication.length - authStart).toBe(3)
      } else {
        expect(failure).toBeUndefined()
        expect(stateValue(required(result, "full prototype result"))).toBe("original full-view receiver")
        expect(callbacks).toBe(1)
        expect(getterReceivers).toHaveLength(2)
        expect(getterReceivers[0]).toBe(getterReceivers[1])
        for (const receiver of getterReceivers) {
          expect<unknown>(receiver && typeof receiver === "object"
            ? Object.getOwnPropertyDescriptor(receiver, "c14DomainOnly")?.value : undefined).toEqual(domain)
        }
        expect(fixture.authentication.length - authStart).toBe(6)
      }
      expect(Object.getOwnPropertyDescriptor(Object.prototype, "access")).toBeUndefined()
      expect(await fixture.durable()).toEqual(beforePrototype)
      outcomes.push({ scenario, callbacks, authentication: fixture.authentication.length - authStart })
    }

    // Restoration is outside the fault scopes. A new, unrelated native root is
    // eligible again and sees exactly the durable graph, not an escaped copy.
    const final = await inContext(fixture, "readonly", deadline, () => read(fixture, fixture.request()))
    expect<unknown>(stateValue(final.result).state).toEqual(before.data.__sfProductV1)
    expect(final.callbacks).toBe(1)
    expect(final.authentication).toHaveLength(6)
  })
  await withFixture(deadline, true, async (fixture) => {
    expect(isCurrentChoiceSnapshotAuthorityReader(fixture.choice.persistence, fixture.store.observeAuthority)).toBe(false)
    const before = await fixture.durable()
    await inContext(fixture, "readonly", deadline, async () => {
      const incoming = fixture.request()
      const canonical = await read(fixture, incoming)
      const opaque = await read(fixture, incoming, fixture.custom)
      expect(canonical.callbacks).toBe(1)
      expect(opaque.callbacks).toBe(1)
      expect(stateValue(canonical.result)).toEqual(stateValue(opaque.result))
      expect<unknown>(stateValue(canonical.result).state).toEqual(before.data.__sfProductV1)
      for (const snapshot of fixture.opaqueSnapshots) expect(snapshot.data.c14DomainOnly).toEqual(domain)
      outcomes.push({ scenario: "opaque-native-driver-full-fallback", callbacks: canonical.callbacks + opaque.callbacks })
    })
    expect(await fixture.durable()).toEqual(before)
  })
  expect(outcomes).toHaveLength(17)
  console.log("SF_C14_SNAPSHOT_CONTROL " + JSON.stringify({
    scenario: "opaque-equivalence-and-live-refusal", qualification: false, outcomes,
    limit: "functional route and refusal evidence only; no latency, parse-count or clean Analytics claim",
  }))
}), 120_000)


// The old two C14 tests retain their original 110/120-second limits. These
// additional bounded cases fit the same whole-file 300/360-second envelope.
async function boundedC15<T>(work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(new Error("C15 control cooperative deadline")), 18_000)
  try { return await work(controller.signal) } finally { clearTimeout(timer) }
}
type C15Graph = { graph: Record<string, unknown>; authority: SfStateAuthority }
type C15Read = (state: Readonly<SfProductState>, authority: SfStateAuthority) => unknown | Promise<unknown>

test("C15 whole graph selections preserve complete shape, metadata, authorization and detached values", async () => boundedC15(async (deadline) => {
  await withFixture(deadline, false, async (fixture) => {
    // Valid durable setup deliberately includes an unknown graph and both
    // optional absence and own undefined. Neither is a manufactured default.
    await fixture.store.transaction("dashboard", async (snapshot) => {
      const state = object(snapshot.data.__sfProductV1)
      object(state.reviews).c15 = { unselected: [{ label: "review", nested: [1, 2, 3] }] }
      object(state.preferences).c15 = { branches: [{ values: [4, 5] }, { values: [6, 7] }] }
      state.c15Unknown = { retained: [{ value: "complete unknown field" }] }
      state.claimBindings = undefined
      Reflect.deleteProperty(state, "nativeRuns")
      return { commit: true, value: undefined }
    }, { signal: deadline })
    const before = await fixture.durable(), product = object(before.data.__sfProductV1)
    const outcomes: { mode: ReadMode; namespace: "cases" | "preferences"; callbacks: number; authentication: number }[] = []
    await fixture.ui(async (call, incoming) => {
      expect(Object.isFrozen(call)).toBe(true)
      for (const mode of ["readonly", "preimage"] as const) for (const namespace of ["cases", "preferences"] as const) {
        deadline.throwIfAborted()
        await inContext(fixture, mode, incoming.signal, async () => {
          // Inspect the actual native copy contract separately from the C08
          // chain. Its capability neither replaces nor counts an authorization.
          const owner = required(fixture.store.observeAuthority!([]), "native C15 owner")
          const probe = async (snapshot: Snapshot) => {
            const observed = observeLocalProductRead(snapshot)
            return { commit: false, value: { snapshot, selection: observed?.selection, current: observed?.current() } }
          }
          const copied = await fixture.store.transaction("dashboard", probe, {
            signal: incoming.signal, dashboardProductRead: { identity: owner.identity, work: probe, selection: namespace },
          })
          expect(copied.selection).toBe(namespace)
          expect(copied.current).toBe(true)
          const selected = object(copied.snapshot.data.__sfProductV1)
          expect(selected[namespace]).toEqual(product[namespace])
          expect(selected[namespace === "cases" ? "preferences" : "cases"]).toEqual({})
          expect(selected.reviews).toEqual({})
          expect(selected.schemaVersion).toBe(product.schemaVersion)
          expect(selected.revision).toBe(product.revision)
          expect(selected.incarnation).toBe(product.incarnation)
          expect(selected.versions).toEqual(product.versions)
          expect(selected.c15Unknown).toEqual(product.c15Unknown)
          expect(Object.hasOwn(selected, "claimBindings")).toBe(true)
          expect(selected.claimBindings).toBeUndefined()
          expect(Object.hasOwn(selected, "nativeRuns")).toBe(false)
          expect(copied.snapshot.data.roleMap).toEqual(before.data.roleMap)
          expect(copied.snapshot.data.access).toEqual(before.data.access)
          expect({ ...copied.snapshot, data: before.data }).toEqual(before)
          expect(copied.snapshot.data.c14DomainOnly).toBeUndefined()

          const start = fixture.authentication.length, callbackAt: number[] = []
          let callbacks = 0
          const observe = (graph: Record<string, unknown>, authority: SfStateAuthority): C15Graph => {
            callbacks++
            callbackAt.push(fixture.authentication.length - start)
            return { graph, authority }
          }
          const callback = namespace === "cases"
            ? selectSfCasesRead<C15Graph>(call, (state, authority) => observe(state.cases, authority))
            : selectSfPreferencesRead<C15Graph>(call, (state, authority) => observe(state.preferences, authority))
          const first = await fixture.authority.state.read<C15Graph>(incoming, namespace, callback)
          const firstValue = stateValue(first)
          expect<unknown>(firstValue.graph).toEqual(product[namespace])
          expect(first).toMatchObject({ status: "ok", storageVersion: object(product.versions)[namespace],
            aggregateRevision: product.revision, incarnation: product.incarnation })
          firstValue.graph.c15DetachedMutation = { onlyThisResult: true }
          const second = await fixture.authority.state.read<C15Graph>(incoming, namespace, callback)
          const secondValue = stateValue(second)
          expect<unknown>(secondValue.graph).toEqual(product[namespace])
          expect(secondValue.graph).not.toBe(firstValue.graph)
          expect(secondValue.authority).toEqual(firstValue.authority)
          const snapshotStart = fixture.opaqueSnapshots.length
          const full = await fixture.custom.read<C15Graph>(incoming, namespace, callback)
          expect(full).toEqual(second)
          expect(stateValue(full).graph).not.toBe(secondValue.graph)
          expect(callbacks).toBe(3)
          expect(callbackAt).toEqual([3, 9, 15])
          expect(fixture.authentication.length - start).toBe(18)
          const snapshots = fixture.opaqueSnapshots.slice(snapshotStart)
          expect(snapshots).toHaveLength(2)
          for (const snapshot of snapshots) {
            expect(observeLocalProductRead(snapshot)).toBeUndefined()
            expect(snapshot).toEqual(before)
          }
          outcomes.push({ mode, namespace, callbacks, authentication: fixture.authentication.length - start })
        })
        expect(await fixture.durable()).toEqual(before)
      }

      // Custom snapshots remain on the complete path. Reachable aliasing is
      // exercised there, where the durable native codec's no-alias premise does
      // not apply; the original selected clone must preserve it independently.
      const original = fixture.customInput.authorize
      let authorizations = 0, callbacks = 0
      fixture.customInput.authorize = (request, snapshot, namespace, mode) => {
        authorizations++
        const value = object(object(object(snapshot.data.__sfProductV1).cases)[caseRef.id])
        const shared = { nested: ["one graph"] }
        value.c15Left = shared
        value.c15Right = shared
        return original.call(fixture.customInput, request, snapshot, namespace, mode)
      }
      try {
        await inContext(fixture, "readonly", incoming.signal, async () => {
          const callback = selectSfCasesRead(call, (state) => { callbacks++; return state.cases[caseRef.id] })
          const first = object(stateValue(await fixture.custom.read(incoming, "cases", callback)))
          const second = object(stateValue(await fixture.custom.read(incoming, "cases", callback)))
          expect(first.c15Left).toBe(first.c15Right)
          expect(second.c15Left).toBe(second.c15Right)
          expect(first.c15Left).not.toBe(second.c15Left)
          object(first.c15Left).changed = "first detached clone only"
          expect(object(first.c15Right).changed).toBe("first detached clone only")
          expect(object(second.c15Left).changed).toBeUndefined()
        })
      } finally { fixture.customInput.authorize = original }
      expect(authorizations).toBe(4)
      expect(callbacks).toBe(2)
      expect(await fixture.durable()).toEqual(before)
    })
    expect(outcomes).toHaveLength(4)
    console.log("SF_C15_SELECTION_CONTROL " + JSON.stringify({
      scenario: "whole-graphs-and-shape", qualification: false, outcomes,
      aliases: "custom full path retained; each selected callback receives its own graph",
      limit: "native structural copy and functional composition; no latency or current Analytics result",
    }))
  })
}), 20_000)

test("C15 selections refuse drift and preserve invalid, legacy, late and competing read decisions", async () => boundedC15(async (deadline) => {
  await withFixture(deadline, false, async (fixture) => {
    const before = await fixture.durable(), product = object(before.data.__sfProductV1)
    expect(Object.hasOwn(product, "commandProposals")).toBe(true)
    expect(Object.getOwnPropertyDescriptor(Object.prototype, "commandProposals")).toBeUndefined()
    const outcomes: { scenario: string; callbacks: number | null; authentication: number; outcome: string }[] = []
    await fixture.ui(async (call, incoming) => {
      // This is a semantic admission oracle. C14's full copy has its own
      // commandProposals and does not need this additional narrow-view gate.
      for (const mode of ["readonly", "preimage"] as const) for (const namespace of ["cases", "preferences"] as const) {
        let callbacks = 0, prototypeReads = 0, hooks = 0, failure: unknown
        let result: SfStateResult<unknown> | undefined
        const callback: C15Read = namespace === "cases"
          ? selectSfCasesRead(call, (state) => { callbacks++; return state.cases })
          : selectSfPreferencesRead(call, (state) => { callbacks++; return state.preferences })
        const start = fixture.authentication.length
        await inContext(fixture, mode, incoming.signal, async () => {
          fixture.control.afterDashboard = () => {
            hooks++
            Object.defineProperty(Object.prototype, "commandProposals", {
              configurable: true, get: () => { prototypeReads++; throw new Error("C15 inherited payload must not be observed") },
            })
          }
          try { result = await fixture.authority.state.read(incoming, namespace, callback) }
          catch (error) { failure = error }
          finally {
            fixture.control.afterDashboard = undefined
            Reflect.deleteProperty(Object.prototype, "commandProposals")
          }
        })
        expect(hooks).toBe(1)
        expect(prototypeReads).toBe(0)
        expect(callbacks).toBe(0)
        expect(result).toBeUndefined()
        expect(failure instanceof Error ? failure.message : undefined).toBe("SF_PRODUCT_READ_PROJECTION_CHANGED")
        expect(fixture.authentication.length - start).toBe(3)
        expect(await fixture.durable()).toEqual(before)
        outcomes.push({ scenario: mode + "-" + namespace + "-narrow-drift", callbacks, authentication: 3, outcome: "refused before callback" })
      }

      // Canonical source-check scopes do not disable the narrow route. Query
      // the current native child rather than using a parent's lexical current().
      let scopedCallbacks = 0, scopedFailure: unknown, scopedHooks = 0
      const scopedStart = fixture.authentication.length
      await inContext(fixture, "readonly", incoming.signal, async () => {
        const owner = required(fixture.store.observeAuthority!([]), "scoped C15 owner")
        await withSfScopedSourceChecks({
          owner: fixture.authority.host, request: incoming, current: () => {
            const active = fixture.store.observeAuthority!([])
            return !!active && active.identity === owner.identity && active.current()
          },
        }, async () => {
          fixture.control.afterDashboard = () => {
            scopedHooks++
            Object.defineProperty(Object.prototype, "commandProposals", { configurable: true, value: "selection drift" })
          }
          try {
            await fixture.authority.state.read(incoming, "cases",
              selectSfCasesRead(call, () => { scopedCallbacks++; return "must not escape" }))
          } catch (error) { scopedFailure = error }
          finally {
            fixture.control.afterDashboard = undefined
            Reflect.deleteProperty(Object.prototype, "commandProposals")
          }
        })
      })
      expect(scopedHooks).toBe(1)
      expect(scopedCallbacks).toBe(0)
      expect(scopedFailure instanceof Error ? scopedFailure.message : undefined).toBe("SF_PRODUCT_READ_PROJECTION_CHANGED")
      expect(fixture.authentication.length - scopedStart).toBe(3)
      outcomes.push({ scenario: "active-source-checks-narrow-drift", callbacks: scopedCallbacks, authentication: 3, outcome: "refused before callback" })

      let egressCallbacks = 0, egressHooks = 0, egressFailure: unknown
      let egressResult: SfStateResult<unknown> | undefined
      const egressStart = fixture.authentication.length
      await inContext(fixture, "readonly", incoming.signal, async () => {
        try {
          egressResult = await fixture.authority.state.read(incoming, "cases", selectSfCasesRead(call, () => {
            egressCallbacks++
            fixture.control.afterDashboard = () => {
              egressHooks++
              Object.defineProperty(Object.prototype, "commandProposals", { configurable: true, value: "second authorization drift" })
            }
            return "body returned before the second authorization"
          }))
        } catch (error) { egressFailure = error }
        finally {
          fixture.control.afterDashboard = undefined
          Reflect.deleteProperty(Object.prototype, "commandProposals")
        }
      })
      expect(egressCallbacks).toBe(1)
      expect(egressHooks).toBe(1)
      expect(egressResult).toBeUndefined()
      expect(egressFailure instanceof Error ? egressFailure.message : undefined).toBe("SF_PRODUCT_READ_PROJECTION_CHANGED")
      expect(fixture.authentication.length - egressStart).toBe(6)
      outcomes.push({ scenario: "narrow-second-authorization-drift", callbacks: 1, authentication: 6, outcome: "returned body withheld" })

      for (const scenario of ["case-precedence", "namespace-mismatch", "late-registration"] as const) {
        let callbacks = 0, hooks = 0, failure: unknown
        const lateRead = (state: Pick<SfProductState, "cases">) => { callbacks++; return { cases: state.cases, keys: Object.keys(state) } }
        let callback: C15Read
        if (scenario === "case-precedence") callback = selectSfCasesRead(call, selectSfCase(caseRef.id, call))
        else if (scenario === "namespace-mismatch") callback = selectSfPreferencesRead(call, (state) => {
          callbacks++; return { preferences: state.preferences, keys: Object.keys(state) }
        })
        else callback = lateRead
        let result: SfStateResult<unknown> | undefined
        const start = fixture.authentication.length
        await inContext(fixture, "readonly", incoming.signal, async () => {
          fixture.control.afterDashboard = () => {
            hooks++
            Object.defineProperty(Object.prototype, "commandProposals", { configurable: true, value: "full path remains valid" })
            if (scenario === "late-registration") selectSfCasesRead(call, lateRead)
          }
          try { result = await fixture.authority.state.read(incoming, "cases", callback) }
          catch (error) { failure = error }
          finally {
            fixture.control.afterDashboard = undefined
            Reflect.deleteProperty(Object.prototype, "commandProposals")
          }
        })
        expect(hooks).toBe(1)
        expect(failure).toBeUndefined()
        const value = stateValue(required(result, "full C15 fallback result"))
        if (scenario === "case-precedence") expect(value).toEqual(object(product.cases)[caseRef.id])
        else if (scenario === "namespace-mismatch") expect(value).toEqual({ preferences: product.preferences, keys: Object.keys(product) })
        else expect(value).toEqual({ cases: product.cases, keys: ["cases"] })
        expect(callbacks).toBe(scenario === "case-precedence" ? 0 : 1)
        expect(fixture.authentication.length - start).toBe(6)
        outcomes.push({ scenario, callbacks: scenario === "case-precedence" ? null : callbacks, authentication: 6,
          outcome: scenario === "case-precedence" ? "factory callback returned; not wrapped to count" : "original full fallback and selection order" })
      }

      for (const scenario of ["invalid-map", "invalid-version", "invalid-additive", "legacy"] as const) {
        const changed = structuredClone(product)
        if (scenario === "invalid-map") changed.outbox = []
        if (scenario === "invalid-version") object(changed.versions).unexpected = 0
        if (scenario === "invalid-additive") changed.nativeRuns = null
        if (scenario === "legacy") { Reflect.deleteProperty(changed, "biArtifacts"); Reflect.deleteProperty(object(changed.versions), "bi-artifacts") }
        await fixture.store.transaction("dashboard", async (snapshot) => {
          snapshot.data.__sfProductV1 = changed
          return { commit: true, value: undefined }
        }, { signal: deadline })
        let result: SfStateResult<unknown> | undefined, failure: unknown, callbacks = 0, hooks = 0
        const start = fixture.authentication.length
        try {
          await inContext(fixture, "readonly", incoming.signal, async () => {
            fixture.control.afterDashboard = () => {
              hooks++
              Object.defineProperty(Object.prototype, "commandProposals", { configurable: true, value: "must retain full validation" })
            }
            try {
              result = await fixture.authority.state.read(incoming, "cases",
                selectSfCasesRead(call, (state) => { callbacks++; return state.cases }))
            } catch (error) { failure = error }
            finally {
              fixture.control.afterDashboard = undefined
              Reflect.deleteProperty(Object.prototype, "commandProposals")
            }
          })
        } finally {
          await fixture.store.transaction("dashboard", async (snapshot) => {
            snapshot.data.__sfProductV1 = structuredClone(product)
            return { commit: true, value: undefined }
          }, { signal: deadline })
        }
        expect(hooks).toBe(1)
        expect(failure).toBeUndefined()
        if (scenario === "legacy") {
          expect(stateValue(required(result, "legacy read result"))).toEqual(product.cases)
          expect(callbacks).toBe(1)
          expect(fixture.authentication.length - start).toBe(6)
        } else {
          expect(result).toEqual({ status: "unavailable", reason: "invalid-product-state" })
          expect(callbacks).toBe(0)
          expect(fixture.authentication.length - start).toBe(3)
        }
        expect(await fixture.durable()).toEqual(before)
        outcomes.push({ scenario, callbacks, authentication: fixture.authentication.length - start,
          outcome: scenario === "legacy" ? "original legacy normalization" : "original invalid-product-state" })
      }

      for (const sentinel of [new Error("C15 selected callback sentinel"), undefined]) {
        let callbacks = 0, threw = false, received: unknown
        const start = fixture.authentication.length
        await inContext(fixture, "readonly", incoming.signal, async () => {
          try {
            await fixture.authority.state.read(incoming, "cases",
              selectSfCasesRead(call, () => { callbacks++; throw sentinel }))
          } catch (error) { threw = true; received = error }
          const healthy = await fixture.authority.state.read(incoming, "cases", selectSfCasesRead(call, (state) => state.cases))
          expect<unknown>(stateValue(healthy)).toEqual(product.cases)
        })
        expect(threw).toBe(true)
        expect(received).toBe(sentinel)
        expect(callbacks).toBe(1)
        expect(fixture.authentication.length - start).toBe(9)
        outcomes.push({ scenario: sentinel === undefined ? "throw-undefined" : "throw-sentinel", callbacks, authentication: 9, outcome: "original exception; next child remains usable" })
      }
      expect(await fixture.durable()).toEqual(before)
    })
    expect(outcomes).toHaveLength(15)
    expect(Object.getOwnPropertyDescriptor(Object.prototype, "commandProposals")).toBeUndefined()
    console.log("SF_C15_SELECTION_CONTROL " + JSON.stringify({
      scenario: "shape-precedence-and-drift", qualification: false, outcomes,
      limit: "narrow admission is proven by behavior; C14 preserves write poison, wrappers, abort and opaque stores",
    }))
  })
}), 20_000)
