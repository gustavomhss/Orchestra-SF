import { roleMap } from "../../runtime/admin.ts"
import type { Actor, Result, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/planner.ts"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { plannerVersions, plannerVersionCommand, validPlannerVersionRequest } from "./versions.ts"
import type { PlannerVersionRequest } from "./versions.ts"

type VersionsView = NonNullable<ReturnType<typeof plannerVersions>>
type VersionOutcome = { ok: true; versionId?: string } | { ok: false; status: 400 | 403 | 404 | 409 | 422 | 503; errors: readonly string[]; stored?: VersionsView["versions"][number] }
type VersionResult = { versions: VersionsView; request: PlannerVersionRequest; outcome: VersionOutcome; preview?: VersionsView }

/** Closed UI actions use the same domain transitions and record revisions as the original page. */
export function createPlannerVersionsHost(input: { host: DomainPortHost; humanAuthorize: (context: TrustedDomainContext, action: "planner.preview" | "planner.apply", payload: PlannerVersionRequest) => Promise<boolean> }) {
  const identify = async (snapshot: Snapshot, http: Request, context: TrustedDomainContext) => {
    const principal = await input.host.authenticate(http, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
    if (!principal || principal.id !== context.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role)
    const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
    return actor
  }
  const read = async (selectedId: string | undefined, context: TrustedDomainContext): Promise<PortResult<VersionsView>> => {
    const http = input.host.requestFor(context)
    if (context.kind !== "ui" || !http || http.signal.aborted || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "versions-authority-unavailable" }
    if (selectedId !== undefined && (typeof selectedId !== "string" || !selectedId.trim())) return { status: "needs-input", reason: "invalid-version-selection" }
    const environment = await input.host.environment(http).catch(() => undefined)
    if (!environment) return { status: "unavailable", reason: "versions-environment-unavailable" }
    const load = () => input.host.persistence.transaction("planner", async (snapshot) => {
      const actor = await identify(snapshot, http, context)
      return { commit: false, value: actor ? plannerVersions(snapshot, actor, environment, selectedId) : undefined }
    }, { signal: http.signal }).catch(() => undefined)
    const current = await load()
    const latest = await load()
    if (!current || !latest || digestSfValue(current) !== digestSfValue(latest) || http.signal.aborted || !await input.host.revalidate(context).catch(() => false)) return { status: "denied", reason: "versions-authority-changed" }
    return { status: "ok", value: current }
  }
  const run = async (incoming: PlannerVersionRequest, context: TrustedDomainContext, gate: "planner.preview" | "planner.apply"): Promise<PortResult<VersionResult>> => {
    if (!validPlannerVersionRequest(incoming)) return { status: "needs-input", reason: "invalid-version-request" }
    const request = structuredClone(incoming)
    const http = input.host.requestFor(context)
    if (context.kind !== "ui" || !http) return { status: "denied", reason: "versions-authority-unavailable" }
    const allowed = async () => !http.signal.aborted && await input.host.revalidate(context).catch(() => false) && await input.humanAuthorize(context, gate, request).catch(() => false)
    if (!await allowed()) return { status: "denied", reason: "versions-authority-unavailable" }
    const environment = await input.host.environment(http).catch(() => undefined)
    if (!environment) return { status: "unavailable", reason: "versions-environment-unavailable" }
    const result = await input.host.persistence.transaction<PortResult<VersionResult>>("planner", async (snapshot) => {
      const actor = await identify(snapshot, http, context).catch(() => undefined)
      if (!actor || !await allowed()) return { commit: false, value: { status: "denied", reason: "versions-authority-unavailable" } }
      const selectedId = "id" in request ? request.id : undefined
      const before = plannerVersions(snapshot, actor, environment, selectedId)
      if (!before) return { commit: false, value: { status: "denied", reason: "versions-authority-unavailable" } }
      const draft = gate === "planner.preview" ? structuredClone(snapshot) : snapshot
      const ids = { next: 0 }
      const previewId = () => {
        while (before.versions.some((version) => version.id === `version-preview-${ids.next}`)) ids.next++
        return `version-preview-${ids.next++}`
      }
      const execution = domain.execute(draft, actor, plannerVersionCommand(request), gate === "planner.preview" ? { ...environment, id: previewId } : environment)
      const after = plannerVersions(draft, actor, environment, execution.ok && typeof execution.value === "string" ? execution.value : selectedId)
      if (!after || digestSfValue(await identify(snapshot, http, context).catch(() => undefined)) !== digestSfValue(actor) || !await allowed()) return { commit: false, value: { status: "denied", reason: "versions-authority-changed" } }
      return { commit: gate === "planner.apply" && execution.ok, value: { status: "ok", value: { versions: gate === "planner.preview" ? before : after, request, outcome: versionOutcome(execution, before, selectedId), ...(gate === "planner.preview" && execution.ok ? { preview: after } : {}) } } }
    }, { signal: http.signal }).catch(() => ({ status: "unavailable" as const, reason: "versions-storage-unavailable" }))
    if (!await allowed()) return gate === "planner.apply" && result.status === "ok" && result.value.outcome.ok ? { status: "unavailable", reason: "versions-apply-outcome-requires-reconciliation" } : { status: "denied", reason: "versions-authority-changed" }
    return result
  }
  return { read, preview: (request: PlannerVersionRequest, context: TrustedDomainContext) => run(request, context, "planner.preview"), apply: (request: PlannerVersionRequest, context: TrustedDomainContext) => run(request, context, "planner.apply") }
}

function versionOutcome(result: Result, current: VersionsView, selectedId?: string): VersionOutcome {
  if (result.ok) return { ok: true, ...(typeof result.value === "string" ? { versionId: result.value } : {}) }
  const stored = current.versions.find((version) => version.id === selectedId)
  return { ok: false, status: result.status, errors: result.errors ?? [], ...(result.status === 409 && stored ? { stored } : {}) }
}
