import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createSfUiAuthority, createSfDomainAuthority } from "../../../product/integration/ui-authority.ts"
import { createSfExecutionBindingRegistry } from "../../../product/host-binding/execution-context.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfBusinessContext } from "../../../product/host-binding/business-context.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardConfirmationObserver } from "../../../product/dashboard/confirmation.ts"
import { createDashboardConfirmationIssuer } from "../../../product/dashboard/confirmation-issuer.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createCollaborationHumanAuthority, collaborationHumanActions } from "../../../product/collaboration/human.ts"
import { createCollaborationHost } from "../../../product/collaboration/host.ts"
import type { WorkSignals } from "../../../product/collaboration/work-port.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost, PortResult } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

function ok<T>(result: PortResult<T>, label: string): T {
  expect(result.status).toBe("ok")
  if (result.status !== "ok") throw new Error(`${label}: ${result.reason}`)
  return result.value
}

test("real confirmation and case selection keep v7 January valid after global v8 February, then show one material review", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-confirmation-work-"))
  const store = await openLocalStore(directory)
  const at = "2026-11-13T00:00:00Z"
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const january = { start: "2026-01-01", end: "2026-01-31" }
  try {
    // Seed before lifecycle initialization, so both real initial source versions are one.
    await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "admins", version: 1, by: "person" }]
      snapshot.data.access = { person: { assigned: [], domains: [] } }
      snapshot.data.summaries = ["Budget Overview", "Executive Dashboard"]
      snapshot.data.opexOwners = [{ id: "owner", budget: 1200 }]
      snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 200, actual: 0, forecast: 0 }, { id: "feb", ownerId: "owner", year: 2026, month: 2, actual: 10 }]
      return { commit: true, value: undefined }
    })
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const request = () => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: "person" } })
    const ui = createSfUiAuthority({ authorize: async (candidate) => candidate.headers.get("actor") === "person" ? { installationId: "installation", projectId: "project", principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined, commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at), privateCommands: collaborationHumanActions.map((action) => `sf-human:${action}`) })
    const authority = createSfDomainAuthority({ ui, native: createSfExecutionBindingRegistry({ authenticateAndResolve: async () => undefined, revalidateAdmission: async () => false }) })
    const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
    const host: DomainPortHost = { persistence, authenticate: async (candidate, options) => candidate.headers.get("actor") === "person" ? resolve("person", [...options!.roleMap], (group) => group === "admins") : null, environment: async () => ({ at, id: randomUUID, directory: [{ id: "person", name: "Person" }] }), requestFor: authority.requestFor, revalidate: authority.revalidateDomainContext }
    const readContext = async (operation: string, payload: unknown) => {
      const context = ok(await ui.admit(request(), operation, digestSfValue(payload)), operation)
      if (!await ui.validate(context, operation, digestSfValue(payload))) throw new Error("UI admission validation failed")
      return context
    }
    const read = await readContext("sf_work_list", { selectionRef: "discovery", period })
    const issue = createDashboardSourceIssuer({ host, scopedSources: persistence })
    const pages = createDashboardSourceHost({ host, scopedSources: persistence })
    const dashboard = createDashboardPort({ host, sources: pages })
    ok(await issue({ page: "Budget Overview", fields: ["budgetSeries"], period: january }, read), "initial January source")
    for (let actual = 1; actual <= 6; actual++) await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[0]!.actual = actual; return { commit: true, value: undefined } })
    const source = ok(await issue({ page: "Budget Overview", fields: ["budgetSeries"], period: january }, read), "v7 January source").evidence
    expect(source.target.version).toBe(7)
    const globalVersion = () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "dashboard-page", "Budget Overview")?.version }))
    expect(await globalVersion()).toBe(7)
    const evidence = createSfBusinessContext({ revalidate: host.revalidate, resolveSource: async (ref, context) => {
      const result = await pages.resolveDashboardSource(ref.refId, context)
      return { state: result.status === "ok" && digestSfValue(result.value.evidence) === digestSfValue(ref) ? "fresh" : "unavailable", ref, accessRevision: context.binding.accessRevision, checkedAt: at }
    }, proveContinuity: async () => false, recall: async () => [], emitFromLedger: async () => ({ status: "unavailable", sourceEventId: "", scanner: { name: "", version: "", status: "unavailable" }, reason: "not-selected" }) })
    const creationTarget = { ref: "workspace", incarnation: "workspace-inc" }
    const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: creationTarget.incarnation }), authorize: async (candidate) => candidate.headers.get("actor") === "person" ? { principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined })
    // Exactly the canonical host's private authority; one closure is shared by both consumers.
    const authorizeCase = async (value: DecisionCase, context: TrustedDomainContext) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context)
    const cases = createDecisionCasePort({ state, host, creationTarget, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeCase, evidence, createId: randomUUID, now: () => at })
    const draft = { objective: "Review January material changes", horizon: period, currency: "USD", criteria: ["January has a current human review"], sourceRefs: [source] }
    const decision = ok(await cases.draft(draft, await readContext("sf_case_draft", draft)), "case draft")
    const caseRef = encodeCaseRef(decision)
    const observer = createDashboardConfirmationObserver({ host, scopedSources: persistence, readProjection: (selection, context) => dashboard.read({ selectionRef: selection.reference, fields: selection.fields, period: selection.period }, context) })
    const currentIssuer = createDashboardConfirmationIssuer({ host, scopedSources: persistence })
    const issueForActor = (target: Extract<BusinessEvidenceRef, { kind: "record" }>["target"], context: TrustedDomainContext) => currentIssuer({ recordType: target.recordType, recordId: target.recordId, fields: target.fields, period: target.period }, context)
    const workSignals: WorkSignals = async (_selectionRef, selectedPeriod, context) => {
      const issued = await issue({ page: "Executive Dashboard", fields: ["signals"], period: selectedPeriod }, context)
      if (issued.status !== "ok") return { status: "unavailable" }
      const projected = await dashboard.read({ selectionRef: issued.value.selectionRef, fields: ["signals"], period: selectedPeriod }, context)
      return projected.status === "ok" && projected.value.values.length === 0 && projected.value.missing.length === 0 ? { status: "ok", signals: [] } : { status: "unavailable" }
    }
    const settings = { host, state, creationTarget, scopedSources: persistence, evidence, cases, workCaseAuthority: authorizeCase, issueForActor, prepareReissueScope: observer.prepareReissueScope, human, authority, caseSelectionWrites: new WeakSet<object>(), confirmationSource: observer, workSignals, procurement: { list: async () => ({ status: "unavailable" as const, reason: "not-selected" }) }, collections: { resolveRequestCollection: async () => ({ status: "unavailable" as const, reason: "not-selected" }) }, requiredAuthority: { sf_work_list: [], sf_question_prepare: [], sf_answer_read: [], sf_relation_read: [], sf_handoff_prepare: [] }, createId: randomUUID, now: () => at }
    const factory = createCollaborationHost(settings)
    if (!factory.caseSelection || !factory.confirmation) throw new Error("real work selection or confirmation unavailable")
    const selectionDraft = { caseRef, period, sourceRefs: [source] }
    const mutation = { expectedStorageVersion: 0, idempotencyKey: "select-January" }
    const selected = ok(await factory.caseSelection.create(selectionDraft, mutation, ok(await human.admit(request(), "collaboration.selection.create", { draft: selectionDraft, mutation }), "selection admission")), "work selection")
    const selection = { selectionRef: selected.selectionRef, period }
    const scope = { sourceRef: { surface: "dashboard" as const, type: source.target.recordType, id: source.target.recordId, incarnation: source.target.incarnation }, fields: ["budgetSeries"], period: january, materialDependencies: [], scopeDefinitionVersion: "dashboard-c06-v1" }
    const displayed = ok(await factory.confirmation.prepare(scope, read), "displayed confirmation")
    const command = { scope, observedSourceVersion: displayed.sourceVersion, expectedScopeFingerprint: displayed.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey: "confirm-v7-January" }
    const confirmation = ok(await factory.confirmation.confirm(command, ok(await human.admit(request(), "collaboration.confirmation.confirm", command), "confirmation admission")), "confirmation")
    expect(confirmation.observedSourceVersion).toBe(7)
    const preserved = await state.read(request(), "confirmations", (value) => value.confirmations[confirmation.id])
    const preservedCase = await state.read(request(), "cases", (value) => value.cases[decision.id])
    if (preserved.status !== "ok" || preservedCase.status !== "ok" || !preservedCase.value) throw new Error("protected original state unavailable")
    const originalCase = preservedCase.value
    expect(ok(await factory.work.list(selection, read), "valid confirmation work").items).toEqual([])
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[1]!.actual = 99; return { commit: true, value: undefined } })
    expect(await globalVersion()).toBe(8)
    expect(ok(await factory.confirmation.project(confirmation.id, read), "irrelevant change")).toMatchObject({ state: "valid" })
    expect(ok(await factory.work.list(selection, read), "no irrelevant review").items).toEqual([])
    await persistence.transaction("dashboard", async (snapshot) => { (snapshot.data.opexEntries as { actual: number }[])[0]!.actual = 100; return { commit: true, value: undefined } })
    expect(ok(await factory.confirmation.project(confirmation.id, read), "material change")).toMatchObject({ state: "stale", reason: "material-change", evaluatedSourceVersion: 8 })
    expect(await cases.read({ caseRef }, read)).toMatchObject({ status: "unavailable", reason: "case-evidence-unavailable" })
    expect((await evidence.context({ refs: [source] }, read))[0]?.state).toBe("unavailable")
    const withoutCaseAuthority = createCollaborationHost({ ...settings, workCaseAuthority: undefined })
    expect((await withoutCaseAuthority.work.list(selection, read)).status).toBe("unavailable")
    const work = ok(await factory.work.listPresentation(selection, read), "one material review")
    expect(ok(await factory.caseSelection.list(caseRef, read), "discover retained work selection")).toEqual([{ selectionRef: selected.selectionRef, period, state: "active" }])
    expect(work.items).toHaveLength(1)
    expect(work.items[0]).toMatchObject({ kind: "confirmation", state: "confirmation-stale", observedVersion: 7, sourceVersion: 8, period: january, destination: { kind: "confirmation", confirmationId: confirmation.id } })
    expect(work.items[0]!.sourceRefs.every((ref) => ref.refDigest !== source.refDigest)).toBe(true)
    expect((await evidence.context({ refs: work.items[0]!.sourceRefs }, read)).every((value) => value.state === "fresh")).toBe(true)
    expect(ok(await factory.work.listPresentation(selection, read), "stable material review")).toEqual(work)
    const after = await state.read(request(), "confirmations", (value) => value.confirmations[confirmation.id])
    const afterCase = await state.read(request(), "cases", (value) => value.cases[decision.id])
    expect(after.status === "ok" && digestSfValue(after.value)).toBe(digestSfValue(preserved.value))
    expect(afterCase.status === "ok" && digestSfValue(afterCase.value)).toBe(digestSfValue(preservedCase.value))
    // Even an erroneous same-version case write must not inherit the selected snapshot.
    const changedCase = await state.transaction(request(), { namespace: "cases", expectedStorageVersion: 1, targetRef: creationTarget.ref, targetIncarnation: creationTarget.incarnation, idempotencyKey: "same-version-case-change", commandDigest: digestSfValue("changed case objective") }, async (value) => { value.cases[decision.id]!.objective = "Different case without a version bump"; return { commit: true, value: true } })
    expect(changedCase.status).toBe("ok")
    const alteredCaseWork = await factory.work.listPresentation(selection, read)
    expect(alteredCaseWork.status).toBe("unavailable")
    expect("value" in alteredCaseWork).toBe(false)
    expect((await factory.caseSelection.list(caseRef, read)).status).toBe("unavailable")
    const restoredCase = await state.transaction(request(), { namespace: "cases", expectedStorageVersion: 2, targetRef: creationTarget.ref, targetIncarnation: creationTarget.incarnation, idempotencyKey: "restore-protected-case", commandDigest: digestSfValue(originalCase) }, async (value) => { value.cases[decision.id] = structuredClone(originalCase); return { commit: true, value: true } })
    expect(restoredCase.status).toBe("ok")
    expect(ok(await factory.work.listPresentation(selection, read), "original selected case restored")).toEqual(work)
    await persistence.transaction("dashboard", async (snapshot) => { snapshot.data.roleMap = []; return { commit: true, value: undefined } })
    const revoked = await factory.work.listPresentation(selection, read)
    expect(revoked.status).toBe("unavailable")
    expect("value" in revoked).toBe(false)
    expect((await factory.work.list(selection, structuredClone(read))).status).toBe("denied")
  } finally {
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
