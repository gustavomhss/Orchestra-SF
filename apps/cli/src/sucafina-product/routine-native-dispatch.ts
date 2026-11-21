import { isDeepStrictEqual } from "node:util"
import { ToolOutput } from "@orchestra/llm"
import { Cause, DateTime, Effect, Exit, Option } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { CapabilityInvocation } from "@orchestra/core/capability/invocation"
import { SessionEvent } from "@orchestra/core/session/event"
import { LeanOutput } from "@orchestra/core/tool/lean-output"
import { TaskTool } from "@orchestra/core/tool/task"
import type { ToolRegistry } from "@orchestra/core/tool/registry"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"

export type SfRoutineNativeDispatchOutcome = { readonly outcome: "executed" | "failed" | "terminal" }
export type SfRoutineNativeDispatchInput = {
  readonly resources: SfRoutineNativeRuntimeResources
  /** The immutable input of the actual Task tool part already recorded in the authorized Maestro Session. */
  readonly invocation: ToolRegistry.ExecuteInput
  readonly current: () => Promise<boolean>
  readonly signal: AbortSignal
  /** Installed only by the actual exclusive owner; a busy retry must never replace an active authority lease. */
  readonly bindAuthority: () => () => void
}

/**
 * Cancellation must reach the operation inside SessionExecution.exclusive. Its ownership fiber is independent of
 * the waiting caller, so cancelling only runPromise(exclusive(...)) would leave native work running. This race
 * interrupts precisely this operation; it never interrupts another Session's later execution by a guessed ID.
 */
export function withSfRoutineNativeAbort<A, E, R>(effect: Effect.Effect<A, E, R>, signal: AbortSignal): Effect.Effect<A, E, R> {
  const aborted = Effect.promise((fiberSignal) => new Promise<void>((resolve) => {
    const finish = () => {
      signal.removeEventListener("abort", finish)
      fiberSignal.removeEventListener("abort", finish)
      resolve()
    }
    signal.addEventListener("abort", finish, { once: true })
    fiberSignal.addEventListener("abort", finish, { once: true })
    if (signal.aborted || fiberSignal.aborted) finish()
  })).pipe(Effect.andThen(Effect.interrupt))
  return Effect.suspend(() => signal.aborted ? Effect.interrupt : Effect.raceFirst(effect, aborted))
}

/**
 * Executes the real registered Task under the existing process-global Session coordinator. Core's materialization
 * applies ToolSafety and Task's own governance, placement, model, permissions, ancestry, prompt and retry checks.
 * Its actual result is then published through the same native SessionEvent types used by the Session runner.
 * There is no generated child ID, tool registration, Session.resume shortcut or product run ledger here.
 */
export async function dispatchSfRoutineNativeTask(input: SfRoutineNativeDispatchInput): Promise<PortResult<SfRoutineNativeDispatchOutcome>> {
  const resources = input.resources
  const invocation = structuredClone(input.invocation)
  const liveRegistration = () => resources.current() &&
    resources.registry.currentRegistrationIdentity(TaskTool.name) === resources.taskRegistration
  const live = () => !input.signal.aborted && liveRegistration()
  const current = Effect.promise(async () => live() && await input.current().catch(() => false) && live())

  // This is a read of the real native Session and tool part, repeated inside execution ownership and publication.
  const recorded = Effect.gen(function* () {
    if (invocation.agent !== AgentV2.defaultID || invocation.call.name !== TaskTool.name || !liveRegistration()) return undefined
    const parent = yield* resources.store.get(invocation.sessionID)
    if (!parent || parent.time.archived || parent.projectID !== resources.location.project.id ||
      (parent.agent !== undefined && parent.agent !== AgentV2.defaultID) ||
      parent.location.directory !== resources.location.directory || parent.location.workspaceID !== resources.location.workspaceID)
      return undefined
    const found = yield* resources.store.message(invocation.assistantMessageID)
    if (found?.sessionID !== parent.id || found.message.type !== "assistant" || found.message.agent !== invocation.agent ||
      !isDeepStrictEqual(found.message.model, invocation.model)) return undefined
    const part = found.message.content.find((part) => part.type === "tool" && part.id === invocation.call.id)
    if (!part || part.type !== "tool" || part.name !== TaskTool.name || part.provider?.executed || part.state.status === "pending" ||
      !isDeepStrictEqual(part.state.input, invocation.call.input)) return undefined
    // Detached Tasks lack the foreground cancellation/settlement boundary this installed adapter requires.
    if (part.state.input.background === true) return undefined
    return { parent, message: found.message, part }
  })

  // Preserve native terminal history on exact retry. Publishing uses a native transaction and re-reads the tool
  // part inside it, so a response already committed is never overwritten by an interrupted or repeated waiter.
  // The asynchronous Request/source check runs immediately outside this transaction: it reads native records in
  // its own Effect fiber and must not re-enter SQLite while this transaction owns the connection. Inside SQL,
  // identity and cancellation are checked synchronously; SF reauthenticates once more before any product egress.
  const publish = (settlement: ToolRegistry.Settlement) => resources.events.transact(Effect.gen(function* () {
    if (settlement.result.type !== "error" && !live()) return false
    const stored = yield* recorded
    if (!stored) return false
    if (stored.part.state.status === "completed" || stored.part.state.status === "error") return true
    if (stored.part.state.status !== "running") return false
    const metadata = LeanOutput.take({ sessionID: invocation.sessionID, callID: invocation.call.id })
    const base = {
      sessionID: invocation.sessionID, timestamp: yield* DateTime.now,
      assistantMessageID: invocation.assistantMessageID, callID: invocation.call.id,
      provider: { executed: false, ...(stored.part.provider?.metadata === undefined ? {} : { metadata: stored.part.provider.metadata }) },
      ...(metadata ? { metadata } : {}),
    }
    if (settlement.result.type === "error") {
      yield* resources.events.publish(SessionEvent.Tool.Failed, { ...base,
        error: { type: "unknown", message: failureText(settlement.result.value) }, result: settlement.result })
      return true
    }
    const output = settlement.output ?? ToolOutput.fromResultValue(settlement.result)
    if (!output || !live()) return false
    yield* resources.events.publish(SessionEvent.Tool.Success, { ...base,
      structured: record(output.structured), content: output.content,
      ...(settlement.outputPaths ? { outputPaths: settlement.outputPaths } : {}),
    })
    return true
  }))

  const operation = Effect.gen(function* () {
    if (!(yield* current)) return denied()
    const stored = yield* recorded
    if (!stored) return unavailable("native-routine-task-invocation-unavailable")
    if (stored.part.state.status === "completed" || stored.part.state.status === "error")
      return ok("terminal")
    if (stored.part.state.status !== "running") return unavailable("native-routine-task-not-running")

    const selected = yield* resources.agents.select(stored.parent.agent)
    if (selected.id !== invocation.agent || !selected.info || selected.info.hidden) return unavailable("native-routine-agent-unavailable")
    // Exactly SessionRunner's precedence: configured Agent rules first, then the Session's own overrides.
    const effectiveRules = [...selected.info.permissions.map((rule) => ({ ...rule })), ...(yield* resources.store.permissions(stored.parent.id))]
    const materialization = yield* resources.registry.materialize(effectiveRules, { advertisedNames: [TaskTool.name] })
    if (materialization.registrationIdentity(TaskTool.name) !== resources.taskRegistration || !materialization.definition(TaskTool.name) || !(yield* current))
      return unavailable("native-routine-task-registration-changed")
    const scope = yield* resources.store.scope(stored.parent.id)
    if (scope) {
      if (!scope.scope.tools.includes(TaskTool.name)) return denied()
      const charged = yield* resources.store.charge(stored.parent.id, { type: "tool", name: TaskTool.name })
      if (!charged.admitted) return denied()
    }
    if (!(yield* current)) return denied()
    const latest = yield* recorded
    if (!latest || latest.part.state.status !== "running" || !isDeepStrictEqual(latest.parent, stored.parent))
      return unavailable("native-routine-task-changed")
    const attempted = { value: false }
    const execute = Effect.gen(function* () {
      attempted.value = true
      const settled = yield* CapabilityInvocation.withContext({
        issuer: "app",
        owner: { projectID: stored.parent.projectID, location: stored.parent.location,
          sessionID: stored.parent.id, agentID: invocation.agent },
        invocation: { sessionID: stored.parent.id, agentID: invocation.agent,
          assistantMessageID: invocation.assistantMessageID, callID: invocation.call.id },
        rootToolName: TaskTool.name, effectiveRules, nativeDenyFloor: [],
      }, materialization.settle(invocation)).pipe(Effect.exit)
      if (Exit.isFailure(settled)) {
        if (Cause.hasInterrupts(settled.cause)) return yield* Effect.failCause(settled.cause)
        // A failure here is an observed native execution failure, not a fabricated cancellation or model receipt.
        const written = yield* publish({ result: { type: "error", value: "Native Task execution failed" } })
        return written ? ok("failed") : unavailable("native-routine-settlement-unavailable")
      }
      // A revoked SF return may not publish source content into the parent. The actual tool boundary failed;
      // the child's already committed native facts remain in Task/Relay and are never rewritten as a success here.
      if (!(yield* current)) {
        yield* publish({ result: { type: "error", value: "Native Task return denied by current authority" } })
        return denied()
      }
      const written = yield* publish(settled.value)
      if (!written) return unavailable("native-routine-settlement-unavailable")
      if (!(yield* current)) return denied()
      return ok(settled.value.result.type === "error" ? "failed" : "executed")
    }).pipe(Effect.onInterrupt(() => attempted.value
      ? publish({ result: { type: "error", value: "Tool execution interrupted" } }).pipe(Effect.ignore)
      : Effect.void))
    return yield* execute
  })

  try {
    // No `wait`: an active parent remains under its original runner. No request can adopt or stop that owner.
    const owned = Effect.acquireUseRelease(Effect.sync(input.bindAuthority), () => operation,
      (release) => Effect.sync(release))
    const result = await Effect.runPromise(resources.execution.exclusive(invocation.sessionID,
      withSfRoutineNativeAbort(owned, input.signal), { wait: false }))
    if (input.signal.aborted) return denied()
    return Option.isSome(result) ? result.value : { status: "conflict", reason: "native-routine-session-busy" }
  } catch {
    return input.signal.aborted ? denied() : unavailable("native-routine-dispatch-unavailable")
  }
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : { value }
}

function failureText(value: unknown) {
  if (typeof value === "string") return value
  try { return JSON.stringify(value) ?? "Native Task failed" } catch { return "Native Task failed" }
}

function ok(outcome: SfRoutineNativeDispatchOutcome["outcome"]): PortResult<SfRoutineNativeDispatchOutcome> {
  return { status: "ok", value: { outcome } }
}

function denied(): PortResult<SfRoutineNativeDispatchOutcome> {
  return { status: "denied", reason: "routine-authority-changed" }
}

function unavailable(reason: string): PortResult<SfRoutineNativeDispatchOutcome> {
  return { status: "unavailable", reason }
}
