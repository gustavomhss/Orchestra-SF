import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductState, SfProductStatePort } from "../../../product/contracts/state.ts"
import { createDecisionCasePort } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

const variants = [
  { route: "draft", change: "membership", hostCheck: 3 },
  { route: "draft", change: "incarnation", hostCheck: 3 },
  { route: "draft", change: "same-version content", hostCheck: 3 },
  { route: "prepare-intent", change: "membership", hostCheck: 5 },
  { route: "prepare-intent", change: "incarnation", hostCheck: 5 },
  { route: "prepare-intent", change: "same-version content", hostCheck: 5 },
  { route: "prepare-intent", change: "same-version content", hostCheck: 3 },
] as const

/** Egress race only. Draft creation, UI admission and C08/SQLite CAS are real.
 * The empty case carries no financial claim or human choice; the explicit-case
 * intent helper is exercised under a UI lease, not an installed native session.
 */
for (const variant of variants) test(`${variant.route} suppresses ${variant.change} changed by host check ${variant.hostCheck} before its response`, async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-case-egress-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const at = "2026-11-14T00:00:00Z"
  const request = new Request("https://example.test/case-egress", { headers: { authorization: "case-egress-fixture" } })
  const identity = { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const ui = createSfUiAuthority({ authorize: async (incoming) => incoming === request && incoming.headers.get("authorization") === "case-egress-fixture" ? identity : undefined, commandIdentity: async () => "create-case", createId: () => "ui-request", now: () => Date.parse(at) })
  let admittedContext: TrustedUiContext | undefined
  try {
    const payload = { objective: "preserve the current draft", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost"], sourceRefs: [] }
    const intentDigest = digestSfValue(payload)
    const admission = await ui.admit(request, "sf_case_draft", intentDigest)
    if (admission.status !== "ok" || !await ui.validate(admission.value, "sf_case_draft", intentDigest)) throw new Error("Draft UI admission unavailable")
    const context = admission.value
    admittedContext = context
    const creationTarget = { ref: "installation:cases", incarnation: "installation-incarnation" }
    const persisted = createSfProductState({ persistence: store, createId: () => "state-incarnation",
      authorize: async (incoming) => incoming === request && await ui.revalidate(context) ? { principalRef: identity.principalRef, policyVersion: identity.policyVersion, accessRevision: identity.accessRevision } : undefined,
      resolveTarget: async (_incoming, snapshot, _namespace, targetRef) => {
        if (targetRef === creationTarget.ref) return { incarnation: creationTarget.incarnation }
        const actual = (snapshot.data.__sfProductV1 as SfProductState | undefined)?.cases[targetRef]
        return actual ? { incarnation: actual.incarnation } : undefined
      },
    })
    const observations = { caseReads: 0, ids: 0, evidenceCalls: 0 }
    const state: SfProductStatePort = { ...persisted, read: (incoming, namespace, read) => {
      if (namespace === "cases") observations.caseReads += 1
      return persisted.read(incoming, namespace, read)
    } }
    const race: { armed: boolean; hostChecks: number; committed: boolean; before?: DecisionCase; beforeDigest?: string } = { armed: false, hostChecks: 0, committed: false }
    const host: Pick<DomainPortHost, "requestFor" | "revalidate"> = {
      requestFor: (trusted) => trusted.kind === "ui" ? ui.requestFor(trusted) : undefined,
      revalidate: async (trusted) => {
        const allowed = trusted.kind === "ui" && await ui.revalidate(trusted)
        if (race.armed && ++race.hostChecks === variant.hostCheck) {
          const current = await persisted.read(request, "cases", (stored) => stored.cases.case)
          if (current.status !== "ok" || !current.value) throw new Error("Concurrent draft unavailable")
          race.before = structuredClone(current.value)
          race.beforeDigest = digestSfValue(current.value)
          const changed = await persisted.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: current.value.id, targetIncarnation: current.value.incarnation, idempotencyKey: "change-case-during-egress", commandDigest: digestSfValue(variant) }, async (stored) => {
            const actual = stored.cases.case
            if (!actual || digestSfValue(actual) !== race.beforeDigest) return { commit: false, value: false }
            stored.cases.case = variant.change === "membership"
              ? { ...actual, version: actual.version + 1, participants: [] }
              : variant.change === "incarnation"
                ? { ...actual, incarnation: "replacement-incarnation" }
                : { ...actual, objective: "concurrently revised objective", criteria: actual.criteria.map((criterion) => ({ ...criterion, description: "Concurrently revised criterion" })) }
            return { commit: true, value: true }
          })
          race.committed = changed.status === "ok" && changed.value
        }
        // Global actor/policy/access and the consumed UI lease remain valid.
        return allowed
      },
    }
    const unused = async (): Promise<never> => { observations.evidenceCalls += 1; throw new Error("The empty draft has no business evidence") }
    const evidence: BusinessContextService = { context: unused, resolve: unused, recall: unused, emitFromLedger: unused }
    const cases = createDecisionCasePort({ state, host, creationTarget, evidence,
      operationIdentity: (trusted) => trusted.kind === "ui" ? ui.operationIdentity(trusted) : undefined,
      authorizeCase: async (value, trusted) => value.participants.includes(trusted.binding.principalRef) && trusted.kind === "ui" && await ui.revalidate(trusted),
      verifyScenarioOperations: async (value, trusted) => value.alternatives.length === 0 && value.choices.length === 0 && value.preparedChanges.length === 0 && trusted.kind === "ui" && await ui.revalidate(trusted),
      createId: () => ["case", "case-incarnation", "criterion"][observations.ids++] ?? "unused-id", now: () => at,
    })
    const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
    if (variant.route === "prepare-intent") {
      const created = await cases.draft(payload, context)
      expect(created).toMatchObject({ status: "ok", value: { ...caseRef, objective: payload.objective, participants: [identity.principalRef] } })
      if (created.status !== "ok") throw new Error("Initial draft unavailable")
      const baseline = await cases.prepareIntentForCase(payload, caseRef, context)
      expect(baseline).toMatchObject({ status: "ok", value: { objective: payload.objective, criteria: [{ id: "criterion", description: "Cost", required: true }], sourceRefs: [], domainApplied: false, analysisBasis: "domain" } })
    }
    observations.caseReads = 0
    race.armed = true
    const response = variant.route === "draft" ? await cases.draft(payload, context) : await cases.prepareIntentForCase(payload, caseRef, context)
    // A swallowed callback/transaction failure cannot make this negative pass.
    expect(race.committed).toBe(true)
    expect(race.hostChecks).toBe(variant.route === "draft" ? 3 : 5)
    expect(observations.caseReads).toBe(variant.route === "draft" ? 2 : 4)
    expect(response).toEqual(variant.route === "draft" && variant.change !== "same-version content"
      ? { status: "denied", reason: "case-access-unavailable" }
      : { status: "stale", reason: "case-changed" })
    expect(response).not.toHaveProperty("value")
    expect(await ui.revalidate(context)).toBe(true)
    expect(ui.requestFor(context)).toBe(request)
    expect(race.before).toMatchObject({ ...caseRef, objective: payload.objective, criteria: [{ id: "criterion", description: "Cost", required: true }], participants: [identity.principalRef], choices: [], preparedChanges: [], receipts: [] })
    expect(digestSfValue(race.before)).toBe(race.beforeDigest)
    const after = await persisted.read(request, "cases", (stored) => stored.cases.case)
    expect(after).toMatchObject({ status: "ok", storageVersion: 2, value: { id: caseRef.id, version: variant.change === "membership" ? 2 : 1, incarnation: variant.change === "incarnation" ? "replacement-incarnation" : caseRef.incarnation, participants: variant.change === "membership" ? [] : [identity.principalRef], objective: variant.change === "same-version content" ? "concurrently revised objective" : payload.objective, choices: [], preparedChanges: [], receipts: [] } })
    expect(digestSfValue(payload)).toBe(intentDigest)
    expect(observations.evidenceCalls).toBe(0)
  } finally {
    if (admittedContext) ui.finish(admittedContext)
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
