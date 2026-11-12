import { createHash, randomUUID } from "node:crypto"
import type { Environment, Notice, Persistence, Result, Snapshot } from "./contract.ts"
import type { AssetPersistence } from "./assets.ts"
import type { Surface } from "../src/identity.ts"

type ScheduledNotice = Notice & { reason?: "reminder" | "escalation"; roles?: readonly string[] }

export type NoticeTransport = {
  now: () => Date
  leaseMs: number
  recipients: (surface: Surface, role: "buyer" | "supplier admin") => Promise<string[]>
  // Must durably deduplicate the key, including sends acknowledged externally but not in our database.
  send: (message: {
    key: string
    to: string[]
    kind: Notice["kind"]
    reason?: ScheduledNotice["reason"]
    link: string
    record: string
  }) => Promise<{ receipt: string }>
}

/** Existing job runner calls this. Persistence must serialize claim/ack transactions durably across workers.
 * A lease expiry may overlap a slow send: transport deduplication remains mandatory across different claims.
 */
export async function deliverNotices(
  persistence: Persistence,
  transport: NoticeTransport,
  surface: Surface,
  mount: string,
) {
  if (!Number.isFinite(transport.leaseMs) || transport.leaseMs <= 0)
    throw new Error("Positive notification lease required")
  const counts = { delivered: 0, waiting: 0 }
  const attempted = new Set<string>()
  const failures: unknown[] = []
  while (true) {
    const now = transport.now().getTime()
    if (!Number.isFinite(now) || !Number.isFinite(now + transport.leaseMs))
      throw new Error("Invalid notification clock")
    const token = randomUUID()
    const selected = await persistence.transaction(surface, async (snapshot) => {
      const delivered = objectMap(snapshot.data.noticeDelivery)
      const claims = record(snapshot.data.noticeClaims)
      const candidates = snapshot.notices.map((notice) => ({
        notice,
        key: noticeKey(surface, notice),
      }))
      const eligible = candidates.find(
        ({ key }) => !attempted.has(key) && !delivered[key] && !(Number(record(claims[key]).expires) > now),
      )
      if (!eligible) return { commit: false, value: undefined }
      snapshot.data.noticeClaims = {
        ...claims,
        [eligible.key]: { token, expires: now + transport.leaseMs },
      }
      return { commit: true, value: eligible }
    })
    if (!selected) {
      counts.waiting = await persistence.transaction(surface, async (snapshot) => ({
        commit: false,
        value: new Set(
          snapshot.notices
            .map((notice) => noticeKey(surface, notice))
            .filter((key) => !objectMap(snapshot.data.noticeDelivery)[key]),
        ).size,
      }))
      if (failures.length) throw failures[0]
      return counts
    }
    attempted.add(selected.key)
    const settle = (receipt?: string) =>
      persistence.transaction(surface, async (snapshot) => {
        const claims = record(snapshot.data.noticeClaims)
        if (record(claims[selected.key]).token !== token) return { commit: false, value: false }
        const remaining = { ...claims }
        delete remaining[selected.key]
        snapshot.data.noticeClaims = remaining
        if (receipt)
          snapshot.data.noticeDelivery = {
            ...objectMap(snapshot.data.noticeDelivery),
            [selected.key]: receipt,
          }
        return { commit: true, value: true }
      })
    try {
      const notice: ScheduledNotice = selected.notice
      const role =
        notice.kind === "supplier-pending"
          ? "supplier admin"
          : notice.kind === "approved" || notice.kind === "rejected"
            ? "buyer"
            : undefined
      const recipients = [
        ...new Set(
          [...notice.to, ...(role ? await transport.recipients(surface, role) : [])].filter(
            (id) => typeof id === "string" && id.length > 0,
          ),
        ),
      ]
      if (!recipients.length) {
        await settle()
        continue
      }
      const page = notice.kind === "supplier-pending" ? "Suppliers" : "Requests"
      const query = new URLSearchParams({
        page,
        [page === "Suppliers" ? "supplier" : "request"]: notice.record,
      })
      const result = await transport.send({
        key: selected.key,
        to: recipients,
        kind: notice.kind,
        reason: notice.reason,
        link: `${mount}/${surface}?${query}#${encodeURIComponent(page === "Suppliers" ? `supplier-${notice.record}` : notice.record)}`,
        record: notice.record,
      })
      if (typeof result.receipt !== "string" || !result.receipt.trim())
        throw new Error("Notification transport did not acknowledge delivery")
      if (await settle(result.receipt)) counts.delivered += 1
    } catch (error) {
      // Best effort release; a failed release leaves the durable lease to expire. Preserve the original failure.
      await settle().catch(() => undefined)
      // One unavailable recipient must not starve later independent notices.
      failures.push(error)
    }
  }
}

// Explicit fields and sorted sets survive JSON property order, recipient order and duplicate identities.
function noticeKey(surface: Surface, notice: ScheduledNotice) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        surface,
        notice.kind,
        [...new Set(notice.to)].sort(),
        [...new Set(notice.roles ?? [])].sort(),
        notice.record,
        notice.at,
        notice.reason ?? null,
      ]),
    )
    .digest("hex")
}

/** Enqueue only: the installation supplies its calendar day and invokes this from its existing job runner.
 * Threshold age is elapsed days since the latest submission of the currently pending stage.
 */
export async function queueApprovalReminders(
  persistence: Persistence,
  environment: Pick<Environment, "at">,
  day: string,
) {
  const now = Date.parse(environment.at)
  if (
    !Number.isFinite(now) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(day) ||
    !Number.isFinite(Date.parse(`${day}T00:00:00Z`)) ||
    new Date(`${day}T00:00:00Z`).toISOString().slice(0, 10) !== day
  )
    throw new Error("Valid reminder instant and installation calendar day required")
  return persistence.transaction("procurement", async (snapshot) => {
    const store = record(snapshot.data.store)
    const settings = record(store.settings)
    const thresholds = [
      { reason: "reminder" as const, days: settings.reminderDays },
      { reason: "escalation" as const, days: settings.escalationDays },
    ].filter(
      (item): item is { reason: "reminder" | "escalation"; days: number } =>
        typeof item.days === "number" && Number.isFinite(item.days) && item.days > 0,
    )
    if (!thresholds.length) return { commit: false, value: { queued: 0 } }
    const schedule = { ...record(snapshot.data.noticeSchedule) }
    const notices: ScheduledNotice[] = []
    for (const [id, row] of Object.entries(record(store.requests))) {
      const request = record(record(row).request)
      const status = request.status
      const stage =
        status === "pr_pending"
          ? {
              approval: request.prApproval,
              action: "Requisition submitted for approval",
            }
          : status === "src_pending"
            ? {
                approval: record(request.sourcing).approval,
                action: "Sourcing submitted for approval",
              }
            : status === "po_pending"
              ? {
                  approval: record(request.po).approval,
                  action: "Purchase order submitted for approval",
                }
              : undefined
      if (!stage) continue
      const steps = record(stage.approval).steps
      if (!Array.isArray(steps)) continue
      const pending = steps.findIndex((step) => record(step).status === "pending")
      if (pending < 0) continue
      const history = Array.isArray(request.history) ? request.history.map(record) : []
      const submitted = history
        .filter((entry) => entry.action === stage.action)
        .map((entry) => (typeof entry.at === "string" ? Date.parse(entry.at) : NaN))
        .filter(Number.isFinite)
        .sort((left, right) => right - left)[0]
      if (submitted === undefined || submitted > now) continue
      for (const threshold of thresholds) {
        if ((now - submitted) / (24 * 60 * 60 * 1000) < threshold.days) continue
        const step = record(steps[pending + (threshold.reason === "escalation" ? 1 : 0)])
        if (typeof step.holderId !== "string" || !step.holderId.trim()) continue
        const key = createHash("sha256")
          .update(JSON.stringify([day, id, status, submitted, pending, threshold.reason, step.holderId]))
          .digest("hex")
        if (schedule[key]) continue
        schedule[key] = environment.at
        notices.push({
          kind: "pending",
          reason: threshold.reason,
          to: [step.holderId],
          record: id,
          at: environment.at,
        })
      }
    }
    if (!notices.length) return { commit: false, value: { queued: 0 } }
    snapshot.data.noticeSchedule = schedule
    snapshot.notices.push(...notices)
    return { commit: true, value: { queued: notices.length } }
  })
}

export type BackupManifest = {
  version: 1
  surface: Surface
  at: string
  snapshotSha256: string
  blobs: readonly { key: string; bytes: number; sha256: string }[]
  integrity: "verified"
  private: true
}

export type BackupTransport = {
  // Resolve only after snapshot + complete blob manifest and referenced bytes are durable and consistent.
  // Verify digests against stored bytes; missing/corrupt blobs reject. Keep private backup blob versions pinned
  // independently of live deletion until backup retention expires. Restore must verify integrity before applying.
  // snapshotSha256 hashes UTF-8 JSON.stringify(snapshot); blob keys must exactly match snapshot.data.assets keys.
  save: (surface: Surface, snapshot: Snapshot, at: string) => Promise<{ id: string; manifest: BackupManifest }>
  prune: (surface: Surface, olderThan: string) => Promise<void>
}

export async function backup(
  persistence: Persistence,
  transport: BackupTransport,
  surface: Surface,
  environment: Pick<Environment, "at">,
) {
  if (!Number.isFinite(Date.parse(environment.at))) throw new Error("Invalid backup time")
  const result = await persistence.transaction(surface, async (snapshot) => {
    const copy = structuredClone(snapshot)
    const digest = createHash("sha256").update(JSON.stringify(copy)).digest("hex")
    const result = await transport.save(surface, copy, environment.at)
    if (typeof result.id !== "string" || !result.id.trim()) throw new Error("Invalid durable backup manifest")
    requireBackupManifest(copy, result.manifest, surface, environment.at, digest)
    return { commit: false, value: result }
  })
  await transport.prune(
      surface,
      new Date(new Date(environment.at).getTime() - (surface === "planner" ? 14 : 35) * 24 * 60 * 60 * 1000).toISOString(),
    )
  return result
}
function requireBackupManifest(
  snapshot: Snapshot,
  manifest: BackupManifest,
  surface: Surface,
  at: string,
  digest = createHash("sha256").update(JSON.stringify(snapshot)).digest("hex"),
) {
  const assets = Array.isArray(snapshot.data.assets) ? snapshot.data.assets.map(record) : []
  if (
    !manifest ||
    manifest.version !== 1 ||
    manifest.surface !== surface ||
    manifest.at !== at ||
    !Number.isFinite(Date.parse(manifest.at)) ||
    manifest.snapshotSha256 !== digest ||
    manifest.integrity !== "verified" ||
    manifest.private !== true ||
    !Array.isArray(manifest.blobs) ||
    manifest.blobs.some(
      (blob) =>
        !blob ||
        typeof blob.key !== "string" ||
        !blob.key ||
        !Number.isSafeInteger(blob.bytes) ||
        blob.bytes < 0 ||
        typeof blob.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(blob.sha256),
    ) ||
    new Set(manifest.blobs.map((blob) => blob.key)).size !== manifest.blobs.length ||
    manifest.blobs.some((blob) => !assets.some((asset) => asset.key === blob.key)) ||
    assets.some((asset) => !manifest.blobs.some((blob) => blob.key === asset.key && blob.bytes === asset.bytes))
  )
    throw new Error("Invalid durable backup manifest")
}

export type RestoreTransport = {
  // Load an immutable archive; preserve the snapshot JSON representation used for snapshotSha256.
  load: (surface: Surface, id: string) => Promise<{ snapshot: Snapshot; manifest: BackupManifest } | undefined>
  // Return PRIVATE bytes from this retained archive, never a live/public object fallback.
  readBlob: (surface: Surface, id: string, key: string) => Promise<Uint8Array | undefined>
}

function objectMap(value: unknown): Record<string, string> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? Object.fromEntries(
        Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
      )
    : {}
}

/** The same authoritative adapter used by HTTP/jobs must atomically commit private blob puts and snapshot state.
 * No bytes or metadata become visible on rejection/cancellation/commit failure; callbacks must never be replayed.
 * Archive reads below are verified before staging, and successful resolution means durable private restoration.
 */
export async function restoreBackup(
  persistence: AssetPersistence,
  source: RestoreTransport,
  surface: Surface,
  id: string,
  actor: { id: string; canWrite: boolean; roles: string[] },
  confirmed: boolean,
  expectedVersion: number,
  at: string,
) {
  if (!actor.canWrite || !actor.roles.includes("admin")) return { ok: false as const, status: 403 }
  if (!confirmed) return { ok: false as const, status: 422 }
  const archive = await source.load(surface, id)
  if (!archive) return { ok: false as const, status: 404 }
  const recovered = structuredClone(archive.snapshot)
  const manifest = structuredClone(archive.manifest)
  requireBackupManifest(recovered, manifest, surface, manifest?.at)
  return persistence.transaction<Result>(surface, async (snapshot, blobs) => {
    if ((snapshot.versions.dataset?.version ?? 0) !== expectedVersion)
      return {
        commit: false,
        value: {
          ok: false as const,
          status: 409,
          stored: structuredClone(snapshot.data),
          by: snapshot.versions.dataset?.by,
        },
      }
    // Verify every retained blob's actual size and SHA; the adapter keeps all puts private until commit.
    for (const blob of manifest.blobs) {
      const bytes = await source.readBlob(surface, id, blob.key)
      if (!bytes || bytes.byteLength !== blob.bytes || createHash("sha256").update(bytes).digest("hex") !== blob.sha256)
        throw new Error("Missing or corrupt private backup blob")
      await blobs.put(blob.key, bytes, "application/octet-stream")
    }
    const previous = structuredClone(snapshot.data)
    const delivery = snapshot.data.noticeDelivery
    const claims = snapshot.data.noticeClaims
    const schedule = snapshot.data.noticeSchedule
    const inbox = snapshot.data.localInbox
    const jobState = snapshot.data.localJobState
    const currentStore = record(snapshot.data.store)
    snapshot.data = structuredClone(recovered.data)
    delete snapshot.data.noticeDelivery
    delete snapshot.data.noticeClaims
    delete snapshot.data.noticeSchedule
    delete snapshot.data.localInbox
    delete snapshot.data.localJobState
    if (inbox !== undefined) snapshot.data.localInbox = inbox
    if (jobState !== undefined) snapshot.data.localJobState = jobState
    if (schedule !== undefined) snapshot.data.noticeSchedule = schedule
    if (delivery !== undefined) snapshot.data.noticeDelivery = delivery
    if (claims !== undefined) snapshot.data.noticeClaims = claims
    if (surface === "procurement") {
      const restoredStore = record(snapshot.data.store)
      const retained = record(currentStore.issued)
      const imported = record(restoredStore.issued)
      restoredStore.issued = {
        pr: uniqueStrings(retained.pr, imported.pr),
        po: uniqueStrings(retained.po, imported.po),
      }
      restoredStore.sup = uniqueStrings(currentStore.sup, restoredStore.sup)
      snapshot.data.store = restoredStore
    }
    const sequences = new Set([...Object.keys(snapshot.sequences), ...Object.keys(recovered.sequences)])
    // Restoring old data cannot roll back number high-water marks.
    snapshot.sequences = Object.fromEntries(
      [...sequences].map((key) => [key, Math.max(snapshot.sequences[key] ?? 0, recovered.sequences[key] ?? 0)]),
    )
    const keys = new Set([...Object.keys(snapshot.versions), ...Object.keys(recovered.versions)])
    snapshot.versions = Object.fromEntries(
      [...keys].map((key) => [
        key,
        {
          version: Math.max(snapshot.versions[key]?.version ?? 0, recovered.versions[key]?.version ?? 0) + 1,
          by: actor.id,
        },
      ]),
    )
    snapshot.versions.dataset = { version: expectedVersion + 1, by: actor.id }
    snapshot.audit.push({
      who: actor.id,
      at,
      record: "dataset",
      was: previous,
      became: structuredClone(snapshot.data),
    })
    // Existing delivery history and pending notices are not replayed by restoring an older dataset.
    return { commit: true, value: { ok: true as const } }
  })
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {}
}
function uniqueStrings(left: unknown, right: unknown) {
  return [
    ...new Set(
      [...(Array.isArray(left) ? left : []), ...(Array.isArray(right) ? right : [])].filter(
        (value): value is string => typeof value === "string",
      ),
    ),
  ]
}
