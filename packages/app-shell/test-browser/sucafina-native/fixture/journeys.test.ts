import { describe, expect, it } from "bun:test"
import {
  nativeJourneyEntryHref, nativeJourneyResolvedHref, nativeDashboardCommandTarget,
} from "../../../e2e/sucafina/native/fixture/journeys.ts"
import type { NativeTarget } from "../../../e2e/sucafina/native/fixture/readiness.ts"

// Pure frozen-route contract check only; NO authenticated fixture or UI proof.
const target: NativeTarget = {
  serverKey: "synthetic-route-only",
  discoveryOrigin: "https://orchestra.example.test",
  shellOrigin: "https://shell.example.test",
  publicOrigin: "https://sf.example.test",
  installationId: "not-an-installed-id",
  projectId: "not-an-installed-id",
  hostId: "not-an-installed-id",
  mount: "/sucafina",
  chapterHref: "/orchestra/sf-procurement/contracts",
}

describe("F04 frozen journey selection (pure route metadata only)", () => {
  it("retains the actual CAP14 procurement route and original Dashboard source", () => {
    expect(nativeJourneyEntryHref(target, "CAP14"))
      .toBe("https://shell.example.test/orchestra/sf-procurement/contracts")
    const original = nativeDashboardCommandTarget({ target }, "CAP14")
    expect(original).toEqual({
      origin: "https://sf.example.test", pathname: "/sucafina/dashboard",
      method: "POST", query: { page: "Vendor Contracts" },
    })
  })
  it("binds OPEX/CAPEX exact entry paths and year without fake grants", () => {
    expect(nativeJourneyEntryHref(target, "CAP04", 2026))
      .toBe("https://shell.example.test/orchestra/sf-dashboard/opex?year=2026")
    expect(nativeJourneyEntryHref(target, "CAP05", 2026))
      .toBe("https://shell.example.test/orchestra/sf-dashboard/capex?year=2026")
    expect(() => nativeJourneyEntryHref(target, "CAP05", 0)).toThrow()
  })
  it("refuses other-shell, cross-chapter and unsafe source route URLs", () => {
    expect(nativeJourneyResolvedHref(target, "CAP14",
      "https://shell.example.test/orchestra/sf-procurement/contracts/real-ref/edit"))
      .toBe("https://shell.example.test/orchestra/sf-procurement/contracts/real-ref/edit")
    expect(() => nativeJourneyResolvedHref(target, "CAP14",
      "https://foreign.example.test/orchestra/sf-procurement/contracts/ref/edit")).toThrow()
    expect(() => nativeJourneyResolvedHref(target, "CAP14",
      "https://shell.example.test/orchestra/sf-dashboard/opex/ref/edit")).toThrow()
    expect(() => nativeJourneyResolvedHref(target, "CAP14",
      "https://shell.example.test/orchestra/sf-procurement/contracts/ref#section")).toThrow()
  })
})
