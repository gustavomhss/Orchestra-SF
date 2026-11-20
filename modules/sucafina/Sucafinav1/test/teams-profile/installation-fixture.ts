import { expect } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import type { LocalStore } from "../../runtime/local-contract.ts"
import { openLocalStore } from "../../runtime/local-store.ts"
import { prepareMicrosoftInstallation } from "../../runtime/microsoft-installation.ts"
import { createTeamProfileResolver } from "../../runtime/team-profile-resolver.ts"
import { privateFixture, listenerOrigin, publicOrigin } from "../microsoft-login/private-fixture.ts"
import { group, microsoftFixture, oid, tenant } from "../microsoft-login/oidc-fixture.ts"

export const teamA = "77777777-7777-4777-8777-777777777777"
export const teamB = "88888888-8888-4888-8888-888888888888"
export const installationId = "synthetic-teams-installation"
export const profileA = { installationId, tenantId: tenant, teamObjectId: teamA }
export const profileB = { installationId, tenantId: tenant, teamObjectId: teamB }

/** Real private files, SQLite and signed OIDC; every identifier/credential belongs to this synthetic provider. */
export async function teamProfileFixture(input: {
  teams?: boolean
  admin?: boolean
  sessionSeconds?: number
  tokenSeconds?: number
  grantedScopes?: string | null
} = {}) {
  const privateInstallation = await privateFixture()
  const provider = await microsoftFixture({
    teams: input.teams === false ? undefined : "direct",
    tokenSeconds: input.tokenSeconds, grantedScopes: input.grantedScopes,
  })
  const config = {
    ...privateInstallation.config,
    groups: { dashboard: {}, planner: {}, procurement: {} },
    teams: input.teams === false ? undefined : "direct",
    supremeAdminGroupId: input.admin === false ? undefined : group,
    sessionSeconds: input.sessionSeconds ?? 3600,
  }
  await writeFile(privateInstallation.file, JSON.stringify(config))
  const microsoft = await prepareMicrosoftInstallation(
    { origin: listenerOrigin }, privateInstallation.file, privateInstallation.environment,
    { fetch: provider.fetch, now: () => new Date(provider.clock.value) },
  )
  const directory = path.join(privateInstallation.directory, "business-microsoft")
  const stores: LocalStore[] = []
  const reopen = async () => {
    const store = await openLocalStore(directory, { teamProfiles: { installationId, tenantId: tenant } })
    stores.push(store)
    const profiles = store.teamProfiles
    if (!profiles) throw new Error("Explicit Team profile persistence required")
    const identity = microsoft.createIdentity(store.secrets)
    if (!identity.microsoftSession) throw new Error("Verified Microsoft profile session required")
    const resolver = createTeamProfileResolver({
      installationId, tenantId: tenant, store: profiles, microsoftSession: identity.microsoftSession,
      policy: microsoft.readTeamProfilePolicy, now: () => provider.clock.value,
    })
    return { store, profiles, identity, resolver }
  }
  const installed = await reopen()
  const request = (suffix = "/api/ui/team-profiles", cookies?: string, init?: RequestInit) =>
    new Request(`${publicOrigin}${config.mount}${suffix}`, {
      ...init, headers: { ...(cookies ? { cookie: cookies } : {}), ...init?.headers },
    })
  const login = async (user = oid) => {
    const start = await installed.identity.handle(request("/auth/login"))
    expect(start?.status).toBe(303)
    const location = start?.headers.get("location")
    const challenge = start?.headers.getSetCookie()[0]?.split(";")[0]
    if (!location || !challenge) throw new Error("Signed login challenge required")
    const code = await provider.issueCode(location, user)
    const state = new URL(location).searchParams.get("state")
    const completed = await installed.identity.handle(request(`/auth/callback?code=${encodeURIComponent(code)}&state=${state}`, challenge))
    expect(completed?.status).toBe(303)
    const cookie = completed?.headers.getSetCookie().find((value) => value.includes("_session="))?.split(";")[0]
    if (!cookie) throw new Error("Private session cookie required")
    return cookie
  }
  const logout = (cookie: string) => installed.identity.handle(request("/auth/logout", cookie, { method: "POST", headers: { origin: publicOrigin } }))
  return {
    ...privateInstallation, ...installed, provider, microsoft, config, directory, request, login, logout, reopen,
    close: async () => {
      for (const store of stores.toReversed()) await store.dispose()
      await privateInstallation.close()
    },
  }
}

export function teamRow(id = teamA, displayName = "Synthetic shared Team") {
  return { id, tenantId: tenant, displayName, isArchived: false }
}

export function barrier() {
  const entered = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  return { entered: entered.promise, release: () => release.resolve(), hold: () => { entered.resolve(); return release.promise } }
}
