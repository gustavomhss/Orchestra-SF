import type { LocalIdentity } from "./local-contract.ts"
import type { SfProductTeams } from "../product/integration/product-authority.ts"
import type { createTeamProfileResolver, TeamProfileAdmission, TeamProfileResolution } from "./team-profile-resolver.ts"
import { readTeamProfileSelector } from "./team-profile-selector.ts"

type Captured = { request: Request; intent: string; valid: boolean }
type Pending = { captured: Captured; result: Promise<TeamProfileResolution> }

/** A private request boundary. Selection is intent; the resolver retains the original verified session. */
export function createTeamProfileIdentityBoundary(input: {
  identity: LocalIdentity
  resolver: ReturnType<typeof createTeamProfileResolver>
  installationId: string
  tenantId: string
  origin: string
  mount: string
}) {
  const identity = Object.freeze({ ...input.identity })
  const resolver = Object.freeze({ ...input.resolver })
  const binding = Object.freeze({
    installationId: input.installationId, tenantId: input.tenantId, origin: input.origin, mount: input.mount,
  })
  const pending = new WeakMap<Request, Pending>()
  const resolutions = new WeakMap<object, Captured>()
  const admissions = new WeakMap<object, Captured>()
  const current = (captured: Captured) => {
    if (captured.request.signal.aborted || intent(captured.request) !== captured.intent) captured.valid = false
    return captured.valid
  }
  const denied = (): TeamProfileResolution => ({ status: "denied" })
  const profiles: SfProductTeams = Object.freeze({
    async resolve(request: Request): Promise<TeamProfileResolution> {
      let held = pending.get(request)
      if (!held) {
        // Parse and seal the original bytes before the first asynchronous identity observation.
        const selector = readTeamProfileSelector(request, binding)
        const captured: Captured = { request, intent: intent(request), valid: selector !== undefined }
        const result = (selector ? resolver.resolve(request, selector) : Promise.resolve(denied()))
          .catch((): TeamProfileResolution => ({ status: "unavailable", reason: "provider-unavailable" }))
          .then((value) => {
            if (!current(captured)) return denied()
            if (value.status === "authenticated") {
              resolutions.set(value, captured)
              if (value.admission) admissions.set(value.admission, captured)
            }
            return value
          })
        held = { captured, result }
        pending.set(request, held)
      }
      if (!current(held.captured)) return denied()
      const result = await held.result
      return current(held.captured) ? result : denied()
    },
    async revalidate(candidate: unknown): Promise<boolean> {
      if (!candidate || typeof candidate !== "object") return false
      const captured = admissions.get(candidate)
      if (!captured || !current(captured)) return false
      const valid = await resolver.revalidate(candidate).catch(() => false)
      return valid && current(captured)
    },
    async readConfiguration(candidate: unknown) {
      if (!candidate || typeof candidate !== "object") return undefined
      const captured = admissions.get(candidate)
      if (!captured || !current(captured)) return undefined
      const configuration = await resolver.readConfiguration(candidate).catch(() => undefined)
      if (!configuration || !current(captured) || !await profiles.revalidate(candidate) || !current(captured))
        return undefined
      return configuration
    },
    async revalidateResolution(candidate: unknown): Promise<boolean> {
      if (!candidate || typeof candidate !== "object") return false
      const captured = resolutions.get(candidate)
      if (!captured || !current(captured)) return false
      const valid = await resolver.revalidateResolution(candidate).catch(() => false)
      return valid && current(captured)
    },
  })
  const admit = async (request: Request): Promise<TeamProfileAdmission | undefined> => {
    const result = await profiles.resolve(request)
    if (result.status !== "authenticated" || result.teams.status !== "ready" || !result.admission ||
        !await profiles.revalidate(result.admission)) return undefined
    return result.admission
  }
  const business: LocalIdentity = Object.freeze({
    ...identity,
    async authenticate(request: Request, context?: Parameters<LocalIdentity["authenticate"]>[1]) {
      if (!context) return null
      const admission = await admit(request)
      if (!admission) return null
      const actor = structuredClone(await identity.authenticate(request, context))
      if (!actor || actor.id !== admission.principal.principalObjectId ||
          !await profiles.revalidate(admission)) return null
      const current = await identity.authenticate(request, context).catch(() => null)
      if (!current || JSON.stringify(current) !== JSON.stringify(actor) || !await profiles.revalidate(admission)) return null
      return actor
    },
    ...(identity.authenticateAll ? { authenticateAll: async (request: Request,
      contexts: Parameters<NonNullable<LocalIdentity["authenticateAll"]>>[1]) => {
      const originalMaps = JSON.stringify(contexts)
      const maps = contexts.map((context) => ({ surface: context.surface, roleMap: context.roleMap.map((row) => ({ ...row })) }))
      const admission = await admit(request)
      if (!admission || !identity.authenticateAll || JSON.stringify(contexts) !== originalMaps) return null
      const observed = structuredClone(await identity.authenticateAll(request, maps))
      if (!observed || observed.some((entry) => entry.actor && entry.actor.id !== admission.principal.principalObjectId) ||
          !await profiles.revalidate(admission) || JSON.stringify(contexts) !== originalMaps) return null
      const current = await identity.authenticateAll(request, maps).catch(() => null)
      if (!current || JSON.stringify(current) !== JSON.stringify(observed) ||
          !await profiles.revalidate(admission) || JSON.stringify(contexts) !== originalMaps) return null
      return observed
    } } : {}),
    async directory(request: Request) {
      const admission = await admit(request)
      if (!admission) throw new Error("SF_TEAM_BUSINESS_CONTEXT_UNAVAILABLE")
      const people = await identity.directory(request)
      if (!await profiles.revalidate(admission)) throw new Error("SF_TEAM_BUSINESS_CONTEXT_UNAVAILABLE")
      return people
    },
    ...(identity.graphDirectory ? { graphDirectory: async (request: Request) => {
      const admission = await admit(request)
      if (!admission || !identity.graphDirectory) throw new Error("SF_TEAM_BUSINESS_CONTEXT_UNAVAILABLE")
      const directory = await identity.graphDirectory(request)
      if (!await profiles.revalidate(admission)) throw new Error("SF_TEAM_BUSINESS_CONTEXT_UNAVAILABLE")
      return directory
    } } : {}),
  })
  // Corporate login, administration and F02 discovery use the original identity.
  // Only legacy business surfaces consume this wrapper; product authority applies profiles itself.
  return Object.freeze({ profiles, identity: business, admit })
}

function intent(request: Request): string {
  return JSON.stringify([
    request.url, request.method, request.headers.get("x-sf-team-profile"),
    request.headers.get("cookie"), request.headers.get("authorization"),
    request.headers.get("origin"), request.headers.get("sec-fetch-site"),
  ])
}
