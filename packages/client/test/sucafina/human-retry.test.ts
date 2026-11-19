import { expect, test } from "bun:test"
import { createSfContextClient } from "../../src/sucafina/context"
import { createSfCollaborationClient } from "../../src/sucafina/collaboration"
import { createSfDecisionsClient } from "../../src/sucafina/decisions"
import { SfNativeOperationBindings } from "../../src/sucafina/bindings"
import {
  createSfTransport, type SfCallOptions, type SfDesktopCapability,
  type SfDesktopInvocation, type SfDesktopInvocationResult, type SfTransport,
  type SfTransportResult,
} from "../../src/sucafina/transport"

// Synthetic IPC boundaries exercise F02 refusal/dispatch only. They are not
// installed authority, C08 receipts, or evidence of producer exactly-once effects.
const descriptor = {
  installationId: "installation", projectId: "project", hostId: "host",
  publicOrigin: "https://installation.example", mount: "/sucafina",
  authMode: "microsoft" as const, contractRevision: "sf-native-ui/1" as const,
}
const originalStamp = {
  installationId: "installation", projectId: "project", hostId: "host",
  principalRef: "person", policyVersion: "policy", accessRevision: "revision",
}
const key = "human-intent-0001"
const mutation = { expectedStorageVersion: 3, idempotencyKey: key }
const period = { start: "2027-01-01", end: "2027-12-31" }
const caseRef = { id: "case", incarnation: "case-incarnation", version: 2 }
const reply = { id: "thread", body: "Exact reviewed reply", mutation }
const confirmed = {
  questionId: "question", answerRef: "answer",
  mutation: { ...mutation, observationRef: "original-observation",
    observedSourceVersion: 4, expectedScopeFingerprint: "original-fingerprint" },
}
const signal = () => new AbortController().signal
const call = (): SfCallOptions => ({ signal: signal(), idempotencyKey: key })
const retry = (): SfCallOptions => ({ ...call(), retry: "same-intent" })
const unknown = { kind: "transport-error", reason: "outcome-unknown" } as const
const mismatch = { kind: "transport-error", reason: "contract-mismatch" } as const
const unavailable = (): SfDesktopInvocationResult => ({
  kind: "json-response", status: 503, headers: { "content-type": "application/json" },
  body: { status: "unavailable", reason: "reply-lost-after-dispatch" },
})

function boundary() {
  const state = {
    generation: 1, stamp: { ...originalStamp }, denied: false, invalidDenied: false,
    reply: async (): Promise<SfDesktopInvocationResult> => unavailable(),
  }
  const requests: SfDesktopInvocation[] = []
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }),
    bind: async () => ({ status: "denied" }),
    abort: async () => {}, login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }), release: async () => {},
    invoke: async (request) => {
      if (request.kind !== "request") throw new Error("Unexpected byte chunk")
      if (request.operationId === "ctx.context") return {
        kind: "json-response", status: state.denied ? 403 : 200,
        headers: { "content-type": state.invalidDenied ? "text/html" : "application/json" },
        body: state.denied ? { status: "denied" } : {
          status: "ok", value: { stamp: state.stamp, contractRevision: "sf-native-ui/1",
            authMode: "microsoft", destinations: [], availability: [] },
        },
      }
      requests.push(request)
      return state.reply()
    },
  }
  const transport = createSfTransport({
    binding: descriptor, generation: 1, currentGeneration: () => state.generation,
    fetch: async () => { throw new Error("Desktop must not use renderer fetch") },
    operations: SfNativeOperationBindings, desktop,
    desktopBinding: { bindingHandle: "binding", descriptor, generation: 1 },
  })
  const refresh = () => createSfContextClient(transport)["ctx.context"]({
    installationId: descriptor.installationId, projectId: descriptor.projectId, hostId: descriptor.hostId,
  }, { signal: signal() })
  return { state, requests, transport, refresh }
}

const probes: ReadonlyArray<{
  name: string
  invoke: (transport: SfTransport, options: SfCallOptions) => Promise<SfTransportResult<unknown>>
}> = [
  { name: "decisions.decision-promote", invoke: (transport, options) =>
    createSfDecisionsClient(transport)["decisions.decision-promote"]({
      caseRef, title: "Reviewed alternative",
      scenario: { baseRef: "forecast", operations: [], assumptions: [] }, coverageRef: "coverage",
    }, options) },
  { name: "decisions.decision-choose", invoke: (transport, options) =>
    createSfDecisionsClient(transport)["decisions.decision-choose"]({
      caseRef, alternativeId: "alternative", alternativeVersion: 1,
      comparison: { scenarioRefs: ["baseline", "candidate"], criteria: ["criterion"] },
      criteria: ["criterion"], reason: "Reviewed human choice",
    }, options) },
  { name: "collaboration.thread-create", invoke: (transport, options) =>
    createSfCollaborationClient(transport)["collaboration.thread-create"]({
      draft: { kind: "review", sourceRef: "source", sourceIncarnation: "incarnation",
        observedVersion: 2, period, evidenceRefs: [], body: "Exact reviewed comment" }, mutation,
    }, options) },
  { name: "collaboration.thread-reply", invoke: (transport, options) =>
    createSfCollaborationClient(transport)["collaboration.thread-reply"](reply, options) },
  { name: "collaboration.thread-edit", invoke: (transport, options) =>
    createSfCollaborationClient(transport)["collaboration.thread-edit"]({
      id: "thread", messageId: "message", expectedVersion: 2, body: "Exact reviewed edit", mutation,
    }, options) },
  { name: "collaboration.answer-confirm", invoke: (transport, options) =>
    createSfCollaborationClient(transport)["collaboration.answer-confirm"](confirmed, options) },
]

for (const probe of probes) test(`explicit retry retains the original intent: ${probe.name}`, async () => {
  const fixture = boundary()
  await fixture.refresh()
  expect(await probe.invoke(fixture.transport, retry())).toEqual(mismatch)
  expect(fixture.requests).toHaveLength(0)
  expect(await probe.invoke(fixture.transport, call())).toEqual(unknown)
  expect(fixture.requests).toHaveLength(1)
  expect(await probe.invoke(fixture.transport, call())).toEqual(unknown)
  expect(fixture.requests).toHaveLength(1)
  expect(await probe.invoke(fixture.transport, retry())).toEqual(unknown)
  expect(fixture.requests).toHaveLength(2)
  const [first, second] = fixture.requests
  if (!first || !second || first.kind !== "request" || second.kind !== "request")
    throw new Error("Original and explicit retry requests are required")
  expect(first.operationId).toBe(probe.name)
  expect(second.operationId).toBe(first.operationId)
  expect(second.input).toEqual(first.input)
  expect(second.idempotencyKey).toBe(first.idempotencyKey)
  expect(second.bindingHandle).toBe(first.bindingHandle)
  expect(second.generation).toBe(first.generation)
})

test("changed body, key and operation are refused without replacing the retained intent", async () => {
  const fixture = boundary()
  await fixture.refresh()
  const client = createSfCollaborationClient(fixture.transport)
  expect(await client["collaboration.thread-reply"](reply, call())).toEqual(unknown)
  expect(await client["collaboration.thread-reply"]({ ...reply, body: "Changed" }, retry())).toEqual(mismatch)
  expect(await client["collaboration.thread-reply"](reply, { ...retry(), idempotencyKey: "different-intent" })).toEqual(mismatch)
  expect(await client["collaboration.thread-edit"]({
    id: reply.id, messageId: "message", expectedVersion: 2, body: reply.body, mutation,
  }, retry())).toEqual(mismatch)
  expect(fixture.requests).toHaveLength(1)
  expect(await client["collaboration.thread-reply"](reply, retry())).toEqual(unknown)
  expect(fixture.requests).toHaveLength(2)
})

test("a pending dispatch and its explicit retry each refuse concurrent resubmission", async () => {
  const fixture = boundary()
  await fixture.refresh()
  const client = createSfCollaborationClient(fixture.transport)
  for (const options of [call(), retry()]) {
    let release!: () => void
    let entered!: () => void
    const held = new Promise<void>((resolve) => { release = resolve })
    const started = new Promise<void>((resolve) => { entered = resolve })
    fixture.state.reply = async () => { entered(); await held; return unavailable() }
    const request = client["collaboration.thread-reply"](reply, options)
    await started
    try {
      expect(await client["collaboration.thread-reply"](reply, retry())).toEqual(unknown)
    } finally { release() }
    expect(await request).toEqual(unknown)
  }
  expect(fixture.requests).toHaveLength(2)
})

test("owner changes and revocation clear retained intents even after reauthentication", async () => {
  for (const field of ["principalRef", "policyVersion", "accessRevision"] as const) {
    const fixture = boundary()
    await fixture.refresh()
    const client = createSfCollaborationClient(fixture.transport)
    expect(await client["collaboration.thread-reply"](reply, call())).toEqual(unknown)
    fixture.state.stamp = { ...originalStamp, [field]: "changed" }
    await fixture.refresh()
    expect(await client["collaboration.thread-reply"](reply, retry())).toEqual(mismatch)
    fixture.state.stamp = { ...originalStamp }
    await fixture.refresh()
    expect(await client["collaboration.thread-reply"](reply, retry())).toEqual(mismatch)
    expect(fixture.requests).toHaveLength(1)
  }
  for (const invalidDenied of [false, true]) {
    const fixture = boundary()
    await fixture.refresh()
    const client = createSfCollaborationClient(fixture.transport)
    expect(await client["collaboration.thread-reply"](reply, call())).toEqual(unknown)
    fixture.state.denied = true
    fixture.state.invalidDenied = invalidDenied
    await fixture.refresh()
    fixture.state.denied = false
    fixture.state.invalidDenied = false
    await fixture.refresh()
    expect(await client["collaboration.thread-reply"](reply, retry())).toEqual(mismatch)
    expect(fixture.requests).toHaveLength(1)
  }
})

test("a new transport or obsolete generation cannot replay an uncertain intent", async () => {
  const fixture = boundary()
  await fixture.refresh()
  expect(await createSfCollaborationClient(fixture.transport)["collaboration.thread-reply"](reply, call())).toEqual(unknown)
  fixture.state.generation++
  expect(await createSfCollaborationClient(fixture.transport)["collaboration.thread-reply"](reply, retry())).toEqual(mismatch)
  const restarted = boundary()
  await restarted.refresh()
  expect(await createSfCollaborationClient(restarted.transport)["collaboration.thread-reply"](reply, retry())).toEqual(mismatch)
  expect(fixture.requests).toHaveLength(1)
  expect(restarted.requests).toHaveLength(0)
})

test("a terminal original response settles the retry without replacing its observation or CAS", async () => {
  const fixture = boundary()
  await fixture.refresh()
  const client = createSfCollaborationClient(fixture.transport)
  expect(await client["collaboration.answer-confirm"](confirmed, call())).toEqual(unknown)
  fixture.state.reply = async () => ({ kind: "json-response", status: 200,
    headers: { "content-type": "application/json" },
    body: { status: "ok", value: { answerRef: "answer", observedVersion: 4 } } })
  const result = await client["collaboration.answer-confirm"](confirmed, retry())
  expect(result).toEqual({ kind: "response", status: 200,
    headers: { "content-type": "application/json" },
    body: { status: "ok", value: { answerRef: "answer", observedVersion: 4 } } })
  expect(await client["collaboration.answer-confirm"](confirmed, call())).toEqual(unknown)
  expect(fixture.requests).toHaveLength(2)
  for (const request of fixture.requests) {
    if (request.kind !== "request") throw new Error("Mutation request required")
    expect(request.input).toEqual(confirmed)
    expect(request.idempotencyKey).toBe(key)
  }
})

test("the human retry option does not admit other mutations or reads", async () => {
  const fixture = boundary()
  await fixture.refresh()
  const client = createSfCollaborationClient(fixture.transport)
  const payload = { id: "thread", mutation }
  expect(await client["collaboration.thread-resolve"](payload, call())).toEqual(unknown)
  expect(await client["collaboration.thread-resolve"](payload, retry())).toEqual(mismatch)
  expect(await client["collaboration.thread-read"]({ id: "thread" }, { signal: signal(), retry: "same-intent" })).toEqual(mismatch)
  expect(fixture.requests).toHaveLength(1)
})

test("a known original receipt can be retried explicitly after a failed follow-up read", async () => {
  const fixture = boundary()
  await fixture.refresh()
  const client = createSfCollaborationClient(fixture.transport)
  fixture.state.reply = async () => ({ kind: "json-response", status: 200,
    headers: { "content-type": "application/json" },
    body: { status: "ok", value: { answerRef: "answer", observedVersion: 4 } } })
  const first = await client["collaboration.answer-confirm"](confirmed, call())
  expect(first.kind).toBe("response")
  fixture.state.reply = async () => ({ kind: "transport-error", reason: "network" })
  expect(await client["collaboration.thread-read"]({ id: "thread" }, { signal: signal() }))
    .toEqual({ kind: "transport-error", reason: "network" })
  fixture.state.reply = async () => ({ kind: "json-response", status: 200,
    headers: { "content-type": "application/json" },
    body: { status: "ok", value: { answerRef: "answer", observedVersion: 4 } } })
  expect(await client["collaboration.answer-confirm"](confirmed, retry())).toEqual(first)
  const writes = fixture.requests.filter((request) =>
    request.kind === "request" && request.operationId === "collaboration.answer-confirm")
  expect(writes).toHaveLength(2)
  for (const request of writes) {
    if (request.kind !== "request") throw new Error("Mutation request required")
    expect(request.input).toEqual(confirmed)
    expect(request.idempotencyKey).toBe(key)
  }
})

test("a newer intent and a terminal refusal each remove the older retry opportunity", async () => {
  const fixture = boundary()
  await fixture.refresh()
  const client = createSfCollaborationClient(fixture.transport)
  expect(await client["collaboration.thread-reply"](reply, call())).toEqual(unknown)
  const next = { ...reply, body: "Next reviewed reply",
    mutation: { ...mutation, idempotencyKey: "human-intent-0002" } }
  const nextCall = { signal: signal(), idempotencyKey: next.mutation.idempotencyKey }
  expect(await client["collaboration.thread-reply"](next, nextCall)).toEqual(unknown)
  expect(await client["collaboration.thread-reply"](reply, retry())).toEqual(mismatch)
  fixture.state.reply = async () => ({ kind: "json-response", status: 409,
    headers: { "content-type": "application/json" },
    body: { status: "conflict", reason: "original-observation-expired" } })
  const refused = await client["collaboration.thread-reply"](next, { ...nextCall, retry: "same-intent" })
  expect(refused).toEqual({ kind: "response", status: 409,
    headers: { "content-type": "application/json" },
    body: { status: "conflict", reason: "original-observation-expired" } })
  expect(await client["collaboration.thread-reply"](next, { ...nextCall, retry: "same-intent" })).toEqual(mismatch)
  expect(fixture.requests).toHaveLength(3)
})
