import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfNativeRunRecord, SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { alternativeProvenanceKey } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { AlternativeCapabilityProvenance } from "../../../../modules/sucafina/Sucafinav1/product/decisions/alternative-provenance.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"

/** The bridge owns live captures. The canonical run store atomically persists one with its output. */
export function createSfAlternativeCaptures(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  captures: Map<string, Map<string, AlternativeCapabilityProvenance>>
  proposalCoverageWrites: WeakSet<object>
  active: (record: AlternativeCapabilityProvenance) => boolean
}) {
  const host = input.authority.host
  const read = async (runRef: string, selector: { resultDigest: string } | { callId: string }, call: TrustedDomainContext): Promise<PortResult<{ run: SfNativeRunRecord; record: AlternativeCapabilityProvenance }>> => {
    const request = host.requestFor(call)
    if (!request || !runRef.trim() || !await host.revalidate(call)) return { status: "denied", reason: "alternative-capture-authority-unavailable" }
    const once = async () => {
      const found = await input.authority.state.read(request, "contributions", (state, actor) => {
        const run = state.nativeRuns?.[runRef], decision = run && state.cases[run.caseRef.id]
        return run && run.native && (run.state === "running" || run.state === "ready") && decision && decision.incarnation === run.caseRef.incarnation && decision.version === run.caseRef.version && decision.participants.includes(actor.principalRef) &&
          actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion &&
          run.principalRef === actor.principalRef && run.accessRevision === actor.accessRevision && run.policyVersion === actor.policyVersion &&
          (call.kind !== "native" || call.binding.runId === runRef && call.binding.nativeSessionId === run.native.sessionID) ? run : undefined
      })
      if (found.status !== "ok" || !found.value?.native) return undefined
      const run = found.value
      const matches = (record: AlternativeCapabilityProvenance) => record.receipt.runId === runRef && record.receipt.nativeSessionId === run.native!.sessionID &&
        record.receipt.principalRef === run.principalRef && record.receipt.accessRevision === run.accessRevision && record.policyVersion === run.policyVersion &&
        record.installationId === call.binding.installationId && record.projectId === call.binding.projectId && digestSfValue(record.caseRef) === digestSfValue(run.caseRef) &&
        ("resultDigest" in selector ? record.receipt.resultDigest === selector.resultDigest : record.receipt.callId === selector.callId)
      const live = [...input.captures.get(runRef)?.values() ?? []].filter((record) => matches(record) && input.active(record))
      if (live.length > 1) return undefined
      if (live.length === 1) return { run, record: live[0]! }
      if (run.state !== "ready") return undefined
      const saved = await input.authority.state.read(request, "preferences", (state, actor) => {
        if (actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion) return []
        return Object.entries(state.preferences).flatMap(([key, value]) => {
          if (!key.startsWith("sf:proposal-coverage:alternative-provenance:") || !value || typeof value !== "object" || !("schema" in value) || value.schema !== "sf-alternative-provenance-v1") return []
          const record = value as AlternativeCapabilityProvenance
          try {
            const { recordDigest, ...material } = record
            return key === alternativeProvenanceKey(record) && recordDigest === digestSfValue(material) && matches(record) ? [record] : []
          } catch { return [] }
        })
      })
      return saved.status === "ok" && saved.value.length === 1 ? { run, record: saved.value[0]! } : undefined
    }
    const first = await once(), second = await once()
    return first && second && digestSfValue(first) === digestSfValue(second) && await host.revalidate(call)
      ? { status: "ok", value: structuredClone(second) } : { status: "unavailable", reason: "alternative-capture-unavailable" }
  }
  // Only the trusted run-store instance receives this facade; its callback is never caller-supplied.
  const runState: SfProductStatePort = {
    read: input.authority.state.read,
    transaction: (request, command, work) => {
      if (command.namespace !== "contributions" || command.sourceFence !== "all" || command.additionalNamespaces?.some((entry) => entry.namespace !== "preferences"))
        return Promise.resolve({ status: "denied", reason: "run-store-state-scope-invalid" })
      input.proposalCoverageWrites.add(work)
      return input.authority.state.transaction(request, command, work).finally(() => input.proposalCoverageWrites.delete(work))
    },
  }
  return { runState, readByResult: (runRef: string, resultDigest: string, call: TrustedDomainContext) => read(runRef, { resultDigest }, call),
    readByCall: async (runRef: string, callId: string, call: TrustedDomainContext): Promise<PortResult<AlternativeCapabilityProvenance>> => {
      const found = await read(runRef, { callId }, call)
      return found.status === "ok" ? { status: "ok", value: found.value.record } : found
    },
    forOutput: async (runRef: string, resultDigest: string, call: TrustedDomainContext): Promise<PortResult<AlternativeCapabilityProvenance>> => {
      const found = await read(runRef, { resultDigest }, call)
      return found.status === "ok" ? { status: "ok", value: found.value.record } : found
    },
    matchesLive: (record: AlternativeCapabilityProvenance) => input.active(record) && [...input.captures.get(record.receipt.runId)?.values() ?? []]
      .filter((value) => value.receipt.callId === record.receipt.callId && digestSfValue(value) === digestSfValue(record)).length === 1,
  }
}
