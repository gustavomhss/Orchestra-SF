import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { Surface } from "../../src/identity.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import { projectPlannerSource } from "../planner/port.ts"
import type { SfSourceScope } from "./source-lifecycle.ts"

/** Saved roles define the projection, never authenticate a later caller. Reads authenticate again. */
export function sfPlannerProjectionSelector(snapshot: Snapshot, actor: Actor) {
  return { kind: "planner-source-v1", roles: [...actor.roles].sort(), canWrite: actor.canWrite, roleMapDigest: digestSfValue(roleMap(snapshot, "planner")) }
}

export function projectSfSourceScope(surface: Surface, snapshot: Snapshot, scope: SfSourceScope) {
  const selector = object(scope.selector)
  if (surface !== "planner" || scope.recordType !== "planner-version" || selector.kind !== "planner-source-v1" ||
    selector.roleMapDigest !== digestSfValue(roleMap(snapshot, "planner")) || typeof selector.canWrite !== "boolean" ||
    !Array.isArray(selector.roles) || !selector.roles.every((role): role is string => typeof role === "string")) return undefined
  const access = object(object(snapshot.data.access)[scope.principalRef])
  const actor: Actor = { id: scope.principalRef, roles: selector.roles, canWrite: selector.canWrite,
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  return projectPlannerSource(snapshot, actor, scope.recordId)
}
