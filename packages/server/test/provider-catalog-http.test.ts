import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import path from "node:path"
import { Effect, Schema } from "effect"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import type { SfProductGrant } from "../../../modules/sucafina/Sucafinav1/product/integration/product-authority"
import { productGrant } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/product-fixture"
import { basic, decode, teamSessionHttpFixture, profileA, profileB, oid, other } from "./fixture/team-session-http"

const route = "/api/provider/catalog"
const binding = Schema.decodeUnknownSync(ProviderAccess.Binding)({
  profile: profileA, providerId: "corporate-private", name: "Corporate private", protocol: "openai-chat-completions",
  endpoint: "https://synthetic-private-provider.invalid/v1/chat/completions",
  connection: { category: "integration", resourceId: "corporate-private", id: "personal-key" },
  models: [{ id: "private-model", name: "Private model", limit: { context: 4096, output: 1024 }, tools: true }],
})
const grant = (principalRef = oid): SfProductGrant => ({
  ...productGrant(principalRef), sessionActions: [], connectionActions: ["read"],
  connectionResources: [{ category: "integration", resourceId: binding.connection.resourceId }],
  providerBindings: [binding],
})

test("provider-http-01: original admission lists current metadata without Location, credential or model execution", async () => {
  await using f = await teamSessionHttpFixture({ grants: [grant()] })
  const raw = new Database(path.join(f.directory, "installation.sqlite"), { strict: true })
  try {
    await f.run((http) => Effect.gen(function* () {
      const original = f.request(route)
      const response = yield* Effect.promise(() => http.mounted(original))
      expect(response.status).toBe(200)
      expect(http.originals[0]).toBe(original)
      expect(response.headers.get("cache-control")).toBe("no-store")
      const catalog = yield* decode(response, ProviderAccess.Catalog)
      expect(catalog.namespace.owner.profile).toEqual(profileA)
      expect(String(catalog.namespace.owner.principal.principalObjectId)).toBe(oid)
      expect(catalog.namespace.authorityGeneration).toBe(1)
      expect(catalog.providers).toEqual([{
        providerId: binding.providerId, name: binding.name, protocol: binding.protocol,
        connection: binding.connection, models: binding.models,
      }])
      expect(JSON.stringify(catalog)).not.toContain(binding.endpoint)
      expect(f.calls.projects).toBe(0)
      expect(f.calls.resumes).toBe(0)
      expect(raw.query("SELECT COUNT(*) AS count FROM sf_team_connections").get()).toEqual({ count: 0 })
      expect(raw.query("SELECT revision,key_fingerprint FROM sf_team_connection_header").get()).toEqual({ revision: 0, key_fingerprint: null })
      const sessions = yield* Effect.promise(() => http.mounted(f.request("/api/session")))
      expect(sessions.status).toBe(401)
    }))
  } finally { raw.close() }
}, 30000)

test("provider-http-02: another Team or principal sees only explicitly declared bindings and current resource ACL", async () => {
  await using f = await teamSessionHttpFixture({ grants: [grant(), productGrant(other)] })
  const second = await f.login(other)
  await f.run((http) => Effect.gen(function* () {
    for (const [profile, cookie] of [[profileB, f.cookie], [profileA, second]] as const) {
      const response = yield* Effect.promise(() => http.mounted(f.request(route, profile, cookie)))
      expect(response.status).toBe(200)
      const catalog = yield* decode(response, ProviderAccess.Catalog)
      expect(catalog.providers).toEqual([])
      expect(catalog.namespace.owner.profile).toEqual(profile)
      expect(String(catalog.namespace.owner.principal.principalObjectId)).toBe(cookie === f.cookie ? oid : other)
    }
    yield* Effect.promise(() => f.writeGrants([{ ...grant(), connectionResources: [] }]))
    const deniedResource = yield* Effect.promise(() => http.mounted(f.request(route)))
    expect(deniedResource.status).toBe(200)
    expect((yield* decode(deniedResource, ProviderAccess.Catalog)).providers).toEqual([])
    yield* Effect.promise(() => f.writeGrants([{ ...grant(), providerBindings: [] }]))
    const noBinding = yield* Effect.promise(() => http.mounted(f.request(route)))
    expect(noBinding.status).toBe(200)
    expect((yield* decode(noBinding, ProviderAccess.Catalog)).providers).toEqual([])
  }))
}, 30000)

test("provider-http-03: missing Microsoft authority, forged transport and selector extras never become an empty success", async () => {
  await using f = await teamSessionHttpFixture({ grants: [grant()] })
  await f.run((http) => Effect.gen(function* () {
    const anonymous = yield* Effect.promise(() => http.mounted(f.request(route, profileA, "")))
    expect(anonymous.status).toBe(403)
    expect(yield* Effect.promise(() => anonymous.json())).toEqual({ status: "denied" })
    for (const headers of [
      new Headers({ authorization: basic }), new Headers({ origin: "https://other.invalid" }),
      new Headers({ "sec-fetch-site": "cross-site" }), new Headers({ host: "other.invalid" }),
    ]) expect((yield* Effect.promise(() => http.mounted(f.request(route, profileA, f.cookie, { headers })))).status).toBe(403)
    for (const query of ["?", "#", "?auth_token=forged", "?providerId=foreign", "?teamObjectId=foreign"])
      expect((yield* Effect.promise(() => http.mounted(f.request(route + query)))).status).toBe(400)
    for (const headers of [new Headers({ "content-length": "1" }), new Headers({ "content-length": "0, 0" }),
      new Headers({ "transfer-encoding": "chunked" }), new Headers({ "content-encoding": "gzip" })])
      expect((yield* Effect.promise(() => http.mounted(f.request(route, profileA, f.cookie, { headers })))).status).toBe(400)
    const post = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, {})))
    expect(post.status).toBe(405)
    expect(post.headers.get("allow")).toBe("GET")
  }))
}, 30000)
