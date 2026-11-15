/**
 * W12 leaf copy fragment. I00 registers it in the shared typed dictionaries;
 * W12 never edits the shared i18n registry. Legacy producer labels retain their
 * original English in pt-BR until a pinned translation is available (COPY-01).
 */
export const SF_U10_QUEUE_COPY = {
  "sf.u10.queue.caption": "Procurement requests",
  "sf.u10.queue.filters": "Filters",
  "sf.u10.queue.all": "All",
  "sf.u10.queue.search": "Search",
  "sf.u10.queue.request": "Request",
  "sf.u10.queue.subject": "Subject",
  "sf.u10.queue.status": "Status",
  "sf.u10.queue.stage": "Decision",
  "sf.u10.queue.holder": "Holder",
  "sf.u10.queue.waiting": "Waiting since",
  "sf.u10.queue.next": "Next step",
  "sf.u10.queue.amount": "Amount",
  "sf.u10.queue.reason": "Reason",
  "sf.u10.queue.version": "Version",
  "sf.u10.queue.unassigned": "Unassigned",
  "sf.u10.queue.unresolvedHolder": "Responsible person not resolved",
  "sf.u10.queue.days": "days",
  "sf.u10.queue.noTitle": "Unavailable",
  "sf.u10.queue.status.draft": "Requisition draft",
  "sf.u10.queue.status.pr_pending": "Requisition approval",
  "sf.u10.queue.status.pr_rejected": "Requisition rejected",
  "sf.u10.queue.status.sourcing": "Sourcing",
  "sf.u10.queue.status.src_pending": "Sourcing approval",
  "sf.u10.queue.status.src_rejected": "Sourcing rejected",
  "sf.u10.queue.status.po_draft": "Purchase order draft",
  "sf.u10.queue.status.po_pending": "Purchase order approval",
  "sf.u10.queue.status.po_rejected": "Purchase order rejected",
  "sf.u10.queue.status.po_approved": "Purchase order approved",
  "sf.u10.queue.status.po_issued": "Issued internally",
  "sf.u10.queue.status.cancelled": "Cancelled",
} as const

export type SfU10QueueCopyKey = keyof typeof SF_U10_QUEUE_COPY

export const SF_U10_QUEUE_COPY_BR: Record<SfU10QueueCopyKey, string> = {
  ...SF_U10_QUEUE_COPY,
}
