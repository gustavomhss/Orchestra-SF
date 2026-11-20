import { Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { TeamProfileCensus } from "@orchestra/core/database/team-profile-census"
import { digestSfValue } from "../product/contracts/canonical.ts"
import type { createTeamProfileResolver, TeamProfileResolution } from "./team-profile-resolver.ts"
import type { prepareMicrosoftInstallation } from "./microsoft-installation.ts"

export type MigrationOperation = "map" | "cut" | "recover"
export interface MigrationLease { readonly _tag: "SfTeamMigrationLease" }
export type MigrationAuditIdentity = Readonly<{
  operation: MigrationOperation
  storageId: string
  sourceDigest: string
  planDigest: string
  principal: TeamProfile.Principal
  configRevision: number
}>
type Resolution = Extract<TeamProfileResolution, { status: "authenticated" }>

/**
 * Private migration administration, independent from Team membership and surface
 * roles. The explicit grant and current supreme-group proof authorize mapping
 * metadata only. They never authorize Session content, replay or a business effect.
 * The migrator must separately verify the real source census and effect frontier.
 */
export function createTeamProfileMigrationAuthority(input: {
  origin: string
  installationId: string
  tenantId: string
  resolver: Pick<ReturnType<typeof createTeamProfileResolver>, "resolve" | "revalidateResolution" | "list">
  microsoft: Pick<Awaited<ReturnType<typeof prepareMicrosoftInstallation>>, "readGrants">
}) {
  if (!URL.canParse(input.origin) || new URL(input.origin).origin !== input.origin ||
      new URL(input.origin).protocol !== "https:" || !Schema.is(TeamProfile.InstallationId)(input.installationId) ||
      !Schema.is(TeamProfile.TenantId)(input.tenantId)) throw new Error("SF_MIGRATION_AUTHORITY_CONFIG_INVALID")
  const { origin, installationId, tenantId } = input
  const resolver = Object.freeze({ ...input.resolver })
  const readGrants = input.microsoft.readGrants
  type Held = {
    request: Request
    intent: string
    plan: TeamProfileCensus.Plan
    planFingerprint: string
    resolution: Resolution
    catalogDigest: string
    grantsDigest: string
    audit: MigrationAuditIdentity
    owners: readonly TeamProfile.Owner[]
    invalidated: boolean
  }
  const leases = new WeakMap<object, Held>()
  const fingerprint = (request: Request) => digestSfValue({
    url: request.url, method: request.method, cookie: request.headers.get("cookie"),
    authorization: request.headers.get("authorization"), selector: request.headers.get("x-sf-team-profile"),
    origin: request.headers.get("origin"), site: request.headers.get("sec-fetch-site"),
  })
  const digest = (value: unknown): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)
  const eligible = (request: Request) => !request.signal.aborted && request.method === "POST" &&
    new URL(request.url).origin === origin && request.headers.get("origin") === origin &&
    request.headers.get("sec-fetch-site") !== "cross-site"
  const sameProfile = (a: TeamProfile.Ref, b: TeamProfile.Ref) =>
    a.installationId === b.installationId && a.tenantId === b.tenantId && a.teamObjectId === b.teamObjectId
  const verify = async (held: Held): Promise<boolean> => {
    try {
      if (held.invalidated || !eligible(held.request) || fingerprint(held.request) !== held.intent ||
          digestSfValue(held.plan) !== held.planFingerprint ||
          !await resolver.revalidateResolution(held.resolution)) throw new Error("stale")
      const [catalog, grants] = await Promise.all([resolver.list(held.request), readGrants()])
      const grant = grants.find((entry) => entry.principalRef === held.audit.principal.principalObjectId)
      if (catalog.status !== "ok" || catalog.configRevision !== held.audit.configRevision ||
          digestSfValue(catalog) !== held.catalogDigest || digestSfValue(grants) !== held.grantsDigest ||
          !grant?.migrationActions?.includes(held.audit.operation) ||
          held.owners.some((owner) => !catalog.profiles.some((row) => row.enabled && sameProfile(row.profile, owner.profile))) ||
          !await resolver.revalidateResolution(held.resolution) || !eligible(held.request) ||
          fingerprint(held.request) !== held.intent || digestSfValue(held.plan) !== held.planFingerprint)
        throw new Error("stale")
      return true
    } catch { held.invalidated = true; return false }
  }
  return Object.freeze({
    async admit(request: Request, operation: MigrationOperation, plan: TeamProfileCensus.Plan): Promise<MigrationLease | undefined> {
      try {
        if (!eligible(request) || !["map", "cut", "recover"].includes(operation) || !plan ||
            plan.version !== 1 || !digest(plan.storageId) || !digest(plan.sourceDigest) || !digest(plan.planDigest) ||
            !Array.isArray(plan.decisions) || plan.requiresCurrentAuthorization !== true) return undefined
        const intent = fingerprint(request), planFingerprint = digestSfValue(plan)
        const owners = Object.freeze(plan.decisions.flatMap((decision) => decision.disposition === "map"
          ? [Schema.decodeUnknownSync(TeamProfile.Owner)(decision.owner)] : []).map((owner) => Object.freeze({
            profile: Object.freeze({ ...owner.profile }), principal: Object.freeze({ ...owner.principal }),
          })))
        if (owners.some((owner) => owner.profile.installationId !== installationId ||
            owner.profile.tenantId !== tenantId || owner.principal.tenantId !== tenantId)) return undefined
        const resolution = await resolver.resolve(request, { contractRevision: "sf-team-profile/1", kind: "administration" })
        if (resolution.status !== "authenticated" || resolution.administration.status !== "available" ||
            resolution.principal.tenantId !== tenantId) return undefined
        const [catalog, grants] = await Promise.all([resolver.list(request), readGrants()])
        if (catalog.status !== "ok" || catalog.configRevision !== resolution.configRevision) return undefined
        const audit = Object.freeze({ operation, storageId: plan.storageId, sourceDigest: plan.sourceDigest,
          planDigest: plan.planDigest, principal: Object.freeze({ ...resolution.principal }), configRevision: catalog.configRevision })
        const held: Held = { request, intent, plan, planFingerprint, resolution, owners,
          catalogDigest: digestSfValue(catalog), grantsDigest: digestSfValue(grants), audit, invalidated: false }
        if (!await verify(held)) return undefined
        const lease = Object.freeze({ _tag: "SfTeamMigrationLease" } satisfies MigrationLease)
        leases.set(lease, held)
        return lease
      } catch { return undefined }
    },
    async verifyCurrent(candidate: unknown): Promise<boolean> {
      if (!candidate || typeof candidate !== "object") return false
      const held = leases.get(candidate)
      return held ? verify(held) : false
    },
    /** Audit metadata is not a transferable grant; consumers keep the opaque lease. */
    async auditIdentity(candidate: unknown): Promise<MigrationAuditIdentity | undefined> {
      if (!candidate || typeof candidate !== "object") return undefined
      const held = leases.get(candidate)
      return held && await verify(held) ? held.audit : undefined
    },
  })
}
