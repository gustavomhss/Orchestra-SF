import { Schema } from "effect"
import {
  SfContextResult as SfContextResultSchema,
  SfTeamContextResult,
  type SfTeamContextQuery,
  sfIsCatalogResource,
  type SfContext, type SfContextResult, type SfExpectedContextBinding,
} from "@orchestra/schema/sucafina/context"
import { readTeamContextQuery } from "../../../../../modules/sucafina/Sucafinav1/runtime/team-profile-selector.ts"
import type { SfHostServices } from "../../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { SfNativeHostDependencies } from "./router.ts"

type TrustedContextReader = (request: Request, expected: SfExpectedContextBinding) => Promise<SfContextResult>
type HostWithReader = Readonly<{ nativeUiProducts?: Readonly<{
  /** I00 installs a read-only live view of runtime.identity(), never caller data. */
  currentBinding?: () => Readonly<{ installationId: string; projectId: string; hostId: string }> | undefined
  readContext?: TrustedContextReader
  readRequestContext?: TrustedContextReader
  teamTenantId?: string
  readTeamContext?: (request: Request, expected: SfTeamContextQuery) => Promise<SfTeamContextResult>
}> }>
const jsonHeaders = (additional?: HeadersInit): Headers => {
  const headers = new Headers(additional)
  headers.set("Cache-Control", "no-store")
  headers.set("Content-Type", "application/json; charset=utf-8")
  headers.set("X-Content-Type-Options", "nosniff")
  return headers
}
const malformed = (): Response => new Response(null, { status: 400, headers: jsonHeaders() })
const sameBinding = (
  expected: SfExpectedContextBinding,
  actual: Readonly<{ installationId: string; projectId: string; hostId: string }> | undefined,
) => !!actual && actual.installationId === expected.installationId &&
  actual.projectId === expected.projectId && actual.hostId === expected.hostId

function expectedContext(request: Request, origin: string, mount: string): SfExpectedContextBinding | undefined {
  const url = new URL(request.url)
  if (url.origin !== origin || url.pathname !== mount + "/api/ui/context" ||
      (request.headers.has("origin") && request.headers.get("origin") !== origin) ||
      request.headers.get("sec-fetch-site") === "cross-site") return undefined
  if (/%(?![\da-fA-F]{2})/.test(url.search)) return undefined
  const entries = [...url.searchParams.entries()]
  const keys = ["installationId", "projectId", "hostId"]
  if (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3 ||
      entries.some(([key, value]) => !keys.includes(key) || !value)) return undefined
  return {
    installationId: url.searchParams.get("installationId")!,
    projectId: url.searchParams.get("projectId")!,
    hostId: url.searchParams.get("hostId")!,
  }
}
function validAvailability(context: Pick<SfContext, "availability">): boolean {
  return context.availability.every((resource) => {
    if (!sfIsCatalogResource(resource) || !resource.operations.length ||
        resource.operations.some((entry) =>
          entry.state === "ready"
            ? entry.reason !== null || entry.operational !== true
            : !entry.reason || entry.operational !== false)) return false
    const ready = resource.operations.filter((operation) => operation.state === "ready").length
    const denied = resource.operations.filter((operation) => operation.state === "denied").length
    const derived = ready === resource.operations.length ? "ready" :
      ready > 0 ? "partial" :
      denied === resource.operations.length ? "denied" : "unavailable"
    return resource.state === derived
  })
}
/**
 * F01 binding. The authoritative reader must be installed by I00 from the
 * real SF producer. Absence is 503, NOT a synthetic principal, blank context,
 * role map bootstrap or optimistic operation availability.
 */
export function createSfContextHandler(
  deps: Omit<SfNativeHostDependencies, "readContext" | "runtime" | "application"> & Readonly<{
    runtime: () => SfHostServices | HostWithReader | undefined
    application?: SfNativeHostDependencies["application"]
  }>,
): Readonly<{ readContext(request: Request): Promise<SfContextResult>; handle(request: Request): Promise<Response> }> {
  const read = async (request: Request, internal: boolean): Promise<SfContextResult> => {
    const services = deps.runtime() as HostWithReader | undefined
    const producer = services?.nativeUiProducts
    const expected = internal ? producer?.currentBinding?.() : expectedContext(request, deps.origin, deps.mount)
    if (!expected || request.signal.aborted || !internal && request.method !== "GET")
      return { status: "unavailable", reason: "contract-mismatch" }
    // Both readers re-admit the same Request through the installed authority.
    const reader = internal ? producer?.readRequestContext : producer?.readContext
    if (!reader || !producer?.currentBinding) return { status: "unavailable", reason: "host-unavailable" }
    if (!sameBinding(expected, producer.currentBinding()))
      return { status: "unavailable", reason: "contract-mismatch" }
    const result = await reader(request, expected).catch((): SfContextResult =>
      ({ status: "unavailable", reason: "host-unavailable" }))
    if (request.signal.aborted || !sameBinding(expected, producer.currentBinding()) ||
        deps.runtime() !== services) return { status: "unavailable", reason: "contract-mismatch" }
    if (!Schema.is(SfContextResultSchema)(result)) return { status: "unavailable", reason: "contract-mismatch" }
    if (result.status !== "ok") return result
    const stamp = result.value.stamp
    if (stamp.installationId !== expected.installationId ||
        stamp.projectId !== expected.projectId ||
        stamp.hostId !== expected.hostId ||
        !stamp.principalRef || !stamp.policyVersion || !stamp.accessRevision ||
        !validAvailability(result.value)) return { status: "unavailable", reason: "contract-mismatch" }
    return result
  }
  const readTeam = async (request: Request, expected: SfTeamContextQuery): Promise<SfTeamContextResult> => {
    const services = deps.runtime() as HostWithReader | undefined
    const producer = services?.nativeUiProducts
    const binding = producer?.currentBinding?.()
    if (!producer?.readTeamContext || !producer.teamTenantId || !binding)
      return { status: "unavailable", reason: "host-unavailable" }
    if (expected.installationId !== binding.installationId || expected.hostId !== binding.hostId ||
      expected.tenantId !== producer.teamTenantId || request.signal.aborted)
      return { status: "unavailable", reason: "contract-mismatch" }
    const result = await producer.readTeamContext(request, expected).catch((): SfTeamContextResult =>
      ({ status: "unavailable", reason: "host-unavailable" }))
    if (request.signal.aborted || deps.runtime() !== services || producer.currentBinding?.() !== binding ||
      !Schema.is(SfTeamContextResult)(result)) return { status: "unavailable", reason: "contract-mismatch" }
    if (result.status !== "ok") return result
    const value = result.value
    if (!sameBinding(binding, value.stamp) || value.profile.principal.tenantId !== expected.tenantId ||
      expected.kind === "administration" && value.stamp.team ||
      expected.kind === "team" && value.profile.teams.status === "ready" &&
        value.profile.teams.selected.teamObjectId !== expected.teamObjectId ||
      !validAvailability(value)) return { status: "unavailable", reason: "contract-mismatch" }
    return result
  }
  const readContext = (request: Request) => read(request, true)
  const handle = async (request: Request): Promise<Response> => {
    const producer = (deps.runtime() as HostWithReader | undefined)?.nativeUiProducts
    if (producer?.teamTenantId !== undefined || new URL(request.url).searchParams.has("contractRevision")) {
      const binding = producer?.currentBinding?.()
      if (!producer?.teamTenantId || !binding) return new Response(JSON.stringify({
        status: "unavailable", reason: "host-unavailable",
      }), { status: 503, headers: jsonHeaders() })
      const expected = readTeamContextQuery(request, {
        installationId: binding.installationId, tenantId: producer.teamTenantId,
        origin: deps.origin, mount: deps.mount,
      })
      if (!expected || expected.hostId !== binding.hostId) return malformed()
      if (request.method === "HEAD") return new Response(null, {
        status: 200, headers: jsonHeaders({ "X-SF-Contract-Revision": "sf-team-profile/1" }),
      })
      const result = await readTeam(request, expected)
      const status = result.status === "ok" ? 200 : result.status === "unauthenticated" ? 401 :
        result.status === "denied" ? 403 : result.reason === "contract-mismatch" ? 409 : 503
      return new Response(JSON.stringify(result), { status, headers: jsonHeaders(result.status === "ok" ? {
        "X-SF-Contract-Revision": result.value.contractRevision,
        "X-SF-Access-Revision": result.value.stamp.accessRevision,
      } : undefined) })
    }
    const expected = expectedContext(request, deps.origin, deps.mount)
    if (!expected) return malformed()
    if (request.method !== "GET" && request.method !== "HEAD")
      return new Response(null, { status: 405, headers: { Allow: "GET, HEAD", "Cache-Control": "no-store" } })
    // HEAD must never consume a return-intent or perform any auth/navigation side effect.
    if (request.method === "HEAD") return new Response(null, { status: 200, headers: jsonHeaders() })
    const result = await read(request, false)
    const status = result.status === "ok" ? 200 :
      result.status === "unauthenticated" ? 401 :
      result.status === "denied" ? 403 :
      result.reason === "contract-mismatch" ? 409 : 503
    const headers = jsonHeaders(result.status === "ok" ? {
      "X-SF-Contract-Revision": result.value.contractRevision,
      "X-SF-Access-Revision": result.value.stamp.accessRevision,
    } : undefined)
    return new Response(JSON.stringify(result), { status, headers })
  }
  return Object.freeze({ readContext, handle })
}
