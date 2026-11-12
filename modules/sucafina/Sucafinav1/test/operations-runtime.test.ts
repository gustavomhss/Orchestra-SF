import { createHash } from "node:crypto"
import { expect, test } from "bun:test"
import { backup, deliverNotices, queueApprovalReminders, restoreBackup } from "../runtime/operations.ts"
import { empty, testPersistence } from "./fixture/persistence.ts"
import type { BackupManifest, NoticeTransport, RestoreTransport } from "../runtime/operations.ts"

const at = "2026-11-11T12:00:00Z"
// Deterministic adapter-contract checks only; these fixtures do not prove production durability.
function deliveryFixture() {
  const initial = empty()
  initial.notices = [{ kind: "approved", to: ["requester"], record: "PR-2026-0010", at }]
  const storage = testPersistence({ procurement: initial })
  const clock = { milliseconds: Date.parse(at) }
  const accepted = new Map<string, string>()
  const transport: NoticeTransport = {
    now: () => new Date(clock.milliseconds),
    leaseMs: 1000,
    recipients: async () => ["directory-buyer"],
    send: async (message) => {
      accepted.set(message.key, message.link)
      return { receipt: message.key }
    },
  }
  return { storage, clock, accepted, transport }
}

test("claims commit before external lookup/send and concurrent workers cannot send the same active claim", async () => {
  const f = deliveryFixture()
  const entered = Promise.withResolvers<void>()
  const resume = Promise.withResolvers<void>()
  f.transport.recipients = async () => {
    expect(Object.keys(f.storage.state.procurement.data.noticeClaims as object)).toHaveLength(1)
    // This transaction would deadlock if lookup still held the fixture's transaction lock.
    await f.storage.persistence.transaction("procurement", async () => ({
      commit: false,
      value: undefined,
    }))
    entered.resolve()
    await resume.promise
    return ["directory-buyer"]
  }
  const first = deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")
  await entered.promise
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 0,
    waiting: 1,
  })
  resume.resolve()
  expect(await first).toEqual({ delivered: 1, waiting: 0 })
  expect(f.accepted.size).toBe(1)
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 0,
    waiting: 0,
  })
})

test("failed external delivery releases claim and retries", async () => {
  const f = deliveryFixture()
  const send = f.transport.send
  f.transport.send = async () => {
    throw new Error("Transport failure")
  }
  await expect(deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).rejects.toThrow(
    "Transport failure",
  )
  expect(f.storage.state.procurement.data.noticeClaims).toEqual({})
  f.transport.send = send
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 1,
    waiting: 0,
  })
})

test("failed acknowledgement retries with stable dedup key after lease expiry", async () => {
  const f = deliveryFixture()
  const send = f.transport.send
  f.transport.send = async (message) => {
    const result = await send(message)
    f.storage.fail.beforeCommit = true
    return result
  }
  await expect(deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).rejects.toThrow()
  expect(f.accepted.size).toBe(1)
  expect(f.storage.state.procurement.data.noticeDelivery).toBeUndefined()
  f.storage.fail.beforeCommit = false
  f.transport.send = send
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 0,
    waiting: 1,
  })
  f.clock.milliseconds += 1000
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 1,
    waiting: 0,
  })
  expect(f.accepted.size).toBe(1)
})

test("no recipients waits without inventing groups or identities; invalid lease fails before delivery", async () => {
  const f = deliveryFixture()
  f.storage.state.procurement.notices[0].to = []
  f.transport.recipients = async () => []
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 0,
    waiting: 1,
  })
  expect(f.accepted.size).toBe(0)
  expect(f.storage.state.procurement.data.noticeClaims).toEqual({})
  f.transport.leaseMs = 0
  await expect(deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).rejects.toThrow()
})

test("backup retention has a 35-day minimum for dashboard and procurement; Planner retains fourteen days", async () => {
  const storage = testPersistence()
  const saved: { surface: string; at: string }[] = []
  const pruned: { surface: string; at: string }[] = []
  const transport = {
    save: async (surface: "dashboard" | "planner" | "procurement", snapshot: unknown, time: string) => {
      saved.push({ surface, at: time })
      return {
        id: `${surface}-backup`,
        manifest: {
          version: 1 as const,
          surface,
          at: time,
          snapshotSha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
          blobs: [],
          integrity: "verified" as const,
          private: true as const,
        },
      }
    },
    prune: async (surface: "dashboard" | "planner" | "procurement", time: string) => {
      pruned.push({ surface, at: time })
    },
  }
  for (const surface of ["dashboard", "planner", "procurement"] as const)
    await backup(storage.persistence, transport, surface, { at })
  expect(saved).toHaveLength(3)
  expect(pruned).toEqual([
    { surface: "dashboard", at: "2026-10-07T12:00:00.000Z" },
    { surface: "planner", at: "2026-10-28T12:00:00.000Z" },
    { surface: "procurement", at: "2026-10-07T12:00:00.000Z" },
  ])
})

test("restore requires current admin confirmation, keeps counters monotone and does not replay notices", async () => {
  const current = empty()
  current.data.risks = [{ id: "r", name: "New" }]
  current.sequences.cpx = 19
  current.versions.dataset = { version: 4, by: "editor" }
  current.notices = [{ kind: "approved", to: ["member"], record: "r", at }]
  const storage = testPersistence({ dashboard: current })
  const old = empty()
  old.data.risks = [{ id: "r", name: "Restored" }]
  old.sequences.cpx = 3
  const source = restoreSource(old, "dashboard")
  const actor = { id: "admin", canWrite: true, roles: ["admin"] }
  expect(
    await restoreBackup(
      restorePersistence(storage.persistence),
      source,
      "dashboard",
      "backup",
      { ...actor, canWrite: false },
      true,
      4,
      at,
    ),
  ).toMatchObject({ ok: false, status: 403 })
  expect(
    await restoreBackup(restorePersistence(storage.persistence), source, "dashboard", "backup", actor, false, 4, at),
  ).toMatchObject({
    ok: false,
    status: 422,
  })
  expect(
    await restoreBackup(restorePersistence(storage.persistence), source, "dashboard", "backup", actor, true, 3, at),
  ).toMatchObject({
    ok: false,
    status: 409,
  })
  expect(
    await restoreBackup(restorePersistence(storage.persistence), source, "dashboard", "backup", actor, true, 4, at),
  ).toEqual({
    ok: true,
  })
  expect(storage.state.dashboard.data.risks).toEqual(old.data.risks)
  expect(storage.state.dashboard.sequences.cpx).toBe(19)
  expect(storage.state.dashboard.notices).toEqual(current.notices)
})

test("invalid backup manifest never permits prune", async () => {
  const f = deliveryFixture()
  const pruned: string[] = []
  const transport = {
    save: async () => ({
      id: "b",
      manifest: {
        version: 1 as const,
        surface: "dashboard" as const,
        at,
        snapshotSha256: "0".repeat(64),
        blobs: [],
        integrity: "verified" as const,
        private: true as const,
      },
    }),
    prune: async () => {
      pruned.push("pruned")
    },
  }
  await expect(backup(f.storage.persistence, transport, "dashboard", { at })).rejects.toThrow()
  expect(pruned).toEqual([])
})

test("procurement restore unions issued numbers, preserves delivery and active claims, never replays old notices", async () => {
  const current = empty()
  current.data = {
    store: { issued: { pr: ["PR-2"], po: ["PO-2"] }, sup: ["SUP-2"] },
    noticeDelivery: { sent: "receipt" },
    noticeSchedule: { daily: at },
    noticeClaims: { pending: { token: "live", expires: 123 } },
  }
  current.sequences = { pr: 9, po: 8, sup: 7 }
  const old = empty()
  old.data = {
    store: { issued: { pr: ["PR-1"], po: ["PO-1"] }, sup: ["SUP-1"] },
    noticeDelivery: { stale: "old" },
    noticeSchedule: { stale: "old" },
    noticeClaims: { stale: { token: "old", expires: 1 } },
  }
  old.sequences = { pr: 1, po: 2, sup: 3 }
  old.notices = [{ kind: "pending", to: ["old"], record: "old", at }]
  const storage = testPersistence({ procurement: current })
  expect(
    await restoreBackup(
      restorePersistence(storage.persistence),
      restoreSource(old, "procurement"),
      "procurement",
      "b",
      { id: "admin", canWrite: true, roles: ["admin"] },
      true,
      0,
      at,
    ),
  ).toEqual({ ok: true })
  expect(storage.state.procurement.sequences).toEqual(current.sequences)
  expect(storage.state.procurement.data.store).toEqual({
    issued: { pr: ["PR-2", "PR-1"], po: ["PO-2", "PO-1"] },
    sup: ["SUP-2", "SUP-1"],
  })
  expect(storage.state.procurement.data.noticeDelivery).toEqual(current.data.noticeDelivery)
  expect(storage.state.procurement.data.noticeClaims).toEqual(current.data.noticeClaims)
  expect(storage.state.procurement.data.noticeSchedule).toEqual(current.data.noticeSchedule)
  expect(storage.state.procurement.notices).toEqual([])
})

test("failed claim commit never calls external lookup or send", async () => {
  const f = deliveryFixture()
  const lookedUp: string[] = []
  f.transport.recipients = async () => {
    lookedUp.push("lookup")
    return []
  }
  f.storage.fail.beforeCommit = true
  await expect(deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).rejects.toThrow()
  expect(lookedUp).toEqual([])
  expect(f.accepted.size).toBe(0)
  expect(f.storage.state.procurement.data.noticeClaims).toBeUndefined()
})

test("stale sender cannot acknowledge or release a replacement claim", async () => {
  const f = deliveryFixture()
  f.transport.send = async (message) => {
    await f.storage.persistence.transaction("procurement", async (snapshot) => {
      snapshot.data.noticeClaims = {
        [message.key]: { token: "replacement", expires: Date.parse(at) + 2000 },
      }
      return { commit: true, value: undefined }
    })
    return { receipt: "stale-receipt" }
  }
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 0,
    waiting: 1,
  })
  expect(f.storage.state.procurement.data.noticeDelivery).toBeUndefined()
  expect(Object.values(f.storage.state.procurement.data.noticeClaims as object)).toEqual([
    { token: "replacement", expires: Date.parse(at) + 2000 },
  ])
})

test("backup rejects missing blob manifest entries before prune", async () => {
  const storage = testPersistence()
  storage.state.dashboard.data.assets = [{ key: "contracts/c/a", bytes: 3 }]
  const pruned: string[] = []
  await expect(
    backup(
      storage.persistence,
      {
        save: async (surface, snapshot, time) => ({
          id: "b",
          manifest: {
            version: 1,
            surface,
            at: time,
            snapshotSha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
            blobs: [],
            integrity: "verified",
            private: true,
          },
        }),
        prune: async () => {
          pruned.push("prune")
        },
      },
      "dashboard",
      { at },
    ),
  ).rejects.toThrow("Invalid durable backup manifest")
  expect(pruned).toEqual([])
})

function approvalFixture() {
  const initial = empty()
  initial.data.store = {
    settings: {
      reminderDays: null,
      escalationDays: null,
      levels: [{ holderId: "NEVER-USE" }],
    },
    requests: {
      "PR-1": {
        request: {
          status: "pr_pending",
          prApproval: {
            steps: [
              { levelId: "done", holderId: "past", status: "approved" },
              { levelId: "L1", holderId: "copied-current", status: "pending" },
              { levelId: "L2", holderId: "copied-next", status: "pending" },
            ],
          },
          history: [
            {
              action: "Requisition submitted for approval",
              at: "2026-11-01T12:00:00Z",
            },
            {
              action: "Requisition submitted for approval",
              at: "2026-11-09T12:00:00Z",
            },
          ],
        },
      },
    },
  }
  return testPersistence({ procurement: initial })
}

test("null reminder/escalation settings do not change any state or audit", async () => {
  const f = approvalFixture()
  const before = structuredClone(f.state.procurement)
  expect(await queueApprovalReminders(f.persistence, { at }, "2026-11-11")).toEqual({ queued: 0 })
  expect(f.state.procurement).toEqual(before)
})

test("configured age thresholds use latest submission and copied holders, deduplicated by installation day", async () => {
  const f = approvalFixture()
  const store = f.state.procurement.data.store as {
    settings: { reminderDays: number | null; escalationDays: number | null }
  }
  store.settings.reminderDays = 2
  store.settings.escalationDays = 3
  expect(await queueApprovalReminders(f.persistence, { at }, "2026-11-11")).toEqual({ queued: 1 })
  expect(
    f.state.procurement.notices.map((notice) => ({
      ...notice,
      reason: (notice as typeof notice & { reason?: string }).reason,
    })),
  ).toEqual([
    {
      kind: "pending",
      reason: "reminder",
      to: ["copied-current"],
      record: "PR-1",
      at,
    },
  ])
  expect(await queueApprovalReminders(f.persistence, { at }, "2026-11-11")).toEqual({ queued: 0 })
  const later = "2026-11-12T12:00:00Z"
  expect(await queueApprovalReminders(f.persistence, { at: later }, "2026-11-12")).toEqual({ queued: 2 })
  expect(
    f.state.procurement.notices.slice(1).map((notice) => ({
      ...notice,
      reason: (notice as typeof notice & { reason?: string }).reason,
    })),
  ).toEqual([
    {
      kind: "pending",
      reason: "reminder",
      to: ["copied-current"],
      record: "PR-1",
      at: later,
    },
    {
      kind: "pending",
      reason: "escalation",
      to: ["copied-next"],
      record: "PR-1",
      at: later,
    },
  ])
  expect(f.state.procurement.audit).toEqual([])
})

test("all pending stages use matching history, no missing holder or next-level fallback", async () => {
  for (const [status, action, field] of [
    ["pr_pending", "Requisition submitted for approval", "prApproval"],
    ["src_pending", "Sourcing submitted for approval", "sourcing"],
    ["po_pending", "Purchase order submitted for approval", "po"],
  ]) {
    const initial = empty()
    const approval = { steps: [{ holderId: "copied", status: "pending" }] }
    const request = {
      status,
      [field]: field === "prApproval" ? approval : { approval },
      history: [{ action, at: "2026-11-01T12:00:00Z" }],
    }
    initial.data.store = {
      settings: { reminderDays: 1, escalationDays: 1 },
      requests: { r: { request } },
    }
    const f = testPersistence({ procurement: initial })
    expect(await queueApprovalReminders(f.persistence, { at }, "2026-11-11")).toEqual({ queued: 1 })
    expect(f.state.procurement.notices[0].to).toEqual(["copied"])
    expect(f.state.procurement.data.store as typeof initial.data.store).toEqual(initial.data.store)
    const missing = structuredClone(initial)
    approval.steps[0].holderId = ""
    missing.data.store = {
      settings: { reminderDays: 1, escalationDays: 1 },
      requests: { r: { request } },
    }
    const emptyHolder = testPersistence({ procurement: missing })
    const before = structuredClone(emptyHolder.state.procurement)
    expect(await queueApprovalReminders(emptyHolder.persistence, { at }, "2026-11-11")).toEqual({ queued: 0 })
    expect(emptyHolder.state.procurement).toEqual(before)
  }
})

test("concurrent reminder queue calls commit one daily notice; invalid or unmatched submission queues none", async () => {
  const f = approvalFixture()
  const store = f.state.procurement.data.store as {
    settings: { reminderDays: number | null }
    requests: Record<string, { request: { history: { action: string; at: string }[] } }>
  }
  store.settings.reminderDays = 1
  expect(
    await Promise.all([
      queueApprovalReminders(f.persistence, { at }, "2026-11-11"),
      queueApprovalReminders(f.persistence, { at }, "2026-11-11"),
    ]),
  ).toEqual([{ queued: 1 }, { queued: 0 }])
  const current = f.state.procurement.data.store as typeof store
  current.requests["PR-1"].request.history = [{ action: "Unrelated", at: "2026-11-01T00:00:00Z" }]
  expect(await queueApprovalReminders(f.persistence, { at }, "2026-11-12")).toEqual({ queued: 0 })
})

test("queued reason reaches delivery transport without external role lookup for pending notices", async () => {
  const f = approvalFixture()
  const store = f.state.procurement.data.store as {
    settings: { reminderDays: number | null; escalationDays: number | null }
  }
  store.settings.reminderDays = 1
  store.settings.escalationDays = 1
  await queueApprovalReminders(f.persistence, { at }, "2026-11-11")
  const messages: { reason?: "reminder" | "escalation"; to: string[] }[] = []
  expect(
    await deliverNotices(
      f.persistence,
      {
        now: () => new Date(at),
        leaseMs: 1000,
        recipients: async () => {
          throw new Error("Pending notice must use copied holder")
        },
        send: async (message) => {
          messages.push({ reason: message.reason, to: message.to })
          return { receipt: message.key }
        },
      },
      "procurement",
      "/sucafina",
    ),
  ).toEqual({ delivered: 2, waiting: 0 })
  expect(messages).toEqual([
    { reason: "reminder", to: ["copied-current"] },
    { reason: "escalation", to: ["copied-next"] },
  ])
})

function restoreSource(
  snapshot: import("../runtime/contract.ts").Snapshot,
  surface: "dashboard" | "planner" | "procurement",
  files = new Map<string, Uint8Array>(),
): RestoreTransport {
  const manifest: BackupManifest = {
    version: 1,
    surface,
    at,
    private: true,
    integrity: "verified",
    snapshotSha256: createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
    blobs: [...files].map(([key, bytes]) => ({
      key,
      bytes: bytes.byteLength,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    })),
  }
  return {
    load: async () => ({ snapshot: structuredClone(snapshot), manifest: structuredClone(manifest) }),
    readBlob: async (surface, id, key) => files.get(key),
  }
}

// Only models the private atomic adapter contract; no production storage durability is implied.
function restorePersistence(
  persistence: import("../runtime/contract.ts").Persistence,
  files = new Map<string, Uint8Array>(),
) {
  return {
    async transaction<T>(
      surface: "dashboard" | "planner" | "procurement",
      work: (
        snapshot: import("../runtime/contract.ts").Snapshot,
        blobs: import("../runtime/assets.ts").BlobTransaction,
      ) => Promise<{ commit: boolean; value: T }>,
    ) {
      const staged = new Map(files)
      const committed = { value: false }
      const result = await persistence.transaction(surface, async (snapshot) => {
        const result = await work(snapshot, {
          put: async (key, bytes) => {
            staged.set(key, new Uint8Array(bytes))
          },
          get: async (key) => staged.get(key),
          remove: async (key) => {
            staged.delete(key)
          },
        })
        committed.value = result.commit
        return result
      })
      if (committed.value) {
        files.clear()
        for (const [key, bytes] of staged) files.set(key, bytes)
      }
      return result
    },
  }
}

test("persisted notice property order does not change delivery identity or retry key", async () => {
  const f = deliveryFixture()
  const send = f.transport.send
  f.transport.send = async (message) => {
    const receipt = await send(message)
    f.storage.fail.beforeCommit = true
    return receipt
  }
  await expect(deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).rejects.toThrow()
  f.storage.fail.beforeCommit = false
  const notice = f.storage.state.procurement.notices[0]
  f.storage.state.procurement.notices = [{ at: notice.at, record: notice.record, to: notice.to, kind: notice.kind }]
  f.clock.milliseconds += 1000
  f.transport.send = send
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 1,
    waiting: 0,
  })
  expect(f.accepted.size).toBe(1)
  f.storage.state.procurement.notices = [{ record: notice.record, kind: notice.kind, at: notice.at, to: notice.to }]
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 0,
    waiting: 0,
  })
})

test("restore verifies manifest and snapshot SHA before changing durable state", async () => {
  for (const corrupt of ["snapshot", "surface", "blobs"] as const) {
    const storage = testPersistence()
    const old = empty()
    old.data.assets = [{ key: "private/a", bytes: 3 }]
    const source = restoreSource(old, "dashboard", new Map([["private/a", new Uint8Array([1, 2, 3])]]))
    const load = source.load
    source.load = async (surface, id) => {
      const archive = await load(surface, id)
      if (!archive) throw new Error("Missing fixture archive")
      if (corrupt === "snapshot") archive.snapshot.data.changed = true
      if (corrupt === "surface") archive.manifest.surface = "planner"
      if (corrupt === "blobs") archive.manifest.blobs = []
      return archive
    }
    const before = structuredClone(storage.state.dashboard)
    await expect(
      restoreBackup(
        restorePersistence(storage.persistence),
        source,
        "dashboard",
        "b",
        { id: "admin", canWrite: true, roles: ["admin"] },
        true,
        0,
        at,
      ),
    ).rejects.toThrow()
    expect(storage.state.dashboard).toEqual(before)
  }
})

test("restore rejects missing or corrupt private bytes and atomically rolls back on commit failure", async () => {
  for (const failure of ["missing", "corrupt", "commit", "none"] as const) {
    const storage = testPersistence()
    const old = empty()
    old.data.assets = [
      { key: "private/a", bytes: 3 },
      { key: "private/b", bytes: 3 },
    ]
    const original = new Uint8Array([1, 2, 3])
    const source = restoreSource(
      old,
      "dashboard",
      new Map([
        ["private/a", original],
        ["private/b", original],
      ]),
    )
    if (failure === "missing")
      source.readBlob = async (surface, id, key) => (key === "private/a" ? original : undefined)
    if (failure === "corrupt")
      source.readBlob = async (surface, id, key) => (key === "private/a" ? original : new Uint8Array([3, 2, 1]))
    storage.fail.beforeCommit = failure === "commit"
    const files = new Map<string, Uint8Array>()
    const before = structuredClone(storage.state.dashboard)
    const result = restoreBackup(
      restorePersistence(storage.persistence, files),
      source,
      "dashboard",
      "b",
      { id: "admin", canWrite: true, roles: ["admin"] },
      true,
      0,
      at,
    )
    if (failure !== "none") {
      await expect(result).rejects.toThrow()
      expect(storage.state.dashboard).toEqual(before)
      expect(files.size).toBe(0)
      continue
    }
    expect(await result).toEqual({ ok: true })
    expect(files.get("private/a")).toEqual(original)
    expect(files.get("private/b")).toEqual(original)
    expect(storage.state.dashboard.data.assets).toEqual(old.data.assets)
  }
})

test("notice identity canonicalizes symbolic roles and recipient sets without collapsing distinct roles", async () => {
  const f = deliveryFixture()
  const initial = {
    kind: "approved" as const,
    to: ["b", "a", "a"],
    roles: ["supplier admin", "buyer", "buyer"],
    record: "PR-1",
    at,
  }
  f.storage.state.procurement.notices = [initial]
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 1,
    waiting: 0,
  })
  const reordered = {
    at,
    roles: ["buyer", "supplier admin"],
    record: "PR-1",
    to: ["a", "b"],
    kind: "approved" as const,
  }
  f.storage.state.procurement.notices = [reordered]
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 0,
    waiting: 0,
  })
  const different = { ...reordered, roles: ["buyer"] }
  f.storage.state.procurement.notices = [different]
  expect(await deliverNotices(f.storage.persistence, f.transport, "procurement", "/sucafina")).toEqual({
    delivered: 1,
    waiting: 0,
  })
  expect(f.accepted.size).toBe(2)
})

test("authorized restore conflict returns isolated current data and writer without reading private blobs", async () => {
  const current = empty()
  current.data = { risks: [{ id: "r", name: "Current" }] }
  current.versions.dataset = { version: 7, by: "editor" }
  const storage = testPersistence({ dashboard: current })
  const old = empty()
  const source = restoreSource(old, "dashboard")
  source.readBlob = async () => {
    throw new Error("Conflict must not read blobs")
  }
  const result = await restoreBackup(
    restorePersistence(storage.persistence),
    source,
    "dashboard",
    "b",
    { id: "admin", canWrite: true, roles: ["admin"] },
    true,
    6,
    at,
  )
  expect(result).toEqual({ ok: false, status: 409, by: "editor", stored: current.data })
  if (!result.ok && "stored" in result) expect(result.stored).not.toBe(storage.state.dashboard.data)
  expect(storage.state.dashboard).toEqual(current)
})

test("extra manifest key cannot overwrite an unrelated live private object", async () => {
  const storage = testPersistence()
  const old = empty()
  old.data.assets = [{ key: "private/declared", bytes: 3 }]
  const original = new Uint8Array([1, 2, 3])
  const source = restoreSource(
    old,
    "dashboard",
    new Map([
      ["private/declared", original],
      ["private/unrelated", original],
    ]),
  )
  const files = new Map([["private/unrelated", new Uint8Array([9])]])
  const before = structuredClone(storage.state.dashboard)
  const reads: string[] = []
  source.readBlob = async (surface, id, key) => {
    reads.push(key)
    return original
  }
  await expect(
    restoreBackup(
      restorePersistence(storage.persistence, files),
      source,
      "dashboard",
      "b",
      { id: "admin", canWrite: true, roles: ["admin"] },
      true,
      0,
      at,
    ),
  ).rejects.toThrow("Invalid durable backup manifest")
  expect(reads).toEqual([])
  expect(storage.state.dashboard).toEqual(before)
  expect([...files]).toEqual([["private/unrelated", new Uint8Array([9])]])
})
