import { roleMap } from "../../runtime/admin.ts"
import { domain } from "../../runtime/procurement.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import type { DomainProjection, ProductContext } from "../contracts/context.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { DomainPortHost, PortResult, ProcurementPort } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { digestSfEvidenceRef } from "../contracts/canonical.ts"
import { digestProcurementSource } from "./sources.ts"
import { procurementKeys } from "../../src/nav.ts"
import { quoteAssessment, quoteComparisonPresentation } from "../../src/form.ts"
import { approvalStageEntry } from "../../src/procurement-screen.ts"
import { projectProcurementConfirmationFields } from "./confirmation-fields.ts"
import { procurementMonetaryFacts } from "./monetary.ts"
import type { RequestView } from "../../src/procurement-screen.ts"
import type { FormSettings } from "../../src/form.ts"
import type { ContractReadRequest, SourcingCompareRequest, SupplierReadRequest } from "../contracts/operations.ts"
import type { CommercialComparison } from "../contracts/outputs.ts"

export type ProcurementSourceHost = DomainPortHost & {
  resolveRequestSource: (reference: string, binding: TrustedDomainContext) => Promise<PortResult<{ evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; context: ProductContext }>>
  isCurrentRequestSource: (snapshot: Snapshot, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>) => boolean
  resolveRequestCollection: (selectionRef: string, binding: TrustedDomainContext) => Promise<PortResult<{ context: ProductContext; selection: Extract<BusinessEvidenceRef, { kind: "record" }>; statusSelections: Readonly<Record<string, Extract<BusinessEvidenceRef, { kind: "record" }>>>; requests: readonly Extract<BusinessEvidenceRef, { kind: "record" }>[] }>>
  isCurrentRequestCollection: (snapshot: Snapshot, selection: Extract<BusinessEvidenceRef, { kind: "record" }>, requests: readonly Extract<BusinessEvidenceRef, { kind: "record" }>[], statusSelections: Readonly<Record<string, Extract<BusinessEvidenceRef, { kind: "record" }>>>) => boolean
  resolveSupplierSource: (reference: string, binding: TrustedDomainContext) => Promise<PortResult<{ evidence: Extract<BusinessEvidenceRef, { kind: "record" }>; context: ProductContext }>>
  isCurrentSupplierSource: (snapshot: Snapshot, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>) => boolean
  readContractSource: (input: ContractReadRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>>
}

/** The host resolves incarnations and retains credentials; the domain still enforces the current role and row scope. */
export function createProcurementPort(host: ProcurementSourceHost): ProcurementPort & { list: (selectionRef: string, binding: TrustedDomainContext) => Promise<PortResult<{ stock: DomainProjection; aging: readonly DomainProjection[]; queue: readonly DomainProjection[] }>>; compareSourcing: (input: SourcingCompareRequest, binding: TrustedDomainContext) => Promise<PortResult<CommercialComparison>>; readSupplier: (input: SupplierReadRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>>; readContract: (input: ContractReadRequest, binding: TrustedDomainContext) => Promise<PortResult<DomainProjection>> } {
  return {
    async readContract(input, binding) {
      if (!(await host.revalidate(binding)) || !host.requestFor(binding)) return { status: "denied", reason: "Current authority unavailable" }
      const result = await host.readContractSource(input, binding)
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      if (result.status !== "ok") return result
      if (result.value.context.installationId !== binding.binding.installationId || result.value.context.projectId !== binding.binding.projectId || result.value.context.principalRef !== binding.binding.principalRef || result.value.context.accessRevision !== binding.binding.accessRevision || result.value.context.policyVersion !== binding.binding.policyVersion) return { status: "denied", reason: "Source authority mismatch" }
      if (result.value.components.length || result.value.values.some((value) => !input.fields.includes(value.id)) || result.value.missing.some((value) => !input.fields.includes(value.field))) return { status: "denied", reason: "Contract fields exceed the requested scope" }
      return result
    },
    async readSupplier(input, binding) {
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      const request = host.requestFor(binding)
      if (!request) return { status: "denied", reason: "Authenticated request unavailable" }
      const source = await host.resolveSupplierSource(input.supplierRef, binding)
      if (source.status !== "ok") return source
      const { evidence, context } = source.value
      const allowed = ["number", "legalName", "status", "categories", "taxId"]
      if (input.fields.some((field) => !allowed.includes(field) || !evidence.target.fields.includes(field))) return { status: "denied", reason: "Field unavailable" }
      if (digestSfEvidenceRef(evidence) !== evidence.refDigest || evidence.evidenceLevel !== "observed" || evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-supplier" || evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId || context.installationId !== binding.binding.installationId || context.projectId !== binding.binding.projectId || context.principalRef !== binding.binding.principalRef || context.accessRevision !== binding.binding.accessRevision || context.policyVersion !== binding.binding.policyVersion || context.surface !== "procurement") return { status: "denied", reason: "Source authority mismatch" }
      const environment = await host.environment(request)
      const result = await host.persistence.transaction<PortResult<DomainProjection>>("procurement", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
        if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
        if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: [], domains: [] }
        const view = domain.view(snapshot, actor, environment)
        const supplier = rows(view.data.suppliers).find((row) => row.id === evidence.target.recordId)
        if (!supplier) return { commit: false, value: { status: "unavailable", reason: "Supplier unavailable" } }
        if (!host.isCurrentSupplierSource(snapshot, evidence) || digestProcurementSource(supplier, view.data.formSettings, "supplier") !== evidence.target.projectionDigest || text(object(view.data.formSettings).currency) !== context.currency) return { commit: false, value: { status: "stale", reason: "Supplier identity or version changed" } }
        const values: DomainProjection["values"] = input.fields.flatMap((field): DomainProjection["values"] => {
          const value = supplier[field]
          if (field === "categories" && Array.isArray(value) && value.every((item) => typeof item === "string")) return [
            { id: "categories:count", value: value.length, period: context.period, granularity: "record" as const, sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" as const },
            ...value.map((item, index) => ({ id: `categories:${index}`, value: item as string, period: context.period, granularity: "record" as const, sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" as const })),
          ]
          if (typeof value !== "string" && typeof value !== "number" && typeof value !== "boolean") return []
          if (typeof value === "number" && !Number.isFinite(value)) return []
          return [{ id: field, value, period: context.period, granularity: "record" as const, sourceRefs: [evidence], drilldown: evidence, evidenceState: "confirmed" as const }]
        })
        return { commit: false, value: { status: "ok", value: { context, version: evidence.target.version, engineVersion: "procurement-v1", components: [], values, missing: input.fields.filter((field) => !values.some((value) => value.id === field || value.id.startsWith(`${field}:`))).map((field) => ({ field, reason: "unavailable" as const })) } } }
      }, { signal: request.signal })
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      return result
    },
    async compareSourcing(input, binding) {
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      const request = host.requestFor(binding)
      if (!request) return { status: "denied", reason: "Authenticated request unavailable" }
      const source = await host.resolveRequestSource(input.requestRef, binding)
      if (source.status !== "ok") return source
      const { evidence, context } = source.value
      if (digestSfEvidenceRef(evidence) !== evidence.refDigest || evidence.evidenceLevel !== "observed" || evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-request" || !evidence.target.fields.includes("sourcing") || evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId || context.installationId !== binding.binding.installationId || context.projectId !== binding.binding.projectId || context.principalRef !== binding.binding.principalRef || context.accessRevision !== binding.binding.accessRevision || context.policyVersion !== binding.binding.policyVersion || context.surface !== "procurement") return { status: "denied", reason: "Source authority mismatch" }
      const environment = await host.environment(request)
      const result = await host.persistence.transaction<PortResult<CommercialComparison>>("procurement", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
        if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
        if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: [], domains: [] }
        const view = domain.view(snapshot, actor, environment)
        const record = rows(view.data.requests).find((row) => row.number === evidence.target.recordId)
        if (!record) return { commit: false, value: { status: "unavailable", reason: "Request unavailable" } }
        if (!host.isCurrentRequestSource(snapshot, evidence) || digestProcurementSource(record, view.data.formSettings) !== evidence.target.projectionDigest || text(object(view.data.formSettings).currency) !== context.currency) return { commit: false, value: { status: "stale", reason: "Request identity or version changed" } }
        const sourcing = object(record.sourcing)
        const quotes = rows(sourcing.quotes)
        const quoteIds = quotes.map((quote) => text(quote.id))
        const snapshotRequired = sourcing.fxSnapshot != null || sourcing.approval != null || sourcing.approvalBaseCurrency != null || ["src_pending", "po_draft", "po_pending", "po_approved", "po_issued", "po_rejected"].includes(text(record.status))
        const sameBase = !snapshotRequired || sourcing.approvalBaseCurrency === context.currency
        if (!quotes.length || input.proposalRefs.some((id) => !quotes.some((quote) => quote.id === id))) return { commit: false, value: { status: "needs-input", reason: "Proposals unavailable" } }
        if (quoteIds.some((id) => !id) || new Set(quoteIds).size !== quoteIds.length) return { commit: false, value: { status: "unavailable", reason: "Proposal identities are missing or duplicated" } }
        const settings = { ...object(view.data.formSettings), currency: text(object(view.data.formSettings).currency) } as FormSettings
        const weights = object(sourcing.weights)
        const technical = rows(sourcing.weights == null ? settings.criteria : weights.criteria)
        const commercial = rows(sourcing.weights == null ? settings.commCriteria : weights.commCriteria)
        const criteria = [...technical, ...commercial].map((criterion) => text(criterion.name))
        const criteriaValid = [...technical, ...commercial].every((criterion) => typeof criterion.name === "string" && criterion.name.trim().length > 0 && typeof criterion.weight === "number" && Number.isFinite(criterion.weight)) && commercial.every((criterion) => criterion.auto == null || typeof criterion.auto === "boolean")
        const technicalWeight = sourcing.weights == null ? settings.techWeight : weights.tech
        const commercialWeight = sourcing.weights == null ? settings.commWeight : weights.comm
        const numericTechnicalWeight = typeof technicalWeight === "number" && Number.isFinite(technicalWeight) ? technicalWeight : null
        const numericCommercialWeight = typeof commercialWeight === "number" && Number.isFinite(commercialWeight) ? commercialWeight : null
        const weightsOutput = criteriaValid
          ? {
              technical: numericTechnicalWeight,
              commercial: numericCommercialWeight,
              technicalCriteria: technical.map((criterion) => ({ name: criterion.name as string, weight: criterion.weight as number })),
              commercialCriteria: commercial.map((criterion) => ({ name: criterion.name as string, weight: criterion.weight as number, automatic: criterion.auto === true })),
            }
          : null
        const configured = technical.length > 0 && commercial.length > 0 && criteriaValid && numericTechnicalWeight != null && numericCommercialWeight != null && technical.some((criterion) => typeof criterion.weight === "number" && criterion.weight > 0) && commercial.some((criterion) => typeof criterion.weight === "number" && criterion.weight > 0) && numericTechnicalWeight + numericCommercialWeight > 0
        if (input.criteria.length && (criteria.some((criterion) => !criterion) || new Set(input.criteria).size !== criteria.length || criteria.some((criterion) => !input.criteria.includes(criterion)))) return { commit: false, value: { status: "needs-input", reason: "Comparison uses all configured criteria; custom criteria are not supported" } }
        const ranking = quoteAssessment({ sourcing: { ...sourcing, ...(snapshotRequired && sourcing.fxSnapshot == null ? { fxSnapshot: { [context.currency]: 1 } } : {}) } as Parameters<typeof quoteAssessment>[0]["sourcing"] }, settings)
        const presentation = quoteComparisonPresentation({ sourcing: sourcing as Parameters<typeof quoteComparisonPresentation>[0]["sourcing"] }, settings, { submitted: snapshotRequired, submittedBaseCurrency: text(sourcing.approvalBaseCurrency) })
        const monetaryIssues = quotes.map((quote, index) => {
          const shown = presentation[index]
          const differs = typeof quote.total === "number" && typeof quote.qty === "number" && typeof quote.unitPrice === "number" && [quote.total, quote.qty, quote.unitPrice].every(Number.isFinite) && Math.abs(quote.total - quote.qty * quote.unitPrice) > 0.005
          return [...(shown?.monetary ?? ["monetary-data-unavailable"]), ...(shown?.total != null && shown.fxRate != null && !Number.isFinite(shown.total * shown.fxRate) ? ["base-amount-overflow"] : []), ...(differs ? ["total-quantity-mismatch"] : [])]
        })
        const monetaryProblem = monetaryIssues.some((issues) => issues.length > 0)
        const incompleteScores = ranking.some((item) => item.eligible && !item.complete)
        const selected = input.proposalRefs.length ? quotes.filter((quote) => input.proposalRefs.includes(text(quote.id))) : quotes
        const eligibleCount = ranking.filter((item) => item.eligible && selected.some((quote) => quote.id === item.id)).length
        const rankingAvailable = !monetaryProblem && sameBase && configured && !incompleteScores && eligibleCount >= 2
        const proposals = selected.map((quote) => {
          const evaluation = ranking.find((item) => item.id === quote.id)
          const quoteIndex = quotes.findIndex((item) => item.id === quote.id)
          const shown = presentation[quoteIndex]
          const currency = text(quote.currency)
          const snapshotRates = sourcing.fxSnapshot == null ? (snapshotRequired ? {} : null) : object(sourcing.fxSnapshot)
          const rate = !currency ? null : currency === context.currency ? 1 : snapshotRates ? snapshotRates[currency] : settings.fxRates?.find((item) => item.code === currency)?.rate
          const converted = sameBase && currency.length > 0 && typeof quote.total === "number" && Number.isFinite(quote.total) && typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? quote.total * rate : null
          const convertedAmount = converted != null && Number.isFinite(converted) && !(monetaryIssues[quoteIndex] ?? []).some((issue) => issue !== "total-quantity-mismatch") ? converted : null
          const differs = typeof quote.total === "number" && typeof quote.qty === "number" && typeof quote.unitPrice === "number" && [quote.total, quote.qty, quote.unitPrice].every(Number.isFinite) && Math.abs(quote.total - quote.qty * quote.unitPrice) > 0.005
          const scoreAvailable = rankingAvailable && evaluation?.complete === true && evaluation?.eligible === true
          const components = {
            technical: scoreAvailable && evaluation && Number.isFinite(evaluation.technical) ? evaluation.technical : null,
            price: scoreAvailable && evaluation && Number.isFinite(evaluation.price) ? evaluation.price : null,
            commercial: scoreAvailable && evaluation && Number.isFinite(evaluation.commercial) ? evaluation.commercial : null,
            overall: scoreAvailable && evaluation && Number.isFinite(evaluation.overall) ? evaluation.overall : null,
          }
          const money = {
            originalAmount: shown?.total ?? null,
            originalCurrency: shown?.currency ?? null,
            baseCurrency: sameBase ? context.currency : null,
            fxRate: shown?.fxRate ?? null,
            fxSource: shown?.fxRate == null || shown.currency == null ? null : shown.currency === context.currency ? "base" as const : sourcing.fxSnapshot != null ? "submitted" as const : "current" as const,
          }
          const issues = [...(!sameBase ? ["Submitted base currency unavailable or changed"] : []), ...(convertedAmount == null ? ["Missing, invalid or overflowing amount/exchange rate"] : []), ...((monetaryIssues[quoteIndex] ?? []).filter((issue) => issue === "currency-missing" || issue === "total-missing" || issue === "total-invalid" || issue === "total-not-positive" || issue === "fx-missing" || issue === "fx-invalid" || issue === "submitted-base-unavailable" || issue === "base-amount-overflow").map((issue) => `Monetary issue: ${issue}`)), ...(!configured ? ["Evaluation criteria unavailable"] : []), ...(!evaluation?.complete ? ["Scores incomplete"] : []), ...(quote.techPass === false ? ["Technically ineligible"] : []), ...(differs ? ["Stated total differs from quantity times unit price"] : [])]
          return { proposalRef: text(quote.id), eligible: sameBase && !(monetaryIssues[quoteIndex] ?? []).some((issue) => issue !== "total-quantity-mismatch") && evaluation?.eligible === true, score: components.overall, components, money, convertedAmount, evidenceRefs: [evidence], issues }
        })
        const conditions = [
          ...(selected.length < 2 ? [{ id: "few-proposals", category: "comparison", reason: "Fewer than two proposals were selected for comparison", evidenceRefs: [evidence] }] : []),
          ...(selected.length >= 2 && eligibleCount < 2 ? [{ id: "few-eligible-proposals", category: "comparison", reason: "Fewer than two selected proposals are eligible for comparison", evidenceRefs: [evidence] }] : []),
          ...(incompleteScores ? [{ id: "incomplete-scores", category: "comparison", reason: "Required human assessments are incomplete; ranking is withheld", evidenceRefs: [evidence] }] : []),
          ...(monetaryProblem ? [{ id: "monetary-comparison-unavailable", category: "comparison", reason: "Ranking withheld because one or more proposals has missing, invalid or inconsistent monetary data", evidenceRefs: [evidence] }] : []),
          ...(proposals.some((item) => item.issues.length) ? [{ id: "incomplete-proposals", category: "comparison", reason: "Some proposals are incomplete or ineligible", evidenceRefs: [evidence] }] : []),
        ]
        const selectedId = text(sourcing.selectedId)
        const selection = { proposalRef: selectedId && quotes.some((quote) => text(quote.id) === selectedId) ? selectedId : null, reason: text(sourcing.selectionJustification) || null }
        const comparison = { requestRef: input.requestRef, requestVersion: evidence.target.version, currency: context.currency, proposals, ranking: rankingAvailable ? ranking.filter((item) => item.rank != null && item.complete && selected.some((quote) => quote.id === item.id)).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0)).flatMap((item) => item.id ? [item.id] : []) : [], conditions, sourceRefs: [evidence], weights: weightsOutput, selection }
        return { commit: false, value: { status: "ok", value: comparison } }
      }, { signal: request.signal })
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      return result
    },
    async list(selectionRef, binding) {
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      const request = host.requestFor(binding)
      if (!request) return { status: "denied", reason: "Authenticated request unavailable" }
      const source = await host.resolveRequestCollection(selectionRef, binding)
      if (source.status !== "ok") return source
      const { context, selection, requests, statusSelections } = source.value
      if (context.surface !== "procurement" || context.installationId !== binding.binding.installationId || context.projectId !== binding.binding.projectId || context.principalRef !== binding.binding.principalRef || context.accessRevision !== binding.binding.accessRevision || context.policyVersion !== binding.binding.policyVersion ||
          selection.evidenceLevel !== "observed" || selection.target.surface !== "procurement" || selection.target.recordType !== "procurement-request-selection" || selection.installationId !== context.installationId || selection.projectId !== context.projectId || digestSfEvidenceRef(selection) !== selection.refDigest ||
          requests.some((ref) => ref.evidenceLevel !== "observed" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request" || ref.installationId !== context.installationId || ref.projectId !== context.projectId || digestSfEvidenceRef(ref) !== ref.refDigest || !ref.target.fields.includes("status")) ||
          Object.values(statusSelections).some((ref) => ref.evidenceLevel !== "observed" || ref.target.surface !== "procurement" || ref.target.recordType !== "procurement-request-selection" || ref.installationId !== context.installationId || ref.projectId !== context.projectId || digestSfEvidenceRef(ref) !== ref.refDigest) ||
          new Set(requests.map((ref) => ref.target.recordId)).size !== requests.length || new Set(requests.map((ref) => ref.refId)).size !== requests.length) return { status: "denied", reason: "Source authority mismatch" }
      const environment = await host.environment(request)
      const result = await host.persistence.transaction<PortResult<{ stock: DomainProjection; aging: readonly DomainProjection[]; queue: readonly DomainProjection[] }>>("procurement", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
        if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
        if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: [], domains: [] }
        const view = domain.view(snapshot, actor, environment)
        if (text(object(view.data.formSettings).currency) !== context.currency || !host.isCurrentRequestCollection(snapshot, selection, requests, statusSelections)) return { commit: false, value: { status: "stale", reason: "Selection changed" } }
        const visible = rows(view.data.requests)
        if (requests.some((ref) => !host.isCurrentRequestSource(snapshot, ref) || !visible.some((row) => row.number === ref.target.recordId && digestProcurementSource(row, view.data.formSettings) === ref.target.projectionDigest))) return { commit: false, value: { status: "unavailable", reason: "Selection unavailable" } }
        const projections = requests.map((ref) => projectProcurementSource(visible.find((row) => row.number === ref.target.recordId)!, context, ref, environment.at, view.data.formSettings))
        const open = projections.filter((projection) => projection.values.some((value) => value.id === "status" && value.value !== "po_issued" && value.value !== "cancelled"))
        const statuses = [...new Set(open.map((projection) => String(projection.values.find((value) => value.id === "status")?.value ?? "unknown")))].sort()
        if (statuses.some((status) => !statusSelections[status])) return { commit: false, value: { status: "unavailable", reason: "Stage selection unavailable" } }
        const stock: DomainProjection = { context, version: selection.target.version, engineVersion: "procurement-v1", components: [], missing: [], values: statuses.map((status) => ({ id: `stock:${status}`, value: open.filter((projection) => projection.values.some((value) => value.id === "status" && (value.value ?? "unknown") === status)).length, unit: "requests", period: context.period, granularity: "aggregate", sourceRefs: requests.filter((ref) => open.some((projection) => projection.values.some((value) => value.id === "status" && (value.value ?? "unknown") === status && value.sourceRefs.some((source) => source.refId === ref.refId)))), drilldown: statusSelections[status]!, evidenceState: "confirmed" })) }
        return { commit: false, value: { status: "ok", value: { stock, aging: projections.filter((projection) => projection.values.some((value) => value.id === "status" && typeof value.value === "string" && value.value.endsWith("_pending"))), queue: projections } } }
      }, { signal: request.signal })
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      return result
    },
    async read(input, binding) {
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      const request = host.requestFor(binding)
      if (!request) return { status: "denied", reason: "Authenticated request unavailable" }
      const source = await host.resolveRequestSource(input.requestRef, binding)
      if (source.status !== "ok") return source
      const evidence = source.value.evidence
      const context = source.value.context
      if (digestSfEvidenceRef(evidence) !== evidence.refDigest || evidence.evidenceLevel !== "observed" || evidence.target.surface !== "procurement" || evidence.target.recordType !== "procurement-request" ||
          evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId ||
          context.principalRef !== binding.binding.principalRef || context.accessRevision !== binding.binding.accessRevision || context.policyVersion !== binding.binding.policyVersion ||
          context.installationId !== binding.binding.installationId || context.projectId !== binding.binding.projectId || context.surface !== "procurement") {
        return { status: "denied", reason: "Source authority mismatch" }
      }
      const environment = await host.environment(request)
      const result = await host.persistence.transaction<PortResult<DomainProjection>>("procurement", async (snapshot) => {
        const principal = await host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
        if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
        if (!procurementKeys({ roles }).length) return { commit: false, value: { status: "denied", reason: "Current authority unavailable" } }
        const actor: Actor = { id: principal.id, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roles, assigned: [], domains: [] }
        const view = domain.view(snapshot, actor, environment)
        if (!host.isCurrentRequestSource(snapshot, evidence)) return { commit: false, value: { status: "stale", reason: "Request identity changed" } }
        const record = rows(view.data.requests).find((row) => row.number === evidence.target.recordId)
        if (!record) return { commit: false, value: { status: "unavailable", reason: "Request unavailable" } }
        if (digestProcurementSource(record, view.data.formSettings) !== evidence.target.projectionDigest) return { commit: false, value: { status: "stale", reason: "Request projection changed" } }
        if (text(object(view.data.formSettings).currency) !== context.currency) return { commit: false, value: { status: "stale", reason: "Currency context changed" } }
        return { commit: false, value: { status: "ok", value: projectProcurementSource(record, context, evidence, environment.at, view.data.formSettings) } }
      }, { signal: request.signal })
      if (!(await host.revalidate(binding))) return { status: "denied", reason: "Current authority unavailable" }
      return result
    },
  }
}

/** Projects only already-authorized domain data, without exposing private bank or scoring inputs. */
export function projectProcurementSource(record: Record<string, unknown>, context: ProductContext, evidence: Extract<BusinessEvidenceRef, { kind: "record" }>, observedAt?: string, formSettings?: unknown): DomainProjection {
  const status = text(record.status)
  const knownStatus = ["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled"].includes(status)
  const approval = object(status === "pr_pending" ? record.prApproval : status === "src_pending" ? object(record.sourcing).approval : status === "po_pending" ? object(record.po).approval : null)
  const holder = rows(approval.steps).find((step) => step.status === "pending")
  const action = status === "pr_pending" ? "Requisition submitted for approval" : status === "src_pending" ? "Sourcing submitted for approval" : status === "po_pending" ? "Purchase order submitted for approval" : ""
  const entry = approvalStageEntry(record as RequestView)
  const period = context.period
  const enteredAt = entry ? Date.parse(entry) : NaN
  const now = observedAt ? Date.parse(observedAt) : NaN
  const age = Number.isFinite(enteredAt) && Number.isFinite(now) && now >= enteredAt ? (now - enteredAt) / 86400000 : null
  const material = projectProcurementConfirmationFields(record, ["status", "subject", "reason", "holder", "approvalStage", "nextStep"])!
  const subject = material.values.subject
  const reason = material.values.reason
  const next = material.values.nextStep
  const money = procurementMonetaryFacts(record, context.currency, formSettings)
  const values = ([
    { id: "status", value: knownStatus ? status : null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: knownStatus ? "confirmed" : "absent" },
    { id: "holder", value: material.values.holder ?? null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: material.values.holder ? "confirmed" : "absent" },
    { id: "approvalStage", value: material.values.approvalStage ?? null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: typeof holder?.levelName === "string" && holder.levelName ? "confirmed" : "absent" },
    { id: "stageEnteredAt", value: entry, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: entry ? "confirmed" : "absent" },
    { id: "ageDays", value: age, unit: "days", period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: age == null ? "absent" : "confirmed" },
    { id: "baseAmount", value: money.baseAmount, currency: context.currency, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.baseAmount == null ? "absent" : money.moneyEvidence },
    { id: "submittedAmount", value: money.submittedAmount, ...(money.submittedCurrency ? { currency: money.submittedCurrency } : {}), period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.submittedAmount == null ? "absent" : "confirmed" },
    { id: "submittedCurrency", value: money.submittedCurrency || null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.submittedCurrency ? "confirmed" : "absent" },
    { id: "submittedFxRate", value: money.submittedFxRate, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.submittedFxRate == null ? "absent" : "confirmed" },
    { id: "originalAmount", value: money.original != null && Number.isFinite(money.original) ? money.original : null, ...(money.currency ? { currency: money.currency } : {}), period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.original != null && Number.isFinite(money.original) ? money.moneyEvidence : "absent" },
    { id: "originalCurrency", value: money.currency || null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: !money.currency ? "absent" : money.explicitCurrency ? "confirmed" : "estimated" },
    { id: "fxRate", value: money.validRate, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.validRate == null ? "absent" : money.explicitCurrency ? "confirmed" : "estimated" },
    { id: "fxSource", value: money.fxSource, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.validRate == null ? "absent" : "confirmed" },
    { id: "monetaryState", value: money.monetaryState, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: money.monetaryState ? "confirmed" : "absent" },
    { id: "subject", value: subject || null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: subject ? "confirmed" : "absent" },
    { id: "reason", value: reason || null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: reason ? "confirmed" : "absent" },
    { id: "nextStep", value: next || null, period, granularity: "record", sourceRefs: [evidence], drilldown: evidence, evidenceState: next ? "confirmed" : "absent" },
  ] satisfies DomainProjection["values"]).filter((value) => evidence.target.fields.includes(value.id))
  return { context, version: evidence.target.version, engineVersion: "procurement-v1", components: [], values, missing: [
    ...(evidence.target.fields.includes("status") && !knownStatus ? [{ field: "status", reason: "unavailable" as const }] : []),
    ...(evidence.target.fields.includes("stageEnteredAt") && action && !Number.isFinite(enteredAt) ? [{ field: "stageEnteredAt", reason: "unavailable" as const }] : []),
    ...(evidence.target.fields.includes("ageDays") && action && age == null ? [{ field: "ageDays", reason: "unavailable" as const }] : []),
    ...(evidence.target.fields.includes("baseAmount") && money.baseAmount == null ? [{ field: "baseAmount", reason: "unavailable" as const }] : []),
    ...(evidence.target.fields.includes("originalCurrency") && !money.explicitCurrency ? [{ field: "originalCurrency", reason: "missing" as const }] : []),
    ...(evidence.target.fields.includes("fxRate") && money.validRate == null ? [{ field: "fxRate", reason: "missing-fx" as const }] : []),
    ...(evidence.target.fields.includes("holder") && action && !material.values.holder ? [{ field: "holder", reason: "missing" as const }] : []),
    ...(evidence.target.fields.includes("approvalStage") && action && !holder?.levelName ? [{ field: "approvalStage", reason: "missing" as const }] : []),
  ] }
}
