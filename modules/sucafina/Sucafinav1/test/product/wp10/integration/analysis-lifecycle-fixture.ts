import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { digestSfContribution, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { SfNativeRunRecord } from "../../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfRunStore, sfRunSourceFence } from "../../../../product/ai/run-store.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { object } from "../../../../runtime/contract.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfAnalysisLifecycleContext, createSfAnalysisRunContext } from "../../../../../../../apps/cli/src/sucafina-product/analysis-run-context.ts"
import { createSfStaleAnalysisAccess } from "../../../../../../../apps/cli/src/sucafina-product/analysis-stale-commit.ts"
import { sfCaseFixture, sfRunFixture } from "../../wp12/run-fixture.ts"

/** Real Request admission, C08, shared SQLite scope and source fences. Imported
 * run/output records are explicit structural fixtures, never native witnesses.
 * No provider/Task executes and the only admitted fresh write is the exact
 * preparing record; output verification stays unavailable. */
export async function analysisLifecycleFixture(options: { seedRun?: boolean; signal?: AbortSignal } = {}) {
  const directory = await mkdtemp(join(await realpath(tmpdir()), "sf-analysis-lifecycle-"))
  await chmod(directory, 0o700)
  const driver = await openLocalStore(join(directory, "store"))
  const persistence = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID,
    projectScope: createSfSourceScopeProjector(() => "2026-11-14T00:00:00Z") })
  for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
  await persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.lifecycleSource = { version: 1 }
    return { commit: true, value: undefined }
  })
  const active = { host: true, access: true }
  const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
  const proposalCoverageWrites = new WeakSet<object>()
  const authority = createSfProductAuthority({ identity: () => active.host ? { installationId: "installation", hostId: "host", projectId: "project", location } : undefined,
    installationId: "installation", origin: "https://example.test", policyVersion: "policy", persistence, proposalCoverageWrites,
    grants: [{ principalRef: "person", namespaces: ["cases", "contributions"], operations: ["sf_case_read"], humanActions: ["analysis.start", "analysis.read", "analysis.cancel"] }],
    createId: randomUUID, now: Date.now, commandIdentity: async (request) => request.headers.get("x-operation") ?? undefined,
    authenticate: async (request, selection) => active.access && request.headers.get("authorization") === "person" && selection
      ? { id: "person", canWrite: true, roles: [{ surface: selection.surface, role: "admin" }] } : null,
    environment: async () => ({ at: "2026-11-14T00:00:00Z", id: randomUUID, directory: [{ id: "person", name: "Person" }] }),
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites })
  const request = new Request("https://example.test/dashboard", { method: "POST", signal: options.signal,
    headers: { origin: "https://example.test", authorization: "person", "x-operation": "original-analysis-intent" } })
  const original = sfRunFixture()
  const analysisRequest = { caseRef: original.caseRef, profileId: original.profile.id, profileVersion: original.profile.version,
    skillId: original.skill.id, skillVersion: original.skill.version, manifestDigest: original.receipt.manifestDigest,
    outputSchemaVersion: "sf-contribution-v1", requestedOperationScope: [], objective: original.run.objective, contextFingerprint: original.run.contextFingerprint }
  const start = { request: analysisRequest, skillInput: {}, model: original.run.model }
  const admission = await authority.human.admit(request, "analysis.start", start)
  if (admission.status !== "ok") throw new Error(admission.reason)
  const binding = admission.value.binding
  authority.human.finish(admission.value)
  const run: SfNativeRunRecord = { ...original.run, principalRef: binding.principalRef, policyVersion: binding.policyVersion,
    accessRevision: binding.accessRevision, intentDigest: digestSfValue(start), requestDigest: digestSfValue(analysisRequest), skillInputDigest: digestSfValue({}) }
  const { native: _native, outputRef: _outputRef, ...withoutNative } = run
  const preparing: SfNativeRunRecord = { ...withoutNative, state: "preparing", version: 1 }
  const output = { ...original.output, accessRevision: binding.accessRevision }
  output.outputDigest = digestSfContribution(output)
  const initialCase = sfCaseFixture(run.caseRef, [binding.principalRef])
  const created = await authority.state.transaction(request, { namespace: "cases", expectedStorageVersion: 0,
    targetRef: authority.creationTarget.ref, targetIncarnation: authority.creationTarget.incarnation,
    idempotencyKey: "fixture-case", commandDigest: digestSfValue(initialCase) }, async (state) => {
    state.cases[run.caseRef.id] = initialCase
    return { commit: true, value: true }
  })
  if (created.status !== "ok") throw new Error("Lifecycle fixture case unavailable")
  const sourceFence = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
  const seed = async (value: SfNativeRunRecord, storedOutput = false) => persistence.transaction("dashboard", async (snapshot) => {
    const state = object(snapshot.data.__sfProductV1)
    state.nativeRuns = { ...object(state.nativeRuns), [value.runRef]: structuredClone(value) }
    state.contributions = storedOutput ? { [output.id]: structuredClone(output) } : {}
    state.revision = Number(state.revision) + 1
    const versions = object(state.versions)
    versions.contributions = Number(versions.contributions ?? 0) + 1
    return { commit: true, value: undefined }
  })
  if (options.seedRun !== false) await seed(run)
  const proof = { runRef: run.runRef, caseRef: run.caseRef, contextFingerprint: run.contextFingerprint }
  const lifecycle = createSfAnalysisLifecycleContext({ authority, persistence, request, start, proof, active: () => active.host })
  const counts = { sources: 0, preflight: 0 }
  const stale = createSfStaleAnalysisAccess({ authority, persistence, request, start, proof: { ...proof, evidenceRefs: [] }, lifecycle,
    context: { context: async () => { counts.sources++; throw new Error("Fixture source content unavailable") } } })
  const hooks: { commit?: (call: TrustedDomainContext) => Promise<void> } = {}
  const store = stale.wrapStore(createSfRunStore({ state: authority.state, requestFor: authority.host.requestFor, revalidate: authority.host.revalidate,
    preflight: async (record, call, content) => {
      counts.preflight++
      if (content || !await authority.human.authorize(call, "analysis.start", start) || authority.host.requestFor(call) !== request)
        return { status: "denied", reason: "fixture-fresh-authority-unavailable" }
      const current = await persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: sfRunSourceFence(snapshot) }))
      return current === sourceFence && record.contextFingerprint === proof.contextFingerprint
        ? { status: "ok", value: { sourceFence } } : { status: "stale", reason: "fixture-source-changed" }
    },
    revalidateForCommit: async (record, call, snapshot, content, alternative) => {
      await hooks.commit?.(call)
      if (lifecycle.owns(call)) return lifecycle.commit(record, call, snapshot, content, alternative)
      if (record.state === "cancelled") return stale.commitCancellation(record, call, snapshot)
      if (record.state === "stale") return stale.commit(record, call, snapshot, content)
      const exact = digestSfValue(record) === digestSfValue(preparing)
      return exact && !content && !alternative && sfRunSourceFence(snapshot) === sourceFence &&
        authority.host.requestFor(call) === request && !request.signal.aborted &&
        await authority.human.authorize(call, "analysis.start", start) && await authority.host.revalidate(call)
        ? { status: "ok", value: true } : { status: "denied", reason: "fixture-fresh-write-unavailable" }
    }, now: () => "2026-11-14T00:00:00Z" }))
  const replayContexts = new WeakMap<TrustedDomainContext, string>()
  const withRunContext = createSfAnalysisRunContext({ authority, business, request, runRef: run.runRef, caseRef: run.caseRef, start,
    active: () => active.host, replayContexts })
  const changeSource = () => persistence.transaction("dashboard", async (snapshot) => {
    snapshot.data.lifecycleSource = { version: Number(object(snapshot.data.lifecycleSource).version) + 1 }
    return { commit: true, value: undefined }
  })
  const read = () => authority.state.read(request, "contributions", (state) => ({ run: state.nativeRuns?.[run.runRef], output: state.contributions[output.id] }))
  return { authority, business, persistence, driver, directory, location, active, request, start, analysisRequest, run, preparing, output,
    lifecycle, store, counts, hooks, seed, changeSource, read, withRunContext, replayContexts,
    dispose: async () => { business.dispose(); await driver.dispose(); await rm(directory, { recursive: true, force: true }) } }
}
