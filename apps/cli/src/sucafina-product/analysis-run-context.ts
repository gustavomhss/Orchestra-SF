import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfNativeRunRecord } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Persistence, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { createSfBusinessServices } from "./business-services.ts"

/** Reenter a run under its original human intent without upgrading its selected case.
 * Lifecycle readers may reach a newer version of the same authorized case. The
 * selector stays at the original version, so fresh domain execution still refuses drift. */
export function createSfAnalysisRunContext(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "human">
  business: Pick<ReturnType<typeof createSfBusinessServices>, "withCase">
  request: Request
  runRef: string
  caseRef: SfNativeRunRecord["caseRef"]
  start: unknown
  active: () => boolean
  replayContexts: WeakMap<TrustedDomainContext, string>
}) {
  const selected = structuredClone(input.caseRef)
  const start = structuredClone(input.start)
  return async <T>(id: string, action: (call: TrustedDomainContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    const denied = (): PortResult<T> => ({ status: "denied", reason: "analysis-authority-unavailable" })
    if (id !== input.runRef || input.request.signal.aborted || !input.active()) return denied()
    const admitted = await input.authority.human.admit(input.request, "analysis.start", start)
    if (admitted.status !== "ok") return admitted
    const call = admitted.value
    input.replayContexts.set(call, input.runRef)
    try {
      const result = await input.business.withCase(call, selected, { allowHistoricalRetry: true }, () => action(call))
      const current = await input.authority.human.authorize(call, "analysis.start", start)
      return current && !input.request.signal.aborted && input.active() && input.authority.host.requestFor(call) === input.request &&
        input.replayContexts.get(call) === input.runRef ? result : denied()
    } finally {
      input.replayContexts.delete(call)
      input.authority.human.finish(call)
    }
  }
}

/** Private metadata scope for the original human start. It grants neither a case
 * selector nor replay authority. Fresh execution and contribution content continue
 * through createSfAnalysisRunContext and the existing source/receipt verifiers. */
export function createSfAnalysisLifecycleContext(input: {
  authority: Pick<ReturnType<typeof createSfProductAuthority>, "host" | "human" | "state">
  persistence: Pick<Persistence, "currentSnapshots" | "transactionAll">
  request: Request
  start: unknown
  proof: { runRef: string; caseRef: SfNativeRunRecord["caseRef"]; contextFingerprint: string }
  active: () => boolean
}) {
  const request = input.request
  const start = structuredClone(input.start)
  const proof = structuredClone(input.proof)
  const intentDigest = digestSfValue(start)
  type Frame = { binding: TrustedDomainContext["binding"]; lease: TrustedDomainContext["lease"]; identity: string;
    runDigest?: string; runIdentity?: string; caseDigest?: string; committedDigest?: string }
  const frames = new WeakMap<TrustedDomainContext, Frame>()
  const denied = () => ({ status: "denied", reason: "analysis-lifecycle-authority-unavailable" } as const)
  const runIdentity = (run: unknown) => {
    const { state: _state, version: _version, updatedAt: _at, reason: _reason, ...identity } = object(run)
    return digestSfValue(identity)
  }
  const current = (call: TrustedDomainContext) => {
    const frame = frames.get(call)
    return !!frame && call.kind === "ui" && call.binding === frame.binding && call.lease === frame.lease &&
      digestSfValue([call.kind, call.binding]) === frame.identity && input.request === request && !request.signal.aborted &&
      input.active() && input.authority.host.requestFor(call) === request
  }
  const authorized = async (call: TrustedDomainContext) => current(call) &&
    await input.authority.human.authorize(call, "analysis.start", start) && current(call) &&
    await input.authority.host.revalidate(call) && current(call)
  const matchesRun = (run: SfNativeRunRecord, call: TrustedDomainContext) => run.runRef === proof.runRef &&
    digestSfValue(run.caseRef) === digestSfValue(proof.caseRef) && run.contextFingerprint === proof.contextFingerprint &&
    run.intentDigest === intentDigest && Number.isSafeInteger(run.version) && run.version > 0 &&
    run.principalRef === call.binding.principalRef && run.policyVersion === call.binding.policyVersion && run.accessRevision === call.binding.accessRevision
  const readLockedMembership = async (call: TrustedDomainContext) => {
    const snapshots = input.persistence.currentSnapshots?.()
    if (!snapshots) return undefined
    const snapshotDigest = digestSfValue(snapshots)
    if (!await authorized(call)) return undefined
    const run = await input.authority.state.read(request, "contributions", (state, actor) => {
      const value = state.nativeRuns?.[proof.runRef]
      return value && actor.principalRef === call.binding.principalRef && actor.policyVersion === call.binding.policyVersion &&
        actor.accessRevision === call.binding.accessRevision && matchesRun(value, call) ? structuredClone(value) : undefined
    })
    if (!current(call) || run.status !== "ok" || !run.value) return undefined
    const selected = await input.authority.state.read(request, "cases", (state, actor) => {
      const value = state.cases[proof.caseRef.id]
      return value && value.id === proof.caseRef.id && value.incarnation === proof.caseRef.incarnation &&
        Number.isSafeInteger(value.version) && value.version >= proof.caseRef.version && value.participants.includes(actor.principalRef) &&
        actor.principalRef === call.binding.principalRef && actor.policyVersion === call.binding.policyVersion &&
        actor.accessRevision === call.binding.accessRevision ? digestSfValue(value) : undefined
    })
    if (!current(call) || selected.status !== "ok" || !selected.value || !await authorized(call) ||
      digestSfValue(input.persistence.currentSnapshots?.()) !== snapshotDigest) return undefined
    return { runDigest: digestSfValue(run.value), runIdentity: runIdentity(run.value), caseDigest: selected.value }
  }
  // Namespace grants, membership and final Request revalidation share C08's read
  // lock. No source resolver or writer runs here, and nothing can replace a case
  // between its membership read and the authority check that releases metadata.
  const readMembership = (call: TrustedDomainContext) => input.persistence.currentSnapshots?.()
    ? readLockedMembership(call)
    : input.persistence.transactionAll?.(async () => ({ commit: false, value: await readLockedMembership(call) }), { signal: request.signal })
  const withContext = async <T>(id: string, action: (call: TrustedDomainContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    if (id !== proof.runRef || input.request !== request || request.signal.aborted || !input.active()) return denied()
    const admitted = await input.authority.human.admit(request, "analysis.start", start)
    if (admitted.status !== "ok") return admitted
    const call = admitted.value
    const frame: Frame = { binding: call.binding, lease: call.lease, identity: digestSfValue([call.kind, call.binding]) }
    frames.set(call, frame)
    try {
      const first = await readMembership(call)
      if (!first || !current(call)) return denied()
      Object.assign(frame, first)
      const result = await action(call)
      const resultDigest = digestSfValue(result)
      const again = await readMembership(call)
      if (!again || !current(call) || again.runIdentity !== frame.runIdentity || again.caseDigest !== frame.caseDigest ||
        (result.status === "ok" && frame.committedDigest && again.runDigest !== frame.committedDigest) ||
        digestSfValue(result) !== resultDigest) return denied()
      return structuredClone(result)
    } catch {
      return { status: "unavailable", reason: "analysis-lifecycle-scope-unavailable" }
    } finally {
      frames.delete(call)
      input.authority.human.finish(call)
    }
  }
  return {
    withContext,
    owns: (call: TrustedDomainContext) => frames.has(call),
    /** C08 owns the version/CAS and stored-output observation. This guard allows
     * only terminal metadata over the exact admitted predecessor; it never accepts
     * caller content, an alternative capture, a ready write, or cancellation intent. */
    commit: async (record: SfNativeRunRecord, call: TrustedDomainContext, snapshot: Readonly<Snapshot>, output?: unknown, alternative?: unknown): Promise<PortResult<true>> => {
      const frame = frames.get(call)
      if (!frame || output !== undefined || alternative !== undefined || !["stale", "failed", "unavailable", "needs-input"].includes(record.state) ||
        !matchesRun(record, call) || !await authorized(call)) return denied()
      const snapshotDigest = digestSfValue(snapshot)
      const snapshots = input.persistence.currentSnapshots?.()
      if (!snapshots || digestSfValue(snapshots.dashboard) !== snapshotDigest) return denied()
      const stored = object(snapshot.data.__sfProductV1)
      const original = object(object(stored.nativeRuns)[proof.runRef])
      const selected = object(object(stored.cases)[proof.caseRef.id])
      const recordDigest = digestSfValue(record)
      const validPrior = record.state === "stale" ? ["queued", "running", "ready"].includes(String(original.state)) && !!original.native
        : ["preparing", "queued", "running"].includes(String(original.state))
      if (!validPrior || !frame.runDigest || digestSfValue(original) !== frame.runDigest ||
        typeof original.version !== "number" || !Number.isSafeInteger(original.version) || record.version !== original.version + 1 ||
        runIdentity(record) !== runIdentity(original) || runIdentity(original) !== frame.runIdentity ||
        !Number.isFinite(Date.parse(record.updatedAt)) || (record.reason !== undefined && typeof record.reason !== "string") ||
        selected.id !== proof.caseRef.id || selected.incarnation !== proof.caseRef.incarnation ||
        typeof selected.version !== "number" || !Number.isSafeInteger(selected.version) || selected.version < proof.caseRef.version ||
        !Array.isArray(selected.participants) || !selected.participants.includes(call.binding.principalRef) ||
        digestSfValue(selected) !== frame.caseDigest) return denied()
      if (!await authorized(call) || digestSfValue(record) !== recordDigest || digestSfValue(snapshot) !== snapshotDigest ||
        digestSfValue(input.persistence.currentSnapshots?.()?.dashboard) !== snapshotDigest) return denied()
      frame.committedDigest = recordDigest
      return { status: "ok", value: true }
    },
  }
}
