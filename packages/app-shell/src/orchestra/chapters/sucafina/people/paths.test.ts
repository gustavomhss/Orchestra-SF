import { describe, expect, test } from "bun:test"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { sfPeopleCollectionHref } from "./paths"

const ownerSelection = { serverKey: "https://owner.example", projectId: "project/one", installationId: "install one" }

describe("semantic people return destinations", () => {
  test("returns a direct structure link to the collection with the same owner and period", () => {
    const route = { surfaceId: "CAP07", kind: "member-edit", params: { personRef: "member" },
      ownerSelection, href: "/orchestra/sf-people/structure/members/r_bWVtYmVy/edit", pathname: "", query: { year: 2026, month: 6 } } as SfResolvedRoute<"CAP07">
    const url = new URL(sfPeopleCollectionHref(route)!, "https://app.example")
    expect(url.pathname).toBe("/orchestra/sf-people/structure")
    expect(Object.fromEntries(url.searchParams)).toEqual({ server: ownerSelection.serverKey,
      project: ownerSelection.projectId, installation: ownerSelection.installationId, year: "2026", month: "6" })
  })

  test("returns talent edit and workbook links to the collection and retains the visible filter", () => {
    for (const kind of ["edit", "import", "export"] as const) {
      const route = { surfaceId: "CAP08", kind, params: {}, ownerSelection,
        href: "/orchestra/sf-people/talent/" + kind, pathname: "", query: { year: 2026, status: "Active" } } as SfResolvedRoute<"CAP08">
      const url = new URL(sfPeopleCollectionHref(route, "On Leave")!, "https://app.example")
      expect(url.pathname).toBe("/orchestra/sf-people/talent")
      expect(url.searchParams.get("status")).toBe("On Leave")
      expect(url.searchParams.get("installation")).toBe(ownerSelection.installationId)
    }
  })

  test("does not invent an owner when a selection is incomplete", () => {
    const route = { surfaceId: "CAP08", kind: "entry", params: {}, query: {},
      ownerSelection: { ...ownerSelection, installationId: "" }, href: "", pathname: "" } as SfResolvedRoute<"CAP08">
    expect(sfPeopleCollectionHref(route)).toBeUndefined()
  })
})
