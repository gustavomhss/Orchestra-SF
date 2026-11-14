import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionMutations } from "../../../product/decisions/mutations.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

// This is only the durable-child lookup, with no fabricated portfolio or receipt.
// The real C08 provider keeps namespace grants while the separate UI lease ends.
for (const end of ["finished", "expired"] as const) test(`portfolio replay lookup refuses a ${end} lease at the final C08 authorization`, async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-replay-lease-egress-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const request = new Request("https://example.test/decisions")
  const identity = { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const clock = { now: Date.parse("2026-11-14T00:00:00Z") }
  const caseRef = { id: "replay-case", incarnation: "replay-case-inc", version: 1 }
  const incoming = { caseRef, operation: "prepare-changes" as const, payload: { selectionRef: "unattempted-selection" } }
  const contexts: TrustedUiContext[] = []
  const ui = createSfUiAuthority({ authorize: async (source) => source === request ? identity : undefined, commandIdentity: async () => "replay-intention", createId: () => `replay-${contexts.length}`, now: () => clock.now, privateCommands: ["wp11-replay-fixture"] })
  const admit = async () => {
    const value = await ui.admit(request, "wp11-replay-fixture", digestSfValue(incoming))
    if (value.status !== "ok" || !await ui.validate(value.value, "wp11-replay-fixture", digestSfValue(incoming))) throw new Error("Replay UI authority unavailable")
    contexts.push(value.value)
    return value.value
  }
  const race = { armed: false, authorizations: 0, applied: false }
  try {
    const context = await admit()
    const state = createSfProductState({ persistence: store, createId: () => "state", resolveTarget: async () => ({ incarnation: caseRef.incarnation }), authorize: async (source, _snapshot, namespace, mode) => {
      if (source !== request) return undefined
      if (race.armed && namespace === "cases" && mode === "read" && ++race.authorizations === 2) {
        if (end === "finished") ui.finish(context)
        else clock.now += 300_001
        race.applied = true
      }
      return identity
    } })
    const host: Pick<DomainPortHost, "requestFor" | "revalidate"> = { requestFor: (binding) => binding.kind === "ui" ? ui.requestFor(binding) : undefined, revalidate: (binding) => binding.kind === "ui" ? ui.revalidate(binding) : Promise.resolve(false) }
    const decision: DecisionCase = { ...caseRef, state: "draft", objective: "Inspect a durable child lookup", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: [], participants: [identity.principalRef], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [] }
    const seeded = await state.transaction(request, { namespace: "cases", expectedStorageVersion: 0, targetRef: caseRef.id, targetIncarnation: caseRef.incarnation, idempotencyKey: "seed", commandDigest: digestSfValue(decision) }, async (value) => { value.cases[caseRef.id] = decision; return { commit: true, value: true } })
    if (seeded.status !== "ok") throw new Error("Replay case seed unavailable")
    let unexpectedCalls = 0
    const unused = async (): Promise<never> => { unexpectedCalls++; throw new Error("A replay lookup cannot dispatch or synthesize a result") }
    const mutations = createDecisionMutations({ state, host,
      planner: { compareForecast: unused, simulateScenario: unused, compareScenarios: unused, evaluateSensitivity: unused },
      sources: { resolveForecastSource: unused, resolveForecastCoverage: unused },
      authorizeCase: async (value, binding) => value.participants.includes(binding.binding.principalRef),
      authorizeMutation: unused, verifyMutation: () => { unexpectedCalls++; throw new Error("No mutation") },
      operationIdentity: (binding) => binding.kind === "ui" ? ui.operationIdentity(binding) : undefined,
      confirmChoice: unused, resolveQuestion: unused, resolveAnswer: unused, confirmAnswer: unused, resolveChoiceValues: unused, prepareDomainCommands: unused,
      createId: () => { unexpectedCalls++; throw new Error("No creation") }, now: () => new Date(clock.now).toISOString(),
    })
    expect(await mutations.replayPortfolio(incoming, context)).toEqual({ status: "ok", value: { state: "not-found" } })
    const before = await state.read(request, "cases", (value) => value)
    race.armed = true
    const denied = await mutations.replayPortfolio(incoming, context)
    expect(race).toEqual({ armed: true, authorizations: 2, applied: true })
    expect(denied).toEqual({ status: "denied", reason: "portfolio-replay-access-unavailable" })
    expect(denied).not.toHaveProperty("value")
    expect(request.signal.aborted).toBe(false)
    expect(ui.requestFor(context)).toBeUndefined()
    expect(await ui.revalidate(context)).toBe(false)
    race.armed = false
    expect(await state.read(request, "cases", (value) => value)).toEqual(before)
    expect(await mutations.replayPortfolio(incoming, await admit())).toEqual({ status: "ok", value: { state: "not-found" } })
    expect(unexpectedCalls).toBe(0)
  } finally {
    contexts.forEach((context) => ui.finish(context))
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
