import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import type { DecisionCase } from "../../../product/contracts/decisions.ts"
import type { TrustedUiContext } from "../../../product/contracts/sf-execution.ts"
import type { SfStateNamespace } from "../../../product/contracts/state.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import type { Snapshot } from "../../../runtime/contract.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"

/** A deliberately empty business case: this fixture proves the C08 boundary,
 * not a financial result, source grant, native execution or global acceptance. */
export async function createStateIsolationFixture() {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-state-read-isolation-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const at = "2026-11-14T00:00:00Z"
  const controls: {
    enabled: boolean
    checks: { request: Request; namespace: SfStateNamespace; mode: "read" | "write" }[]
    observe?: (snapshot: Snapshot, request: Request, mode: "read" | "write", index: number) => void | Promise<void>
  } = { enabled: true, checks: [] }
  const ui = createSfUiAuthority({
    authorize: async (request) => controls.enabled && request.headers.get("authorization") === "fixture-token" ? {
      installationId: "installation", projectId: "project", principalRef: request.headers.get("x-principal") ?? "principal", policyVersion: "policy", accessRevision: "access",
    } : undefined,
    commandIdentity: async () => "fixture-state-read", createId: () => crypto.randomUUID(), now: () => Date.parse(at),
  })
  const contexts = new WeakMap<Request, TrustedUiContext>()
  const leases: TrustedUiContext[] = []
  const admit = async (principal = "principal", signal?: AbortSignal) => {
    const request = new Request("https://example.test/state-read-isolation", { headers: { authorization: "fixture-token", "x-principal": principal }, signal })
    const intentDigest = digestSfValue({ caseRef: "case:case:case-incarnation" })
    const admitted = await ui.admit(request, "sf_case_read", intentDigest)
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_case_read", intentDigest)) throw new Error("State read fixture admission unavailable")
    contexts.set(request, admitted.value)
    leases.push(admitted.value)
    return { request, context: admitted.value }
  }
  const admitted = await admit()
  const state = createSfProductState({
    persistence: store, createId: () => "state-incarnation", resolveTarget: async () => ({ incarnation: "case-incarnation" }),
    authorize: async (request, snapshot, namespace, mode) => {
      controls.checks.push({ request, namespace, mode })
      await controls.observe?.(snapshot, request, mode, controls.checks.length)
      const context = contexts.get(request)
      if (!context || !await ui.revalidate(context)) return undefined
      return { principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion, accessRevision: context.binding.accessRevision }
    },
  })
  const decision: DecisionCase = {
    id: "case", incarnation: "case-incarnation", version: 1, state: "draft", objective: "original case", currency: "USD",
    horizon: { start: "2027-01-01", end: "2027-12-31" }, criteria: [], participants: ["principal"], sourceRefs: [], alternatives: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], preparedChanges: [], receipts: [], ledger: [],
  }
  const command = { namespace: "cases" as const, expectedStorageVersion: 0, targetRef: "case", targetIncarnation: "case-incarnation", idempotencyKey: "seed-isolation", commandDigest: digestSfValue(decision) }
  const seeded = await state.transaction(admitted.request, { ...command, additionalNamespaces: [{ namespace: "preferences", expectedStorageVersion: 0 }] }, async (stored) => {
    stored.cases.case = decision
    stored.preferences.private = { marker: "not part of a case projection", nested: { count: 1 } }
    return { commit: true, value: true }
  })
  if (seeded.status !== "ok" || !seeded.value) {
    leases.forEach((context) => ui.finish(context))
    await store.dispose()
    await rm(directory, { recursive: true, force: true })
    throw new Error("State read fixture seed unavailable")
  }
  controls.checks.length = 0
  return {
    ...admitted, state, store, ui, controls, decision, command, admit,
    close: async () => {
      leases.forEach((context) => ui.finish(context))
      await store.dispose()
      await rm(directory, { recursive: true, force: true })
    },
  }
}
