// Local UI affordances only; server admission, ACL and scanner remain authoritative.
import type { SfAttachment, SfAttachmentFieldProps, SfFileAdmission } from "../evidence/types"

export function canAdmitSelected(
  state: SfFileAdmission,
  formats: SfAttachmentFieldProps["acceptedFormats"],
  limit: SfAttachmentFieldProps["limit"],
  attachments: readonly SfAttachment[],
): boolean {
  if (state.kind !== "selected") return false
  if (!Number.isSafeInteger(limit.maxBytes) || limit.maxBytes <= 0) return false
  if (!Number.isSafeInteger(limit.maxFiles) || limit.maxFiles <= 0) return false
  if (!Number.isSafeInteger(state.bytes) || state.bytes <= 0 || state.bytes > limit.maxBytes) return false
  if (attachments.filter((item) => item.status === "admitted").length >= limit.maxFiles) return false
  const ext = state.fileName.match(/\.([A-Za-z0-9]+)$/)?.[1]?.toLowerCase()
  if (!ext) return false
  return formats.some((format) =>
    format.mediaType.toLowerCase() === state.mediaType.toLowerCase() &&
    format.extensions.some((suffix) => suffix.replace(/^\*?\./, "").toLowerCase() === ext),
  )
}

// Even a true UI capability is only an affordance; the parent/producer reauthorizes
// on every download with the original record/version and never trusts this result.
export function canRequestDownload(item: SfAttachment): boolean {
  return item.status === "admitted" && item.canDownload === true
}
export function canRequestReferenceRemoval(item: SfAttachment): boolean {
  return item.status === "admitted" && item.canRemoveReference === true
}
