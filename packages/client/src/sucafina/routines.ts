import { SfRoutines } from "@orchestra/schema/sucafina/routines"
import type { SfCallOptions, SfTransport } from "./transport"

/**
 * A09: call exactly the source-bound operation. F02 alone owns the Request,
 * installation context, frozen route, idempotency key and loss-of-response fence.
 * No retry, credential, arbitrary operation or schedule engine is exposed here.
 */
export function createSfRoutinesClient(transport: SfTransport) {
  return {
    "projection.routine": (
      input: typeof SfRoutines.operations["projection.routine"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["projection.routine"], input, options),
    "routines.catalog": (
      input: typeof SfRoutines.operations["routines.catalog"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["routines.catalog"], input, options),
    "routines.prepare-admission": (
      input: typeof SfRoutines.operations["routines.prepare-admission"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["routines.prepare-admission"], input, options),
    "routines.read-admission": (
      input: typeof SfRoutines.operations["routines.read-admission"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["routines.read-admission"], input, options),
    "routines.read-run": (
      input: typeof SfRoutines.operations["routines.read-run"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["routines.read-run"], input, options),
    "routines.run": (
      input: typeof SfRoutines.operations["routines.run"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["routines.run"], input, options),
    "schedules.create": (
      input: typeof SfRoutines.operations["schedules.create"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["schedules.create"], input, options),
    "schedules.list": (
      input: typeof SfRoutines.operations["schedules.list"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["schedules.list"], input, options),
    "schedules.pause": (
      input: typeof SfRoutines.operations["schedules.pause"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["schedules.pause"], input, options),
    "schedules.read": (
      input: typeof SfRoutines.operations["schedules.read"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["schedules.read"], input, options),
    "schedules.read-run": (
      input: typeof SfRoutines.operations["schedules.read-run"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["schedules.read-run"], input, options),
    "schedules.update": (
      input: typeof SfRoutines.operations["schedules.update"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfRoutines.operations["schedules.update"], input, options),
  } as const
}
