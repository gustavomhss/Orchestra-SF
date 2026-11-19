/** Only this manifest changes between diagnostic snapshots; test/probe bytes stay fixed.
 * state-provider.ts was re-pinned after #279 added the one-time absent-state
 * bootstrap. The diff is additive initialization, not a read-path change;
 * the historic receipt and terminal review keep their original bytes. */
export const diagnosticExpected = {
  label: "improved",
  producers: {
    "product/host-binding/state-provider.ts": "ba10043704bbb1a25eb0f4a8edddcdca814ec7610157bc7c4d9d88d2970467f5",
    "product/decisions/result-store.ts": "b0c72001c952dacd45fe518cece15ebe9fedc5629f4463a37dde3c95feb8e7de",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
