import { expect, spyOn, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfAnalysisHostServices } from "../src/sucafina-product/analysis-host-services.ts"
import { createSfBusinessServices } from "../src/sucafina-product/business-services.ts"
import { createSfProcurementCaseReadScope } from "../src/sucafina-product/procurement-case-read-scope.ts"
import { createResidentAiBundle } from "../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"
import { createSfAtlasMemory, retainSfAtlasRecallResult, revalidateSfAtlasRecall, withSfAtlasRecallObservation } from "../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-memory.ts"
import { createSfProductAuthority } from "../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../modules/sucafina/Sucafinav1/product/integration/source-projections.ts"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { SourceRef } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { DecisionCase, PreparedChange, ScenarioResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { DecisionCasePort, DomainPortHost, PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfProductStatePort, SfStateResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { PlannerModule } from "../../../modules/sucafina/Sucafinav1/runtime/planner.ts"
import type { Command } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { initialProcurementSettings } from "../../../modules/sucafina/Sucafinav1/src/initial-settings.ts"

const origin = "https://case-scope.example.test"
const at = "2027-02-02T00:00:00Z"
const period = { start: "2027-01-01", end: "2027-12-31" }
const actorId = "case-scope-reader"

function value<T>(result: PortResult<T> | SfStateResult<T>, step: string): T {
  if (result.status !== "ok") throw new Error(step + ": " + result.status + ("reason" in result ? " (" + result.reason + ")" : ""))
  return result.value
}

type Ui = <T>(operation: string, payload: unknown,
  work: (call: TrustedUiContext, request: Request) => Promise<T>, signal?: AbortSignal) => Promise<T>
type Fixture = {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  ui: Ui
  request: (signal?: AbortSignal) => Request
  control: { authorized: boolean }
  source: BusinessEvidenceRef
  plannerCase: DecisionCase
  draft: (objective: string) => Promise<DecisionCase>
}

async function withFixture<T>(work: (fixture: Fixture) => Promise<T>): Promise<T> {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-case-read-scope-"))
  const store = await openLocalStore(directory)
  let business: ReturnType<typeof createSfBusinessServices> | undefined
  try {
    const persistence = { ...store, ...createSfSourcePersistence({
      persistence: store, createId: randomUUID, enumerate: enumerateSfSources,
      projectScope: createSfSourceScopeProjector(() => at),
    }) }
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const versionId = await persistence.transaction("planner", async (snapshot) => {
      const actor = { id: actorId, roles: ["admin"], canWrite: true }
      const environment = { at, id: randomUUID, directory: [] }
      const execute = (command: Command) => {
        const result = PlannerModule.domain.execute(snapshot, actor, command, environment)
        if (!result.ok) throw new Error("Original Planner rejected boundary fixture " + command.page + "/" + command.action)
        return result.value
      }
      const created = execute({ page: "Versions", action: "save", version: 0, values: {} })
      if (typeof created !== "string" || !created) throw new Error("Original Planner omitted its version identity")
      execute({ page: "Versions", action: "save", id: created,
        version: snapshot.versions["versions:" + created]?.version ?? 0,
        values: { name: "Case scope canonical Planner source", year: 2027 } })
      execute({ page: "OPEX", action: "save", version: 0, values: {
        versionId: created, collection: "lines", name: "Case scope service", el: "licenses", cur: "USD", owner: actorId,
        annual: "1200", a: [100, ...Array(11).fill(null)], f: [null, ...Array(11).fill(100)],
      } })
      execute({ page: "OPEX", action: "save", version: snapshot.versions[created + ":closed"]?.version ?? 0,
        values: { versionId: created, closed: 1 } })
      return { commit: true, value: created }
    })
    await persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.store = { requests: {}, suppliers: [], settings: initialProcurementSettings(), issued: { pr: [], po: [] } }
      return { commit: true, value: undefined }
    })
    const requests = new WeakSet<Request>()
    const request = (signal?: AbortSignal) => {
      const incoming = new Request(origin + "/sucafina/dashboard", {
        method: "POST", headers: { origin }, ...(signal ? { signal } : {}),
      })
      requests.add(incoming)
      return incoming
    }
    const control = { authorized: true }
    const identity = { installationId: "case-scope-installation", hostId: "case-scope-host", projectId: "case-scope-project",
      location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const authority = createSfProductAuthority({
      identity: () => identity, installationId: identity.installationId, origin, policyVersion: "case-scope-policy",
      persistence, proposalCoverageWrites: new WeakSet<object>(),
      grants: [{ principalRef: actorId, namespaces: ["cases", "preferences", "contributions", "atlas", "outbox"],
        operations: ["sf_case_draft", "sf_case_read", "sf_work_list"], humanActions: ["analysis.prepare"] }],
      // A bounded fixture identity provider; the original authority owns every
      // admission, consumed lease, request binding, revalidation and C08 grant.
      authenticate: async (incoming, scope) => requests.has(incoming) && control.authorized && scope
        ? { id: actorId, canWrite: true, roles: [{ surface: scope.surface, role: scope.surface === "planner" ? "finance" : "admin" }] }
        : null,
      environment: async () => ({ at, id: randomUUID, directory: [] }),
      createId: randomUUID, now: () => Date.now(), commandIdentity: async () => randomUUID(),
      inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
      providerGeneration: async () => 1, authorizeDocument: async () => undefined,
    })
    const canonical = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
    business = canonical
    canonical.initializeAtlas(undefined, {
      boundaryVersion: "case-scope-fixture", schemaVersion: "case-scope-fixture",
      manifestVersion: "case-scope-fixture", skillVersion: "case-scope-fixture",
    })
    const ui: Ui = async (operation, payload, work, signal) => {
      const incoming = request(signal), digest = digestSfValue(payload)
      const call = value(await authority.ui.admit(incoming, operation, digest), "original UI admission")
      try {
        expect(await authority.ui.validate(call, operation, digest)).toBe(true)
        return await work(call, incoming)
      } finally { authority.ui.finish(call) }
    }
    // decision-controls uses this same consumed read lease to enumerate/issue
    // original Planner sources; no projection or evidence reference is fabricated.
    const source = await ui("sf_case_read", {}, async (call) =>
      value(await canonical.plannerProduct.issueSource(versionId, call), "original Planner source").evidence)
    expect(source.kind).toBe("record")
    if (source.kind !== "record") throw new Error("Planner source is not a record")
    expect(source.target.surface).toBe("planner")
    const draft = async (objective: string) => {
      const payload = { objective, horizon: period, currency: "USD", criteria: ["Review the original source"], sourceRefs: [source] }
      return ui("sf_case_draft", payload, async (call) => value(await canonical.cases.draft(payload, call), "original case draft"))
    }
    const plannerCase = await draft("Planner case with an unrelated Procurement selection")
    return await work({ authority, business: canonical, ui, request, control, source, plannerCase, draft })
  } finally {
    business?.dispose()
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}

test("canonical Planner case remains readable after the original global Procurement selection expires", async () => {
  let now = Date.now()
  const clock = spyOn(Date, "now").mockImplementation(() => now)
  try {
    await withFixture(async (fixture) => {
      const input = { caseRef: encodeCaseRef(fixture.plannerCase) }
      const read = () => fixture.ui("sf_case_read", input, (call) => fixture.business.cases.read(input, call))
      const initial = value(await read(), "initial canonical case")
      expect(initial.case.sourceRefs).toEqual([fixture.source])
      expect(initial.case.preparedChanges).toHaveLength(0)
      const revision = () => fixture.authority.state.read(fixture.request(), "cases", (state) => state.versions.cases)
      const before = value(await revision(), "initial C08 revision")
      const select = async (selectedPeriod = period) => {
        const payload = { purpose: "work-selection", period: selectedPeriod }
        await fixture.ui("sf_work_list", payload, async (call) => {
          const selected = value(await fixture.business.procurementSelections.create(call, selectedPeriod), "original Procurement selection")
          expect(selected.period).toEqual(selectedPeriod)
          // Match decision-controls: release the collection reference and lease.
          // The original per-principal selected period remains in BusinessServices.
          fixture.business.registry.releaseSelection(selected.selectionRef)
        })
      }
      await select()
      expect(value(await read(), "case with current unrelated selection").case).toEqual(initial.case)
      now += 5 * 60_000 + 1
      // Every read receives a newly admitted original lease; only the unrelated
      // selected period has expired. Extending/renewing that period is not the fix.
      const after = value(await read(), "case after unrelated selection expiry")
      expect(after.case).toEqual(initial.case)
      expect(after.evidenceRefs).toEqual(initial.evidenceRefs)
      expect(after.case.sourceRefs).toEqual([fixture.source])
      expect(value(await revision(), "C08 revision after expiry")).toBe(before)
      await select({ start: "2028-01-01", end: "2028-12-31" })
      expect(value(await read(), "case after unrelated period replacement").case).toEqual(initial.case)
      expect(value(await revision(), "C08 revision after replacement")).toBe(before)
    })
  } finally { clock.mockRestore() }
}, 45_000)

test("analysis preparation distinguishes unavailable case evidence from a refused selection", async () => {
  await withFixture(async (fixture) => {
    const root = path.resolve(import.meta.dir, "../../../modules/sucafina/Sucafinav1/product/ai")
    const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
    const selected = bundle.profiles.map((profile) => {
      const skills = bundle.skills.filter((skill) => profile.allowedSkills.includes(skill.id))
      return {
        profile, skills, manifestDigest: bundle.manifestDigest,
        operationIds: profile.allowedOperations.filter((operation) => skills.some((skill) => skill.allowedOperations.includes(operation))),
      }
    })
    const finance = selected.find((entry) => entry.profile.id === "sf_finance")
    const forecast = finance?.skills.find((skill) => skill.id === "sf-explicar-forecast")
    if (!finance || !forecast) throw new Error("Finance forecast skill missing from fixture manifest")
    const analysis = createSfAnalysisHostServices({
      business: fixture.business, authority: fixture.authority, selected, analysisSelectionWrites: new WeakSet<object>(),
    })
    const caseRef = { id: fixture.plannerCase.id, incarnation: fixture.plannerCase.incarnation, version: fixture.plannerCase.version }
    const request = {
      caseRef, objective: "Inspect an unavailable case source", profileId: finance.profile.id, profileVersion: finance.profile.version,
      skillId: forecast.id, skillVersion: forecast.version, manifestDigest: finance.manifestDigest,
      outputSchemaVersion: "sf-contribution-v1" as const, requestedOperationScope: [],
    }
    const prepare = (ref = caseRef) => {
      const input = { request: { ...request, caseRef: ref }, selection: {} }
      return fixture.ui("sf-human:analysis.prepare", input, (call) => analysis.registry.prepare(input.selection, input.request, call))
    }
    const revisions = async () => ({
      cases: value(await fixture.authority.state.read(fixture.request(), "cases", (state) => state.versions.cases), "cases revision"),
      preferences: value(await fixture.authority.state.read(fixture.request(), "preferences", (state) => state.versions.preferences), "preferences revision"),
    })
    const before = await revisions()
    const source = spyOn(fixture.business.context, "context").mockRejectedValue(new Error("fixture source unavailable"))
    try {
      expect(await prepare()).toEqual({ status: "unavailable", reason: "analysis-source-unavailable" })
      expect(source).toHaveBeenCalledTimes(1)
      expect(await prepare({ ...caseRef, version: caseRef.version + 1 })).toMatchObject({ status: "denied" })
      expect(await prepare({ ...caseRef, incarnation: "foreign-incarnation" })).toMatchObject({ status: "denied" })
      source.mockImplementation(async () => {
        fixture.control.authorized = false
        throw new Error("fixture source unavailable during revocation")
      })
      expect(await prepare()).toMatchObject({ status: "denied" })
      fixture.control.authorized = true
      expect(await revisions()).toEqual(before)
    } finally { source.mockRestore() }
  })
}, 45_000)

test("canonical Atlas witnesses and renewals stay bound to their live observation", async () => {
  await withFixture(async (fixture) => {
    const memory = createSfAtlasMemory({
      state: fixture.authority.state, cases: fixture.business.cases, host: fixture.authority.host,
      evidence: fixture.business.context, proveContinuity: async () => false,
      scanner: { name: "read-only-fixture", scan: () => { throw new Error("Recall must not scan or write") } },
      scannerVersion: "1", now: () => at,
    })
    const ref = { id: fixture.plannerCase.id, incarnation: fixture.plannerCase.incarnation }
    await fixture.ui("sf_case_read", { caseRef: encodeCaseRef(ref) }, async (call, request) => {
      const read = () => memory.recall(ref, call)
      const current = () => fixture.authority.host.requestFor(call) === request && !request.signal.aborted
      const leaked = Promise.withResolvers<readonly unknown[]>()
      const outside = leaked.promise.then((records) => revalidateSfAtlasRecall([records], call))
      const released = await withSfAtlasRecallObservation(call, current, async () => {
        const result = await read()
        if (result.status !== "ok") throw new Error("Canonical Atlas observation unavailable")
        const renew = retainSfAtlasRecallResult(result, call)
        if (!renew) throw new Error("Canonical Atlas observation could not be retained")
        leaked.resolve(result.records)
        expect(await outside).toBe(false)
        expect(await revalidateSfAtlasRecall([result.records], call)).toBe(true)
        const renewed = await renew()
        if (renewed?.status !== "ok") throw new Error("Live owner could not renew its Atlas observation")
        expect(renewed.records).not.toBe(result.records)
        return { records: renewed.records, renew }
      })
      if (!released) throw new Error("Live Atlas observation did not complete")
      expect(await revalidateSfAtlasRecall([released.records], call)).toBe(false)
      expect(await released.renew()).toBeUndefined()
      const ordinary = await read()
      if (ordinary.status !== "ok") throw new Error("Standalone canonical Atlas read unavailable")
      expect(await revalidateSfAtlasRecall([ordinary.records], call)).toBe(true)
      expect(await revalidateSfAtlasRecall([ordinary.records], call)).toBe(false)
      const revoked = await withSfAtlasRecallObservation(call, current, async () => {
        const result = await read()
        if (result.status !== "ok") throw new Error("Canonical Atlas read unavailable before revocation")
        fixture.control.authorized = false
        expect(await revalidateSfAtlasRecall([result.records], call)).toBe(false)
        return true
      })
      expect(revoked).toBeUndefined()
    })
  })
}, 45_000)

/** Structural negative fixture only. This is NOT an emitted C12 preparation,
 * chosen alternative, approval, command or receipt. Its unavailable preview
 * exists solely to reach the wrapper's planned-Procurement eligibility guard. */
async function plannedBoundaryCase(fixture: Fixture): Promise<DecisionCase> {
  const draft = await fixture.draft("Structural planned Procurement boundary fixture")
  const next = draft.version + 1
  return fixture.ui("sf_case_read", { caseRef: encodeCaseRef(draft) }, async (call, request) => {
    const target: SourceRef = { surface: "procurement", type: "procurement-request",
      id: "boundary-only-no-request", incarnation: "boundary-only-incarnation", version: 0,
      fields: ["estAmount"], period, observedAt: at }
    const preview: ScenarioResult = {
      id: "boundary-only-no-preview", version: 1, components: [], currency: "USD", horizon: period,
      sourceRefs: [], unresolvedConditions: ["structural-boundary-only"], restrictions: ["not-emitted-not-applied"],
      comparisonStatus: "unavailable", knownSubtotal: null, total: null,
      costCoverage: { basisId: "boundary-only", basisVersion: 1, alternativeId: "boundary-only", alternativeVersion: 1,
        currency: "USD", horizon: period, issues: ["structural-boundary-only"], evaluatedSourceRefs: [],
        coverageState: "unavailable", entries: [], derivedMissingCategoryIds: [] },
    }
    const command: Command = { page: "Requests", action: "save", version: 0, values: {} }
    const change: PreparedChange = {
      id: "boundary-only-change", caseId: draft.id, caseVersion: next, choiceId: "boundary-only-no-choice",
      target, expectedVersion: 0, preview, requiredAuthority: ["procurement"],
      idempotencyKey: "boundary-only-not-dispatched", state: "planned",
      operation: { id: "boundary-only-operation", target, command, expectedVersion: 0,
        idempotencyKey: "boundary-only-not-dispatched", commandDigest: digestSfValue(command), requiredAuthority: ["procurement"],
        preview: { context: { installationId: call.binding.installationId, projectId: call.binding.projectId,
          principalRef: call.binding.principalRef, policyVersion: call.binding.policyVersion, accessRevision: call.binding.accessRevision,
          surface: "procurement", period, currency: "USD", sourceRefs: [target], capabilities: [] },
          version: 0, engineVersion: "structural-boundary-fixture", components: [], values: [], missing: [] } },
    }
    const selected: DecisionCase = { ...draft, version: next, preparedChanges: [change] }
    const version = value(await fixture.authority.state.read(request, "cases", (state) => state.versions.cases), "structural fixture C08 revision")
    value(await fixture.authority.state.transaction(request, {
      namespace: "cases", expectedStorageVersion: version, targetRef: draft.id, targetIncarnation: draft.incarnation,
      idempotencyKey: randomUUID(), commandDigest: digestSfValue(selected),
    }, async (state) => {
      state.cases[draft.id] = selected
      return { commit: true, value: true }
    }), "persist structural boundary fixture through C08")
    return selected
  })
}

test("case-read scope keeps common fences and refuses expired or replaced eligible Procurement boundaries", async () => {
  await withFixture(async (fixture) => {
    const eligible = await plannedBoundaryCase(fixture)
    const future = () => ({ period, expiresAt: Date.now() + 60_000 })
    let selection = future()
    let reader: object = fixture.business.context
    let replacementRequest: Request | undefined
    let afterState: (() => void | Promise<void>) | undefined
    let afterTransaction: (() => void | Promise<void>) | undefined
    let canonicalReads = 0
    let scopeStateResults: string[] = []
    const state: SfProductStatePort = { ...fixture.authority.state,
      read: async (request, namespace, read) => {
        const result = await fixture.authority.state.read(request, namespace, read)
        scopeStateResults.push(result.status)
        const hook = afterState
        afterState = undefined
        await hook?.()
        return result
      },
    }
    const originalPersistence = fixture.authority.host.persistence
    const host: DomainPortHost = { ...fixture.authority.host,
      requestFor: (call) => replacementRequest ?? fixture.authority.host.requestFor(call),
      persistence: { ...originalPersistence,
        transaction: async (surface, work, options) => {
          const result = await originalPersistence.transaction(surface, work, options)
          const hook = afterTransaction
          afterTransaction = undefined
          await hook?.()
          return result
        },
      },
    }
    const read: DecisionCasePort["read"] = createSfProcurementCaseReadScope({
      host, state, selection: () => selection, readerIdentity: () => reader,
      isCurrentRecord: fixture.business.individual.isCurrent, lockedSourceFences: fixture.business.lockedSourceFences,
      read: async (incoming, call) => {
        canonicalReads++
        return fixture.business.cases.read(incoming, call)
      },
    })
    const run = (selected: DecisionCase, configure?: (call: TrustedUiContext, request: Request, input: { caseRef: string }) => void,
      signal?: AbortSignal) => {
      selection = future()
      reader = fixture.business.context
      replacementRequest = undefined
      afterState = undefined
      afterTransaction = undefined
      canonicalReads = 0
      scopeStateResults = []
      fixture.control.authorized = true
      const input = { caseRef: encodeCaseRef(selected) }
      return fixture.ui("sf_case_read", input, async (call, request) => {
        configure?.(call, request, input)
        return read(input, call)
      }, signal)
    }
    const refused = async (result: ReturnType<typeof run>) => {
      expect(await result).toMatchObject({ status: "unavailable", reason: "procurement-case-read-changed" })
      expect(canonicalReads).toBe(0)
      expect(scopeStateResults).toEqual(["ok"])
    }

    // Non-Procurement canonical fallback is outside the SQLite lock and keeps
    // its own producer checks, even if the unrelated selection/reader changes.
    const original = value(await run(fixture.plannerCase), "outer canonical Planner control")
    expect(canonicalReads).toBe(1)
    const replaced = value(await run(fixture.plannerCase, () => {
      afterState = () => { selection = { ...selection }; reader = { ...fixture.business.context } }
    }), "Planner read after unrelated selection/reader replacement")
    expect(replaced.case).toEqual(original.case)
    expect(canonicalReads).toBe(1)
    const expiredAtEgress = value(await run(fixture.plannerCase, () => {
      afterTransaction = () => { selection.expiresAt = Date.now() - 1 }
    }), "Planner read after unrelated expiry at transaction egress")
    expect(expiredAtEgress.case).toEqual(original.case)
    expect(canonicalReads).toBe(1)

    // Control: the structural case is readable by C08 and reaches canonical
    // delegation while the selection is current. Its canonical outcome is not
    // evidence of a producer-issued preparation and is deliberately not promoted.
    await run(eligible)
    expect(scopeStateResults).toEqual(["ok"])
    expect(canonicalReads).toBe(1)

    // Each structural Procurement negative reaches actual C08 eligibility, then
    // must refuse without invoking or substituting a canonical case response.
    await refused(run(eligible, () => { selection.expiresAt = Date.now() - 1 }))
    await refused(run(eligible, () => { afterState = () => { selection = { ...selection } } }))
    await refused(run(eligible, () => { afterState = () => { reader = { ...fixture.business.context } } }))
    await refused(run(eligible, () => { afterTransaction = () => { selection.expiresAt = Date.now() - 1 } }))

    // Common fences apply even to the non-Procurement canonical fallback.
    await refused(run(fixture.plannerCase, () => { afterState = () => { replacementRequest = fixture.request() } }))
    await refused(run(fixture.plannerCase, (_call, request) => { afterState = () => { request.headers.set("x-boundary-test", "changed") } }))
    await refused(run(fixture.plannerCase, (_call, _request, input) => { afterState = () => { input.caseRef = encodeCaseRef(eligible) } }))
    await refused(run(fixture.plannerCase, (call) => { afterState = () => { fixture.authority.ui.finish(call) } }))
    const abort = new AbortController()
    await refused(run(fixture.plannerCase, () => { afterState = () => { abort.abort() } }, abort.signal))

    const revoked = await run(fixture.plannerCase, () => { afterState = () => { fixture.control.authorized = false } })
    expect(revoked.status).not.toBe("ok")
    expect(canonicalReads).toBe(1)
    fixture.control.authorized = true
    const recovered = value(await run(fixture.plannerCase), "fresh original lease after negative boundaries")
    expect(recovered.case).toEqual(original.case)
    expect(canonicalReads).toBe(1)
    expect(recovered.case.receipts).toHaveLength(0)
  })
}, 45_000)
