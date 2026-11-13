import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ProductContext } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfScopedSourcePort, SfSourceScope } from "../integration/source-lifecycle.ts"
import { projectSfProcurementScope } from "../integration/procurement-projections.ts"
import { procurementKeys } from "../../src/nav.ts"

/** Individual source refs are issued and held by the authenticated host. */
export function createProcurementSourceResolver(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort; contextFor: (binding: TrustedDomainContext) => Promise<PortResult<ProductContext>> }) {
  type Evidence = Extract<BusinessEvidenceRef, { kind: "record" }>
  type Entry = { context: ProductContext; scope: SfSourceScope; evidence: Evidence; inputDigest: string; expiresAt: number }
  const entries = new Map<string, Entry>()
  const matches = (context: ProductContext, binding: TrustedDomainContext) => context.surface === "procurement" && context.installationId === binding.binding.installationId && context.projectId === binding.binding.projectId && context.principalRef === binding.binding.principalRef && context.accessRevision === binding.binding.accessRevision && context.policyVersion === binding.binding.policyVersion
  const authenticate = async (request: Request, binding: TrustedDomainContext, snapshot: Snapshot, fields: readonly string[]) => {
    const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
    if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
    if (!procurementKeys({ roles }).length) return undefined
    return { kind: "procurement-record-v1", roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), fields }
  }
  const authorize = async (request: Request, binding: TrustedDomainContext, snapshot: Snapshot, scope: SfSourceScope) => {
    const fields = object(scope.selector).fields
    return Array.isArray(fields) && !request.signal.aborted && digestSfValue(await authenticate(request, binding, snapshot, fields)) === digestSfValue(scope.selector)
  }
  return {
    async issue(kind: "procurement-request" | "procurement-supplier", id: string, binding: TrustedDomainContext): Promise<PortResult<string>> {
      if (!id.trim() || !["procurement-request", "procurement-supplier"].includes(kind)) return { status: "needs-input", reason: "Invalid source selection" }
      const request = input.host.requestFor(binding)
      if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      const context = await input.contextFor(binding)
      if (context.status !== "ok") return context
      if (!matches(context.value, binding)) return { status: "denied", reason: "Source authority mismatch" }
      const fields = kind === "procurement-request" ? ["status", "holder", "stageEnteredAt", "ageDays", "baseAmount", "submittedAmount", "submittedCurrency", "submittedFxRate", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "subject", "reason", "nextStep", "sourcing"] : ["number", "legalName", "status", "categories", "taxId"]
      const selector = await input.host.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: await authenticate(request, binding, snapshot, fields) }), { signal: request.signal })
      if (!selector) return { status: "denied", reason: "Current authority unavailable" }
      const scope: SfSourceScope = { principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, recordType: kind, recordId: id, selector }
      const source = await input.scopedSources.readScopedSource("procurement", scope, (snapshot) => authorize(request, binding, snapshot, scope))
      if (!source) return { status: "unavailable", reason: "Source unavailable" }
      const projection = object(source.projection)
      if (projection.id !== id || typeof projection.privateDependencyDigest !== "string" || !/^[a-f0-9]{64}$/.test(projection.privateDependencyDigest)) return { status: "unavailable", reason: "Source unavailable" }
      const environment = await input.host.environment(request)
      const fresh = await input.host.persistence.transaction("procurement", async (snapshot) => {
        if (!await authorize(request, binding, snapshot, scope)) return { commit: false, value: false }
        const view = domain.view(snapshot, { id: binding.binding.principalRef, roles: selector.roles, canWrite: selector.canWrite, assigned: [], domains: [] }, environment)
        return { commit: false, value: text(object(view.data.formSettings).currency) === context.value.currency && digestSfValue(projectSfProcurementScope("procurement", snapshot, scope)) === source.inputDigest }
      }, { signal: request.signal })
      if (!fresh || !await input.host.revalidate(binding)) return { status: "stale", reason: "Source changed" }
      for (const [key, entry] of entries) if (entry.expiresAt <= Date.now()) entries.delete(key)
      if (entries.size >= 5000) return { status: "unavailable", reason: "Source registry full" }
      const evidence: Evidence = { schema: "sf-evidence-v1", kind: "record", refId: crypto.randomUUID(), installationId: context.value.installationId, projectId: context.value.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "procurement", recordType: kind, recordId: id, incarnation: source.incarnation, version: source.version, fields, period: context.value.period, projectionDigest: projection.privateDependencyDigest } }
      const issued = { ...evidence, refDigest: digestSfEvidenceRef(evidence) }
      entries.set(issued.refId, { context: context.value, scope, evidence: issued, inputDigest: source.inputDigest, expiresAt: Date.now() + 5 * 60_000 })
      return { status: "ok", value: issued.refId }
    },
    async resolve(ref: string, binding: TrustedDomainContext): Promise<PortResult<{ evidence: Evidence; context: ProductContext }>> {
      const entry = entries.get(ref)
      if (!entry || entry.expiresAt <= Date.now()) return { status: "unavailable", reason: "Source unavailable" }
      const request = input.host.requestFor(binding)
      if (!request || !matches(entry.context, binding) || !await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      const context = await input.contextFor(binding)
      if (context.status !== "ok") return context
      if (digestSfValue(context.value) !== digestSfValue(entry.context)) return { status: "stale", reason: "Context changed" }
      const current = await input.scopedSources.resolveScopedSource("procurement", entry.evidence.target.incarnation, (snapshot, scope) => authorize(request, binding, snapshot, scope))
      if (!current || current.version !== entry.evidence.target.version || current.inputDigest !== entry.inputDigest || digestSfValue(current.scope) !== digestSfValue(entry.scope)) return { status: "stale", reason: "Source changed" }
      if (!await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      return { status: "ok", value: { evidence: structuredClone(entry.evidence), context: structuredClone(entry.context) } }
    },
    isCurrent(snapshot: Snapshot, evidence: Evidence) {
      const entry = entries.get(evidence.refId)
      if (!entry || entry.expiresAt <= Date.now() || digestSfValue(entry.evidence) !== digestSfValue(evidence)) return false
      const current = sfScopedSourceIdentity(snapshot, entry.scope)
      return !!current && current.incarnation === evidence.target.incarnation && current.version === evidence.target.version && current.inputDigest === entry.inputDigest
    },
  }
}

/** Host-held selectors are scoped evidence, never a substitute for authenticating the Request. */
export function createProcurementCollectionRegistry(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort; contextFor: (binding: TrustedDomainContext) => Promise<PortResult<ProductContext>> }) {
  type Evidence = Extract<BusinessEvidenceRef, { kind: "record" }>
  type Selection = { context: ProductContext; selection: Evidence; statusSelections: Readonly<Record<string, Evidence>>; requests: readonly Evidence[] }
  type Entry = { scope: SfSourceScope; value: Selection; expiresAt: number }
  const entries = new Map<string, Entry>()
  const members = new Map<string, { entry: Entry; evidence: Evidence }>()
  const matches = (context: ProductContext, binding: TrustedDomainContext) => context.surface === "procurement" && context.installationId === binding.binding.installationId && context.projectId === binding.binding.projectId && context.principalRef === binding.binding.principalRef && context.accessRevision === binding.binding.accessRevision && context.policyVersion === binding.binding.policyVersion
  const selector = async (request: Request, binding: TrustedDomainContext, snapshot: Snapshot) => {
    const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
    if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
    if (!procurementKeys({ roles }).length) return undefined
    return { kind: "procurement-selection-v1", roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), status: "all" }
  }
  const isCurrent = (snapshot: Snapshot, entry: Entry) => {
    if (entry.expiresAt <= Date.now()) return false
    const current = sfScopedSourceIdentity(snapshot, entry.scope)
    return !!current && current.incarnation === entry.value.selection.target.incarnation && current.version === entry.value.selection.target.version && current.inputDigest === entry.value.selection.target.projectionDigest
  }
  const authorize = async (request: Request, binding: TrustedDomainContext, snapshot: Snapshot, scope: SfSourceScope) => !request.signal.aborted && digestSfValue(await selector(request, binding, snapshot)) === digestSfValue(scope.selector)
  return {
    async createSelection(binding: TrustedDomainContext): Promise<PortResult<string>> {
      const request = input.host.requestFor(binding)
      if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      const context = await input.contextFor(binding)
      if (context.status !== "ok") return context
      if (!matches(context.value, binding)) return { status: "denied", reason: "Source authority mismatch" }
      const admitted = await input.host.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: await selector(request, binding, snapshot) }), { signal: request.signal })
      if (!admitted) return { status: "denied", reason: "Current authority unavailable" }
      const scope: SfSourceScope = { principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, recordType: "procurement-request-selection", recordId: "all", selector: admitted }
      const source = await input.scopedSources.readScopedSource("procurement", scope, (snapshot) => authorize(request, binding, snapshot, scope))
      if (!source) return { status: "unavailable", reason: "Collection inventory unavailable" }
      const environment = await input.host.environment(request)
      const result = await input.host.persistence.transaction<PortResult<{ selection: Evidence; requests: Evidence[]; statuses: string[] }>>("procurement", async (snapshot) => {
        if (!await authorize(request, binding, snapshot, scope) || digestSfValue(projectSfProcurementScope("procurement", snapshot, scope)) !== source.inputDigest) return { commit: false, value: { status: "stale", reason: "Selection changed" } }
        const actor: Actor = { id: binding.binding.principalRef, roles: admitted.roles, canWrite: admitted.canWrite, assigned: [], domains: [] }
        const view = domain.view(snapshot, actor, environment)
        if (text(object(view.data.formSettings).currency) !== context.value.currency) return { commit: false, value: { status: "stale", reason: "Currency context changed" } }
        const records = rows(view.data.requests)
        const make = (recordType: string, recordId: string, projectionDigest: string, fields: string[]): Evidence => {
          const ref: Evidence = { schema: "sf-evidence-v1", kind: "record", refId: crypto.randomUUID(), installationId: context.value.installationId, projectId: context.value.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "procurement", recordType, recordId, incarnation: source.incarnation, version: source.version, fields, period: context.value.period, projectionDigest } }
          return { ...ref, refDigest: digestSfEvidenceRef(ref) }
        }
        const requests = records.map((record) => make("procurement-request", text(record.number), digestProcurementSource(record, view.data.formSettings), ["status", "holder", "stageEnteredAt", "ageDays", "baseAmount", "submittedAmount", "submittedCurrency", "submittedFxRate", "originalAmount", "originalCurrency", "fxRate", "fxSource", "monetaryState", "subject", "reason", "nextStep", "sourcing"]))
        const known = ["draft", "pr_pending", "pr_rejected", "sourcing", "src_pending", "src_rejected", "po_draft", "po_pending", "po_rejected", "po_approved", "po_issued", "cancelled"]
        return { commit: false, value: { status: "ok", value: { selection: make("procurement-request-selection", "all", source.inputDigest, ["status"]), requests, statuses: records.map((record) => known.includes(text(record.status)) ? text(record.status) : "unknown") } } }
      }, { signal: request.signal })
      if (!await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      if (result.status !== "ok") return result
      for (const [key, entry] of entries) if (entry.expiresAt <= Date.now()) entries.delete(key)
      for (const [key, member] of members) if (member.entry.expiresAt <= Date.now()) members.delete(key)
      if (entries.size + members.size + result.value.requests.length + new Set(result.value.statuses).size + 1 > 5000) return { status: "unavailable", reason: "Selection registry full" }
      const expiresAt = Date.now() + 5 * 60_000
      const statusSelections = Object.fromEntries([...new Set(result.value.statuses)].map((status) => {
        const ref = { ...result.value.selection, refId: crypto.randomUUID(), refDigest: "" }
        return [status, { ...ref, refDigest: digestSfEvidenceRef(ref) }]
      }))
      const entry: Entry = { scope, expiresAt, value: { context: context.value, selection: result.value.selection, requests: result.value.requests, statusSelections } }
      entries.set(entry.value.selection.refId, entry)
      for (const [status, selection] of Object.entries(statusSelections)) entries.set(selection.refId, { scope, expiresAt, value: { context: context.value, selection, requests: result.value.requests.filter((_, index) => result.value.statuses[index] === status), statusSelections: { [status]: selection } } })
      for (const evidence of result.value.requests) members.set(evidence.refId, { entry, evidence })
      return { status: "ok", value: entry.value.selection.refId }
    },
    async resolveRequestCollection(ref: string, binding: TrustedDomainContext): Promise<PortResult<Selection>> {
      const entry = entries.get(ref)
      if (!entry || entry.expiresAt <= Date.now()) return { status: "unavailable", reason: "Selection unavailable" }
      const request = input.host.requestFor(binding)
      if (!request || !matches(entry.value.context, binding) || !await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      const context = await input.contextFor(binding)
      if (context.status !== "ok") return context
      if (digestSfValue(context.value) !== digestSfValue(entry.value.context)) return { status: "stale", reason: "Context changed" }
      const current = await input.scopedSources.resolveScopedSource("procurement", entry.value.selection.target.incarnation, (snapshot, scope) => authorize(request, binding, snapshot, scope))
      if (!current || current.version !== entry.value.selection.target.version || current.inputDigest !== entry.value.selection.target.projectionDigest || digestSfValue(current.scope) !== digestSfValue(entry.scope)) return { status: "stale", reason: "Selection changed" }
      if (!await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      return { status: "ok", value: structuredClone(entry.value) }
    },
    async resolveRequestSource(ref: string, binding: TrustedDomainContext): Promise<PortResult<{ evidence: Evidence; context: ProductContext }>> {
      const member = members.get(ref)
      if (!member) return { status: "unavailable", reason: "Request unavailable" }
      const selection = await this.resolveRequestCollection(member.entry.value.selection.refId, binding)
      if (selection.status !== "ok") return selection
      return { status: "ok", value: { evidence: structuredClone(member.evidence), context: selection.value.context } }
    },
    isCurrentRequestCollection(snapshot: Snapshot, selection: Evidence, requests: readonly Evidence[], statusSelections: Readonly<Record<string, Evidence>>) {
      const entry = entries.get(selection.refId)
      return !!entry && isCurrent(snapshot, entry) && digestSfValue(entry.value.selection) === digestSfValue(selection) && digestSfValue(entry.value.requests) === digestSfValue(requests) && digestSfValue(entry.value.statusSelections) === digestSfValue(statusSelections)
    },
    isCurrentRequestSource(snapshot: Snapshot, evidence: Evidence) {
      const member = members.get(evidence.refId)
      return !!member && isCurrent(snapshot, member.entry) && digestSfValue(member.evidence) === digestSfValue(evidence)
    },
  }
}

export function digestProcurementSource(value: unknown, settings: unknown, kind?: "request" | "supplier") {
  const record = object(value)
  const setting = object(settings)
  const basis = { ...select(setting, ["currency", "techWeight", "commWeight", "minQuotes"]), fxRates: rows(setting.fxRates).map((rate) => select(rate, ["code", "rate"])), criteria: scoreCriteria(setting.criteria), commCriteria: scoreCriteria(setting.commCriteria) }
  if (kind === "supplier" || (kind !== "request" && !Object.hasOwn(record, "createdBy"))) return digestSfValue({ record: select(record, ["id", "number", "legalName", "status", "categories", "taxId"]) })
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
