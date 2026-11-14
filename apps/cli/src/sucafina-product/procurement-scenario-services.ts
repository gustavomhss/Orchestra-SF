import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/business-context.ts"
import type { DomainProjection } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { CostCoverageBasis, DecisionCase, ScenarioResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/decisions.ts"
import type { ScenarioRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import type { DomainPortHost, PlannerSourceHost, PortResult, ProcurementPort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductStatePort } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import { isSfPeriod } from "../../../../modules/sucafina/Sucafinav1/product/contracts/validation.ts"
import { parseCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { plannerScenarioDigest } from "../../../../modules/sucafina/Sucafinav1/product/planner/preview-comparison.ts"
import { createProcurementScenarioProducer } from "../../../../modules/sucafina/Sucafinav1/product/procurement/scenario-producer.ts"
import type { ProcurementScenarioPreview } from "../../../../modules/sucafina/Sucafinav1/product/procurement/scenario-producer.ts"
import type { createProcurementSourceResolver } from "../../../../modules/sucafina/Sucafinav1/product/procurement/sources.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type RecordEvidence = Extract<BusinessEvidenceRef, { kind: "record" }>
type PublicAuthority = Pick<TrustedDomainContext["binding"], "installationId" | "projectId" | "principalRef" | "accessRevision" | "policyVersion">
type Controls = { caseRef: CaseRef; authority: PublicAuthority; sources: { sourceDigest: string; source: RecordEvidence; label: string; currency: string; period: { start: string; end: string } }[]; financialApproval: "blocked"; financialApprovalReason: string }
type SelectionPreview = ProcurementScenarioPreview & { request: ScenarioRequest; caseRef: CaseRef; authority: PublicAuthority; source: RecordEvidence; financialApproval: "blocked"; financialApprovalReason: string }
type CaseScope = <T>(call: TrustedDomainContext, selected: CaseRef, work: () => Promise<PortResult<T>>) => Promise<PortResult<T>>
type UiAuthority = {
  admit: (request: Request, operation: string, digest: string) => Promise<PortResult<TrustedUiContext>>
  validate: (call: TrustedUiContext, operation: string, digest: string) => Promise<boolean>
  finish: (call: TrustedUiContext) => void
}
export type ProcurementScenarioSelection = {
  caseRef: CaseRef
  sourceDigest: string
  costInventory: "renewal-transition-v1"
  operation: { kind: "baseline" } | { kind: "replace"; target: "PR.estAmount"; amount: number; currency: string; period: { start: string; end: string } }
}
export const PROCUREMENT_FINANCIAL_BLOCK = "This scenario is a proposal. Financial approval remains in Procurement. The selected replacement cannot be prepared for application under the current approval workflow."

/** Read-only case controls and the same standalone producer used by the scenario capability. */
export function createSfProcurementScenarioServices(input: {
  host: DomainPortHost
  state: SfProductStatePort
  sources: ReturnType<typeof createProcurementSourceResolver>
  port: ProcurementPort
  /** Trusted composition scope: exact current case membership, no projection/reissuance side effects. */
  withCase: CaseScope
}) {
  const producer = createProcurementScenarioProducer({ host: input.host, sources: input.sources })
  const currentCase = async (selected: CaseRef, call: TrustedDomainContext): Promise<PortResult<DecisionCase>> => {
    const request = input.host.requestFor(call)
    if (!request || !await input.host.revalidate(call)) return { status: "denied", reason: "procurement-scenario-authority-unavailable" }
    const read = await input.state.read(request, "cases", (state, actor) => actor.principalRef === call.binding.principalRef && actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion ? state.cases[selected.id] : undefined)
    if (read.status !== "ok" || !read.value || !read.value.participants.includes(call.binding.principalRef) || read.value.incarnation !== selected.incarnation) return { status: "denied", reason: "procurement-scenario-case-unavailable" }
    if (read.value.version !== selected.version) return { status: "stale", reason: "procurement-scenario-case-changed" }
    return { status: "ok", value: structuredClone(read.value) }
  }
  const refsFor = (decision: DecisionCase) => decision.sourceRefs.filter((ref): ref is RecordEvidence => ref.kind === "record" && ref.refId.startsWith("sf-procurement:") && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request" && ref.target.fields.includes("originalAmount"))
  const unchanged = async (selected: CaseRef, decision: DecisionCase, call: TrustedDomainContext) => {
    const again = await currentCase(selected, call)
    return again.status === "ok" && same(again.value, decision) && await input.host.revalidate(call)
  }
  const authority = (call: TrustedDomainContext) => ({ installationId: call.binding.installationId, projectId: call.binding.projectId, principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion })
  const read = (selected: CaseRef, call: TrustedDomainContext): Promise<PortResult<Controls>> => input.withCase<Controls>(call, selected, async () => {
    const found = await currentCase(selected, call)
    if (found.status !== "ok") return found
    const refs = refsFor(found.value)
    if (refs.length > 64) return { status: "needs-input" as const, reason: "procurement-scenario-source-budget-exceeded" }
    const sources: Controls["sources"] = []
    for (const ref of refs) {
      const resolved = await producer.resolveSource(ref.refId, call)
      if (resolved.status !== "ok" || !same(resolved.value.evidence, ref)) continue
      const projected = await producer.readProjection(ref.refId, call)
      if (projected.status !== "ok" || projected.value.context.currency !== found.value.currency || !same(projected.value.context.period, found.value.horizon)) continue
      sources.push({ sourceDigest: ref.refDigest, source: structuredClone(ref), label: `Requisition ${ref.target.recordId} · source revision ${ref.target.version}`, currency: projected.value.context.currency, period: projected.value.context.period })
    }
    if (!await unchanged(selected, found.value, call)) return { status: "stale" as const, reason: "procurement-scenario-case-changed" }
    for (const source of sources) {
      const again = await producer.resolveSource(source.source.refId, call)
      if (again.status !== "ok" || !same(again.value.evidence, source.source)) return { status: "stale", reason: "procurement-scenario-source-changed" }
    }
    return { status: "ok" as const, value: { caseRef: structuredClone(selected), authority: authority(call), sources, financialApproval: "blocked" as const, financialApprovalReason: PROCUREMENT_FINANCIAL_BLOCK } }
  })
  const preview = async (selection: ProcurementScenarioSelection, call: TrustedDomainContext): Promise<PortResult<SelectionPreview>> => {
    if (!validSelection(selection)) return { status: "needs-input", reason: "invalid-procurement-scenario-selection" }
    return input.withCase<SelectionPreview>(call, selection.caseRef, async () => {
    const captured = structuredClone(selection)
    const found = await currentCase(captured.caseRef, call)
    if (found.status !== "ok") return found
    const refs = refsFor(found.value).filter((ref) => ref.refDigest === captured.sourceDigest)
    if (refs.length !== 1) return { status: "denied" as const, reason: "procurement-scenario-source-outside-case" }
    const source = refs[0]!
    const operation = captured.operation
    if (operation.kind === "replace" && (operation.currency !== found.value.currency || !same(operation.period, found.value.horizon))) return { status: "needs-input" as const, reason: "procurement-scenario-scope-mismatch" }
    const request: ScenarioRequest = { baseRef: source.refId, operations: operation.kind === "baseline" ? [] : [{ kind: "replace", targetRef: source.refId, amount: operation.amount, currency: operation.currency, period: structuredClone(operation.period) }], assumptions: [{ id: "procurement-cost-inventory", value: captured.costInventory, state: "hypothetical", evidenceRefs: [] }] }
    const observed = await producer.preview(request, call)
    if (observed.status !== "ok") return observed
    const value = observed.value
    if (!value.scenario.sourceRefs.some((ref) => same(ref, source)) || value.scenario.currency !== found.value.currency || !same(value.scenario.horizon, found.value.horizon) || !same(selection, captured) || !await unchanged(captured.caseRef, found.value, call)) return { status: "stale" as const, reason: "procurement-scenario-source-or-case-changed" }
    return { status: "ok" as const, value: { ...value, request, caseRef: captured.caseRef, authority: authority(call), source, financialApproval: "blocked" as const, financialApprovalReason: PROCUREMENT_FINANCIAL_BLOCK } }
    })
  }
  const resolveSource: PlannerSourceHost["resolveForecastSource"] = async (reference, call) => {
    const found = await producer.resolveSource(reference, call)
    if (found.status !== "ok") return found
    if (found.value.evidence.target.recordType !== "procurement-request") return { status: "needs-input", reason: "procurement-request-required" }
    // This is the real Procurement record identity; no Planner version is fabricated.
    return { status: "ok", value: { versionId: found.value.evidence.target.recordId, evidence: found.value.evidence } }
  }
  const resolveStored = async (alternative: DecisionCase["alternatives"][number], basis: CostCoverageBasis, call: TrustedDomainContext): Promise<PortResult<{ projection: DomainProjection; source: RecordEvidence }>> => {
    const preview = await producer.preview(alternative.scenario, call)
    if (preview.status !== "ok") return preview
    const expected = preview.value.scenario
    const attributed: ScenarioResult = expected.comparisonStatus === "complete"
      ? { ...expected, costCoverage: { ...expected.costCoverage, alternativeId: alternative.id, alternativeVersion: alternative.version } }
      : { ...expected, costCoverage: { ...expected.costCoverage, alternativeId: alternative.id, alternativeVersion: alternative.version } }
    if (!same(preview.value.basis, basis) || plannerScenarioDigest(attributed) !== plannerScenarioDigest(alternative.result)) return { status: "stale", reason: "procurement-scenario-replay-changed" }
    const refs = expected.sourceRefs.filter((ref): ref is RecordEvidence => ref.kind === "record" && ref.refId === alternative.scenario.baseRef && ref.target.surface === "procurement" && ref.target.recordType === "procurement-request")
    if (refs.length !== 1) return { status: "unavailable", reason: "procurement-scenario-source-unavailable" }
    const projected = await producer.readProjection(refs[0]!.refId, call)
    if (projected.status !== "ok") return projected
    const checked = await producer.preview(alternative.scenario, call)
    if (checked.status !== "ok" || plannerScenarioDigest(checked.value.scenario) !== plannerScenarioDigest(expected) || !same(checked.value.basis, basis) || !await input.host.revalidate(call)) return { status: "stale", reason: "procurement-scenario-replay-changed" }
    return { status: "ok", value: { projection: projected.value, source: refs[0]! } }
  }
  return { producer, read, preview, resolveSource, resolveStored }
}

/** Only read/preview routes live here. Promotion keeps the existing human C08 mutation. */
export function createSfProcurementScenarioHttp(input: { origin: string; mount: string; host: DomainPortHost; ui: UiAuthority; services: ReturnType<typeof createSfProcurementScenarioServices> }) {
  return async (request: Request, surface: string): Promise<Response | undefined> => {
    const url = new URL(request.url), mode = url.searchParams.get("sf")
    if (mode !== "procurement-scenario-controls" && mode !== "procurement-scenario-preview") return undefined
    if (!["dashboard", "planner", "procurement"].includes(surface) || url.origin !== input.origin || url.pathname !== `${input.mount}/${surface}` || request.signal.aborted || request.headers.get("sec-fetch-site") === "cross-site" || request.headers.has("origin") && request.headers.get("origin") !== input.origin) return reply({ status: "denied", reason: "procurement-scenario-origin-unavailable" })
    const preview = mode === "procurement-scenario-preview"
    if (request.method !== (preview ? "POST" : "GET")) return reply({ status: "needs-input", reason: "method-not-allowed" }, 405)
    if (url.searchParams.getAll("sf").length !== 1 || [...url.searchParams.keys()].some((key) => !(preview ? ["sf"] : ["sf", "case", "version"]).includes(key))) return reply({ status: "needs-input", reason: "invalid-procurement-scenario-request" })
    let payload: ProcurementScenarioSelection | CaseRef
    if (preview) {
      if (request.headers.get("origin") !== input.origin || !request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) return reply({ status: "denied", reason: "procurement-scenario-origin-unavailable" })
      const value = await boundedJson(request)
      if (!validSelection(value)) return reply({ status: "needs-input", reason: "invalid-procurement-scenario-selection" })
      payload = value
    } else {
      const ref = parseCaseRef(url.searchParams.get("case") ?? ""), version = Number(url.searchParams.get("version"))
      if (!ref || !Number.isSafeInteger(version) || version < 1 || url.searchParams.getAll("case").length !== 1 || url.searchParams.getAll("version").length !== 1) return reply({ status: "needs-input", reason: "invalid-procurement-scenario-case" })
      payload = { ...ref, version }
    }
    const operation = preview ? "sf_scenario_simulate" : "sf_case_read", digest = digestSfValue(payload)
    const admitted = await input.ui.admit(request, operation, digest)
    if (admitted.status !== "ok") return reply(admitted)
    try {
      if (!await input.ui.validate(admitted.value, operation, digest)) return reply({ status: "denied", reason: "procurement-scenario-authority-unavailable" })
      const result = preview ? await input.services.preview(payload as ProcurementScenarioSelection, admitted.value) : await input.services.read(payload as CaseRef, admitted.value)
      if (!await input.host.revalidate(admitted.value) || input.host.requestFor(admitted.value) !== request || request.signal.aborted) return reply({ status: "denied", reason: "procurement-scenario-authority-changed" })
      return reply(result)
    } catch { return reply({ status: "unavailable", reason: "procurement-scenario-unavailable" }) }
    finally { input.ui.finish(admitted.value) }
  }
}

function validSelection(value: unknown): value is ProcurementScenarioSelection {
  if (!record(value) || !closed(value, ["caseRef", "sourceDigest", "costInventory", "operation"]) || value.costInventory !== "renewal-transition-v1" || !record(value.caseRef) || !closed(value.caseRef, ["id", "incarnation", "version"]) || typeof value.caseRef.id !== "string" || !value.caseRef.id.trim() || typeof value.caseRef.incarnation !== "string" || !value.caseRef.incarnation.trim() || typeof value.caseRef.version !== "number" || !Number.isSafeInteger(value.caseRef.version) || value.caseRef.version < 1 || typeof value.sourceDigest !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceDigest) || !record(value.operation)) return false
  const operation = value.operation
  return operation.kind === "baseline" ? closed(operation, ["kind"]) : operation.kind === "replace" && closed(operation, ["kind", "target", "amount", "currency", "period"]) && operation.target === "PR.estAmount" && typeof operation.amount === "number" && Number.isFinite(operation.amount) && operation.amount >= 0 && typeof operation.currency === "string" && /^[A-Z]{3}$/.test(operation.currency) && record(operation.period) && closed(operation.period, ["start", "end"]) && isSfPeriod(operation.period as { start: string; end: string })
}
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value) }
function closed(value: Record<string, unknown>, keys: readonly string[]) { return Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key)) }
function same(left: unknown, right: unknown) { return digestSfValue(left) === digestSfValue(right) }
async function boundedJson(request: Request): Promise<unknown> {
  if (!request.body) return undefined
  const reader = request.body.getReader(), chunks: Uint8Array[] = []
  let size = 0
  try {
    for (;;) {
      const next = await reader.read()
      if (next.done) break
      size += next.value.byteLength
      if (size > 16384) { await reader.cancel(); return undefined }
      chunks.push(next.value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
  } catch { return undefined }
  finally { reader.releaseLock() }
}
function reply(value: PortResult<unknown>, status?: number) {
  return Response.json(value, { status: status ?? (value.status === "ok" ? 200 : value.status === "denied" ? 403 : value.status === "needs-input" ? 400 : value.status === "stale" || value.status === "conflict" ? 409 : 503), headers: { "Cache-Control": "no-store" } })
}
