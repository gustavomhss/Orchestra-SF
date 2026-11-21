import { SfOperations } from "@orchestra/schema/sucafina/operations"
import type { SfCallOptions, SfTransport } from "./transport"

/** A11 wrappers use the original admitted producer routes through F02 transport. */
export function createSfOperationsClient(transport: SfTransport) {
  return {
    "domain.page.CAP11": (
      input: typeof SfOperations.operations["domain.page.CAP11"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.page.CAP11"], input, options),
    "domain.command.CAP11.save-categories": (
      input: typeof SfOperations.operations["domain.command.CAP11.save-categories"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP11.save-categories"], input, options),
    "domain.command.CAP11.save-items": (
      input: typeof SfOperations.operations["domain.command.CAP11.save-items"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP11.save-items"], input, options),
    "domain.command.CAP11.save-tickets": (
      input: typeof SfOperations.operations["domain.command.CAP11.save-tickets"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP11.save-tickets"], input, options),
    "domain.command.CAP11.save-sla": (
      input: typeof SfOperations.operations["domain.command.CAP11.save-sla"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP11.save-sla"], input, options),
    "domain.command.CAP11.save-heatmap": (
      input: typeof SfOperations.operations["domain.command.CAP11.save-heatmap"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP11.save-heatmap"], input, options),
    "domain.command.CAP11.import-month": (
      input: typeof SfOperations.operations["domain.command.CAP11.import-month"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP11.import-month"], input, options),
    "domain.page.CAP12": (
      input: typeof SfOperations.operations["domain.page.CAP12"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.page.CAP12"], input, options),
    "domain.command.CAP12.save-kpi": (
      input: typeof SfOperations.operations["domain.command.CAP12.save-kpi"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.save-kpi"], input, options),
    "domain.command.CAP12.delete-kpi": (
      input: typeof SfOperations.operations["domain.command.CAP12.delete-kpi"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.delete-kpi"], input, options),
    "domain.command.CAP12.save-action": (
      input: typeof SfOperations.operations["domain.command.CAP12.save-action"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.save-action"], input, options),
    "domain.command.CAP12.delete-action": (
      input: typeof SfOperations.operations["domain.command.CAP12.delete-action"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.delete-action"], input, options),
    "domain.command.CAP12.save-incident": (
      input: typeof SfOperations.operations["domain.command.CAP12.save-incident"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.save-incident"], input, options),
    "domain.command.CAP12.delete-incident": (
      input: typeof SfOperations.operations["domain.command.CAP12.delete-incident"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.delete-incident"], input, options),
    "domain.command.CAP12.save-campaign": (
      input: typeof SfOperations.operations["domain.command.CAP12.save-campaign"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.save-campaign"], input, options),
    "domain.command.CAP12.delete-campaign": (
      input: typeof SfOperations.operations["domain.command.CAP12.delete-campaign"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfOperations.operations["domain.command.CAP12.delete-campaign"], input, options),
  } as const
}
