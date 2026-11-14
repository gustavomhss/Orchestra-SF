import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../product/contracts/state.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

/** C08 read fence only: the empty case is an explicit fixture seed, with no
 * financial, choice, confirmation or domain-execution claim. Admission and CAS
 * use the real UI authority, state provider and SQLite transaction lifecycle.
 */
for (const change of ["membership", "same-version content"] as const) test(`case read suppresses its projection when ${change} changes during the final host revalidation`, async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-case-read-fence-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const at = "2026-11-14T00:00:00Z"
  const request = new Request("https://example.test/case-read-fence", { headers: { authorization: "reader-fixture" } })
  const identity = { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const ui = createSfUiAuthority({ authorize: async (incoming) => incoming === request && incoming.headers.get("authorization") === "reader-fixture" ? identity : undefined, commandIdentity: async () => "read-case", createId: () => "ui-request", now: () => Date.parse(at) })
  let admittedContext: TrustedUiContext | undefined
  try {
    const caseRef = { id: "case", incarnation: "case-incarnation", version: 1 }
    const readRequest = { caseRef: encodeCaseRef(caseRef) }
    const intentDigest = digestSfValue(readRequest)
    const admitted = await ui.admit(request, "sf_case_read", intentDigest)
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_case_read", intentDigest)) throw new Error("Reader UI admission unavailable")
    const context = admitted.value
    admittedContext = context
    const persisted = createSfProductState({ persistence: store, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async (incoming) => incoming === request && await ui.revalidate(context) ? { principalRef: identity.principalRef, policyVersion: identity.policyVersion, accessRevision: identity.accessRevision } : undefined })
    const decision: DecisionCase = { ...caseRef, state: "draft", objective: "retain the complete case read", currency: "USD", horizon: { start: "2027-01-01", end: "2027-12-31" }, criteria: [], participants: [identity.principalRef], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const originalDigest = digestSfValue(decision)
    const seeded = await persisted.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed-case-reader", commandDigest: originalDigest }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok" || !seeded.value) throw new Error("Reader case seed unavailable")
    const observations = { caseReads: 0 }
    const state: SfProductStatePort = { ...persisted, read: (incoming, namespace, read) => {
      if (namespace === "cases") observations.caseReads += 1
      return persisted.read(incoming, namespace, read)
    } }
    const race = { armed: false, hostChecks: 0, committed: false }
    const host: Pick<DomainPortHost, "requestFor" | "revalidate"> = {
      requestFor: (trusted) => trusted.kind === "ui" ? ui.requestFor(trusted) : undefined,
      revalidate: async (trusted) => {
        const allowed = trusted.kind === "ui" && await ui.revalidate(trusted)
        if (race.armed && ++race.hostChecks === 2) {
          const current = await persisted.read(request, "cases", (stored) => stored.cases[caseRef.id])
          if (current.status !== "ok" || !current.value) throw new Error("Race case unavailable")
          const changed = await persisted.transaction(request, { namespace: "cases", expectedStorageVersion: current.storageVersion, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "change-case-during-final-host-check", commandDigest: digestSfValue({ caseRef, change }) }, async (stored) => {
            const actual = stored.cases[caseRef.id]
            if (!actual || digestSfValue(actual) !== originalDigest) return { commit: false, value: false }
            // The second variant intentionally keeps the business version unchanged
            // to distinguish the complete snapshot fence from a version-only check.
            stored.cases[caseRef.id] = change === "membership"
              ? { ...actual, version: actual.version + 1, participants: [] }
              : { ...actual, objective: "changed during the final host check" }
            return { commit: true, value: true }
          })
          race.committed = changed.status === "ok" && changed.value
        }
        // The same principal, policy, access revision and UI lease remain valid.
        // This callback cannot attest that the earlier C08 snapshot is still current.
        return allowed
      },
    }
    let unexpectedEvidenceCalls = 0
    const unused = async (): Promise<never> => { unexpectedEvidenceCalls += 1; throw new Error("Empty case read must not fabricate evidence or calculate") }
    const evidence: BusinessContextService = { context: unused, resolve: unused, recall: unused, emitFromLedger: unused }
    const cases = createDecisionCasePort({ state, host, evidence, creationTarget: { ref: "installation:cases", incarnation: "installation-incarnation" }, operationIdentity: (trusted) => trusted.kind === "ui" ? ui.operationIdentity(trusted) : undefined,
      authorizeCase: async (value, trusted) => value.participants.includes(trusted.binding.principalRef) && trusted.kind === "ui" && await ui.revalidate(trusted),
      verifyScenarioOperations: async (value, trusted) => value.alternatives.length === 0 && value.choices.length === 0 && value.preparedChanges.length === 0 && trusted.kind === "ui" && await ui.revalidate(trusted),
      createId: () => "unused-case-id", now: () => at,
    })
    const baseline = await cases.read(readRequest, context)
    expect(baseline).toMatchObject({ status: "ok", value: { case: decision, events: [], evidenceRefs: [], checkedAt: at } })
    expect(observations.caseReads).toBe(2)
    observations.caseReads = 0
    race.armed = true
    const read = await cases.read(readRequest, context)
    // Verify the real commit outside the callback: port.read catches callback errors.
    expect(race).toEqual({ armed: true, hostChecks: 2, committed: true })
    expect(observations.caseReads).toBe(2)
    expect(read).toEqual({ status: "stale", reason: "case-changed" })
    expect(read).not.toHaveProperty("value")
    expect(await ui.revalidate(context)).toBe(true)
    expect(ui.requestFor(context)).toBe(request)
    const after = await persisted.read(request, "cases", (stored) => stored.cases[caseRef.id])
    expect(after).toMatchObject({ status: "ok", storageVersion: seeded.storageVersion + 1, value: { ...decision, ...(change === "membership" ? { version: 2, participants: [] } : { objective: "changed during the final host check" }) } })
    expect(digestSfValue(decision)).toBe(originalDigest)
    expect(unexpectedEvidenceCalls).toBe(0)
  } finally {
    if (admittedContext) ui.finish(admittedContext)
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
