import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { RoutineResult } from "../contracts/context.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

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
}

/** Safe internal recurrence operations. This module never sends externally or approves a workflow. */
export function createRoutineSchedule(host: ScheduleHost, schedules: SchedulePorts) {
  return {
    async create(request: Parameters<SchedulePorts["create"]>[0], context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.create", request)) return { status: "denied", reason: "human-authorization-required" } as const
      if (!await requireOwner(host, context) || !validTimezone(request.timezone) || !host.validateRecurrence(request.recurrence, request.timezone) || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      if (!host.occurrences) return { status: "unavailable", reason: "occurrence-owner-revalidation-unavailable" } as const
      const qualified = await host.occurrences.qualify(request, context)
      if (qualified.status !== "ok") return qualified
      if (!samePrincipal(qualified.value, context) || qualified.value.recipeRef !== request.recipeRef || qualified.value.conditionRef !== request.conditionRef || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-changed" } as const
      const result = await schedules.create(request, context)
      if (result.status !== "ok") return result
      if (!await host.revalidate(context, [result.value.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
    async update(request: Parameters<SchedulePorts["update"]>[0], context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.update", request)) return { status: "denied", reason: "human-authorization-required" } as const
      if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      if (!host.occurrences) return { status: "unavailable", reason: "authorized-schedule-recipe-unavailable" } as const
      if (!validTimezone(request.timezone) || !host.validateRecurrence(request.recurrence, request.timezone)) return { status: "needs-input", reason: "invalid-schedule-recurrence" } as const
      const binding = await readBinding(host, request, context)
      if (binding.status !== "ok") return binding
      const qualified = await host.occurrences.qualify({ conditionRef: binding.value.conditionRef, recipeRef: binding.value.recipeRef, recurrence: request.recurrence, timezone: request.timezone }, context)
      if (qualified.status !== "ok") return qualified
      if (!samePrincipal(qualified.value, context) || qualified.value.recipeRef !== binding.value.recipeRef || qualified.value.conditionRef !== binding.value.conditionRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      const result = await schedules.update(request, context)
      if (result.status !== "ok") return result
      if (result.value.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
    async pause(request: Parameters<SchedulePorts["pause"]>[0], context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.pause", request)) return { status: "denied", reason: "human-authorization-required" } as const
      if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      const result = await schedules.pause(request, context)
      if (result.status !== "ok") return result
      if (result.value.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
    async list(context: TrustedDomainContext) {
      if (!await requireOwner(host, context) || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      const result = await schedules.list(context)
      if (result.status !== "ok") return result
      if (!await host.revalidate(context, result.value.map((item) => item.scheduleRef))) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
    async resume(request: { scheduleRef: string; expectedVersion: number }, context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.resume", request)) return { status: "denied", reason: "human-authorization-required" } as const
      const binding = await readBinding(host, request, context)
      if (binding.status !== "ok") return binding
      if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" } as const
      const result = await host.occurrences.resume(request, context)
      if (result.status !== "ok") return result
      if (result.value.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
    async runDue(scheduleRef: string, context: TrustedDomainContext) {
      if (!await requireOwner(host, context) || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" } as const
      const binding = await host.occurrences.read(scheduleRef, context)
      if (binding.status !== "ok") return binding
      if (!samePrincipal(binding.value, context) || binding.value.scheduleRef !== scheduleRef) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      if (binding.value.state !== "active") return { status: "needs-input", reason: "schedule-not-active" } as const
      if (!await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      return validateOccurrence(await host.occurrences.runDue(scheduleRef, context), scheduleRef, host, context)
    },
    async runNow(request: { scheduleRef: string; expectedVersion: number; idempotencyKey: string }, context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.run", request)) return { status: "denied", reason: "human-authorization-required" } as const
      if (!request.idempotencyKey.trim()) return { status: "needs-input", reason: "idempotency-key-required" } as const
      const binding = await readBinding(host, request, context)
      if (binding.status !== "ok") return binding
      if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" } as const
      return validateOccurrence(await host.occurrences.runNow(request, context), request.scheduleRef, host, context)
    },
    async readRun(runRef: string, context: TrustedDomainContext) {
      if (!await requireOwner(host, context) || !await host.revalidate(context, [runRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      const result = await schedules.readRun(runRef, context)
      if (result.status !== "ok") return result
      if (result.value.runRef !== runRef || result.value.principalRef !== context.binding.principalRef || result.value.projectId !== context.binding.projectId || !await host.revalidate(context, [runRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
  }
}

async function readBinding(host: ScheduleHost, request: { scheduleRef: string; expectedVersion: number }, context: TrustedDomainContext): Promise<PortResult<RoutineScheduleBinding>> {
  if (!request.scheduleRef.trim() || !Number.isSafeInteger(request.expectedVersion) || request.expectedVersion < 0) return { status: "needs-input", reason: "invalid-schedule-version" }
  if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" }
  if (!host.occurrences) return { status: "unavailable", reason: "durable-occurrence-port-unavailable" }
  const binding = await host.occurrences.read(request.scheduleRef, context)
  if (binding.status !== "ok") return binding
  if (!samePrincipal(binding.value, context) || binding.value.scheduleRef !== request.scheduleRef || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" }
  if (binding.value.version !== request.expectedVersion) return { status: "stale", reason: "schedule-version-changed" }
  return binding
}

async function validateOccurrence(result: PortResult<RoutineOccurrence>, scheduleRef: string, host: ScheduleHost, context: TrustedDomainContext): Promise<PortResult<RoutineOccurrence>> {
  if (result.status !== "ok") return result
  if (!samePrincipal(result.value, context) || result.value.scheduleRef !== scheduleRef || !result.value.occurrenceRef.trim()) return { status: "denied", reason: "schedule-authority-changed" }
  const routine = result.value.routine
  if (routine && !samePrincipal(routine, context)) return { status: "denied", reason: "schedule-authority-changed" }
  if ((result.value.state === "running" || result.value.state === "ready" || result.value.state === "unchanged") && (routine?.admission !== "admitted" || !routine.runRef)) return { status: "unavailable", reason: "occurrence-admission-unavailable" }
  if ((result.value.state === "ready" || result.value.state === "unchanged") && !routine?.resultRef) return { status: "unavailable", reason: "occurrence-result-unavailable" }
  if (!await host.revalidate(context, [scheduleRef, ...(routine?.runRef ? [routine.runRef] : []), ...(routine?.resultRef ? [routine.resultRef] : [])])) return { status: "denied", reason: "schedule-authority-changed" }
  return result
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

