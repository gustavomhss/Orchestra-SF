import type { SfTransport, SfCallOptions } from "../../../../../../packages/client/src/sucafina/transport"
import type { SfTransportFailure, SfTransportResult } from "../../../../../../packages/schema/src/sucafina/common"
import { SfFiles } from "../../../../../../packages/schema/src/sucafina/files"

/**
 * Source-driven 223 oracle: every expected status, selected input, owner,
 * grant and file comes from the ORIGINAL installed producer and real session.
 * This driver never creates a Request, principal, file, grant or result.
 */
export type SfFilesRealExpected =
  | Readonly<{
      kind: "response"
      httpStatus: number
      /** Original PortResult or legacy failure status when response is JSON. */
      bodyStatus?: string
      /** For actual bytes only; no fabricated data or expected MIME default. */
      byteLength?: number
      contentType?: string
    }>
  | Readonly<{ kind: "transport-error"; reason: SfTransportFailure["reason"] }>

export type SfFilesRealInput = Readonly<{
  operation: keyof typeof SfFiles.operations
  input: unknown
  options: SfCallOptions
  expected: SfFilesRealExpected
  /** Producer case reference / accessRevision from real 223 fixture, not UI path. */
  sourceEvidenceRef: string
}>
export type SfFilesRealMatrix = Readonly<{
  allowed: SfFilesRealInput
  denied: SfFilesRealInput
  revoked: SfFilesRealInput
  stale: SfFilesRealInput
  oversize: SfFilesRealInput
  cancelled: SfFilesRealInput
  retry: SfFilesRealInput
}>
type Actual = SfFilesRealExpected
type DriverResult = Readonly<{
  actual: Actual
  expected: SfFilesRealExpected
  passed: boolean
  sourceEvidenceRef: string
}>

function outcome<Output>(value: SfTransportResult<Output>): Actual {
  if (value.kind === "transport-error") return { kind: "transport-error", reason: value.reason }
  const sourceStatus = value.body && typeof value.body === "object" && !Array.isArray(value.body) &&
    "status" in value.body && typeof value.body.status === "string" ? value.body.status : undefined
  return {
    kind: "response", httpStatus: value.status,
    ...(sourceStatus !== undefined ? { bodyStatus: sourceStatus } : {}),
    ...(value.body instanceof Uint8Array ? { byteLength: value.body.byteLength } : {}),
    ...(value.headers["content-type"] !== undefined ? { contentType: value.headers["content-type"] } : {}),
  }
}

function matches(actual: Actual, expected: SfFilesRealExpected): boolean {
  if (actual.kind !== expected.kind) return false
  if (actual.kind === "transport-error" || expected.kind === "transport-error")
    return actual.kind === "transport-error" && expected.kind === "transport-error" &&
      actual.reason === expected.reason
  // Exact producer HTTP status and explicit oracle fields. Omitted fields
  // are not invented; 223 must provide all semantically relevant ones.
  return actual.httpStatus === expected.httpStatus &&
    (expected.bodyStatus === undefined || actual.bodyStatus === expected.bodyStatus) &&
    (expected.byteLength === undefined || actual.byteLength === expected.byteLength) &&
    (expected.contentType === undefined || actual.contentType === expected.contentType)
}

export async function runSfFilesRealMatrix(
  transport: SfTransport, cases: SfFilesRealMatrix,
): Promise<Readonly<Record<keyof SfFilesRealMatrix, DriverResult>>> {
  const result: Record<string, DriverResult> = {}
  for (const key of ["allowed", "denied", "revoked", "stale", "oversize", "cancelled", "retry"] as const) {
    const item = cases[key]
    if (!item.sourceEvidenceRef || !item.sourceEvidenceRef.trim())
      throw new Error("SF_226_REAL_SOURCE_EVIDENCE_REQUIRED")
    const operation = SfFiles.operations[item.operation]
    // Only the actual original producer response determines the observation.
    const received = await transport.execute(operation as never, item.input as never, item.options)
    const actual = outcome(received)
    result[key] = {
      actual, expected: item.expected, passed: matches(actual, item.expected),
      sourceEvidenceRef: item.sourceEvidenceRef,
    }
  }
  return result as Record<keyof SfFilesRealMatrix, DriverResult>
}
