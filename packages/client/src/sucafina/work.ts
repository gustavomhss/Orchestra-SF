/**
 * A12 closed typed bindings, retaining the original nine operation IDs.
 * The transport owns origin/mount/credentials, response validation, no-store,
 * POST read Idempotency-Key and mutation outcome-unknown semantics.
 * No alternative REST path, client cache, view storage or automatic retry.
 */
import { SfWork } from "@orchestra/schema/sucafina/work"
import type { SfOperation, SfTransportResult } from "@orchestra/schema/sucafina/common"
import type { SfTransport, SfCallOptions } from "./transport"

function v2Requested(value: unknown): boolean {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false
  const input = value as { schemaVersion?: unknown; input?: unknown }
  if (input.schemaVersion === 2) return true
  if (!input.input || typeof input.input !== "object" || Array.isArray(input.input)) return false
  const inner = input.input as { schemaVersion?: unknown; view?: unknown }
  if (inner.schemaVersion === 2) return true
  return !!inner.view && typeof inner.view === "object" && !Array.isArray(inner.view) &&
    (inner.view as { schemaVersion?: unknown }).schemaVersion === 2
}

export function createSfWorkClient(transport: SfTransport) {
  const read = <Input, Output>(operation: SfOperation<Input, Output>) =>
    (input: Input, options: SfCallOptions): Promise<SfTransportResult<Output>> =>
      transport.execute(operation, input, options)

  // Until product/interface/personal-views.ts publishes the real V2 producer,
  // an opt-in V2 request fails *before transport*. The V1 wire is untouched.
  const viewsV1 = <Input, Output>(operation: SfOperation<Input, Output>) =>
    (input: Input, options: SfCallOptions): Promise<SfTransportResult<Output>> =>
      v2Requested(input)
        ? Promise.resolve({ kind: "transport-error", reason: "contract-unavailable" })
        : transport.execute(operation, input, options)

  return {
    "projection.home": read(SfWork.operations["projection.home"]),
    "projection.search": read(SfWork.operations["projection.search"]),
    "projection.work": read(SfWork.operations["projection.work"]),
    "projection.work-item": read(SfWork.operations["projection.work-item"]),
    "projection.work-selection": read(SfWork.operations["projection.work-selection"]),
    "views.list": viewsV1(SfWork.operations["views.list"]),
    "views.open": viewsV1(SfWork.operations["views.open"]),
    "views.remove": viewsV1(SfWork.operations["views.remove"]),
    "views.save": viewsV1(SfWork.operations["views.save"]),
  } as const
}

export type SfWorkClient = ReturnType<typeof createSfWorkClient>
