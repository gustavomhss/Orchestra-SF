/** Only this manifest changes between diagnostic snapshots; test/probe bytes stay fixed. */
export const diagnosticExpected = {
  label: "baseline",
  producers: {
    "product/host-binding/state-provider.ts": "edfd0547919597e0e79e4dbe15670eab2797399cab4c8f627e0a26a8045d8cab",
    "product/decisions/result-store.ts": "576dc47430a6072d094c98d4c319d6659f8b58d07a201dc1a50d47bc34679a59",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
