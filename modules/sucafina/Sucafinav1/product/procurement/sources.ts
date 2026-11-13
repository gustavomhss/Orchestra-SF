import { roleMap } from "../../runtime/admin.ts"
import { object, rows, text } from "../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { domain } from "../../runtime/procurement.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { BusinessEvidenceRef } from "../contracts/business-context.ts"
import type { ProductContext } from "../contracts/context.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { sfScopedSourceIdentity } from "../integration/source-lifecycle.ts"
import type { SfScopedSourcePort, SfSourceScope } from "../integration/source-lifecycle.ts"
import { projectProcurementScope, procurementRequestFields, procurementSupplierFields } from "./source-projection.ts"
import { procurementKeys } from "../../src/nav.ts"

/** Individual selectors identify persisted scopes; they never confer authority. */
export function createProcurementSourceResolver(input: { host: DomainPortHost; scopedSources: SfScopedSourcePort; contextFor: (binding: TrustedDomainContext) => Promise<PortResult<ProductContext>> }) {
  type Evidence = Extract<BusinessEvidenceRef, { kind: "record" }>
  const matches = (context: ProductContext, binding: TrustedDomainContext) => isSfPeriod(context.period) && /^[A-Z]{3}$/.test(context.currency) && context.surface === "procurement" && context.installationId === binding.binding.installationId && context.projectId === binding.binding.projectId && context.principalRef === binding.binding.principalRef && context.accessRevision === binding.binding.accessRevision && context.policyVersion === binding.binding.policyVersion
  const authenticate = async (request: Request, binding: TrustedDomainContext, snapshot: Snapshot, fields: readonly string[], period: ProductContext["period"], currency: string) => {
    const principal = await input.host.authenticate(request, { surface: "procurement", roleMap: roleMap(snapshot, "procurement") })
    if (!principal || principal.id !== binding.binding.principalRef || principal.id.startsWith("local:")) return undefined
    const roles = principal.roles.filter((entry) => entry.surface === "procurement").map((entry) => entry.role)
    if (!procurementKeys({ roles }).length) return undefined
    return { kind: "procurement-record-v1", roles, canWrite: principal.canWrite && roles.some((role) => role !== "viewer"), roleMapDigest: digestSfValue(roleMap(snapshot, "procurement")), fields, period, currency }
  }
  const authorize = async (request: Request, binding: TrustedDomainContext, snapshot: Snapshot, scope: SfSourceScope, context: ProductContext) => {
    const selected = object(scope.selector)
    if (scope.principalRef !== binding.binding.principalRef || scope.accessRevision !== binding.binding.accessRevision || scope.policyVersion !== binding.binding.policyVersion || !["procurement-request", "procurement-supplier"].includes(scope.recordType) || !Array.isArray(selected.fields) || selected.fields.some((field) => typeof field !== "string") || digestSfValue(selected.period) !== digestSfValue(context.period) || selected.currency !== context.currency || request.signal.aborted) return false
    return digestSfValue(await authenticate(request, binding, snapshot, selected.fields, context.period, context.currency)) === digestSfValue(scope.selector)
  }
  const resolveCurrent = async (ref: string, binding: TrustedDomainContext): Promise<PortResult<{ evidence: Evidence; context: ProductContext; scope: SfSourceScope }>> => {
    const parts = /^sf-procurement:([^:]+):([1-9]\d*)$/.exec(ref)
    const incarnation = parts && decode(parts[1]!)
    if (!incarnation || !parts || !Number.isSafeInteger(Number(parts[2]))) return { status: "unavailable", reason: "Source unavailable" }
    const request = input.host.requestFor(binding)
    if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
    const context = await input.contextFor(binding)
    if (context.status !== "ok") return context
    if (!matches(context.value, binding)) return { status: "denied", reason: "Source authority mismatch" }
    const current = await input.scopedSources.resolveScopedSource("procurement", incarnation, (snapshot, scope) => authorize(request, binding, snapshot, scope, context.value))
    if (!current || current.version !== Number(parts[2])) {
      if (!await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      return current ? { status: "stale", reason: "Source changed" } : { status: "unavailable", reason: "Source unavailable" }
    }
    const projection = object(current.projection)
    const selected = object(current.scope.selector)
    if (projection.id !== current.scope.recordId || typeof projection.privateDependencyDigest !== "string" || !/^[a-f0-9]{64}$/.test(projection.privateDependencyDigest) || !Array.isArray(selected.fields) || selected.fields.some((field) => typeof field !== "string")) return { status: "unavailable", reason: "Source unavailable" }
    const environment = await input.host.environment(request)
    const fresh = await input.host.persistence.transaction("procurement", async (snapshot) => {
      if (!await authorize(request, binding, snapshot, current.scope, context.value)) return { commit: false, value: false }
      const actor: Actor = { id: binding.binding.principalRef, roles: Array.isArray(selected.roles) ? selected.roles.filter((role): role is string => typeof role === "string") : [], canWrite: selected.canWrite === true, assigned: [], domains: [] }
      const view = domain.view(snapshot, actor, environment)
      const identity = sfScopedSourceIdentity(snapshot, current.scope)
      return { commit: false, value: text(object(view.data.formSettings).currency) === context.value.currency && digestSfValue(projectProcurementScope("procurement", snapshot, current.scope)) === current.inputDigest && identity?.incarnation === current.incarnation && identity.version === current.version }
    }, { signal: request.signal })
    if (!fresh) return { status: "stale", reason: "Source changed" }
    const again = await input.scopedSources.resolveScopedSource("procurement", incarnation, (snapshot, scope) => authorize(request, binding, snapshot, scope, context.value))
    const currentContext = await input.contextFor(binding)
    if (!again || digestSfValue(again) !== digestSfValue(current) || currentContext.status !== "ok" || digestSfValue(currentContext.value) !== digestSfValue(context.value) || !await input.host.revalidate(binding)) return { status: "stale", reason: "Source changed" }
    const evidence: Evidence = { schema: "sf-evidence-v1", kind: "record", refId: ref, installationId: context.value.installationId, projectId: context.value.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "procurement", recordType: current.scope.recordType, recordId: current.scope.recordId, incarnation: current.incarnation, version: current.version, fields: selected.fields, period: context.value.period, projectionDigest: projection.privateDependencyDigest } }
    return { status: "ok", value: { evidence: { ...evidence, refDigest: digestSfEvidenceRef(evidence) }, context: context.value, scope: current.scope } }
  }
  async function issue(kind: "procurement-request" | "procurement-supplier", id: string, binding: TrustedDomainContext): Promise<PortResult<string>> {
    if (!id.trim() || !["procurement-request", "procurement-supplier"].includes(kind)) return { status: "needs-input", reason: "Invalid source selection" }
    const request = input.host.requestFor(binding)
    if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
    const context = await input.contextFor(binding)
    if (context.status !== "ok") return context
    if (!matches(context.value, binding)) return { status: "denied", reason: "Source authority mismatch" }
    const fields = kind === "procurement-request" ? [...procurementRequestFields] : [...procurementSupplierFields]
    const selector = await input.host.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: await authenticate(request, binding, snapshot, fields, context.value.period, context.value.currency) }), { signal: request.signal })
    if (!selector) return { status: "denied", reason: "Current authority unavailable" }
    const scope: SfSourceScope = { principalRef: binding.binding.principalRef, accessRevision: binding.binding.accessRevision, policyVersion: binding.binding.policyVersion, recordType: kind, recordId: id, selector }
    const source = await input.scopedSources.readScopedSource("procurement", scope, (snapshot) => authorize(request, binding, snapshot, scope, context.value))
    if (!source || !await input.host.revalidate(binding)) return { status: "unavailable", reason: "Source unavailable" }
    const ref = `sf-procurement:${encodeURIComponent(source.incarnation)}:${source.version}`
    const resolved = await resolveCurrent(ref, binding)
    if (resolved.status !== "ok") return resolved
    if (digestSfValue(resolved.value.scope) !== digestSfValue(scope)) return { status: "stale", reason: "Source changed" }
    return { status: "ok", value: ref }
  }
  return {
    issue,
    async resolve(ref: string, binding: TrustedDomainContext): Promise<PortResult<{ evidence: Evidence; context: ProductContext }>> {
      const resolved = await resolveCurrent(ref, binding)
      return resolved.status === "ok" ? { status: "ok", value: { evidence: resolved.value.evidence, context: resolved.value.context } } : resolved
    },
    resolveForPreparation: resolveCurrent,
    /** Reissue under the current actor, using the prior scope only to identify the same physical record. */
    async issueForActor(target: Evidence["target"], binding: TrustedDomainContext, options?: { requireCurrent?: boolean }): Promise<PortResult<Evidence>> {
      if (!target || target.surface !== "procurement" || !["procurement-request", "procurement-supplier"].includes(target.recordType) || !target.recordId || !target.incarnation || !Number.isSafeInteger(target.version) || target.version < 1 || !target.period || !Array.isArray(target.fields)) return { status: "unavailable", reason: "Source unavailable" }
      const kind = target.recordType === "procurement-request" ? "procurement-request" : "procurement-supplier"
      const issued = await issue(kind, target.recordId, binding)
      if (issued.status !== "ok") return issued
      const current = await resolveCurrent(issued.value, binding)
      if (current.status !== "ok") return current
      if (digestSfValue(current.value.evidence.target.fields) !== digestSfValue(target.fields) || digestSfValue(current.value.evidence.target.period) !== digestSfValue(target.period)) return { status: "unavailable", reason: "Source scope unavailable" }
      const request = input.host.requestFor(binding)
      if (!request || !await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
      const same = await input.host.persistence.transaction("procurement", async (snapshot) => {
        if (!await authorize(request, binding, snapshot, current.value.scope, current.value.context)) return { commit: false, value: "unavailable" as const }
        const records = Object.values(snapshot.sfSources?.scopes ?? {})
        const prior = records.filter((entry) => entry.incarnation === target.incarnation && entry.scope.recordType === kind && entry.scope.recordId === target.recordId && entry.version >= target.version && digestSfValue(object(entry.scope.selector).fields) === digestSfValue(target.fields) && digestSfValue(object(entry.scope.selector).period) === digestSfValue(target.period))
        const selected = records.filter((entry) => entry.alive && entry.incarnation === current.value.evidence.target.incarnation && digestSfValue(entry.scope) === digestSfValue(current.value.scope))
        const identity = sfScopedSourceIdentity(snapshot, current.value.scope)
        if (prior.length !== 1 || selected.length !== 1 || prior[0]!.sourceIncarnation !== selected[0]!.sourceIncarnation || identity?.incarnation !== current.value.evidence.target.incarnation || identity.version !== current.value.evidence.target.version || identity.inputDigest !== digestSfValue(projectProcurementScope("procurement", snapshot, current.value.scope))) return { commit: false, value: "unavailable" as const }
        if (options?.requireCurrent && !prior[0]!.alive) return { commit: false, value: "unavailable" as const }
        if (options?.requireCurrent && prior[0]!.version !== target.version) return { commit: false, value: "stale" as const }
        return { commit: false, value: "current" as const }
      }, { signal: request.signal })
      if (same !== "current") {
        if (!await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
        return { status: same, reason: same === "stale" ? "Source changed" : "Source unavailable" }
      }
      const again = await resolveCurrent(issued.value, binding)
      if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(current.value) || !await input.host.revalidate(binding)) return { status: "stale", reason: "Source changed" }
      return { status: "ok", value: current.value.evidence }
    },
    async prepareReissueScope(original: Evidence, current: Evidence, binding: TrustedDomainContext): Promise<PortResult<{ fence: () => Promise<boolean> }>> {
      if (!original || !current || original.kind !== "record" || current.kind !== "record" || original.refDigest !== digestSfEvidenceRef(original) || current.refDigest !== digestSfEvidenceRef(current) || original.installationId !== binding.binding.installationId || current.installationId !== binding.binding.installationId || original.projectId !== binding.binding.projectId || current.projectId !== binding.binding.projectId || original.target.surface !== "procurement" || current.target.surface !== "procurement" || original.target.recordType !== current.target.recordType || original.target.recordId !== current.target.recordId || digestSfValue(original.target.fields) !== digestSfValue(current.target.fields) || digestSfValue(original.target.period) !== digestSfValue(current.target.period)) return { status: "unavailable", reason: "material-scope-unavailable" }
      const selected = await resolveCurrent(current.refId, binding)
      const request = input.host.requestFor(binding)
      if (selected.status !== "ok" || !request || digestSfValue(selected.value.evidence) !== digestSfValue(current)) return { status: "unavailable", reason: "material-scope-unavailable" }
      const check = async (snapshot: Snapshot) => {
        if (request.signal.aborted || !await input.host.revalidate(binding) || !await authorize(request, binding, snapshot, selected.value.scope, selected.value.context)) return false
        const entries = Object.values(snapshot.sfSources?.scopes ?? {})
        const prior = entries.filter((entry) => entry.alive && entry.incarnation === original.target.incarnation && entry.version === original.target.version && entry.scope.recordType === original.target.recordType && entry.scope.recordId === original.target.recordId)
        const present = entries.filter((entry) => entry.alive && entry.incarnation === current.target.incarnation && entry.version === current.target.version && digestSfValue(entry.scope) === digestSfValue(selected.value.scope))
        if (prior.length !== 1 || present.length !== 1 || prior[0]!.sourceIncarnation !== present[0]!.sourceIncarnation) return false
        const materialCurrent = [original, current].every((evidence, index) => {
          const entry = index === 0 ? prior[0]! : present[0]!
          const identity = sfScopedSourceIdentity(snapshot, entry.scope)
          const projection = projectProcurementScope("procurement", snapshot, entry.scope)
          return identity?.incarnation === evidence.target.incarnation && identity.version === evidence.target.version && identity.inputDigest === digestSfValue(projection) && object(projection).privateDependencyDigest === evidence.target.projectionDigest && digestSfValue(object(entry.scope.selector).fields) === digestSfValue(evidence.target.fields) && digestSfValue(object(entry.scope.selector).period) === digestSfValue(evidence.target.period)
        })
        return materialCurrent && await input.host.revalidate(binding)
      }
      const prepared = await input.host.persistence.transaction("procurement", async (snapshot) => ({ commit: false, value: await check(snapshot) }), { signal: request.signal })
      if (!prepared) return { status: "unavailable", reason: "material-scope-unavailable" }
      return { status: "ok", value: { fence: async () => {
        const snapshot = input.host.persistence.currentSnapshots?.()?.procurement
        return !!snapshot && await check(snapshot)
      } } }
    },
    isCurrent(snapshot: Snapshot, evidence: Evidence) {
      const matches = Object.values(snapshot.sfSources?.scopes ?? {}).filter((entry) => entry.alive && entry.incarnation === evidence.target.incarnation && entry.version === evidence.target.version && entry.scope.recordType === evidence.target.recordType && entry.scope.recordId === evidence.target.recordId)
      if (matches.length !== 1 || evidence.refId !== `sf-procurement:${encodeURIComponent(evidence.target.incarnation)}:${evidence.target.version}`) return false
      const scope = matches[0]!.scope
      const identity = sfScopedSourceIdentity(snapshot, scope)
      const projection = projectProcurementScope("procurement", snapshot, scope)
      return !!identity && identity.incarnation === evidence.target.incarnation && identity.version === evidence.target.version && identity.inputDigest === digestSfValue(projection) && object(projection).privateDependencyDigest === evidence.target.projectionDigest && digestSfValue(object(scope.selector).fields) === digestSfValue(evidence.target.fields) && digestSfValue(object(scope.selector).period) === digestSfValue(evidence.target.period)
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
  const matches = (context: ProductContext, binding: TrustedDomainContext) => isSfPeriod(context.period) && /^[A-Z]{3}$/.test(context.currency) && context.surface === "procurement" && context.installationId === binding.binding.installationId && context.projectId === binding.binding.projectId && context.principalRef === binding.binding.principalRef && context.accessRevision === binding.binding.accessRevision && context.policyVersion === binding.binding.policyVersion
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
        if (!await authorize(request, binding, snapshot, scope) || digestSfValue(projectProcurementScope("procurement", snapshot, scope)) !== source.inputDigest) return { commit: false, value: { status: "stale", reason: "Selection changed" } }
        const actor: Actor = { id: binding.binding.principalRef, roles: admitted.roles, canWrite: admitted.canWrite, assigned: [], domains: [] }
        const view = domain.view(snapshot, actor, environment)
        if (text(object(view.data.formSettings).currency) !== context.value.currency) return { commit: false, value: { status: "stale", reason: "Currency context changed" } }
        const records = rows(view.data.requests)
        const make = (recordType: string, recordId: string, projectionDigest: string, fields: string[]): Evidence => {
          const ref: Evidence = { schema: "sf-evidence-v1", kind: "record", refId: crypto.randomUUID(), installationId: context.value.installationId, projectId: context.value.projectId, refDigest: "", evidenceLevel: "observed", target: { surface: "procurement", recordType, recordId, incarnation: source.incarnation, version: source.version, fields, period: context.value.period, projectionDigest } }
          return { ...ref, refDigest: digestSfEvidenceRef(ref) }
        }
        const requests = records.map((record) => make("procurement-request", text(record.number), digestProcurementSource(record, view.data.formSettings), [...procurementRequestFields]))
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
      if (!current || current.version !== entry.value.selection.target.version || current.inputDigest !== entry.value.selection.target.projectionDigest || digestSfValue(current.scope) !== digestSfValue(entry.scope)) {
        if (!await input.host.revalidate(binding)) return { status: "denied", reason: "Current authority unavailable" }
        return current ? { status: "stale", reason: "Selection changed" } : { status: "unavailable", reason: "Selection unavailable" }
      }
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

function decode(value: string) {
  try {
    const decoded = decodeURIComponent(value)
    return decoded && encodeURIComponent(decoded) === value ? decoded : undefined
  } catch {
    return undefined
  }
}
