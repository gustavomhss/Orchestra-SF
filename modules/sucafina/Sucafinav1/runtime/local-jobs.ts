import { createLocalBackups } from "./local-backups.ts"
import { deliverNotices, queueApprovalReminders } from "./operations.ts"
import { object, rows, text } from "./contract.ts"
import type { Snapshot } from "./contract.ts"
import type { LocalStore } from "./local-contract.ts"
import type { Surface } from "../src/identity.ts"

type BackupArchive = { id: string; at: string; assets: number; bytes: number; tier: "daily" | "monthly" }
type MaintenanceBackups = Pick<Awaited<ReturnType<typeof createLocalBackups>>, "capture" | "list" | "verify">
type MaintenanceScheduler = { schedule: (delayMs: number, task: () => void) => () => void }

export type LocalJobStatus = {
  running: boolean
  lastRun: string | null
  lastSuccess: string | null
  error: string | null
  backups: Partial<Record<Surface, string>>
  monthly: Partial<Record<Surface, string>>
  drills: Partial<Record<Surface, { at: string; durationMs: number }>>
  partialSurface: Partial<Record<Surface, string>>
  recoveryDrill?: { at: string; durationMs: number }
  archiveInspection?: { surface: Surface; id: string; at: string; durationMs: number }
  notifications: "in-app" | "queued-transport-not-configured"
}
export type LocalInboxItem = {
  id: string
  surface: Surface
  kind: string
  record: string
  at: string
  reason?: string
  link: string
  read: boolean
}

/** Process-local scheduling; delivery claims, inbox receipts and backup progress survive process replacement. */
export async function createLocalJobs(options: {
  store: LocalStore
  backupDirectory: string
  mount: string
  operator?: { id: string; name: string }
  recoveryDrill?: (at: string, signal?: AbortSignal) => Promise<{ at: string; durationMs: number }>
  now?: () => Date
  intervalMs?: number
  schedule?: boolean
  /** Deterministic internal seams used by resilience tests; production leaves both absent. */
  backups?: MaintenanceBackups
  scheduler?: MaintenanceScheduler
}) {
  if (!/^\/[A-Za-z0-9_-]+$/.test(options.mount)) throw new Error("Invalid maintenance mount")
  const interval = options.intervalMs ?? 60_000
  if (!Number.isSafeInteger(interval) || interval < 1000) throw new Error("Invalid maintenance interval")
  const backups = options.backups ?? (await createLocalBackups(options.backupDirectory))
  const scheduler = options.scheduler ?? defaultScheduler
  const now = options.now ?? (() => new Date())
  const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
  const controller = new AbortController()
  const lifecycle: { closed: boolean; active?: Promise<LocalJobStatus> } = { closed: false }
  let cancelScheduled: (() => void) | undefined
  let scheduleNext = () => {}
  const state: LocalJobStatus = {
    running: false,
    lastRun: null,
    lastSuccess: null,
    error: null,
    backups: {},
    monthly: {},
    drills: {},
    partialSurface: {},
    notifications: options.operator ? "in-app" : "queued-transport-not-configured",
  }
  const run = async () => {
    const signal = controller.signal
    state.running = true
    state.error = null
    state.backups = {}
    state.monthly = {}
    state.drills = {}
    state.partialSurface = {}
    delete state.archiveInspection
    const activeSurface: { value?: Surface } = {}
    const inventories: Array<{ surface: Surface; archives: BackupArchive[] }> = []
    const verifiedThisCycle = new Set<string>()
    try {
      signal.throwIfAborted()
      const instant = now()
      if (!Number.isFinite(instant.getTime())) throw new Error("Invalid maintenance clock")
      const at = instant.toISOString()
      const day = at.slice(0, 10)
      const hour = at.slice(0, 13)
      const month = at.slice(0, 7)
      state.lastRun = at
      for (const surface of surfaces) {
        signal.throwIfAborted()
        activeSurface.value = surface
        const previous = await readLocalJobState(options.store, surface, signal)
        const archives = [...await backups.list(surface, { signal })]
        const previousId = typeof previous.backupId === "string" && previous.backupId ? previous.backupId : undefined
        const previousHour = typeof previous.backupHour === "string" && /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3])$/.test(previous.backupHour)
          ? previous.backupHour
          : undefined
        // A current-day persisted ID without a valid hour is legacy progress, not an
        // interrupted publication: updateLocalJobState writes ID/day/hour atomically.
        // Force one recapture to establish the hourly contract. When no ID was ever
        // persisted (or a prior valid hour exists), same-hour inventory remains the
        // crash-recovery path for publication that completed before progress persisted.
        const legacyDailyProgress = previous.backupDay === day && previousId !== undefined && previousHour === undefined
        let daily =
          (previous.backupDay === day && previousHour === hour
            ? archives.find((archive) => archive.id === previousId && archive.tier === "daily")
            : undefined) ??
          (legacyDailyProgress
            ? undefined
            : archives.find((archive) => archive.tier === "daily" && archive.at.slice(0, 10) === day && archive.at.slice(0, 13) === hour))
        if (daily) {
          state.backups[surface] = daily.id
          if (previous.backupDay !== day || previousHour !== hour || previousId !== daily.id)
            await updateLocalJobState(options.store, surface, { backupDay: day, backupHour: hour, backupId: daily.id, backupAt: daily.at }, signal)
        } else {
          const captured = await backups.capture(options.store, surface, at, "daily", { signal })
          daily = archiveSummary(captured.id, captured.manifest, "daily")
          archives.push(daily)
          verifiedThisCycle.add(archiveKey(surface, daily.id))
          await updateLocalJobState(options.store, surface, {
            backupDay: day,
            backupHour: hour,
            backupId: captured.id,
            backupAt: at,
          }, signal)
          state.backups[surface] = captured.id
        }

        signal.throwIfAborted()
        const progress = await readLocalJobState(options.store, surface, signal)
        let monthly =
          (progress.monthlyMonth === month
            ? archives.find((archive) => archive.id === progress.monthlyId && archive.tier === "monthly")
            : undefined) ??
          archives.find((archive) => archive.tier === "monthly" && archive.at.slice(0, 7) === month)
        if (!monthly) {
          const captured = await backups.capture(options.store, surface, at, "monthly", { signal })
          monthly = archiveSummary(captured.id, captured.manifest, "monthly")
          archives.push(monthly)
          verifiedThisCycle.add(archiveKey(surface, monthly.id))
        }
        const needsDrill =
          progress.monthlyMonth !== month ||
          progress.monthlyId !== monthly.id ||
          progress.drillMonth !== month ||
          typeof progress.drillAt !== "string" ||
          typeof progress.drillDurationMs !== "number" ||
          !Number.isFinite(progress.drillDurationMs)
        const drill = needsDrill
          ? await backups.verify(surface, monthly.id, at, { signal })
          : { at: text(progress.drillAt), durationMs: Number(progress.drillDurationMs) }
        if (needsDrill) {
          verifiedThisCycle.add(archiveKey(surface, monthly.id))
          await updateLocalJobState(options.store, surface, {
            monthlyMonth: month,
            monthlyId: monthly.id,
            drillMonth: month,
            drillAt: drill.at,
            drillDurationMs: drill.durationMs,
          }, signal)
        }
        state.monthly[surface] = monthly.id
        state.drills[surface] = drill
        state.partialSurface[surface] = `Monthly archive and restore drill completed for ${month}.`
        inventories.push({ surface, archives })
      }
      activeSurface.value = undefined
      signal.throwIfAborted()
      const inspection = await inspectNextArchive(options.store, backups, inventories, verifiedThisCycle, at, signal)
      if (inspection) state.archiveInspection = inspection
      signal.throwIfAborted()
      if (options.recoveryDrill) {
        const recoveryProgress = await Promise.all(
          surfaces.map((surface) => readLocalJobState(options.store, surface, signal)),
        )
        const priorRecovery = recoveryProgress[0]
        const sameRecovery =
          recoveryProgress.every(
            (progress) =>
              progress.recoveryDrillMonth === priorRecovery?.recoveryDrillMonth &&
              progress.recoveryDrillAt === priorRecovery?.recoveryDrillAt &&
              progress.recoveryDrillDurationMs === priorRecovery?.recoveryDrillDurationMs,
          ) &&
          typeof priorRecovery?.recoveryDrillMonth === "string" &&
          typeof priorRecovery.recoveryDrillAt === "string" &&
          typeof priorRecovery.recoveryDrillDurationMs === "number" &&
          Number.isFinite(priorRecovery.recoveryDrillDurationMs)
        if (sameRecovery) {
          state.recoveryDrill = {
            at: text(priorRecovery.recoveryDrillAt),
            durationMs: Number(priorRecovery.recoveryDrillDurationMs),
          }
        }
        if (!sameRecovery || priorRecovery.recoveryDrillMonth !== month) {
          const recovery = await options.recoveryDrill(at, signal)
          signal.throwIfAborted()
          if (!Number.isFinite(Date.parse(recovery.at)) || !Number.isFinite(recovery.durationMs) || recovery.durationMs < 0)
            throw new Error("Invalid recovery drill result")
          for (const surface of surfaces)
            await updateLocalJobState(options.store, surface, {
              recoveryDrillMonth: month,
              recoveryDrillAt: recovery.at,
              recoveryDrillDurationMs: recovery.durationMs,
            }, signal)
          state.recoveryDrill = recovery
        }
      }
      signal.throwIfAborted()
      await queueApprovalReminders(options.store, { at }, day)
      signal.throwIfAborted()
      if (options.operator) {
        const operator = options.operator
        const deliveryErrors: unknown[] = []
        for (const surface of surfaces) {
          signal.throwIfAborted()
          try {
            await deliverNotices(options.store, {
              now: () => { signal.throwIfAborted(); return now() },
              leaseMs: 60000,
              recipients: async () => [operator.id],
              send: async (message) => {
                signal.throwIfAborted()
                if (!message.to.length || message.to.some((id) => id !== operator.id)) throw new Error("Notification recipient is unavailable in this local profile")
                if (!message.link.startsWith(`${options.mount}/${surface}?`)) throw new Error("Invalid local notification link")
                return options.store.transaction(surface, async (snapshot) => {
                  const inbox = rows(snapshot.data.localInbox)
                  const existing = inbox.find((item) => item.key === message.key)
                  if (existing && (existing.kind !== message.kind || existing.record !== message.record || existing.link !== message.link || JSON.stringify(existing.to) !== JSON.stringify(message.to) || existing.reason !== message.reason)) throw new Error("Conflicting local notification receipt")
                  if (!existing) snapshot.data.localInbox = [...inbox, { key: message.key, to: [...message.to], kind: message.kind, record: message.record, reason: message.reason, link: message.link, at: now().toISOString(), readBy: [] }]
                  return { commit: !existing, value: { receipt: `in-app:${surface}:${message.key}` } }
                }, { signal })
              },
            }, surface, options.mount)
          } catch (error) { deliveryErrors.push(error) }
        }
        if (deliveryErrors.length) throw deliveryErrors[0]
      }
      signal.throwIfAborted()
      state.lastSuccess = at
    } catch (error) {
      if (!lifecycle.closed) {
        state.error = error instanceof Error ? error.message : "Local maintenance failed"
        if (activeSurface.value) state.partialSurface[activeSurface.value] = "Maintenance failed for this surface."
      }
    } finally {
      state.running = false
    }
    return structuredClone(state)
  }
  const api = {
    runOnce(): Promise<LocalJobStatus> {
      if (lifecycle.closed) return Promise.reject(new Error("Local maintenance is closed"))
      if (lifecycle.active) return lifecycle.active
      cancelScheduled?.()
      cancelScheduled = undefined
      const active = run()
      lifecycle.active = active
      const release = () => {
        if (lifecycle.active !== active) return
        lifecycle.active = undefined
        if (!lifecycle.closed && options.schedule !== false) scheduleNext()
      }
      void active.then(release, release)
      return active
    },
    status: (): LocalJobStatus => structuredClone(state),
    async inbox(actorId: string): Promise<LocalInboxItem[]> {
      if (!options.operator || actorId !== options.operator.id) return []
      const items = await Promise.all(surfaces.map((surface) => options.store.transaction(surface, async (snapshot) => ({
        commit: false,
        value: inboxEntries(snapshot, actorId, options.mount).map((item) => ({ id: `${surface}:${text(item.key)}`, surface, kind: text(item.kind), record: text(item.record), at: text(item.at), ...(typeof item.reason === "string" ? { reason: item.reason } : {}), link: text(item.link), read: Array.isArray(item.readBy) && item.readBy.includes(actorId) })),
      }))))
      return items.flat().sort((a, b) => b.at.localeCompare(a.at) || a.id.localeCompare(b.id))
    },
    async markRead(actorId: string, ids: readonly string[]): Promise<number> {
      if (!options.operator || actorId !== options.operator.id) return 0
      if (ids.length > 100 || ids.some((id) => !/^(dashboard|planner|procurement):[a-f0-9]{64}$/.test(id))) throw new Error("Invalid notification identifiers")
      const selected = new Set(ids)
      const counts = await Promise.all(surfaces.map((surface) => options.store.transaction(surface, async (snapshot) => {
        const count = { value: 0 }
        for (const item of inboxEntries(snapshot, actorId, options.mount)) {
          const readers = Array.isArray(item.readBy) ? item.readBy.filter((id): id is string => typeof id === "string") : []
          if (!selected.has(`${surface}:${text(item.key)}`) || readers.includes(actorId)) continue
          item.readBy = [...readers, actorId]
          count.value++
        }
        return { commit: count.value > 0, value: count.value }
      })))
      return counts.reduce((sum, count) => sum + count, 0)
    },
    async dispose() {
      lifecycle.closed = true
      cancelScheduled?.()
      cancelScheduled = undefined
      controller.abort(new Error("Local maintenance is closing"))
      await lifecycle.active
    },
  }
  scheduleNext = () => {
    if (lifecycle.closed || options.schedule === false || cancelScheduled) return
    cancelScheduled = scheduler.schedule(interval, () => {
      cancelScheduled = undefined
      void api.runOnce().catch(() => undefined)
    })
  }
  if (options.schedule !== false) void api.runOnce().catch(() => undefined)
  return api
}

const defaultScheduler: MaintenanceScheduler = {
  schedule(delayMs, task) {
    const timer = setTimeout(task, delayMs)
    timer.unref()
    return () => clearTimeout(timer)
  },
}

function archiveSummary(id: string, manifest: { at: string; blobs: readonly { bytes: number }[] }, tier: "daily" | "monthly"): BackupArchive {
  const bytes = manifest.blobs.reduce((sum, blob) => sum + blob.bytes, 0)
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error("Backup inventory byte count overflow")
  return { id, at: manifest.at, assets: manifest.blobs.length, bytes, tier }
}

function archiveKey(surface: Surface, id: string) {
  return `${surface}:${id}`
}

async function inspectNextArchive(
  store: LocalStore,
  backups: MaintenanceBackups,
  inventories: readonly { surface: Surface; archives: readonly BackupArchive[] }[],
  verifiedThisCycle: ReadonlySet<string>,
  at: string,
  signal: AbortSignal,
): Promise<LocalJobStatus["archiveInspection"]> {
  const progress = await readLocalJobState(store, "dashboard", signal)
  const cursor = typeof progress.archiveVerifyCursor === "string" ? progress.archiveVerifyCursor : ""
  const candidates = inventories
    .flatMap(({ surface, archives }) => archives.map((archive) => ({ surface, archive, key: archiveKey(surface, archive.id) })))
    .filter((candidate) => !verifiedThisCycle.has(candidate.key))
    .sort((left, right) => left.key.localeCompare(right.key))
  if (!candidates.length) return undefined
  const selected = candidates.find((candidate) => candidate.key > cursor) ?? candidates[0]
  if (!selected) return undefined
  const result = await backups.verify(selected.surface, selected.archive.id, at, { signal })
  signal.throwIfAborted()
  await updateLocalJobState(store, "dashboard", {
    archiveVerifyCursor: selected.key,
    archiveVerifyAt: result.at,
    archiveVerifyDurationMs: result.durationMs,
    archiveVerifyBudget: 1,
  }, signal)
  return { surface: selected.surface, id: selected.archive.id, at: result.at, durationMs: result.durationMs }
}

function inboxEntries(snapshot: Snapshot, actorId: string, mount: string) {
  return rows(snapshot.data.localInbox).filter((item) => typeof item.key === "string" && /^[a-f0-9]{64}$/.test(item.key) && Array.isArray(item.to) && item.to.includes(actorId) && typeof item.link === "string" && item.link.startsWith(`${mount}/`) && typeof item.at === "string" && Number.isFinite(Date.parse(item.at)))
}

function readLocalJobState(store: LocalStore, surface: Surface, signal?: AbortSignal) {
  return store.transaction(surface, async (snapshot) => ({
    commit: false,
    value: object(snapshot.data.localJobState),
  }), { signal })
}

function updateLocalJobState(store: LocalStore, surface: Surface, update: Record<string, unknown>, signal?: AbortSignal) {
  return store.transaction(surface, async (snapshot) => {
    snapshot.data.localJobState = { ...object(snapshot.data.localJobState), ...update }
    return { commit: true, value: undefined }
  }, { signal })
}
