import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { JsonValue, SfOperationInputMap } from "../contracts/operations.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"
import type { RoutineResult } from "../contracts/context.ts"

type Operation = "sf_routine_catalog" | "sf_routine_prepare" | "sf_routine_run" | "sf_routine_status" | "sf_routine_result" | "sf_watch_prepare"
export type RoutineHost = {
  routines: BusinessPorts["routines"]
  resolveRecipe: (ref: string, context: TrustedDomainContext) => Promise<PortResult<{ planRevisionId: string; writeScope: readonly string[]; documentId?: string; publishedVersion?: string }>>
  resolveCase: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
  prepareWatch: (request: SfOperationInputMap["sf_watch_prepare"], context: TrustedDomainContext) => Promise<PortResult<SfOperationOutputMap["sf_watch_prepare"]>>
  /** Dispatch consumes the lease; handlers only revalidate it and read its receipt. */
  authority: Pick<SfDomainValidation, "revalidateDomainContext" | "receiptFor">
  /** Revalidate all source and artifact access at egress. */
  revalidateOutput: (context: TrustedDomainContext, output: SfOperationOutputMap[Operation]) => Promise<boolean>
  /** Opens the immutable result through the host's authenticated result/artifact boundary. */
  resolveResult?: (run: RoutineResult, context: TrustedDomainContext) => Promise<PortResult<RoutineResult>>
  requiredAuthority: Readonly<Record<Operation, readonly string[]>>
}

export const routineInputSchemas = {
  sf_routine_catalog: sfOperationInputSchemas.sf_routine_catalog,
  sf_routine_prepare: sfOperationInputSchemas.sf_routine_prepare,
  sf_routine_run: sfOperationInputSchemas.sf_routine_run,
  sf_routine_status: sfOperationInputSchemas.sf_routine_status,
  sf_routine_result: sfOperationInputSchemas.sf_routine_result,
  sf_watch_prepare: sfOperationInputSchemas.sf_watch_prepare,
} as const
export const routineOutputSchemas = {
  sf_routine_catalog: sfOperationOutputSchemas.sf_routine_catalog,
  sf_routine_prepare: sfOperationOutputSchemas.sf_routine_prepare,
  sf_routine_run: sfOperationOutputSchemas.sf_routine_run,
  sf_routine_status: sfOperationOutputSchemas.sf_routine_status,
  sf_routine_result: sfOperationOutputSchemas.sf_routine_result,
  sf_watch_prepare: sfOperationOutputSchemas.sf_watch_prepare,
} as const

async function execute<K extends Operation>(operation: K, value: unknown, context: TrustedDomainContext, host: RoutineHost, invoke: (request: SfOperationInputMap[K]) => Promise<PortResult<SfOperationOutputMap[K]>>): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput(operation, value)
  if (!parsed.ok) return reject(operation, "invalid-input", "invalid-input", "needs-input")
  const digest = digestSfValue(parsed.value)
  if (!host.authority.receiptFor(context, operation, digest)) return reject(operation, "authority-unavailable", "invalid-binding", "denied")
  if (context.kind === "native" && context.binding.entryMode === "routine-result" && (operation === "sf_routine_prepare" || operation === "sf_routine_run")) return reject(operation, "recursive-routine", "invalid-binding", "denied")
  if (!await host.authority.revalidateDomainContext(context)) return reject(operation, "authority-unavailable", "invalid-binding", "denied")
  const result = await invoke(parsed.value).catch(() => undefined)
  if (!result) return reject(operation, "routine-port-unavailable", "unavailable", "unavailable")
  if (result.status !== "ok") return reject(operation, result.reason, result.status === "denied" ? "invalid-binding" : "unavailable", result.status === "conflict" ? "stale" : result.status)
  if (!decodeSfOperationOutput(operation, result.value).ok) return reject(operation, "invalid-output", "unavailable", "unavailable")
  if (!await host.authority.revalidateDomainContext(context) || !await host.revalidateOutput(context, result.value)) return reject(operation, "authority-unavailable", "invalid-binding", "denied")
  const receipt = host.authority.receiptFor(context, operation, digest, digestSfValue(result.value))
  if (!receipt) return reject(operation, "authority-unavailable", "invalid-binding", "denied")
  return { status: "ok", result: result.value, receipt }
}

export function readRoutineCatalog(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_routine_catalog", value, context, host, async (request) => {
    const result = await host.routines.catalog(request.purpose, context)
    if (result.status !== "ok") return result
    if (result.value.some((entry) => !entry.documentId.trim() || !entry.publishedVersion.trim() || !entry.planRevisionId.trim()) || new Set(result.value.map((entry) => `${entry.documentId}\u0000${entry.publishedVersion}`)).size !== result.value.length) return { status: "unavailable", reason: "routine-catalog-invalid" }
    return { status: "ok", value: { recipes: result.value, limitations: [] } }
  })
}

export function prepareRoutine(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_routine_prepare", value, context, host, async (request) => {
    const recipe = await host.resolveRecipe(request.publishedRecipeRef, context)
    if (recipe.status !== "ok") return recipe
    if (!recipe.value.planRevisionId.trim() || !await host.authority.revalidateDomainContext(context)) return { status: "denied", reason: "recipe-authority-unavailable" }
    const parameters: Record<string, JsonValue> = {}
    if (request.parameters.period) parameters.period = { start: request.parameters.period.start, end: request.parameters.period.end }
    if (request.parameters.selectionRefs) parameters.selectionRefs = request.parameters.selectionRefs
    if (request.parameters.reviewRef) parameters.reviewRef = request.parameters.reviewRef
    const prepared = await host.routines.prepareAdmission({ publishedRecipeRef: request.publishedRecipeRef, inputRefs: request.inputRefs, parameters, planRevisionId: recipe.value.planRevisionId, writeScope: recipe.value.writeScope }, context)
    if (prepared.status !== "ok") return prepared
    if (prepared.value.principalRef !== context.binding.principalRef || prepared.value.projectId !== context.binding.projectId) return { status: "denied", reason: "admission-unavailable" }
    if ((recipe.value.documentId && prepared.value.documentId !== recipe.value.documentId) || (recipe.value.publishedVersion && prepared.value.publishedVersion !== recipe.value.publishedVersion)) return { status: "stale", reason: "recipe-version-changed" }
    if ((prepared.value.runRef || prepared.value.resultRef) && prepared.value.admission !== "admitted") return { status: "unavailable", reason: "invalid-admission-result" }
    return prepared
  })
}

export function runAdmittedRoutine(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_routine_run", value, context, host, async (request) => {
    if (!request.admittedRunRef.trim() || !Number.isSafeInteger(request.expectedAdmissionVersion) || request.expectedAdmissionVersion < 1) return { status: "needs-input", reason: "invalid-admission-version" }
    const admission = await host.routines.readAdmission(request.admittedRunRef, context)
    if (admission.status !== "ok") return admission
    if (!decodeSfOperationOutput("sf_routine_run", admission.value).ok) return { status: "unavailable", reason: "invalid-admission-result" }
    if (admission.value.admission !== "admitted") return { status: "needs-input", reason: "admission-required" }
    if (admission.value.admissionRef !== request.admittedRunRef || admission.value.admissionVersion !== request.expectedAdmissionVersion) return { status: "stale", reason: "admission-changed" }
    if (admission.value.principalRef !== context.binding.principalRef || admission.value.projectId !== context.binding.projectId) return { status: "denied", reason: "admission-unavailable" }
    const caseRef = await host.resolveCase(context)
    if (caseRef.status !== "ok") return caseRef
    if (context.kind === "native" && (caseRef.value.id !== context.binding.caseId || caseRef.value.incarnation !== context.binding.caseIncarnation || caseRef.value.version !== context.binding.caseVersion)) return { status: "denied", reason: "case-unavailable" }
    // An asynchronous case read can observe a revoked lease. Do not start native work and hide it only at egress.
    if (!await host.authority.revalidateDomainContext(context) || !await host.revalidateOutput(context, admission.value)) return { status: "denied", reason: "admission-authority-changed" }
    const run = await host.routines.run({ admissionRef: request.admittedRunRef, expectedAdmissionVersion: request.expectedAdmissionVersion, caseRef: caseRef.value }, context)
    if (run.status !== "ok") return run
    if (run.value.admission !== "admitted" || run.value.admissionRef !== request.admittedRunRef || run.value.admissionVersion !== request.expectedAdmissionVersion || run.value.documentId !== admission.value.documentId || run.value.publishedVersion !== admission.value.publishedVersion || !run.value.runRef || run.value.principalRef !== context.binding.principalRef || run.value.projectId !== context.binding.projectId) return { status: "stale", reason: "run-admission-mismatch" }
    return run
  })
}

export function readRoutineStatus(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_routine_status", value, context, host, (request) => readAuthorizedRun(request.runRef, context, host))
}
export function readRoutineResult(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_routine_result", value, context, host, async (request) => {
    const run = await readAuthorizedRun(request.runRef, context, host)
    if (run.status !== "ok") return run
    if (run.value.admission !== "admitted" || !run.value.resultRef) return { status: "needs-input", reason: "result-not-ready" }
    if (!host.resolveResult) return { status: "unavailable", reason: "result-reader-unavailable" }
    const opened = await host.resolveResult(run.value, context)
    if (opened.status !== "ok") return opened
    if (opened.value.admission !== "admitted" || opened.value.admissionRef !== run.value.admissionRef || opened.value.admissionVersion !== run.value.admissionVersion || opened.value.runRef !== run.value.runRef || opened.value.resultRef !== run.value.resultRef || opened.value.documentId !== run.value.documentId || opened.value.publishedVersion !== run.value.publishedVersion || opened.value.correlationId !== run.value.correlationId || opened.value.principalRef !== run.value.principalRef || opened.value.projectId !== run.value.projectId || digestSfValue(opened.value.sourceRefs) !== digestSfValue(run.value.sourceRefs)) return { status: "stale", reason: "result-run-mismatch" }
    return opened
  })
}
export function prepareWatch(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_watch_prepare", value, context, host, async (request) => {
    if (context.kind === "native" && request.caseRef !== context.binding.caseId) return { status: "denied", reason: "case-unavailable" }
    const result = await host.prepareWatch(request, context)
    if (result.status !== "ok") return result
    if (result.value.caseRef !== request.caseRef || result.value.conditionRef !== request.conditionRef || result.value.recipientRef !== request.recipientRef || result.value.recurrence !== request.recurrence.schedule) return { status: "stale", reason: "watch-proposal-mismatch" }
    return result
  })
}

async function readAuthorizedRun(runRef: string, context: TrustedDomainContext, host: RoutineHost) {
  if (!runRef.trim()) return { status: "needs-input", reason: "run-reference-required" } as const
  const result = await host.routines.readRun(runRef, context)
  if (result.status !== "ok") return result
  if (result.value.runRef !== runRef || result.value.principalRef !== context.binding.principalRef || result.value.projectId !== context.binding.projectId) return { status: "denied", reason: "run-unavailable" } as const
  if (result.value.admission !== "admitted") return { status: "unavailable", reason: "run-admission-unavailable" } as const
  return result
}

export function createRoutineCapabilities(host: RoutineHost): readonly CapabilityDescriptor[] {
  return [
    { id: "sf_routine_catalog", pack: "routines", mode: "read", inputSchema: sfOperationInputSchemas.sf_routine_catalog, outputSchema: sfOperationOutputSchemas.sf_routine_catalog, handler: (value, context) => readRoutineCatalog(value, context, host), handlerExport: "readRoutineCatalog", producerTask: "WP09.T01", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority.sf_routine_catalog },
    { id: "sf_routine_prepare", pack: "routines", mode: "prepare", inputSchema: sfOperationInputSchemas.sf_routine_prepare, outputSchema: sfOperationOutputSchemas.sf_routine_prepare, handler: (value, context) => prepareRoutine(value, context, host), handlerExport: "prepareRoutine", producerTask: "WP09.T01", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority.sf_routine_prepare },
    { id: "sf_routine_run", pack: "routines", mode: "execute_admitted", inputSchema: sfOperationInputSchemas.sf_routine_run, outputSchema: sfOperationOutputSchemas.sf_routine_run, handler: (value, context) => runAdmittedRoutine(value, context, host), handlerExport: "runAdmittedRoutine", producerTask: "WP09.T01", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority.sf_routine_run },
    { id: "sf_routine_status", pack: "routines", mode: "read", inputSchema: sfOperationInputSchemas.sf_routine_status, outputSchema: sfOperationOutputSchemas.sf_routine_status, handler: (value, context) => readRoutineStatus(value, context, host), handlerExport: "readRoutineStatus", producerTask: "WP09.T01", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority.sf_routine_status },
    { id: "sf_routine_result", pack: "routines", mode: "read", inputSchema: sfOperationInputSchemas.sf_routine_result, outputSchema: sfOperationOutputSchemas.sf_routine_result, handler: (value, context) => readRoutineResult(value, context, host), handlerExport: "readRoutineResult", producerTask: "WP09.T01", grantProfiles: ["sf_maestro"], requiredAuthority: host.requiredAuthority.sf_routine_result },
    { id: "sf_watch_prepare", pack: "routines", mode: "prepare", inputSchema: sfOperationInputSchemas.sf_watch_prepare, outputSchema: sfOperationOutputSchemas.sf_watch_prepare, handler: (value, context) => prepareWatch(value, context, host), handlerExport: "prepareWatch", producerTask: "WP09.T06", grantProfiles: ["sf_maestro", "sf_portfolio"], requiredAuthority: host.requiredAuthority.sf_watch_prepare },
  ]
}

function reject(operation: string, reason: string, code: "invalid-input" | "invalid-binding" | "unavailable", status: "needs-input" | "stale" | "denied" | "unavailable" | "provider-conflict" | "failed"): CapabilityResult {
  return { status, reason, receipt: { kind: "unbound", operation, code, at: new Date().toISOString() } }
}

