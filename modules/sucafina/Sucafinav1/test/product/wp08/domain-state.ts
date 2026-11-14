import { expect } from "bun:test"
import type { Snapshot } from "../../../runtime/contract.ts"
import type { Surface } from "../../../src/identity.ts"

/** Source issuance may append scopes; business rows, versions and physical identities stay exact. */
export function expectUnchangedDomainState(before: Readonly<Record<Surface, Snapshot>>, after: Readonly<Record<Surface, Snapshot>>) {
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    expect(Object.fromEntries(Object.entries(after[surface]).filter(([key]) => key !== "sfSources"))).toEqual(Object.fromEntries(Object.entries(before[surface]).filter(([key]) => key !== "sfSources")))
    expect(after[surface].sfSources?.schemaVersion).toBe(before[surface].sfSources?.schemaVersion)
    expect(after[surface].sfSources?.records).toEqual(before[surface].sfSources?.records)
    for (const [key, original] of Object.entries(before[surface].sfSources?.scopes ?? {})) expect(after[surface].sfSources?.scopes?.[key]).toEqual(original)
  }
}
