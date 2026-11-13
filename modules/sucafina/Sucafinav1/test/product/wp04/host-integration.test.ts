import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import atlasPackage from "../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { createApplication } from "../../../runtime/application.ts"
import type { Application } from "../../../runtime/application.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { object } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/procurement.ts"
import { initialProcurementSettings } from "../../../src/initial-settings.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { ConfirmationCommand } from "../../../product/contracts/context.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../product/contracts/operations.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { createProcurementDecisionHttp } from "../../../product/procurement/decision-http.ts"

const period = { start: "2026-01-01", end: "2026-12-31" }
const initialAt = "2026-11-13T00:00:00Z"

test("real host composes C06 confirmation, current evidence routing and the WP09 dossier", async () => {
  const fixture = await hostFixture()
  try {
    const call = await fixture.ui("sf_request_read", { requestRef: fixture.evidence.refId })
    const issued = await fixture.business.procurementConfirmation.issue("PR-1", ["subject"], period, call)
    if (issued.status !== "ok") throw new Error(`C06 source unavailable: ${issued.reason}`)
    const scope = { sourceRef: { surface: "procurement" as const, type: "procurement-request", id: "PR-1", incarnation: issued.value.evidence.target.incarnation }, fields: ["subject"], period, materialDependencies: [], scopeDefinitionVersion: "procurement-c06-v1" }
    const confirmation = fixture.business.collaboration.confirmation
    if (!confirmation) throw new Error("WP08 confirmation consumer was not mounted")
    const observed = await confirmation.prepare(scope, call)
    if (observed.status !== "ok") throw new Error(`real observation unavailable: ${observed.reason}`)
    const before = await fixture.authority.state.read(fixture.request(), "confirmations", () => null)
    if (before.status !== "ok") throw new Error("confirmation namespace unavailable")
    const command: ConfirmationCommand = { scope, observedSourceVersion: observed.value.sourceVersion, expectedScopeFingerprint: observed.value.scopeFingerprint, expectedStorageVersion: before.storageVersion, idempotencyKey: randomUUID() }
    const admitted = await fixture.authority.human.admit(fixture.request("alice", "confirmation", command), "collaboration.confirmation.confirm", command)
    if (admitted.status !== "ok") throw new Error("real human confirmation admission unavailable")
    const confirmed = await confirmation.confirm(command, admitted.value)
    fixture.authority.human.finish(admitted.value)
    expect(confirmed.status).toBe("ok")
    if (confirmed.status !== "ok") throw new Error(`C06 commit failed: ${confirmed.reason}`)
    expect(await confirmation.project(confirmed.value.id, call)).toMatchObject({ status: "ok", value: { state: "valid", reason: "unchanged-scope" } })
    const resolved = await fixture.business.context.resolve(issued.value.evidence, call)
    expect(resolved.state).toBe("fresh")
    expect(resolved.authorizedProjection).toMatchObject({ values: [{ id: "subject", value: "Requisition fixture" }] })

    await fixture.select("bob")
    const bob = await fixture.ui("sf_request_read", { requestRef: fixture.evidence.refId }, "bob")
    expect((await fixture.business.procurementConfirmation.resolve(issued.value.evidence.refId, bob)).status).toBe("unavailable")
    expect(await confirmation.project(confirmed.value.id, bob)).toMatchObject({ status: "ok", value: { state: "valid" } })
    const dossier = await fixture.business.procurementDossier.prepare(fixture.evidence.refId, call)
    expect(dossier.status).toBe("ok")
    if (dossier.status !== "ok") throw new Error(`real WP09 dossier unavailable: ${dossier.reason}`)
    expect(dossier.value.request.values).toContainEqual(expect.objectContaining({ id: "originalAmount", value: 100 }))
    expect(dossier.value.comparison).toBeNull()
    expect(dossier.value.limitations.length).toBeGreaterThan(0)
    expect(dossier.value.documents).toEqual([])

    await fixture.edit({ description: "Unrelated description" })
    expect(await confirmation.project(confirmed.value.id, call)).toMatchObject({ status: "ok", value: { state: "valid" } })
    await fixture.edit({ title: "Materially changed subject" })
    expect(await confirmation.project(confirmed.value.id, call)).toMatchObject({ status: "ok", value: { state: "stale", reason: "material-change" } })
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      object(object(object(snapshot.data.store).requests)["PR-1"]).request = { ...object(object(object(object(snapshot.data.store).requests)["PR-1"]).request), attachments: [{ id: "document-without-extraction" }] }
      return { commit: true, value: undefined }
    })
    const attached = await fixture.business.individual.issue("procurement-request", "PR-1", call)
    if (attached.status !== "ok") throw new Error("attached Request source unavailable")
    expect((await fixture.business.procurementDossier.prepare(attached.value, call)).status).toBe("unavailable")
    fixture.revoke("alice")
    expect((await confirmation.project(confirmed.value.id, call)).status).toBe("denied")
    expect((await fixture.business.context.resolve(issued.value.evidence, call)).state).toBe("unavailable")
  } finally { await fixture.dispose() }
})

test("real HTTP prepares, reviews and applies C12 with one durable effect and authorized historical evidence", async () => {
  const fixture = await hostFixture()
  try {
    const prepared = await prepareChange(fixture)
    const call = await fixture.ui("sf_case_read", { caseRef: encodeCaseRef(prepared.request.caseRef) })
    const visible = await fixture.business.cases.read({ caseRef: encodeCaseRef(prepared.request.caseRef) }, call)
    expect(visible.status).toBe("ok")
    if (visible.status !== "ok") throw new Error(`prepared case unreadable: ${visible.reason}`)
    expect(visible.value.case.preparedChanges[0]).not.toHaveProperty("operation")
    expect(visible.value.case.preparedChanges[0]).toHaveProperty("operationRef")
    const noReview = await fixture.http("decision-apply", prepared.request)
    expect(noReview.response.status).toBe(403)
    expect(noReview.body.reason).toBe("prepared-review-required")
    expect(object((await fixture.material()).request.pr).estAmount).toBe(100)

    const review = await fixture.http("decision-review", { purpose: "review", ...prepared.request })
    expect(review.response.status).toBe(200)
    expect(object(review.body.value).fields).toContainEqual(expect.objectContaining({ field: "originalAmount", before: 100, after: 150 }))
    expect(object(review.body.value)).not.toHaveProperty("command")
    expect(object(review.body.value)).not.toHaveProperty("operation")
    fixture.advance(60_000)
    const applied = await fixture.http("decision-apply", prepared.request, "alice", "apply-one")
    expect(applied.response.status).toBe(200)
    expect(object(applied.body.value)).toMatchObject({ outcome: "applied", surface: "procurement", version: 1 })
    expect(fixture.receiptCommits).toHaveLength(1)
    expect(fixture.receiptCommits[0]!.afterCases).toBe(fixture.receiptCommits[0]!.beforeCases + 1)
    const after = await fixture.material()
    expect(object(after.request.pr).estAmount).toBe(150)
    expect(after.request.history).toEqual([expect.objectContaining({ action: "Saved", by: "alice", at: "2026-11-13T00:01:00.000Z" })])
    const retry = await fixture.http("decision-apply", prepared.request, "alice", "apply-one")
    expect(retry.response.status).toBe(200)
    expect(retry.body).toEqual(applied.body)
    expect(await fixture.material()).toEqual(after)
    const current = await fixture.business.cases.read({ caseRef: encodeCaseRef(prepared.request.caseRef) }, call)
    expect(current.status).toBe("ok")
    if (current.status !== "ok") throw new Error(`post-apply case inaccessible: ${current.reason}`)
    expect(current.value.case.state).toBe("applied")
    const receipt = current.value.evidenceRefs.find((ref) => ref.kind === "receipt")
    if (!receipt || receipt.kind !== "receipt") throw new Error("persisted application evidence absent")
    const historical = await fixture.business.context.resolve(fixture.evidence, call)
    expect(historical.state).toBe("historical")
    expect(historical.authorizedProjection).toMatchObject({ values: expect.arrayContaining([expect.objectContaining({ id: "originalAmount", value: 100 })]) })
    expect(historical.differences).toContainEqual({ field: "originalAmount", before: 100, after: 150 })
    expect(await fixture.business.context.resolve(receipt, call)).toMatchObject({ state: "fresh", authorizedProjection: { engineVersion: "procurement-receipt-v1" } })
    const counterfeit: BusinessEvidenceRef = { ...receipt, refId: "sf-procurement-receipt:unpersisted", target: { ...receipt.target, receiptId: "unpersisted" } }
    counterfeit.refDigest = digestSfEvidenceRef(counterfeit)
    expect((await fixture.business.context.resolve(counterfeit, call)).state).toBe("unavailable")

    await fixture.select("bob")
    const bob = await fixture.ui("sf_case_read", { caseRef: encodeCaseRef(prepared.request.caseRef) }, "bob")
    expect((await fixture.business.cases.read({ caseRef: encodeCaseRef(prepared.request.caseRef) }, bob)).status).toBe("ok")
    expect(await fixture.business.context.resolve(fixture.evidence, bob)).toMatchObject({ state: "historical", authorizedProjection: { context: { principalRef: "bob", accessRevision: bob.binding.accessRevision } } })
    expect((await fixture.business.context.resolve(receipt, bob)).state).toBe("fresh")
    await fixture.select("bob", { start: "2027-01-01", end: "2027-12-31" })
    expect((await fixture.business.context.resolve(fixture.evidence, bob)).state).toBe("unavailable")
    expect((await fixture.business.context.resolve(receipt, bob)).state).toBe("unavailable")
    fixture.revoke("alice")
    expect((await fixture.business.context.resolve(fixture.evidence, call)).state).toBe("unavailable")
    expect((await fixture.business.context.resolve(receipt, call)).state).toBe("unavailable")
    expect((await fixture.http("decision-apply", prepared.request, "alice", "apply-one")).response.status).toBe(403)
    expect(await fixture.material()).toEqual(after)
  } finally { await fixture.dispose() }
})

test("private original evidence is immutable and a replacement Request cannot revive historical facts or receipts", async () => {
  const fixture = await hostFixture()
  try {
    const prepared = await prepareChange(fixture)
    const before = await fixture.authority.state.read(fixture.request(), "preferences", (state) => structuredClone(state.preferences))
    if (before.status !== "ok") throw new Error("private archive unavailable")
    const key = `sf:procurement-evidence:${fixture.evidence.refDigest}`
    expect(object(before.value[key]).schema).toBe("sf-procurement-evidence-v1")
    for (const remove of [false, true]) {
      const denied = await fixture.authority.state.transaction(fixture.request(), { namespace: "preferences", expectedStorageVersion: before.storageVersion, targetRef: fixture.authority.creationTarget.ref, targetIncarnation: fixture.authority.creationTarget.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue({ remove }) }, async (state) => {
        if (remove) delete state.preferences[key]
        else state.preferences[key] = { schema: "forged" }
        return { commit: true, value: true }
      })
      expect(denied).toMatchObject({ status: "denied", reason: "procurement-evidence-write-outside-authority" })
      const unchanged = await fixture.authority.state.read(fixture.request(), "preferences", (state) => state.preferences)
      expect(unchanged).toMatchObject({ status: "ok", storageVersion: before.storageVersion, value: before.value })
    }
    // A second authorized preparation of the same source keeps the first observation intact.
    fixture.advance(86_400_000)
    const repeated = await fixture.http("decision-prepare-changes", { caseRef: prepared.request.caseRef, choiceId: prepared.request.choiceId, operations: [prepared.operation] })
    expect(repeated.response.status).toBe(200)
    const archivedAgain = await fixture.authority.state.read(fixture.request(), "preferences", (state) => state.preferences[key])
    expect(archivedAgain).toMatchObject({ status: "ok", value: before.value[key] })
    const updated = readCaseRef(object(repeated.body.value).caseRef)
    const chosen = { ...prepared.request, caseRef: updated }
    expect((await fixture.http("decision-review", { purpose: "review", ...chosen })).response.status).toBe(200)
    expect((await fixture.http("decision-apply", chosen)).response.status).toBe(200)
    const call = await fixture.ui("sf_case_read", { caseRef: encodeCaseRef(updated) })
    const current = await fixture.business.cases.read({ caseRef: encodeCaseRef(updated) }, call)
    if (current.status !== "ok") throw new Error(`applied case unavailable: ${current.reason}`)
    const receipt = current.value.evidenceRefs.find((ref) => ref.kind === "receipt")
    if (!receipt) throw new Error("receipt source unavailable")
    const saved = await fixture.material()
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      delete object(object(snapshot.data.store).requests)["PR-1"]
      return { commit: true, value: undefined }
    })
    await fixture.persistence.transaction("procurement", async (snapshot) => {
      object(object(snapshot.data.store).requests)["PR-1"] = { request: saved.request, version: 1, by: "alice" }
      return { commit: true, value: undefined }
    })
    const replacement = await fixture.business.individual.issue("procurement-request", "PR-1", call)
    expect(replacement.status).toBe("ok")
    expect((await fixture.business.context.resolve(fixture.evidence, call)).state).toBe("unavailable")
    expect((await fixture.business.context.resolve(receipt, call)).state).toBe("unavailable")
    expect((await fixture.business.cases.read({ caseRef: encodeCaseRef(updated) }, call)).status).toBe("unavailable")
    expect((await fixture.http("decision-apply", chosen)).response.status).toBe(403)
    expect((await fixture.material()).request.history).toHaveLength(1)
  } finally { await fixture.dispose() }
})

test("Procurement decision HTTP rejects injected commands, ungranted actors and cross-origin intent", async () => {
  const fixture = await hostFixture()
  try {
    const prepared = await prepareChange(fixture)
    const before = await fixture.material()
    for (const payload of [{ ...prepared.request, actor: "alice" }, { ...prepared.request, command: { page: "Requests", action: "delete" } }, { ...prepared.request, caseRef: { ...prepared.request.caseRef, version: "3" } }]) {
      expect((await fixture.http("decision-apply", payload)).response.status).toBe(400)
    }
    expect((await fixture.http("decision-apply", prepared.request, "mallory")).response.status).toBe(403)
    const cross = await fixture.application(fixture.request("alice", "decision-apply", prepared.request, randomUUID(), { origin: "https://other.invalid" }))
    expect(cross?.status).toBe(403)
    const extraQuery = fixture.request("alice", "decision-apply", prepared.request)
    const wrongQuery = new Request(`${extraQuery.url}&actor=alice`, extraQuery)
    expect((await fixture.application(wrongQuery))?.status).toBe(400)
    expect(await fixture.material()).toEqual(before)
  } finally { await fixture.dispose() }
})

test("a real case edit between durable receipt and reconciliation preserves the conflict without reapplying", async () => {
  const fixture = await hostFixture()
  try {
    const prepared = await prepareChange(fixture)
    expect((await fixture.http("decision-review", { purpose: "review", ...prepared.request })).response.status).toBe(200)
    fixture.afterReceiptCommit(async () => {
      const current = await fixture.storedCase()
      const changed = { ...current.value, version: current.value.version + 1, objective: "Concurrent authorized case edit" }
      const saved = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: changed.id, targetIncarnation: changed.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue(changed) }, async (state) => { state.cases[changed.id] = changed; return { commit: true, value: true } })
      if (saved.status !== "ok") throw new Error("concurrent real case edit failed")
    })
    const conflict = await fixture.http("decision-apply", prepared.request)
    expect(conflict.response.status).toBe(409)
    expect(conflict.body).toEqual({ status: "stale", reason: "case-changed-after-application" })
    expect(fixture.receiptCommits).toHaveLength(1)
    const after = await fixture.material()
    expect(object(after.request.pr).estAmount).toBe(150)
    expect(after.request.history).toHaveLength(1)
    const decision = await fixture.storedCase()
    expect(decision.value.objective).toBe("Concurrent authorized case edit")
    expect(decision.value.preparedChanges[0]?.state).toBe("planned")
    expect(decision.value.receipts).toEqual([])
    const receipts = await fixture.authority.state.read(fixture.request(), "receipts", (state) => Object.values(state.receipts))
    expect(receipts).toMatchObject({ status: "ok", value: [expect.objectContaining({ result: { ok: true } })] })
    expect((await fixture.http("decision-apply", prepared.request)).response.status).toBe(409)
    expect(await fixture.material()).toEqual(after)
    expect(fixture.receiptCommits).toHaveLength(1)
  } finally { await fixture.dispose() }
})

test("a durable application recovers after a lost commit response and cleared review cache", async () => {
  const fixture = await hostFixture()
  try {
    const prepared = await prepareChange(fixture)
    expect((await fixture.http("decision-review", { purpose: "review", ...prepared.request })).response.status).toBe(200)
    fixture.afterReceiptCommit(async () => {
      fixture.business.procurementDecisions.dispose()
      throw new Error("injected response loss after the real SQLite receipt commit")
    })
    const interrupted = await fixture.http("decision-apply", prepared.request, "alice", "recover-application")
    expect(interrupted.response.status).toBe(503)
    const afterCommit = await fixture.material()
    expect(object(afterCommit.request.pr).estAmount).toBe(150)
    expect(afterCommit.request.history).toHaveLength(1)
    expect((await fixture.storedCase()).value.receipts).toEqual([])
    expect(fixture.receiptCommits).toHaveLength(1)
    const recovered = await fixture.http("decision-apply", prepared.request, "alice", "recover-application")
    expect(recovered.response.status).toBe(200)
    expect(object(recovered.body.value)).toMatchObject({ outcome: "applied", version: 1 })
    expect((await fixture.storedCase()).value.state).toBe("applied")
    expect((await fixture.storedCase()).value.receipts).toHaveLength(1)
    expect(await fixture.material()).toEqual(afterCommit)
    expect(fixture.receiptCommits).toHaveLength(1)
  } finally { await fixture.dispose() }
})

async function hostFixture() {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-host-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const clock = { at: initialAt }
  const permitted = new Set(["alice", "bob"])
  const origin = "https://local.invalid"
  const sources = createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at), createId: randomUUID })
  const scheduling: { afterReceipt?: () => Promise<void> } = {}
  const receiptCommits: { beforeCases: number; afterCases: number }[] = []
  // This adapter changes only scheduling: both competing transactions commit through
  // the same real lifecycle and SQLite store. It supplies no data or consumer result.
  const persistence: ReturnType<typeof createSfSourcePersistence> = { ...sources, transactionAll: async (work, options) => {
    if (!sources.transactionAll) throw new Error("real transactionAll unavailable")
    let committed: { beforeCases: number; afterCases: number } | undefined
    const result = await sources.transactionAll(async (snapshots) => {
      const before = object(snapshots.dashboard.data.__sfProductV1)
      const count = Object.keys(object(before.receipts)).length
      const beforeCases = Number(object(before.versions).cases)
      const outcome = await work(snapshots)
      const after = object(snapshots.dashboard.data.__sfProductV1)
      if (outcome.commit && Object.keys(object(after.receipts)).length > count) committed = { beforeCases, afterCases: Number(object(after.versions).cases) }
      return outcome
    }, options)
    if (committed) {
      receiptCommits.push(committed)
      const work = scheduling.afterReceipt
      scheduling.afterReceipt = undefined
      await work?.()
    }
    return result
  } }
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("procurement", async (snapshot) => {
    snapshot.data.store = { requests: { "PR-1": { request: { number: "PR-1", createdBy: "alice", status: "draft", pr: { title: "Requisition fixture", justification: "Recorded need", estAmount: 100 }, history: [], attachments: [] }, version: 0, by: "alice" } }, suppliers: [], settings: initialProcurementSettings(), issued: { pr: ["PR-1"], po: [] } }
    snapshot.versions["requests:PR-1"] = { version: 0, by: "alice" }
    return { commit: true, value: undefined }
  })
  const authenticate: Application["authenticate"] = async (request, selection) => {
    const id = request.headers.get("authorization")?.replace(/^Bearer /, "")
    if (!id || !permitted.has(id) || !selection) return null
    return { id, canWrite: true, roles: [{ surface: selection.surface, role: selection.surface === "procurement" ? id === "alice" ? "requester" : "buyer" : selection.surface === "planner" ? "editor" : "viewer" }] }
  }
  const environment: Application["environment"] = async () => ({ at: clock.at, id: randomUUID, directory: [{ id: "alice", name: "Alice" }, { id: "bob", name: "Bob" }] })
  const request = (actor = "alice", mode?: string, payload?: unknown, key: string = randomUUID(), headers: Record<string, string> = {}) => new Request(`${origin}/sf/procurement${mode ? `?sf=${mode}` : ""}`, { method: payload === undefined ? "GET" : "POST", headers: { authorization: `Bearer ${actor}`, origin, "content-type": "application/json", "idempotency-key": key, ...headers }, ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) })
  const proposalCoverageWrites = new WeakSet<object>()
  const procurementEvidenceWrites = new WeakSet<object>()
  const mounted: { business?: ReturnType<typeof createSfBusinessServices> } = {}
  const authority = createSfProductAuthority({
    identity: () => ({ installationId: "i", hostId: "procurement-integration", projectId: "p", location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }), installationId: "i", origin, policyVersion: "p1", persistence, authenticate, environment,
    grants: ["alice", "bob"].map((principalRef): SfProductGrant => ({ principalRef, namespaces: ["cases", "preferences", "confirmations", "receipts", "threads", "relations"], operations: ["sf_work_list", "sf_request_read", "sf_case_draft", "sf_case_read", "sf_context_read", "sf_sourcing_compare"], humanActions: ["collaboration.confirmation.confirm", "decisions.prepare-changes", "decisions.portfolio.read", "decisions.apply"] })),
    createId: randomUUID, now: Date.now, commandIdentity: async (value, operation, inputDigest) => value.headers.get("idempotency-key") ? digestSfValue({ key: value.headers.get("idempotency-key"), operation, inputDigest }) : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined, proposalCoverageWrites, procurementEvidenceWrites,
    authorizePreparedTarget: (value, snapshot, targetRef, current) => mounted.business?.procurementDecisions.authorizeReceiptTarget(value, snapshot, targetRef, current) ?? Promise.resolve(undefined),
  })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites, procurementEvidenceWrites })
  mounted.business = business
  const root = path.resolve(import.meta.dir, "../../..")
  const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
  business.initializeAtlas(undefined, { boundaryVersion: atlasPackage.version, schemaVersion: contractFreeze.canonicalSha256, manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
  const product = createProcurementDecisionHttp({ origin, mount: "/sf", runtime: () => ({ human: authority.human, decisions: business.procurementDecisions, withCase: business.withCase }) })
  const application = createApplication("/sf", { authenticate, environment, persistence, maxJsonBytes: 131072, domains: { dashboard: [], planner: [], procurement: [] }, product })
  const ui = async (operation: string, payload: unknown, actor = "alice") => {
    const admitted = await authority.ui.admit(request(actor), operation, digestSfValue(payload))
    if (admitted.status !== "ok" || !await authority.ui.validate(admitted.value, operation, digestSfValue(payload))) throw new Error(`real UI admission failed: ${operation}/${actor}`)
    return admitted.value
  }
  const select = async (actor = "alice", selectedPeriod = period) => {
    const call = await ui("sf_work_list", { purpose: "work-selection", period: selectedPeriod }, actor)
    const selection = await business.procurementSelections.create(call, selectedPeriod)
    authority.ui.finish(call)
    if (selection.status !== "ok") throw new Error(`real selection failed: ${selection.reason}`)
  }
  await select()
  const issuer = await ui("sf_request_read", { request: "PR-1" })
  const issued = await business.individual.issue("procurement-request", "PR-1", issuer)
  if (issued.status !== "ok") throw new Error(`real source unavailable: ${issued.reason}`)
  const source = await business.individual.resolve(issued.value, issuer)
  authority.ui.finish(issuer)
  if (source.status !== "ok") throw new Error("real source evidence unavailable")
  const draft = { objective: "Review a controlled requisition amount", criteria: ["Budget impact"], horizon: period, currency: "USD", sourceRefs: [source.value.evidence] }
  const draftCall = await ui("sf_case_draft", draft)
  const created = await business.cases.draft(draft, draftCall)
  authority.ui.finish(draftCall)
  if (created.status !== "ok") throw new Error(`real case draft unavailable: ${created.reason}`)
  const storedCase = async () => {
    const value = await authority.state.read(request(), "cases", (state) => state.cases[created.value.id])
    if (value.status !== "ok" || !value.value) throw new Error("fixture case storage unavailable")
    return { storageVersion: value.storageVersion, value: value.value }
  }
  return { authority, business, persistence, application, request, ui, select, storedCase, evidence: source.value.evidence, receiptCommits,
    afterReceiptCommit: (work: () => Promise<void>) => { scheduling.afterReceipt = work },
    advance: (milliseconds: number) => { clock.at = new Date(Date.parse(clock.at) + milliseconds).toISOString() }, revoke: (actor: string) => { permitted.delete(actor) },
    material: () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: { request: structuredClone(object(object(object(object(snapshot.data.store).requests)["PR-1"]).request)), version: structuredClone(snapshot.versions["requests:PR-1"]) } })),
    edit: async (pr: Record<string, unknown>) => {
      const result = await persistence.transaction("procurement", async (snapshot) => { const outcome = domain.execute(snapshot, { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }, { page: "Requests", action: "save", id: "PR-1", version: snapshot.versions["requests:PR-1"]?.version ?? 0, values: { pr } }, await environment(request())); return { commit: outcome.ok, value: outcome } })
      if (!result.ok) throw new Error(`real requisition edit failed: ${result.status}`)
    },
    http: async (mode: string, payload: unknown, actor = "alice", key: string = randomUUID()) => { const response = await application(request(actor, mode, payload, key)); if (!response) throw new Error("Procurement HTTP handler absent"); return { response, body: object(await response.json()) } },
    dispose: async () => { business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
  }
}

async function prepareChange(fixture: Awaited<ReturnType<typeof hostFixture>>) {
  const current = await fixture.storedCase()
  const ref = fixture.evidence
  const operation: ScenarioOperation = { kind: "replace", targetRef: ref.refId, amount: 150, currency: "USD", period }
  const basis: CostCoverageBasis = { id: "fixture-basis", version: 1, decisionType: "requisition", categoryIds: ["purchase"], additionalCategoryIds: [], sourceRefs: [ref] }
  // Persisted decision fixture with explicit pending coverage. No model, Session or
  // SkillLoadReceipt is fabricated; all preparation/review/apply consumers below are real.
  const result: ScenarioResult = { id: "fixture-result", version: 1, currency: "USD", horizon: period, components: [], sourceRefs: [ref], unresolvedConditions: ["Coverage pending in seeded decision"], restrictions: [], comparisonStatus: "conditioned", knownSubtotal: 150, total: null, costCoverage: { basisId: basis.id, basisVersion: basis.version, alternativeId: "fixture-alternative", alternativeVersion: 1, currency: "USD", horizon: period, issues: ["Coverage pending"], evaluatedSourceRefs: [ref], coverageState: "pending", entries: [{ status: "pending", categoryId: "purchase", reason: "Fixture has no complete cost assertion" }], derivedMissingCategoryIds: ["purchase"] } }
  const seeded: DecisionCase = { ...current.value, version: current.value.version + 1, state: "chosen", participants: ["alice", "bob"], alternatives: [{ id: "fixture-alternative", version: 1, title: "Explicit amount replacement", scenario: { baseRef: ref.refId, operations: [operation], assumptions: [] }, result }], costCoverageBases: [basis] }
  const choice = createChoiceSnapshot({ case: seeded, alternativeId: "fixture-alternative", alternativeVersion: 1, comparison: { baselineResultRef: "fixture-baseline", alternativeResultRef: result.id, costCoverageRefs: [], criterionResults: [], unresolvedConditions: result.unresolvedConditions, comparisonStatus: "conditioned", knownDifference: 50, completeDifference: null }, criteria: seeded.criteria.map((criterion) => criterion.id), values: [], evidenceRefs: [ref], id: "fixture-choice", principalRef: "alice", reason: "Review and apply explicit persisted choice", at: initialAt })
  if (choice.status !== "ok") throw new Error(`typed choice fixture invalid: ${choice.reason}`)
  const saved = await fixture.authority.state.transaction(fixture.request(), { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: seeded.id, targetIncarnation: seeded.incarnation, idempotencyKey: randomUUID(), commandDigest: digestSfValue({ seeded, choice: choice.choice }) }, async (state) => { state.cases[seeded.id] = { ...seeded, choices: [choice.choice] }; return { commit: true, value: true } })
  if (saved.status !== "ok") throw new Error(`decision fixture persistence unavailable: ${saved.status}`)
  const prepared = await fixture.http("decision-prepare-changes", { caseRef: { id: seeded.id, incarnation: seeded.incarnation, version: seeded.version }, choiceId: choice.choice.id, operations: [operation] })
  expect(prepared.response.status).toBe(200)
  if (prepared.response.status !== 200) throw new Error(`real prepare HTTP failed: ${JSON.stringify(prepared.body)}`)
  const after = await fixture.storedCase()
  expect(after.value.preparedChanges).toHaveLength(1)
  const change = after.value.preparedChanges[0]!
  expect(change.operation.command).toMatchObject({ page: "Requests", action: "save", id: "PR-1", version: 0, values: { pr: { estAmount: 150 } } })
  expect(object((await fixture.material()).request.pr).estAmount).toBe(100)
  return { operation, request: { caseRef: readCaseRef(object(prepared.body.value).caseRef), choiceId: choice.choice.id, changeId: change.id } }
}

function readCaseRef(value: unknown) {
  const ref = object(value)
  if (typeof ref.id !== "string" || typeof ref.incarnation !== "string" || typeof ref.version !== "number" || !Number.isSafeInteger(ref.version)) throw new Error("HTTP case reference invalid")
  return { id: ref.id, incarnation: ref.incarnation, version: ref.version }
}
