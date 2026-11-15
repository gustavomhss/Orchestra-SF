/** Only this manifest changes between diagnostic snapshots; test/probe bytes stay fixed. */
export const diagnosticExpected = {
  label: "improved",
  producers: {
    "product/host-binding/state-provider.ts": "edfd0547919597e0e79e4dbe15670eab2797399cab4c8f627e0a26a8045d8cab",
    "product/decisions/result-store.ts": "b0c72001c952dacd45fe518cece15ebe9fedc5629f4463a37dde3c95feb8e7de",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
