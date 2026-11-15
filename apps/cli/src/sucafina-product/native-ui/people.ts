import { Schema } from "effect"
import { SfPeopleCio, SfPeopleLeader, SfPeopleMember, SfPeoplePageData, SfPeopleTopic } from "@orchestra/schema/sucafina/people"
import type { SfNativeHostDependencies, SfProjectionHandler } from "./router"
import { roleMap } from "../../../../../modules/sucafina/Sucafinav1/runtime/admin.ts"
import { object } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import type { Actor } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { publicSfData } from "../../../../../modules/sucafina/Sucafinav1/product/integration/public-state.ts"
import { dashboardPages, sidebarYear } from "../../../../../modules/sucafina/Sucafinav1/src/nav.ts"
import { itUsersForMonth } from "../../../../../modules/sucafina/Sucafinav1/src/dashboard-accounts.ts"

/**
 * A10 host-private bindings. Existing POSTs stay on application.ts /dashboard;
 * this leaf only provides the four catalogued HTML-only GET page projections.
 */
export const SF_PEOPLE_PAGES = {
  CAP02: "Hot Topics & Actions",
  CAP06: "Headcount Overview",
  CAP07: "Team Structure",
  CAP08: "Talent Review",
} as const
export type SfPeopleCapability = keyof typeof SF_PEOPLE_PAGES

type Selection = Readonly<{
  year?: number
  month?: number
  topicStatus?: "" | "open" | "progress" | "blocked" | "done"
  memberStatus?: "" | "Active" | "On Leave" | "Terminated"
}>

const headers = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
} as const
const topicFields = ["action", "owner", "due", "status", "priority", "notes"] as const
const cioFields = ["name", "title", "location", "start"] as const
const leaderFields = ["name", "title", "domain", "location", "start"] as const
const memberFields = ["name", "title", "type", "leaderId", "location", "start", "end", "status", "cls", "outlook", "notes"] as const
const publicMemberFields = memberFields.filter((field) => !["cls", "outlook", "notes"].includes(field))
const actionIds: Readonly<Record<SfPeopleCapability, readonly string[]>> = {
  CAP02: ["save", "delete"],
  CAP06: [],
  CAP07: ["saveCio", "saveLeader", "deleteLeader", "saveMember", "deleteMember"],
  CAP08: ["save", "delete", "import", "exportAllMembers"],
}

const respond = (body: object, status: number, accessRevision?: string) => Response.json(body, {
  status,
  headers: accessRevision
    ? { ...headers, "X-SF-Contract-Revision": "sf-native-ui/1", "X-SF-Access-Revision": accessRevision }
    : headers,
})
const denied = () => respond({ status: "denied" }, 403)
const unavailable = (reason: string) => respond({ status: "unavailable", reason }, 503)
const needsInput = () => respond({ status: "needs-input", reason: "invalid-page-selection" }, 400)
const stale = (reason: string) => respond({ status: "stale", reason }, 409)

function contextFailure(result: Exclude<Awaited<ReturnType<SfNativeHostDependencies["readContext"]>>, { status: "ok" }>) {
  if (result.status === "unauthenticated") return respond({ status: "unauthenticated" }, 401)
  if (result.status === "denied") return denied()
  return unavailable(result.reason)
}
function sameStamp(
  a: Readonly<{ installationId: string; projectId: string; hostId: string; principalRef: string; policyVersion: string; accessRevision: string }>,
  b: Readonly<{ installationId: string; projectId: string; hostId: string; principalRef: string; policyVersion: string; accessRevision: string }>,
) {
  return a.installationId === b.installationId && a.projectId === b.projectId &&
    a.hostId === b.hostId && a.principalRef === b.principalRef &&
    a.policyVersion === b.policyVersion && a.accessRevision === b.accessRevision
}

function readSelection(url: URL, cap: SfPeopleCapability): Selection | undefined {
  if (url.search.length > 4096) return undefined
  const permitted = cap === "CAP02" ? ["year", "month", "topicStatus"]
    : cap === "CAP08" ? ["year", "month", "memberStatus"] : ["year", "month"]
  if ([...url.searchParams.keys()].some((key) =>
    !permitted.includes(key) || url.searchParams.getAll(key).length !== 1 ||
    (url.searchParams.get(key)?.length ?? 0) > 128)) return undefined
  const selection: {
    year?: number; month?: number; topicStatus?: Selection["topicStatus"]; memberStatus?: Selection["memberStatus"]
  } = {}
  if (url.searchParams.has("year")) {
    const value = url.searchParams.get("year")
    if (!value || !/^202[4-7]$/.test(value)) return undefined
    selection.year = Number(value)
  }
  if (url.searchParams.has("month")) {
    const value = url.searchParams.get("month")
    if (!value || !/^(?:[1-9]|1[0-2])$/.test(value)) return undefined
    selection.month = Number(value)
  }
  if (url.searchParams.has("topicStatus")) {
    const value = url.searchParams.get("topicStatus")
    if (value === null || !["", "open", "progress", "blocked", "done"].includes(value)) return undefined
    selection.topicStatus = value as Selection["topicStatus"]
  }
  if (url.searchParams.has("memberStatus")) {
    const value = url.searchParams.get("memberStatus")
    if (value === null || !["", "Active", "On Leave", "Terminated"].includes(value)) return undefined
    selection.memberStatus = value as Selection["memberStatus"]
  }
  return selection
}

function sourceActor(
  principal: Awaited<ReturnType<SfNativeHostDependencies["application"]["authenticate"]>>,
  data: Record<string, unknown>,
): Actor | undefined {
  if (!principal?.id || principal.id.startsWith("local:")) return undefined
  const roles = principal.roles.filter((row) => row.surface === "dashboard").map((row) => row.role)
  const access = object(object(data.access)[principal.id])
  return {
    id: principal.id,
    canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
    roles,
    assigned: Array.isArray(access.assigned)
      ? access.assigned.filter((item): item is string => typeof item === "string") : [],
    domains: Array.isArray(access.domains)
      ? access.domains.filter((item): item is string => typeof item === "string") : [],
  }
}
function sourceRecord(value: unknown): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("SF_PEOPLE_SOURCE_INVALID")
  }
  return Object.fromEntries(Object.entries(value))
}
function sourceRows(value: unknown): Record<string, unknown>[] {
  if (!Array.isArray(value)) throw new Error("SF_PEOPLE_SOURCE_INVALID")
  return value.map((row: unknown) => sourceRecord(row))
}
const idOf = (value: unknown): string =>
  typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
const text = (value: unknown): string => typeof value === "string" ? value : ""
const pick = (source: Record<string, unknown>, keys: readonly string[]) =>
  Object.fromEntries(keys.filter((key) => Object.hasOwn(source, key)).map((key) => [key, source[key]]))
function projectRows<Row>(
  source: unknown,
  fields: readonly string[],
  decode: (input: unknown) => Row,
): Row[] {
  return sourceRows(source).map((row) => {
    const id = idOf(row.id)
    if (!id) throw new Error("SF_PEOPLE_ROW_ID_MISSING")
    return decode({ id, ...pick(row, fields) })
  })
}

type SfPeopleProjectionData = (typeof SfPeoplePageData)[keyof typeof SfPeoplePageData]["Type"]

/** Source-projected fields only; the admin boolean comes from CURRENT source actor, never the browser. */
export function projectSfPeopleData(
  cap: SfPeopleCapability,
  source: Record<string, unknown>,
  selection: Selection & Readonly<{ year: number; month: number }>,
  at: string,
  admin: boolean,
): SfPeopleProjectionData {
  if (cap === "CAP02") {
    return {
      hotTopics: projectRows(source.hotTopics, topicFields, Schema.decodeUnknownSync(SfPeopleTopic))
        .filter((row) => !selection.topicStatus || row.status === selection.topicStatus),
    }
  }
  const members = projectRows(source.members, admin ? memberFields : publicMemberFields,
    Schema.decodeUnknownSync(SfPeopleMember))
  if (cap === "CAP07") return {
    cio: Schema.decodeUnknownSync(SfPeopleCio)(pick(sourceRecord(source.cio), cioFields)),
    leaders: projectRows(source.leaders, leaderFields, Schema.decodeUnknownSync(SfPeopleLeader)),
    members,
  }
  if (cap === "CAP08") {
    // Return all currently authorized members and their CAS versions. The
    // selection is an explicit UI filter, not permission to hide versions
    // required by the canonical replace/import conflict transaction.
    return { members }
  }

  // CAP06: the same server-side derivations and values rendered by
  // dashboard-people.ts (not a frontend recomputation of financial/personnel data).
  const leaders = projectRows(source.leaders, leaderFields, Schema.decodeUnknownSync(SfPeopleLeader))
  const active = members.filter((row) => row.status === "Active")
  const terminated = members.filter((row) => row.status === "Terminated")
  const departures = terminated.filter((row) => text(row.end).startsWith(String(selection.year))).length
  const denominator = active.length + departures / 2
  const now = new Date(at)
  if (!Number.isFinite(now.getTime())) throw new Error("SF_PEOPLE_SOURCE_DATE_INVALID")
  const tenure = members
    .filter((row) => text(row.start) && Number.isFinite(new Date(text(row.start)).getTime()))
    .map((row) => {
      const start = new Date(text(row.start))
      return (now.getFullYear() - start.getFullYear()) * 12 + now.getMonth() - start.getMonth()
    })
  const month = selection.year === now.getFullYear() ? now.getMonth() + 1 : 12
  const users = itUsersForMonth(
    sourceRows(source.itUsersMonthly)
      .map((row) => ({ year: Number(row.year), month: Number(row.month), users: Number(row.users) }))
      .filter((row) => Number.isFinite(row.year) && Number.isFinite(row.month) && Number.isFinite(row.users)),
    month,
    selection.year,
  )
  return {
    metrics: {
      active: active.length,
      terminated: terminated.length,
      departuresYtd: departures,
      attritionYtd: (denominator ? departures / denominator * 100 : 0).toFixed(1) + "%",
      averageTenureMonths: tenure.length
        ? (tenure.reduce((sum, value) => sum + value, 0) / tenure.length).toFixed(1) : "—",
      staffRatio: users && active.length ? String(Math.round(users / active.length)) : "—",
      contractors: members.filter((row) => row.type === "Contractor").length,
      employees: members.filter((row) => row.type !== "Contractor").length,
      ...(admin ? { talent: members.filter((row) => row.cls === "Talent").length } : {}),
    },
    byLeader: [...leaders, { id: "", name: "No leader" }].map((leader) => ({
      id: leader.id,
      name: leader.name,
      active: active.filter((row) => idOf(row.leaderId) === leader.id).length,
      ...(admin ? { talentActive: active.filter((row) =>
        idOf(row.leaderId) === leader.id && row.cls === "Talent").length } : {}),
    })),
  }
}

/** Versions for DISPLAYED authorized entities only; never by, audit, or whole version map. */
export function projectSfPeopleVersions(
  cap: SfPeopleCapability,
  versions: Record<string, { version: number; by: string }>,
  data: ReturnType<typeof projectSfPeopleData>,
) {
  if (cap === "CAP06") return {}
  const visible = new Set<string>()
  if (cap === "CAP02" && "hotTopics" in data) {
    data.hotTopics.forEach((row) => visible.add("hotTopics:" + row.id))
  }
  if (cap === "CAP07" && "leaders" in data && "members" in data) {
    visible.add("cio")
    data.leaders.forEach((row) => visible.add("leaders:" + row.id))
    data.members.forEach((row) => visible.add("members:" + row.id))
  }
  if (cap === "CAP08" && "members" in data) {
    data.members.forEach((row) => visible.add("members:" + row.id))
  }
  return Object.fromEntries(Object.entries(versions)
    .filter(([key, value]) => visible.has(key) &&
      Number.isSafeInteger(value.version) && value.version >= 0)
    .map(([key, value]) => [key, value.version]))
}

type SfPeoplePageOutcome =
  | Readonly<{ kind: "denied" }>
  | Readonly<{
      kind: "ok"
      data: SfPeopleProjectionData
      versions: Record<string, number>
      canWrite: boolean
      admin: boolean
      actorCanWrite: boolean
      versionFence: string
    }>

async function page(deps: SfNativeHostDependencies, request: Request, cap: SfPeopleCapability): Promise<Response> {
  const url = new URL(request.url)
  const pageName = SF_PEOPLE_PAGES[cap]
  if (url.origin !== deps.origin || url.pathname !== deps.mount + "/api/ui/pages/" + cap) return denied()
  if (request.method !== "GET") return respond({ status: "denied" }, 405)
  if (request.headers.get("sec-fetch-site") === "cross-site" ||
    request.headers.has("origin") && request.headers.get("origin") !== deps.origin) return denied()
  if (request.headers.has("transfer-encoding") ||
    request.headers.has("content-length") && request.headers.get("content-length") !== "0") return needsInput()
  const requested = readSelection(url, cap)
  if (!requested) return needsInput()
  if (request.signal.aborted) return unavailable("request-cancelled")

  try {
    const context = await deps.readContext(request)
    if (context.status !== "ok") return contextFailure(context)
    const destination = context.value.destinations.find((item) =>
      item.capabilityId === cap && item.surface === "dashboard" && item.page === pageName)
    if (!destination?.canRead) return denied()
    const contribution = deps.application.domains.dashboard.find((item) => item.pages.includes(pageName))
    if (!contribution) return unavailable("domain-producer-missing")

    const environment = await deps.application.environment(request)
    const now = new Date(environment.at)
    if (!Number.isFinite(now.getTime())) return unavailable("domain-environment-invalid")
    const selection = {
      ...requested,
      year: requested.year ?? sidebarYear(),
      month: requested.month ?? now.getMonth() + 1,
    }
    const outcome = await deps.application.persistence.transaction<SfPeoplePageOutcome>("dashboard", async (snapshot) => {
      // The same original Request and roleMap as the admitted legacy dashboard.
      const principal = await deps.application.authenticate(request, {
        surface: "dashboard", roleMap: roleMap(snapshot, "dashboard"),
      })
      const actor = sourceActor(principal, snapshot.data)
      if (!actor || actor.id !== context.value.stamp.principalRef)
        return { commit: false, value: { kind: "denied" } }
      const summaries = Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
      if (!dashboardPages(actor, summaries).includes(pageName))
        return { commit: false, value: { kind: "denied" } }

      const beforeAudit = snapshot.audit.length
      const view = contribution.domain.view({ ...snapshot, data: publicSfData(snapshot.data) }, actor, environment)
      const data = projectSfPeopleData(cap, publicSfData(view.data), selection, environment.at, actor.roles.includes("admin"))
      const versions = projectSfPeopleVersions(cap, view.versions, data)
      const canWrite = actor.canWrite &&
        (cap === "CAP02"
          ? actor.roles.some((role) => role === "admin" || role === "domain leader")
          : cap !== "CAP06" && actor.roles.includes("admin"))
      return {
        commit: snapshot.audit.length !== beforeAudit,
        value: {
          kind: "ok",
          data, versions, canWrite,
          admin: actor.roles.includes("admin"),
          actorCanWrite: actor.canWrite,
          versionFence: JSON.stringify(snapshot.versions),
        },
      }
    }, { signal: request.signal })
    if (outcome.kind === "denied") return denied()
    if (request.signal.aborted) return unavailable("request-cancelled")

    // Revoke on any context switch, including identity/installation/access revision.
    const refreshed = await deps.readContext(request)
    if (refreshed.status !== "ok") return contextFailure(refreshed)
    const freshDestination = refreshed.value.destinations.find((item) =>
      item.capabilityId === cap && item.surface === "dashboard" && item.page === pageName)
    if (!freshDestination?.canRead) return denied()
    if (!sameStamp(context.value.stamp, refreshed.value.stamp)) {
      if (context.value.stamp.principalRef !== refreshed.value.stamp.principalRef ||
        context.value.stamp.hostId !== refreshed.value.stamp.hostId ||
        context.value.stamp.installationId !== refreshed.value.stamp.installationId ||
        context.value.stamp.projectId !== refreshed.value.stamp.projectId) return denied()
      return stale("domain-authority-changed")
    }

    const current = await deps.application.persistence.transaction("dashboard", async (snapshot) => {
      const principal = await deps.application.authenticate(request, {
        surface: "dashboard", roleMap: roleMap(snapshot, "dashboard"),
      })
      const actor = sourceActor(principal, snapshot.data)
      const summaries = Array.isArray(snapshot.data.summaries)
        ? snapshot.data.summaries.filter((item): item is string => typeof item === "string") : []
      return {
        commit: false,
        value: !!actor && actor.id === refreshed.value.stamp.principalRef &&
          dashboardPages(actor, summaries).includes(pageName) &&
          actor.roles.includes("admin") === outcome.admin &&
          actor.canWrite === outcome.actorCanWrite &&
          JSON.stringify(snapshot.versions) === outcome.versionFence,
      }
    }, { signal: request.signal })
    if (!current) return stale("domain-source-changed")
    if (request.signal.aborted) return unavailable("request-cancelled")

    const admitted = new Set(actionIds[cap])
    return respond({
      status: "ok",
      context: refreshed.value.stamp,
      value: {
        capabilityId: cap,
        selection,
        data: outcome.data,
        versions: outcome.versions,
        allowedActionIds: outcome.canWrite
          ? freshDestination.allowedActionIds.filter((id) => admitted.has(id)) : [],
      },
    }, 200, refreshed.value.stamp.accessRevision)
  } catch {
    // Do not echo an admission, actor, failed read, raw Snapshot, or thrown error.
    return unavailable("people-projection-unavailable")
  }
}

export function createSfPeopleProjectionHandlers(deps: SfNativeHostDependencies): readonly SfProjectionHandler[] {
  return (Object.keys(SF_PEOPLE_PAGES) as SfPeopleCapability[]).map((cap) => ({
    operationId: ("domain.page." + cap) as "domain.page.CAP02" | "domain.page.CAP06" |
      "domain.page.CAP07" | "domain.page.CAP08",
    handle: (request: Request) => page(deps, request, cap),
  }))
}
