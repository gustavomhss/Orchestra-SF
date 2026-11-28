import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { AuthorizedCaseProjection } from "../../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../../product/contracts/decisions.ts"
import type { SfProductState, SfProductStatePort, SfStateAuthority, SfStoredDecisionResult } from "../../../../product/contracts/state.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createDecisionScenarioLookup } from "../../../../product/decisions/scenario-lookup.ts"
import { createSfProductState, initializeAbsentSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { compositionTestDeadline } from "./composition-test-deadline.ts"

type LookupInput = Parameters<typeof createDecisionScenarioLookup>[0]
type Mode = "selected" | "mutable-context" | "mutable-binding-drift" | "proxy-context" | "map-prototype" | "late-request" |
  "admission-denied" | "egress-revoked" | "abort" | "unmatched-getter" | "unmatched-function"
const actor: SfStateAuthority = { principalRef: "person", policyVersion: "policy", accessRevision: "access" }

function decision(id: string): DecisionCase {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  return { id, incarnation: "case-inc", version: 2, state: "comparing", objective: "Candidate read contract",
    horizon, currency: "USD", criteria: [], participants: [actor.principalRef], sourceRefs: [],
    alternatives: [{ id: "alternative", version: 1, title: "Controlled persisted scenario",
      scenario: { baseRef: "source", operations: [], assumptions: [] },
      result: { id: "scenario", version: 1, components: [], currency: "USD", horizon, sourceRefs: [],
        unresolvedConditions: ["Controlled source ports"], restrictions: [], comparisonStatus: "conditioned",
        costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1,
          currency: "USD", horizon, coverageState: "pending", entries: [], derivedMissingCategoryIds: ["training"],
          evaluatedSourceRefs: [], issues: ["Controlled source ports"] }, knownSubtotal: null, total: null } }],
    costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
}

/** Real lookup, LocalStore and C08; case/history/host ports are controlled.
 * authorize injects graph probes after the native snapshot was materialized.
 * These oracles qualify the C08 read-set, not native projection or installed performance.
 * The factory returns a new callback: opaque behavior means values and observation
 * order, not preservation of the old inline function identity, name or source. */
test("Scenario lookup selects the complete candidate graph and retains late reads, fallback and fresh authority", async () => {
  const deadline = compositionTestDeadline("scenario-lookup-selection", 18_000)
  try {
    const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-scenario-lookup-"))
    deadline.own(() => rm(directory, { recursive: true, force: true }))
    const store = await openLocalStore(join(directory, "store"))
    deadline.own(() => store.dispose())
    await initializeAbsentSfProductState(store, () => "scenario-lookup-state")
    const alternative = decision("selected").alternatives[0]!
    const requestDigest = digestSfValue(alternative.scenario), resultDigest = digestSfValue(alternative.result)
    const stored = (id: string, resultRef: string, version = 2): SfStoredDecisionResult => ({
      schema: "sf-decision-result-v1", kind: "scenario", resultRef, caseRef: { id, incarnation: "case-inc", version },
      ...actor, requestDigest, resultDigest, sourceRefs: [], createdAt: "2027-02-02T00:00:00Z", result: alternative.result,
    })
    const originals = { older: stored("selected", "older", 1), selected: stored("selected", "selected"),
      other: stored("other", "other"), irrelevant: stored("irrelevant", "irrelevant") }
    await store.transaction("dashboard", async (snapshot) => {
      const state = snapshot.data.__sfProductV1 as SfProductState
      state.cases.selected = decision("selected")
      state.cases.other = decision("other")
      state.decisionResults = originals
      return { commit: true, value: undefined }
    })
    const ui = createSfUiAuthority({
      authorize: async () => ({ ...actor, installationId: "installation", projectId: "project" }),
      commandIdentity: async () => "scenario-lookup-control", createId: () => "scenario-lookup-context",
      now: () => Date.parse("2027-02-02T00:00:00Z"),
    })
    const admission = await ui.admit(new Request("https://scenario.example.test/context", { signal: deadline.signal }),
      "sf_forecast_compare", "a".repeat(64))
    if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_forecast_compare", "a".repeat(64)))
      throw new Error("The control UI context was not admitted")
    const call = admission.value
    deadline.own(() => ui.finish(call))
    const checks: string[] = []

    const run = async (mode: Mode, opaque = false) => {
      deadline.check()
      const cancellation = new AbortController()
      const transport = new Request("https://scenario.example.test/lookup", {
        signal: AbortSignal.any([deadline.signal, cancellation.signal]),
      })
      const audit: {
        authority: number; reads: number; inside: number; outside: number; unexpected: number
        contextGets: number; contextDescriptors: number; idReads: number; beforeReadIds: number; currentId: string
        events: string[]; caseRefs: string[]; resultRefs: string[]; values: unknown[]; failures: unknown[]
        sourceMap?: NonNullable<SfProductState["decisionResults"]>; shared?: object
      } = { authority: 0, reads: 0, inside: 0, outside: 0, unexpected: 0, contextGets: 0, contextDescriptors: 0,
        idReads: 0, beforeReadIds: 0, currentId: "selected", events: [], caseRefs: [], resultRefs: [], values: [], failures: [] }
      const sentinel = new Error("Unmatched scenario envelope remains reachable")
      const context = mode === "mutable-context" || mode === "mutable-binding-drift" ? { ...call, binding: { ...call.binding } }
        : mode === "proxy-context" ? new Proxy(call, {
          get: (target, key, receiver) => { audit.contextGets++; audit.events.push("context." + String(key)); return Reflect.get(target, key, receiver) },
          getOwnPropertyDescriptor: (target, key) => { audit.contextDescriptors++; return Reflect.getOwnPropertyDescriptor(target, key) },
          ownKeys: (target) => { audit.contextDescriptors++; return Reflect.ownKeys(target) },
        }) : call
      const incoming = { caseRef: { get id() { audit.idReads++; return audit.currentId },
        incarnation: "case-inc", version: 2 }, alternativeId: "alternative", alternativeVersion: 1 }
      const provider = createSfProductState({ persistence: store, createId: () => "unused",
        authorize: async (_request, snapshot: Snapshot) => {
          deadline.check()
          audit.events.push("authorize-" + ++audit.authority)
          if (mode === "admission-denied" || mode === "egress-revoked" && audit.authority === 2) return undefined
          if (audit.authority === 1) {
            const state = snapshot.data.__sfProductV1 as SfProductState
            const map = state.decisionResults
            if (!map?.older || !map.selected || !map.irrelevant) throw new Error("Candidate graph is missing")
            audit.sourceMap = map
            const shared = { amount: 12 }
            audit.shared = shared
            Reflect.set(shared, "self", shared)
            Reflect.set(map.older, "graph", shared)
            Reflect.set(map.selected, "graph", shared)
            Reflect.set(map.irrelevant, "graph", shared)
            state.preferences.shared = shared
            Object.defineProperty(state.preferences, "outsideReadSet", { enumerable: true, get: () => {
              audit.outside++; return "Only the opaque full-state clone reads this field"
            } })
            // This envelope does not match either requested case. Its own failure
            // is not reachable through the shared object on a matched envelope.
            Object.defineProperty(map.irrelevant, "unmatchedField", { enumerable: true, get: () => {
              audit.inside++
              if (mode === "unmatched-getter") throw sentinel
              if (mode === "abort") cancellation.abort(new Error("Cancelled during candidate cloning"))
              return "Unmatched candidate was cloned before filtering"
            } })
            if (mode === "unmatched-function") Reflect.set(map.irrelevant, "uncloneable", () => undefined)
            if (mode === "map-prototype") Object.setPrototypeOf(map, { inherited: true })
            if (mode === "late-request") audit.currentId = "other"
            if (mode === "mutable-binding-drift") Reflect.set(context.binding, "accessRevision", "changed after admission")
          }
          return { ...actor }
        },
        resolveTarget: async () => undefined,
      })
      const state: SfProductStatePort = { ...provider, read: async (source, namespace, read) => {
        audit.events.push("state-read")
        audit.reads++
        audit.beforeReadIds = audit.idReads
        try {
          // Deliberately wrapping the actual consumer callback removes only its
          // private factory registration; no predicate is reimplemented here.
          const result = await provider.read(source, namespace, opaque ? (value, authority) => read(value, authority) : read)
          if (result.status === "ok") audit.values.push(result.value)
          return result
        } catch (error) { audit.failures.push(error); throw error }
      } }
      const unexpected = async () => { audit.unexpected++; throw new Error("Unexpected controlled port operation") }
      const cases: LookupInput["cases"] = { draft: unexpected, prepareIntent: unexpected, read: async (request) => {
        audit.events.push("case-read")
        audit.caseRefs.push(request.caseRef)
        const id = request.caseRef === encodeCaseRef({ id: "other", incarnation: "case-inc" }) ? "other" : "selected"
        const value: AuthorizedCaseProjection = { context: { kind: "ui", installationId: "installation", projectId: "project", ...actor },
          case: { ...decision(id), preparedChanges: [], receipts: [] }, events: [], evidenceRefs: [], checkedAt: "2027-02-02T00:00:00Z" }
        return { status: "ok", value }
      } }
      const results: LookupInput["results"] = { write: unexpected, read: unexpected, readByRequest: unexpected,
        readForCalculation: unexpected, readHistoricalCalculation: unexpected,
        readHistoricalScenario: async ({ resultRef }) => {
          audit.events.push("historical-read")
          audit.resultRefs.push(resultRef)
          const value = resultRef === "other" ? originals.other : originals.selected
          return { status: "ok", value }
        },
      }
      const lookup = createDecisionScenarioLookup({ state, cases, results, host: {
        requestFor: () => transport,
        revalidate: async () => { audit.events.push("host"); return true },
      } })
      const outcome = await lookup(incoming, context)
      expect(audit.unexpected).toBe(0)
      expect(audit.reads).toBe(1)
      // The sole earlier ID read belongs to the original first encodeCaseRef.
      // Registration must not snapshot or coerce the mutable request key.
      expect(audit.beforeReadIds).toBe(1)
      expect(audit.contextDescriptors).toBe(0)
      return { outcome, audit, sentinel, cancelled: cancellation.signal.aborted }
    }

    for (const opaque of [false, true]) {
      const value = await run("selected", opaque)
      expect(value.outcome).toEqual({ status: "ok", value: { resultRef: "selected", requestDigest, resultDigest } })
      expect(value.audit.events).toEqual(["host", "case-read", "state-read", "authorize-1", "authorize-2",
        "historical-read", "case-read", "historical-read", "host"])
      expect(value.audit.resultRefs).toEqual(["selected", "selected"])
      expect(value.audit.inside).toBe(1)
      expect(value.audit.outside).toBe(opaque ? 1 : 0)
      const candidates: unknown = value.audit.values[0]
      if (!Array.isArray(candidates) || candidates.length !== 2) throw new Error("Both matching envelopes must be retained before newest selection")
      const older: unknown = candidates[0], latest: unknown = candidates[1]
      if (!older || typeof older !== "object" || !latest || typeof latest !== "object") throw new Error("Cloned candidates are missing")
      const graph: unknown = Reflect.get(latest, "graph")
      if (!graph || typeof graph !== "object") throw new Error("Cloned graph is missing")
      expect(latest).not.toBe(value.audit.sourceMap?.selected)
      expect(older).not.toBe(value.audit.sourceMap?.older)
      expect(graph).not.toBe(value.audit.shared)
      expect(Reflect.get(older, "graph")).toBe(graph)
      expect(Reflect.get(graph, "self")).toBe(graph)
      Reflect.set(graph, "amount", 99)
      expect(Reflect.get(value.audit.shared!, "amount")).toBe(12)
      checks.push(opaque ? "opaque-wrapper-keeps-full-state" : "consumer-selects-complete-detached-results")
    }
    for (const mode of ["mutable-context", "proxy-context", "map-prototype"] as const) {
      const value = await run(mode)
      expect(value.outcome).toEqual({ status: "ok", value: { resultRef: "selected", requestDigest, resultDigest } })
      expect(value.audit.authority).toBe(2)
      expect(value.audit.inside).toBe(1)
      expect(value.audit.outside).toBe(1)
      if (mode === "proxy-context") {
        expect(value.audit.contextGets).toBe(3)
        expect(value.audit.events.indexOf("context.binding")).toBeGreaterThan(value.audit.events.indexOf("authorize-1"))
      }
      checks.push(mode + "-uses-opaque-fallback")
    }
    const late = await run("late-request")
    expect(late.outcome).toEqual({ status: "ok", value: { resultRef: "other", requestDigest, resultDigest } })
    expect(late.audit.caseRefs).toEqual(["case:selected:case-inc", "case:other:case-inc"])
    expect(late.audit.resultRefs).toEqual(["other", "other"])
    expect(late.audit.authority).toBe(2)
    expect(late.audit.outside).toBe(0)
    checks.push("request-key-remains-late-after-admission")
    const drift = await run("mutable-binding-drift")
    expect(drift.outcome).toEqual({ status: "unavailable", reason: "scenario-result-unavailable" })
    expect(drift.audit.authority).toBe(2)
    expect(drift.audit.outside).toBe(1)
    expect(drift.audit.values).toEqual([undefined])
    expect(drift.audit.resultRefs).toEqual([])
    checks.push("mutable-binding-is-observed-after-admission")

    for (const mode of ["admission-denied", "egress-revoked", "abort"] as const) {
      const value = await run(mode)
      expect(value.outcome).toEqual({ status: "unavailable", reason: "scenario-result-unavailable" })
      expect(value.audit.authority).toBe(mode === "egress-revoked" ? 2 : 1)
      expect(value.audit.inside).toBe(mode === "admission-denied" ? 0 : 1)
      expect(value.audit.resultRefs).toEqual([])
      expect(value.audit.caseRefs).toEqual(["case:selected:case-inc"])
      expect(value.audit.values).toEqual([])
      expect(value.cancelled).toBe(mode === "abort")
      checks.push(mode + "-does-not-disclose")
    }
    for (const mode of ["unmatched-getter", "unmatched-function"] as const) {
      for (const opaque of [false, true]) {
        const value = await run(mode, opaque)
        expect(value.outcome).toEqual({ status: "unavailable", reason: "scenario-result-unavailable" })
        expect(value.audit.authority).toBe(1)
        expect(value.audit.inside).toBe(1)
        expect(value.audit.resultRefs).toEqual([])
        expect(value.audit.failures).toHaveLength(1)
        if (mode === "unmatched-getter") expect(value.audit.failures[0]).toBe(value.sentinel)
        if (mode === "unmatched-function") {
          const error = value.audit.failures[0]
          if (!(error instanceof Error)) throw new Error("The reachable clone failure was lost")
          expect(error.name).toBe("DataCloneError")
        }
        checks.push(mode + (opaque ? "-opaque" : "-selected"))
      }
    }
    console.info("SF_C20_SCENARIO_LOOKUP " + JSON.stringify({ schema: "sf-c20-scenario-lookup-v1", checks }))
  } finally { await deadline.close() }
}, 20_000)
