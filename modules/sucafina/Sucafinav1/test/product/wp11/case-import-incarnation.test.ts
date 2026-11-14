import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import { createDecisionCaseManagement } from "../../../product/decisions/case-management.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createDashboardRecordEvidenceHost } from "../../../product/dashboard/sources.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createDashboardRecordSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createApplication } from "../../../runtime/application.ts"
import type { Command } from "../../../runtime/contract.ts"
import { domain, pages, render } from "../../../runtime/dashboard-portfolio.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { resolve } from "../../../src/identity.ts"
import { createWp05SensitivityFixture, wp05Horizon } from "../wp05/engine-fixture.ts"

test("real JSON import preserves the private C08 choice and cannot revive a deleted source under a reused record ID", async () => {
  const fixture = await createWp05SensitivityFixture({ mode: "renewal-usd", training: "omitted", composed: true })
  let reopened: Awaited<ReturnType<typeof openLocalStore>> | undefined
  const at = "2026-11-13T00:00:00Z"
  const origin = "https://example.test"
  const principal = fixture.context.binding.principalRef
  const project = { id: "project-1", name: "Original project", status: "Planning", start: "2027-01-01", end: "2027-12-31" }
  const request = (command: Command, authenticated = true) => new Request(`${origin}/sucafina/dashboard`, {
    method: "POST", headers: { origin, "content-type": "application/json", authorization: authenticated ? "wp05-fixture" : "forged-principal" },
    body: JSON.stringify(command),
  })
  const backup = (data: unknown, version: number): Command => ({ page: "All Projects", action: "backup-import", version, confirmed: true, values: { data } })
  const bind = (store: Awaited<ReturnType<typeof openLocalStore>>) => {
    const persistence = createSfSourcePersistence({ persistence: store, createId: randomUUID, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) })
    const host: DomainPortHost = {
      ...fixture.host, persistence,
      authenticate: async (incoming, context) => incoming.headers.get("authorization") === "wp05-fixture" && context
        ? resolve(principal, [...context.roleMap], (group) => group === "dashboard-admins") : null,
      environment: async () => ({ at, id: () => project.id, directory: [{ id: principal, name: "Host authenticated Finance" }] }),
    }
    const records = createDashboardRecordEvidenceHost({ host, scopedSources: persistence, issueRecord: createDashboardRecordSourceIssuer({ host, scopedSources: persistence }) })
    const handle = createApplication("/sucafina", { persistence, authenticate: host.authenticate, environment: host.environment,
      domains: { dashboard: [{ domain, pages, render }], planner: [], procurement: [] }, maxJsonBytes: 2_000_000 })
    const app = async (incoming: Request): Promise<Response> => {
      const response = await handle(incoming)
      if (!response) throw new Error(`Dashboard route unavailable: ${incoming.method} ${new URL(incoming.url).pathname}`)
      return response
    }
    const state = createSfProductState({ persistence, createId: randomUUID,
      authorize: async (incoming) => incoming === fixture.request && await host.revalidate(fixture.context)
        ? { principalRef: principal, policyVersion: "policy", accessRevision: "access" } : undefined,
      resolveTarget: async () => ({ incarnation: fixture.caseRef.incarnation }),
    })
    return { persistence, host, records, app, state }
  }
  try {
    // The canonical WP05 fixture supplies the real Planner result and durable case.
    // Its explicit human-confirmation switch is a fixture boundary, not a browser proof.
    const human = { confirmed: false, sequence: 0 }
    const mutation = createDecisionMutations({ state: fixture.state, host: fixture.host, planner: fixture.plannerWithCriteria, sources: fixture.sources,
      authorizeCase: async (decision) => decision.participants.includes(principal), authorizeMutation: async () => fixture.host.revalidate(fixture.context), verifyMutation: () => true,
      operationIdentity: () => "wp11-import-existing-choice", confirmChoice: async () => human.confirmed, confirmAnswer: async () => false,
      resolveQuestion: async () => ({ status: "unavailable", reason: "not-requested" }), resolveAnswer: async () => ({ status: "unavailable", reason: "not-requested" }),
      prepareDomainCommands: async () => ({ status: "unavailable", reason: "separate-domain-confirmation-required" }),
      resolveChoiceValues: async (_case, comparison, context) => {
        const compared = await fixture.plannerWithCriteria.compareScenarios(comparison, context)
        return compared.status === "ok" ? { status: "ok", value: [{ criterionRef: fixture.sensitivityRequest.criterion.id, value: compared.value.knownDifference, unit: "USD", currency: "USD", horizon: wp05Horizon }] } : compared
      },
      readScenarioResult: (resultRef, context) => fixture.results.read({ kind: "scenario", resultRef }, context),
      createId: () => `wp11-import-choice-${++human.sequence}`, now: () => at,
    })
    const choiceRequest = { caseRef: fixture.caseRef, alternativeId: "selected", alternativeVersion: 1,
      comparison: { scenarioRefs: [fixture.baselineRef, fixture.selectedRef], criteria: [fixture.sensitivityRequest.criterion.id] },
      criteria: [fixture.sensitivityRequest.criterion.id], reason: "Retain this conditioned human choice when a business backup is restored." }
    expect(await mutation.recordChoice(choiceRequest, fixture.context)).toEqual({ status: "denied", reason: "human-choice-required" })
    human.confirmed = true
    const chosen = await mutation.recordChoice(choiceRequest, fixture.context)
    if (chosen.status !== "ok") throw new Error(`Existing choice unavailable: ${chosen.reason}`)
    const original = await fixture.state.read(fixture.request, "cases", (state) => structuredClone(state))
    if (original.status !== "ok") throw new Error("Private C08 state unavailable")
    const originalChoice = original.value.cases[fixture.caseRef.id]!.choices[0]!
    expect(originalChoice).toMatchObject({ principalRef: principal, result: { knownSubtotal: 210000, total: null } })
    expect(original.value.cases[fixture.caseRef.id]!.ledger.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
    const plannerBefore = await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))

    // Installation authorization is host setup. Every business replacement below runs
    // through the actual HTTP importer and the actual SQLite source lifecycle wrapper.
    await fixture.store.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = [{ surface: "dashboard", role: "admin", entra: "dashboard-admins", version: 1, by: principal }]
      snapshot.data.access = { [principal]: { assigned: [], domains: [] } }
      return { commit: true, value: undefined }
    })
    const current = bind(fixture.store)
    await current.persistence.initializeSources("dashboard")
    expect((await current.app(request(backup({ projects: [project] }, 0)))).status).toBe(200)
    const afterInitialImport = await current.state.read(fixture.request, "cases", (state) => structuredClone(state))
    expect(afterInitialImport).toEqual(original)
    const selection = { page: "All Projects", recordType: "projects", recordId: project.id, fields: ["name", "status"], period: { start: "2026-01-01", end: "2026-12-31" } }
    const issued = await current.records.issue(selection, fixture.context)
    if (issued.status !== "ok") throw new Error(`Dashboard source unavailable: ${issued.reason}`)
    expect(await current.records.resolve(issued.value.refId, fixture.context)).toEqual(issued)
    const physical = await current.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "projects", project.id) }))
    expect(physical).toBeDefined()

    // Link the producer-issued record as later case context using the real C08 edit.
    // The immutable financial choice continues to describe the earlier Planner basis.
    const edit = { caseRef: chosen.value.caseRef, objective: original.value.cases[fixture.caseRef.id]!.objective,
      criteria: original.value.cases[fixture.caseRef.id]!.criteria, sourceRefs: [...fixture.sourceRefs, issued.value] }
    const management = createDecisionCaseManagement({ state: current.state, host: current.host,
      authorizeCase: async (decision, context) => decision.participants.includes(context.binding.principalRef) && await current.host.revalidate(context),
      authorizeEdit: async (incoming, context) => digestSfValue(incoming) === digestSfValue(edit) && await current.host.revalidate(context),
      verifyEvidence: async (refs, context) => (await Promise.all(refs.map(async (ref) => {
        if (ref.kind === "record" && ref.target.surface === "dashboard") {
          const resolved = await current.records.resolve(ref.refId, context)
          return resolved.status === "ok" && digestSfValue(resolved.value) === digestSfValue(ref)
        }
        return (await fixture.evidence.resolve(ref, context)).state === "fresh"
      }))).every(Boolean),
      verifyEdit: (_snapshot, before, after, context) => context === fixture.context && before.version === edit.caseRef.version &&
        digestSfValue({ caseRef: edit.caseRef, objective: after.objective, criteria: after.criteria, sourceRefs: after.sourceRefs }) === digestSfValue(edit),
      operationIdentity: () => "wp11-import-source-link",
    })
    expect((await management.edit(edit, fixture.context)).status).toBe("ok")
    const trusted = await current.state.read(fixture.request, "cases", (state) => structuredClone(state))
    if (trusted.status !== "ok") throw new Error("Linked C08 state unavailable")
    expect(trusted.value.cases[fixture.caseRef.id]!.choices).toEqual([originalChoice])
    expect(trusted.value.cases[fixture.caseRef.id]!.sourceRefs).toContainEqual(issued.value)
    const dashboardBefore = await current.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const malicious = { projects: [project], __sfProductV1: {
      ...structuredClone(trusted.value), confirmations: { forged: { principalRef: "attacker", confirmed: true } },
      cases: { [fixture.caseRef.id]: { ...trusted.value.cases[fixture.caseRef.id], state: "applied", choices: [{ ...originalChoice, principalRef: "attacker" }], ledger: [{ kind: "choice-recorded", principalRef: "attacker" }] } },
    } }
    expect((await current.app(request(backup(malicious, 1)))).status).toBe(422)
    expect(await current.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot }))).toEqual(dashboardBefore)
    expect((await current.app(request(backup({ projects: [] }, 1), false))).status).toBe(401)
    expect(await current.state.read(fixture.request, "cases", (state) => structuredClone(state))).toEqual(trusted)

    expect((await current.app(request({ page: "All Projects", action: "delete", id: project.id, version: 1, values: {} }))).status).toBe(200)
    expect(await current.records.resolve(issued.value.refId, fixture.context)).toEqual({ status: "denied", reason: "source-unavailable" })
    expect(await current.persistence.resolveScopedSource("dashboard", issued.value.target.incarnation, async () => true)).toBeUndefined()
    // The ordinary producer deliberately rejects ID reuse while its tombstone exists.
    // A confirmed backup restore is the supported producer that can reintroduce that ID.
    expect((await current.app(request({ page: "All Projects", action: "save", version: 0, values: project }))).status).toBe(409)
    const restoredBusiness = { projects: [project], roleMap: [{ surface: "dashboard", role: "admin", entra: "attacker", version: 999, by: "attacker" }], access: { attacker: { assigned: [project.id] } } }
    expect((await current.app(request(backup(restoredBusiness, 1)))).status).toBe(200)
    expect(await current.state.read(fixture.request, "cases", (state) => structuredClone(state))).toEqual(trusted)
    const recreated = await current.records.issue(selection, fixture.context)
    if (recreated.status !== "ok") throw new Error(`Recreated Dashboard source unavailable: ${recreated.reason}`)
    expect(recreated.value.target.recordId).toBe(issued.value.target.recordId)
    expect(recreated.value.target.version).toBe(1)
    expect(recreated.value.target.incarnation).not.toBe(issued.value.target.incarnation)
    expect(recreated.value.target.projectionDigest).toBe(issued.value.target.projectionDigest)
    expect(recreated.value.refDigest).not.toBe(issued.value.refDigest)
    expect(await current.records.resolve(issued.value.refId, fixture.context)).toEqual({ status: "denied", reason: "source-unavailable" })
    expect(await current.records.resolve(recreated.value.refId, fixture.context)).toEqual(recreated)
    const after = await current.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    expect(sfSourceIdentity(after, "projects", project.id)?.incarnation).not.toBe(physical?.incarnation)
    expect(after.data.roleMap).toEqual(dashboardBefore.data.roleMap)
    expect(after.data.access).toEqual(dashboardBefore.data.access)
    expect(after.audit.map((event) => event.who)).toEqual([principal, principal, principal])
    expect(after.audit.filter((event) => event.record === "dataset").every((event) => event.name === "Host authenticated Finance")).toBe(true)
    expect(JSON.stringify(after.audit)).not.toContain("__sfProductV1")
    expect(JSON.stringify(after.audit)).not.toContain(originalChoice.reason)
    const stale = await current.app(request(backup(restoredBusiness, 1)))
    expect(stale.status).toBe(409)
    expect(await stale.text()).not.toContain("__sfProductV1")
    const exported = await current.app(new Request(`${origin}/sucafina/dashboard?download=json`, { headers: { authorization: "wp05-fixture" } }))
    expect(exported.status).toBe(200)
    const text = await exported.text()
    expect(text).not.toContain("__sfProductV1")
    expect(text).not.toContain(originalChoice.reason)
    expect(await fixture.store.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot) }))).toBe(plannerBefore)

    // Dispose the original driver before reopening: neither references nor history
    // rely on another live SQLite handle or an in-memory source registry.
    await fixture.store.dispose()
    reopened = await openLocalStore(fixture.directory)
    const restarted = bind(reopened)
    await restarted.persistence.initializeSources("dashboard")
    expect(await restarted.state.read(fixture.request, "cases", (state) => structuredClone(state))).toEqual(trusted)
    expect(await restarted.records.resolve(issued.value.refId, fixture.context)).toEqual({ status: "denied", reason: "source-unavailable" })
    expect(await restarted.records.resolve(recreated.value.refId, fixture.context)).toEqual(recreated)
    const historical = await restarted.state.read(fixture.request, "cases", (state) => state.cases[fixture.caseRef.id])
    if (historical.status !== "ok" || !historical.value) throw new Error("Historical case unavailable after restart")
    expect(historical.value.choices).toEqual([originalChoice])
    expect(historical.value.sourceRefs).toContainEqual(issued.value)
    expect(historical.value.ledger.filter((event) => event.kind === "choice-recorded")).toHaveLength(1)
    expect(historical.value.preparedChanges).toEqual([])
    expect(historical.value.receipts).toEqual([])
  } finally {
    await reopened?.dispose()
    // The local driver explicitly makes dispose idempotent; cleanup also ends the UI lease.
    await fixture.cleanup()
  }
}, 180000)
