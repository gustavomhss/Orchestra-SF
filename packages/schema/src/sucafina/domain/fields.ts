import { Schema } from "effect"
import { NonNegativeInt, optional } from "../../schema"

/** Public DTOs: the legacy renderer's allowed fieldsets, not the persisted snapshot. */
export type SfDomainJson = null | boolean | number | string | readonly SfDomainJson[] | { readonly [key: string]: SfDomainJson }
export const SfDomainJsonValue: Schema.Schema<SfDomainJson> = Schema.suspend(() =>
  Schema.Union([Schema.Null, Schema.Boolean, Schema.Finite, Schema.String,
    Schema.Array(SfDomainJsonValue), Schema.Record(Schema.String, SfDomainJsonValue)]),
)

export const SfDomainScalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null])
export const SfDomainRecordId = Schema.Union([Schema.String, Schema.Finite])
export const SfDomainAmountInput = Schema.NullOr(Schema.Finite)
export const SfDomainYears = Schema.Int.check(Schema.isBetween({ minimum: 2024, maximum: 2027 }))
export const SfDomainMonths = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 }))
export const SfDomainVersionNumbers = Schema.Record(Schema.String, NonNegativeInt )
export const SfDomainVersionInput = Schema.Record(Schema.String, NonNegativeInt)
export const SfDomainReadSelection = Schema.Struct({
  year: optional(SfDomainYears),
  month: optional(SfDomainMonths),
  execYear: optional(SfDomainYears),
  executiveMonth: optional(SfDomainMonths),
  opsMonth: optional(SfDomainMonths),
  own: optional(SfDomainYears),
  q: optional(Schema.String),
  status: optional(Schema.String),
  filter: optional(Schema.String),
  owner: optional(Schema.String),
  risk: optional(Schema.String),
  priority: optional(Schema.String),
  tab: optional(Schema.String),
})

export const SfDomainSourceVersion = Schema.Struct({
  version: NonNegativeInt,
})

export const SfDomainBudgetOwner = Schema.Struct({
  id: SfDomainRecordId,
  name: optional(Schema.String),
  budget: optional(Schema.NullOr(Schema.Finite)),
  status: optional(Schema.String),
})
export const SfDomainBudgetEntry = Schema.Struct({
  id: SfDomainRecordId,
  ownerId: optional(SfDomainRecordId),
  projId: optional(SfDomainRecordId),
  projectId: optional(SfDomainRecordId),
  year: optional(Schema.Int),
  month: optional(Schema.Int),
  budget: optional(Schema.NullOr(Schema.Finite)),
  actual: optional(Schema.NullOr(Schema.Finite)),
  forecast: optional(Schema.NullOr(Schema.Finite)),
})
export const SfDomainBudgetUser = Schema.Struct({
  id: optional(SfDomainRecordId),
  year: Schema.Int,
  month: optional(Schema.Int),
  users: optional(Schema.NullOr(Schema.Finite)),
  value: optional(Schema.NullOr(Schema.Finite)),
})
export const SfDomainBudgetTotals = Schema.Struct({
  opexBudget: Schema.Finite, opexActual: Schema.Finite, opexForecast: Schema.Finite,
  capexBudget: Schema.Finite, capexActual: Schema.Finite, capexForecast: Schema.Finite,
  totalBudget: Schema.Finite, totalActual: Schema.Finite, totalForecast: Schema.Finite,
})
export const SfDomainDeviation = Schema.Struct({
  flag: optional(Schema.Literals(["", "dev-green", "dev-amber", "dev-red"])),
  text: optional(Schema.String),
})
export const SfDomainYearAmount = Schema.Struct({
  amount: Schema.Finite,
  months: Schema.Int,
  perMonth: Schema.Finite,
  at: Schema.String,
})
export const SfDomainBudgetYtd = Schema.Struct({
  opex: optional(Schema.Record(Schema.String, SfDomainYearAmount )),
  capex: optional(Schema.Record(Schema.String, SfDomainYearAmount )),
})
export const SfDomainExecutive = Schema.Struct({
  active: optional(Schema.NullOr(Schema.Finite)),
  departures: optional(Schema.NullOr(Schema.Finite)),
  monthlyDepartures: optional(Schema.Union([Schema.Null, Schema.Finite, Schema.Array(Schema.NullOr(Schema.Finite))])),
  pmoActive: optional(Schema.NullOr(Schema.Finite)),
  pmoAtRisk: optional(Schema.NullOr(Schema.Finite)),
  activeRisks: optional(Schema.NullOr(Schema.Finite)),
  topRisks: optional(Schema.NullOr(Schema.Finite)),
  onTarget: optional(Schema.NullOr(Schema.Finite)),
})
export const SfDomainExecutiveMonth = Schema.Struct({
  opened: optional(Schema.NullOr(Schema.Finite)),
  closed: optional(Schema.NullOr(Schema.Finite)),
  netChange: optional(Schema.NullOr(Schema.Finite)),
  backlog: optional(Schema.NullOr(Schema.Finite)),
  p1: optional(Schema.NullOr(Schema.Finite)),
  incSLA: optional(Schema.NullOr(Schema.Finite)),
  svcSLA: optional(Schema.NullOr(Schema.Finite)),
  incYtd: optional(Schema.NullOr(Schema.Finite)),
  svcYtd: optional(Schema.NullOr(Schema.Finite)),
  backlogYtd: optional(Schema.NullOr(Schema.Finite)),
  openIncidents: optional(Schema.NullOr(Schema.Finite)),
  kpis: optional(Schema.Array(Schema.Struct({
    key: Schema.String, value: Schema.NullOr(SfDomainScalar),
    status: Schema.String, sourceYear: Schema.NullOr(Schema.Int), sourceMonth: Schema.NullOr(Schema.Int),
  }))),
})
export const SfDomainSignal = Schema.Struct({
  id: Schema.String, page: Schema.String, recordId: Schema.String,
  fact: Schema.String, rule: Schema.String, date: Schema.String,
})

export const SfDomainMilestone = Schema.Struct({
  id: optional(SfDomainRecordId),
  name: optional(Schema.String),
  date: optional(Schema.String),
  status: optional(Schema.String),
  notes: optional(Schema.String),
})
export const SfDomainProject = Schema.Struct({
  id: SfDomainRecordId,
  createdAt: optional(Schema.String), updatedAt: optional(Schema.String),
  name: optional(SfDomainScalar), desc: optional(SfDomainScalar), status: optional(SfDomainScalar),
  risk: optional(SfDomainScalar), priority: optional(SfDomainScalar),
  pm: optional(SfDomainScalar), leaderId: optional(SfDomainScalar),
  start: optional(SfDomainScalar), end: optional(SfDomainScalar),
  budget: optional(SfDomainScalar), spent: optional(SfDomainScalar), pct: optional(SfDomainScalar),
  notes: optional(SfDomainScalar), watch: optional(SfDomainScalar), watchList: optional(SfDomainScalar),
  milestones: optional(Schema.Array(SfDomainMilestone)),
})
export const SfDomainRisk = Schema.Struct({
  id: SfDomainRecordId,
  createdAt: optional(Schema.String), updatedAt: optional(Schema.String),
  title: optional(SfDomainScalar), action: optional(SfDomainScalar),
  responsible: optional(SfDomainScalar), name: optional(SfDomainScalar),
  desc: optional(SfDomainScalar), category: optional(SfDomainScalar),
  impact: optional(SfDomainScalar), probability: optional(SfDomainScalar),
  status: optional(SfDomainScalar), owner: optional(SfDomainScalar),
  ownerId: optional(SfDomainScalar), leaderId: optional(SfDomainScalar),
  mitigation: optional(SfDomainScalar), due: optional(SfDomainScalar),
  notes: optional(SfDomainScalar),
})
export const SfDomainAttachmentDescriptor = Schema.Struct({
  id: optional(SfDomainScalar), name: optional(SfDomainScalar),
  size: optional(SfDomainScalar), type: optional(SfDomainScalar),
  added: optional(SfDomainScalar), status: optional(SfDomainScalar),
})
export const SfDomainContract = Schema.Struct({
  id: SfDomainRecordId,
  createdAt: optional(Schema.String), updatedAt: optional(Schema.String),
  num: optional(SfDomainScalar), renewal: optional(SfDomainScalar),
  vendor: optional(SfDomainScalar), name: optional(SfDomainScalar),
  desc: optional(SfDomainScalar), category: optional(SfDomainScalar),
  owner: optional(SfDomainScalar), ownerId: optional(SfDomainScalar),
  start: optional(SfDomainScalar), end: optional(SfDomainScalar),
  amount: optional(SfDomainScalar), amtType: optional(SfDomainScalar),
  renewType: optional(SfDomainScalar), notice: optional(SfDomainScalar),
  eval: optional(SfDomainScalar), notes: optional(SfDomainScalar),
  currency: optional(SfDomainScalar),
  docs: optional(Schema.Array(SfDomainAttachmentDescriptor)),
})
export const SfDomainStakeholder = Schema.Struct({
  id: SfDomainRecordId,
  createdAt: optional(Schema.String), updatedAt: optional(Schema.String),
  position: optional(SfDomainScalar), name: optional(SfDomainScalar),
  title: optional(SfDomainScalar), company: optional(SfDomainScalar),
  department: optional(SfDomainScalar), role: optional(SfDomainScalar),
  email: optional(SfDomainScalar), biz: optional(SfDomainScalar),
  iti: optional(SfDomainScalar), perc: optional(SfDomainScalar),
  priority: optional(SfDomainScalar), owner: optional(SfDomainScalar),
  action: optional(SfDomainScalar), actions: optional(SfDomainScalar),
  notes: optional(SfDomainScalar),
})
export const SfDomainPerformanceSub = Schema.Struct({
  id: optional(SfDomainScalar), label: optional(SfDomainScalar),
  objective: optional(SfDomainScalar), target: optional(SfDomainScalar),
  description: optional(SfDomainScalar), totalWeight: optional(SfDomainScalar),
  owner: optional(SfDomainScalar), ownerWeight: optional(SfDomainScalar),
  co1: optional(SfDomainScalar), co1Weight: optional(SfDomainScalar),
  co2: optional(SfDomainScalar), co2Weight: optional(SfDomainScalar),
  score: optional(SfDomainScalar), status: optional(SfDomainScalar),
  q1: optional(SfDomainScalar), q2: optional(SfDomainScalar),
  q3: optional(SfDomainScalar), q4: optional(SfDomainScalar),
  statusQ1: optional(SfDomainScalar), statusQ2: optional(SfDomainScalar),
  statusQ3: optional(SfDomainScalar), statusQ4: optional(SfDomainScalar),
  notes: optional(SfDomainScalar),
})
export const SfDomainPerformanceItem = Schema.Struct({
  id: optional(SfDomainScalar), name: optional(SfDomainScalar),
  color: optional(SfDomainScalar), totalWeight: optional(SfDomainScalar),
  ownerWeight: optional(SfDomainScalar), co1Weight: optional(SfDomainScalar),
  co2Weight: optional(SfDomainScalar), expanded: optional(SfDomainScalar),
  description: optional(SfDomainScalar),
  subs: optional(Schema.Array(SfDomainPerformanceSub)),
})
export const SfDomainPerformance = Schema.Struct({
  name: optional(SfDomainScalar), year: optional(SfDomainScalar),
  items: optional(Schema.Array(SfDomainPerformanceItem)),
})

/** A selection's absence is distinct from null and from an observed zero. */
export const SfDomainPageData = {
  CAP01: Schema.Struct({
    totals: optional(SfDomainBudgetTotals),
    executive: optional(SfDomainExecutive),
    executiveByYear: optional(Schema.Record(Schema.String, SfDomainExecutive )),
    executiveMonths: optional(Schema.Record(Schema.String, SfDomainExecutiveMonth )),
    opsDefaultMonth: optional(Schema.Record(Schema.String, Schema.Int )),
    itUsersMonthly: optional(Schema.Array(SfDomainBudgetUser)),
    costPerUserBenchmarks: optional(Schema.Array(SfDomainBudgetUser)),
    signals: optional(Schema.Array(SfDomainSignal)),
  }),
  CAP03: Schema.Struct({
    totals: optional(SfDomainBudgetTotals),
    budgetCurrentMonth: optional(Schema.Record(Schema.String, Schema.Int )),
    revenueByYear: optional(Schema.Record(Schema.String, Schema.Finite )),
  }),
  CAP04: Schema.Struct({
    opexOwners: optional(Schema.Array(SfDomainBudgetOwner)),
    opexEntries: optional(Schema.Array(SfDomainBudgetEntry)),
    deviations: optional(Schema.Record(Schema.String, SfDomainDeviation )),
    budgetYtd: optional(SfDomainBudgetYtd),
    budgetLineIds: optional(Schema.Array(Schema.String)),
  }),
  CAP05: Schema.Struct({
    capexProjects: optional(Schema.Array(SfDomainBudgetOwner)),
    capexEntries: optional(Schema.Array(SfDomainBudgetEntry)),
    deviations: optional(Schema.Record(Schema.String, SfDomainDeviation )),
    budgetYtd: optional(SfDomainBudgetYtd),
    budgetLineIds: optional(Schema.Array(Schema.String)),
  }),
  CAP09: Schema.Struct({ projects: optional(Schema.Array(SfDomainProject)) }),
  CAP10: Schema.Struct({ projects: optional(Schema.Array(SfDomainProject)) }),
  CAP13: Schema.Struct({ risks: optional(Schema.Array(SfDomainRisk)) }),
  CAP14: Schema.Struct({ contracts: optional(Schema.Array(SfDomainContract)) }),
  CAP15: Schema.Struct({ stakeholders: optional(Schema.Array(SfDomainStakeholder)) }),
  CAP16: Schema.Struct({ itperf: optional(SfDomainPerformance) }),
} as const

export const SfDomainLegacySuccess = Schema.Struct({
  ok: Schema.Literal(true),
  warnings: optional(Schema.Array(Schema.String)),
})
/** This is the existing safeFailure envelope. The existing producer owns redaction. */
export const SfDomainLegacyFailure = Schema.Struct({
  ok: Schema.Literal(false),
  status: Schema.Literals([400, 403, 404, 409, 422, 503]),
  errors: optional(Schema.Array(Schema.String)),
  fieldErrors: optional(Schema.Array(Schema.Struct({ field: Schema.String, message: Schema.String }))),
  stored: optional(SfDomainJsonValue),
  by: optional(Schema.String),
  currentVersionCAS: optional(NonNegativeInt),
})
export const SfDomainLegacyResult = Schema.Union([SfDomainLegacySuccess, SfDomainLegacyFailure])

/** Producer-owned dashboard results retain their domain status and refs. */
export const SfDomainProductResult = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: SfDomainJsonValue }),
  Schema.Struct({
    status: Schema.Literals(["denied", "unavailable", "stale", "conflict", "needs-input", "invalid", "provider-conflict", "failed"]),
    reason: optional(Schema.String),
  }),
])
export const SfDomainProductCaseRef = Schema.Struct({
  id: Schema.String, incarnation: Schema.String, version: NonNegativeInt,
})
export const SfDomainProductPeriod = Schema.Struct({
  start: Schema.String, end: Schema.String,
})
export const SfDomainProductRecordTarget = Schema.Struct({
  surface: Schema.Literal("dashboard"),
  recordType: Schema.String, recordId: Schema.String, incarnation: Schema.String,
  version: NonNegativeInt, fields: Schema.Array(Schema.String),
  period: SfDomainProductPeriod, projectionDigest: Schema.String,
})
export const SfDomainProductEvidence = Schema.Struct({
  schema: Schema.Literal("sf-evidence-v1"), kind: Schema.Literal("record"),
  refId: Schema.String, refDigest: Schema.String,
  installationId: Schema.String, projectId: Schema.String,
  evidenceLevel: optional(Schema.String),
  target: SfDomainProductRecordTarget,
})
export const SfDomainProductSourceRef = Schema.Struct({
  kind: Schema.Literal("record"), refId: Schema.String,
  refDigest: optional(Schema.String),
  installationId: optional(Schema.String), projectId: optional(Schema.String),
  evidenceLevel: optional(Schema.String),
  target: optional(SfDomainProductRecordTarget),
})
