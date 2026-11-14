import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { projectPlannerSource } from "../../../product/planner/port.ts"
import { roleMap } from "../../../runtime/admin.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createRenewalOperationVerifier } from "./renewal-operation-verifier.ts"
import { renewalEvidenceContext } from "./renewal-source-fixture.ts"
import type { createWp11FixtureTrace } from "./fixture-trace.ts"

/** Rebuilds reader/UI/C08 state from SQLite after the writer was disposed. Fixture
 * membership and synthetic scope declarations remain explicit host boundaries.
 */
export async function createRenewalRestartReader(directory: string, ref: Pick<DecisionCase, "id" | "incarnation">, trace: ReturnType<typeof createWp11FixtureTrace>) {
  const store = await openLocalStore(directory)
  const controls = { active: true, sequence: 0 }
  const contexts: TrustedUiContext[] = []
  const command = "sf-human:decisions.read"
  const payload = { caseRef: encodeCaseRef(ref) }
  const requests = new WeakSet<Request>()
  const authorize = async (request: Request) => {
    const principalRef = request.headers.get("x-principal")
    return controls.active && requests.has(request) && (principalRef === "collaborator" || principalRef === "outsider") ? { installationId: "install", projectId: "project", principalRef, policyVersion: "policy", accessRevision: "access" } : undefined
  }
  const ui = createSfUiAuthority({ authorize, commandIdentity: async () => "renewal-restarted-read", privateCommands: [command], createId: () => `renewal-restarted-${++controls.sequence}`, now: () => Date.parse("2026-11-13T03:00:00Z") })
  const host: DomainPortHost = {
    persistence: store,
    authenticate: async (request, input) => { const identity = await authorize(request); return identity ? resolve(identity.principalRef, [...input!.roleMap], (group) => group === "finance-group") : null },
    environment: async () => ({ at: "2026-11-13T03:00:00Z", id: () => "unused-restarted-read", directory: [] }),
    requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context) => trace.measure("restarted.revalidate", () => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false)),
  }
  const state = trace.state(createSfProductState({ persistence: store, createId: () => "unused-restarted-state", resolveTarget: async () => ({ incarnation: ref.incarnation }), authorize }))
  const admit = async (principalRef: "collaborator" | "outsider") => {
    const request = new Request("https://example.test/decisions/read", { headers: { "x-principal": principalRef } })
    requests.add(request)
    const admitted = await ui.admit(request, command, digestSfValue(payload))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, command, digestSfValue(payload))) throw new Error("Restarted UI read admission unavailable")
    contexts.push(admitted.value)
    return admitted.value
  }
  try {
    const collaborator = await admit("collaborator")
    const request = host.requestFor(collaborator)
    if (!request) throw new Error("Restarted collaborator request unavailable")
    const loaded = await state.read(request, "cases", (value) => value.cases[ref.id])
    if (loaded.status !== "ok" || !loaded.value || loaded.value.incarnation !== ref.incarnation || !loaded.value.participants.includes("collaborator")) throw new Error("Persisted collaborator membership unavailable")
    const decision = loaded.value
    const coverageRefs = (assessment: DecisionCase["alternatives"][number]["result"]["costCoverage"]) => [...assessment.evaluatedSourceRefs, ...assessment.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)]
    const persistedRefs = [...decision.sourceRefs, ...decision.costCoverageBases.flatMap((basis) => basis.sourceRefs), ...decision.alternatives.flatMap((alternative) => [...alternative.result.sourceRefs, ...coverageRefs(alternative.result.costCoverage)]), ...decision.choices.flatMap((choice) => [...choice.evidenceRefs, ...choice.result.sourceRefs, ...coverageRefs(choice.costCoverage), ...coverageRefs(choice.result.costCoverage)]), ...decision.ledger.flatMap((event) => event.evidenceRefs)]
    const known = new Map(persistedRefs.map((item) => [digestSfValue(item), item]))
    const currentSource = async (reference: BusinessEvidenceRef, context: TrustedDomainContext) => {
      if (!known.has(digestSfValue(reference)) || reference.refDigest !== digestSfEvidenceRef(reference) || reference.installationId !== context.binding.installationId || reference.projectId !== context.binding.projectId || reference.kind !== "record" || !await host.revalidate(context)) return false
      // These declarations were fixture inputs persisted with the classification;
      // this reader does not promote them to externally observed human evidence.
      if (reference.target.recordType === "synthetic-scope") return true
      if (reference.target.surface !== "planner" || reference.target.recordType !== "planner-version") return false
      const sourceRequest = host.requestFor(context)
      if (!sourceRequest) return false
      return store.transaction("planner", async (snapshot) => {
        const principal = await host.authenticate(sourceRequest, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== context.binding.principalRef) return { commit: false, value: false }
        const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
        const projection = projectPlannerSource(snapshot, { id: principal.id, roles, canWrite: principal.canWrite, assigned: [], domains: [] }, reference.target.recordId)
        return { commit: false, value: !!projection && digestSfValue({ versionId: reference.target.recordId, projection }) === reference.target.projectionDigest }
      })
    }
    const evidence: BusinessContextService = { resolve: async (reference, context) => ({ state: await currentSource(reference, context) ? "fresh" : "revoked", ref: reference, accessRevision: context.binding.accessRevision, checkedAt: "2026-11-13T03:00:00Z" }), context: renewalEvidenceContext((reference, context) => evidence.resolve(reference, context)), recall: async () => [], emitFromLedger: async () => { throw new Error("No memory publication in restarted reader") } }
    const sources: PlannerSourceHost = {
      resolveForecastSource: async (reference, context) => {
        const candidates = [...known.values()].filter((item): item is Extract<BusinessEvidenceRef, { kind: "record" }> => item.kind === "record" && item.refId === reference && item.target.recordType === "planner-version")
        return candidates.length === 1 && await currentSource(candidates[0]!, context) ? { status: "ok", value: { versionId: candidates[0]!.target.recordId, evidence: candidates[0]! } } : { status: "unavailable", reason: "restarted-source-unavailable" }
      },
      resolveForecastCoverage: async () => ({ status: "unavailable", reason: "coverage-not-needed-for-read-admission" }),
    }
    const verifyOperations = createRenewalOperationVerifier(host, sources, trace)
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: ref.id, incarnation: ref.incarnation }, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeCase: async (value, context) => value.id === ref.id && value.incarnation === ref.incarnation && value.participants.includes(context.binding.principalRef) && await host.revalidate(context), verifyScenarioOperations: async (value, context) => (await Promise.all(value.alternatives.map((alternative) => verifyOperations(alternative.scenario, context)))).every(Boolean), evidence, createId: () => "unused-restarted-case", now: () => "2026-11-13T03:00:00Z" })
    return {
      read: async (principalRef: "collaborator" | "outsider" = "collaborator") => cases.read(payload, principalRef === "collaborator" ? collaborator : await admit(principalRef)),
      revoke: () => { controls.active = false },
      checkpoint: (phase: string) => trace.checkpoint(phase, state, request),
      close: async () => { for (const context of contexts) ui.finish(context); await store.dispose() },
    }
  } catch (error) { for (const context of contexts) ui.finish(context); await store.dispose(); throw error }
}
