import type { Actor, Command, Environment, Snapshot } from "../../runtime/contract.ts"
import { domain, pages, render } from "../../runtime/planner.ts"

/** The existing Planner is the sole authority for calculations, redaction and command rules. */
export function projectPlanner(snapshot: Snapshot, actor: Actor, environment: Environment) {
  return domain.view(snapshot, actor, environment)
}

/** Preview executes exactly the domain command on a disposable copy. */
export function simulatePlannerCommand(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) {
  const preview = structuredClone(snapshot)
  const result = domain.execute(preview, actor, command, environment)
  return { result, view: domain.view(preview, actor, environment) }
}

export const plannerContribution = { pages, domain, render }

/** Each command retains its own revision and failure; successful previews stay visible. */
export function simulatePlannerCommands(snapshot: Snapshot, actor: Actor, commands: readonly Command[], environment: Environment) {
  const preview = structuredClone(snapshot)
  const results = commands.map((command) => domain.execute(preview, actor, command, environment))
  return { results, view: domain.view(preview, actor, environment) }
}
