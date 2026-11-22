import { Schema } from "effect"
import { SessionAccess } from "@orchestra/schema/session-access"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { emptyMap } from "../src/identity.ts"
import type { Surface } from "../src/identity.ts"
import type { SfStateNamespace } from "../product/contracts/state.ts"
import { sfHumanActions, type SfHumanAction } from "../product/integration/human-authority.ts"
import freeze from "../product/contracts/freeze-v1.json"

export const microsoftUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export type TeamSessionGrant = Readonly<{
  principalRef: string
  namespaces: readonly SfStateNamespace[]
  operations: readonly string[]
  humanActions: readonly SfHumanAction[]
  sessionActions: readonly SessionAccess.Action[]
  referenceActions: readonly "list"[]
  migrationActions: readonly ("map" | "cut" | "recover")[]
  connectionActions: readonly ConnectionAccess.Action[]
  connectionResources: readonly ConnectionAccess.Resource[]
  providerBindings: ProviderAccess.Bindings
}>

const namespaces: readonly SfStateNamespace[] = ["preferences", "reviews", "relations", "threads", "confirmations", "cases", "contributions", "documents", "receipts", "atlas", "outbox", "bi-artifacts"]

/** Installation policy is trusted server configuration, never a login claim or an HTTP input. */
export function teamSessionPolicy(value: Record<string, unknown>) {
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
  const grants: TeamSessionGrant[] = value.grants.map((entry: unknown) => {
    if (!record(entry) || Object.keys(entry).some((key) => !["principalRef", "namespaces", "operations", "humanActions", "sessionActions", "referenceActions", "migrationActions", "connectionActions", "connectionResources", "providerBindings"].includes(key)) || typeof entry.principalRef !== "string" || !microsoftUuid.test(entry.principalRef)) throw new Error("Resource-tenant object ID required for product grant")
    const grantedNamespaces = Schema.decodeUnknownSync(Schema.Array(Schema.Literals(namespaces)))(strings(entry.namespaces, namespaces, "namespaces"))
    const operations = strings(entry.operations, freeze.operations.map((operation) => operation.operation), "operations")
    const humanActions = Schema.decodeUnknownSync(Schema.Array(Schema.Literals(sfHumanActions)))(strings(entry.humanActions ?? [], sfHumanActions, "human actions"))
    const sessionActions = Schema.decodeUnknownSync(Schema.Array(SessionAccess.Action))(
      strings(entry.sessionActions === undefined ? [] : entry.sessionActions, SessionAccess.Actions, "session actions"),
    )
    const referenceActions = Schema.decodeUnknownSync(Schema.Array(Schema.Literal("list")))(
      strings(entry.referenceActions === undefined ? [] : entry.referenceActions, ["list"], "reference actions"),
    )
    const migrationActions = Schema.decodeUnknownSync(Schema.Array(Schema.Literals(["map", "cut", "recover"])))(
      strings(entry.migrationActions === undefined ? [] : entry.migrationActions, ["map", "cut", "recover"], "migration actions"),
    )
    const connectionActions = Schema.decodeUnknownSync(Schema.Array(ConnectionAccess.Action))(
      strings(entry.connectionActions === undefined ? [] : entry.connectionActions, ConnectionAccess.Actions, "connection actions"),
    )
    const connectionResources = Schema.decodeUnknownSync(ConnectionAccess.Resources)(
      entry.connectionResources === undefined ? [] : entry.connectionResources,
    ).map((resource) => Object.freeze({ ...resource }))
    const providerBindings = Schema.decodeUnknownSync(ProviderAccess.Bindings)(
      entry.providerBindings === undefined ? [] : entry.providerBindings,
    ).map((binding) => Object.freeze({ ...binding, profile: Object.freeze({ ...binding.profile }),
      connection: Object.freeze({ ...binding.connection }), models: Object.freeze(binding.models.map((model) =>
        Object.freeze({ ...model, limit: Object.freeze({ ...model.limit }) }))) }))
    return Object.freeze({ providerBindings: Object.freeze(providerBindings), principalRef: entry.principalRef.toLowerCase(), namespaces: Object.freeze(grantedNamespaces), operations: Object.freeze(operations), humanActions: Object.freeze(humanActions), sessionActions: Object.freeze(sessionActions), referenceActions: Object.freeze(referenceActions), migrationActions: Object.freeze(migrationActions), connectionActions: Object.freeze(connectionActions), connectionResources: Object.freeze(connectionResources) })
  })
  if (new Set(grants.map((grant) => grant.principalRef)).size !== grants.length) throw new Error("Ambiguous Microsoft product grant")
  return { groups: Object.freeze(groups), grants: Object.freeze(grants.toSorted((left, right) => left.principalRef.localeCompare(right.principalRef))) }
}

function strings(value: unknown, allowed: readonly string[], label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !allowed.includes(item)) || new Set(value).size !== value.length) throw new Error(`Invalid Microsoft ${label}`)
  return [...value].toSorted()
}

export function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
}
