import { expect, test } from "bun:test"
import { Database as NativeDatabase } from "bun:sqlite"
import path from "node:path"
import { Context, Effect, Exit, Layer } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { SessionAccess } from "@orchestra/schema/session-access"
import { Credential } from "../src/credential"
import { McpAuth } from "../src/mcp/auth"
import { Integration } from "../src/integration"
import { EventV2 } from "../src/event"
import { SessionOwner } from "../src/session/owner"
import { LayerNode } from "../src/effect/layer-node"
import { teamSessionFixture, profileA, profileB, oid, other } from "./fixture/team-session"
import { productGrant } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/product-fixture"
import type { SfProductGrant } from "../../../modules/sucafina/Sucafinav1/product/integration/product-authority"
import { barrier } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/installation-fixture"

const integrationID = Integration.ID.make("synthetic-provider")
const mcpName = "synthetic-server"
const resources: readonly ConnectionAccess.Resource[] = [
  { category: "integration", resourceId: integrationID }, { category: "mcp", resourceId: mcpName },
]
const grant = (principalRef = oid, actions: readonly ConnectionAccess.Action[] = ConnectionAccess.Actions,
  allowed = resources): SfProductGrant => ({
  ...productGrant(principalRef), sessionActions: SessionAccess.Actions, connectionActions: actions, connectionResources: allowed,
})
const fixture = (grants: readonly SfProductGrant[] = [grant(), grant(other)]) =>
  teamSessionFixture({ grants, extraNodes: [LayerNode.group([Credential.node, McpAuth.node])] })
const credential = (key = "synthetic-private-token") => ({
  integrationID, label: "Personal provider", value: Credential.Key.make({ type: "key", key }),
})
const integrations = Effect.gen(function* () {
  const credentials = yield* Credential.Service
  const events = yield* EventV2.Service
  const owners = yield* SessionOwner.Service
  // Build the actual location service in this live scope using these exact global services.
  const context = yield* Layer.build(LayerNode.compile(Integration.node, [
    [Credential.node, Layer.succeed(Credential.Service, credentials)],
    [EventV2.node, Layer.succeed(EventV2.Service, events)],
    [SessionOwner.node, Layer.succeed(SessionOwner.Service, owners)],
  ]))
  return Context.get(context, Integration.Service)
})

test("team-connections-01: real private grants and Owner route Core credentials to encrypted personal records", async () => {
  await using f = await fixture()
  const raw = new NativeDatabase(path.join(f.directory, "installation.sqlite"), { strict: true })
  try {
    const created = await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const service = yield* Credential.Service
      const created = yield* service.create(credential())
      expect(yield* service.get(created.id)).toEqual(created)
      expect(yield* service.list(integrationID)).toEqual([created])
      const owners = yield* SessionOwner.Service
      const port = yield* owners.connections(yield* owners.open())
      if (!port) throw new Error("Actual private vault required")
      const metadata = yield* port.list("integration")
      expect(metadata).toHaveLength(1)
      const inspected = yield* port.inspect({ category: "integration", resourceId: integrationID, id: created.id })
      expect(inspected).toEqual(metadata[0])
      expect(JSON.stringify(inspected)).not.toContain("synthetic-private-token")
      expect(JSON.stringify(metadata)).not.toContain("synthetic-private-token")
      expect(yield* service.inheritedFrom(created.id)).toBeUndefined()
      return created
    })))
    const second = await f.login(other)
    for (const request of [f.businessRequest(profileB), f.businessRequest(profileA, second)]) {
      await f.run(f.admitted(request, Effect.gen(function* () {
        const service = yield* Credential.Service
        expect(yield* service.get(created.id)).toBeUndefined()
        expect(yield* service.list(integrationID)).toEqual([])
      })))
    }
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const service = yield* Credential.Service
      yield* service.update(created.id, { label: "Updated personal label" })
      expect((yield* service.get(created.id))?.label).toBe("Updated personal label")
      yield* service.remove(created.id)
      expect(yield* service.get(created.id)).toBeUndefined()
    })))
    expect(raw.query("SELECT revision,state,ciphertext FROM sf_team_connections").all())
      .toEqual([{ revision: 3, state: "removed", ciphertext: null }])
    expect(raw.query("SELECT COUNT(*) AS count FROM sf_team_connection_audit").get()).toEqual({ count: 3 })
  } finally { raw.close() }
}, 30000)


test("team-connections-02: an omitted action or exact resource cannot inherit a financial/admin/Team grant", async () => {
  for (const policy of [
    { ...productGrant(), sessionActions: SessionAccess.Actions },
    grant(oid, ["read"]),
    grant(oid, ConnectionAccess.Actions, [{ category: "integration", resourceId: "different-provider" }]),
  ]) {
    await using f = await fixture([policy])
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const service = yield* Credential.Service
      const result = yield* Effect.exit(service.create(credential()))
      expect(Exit.isFailure(result)).toBe(true)
    })))
    const raw = new NativeDatabase(path.join(f.directory, "installation.sqlite"), { strict: true })
    try {
      expect(raw.query("SELECT revision,key_fingerprint FROM sf_team_connection_header").get())
        .toEqual({ revision: 0, key_fingerprint: null })
      expect(raw.query("SELECT * FROM sf_team_connection_audit").all()).toEqual([])
    } finally { raw.close() }
  }
}, 30000)

test("team-connections-03: current grant removal, role removal and generation changes revoke retained vault clients", async () => {
  await using f = await fixture()
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const port = yield* owners.connections(yield* owners.open())
    if (!port) throw new Error("Actual private vault required")
    yield* Effect.promise(() => f.writeGrants([grant(oid, ["read"]), grant(other)]))
    expect(Exit.isFailure(yield* Effect.exit(port.write({
      key: { category: "integration", resourceId: integrationID, id: "late" }, label: "Late",
      encodedValue: '{"type":"key","key":"synthetic"}', expectedRevision: 0, action: "create",
    })))).toBe(true)
  })))
  await f.writeGrants([grant(), grant(other)])
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const service = yield* Credential.Service
    yield* Effect.promise(() => f.store.transaction("dashboard", async (snapshot) => {
      snapshot.data.roleMap = []
      return { commit: true, value: undefined }
    }))
    expect(Exit.isFailure(yield* Effect.exit(service.create(credential())))).toBe(true)
  })))
  // A fresh fixture preserves real role state while proving the independent durable generation fence.
  await using current = await fixture()
  await current.run(current.admitted(current.businessRequest(), Effect.gen(function* () {
    const owners = yield* SessionOwner.Service
    const port = yield* owners.connections(yield* owners.open())
    if (!port) throw new Error("Actual private vault required")
    current.advance()
    expect(Exit.isFailure(yield* Effect.exit(port.list("integration")))).toBe(true)
  })))
}, 30000)

test("team-connections-04: corporate credentials leave the historical plaintext Core row quarantined and byte-identical", async () => {
  await using f = await fixture()
  const raw = new NativeDatabase(f.filename, { strict: true })
  const legacyID = Credential.ID.make("cred_synthetic_legacy")
  const plaintext = JSON.stringify({ type: "key", key: "synthetic-legacy-secret" })
  try {
    raw.query("INSERT INTO credential(id,integration_id,label,value,time_created,time_updated) VALUES(?,?,?,?,?,?)")
      .run(legacyID, integrationID, "Unmapped historical credential", plaintext, 1, 1)
    const before = raw.query("SELECT * FROM credential").all()
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const service = yield* Credential.Service
      expect(yield* service.all()).toEqual([])
      expect(yield* service.get(legacyID)).toBeUndefined()
      expect(yield* service.inheritedFrom(legacyID)).toBeUndefined()
      expect(Exit.isFailure(yield* Effect.exit(service.update(legacyID, { label: "Must not adopt" })))).toBe(true)
      yield* service.create(credential())
    })))
    expect(raw.query("SELECT * FROM credential").all()).toEqual(before)
    expect(raw.query("SELECT value FROM credential").get()).toEqual({ value: plaintext })
  } finally { raw.close() }
}, 30000)

test("team-connections-05: MCP state, verifier and tokens remain personal, URL-bound and unavailable without a current lease", async () => {
  await using f = await fixture()
  await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
    const auth = yield* McpAuth.Service
    yield* auth.updateOAuthState(mcpName, "synthetic-oauth-state")
    yield* auth.updateCodeVerifier(mcpName, "synthetic-verifier")
    yield* auth.updateClientInfo(mcpName, { clientId: "synthetic-client", clientSecret: "synthetic-client-secret" }, "https://synthetic.invalid/mcp")
    yield* auth.updateTokens(mcpName, { accessToken: "synthetic-token", refreshToken: "synthetic-refresh" }, "https://synthetic.invalid/mcp")
    expect((yield* auth.getForUrl(mcpName, "https://synthetic.invalid/mcp"))?.tokens?.accessToken).toBe("synthetic-token")
    expect(yield* auth.getForUrl(mcpName, "https://different.invalid/mcp")).toBeUndefined()
    expect(yield* auth.getOAuthState(mcpName)).toBe("synthetic-oauth-state")
    yield* auth.clearOAuthState(mcpName)
    yield* auth.clearCodeVerifier(mcpName)
    const current = yield* auth.get(mcpName)
    expect(current?.oauthState).toBeUndefined()
    expect(current?.codeVerifier).toBeUndefined()
    expect(current?.clientInfo?.clientId).toBe("synthetic-client")
  })))
  await f.run(f.admitted(f.businessRequest(profileB), Effect.gen(function* () {
    const auth = yield* McpAuth.Service
    expect(yield* auth.get(mcpName)).toBeUndefined()
  })))
  await f.run(Effect.gen(function* () {
    const auth = yield* McpAuth.Service
    expect(Exit.isFailure(yield* Effect.exit(auth.get(mcpName)))).toBe(true)
  }))
}, 30000)

test("team-connections-06: a corporate integration cannot enumerate or resolve an ambient environment credential", async () => {
  await using f = await fixture()
  const name = "ORCHESTRA_SYNTHETIC_TEAM_CONNECTION_TOKEN"
  const previous = process.env[name]
  process.env[name] = "synthetic-ambient-secret"
  try {
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const service = yield* integrations
      yield* service.transform((draft) => {
        draft.method.update({ integrationID, method: { type: "env", names: [name] } })
      })
      expect((yield* service.get(integrationID))?.connections).toEqual([])
      expect(yield* service.connection.resolve({ type: "env", name })).toBeUndefined()
      const credentials = yield* Credential.Service
      const privateRecord = yield* credentials.create(credential())
      expect(yield* service.connection.resolve({ type: "credential", id: privateRecord.id, label: privateRecord.label }))
        .toEqual(privateRecord.value)
    })))
  } finally {
    if (previous === undefined) delete process.env[name]
    else process.env[name] = previous
  }
}, 30000)

test("team-connections-07: undeclared provider OAuth never starts and logout during a pending callback writes no credential", async () => {
  await using f = await fixture()
  const gate = barrier()
  let started = 0
  try {
    await f.run(f.admitted(f.businessRequest(), Effect.gen(function* () {
      const service = yield* integrations
      const methodID = Integration.MethodID.make("synthetic-code")
      const unrelated = Integration.ID.make("not-declared")
      const authorize: Integration.OAuthImplementation["authorize"] = () => Effect.sync(() => {
        started++
        return { mode: "code" as const, url: "https://synthetic.invalid/oauth", instructions: "Synthetic callback",
          callback: () => Effect.promise(async () => {
            await gate.hold()
            return Credential.OAuth.make({ type: "oauth", methodID, access: "synthetic-access", refresh: "synthetic-refresh", expires: 9999999999 })
          }) }
      })
      yield* service.transform((draft) => {
        for (const id of [integrationID, unrelated]) draft.method.update({
          integrationID: id, method: { type: "oauth", id: methodID, label: "Synthetic OAuth" }, authorize,
        })
      })
      expect(Exit.isFailure(yield* Effect.exit(service.connection.oauth({ integrationID: unrelated, methodID, inputs: {} })))).toBe(true)
      expect(started).toBe(0)
      const attempt = yield* service.connection.oauth({ integrationID, methodID, inputs: {} })
      expect(started).toBe(1)
      const completing = Effect.runPromise(service.attempt.complete({ attemptID: attempt.attemptID, code: "synthetic-code" }))
      void completing.catch(() => undefined)
      yield* Effect.promise(() => gate.entered)
      expect((yield* Effect.promise(() => f.logout(f.cookie)))?.status).toBe(204)
      gate.release()
      yield* Effect.promise(async () => { await expect(completing).rejects.toThrow() })
    })))
    const raw = new NativeDatabase(path.join(f.directory, "installation.sqlite"), { strict: true })
    try { expect(raw.query("SELECT * FROM sf_team_connection_audit").all()).toEqual([]) } finally { raw.close() }
  } finally { gate.release() }
}, 30000)
