import type { SF_U17_COPY } from "@/i18n/orchestra-chapters/sf-u17"

type CopyKey = keyof typeof SF_U17_COPY

// Exact categories owned by product/contracts/decisions.ts. Additional
// producer categories retain their original text instead of an inferred name.
const categoryKeys = {
  service: "sf.ui36.category.service",
  service_overlap: "sf.ui36.category.serviceOverlap",
  implementation: "sf.ui36.category.implementation",
  contract_exit: "sf.ui36.category.contractExit",
  migration: "sf.ui36.category.migration",
  taxes: "sf.ui36.category.taxes",
  training: "sf.ui36.category.training",
  internal_costs: "sf.ui36.category.internalCosts",
  other_relevant_costs: "sf.ui36.category.otherCosts",
} as const satisfies Readonly<Record<string, CopyKey>>

// Codes emitted by product/decisions/cost-coverage.ts and product/planner/port.ts.
// A producer-authored reason that is not one of these codes is never translated.
const issueKeys = {
  "inventory-unavailable": "sf.ui36.issue.inventoryUnavailable",
  "evidence-unavailable": "sf.ui36.issue.evidenceUnavailable",
  "basis-evidence-unavailable": "sf.ui36.issue.basisEvidenceUnavailable",
  "uncategorized-component": "sf.ui36.issue.uncategorizedComponent",
  "unexpected-category": "sf.ui36.issue.unexpectedCategory",
  "duplicate-component": "sf.ui36.issue.duplicateComponent",
  "missing-category": "sf.ui36.issue.missingCategory",
  "duplicate-category": "sf.ui36.issue.duplicateCategory",
  "scope-not-supported": "sf.ui36.issue.scopeNotSupported",
  "missing-justification": "sf.ui36.issue.missingJustification",
  "duplicate-component-ref": "sf.ui36.issue.duplicateComponentRef",
  "component-unresolved": "sf.ui36.issue.componentUnresolved",
  "cost-coverage-unavailable": "sf.ui36.issue.coverageUnavailable",
  "cost-coverage-unresolved-or-source-mismatch": "sf.ui36.issue.coverageUnresolved",
  "non-finite-forecast-difference": "sf.ui36.issue.nonFiniteDifference",
} as const satisfies Readonly<Record<string, CopyKey>>

export function sfDecisionCategoryKey(value: string): CopyKey | undefined {
  return Object.hasOwn(categoryKeys, value) ? categoryKeys[value as keyof typeof categoryKeys] : undefined
}

export function sfDecisionIssueKey(value: string): CopyKey | undefined {
  return Object.hasOwn(issueKeys, value) ? issueKeys[value as keyof typeof issueKeys] : undefined
}

export function sfDecisionGap(value: string): Readonly<{
  code: string
  label?: CopyKey
  category?: CopyKey
  reason?: string
  reasonKey?: CopyKey
}> {
  const label = sfDecisionIssueKey(value)
  if (label) return { code: value, label }
  // This prefix is emitted by product/planner/scenario-port.ts. Only the
  // closed category names above are parsed; unknown extensions stay literal.
  const coverage = /^coverage:([^:]+):(.+)$/s.exec(value)
  const category = coverage ? sfDecisionCategoryKey(coverage[1]!) : undefined
  if (!coverage || !category) return { code: value }
  const reason = coverage[2]!
  return { code: value, category, reason, reasonKey: sfDecisionIssueKey(reason) }
}
