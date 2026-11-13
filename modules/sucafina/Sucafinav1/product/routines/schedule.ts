import type { BusinessPorts } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

type SchedulePorts = BusinessPorts["schedules"]
/** Host authority boundary; occurrence storage is intentionally not emulated here. */
export type ScheduleHost = {
  owner: (context: TrustedDomainContext) => Promise<{ principalRef: string; projectId: string } | undefined>
  revalidate: (context: TrustedDomainContext, scheduleRefs: readonly string[]) => Promise<boolean>
  validateRecurrence: (recurrence: string, timezone: string) => boolean
  authorize: (context: TrustedDomainContext, action: "schedules.create" | "schedules.update" | "schedules.pause", payload: unknown) => Promise<boolean>
}

/** Safe internal recurrence operations. This module never sends externally or approves a workflow. */
export function createRoutineSchedule(host: ScheduleHost, schedules: SchedulePorts) {
  return {
    async create(request: Parameters<SchedulePorts["create"]>[0], context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.create", request)) return { status: "denied", reason: "human-authorization-required" } as const
      if (!await requireOwner(host, context) || !validTimezone(request.timezone) || !host.validateRecurrence(request.recurrence, request.timezone) || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      return { status: "unavailable", reason: "occurrence-owner-revalidation-unavailable" } as const
    },
    async update(request: Parameters<SchedulePorts["update"]>[0], context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.update", request)) return { status: "denied", reason: "human-authorization-required" } as const
      if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      return { status: "unavailable", reason: "authorized-schedule-recipe-unavailable" } as const
    },
    async pause(request: Parameters<SchedulePorts["pause"]>[0], context: TrustedDomainContext) {
      if (context.kind !== "ui" || !await host.authorize(context, "schedules.pause", request)) return { status: "denied", reason: "human-authorization-required" } as const
      if (!await requireOwner(host, context) || !await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      const result = await schedules.pause(request, context)
      if (result.status !== "ok") return result
      if (!await host.revalidate(context, [request.scheduleRef])) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
    async list(context: TrustedDomainContext) {
      if (!await requireOwner(host, context) || !await host.revalidate(context, [])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      const result = await schedules.list(context)
      if (result.status !== "ok") return result
      if (!await host.revalidate(context, result.value.map((item) => item.scheduleRef))) return { status: "denied", reason: "schedule-authority-changed" } as const
      return result
    },
    async runDue(scheduleRef: string, context: TrustedDomainContext) {
      if (!await requireOwner(host, context) || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-authority-unavailable" } as const
      return { status: "unavailable", reason: "durable-occurrence-port-unavailable" } as const
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
