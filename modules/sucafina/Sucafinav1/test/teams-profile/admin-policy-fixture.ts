import { Database } from "bun:sqlite"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { openLocalStore } from "../../runtime/local-store.ts"
import { teamProfileInstallationId } from "../../runtime/team-profile-access.ts"

export const origin = "https://admin-policy.example.test"
export const mount = "/orchestra"
export const tenant = "11111111-1111-4111-8111-111111111111"
export const principalId = "22222222-2222-4222-8222-222222222222"
export const group = "33333333-3333-4333-8333-333333333333"
export const teamA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
export const teamB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
export const teamC = "cccccccc-cccc-4ccc-8ccc-cccccccccccc"
export const principal = Schema.decodeUnknownSync(TeamProfile.Principal)({ tenantId: tenant, principalObjectId: principalId })

export async function policyFixture(bootstrapEnabledTeamIds: readonly string[] = []) {
  const directory = await mkdtemp(join(tmpdir(), "sf-admin-policy-"))
  const installationId = teamProfileInstallationId({ origin, mount, directory })
  const options = { teamProfilePolicy: { binding: { installationId, tenantId: tenant }, bootstrapEnabledTeamIds } }
  const state = { store: await openLocalStore(directory, options) }
  const profiles = () => {
    if (!state.store.teamProfiles) throw new Error("Actual private Team policy store required")
    return state.store.teamProfiles
  }
  const profile = (teamObjectId = teamA) =>
    Schema.decodeUnknownSync(TeamProfile.Ref)({ installationId, tenantId: tenant, teamObjectId })
  return {
    directory, installationId, state, profiles, profile,
    async reopen() {
      await state.store.dispose()
      state.store = await openLocalStore(directory, options)
      return profiles()
    },
    readRows<T extends object>(sql: string) {
      const db = new Database(join(directory, "installation.sqlite"), { readonly: true, strict: true })
      try { return db.query<T, []>(sql).all() } finally { db.close() }
    },
    async close() {
      await state.store.dispose()
      await rm(directory, { recursive: true, force: true })
    },
  }
}

export function adminCommand(profile: TeamProfile.Ref, action: "enable" | "disable" | "remove", expectedRevision: TeamProfile.ConfigRevision) {
  return Schema.decodeUnknownSync(TeamProfile.AdminCommand)({ profile, action, expectedRevision })
}
