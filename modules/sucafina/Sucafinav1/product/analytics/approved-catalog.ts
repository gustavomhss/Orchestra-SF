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
      const view = catalog.get(selection.viewId)
      if (!view || view.version !== selection.version || !Array.isArray(selection.filters) || selection.filters.some((filter) => !filter || typeof filter.field !== "string" || !view.allowedFilters.includes(filter.field) || !Array.isArray(filter.values) || !filter.values.length || filter.values.some((value) => typeof value !== "string" || !value.trim()) || new Set(filter.values).size !== filter.values.length) || new Set(selection.filters.map((filter) => filter.field)).size !== selection.filters.length) return null
      if (!(await host.revalidate(context))) return null
      const resolved = await host.resolve({ ...selection, filters: selection.filters.map((filter) => ({ ...filter, values: [...filter.values] })) }, context)
      if (!resolved || !(await host.revalidate(context)) || !resolved.tableRef.trim() || !resolved.projectionRefs.length || resolved.projectionRefs.some((ref) => typeof ref !== "string" || !ref.trim()) || new Set(resolved.projectionRefs).size !== resolved.projectionRefs.length) return null
      return { viewId: view.id, version: view.version, projectionRefs: [...resolved.projectionRefs], tableRef: resolved.tableRef }
    },
  }
}
