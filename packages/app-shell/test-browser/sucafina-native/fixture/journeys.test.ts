import { describe, expect, it } from "bun:test"
import { nativeJourneyEntryHref, nativeJourneyResolvedHref, nativeDashboardCommandTarget } from "../../../e2e/sucafina/native/fixture/journeys.ts"
import { nativeOwnerQuery, validateNativeTarget } from "../../../e2e/sucafina/native/fixture/manifest-contract.ts"

// Closed route metadata only; no identity, actor or installed-proof claim.
const raw = { serverKey: "https://sf.example.test", discoveryOrigin: "https://sf.example.test",
  shellOrigin: "https://sf.example.test", publicOrigin: "https://sf.example.test",
  installationId: "route-metadata-only", tenantId: "11111111-1111-4111-8111-111111111111",
  teamObjectId: "22222222-2222-4222-8222-222222222222", projectId: "technical-only",
  hostId: "host-only", mount: "/sucafina" }
const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", server: raw.serverKey,
  installationId: raw.installationId, tenantId: raw.tenantId, teamObjectId: raw.teamObjectId })
const target = validateNativeTarget({ ...raw, chapterHref: "/orchestra/sf-procurement/contracts?" + query })

describe("F04 frozen journey selection (pure route metadata only)", () => {
  it("retains the actual CAP14 procurement route and original Dashboard source", () => {
    expect(nativeJourneyEntryHref(target, "CAP14")).toBe(target.shellOrigin + target.chapterHref)
    const original = nativeDashboardCommandTarget({ target }, "CAP14")
    expect(original).toEqual({ origin: target.publicOrigin,
      pathname: "/sucafina/teams/" + target.teamObjectId + "/dashboard", method: "POST",
      query: { page: "Vendor Contracts" }, headers: { "x-sf-team-profile": JSON.stringify({
        contractRevision: "sf-team-profile/1", kind: "team",
        profile: { installationId: target.installationId, tenantId: target.tenantId, teamObjectId: target.teamObjectId },
      }) } })
  })
  it("binds OPEX/CAPEX exact entry paths and year without fake grants", () => {
    for (const [cap, route] of [["CAP04", "opex"], ["CAP05", "capex"]] as const) {
      const url = new URL(nativeJourneyEntryHref(target, cap, 2026))
      expect(url.pathname).toBe("/orchestra/sf-dashboard/" + route)
      const expected = nativeOwnerQuery(target)
      expected.set("year", "2026")
      expect(url.searchParams.toString()).toBe(expected.toString())
      for (const year of [undefined, 0, 2023, 2028, 2100]) expect(() => nativeJourneyEntryHref(target, cap, year)).toThrow()
    }
    expect(() => nativeJourneyEntryHref(target, "CAP14", 2026)).toThrow()
  })
  it("refuses other-shell, cross-chapter and unsafe source route URLs", () => {
    const url = new URL(target.shellOrigin + "/orchestra/sf-procurement/contracts/r_ref/edit?" + query)
    expect(nativeJourneyResolvedHref(target, "CAP14", url.href)).toBe(url.href)
    const foreign = new URL(url); foreign.host = "foreign.example.test"
    const chapter = new URL(url); chapter.pathname = "/orchestra/sf-dashboard/opex/r_ref/edit"
    const fragment = new URL(url); fragment.hash = "section"
    const missing = new URL(url); missing.searchParams.delete("tenantId")
    const mixed = new URL(url); mixed.searchParams.set("projectId", target.projectId)
    const duplicated = new URL(url); duplicated.searchParams.append("teamObjectId", target.teamObjectId)
    for (const invalid of [foreign, chapter, fragment, missing, mixed, duplicated])
      expect(() => nativeJourneyResolvedHref(target, "CAP14", invalid.href)).toThrow()
  })
})
