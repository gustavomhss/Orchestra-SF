import { emptyMap } from "../src/identity.ts"
import type { Surface } from "../src/identity.ts"
import type { SfProductGrant } from "../product/integration/product-authority.ts"
import type { SfStateNamespace } from "../product/contracts/state.ts"
import { sfHumanActions } from "../product/integration/human-authority.ts"
import freeze from "../product/contracts/freeze-v1.json" with { type: "json" }

export const microsoftUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const namespaces: readonly SfStateNamespace[] = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "bi-artifacts"]

/** Installation policy is trusted server configuration, never a login claim or an HTTP input. */
export function microsoftPolicy(value: Record<string, unknown>) {
  const configured = value.groups
  if (!record(configured) || Object.keys(configured).some((surface) => !["dashboard", "planner", "procurement"].includes(surface))) throw new Error("Invalid Microsoft surface assignments")
  const groups: Record<Surface, Record<string, string>> = { dashboard: {}, planner: {}, procurement: {} }
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    const mapping = configured[surface]
    if (!record(mapping)) throw new Error("Explicit Microsoft surface assignments required")
    for (const [role, group] of Object.entries(mapping)) {
      if (!emptyMap().some((row) => row.surface === surface && row.role === role) || typeof group !== "string" || !group.startsWith("group:") || !microsoftUuid.test(group.slice(6))) throw new Error("Immutable Microsoft group assignment required")
      groups[surface][role] = group.toLowerCase()
    }
    Object.freeze(groups[surface])
  }
  if (!Array.isArray(value.grants) || value.grants.length > 1000) throw new Error("Explicit Microsoft product grants required")
  const grants: SfProductGrant[] = value.grants.map((entry: unknown) => {
    if (!record(entry) || Object.keys(entry).some((key) => !["principalRef", "namespaces", "operations", "humanActions"].includes(key)) || typeof entry.principalRef !== "string" || !microsoftUuid.test(entry.principalRef)) throw new Error("Resource-tenant object ID required for product grant")
    const grantedNamespaces = strings(entry.namespaces, namespaces, "namespaces") as SfStateNamespace[]
    const operations = strings(entry.operations, freeze.operations.map((operation) => operation.operation), "operations")
    const humanActions = strings(entry.humanActions ?? [], sfHumanActions, "human actions") as typeof sfHumanActions[number][]
    return Object.freeze({ principalRef: entry.principalRef.toLowerCase(), namespaces: Object.freeze(grantedNamespaces), operations: Object.freeze(operations), humanActions: Object.freeze(humanActions) })
  })
  if (new Set(grants.map((grant) => grant.principalRef)).size !== grants.length) throw new Error("Ambiguous Microsoft product grant")
  return { groups: Object.freeze(groups), grants: Object.freeze(grants) }
}

function strings(value: unknown, allowed: readonly string[], label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.includes(item)) || new Set(value).size !== value.length) throw new Error(`Invalid Microsoft ${label}`)
  return [...value]
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
