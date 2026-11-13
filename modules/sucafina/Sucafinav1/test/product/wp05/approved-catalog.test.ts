import { expect, test } from "bun:test"
import { createApprovedCatalog, type ApprovedCatalogHost } from "../../../product/analytics/approved-catalog.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = {} as TrustedDomainContext
const view = { id: "BI01", version: 2, allowedFilters: ["period", "department"] }

test("catalog requires explicit valid host view definitions", () => {
  expect(createApprovedCatalog([view]).views).toEqual([view])
  expect(createApprovedCatalog([{ ...view, allowedFilters: [] }]).views[0]?.allowedFilters).toEqual([])
  for (const views of [
    [{ ...view, id: "BI99" }],
    [{ ...view, id: "BI01" }, { ...view, id: "BI01" }],
    [{ ...view, version: 0 }],
    [{ ...view, version: Number.NaN }],
    [{ ...view, allowedFilters: ["period", "period"] }],
    [{ ...view, allowedFilters: [""] }],
  ]) expect(() => createApprovedCatalog(views)).toThrow("invalid-approved-catalog")
})

test("resolution forwards only approved selection and preserves host references", async () => {
  let forwarded: unknown
  let validations = 0
  const host: ApprovedCatalogHost = {
    revalidate: async (received) => { validations++; return received === context },
    resolve: async (selection) => { forwarded = selection; return { projectionRefs: ["projection:actual"], tableRef: "table:actual" } },
  }
  const selection = { viewId: "BI01", version: 2, filters: [{ field: "department", values: ["coffee"] }] }
  const result = await createApprovedCatalog([view]).resolve(selection, context, host)
  expect(forwarded).not.toBe(selection)
  expect(forwarded).toEqual(selection)
  expect(validations).toBe(2)
  expect(result).toEqual({ viewId: "BI01", version: 2, projectionRefs: ["projection:actual"], tableRef: "table:actual" })
})

test("resolution fails closed for unapproved inputs, changed authority, and missing host references", async () => {
  let calls = 0
  const host: ApprovedCatalogHost = {
    revalidate: async () => ++calls === 1,
    resolve: async () => ({ projectionRefs: ["projection"], tableRef: "table" }),
  }
  const catalog = createApprovedCatalog([view])
  expect(await catalog.resolve({ viewId: "BI02", version: 2, filters: [] }, context, host)).toBeNull()
  expect(await catalog.resolve({ viewId: "BI01", version: 1, filters: [] }, context, host)).toBeNull()
  expect(await catalog.resolve({ viewId: "BI01", version: 2, filters: [{ field: "secret", values: ["x"] }] }, context, host)).toBeNull()
  expect(await catalog.resolve({ viewId: "BI01", version: 2, filters: [{ field: "period", values: ["x", "x"] }] }, context, host)).toBeNull()
  expect(await catalog.resolve({ viewId: "BI01", version: 2, filters: [{ field: "period", values: ["x"] }, { field: "period", values: ["y"] }] }, context, host)).toBeNull()
  expect(await catalog.resolve({ viewId: "BI01", version: 2, filters: [] }, context, host)).toBeNull()
  expect(calls).toBe(2)

  const emptyRefs: ApprovedCatalogHost = { revalidate: async () => true, resolve: async () => ({ projectionRefs: [], tableRef: "table" }) }
  const emptyTable: ApprovedCatalogHost = { revalidate: async () => true, resolve: async () => ({ projectionRefs: ["projection"], tableRef: " " }) }
  expect(await catalog.resolve({ viewId: "BI01", version: 2, filters: [] }, context, emptyRefs)).toBeNull()
  expect(await catalog.resolve({ viewId: "BI01", version: 2, filters: [] }, context, emptyTable)).toBeNull()
})
