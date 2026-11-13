import type { PreparedCommand } from "../contracts/context.ts"
import type { DecisionCase, PreparedChange, ScenarioResult } from "../contracts/decisions.ts"

/** The command and preview must already come from the authorized target-domain producer. */
export function prepareDomainChange(input: {
  case: Pick<DecisionCase, "id" | "version" | "choices" | "currency" | "horizon">
  expectedCaseVersion: number
  choiceId: string
  command: PreparedCommand
  preview: ScenarioResult
  id: string
}): { status: "ok"; change: PreparedChange } | { status: "conflict"; reason: string } {
  if (input.case.version !== input.expectedCaseVersion) return { status: "conflict", reason: "case-changed" }
  if (!input.case.choices.some((choice) => choice.id === input.choiceId)) return { status: "conflict", reason: "choice-unavailable" }
  if (!input.id.trim() || !input.command.id.trim() || !input.command.idempotencyKey.trim() || !/^[a-f0-9]{64}$/.test(input.command.commandDigest) || !input.command.target.id.trim() || !input.command.target.incarnation.trim() || !Number.isSafeInteger(input.command.expectedVersion) || input.command.expectedVersion < 0 || input.command.target.version !== input.command.expectedVersion || input.command.command.version !== input.command.expectedVersion || input.command.command.confirmed === true) return { status: "conflict", reason: "invalid-domain-command" }
  if (input.preview.currency !== input.case.currency || input.preview.horizon.start !== input.case.horizon.start || input.preview.horizon.end !== input.case.horizon.end) return { status: "conflict", reason: "preview-basis-mismatch" }
  return { status: "ok", change: structuredClone({ id: input.id, caseId: input.case.id, caseVersion: input.case.version, choiceId: input.choiceId, target: input.command.target, expectedVersion: input.command.expectedVersion, operation: input.command, preview: input.preview, requiredAuthority: input.command.requiredAuthority, idempotencyKey: input.command.idempotencyKey, state: "planned" as const }) }
}
