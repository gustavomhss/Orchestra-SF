import type { Actor, Command, Environment, Snapshot } from "./contract.ts"
import { changed, conflict, object, rows } from "./contract.ts"
import { migrateDashboard } from "../src/dashboard-role.ts"
import { prepareDashboardImport } from "./dashboard-import.ts"
import { publicSfData } from "../product/integration/public-state.ts"

/** Shared legacy and staged backup-import producer. */
export function executeDashboardBackupImport(snapshot: Snapshot, actor: Actor, command: Command, environment: Environment) {
  if (!actor.roles.includes("admin"))
    return {
      commit: false,
      value: { ok: false, status: 403 }, status: 403,
    }
  if (Object.hasOwn(object(command.values.data), "__sfProductV1"))
    return { commit: false, value: { ok: false, errors: ["Private product state cannot be imported."] }, status: 422 }
  const stale = conflict(snapshot, "dataset", command, publicSfData(snapshot.data))
  if (stale) return { commit: false, value: stale, status: 409 }
  const imported = migrateDashboard(
    object(command.values.data),
    actor,
    command.confirmed === true,
    new Date(environment.at).getFullYear(),
  )
  if (!imported.ok)
    return {
      commit: false,
      value: { ok: false, errors: ["Confirm dataset replacement."] }, status: 422,
    }
  const prepared = prepareDashboardImport(snapshot.data, imported.data)
  if (!prepared.ok) return { commit: false, value: { ok: false, errors: prepared.errors }, status: 422 }
  const before = structuredClone(snapshot.data)
  snapshot.data = prepared.data
  if (Object.hasOwn(before, "__sfProductV1")) snapshot.data.__sfProductV1 = before.__sfProductV1
  for (const [key, version] of Object.entries(snapshot.versions))
    if (key !== "dataset")
      snapshot.versions[key] = {
        version: version.version + 1,
        by: actor.id,
      }
  for (const collection of [
    "opexOwners",
    "opexEntries",
    "capexProjects",
    "capexEntries",
    "members",
    "leaders",
    "hotTopics",
    "projects",
    "risks",
    "contracts",
    "stakeholders",
    "opsTickets",
    "opsSLA",
    "opsHeatmap",
    "secKpi",
    "secActions",
    "secIncidents",
    "secPhishing",
  ])
    for (const record of rows(snapshot.data[collection])) {
      const key = `${collection}:${String(record.id ?? "")}`
      if (!snapshot.versions[key]) snapshot.versions[key] = { version: 1, by: actor.id }
    }
  for (const key of ["itperf", "cio", "budgetCurrentMonth", "revenueByYear"])
    if (snapshot.data[key] !== undefined && !snapshot.versions[key])
      snapshot.versions[key] = { version: 1, by: actor.id }
  changed(snapshot, "dataset", actor, environment.at, publicSfData(before), publicSfData(snapshot.data))
  snapshot.audit[snapshot.audit.length - 1].name = environment.directory.find(
    (person) => person.id === actor.id,
  )?.name
  return { commit: true, value: { ok: true }, status: 200 }
}
