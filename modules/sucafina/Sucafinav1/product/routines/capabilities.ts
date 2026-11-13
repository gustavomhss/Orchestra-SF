import { digestSfValue } from "../contracts/canonical.ts"
import { sfOperationInputSchemas } from "../contracts/operations.ts"
import { sfOperationOutputSchemas } from "../contracts/output-schemas.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { JsonValue, SfOperationInputMap } from "../contracts/operations.ts"
import type { SfOperationOutputMap } from "../contracts/outputs.ts"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import type { CapabilityDescriptor, CapabilityResult, TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { SfDomainValidation } from "../contracts/runtime.ts"

type Operation = "sf_routine_catalog" | "sf_routine_prepare" | "sf_routine_run" | "sf_routine_status" | "sf_routine_result" | "sf_watch_prepare"
type RoutineHost = {
  routines: BusinessPorts["routines"]
  resolveRecipe: (ref: string, context: TrustedDomainContext) => Promise<PortResult<{ planRevisionId: string; writeScope: readonly string[] }>>
  resolveCase: (context: TrustedDomainContext) => Promise<PortResult<{ id: string; incarnation: string; version: number }>>
  prepareWatch: (request: SfOperationInputMap["sf_watch_prepare"], context: TrustedDomainContext) => Promise<PortResult<SfOperationOutputMap["sf_watch_prepare"]>>
  /** Dispatch consumes the lease; handlers only revalidate it and read its receipt. */
  authority: Pick<SfDomainValidation, "revalidateDomainContext" | "receiptFor">
  /** Revalidate all source and artifact access at egress. */
  revalidateOutput: (context: TrustedDomainContext, output: SfOperationOutputMap[Operation]) => Promise<boolean>
  requiredAuthority: Readonly<Record<Operation, readonly string[]>>
}

async function execute<K extends Operation>(operation: K, value: unknown, context: TrustedDomainContext, host: RoutineHost, invoke: (request: SfOperationInputMap[K]) => Promise<PortResult<SfOperationOutputMap[K]>>): Promise<CapabilityResult> {
  const parsed = decodeSfOperationInput(operation, value)
  if (!parsed.ok) return reject(operation, "invalid-input", "invalid-input", "needs-input")
  const digest = digestSfValue(parsed.value)
  if (!host.authority.receiptFor(context, operation, digest)) return reject(operation, "authority-unavailable", "invalid-binding", "denied")
  if (context.kind === "native" && context.binding.entryMode === "routine-result" && (operation === "sf_routine_prepare" || operation === "sf_routine_run")) return reject(operation, "recursive-routine", "invalid-binding", "denied")
  if (!await host.authority.revalidateDomainContext(context)) return reject(operation, "authority-unavailable", "invalid-binding", "denied")
  const result = await invoke(parsed.value)
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
    return { status: "ok", value: { recipes: result.value, limitations: [] } }
  })
}

export function prepareRoutine(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_routine_prepare", value, context, host, async (request) => {
    const recipe = await host.resolveRecipe(request.publishedRecipeRef, context)
    if (recipe.status !== "ok") return recipe
    const parameters: Record<string, JsonValue> = {}
    if (request.parameters.period) parameters.period = { start: request.parameters.period.start, end: request.parameters.period.end }
    if (request.parameters.selectionRefs) parameters.selectionRefs = request.parameters.selectionRefs
    if (request.parameters.reviewRef) parameters.reviewRef = request.parameters.reviewRef
    return host.routines.prepareAdmission({ publishedRecipeRef: request.publishedRecipeRef, inputRefs: request.inputRefs, parameters, planRevisionId: recipe.value.planRevisionId, writeScope: recipe.value.writeScope }, context)
  })
}

export function runAdmittedRoutine(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_routine_run", value, context, host, async (request) => {
    const admission = await host.routines.readAdmission(request.admittedRunRef, context)
    if (admission.status !== "ok") return admission
    if (admission.value.admission !== "admitted") return { status: "needs-input", reason: "admission-required" }
    if (admission.value.admissionRef !== request.admittedRunRef || admission.value.admissionVersion !== request.expectedAdmissionVersion) return { status: "stale", reason: "admission-changed" }
    if (admission.value.principalRef !== context.binding.principalRef || admission.value.projectId !== context.binding.projectId) return { status: "denied", reason: "admission-unavailable" }
    const caseRef = await host.resolveCase(context)
    if (caseRef.status !== "ok") return caseRef
    if (context.kind === "native" && (caseRef.value.id !== context.binding.caseId || caseRef.value.incarnation !== context.binding.caseIncarnation || caseRef.value.version !== context.binding.caseVersion)) return { status: "denied", reason: "case-unavailable" }
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
    if (!run.value.resultRef) return { status: "needs-input", reason: "result-not-ready" }
    return run
  })
}
export function prepareWatch(value: unknown, context: TrustedDomainContext, host: RoutineHost) {
  return execute("sf_watch_prepare", value, context, host, (request) => host.prepareWatch(request, context))
}

async function readAuthorizedRun(runRef: string, context: TrustedDomainContext, host: RoutineHost) {
  const result = await host.routines.readRun(runRef, context)
  if (result.status !== "ok") return result
  if (result.value.runRef !== runRef || result.value.principalRef !== context.binding.principalRef || result.value.projectId !== context.binding.projectId) return { status: "denied", reason: "run-unavailable" } as const
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
