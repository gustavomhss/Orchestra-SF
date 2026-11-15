import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import { SfCollaboration } from "../../../../../packages/schema/src/sucafina/collaboration.ts"
import { createSfCollaborationClient } from "../../../../../packages/client/src/sucafina/collaboration.ts"
import type { SfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"

/**
 * Source-contract tests for A13. They are not a substitute for the real host's
 * authenticated recipient/lease/transaction integration qualification by 120.
 * No fake authorization, no producer mutation, no new HTTP/desktop backend.
 */
const period = { start: "2026-11-01", end: "2026-11-30" }
const evidence = {
  schema: "sf-evidence-v1" as const, kind: "record" as const,
  refId: "evidence-1", installationId: "inst", projectId: "project",
  refDigest: "digest", evidenceLevel: "observed" as const,
  target: {
    surface: "dashboard" as const, recordType: "hotTopics",
    recordId: "target-1", incarnation: "physical-1", version: 1,
    fields: ["status"], period, projectionDigest: "projection-digest",
  },
}
const mutation = { expectedStorageVersion: 0, idempotencyKey: "client-request-1" }
const thread = {
  id: "thread-1", kind: "clarification" as const, sourceRef: evidence.refId,
  sourceIncarnation: evidence.target.incarnation, observedVersion: 1, period,
  recipientRef: "recipient-1", state: "open" as const,
  messages: [{
    id: "message-1", incarnation: "message-incarnation-1", version: 1,
    authorRef: "author-1", body: "Evidence-backed question", createdAt: "2026-11-15T12:00:00Z",
  }],
  evidenceRefs: [evidence],
}

describe("A13 fixed source collaboration contracts", () => {
  test("exactly 29 closed registered schemas with source-catalogued operation IDs", () => {
    const expected = [
      "question-consume", "question-output", "thread-create", "thread-read",
      "thread-reply", "thread-resolve", "thread-edit", "thread-history",
      "relation-create", "relation-remove", "relation-read",
      "handoff-create", "handoff-link", "handoff-update",
      "confirmation-prepare", "confirmation-confirm", "confirmation-project",
      "answer-prepare", "answer-prepare-message", "answer-confirm", "answer-read",
      "selection-create", "selection-list", "selection-version", "cycle-read",
      "work-list", "work-destination", "recipients", "storage-version",
    ].map((slug) => "collaboration." + slug)
    const observed = Object.keys(SfCollaboration.operations)
    expect(observed).toEqual(expected)
    expect(new Set(observed).size).toBe(29)
    for (const id of observed) {
      const entry = SfCollaboration.operations[id as keyof typeof SfCollaboration.operations]
      expect(entry.operationId).toBe(id)
      expect(entry.input).toBeDefined()
      expect(entry.output).toBeDefined()
    }
  })

  test("replies require existing thread identity, CAS and idempotency, not implicit consent", () => {
    const schema = SfCollaboration.operations["collaboration.thread-reply"].input
    const valid = { id: thread.id, body: "Acknowledged", mutation }
    expect(Schema.decodeUnknownSync(schema)(valid)).toEqual(valid)
    expect(() => Schema.decodeUnknownSync(schema)({ id: thread.id, body: "reply" })).toThrow()
    expect(() => Schema.decodeUnknownSync(schema)({
      ...valid, mutation: { idempotencyKey: mutation.idempotencyKey },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(schema)({
      ...valid, grantRecipient: "recipient-2",
    })).toThrow()
  })

  test("recipient discussion read preserves current and original evidence identities", () => {
    const recipientView = {
      ...thread, observed: { version: 1, period },
      current: { sourceRef: evidence, evidenceRefs: [evidence] },
      continuity: "unchanged" as const,
    }
    const schema = SfCollaboration.operations["collaboration.thread-read"].output
    expect(Schema.decodeUnknownSync(schema)({ status: "ok", value: thread }))
      .toEqual({ status: "ok", value: thread })
    expect(Schema.decodeUnknownSync(schema)({ status: "ok", value: recipientView }))
      .toEqual({ status: "ok", value: recipientView })
    expect(Schema.decodeUnknownSync(schema)({
      status: "denied", reason: "thread-access-unavailable",
    })).toEqual({ status: "denied", reason: "thread-access-unavailable" })
  })

  test("recipient edit and history require message identity and incarnation", () => {
    const edit = SfCollaboration.operations["collaboration.thread-edit"].input
    const expected = {
      id: thread.id, messageId: "message-1", expectedVersion: 1,
      body: "Revised", mutation,
    }
    expect(Schema.decodeUnknownSync(edit)(expected)).toEqual(expected)
    expect(() => Schema.decodeUnknownSync(edit)({
      ...expected, expectedVersion: 0,
    })).toThrow()
    const history = SfCollaboration.operations["collaboration.thread-history"].input
    expect(Schema.decodeUnknownSync(history)({
      id: thread.id, messageId: "message-1", incarnation: "message-incarnation-1", version: 1,
    })).toBeDefined()
    expect(() => Schema.decodeUnknownSync(history)({
      id: thread.id, messageId: "message-1", version: 1,
    })).toThrow()
  })

  test("relations cannot become approval or a free-form operation", () => {
    const pair = { fromRef: "evidence-1", toRef: "evidence-2", kind: "related", evidenceRefs: [evidence] }
    const input = SfCollaboration.operations["collaboration.relation-create"].input
    expect(Schema.decodeUnknownSync(input)({ operation: "create", pair, mutation }))
      .toEqual({ operation: "create", pair, mutation })
    expect(() => Schema.decodeUnknownSync(input)({ operation: "approve", pair, mutation })).toThrow()
    expect(() => Schema.decodeUnknownSync(input)({ operation: "remove", pair, mutation })).toThrow()
    expect(Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.relation-remove"].input)({
      operation: "remove", id: "relation-1", pair, mutation,
    })).toBeDefined()
    expect(() => Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.relation-read"].input)({
      recordRefs: [],
    })).toThrow()
  })

  test("handoff update keeps expectedVersion and relation correlation separate", () => {
    const input = SfCollaboration.operations["collaboration.handoff-update"].input
    const valid = {
      topicId: "topic-1", expectedVersion: 7,
      idempotencyKey: "topic-update-1", values: { due: "2026-12-01", notes: "" },
      sourceRefs: [evidence], sourceRef: evidence.refId, relationKey: "relation-key-1",
      recipientRef: "recipient-1",
    }
    expect(Schema.decodeUnknownSync(input)(valid)).toEqual(valid)
    expect(() => Schema.decodeUnknownSync(input)({
      ...valid, expectedVersion: -1,
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(input)({
      ...valid, permission: "admin",
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(input)({
      ...valid, values: { due: "2026-12-01", newRole: "owner" },
    })).toThrow()
  })

  test("question consumption binds a real preparation with the exact source and recipient", () => {
    const input = SfCollaboration.operations["collaboration.question-consume"].input
    const proposal = {
      kind: "prepared" as const,
      result: {
        caseRef: "case-1", question: "What changed?", recipientRef: "recipient-1",
        evidenceRefs: [evidence], expectedCaseVersion: 2,
      },
      receipt: {
        kind: "ui" as const, operation: "sf_question_prepare" as const,
        handlerExport: "prepareQuestion" as const,
        inputDigest: "input-digest", resultDigest: "output-digest",
        principalRef: "author-1", callId: "call-1", accessRevision: "rev-1",
        at: "2026-11-15T12:00:00Z", requestId: "request-1",
      },
    }
    const command = { proposal, sourceRef: evidence.refId, period, mutation }
    expect(Schema.decodeUnknownSync(input)(command)).toEqual(command)
    expect(() => Schema.decodeUnknownSync(input)({
      ...command, proposal: { ...proposal, receipt: { ...proposal.receipt, kind: "native" } },
    })).toThrow()
    expect(() => Schema.decodeUnknownSync(input)({
      ...command, consent: "assumed",
    })).toThrow()
  })

  test("confirmation validity never treats removal or revocation as a valid confirmation", () => {
    const read = SfCollaboration.operations["collaboration.confirmation-project"].output
    const stale = {
      status: "ok" as const, value: {
        confirmationId: "confirmation-1", evaluatedSourceVersion: 3,
        evaluatedAt: "2026-11-15T12:00:00Z", state: "stale" as const,
        reason: "source-replaced" as const,
      },
    }
    expect(Schema.decodeUnknownSync(read)(stale)).toEqual(stale)
    expect(() => Schema.decodeUnknownSync(read)({
      ...stale, value: { ...stale.value, state: "valid", reason: "source-replaced" },
    })).toThrow()
    expect(Schema.decodeUnknownSync(read)({
      status: "unavailable", reason: "access-revoked",
    })).toEqual({ status: "unavailable", reason: "access-revoked" })
  })

  test("observations do not turn zero/null into an invented complete measurement", () => {
    const scope = {
      sourceRef: { surface: "dashboard" as const, type: "hotTopics", id: "target-1", incarnation: "physical-1" },
      fields: ["status"], period, materialDependencies: [], scopeDefinitionVersion: "v1",
    }
    const projection = {
      context: {
        installationId: "inst", projectId: "project", principalRef: "author-1",
        accessRevision: "rev-1", policyVersion: "policy-1", surface: "dashboard" as const,
        period, currency: "USD", sourceRefs: [], capabilities: [],
      },
      version: 0, engineVersion: "engine-1", components: [{
        id: "unknown", amount: null, currency: "USD", period, sourceRefs: [],
        evidenceState: "absent" as const,
      }],
      values: [{
        id: "measured", value: 0, period, granularity: "month" as const,
        sourceRefs: [], drilldown: null, evidenceState: "confirmed" as const,
      }],
      missing: [],
    }
    const observed = {
      status: "ok" as const, value: {
        sourceVersion: 1, incarnation: "physical-1", scopeFingerprint: "fingerprint",
        evidence, projection,
      },
    }
    expect(Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-prepare"].output)(observed))
      .toEqual(observed)
    const confirm = SfCollaboration.operations["collaboration.confirmation-confirm"].input
    expect(Schema.decodeUnknownSync(confirm)({
      scope, observedSourceVersion: 1, expectedScopeFingerprint: "fingerprint",
      expectedStorageVersion: 0, idempotencyKey: "confirmed-1",
    })).toBeDefined()
    expect(() => Schema.decodeUnknownSync(confirm)({
      scope, observedSourceVersion: 1, expectedScopeFingerprint: "fingerprint",
      idempotencyKey: "confirmed-1",
    })).toThrow()
  })

  test("answer confirmation requires a preparation observation receipt", () => {
    const input = SfCollaboration.operations["collaboration.answer-confirm"].input
    const data = {
      questionId: "question-1", answerRef: "answer-1",
      mutation: {
        expectedStorageVersion: 0, idempotencyKey: "answer-1",
        observationRef: "observation-1", observedSourceVersion: 2,
        expectedScopeFingerprint: "scope-1",
      },
    }
    expect(Schema.decodeUnknownSync(input)(data)).toEqual(data)
    expect(() => Schema.decodeUnknownSync(input)({
      ...data, mutation: { idempotencyKey: "answer-1", expectedStorageVersion: 0 },
    })).toThrow()
  })

  test("empty reads cannot smuggle a permission grant or generic dispatch name", () => {
    for (const id of ["collaboration.recipients", "collaboration.selection-version"] as const) {
      const input = SfCollaboration.operations[id].input
      expect(Schema.decodeUnknownSync(input)({})).toEqual({})
      expect(Option.isSome(Schema.decodeUnknownOption(input)({}))).toBe(true)
      // F02 calls decodeUnknownOption before choosing the route or sending IO.
      // Both its decoder and direct consumers must reject extras rather than strip them.
      expect(() => Schema.decodeUnknownSync(input)({
        operation: "grant", principalRef: "anyone",
      })).toThrow()
      for (const extra of [
        { operation: "grant" },
        { principalRef: "anyone" },
        { action: "dispatch" },
        { permission: "admin" },
        { operation: "grant", principalRef: "anyone", expectedStorageVersion: 0 },
      ]) {
        expect(() => Schema.decodeUnknownSync(input)(extra)).toThrow()
        expect(Option.isNone(Schema.decodeUnknownOption(input)(extra))).toBe(true)
      }
    }
    const names = Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.recipients"].output)({
      status: "ok", value: [{ id: "recipient-1", name: "Permitted recipient" }],
    })
    expect(names).toEqual({ status: "ok", value: [{ id: "recipient-1", name: "Permitted recipient" }] })
  })

  test("client passes owner-bound options as-is, never retries ambiguous mutations", async () => {
    const captured: { id: string; input: unknown; options: unknown }[] = []
    const transport: SfTransport = {
      async execute(operation, input, options) {
        captured.push({ id: operation.operationId, input, options })
        return { kind: "transport-error", reason: "outcome-unknown" }
      },
    }
    const client = createSfCollaborationClient(transport)
    const abort = new AbortController()
    const options = { signal: abort.signal, idempotencyKey: "wire-1" }
    const input = { id: thread.id, body: "No retry", mutation }
    const result = await client["collaboration.thread-reply"](input, options)
    expect(result).toEqual({ kind: "transport-error", reason: "outcome-unknown" })
    expect(captured).toHaveLength(1)
    expect(captured[0]).toEqual({ id: "collaboration.thread-reply", input, options })
    expect(captured[0]?.options).toBe(options)
  })
})
