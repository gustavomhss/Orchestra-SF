import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor, Command, Result, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/planner.ts"
import { plannerKeys } from "../../src/nav.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { prepareHeadcountDelete, prepareHeadcountIncrease, prepareHeadcountLeaderDomain, prepareHeadcountPositionSave, prepareHeadcountRateSave, prepareHeadcountSync, prepareHrDomainActualForecast, projectHeadcount } from "./headcount.ts"

export type HeadcountRequest =
  | { action: "position-save"; versionId: string; id: string; revision: number; values: Record<string, unknown> }
  | { action: "position-delete"; versionId: string; id: string; revision: number }
  | { action: "rate-save"; versionId: string; id: string; revision: number; values: Record<string, unknown> }
  | { action: "rate-delete"; versionId: string; id: string; revision: number }
  | { action: "sync"; versionId: string; revision: number }
  | { action: "increase"; versionId: string; revision: number; inc: number; incMonth: number }
  | { action: "leader-domain"; versionId: string; revision: number; leader: string; domain: string }
  | { action: "hr-actual-forecast"; versionId: string; domain: string; revision: number; values: Record<string, unknown> }

type HeadcountBody = NonNullable<ReturnType<typeof projectHeadcount>>
type HeadcountOutcome = { headcount: HeadcountBody; result: { ok: true } | { ok: false; status: 400 | 403 | 404 | 409 | 422 | 503; errors?: string[] } }

/** Host-private entrypoint: the browser supplies one closed edit, never an actor, snapshot or command. */
export function createPlannerHeadcountHost(input: { host: DomainPortHost; humanAuthorize: (context: TrustedDomainContext, action: "planner.preview" | "planner.apply", payload: HeadcountRequest) => Promise<boolean> }) {
  const identify = async (snapshot: Snapshot, http: Request, context: TrustedDomainContext) => {
    const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
    const access = object(object(snapshot.data.access)[principal.id])
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [], domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
    return plannerKeys(actor).includes("Headcount") ? actor : undefined
  }
  const read = async (versionId: string, context: TrustedDomainContext): Promise<PortResult<HeadcountBody>> => {
    const http = input.host.requestFor(context)
    if (context.kind !== "ui" || !http || http.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "headcount-authority-unavailable" }
    if (typeof versionId !== "string" || !versionId.trim()) return { status: "needs-input", reason: "invalid-version-id" }
    const environment = await input.host.environment(http)
    const load = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const actor = await identify(snapshot, http, context)
      return { commit: false, value: actor ? projectHeadcount(snapshot, actor, environment, versionId) : undefined }
    }, { signal: http.signal }).catch(() => undefined)
    const current = await load()
    const latest = await load()
    if (!current || !latest || digestSfValue(current) !== digestSfValue(latest) || http.signal.aborted || !await input.host.revalidate(context)) return { status: "denied", reason: "headcount-authority-unavailable" }
    return { status: "ok", value: current }
  }
  const run = async (incoming: HeadcountRequest, context: TrustedDomainContext, gate: "planner.preview" | "planner.apply"): Promise<PortResult<HeadcountOutcome>> => {
    const request = structuredClone(incoming)
    const command = headcountCommand(request)
    if (!command) return { status: "needs-input", reason: "invalid-headcount-request" }
    const http = input.host.requestFor(context)
    if (context.kind !== "ui" || !http) return { status: "denied", reason: "headcount-authority-unavailable" }
    const allowed = async () => !http.signal.aborted && await input.host.revalidate(context).catch(() => false) && await input.humanAuthorize(context, gate, request).catch(() => false)
    if (!await allowed()) return { status: "denied", reason: "headcount-authority-unavailable" }
    const environment = await input.host.environment(http).catch(() => undefined)
    if (!environment) return { status: "unavailable", reason: "headcount-environment-unavailable" }
    const result = await input.host.persistence.transaction<PortResult<HeadcountOutcome>>("planner", async (snapshot) => {
      const actor = await identify(snapshot, http, context).catch(() => undefined)
      if (!actor || !await allowed()) return { commit: false, value: { status: "denied", reason: "headcount-authority-unavailable" } }
      const current = projectHeadcount(snapshot, actor, environment, request.versionId)
      if (!current) return { commit: false, value: { status: "needs-input", reason: "headcount-version-unavailable" } }
      if (((request.action === "position-save" || request.action === "position-delete") && request.id && current.groups.flatMap((group) => group.positions).filter((position) => object(position).id === request.id).length !== 1) || ((request.action === "rate-save" || request.action === "rate-delete") && request.id && current.rates.filter((rate) => object(rate).id === request.id).length !== 1) || (request.action === "hr-actual-forecast" && current.groups.filter((group) => group.domain === request.domain).length !== 1)) return { commit: false, value: { status: "needs-input", reason: "headcount-target-unavailable" } }
      const target = gate === "planner.preview" ? structuredClone(snapshot) : snapshot
      const executed = domain.execute(target, actor, command, environment)
      const headcount = projectHeadcount(target, actor, environment, request.versionId)
      if (!headcount || digestSfValue(await identify(target, http, context).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied", reason: "headcount-authority-changed" } }
      return { commit: gate === "planner.apply" && executed.ok === true, value: { status: "ok", value: { headcount, result: publicResult(executed) } } }
    }, { signal: http.signal }).catch(() => ({ status: "unavailable" as const, reason: "headcount-storage-unavailable" }))
    if (!await allowed()) return gate === "planner.apply" && result.status === "ok" && result.value.result.ok ? { status: "unavailable", reason: "headcount-apply-outcome-requires-reconciliation" } : { status: "denied", reason: "headcount-authority-changed" }
    return result
  }
  return { read, preview: (request: HeadcountRequest, context: TrustedDomainContext) => run(request, context, "planner.preview"), apply: (request: HeadcountRequest, context: TrustedDomainContext) => run(request, context, "planner.apply") }
}

function headcountCommand(request: HeadcountRequest): Command | undefined {
  if (!request || typeof request.versionId !== "string" || !request.versionId.trim() || !Number.isSafeInteger(request.revision) || request.revision < 0) return undefined
  if ((request.action === "position-save" || request.action === "position-delete" || request.action === "rate-save" || request.action === "rate-delete") && typeof request.id !== "string") return undefined
  if ((request.action === "position-save" || request.action === "rate-save" || request.action === "hr-actual-forecast") && (!request.values || typeof request.values !== "object" || Array.isArray(request.values) || Object.values(request.values).some((value) => value !== null && typeof value !== "string" && typeof value !== "boolean" && (typeof value !== "number" || !Number.isFinite(value))))) return undefined
  if (request.action === "hr-actual-forecast" && typeof request.domain !== "string") return undefined
  if (request.action === "position-save") return keys(request, ["action", "versionId", "id", "revision", "values"]) ? prepareHeadcountPositionSave(request.versionId, request.id, request.revision, request.values) : undefined
  if (request.action === "position-delete") return keys(request, ["action", "versionId", "id", "revision"]) ? prepareHeadcountDelete(request.versionId, "positions", request.id, request.revision) : undefined
  if (request.action === "rate-save") return keys(request, ["action", "versionId", "id", "revision", "values"]) ? prepareHeadcountRateSave(request.versionId, request.id, request.revision, request.values) : undefined
  if (request.action === "rate-delete") return keys(request, ["action", "versionId", "id", "revision"]) ? prepareHeadcountDelete(request.versionId, "rates", request.id, request.revision) : undefined
  if (request.action === "sync") return keys(request, ["action", "versionId", "revision"]) ? prepareHeadcountSync(request.versionId, request.revision) : undefined
  if (request.action === "increase") return keys(request, ["action", "versionId", "revision", "inc", "incMonth"]) ? prepareHeadcountIncrease(request.versionId, request.revision, request.inc, request.incMonth) : undefined
  if (request.action === "leader-domain") return keys(request, ["action", "versionId", "revision", "leader", "domain"]) ? prepareHeadcountLeaderDomain(request.versionId, request.revision, request.leader, request.domain) : undefined
  if (request.action === "hr-actual-forecast") return keys(request, ["action", "versionId", "domain", "revision", "values"]) ? prepareHrDomainActualForecast(request.versionId, request.domain, request.revision, request.values) : undefined
  return undefined
}

function keys(value: object, allowed: readonly string[]) {
  return Object.keys(value).every((key) => allowed.includes(key))
}

function publicResult(result: Result): HeadcountOutcome["result"] {
  if (result.ok) return { ok: true }
  return { ok: false, status: result.status, ...(result.errors ? { errors: result.errors } : {}) }
}

