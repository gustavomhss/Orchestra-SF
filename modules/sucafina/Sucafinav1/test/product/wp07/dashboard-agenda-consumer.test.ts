import { expect, test } from "bun:test"
import { createDashboardAgendaSelector } from "../../../product/dashboard/agenda.ts"
import { createDashboardPort } from "../../../product/dashboard/port.ts"
import { createDashboardSourceHost } from "../../../product/dashboard/sources.ts"
import { createDashboardSourceIssuer } from "../../../product/integration/dashboard-sources.ts"
import { createReviewAgendaSelection } from "../../../product/reviews/selection.ts"
import type { ReviewAgendaItem, ReviewAgendaPorts } from "../../../product/reviews/selection.ts"
import { DashboardPortfolio } from "../../../runtime/dashboard-portfolio.ts"
import { DashboardBudget } from "../../../runtime/dashboard-budget.ts"
import { DashboardPeople } from "../../../runtime/dashboard-people.ts"
import { rows } from "../../../runtime/contract.ts"
import { createThreadActorsFixture } from "../wp08/thread-actors-fixture.ts"
import { available } from "../wp08/relations-fixture.ts"
import { expectUnchangedDomainState } from "../wp08/domain-state.ts"

// Uses the published Dashboard producer, scoped source issuers, real domain
// commands and SQLite. Actor admission is the explicit fixture boundary; this
// proves the agenda consumer, not an installed/native host or a Relay run.
test("review agenda consumes real Dashboard selectors with exact record identity, counts, order, empty scope and Talent denial", async () => {
  const f = await createThreadActorsFixture()
  try {
    // The source issuer requires actual domain collections; absent budget inputs
    // are unavailable, not empty arrays manufactured by the review consumer.
    await f.mutate("dashboard", DashboardBudget.domain, { page: "OPEX Detail", action: "save", version: 0, values: { name: "Selected budget owner", budget: 1200 } }, "budget-owner")
    await f.mutate("dashboard", DashboardBudget.domain, { page: "OPEX Detail", action: "save-entry", version: 0, values: { ownerId: "budget-owner", year: 2026, month: 1, budget: 100, actual: 80, forecast: 90 } }, "opex-january")
    await f.mutate("dashboard", DashboardBudget.domain, { page: "CAPEX Projects", action: "save-entry", version: 0, values: { projId: "capex", year: 2026, month: 1, budget: 20, actual: 10, forecast: 15 } }, "capex-january")
    await f.mutate("dashboard", DashboardPortfolio.domain, { page: "All Projects", action: "save", version: 0, values: { name: "Shared project", budget: 330, spent: 30, status: "In Progress", risk: "Low", notes: "Exact second record" } }, "project-same-name")
    await f.mutate("dashboard", DashboardPeople.domain, { page: "Team Structure", action: "saveLeader", version: 0, values: { name: "Selected leader", title: "Lead", domain: "IT" } }, "selected-leader")
    await f.mutate("dashboard", DashboardPeople.domain, { page: "Talent Review", action: "save", version: 0, values: { name: "PRIVATE_TALENT_NAME", title: "PRIVATE_TALENT_TITLE", status: "Active", cls: "Talent", outlook: "Promote", notes: "PRIVATE_TALENT_NOTE" } }, "private-member")
    const sources = createDashboardSourceHost({ host: f.host, scopedSources: f.persistence })
    const dashboard = createDashboardPort({ host: f.host, sources })
    const issue = createDashboardSourceIssuer({ host: f.host, scopedSources: f.persistence })
    const selectDashboardAgenda = createDashboardAgendaSelector({ host: f.host, dashboard, sources, recordEvidence: f.records })
    const ports: ReviewAgendaPorts = {
      selectDashboardAgenda,
      planner: { compareForecast: async () => ({ status: "unavailable", reason: "not-selected" }) },
      procurement: { read: async () => ({ status: "unavailable", reason: "not-selected" }), readSupplier: async () => ({ status: "unavailable", reason: "not-selected" }), readContract: async () => ({ status: "unavailable", reason: "not-selected" }) },
    }
    const agenda = createReviewAgendaSelection({ ports, revalidate: f.host.revalidate, now: () => "2026-11-13T00:00:00Z" })
    const budget = available(await issue({ page: "Budget Overview", fields: ["opexOwners", "opexEntries", "capexProjects", "capexEntries", "budgetMetrics"], period: f.period }, f.author))
    const projects = available(await issue({ page: "Portfolio Dashboard", fields: ["projects", "milestoneDates"], period: f.period }, f.author))
    const hot = available(await issue({ page: "Hot Topics & Actions", fields: ["hotTopics"], period: f.period }, f.author))
    const talent = available(await issue({ page: "Talent Review", fields: ["members", "leaders"], period: f.period }, f.author))
    const exactProject = available(await f.records.issue({ page: "Portfolio Dashboard", recordType: "projects", recordId: "project-same-name", fields: ["id"], period: f.period }, f.author))
    const before = await f.snapshots()
    const items: readonly ReviewAgendaItem[] = [
      { id: "budget", kind: "dashboard", topic: "budget", selectionRef: budget.selectionRef, period: f.period, agendaNote: "Budget discussion" },
      { id: "projects", kind: "dashboard", topic: "projects", selectionRef: projects.selectionRef, period: f.period, agendaNote: "Keep the selected project note" },
      { id: "hot", kind: "dashboard", topic: "hot-topics", selectionRef: hot.selectionRef, period: f.period },
    ]
    const first = available(await agenda.create(items, f.author))
    expect(first.sections.map((section) => [section.id, section.recordCount])).toEqual([
      ["budget", rows(before.dashboard.data.opexOwners).length + rows(before.dashboard.data.capexProjects).length],
      ["projects", rows(before.dashboard.data.projects).length],
      ["hot", rows(before.dashboard.data.hotTopics).length],
    ])
    const reordered = available(await agenda.select(first.selectionRef, ["hot", "projects", "budget"], f.author, f.period))
    expect(reordered.map((section) => section.id)).toEqual(["hot", "projects", "budget"])
    expect(reordered[1]?.agendaNote).toBe("Keep the selected project note")
    const chosen = available(await agenda.create([items[2]!, { ...items[1]!, recordRefs: [exactProject.refId] }, items[0]!], f.author))
    expect(chosen.sections.map((section) => section.id)).toEqual(["hot", "projects", "budget"])
    expect(chosen.sectionRecordRefs[1]).toEqual({ sectionRef: "projects", recordRefs: [exactProject.refId] })
    expect(chosen.sections[1]?.recordCount).toBe(1)
    expect(chosen.sections[1]?.projection.values.find((value) => value.id === "projects[id:project-same-name].budget")?.value).toBe(330)
    expect(chosen.sections[1]?.projection.values.some((value) => value.id.startsWith("projects[id:project]."))).toBe(false)
    expect(chosen.sections.every((section) => section.period.start === f.period.start && section.period.end === f.period.end && section.projection.context.sourceRefs.every((ref) => ref.period.start === f.period.start && ref.period.end === f.period.end))).toBe(true)
    const empty = available(await agenda.create([{ ...items[2]!, recordRefs: [] }], f.author))
    expect(empty.sections[0]).toMatchObject({ recordCount: 0, projection: { values: [], components: [], missing: [] } })
    expectUnchangedDomainState(before, await f.snapshots())
    const forbiddenSource = await issue({ page: "Talent Review", fields: ["members", "leaders"], period: f.period }, f.recipient)
    expect(forbiddenSource.status).not.toBe("ok")
    const forbiddenAgenda = await agenda.create([{ id: "talent", kind: "dashboard", topic: "talent-review", selectionRef: talent.selectionRef, period: f.period }], f.recipient)
    expect(forbiddenAgenda.status).not.toBe("ok")
    expect(JSON.stringify([forbiddenSource, forbiddenAgenda])).not.toContain("PRIVATE_TALENT")
    f.actors.person!.enabled = false
    const revoked = await agenda.select(first.selectionRef, first.sectionRefs, f.author, f.period)
    expect(revoked.status).toBe("denied")
    expect(JSON.stringify(revoked)).not.toContain("Shared project")
  } finally { await f.dispose() }
}, 120000)
