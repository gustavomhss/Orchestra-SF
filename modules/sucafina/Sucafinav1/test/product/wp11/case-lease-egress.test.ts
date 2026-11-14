import { expect, test } from "bun:test"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { BusinessContextService } from "../../../product/contracts/business-context.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import { createDecisionCasePort, encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

/** Real UI leases and C08/SQLite egress. Namespace authorization remains valid
 * after the separate lease ends, as in product-authority. Empty cases and an
 * explicit-case intent carry no claim about native sessions or financial data.
 */
for (const route of ["read", "draft", "prepare-intent"] as const) for (const end of ["finished", "expired"] as const) test(`case ${route} refuses a ${end} lease after the final C08 namespace authorization`, async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-case-lease-egress-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const seedRequest = new Request("https://example.test/cases", { headers: { authorization: "case-lease-fixture", "x-command": "seed" } })
  const request = new Request("https://example.test/cases", { headers: { authorization: "case-lease-fixture", "x-command": "exercise" } })
  const identity = { installationId: "install", projectId: "project", principalRef: "principal", policyVersion: "policy", accessRevision: "access" }
  const clock = { now: Date.parse("2026-11-14T00:00:00Z") }
  const race = { armed: false, authorizations: 0, applied: false }
  const contexts: TrustedUiContext[] = []
  const ui = createSfUiAuthority({ authorize: async (incoming) => (incoming === request || incoming === seedRequest) && incoming.headers.get("authorization") === "case-lease-fixture" ? identity : undefined, commandIdentity: async (incoming) => incoming.headers.get("x-command") ?? undefined, createId: () => `ui-${contexts.length}`, now: () => clock.now })
  try {
    const state = createSfProductState({ persistence: store, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: "workspace-incarnation" }), authorize: async (incoming, _snapshot, namespace, mode) => {
      if (incoming !== seedRequest && incoming !== request) return undefined
      if (race.armed && namespace === "cases" && mode === "read" && ++race.authorizations === (route === "prepare-intent" ? 8 : 4)) {
        const active = contexts.at(-1)
        if (!active) throw new Error("Active UI lease unavailable")
        if (end === "finished") ui.finish(active)
        if (end === "expired") clock.now += 300_001
        race.applied = true
      }
      return { principalRef: identity.principalRef, policyVersion: identity.policyVersion, accessRevision: identity.accessRevision }
    } })
    const host: Pick<DomainPortHost, "requestFor" | "revalidate"> = { requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: (context) => context.kind === "ui" ? ui.revalidate(context) : Promise.resolve(false) }
    const unused = async (): Promise<never> => { throw new Error("Empty case has no evidence or financial producer") }
    const evidence: BusinessContextService = { context: unused, resolve: unused, recall: unused, emitFromLedger: unused }
    let nextId = 0
    const cases = createDecisionCasePort({ state, host, creationTarget: { ref: "workspace", incarnation: "workspace-incarnation" }, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined,
      authorizeCase: async (value, context) => value.participants.includes(context.binding.principalRef) && await host.revalidate(context),
      verifyScenarioOperations: async (value, context) => value.alternatives.length === 0 && value.choices.length === 0 && value.preparedChanges.length === 0 && await host.revalidate(context),
      evidence, createId: () => `case-lease-${++nextId}`, now: () => new Date(clock.now).toISOString(),
    })
    const payload = { objective: "private draft objective", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost"], sourceRefs: [] }
    const seed = await ui.admit(seedRequest, "sf_case_draft", digestSfValue(payload))
    if (seed.status !== "ok" || !await ui.validate(seed.value, "sf_case_draft", digestSfValue(payload))) throw new Error("Seed admission unavailable")
    contexts.push(seed.value)
    const created = await cases.draft(payload, seed.value)
    expect(created.status).toBe("ok")
    if (created.status !== "ok") throw new Error("Real case creation unavailable")
    const caseRef = { id: created.value.id, incarnation: created.value.incarnation, version: created.value.version }
    const readRequest = { caseRef: encodeCaseRef(caseRef) }
    expect(await cases.read(readRequest, seed.value)).toMatchObject({ status: "ok", value: { case: created.value } })
    ui.finish(seed.value)
    const operation = route === "read" ? "sf_case_read" : "sf_case_draft"
    const intentDigest = digestSfValue(route === "read" ? readRequest : payload)
    const admitted = await ui.admit(request, operation, intentDigest)
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, operation, intentDigest)) throw new Error("Exercise admission unavailable")
    contexts.push(admitted.value)
    const baseline = await state.read(request, "cases", (value) => value.cases[caseRef.id])
    if (baseline.status !== "ok") throw new Error("Case baseline unavailable")
    race.armed = true
    const response = route === "draft" ? await cases.draft(payload, admitted.value) : route === "read" ? await cases.read(readRequest, admitted.value) : await cases.prepareIntentForCase(payload, caseRef, admitted.value)
    expect(race).toEqual({ armed: true, authorizations: route === "prepare-intent" ? 8 : 4, applied: true })
    expect(response).toEqual({ status: "stale", reason: "case-changed" })
    expect(response).not.toHaveProperty("value")
    expect(ui.requestFor(admitted.value)).toBeUndefined()
    expect(await ui.revalidate(admitted.value)).toBe(false)
    expect(request.signal.aborted).toBe(false)
    race.armed = false
    const after = await state.read(request, "cases", (value) => ({ original: value.cases[caseRef.id], count: Object.keys(value.cases).length }))
    expect(after).toMatchObject({ status: "ok", value: { original: baseline.value, count: route === "draft" ? 2 : 1 } })
    expect(digestSfValue(payload)).toBe(digestSfValue({ objective: "private draft objective", horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost"], sourceRefs: [] }))
  } finally {
    contexts.forEach((context) => ui.finish(context))
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
