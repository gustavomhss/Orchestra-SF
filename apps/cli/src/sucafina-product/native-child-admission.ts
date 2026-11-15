import { isDeepStrictEqual } from "node:util"
import { ToolFailure } from "@orchestra/llm"
import { AgentV2 } from "@orchestra/core/agent"
import { CapabilityInvocation } from "@orchestra/core/capability/invocation"
import type { Location } from "@orchestra/core/location"
import type { ModelV2 } from "@orchestra/core/model"
import { PermissionV2 } from "@orchestra/core/permission"
import type { Permission } from "@orchestra/schema/permission"
import { SessionSchema } from "@orchestra/core/session/schema"
import type { SessionScope } from "@orchestra/core/session/scope"
import type { SessionStore } from "@orchestra/core/session/store"
import { TaskTool } from "@orchestra/core/tool/task"
import type { TaskGovernance } from "@orchestra/core/tool/task-governance"
import type { Tool } from "@orchestra/core/tool/tool"
import { Effect } from "effect"

/**
 * Mission 110: SF's Task boundary. This module does not issue a Maestro, Request, Permission
 * or provider ticket. Only the mission95 C15 gate, holding its private live root ticket,
 * may implement trace/register below. A caller's IDs or governance receipt never suffice.
 */
export type SfNativeChildRoot = Readonly<{
  kind: "native-root"
  rootSessionID: SessionSchema.ID
  model: ModelV2.Ref
  location: Location.Ref
  contextBudgetTokens: number
  policyVersion: string
  expiresAt: string
  /** The live C09/routines.run Request signal, owned by the root producer. */
  signal: AbortSignal
  /** Rechecks the root's private C15 ticket, C09 principal, Request and current policy. */
  current: () => Effect.Effect<boolean, unknown>
}>

export type SfNativeChildTrace =
  | Readonly<{ kind: "outside" }>
  | Readonly<{ kind: "blocked" }>
  | SfNativeChildRoot

export type SfNativeChildBound = Readonly<{
  rootSessionID: SessionSchema.ID
  parentSessionID: SessionSchema.ID
  childSessionID: SessionSchema.ID
  targetAgentID: AgentV2.ID
  invocation: Readonly<{
    assistantMessageID: Tool.Context["assistantMessageID"]
    toolCallID: string
  }>
  model: ModelV2.Ref
  location: Location.Ref
  scope: SessionScope.Scope
  contextBudgetTokens: number
  expiresAt: string
  signal: AbortSignal
  /** Checks persisted Task, Session, lineage, permissions, request, budget and C15 again. */
  current: () => Effect.Effect<boolean>
}>

export type SfNativeChildTicket = Readonly<{
  /** Must fail on expiry, Request abort, gate disposal, changed root/child or policy. */
  current: () => Effect.Effect<boolean, unknown>
  /** Revokes an actual gate-owned model/provider binding, not only this component's map. */
  revoke: () => void
}>

export type SfNativeChildC15 = Readonly<{
  /** Private root ticket / SF-lineage classification; "outside" only for verifiably non-SF. */
  trace: (parentSessionID: SessionSchema.ID) => Effect.Effect<SfNativeChildTrace, unknown>
  /** Registers a persisted genuine child at the native model/budget transport gate. */
  register: (binding: SfNativeChildBound) => Effect.Effect<SfNativeChildTicket | undefined, unknown>
}>

export type SfNativeChildDeps = Readonly<{
  upstream: TaskGovernance.Interface
  store: SessionStore.Interface
  permissions: Pick<PermissionV2.Interface, "forSession">
  c15: SfNativeChildC15
}>

type ChildEntry = {
  readonly childID: SessionSchema.ID
  readonly context: Tool.Context
  readonly input: { readonly [key: string]: unknown }
  readonly target: AgentV2.ID
  readonly parentID: SessionSchema.ID
  readonly root: SfNativeChildRoot
  readonly scope: SessionScope.Scope
  onAbort: () => void
  ticket?: SfNativeChildTicket
  closed: boolean
}

const denied = (reason: string) => new ToolFailure({ message: "SF native Task child denied: " + reason })
const sameModel = (a: ModelV2.Ref | undefined, b: ModelV2.Ref | undefined) =>
  !!a && !!b && a.providerID === b.providerID && a.id === b.id &&
  (a.variant ?? "default") === (b.variant ?? "default")
const sameLocation = (a: Location.Ref, b: Location.Ref) =>
  a.directory === b.directory && a.workspaceID === b.workspaceID
const stillCurrent = (root: SfNativeChildRoot) =>
  !root.signal.aborted && Number.isFinite(Date.parse(root.expiresAt)) &&
  Date.now() < Date.parse(root.expiresAt) &&
  Number.isSafeInteger(root.contextBudgetTokens) && root.contextBudgetTokens > 0 &&
  root.contextBudgetTokens <= 24_000

const safeRoot = (root: SfNativeChildTrace, parent: SessionSchema.Info) =>
  root.kind === "native-root" && parent.id === root.rootSessionID &&
  parent.agent === AgentV2.defaultID && !parent.parentID && !parent.time.archived &&
  sameModel(parent.model, root.model) && sameLocation(parent.location, root.location) &&
  !!root.policyVersion.trim() && stillCurrent(root)

function childScope(root: SessionScope.Scope): SessionScope.Scope {
  // A direct child does not inherit Task, SF write/approval, MCP or shell tools. Parent
  // Scope is an upper bound, not a grant. Only bounded inspection tools can survive.
  const read = new Set(["read", "grep", "glob", "list"])
  const tools = root.tools.filter((tool) => read.has(tool))
  return Object.freeze({
    skills: { entry: "sf-native-child-c15-provenance-v1", allow: [] },
    tools: [...new Set(tools)],
    budgets: Object.freeze({ loads: 0, toolCalls: Math.max(1, Math.min(4, root.budgets.toolCalls)) }),
  })
}

function restrictChildPermissions(
  parent: Permission.Ruleset,
  admitted: Permission.Ruleset,
): Permission.Ruleset {
  // TaskPermission.inheritedPermissions copies parent's denies, not a Scope. Never
  // relay an allow from a native governance or a fixture into a SF child's grant.
  const rules = [
    ...parent.filter((rule) => rule.effect === "deny" || rule.action === "external_directory"),
    ...admitted.filter((rule) => rule.effect === "deny" || rule.action === "external_directory"),
    ...["task", "sf_*", "mcp_*", "bash", "write", "edit", "external_directory"].map((action) =>
      ({ action, resource: "*", effect: "deny" as const })),
  ]
  return rules.filter((rule, index) => rules.findIndex((item) =>
    item.action === rule.action && item.resource === rule.resource && item.effect === rule.effect) === index)
}

/** Check the original core-issued frame and persisted *running* Task before upstream governance. */
const originalTask = Effect.fn("SfNativeChild.originalTask")(function* (
  store: SessionStore.Interface,
  context: Tool.Context,
  input: { readonly [key: string]: unknown },
  parent: SessionSchema.Info,
) {
  const frame = yield* CapabilityInvocation.require(context, {
    projectID: parent.projectID, location: parent.location,
  }).pipe(Effect.mapError(() => denied("core-frame-required")))
  if (frame.issuer !== "core" || frame.rootToolName !== TaskTool.name ||
    frame.lineage.length !== 0 ||
    !isDeepStrictEqual(frame.invocation, frame.rootInvocation) ||
    frame.owner.sessionID !== parent.id ||
    frame.owner.agentID !== AgentV2.defaultID ||
    frame.owner.projectID !== parent.projectID ||
    !sameLocation(frame.owner.location, parent.location) ||
    frame.invocation.assistantMessageID !== context.assistantMessageID ||
    frame.invocation.callID !== context.toolCallID)
    return yield* denied("core-lineage-mismatch")
  const target = typeof input.subagent_type === "string" ? input.subagent_type : ""
  const targets = [target, ...(typeof input.model === "string" ? [input.model] : [])]
  if (!target || targets.some((resource) =>
    PermissionV2.evaluate(TaskTool.name, resource, frame.nativeDenyFloor).effect === "deny" ||
    PermissionV2.evaluate(TaskTool.name, resource, frame.effectiveRules).effect === "deny"))
    return yield* denied("native-task-policy-denied")
  const stored = yield* store.message(context.assistantMessageID)
  if (stored?.sessionID !== parent.id || stored.message.type !== "assistant" ||
    stored.message.agent !== AgentV2.defaultID ||
    !sameModel(stored.message.model, parent.model) || stored.message.error)
    return yield* denied("persisted-assistant-mismatch")
  const parts = stored.message.content.filter((part) =>
    part.type === "tool" && part.id === context.toolCallID && part.name === TaskTool.name)
  const call = parts[0]
  if (parts.length !== 1 || !call || call.type !== "tool" ||
    call.provider?.executed || call.state.status !== "running" ||
    !isDeepStrictEqual(call.state.input, input))
    return yield* denied("persisted-task-not-running")
  return frame
})

/**
 * Wrap the *existing* native Maestro governance; do not install allowAll, replace
 * engines or create a second Task dispatcher. The root C15 gate owns classification,
 * child ticket registration and transport fencing. Without it, children are denied.
 *
 * The map is a process-local bind for a live original Task, not durable authority.
 * Reload cannot resurrect it. A new human continuation must go through producer95.
 */
export function createSfNativeChildAdmission(deps: SfNativeChildDeps) {
  const entries = new Map<SessionSchema.ID, ChildEntry>()
  let disposed = false
  const trace = (id: SessionSchema.ID) =>
    deps.c15.trace(id).pipe(Effect.catch(() => Effect.succeed({ kind: "blocked" as const })))

  const release = (entry: ChildEntry) => {
    if (entry.closed) return
    entry.closed = true
    entry.root.signal.removeEventListener("abort", entry.onAbort)
    if (entries.get(entry.childID) === entry) entries.delete(entry.childID)
    entry.ticket?.revoke()
  }
  const rootNow = (root: SfNativeChildRoot) => Effect.gen(function* () {
    if (disposed || !stillCurrent(root)) return false
    return (yield* root.current().pipe(Effect.catch(() => Effect.succeed(false)))) === true &&
      !disposed && stillCurrent(root)
  })
  const originalStill = (entry: ChildEntry) => Effect.gen(function* () {
    const parent = yield* deps.store.get(entry.parentID)
    if (!parent || parent.time.archived || parent.parentID ||
      parent.agent !== AgentV2.defaultID ||
      !sameLocation(parent.location, entry.root.location) ||
      !sameModel(parent.model, entry.root.model) ||
      !(yield* rootNow(entry.root))) return false
    const currentRoot = yield* trace(parent.id)
    if (currentRoot.kind !== "native-root" ||
      currentRoot.rootSessionID !== entry.root.rootSessionID ||
      currentRoot.signal !== entry.root.signal ||
      currentRoot.policyVersion !== entry.root.policyVersion ||
      currentRoot.expiresAt !== entry.root.expiresAt ||
      !sameModel(currentRoot.model, entry.root.model) ||
      !(yield* rootNow(currentRoot))) return false
    const stored = yield* deps.store.message(entry.context.assistantMessageID)
    if (stored?.sessionID !== parent.id || stored.message.type !== "assistant" ||
      stored.message.agent !== AgentV2.defaultID || stored.message.error ||
      !sameModel(stored.message.model, entry.root.model)) return false
    const parts = stored.message.content.filter((part) => part.type === "tool" &&
      part.name === TaskTool.name && part.id === entry.context.toolCallID)
    const part = parts[0]
    return parts.length === 1 && !!part && part.type === "tool" &&
      !part.provider?.executed && part.state.status === "running" &&
      isDeepStrictEqual(part.state.input, entry.input) &&
      entries.get(entry.childID) === entry && !entry.closed
  })
  const childNow = (entry: ChildEntry) => Effect.gen(function* () {
    if (!(yield* originalStill(entry))) return false
    const child = yield* deps.store.get(entry.childID)
    if (!child || child.id !== entry.childID || child.parentID !== entry.parentID ||
      child.agent !== entry.target || child.time.archived || child.projectID !==
      (yield* deps.store.get(entry.parentID))?.projectID ||
      !sameLocation(child.location, entry.root.location) ||
      !sameModel(child.model, entry.root.model)) return false
    const scoped = yield* deps.store.scope(child.id)
    const pendingChild = yield* deps.permissions.forSession(child.id)
    const pendingParent = yield* deps.permissions.forSession(entry.parentID)
    return !!scoped && isDeepStrictEqual(scoped.scope, entry.scope) &&
      pendingChild.length === 0 && pendingParent.length === 0 &&
      (yield* originalStill(entry))
  })

  const service: TaskGovernance.Interface = {
    input: deps.upstream.input,
    roster: deps.upstream.roster,
    admit: (invocation) => Effect.gen(function* () {
      if (disposed) return yield* denied("disposed")
      const root = yield* trace(invocation.parent.id)
      if (root.kind === "outside") return yield* deps.upstream.admit(invocation)
      if (!safeRoot(root, invocation.parent) || root.kind !== "native-root" ||
        !(yield* rootNow(root))) return yield* denied("root-c15-unavailable")
      if (invocation.context.sessionID !== invocation.parent.id ||
        invocation.context.agent !== AgentV2.defaultID ||
        invocation.parent.projectID === undefined ||
        !sameLocation(invocation.parent.location, root.location) ||
        invocation.input.worktree === true || invocation.input.background === true ||
        invocation.input.task_id !== undefined ||
        (invocation.input.directory !== undefined && invocation.input.directory !== root.location.directory))
        return yield* denied("delegation-or-continuation-unavailable")
      // The exact selected model must be the root's previously admitted model. Task
      // will resolve/verify its real model, and beforeTurn checks the recorded child.
      const wanted = invocation.input.model
      if (wanted !== undefined && wanted !== root.model.providerID + "/" + root.model.id)
        return yield* denied("requested-model-outside-c15")
      if (invocation.target.model && !sameModel(invocation.target.model, root.model))
        return yield* denied("target-model-outside-c15")
      if (!(yield* deps.store.get(invocation.parent.id))) return yield* denied("parent-not-persisted")
      yield* originalTask(deps.store, invocation.context, invocation.input, invocation.parent)
      const parentScope = yield* deps.store.scope(invocation.parent.id)
      if (!parentScope || !parentScope.scope.tools.includes(TaskTool.name) ||
        !Number.isSafeInteger(parentScope.scope.budgets.toolCalls) ||
        parentScope.toolCalls > parentScope.scope.budgets.toolCalls)
        return yield* denied("root-task-scope-unavailable")
      // A pending Permission is NOT approved by this hook: core's TaskTool.assert
      // remains the only route to the actual human Permission UI.
      const admitted = yield* deps.upstream.admit(invocation)
      if (admitted.background) return yield* denied("background-not-admitted")
      if (!(yield* rootNow(root))) return yield* denied("root-revoked-during-admission")
      const existingRoot = yield* trace(invocation.parent.id)
      if (existingRoot.kind !== "native-root" || existingRoot.signal !== root.signal ||
        existingRoot.policyVersion !== root.policyVersion ||
        !(yield* rootNow(existingRoot)))
        return yield* denied("root-rebound-during-admission")
      const childID = admitted.childID ?? TaskTool.taskChildID(invocation.context)
      if (!childID || entries.size >= 64 ||
        (yield* deps.store.get(childID)) !== undefined || entries.has(childID))
        return yield* denied("child-identity-or-replay-conflict")
      const scope = childScope(parentScope.scope)
      const parentRules = yield* deps.store.permissions(invocation.parent.id)
      const policies = restrictChildPermissions(parentRules, admitted.permissions ?? [])
      const entry: ChildEntry = {
        childID, context: invocation.context, input: structuredClone(invocation.input),
        target: invocation.target.id, parentID: invocation.parent.id,
        root, scope, closed: false, onAbort: () => {},
      }
      entry.onAbort = () => release(entry)
      root.signal.addEventListener("abort", entry.onAbort, { once: true })
      if (root.signal.aborted) {
        release(entry)
        return yield* denied("root-request-aborted")
      }
      entries.set(childID, entry)
      return { ...admitted, childID, permissions: policies }
    }),
    beforeTurn: (session) => Effect.gen(function* () {
      if (disposed) return yield* denied("disposed")
      if (!session.parentID) return yield* deps.upstream.beforeTurn(session)
      const original = entries.get(session.id)
      if (!original) {
        const classification = yield* trace(session.parentID)
        if (classification.kind !== "outside") return yield* denied("child-not-admitted-by-original-task")
        return yield* deps.upstream.beforeTurn(session)
      }
      if (!(yield* originalStill(original))) {
        release(original)
        return yield* denied("original-task-or-c15-revoked")
      }
      if (session.id !== original.childID || session.parentID !== original.parentID ||
        session.agent !== original.target || !sameModel(session.model, original.root.model) ||
        !sameLocation(session.location, original.root.location))
        return yield* denied("foreign-child-or-model")
      const persisted = yield* deps.store.get(session.id)
      if (!persisted || persisted.parentID !== session.parentID || persisted.agent !== session.agent ||
        persisted.projectID !== session.projectID || !sameModel(persisted.model, session.model) ||
        persisted.time.archived)
        return yield* denied("child-persisted-state-invalid")
      const beforeScope = yield* deps.store.scope(session.id)
      if (beforeScope && !isDeepStrictEqual(beforeScope.scope, original.scope))
        return yield* denied("child-scope-conflict")
      if (!beforeScope) {
        const narrow = yield* Effect.result(deps.store.narrow(session.id, original.scope))
        if (narrow._tag !== "Success") return yield* denied("child-scope-write-failed")
      }
      if (!(yield* childNow(original))) return yield* denied("child-authority-lost-before-register")
      if (!original.ticket) {
        // Missing C15 registration MUST remain a refusal; never return a mock
        // ticket from this module or route directly through the Catalog model.
        const bound: SfNativeChildBound = Object.freeze({
          rootSessionID: original.root.rootSessionID,
          parentSessionID: original.parentID,
          childSessionID: session.id,
          targetAgentID: original.target,
          invocation: Object.freeze({
            assistantMessageID: original.context.assistantMessageID,
            toolCallID: original.context.toolCallID,
          }),
          model: original.root.model,
          location: original.root.location,
          scope: original.scope,
          contextBudgetTokens: original.root.contextBudgetTokens,
          expiresAt: original.root.expiresAt,
          signal: original.root.signal,
          current: () => childNow(original),
        })
        const ticket = yield* deps.c15.register(bound).pipe(Effect.catch(() => Effect.succeed(undefined)))
        if (!ticket) return yield* denied("child-c15-ticket-unavailable")
        original.ticket = ticket
      }
      if (!(yield* original.ticket.current().pipe(Effect.catch(() => Effect.succeed(false)))) ||
        !(yield* childNow(original))) {
        release(original)
        return yield* denied("child-c15-revoked")
      }
      yield* deps.upstream.beforeTurn(session)
      if (!(yield* original.ticket.current().pipe(Effect.catch(() => Effect.succeed(false)))) ||
        !(yield* childNow(original))) {
        release(original)
        return yield* denied("child-authority-changed-during-governance")
      }
    }),
    settle: (outcome) => Effect.gen(function* () {
      const entry = entries.get(outcome.child.id)
      if (!entry) {
        const classified = yield* trace(outcome.context.sessionID)
        if (classified.kind !== "outside") return yield* denied("unadmitted-child-settlement")
        return yield* deps.upstream.settle(outcome)
      }
      return yield* Effect.gen(function* () {
        if (!(yield* childNow(entry)) ||
          !entry.ticket ||
          !(yield* entry.ticket.current().pipe(Effect.catch(() => Effect.succeed(false)))))
          return yield* denied("child-settlement-no-longer-authorized")
        const result = yield* deps.upstream.settle(outcome)
        if (!(yield* childNow(entry)) ||
          !(yield* entry.ticket.current().pipe(Effect.catch(() => Effect.succeed(false)))))
          return yield* denied("child-settlement-revoked")
        return result
      }).pipe(Effect.ensuring(Effect.sync(() => release(entry))))
    }),
  }
  return {
    service,
    dispose: () => {
      disposed = true
      for (const entry of [...entries.values()]) release(entry)
    },
    /** Diagnostic only; never a readiness/authorization predicate. */
    pendingCount: () => entries.size,
  }
}
