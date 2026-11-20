import type { SfReadableContext } from "@orchestra/schema/sucafina/context"

export function operationGranted(context: SfReadableContext | undefined, operationId: string) {
  return !!context?.availability.some((entry) =>
    entry.operations.some((operation) =>
      operation.operationId === operationId && operation.state === "ready" && operation.operational))
}
