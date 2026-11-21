import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { SfProductState, SfStateAuthority } from "../../../../modules/sucafina/Sucafinav1/product/contracts/state.ts"
import type { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfPortfolioServices } from "./portfolio-services.ts"
import type { createSfBiArtifacts } from "./bi-artifacts.ts"

type CaseRef = { id: string; incarnation: string; version: number }
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }
export type SfBiChoice = { caseRef: CaseRef; projectionRef: string; tableRef: string; mutation: Mutation }
export type SfSensitivityChoice = { caseRef: CaseRef; resultRef: string; mutation: Mutation }
type Choice = { schema: "sf-analysis-selection-v1"; kind: "bi" | "sensitivity"; caseRef: CaseRef; references: readonly string[]; materialDigest: string;
  principalRef: string; accessRevision: string; policyVersion: string; installationId: string; projectId: string; recordDigest: string }

/** A separately authorized human selection, durable across restart and never inferred from recency. */
export function createSfAnalysisChoiceServices(input: {
  authority: ReturnType<typeof createSfProductAuthority>
  business: ReturnType<typeof createSfBusinessServices>
  portfolio: ReturnType<typeof createSfPortfolioServices>
  biArtifacts: ReturnType<typeof createSfBiArtifacts>["store"]
  analysisSelectionWrites: WeakSet<object>
}) {
  const { authority, business } = input
  const host = authority.host
  const sameActor = (actor: SfStateAuthority, call: TrustedDomainContext) => actor.principalRef === call.binding.principalRef &&
    actor.accessRevision === call.binding.accessRevision && actor.policyVersion === call.binding.policyVersion
  const key = (kind: Choice["kind"], caseRef: CaseRef, call: TrustedDomainContext) => `sf:analysis-selection:${digestSfValue({ kind, principalRef: call.binding.principalRef,
    installationId: call.binding.installationId, projectId: call.binding.projectId, id: caseRef.id, incarnation: caseRef.incarnation })}`
  const caseState = async (caseRef: CaseRef, call: TrustedDomainContext) => {
    const request = host.requestFor(call)
    if (!request || call.kind === "native" && (call.binding.caseId !== caseRef.id || call.binding.caseIncarnation !== caseRef.incarnation || call.binding.caseVersion !== caseRef.version) || !await host.revalidate(call)) return undefined
    const current = await authority.state.read(request, "cases", (state, actor) => {
      const value = state.cases[caseRef.id]
      return sameActor(actor, call) && value?.incarnation === caseRef.incarnation && value.version === caseRef.version &&
        value.participants.includes(actor.principalRef) ? value : undefined
    })
    return current.status === "ok" && current.value && await host.revalidate(call) ? current : undefined
  }
  const load = async (kind: Choice["kind"], caseRef: CaseRef, call: TrustedDomainContext): Promise<PortResult<Choice>> => {
    const request = host.requestFor(call)
    const current = await caseState(caseRef, call)
    if (!request || !current) return { status: "denied", reason: "analysis-selection-case-unavailable" }
    const found = await authority.state.read(request, "preferences", (state, actor) => sameActor(actor, call) ? state.preferences[key(kind, caseRef, call)] : undefined)
    if (found.status !== "ok" || !isChoice(found.value)) return { status: "needs-input", reason: "analysis-selection-not-created" }
    const value = found.value
    if (value.kind !== kind || digestSfValue(value.caseRef) !== digestSfValue(caseRef) || value.recordDigest !== choiceDigest(value) ||
      value.principalRef !== call.binding.principalRef || value.accessRevision !== call.binding.accessRevision || value.policyVersion !== call.binding.policyVersion ||
      value.installationId !== call.binding.installationId || value.projectId !== call.binding.projectId || !await host.revalidate(call)) return { status: "denied", reason: "analysis-selection-scope-changed" }
    return { status: "ok", value }
  }
  const write = async (kind: Choice["kind"], request: SfBiChoice | SfSensitivityChoice, references: readonly string[], materialDigest: string, call: TrustedDomainContext) => {
    const action = kind === "bi" ? "bi.selection.set" : "decisions.sensitivity.select"
    const source = host.requestFor(call)
    if (call.kind !== "ui" || !source || !business.operationIdentity(call) || !Number.isSafeInteger(request.mutation.expectedStorageVersion) || request.mutation.expectedStorageVersion < 0 ||
      !request.mutation.idempotencyKey.trim() || !await authority.human.authorize(call, action, request)) return { status: "denied", reason: "human-analysis-selection-required" } as const
    const current = await caseState(request.caseRef, call)
    const before = await business.readSourceFences(call)
    if (!current || !before) return { status: "unavailable", reason: "analysis-selection-source-unavailable" } as const
    const record: Choice = { schema: "sf-analysis-selection-v1", kind, caseRef: structuredClone(request.caseRef), references: [...references], materialDigest,
      principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion,
      installationId: call.binding.installationId, projectId: call.binding.projectId, recordDigest: "" }
    record.recordDigest = choiceDigest(record)
    const work = async (state: SfProductState, actor: SfStateAuthority) => {
      const fences = business.lockedSourceFences()
      if (!fences || digestSfValue(fences) !== digestSfValue(before) || !sameActor(actor, call) || digestSfValue(state.cases[request.caseRef.id]) !== digestSfValue(current.value) ||
        !await authority.human.authorize(call, action, request)) return { commit: false, value: undefined }
      state.preferences[key(kind, request.caseRef, call)] = record
      return { commit: true, value: { selected: true as const } }
    }
    input.analysisSelectionWrites.add(work)
    const stored = await authority.state.transaction(source, { namespace: "preferences", sourceFence: "all", checkNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }],
      ...request.mutation, targetRef: request.caseRef.id, targetIncarnation: request.caseRef.incarnation, commandDigest: digestSfValue({ kind, request, materialDigest }) }, work)
      .finally(() => input.analysisSelectionWrites.delete(work))
    return stored.status === "ok" && stored.value ? { status: "ok" as const, value: stored.value }
      : { status: stored.status === "conflict" ? "conflict" as const : "unavailable" as const, reason: "analysis-selection-not-persisted" }
  }
  const readBi = async (caseRef: CaseRef, call: TrustedDomainContext) => {
    const selected = await load("bi", caseRef, call)
    if (selected.status !== "ok") return selected
    if (selected.value.references.length !== 2) return { status: "unavailable", reason: "bi-selection-invalid" } as const
    const artifact = await input.biArtifacts.read(selected.value.references[0]!, call)
    if (artifact.status !== "ok") return artifact
    if (artifact.value.projectionRef !== selected.value.references[0] || artifact.value.tableRef !== selected.value.references[1] ||
      digestSfValue(artifact.value.caseRef) !== digestSfValue(caseRef) || digestSfValue(artifact.value) !== selected.value.materialDigest) return { status: "stale", reason: "bi-selection-artifact-changed" } as const
    const again = await load("bi", caseRef, call)
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(selected.value)) return { status: "stale", reason: "bi-selection-changed" } as const
    return { status: "ok", value: { selection: artifact.value.selection, projectionRef: artifact.value.projectionRef, tableRef: artifact.value.tableRef } } as const
  }
  const readSensitivity = async (caseRef: CaseRef, call: TrustedDomainContext) => {
    const selected = await load("sensitivity", caseRef, call)
    if (selected.status !== "ok") return selected
    if (selected.value.references.length !== 1) return { status: "unavailable", reason: "sensitivity-selection-invalid" } as const
    const resultRef = selected.value.references[0]!
    const binding = await input.portfolio.sensitivityBindings.read({ caseRef, resultRef }, call)
    const result = await business.results.read({ kind: "sensitivity", resultRef }, call)
    if (binding.status !== "ok") return binding
    if (result.status !== "ok") return result
    if (result.value.kind !== "sensitivity" || digestSfValue({ binding: binding.value, result: result.value }) !== selected.value.materialDigest)
      return { status: "stale", reason: "sensitivity-selection-result-changed" } as const
    const again = await load("sensitivity", caseRef, call)
    return again.status === "ok" && digestSfValue(again.value) === digestSfValue(selected.value) && await host.revalidate(call)
      ? { status: "ok" as const, value: { binding: binding.value, result: result.value } } : { status: "stale" as const, reason: "sensitivity-selection-changed" }
  }
  return { readBi, readSensitivity,
    selectBi: async (request: SfBiChoice, call: TrustedDomainContext) => {
      if (!await authority.human.authorize(call, "bi.selection.set", request)) return { status: "denied", reason: "human-bi-selection-required" } as const
      const artifact = await input.biArtifacts.read(request.projectionRef, call)
      if (artifact.status !== "ok") return artifact
      if (artifact.value.tableRef !== request.tableRef || digestSfValue(artifact.value.caseRef) !== digestSfValue(request.caseRef)) return { status: "denied", reason: "bi-selection-scope-mismatch" } as const
      const stored = await write("bi", request, [request.projectionRef, request.tableRef], digestSfValue(artifact.value), call)
      return stored.status === "ok" ? readBi(request.caseRef, call) : stored
    },
    selectSensitivity: async (request: SfSensitivityChoice, call: TrustedDomainContext) => {
      if (!await authority.human.authorize(call, "decisions.sensitivity.select", request)) return { status: "denied", reason: "human-sensitivity-selection-required" } as const
      const binding = await input.portfolio.sensitivityBindings.read(request, call)
      const result = await business.results.read({ kind: "sensitivity", resultRef: request.resultRef }, call)
      if (binding.status !== "ok") return binding
      if (result.status !== "ok") return result
      if (result.value.kind !== "sensitivity" || digestSfValue(result.value.caseRef) !== digestSfValue(request.caseRef)) return { status: "denied", reason: "sensitivity-selection-scope-mismatch" } as const
      const stored = await write("sensitivity", request, [request.resultRef], digestSfValue({ binding: binding.value, result: result.value }), call)
      return stored.status === "ok" ? readSensitivity(request.caseRef, call) : stored
    },
  }
}

function choiceDigest(value: Choice) { return digestSfValue(Object.fromEntries(Object.entries(value).filter(([key]) => key !== "recordDigest"))) }
function isChoice(value: unknown): value is Choice {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const record = value as Partial<Choice>
  return record.schema === "sf-analysis-selection-v1" && (record.kind === "bi" || record.kind === "sensitivity") && !!record.caseRef &&
    Array.isArray(record.references) && record.references.every((ref) => typeof ref === "string" && ref.trim()) && typeof record.materialDigest === "string" && typeof record.recordDigest === "string"
}
