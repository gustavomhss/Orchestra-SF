/**
 * F01 / mission172. Host-private, side-effect-free live context projection.
 * The composition owner must supply the ORIGINAL Request to the real SF
 * authority and the live operational producers. Catalog entries are exhaustive
 * resource identities, never grants or evidence that an operation is ready.
 *
 * Frozen source blobs: catalog 31dbec1726fd8147156b01dc545726650ffd49e1; surface manifest 50e2993a881e207aa3b2a1cd250a7da84cea5855.
 * This module is inert until 162 installs it in the original host's services.
 */
import { Option, Schema } from "effect"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { readTeamContextQuery } from "../../../../../modules/sucafina/Sucafinav1/runtime/team-profile-selector.ts"
import { SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import {
  SfContext as SfContextSchema,
  SfTeamContext,
  type SfTeamContextResult,
  type SfTeamContextQuery,
  SfOperationAvailability as SfOperationAvailabilitySchema,
  SfResourceAvailability,
  type SfContext,
  type SfContextResult,
  type SfContextStamp,
  type SfExpectedContextBinding,
  type SfOperationAvailability,
} from "@orchestra/schema/sucafina/context"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"

type Binding = SfExpectedContextBinding
type Destination = SfContext["destinations"][number]

/** All stamps and destinations originate from host-private SF authentication. */
export type SfLiveContextAdmission =
  | Readonly<{
      status: "ok"
      stamp: SfContextStamp
      authMode: SfContext["authMode"]
      destinations: readonly Destination[]
    }>
  | Readonly<{ status: "unauthenticated" | "denied" }>
  | Readonly<{ status: "unavailable"; reason: "identity-unavailable" | "host-unavailable" | "contract-mismatch" }>

/** Projection data only; the opaque resolver admission remains in product authority. */
export type SfLiveTeamContextAdmission =
  | Readonly<{ status: "ok"; technical: SfContextStamp; projection: TeamProfile.Authenticated;
      binding?: TeamProfile.Binding; destinations: readonly Destination[] }>
  | Exclude<SfTeamContextResult, { status: "ok" }>

/** An observation is not inferred from method presence or the frozen catalog. */
export type SfLiveOperationalObservation = SfOperationAvailability
export type SfLiveContextSources = Readonly<{
  origin: string
  mount: string
  /** Must return the actual identity object of the currently loaded runtime. */
  currentBinding: () => Binding | undefined
  /** Current original-request auth, roles/grant and source accessRevision, not a client stamp. */
  admit: (request: Request) => Promise<SfLiveContextAdmission>
  /** Microsoft installations expose only this versioned public context. */
  teams?: Readonly<{ tenantId: string; admit: (request: Request) => Promise<SfLiveTeamContextAdmission> }>
  /**
   * Optional until a live, admitted operation probe is composed. Missing
   * evidence leaves each operation unavailable, rather than optimistic ready.
   */
  operational?: (request: Request, stamp: SfContextStamp) => Promise<readonly SfLiveOperationalObservation[]>
}>

const RESOURCES = [{"family":"ctx","resource":"context","operations":["ctx.context","ctx.installations","ctx.login","ctx.logout"]},{"family":"domain-read","resource":"CAP01","operations":["dashboard.dashboard-hot-topic-apply","dashboard.dashboard-hot-topic-draft","dashboard.dashboard-hot-topic-drafts","dashboard.dashboard-hot-topic-operation","dashboard.dashboard-hot-topic-prepare","dashboard.dashboard-hot-topic-review","dashboard.dashboard-hot-topic-source","dashboard.dashboard-workbench","domain.command.CAP01.save-benchmark","domain.command.CAP01.save-users","domain.page.CAP01"]},{"family":"domain-read","resource":"CAP02","operations":["dashboard.dashboard-hot-topic-apply","dashboard.dashboard-hot-topic-draft","dashboard.dashboard-hot-topic-drafts","dashboard.dashboard-hot-topic-operation","dashboard.dashboard-hot-topic-prepare","dashboard.dashboard-hot-topic-review","dashboard.dashboard-hot-topic-source","dashboard.dashboard-workbench","domain.command.CAP02.delete","domain.command.CAP02.save","domain.page.CAP02"]},{"family":"domain-read","resource":"CAP03","operations":["domain.command.CAP03.save-month","domain.command.CAP03.save-revenue","domain.page.CAP03"]},{"family":"domain-read","resource":"CAP04","operations":["domain.command.CAP04.annual-entry","domain.command.CAP04.delete","domain.command.CAP04.import","domain.command.CAP04.save","domain.command.CAP04.save-deviation","domain.command.CAP04.save-entry","domain.command.CAP04.year-amount","domain.page.CAP04"]},{"family":"domain-read","resource":"CAP05","operations":["domain.command.CAP05.annual-entry","domain.command.CAP05.delete","domain.command.CAP05.save","domain.command.CAP05.save-deviation","domain.command.CAP05.save-entry","domain.command.CAP05.year-amount","domain.page.CAP05"]},{"family":"domain-read","resource":"CAP06","operations":["domain.page.CAP06"]},{"family":"domain-read","resource":"CAP07","operations":["domain.command.CAP07.deleteLeader","domain.command.CAP07.deleteMember","domain.command.CAP07.saveCio","domain.command.CAP07.saveLeader","domain.command.CAP07.saveMember","domain.page.CAP07"]},{"family":"domain-read","resource":"CAP08","operations":["domain.command.CAP08.delete","domain.command.CAP08.exportAllMembers","domain.command.CAP08.import","domain.command.CAP08.save","domain.page.CAP08"]},{"family":"domain-read","resource":"CAP09","operations":["domain.command.CAP09.delete","domain.command.CAP09.delete-milestone","domain.command.CAP09.import","domain.command.CAP09.save","domain.command.CAP09.save-milestone","domain.page.CAP09"]},{"family":"domain-read","resource":"CAP10","operations":["domain.command.CAP10.delete","domain.command.CAP10.delete-milestone","domain.command.CAP10.import","domain.command.CAP10.save","domain.command.CAP10.save-milestone","domain.page.CAP10"]},{"family":"domain-read","resource":"CAP11","operations":["domain.command.CAP11.import-month","domain.command.CAP11.save-categories","domain.command.CAP11.save-heatmap","domain.command.CAP11.save-items","domain.command.CAP11.save-sla","domain.command.CAP11.save-tickets","domain.page.CAP11"]},{"family":"domain-read","resource":"CAP12","operations":["domain.command.CAP12.delete-action","domain.command.CAP12.delete-campaign","domain.command.CAP12.delete-incident","domain.command.CAP12.delete-kpi","domain.command.CAP12.save-action","domain.command.CAP12.save-campaign","domain.command.CAP12.save-incident","domain.command.CAP12.save-kpi","domain.page.CAP12"]},{"family":"domain-read","resource":"CAP13","operations":["domain.command.CAP13.delete","domain.command.CAP13.save","domain.page.CAP13"]},{"family":"domain-read","resource":"CAP14","operations":["domain.command.CAP14.delete","domain.command.CAP14.save","domain.page.CAP14"]},{"family":"domain-read","resource":"CAP15","operations":["domain.command.CAP15.delete","domain.command.CAP15.save","domain.page.CAP15"]},{"family":"domain-read","resource":"CAP16","operations":["domain.command.CAP16.delete-item","domain.command.CAP16.delete-sub","domain.command.CAP16.save","domain.command.CAP16.save-item","domain.command.CAP16.save-sub","domain.page.CAP16"]},{"family":"domain-read","resource":"home","operations":["projection.home"]},{"family":"domain-read","resource":"work","operations":["collaboration.work-destination","collaboration.work-list","projection.work","projection.work-item","projection.work-selection"]},{"family":"domain-read","resource":"search","operations":["projection.search"]},{"family":"domain-read","resource":"local-admin","operations":["projection.local-admin","local-admin.summary-read","local-admin.summary-configure"]},{"family":"domain-read","resource":"views","operations":["views.list","views.open","views.remove","views.save"]},{"family":"domain-read","resource":"hot-topic-proposal","operations":["dashboard.dashboard-capture","dashboard.dashboard-draft-read","dashboard.dashboard-hot-topic-draft-outcome","dashboard.dashboard-hot-topic-apply","dashboard.dashboard-hot-topic-draft","dashboard.dashboard-hot-topic-drafts","dashboard.dashboard-hot-topic-operation","dashboard.dashboard-hot-topic-prepare","dashboard.dashboard-hot-topic-review","dashboard.dashboard-hot-topic-source","dashboard.dashboard-workbench"]},{"family":"domain-read","resource":"questions","operations":["collaboration.answer-confirm","collaboration.answer-prepare","collaboration.answer-prepare-message","collaboration.answer-read","collaboration.cycle-read","collaboration.handoff-create","collaboration.handoff-link","collaboration.handoff-update","collaboration.question-consume","collaboration.question-output","collaboration.recipients","collaboration.selection-create","collaboration.selection-list","collaboration.selection-version","collaboration.storage-version"]},{"family":"domain-read","resource":"threads","operations":["collaboration.cycle-read","collaboration.handoff-create","collaboration.handoff-link","collaboration.handoff-update","collaboration.recipients","collaboration.selection-create","collaboration.selection-list","collaboration.selection-version","collaboration.storage-version","collaboration.thread-create","collaboration.thread-edit","collaboration.thread-history","collaboration.thread-read","collaboration.thread-reply","collaboration.thread-resolve"]},{"family":"domain-read","resource":"relations","operations":["collaboration.relation-create","collaboration.relation-read","collaboration.relation-remove"]},{"family":"domain-read","resource":"confirmations","operations":["collaboration.confirmation-confirm","collaboration.confirmation-prepare","collaboration.confirmation-project","collaboration.cycle-read","collaboration.handoff-create","collaboration.handoff-link","collaboration.handoff-update","collaboration.recipients","collaboration.selection-create","collaboration.selection-list","collaboration.selection-version","collaboration.storage-version"]},{"family":"planner","resource":"CAP17","operations":["domain.command.CAP17.import-workbook","domain.page.CAP17"]},{"family":"planner","resource":"CAP18","operations":["domain.command.CAP18.delete","domain.command.CAP18.import-workbook","domain.command.CAP18.reset","domain.command.CAP18.save","domain.command.CAP18.spread","domain.page.CAP18"]},{"family":"planner","resource":"CAP19","operations":["domain.command.CAP19.delete","domain.command.CAP19.import-workbook","domain.command.CAP19.reset","domain.command.CAP19.save","domain.command.CAP19.spread","domain.page.CAP19","planner.monthly.apply","planner.monthly.preview"]},{"family":"planner","resource":"CAP20","operations":["domain.command.CAP20.delete","domain.command.CAP20.import-workbook","domain.command.CAP20.save","domain.command.CAP20.sync","domain.page.CAP20","planner.monthly.apply","planner.monthly.preview"]},{"family":"planner","resource":"CAP21","operations":["domain.command.CAP21.common","domain.command.CAP21.delete","domain.command.CAP21.import-workbook","domain.command.CAP21.save","domain.page.CAP21","planner.forecast.prepare"]},{"family":"planner","resource":"CAP22","operations":["domain.command.CAP22.delete","domain.command.CAP22.import-workbook","domain.command.CAP22.save","domain.page.CAP22","planner.forecast.prepare"]},{"family":"planner","resource":"CAP23","operations":["domain.command.CAP23.copy","domain.command.CAP23.delete","domain.command.CAP23.import-workbook","domain.command.CAP23.lock","domain.command.CAP23.official","domain.command.CAP23.save","domain.command.CAP23.unlock","domain.page.CAP23","planner.forecast.prepare"]},{"family":"procurement","resource":"CAP24","operations":["domain.page.CAP24","procurement.procurement-scenario-controls","procurement.procurement-scenario-preview","procurement.sourcing.prepare"]},{"family":"procurement","resource":"CAP25","operations":["domain.command.CAP25.approve","domain.command.CAP25.cancel","domain.command.CAP25.create","domain.command.CAP25.delete","domain.command.CAP25.issue","domain.command.CAP25.reject","domain.command.CAP25.save","domain.command.CAP25.select_quote","domain.command.CAP25.submit_po","domain.command.CAP25.submit_pr","domain.command.CAP25.submit_sourcing","domain.page.CAP25","procurement.procurement-scenario-controls","procurement.procurement-scenario-preview","procurement.sourcing.prepare"]},{"family":"procurement","resource":"CAP26","operations":["domain.command.CAP26.approve","domain.command.CAP26.cancel","domain.command.CAP26.create","domain.command.CAP26.delete","domain.command.CAP26.issue","domain.command.CAP26.reject","domain.command.CAP26.save","domain.command.CAP26.select_quote","domain.command.CAP26.submit_po","domain.command.CAP26.submit_pr","domain.command.CAP26.submit_sourcing","domain.page.CAP26"]},{"family":"procurement","resource":"CAP27","operations":["domain.command.CAP27.activate","domain.command.CAP27.block","domain.command.CAP27.change-bank","domain.command.CAP27.create","domain.command.CAP27.delete","domain.command.CAP27.inactivate","domain.command.CAP27.save","domain.page.CAP27"]},{"family":"procurement","resource":"CAP28","operations":["domain.command.CAP28.reset","domain.command.CAP28.save","domain.page.CAP28"]},{"family":"decisions","resource":"cases","operations":["decisions.command.sf_case_draft","decisions.command.sf_change_prepare","decisions.command.sf_question_prepare","projection.case","projection.cases"]},{"family":"decisions","resource":"case-intent","operations":["decisions.command.sf_case_draft","decisions.command.sf_change_prepare","decisions.command.sf_question_prepare","decisions.controls.read","decisions.decision-condition","decisions.decision-coverage","decisions.decision-criteria","decisions.decision-select-portfolio","projection.case","decisions.decision-edit","bi.bi-options","bi.bi-data"]},{"family":"decisions","resource":"alternatives","operations":["decisions.current-choice-prepare","decisions.current-choice-promote","projection.case"]},{"family":"decisions","resource":"assumptions","operations":["decisions.controls.read","decisions.decision-condition","decisions.decision-coverage","decisions.decision-criteria","decisions.decision-select-portfolio","projection.case"]},{"family":"decisions","resource":"choice","operations":["decisions.choice.read","decisions.current-choice-prepare","decisions.current-choice-promote","decisions.decision-add-question","decisions.decision-answer-question","decisions.decision-choose","decisions.decision-prepare-changes","decisions.decision-promote","decisions.decision-review","projection.case"]},{"family":"decisions","resource":"prepared-changes","operations":["decisions.command.sf_case_draft","decisions.command.sf_change_prepare","decisions.command.sf_question_prepare","decisions.decision-add-question","decisions.decision-answer-question","decisions.decision-apply","decisions.decision-choose","decisions.decision-prepare-changes","decisions.decision-promote","decisions.decision-recover","decisions.decision-review"]},{"family":"decisions","resource":"receipts","operations":["decisions.decision-add-question","decisions.decision-answer-question","decisions.decision-apply","decisions.decision-choose","decisions.decision-prepare-changes","decisions.decision-promote","decisions.decision-recover","decisions.decision-review"]},{"family":"portfolio","resource":"campaign","operations":["portfolio.decision-portfolio-evaluate","portfolio.decision-portfolio-preview","portfolio.decision-portfolio-read","portfolio.decision-portfolio-reconcile","portfolio.decision-portfolio-results","portfolio.decision-prepare-portfolio","portfolio.decision-promote-portfolio"]},{"family":"portfolio","resource":"results","operations":["portfolio.decision-portfolio-evaluate","portfolio.decision-portfolio-preview","portfolio.decision-portfolio-read","portfolio.decision-portfolio-reconcile","portfolio.decision-portfolio-results","portfolio.decision-prepare-portfolio","portfolio.decision-promote-portfolio"]},{"family":"portfolio","resource":"sensitivity","operations":["portfolio.decision-sensitivity-evaluate","portfolio.decision-sensitivity-read","portfolio.decision-sensitivity-units"]},{"family":"files","resource":"import-admit","operations":["files.import-admit","files.import-apply","files.import-detail","files.import-preview","files.import-reference","files.import-targets"]},{"family":"files","resource":"import-preview","operations":["files.import-admit","files.import-apply","files.import-detail","files.import-preview","files.import-reference","files.import-targets"]},{"family":"files","resource":"import-apply","operations":["files.import-admit","files.import-apply","files.import-detail","files.import-preview","files.import-reference","files.import-targets"]},{"family":"files","resource":"documents","operations":["files.document-admit","files.document-candidates","files.document-confirm","files.document-extract","files.document-open","files.document-requests","files.document-schema","files.document-schemas","files.document-search","files.document-sources"]},{"family":"files","resource":"evidence","operations":["files.asset.download","files.asset.link","files.asset.upload","files.document-admit","files.document-candidates","files.document-confirm","files.document-extract","files.document-open","files.document-requests","files.document-schema","files.document-schemas","files.document-search","files.document-sources"]},{"family":"files","resource":"document-scenario","operations":["files.document-scenario-preview","files.document-scenario-targets"]},{"family":"files","resource":"exports","operations":["files.export.json","files.export.members","files.export.review","files.export.register","files.export.suppliers","files.export.xlsx"]},{"family":"reviews","resource":"agenda","operations":["dashboard.dashboard-agenda","dashboard.dashboard-capture","dashboard.dashboard-history","dashboard.dashboard-review","dashboard.dashboard-review-preserve","projection.review"]},{"family":"reviews","resource":"preserved","operations":["dashboard.dashboard-agenda","dashboard.dashboard-capture","dashboard.dashboard-history","dashboard.dashboard-review","dashboard.dashboard-review-preserve","projection.review","reviews.review-source","reviews.review-thread-context","reviews.review-update"]},{"family":"reviews","resource":"compare","operations":["dashboard.dashboard-agenda","dashboard.dashboard-capture","dashboard.dashboard-history","dashboard.dashboard-review","dashboard.dashboard-review-preserve","projection.review","reviews.review-source","reviews.review-update"]},{"family":"reviews","resource":"report-export","operations":["reviews.export.docx","reviews.export.pptx","reviews.report.prepare"]},{"family":"bi","resource":"catalog","operations":["bi.bi-data","bi.bi-decision","bi.bi-options","bi.bi-source"]},{"family":"bi","resource":"visual","operations":["bi.bi-data","bi.bi-decision","bi.bi-options","bi.bi-source"]},{"family":"intelligence","resource":"routine-runs","operations":["projection.routine","routines.catalog","routines.prepare-admission","routines.read-admission","routines.read-run","routines.run"]},{"family":"intelligence","resource":"residents","operations":["projection.residents"]},{"family":"intelligence","resource":"signals","operations":["intelligence.memory-catalog","intelligence.memory-condition","intelligence.memory-conditions","intelligence.memory-materiality","intelligence.memory-outcome","intelligence.memory-outcome-selection","intelligence.memory-signals"]},{"family":"intelligence","resource":"similar-cases","operations":["intelligence.memory-catalog","intelligence.memory-condition","intelligence.memory-conditions","intelligence.memory-materiality","intelligence.memory-outcome","intelligence.memory-outcome-selection","intelligence.memory-signals","intelligence.memory-similar-cases"]},{"family":"intelligence","resource":"outcomes","operations":["intelligence.memory-catalog","intelligence.memory-condition","intelligence.memory-conditions","intelligence.memory-materiality","intelligence.memory-outcome","intelligence.memory-outcome-selection","intelligence.memory-signals"]},{"family":"intelligence","resource":"analysis","operations":["intelligence.analysis.cancel","intelligence.analysis.choices","intelligence.analysis.list","intelligence.analysis.output","intelligence.analysis.prepare","intelligence.analysis.read","intelligence.analysis.start"]},{"family":"intelligence","resource":"routine-admission","operations":["routines.catalog","routines.prepare-admission","routines.read-admission","routines.read-run","routines.run"]},{"family":"intelligence","resource":"schedules","operations":["schedules.create","schedules.list","schedules.pause","schedules.read","schedules.read-run","schedules.update"]}] as const satisfies readonly Readonly<{
  family: string
  resource: string
  operations: readonly SfOperationId[]
}>[]

const PAGES = [{"id":"CAP01","surface":"dashboard","page":"Executive Dashboard","actions":["save-users","save-benchmark"]},{"id":"CAP02","surface":"dashboard","page":"Hot Topics & Actions","actions":["save","delete"]},{"id":"CAP03","surface":"dashboard","page":"Budget Overview","actions":["save-month","save-revenue"]},{"id":"CAP04","surface":"dashboard","page":"OPEX Detail","actions":["save","delete","save-entry","save-deviation","annual-entry","year-amount","import"]},{"id":"CAP05","surface":"dashboard","page":"CAPEX Projects","actions":["save","delete","save-entry","save-deviation","annual-entry","year-amount"]},{"id":"CAP06","surface":"dashboard","page":"Headcount Overview","actions":[]},{"id":"CAP07","surface":"dashboard","page":"Team Structure","actions":["saveCio","saveLeader","deleteLeader","saveMember","deleteMember"]},{"id":"CAP08","surface":"dashboard","page":"Talent Review","actions":["save","delete","import","exportAllMembers"]},{"id":"CAP09","surface":"dashboard","page":"Portfolio Dashboard","actions":[]},{"id":"CAP10","surface":"dashboard","page":"All Projects","actions":["save","delete","import","save-milestone","delete-milestone"]},{"id":"CAP11","surface":"dashboard","page":"IT Operations","actions":["save-categories","save-items","save-tickets","save-sla","save-heatmap","import-month"]},{"id":"CAP12","surface":"dashboard","page":"IT Security KPIs","actions":["save-kpi","delete-kpi","save-action","delete-action","save-incident","delete-incident","save-campaign","delete-campaign"]},{"id":"CAP13","surface":"dashboard","page":"IT Risks","actions":["save","delete"]},{"id":"CAP14","surface":"dashboard","page":"Vendor Contracts","actions":["save","delete"]},{"id":"CAP15","surface":"dashboard","page":"Stakeholder Management","actions":["save","delete"]},{"id":"CAP16","surface":"dashboard","page":"IT Performance Contract","actions":["save","save-item","delete-item","save-sub","delete-sub"]},{"id":"CAP17","surface":"planner","page":"Overview","actions":["import-workbook"]},{"id":"CAP18","surface":"planner","page":"OPEX","actions":["save","delete","spread","reset","import-workbook"]},{"id":"CAP19","surface":"planner","page":"CAPEX","actions":["save","delete","spread","reset","import-workbook"]},{"id":"CAP20","surface":"planner","page":"Headcount","actions":["save","delete","sync","import-workbook"]},{"id":"CAP21","surface":"planner","page":"Entities & allocations","actions":["save","delete","common","import-workbook"]},{"id":"CAP22","surface":"planner","page":"FX rates","actions":["save","delete","import-workbook"]},{"id":"CAP23","surface":"planner","page":"Versions","actions":["save","copy","official","lock","unlock","delete","import-workbook"]},{"id":"CAP24","surface":"procurement","page":"Dashboard","actions":[]},{"id":"CAP25","surface":"procurement","page":"Requests","actions":["create","save","submit_pr","submit_sourcing","select_quote","submit_po","approve","reject","issue","cancel","delete"]},{"id":"CAP26","surface":"procurement","page":"My approvals","actions":["approve","reject"]},{"id":"CAP27","surface":"procurement","page":"Suppliers","actions":["create","save","activate","block","inactivate","delete","change-bank"]},{"id":"CAP28","surface":"procurement","page":"Settings","actions":["save","reset"]}] as const

const OPERATIONS: ReadonlySet<string> = new Set(RESOURCES.flatMap((item) => item.operations))
/** An installed observation can be published only after the corresponding resource is indexed. */
export function sfHasOperationalResource(id: string) { return OPERATIONS.has(id) }
const page = new Map<string, (typeof PAGES)[number]>(PAGES.map((entry) => [entry.id, entry] as const))

const mismatch = (): SfContextResult => ({ status: "unavailable", reason: "contract-mismatch" })
const notReady = (operationId: SfOperationId): SfOperationAvailability => ({
  operationId, state: "unavailable", reason: "operational-source-unavailable", operational: false,
})
const sameBinding = (a: Binding, b: Binding) =>
  a.installationId === b.installationId && a.projectId === b.projectId && a.hostId === b.hostId
const sameStamp = (a: SfContextStamp, b: SfContextStamp) =>
  a.installationId === b.installationId && a.projectId === b.projectId && a.hostId === b.hostId &&
  a.principalRef === b.principalRef && a.policyVersion === b.policyVersion &&
  a.accessRevision === b.accessRevision && sameTeamBinding(a.team, b.team)

function sameTeamBinding(a: SfContextStamp["team"], b: SfContextStamp["team"]): boolean {
  if (!a || !b) return a === b
  return a.owner.profile.installationId === b.owner.profile.installationId &&
    a.owner.profile.tenantId === b.owner.profile.tenantId &&
    a.owner.profile.teamObjectId === b.owner.profile.teamObjectId &&
    a.owner.principal.tenantId === b.owner.principal.tenantId &&
    a.owner.principal.principalObjectId === b.owner.principal.principalObjectId &&
    a.revisions.configRevision === b.revisions.configRevision &&
    a.revisions.accessRevision === b.revisions.accessRevision
}

function originalRequest(request: Request, expected: Binding, origin: string, mount: string, internal: boolean): boolean {
  if (request.signal.aborted) return false
  const url = new URL(request.url)
  if (url.origin !== origin || url.username || url.password || url.hash ||
    request.headers.get("sec-fetch-site") === "cross-site" ||
    (request.headers.has("origin") && request.headers.get("origin") !== origin) ||
    /%(?![\da-fA-F]{2})/.test(url.search)) return false
  if (internal) {
    if (request.method !== "GET" && request.method !== "POST") return false
    // Only exact static native routes can request internal admission. Each
    // handler remains responsible for its own selector and body validation.
    return url.search.length <= 4096 &&
      [...url.searchParams.keys()].every((key) => url.searchParams.getAll(key).length === 1) &&
      Object.values(SfOperationRegistry).some((operation) => {
        const path = operation.pathTemplate.replaceAll("{mount}", mount)
        return !path.includes("{") && path !== mount + "/api/ui/context" &&
          path.startsWith(mount + "/api/ui/") && path === url.pathname &&
          operation.method === request.method
      })
  }
  if (request.method !== "GET" || url.pathname !== mount + "/api/ui/context") return false
  const entries = [...url.searchParams.entries()]
  if (entries.length !== 3 || new Set(entries.map(([key]) => key)).size !== 3 ||
    entries.some(([key, value]) => !["installationId", "projectId", "hostId"].includes(key) || !value))
    return false
  return url.searchParams.get("installationId") === expected.installationId &&
    url.searchParams.get("projectId") === expected.projectId &&
    url.searchParams.get("hostId") === expected.hostId
}

function approvedDestinations(input: readonly Destination[]): readonly Destination[] | undefined {
  if (!Array.isArray(input) || input.length > PAGES.length) return undefined
  const found = new Set<string>()
  const output: Destination[] = []
  for (const item of input) {
    const source = page.get(item.capabilityId)
    if (!source || !item.canRead || item.surface !== source.surface || item.page !== source.page ||
      found.has(item.capabilityId) || !Array.isArray(item.allowedActionIds) ||
      new Set(item.allowedActionIds).size !== item.allowedActionIds.length ||
      item.allowedActionIds.some((action: string) => !source.actions.some((allowed) => allowed === action)))
      return undefined
    found.add(item.capabilityId)
    output.push(Object.freeze({
      capabilityId: item.capabilityId, surface: item.surface, page: item.page,
      canRead: true, allowedActionIds: Object.freeze([...item.allowedActionIds]),
    }))
  }
  return Object.freeze(output)
}

/** Host-only mapper: these pages have already passed the original per-surface ACL. */
export type SfLiveAdmittedPage = Readonly<{
  surface: "dashboard" | "planner" | "procurement"
  page: string
}>
export type SfLivePageActions = SfLiveAdmittedPage & Readonly<{ allowedActionIds: readonly string[] }>
export function sfContextDestinationsFromPages(
  pages: readonly SfLiveAdmittedPage[],
  observedActions?: readonly SfLivePageActions[],
): SfContext["destinations"] | undefined {
  if (!Array.isArray(pages) || pages.length > PAGES.length) return undefined
  if (observedActions !== undefined && (!Array.isArray(observedActions) || observedActions.length !== pages.length)) return undefined
  const actions = new Map<string, readonly string[]>()
  for (const item of observedActions ?? []) {
    if (!item || !Array.isArray(item.allowedActionIds)) return undefined
    const source = PAGES.find((entry) => entry.surface === item.surface && entry.page === item.page)
    if (!source || actions.has(source.id) || !pages.some((page) => page.surface === item.surface && page.page === item.page) ||
      new Set(item.allowedActionIds).size !== item.allowedActionIds.length ||
      item.allowedActionIds.some((id: string) => !source.actions.some((allowed) => allowed === id))) return undefined
    actions.set(source.id, item.allowedActionIds)
  }
  const result: Destination[] = []
  const seen = new Set<string>()
  for (const item of pages) {
    if (!item || typeof item !== "object") return undefined
    const source = PAGES.find((entry) => entry.surface === item.surface && entry.page === item.page)
    if (!source || seen.has(source.id)) return undefined
    seen.add(source.id)
    // Never read action claims from the admitted page object itself.
    if (observedActions !== undefined && !actions.has(source.id)) return undefined
    result.push({ capabilityId: source.id, surface: source.surface, page: source.page,
      canRead: true, allowedActionIds: actions.get(source.id) ?? [] })
  }
  return approvedDestinations(result)
}

function operational(
  observations: readonly SfLiveOperationalObservation[],
): ReadonlyMap<string, SfOperationAvailability> | undefined {
  if (!Array.isArray(observations) || observations.length > OPERATIONS.size) return undefined
  const admitted = new Map<string, SfOperationAvailability>()
  for (const observation of observations) {
    if (!Schema.is(SfOperationAvailabilitySchema)(observation) ||
      !OPERATIONS.has(observation.operationId) || admitted.has(observation.operationId) ||
      observation.operationId === "ctx.context" && observation.state !== "ready")
      return undefined
    admitted.set(observation.operationId, Object.freeze({ ...observation }))
  }
  // A successful read is direct evidence that ctx.context was operational.
  admitted.set("ctx.context", {
    operationId: "ctx.context", state: "ready", reason: null, operational: true,
  })
  return admitted
}

function availability(admitted: ReadonlyMap<string, SfOperationAvailability>): SfContext["availability"] | undefined {
  const correlated: SfContext["availability"][number][] = []
  for (const resource of RESOURCES) {
    const operations = resource.operations.map((id) => admitted.get(id) ?? notReady(id))
    const ready = operations.filter((item) => item.state === "ready").length
    const denied = operations.filter((item) => item.state === "denied").length
    const state = ready === operations.length ? "ready" :
      ready > 0 ? "partial" : denied === operations.length ? "denied" : "unavailable"
    // Each frozen catalog tuple must satisfy one closed discriminated union arm.
    // Never widen family/resource independently or turn catalog membership into readiness.
    const entry = { family: resource.family, resource: resource.resource, state, operations }
    if (!Schema.is(SfResourceAvailability)(entry)) return undefined
    correlated.push(entry)
  }
  return Object.freeze(correlated)
}

function equalObservations(a: ReadonlyMap<string, SfOperationAvailability>, b: ReadonlyMap<string, SfOperationAvailability>) {
  if (a.size !== b.size) return false
  return [...a].every(([id, item]) => {
    const other = b.get(id)
    return !!other && item.state === other.state && item.reason === other.reason &&
      item.operational === other.operational
  })
}

function equalDestinations(a: readonly Destination[], b: readonly Destination[]) {
  if (a.length !== b.length) return false
  const other = new Map(b.map((entry) => [entry.capabilityId, entry]))
  return a.every((entry) => {
    const current = other.get(entry.capabilityId)
    return !!current && current.surface === entry.surface && current.page === entry.page &&
      current.canRead === entry.canRead && current.allowedActionIds.length === entry.allowedActionIds.length &&
      current.allowedActionIds.every((action) => entry.allowedActionIds.includes(action))
  })
}

/** Does not start a listener, persist data, issue grants, or create a Request. */
export function createSfLiveContext(source: SfLiveContextSources): Readonly<{
  currentBinding: SfLiveContextSources["currentBinding"]
  readContext: (request: Request, expected: Binding) => Promise<SfContextResult>
  readRequestContext: (request: Request, expected: Binding) => Promise<SfContextResult>
  teamTenantId?: string
  readTeamContext: (request: Request, expected: SfTeamContextQuery) => Promise<SfTeamContextResult>
}> {
  if (!URL.canParse(source.origin) || new URL(source.origin).origin !== source.origin ||
    !/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+$/.test(source.mount))
    throw new Error("SF_LIVE_CONTEXT_CONFIG_INVALID")

  const currentBinding = source.currentBinding
  const read = async (request: Request, expected: Binding, internal: boolean): Promise<SfContextResult> => {
    if (!internal && source.teams || !originalRequest(request, expected, source.origin, source.mount, internal)) return mismatch()
    const firstBinding = currentBinding()
    if (!firstBinding) return { status: "unavailable", reason: "identity-unavailable" }
    if (!sameBinding(firstBinding, expected)) return mismatch()
    const stillCurrent = () => !request.signal.aborted && currentBinding() === firstBinding &&
      sameBinding(firstBinding, expected)

    // No principal or policy is accepted from query, headers, browser or registry.
    const first = await source.admit(request).catch((): SfLiveContextAdmission =>
      ({ status: "unavailable", reason: "host-unavailable" }))
    if (!stillCurrent()) return mismatch()
    if (first.status !== "ok") return first
    if (!sameBinding(first.stamp, expected) || !first.stamp.principalRef ||
      !first.stamp.policyVersion || !first.stamp.accessRevision) return mismatch()
    // Copy the first observed stamp: the private authority may refresh or
    // revoke its own mutable working state during a subsequent await.
    const admittedStamp = Object.freeze(structuredClone(first.stamp))
    const admittedMode = first.authMode
    const destinations = approvedDestinations(first.destinations)
    if (!destinations) return mismatch()

    const readOperations = async (): Promise<ReadonlyMap<string, SfOperationAvailability> | undefined> => {
      if (!source.operational) return operational([])
      const actual = await source.operational(request, admittedStamp)
      if (request.signal.aborted || !stillCurrent()) return undefined
      // These two settings operations are local-operator UI69 producers. Mode
      // comes from the current original admission, never request metadata.
      return operational(actual.filter((item) => admittedMode === "local-operator" ||
        item.operationId !== "local-admin.summary-read" && item.operationId !== "local-admin.summary-configure"))
    }
    const before = await readOperations().catch(() => undefined)
    if (!stillCurrent() || !before) return mismatch()

    // Reauthenticate through the same original Request, including policy/grant
    // and accessRevision, after the asynchronous operational source read.
    const again = await source.admit(request).catch((): SfLiveContextAdmission =>
      ({ status: "unavailable", reason: "host-unavailable" }))
    if (!stillCurrent() || again.status !== "ok" ||
      !sameStamp(admittedStamp, again.stamp) || admittedMode !== again.authMode) return mismatch()
    const againDestinations = approvedDestinations(again.destinations)
    if (!againDestinations || !equalDestinations(destinations, againDestinations)) return mismatch()
    const after = await readOperations().catch(() => undefined)
    if (!stillCurrent() || !after || !equalObservations(before, after)) return mismatch()

    // Final fence covers revocation while the second operational observation
    // was in flight. No await occurs after this last authenticated comparison.
    const final = await source.admit(request).catch((): SfLiveContextAdmission =>
      ({ status: "unavailable", reason: "host-unavailable" }))
    if (!stillCurrent() || final.status !== "ok" ||
      !sameStamp(admittedStamp, final.stamp) || admittedMode !== final.authMode) return mismatch()
    const finalDestinations = approvedDestinations(final.destinations)
    if (!finalDestinations || !equalDestinations(destinations, finalDestinations)) return mismatch()

    const currentAvailability = availability(after)
    if (!currentAvailability) return mismatch()
    const value = {
      stamp: admittedStamp,
      contractRevision: "sf-native-ui/1" as const,
      authMode: admittedMode,
      destinations,
      availability: currentAvailability,
    }
    if (!Schema.is(SfContextSchema)(value)) return mismatch()
    return { status: "ok", value }
  }
  const readTeamContext = async (request: Request, expected: SfTeamContextQuery): Promise<SfTeamContextResult> => {
    const teams = source.teams
    const firstBinding = currentBinding()
    if (!teams || !firstBinding) return { status: "unavailable", reason: "host-unavailable" }
    const query = readTeamContextQuery(request, {
      installationId: firstBinding.installationId, tenantId: teams.tenantId, origin: source.origin, mount: source.mount,
    })
    if (!query || request.method !== "GET" || query.hostId !== firstBinding.hostId ||
      query.installationId !== expected.installationId || query.tenantId !== expected.tenantId ||
      query.hostId !== expected.hostId || query.kind !== expected.kind || query.teamObjectId !== expected.teamObjectId)
      return { status: "unavailable", reason: "contract-mismatch" }
    const stillCurrent = () => !request.signal.aborted && source.teams === teams &&
      currentBinding() === firstBinding && firstBinding.hostId === query.hostId &&
      firstBinding.installationId === query.installationId
    const project = (admitted: Extract<SfLiveTeamContextAdmission, { status: "ok" }>) => {
      const destinations = approvedDestinations(admitted.destinations)
      if (!destinations || admitted.technical.team || !sameBinding(admitted.technical, firstBinding) ||
        admitted.projection.principal.tenantId !== teams.tenantId ||
        query.kind === "administration" && admitted.binding ||
        query.kind === "team" && admitted.projection.teams.status === "ready" &&
          admitted.projection.teams.selected.teamObjectId !== query.teamObjectId)
        return undefined
      const value = {
        contractRevision: "sf-team-profile/1", authMode: "microsoft",
        stamp: { ...admitted.technical, ...(admitted.binding ? { team: admitted.binding } : {}) },
        profile: admitted.projection, destinations, availability: [],
      }
      const parsed = Schema.decodeUnknownOption(SfTeamContext)(value)
      return Option.isSome(parsed) ? structuredClone(parsed.value) : undefined
    }
    const readAdmission = () => teams.admit(request).catch((): SfLiveTeamContextAdmission =>
      ({ status: "unavailable", reason: "host-unavailable" }))
    const first = await readAdmission()
    if (!stillCurrent()) return { status: "unavailable", reason: "contract-mismatch" }
    if (first.status !== "ok") return first
    const admitted = project(first)
    if (!admitted) return { status: "unavailable", reason: "contract-mismatch" }
    const original = JSON.stringify(admitted)
    const readOperations = async () => !admitted.stamp.team || !source.operational
      ? operational([]) : operational(await source.operational(request, admitted.stamp))
    const before = await readOperations().catch(() => undefined)
    if (!stillCurrent() || !before) return { status: "unavailable", reason: "contract-mismatch" }
    const again = await readAdmission()
    if (!stillCurrent() || again.status !== "ok" || JSON.stringify(project(again)) !== original)
      return { status: "unavailable", reason: "contract-mismatch" }
    const after = await readOperations().catch(() => undefined)
    if (!stillCurrent() || !after || !equalObservations(before, after))
      return { status: "unavailable", reason: "contract-mismatch" }
    const final = await readAdmission()
    if (!stillCurrent() || final.status !== "ok" || JSON.stringify(project(final)) !== original)
      return { status: "unavailable", reason: "contract-mismatch" }
    const currentAvailability = admitted.stamp.team ? availability(after) : []
    if (!currentAvailability) return { status: "unavailable", reason: "contract-mismatch" }
    const value = { ...admitted, availability: currentAvailability }
    return Schema.is(SfTeamContext)(value)
      ? { status: "ok", value } : { status: "unavailable", reason: "contract-mismatch" }
  }
  return Object.freeze({ currentBinding,
    ...(source.teams ? { teamTenantId: source.teams.tenantId } : {}),
    readContext: (request: Request, expected: Binding) => read(request, expected, false),
    readRequestContext: (request: Request, expected: Binding) => read(request, expected, true),
    readTeamContext,
  })
}
