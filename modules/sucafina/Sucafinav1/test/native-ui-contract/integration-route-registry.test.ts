import { describe, expect, test } from "bun:test"
import { encodeSfRouteRef } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/navigation-state"
import { matchSfNativeRoutePath, sfNativeRouteSpecs } from "../../../../../packages/app-shell/src/orchestra/chapters/sucafina/route-registry"

describe("I00 frozen 70 surface route consumer (129 surgical test)", () => {
  test("has the 70 frozen surfaces and 15 chapters, without an unknown wildcard", () => {
    expect(new Set(sfNativeRouteSpecs.map((item) => item.surfaceId)).size).toBe(70)
    expect(new Set(sfNativeRouteSpecs.map((item) => item.chapterId)).size).toBe(15)
    expect(new Set(sfNativeRouteSpecs.map((item) => item.pattern)).size).toBe(sfNativeRouteSpecs.length)
    expect(sfNativeRouteSpecs.every((item) => item.pattern.startsWith("/orchestra/sf-"))).toBe(true)
  })
  test("recognizes exact static chapter route but does not issue authority", () => {
    expect(matchSfNativeRoutePath("/orchestra/sf-dashboard/executive")).toEqual({
      surfaceId: "CAP01", chapterId: "sf-dashboard", kind: "entry", parameters: {},
    })
    expect(matchSfNativeRoutePath("/orchestra/sf-unknown")).toBeUndefined()
  })
  test("decodes original opaque refs without losing UTF8 and without fallback", () => {
    const original = "case/ç/ß?version=4"
    const route = matchSfNativeRoutePath("/orchestra/sf-decisions/" + encodeSfRouteRef(original))
    expect(route?.surfaceId).toBe("UI34")
    expect<string | undefined>(route?.parameters.caseRef).toBe(original)
  })
  test("rejects unencoded refs, aliases, malformed UTF8, percent encodings and extra segments", () => {
    for (const value of [
      "/orchestra/sf-decisions/plain",
      "/orchestra/sf-decisions/r_!!!",
      "/orchestra/sf-decisions/r_wA",
      "/orchestra/sf-decisions/%2e%2e",
      "/orchestra/sf-decisions/r_aGVsbG8=",
      "/orchestra/sf-dashboard/executive/",
      "/orchestra/sf-dashboard/executive/extra",
      "/orchestra/sf-dashboard//executive",
      "/orchestra/sf-dashboard/%65xecutive",
    ]) expect(matchSfNativeRoutePath(value)).toBeUndefined()
  })
})
