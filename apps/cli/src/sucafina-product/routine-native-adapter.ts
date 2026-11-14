import { isDeepStrictEqual } from "node:util"
import { Effect, Option, Schema } from "effect"
import { AgentV2 } from "@orchestra/core/agent"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import { SessionMessage } from "@orchestra/core/session/message"
import { SessionSchema } from "@orchestra/core/session/schema"
import { TaskTool } from "@orchestra/core/tool/task"
import type { ToolRegistry } from "@orchestra/core/tool/registry"
import { GovernanceInputV2 } from "../../../../modules/maestro/coordination/src/v2/governance/input.ts"
import { GovernanceDispatchV2 } from "../../../../modules/maestro/coordination/src/v2/governance/dispatch.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { RoutineResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { routineArtifactDigest } from "../../../../modules/sucafina/Sucafinav1/product/routines/result-access.ts"
import type { RoutineArtifact, RoutineExecutionSnapshot } from "../../../../modules/sucafina/Sucafinav1/product/routines/result-access.ts"
import type { RoutinePublicationHost } from "../../../../modules/sucafina/Sucafinav1/product/routines/publication.ts"
import { readSfRoutineNativeInput, sameSfRoutineNativeOwner } from "./routine-native-input.ts"
import type { SfRoutineNativeInput, SfRoutineNativeOwner } from "./routine-native-input.ts"
import type { createSfRoutineNativeGovernance } from "./routine-native-governance.ts"
import type { NativeAdmission, NativePlan, NativeTerminal } from "./routine-native-records.ts"
import type { SfRoutineNativeRuntimeResources } from "./routine-native-runtime.ts"
import { dispatchSfRoutineNativeTask, withSfRoutineNativeAbort } from "./routine-native-dispatch.ts"
import { routineSourceDigest } from "./routine-services.ts"
import type { SfRoutineNativePort, SfRoutineNativeRecord, SfRoutinePlan, SfRoutineServicesInput } from "./routine-services.ts"

/**
 * A private host capability: resolve must return the SAME live registry object for the authenticated Request.
 * The native Maestro session and its already recorded Task call are distinct from an SF resident profile.
 * This capability cannot be constructed from model input, a session ID in HTTP, or SF_ROUTINE_INPUT alone.
 */
export type SfRoutineNativeOwnerBinding = Readonly<{
  request: Request
  authoritySessionID: SessionSchema.ID
  task?: Readonly<{ assistantMessageID: SessionMessage.ID; toolCallID: string }>
}>
export type SfRoutineNativeOwnerPort = {
  resolve: (context: TrustedDomainContext, request: Request) => Promise<SfRoutineNativeOwnerBinding | undefined>
}

export type SfRoutineNativeAdapterInput = Pick<SfRoutineServicesInput, "resolveCase" | "resolveInputs" | "revalidateSources"> & {
  resources: () => SfRoutineNativeRuntimeResources | undefined
  owners: () => SfRoutineNativeOwnerPort | undefined
  requestFor: (context: TrustedDomainContext) => Request | undefined
  authorize: (context: TrustedDomainContext) => Promise<boolean>
  generation: () => Promise<number | undefined>
  publication: () => RoutinePublicationHost | undefined
  governance: ReturnType<typeof createSfRoutineNativeGovernance>
}

type Scope = {
  resources: SfRoutineNativeRuntimeResources
  owner: SfRoutineNativeOwnerBinding
  metadata: SfRoutineNativeOwner
  context: TrustedDomainContext
  current: () => Promise<boolean>
}
type Failure = Exclude<PortResult<never>, { status: "ok" }>
class Held extends Error {
  constructor(readonly result: Failure) { super(result.reason) }
}
const hold = (status: Failure["status"], reason: string): never => { throw new Held({ status, reason }) }

/** Production C07 projection and Task dispatcher. All durable identities come from native records. */
export function createSfRoutineNativeAdapter(input: SfRoutineNativeAdapterInput) {
  const available = () => {
    const resources = input.resources()
    return !!resources && resources.current() && input.governance.installed(resources.governance) &&
      !!input.owners() && !!input.publication()
  }
  const acquire = async (context: TrustedDomainContext): Promise<Scope> => {
    const resources = input.resources(), owners = input.owners(), request = input.requestFor(context)
    if (!resources || !owners || !resources.current() || !input.governance.installed(resources.governance))
      return hold("unavailable", "native-routine-binding-unavailable")
    if (!request || request.signal.aborted || !await input.authorize(context)) return hold("denied", "routine-authority-unavailable")
    const owner = await owners.resolve(context, request)
    const generation = await input.generation()
    if (!owner || owner.request !== request || !Schema.is(SessionSchema.ID)(owner.authoritySessionID) ||
      generation === undefined || !Number.isSafeInteger(generation) || generation < 0) return hold("unavailable", "native-routine-owner-unavailable")
    const identity = resources.identity
    const metadata: SfRoutineNativeOwner = {
      installationId: identity.installationId, hostId: identity.hostId, projectId: identity.projectId,
      locationId: digestSfValue(identity.location), authoritySessionId: owner.authoritySessionID,
      principalRef: context.binding.principalRef, policyVersion: context.binding.policyVersion,
      accessRevision: context.binding.accessRevision, providerGeneration: generation,
    }
    const ownerDigest = digestSfValue({ authoritySessionID: owner.authoritySessionID, task: owner.task ?? null })
    const current = async () => {
      if (input.resources() !== resources || input.owners() !== owners || !resources.current() ||
        !input.governance.installed(resources.governance) || input.requestFor(context) !== request || request.signal.aborted ||
        context.binding.installationId !== identity.installationId || context.binding.projectId !== identity.projectId ||
        ownerDigest !== digestSfValue({ authoritySessionID: owner.authoritySessionID, task: owner.task ?? null })) return false
      if (context.kind === "native" && (context.binding.hostId !== identity.hostId || context.binding.locationId !== metadata.locationId ||
        context.binding.providerGeneration !== generation)) return false
      if (!await input.authorize(context) || await owners.resolve(context, request) !== owner || await input.generation() !== generation) return false
      return input.resources() === resources && input.owners() === owners && resources.current() && !request.signal.aborted &&
        input.requestFor(context) === request && ownerDigest === digestSfValue({ authoritySessionID: owner.authoritySessionID, task: owner.task ?? null })
    }
    if (!await current()) return hold("denied", "routine-authority-changed")
    const parent = await Effect.runPromise(resources.store.get(owner.authoritySessionID))
    if (!parent || parent.projectID !== identity.projectId || (parent.agent !== undefined && parent.agent !== AgentV2.defaultID) ||
      !isDeepStrictEqual(parent.location, identity.location) || !await current()) return hold("denied", "native-routine-owner-unbound")
    return { resources, owner, metadata, context, current }
  }
  const query = async <A>(context: TrustedDomainContext, read: (scope: Scope) => Promise<A>): Promise<PortResult<A>> => {
    try {
      const scope = await acquire(context)
      const value = await read(scope)
      if (!await scope.current()) return { status: "denied", reason: "routine-authority-changed" }
      return { status: "ok", value }
    } catch (error) {
      if (input.requestFor(context)?.signal.aborted) return { status: "denied", reason: "routine-authority-changed" }
      return error instanceof Held ? error.result : { status: "unavailable", reason: "native-routine-record-unavailable" }
    }
  }

  const checkPlan = async (scope: Scope, plan: NativePlan, mutation: boolean): Promise<SfRoutineNativeInput> => {
    const retained = readSfRoutineNativeInput(plan)
    if (!retained) return hold("unavailable", "native-routine-input-unverified")
    const owner = retained.owner
    if (owner.installationId !== scope.metadata.installationId || owner.projectId !== scope.metadata.projectId ||
      owner.locationId !== scope.metadata.locationId || owner.authoritySessionId !== scope.owner.authoritySessionID ||
      owner.principalRef !== scope.metadata.principalRef) return hold("denied", "native-routine-owner-unbound")
    // Historical receipts can be read under fresh authority. Dispatch requires the exact original generation/policy.
    if (mutation && (!sameSfRoutineNativeOwner(owner, scope.metadata) || !await scope.resources.records.isLatestPlan(plan)))
      return hold("stale", "native-routine-plan-changed")
    const currentCase = await input.resolveCase(scope.context)
    if (currentCase.status !== "ok") throw new Held(currentCase)
    if (!isDeepStrictEqual(currentCase.value, retained.input.caseRef)) return hold("stale", "routine-case-changed")
    if (scope.context.kind === "native" && (scope.context.binding.caseId !== retained.input.caseRef.id ||
      scope.context.binding.caseIncarnation !== retained.input.caseRef.incarnation || scope.context.binding.caseVersion !== retained.input.caseRef.version))
      return hold("denied", "routine-case-unbound")
    const sources = await input.resolveInputs(retained.input.inputRefs, scope.context)
    if (sources.status !== "ok") throw new Held(sources)
    if (routineSourceDigest(sources.value) !== routineSourceDigest(retained.sourceRefs)) return hold("stale", "routine-input-sources-changed")
    const publication = input.publication()
    if (!publication || publication.publication.projectID !== owner.projectId) return hold("unavailable", "routine-publication-port-unavailable")
    if (!await publication.authorize(scope.context)) return hold("denied", "routine-publication-denied")
    const verified = await Effect.runPromise(Effect.result(RelayWorkflowBinding.revalidate(publication.publication, plan.workflowBinding)))
    if (verified._tag === "Failure") return hold("stale", "routine-publication-changed")
    if (input.publication() !== publication || !await input.revalidateSources(retained.sourceRefs, scope.context) || !await scope.current())
      return hold("denied", "routine-authority-changed")
    return retained
  }

  const planValue = (plan: NativePlan, retained: SfRoutineNativeInput): SfRoutinePlan => ({
    documentId: plan.workflowBinding.publication.documentID, publishedVersion: plan.workflowBinding.publication.activeVersionID,
    planRevisionId: plan.id, writeScope: [...plan.workflowBinding.writePaths], workflowParameters: { ...plan.workflowBinding.parameters },
    inputDigest: retained.inputDigest,
  })
  const selectPlan = async (scope: Scope, reference: string, purpose?: string, version?: string) => {
    const plans = await scope.resources.records.listPlans(scope.owner.authoritySessionID)
    const matches = plans.filter((plan) => plan.workflowBinding.publication.documentID === reference &&
      (version === undefined || plan.workflowBinding.publication.activeVersionID === version) &&
      (purpose === undefined || readSfRoutineNativeInput(plan)?.purpose === purpose))
    // The native latest-plan rule is authoritative, even when a newer revision uses another schema/version.
    for (const plan of matches) if (await scope.resources.records.isLatestPlan(plan)) return { plan, retained: await checkPlan(scope, plan, true) }
    return undefined
  }
  const projectRecord = async (scope: Scope, admission: NativeAdmission): Promise<SfRoutineNativeRecord> => {
    const retained = await checkPlan(scope, admission.revision, false)
    let terminal: NativeTerminal | undefined
    if (admission.state === "admitted" && admission.reservation && admission.child)
      terminal = await scope.resources.records.terminal(admission.reservation.childSessionID)
    const base = {
      documentId: admission.revision.workflowBinding.publication.documentID,
      publishedVersion: admission.revision.workflowBinding.publication.activeVersionID,
      principalRef: retained.owner.principalRef, projectId: retained.owner.projectId,
      correlationId: admission.authorizationID, authorizationId: admission.authorizationID,
      sourceRefs: retained.sourceRefs,
    }
    const result: RoutineResult = admission.state === "admitted" && admission.reservation && admission.bound ? {
      ...base, admission: "admitted", admissionRef: admission.reference, admissionVersion: admission.version,
      runRef: admission.reservation.childSessionID, childSessionId: admission.reservation.childSessionID, armRef: admission.bound.token,
      ...(terminal?.state === "completed" && terminal.resultRef ? { resultRef: terminal.resultRef } : {}),
      pending: terminal?.state === "completed" ? [] : [terminal?.state === "failed" || admission.taskStatus === "error"
        ? "native-task-failed" : terminal?.state === "awaiting-human" ? "native-human-action-required" : "native-result-pending"],
    } : {
      ...base, admission: admission.state === "needs-review" ? "needs-review" : "preparing",
      admissionRef: admission.reference, admissionVersion: admission.version,
      pending: [admission.state === "needs-review" ? "native-human-review-and-approval-required" : "native-admission-required"],
    }
    if (!await scope.current()) return hold("denied", "routine-authority-changed")
    return { result, input: retained.input, inputDigest: retained.inputDigest, workflow: admission.revision.workflowBinding }
  }
  const readAdmission = async (scope: Scope, reference: string) => {
    const record = await scope.resources.records.readAdmission(reference)
    if (!record || record.reference !== reference) return hold("unavailable", "native-routine-admission-unavailable")
    await checkPlan(scope, record.revision, false)
    return record
  }
  const readRun = async (scope: Scope, reference: string) => {
    const record = await scope.resources.records.readRun(reference)
    if (!record || record.reservation?.childSessionID !== reference) return hold("unavailable", "native-routine-run-unavailable")
    await checkPlan(scope, record.revision, false)
    return record
  }
  const invocation = async (scope: Scope, admission: NativeAdmission): Promise<ToolRegistry.ExecuteInput> => {
    const task = scope.owner.task
    if (!task || !Schema.is(SessionMessage.ID)(task.assistantMessageID) || !task.toolCallID.trim())
      return hold("unavailable", "native-routine-task-invocation-unavailable")
    const entry = await Effect.runPromise(scope.resources.store.message(task.assistantMessageID))
    if (!entry || entry.sessionID !== scope.owner.authoritySessionID || entry.message.type !== "assistant" ||
      entry.message.agent !== AgentV2.defaultID) return hold("denied", "native-routine-task-owner-unbound")
    const part = entry.message.content.find((part) => part.type === "tool" && part.name === "task" && part.id === task.toolCallID)
    if (!part || part.type !== "tool" || part.provider?.executed || part.state.status === "pending")
      return hold("unavailable", "native-routine-task-invocation-unavailable")
    const decoded = Schema.decodeUnknownOption(Schema.Struct({ ...TaskTool.Input.fields, ...GovernanceInputV2.fields }))(part.state.input, { onExcessProperty: "error" })
    if (Option.isNone(decoded)) return hold("unavailable", "native-routine-task-input-invalid")
    const called = decoded.value, binding = admission.revision.workflowBinding
    if (called.background === true) return hold("unavailable", "native-routine-background-owner-unavailable")
    if (called.authorizationID !== admission.authorizationID || called.workflow?.planRevisionID !== admission.revision.id ||
      called.workflow.documentID !== binding.publication.documentID || !isDeepStrictEqual(called.workflow.parameters, binding.parameters) ||
      !isDeepStrictEqual(called.writePaths ?? [], binding.writePaths) || called.worktree === true ||
      (called.directory !== undefined && called.directory !== scope.resources.location.directory) ||
      GovernanceDispatchV2.taskIntentHash({ subagentType: called.subagent_type, prompt: called.prompt, model: called.model }) !== admission.authorization.taskIntentHash ||
      (admission.bound && (admission.bound.authorityMessageID !== task.assistantMessageID || admission.bound.authorityCallID !== task.toolCallID)))
      return hold("stale", "native-routine-task-input-changed")
    if (!await scope.current()) return hold("denied", "routine-authority-changed")
    return { sessionID: scope.owner.authoritySessionID, agent: AgentV2.defaultID, assistantMessageID: task.assistantMessageID,
      call: { type: "tool-call", id: task.toolCallID, name: "task", input: structuredClone(part.state.input) }, ...(entry.message.model ? { model: entry.message.model } : {}) }
  }

  const port: SfRoutineNativePort = {
    resolvePlan: (recipe, purpose, context) => query(context, async (scope) => {
      const found = await selectPlan(scope, recipe.documentId, purpose, recipe.publishedVersion)
      return found ? planValue(found.plan, found.retained) : null
    }),
    resolveRecipe: (reference, context) => query(context, async (scope) => {
      const found = await selectPlan(scope, reference)
      if (!found) return hold("needs-input", "native-routine-plan-required")
      return planValue(found.plan, found.retained)
    }),
    prepare: (incoming, context) => {
      const request = structuredClone(incoming)
      return query(context, async (scope) => {
        const revision = await scope.resources.records.readPlan(request.input.planRevisionId)
        if (!revision) return hold("needs-input", "native-routine-plan-required")
        const retained = await checkPlan(scope, revision, true)
        if (request.inputDigest !== retained.inputDigest || !isDeepStrictEqual(request.input, retained.input) ||
          routineSourceDigest(request.sourceRefs) !== routineSourceDigest(retained.sourceRefs) || !isDeepStrictEqual(request.workflow, revision.workflowBinding))
          return hold("stale", "native-routine-plan-input-changed")
        const admissions = await scope.resources.records.listAdmissions(revision.id)
        const task = scope.owner.task
        if (!task) return hold("unavailable", "native-routine-task-invocation-unavailable")
        const entry = await Effect.runPromise(scope.resources.store.message(task.assistantMessageID))
        const part = entry?.message.type === "assistant" ? entry.message.content.find((part) => part.type === "tool" && part.id === task.toolCallID) : undefined
        const authorizationID = part?.type === "tool" && part.state.status !== "pending" && typeof part.state.input === "object" && part.state.input !== null && "authorizationID" in part.state.input
          ? part.state.input.authorizationID : undefined
        const admission = admissions.find((admission) => admission.authorizationID === authorizationID)
        if (!admission) return hold("needs-input", "native-human-authorization-required")
        const call = await invocation(scope, admission)
        if (admission.state !== "preparing") return projectRecord(scope, admission)
        const current = async () => { try { await checkPlan(scope, revision, true); return true } catch { return false } }
        const reservation = Effect.acquireUseRelease(
          Effect.sync(() => input.governance.bind(revision.id, { signal: scope.owner.request.signal, current })),
          () => Effect.gen(function* () {
            if (!(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_ROUTINE_NATIVE_AUTHORITY_REVOKED"))
            const called = Schema.decodeUnknownOption(Schema.Struct({ ...TaskTool.Input.fields, ...GovernanceInputV2.fields }))(call.call.input)
            if (Option.isNone(called)) return yield* Effect.fail(new Error("SF_ROUTINE_NATIVE_TASK_INPUT_INVALID"))
            const target = yield* scope.resources.agents.get(AgentV2.ID.make(called.value.subagent_type))
            const parent = yield* scope.resources.store.get(call.sessionID)
            if (!parent || !target || target.hidden || target.mode === "primary" || target.id === AgentV2.defaultID)
              return yield* Effect.fail(new Error("SF_ROUTINE_NATIVE_TARGET_UNAVAILABLE"))
            const stored = yield* scope.resources.store.message(call.assistantMessageID)
            const actual = stored?.message.type === "assistant" ? stored.message.content.find((part) =>
              part.type === "tool" && part.name === "task" && part.id === call.call.id) : undefined
            if (!stored || stored.sessionID !== call.sessionID || stored.message.type !== "assistant" ||
              stored.message.agent !== call.agent || !isDeepStrictEqual(stored.message.model, call.model) ||
              !actual || actual.type !== "tool" || actual.provider?.executed || actual.state.status !== "running" ||
              !isDeepStrictEqual(actual.state.input, call.call.input) || parent.projectID !== scope.metadata.projectId ||
              !isDeepStrictEqual(parent.location, scope.resources.identity.location) || parent.time.archived)
              return yield* Effect.fail(new Error("SF_ROUTINE_NATIVE_TASK_CHANGED"))
            if (!(yield* Effect.promise(current))) return yield* Effect.fail(new Error("SF_ROUTINE_NATIVE_AUTHORITY_REVOKED"))
            return yield* scope.resources.governance.admit({ parent, target, input: called.value,
              context: { sessionID: call.sessionID, agent: call.agent, assistantMessageID: call.assistantMessageID, toolCallID: call.call.id, model: call.model },
              location: scope.resources.location })
          }), (release) => Effect.sync(release))
        const result = await Effect.runPromise(scope.resources.execution.exclusive(call.sessionID,
          withSfRoutineNativeAbort(reservation, scope.owner.request.signal), { wait: false }))
        if (Option.isNone(result)) return hold("conflict", "native-routine-session-busy")
        if (!await current()) return hold("denied", "routine-authority-changed")
        const prepared = await scope.resources.records.readAdmission(admission.authorizationID)
        if (!prepared || prepared.state !== "admitted" || prepared.reservation?.childSessionID !== result.value.childID)
          return hold("unavailable", "native-routine-admission-unverified")
        return projectRecord(scope, prepared)
      })
    },
    readAdmission: (reference, context) => query(context, async (scope) => projectRecord(scope, await readAdmission(scope, reference))),
    readRun: (reference, context) => query(context, async (scope) => projectRecord(scope, await readRun(scope, reference))),
    start: (incoming, context) => {
      const request = structuredClone(incoming)
      return query(context, async (scope) => {
        const admission = await readAdmission(scope, request.admissionRef)
        const retained = await checkPlan(scope, admission.revision, true)
        if (admission.state !== "admitted" || !admission.reservation) return hold("needs-input", "native-routine-admission-required")
        if (request.expectedAdmissionVersion !== admission.version || request.inputDigest !== retained.inputDigest ||
          !isDeepStrictEqual(request.caseRef, retained.input.caseRef)) return hold("stale", "routine-admission-changed")
        const call = await invocation(scope, admission)
        // A terminal native Task is never rerun, including failure. The native exclusive claim handles in-flight retries.
        if (admission.taskStatus === "completed" || admission.taskStatus === "error") return projectRecord(scope, admission)
        const current = async () => { try { await checkPlan(scope, admission.revision, true); return true } catch { return false } }
        const result = await dispatchSfRoutineNativeTask({ resources: scope.resources, invocation: call, current, signal: scope.owner.request.signal,
          bindAuthority: () => input.governance.bind(admission.revision.id, { signal: scope.owner.request.signal, current }) })
        if (result.status !== "ok") throw new Held(result)
        if (!await current()) return hold("denied", "routine-authority-changed")
        const after = await readAdmission(scope, request.admissionRef)
        if (after.version !== admission.version || after.reservation?.childSessionID !== admission.reservation.childSessionID)
          return hold("stale", "native-routine-admission-changed")
        return projectRecord(scope, after)
      })
    },
    listRunRefs: (context) => query(context, async (scope) => {
      const refs = new Set<string>()
      const selectedCase = await input.resolveCase(context)
      if (selectedCase.status !== "ok") throw new Held(selectedCase)
      for (const plan of await scope.resources.records.listPlans(scope.owner.authoritySessionID)) {
        const retained = readSfRoutineNativeInput(plan)
        if (!retained || retained.owner.principalRef !== scope.metadata.principalRef ||
          retained.owner.installationId !== scope.metadata.installationId || retained.owner.projectId !== scope.metadata.projectId ||
          retained.owner.locationId !== scope.metadata.locationId || !isDeepStrictEqual(retained.input.caseRef, selectedCase.value)) continue
        await checkPlan(scope, plan, false)
        for (const admission of await scope.resources.records.listAdmissions(plan.id))
          if (admission.state === "admitted" && admission.reservation) refs.add(admission.reservation.childSessionID)
      }
      return [...refs].sort()
    }),
    readExecution: (reference, context) => query(context, async (scope) => {
      const admission = await readRun(scope, reference)
      const terminal = await scope.resources.records.terminal(reference)
      const artifact = terminal?.state === "completed" ? await artifactFor(scope, terminal) : undefined
      const execution: RoutineExecutionSnapshot = { runRef: reference,
        state: artifact ? "completed" : terminal?.state === "failed" || admission.taskStatus === "error" ? "failed" : "preparing",
        revision: digestSfValue({ admission: admission.reference, version: admission.version, task: admission.taskStatus ?? null,
          terminal: terminal?.state ?? null, checkpoint: terminal?.checkpoint ?? null }),
        ...(artifact ? { resultRef: artifact.resultRef, outputDigest: artifact.outputDigest } : {}) }
      return execution
    }),
    readArtifact: (reference, context) => query(context, async (scope) => {
      const terminal = await scope.resources.records.terminalForResult(reference)
      if (!terminal || terminal.state !== "completed" || terminal.resultRef !== reference) return hold("unavailable", "native-routine-artifact-unavailable")
      return artifactFor(scope, terminal)
    }),
  }
  const artifactFor = async (scope: Scope, terminal: NativeTerminal): Promise<RoutineArtifact> => {
    const retained = await checkPlan(scope, terminal.admission.revision, false)
    const admission = terminal.admission
    if (terminal.state !== "completed" || !terminal.resultRef || !terminal.completedAt || !terminal.checkpoint ||
      !terminal.audit || !terminal.taskResult || !admission.reservation || !admission.bound)
      return hold("unavailable", "native-routine-terminal-unverified")
    // This immutable projection is explicitly a native execution receipt, not a model-authored business report.
    // Both readers reconstruct it independently from completion + settled checkpoint + audited Relay ledger.
    const body: Omit<RoutineArtifact, "outputDigest"> = {
      schema: "sf-routine-artifact-v1", runRef: admission.reservation.childSessionID, resultRef: terminal.resultRef,
      correlationId: admission.authorizationID, documentId: admission.revision.workflowBinding.publication.documentID,
      publishedVersion: admission.revision.workflowBinding.publication.activeVersionID,
      principalRef: retained.owner.principalRef, projectId: retained.owner.projectId, inputDigest: retained.inputDigest,
      sourceRefs: retained.sourceRefs, createdAt: terminal.completedAt,
      content: { schema: "native-task-relay-receipt-v1", authorizationId: admission.authorizationID,
        admissionRef: admission.reference, admissionVersion: admission.version, planRevisionId: admission.revision.id,
        armRef: admission.bound.token, assistantMessageId: terminal.resultRef,
        childSessionId: terminal.taskResult.sessionID, agentId: terminal.taskResult.agentId,
        ledgerSequence: terminal.checkpoint.evaluation?.ledgerSeq ?? null, outcome: "complete", chainIntact: terminal.audit.chain_intact },
    }
    return { ...body, outputDigest: routineArtifactDigest(body) }
  }
  return { port, available, native: () => available() ? port : undefined }
}
