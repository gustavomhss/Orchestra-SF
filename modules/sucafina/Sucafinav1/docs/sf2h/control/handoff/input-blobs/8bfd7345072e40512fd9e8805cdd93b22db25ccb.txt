import { createDashboardRecordEvidenceHost } from "../dashboard/sources.ts"
import { createDashboardRecordSourceIssuer } from "../integration/dashboard-sources.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { DomainProjection, Period } from "../contracts/context.ts"
import type { ContractReadRequest } from "../contracts/operations.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"

const fields = ["num", "renewal", "vendor", "name", "desc", "category", "owner", "ownerId", "start", "end", "amount", "amtType", "renewType", "notice", "eval", "notes", "currency"]

/** Contract selectors come from the Dashboard owner; matching vendor text never establishes a supplier link. */
export function createProcurementContractSource(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort }) {
  const records = createDashboardRecordEvidenceHost({ ...input, issueRecord: createDashboardRecordSourceIssuer(input) })
  return {
    async issueContract(selection: { id: string; fields: readonly string[]; period: Period }, binding: TrustedDomainContext): Promise<PortResult<string>> {
      if (!selection || typeof selection.id !== "string" || !selection.id.trim() || !Array.isArray(selection.fields) || !selection.fields.length || selection.fields.some((field) => typeof field !== "string" || !fields.includes(field))) return { status: "needs-input", reason: "Contract fields unavailable" }
      const result = await records.issue({ page: "Vendor Contracts", recordType: "contracts", recordId: selection.id, fields: selection.fields, period: selection.period }, binding)
      if (result.status !== "ok") return result
      return { status: "ok", value: result.value.refId }
    },
    async readContractSource(request: ContractReadRequest, binding: TrustedDomainContext): Promise<PortResult<DomainProjection>> {
      if (!request || typeof request.contractRef !== "string" || !request.contractRef.trim() || !Array.isArray(request.fields) || !request.fields.length || new Set(request.fields).size !== request.fields.length || request.fields.some((field) => typeof field !== "string" || !fields.includes(field))) return { status: "needs-input", reason: "Contract fields unavailable" }
      const result = await records.read(request.contractRef, binding)
      if (result.status !== "ok") return result
      const sources = result.value.values.flatMap((value) => value.sourceRefs)
      const source = sources[0]
      if (!source || source.kind !== "record" || source.target.surface !== "dashboard" || source.target.recordType !== "contracts" || source.refId !== request.contractRef || sources.some((ref) => ref.refDigest !== source.refDigest) || request.fields.some((field) => !source.target.fields.includes(field))) return { status: "denied", reason: "Contract source scope mismatch" }
      const prefix = `contracts:${encodeURIComponent(source.target.recordId)}:`
      const currency = request.fields.includes("currency") ? result.value.values.find((value) => value.id === `${prefix}currency`)?.value : undefined
      const values = result.value.values.flatMap((value): DomainProjection["values"] => {
        const field = request.fields.find((item) => value.id === `${prefix}${encodeURIComponent(item)}`)
        return field ? [{ ...value, id: field, ...(field === "amount" && typeof currency === "string" && /^[A-Z]{3}$/.test(currency) ? { currency } : {}) }] : []
      })
      if (values.length !== request.fields.length) return { status: "unavailable", reason: "Contract projection incomplete" }
      return { status: "ok", value: { ...result.value, values, missing: values.filter((value) => value.value === null).map((value) => ({ field: value.id, reason: "missing" as const })) } }
    },
  }
}
