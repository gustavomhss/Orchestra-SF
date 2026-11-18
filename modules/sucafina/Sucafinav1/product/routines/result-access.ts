import { digestSfValue } from "../contracts/canonical.ts"
import type { RoutineResult, SourceRef } from "../contracts/context.ts"
import type { JsonValue } from "../contracts/operations.ts"
import type { BusinessPorts, PortResult } from "../contracts/ports.ts"
import { decodeSfOperationOutput } from "../contracts/schema-admission.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

/** An envelope around an immutable native output; this adapter never writes a replacement run ledger. */
export type RoutineArtifact = {
  schema: "sf-routine-artifact-v1"
  runRef: string
  resultRef: string
  correlationId: string
  documentId: string
  publishedVersion: string
  principalRef: string
  projectId: string
  inputDigest: string
  outputDigest: string
  sourceRefs: readonly SourceRef[]
  content: JsonValue
  createdAt: string
}
/** Immutable native execution receipt. The output digest comes from completion, not artifact I/O. */
export type RoutineExecutionSnapshot = {
  runRef: string
  resultRef?: string
  state: "requested" | "admission-pending" | "preparing" | "completed" | "failed" | "cancelled"
  revision: string
  outputDigest?: string
}
export type AuthorizedRoutineArtifactResult = { run: RoutineResult; execution: RoutineExecutionSnapshot; output: RoutineArtifact }
export type RoutineResultAccess = {
  readResult: (runRef: string, context: TrustedDomainContext) => Promise<PortResult<AuthorizedRoutineArtifactResult>>
}

export type RoutineAdmittedInput = Parameters<BusinessPorts["routines"]["prepareAdmission"]>[0] & {
  principalRef: string
  projectId: string
  publishedVersion: string
  caseRef: { id: string; incarnation: string; version: number }
}

export function routineInputDigest(input: RoutineAdmittedInput) {
  return digestSfValue(input)
}

export function routineArtifactDigest(artifact: Omit<RoutineArtifact, "outputDigest">) {
  return digestSfValue(artifact)
}

/** The host supplies its existing authenticated artifact reader, with current source and file authorization. */
export function createRoutineResultAccess(input: {
  routines: Pick<BusinessPorts["routines"], "readRun">
  readArtifact: (resultRef: string, context: TrustedDomainContext) => Promise<PortResult<RoutineArtifact>>
  /** Resolve the full admitted parameters/scope/case from native storage, never infer them from a result URL. */
  expectedInputDigest: (run: RoutineResult, context: TrustedDomainContext) => Promise<PortResult<string>>
  /** Read the native execution/terminal receipt under current authority; a result reference is insufficient. */
  readExecution: (runRef: string, context: TrustedDomainContext) => Promise<PortResult<RoutineExecutionSnapshot>>
  authorize: (context: TrustedDomainContext) => Promise<boolean>
  revalidateArtifact: (artifact: RoutineArtifact, context: TrustedDomainContext) => Promise<boolean>
}): RoutineResultAccess {
  const readResult: RoutineResultAccess["readResult"] = async (runRef, context) => {
    if (!runRef.trim() || !await input.authorize(context)) return { status: "denied", reason: "routine-result-unavailable" }
    const found = await input.routines.readRun(runRef, context)
    if (found.status !== "ok") return found
    const run = structuredClone(found.value)
    if (!decodeSfOperationOutput("sf_routine_result", run).ok || run.runRef !== runRef || run.admission !== "admitted" ||
      run.principalRef !== context.binding.principalRef || run.projectId !== context.binding.projectId)
      return { status: "denied", reason: "routine-result-unavailable" }
    if (!run.resultRef) return { status: "needs-input", reason: "result-not-ready" }
    const runDigest = digestSfValue(run)
    const executionRead = await input.readExecution(runRef, context)
    if (executionRead.status !== "ok") return executionRead
    const execution = structuredClone(executionRead.value)
    const executionStatus = completedExecution(execution, run)
    if (executionStatus) return executionStatus
    const executionDigest = digestSfValue(execution)
    const admittedInput = await input.expectedInputDigest(structuredClone(run), context)
    if (admittedInput.status !== "ok") return admittedInput
    if (!/^[a-f0-9]{64}$/.test(admittedInput.value)) return { status: "unavailable", reason: "routine-input-unverified" }
    if (!await input.authorize(context)) return { status: "denied", reason: "routine-result-unavailable" }
    const artifact = await input.readArtifact(run.resultRef, context).catch(() => undefined)
    if (!artifact) return { status: "unavailable", reason: "routine-artifact-unavailable" }
    if (artifact.status !== "ok") return artifact
    const output = structuredClone(artifact.value)
    if (!validArtifact(output, run, admittedInput.value) || output.outputDigest !== execution.outputDigest)
      return { status: "unavailable", reason: "routine-artifact-unverified" }
    if (!await input.revalidateArtifact(structuredClone(output), context)) return { status: "denied", reason: "routine-result-unavailable" }
    // Do not release an old output if completion, cancellation, source version or access changed during its read.
    const current = await input.routines.readRun(runRef, context)
    if (current.status !== "ok") return current
    if (digestSfValue(current.value) !== runDigest) return { status: "stale", reason: "routine-result-changed" }
    const currentInput = await input.expectedInputDigest(structuredClone(run), context)
    if (currentInput.status !== "ok") return currentInput
    if (currentInput.value !== admittedInput.value) return { status: "stale", reason: "routine-input-changed" }
    const currentExecution = await input.readExecution(runRef, context)
    if (currentExecution.status !== "ok") return currentExecution
    if (digestSfValue(currentExecution.value) !== executionDigest) return { status: "stale", reason: "routine-execution-changed" }
    if (!await input.revalidateArtifact(structuredClone(output), context) || !await input.authorize(context)) return { status: "denied", reason: "routine-result-unavailable" }
    return { status: "ok", value: { run, execution, output } }
  }
  return { readResult: (runRef, context) => readResult(runRef, context).catch(() => ({ status: "unavailable", reason: "routine-result-unavailable" })) }
}

function completedExecution(execution: RoutineExecutionSnapshot, run: RoutineResult): Exclude<PortResult<never>, { status: "ok" }> | undefined {
  if (!execution || execution.runRef !== run.runRef || !execution.revision?.trim())
    return { status: "unavailable", reason: "routine-execution-unverified" }
  if (execution.state === "failed" || execution.state === "cancelled")
    return { status: "denied", reason: "routine-result-unavailable" }
  if (execution.state === "requested" || execution.state === "admission-pending" || execution.state === "preparing")
    return { status: "needs-input", reason: "result-not-ready" }
  if (execution.state !== "completed" || execution.resultRef !== run.resultRef || !/^[a-f0-9]{64}$/.test(execution.outputDigest ?? ""))
    return { status: "unavailable", reason: "routine-execution-unverified" }
}

function validArtifact(output: RoutineArtifact, run: RoutineResult, admittedInputDigest: string) {
  if (!output || output.schema !== "sf-routine-artifact-v1" || output.runRef !== run.runRef || output.resultRef !== run.resultRef ||
    output.correlationId !== run.correlationId || output.documentId !== run.documentId || output.publishedVersion !== run.publishedVersion ||
    output.principalRef !== run.principalRef || output.projectId !== run.projectId ||
    output.inputDigest !== admittedInputDigest || !Number.isFinite(Date.parse(output.createdAt)) ||
    digestSfValue(output.sourceRefs) !== digestSfValue(run.sourceRefs) || !jsonContent(output.content, 0)) return false
  const { outputDigest, ...body } = output
  const keys = ["schema", "runRef", "resultRef", "correlationId", "documentId", "publishedVersion", "principalRef", "projectId", "inputDigest", "sourceRefs", "content", "createdAt"]
  return Object.keys(body).length === keys.length && Object.keys(body).every((key) => keys.includes(key)) &&
    /^[a-f0-9]{64}$/.test(outputDigest) && routineArtifactDigest(body) === outputDigest
}

function jsonContent(value: unknown, depth: number): value is JsonValue {
  if (depth > 64) return false
  if (value === null || typeof value === "string" || typeof value === "boolean") return true
  if (typeof value === "number") return Number.isFinite(value)
  if (Array.isArray(value)) return value.every((item) => jsonContent(item, depth + 1))
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false
  return Object.values(value).every((item) => jsonContent(item, depth + 1))
}
