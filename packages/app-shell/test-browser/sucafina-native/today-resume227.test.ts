/**
 * Mission 227 source/browser contract checks. No fabricated case, provider,
 * Request, identity or grant: positive authority belongs to the installed
 * browser journey and original producer, not these metadata checks.
 */
import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { matchSfNativeRoutePath, sfNativeRouteSpecs } from "../../src/orchestra/chapters/sucafina/route-registry"
import { decodeSfRouteRef } from "../../src/orchestra/chapters/sucafina/navigation-state"

describe("C-004 UI29 authorized case-resume source boundary", () => {
  test("UI34 uses the single frozen opaque caseRef route, never a title or slug", () => {
    expect(sfNativeRouteSpecs.filter((route) =>
      route.surfaceId === "UI34" && route.kind === "entry")).toEqual([{
      surfaceId: "UI34", chapterId: "sf-decisions", kind: "entry",
      pattern: "/orchestra/sf-decisions/:caseRef",
    }])
  })

  test("invalid opaque ref segments never match UI34 before F01 admission", () => {
    const segments = [
      "", "r_", "r_A", "r_abc=", "..", "%2e%2e", "title/slug",
      "r_--%%", "r_wrong?grant=yes", "r_wrong#other",
    ]
    for (const segment of segments) {
      expect(decodeSfRouteRef(segment)).toBeUndefined()
      expect(matchSfNativeRoutePath("/orchestra/sf-decisions/" + segment)).toBeUndefined()
    }
  })

  test("the only resume preflight is original admitted projection.case GET", () => {
    const original = SfDecisions.operations["projection.case"]
    const metadata = SfOperationRegistry["projection.case"]
    expect(original.operationId).toBe("projection.case")
    expect(original.method).toBe("GET")
    expect(original.responseMode).toBe("json")
    expect(original.effect).toBe("read")
    expect(metadata.pathTemplate).toBe("{mount}/api/ui/projections/case")
    expect(metadata.effect).toBe("read")
    const accepts = Schema.is(original.input)
    expect(accepts({ caseRef: "" })).toBe(false)
    expect(accepts({ caseRef: "x".repeat(16_385) })).toBe(false)
  })

  test("Home availability and case preflight use distinct original read operations", () => {
    const home = SfOperationRegistry["projection.home"]
    const caseRead = SfOperationRegistry["projection.case"]
    expect(home.effect).toBe("read")
    expect(caseRead.method).toBe("GET")
    expect(home.pathTemplate).not.toBe(caseRead.pathTemplate)
  })
})
