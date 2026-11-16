import { SfProcurement } from "@orchestra/schema/sucafina/procurement"
import type { SfSupplierCsvExportRequest, SfSupplierCsvExportResult } from "@orchestra/schema/sucafina/procurement"
import type { SfCallOptions, SfTransport } from "./transport"

/**
 * Dedicated A06->F02 byte handoff. JSON execute() cannot carry native bytes.
 * Before F02/desktop installs its exact admitted consumer, this stays closed;
 * no direct fetch, navigation URL, frontend CSV construction or fake grant.
 */
type SupplierCsvBytePort = Readonly<{
  downloadSupplierCsv(input: SfSupplierCsvExportRequest, options: SfCallOptions): Promise<SfSupplierCsvExportResult>
}>
function csvPort(transport: SfTransport): SupplierCsvBytePort | null {
  if (!("downloadSupplierCsv" in transport) || typeof transport.downloadSupplierCsv !== "function") return null
  return transport as SfTransport & SupplierCsvBytePort
}

export function sfSupplierCsvBindingInstalled(transport: SfTransport): boolean {
  return csvPort(transport) !== null
}

export async function exportSfSupplierCsv(
  transport: SfTransport, input: SfSupplierCsvExportRequest, options: SfCallOptions,
): Promise<SfSupplierCsvExportResult> {
  if (input.surface !== "procurement" || Object.keys(input).length !== 1) return { status: "invalid" }
  const binding = csvPort(transport)
  if (!binding) return { status: "unavailable" }
  if (options.signal.aborted) return { status: "aborted" }
  try { return await binding.downloadSupplierCsv(input, options) }
  catch { return options.signal.aborted ? { status: "aborted" } : { status: "unavailable" } }
}

/**
 * A03 typed facade. One immutable catalog entry per method. The injected F02
 * transport owns authentication, owner fencing, idempotency and unknown outcomes.
 * No free-form action dispatcher, local cache or browser financial calculation.
 */
export function createSfProcurementClient(transport: SfTransport) {
  return {
    "domain.command.CAP25.approve": (input: typeof SfProcurement.operations["domain.command.CAP25.approve"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.approve"], input, options),
    "domain.command.CAP25.cancel": (input: typeof SfProcurement.operations["domain.command.CAP25.cancel"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.cancel"], input, options),
    "domain.command.CAP25.create": (input: typeof SfProcurement.operations["domain.command.CAP25.create"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.create"], input, options),
    "domain.command.CAP25.delete": (input: typeof SfProcurement.operations["domain.command.CAP25.delete"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.delete"], input, options),
    "domain.command.CAP25.issue": (input: typeof SfProcurement.operations["domain.command.CAP25.issue"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.issue"], input, options),
    "domain.command.CAP25.reject": (input: typeof SfProcurement.operations["domain.command.CAP25.reject"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.reject"], input, options),
    "domain.command.CAP25.save": (input: typeof SfProcurement.operations["domain.command.CAP25.save"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.save"], input, options),
    "domain.command.CAP25.select_quote": (input: typeof SfProcurement.operations["domain.command.CAP25.select_quote"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.select_quote"], input, options),
    "domain.command.CAP25.submit_po": (input: typeof SfProcurement.operations["domain.command.CAP25.submit_po"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.submit_po"], input, options),
    "domain.command.CAP25.submit_pr": (input: typeof SfProcurement.operations["domain.command.CAP25.submit_pr"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.submit_pr"], input, options),
    "domain.command.CAP25.submit_sourcing": (input: typeof SfProcurement.operations["domain.command.CAP25.submit_sourcing"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP25.submit_sourcing"], input, options),
    "domain.command.CAP26.approve": (input: typeof SfProcurement.operations["domain.command.CAP26.approve"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.approve"], input, options),
    "domain.command.CAP26.cancel": (input: typeof SfProcurement.operations["domain.command.CAP26.cancel"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.cancel"], input, options),
    "domain.command.CAP26.create": (input: typeof SfProcurement.operations["domain.command.CAP26.create"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.create"], input, options),
    "domain.command.CAP26.delete": (input: typeof SfProcurement.operations["domain.command.CAP26.delete"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.delete"], input, options),
    "domain.command.CAP26.issue": (input: typeof SfProcurement.operations["domain.command.CAP26.issue"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.issue"], input, options),
    "domain.command.CAP26.reject": (input: typeof SfProcurement.operations["domain.command.CAP26.reject"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.reject"], input, options),
    "domain.command.CAP26.save": (input: typeof SfProcurement.operations["domain.command.CAP26.save"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.save"], input, options),
    "domain.command.CAP26.select_quote": (input: typeof SfProcurement.operations["domain.command.CAP26.select_quote"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.select_quote"], input, options),
    "domain.command.CAP26.submit_po": (input: typeof SfProcurement.operations["domain.command.CAP26.submit_po"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.submit_po"], input, options),
    "domain.command.CAP26.submit_pr": (input: typeof SfProcurement.operations["domain.command.CAP26.submit_pr"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.submit_pr"], input, options),
    "domain.command.CAP26.submit_sourcing": (input: typeof SfProcurement.operations["domain.command.CAP26.submit_sourcing"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP26.submit_sourcing"], input, options),
    "domain.command.CAP27.activate": (input: typeof SfProcurement.operations["domain.command.CAP27.activate"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP27.activate"], input, options),
    "domain.command.CAP27.block": (input: typeof SfProcurement.operations["domain.command.CAP27.block"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP27.block"], input, options),
    "domain.command.CAP27.change-bank": (input: typeof SfProcurement.operations["domain.command.CAP27.change-bank"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP27.change-bank"], input, options),
    "domain.command.CAP27.create": (input: typeof SfProcurement.operations["domain.command.CAP27.create"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP27.create"], input, options),
    "domain.command.CAP27.delete": (input: typeof SfProcurement.operations["domain.command.CAP27.delete"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP27.delete"], input, options),
    "domain.command.CAP27.inactivate": (input: typeof SfProcurement.operations["domain.command.CAP27.inactivate"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP27.inactivate"], input, options),
    "domain.command.CAP27.save": (input: typeof SfProcurement.operations["domain.command.CAP27.save"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP27.save"], input, options),
    "domain.command.CAP28.reset": (input: typeof SfProcurement.operations["domain.command.CAP28.reset"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP28.reset"], input, options),
    "domain.command.CAP28.save": (input: typeof SfProcurement.operations["domain.command.CAP28.save"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.command.CAP28.save"], input, options),
    "domain.page.CAP24": (input: typeof SfProcurement.operations["domain.page.CAP24"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.page.CAP24"], input, options),
    "domain.page.CAP25": (input: typeof SfProcurement.operations["domain.page.CAP25"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.page.CAP25"], input, options),
    "domain.page.CAP26": (input: typeof SfProcurement.operations["domain.page.CAP26"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.page.CAP26"], input, options),
    "domain.page.CAP27": (input: typeof SfProcurement.operations["domain.page.CAP27"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.page.CAP27"], input, options),
    "domain.page.CAP28": (input: typeof SfProcurement.operations["domain.page.CAP28"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["domain.page.CAP28"], input, options),
    "procurement.procurement-scenario-controls": (input: typeof SfProcurement.operations["procurement.procurement-scenario-controls"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["procurement.procurement-scenario-controls"], input, options),
    "procurement.procurement-scenario-preview": (input: typeof SfProcurement.operations["procurement.procurement-scenario-preview"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["procurement.procurement-scenario-preview"], input, options),
    "procurement.sourcing.prepare": (input: typeof SfProcurement.operations["procurement.sourcing.prepare"]["input"]["Type"], options: SfCallOptions) =>
      transport.execute(SfProcurement.operations["procurement.sourcing.prepare"], input, options),
  } as const
}
