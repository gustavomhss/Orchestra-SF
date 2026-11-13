import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { projectPlannerSource } from "../planner/port.ts"
import { sfSourceIdentity } from "./source-lifecycle.ts"

export function sfPlannerSourceSelector(id: string, incarnation: string, version: number) {
  return `planner-version:${encodeURIComponent(id)}:${encodeURIComponent(incarnation)}:${version}`
}

/** Same Request, role map, redaction and projector as the producer. Selectors never grant access. */
export function createSfPlannerSourceHost(input: {
  host: DomainPortHost
  coverageFor: PlannerSourceHost["resolveForecastCoverage"]
}): PlannerSourceHost {
  return {
    resolveForecastCoverage: input.coverageFor,
    resolveForecastSource: async (reference, context): Promise<PortResult<{ versionId: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>> => {
      const parts = /^planner-version:([^:]+):([^:]+):([1-9]\d*)$/.exec(reference)
      if (!parts) return { status: "needs-input", reason: "invalid-planner-source-selector" }
      const decoded = [parts[1]!, parts[2]!].map((part) => {
        const decoded = safeDecode(part)
        return decoded && encodeURIComponent(decoded) === part ? decoded : undefined
      })
      if (!decoded[0] || !decoded[1] || !Number.isSafeInteger(Number(parts[3]))) return { status: "needs-input", reason: "invalid-planner-source-selector" }
      const request = input.host.requestFor(context)
      if (!request || !await input.host.revalidate(context)) return { status: "denied", reason: "source-authority-unavailable" }
      const read = () => input.host.persistence.transaction("planner", async (snapshot) => {
        const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
        if (!principal || principal.id !== context.binding.principalRef) return { commit: false, value: undefined }
        const access = object(object(snapshot.data.access)[principal.id])
        const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
        const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"),
          assigned: Array.isArray(access.assigned) ? access.assigned.filter((value): value is string => typeof value === "string") : [],
          domains: Array.isArray(access.domains) ? access.domains.filter((value): value is string => typeof value === "string") : [] }
        const projection = projectPlannerSource(snapshot, actor, decoded[0]!)
        if (!projection) return { commit: false, value: undefined }
        const identity = sfSourceIdentity(snapshot, "planner-version", decoded[0]!)
        if (!identity) return { commit: false, value: undefined }
        return { commit: false, value: { projection, identity } }
      }, { signal: request.signal })
      const current = await read().catch(() => undefined)
      if (!current) return { status: "denied", reason: "source-unavailable" }
      if (current.identity.incarnation !== decoded[1] || current.identity.version !== Number(parts[3])) return { status: "stale", reason: "source-replaced-or-changed" }
      const year = current.projection.year
      if (typeof year !== "number" || !Number.isSafeInteger(year) || year < 2001 || year > 2099) return { status: "unavailable", reason: "invalid-source-period" }
      const value: Extract<BusinessEvidenceRef, { kind: "record" }> = {
        schema: "sf-evidence-v1", kind: "record", refId: reference, installationId: context.binding.installationId, projectId: context.binding.projectId,
        refDigest: "", evidenceLevel: "observed", target: { surface: "planner", recordType: "planner-version", recordId: decoded[0],
          incarnation: current.identity.incarnation, version: current.identity.version, fields: Object.keys(current.projection),
          period: { start: `${year}-01-01`, end: `${year}-12-31` }, projectionDigest: digestSfValue({ versionId: decoded[0], projection: current.projection }) },
      }
      const again = await read().catch(() => undefined)
      if (!again || digestSfValue(again) !== digestSfValue(current) || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-authority-changed" }
      return { status: "ok", value: { versionId: decoded[0], evidence: { ...value, refDigest: digestSfEvidenceRef(value) } } }
    },
  }
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value) } catch { return undefined }
}
