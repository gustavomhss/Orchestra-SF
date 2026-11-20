import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfOwnerSelection, SfRef, SfServerKey, SfResolvedRoute, SfHref } from "@orchestra/schema/sucafina/context"
import { SfTeamContext } from "@orchestra/schema/sucafina/context"
import { sfOwnerQuery, sfOwnerQueryValid, sfParseOwnerQuery, sfSameOwnerSelection,
  sfSelectionFromQuery, sfSameContextStamp, sfOwnerMatchesContext } from "./owner"
import { resolveSfUrlSelection, sfEntryDestinationRequest } from "./index"
import { matchSfNativeRoutePath } from "../route-registry"
import { parseExtendedRouteQuery } from "../host/extended-routes"
import { sfNativeOwnerChapterRequest } from "../host/native-chapter-entry"
import { sfExecutiveLinkRequest } from "../cross-links"
import { sfProjectHref } from "../portfolio/projects/paths"
import { sfDecisionHref } from "../portfolio/scenarios/paths"

const ref = (team = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", tenant = "11111111-2222-4333-8444-555555555555") =>
  Schema.decodeUnknownSync(TeamProfile.Ref)({ installationId: "installation-one", tenantId: tenant, teamObjectId: team })
const selection = (profile = ref()): SfOwnerSelection => ({ serverKey: "https://sf.example.test" as SfServerKey,
  projectId: "physical-project" as SfRef, installationId: "installation-one" as SfRef, team: profile })
const a = selection(), b = selection(ref("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"))
const route: SfResolvedRoute<"CAP09"> = { surfaceId: "CAP09", kind: "entry", params: {}, ownerSelection: a,
  pathname: "/orchestra/sf-portfolio/overview", href: ("/orchestra/sf-portfolio/overview?" + new URLSearchParams(sfOwnerQuery(a))) as SfHref,
  query: { year: 2026 } }
const context = () => Schema.decodeUnknownSync(SfTeamContext)({
  contractRevision: "sf-team-profile/1", authMode: "microsoft",
  stamp: { installationId: "installation-one", projectId: "physical-project", hostId: "host-one",
    principalRef: "11111111-1111-4111-8111-111111111111", policyVersion: "policy", accessRevision: "revision",
    team: { owner: { profile: ref(), principal: { tenantId: ref().tenantId,
      principalObjectId: "11111111-1111-4111-8111-111111111111" } },
      revisions: { configRevision: 7, accessRevision: "revision" } } },
  profile: { contractRevision: "sf-team-profile/1", status: "authenticated", installationId: "installation-one",
    principal: { tenantId: ref().tenantId, principalObjectId: "11111111-1111-4111-8111-111111111111" },
    accessRevision: "revision", administration: { status: "denied" },
    teams: { status: "ready", choices: [{ profile: ref(), displayName: "Same label" }], selected: ref(), configRevision: 7 } },
  destinations: [], availability: [],
})

describe("versioned Teams native owner selectors", () => {
  test("full Team identity replaces project in the public URL while placement stays separate in memory", () => {
    const query = sfOwnerQuery(a)
    expect(query).toEqual({ contractRevision: "sf-team-profile/1", server: a.serverKey,
      installationId: "installation-one", tenantId: ref().tenantId, teamObjectId: ref().teamObjectId })
    expect("project" in query).toBe(false)
    expect(sfParseOwnerQuery(new URLSearchParams(query))).toEqual({ kind: "team", serverKey: a.serverKey, profile: ref() })
    expect(sfSelectionFromQuery(new URLSearchParams(query), a)).toEqual(a)
  })
  test("a complete Team B stays B; a partial, mixed or old selector cannot borrow Team A", () => {
    const full = new URLSearchParams(sfOwnerQuery(b))
    expect(sfSelectionFromQuery(full, a)).toEqual(b)
    expect(sfSameOwnerSelection(a, b)).toBe(false)
    for (const key of ["contractRevision", "server", "installationId", "tenantId", "teamObjectId"]) {
      const missing = new URLSearchParams(full); missing.delete(key)
      expect(sfOwnerQueryValid(missing)).toBe(false)
      expect(sfSelectionFromQuery(missing, a)).toBeUndefined()
    }
    for (const extra of ["project=physical-project", "installation=installation-one", "teamObjectId=" + ref().teamObjectId,
      "%74eamObjectId=" + ref().teamObjectId]) {
      expect(sfOwnerQueryValid(new URLSearchParams(full + "&" + extra))).toBe(false)
    }
    expect(sfSelectionFromQuery(new URLSearchParams({ server: a.serverKey, project: a.projectId,
      installation: a.installationId! }), a)).toBeUndefined()
  })
  test("foreign tenant, installation and server never replace the bound runtime", () => {
    for (const [key, value] of [["tenantId", "22222222-2222-4333-8444-555555555555"],
      ["installationId", "other-installation"], ["server", "https://other.example.test"]]) {
      const query = new URLSearchParams(sfOwnerQuery(a)); query.set(key!, value!)
      expect(sfSelectionFromQuery(query, a)).toBeUndefined()
    }
  })
  test("all fifteen native route families accept only a complete versioned owner alongside their source query", () => {
    const paths = [
      "/orchestra/sf-dashboard/executive", "/orchestra/sf-bi", "/orchestra/sf-planner/overview",
      "/orchestra/sf-planner/opex", "/orchestra/sf-procurement/requests", "/orchestra/sf-people/overview",
      "/orchestra/sf-operations/service", "/orchestra/sf-portfolio/overview", "/orchestra/sf-decisions/r_Y2FzZQ/alternatives",
      "/orchestra/sf-work", "/orchestra/sf-home/context", "/orchestra/sf-memory/signals",
      "/orchestra/sf-reviews/agenda", "/orchestra/sf-documents", "/orchestra/sf-routines",
    ]
    for (const path of paths) {
      const candidate = matchSfNativeRoutePath(path)
      expect(candidate).toBeDefined()
      const query = new URLSearchParams(sfOwnerQuery(a))
      expect(parseExtendedRouteQuery(query, candidate!)).toBeDefined()
      query.delete("tenantId")
      expect(parseExtendedRouteQuery(query, candidate!)).toBeUndefined()
      const unknown = new URLSearchParams(sfOwnerQuery(a)); unknown.set("privateSearch", "private note")
      expect(parseExtendedRouteQuery(unknown, candidate!)).toBeUndefined()
      const mixed = new URLSearchParams(sfOwnerQuery(a)); mixed.set("project", "physical-project")
      expect(parseExtendedRouteQuery(mixed, candidate!)).toBeUndefined()
    }
  })
  test("native chapter, cross-link and family builders preserve the same full Team tuple", () => {
    const links = [
      sfNativeOwnerChapterRequest("sf-operations", a),
      sfEntryDestinationRequest(route, "CAP07"),
      sfExecutiveLinkRequest(route, { kind: "projects" }),
      sfProjectHref(route, "projects"),
      sfDecisionHref({ ...route, surfaceId: "UI42", kind: "entry" }, "list"),
    ]
    for (const link of links) {
      expect(link).toBeDefined()
      const parsed = sfParseOwnerQuery(new URL(link!, "https://sf.example.test").searchParams)
      expect(parsed).toEqual({ kind: "team", serverKey: a.serverKey, profile: ref() })
      expect(new URL(link!, "https://sf.example.test").searchParams.has("project")).toBe(false)
    }
  })
  test("back/forward and deep links re-resolve an atomic versioned owner", () => {
    const href = "/orchestra/sf-home?" + new URLSearchParams(sfOwnerQuery(b))
    expect(resolveSfUrlSelection(href, "/orchestra/sf-home", a)).toEqual({
      status: "selected", explicit: true, selection: b,
    })
    expect(resolveSfUrlSelection(href + "&tenantId=" + ref().tenantId, "/orchestra/sf-home", a))
      .toEqual({ status: "invalid-link" })
    expect(resolveSfUrlSelection("https://foreign.example" + href, "/orchestra/sf-home", a))
      .toEqual({ status: "invalid-link" })
    expect(resolveSfUrlSelection(href + "&%ZZ=bad", "/orchestra/sf-home", a)).toEqual({ status: "invalid-link" })
  })
  test("matching technical IDs and effective revision do not erase Team or principal boundaries", () => {
    const value = context()
    expect(sfOwnerMatchesContext(value, a)).toBe(true)
    expect(sfOwnerMatchesContext(value, b)).toBe(false)
    expect(sfOwnerMatchesContext(value, { serverKey: a.serverKey, projectId: a.projectId,
      installationId: a.installationId })).toBe(false)
    const changed = { ...value.stamp, team: { ...value.stamp.team!,
      owner: { ...value.stamp.team!.owner, profile: b.team! } } }
    expect(sfSameContextStamp(value.stamp, changed)).toBe(false)
    const revision = { ...value.stamp, team: { ...value.stamp.team!,
      revisions: { ...value.stamp.team!.revisions, configRevision: 8 } } }
    expect(sfSameContextStamp(value.stamp, revision)).toBe(false)
  })
})
