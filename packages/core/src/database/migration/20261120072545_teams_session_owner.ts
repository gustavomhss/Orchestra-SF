import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20261120072545_teams_session_owner",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(`
        CREATE TABLE \`session_owner\` (
          \`session_id\` text PRIMARY KEY,
          \`installation_id\` text NOT NULL,
          \`tenant_id\` text NOT NULL,
          \`team_object_id\` text NOT NULL,
          \`principal_object_id\` text NOT NULL,
          \`generation\` integer NOT NULL,
          CONSTRAINT "session_owner_id_required" CHECK("session_id" IS NOT NULL),
          CONSTRAINT "session_owner_generation" CHECK("generation" >= 1)
        );
      `)
      yield* tx.run(
        `CREATE INDEX \`session_owner_principal_team_idx\` ON \`session_owner\` (\`installation_id\`,\`tenant_id\`,\`principal_object_id\`,\`team_object_id\`);`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
