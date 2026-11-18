import { Effect } from "effect"
import type { Capability } from "@orchestra/schema/capability"
import type { ScheduledTask } from "@orchestra/core/scheduled-task"
import type { CapabilityScheduleManagement } from "@orchestra/schema/capability-schedule-management"
import { digestSfValue } from "../contracts/canonical.ts"
import type { RoutineResult } from "../contracts/context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { presentRoutineLifecycle } from "./lifecycle.ts"
import type { RoutinePresentation } from "./lifecycle.ts"
import type { RoutineExecutionSnapshot, RoutineResultAccess } from "./result-access.ts"

export type NativeRoutineScheduleHost = {
  /** The supplied service is the existing native scheduler; no alternate task store is created. */
  schedules: Pick<ScheduledTask.Interface["capability"], "get">
  resolve: (scheduleRef: string, context: TrustedDomainContext) => Promise<PortResult<{
    nativeId: ScheduledTask.ID
    owner: Capability.Owner
    principalRef: string
    projectId: string
  }>>
  revalidate: (context: TrustedDomainContext, refs: readonly string[]) => Promise<boolean>
  /** Only a real C07 mapping may promote the native prompt's receipt to routine state. */
  readRoutine: (nativeSessionId: string, context: TrustedDomainContext) => Promise<PortResult<RoutineResult | null>>
  /** Both native execution and authenticated immutable output are required before offering a result. */
  readExecution?: (runRef: string, context: TrustedDomainContext) => Promise<PortResult<RoutineExecutionSnapshot>>
  resultAccess?: RoutineResultAccess
}

export type NativeRoutineScheduleView = {
  scheduleRef: string
  version: number
  state: "active" | "paused" | "blocked" | "exhausted"
  timezone: string
  cadence: CapabilityScheduleManagement.Schedule["cadence"]
  catchUp: "latest" | "skip"
  next?: number
  missedOccurrences: number
  last?: {
    at: number
    slot?: number
    state: RoutinePresentation["state"]
    routine?: RoutineResult
  }
}

/** Native `started` means durable prompt admission, never Relay completion or approval. */
export async function readNativeRoutineSchedule(scheduleRef: string, context: TrustedDomainContext, host: NativeRoutineScheduleHost): Promise<PortResult<NativeRoutineScheduleView>> {
  if (!scheduleRef.trim() || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-access-unavailable" }
  const resolved = await host.resolve(scheduleRef, context)
  if (resolved.status !== "ok") return resolved
  const binding = structuredClone(resolved.value)
  if (binding.principalRef !== context.binding.principalRef || binding.projectId !== context.binding.projectId || binding.owner.projectID !== context.binding.projectId || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-access-unavailable" }
  const read = await Effect.runPromise(Effect.result(host.schedules.get(structuredClone(binding.owner), binding.nativeId)))
  if (read._tag === "Failure") return { status: "unavailable", reason: "schedule-unavailable" }
  const native = structuredClone(read.success)
  if (native.id !== binding.nativeId || !await host.revalidate(context, [scheduleRef])) return { status: "denied", reason: "schedule-access-unavailable" }
  const last = native.last?.outcome === "started" ? await host.readRoutine(native.last.sessionID, context) : undefined
  if (last && last.status !== "ok") return last
  const routine = last?.status === "ok" && last.value ? structuredClone(last.value) : undefined
  if (routine && (routine.principalRef !== context.binding.principalRef || routine.projectId !== context.binding.projectId)) return { status: "denied", reason: "schedule-access-unavailable" }
  const presentation = routine ? await readRoutinePresentation(routine, context, host) : undefined
  if (presentation && presentation.status !== "ok") return presentation
  if (routine && native.last?.outcome === "started") {
    const current = await host.readRoutine(native.last.sessionID, context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== digestSfValue(routine)) return { status: "stale", reason: "schedule-routine-changed" }
  }
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
        state: native.last.outcome === "failed" ? "failed" : presentation?.status === "ok" ? presentation.value.state : "admission-pending",
        ...(routine ? { routine } : {}),
      } } : {}),
    },
  }
}

async function readRoutinePresentation(routine: RoutineResult, context: TrustedDomainContext, host: NativeRoutineScheduleHost): Promise<PortResult<RoutinePresentation>> {
  if (!routine.runRef || !host.readExecution) return { status: "ok", value: presentRoutineLifecycle({ run: routine, execution: "unknown", outputAuthorized: false }) }
  const read = await host.readExecution(routine.runRef, context)
  if (read.status !== "ok") return read
  const execution = structuredClone(read.value)
  if (execution.runRef !== routine.runRef || typeof execution.revision !== "string" || !execution.revision.trim() ||
    !["requested", "admission-pending", "preparing", "completed", "failed", "cancelled"].includes(execution.state)) return { status: "unavailable", reason: "schedule-execution-unverified" }
  if (execution.state === "completed" && (execution.resultRef !== routine.resultRef || !/^[a-f0-9]{64}$/.test(execution.outputDigest ?? ""))) return { status: "unavailable", reason: "schedule-execution-unverified" }
  const opened = execution.state === "completed" && routine.admission === "admitted" && routine.resultRef && host.resultAccess
    ? await host.resultAccess.readResult(routine.runRef, context) : undefined
  if (opened && opened.status !== "ok") return opened
  if (opened?.status === "ok" && (digestSfValue(opened.value.run) !== digestSfValue(routine) ||
    digestSfValue(opened.value.execution) !== digestSfValue(execution) || opened.value.output.runRef !== routine.runRef ||
    opened.value.output.resultRef !== routine.resultRef || opened.value.output.outputDigest !== execution.outputDigest)) return { status: "stale", reason: "schedule-result-changed" }
  const current = await host.readExecution(routine.runRef, context)
  if (current.status !== "ok") return current
  if (digestSfValue(current.value) !== digestSfValue(execution)) return { status: "stale", reason: "schedule-execution-changed" }
  return { status: "ok", value: presentRoutineLifecycle({
    run: routine,
    execution: execution.state === "preparing" ? "running" : execution.state === "requested" || execution.state === "admission-pending" ? "not-started" : execution.state,
    outputAuthorized: opened?.status === "ok",
  }) }
}
