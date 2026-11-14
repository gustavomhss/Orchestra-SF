import { Effect } from "effect"
import type { Capability } from "@orchestra/schema/capability"
import type { ScheduledTask } from "@orchestra/schema/scheduled-task"
import type { ScheduledTaskCapability } from "@orchestra/core/scheduled-task/capability"
import type { RoutineResult } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

export type NativeRoutineScheduleHost = {
  /** The supplied service is the existing native scheduler; no alternate task store is created. */
  schedules: Pick<ScheduledTaskCapability.Interface, "get">
  resolve: (scheduleRef: string, context: TrustedDomainContext) => Promise<PortResult<{
    nativeId: ScheduledTask.ID
    owner: Capability.Owner
    principalRef: string
    projectId: string
  }>>
  revalidate: (context: TrustedDomainContext, refs: readonly string[]) => Promise<boolean>
  /** Only a real C07 mapping may promote the native prompt's receipt to routine state. */
  readRoutine: (nativeSessionId: string, context: TrustedDomainContext) => Promise<PortResult<RoutineResult | null>>
}

export type NativeRoutineScheduleView = {
  scheduleRef: string
  version: number
  state: "active" | "paused" | "blocked" | "exhausted"
  timezone: string
  cadence: ScheduledTaskCapability.Schedule["cadence"]
  catchUp: "latest" | "skip"
  next?: number
  missedOccurrences: number
  last?: {
    at: number
    slot?: number
    state: "admission-pending" | "preparing" | "reviewable" | "blocked" | "failed"
    routine?: RoutineResult
  }
}

/** Native `started` means durable prompt admission, never Relay completion or approval. */
export async function readNativeRoutineSchedule(scheduleRef: string, context: TrustedDomainContext, host: NativeRoutineScheduleHost): Promise<PortResult<NativeRoutineScheduleView>> {
  if (!scheduleRef.trim() || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-access-unavailable" }
  const binding = await host.resolve(scheduleRef, context)
  if (binding.status !== "ok") return binding
  if (binding.value.principalRef !== context.binding.principalRef || binding.value.projectId !== context.binding.projectId || binding.value.owner.projectID !== context.binding.projectId || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-access-unavailable" }
  const read = await Effect.runPromise(Effect.result(host.schedules.get(binding.value.owner, binding.value.nativeId)))
  if (read._tag === "Failure") return { status: "unavailable", reason: "schedule-unavailable" }
  if (read.success.id !== binding.value.nativeId || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-access-unavailable" }
  const native = read.success
  const last = native.last?.outcome === "started" ? await host.readRoutine(native.last.sessionID, context) : undefined
  if (last && last.status !== "ok") return last
  const routine = last?.status === "ok" ? last.value : undefined
  if (routine && (routine.principalRef !== context.binding.principalRef || routine.projectId !== context.binding.projectId)) return { status: "denied", reason: "schedule-access-unavailable" }
  if (!await host.revalidate(context, [scheduleRef, ...(routine?.runRef ? [routine.runRef] : []), ...(routine?.resultRef ? [routine.resultRef] : [])])) return { status: "denied", reason: "schedule-access-unavailable" }
  return {
    status: "ok",
    value: {
      scheduleRef,
      version: native.revision,
      state: native.disabledReason === "owner-missing" ? "blocked" : native.disabledReason === "exhausted" ? "exhausted" : native.enabled ? "active" : "paused",
      timezone: native.timezone,
      cadence: native.cadence,
      catchUp: native.catchUp,
      next: native.next,
      missedOccurrences: native.skipped,
      ...(native.last ? { last: {
        at: native.last.time,
        slot: native.last.slot,
        state: native.last.outcome === "failed" ? "failed" : !routine ? "admission-pending" : routine.admission !== "admitted" ? "blocked" : routine.resultRef ? "reviewable" : "preparing",
        ...(routine ? { routine } : {}),
      } } : {}),
    },
  }
}
