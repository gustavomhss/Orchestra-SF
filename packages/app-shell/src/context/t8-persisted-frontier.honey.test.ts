/**
 * T8 persistence HONEY: observes the pre-existing cross-origin candidate.
 * This is not a proof that the owner runtime admits it. The edition-specific
 * fail-closed selection fence is a separately documented production gap.
 */
import { expect, test } from "bun:test"
import { migrateCanonicalLocalServerState, resolveServerList, ServerConnection } from "./server"

const canonical = "http://localhost:4110"
const foreign = "http://localhost:4999"

test("T8 honey: Persist.global's old foreign origin remains a candidate, not authenticated owner evidence", () => {
  const canonicalServer: ServerConnection.Http = { type: "http", http: { url: canonical } }
  const foreignStored: ServerConnection.Http = { type: "http", http: { url: foreign } }
  const resolved = resolveServerList({ props: [canonicalServer], stored: [foreignStored] })
  expect(resolved.map((server) => ServerConnection.key(server))).toEqual([
    ServerConnection.Key.make(canonical),
    ServerConnection.Key.make(foreign),
  ])

  // Migrating a canonical project bucket is not credential, installation or origin admission.
  expect(migrateCanonicalLocalServerState({
    list: [foreignStored],
    projects: { [canonical]: [{ worktree: "/previous-worktree", expanded: true }] },
    lastProject: { [canonical]: "/previous-worktree" },
  }, ServerConnection.Key.make(canonical))).toEqual({
    list: [foreignStored],
    projects: { local: [{ worktree: "/previous-worktree", expanded: true }] },
    lastProject: { local: "/previous-worktree" },
  })
})
