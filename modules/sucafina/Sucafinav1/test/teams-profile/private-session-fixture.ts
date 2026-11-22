import { join } from "node:path"
import { Schema } from "effect"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { resolve } from "../../src/identity.ts"
import type { Surface } from "../../src/identity.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import type { LocalIdentity } from "../../runtime/local-contract.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { validateMicrosoftConfiguration } from "../../runtime/microsoft-configuration.ts"
import type { MicrosoftConfiguration } from "../../runtime/microsoft-configuration.ts"
import { createTeamProfileAccess } from "../../runtime/team-profile-access.ts"
import { createTeamSessionAdmission } from "../../runtime/team-session-admission.ts"
import { teamSessionPolicy } from "../../runtime/team-session-policy.ts"
import { teamConnectionKey } from "../../runtime/team-connection-crypto.ts"
import { policyFixture, origin, mount, tenant, principalId, principal, group, teamA, teamB } from "./admin-policy-fixture.ts"

/** SQLite is real; Microsoft membership/generation callbacks are controlled unit capabilities. */
export async function privateSessionFixture() {
  const f = await policyFixture([teamA, teamB])
  const hooks: { beforeAuthenticate?: () => Promise<void>; beforeKey?: () => Promise<void>; afterTeams?: () => Promise<void> } = {}
  const state = {
    ...hooks,
    generation: 1, teams: [teamA, teamB], member: true, keyReads: 0, roleReads: 0,
    config: validateMicrosoftConfiguration({
      version: 1, deployment: "azure-https", authentication: "microsoft",
      origin, mount, tenantId: tenant, clientId: "77777777-7777-4777-8777-777777777777",
      listenerOrigin: "http://127.0.0.1:4110", ingressOrigin: "http://fixture-ingress.example.test:4110",
      workspaceDirectory: join(f.directory, "unused-workspace"), scanner: null,
      teams: "direct", enabledTeamIds: [teamA, teamB],
      groups: { dashboard: { contributor: "group:" + group }, planner: {}, procurement: {} },
      grants: [{ principalRef: principalId, namespaces: [], operations: [], sessionActions: ["read", "create"] }],
    }),
  }
  const setConfiguration = (patch: Partial<MicrosoftConfiguration>) => {
    state.config = validateMicrosoftConfiguration({ ...state.config, ...patch })
  }
  const identity: Pick<LocalIdentity, "authenticate"> = {
    authenticate: async (_request, context) => {
      state.roleReads++
      await state.beforeAuthenticate?.()
      return context ? resolve(principalId, [...context.roleMap], (value) => state.member && value === "group:" + group) : null
    },
  }
  const authorizeTeam = createTeamProfileAccess({
    origin, mount, directory: f.directory, tenantId: tenant, enabledTeamIds: [teamA, teamB],
    profilePolicy: f.profiles(), prepare: async () => {},
    observeTeams: async () => {
      const generation = state.generation
      await state.afterTeams?.()
      return {
        result: { state: "complete" as const, tenantId: tenant, principalObjectId: principalId,
          source: "joinedTeams" as const, membership: "direct" as const,
          teams: state.teams.map((teamObjectId) => ({ teamObjectId, name: teamObjectId, archived: false })) },
        verifyCurrent: async () => state.generation === generation,
      }
    },
  })
  const readKey = async () => {
    state.keyReads++
    await state.beforeKey?.()
    return teamConnectionKey(new Uint8Array(32).fill(71))
  }
  const readAdmission = createTeamSessionAdmission({
    origin, mount, installationId: f.installationId, tenantId: tenant, directory: f.directory,
    authorizeTeam, identity, profilePolicy: f.profiles(),
    readCurrentConfiguration: async () => state.config,
    readGrants: async () => teamSessionPolicy({ groups: state.config.groups, grants: state.config.grants }).grants,
    connections: f.state.store.teamConnections, readKey, policyVersion: "sf-team-profile/1",
  })
  const request = (teamObjectId = teamA) => new Request(origin + mount + "/api/session", {
    headers: { "x-sf-team-profile": JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile: f.profile(teamObjectId) }) },
  })
  const write = async (teamObjectId: string, surface: Surface, work: (snapshot: Snapshot) => void) => {
    const store = await openLocalStore(join(f.directory, "business-teams", digestSfValue(f.profile(teamObjectId))))
    try {
      await store.transaction(surface, async (snapshot) => { work(snapshot); return { commit: true, value: undefined } })
    } finally { await store.dispose() }
  }
  const configure = async (document: TeamProfile.ConfigurationDocument, teamObjectId = teamA) => {
    const current = await f.profiles().read()
    return f.profiles().configureConfiguration({
      principal, at: 1700000000000, authorize: async () => true,
      command: { profile: f.profile(teamObjectId), expectedRevision: current.configRevision, document },
    })
  }
  const provider = (teamObjectId = teamA) => Schema.decodeUnknownSync(ProviderAccess.Binding)({
    profile: f.profile(teamObjectId), providerId: "synthetic-provider", name: "Synthetic provider",
    protocol: "openai-chat-completions", endpoint: "https://model.example.test/v1/chat/completions",
    connection: { category: "integration", resourceId: "synthetic-provider", id: "personal" },
    models: [{ id: "synthetic-model", name: "Synthetic model", limit: { context: 8192, output: 1024 }, tools: true }],
  })
  return { ...f, state, setConfiguration, readAdmission, request, write, configure, provider }
}
