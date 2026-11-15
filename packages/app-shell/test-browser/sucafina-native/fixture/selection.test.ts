import { describe, expect, it } from "bun:test"
import { nativeSpecSelected } from "../../../e2e/sucafina/native/fixture/selection.ts"

describe("F04 exact native Playwright selection (pure recognizer)", () => {
  it("recognizes the assigned pilot and nested journey specs", () => {
    expect(nativeSpecSelected(["e2e/sucafina/native/pilot-isolation.spec.ts"])).toBe(true)
    expect(nativeSpecSelected(["packages/app-shell/e2e/sucafina/native/journeys/u13.spec.ts:19:3"])).toBe(true)
    expect(nativeSpecSelected([String.raw`e2e\\sucafina\\native\\pilot-presentation.spec.ts`])).toBe(true)
    expect(nativeSpecSelected([String.raw`e2e/sucafina/native/pilot-isolation\\.spec\\.ts$`])).toBe(true)
  })
  it("never treats discovery or non-native paths as installed-run selection", () => {
    expect(nativeSpecSelected(["--list", "e2e/sucafina/native/pilot-isolation.spec.ts"])).toBe(false)
    expect(nativeSpecSelected(["e2e/sucafina/native/fixture/scratch.spec.ts"])).toBe(false)
    expect(nativeSpecSelected(["e2e/sucafina/wp04/pilot-isolation.spec.ts"])).toBe(false)
    expect(nativeSpecSelected(["test-browser/sucafina-native/fixture/selection.test.ts"])).toBe(false)
    expect(nativeSpecSelected(["--grep", "native"])).toBe(false)
  })
})
