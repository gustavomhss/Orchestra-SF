import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { DomainProjection, Period } from "../../../product/contracts/context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createPortfolioCampaign, type PortfolioCampaignEdit } from "../../../product/portfolio/campaign.ts"
import { portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import type { PortfolioCandidate } from "../../../product/portfolio/port.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

const horizon: Period = { start: "2027-01-01", end: "2027-12-31" }
const binding = { kind: "ui", binding: { installationId: "install", projectId: "project", principalRef: "principal", requestId: "request", policyVersion: "policy", accessRevision: "access", expiresAt: "2100-01-01T00:00:00Z" }, lease: {} } as unknown as TrustedUiContext

function decision(id: string, incarnation: string): DecisionCase {
  return { id, incarnation, version: 1, state: "draft", objective: "Choose", horizon, currency: "USD", criteria: [{ id: "cost", description: "cost", required: true }], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
}

function record(recordType: "contracts" | "projects", recordId: string, incarnation: string): BusinessEvidenceRef & { kind: "record" } {
  const evidence = { schema: "sf-evidence-v1" as const, kind: "record" as const, refId: `sf-source:${encodeURIComponent(incarnation)}:1`, installationId: "install", projectId: "project", refDigest: "", evidenceLevel: "observed" as const, target: { surface: "dashboard" as const, recordType, recordId, incarnation, version: 1, fields: ["name"], period: horizon, projectionDigest: "c".repeat(64) } }
  return { ...evidence, refDigest: digestSfEvidenceRef(evidence) }
}

function projection(evidence: BusinessEvidenceRef & { kind: "record" }, value = "Acme"): DomainProjection {
  return { context: { installationId: "install", projectId: "project", principalRef: "principal", accessRevision: "access", policyVersion: "policy", surface: "dashboard", period: horizon, currency: "USD", sourceRefs: [], capabilities: [] }, version: 1, engineVersion: "dashboard-record-v1", components: [], values: [{ id: evidence.target.fields[0]!, value, period: horizon, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" }], missing: [] }
}

function candidate(decisionCase: DecisionCase, alternativeId: string): PortfolioCandidate {
  const ref = portfolioCandidateRef({ caseRef: encodeCaseRef(decisionCase), caseVersion: decisionCase.version, alternativeId, alternativeVersion: 1 })
  const result = { id: `result-${alternativeId}`, version: 1, components: [], currency: "USD", horizon, sourceRefs: [], unresolvedConditions: [], restrictions: [], comparisonStatus: "conditioned" as const, knownSubtotal: 1, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId, alternativeVersion: 1, currency: "USD", horizon, issues: [], evaluatedSourceRefs: [], coverageState: "pending" as const, entries: [], derivedMissingCategoryIds: [] } }
  return { ref, caseRef: encodeCaseRef(decisionCase), operations: [{ kind: "replace", targetRef: `${alternativeId}:name`, amount: 1, currency: "USD" }], scenario: { baseRef: "base", operations: [{ kind: "replace", targetRef: `${alternativeId}:name`, amount: 1, currency: "USD" }], assumptions: [] }, result }
}

async function harness(options: { fenceRace?: boolean } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-campaign-test-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const access = { allowed: true, authorizeCase: true, supported: true }
  const proposalCoverageWrites = new WeakSet<object>()
  const state = createSfProductState({ persistence: store, proposalCoverageWrites, createId: () => "product-incarnation", resolveTarget: async (_request, _snapshot, _namespace, targetRef) => targetRef === "owner" ? { incarnation: "owner-incarnation" } : undefined, authorize: async () => access.allowed ? { principalRef: "principal", policyVersion: "policy", accessRevision: "access" } : undefined })
  const ownerCase = decision("owner", "owner-incarnation")
  const left = decision("left", "left-incarnation")
  const right = decision("right", "right-incarnation")
  const cases = new Map([ownerCase, left, right].map((item) => [item.id, item]))
  const seeded = await state.transaction(new Request("https://example.test/seed"), { namespace: "cases", expectedStorageVersion: 0, targetRef: ownerCase.id, targetIncarnation: ownerCase.incarnation, idempotencyKey: "seed-cases", commandDigest: digestSfValue({ seed: true }) }, async (product) => {
    for (const item of cases.values()) product.cases[item.id] = item
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok") throw new Error("seed failed")
  const contract = record("contracts", "c1", "contract-incarnation")
  const project = record("projects", "p1", "project-incarnation")
  const sources = { contractValue: "Acme", projectValue: "Plant", revoked: false, contractReads: 0 }
  const proposals = new Map([["output-1", "ab".repeat(32)]])
  const fences = (snapshots: Record<"dashboard" | "planner" | "procurement", Snapshot>) => ({ dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) })
  let operation = "campaign-operation-1"
  const campaign = createPortfolioCampaign({
    state,
    host: { requestFor: () => new Request("https://example.test/campaign"), revalidate: async () => access.allowed },
    cases: { read: async (request) => { const parsed = /case:([^:]+):([^:]+)/.exec(request.caseRef); const item = parsed ? cases.get(decodeURIComponent(parsed[1]!)) : undefined; const found = item && item.id !== "owner" ? candidate(item, item.id) : undefined; return access.allowed && access.authorizeCase && item && item.incarnation === decodeURIComponent(parsed![2]!) ? { status: "ok", value: { context: { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access", kind: "ui" }, case: { ...item, alternatives: found && found.result ? [{ id: item.id, version: 1, title: item.id, scenario: found.scenario, result: found.result }] : [], preparedChanges: [], receipts: [] }, events: [], evidenceRefs: [], checkedAt: "2026-11-13T00:00:00Z" } } : { status: "denied", reason: "case-access-unavailable" } } },
    resolveCandidate: async (ref) => { const found = [left, right].map((item) => candidate(item, item.id)).find((value) => value.ref === ref); return found && cases.get(found.caseRef.split(":")[1] ? decodeURIComponent(found.caseRef.split(":")[1]!) : "")?.version === 1 ? { status: "ok", value: found } : { status: "stale", reason: "case-changed" } },
    validateCandidate: async () => access.supported ? { status: "ok", value: true } : { status: "needs-input", reason: "unsupported-candidate-effect" },
    contracts: { issueContract: async (selection) => sources.revoked ? { status: "denied", reason: "contract-access-unavailable" } : selection.id === "c1" ? { status: "ok", value: contract.refId } : { status: "needs-input", reason: "Contract fields unavailable" }, readContractSource: async () => { sources.contractReads += 1; return sources.revoked ? { status: "denied", reason: "contract-access-unavailable" } : { status: "ok", value: projection(contract, sources.contractValue) } } },
    records: { issue: async (selection) => selection.recordType === "projects" && selection.recordId === "p1" && !sources.revoked ? { status: "ok", value: project } : { status: "denied", reason: "project-access-unavailable" }, read: async () => sources.revoked ? { status: "denied", reason: "project-access-unavailable" } : { status: "ok", value: projection(project, sources.projectValue) } },
    readSourceFences: async () => store.transactionAll ? store.transactionAll(async (snapshots) => ({ commit: false, value: fences(snapshots) })) : undefined,
    lockedSourceFences: () => { const snapshots = store.currentSnapshots?.(); if (!snapshots) return undefined; const current = fences(snapshots); return options.fenceRace ? { ...current, planner: "race" } : current },
    authorizeCase: async () => access.authorizeCase,
    operationIdentity: () => operation,
    verifyProposal: async (proposalRef) => { const outputDigest = proposals.get(proposalRef); return outputDigest ? { status: "ok", value: { outputDigest } } : { status: "unavailable", reason: "campaign-proposal-unavailable" } },
    verifyHistoricalProposal: async (proposalRef) => { const outputDigest = proposals.get(proposalRef); return outputDigest ? { status: "ok", value: { outputDigest } } : { status: "unavailable", reason: "campaign-proposal-unavailable" } },
    proposalCoverageWrites,
    now: () => "2026-11-13T00:00:00Z",
  })
  const edit = (): PortfolioCampaignEdit => ({ ownerCase: { id: ownerCase.id, incarnation: ownerCase.incarnation, version: 1 }, expectedVersion: 0, candidateRefs: [{ ref: candidate(left, left.id).ref, selectionOrder: 1 }, { ref: candidate(right, right.id).ref, selectionOrder: 2 }], constraints: ["cost"], scope: { horizon, currency: "USD" }, explorationLimit: 8, proposalRefs: ["output-1"], commitments: [{ kind: "contract", id: "c1", fields: ["name"], period: horizon }, { kind: "project", page: "Projects", recordId: "p1", fields: ["name"], period: horizon }] })
  return { directory, store, state, access, cases, sources, proposals, campaign, edit, setOperation: (value: string) => { operation = value } }
}

test("multi-case campaign keeps owner separate, provisional AI, order and exact retry", async () => {
  const world = await harness()
  try {
    const native = { kind: "native" } as unknown as TrustedUiContext
    expect((await world.campaign.save(world.edit(), native)).status).toBe("denied")
    expect((await world.campaign.save({ ...world.edit(), scope: { horizon, currency: "EUR" } }, binding)).status).toBe("needs-input")
    expect((await world.campaign.save({ ...world.edit(), explorationLimit: 0 }, binding)).status).toBe("denied")
    world.access.supported = false
    expect((await world.campaign.save(world.edit(), binding)).status).toBe("needs-input")
    world.access.supported = true
    const saved = await world.campaign.save(world.edit(), binding)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") return
    expect(saved.value.ownerCase).toEqual({ id: "owner", incarnation: "owner-incarnation", version: 1 })
    expect(saved.value.candidates.map((item) => item.caseRef.id)).toEqual(["left", "right"])
    expect(saved.value.candidates.map((item) => item.selectionOrder)).toEqual([1, 2])
    expect(saved.value.candidates.some((item) => "weight" in item)).toBe(false)
    expect(saved.value.explorationLimit).toBe(8)
    expect(saved.value.proposals).toEqual([{ outputRef: "output-1", outputDigest: "ab".repeat(32), state: "provisional" }])
    expect(saved.value.version).toBe(1)
    const replay = await world.campaign.save(world.edit(), binding)
    expect(replay).toEqual(saved)
    const changed = await world.campaign.save({ ...world.edit(), constraints: ["timing"] }, binding)
    expect(changed).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
    const current = await world.campaign.read(saved.value.ownerCase, binding)
    expect(current.status).toBe("ok")
    if (current.status === "ok") expect(current.value.version).toBe(1)
    world.setOperation("campaign-operation-2")
    expect((await world.campaign.save({ ...world.edit(), expectedVersion: 0 }, binding)).status).toBe("stale")
    const next = await world.campaign.save({ ...world.edit(), expectedVersion: 1, constraints: ["timing"] }, binding)
    expect(next.status).toBe("ok")
    if (next.status !== "ok") return
    expect(next.value.version).toBe(2)
    const original = await world.campaign.readOriginal({ ownerCase: saved.value.ownerCase, commandDigest: saved.value.commandDigest }, binding)
    expect(original.status).toBe("ok")
    if (original.status === "ok") expect(original.value).toEqual(saved.value)
    const listed = await world.campaign.list(saved.value.ownerCase, binding)
    expect(listed.status).toBe("ok")
    if (listed.status === "ok") expect(listed.value.map((item) => item.version)).toEqual([1, 2])
  } finally {
    await world.store.dispose()
    await rm(world.directory, { recursive: true, force: true })
  }
})

test("revoked and stale sources and a moved proposal do not replace the campaign", async () => {
  const world = await harness()
  try {
    const saved = await world.campaign.save(world.edit(), binding)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") return
    world.sources.revoked = true
    expect((await world.campaign.read(saved.value.ownerCase, binding)).status).toBe("denied")
    world.sources.revoked = false
    world.proposals.set("output-1", "cd".repeat(32))
    expect(await world.campaign.readOriginal({ ownerCase: saved.value.ownerCase, commandDigest: saved.value.commandDigest }, binding)).toEqual({ status: "stale", reason: "campaign-proposal-changed" })
    world.proposals.set("output-1", "ab".repeat(32))
    world.cases.get("left")!.version = 2
    expect((await world.campaign.read(saved.value.ownerCase, binding)).status).toBe("stale")
    world.cases.get("left")!.version = 1
    world.access.authorizeCase = false
    expect((await world.campaign.read(saved.value.ownerCase, binding)).status).toBe("denied")
    world.access.authorizeCase = true
    world.sources.contractValue = "Changed"
    world.sources.contractReads = 0
    const still = await world.campaign.readOriginal({ ownerCase: saved.value.ownerCase, commandDigest: saved.value.commandDigest }, binding)
    expect(still.status).toBe("stale")
  } finally {
    await world.store.dispose()
    await rm(world.directory, { recursive: true, force: true })
  }
})

test("a locked fence that differs from the pre-lock fingerprint does not commit", async () => {
  const world = await harness({ fenceRace: true })
  try {
    const saved = await world.campaign.save(world.edit(), binding)
    expect(saved).toEqual({ status: "conflict", reason: "campaign-locked-proof-unavailable" })
    expect(await world.campaign.read({ id: "owner", incarnation: "owner-incarnation", version: 1 }, binding)).toEqual({ status: "needs-input", reason: "campaign-not-created" })
  } finally {
    await world.store.dispose()
    await rm(world.directory, { recursive: true, force: true })
  }
})

test("a prior campaign is separately marked historical after the owner case advances", async () => {
  const world = await harness()
  try {
    const saved = await world.campaign.save(world.edit(), binding)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") return
    const request = new Request("https://example.test/case")
    const current = await world.state.read(request, "cases", (state) => state.cases.owner)
    if (current.status !== "ok" || !current.value) throw new Error("case unavailable")
    const changed = await world.state.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: "owner", targetIncarnation: "owner-incarnation", idempotencyKey: "advance-case", commandDigest: digestSfValue({ version: 2 }) }, async (state) => { state.cases.owner = { ...state.cases.owner!, version: 2 }; return { commit: true, value: true } })
    expect(changed.status).toBe("ok")
    world.cases.get("owner")!.version = 2
    const ownerCase = { ...saved.value.ownerCase, version: 2 }
    expect((await world.campaign.read(ownerCase, binding)).status).toBe("unavailable")
    const historical = await world.campaign.readHistorical({ ownerCase, commandDigest: saved.value.commandDigest }, binding)
    expect(historical.status === "ok" && historical.value).toEqual({ state: "historical", campaign: saved.value })
    const listed = await world.campaign.listHistorical(ownerCase, binding)
    expect(listed.status === "ok" && listed.value).toEqual([{ state: "historical", campaign: saved.value }])
  } finally {
    await world.store.dispose()
    await rm(world.directory, { recursive: true, force: true })
  }
})

test("a source fence may advance while a preserved campaign remains authorized at owner N/N", async () => {
  const world = await harness()
  try {
    const saved = await world.campaign.save(world.edit(), binding)
    expect(saved.status).toBe("ok")
    if (saved.status !== "ok") throw new Error(saved.reason)
    await world.store.transaction("planner", async (snapshot) => { snapshot.data.changedSource = { revision: 2 }; return { commit: true, value: true } })
    expect((await world.campaign.read(saved.value.ownerCase, binding)).status).toBe("stale")
    const historical = await world.campaign.readHistorical({ ownerCase: saved.value.ownerCase, commandDigest: saved.value.commandDigest }, binding)
    expect(historical.status === "ok" && historical.value).toEqual({ state: "historical", campaign: saved.value })
    world.sources.contractValue = "Changed commitment"
    expect((await world.campaign.readHistorical({ ownerCase: saved.value.ownerCase, commandDigest: saved.value.commandDigest }, binding)).status).not.toBe("ok")
    world.sources.contractValue = "Acme"
    world.access.allowed = false
    expect((await world.campaign.readHistorical({ ownerCase: saved.value.ownerCase, commandDigest: saved.value.commandDigest }, binding)).status).toBe("denied")
  } finally {
    await world.store.dispose()
    await rm(world.directory, { recursive: true, force: true })
  }
})
