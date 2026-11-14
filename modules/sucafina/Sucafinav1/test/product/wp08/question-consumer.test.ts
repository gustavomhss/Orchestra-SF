import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfDomainAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { createProcurementCollectionRegistry } from "../../../product/procurement/sources.ts"
import { createProcurementPort } from "../../../product/procurement/port.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import { createCollaborationHttp } from "../../../product/collaboration/http.ts"
import { isConsumedQuestion } from "../../../product/collaboration/question-consumer.ts"
import type { QuestionConsumption } from "../../../product/collaboration/question-consumer.ts"
import type { PreparedQuestion } from "../../../product/collaboration/question-preparations.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { available, createRelationsFixture } from "./relations-fixture.ts"

const january = { start: "2026-01-01", end: "2026-01-31" }
const february = { start: "2026-02-01", end: "2026-02-28" }

async function fixture(annualSource = false) {
  const f = await createRelationsFixture()
  try {
    const source = available(await f.records.issue({ page: "All Projects", recordType: "projects", recordId: "project", fields: ["status"], period: annualSource ? f.period : january }, f.read))
    let at = Date.parse("2026-11-13T00:00:00Z")
    const now = () => new Date(at++).toISOString()
    let race: (() => Promise<void>) | undefined
    const state: SfProductStatePort = { ...f.state, transaction: async (request, command, work) => {
      if (command.namespace === "threads" && race) { const action = race; race = undefined; await action() }
      return f.state.transaction(request, command, work)
    } }
    const authority = createSfDomainAuthority({ ui: f.ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
    const readContext = async (operation: string, payload: unknown) => {
      const context = available(await f.ui.admit(f.request(), operation, digestSfValue(payload)))
      if (!await f.ui.validate(context, operation, digestSfValue(payload))) throw new Error(`read admission failed: ${operation}`)
      return context
    }
    const cases = createDecisionCasePort({ host: f.host, state, creationTarget: f.creationTarget, operationIdentity: (context) => context.kind === "ui" ? f.ui.operationIdentity(context) : undefined, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await f.host.revalidate(context), evidence: f.evidence, createId: randomUUID, now })
    const draft = { objective: "Review January delivery", horizon: january, currency: "USD", criteria: ["Delivery is understood"], sourceRefs: [source] }
    const decision = available(await cases.draft(draft, await readContext("sf_case_draft", draft)))
    const caseRef = encodeCaseRef(decision)
    const contextFor = async (context: TrustedDomainContext) => ({ status: "ok" as const, value: { installationId: context.binding.installationId, projectId: context.binding.projectId, principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision, policyVersion: context.binding.policyVersion, surface: "procurement" as const, period: f.period, currency: "USD", sourceRefs: [], capabilities: [] } })
    const collections = createProcurementCollectionRegistry({ host: f.host, scopedSources: f.persistence, contextFor })
    const procurement = createProcurementPort({ ...f.host, ...collections, resolveSupplierSource: f.suppliers.resolve, isCurrentSupplierSource: f.suppliers.isCurrent, readContractSource: async () => ({ status: "unavailable", reason: "not-selected" }) })
    const compose = () => createCollaborationHost({ host: f.host, state, creationTarget: f.creationTarget, scopedSources: f.persistence, evidence: f.evidence, cases, procurement, collections, human: f.human, authority, requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now })
    const host = compose()
    const prepare = async (question = "What changes January delivery?"): Promise<PreparedQuestion> => {
      const payload = { caseRef, question: { text: question, criterionRef: decision.criteria[0]!.id }, recipientRef: f.person.id, sourceRefs: [source] }
      const context = available(await f.ui.admit(f.request(), "sf_question_prepare", digestSfValue(payload)))
      const prepared = await dispatchSfCapability({ operation: "sf_question_prepare", payload, context, descriptors: host.capabilities, authority, validateInput: (_descriptor, value) => decodeSfOperationInput("sf_question_prepare", value).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_question_prepare", value.result).ok })
      if (prepared.status !== "ok") throw new Error(`actual question prepare failed: ${prepared.status}: ${prepared.reason}`)
      const decoded = decodeSfOperationOutput("sf_question_prepare", prepared.result)
      if (!decoded.ok) throw new Error("actual prepared output invalid")
      return { kind: "prepared", result: decoded.value, receipt: prepared.receipt }
    }
    const command = (proposal: PreparedQuestion, key = "consume-question"): QuestionConsumption => ({ proposal, sourceRef: source.refId, period: january, mutation: { expectedStorageVersion: 0, idempotencyKey: key } })
    const consume = async (value: QuestionConsumption) => host.questions.consume(value, await f.admit("collaboration.question.confirm", value))
    const stored = async () => {
      const found = await state.read(f.request(), "threads", (value) => Object.values(value.threads).filter(isConsumedQuestion))
      if (found.status !== "ok") throw new Error(`thread read failed: ${found.status}`)
      return found.value
    }
    const changeCase = async (advanceVersion: boolean, revoke = false) => {
      const before = await f.state.read(f.request(), "cases", (value) => value.cases[decision.id])
      if (before.status !== "ok" || !before.value) throw new Error("case stimulus unavailable")
      const changed = await f.state.transaction(f.request(), { namespace: "cases", expectedStorageVersion: before.storageVersion, idempotencyKey: randomUUID(), commandDigest: digestSfValue({ advanceVersion, revoke, prior: before.value }), targetRef: f.creationTarget.ref, targetIncarnation: f.creationTarget.incarnation }, async (value) => {
        if (revoke) value.cases[decision.id]!.participants = []
        else value.cases[decision.id]!.objective = "Case changed after preparation"
        if (advanceVersion) value.cases[decision.id]!.version += 1
        return { commit: true, value: null }
      })
      expect(changed.status).toBe("ok")
    }
    return { ...f, source, cases, decision, caseRef, host, compose, prepare, command, consume, stored, changeCase, arm: (action: () => Promise<void>) => { race = action }, advance: (milliseconds: number) => { at += milliseconds } }
  } catch (error) { await f.dispose(); throw error }
}

test("real prepared QuestionProposal becomes one canonical thread with case provenance and survives host recomposition", async () => {
  const f = await fixture()
  try {
    // Real case projections have different read timestamps; stable content still prepares successfully.
    const first = available(await f.cases.read({ caseRef: f.caseRef }, f.read))
    const second = available(await f.cases.read({ caseRef: f.caseRef }, f.read))
    expect(first.checkedAt).not.toBe(second.checkedAt)
    expect(first.case).toEqual(second.case)
    const prepared = await f.prepare()
    const command = f.command(prepared)
    const before = await f.snapshots()
    const protectedBefore = await f.state.read(f.request(), "cases", (state) => ({ cases: state.cases, contributions: state.contributions, nativeRuns: state.nativeRuns }))
    const created = available(await f.consume(command))
    expect(created).toMatchObject({ kind: "clarification", sourceRef: f.source.refId, sourceIncarnation: f.source.target.incarnation, observedVersion: f.source.target.version, period: january, recipientRef: prepared.result.recipientRef, state: "open", evidenceRefs: prepared.result.evidenceRefs, messages: [{ authorRef: f.person.id, body: prepared.result.question }] })
    expect(created.questionOrigin).toMatchObject({ schema: "sf-question-origin-v1", caseRef: { id: f.decision.id, incarnation: f.decision.incarnation, version: prepared.result.expectedCaseVersion }, caseDigest: digestSfValue(f.decision), proposalDigest: digestSfValue(prepared.result), criterionRef: prepared.result.criterionRef, horizon: january, provenance: { kind: "prepared", callId: prepared.receipt.callId, receiptDigest: digestSfValue(prepared.receipt) } })
    expect(available(await f.host.resolveQuestion(created.id, f.read))).toEqual({ id: created.id, text: prepared.result.question, evidenceRefs: prepared.result.evidenceRefs })
    expect(available(await f.consume(command))).toEqual(created)
    f.advance(301_000)
    const recomposed = f.compose()
    expect(available(await recomposed.questions.consume(command, await f.admit("collaboration.question.confirm", command)))).toEqual(created)
    expect(await f.stored()).toEqual([created])
    const protectedAfter = await f.state.read(f.request(), "cases", (state) => ({ cases: state.cases, contributions: state.contributions, nativeRuns: state.nativeRuns }))
    expect(protectedAfter.status === "ok" && protectedAfter.value).toEqual(protectedBefore.status === "ok" && protectedBefore.value)
    expect(await f.snapshots()).toEqual(before)
    // Ordinary source-authorized thread readers/actions do not disclose private case/output metadata.
    expect("questionOrigin" in available(await f.host.threads.read(created.id, f.read))).toBe(false)
    const replyMutation = { expectedStorageVersion: 1, idempotencyKey: "reply-to-consumed-question" }
    const body = "The January condition is understood"
    const reply = available(await f.host.threads.reply(created.id, body, replyMutation, await f.admit("collaboration.thread.reply", { id: created.id, body, mutation: replyMutation })))
    expect("questionOrigin" in reply).toBe(false)
    const resolveMutation = { expectedStorageVersion: 2, idempotencyKey: "resolve-consumed-question" }
    const resolved = available(await f.host.threads.resolve(created.id, resolveMutation, await f.admit("collaboration.thread.resolve", { id: created.id, mutation: resolveMutation })))
    expect("questionOrigin" in resolved).toBe(false)
    expect((await f.stored())[0]!.questionOrigin).toEqual(created.questionOrigin)
    await f.changeCase(false, true)
    expect((await f.cases.read({ caseRef: f.caseRef }, f.read)).status).toBe("denied")
    const sourceOnly = available(await f.host.threads.read(created.id, f.read))
    expect(sourceOnly.messages[0]!.body).toBe(prepared.result.question)
    expect("questionOrigin" in sourceOnly).toBe(false)
    expect(await recomposed.questions.consume(command, await f.admit("collaboration.question.confirm", command))).toEqual({ status: "unavailable", reason: "question-case-or-source-changed" })
    expect(await f.snapshots()).toEqual(before)
  } finally { await f.dispose() }
})

test("question consumer rejects altered human payload, forged preparation, cloned authority and missing C11 reader", async () => {
  const f = await fixture()
  try {
    const prepared = await f.prepare()
    const command = f.command(prepared)
    const admitted = await f.admit("collaboration.question.confirm", command)
    expect(await f.host.questions.consume({ ...command, period: { start: "2026-01-02", end: "2026-01-31" } }, admitted)).toEqual({ status: "denied", reason: "question-confirmation-unavailable" })
    expect(await f.host.questions.consume(command, structuredClone(admitted))).toEqual({ status: "denied", reason: "question-confirmation-unavailable" })
    const forgedResult = { ...prepared.result, question: "Caller-replaced question" }
    const forged = f.command({ ...prepared, result: forgedResult, receipt: { ...prepared.receipt, resultDigest: digestSfValue(forgedResult) } })
    expect(await f.consume(forged)).toEqual({ status: "unavailable", reason: "question-preparation-unavailable" })
    const wrongVersion = { ...prepared.result, expectedCaseVersion: prepared.result.expectedCaseVersion + 1 }
    expect(await f.consume(f.command({ ...prepared, result: wrongVersion, receipt: { ...prepared.receipt, resultDigest: digestSfValue(wrongVersion) } }))).toEqual({ status: "unavailable", reason: "question-preparation-unavailable" })
    const outputCase = { id: f.decision.id, incarnation: f.decision.incarnation, version: f.decision.version }
    const output: QuestionConsumption = { ...command, proposal: { kind: "contribution", outputRef: "not-a-published-output", outputDigest: "0".repeat(64), caseRef: outputCase, result: prepared.result } }
    expect(await f.consume(output)).toEqual({ status: "unavailable", reason: "question-contribution-reader-unavailable" })
    expect(await f.host.questions.readOutput("not-a-published-output", outputCase, f.read)).toEqual({ status: "unavailable", reason: "question-contribution-reader-unavailable" })
    const recomposed = f.compose()
    expect(await recomposed.questions.consume(command, await f.admit("collaboration.question.confirm", command))).toEqual({ status: "unavailable", reason: "question-preparation-unavailable" })
    expect(await f.stored()).toEqual([])
    f.advance(301_000)
    expect(await f.consume(command)).toEqual({ status: "unavailable", reason: "question-preparation-unavailable" })
    expect(await f.stored()).toEqual([])
  } finally { await f.dispose() }
})

test("question consumption requires current source access and an explicit period inside the case horizon", async () => {
  const annual = await fixture(true)
  try {
    const command = annual.command(await annual.prepare())
    expect(annual.source.target.period).toEqual(annual.period)
    expect(await annual.consume(command)).toEqual({ status: "needs-input", reason: "question-context-selection-required" })
    expect(await annual.consume({ ...command, period: annual.period })).toEqual({ status: "unavailable", reason: "question-case-or-source-changed" })
    expect(await annual.stored()).toEqual([])
  } finally { await annual.dispose() }
  const f = await fixture()
  try {
    const prepared = await f.prepare()
    const command = f.command(prepared)
    expect(f.source.target.period).toEqual(january)
    expect(await f.consume({ ...command, period: february })).toEqual({ status: "needs-input", reason: "question-context-selection-required" })
    f.gate.dashboard = false
    expect(await f.consume(command)).toEqual({ status: "unavailable", reason: "question-case-or-source-changed" })
    f.gate.dashboard = true
    const before = await f.snapshots()
    const created = available(await f.consume(command))
    expect(await f.consume({ ...command, period: { start: "2026-01-02", end: "2026-01-31" }, mutation: { expectedStorageVersion: 1, idempotencyKey: "changed-selection" } })).toEqual({ status: "needs-input", reason: "question-context-selection-required" })
    expect(await f.consume(f.command(await f.prepare("A different prepared question")))).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
    f.gate.dashboard = false
    expect(await f.consume(command)).toEqual({ status: "unavailable", reason: "question-case-or-source-changed" })
    f.gate.dashboard = true
    expect(await f.stored()).toEqual([created])
    expect(await f.snapshots()).toEqual(before)
  } finally { await f.dispose() }
})

test("question commit refuses changed case version and same-version case-content races under real SQLite", async () => {
  for (const advanceVersion of [true, false]) {
    const f = await fixture()
    try {
      const command = f.command(await f.prepare())
      if (advanceVersion) await f.changeCase(true)
      else f.arm(() => f.changeCase(false))
      expect(await f.consume(command)).toEqual(advanceVersion ? { status: "unavailable", reason: "question-case-or-source-changed" } : { status: "conflict", reason: "question-not-committed" })
      expect(await f.stored()).toEqual([])
      const current = available(await f.cases.read({ caseRef: f.caseRef }, f.read))
      expect(current.case.version).toBe(advanceVersion ? f.decision.version + 1 : f.decision.version)
      expect(current.case.objective).toBe("Case changed after preparation")
    } finally { await f.dispose() }
  }
})

test("question commit fences source changes and HTTP consumes the exact shown preparation", async () => {
  const f = await fixture()
  try {
    const command = f.command(await f.prepare())
    const before = await f.snapshots()
    f.arm(() => f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", id: "project", version: before.dashboard.versions["projects:project"]!.version, values: { status: "On Hold" } }).then(() => undefined))
    expect(await f.consume(command)).toEqual({ status: "conflict", reason: "question-not-committed" })
    expect(await f.stored()).toEqual([])
  } finally { await f.dispose() }
  const g = await fixture()
  try {
    const command = g.command(await g.prepare())
    const http = createCollaborationHttp({ origin: "https://example.test", mount: "/product", host: g.host, human: g.human, admitRead: async () => ({ status: "denied", reason: "not-selected" }), finishRead: () => {} })
    const request = new Request("https://example.test/product?sf=collaboration-question-consume", { method: "POST", headers: { origin: "https://example.test", actor: g.person.id, "content-type": "application/json" }, body: JSON.stringify(command) })
    const response = await http(request)
    expect(response?.status).toBe(200)
    expect(response?.headers.get("cache-control")).toBe("no-store")
    expect(await response?.json()).toMatchObject({ status: "ok", value: { messages: [{ body: command.proposal.result.question }], questionOrigin: { caseRef: { version: command.proposal.result.expectedCaseVersion } } } })
    const malformed = new Request("https://example.test/product?sf=collaboration-question-consume", { method: "POST", headers: { origin: "https://example.test", actor: g.person.id, "content-type": "application/json" }, body: JSON.stringify({ ...command, proposal: { kind: "prepared", result: command.proposal.result } }) })
    const refused = await http(malformed)
    expect(refused?.status).toBe(400)
    expect(await refused?.json()).toEqual({ status: "needs-input", reason: "invalid-question-consumption" })
    expect(await g.stored()).toHaveLength(1)
  } finally { await g.dispose() }
})
