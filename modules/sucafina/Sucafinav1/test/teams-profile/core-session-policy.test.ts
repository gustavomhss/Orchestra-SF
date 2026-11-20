import { expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import { Effect } from "effect"
import { SessionAccess } from "@orchestra/schema/session-access"
import type { SfProductGrant } from "../../product/integration/product-authority"
import { oid } from "../microsoft-login/oidc-fixture"
import { productGrant, teamProductFixture } from "./product-fixture"

test("session-policy-01: omitted action sets remain empty and never inherit a role or supreme-group permission", async () => {
  const f = await teamProductFixture()
  try {
    const grants = await f.microsoft.readGrants()
    expect(grants.map((grant) => ({ session: grant.sessionActions, reference: grant.referenceActions, migration: grant.migrationActions })))
      .toEqual([{ session: [], reference: [], migration: [] }, { session: [], reference: [], migration: [] }])
    const current = await f.authority.readCoreSessionAdmission(f.businessRequest())
    if (!current) throw new Error("Actual selected Team admission required")
    expect(await Effect.runPromise(current.authorize("read"))).toBe(false)
    expect(await Effect.runPromise(current.authorize("create"))).toBe(false)
    expect((await f.resolver.list(f.request(undefined, f.cookie))).status).toBe("ok")
  } finally { await f.close() }
})

test("session-policy-02: installed reader validates explicit actions, freezes their arrays and leaves all fifteen role rows intact", async () => {
  const grants: SfProductGrant[] = [{ ...productGrant(), sessionActions: SessionAccess.Actions,
    referenceActions: ["list"], migrationActions: ["map", "cut", "recover"] }]
  const f = await teamProductFixture({ grants })
  try {
    const before = await Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
      f.store.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.roleMap) }))))
    const read = await f.microsoft.readGrants()
    expect(read).toHaveLength(1)
    expect(read[0]?.principalRef).toBe(oid)
    expect(read[0]?.sessionActions).toEqual(SessionAccess.Actions)
    expect(read[0]?.referenceActions).toEqual(["list"])
    expect(read[0]?.migrationActions).toEqual(["map", "cut", "recover"])
    for (const array of [read, read[0]?.sessionActions, read[0]?.referenceActions, read[0]?.migrationActions])
      expect(Object.isFrozen(array)).toBe(true)
    const after = await Promise.all((["dashboard", "planner", "procurement"] as const).map((surface) =>
      f.store.transaction(surface, async (snapshot) => ({ commit: false, value: structuredClone(snapshot.data.roleMap) }))))
    expect(after).toEqual(before)
    expect(before.flat()).toHaveLength(15)
  } finally { await f.close() }
})

test("session-policy-03: null, scalar, duplicate, unknown and replay grants fail closed in the real private file reader", async () => {
  const f = await teamProductFixture()
  try {
    const invalid: readonly [string, unknown][] = [
      ["sessionActions", null], ["sessionActions", "read"], ["sessionActions", false],
      ["sessionActions", ["read", "read"]], ["sessionActions", ["Read"]], ["sessionActions", ["replay"]],
      ["referenceActions", null], ["referenceActions", ["write"]], ["referenceActions", ["list", "list"]],
      ["migrationActions", null], ["migrationActions", ["restore"]], ["migrationActions", ["map", "map"]],
    ]
    for (const [key, value] of invalid) {
      await writeFile(f.file, JSON.stringify({ ...f.config, grants: [{ ...productGrant(), [key]: value }] }))
      await expect(f.microsoft.readGrants()).rejects.toThrow()
      expect(await f.authority.readCoreSessionAdmission(f.businessRequest())).toBeUndefined()
    }
    await f.writeGrants(f.grants)
    expect((await f.microsoft.readGrants())[0]?.sessionActions).toEqual([])
  } finally { await f.close() }
})

test("session-policy-04: each current action set changes the effective revision and invalidates prior private admission", async () => {
  const base: SfProductGrant = { ...productGrant(), sessionActions: ["read"] }
  const f = await teamProductFixture({ grants: [base] })
  try {
    const initial = await f.authority.readCoreSessionAdmission(f.businessRequest())
    if (!initial) throw new Error("Actual Core policy admission required")
    expect(await Effect.runPromise(initial.authorize("read"))).toBe(true)
    expect(await Effect.runPromise(initial.authorize("create"))).toBe(false)
    const revisions = new Set([initial.binding.revisions.accessRevision])
    for (const grant of [
      { ...base, referenceActions: ["list"] } satisfies SfProductGrant,
      { ...base, referenceActions: ["list"], migrationActions: ["map"] } satisfies SfProductGrant,
      { ...base, referenceActions: ["list"], migrationActions: ["cut"] } satisfies SfProductGrant,
      { ...base, sessionActions: ["read", "create"] } satisfies SfProductGrant,
    ]) {
      await f.writeGrants([grant])
      expect(await Effect.runPromise(initial.verifyCurrent())).toBe(false)
      const current = await f.authority.readCoreSessionAdmission(f.businessRequest())
      if (!current) throw new Error("Current installed policy required")
      expect(revisions.has(current.binding.revisions.accessRevision)).toBe(false)
      revisions.add(current.binding.revisions.accessRevision)
    }
    expect(revisions.size).toBe(5)
  } finally { await f.close() }
})
