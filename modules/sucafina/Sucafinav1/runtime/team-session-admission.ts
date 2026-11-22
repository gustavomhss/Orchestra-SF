import { AsyncLocalStorage } from "node:async_hooks"
import path from "node:path"
import { Effect, Option, Schema } from "effect"
import { ConnectionAccess } from "@orchestra/schema/connection-access"
import { ProviderAccess } from "@orchestra/schema/provider-access"
import { SessionAccess } from "@orchestra/schema/session-access"
import { Session } from "@orchestra/schema/session"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { CredentialVault } from "@orchestra/core/credential/vault"
import { ProviderAdmission } from "@orchestra/core/provider/admission"
import type { SessionOwner } from "@orchestra/core/session/owner"
import type { SessionSchema } from "@orchestra/core/session/schema"
import { digestSfValue } from "../product/contracts/canonical.ts"
import { emptyMap } from "../src/identity.ts"
import type { Surface } from "../src/identity.ts"
import { object } from "./contract.ts"
import type { Snapshot } from "./contract.ts"
import type { LocalIdentity, LocalStore } from "./local-contract.ts"
import { openLocalStore } from "./local-store.ts"
import type { MicrosoftConfiguration } from "./microsoft-configuration.ts"
import type { TeamConnectionAccess, TeamConnectionStore } from "./team-connection-store.ts"
import type { TeamConnectionKey } from "./team-connection-crypto.ts"
import { teamProfileInstallationId } from "./team-profile-access.ts"
import type { createTeamProfileAccess } from "./team-profile-access.ts"
import type { TeamProfilePolicyStore } from "./team-profile-store.ts"
import { teamSessionPolicy } from "./team-session-policy.ts"
import type { TeamSessionGrant } from "./team-session-policy.ts"

type TeamAccess = ReturnType<typeof createTeamProfileAccess>
type TeamAdmission = Extract<Awaited<ReturnType<TeamAccess>>, { status: "allowed" }>
type BusinessRead = {
  request: Request
  profile: TeamProfile.Ref
  snapshots: Readonly<Record<Surface, Snapshot>>
  store: LocalStore
  open: boolean
}
const surfaces = ["dashboard", "planner", "procurement"] as const

/**
 * Private Microsoft producer for Core's process-local Owner lease.
 * It never activates a generation, opens Core, or accepts a serialized actor.
 */
export function createTeamSessionAdmission(input: Readonly<{
  origin: string
  mount: string
  installationId: string
  tenantId: string
  directory: string
  authorizeTeam: TeamAccess
  identity: Pick<LocalIdentity, "authenticate">
  profilePolicy: Pick<TeamProfilePolicyStore, "read" | "readConfiguration">
  readCurrentConfiguration: () => Promise<MicrosoftConfiguration>
  readGrants: () => Promise<readonly TeamSessionGrant[]>
  connections?: TeamConnectionStore
  readKey?: () => Promise<TeamConnectionKey>
  policyVersion: string
}>) {
  if (input.installationId !== teamProfileInstallationId(input) || !input.policyVersion)
    throw new Error("SF_SESSION_INSTALLATION_BINDING_INVALID")
  const retained = new WeakMap<Request, Promise<SessionOwner.Admission | undefined>>()
  const business = new AsyncLocalStorage<BusinessRead>()
  const intent = (request: Request) => digestSfValue({
    url: request.url, method: request.method, profile: request.headers.get("x-sf-team-profile"),
    origin: request.headers.get("origin"), site: request.headers.get("sec-fetch-site"),
  })
  const valid = (request: Request, sealed: string) => !request.signal.aborted &&
    new URL(request.url).origin === input.origin && intent(request) === sealed &&
    request.headers.get("sec-fetch-site") !== "cross-site" &&
    (!request.headers.has("origin") || request.headers.get("origin") === input.origin)
  const policy = async () => {
    const configuration = await input.readCurrentConfiguration()
    if (configuration.teams !== "direct" || configuration.origin !== input.origin ||
        configuration.mount !== input.mount || configuration.tenantId !== input.tenantId)
      throw new Error("SF_SESSION_PRIVATE_POLICY_UNAVAILABLE")
    const current = teamSessionPolicy({ groups: configuration.groups, grants: configuration.grants })
    const grants = await input.readGrants()
    if (digestSfValue(grants) !== digestSfValue(current.grants))
      throw new Error("SF_SESSION_PRIVATE_POLICY_CHANGED")
    return current
  }
  const withBusiness = async <A>(request: Request, profile: TeamProfile.Ref, work: (read: BusinessRead) => Promise<A>): Promise<A> => {
    const active = business.getStore()
    if (active) {
      if (!active.open || active.request !== request || digestSfValue(active.profile) !== digestSfValue(profile) ||
          !active.store.hasCurrentSnapshots?.() || request.signal.aborted)
        throw new Error("SF_SESSION_BUSINESS_SCOPE_UNAVAILABLE")
      const result = await work(active)
      if (!active.open || !active.store.hasCurrentSnapshots?.() || request.signal.aborted)
        throw new Error("SF_SESSION_BUSINESS_SCOPE_UNAVAILABLE")
      return result
    }
    request.signal.throwIfAborted()
    // The same partition used by runTeamBusiness; never the installation's auth/admin snapshots.
    const store = await openLocalStore(path.join(input.directory, "business-teams", digestSfValue(profile)))
    try {
      if (!store.readSnapshotRoot) throw new Error("SF_SESSION_BUSINESS_SCOPE_UNAVAILABLE")
      return await store.readSnapshotRoot(() => store.transaction("dashboard", async (dashboard) => {
        const snapshots = store.currentSnapshots?.()
        if (!snapshots) throw new Error("SF_SESSION_BUSINESS_SCOPE_UNAVAILABLE")
        const read: BusinessRead = { request, profile, store, snapshots: { ...snapshots, dashboard }, open: true }
        try {
          return { commit: false, value: await business.run(read, () => work(read)) }
        } finally { read.open = false }
      }, { signal: request.signal }), { signal: request.signal })
    } finally { await store.dispose() }
  }
  const capture = async (request: Request): Promise<SessionOwner.Admission | undefined> => {
    const sealed = intent(request)
    if (!valid(request, sealed)) return undefined
    // Capture once. A later refresh/login must never replace this Request's generation.
    const team = await input.authorizeTeam(request).catch(() => undefined)
    if (team?.status !== "allowed" || team.profile.installationId !== input.installationId ||
        team.profile.tenantId !== input.tenantId || !await team.verifyCurrent().catch(() => false))
      return undefined
    const held: TeamAdmission = team
    const prove = async () => valid(request, sealed) && await held.verifyCurrent().catch(() => false) && valid(request, sealed)
    const roleObservation = async () => {
      if (!await prove()) return undefined
      const current = await policy()
      const grant = current.grants.find((value) => value.principalRef === held.principalObjectId)
      if (!grant) return undefined
      const mapped = surfaces.map((surface) => ({
        surface, rows: emptyMap().filter((row) => row.surface === surface)
          .map((row) => ({ ...row, entra: current.groups[surface][row.role] ?? null })),
      }))
      const observed = await Promise.all(mapped.map(async (entry) => ({
        surface: entry.surface,
        actor: await input.identity.authenticate(request, { surface: entry.surface, roleMap: entry.rows }),
      })))
      const present = observed.flatMap((entry) => entry.actor ? [{ ...entry, actor: entry.actor }] : [])
      if (present.some((entry) => entry.actor.id !== held.principalObjectId)) return undefined
      const roles = present.flatMap((entry) => entry.actor.roles.filter((role) => role.surface === entry.surface))
        .map((role) => ({ surface: role.surface, role: role.role }))
        .toSorted((left, right) => (left.surface + ":" + left.role).localeCompare(right.surface + ":" + right.role))
      if (!roles.length || digestSfValue(await policy()) !== digestSfValue(current) || !await prove())
        return undefined
      return { grant, mapped, roles, canWrite: present.some((entry) => entry.actor.canWrite), policy: current }
    }
    // No business file is opened for a missing explicit grant or an absent current Microsoft role.
    const preflight = await roleObservation().catch(() => undefined)
    if (!preflight) return undefined
    const effective = async (read: BusinessRead) => {
      const actor = await roleObservation()
      if (!actor) return undefined
      const catalog = await input.profilePolicy.read()
      if (!catalog.profiles.some((entry) => entry.enabled && digestSfValue(entry.profile) === digestSfValue(held.profile)))
        return undefined
      const scopes = surfaces.map((surface) => {
        const access = object(object(read.snapshots[surface].data.access)[held.principalObjectId])
        if ((access.assigned !== undefined && (!Array.isArray(access.assigned) || access.assigned.some((value) => typeof value !== "string"))) ||
            (access.domains !== undefined && (!Array.isArray(access.domains) || access.domains.some((value) => typeof value !== "string"))))
          throw new Error("SF_SESSION_ACCESS_SCOPE_INVALID")
        return { surface, assigned: Array.isArray(access.assigned) ? [...new Set(access.assigned)].toSorted() : [],
          domains: Array.isArray(access.domains) ? [...new Set(access.domains)].toSorted() : [] }
      })
      if (digestSfValue(await policy()) !== digestSfValue(actor.policy) ||
          (await input.profilePolicy.read()).configRevision !== catalog.configRevision || !await prove() ||
          !read.open || !read.store.hasCurrentSnapshots?.() || !valid(request, sealed))
        return undefined
      return {
        principalRef: held.principalObjectId, grant: actor.grant, canWrite: actor.canWrite,
        configRevision: catalog.configRevision,
        accessRevision: digestSfValue({
          principal: { tenantId: input.tenantId, principalObjectId: held.principalObjectId }, profile: held.profile,
          configRevision: catalog.configRevision, roles: actor.roles, roleMaps: actor.mapped, scopes,
          canWrite: actor.canWrite, grant: actor.grant, policyVersion: input.policyVersion,
        }),
      }
    }
    const initial = await withBusiness(request, held.profile, effective).catch(() => undefined)
    if (!initial) return undefined
    const decoded = Schema.decodeUnknownSync(TeamProfile.Binding)({
      owner: { profile: held.profile, principal: { tenantId: input.tenantId, principalObjectId: initial.principalRef } },
      revisions: { configRevision: initial.configRevision, accessRevision: initial.accessRevision },
    })
    const binding = Object.freeze({
      owner: Object.freeze({ profile: Object.freeze({ ...decoded.owner.profile }), principal: Object.freeze({ ...decoded.owner.principal }) }),
      revisions: Object.freeze({ ...decoded.revisions }),
    })
    const same = (current: Awaited<ReturnType<typeof effective>>) => !!current &&
      current.principalRef === initial.principalRef && current.accessRevision === initial.accessRevision &&
      current.configRevision === initial.configRevision && valid(request, sealed)
    const resolve = () => withBusiness(request, held.profile, effective)
    const observe = () => withBusiness(request, held.profile, async (read) => {
      const actor = await effective(read)
      if (!actor || !same(actor)) return undefined
      const excluded = nativeExclusions(actor.principalRef, actor.grant, read.snapshots.dashboard)
      return excluded && { actor, excluded }
    })
    const allowed = (current: NonNullable<Awaited<ReturnType<typeof observe>>>, action: SessionAccess.Action, sessionID?: SessionSchema.ID) =>
      SessionAccess.Actions.some((known) => known === action) &&
      (sessionID !== undefined || action === "read" || action === "create") &&
      current.actor.grant.sessionActions.includes(action) && (action === "read" || current.actor.canWrite) &&
      (sessionID === undefined || !current.excluded.includes(sessionID))
    const providers: ProviderAdmission.Factory = (fence) => Effect.promise(async () => {
      if (typeof fence !== "function" || !same(await resolve().catch(() => undefined))) return undefined
      const current = async () => {
        if (!await Effect.runPromise(fence())) throw new Error("SF_PROVIDER_UNAVAILABLE")
        const actor = await resolve().catch(() => undefined)
        if (!actor || !same(actor) || !await Effect.runPromise(fence())) throw new Error("SF_PROVIDER_UNAVAILABLE")
        return actor.grant.providerBindings.filter((value) =>
          digestSfValue(value.profile) === digestSfValue(binding.owner.profile) &&
          actor.grant.connectionActions.includes("read") &&
          actor.grant.connectionResources.some((resource) => resource.category === value.connection.category &&
            resource.resourceId === value.connection.resourceId))
      }
      const run = <A>(work: () => Promise<A>): Effect.Effect<A, ProviderAdmission.Denied> => Effect.tryPromise({
        try: work, catch: () => new ProviderAdmission.Denied({ reason: "unavailable" }),
      })
      const client: ProviderAdmission.Interface = {
        owner: binding.owner,
        list: () => run(async () => Object.freeze(await current())),
        verify: (value) => {
          const selected = digestSfValue(Schema.decodeUnknownSync(ProviderAccess.Binding)(value))
          return run(async () => {
            if (!(await current()).some((candidate) => digestSfValue(candidate) === selected))
              throw new Error("SF_PROVIDER_UNAVAILABLE")
          })
        },
      }
      return Object.freeze(client)
    })
    const connections: CredentialVault.Factory = (fence) => Effect.promise(async () => {
      const connectionStore = input.connections
      const readKey = input.readKey
      if (!connectionStore || !readKey || typeof fence !== "function" || !same(await resolve().catch(() => undefined)))
        return undefined
      const authorize: TeamConnectionAccess["authorize"] = async (action, resources) => {
        if (!await Effect.runPromise(fence())) return false
        const actor = await resolve().catch(() => undefined)
        if (!await Effect.runPromise(fence())) return false
        return !!actor && same(actor) && ConnectionAccess.Actions.some((known) => known === action) &&
          actor.grant.connectionActions.includes(action) && (action === "read" || actor.canWrite) &&
          resources.every((resource) => actor.grant.connectionResources.some((value) =>
            value.category === resource.category && value.resourceId === resource.resourceId))
      }
      const access = async (): Promise<TeamConnectionAccess> => ({
        owner: binding.owner, key: await readKey(), authorize, signal: request.signal,
      })
      const run = <A>(work: () => Promise<A>): Effect.Effect<A, CredentialVault.Denied> => Effect.tryPromise({
        // Team read lock first, private connection writer second. Its final authorization reuses this exact Team snapshot.
        try: () => withBusiness(request, held.profile, work),
        catch: (error) => new CredentialVault.Denied({ reason:
          error instanceof Error && error.message === "SF_TEAM_CONNECTION_CONFLICT" ? "conflict" :
          error instanceof Error && error.message === "SF_TEAM_CONNECTION_FORBIDDEN" ? "forbidden" : "unavailable" }),
      })
      const client: CredentialVault.Interface = {
        owner: binding.owner,
        check: (action, resource) => {
          const selected = Schema.decodeUnknownSync(ConnectionAccess.Action)(action)
          const target = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Resource)(resource) })
          return run(async () => {
            if (!await authorize(selected, Object.freeze([target]))) throw new Error("SF_TEAM_CONNECTION_FORBIDDEN")
          })
        },
        list: (category, resourceId) => {
          const selected = Schema.decodeUnknownSync(ConnectionAccess.Category)(category)
          const resources = resourceId === undefined
            ? Object.freeze(initial.grant.connectionResources.filter((resource) => resource.category === selected)
              .map((resource) => Object.freeze({ ...resource })))
            : Object.freeze([Object.freeze({ category: selected, resourceId: Schema.decodeUnknownSync(ConnectionAccess.Identifier)(resourceId) })])
          return run(async () => connectionStore.list(await access(), resources))
        },
        inspect: (key) => {
          const selected = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Key)(key) })
          return run(async () => connectionStore.inspect(await access(), selected))
        },
        read: (key) => {
          const selected = Object.freeze({ ...Schema.decodeUnknownSync(ConnectionAccess.Key)(key) })
          return run(async () => connectionStore.read(await access(), selected))
        },
        write: (value) => {
          const decoded = Schema.decodeUnknownSync(ConnectionAccess.Write)(value)
          const command = Object.freeze({ ...decoded, key: Object.freeze({ ...decoded.key }) })
          return run(async () => connectionStore.write(await access(), command))
        },
        remove: (value) => {
          const decoded = Schema.decodeUnknownSync(ConnectionAccess.Remove)(value)
          const command = Object.freeze({ ...decoded, key: Object.freeze({ ...decoded.key }) })
          return run(async () => connectionStore.remove(await access(), command))
        },
      }
      return Object.freeze(client)
    })
    return Object.freeze({
      binding, providers, connections,
      verifyCurrent: () => Effect.promise(async () => same(await resolve().catch(() => undefined))),
      authorize: (action: SessionAccess.Action, sessionID?: SessionSchema.ID) => Effect.promise(async () => {
        const current = await observe().catch(() => undefined)
        return !!current && allowed(current, action, sessionID)
      }),
      inspect: (operations: ReadonlyArray<SessionOwner.InspectionOperation>) => Effect.promise(async () => {
        const requested = operations.map(({ action, sessionID }) => Object.freeze({ action, sessionID }))
        const current = await observe().catch(() => undefined)
        return current && Object.freeze({
          authorized: requested.every(({ action, sessionID }) => allowed(current, action, sessionID)),
          excludedSessions: Object.freeze([...current.excluded]),
        })
      }),
      excludedSessions: () => Effect.promise(async () => {
        const current = await observe()
        if (!current || !current.actor.grant.sessionActions.includes("read"))
          throw new Error("SF_SESSION_RESOURCE_POLICY_UNAVAILABLE")
        return Object.freeze([...current.excluded])
      }),
      configuration: () => Effect.promise(async () => {
        if (!same(await resolve().catch(() => undefined))) return undefined
        const value = await input.profilePolicy.readConfiguration(binding.owner.profile).catch(() => undefined)
        if (!value || value.configRevision !== binding.revisions.configRevision ||
            digestSfValue(value.profile) !== digestSfValue(binding.owner.profile) ||
            !same(await resolve().catch(() => undefined))) return undefined
        return value
      }),
    })
  }
  return (request: Request) => {
    const existing = retained.get(request)
    if (existing) return existing
    const pending = capture(request).catch(() => undefined)
    retained.set(request, pending)
    return pending
  }
}

/** Native resources remain governed by the current case within this exact Team partition. */
function nativeExclusions(principalRef: string, grant: TeamSessionGrant, snapshot: Snapshot) {
  const raw = snapshot.data.__sfProductV1
  if (raw !== undefined && (!raw || typeof raw !== "object" || Array.isArray(raw))) return undefined
  const stored = object(raw)
  if (stored.nativeRuns !== undefined &&
      (!stored.nativeRuns || typeof stored.nativeRuns !== "object" || Array.isArray(stored.nativeRuns))) return undefined
  const denied = new Set<SessionSchema.ID>()
  const runs = new Map<SessionSchema.ID, number>()
  for (const value of Object.values(object(stored.nativeRuns))) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined
    const run = object(value)
    if (run.native === undefined) continue
    if (!run.native || typeof run.native !== "object" || Array.isArray(run.native)) return undefined
    const selected = Schema.decodeUnknownOption(Session.ID)(object(run.native).sessionID)
    if (Option.isNone(selected) || typeof run.principalRef !== "string") return undefined
    const sessionID = selected.value
    runs.set(sessionID, (runs.get(sessionID) ?? 0) + 1)
    if (run.principalRef !== principalRef) continue
    const ref = object(run.caseRef)
    const currentCase = typeof ref.id === "string" ? object(object(stored.cases)[ref.id]) : {}
    if (!grant.namespaces.includes("cases") || !grant.namespaces.includes("contributions") ||
        !currentCase.id || currentCase.id !== ref.id || currentCase.incarnation !== ref.incarnation ||
        !Array.isArray(currentCase.participants) || !currentCase.participants.includes(principalRef))
      denied.add(sessionID)
  }
  for (const [sessionID, count] of runs) if (count !== 1) denied.add(sessionID)
  const selected = Schema.decodeUnknownOption(SessionAccess.ExcludedSessions)([...denied].toSorted())
  return Option.isSome(selected) ? selected.value : undefined
}
