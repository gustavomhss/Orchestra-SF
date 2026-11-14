import { digestSfValue } from "../contracts/canonical.ts"
import type { ConfirmationRecord, ConfirmationScope } from "../contracts/context.ts"

/** A review obligation belongs to the material scope, not to one confirmation attempt. */
export function confirmationWorkIdentity(scope: ConfirmationScope) {
  return `sf:confirmation-work:${digestSfValue({ sourceRef: scope.sourceRef, fields: [...scope.fields].sort(), period: scope.period })}`
}

/** New dependency manifests supersede the old review of the same fields and period. */
export function latestConfirmationWork(records: readonly ConfirmationRecord[]) {
  const latest = new Map<string, ConfirmationRecord>()
  for (const record of records.toSorted((a, b) => a.confirmedAt.localeCompare(b.confirmedAt))) {
    latest.set(confirmationWorkIdentity(record.scope), record)
  }
  return [...latest.entries()].map(([actionRef, record]) => ({ actionRef, record }))
}
