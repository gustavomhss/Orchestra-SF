import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { createSfAnalysisRunContext } from "../../../../../../../apps/cli/src/sucafina-product/analysis-run-context.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// Actual UI leases, C08 and SQLite. Snapshot faults below are counterproofs;
// they are neither native execution nor evidence of a successful analysis run.
async function lifecycleFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await financialCompositionFixture({ signal: deadline.signal, humanActions: ["analysis.start"], beforeEnvironment: async () => deadline.check() })
  deadline.own(() => fixture.dispose())
  const { authority, business } = fixture
  const selected = { id: "lifecycle-case", incarnation: "lifecycle-incarnation", version: 1 }
  const advanced: DecisionCase = { ...selected, version: 2, state: "investigating", objective: "Lifecycle admission counterproof",
    currency: "USD", horizon: { start: "2026-01-01", end: "2026-12-31" }, participants: ["person"], criteria: [], sourceRefs: [], alternatives: [],
    costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
  const request = fixture.request("lifecycle-counterproof")
  const seed = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "lifecycle-seed", commandDigest: digestSfValue(advanced) }, async (state) => {
    state.cases[selected.id] = advanced
    return { commit: true, value: true }
  })
  expect(seed.status).toBe("ok")
  let edits = 0
  const edit = async (value: DecisionCase) => {
    const before = await authority.state.read(request, "cases", () => null)
    if (before.status !== "ok") throw new Error("C08 fixture read unavailable")
    const changed = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: before.storageVersion,
      targetRef: `case:${encodeURIComponent(selected.id)}:${encodeURIComponent(selected.incarnation)}`, targetIncarnation: selected.incarnation,
      idempotencyKey: `lifecycle-edit-${++edits}`, commandDigest: digestSfValue(value) }, async (state) => {
      state.cases[selected.id] = value
      return { commit: true, value: true }
    })
    expect(changed.status).toBe("ok")
  }
  const replayContexts = new WeakMap<TrustedDomainContext, string>()
  const runRef = "unexecuted-lifecycle-counterproof"
  const start = { request: { caseRef: selected }, purpose: "Lifecycle authority counterproof" }
  const context = (caseRef = selected) => createSfAnalysisRunContext({ authority, business, request, caseRef, runRef, start: { ...start, request: { caseRef } },
    active: () => true, replayContexts })
  return { ...fixture, selected, advanced, request, start, runRef, replayContexts, context, edit }
}

test("Analysis lifecycle admission keeps strict fresh projection and refuses fresh work after stale case rollback or changed selection", async () => {
  const deadline = compositionTestDeadline("analysis-lifecycle-selection")
  try {
    const fixture = await lifecycleFixture(deadline)
    const { authority, business, selected, advanced, runRef } = fixture
    const originalRead = business.cases.read
    let projections = 0
    business.cases.read = async (...args) => { projections++; return originalRead(...args) }
    expect(await fixture.context({ id: selected.id, incarnation: selected.incarnation, version: 2 })(runRef, async (call) => {
      expect(await business.selectedCase(call)).toEqual({ status: "ok", value: { id: selected.id, incarnation: selected.incarnation, version: 2 } })
      return { status: "ok", value: "fresh" }
    })).toEqual({ status: "ok", value: "fresh" })
    expect(projections).toBeGreaterThan(0)
    const freshProjections = projections
    expect(await fixture.context()(runRef, async (call) => {
      // Deliberately model rollback in actual C08 state, while retaining the old
      // lifecycle scope. Equality with the old version must not revive execution.
      await fixture.edit({ ...advanced, version: 1 })
      expect((await business.selectedCase(call)).status).toBe("unavailable")
      expect((await business.resolveCase(call)).status).toBe("unavailable")
      let nestedWork = false
      expect((await business.withCase(call, selected, {}, async () => { nestedWork = true; return { status: "ok", value: true } })).status).toBe("denied")
      expect(nestedWork).toBe(false)
      // The verifier reaches withCalculationCase before reading resultRef. This
      // malformed input is intentional: no fresh producer body may inspect it.
      let producerBodyReads = 0
      const candidate = { caseRef: selected, sourceRefs: [], result: { sourceRefs: [], costCoverage: { evaluatedSourceRefs: [], entries: [] } },
        get resultRef() { producerBodyReads++; return "unexecuted-calculation" } } as unknown as Parameters<typeof business.calculations.verifyCalculationSources>[0]
      expect(await business.calculations.verifyCalculationSources(candidate, [], call)).toBe(false)
      expect(producerBodyReads).toBe(0)
      await fixture.edit(advanced)
      return { status: "ok", value: "lifecycle" }
    })).toEqual({ status: "ok", value: "lifecycle" })
    expect(projections).toBe(freshProjections)
    const admitted = await authority.human.admit(fixture.request, "analysis.start", fixture.start)
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    try {
      const mutable = { ...selected }
      expect((await business.withAnalysisCase(admitted.value, mutable, async () => {
        mutable.version = 2
        expect((await business.selectedCase(admitted.value)).status).toBe("unavailable")
        return { status: "ok", value: "must-not-escape" }
      })).status).toBe("denied")
    } finally { authority.human.finish(admitted.value) }
    expect(authority.host.requestFor(admitted.value)).toBeUndefined()
  } finally { await deadline.close() }
}, 120_000)

test("Analysis lifecycle egress refuses membership revoked during the final real human authorization", async () => {
  const deadline = compositionTestDeadline("analysis-lifecycle-last-human-authorize")
  try {
    const fixture = await lifecycleFixture(deadline)
    const { authority } = fixture
    const originalAuthorize = authority.human.authorize
    let last: TrustedDomainContext | undefined
    let armed = false, revoked = false
    authority.human.authorize = async (call, action, payload) => {
      const authorized = await originalAuthorize(call, action, payload)
      if (armed) {
        armed = false
        expect(authorized).toBe(true)
        const binding = digestSfValue(call.binding)
        await fixture.edit({ ...fixture.advanced, version: 3, participants: [] })
        expect(digestSfValue(call.binding)).toBe(binding)
        expect(authority.host.requestFor(call)).toBe(fixture.request)
        revoked = true
      }
      return authorized
    }
    expect((await fixture.context()(fixture.runRef, async (call) => {
      last = call
      armed = true
      return { status: "ok", value: "must-not-escape" }
    })).status).toBe("denied")
    expect(revoked).toBe(true)
    expect(last).toBeDefined()
    expect(authority.host.requestFor(last!)).toBeUndefined()
    expect(fixture.replayContexts.has(last!)).toBe(false)
    const state = await authority.state.read(fixture.request, "cases", (stored) => stored.cases[fixture.selected.id]?.participants)
    expect(state.status === "ok" && state.value).toEqual([])
  } finally { await deadline.close() }
}, 120_000)

test("Analysis lifecycle admission and egress reject snapshot mutation or finished lease after C08 projection", async () => {
  const deadline = compositionTestDeadline("analysis-lifecycle-c08-final-snapshot")
  try {
    const fixture = await lifecycleFixture(deadline)
    const { authority, persistence } = fixture
    const originalTransaction = persistence.transaction, originalRead = authority.state.read, originalAdmit = authority.human.admit
    const snapshots: Snapshot[] = []
    let last: TrustedUiContext | undefined
    authority.human.admit = async (request, action, payload) => {
      const admitted = await originalAdmit(request, action, payload)
      if (admitted.status === "ok") last = admitted.value
      return admitted
    }
    persistence.transaction = (surface, work, options) => originalTransaction(surface, async (snapshot, blobs) => {
      snapshots.push(snapshot)
      try { return await work(snapshot, blobs) } finally { expect(snapshots.pop()).toBe(snapshot) }
    }, options)
    for (const fault of ["snapshot", "lease"] as const) for (const boundary of ["admission", "egress"] as const) {
      let armed = boundary === "admission", fired = false, entered = false
      authority.state.read = async (request, namespace, project) => {
        const result = await originalRead(request, namespace, async (stored, actor) => {
          const value = await project(stored, actor)
          if (armed && !fired && namespace === "cases") {
            expect(request).toBe(fixture.request)
            expect(request.signal.aborted).toBe(false)
            expect(snapshots.length).toBe(2)
            expect(actor.principalRef).toBe("person")
            // Fault the actual outer snapshot or finish the actual admitted UI
            // lease. Real C08 post-callback authorization still runs next.
            if (fault === "snapshot") {
              const held = snapshots[0]!.data.__sfProductV1 as SfProductState
              held.cases[fixture.selected.id] = { ...held.cases[fixture.selected.id]!, version: 3, participants: [] }
              held.versions.cases++
              held.revision++
            } else {
              expect(last).toBeDefined()
              expect(authority.host.requestFor(last!)).toBe(fixture.request)
              const binding = digestSfValue(last!.binding)
              authority.human.finish(last!)
              expect(authority.host.requestFor(last!)).toBeUndefined()
              expect(digestSfValue(last!.binding)).toBe(binding)
            }
            fired = true
          }
          return value
        })
        // Actor/namespace authority alone does not reobserve the case or lease.
        if (fired && namespace === "cases") expect(result.status).toBe("ok")
        return result
      }
      expect((await fixture.context()(fixture.runRef, async () => {
        entered = true
        armed = true
        return { status: "ok", value: "must-not-escape" }
      })).status).toBe("denied")
      expect(fired).toBe(true)
      expect(entered).toBe(boundary === "egress")
      expect(authority.host.requestFor(last!)).toBeUndefined()
      expect(fixture.replayContexts.has(last!)).toBe(false)
      authority.state.read = originalRead
      const current = await originalRead(fixture.request, "cases", (stored) => stored.cases[fixture.selected.id])
      expect(current.status === "ok" && current.value).toEqual(fixture.advanced)
    }
  } finally { await deadline.close() }
}, 120_000)
