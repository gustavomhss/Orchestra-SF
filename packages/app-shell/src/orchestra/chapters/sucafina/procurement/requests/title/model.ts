import type { SfContextStamp, SfRef } from "@orchestra/schema/sucafina/context"

// U11 P0 reads the A03 authorized CAP25 projection. Never read private snapshots or HTML.
export type SfRequestTitleRecord = Readonly<{
  ref: SfRef
  title: string
  status: string
  version: number
  canSave: boolean
}>

export type SfRequestTitleRead =
  | Readonly<{ kind: "ready"; record: SfRequestTitleRecord }>
  | Readonly<{ kind: "denied" | "unauthenticated" | "unavailable" | "stale" | "invalid" }>

function record(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

export function decodeSfRequestTitlePage(
  response: unknown,
  requestRef: SfRef,
  expected: SfContextStamp,
  saveAdmittedInContext: boolean,
): SfRequestTitleRead {
  const envelope = record(response)
  if (!envelope) return { kind: "invalid" }
  if (envelope.status === "unauthenticated") return { kind: "unauthenticated" }
  if (envelope.status === "denied") return { kind: "denied" }
  if (envelope.status === "unavailable") return { kind: "unavailable" }
  if (envelope.status === "stale") return { kind: "stale" }
  if (envelope.status !== "ok") return { kind: "invalid" }

  // F01 already validates the context. A projection from any other owner/access
  // revision is never republished, including during late-response races.
  const stamp = record(envelope.context)
  if (!stamp || stamp.installationId !== expected.installationId ||
      stamp.projectId !== expected.projectId || stamp.hostId !== expected.hostId ||
      stamp.principalRef !== expected.principalRef ||
      stamp.policyVersion !== expected.policyVersion ||
      stamp.accessRevision !== expected.accessRevision) return { kind: "stale" }

  const projection = record(envelope.value)
  const data = record(projection?.data)
  const versions = record(projection?.versions)
  const actionIds = projection?.allowedActionIds
  if (projection?.capabilityId !== "CAP25" || !data || !versions ||
      !Array.isArray(data.requests) || !Array.isArray(actionIds) ||
      !actionIds.every((action) => typeof action === "string")) return { kind: "invalid" }

  const requested = data.requests.map(record).find((row) => row?.number === requestRef)
  // Absence in a projection (which may be filtered or partial) is NOT evidence
  // that the record has been deleted or that a second actor may infer its existence.
  if (!requested) return { kind: "unavailable" }
  const pr = record(requested.pr)
  const versionRow = record(versions["requests:" + requestRef])
  const version = versionRow?.version
  if (typeof pr?.title !== "string" ||
      typeof requested.status !== "string" ||
      typeof version !== "number" || !Number.isSafeInteger(version) || version < 0)
    return { kind: "invalid" }

  const inDraft = requested.status === "draft" || requested.status === "pr_rejected"
  return {
    kind: "ready",
    record: {
      ref: requestRef,
      title: pr.title,
      status: requested.status,
      version,
      canSave: inDraft && saveAdmittedInContext && actionIds.includes("save"),
    },
  }
}

// A03 fixes page/action in its operation registration; these are the ONLY
// mutable fields supplied by U11 P0. Never forward a full PR or a prior form.
export function sfRequestTitleSaveInput(record: SfRequestTitleRecord, title: string) {
  return {
    page: "Requests",
    action: "save",
    id: record.ref,
    version: record.version,
    values: { pr: { title } },
  } as const
}

export function sfRequestTitleSaveCanonicalBody(record: SfRequestTitleRecord, title: string) {
  return sfRequestTitleSaveInput(record, title)
}

export function isSfRequestTitleSaveAccepted(value: unknown): boolean {
  return record(value)?.ok === true
}
