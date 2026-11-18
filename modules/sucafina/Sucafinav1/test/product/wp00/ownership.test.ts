import { expect, test } from "bun:test"
import manifest from "../../../docs/product-campaign/wp00/ownership-v1.json"
import { findOwnershipConflicts, resolveOwnership } from "../../../docs/product-campaign/wp00/check-ownership.ts"
import type { OwnershipGrant } from "../../../docs/product-campaign/wp00/check-ownership.ts"

const grants = [...manifest.grants, ...manifest.exactExceptions] as OwnershipGrant[]
const policy = { grants, exactExceptions: manifest.exactExceptions as OwnershipGrant[], excludedPrefixes: manifest.excludedPrefixes, transfers: manifest.transfers }

test("the frozen fifteen-WP ownership inventory has no overlapping writers", () => {
  expect(new Set(grants.map((grant) => grant.owner)).size).toBe(15)
  expect(findOwnershipConflicts(grants, policy.transfers)).toEqual([])
  expect(manifest.source.planningSha).toBe("dbf9547211d9b0fade619790de7c19c0869b7c7d")
})

test("ownership detects duplicate exact files, nested prefixes and exact paths inside another writer", () => {
  const exact: OwnershipGrant = { owner: "WP-A", kind: "exact", path: "domain/file.ts" }
  const prefix: OwnershipGrant = { owner: "WP-B", kind: "prefix", path: "domain/" }
  expect(findOwnershipConflicts([exact, { ...exact, owner: "WP-C" }])).toHaveLength(1)
  expect(findOwnershipConflicts([exact, prefix])).toHaveLength(1)
  expect(findOwnershipConflicts([prefix, { owner: "WP-C", kind: "prefix", path: "domain/nested/" }])).toHaveLength(1)
  expect(findOwnershipConflicts([{ owner: "WP-A", kind: "prefix", path: "domain/one/" }, { owner: "WP-B", kind: "prefix", path: "domain/other/" }])).toEqual([])
  expect(findOwnershipConflicts([exact, { ...prefix, owner: exact.owner }])).toEqual([])
  for (const path of ["domain/../escape.ts", "/root/file.ts", "domain//file.ts", "domain\\file.ts", "domain/./file.ts"])
    expect(() => findOwnershipConflicts([{ ...exact, path }])).toThrow("Invalid ownership path")
})

test("the check-workflow exception is exact and never opens Azure or another WP", () => {
  expect(resolveOwnership(".github/workflows/astra-wp00-check.yml", policy)).toEqual(["WP00"])
  expect(resolveOwnership(".github/workflows/test-ci.yml", policy)).toEqual([])
  expect(resolveOwnership("azure/deploy.ts", policy)).toEqual([])
  expect(resolveOwnership("modules/relay/src/engine.ts", policy)).toEqual([])
  expect(resolveOwnership("modules/atlas/boundary/script/build.ts", policy)).toEqual(["WP10"])
  expect(resolveOwnership("modules/sucafina/Sucafinav1/product/contracts/state.ts", policy)).toEqual(["WP00"])
  expect(resolveOwnership("modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts", policy)).toEqual(["WP10"])
  expect(resolveOwnership("packages/app-shell/e2e/sucafina/wp00/corpus.spec.ts", policy)).toEqual(["WP00"])
  expect(resolveOwnership("packages/app-shell/e2e/sucafina/operations.spec.ts", policy)).toEqual(["WP10"])
  expect(resolveOwnership("unallocated/file.ts", policy)).toEqual([])
  expect(() => resolveOwnership("modules/sucafina/Sucafinav1/product/contracts/../host-binding/state-provider.ts", policy)).toThrow()
})

test("a handoff only carves its explicit subtree out of the previous writer's prefix", () => {
  expect(findOwnershipConflicts(grants)).toHaveLength(1)
  const intrusion: OwnershipGrant = { owner: "WP10", kind: "exact", path: "packages/app-shell/e2e/sucafina/wp00/intrusion.spec.ts" }
  expect(findOwnershipConflicts([...grants, intrusion], policy.transfers)).toHaveLength(1)
  const other: OwnershipGrant = { owner: "WP99", kind: "prefix", path: "packages/app-shell/e2e/sucafina/wp00/" }
  expect(findOwnershipConflicts([...grants, other], policy.transfers).length).toBeGreaterThan(0)
  expect(() => findOwnershipConflicts(grants, [{ ...policy.transfers[0]!, prefix: "packages/app-shell/e2e/sucafina/" }])).toThrow("Invalid ownership transfer")
})
