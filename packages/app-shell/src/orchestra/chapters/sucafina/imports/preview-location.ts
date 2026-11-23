import type { SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"

type Detail = Extract<SfFilesOperationOutput<"files.import-detail">, { status: "ok" }>["value"]
export type ImportPreviewChange = Detail["detail"]["changes"][number]

/** Both original import producers name a gap as the exact change path plus its
 * before/after side. Match only a unique admitted change; do not parse IDs,
 * reconstruct a business name, or borrow provenance from a similar path. */
export function importGapLocation(
  field: string,
  changes: readonly ImportPreviewChange[],
): Readonly<{ change: ImportPreviewChange; side: "before" | "after" }> | undefined {
  const matches = changes.flatMap((change) =>
    (["before", "after"] as const).flatMap((side) =>
      field === change.path + ":" + side ? [{ change, side }] : []))
  return matches.length === 1 ? matches[0] : undefined
}
