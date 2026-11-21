import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"

const profile = {
  installationId: "installation-one",
  tenantId: "11111111-2222-4333-8444-555555555555",
  teamObjectId: "a1111111-2222-4333-8444-555555555555",
}
const otherProfile = {
  ...profile,
  teamObjectId: "b1111111-2222-4333-8444-555555555555",
}
const principal = {
  tenantId: profile.tenantId,
  principalObjectId: "c1111111-2222-4333-8444-555555555555",
}
const revisions = { configRevision: 0, accessRevision: "authority-1" }
const choice = { profile, displayName: "Finance" }
const otherChoice = { profile: otherProfile, displayName: "Finance" }
const selector = { contractRevision: "sf-team-profile/1", kind: "team", profile }
const authenticated = {
  contractRevision: "sf-team-profile/1",
  status: "authenticated",
  installationId: profile.installationId,
  principal,
  accessRevision: revisions.accessRevision,
  administration: { status: "denied" },
  teams: { status: "ready", choices: [choice], selected: profile, configRevision: revisions.configRevision },
}

describe("Teams profile canonical contracts", () => {

  test("selectors are versioned complete intents without a client-claimed principal or grant", () => {
    expect(Schema.encodeSync(TeamProfile.Selector)(Schema.decodeUnknownSync(TeamProfile.Selector)(selector))).toEqual(selector)
    for (const input of [
      { ...selector, contractRevision: "sf-native-ui/1" },
      { ...selector, contractRevision: undefined },
      { ...selector, principal },
      { ...selector, revisions },
      { ...selector, role: "admin" },
      { ...selector, grant: "all" },
      { ...selector, profile: { ...profile, projectId: "old" } },
      { ...selector, kind: "location", directory: "/work" },
    ]) {
      expect(Schema.is(TeamProfile.Selector)(input)).toBe(false)
    }
  })

  test("administrative selector requires no Team and cannot be used as a business selector", () => {
    const administration = {
      contractRevision: "sf-team-profile/1",
      kind: "administration",
      installationId: profile.installationId,
      tenantId: profile.tenantId,
    }
    expect(Schema.is(TeamProfile.Selector)(administration)).toBe(true)
    expect(Schema.is(TeamProfile.Selector)({ ...administration, profile })).toBe(false)
    expect(Schema.is(TeamProfile.Selector)({ ...administration, kind: "team" })).toBe(false)
    expect(Schema.is(TeamProfile.Selector)({ ...administration, tenantId: undefined })).toBe(false)
  })

  test("one eligible Team has an explicit ready selection and multiple Teams may require selection", () => {
    expect(Schema.is(TeamProfile.Projection)(authenticated)).toBe(true)
    const teams = { status: "selection-required", choices: [choice, otherChoice] }
    expect(Schema.is(TeamProfile.Projection)({ ...authenticated, teams })).toBe(true)
    expect(Schema.is(TeamProfile.TeamState)({ ...teams, choices: [choice] })).toBe(false)
    expect(Schema.is(TeamProfile.TeamState)({ ...teams, choices: [] })).toBe(false)
    expect(Schema.is(TeamProfile.TeamState)({ ...teams, selected: profile })).toBe(false)
  })

  test("restored selection must be in the complete eligible set and cannot fall back", () => {
    expect(Schema.is(TeamProfile.TeamState)({ ...authenticated.teams, selected: otherProfile })).toBe(false)
    expect(Schema.is(TeamProfile.TeamState)({ ...authenticated.teams, choices: [] })).toBe(false)
    expect(Schema.is(TeamProfile.TeamState)({ ...authenticated.teams, selected: undefined })).toBe(false)
    expect(Schema.is(TeamProfile.TeamState)({
      ...authenticated.teams, choices: [choice, otherChoice], selected: otherProfile,
    })).toBe(true)
  })

  test("duplicate Team IDs are rejected even when their display names differ", () => {
    expect(Schema.is(TeamProfile.TeamState)({
      status: "selection-required",
      choices: [choice, { ...choice, displayName: "Other label" }],
    })).toBe(false)
    expect(Schema.is(TeamProfile.TeamState)({
      ...authenticated.teams, choices: [choice, choice],
    })).toBe(false)
  })

  test("eligible lists cannot mix tenants or installations", () => {
    for (const foreign of [
      { ...otherProfile, installationId: "installation-two" },
      { ...otherProfile, tenantId: "eeeeeeee-2222-4333-8444-555555555555" },
    ]) {
      expect(Schema.is(TeamProfile.Projection)({
        ...authenticated,
        teams: { status: "selection-required", choices: [choice, { ...otherChoice, profile: foreign }] },
      })).toBe(false)
      expect(Schema.is(TeamProfile.Projection)({
        ...authenticated,
        teams: { ...authenticated.teams, choices: [{ ...choice, profile: foreign }], selected: foreign },
      })).toBe(false)
    }
  })

  test("no-teams, revocation, denial and provider failure are distinct states without retained choices", () => {
    for (const status of ["no-teams", "revoked", "denied"]) {
      expect(Schema.is(TeamProfile.Projection)({ ...authenticated, teams: { status } })).toBe(true)
      expect(Schema.is(TeamProfile.TeamState)({ status, choices: [choice] })).toBe(false)
      expect(Schema.is(TeamProfile.TeamState)({ status, selected: profile })).toBe(false)
    }
    for (const reason of [
      "identity-unavailable", "consent-required", "forbidden", "rate-limited",
      "timeout", "incomplete", "invalid-response", "provider-unavailable",
    ]) {
      expect(Schema.is(TeamProfile.Projection)({
        ...authenticated, teams: { status: "unavailable", reason },
      })).toBe(true)
      expect(Schema.is(TeamProfile.TeamState)({ status: "no-teams", reason })).toBe(false)
      expect(Schema.is(TeamProfile.TeamState)({ status: "unavailable", reason, choices: [] })).toBe(false)
    }
    expect(Schema.is(TeamProfile.TeamState)({ status: "unavailable" })).toBe(false)
    expect(Schema.is(TeamProfile.TeamState)({ status: "unavailable", reason: "use-repo" })).toBe(false)
  })

  test("corporate administration may remain available with zero Teams or failed Teams enumeration", () => {
    for (const teams of [
      { status: "no-teams" },
      { status: "unavailable", reason: "consent-required" },
      { status: "unavailable", reason: "timeout" },
    ]) {
      const input = { ...authenticated, administration: { status: "available" }, teams }
      const decoded = Schema.decodeUnknownSync(TeamProfile.Projection)(input)
      expect(Schema.encodeSync(TeamProfile.Projection)(decoded)).toEqual(input)
    }
    expect(Schema.is(TeamProfile.Administration)({ status: "available", teamObjectId: profile.teamObjectId })).toBe(false)
    expect(Schema.is(TeamProfile.Administration)({ status: "available", role: "business-admin" })).toBe(false)
  })

  test("unavailable administration is explicit and is not an available destination", () => {
    const administration = { status: "unavailable", reason: "identity-unavailable" }
    expect(Schema.is(TeamProfile.Projection)({ ...authenticated, administration })).toBe(true)
    expect(Schema.is(TeamProfile.Administration)({ status: "unavailable" })).toBe(false)
    expect(Schema.is(TeamProfile.Administration)({ status: "available", reason: "identity-unavailable" })).toBe(false)
  })

  test("unauthenticated and denied responses cannot carry a stale principal or profile", () => {
    for (const status of ["unauthenticated", "denied"]) {
      const input = { contractRevision: "sf-team-profile/1", status }
      expect(Schema.is(TeamProfile.Projection)(input)).toBe(true)
      expect(Schema.is(TeamProfile.Projection)({ ...input, principal })).toBe(false)
      expect(Schema.is(TeamProfile.Projection)({ ...input, teams: authenticated.teams })).toBe(false)
      expect(Schema.is(TeamProfile.Projection)({ ...input, administration: { status: "available" } })).toBe(false)
    }
  })

  test("closed shapes reject unknown nested fields even when the caller asks to ignore them", () => {
    const decode = Schema.decodeUnknownSync(TeamProfile.Projection, { onExcessProperty: "ignore" })
    for (const input of [
      { ...authenticated, projectId: "old" },
      { ...authenticated, principal: { ...principal, role: "admin" } },
      { ...authenticated, teams: { ...authenticated.teams, selected: { ...profile, directory: "/work" } } },
      { ...authenticated, teams: { ...authenticated.teams, choices: [{ ...choice, token: "private" }] } },
    ]) {
      expect(() => decode(input)).toThrow()
    }
  })

  test("public schema identifiers are stable, domain-qualified and unique", () => {
    const schemas = [
      TeamProfile.ContractRevision, TeamProfile.InstallationId, TeamProfile.TenantId,
      TeamProfile.PrincipalObjectId, TeamProfile.TeamObjectId, TeamProfile.ConfigRevision,
      TeamProfile.AccessRevision, TeamProfile.Ref, TeamProfile.Principal, TeamProfile.Revisions,
      TeamProfile.Owner, TeamProfile.Binding, TeamProfile.Selector, TeamProfile.Choice,
      TeamProfile.UnavailableReason, TeamProfile.TeamState, TeamProfile.Administration,
      TeamProfile.Authenticated, TeamProfile.Projection,
    ]
    const identifiers = schemas.map((schema) =>
      schema.ast.checks?.at(-1)?.annotations?.identifier ?? schema.ast.annotations?.identifier)
    expect(identifiers.every((identifier) =>
      typeof identifier === "string" && identifier.startsWith("Sucafina.TeamProfile."))).toBe(true)
    expect(new Set(identifiers).size).toBe(schemas.length)
  })
})
