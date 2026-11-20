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
 * remain unchanged and do not claim a portfolio performance improvement.
 * #442 adds authenticated pre-COMMIT rollback provenance and a guarded abort
 * journal. State-provider blob dc0c55245b805f9290f3798100ba6a6fd5fa88ed passed
 * run 44673967393 (18/0), source 32c97d3b4de5bb7960ca42f816b11ea37f594541,
 * snapshot 24f4bfc7c4671ff69b90961da988419b8f7c6cff and reviewed head
 * 63d0e237cc0bb4bef5c35114e24d874d353fd214; merged as
 * 45514008d7ce275327003c5d92faaeeab2479739. Bind only those actual producer
 * bytes; diagnostic outputs, workload and counters remain unchanged.
 * The composed C8 diagnostic is a separate qualification. */
export const diagnosticExpected = {
  label: "improved",
  producers: {
    "product/host-binding/state-provider.ts": "bd90848a7e75e62d457901666d6dfc6409e9ce3578092958ee9e794bb210a141",
    "product/decisions/result-store.ts": "d35d43b872eee637c913397ec72157757fba9c4daa29d8a9dee499b030879722",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
