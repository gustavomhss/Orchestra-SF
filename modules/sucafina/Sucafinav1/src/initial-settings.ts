export function legalInitialSettings() {
  return {
    currency: "USD",
    levels: [
      { id: "L1", name: "CIO-1 (Level 1)", threshold: 0, holderId: null as string | null },
      { id: "L2", name: "CIO (Level 2)", threshold: 30000, holderId: null as string | null },
    ],
    prApprovalMode: "first" as const,
    blockSelfApproval: false,
    fxRates: [
      { code: "USD", rate: 1 },
      { code: "EUR", rate: 1.08 },
      { code: "CHF", rate: 1.13 },
      { code: "GBP", rate: 1.28 },
      { code: "BRL", rate: 0.18 },
      { code: "SGD", rate: 0.75 },
    ],
  }
}

export function initialProcurementSettings() {
  return {
    ...legalInitialSettings(),
    minQuotes: 3,
    techWeight: 60,
    commWeight: 40,
    fxUpdated: "",
    commCriteria: [
      { name: "Price (calculated — lowest offer scores highest)", weight: 70, auto: true },
      { name: "Payment terms", weight: 15 },
      { name: "Contract terms & flexibility", weight: 15 },
    ],
    criteria: [
      { name: "Functional / technical fit", weight: 35 },
      { name: "Quality & references", weight: 20 },
      { name: "Delivery & implementation plan", weight: 15 },
      { name: "Support & SLA", weight: 15 },
      { name: "Supplier risk & compliance", weight: 15 },
    ],
    paymentTerms: [
      "Net 30",
      "Net 45",
      "Net 60",
      "Net 90",
      "30% upfront / 70% on delivery",
      "50% upfront / 50% on acceptance",
      "Monthly in arrears",
      "Quarterly in advance",
      "Annual in advance",
    ],
    incoterms: ["N/A (service)", "EXW", "FCA", "CPT", "CIP", "DAP", "DPU", "DDP"],
    categories: [
      "Hardware",
      "Software licences",
      "SaaS subscription",
      "Professional services",
      "Managed services",
      "Telecom & network",
      "Training",
      "Other",
    ],
    billingAddress: "",
    defaultDeliveryAddress: "",
    requireActiveSupplier: false,
    uploadCap: null,
    reminderDays: null,
    escalationDays: null,
  }
}
