import type { Actor, Snapshot } from "../../runtime/contract.ts"
import { digestSfEvidenceRef, digestSfValue } from "../contracts/canonical.ts"
import type { PreparedChange } from "../contracts/decisions.ts"
import type { ProcurementPort } from "../contracts/ports.ts"
import type { ProcurementSourceHost } from "./port.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import { createProcurementPreparedReview } from "./prepared-review.ts"
import { prepareProcurementMutation, procurementPreparedRevision, procurementPreparedScope, staleProcurementPreparedMutation } from "./prepared.ts"
import { createProcurementScenarioPreparation } from "./scenario-preparation.ts"
import type { createProcurementSourceResolver } from "./sources.ts"

/** Private WP11 composition; authorization and human confirmation remain with the host. */
export function createProcurementC12Bridge(input: { host: ProcurementSourceHost; port: ProcurementPort; individual: ReturnType<typeof createProcurementSourceResolver> }) {
  return {
    prepareScenario: createProcurementScenarioPreparation({ host: input.host, sources: input.individual }),
    reviewDomain: createProcurementPreparedReview({ port: input.port, individual: input.individual }),
    resolveMutation(snapshot: Snapshot, change: PreparedChange, actor: Actor, binding: TrustedDomainContext) {
      const command = change.operation
      if (change.target.surface !== "procurement" || digestSfValue(command.target) !== digestSfValue(change.target) || command.expectedVersion !== change.expectedVersion || command.idempotencyKey !== change.idempotencyKey) return undefined
      const references = command.preview.values.flatMap((value) => value.sourceRefs)
      const evidence = references[0]
      if (!evidence || evidence.kind !== "record" || evidence.refDigest !== digestSfEvidenceRef(evidence) || evidence.installationId !== binding.binding.installationId || evidence.projectId !== binding.binding.projectId || evidence.target.surface !== change.target.surface || evidence.target.recordType !== change.target.type || evidence.target.recordId !== change.target.id || evidence.target.incarnation !== change.target.incarnation || evidence.target.version !== change.target.version || digestSfValue(evidence.target.fields) !== digestSfValue(change.target.fields) || digestSfValue(evidence.target.period) !== digestSfValue(change.target.period) || command.preview.values.some((value) => value.sourceRefs.length !== 1) || references.some((ref) => digestSfValue(ref) !== digestSfValue(evidence))) return undefined
      const scope = procurementPreparedScope(snapshot, change.target, binding)
      if (!scope) return staleProcurementPreparedMutation(snapshot, actor, binding, command)
      const rebuilt = prepareProcurementMutation({ snapshot, actor, context: binding, target: change.target, scope, evidence, command: command.command, operationId: command.id, idempotencyKey: change.idempotencyKey, environment: { at: change.target.observedAt, id: () => "", directory: [] } })
      return rebuilt?.mutation.commandDigest === command.commandDigest ? rebuilt.mutation : undefined
    },
    receiptVersion(snapshot: Snapshot, change: PreparedChange) {
      return change.target.surface === "procurement" ? procurementPreparedRevision(snapshot, change.operation.command) : undefined
    },
  }
}
