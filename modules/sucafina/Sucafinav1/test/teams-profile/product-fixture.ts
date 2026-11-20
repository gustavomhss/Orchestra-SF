import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { writeFile } from "node:fs/promises"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import type { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { emptyMap } from "../../src/identity.ts"
import { readTeamProfileSelector } from "../../runtime/team-profile-selector.ts"
import { createSfProductAuthority } from "../../product/integration/product-authority.ts"
import type { SfProductGrant } from "../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../product/integration/source-lifecycle.ts"
import { createSfSourceScopeProjector } from "../../product/integration/source-projections.ts"
import { enumerateSfSources } from "../../product/integration/source-inventory.ts"
import { createSfDocumentTargetAuthority } from "../../../../../apps/cli/src/sucafina-product/document-authority.ts"
import { digestSfValue } from "../../product/contracts/canonical.ts"
import { oid, other, tenant } from "../microsoft-login/oidc-fixture.ts"
import { publicOrigin } from "../microsoft-login/private-fixture.ts"
import { installationId, profileA, teamProfileFixture, teamRow } from "./installation-fixture.ts"

export const productRoleGroup = "99999999-9999-4999-8999-999999999999"
export const productHostId = "synthetic-current-host"

export function productGrant(principalRef = oid): SfProductGrant {
  return {
    principalRef, namespaces: ["cases", "preferences", "documents", "contributions", "threads"],
    operations: ["sf_context_get", "sf_case_draft", "sf_case_read", "sf_forecast_compare", "sf_work_list"],
    humanActions: ["collaboration.thread.reply"],
  }
}

/** Actual signed Microsoft sessions, private configuration, SQLite, role maps and the installed product authority. */
export async function teamProductFixture(input: {
  roles?: boolean
  grants?: readonly SfProductGrant[]
  enabled?: readonly TeamProfile.Ref[]
  direct?: readonly TeamProfile.Ref[]
  teams?: boolean
  tokenSeconds?: number
  sessionSeconds?: number
} = {}) {
  const f = await teamProfileFixture({ teams: input.teams, tokenSeconds: input.tokenSeconds, sessionSeconds: input.sessionSeconds })
  const grants = input.grants ?? [productGrant(), productGrant(other)]
  const writeGrants = (value: readonly SfProductGrant[]) => writeFile(f.file, JSON.stringify({ ...f.config, grants: value }))
  await writeGrants(grants)
  f.provider.account.groups.push(productRoleGroup)
  f.provider.second.groups.push(productRoleGroup)
  // Role maps are real fixture state. The running authority never seeds or edits them.
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    await f.store.transaction(surface, async (snapshot) => {
      snapshot.data.roleMap = input.roles === false ? [] : emptyMap().filter((row) => row.surface === surface)
        .map((row) => ({ ...row, ...(row.role === "admin" ? { entra: `group:${productRoleGroup}`, version: 1, by: oid } : {}) }))
      snapshot.data.access = { [oid]: { assigned: [], domains: ["finance"] }, [other]: { assigned: [], domains: ["finance"] } }
      return { commit: true, value: undefined }
    })
  }
  const cookie = await f.login()
  const enabled = input.enabled ?? (input.teams === false ? [] : [profileA])
  for (const [index, profile] of enabled.entries()) {
    f.provider.teamResources.set(profile.teamObjectId, teamRow(profile.teamObjectId))
    const result = await f.resolver.configure(f.request(undefined, cookie), { action: "enable", profile, expectedRevision: index })
    expect(result).toEqual({ status: "ok", configRevision: index + 1, changed: true })
  }
  const direct = input.direct ?? enabled
  f.provider.directTeams.set(oid, direct.map((profile) => teamRow(profile.teamObjectId)))
  f.provider.directTeams.set(other, direct.map((profile) => teamRow(profile.teamObjectId)))
  const hooks: { beforeGrants?: () => Promise<void>; beforeCommand?: () => Promise<void>; beforeEnvironment?: () => Promise<void>; beforeConfiguration?: () => Promise<void> } = {}
  const technical = Object.freeze({
    installationId, hostId: productHostId, projectId: "synthetic-technical-project",
    location: Location.Ref.make({ directory: AbsolutePath.make(f.workspaceDirectory) }),
  })
  const binding = Object.freeze({ installationId, tenantId: tenant, origin: publicOrigin, mount: f.config.mount })
  const makeAuthority = (installed: Pick<typeof f, "store" | "identity" | "resolver"> = f) => {
    const persistence = createSfSourcePersistence({
      persistence: installed.store, enumerate: enumerateSfSources, createId: randomUUID,
      projectScope: createSfSourceScopeProjector(() => new Date(f.provider.clock.value).toISOString()),
    })
    const environment = async () => {
      await hooks.beforeEnvironment?.()
      return { at: new Date(f.provider.clock.value).toISOString(), id: randomUUID, directory: [] }
    }
    const options: Parameters<typeof createSfProductAuthority>[0] = {
      installationId, origin: publicOrigin, policyVersion: "sf-product-v1", identity: () => technical,
      persistence, authenticate: installed.identity.authenticate, environment,
      isAuthenticated: async (request) => Boolean(await installed.identity.person(request)),
      grants, readGrants: async () => { await hooks.beforeGrants?.(); return f.microsoft.readGrants() },
      teamConnections: installed.store.teamConnections ? { store: installed.store.teamConnections, readKey: f.microsoft.readConnectionKey } : undefined,
      teamProfiles: {
        revalidate: installed.resolver.revalidate, revalidateResolution: installed.resolver.revalidateResolution,
        readConfiguration: async (admission) => { await hooks.beforeConfiguration?.(); return installed.resolver.readConfiguration(admission) },
        resolve: (request) => {
          const selector = readTeamProfileSelector(request, binding)
          return selector ? installed.resolver.resolve(request, selector) : Promise.resolve({ status: "denied" })
        },
      },
      createId: randomUUID, now: () => f.provider.clock.value,
      commandIdentity: async (request, operation) => {
        await hooks.beforeCommand?.()
        const key = request.headers.get("Idempotency-Key")
        return key ? digestSfValue({ operation, key }) : randomUUID()
      },
      inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => 1,
      authorizeDocument: createSfDocumentTargetAuthority({ persistence, authenticate: installed.identity.authenticate, environment }),
    }
    return { authority: createSfProductAuthority(options), persistence, options }
  }
  const businessRequest = (profile: TeamProfile.Ref = profileA, currentCookie = cookie, init: RequestInit = {}) => {
    const headers = new Headers(init.headers)
    if (!headers.has("x-sf-team-profile"))
      headers.set("x-sf-team-profile", JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team", profile }))
    if (init.method === "POST" && !headers.has("origin")) headers.set("origin", publicOrigin)
    return f.request("/dashboard", currentCookie, { ...init, headers: Object.fromEntries(headers) })
  }
  const contextRequest = (kind: "selection" | "team" | "administration" = "selection", profile: TeamProfile.Ref = profileA, currentCookie = cookie) => {
    const query = new URLSearchParams({ contractRevision: "sf-team-profile/1", installationId, tenantId: tenant, hostId: productHostId, kind })
    if (kind === "team") query.set("teamObjectId", profile.teamObjectId)
    return f.request(`/api/ui/context?${query}`, currentCookie)
  }
  const product = makeAuthority()
  // Match local/entry: source identities exist before the guarded product persistence is used.
  for (const surface of ["dashboard", "planner", "procurement"] as const) await product.persistence.initializeSources(surface)
  return { ...f, ...product, cookie, grants, writeGrants, hooks, technical, binding, makeAuthority, businessRequest, contextRequest }
}
