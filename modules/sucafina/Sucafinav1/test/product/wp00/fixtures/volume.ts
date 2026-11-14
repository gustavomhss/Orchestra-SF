import corpus from "./corpus-v2.json"

/** Synthetic input recipe shared by domain checks and later browser measurements. */
export function createVolumeCorpus() {
  const counts = corpus.datasets.volume.datasets
  return {
    financial: Array.from({ length: counts.financial_lines }, (_, index) => ({
      id: `synthetic-financial-${index + 1}`,
      year: 2027,
      month: index % 12 + 1,
      ownerId: "synthetic-owner",
      actual: 1,
      forecast: 2,
    })),
    purchaseOrders: Array.from({ length: counts.purchase_orders }, (_, index) => ({
      number: `synthetic-po-${index + 1}`,
      status: "sourcing",
      createdBy: "synthetic-buyer",
      prApprovalBaseCurrency: "USD",
      pr: { estAmount: index + 1 },
    })),
    projects: Array.from({ length: counts.projects }, (_, index) => ({
      id: `synthetic-project-${index + 1}`,
      name: `Synthetic volume project ${index + 1}`,
      budget: index + 1,
    })),
  }
}
