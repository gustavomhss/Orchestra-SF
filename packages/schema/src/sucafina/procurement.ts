import { Schema } from "effect"
import { optional } from "../schema"
import type { SfContextStamp } from "./context"

// A03 public boundary. All values below are projected from the current authorized
// Procurement producer; nothing here performs currency, approval or policy logic.
const NonEmpty = Schema.NonEmptyString
const NonNegativeInteger = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const PositiveInteger = Schema.Int.check(Schema.isGreaterThan(0))
const Amount = Schema.NullOr(Schema.Finite)
const NumericInput = Schema.Union([Schema.Finite, Schema.String, Schema.Null])
const BooleanInput = Schema.Union([Schema.Boolean, Schema.Literals(["true", "false", "on"])])
const Version = Schema.Struct({ version: NonNegativeInteger, by: Schema.String })
const Period = Schema.Struct({ start: Schema.String, end: Schema.String })
const CaseRef = Schema.Struct({ id: NonEmpty, incarnation: NonEmpty, version: PositiveInteger }).annotate({ parseOptions: { onExcessProperty: "error" } })
const SourceRef = Schema.Struct({
  surface: Schema.Literals(["dashboard", "planner", "procurement"]),
  type: Schema.String, id: Schema.String, incarnation: Schema.String,
  version: NonNegativeInteger, fields: Schema.Array(Schema.String),
  period: Period, observedAt: Schema.String,
})
const EvidenceRecord = Schema.Struct({
  schema: Schema.Literal("sf-evidence-v1"), kind: Schema.Literal("record"),
  refId: NonEmpty, installationId: NonEmpty, projectId: NonEmpty,
  refDigest: Schema.String, evidenceLevel: Schema.Literals(["observed", "claim", "assumption", "proposal", "decision"]),
  target: Schema.Struct({
    surface: Schema.Literals(["dashboard", "planner", "procurement"]),
    recordType: Schema.String, recordId: Schema.String, incarnation: Schema.String,
    version: NonNegativeInteger, fields: Schema.Array(Schema.String),
    period: Schema.optional(Period), projectionDigest: Schema.String,
  }),
})
const ApprovalStep = Schema.Struct({
  holderId: Schema.NullOr(Schema.String), status: Schema.String,
  levelName: Schema.optional(Schema.String),
})
const Approval = Schema.Struct({
  amount: Schema.Finite, steps: Schema.optional(Schema.Array(ApprovalStep)),
})
const Criterion = Schema.Struct({
  id: Schema.optional(Schema.String), name: Schema.optional(Schema.String),
  weight: Schema.optional(NumericInput), auto: Schema.optional(BooleanInput),
  required: Schema.optional(BooleanInput),
})
const Quote = Schema.Struct({
  id: Schema.optional(Schema.String),
  supplierId: Schema.optional(Schema.NullOr(Schema.String)),
  supplier: Schema.optional(Schema.String),
  currency: Schema.optional(Schema.String),
  total: Schema.optional(Amount),
  description: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  attachments: Schema.optional(Schema.Array(Schema.Struct({ id: Schema.optional(Schema.String), name: Schema.optional(Schema.String) }))),
  scores: Schema.optional(Schema.Union([Schema.Array(NumericInput), Schema.Record(Schema.String, NumericInput)])),
  cscores: Schema.optional(Schema.Union([Schema.Array(NumericInput), Schema.Record(Schema.String, NumericInput)])),
  techPass: Schema.optional(BooleanInput),
  qty: Schema.optional(NumericInput), unitPrice: Schema.optional(NumericInput),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const Requisition = Schema.Struct({
  title: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String),
  description: Schema.optional(Schema.String),
  estAmount: Schema.optional(NumericInput),
  costCenter: Schema.optional(Schema.String),
  needBy: Schema.optional(Schema.String),
  justification: Schema.optional(Schema.String),
  recurring: Schema.optional(BooleanInput),
  frequency: Schema.optional(Schema.String),
  estAnnual: Schema.optional(NumericInput),
  expenseType: Schema.optional(Schema.String),
  category: Schema.optional(Schema.String),
  requesterName: Schema.optional(Schema.String),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const QuoteComparison = Schema.Struct({
  id: Schema.NullOr(Schema.String),
  index: NonNegativeInteger,
  baseAmount: Schema.NullOr(Schema.Finite),
  baseCurrency: Schema.NullOr(Schema.String),
  fxRate: Schema.NullOr(Schema.Finite),
  fxBasis: Schema.NullOr(Schema.Literals(["base", "submitted FX", "current FX"])),
  baseFxText: Schema.String,
  rank: Schema.NullOr(Schema.Finite),
  premiumAmount: Schema.NullOr(Schema.Finite),
  premiumPercent: Schema.NullOr(Schema.Finite),
  excludedReason: Schema.NullOr(Schema.String),
  eligibility: Schema.optional(Schema.NullOr(Schema.String)),
  technical: Schema.optional(Schema.NullOr(Schema.Finite)),
  price: Schema.optional(Schema.NullOr(Schema.Finite)),
  commercial: Schema.optional(Schema.NullOr(Schema.Finite)),
  overall: Schema.optional(Schema.NullOr(Schema.Finite)),
  technicalText: Schema.optional(Schema.NullOr(Schema.String)),
  priceText: Schema.optional(Schema.NullOr(Schema.String)),
  commercialText: Schema.optional(Schema.NullOr(Schema.String)),
  overallText: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const SourcingComparison = Schema.Struct({
  eligibleCount: NonNegativeInteger,
  quotes: Schema.Array(QuoteComparison),
  rankLine: Schema.NullOr(Schema.String),
  premiumLine: Schema.NullOr(Schema.String),
  rankingUnavailable: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const Sourcing = Schema.Struct({
  quotes: Schema.optional(Schema.Array(Quote)),
  comparison: Schema.optional(SourcingComparison),
  evaluator: Schema.optional(Schema.String),
  selectedId: Schema.optional(Schema.NullOr(Schema.String)),
  fewQuotesJustification: Schema.optional(Schema.String),
  selectionJustification: Schema.optional(Schema.String),
  contractStrategy: Schema.optional(Schema.String),
  fxSnapshot: Schema.optional(Schema.NullOr(Schema.Record(Schema.String, Amount))),
  approvalBaseCurrency: Schema.optional(Schema.String),
  approval: Schema.optional(Schema.NullOr(Approval)),
  weights: Schema.optional(Schema.Struct({
    tech: Schema.optional(NumericInput), comm: Schema.optional(NumericInput),
    criteria: Schema.optional(Schema.Array(Criterion)),
    commCriteria: Schema.optional(Schema.Array(Criterion)),
  })),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const PurchaseLine = Schema.Struct({
  id: Schema.optional(Schema.String),
  desc: Schema.optional(Schema.String), description: Schema.optional(Schema.String),
  unit: Schema.optional(Schema.String), notes: Schema.optional(Schema.String),
  qty: Schema.optional(NumericInput), unitPrice: Schema.optional(NumericInput),
})
const PurchaseOrder = Schema.Struct({
  number: Schema.optional(Schema.String),
  currency: Schema.optional(Schema.String),
  expenseType: Schema.optional(Schema.String),
  supplier: Schema.optional(Schema.String),
  supplierId: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.String),
  lines: Schema.optional(Schema.Array(PurchaseLine)),
  paymentTerms: Schema.optional(Schema.String),
  deliveryDate: Schema.optional(Schema.String),
  deliveryConditions: Schema.optional(Schema.String),
  contractRef: Schema.optional(Schema.String),
  incoterm: Schema.optional(Schema.String),
  incoterms: Schema.optional(Schema.String),
  assetRef: Schema.optional(Schema.String),
  supplierContact: Schema.optional(Schema.String),
  quoteRef: Schema.optional(Schema.String),
  billingAddress: Schema.optional(Schema.String),
  deliveryAddress: Schema.optional(Schema.String),
  acceptance: Schema.optional(Schema.String),
  warranty: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
  fxRate: Schema.optional(Amount), approvalBaseCurrency: Schema.optional(Schema.String),
  approval: Schema.optional(Schema.NullOr(Approval)),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const HistoryEntry = Schema.Struct({
  at: Schema.String, by: Schema.String, action: Schema.String, note: Schema.String,
})
export const SfProcurementRequest = Schema.Struct({
  number: Schema.optional(Schema.String), status: Schema.String, createdBy: Schema.String,
  buyerId: Schema.optional(Schema.String), requesterName: Schema.optional(Schema.String),
  allowedDraftActions: optional(Schema.Array(Schema.Literals(["save-pr", "save-sourcing", "save-po"]))),
  pr: Schema.optional(Schema.NullOr(Requisition)),
  prApproval: Schema.optional(Schema.NullOr(Approval)),
  prApprovalBaseCurrency: Schema.optional(Schema.String),
  sourcing: Schema.optional(Schema.NullOr(Sourcing)),
  po: Schema.optional(Schema.NullOr(PurchaseOrder)),
  history: Schema.optional(Schema.Array(HistoryEntry)),
  attachments: Schema.optional(Schema.Array(Schema.Struct({
    id: Schema.String, name: Schema.String, key: Schema.String, type: Schema.String,
    bytes: NonNegativeInteger, size: NonNegativeInteger,
  }).annotate({ parseOptions: { onExcessProperty: "error" } }))),
  value: Schema.optional(Amount),
  monetaryState: Schema.optional(Schema.NullOr(Schema.String)),
  sourceRef: Schema.optional(Schema.NullOr(Schema.String)),
  sourceDigest: Schema.optional(Schema.NullOr(Schema.String)),
  moneySentence: Schema.optional(Schema.NullOr(Schema.String)),
  poEstimate: Schema.optional(Schema.NullOr(Schema.String)),
  orderDifference: Schema.optional(Schema.NullOr(Schema.String)),
  requestSummary: Schema.optional(Schema.NullOr(Schema.String)),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const BankField = Schema.String
const SupplierContact = Schema.Struct({
  name: Schema.optional(Schema.String), email: Schema.optional(Schema.String),
  phone: Schema.optional(Schema.String),
})
const SupplierSection = Schema.Struct({ notes: Schema.optional(Schema.String) })
export const SfProcurementSupplier = Schema.Struct({
  id: Schema.optional(Schema.String), number: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String), createdBy: Schema.optional(Schema.String),
  legalName: Schema.optional(Schema.String), tradingName: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String), country: Schema.optional(Schema.String),
  address: Schema.optional(Schema.String), taxId: Schema.optional(Schema.String),
  regNo: Schema.optional(Schema.String), contactName: Schema.optional(Schema.String),
  contactEmail: Schema.optional(Schema.String), contactPhone: Schema.optional(Schema.String),
  financeEmail: Schema.optional(Schema.String), paymentTerms: Schema.optional(Schema.String),
  currency: Schema.optional(Schema.String), incoterm: Schema.optional(Schema.String),
  riskRating: Schema.optional(Schema.String), dueDiligence: Schema.optional(BooleanInput),
  sanctionsDate: Schema.optional(Schema.String), nda: Schema.optional(BooleanInput),
  dpa: Schema.optional(BooleanInput), certifications: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  categories: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  contacts: Schema.optional(Schema.Array(SupplierContact)),
  commercial: Schema.optional(SupplierSection), compliance: Schema.optional(SupplierSection),
  notes: Schema.optional(Schema.String),
  iban: Schema.optional(BankField), account: Schema.optional(BankField),
  bankName: Schema.optional(BankField), swift: Schema.optional(BankField),
  accountHolder: Schema.optional(BankField), bankCountry: Schema.optional(BankField),
  validatedAt: Schema.optional(Schema.NullOr(Schema.String)),
  validatedBy: Schema.optional(Schema.NullOr(Schema.String)),
  history: Schema.optional(Schema.Array(Schema.Struct({ field: Schema.String }))),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const Level = Schema.Struct({
  id: Schema.String, name: Schema.String, threshold: NumericInput,
  holderId: Schema.NullOr(Schema.String),
})
const FxRate = Schema.Struct({ code: Schema.String, rate: NumericInput })
export const SfProcurementSettings = Schema.Struct({
  currency: Schema.optional(Schema.String),
  levels: Schema.optional(Schema.Array(Level)),
  prApprovalMode: Schema.optional(Schema.Literals(["first", "matrix"])),
  blockSelfApproval: Schema.optional(BooleanInput),
  fxRates: Schema.optional(Schema.Array(FxRate)),
  minQuotes: Schema.optional(NumericInput), techWeight: Schema.optional(NumericInput),
  commWeight: Schema.optional(NumericInput),
  criteria: Schema.optional(Schema.Array(Criterion)),
  commCriteria: Schema.optional(Schema.Array(Criterion)),
  requireActiveSupplier: Schema.optional(BooleanInput),
  paymentTerms: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  categories: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  incoterms: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  billingAddress: Schema.optional(Schema.String),
  defaultDeliveryAddress: Schema.optional(Schema.String),
  fxUpdated: Schema.optional(Schema.String),
  reminderDays: Schema.optional(NumericInput), escalationDays: Schema.optional(NumericInput),
  uploadCap: Schema.optional(NumericInput),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const Stamp = Schema.Struct({
  installationId: NonEmpty, projectId: NonEmpty, hostId: NonEmpty, principalRef: NonEmpty,
  policyVersion: Schema.String, accessRevision: Schema.String,
})
const PageSelection = Schema.Struct({
  year: Schema.optional(NonNegativeInteger), month: Schema.optional(PositiveInteger),
  filter: Schema.optional(Schema.String), q: Schema.optional(Schema.String),
  request: Schema.optional(Schema.String), supplier: Schema.optional(Schema.String),
  status: Schema.optional(Schema.String),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const RequestVersion = Schema.Record(Schema.String, Version)
const DirectoryEntry = Schema.Struct({ id: Schema.String, name: Schema.String })
const PublicSettings = SfProcurementSettings
const PageFailure = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({ status: Schema.Literal("unavailable"), reason: Schema.String }),
  Schema.Struct({ status: Schema.Literal("needs-input"), reason: Schema.String }),
  Schema.Struct({ status: Schema.Literal("stale"), reason: Schema.String }),
])
const DashboardData = Schema.Struct({
  requests: Schema.Array(SfProcurementRequest),
  formSettings: PublicSettings,
  metrics: Schema.Struct({
    edits: Schema.Literal(false),
    open: NonNegativeInteger,
    issued: Schema.Struct({ OPEX: Schema.Finite, CAPEX: Schema.Finite }),
    approved: Schema.Struct({ OPEX: Schema.Finite, CAPEX: Schema.Finite }),
    unavailable: Schema.Array(Schema.String),
  }),
})
const RequestsData = Schema.Struct({
  requests: Schema.Array(SfProcurementRequest),
  suppliers: Schema.Array(SfProcurementSupplier),
  directory: Schema.Array(DirectoryEntry),
  formSettings: PublicSettings,
  bankVerificationAvailable: Schema.Boolean,
})
const ApprovalGroup = Schema.Array(SfProcurementRequest)
const ApprovalsData = Schema.Struct({
  requests: Schema.Array(SfProcurementRequest),
  waitingForYou: ApprovalGroup, waitingForOthers: ApprovalGroup, unassigned: ApprovalGroup,
  directory: Schema.Array(DirectoryEntry), formSettings: PublicSettings,
})
const SuppliersData = Schema.Struct({
  suppliers: Schema.Array(SfProcurementSupplier),
  requests: Schema.Array(SfProcurementRequest),
  formSettings: PublicSettings,
  bankVerificationAvailable: Schema.Boolean,
})
const SettingsData = Schema.Struct({
  settings: SfProcurementSettings, directory: Schema.Array(DirectoryEntry),
})
function pageOutput<Capability extends "CAP24" | "CAP25" | "CAP26" | "CAP27" | "CAP28", Data>(
  capabilityId: Capability, data: Schema.Codec<Data>,
) {
  return Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"), context: Stamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal(capabilityId), selection: PageSelection,
        data, versions: RequestVersion, allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    PageFailure,
  ])
}
const Failure = Schema.Struct({
  ok: Schema.Literal(false),
  status: Schema.Literals([400, 403, 404, 409, 422, 503]),
  errors: Schema.optional(Schema.Array(Schema.String)),
  fieldErrors: Schema.optional(Schema.Array(Schema.Struct({ field: Schema.String, message: Schema.String }))),
  stored: Schema.optional(Schema.NullOr(Schema.Union([
    SfProcurementRequest, SfProcurementSupplier, SfProcurementSettings,
  ]))),
  by: Schema.optional(Schema.String), currentVersionCAS: Schema.optional(NonNegativeInteger),
})
const CommandResult = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), warnings: Schema.optional(Schema.Array(Schema.String)) }),
  Failure,
])
// Separate writable fieldsets from read projections: status/holder/snapshots,
// PO FX and immutable identifiers cannot be set by a native command payload.
const SourcingEdit = Schema.Struct({
  quotes: Schema.optional(Schema.Array(Quote)), evaluator: Schema.optional(Schema.String),
  selectedId: Schema.optional(Schema.NullOr(Schema.String)),
  fewQuotesJustification: Schema.optional(Schema.String),
  selectionJustification: Schema.optional(Schema.String),
  contractStrategy: Schema.optional(Schema.String),
  weights: Schema.optional(Schema.Struct({
    tech: Schema.optional(NumericInput), comm: Schema.optional(NumericInput),
    criteria: Schema.optional(Schema.Array(Criterion)),
    commCriteria: Schema.optional(Schema.Array(Criterion)),
  })),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const PurchaseOrderEdit = Schema.Struct({
  currency: Schema.optional(Schema.String), expenseType: Schema.optional(Schema.String),
  supplier: Schema.optional(Schema.String), supplierId: Schema.optional(Schema.NullOr(Schema.String)),
  description: Schema.optional(Schema.String), lines: Schema.optional(Schema.Array(PurchaseLine)),
  paymentTerms: Schema.optional(Schema.String), deliveryDate: Schema.optional(Schema.String),
  deliveryConditions: Schema.optional(Schema.String),
  contractRef: Schema.optional(Schema.String), incoterm: Schema.optional(Schema.String),
  incoterms: Schema.optional(Schema.String), assetRef: Schema.optional(Schema.String),
  supplierContact: Schema.optional(Schema.String), quoteRef: Schema.optional(Schema.String),
  billingAddress: Schema.optional(Schema.String), deliveryAddress: Schema.optional(Schema.String),
  acceptance: Schema.optional(Schema.String), warranty: Schema.optional(Schema.String),
  notes: Schema.optional(Schema.String),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const SupplierEdit = Schema.Struct({
  legalName: Schema.optional(Schema.String), tradingName: Schema.optional(Schema.String),
  type: Schema.optional(Schema.String), country: Schema.optional(Schema.String),
  address: Schema.optional(Schema.String), taxId: Schema.optional(Schema.String),
  regNo: Schema.optional(Schema.String), contactName: Schema.optional(Schema.String),
  contactEmail: Schema.optional(Schema.String), contactPhone: Schema.optional(Schema.String),
  financeEmail: Schema.optional(Schema.String), paymentTerms: Schema.optional(Schema.String),
  currency: Schema.optional(Schema.String), incoterm: Schema.optional(Schema.String),
  riskRating: Schema.optional(Schema.String), dueDiligence: Schema.optional(BooleanInput),
  sanctionsDate: Schema.optional(Schema.String), nda: Schema.optional(BooleanInput),
  dpa: Schema.optional(BooleanInput), certifications: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  categories: Schema.optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
  contacts: Schema.optional(Schema.Array(SupplierContact)),
  commercial: Schema.optional(SupplierSection), compliance: Schema.optional(SupplierSection),
  notes: Schema.optional(Schema.String),
  iban: Schema.optional(BankField), account: Schema.optional(BankField),
  bankName: Schema.optional(BankField), swift: Schema.optional(BankField),
  accountHolder: Schema.optional(BankField), bankCountry: Schema.optional(BankField),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const EmptyValues = Schema.Struct({}).annotate({ parseOptions: { onExcessProperty: "error" } })
const PrValues = Schema.Struct({ pr: Requisition }).annotate({ parseOptions: { onExcessProperty: "error" } })
const SourcingValues = Schema.Struct({ sourcing: SourcingEdit }).annotate({ parseOptions: { onExcessProperty: "error" } })
const PoValues = Schema.Struct({ po: PurchaseOrderEdit }).annotate({ parseOptions: { onExcessProperty: "error" } })
const SupplierValues = Schema.Struct({ supplier: SupplierEdit }).annotate({ parseOptions: { onExcessProperty: "error" } })
const SettingsValues = Schema.Struct({ settings: SfProcurementSettings }).annotate({ parseOptions: { onExcessProperty: "error" } })
const QuoteSelectionValues = Schema.Struct({ quoteId: NonEmpty }).annotate({ parseOptions: { onExcessProperty: "error" } })
const ApprovalValues = Schema.Struct({ comment: Schema.optional(Schema.String) }).annotate({ parseOptions: { onExcessProperty: "error" } })
const ReasonValues = Schema.Struct({ reason: Schema.String }).annotate({ parseOptions: { onExcessProperty: "error" } })
export const SfProcurementTitleSave = Schema.Struct({
  page: Schema.Literal("Requests"), action: Schema.Literal("save"),
  id: NonEmpty, version: NonNegativeInteger,
  values: Schema.Struct({
    pr: Schema.Struct({ title: Schema.String }).annotate({ parseOptions: { onExcessProperty: "error" } }),
  }).annotate({ parseOptions: { onExcessProperty: "error" } }),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const CommandValues = {
  Requests: {
    create: PrValues, save: Schema.Union([PrValues, SourcingValues, PoValues]),
    submit_pr: PrValues, submit_sourcing: SourcingValues,
    select_quote: QuoteSelectionValues, submit_po: PoValues,
    approve: ApprovalValues, reject: ReasonValues,
    issue: EmptyValues, cancel: ReasonValues, delete: EmptyValues,
  },
  "My approvals": {
    create: PrValues, save: Schema.Union([PrValues, SourcingValues, PoValues]),
    submit_pr: PrValues, submit_sourcing: SourcingValues,
    select_quote: QuoteSelectionValues, submit_po: PoValues,
    approve: ApprovalValues, reject: ReasonValues,
    issue: EmptyValues, cancel: ReasonValues, delete: EmptyValues,
  },
  Suppliers: {
    create: SupplierValues, save: SupplierValues, activate: EmptyValues,
    block: EmptyValues, inactivate: EmptyValues, delete: EmptyValues,
    "change-bank": SupplierValues,
  },
  Settings: { save: SettingsValues, reset: EmptyValues },
} as const
function domainCommand<Page extends string, Action extends string, Values>(
  page: Page, action: Action, values: Schema.Codec<Values>,
) {
  return Schema.Struct({
    page: Schema.Literal(page), action: Schema.Literal(action),
    id: Schema.optional(Schema.String), version: NonNegativeInteger,
    values, confirmed: Schema.optional(Schema.Boolean),
  }).annotate({ parseOptions: { onExcessProperty: "error" } })
}
const PortFailure = Schema.Union([
  Schema.Struct({
    status: Schema.Literals(["needs-input", "stale", "denied", "unavailable", "conflict", "provider-conflict", "failed"]),
    reason: Schema.String,
  }),
  Schema.Struct({ status: Schema.Literal("invalid") }),
])
function portOutput<Value>(value: Schema.Codec<Value>) {
  return Schema.Union([Schema.Struct({ status: Schema.Literal("ok"), value }), PortFailure])
}
const SourcingComparisonInput = Schema.Struct({
  request: Schema.Struct({ requestRef: NonEmpty, version: NonNegativeInteger, stage: Schema.String }),
  authorizedOffers: Schema.Array(Schema.Struct({
    offerRef: Schema.String, version: NonNegativeInteger, currency: Schema.String,
    amount: Amount, evidenceRefs: Schema.Array(EvidenceRecord),
  })),
  submittedFx: Schema.Array(Schema.Struct({
    from: Schema.String, to: Schema.String, period: Period, rate: Amount,
    evidenceRefs: Schema.Array(EvidenceRecord),
  })),
  weightsAndEligibility: Schema.Array(Schema.Struct({
    criterionRef: Schema.String, weight: Schema.Finite, required: Schema.Boolean,
    evidenceRefs: Schema.Array(EvidenceRecord),
  })),
  sourceRefs: Schema.Array(EvidenceRecord),
})
const ScenarioSelection = Schema.Struct({
  caseRef: CaseRef,
  sourceDigest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  costInventory: Schema.Literal("renewal-transition-v1"),
  operation: Schema.Union([
    Schema.Struct({ kind: Schema.Literal("baseline") }),
    Schema.Struct({
      kind: Schema.Literal("replace"), target: Schema.Literal("PR.estAmount"),
      amount: Schema.Finite.check(Schema.isGreaterThanOrEqualTo(0)),
      currency: Schema.String.check(Schema.isPattern(/^[A-Z]{3}$/)),
      period: Period,
    }),
  ]),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const ScenarioAuthority = Schema.Struct({
  installationId: NonEmpty, projectId: NonEmpty, principalRef: NonEmpty,
  accessRevision: Schema.String, policyVersion: Schema.String,
})
const ScenarioControls = Schema.Struct({
  caseRef: CaseRef,
  authority: ScenarioAuthority,
  sources: Schema.Array(Schema.Struct({
    sourceDigest: Schema.String, source: EvidenceRecord, label: Schema.String,
    currency: Schema.String, period: Period,
  })),
  financialApproval: Schema.Literal("blocked"), financialApprovalReason: Schema.String,
}).annotate({ parseOptions: { onExcessProperty: "error" } })
const CostCoverageEntry = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("included"), categoryId: Schema.String,
    componentRefs: Schema.Array(Schema.String),
    evidenceRefs: Schema.Array(EvidenceRecord), scopeNote: Schema.String,
  }),
  Schema.Struct({
    status: Schema.Literal("not-applicable"), categoryId: Schema.String,
    justification: Schema.String, evidenceRefs: Schema.Array(EvidenceRecord),
  }),
  Schema.Struct({
    status: Schema.Literal("pending"), categoryId: Schema.String,
    reason: Schema.String, questionRef: Schema.optional(Schema.String),
  }),
])
const Coverage = Schema.Struct({
  basisId: Schema.String, basisVersion: NonNegativeInteger,
  alternativeId: Schema.String, alternativeVersion: NonNegativeInteger,
  currency: Schema.String, horizon: Period, issues: Schema.Array(Schema.String),
  evaluatedSourceRefs: Schema.Array(EvidenceRecord),
  coverageState: Schema.Literals(["complete", "pending", "unavailable"]),
  entries: Schema.Array(CostCoverageEntry),
  derivedMissingCategoryIds: Schema.Array(Schema.String),
})
const ScenarioResult = Schema.Struct({
  id: Schema.String, version: NonNegativeInteger,
  components: Schema.Array(Schema.Struct({
    id: Schema.String, amount: Amount, currency: Schema.String, period: Period,
    sourceRefs: Schema.Array(SourceRef),
    evidenceState: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
  })),
  currency: Schema.String, horizon: Period, sourceRefs: Schema.Array(EvidenceRecord),
  unresolvedConditions: Schema.Array(Schema.String), restrictions: Schema.Array(Schema.String),
  comparisonStatus: Schema.Literals(["complete", "conditioned", "incompatible", "unavailable"]),
  costCoverage: Coverage, knownSubtotal: Amount, total: Amount,
})
const ScenarioPreview = Schema.Struct({
  scenario: ScenarioResult,
  basis: Schema.Struct({
    id: Schema.String, version: NonNegativeInteger, decisionType: Schema.String,
    categoryIds: Schema.Array(Schema.String), sourceRefs: Schema.Array(EvidenceRecord),
    additionalCategoryIds: Schema.Array(Schema.String),
  }),
  assessment: Coverage, coverageRef: Schema.String,
  producer: Schema.Struct({
    id: Schema.String, calculator: Schema.String,
    unit: Schema.Literal("currency"), requestDigest: Schema.String,
    sourceDigest: Schema.String, domainRevision: NonNegativeInteger,
  }),
  request: Schema.Struct({
    baseRef: Schema.String,
    operations: Schema.Array(Schema.Struct({
      kind: Schema.Literals(["replace", "defer", "include", "exclude"]),
      targetRef: Schema.String, replacementRef: Schema.optional(Schema.String),
      amount: Schema.optional(Schema.Finite), currency: Schema.optional(Schema.String),
      period: Schema.optional(Period),
    })),
    assumptions: Schema.Array(Schema.Struct({
      id: Schema.String, value: Schema.Union([Schema.String, Schema.Number, Schema.Boolean, Schema.Null]),
      evidenceRefs: Schema.Array(EvidenceRecord),
      state: Schema.Literals(["confirmed", "estimated", "hypothetical", "absent"]),
    })),
  }),
  caseRef: CaseRef,
  authority: ScenarioAuthority,
  source: EvidenceRecord,
  financialApproval: Schema.Literal("blocked"), financialApprovalReason: Schema.String,
})
export const SfProcurementSchemas = {
  pageSelection: PageSelection, titleSave: SfProcurementTitleSave,
  request: SfProcurementRequest, supplier: SfProcurementSupplier,
  settings: SfProcurementSettings,
} as const

export const SfDomainPageCap24 = { operationId: "domain.page.CAP24", input: PageSelection, output: pageOutput("CAP24", DashboardData) } as const
export const SfDomainPageCap25 = { operationId: "domain.page.CAP25", input: PageSelection, output: pageOutput("CAP25", RequestsData) } as const
export const SfDomainCommandCap25Create = { operationId: "domain.command.CAP25.create", input: domainCommand("Requests", "create", CommandValues["Requests"]["create"]), output: CommandResult } as const
export const SfDomainCommandCap25Save = { operationId: "domain.command.CAP25.save", input: domainCommand("Requests", "save", CommandValues["Requests"]["save"]), output: CommandResult } as const
export const SfDomainCommandCap25SubmitPr = { operationId: "domain.command.CAP25.submit_pr", input: domainCommand("Requests", "submit_pr", CommandValues["Requests"]["submit_pr"]), output: CommandResult } as const
export const SfDomainCommandCap25SubmitSourcing = { operationId: "domain.command.CAP25.submit_sourcing", input: domainCommand("Requests", "submit_sourcing", CommandValues["Requests"]["submit_sourcing"]), output: CommandResult } as const
export const SfDomainCommandCap25SelectQuote = { operationId: "domain.command.CAP25.select_quote", input: domainCommand("Requests", "select_quote", CommandValues["Requests"]["select_quote"]), output: CommandResult } as const
export const SfDomainCommandCap25SubmitPo = { operationId: "domain.command.CAP25.submit_po", input: domainCommand("Requests", "submit_po", CommandValues["Requests"]["submit_po"]), output: CommandResult } as const
export const SfDomainCommandCap25Approve = { operationId: "domain.command.CAP25.approve", input: domainCommand("Requests", "approve", CommandValues["Requests"]["approve"]), output: CommandResult } as const
export const SfDomainCommandCap25Reject = { operationId: "domain.command.CAP25.reject", input: domainCommand("Requests", "reject", CommandValues["Requests"]["reject"]), output: CommandResult } as const
export const SfDomainCommandCap25Issue = { operationId: "domain.command.CAP25.issue", input: domainCommand("Requests", "issue", CommandValues["Requests"]["issue"]), output: CommandResult } as const
export const SfDomainCommandCap25Cancel = { operationId: "domain.command.CAP25.cancel", input: domainCommand("Requests", "cancel", CommandValues["Requests"]["cancel"]), output: CommandResult } as const
export const SfDomainCommandCap25Delete = { operationId: "domain.command.CAP25.delete", input: domainCommand("Requests", "delete", CommandValues["Requests"]["delete"]), output: CommandResult } as const
export const SfDomainPageCap26 = { operationId: "domain.page.CAP26", input: PageSelection, output: pageOutput("CAP26", ApprovalsData) } as const
export const SfDomainCommandCap26Approve = { operationId: "domain.command.CAP26.approve", input: domainCommand("My approvals", "approve", CommandValues["My approvals"]["approve"]), output: CommandResult } as const
export const SfDomainCommandCap26Reject = { operationId: "domain.command.CAP26.reject", input: domainCommand("My approvals", "reject", CommandValues["My approvals"]["reject"]), output: CommandResult } as const
export const SfDomainCommandCap26Create = { operationId: "domain.command.CAP26.create", input: domainCommand("My approvals", "create", CommandValues["My approvals"]["create"]), output: CommandResult } as const
export const SfDomainCommandCap26Save = { operationId: "domain.command.CAP26.save", input: domainCommand("My approvals", "save", CommandValues["My approvals"]["save"]), output: CommandResult } as const
export const SfDomainCommandCap26SubmitPr = { operationId: "domain.command.CAP26.submit_pr", input: domainCommand("My approvals", "submit_pr", CommandValues["My approvals"]["submit_pr"]), output: CommandResult } as const
export const SfDomainCommandCap26SubmitSourcing = { operationId: "domain.command.CAP26.submit_sourcing", input: domainCommand("My approvals", "submit_sourcing", CommandValues["My approvals"]["submit_sourcing"]), output: CommandResult } as const
export const SfDomainCommandCap26SelectQuote = { operationId: "domain.command.CAP26.select_quote", input: domainCommand("My approvals", "select_quote", CommandValues["My approvals"]["select_quote"]), output: CommandResult } as const
export const SfDomainCommandCap26SubmitPo = { operationId: "domain.command.CAP26.submit_po", input: domainCommand("My approvals", "submit_po", CommandValues["My approvals"]["submit_po"]), output: CommandResult } as const
export const SfDomainCommandCap26Issue = { operationId: "domain.command.CAP26.issue", input: domainCommand("My approvals", "issue", CommandValues["My approvals"]["issue"]), output: CommandResult } as const
export const SfDomainCommandCap26Cancel = { operationId: "domain.command.CAP26.cancel", input: domainCommand("My approvals", "cancel", CommandValues["My approvals"]["cancel"]), output: CommandResult } as const
export const SfDomainCommandCap26Delete = { operationId: "domain.command.CAP26.delete", input: domainCommand("My approvals", "delete", CommandValues["My approvals"]["delete"]), output: CommandResult } as const
export const SfDomainPageCap27 = { operationId: "domain.page.CAP27", input: PageSelection, output: pageOutput("CAP27", SuppliersData) } as const
export const SfDomainCommandCap27Create = { operationId: "domain.command.CAP27.create", input: domainCommand("Suppliers", "create", CommandValues["Suppliers"]["create"]), output: CommandResult } as const
export const SfDomainCommandCap27Save = { operationId: "domain.command.CAP27.save", input: domainCommand("Suppliers", "save", CommandValues["Suppliers"]["save"]), output: CommandResult } as const
export const SfDomainCommandCap27Activate = { operationId: "domain.command.CAP27.activate", input: domainCommand("Suppliers", "activate", CommandValues["Suppliers"]["activate"]), output: CommandResult } as const
export const SfDomainCommandCap27Block = { operationId: "domain.command.CAP27.block", input: domainCommand("Suppliers", "block", CommandValues["Suppliers"]["block"]), output: CommandResult } as const
export const SfDomainCommandCap27Inactivate = { operationId: "domain.command.CAP27.inactivate", input: domainCommand("Suppliers", "inactivate", CommandValues["Suppliers"]["inactivate"]), output: CommandResult } as const
export const SfDomainCommandCap27Delete = { operationId: "domain.command.CAP27.delete", input: domainCommand("Suppliers", "delete", CommandValues["Suppliers"]["delete"]), output: CommandResult } as const
export const SfDomainCommandCap27ChangeBank = { operationId: "domain.command.CAP27.change-bank", input: domainCommand("Suppliers", "change-bank", CommandValues["Suppliers"]["change-bank"]), output: CommandResult } as const
export const SfDomainPageCap28 = { operationId: "domain.page.CAP28", input: PageSelection, output: pageOutput("CAP28", SettingsData) } as const
export const SfDomainCommandCap28Save = { operationId: "domain.command.CAP28.save", input: domainCommand("Settings", "save", CommandValues["Settings"]["save"]), output: CommandResult } as const
export const SfDomainCommandCap28Reset = { operationId: "domain.command.CAP28.reset", input: domainCommand("Settings", "reset", CommandValues["Settings"]["reset"]), output: CommandResult } as const
export const SfProcurementSourcingPrepare = { operationId: "procurement.sourcing.prepare", input: Schema.Struct({ caseRef: CaseRef, requestRef: NonEmpty }), output: portOutput(SourcingComparisonInput) } as const
export const SfProcurementProcurementScenarioControls = { operationId: "procurement.procurement-scenario-controls", input: Schema.Struct({ case: NonEmpty, version: PositiveInteger }), output: portOutput(ScenarioControls) } as const
export const SfProcurementProcurementScenarioPreview = { operationId: "procurement.procurement-scenario-preview", input: ScenarioSelection, output: portOutput(ScenarioPreview) } as const

/**
 * Supplier CSV uses the exact existing producer's GET ?download=suppliers bytes.
 * The request is only an operation selector, never a grant or JSON result codec.
 * F02's dedicated byte consumer and the original producer authorize actual egress.
 */
export const SfSupplierCsvExportRequest = Schema.Struct({
  surface: Schema.Literal("procurement"),
}).annotate({ parseOptions: { onExcessProperty: "error" } })
export type SfSupplierCsvExportRequest = typeof SfSupplierCsvExportRequest.Type

export type SfSupplierCsvExportResult =
  | Readonly<{
      status: "ok"
      fileName: "suppliers.csv"
      mediaType: "text/csv; charset=utf-8"
      bytes: Uint8Array
      stamp: SfContextStamp
    }>
  | Readonly<{ status: "denied" | "unauthenticated" | "stale" | "unavailable" | "aborted" | "invalid" }>

/** Canonical A03 closed family: no action, page or endpoint can be passed as a free string. */
export const SfProcurement = {
  operations: {
  "domain.page.CAP24": SfDomainPageCap24,
  "domain.page.CAP25": SfDomainPageCap25,
  "domain.command.CAP25.create": SfDomainCommandCap25Create,
  "domain.command.CAP25.save": SfDomainCommandCap25Save,
  "domain.command.CAP25.submit_pr": SfDomainCommandCap25SubmitPr,
  "domain.command.CAP25.submit_sourcing": SfDomainCommandCap25SubmitSourcing,
  "domain.command.CAP25.select_quote": SfDomainCommandCap25SelectQuote,
  "domain.command.CAP25.submit_po": SfDomainCommandCap25SubmitPo,
  "domain.command.CAP25.approve": SfDomainCommandCap25Approve,
  "domain.command.CAP25.reject": SfDomainCommandCap25Reject,
  "domain.command.CAP25.issue": SfDomainCommandCap25Issue,
  "domain.command.CAP25.cancel": SfDomainCommandCap25Cancel,
  "domain.command.CAP25.delete": SfDomainCommandCap25Delete,
  "domain.page.CAP26": SfDomainPageCap26,
  "domain.command.CAP26.approve": SfDomainCommandCap26Approve,
  "domain.command.CAP26.reject": SfDomainCommandCap26Reject,
  "domain.command.CAP26.create": SfDomainCommandCap26Create,
  "domain.command.CAP26.save": SfDomainCommandCap26Save,
  "domain.command.CAP26.submit_pr": SfDomainCommandCap26SubmitPr,
  "domain.command.CAP26.submit_sourcing": SfDomainCommandCap26SubmitSourcing,
  "domain.command.CAP26.select_quote": SfDomainCommandCap26SelectQuote,
  "domain.command.CAP26.submit_po": SfDomainCommandCap26SubmitPo,
  "domain.command.CAP26.issue": SfDomainCommandCap26Issue,
  "domain.command.CAP26.cancel": SfDomainCommandCap26Cancel,
  "domain.command.CAP26.delete": SfDomainCommandCap26Delete,
  "domain.page.CAP27": SfDomainPageCap27,
  "domain.command.CAP27.create": SfDomainCommandCap27Create,
  "domain.command.CAP27.save": SfDomainCommandCap27Save,
  "domain.command.CAP27.activate": SfDomainCommandCap27Activate,
  "domain.command.CAP27.block": SfDomainCommandCap27Block,
  "domain.command.CAP27.inactivate": SfDomainCommandCap27Inactivate,
  "domain.command.CAP27.delete": SfDomainCommandCap27Delete,
  "domain.command.CAP27.change-bank": SfDomainCommandCap27ChangeBank,
  "domain.page.CAP28": SfDomainPageCap28,
  "domain.command.CAP28.save": SfDomainCommandCap28Save,
  "domain.command.CAP28.reset": SfDomainCommandCap28Reset,
  "procurement.sourcing.prepare": SfProcurementSourcingPrepare,
  "procurement.procurement-scenario-controls": SfProcurementProcurementScenarioControls,
  "procurement.procurement-scenario-preview": SfProcurementProcurementScenarioPreview,
  },
} as const
