import { describe, expect, it } from "bun:test"
import { nativeCaseIdentity, nativeInventoryCases, nativeIsolationActor, nativeSpecSelected, nativeSuiteForSpec, nativeTeamsSpecSelected } from "../../../e2e/sucafina/native/fixture/selection.ts"

describe("F04 exact native Playwright selection (pure recognizer)", () => {
  it("recognizes the assigned pilot and nested journey specs", () => {
    expect(nativeSpecSelected(["e2e/sucafina/native/pilot-isolation.spec.ts"])).toBe(true)
    expect(nativeSpecSelected(["packages/app-shell/e2e/sucafina/native/journeys/u13.spec.ts:19:3"])).toBe(true)
    expect(nativeSpecSelected([String.raw`e2e\sucafina\native\pilot-presentation.spec.ts`])).toBe(true)
    expect(nativeSpecSelected([String.raw`e2e/sucafina/native/pilot-isolation\.spec\.ts$`])).toBe(true)
  })
  it("never treats discovery or non-native paths as installed-run selection", () => {
    expect(nativeSpecSelected(["--list", "e2e/sucafina/native/pilot-isolation.spec.ts"])).toBe(false)
    expect(nativeSpecSelected(["e2e/sucafina/native/fixture/scratch.spec.ts"])).toBe(false)
    expect(nativeSpecSelected(["e2e/sucafina/wp04/pilot-isolation.spec.ts"])).toBe(false)
    expect(nativeSpecSelected(["test-browser/sucafina-native/fixture/selection.test.ts"])).toBe(false)
    expect(nativeSpecSelected(["--grep", "native"])).toBe(false)
  })
  it("reserves the installed Teams case suite for its exact path", () => {
    expect(nativeTeamsSpecSelected("/workspace/packages/app-shell/e2e/sucafina/native/teams-profile-linux.spec.ts")).toBe(true)
    expect(nativeTeamsSpecSelected(String.raw`C:\workspace\e2e\sucafina\native\teams-profile-linux.spec.ts`)).toBe(true)
    expect(nativeTeamsSpecSelected("e2e/sucafina/native/teams-profile-recovery-linux.spec.ts")).toBe(false)
    expect(nativeTeamsSpecSelected("not-e2e/sucafina/native/teams-profile-linux.spec.ts")).toBe(false)
  })
  it("assigns denied and holder contexts only to the exact original isolation cases", () => {
    const spec = "/checkout/packages/app-shell/e2e/sucafina/native/isolation.spec.ts"
    const denied = "Q01-ISO-REAL-ACTOR-denied must be an authentic principal"
    expect(nativeIsolationActor(spec, denied)).toBe("denied")
    expect(nativeIsolationActor(spec, denied.replace("denied", "holder"))).toBe("holder")
    expect(nativeIsolationActor(spec, denied + " (copy)")).toBeUndefined()
    expect(nativeIsolationActor(spec.replace("isolation.spec", "pilot-isolation.spec"), denied)).toBeUndefined()
  })
  it("binds the source spec and exact test title instead of assigning the entry actor", () => {
    expect(nativeSuiteForSpec("/workspace/packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts")).toBe("U39")
    expect(nativeSuiteForSpec(String.raw`C:\workspace\e2e\sucafina\native\journeys\u40.spec.ts`)).toBe("U40")
    expect(nativeSuiteForSpec("not-e2e/sucafina/native/journeys/u39.spec.ts")).toBeUndefined()
    const title = "206-AC02 a genuinely empty original collection is empty, not filtered-empty, partial or not-found"
    expect(nativeCaseIdentity("U39", title)).toEqual({ id: "u39-10", title, caseId: "empty" })
    expect(() => nativeCaseIdentity("U39", title + " (renamed)")).toThrow("F04_UNKNOWN_REAL_TEST_SELECTION_TITLE")
    expect(() => nativeCaseIdentity("U15", title)).toThrow("F04_UNKNOWN_REAL_TEST_SELECTION_TITLE")
  })
  it("preserves all original case identities, including budget actor and source variations", () => {
    expect(nativeInventoryCases("U15").map((entry) => entry.caseId)).toEqual([
      "list", "editable", "denied", "stale", "lost", "list",
    ])
    for (const suite of ["U39", "U40"] as const) {
      const cases = nativeInventoryCases(suite)
      expect(cases).toHaveLength(22)
      expect(new Set(cases.map((entry) => entry.caseId))).toEqual(new Set([
        "entry", "empty", "source", "readonly", "denied", "revoked", "stale", "late",
      ]))
      for (const entry of cases) expect(nativeCaseIdentity(suite, entry.title)).toEqual(entry)
    }
  })
})
