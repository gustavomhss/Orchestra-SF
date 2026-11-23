import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { Effect } from "effect"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPlannerRecallObservation } from "../../../../../../../apps/cli/src/sucafina-product/planner-recall-observation.ts"
import { createSfPlannerRecordProofScope, pinSfPlannerRecordReaders } from "../../../../../../../apps/cli/src/sucafina-product/planner-record-proof-scope.ts"
import type { AuthorizedCaseProjection } from "../../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { createResidentAiBundle } from "../../../../product/ai/resident.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { probeSfAtlasScanner } from "../../../../product/host-binding/atlas-scanner.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { enqueueSfLedgerEvent } from "../../../../product/integration/ledger-outbox.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence, currentSfPlannerReadonlySnapshotScope } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import atlasPackage from "../../../../../../atlas/boundary/package.json" with { type: "json" }
import freeze from "../../../../product/contracts/freeze-v1.json" with { type: "json" }
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type Deadline = ReturnType<typeof compositionTestDeadline>
type CaseRef = { id: string; incarnation: string; version: number }
type RootObservation = { identity: object; bytesIdentity: object }

function ok<Value>(result: PortResult<Value> | SfStateResult<Value>): Value {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

async function fixture(deadline: Deadline, withScanner = false) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-planner-recall-proof-"))
  deadline.own(() => rm(directory, { recursive: true, force: true }))
  const store = await openLocalStore(path.join(directory, "store"))
  deadline.own(() => store.dispose())
  const originalRoot = store.readSnapshotRoot
  if (!originalRoot) throw new Error("The native LocalStore root is required")
  const at = "2027-02-02T00:00:00Z", period = { start: "2027-01-01", end: "2027-12-31" }
  const control: { active: boolean; measuring: boolean; roots: RootObservation[]; afterRoot?: (count: number) => Promise<void> } =
    { active: true, measuring: false, roots: [] }
  const sources = createSfSourcePersistence({ persistence: store, createId: randomUUID,
    enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
  // This forwarder is born with the composition, before any authority or owner
  // pins it. The exact LocalStore and every one of its methods stay untouched.
  const persistence: typeof store & ReturnType<typeof createSfSourcePersistence> = {
    ...store, ...sources,
    readSnapshotRoot: async <Value>(work: () => Promise<Value>, options?: Parameters<NonNullable<typeof originalRoot>>[1]) => {
      const measuring = control.measuring
      const value = await originalRoot(async () => {
        if (measuring) {
          const native = currentSfPlannerReadonlySnapshotScope(persistence)
          if (!native?.bytesIdentity || !native.current()) throw new Error("A measured root lacks native readonly proof")
          control.roots.push({ identity: native.identity, bytesIdentity: native.bytesIdentity })
        }
        return work()
      }, options)
      if (measuring) {
        const after = control.afterRoot
        control.afterRoot = undefined
        if (after) {
          expect(currentSfPlannerReadonlySnapshotScope(persistence)).toBeUndefined()
          await after(control.roots.length)
        }
      }
      return value
    },
  }
  const origin = "https://planner-recall.example.test"
  const request = () => new Request(origin + "/planner", { method: "POST", signal: deadline.signal,
    headers: { origin, "idempotency-key": randomUUID() } })
  const identity = { installationId: "planner-recall-installation", hostId: "host", projectId: "project",
    location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const writes = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId,
    origin, policyVersion: "planner-recall-policy", persistence, proposalCoverageWrites: writes,
    grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_case_draft", "sf_case_read", "sf_decision_recall", "sf_forecast_compare", "sf_scenario_simulate"],
      humanActions: [] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: true,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => { deadline.check(); return { at, id: randomUUID, directory: [] } },
    createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(), inspectSession: async () => undefined,
    verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => 1,
    authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
  deadline.own(() => business.dispose())
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [{ id: "v0", name: "Observed forecast", year: 2027, closed: 0,
      lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
  let scanner: Awaited<ReturnType<typeof probeSfAtlasScanner>>
  if (withScanner) {
    expectSpawn(import.meta.path)
    scanner = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const process = yield* AppProcess.Service
      return yield* Effect.promise(() => probeSfAtlasScanner(process))
    })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))), { signal: deadline.signal })
    if (!scanner) throw new Error("The canonical Atlas scanner is required")
  }
  const sourceRoot = path.resolve(import.meta.dir, "../../../../product/ai")
  const bundle = await createResidentAiBundle({ root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json") })
  business.initializeAtlas(scanner, { boundaryVersion: atlasPackage.version, schemaVersion: freeze.canonicalSha256,
    manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills
      .map((entry) => ({ id: entry.id, version: entry.version, sourceDigest: entry.sourceDigest }))) })
  const ui = async <Value>(operation: string, payload: unknown, work: (call: TrustedUiContext) => Promise<Value>): Promise<Value> => {
    const digest = digestSfValue(payload)
    const call = ok(await authority.ui.admit(request(), operation, digest))
    try {
      expect(await authority.ui.validate(call, operation, digest)).toBe(true)
      return await work(call)
    } finally { authority.ui.finish(call) }
  }
  const source = await ui("sf_forecast_compare", {}, async (call) => ok(await business.plannerProduct.issueSource("v0", call)).evidence)
  const draft = async (objective: string) => {
    const input = { objective, horizon: period, currency: "USD", criteria: ["Review the observed service cost"], sourceRefs: [source] }
    const value = await ui("sf_case_draft", input, async (call) => ok(await business.cases.draft(input, call)))
    return { id: value.id, incarnation: value.incarnation, version: value.version }
  }
  const current = await draft("Current authorized review"), previous = await draft("Previous authorized review")
  const selections = new WeakMap<TrustedDomainContext, { ref: CaseRef; current: () => boolean }>()
  const atlas = business.evidence.current
  if (!atlas) throw new Error("The canonical Atlas context is required")
  const readersCurrent = pinSfPlannerRecordReaders([authority.host, persistence, authority.state, business.cases,
    business.context, business.plannerSources, business.projectPlannerEvidence, atlas])
  expect(readersCurrent()).toBe(true)
  const recordProof = createSfPlannerRecordProofScope({ host: authority.host, readersCurrent })
  const observer = createSfPlannerRecallObservation({ host: authority.host, state: authority.state, recordProof,
    lockedSourceFences: business.lockedSourceFences,
    readerIdentities: () => [business.cases.read, business.context.resolve, business.plannerSources.resolveForecastSource,
      business.projectPlannerEvidence.readEvidence, business.caseRecallSource()?.recall],
    selectedScope: (call) => selections.get(call),
  })
  const withSelected = <Value>(call: TrustedUiContext, work: () => Promise<PortResult<Value>>) =>
    business.withCase(call, current, {}, async () => {
      const selected = ok(await business.selectedCase(call))
      expect(selected).toEqual(current)
      const ref = structuredClone(selected), digest = digestSfValue(ref)
      const selection = { ref, current: () => selections.get(call) === selection && digestSfValue(ref) === digest }
      selections.set(call, selection)
      try { return await work() } finally { selections.delete(call) }
    })
  const measure = async <Value>(work: () => Promise<Value>) => {
    control.roots = []
    control.measuring = true
    try { return { value: await work(), roots: [...control.roots] } }
    finally { control.measuring = false; control.afterRoot = undefined }
  }
  const snapshot = async () => ok(await authority.state.read(request(), "cases", (state) => structuredClone({
    cases: state.cases, atlas: state.atlas, outbox: state.outbox, versions: state.versions,
  })))
  const stage = async (selected: CaseRef) => {
    const incoming = request()
    const before = ok(await authority.state.read(incoming, "cases", (state) => ({
      value: structuredClone(state.cases[selected.id]), cases: state.versions.cases, outbox: state.versions.outbox,
    })))
    const value = before.value
    if (!value || value.incarnation !== selected.incarnation || value.version !== selected.version)
      throw new Error("The real case revision changed before ledger preparation")
    const ref = { ...selected, version: selected.version + 1 }
    const event: CaseLedgerEvent = { id: randomUUID(), caseRef: ref, kind: "reconsideration-accepted", principalRef: "person", at,
      consideredActions: ["Review the observed service cost"], factualGaps: [], lifecycleState: "investigating",
      rationale: "Preserve the observed service estimate", evidenceRefs: [source], outputDigest: digestSfValue(source) }
    const outbox = ok(await authority.state.transaction(incoming, { namespace: "cases", expectedStorageVersion: before.cases,
      additionalNamespaces: [{ namespace: "outbox", expectedStorageVersion: before.outbox }],
      targetRef: selected.id, targetIncarnation: selected.incarnation, idempotencyKey: event.id, commandDigest: digestSfValue(event),
    }, async (state, actor) => {
      state.cases[selected.id] = { ...value, version: ref.version, state: "investigating", ledger: [...value.ledger, event] }
      return { commit: true, value: ok(enqueueSfLedgerEvent(state, event, {
        installationId: identity.installationId, projectId: identity.projectId, authority: actor,
      })) }
    }))
    return { ref, event, outbox }
  }
  return { authority, business, persistence, control, source, current, previous, period, ui, withSelected, observer,
    recordProof, measure, snapshot, stage, scanner, request }
}

function expectIndependentRoots(roots: readonly RootObservation[]) {
  expect(roots).toHaveLength(2)
  expect(roots[0]!.identity).not.toBe(roots[1]!.identity)
  expect(roots[0]!.bytesIdentity).toBe(roots[1]!.bytesIdentity)
}

test("Planner case preflight uses its private version and closes independent native observations", async () => {
  const deadline = compositionTestDeadline("planner-recall-preflight")
  try {
    const f = await deadline.phase("native-fixture", () => fixture(deadline))
    const input = { caseRef: encodeCaseRef(f.current) }
    await deadline.phase("public-reference-keeps-canonical-read", () => f.ui("sf_case_read", input, async (call) => {
      let reads = 0, captured: PortResult<AuthorizedCaseProjection> | undefined
      const observed = await f.measure(() => f.observer.read(input, call, async () => {
        reads++
        const value = await f.business.cases.read(input, call)
        captured = structuredClone(value)
        return value
      }))
      expect(observed.value).toEqual(captured)
      expect(ok(observed.value).case).toMatchObject(f.current)
      expect(reads).toBe(1)
      expect(observed.roots).toEqual([])
    }))
    await deadline.phase("with-case-captures-version-before-preflight", () => f.ui("sf_case_read", input, async (call) => {
      let actions = 0
      const measured = await f.measure(() => f.business.withCase(call, f.current, {}, async () => {
        actions++
        expectIndependentRoots(f.control.roots)
        expect(currentSfPlannerReadonlySnapshotScope(f.persistence)).toBeUndefined()
        return { status: "ok", value: await f.business.context.resolve(structuredClone(f.source), call) }
      }))
      expect(ok(measured.value).state).toBe("fresh")
      expect(actions).toBe(1)
      expectIndependentRoots(measured.roots)
    }))
    await deadline.phase("selected-read-is-complete-and-independent", () => f.ui("sf_case_read", input, async (call) => {
      const allRoots: RootObservation[] = []
      for (let phase = 0; phase < 2; phase++) {
        let reads = 0, captured: PortResult<AuthorizedCaseProjection> | undefined
        const measured = await f.measure(() => f.withSelected(call, async () => {
          expectIndependentRoots(f.control.roots)
          f.control.roots = []
          return f.observer.read(input, call, async () => {
            reads++
            const value = await f.business.cases.read(input, call)
            captured = structuredClone(value)
            return value
          })
        }))
        expect(measured.value).toEqual(captured)
        expect(ok(measured.value).case).toMatchObject(f.current)
        expect(reads).toBe(1)
        expectIndependentRoots(measured.roots)
        allRoots.push(...measured.roots)
      }
      expect(new Set(allRoots.map((root) => root.identity)).size).toBe(4)
      expect(currentSfPlannerReadonlySnapshotScope(f.persistence)).toBeUndefined()
    }))
    await deadline.phase("revocation-after-work-does-not-replay", () => f.ui("sf_case_read", input, async (call) => {
      let reads = 0, captured: PortResult<AuthorizedCaseProjection> | undefined
      let refused: PortResult<AuthorizedCaseProjection> | undefined
      try {
        const measured = await f.measure(() => f.withSelected(call, async () => {
          expectIndependentRoots(f.control.roots)
          f.control.roots = []
          f.control.afterRoot = async (count) => {
            expect(count).toBe(1)
            expect(reads).toBe(1)
            f.control.active = false
          }
          refused = await f.observer.read(input, call, async () => {
            reads++
            const value = await f.business.cases.read(input, call)
            captured = structuredClone(value)
            return value
          })
          return refused
        }))
        expect(measured.value.status).not.toBe("ok")
        expect(refused?.status).toBe("unavailable")
        if (!captured) throw new Error("The real case reader did not complete before revocation")
        expect(ok(captured).case).toMatchObject(f.current)
        expect(reads).toBe(1)
        expect(measured.roots).toHaveLength(1)
      } finally { f.control.active = true }
    }))
    await deadline.phase("source-port-drift-after-admission-does-not-replay", () => f.ui("sf_case_read", input, async (call) => {
      const prepared = f.persistence.readScopedSourcePrepared
      if (!prepared) throw new Error("The native prepared source port is required")
      let reads = 0, captured: PortResult<AuthorizedCaseProjection> | undefined
      try {
        const measured = await f.measure(() => f.withSelected(call, async () => {
          expectIndependentRoots(f.control.roots)
          f.control.roots = []
          return f.observer.read(input, call, async () => {
            reads++
            const value = await f.business.cases.read(input, call)
            captured = structuredClone(value)
            f.persistence.readScopedSourcePrepared = (...args) => prepared(...args)
            return value
          })
        }))
        expect(measured.value.status).not.toBe("ok")
        if (!captured) throw new Error("The real case reader did not reach the port drift")
        expect(ok(captured).case).toMatchObject(f.current)
        expect(reads).toBe(1)
        expect(measured.roots).toHaveLength(1)
      } finally { f.persistence.readScopedSourcePrepared = prepared }
    }))
    await deadline.phase("case-change-between-work-and-fresh-egress", () => f.ui("sf_case_read", input, async (call) => {
      let reads = 0, captured: PortResult<AuthorizedCaseProjection> | undefined
      const selected = structuredClone(f.current)
      const measured = await f.measure(() => f.withSelected(call, async () => {
        expectIndependentRoots(f.control.roots)
        f.control.roots = []
        f.control.afterRoot = async (count) => {
          expect(count).toBe(1)
          expect(reads).toBe(1)
          await f.stage(selected)
        }
        return f.observer.read(input, call, async () => {
          reads++
          const value = await f.business.cases.read(input, call)
          captured = structuredClone(value)
          return value
        })
      }))
      expect(measured.value.status).not.toBe("ok")
      if (!captured) throw new Error("The real case reader did not complete before the case changed")
      expect(ok(captured).case).toMatchObject(selected)
      expect(reads).toBe(1)
      expect(measured.roots).toHaveLength(2)
      expect(measured.roots[0]!.identity).not.toBe(measured.roots[1]!.identity)
      const historical = await f.measure(() => f.business.withCase(call, selected, { allowHistoricalRetry: true },
        () => f.business.cases.read(input, call)))
      expect(ok(historical.value).case.version).toBe(selected.version + 1)
      expect(historical.roots).toEqual([])
    }))
  } finally { await deadline.close() }
}, 120_000)
