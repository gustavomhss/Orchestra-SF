/** Only this manifest changes between diagnostic snapshots; test/probe bytes stay fixed.
 * #279 added one-time absent-state bootstrap. Commit c00b150b48f576a79a7c8b33f15c4fb55d72dfd1
 * then admitted preferences/receipts in selectSfNamespaceHealth; those two
 * admission lines reproduce the complete producer diff from its parent.
 * Re-pin the actual producer bytes for a new diagnostic run. The read path,
 * historic receipt and terminal review keep their original bytes.
 * #438 adds bounded historical sibling observation in result-store.ts. Its
 * exact code blob 3db6208beac0493c9a2997cda784c80b4132b687 was qualified by
 * run 44670811024 (21/0), source 53df24e94fccd448d36e7512ff7bde250def9241.
 * Bind those actual bytes; this diagnostic's workload, probe and counters
 * remain unchanged and do not claim a portfolio performance improvement. */
export const diagnosticExpected = {
  label: "improved",
  producers: {
    "product/host-binding/state-provider.ts": "bf0a5639bd41f903c67a89096b733269fbcd9eaf25392dde8c062fdcc13434c1",
    "product/decisions/result-store.ts": "d35d43b872eee637c913397ec72157757fba9c4daa29d8a9dee499b030879722",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
