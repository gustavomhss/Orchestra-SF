import { Effect, Layer } from "effect"
import { ToolFailure } from "@orchestra/llm"
import { Database } from "@orchestra/core/database/database"
import type { Host } from "@orchestra/core/host"
import { Location } from "@orchestra/core/location"
import { Relay } from "@orchestra/core/relay"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import type { SessionSchema } from "@orchestra/core/session/schema"
import { ToolSafety } from "@orchestra/core/tool-safety"
import { TaskGovernance } from "@orchestra/core/tool/task-governance"
import { ArmState } from "../../../../modules/relay/src/arm/state.ts"
import { MaestroGovernanceV2 } from "../../../../modules/maestro/coordination/src/v2/governance.ts"
import { GovernanceRecordsV2 } from "../../../../modules/maestro/coordination/src/v2/governance/records.ts"
import { WriteRootsV2 } from "../../../../modules/maestro/coordination/src/v2/governance/write-roots.ts"
import { WorkflowRecordsV2 } from "../../../../modules/maestro/coordination/src/v2/workflow/records.ts"
import { readSfRoutineNativeInput, SF_ROUTINE_INPUT_PARAMETER } from "./routine-native-input.ts"
import type { NativePlan } from "./routine-native-records.ts"

export type SfRoutineNativeGovernanceRecords = {
  readonly readPlan: (planRevisionId: string) => Promise<NativePlan | undefined>
}

export type SfRoutineNativeAuthorityLease = {
  /** Revalidates the actual Request, owner, case, sources and current provider generation. */
  readonly current: () => Promise<boolean>
  readonly signal: AbortSignal
}

export type SfRoutineNativeGovernanceInstallation = {
  readonly epoch: number
  readonly projectId: string
  readonly directory: string
}

type Lease = SfRoutineNativeAuthorityLease & { release: () => void }
type Checked = {
  readonly plan: NativePlan
  readonly records: SfRoutineNativeGovernanceRecords
  readonly lease: Lease
  readonly active: () => boolean
}

/**
 * Adds current SF authority to Maestro's existing Task hooks. The only mutable entries are short-lived authority
 * capabilities keyed by a native revision; Task/Relay remain the sole source of admissions, children and results.
 * This contribution belongs after Maestro's replacements. It builds Maestro's actual implementation with its
 * original dependencies; making TaskGovernance itself a dependency would instead create a replacement cycle.
 */
export function createSfRoutineNativeGovernance(input: {
  readonly records: () => SfRoutineNativeGovernanceRecords | undefined
}) {
  const leases = new Map<string, Lease>()
  const installations = new WeakMap<TaskGovernance.Interface, SfRoutineNativeGovernanceInstallation>()
  const safeties = new WeakSet<ToolSafety.Interface>()
  const relays = new WeakSet<Relay.Interface>()
  let epoch = 0

  const bind = (planRevisionId: string, authority: SfRoutineNativeAuthorityLease): (() => void) => {
    // This is a capability registration, never an allocation of a plan or an admission identity.
    if (!planRevisionId.startsWith("evt_maestro_plan_revision_")) throw new Error("SF_ROUTINE_NATIVE_PLAN_INVALID")
    leases.get(planRevisionId)?.release()
    const lease: Lease = { ...authority, release: () => undefined }
    const release = () => {
      authority.signal.removeEventListener("abort", release)
      if (leases.get(planRevisionId) === lease) leases.delete(planRevisionId)
    }
    lease.release = release
    if (authority.signal.aborted) return release
    leases.set(planRevisionId, lease)
    authority.signal.addEventListener("abort", release, { once: true })
    // Abort can race registration; a capability already revoked must never become current again.
    if (authority.signal.aborted) release()
    return release
  }

  const assertCurrent = (checked: Checked) => Effect.gen(function* () {
    const stillBound = () => checked.active() && input.records() === checked.records &&
      leases.get(checked.plan.id) === checked.lease && !checked.lease.signal.aborted
    if (!stillBound()) return yield* denied("AUTHORITY_REVOKED")
    const current = yield* Effect.tryPromise({
      try: () => checked.lease.current(),
      catch: () => denied("AUTHORITY_UNAVAILABLE"),
    })
    if (!current || !stillBound()) return yield* denied("AUTHORITY_REVOKED")
  })

  const protectPlan = (database: Database.Interface, planRevisionId: string, active: () => boolean) => Effect.gen(function* () {
    const records = input.records()
    const plan = records
      ? yield* Effect.tryPromise({ try: () => records.readPlan(planRevisionId), catch: () => denied("PLAN_INVALID") })
      // Native classification keeps unrelated workflows usable while SF resources are absent.
      : yield* GovernanceRecordsV2.readWorkflowRevision(database.db, planRevisionId)
        .pipe(Effect.mapError(() => denied("PLAN_INVALID")))
    if (!plan || plan.id !== planRevisionId) return yield* denied("PLAN_INVALID")
    if (!Object.prototype.hasOwnProperty.call(plan.workflowBinding.parameters, SF_ROUTINE_INPUT_PARAMETER)) return undefined
    if (!readSfRoutineNativeInput(plan)) return yield* denied("INPUT_INVALID")
    if (!records) return yield* denied("RECORDS_UNAVAILABLE")
    const lease = leases.get(plan.id)
    if (!lease) return yield* denied("AUTHORITY_UNAVAILABLE")
    const checked: Checked = { plan, records, lease, active }
    yield* assertCurrent(checked)
    return checked
  })

  const protectSession = (database: Database.Interface, sessionId: string, active: () => boolean) => Effect.gen(function* () {
    // Do not use an authorization-only projection: approval-only native workflow children are guarded too.
    const bound = yield* WorkflowRecordsV2.read(database.db, sessionId)
      .pipe(Effect.mapError(() => denied("BINDING_INVALID")))
    return bound ? yield* protectPlan(database, bound.binding.planRevisionID, active) : undefined
  })

  const make = Effect.gen(function* () {
    const original = yield* MaestroGovernanceV2.make
    const database = yield* Database.Service
    const location = yield* Location.Service
    const installation = Object.freeze({ epoch: ++epoch, projectId: location.project.id, directory: location.directory })
    let active = true

    const checkPlan = (id: string) => protectPlan(database, id, () => active)
    const checkSession = (session: SessionSchema.Info) => protectSession(database, session.id, () => active)

    const service = TaskGovernance.Service.of({
      input: original.input,
      ...(original.roster === undefined ? {} : { roster: original.roster }),
      admit: (admission) => Effect.gen(function* () {
        const workflow = admission.input.workflow
        const planRevisionId = workflow !== null && typeof workflow === "object" && "planRevisionID" in workflow
          ? workflow.planRevisionID : undefined
        const checked = typeof planRevisionId === "string" ? yield* checkPlan(planRevisionId) : undefined
        if (checked && (checked.plan.sessionID !== admission.parent.id || admission.context.sessionID !== admission.parent.id ||
          checked.plan.workflowBinding.publication.projectID !== admission.parent.projectID)) return yield* denied("BINDING_INVALID")
        const admitted = yield* original.admit(admission)
        if (checked) yield* assertCurrent(checked)
        return admitted
      }),
      beforeTurn: (session) => Effect.gen(function* () {
        const checked = yield* checkSession(session)
        yield* original.beforeTurn(session)
        if (checked) yield* assertCurrent(checked)
      }),
      settle: (settlement) => Effect.gen(function* () {
        const checked = yield* checkSession(settlement.child)
        const settled = yield* original.settle(settlement)
        if (checked) yield* assertCurrent(checked)
        return settled
      }),
    })
    installations.set(service, installation)
    yield* Effect.addFinalizer(() => Effect.sync(() => {
      active = false
      installations.delete(service)
    }))
    return service
  })

  // Keep every native dependency and its Location tag. Do not depend on the same named TaskGovernance node.
  const node: typeof MaestroGovernanceV2.node = {
    ...MaestroGovernanceV2.node,
    implementation: Layer.effect(TaskGovernance.Service, make),
  }
  const safetyNode: typeof WriteRootsV2.safetyNode = {
    ...WriteRootsV2.safetyNode,
    implementation: Layer.effect(ToolSafety.Service, Effect.gen(function* () {
      const original = yield* ToolSafety.Service
      const database = yield* Database.Service
      let active = true
      const check = (invocation: ToolSafety.Invocation) => {
        const workflow = invocation.tool === "task" && invocation.args !== null && typeof invocation.args === "object" &&
          "workflow" in invocation.args ? invocation.args.workflow : undefined
        const plan = workflow !== null && typeof workflow === "object" && "planRevisionID" in workflow
          ? workflow.planRevisionID : undefined
        return (typeof plan === "string" ? protectPlan(database, plan, () => active)
          : protectSession(database, invocation.sessionID, () => active)).pipe(Effect.mapError(safetyDenied))
      }
      const revalidate = (checked: Checked) => assertCurrent(checked).pipe(Effect.mapError(safetyDenied))
      const service = ToolSafety.Service.of({
        ...original,
        before: (invocation) => Effect.gen(function* () {
          const checked = yield* check(invocation)
          yield* original.before(invocation)
          if (checked) yield* revalidate(checked)
        }),
        run: (invocation, effect, observe, outcome) => Effect.gen(function* () {
          const checked = yield* check(invocation)
          if (!checked) return yield* original.run(invocation, effect, observe, outcome)
          // The inner fence runs after the original before hooks/approvals, immediately before native settlement.
          const guarded = Effect.gen(function* () {
            yield* revalidate(checked)
            const value = yield* effect
            yield* revalidate(checked)
            return value
          })
          return yield* original.run(invocation, guarded, observe, outcome)
        }),
        session: (event) => Effect.gen(function* () {
          if (event.operation !== "prompt") return yield* original.session(event)
          const checked = yield* protectSession(database, event.sessionID, () => active).pipe(Effect.mapError(safetyDenied))
          const result = yield* original.session(event)
          if (checked) yield* revalidate(checked)
          return result
        }),
      })
      safeties.add(service)
      yield* Effect.addFinalizer(() => Effect.sync(() => { active = false; safeties.delete(service) }))
      return service
    })).pipe(Layer.provide(WriteRootsV2.safetyNode.implementation!)),
  }
  const relayNode = {
    ...Relay.node,
    dependencies: [...Relay.node.dependencies, Database.node],
    // The tuple provide overload accepts LayerNode's erased implementation without a cast or new graph.
    implementation: Layer.effect(Relay.Service, Effect.gen(function* () {
      const original = yield* Relay.Service
      const database = yield* Database.Service
      let active = true
      const stateDenied = (error: ToolFailure) => new ArmState.StateError({ path: original.paths.arms, reason: error.message })
      const checkArm = (plan: string | undefined) => plan === undefined ? Effect.succeed(undefined)
        : protectPlan(database, plan, () => active).pipe(Effect.mapError(stateDenied))
      const service = Relay.Service.of({
        ...original,
        create: (arm) => Effect.gen(function* () {
          const checked = yield* checkArm(arm.meta.workflow?.planRevisionID)
          const result = yield* original.create(arm)
          if (checked) yield* assertCurrent(checked).pipe(Effect.mapError(stateDenied))
          return result
        }),
        rebind: (arm) => Effect.gen(function* () {
          const checked = yield* checkArm(arm.meta.workflow?.planRevisionID)
          const result = yield* original.rebind(arm)
          if (checked) yield* assertCurrent(checked).pipe(Effect.mapError(stateDenied))
          return result
        }),
        transition: (transition) => Effect.gen(function* () {
          const checked = yield* protectPlan(database, transition.binding.planRevisionID, () => active)
            .pipe(Effect.mapError(relayDenied))
          if (!checked) return yield* original.transition(transition)
          const result = yield* original.transition({
            ...transition,
            // Relay invokes this under its existing .run.lock, before entry/cost/check/retry writes and on repair.
            revalidate: () => Effect.gen(function* () {
              yield* assertCurrent(checked).pipe(Effect.mapError(relayDenied))
              yield* transition.revalidate()
              yield* assertCurrent(checked).pipe(Effect.mapError(relayDenied))
            }),
          })
          yield* assertCurrent(checked).pipe(Effect.mapError(relayDenied))
          return result
        }),
      })
      relays.add(service)
      yield* Effect.addFinalizer(() => Effect.sync(() => { active = false; relays.delete(service) }))
      return service
    })).pipe(Layer.provide([Relay.node.implementation!])),
  }
  const contribution: Host.Contribution = {
    id: "sucafina/routine-native-governance",
    replacements: [[TaskGovernance.node, node], [ToolSafety.node, safetyNode], [Relay.node, relayNode]],
  }

  return {
    contribution,
    bind,
    registerLease: bind,
    installed: (service: TaskGovernance.Interface) => installations.has(service),
    installation: (service: TaskGovernance.Interface) => installations.get(service),
    guardsInstalled: (safety: ToolSafety.Interface, relay: Relay.Interface) => safeties.has(safety) && relays.has(relay),
    dispose: () => { for (const lease of leases.values()) lease.release() },
  }
}

function denied(reason: string) {
  return new ToolFailure({ message: `SF_ROUTINE_NATIVE_${reason}` })
}

function safetyDenied(error: ToolFailure) {
  return new ToolSafety.Denied({ reason: error.message })
}

function relayDenied(error: ToolFailure) {
  return new RelayWorkflowBinding.Held({ reason: error.message })
}
