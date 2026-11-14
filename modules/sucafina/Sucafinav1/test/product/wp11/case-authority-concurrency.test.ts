import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../../../product/contracts/state.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createDecisionCaseManagement } from "../../../product/decisions/case-management.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

test("a reopened case admits a second principal and concurrent human edits preserve one commit and its receipt", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-case-authority-concurrency-"))
  await chmod(directory, 0o700)
  const origin = "https://example.test"
  const principals = new Set(["andre", "collaborator", "outsider"])
  const creationTarget = { ref: "installation:install:cases", incarnation: "installation-incarnation" }
  let sequence = 0
  const nextId = () => `identity-${++sequence}`
  const request = (principal: string, command: string) => new Request(`${origin}/app`, {
    method: "POST", headers: { origin, "x-principal": principal, "x-command": command },
  })
  const ui = createSfUiAuthority({
    authorize: async (incoming) => {
      const principalRef = incoming.headers.get("x-principal")
      return principalRef && principals.has(principalRef)
        ? { installationId: "install", projectId: "project", principalRef, policyVersion: "policy", accessRevision: "access" }
        : undefined
    },
    commandIdentity: async (incoming) => incoming.headers.get("x-command") ?? undefined,
    createId: nextId, now: () => Date.parse("2026-11-14T00:00:00Z"),
    privateCommands: ["sf-human:decisions.edit"],
  })
  const human = createSfHumanAuthority({ origin, ui })
  const host = {
    requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined,
    revalidate: (context: TrustedDomainContext) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false),
  }
  const operationIdentity = (context: TrustedDomainContext) => context.kind === "ui" ? ui.operationIdentity(context) : undefined
  const authorizeCase = async (decision: DecisionCase, context: TrustedDomainContext) =>
    decision.participants.includes(context.binding.principalRef) && await host.revalidate(context)
  const evidence: BusinessContextService = {
    context: async ({ refs }) => {
      if (refs.length) throw new Error("This lifecycle fixture has no business evidence")
      return []
    },
    resolve: async () => { throw new Error("Unexpected business evidence") }, recall: async () => [],
    emitFromLedger: async () => { throw new Error("No ledger publication in a case edit") },
  }
  let releaseEdits = () => {}
  const editsReady = new Promise<void>((resolve) => { releaseEdits = resolve })
  const arrivals = new Set<string>()
  const concurrentCommands = new Set(["edit-andre:edit", "edit-collaborator:edit"])
  const open = async () => {
    const store = await openLocalStore(directory)
    const persisted = createSfProductState({
      persistence: store, createId: nextId,
      authorize: async (incoming) => {
        const principalRef = incoming.headers.get("x-principal")
        return principalRef && principals.has(principalRef) ? { principalRef, policyVersion: "policy", accessRevision: "access" } : undefined
      },
      resolveTarget: async (_incoming, snapshot, namespace, targetRef) => {
        if (namespace !== "cases") return undefined
        if (targetRef === creationTarget.ref) return { incarnation: creationTarget.incarnation }
        const decision = (snapshot.data.__sfProductV1 as SfProductState | undefined)?.cases[targetRef]
        return decision ? { incarnation: decision.incarnation } : undefined
      },
    })
    const state: SfProductStatePort = { ...persisted, transaction: async (incoming, command, work) => {
      // Hold neither the SQLite transaction nor a snapshot lock while making both edits
      // reach the real provider with the same previously read expected storage version.
      if (concurrentCommands.has(command.idempotencyKey)) {
        arrivals.add(command.idempotencyKey)
        if (arrivals.size === concurrentCommands.size) releaseEdits()
        await editsReady
      }
      return persisted.transaction(incoming, command, work)
    } }
    const cases = createDecisionCasePort({ state, host, creationTarget, operationIdentity, authorizeCase, evidence,
      verifyScenarioOperations: async (decision, context) => decision.alternatives.length === 0 && decision.choices.length === 0 && await host.revalidate(context),
      createId: nextId, now: () => "2026-11-14T00:00:00Z" })
    const management = createDecisionCaseManagement({ state, host, authorizeCase, operationIdentity,
      authorizeEdit: (edit, context) => human.authorize(context, "decisions.edit", edit),
      verifyEvidence: async (refs, context) => refs.length === 0 && await host.revalidate(context),
      verifyEdit: (_snapshot, before, after, context) => context.kind === "ui" && ui.matchesIntent(context, "sf-human:decisions.edit", digestSfValue({
        caseRef: { id: before.id, incarnation: before.incarnation, version: before.version },
        objective: after.objective, criteria: after.criteria, sourceRefs: after.sourceRefs,
      })),
    })
    return { store, state, cases, management }
  }
  const admitCapability = async (principal: string, command: string, operation: "sf_case_draft" | "sf_case_read", payload: unknown) => {
    const digest = digestSfValue(payload)
    const admission = await ui.admit(request(principal, command), operation, digest)
    if (admission.status !== "ok" || !await ui.validate(admission.value, operation, digest)) throw new Error("UI capability admission unavailable")
    return admission.value
  }
  const admitEdit = async (principal: string, command: string, payload: unknown) => {
    const admission = await human.admit(request(principal, command), "decisions.edit", payload)
    if (admission.status !== "ok") throw new Error("Human edit admission unavailable")
    return admission.value
  }
  let current: Awaited<ReturnType<typeof open>> | undefined
  try {
    current = await open()
    const draft = { objective: "Preserve the decision across sessions", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost and continuity"], sourceRefs: [] }
    const creator = await admitCapability("andre", "create-case", "sf_case_draft", draft)
    const created = await current.cases.draft(draft, creator)
    ui.finish(creator)
    expect(created.status).toBe("ok")
    if (created.status !== "ok") throw new Error(created.reason)
    const initial = created.value
    const source = request("andre", "fixture-membership")
    const beforeSharing = await current.state.read(source, "cases", (state) => state.cases[initial.id])
    if (beforeSharing.status !== "ok") throw new Error("Created case unavailable")
    // Membership is a host fixture grant, not a claim that an end-user sharing UI was exercised.
    const shared = await current.state.transaction(source, { namespace: "cases", expectedStorageVersion: beforeSharing.storageVersion,
      targetRef: initial.id, targetIncarnation: initial.incarnation, idempotencyKey: "fixture-membership", commandDigest: digestSfValue({ participant: "collaborator" }) }, async (state) => {
      const decision = { ...state.cases[initial.id]!, version: initial.version + 1, participants: ["andre", "collaborator"] }
      state.cases[initial.id] = decision
      return { commit: true, value: decision }
    })
    if (shared.status !== "ok") throw new Error("Fixture membership unavailable")
    const persistedCase = structuredClone(shared.value)
    await current.store.dispose()
    current = undefined
    current = await open()
    const readRequest = { caseRef: encodeCaseRef(initial) }
    const collaborator = await admitCapability("collaborator", "reopen-case", "sf_case_read", readRequest)
    const restored = await current.cases.read(readRequest, collaborator)
    expect(restored).toMatchObject({ status: "ok", value: { context: { principalRef: "collaborator" }, case: persistedCase } })
    const creation = await current.state.read(request("collaborator", "inspect-creation"), "cases", (state) =>
      state.transactions[JSON.stringify(["andre", "cases", creationTarget.ref, "create-case"])])
    expect(creation).toMatchObject({ status: "ok", value: { principalRef: "andre", commandDigest: digestSfValue(draft), value: initial } })
    const outsider = await admitCapability("outsider", "outside-case", "sf_case_read", readRequest)
    expect(await current.cases.read(readRequest, outsider)).toEqual({ status: "denied", reason: "case-access-unavailable" })
    ui.finish(outsider)
    const base = { caseRef: { id: initial.id, incarnation: initial.incarnation, version: persistedCase.version }, criteria: persistedCase.criteria, sourceRefs: [] }
    const edits = [
      { principal: "andre", command: "edit-andre", payload: { ...base, objective: "André's retained draft" } },
      { principal: "collaborator", command: "edit-collaborator", payload: { ...base, objective: "Collaborator's retained draft" } },
    ]
    const originalEdits = structuredClone(edits)
    expect(await current.management.edit(edits[0]!.payload, collaborator)).toEqual({ status: "denied", reason: "human-edit-required" })
    ui.finish(collaborator)
    const contexts = await Promise.all(edits.map((edit) => admitEdit(edit.principal, edit.command, edit.payload)))
    const management = current.management
    const outcomes = await Promise.all(edits.map((edit, index) => management.edit(edit.payload, contexts[index]!)))
    contexts.forEach((context) => ui.finish(context))
    expect([...arrivals].sort()).toEqual([...concurrentCommands].sort())
    expect(outcomes.map((result) => result.status).sort()).toEqual(["conflict", "ok"])
    expect(edits).toEqual(originalEdits)
    const winnerIndex = outcomes.findIndex((result) => result.status === "ok")
    const winner = edits[winnerIndex]!
    const committed = outcomes[winnerIndex]!
    if (committed.status !== "ok") throw new Error("Concurrent edit did not commit")
    expect(committed.value.caseRef.version).toBe(persistedCase.version + 1)
    const snapshot = () => current!.state.read(request("andre", "inspect-state"), "cases", (state) => ({
      decision: state.cases[initial.id],
      editReceipts: Object.entries(state.transactions).filter(([key]) => concurrentCommands.has(JSON.parse(key)[3])).map(([, value]) => value),
    }))
    const after = await snapshot()
    expect(after).toMatchObject({ status: "ok", value: { decision: { version: persistedCase.version + 1, objective: winner.payload.objective },
      editReceipts: [{ principalRef: winner.principal, commandDigest: digestSfValue(winner.payload) }] } })
    if (after.status !== "ok") throw new Error("Committed case unavailable")
    expect(after.value.editReceipts).toHaveLength(1)
    const retry = await admitEdit(winner.principal, winner.command, winner.payload)
    expect(await current.management.edit(winner.payload, retry)).toEqual(committed)
    ui.finish(retry)
    const changed = { ...winner.payload, objective: "Different content on the same command identity" }
    const changedIntent = await admitEdit(winner.principal, winner.command, changed)
    expect(await current.management.edit(changed, changedIntent)).toEqual({ status: "conflict", reason: "idempotency-content-changed" })
    ui.finish(changedIntent)
    expect(await snapshot()).toEqual(after)
    // The losing request is still a complete immutable draft for a newly confirmed rebase.
    const loser = edits[1 - winnerIndex]!
    const rebased = { ...loser.payload, caseRef: committed.value.caseRef }
    const rebaseIntent = await admitEdit(loser.principal, "rebase-losing-draft", rebased)
    expect(await current.management.edit(rebased, rebaseIntent)).toEqual({ status: "ok", value: { caseRef: { ...committed.value.caseRef, version: committed.value.caseRef.version + 1 } } })
    ui.finish(rebaseIntent)
    expect(edits).toEqual(originalEdits)
  } finally {
    await current?.store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 180000)
