import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { RoutineResult } from "../contracts/context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { RoutineResultAccess } from "./result-access.ts"

type SchedulePorts = BusinessPorts["schedules"]
export type RoutineScheduleBinding = {
  scheduleRef: string
  version: number
  principalRef: string
  projectId: string
  conditionRef: string
  recipeRef: string
  state: "active" | "paused" | "needs-review"
}
export type RoutineOccurrence = {
  scheduleRef: string
  occurrenceRef: string
  state: "scheduled" | "missed" | "needs-review" | "running" | "ready" | "blocked" | "failed" | "cancelled" | "unchanged"
  principalRef: string
  projectId: string
  /** The underlying C07 receipt is present only after its own governed admission. */
  routine?: RoutineResult
  pendingRefs: readonly string[]
}
/** Supplied by the host only when native occurrences can reauthenticate their recorded SF owner. */
export type RoutineOccurrencePort = {
  qualify: (request: Parameters<SchedulePorts["create"]>[0], context: TrustedDomainContext) => Promise<PortResult<{ principalRef: string; projectId: string; recipeRef: string; conditionRef: string }>>
  read: (scheduleRef: string, context: TrustedDomainContext) => Promise<PortResult<RoutineScheduleBinding>>
  resume: (request: { scheduleRef: string; expectedVersion: number }, context: TrustedDomainContext) => Promise<PortResult<{ scheduleRef: string; version: number; state: "active" }>>
  runDue: (scheduleRef: string, context: TrustedDomainContext) => Promise<PortResult<RoutineOccurrence>>
  runNow: (request: { scheduleRef: string; expectedVersion: number; idempotencyKey: string }, context: TrustedDomainContext) => Promise<PortResult<RoutineOccurrence>>
}
/** Host authority boundary; occurrence storage is intentionally not emulated here. */
export type ScheduleHost = {
  owner: (context: TrustedDomainContext) => Promise<{ principalRef: string; projectId: string } | undefined>
  revalidate: (context: TrustedDomainContext, scheduleRefs: readonly string[]) => Promise<boolean>
  validateRecurrence: (recurrence: string, timezone: string) => boolean
  authorize: (context: TrustedDomainContext, action: "schedules.create" | "schedules.update" | "schedules.pause" | "schedules.resume" | "schedules.run", payload: unknown) => Promise<boolean>
  occurrences?: RoutineOccurrencePort
  /** A reference or occurrence state does not prove terminal execution or authorize output. */
  resultAccess?: RoutineResultAccess
}

/** Safe internal recurrence operations. This module never sends externally or approves a workflow. */
export function createRoutineSchedule(source: ScheduleHost, providers: SchedulePorts) {
  return {
    async create(incoming: Parameters<SchedulePorts["create"]>[0], context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host, schedules) => {
        const request = structuredClone(incoming)
        if (context.kind !== "ui" || !await host.authorize(context, "schedules.create", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        if (!await requireOwner(host, context) || !validTimezone(request.timezone) || !host.validateRecurrence(request.recurrence, request.timezone) || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
        if (!host.occurrences) return { status: "unavailable", reason: "occurrence-owner-revalidation-unavailable" } as const
        const qualified = await host.occurrences.qualify(structuredClone(request), context)
        if (qualified.status !== "ok") return qualified
        if (!samePrincipal(qualified.value, context) || qualified.value.recipeRef !== request.recipeRef || qualified.value.conditionRef !== request.conditionRef || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-changed" } as const
        if (!await host.authorize(context, "schedules.create", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        const result = await schedules.create(structuredClone(request), context)
        if (result.status !== "ok") return result
        if (!await host.revalidate(context, [result.value.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
        return result
      })
    },
    async update(incoming: Parameters<SchedulePorts["update"]>[0], context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host, schedules) => {
        const request = structuredClone(incoming)
        if (context.kind !== "ui" || !await host.authorize(context, "schedules.update", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
        if (!host.occurrences) return { status: "unavailable", reason: "authorized-schedule-recipe-unavailable" } as const
        if (!validTimezone(request.timezone) || !host.validateRecurrence(request.recurrence, request.timezone)) return { status: "needs-input", reason: "invalid-schedule-recurrence" } as const
        const binding = await readBinding(host, request, context)
        if (binding.status !== "ok") return binding
        const qualified = await host.occurrences.qualify({ conditionRef: binding.value.conditionRef, recipeRef: binding.value.recipeRef, recurrence: request.recurrence, timezone: request.timezone }, context)
        if (qualified.status !== "ok") return qualified
        if (!samePrincipal(qualified.value, context) || qualified.value.recipeRef !== binding.value.recipeRef || qualified.value.conditionRef !== binding.value.conditionRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
        if (!await host.authorize(context, "schedules.update", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        const result = await schedules.update(structuredClone(request), context)
        if (result.status !== "ok") return result
        if (result.value.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
        return result
      })
    },
    async pause(incoming: Parameters<SchedulePorts["pause"]>[0], context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host, schedules) => {
        const request = structuredClone(incoming)
        if (context.kind !== "ui" || !await host.authorize(context, "schedules.pause", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
        if (!await host.authorize(context, "schedules.pause", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        const result = await schedules.pause(structuredClone(request), context)
        if (result.status !== "ok") return result
        if (result.value.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
        return result
      })
    },
    async list(context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host, schedules) => {
        if (!await requireOwner(host, context) || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
        const result = await schedules.list(context)
        if (result.status !== "ok") return result
        if (!await host.revalidate(context, result.value.map((item) => item.scheduleRef))) return { status: "denied", reason: "schedule-authority-changed" } as const
        return result
      })
    },
    async resume(incoming: { scheduleRef: string; expectedVersion: number }, context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host) => {
        const request = structuredClone(incoming)
        if (context.kind !== "ui" || !await host.authorize(context, "schedules.resume", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        const binding = await readBinding(host, request, context)
        if (binding.status !== "ok") return binding
        if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" } as const
        if (!await host.authorize(context, "schedules.resume", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        const result = await host.occurrences.resume(structuredClone(request), context)
        if (result.status !== "ok") return result
        if (result.value.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
        return result
      })
    },
    async runDue(scheduleRef: string, context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host) => {
        if (!await requireOwner(host, context) || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
        if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" } as const
        const found = await host.occurrences.read(scheduleRef, context)
        if (found.status !== "ok") return found
        const binding = structuredClone(found.value)
        if (!samePrincipal(binding, context) || binding.scheduleRef !== scheduleRef) return { status: "denied", reason: "schedule-authority-unavailable" } as const
        if (binding.state !== "active") return { status: "needs-input", reason: "schedule-not-active" } as const
        if (!await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
        return validateOccurrence(await host.occurrences.runDue(scheduleRef, context), scheduleRef, host, context)
      })
    },
    async runNow(incoming: { scheduleRef: string; expectedVersion: number; idempotencyKey: string }, context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host) => {
        const request = structuredClone(incoming)
        if (context.kind !== "ui" || !await host.authorize(context, "schedules.run", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        if (!request.idempotencyKey.trim()) return { status: "needs-input", reason: "idempotency-key-required" } as const
        const binding = await readBinding(host, request, context)
        if (binding.status !== "ok") return binding
        if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" } as const
        if (!await host.authorize(context, "schedules.run", structuredClone(request))) return { status: "denied", reason: "human-authorization-required" } as const
        return validateOccurrence(await host.occurrences.runNow(structuredClone(request), context), request.scheduleRef, host, context)
      })
    },
    async readRun(runRef: string, context: TrustedDomainContext) {
      return withPinnedScheduleProviders(source, providers, async (host, schedules) => {
        if (!await requireOwner(host, context) || !await host.revalidate(context, [runRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
        const result = await schedules.readRun(runRef, context)
        if (result.status !== "ok") return result
        if (result.value.runRef !== runRef || result.value.principalRef !== context.binding.principalRef || result.value.projectId !== context.binding.projectId || !await host.revalidate(context, [runRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
        return result
      })
    },
  }
}

async function readBinding(host: ScheduleHost, request: { scheduleRef: string; expectedVersion: number }, context: TrustedDomainContext): Promise<PortResult<RoutineScheduleBinding>> {
  if (!request.scheduleRef.trim() || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 0) return { status: "needs-input", reason: "invalid-schedule-version" }
  if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" }
  if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" }
  const found = await host.occurrences.read(request.scheduleRef, context)
  if (found.status !== "ok") return found
  const binding = structuredClone(found.value)
  if (!samePrincipal(binding, context) || binding.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" }
  if (binding.version !== request.expectedVersion) return { status: "stale", reason: "schedule-version-changed" }
  return { status: "ok", value: binding }
}

async function validateOccurrence(result: PortResult<RoutineOccurrence>, scheduleRef: string, host: ScheduleHost, context: TrustedDomainContext): Promise<PortResult<RoutineOccurrence>> {
  if (result.status !== "ok") return result
  const received = structuredClone(result.value)
  if (!Array.isArray(received.pendingRefs) || received.pendingRefs.length > 128 || received.pendingRefs.some((ref) => typeof ref !== "string" || !ref.trim() || ref !== ref.trim() || ref.length > 512)) return { status: "unavailable", reason: "occurrence-pending-references-invalid" }
  const occurrence = { ...received, pendingRefs: [...new Set(received.pendingRefs)] }
  if (!samePrincipal(occurrence, context) || occurrence.scheduleRef !== scheduleRef || !occurrence.occurrenceRef.trim()) return { status: "denied", reason: "schedule-authority-changed" }
  const routine = occurrence.routine
  if (routine && !samePrincipal(routine, context)) return { status: "denied", reason: "schedule-authority-changed" }
  if ((occurrence.state === "running" || occurrence.state === "ready" || occurrence.state === "unchanged") && (routine?.admission !== "admitted" || !routine.runRef)) return { status: "unavailable", reason: "occurrence-admission-unavailable" }
  if ((occurrence.state === "ready" || occurrence.state === "unchanged") && !routine?.resultRef) return { status: "unavailable", reason: "occurrence-result-unavailable" }
  if (occurrence.state === "ready" || occurrence.state === "unchanged") {
    if (!host.resultAccess || !routine?.runRef) return { status: "unavailable", reason: "occurrence-result-reader-unavailable" }
    const opened = await host.resultAccess.readResult(routine.runRef, context)
    if (opened.status !== "ok") return opened
    if (digestSfValue(opened.value.run) !== digestSfValue(routine) || opened.value.execution.state !== "completed" ||
      opened.value.execution.runRef !== routine.runRef || opened.value.execution.resultRef !== routine.resultRef ||
      opened.value.output.runRef !== routine.runRef || opened.value.output.resultRef !== routine.resultRef ||
      !/^[a-f0-9]{64}$/.test(opened.value.execution.outputDigest ?? "") || opened.value.output.outputDigest !== opened.value.execution.outputDigest)
      return { status: "stale", reason: "occurrence-result-changed" }
  }
  if (!await host.revalidate(context, [...new Set([scheduleRef, ...occurrence.pendingRefs, ...(routine?.runRef ? [routine.runRef] : []), ...(routine?.resultRef ? [routine.resultRef] : [])])])) return { status: "denied", reason: "schedule-authority-changed" }
  return { status: "ok", value: occurrence }
}

function samePrincipal(value: { principalRef: string; projectId: string }, context: TrustedDomainContext) {
  return value.principalRef === context.binding.principalRef && value.projectId === context.binding.projectId
}

async function requireOwner(host: ScheduleHost, context: TrustedDomainContext) {
  const owner = await host.owner(context)
  return !!owner && owner.principalRef === context.binding.principalRef && owner.projectId === context.binding.projectId
}

function validTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone })
    return true
  } catch {
    return false
  }
}

/** A replacement C08 or occurrence provider must not borrow an in-flight authorization. */
function withPinnedScheduleProviders<T>(source: ScheduleHost, providers: SchedulePorts, action: (host: ScheduleHost, schedules: SchedulePorts) => Promise<T>) {
  const host = {
    owner: source.owner,
    revalidate: source.revalidate,
    authorize: source.authorize,
    validateRecurrence: source.validateRecurrence,
    occurrences: source.occurrences,
    resultAccess: source.resultAccess,
  }
  const schedules = {
    create: providers.create,
    update: providers.update,
    pause: providers.pause,
    list: providers.list,
    readRun: providers.readRun,
  }
  const occurrences = host.occurrences && {
    qualify: host.occurrences.qualify,
    read: host.occurrences.read,
    resume: host.occurrences.resume,
    runDue: host.occurrences.runDue,
    runNow: host.occurrences.runNow,
  }
  const readResult = host.resultAccess?.readResult
  const changed = new Error("schedule-provider-changed")
  const current = () => source.owner === host.owner && source.revalidate === host.revalidate && source.authorize === host.authorize &&
    source.validateRecurrence === host.validateRecurrence && source.occurrences === host.occurrences && source.resultAccess === host.resultAccess &&
    host.resultAccess?.readResult === readResult &&
    (!occurrences || host.occurrences?.qualify === occurrences.qualify && host.occurrences.read === occurrences.read &&
      host.occurrences.resume === occurrences.resume && host.occurrences.runDue === occurrences.runDue && host.occurrences.runNow === occurrences.runNow) &&
    providers.create === schedules.create && providers.update === schedules.update && providers.pause === schedules.pause &&
    providers.list === schedules.list && providers.readRun === schedules.readRun
  const invoke = async <V>(call: () => Promise<V>) => {
    if (!current()) throw changed
    const value = await call()
    if (!current()) throw changed
    return value
  }
  const guardedHost: ScheduleHost = {
    owner: (...args) => invoke(() => host.owner.apply(source, args)),
    revalidate: (...args) => invoke(() => host.revalidate.apply(source, args)),
    authorize: (...args) => invoke(() => host.authorize.apply(source, args)),
    validateRecurrence: (...args) => {
      if (!current()) throw changed
      const valid = host.validateRecurrence.apply(source, args)
      if (!current()) throw changed
      return valid
    },
    ...(occurrences ? { occurrences: {
      qualify: (...args: Parameters<RoutineOccurrencePort["qualify"]>) => invoke(() => occurrences.qualify.apply(host.occurrences, args)),
      read: (...args: Parameters<RoutineOccurrencePort["read"]>) => invoke(() => occurrences.read.apply(host.occurrences, args)),
      resume: (...args: Parameters<RoutineOccurrencePort["resume"]>) => invoke(() => occurrences.resume.apply(host.occurrences, args)),
      runDue: (...args: Parameters<RoutineOccurrencePort["runDue"]>) => invoke(() => occurrences.runDue.apply(host.occurrences, args)),
      runNow: (...args: Parameters<RoutineOccurrencePort["runNow"]>) => invoke(() => occurrences.runNow.apply(host.occurrences, args)),
    } } : {}),
    ...(readResult ? { resultAccess: { readResult: (...args: Parameters<RoutineResultAccess["readResult"]>) => invoke(() => readResult.apply(host.resultAccess, args)) } } : {}),
  }
  const guardedSchedules: SchedulePorts = {
    create: (...args) => invoke(() => schedules.create.apply(providers, args)),
    update: (...args) => invoke(() => schedules.update.apply(providers, args)),
    pause: (...args) => invoke(() => schedules.pause.apply(providers, args)),
    list: (...args) => invoke(() => schedules.list.apply(providers, args)),
    readRun: (...args) => invoke(() => schedules.readRun.apply(providers, args)),
  }
  return action(guardedHost, guardedSchedules).then((result) => {
    if (!current()) throw changed
    return result
  }).catch((error: unknown) => {
    if (error === changed) return { status: "unavailable", reason: "schedule-provider-changed" } as const
    throw error
  })
}
