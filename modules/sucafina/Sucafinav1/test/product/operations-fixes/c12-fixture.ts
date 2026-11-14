import { expect } from "bun:test"
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
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { ScenarioOperation } from "../../../product/contracts/operations.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { createProcurementDecisionHttp } from "../../../product/procurement/decision-http.ts"

// Extracted from the pinned H05 fixture; only reopen/lifecycle scheduling is added.
const period = { start: "2026-01-01", end: "2026-12-31" }
const initialAt = "2026-11-13T00:00:00Z"

export async function createC12Fixture(scenario: string, origin: string, retained?: { directory: string; caseId: string }) {
  const started = performance.now()
  const directory = retained?.directory ?? await mkdtemp(path.join(await realpath(tmpdir()), "sf-procurement-host-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const metrics = { sqliteTransactions: 0, sqliteAllTransactions: 0, sqliteMilliseconds: 0, http: [] as { mode: string; status: number; milliseconds: number; sqliteTransactions: number }[] }
  const meteredStore: typeof store = { ...store,
    transaction: async (surface, work, options) => {
      const begin = performance.now()
      metrics.sqliteTransactions++
      try { return await store.transaction(surface, work, options) } finally { metrics.sqliteMilliseconds += performance.now() - begin }
    },
    transactionAll: async (work, options) => {
      if (!store.transactionAll) throw new Error("real SQLite transactionAll unavailable")
      const begin = performance.now()
      metrics.sqliteAllTransactions++
      try { return await store.transactionAll(work, options) } finally { metrics.sqliteMilliseconds += performance.now() - begin }
    },
  }
  const clock = { at: initialAt }
  const permitted = new Set(["alice", "bob"])
  const sources = createSfSourcePersistence({ persistence: meteredStore, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => clock.at), createId: randomUUID })
  const scheduling: { afterReceipt?: () => Promise<void>; afterCaptured?: () => Promise<void>; afterSourcingRead?: { remaining: number; work: () => Promise<void> } } = {}
  const receiptCommits: { beforeCases: number; afterCases: number }[] = []
  // This adapter changes only scheduling: both competing transactions commit through
  // the same real lifecycle and SQLite store. It supplies no data or consumer result.
  const persistence: ReturnType<typeof createSfSourcePersistence> = { ...sources, transaction: async (surface, work, options) => {
    const result = await sources.transaction(surface, work, options)
    const captured = object(result)
    if (surface === "procurement" && typeof captured.physicalIncarnation === "string" && typeof captured.bindingDigest === "string" && object(captured.change).operation && object(captured.request).caseRef) {
      const interleave = scheduling.afterCaptured
      scheduling.afterCaptured = undefined
      await interleave?.()
    }
    // The real source transaction has returned; only its next comparison/read is interleaved.
    const facts = object(captured.value)
    const sourcing = scheduling.afterSourcingRead
    if (sourcing && surface === "procurement" && captured.status === "ok" && typeof facts.stage === "string" && Array.isArray(facts.offers) && facts.evidence) {
      sourcing.remaining -= 1
      if (sourcing.remaining === 0) {
        scheduling.afterSourcingRead = undefined
        await sourcing.work()
      }
    }
    return result
  }, transactionAll: async (work, options) => {
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
  if (!retained) await persistence.transaction("procurement", async (snapshot) => {
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
    createId: randomUUID, now: Date.now, commandIdentity: async (value, operation, inputDigest) => {
      // H09's read-only navigation has no browser intention key. As in the real
      // CLI host, the host creates its read identity; POST keys remain untouched.
      // This opt-in changes neither the eight existing scenarios nor other reads.
      if (value.method === "GET" && operation === "sf_case_read" && !value.headers.has("idempotency-key")) return randomUUID()
      return value.headers.get("idempotency-key") ? digestSfValue({ key: value.headers.get("idempotency-key"), operation, inputDigest }) : undefined
    },
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false, providerGeneration: async () => undefined, authorizeDocument: async () => undefined, proposalCoverageWrites, procurementEvidenceWrites,
    authorizePreparedTarget: (value, snapshot, targetRef, current) => mounted.business?.procurementDecisions.authorizeReceiptTarget(value, snapshot, targetRef, current) ?? Promise.resolve(undefined),
  })
  const services = createSfBusinessServices({ authority, persistence, proposalCoverageWrites, procurementEvidenceWrites })
  const business = services
  mounted.business = business
  const root = path.resolve(import.meta.dir, "../../../product/ai")
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
  const caseId = retained?.caseId ?? await (async () => {
    const draft = { objective: "Review a controlled requisition amount", criteria: ["Budget impact"], horizon: period, currency: "USD", sourceRefs: [source.value.evidence] }
    const draftCall = await ui("sf_case_draft", draft)
    const created = await business.cases.draft(draft, draftCall)
    authority.ui.finish(draftCall)
    if (created.status !== "ok") throw new Error(`real case draft unavailable: ${created.reason}`)
    return created.value.id
  })()
  const storedCase = async () => {
    const value = await authority.state.read(request(), "cases", (state) => state.cases[caseId])
    if (value.status !== "ok" || !value.value) throw new Error("fixture case storage unavailable")
    return { storageVersion: value.storageVersion, value: value.value }
  }
  return { directory, caseId, authority, business, persistence, application, request, ui, select, storedCase, evidence: source.value.evidence, receiptCommits,
    afterReceiptCommit: (work: () => Promise<void>) => { scheduling.afterReceipt = work },
    afterApplyTargetCaptured: (work: () => Promise<void>) => { scheduling.afterCaptured = work },
    afterSourcingFactsRead: (count: number, work: () => Promise<void>) => { scheduling.afterSourcingRead = { remaining: count, work } },
    advance: (milliseconds: number) => { clock.at = new Date(Date.parse(clock.at) + milliseconds).toISOString() }, revoke: (actor: string) => { permitted.delete(actor) },
    restoreFixtureAccess: (actor: string) => { permitted.add(actor) },
    material: () => persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: { request: structuredClone(object(object(object(object(snapshot.data.store).requests)["PR-1"]).request)), version: structuredClone(snapshot.versions["requests:PR-1"]) } })),
    edit: async (pr: Record<string, unknown>) => {
      const result = await persistence.transaction("procurement", async (snapshot) => { const outcome = domain.execute(snapshot, { id: "alice", canWrite: true, roles: ["requester"], assigned: [], domains: [] }, { page: "Requests", action: "save", id: "PR-1", version: snapshot.versions["requests:PR-1"]?.version ?? 0, values: { pr } }, await environment(request())); return { commit: outcome.ok, value: outcome } })
      if (!result.ok) throw new Error(`real requisition edit failed: ${result.status}`)
    },
    http: async (mode: string, payload: unknown, actor = "alice", key: string = randomUUID()) => {
      const begin = performance.now()
      const transactions = metrics.sqliteTransactions + metrics.sqliteAllTransactions
      const response = await application(request(actor, mode, payload, key))
      if (!response) throw new Error("Procurement HTTP handler absent")
      metrics.http.push({ mode, status: response.status, milliseconds: Math.round(performance.now() - begin), sqliteTransactions: metrics.sqliteTransactions + metrics.sqliteAllTransactions - transactions })
      return { response, body: object(await response.json()) }
    },
    dispose: async (remove = true) => {
      business.dispose()
      await store.dispose()
      if (remove) await rm(directory, { recursive: true, force: true })
      console.info("wp04-host-metrics", JSON.stringify({ scenario, milliseconds: Math.round(performance.now() - started), ...metrics, sqliteMilliseconds: Math.round(metrics.sqliteMilliseconds) }))
    },
  }
}

export async function prepareC12Change(fixture: Awaited<ReturnType<typeof createC12Fixture>>) {
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

export function readReviewDigest(body: Record<string, unknown>) {
  const digest = object(body.value).reviewDigest
  if (typeof digest !== "string" || !/^[a-f0-9]{64}$/.test(digest)) throw new Error("real review producer digest unavailable")
  return digest
}

export function changedReviewDigest(digest: string) {
  return `${digest[0] === "0" ? "1" : "0"}${digest.slice(1)}`
}

