import { expect, test } from "bun:test"
import { createDashboardProofFixture } from "./fixture.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../product/contracts/canonical.ts"
import { dashboardSourceSelector } from "../../../product/dashboard/sources.ts"
import { rows } from "../../../runtime/contract.ts"

const fields = ["action", "owner", "due", "priority", "notes"]

async function issue(fixture: Awaited<ReturnType<typeof createDashboardProofFixture>>, person: "owner" | "other" = "owner") {
  return fixture.read(async (context) => {
    const day = new Date(fixture.clock.at).toISOString().slice(0, 10)
    const result = await fixture.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields, period: { start: day, end: day } }, context)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error("Real Dashboard source issuance failed")
    return result.value
  }, person)
}

async function business(fixture: Awaited<ReturnType<typeof createDashboardProofFixture>>) {
  return fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone({ data: snapshot.data, versions: snapshot.versions, audit: snapshot.audit }) }))
}

test("WP02 F04 retains read continuity when writing is withdrawn, with no domain effect or substituted grant", async () => {
  const f = await createDashboardProofFixture()
  try {
    const original = await issue(f)
    const originalDigest = digestSfValue(original)
    const before = await business(f)
    const physical = await f.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.sfSources!.records[JSON.stringify(["hotTopics", "topic"])]!.incarnation }))
    f.policies.owner.writable = false
    await f.read(async (context) => {
      const retained = await f.observer.preparePrivateDraftRead(original, context)
      expect(retained.status).toBe("ok")
      if (retained.status !== "ok") throw new Error("Authorized private draft continuity was unavailable")
      expect(retained.value.evidence.target.incarnation).not.toBe(original.target.incarnation)
      expect(retained.value.evidence.target.projectionDigest).toBe(original.target.projectionDigest)
      expect(retained.value.projection.context.principalRef).toBe(f.principal())
      expect(retained.value.projection.values.find((value) => value.id.endsWith(":action"))?.value).toBe("Original action")
      expect(retained.value.projection.context.capabilities).toEqual([])
      expect(JSON.stringify({ evidence: retained.value.evidence, projection: retained.value.projection })).not.toContain(physical)
      expect(await retained.value.fence()).toBe(false)
      expect(await f.persistence.transactionAll!(async () => ({ commit: false, value: await retained.value.fence() }))).toBe(true)
    })
    expect(digestSfValue(original)).toBe(originalDigest)
    expect(await business(f)).toEqual(before)
    const rejected = await f.command({ page: "Hot Topics & Actions", action: "save", id: "topic", version: 0, values: { action: "Forbidden write" } })
    expect(rejected.status).toBe(403)
    expect(await business(f)).toEqual(before)
    expect((await f.page("Hot Topics & Actions")).status).toBe(404)
    const page = await f.exportJson()
    expect(page.status).toBe(200)
    expect(page.headers.get("content-type")).toContain("application/json")
    expect(await page.text()).toContain("Original action")
  } finally { await f.close() }
})

test("WP02 private source proof follows current material through SQLite reopen while the original write version stays unchanged", async () => {
  const f = await createDashboardProofFixture()
  try {
    const original = await issue(f)
    const changed = await f.command({ page: "Hot Topics & Actions", action: "save", id: "topic", version: 0, values: { action: "Changed current action" } })
    expect(changed.status).toBe(200)
    const persisted = await business(f)
    expect(persisted.versions["hotTopics:topic"]?.version).toBe(1)
    expect(rows(persisted.data.hotTopics).find((row) => row.id === "unrelated")?.notes).toBe("Unrelated retained context")
    await f.reopen()
    expect(await business(f)).toEqual(persisted)
    f.clock.at = "2026-11-14T08:00:00Z"
    f.policies.owner.writable = false
    await f.read(async (context) => {
      const retained = await f.observer.preparePrivateDraftRead(original, context)
      expect(retained.status).toBe("ok")
      if (retained.status !== "ok") throw new Error("Persisted source continuity was unavailable after reopen")
      expect(retained.value.evidence.refId).not.toBe(original.refId)
      expect(retained.value.evidence.target.projectionDigest).not.toBe(original.target.projectionDigest)
      expect(retained.value.evidence.target.period).toEqual({ start: "2026-11-14", end: "2026-11-14" })
      expect(retained.value.projection.values.find((value) => value.id.endsWith(":action"))?.value).toBe("Changed current action")
      expect(await f.persistence.transactionAll!(async () => ({ commit: false, value: await retained.value.fence() }))).toBe(true)
    })
    expect(original.target.period).toEqual({ start: "2026-11-13", end: "2026-11-13" })
    expect(await business(f)).toEqual(persisted)
    f.policies.owner.writable = true
    const conflict = await f.command({ page: "Hot Topics & Actions", action: "save", id: "topic", version: 0, values: { action: "Unsaved operator wording" } })
    expect(conflict.status).toBe(409)
    expect(await business(f)).toEqual(persisted)
  } finally { await f.close() }
})

test("WP02 rejects a different authenticated principal, tampered scope and delete/recreate without deleting unrelated records", async () => {
  const f = await createDashboardProofFixture()
  try {
    const original = await issue(f)
    const other = await issue(f, "other")
    expect(other.target.incarnation).not.toBe(original.target.incarnation)
    await f.read(async (context) => {
      expect((await f.observer.preparePrivateDraftRead(original, context)).status).toBe("denied")
      expect((await f.observer.preparePrivateDraftRead(other, context)).status).toBe("ok")
    }, "other")
    await f.read(async (context) => {
      const forged = { ...original, target: { ...original.target, version: original.target.version + 100 } }
      forged.refId = dashboardSourceSelector(forged.target.incarnation, forged.target.version)
      forged.refDigest = digestSfEvidenceRef(forged)
      expect((await f.observer.preparePrivateDraftRead(forged, context)).status).toBe("denied")
      expect((await f.observer.preparePrivateDraftRead({ ...original, refDigest: "0".repeat(64) }, context)).status).toBe("needs-input")
      const narrowed = { ...original, target: { ...original.target, fields: fields.filter((field) => field !== "notes") } }
      narrowed.refDigest = digestSfEvidenceRef(narrowed)
      expect((await f.observer.preparePrivateDraftRead(narrowed, context)).status).toBe("needs-input")
    })
    const before = await business(f)
    const removed = await f.command({ page: "Hot Topics & Actions", action: "delete", id: "topic", version: 0, values: {} })
    expect(removed.status).toBe(200)
    await f.read(async (context) => { expect((await f.observer.preparePrivateDraftRead(original, context)).status).toBe("denied") })
    const deleted = await business(f)
    expect(rows(deleted.data.hotTopics)).toEqual(rows(before.data.hotTopics).filter((row) => row.id !== "topic"))
    // An independently persisted later row with the same textual ID receives a new physical incarnation.
    await f.persistence.transaction("dashboard", async (snapshot) => {
      snapshot.data.hotTopics = [...rows(snapshot.data.hotTopics), { ...rows(before.data.hotTopics).find((row) => row.id === "topic")!, action: "Replacement identity" }]
      return { commit: true, value: undefined }
    })
    const replacement = await issue(f)
    expect(replacement.target.incarnation).not.toBe(original.target.incarnation)
    await f.read(async (context) => {
      expect((await f.observer.preparePrivateDraftRead(original, context)).status).toBe("denied")
      expect((await f.observer.preparePrivateDraftRead(replacement, context)).status).toBe("ok")
    })
    expect(rows((await business(f)).data.hotTopics).find((row) => row.id === "unrelated")).toEqual(rows(before.data.hotTopics).find((row) => row.id === "unrelated"))
  } finally { await f.close() }
})

test("WP02 private read fence rejects late source mutation and logout without reusing an earlier observation", async () => {
  const f = await createDashboardProofFixture()
  try {
    const original = await issue(f)
    await f.read(async (context) => {
      const prepared = await f.observer.preparePrivateDraftRead(original, context)
      expect(prepared.status).toBe("ok")
      if (prepared.status !== "ok") throw new Error("Source fence preparation failed")
      const changed = await f.command({ page: "Hot Topics & Actions", action: "save", id: "topic", version: 0, values: { notes: "Changed after the observation" } })
      expect(changed.status).toBe(200)
      expect(await f.persistence.transactionAll!(async () => ({ commit: false, value: await prepared.value.fence() }))).toBe(false)
    })
    await f.read(async (context) => {
      const prepared = await f.observer.preparePrivateDraftRead(original, context)
      expect(prepared.status).toBe("ok")
      if (prepared.status !== "ok") throw new Error("Current source fence preparation failed")
      expect((await f.logout())?.status).toBe(204)
      expect(await f.persistence.transactionAll!(async () => ({ commit: false, value: await prepared.value.fence() }))).toBe(false)
      const denied = await f.observer.preparePrivateDraftRead(original, context)
      expect(denied.status).toBe("denied")
      expect(JSON.stringify(denied)).not.toContain("Changed after the observation")
    })
    const other = await f.exportJson("other")
    expect(other.status).toBe(200)
    expect(other.headers.get("content-type")).toContain("application/json")
    expect(await other.text()).toContain("Unrelated action")
  } finally { await f.close() }
})

test("WP02 interrupted requests and unavailable SQLite are recoverable reads, while actual read revocation is denied", async () => {
  const f = await createDashboardProofFixture()
  try {
    const original = await issue(f)
    const cancellation = new AbortController()
    await f.read(async (context) => {
      cancellation.abort()
      expect((await f.observer.preparePrivateDraftRead(original, context)).status).toBe("unavailable")
    }, "owner", cancellation.signal)
    await f.read(async (context) => {
      await f.disconnect()
      expect(await f.observer.preparePrivateDraftRead(original, context)).toEqual({ status: "unavailable", reason: "private-draft-source-check-unavailable" })
    })
    await f.reopen()
    await f.read(async (context) => {
      expect((await f.observer.preparePrivateDraftRead(original, context)).status).toBe("ok")
      f.policies.owner.readable = false
      const denied = await f.observer.preparePrivateDraftRead(original, context)
      expect(denied.status).toBe("denied")
      expect(JSON.stringify(denied)).not.toContain("Private operator context")
    })
    const revoked = await f.exportJson()
    expect(revoked.status).toBe(401)
    expect(await revoked.text()).not.toContain("Private operator context")
  } finally { await f.close() }
})
