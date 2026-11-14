import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import { RENEWAL_TRANSITION_CATEGORIES } from "../../../product/contracts/decisions.ts"
import type { CostCoverageAssessment, CostCoverageBasis, DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createDecisionCaseManagement } from "../../../product/decisions/case-management.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import type { SfHumanAction } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerOperationVerifier } from "../../../product/planner/operation-verifier.ts"
import { createPlannerPort, projectPlannerSource } from "../../../product/planner/port.ts"
import { createPlannerScenarioInputs } from "../../../product/planner/scenario-inputs.ts"
import { rows } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/dashboard-portfolio.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"

const horizon = { start: "2027-01-01", end: "2027-12-31" }
const at = "2026-11-14T00:00:00Z"
const origin = "https://example.test"
const actor = { id: "owner", roles: ["admin", "finance"], canWrite: true, assigned: [], domains: [] }
const plannerActor = { ...actor, roles: ["finance"] }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>

/** Real domain commands, C08, and human UI admission. Source issuance is a current-digest
 * fixture boundary; this does not claim an installed C02 issuer or native session. */
export async function createAssumptionFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-assumption-divergence-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  let sequence = 0
  const createId = () => `assumption-${++sequence}`
  const access = { allowed: true }
  const identity = { installationId: "install", projectId: "project", principalRef: "owner", policyVersion: "policy", accessRevision: "access" }
  const request = (command: string) => new Request(`${origin}/decisions`, { method: "POST", headers: { origin, "x-owner": "owner", "x-command": command } })
  const authorize = async (source: Request) => access.allowed && source.headers.get("x-owner") === "owner" ? identity : undefined
  const ui = createSfUiAuthority({ authorize, commandIdentity: async (source) => source.headers.get("x-command") ?? undefined, createId, now: () => Date.parse(at), privateCommands: ["sf-human:decisions.edit", "sf-human:decisions.promote-alternative", "sf-human:decisions.portfolio.read"] })
  const human = createSfHumanAuthority({ origin, ui })
  const contexts: TrustedDomainContext[] = []
  const admit = async (command: string, action: SfHumanAction, payload: unknown) => {
    const admitted = await human.admit(request(command), action, payload)
    if (admitted.status !== "ok") throw new Error(`Human admission unavailable: ${admitted.reason}`)
    contexts.push(admitted.value)
    return admitted.value
  }
  const environment = { at, id: () => "official-project", directory: [] }
  try {
    await store.transaction("planner", async (snapshot) => {
      const amounts = Array.from({ length: 12 }, (_, month) => month === 4 ? 45000 : 0)
      snapshot.data = { roleMap: [{ surface: "planner", role: "finance", entra: "finance-group", version: 1, by: "admin" }], versions: [{ id: "may-plan", year: 2027, closed: 0, lines: [{ id: "implementation", sec: "opex", el: "licenses", cur: "USD", b: amounts, f: amounts, a: Array(12).fill(null) }], fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }] }
      return { commit: true, value: true }
    })
    await store.transaction("dashboard", async (snapshot) => {
      const created = domain.execute(snapshot, actor, { page: "All Projects", action: "save", version: 0, values: { name: "Official implementation project", start: "2027-01-01", end: "2027-05-31", pm: "owner" } }, environment)
      if (!created.ok) throw new Error(`Official project creation failed: ${JSON.stringify(created)}`)
      return { commit: true, value: true }
    })
    const projectObservation = async () => store.transaction("dashboard", async (snapshot) => {
      const row = rows(domain.view(snapshot, actor, environment).data.projects).find((entry) => entry.id === "official-project")
      if (!row || typeof row.end !== "string") throw new Error("Official project unavailable")
      const ref: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: "official-project-date", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "projects", recordId: "official-project", incarnation: "project-incarnation", version: snapshot.versions["projects:official-project"]!.version, fields: ["end"], period: horizon, projectionDigest: digestSfValue({ end: row.end }) } }
      return { commit: false, value: { value: row.end, evidence: { ...ref, refDigest: digestSfEvidenceRef(ref) } } }
    })
    const official = await projectObservation()
    const plannerRef = await store.transaction("planner", async (snapshot) => {
      const projection = projectPlannerSource(snapshot, plannerActor, "may-plan")
      if (!projection) throw new Error("Planner source unavailable")
      const ref: RecordEvidence = { schema: "sf-evidence-v1", kind: "record", refId: "may-plan", installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: "may-plan", incarnation: "plan-incarnation", version: 1, fields: Object.keys(projection), period: horizon, projectionDigest: digestSfValue({ versionId: "may-plan", projection }) } }
      return { commit: false, value: { ...ref, refDigest: digestSfEvidenceRef(ref) } }
    })
    const refs = [plannerRef, official.evidence]
    const host: DomainPortHost = { persistence: store,
      authenticate: async (_source, input) => resolve("owner", [...input!.roleMap], (group) => group === "finance-group"), environment: async () => environment,
      requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }
    const evidence: BusinessContextService = {
      resolve: async (ref, context) => {
        const known = refs.some((item) => digestSfValue(item) === digestSfValue(ref))
        const current = ref.kind === "record" && ref.target.surface === "dashboard" ? (await projectObservation()).evidence.refDigest === ref.refDigest : true
        return { ref, state: known && current && await host.revalidate(context) ? "fresh" : "revoked", accessRevision: "access", checkedAt: at }
      },
      context: async ({ refs: requested }, context) => Promise.all(requested.map((ref) => evidence.resolve(ref, context))),
      recall: async () => [], emitFromLedger: async () => { throw new Error("Unexpected memory write") },
    }
    const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
    const state = createSfProductState({ persistence: store, createId, authorize, resolveTarget: async () => ({ incarnation: caseRef.incarnation }) })
    const basis: CostCoverageBasis = { id: "date-basis", version: 1, decisionType: "renewal-transition-v1", categoryIds: [...RENEWAL_TRANSITION_CATEGORIES], additionalCategoryIds: [], sourceRefs: refs }
    const assessment: CostCoverageAssessment = { basisId: basis.id, basisVersion: 1, alternativeId: "source", alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: refs, coverageState: "pending", entries: basis.categoryIds.map((categoryId) => ({ status: "pending", categoryId, reason: "missing-category" })), derivedMissingCategoryIds: [...basis.categoryIds] }
    const sources: PlannerSourceHost = { resolveForecastSource: async (reference) => reference === plannerRef.refId ? { status: "ok", value: { versionId: "may-plan", evidence: plannerRef } } : { status: "unavailable", reason: "unknown-source" }, resolveForecastCoverage: async (reference) => ({ status: "ok", value: { coverageRef: reference, basis, assessment } }) }
    const initial: DecisionCase = { ...caseRef, state: "draft", objective: "Assess the owner's declared March date against the official May date", horizon, currency: "USD", criteria: [{ id: "date", description: "Preserve the distinction between declaration and official schedule", required: true }], participants: ["owner"], sourceRefs: refs, alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request("seed"), { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed", commandDigest: digestSfValue(initial), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (staged) => { staged.cases[caseRef.id] = initial; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Case initialization unavailable")
    const operationIdentity = (context: TrustedDomainContext) => context.kind === "ui" ? ui.operationIdentity(context) : undefined
    const authorizeCase = async (decision: DecisionCase, context: TrustedDomainContext) => decision.id === caseRef.id && decision.incarnation === caseRef.incarnation && decision.participants.includes(context.binding.principalRef) && await host.revalidate(context)
    const management = createDecisionCaseManagement({ state, host, operationIdentity, authorizeCase,
      authorizeEdit: (edit, context) => human.authorize(context, "decisions.edit", edit),
      verifyEvidence: async (requested, context) => (await evidence.context({ refs: requested }, context)).every((item) => item.state === "fresh"),
      verifyEdit: (_snapshot, before, after, context) => context.kind === "ui" && ui.matchesIntent(context, "sf-human:decisions.edit", digestSfValue({ caseRef: { id: before.id, incarnation: before.incarnation, version: before.version }, objective: after.objective, criteria: after.criteria, sourceRefs: after.sourceRefs, assumptions: after.assumptions })) })
    const confirmation: { digest?: string } = {}
    const readCase = () => state.read(request("read-case"), "cases", (staged) => staged.cases[caseRef.id])
    const scenarioInputs = createPlannerScenarioInputs({ planner: createPlannerPort({ host, sources }), sources, verifyAssumption: async (assumption, context) => {
      const source = host.requestFor(context)
      if (!source || !await host.revalidate(context)) return { status: "denied", reason: "confirmation-access-unavailable" }
      const saved = await state.read(source, "cases", (staged) => ({ decision: staged.cases[caseRef.id], receipt: staged.transactions[JSON.stringify(["owner", "cases", caseRef.id, "confirm-march:edit"])] }))
      const current = saved.status === "ok" ? saved.value : undefined
      const declared = current?.decision?.assumptions.find((item) => item.id === assumption.id)
      return confirmation.digest && current?.receipt?.commandDigest === confirmation.digest && current.receipt.principalRef === context.binding.principalRef && declared?.state === "confirmed" && declared.text === assumption.value && digestSfValue(declared.evidenceRefs) === digestSfValue(assumption.evidenceRefs)
        ? { status: "ok", value: { fingerprint: digestSfValue({ receipt: current.receipt.commandDigest, assumption: declared }) } }
        : { status: "denied", reason: "human-assumption-confirmation-required" }
    } })
    const planner = createPlannerPort({ host, sources, scenarioInputs, evidence })
    const verifyOperations = createPlannerOperationVerifier({ host, planner, sources, scenarioInputs })
    const cases = createDecisionCasePort({ state, host, operationIdentity, authorizeCase, creationTarget: { ref: "create-case", incarnation: "create-incarnation" }, evidence, verifyScenarioOperations: async (decision, context) => (await Promise.all(decision.alternatives.map((alternative) => verifyOperations(alternative.scenario, context)))).every(Boolean), createId, now: () => at })
    const unavailable = async () => ({ status: "unavailable" as const, reason: "not-requested" })
    const mutations = createDecisionMutations({ state, host, planner, sources, operationIdentity, authorizeCase,
      authorizeMutation: async (operation, payload, context) => operation === "add-alternative" && await human.authorize(context, "decisions.promote-alternative", payload),
      verifyMutation: (_snapshot, operation, payload, context) => operation === "add-alternative" && context.kind === "ui" && ui.matchesIntent(context, "sf-human:decisions.promote-alternative", digestSfValue(payload)),
      coverageEvidence: { entries: async (_scenario, coverage) => ({ status: "ok", value: coverage.entries }), resolve: (requested, context) => evidence.context({ refs: requested }, context), supports: () => false,
        verifySnapshot: (snapshot) => digestSfValue({ versionId: "may-plan", projection: projectPlannerSource(snapshot, plannerActor, "may-plan") }) === plannerRef.target.projectionDigest },
      confirmChoice: async () => false, confirmAnswer: async () => false, resolveAnswer: unavailable, resolveQuestion: unavailable, resolveChoiceValues: unavailable, prepareDomainCommands: unavailable, createId, now: () => at })
    const scenario: ScenarioRequest = { baseRef: plannerRef.refId, operations: [{ kind: "defer", targetRef: "implementation:5", period: { start: "2027-03-01", end: "2027-03-31" } }], assumptions: [{ id: "project-end", value: "2027-03-31", state: "confirmed", evidenceRefs: [official.evidence] }] }
    const cleanup = async () => { for (const context of contexts) if (context.kind === "ui") ui.finish(context); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
    return { store, state, cases, management, mutations, planner, host, ui, human, admit, request, caseRef, initial, scenario, plannerRef, official, projectObservation, readCase, confirmation, access, actor, environment, cleanup }
  } catch (error) { await store.dispose(); await rm(directory, { recursive: true, force: true }); throw error }
}
