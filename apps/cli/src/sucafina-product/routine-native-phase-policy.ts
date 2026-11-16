import { isDeepStrictEqual } from "node:util"
import { Effect } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { captureSfRoutineNativeOwner } from "./routine-native-owner.ts"
import type { SfRoutineNativeOwnerWitness } from "./routine-native-owner.ts"
import type { NativeAdmission } from "./routine-native-records.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"
import { captureSfRoutineApprovedChain } from "./routine-native-phase-chain.ts"

/** Independent native witness, not the SF Request/source predicate under another name. `ask` is NOT a grant:
 * observe() captures the actual core Task, and only Task's original Permission.assert may answer its pending ask.
 * This observer never asks, replies, saves a rule, reserves a child, changes Relay, or advances provider work.
 */
export function createSfRoutineNativePhasePolicy(resources: SfRoutineNativeRuntimeResources, before: NativeAdmission) {
  const chain = captureSfRoutineApprovedChain(before)
  if (!chain) throw new Error("SF_NATIVE_PHASE_NATIVE_APPROVAL_REQUIRED")
  const observation: { active?: SfRoutineNativeOwnerWitness;
    call?: { messageID: string; callID: string }; tail: Promise<void> } = { tail: Promise.resolve() }
  const cancellation = new AbortController()
  const current = () => {
    const attempt = observation.tail.then(async () => {
      if (cancellation.signal.aborted || !resources.current()) return false
      const after = await resources.records.readAdmission(before.authorizationID)
      if (!after || !chain.accept(after) || !await resources.records.isLatestPlan(after.revision) || !await resources.records.isCurrentApproval(after)) return false
      const selected = await Effect.runPromise(resources.agents.select(after.parent.agent))
      if (selected.id !== AgentV2.defaultID || !selected.info || selected.info.hidden || selected.info.mode === "subagent") return false
      const resourcesToCheck = [after.authorization.routedMemberID,
        ...(after.presentation?.intent.model ? [after.presentation.intent.model] : [])]
      const policy = await Effect.runPromise(resources.permission.evaluate({ action: "task", resources: resourcesToCheck,
        sessionID: after.parent.id, agent: selected.id,
        ...(observation.call ? { source: { type: "tool" as const, ...observation.call } } : {}) }))
      if (policy === "deny") return false
      const pending = await Effect.runPromise(resources.permission.forSession(after.parent.id))
      if (pending.filter((request) => request.action === "task").some((request) => !observation.call ||
        request.source?.messageID !== observation.call.messageID || request.source?.callID !== observation.call.callID)) return false
      // A real ask may remain pending here. Its absence is not interpreted as an approval either.
      if (observation.active && !await observation.active.current()) return false
      if (after.bound) {
        if (!observation.call || after.bound.authorityMessageID !== observation.call.messageID ||
          after.bound.authorityCallID !== observation.call.callID) return false
        const view = await Effect.runPromise(resources.relay.currentStep(after.bound.token, after.bound.binding))
        if (view.state === "escalated") return false
      }
      return resources.current()
    }).catch(() => false)
    const fenced = attempt.then((valid) => { if (!valid) cancellation.abort(); return valid })
    observation.tail = fenced.then(() => undefined)
    return fenced
  }
  return { current, signal: cancellation.signal,
    observe: <A, E, R>(invocation: ToolSafety.Invocation, effect: Effect.Effect<A, E, R>) => Effect.gen(function* () {
      const witness = yield* captureSfRoutineNativeOwner(resources, invocation)
      if (witness.plan.id !== before.revision.id || !isDeepStrictEqual(witness.plan, before.revision))
        return yield* new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_NATIVE_TASK_CHANGED" })
      return yield* Effect.acquireUseRelease(Effect.sync(() => {
        if (observation.active) return false
        observation.active = witness
        observation.call = { messageID: witness.task.assistantMessageID, callID: witness.task.toolCallID }
        return true
      }), (acquired): Effect.Effect<A, E | ToolSafety.Denied, R> => acquired ? effect : Effect.fail(new ToolSafety.Denied({ reason: "SF_NATIVE_PHASE_NATIVE_TASK_BUSY" })),
      () => Effect.sync(() => { if (observation.active === witness) observation.active = undefined }))
    }),
  }
}
