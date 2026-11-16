import { describe, expect, test } from "bun:test"
import { chapterPages } from "../../src/orchestra/chapter-route"
import { SfOwnerRuntime231 } from "../../src/orchestra/chapters/sucafina/host/owner-runtime231"
import { isSfNativeChapter, matchSfNativeRoutePath, sfNativeRouteSpecs } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"

describe("native shell owner integration", () => {
  test("both added chapters and existing planner and BI retain the same owner", () => {
    for (const chapter of new Set(sfNativeRouteSpecs.map((spec) => spec.chapterId))) {
      expect(chapterPages[chapter]).toBe(SfOwnerRuntime231)
      expect(isSfNativeChapter(chapter)).toBe(true)
    }
    expect(isSfNativeChapter("sf-fabricated")).toBe(false)
  })
  test("the canonical resolver selects the requested CAP25 sourcing stage", () => {
    const root = `/orchestra/sf-procurement/requests/${encodeSfRouteRef("pr-1")}/sourcing`
    expect(matchSfNativeRoutePath(root)).toMatchObject({ surfaceId: "CAP25", kind: "sourcing", parameters: { requestRef: "pr-1" } })
    expect(matchSfNativeRoutePath(`${root}/compare`)).toMatchObject({ surfaceId: "CAP25", kind: "quotes", parameters: { requestRef: "pr-1" } })
  })
})
