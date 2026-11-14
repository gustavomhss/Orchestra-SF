import { expect, test } from "bun:test"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfAnalysisRunContext } from "../../../../../../../apps/cli/src/sucafina-product/analysis-run-context.ts"
import { financialCompositionFixture } from "./financial-composition-fixture.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

// The production reentry helper, real human admission, case projection and C08.
// No run, Task, native session, loaded skill or model execution is manufactured.
test("Analysis reentry reaches current lifecycle metadata after case advancement without upgrading its original fresh selector", async () => {
  const deadline = compositionTestDeadline("analysis-run-context")
  try {
    const fixture = await financialCompositionFixture({ signal: deadline.signal, beforeEnvironment: async () => deadline.check(), humanActions: ["analysis.start"] })
    deadline.own(() => fixture.dispose())
    const { authority, business } = fixture
    const caseRef = { id: "reentry-case", incarnation: "reentry-incarnation", version: 1 }
    const initial: DecisionCase = { ...caseRef, state: "investigating", objective: "Reentry lifecycle", currency: "USD",
      horizon: { start: "2026-01-01", end: "2026-12-31" }, participants: ["person"], criteria: [], sourceRefs: [], alternatives: [],
      costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await authority.state.transaction(fixture.request("reentry-seed"), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
      idempotencyKey: "reentry-seed", commandDigest: digestSfValue(initial) }, async (state) => {
      state.cases[caseRef.id] = initial
      return { commit: true, value: true }
    })
    expect(seed.status).toBe("ok")
    const request = fixture.request("original-run-intent")
    const start = { request: { caseRef }, purpose: "Unexecuted reentry authority fixture" }
    const replayContexts = new WeakMap<TrustedDomainContext, string>()
    const active = { value: true }
    const runRef = "unexecuted-reentry"
    const withRunContext = createSfAnalysisRunContext({ authority, business, request, runRef, caseRef, start,
      active: () => active.value, replayContexts })
    let last: TrustedDomainContext | undefined
    const readLifecycle = async (call: TrustedDomainContext) => {
      last = call
      expect(authority.host.requestFor(call)).toBe(request)
      expect(replayContexts.get(call)).toBe(runRef)
      const found = await authority.state.read(request, "cases", (state, actor) => {
        const value = state.cases[caseRef.id]
        return value?.incarnation === caseRef.incarnation && value.participants.includes(actor.principalRef) ? value.version : undefined
      })
      return found.status === "ok" && found.value !== undefined ? { status: "ok" as const, value: found.value }
        : { status: "denied" as const, reason: "current-case-unavailable" }
    }
    expect(await withRunContext(runRef, async (call) => {
      expect(await business.selectedCase(call)).toEqual({ status: "ok", value: caseRef })
      return readLifecycle(call)
    })).toEqual({ status: "ok", value: 1 })
    if (!last) throw new Error("Real reentry did not run")
    expect(replayContexts.has(last)).toBe(false)
    expect(authority.host.requestFor(last)).toBeUndefined()
    const edit = async (value: DecisionCase, key: string) => {
      const current = await authority.state.read(request, "cases", () => null)
      if (current.status !== "ok") throw new Error("Case edit authority unavailable")
      const saved = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion,
        targetRef: `case:${encodeURIComponent(caseRef.id)}:${encodeURIComponent(caseRef.incarnation)}`, targetIncarnation: caseRef.incarnation,
        idempotencyKey: key, commandDigest: digestSfValue(value) }, async (state) => {
        state.cases[caseRef.id] = value
        return { commit: true, value: true }
      })
      expect(saved.status).toBe("ok")
    }
    const advanced = { ...initial, version: 2, objective: "Legitimately edited case" }
    await edit(advanced, "reentry-advance")
    expect(await deadline.phase("lifecycle.after-case-advance", () => withRunContext(runRef, async (call) => {
      // The reentry did not silently select version 2 for fresh domain operations.
      expect((await business.selectedCase(call)).status).toBe("unavailable")
      expect((await business.resolveCase(call)).status).toBe("unavailable")
      return readLifecycle(call)
    }))).toEqual({ status: "ok", value: 2 })
    const strict = await authority.human.admit(request, "analysis.start", start)
    if (strict.status !== "ok") throw new Error(strict.reason)
    let entered = false
    try {
      expect((await business.withCase(strict.value, caseRef, {}, async () => { entered = true; return { status: "ok", value: true } })).status).toBe("denied")
      expect(entered).toBe(false)
    } finally { authority.human.finish(strict.value) }

    const ended = await authority.human.admit(request, "analysis.start", start)
    if (ended.status !== "ok") throw new Error(ended.reason)
    const released = await business.withCase(ended.value, caseRef, { allowHistoricalRetry: true }, async () => {
      const current = await authority.state.read(request, "cases", (state) => state.cases[caseRef.id]?.version)
      if (current.status !== "ok") throw new Error("Case lease egress read unavailable")
      authority.human.finish(ended.value)
      expect(request.signal.aborted).toBe(false)
      return { status: "ok", value: current.value }
    })
    expect(released).toEqual({ status: "denied", reason: "case-selection-authority-changed" })

    expect((await withRunContext("other-run", readLifecycle)).status).toBe("denied")
    await edit({ ...advanced, version: 3, participants: [] }, "reentry-remove-member")
    expect((await withRunContext(runRef, readLifecycle)).status).toBe("denied")
    await edit({ ...advanced, version: 4 }, "reentry-restore-member")
    expect(await withRunContext(runRef, readLifecycle)).toEqual({ status: "ok", value: 4 })
    fixture.active.value = false
    expect((await withRunContext(runRef, readLifecycle)).status).toBe("denied")
    fixture.active.value = true
    active.value = false
    expect((await withRunContext(runRef, readLifecycle)).status).toBe("denied")
    active.value = true
    const abort = new AbortController()
    const abortRequest = new Request(request, { signal: abort.signal })
    const abortContext = createSfAnalysisRunContext({ authority, business, request: abortRequest, runRef, caseRef, start,
      active: () => active.value, replayContexts })
    expect(await abortContext(runRef, async () => ({ status: "ok", value: true }))).toEqual({ status: "ok", value: true })
    abort.abort()
    entered = false
    expect((await abortContext(runRef, async () => { entered = true; return { status: "ok", value: true } })).status).toBe("denied")
    expect(entered).toBe(false)
    await edit({ ...advanced, version: 5, incarnation: "replacement-incarnation" }, "reentry-replace")
    expect((await withRunContext(runRef, readLifecycle)).status).toBe("denied")
    expect(replayContexts.has(last)).toBe(false)
    expect(authority.host.requestFor(last)).toBeUndefined()
  } finally { await deadline.close() }
}, 120_000)
