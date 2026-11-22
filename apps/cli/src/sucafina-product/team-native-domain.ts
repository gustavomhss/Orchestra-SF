import { Option, Schema } from "effect"
import { Buffer } from "node:buffer"
import { SfNativeOwnerExpectation, SfTeamContext, SfTeamContextQuery, SfTeamInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { SfTeamContextResult } from "@orchestra/schema/sucafina/context"
import { SfDomain, SfDomainReadSelection } from "@orchestra/schema/sucafina/domain"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import { readSfApplicationSource } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import type { Application } from "../../../../modules/sucafina/Sucafinav1/runtime/application.ts"
import { roleMap } from "../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { DashboardBudget, budgetAdminCanWrite, budgetCanEditAnyLine } from "../../../../modules/sucafina/Sucafinav1/runtime/dashboard-budget.ts"
import { DashboardPortfolio, portfolioCanWrite } from "../../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { publicSfData } from "../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { dashboardPages, sidebarYear } from "../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { readTeamProfileIntent } from "../../../../modules/sucafina/Sucafinav1/runtime/team-profile-selector.ts"
import { SF_DOMAIN_PAGES, projectSfDomainData, projectSfDomainVersions } from "./native-ui/domain/projection.ts"

const capabilities = ["CAP14", "CAP04", "CAP05"] as const
type Capability = typeof capabilities[number]
const pageOperations = {
  CAP14: SfDomain.operations["domain.page.CAP14"],
  CAP04: SfDomain.operations["domain.page.CAP04"],
  CAP05: SfDomain.operations["domain.page.CAP05"],
} as const
const budgetActions = ["save", "delete", "save-entry", "save-deviation", "annual-entry", "year-amount"] as const
const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } as const
const unavailable = (): SfTeamContextResult => ({ status: "unavailable", reason: "host-unavailable" })
const denied = (): SfTeamContextResult => ({ status: "denied" })
type Handler = (request: Request) => Promise<Response | undefined>

/**
 * Request-scoped bridge. The factory supplies its ORIGINAL createModule handler
 * and current Microsoft/Team reader. A DTO, descriptor or operator file cannot
 * manufacture the Application's private provenance or a business grant.
 */
export type SfTeamNativeDomainInput = Readonly<{
  request: Request
  handler: Handler
  binding: SfTeamInstallationDescriptor
  profile: TeamProfile.Ref
  readContext: (request: Request, query: SfTeamContextQuery) => Promise<SfTeamContextResult>
  /** Current Microsoft/Team, effective roles and private configuration fence; never a cached true. */
  current: () => Promise<boolean>
}>

export function createSfTeamNativeDomain(input: SfTeamNativeDomainInput) {
  const source = readSfApplicationSource(input.handler)
  const authorities = new WeakMap<SfTeamContext, string>()
  const query: SfTeamContextQuery = {
    contractRevision: "sf-team-profile/1", installationId: input.binding.installationId,
    tenantId: input.binding.tenantId, hostId: input.binding.hostId,
    kind: "team", teamObjectId: input.profile.teamObjectId,
  }
  const placement = Schema.is(SfTeamInstallationDescriptor)(input.binding) && Schema.is(TeamProfile.Ref)(input.profile) &&
    input.binding.authMode === "microsoft" && validOrigin(input.binding.publicOrigin) &&
    input.profile.installationId === input.binding.installationId && input.profile.tenantId === input.binding.tenantId &&
    source?.mount === input.binding.mount + "/teams/" + input.profile.teamObjectId
  const current = () => !input.request.signal.aborted && input.current().catch(() => false)
  const base = async (): Promise<SfTeamContextResult> => {
    if (!placement || !source) return unavailable()
    if (!await current()) return denied()
    const result = await input.readContext(input.request, query).catch(unavailable)
    if (result.status !== "ok") return result
    if (!Schema.is(SfTeamContext)(result.value) || !bound(result.value, input.binding, input.profile)) return unavailable()
    if (!await current()) return denied()
    return result
  }
  const readContext = async (): Promise<SfTeamContextResult> => {
    const first = await base()
    if (first.status !== "ok" || !source || !first.value.stamp.team) return first
    const environment = await source.application.environment(input.request)
    const observe = (environment: Environment) => source.application.persistence.transaction("dashboard", async (snapshot) => ({
      commit: false,
      value: await authority(source.application, input.request, first.value, snapshot, environment),
    }), { signal: input.request.signal })
    const before = await observe(environment)
    if (!before) return denied()
    const fresh = await base()
    if (fresh.status !== "ok" || !fresh.value.stamp.team) return fresh
    if (digestSfValue(first.value.stamp) !== digestSfValue(fresh.value.stamp)) return unavailable()
    const after = await observe(await source.application.environment(input.request))
    if (!after || digestSfValue(before) !== digestSfValue(after) || !await current()) return denied()
    const accessRevision = digestSfValue({
      team: fresh.value.stamp.team, authority: after, hostId: fresh.value.stamp.hostId,
    })
    const value = Schema.decodeUnknownSync(SfTeamContext, { onExcessProperty: "error" })({
      ...fresh.value,
      stamp: { ...fresh.value.stamp, accessRevision,
        team: { ...fresh.value.stamp.team, revisions: { ...fresh.value.stamp.team.revisions, accessRevision } } },
      profile: { ...fresh.value.profile, accessRevision },
      destinations: after.destinations,
      availability: after.availability,
    })
    authorities.set(value, digestSfValue(after))
    return { status: "ok", value }
  }
  const handle = async (): Promise<Response | undefined> => {
    const url = new URL(input.request.url)
    const cap = capabilities.find((id) => url.pathname === input.binding.mount + "/api/ui/pages/" + id)
    const contextPath = url.pathname === input.binding.mount + "/api/ui/context"
    const commandCap = input.request.method === "POST" && source && url.pathname === source.mount + "/dashboard"
      ? capabilities.find((id) => url.searchParams.get("page") === SF_DOMAIN_PAGES[id]) : undefined
    if (!cap && !contextPath && !commandCap) return undefined
    if (url.origin !== input.binding.publicOrigin ||
      input.request.headers.get("sec-fetch-site") === "cross-site" ||
      input.request.headers.has("origin") && input.request.headers.get("origin") !== input.binding.publicOrigin)
      return resultResponse(denied())
    // Admit the original Request before interpreting its selection or body.
    const context = await readContext().catch(unavailable)
    if (context.status !== "ok") return resultResponse(context)
    if (!source) return resultResponse(unavailable())
    if (contextPath) {
      if (input.request.method !== "GET") return Response.json({ status: "denied" }, { status: 405, headers })
      const entries = [...url.searchParams]
      const requested = Schema.decodeUnknownOption(SfTeamContextQuery, { onExcessProperty: "error" })(Object.fromEntries(entries))
      if (input.request.headers.has("x-sf-team-profile") || new Set(entries.map(([key]) => key)).size !== entries.length ||
        Option.isNone(requested))
        return Response.json({ status: "unavailable", reason: "contract-mismatch" }, { status: 400, headers })
      if (digestSfValue(requested.value) !== digestSfValue(query))
        return Response.json({ status: "unavailable", reason: "contract-mismatch" }, { status: 409, headers })
      return resultResponse(context)
    }
    const intent = readTeamProfileIntent(input.request, {
      origin: input.binding.publicOrigin, mount: input.binding.mount,
      installationId: input.binding.installationId, tenantId: input.binding.tenantId,
    })
    if (!context.value.stamp.team || intent?.kind !== "team" ||
      digestSfValue(intent.profile) !== digestSfValue(input.profile)) return resultResponse(denied())
    if (commandCap) {
      if (input.request.headers.get("origin") !== input.binding.publicOrigin) return resultResponse(denied())
      const destination = context.value.destinations.find((item) => item.capabilityId === commandCap)
      if (!destination?.canRead || !destination.allowedActionIds.length ||
        !ownerMatches(input.request, context.value) || !/^[A-Za-z0-9._:-]{8,128}$/.test(input.request.headers.get("idempotency-key") ?? ""))
        return Response.json({ ok: false, status: 403 }, { status: 403, headers })
      if ([...url.searchParams].length !== 1) return Response.json({ ok: false, status: 400 }, { status: 400, headers })
      // The bounded clone is syntax-only. Authentication and the writer receive
      // input.request itself; its body and identity are never replaced.
      const body = await commandBody(input.request, source.application.maxJsonBytes)
      if (body instanceof Response) return body
      const action = body.action
      if (body.page !== SF_DOMAIN_PAGES[commandCap] || typeof action !== "string" ||
        !destination.allowedActionIds.includes(action)) return Response.json({ ok: false, status: 403 }, { status: 403, headers })
      const operationId = "domain.command." + commandCap + "." + action
      if (!(operationId in SfDomain.operations)) return Response.json({ ok: false, status: 400 }, { status: 400, headers })
      const operation = SfDomain.operations[operationId as keyof typeof SfDomain.operations]
      const { page: _page, action: _action, ...values } = body
      const schema: Schema.Top = operation.input
      if (Option.isNone(Schema.decodeUnknownOption(Schema.toType(schema), { onExcessProperty: "error" })(values)))
        return Response.json({ ok: false, status: 400 }, { status: 400, headers })
      const beforeWrite = await readContext().catch(unavailable)
      if (beforeWrite.status !== "ok" || !sameStamp(context.value, beforeWrite.value))
        return Response.json({ ok: false, status: 403 }, { status: 403, headers })
      const response = await input.handler(input.request)
      const afterWrite = await readContext().catch(unavailable)
      if (!response || afterWrite.status !== "ok" || !sameStamp(beforeWrite.value, afterWrite.value))
        return Response.json({ ok: false, status: 503 }, { status: 503, headers })
      return response
    }
    if (!cap || input.request.method !== "GET") return Response.json({ status: "denied" }, { status: 405, headers })
    const destination = context.value.destinations.find((item) => item.capabilityId === cap)
    if (!destination?.canRead) return resultResponse(denied())
    const selection = pageSelection(url)
    if (!selection) return Response.json({ status: "needs-input", reason: "invalid-page-selection" }, { status: 400, headers })
    const environment = await source.application.environment(input.request)
    const time = new Date(environment.at)
    if (!Number.isFinite(time.getTime())) return resultResponse(unavailable())
    const year = selection.year ?? sidebarYear(), month = selection.month ?? time.getMonth() + 1
    const projected = await source.application.persistence.transaction("dashboard", async (snapshot) => {
      const admitted = await authority(source.application, input.request, context.value, snapshot, environment)
      const actor = admitted?.actor
      const page = admitted?.destinations.find((item) => item.capabilityId === cap)
      const producer = source.application.domains.dashboard.find((item) => item.pages.includes(SF_DOMAIN_PAGES[cap]))
      if (!actor || !page?.canRead || !producer || digestSfValue(admitted) !== authorities.get(context.value))
        return { commit: false, value: undefined }
      const auditBefore = snapshot.audit.length
      const view = producer.domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
      const data = projectSfDomainData(cap, publicSfData(view.data), year, month)
      if (!data || !await current()) return { commit: false, value: undefined }
      return { commit: snapshot.audit.length > auditBefore, value: {
        data, versions: projectSfDomainVersions(cap, view.versions, data), fence: digestSfValue(snapshot.versions),
      } }
    }, { signal: input.request.signal })
    if (!projected) return resultResponse(denied())
    const refreshed = await readContext().catch(unavailable)
    if (refreshed.status !== "ok") return resultResponse(refreshed)
    if (!sameStamp(context.value, refreshed.value))
      return Response.json({ status: "stale", reason: "domain-authority-changed" }, { status: 409, headers })
    const finalEnvironment = await source.application.environment(input.request)
    // The private/Team fence may await. Observe source authority after it, with no
    // later asynchronous boundary between the final transaction and publication.
    if (!await current()) return resultResponse(denied())
    const stable = await source.application.persistence.transaction("dashboard", async (snapshot) => ({
      commit: false, value: digestSfValue(snapshot.versions) === projected.fence &&
        digestSfValue(await authority(source.application, input.request, refreshed.value, snapshot, finalEnvironment)) === authorities.get(refreshed.value),
    }), { signal: input.request.signal })
    if (!stable) return Response.json({ status: "stale", reason: "domain-source-changed" }, { status: 409, headers })
    const outputSchema: Schema.Top = pageOperations[cap].output
    const output = Schema.decodeUnknownOption(Schema.toType(outputSchema), { onExcessProperty: "error" })({
      status: "ok", context: refreshed.value.stamp,
      value: { capabilityId: cap, selection: { ...selection, year, month }, data: projected.data,
        versions: projected.versions, allowedActionIds: destination.allowedActionIds },
    })
    return Option.isSome(output) ? Response.json(output.value, { headers }) : resultResponse(unavailable())
  }
  return Object.freeze({ readContext: () => readContext().catch(unavailable), handle: () => handle().catch(() => resultResponse(unavailable())) })
}

function bound(context: SfTeamContext, binding: SfTeamInstallationDescriptor, profile: TeamProfile.Ref) {
  const stamp = context.stamp
  return stamp.installationId === binding.installationId && stamp.projectId === binding.projectId && stamp.hostId === binding.hostId &&
    context.profile.principal.tenantId === binding.tenantId && (!stamp.team ||
      digestSfValue(stamp.team.owner.profile) === digestSfValue(profile))
}
function sameStamp(left: SfTeamContext, right: SfTeamContext) {
  return digestSfValue(left.stamp) === digestSfValue(right.stamp)
}
function resultResponse(result: SfTeamContextResult) {
  const status = result.status === "ok" ? 200 : result.status === "unauthenticated" ? 401 : result.status === "denied" ? 403 : 503
  return Response.json(result, { status, headers: { ...headers, ...(result.status === "ok" ? {
    "X-SF-Contract-Revision": result.value.contractRevision, "X-SF-Access-Revision": result.value.stamp.accessRevision,
  } : {}) } })
}
async function authority(application: Application, request: Request, context: SfTeamContext, snapshot: Snapshot, environment: Environment) {
  const principal = await application.authenticate(request, {
    surface: "dashboard", roleMap: application.rolePolicy?.("dashboard") ?? roleMap(snapshot, "dashboard"),
  })
  if (!principal?.id || principal.id.startsWith("local:") || principal.id !== context.stamp.principalRef || request.signal.aborted) return
  const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
  const access = object(object(snapshot.data.access)[principal.id])
  const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
    domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
  const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((value): value is string => typeof value === "string") : []
  const pages = dashboardPages(actor, summaries)
  const named = environment.directory.some((person) => person.id === actor.id && person.name.trim())
  const destinations = capabilities.map((capabilityId) => {
    const page = SF_DOMAIN_PAGES[capabilityId]
    const actual = application.domains.dashboard.find((item) => item.pages.includes(page))
    const domain = capabilityId === "CAP14" ? DashboardPortfolio.domain : DashboardBudget.domain
    const canRead = !!actual && actual.domain === domain && pages.includes(page)
    const allowedActionIds = !canRead || !named ? [] : capabilityId === "CAP14"
      ? portfolioCanWrite(actor, "contracts") ? ["save", "delete"] : []
      : budgetAdminCanWrite(actor) || budgetCanEditAnyLine(snapshot, actor, capabilityId === "CAP04" ? "opexOwners" : "capexProjects")
        ? [...budgetActions, ...(capabilityId === "CAP04" && budgetAdminCanWrite(actor) ? ["import"] : [])] : []
    return { capabilityId, surface: "dashboard" as const, page, canRead, allowedActionIds }
  })
  const availability = destinations.map((item) => {
    const ids = Object.keys(SfOperationRegistry).filter((id) =>
      id === "domain.page." + item.capabilityId || id.startsWith("domain.command." + item.capabilityId + "."))
    const operations = ids.map((id) => {
      const ready = item.canRead && (id.startsWith("domain.page.") || item.allowedActionIds.includes(id.split(".")[3]!))
      return { operationId: id as SfOperationId, state: ready ? "ready" as const : "denied" as const,
        reason: ready ? null : "current-business-authority-denied", operational: ready }
    })
    return { family: "domain-read" as const, resource: item.capabilityId,
      state: operations.every((operation) => operation.state === "ready") ? "ready" as const
        : operations.some((operation) => operation.state === "ready") ? "partial" as const : "denied" as const,
      operations }
  })
  return { actor, destinations, availability }
}
function pageSelection(url: URL) {
  const entries = [...url.searchParams]
  if (new Set(entries.map(([key]) => key)).size !== entries.length || url.search.length > 4096) return
  const values = Object.fromEntries(entries.map(([key, value]) => [key,
    ["year", "month", "execYear", "executiveMonth", "opsMonth", "own"].includes(key) && /^\d+$/.test(value) ? Number(value) : value]))
  const selected = Schema.decodeUnknownOption(SfDomainReadSelection, { onExcessProperty: "error" })(values)
  return Option.isSome(selected) ? selected.value : undefined
}
function ownerMatches(request: Request, context: SfTeamContext) {
  const raw = request.headers.get("x-sf-native-owner")
  if (!raw || raw.length > 4096 || !/^[A-Za-z0-9_-]+$/.test(raw) ||
    request.headers.get("x-sf-access-revision") !== context.stamp.accessRevision) return false
  const value = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(Buffer.from(raw, "base64url").toString("utf8"))
  if (Option.isNone(value)) return false
  const owner = Schema.decodeUnknownOption(SfNativeOwnerExpectation, { onExcessProperty: "error" })(value.value)
  return Option.isSome(owner) && owner.value.installationId === context.stamp.installationId &&
    owner.value.projectId === context.stamp.projectId && owner.value.hostId === context.stamp.hostId &&
    owner.value.principalRef === context.stamp.principalRef
}
async function commandBody(request: Request, limit: number): Promise<Record<string, unknown> | Response> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json")
    return Response.json({ ok: false, status: 400 }, { status: 415, headers })
  const reader = request.clone().body?.getReader()
  if (!reader) return Response.json({ ok: false, status: 400 }, { status: 400, headers })
  const chunks: Uint8Array[] = []
  let bytes = 0
  try {
    while (!request.signal.aborted) {
      const part = await reader.read()
      if (part.done) break
      bytes += part.value.byteLength
      if (bytes > Math.min(limit, 2 * 1024 * 1024)) {
        void reader.cancel().catch(() => undefined)
        return Response.json({ ok: false, status: 400 }, { status: 413, headers })
      }
      chunks.push(part.value)
    }
    if (request.signal.aborted) return Response.json({ ok: false, status: 403 }, { status: 403, headers })
    const text = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks))
    const value = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)(text)
    if (Option.isNone(value) || !value.value || typeof value.value !== "object" || Array.isArray(value.value))
      return Response.json({ ok: false, status: 400 }, { status: 400, headers })
    return value.value as Record<string, unknown>
  } catch {
    return Response.json({ ok: false, status: 400 }, { status: 400, headers })
  } finally { reader.releaseLock() }
}

function validOrigin(value: string) {
  try { const url = new URL(value); return url.protocol === "https:" && url.origin === value && !url.username && !url.password }
  catch { return false }
}
