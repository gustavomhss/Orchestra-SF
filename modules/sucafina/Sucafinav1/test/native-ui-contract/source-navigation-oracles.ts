// Independent page identities used only by the explicitly isolated navigation component fixture.
export const sourceNavigationChapters: readonly { chapter: string; pages: readonly { cap: string; path: string; page: string }[] }[] = [
  { chapter: "sf-dashboard", pages: [
    {"cap":"CAP01","path":"/orchestra/sf-dashboard/executive","page":"Executive Dashboard"},
    {"cap":"CAP02","path":"/orchestra/sf-dashboard/hot-topics","page":"Hot Topics & Actions"},
    {"cap":"CAP03","path":"/orchestra/sf-dashboard/budget","page":"Budget Overview"},
    {"cap":"CAP04","path":"/orchestra/sf-dashboard/opex","page":"OPEX Detail"},
    {"cap":"CAP05","path":"/orchestra/sf-dashboard/capex","page":"CAPEX Projects"},
  ] },
  { chapter: "sf-people", pages: [
    {"cap":"CAP06","path":"/orchestra/sf-people/overview","page":"Headcount Overview"},
    {"cap":"CAP07","path":"/orchestra/sf-people/structure","page":"Team Structure"},
    {"cap":"CAP08","path":"/orchestra/sf-people/talent","page":"Talent Review"},
  ] },
  { chapter: "sf-portfolio", pages: [
    {"cap":"CAP09","path":"/orchestra/sf-portfolio/overview","page":"Portfolio Dashboard"},
    {"cap":"CAP10","path":"/orchestra/sf-portfolio/projects","page":"All Projects"},
  ] },
  { chapter: "sf-operations", pages: [
    {"cap":"CAP11","path":"/orchestra/sf-operations/service","page":"IT Operations"},
    {"cap":"CAP12","path":"/orchestra/sf-operations/security","page":"IT Security KPIs"},
    {"cap":"CAP13","path":"/orchestra/sf-operations/risks","page":"IT Risks"},
    {"cap":"CAP15","path":"/orchestra/sf-operations/stakeholders","page":"Stakeholder Management"},
    {"cap":"CAP16","path":"/orchestra/sf-operations/performance","page":"IT Performance Contract"},
  ] },
  { chapter: "sf-procurement", pages: [
    {"cap":"CAP14","path":"/orchestra/sf-procurement/contracts","page":"Vendor Contracts"},
    {"cap":"CAP24","path":"/orchestra/sf-procurement/overview","page":"Dashboard"},
    {"cap":"CAP25","path":"/orchestra/sf-procurement/requests","page":"Requests"},
    {"cap":"CAP26","path":"/orchestra/sf-procurement/approvals","page":"My approvals"},
    {"cap":"CAP27","path":"/orchestra/sf-procurement/suppliers","page":"Suppliers"},
    {"cap":"CAP28","path":"/orchestra/sf-procurement/settings","page":"Settings"},
  ] },
  { chapter: "sf-planner", pages: [
    {"cap":"CAP17","path":"/orchestra/sf-planner/overview","page":"Overview"},
    {"cap":"CAP18","path":"/orchestra/sf-planner/opex","page":"OPEX"},
    {"cap":"CAP19","path":"/orchestra/sf-planner/capex","page":"CAPEX"},
    {"cap":"CAP20","path":"/orchestra/sf-planner/headcount","page":"Headcount"},
    {"cap":"CAP21","path":"/orchestra/sf-planner/allocations","page":"Entities & allocations"},
    {"cap":"CAP22","path":"/orchestra/sf-planner/fx","page":"FX rates"},
    {"cap":"CAP23","path":"/orchestra/sf-planner/versions","page":"Versions"},
  ] },
]
