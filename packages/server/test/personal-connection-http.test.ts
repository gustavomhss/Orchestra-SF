import { expect, test } from "bun:test"
import { Database } from "bun:sqlite"
import path from "node:path"
import { Effect } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import type { SfProductGrant } from "../../../modules/sucafina/Sucafinav1/product/integration/product-authority"
import { productGrant } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/product-fixture"
import { barrier } from "../../../modules/sucafina/Sucafinav1/test/teams-profile/installation-fixture"
import { isInstalledSessionPath } from "../src/session-http"
import { basic, decode, teamSessionHttpFixture, profileA, profileB, oid, other } from "./fixture/team-session-http"

const route = "/api/connection/personal"
const resource = { category: "integration", resourceId: "synthetic-provider" } as const
const key = { ...resource, id: "personal-key" }
const query = "?" + new URLSearchParams(key)
const secret = "synthetic-private-http-key"
const create = { action: "create", key, label: "Personal connection", expectedRevision: 0, secret } as const
const grant = (principalRef = oid, actions: readonly ConnectionAccess.Action[] = ConnectionAccess.Actions,
  resources: readonly ConnectionAccess.Resource[] = [resource]): SfProductGrant => ({
  ...productGrant(principalRef), sessionActions: [], connectionActions: actions, connectionResources: resources,
})
const fixture = (grants = [grant(), grant(other)]) => teamSessionHttpFixture({ grants })
const rawStore = (directory: string) => new Database(path.join(directory, "installation.sqlite"), { strict: true })

test("personal-http-01: original Microsoft Request and explicit connection ACL work without Session actions", async () => {
  await using f = await fixture()
  const raw = rawStore(f.directory)
  try {
    await f.run((http) => Effect.gen(function* () {
      expect(isInstalledSessionPath(f.config.mount + route, f.config.mount)).toBe(true)
      const original = f.request(route + query)
      const empty = yield* Effect.promise(() => http.mounted(original))
      expect(empty.status).toBe(200)
      expect(http.originals[0]).toBe(original)
      expect(empty.headers.get("cache-control")).toBe("no-store")
      expect(empty.headers.get("x-content-type-options")).toBe("nosniff")
      const absent = yield* decode(empty, ConnectionAccess.PersonalMetadataResult)
      expect(absent.status).toBe("available")
      if (absent.status !== "available") throw new Error("Current slot required")
      expect(absent.connection).toEqual({ key, label: "", revision: 0, state: "absent" })
      expect(absent.namespace.owner.profile).toEqual(profileA)
      expect(absent.namespace.owner.principal.principalObjectId).toBe(oid)
      expect(absent.namespace.authorityGeneration).toBe(1)
      for (const [command, status, revision] of [
        [create, "saved", 1],
        [{ ...create, action: "update", expectedRevision: 1, secret: "synthetic-rotated-key" }, "saved", 2],
        [{ action: "remove", key, expectedRevision: 2 }, "removed", 3],
        [{ action: "remove", key, expectedRevision: 3 }, "removed", 3],
        [{ ...create, expectedRevision: 3 }, "saved", 4],
      ] as const) {
        const response = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, command)))
        expect(response.status).toBe(200)
        const result = yield* decode(response, ConnectionAccess.PersonalCommandResult)
        expect(result.status).toBe(status)
        if (result.status !== "saved" && result.status !== "removed") throw new Error("Actual retained metadata required")
        expect(result.connection.key).toEqual(key)
        expect(result.connection.revision).toBe(revision)
        expect(JSON.stringify(result)).not.toContain(secret)
        expect(JSON.stringify(result)).not.toContain("synthetic-rotated-key")
      }
      const conflict = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, create)))
      expect(conflict.status).toBe(409)
      expect(yield* decode(conflict, ConnectionAccess.PersonalCommandResult)).toEqual({ status: "conflict" })
      const observed = yield* Effect.promise(() => http.mounted(f.request(route + query)))
      const current = yield* decode(observed, ConnectionAccess.PersonalMetadataResult)
      expect(current.status).toBe("available")
      if (current.status !== "available") throw new Error("Current slot required")
      expect(current.connection).toEqual({ key, label: create.label, revision: 4, state: "active" })
      const sessions = yield* Effect.promise(() => http.mounted(f.request("/api/session")))
      expect(sessions.status).toBe(401)
    }))
    expect(raw.query("SELECT revision,state FROM sf_team_connections").all()).toEqual([{ revision: 4, state: "active" }])
    expect(raw.query("SELECT COUNT(*) AS count FROM sf_team_connection_audit").get()).toEqual({ count: 4 })
    const physical = JSON.stringify(raw.query("SELECT * FROM sf_team_connections").all())
    expect(physical).not.toContain(secret)
    expect(physical).not.toContain("synthetic-rotated-key")
  } finally { raw.close() }
}, 30000)

test("personal-http-02: metadata and revisions are isolated by full Team and immutable person", async () => {
  await using f = await fixture()
  const secondCookie = await f.login(other)
  await f.run((http) => Effect.gen(function* () {
    const stored = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, create)))
    expect(stored.status).toBe(200)
    for (const [profile, cookie] of [[profileB, f.cookie], [profileA, secondCookie]] as const) {
      const response = yield* Effect.promise(() => http.mounted(f.request(route + query, profile, cookie)))
      expect(response.status).toBe(200)
      const result = yield* decode(response, ConnectionAccess.PersonalMetadataResult)
      expect(result.status).toBe("available")
      if (result.status !== "available") throw new Error("Current slot required")
      expect(result.connection).toEqual({ key, label: "", revision: 0, state: "absent" })
      expect(result.namespace.owner.profile).toEqual(profile)
      expect(result.namespace.owner.principal.principalObjectId).toBe(cookie === f.cookie ? oid : other)
    }
    const forged = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, {
      ...create, owner: { profile: profileA, principal: { principalObjectId: other } },
    })))
    expect(forged.status).toBe(400)
  }))
}, 30000)

test("personal-http-03: exact actions and resources never inherit Team, admin or Session permissions", async () => {
  await using f = await fixture([grant(oid, ["read"])])
  const raw = rawStore(f.directory)
  try {
    await f.run((http) => Effect.gen(function* () {
      const denied = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, create)))
      expect(denied.status).toBe(403)
      expect(raw.query("SELECT COUNT(*) AS count FROM sf_team_connection_audit").get()).toEqual({ count: 0 })
      yield* Effect.promise(() => f.writeGrants([grant(oid, ["create"])]))
      const saved = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, create)))
      expect(saved.status).toBe(200)
      const noRead = yield* Effect.promise(() => http.mounted(f.request(route + query)))
      expect(noRead.status).toBe(403)
      yield* Effect.promise(() => f.writeGrants([grant(oid, ["remove"])]))
      const removedWithoutObservation = yield* Effect.promise(() => http.mounted(f.jsonRequest(route, {
        action: "remove", key, expectedRevision: 1,
      })))
      expect(removedWithoutObservation.status).toBe(503)
      expect(yield* decode(removedWithoutObservation, ConnectionAccess.PersonalCommandResult)).toEqual({ status: "unavailable" })
      expect(raw.query("SELECT revision,state FROM sf_team_connections").all()).toEqual([{ revision: 2, state: "removed" }])
      yield* Effect.promise(() => f.writeGrants([grant(oid, ConnectionAccess.Actions, [{ ...resource, resourceId: "another-provider" }])]))
      const wrongResource = yield* Effect.promise(() => http.mounted(f.request(route + query)))
      expect(wrongResource.status).toBe(403)
      yield* Effect.promise(() => f.writeGrants([grant()]))
      const fresh = yield* Effect.promise(() => http.mounted(f.request(route + query)))
      const observed = yield* decode(fresh, ConnectionAccess.PersonalMetadataResult)
      expect(observed.status).toBe("available")
      if (observed.status !== "available") throw new Error("Current slot required")
      expect(observed.connection.state).toBe("removed")
      expect(observed.connection.revision).toBe(2)
    }))
  } finally { raw.close() }
}, 30000)

test("personal-http-04: origin, route, query, body and public key schema are closed before any write", async () => {
  await using f = await fixture()
  const raw = rawStore(f.directory)
  try {
    await f.run((http) => Effect.gen(function* () {
      for (const headers of [
        { authorization: basic }, { "sec-fetch-site": "cross-site" }, { origin: "https://other.invalid" },
        { host: "other.invalid" },
      ]) {
        const denied = yield* Effect.promise(() => http.mounted(f.request(route + query, profileA, f.cookie, { headers })))
        expect(denied.status).toBe(403)
      }
      const absentOrigin = f.rawRequest(route, f.cookie, { method: "POST", headers: {
        "content-type": "application/json", "x-sf-team-profile": JSON.stringify({
          contractRevision: "sf-team-profile/1", kind: "team", profile: profileA,
        }),
      }, body: JSON.stringify(create) })
      expect((yield* Effect.promise(() => http.mounted(absentOrigin))).status).toBe(403)
      const anonymous = yield* Effect.promise(() => http.mounted(f.request(route + query, profileA, "")))
      expect(anonymous.status).toBe(403)
      for (const suffix of [query + "&id=second", query + "&auth_token=forged", "?category=mcp&resourceId=x&id=y"]) {
        expect((yield* Effect.promise(() => http.mounted(f.request(route + suffix)))).status).toBe(400)
      }
      for (const body of [
        { ...create, encodedValue: '{"type":"oauth","refresh":"forged"}' },
        { ...create, key: { ...key, category: "mcp" } },
        { ...create, action: "update", expectedRevision: 0 },
        { ...create, secret: "contains a space" },
        { action: "remove", key, expectedRevision: 0 },
      ]) expect((yield* Effect.promise(() => http.mounted(f.jsonRequest(route, body)))).status).toBe(400)
      expect(raw.query("SELECT COUNT(*) AS count FROM sf_team_connection_audit").get()).toEqual({ count: 0 })
    }))
  } finally { raw.close() }
}, 30000)

test("personal-http-05: revocation during complete-body reading prevents a stale secret write", async () => {
  await using f = await fixture()
  const raw = rawStore(f.directory)
  const pause = barrier()
  try {
    await f.run((http) => Effect.gen(function* () {
      const stream = new ReadableStream<Uint8Array>({ async pull(controller) {
        await pause.hold()
        controller.enqueue(new TextEncoder().encode(JSON.stringify(create)))
        controller.close()
      } }, { highWaterMark: 0 })
      const original = f.request(route, profileA, f.cookie, {
        method: "POST", headers: { "content-type": "application/json" }, body: stream,
      })
      const pending = http.mounted(original)
      yield* Effect.promise(() => pause.entered)
      expect(http.originals[0]).toBe(original)
      yield* Effect.promise(() => f.writeGrants([grant(oid, [])]))
      pause.release()
      const response = yield* Effect.promise(() => pending)
      expect(response.status).toBe(503)
      expect(yield* decode(response, ConnectionAccess.PersonalCommandResult)).toEqual({ status: "unavailable" })
      expect(raw.query("SELECT COUNT(*) AS count FROM sf_team_connection_audit").get()).toEqual({ count: 0 })
      expect(raw.query("SELECT revision,key_fingerprint FROM sf_team_connection_header").get()).toEqual({ revision: 0, key_fingerprint: null })
    }))
  } finally { pause.release(); raw.close() }
}, 30000)
