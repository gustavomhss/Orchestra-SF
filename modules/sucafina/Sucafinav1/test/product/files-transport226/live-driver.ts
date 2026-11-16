import type { SfTransport, SfCallOptions } from "../../../../../../packages/client/src/sucafina/transport"
import type { SfTransportResult } from "../../../../../../packages/schema/src/sucafina/common"
import { SfFiles } from "../../../../../../packages/schema/src/sucafina/files"

/**
 * Real-source driver for 223. It accepts only an installed, authenticated
 * transport and selected inputs captured from the ORIGINAL product producer.
 * It never creates a Request, file content, identity, scan verdict or grant.
 * The driver does not run autonomously and is NOT release evidence.
 */
export type SfFilesRealInput = Readonly<{
  operation: keyof typeof SfFiles.operations
  input: unknown
  options: SfCallOptions
  expected: "response" | "contract-unavailable" | "invalid-response" |
    "contract-mismatch" | "aborted" | "outcome-unknown"
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

function outcome<Output>(value: SfTransportResult<Output>) {
  return value.kind === "response" ? "response" : value.reason
}

/** The caller supplies actual selected source inputs for every scenario. */
export async function runSfFilesRealMatrix(
  transport: SfTransport, cases: SfFilesRealMatrix,
): Promise<Readonly<Record<keyof SfFilesRealMatrix, { actual: string; expected: string; passed: boolean }>>> {
  const result: Record<string, { actual: string; expected: string; passed: boolean }> = {}
  for (const key of ["allowed", "denied", "revoked", "stale", "oversize", "cancelled", "retry"] as const) {
    const item = cases[key]
    const operation = SfFiles.operations[item.operation]
    // No fabricated expected output. The actual outcome comes from the real
    // producer and is compared to the independent original-source oracle.
    const received = await transport.execute(operation as never, item.input as never, item.options)
    const actual = outcome(received)
    result[key] = { actual, expected: item.expected, passed: actual === item.expected }
  }
  return result as Record<keyof SfFilesRealMatrix, { actual: string; expected: string; passed: boolean }>
}
