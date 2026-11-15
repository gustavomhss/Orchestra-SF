import type { Schema } from "effect"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import type { SfCallOptions, SfTransport } from "./transport"

/** W15/A02: each source-locked operation is a different typed callable.
 * Transport owns origin, native-owner fence, anti-redirect, codec verification,
 * idempotency key and outcome-unknown. No retry is performed by this adapter.
 */
type Operations = (typeof SfPlanner)["operations"]
export function createSfPlannerClient(transport: SfTransport) {
  return {
    "domain.page.CAP17": (
      input: Schema.Schema.Type<Operations["domain.page.CAP17"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.page.CAP17"], input, options),
    "domain.command.CAP17.import-workbook": (
      input: Schema.Schema.Type<Operations["domain.command.CAP17.import-workbook"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP17.import-workbook"], input, options),
    "domain.page.CAP18": (
      input: Schema.Schema.Type<Operations["domain.page.CAP18"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.page.CAP18"], input, options),
    "domain.command.CAP18.save": (
      input: Schema.Schema.Type<Operations["domain.command.CAP18.save"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP18.save"], input, options),
    "domain.command.CAP18.delete": (
      input: Schema.Schema.Type<Operations["domain.command.CAP18.delete"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP18.delete"], input, options),
    "domain.command.CAP18.spread": (
      input: Schema.Schema.Type<Operations["domain.command.CAP18.spread"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP18.spread"], input, options),
    "domain.command.CAP18.reset": (
      input: Schema.Schema.Type<Operations["domain.command.CAP18.reset"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP18.reset"], input, options),
    "domain.command.CAP18.import-workbook": (
      input: Schema.Schema.Type<Operations["domain.command.CAP18.import-workbook"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP18.import-workbook"], input, options),
    "domain.page.CAP19": (
      input: Schema.Schema.Type<Operations["domain.page.CAP19"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.page.CAP19"], input, options),
    "domain.command.CAP19.save": (
      input: Schema.Schema.Type<Operations["domain.command.CAP19.save"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP19.save"], input, options),
    "domain.command.CAP19.delete": (
      input: Schema.Schema.Type<Operations["domain.command.CAP19.delete"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP19.delete"], input, options),
    "domain.command.CAP19.spread": (
      input: Schema.Schema.Type<Operations["domain.command.CAP19.spread"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP19.spread"], input, options),
    "domain.command.CAP19.reset": (
      input: Schema.Schema.Type<Operations["domain.command.CAP19.reset"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP19.reset"], input, options),
    "domain.command.CAP19.import-workbook": (
      input: Schema.Schema.Type<Operations["domain.command.CAP19.import-workbook"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP19.import-workbook"], input, options),
    "domain.page.CAP20": (
      input: Schema.Schema.Type<Operations["domain.page.CAP20"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.page.CAP20"], input, options),
    "domain.command.CAP20.save": (
      input: Schema.Schema.Type<Operations["domain.command.CAP20.save"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP20.save"], input, options),
    "domain.command.CAP20.delete": (
      input: Schema.Schema.Type<Operations["domain.command.CAP20.delete"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP20.delete"], input, options),
    "domain.command.CAP20.sync": (
      input: Schema.Schema.Type<Operations["domain.command.CAP20.sync"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP20.sync"], input, options),
    "domain.command.CAP20.import-workbook": (
      input: Schema.Schema.Type<Operations["domain.command.CAP20.import-workbook"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP20.import-workbook"], input, options),
    "domain.page.CAP21": (
      input: Schema.Schema.Type<Operations["domain.page.CAP21"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.page.CAP21"], input, options),
    "domain.command.CAP21.save": (
      input: Schema.Schema.Type<Operations["domain.command.CAP21.save"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP21.save"], input, options),
    "domain.command.CAP21.delete": (
      input: Schema.Schema.Type<Operations["domain.command.CAP21.delete"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP21.delete"], input, options),
    "domain.command.CAP21.common": (
      input: Schema.Schema.Type<Operations["domain.command.CAP21.common"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP21.common"], input, options),
    "domain.command.CAP21.import-workbook": (
      input: Schema.Schema.Type<Operations["domain.command.CAP21.import-workbook"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP21.import-workbook"], input, options),
    "domain.page.CAP22": (
      input: Schema.Schema.Type<Operations["domain.page.CAP22"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.page.CAP22"], input, options),
    "domain.command.CAP22.save": (
      input: Schema.Schema.Type<Operations["domain.command.CAP22.save"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP22.save"], input, options),
    "domain.command.CAP22.delete": (
      input: Schema.Schema.Type<Operations["domain.command.CAP22.delete"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP22.delete"], input, options),
    "domain.command.CAP22.import-workbook": (
      input: Schema.Schema.Type<Operations["domain.command.CAP22.import-workbook"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP22.import-workbook"], input, options),
    "domain.page.CAP23": (
      input: Schema.Schema.Type<Operations["domain.page.CAP23"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.page.CAP23"], input, options),
    "domain.command.CAP23.save": (
      input: Schema.Schema.Type<Operations["domain.command.CAP23.save"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP23.save"], input, options),
    "domain.command.CAP23.copy": (
      input: Schema.Schema.Type<Operations["domain.command.CAP23.copy"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP23.copy"], input, options),
    "domain.command.CAP23.official": (
      input: Schema.Schema.Type<Operations["domain.command.CAP23.official"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP23.official"], input, options),
    "domain.command.CAP23.lock": (
      input: Schema.Schema.Type<Operations["domain.command.CAP23.lock"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP23.lock"], input, options),
    "domain.command.CAP23.unlock": (
      input: Schema.Schema.Type<Operations["domain.command.CAP23.unlock"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP23.unlock"], input, options),
    "domain.command.CAP23.delete": (
      input: Schema.Schema.Type<Operations["domain.command.CAP23.delete"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP23.delete"], input, options),
    "domain.command.CAP23.import-workbook": (
      input: Schema.Schema.Type<Operations["domain.command.CAP23.import-workbook"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["domain.command.CAP23.import-workbook"], input, options),
    "planner.monthly.preview": (
      input: Schema.Schema.Type<Operations["planner.monthly.preview"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["planner.monthly.preview"], input, options),
    "planner.monthly.apply": (
      input: Schema.Schema.Type<Operations["planner.monthly.apply"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["planner.monthly.apply"], input, options),
    "planner.forecast.prepare": (
      input: Schema.Schema.Type<Operations["planner.forecast.prepare"]["input"]>,
      options: SfCallOptions,
    ) => transport.execute(SfPlanner.operations["planner.forecast.prepare"], input, options),
  } as const
}
