import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfPlannerCalculationRoot } from "../../../../../../../apps/cli/src/sucafina-product/planner-calculation-root.ts"
import { createSfSourceFenceReader } from "../../../../../../../apps/cli/src/sucafina-product/source-fence-read.ts"
import { createCurrentChoiceFence, currentChoiceOwnsSnapshotTransactions, currentChoiceReadonlyAuthorityData } from "../../../../product/decisions/current-choice-preview.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence, currentSfReadonlyAuthorityData, currentSfReadonlySnapshotScope, plannerScopeAuthority } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector, sfPlannerProjectionSelector } from "../../../../product/integration/source-projections.ts"
import { createPlannerProduct } from "../../../../product/planner/product.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import type { Actor, Snapshot } from "../../../../runtime/contract.ts"

const at = "2027-02-02T00:00:00Z"
const period = { start: "2027-01-01", end: "2027-12-31" }
const origin = "https://readonly-chain.example.test"
const caseRef = { id: "readonly-case", incarnation: "readonly-incarnation", version: 1 }

function ok<T>(result: PortResult<T>): T {
  if (result.status !== "ok") throw new Error(result.status + ": " + result.reason)
  return result.value
}

// The actual SQLite driver is never instrumented or replaced in the positive
// fixture. Source identities, C08 state and UI leases come from their originals.
// The projectScope counter differs from installedDashboardProjector, so the
// Dashboard projector identity optimization is intentionally ineligible here.
// This fixture qualifies Planner/readonly provenance, not every Dashboard fast path.
async function withChain<T>(opaque: boolean, work: (fixture: Awaited<ReturnType<typeof createChain>>) => Promise<T>) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-current-choice-readonly-"))
  const store = await openLocalStore(path.join(directory, "store"))
  try { return await work(await createChain(store, directory, opaque)) }
  finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
}

async function createChain(store: Awaited<ReturnType<typeof openLocalStore>>, directory: string, opaque: boolean) {
  if (!store.readSnapshotRoot || !store.currentSnapshotScope || !store.transactionAll)
    throw new Error("Original LocalStore snapshot capabilities required")
  let authority: ReturnType<typeof createSfProductAuthority> | undefined
  const identity = { installationId: "readonly-installation", hostId: "readonly-host", projectId: "readonly-project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const choiceInput = {
    persistence: opaque ? { ...store } : store,
    host: () => {
      if (!authority) throw new Error("Original authority is not composed")
      return authority.host
    },
    identity: () => identity,
    operationIdentity: (call: TrustedDomainContext) =>
      call.kind === "ui" ? authority?.ui.operationIdentity(call) : undefined,
  }
  const choice = createCurrentChoiceFence(choiceInput)
  const counts = { authenticate: 0, project: 0, prepare: 0, authorize: 0 }
  const control: { active: boolean; afterAuthenticate?: () => void | Promise<void> } = { active: true }
  const project = createSfSourceScopeProjector(() => at)
  const sourceInput = {
    persistence: choice.persistence,
    createId: randomUUID,
    enumerate: enumerateSfSources,
    projectScope: (...args: Parameters<typeof project>) => { counts.project++; return project(...args) },
    observeAuthority: store.observeAuthority,
    holdTargetPreimage: store.holdTargetPreimage,
    hasSnapshotRoot: store.hasSnapshotRoot,
    installedDashboardProjector: project,
  }
  const sources = createSfSourcePersistence(sourceInput)
  const persistence = { ...store, ...choice.persistence, ...sources,
    ...(sources.transactionAll && store.holdTargetPreimage ? { dashboardSourceFence: Object.freeze({
      transaction: sources.transaction, transactionAll: sources.transactionAll,
      currentSnapshots: sources.currentSnapshots, currentSnapshot: sources.currentSnapshot,
      observeAuthority: sources.observeAuthority, readSealed: sources.readSealed,
      hasSnapshotRoot: sources.hasSnapshotRoot, readDashboardAuthority: sources.readDashboardAuthority,
      holdTargetPreimage: store.holdTargetPreimage,
      current: () => currentChoiceOwnsSnapshotTransactions(choice, choiceInput.persistence),
    }) } : {}),
  }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    // Same explicit source data fixture as calculation-ancestry-composition.
    // Its source reference and projection are issued by the original producer.
    snapshot.data = { versions: [{ id: "v0", name: "Readonly original Planner source", year: 2027, closed: 1,
      lines: [{ id: "line", name: "Service", ownerId: "person", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
  const requests = new WeakSet<Request>()
  const request = (signal?: AbortSignal) => {
    const incoming = new Request(origin + "/planner", { method: "POST", headers: { origin }, ...(signal ? { signal } : {}) })
    requests.add(incoming)
    return incoming
  }
  const composed = createSfProductAuthority({
    identity: () => identity, installationId: identity.installationId, origin, policyVersion: "readonly-policy",
    persistence, grants: [{ principalRef: "person", namespaces: ["cases", "preferences"],
      operations: ["sf_case_read", "sf_evidence_get"], humanActions: [] }],
    authenticate: async (incoming, scope) => {
      counts.authenticate++
      const hook = control.afterAuthenticate
      control.afterAuthenticate = undefined
      await hook?.()
      return requests.has(incoming) && control.active && scope ? { id: "person", canWrite: true,
        roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null
    },
    environment: async () => ({ at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined,
  })
  authority = composed
  const caseCreated = await composed.state.transaction(request(), {
    namespace: "cases", expectedStorageVersion: 0, targetRef: composed.creationTarget.ref,
    targetIncarnation: composed.creationTarget.incarnation, idempotencyKey: "readonly-case",
    commandDigest: digestSfValue(caseRef),
  }, async (state) => {
    state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "Exercise original readonly boundaries",
      horizon: period, currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [],
      costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    return { commit: true, value: true }
  })
  if (caseCreated.status !== "ok") throw new Error("Original C08 case fixture unavailable: " + caseCreated.status)
  const planner = createPlannerProduct({ host: composed.host, scopedSources: persistence,
    coverageFor: async () => ({ status: "unavailable", reason: "readonly-fixture-does-not-produce-coverage" }) })
  const ui = async <T>(work: (call: TrustedUiContext, incoming: Request) => Promise<T>, signal?: AbortSignal) => {
    const incoming = request(signal), digest = digestSfValue({})
    const call = ok(await composed.ui.admit(incoming, "sf_case_read", digest))
    try {
      expect(await composed.ui.validate(call, "sf_case_read", digest)).toBe(true)
      return await work(call, incoming)
    } finally { composed.ui.finish(call) }
  }
  const source = await ui(async (call) => ok(await planner.issueSource("v0", call)).evidence)
  const prepare = async (snapshot: Snapshot, call: TrustedUiContext, incoming: Request,
    hooks: { prepared?: () => void | Promise<void>; authorized?: (count: number) => void | Promise<void>;
      authorizationData?: Record<string, unknown>[]; mutateCopies?: boolean } = {}) => {
    counts.prepare++
    const principal = await composed.host.authenticate(incoming, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== call.binding.principalRef) return undefined
    const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
    const selector = sfPlannerProjectionSelector(snapshot, actor)
    if (hooks.mutateCopies) snapshot.data.versions = []
    await hooks.prepared?.()
    let phase = 0
    return {
      scope: { principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision,
        policyVersion: call.binding.policyVersion, recordType: "planner-version", recordId: "v0", selector },
      authorize: plannerScopeAuthority(async (acl) => {
        phase++
        counts.authorize++
        hooks.authorizationData?.push(structuredClone(acl.data))
        const current = await composed.host.authenticate(incoming, { surface: "planner", roleMap: roleMap(acl, "planner") })
        if (!current || current.id !== call.binding.principalRef) return false
        const currentRoles = current.roles.filter((role) => role.surface === "planner").map((role) => role.role)
        const currentActor: Actor = { id: current.id, roles: currentRoles,
          canWrite: current.canWrite && currentRoles.some((role) => role !== "viewer") }
        const admitted = digestSfValue(sfPlannerProjectionSelector(acl, currentActor)) === digestSfValue(selector)
        if (hooks.mutateCopies) acl.data.callbackMutation = phase
        await hooks.authorized?.(phase)
        return admitted
      }),
    }
  }
  const readPrepared = (call: TrustedUiContext, incoming: Request, hooks?: Parameters<typeof prepare>[3]) => {
    if (!persistence.readScopedSourcePrepared) throw new Error("Original prepared source reader unavailable")
    return persistence.readScopedSourcePrepared("planner", (snapshot) => prepare(snapshot, call, incoming, hooks), { signal: incoming.signal })
  }
  return { store, choice, choiceInput, sources, sourceInput, persistence, authority: composed, counts, control, request, ui,
    planner, source, readPrepared }
}

test("CurrentChoice readonly composition keeps original C08, Planner and fence readers live in legitimate child scopes", async () => {
  for (const opaque of [false, true]) await withChain(opaque, async (fixture) => {
    await fixture.ui(async (call, request) => {
      const root = createSfPlannerCalculationRoot({ host: fixture.authority.host })
      const original = await fixture.readPrepared(call, request)
      if (!original) throw new Error("Original materialized Planner source unavailable")
      const fences = createSfSourceFenceReader({ host: fixture.authority.host, persistence: fixture.persistence })
      const sourceFences = await fences(call)
      expect(sourceFences).toBeDefined()
      let initialized = 0, work = 0, guards = 0
      const prepared = await root.prepare(call, async () => { initialized++; return true }, () => true)
      expect(prepared).toBeDefined()
      if (!prepared) throw new Error("Real calculation root did not prepare")
      const result = await fixture.choice.run(call, () => prepared.run(async () => {
        work++
        const sealed = currentSfReadonlySnapshotScope(fixture.persistence)
        expect(!!sealed).toBe(!opaque)
        expect(!!currentChoiceReadonlyAuthorityData(fixture.choice.persistence, [])).toBe(!opaque)
        const originalRoot = fixture.store.currentSnapshotScope?.()?.identity
        fixture.choice.observe(call, (snapshots) => {
          guards++
          expect(snapshots.dashboard.data.__sfProductV1).toBeDefined()
          return true
        })
        const found = await fixture.authority.state.read(request, "cases", async (state) => {
          expect(root.allows(call)).toBe(true)
          expect(state.cases[caseRef.id]?.id).toBe(caseRef.id)
          expect(fixture.store.currentSnapshotScope?.()?.identity).toBe(originalRoot)
          const descendant = await root.prepare(call, async () => { throw new Error("Child must not initialize another root") }, () => true)
          expect(descendant).toBeDefined()
          if (!descendant) throw new Error("Legitimate calculation child was refused")
          const nested = await descendant.run(async () => {
            expect(root.allows(call)).toBe(true)
            const data: Record<string, unknown>[] = []
            const before = { ...fixture.counts }
            const source = await fixture.readPrepared(call, request, { authorizationData: data, mutateCopies: !opaque })
            expect(source).toEqual(original)
            expect(fixture.counts.prepare - before.prepare).toBe(1)
            expect(fixture.counts.authorize - before.authorize).toBe(2)
            expect(fixture.counts.project - before.project).toBe(1)
            expect(data).toHaveLength(2)
            if (!opaque) {
              expect(data).toEqual([{}, {}])
              expect(currentSfReadonlyAuthorityData(fixture.persistence, ["planner"])?.current()).toBe(true)
            } else expect(data.every((value) => Array.isArray(value.versions))).toBe(true)
            expect(fixture.store.currentSnapshot?.("planner")?.data.callbackMutation).toBeUndefined()
            expect(fixture.store.currentSnapshot?.("planner")?.data.versions).toHaveLength(1)
            const beforeFence = fixture.counts.authenticate
            expect(await fences(call)).toEqual(sourceFences)
            expect(fixture.counts.authenticate - beforeFence).toBeGreaterThanOrEqual(6)
            expect(await fixture.planner.sources.resolveForecastSource(fixture.source.refId, call))
              .toEqual({ status: "ok", value: { versionId: "v0", evidence: fixture.source } })
            expect(root.allows(call)).toBe(true)
            return { status: "ok", value: { caseId: state.cases[caseRef.id]!.id, source } }
          })
          expect(nested.status).toBe("ok")
          expect(root.allows(call)).toBe(true)
          return nested
        })
        expect(found.status).toBe("ok")
        expect(root.allows(call)).toBe(true)
        return { status: "ok", value: found }
      }))
      expect(result.status).toBe("ok")
      expect(initialized).toBe(1)
      expect(work).toBe(1)
      expect(guards).toBeGreaterThan(0)
      expect(fixture.persistence.currentSnapshots?.()).toBeUndefined()
      expect(await prepared.run(async () => { throw new Error("A prepared root must not replay") }))
        .toEqual({ status: "unavailable", reason: "calculation-read-root-unavailable" })
    })
  })
}, 45_000)

test("CurrentChoice readonly prepared Planner rejects owner and method drift after preparation and each authorization", async () => {
  await withChain(false, async (fixture) => {
    await fixture.ui(async (call, request) => {
      const original = await fixture.readPrepared(call, request)
      expect(original).toBeDefined()
      for (const phase of ["prepare", "authorize1", "authorize2"] as const) {
        for (const boundary of ["owner", "method"] as const) {
          const driver = fixture.sourceInput.persistence
          const descriptor = Object.getOwnPropertyDescriptor(driver, "transaction")
          if (!descriptor) throw new Error("Original CurrentChoice transaction missing")
          let replacements = 0, mutations = 0
          const replace = async () => {
            await Promise.resolve()
            mutations++
            if (boundary === "owner") fixture.sourceInput.persistence = { ...driver }
            else Object.defineProperty(driver, "transaction", { ...descriptor, value: () => {
              replacements++
              throw new Error("Replaced transaction must not execute")
            } })
          }
          await fixture.persistence.readSnapshotRoot!(async () => {
            try {
              const pending = fixture.readPrepared(call, request, {
                prepared: phase === "prepare" ? replace : undefined,
                authorized: async (count) => { if (phase === "authorize" + count) await replace() },
              })
              if (phase === "authorize2") await expect(pending).rejects.toThrow("SF_SOURCE_SCOPE_CALLBACK_MUTATION")
              else expect(await pending).toBeUndefined()
              expect(mutations).toBe(1)
              expect(replacements).toBe(0)
            } finally {
              fixture.sourceInput.persistence = driver
              Object.defineProperty(driver, "transaction", descriptor)
            }
          })
          // The rejected invocation is not retried. A distinct fresh read after
          // restoring the actual provider remains independently admissible.
          expect(await fixture.readPrepared(call, request)).toEqual(original)
        }
      }
    })
  })
}, 45_000)

test("CurrentChoice readonly calculation roots close escaped parent and child continuations and reject poisoned writes", async () => {
  await withChain(false, async (fixture) => {
    await fixture.ui(async (call) => {
      const root = createSfPlannerCalculationRoot({ host: fixture.authority.host })
      const releaseParent = Promise.withResolvers<void>(), releaseChild = Promise.withResolvers<void>()
      let parentLate: Promise<boolean> | undefined, childLate: Promise<boolean> | undefined
      let escapedChild: Awaited<ReturnType<typeof root.prepare>>, firstScope: ReturnType<typeof currentSfReadonlySnapshotScope>
      const prepared = await root.prepare(call, async () => true, () => true)
      if (!prepared) throw new Error("Original calculation root unavailable")
      expect(await prepared.run(async () => {
        firstScope = currentSfReadonlySnapshotScope(fixture.persistence)
        escapedChild = await root.prepare(call, async () => { throw new Error("Child initializer must not run") }, () => true)
        expect(escapedChild).toBeDefined()
        parentLate = releaseParent.promise.then(() => root.allows(call))
        await fixture.persistence.transaction("dashboard", async () => {
          expect(root.allows(call)).toBe(true)
          childLate = releaseChild.promise.then(() => root.allows(call))
          return { commit: false, value: undefined }
        })
        expect(root.allows(call)).toBe(true)
        return { status: "ok", value: true }
      })).toEqual({ status: "ok", value: true })
      releaseParent.resolve()
      releaseChild.resolve()
      expect(await parentLate).toBe(false)
      expect(await childLate).toBe(false)
      await fixture.persistence.readSnapshotRoot!(async () => {
        const secondScope = currentSfReadonlySnapshotScope(fixture.persistence)
        expect(firstScope?.identity).toBeDefined()
        expect(secondScope?.identity).not.toBe(firstScope?.identity)
        expect(secondScope?.bytesIdentity).toBe(firstScope?.bytesIdentity)
        expect(secondScope?.current()).toBe(true)
        // This proves that an owner-closed child cannot revive in another real
        // root; it does not isolate the identity comparator from owner closure.
        if (!escapedChild) throw new Error("No original descendant was retained")
        expect(await escapedChild.run(async () => { throw new Error("A new root must not admit an old child") }))
          .toEqual({ status: "unavailable", reason: "calculation-read-root-unavailable" })
      })
      const closedChild = await root.prepare(call, async () => true, () => true)
      if (!closedChild) throw new Error("Fresh calculation root unavailable")
      let escapedWhileParentOpen: Promise<boolean> | undefined
      const releaseClosedChild = Promise.withResolvers<void>()
      expect(await closedChild.run(async () => {
        await fixture.persistence.transaction("dashboard", async () => {
          escapedWhileParentOpen = releaseClosedChild.promise.then(() => root.allows(call))
          return { commit: false, value: undefined }
        })
        expect(root.allows(call)).toBe(true)
        releaseClosedChild.resolve()
        expect(await escapedWhileParentOpen).toBe(false)
        // A proof queried from an already closed child invalidates this owner
        // even though its parent callback is still physically open.
        expect(root.allows(call)).toBe(false)
        return { status: "ok", value: "closed child must not publish" }
      })).toEqual({ status: "unavailable", reason: "calculation-read-root-unavailable" })
      const poisoned = await root.prepare(call, async () => true, () => true)
      if (!poisoned) throw new Error("Fresh original calculation root unavailable")
      let work = 0
      expect(await poisoned.run(async () => {
        work++
        await expect(fixture.persistence.transaction("planner", async () => ({ commit: true, value: true })))
          .rejects.toThrow("Nested local writes are forbidden")
        expect(root.allows(call)).toBe(false)
        return { status: "ok", value: "must not publish" }
      })).toEqual({ status: "unavailable", reason: "calculation-read-root-unavailable" })
      expect(work).toBe(1)
    })
  })
}, 45_000)

test("CurrentChoice readonly calculation roots refuse aborted requests and replaced persistence without replay", async () => {
  for (const boundary of ["abort", "owner", "method", "request"] as const) await withChain(false, async (fixture) => {
    const abort = new AbortController()
    await fixture.ui(async (call, request) => {
      const root = createSfPlannerCalculationRoot({ host: fixture.authority.host })
      const prepared = await root.prepare(call, async () => true, () => true)
      if (!prepared) throw new Error("Original calculation root unavailable")
      const owner = fixture.authority.host.persistence
      const descriptor = Object.getOwnPropertyDescriptor(fixture.persistence, "currentSnapshots")
      if (!descriptor) throw new Error("Original snapshot reader missing")
      let work = 0, replacements = 0
      const result = await prepared.run(async () => {
        work++
        expect(root.allows(call)).toBe(true)
        await fixture.persistence.transaction("dashboard", async () => {
          await Promise.resolve()
          if (boundary === "abort") abort.abort(new Error("readonly chain aborted"))
          if (boundary === "owner") fixture.authority.host.persistence = { ...owner }
          if (boundary === "method") Object.defineProperty(fixture.persistence, "currentSnapshots", { ...descriptor, value: () => {
            replacements++
            throw new Error("Replacement must not run")
          } })
          if (boundary === "request") request.headers.set("x-readonly-boundary", "changed")
          expect(root.allows(call)).toBe(false)
          return { commit: false, value: undefined }
        })
        return { status: "ok", value: "must not publish" }
      })
      fixture.authority.host.persistence = owner
      Object.defineProperty(fixture.persistence, "currentSnapshots", descriptor)
      expect(result).toEqual({ status: "unavailable", reason: "calculation-read-root-unavailable" })
      expect(work).toBe(1)
      expect(replacements).toBe(0)
    }, abort.signal)
  })
}, 45_000)
