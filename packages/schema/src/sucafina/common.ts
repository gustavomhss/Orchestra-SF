/**
 * Closed, browser-safe Sucafina native operation contract.
 * UX20 F02 / catalog 31dbec1726fd8147156b01dc545726650ffd49e1.
 * This is the closed ID set, including explicitly source-backed extensions,
 * NOT an operation dispatcher or a second SDK.
 * The one canonical metadata table and admitted codecs are composed by I00.
 */
import { Schema } from "effect"

export const SfOperationIds = [
  "bi.bi-data",
  "bi.bi-decision",
  "bi.bi-options",
  "bi.bi-source",
  "collaboration.answer-confirm",
  "collaboration.answer-prepare",
  "collaboration.answer-prepare-message",
  "collaboration.answer-read",
  "collaboration.confirmation-confirm",
  "collaboration.confirmation-prepare",
  "collaboration.confirmation-project",
  "collaboration.cycle-read",
  "collaboration.handoff-create",
  "collaboration.handoff-link",
  "collaboration.handoff-update",
  "collaboration.question-consume",
  "collaboration.question-output",
  "collaboration.recipients",
  "collaboration.relation-create",
  "collaboration.relation-read",
  "collaboration.relation-remove",
  "collaboration.selection-create",
  "collaboration.selection-list",
  "collaboration.selection-version",
  "collaboration.storage-version",
  "collaboration.thread-create",
  "collaboration.thread-edit",
  "collaboration.thread-history",
  "collaboration.thread-read",
  "collaboration.thread-reply",
  "collaboration.thread-resolve",
  "collaboration.work-destination",
  "collaboration.work-list",
  "ctx.context",
  "ctx.installations",
  "ctx.login",
  "ctx.logout",
  "dashboard.dashboard-draft-read",
  "dashboard.dashboard-hot-topic-draft-outcome",
  "dashboard.dashboard-agenda",
  "dashboard.dashboard-capture",
  "dashboard.dashboard-history",
  "dashboard.dashboard-hot-topic-apply",
  "dashboard.dashboard-hot-topic-draft",
  "dashboard.dashboard-hot-topic-drafts",
  "dashboard.dashboard-hot-topic-operation",
  "dashboard.dashboard-hot-topic-prepare",
  "dashboard.dashboard-hot-topic-review",
  "dashboard.dashboard-hot-topic-source",
  "dashboard.dashboard-review",
  "dashboard.dashboard-review-preserve",
  "dashboard.dashboard-workbench",
  "decisions.choice.read",
  "decisions.command.sf_case_draft",
  "decisions.command.sf_change_prepare",
  "decisions.command.sf_question_prepare",
  "decisions.controls.read",
  "decisions.current-choice-prepare",
  "decisions.current-choice-promote",
  "decisions.decision-add-question",
  "decisions.decision-answer-question",
  "decisions.decision-apply",
  "decisions.decision-choose",
  "decisions.decision-condition",
  "decisions.decision-coverage",
  "decisions.decision-criteria",
  "decisions.decision-prepare-changes",
  "decisions.decision-promote",
  "decisions.decision-recover",
  "decisions.decision-review",
  "decisions.decision-select-portfolio",
  "domain.command.CAP01.save-benchmark",
  "domain.command.CAP01.save-users",
  "domain.command.CAP02.delete",
  "domain.command.CAP02.save",
  "domain.command.CAP03.save-month",
  "domain.command.CAP03.save-revenue",
  "domain.command.CAP04.annual-entry",
  "domain.command.CAP04.delete",
  "domain.command.CAP04.import",
  "domain.command.CAP04.save",
  "domain.command.CAP04.save-deviation",
  "domain.command.CAP04.save-entry",
  "domain.command.CAP04.year-amount",
  "domain.command.CAP05.annual-entry",
  "domain.command.CAP05.delete",
  "domain.command.CAP05.save",
  "domain.command.CAP05.save-deviation",
  "domain.command.CAP05.save-entry",
  "domain.command.CAP05.year-amount",
  "domain.command.CAP07.deleteLeader",
  "domain.command.CAP07.deleteMember",
  "domain.command.CAP07.saveCio",
  "domain.command.CAP07.saveLeader",
  "domain.command.CAP07.saveMember",
  "domain.command.CAP08.delete",
  "domain.command.CAP08.exportAllMembers",
  "domain.command.CAP08.import",
  "domain.command.CAP08.save",
  "domain.command.CAP09.delete",
  "domain.command.CAP09.delete-milestone",
  "domain.command.CAP09.import",
  "domain.command.CAP09.save",
  "domain.command.CAP09.save-milestone",
  "domain.command.CAP10.delete",
  "domain.command.CAP10.delete-milestone",
  "domain.command.CAP10.import",
  "domain.command.CAP10.save",
  "domain.command.CAP10.save-milestone",
  "domain.command.CAP11.import-month",
  "domain.command.CAP11.save-categories",
  "domain.command.CAP11.save-heatmap",
  "domain.command.CAP11.save-items",
  "domain.command.CAP11.save-sla",
  "domain.command.CAP11.save-tickets",
  "domain.command.CAP12.delete-action",
  "domain.command.CAP12.delete-campaign",
  "domain.command.CAP12.delete-incident",
  "domain.command.CAP12.delete-kpi",
  "domain.command.CAP12.save-action",
  "domain.command.CAP12.save-campaign",
  "domain.command.CAP12.save-incident",
  "domain.command.CAP12.save-kpi",
  "domain.command.CAP13.delete",
  "domain.command.CAP13.save",
  "domain.command.CAP14.delete",
  "domain.command.CAP14.save",
  "domain.command.CAP15.delete",
  "domain.command.CAP15.save",
  "domain.command.CAP16.delete-item",
  "domain.command.CAP16.delete-sub",
  "domain.command.CAP16.save",
  "domain.command.CAP16.save-item",
  "domain.command.CAP16.save-sub",
  "domain.command.CAP17.import-workbook",
  "domain.command.CAP18.delete",
  "domain.command.CAP18.import-workbook",
  "domain.command.CAP18.reset",
  "domain.command.CAP18.save",
  "domain.command.CAP18.spread",
  "domain.command.CAP19.delete",
  "domain.command.CAP19.import-workbook",
  "domain.command.CAP19.reset",
  "domain.command.CAP19.save",
  "domain.command.CAP19.spread",
  "domain.command.CAP20.delete",
  "domain.command.CAP20.import-workbook",
  "domain.command.CAP20.save",
  "domain.command.CAP20.sync",
  "domain.command.CAP21.common",
  "domain.command.CAP21.delete",
  "domain.command.CAP21.import-workbook",
  "domain.command.CAP21.save",
  "domain.command.CAP22.delete",
  "domain.command.CAP22.import-workbook",
  "domain.command.CAP22.save",
  "domain.command.CAP23.copy",
  "domain.command.CAP23.delete",
  "domain.command.CAP23.import-workbook",
  "domain.command.CAP23.lock",
  "domain.command.CAP23.official",
  "domain.command.CAP23.save",
  "domain.command.CAP23.unlock",
  "domain.command.CAP25.approve",
  "domain.command.CAP25.cancel",
  "domain.command.CAP25.create",
  "domain.command.CAP25.delete",
  "domain.command.CAP25.issue",
  "domain.command.CAP25.reject",
  "domain.command.CAP25.save",
  "domain.command.CAP25.select_quote",
  "domain.command.CAP25.submit_po",
  "domain.command.CAP25.submit_pr",
  "domain.command.CAP25.submit_sourcing",
  "domain.command.CAP26.approve",
  "domain.command.CAP26.cancel",
  "domain.command.CAP26.create",
  "domain.command.CAP26.delete",
  "domain.command.CAP26.issue",
  "domain.command.CAP26.reject",
  "domain.command.CAP26.save",
  "domain.command.CAP26.select_quote",
  "domain.command.CAP26.submit_po",
  "domain.command.CAP26.submit_pr",
  "domain.command.CAP26.submit_sourcing",
  "domain.command.CAP27.activate",
  "domain.command.CAP27.block",
  "domain.command.CAP27.change-bank",
  "domain.command.CAP27.create",
  "domain.command.CAP27.delete",
  "domain.command.CAP27.inactivate",
  "domain.command.CAP27.save",
  "domain.command.CAP28.reset",
  "domain.command.CAP28.save",
  "domain.page.CAP01",
  "domain.page.CAP02",
  "domain.page.CAP03",
  "domain.page.CAP04",
  "domain.page.CAP05",
  "domain.page.CAP06",
  "domain.page.CAP07",
  "domain.page.CAP08",
  "domain.page.CAP09",
  "domain.page.CAP10",
  "domain.page.CAP11",
  "domain.page.CAP12",
  "domain.page.CAP13",
  "domain.page.CAP14",
  "domain.page.CAP15",
  "domain.page.CAP16",
  "domain.page.CAP17",
  "domain.page.CAP18",
  "domain.page.CAP19",
  "domain.page.CAP20",
  "domain.page.CAP21",
  "domain.page.CAP22",
  "domain.page.CAP23",
  "domain.page.CAP24",
  "domain.page.CAP25",
  "domain.page.CAP26",
  "domain.page.CAP27",
  "domain.page.CAP28",
  "files.asset.download",
  "files.asset.link",
  "files.asset.upload",
  "files.document-admit",
  "files.document-candidates",
  "files.document-confirm",
  "files.document-extract",
  "files.document-open",
  "files.document-requests",
  "files.document-scenario-preview",
  "files.document-scenario-targets",
  "files.document-schema",
  "files.document-schemas",
  "files.document-search",
  "files.document-sources",
  "files.export.json",
  "files.export.members",
  "files.export.po",
  "files.export.review",
  "files.export.register",
  "files.export.suppliers",
  "files.export.xlsx",
  "files.import-admit",
  "files.import-apply",
  "files.import-detail",
  "files.import-preview",
  "files.import-reference",
  "files.import-targets",
  "intelligence.analysis.cancel",
  "intelligence.analysis.choices",
  "intelligence.analysis.list",
  "intelligence.analysis.output",
  "intelligence.analysis.prepare",
  "intelligence.analysis.read",
  "intelligence.analysis.start",
  "intelligence.memory-catalog",
  "intelligence.memory-similar-cases",
  "intelligence.memory-condition",
  "intelligence.memory-conditions",
  "intelligence.memory-materiality",
  "intelligence.memory-outcome",
  "intelligence.memory-outcome-selection",
  "intelligence.memory-signals",
  "planner.forecast.prepare",
  "planner.monthly.apply",
  "planner.monthly.preview",
  "portfolio.decision-portfolio-evaluate",
  "portfolio.decision-portfolio-preview",
  "portfolio.decision-portfolio-read",
  "portfolio.decision-portfolio-reconcile",
  "portfolio.decision-portfolio-results",
  "portfolio.decision-prepare-portfolio",
  "portfolio.decision-promote-portfolio",
  "portfolio.decision-sensitivity-evaluate",
  "portfolio.decision-sensitivity-read",
  "portfolio.decision-sensitivity-units",
  "procurement.procurement-scenario-controls",
  "procurement.procurement-scenario-preview",
  "procurement.sourcing.prepare",
  "projection.case",
  "projection.cases",
  "projection.home",
  "projection.local-admin",
  "projection.residents",
  "projection.review",
  "projection.routine",
  "projection.search",
  "projection.work",
  "projection.work-item",
  "projection.work-selection",
  "reviews.export.docx",
  "reviews.export.pptx",
  "reviews.report.prepare",
  "reviews.review-source",
  "reviews.review-thread-context",
  "reviews.review-update",
  "routines.catalog",
  "routines.prepare-admission",
  "routines.read-admission",
  "routines.read-run",
  "routines.run",
  "schedules.create",
  "schedules.list",
  "schedules.pause",
  "schedules.read",
  "schedules.read-run",
  "schedules.update",
  "views.list",
  "views.open",
  "views.remove",
  "views.save",
] as const

export const SfOperationId = Schema.Literals(SfOperationIds).annotate({ identifier: "SfNative.OperationId" })
export type SfOperationId = typeof SfOperationId.Type

export const SfResourceNames = {
  "ctx": [
    "context"
  ],
  "transport": [],
  "domain-read": [
    "CAP01",
    "CAP02",
    "CAP03",
    "CAP04",
    "CAP05",
    "CAP06",
    "CAP07",
    "CAP08",
    "CAP09",
    "CAP10",
    "CAP11",
    "CAP12",
    "CAP13",
    "CAP14",
    "CAP15",
    "CAP16",
    "confirmations",
    "home",
    "hot-topic-proposal",
    "local-admin",
    "questions",
    "relations",
    "search",
    "threads",
    "views",
    "work"
  ],
  "planner": [
    "CAP17",
    "CAP18",
    "CAP19",
    "CAP20",
    "CAP21",
    "CAP22",
    "CAP23"
  ],
  "procurement": [
    "CAP24",
    "CAP25",
    "CAP26",
    "CAP27",
    "CAP28"
  ],
  "decisions": [
    "alternatives",
    "assumptions",
    "case-intent",
    "cases",
    "choice",
    "prepared-changes",
    "receipts"
  ],
  "portfolio": [
    "campaign",
    "results",
    "sensitivity"
  ],
  "files": [
    "document-scenario",
    "documents",
    "evidence",
    "exports",
    "import-admit",
    "import-apply",
    "import-preview"
  ],
  "reviews": [
    "agenda",
    "compare",
    "preserved",
    "report-export"
  ],
  "bi": [
    "catalog",
    "visual"
  ],
  "intelligence": [
    "analysis",
    "outcomes",
    "residents",
    "routine-admission",
    "routine-runs",
    "schedules",
    "signals",
    "similar-cases"
  ]
} as const
export type SfFamilyId = keyof typeof SfResourceNames
export type SfResourceKey = {
  [Family in SfFamilyId]: Readonly<{
    family: Family
    resource: (typeof SfResourceNames)[Family][number]
  }>
}[SfFamilyId]

export type SfJson =
  | null
  | boolean
  | number
  | string
  | readonly SfJson[]
  | Readonly<{ [key: string]: SfJson }>

export type SfPublicHeaders = Readonly<{
  "content-type"?: string
  "content-disposition"?: string
  "x-sf-access-revision"?: string
  "x-sf-review-binding"?: string
  "x-sf-contract-revision"?: string
}>

export type SfTransportFailure = Readonly<{
  kind: "transport-error"
  reason: "aborted" | "network" | "invalid-response" | "contract-mismatch" | "contract-unavailable" | "outcome-unknown"
}>

export type SfTransportResult<Output> =
  | Readonly<{ kind: "response"; status: number; headers: SfPublicHeaders; body: Output }>
  | SfTransportFailure

export type SfOperation<Input, Output> = Readonly<{
  operationId: SfOperationId
  input: Schema.Schema<Input>
  output: Schema.Schema<Output>
}>

export type SfOperationRegistration<Input, Output> = SfOperation<Input, Output> & Readonly<{
  method: "GET" | "POST"
  pathTemplate: string
  fixedQuery?: Readonly<Record<string, string>>
  fixedBodyDiscriminator?: Readonly<Record<string, string>>
  effect: "read" | "preview" | "prepare" | "mutation" | "authentication"
  maxRequestBytes?: number
  responseMode: "json" | "bytes" | "empty" | "navigation"
}>

export type SfWireDecodeResult =
  | Readonly<{ status: "ok"; value: SfJson | undefined }>
  | Readonly<{ status: "invalid" }>

export type SfOperationCodec = Readonly<{
  decodeInput(value: unknown): SfWireDecodeResult
  decodeOutput(value: unknown): SfWireDecodeResult
}>

export type SfOperationBindings = Readonly<Partial<Record<SfOperationId, SfOperationCodec>>>
