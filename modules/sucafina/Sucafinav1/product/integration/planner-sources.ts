import { roleMap } from "../../runtime/admin.ts"
import { object } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { SfScopedSourcePort } from "./source-lifecycle.ts"
import { sfPlannerProjectionSelector } from "./source-projections.ts"

export function sfPlannerSourceSelector(id: string, incarnation: string, version: number) {
  return `planner-version:${encodeURIComponent(id)}:${encodeURIComponent(incarnation)}:${version}`
}

/** Pure reference construction; callers must authenticate and verify the current scoped identity. */
export function sfPlannerEvidenceRef(input: { versionId: string; projection: Record<string, unknown>; identity: { incarnation: string; version: number } }, context: TrustedDomainContext): Extract<BusinessEvidenceRef, { kind: "record" }> | undefined {
  const year = input.projection.year
  if (typeof year !== "number" || !Number.isSafeInteger(year) || year < 2001 || year > 2099) return undefined
  const value: Extract<BusinessEvidenceRef, { kind: "record" }> = {
    schema: "sf-evidence-v1", kind: "record", refId: sfPlannerSourceSelector(input.versionId, input.identity.incarnation, input.identity.version),
    installationId: context.binding.installationId, projectId: context.binding.projectId, refDigest: "", evidenceLevel: "observed",
    target: { surface: "planner", recordType: "planner-version", recordId: input.versionId, incarnation: input.identity.incarnation,
      version: input.identity.version, fields: Object.keys(input.projection), period: { start: `${year}-01-01`, end: `${year}-12-31` },
      projectionDigest: digestSfValue({ versionId: input.versionId, projection: input.projection }) },
  }
  return { ...value, refDigest: digestSfEvidenceRef(value) }
}

/** Same Request, role map, redaction and projector as the producer. Selectors never grant access. */
export function createSfPlannerSourceHost(input: {
  host: DomainPortHost
  scopedSources: SfScopedSourcePort
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
      const read = async () => {
        const describe = () => input.host.persistence.transaction("planner", async (snapshot) => {
          const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
          if (!principal || principal.id !== context.binding.principalRef) return { commit: false, value: undefined }
          const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
          const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
          return { commit: false, value: sfPlannerProjectionSelector(snapshot, actor) }
        }, { signal: request.signal })
        const selector = await describe()
        if (!selector) return undefined
        const scope = { principalRef: context.binding.principalRef, accessRevision: context.binding.accessRevision,
          policyVersion: context.binding.policyVersion, recordType: "planner-version", recordId: decoded[0]!, selector }
        const current = await input.scopedSources.readScopedSource("planner", scope, async (snapshot) => {
          if (request.signal.aborted) return false
          const principal = await input.host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
          if (!principal || principal.id !== scope.principalRef) return false
          const roles = principal.roles.filter((role) => role.surface === "planner").map((role) => role.role)
          const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer") }
          return digestSfValue(sfPlannerProjectionSelector(snapshot, actor)) === digestSfValue(selector)
        })
        if (!current || !await input.host.revalidate(context)) return undefined
        return { projection: object(current.projection), identity: { incarnation: current.incarnation, version: current.version } }
      }
      const current = await read().catch(() => undefined)
      if (!current) return { status: "denied", reason: "source-unavailable" }
      if (current.identity.incarnation !== decoded[1] || current.identity.version !== Number(parts[3])) return { status: "stale", reason: "source-replaced-or-changed" }
      const evidence = sfPlannerEvidenceRef({ versionId: decoded[0], ...current }, context)
      if (!evidence) return { status: "unavailable", reason: "invalid-source-period" }
      const again = await read().catch(() => undefined)
      if (!again || digestSfValue(again) !== digestSfValue(current) || !await input.host.revalidate(context)) return { status: "stale", reason: "source-or-authority-changed" }
      return { status: "ok", value: { versionId: decoded[0], evidence } }
    },
  }
}

function safeDecode(value: string) {
  try { return decodeURIComponent(value) } catch { return undefined }
}
