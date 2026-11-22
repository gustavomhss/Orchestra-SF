import { Schema } from "effect"
import {
  SfTeamContextResult, SfTeamInstallationDescriptor,
  type SfTeamContextQuery,
} from "@orchestra/schema/sucafina/context"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { readSfApplicationSource } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { Application, ApplicationPageView } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { Actor, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { procurementKeys } from "../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { readTeamProfileIntent } from "../../../../modules/sucafina/Sucafinav1/runtime/team-profile-selector.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { publicSfData } from "../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { projectSfProcurementPage } from "./native-ui/procurement.ts"

export type SfTeamNativeProcurementInput = Readonly<{
  request: Request
  handler: (request: Request) => Promise<Response | undefined>
  binding: SfTeamInstallationDescriptor
  profile: TeamProfile.Ref
  readContext: (request: Request, query: SfTeamContextQuery) => Promise<SfTeamContextResult>
  /** Current private Microsoft admission, role/configuration policy and Team catalog. */
  current: () => Promise<boolean>
}>

const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
const reply = (value: unknown, status: number) => Response.json(value, { status, headers })
const denied = () => reply({ status: "denied" }, 403)
const unavailable = () => reply({ status: "unavailable", reason: "procurement-read-unavailable" }, 503)
const stale = () => reply({ status: "stale", reason: "procurement-source-changed" }, 409)

function selection(query: URLSearchParams) {
  const values: { year?: number; month?: number; filter?: string; q?: string; request?: string } = {}
  for (const [key, value] of query) {
    if (query.getAll(key).length !== 1 || !["year", "month", "filter", "q", "request"].includes(key)) return undefined
    if (key === "year") {
      if (!/^202[4-7]$/.test(value)) return undefined
      values.year = Number(value)
    } else if (key === "month") {
      if (!/^(?:[1-9]|1[0-2])$/.test(value)) return undefined
      values.month = Number(value)
    } else if (key === "filter") values.filter = value
    else if (key === "q") values.q = value
    else if (key === "request") values.request = value
  }
  return values
}

async function actorFor(application: Application, request: Request, snapshot: Snapshot): Promise<Actor | undefined> {
  const principal = await application.authenticate(request, {
    surface: "procurement", roleMap: application.rolePolicy?.("procurement") ?? roleMap(snapshot, "procurement"),
  })
  if (!principal?.id || principal.id.startsWith("local:")) return undefined
  const roles = principal.roles.filter((row) => row.surface === "procurement").map((row) => row.role)
  const access = object(object(snapshot.data.access)[principal.id])
  return {
    id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [],
  }
}

/**
 * A read-only Team seam over the original Procurement Application and projection.
 * It creates no store, listener, CRUD producer or legacy SfContext. The original
 * Team writer still owns /teams/<id>/procurement and every CAS/validation effect.
 */
export function createSfTeamNativeProcurement(input: SfTeamNativeProcurementInput) {
  const source = readSfApplicationSource(input.handler)
  if (!source || !Schema.is(SfTeamInstallationDescriptor)(input.binding) || !Schema.is(TeamProfile.Ref)(input.profile) ||
      source.mount !== input.binding.mount + "/teams/" + input.profile.teamObjectId ||
      input.binding.installationId !== input.profile.installationId || input.binding.tenantId !== input.profile.tenantId)
    throw new Error("SF_TEAM_PROCUREMENT_ORIGINAL_SOURCE_REQUIRED")
  const application = source.application
  const query: SfTeamContextQuery = {
    contractRevision: "sf-team-profile/1", kind: "team", installationId: input.profile.installationId,
    tenantId: input.profile.tenantId, teamObjectId: input.profile.teamObjectId, hostId: input.binding.hostId,
  }
  const readContext = async () => {
    const value = await input.readContext(input.request, query)
    if (!Schema.is(SfTeamContextResult)(value)) return undefined
    if (value.status !== "ok") return undefined
    const stamp = value.value.stamp, team = stamp.team
    if (stamp.installationId !== input.binding.installationId || stamp.projectId !== input.binding.projectId ||
        stamp.hostId !== input.binding.hostId || !team ||
        digestSfValue(team.owner.profile) !== digestSfValue(input.profile) ||
        team.owner.principal.tenantId !== input.profile.tenantId ||
        team.owner.principal.principalObjectId !== stamp.principalRef) return undefined
    return value.value
  }
  const current = async () => !input.request.signal.aborted && await input.current()
  return Object.freeze({
    async handle(): Promise<Response | undefined> {
      const request = input.request, url = new URL(request.url)
      if (url.pathname !== input.binding.mount + "/api/ui/pages/CAP25") return undefined
      if (url.origin !== input.binding.publicOrigin || request.method !== "GET" || request.body !== null ||
          url.username || url.password || url.hash ||
          request.headers.get("sec-fetch-site") === "cross-site" ||
          request.headers.has("origin") && request.headers.get("origin") !== input.binding.publicOrigin)
        return denied()
      const declared = request.headers.get("content-length")
      if (url.search.length > 4096 || /%(?![\da-fA-F]{2})/.test(url.search) ||
          request.headers.has("transfer-encoding") || declared !== null && declared !== "0")
        return reply({ status: "needs-input", reason: "invalid-procurement-selection" }, 400)
      const selected = selection(url.searchParams)
      if (!selected) return reply({ status: "needs-input", reason: "invalid-procurement-selection" }, 400)
      const intent = readTeamProfileIntent(request, {
        origin: input.binding.publicOrigin, mount: input.binding.mount,
        installationId: input.binding.installationId, tenantId: input.binding.tenantId,
      })
      if (intent?.kind !== "team" || digestSfValue(intent.profile) !== digestSfValue(input.profile)) return denied()
      let prepared: ApplicationPageView | undefined
      try {
        if (!await current()) return denied()
        const bound = await readContext()
        if (!bound || !await current()) return denied()
        const environment = await application.environment(request)
        const product = await application.productView?.(request, "procurement", "Requests")
        if (product instanceof Response) return unavailable()
        prepared = product
        if (!await current()) return denied()
        const contribution = application.domains.procurement.find((entry) => entry.pages.includes("Requests"))
        if (!contribution) return unavailable()
        const observed = await application.persistence.transaction("procurement", async (snapshot) => {
          const actor = await actorFor(application, request, snapshot)
          if (!actor || actor.id !== bound.stamp.principalRef || !procurementKeys(actor).includes("Requests") ||
              !await current()) return { commit: false, value: undefined }
          if (prepared && !await prepared.current(snapshot, actor)) return { commit: false, value: undefined }
          const view = contribution.domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
          const projection = projectSfProcurementPage("CAP25", view, actor, prepared?.data ?? {}, snapshot)
          if (!projection || !await current()) return { commit: false, value: undefined }
          return { commit: false, value: {
            projection, actorDigest: digestSfValue(actor), sourceDigest: digestSfValue(snapshot),
          } }
        }, { signal: request.signal })
        if (!observed) return denied()
        // Re-read the same original authority and durable producer after awaited IO.
        // F02's Dashboard revision cannot stand in for Procurement's roles/ACL.
        const end = await readContext()
        if (!end || !await current()) return denied()
        if (digestSfValue(end) !== digestSfValue(bound)) return stale()
        const retained = await application.persistence.transaction("procurement", async (snapshot) => {
          if (!await current()) return { commit: false, value: false }
          const preparedActor = await actorFor(application, request, snapshot)
          if (!preparedActor || digestSfValue(preparedActor) !== observed.actorDigest ||
              prepared && !await prepared.current(snapshot, preparedActor) || !await current())
            return { commit: false, value: false }
          // The original actor/ACL observation is last: a true current() or
          // source check must not hide revocation during its own awaited IO.
          const actor = await actorFor(application, request, snapshot)
          return { commit: false, value: !!actor && digestSfValue(actor) === observed.actorDigest &&
            digestSfValue(snapshot) === observed.sourceDigest }
        }, { signal: request.signal })
        if (!retained) return stale()
        // No further IO may outlive the final original Procurement observation.
        return reply({ status: "ok", context: bound.stamp, value: {
          capabilityId: "CAP25", selection: selected, ...observed.projection,
          // This seam publishes a read. It does not invent command authority.
          allowedActionIds: [],
        } }, 200)
      } catch {
        return unavailable()
      } finally {
        prepared?.finish()
      }
    },
  })
}
