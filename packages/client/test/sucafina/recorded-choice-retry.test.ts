import { expect, test } from "bun:test"
import { createSfContextClient } from "../../src/sucafina/context"
import { createSfDecisionsClient } from "../../src/sucafina/decisions"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import { createSfTransport, type SfDesktopCapability, type SfDesktopInvocation, type SfDesktopInvocationResult } from "../../src/sucafina/transport"
import type { SfRecordedChoiceIntent } from "../../src/sucafina/transport/choice-replay"

// Synthetic codec/IPC boundary only. These fixtures do not qualify installed
// authority, C08 receipts, persistence, or producer exactly-once behavior.
const descriptor = { installationId: "installation", projectId: "project", hostId: "host",
  publicOrigin: "https://installation.example", mount: "/sucafina",
  authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const }
const owner = { installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision" }
const input: SfRecordedChoiceIntent = {
  schema: "sf-recorded-choice-intent/1", caseRef: "case:case:incarnation", owner, key: "original-human-intent",
  body: { caseRef: { id: "case", incarnation: "incarnation", version: 2 },
    alternativeId: "alternative", alternativeVersion: 1,
    comparison: { scenarioRefs: ["baseline", "candidate"], criteria: ["criterion"] },
    criteria: ["criterion"], reason: "Original human choice" },
}
const signal = () => new AbortController().signal
const mismatch = { kind: "transport-error", reason: "contract-mismatch" }
const unavailable = { status: "unavailable" }
function projection() {
  const horizon = { start: "2027-01-01", end: "2027-12-31" }
  const at = "2027-01-02T03:04:05.000Z"
  const coverage = { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1,
    currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending" as const,
    entries: [], derivedMissingCategoryIds: [] }
  const choice = { id: "choice", alternativeId: "alternative", alternativeVersion: 1, basisVersion: 1,
    criteria: ["criterion"], values: [], evidenceRefs: [], principalRef: "person",
    reason: input.body.reason, at, scenario: { baseRef: "source", operations: [], assumptions: [] },
    result: { id: "result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [],
      unresolvedConditions: ["pending costs"], restrictions: [], comparisonStatus: "conditioned" as const,
      costCoverage: coverage, knownSubtotal: 2400, total: null },
    comparison: { baselineResultRef: "baseline", alternativeResultRef: "candidate", costCoverageRefs: [],
      criterionResults: [], unresolvedConditions: ["pending costs"], comparisonStatus: "conditioned" as const,
      knownDifference: 1200, completeDifference: null },
    comparisonStatus: "conditioned" as const, costCoverage: coverage }
  const event = { id: "event", caseRef: { id: "case", incarnation: "incarnation", version: 3 },
    kind: "choice-recorded" as const, principalRef: "person", at, consideredActions: ["alternative"],
    factualGaps: ["pending costs"], lifecycleState: "chosen" as const, rationale: choice.reason,
    evidenceRefs: [], outputDigest: "a".repeat(64) }
  return { status: "ok" as const, context: { ...owner }, value: { projection: {
    context: { installationId: "installation", projectId: "project", principalRef: "person",
      policyVersion: "policy", accessRevision: "revision", kind: "ui" as const },
    case: { id: "case", incarnation: "incarnation", version: 3, state: "chosen" as const,
      objective: "Original decision", horizon, currency: "USD", participants: ["person"],
      alternatives: [], criteria: [], sourceRefs: [], costCoverageBases: [], assumptions: [], questions: [],
      choices: [choice], ledger: [event], preparedChanges: [], receipts: [] },
    events: [event], evidenceRefs: [], checkedAt: at,
  } } }
}
function boundary() {
  const state = { generation: 1, denied: false, stamp: { ...owner },
    read: async (): Promise<SfDesktopInvocationResult> => ({
      kind: "json-response", status: 200, headers: { "content-type": "application/json" }, body: projection(),
    }) }
  const requests: SfDesktopInvocation[] = []
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }), bind: async () => ({ status: "denied" }),
    abort: async () => {}, login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }), release: async () => {},
    invoke: async (request) => {
      if (request.kind !== "request") throw new Error("Unexpected byte request")
      if (request.operationId === "ctx.context") return {
        kind: "json-response", status: state.denied ? 403 : 200, headers: { "content-type": "application/json" },
        body: state.denied ? { status: "denied" } : { status: "ok", value: { stamp: state.stamp,
          contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [] } },
      }
      requests.push(request)
      if (request.operationId === "projection.case") return state.read()
      return { kind: "json-response", status: 409, headers: { "content-type": "application/json" },
        body: { status: "conflict", reason: "original-producer-refusal" } }
    },
  }
  const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => state.generation,
    operations: SfNativeOperationBindings, fetch: async () => { throw new Error("Desktop must use original IPC") },
    desktop, desktopBinding: { bindingHandle: "binding", descriptor, generation: 1 } })
  const refresh = () => createSfContextClient(transport)["ctx.context"]({
    installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
  }, { signal: signal() })
  const inspect = (value = input, abort = signal()) => transport.inspectRecordedChoice!(value, { signal: abort })
  const choose = (body = input.body, key = input.key) =>
    createSfDecisionsClient(transport)["decisions.decision-choose"](body, { signal: signal(), idempotencyKey: key, retry: "same-intent" })
  return { state, requests, transport, refresh, inspect, choose }
}

test("inspection sends only the original GET; a later explicit retry preserves body and key", async () => {
  const f = boundary()
  await f.refresh()
  expect(await f.choose()).toEqual(mismatch)
  expect(f.requests).toHaveLength(0)
  expect(await f.inspect()).toEqual({ status: "ready", choiceId: "choice" })
  expect(f.requests).toHaveLength(1)
  expect(f.requests[0]).toMatchObject({ operationId: "projection.case", input: { caseRef: input.caseRef } })
  expect(await createSfDecisionsClient(f.transport)["decisions.decision-choose"](input.body,
    { signal: signal(), idempotencyKey: "new-key-forbidden" })).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
  expect(await f.choose({ ...input.body, reason: "Changed" })).toEqual(mismatch)
  expect(await f.choose(input.body, "changed-key")).toEqual(mismatch)
  expect(f.requests).toHaveLength(1)
  expect(await f.choose()).toMatchObject({ kind: "response", status: 409,
    body: { status: "conflict", reason: "original-producer-refusal" } })
  expect(f.requests).toHaveLength(2)
  expect(f.requests[1]).toMatchObject({ operationId: "decisions.decision-choose", input: input.body,
    idempotencyKey: input.key, bindingHandle: "binding", generation: 1 })
  expect(await f.choose()).toEqual(mismatch)
  expect(f.requests).toHaveLength(2)
})

test("missing, ambiguous, foreign or changed choice/event never permit a retry", async () => {
  const mutations: Array<(value: ReturnType<typeof projection>) => void> = [
    (v) => { v.value.projection.case.choices = [] },
    (v) => { v.value.projection.case.choices.push(structuredClone(v.value.projection.case.choices[0]!)) },
    (v) => { v.value.projection.case.choices[0]!.principalRef = "other" },
    (v) => { v.value.projection.case.choices[0]!.alternativeVersion = 2 },
    (v) => { v.value.projection.case.choices[0]!.reason = "different" },
    (v) => { v.value.projection.case.choices[0]!.comparison.baselineResultRef = "other" },
    (v) => { v.value.projection.case.ledger = [] },
    (v) => { v.value.projection.case.ledger[0]!.caseRef.version = 4 },
    (v) => { v.value.projection.case.ledger[0]!.principalRef = "other" },
    (v) => { v.value.projection.case.ledger[0]!.at = "2027-01-03T03:04:05.000Z" },
    (v) => { v.value.projection.case.incarnation = "changed" },
    (v) => { v.context.accessRevision = "changed" },
  ]
  for (const mutate of mutations) {
    const f = boundary(), value = projection()
    mutate(value)
    f.state.read = async () => ({ kind: "json-response", status: 200,
      headers: { "content-type": "application/json" }, body: value })
    await f.refresh()
    expect(await f.inspect()).toEqual(unavailable)
    expect(await f.choose()).toEqual(mismatch)
    expect(f.requests).toHaveLength(1)
  }
})

test("stored owner claims, excess fields, abort and a new transport cannot become authority", async () => {
  const f = boundary()
  await f.refresh()
  expect(await f.inspect({ ...input, owner: { ...owner, principalRef: "other" } })).toEqual(unavailable)
  expect(await f.inspect({ ...input, body: { ...input.body, caseRef: { ...input.body.caseRef, version: 3 } } })).toEqual(unavailable)
  const withReceipt = { ...input, receipt: "untrusted" }
  expect(await f.inspect(withReceipt)).toEqual(unavailable)
  const abort = new AbortController(); abort.abort()
  expect(await f.inspect(input, abort.signal)).toEqual(unavailable)
  expect(await f.choose()).toEqual(mismatch)
  const fresh = boundary()
  await fresh.refresh()
  expect(await fresh.choose()).toEqual(mismatch)
  expect(fresh.requests).toHaveLength(0)
})

test("inspection holds mutations and rechecks generation after the original read", async () => {
  const f = boundary()
  await f.refresh()
  let entered!: () => void, release!: () => void
  const started = new Promise<void>((resolve) => { entered = resolve })
  const held = new Promise<void>((resolve) => { release = resolve })
  f.state.read = async () => { entered(); await held; return { kind: "json-response", status: 200,
    headers: { "content-type": "application/json" }, body: projection() } }
  const inspecting = f.inspect()
  await started
  try {
    expect(await f.inspect()).toEqual(unavailable)
    expect(await createSfDecisionsClient(f.transport)["decisions.decision-choose"](input.body,
      { signal: signal(), idempotencyKey: input.key })).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
    f.state.generation = 2
  } finally { release() }
  expect(await inspecting).toEqual(unavailable)
  expect(f.requests).toHaveLength(1)
})

test("revocation followed by the same owner does not resurrect an inspection or retained retry", async () => {
  const f = boundary()
  await f.refresh()
  expect(await f.inspect()).toEqual({ status: "ready", choiceId: "choice" })
  f.state.denied = true
  await f.refresh()
  f.state.denied = false
  await f.refresh()
  expect(await f.choose()).toEqual(mismatch)
  expect(f.requests).toHaveLength(1)
})
