import { describe, expect, test } from "bun:test"
import { chapterPages } from "../../src/orchestra/chapter-route"
import { SfOwnerRuntime231, sfMountedPathAdmitted } from "../../src/orchestra/chapters/sucafina/host/owner-runtime231"
import { isSfNativeChapter, matchSfNativeRoutePath, sfNativeRouteSpecs } from "../../src/orchestra/chapters/sucafina/route-registry"
import { encodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"
import { sfNativeChapterEntry } from "../../src/orchestra/chapters/sucafina/host/native-chapter-entry"

describe("native shell owner integration", () => {
  test("sidebar entries admit through the mounted parser, not the chapter identity alone", () => {
    const owner = new URLSearchParams({ server: "s", project: "p", installation: "i" })
    for (const chapter of new Set(sfNativeRouteSpecs.map((spec) => spec.chapterId))) {
      expect(chapterPages[chapter]).toBe(SfOwnerRuntime231)
      expect(isSfNativeChapter(chapter)).toBe(true)
      const entry = sfNativeChapterEntry(chapter)
      expect(entry).toBeTruthy()
      expect(sfMountedPathAdmitted(entry!, new URLSearchParams())).toBe(true)
      expect(sfMountedPathAdmitted(entry!, owner)).toBe(true)
    }
    expect(sfNativeChapterEntry("sf-procurement")).toBe("/orchestra/sf-procurement/requests")
    expect(isSfNativeChapter("sf-fabricated")).toBe(false)
    expect(sfMountedPathAdmitted("/orchestra/sf-fabricated", new URLSearchParams())).toBe(false)
    expect(sfMountedPathAdmitted("/orchestra/sf-home", new URLSearchParams("server=s"))).toBe(false)
    const ref = encodeSfRouteRef("case-1")
    for (const path of [
      `/orchestra/sf-dashboard/hot-topics/${encodeSfRouteRef("topic-1")}`,
      `/orchestra/sf-operations/risks/${encodeSfRouteRef("risk-1")}`,
      `/orchestra/sf-decisions/${ref}/alternatives`,
      `/orchestra/sf-decisions/${ref}/assumptions`,
      `/orchestra/sf-decisions/${ref}/questions`,
      `/orchestra/sf-decisions/${ref}/relations`,
    ]) expect(sfMountedPathAdmitted(path, owner)).toBe(true)
  })
  test("the canonical resolver selects the requested CAP25 sourcing stage", () => {
    const root = `/orchestra/sf-procurement/requests/${encodeSfRouteRef("pr-1")}/sourcing`
    expect(matchSfNativeRoutePath(root)).toMatchObject({ surfaceId: "CAP25", kind: "sourcing", parameters: { requestRef: "pr-1" } })
    expect(matchSfNativeRoutePath(`${root}/compare`)).toMatchObject({ surfaceId: "CAP25", kind: "quotes", parameters: { requestRef: "pr-1" } })
  })
})
