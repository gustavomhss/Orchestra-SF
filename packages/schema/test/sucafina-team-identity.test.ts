import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { Ref } from "../src/sucafina/team-profile"

const profile = {
  installationId: "installation-one",
  tenantId: "11111111-2222-4333-8444-555555555555",
  teamObjectId: "a1111111-2222-4333-8444-555555555555",
}
const principal = {
  tenantId: profile.tenantId,
  principalObjectId: "c1111111-2222-4333-8444-555555555555",
}
const revisions = { configRevision: 0, accessRevision: "authority-1" }

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
    expect<string>(Schema.decodeUnknownSync(TeamProfile.Ref)(profile).teamObjectId).toBe(profile.teamObjectId)
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

})
