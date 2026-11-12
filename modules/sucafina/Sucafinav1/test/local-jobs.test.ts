import { expect, test } from "bun:test"
import { mkdir, mkdtemp, realpath, rm, stat } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import type { Snapshot } from "../runtime/contract.ts"
import type { BlobTransaction } from "../runtime/assets.ts"
import { createLocalJobs } from "../runtime/local-jobs.ts"
import { openLocalStore } from "../runtime/local-store.ts"

async function fixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sucafina-jobs-"))
  const store = await openLocalStore(path.join(root, "business"))
  const clock = { value: new Date("2026-11-12T12:00:00Z") }
  const operator = { id: "local-real-test-owner", name: "Test owner" }
  const backupDirectory = path.join(root, "backups")
  const jobs = await createLocalJobs({ store, backupDirectory, mount: "/sucafina", operator, now: () => clock.value, schedule: false })
  return { root, store, clock, operator, backupDirectory, jobs, async dispose() { await jobs.dispose(); await store.dispose(); await rm(root, { recursive: true, force: true }) } }
}

test("actual SQLite notices become durable local inbox messages exactly once and remain recipient-scoped", async () => {
  const f = await fixture()
  try {
    await f.store.transaction("procurement", async (snapshot) => {
      snapshot.notices.push({ kind: "pending", to: [f.operator.id], record: "PR-2026-001", at: f.clock.value.toISOString() })
      return { commit: true, value: undefined }
    })
    expect((await f.jobs.runOnce()).error).toBeNull()
    const inbox = await f.jobs.inbox(f.operator.id)
    expect(inbox).toHaveLength(1)
    expect(inbox[0]).toMatchObject({ record: "PR-2026-001", read: false, surface: "procurement" })
    expect(inbox[0]!.link).toBe("/sucafina/procurement?page=Requests&request=PR-2026-001#PR-2026-001")
    expect(await f.jobs.inbox("other-person")).toEqual([])
    await f.jobs.runOnce()
    expect(await f.jobs.inbox(f.operator.id)).toHaveLength(1)
    expect(await f.jobs.markRead("other-person", [inbox[0]!.id])).toBe(0)
    expect(await f.jobs.markRead(f.operator.id, [inbox[0]!.id])).toBe(1)
    expect((await f.jobs.inbox(f.operator.id))[0]!.read).toBe(true)
    await f.jobs.dispose()
    const restarted = await createLocalJobs({ store: f.store, backupDirectory: f.backupDirectory, mount: "/sucafina", operator: f.operator, now: () => f.clock.value, schedule: false })
    try { await restarted.runOnce(); expect(await restarted.inbox(f.operator.id)).toHaveLength(1); expect((await restarted.inbox(f.operator.id))[0]!.read).toBe(true) }
    finally { await restarted.dispose() }
  } finally { await f.dispose() }
})

test("scheduled backup covers all three surfaces, pins real blobs, is private and records daily progress", async () => {
  const f = await fixture()
  try {
    await f.store.transaction("dashboard", async (snapshot: Snapshot, blobs: BlobTransaction) => {
      snapshot.data.assets = [{ id: "a", key: "file", bytes: 3, kind: "contract", record: "c", name: "proof.txt", type: "text/plain" }]
      await blobs.put("file", new Uint8Array([1, 2, 3]), "text/plain")
      return { commit: true, value: undefined }
    })
    const status = await f.jobs.runOnce()
    expect(status.error).toBeNull()
    expect(Object.keys(status.backups).sort()).toEqual(["dashboard", "planner", "procurement"])
    expect(status.lastSuccess).toBe(f.clock.value.toISOString())
    expect((await stat(f.backupDirectory)).mode & 0o777).toBe(0o700)
    const again = await f.jobs.runOnce()
    expect(again.backups).toEqual(status.backups)
    f.clock.value = new Date("2026-11-13T12:00:00Z")
    const next = await f.jobs.runOnce()
    expect(next.backups.dashboard).not.toBe(status.backups.dashboard)
  } finally { await f.dispose() }
})

test("unresolvable recipients are not acknowledged as locally delivered", async () => {
  const f = await fixture()
  try {
    await f.store.transaction("procurement", async (snapshot) => {
      snapshot.notices.push({ kind: "pending", to: ["unavailable-corporate-person"], record: "PR-2", at: f.clock.value.toISOString() })
      return { commit: true, value: undefined }
    })
    expect((await f.jobs.runOnce()).error).not.toBeNull()
    expect(await f.jobs.inbox(f.operator.id)).toEqual([])
    const delivered = await f.store.transaction("procurement", async (snapshot) => ({ commit: false, value: snapshot.data.noticeDelivery }))
    expect(delivered ?? {}).toEqual({})
  } finally { await f.dispose() }
})

test("corporate profile without transport never fabricates inbox receipts", async () => {
  const f = await fixture()
  try {
    await f.jobs.dispose()
    const jobs = await createLocalJobs({ store: f.store, backupDirectory: f.backupDirectory, mount: "/sucafina", schedule: false })
    try {
      expect((await jobs.runOnce()).notifications).toBe("queued-transport-not-configured")
      expect(await jobs.inbox(f.operator.id)).toEqual([])
    } finally { await jobs.dispose() }
  } finally { await f.dispose() }
})


test("unavailable recipients do not starve valid later messages or other applications", async () => {
  const f = await fixture()
  try {
    for (const surface of ["dashboard", "procurement"] as const) {
      await f.store.transaction(surface, async (snapshot) => {
        snapshot.notices.push({ kind: "pending", to: ["unavailable-corporate-person"], record: "blocked", at: f.clock.value.toISOString() })
        snapshot.notices.push({ kind: "pending", to: [f.operator.id], record: surface, at: f.clock.value.toISOString() })
        return { commit: true, value: undefined }
      })
    }
    expect((await f.jobs.runOnce()).error).not.toBeNull()
    expect((await f.jobs.inbox(f.operator.id)).map((item) => item.record).sort()).toEqual(["dashboard", "procurement"])
    await f.jobs.runOnce()
    expect(await f.jobs.inbox(f.operator.id)).toHaveLength(2)
  } finally { await f.dispose() }
})
