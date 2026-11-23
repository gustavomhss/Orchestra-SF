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

type RecallResult = Awaited<ReturnType<ReturnType<typeof createSfPlannerRecallObservation>["recall"]>>
function recallOk(result: RecallResult) {
  if (result.status !== "ok") throw new Error("The canonical Recall is unavailable")
  return result
}
function gate() {
  let release!: () => void
  const promise = new Promise<void>((resolve) => { release = resolve })
  return { promise, release }
}

test("Planner Recall preserves published Atlas closure and freshly closes every native owner", async () => {
  const deadline = compositionTestDeadline("planner-recall-atlas")
  try {
    const f = await deadline.phase("native-scanner-and-fixture", () => fixture(deadline, true))
    const scanner = f.scanner, memory = f.business.atlasRecall()?.memory
    if (!scanner || !memory) throw new Error("The canonical scanner and Atlas reader are required")
    const staged = await deadline.phase("stage-real-precedent", () => f.stage(f.previous))
    Object.assign(f.previous, staged.ref)
    const incoming = () => ({ caseRef: structuredClone(f.current), limit: 10, scope: {
      query: "Review the observed service cost",
      recallScope: { cases: [structuredClone(f.previous)], period: structuredClone(f.period), includeHistorical: false },
    } })
    const canonical = f.business.caseRecallSource()?.recall
    if (!canonical) throw new Error("The complete installed Recall reader is required")

    await deadline.phase("pending-is-unavailable-and-does-not-publish", async () => {
      const before = await f.snapshot()
      expect(before.outbox[staged.outbox.key]?.state).toBe("pending")
      const input = incoming()
      await f.ui("sf_decision_recall", input, async (call) => {
        let reads = 0, produced: RecallResult | undefined
        const measured = await f.measure(() => f.observer.recall(input, call, async () => {
          reads++
          produced = await canonical(input, call)
          return produced
        }))
        expect(measured.value.status).toBe("unavailable")
        expect(produced?.status).toBe("unavailable")
        expect(reads).toBe(1)
        expectIndependentRoots(measured.roots)
      })
      expect(await f.snapshot()).toEqual(before)
    })

    const receipt = await deadline.phase("publish-through-the-real-atlas-writer", async () => {
      const before = await f.snapshot()
      const payload = { caseRef: encodeCaseRef(f.previous) }
      const published = await f.ui("sf_case_read", payload,
        (call) => f.business.context.emitFromLedger(staged.outbox.eventRef, call))
      expect(published.status).toBe("committed")
      expect(published.scanner).toMatchObject({ name: scanner.spec.name, version: scanner.version, status: "clean" })
      const after = await f.snapshot()
      expect(after.cases).toEqual(before.cases)
      expect(after.versions.cases).toBe(before.versions.cases)
      expect(after.outbox[staged.outbox.key]).toMatchObject({ state: "settled", receipt: published })
      return published
    })
    // The current case is still being worked on. Its unpublished event must not
    // be confused with the explicitly selected, already published precedent.
    const currentPending = await deadline.phase("stage-current-case-without-publication", () => f.stage(f.current))
    Object.assign(f.current, currentPending.ref)
    const publishedState = await f.snapshot()
    expect(publishedState.outbox[currentPending.outbox.key]?.state).toBe("pending")

    const baseline = await deadline.phase("canonical-recall-without-a-shared-recall-owner", async () => {
      const input = incoming()
      const unversioned = { ...input, caseRef: { id: f.current.id, incarnation: f.current.incarnation } }
      return f.ui("sf_decision_recall", unversioned, async (call) => {
        const recalled = await memory.recall(f.previous, call)
        if (recalled.status !== "ok") throw new Error("The published Atlas precedent is not readable")
        expect(recalled.records).toHaveLength(1)
        for (const record of recalled.records) {
          expect(record.resolutions.length).toBeGreaterThan(0)
          expect(record.resolutions.every((resolution) => resolution.state === "fresh")).toBe(true)
        }
        // The original request contract permits an omitted source version. The
        // real withCase selection still pins it; the Recall observer preserves
        // the canonical path before admission. Internal case reads keep their
        // own independent observations.
        const value = ok(await f.business.withCase(call, f.current, {}, async () => ({
          status: "ok", value: await f.business.caseRecall(unversioned, call),
        })))
        const complete = recallOk(value)
        expect(complete.matches).toHaveLength(1)
        expect(complete.matches[0]!.caseRef).toEqual(f.previous)
        expect(complete.matches[0]!.memoryRecordRef).toBe(receipt.eventId)
        return structuredClone(complete)
      })
    })

    await deadline.phase("installed-recall-has-independent-work-and-egress-owners", async () => {
      const roots: RootObservation[] = []
      for (let phase = 0; phase < 2; phase++) {
        const input = incoming()
        await f.ui("sf_decision_recall", input, async (call) => {
          const measured = await f.measure(() => f.business.withCase(call, f.current, {}, async () => {
            expectIndependentRoots(f.control.roots)
            f.control.roots = []
            return { status: "ok", value: await f.business.caseRecall(input, call) }
          }))
          const value = recallOk(ok(measured.value))
          expect(value).toEqual(baseline)
          expectIndependentRoots(measured.roots)
          roots.push(...measured.roots)
          // Changing the consumer's detached result cannot affect the next run.
          expect(Reflect.set(value.matches[0]!.explanation.limitations, value.matches[0]!.explanation.limitations.length, "caller-only change")).toBe(true)
        })
      }
      expect(new Set(roots.map((root) => root.identity)).size).toBe(4)
      expect(await f.snapshot()).toEqual(publishedState)
    })

    await deadline.phase("child-case-results-are-detached-and-closed-owners-refuse", async () => {
      const input = incoming(), release = gate()
      await f.ui("sf_decision_recall", input, async (call) => {
        const caseInput = { caseRef: encodeCaseRef(f.current) }
        let children = 0, reads = 0, lateReads = 0
        let retained: PortResult<AuthorizedCaseProjection> | undefined
        let capturedChild: PortResult<AuthorizedCaseProjection> | undefined
        let capturedRecall: RecallResult | undefined
        let late: Promise<PortResult<AuthorizedCaseProjection>> | undefined
        try {
          const measured = await f.measure(() => f.observer.recall(input, call, async () => {
            reads++
            const child = await f.observer.read(caseInput, call, async () => {
              children++
              retained = await f.business.cases.read(caseInput, call)
              capturedChild = structuredClone(retained)
              late = (async () => {
                await release.promise
                return f.observer.read(caseInput, call, async () => {
                  lateReads++
                  return f.business.cases.read(caseInput, call)
                })
              })()
              return retained
            })
            if (!retained || !capturedChild) throw new Error("The real child case did not complete")
            const retainedValue = ok(retained)
            retainedValue.case.objective = "mutated retained child"
            expect(Reflect.set(retainedValue.evidenceRefs, "length", 0)).toBe(true)
            expect(child).toEqual(capturedChild)
            const value = await canonical(input, call)
            capturedRecall = structuredClone(value)
            return value
          }))
          expect(recallOk(measured.value)).toEqual(baseline)
          expect(measured.value).toEqual(capturedRecall)
          expectIndependentRoots(measured.roots)
          expect(children).toBe(1)
          expect(reads).toBe(1)
          if (!late || !capturedChild) throw new Error("The child continuation was not created")
          expect(ok(capturedChild).case).toMatchObject(f.current)
          release.release()
          expect((await late).status).toBe("unavailable")
          expect(lateReads).toBe(0)
        } finally { release.release(); await late }
      })
      expect(await f.snapshot()).toEqual(publishedState)
    })

    await deadline.phase("a-child-cannot-substitute-another-case-version", async () => {
      const input = incoming()
      await f.ui("sf_decision_recall", input, async (call) => {
        let reads = 0, childReads = 0
        let original: PortResult<AuthorizedCaseProjection> | undefined
        let refused: PortResult<AuthorizedCaseProjection> | undefined
        const measured = await f.measure(() => f.observer.recall(input, call, async () => {
          reads++
          const caseInput = { caseRef: encodeCaseRef(f.current) }
          refused = await f.observer.read(caseInput, call, async () => {
            childReads++
            const value = await f.business.cases.read(caseInput, call)
            original = structuredClone(value)
            if (value.status === "ok") value.value.case.version++
            return value
          })
          // Even a caller that ignores the refusal still runs the complete
          // reader; the invalid owner must not release its outcome.
          return canonical(input, call)
        }))
        expect(measured.value.status).toBe("unavailable")
        expect(refused?.status).toBe("unavailable")
        if (!original) throw new Error("The real child reader did not execute")
        expect(ok(original).case).toMatchObject(f.current)
        expect(childReads).toBe(1)
        expect(reads).toBe(1)
        expect(measured.roots).toHaveLength(1)
      })
      expect(await f.snapshot()).toEqual(publishedState)
    })

    await deadline.phase("atlas-publication-change-between-work-and-egress-refuses", async () => {
      const input = incoming()
      let corruptedDigest = ""
      await f.ui("sf_decision_recall", input, async (call) => {
        let reads = 0, captured: RecallResult | undefined
        f.control.afterRoot = async (count) => {
          expect(count).toBe(1)
          expect(reads).toBe(1)
          if (!captured) throw new Error("The complete Recall did not finish before the publication changed")
          expect(recallOk(captured)).toEqual(baseline)
          const before = await f.snapshot()
          corruptedDigest = digestSfValue({ changed: "publication-identity" })
          const changed = await f.authority.state.transaction(f.request(), { namespace: "outbox",
            expectedStorageVersion: before.versions.outbox, targetRef: f.previous.id, targetIncarnation: f.previous.incarnation,
            idempotencyKey: randomUUID(), commandDigest: digestSfValue({ event: staged.event.id, corruptedDigest }),
          }, async (state) => {
            const entry = state.outbox[staged.outbox.key]
            if (!entry || entry.state !== "settled") throw new Error("The real publication receipt is not settled")
            state.outbox[staged.outbox.key] = { ...entry, receipt: { ...entry.receipt, recordDigest: corruptedDigest } }
            return { commit: true, value: true }
          })
          expect(ok(changed)).toBe(true)
        }
        const measured = await f.measure(() => f.observer.recall(input, call, async () => {
          reads++
          const value = await canonical(input, call)
          captured = structuredClone(value)
          return value
        }))
        expect(measured.value.status).toBe("unavailable")
        expect(reads).toBe(1)
        expect(measured.roots).toHaveLength(2)
        expect(measured.roots[0]!.identity).not.toBe(measured.roots[1]!.identity)
      })
      const changed = await f.snapshot()
      expect(changed.cases).toEqual(publishedState.cases)
      expect(changed.atlas).toEqual(publishedState.atlas)
      expect(changed.outbox[staged.outbox.key]).toMatchObject({ state: "settled", receipt: { recordDigest: corruptedDigest } })
      // The canonical reader independently rejects the broken publication link.
      // A read never repairs, settles or rewrites that receipt.
      await f.ui("sf_decision_recall", input, async (call) => {
        expect((await f.business.caseRecall(input, call)).status).toBe("unavailable")
      })
      expect(await f.snapshot()).toEqual(changed)
    })
  } finally { await deadline.close() }
}, 120_000)
