import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCase, ScenarioResult } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { sfRunSourceFence } from "../../../product/ai/run-store.ts"
import { createPortfolioCampaign, type PortfolioCampaignEdit } from "../../../product/portfolio/campaign.ts"
import { createDecisionCandidateResolver, portfolioCandidateRef } from "../../../product/portfolio/candidates.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

const routes = ["read", "readOriginal", "readHistorical", "list", "listHistorical"] as const
for (const route of routes) for (const ending of ["finished", "replacement"] as const) {
  test(`campaign ${route} retains its original UI request after the last callback (${ending})`, async () => {
    const world = await fixture()
    try {
      const saved = world.saved
      if (!saved) throw new Error("Persisted campaign unavailable")
      const context = await world.admit(`read-${route}-${ending}`)
      const source = world.host.requestFor(context)
      if (!source) throw new Error("Admitted campaign request unavailable")
      const read = (trusted: TrustedUiContext) => {
        const ownerCase = saved.ownerCase
        const selected = { ownerCase, commandDigest: saved.commandDigest }
        if (route === "read") return world.campaign.read(ownerCase, trusted)
        if (route === "readOriginal") return world.campaign.readOriginal(selected, trusted)
        if (route === "readHistorical") return world.campaign.readHistorical(selected, trusted)
        if (route === "list") return world.campaign.list(ownerCase, trusted)
        return world.campaign.listHistorical(ownerCase, trusted)
      }
      world.controls.checks = 0
      const positive = await read(context)
      expect(positive.status).toBe("ok")
      if (positive.status !== "ok") throw new Error("Positive campaign read unavailable")
      const lastCheck = world.controls.checks
      expect(lastCheck).toBeGreaterThan(0)
      const before = await world.observe()
      const replacement: { context?: TrustedUiContext } = {}
      let ended = 0
      world.controls.checks = 0
      world.controls.afterCheck = async (observed) => {
        if (observed !== context || world.controls.checks !== lastCheck) return
        // Authorization has already returned true. End the actual private lease
        // without changing its principal, the stored data or the transport signal.
        world.ui.finish(context)
        if (ending === "replacement") replacement.context = await world.admit(`replacement-${route}`)
        ended++
      }
      const denied = await read(context)
      expect({ checks: world.controls.checks, ended }).toEqual({ checks: lastCheck, ended: 1 })
      const reason = route === "read" || route === "readOriginal" ? "campaign-source-changed" : route === "list" ? "campaign-list-changed" : "campaign-history-changed"
      expect(denied).toEqual({ status: "stale", reason })
      expect(denied).not.toHaveProperty("value")
      expect(source.signal.aborted).toBe(false)
      expect(world.host.requestFor(context)).toBeUndefined()
      expect(await world.ui.revalidate(context)).toBe(false)
      world.controls.afterCheck = undefined
      if (replacement.context) {
        expect(replacement.context.binding.principalRef).toBe(context.binding.principalRef)
        expect(world.host.requestFor(replacement.context)).not.toBe(source)
        expect(await world.ui.revalidate(replacement.context)).toBe(true)
      }
      expect(await world.observe()).toEqual(before)
      const renewed = replacement.context ?? await world.admit(`renewed-${route}`)
      expect(await read(renewed)).toEqual(positive)
    } finally { await world.close() }
  }, 120000)
}

for (const ending of ["finished", "replacement"] as const) {
  test(`absent campaign retains the UI request after its final namespace authorization (${ending})`, async () => {
    const world = await fixture({ createCampaign: false })
    try {
      const context = await world.admit(`absent-${ending}`)
      const source = world.host.requestFor(context)
      if (!source) throw new Error("Admitted campaign request unavailable")
      expect(await world.campaign.read(world.ownerCase, context)).toEqual({ status: "needs-input", reason: "campaign-not-created" })
      const before = await world.observe()
      const replacement: { context?: TrustedUiContext } = {}
      let namespaceChecks = 0
      let ended = 0
      world.controls.afterNamespaceAuthorization = async (request, namespace, mode) => {
        if (request !== source || namespace !== "preferences" || mode !== "read" || ++namespaceChecks !== 2) return
        world.ui.finish(context)
        if (ending === "replacement") replacement.context = await world.admit("absent-replacement")
        ended++
      }
      const denied = await world.campaign.read(world.ownerCase, context)
      expect({ namespaceChecks, ended }).toEqual({ namespaceChecks: 2, ended: 1 })
      expect(denied).toEqual({ status: "stale", reason: "campaign-source-changed" })
      expect(denied).not.toHaveProperty("value")
      expect(source.signal.aborted).toBe(false)
      expect(world.host.requestFor(context)).toBeUndefined()
      expect(await world.ui.revalidate(context)).toBe(false)
      world.controls.afterNamespaceAuthorization = undefined
      if (replacement.context) {
        expect(replacement.context.binding.principalRef).toBe(context.binding.principalRef)
        expect(world.host.requestFor(replacement.context)).not.toBe(source)
        expect(await world.ui.revalidate(replacement.context)).toBe(true)
      }
      expect(await world.observe()).toEqual(before)
      const renewed = replacement.context ?? await world.admit("absent-renewed")
      expect(await world.campaign.read(world.ownerCase, renewed)).toEqual({ status: "needs-input", reason: "campaign-not-created" })
    } finally { await world.close() }
  }, 120000)
}

async function fixture(options: { createCampaign?: boolean } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-campaign-request-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const contexts = new Map<Request, TrustedUiContext>()
  try {
    const identity = { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
    const controls: { checks: number; afterCheck?: (context: TrustedUiContext) => Promise<void>; afterNamespaceAuthorization?: (request: Request, namespace: string, mode: "read" | "write") => Promise<void> } = { checks: 0 }
    const ui = createSfUiAuthority({ authorize: async () => identity, commandIdentity: async (request) => request.headers.get("x-command-id") ?? undefined, createId: randomUUID, now: Date.now, privateCommands: ["wp13-campaign-request"] })
    const admit = async (command: string) => {
      const request = new Request("https://example.test/campaign", { headers: { "x-command-id": command } })
      const digest = digestSfValue({ command })
      const admitted = await ui.admit(request, "wp13-campaign-request", digest)
      if (admitted.status !== "ok" || !await ui.validate(admitted.value, "wp13-campaign-request", digest)) throw new Error("Campaign UI admission unavailable")
      contexts.set(request, admitted.value)
      return admitted.value
    }
    const host: Pick<DomainPortHost, "requestFor" | "revalidate"> = {
      requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: async (context) => {
        if (context.kind !== "ui") return false
        const allowed = await ui.revalidate(context)
        if (allowed) { controls.checks++; await controls.afterCheck?.(context) }
        return allowed
      },
    }
    const writes = new WeakSet<object>()
    const state = createSfProductState({ persistence: store, proposalCoverageWrites: writes, createId: randomUUID, authorize: async (request, _snapshot, namespace, mode) => {
      const context = contexts.get(request)
      const authority = context && await ui.revalidate(context) ? context.binding : undefined
      if (authority) await controls.afterNamespaceAuthorization?.(request, namespace, mode)
      return authority
    }, resolveTarget: async (_request, _snapshot, _namespace, targetRef) => targetRef === "campaign-owner" ? { incarnation: "campaign-incarnation" } : undefined })
    const ownerCase = { id: "campaign-owner", incarnation: "campaign-incarnation", version: 1 }
    const horizon = { start: "2027-01-01", end: "2027-12-31" }
    // A conditional fixture alternative supplies no confirmed financial result.
    // This proof covers real C08/lease retention, not Planner calculation or C17.
    const result: ScenarioResult = { id: "fixture-result", version: 1, components: [], currency: "USD", horizon, sourceRefs: [], restrictions: [], unresolvedConditions: ["training missing"], comparisonStatus: "conditioned", knownSubtotal: 1, total: null, costCoverage: { basisId: "basis", basisVersion: 1, alternativeId: "alternative", alternativeVersion: 1, currency: "USD", horizon, entries: [], issues: [], evaluatedSourceRefs: [], coverageState: "pending", derivedMissingCategoryIds: ["training"] } }
    const decision: DecisionCase = { ...ownerCase, state: "comparing", objective: "Review campaign", horizon, currency: "USD", criteria: [{ id: "cost", description: "Preserve cost", required: true }], participants: [identity.principalRef], sourceRefs: [], alternatives: [{ id: "alternative", version: 1, title: "Conditional alternative", scenario: { baseRef: "fixture-base", operations: [{ kind: "replace", targetRef: "line:1", amount: 1, currency: "USD" }], assumptions: [] }, result }], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seed = await admit("seed-campaign")
    const seedRequest = host.requestFor(seed)
    if (!seedRequest) throw new Error("Campaign seed request unavailable")
    const seeded = await state.transaction(seedRequest, { namespace: "cases", expectedStorageVersion: 0, targetRef: ownerCase.id, targetIncarnation: ownerCase.incarnation, idempotencyKey: "seed-campaign", commandDigest: digestSfValue(decision) }, async (value) => { value.cases[ownerCase.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok" || !seeded.value) throw new Error("Campaign C08 seed failed")
    const unused = async (): Promise<never> => { throw new Error("Unexpected campaign dependency") }
    const evidence: BusinessContextService = { context: async () => [], resolve: unused, recall: async () => [], emitFromLedger: unused }
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: ownerCase.id, incarnation: ownerCase.incarnation }, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), verifyScenarioOperations: async () => true, evidence, createId: randomUUID, now: () => "2027-01-01T00:00:00Z" })
    const fences = (snapshots: Record<"dashboard" | "planner" | "procurement", Snapshot>) => ({ dashboard: sfRunSourceFence(snapshots.dashboard), planner: sfRunSourceFence(snapshots.planner), procurement: sfRunSourceFence(snapshots.procurement) })
    const transactionAll = store.transactionAll?.bind(store)
    if (!transactionAll) throw new Error("Campaign source snapshots unavailable")
    const campaign = createPortfolioCampaign({ state, host, cases, resolveCandidate: createDecisionCandidateResolver(cases), validateCandidate: async () => ({ status: "ok", value: true }), contracts: { issueContract: unused, readContractSource: unused }, records: { issue: unused, read: unused }, readSourceFences: () => transactionAll(async (snapshots) => ({ commit: false, value: fences(snapshots) })), lockedSourceFences: () => { const snapshots = store.currentSnapshots?.(); return snapshots ? fences(snapshots) : undefined }, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef), operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, proposalCoverageWrites: writes, now: () => "2027-01-01T00:00:00Z" })
    const edit: PortfolioCampaignEdit = { ownerCase, expectedVersion: 0, candidateRefs: [{ ref: portfolioCandidateRef({ caseRef: encodeCaseRef(decision), caseVersion: 1, alternativeId: "alternative", alternativeVersion: 1 }), selectionOrder: 1 }], constraints: ["cost"], scope: { horizon, currency: "USD" }, explorationLimit: 1, proposalRefs: [], commitments: [] }
    const saved = options.createCampaign === false ? undefined : await campaign.save(edit, await admit("save-campaign"))
    if (saved && saved.status !== "ok") throw new Error(`Campaign save unavailable: ${JSON.stringify(saved)}`)
    const observer = await admit("observe-campaign")
    const observerRequest = host.requestFor(observer)
    if (!observerRequest) throw new Error("Campaign observer request unavailable")
    return { campaign, ownerCase, saved: saved?.status === "ok" ? saved.value : undefined, state, host, ui, admit, controls, observe: () => state.read(observerRequest, "cases", (value) => value), close: async () => { controls.afterCheck = undefined; controls.afterNamespaceAuthorization = undefined; for (const context of contexts.values()) ui.finish(context); await store.dispose(); await rm(directory, { recursive: true, force: true }) } }
  } catch (error) { await store.dispose(); await rm(directory, { recursive: true, force: true }); throw error }
}
