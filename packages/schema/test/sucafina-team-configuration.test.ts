import { expect, test } from "bun:test"
import { Schema } from "effect"
import { TeamProfile } from "../src/sucafina/team-profile"

const profile = Schema.decodeUnknownSync(TeamProfile.Ref)({
  installationId: "team-configuration",
  tenantId: "11111111-1111-4111-8111-111111111111",
  teamObjectId: "22222222-2222-4222-8222-222222222222",
})
const document = {
  version: 1, settings: {
    model: "provider/model-v1", default_agent: "analyst",
    agents: { analyst: { name: "Analyst", description: "Shared guidance", system: "Read approved evidence.",
      model: "provider/model-v1", variant: "careful", mode: "primary", hidden: false, disabled: false } },
  },
}

test("Team configuration v1 retains only explicitly shared content and its complete source binding", () => {
  const command = { profile, expectedRevision: 0, document }
  expect(Schema.decodeUnknownSync(TeamProfile.ConfigurationCommand)(command)).toEqual(command)
  const value = { origin: "installation-team-store", profile, configRevision: 1, document }
  expect(Schema.decodeUnknownSync(TeamProfile.ConfigurationSnapshot)(value)).toEqual(value)
  expect(Schema.is(TeamProfile.ConfigurationReadResult)({ status: "ok", configuration: value })).toBe(true)
  for (const status of ["not-found", "invalid-request", "unauthenticated", "denied"])
    expect(Schema.is(TeamProfile.ConfigurationReadResult)({ status })).toBe(true)
  expect(Schema.is(TeamProfile.ConfigurationDocument)({ version: 1, settings: {} })).toBe(true)
})

test("Team configuration refuses executable, personal, path-based and unclassified fields at every nesting level", () => {
  for (const field of ["providers", "permissions", "mcp", "plugins", "skills", "commands", "instructions",
    "trusted_projects", "shell", "references", "experimental", "relay", "tokens", "env", "connections"]) {
    expect(Schema.is(TeamProfile.ConfigurationDocument)({ version: 1, settings: { [field]: {} } })).toBe(false)
  }
  for (const field of ["request", "engine", "permissions", "areas", "token", "headers", "body", "tools", "path"]) {
    expect(Schema.is(TeamProfile.ConfigurationDocument)({
      version: 1, settings: { agents: { analyst: { [field]: {} } } },
    })).toBe(false)
  }
  for (const value of [
    { ...document, owner: profile }, { ...document, version: 2 },
    { version: 1, settings: null }, { version: 1, settings: [] },
    { version: 1, settings: { model: " file:///credentials " } },
    { version: 1, settings: { model: "../private" } },
    { version: 1, settings: { default_agent: "../analyst" } },
    { version: 1, settings: { agents: { analyst: { system: "x".repeat(16385) } } } },
    { version: 1, settings: { agents: { analyst: { system: "\u0000" } } } },
    { version: 1, settings: { agents: Object.fromEntries(Array.from({ length: 101 }, (_, i) => [`agent_${i}`, {}])) } },
    JSON.parse('{"version":1,"settings":{"agents":{"constructor":{}}}}'),
    JSON.parse('{"version":1,"settings":{"agents":{"__proto__":{}}}}'),
  ]) expect(Schema.is(TeamProfile.ConfigurationDocument)(value)).toBe(false)
})

test("Team configuration commands and snapshots reject revision coercion, partial identities and extra authority labels", () => {
  for (const value of [
    { profile, expectedRevision: "0", document }, { profile, expectedRevision: -1, document },
    { profile, expectedRevision: 0.5, document }, { profile: { teamObjectId: profile.teamObjectId }, expectedRevision: 0, document },
    { profile, expectedRevision: 0, document, principalObjectId: "user" },
  ]) expect(Schema.is(TeamProfile.ConfigurationCommand)(value)).toBe(false)
  for (const value of [
    { origin: "cwd", profile, configRevision: 1, document },
    { origin: "installation-team-store", profile, configRevision: "1", document },
    { origin: "installation-team-store", profile, configRevision: 1, document, accessRevision: "not authority" },
  ]) expect(Schema.is(TeamProfile.ConfigurationSnapshot)(value)).toBe(false)
})
