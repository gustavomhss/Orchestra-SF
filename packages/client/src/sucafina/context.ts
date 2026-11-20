import {
  SfContextResult,
  SfExpectedContextBinding,
  SfTeamContextQuery,
  SfTeamContextResult,
} from "@orchestra/schema/sucafina/context"
import type { SfCallOptions, SfTransport, SfTransportResult } from "./transport"

/** Context reads are bound to the installed descriptor, never a caller-provided URL. */
export function createSfContextClient(transport: SfTransport): Readonly<{
  "ctx.context"(input: SfExpectedContextBinding, options: SfCallOptions): Promise<SfTransportResult<SfContextResult>>
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

/** Versioned Microsoft context; selection never supplies a principal or a grant. */
export function createSfTeamContextClient(transport: SfTransport): Readonly<{
  "ctx.context"(input: SfTeamContextQuery, options: SfCallOptions): Promise<SfTransportResult<SfTeamContextResult>>
}> {
  const operation = { operationId: "ctx.context" as const, input: SfTeamContextQuery, output: SfTeamContextResult }
  return Object.freeze({
    "ctx.context": (input: SfTeamContextQuery, options: SfCallOptions) => transport.execute(operation, input, options),
  })
}
