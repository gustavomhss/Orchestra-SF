export * as TaskPermission from "./task-permission"

import type { Permission } from "@orchestra/schema/permission"
import type { Config } from "../config"

// Kept apart from the task tool so the Session runner, which the task tool depends on, can derive a child's rules too.
/**
 * The rules every Task child inherits: the parent's effective deny and `external_directory` rules (agent rules and the
 * session column), so a child is never more permissive than its parent on a denied pattern, then a deny of each
 * `experimental.primary_tools` tool, which only primary agents may use. An admission may add rules but cannot drop
 * those denies; inherited denies stay last so a later allow cannot erase them.
 */
export function inheritedPermissions(
  parent: Permission.Ruleset,
  primary: ReadonlyArray<string>,
  admission?: Permission.Ruleset,
): Permission.Ruleset {
  const inherited = parent.filter((rule) => rule.action === "external_directory" || rule.effect === "deny")
  const base = [
    ...inherited,
    ...primary
      .map((action) => ({ action, resource: "*", effect: "deny" as const }))
      .filter((deny) => !inherited.some((rule) => sameRule(rule, deny))),
  ]
  if (!admission) return base
  const denies = base.filter((rule) => rule.effect === "deny")
  const external = base.filter((rule) => rule.effect !== "deny")
  const added = admission.filter((rule) => !base.some((kept) => sameRule(kept, rule)))
  return [
    ...external,
    ...added.filter((rule) => rule.effect !== "deny"),
    ...added.filter((rule) => rule.effect === "deny"),
    ...denies,
  ]
}

function sameRule(left: Permission.Rule, right: Permission.Rule) {
  return left.action === right.action && left.resource === right.resource && left.effect === right.effect
}

/** The configured `experimental.primary_tools`, from the highest-priority document that sets it. */
export function primaryTools(entries: ReadonlyArray<Config.Entry>) {
  return (
    entries
      .filter((entry): entry is Config.Document => entry.type === "document")
      .findLast((entry) => entry.info.experimental?.primary_tools !== undefined)?.info.experimental?.primary_tools ?? []
  )
}
