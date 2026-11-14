import { Effect } from "effect"
import { RelayWorkflowBinding } from "@orchestra/core/relay-workflow-binding"
import type { RelayArm } from "../../../../packages/schema/src/relay-arm.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { RoutineResult, SourceRef } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { BusinessPorts, PortResult } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import { decodeSfOperationOutput } from "../../../../modules/sucafina/Sucafinav1/product/contracts/schema-admission.ts"
import { createRoutineCapabilities } from "../../../../modules/sucafina/Sucafinav1/product/routines/capabilities.ts"
import type { RoutineHost } from "../../../../modules/sucafina/Sucafinav1/product/routines/capabilities.ts"
import { createSfRoutineProduct } from "../../../../modules/sucafina/Sucafinav1/product/routines/factory.ts"
import { acquireRoutineWorkflow, createRoutinePublicationCatalog } from "../../../../modules/sucafina/Sucafinav1/product/routines/publication.ts"
import type { RoutinePublicationHost } from "../../../../modules/sucafina/Sucafinav1/product/routines/publication.ts"
import { createRoutineResultAccess, routineInputDigest } from "../../../../modules/sucafina/Sucafinav1/product/routines/result-access.ts"
import type { RoutineAdmittedInput, RoutineArtifact, RoutineExecutionSnapshot } from "../../../../modules/sucafina/Sucafinav1/product/routines/result-access.ts"

export type SfRoutinePlan = {
  documentId: string
  publishedVersion: string
  planRevisionId: string
  writeScope: readonly string[]
  /** Exact parameters recorded in the native plan revision, including its C07 input binding. */
  workflowParameters: Readonly<Record<string, string>>
  inputDigest: string
}

/** Read from native admission storage. This module never persists a second admission or run ledger. */
export type SfRoutineNativeRecord = {
  result: RoutineResult
  input: RoutineAdmittedInput
  inputDigest: string
  workflow: RelayArm.WorkflowDefinition
}

/**
 * An installed native C07 adapter must retain the real governed Task admission and terminal receipt.
 * SessionV2.resume, an external self-reported ledger, and a model's result reference do not implement this port.
 * Mutations reauthenticate the recorded SF owner at their native transaction/dispatch boundary.
 */
export type SfRoutineNativePort = {
  resolvePlan: (recipe: { documentId: string; publishedVersion: string }, purpose: string, context: TrustedDomainContext) => Promise<PortResult<SfRoutinePlan | null>>
  resolveRecipe: (reference: string, context: TrustedDomainContext) => Promise<PortResult<SfRoutinePlan>>
  prepare: (request: { input: RoutineAdmittedInput; inputDigest: string; sourceRefs: readonly SourceRef[]; workflow: RelayArm.WorkflowDefinition }, context: TrustedDomainContext) => Promise<PortResult<SfRoutineNativeRecord>>
  readAdmission: (admissionRef: string, context: TrustedDomainContext) => Promise<PortResult<SfRoutineNativeRecord>>
  readRun: (runRef: string, context: TrustedDomainContext) => Promise<PortResult<SfRoutineNativeRecord>>
  start: (request: Parameters<BusinessPorts["routines"]["run"]>[0] & { inputDigest: string }, context: TrustedDomainContext) => Promise<PortResult<SfRoutineNativeRecord>>
  listRunRefs: (context: TrustedDomainContext) => Promise<PortResult<readonly string[]>>
  readExecution: (runRef: string, context: TrustedDomainContext) => Promise<PortResult<RoutineExecutionSnapshot>>
  readArtifact: (resultRef: string, context: TrustedDomainContext) => Promise<PortResult<RoutineArtifact>>
}

export type SfRoutineServicesInput = {
  authority: RoutineHost["authority"]
  publication?: () => RoutinePublicationHost | undefined
  native?: () => SfRoutineNativePort | undefined
  resolveCase: RoutineHost["resolveCase"]
  resolveInputs: (references: readonly string[], context: TrustedDomainContext) => Promise<PortResult<readonly SourceRef[]>>
  revalidateSources: (sources: readonly SourceRef[], context: TrustedDomainContext) => Promise<boolean>
  prepareWatch?: RoutineHost["prepareWatch"]
  /** A Schedule function that only returns unavailable is not an installed watch admission binding. */
  watchAvailable?: () => boolean
  requiredAuthority?: RoutineHost["requiredAuthority"]
}

/** C08/C16 composition for UI, native MCP and factual result consumers, using the WP09 producers. */
export function createSfRoutineServices(input: SfRoutineServicesInput) {
  const authorized = (context: TrustedDomainContext) => input.authority.revalidateDomainContext(context)
  const sameNative = (native: SfRoutineNativePort, context: TrustedDomainContext) => input.native?.() === native && authorized(context)
  const planFor: RoutineHost["resolveRecipe"] = async (reference, context) => {
    if (!await authorized(context)) return denied()
    const native = input.native?.()
    if (!native) return unavailable("native-routine-plan-reader-unavailable")
    const found = await native.resolveRecipe(reference, context)
    if (found.status !== "ok") return found
    if (!validPlan(found.value) || !await sameNative(native, context)) return denied()
    return { status: "ok", value: structuredClone(found.value) }
  }
  const publicationFor = (context: TrustedDomainContext) => {
    const publication = input.publication?.()
    if (!publication || publication.publication.projectID !== context.binding.projectId) return undefined
    return {
      host: publication,
      resolvePlan: async (recipe: { documentId: string; publishedVersion: string }, purpose: string, call: TrustedDomainContext) => {
        const native = input.native?.()
        if (!native || !await authorized(call)) return { state: "needs-plan" as const }
        const found = await native.resolvePlan(recipe, purpose, call)
        if (found.status !== "ok" || !await sameNative(native, call)) return { state: "needs-plan" as const }
        if (!found.value) return { state: "excluded" as const }
        const plan = structuredClone(found.value)
        return validPlan(plan) && plan.documentId === recipe.documentId && plan.publishedVersion === recipe.publishedVersion
          ? { state: "ready" as const, planRevisionId: plan.planRevisionId, writeScope: plan.writeScope }
          : { state: "needs-plan" as const }
      },
    }
  }

  const validateRecord = async (incoming: SfRoutineNativeRecord, native: SfRoutineNativePort, context: TrustedDomainContext): Promise<PortResult<SfRoutineNativeRecord>> => {
    const record = structuredClone(incoming)
    const decoded = decodeSfOperationOutput("sf_routine_status", record.result)
    if (!decoded.ok || !record.input || !record.workflow || !/^[a-f0-9]{64}$/.test(record.inputDigest) || routineInputDigest(record.input) !== record.inputDigest)
      return unavailable("native-routine-input-unverified")
    const run = decoded.value
    if ((run.runRef || run.resultRef) && run.admission !== "admitted") return unavailable("native-routine-admission-unverified")
    if (run.principalRef !== context.binding.principalRef || run.projectId !== context.binding.projectId ||
      record.input.principalRef !== run.principalRef || record.input.projectId !== run.projectId || record.input.publishedVersion !== run.publishedVersion ||
      record.workflow.publication.projectID !== run.projectId || record.workflow.publication.documentID !== run.documentId ||
      record.workflow.publication.activeVersionID !== run.publishedVersion || digestSfValue(record.input.writeScope) !== digestSfValue(record.workflow.writePaths)) return denied()
    if (context.kind === "native" && (record.input.caseRef.id !== context.binding.caseId || record.input.caseRef.incarnation !== context.binding.caseIncarnation || record.input.caseRef.version !== context.binding.caseVersion)) return denied()
    const current = await input.resolveCase(context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== digestSfValue(record.input.caseRef)) return { status: "stale", reason: "routine-case-changed" }
    const sources = await input.resolveInputs(record.input.inputRefs, context)
    if (sources.status !== "ok") return sources
    if (routineSourceDigest(sources.value) !== routineSourceDigest(run.sourceRefs)) return { status: "stale", reason: "routine-input-sources-changed" }
    const publication = publicationFor(context)
    if (!publication) return unavailable("routine-publication-port-unavailable")
    const pinned = await Effect.runPromise(Effect.result(RelayWorkflowBinding.revalidate(publication.host.publication, record.workflow)))
    if (pinned._tag === "Failure") return { status: "stale", reason: "routine-publication-changed" }
    if (input.publication?.() !== publication.host || !await input.revalidateSources(run.sourceRefs, context) || !await sameNative(native, context)) return denied()
    return { status: "ok", value: { ...record, result: run } }
  }

  const readRecord = async (kind: "admission" | "run", reference: string, context: TrustedDomainContext): Promise<PortResult<SfRoutineNativeRecord>> => {
    if (!reference.trim() || !await authorized(context)) return denied()
    const native = input.native?.()
    if (!native) return unavailable("native-routine-admission-reader-unavailable")
    const read = kind === "admission" ? await native.readAdmission(reference, context) : await native.readRun(reference, context)
    if (read.status !== "ok") return read
    const checked = await validateRecord(read.value, native, context)
    if (checked.status !== "ok") return checked
    if ((kind === "admission" ? checked.value.result.admissionRef : checked.value.result.runRef) !== reference) return denied()
    return checked
  }

  const routines: BusinessPorts["routines"] = {
    catalog: async (purpose, context) => {
      if (!await authorized(context)) return denied()
      const publication = publicationFor(context)
      if (!publication) return unavailable("routine-publication-port-unavailable")
      const result = await createRoutinePublicationCatalog(publication)(purpose, context)
      return input.publication?.() === publication.host && await authorized(context) ? result : denied()
    },
    prepareAdmission: async (incoming, context) => {
      if (context.kind === "native" && context.binding.entryMode === "routine-result" || !await authorized(context)) return denied()
      const request = structuredClone(incoming)
      const native = input.native?.()
      const publication = publicationFor(context)
      if (!native) return unavailable("native-routine-admission-port-unavailable")
      if (!publication) return unavailable("routine-publication-port-unavailable")
      const selected = await native.resolveRecipe(request.publishedRecipeRef, context)
      if (selected.status !== "ok") return selected
      const plan = structuredClone(selected.value)
      if (!validPlan(plan) || plan.planRevisionId !== request.planRevisionId || digestSfValue(plan.writeScope) !== digestSfValue(request.writeScope)) return { status: "stale", reason: "routine-plan-changed" }
      const current = await input.resolveCase(context)
      if (current.status !== "ok") return current
      const admitted: RoutineAdmittedInput = { ...request, principalRef: context.binding.principalRef, projectId: context.binding.projectId, publishedVersion: plan.publishedVersion, caseRef: structuredClone(current.value) }
      const digest = routineInputDigest(admitted)
      if (digest !== plan.inputDigest) return { status: "needs-input", reason: "native-routine-plan-input-mismatch" }
      const sources = await input.resolveInputs(admitted.inputRefs, context)
      if (sources.status !== "ok") return sources
      const sourceRefs = structuredClone(sources.value)
      const acquired = await acquireRoutineWorkflow({ host: publication.host, context, projectID: publication.host.publication.projectID,
        documentId: plan.documentId, expectedPublishedVersion: plan.publishedVersion, parameters: plan.workflowParameters, writePaths: plan.writeScope })
      if (acquired.status !== "ok") return acquired
      if (!await sameNative(native, context) || input.publication?.() !== publication.host || !await input.revalidateSources(sourceRefs, context)) return denied()
      const prepared = await native.prepare({ input: structuredClone(admitted), inputDigest: digest, sourceRefs: structuredClone(sourceRefs), workflow: acquired.value.definition }, context)
      if (prepared.status !== "ok") return prepared
      const checked = await validateRecord(prepared.value, native, context)
      if (checked.status !== "ok") return checked
      if (checked.value.inputDigest !== digest || digestSfValue(checked.value.workflow) !== digestSfValue(acquired.value.definition)) return { status: "stale", reason: "native-routine-admission-mismatch" }
      return { status: "ok", value: checked.value.result }
    },
    readAdmission: async (reference, context) => {
      const result = await readRecord("admission", reference, context)
      return result.status === "ok" ? { status: "ok", value: result.value.result } : result
    },
    readRun: async (reference, context) => {
      const result = await readRecord("run", reference, context)
      if (result.status !== "ok") return result
      return result.value.result.admission === "admitted" ? { status: "ok", value: result.value.result } : unavailable("native-routine-admission-unverified")
    },
    run: async (incoming, context) => {
      if (context.kind === "native" && context.binding.entryMode === "routine-result" || !await authorized(context)) return denied()
      const request = structuredClone(incoming)
      const native = input.native?.()
      if (!native) return unavailable("native-routine-execution-port-unavailable")
      const admitted = await readRecord("admission", request.admissionRef, context)
      if (admitted.status !== "ok") return admitted
      const before = structuredClone(admitted.value)
      if (before.result.admission !== "admitted") return { status: "needs-input", reason: "admission-required" }
      if (before.result.admissionVersion !== request.expectedAdmissionVersion || digestSfValue(before.input.caseRef) !== digestSfValue(request.caseRef)) return { status: "stale", reason: "routine-admission-changed" }
      if (!await sameNative(native, context)) return denied()
      const started = await native.start({ ...request, inputDigest: before.inputDigest }, context)
      if (started.status !== "ok") return started
      const checked = await validateRecord(started.value, native, context)
      if (checked.status !== "ok") return checked
      const after = checked.value
      if (after.result.admission !== "admitted" || !after.result.runRef || after.result.admissionRef !== before.result.admissionRef ||
        after.result.admissionVersion !== before.result.admissionVersion || after.inputDigest !== before.inputDigest ||
        digestSfValue(after.workflow) !== digestSfValue(before.workflow) || after.result.correlationId !== before.result.correlationId ||
        after.result.authorizationId !== before.result.authorizationId || after.result.armRef !== before.result.armRef ||
        digestSfValue(after.result.sourceRefs) !== digestSfValue(before.result.sourceRefs) ||
        (before.result.childSessionId !== undefined && after.result.childSessionId !== before.result.childSessionId) ||
        (before.result.runRef !== undefined && after.result.runRef !== before.result.runRef) ||
        (before.result.resultRef !== undefined && after.result.resultRef !== before.result.resultRef)) return { status: "stale", reason: "native-routine-run-mismatch" }
      return { status: "ok", value: after.result }
    },
  }

  const expectedInputDigest = async (run: RoutineResult, context: TrustedDomainContext): Promise<PortResult<string>> => {
    if (!run.runRef) return { status: "needs-input", reason: "run-reference-required" }
    const record = await readRecord("run", run.runRef, context)
    if (record.status !== "ok") return record
    return digestSfValue(record.value.result) === digestSfValue(run) ? { status: "ok", value: record.value.inputDigest } : { status: "stale", reason: "routine-run-changed" }
  }
  const readExecution = async (runRef: string, context: TrustedDomainContext): Promise<PortResult<RoutineExecutionSnapshot>> => {
    const native = input.native?.()
    if (!native) return unavailable("native-routine-execution-reader-unavailable")
    const record = await readRecord("run", runRef, context)
    if (record.status !== "ok") return record
    const read = await native.readExecution(runRef, context)
    if (read.status !== "ok") return read
    const execution = structuredClone(read.value)
    if (execution.runRef !== runRef || !execution.revision.trim() || !["requested", "admission-pending", "preparing", "completed", "failed", "cancelled"].includes(execution.state)) return unavailable("native-routine-execution-unverified")
    if (execution.state === "completed" && (execution.resultRef !== record.value.result.resultRef || !execution.resultRef || !/^[a-f0-9]{64}$/.test(execution.outputDigest ?? ""))) return unavailable("native-routine-completion-unverified")
    const current = await readRecord("run", runRef, context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== digestSfValue(record.value)) return { status: "stale", reason: "routine-run-changed" }
    return await sameNative(native, context) ? { status: "ok", value: execution } : denied()
  }
  const readArtifact = async (resultRef: string, context: TrustedDomainContext): Promise<PortResult<RoutineArtifact>> => {
    if (!resultRef.trim() || !await authorized(context)) return denied()
    const native = input.native?.()
    if (!native) return unavailable("native-routine-artifact-reader-unavailable")
    const read = await native.readArtifact(resultRef, context)
    if (read.status !== "ok") return read
    const artifact = structuredClone(read.value)
    if (artifact.resultRef !== resultRef || artifact.principalRef !== context.binding.principalRef || artifact.projectId !== context.binding.projectId || !await input.revalidateSources(artifact.sourceRefs, context) || !await sameNative(native, context)) return denied()
    return { status: "ok", value: artifact }
  }
  const resultAccess = createRoutineResultAccess({ routines, readArtifact, expectedInputDigest, readExecution, authorize: authorized,
    revalidateArtifact: (artifact, context) => input.revalidateSources(artifact.sourceRefs, context) })
  const capabilities: Omit<RoutineHost, "routines"> = {
    authority: input.authority, resolveRecipe: planFor, resolveCase: input.resolveCase,
    prepareWatch: input.prepareWatch ?? (async () => unavailable("native-routine-watch-port-unavailable")),
    revalidateOutput: async (context, output) => await authorized(context) && (!("sourceRefs" in output) || await input.revalidateSources(output.sourceRefs, context)),
    resolveResult: async (run, context) => {
      if (!run.runRef) return { status: "needs-input", reason: "run-reference-required" }
      const result = await resultAccess.readResult(run.runRef, context)
      return result.status === "ok" ? { status: "ok", value: result.value.run } : result
    },
    requiredAuthority: input.requiredAuthority ?? {
      sf_routine_catalog: ["routines:read"], sf_routine_prepare: ["routines:prepare"], sf_routine_run: ["routines:execute"],
      sf_routine_status: ["routines:read"], sf_routine_result: ["routines:read"], sf_watch_prepare: ["routines:prepare"],
    },
  }
  const productFor = (context: TrustedDomainContext) => {
    const publication = publicationFor(context)
    if (!publication) return undefined
    return createSfRoutineProduct({ publication, routines, capabilities, resultAccess, discovery: {
      listRunRefs: async (call) => {
        if (!await authorized(call)) return denied()
        const native = input.native?.()
        if (!native) return unavailable("native-routine-index-unavailable")
        const result = await native.listRunRefs(call)
        return await sameNative(native, call) ? result : denied()
      },
      revalidate: async (call, runs) => await authorized(call) && (await Promise.all(runs.map((run) => input.revalidateSources(run.sourceRefs, call)))).every(Boolean),
    } })
  }
  const descriptors = createRoutineCapabilities({ ...capabilities, routines })
  return {
    routines,
    /** Read at native tool registration, after the existing Location services have actually been acquired. */
    get descriptors() {
      if (!input.native?.() || !input.publication?.()) return []
      return descriptors.filter((descriptor) => descriptor.id !== "sf_watch_prepare" || !!input.prepareWatch && input.watchAvailable?.() === true)
    },
    resultAccess, expectedInputDigest, readExecution,
    readArtifact: async (resultRef: string, context: TrustedDomainContext): Promise<PortResult<RoutineArtifact>> => {
      const artifact = await readArtifact(resultRef, context)
      if (artifact.status !== "ok") return artifact
      const verified = await resultAccess.readResult(artifact.value.runRef, context)
      if (verified.status !== "ok") return verified
      return verified.value.output.resultRef === resultRef ? { status: "ok", value: verified.value.output } : denied()
    },
    routineRuns: { discoverRuns: async (context: TrustedDomainContext): Promise<PortResult<readonly RoutineResult[]>> => {
      const product = productFor(context)
      return product ? product.discoverRuns(context) : unavailable("routine-publication-port-unavailable")
    } },
    openResult: async (runRef: string, context: TrustedDomainContext) => {
      const product = productFor(context)
      return product ? product.openResult(runRef, context) : unavailable("routine-publication-port-unavailable")
    },
  }
}

function validPlan(plan: SfRoutinePlan) {
  return !!plan.documentId.trim() && !!plan.publishedVersion.trim() && !!plan.planRevisionId.trim() && /^[a-f0-9]{64}$/.test(plan.inputDigest) &&
    plan.writeScope.every((entry) => !!entry.trim()) && Object.values(plan.workflowParameters).every((value) => typeof value === "string")
}
/** Observation time is not source identity; version, incarnation, fields and period remain exact. */
export function routineSourceDigest(sources: readonly SourceRef[]) {
  return digestSfValue(sources.map(({ observedAt: _observedAt, ...source }) => source).sort((left, right) => digestSfValue(left).localeCompare(digestSfValue(right))))
}
function unavailable(reason: string) { return { status: "unavailable" as const, reason } }
function denied() { return { status: "denied" as const, reason: "routine-authority-unavailable" } }

