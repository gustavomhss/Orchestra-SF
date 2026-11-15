import type { DomainPortHost } from "../contracts/ports.ts"
import type { SourceRef } from "../contracts/context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfValue } from "../contracts/canonical.ts"

/** The immutable identity of a previously captured source, not a new selection. */
export type SfCapturedSourceIdentity = Pick<SourceRef, "surface" | "type" | "id" | "incarnation" | "version">

/**
 * Pure preflight for a historical evidence read. Never issue, revive or version a
 * source here: the authority of the original capture must still match this call
 * before any resolver is allowed to issue a current selector.
 *
 * True is NOT authorization to reveal content. Callers must still use the real
 * resolver, its source projection checks and its final reauthorization.
 */
export async function isSfCapturedSourceBoundToCurrentAccess(
  host: Pick<DomainPortHost, "requestFor" | "revalidate" | "persistence">,
  original: SfCapturedSourceIdentity,
  call: TrustedDomainContext,
): Promise<boolean> {
  const request = host.requestFor(call)
  const binding = digestSfValue([call.kind, call.binding])
  if (!request || request.signal.aborted || !original || !original.type?.trim() || !original.id?.trim() ||
    !original.incarnation?.trim() || !Number.isSafeInteger(original.version) || original.version < 1 ||
    !["dashboard", "planner", "procurement"].includes(original.surface) || !await host.revalidate(call)) return false

  const matched = await host.persistence.transaction(original.surface, async (snapshot) => {
    const entries = Object.values(snapshot.sfSources?.scopes ?? {})
      .filter((entry) => entry.incarnation === original.incarnation)
    const entry = entries.length === 1 ? entries[0] : undefined
    const source = snapshot.sfSources?.records[JSON.stringify([original.type, original.id])]
    return { commit: false, value: !!entry && entry.alive && !!source?.alive &&
      source.incarnation === entry.sourceIncarnation &&
      entry.scope.recordType === original.type && entry.scope.recordId === original.id &&
      entry.scope.principalRef === call.binding.principalRef &&
      entry.scope.accessRevision === call.binding.accessRevision &&
      entry.scope.policyVersion === call.binding.policyVersion &&
      entry.version >= original.version }
  }, { signal: request.signal }).catch(() => false)

  return matched && !request.signal.aborted && host.requestFor(call) === request &&
    binding === digestSfValue([call.kind, call.binding]) && await host.revalidate(call) &&
    host.requestFor(call) === request && !request.signal.aborted
}
