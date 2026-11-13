import type { ImportChange } from "./changes.ts"
import type { ImportDetail } from "./store.ts"

/** Only explicit parser locations are called file provenance; domain-only changes retain the source reference. */
export function plannerImportDetail(input: { manifestId: string; version: number; sourceDigest: string; domainReference: string; changes: readonly ImportChange[]; locations: Readonly<Record<string, { sheet: string; row: number; column: number; address: string; field: string }>> }): ImportDetail {
  return {
    manifestId: input.manifestId,
    version: input.version,
    sourceDigest: input.sourceDigest,
    changes: input.changes.map((change) => {
      const location = input.locations[change.path]
      return { ...change, source: location ? { kind: "file" as const, ...location } : { kind: "domain" as const, reference: input.domainReference } }
    }),
  }
}
