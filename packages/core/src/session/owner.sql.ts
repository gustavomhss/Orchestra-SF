import { check, index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core"
import { sql } from "drizzle-orm"
import { Effect } from "effect"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { Database } from "../database/database"
import type { SessionSchema } from "./schema"

/**
 * Ownership outlives deletion of content. Keeping the consumed ID prevents a
 * later create/import from assigning historical effects to another person.
 */
export const SessionOwnerTable = sqliteTable("session_owner", {
  session_id: text().$type<SessionSchema.ID>().primaryKey().notNull(),
  installation_id: text().$type<TeamProfile.InstallationId>().notNull(),
  tenant_id: text().$type<TeamProfile.TenantId>().notNull(),
  team_object_id: text().$type<TeamProfile.TeamObjectId>().notNull(),
  principal_object_id: text().$type<TeamProfile.PrincipalObjectId>().notNull(),
  generation: integer().notNull(),
}, (table) => [
  check("session_owner_id_required", sql`${table.session_id} IS NOT NULL`),
  check("session_owner_generation", sql`${table.generation} >= 1`),
  index("session_owner_principal_team_idx").on(
    table.installation_id, table.tenant_id, table.principal_object_id, table.team_object_id,
  ),
])

type Transaction = Parameters<Parameters<Database.Interface["db"]["transaction"]>[0]>[0]

/** The new migration owns registration; this never infers owners for existing rows. */
export function ensureSchema(tx: Transaction): Effect.Effect<void, unknown> {
  return Effect.gen(function* () {
    yield* tx.run(sql`CREATE TABLE IF NOT EXISTS session_owner (
      session_id TEXT PRIMARY KEY NOT NULL,
      installation_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL,
      team_object_id TEXT NOT NULL,
      principal_object_id TEXT NOT NULL,
      generation INTEGER NOT NULL,
      CONSTRAINT session_owner_id_required CHECK (session_id IS NOT NULL),
      CONSTRAINT session_owner_generation CHECK (generation >= 1)
    )`)
    yield* tx.run(sql`CREATE INDEX IF NOT EXISTS session_owner_principal_team_idx
      ON session_owner (installation_id, tenant_id, principal_object_id, team_object_id)`)
  })
}
