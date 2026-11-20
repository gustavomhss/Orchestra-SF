import { Schema } from "effect"
import { NonNegativeInt, optional } from "../schema"
import { SfContextStamp } from "./context"

/**
 * A10: closed browser-safe Pessoas/Talent contracts.
 * These are the public fieldsets returned by dashboard-people Domain.view,
 * never raw Snapshot/data, roleMap, audit, or private host state.
 */
const Text = Schema.String
const VersionMap = Schema.Record(Schema.String, NonNegativeInt)
const Year = Schema.Int.check(Schema.isBetween({ minimum: 2024, maximum: 2027 }))
const Month = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 12 }))
const MemberStatus = Schema.Literals(["Active", "On Leave", "Terminated"])
const MemberType = Schema.Literals(["Employee", "Contractor"])
const Classification = Schema.Literals(["", "Talent", "Solid Contributor", "Lagger"])
const Outlook = Schema.Literals(["", "Promote", "Stay", "Replace", "Termination"])
const TopicStatus = Schema.Literals(["open", "progress", "blocked", "done"])
const TopicPriority = Schema.Literals(["critical", "high", "normal"])
const LeaderId = Schema.Union([Text, Schema.Finite])

export const SfPeopleTopic = Schema.Struct({
  id: Text,
  action: optional(Text),
  owner: optional(Text),
  due: optional(Text),
  status: optional(TopicStatus),
  priority: optional(TopicPriority),
  notes: optional(Text),
})
export interface SfPeopleTopic extends Schema.Schema.Type<typeof SfPeopleTopic> {}

export const SfPeopleCio = Schema.Struct({
  name: optional(Text),
  title: optional(Text),
  location: optional(Text),
  start: optional(Text),
})
export interface SfPeopleCio extends Schema.Schema.Type<typeof SfPeopleCio> {}

export const SfPeopleLeader = Schema.Struct({
  id: Text,
  name: optional(Text),
  title: optional(Text),
  domain: optional(Text),
  location: optional(Text),
  start: optional(Text),
})
export interface SfPeopleLeader extends Schema.Schema.Type<typeof SfPeopleLeader> {}

/** Restricted readers never receive cls/outlook/notes, including as null. */
export const SfPeopleMember = Schema.Struct({
  id: Text,
  name: optional(Text),
  title: optional(Text),
  type: optional(MemberType),
  leaderId: optional(LeaderId),
  location: optional(Text),
  start: optional(Text),
  end: optional(Text),
  status: optional(MemberStatus),
  cls: optional(Classification),
  outlook: optional(Outlook),
  notes: optional(Text),
})
export interface SfPeopleMember extends Schema.Schema.Type<typeof SfPeopleMember> {}

export const SfPeopleReadBase = {
  year: optional(Year),
  month: optional(Month),
} as const
export const SfPeopleTopicSelection = Schema.Struct({
  ...SfPeopleReadBase,
  topicStatus: optional(Schema.Literals(["", "open", "progress", "blocked", "done"])),
})
export const SfPeopleHeadcountSelection = Schema.Struct(SfPeopleReadBase)
export const SfPeopleStructureSelection = Schema.Struct(SfPeopleReadBase)
export const SfPeopleTalentSelection = Schema.Struct({
  ...SfPeopleReadBase,
  memberStatus: optional(Schema.Literals(["", "Active", "On Leave", "Terminated"])),
})

export const SfPeopleHeadcountMetrics = Schema.Struct({
  active: NonNegativeInt,
  terminated: NonNegativeInt,
  departuresYtd: NonNegativeInt,
  attritionYtd: Text,
  averageTenureMonths: Text,
  staffRatio: Text,
  contractors: NonNegativeInt,
  employees: NonNegativeInt,
  talent: optional(NonNegativeInt),
})
export const SfPeopleHeadcountLeader = Schema.Struct({
  id: Text,
  name: optional(Text),
  active: NonNegativeInt,
  talentActive: optional(NonNegativeInt),
})
export const SfPeoplePageData = {
  CAP02: Schema.Struct({ hotTopics: Schema.Array(SfPeopleTopic) }),
  CAP06: Schema.Struct({
    metrics: SfPeopleHeadcountMetrics,
    byLeader: Schema.Array(SfPeopleHeadcountLeader),
  }),
  CAP07: Schema.Struct({
    cio: SfPeopleCio,
    leaders: Schema.Array(SfPeopleLeader),
    members: Schema.Array(SfPeopleMember),
  }),
  CAP08: Schema.Struct({
    members: Schema.Array(SfPeopleMember),
  }),
} as const

export const SfPeoplePageFailure = Schema.Union([
  Schema.Struct({ status: Schema.Literal("unauthenticated") }),
  Schema.Struct({ status: Schema.Literal("denied") }),
  Schema.Struct({ status: Schema.Literal("needs-input"), reason: Text }),
  Schema.Struct({ status: Schema.Literal("stale"), reason: Text }),
  Schema.Struct({ status: Schema.Literal("unavailable"), reason: Text }),
])

function pageOutput<Capability extends "CAP02" | "CAP06" | "CAP07" | "CAP08">(
  capabilityId: Capability,
  selection: typeof SfPeopleTopicSelection | typeof SfPeopleHeadcountSelection | typeof SfPeopleTalentSelection,
  data: (typeof SfPeoplePageData)[Capability],
  allowedAction: Schema.Codec<string, string>,
) {
  return Schema.Union([
    Schema.Struct({
      status: Schema.Literal("ok"),
      context: SfContextStamp,
      value: Schema.Struct({
        capabilityId: Schema.Literal(capabilityId),
        selection,
        data,
        versions: VersionMap,
        allowedActionIds: Schema.Array(allowedAction),
      }),
    }),
    SfPeoplePageFailure,
  ])
}

/**
 * Legacy success intentionally exposes no Result.value, because application.ts
 * discards that internal return value and requires an authorized refetch.
 * Failure.stored is source safeFailure, not an all-record snapshot.
 */
export const SfPeopleLegacyResult = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), warnings: optional(Schema.Array(Text)) }),
  Schema.Struct({
    ok: Schema.Literal(false),
    status: Schema.Literals([400, 403, 404, 409, 422, 503]),
    errors: optional(Schema.Array(Text)),
    fieldErrors: optional(Schema.Array(Schema.Struct({ field: Text, message: Text }))),
    stored: optional(Schema.Union([SfPeopleTopic, SfPeopleLeader, SfPeopleMember, SfPeopleCio, Schema.Null])),
    by: optional(Text),
    currentVersionCAS: optional(NonNegativeInt),
  }),
])

const CommandBase = {
  id: optional(Text),
  version: NonNegativeInt,
  confirmed: optional(Schema.Boolean),
} as const

const TopicEdit = {
  action: optional(Text),
  owner: optional(Text),
  due: optional(Text),
  status: optional(TopicStatus),
  priority: optional(TopicPriority),
  notes: optional(Text),
} as const
const CioEdit = {
  name: optional(Text),
  title: optional(Text),
  location: optional(Text),
  start: optional(Text),
} as const
const LeaderEdit = {
  name: optional(Text),
  title: optional(Text),
  domain: optional(Text),
  location: optional(Text),
  start: optional(Text),
} as const
const MemberEdit = {
  name: optional(Text),
  title: optional(Text),
  type: optional(MemberType),
  leaderId: optional(LeaderId),
  location: optional(Text),
  start: optional(Text),
  end: optional(Text),
  status: optional(MemberStatus),
  cls: optional(Classification),
  outlook: optional(Outlook),
  notes: optional(Text),
} as const
const ImportMember = Schema.Struct({
  Name: optional(Text),
  name: optional(Text),
  Title: optional(Text),
  title: optional(Text),
  Type: optional(Text),
  type: optional(Text),
  Leader: optional(Text),
  Location: optional(Text),
  location: optional(Text),
  Start: optional(Text),
  start: optional(Text),
  "Start Date": optional(Text),
  End: optional(Text),
  end: optional(Text),
  "End Date": optional(Text),
  Status: optional(Text),
  status: optional(Text),
  Classification: optional(Text),
  cls: optional(Text),
  Outlook: optional(Text),
  outlook: optional(Text),
  Notes: optional(Text),
  notes: optional(Text),
})
const ImportValues = Schema.Struct({
  rows: Schema.Array(ImportMember),
  versions: optional(VersionMap),
  replace: optional(Schema.Boolean),
  confirmed: optional(Schema.Boolean),
})

export const SfDomainPageCap02 = {
  operationId: "domain.page.CAP02",
  input: SfPeopleTopicSelection,
  output: pageOutput("CAP02", SfPeopleTopicSelection, SfPeoplePageData.CAP02, Schema.Literals(["save", "delete"])),
} as const
export const SfDomainCommandCap02Delete = {
  operationId: "domain.command.CAP02.delete",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct({}) }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap02Save = {
  operationId: "domain.command.CAP02.save",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct(TopicEdit) }),
  output: SfPeopleLegacyResult,
} as const

export const SfDomainPageCap06 = {
  operationId: "domain.page.CAP06",
  input: SfPeopleHeadcountSelection,
  output: pageOutput("CAP06", SfPeopleHeadcountSelection, SfPeoplePageData.CAP06, Schema.Never),
} as const
export const SfDomainPageCap07 = {
  operationId: "domain.page.CAP07",
  input: SfPeopleStructureSelection,
  output: pageOutput("CAP07", SfPeopleStructureSelection, SfPeoplePageData.CAP07,
    Schema.Literals(["saveCio", "saveLeader", "deleteLeader", "saveMember", "deleteMember"])),
} as const
export const SfDomainCommandCap07Deleteleader = {
  operationId: "domain.command.CAP07.deleteLeader",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct({ versions: optional(VersionMap) }) }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap07Deletemember = {
  operationId: "domain.command.CAP07.deleteMember",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct({}) }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap07Savecio = {
  operationId: "domain.command.CAP07.saveCio",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct(CioEdit) }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap07Saveleader = {
  operationId: "domain.command.CAP07.saveLeader",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct(LeaderEdit) }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap07Savemember = {
  operationId: "domain.command.CAP07.saveMember",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct(MemberEdit) }),
  output: SfPeopleLegacyResult,
} as const

export const SfDomainPageCap08 = {
  operationId: "domain.page.CAP08",
  input: SfPeopleTalentSelection,
  output: pageOutput("CAP08", SfPeopleTalentSelection, SfPeoplePageData.CAP08,
    Schema.Literals(["save", "delete", "import", "exportAllMembers"])),
} as const
export const SfDomainCommandCap08Delete = {
  operationId: "domain.command.CAP08.delete",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct({}) }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap08Exportallmembers = {
  operationId: "domain.command.CAP08.exportAllMembers",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct({}) }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap08Import = {
  operationId: "domain.command.CAP08.import",
  input: Schema.Struct({ ...CommandBase, values: ImportValues }),
  output: SfPeopleLegacyResult,
} as const
export const SfDomainCommandCap08Save = {
  operationId: "domain.command.CAP08.save",
  input: Schema.Struct({ ...CommandBase, values: Schema.Struct(MemberEdit) }),
  output: SfPeopleLegacyResult,
} as const

/** Exactly 15 catalog entries: 4 projections and 11 existing POSTs. */
export const SfPeople = {
  operations: {
    "domain.page.CAP02": SfDomainPageCap02,
    "domain.command.CAP02.delete": SfDomainCommandCap02Delete,
    "domain.command.CAP02.save": SfDomainCommandCap02Save,
    "domain.page.CAP06": SfDomainPageCap06,
    "domain.page.CAP07": SfDomainPageCap07,
    "domain.command.CAP07.deleteLeader": SfDomainCommandCap07Deleteleader,
    "domain.command.CAP07.deleteMember": SfDomainCommandCap07Deletemember,
    "domain.command.CAP07.saveCio": SfDomainCommandCap07Savecio,
    "domain.command.CAP07.saveLeader": SfDomainCommandCap07Saveleader,
    "domain.command.CAP07.saveMember": SfDomainCommandCap07Savemember,
    "domain.page.CAP08": SfDomainPageCap08,
    "domain.command.CAP08.delete": SfDomainCommandCap08Delete,
    "domain.command.CAP08.exportAllMembers": SfDomainCommandCap08Exportallmembers,
    "domain.command.CAP08.import": SfDomainCommandCap08Import,
    "domain.command.CAP08.save": SfDomainCommandCap08Save,
  },
} as const
