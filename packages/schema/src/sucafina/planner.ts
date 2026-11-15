import { Schema } from "effect"
import { NonNegativeInt } from "../schema"

// W15/A02. Source-locked operation descriptors; no free-form operation/action dispatch.
// Fixed routes, queries, discriminators and idempotency are enforced by F02's transport.
// This leaf deliberately does not import the I00 shared registry.
const NonEmpty = Schema.String.check(Schema.isMinLength(1))
const Month = Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)).check(Schema.isLessThanOrEqualTo(12))
const MonthIndex = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).check(Schema.isLessThanOrEqualTo(11))
const Through = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)).check(Schema.isLessThanOrEqualTo(12))
const Year = Schema.Int.check(Schema.isGreaterThanOrEqualTo(2024)).check(Schema.isLessThanOrEqualTo(2027))
const Optional = Schema.optionalKey
const NullableAmount = Schema.Union([Schema.Finite, Schema.Null])
const EditableAmount = Schema.Union([Schema.String, NullableAmount])
const Amounts = Schema.Array(Schema.Finite).check(Schema.isMinLength(12)).check(Schema.isMaxLength(12))
const NullableAmounts = Schema.Array(NullableAmount).check(Schema.isMinLength(12)).check(Schema.isMaxLength(12))
const RecordVersion = Schema.Struct({ version: NonNegativeInt })
const ContextStamp = Schema.Struct({
  installationId: NonEmpty, projectId: NonEmpty, hostId: NonEmpty,
  principalRef: NonEmpty, policyVersion: NonEmpty, accessRevision: NonEmpty,
})
const Selection = Schema.Struct({
  year: Year,
  versionId: Optional(NonEmpty),
  owner: Optional(Schema.String),
  class: Optional(Schema.String),
  q: Optional(Schema.String),
  mode: Optional(Schema.String),
  filter: Optional(Schema.String),
})
const BasicQuery = { year: Optional(Year) }
const VersionQuery = { ...BasicQuery, version: Optional(Schema.String) }
const Queries = {
  CAP17: Schema.Struct({ ...VersionQuery, filter: Optional(Schema.String) }),
  CAP18: Schema.Struct({ ...VersionQuery, mode: Optional(Schema.Literals(["budget", "actual", "forecast", "compare", ""])), owner: Optional(Schema.String), class: Optional(Schema.Literals(["capex", "opex", ""])), q: Optional(Schema.String) }),
  CAP19: Schema.Struct({ ...VersionQuery, mode: Optional(Schema.Literals(["budget", "actual", "forecast", "compare", ""])), owner: Optional(Schema.String), class: Optional(Schema.Literals(["capex", "opex", ""])), q: Optional(Schema.String) }),
  CAP20: Schema.Struct(VersionQuery),
  CAP21: Schema.Struct(BasicQuery),
  CAP22: Schema.Struct(VersionQuery),
  CAP23: Schema.Struct(BasicQuery),
} as const
const PlanVersion = Schema.Struct({
  id: NonEmpty, name: Schema.String, year: Schema.Finite, locked: Schema.Boolean,
  closed: Schema.Finite, official: Schema.Boolean,
})
const MonthValue = Schema.Struct({
  value: NullableAmount, stored: NullableAmount,
  source: Schema.Literals(["derived", "explicit", "absent", "inherited-budget"]),
  editable: Schema.Boolean,
})
const MonthCell = Schema.Struct({
  month: Month, closed: Schema.Boolean, manual: Schema.Boolean,
  budget: MonthValue, actual: MonthValue, forecast: MonthValue,
})
const MonthlyGrid = Schema.Struct({
  versionId: NonEmpty, versionName: Schema.String, year: Schema.Finite,
  page: Schema.Literals(["OPEX", "CAPEX"]), closedThrough: Schema.Finite,
  rows: Schema.Array(Schema.Struct({
    id: NonEmpty, label: Schema.String, currency: Schema.String,
    synthetic: Schema.Boolean, revision: NonNegativeInt, cells: Schema.Array(MonthCell),
  })),
})
const MoneySummary = Schema.Struct({
  total: NullableAmount, actualYTD: NullableAmount, fullYear: NullableAmount,
  hrTotal: NullableAmount, fte: NullableAmount,
  budget: NullableAmounts, actual: NullableAmounts, outlook: NullableAmounts,
  warnings: Schema.Array(Schema.String),
})
const RecordMeta = Schema.Struct({
  id: NonEmpty, name: Schema.String, revision: NonNegativeInt,
  desc: Optional(Schema.String), el: Optional(Schema.String), cls: Optional(Schema.String),
  owner: Optional(Schema.String), entity: Optional(Schema.String),
  alloc: Optional(Schema.String), cur: Optional(Schema.String),
  proj: Optional(Schema.String), synthetic: Optional(Schema.Boolean),
})
const PlanProject = Schema.Struct({
  id: NonEmpty, name: Schema.String, revision: NonNegativeInt,
  code: Optional(Schema.String), owner: Optional(Schema.String), desc: Optional(Schema.String),
})
const HeadcountPosition = Schema.Struct({
  id: NonEmpty, name: Schema.String, revision: NonNegativeInt,
  include: Optional(Schema.Boolean), domain: Optional(Schema.String),
  type: Optional(Schema.String), location: Optional(Schema.String),
  fte: Optional(Schema.Finite), start: Optional(Schema.Finite), end: Optional(Schema.Finite),
  rateId: Optional(Schema.String), rateOverride: Optional(EditableAmount),
  hasRate: Optional(Schema.Boolean), src: Optional(Schema.String),
  left: Optional(Schema.Boolean), months: Optional(NullableAmounts),
})
const Rate = Schema.Struct({
  id: NonEmpty, name: Schema.String, revision: NonNegativeInt,
  cur: Schema.String, annual: NullableAmount,
  locs: Optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
})
const CatalogEntry = Schema.Struct({
  id: NonEmpty, name: Schema.String, revision: NonNegativeInt,
  code: Optional(Schema.String), desc: Optional(Schema.String),
})
const FxEntry = Schema.Struct({
  id: NonEmpty, cur: Schema.String, rate: EditableAmount, revision: NonNegativeInt,
})
const PageData = {
  CAP17: Schema.Struct({ versions: Schema.Array(PlanVersion), selectedVersion: Optional(PlanVersion), summary: Optional(MoneySummary), comparisons: Schema.Array(Schema.Struct({ id: NonEmpty, name: Schema.String, year: Schema.Finite, total: NullableAmount, fte: NullableAmount })) }),
  CAP18: Schema.Struct({ versions: Schema.Array(PlanVersion), selectedVersion: Optional(PlanVersion), grid: Optional(MonthlyGrid), lines: Schema.Array(RecordMeta), split: Schema.Array(Schema.Struct({ element: NonEmpty, split: Schema.Boolean, revision: NonNegativeInt })) }),
  CAP19: Schema.Struct({ versions: Schema.Array(PlanVersion), selectedVersion: Optional(PlanVersion), grid: Optional(MonthlyGrid), lines: Schema.Array(RecordMeta), projects: Schema.Array(PlanProject) }),
  CAP20: Schema.Struct({ versions: Schema.Array(PlanVersion), selectedVersion: Optional(PlanVersion), positions: Schema.Array(HeadcountPosition), rates: Optional(Schema.Array(Rate)), leaderDomains: Optional(Schema.Record(Schema.String, Schema.String)), increase: Optional(Schema.Struct({ inc: Schema.Finite, incMonth: Month })), metrics: Optional(Schema.Struct({ fte: NullableAmount, hrTotal: NullableAmount })) }),
  CAP21: Schema.Struct({ entities: Schema.Array(CatalogEntry), allocations: Schema.Array(CatalogEntry) }),
  CAP22: Schema.Struct({ versions: Schema.Array(PlanVersion), selectedVersion: Optional(PlanVersion), rates: Schema.Array(FxEntry), warnings: Schema.Array(Schema.String) }),
  CAP23: Schema.Struct({ versions: Schema.Array(PlanVersion) }),
} as const
const PageFailure = Schema.Union([
  Schema.Struct({ status: Schema.Literals(["unauthenticated", "denied"]) }),
  Schema.Struct({ status: Schema.Literals(["needs-input", "stale", "invalid", "unavailable"]), reason: Schema.String }),
])
function pageResult<K extends keyof typeof PageData>(capabilityId: K) {
  return Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"), context: ContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal(capabilityId),
        selection: Selection,
        data: PageData[capabilityId],
        versions: Schema.Record(Schema.String, RecordVersion),
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    PageFailure,
  ])
}

// Only JSON-valued producer substructures (stored CAS record and existing financial
// analysis/view) are recursively encoded. Every input command is a closed fieldset.
export type SfPlannerWireJson = null | string | number | boolean | readonly SfPlannerWireJson[] | { readonly [key: string]: SfPlannerWireJson }
const Json: Schema.Schema<SfPlannerWireJson> = Schema.suspend(() =>
  Schema.Union([Schema.Null, Schema.String, Schema.Finite, Schema.Boolean, Schema.Array(Json), Schema.Record(Schema.String, Json)]),
)
const LegacyFailure = Schema.Struct({
  ok: Schema.Literal(false),
  status: Schema.Literals([400, 403, 404, 409, 422, 503]),
  errors: Optional(Schema.Array(Schema.String)),
  fieldErrors: Optional(Schema.Array(Schema.Struct({ field: Schema.String, message: Schema.String }))),
  stored: Optional(Json), by: Optional(Schema.String), currentVersionCAS: Optional(NonNegativeInt),
})
const LegacyResult = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), value: Optional(Json), warnings: Optional(Schema.Array(Schema.String)) }),
  LegacyFailure,
])
const SafeKey = Schema.String
const ImportRowCell = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null])
const ImportRow = Schema.Record(SafeKey, ImportRowCell)
const ImportValues = Schema.Struct({
  versionId: Optional(NonEmpty),
  sheets: Schema.Record(Schema.String, Schema.Array(ImportRow)),
  newVersion: Optional(Schema.Boolean),
  removeMissing: Optional(Schema.Boolean),
  versions: Optional(Schema.Record(Schema.String, Schema.Struct({ version: NonNegativeInt, by: Optional(Schema.String) }))),
})
const LineFields = {
  name: Optional(Schema.String), desc: Optional(Schema.String), owner: Optional(Schema.String),
  entity: Optional(Schema.String), alloc: Optional(Schema.String), cls: Optional(Schema.String),
  cur: Optional(Schema.String), annual: Optional(Schema.Union([Schema.String, Schema.Finite])),
  b: Optional(Amounts), a: Optional(NullableAmounts), f: Optional(NullableAmounts),
  el: Optional(Schema.String), proj: Optional(Schema.String), domain: Optional(Schema.String),
  month: Optional(Schema.Union([MonthIndex, Schema.String])), value: Optional(EditableAmount),
  b0: Optional(EditableAmount), b1: Optional(EditableAmount), b2: Optional(EditableAmount), b3: Optional(EditableAmount), b4: Optional(EditableAmount), b5: Optional(EditableAmount), b6: Optional(EditableAmount), b7: Optional(EditableAmount), b8: Optional(EditableAmount), b9: Optional(EditableAmount), b10: Optional(EditableAmount), b11: Optional(EditableAmount),
  a0: Optional(EditableAmount), a1: Optional(EditableAmount), a2: Optional(EditableAmount), a3: Optional(EditableAmount), a4: Optional(EditableAmount), a5: Optional(EditableAmount), a6: Optional(EditableAmount), a7: Optional(EditableAmount), a8: Optional(EditableAmount), a9: Optional(EditableAmount), a10: Optional(EditableAmount), a11: Optional(EditableAmount),
  f0: Optional(EditableAmount), f1: Optional(EditableAmount), f2: Optional(EditableAmount), f3: Optional(EditableAmount), f4: Optional(EditableAmount), f5: Optional(EditableAmount), f6: Optional(EditableAmount), f7: Optional(EditableAmount), f8: Optional(EditableAmount), f9: Optional(EditableAmount), f10: Optional(EditableAmount), f11: Optional(EditableAmount),
}
const LineSave = Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literal("lines")), ...LineFields })
const ProjectSave = Schema.Struct({
  versionId: NonEmpty, collection: Schema.Literal("projects"),
  name: Optional(Schema.String), desc: Optional(Schema.String),
  owner: Optional(Schema.String), code: Optional(Schema.String),
})
const OpexSave = Schema.Union([
  Schema.Struct({ versionId: NonEmpty, closed: Schema.Union([Through, Schema.String]) }),
  Schema.Struct({ versionId: NonEmpty, el: Schema.String, split: Schema.Union([Schema.Boolean, Schema.Literals(["true", "false"])]) }),
  LineSave,
])
const CapexSave = Schema.Union([LineSave, ProjectSave])
const HeadcountSave = Schema.Union([
  Schema.Struct({
    versionId: NonEmpty, collection: Optional(Schema.Literal("positions")),
    name: Optional(Schema.String), title: Optional(Schema.String), type: Optional(Schema.String),
    location: Optional(Schema.String), include: Optional(Schema.Boolean),
    fte: Optional(Schema.Finite), start: Optional(Month), end: Optional(Month),
    domain: Optional(Schema.String), rateId: Optional(Schema.String),
    rateOverride: Optional(NullableAmount),
  }),
  Schema.Struct({
    versionId: NonEmpty, collection: Schema.Literal("rates"),
    name: Optional(Schema.String), locs: Optional(Schema.Union([Schema.String, Schema.Array(Schema.String)])),
    annual: Optional(Schema.Finite), cur: Optional(Schema.String),
  }),
  Schema.Struct({
    versionId: NonEmpty, collection: Schema.Literal("increase"), inc: Schema.Finite, incMonth: Month,
  }),
  Schema.Struct({
    versionId: NonEmpty, collection: Schema.Literal("leaderDomains"),
    mapping: Optional(Schema.Record(Schema.String, Schema.String)),
    leader: Optional(Schema.String), domain: Optional(Schema.String),
  }),
])
const CatalogSave = Schema.Struct({
  collection: Schema.Literals(["entities", "allocations"]),
  name: Optional(Schema.String), code: Optional(Schema.String), desc: Optional(Schema.String),
})
const Empty = Schema.Struct({})
const CommandValues = {
  CAP17: { "import-workbook": ImportValues },
  CAP18: {
    save: OpexSave, delete: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literal("lines")) }),
    spread: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literal("lines")) }),
    reset: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literal("lines")) }),
    "import-workbook": ImportValues,
  },
  CAP19: {
    save: CapexSave,
    delete: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literals(["lines","projects"])) }),
    spread: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literal("lines")) }),
    reset: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literal("lines")) }),
    "import-workbook": ImportValues,
  },
  CAP20: {
    save: HeadcountSave,
    delete: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literals(["positions","rates"])) }),
    sync: Schema.Struct({ versionId: NonEmpty, collection: Optional(Schema.Literal("positions")) }),
    "import-workbook": ImportValues,
  },
  CAP21: {
    save: CatalogSave, delete: Schema.Struct({ collection: Schema.Literals(["entities","allocations"]) }),
    common: Schema.Struct({ collection: Schema.Literal("allocations") }),
    "import-workbook": ImportValues,
  },
  CAP22: {
    save: Schema.Struct({ versionId: NonEmpty, cur: Optional(Schema.String), rate: Optional(Schema.Union([Schema.String, NullableAmount])) }),
    delete: Schema.Struct({ versionId: NonEmpty }), "import-workbook": ImportValues,
  },
  CAP23: {
    save: Schema.Struct({ name: Optional(Schema.String), year: Optional(Schema.Int) }),
    copy: Schema.Struct({ name: Optional(Schema.String) }),
    official: Empty, lock: Empty, unlock: Empty, delete: Empty,
    "import-workbook": ImportValues,
  },
} as const
function legacyInput<P extends keyof typeof CommandValues, A extends keyof (typeof CommandValues)[P] & string>(
  page: string, action: A, values: (typeof CommandValues)[P][A],
) {
  return Schema.Struct({
    page: Schema.Literal(page), action: Schema.Literal(action),
    id: Optional(NonEmpty), version: NonNegativeInt, values,
    confirmed: Optional(Schema.Boolean),
  })
}
const DraftCell = Schema.Struct({ measure: Schema.Literals(["budget","actual","forecast"]), month: Month, text: Schema.String })
const Draft = Schema.Struct({ rowId: NonEmpty, revision: NonNegativeInt, cells: Schema.Array(DraftCell).check(Schema.isMinLength(1)).check(Schema.isMaxLength(36)) })
const MonthlyRequest = Schema.Struct({ page: Schema.Literals(["OPEX","CAPEX"]), versionId: NonEmpty, drafts: Schema.Array(Draft).check(Schema.isMinLength(1)).check(Schema.isMaxLength(500)) })
const MonthlyRow = Schema.Struct({
  draft: Draft, errors: Schema.Array(Schema.Struct({ cell: Optional(DraftCell), reason: Schema.String })),
  result: Optional(LegacyResult),
})
const MonthlyValue = Schema.Struct({
  view: Schema.Struct({
    data: Schema.Record(Schema.String, Json),
    versions: Schema.Record(Schema.String, Schema.Struct({ version: NonNegativeInt, by: Schema.String })),
  }),
  before: Optional(MonthlyGrid), after: Optional(MonthlyGrid), rows: Schema.Array(MonthlyRow),
})
const HostFailure = Schema.Struct({
  status: Schema.Literals(["denied", "stale", "conflict", "provider-conflict", "failed", "needs-input", "invalid", "unavailable"]),
  reason: Optional(Schema.String),
})
const MonthlyOutput = Schema.Union([
  Schema.Struct({ status: Schema.Literal("ok"), value: MonthlyValue }),
  HostFailure,
])
const Period = Schema.Struct({ start: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)), end: Schema.String.check(Schema.isPattern(/^\d{4}-\d{2}-\d{2}$/)) })
const CaseRef = Schema.Struct({ id: NonEmpty, incarnation: NonEmpty, version: NonNegativeInt })
const ForecastInput = Schema.Struct({
  baseRef: NonEmpty, candidateRef: NonEmpty, period: Period, currency: NonEmpty, caseRef: CaseRef,
})
const ForecastOutput = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"),
    value: Schema.Struct({
      forecastComparison: Json, selectedPeriod: Period, currency: Schema.String,
      sourceRefs: Schema.Array(Json),
      registeredReasons: Schema.Array(Schema.Struct({
        id: Schema.String, text: Schema.String, evidenceRefs: Schema.Array(Json),
      })),
      importPreview: Optional(Json),
    }),
  }),
  HostFailure,
])
// The monthly wire schema accepts producer months 1..12 ONLY. A separate UI-edge
// adapter below converts 0..11 exactly once, before invoking this closed binding.
/** domain.page.CAP17 — SfDomainPageCap17, domain.view + render(page="Overview") fields/derivations only. */
export const SfDomainPageCap17 = {
  operationId: "domain.page.CAP17" as const,
  input: Queries.CAP17,
  output: pageResult("CAP17"),
  method: "GET" as const,
  pathTemplate: "{mount}/api/ui/pages/CAP17",
  effect: "read" as const,
  responseMode: "json" as const,
} as const

/** domain.command.CAP17.import-workbook — SfDomainCommandCap17ImportWorkbook, decodeCommand + domain.execute(page="Overview",action="import-workbook"). */
export const SfDomainCommandCap17ImportWorkbook = {
  operationId: "domain.command.CAP17.import-workbook" as const,
  input: legacyInput("Overview", "import-workbook", CommandValues.CAP17["import-workbook"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Overview"} as const,
  fixedBodyDiscriminator: {"page":"Overview","action":"import-workbook"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.page.CAP18 — SfDomainPageCap18, domain.view + render(page="OPEX") fields/derivations only. */
export const SfDomainPageCap18 = {
  operationId: "domain.page.CAP18" as const,
  input: Queries.CAP18,
  output: pageResult("CAP18"),
  method: "GET" as const,
  pathTemplate: "{mount}/api/ui/pages/CAP18",
  effect: "read" as const,
  responseMode: "json" as const,
} as const

/** domain.command.CAP18.save — SfDomainCommandCap18Save, decodeCommand + domain.execute(page="OPEX",action="save"). */
export const SfDomainCommandCap18Save = {
  operationId: "domain.command.CAP18.save" as const,
  input: legacyInput("OPEX", "save", CommandValues.CAP18["save"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"OPEX"} as const,
  fixedBodyDiscriminator: {"page":"OPEX","action":"save"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP18.delete — SfDomainCommandCap18Delete, decodeCommand + domain.execute(page="OPEX",action="delete"). */
export const SfDomainCommandCap18Delete = {
  operationId: "domain.command.CAP18.delete" as const,
  input: legacyInput("OPEX", "delete", CommandValues.CAP18["delete"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"OPEX"} as const,
  fixedBodyDiscriminator: {"page":"OPEX","action":"delete"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP18.spread — SfDomainCommandCap18Spread, decodeCommand + domain.execute(page="OPEX",action="spread"). */
export const SfDomainCommandCap18Spread = {
  operationId: "domain.command.CAP18.spread" as const,
  input: legacyInput("OPEX", "spread", CommandValues.CAP18["spread"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"OPEX"} as const,
  fixedBodyDiscriminator: {"page":"OPEX","action":"spread"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP18.reset — SfDomainCommandCap18Reset, decodeCommand + domain.execute(page="OPEX",action="reset"). */
export const SfDomainCommandCap18Reset = {
  operationId: "domain.command.CAP18.reset" as const,
  input: legacyInput("OPEX", "reset", CommandValues.CAP18["reset"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"OPEX"} as const,
  fixedBodyDiscriminator: {"page":"OPEX","action":"reset"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP18.import-workbook — SfDomainCommandCap18ImportWorkbook, decodeCommand + domain.execute(page="OPEX",action="import-workbook"). */
export const SfDomainCommandCap18ImportWorkbook = {
  operationId: "domain.command.CAP18.import-workbook" as const,
  input: legacyInput("OPEX", "import-workbook", CommandValues.CAP18["import-workbook"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"OPEX"} as const,
  fixedBodyDiscriminator: {"page":"OPEX","action":"import-workbook"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.page.CAP19 — SfDomainPageCap19, domain.view + render(page="CAPEX") fields/derivations only. */
export const SfDomainPageCap19 = {
  operationId: "domain.page.CAP19" as const,
  input: Queries.CAP19,
  output: pageResult("CAP19"),
  method: "GET" as const,
  pathTemplate: "{mount}/api/ui/pages/CAP19",
  effect: "read" as const,
  responseMode: "json" as const,
} as const

/** domain.command.CAP19.save — SfDomainCommandCap19Save, decodeCommand + domain.execute(page="CAPEX",action="save"). */
export const SfDomainCommandCap19Save = {
  operationId: "domain.command.CAP19.save" as const,
  input: legacyInput("CAPEX", "save", CommandValues.CAP19["save"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"CAPEX"} as const,
  fixedBodyDiscriminator: {"page":"CAPEX","action":"save"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP19.delete — SfDomainCommandCap19Delete, decodeCommand + domain.execute(page="CAPEX",action="delete"). */
export const SfDomainCommandCap19Delete = {
  operationId: "domain.command.CAP19.delete" as const,
  input: legacyInput("CAPEX", "delete", CommandValues.CAP19["delete"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"CAPEX"} as const,
  fixedBodyDiscriminator: {"page":"CAPEX","action":"delete"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP19.spread — SfDomainCommandCap19Spread, decodeCommand + domain.execute(page="CAPEX",action="spread"). */
export const SfDomainCommandCap19Spread = {
  operationId: "domain.command.CAP19.spread" as const,
  input: legacyInput("CAPEX", "spread", CommandValues.CAP19["spread"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"CAPEX"} as const,
  fixedBodyDiscriminator: {"page":"CAPEX","action":"spread"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP19.reset — SfDomainCommandCap19Reset, decodeCommand + domain.execute(page="CAPEX",action="reset"). */
export const SfDomainCommandCap19Reset = {
  operationId: "domain.command.CAP19.reset" as const,
  input: legacyInput("CAPEX", "reset", CommandValues.CAP19["reset"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"CAPEX"} as const,
  fixedBodyDiscriminator: {"page":"CAPEX","action":"reset"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP19.import-workbook — SfDomainCommandCap19ImportWorkbook, decodeCommand + domain.execute(page="CAPEX",action="import-workbook"). */
export const SfDomainCommandCap19ImportWorkbook = {
  operationId: "domain.command.CAP19.import-workbook" as const,
  input: legacyInput("CAPEX", "import-workbook", CommandValues.CAP19["import-workbook"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"CAPEX"} as const,
  fixedBodyDiscriminator: {"page":"CAPEX","action":"import-workbook"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.page.CAP20 — SfDomainPageCap20, domain.view + render(page="Headcount") fields/derivations only. */
export const SfDomainPageCap20 = {
  operationId: "domain.page.CAP20" as const,
  input: Queries.CAP20,
  output: pageResult("CAP20"),
  method: "GET" as const,
  pathTemplate: "{mount}/api/ui/pages/CAP20",
  effect: "read" as const,
  responseMode: "json" as const,
} as const

/** domain.command.CAP20.save — SfDomainCommandCap20Save, decodeCommand + domain.execute(page="Headcount",action="save"). */
export const SfDomainCommandCap20Save = {
  operationId: "domain.command.CAP20.save" as const,
  input: legacyInput("Headcount", "save", CommandValues.CAP20["save"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Headcount"} as const,
  fixedBodyDiscriminator: {"page":"Headcount","action":"save"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP20.delete — SfDomainCommandCap20Delete, decodeCommand + domain.execute(page="Headcount",action="delete"). */
export const SfDomainCommandCap20Delete = {
  operationId: "domain.command.CAP20.delete" as const,
  input: legacyInput("Headcount", "delete", CommandValues.CAP20["delete"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Headcount"} as const,
  fixedBodyDiscriminator: {"page":"Headcount","action":"delete"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP20.sync — SfDomainCommandCap20Sync, decodeCommand + domain.execute(page="Headcount",action="sync"). */
export const SfDomainCommandCap20Sync = {
  operationId: "domain.command.CAP20.sync" as const,
  input: legacyInput("Headcount", "sync", CommandValues.CAP20["sync"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Headcount"} as const,
  fixedBodyDiscriminator: {"page":"Headcount","action":"sync"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP20.import-workbook — SfDomainCommandCap20ImportWorkbook, decodeCommand + domain.execute(page="Headcount",action="import-workbook"). */
export const SfDomainCommandCap20ImportWorkbook = {
  operationId: "domain.command.CAP20.import-workbook" as const,
  input: legacyInput("Headcount", "import-workbook", CommandValues.CAP20["import-workbook"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Headcount"} as const,
  fixedBodyDiscriminator: {"page":"Headcount","action":"import-workbook"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.page.CAP21 — SfDomainPageCap21, domain.view + render(page="Entities & allocations") fields/derivations only. */
export const SfDomainPageCap21 = {
  operationId: "domain.page.CAP21" as const,
  input: Queries.CAP21,
  output: pageResult("CAP21"),
  method: "GET" as const,
  pathTemplate: "{mount}/api/ui/pages/CAP21",
  effect: "read" as const,
  responseMode: "json" as const,
} as const

/** domain.command.CAP21.save — SfDomainCommandCap21Save, decodeCommand + domain.execute(page="Entities & allocations",action="save"). */
export const SfDomainCommandCap21Save = {
  operationId: "domain.command.CAP21.save" as const,
  input: legacyInput("Entities & allocations", "save", CommandValues.CAP21["save"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Entities & allocations"} as const,
  fixedBodyDiscriminator: {"page":"Entities & allocations","action":"save"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP21.delete — SfDomainCommandCap21Delete, decodeCommand + domain.execute(page="Entities & allocations",action="delete"). */
export const SfDomainCommandCap21Delete = {
  operationId: "domain.command.CAP21.delete" as const,
  input: legacyInput("Entities & allocations", "delete", CommandValues.CAP21["delete"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Entities & allocations"} as const,
  fixedBodyDiscriminator: {"page":"Entities & allocations","action":"delete"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP21.common — SfDomainCommandCap21Common, decodeCommand + domain.execute(page="Entities & allocations",action="common"). */
export const SfDomainCommandCap21Common = {
  operationId: "domain.command.CAP21.common" as const,
  input: legacyInput("Entities & allocations", "common", CommandValues.CAP21["common"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Entities & allocations"} as const,
  fixedBodyDiscriminator: {"page":"Entities & allocations","action":"common"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP21.import-workbook — SfDomainCommandCap21ImportWorkbook, decodeCommand + domain.execute(page="Entities & allocations",action="import-workbook"). */
export const SfDomainCommandCap21ImportWorkbook = {
  operationId: "domain.command.CAP21.import-workbook" as const,
  input: legacyInput("Entities & allocations", "import-workbook", CommandValues.CAP21["import-workbook"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Entities & allocations"} as const,
  fixedBodyDiscriminator: {"page":"Entities & allocations","action":"import-workbook"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.page.CAP22 — SfDomainPageCap22, domain.view + render(page="FX rates") fields/derivations only. */
export const SfDomainPageCap22 = {
  operationId: "domain.page.CAP22" as const,
  input: Queries.CAP22,
  output: pageResult("CAP22"),
  method: "GET" as const,
  pathTemplate: "{mount}/api/ui/pages/CAP22",
  effect: "read" as const,
  responseMode: "json" as const,
} as const

/** domain.command.CAP22.save — SfDomainCommandCap22Save, decodeCommand + domain.execute(page="FX rates",action="save"). */
export const SfDomainCommandCap22Save = {
  operationId: "domain.command.CAP22.save" as const,
  input: legacyInput("FX rates", "save", CommandValues.CAP22["save"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"FX rates"} as const,
  fixedBodyDiscriminator: {"page":"FX rates","action":"save"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP22.delete — SfDomainCommandCap22Delete, decodeCommand + domain.execute(page="FX rates",action="delete"). */
export const SfDomainCommandCap22Delete = {
  operationId: "domain.command.CAP22.delete" as const,
  input: legacyInput("FX rates", "delete", CommandValues.CAP22["delete"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"FX rates"} as const,
  fixedBodyDiscriminator: {"page":"FX rates","action":"delete"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP22.import-workbook — SfDomainCommandCap22ImportWorkbook, decodeCommand + domain.execute(page="FX rates",action="import-workbook"). */
export const SfDomainCommandCap22ImportWorkbook = {
  operationId: "domain.command.CAP22.import-workbook" as const,
  input: legacyInput("FX rates", "import-workbook", CommandValues.CAP22["import-workbook"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"FX rates"} as const,
  fixedBodyDiscriminator: {"page":"FX rates","action":"import-workbook"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.page.CAP23 — SfDomainPageCap23, domain.view + render(page="Versions") fields/derivations only. */
export const SfDomainPageCap23 = {
  operationId: "domain.page.CAP23" as const,
  input: Queries.CAP23,
  output: pageResult("CAP23"),
  method: "GET" as const,
  pathTemplate: "{mount}/api/ui/pages/CAP23",
  effect: "read" as const,
  responseMode: "json" as const,
} as const

/** domain.command.CAP23.save — SfDomainCommandCap23Save, decodeCommand + domain.execute(page="Versions",action="save"). */
export const SfDomainCommandCap23Save = {
  operationId: "domain.command.CAP23.save" as const,
  input: legacyInput("Versions", "save", CommandValues.CAP23["save"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Versions"} as const,
  fixedBodyDiscriminator: {"page":"Versions","action":"save"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP23.copy — SfDomainCommandCap23Copy, decodeCommand + domain.execute(page="Versions",action="copy"). */
export const SfDomainCommandCap23Copy = {
  operationId: "domain.command.CAP23.copy" as const,
  input: legacyInput("Versions", "copy", CommandValues.CAP23["copy"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Versions"} as const,
  fixedBodyDiscriminator: {"page":"Versions","action":"copy"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP23.official — SfDomainCommandCap23Official, decodeCommand + domain.execute(page="Versions",action="official"). */
export const SfDomainCommandCap23Official = {
  operationId: "domain.command.CAP23.official" as const,
  input: legacyInput("Versions", "official", CommandValues.CAP23["official"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Versions"} as const,
  fixedBodyDiscriminator: {"page":"Versions","action":"official"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP23.lock — SfDomainCommandCap23Lock, decodeCommand + domain.execute(page="Versions",action="lock"). */
export const SfDomainCommandCap23Lock = {
  operationId: "domain.command.CAP23.lock" as const,
  input: legacyInput("Versions", "lock", CommandValues.CAP23["lock"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Versions"} as const,
  fixedBodyDiscriminator: {"page":"Versions","action":"lock"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP23.unlock — SfDomainCommandCap23Unlock, decodeCommand + domain.execute(page="Versions",action="unlock"). */
export const SfDomainCommandCap23Unlock = {
  operationId: "domain.command.CAP23.unlock" as const,
  input: legacyInput("Versions", "unlock", CommandValues.CAP23["unlock"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Versions"} as const,
  fixedBodyDiscriminator: {"page":"Versions","action":"unlock"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP23.delete — SfDomainCommandCap23Delete, decodeCommand + domain.execute(page="Versions",action="delete"). */
export const SfDomainCommandCap23Delete = {
  operationId: "domain.command.CAP23.delete" as const,
  input: legacyInput("Versions", "delete", CommandValues.CAP23["delete"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Versions"} as const,
  fixedBodyDiscriminator: {"page":"Versions","action":"delete"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** domain.command.CAP23.import-workbook — SfDomainCommandCap23ImportWorkbook, decodeCommand + domain.execute(page="Versions",action="import-workbook"). */
export const SfDomainCommandCap23ImportWorkbook = {
  operationId: "domain.command.CAP23.import-workbook" as const,
  input: legacyInput("Versions", "import-workbook", CommandValues.CAP23["import-workbook"]),
  output: LegacyResult,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"page":"Versions"} as const,
  fixedBodyDiscriminator: {"page":"Versions","action":"import-workbook"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 2097152,
  responseMode: "json" as const,
} as const

/** planner.monthly.preview — SfPlannerMonthlyPreview, handleSfPlannerMonthly;monthlyInput;runtime.plannerMonthly.preview. */
export const SfPlannerMonthlyPreview = {
  operationId: "planner.monthly.preview" as const,
  input: Schema.Struct({ action: Schema.Literal("preview"), input: MonthlyRequest }),
  output: MonthlyOutput,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"sf":"workbench-planner"} as const,
  fixedBodyDiscriminator: {"action":"preview"} as const,
  effect: "preview" as const,
  maxRequestBytes: 65536,
  responseMode: "json" as const,
} as const

/** planner.monthly.apply — SfPlannerMonthlyApply, handleSfPlannerMonthly;monthlyInput;runtime.plannerMonthly.apply. */
export const SfPlannerMonthlyApply = {
  operationId: "planner.monthly.apply" as const,
  input: Schema.Struct({ action: Schema.Literal("apply"), input: MonthlyRequest }),
  output: MonthlyOutput,
  method: "POST" as const,
  pathTemplate: "{mount}/planner",
  fixedQuery: {"sf":"workbench-planner"} as const,
  fixedBodyDiscriminator: {"action":"apply"} as const,
  effect: "mutation" as const,
  maxRequestBytes: 65536,
  responseMode: "json" as const,
} as const

/** planner.forecast.prepare — SfPlannerForecastPrepare, decodeSfOperationInput(sf_forecast_compare) + caseRef;runtime.forecastInputs.prepare. */
export const SfPlannerForecastPrepare = {
  operationId: "planner.forecast.prepare" as const,
  input: ForecastInput,
  output: ForecastOutput,
  method: "POST" as const,
  pathTemplate: "{mount}/{surface}",
  fixedQuery: {"sf":"workbench-forecast"} as const,
  effect: "prepare" as const,
  maxRequestBytes: 65536,
  responseMode: "json" as const,
} as const

/** Frozen 39-operation binding, no unknown action route and no operation-level fallback. */
export const SfPlanner = {
  operations: {
    "domain.page.CAP17": SfDomainPageCap17,
    "domain.command.CAP17.import-workbook": SfDomainCommandCap17ImportWorkbook,
    "domain.page.CAP18": SfDomainPageCap18,
    "domain.command.CAP18.save": SfDomainCommandCap18Save,
    "domain.command.CAP18.delete": SfDomainCommandCap18Delete,
    "domain.command.CAP18.spread": SfDomainCommandCap18Spread,
    "domain.command.CAP18.reset": SfDomainCommandCap18Reset,
    "domain.command.CAP18.import-workbook": SfDomainCommandCap18ImportWorkbook,
    "domain.page.CAP19": SfDomainPageCap19,
    "domain.command.CAP19.save": SfDomainCommandCap19Save,
    "domain.command.CAP19.delete": SfDomainCommandCap19Delete,
    "domain.command.CAP19.spread": SfDomainCommandCap19Spread,
    "domain.command.CAP19.reset": SfDomainCommandCap19Reset,
    "domain.command.CAP19.import-workbook": SfDomainCommandCap19ImportWorkbook,
    "domain.page.CAP20": SfDomainPageCap20,
    "domain.command.CAP20.save": SfDomainCommandCap20Save,
    "domain.command.CAP20.delete": SfDomainCommandCap20Delete,
    "domain.command.CAP20.sync": SfDomainCommandCap20Sync,
    "domain.command.CAP20.import-workbook": SfDomainCommandCap20ImportWorkbook,
    "domain.page.CAP21": SfDomainPageCap21,
    "domain.command.CAP21.save": SfDomainCommandCap21Save,
    "domain.command.CAP21.delete": SfDomainCommandCap21Delete,
    "domain.command.CAP21.common": SfDomainCommandCap21Common,
    "domain.command.CAP21.import-workbook": SfDomainCommandCap21ImportWorkbook,
    "domain.page.CAP22": SfDomainPageCap22,
    "domain.command.CAP22.save": SfDomainCommandCap22Save,
    "domain.command.CAP22.delete": SfDomainCommandCap22Delete,
    "domain.command.CAP22.import-workbook": SfDomainCommandCap22ImportWorkbook,
    "domain.page.CAP23": SfDomainPageCap23,
    "domain.command.CAP23.save": SfDomainCommandCap23Save,
    "domain.command.CAP23.copy": SfDomainCommandCap23Copy,
    "domain.command.CAP23.official": SfDomainCommandCap23Official,
    "domain.command.CAP23.lock": SfDomainCommandCap23Lock,
    "domain.command.CAP23.unlock": SfDomainCommandCap23Unlock,
    "domain.command.CAP23.delete": SfDomainCommandCap23Delete,
    "domain.command.CAP23.import-workbook": SfDomainCommandCap23ImportWorkbook,
    "planner.monthly.preview": SfPlannerMonthlyPreview,
    "planner.monthly.apply": SfPlannerMonthlyApply,
    "planner.forecast.prepare": SfPlannerForecastPrepare,
  },
} as const
