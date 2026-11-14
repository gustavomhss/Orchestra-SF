import { digestSfValue } from "../contracts/canonical.ts"
import { isSfPeriod } from "../contracts/validation.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { SfBiArtifact, SfProductStatePort } from "../contracts/state.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { Snapshot } from "../../runtime/contract.ts"
import { encodeCaseRef } from "../decisions/case-port.ts"
import { brushPeriod } from "./geometry.ts"
import { resolveBiPresentation } from "./semantics.ts"
import { resolveWaterfall } from "./waterfall.ts"
import { resolveTimeline } from "./milestones.ts"

type Selection = Pick<SfBiArtifact, "caseRef" | "selection" | "dashboardSelection" | "period">
type Produced = Pick<SfBiArtifact, "projection" | "presentation" | "projectionRefs" | "sourceRefs" | "sourceFenceDigest">
type Mutation = { expectedStorageVersion: number; idempotencyKey: string }

/** Producer and fence callbacks are private installation authorities, not browser-supplied facts. */
export function createSfBiArtifactStore(input: {
  host: Pick<DomainPortHost, "requestFor" | "revalidate">
  state: SfProductStatePort
  authorizeSelection: (selection: Selection, mutation: Mutation, call: TrustedDomainContext) => Promise<boolean>
  produce: (selection: Selection, call: TrustedDomainContext) => Promise<PortResult<Produced>>
  verifyCurrent: (artifact: SfBiArtifact, call: TrustedDomainContext) => Promise<boolean>
  verifyLocked: (artifact: SfBiArtifact, call: TrustedDomainContext, snapshot: Readonly<Snapshot>) => Promise<boolean>
  readLockedFence: () => string | undefined
  operationIdentity: (call: TrustedDomainContext) => string | undefined
  now: () => string
}) {
  const read = async (ref: string, call: TrustedDomainContext): Promise<PortResult<SfBiArtifact>> => {
    const request = input.host.requestFor(call)
    if (!request || !await input.host.revalidate(call)) return { status: "denied", reason: "bi-artifact-authority-unavailable" }
    const load = () => input.state.read(request, "bi-artifacts", (state, actor) => {
      const artifacts = Object.values(state.biArtifacts ?? {}).filter((artifact) => artifact.projectionRef === ref || artifact.tableRef === ref)
      if (artifacts.length !== 1) return undefined
      const artifact = artifacts[0]!
      const current = state.cases[artifact.caseRef.id]
      return current && current.incarnation === artifact.caseRef.incarnation && current.version === artifact.caseRef.version && current.participants.includes(actor.principalRef) && artifact.binding.principalRef === actor.principalRef && artifact.binding.accessRevision === actor.accessRevision && artifact.binding.policyVersion === actor.policyVersion && artifact.binding.installationId === call.binding.installationId && artifact.binding.projectId === call.binding.projectId ? artifact : undefined
    })
    const first = await load()
    if (first.status !== "ok" || !first.value || first.value.projectionDigest !== digestSfValue(first.value.projection) || first.value.tableDigest !== digestSfValue({ rows: first.value.rows, period: first.value.period, presentation: first.value.presentation }) || !await input.verifyCurrent(structuredClone(first.value), call)) return { status: "unavailable", reason: "bi-artifact-unavailable" }
    const again = await load()
    if (again.status !== "ok" || digestSfValue(again.value) !== digestSfValue(first.value) || !await input.verifyCurrent(structuredClone(first.value), call) || !await input.host.revalidate(call)) return { status: "unavailable", reason: "bi-artifact-changed" }
    return { status: "ok", value: first.value }
  }
  return {
    read,
    save: async (selection: Selection, mutation: Mutation, call: TrustedDomainContext): Promise<PortResult<{ projectionRef: string; tableRef: string }>> => {
      const request = input.host.requestFor(call)
      const operation = input.operationIdentity(call)
      const wanted = structuredClone(selection)
      const command = structuredClone(mutation)
      if (call.kind !== "ui" || !request || !operation || !Number.isSafeInteger(command.expectedStorageVersion) || command.expectedStorageVersion < 0 || !command.idempotencyKey.trim() || !isSfPeriod(wanted.period) || !isSfPeriod(wanted.dashboardSelection.period) || wanted.period.start < wanted.dashboardSelection.period.start || wanted.period.end > wanted.dashboardSelection.period.end || !await input.authorizeSelection(structuredClone(wanted), structuredClone(command), call) || !await input.host.revalidate(call)) return { status: "denied", reason: "bi-artifact-authority-unavailable" }
      const current = await input.state.read(request, "cases", (state, actor) => {
        const value = state.cases[wanted.caseRef.id]
        return value && value.incarnation === wanted.caseRef.incarnation && value.version === wanted.caseRef.version && value.participants.includes(actor.principalRef) ? value : undefined
      })
      if (current.status !== "ok" || !current.value) return { status: "unavailable", reason: "bi-case-unavailable" }
      const produced = await input.produce(structuredClone(wanted), call)
      if (produced.status !== "ok") return produced
      const material = structuredClone(produced.value)
      const projection = material.projection
      if (projection.context.installationId !== call.binding.installationId || projection.context.projectId !== call.binding.projectId || projection.context.principalRef !== call.binding.principalRef || projection.context.accessRevision !== call.binding.accessRevision || projection.context.policyVersion !== call.binding.policyVersion || digestSfValue(projection.context.period) !== digestSfValue(wanted.dashboardSelection.period) || wanted.period.start < projection.context.period.start || wanted.period.end > projection.context.period.end || material.presentation.viewId !== wanted.selection.viewId || resolveBiPresentation(projection, material.presentation).status !== "ok" || (material.presentation.waterfall && resolveWaterfall(projection, material.presentation.waterfall).status !== "ok") || (material.presentation.timeline && resolveTimeline(projection, material.presentation.timeline).status !== "ok") || !material.projectionRefs.length || !material.sourceRefs.length || !material.sourceFenceDigest) return { status: "unavailable", reason: "bi-projection-unavailable" }
      const rows = brushPeriod(projection.values, wanted.period.start, wanted.period.end).map((value) => ({ ...value, value: value.evidenceState === "absent" || (typeof value.value === "number" && !Number.isFinite(value.value)) ? null : value.value }))
      const id = digestSfValue({ operation, principalRef: call.binding.principalRef, selection: wanted })
      const artifact: SfBiArtifact = { schemaVersion: 1, id, incarnation: id, version: 1, ...wanted, projectionRef: `sf-bi-projection:${id}`, tableRef: `sf-bi-table:${id}`, projection, projectionDigest: digestSfValue(projection), presentation: material.presentation, rows, tableDigest: digestSfValue({ rows, period: wanted.period, presentation: material.presentation }), projectionRefs: material.projectionRefs, sourceRefs: material.sourceRefs, sourceFenceDigest: material.sourceFenceDigest, binding: { installationId: call.binding.installationId, projectId: call.binding.projectId, principalRef: call.binding.principalRef, accessRevision: call.binding.accessRevision, policyVersion: call.binding.policyVersion }, createdAt: input.now() }
      if (!await input.verifyCurrent(structuredClone(artifact), call) || !await input.authorizeSelection(structuredClone(wanted), structuredClone(command), call)) return { status: "unavailable", reason: "bi-projection-changed" }
      const saved = await input.state.transaction(request, { namespace: "bi-artifacts", sourceFence: "all", expectedStorageVersion: command.expectedStorageVersion, checkNamespaces: [{ namespace: "cases", expectedStorageVersion: current.storageVersion }], idempotencyKey: command.idempotencyKey, commandDigest: digestSfValue({ selection: wanted, operation }), targetRef: encodeCaseRef(wanted.caseRef), targetIncarnation: wanted.caseRef.incarnation }, async (state, actor, snapshot) => {
        const snapshotDigest = digestSfValue(snapshot)
        const sourceFence = input.readLockedFence()
        const selected = state.cases[wanted.caseRef.id]
        if (!sourceFence || sourceFence !== artifact.sourceFenceDigest || !selected || digestSfValue(selected) !== digestSfValue(current.value) || actor.principalRef !== call.binding.principalRef || actor.accessRevision !== call.binding.accessRevision || actor.policyVersion !== call.binding.policyVersion || state.biArtifacts?.[id] || !await input.verifyLocked(structuredClone(artifact), call, structuredClone(snapshot)) || !await input.authorizeSelection(structuredClone(wanted), structuredClone(command), call)) return { commit: false, value: undefined }
        if (input.readLockedFence() !== sourceFence || digestSfValue(snapshot) !== snapshotDigest || artifact.projectionDigest !== digestSfValue(artifact.projection) || artifact.tableDigest !== digestSfValue({ rows: artifact.rows, period: artifact.period, presentation: artifact.presentation })) return { commit: false, value: undefined }
        state.biArtifacts ??= {}
        state.biArtifacts[id] = artifact
        return { commit: true, value: { projectionRef: artifact.projectionRef, tableRef: artifact.tableRef } }
      })
      if (saved.status !== "ok" || !saved.value) return saved.status === "denied" || saved.status === "unavailable" || saved.status === "conflict" ? saved : { status: "unavailable", reason: "bi-artifact-unavailable" }
      const checked = await read(saved.value.projectionRef, call)
      return checked.status === "ok" && checked.value.tableRef === saved.value.tableRef && await input.authorizeSelection(structuredClone(wanted), structuredClone(command), call) ? { status: "ok", value: saved.value } : { status: "unavailable", reason: "bi-artifact-changed" }
    },
  }
}
