/**
 * A11: CAP11 IT Operations and CAP12 IT Security KPIs.
 * The legacy domain remains authoritative for writes, ACL, versions and errors.
 * These are only the frozen browser-safe wire projections of its existing shapes.
 */
import { Schema } from "effect"
import { optional } from "../schema"
import { SfContextStamp } from "./context"

const Version = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const Year = Schema.Int.check(Schema.isBetween({ minimum: 2024, maximum: 2027 }))
const Month = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 }))
const SourceYear = Schema.Union([Year, Schema.String.check(Schema.makeFilter(
  (value) => /^202[4-7]$/.test(value) || "Year must be 2024–2027",
))])
const SourceMonth = Schema.Union([Month, Schema.String.check(Schema.makeFilter(
  (value) => /^(?:[1-9]|1[0-2])$/.test(value) || "Month must be 1–12",
))])
const NumberInput = Schema.Union([Schema.Finite, Schema.String, Schema.Null]).check(Schema.makeFilter(
  (value) => value === null || value === "" ||
    (typeof value === "string" && !value.trim() ? false :
      Number.isFinite(Number(value)) && Number(value) >= 0) ||
    "Nonnegative finite number required",
))
const BooleanInput = Schema.Union([Schema.Boolean, Schema.Literals(["true", "false", "yes", "no", ""])])
const DateInput = Schema.String.check(Schema.makeFilter(
  (value) => /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value || "Valid calendar date required",
))
const Text = optional(Schema.String)
const Num = optional(NumberInput)
const Bool = optional(BooleanInput)
const Period = { year: SourceYear, month: SourceMonth } as const
const Base = {
  id: optional(Schema.String),
  version: Version,
  confirmed: optional(Schema.Boolean),
} as const
const RowId = Schema.Union([Schema.String, Schema.Finite])
const StoredScalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null])
type Json = string | number | boolean | null | readonly Json[] | { readonly [key: string]: Json }
const JsonValue: Schema.Schema<Json> = Schema.suspend(() => Schema.Union([
  Schema.String, Schema.Finite, Schema.Boolean, Schema.Null,
  Schema.Array(JsonValue), Schema.Record(Schema.String, JsonValue),
]))
const Fields = {
  tickets: [
    "opsTickets", "opsSLA", "opsHeatmap", "opsCats", "opsHmItems",
  ],
  security: ["secKpi", "secActions", "secIncidents", "secPhishing"],
} as const
export const SfOperationsKpiFields = [
  "training", "assessment", "scan", "patch", "patchEndpoint", "patchServer",
  "socCritical", "socHigh", "socMedium", "socLow", "socPending",
  "socTP", "socFP", "socEPS", "socIPs", "socClosure",
] as const
export const SfOperationsCampaignFields = [
  "targeted", "noInteraction", "openedOnly", "clicked", "entered",
  "reported", "trainingCompletion", "avgMinutes",
] as const

const Names = Schema.Union([
  Schema.String.check(Schema.makeFilter((s) => {
    const values = s.split("\n").map((name) => name.trim()).filter(Boolean)
    return values.every((name) => !name.includes("|")) &&
      new Set(values).size === values.length || "Unique names required; pipe is reserved"
  })),
  Schema.Array(Schema.NonEmptyString).check(Schema.makeFilter((names) => {
    const values = names.map((name) => name.trim())
    return values.every((name) => !!name && !name.includes("|")) &&
      new Set(values).size === values.length || "Unique names required; pipe is reserved"
  })),
])
const TicketMetrics = Schema.Record(Schema.String, NumberInput).check(Schema.makeFilter((data) =>
  Object.keys(data).every((key) => /^[^|]+\|(Incidents|Service Requests)\|(Initial Balance|Open|Closed)$/.test(key)) ||
  "Ticket metric key not recognized",
))
const MonthlyTickets = Schema.Record(Schema.String, Schema.Union([NumberInput, SourceYear, SourceMonth]))
  .check(Schema.makeFilter((data) => {
    const y = data.year
    const m = data.month
    return y !== undefined && m !== undefined &&
      Number.isInteger(Number(y)) && Number(y) >= 2024 && Number(y) <= 2027 &&
      Number.isInteger(Number(m)) && Number(m) >= 1 && Number(m) <= 12 &&
      Object.keys(data).every((key) =>
        key === "year" || key === "month" ||
        /^[^|]+\|(Incidents|Service Requests)\|(Initial Balance|Open|Closed)$/.test(key)) ||
      "Only the source year, month and ticket metrics are allowed"
  }))
const HeatmapRecord = Schema.Struct({
  item: Schema.NonEmptyString, p1: Num, p2: Num, tickets: Num, comments: Text,
})
const SlaRecord = Schema.Struct({ incSLA: Num, svcSLA: Num, avail: Num })
const Department = Schema.Struct({
  name: Schema.NonEmptyString, users: Num, failed: Num, entered: Num, reported: Num,
})
const Consequences = Schema.Array(Schema.Literals([
  "Data exfiltration", "Data loss", "Service unavailability",
]))
// The legacy HTML client sends these two fieldsets as JSON strings, while
// native clients may send the same exact structured values.
const SourceJsonText = Schema.String.check(Schema.makeFilter((value) => {
  try { return Array.isArray(JSON.parse(value)) || "Expected JSON array" }
  catch { return "Expected JSON array" }
}))
const SourceObjectText = Schema.String.check(Schema.makeFilter((value) => {
  try {
    const parsed: unknown = JSON.parse(value)
    return !!parsed && typeof parsed === "object" && !Array.isArray(parsed) ||
      "Expected JSON object"
  } catch { return "Expected JSON object" }
}))
const OpsImportValues = Schema.Struct({
  ...Period, tickets: Schema.Union([TicketMetrics, SourceObjectText]),
  sla: optional(Schema.Union([SlaRecord, SourceObjectText])),
  heatmap: optional(Schema.Union([Schema.Array(HeatmapRecord), SourceJsonText])),
  categoriesVersion: optional(Version), itemsVersion: optional(Version),
})
const KpiValues = Schema.Struct({
  ...Period, notes: Text,
  training: Num, assessment: Num, scan: Num, patch: Num,
  patchEndpoint: Num, patchServer: Num, socCritical: Num, socHigh: Num,
  socMedium: Num, socLow: Num, socPending: Num, socTP: Num,
  socFP: Num, socEPS: Num, socIPs: Num, socClosure: Num,
})
const ActionValues = Schema.Struct({ text: Schema.String, done: Bool })
const IncidentValues = Schema.Struct({
  title: Schema.NonEmptyString, date: DateInput, impact: Text, notes: Text,
  contained: Bool, remediated: Bool, rootCause: Bool,
  consequences: optional(Schema.Union([Consequences, SourceJsonText])),
})
const CampaignValues = Schema.Struct({
  name: Schema.NonEmptyString, start: Text, end: Text, notes: Text,
  targeted: Num, noInteraction: Num, openedOnly: Num, clicked: Num,
  entered: Num, reported: Num, trainingCompletion: Num, avgMinutes: Num,
  departments: optional(Schema.Union([Schema.Array(Department), SourceJsonText])),
}).check(Schema.makeFilter((v) =>
  (!v.start || /^\d{4}-\d{2}-\d{2}$/.test(v.start) &&
    Number.isFinite(Date.parse(v.start)) &&
    new Date(v.start).toISOString().slice(0, 10) === v.start) &&
  (!v.end || /^\d{4}-\d{2}-\d{2}$/.test(v.end) &&
    Number.isFinite(Date.parse(v.end)) &&
    new Date(v.end).toISOString().slice(0, 10) === v.end) ||
  "Campaign dates must be valid dates",
))

export const SfOperationsSelection = {
  CAP11: Schema.Struct({
    year: optional(Year), own: optional(Year), opsYear: optional(Year),
    month: optional(Month), operationsMonth: optional(Month),
  }),
  CAP12: Schema.Struct({
    year: optional(Year), own: optional(Year), secYear: optional(Year),
    month: optional(Month), securityMonth: optional(Month),
  }),
} as const
const SelectionResolvedCAP11 = Schema.Struct({
  ...SfOperationsSelection.CAP11.fields, year: Year, month: Month,
})
const SelectionResolvedCAP12 = Schema.Struct({
  ...SfOperationsSelection.CAP12.fields, year: Year, month: Month,
})
const Versions = Schema.Record(Schema.String, Version)
const SourceRowId = optional(RowId)
const NumberStored = optional(Schema.NullOr(Schema.Finite))
const StringStored = optional(Schema.NullOr(Schema.String))
const BooleanStored = optional(Schema.NullOr(Schema.Boolean))
const OperationsTicketRow = Schema.Record(Schema.String, StoredScalar)
  .check(Schema.makeFilter((row) => Object.keys(row).every((key) =>
    ["id", "year", "month"].includes(key) ||
    /^[^|]+\|(Incidents|Service Requests)\|(Initial Balance|Open|Closed)$/.test(key)) ||
    "Unknown ticket row field",
  ))
const OperationsSlaRow = Schema.Struct({
  id: SourceRowId, year: optional(Year), month: optional(Month),
  incSLA: NumberStored, svcSLA: NumberStored, avail: NumberStored,
})
const OperationsHeatmapRow = Schema.Struct({
  id: SourceRowId, year: optional(Year), month: optional(Month),
  item: StringStored, p1: NumberStored, p2: NumberStored,
  tickets: NumberStored, comments: StringStored,
})
const SecurityKpiRow = Schema.Struct({
  id: SourceRowId, year: optional(Year), month: optional(Month),
  notes: StringStored,
  training: NumberStored, assessment: NumberStored, scan: NumberStored,
  patch: NumberStored, patchEndpoint: NumberStored, patchServer: NumberStored,
  socCritical: NumberStored, socHigh: NumberStored, socMedium: NumberStored,
  socLow: NumberStored, socPending: NumberStored, socTP: NumberStored,
  socFP: NumberStored, socEPS: NumberStored, socIPs: NumberStored,
  socClosure: NumberStored,
})
const SecurityActionRow = Schema.Struct({
  id: SourceRowId, text: StringStored, done: BooleanStored,
})
const SecurityIncidentRow = Schema.Struct({
  id: SourceRowId, title: StringStored, date: StringStored,
  impact: StringStored, notes: StringStored,
  contained: BooleanStored, remediated: BooleanStored, rootCause: BooleanStored,
  consequences: optional(Consequences),
})
const SecurityDepartmentRow = Schema.Struct({
  name: StringStored, users: NumberStored, failed: NumberStored,
  entered: NumberStored, reported: NumberStored,
})
const SecurityCampaignRow = Schema.Struct({
  id: SourceRowId, name: StringStored, start: StringStored,
  end: StringStored, notes: StringStored,
  targeted: NumberStored, noInteraction: NumberStored,
  openedOnly: NumberStored, clicked: NumberStored,
  entered: NumberStored, reported: NumberStored,
  trainingCompletion: NumberStored, avgMinutes: NumberStored,
  departments: optional(Schema.Array(SecurityDepartmentRow)),
})
const OperationsDisplay = Schema.Struct({
  opened: Schema.Array(Schema.NullOr(Schema.Finite)),
  closed: Schema.Array(Schema.NullOr(Schema.Finite)),
  heatmap: Schema.Array(Schema.Struct({
    item: Schema.String, month: Month,
    p1: Schema.Finite, p2: Schema.Finite, tickets: Schema.Finite,
    dot: Schema.String, background: Schema.String,
  })),
})
const SecurityDisplay = Schema.Struct({
  kpis: Schema.Array(Schema.Struct({
    key: Schema.String, value: Schema.Union([Schema.Null, Schema.String, Schema.Finite]),
    status: Schema.Literals(["No data", "Good", "Moderate", "High risk"]),
  })),
  campaigns: Schema.Array(Schema.Struct({
    id: Schema.String,
    failureRate: Schema.NullOr(Schema.Finite),
    enteredRate: Schema.NullOr(Schema.Finite),
    reportedRate: Schema.NullOr(Schema.Finite),
    failureTone: Schema.Literals(["none", "good", "moderate", "high"]),
  })),
  openIncidents: Version,
})
export const SfOperationsPageData = {
  CAP11: Schema.Struct({
    opsTickets: optional(Schema.NullOr(Schema.Array(OperationsTicketRow))),
    opsSLA: optional(Schema.NullOr(Schema.Array(OperationsSlaRow))),
    opsHeatmap: optional(Schema.NullOr(Schema.Array(OperationsHeatmapRow))),
    opsCats: optional(Schema.NullOr(Schema.Array(Schema.String))),
    opsHmItems: optional(Schema.NullOr(Schema.Array(Schema.String))),
    display: optional(OperationsDisplay),
  }),
  CAP12: Schema.Struct({
    secKpi: optional(Schema.NullOr(Schema.Array(SecurityKpiRow))),
    secActions: optional(Schema.NullOr(Schema.Array(SecurityActionRow))),
    secIncidents: optional(Schema.NullOr(Schema.Array(SecurityIncidentRow))),
    secPhishing: optional(Schema.NullOr(Schema.Array(SecurityCampaignRow))),
    display: optional(SecurityDisplay),
  }),
} as const
export const SfOperationsLegacyResult = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), warnings: optional(Schema.NullOr(Schema.Array(Schema.String))) }),
  Schema.Struct({
    ok: Schema.Literal(false), status: Schema.Literals([400, 403, 404, 409, 422, 503]),
    errors: optional(Schema.NullOr(Schema.Array(Schema.String))),
    fieldErrors: optional(Schema.Array(Schema.Struct({
      field: Schema.String, message: Schema.String,
    }))),
    stored: optional(JsonValue), by: optional(Schema.String),
    currentVersionCAS: optional(Version),
  }),
])
const PageFailure = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({ status: Schema.Literal("needs-input"), reason: Schema.String }),
  Schema.Struct({ status: Schema.Literal("stale"), reason: Schema.String }),
  Schema.Struct({ status: Schema.Literal("unavailable"), reason: Schema.String }),
])
export const SfDomainPageCap11 = {
  operationId: "domain.page.CAP11",
  input: SfOperationsSelection.CAP11,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"), context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP11"), selection: SelectionResolvedCAP11,
        data: SfOperationsPageData.CAP11, versions: Versions,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    PageFailure,
  ]),
} as const
export const SfDomainPageCap12 = {
  operationId: "domain.page.CAP12",
  input: SfOperationsSelection.CAP12,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"), context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP12"), selection: SelectionResolvedCAP12,
        data: SfOperationsPageData.CAP12, versions: Versions,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    PageFailure,
  ]),
} as const
export const SfDomainCommandCap11SaveCategories = {
  operationId: "domain.command.CAP11.save-categories",
  input: Schema.Struct({ ...Base, values: Schema.Struct({ names: Names }) }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap11SaveItems = {
  operationId: "domain.command.CAP11.save-items",
  input: Schema.Struct({ ...Base, values: Schema.Struct({ names: Names }) }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap11SaveTickets = {
  operationId: "domain.command.CAP11.save-tickets",
  input: Schema.Struct({ ...Base, values: MonthlyTickets }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap11SaveSla = {
  operationId: "domain.command.CAP11.save-sla",
  input: Schema.Struct({ ...Base, values: Schema.Struct({ ...Period, ...SlaRecord.fields }) }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap11SaveHeatmap = {
  operationId: "domain.command.CAP11.save-heatmap",
  input: Schema.Struct({ ...Base, values: Schema.Struct({ ...Period, ...HeatmapRecord.fields }) }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap11ImportMonth = {
  operationId: "domain.command.CAP11.import-month",
  input: Schema.Struct({ ...Base, confirmed: Schema.Literal(true), values: OpsImportValues }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12SaveKpi = {
  operationId: "domain.command.CAP12.save-kpi",
  input: Schema.Struct({ ...Base, values: KpiValues }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12DeleteKpi = {
  operationId: "domain.command.CAP12.delete-kpi",
  input: Schema.Struct({ ...Base, values: Schema.Struct(Period) }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12SaveAction = {
  operationId: "domain.command.CAP12.save-action",
  input: Schema.Struct({ ...Base, values: ActionValues }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12DeleteAction = {
  operationId: "domain.command.CAP12.delete-action",
  input: Schema.Struct({ ...Base, id: Schema.NonEmptyString, values: Schema.Struct({}) }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12SaveIncident = {
  operationId: "domain.command.CAP12.save-incident",
  input: Schema.Struct({ ...Base, values: IncidentValues }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12DeleteIncident = {
  operationId: "domain.command.CAP12.delete-incident",
  input: Schema.Struct({ ...Base, id: Schema.NonEmptyString, values: Schema.Struct({}) }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12SaveCampaign = {
  operationId: "domain.command.CAP12.save-campaign",
  input: Schema.Struct({ ...Base, values: CampaignValues }),
  output: SfOperationsLegacyResult,
} as const
export const SfDomainCommandCap12DeleteCampaign = {
  operationId: "domain.command.CAP12.delete-campaign",
  input: Schema.Struct({ ...Base, id: Schema.NonEmptyString, values: Schema.Struct({}) }),
  output: SfOperationsLegacyResult,
} as const

/** The keys are exact catalog operation IDs. Never expose action:string dispatch. */
export const SfOperations = {
  operations: {
    "domain.page.CAP11": SfDomainPageCap11,
    "domain.command.CAP11.save-categories": SfDomainCommandCap11SaveCategories,
    "domain.command.CAP11.save-items": SfDomainCommandCap11SaveItems,
    "domain.command.CAP11.save-tickets": SfDomainCommandCap11SaveTickets,
    "domain.command.CAP11.save-sla": SfDomainCommandCap11SaveSla,
    "domain.command.CAP11.save-heatmap": SfDomainCommandCap11SaveHeatmap,
    "domain.command.CAP11.import-month": SfDomainCommandCap11ImportMonth,
    "domain.page.CAP12": SfDomainPageCap12,
    "domain.command.CAP12.save-kpi": SfDomainCommandCap12SaveKpi,
    "domain.command.CAP12.delete-kpi": SfDomainCommandCap12DeleteKpi,
    "domain.command.CAP12.save-action": SfDomainCommandCap12SaveAction,
    "domain.command.CAP12.delete-action": SfDomainCommandCap12DeleteAction,
    "domain.command.CAP12.save-incident": SfDomainCommandCap12SaveIncident,
    "domain.command.CAP12.delete-incident": SfDomainCommandCap12DeleteIncident,
    "domain.command.CAP12.save-campaign": SfDomainCommandCap12SaveCampaign,
    "domain.command.CAP12.delete-campaign": SfDomainCommandCap12DeleteCampaign,
  },
  sourceCollections: Fields,
} as const
