import type { SfU10QueueCopyKey } from "./queues/copy"

const statusLabels: Readonly<Record<string, SfU10QueueCopyKey>> = {
  draft: "sf.u10.queue.status.draft",
  pr_pending: "sf.u10.queue.status.pr_pending",
  pr_rejected: "sf.u10.queue.status.pr_rejected",
  sourcing: "sf.u10.queue.status.sourcing",
  src_pending: "sf.u10.queue.status.src_pending",
  src_rejected: "sf.u10.queue.status.src_rejected",
  po_draft: "sf.u10.queue.status.po_draft",
  po_pending: "sf.u10.queue.status.po_pending",
  po_rejected: "sf.u10.queue.status.po_rejected",
  po_approved: "sf.u10.queue.status.po_approved",
  po_issued: "sf.u10.queue.status.po_issued",
  cancelled: "sf.u10.queue.status.cancelled",
}

/** Display only: source codes remain unchanged in filters, commands and detail metadata. */
export function procurementStatusLabel(value: string, t: (key: SfU10QueueCopyKey) => string): string {
  const label = statusLabels[value]
  return label ? t(label) : value
}
