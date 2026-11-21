import { Effect } from "effect"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessPorts, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createSfRoutineNativeAdmission } from "./routine-native-admission.ts"
import { createSfRoutineNativeAdapter } from "./routine-native-adapter.ts"
import { BridgeError, createSfRoutineNativePhaseBridge } from "./routine-native-phase-bridge.ts"
import type { HistoryIntent, PlanningIntent, PlanningLease, SourceIntent } from "./routine-native-phase-bridge.ts"
import type { createSfRoutineNativeOwnerRegistry, SfRoutineNativeHistoricalAuthority } from "./routine-native-registry.ts"
import { createSfRoutineServices } from "./routine-services.ts"
import type { SfRoutineServicesInput } from "./routine-services.ts"

type Input = Omit<Parameters<typeof createSfRoutineNativePhaseBridge>[0], "owners" | "admission" | "readOwners"> & {
  registry: ReturnType<typeof createSfRoutineNativeOwnerRegistry>
} & Pick<SfRoutineServicesInput, "authority" | "prepareWatch" | "watchAvailable" | "requiredAuthority">

/** Both UI methods AND original native C07 handlers pass here after their real authority/lease admission. Native
 * model data stays native data; its C11/C16 resident Session never becomes the independently issued Maestro owner.
 */
export function createSfRoutineNativePhaseComposition(input: Input) {
  const phase = createSfRoutineNativePhaseBridge({ ...input, owners: input.registry.owners, readOwners: input.registry.readOwners, admission: () => admission })
  const admission = createSfRoutineNativeAdmission({ ...input, origin: () => phase.origin, authorizeIntent: phase.authorizeIntent })
  const adapter = createSfRoutineNativeAdapter({ ...input, owners: () => phase.owners, phases: phase })
  const reading = new Map<TrustedDomainContext, { request: Request; evidence: SfRoutineNativeHistoricalAuthority }>()

  const planning = <A>(context: TrustedDomainContext, intent: PlanningIntent | { operation: "native-recipe"; reference: string },
    consume: (lease: PlanningLease) => Effect.Effect<PortResult<A>, BridgeError>): Promise<PortResult<A>> =>
    Effect.runPromise(phase.issue(context, intent).pipe(Effect.flatMap((source) => phase.withPlanning(source, consume)),
      Effect.catch((error) => Effect.succeed({ status: "unavailable" as const, reason: error.reason }))))

  const sourceRead = async <A>(context: TrustedDomainContext, read: () => Promise<A>, intent?: SourceIntent): Promise<A | undefined> => {
    if (!intent) return undefined // No newest/first/per-actor history fallback, even for a genuine C11 caller.
    const current = reading.get(context)
    if (current) {
      const resources = input.resources()
      const native = intent.operation === "read-run" ? await resources?.records.readRun(intent.reference) :
        intent.operation === "read-admission" ? await resources?.records.readAdmission(intent.reference) : undefined
      if (!native || native.parent.id !== current.evidence.authoritySessionID || input.requestFor(context) !== current.request ||
        !await current.evidence.current(context, current.request)) return undefined
      const result = await read()
      return await current.evidence.current(context, current.request) ? result : undefined
    }
    const source = await Effect.runPromise(phase.issue(context, intent).pipe(Effect.option))
    if (source._tag === "None") return undefined
    try {
      const evidence = await phase.historical(source.value), request = input.requestFor(context)
      if (!evidence || !request) return undefined
      return await input.registry.withReauthenticatedRead(context, request, evidence, async () => {
        reading.set(context, { request, evidence })
        try { return await read() } finally { reading.delete(context) }
      })
    } finally { phase.finish(source.value) }
  }
  const historicalRead = <A>(context: TrustedDomainContext, read: () => Promise<A>, intent?: HistoryIntent) => sourceRead(context, read, intent)
  const runRead = async <A>(reference: string, context: TrustedDomainContext, read: () => Promise<PortResult<A>>): Promise<PortResult<A>> =>
    await historicalRead(context, read, { operation: "read-run", reference }) ?? unavailable()

  const services = createSfRoutineServices({ ...input, native: adapter.native, source: {
    recipe: (reference, context, read) => context.kind === "native"
      ? planning(context, { operation: "native-recipe", reference }, () => checked(read)) : read(),
    runRead,
    artifact: async (reference, context, read) => {
      if (!await input.authorize(context) || !input.requestFor(context)) return unavailable()
      const terminal = await input.resources()?.records.terminalForResult(reference)
      const run = terminal?.admission.reservation?.childSessionID
      return run ? runRead(run, context, read) : unavailable()
    },
    routines: (original) => {
      const routines: BusinessPorts["routines"] = {
        ...original,
        catalog: (purpose, context) => planning(context, { operation: "catalog", purpose }, (lease) => Effect.gen(function* () {
          const first = yield* checked(() => original.catalog(purpose, context))
          const result = first.status !== "needs-input" || first.reason !== "published-workflow-plan-required" ? first :
            (yield* lease.resume()) === "busy" ? { status: "conflict" as const, reason: "native-routine-session-busy" } :
              yield* checked(() => original.catalog(purpose, context))
          if (result.status === "ok" && context.kind === "native")
            yield* checked(async () => { for (const recipe of result.value) await phase.rememberNativeRecipe(context, recipe.documentId, recipe.planRevisionId) })
          return result
        })),
        prepareAdmission: (request, context) => planning(context, { operation: "prepare", request }, (lease) => Effect.gen(function* () {
          const first = yield* checked(() => original.prepareAdmission(request, context))
          if (first.status !== "needs-input" || first.reason !== "native-human-authorization-required") return first
          // Continue only genuinely admitted native human replies; this call injects no model-derived user message.
          if ((yield* lease.resume()) === "busy") return { status: "conflict" as const, reason: "native-routine-session-busy" }
          return yield* checked(() => original.prepareAdmission(request, context))
        })),
        run: async (request, context) => {
          if (context.kind === "native") return await historicalRead(context, async () => {
            const record = await input.resources()?.records.readAdmission(request.admissionRef)
            if (!record || record.version !== request.expectedAdmissionVersion) return { status: "stale" as const, reason: "routine-admission-changed" }
            if (record.state !== "admitted" || !["completed", "error"].includes(record.taskStatus ?? "")) return needsHuman()
            // Settled native runs are consumed as factual receipts. Never call start/Task for a resident profile.
            return original.readAdmission(request.admissionRef, context)
          }, { operation: "read-admission", reference: request.admissionRef }) ?? unavailable()
          return await sourceRead(context, () => original.run(request, context), { operation: "run", request }) ?? unavailable()
        },
        readAdmission: async (reference, context) => await historicalRead(context, async () => {
          if (context.kind === "native") {
            const record = await input.resources()?.records.readAdmission(reference)
            const calledRun = record && input.authority.receiptFor(context, "sf_routine_run", digestSfValue({
              admittedRunRef: reference, expectedAdmissionVersion: record.version,
            }))
            if (record && calledRun && (record.state !== "admitted" || !["completed", "error"].includes(record.taskStatus ?? ""))) return needsHuman()
          }
          return original.readAdmission(reference, context)
        }, { operation: "read-admission", reference }) ?? unavailable(),
        readRun: async (reference, context) => await historicalRead(context, () => original.readRun(reference, context),
          { operation: "read-run", reference }) ?? unavailable(),
      }
      return routines
    },
  } })
  return { phase, admission, adapter, services, routines: services.routines, historicalRead, contribution: phase.contribution }
}
function unavailable() { return { status: "unavailable" as const, reason: "native-routine-phase-unavailable" } }
function needsHuman() { return { status: "needs-input" as const, reason: "native-human-run-continuation-required" } }
function checked<A>(read: () => Promise<A>) {
  return Effect.tryPromise({ try: read, catch: () => new BridgeError({ reason: "SF_NATIVE_PHASE_SOURCE_UNAVAILABLE" }) })
}
