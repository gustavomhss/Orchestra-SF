import { Effect } from "effect"
import type { BusinessPorts, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { createSfRoutineNativeAdmission } from "./routine-native-admission.ts"
import { createSfRoutineNativeAdapter } from "./routine-native-adapter.ts"
import { BridgeError, createSfRoutineNativePhaseBridge } from "./routine-native-phase-bridge.ts"
import type { PlanningIntent, PlanningLease } from "./routine-native-phase-bridge.ts"
import type { createSfRoutineNativeOwnerRegistry } from "./routine-native-registry.ts"
import { createSfRoutineServices } from "./routine-services.ts"
import type { SfRoutineServicesInput } from "./routine-services.ts"

type Input = Omit<Parameters<typeof createSfRoutineNativePhaseBridge>[0], "owners" | "admission"> & {
  registry: ReturnType<typeof createSfRoutineNativeOwnerRegistry>
} & Pick<SfRoutineServicesInput, "authority" | "prepareWatch" | "watchAvailable" | "requiredAuthority">

/** Original host-method composition, not an endpoint/engine. The caller supplies actual Request/human authority
 * and the existing runtime services. Native approval replies stay in the native Session UI/APIs, never here.
 */
export function createSfRoutineNativePhaseComposition(input: Input) {
  const phase = createSfRoutineNativePhaseBridge({ ...input, owners: input.registry.owners, admission: () => admission })
  const admission = createSfRoutineNativeAdmission({ ...input, origin: () => phase.origin, authorizeIntent: phase.authorizeIntent })
  const adapter = createSfRoutineNativeAdapter({ ...input, owners: () => phase.owners, phases: phase })
  const services = createSfRoutineServices({ ...input, native: adapter.native })

  const planning = <A>(context: TrustedUiContext, intent: PlanningIntent | undefined,
    consume: (lease: PlanningLease) => Effect.Effect<PortResult<A>, BridgeError>): Promise<PortResult<A>> =>
    Effect.runPromise(phase.issue(context, intent).pipe(
      Effect.flatMap((source) => phase.withPlanning(source, consume)),
      Effect.catch(() => Effect.succeed(unavailable())),
    ))

  const historicalRead = async <A>(context: TrustedDomainContext, read: () => Promise<A>): Promise<A | undefined> => {
    if (context.kind !== "ui") return read()
    const source = await Effect.runPromise(phase.issue(context).pipe(Effect.option))
    if (source._tag === "None") return undefined
    try {
      const evidence = await phase.historical(source.value)
      const request = input.requestFor(context)
      if (!evidence || !request) return undefined
      return await input.registry.withReauthenticatedRead(context, request, evidence, read)
    } finally {
      phase.finish(source.value)
    }
  }

  const routines: BusinessPorts["routines"] = {
    ...services.routines,
    catalog: (purpose, context) => {
      if (context.kind !== "ui") return services.routines.catalog(purpose, context)
      return planning(context, { operation: "catalog", purpose }, (lease) => Effect.gen(function* () {
        const first = yield* checked(() => services.routines.catalog(purpose, context))
        if (first.status !== "needs-input" || first.reason !== "published-workflow-plan-required") return first
        // Bootstrap only an original purpose/catalog POST needing a native plan. No Task reservation is made here;
        // the original Maestro runner must really perform upstream planning/review/presentation through its tools.
        if ((yield* lease.resume()) === "busy") return { status: "conflict" as const, reason: "native-routine-session-busy" }
        return yield* checked(() => services.routines.catalog(purpose, context))
      }))
    },
    prepareAdmission: (request, context) => context.kind !== "ui" ? services.routines.prepareAdmission(request, context) :
      planning(context, { operation: "prepare", request }, () => checked(() => services.routines.prepareAdmission(request, context))),
    run: (request, context) => context.kind !== "ui" ? services.routines.run(request, context) :
      planning(context, undefined, () => checked(() => services.routines.run(request, context))),
    readAdmission: async (reference, context) =>
      await historicalRead(context, () => services.routines.readAdmission(reference, context)) ?? unavailable(),
    readRun: async (reference, context) =>
      await historicalRead(context, () => services.routines.readRun(reference, context)) ?? unavailable(),
  }
  return { phase, admission, adapter, services, routines, historicalRead }
}

function unavailable() { return { status: "unavailable" as const, reason: "native-routine-phase-unavailable" } }
function checked<A>(read: () => Promise<A>) {
  return Effect.tryPromise({ try: read, catch: () => new BridgeError({ reason: "SF_NATIVE_PHASE_SOURCE_UNAVAILABLE" }) })
}
