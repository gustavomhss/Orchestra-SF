import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { rows } from "../../../runtime/contract.ts"
import { resolve } from "../../../src/identity.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { RoutineResult } from "../../../product/contracts/context.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfDashboardRecordSourceAccess } from "../../../product/decision-memory/source-access.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { answerDecisionRoutine, readDecisionRoutine } from "../../../product/routines/decision.ts"
import type { DecisionRoutineHost } from "../../../product/routines/decision.ts"
import { createRoutineResultAccess, routineArtifactDigest, routineInputDigest } from "../../../product/routines/result-access.ts"
import type { RoutineAdmittedInput, RoutineExecutionSnapshot } from "../../../product/routines/result-access.ts"

function available<T>(result: PortResult<T>) {
  if (result.status !== "ok") throw new Error(`${result.status}: ${result.reason}`)
  return result.value
}

test("routine answer uses the real versioned case command and a replay cannot create a second answer or execute a run", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-routine-answer-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  try {
    const gate = { active: true, starts: 0, preparations: 0 }
    const at = "2026-11-13T00:00:00Z"
    const caseRef = { id: "case", incarnation: "case-inc", version: 1 }
    const decision: DecisionCase = { ...caseRef, state: "investigating", objective: "Review the quote", horizon: { start: "2026-01-01", end: "2026-12-31" }, currency: "USD", criteria: [{ id: "cost", description: "Quoted cost", required: true }], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [{ id: "question", text: "Confirm the quoted cost", state: "open" }], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const operation = "sf-human:decision-answer"
    const identity = (request: Request) => gate.active && request.headers.get("actor") === "person" ? { installationId: "installation", projectId: "project", principalRef: "person", policyVersion: "policy", accessRevision: "access" } : undefined
    const ui = createSfUiAuthority({ authorize: async (request) => identity(request), commandIdentity: async (_request, _operation, digest) => digest, createId: randomUUID, now: () => Date.parse(at), privateCommands: [operation] })
    const request = new Request("https://example.test/answer", { method: "POST", headers: { origin: "https://example.test", actor: "person" } })
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "domain leader", entra: "leaders", version: 1, by: "fixture" }]
      snapshot.data.hotTopics = [{ id: "quote-evidence", action: "Quoted cost", owner: "Selected Person", due: "2026-12-01", status: "open", priority: "normal", notes: "The quoted cost is 42 USD" }]
      return { commit: true, value: undefined }
    })
    const host: DomainPortHost = {
      persistence,
      authenticate: async (request, options) => identity(request) ? resolve("person", [...options!.roleMap], (group) => group === "leaders") : null,
      environment: async () => ({ at, id: randomUUID, directory: [{ id: "person", name: "Selected Person" }] }),
      requestFor: (value) => value.kind === "ui" ? ui.requestFor(value) : undefined,
      revalidate: async (value) => value.kind === "ui" && await ui.revalidate(value),
    }
    const readDigest = digestSfValue({ runRef: "run" })
    const read = available(await ui.admit(request, "sf_routine_status", readDigest))
    if (!await ui.validate(read, "sf_routine_status", readDigest)) throw new Error("Source read admission unavailable")
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const answer = available(await records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "quote-evidence", fields: ["notes"], period: { start: at.slice(0, 10), end: at.slice(0, 10) } }, read))
    const mutation = { caseRef, questionId: "question", answerRef: answer.refId }
    const context = available(await ui.admit(request, operation, digestSfValue(mutation)))
    if (!await ui.validate(context, operation, digestSfValue(mutation))) throw new Error("Answer admission unavailable")
    const state = createSfProductState({ persistence, createId: randomUUID, authorize: async (request) => identity(request), resolveTarget: async (_request, _snapshot, _namespace, target) => target === caseRef.id ? { incarnation: caseRef.incarnation } : undefined })
    const initial = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "initial", commandDigest: digestSfValue(decision) }, async (current) => { current.cases[caseRef.id] = decision; return { commit: true, value: null } })
    expect(initial.status).toBe("ok")
    const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: createSfDashboardRecordSourceAccess({ host, records }), proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
    const operationIdentity = (binding: TrustedDomainContext) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined
    const authorizeCase = async (value: DecisionCase, binding: TrustedDomainContext) => gate.active && value.participants.includes(binding.binding.principalRef)
    const cases = createDecisionCasePort({ state, host, evidence, creationTarget: { ref: caseRef.id, incarnation: caseRef.incarnation }, operationIdentity, authorizeCase, createId: randomUUID, now: () => at })
    const unused = async () => ({ status: "unavailable" as const, reason: "not-selected" })
    const mutations = createDecisionMutations({ state, host, operationIdentity, authorizeCase,
      planner: { compareForecast: unused, simulateScenario: unused, compareScenarios: unused, evaluateSensitivity: unused }, sources: { resolveForecastSource: unused, resolveForecastCoverage: unused },
      authorizeMutation: async (name, payload, binding) => name === "answer-question" && binding.kind === "ui" && ui.matchesIntent(binding, operation, digestSfValue(payload)) && await ui.revalidate(binding),
      verifyMutation: (_snapshot, name, payload, binding) => gate.active && name === "answer-question" && binding.kind === "ui" && ui.matchesIntent(binding, operation, digestSfValue(payload)),
      confirmAnswer: async (ref, questionId, answerRef, binding) => binding.kind === "ui" && ui.matchesIntent(binding, operation, digestSfValue({ caseRef: ref, questionId, answerRef })),
      resolveAnswer: (ref, binding) => records.resolve(ref, binding),
      confirmChoice: async () => false, resolveQuestion: unused, resolveChoiceValues: unused, prepareDomainCommands: unused, createId: randomUUID, now: () => at,
    })
    // This native metadata fixture tests the case consumer; it does not qualify a Relay run.
    const run: RoutineResult = { documentId: "decision-recipe", publishedVersion: "published-v1", principalRef: "person", projectId: "project", admission: "admitted", admissionRef: "admission", admissionVersion: 1, runRef: "run", resultRef: "result", correlationId: "decision-version-1", sourceRefs: [], pending: ["question"] }
    const binding = { admissionRef: "admission", admissionVersion: 1, documentId: run.documentId, publishedVersion: run.publishedVersion, caseRef, runRef: "run" }
    const routineHost: DecisionRoutineHost = { cases, binding: async () => ({ status: "ok", value: binding }), revalidate: (_binding, context) => host.revalidate(context),
      routines: { catalog: unused, prepareAdmission: async () => { gate.preparations++; return unused() }, readAdmission: async () => ({ status: "ok", value: run }), readRun: async () => ({ status: "ok", value: run }), run: async () => { gate.starts++; return { status: "ok", value: run } } },
    }
    const admittedInput: RoutineAdmittedInput = { publishedRecipeRef: run.documentId, publishedVersion: run.publishedVersion, planRevisionId: "plan-v1", writeScope: ["cases"], inputRefs: [encodeCaseRef(caseRef)], parameters: { objective: decision.objective, horizon: decision.horizon, currency: decision.currency }, principalRef: run.principalRef, projectId: run.projectId, caseRef: { ...caseRef } }
    const inputDigest = routineInputDigest(admittedInput)
    const body = { schema: "sf-routine-artifact-v1" as const, runRef: "run", resultRef: "result", correlationId: run.correlationId, documentId: run.documentId, publishedVersion: run.publishedVersion, principalRef: run.principalRef, projectId: run.projectId, inputDigest, sourceRefs: [], content: { questions: ["question"] }, createdAt: at }
    const artifact = { ...body, outputDigest: routineArtifactDigest(body) }
    const execution: RoutineExecutionSnapshot = { runRef: "run", resultRef: "result", state: "completed", revision: "completion:1", outputDigest: artifact.outputDigest }
    routineHost.resultAccess = createRoutineResultAccess({ routines: routineHost.routines, authorize: host.revalidate, revalidateArtifact: async (_artifact, context) => host.revalidate(context),
      expectedInputDigest: async () => ({ status: "ok", value: inputDigest }),
      readExecution: async () => ({ status: "ok", value: structuredClone(execution) }),
      readArtifact: async () => ({ status: "ok", value: structuredClone(artifact) }),
    })
    const input = { request: { ...mutation, admissionRef: "admission", runRef: "run" }, context, host: routineHost, decisions: mutations }
    const first = available(await answerDecisionRoutine(input))
    expect(first).toEqual({ caseRef: { ...caseRef, version: 2 }, previousRunRef: "run", requiresNewAdmission: true })
    expect(available(await answerDecisionRoutine(input))).toEqual(first)
    const current = available(await cases.read({ caseRef: encodeCaseRef(caseRef) }, context)).case
    expect(current.version).toBe(2)
    expect(current.questions).toEqual([{ id: "question", text: "Confirm the quoted cost", state: "answered", answerRef: answer.refId }])
    expect(current.sourceRefs).toEqual([answer])
    expect(current.alternatives).toEqual([])
    expect(current.choices).toEqual([])
    expect(gate.starts).toBe(0)
    expect(gate.preparations).toBe(0)
    expect((await readDecisionRoutine({ admissionRef: "admission", runRef: "run", caseRef, context, host: routineHost })).status).toBe("stale")
    await persistence.transaction("dashboard", async (snapshot) => { rows(snapshot.data.hotTopics)[0]!.notes = "A new quote supersedes this evidence"; return { commit: true, value: undefined } })
    expect(await cases.read({ caseRef: encodeCaseRef(caseRef) }, context)).toEqual({ status: "unavailable", reason: "case-evidence-unavailable" })
    expect((await answerDecisionRoutine(input)).status).toBe("unavailable")
    gate.active = false
    expect((await answerDecisionRoutine(input)).status).toBe("denied")
  } finally { await store.dispose(); await rm(directory, { recursive: true, force: true }) }
})
