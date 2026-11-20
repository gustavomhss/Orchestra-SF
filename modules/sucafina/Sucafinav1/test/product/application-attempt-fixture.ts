import { expect } from "bun:test"
import { applicationAttempts } from "../../product/decisions/application-attempt.ts"

/** Unwrap only a verified selection; ambiguous provenance must fail the fixture. */
export function requireApplicationAttempts(...input: Parameters<typeof applicationAttempts>) {
  const selected = applicationAttempts(...input)
  expect(selected.status).toBe("verified")
  if (selected.status !== "verified") throw new Error("Application attempt provenance is ambiguous")
  return selected.entries
}
