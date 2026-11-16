import { isDeepStrictEqual } from "node:util"
import { Effect, Option, Schema } from "effect"
import { ToolFailure } from "@orchestra/llm"
import { ExecutionHost } from "@orchestra/core/session/runner"
import type { SessionRunner } from "@orchestra/core/session/runner"
import { AgentV2 } from "@orchestra/core/agent"
import type { SessionSchema } from "@orchestra/core/session/schema"
import { SessionScope } from "@orchestra/core/session/scope"
import { TaskTool } from "@orchestra/core/tool/task"
import type { ToolSafety } from "@orchestra/core/tool-safety"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"
import { hasSfRoutinePhaseMarker, SF_ROUTINE_PHASE_MARKER } from "./routine-native-phase-marker.ts"

export const SF_ROUTINE_PHASE_PLAYBOOK = "maestro-run-governed"
/** Reviewed exact canonical ids from v2/tools/{admission,planning,review,approval,workflows}.ts and
 * core/tool/maestro-arsenal.ts. No prefix matching, generic host tools, shell, filesystem, network or Dock tools.
 * The two Arsenal broker ids are additionally restricted below to ONLY describing/arming this parent's relay-arm.
 */
export const SF_ROUTINE_PHASE_SCOPE = SessionScope.Scope.make({
  skills: { entry: SF_ROUTINE_PHASE_PLAYBOOK, allow: [SF_ROUTINE_PHASE_PLAYBOOK] },
  tools: [TaskTool.name, "maestro_record_admission", "maestro_catalog_context", "maestro_record_plan_revision",
    "maestro_record_context", "maestro_record_validation", "maestro_request_review", "maestro_record_review",
    "maestro_present_approval", "maestro_record_approval", "maestro_grant_authorization", "maestro_workflows",
    "maestro_arsenal_describe", "maestro_arsenal_execute"],
  budgets: { loads: 0, toolCalls: 128 },
})

/** Called inside the original exclusive operation, before ANY business input or provider work. This writes no
 * permission allow rules. `narrow` intersects the native configured grant and is never repeated or widened.
 */
export const initializeSfRoutinePhaseScope = Effect.fn("SfRoutinePhase.initializeScope")(function* (
  resources: SfRoutineNativeRuntimeResources, runner: SessionRunner.Interface, sessionID: SessionSchema.ID,
) {
  const parent = yield* resources.store.get(sessionID)
  if (!parent || parent.agent !== AgentV2.defaultID) return yield* new ToolFailure({ message: "SF_NATIVE_PHASE_PARENT_MISSING" })
  const engine = yield* ExecutionHost.engineOf(resources.agents, resources.store)(parent)
  // The existing Claude gate recognizes only a successful MCP skill tool settlement, not Runner.skill's genuine
  // synthetic load. Scope.entry is already held, so a duplicate MCP load fails. Do NOT forge that receipt or widen
  // scope: that engine needs a public verified skill-load observer before this scoped parent can be enabled.
  if (engine === "claude-code") return yield* new ToolFailure({ message: "SF_NATIVE_PHASE_GOVERNED_HOST_RECEIPT_API_REQUIRED" })
  if ((yield* resources.permission.evaluate({ sessionID, agent: AgentV2.defaultID, action: "skill", resources: [SF_ROUTINE_PHASE_PLAYBOOK] })) === "deny")
    return yield* new ToolFailure({ message: "SF_NATIVE_PHASE_GOVERNED_PLAYBOOK_DENIED" })
  const missing = SF_ROUTINE_PHASE_SCOPE.tools.filter((name) => !resources.registry.currentRegistrationIdentity(name))
  if (missing.length) return yield* new ToolFailure({ message: `SF_NATIVE_PHASE_CANONICAL_TOOLS_MISSING:${missing.join(",")}` })
  const current = yield* resources.store.scope(sessionID)
  if (current) {
    if (!isDeepStrictEqual(current.scope, SF_ROUTINE_PHASE_SCOPE) || !(yield* hasSfRoutinePhaseMarker(resources.database, sessionID)))
      return yield* new ToolFailure({ message: "SF_NATIVE_PHASE_SCOPE_CHANGED" })
    return
  }
  if (!(yield* runner.skill({ sessionID, skill: SF_ROUTINE_PHASE_PLAYBOOK })))
    return yield* new ToolFailure({ message: "SF_NATIVE_PHASE_GOVERNED_PLAYBOOK_UNAVAILABLE" })
  if (!(yield* runner.skill({ sessionID, skill: SF_ROUTINE_PHASE_MARKER })))
    return yield* new ToolFailure({ message: "SF_NATIVE_PHASE_DENIAL_MARKER_UNAVAILABLE" })
  // Only now is entry really delivered by the original native skill API; never synthesize a SkillLoadReceipt.
  yield* resources.store.narrow(sessionID, SF_ROUTINE_PHASE_SCOPE).pipe(Effect.mapError(() =>
    new ToolFailure({ message: "SF_NATIVE_PHASE_SCOPE_ADMISSION_FAILED" })))
})

export function sfRoutinePhaseArsenalAllowed(invocation: ToolSafety.Invocation, root: SessionSchema.ID) {
  if (invocation.tool === "maestro_arsenal_describe") {
    const request = Schema.decodeUnknownOption(Schema.Struct({ name: Schema.Literal("relay-arm") }))(invocation.args, { onExcessProperty: "error" })
    return Option.isSome(request)
  }
  if (invocation.tool !== "maestro_arsenal_execute") return true
  const request = Schema.decodeUnknownOption(Schema.Struct({ name: Schema.Literal("relay-arm"), arguments: Schema.Struct({
    action: Schema.Literal("arm"), contract: Schema.Struct({ sessionID: Schema.String, label: Schema.NonEmptyString }),
  }) }))(invocation.args, { onExcessProperty: "error" })
  return Option.isSome(request) && request.value.arguments.contract.sessionID === root
}
