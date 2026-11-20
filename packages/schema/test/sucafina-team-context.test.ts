import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Session } from "@orchestra/schema/session"
import { Ref } from "../src/sucafina/team-profile"
import { SfInstallationSelector, SfTeamInstallationDescriptor, SfTeamContextQuery,
  SfTeamContext, SfTeamContextResult, SfContextStamp } from "../src/sucafina/context"

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
  test("package entrypoint reexports the exact canonical schema", () => {
    expect(TeamProfile.Ref).toBe(Ref)
  })

  test("shared profile and personal owner roundtrip without changing identity bytes", () => {
    const ref = Schema.decodeUnknownSync(TeamProfile.Ref)(profile)
    expect(Schema.encodeSync(TeamProfile.Ref)(ref)).toEqual(profile)
    const owner = Schema.decodeUnknownSync(TeamProfile.Owner)({ profile, principal })
    expect(Schema.encodeSync(TeamProfile.Owner)(owner)).toEqual({ profile, principal })
    const binding = Schema.decodeUnknownSync(TeamProfile.Binding)({ owner, revisions })
    expect(Schema.encodeSync(TeamProfile.Binding)(binding)).toEqual({ owner: { profile, principal }, revisions })
  })

  test("duplicate display names and rename do not replace Microsoft object identity", () => {
    const original = Schema.decodeUnknownSync(TeamProfile.Choice)(choice)
    const renamed = Schema.decodeUnknownSync(TeamProfile.Choice)({ ...choice, displayName: "Finance Global" })
    const recreated = Schema.decodeUnknownSync(TeamProfile.Choice)(otherChoice)
    expect(renamed.profile).toEqual(original.profile)
    expect(recreated.displayName).toBe(original.displayName)
    expect(recreated.profile).not.toEqual(original.profile)
  })

  test("private ownership distinguishes two principals in the same Team", () => {
    const first = Schema.decodeUnknownSync(TeamProfile.Owner)({ profile, principal })
    const second = Schema.decodeUnknownSync(TeamProfile.Owner)({
      profile,
      principal: { ...principal, principalObjectId: "d1111111-2222-4333-8444-555555555555" },
    })
    expect(second.profile).toEqual(first.profile)
    expect(second.principal).not.toEqual(first.principal)
  })

  test("resource tenant must agree with the principal, including guests", () => {
    expect(Schema.is(TeamProfile.Owner)({
      profile,
      principal: { ...principal, tenantId: "eeeeeeee-2222-4333-8444-555555555555" },
    })).toBe(false)
    expect(Schema.is(TeamProfile.Owner)({ profile, principal })).toBe(true)
  })

  test("Microsoft IDs require complete canonical GUIDs, never repo aliases or rewritten input", () => {
    for (const teamObjectId of [
      "", "global", "repo-1234", "/work/finance", profile.teamObjectId.slice(0, 32),
      profile.teamObjectId.toUpperCase(), " " + profile.teamObjectId, "{" + profile.teamObjectId + "}",
    ]) {
      expect(Schema.is(TeamProfile.Ref)({ ...profile, teamObjectId })).toBe(false)
    }
    expect(Schema.decodeUnknownSync(TeamProfile.Ref)(profile).teamObjectId).toBe(profile.teamObjectId)
  })

  test("empty, padded, control-bearing and unbounded installation identifiers are rejected", () => {
    for (const installationId of ["", " installation-one", "installation-one ", "installation\nother", "x".repeat(257)]) {
      expect(Schema.is(TeamProfile.Ref)({ ...profile, installationId })).toBe(false)
    }
  })

  test("all profile identity components are mandatory and repo-profile fields are forbidden", () => {
    for (const input of [
      { installationId: profile.installationId, tenantId: profile.tenantId },
      { installationId: profile.installationId, teamObjectId: profile.teamObjectId },
      { tenantId: profile.tenantId, teamObjectId: profile.teamObjectId },
      { ...profile, projectId: "project-old" },
      { ...profile, directory: "/work" },
      { ...profile, principalObjectId: principal.principalObjectId },
    ]) {
      expect(Schema.is(TeamProfile.Ref)(input)).toBe(false)
    }
  })

  test("principals reject email, home tenant substitution and alternate authority fields", () => {
    for (const input of [
      { ...principal, email: "user@example.test" },
      { principalObjectId: principal.principalObjectId, homeTenantId: profile.tenantId },
      { ...principal, role: "admin" },
      { ...principal, accessToken: "untrusted" },
      { ...principal, principalObjectId: "user@example.test" },
    ]) {
      expect(Schema.is(TeamProfile.Principal)(input)).toBe(false)
    }
  })

  test("config revision preserves string versus safe integer while authority revision stays opaque", () => {
    for (const configRevision of [0, 1, Number.MAX_SAFE_INTEGER, "1", "config:0001"]) {
      const input = { configRevision, accessRevision: "authority:0001" }
      const decoded = Schema.decodeUnknownSync(TeamProfile.Revisions)(input)
      expect(Schema.encodeSync(TeamProfile.Revisions)(decoded)).toEqual(input)
    }
    for (const configRevision of [-1, 0.5, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity, "", null]) {
      expect(Schema.is(TeamProfile.Revisions)({ ...revisions, configRevision })).toBe(false)
    }
    for (const accessRevision of ["", " authority", "authority\n1", 1, null]) {
      expect(Schema.is(TeamProfile.Revisions)({ ...revisions, accessRevision })).toBe(false)
    }
    expect(Schema.is(TeamProfile.Revisions)({ ...revisions, policyRevision: "redundant" })).toBe(false)
  })

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

  test("historical selectors retain their old codec but cannot decode as current Teams authority", () => {
    const historical = { select: "ids", installationId: "historical-install", projectId: "original-project-bytes" }
    expect(Schema.decodeUnknownSync(SfInstallationSelector)(historical)).toEqual(historical)
    expect(Schema.is(TeamProfile.Selector)(historical)).toBe(false)
    expect(Schema.is(TeamProfile.Ref)(historical)).toBe(false)
    expect(Schema.is(TeamProfile.Owner)({ profile: historical, principal })).toBe(false)
  })

  test("public schema identifiers are stable, domain-qualified and unique", () => {
    const schemas = [
      TeamProfile.ContractRevision, TeamProfile.InstallationId, TeamProfile.TenantId,
      TeamProfile.PrincipalObjectId, TeamProfile.TeamObjectId, TeamProfile.ConfigRevision,
      TeamProfile.AccessRevision, TeamProfile.Ref, TeamProfile.Principal, TeamProfile.Revisions,
      TeamProfile.Owner, TeamProfile.Binding, TeamProfile.Selector, TeamProfile.Choice,
      TeamProfile.UnavailableReason, TeamProfile.TeamState, TeamProfile.Administration,
      TeamProfile.Authenticated, TeamProfile.Projection, TeamProfile.AdminUnavailableReason,
      TeamProfile.AdminCommand, TeamProfile.AdminProfile, TeamProfile.AdminListResult, TeamProfile.AdminConfigureResult,
    ]
    const identifiers = schemas.map((schema) =>
      schema.ast.checks?.at(-1)?.annotations?.identifier ?? schema.ast.annotations?.identifier)
    expect(identifiers.every((identifier) =>
      typeof identifier === "string" && identifier.startsWith("Sucafina.TeamProfile."))).toBe(true)
    expect(new Set(identifiers).size).toBe(schemas.length)
  })
})


describe("Teams profile administration wire contracts", () => {
  const command = { action: "enable", profile, expectedRevision: 0 }
  const listed = { status: "ok", configRevision: 0, profiles: [{ profile, enabled: true }] }

  test("configuration intents roundtrip all three actions without a claimed authority", () => {
    for (const action of ["enable", "disable", "remove"]) {
      for (const expectedRevision of [0, 1, Number.MAX_SAFE_INTEGER]) {
        const value = { ...command, action, expectedRevision }
        expect(Schema.encodeSync(TeamProfile.AdminCommand)(Schema.decodeUnknownSync(TeamProfile.AdminCommand)(value))).toEqual(value)
      }
    }
    for (const extra of [
      { principal }, { admin: true }, { supremeAdminGroupId: profile.teamObjectId },
      { accessRevision: "claimed" }, { grants: [] }, { token: "private" },
      { contractRevision: "sf-team-profile/1" }, { expectedPolicyRevision: 0 },
    ]) expect(Schema.is(TeamProfile.AdminCommand)({ ...command, ...extra })).toBe(false)
    for (const action of ["create", "delete", "rename", "", null]) expect(Schema.is(TeamProfile.AdminCommand)({ ...command, action })).toBe(false)
  })

  test("administration revisions require safe integers without string coercion", () => {
    for (const revision of [-1, 0.5, "0", "", null, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      expect(Schema.is(TeamProfile.AdminCommand)({ ...command, expectedRevision: revision })).toBe(false)
      expect(Schema.is(TeamProfile.AdminListResult)({ ...listed, configRevision: revision })).toBe(false)
      expect(Schema.is(TeamProfile.AdminConfigureResult)({ status: "ok", configRevision: revision, changed: true })).toBe(false)
      expect(Schema.is(TeamProfile.AdminConfigureResult)({ status: "conflict", configRevision: revision })).toBe(false)
    }
  })

  test("lists preserve empty, disabled and same-named identities without extra operational data", () => {
    for (const profiles of [[], listed.profiles, [...listed.profiles, { profile: otherProfile, enabled: false }]]) {
      const value = { ...listed, profiles }
      expect(Schema.encodeSync(TeamProfile.AdminListResult)(Schema.decodeUnknownSync(TeamProfile.AdminListResult)(value))).toEqual(value)
    }
    for (const extra of [{ displayName: "Admin" }, { groupId: profile.teamObjectId }, { grants: [] }, { accessToken: "private" }]) {
      expect(Schema.is(TeamProfile.AdminListResult)({ ...listed, profiles: [{ ...listed.profiles[0], ...extra }] })).toBe(false)
    }
    for (const extra of [{ audit: [] }, { principal }, { accessRevision: "claimed" }, { epoch: "private" }]) {
      expect(Schema.is(TeamProfile.AdminListResult)({ ...listed, ...extra })).toBe(false)
    }
  })

  test("lists reject duplicate profiles, cross-binding rows and more than ten thousand records", () => {
    expect(Schema.is(TeamProfile.AdminListResult)({ ...listed, profiles: [...listed.profiles, ...listed.profiles] })).toBe(false)
    for (const foreign of [
      { ...otherProfile, installationId: "other-installation" },
      { ...otherProfile, tenantId: "eeeeeeee-2222-4333-8444-555555555555" },
    ]) expect(Schema.is(TeamProfile.AdminListResult)({ ...listed, profiles: [...listed.profiles, { profile: foreign, enabled: true }] })).toBe(false)
    const profiles = Array.from({ length: 10001 }, (_, index) => ({
      profile: { ...profile, teamObjectId: `${index.toString(16).padStart(8, "0")}-2222-4333-8444-555555555555` },
      enabled: true,
    }))
    expect(Schema.is(TeamProfile.AdminListResult)({ ...listed, profiles: profiles.slice(0, 10000) })).toBe(true)
    expect(Schema.is(TeamProfile.AdminListResult)({ ...listed, profiles })).toBe(false)
  })

  test("configuration outcomes distinguish committed changes, no-ops, conflicts and absence", () => {
    for (const value of [
      { status: "ok", configRevision: 1, changed: true },
      { status: "ok", configRevision: 1, changed: false },
      { status: "conflict", configRevision: 1 },
      { status: "not-found" },
    ]) expect(Schema.encodeSync(TeamProfile.AdminConfigureResult)(Schema.decodeUnknownSync(TeamProfile.AdminConfigureResult)(value))).toEqual(value)
    for (const value of [
      { status: "ok", configRevision: 0 },
      { status: "conflict", configRevision: 1, changed: false },
      { status: "not-found", configRevision: 1 },
      { status: "ok", configRevision: 1, changed: true, handle: "private" },
      { status: "ok", configRevision: 1, changed: true, profile },
    ]) expect(Schema.is(TeamProfile.AdminConfigureResult)(value)).toBe(false)
  })

  test("denied, unauthenticated and transport errors carry no retained configuration", () => {
    for (const status of ["unauthenticated", "denied", "invalid-request"]) {
      for (const schema of [TeamProfile.AdminListResult, TeamProfile.AdminConfigureResult]) {
        expect(Schema.is(schema)({ status })).toBe(true)
        expect(Schema.is(schema)({ status, profiles: listed.profiles })).toBe(false)
        expect(Schema.is(schema)({ status, configRevision: 0 })).toBe(false)
        expect(Schema.is(schema)({ status, principal })).toBe(false)
      }
    }
  })

  test("provider, policy and store failures remain closed unavailable reasons", () => {
    for (const reason of [
      "identity-unavailable", "capability-disabled", "consent-required", "forbidden",
      "rate-limited", "timeout", "incomplete", "invalid-response", "provider-unavailable",
      "policy-unavailable", "policy-changed", "store-unavailable",
    ]) {
      for (const schema of [TeamProfile.AdminListResult, TeamProfile.AdminConfigureResult]) {
        expect(Schema.is(schema)({ status: "unavailable", reason })).toBe(true)
        expect(Schema.is(schema)({ status: "unavailable", reason, profiles: [] })).toBe(false)
      }
    }
    for (const reason of ["", "administrator", "use-repo", "token_expired", undefined]) {
      expect(Schema.is(TeamProfile.AdminListResult)({ status: "unavailable", reason })).toBe(false)
      expect(Schema.is(TeamProfile.AdminConfigureResult)({ status: "unavailable", reason })).toBe(false)
    }
  })

  test("closed administrative shapes reject nested and outer excess even under an ignoring caller", () => {
    const decode = Schema.decodeUnknownSync(TeamProfile.AdminCommand, { onExcessProperty: "ignore" })
    expect(() => decode({ ...command, authority: true })).toThrow()
    expect(() => decode({ ...command, profile: { ...profile, projectId: "legacy" } })).toThrow()
    const read = Schema.decodeUnknownSync(TeamProfile.AdminListResult, { onExcessProperty: "ignore" })
    expect(() => read({ ...listed, profiles: [{ profile, enabled: true, audit: [] }] })).toThrow()
    expect(() => read({ ...listed, credential: "private" })).toThrow()
  })
})

describe("Teams F02 public context", () => {
  const query = {
    contractRevision: "sf-team-profile/1", installationId: profile.installationId,
    tenantId: profile.tenantId, hostId: "host-one", kind: "team", teamObjectId: profile.teamObjectId,
  }
  const stamp = {
    installationId: profile.installationId, projectId: "technical-project", hostId: "host-one",
    principalRef: principal.principalObjectId, policyVersion: "policy-one", accessRevision: revisions.accessRevision,
    team: { owner: { profile, principal }, revisions },
  }
  const context = {
    contractRevision: "sf-team-profile/1", authMode: "microsoft", stamp, profile: authenticated,
    destinations: [], availability: [],
  }

  test("discovery selects an installation and tenant without a technical Project selector", () => {
    const input = { select: "installation", contractRevision: "sf-team-profile/1",
      installationId: profile.installationId, tenantId: profile.tenantId }
    expect(Schema.is(SfInstallationSelector)(input)).toBe(true)
    for (const key of ["contractRevision", "installationId", "tenantId"]) {
      expect(Schema.is(SfInstallationSelector)(Object.fromEntries(
        Object.entries(input).filter(([field]) => field !== key)))).toBe(false)
    }
    const descriptor = { ...profile, projectId: "technical-project", hostId: "host-one",
      publicOrigin: "https://sf.example.test", mount: "/sucafina", contractRevision: "sf-team-profile/1", authMode: "microsoft" }
    const { teamObjectId, ...installed } = descriptor
    expect(Schema.is(SfTeamInstallationDescriptor)(installed)).toBe(true)
    expect(Schema.is(SfTeamInstallationDescriptor)(descriptor)).toBe(false)
    expect(Schema.is(SfTeamInstallationDescriptor)({ ...installed, authMode: "local-operator" })).toBe(false)
  })

  test("selection and administration do not fabricate a Team identity", () => {
    for (const kind of ["selection", "administration"]) {
      const input = { contractRevision: "sf-team-profile/1", kind,
        installationId: profile.installationId, tenantId: profile.tenantId }
      expect(Schema.is(TeamProfile.Selector)(input)).toBe(true)
      expect(Schema.is(SfTeamContextQuery)({ ...input, hostId: "host-one" })).toBe(true)
      expect(Schema.is(SfTeamContextQuery)({ ...input, hostId: "host-one", teamObjectId: profile.teamObjectId })).toBe(false)
    }
  })

  test("Team query is closed, complete and does not accept caller authority", () => {
    expect(Schema.is(SfTeamContextQuery)(query)).toBe(true)
    const { teamObjectId, ...missing } = query
    expect(Schema.is(SfTeamContextQuery)(missing)).toBe(false)
    for (const extra of [{ projectId: "technical-project" }, { directory: "/work" },
      { principalRef: principal.principalObjectId }, { accessRevision: revisions.accessRevision },
      { group: "admin" }, { grant: "write" }, { selected: profile }]) {
      expect(Schema.is(SfTeamContextQuery)({ ...query, ...extra })).toBe(false)
    }
    expect(Schema.is(SfTeamContextQuery)({ ...query, contractRevision: "sf-native-ui/1" })).toBe(false)
  })

  test("current corporate context roundtrips the full Team owner separately from placement", () => {
    const parsed = Schema.decodeUnknownSync(SfTeamContext)(context)
    expect(Schema.encodeSync(SfTeamContext)(parsed)).toEqual(context)
    expect(parsed.stamp.projectId).toBe("technical-project")
    expect(parsed.stamp.team?.owner.profile.teamObjectId).toBe(profile.teamObjectId)
    expect(Schema.is(SfTeamContextResult)({ status: "ok", value: context })).toBe(true)
  })

  test("same technical tuple cannot stand in for another Team or principal", () => {
    for (const team of [
      { owner: { profile: otherProfile, principal }, revisions },
      { owner: { profile, principal: { ...principal, principalObjectId: "d1111111-2222-4333-8444-555555555555" } }, revisions },
      { owner: { profile: { ...profile, installationId: "installation-two" }, principal }, revisions },
      { owner: { profile, principal }, revisions: { ...revisions, accessRevision: "new-authority" } },
      { owner: { profile, principal }, revisions: { ...revisions, configRevision: 1 } },
    ]) expect(Schema.is(SfTeamContext)({ ...context, stamp: { ...stamp, team } })).toBe(false)
  })

  test("projection revisions and principal must agree with the producer stamp", () => {
    for (const projected of [
      { ...authenticated, accessRevision: "new-authority" },
      { ...authenticated, installationId: "installation-two" },
      { ...authenticated, principal: { ...principal, principalObjectId: "d1111111-2222-4333-8444-555555555555" } },
      { ...authenticated, principal: { ...principal, tenantId: "e1111111-2222-4333-8444-555555555555" } },
    ]) expect(Schema.is(SfTeamContext)({ ...context, profile: projected })).toBe(false)
  })

  test("admin with zero Teams or unavailable Teams remains authenticated with no business destinations", () => {
    const { team, ...technical } = stamp
    for (const teams of [{ status: "no-teams" }, { status: "unavailable", reason: "provider-unavailable" }]) {
      const value = { ...context, stamp: technical, profile: { ...authenticated, administration: { status: "available" }, teams } }
      expect(Schema.is(SfTeamContext)(value)).toBe(true)
      expect(Schema.is(SfTeamContext)({ ...value, destinations: [{
        capabilityId: "CAP01", surface: "dashboard", page: "Executive Dashboard", canRead: true, allowedActionIds: [],
      }] })).toBe(false)
      expect(Schema.is(SfTeamContext)({ ...value, stamp })).toBe(false)
    }
  })

  test("legacy stamps omit the optional Team field without inventing an owner", () => {
    const { team, ...technical } = stamp
    const parsed = Schema.decodeUnknownSync(SfContextStamp)(technical)
    expect(Schema.encodeSync(SfContextStamp)(parsed)).toEqual(technical)
    expect(Object.hasOwn(Schema.encodeSync(SfContextStamp)(parsed), "team")).toBe(false)
  })

  test("closed context rejects resolver handles, groups, grants and tokens", () => {
    for (const extra of [{ admission: {} }, { epoch: 1 }, { groups: [] }, { grants: [] }, { accessToken: "private" }]) {
      expect(Schema.is(SfTeamContext)({ ...context, ...extra })).toBe(false)
    }
    expect(Schema.is(SfTeamContext)({ ...context, contractRevision: "sf-native-ui/1" })).toBe(false)
  })
})

describe("private Session response namespaces", () => {
  const namespace = { version: 1, owner: { profile, principal }, authorityGeneration: 2 }

  test("preserves full owner and current authority generation without adding authority fields", () => {
    const decoded = Schema.decodeUnknownSync(TeamProfile.SessionNamespace)(namespace)
    expect(Schema.encodeSync(TeamProfile.SessionNamespace)(decoded)).toEqual(namespace)
    expect(decoded.owner.profile).not.toHaveProperty("projectId")
    for (const invalid of [
      { ...namespace, version: "1" }, { ...namespace, version: 2 },
      { ...namespace, authorityGeneration: 0 }, { ...namespace, authorityGeneration: -1 },
      { ...namespace, authorityGeneration: 1.5 }, { ...namespace, authorityGeneration: "2" },
      { ...namespace, authorityGeneration: Number.MAX_SAFE_INTEGER + 1 },
      { ...namespace, owner: { profile, principal: { ...principal, tenantId: "99999999-2222-4333-8444-555555555555" } } },
      { ...namespace, accessRevision: "claimed" }, { ...namespace, authEpoch: "claimed" },
      { ...namespace, writerPermit: "claimed" }, { ...namespace, grants: ["read"] },
      { ...namespace, owner: { ...namespace.owner, projectId: "claimed" } },
    ]) expect(() => Schema.decodeUnknownSync(TeamProfile.SessionNamespace)(invalid)).toThrow()
  })

  test("Session.Info roundtrips an optional transport label while the technical form stays byte-compatible", () => {
    const info = { id: "ses_public_namespace", projectID: "global", title: "Private Session",
      cost: 0, tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      time: { created: 0, updated: 0 }, location: { directory: "/synthetic-placement" } }
    const technical = Schema.decodeUnknownSync(Session.Info)(info)
    expect(Schema.encodeSync(Session.Info)(technical)).toEqual(info)
    expect(technical).not.toHaveProperty("namespace")
    const corporate = Schema.decodeUnknownSync(Session.Info)({ ...info, namespace })
    expect(Schema.encodeSync(Session.Info)(corporate)).toEqual({ ...info, namespace })
    expect(() => Schema.decodeUnknownSync(Session.Info)({ ...info, namespace: { ...namespace, authorityGeneration: 0 } })).toThrow()
  })
})
