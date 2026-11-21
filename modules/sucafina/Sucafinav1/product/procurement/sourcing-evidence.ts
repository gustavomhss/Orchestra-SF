import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { procurementKeys } from "../../src/nav.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createProcurementPort } from "./port.ts"
import type { ProcurementSourceHost } from "./port.ts"
import { digestProcurementSource } from "./sources.ts"

/** Host-private source facts for verifying skill inputs, not a second scoring engine. */
export function createProcurementSourcingEvidence(host: ProcurementSourceHost) {
  return async (requestRef: string, binding: TrustedDomainContext) => {
    const request = host.requestFor(binding)
    if (!request || !await host.revalidate(binding)) return { status: "denied" as const, reason: "current-authority-unavailable" }
    const source = await host.resolveRequestSource(requestRef, binding)
    if (source.status !== "ok") return source
    const evidence = source.value.evidence
    const context = source.value.context
    if (evidence.refId !== requestRef || evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.evidenceLevel !== "observed" || evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId || evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-request" || !evidence.target.fields.includes("sourcing") || digestSfValue(evidence.target.period) !== digestSfValue(context.period) || context.surface !== "procurement" || context.installationId !== binding.binding.installationId || context.projectId !== binding.binding.projectId || context.principalRef !== binding.binding.principalRef || context.accessRevision !== binding.binding.accessRevision || context.policyVersion !== binding.binding.policyVersion) return { status: "denied" as const, reason: "source-authority-mismatch" }
    const environment = await host.environment(request)
    const result = await host.persistence.transaction<PortResult<{ stage: string; offers: readonly { offerRef: string; version: number; currency: string | null; amount: number | null; technicalPass: boolean | null }[]; submittedBaseCurrency: string | null; submittedFx: readonly { from: string; rate: number | null }[]; weights: { technical: number | null; commercial: number | null; technicalCriteria: readonly { name: string; weight: number | null; automatic: boolean }[]; commercialCriteria: readonly { name: string; weight: number | null; automatic: boolean }[] }; evidence: typeof evidence; context: typeof context }>>("procurement", async (snapshot) => {
      const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
      if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
      if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "current-authority-unavailable" } }
      const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: [], domains: [] }
      const view = domain.view(snapshot, actor, environment)
      const record = rows(view.data.requests).find((row) => row.number === evidence.target.recordId)
      if (!record) return { commit: false, value: { status: "unavailable", reason: "request-unavailable" } }
      if (!host.isCurrentRequestSource(snapshot, evidence) || digestProcurementSource(record, view.data.formSettings) !== evidence.target.projectionDigest || text(object(view.data.formSettings).currency) !== context.currency) return { commit: false, value: { status: "stale", reason: "request-changed" } }
      const stage = text(record.status)
      if (!["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled"].includes(stage)) return { commit: false, value: { status: "unavailable", reason: "request-stage-unavailable" } }
      const sourcing = object(record.sourcing)
      const settings = object(view.data.formSettings)
      const weights = object(sourcing.weights)
      const num = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null
      const criteria = (value: unknown) => rows(value).map((entry) => ({ name: text(entry.name), weight: num(entry.weight), automatic: entry.auto === true }))
      // Quotes have no independent revision; their evidence version is the parent request scope.
      const offers = rows(sourcing.quotes).map((quote) => ({ offerRef: text(quote.id), version: evidence.target.version, currency: text(quote.currency) || null, amount: num(quote.total), technicalPass: typeof quote.techPass === "boolean" ? quote.techPass : null }))
      if (offers.some((offer) => !offer.offerRef) || new Set(offers.map((offer) => offer.offerRef)).size !== offers.length) return { commit: false, value: { status: "unavailable", reason: "offer-identity-unavailable" } }
      const rates = object(sourcing.fxSnapshot)
      const submittedFx = Object.keys(rates).sort().map((from) => ({ from, rate: num(rates[from]) }))
      return { commit: false, value: { status: "ok", value: { stage, offers, submittedBaseCurrency: text(sourcing.approvalBaseCurrency) || null, submittedFx, weights: { technical: num(sourcing.weights == null ? settings.techWeight : weights.tech), commercial: num(sourcing.weights == null ? settings.commWeight : weights.comm), technicalCriteria: criteria(sourcing.weights == null ? settings.criteria : weights.criteria), commercialCriteria: criteria(sourcing.weights == null ? settings.commCriteria : weights.commCriteria) }, evidence, context } } }
    }, { signal: request.signal })
    if (result.status !== "ok") return result
    const comparison = await createProcurementPort(host).compareSourcing({ requestRef, proposalRefs: [], criteria: [] }, binding)
    if (comparison.status !== "ok" && comparison.status !== "needs-input") return comparison
    if (comparison.status === "ok" && (comparison.value.requestVersion !== evidence.target.version || !comparison.value.sourceRefs.length || comparison.value.sourceRefs.some((ref) => digestSfValue(ref) !== digestSfValue(evidence)))) return { status: "stale" as const, reason: "comparison-source-changed" }
    const current = await host.resolveRequestSource(requestRef, binding)
    if (current.status !== "ok" || digestSfValue(current.value) !== digestSfValue(source.value) || !await host.revalidate(binding)) return { status: "stale" as const, reason: "source-or-authority-changed" }
    return { status: "ok" as const, value: { ...result.value, comparison: comparison.status === "ok" ? comparison.value : null } }
  }
}
