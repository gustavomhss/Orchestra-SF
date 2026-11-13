import { digestSfValue } from "../contracts/canonical.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { biViews } from "./catalog.ts"

export type ApprovedView = { id: string; version: number; allowedFilters: readonly string[] }
export type ApprovedFilter = { field: string; values: readonly string[] }
export type ApprovedSelection = { viewId: string; version: number; filters: readonly ApprovedFilter[] }
export type ApprovedResolution = { projectionRefs: readonly string[]; tableRef: string }
export type ApprovedCatalogHost = {
  revalidate: (context: TrustedDomainContext) => Promise<boolean>
  resolve: (selection: ApprovedSelection, context: TrustedDomainContext) => Promise<ApprovedResolution | null>
}

/** Catalog entries are supplied by the trusted host; this module grants no views by itself. */
export function createApprovedCatalog(views: readonly ApprovedView[]) {
  const catalog = new Map<string, ApprovedView>()
  for (const view of views) {
    if (!biViews.some((entry) => entry.id === view.id) || !Number.isSafeInteger(view.version) || view.version < 1 || !Array.isArray(view.allowedFilters) || view.allowedFilters.some((filter) => typeof filter !== "string" || !filter.trim()) || new Set(view.allowedFilters).size !== view.allowedFilters.length || catalog.has(view.id)) throw new Error("invalid-approved-catalog")
    catalog.set(view.id, { ...view, allowedFilters: [...view.allowedFilters] })
  }

  return {
    views: [...catalog.values()].map((view) => ({ ...view, allowedFilters: [...view.allowedFilters] })),
    async resolve(selection: ApprovedSelection, context: TrustedDomainContext, host: ApprovedCatalogHost) {
      const selected = structuredClone(selection)
      const view = catalog.get(selected.viewId)
      if (!view || view.version !== selected.version || !Array.isArray(selected.filters) || selected.filters.some((filter: ApprovedFilter) => !filter || typeof filter.field !== "string" || !view.allowedFilters.includes(filter.field) || !Array.isArray(filter.values) || !filter.values.length || filter.values.some((value: unknown) => typeof value !== "string" || !value.trim()) || new Set(filter.values).size !== filter.values.length) || new Set(selected.filters.map((filter: ApprovedFilter) => filter.field)).size !== selected.filters.length) return null
      const revision = digestSfValue(selected)
      if (!(await host.revalidate(context))) return null
      const forwarded = structuredClone(selected)
      const resolved = await host.resolve(forwarded, context)
      if (!resolved || digestSfValue(forwarded) !== revision) return null
      // Retained host objects cannot replace the resolved references during the final fence.
      const snapshot = structuredClone(resolved)
      if (!(await host.revalidate(context)) || digestSfValue(forwarded) !== revision || typeof snapshot.tableRef !== "string" || !snapshot.tableRef.trim() || !Array.isArray(snapshot.projectionRefs) || !snapshot.projectionRefs.length || snapshot.projectionRefs.some((ref: unknown) => typeof ref !== "string" || !ref.trim()) || new Set(snapshot.projectionRefs).size !== snapshot.projectionRefs.length) return null
      return { viewId: view.id, version: view.version, projectionRefs: [...snapshot.projectionRefs], tableRef: snapshot.tableRef }
    },
  }
}
