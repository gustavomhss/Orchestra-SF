import type { SourceRef } from "../contracts/context.ts"
import { isSfPeriod } from "../contracts/validation.ts"

/** Match only an explicitly selected source incarnation and covered fields/period. */
export function matchesSelectedSources(refs: readonly SourceRef[], selected: readonly SourceRef[]) {
  return refs.length > 0 && refs.every((ref) => !!ref && Array.isArray(ref.fields) && ref.fields.length > 0 && !!ref.period && isSfPeriod(ref.period) && selected.some((candidate) =>
    !!candidate && Array.isArray(candidate.fields) && !!candidate.period && isSfPeriod(candidate.period) &&
    candidate.surface === ref.surface && candidate.type === ref.type && candidate.id === ref.id && candidate.incarnation === ref.incarnation &&
    ref.fields.every((field: string) => candidate.fields.includes(field)) && candidate.period.start <= ref.period.start && candidate.period.end >= ref.period.end,
  ))
}
