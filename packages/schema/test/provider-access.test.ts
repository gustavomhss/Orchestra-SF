import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { ProviderAccess } from "../src/provider-access"
import { ConnectionAccess } from "../src/connection-access"

const profile = { installationId: "sf-provider-test", tenantId: "11111111-1111-1111-1111-111111111111",
  teamObjectId: "22222222-2222-2222-2222-222222222222" }
const key = { category: "integration", resourceId: "corporate-chat", id: "personal-api-key" }
const model = { id: "approved-model", name: "Approved model", limit: { context: 8192, output: 1024 }, tools: false }
const binding = { profile, providerId: "corporate-chat", name: "Corporate chat", protocol: "openai-chat-completions",
  endpoint: "https://model.example.test/v1", connection: key, models: [model] }
const namespace = { version: 1, owner: { profile, principal: { tenantId: profile.tenantId,
  principalObjectId: "33333333-3333-3333-3333-333333333333" } }, authorityGeneration: 4 }

describe("explicit private provider policy", () => {
  test("retains a complete Team binding and explicit native model limits", () => {
    const decoded = Schema.decodeUnknownSync(ProviderAccess.Binding)(binding)
    expect(JSON.stringify(decoded)).toBe(JSON.stringify(binding))
    expect(Schema.is(ProviderAccess.Bindings)([])).toBe(true)
    expect(Schema.is(ProviderAccess.Bindings)([binding])).toBe(true)
  })
  test("rejects incomplete identity and executable or secret fields", () => {
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, profile: { installationId: profile.installationId } })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, apiKey: "MUST-NOT-BE-POLICY" })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, command: "plugin" })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, connection: { ...key, category: "mcp" } })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, models: [{ ...model, settings: { apiKey: "NO" } }] })).toBe(false)
  })
  test("permits only a canonical HTTPS endpoint and its declared protocol", () => {
    for (const endpoint of ["http://model.example.test/v1", "https://user:secret@model.example.test/v1",
      "https://model.example.test/v1?q=1", "https://model.example.test/v1#fragment", "https://MODEL.example.test/v1",
      "https://model.example.test/../v1", "not-a-url"])
      expect(Schema.is(ProviderAccess.Binding)({ ...binding, endpoint })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, protocol: "sdk-plugin" })).toBe(false)
  })
  test("rejects ambiguous providers and model identities, and invalid limits", () => {
    expect(Schema.is(ProviderAccess.Bindings)([binding, binding])).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, models: [model, model] })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, models: [] })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, models: [{ ...model, id: "invalid model" }] })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, models: [{ ...model, limit: { context: 0, output: 1 } }] })).toBe(false)
    expect(Schema.is(ProviderAccess.Binding)({ ...binding, models: [{ ...model, limit: { context: 10, output: 11 } }] })).toBe(false)
    expect(Schema.is(ProviderAccess.Bindings)([binding, { ...binding, profile: { ...profile,
      teamObjectId: "44444444-4444-4444-4444-444444444444" } }])).toBe(true)
  })
  test("browser metadata cannot carry the private endpoint or credential value", () => {
    const metadata = { providerId: binding.providerId, name: binding.name, protocol: binding.protocol,
      connection: key, models: [model] }
    expect(Schema.is(ProviderAccess.Catalog)({ namespace, providers: [metadata] })).toBe(true)
    expect(Schema.is(ProviderAccess.Metadata)({ ...metadata, endpoint: binding.endpoint })).toBe(false)
    expect(Schema.is(ProviderAccess.Metadata)({ ...metadata, secret: "NO" })).toBe(false)
    expect(Schema.is(ProviderAccess.Catalog)({ namespace, providers: [metadata, metadata] })).toBe(false)
  })
})

describe("personal API-key wire contracts", () => {
  const create = { action: "create", key, label: "My key", expectedRevision: 0, secret: "fixture-secret" }
  test("create supports absence or the exact tombstone revision; update/remove require a positive revision", () => {
    expect(Schema.is(ConnectionAccess.PersonalCommand)(create)).toBe(true)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, expectedRevision: 7 })).toBe(true)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, action: "update" })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, action: "update", expectedRevision: 7 })).toBe(true)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ action: "remove", key, expectedRevision: 0 })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ action: "remove", key, expectedRevision: 7 })).toBe(true)
  })
  test("rejects generic encoded credentials, extra commands, unsafe key characters and unknown fields", () => {
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, encodedValue: "{}" })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, key: { ...key, category: "mcp" } })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, secret: "Bearer secret" })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, secret: "secret\r\nheader" })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ ...create, secret: "" })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommand)({ action: "remove", key, expectedRevision: 7, secret: "NO" })).toBe(false)
  })
  test("metadata represents absence without manufacturing a successful write", () => {
    const connection = { key, label: "", revision: 0, state: "absent" }
    expect(Schema.is(ConnectionAccess.PersonalMetadataResult)({ status: "available", namespace, connection })).toBe(true)
    expect(Schema.is(ConnectionAccess.PersonalMetadataResult)({ status: "available", namespace,
      connection: { ...connection, revision: 1 } })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalMetadataResult)({ status: "saved", namespace, connection })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalMetadataResult)({ status: "available", namespace,
      connection: { ...connection, encodedValue: "NO" } })).toBe(false)
  })
  test("mutation results retain tombstone revisions and cannot contain secrets", () => {
    const active = { key, label: "My key", revision: 8, state: "active" }
    const removed = { ...active, revision: 9, state: "removed" }
    expect(Schema.is(ConnectionAccess.PersonalCommandResult)({ status: "saved", namespace, connection: active })).toBe(true)
    expect(Schema.is(ConnectionAccess.PersonalCommandResult)({ status: "removed", namespace, connection: removed })).toBe(true)
    expect(Schema.is(ConnectionAccess.PersonalCommandResult)({ status: "saved", namespace, connection: removed })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommandResult)({ status: "removed", namespace, connection: active })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommandResult)({ status: "saved", namespace,
      connection: { ...active, secret: "NO" } })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalCommandResult)({ status: "conflict" })).toBe(true)
  })
  test("both response codecs preserve full Owner consistency and generation", () => {
    const bad = { ...namespace, owner: { ...namespace.owner,
      principal: { ...namespace.owner.principal, tenantId: "44444444-4444-4444-4444-444444444444" } } }
    const connection = { key, label: "", revision: 0, state: "absent" }
    expect(Schema.is(ConnectionAccess.PersonalMetadataResult)({ status: "available", namespace: bad, connection })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalMetadataResult)({ status: "available",
      namespace: { ...namespace, authorityGeneration: 0 }, connection })).toBe(false)
    expect(Schema.is(ConnectionAccess.PersonalMetadataResult)({ status: "denied", secret: "NO" })).toBe(false)
  })
})
