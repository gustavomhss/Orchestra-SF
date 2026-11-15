/**
 * Typed A08 BI client: four existing producer routes, four literal operation
 * keys, no browser-side BI engine, no generic RPC or caller-supplied URL.
 */
import { SfBi } from "@orchestra/schema/sucafina/bi"
import type {
  SfBiBiDataInput,
  SfBiBiDecisionInput,
  SfBiBiOptionsInput,
  SfBiBiSourceInput,
} from "@orchestra/schema/sucafina/bi"
import type { SfCallOptions, SfTransport } from "./transport"

/** Reject runtime payload expansion before it can reach F02's admitted codec. */
function onlyKeys(input: unknown, allowed: readonly string[]): boolean {
  return input !== null && typeof input === "object" && !Array.isArray(input) &&
    Object.keys(input).every((key) => allowed.includes(key))
}

const contractMismatch = () => ({ kind: "transport-error", reason: "contract-mismatch" } as const)

export function createSfBiClient(transport: SfTransport) {
  return {
    "bi.bi-data"(input: SfBiBiDataInput, options: SfCallOptions) {
      if (!onlyKeys(input, ["viewId", "page", "selectionRef", "start", "end", "baseRef", "candidateRef", "currency"]) ||
        ("selectionRef" in input && ["baseRef", "candidateRef", "currency"].some((key) => key in input)) ||
        (["baseRef", "candidateRef", "currency"].some((key) => key in input) &&
          !["baseRef", "candidateRef", "currency"].every((key) => key in input))) {
        return Promise.resolve(contractMismatch())
      }
      return transport.execute(SfBi.operations["bi.bi-data"], input, options)
    },
    "bi.bi-source"(input: SfBiBiSourceInput, options: SfCallOptions) {
      if (!onlyKeys(input, ["viewId", "selectionRef", "valueId", "referenceDigest", "start", "end"]))
        return Promise.resolve(contractMismatch())
      return transport.execute(SfBi.operations["bi.bi-source"], input, options)
    },
    "bi.bi-decision"(input: SfBiBiDecisionInput, options: SfCallOptions) {
      if (!onlyKeys(input, ["viewId", "selectionRef", "snapshot", "target", "start", "end"]))
        return Promise.resolve(contractMismatch())
      return transport.execute(SfBi.operations["bi.bi-decision"], input, options)
    },
    "bi.bi-options"(input: SfBiBiOptionsInput, options: SfCallOptions) {
      if (!onlyKeys(input, ["page", "viewId", "start", "end"]))
        return Promise.resolve(contractMismatch())
      return transport.execute(SfBi.operations["bi.bi-options"], input, options)
    },
  } as const
}

export type SfBiClient = ReturnType<typeof createSfBiClient>
