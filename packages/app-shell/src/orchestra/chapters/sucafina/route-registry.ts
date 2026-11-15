/**
 * I00 native route C65 consumer.
 *
 * Exact routes from the frozen 70-surface UI manifest. This is ONLY the
 * pathname parser used before F01's source-authorized route resolution.
 * Successful recognition never creates an owner, grant, context or operation.
 * The existing navigation-state transition validates the selected installation.
 */
import type { SfRef, SurfaceId } from "@orchestra/schema/sucafina/context"
import { decodeSfRouteRef } from "./navigation-state"

export type SfNativeChapterId =
  | "sf-dashboard" | "sf-people" | "sf-portfolio" | "sf-operations" | "sf-procurement"
  | "sf-planner" | "sf-home" | "sf-work" | "sf-decisions" | "sf-bi"
  | "sf-reviews" | "sf-imports" | "sf-documents" | "sf-memory" | "sf-routines"

export type SfNativeRouteSpec = Readonly<{
  surfaceId: SurfaceId
  chapterId: SfNativeChapterId
  kind: string
  pattern: string
}>

/** Exactly the frozen manifest paths; no inference from nested UI folders. */
export const sfNativeRouteSpecs: readonly SfNativeRouteSpec[] = Object.freeze([
  {
    "surfaceId": "UI45",
    "chapterId": "sf-bi",
    "kind": "entry",
    "pattern": "/orchestra/sf-bi"
  },
  {
    "surfaceId": "CAP03",
    "chapterId": "sf-dashboard",
    "kind": "entry",
    "pattern": "/orchestra/sf-dashboard/budget"
  },
  {
    "surfaceId": "CAP05",
    "chapterId": "sf-dashboard",
    "kind": "entry",
    "pattern": "/orchestra/sf-dashboard/capex"
  },
  {
    "surfaceId": "CAP05",
    "chapterId": "sf-dashboard",
    "kind": "new",
    "pattern": "/orchestra/sf-dashboard/capex/new"
  },
  {
    "surfaceId": "CAP01",
    "chapterId": "sf-dashboard",
    "kind": "entry",
    "pattern": "/orchestra/sf-dashboard/executive"
  },
  {
    "surfaceId": "CAP02",
    "chapterId": "sf-dashboard",
    "kind": "entry",
    "pattern": "/orchestra/sf-dashboard/hot-topics"
  },
  {
    "surfaceId": "CAP02",
    "chapterId": "sf-dashboard",
    "kind": "new",
    "pattern": "/orchestra/sf-dashboard/hot-topics/new"
  },
  {
    "surfaceId": "CAP04",
    "chapterId": "sf-dashboard",
    "kind": "entry",
    "pattern": "/orchestra/sf-dashboard/opex"
  },
  {
    "surfaceId": "CAP04",
    "chapterId": "sf-dashboard",
    "kind": "new",
    "pattern": "/orchestra/sf-dashboard/opex/new"
  },
  {
    "surfaceId": "UI33",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions"
  },
  {
    "surfaceId": "UI33",
    "chapterId": "sf-decisions",
    "kind": "new",
    "pattern": "/orchestra/sf-decisions/new"
  },
  {
    "surfaceId": "UI58",
    "chapterId": "sf-documents",
    "kind": "entry",
    "pattern": "/orchestra/sf-documents"
  },
  {
    "surfaceId": "UI58",
    "chapterId": "sf-documents",
    "kind": "new",
    "pattern": "/orchestra/sf-documents/new"
  },
  {
    "surfaceId": "UI29",
    "chapterId": "sf-home",
    "kind": "entry",
    "pattern": "/orchestra/sf-home"
  },
  {
    "surfaceId": "UI69",
    "chapterId": "sf-home",
    "kind": "entry",
    "pattern": "/orchestra/sf-home/administration"
  },
  {
    "surfaceId": "UI67",
    "chapterId": "sf-home",
    "kind": "entry",
    "pattern": "/orchestra/sf-home/context"
  },
  {
    "surfaceId": "UI31",
    "chapterId": "sf-home",
    "kind": "entry",
    "pattern": "/orchestra/sf-home/search"
  },
  {
    "surfaceId": "UI57",
    "chapterId": "sf-imports",
    "kind": "history",
    "pattern": "/orchestra/sf-imports"
  },
  {
    "surfaceId": "UI68",
    "chapterId": "sf-imports",
    "kind": "entry",
    "pattern": "/orchestra/sf-imports/exports"
  },
  {
    "surfaceId": "UI55",
    "chapterId": "sf-imports",
    "kind": "entry",
    "pattern": "/orchestra/sf-imports/new"
  },
  {
    "surfaceId": "UI61",
    "chapterId": "sf-memory",
    "kind": "chapter-root",
    "pattern": "/orchestra/sf-memory"
  },
  {
    "surfaceId": "UI62",
    "chapterId": "sf-memory",
    "kind": "entry",
    "pattern": "/orchestra/sf-memory/cases"
  },
  {
    "surfaceId": "UI63",
    "chapterId": "sf-memory",
    "kind": "selection",
    "pattern": "/orchestra/sf-memory/outcomes"
  },
  {
    "surfaceId": "UI61",
    "chapterId": "sf-memory",
    "kind": "entry",
    "pattern": "/orchestra/sf-memory/signals"
  },
  {
    "surfaceId": "CAP16",
    "chapterId": "sf-operations",
    "kind": "entry",
    "pattern": "/orchestra/sf-operations/performance"
  },
  {
    "surfaceId": "CAP13",
    "chapterId": "sf-operations",
    "kind": "entry",
    "pattern": "/orchestra/sf-operations/risks"
  },
  {
    "surfaceId": "CAP13",
    "chapterId": "sf-operations",
    "kind": "new",
    "pattern": "/orchestra/sf-operations/risks/new"
  },
  {
    "surfaceId": "CAP12",
    "chapterId": "sf-operations",
    "kind": "entry",
    "pattern": "/orchestra/sf-operations/security"
  },
  {
    "surfaceId": "CAP12",
    "chapterId": "sf-operations",
    "kind": "edit-kpi",
    "pattern": "/orchestra/sf-operations/security/kpi/edit"
  },
  {
    "surfaceId": "CAP11",
    "chapterId": "sf-operations",
    "kind": "entry",
    "pattern": "/orchestra/sf-operations/service"
  },
  {
    "surfaceId": "CAP11",
    "chapterId": "sf-operations",
    "kind": "edit-month",
    "pattern": "/orchestra/sf-operations/service/edit"
  },
  {
    "surfaceId": "CAP11",
    "chapterId": "sf-operations",
    "kind": "import",
    "pattern": "/orchestra/sf-operations/service/import"
  },
  {
    "surfaceId": "CAP11",
    "chapterId": "sf-operations",
    "kind": "settings",
    "pattern": "/orchestra/sf-operations/service/settings"
  },
  {
    "surfaceId": "CAP15",
    "chapterId": "sf-operations",
    "kind": "entry",
    "pattern": "/orchestra/sf-operations/stakeholders"
  },
  {
    "surfaceId": "CAP15",
    "chapterId": "sf-operations",
    "kind": "new",
    "pattern": "/orchestra/sf-operations/stakeholders/new"
  },
  {
    "surfaceId": "CAP06",
    "chapterId": "sf-people",
    "kind": "entry",
    "pattern": "/orchestra/sf-people/overview"
  },
  {
    "surfaceId": "CAP07",
    "chapterId": "sf-people",
    "kind": "entry",
    "pattern": "/orchestra/sf-people/structure"
  },
  {
    "surfaceId": "CAP07",
    "chapterId": "sf-people",
    "kind": "cio",
    "pattern": "/orchestra/sf-people/structure/cio"
  },
  {
    "surfaceId": "CAP07",
    "chapterId": "sf-people",
    "kind": "new-member",
    "pattern": "/orchestra/sf-people/structure/members/new"
  },
  {
    "surfaceId": "CAP08",
    "chapterId": "sf-people",
    "kind": "entry",
    "pattern": "/orchestra/sf-people/talent"
  },
  {
    "surfaceId": "CAP08",
    "chapterId": "sf-people",
    "kind": "export",
    "pattern": "/orchestra/sf-people/talent/export"
  },
  {
    "surfaceId": "CAP08",
    "chapterId": "sf-people",
    "kind": "import",
    "pattern": "/orchestra/sf-people/talent/import"
  },
  {
    "surfaceId": "CAP21",
    "chapterId": "sf-planner",
    "kind": "entry",
    "pattern": "/orchestra/sf-planner/allocations"
  },
  {
    "surfaceId": "CAP19",
    "chapterId": "sf-planner",
    "kind": "entry",
    "pattern": "/orchestra/sf-planner/capex"
  },
  {
    "surfaceId": "CAP19",
    "chapterId": "sf-planner",
    "kind": "review",
    "pattern": "/orchestra/sf-planner/capex/review"
  },
  {
    "surfaceId": "CAP22",
    "chapterId": "sf-planner",
    "kind": "entry",
    "pattern": "/orchestra/sf-planner/fx"
  },
  {
    "surfaceId": "CAP20",
    "chapterId": "sf-planner",
    "kind": "entry",
    "pattern": "/orchestra/sf-planner/headcount"
  },
  {
    "surfaceId": "CAP20",
    "chapterId": "sf-planner",
    "kind": "rates",
    "pattern": "/orchestra/sf-planner/headcount/rates"
  },
  {
    "surfaceId": "CAP20",
    "chapterId": "sf-planner",
    "kind": "roster-review",
    "pattern": "/orchestra/sf-planner/headcount/roster-review"
  },
  {
    "surfaceId": "CAP20",
    "chapterId": "sf-planner",
    "kind": "settings",
    "pattern": "/orchestra/sf-planner/headcount/settings"
  },
  {
    "surfaceId": "CAP18",
    "chapterId": "sf-planner",
    "kind": "entry",
    "pattern": "/orchestra/sf-planner/opex"
  },
  {
    "surfaceId": "CAP18",
    "chapterId": "sf-planner",
    "kind": "review",
    "pattern": "/orchestra/sf-planner/opex/review"
  },
  {
    "surfaceId": "CAP17",
    "chapterId": "sf-planner",
    "kind": "entry",
    "pattern": "/orchestra/sf-planner/overview"
  },
  {
    "surfaceId": "CAP23",
    "chapterId": "sf-planner",
    "kind": "entry",
    "pattern": "/orchestra/sf-planner/versions"
  },
  {
    "surfaceId": "CAP23",
    "chapterId": "sf-planner",
    "kind": "compare",
    "pattern": "/orchestra/sf-planner/versions/compare"
  },
  {
    "surfaceId": "CAP23",
    "chapterId": "sf-planner",
    "kind": "new",
    "pattern": "/orchestra/sf-planner/versions/new"
  },
  {
    "surfaceId": "CAP09",
    "chapterId": "sf-portfolio",
    "kind": "entry",
    "pattern": "/orchestra/sf-portfolio/overview"
  },
  {
    "surfaceId": "CAP10",
    "chapterId": "sf-portfolio",
    "kind": "entry",
    "pattern": "/orchestra/sf-portfolio/projects"
  },
  {
    "surfaceId": "CAP10",
    "chapterId": "sf-portfolio",
    "kind": "new",
    "pattern": "/orchestra/sf-portfolio/projects/new"
  },
  {
    "surfaceId": "UI42",
    "chapterId": "sf-portfolio",
    "kind": "list",
    "pattern": "/orchestra/sf-portfolio/scenarios"
  },
  {
    "surfaceId": "UI44",
    "chapterId": "sf-portfolio",
    "kind": "selection",
    "pattern": "/orchestra/sf-portfolio/sensitivity"
  },
  {
    "surfaceId": "CAP26",
    "chapterId": "sf-procurement",
    "kind": "entry",
    "pattern": "/orchestra/sf-procurement/approvals"
  },
  {
    "surfaceId": "CAP14",
    "chapterId": "sf-procurement",
    "kind": "entry",
    "pattern": "/orchestra/sf-procurement/contracts"
  },
  {
    "surfaceId": "CAP14",
    "chapterId": "sf-procurement",
    "kind": "new",
    "pattern": "/orchestra/sf-procurement/contracts/new"
  },
  {
    "surfaceId": "CAP24",
    "chapterId": "sf-procurement",
    "kind": "entry",
    "pattern": "/orchestra/sf-procurement/overview"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "entry",
    "pattern": "/orchestra/sf-procurement/requests"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "new",
    "pattern": "/orchestra/sf-procurement/requests/new"
  },
  {
    "surfaceId": "CAP28",
    "chapterId": "sf-procurement",
    "kind": "entry",
    "pattern": "/orchestra/sf-procurement/settings"
  },
  {
    "surfaceId": "CAP27",
    "chapterId": "sf-procurement",
    "kind": "entry",
    "pattern": "/orchestra/sf-procurement/suppliers"
  },
  {
    "surfaceId": "CAP27",
    "chapterId": "sf-procurement",
    "kind": "new",
    "pattern": "/orchestra/sf-procurement/suppliers/new"
  },
  {
    "surfaceId": "UI47",
    "chapterId": "sf-reviews",
    "kind": "entry",
    "pattern": "/orchestra/sf-reviews/agenda"
  },
  {
    "surfaceId": "UI49",
    "chapterId": "sf-reviews",
    "kind": "entry",
    "pattern": "/orchestra/sf-reviews/compare"
  },
  {
    "surfaceId": "UI50",
    "chapterId": "sf-reviews",
    "kind": "list",
    "pattern": "/orchestra/sf-reviews/reports"
  },
  {
    "surfaceId": "UI48",
    "chapterId": "sf-reviews",
    "kind": "list",
    "pattern": "/orchestra/sf-reviews/reviews"
  },
  {
    "surfaceId": "UI64",
    "chapterId": "sf-routines",
    "kind": "entry",
    "pattern": "/orchestra/sf-routines"
  },
  {
    "surfaceId": "UI70",
    "chapterId": "sf-routines",
    "kind": "entry",
    "pattern": "/orchestra/sf-routines/residents"
  },
  {
    "surfaceId": "UI65",
    "chapterId": "sf-routines",
    "kind": "list",
    "pattern": "/orchestra/sf-routines/runs"
  },
  {
    "surfaceId": "UI66",
    "chapterId": "sf-routines",
    "kind": "list",
    "pattern": "/orchestra/sf-routines/schedules"
  },
  {
    "surfaceId": "UI66",
    "chapterId": "sf-routines",
    "kind": "new",
    "pattern": "/orchestra/sf-routines/schedules/new"
  },
  {
    "surfaceId": "UI30",
    "chapterId": "sf-work",
    "kind": "entry",
    "pattern": "/orchestra/sf-work"
  },
  {
    "surfaceId": "UI51",
    "chapterId": "sf-work",
    "kind": "new",
    "pattern": "/orchestra/sf-work/relations/new"
  },
  {
    "surfaceId": "UI32",
    "chapterId": "sf-work",
    "kind": "list",
    "pattern": "/orchestra/sf-work/views"
  },
  {
    "surfaceId": "UI32",
    "chapterId": "sf-work",
    "kind": "new",
    "pattern": "/orchestra/sf-work/views/new"
  },
  {
    "surfaceId": "UI46",
    "chapterId": "sf-bi",
    "kind": "entry",
    "pattern": "/orchestra/sf-bi/:viewId"
  },
  {
    "surfaceId": "CAP05",
    "chapterId": "sf-dashboard",
    "kind": "detail",
    "pattern": "/orchestra/sf-dashboard/capex/:projectRef"
  },
  {
    "surfaceId": "CAP05",
    "chapterId": "sf-dashboard",
    "kind": "edit",
    "pattern": "/orchestra/sf-dashboard/capex/:projectRef/edit"
  },
  {
    "surfaceId": "CAP02",
    "chapterId": "sf-dashboard",
    "kind": "detail",
    "pattern": "/orchestra/sf-dashboard/hot-topics/:topicRef"
  },
  {
    "surfaceId": "CAP02",
    "chapterId": "sf-dashboard",
    "kind": "edit",
    "pattern": "/orchestra/sf-dashboard/hot-topics/:topicRef/edit"
  },
  {
    "surfaceId": "UI54",
    "chapterId": "sf-dashboard",
    "kind": "entry",
    "pattern": "/orchestra/sf-dashboard/hot-topics/proposals/:proposalRef"
  },
  {
    "surfaceId": "CAP04",
    "chapterId": "sf-dashboard",
    "kind": "detail",
    "pattern": "/orchestra/sf-dashboard/opex/:lineRef"
  },
  {
    "surfaceId": "CAP04",
    "chapterId": "sf-dashboard",
    "kind": "edit",
    "pattern": "/orchestra/sf-dashboard/opex/:lineRef/edit"
  },
  {
    "surfaceId": "UI34",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef"
  },
  {
    "surfaceId": "UI35",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef/alternatives"
  },
  {
    "surfaceId": "UI35",
    "chapterId": "sf-decisions",
    "kind": "new",
    "pattern": "/orchestra/sf-decisions/:caseRef/alternatives/new"
  },
  {
    "surfaceId": "UI41",
    "chapterId": "sf-decisions",
    "kind": "list",
    "pattern": "/orchestra/sf-decisions/:caseRef/analyses"
  },
  {
    "surfaceId": "UI36",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef/assumptions"
  },
  {
    "surfaceId": "UI39",
    "chapterId": "sf-decisions",
    "kind": "list",
    "pattern": "/orchestra/sf-decisions/:caseRef/changes"
  },
  {
    "surfaceId": "UI38",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef/choice"
  },
  {
    "surfaceId": "UI40",
    "chapterId": "sf-decisions",
    "kind": "history",
    "pattern": "/orchestra/sf-decisions/:caseRef/history"
  },
  {
    "surfaceId": "UI37",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef/questions"
  },
  {
    "surfaceId": "UI51",
    "chapterId": "sf-work",
    "kind": "case-alias",
    "pattern": "/orchestra/sf-decisions/:caseRef/relations"
  },
  {
    "surfaceId": "UI58",
    "chapterId": "sf-documents",
    "kind": "detail",
    "pattern": "/orchestra/sf-documents/:documentRef"
  },
  {
    "surfaceId": "UI59",
    "chapterId": "sf-documents",
    "kind": "entry",
    "pattern": "/orchestra/sf-documents/:documentRef/evidence"
  },
  {
    "surfaceId": "UI60",
    "chapterId": "sf-documents",
    "kind": "entry",
    "pattern": "/orchestra/sf-documents/:documentRef/scenario"
  },
  {
    "surfaceId": "UI56",
    "chapterId": "sf-imports",
    "kind": "entry",
    "pattern": "/orchestra/sf-imports/:manifestId/preview"
  },
  {
    "surfaceId": "UI57",
    "chapterId": "sf-imports",
    "kind": "entry",
    "pattern": "/orchestra/sf-imports/:manifestId/receipt"
  },
  {
    "surfaceId": "UI57",
    "chapterId": "sf-imports",
    "kind": "review",
    "pattern": "/orchestra/sf-imports/:manifestId/review"
  },
  {
    "surfaceId": "UI63",
    "chapterId": "sf-memory",
    "kind": "entry",
    "pattern": "/orchestra/sf-memory/outcomes/:selectionRef"
  },
  {
    "surfaceId": "CAP16",
    "chapterId": "sf-operations",
    "kind": "item",
    "pattern": "/orchestra/sf-operations/performance/items/:itemRef"
  },
  {
    "surfaceId": "CAP13",
    "chapterId": "sf-operations",
    "kind": "detail",
    "pattern": "/orchestra/sf-operations/risks/:riskRef"
  },
  {
    "surfaceId": "CAP13",
    "chapterId": "sf-operations",
    "kind": "edit",
    "pattern": "/orchestra/sf-operations/risks/:riskRef/edit"
  },
  {
    "surfaceId": "CAP12",
    "chapterId": "sf-operations",
    "kind": "action",
    "pattern": "/orchestra/sf-operations/security/actions/:recordRef"
  },
  {
    "surfaceId": "CAP12",
    "chapterId": "sf-operations",
    "kind": "campaign",
    "pattern": "/orchestra/sf-operations/security/campaigns/:recordRef"
  },
  {
    "surfaceId": "CAP12",
    "chapterId": "sf-operations",
    "kind": "incident",
    "pattern": "/orchestra/sf-operations/security/incidents/:recordRef"
  },
  {
    "surfaceId": "CAP15",
    "chapterId": "sf-operations",
    "kind": "detail",
    "pattern": "/orchestra/sf-operations/stakeholders/:stakeholderRef"
  },
  {
    "surfaceId": "CAP15",
    "chapterId": "sf-operations",
    "kind": "edit",
    "pattern": "/orchestra/sf-operations/stakeholders/:stakeholderRef/edit"
  },
  {
    "surfaceId": "CAP07",
    "chapterId": "sf-people",
    "kind": "leader",
    "pattern": "/orchestra/sf-people/structure/leaders/:personRef"
  },
  {
    "surfaceId": "CAP07",
    "chapterId": "sf-people",
    "kind": "member",
    "pattern": "/orchestra/sf-people/structure/members/:personRef"
  },
  {
    "surfaceId": "CAP07",
    "chapterId": "sf-people",
    "kind": "member-edit",
    "pattern": "/orchestra/sf-people/structure/members/:personRef/edit"
  },
  {
    "surfaceId": "CAP08",
    "chapterId": "sf-people",
    "kind": "member",
    "pattern": "/orchestra/sf-people/talent/:personRef"
  },
  {
    "surfaceId": "CAP08",
    "chapterId": "sf-people",
    "kind": "edit",
    "pattern": "/orchestra/sf-people/talent/:personRef/edit"
  },
  {
    "surfaceId": "CAP21",
    "chapterId": "sf-planner",
    "kind": "entity",
    "pattern": "/orchestra/sf-planner/allocations/entities/:entityRef"
  },
  {
    "surfaceId": "CAP21",
    "chapterId": "sf-planner",
    "kind": "allocation",
    "pattern": "/orchestra/sf-planner/allocations/entries/:allocationRef"
  },
  {
    "surfaceId": "CAP19",
    "chapterId": "sf-planner",
    "kind": "line",
    "pattern": "/orchestra/sf-planner/capex/lines/:lineRef"
  },
  {
    "surfaceId": "CAP19",
    "chapterId": "sf-planner",
    "kind": "line-edit",
    "pattern": "/orchestra/sf-planner/capex/lines/:lineRef/edit"
  },
  {
    "surfaceId": "CAP19",
    "chapterId": "sf-planner",
    "kind": "project",
    "pattern": "/orchestra/sf-planner/capex/projects/:projectRef"
  },
  {
    "surfaceId": "CAP20",
    "chapterId": "sf-planner",
    "kind": "position",
    "pattern": "/orchestra/sf-planner/headcount/positions/:positionRef"
  },
  {
    "surfaceId": "CAP20",
    "chapterId": "sf-planner",
    "kind": "position-edit",
    "pattern": "/orchestra/sf-planner/headcount/positions/:positionRef/edit"
  },
  {
    "surfaceId": "CAP18",
    "chapterId": "sf-planner",
    "kind": "line",
    "pattern": "/orchestra/sf-planner/opex/lines/:lineRef"
  },
  {
    "surfaceId": "CAP18",
    "chapterId": "sf-planner",
    "kind": "line-edit",
    "pattern": "/orchestra/sf-planner/opex/lines/:lineRef/edit"
  },
  {
    "surfaceId": "CAP23",
    "chapterId": "sf-planner",
    "kind": "detail",
    "pattern": "/orchestra/sf-planner/versions/:versionRef"
  },
  {
    "surfaceId": "CAP10",
    "chapterId": "sf-portfolio",
    "kind": "detail",
    "pattern": "/orchestra/sf-portfolio/projects/:projectRef"
  },
  {
    "surfaceId": "CAP10",
    "chapterId": "sf-portfolio",
    "kind": "edit",
    "pattern": "/orchestra/sf-portfolio/projects/:projectRef/edit"
  },
  {
    "surfaceId": "CAP10",
    "chapterId": "sf-portfolio",
    "kind": "milestones",
    "pattern": "/orchestra/sf-portfolio/projects/:projectRef/milestones"
  },
  {
    "surfaceId": "UI42",
    "chapterId": "sf-portfolio",
    "kind": "entry",
    "pattern": "/orchestra/sf-portfolio/scenarios/:caseRef"
  },
  {
    "surfaceId": "CAP26",
    "chapterId": "sf-procurement",
    "kind": "detail",
    "pattern": "/orchestra/sf-procurement/approvals/:requestRef"
  },
  {
    "surfaceId": "CAP26",
    "chapterId": "sf-procurement",
    "kind": "review",
    "pattern": "/orchestra/sf-procurement/approvals/:requestRef/review"
  },
  {
    "surfaceId": "CAP14",
    "chapterId": "sf-procurement",
    "kind": "detail",
    "pattern": "/orchestra/sf-procurement/contracts/:contractRef"
  },
  {
    "surfaceId": "CAP14",
    "chapterId": "sf-procurement",
    "kind": "edit",
    "pattern": "/orchestra/sf-procurement/contracts/:contractRef/edit"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "detail",
    "pattern": "/orchestra/sf-procurement/requests/:requestRef"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "history",
    "pattern": "/orchestra/sf-procurement/requests/:requestRef/history"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "po",
    "pattern": "/orchestra/sf-procurement/requests/:requestRef/po"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "requisition",
    "pattern": "/orchestra/sf-procurement/requests/:requestRef/requisition"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "sourcing",
    "pattern": "/orchestra/sf-procurement/requests/:requestRef/sourcing"
  },
  {
    "surfaceId": "CAP25",
    "chapterId": "sf-procurement",
    "kind": "quotes",
    "pattern": "/orchestra/sf-procurement/requests/:requestRef/sourcing/compare"
  },
  {
    "surfaceId": "CAP27",
    "chapterId": "sf-procurement",
    "kind": "detail",
    "pattern": "/orchestra/sf-procurement/suppliers/:supplierRef"
  },
  {
    "surfaceId": "CAP27",
    "chapterId": "sf-procurement",
    "kind": "edit",
    "pattern": "/orchestra/sf-procurement/suppliers/:supplierRef/edit"
  },
  {
    "surfaceId": "UI50",
    "chapterId": "sf-reviews",
    "kind": "entry",
    "pattern": "/orchestra/sf-reviews/reports/:reviewRef"
  },
  {
    "surfaceId": "UI48",
    "chapterId": "sf-reviews",
    "kind": "entry",
    "pattern": "/orchestra/sf-reviews/reviews/:reviewRef"
  },
  {
    "surfaceId": "UI48",
    "chapterId": "sf-reviews",
    "kind": "present",
    "pattern": "/orchestra/sf-reviews/reviews/:reviewRef/present"
  },
  {
    "surfaceId": "UI64",
    "chapterId": "sf-routines",
    "kind": "admission",
    "pattern": "/orchestra/sf-routines/admissions/:admissionRef"
  },
  {
    "surfaceId": "UI64",
    "chapterId": "sf-routines",
    "kind": "recipe",
    "pattern": "/orchestra/sf-routines/recipes/:recipeRef"
  },
  {
    "surfaceId": "UI65",
    "chapterId": "sf-routines",
    "kind": "entry",
    "pattern": "/orchestra/sf-routines/runs/:runRef"
  },
  {
    "surfaceId": "UI66",
    "chapterId": "sf-routines",
    "kind": "entry",
    "pattern": "/orchestra/sf-routines/schedules/:scheduleRef"
  },
  {
    "surfaceId": "UI53",
    "chapterId": "sf-work",
    "kind": "entry",
    "pattern": "/orchestra/sf-work/confirmations/:selectionRef"
  },
  {
    "surfaceId": "UI51",
    "chapterId": "sf-work",
    "kind": "entry",
    "pattern": "/orchestra/sf-work/relations/:relationRef"
  },
  {
    "surfaceId": "UI52",
    "chapterId": "sf-work",
    "kind": "entry",
    "pattern": "/orchestra/sf-work/threads/:threadRef"
  },
  {
    "surfaceId": "UI32",
    "chapterId": "sf-work",
    "kind": "entry",
    "pattern": "/orchestra/sf-work/views/:viewId"
  },
  {
    "surfaceId": "UI35",
    "chapterId": "sf-decisions",
    "kind": "detail",
    "pattern": "/orchestra/sf-decisions/:caseRef/alternatives/:alternativeRef"
  },
  {
    "surfaceId": "UI41",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef/analyses/:analysisRef"
  },
  {
    "surfaceId": "UI39",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef/changes/:changeRef"
  },
  {
    "surfaceId": "UI40",
    "chapterId": "sf-decisions",
    "kind": "entry",
    "pattern": "/orchestra/sf-decisions/:caseRef/receipts/:receiptRef"
  },
  {
    "surfaceId": "CAP16",
    "chapterId": "sf-operations",
    "kind": "subitem",
    "pattern": "/orchestra/sf-operations/performance/items/:itemRef/subitems/:subitemRef"
  },
  {
    "surfaceId": "UI43",
    "chapterId": "sf-portfolio",
    "kind": "entry",
    "pattern": "/orchestra/sf-portfolio/scenarios/:caseRef/results/:resultRef"
  },
  {
    "surfaceId": "UI44",
    "chapterId": "sf-portfolio",
    "kind": "entry",
    "pattern": "/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef"
  }
])

export type SfNativeRouteCandidate = Readonly<{
  surfaceId: SurfaceId
  chapterId: SfNativeChapterId
  kind: string
  parameters: Readonly<Record<string, SfRef>>
}>

/**
 * Strict untrusted path recognition. Source access and owner-key admission
 * are separate: a candidate MUST go through F01.resolveAuthorizedRoute.
 *
 * All opaque route refs use only F01's canonical r_ base64url UTF8 codec.
 * An invalid segment does not fall back to a selected or stale record.
 */
export function matchSfNativeRoutePath(pathname: string): SfNativeRouteCandidate | undefined {
  if (!pathname.startsWith("/orchestra/") || pathname.includes("%") ||
      pathname.includes("?") || pathname.includes("#") || pathname.includes("\\") ||
      pathname.endsWith("/") || pathname.includes("//")) return undefined
  const segments = pathname.split("/")
  for (const route of sfNativeRouteSpecs) {
    const expected = route.pattern.split("/")
    if (expected.length !== segments.length) continue
    const parameters: Record<string, SfRef> = {}
    let valid = true
    for (let index = 0; index < expected.length; index++) {
      const part = expected[index]!
      const actual = segments[index]!
      if (part.startsWith(":")) {
        const decoded = decodeSfRouteRef(actual)
        if (!decoded) { valid = false; break }
        parameters[part.slice(1)] = decoded
      } else if (part !== actual) { valid = false; break }
    }
    if (valid) return { surfaceId: route.surfaceId, chapterId: route.chapterId,
      kind: route.kind, parameters }
  }
  return undefined
}
