import type { SfHostServices } from "../contracts/host-context.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedUiContext } from "../contracts/sf-execution.ts"

export type SfAnalysisRequest = Parameters<NonNullable<SfHostServices["analyses"]>["start"]>[1]["request"]

/** Optional host seam. Presence does not claim that a skill or its sources are available. */
export type SfAnalysisInputPort = {
  prepare: (context: TrustedUiContext, input: { request: SfAnalysisRequest; selection: Record<string, unknown> }) => Promise<PortResult<unknown>>
}

// WP00 owns SfHostServices. Keep this adapter local until the host publishes that extension.
export function getSfAnalysisInputs(runtime: SfHostServices): SfAnalysisInputPort | undefined {
  if (!("analysisInputs" in runtime) || !runtime.analysisInputs || typeof runtime.analysisInputs !== "object" ||
    !("prepare" in runtime.analysisInputs) || typeof runtime.analysisInputs.prepare !== "function") return undefined
  return runtime.analysisInputs as SfAnalysisInputPort
}
