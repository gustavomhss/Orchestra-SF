import {
  SfContextResult,
  SfExpectedContextBinding,
} from "@orchestra/schema/sucafina/context"
import type { SfCallOptions, SfTransport } from "./transport"

/** Context reads are bound to the installed descriptor, never a caller-provided URL. */
export function createSfContextClient(transport: SfTransport): Readonly<{
  "ctx.context"(input: SfExpectedContextBinding, options: SfCallOptions): Promise<import("./transport").SfTransportResult<import("@orchestra/schema/sucafina/context").SfContextResult>>
}> {
  const operation = {
    operationId: "ctx.context" as const,
    input: SfExpectedContextBinding,
    output: SfContextResult,
  }
  return Object.freeze({
    "ctx.context": (input: SfExpectedContextBinding, options: SfCallOptions) =>
      transport.execute(operation, input, options),
  })
}
