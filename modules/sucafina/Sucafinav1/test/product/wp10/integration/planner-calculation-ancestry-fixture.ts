import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfPlannerCalculationAncestryScope } from "../../../../../../../apps/cli/src/sucafina-product/planner-calculation-ancestry-scope.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { CaseLedgerEvent } from "../../../../product/contracts/decisions.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfProductState } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import type { SfCalculationCaseScope } from "../../../../product/host-binding/atlas-recall-scope.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { domain } from "../../../../runtime/planner.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import { plannerSourceActor } from "../../../../product/planner/port.ts"

/** Actual SQLite, UI admission, Planner, BCS and persisted leaf request/result.
 * The only explicit fixtures are pending coverage and an accepted ledger event. */
export async function ancestryProofFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-ancestry-proof-"))
  const abort = new AbortController()
  const control = { active: true, canWrite: true, at: "2027-02-02T00:00:00Z" }
  const period = { start: "2027-01-01", end: "2027-12-31" }
  const caseRef = { id: "ancestry-case", incarnation: "ancestry-inc", version: 1 }
  const counts = { results: 0, sources: 0, coverage: 0, resolutions: 0, scopes: 0, revalidations: 0 }
  const hooks: { revalidate?: (allowed: boolean, call: Parameters<typeof authority.host.revalidate>[0]) => void;
    source?: (result: Awaited<ReturnType<typeof business.plannerSources.resolveForecastSource>>) => void } = {}
  const store = await openLocalStore(path.join(directory, "store"))
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
    projectScope: createSfSourceScopeProjector(() => control.at) }) }
  const writes = new WeakSet<object>()
  const identity = { installationId: "ancestry-installation", hostId: "host", projectId: "project", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
  const request = () => new Request("https://example.test/planner", { method: "POST", signal: abort.signal, headers: { origin: "https://example.test" } })
  const authority = createSfProductAuthority({ identity: () => identity, installationId: identity.installationId, origin: "https://example.test", policyVersion: "ancestry-policy",
    persistence, proposalCoverageWrites: writes, grants: [{ principalRef: "person", namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
      operations: ["sf_scenario_simulate", "sf_evidence_get"], humanActions: [] }],
    authenticate: async (_request, scope) => control.active && scope ? { id: "person", canWrite: control.canWrite,
      roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] } : null,
    environment: async () => ({ at: control.at, id: randomUUID, directory: [] }), createId: randomUUID, now: Date.now,
    commandIdentity: async () => randomUUID(), inspectSession: async () => undefined, verifySelection: async () => false,
    verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined })
  const revalidate = authority.host.revalidate
  authority.host.revalidate = async (call) => {
    counts.revalidations++
    const allowed = await revalidate(call)
    hooks.revalidate?.(allowed, call)
    return allowed
  }
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: writes })
  const cleanup = async () => { abort.abort(); await business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) }
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    await persistence.transaction("planner", async (snapshot) => {
      snapshot.data = { versions: [{ id: "v0", name: "Ancestry proof fixture", year: 2027, closed: 1,
        lines: [{ id: "line", name: "Service", ownerId: "owner", sec: "opex", el: "licenses", cur: "USD",
          b: Array(12).fill(120), a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(120)] }],
        fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }], officials: { "2027": "v0" }, entities: [], allocations: [], roster: [] }
      return { commit: true, value: undefined }
    })
    const originalResult = business.results.readForCalculation
    business.results.readForCalculation = (...args) => { counts.results++; return originalResult(...args) }
    const originalSource = business.plannerSources.resolveForecastSource
    business.plannerSources.resolveForecastSource = async (...args) => {
      counts.sources++
      const result = await originalSource(...args)
      hooks.source?.(result)
      return result
    }
    business.bindForecastCoverage(async (reference, call) => {
      counts.coverage++
      const source = await business.plannerSources.resolveForecastSource(reference, call)
      if (source.status !== "ok") return source
      return { status: "ok", value: { coverageRef: "fixture:pending-coverage", basis: { id: "fixture-basis", version: 1,
        decisionType: "renewal-transition-v1", categoryIds: ["training"], additionalCategoryIds: [], sourceRefs: [source.value.evidence] },
        assessment: { basisId: "fixture-basis", basisVersion: 1, alternativeId: "baseline", alternativeVersion: 1, currency: "USD", horizon: period,
          issues: ["fixture-training-unresolved"], evaluatedSourceRefs: [source.value.evidence], coverageState: "pending",
          entries: [{ status: "pending", categoryId: "training", reason: "Fixture has no training evidence" }], derivedMissingCategoryIds: ["training"] } } }
    })
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture", manifestVersion: "fixture", skillVersion: "fixture" })
    const ui = async <Value>(operation: string, work: (call: TrustedUiContext) => Promise<Value>) => {
      const digest = digestSfValue({}), admitted = await authority.ui.admit(request(), operation, digest)
      if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digest)) throw new Error("Actual UI admission unavailable")
      try { return await work(admitted.value) } finally { authority.ui.finish(admitted.value) }
    }
    const seeded = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: 0,
      targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation, idempotencyKey: "proof-case", commandDigest: digestSfValue(caseRef) }, async (state) => {
      state.cases[caseRef.id] = { ...caseRef, state: "investigating", objective: "Ancestry proof fixture", horizon: period,
        currency: "USD", criteria: [], participants: ["person"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
      return { commit: true, value: true }
    })
    if (seeded.status !== "ok") throw new Error("Actual C08 case seed unavailable")
    const produced = await ui("sf_scenario_simulate", (call) => business.withCase(call, caseRef, {}, async () => {
      const source = await business.plannerProduct.issueSource("v0", call)
      if (source.status !== "ok") return source
      const input = { baseRef: source.value.evidence.refId, operations: [], assumptions: [] }
      const preview = await business.planner.simulateScenario(input, call)
      if (preview.status !== "ok") return preview
      const saved = await business.calculations.persist({ kind: "scenario", request: input, result: preview.value }, "leaf", call)
      if (saved.status !== "ok") return saved
      const issued = await business.calculations.issue(saved.value.resultRef, call)
      return issued.status === "ok" ? { status: "ok" as const, value: { reference: issued.value, request: input, result: preview.value } } : issued
    }))
    if (produced.status !== "ok") throw new Error("Actual leaf calculation unavailable: " + JSON.stringify(produced))
    const leaf = produced.value.reference
    const event: CaseLedgerEvent = { id: "prior-analysis", caseRef, kind: "analysis-accepted", principalRef: "person", at: control.at,
      consideredActions: ["retain-original"], factualGaps: ["fixture-training-unresolved"], lifecycleState: "investigating",
      rationale: "Cite an earlier actual calculation", evidenceRefs: [leaf], outputDigest: digestSfValue(produced.value.result) }
    const rawEvent: Extract<BusinessEvidenceRef, { kind: "case-event" }> = { schema: "sf-evidence-v1", kind: "case-event", refId: "fixture:prior-analysis",
      installationId: leaf.installationId, projectId: leaf.projectId, evidenceLevel: "decision", refDigest: "",
      target: { caseId: caseRef.id, caseIncarnation: caseRef.incarnation, caseVersion: caseRef.version, eventId: event.id,
        outputDigest: event.outputDigest, evidenceRefs: [leaf] } }
    const eventRef = { ...rawEvent, refDigest: digestSfEvidenceRef(rawEvent) }
    const current = await authority.state.read(request(), "cases", (value) => value)
    if (current.status !== "ok") throw new Error("Actual C08 version unavailable")
    const appended = await authority.state.transaction(request(), { namespace: "cases", expectedStorageVersion: current.storageVersion,
      targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "proof-ledger", commandDigest: digestSfValue(event) }, async (state) => {
      state.cases[caseRef.id]!.ledger = [event]
      return { commit: true, value: true }
    })
    if (appended.status !== "ok") throw new Error("Actual C08 ledger fixture unavailable")
    // This fixture cannot install a private selector. It requires the real
    // business.withCase owner below and reads that producer's selection twice.
    const selectedScope: SfCalculationCaseScope = async (call, selected, work, egress) => {
      counts.scopes++
      const before = await business.selectedCase(call)
      if (before.status !== "ok" || digestSfValue(before.value) !== digestSfValue(selected)) return { status: "denied", reason: "actual-case-not-selected" }
      const value = await work(), after = await business.selectedCase(call)
      if (after.status !== "ok" || digestSfValue(after.value) !== digestSfValue(selected)) return { status: "denied", reason: "actual-case-selection-changed" }
      return egress ? egress(value) : value
    }
    const observation = createSfPlannerCalculationAncestryScope({ host: business.host, state: authority.state, sources: business.plannerSources,
      withCalculationCase: selectedScope, lockedSourceFences: business.lockedSourceFences, requireCanonicalReplay: () => false,
      identities: () => [business.calculations, ...Object.entries(business.calculations).flatMap(([key, value]) => [key, value]),
        business.results, ...Object.entries(business.results).flatMap(([key, value]) => [key, value])] })
    const incoming = { ...produced.value.request, assumptions: [{ id: "ancestor", value: "Retain prior analysis", state: "hypothetical" as const, evidenceRefs: [eventRef] }] }
    const canonical = (call: TrustedUiContext, ref: BusinessEvidenceRef = leaf) => { counts.resolutions++; return business.calculations.resolveEvidence(ref, call) }
    const resolve = (call: TrustedUiContext, ref: BusinessEvidenceRef = leaf) => observation.resolve(ref, call, () => canonical(call, ref))
    const run = <Value>(work: (call: TrustedUiContext) => Promise<PortResult<Value>>) =>
      ui("sf_evidence_get", (call) => business.withCase(call, caseRef, {}, () => work(call)))
    const observe = <Value>(call: TrustedUiContext, work: () => Promise<PortResult<Value>>) => observation.observe(incoming, call, work)
    const rawSnapshots = () => store.transactionAll(async (value) => ({ commit: false, value: structuredClone(value) }))
    const capture = async () => ({ state: await authority.state.read(request(), "cases", (state, actor) => ({ state, actor })), snapshots: await rawSnapshots() })
    // Persisted corruption controls deliberately alter actual SQLite bytes; they
    // do not issue a replacement proof or manufacture an authorization grant.
    const corrupt = (mutate: (value: SfProductState) => void) => store.transaction("dashboard", async (snapshot) => {
      mutate(snapshot.data.__sfProductV1 as SfProductState)
      return { commit: true, value: true }
    })
    const changeSource = (call: TrustedUiContext) => store.transaction("planner", async (snapshot) => {
      const source = business.host.requestFor(call)
      if (!source) throw new Error("Actual source request unavailable")
      const principal = await business.host.authenticate(source, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      const actor = plannerSourceActor(snapshot, principal, call.binding.principalRef)
      if (!actor) throw new Error("Actual source actor unavailable")
      const environment = await business.host.environment(source)
      const value = domain.execute(snapshot, actor, { page: "OPEX", action: "save", id: "line",
        version: snapshot.versions["v0:lines:line"]?.version ?? 0, values: { versionId: "v0", f2: 121 } }, environment)
      return { commit: value.ok, value }
    })
    return { authority, business, store, persistence, control, hooks, counts, caseRef, leaf, eventRef, incoming, request, ui, run,
      canonical, resolve, observe, observation, capture, rawSnapshots, corrupt, changeSource, cleanup,
      reset: () => { for (const key of Object.keys(counts) as (keyof typeof counts)[]) counts[key] = 0 } }
  } catch (error) { await cleanup(); throw error }
}
