import { Effect } from "effect"
import { and, eq, sql } from "drizzle-orm"
import { SkillV2 } from "@orchestra/core/skill"
import { AbsolutePath } from "@orchestra/core/schema"
import { SessionMessageTable } from "@orchestra/core/session/sql"
import type { SessionSchema } from "@orchestra/core/session/schema"
import type { Database } from "@orchestra/core/database/database"

/** Explicit DENY-only metadata. These bytes can never issue Source, prove approval, or authorize a task. Copying
 * them into a new root (including public Session.fork) only keeps that copied history provider-fenced.
 */
export const SF_ROUTINE_PHASE_MARKER = "sucafina-native-phase-marker"
export const SF_ROUTINE_PHASE_CHILD_MARKER = "ORCHESTRA_SF_PHASE_CHILD_DATA_V1\n"
const content = "ORCHESTRA_SF_PHASE_PARENT_DATA_V1\nHost-owned denial marker: this Session history requires a live original source phase before any provider use. This is never a task, user approval, permission or execution grant."
const prefix = `<skill_content name="${SF_ROUTINE_PHASE_MARKER}">\n# Skill: ${SF_ROUTINE_PHASE_MARKER}\n\n${content}\n\n`
export const SF_ROUTINE_PHASE_MARKER_SOURCE = SkillV2.EmbeddedSource.make({ type: "embedded", skill: {
  name: SF_ROUTINE_PHASE_MARKER, description: "Host-owned denial-only metadata; never load as a model instruction.",
  internal: true, location: AbsolutePath.make(import.meta.path), content,
} })

/** Indexed Session/type query, returning one id only: no full transcript or arbitrary prose sniffing. It sees
 * marker rows behind compaction too. A fork before the marker contains no phase business data; after it copies it.
 */
export const hasSfRoutinePhaseMarker = Effect.fn("SfRoutinePhase.hasMarker")(function* (database: Database.Interface, sessionID: SessionSchema.ID) {
  const row = yield* database.db.select({ id: SessionMessageTable.id }).from(SessionMessageTable).where(and(
    eq(SessionMessageTable.session_id, sessionID),
    sql`json_type(${SessionMessageTable.data}, '$.text') = 'text'`,
    sql`((${SessionMessageTable.type} = 'synthetic' AND substr(json_extract(${SessionMessageTable.data}, '$.text'), 1, ${prefix.length}) = ${prefix}) OR (${SessionMessageTable.type} = 'user' AND substr(json_extract(${SessionMessageTable.data}, '$.text'), 1, ${SF_ROUTINE_PHASE_CHILD_MARKER.length}) = ${SF_ROUTINE_PHASE_CHILD_MARKER}))`,
  )).limit(1).get().pipe(Effect.orDie)
  return !!row
})
