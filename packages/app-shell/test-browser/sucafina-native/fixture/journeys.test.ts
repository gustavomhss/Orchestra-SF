import { describe, expect, it } from "bun:test"
import {
  nativeJourneyEntryHref, nativeJourneyResolvedHref, nativeDashboardCommandTarget,
} from "../../../e2e/sucafina/native/fixture/journeys.ts"
import { validateNativeTarget } from "../../../e2e/sucafina/native/fixture/readiness.ts"

// Pure frozen-route contract check only; NO authenticated fixture or UI proof.
const owner = "contractRevision=sf-team-profile%2F1&server=https%3A%2F%2Fshell.example.test" +
  "&installationId=not-an-installed-id&tenantId=11111111-1111-4111-8111-111111111111" +
  "&teamObjectId=22222222-2222-4222-8222-222222222222"
const target = validateNativeTarget({
  serverKey: "https://shell.example.test",
  discoveryOrigin: "https://orchestra.example.test",
  shellOrigin: "https://shell.example.test",
  publicOrigin: "https://shell.example.test",
  installationId: "not-an-installed-id",
  tenantId: "11111111-1111-4111-8111-111111111111",
  teamObjectId: "22222222-2222-4222-8222-222222222222",
  projectId: "not-an-installed-id",
  hostId: "not-an-installed-id",
  mount: "/sucafina",
  chapterHref: "/orchestra/sf-procurement/contracts?" + owner,
})

describe("F04 frozen journey selection (pure route metadata only)", () => {
  it("retains the actual CAP14 procurement route and original Dashboard source", () => {
    expect(nativeJourneyEntryHref(target, "CAP14"))
      .toBe("https://shell.example.test/orchestra/sf-procurement/contracts?" + owner)
    const original = nativeDashboardCommandTarget({ target }, "CAP14")
    expect(original).toEqual({
      origin: "https://shell.example.test", pathname: "/sucafina/dashboard",
      method: "POST", query: { page: "Vendor Contracts" },
    })
  })
  it("binds OPEX/CAPEX exact entry paths and year without fake grants", () => {
    expect(nativeJourneyEntryHref(target, "CAP04", 2026))
      .toBe("https://shell.example.test/orchestra/sf-dashboard/opex?" + owner + "&year=2026")
    expect(nativeJourneyEntryHref(target, "CAP05", 2026))
      .toBe("https://shell.example.test/orchestra/sf-dashboard/capex?" + owner + "&year=2026")
    expect(() => nativeJourneyEntryHref(target, "CAP05", 0)).toThrow()
  })
  it("refuses other-shell, cross-chapter and unsafe source route URLs", () => {
    const detail = "https://shell.example.test/orchestra/sf-procurement/contracts/real-ref/edit"
    expect(nativeJourneyResolvedHref(target, "CAP14", detail + "?" + owner)).toBe(detail + "?" + owner)
    expect(() => nativeJourneyResolvedHref(target, "CAP14", detail)).toThrow()
    expect(() => nativeJourneyResolvedHref(target, "CAP14", detail + "?" + owner + "&teamObjectId=" + target.teamObjectId)).toThrow()
    expect(() => nativeJourneyResolvedHref(target, "CAP14",
      "https://foreign.example.test/orchestra/sf-procurement/contracts/ref/edit?" + owner)).toThrow()
    expect(() => nativeJourneyResolvedHref(target, "CAP14",
      "https://shell.example.test/orchestra/sf-dashboard/opex/ref/edit?" + owner)).toThrow()
    expect(() => nativeJourneyResolvedHref(target, "CAP14",
      detail + "?" + owner + "#section")).toThrow()
  })
})
