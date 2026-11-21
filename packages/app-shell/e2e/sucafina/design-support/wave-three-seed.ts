import type { Actor, Command, Domain, Environment, Snapshot } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { rows } from "../../../../../modules/sucafina/Sucafinav1/runtime/contract"
import { DashboardBudget } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-budget"
import { DashboardPeople } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-people"
import { DashboardPortfolio } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio"
import { DashboardOperations } from "../../../../../modules/sucafina/Sucafinav1/runtime/dashboard-operations"
import { PlannerModule } from "../../../../../modules/sucafina/Sucafinav1/runtime/planner"
import { waveThreeData } from "./wave-three-data"

/** The producer owns values, normalization, IDs and revisions. Never patch a stored projection. */
function executor(snapshot: Snapshot, actor: Actor, environment: Environment) {
  return (domain: Domain, command: Command) => {
    const result = domain.execute(snapshot, actor, command, environment)
    if (!result.ok) throw new Error("Canonical wave-three seed rejected: " + command.page + "/" + command.action +
      " (" + result.status + ") " + (result.errors ?? []).join("; "))
    return result.value
  }
}
function revision(snapshot: Snapshot, key: string) { return snapshot.versions[key]?.version ?? 0 }
function named(records: Record<string, unknown>[], name: string) {
  const found = records.filter((record) => record.name === name)
  const first = found[0]
  if (found.length !== 1 || !first || typeof first.id !== "string") throw new Error("Canonical seed record missing: " + name)
  return first.id
}

export function seedWaveThreeDashboard(snapshot: Snapshot, actor: Actor, environment: Environment, year: number, month: number) {
  const execute = executor(snapshot, actor, environment)
  const add = (domain: Domain, page: string, action: string, values: Record<string, unknown>) =>
    execute(domain, { page, action, version: 0, values })
  const date = (day: number) => year + "-" + String(month).padStart(2, "0") + "-" + String(day).padStart(2, "0")
  const capexId = named(rows(snapshot.data.capexProjects), waveThreeData.capex.primary)
  for (let value = 2; value <= 6; value++) add(DashboardBudget.domain, "CAPEX Projects", "save-entry", {
    projId: capexId, year, month: value, budget: 20000, actual: value === 6 ? 0 : 16000 + value * 700, forecast: 19000 + value * 300,
  })
  for (const project of [
    { name: waveThreeData.capex.resilience, budget: 180000 },
    { name: waveThreeData.capex.automation, budget: 96000 },
  ]) {
    add(DashboardBudget.domain, "CAPEX Projects", "save", project)
    const projId = named(rows(snapshot.data.capexProjects), project.name)
    for (let value = 1; value <= 6; value++) add(DashboardBudget.domain, "CAPEX Projects", "save-entry", {
      projId, year, month: value, budget: project.budget / 12,
      actual: value === 6 ? 0 : project.budget / 12 - 1200, forecast: project.budget / 12 + 400,
    })
  }
  // Months 7–12 genuinely have no source entry; zero in month 6 is a real recorded zero.
  execute(DashboardBudget.domain, { page: "CAPEX Projects", action: "save-deviation", id: capexId, version: 0,
    values: { year, month: 4, flag: "dev-amber", text: "Design test data · Supplier delivery timing requires a source review." } })

  add(DashboardPeople.domain, "Team Structure", "saveCio", {
    name: waveThreeData.people.cio, title: "Chief Information Officer", location: "Geneva", start: "2020-03-02",
  })
  for (const leader of [
    { name: waveThreeData.people.leader, title: "Regional technology lead", domain: "Infrastructure", location: "São Paulo", start: "2021-04-12" },
    { name: waveThreeData.people.secondLeader, title: "Business applications lead", domain: "Applications", location: "Geneva", start: "2022-08-01" },
  ]) add(DashboardPeople.domain, "Team Structure", "saveLeader", leader)
  const leaderId = named(rows(snapshot.data.leaders), waveThreeData.people.leader)
  const secondLeaderId = named(rows(snapshot.data.leaders), waveThreeData.people.secondLeader)
  for (const member of [
    { name: waveThreeData.people.member, title: "Senior infrastructure engineer", type: "Employee", leaderId, location: "São Paulo", start: "2022-02-14", end: "", status: "Active", cls: "Talent", outlook: "Promote", notes: "Design test data · Leads regional continuity exercises and shares operational knowledge." },
    { name: waveThreeData.people.contractor, title: "Business applications specialist", type: "Contractor", leaderId: secondLeaderId, location: "Geneva", start: "2023-07-03", end: "", status: "Active", cls: "Solid Contributor", outlook: "Stay", notes: "Design test data · Supports the regional reporting programme." },
    { name: waveThreeData.people.departed, title: "Service delivery analyst", type: "Employee", leaderId, location: "São Paulo", start: "2021-01-11", end: year + "-05-31", status: "Terminated", cls: "", outlook: "Termination", notes: "" },
  ]) add(DashboardPeople.domain, "Team Structure", "saveMember", member)

  const primary = named(rows(snapshot.data.projects), waveThreeData.projects.primary)
  execute(DashboardPortfolio.domain, { page: "All Projects", action: "save", id: primary, version: revision(snapshot, "projects:" + primary),
    values: { name: waveThreeData.projects.primary, desc: "Design test data · Coordinate regional delivery milestones and ownership.", pm: "Design test operator",
      start: year + "-01-12", end: year + "-12-18", priority: "High", pct: 46, watchList: true,
      notes: "Design test data · Verify the next milestone with the source owner." } })
  execute(DashboardPortfolio.domain, { page: "All Projects", action: "save-milestone", id: primary, version: revision(snapshot, "projects:" + primary),
    values: { name: waveThreeData.projects.milestone, date: year + "-04-16", status: "done", notes: "Design test data · Discovery evidence accepted by the test operator." } })
  execute(DashboardPortfolio.domain, { page: "All Projects", action: "save-milestone", id: primary, version: revision(snapshot, "projects:" + primary),
    values: { name: "Design test data · Regional rollout", date: year + "-12-10", status: "upcoming", notes: "" } })
  add(DashboardPortfolio.domain, "All Projects", "save", { name: waveThreeData.projects.long,
    desc: "Design test data · A long project title exercises the native record layout.", status: "Planning", risk: "High", priority: "High", pm: "Design test operator",
    start: year + "-09-01", end: (year + 1) + "-06-30", budget: 180000, spent: 12000, pct: 12, watchList: true })
  add(DashboardPortfolio.domain, "All Projects", "save", { name: waveThreeData.projects.complete,
    status: "Completed", risk: "Low", priority: "Normal", pm: "Design test operator",
    start: year + "-01-10", end: year + "-06-30", budget: 64000, spent: 61200, pct: 100, watchList: false })

  for (const contract of [
    { name: waveThreeData.contracts.primary, vendor: waveThreeData.contracts.vendor, num: "TEST-MSA-001", category: "Infrastructure", amount: 144000, amtType: "annual", renewType: "auto", eval: "A", notice: "90 days" },
    { name: waveThreeData.contracts.renewal, vendor: "Design test data · Shield Assurance", num: "TEST-SEC-002", category: "Security", amount: 2400, amtType: "monthly", renewType: "fixed", eval: "B", notice: "60 days" },
    { name: waveThreeData.contracts.missing, vendor: "Design test data · Meridian Advisory", num: "", category: "", amount: 0, amtType: "total", renewType: "na", eval: "", notice: "" },
  ]) add(DashboardPortfolio.domain, "Vendor Contracts", "save", { ...contract, owner: "Design test operator",
    start: year + "-01-01", end: (year + 1) + "-12-31", renewal: (year + 1) + "-10-01",
    desc: "Design test data · Agreement terms are provided by the original source.", notes: "Design test data · Zero and blank optional values remain exactly as accepted by the producer." })

  const tickets = Object.fromEntries(["IT Security", "Infrastructure", "Application", "IT Operations", "Others (Beyers OT)"].flatMap((category, index) =>
    ["Incidents", "Service Requests"].flatMap((type) => [
      [category + "|" + type + "|Initial Balance", category === "Infrastructure" ? 5 : index],
      [category + "|" + type + "|Open", category === "Infrastructure" ? 12 : 4 + index],
      [category + "|" + type + "|Closed", category === "Infrastructure" ? 9 : 3 + index],
    ])))
  add(DashboardOperations.domain, "IT Operations", "save-tickets", { year, month, ...tickets })
  execute(DashboardOperations.domain, { page: "IT Operations", action: "save-sla", version: revision(snapshot, "ops:" + year + "-" + month),
    values: { year, month, incSLA: 98.4, svcSLA: 97.2, avail: 99.7 } })
  for (const item of [{ item: "iRely", p1: 0, p2: 1, tickets: 12 }, { item: "SAP BCC", p1: 0, p2: 0, tickets: 4 }])
    execute(DashboardOperations.domain, { page: "IT Operations", action: "save-heatmap", version: revision(snapshot, "ops:" + year + "-" + month),
      values: { year, month, ...item, comments: "Design test data · Monitored by the regional service owner." } })
  add(DashboardOperations.domain, "IT Security KPIs", "save-kpi", { year, month, training: 94, assessment: 91, scan: 98, patch: 96,
    patchEndpoint: 97, patchServer: 95, socCritical: 0, socHigh: 2, socMedium: 7, socLow: 14, socPending: 3, socTP: 12, socFP: 5,
    socEPS: 840, socIPs: 128, socClosure: 96, notes: "Design test data · Monthly security source record." })
  add(DashboardOperations.domain, "IT Security KPIs", "save-incident", { title: waveThreeData.operations.incident, date: date(3),
    impact: "Design test data · Controlled test incident with documented follow-up.", notes: "Design test data · Review ownership before closing.",
    contained: true, remediated: false, rootCause: true, consequences: ["Service unavailability"] })
  add(DashboardOperations.domain, "IT Security KPIs", "save-campaign", { name: waveThreeData.operations.campaign, start: date(1), end: date(28),
    targeted: 120, noInteraction: 80, openedOnly: 25, clicked: 10, entered: 5, reported: 42, trainingCompletion: 94, avgMinutes: 8,
    departments: [{ name: "Regional operations", users: 70, failed: 6, entered: 2, reported: 26 }, { name: "Finance", users: 50, failed: 4, entered: 3, reported: 16 }],
    notes: "Design test data · Department measures are source values." })
  add(DashboardOperations.domain, "IT Security KPIs", "save-action", { text: "Design test data · Review regional identity access", done: false })
  add(DashboardPortfolio.domain, "IT Risks", "save", { name: waveThreeData.operations.risk, desc: "Design test data · Dependency and mitigation evidence.",
    category: "Delivery", impact: 3, probability: 2, status: "monitoring", owner: "Design test operator", due: year + "-12-19",
    mitigation: "Design test data · Agree ownership and review the recovery plan.", notes: "" })
  for (const stakeholder of [
    { name: waveThreeData.operations.stakeholder, title: "Regional operations director", department: "Operations", biz: 4, iti: 5, perc: 3, priority: "action" },
    { name: "Design test data · Finance leadership", title: "Finance director", department: "Finance", biz: 5, iti: 4, perc: 4, priority: "monitor" },
  ]) add(DashboardPortfolio.domain, "Stakeholder Management", "save", { ...stakeholder, company: "Design test organisation", owner: "Design test operator",
    role: "Source stakeholder", email: "design-test@example.invalid", action: "Design test data · Review the regional service commitments.", notes: "" })
  add(DashboardPortfolio.domain, "IT Performance Contract", "save", { name: waveThreeData.operations.performance, year,
    items: [
      { name: waveThreeData.operations.objective, description: "Design test data · Service continuity and operational quality.", totalWeight: 0.6, ownerWeight: 0.4, co1Weight: 0.2, co2Weight: 0,
        subs: [{ label: waveThreeData.operations.subitem, objective: "Design test data · Restore services within the agreed window.", target: "98%", description: "Design test data · Evidence from the service source.",
          totalWeight: 0.6, owner: "Design test operator", ownerWeight: 0.4, co1: "Regional operations", co1Weight: 0.2, co2: "", co2Weight: 0,
          score: 3, status: "on", q1: 3, q2: 3, q3: 4, q4: "", statusQ1: "on", statusQ2: "on", statusQ3: "ahead", statusQ4: "", notes: "" }] },
      { name: "Design test data · Regional delivery quality", description: "Design test data · Clear milestones and accountable ownership.", totalWeight: 0.4, ownerWeight: 0.4, co1Weight: 0, co2Weight: 0,
        subs: [{ label: "Design test data · Complete the evidence review", objective: "Design test data · Review every committed milestone.", target: "100%", description: "",
          totalWeight: 0.4, owner: "Design test operator", ownerWeight: 0.4, co1Weight: 0, co2Weight: 0, score: 2, status: "behind", q1: 2, q2: 3, q3: "", q4: "", statusQ1: "behind", statusQ2: "on", statusQ3: "", statusQ4: "", notes: "" }] },
    ] })
}

export function seedWaveThreePlanner(snapshot: Snapshot, actor: Actor, environment: Environment, year: number) {
  const execute = executor(snapshot, actor, environment)
  const first = execute(PlannerModule.domain, { page: "Versions", action: "save", version: 0, values: {} })
  if (typeof first !== "string") throw new Error("Canonical Planner version omitted ID")
  execute(PlannerModule.domain, { page: "Versions", action: "save", id: first, version: revision(snapshot, "versions:" + first),
    values: { name: waveThreeData.planner.version, year } })
  const projectRows = () => rows(rows(snapshot.data.versions).find((version) => version.id === first)?.projects)
  const add = (page: string, values: Record<string, unknown>) =>
    execute(PlannerModule.domain, { page, action: "save", version: 0, values: { versionId: first, ...values } })
  add("OPEX", { collection: "lines", name: waveThreeData.planner.opex, el: "licenses", cur: "USD", owner: actor.id, annual: "120000",
    a: [9200, 9700, 9600, 10100, 9900, 0, null, null, null, null, null, null], f: [9800, 10000, 10100, 10200, 10300, 10400, 10500, 10600, 10700, 10800, 10900, 11000] })
  add("OPEX", { collection: "lines", name: waveThreeData.planner.opexServices, el: "services", cur: "USD", owner: actor.id, annual: "96000",
    a: [7100, 7400, 7600, 7800, 7900, null, null, null, null, null, null, null], f: [7800, 7900, 8000, 8100, 8200, 8300, 8400, 8500, 8600, 8700, 8800, 8900] })
  for (const project of [
    { name: waveThreeData.planner.project, approvalState: "approved", desc: "Design test data · Infrastructure resilience investment." },
    { name: waveThreeData.planner.secondProject, approvalState: "pending", desc: "Design test data · Reporting automation investment." },
  ]) add("CAPEX", { collection: "projects", ...project, owner: actor.id, investmentStart: year + "-01", investmentEnd: year + "-12" })
  add("CAPEX", { collection: "lines", name: waveThreeData.planner.capex, el: "hwo", cur: "USD", owner: actor.id,
    proj: named(projectRows(), waveThreeData.planner.project), cls: "capex", annual: "240000",
    a: [18000, 19000, 20000, 21000, 0, null, null, null, null, null, null, null], f: [19000, 19500, 20000, 20500, 21000, 21500, 22000, 22500, 23000, 23500, 24000, 24500] })
  add("CAPEX", { collection: "lines", name: waveThreeData.planner.capexServices, el: "services", cur: "USD", owner: actor.id,
    proj: named(projectRows(), waveThreeData.planner.secondProject), cls: "capex", annual: "72000",
    a: [5000, 5200, 5400, 5600, null, null, null, null, null, null, null, null], f: [5500, 5600, 5700, 5800, 5900, 6000, 6100, 6200, 6300, 6400, 6500, 6600] })
  execute(PlannerModule.domain, { page: "Versions", action: "copy", id: first, version: revision(snapshot, "versions:" + first),
    values: { name: waveThreeData.planner.comparison } })
}
