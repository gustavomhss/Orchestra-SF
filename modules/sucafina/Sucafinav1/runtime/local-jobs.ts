import { createLocalBackups } from "./local-backups.ts"
import { deliverNotices, queueApprovalReminders } from "./operations.ts"
import { object, rows, text } from "./contract.ts"
import type { Snapshot } from "./contract.ts"
import type { LocalStore } from "./local-contract.ts"
import type { Surface } from "../src/identity.ts"

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
}) {
  if (!/^\/[A-Za-z0-9_-]+$/.test(options.mount)) throw new Error("Invalid maintenance mount")
  if (options.intervalMs !== undefined && (!Number.isSafeInteger(options.intervalMs) || options.intervalMs < 1000)) throw new Error("Invalid maintenance interval")
  const backups = await createLocalBackups(options.backupDirectory)
  const now = options.now ?? (() => new Date())
  const surfaces: readonly Surface[] = ["dashboard", "planner", "procurement"]
  const controller = new AbortController()
  const lifecycle: { closed: boolean; active?: Promise<LocalJobStatus> } = { closed: false }
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
    const activeSurface: { value?: Surface } = {}
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
        const archives = await backups.list(surface, { signal })
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
        const daily =
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
        const currentArchives = await backups.list(surface, { signal })
        const monthly =
          (progress.monthlyMonth === month
            ? currentArchives.find((archive) => archive.id === progress.monthlyId && archive.tier === "monthly")
            : undefined) ??
          currentArchives.find((archive) => archive.tier === "monthly" && archive.at.slice(0, 7) === month) ??
          (await backups.capture(options.store, surface, at, "monthly", { signal }))
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
      }
      activeSurface.value = undefined
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
      const active = run()
      lifecycle.active = active
      const release = () => { if (lifecycle.active === active) lifecycle.active = undefined }
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
      if (timer) clearInterval(timer)
      controller.abort(new Error("Local maintenance is closing"))
      await lifecycle.active
    },
  }
  const timer = options.schedule === false ? undefined : setInterval(() => { void api.runOnce().catch(() => undefined) }, options.intervalMs ?? 60000)
  timer?.unref()
  if (options.schedule !== false) void api.runOnce().catch(() => undefined)
  return api
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
