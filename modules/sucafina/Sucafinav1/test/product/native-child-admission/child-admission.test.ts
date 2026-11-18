import { expect, test } from "bun:test"
import { Effect } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { CapabilityInvocation } from "@orchestra/core/capability/invocation"
import type { Location } from "@orchestra/core/location"
import type { ModelV2 } from "@orchestra/core/model"
import { Project } from "@orchestra/core/project"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { SessionScope } from "@orchestra/core/session/scope"
import type { SessionStore } from "@orchestra/core/session/store"
import { TaskTool } from "@orchestra/core/tool/task"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import type { Tool } from "@orchestra/core/tool/tool"
import { createSfNativeChildAdmission } from "../../../../../../apps/cli/src/sucafina-product/native-child-admission.ts"
import type { SfNativeChildRoot, SfNativeChildTrace } from "../../../../../../apps/cli/src/sucafina-product/native-child-admission.ts"

/**
 * Mission110 COMPONENT-ONLY fixtures. Even CapabilityInvocation.withContext below
 * is a synthetic issued frame: these tests never prove a hosted Task, human approval,
 * real C09 origin, provider transport, final C15, Relay, watch or readiness.
 */
function fixture() {
  const rootID = SessionSchema.ID.create()
  const messageID = SessionMessage.ID.create()
  const projectID = Project.ID.make("sf-test-110")
  const location = { directory: "/sf110-component" } as Location.Ref
  const model = { providerID: "openai", id: "gpt-5" } as ModelV2.Ref
  const otherModel = { providerID: "anthropic", id: "claude-3" } as ModelV2.Ref
  const context: Tool.Context = {
    sessionID: rootID, agent: AgentV2.defaultID,
    assistantMessageID: messageID, toolCallID: "call-original-110", model,
  }
  const childID = TaskTool.taskChildID(context)
  const targetID = AgentV2.ID.make("charlie")
  const called: Record<string, unknown> = {
    description: "Read case metadata", prompt: "Read only.", subagent_type: targetID,
  }
  const root = {
    id: rootID, projectID, agent: AgentV2.defaultID, model, location,
    title: "component-only root", cost: 0, time: { created: 1, updated: 1 },
  } as unknown as SessionSchema.Info
  const child = {
    ...root, id: childID, parentID: rootID, agent: targetID,
    title: "component-only child",
  } as SessionSchema.Info
  const children = new Map<string, SessionSchema.Info>([[rootID, root]])
  const scopes = new Map<string, SessionScope.State>([[
    rootID, SessionScope.initial({ skills: { entry: "sf-native-maestro-c15-provenance-v1", allow: [] },
      tools: ["task", "read", "grep"], budgets: { loads: 0, toolCalls: 4 } }),
  ]])
  const permissions = new Map<string, ReadonlyArray<unknown>>()
  let taskState: "running" | "pending" | "completed" = "running"
  let providerExecuted = false
  let assistantModel: ModelV2.Ref = model
  let classified: "native" | "blocked" | "outside" = "native"
  let enabled = true
  let issued = false
  let revoked = false
  let registerEnabled = true
  let registerCalls = 0
  let revokeCalls = 0
  let parentExpires = new Date(Date.now() + 90_000).toISOString()
  const controller = new AbortController()
  const origin: SfNativeChildRoot = {
    kind: "native-root", rootSessionID: rootID, model, location,
    contextBudgetTokens: 8_192, policyVersion: "policy-110",
    get expiresAt() { return parentExpires },
    signal: controller.signal, current: () => Effect.succeed(enabled && !revoked),
  }
  const store = {
    get: (id: SessionSchema.ID) => Effect.sync(() => children.get(id)),
    scope: (id: SessionSchema.ID) => Effect.sync(() => scopes.get(id)),
    narrow: (id: SessionSchema.ID, scope: SessionScope.Scope) => Effect.sync(() => {
      if (!children.has(id) || scopes.has(id)) throw new Error("Synthetic store rejects scope replacement")
      scopes.set(id, SessionScope.initial(scope))
    }),
    message: (id: SessionMessage.ID) => Effect.sync(() => id !== messageID ? undefined : ({
      sessionID: rootID, message: {
        id: messageID, type: "assistant", agent: AgentV2.defaultID,
        model: assistantModel,
        content: [{
          type: "tool", id: context.toolCallID, name: TaskTool.name,
          provider: { executed: providerExecuted },
          state: { status: taskState, input: structuredClone(called), structured: {}, content: [] },
        }],
      },
    })),
    permissions: () => Effect.succeed([
      { action: "external_directory", resource: "*", effect: "deny" as const },
      { action: "write", resource: "*", effect: "deny" as const },
    ]),
  } as unknown as SessionStore.Interface
  const c15 = {
    trace: () => Effect.succeed(classified === "native" ? origin :
      { kind: classified } as SfNativeChildTrace),
    register: () => Effect.sync(() => {
      ++registerCalls
      if (!registerEnabled) return undefined
      issued = true
      return {
        current: () => Effect.succeed(enabled && !revoked && issued && !controller.signal.aborted),
        revoke: () => { issued = false; ++revokeCalls },
      }
    }),
  }
  const admission = createSfNativeChildAdmission({
    upstream: TaskGovernance.allowAll,
    store,
    permissions: { forSession: (id) => Effect.succeed(permissions.get(id) ?? []) } as
      unknown as Parameters<typeof createSfNativeChildAdmission>[0]["permissions"],
    c15,
  })
  const input = () => ({ parent: root, target: { id: targetID, model: undefined } as
    Parameters<typeof TaskGovernance.allowAll.admit>[0]["target"],
    input: called, context })
  const frame = {
    issuer: "core" as const,
    owner: { projectID, location, sessionID: rootID, agentID: AgentV2.defaultID },
    invocation: { sessionID: rootID, agentID: AgentV2.defaultID,
      assistantMessageID: messageID, callID: context.toolCallID },
    rootToolName: "task", nativeDenyFloor: [], effectiveRules: [],
  } satisfies CapabilityInvocation.HostInput
  const admit = () => Effect.runPromise(CapabilityInvocation.withContext(frame, admission.service.admit(input())))
  return {
    root, child, model, otherModel, context, called, childID, controller, admit,
    admission, children, scopes, permissions, origin,
    setClassified: (kind: typeof classified) => { classified = kind },
    setEnabled: (next: boolean) => { enabled = next },
    setExpired: () => { parentExpires = new Date(Date.now() - 1_000).toISOString() },
    setTaskState: (next: typeof taskState) => { taskState = next },
    setExecuted: (next: boolean) => { providerExecuted = next },
    setAssistantModel: (next: ModelV2.Ref) => { assistantModel = next },
    setRegisterEnabled: (next: boolean) => { registerEnabled = next },
    setPendingPermission: (id: string) => { permissions.set(id, [{}]) },
    setRevoked: (next: boolean) => { revoked = next },
    issued: () => issued, registerCalls: () => registerCalls, revokeCalls: () => revokeCalls,
    persistChild: () => children.set(childID, child),
  }
}

test("unauthorized/native-inactive root never falls through to allowAll", async () => {
  const f = fixture()
  f.setClassified("blocked")
  await expect(f.admit()).rejects.toThrow("root-c15-unavailable")
  f.setClassified("native")
  f.setEnabled(false)
  await expect(f.admit()).rejects.toThrow("root-c15-unavailable")
  expect(f.registerCalls()).toBe(0)
})

test("core frame, persisted running Task and real model must agree; fixture ID is not authority", async () => {
  const f = fixture()
  await expect(Effect.runPromise(f.admission.service.admit({
    parent: f.root, target: { id: AgentV2.ID.make("charlie") } as
      Parameters<typeof TaskGovernance.allowAll.admit>[0]["target"],
    input: f.called, context: f.context,
  }))).rejects.toThrow("core-frame-required")
  f.setTaskState("completed")
  await expect(f.admit()).rejects.toThrow("persisted-task-not-running")
  f.setTaskState("running")
  f.setExecuted(true)
  await expect(f.admit()).rejects.toThrow("persisted-task-not-running")
  f.setExecuted(false)
  f.setAssistantModel(f.otherModel)
  await expect(f.admit()).rejects.toThrow("persisted-assistant-mismatch")
  expect(f.registerCalls()).toBe(0)
})

test("expired and aborted original Request cannot admit a child", async () => {
  const f = fixture()
  f.setExpired()
  await expect(f.admit()).rejects.toThrow("root-c15-unavailable")
  const g = fixture()
  g.controller.abort()
  await expect(g.admit()).rejects.toThrow("root-c15-unavailable")
  expect(g.registerCalls()).toBe(0)
})

test("Task selection of another model and self-chosen task_id are never child authority", async () => {
  const f = fixture()
  f.called.model = "anthropic/claude-3"
  await expect(f.admit()).rejects.toThrow("requested-model-outside-c15")
  delete f.called.model
  f.called.task_id = "ses_attacker"
  await expect(f.admit()).rejects.toThrow("delegation-or-continuation-unavailable")
  expect(f.registerCalls()).toBe(0)
})

test("child must be persisted under the exact parent with the root model", async () => {
  const f = fixture()
  await f.admit()
  f.persistChild()
  await expect(Effect.runPromise(f.admission.service.beforeTurn({
    ...f.child, model: f.otherModel,
  }))).rejects.toThrow("foreign-child-or-model")
  expect(f.registerCalls()).toBe(0)
  f.admission.dispose()
})

test("an unbound foreign child of a native root cannot start a provider", async () => {
  const f = fixture()
  const foreign = { ...f.child, id: SessionSchema.ID.create() }
  await expect(Effect.runPromise(f.admission.service.beforeTurn(foreign)))
    .rejects.toThrow("child-not-admitted-by-original-task")
})

test("no C15 ticket: child remains denied even when Task, core frame and scope are synthetic green", async () => {
  const f = fixture()
  await f.admit()
  f.persistChild()
  f.setRegisterEnabled(false)
  await expect(Effect.runPromise(f.admission.service.beforeTurn(f.child)))
    .rejects.toThrow("child-c15-ticket-unavailable")
  expect(f.registerCalls()).toBe(1)
  expect(f.issued()).toBe(false)
  f.admission.dispose()
})

test("pending Permission is never replied by SF; it blocks child provider admission", async () => {
  const f = fixture()
  await f.admit()
  f.persistChild()
  f.setPendingPermission(f.childID)
  await expect(Effect.runPromise(f.admission.service.beforeTurn(f.child)))
    .rejects.toThrow("child-authority-lost-before-register")
  expect(f.registerCalls()).toBe(0)
  f.admission.dispose()
})

test("component ticket can narrow only, then revocation fails closed and revokes binding", async () => {
  const f = fixture()
  await f.admit()
  f.persistChild()
  await Effect.runPromise(f.admission.service.beforeTurn(f.child))
  const scoped = f.scopes.get(f.childID)
  expect(scoped?.scope.tools).toEqual(["read", "grep"])
  expect(scoped?.scope.budgets).toEqual({ loads: 0, toolCalls: 4 })
  expect(f.issued()).toBe(true)
  f.setRevoked(true)
  await expect(Effect.runPromise(f.admission.service.beforeTurn(f.child)))
    .rejects.toThrow("original-task-or-c15-revoked")
  expect(f.revokeCalls()).toBe(1)
  expect(f.issued()).toBe(false)
})

test("abort after admission revokes scope/ticket, and disposal does not resurrect authority", async () => {
  const f = fixture()
  await f.admit()
  f.persistChild()
  await Effect.runPromise(f.admission.service.beforeTurn(f.child))
  f.controller.abort()
  expect(f.issued()).toBe(false)
  expect(f.revokeCalls()).toBe(1)
  await expect(Effect.runPromise(f.admission.service.beforeTurn(f.child)))
    .rejects.toThrow("child-not-admitted-by-original-task")
  f.admission.dispose()
  await expect(f.admit()).rejects.toThrow("disposed")
})

test("persisted foreign child parent, archived state and prior scope cannot be adopted", async () => {
  const f = fixture()
  await f.admit()
  f.children.set(f.childID, { ...f.child, parentID: SessionSchema.ID.create() })
  await expect(Effect.runPromise(f.admission.service.beforeTurn(f.child)))
    .rejects.toThrow("child-persisted-state-invalid")
  f.admission.dispose()
  const g = fixture()
  await g.admit()
  g.children.set(g.childID, { ...g.child, time: { ...g.child.time, archived: 100 } })
  await expect(Effect.runPromise(g.admission.service.beforeTurn(g.child)))
    .rejects.toThrow("child-persisted-state-invalid")
  g.admission.dispose()
})

test("outside-SF Task keeps the installed upstream governance behavior, no native C15 ticket", async () => {
  const f = fixture()
  f.setClassified("outside")
  const value = await f.admit()
  expect(value).toEqual({})
  expect(f.registerCalls()).toBe(0)
  f.admission.dispose()
})
