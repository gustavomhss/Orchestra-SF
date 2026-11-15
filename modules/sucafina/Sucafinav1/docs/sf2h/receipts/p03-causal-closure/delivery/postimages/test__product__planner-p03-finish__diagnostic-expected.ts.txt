/** Only this manifest changes between diagnostic snapshots; test/probe bytes stay fixed. */
export const diagnosticExpected = {
  label: "p03-causal-closure99",
  producers: {
    "product/host-binding/state-provider.ts": "acc07d5f12aa1818a72d6ab9ac8ced36489739485d661d72b5a02249d5d34b8f",
    "product/decisions/result-store.ts": "3f238642d247269a807353378a7d5f68b9c36c9ca5deb7a2a13be3d8f00ae6e5",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
