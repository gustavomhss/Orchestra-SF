import { Schema } from "effect"
import { NonNegativeInt, optional } from "../../schema"
import {
  SfDomainAmountInput, SfDomainMilestone, SfDomainPerformanceItem,
  SfDomainPerformanceSub, SfDomainVersionInput, SfDomainYears, SfDomainMonths,
} from "./fields"

/**
 * POSTs are source operations, not a generic execute authority. The dispatcher
 * adds the frozen page/action discriminator; callers cannot choose another one.
 */
export const SfDomainCommandBase = {
  id: optional(Schema.String),
  version: NonNegativeInt,
  confirmed: optional(Schema.Boolean),
} as const

const versions = optional(SfDomainVersionInput)
// Project imports accept decimal revision strings; other commands retain their own fallback semantics.
const projectVersionText = Schema.String.check(Schema.makeFilter((value) =>
  /^\d+$/.test(value) && Number.isSafeInteger(Number(value)) || "version must be a non-negative safe integer",
))
const projectVersions = Schema.Record(Schema.String, Schema.Union([NonNegativeInt, projectVersionText]))
const amount = SfDomainAmountInput
const scalar = Schema.Union([Schema.String, Schema.Finite, Schema.Boolean, Schema.Null])
const text = optional(Schema.String)
const finite = optional(Schema.Finite)

const projectEdit = {
  name: text, desc: text,
  status: optional(Schema.Literals(["Planning", "In Progress", "On Hold", "Completed"])),
  risk: optional(Schema.Literals(["Low", "Medium", "High"])),
  priority: text, pm: text, leaderId: text,
  start: text, end: text, budget: finite, spent: finite, pct: finite,
  notes: text, watch: optional(Schema.Boolean), watchList: optional(Schema.Boolean),
  milestones: optional(Schema.Array(SfDomainMilestone)),
} as const
const riskEdit = {
  title: text, action: text, responsible: text,
  name: text, desc: text, category: text,
  impact: optional(amount), probability: optional(amount),
  status: optional(Schema.Literals(["open", "mitigating", "monitoring", "closed"])),
  owner: text, ownerId: text, leaderId: text,
  mitigation: text, due: text, notes: text,
} as const
const contractEdit = {
  num: text, renewal: text, vendor: text, name: text,
  desc: text, category: text, owner: text, ownerId: text,
  start: text, end: text,
  amount: optional(amount),
  amtType: optional(Schema.Literals(["total", "monthly", "annual"])),
  renewType: optional(Schema.Literals(["fixed", "na", "auto"])),
  notice: text, eval: optional(Schema.Literals(["", "A", "B", "C", "D"])),
  notes: text, currency: text,
} as const
const stakeholderEdit = {
  position: text, name: text, title: text, company: text,
  department: text, role: text, email: text,
  biz: optional(amount), iti: optional(amount), perc: optional(amount),
  priority: text, owner: text, action: text, actions: text, notes: text,
} as const

export const SfDomainCommandValues = {
  users: Schema.Struct({
    year: SfDomainYears, month: SfDomainMonths, value: amount, versions,
  }),
  month: Schema.Struct({
    year: SfDomainYears, month: SfDomainMonths, versions,
  }),
  revenue: Schema.Struct({
    year: SfDomainYears, revenue: amount, versions,
  }),
  budgetSave: Schema.Struct({
    name: Schema.String, budget: amount, versions,
  }),
  budgetDelete: Schema.Struct({ versions }),
  budgetEntry: Schema.Struct({
    year: SfDomainYears, month: SfDomainMonths,
    ownerId: text, projId: text, projectId: text,
    budget: optional(amount), actual: optional(amount), forecast: optional(amount), versions,
  }),
  budgetDeviation: Schema.Struct({
    year: SfDomainYears, month: SfDomainMonths,
    flag: Schema.Literals(["", "dev-green", "dev-amber", "dev-red"]),
    text, versions,
  }),
  budgetAnnual: Schema.Struct({
    year: SfDomainYears, annual: amount,
    field: optional(Schema.Literals(["budget", "actual", "forecast"])), versions,
  }),
  budgetYearAmount: Schema.Struct({
    year: SfDomainYears, amount: optional(amount), versions,
  }),
  opexImport: Schema.Struct({
    year: SfDomainYears,
    rows: Schema.Array(Schema.Struct({
      name: text, Name: text, Owner: text, Leader: text,
      Annual: optional(amount), Total: optional(amount),
      months: optional(Schema.Union([
        Schema.Array(amount),
        Schema.Record(Schema.String, amount),
      ])),
      Jan: optional(amount), Feb: optional(amount), Mar: optional(amount),
      Apr: optional(amount), May: optional(amount), Jun: optional(amount),
      Jul: optional(amount), Aug: optional(amount), Sep: optional(amount),
      Oct: optional(amount), Nov: optional(amount), Dec: optional(amount),
    })),
    versions,
  }),
  projectSave: Schema.Struct({ ...projectEdit }),
  projectDelete: Schema.Struct({}),
  projectImport: Schema.Struct({
    mode: Schema.Literals(["update", "replace"]),
    rows: Schema.Array(Schema.Struct({
      ...projectEdit, name: Schema.String, _status: optional(Schema.Literals(["valid", "error"])),
    })),
    versions: projectVersions,
  }),
  milestoneSave: Schema.Struct({
    milestoneId: optional(Schema.String), name: Schema.String,
    date: text,
    status: Schema.Literals(["done", "in-progress", "upcoming", "late"]),
    notes: text,
  }),
  milestoneDelete: Schema.Struct({ milestoneId: Schema.String }),
  riskSave: Schema.Struct({ ...riskEdit }),
  riskDelete: Schema.Struct({}),
  contractSave: Schema.Struct({ ...contractEdit }),
  contractDelete: Schema.Struct({}),
  stakeholderSave: Schema.Struct({ ...stakeholderEdit }),
  stakeholderDelete: Schema.Struct({}),
  performanceSave: Schema.Struct({
    name: text, year: optional(Schema.Int),
    items: optional(Schema.Array(SfDomainPerformanceItem)),
  }),
  performanceItemSave: Schema.Struct({
    itemId: optional(Schema.String), name: text, description: text,
    totalWeight: finite, ownerWeight: finite, co1Weight: finite, co2Weight: finite,
    color: text,
  }),
  performanceItemDelete: Schema.Struct({ itemId: Schema.String }),
  performanceSubSave: Schema.Struct({
    itemId: Schema.String, subId: optional(Schema.String),
    label: text, objective: text, target: optional(scalar),
    description: text, totalWeight: finite, owner: text,
    ownerWeight: finite, co1: text, co1Weight: finite,
    co2: text, co2Weight: finite, score: finite, status: text,
    q1: optional(scalar), q2: optional(scalar), q3: optional(scalar), q4: optional(scalar),
    statusQ1: text, statusQ2: text, statusQ3: text, statusQ4: text, notes: text,
  }),
  performanceSubDelete: Schema.Struct({
    itemId: Schema.String, subId: Schema.String,
  }),
} as const
