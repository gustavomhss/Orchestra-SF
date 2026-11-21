import { SfAnalyses } from "@orchestra/schema/sucafina/analyses"
import type { SfCallOptions, SfTransport } from "./transport"

/** Typed wrappers only: F02 supplies the owner-bound transport and I00 supplies
 * the canonical method/path/codec registry. No direct fetch or route fallback.
 * POST reads also receive fresh Idempotency-Key through the transport.
 */
export function createSfAnalysesClient(transport: SfTransport) {
  return {
    "intelligence.analysis.cancel": (
      input: typeof SfAnalyses.operations["intelligence.analysis.cancel"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["intelligence.analysis.cancel"], input, options),
    "intelligence.analysis.choices": (
      input: typeof SfAnalyses.operations["intelligence.analysis.choices"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["intelligence.analysis.choices"], input, options),
    "intelligence.analysis.list": (
      input: typeof SfAnalyses.operations["intelligence.analysis.list"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["intelligence.analysis.list"], input, options),
    "intelligence.analysis.output": (
      input: typeof SfAnalyses.operations["intelligence.analysis.output"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["intelligence.analysis.output"], input, options),
    "intelligence.analysis.prepare": (
      input: typeof SfAnalyses.operations["intelligence.analysis.prepare"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["intelligence.analysis.prepare"], input, options),
    "intelligence.analysis.read": (
      input: typeof SfAnalyses.operations["intelligence.analysis.read"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["intelligence.analysis.read"], input, options),
    "intelligence.analysis.start": (
      input: typeof SfAnalyses.operations["intelligence.analysis.start"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["intelligence.analysis.start"], input, options),
    "projection.residents": (
      input: typeof SfAnalyses.operations["projection.residents"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfAnalyses.operations["projection.residents"], input, options),
  } as const
}
