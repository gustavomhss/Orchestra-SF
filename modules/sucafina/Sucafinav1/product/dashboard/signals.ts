import { hotTopicView } from "../../runtime/dashboard-people.ts"
import { DashboardPortfolio } from "../../runtime/dashboard-portfolio.ts"
import { rows, text, finite } from "../../runtime/contract.ts"
import type { Actor, Environment, Snapshot } from "../../runtime/contract.ts"
import { dashboardPages } from "../../src/nav.ts"
import { riskScore } from "../../src/dashboard-accounts.ts"

export function dashboardSignals(snapshot: Snapshot, actor: Actor, environment: Environment) {
  const summaries = Array.isArray(snapshot.data.summaries) ? snapshot.data.summaries.filter((x): x is string => typeof x === "string") : []
  const allowed = dashboardPages(actor, summaries)
  const topics = allowed.includes("Hot Topics & Actions") ? hotTopicView(snapshot, actor) : []
  const portfolio = DashboardPortfolio.domain.view(snapshot, actor, environment).data
  const today = environment.at.slice(0, 10)
  const validDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value
  const actionSignals = topics.flatMap((row) => {
    const due = text(row.due)
    if (!text(row.id) || !["open", "progress", "blocked"].includes(text(row.status)) || !validDate(due) || due >= today) return []
    return [{ id: `hotTopics:${text(row.id)}`, page: "Hot Topics & Actions", recordId: text(row.id), fact: text(row.action), rule: "Open action past due date", date: due }]
  })
  const riskSignals = allowed.includes("IT Risks") ? rows(portfolio.risks).flatMap((row) => {
    if (!text(row.id) || !["open", "mitigating", "monitoring"].includes(text(row.status)) || riskScore(finite(row.impact), finite(row.probability)) < 16) return []
    return [{ id: `risks:${text(row.id)}`, page: "IT Risks", recordId: text(row.id), fact: text(row.title) || text(row.name), rule: "Open risk with impact × probability at least 16", date: text(row.due) }]
  }) : []
  const renewalLimit = new Date(`${today}T00:00:00Z`)
  renewalLimit.setUTCDate(renewalLimit.getUTCDate() + 90)
  const limit = Number.isFinite(renewalLimit.getTime()) ? renewalLimit.toISOString().slice(0, 10) : ""
  const contractSignals = allowed.includes("Vendor Contracts") && limit ? rows(portfolio.contracts).flatMap((row) => {
    const renewal = text(row.renewal)
    if (!text(row.id) || !validDate(renewal) || renewal < today || renewal > limit) return []
    return [{ id: `contracts:${text(row.id)}`, page: "Vendor Contracts", recordId: text(row.id), fact: text(row.vendor) || text(row.name), rule: "Renewal within 90 days", date: renewal }]
  }) : []
  return [...actionSignals, ...riskSignals, ...contractSignals].sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999") || a.id.localeCompare(b.id))
}
