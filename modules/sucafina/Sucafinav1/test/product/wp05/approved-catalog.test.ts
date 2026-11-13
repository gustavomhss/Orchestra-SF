import { expect, test } from "bun:test"
import { createApprovedCatalog, type ApprovedCatalogHost, type ApprovedSelection } from "../../../product/analytics/approved-catalog.ts"
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

test("selection is captured before asynchronous authority validation", async () => {
  const selection = { viewId: "BI01", version: 2, filters: [{ field: "department", values: ["coffee"] }] }
  const original = structuredClone(selection)
  let release!: (allowed: boolean) => void
  const gate = new Promise<boolean>((resolve) => { release = resolve })
  let validations = 0
  let forwarded: ApprovedSelection | undefined
  const host: ApprovedCatalogHost = {
    revalidate: () => ++validations === 1 ? gate : Promise.resolve(true),
    resolve: async (received) => {
      forwarded = structuredClone(received)
      return { projectionRefs: ["projection:approved"], tableRef: "table:approved" }
    },
  }
  const pending = createApprovedCatalog([view]).resolve(selection, context, host)
  selection.viewId = "BI11"
  selection.version = 999
  selection.filters[0]!.field = "secret"
  selection.filters[0]!.values[0] = "unauthorized"
  release(true)
  expect(await pending).toEqual({ viewId: "BI01", version: 2, projectionRefs: ["projection:approved"], tableRef: "table:approved" })
  expect(forwarded).toEqual(original)
  expect(validations).toBe(2)
})

test("host cannot mutate the approved callback selection before resolution or during the final fence", async () => {
  for (const stage of ["resolve", "final-fence"] as const) {
    const selection = { viewId: "BI01", version: 2, filters: [{ field: "department", values: ["coffee"] }] }
    const original = structuredClone(selection)
    let validations = 0
    let forwarded: ApprovedSelection | undefined
    const host: ApprovedCatalogHost = {
      revalidate: async () => {
        validations++
        if (stage === "final-fence" && validations === 2 && forwarded) forwarded.filters[0]!.field = "secret"
        return true
      },
      resolve: async (received) => {
        forwarded = received
        if (stage === "resolve") received.filters[0]!.field = "secret"
        return { projectionRefs: ["projection"], tableRef: "table" }
      },
    }
    expect(await createApprovedCatalog([view]).resolve(selection, context, host)).toBeNull()
    expect(selection).toEqual(original)
  }
})

test("resolved references are captured before final authority validation", async () => {
  const selection = { viewId: "BI01", version: 2, filters: [{ field: "department", values: ["coffee"] }] }
  const resolved = { projectionRefs: ["projection:approved"], tableRef: "table:approved" }
  let validations = 0
  const host: ApprovedCatalogHost = {
    revalidate: async () => {
      validations++
      if (validations === 2) {
        resolved.projectionRefs[0] = "projection:replaced"
        resolved.tableRef = "table:replaced"
      }
      return true
    },
    resolve: async () => resolved,
  }
  const result = await createApprovedCatalog([view]).resolve(selection, context, host)
  expect(result).toEqual({ viewId: "BI01", version: 2, projectionRefs: ["projection:approved"], tableRef: "table:approved" })
  resolved.projectionRefs[0] = "projection:changed-after-return"
  expect(result?.projectionRefs).toEqual(["projection:approved"])
  expect(validations).toBe(2)
})
