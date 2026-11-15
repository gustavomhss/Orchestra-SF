import { SfMemory } from "@orchestra/schema/sucafina/memory"
import type { SfCallOptions, SfTransport } from "./transport.ts"

// Existing seven dashboard?sf=memory-* JSON handlers are invoked by F02's
// admitted transport. No browser-side materiality, Atlas recall, memory writes,
// arbitrary operation dispatch, auth policy or response caching belongs here.
export function createSfMemoryClient(transport: SfTransport) {
  return {
    "intelligence.memory-catalog": (
      input: typeof SfMemory.operations["intelligence.memory-catalog"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfMemory.operations["intelligence.memory-catalog"], input, options),

    "intelligence.memory-conditions": (
      input: typeof SfMemory.operations["intelligence.memory-conditions"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfMemory.operations["intelligence.memory-conditions"], input, options),

    "intelligence.memory-signals": (
      input: typeof SfMemory.operations["intelligence.memory-signals"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfMemory.operations["intelligence.memory-signals"], input, options),

    "intelligence.memory-materiality": (
      input: typeof SfMemory.operations["intelligence.memory-materiality"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfMemory.operations["intelligence.memory-materiality"], input, options),

    "intelligence.memory-outcome": (
      input: typeof SfMemory.operations["intelligence.memory-outcome"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfMemory.operations["intelligence.memory-outcome"], input, options),

    "intelligence.memory-condition": (
      input: typeof SfMemory.operations["intelligence.memory-condition"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfMemory.operations["intelligence.memory-condition"], input, options),

    "intelligence.memory-outcome-selection": (
      input: typeof SfMemory.operations["intelligence.memory-outcome-selection"]["input"]["Type"],
      options: SfCallOptions,
    ) => transport.execute(SfMemory.operations["intelligence.memory-outcome-selection"], input, options),
  } as const
}
