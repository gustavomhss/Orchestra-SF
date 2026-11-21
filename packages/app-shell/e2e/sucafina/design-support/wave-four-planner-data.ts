/** Stable labels for records accepted by the original producers in the isolated installation. */
export const waveFourPlannerData = {
  headcount: {
    position: "Design test data · Regional infrastructure engineer",
    partial: "Design test data · Applications specialist for regional reporting and financial integration",
    unpriced: "Design test data · Service delivery vacancy",
    rate: "Design test data · Regional engineering rate",
    zeroRate: "Design test data · Recorded zero rate",
    rateAnnual: 132000,
  },
  allocations: {
    entity: "Design test data · Regional services",
    secondEntity: "Design test data · Group operations",
    allocation: "Design test data · Shared infrastructure allocation",
    classification: "Design test data · Unconfigured allocation",
    description: "Design test data · Original allocation across two legal entities.",
  },
  fx: {
    currency: "EUR",
    rate: 1.08,
    provider: "Design test data · Treasury observation",
    sourceRef: "design-test-data:treasury:eur-observation",
    missingCurrency: "BRL",
  },
  views: {
    id: "design-wave-four-planner-view",
    title: "Design test data · Planning workspace",
    revised: "Design test data · Planning workspace reviewed",
  },
} as const
