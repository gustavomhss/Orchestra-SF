import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { PreparedCommand } from "../contracts/context.ts"
import type { PortResult, ProcurementPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createProcurementSourceResolver } from "./sources.ts"

/** The host supplies a command from an authorized case; the result contains no executable command. */
export function createProcurementPreparedReview(input: { port: ProcurementPort; individual: ReturnType<typeof createProcurementSourceResolver> }) {
  return async (command: PreparedCommand, binding: TrustedDomainContext): Promise<PortResult<{ fields: readonly { field: string; before: string | number | boolean | null; after: string | number | boolean | null; beforeCurrency?: string; afterCurrency?: string }[]; source: Extract<BusinessEvidenceRef, { kind: "record" }> }>> => {
    if (command.target.surface !== "procurement" || command.target.type !== "procurement-request" || command.command.page !== "Requests" || command.command.action !== "save" || command.command.id !== command.target.id) return { status: "unavailable", reason: "prepared-review-unavailable" }
    const references = command.preview.values.flatMap((value) => value.sourceRefs)
    const source = references[0]
    if (!source || source.kind !== "record" || source.refDigest !== digestSfEvidenceRef(source) || source.target.recordType !== command.target.type || source.target.recordId !== command.target.id || source.target.incarnation !== command.target.incarnation || source.target.version !== command.target.version || digestSfValue(source.target.fields) !== digestSfValue(command.target.fields) || digestSfValue(source.target.period) !== digestSfValue(command.target.period) || command.preview.values.some((value) => value.sourceRefs.length !== 1 || digestSfValue(value.sourceRefs[0]) !== digestSfValue(source)) || references.some((ref) => digestSfValue(ref) !== digestSfValue(source))) return { status: "unavailable", reason: "prepared-source-unavailable" }
    const issued = await input.individual.issueForActor(source.target, binding, { requireCurrent: true })
    if (issued.status !== "ok") return issued
    if (issued.value.target.projectionDigest !== source.target.projectionDigest) return { status: "stale", reason: "prepared-source-changed" }
    const current = await input.port.read({ requestRef: issued.value.refId }, binding)
    if (current.status !== "ok") return current
    if (current.value.version !== issued.value.target.version || current.value.values.some((value) => value.sourceRefs.length !== 1 || digestSfValue(value.sourceRefs[0]) !== digestSfValue(issued.value))) return { status: "stale", reason: "prepared-source-changed" }
    const fields = ["subject", "reason", "originalAmount", "baseAmount"]
    const beforeIds = current.value.values.map((value) => value.id).sort()
    const afterIds = command.preview.values.map((value) => value.id).sort()
    if (new Set(beforeIds).size !== beforeIds.length || new Set(afterIds).size !== afterIds.length || digestSfValue(beforeIds) !== digestSfValue(afterIds) || current.value.values.some((value) => !fields.includes(value.id) && value.id !== "ageDays" && !command.preview.values.some((after) => after.id === value.id && digestSfValue({ value: value.value, currency: value.currency }) === digestSfValue({ value: after.value, currency: after.currency })))) return { status: "unavailable", reason: "prepared-fields-unavailable" }
    const changes = fields.flatMap((field) => {
      const before = current.value.values.find((value) => value.id === field)
      const after = command.preview.values.find((value) => value.id === field)
      if (!before || !after || digestSfValue({ value: before.value, currency: before.currency }) === digestSfValue({ value: after.value, currency: after.currency })) return []
      return [{ field, before: before.value, after: after.value, ...(before.currency ? { beforeCurrency: before.currency } : {}), ...(after.currency ? { afterCurrency: after.currency } : {}) }]
    })
    if (fields.some((field) => !current.value.values.some((value) => value.id === field) || !command.preview.values.some((value) => value.id === field))) return { status: "unavailable", reason: "prepared-fields-unavailable" }
    const again = await input.individual.issueForActor(source.target, binding, { requireCurrent: true })
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(issued.value)) return { status: "stale", reason: "prepared-source-changed" }
    return { status: "ok", value: { fields: changes, source: issued.value } }
  }
}
