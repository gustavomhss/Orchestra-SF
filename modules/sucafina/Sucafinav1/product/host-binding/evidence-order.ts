/** Ancestors can reopen the same calculation as a sibling. Preserve the producer's replay-cycle guard by resolving each sibling in order. */
export async function mapSfEvidenceInOrder<Input, Output>(values: readonly Input[], read: (value: Input) => Promise<Output>): Promise<Output[]> {
  const results: Output[] = []
  for (const value of values) results.push(await read(value))
  return results
}
