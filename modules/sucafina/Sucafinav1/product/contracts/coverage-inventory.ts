import { RENEWAL_TRANSITION_CATEGORIES } from "./decisions.ts"
import type { CostCoverageBasis } from "./decisions.ts"

/** Unknown inventories cannot support a completeness claim. Amounts stay in the Planner. */
export function requiredSfCostCategories(basis: CostCoverageBasis): readonly string[] | undefined {
  if (basis.decisionType !== "renewal-transition-v1" || !basis.id.trim() || !Number.isSafeInteger(basis.version) || basis.version < 1) return undefined
  if (basis.categoryIds.length !== RENEWAL_TRANSITION_CATEGORIES.length || new Set(basis.categoryIds).size !== basis.categoryIds.length) return undefined
  if (!RENEWAL_TRANSITION_CATEGORIES.every((category) => basis.categoryIds.includes(category))) return undefined
  if (basis.additionalCategoryIds.some((category) => !category.trim() || basis.categoryIds.includes(category)) || new Set(basis.additionalCategoryIds).size !== basis.additionalCategoryIds.length) return undefined
  if (basis.additionalCategoryIds.length && !basis.sourceRefs.length) return undefined
  return [...RENEWAL_TRANSITION_CATEGORIES, ...basis.additionalCategoryIds]
}
