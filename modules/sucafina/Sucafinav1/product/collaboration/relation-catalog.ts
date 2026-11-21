import { digestSfEvidenceRef } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"

/** S0's operational C06 decision; permission still comes from current source authorization. */
export const RELATION_CATALOG = {
  "pmo-capex": [["dashboard", "projects"], ["dashboard", "capexProjects"]],
  "contract-supplier": [["dashboard", "contracts"], ["procurement", "procurement-supplier"]],
  "contract-request": [["dashboard", "contracts"], ["procurement", "procurement-request"]],
  "financial-line-request": [["dashboard", "opexEntries"], ["dashboard", "capexEntries"], ["procurement", "procurement-request"]],
  "handoff": [["dashboard", "hotTopics"]],
} as const

export function isAllowedRelationPair(kind: string, from: BusinessEvidenceRef, to: BusinessEvidenceRef): boolean {
  if (!from || !to || from.kind !== "record" || to.kind !== "record" || !from.target || !to.target || from.refId === to.refId || from.installationId !== to.installationId || from.projectId !== to.projectId || !from.target.incarnation || !to.target.incarnation) return false
  try {
    if (from.refDigest !== digestSfEvidenceRef(from) || to.refDigest !== digestSfEvidenceRef(to)) return false
  } catch {
    return false
  }
  const matches = (ref: typeof from, entry: readonly [string, string]) => ref.target.surface === entry[0] && ref.target.recordType === entry[1]
  if (kind === "handoff") return matches(to, RELATION_CATALOG.handoff[0]) && !matches(from, RELATION_CATALOG.handoff[0])
  if (kind === "financial-line-request") return (matches(from, RELATION_CATALOG[kind][2]) && RELATION_CATALOG[kind].slice(0, 2).some((entry) => matches(to, entry))) || (matches(to, RELATION_CATALOG[kind][2]) && RELATION_CATALOG[kind].slice(0, 2).some((entry) => matches(from, entry)))
  if (kind !== "pmo-capex" && kind !== "contract-supplier" && kind !== "contract-request") return false
  const entries = RELATION_CATALOG[kind]
  return (matches(from, entries[0]) && matches(to, entries[1])) || (matches(to, entries[0]) && matches(from, entries[1]))
}
