import { digestSfEvidenceRef, digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessContextService, BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { ContributionEnvelope } from "../../../../modules/sucafina/Sucafinav1/product/contracts/resident-ai.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { sfRunSourceFence } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import type { createSfRunStore } from "../../../../modules/sucafina/Sucafinav1/product/ai/run-store.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Persistence, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfAnalysisLifecycleContext } from "./analysis-run-context.ts"

/** Stale is a lifecycle settlement, never a fresh analysis or a new execution grant.
 * Current source access is re-opened under C08; original record/output CAS stays in the run store. */
export function createSfStaleAnalysisAccess(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "human">
  persistence: Pick<Persistence, "transactionAll" | "currentSnapshots">
  context: Pick<BusinessContextService, "context">
  request: Request
  start: unknown
  proof: { runRef: string; caseRef: SfNativeRunRecord["caseRef"]; contextFingerprint: string; evidenceRefs: readonly BusinessEvidenceRef[] }
  lifecycle?: Pick<ReturnType<typeof createSfAnalysisLifecycleContext>, "owns">
}) {
  const proof = structuredClone(input.proof)
  const start = structuredClone(input.start)
  const prepared = new WeakMap<TrustedDomainContext, { identity: string; fences: string }>()
  const cancellations = new WeakMap<TrustedDomainContext, { request: Request; record: SfNativeRunRecord }>()
  const recordIdentity = (record: SfNativeRunRecord, call: TrustedDomainContext, output?: ContributionEnvelope) => {
    const { updatedAt: _clock, reason: _reason, ...value } = record
    return digestSfValue([value, output, call.kind, call.binding])
  }
  const fences = (snapshots: Readonly<Record<"dashboard" | "planner" | "procurement", Snapshot>>) =>
    digestSfValue(Object.fromEntries(Object.entries(snapshots).map(([surface, snapshot]) => [surface, sfRunSourceFence(snapshot)])))
  const refsFor = (output?: ContributionEnvelope) => structuredClone([...proof.evidenceRefs, ...(output?.evidenceRefs ?? [])])
    .filter((ref, index, all) => all.findIndex((item) => digestSfValue(item) === digestSfValue(ref)) === index)
  const locked = async (record: SfNativeRunRecord, call: TrustedDomainContext, output?: ContributionEnvelope, preparing = false): Promise<PortResult<{ sourceFence: string }>> => {
    const denied = () => ({ status: "denied", reason: "analysis-stale-access-unavailable" } as const)
    try {
      const snapshots = input.persistence.currentSnapshots?.()
      const identity = digestSfValue([record, output, call.kind, call.binding])
      if (!snapshots || record.state !== "stale" || record.runRef !== proof.runRef || record.contextFingerprint !== proof.contextFingerprint ||
        digestSfValue(record.caseRef) !== digestSfValue(proof.caseRef) || input.request.signal.aborted ||
        input.authority.host.requestFor(call) !== input.request || record.principalRef !== call.binding.principalRef ||
        record.policyVersion !== call.binding.policyVersion || record.accessRevision !== call.binding.accessRevision ||
        !await input.authority.human.authorize(call, "analysis.start", start) || !await input.authority.host.revalidate(call)) return denied()
      const prior = prepared.get(call)
      if (!preparing && (!prior || prior.identity !== recordIdentity(record, call, output) || prior.fences !== fences(snapshots)))
        return { status: "stale", reason: "analysis-stale-source-changed" }
      const current = object(object(object(snapshots.dashboard.data.__sfProductV1).cases)[record.caseRef.id])
      if (current.incarnation !== record.caseRef.incarnation || typeof current.version !== "number" || !Number.isSafeInteger(current.version) ||
        current.version < record.caseRef.version || !Array.isArray(current.participants) || !current.participants.includes(call.binding.principalRef)) return denied()
      const refs = refsFor(output)
      const valid = (ref: BusinessEvidenceRef) => ref.installationId === call.binding.installationId && ref.projectId === call.binding.projectId && ref.refDigest === digestSfEvidenceRef(ref)
      if (refs.some((ref) => !valid(ref))) return denied()
      const sources = await input.context.context({ refs: structuredClone(refs) }, call)
      if (sources.length !== refs.length || sources.some((source, index) => digestSfValue(source.ref) !== digestSfValue(refs[index]) ||
        source.accessRevision !== call.binding.accessRevision || !source.currentRef || !valid(source.currentRef) || !source.authorizedProjection ||
        (source.state === "fresh" ? digestSfValue(source.currentRef) !== digestSfValue(source.ref)
          : source.state !== "historical" || !Array.isArray(source.differences)))) return denied()
      // The real context producer verifies original capture and continuity. No old fingerprint
      // is accepted as authority, and no await is left after these final identity checks.
      if (!await input.authority.human.authorize(call, "analysis.start", start) || !await input.authority.host.revalidate(call) ||
        input.authority.host.requestFor(call) !== input.request || input.request.signal.aborted ||
        identity !== digestSfValue([record, output, call.kind, call.binding]) ||
        digestSfValue(input.persistence.currentSnapshots?.()) !== digestSfValue(snapshots)) return denied()
      if (preparing) prepared.set(call, { identity: recordIdentity(record, call, output), fences: fences(snapshots) })
      return { status: "ok", value: { sourceFence: sfRunSourceFence(snapshots.dashboard) } }
    } catch {
      return { status: "unavailable", reason: "analysis-stale-access-unavailable" }
    }
  }
  const preflight = async (record: SfNativeRunRecord, call: TrustedDomainContext, output?: ContributionEnvelope): Promise<PortResult<{ sourceFence: string }>> => {
      if (input.persistence.currentSnapshots?.()) return locked(record, call, output, true)
      if (!input.persistence.transactionAll) return { status: "unavailable", reason: "analysis-stale-scope-unavailable" }
      if (input.authority.host.requestFor(call) !== input.request || input.request.signal.aborted ||
        !await input.authority.human.authorize(call, "analysis.start", start)) return { status: "denied", reason: "analysis-stale-access-unavailable" }
      // Scoped source identities may refresh on the first read. Finish that work before
      // entering C08; the second real read and the commit both retain the shared lock.
      await input.context.context({ refs: refsFor(output) }, call)
      return input.persistence.transactionAll(async () => ({ commit: false, value: await locked(record, call, output, true) }), { signal: input.request.signal })
  }
  return {
    preflight,
    commit: async (record: SfNativeRunRecord, call: TrustedDomainContext, snapshot: Readonly<Snapshot>, output?: ContributionEnvelope): Promise<PortResult<true>> => {
      const current = input.persistence.currentSnapshots?.()
      if (!current || digestSfValue(current.dashboard) !== digestSfValue(snapshot)) return { status: "unavailable", reason: "analysis-stale-scope-unavailable" }
      const checked = await locked(record, call, output)
      return checked.status === "ok" ? { status: "ok", value: true } : checked
    },
    commitCancellation: async (record: SfNativeRunRecord, call: TrustedDomainContext, snapshot: Readonly<Snapshot>): Promise<PortResult<true>> => {
      const denied = () => ({ status: "denied", reason: "analysis-cancellation-unavailable" } as const)
      const prior = cancellations.get(call)
      const snapshots = input.persistence.currentSnapshots?.()
      if (!prior?.record.native || !snapshots || digestSfValue(snapshots.dashboard) !== digestSfValue(snapshot) ||
        record.state !== "cancelled" || record.runRef !== proof.runRef || digestSfValue(record.caseRef) !== digestSfValue(proof.caseRef) ||
        prior.request.signal.aborted || input.authority.host.requestFor(call) !== prior.request ||
        !await input.authority.human.authorize(call, "analysis.cancel", { runRef: record.runRef }) || !await input.authority.host.revalidate(call)) return denied()
      const original = object(snapshot.data.__sfProductV1)
      const current = object(object(original.cases)[record.caseRef.id])
      const expected: SfNativeRunRecord = { ...prior.record, native: prior.record.native, state: "cancelled", version: prior.record.version + 1 }
      const identity = digestSfValue([record, call.kind, call.binding, snapshot])
      if (digestSfValue(object(original.nativeRuns)[record.runRef]) !== digestSfValue(prior.record) ||
        recordIdentity(record, call) !== recordIdentity(expected, call) || record.principalRef !== call.binding.principalRef ||
        record.accessRevision !== call.binding.accessRevision || record.policyVersion !== call.binding.policyVersion ||
        current.incarnation !== record.caseRef.incarnation || typeof current.version !== "number" || !Number.isSafeInteger(current.version) ||
        current.version < record.caseRef.version || !Array.isArray(current.participants) || !current.participants.includes(call.binding.principalRef)) return denied()
      if (!await input.authority.human.authorize(call, "analysis.cancel", { runRef: record.runRef }) || !await input.authority.host.revalidate(call) ||
        prior.request.signal.aborted || input.authority.host.requestFor(call) !== prior.request ||
        identity !== digestSfValue([record, call.kind, call.binding, snapshot])) return denied()
      return { status: "ok", value: true }
    },
    wrapStore: (store: ReturnType<typeof createSfRunStore>): ReturnType<typeof createSfRunStore> => {
      const prepare = async (runRef: string, call: TrustedDomainContext, output: ContributionEnvelope | undefined, nextVersion: number | undefined,
        action: () => Promise<PortResult<SfNativeRunRecord>>): Promise<PortResult<SfNativeRunRecord>> => {
        try {
          const prior = await store.readLifecycle(runRef, call)
          if (prior.status !== "ok") return prior
          if (!prior.value.native) return { status: "conflict", reason: "invalid-run-transition" }
          const retained = output && (prior.value.state === "ready" || output.kind !== "AlternativeDraft") ? output : undefined
          const next: SfNativeRunRecord = { ...prior.value, native: prior.value.native, state: "stale", version: nextVersion ?? prior.value.version + 1,
            ...(retained ? { outputRef: retained.id } : {}) }
          const checked = await preflight(next, call, retained)
          return checked.status === "ok" ? await action() : checked
        } finally { prepared.delete(call) }
      }
      const cancel = async (runRef: string, expectedVersion: number, reason: string | undefined, call: TrustedDomainContext): Promise<PortResult<SfNativeRunRecord>> => {
        try {
          const request = input.authority.host.requestFor(call)
          if (!request || request.signal.aborted || runRef !== proof.runRef ||
            !await input.authority.human.authorize(call, "analysis.cancel", { runRef })) return { status: "denied", reason: "analysis-cancellation-unavailable" }
          const prior = await store.readLifecycle(runRef, call)
          if (prior.status !== "ok") return prior
          if (!prior.value.native || prior.value.version !== expectedVersion) return { status: "conflict", reason: "invalid-run-transition" }
          cancellations.set(call, { request, record: structuredClone(prior.value) })
          return await store.transition(runRef, expectedVersion, "cancelled", reason, call)
        } finally { cancellations.delete(call) }
      }
      return { ...store,
        preserveStale: (runRef, reason, output, call) => {
          if (input.lifecycle?.owns(call)) return Promise.resolve({ status: "denied", reason: "analysis-lifecycle-content-unavailable" } as const)
          const captured = structuredClone(output)
          return prepare(runRef, call, captured, undefined, () => store.preserveStale(runRef, reason, captured, call))
        },
        markStale: (runRef, reason, call, observation) => {
          const copy = observation && structuredClone(observation)
          const captured = copy && Object.freeze({ ...copy, publication: Object.freeze({ ...copy.publication }) })
          return input.lifecycle?.owns(call) ? store.markStale(runRef, reason, call, captured)
            : prepare(runRef, call, undefined, undefined, () => store.markStale(runRef, reason, call, captured))
        },
        transition: (runRef, expectedVersion, state, reason, call) => {
          if (state === "cancelled") return cancel(runRef, expectedVersion, reason, call)
          if (state === "stale" && !input.lifecycle?.owns(call))
            return prepare(runRef, call, undefined, expectedVersion + 1, () => store.transition(runRef, expectedVersion, state, reason, call))
          return store.transition(runRef, expectedVersion, state, reason, call)
        },
      }
    },
  }
}
