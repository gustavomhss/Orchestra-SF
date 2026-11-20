import { object } from "../../../../runtime/contract.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfSignalSelection } from "../../../../product/decision-memory/signal-registry.ts"
import { SF_SIGNAL_REGISTRY_PREFIX } from "../../../../product/decision-memory/signal-registry.ts"
import { encodeCaseRef } from "../../../../product/decisions/case-port.ts"
import { createSfMemoryServices } from "../../../../../../../apps/cli/src/sucafina-product/memory-services.ts"
import { createSfMemoryHttp } from "../../../../../../../apps/cli/src/sucafina-product/memory-http.ts"
import { plannerObservationFixture } from "./planner-observation-batch-fixture.ts"
import type { compositionTestDeadline } from "./composition-test-deadline.ts"

function ok<Value>(result: PortResult<Value>, label: string): Value {
  if (result.status !== "ok") throw new Error(label + ": " + JSON.stringify(result))
  return result.value
}

export async function memoryMaterialityFixture(deadline: ReturnType<typeof compositionTestDeadline>) {
  const fixture = await plannerObservationFixture(deadline, false, {
    sourceOnly: true, humanActions: ["decisions.condition.record"],
  })
  const choiceInput = { caseRef: fixture.caseRef, alternativeId: "candidate", alternativeVersion: 1,
    comparison: { scenarioRefs: [fixture.request.baselineRef, fixture.request.scenarioRef], criteria: ["cost"] },
    criteria: ["cost"], reason: "Preserve the actual compared alternatives for a memory condition." }
  const admitted = ok(await fixture.authority.human.admit(fixture.stateRequest(), "decisions.choose", choiceInput), "Human choice")
  const chosen = ok(await fixture.business.withCase(admitted, fixture.caseRef, {}, () =>
    fixture.portfolio.mutations.recordChoice(choiceInput, admitted)).finally(() => fixture.authority.human.finish(admitted)), "Recorded choice")
  const current = ok(await fixture.business.cases.read({ caseRef: encodeCaseRef(chosen.caseRef) }, fixture.call), "Current chosen case")
  const choice = current.case.choices.find((entry) => entry.alternativeId === "candidate")
  const candidate = current.case.alternatives.find((entry) => entry.id === "candidate")
  if (!choice || !candidate) throw new Error("The actual choice and candidate are required")
  // Re-persist the same current alternative through C09. The selected siblings
  // now have different producer versions; each version keeps both case phases.
  const newer = ok(await fixture.business.withCase(fixture.call, chosen.caseRef, {}, () => fixture.business.results.write({
    kind: "scenario", caseRef: chosen.caseRef, result: candidate.result, requestDigest: digestSfValue(candidate.scenario),
    sourceRefs: candidate.result.sourceRefs, idempotencyKey: "memory-current-alternative",
  }, fixture.call)), "Current-version stored alternative")
  const evidence = fixture.sources[1]!
  if (evidence.kind !== "record") throw new Error("The real Planner source must be a record")
  const source = candidate.result.components.flatMap((component) => component.sourceRefs).find((ref) =>
    ref.surface === evidence.target.surface && ref.type === evidence.target.recordType && ref.id === evidence.target.recordId &&
    ref.incarnation === evidence.target.incarnation && ref.version === evidence.target.version)
  if (!source) throw new Error("The original Planner component must identify the selected source")
  const signal: SfSignalSelection = { caseRef: chosen.caseRef, choiceId: choice.id,
    scenarioRefs: [fixture.request.baselineRef, newer.resultRef], source, evidence,
    fields: source.fields.filter((field) => evidence.target.fields.includes(field)), period: fixture.period,
    criterionId: "cost", recipientRef: fixture.call.binding.principalRef, destination: "/sucafina/planner",
    label: "Observe the preserved Planner commitment" }
  if (!signal.fields.length) throw new Error("The selected source has no shared fields")
  const memory = createSfMemoryServices({ authority: fixture.authority, business: fixture.business,
    signalRegistryWrites: fixture.guards.signalRegistryWrites })
  const http = createSfMemoryHttp({ origin: "https://example.test", mount: "/sucafina", authority: fixture.authority,
    memory, withCase: fixture.business.withCase,
    similarCases: async () => ({ status: "unavailable", reason: "similarity-not-used-by-condition" }),
  })
  const register = async () => {
    const response = await http(new Request("https://example.test/sucafina/dashboard?sf=memory-condition", {
      method: "POST", signal: deadline.signal, headers: { origin: "https://example.test", "content-type": "application/json",
        "x-operation": "memory-batch-register" }, body: JSON.stringify(signal),
    }), "dashboard")
    if (!response) throw new Error("The real memory-condition route did not handle the request")
    return { status: response.status, body: await response.json() }
  }
  const capture = async () => ({
    state: await fixture.authority.state.read(fixture.stateRequest(), "cases", (state, actor) => ({ state, actor })),
    snapshots: await fixture.store.transactionAll(async (value) => ({ commit: false, value: structuredClone(value) })),
  })
  const registered = await deadline.phase("memory.register-condition", register)
  if (registered.status !== 200 || object(registered.body).status !== "ok")
    throw new Error("The real condition was not registered: " + JSON.stringify(registered))
  const saved = await capture()
  if (saved.state.status !== "ok") throw new Error("The protected condition envelope is unavailable")
  const matches = Object.entries(saved.state.value.state.preferences).filter(([key, value]) =>
    key.startsWith(SF_SIGNAL_REGISTRY_PREFIX) && digestSfValue(object(value).selection) === digestSfValue(signal))
  if (matches.length !== 1) throw new Error("The registered condition is not uniquely discoverable")
  const conditionId = matches[0]![0].slice(SF_SIGNAL_REGISTRY_PREFIX.length)
  const readMateriality = async () => {
    const query = new URLSearchParams({ sf: "memory-materiality", caseId: signal.caseRef.id,
      incarnation: signal.caseRef.incarnation, version: String(signal.caseRef.version), conditionId })
    const response = await http(new Request("https://example.test/sucafina/dashboard?" + query, {
      signal: deadline.signal, headers: { origin: "https://example.test" },
    }), "dashboard")
    if (!response) throw new Error("The real memory-materiality route did not handle the request")
    return { status: response.status, body: object(await response.json()) }
  }
  return { ...fixture, signal, choice, candidate, current, conditionId, readMateriality, capture }
}
