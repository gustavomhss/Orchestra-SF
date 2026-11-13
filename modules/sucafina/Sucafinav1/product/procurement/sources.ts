import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ProductContext } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfSourceIdentity } from "../integration/source-lifecycle.ts"
import { procurementKeys } from "../../src/nav.ts"

export function procurementSourceSelector(kind: "procurement-request" | "procurement-supplier", id: string, incarnation: string, version: number) {
  return `${kind}:${encodeURIComponent(id)}:${encodeURIComponent(incarnation)}:${version}`
}

/** Resolves an opaque selector through the current authenticated domain view and lifecycle registry. */
export function createProcurementSourceResolver(input: {
  host: DomainPortHost
  contextFor: (binding: TrustedDomainContext) => Promise<PortResult<ProductContext>>
}) {
  return async (selector: string, binding: TrustedDomainContext): Promise<PortResult<{ evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; context: ProductContext }>> => {
    const match = /^(procurement-request|procurement-supplier):([^:]+):([^:]+):([1-9]\d*)$/.exec(selector)
    if (!match) return { status: "needs-input", reason: "Invalid source selector" }
    const id = decode(match[2]!)
    const incarnation = decode(match[3]!)
    const version = Number(match[4])
    if (!id || !incarnation || !Number.isSafeInteger(version)) return { status: "needs-input", reason: "Invalid source selector" }
    const request = input.host.requestFor(binding)
    if (!request || !(await input.host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
    const context = await input.contextFor(binding)
    if (context.status !== "ok") return context
    if (context.value.surface !== "procurement" || context.value.installationId !== binding.binding.installationId || context.value.projectId !== binding.binding.projectId || context.value.principalRef !== binding.binding.principalRef || context.value.policyVersion !== binding.binding.policyVersion || context.value.accessRevision !== binding.binding.accessRevision) return { status: "denied", reason: "Source authority mismatch" }
    const environment = await input.host.environment(request)
    const result = await input.host.persistence.transaction<PortResult<{ evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; context: ProductContext }>>("procurement", async (snapshot) => {
      const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
      const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
      if (!procurementKeys({ roles }).length || !snapshot.sfSources) return { commit: false, value: { status: "unavailable", reason: "Source unavailable" } }
      const actor: Actor = { id: principal.id, roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), assigned: [], domains: [] }
      const view = domain.view(snapshot, actor, environment)
      const record = match[1] === "procurement-request" ? rows(view.data.requests).find((row) => row.number === id) : rows(view.data.suppliers).find((row) => row.id === id)
      if (!record) return { commit: false, value: { status: "unavailable", reason: "Source unavailable" } }
      const identity = sfSourceIdentity(snapshot, match[1]!, id)
      if (!identity || identity.incarnation !== incarnation || identity.version !== version) return { commit: false, value: { status: "stale", reason: "Source changed" } }
      if (text(object(view.data.formSettings).currency) !== context.value.currency) return { commit: false, value: { status: "stale", reason: "Currency context changed" } }
      const fields = match[1] === "procurement-request" ? ["status", "holder", "stageEnteredAt", "ageDays", "baseAmount", "submittedAmount", "submittedCurrency", "submittedFxRate", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "subject", "reason", "nextStep", "sourcing"] : ["number", "legalName", "status", "categories", "taxId"]
      const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = {
        schema: "sf-evidence-v1", kind: "record", refId: selector, installationId: binding.binding.installationId, projectId: binding.binding.projectId, refDigest: "", evidenceLevel: "observed",
        target: { surface: "procurement", recordType: match[1]!, recordId: id, incarnation, version, fields, period: context.value.period, projectionDigest: digestProcurementSource(record, view.data.formSettings) },
      }
      return { commit: false, value: { status: "ok", value: { evidence: { ...evidence, refDigest: digestSfEvidenceRef(evidence) }, context: context.value } } }
    }, { signal: request.signal })
    if (!(await input.host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
    return result
  }
}

export function digestProcurementSource(value: unknown, settings: unknown) {
  const record = object(value)
  const setting = object(settings)
  const basis = { ...select(setting, ["currency", "techWeight", "commWeight", "minQuotes"]), fxRates: rows(setting.fxRates).map((rate) => select(rate, ["code", "rate"])), criteria: scoreCriteria(setting.criteria), commCriteria: scoreCriteria(setting.commCriteria) }
  if (!Object.hasOwn(record, "createdBy")) return digestSfValue({ record: select(record, ["id", "number", "legalName", "status", "categories", "taxId"]), settings: basis })
  const sourcing = object(record.sourcing)
  const po = object(record.po)
  return digestSfValue({
    record: {
      ...select(record, ["number", "status", "createdBy", "value", "prApprovalBaseCurrency"]),
      pr: select(object(record.pr), ["title", "justification", "estAmount"]),
      prApproval: selectApproval(record.prApproval),
      sourcing: record.sourcing == null ? null : { ...select(sourcing, ["selectedId", "selectionJustification", "fxSnapshot", "approvalBaseCurrency"]), weights: sourcing.weights == null ? null : { ...select(object(sourcing.weights), ["tech", "comm"]), criteria: scoreCriteria(object(sourcing.weights).criteria), commCriteria: scoreCriteria(object(sourcing.weights).commCriteria) }, approval: selectApproval(sourcing.approval), quotes: rows(sourcing.quotes).map((quote) => select(quote, ["id", "currency", "total", "qty", "unitPrice", "techPass", "scores", "cscores"])) },
      po: record.po == null ? null : { ...select(po, ["currency", "fxRate", "approvalBaseCurrency", "description"]), approval: selectApproval(po.approval), lines: rows(po.lines).map((line) => select(line, ["qty", "unitPrice"])) },
      history: rows(record.history).map((line) => select(line, ["at", "action"])),
    },
    settings: basis,
  })
}

function select(record: Record<string, unknown>, fields: readonly string[]) {
  return Object.fromEntries(fields.filter((field) => Object.hasOwn(record, field)).map((field) => [field, safeSource(record[field])]))
}

function selectApproval(value: unknown) {
  if (value == null) return null
  const approval = object(value)
  return { ...select(approval, ["amount", "fxRate"]), steps: rows(approval.steps).map((step) => select(step, ["holderId", "status", "levelName"])) }
}

function scoreCriteria(value: unknown) {
  return rows(value).map((criterion) => select(criterion, ["name", "weight", "auto"]))
}

function safeSource(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(safeSource)
  if (!value || typeof value !== "object") return value
  const record = object(value)
  const restricted = ["iban", "account", "bankname", "swift", "accountholder", "bankcountry"]
  if (typeof record.field === "string" && restricted.includes(record.field.toLowerCase())) return { field: record.field }
  return Object.fromEntries(Object.entries(record).filter(([key]) => !restricted.includes(key.toLowerCase())).map(([key, item]) => [key, safeSource(item)]))
}

function decode(value: string) {
  try {
    const decoded = decodeURIComponent(value)
    return decoded && encodeURIComponent(decoded) === value ? decoded : undefined
  } catch {
    return undefined
  }
}
