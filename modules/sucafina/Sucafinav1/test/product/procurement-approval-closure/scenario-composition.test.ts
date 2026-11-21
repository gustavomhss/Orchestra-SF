import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { roleMap } from "../../../runtime/admin.ts"
import { object } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/procurement.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../product/contracts/operations.ts"
import type { PortResult } from "../../../product/contracts/ports.ts"
import { createChoiceSnapshot } from "../../../product/decisions/choice.ts"
import { prepareDomainChange } from "../../../product/decisions/prepared-change.ts"
import { createSfDecisionResultStore } from "../../../product/decisions/result-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { comparePlannerScenarios } from "../../../product/planner/comparison.ts"
import { createC12ProcurementProposal, verifyC12ProcurementProposal } from "../../../product/procurement/c12-proposal.ts"
import type { C12ProposalAction, C12ProposalHost, C12ProposalRecord } from "../../../product/procurement/c12-proposal.ts"
import { createProcurementScenarioDraftPreparation, createProcurementScenarioPreparation } from "../../../product/procurement/scenario-preparation.ts"
import { scenarioAt, scenarioPeriod } from "../procurement-decision-producer/fixture.ts"
import { createApprovalFixture } from "./fixture.ts"

test("a persisted C08 choice supplies the exact draft value while remaining distinct from approval and C12 Apply", async () => {
  const fixture = await createApprovalFixture()
  try {
    const draft = await fixture.review()
    const request: ScenarioRequest = { baseRef: draft.sourceRef, operations: [{ kind: "replace", targetRef: draft.sourceRef, amount: 140, currency: "USD", period: scenarioPeriod }], assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", evidenceRefs: [], state: "hypothetical" }] }
    const businessBeforePreview = await fixture.snapshot()
    const previewWrites = fixture.writes.length
    const baseline = await fixture.producer.preview({ ...request, operations: [] }, draft.context)
    const preview = await fixture.producer.preview(request, draft.context)
    if (baseline.status !== "ok" || preview.status !== "ok") throw new Error("Current Procurement scenario unavailable")
    expect(baseline.value.scenario.knownSubtotal).toBe(100)
    expect(preview.value.scenario).toMatchObject({ knownSubtotal: 140, total: null, comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" } })
    expect(preview.value.scenario.sourceRefs).toEqual([draft.review.source])
    expect(await fixture.snapshot()).toEqual(businessBeforePreview)
    expect(fixture.writes).toHaveLength(previewWrites)

    const caseRef = { id: "approval-composition-case", incarnation: "approval-composition-incarnation", version: 1 }
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Review an explicit draft estimate of 140 USD", currency: "USD", horizon: scenarioPeriod, criteria: [{ id: "amount", description: "Known estimate", required: true }], participants: ["alice"], sourceRefs: [draft.review.source], alternatives: [{ id: preview.value.assessment.alternativeId, version: preview.value.assessment.alternativeVersion, title: "Reviewed 140 USD proposal", scenario: request, result: preview.value.scenario }], costCoverageBases: [preview.value.basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const comparison = comparePlannerScenarios({ baselineRef: baseline.value.scenario.id, alternativeRef: preview.value.scenario.id, baselineCoverageRef: baseline.value.coverageRef, alternativeCoverageRef: preview.value.coverageRef, baseline: baseline.value.scenario, alternative: preview.value.scenario })
    const chosen = createChoiceSnapshot({ case: decision, alternativeId: preview.value.assessment.alternativeId, alternativeVersion: preview.value.assessment.alternativeVersion, comparison, criteria: ["amount"], values: [{ criterionRef: "amount", value: 140, unit: "currency", currency: "USD", horizon: scenarioPeriod }], evidenceRefs: [draft.review.source], id: "human-choice-140", principalRef: "alice", reason: "Prepare this estimate for a separate draft edit", at: scenarioAt })
    if (chosen.status !== "ok") throw new Error(`Human choice snapshot unavailable: ${chosen.reason}`)
    expect(chosen.choice).toMatchObject({ comparisonStatus: "conditioned", costCoverage: { coverageState: "pending" }, result: { knownSubtotal: 140, total: null } })
    const state = createSfProductState({ persistence: fixture.persistence, createId: randomUUID, resolveTarget: async (_request, _snapshot, namespace, target) => namespace === "cases" && target === caseRef.id ? { incarnation: caseRef.incarnation } : undefined, authorize: async (incoming) => {
      const principal = await fixture.host.authenticate(incoming)
      return principal ? { principalRef: principal.id, accessRevision: "access-1", policyVersion: "policy-1" } : undefined
    } })
    const seeded = await state.transaction(draft.request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "persist-fixture-choice", commandDigest: digestSfValue(chosen.choice), targetRef: caseRef.id, targetIncarnation: caseRef.incarnation }, async (current) => {
      current.cases[caseRef.id] = { ...decision, state: "chosen", choices: [chosen.choice] }
      return { commit: true, value: chosen.choice.id }
    })
    expect(seeded.status).toBe("ok")
    const results = createSfDecisionResultStore({ state, host: fixture.host, authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && fixture.host.revalidate(context), verifySources: async (_value, refs, context) => {
      const verified = await Promise.all(refs.map(async (ref) => {
        const source = await fixture.sources.resolveForPreparation(ref.refId, context)
        return source.status === "ok" && digestSfValue(source.value.evidence) === digestSfValue(ref)
      }))
      return refs.length > 0 && verified.every(Boolean)
    }, createId: randomUUID, now: () => scenarioAt })
    const write = { kind: "scenario" as const, result: preview.value.scenario, caseRef, requestDigest: digestSfValue(request), sourceRefs: preview.value.scenario.sourceRefs, idempotencyKey: "persist-approved-cycle-scenario" }
    const stored = await results.write(write, draft.context)
    if (stored.status !== "ok") throw new Error(`Canonical scenario persistence unavailable: ${stored.reason}`)
    const storedWrites = fixture.writes.length
    expect(await results.write(write, draft.context)).toEqual(stored)
    expect(fixture.writes).toHaveLength(storedWrites)
    expect(await results.read({ kind: "scenario", resultRef: stored.value.resultRef }, draft.context)).toEqual(stored)
    const persisted = await state.read(draft.request, "cases", (current) => structuredClone(current))
    if (persisted.status !== "ok") throw new Error("Persisted C08 case unavailable")
    expect(Object.keys(object(persisted.value.decisionResults))).toHaveLength(1)
    const choice = persisted.value.cases[caseRef.id]!.choices[0]!
    expect(choice).toEqual(chosen.choice)
    expect(persisted.value.cases[caseRef.id]?.receipts).toEqual([])
    expect(persisted.value.cases[caseRef.id]?.preparedChanges).toEqual([])

    const prepareDraft = createProcurementScenarioDraftPreparation({ host: fixture.host })
    const prepareC12 = createProcurementScenarioPreparation({ host: fixture.host, sources: fixture.sources })
    const operation = choice.scenario.operations[0]!
    const beforePreparation = await fixture.snapshot()
    const writes = fixture.writes.length
    const prepared = await prepareDraft({ operation, choice, review: draft.review }, draft.context)
    if (prepared.status !== "ok") throw new Error(`Chosen draft plan unavailable: ${prepared.reason}`)
    expect(prepared.value).toMatchObject({ kind: "procurement-pr-lifecycle-v1", approvalGranted: false, receipt: null, requiresExplicitAction: true, command: { page: "Requests", action: "save", version: draft.review.domainVersion, values: { pr: { estAmount: 140 } } } })
    expect(await prepareDraft({ operation: { ...operation, amount: 160 }, choice, review: draft.review }, draft.context)).toEqual({ status: "denied", reason: "operation-not-in-choice" })
    expect(await prepareDraft({ operation, choice: { ...choice, result: { ...choice.result, currency: "EUR" } }, review: draft.review }, draft.context)).toEqual({ status: "needs-input", reason: "requisition-basis-mismatch" })
    expect(await prepareDraft({ operation, choice: { ...choice, result: { ...choice.result, sourceRefs: [] } }, review: draft.review }, draft.context)).toEqual({ status: "denied", reason: "preview-source-unavailable" })
    // C12 may now prepare the same canonical draft save, not a submit or approval.
    const c12 = await prepareC12({ operation, choice, operationId: "c12-approved-draft-preparation", idempotencyKey: "c12-approved-draft-preparation" }, draft.context)
    if (c12.status !== "ok") throw new Error(`C12 draft producer unavailable: ${c12.status}`)
    expect(c12.value.command.command).toMatchObject({ page: "Requests", action: "save", confirmed: false, values: { pr: { estAmount: 140 } } })
    expect(c12.value.command.requiredAuthority).toContain("procurement:write")
    expect(c12.value.command.expectedVersion).toBe(draft.review.domainVersion)
    expect(c12.value.targetEvidence).toEqual(draft.review.source)
    expect(c12.value.preview).toEqual(choice.result)
    expect(await fixture.snapshot()).toEqual(beforePreparation)
    expect(await state.read(draft.request, "cases", (current) => structuredClone(current))).toEqual(persisted)
    expect(fixture.writes).toHaveLength(writes)

    expect((await fixture.post("alice", prepared.value.command)).status).toBe(200)
    const saved = await fixture.snapshot()
    const savedWrites = fixture.writes.length
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { estAmount: 140 }, prApproval: null })
    expect((await prepareDraft({ operation, choice, review: draft.review }, draft.context)).status).toBe("stale")
    expect((await fixture.post("alice", prepared.value.command)).status).toBe(409)
    expect(await fixture.snapshot()).toEqual(saved)
    expect(fixture.writes).toHaveLength(savedWrites)

    const submission = await fixture.review()
    expect(await fixture.lifecycle.prepare({ review: submission.review, action: { kind: "save-estimate", amount: 140 } }, submission.context)).toEqual({ status: "needs-input", reason: "requisition-already-matches" })
    const submit = await fixture.lifecycle.prepare({ review: submission.review, action: { kind: "submit-current", amount: 140 } }, submission.context)
    if (submit.status !== "ok") throw new Error("Fresh canonical submission unavailable")
    expect((await fixture.post("alice", submit.value.command)).status).toBe(200)
    const approval = await fixture.review("bob")
    const approve = await fixture.lifecycle.prepare({ review: approval.review, action: { kind: "approve-submitted", amount: 140, holderId: "bob", comment: "Approve this submitted snapshot" } }, approval.context)
    if (approve.status !== "ok") throw new Error("Fresh canonical approval unavailable")
    expect((await fixture.post("bob", approve.value.command)).status).toBe(200)
    expect(await fixture.current()).toMatchObject({ status: "sourcing", pr: { estAmount: 140 }, prApproval: { amount: 140 } })

    // This checks stored provenance bytes, not authorization to reuse the old source as a current preview.
    expect(await state.read(draft.request, "cases", (current) => structuredClone(current))).toEqual(persisted)
    expect(choice.result).toEqual(preview.value.scenario)
    expect(choice.result.sourceRefs).toEqual([draft.review.source])
    expect(choice.result.total).toBeNull()
    expect(choice.costCoverage.coverageState).toBe("pending")
  } finally { await fixture.dispose() }
})

test("M31: the unwritten 140 USD needs every canonical matrix approval before a separate atomic C12 Apply", async () => {
  const fixture = await createApprovalFixture()
  try {
    const supportsAll = fixture.persistence.transactionAll
    if (!supportsAll) throw new Error("Installation transaction unavailable")
    const settingsVersion = (await fixture.snapshot()).versions.settings!.version
    expect((await fixture.execute({ id: "admin", canWrite: true, roles: ["admin"] }, { page: "Settings", action: "save", version: settingsVersion, values: {
      prApprovalMode: "matrix", blockSelfApproval: true,
      levels: [{ id: "peer", name: "Peer", threshold: 0, holderId: null }, { id: "finance", name: "Finance", threshold: 120, holderId: "carol" }],
    } })).ok).toBe(true)
    const draft = await fixture.review()
    const operation = { kind: "replace" as const, targetRef: draft.sourceRef, amount: 140, currency: "USD", period: scenarioPeriod }
    const scenario: ScenarioRequest = { baseRef: draft.sourceRef, operations: [operation], assumptions: [{ id: "procurement-cost-inventory", value: "renewal-transition-v1", evidenceRefs: [], state: "hypothetical" }] }
    const baseline = await fixture.producer.preview({ ...scenario, operations: [] }, draft.context)
    const preview = await fixture.producer.preview(scenario, draft.context)
    if (baseline.status !== "ok" || preview.status !== "ok") throw new Error("Proposal scenario unavailable")
    const caseRef = { id: "m31-case", incarnation: "m31-incarnation", version: 1 }
    const decision: DecisionCase = { ...caseRef, state: "comparing", objective: "Approve an unwritten 140 USD estimate", currency: "USD", horizon: scenarioPeriod, criteria: [{ id: "amount", description: "Known estimate", required: true }], participants: ["alice"], sourceRefs: [draft.review.source], alternatives: [{ id: preview.value.assessment.alternativeId, version: preview.value.assessment.alternativeVersion, title: "140 USD proposal", scenario, result: preview.value.scenario }], costCoverageBases: [preview.value.basis], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const comparison = comparePlannerScenarios({ baselineRef: baseline.value.scenario.id, alternativeRef: preview.value.scenario.id, baselineCoverageRef: baseline.value.coverageRef, alternativeCoverageRef: preview.value.coverageRef, baseline: baseline.value.scenario, alternative: preview.value.scenario })
    const chosen = createChoiceSnapshot({ case: decision, alternativeId: preview.value.assessment.alternativeId, alternativeVersion: preview.value.assessment.alternativeVersion, comparison, criteria: ["amount"], values: [{ criterionRef: "amount", value: 140, unit: "currency", currency: "USD", horizon: scenarioPeriod }], evidenceRefs: [draft.review.source], id: "m31-choice", principalRef: "alice", reason: "Send the unwritten estimate for approval", at: scenarioAt })
    if (chosen.status !== "ok") throw new Error(`Proposal choice unavailable: ${chosen.reason}`)
    const prepared = await createProcurementScenarioPreparation({ host: fixture.host, sources: fixture.sources })({ operation, choice: chosen.choice, operationId: "m31-command", idempotencyKey: "m31-key" }, draft.context)
    if (prepared.status !== "ok") throw new Error(`Proposal command unavailable: ${prepared.reason}`)
    const choiceCase: DecisionCase = { ...decision, version: 2, state: "chosen", choices: [chosen.choice] }
    const change = prepareDomainChange({ case: choiceCase, expectedCaseVersion: 2, choiceId: chosen.choice.id, command: prepared.value.command, preview: prepared.value.preview, id: "m31-change" })
    if (change.status !== "ok") throw new Error(`Proposal change unavailable: ${change.reason}`)
    const storedCase = { ...choiceCase, version: 3, preparedChanges: [change.change] }
    const selector = { caseRef: { ...caseRef, version: 3 }, choiceId: chosen.choice.id, changeId: change.change.id }
    await supportsAll(async (snapshots) => {
      snapshots.dashboard.data.m31Case = storedCase
      return { commit: true, value: true }
    })

    // Synthetic identities and host-private SQLite adapter; the UI lease, domain, and matrix are real.
    const gate = { failPersist: false, revokeOnConfirmation: false, revoked: false }
    const idFor = (request: Request) => request.headers.get("authorization")?.slice("Bearer ".length) ?? ""
    const ui = createSfUiAuthority({ privateCommands: ["m31-review", "m31-advance", "m31-apply"], authorize: async (request) => {
      const id = idFor(request)
      return gate.revoked || !["alice", "bob", "carol"].includes(id) ? undefined : { installationId: draft.context.binding.installationId, projectId: draft.context.binding.projectId, principalRef: id, policyVersion: draft.context.binding.policyVersion, accessRevision: draft.context.binding.accessRevision }
    }, commandIdentity: async () => randomUUID(), createId: randomUUID, now: Date.now })
    const adapter: C12ProposalHost = {
      ...fixture.host,
      authenticate: async (request) => idFor(request) === "carol" ? { id: "carol", canWrite: true, roles: [{ surface: "procurement", role: "approver" }] } : fixture.host.authenticate(request),
      requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
      authorizeHuman: async (context, selected, action) => {
        if (gate.revokeOnConfirmation) gate.revoked = true
        return ui.matchesIntent(context, "m31-advance", digestSfValue({ selector: selected, action }))
      },
      transaction: (_selector, _context, request, work) => supportsAll(async (snapshots) => work({
        procurement: snapshots.procurement,
        decision: snapshots.dashboard.data.m31Case as DecisionCase,
        record: snapshots.dashboard.data.m31Record as C12ProposalRecord | undefined,
        persist: (record) => {
          snapshots.dashboard.data.m31Record = record
          return !gate.failPersist
        },
      }), { signal: request.signal }),
    }
    const proposal = createC12ProcurementProposal(adapter)
    const lease = async (id: string, action?: C12ProposalAction) => {
      const request = new Request("https://scenario.invalid/m31", { method: action ? "POST" : "GET", headers: { authorization: `Bearer ${id}` } })
      const command = action ? "m31-advance" : "m31-review"
      const digest = digestSfValue(action ? { selector, action } : { selector })
      const admitted = await ui.admit(request, command, digest)
      if (admitted.status !== "ok" || !await ui.validate(admitted.value, command, digest)) throw new Error("Proposal test lease unavailable")
      return admitted.value
    }
    const review = async (id: string) => proposal.review(selector, await lease(id))
    const advance = async (id: string, kind: C12ProposalAction["kind"], reviewDigest: string) => {
      const action = { kind, reviewDigest }
      return proposal.advance(selector, action, await lease(id, action))
    }
    // Test composition only: the real domain write follows the predicate under the same SQLite lock.
    const attemptApply = async (id = "alice") => {
      const request = new Request("https://scenario.invalid/m31", { method: "POST", headers: { authorization: `Bearer ${id}` } })
      const digest = digestSfValue({ selector, apply: true })
      const admitted = await ui.admit(request, "m31-apply", digest)
      if (admitted.status !== "ok" || !await ui.validate(admitted.value, "m31-apply", digest)) throw new Error("Apply test lease unavailable")
      return supportsAll<PortResult<{ proposalDigest: string }>>(async (snapshots) => {
        const principal = await adapter.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshots.procurement, "procurement") })
        if (!principal || !await ui.revalidate(admitted.value) || !ui.matchesIntent(admitted.value, "m31-apply", digest)) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
        const actor = { id: principal.id, canWrite: principal.canWrite, roles: principal.roles.filter((role) => role.surface === "procurement").map((role) => role.role) }
        const decision = snapshots.dashboard.data.m31Case as DecisionCase
        const record = snapshots.dashboard.data.m31Record as C12ProposalRecord | undefined
        const proof = verifyC12ProcurementProposal({ procurement: snapshots.procurement, decision, record, selector, context: admitted.value, actor })
        if (proof.status !== "ok") return { commit: false, value: proof }
        const effect = domain.execute(snapshots.procurement, actor, decision.preparedChanges[0]!.operation.command, await adapter.environment(request))
        if (!effect.ok || gate.failPersist) return { commit: false, value: { status: "unavailable", reason: "test-apply-not-persisted" } }
        return { commit: true, value: proof }
      }, { signal: request.signal })
    }

    const original = await fixture.snapshot()
    const unsubmitted = await review("alice")
    if (unsubmitted.status !== "ok") throw new Error(`Proposal review unavailable: ${unsubmitted.reason}`)
    expect(unsubmitted.value).toMatchObject({ state: "unsubmitted", currentAmount: 100, amount: 140, currency: "USD", domainApplied: false, allowedActions: ["submit"] })
    expect(await attemptApply()).toEqual({ status: "denied", reason: "proposal-approval-required" })
    expect((await proposal.review({ ...selector, caseRef: { ...selector.caseRef, version: 2 } }, await lease("alice"))).status).toBe("stale")
    const submitted = await advance("alice", "submit", unsubmitted.value.reviewDigest)
    if (submitted.status !== "ok") throw new Error(`Proposal submit unavailable: ${submitted.reason}`)
    expect(submitted.value).toMatchObject({ proposalDigest: unsubmitted.value.proposalDigest, state: "pending", step: { index: 0, levelId: "peer", holderId: null }, allowedActions: [], domainApplied: false })
    expect((await advance("alice", "approve", submitted.value.reviewDigest)).status).toBe("denied")
    expect(await fixture.snapshot()).toEqual(original)

    const peer = await review("bob")
    if (peer.status !== "ok") throw new Error(`Peer approval unavailable: ${peer.reason}`)
    expect(peer.value.allowedActions).toEqual(["approve"])
    const first = await advance("bob", "approve", peer.value.reviewDigest)
    if (first.status !== "ok") throw new Error(`Peer did not approve: ${first.reason}`)
    expect(first.value).toMatchObject({ state: "pending", step: { index: 1, levelId: "finance", holderId: "carol" }, domainApplied: false })
    fixture.actors.bob!.roles = ["admin"]
    expect((await advance("bob", "approve", peer.value.reviewDigest)).status).toBe("denied")
    expect(await attemptApply()).toEqual({ status: "denied", reason: "proposal-approval-required" })
    expect(await fixture.snapshot()).toEqual(original)

    const finance = await review("carol")
    if (finance.status !== "ok") throw new Error(`Finance approval unavailable: ${finance.reason}`)
    gate.revokeOnConfirmation = true
    expect((await advance("carol", "approve", finance.value.reviewDigest)).status).toBe("denied")
    gate.revokeOnConfirmation = false
    gate.revoked = false
    expect(await review("carol")).toEqual(finance)
    const approved = await advance("carol", "approve", finance.value.reviewDigest)
    expect(approved).toMatchObject({ status: "ok", value: { state: "approved", proposalDigest: unsubmitted.value.proposalDigest, domainApplied: false } })
    expect(await fixture.snapshot()).toEqual(original)

    const ready = await review("alice")
    if (ready.status !== "ok") throw new Error(`Apply review unavailable: ${ready.reason}`)
    expect(ready.value).toMatchObject({ state: "approved", currentAmount: 100, allowedActions: [], domainApplied: false })
    expect(await attemptApply("carol")).toEqual({ status: "denied", reason: "current-authority-unavailable" })
    gate.failPersist = true
    expect(await attemptApply()).toEqual({ status: "unavailable", reason: "test-apply-not-persisted" })
    expect(await fixture.snapshot()).toEqual(original)
    expect(await review("alice")).toEqual(ready)
    gate.failPersist = false

    expect(await attemptApply()).toEqual({ status: "ok", value: { proposalDigest: unsubmitted.value.proposalDigest } })
    const after = await fixture.snapshot()
    expect(after.versions[`requests:${fixture.requestId}`]?.version).toBe(draft.review.domainVersion + 1)
    expect(after.notices).toEqual(original.notices)
    expect(after.audit).toHaveLength(original.audit.length + 1)
    expect(await fixture.current()).toMatchObject({ status: "draft", pr: { estAmount: 140 }, prApproval: null })
    const record = await supportsAll(async (snapshots) => ({ commit: false, value: snapshots.dashboard.data.m31Record as C12ProposalRecord }))
    expect(record.events.map((event) => [event.kind, event.actor.id])).toEqual([["submit", "alice"], ["approve", "bob"], ["approve", "carol"]])
    expect((await attemptApply()).status).toBe("stale")
    expect(await fixture.snapshot()).toEqual(after)
  } finally { await fixture.dispose() }
})
