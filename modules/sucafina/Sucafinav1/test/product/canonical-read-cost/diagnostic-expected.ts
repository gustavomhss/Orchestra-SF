/** Only this manifest changes between diagnostic snapshots; test/probe bytes stay fixed.
 * #279 added one-time absent-state bootstrap. Commit c00b150b48f576a79a7c8b33f15c4fb55d72dfd1
 * then admitted preferences/receipts in selectSfNamespaceHealth; those two
 * admission lines reproduce the complete producer diff from its parent.
 * Re-pin the actual producer bytes for a new diagnostic run. The read path,
 * historic receipt and terminal review keep their original bytes. */
export const diagnosticExpected = {
  label: "improved",
  producers: {
    "product/host-binding/state-provider.ts": "bf0a5639bd41f903c67a89096b733269fbcd9eaf25392dde8c062fdcc13434c1",
    "product/decisions/result-store.ts": "b0c72001c952dacd45fe518cece15ebe9fedc5629f4463a37dde3c95feb8e7de",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
