/** Names identify canonical fixture records; tests discover producer references from rendered rows. */
export const waveFourProcurementData = {
  suppliers: {
    primary: "Design test data · Regional technology and field services",
    alternative: "Design test data · Infrastructure sourcing partner",
    restricted: "Design test data · Legacy service provider",
    created: "Design test data · New regional support supplier",
  },
  requests: {
    draft: "Design test data · Regional service renewal awaiting an estimate",
    zero: "Design test data · Recorded zero estimate for review",
    prApproval: "Design test data · Service continuity requisition",
    sourcing: "Design test data · Compare regional support quotations",
    sourceApproval: "Design test data · Sourcing selection awaiting review",
    poApproval: "Design test data · Infrastructure purchase order approval",
    issued: "Design test data · Issued regional service order",
    created: "Design test data · New regional maintenance request",
  },
  description: "Design test data · Regional delivery and support services with documented acceptance criteria.",
  revisedDescription: "Design test data · Regional delivery, support and an agreed continuity review.",
  justification: "Design test data · Maintain continuity across the regional delivery programme.",
  supplierNote: "Design test data · Commercial details reviewed with the regional service owner.",
  evaluator: "Technical evaluator",
} as const
