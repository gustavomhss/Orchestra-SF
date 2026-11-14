import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createCollaborationHumanAuthority } from "../../../product/collaboration/human.ts"
import { createConfirmationObservationReceipts } from "../../../product/collaboration/confirmation-observations.ts"
import { createConfirmationPort } from "../../../product/collaboration/confirmation.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ConfirmationScope } from "../../../product/contracts/context.ts"
import type { ConfirmationScopeObservation } from "../../../product/collaboration/confirmation.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

// The C06 registry, human admission and SQLite state are real. The material observation is
// deliberately injected: these tests prove lookup/selection semantics, not domain or native execution.
test("scope lookup ignores dependency audit versions and field order, but rechecks material inputs and access", async () => {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-confirmation-scope-reader-"))
  const persistence = await openLocalStore(directory)
  const at = "2026-11-14T00:00:00Z"
  const current = { version: 7, dependency: "rate-1", allowed: true, physical: "physical-original" }
  try {
    const ui = createSfUiAuthority({ authorize: async (request) => request.headers.get("actor") === "person" ? { installationId: "i", projectId: "p", principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined, commandIdentity: async () => randomUUID(), createId: randomUUID, now: () => Date.parse(at), privateCommands: ["sf-human:collaboration.confirmation.confirm"] })
    const human = createCollaborationHumanAuthority({ origin: "https://example.test", ui })
    const host = { requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context: TrustedDomainContext) => context.kind === "ui" && await ui.revalidate(context) }
    const state = createSfProductState({ persistence, createId: randomUUID, resolveTarget: async () => ({ incarnation: "workspace-inc" }), authorize: async (request) => request.headers.get("actor") === "person" ? { principalRef: "person", accessRevision: "access", policyVersion: "policy" } : undefined })
    const request = () => new Request("https://example.test/product", { method: "POST", headers: { origin: "https://example.test", actor: "person" } })
    const admitted = await ui.admit(request(), "sf_work_list", digestSfValue({}))
    if (admitted.status !== "ok" || !await ui.validate(admitted.value, "sf_work_list", digestSfValue({}))) throw new Error("read admission failed")
    const context = admitted.value
    const period = { start: "2026-01-01", end: "2026-01-31" }
    const scope: ConfirmationScope = { sourceRef: { surface: "planner", type: "planner-version", id: "forecast", incarnation: "forecast-scope" }, fields: ["amount", "currency"], period, materialDependencies: [{ surface: "planner", type: "fx", id: "USD-EUR", incarnation: "fx-inc", version: 10, fields: ["rate", "currency"], period, observedAt: at }, { surface: "planner", type: "rates", id: "rate-card", incarnation: "rates-inc", version: 3, fields: ["rate"], period, observedAt: at }], scopeDefinitionVersion: "fixture-c06-v1" }
    const observe = async (selected: ConfirmationScope): Promise<ConfirmationScopeObservation> => current.allowed ? { state: "available", sourceVersion: current.version, incarnation: selected.sourceRef.incarnation, physicalIncarnation: current.physical, sourceFingerprint: digestSfValue({ january: 100 }), dependencyFingerprint: digestSfValue(current.dependency), scopeFingerprint: digestSfValue({ january: 100, dependency: current.dependency }) } : { state: "access-unavailable", sourceVersion: current.version }
    const receipts = createConfirmationObservationReceipts({ host, observe, now: () => Date.parse(at) })
    const port = createConfirmationPort({ state, host, observe, fence: async (_scope, observed) => current.allowed && observed.sourceVersion === current.version && observed.dependencyFingerprint === digestSfValue(current.dependency), verifyObserved: receipts.verifyObserved, human, creationTarget: { ref: "workspace", incarnation: "workspace-inc" }, createId: randomUUID, now: () => at })
    expect(await port.readScope(scope, context)).toEqual({ status: "ok", value: null })
    const prepared = await receipts.prepare(scope, context)
    if (prepared.status !== "ok") throw new Error("scope observation failed")
    const command = { scope, observedSourceVersion: prepared.value.sourceVersion, expectedScopeFingerprint: prepared.value.scopeFingerprint, expectedStorageVersion: 0, idempotencyKey: "confirm-scope" }
    const humanContext = await human.admit(request(), "collaboration.confirmation.confirm", command)
    if (humanContext.status !== "ok") throw new Error("human admission failed")
    const confirmation = await port.confirm(command, humanContext.value)
    if (confirmation.status !== "ok") throw new Error("confirmation failed")
    const audit = structuredClone(confirmation.value)
    current.version = 8
    const refreshed: ConfirmationScope = { ...scope, fields: [...scope.fields].reverse(), materialDependencies: [...scope.materialDependencies].reverse().map((dependency) => ({ ...dependency, version: dependency.version + 1, observedAt: "2026-11-14T00:01:00Z", fields: [...dependency.fields].reverse() })) }
    expect(await port.find(refreshed, context)).toEqual({ status: "ok", value: { confirmationIds: [confirmation.value.id] } })
    expect(await port.readScope(refreshed, context)).toMatchObject({ status: "ok", value: { confirmationId: confirmation.value.id, state: "valid", reason: "unchanged-scope", evaluatedSourceVersion: 8 } })
    expect(await port.inspect(confirmation.value.id, context)).toMatchObject({ status: "ok", value: { observedSourceVersion: 7 } })
    const otherPeriod = { ...refreshed, period: { start: "2026-02-01", end: "2026-02-28" } }
    expect(await port.readScope(otherPeriod, context)).toEqual({ status: "ok", value: null })
    current.dependency = "rate-2"
    expect(await port.readScope(refreshed, context)).toMatchObject({ status: "ok", value: { confirmationId: confirmation.value.id, state: "stale", reason: "dependency-change" } })
    expect(await port.readScope(refreshed, context)).toMatchObject({ status: "ok", value: { confirmationId: confirmation.value.id, state: "stale", reason: "dependency-change" } })
    const stored = await state.read(request(), "confirmations", (value) => value.confirmations[confirmation.value.id])
    expect(stored.status === "ok" && stored.value).toMatchObject(audit)
    current.allowed = false
    expect(await port.readScope(refreshed, context)).toEqual({ status: "unavailable", reason: "confirmation-scope-unavailable" })
    current.allowed = true
    current.dependency = "rate-1"
    expect(await port.readScope(refreshed, context)).toMatchObject({ status: "ok", value: { confirmationId: confirmation.value.id, state: "valid" } })
    current.physical = "physical-replacement"
    expect(await port.readScope(refreshed, context)).toMatchObject({ status: "ok", value: { confirmationId: confirmation.value.id, state: "stale", reason: "source-replaced" } })
    expect(await port.readScope({ ...refreshed, sourceRef: { ...refreshed.sourceRef, incarnation: "replacement-scope" } }, context)).toEqual({ status: "ok", value: null })
    expect(confirmation.value).toEqual(audit)
  } finally {
    await persistence.dispose()
    await rm(directory, { recursive: true, force: true })
  }
})
