/** Only this manifest changes between diagnostic snapshots; test/probe bytes stay fixed. */
export const diagnosticExpected = {
  label: "p03-causal-closure99",
  producers: {
    "product/host-binding/state-provider.ts": "ad281c453361fd1015c0bfce9a3421eda65bda21f8848d8ac3a2c3cccfc38939",
    "product/decisions/result-store.ts": "3f238642d247269a807353378a7d5f68b9c36c9ca5deb7a2a13be3d8f00ae6e5",
    "product/decisions/criterion-comparison.ts": "0faeabe7da29ded1a5f1297fa4ad9d86190f63042a10622900c9b40cd035b4ef",
  },
} as const
