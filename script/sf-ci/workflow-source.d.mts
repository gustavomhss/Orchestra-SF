/** Validates the declared product commit against the actual GitHub event. */
export function candidateSource(
  env?: Readonly<Record<string, string | undefined>>,
  suppliedEvent?: unknown,
): string
