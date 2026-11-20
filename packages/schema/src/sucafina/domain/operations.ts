import { Schema } from "effect"
import { NonNegativeInt, optional } from "../../schema"
import { SfContextStamp } from "../context"
import {
  SfDomainLegacyResult, SfDomainPageData, SfDomainReadSelection,
  SfDomainVersionNumbers,
} from "./fields"
import { SfDomainCommandBase, SfDomainCommandValues } from "./commands"
import { SfDomainDashboardInputs, SfDomainDashboardOutput } from "./product"

/** Frozen A01 source envelopes. A 503/403/stale branch never masquerades as data. */
const pageFailure = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({ status: Schema.Literal("needs-input"), reason: Schema.String }),
  Schema.Struct({ status: Schema.Literal("stale"), reason: Schema.String }),
  Schema.Struct({ status: Schema.Literal("unavailable"), reason: Schema.String }),
])
const localAdminOutput = Schema.Union([
  Schema.Struct({
    status: Schema.Literal("ok"), context: SfContextStamp,
    value: Schema.Struct({
      notifications: Schema.Array(Schema.Struct({
        id: Schema.String, surface: Schema.Literals(["dashboard", "planner", "procurement"]),
        at: Schema.String, read: Schema.Boolean,
      })),
      backups: Schema.Array(Schema.Struct({
        id: Schema.String, surface: Schema.Literals(["dashboard", "planner", "procurement"]),
        at: Schema.String, tier: Schema.String, assets: NonNegativeInt, bytes: NonNegativeInt,
        version: NonNegativeInt,
      })),
      maintenance: optional(Schema.Literals(["starting", "active", "degraded"])),
    }),
  }),
  pageFailure,
])

export const SfDomainPageCap01 = {
  operationId: "domain.page.CAP01",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP01"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP01,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap01SaveUsers = {
  operationId: "domain.command.CAP01.save-users",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.users,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap01SaveBenchmark = {
  operationId: "domain.command.CAP01.save-benchmark",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.users,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap03 = {
  operationId: "domain.page.CAP03",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP03"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP03,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap03SaveMonth = {
  operationId: "domain.command.CAP03.save-month",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.month,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap03SaveRevenue = {
  operationId: "domain.command.CAP03.save-revenue",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.revenue,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap04 = {
  operationId: "domain.page.CAP04",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP04"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP04,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap04Save = {
  operationId: "domain.command.CAP04.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap04Delete = {
  operationId: "domain.command.CAP04.delete",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap04SaveEntry = {
  operationId: "domain.command.CAP04.save-entry",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetEntry,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap04SaveDeviation = {
  operationId: "domain.command.CAP04.save-deviation",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetDeviation,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap04AnnualEntry = {
  operationId: "domain.command.CAP04.annual-entry",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetAnnual,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap04YearAmount = {
  operationId: "domain.command.CAP04.year-amount",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetYearAmount,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap04Import = {
  operationId: "domain.command.CAP04.import",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.opexImport,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap05 = {
  operationId: "domain.page.CAP05",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP05"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP05,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap05Save = {
  operationId: "domain.command.CAP05.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap05Delete = {
  operationId: "domain.command.CAP05.delete",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap05SaveEntry = {
  operationId: "domain.command.CAP05.save-entry",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetEntry,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap05SaveDeviation = {
  operationId: "domain.command.CAP05.save-deviation",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetDeviation,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap05AnnualEntry = {
  operationId: "domain.command.CAP05.annual-entry",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetAnnual,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap05YearAmount = {
  operationId: "domain.command.CAP05.year-amount",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.budgetYearAmount,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap09 = {
  operationId: "domain.page.CAP09",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP09"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP09,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap09Save = {
  operationId: "domain.command.CAP09.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.projectSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap09Delete = {
  operationId: "domain.command.CAP09.delete",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.projectDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap09Import = {
  operationId: "domain.command.CAP09.import",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.projectImport,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap09SaveMilestone = {
  operationId: "domain.command.CAP09.save-milestone",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.milestoneSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap09DeleteMilestone = {
  operationId: "domain.command.CAP09.delete-milestone",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.milestoneDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap10 = {
  operationId: "domain.page.CAP10",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP10"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP10,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap10Save = {
  operationId: "domain.command.CAP10.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.projectSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap10Delete = {
  operationId: "domain.command.CAP10.delete",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.projectDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap10Import = {
  operationId: "domain.command.CAP10.import",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.projectImport,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap10SaveMilestone = {
  operationId: "domain.command.CAP10.save-milestone",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.milestoneSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap10DeleteMilestone = {
  operationId: "domain.command.CAP10.delete-milestone",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.milestoneDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap13 = {
  operationId: "domain.page.CAP13",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP13"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP13,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap13Save = {
  operationId: "domain.command.CAP13.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.riskSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap13Delete = {
  operationId: "domain.command.CAP13.delete",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.riskDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap14 = {
  operationId: "domain.page.CAP14",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP14"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP14,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap14Save = {
  operationId: "domain.command.CAP14.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.contractSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap14Delete = {
  operationId: "domain.command.CAP14.delete",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.contractDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap15 = {
  operationId: "domain.page.CAP15",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP15"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP15,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap15Save = {
  operationId: "domain.command.CAP15.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.stakeholderSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap15Delete = {
  operationId: "domain.command.CAP15.delete",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.stakeholderDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainPageCap16 = {
  operationId: "domain.page.CAP16",
  input: SfDomainReadSelection,
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal("CAP16"),
        selection: SfDomainReadSelection,
        data: SfDomainPageData.CAP16,
        versions: SfDomainVersionNumbers,
        allowedActionIds: Schema.Array(Schema.String),
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfDomainCommandCap16Save = {
  operationId: "domain.command.CAP16.save",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.performanceSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap16SaveItem = {
  operationId: "domain.command.CAP16.save-item",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.performanceItemSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap16DeleteItem = {
  operationId: "domain.command.CAP16.delete-item",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.performanceItemDelete,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap16SaveSub = {
  operationId: "domain.command.CAP16.save-sub",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.performanceSubSave,
  }),
  output: SfDomainLegacyResult,
} as const

export const SfDomainCommandCap16DeleteSub = {
  operationId: "domain.command.CAP16.delete-sub",
  input: Schema.Struct({
    ...SfDomainCommandBase,
    values: SfDomainCommandValues.performanceSubDelete,
  }),
  output: SfDomainLegacyResult,
} as const

// The wire enum is the original Dashboard summary selection from src/nav.ts.
// The host still validates every page against that current source at execution.
const summaryPage = Schema.Literals([
  "Executive Dashboard", "Hot Topics & Actions", "Budget Overview", "OPEX Detail",
  "CAPEX Projects", "Headcount Overview", "Team Structure", "Talent Review",
  "Portfolio Dashboard", "All Projects", "IT Operations", "IT Security KPIs",
  "IT Risks", "Vendor Contracts", "Stakeholder Management", "IT Performance Contract",
])
export const SfLocalSummaryRead = {
  operationId: "local-admin.summary-read",
  input: Schema.Struct({}),
  output: Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        pages: Schema.Array(summaryPage),
        availablePages: Schema.Array(summaryPage),
        version: NonNegativeInt,
        canConfigure: Schema.Boolean,
      }),
    }),
    pageFailure,
  ]),
} as const

export const SfLocalSummaryConfigure = {
  operationId: "local-admin.summary-configure",
  input: Schema.Struct({
    // Equality fence only; the original request's current principal authorizes.
    context: SfContextStamp,
    version: NonNegativeInt,
    pages: Schema.Array(summaryPage),
  }),
  output: Schema.Union([SfDomainLegacyResult, pageFailure]),
} as const

export const SfProjectionLocalAdmin = {
  operationId: "projection.local-admin",
  input: Schema.Struct({}),
  output: localAdminOutput,
} as const


export const SfDashboardDashboardDraftRead = {
  operationId: "dashboard.dashboard-draft-read",
  input: SfDomainDashboardInputs.draftRead,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicDraftOutcome = {
  operationId: "dashboard.dashboard-hot-topic-draft-outcome",
  input: SfDomainDashboardInputs.draftOutcome,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardWorkbench = {
  operationId: "dashboard.dashboard-workbench",
  input: SfDomainDashboardInputs.workbench,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicSource = {
  operationId: "dashboard.dashboard-hot-topic-source",
  input: SfDomainDashboardInputs.source,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicDraft = {
  operationId: "dashboard.dashboard-hot-topic-draft",
  input: SfDomainDashboardInputs.draft,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicDrafts = {
  operationId: "dashboard.dashboard-hot-topic-drafts",
  input: SfDomainDashboardInputs.drafts,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicOperation = {
  operationId: "dashboard.dashboard-hot-topic-operation",
  input: SfDomainDashboardInputs.operation,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicPrepare = {
  operationId: "dashboard.dashboard-hot-topic-prepare",
  input: SfDomainDashboardInputs.prepare,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicReview = {
  operationId: "dashboard.dashboard-hot-topic-review",
  input: SfDomainDashboardInputs.review,
  output: SfDomainDashboardOutput,
} as const

export const SfDashboardDashboardHotTopicApply = {
  operationId: "dashboard.dashboard-hot-topic-apply",
  input: SfDomainDashboardInputs.apply,
  output: SfDomainDashboardOutput,
} as const

/** Complete A01 bindings; I00 registers only operations actually admitted. */
export const SfDomain = {
  operations: {
    "domain.page.CAP01": SfDomainPageCap01,
    "domain.command.CAP01.save-users": SfDomainCommandCap01SaveUsers,
    "domain.command.CAP01.save-benchmark": SfDomainCommandCap01SaveBenchmark,
    "domain.page.CAP03": SfDomainPageCap03,
    "domain.command.CAP03.save-month": SfDomainCommandCap03SaveMonth,
    "domain.command.CAP03.save-revenue": SfDomainCommandCap03SaveRevenue,
    "domain.page.CAP04": SfDomainPageCap04,
    "domain.command.CAP04.save": SfDomainCommandCap04Save,
    "domain.command.CAP04.delete": SfDomainCommandCap04Delete,
    "domain.command.CAP04.save-entry": SfDomainCommandCap04SaveEntry,
    "domain.command.CAP04.save-deviation": SfDomainCommandCap04SaveDeviation,
    "domain.command.CAP04.annual-entry": SfDomainCommandCap04AnnualEntry,
    "domain.command.CAP04.year-amount": SfDomainCommandCap04YearAmount,
    "domain.command.CAP04.import": SfDomainCommandCap04Import,
    "domain.page.CAP05": SfDomainPageCap05,
    "domain.command.CAP05.save": SfDomainCommandCap05Save,
    "domain.command.CAP05.delete": SfDomainCommandCap05Delete,
    "domain.command.CAP05.save-entry": SfDomainCommandCap05SaveEntry,
    "domain.command.CAP05.save-deviation": SfDomainCommandCap05SaveDeviation,
    "domain.command.CAP05.annual-entry": SfDomainCommandCap05AnnualEntry,
    "domain.command.CAP05.year-amount": SfDomainCommandCap05YearAmount,
    "domain.page.CAP09": SfDomainPageCap09,
    "domain.command.CAP09.save": SfDomainCommandCap09Save,
    "domain.command.CAP09.delete": SfDomainCommandCap09Delete,
    "domain.command.CAP09.import": SfDomainCommandCap09Import,
    "domain.command.CAP09.save-milestone": SfDomainCommandCap09SaveMilestone,
    "domain.command.CAP09.delete-milestone": SfDomainCommandCap09DeleteMilestone,
    "domain.page.CAP10": SfDomainPageCap10,
    "domain.command.CAP10.save": SfDomainCommandCap10Save,
    "domain.command.CAP10.delete": SfDomainCommandCap10Delete,
    "domain.command.CAP10.import": SfDomainCommandCap10Import,
    "domain.command.CAP10.save-milestone": SfDomainCommandCap10SaveMilestone,
    "domain.command.CAP10.delete-milestone": SfDomainCommandCap10DeleteMilestone,
    "domain.page.CAP13": SfDomainPageCap13,
    "domain.command.CAP13.save": SfDomainCommandCap13Save,
    "domain.command.CAP13.delete": SfDomainCommandCap13Delete,
    "domain.page.CAP14": SfDomainPageCap14,
    "domain.command.CAP14.save": SfDomainCommandCap14Save,
    "domain.command.CAP14.delete": SfDomainCommandCap14Delete,
    "domain.page.CAP15": SfDomainPageCap15,
    "domain.command.CAP15.save": SfDomainCommandCap15Save,
    "domain.command.CAP15.delete": SfDomainCommandCap15Delete,
    "domain.page.CAP16": SfDomainPageCap16,
    "domain.command.CAP16.save": SfDomainCommandCap16Save,
    "domain.command.CAP16.save-item": SfDomainCommandCap16SaveItem,
    "domain.command.CAP16.delete-item": SfDomainCommandCap16DeleteItem,
    "domain.command.CAP16.save-sub": SfDomainCommandCap16SaveSub,
    "domain.command.CAP16.delete-sub": SfDomainCommandCap16DeleteSub,
    "projection.local-admin": SfProjectionLocalAdmin,
    "local-admin.summary-read": SfLocalSummaryRead,
    "local-admin.summary-configure": SfLocalSummaryConfigure,
    "dashboard.dashboard-draft-read": SfDashboardDashboardDraftRead,
    "dashboard.dashboard-hot-topic-draft-outcome": SfDashboardDashboardHotTopicDraftOutcome,
    "dashboard.dashboard-workbench": SfDashboardDashboardWorkbench,
    "dashboard.dashboard-hot-topic-source": SfDashboardDashboardHotTopicSource,
    "dashboard.dashboard-hot-topic-draft": SfDashboardDashboardHotTopicDraft,
    "dashboard.dashboard-hot-topic-drafts": SfDashboardDashboardHotTopicDrafts,
    "dashboard.dashboard-hot-topic-operation": SfDashboardDashboardHotTopicOperation,
    "dashboard.dashboard-hot-topic-prepare": SfDashboardDashboardHotTopicPrepare,
    "dashboard.dashboard-hot-topic-review": SfDashboardDashboardHotTopicReview,
    "dashboard.dashboard-hot-topic-apply": SfDashboardDashboardHotTopicApply,
  },
} as const
